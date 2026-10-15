import { NextResponse } from 'next/server';
import { getD1 } from '../../../../lib/d1';

// Secret key used to verify requests coming from httpsms.com webhook
// Set this in your httpsms.com webhook headers as: X-Api-Key: Danvid_API_Key_256
const SECRET_WEBHOOK_KEY = "Danvid_API_Key_256";

export async function POST(req) {
  try {
    const db = await getD1();

    // ── Security: check query key, header key, or httpSMS verified owner ──────
    const { searchParams } = new URL(req.url);
    const queryKey = searchParams.get('key');
    const headerKey = req.headers.get('x-api-key') || req.headers.get('authorization');
    const eventType = req.headers.get('x-event-type');

    let body = null;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const isKeyAuthorized = (headerKey === SECRET_WEBHOOK_KEY || queryKey === SECRET_WEBHOOK_KEY);
    // httpSMS includes owner phone and X-Event-Type header on outgoing webhooks from your SIM
    const isOwnerAuthorized = (
      Boolean(eventType) &&
      (body?.owner === "+256765040502" || body?.owner === "256765040502" || body?.owner === "0765040502" || body?.data?.owner === "+256765040502")
    );

    if (!isKeyAuthorized && !isOwnerAuthorized) {
      console.warn("[Webhook] ⛔ Unauthorized attempt blocked");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // ── Parse httpsms.com payload format ────────────────────────────────────
    let content = "";
    let sender = "";

    if (body?.content) {
      // httpSMS direct format
      content = body.content;
      sender = body.contact || body.sender || body.from || "MTN";
    } else if (body?.data?.content) {
      // httpSMS wrapped format
      content = body.data.content;
      sender = body.data.contact || body.data.from || body.data.sender || "MTN";
    }

    if (!content) {
      return NextResponse.json({ error: "No SMS content found in payload" }, { status: 400 });
    }

    console.log(`[Webhook] 📩 SMS from ${sender}: ${content.substring(0, 80)}...`);

    // ── RegEx: Extract Sender Phone Number (Uganda 9-digit format) ─────────
    // Matches "from 2567XXXXXXXX", "from 07XXXXXXXX", "(2567XXXXXXXX)", etc.
    let payerPhone = null;
    const fromMatch = content.match(/from\s+[^0-9\n\r]*?(?:\+?256|0)?(7\d{8})\b/i);
    if (fromMatch && fromMatch[1]) {
      payerPhone = fromMatch[1];
    } else {
      const parenMatch = content.match(/\((?:\+?256|0)?(7\d{8})\)/);
      if (parenMatch && parenMatch[1]) {
        payerPhone = parenMatch[1];
      } else {
        const anyUgandaPhone = content.match(/(?:\b|\+)(?:256|0)?(7\d{8})\b/);
        if (anyUgandaPhone && anyUgandaPhone[1]) {
          payerPhone = anyUgandaPhone[1];
        }
      }
    }

    // ── RegEx: Extract Transaction ID (optional / fallback) ───────────────────
    const idMatch = content.match(
      /(?:Trans(?:action)?\.?\s*ID|Ref(?:erence)?|TxID|Receipt|\bID\b)[:\s]+([0-9A-Z]{4,25})/i
    );
    const trId = idMatch ? idMatch[1].trim().toUpperCase() : null;

    // ── RegEx: Extract Amount ────────────────────────────────────────────────
    const amountMatch = content.match(/(?:UGX|SHS?)\.?\s*([\d,]+)|([\d,]+)\s*(?:UGX|SHS?)/i);
    const amountStr = amountMatch ? (amountMatch[1] || amountMatch[2]) : null;
    const amount = amountStr ? parseInt(amountStr.replace(/,/g, '')) : null;

    // ── Log the SMS to database ──────────────────────────────────────────────
    const isAmountValid = amount === null || amount >= 1000;
    const initialStatus = ((payerPhone || trId) && isAmountValid) ? 'processing' : 'ignored';

    const insertLogRes = await db.prepare(
      `INSERT INTO sms_logs (content, sender, status) VALUES (?, ?, ?)`
    ).bind(content, sender, initialStatus).run();

    const logId = insertLogRes?.meta?.last_row_id;

    if (!payerPhone && !trId) {
      console.log("[Webhook] Neither phone number nor Transaction ID detected — SMS logged as ignored.");
      return NextResponse.json({ message: "SMS logged. No sender phone detected.", amount });
    }

    if (!isAmountValid) {
      console.log(`[Webhook] ⛔ Payment rejected: Low amount (UGX ${amount}). Minimum is 1000.`);
      if (logId) {
        await db.prepare(`UPDATE sms_logs SET status = 'ignored' WHERE id = ?`).bind(logId).run();
      }
      return NextResponse.json({ message: "Payment too low. Minimum 1000 required.", amount });
    }

    console.log(`[Webhook] 🔍 Extracted Payer Phone: ${payerPhone || 'N/A'}, TxID: ${trId || 'N/A'}, Amount: UGX ${amount}`);

    // ── Primary Match: BY SENDER PHONE NUMBER ────────────────────────────────
    let request = null;

    if (payerPhone) {
      request = await db.prepare(
        `SELECT * FROM payment_requests 
         WHERE (phone_number LIKE ? OR phone_number = ? OR phone_number = ?) 
           AND status = 'pending' 
         ORDER BY created_at DESC LIMIT 1`
      ).bind(`%${payerPhone}`, payerPhone, `256${payerPhone}`).first();
    }

    // ── Secondary Match: BY TRANSACTION ID (fallback if phone not found) ─────
    if (!request && trId) {
      request = await db.prepare(
        `SELECT * FROM payment_requests WHERE transaction_id = ? AND status = 'pending' LIMIT 1`
      ).bind(trId).first();
    }

    if (request) {
      console.log(`[Webhook] ✅ MATCH! Auto-verifying request for ${request.phone_number} (${request.tier})`);

      const today = new Date().toISOString().slice(0, 10);

      // Mark SMS log as matched
      if (logId) {
        await db.prepare(`UPDATE sms_logs SET status = 'matched' WHERE id = ?`).bind(logId).run();
      }

      // Verify the payment request and attach transaction ID if captured
      if (trId) {
        await db.prepare(`UPDATE payment_requests SET status = 'verified', transaction_id = ? WHERE id = ?`).bind(trId, request.id).run();
      } else {
        await db.prepare(`UPDATE payment_requests SET status = 'verified' WHERE id = ?`).bind(request.id).run();
      }

      // Unlock the ticket for the customer (match by phone)
      await db.prepare(
        `INSERT OR IGNORE INTO unlocked_tickets (phone_number, tier, date) VALUES (?, ?, ?)`
      ).bind(request.phone_number, request.tier, today).run();

      return NextResponse.json({
        success: true,
        message: `Ticket unlocked for ${request.phone_number}`,
        payerPhone,
        trId,
        amount,
        tier: request.tier
      });
    }

    // No pending request yet — SMS is logged as processing.
    // When the customer clicks 'Confirm I Have Paid' on the site, it will match immediately!
    return NextResponse.json({
      success: true,
      message: "SMS logged. Pending customer submission on website.",
      payerPhone,
      trId,
      amount
    });

  } catch (err) {
    console.error("[Webhook Error]:", err);
    return NextResponse.json({ error: "Internal Server Error", details: err.message }, { status: 500 });
  }
}

// ── Debugging Help: Visit this URL in your browser to see if the table is working
export async function GET(req) {
  try {
    const db = await getD1();

    await db.prepare(
      `INSERT INTO sms_logs (content, sender, status) VALUES (?, ?, ?)`
    ).bind('Diagnostic Test', 'SYSTEM', 'ignored').run();

    const { results: logs } = await db.prepare(
      `SELECT * FROM sms_logs ORDER BY created_at DESC LIMIT 10`
    ).all();

    return NextResponse.json({ 
      status: "Webhook is reachable", 
      insert_test: "SUCCESS",
      table_status: "SUCCESS",
      recent_logs: logs || []
    });
  } catch (err) {
    return NextResponse.json({ status: "Error", details: err.message });
  }
}
