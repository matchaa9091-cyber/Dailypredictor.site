"use server";

import { createClient } from '@supabase/supabase-js';

// Use service-role-capable client for server-side writes
// Falls back to anon key if service key not set (RLS must allow anon inserts)
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export async function saveSingleAccumAction(tier, acc) {
  // --- Validate inputs ---
  if (!tier || !acc || !Array.isArray(acc.matches) || acc.matches.length === 0) {
    console.error("[saveSingleAccumAction] Invalid arguments:", { tier, acc });
    return null;
  }

  // Calculate total odds server-side for accuracy
  const totalOdds = acc.matches.reduce((prod, m) => prod * (isNaN(Number(m.odds)) ? 1 : Number(m.odds)), 1);

  // Find the earliest kickoff to use as first_kickoff
  // datetime-local gives "YYYY-MM-DDTHH:mm" — append :00Z if no timezone
  const toISO = (str) => {
    if (!str) return new Date().toISOString();
    return new Date(str).toISOString();
  };

  const firstKickoff = acc.matches
    .map(m => new Date(toISO(m.kickoff)).getTime())
    .reduce((earliest, t) => (t < earliest ? t : earliest), Infinity);

  // --- Insert ticket row ---
  const { data: accumData, error: accumError } = await supabase
    .from('daily_accums')
    .insert({
      tier,
      total_odds: Number(totalOdds.toFixed(2)),
      date: new Date().toISOString().slice(0, 10),
      first_kickoff: new Date(firstKickoff).toISOString(),
    })
    .select()
    .single();

  if (accumError) {
    console.error("[saveSingleAccumAction] Error inserting daily_accums:", accumError);
    return null;
  }

  // --- Insert match_details rows ---
  const matchesToInsert = acc.matches.map(m => ({
    accum_id: accumData.id,
    home_team: m.h,
    away_team: m.a,
    league: m.lg,
    flag: m.fl,
    kickoff: toISO(m.kickoff),
    market: m.mkt,
    pick: m.pick,
    odds: Number(m.odds),
    confidence: Number(m.conf) || null,
    analysis: m.analysis || null,
    is_hot: Boolean(m.hot),
  }));

  const { error: matchError } = await supabase
    .from('match_details')
    .insert(matchesToInsert);

  if (matchError) {
    console.error("[saveSingleAccumAction] Error inserting match_details:", matchError);
    // Roll back the accum row to keep DB consistent
    await supabase.from('daily_accums').delete().eq('id', accumData.id);
    return null;
  }

  console.log(`[saveSingleAccumAction] ✅ Saved ${tier} ticket (id: ${accumData.id})`);
  return accumData;
}

export async function getLatestAccumsAction() {
  const tiers = ["free", "vip", "premium"];
  const results = {};
  const today = new Date().toISOString().slice(0, 10);

  for (const tier of tiers) {
    const { data, error } = await supabase
      .from('daily_accums')
      .select(`
        *,
        matches:match_details(*)
      `)
      .eq('tier', tier)
      .eq('date', today)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error(`[getLatestAccumsAction] Error fetching ${tier}:`, error);
      continue;
    }

    if (data && data.matches) {
      // Map DB column names → UI field names
      data.matches = data.matches.map(m => ({
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
        hot: m.is_hot,
      }));
      results[tier] = data;
    }
  }

  return results;
}


// ─── Admin: List ALL tickets (all tiers, all dates) ────────────────────
export async function getAllAccumsAction() {
  const { data, error } = await supabase
    .from('daily_accums')
    .select(`
      *,
      matches:match_details(*)
    `)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[getAllAccumsAction] Error:', error);
    return [];
  }

  return (data || []).map(row => ({
    ...row,
    matches: (row.matches || []).map(m => ({
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
      hot: m.is_hot,
    })),
  }));
}

// ─── Admin: Delete a ticket (cascades to match_details) ───────────────
export async function deleteAccumAction(accumId) {
  // Delete match_details first (if no ON DELETE CASCADE)
  await supabase.from('match_details').delete().eq('accum_id', accumId);
  const { error } = await supabase.from('daily_accums').delete().eq('id', accumId);
  if (error) {
    console.error('[deleteAccumAction] Error:', error);
    return false;
  }
  return true;
}

// ─── Admin: Update a ticket's tier + matches ──────────────────────────
export async function updateAccumAction(accumId, tier, matches) {
  const toISO = (str) => {
    if (!str) return new Date().toISOString();
    return new Date(str).toISOString();
  };

  const totalOdds = matches.reduce((p, m) => p * (isNaN(Number(m.odds)) ? 1 : Number(m.odds)), 1);
  const firstKickoff = matches
    .map(m => new Date(toISO(m.kickoff)).getTime())
    .reduce((earliest, t) => (t < earliest ? t : earliest), Infinity);

  // Update the parent row
  const { error: accumErr } = await supabase
    .from('daily_accums')
    .update({
      tier,
      total_odds: Number(totalOdds.toFixed(2)),
      first_kickoff: new Date(firstKickoff).toISOString(),
    })
    .eq('id', accumId);

  if (accumErr) {
    console.error('[updateAccumAction] Error updating daily_accums:', accumErr);
    return false;
  }

  // Replace match_details
  await supabase.from('match_details').delete().eq('accum_id', accumId);
  const toInsert = matches.map(m => ({
    accum_id: accumId,
    home_team: m.h,
    away_team: m.a,
    league: m.lg,
    flag: m.fl,
    kickoff: toISO(m.kickoff),
    market: m.mkt,
    pick: m.pick,
    odds: Number(m.odds),
    confidence: Number(m.conf) || null,
    analysis: m.analysis || null,
    is_hot: Boolean(m.hot),
  }));

  const { error: matchErr } = await supabase.from('match_details').insert(toInsert);
  if (matchErr) {
    console.error('[updateAccumAction] Error updating match_details:', matchErr);
    return false;
  }
  return true;
}

export async function requestPaymentAction(phone, method, tier, price, trId) {
  const { data, error } = await supabase
    .from('payment_requests')
    .insert({
      phone_number: phone,
      method,
      tier,
      amount: price,
      transaction_id: trId,
      status: 'pending',
      date: new Date().toISOString().slice(0, 10),
    })
    .select()
    .single();

  if (error) {
    console.error("[requestPaymentAction] Error:", error);
    return { success: false, error };
  }
  return { success: true, data };
}

export async function verifyPaymentAction(requestId) {
  // 1. Get the request details
  const { data: req, error: fetchErr } = await supabase
    .from('payment_requests')
    .select('*')
    .eq('id', requestId)
    .single();

  if (fetchErr || !req) {
    console.error("[verifyPaymentAction] Fetch Error:", fetchErr);
    return false;
  }

  // 2. Update request status
  const { error: updateErr } = await supabase
    .from('payment_requests')
    .update({ status: 'verified' })
    .eq('id', requestId);

  if (updateErr) {
    console.error("[verifyPaymentAction] Update Error:", updateErr);
    return false;
  }

  // 3. Unlock the ticket for the user
  const { error: unlockErr } = await supabase
    .from('unlocked_tickets')
    .insert({
      phone_number: req.phone_number,
      tier: req.tier,
      date: req.date
    });

  if (unlockErr) {
    // If it already exists, that's fine
    if (unlockErr.code !== '23505') { 
      console.error("[verifyPaymentAction] Unlock Error:", unlockErr);
    }
  }

  return true;
}

export async function checkUnlockStatusAction(phone) {
  const today = new Date().toISOString().slice(0, 10);
  const { data, error } = await supabase
    .from('unlocked_tickets')
    .select('*')
    .eq('phone_number', phone)
    .eq('date', today)
    .single();

  if (error || !data) return false;
  return true;
}

export async function getPaymentRequestsAction() {
  const { data, error } = await supabase
    .from('payment_requests')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.error("[getPaymentRequestsAction] Error:", error);
    return [];
  }
  return data || [];
}
