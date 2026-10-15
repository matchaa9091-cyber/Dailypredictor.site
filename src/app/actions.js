"use server";

import { revalidatePath, unstable_noStore as noStore } from 'next/cache';
import { getD1 } from '../lib/d1';

export async function saveSingleAccumAction(tier, acc) {
  // --- Validate inputs ---
  if (!tier || !acc || !Array.isArray(acc.matches) || acc.matches.length === 0) {
    console.error("[saveSingleAccumAction] Invalid arguments:", { tier, acc });
    return null;
  }

  const db = await getD1();

  // Calculate total odds server-side for accuracy
  const totalOdds = acc.matches.reduce((prod, m) => prod * (isNaN(Number(m.odds)) ? 1 : Number(m.odds)), 1);

  const toISO = (str) => {
    if (!str) return new Date().toISOString();
    return new Date(str).toISOString();
  };

  const firstKickoff = acc.matches
    .map(m => new Date(toISO(m.kickoff)).getTime())
    .reduce((earliest, t) => (t < earliest ? t : earliest), Infinity);

  const dateToday = new Date().toISOString().slice(0, 10);
  const firstKickoffIso = new Date(firstKickoff).toISOString();
  const roundedOdds = Number(totalOdds.toFixed(2));
  const bookingCode = acc.bookingCode || null;

  try {
    // 1. Insert ticket into daily_accums
    const insertRes = await db.prepare(
      `INSERT INTO daily_accums (tier, total_odds, date, first_kickoff, booking_code)
       VALUES (?, ?, ?, ?, ?)`
    ).bind(tier, roundedOdds, dateToday, firstKickoffIso, bookingCode).run();

    const accumId = insertRes?.meta?.last_row_id;
    if (!accumId) {
      console.error("[saveSingleAccumAction] Error: Missing last_row_id after insert");
      return null;
    }

    // 2. Insert matches into match_details
    for (const m of acc.matches) {
      await db.prepare(
        `INSERT INTO match_details (
          accum_id, home_team, away_team, league, flag, kickoff, market, pick, odds, confidence, analysis, is_hot, image_url
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).bind(
        accumId,
        m.h,
        m.a,
        m.lg || null,
        m.fl || null,
        toISO(m.kickoff),
        m.mkt,
        m.pick,
        Number(m.odds),
        Number(m.conf) || null,
        m.analysis || null,
        m.hot ? 1 : 0,
        m.imageUrl || null
      ).run();
    }

    console.log(`[saveSingleAccumAction] ✅ Saved ${tier} ticket (id: ${accumId})`);
    revalidatePath('/', 'layout');
    return {
      id: accumId,
      tier,
      total_odds: roundedOdds,
      date: dateToday,
      first_kickoff: firstKickoffIso,
      booking_code: bookingCode
    };
  } catch (err) {
    console.error("[saveSingleAccumAction] Database Error:", err);
    return null;
  }
}

export async function getLatestAccumsAction(phone = null, deviceId = null) {
  noStore();
  const db = await getD1();
  const tiers = ["free", "vip", "premium"];
  const results = {};
  const today = new Date().toISOString().slice(0, 10);

  // Get unlocked status for this phone and device
  let unlockedTiers = [];
  if (phone) {
    try {
      const cleanPhone = phone.replace(/\D/g, "").slice(-9);
      const { results: unlockedData } = await db.prepare(
        `SELECT tier, device_id FROM unlocked_tickets WHERE (phone_number LIKE ? OR phone_number = ?) AND date = ?`
      ).bind(`%${cleanPhone}`, phone, today).all();

      if (unlockedData) {
        unlockedTiers = unlockedData
          .filter(u => !u.device_id || !deviceId || u.device_id === deviceId)
          .map(u => u.tier);
      }
    } catch (err) {
      console.error("[getLatestAccumsAction] Error checking unlocked tickets:", err);
    }
  }

  for (const tier of tiers) {
    try {
      const { results: accumRows } = await db.prepare(
        `SELECT * FROM daily_accums WHERE tier = ? AND date = ? ORDER BY created_at DESC`
      ).bind(tier, today).all();

      if (accumRows && accumRows.length > 0) {
        const isUnlocked = tier === "free" || unlockedTiers.includes(tier) || unlockedTiers.length > 0;
        const now = new Date();

        const processedTickets = [];
        for (const ticket of accumRows) {
          const kickTime = new Date(ticket.first_kickoff);
          if (kickTime <= now) continue; // Filter out expired tickets

          const { results: matchRows } = await db.prepare(
            `SELECT * FROM match_details WHERE accum_id = ? ORDER BY id ASC`
          ).bind(ticket.id).all();

          processedTickets.push({
            ...ticket,
            matches: (matchRows || []).map(m => ({
              id: m.id,
              h: m.home_team,
              a: m.away_team,
              lg: m.league,
              fl: m.flag,
              kickoff: m.kickoff,
              mkt: m.market,
              pick: isUnlocked ? m.pick : "🔒 LOCKED",
              odds: isUnlocked ? m.odds : "🔒",
              conf: isUnlocked ? m.confidence : null,
              analysis: isUnlocked ? m.analysis : "Please unlock to view expert analysis.",
              hot: Boolean(m.is_hot),
              imageUrl: m.image_url || null,
            }))
          });
        }

        if (processedTickets.length > 0) {
          results[tier] = processedTickets;
        }
      }
    } catch (err) {
      console.error(`[getLatestAccumsAction] Error fetching ${tier}:`, err);
    }
  }

  return results;
}

// ─── Admin: List ALL tickets (all tiers, all dates) ────────────────────
export async function getAllAccumsAction() {
  noStore();
  const db = await getD1();

  try {
    const { results: accumRows } = await db.prepare(
      `SELECT * FROM daily_accums ORDER BY created_at DESC`
    ).all();

    const ticketsWithMatches = [];
    for (const row of (accumRows || [])) {
      const { results: matchRows } = await db.prepare(
        `SELECT * FROM match_details WHERE accum_id = ? ORDER BY id ASC`
      ).bind(row.id).all();

      ticketsWithMatches.push({
        ...row,
        matches: (matchRows || []).map(m => ({
          id: m.id,
          h: m.home_team,
          a: m.away_team,
          lg: m.league,
          fl: m.flag,
          kickoff: m.kickoff,
          mkt: m.market,
          pick: m.pick,
          odds: m.odds,
          conf: m.confidence,
          analysis: m.analysis,
          hot: Boolean(m.is_hot),
          imageUrl: m.image_url || null,
        })),
      });
    }

    return ticketsWithMatches;
  } catch (err) {
    console.error('[getAllAccumsAction] Error:', err);
    return [];
  }
}

// ─── Admin: Delete a ticket (cascades to match_details) ───────────────
export async function deleteAccumAction(accumId) {
  const db = await getD1();
  try {
    await db.prepare(`DELETE FROM match_details WHERE accum_id = ?`).bind(accumId).run();
    await db.prepare(`DELETE FROM daily_accums WHERE id = ?`).bind(accumId).run();
    revalidatePath('/', 'layout');
    return true;
  } catch (err) {
    console.error('[deleteAccumAction] Error:', err);
    return false;
  }
}

// ─── Admin: Update a ticket's tier + matches ──────────────────────────
export async function updateAccumAction(accumId, tier, matches, bookingCode) {
  const db = await getD1();
  const toISO = (str) => {
    if (!str) return new Date().toISOString();
    return new Date(str).toISOString();
  };

  const totalOdds = matches.reduce((p, m) => p * (isNaN(Number(m.odds)) ? 1 : Number(m.odds)), 1);
  const firstKickoff = matches
    .map(m => new Date(toISO(m.kickoff)).getTime())
    .reduce((earliest, t) => (t < earliest ? t : earliest), Infinity);

  try {
    // 1. Update the parent row
    await db.prepare(
      `UPDATE daily_accums
       SET tier = ?, total_odds = ?, first_kickoff = ?, booking_code = ?
       WHERE id = ?`
    ).bind(
      tier,
      Number(totalOdds.toFixed(2)),
      new Date(firstKickoff).toISOString(),
      bookingCode || null,
      accumId
    ).run();

    // 2. Replace match_details
    await db.prepare(`DELETE FROM match_details WHERE accum_id = ?`).bind(accumId).run();

    for (const m of matches) {
      await db.prepare(
        `INSERT INTO match_details (
          accum_id, home_team, away_team, league, flag, kickoff, market, pick, odds, confidence, analysis, is_hot, image_url
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).bind(
        accumId,
        m.h,
        m.a,
        m.lg || null,
        m.fl || null,
        toISO(m.kickoff),
        m.mkt,
        m.pick,
        Number(m.odds),
        Number(m.conf) || null,
        m.analysis || null,
        m.hot ? 1 : 0,
        m.imageUrl || null
      ).run();
    }

    revalidatePath('/', 'layout');
    return true;
  } catch (err) {
    console.error('[updateAccumAction] Error:', err);
    return false;
  }
}

export async function requestPaymentAction(phone, method, tier, price, trId = null, receiptUrl = null, deviceId = null) {
  const db = await getD1();
  const today = new Date().toISOString().slice(0, 10);
  const cleanTrId = trId ? trId.trim().toUpperCase() : null;
  const cleanPhone = phone ? phone.replace(/\D/g, "").slice(-9) : "";

  try {
    // 1. Anti-sharing check: Has this phone number already been claimed/unlocked today by another device?
    if (cleanPhone && deviceId) {
      const existingUnlock = await db.prepare(
        `SELECT device_id FROM unlocked_tickets 
         WHERE (phone_number LIKE ? OR phone_number = ?) 
           AND date = ? LIMIT 1`
      ).bind(`%${cleanPhone}`, phone, today).first();

      if (existingUnlock) {
        if (existingUnlock.device_id && existingUnlock.device_id !== deviceId) {
          return {
            success: false,
            error: "This phone number has already been used to unlock tickets on another device today. Each payment can only be claimed once."
          };
        }
        // Already unlocked for this exact device
        return {
          success: true,
          verified: true,
          data: { phone_number: phone, tier, status: 'verified', device_id: deviceId, date: today }
        };
      }

      // Check if another device already initiated an active pending verification with this phone today
      const otherDeviceReq = await db.prepare(
        `SELECT id FROM payment_requests 
         WHERE (phone_number LIKE ? OR phone_number = ?) 
           AND date = ? 
           AND device_id IS NOT NULL 
           AND device_id != ? 
           AND status = 'pending' LIMIT 1`
      ).bind(`%${cleanPhone}`, phone, today, deviceId).first();

      if (otherDeviceReq) {
        return {
          success: false,
          error: "A payment verification is already in progress for this phone number on another device. Each payment can only be claimed by the original payer."
        };
      }
    }

    // 2. Check if an UNCLAIMED SMS from this sender has already arrived today in sms_logs
    let matchingSms = null;
    if (cleanPhone) {
      matchingSms = await db.prepare(
        `SELECT id, content FROM sms_logs 
         WHERE status = 'processing' 
           AND (content LIKE ? OR sender LIKE ?)
         ORDER BY created_at DESC LIMIT 1`
      ).bind(`%${cleanPhone}%`, `%${cleanPhone}%`).first();
    }

    const isAlreadyPaid = Boolean(matchingSms);
    const initialStatus = isAlreadyPaid ? 'verified' : 'pending';

    const res = await db.prepare(
      `INSERT INTO payment_requests (phone_number, method, tier, amount, transaction_id, receipt_url, status, device_id, date)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(phone, method, tier, price, cleanTrId, receiptUrl, initialStatus, deviceId, today).run();

    const insertId = res?.meta?.last_row_id;

    if (isAlreadyPaid) {
      // Mark SMS log as matched so NO other person can claim it!
      await db.prepare(`UPDATE sms_logs SET status = 'matched' WHERE id = ?`).bind(matchingSms.id).run();
      // Unlock ticket and bind strictly to THIS device
      await db.prepare(
        `INSERT OR REPLACE INTO unlocked_tickets (phone_number, tier, date, device_id) VALUES (?, ?, ?, ?)`
      ).bind(phone, tier, today, deviceId).run();
    }

    return {
      success: true,
      verified: isAlreadyPaid,
      data: {
        id: insertId,
        phone_number: phone,
        method,
        tier,
        amount: price,
        transaction_id: cleanTrId,
        receipt_url: receiptUrl,
        status: initialStatus,
        device_id: deviceId,
        date: today
      }
    };
  } catch (err) {
    console.error("[requestPaymentAction] Error:", err);
    return { success: false, error: err.message };
  }
}

export async function verifyPaymentAction(requestId) {
  const db = await getD1();
  try {
    // 1. Get the request details
    const req = await db.prepare(
      `SELECT * FROM payment_requests WHERE id = ?`
    ).bind(requestId).first();

    if (!req) {
      console.error("[verifyPaymentAction] Fetch Error: Request not found");
      return false;
    }

    // 2. Update request status
    await db.prepare(
      `UPDATE payment_requests SET status = 'verified' WHERE id = ?`
    ).bind(requestId).run();

    // 3. Unlock ticket bound to the user's device
    const today = new Date().toISOString().slice(0, 10);
    await db.prepare(
      `INSERT OR REPLACE INTO unlocked_tickets (phone_number, tier, date, device_id) VALUES (?, ?, ?, ?)`
    ).bind(req.phone_number, req.tier, today, req.device_id || null).run();

    return true;
  } catch (err) {
    console.error("[verifyPaymentAction] Error:", err);
    return false;
  }
}

export async function checkUnlockStatusAction(phone, deviceId = null) {
  if (!phone) return false;
  const db = await getD1();
  const today = new Date().toISOString().slice(0, 10);
  const cleanPhone = phone.replace(/\D/g, "").slice(-9);

  try {
    const row = await db.prepare(
      `SELECT id, device_id FROM unlocked_tickets 
       WHERE (phone_number LIKE ? OR phone_number = ?) 
         AND date = ? LIMIT 1`
    ).bind(`%${cleanPhone}`, phone, today).first();

    if (!row) return false;
    // If bound to a device, verify device match
    if (row.device_id && deviceId && row.device_id !== deviceId) {
      return false;
    }

    return true;
  } catch (err) {
    console.error("[checkUnlockStatusAction] Error:", err);
    return false;
  }
}

export async function getPaymentRequestsAction() {
  const db = await getD1();
  try {
    const { results } = await db.prepare(
      `SELECT * FROM payment_requests ORDER BY created_at DESC`
    ).all();
    return results || [];
  } catch (err) {
    console.error("[getPaymentRequestsAction] Error:", err);
    return [];
  }
}

export async function getSmsLogsAction() {
  const db = await getD1();
  try {
    const { results } = await db.prepare(
      `SELECT * FROM sms_logs ORDER BY created_at DESC LIMIT 50`
    ).all();
    return results || [];
  } catch (err) {
    console.error("[getSmsLogsAction] Error:", err);
    return [];
  }
}

export async function getPerformanceResultsAction() {
  const db = await getD1();
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  try {
    const { results } = await db.prepare(
      `SELECT * FROM performance_results WHERE created_at >= ? ORDER BY created_at DESC`
    ).bind(sevenDaysAgo.toISOString()).all();

    return results || [];
  } catch (err) {
    console.error("[getPerformanceResultsAction] Error:", err);
    return [];
  }
}

export async function addPerformanceResultAction(tier, status, odds) {
  const db = await getD1();
  try {
    const res = await db.prepare(
      `INSERT INTO performance_results (tier, status, odds) VALUES (?, ?, ?)`
    ).bind(tier, status, odds ? Number(odds) : null).run();

    return {
      success: true,
      data: {
        id: res?.meta?.last_row_id,
        tier,
        status,
        odds
      }
    };
  } catch (err) {
    console.error("[addPerformanceResultAction] Error:", err);
    return { success: false, error: err.message };
  }
}

export async function deletePerformanceResultAction(id) {
  const db = await getD1();
  try {
    await db.prepare(`DELETE FROM performance_results WHERE id = ?`).bind(id).run();
    return true;
  } catch (err) {
    console.error("[deletePerformanceResultAction] Error:", err);
    return false;
  }
}
