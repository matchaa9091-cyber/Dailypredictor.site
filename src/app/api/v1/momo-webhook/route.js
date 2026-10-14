import { NextResponse } from 'next/server';
import { getD1 } from '../../../../lib/d1';

export const runtime = 'edge';

// Secret key used to verify requests coming from httpsms.com webhook
// Set this in your httpsms.com webhook headers as: X-Api-Key: Danvid_API_Key_256
const SECRET_WEBHOOK_KEY = "Danvid_API_Key_256";

export async function POST(req) {
  try {
    const db = getD1();

    // ── Security: check header or query key ──────────────────────
    const { searchParams } = new URL(req.url);
    const queryKey = searchParams.get('key');
    const headerKey = req.headers.get('x-api-key') || req.headers.get('authorization');
    
    if (headerKey !== SECRET_WEBHOOK_KEY && queryKey !== SECRET_WEBHOOK_KEY) {
      console.warn("[Webhook] ⛔ Unauthorized attempt blocked");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();

    // ── Parse httpsms.com payload format ────────────────────────────────────
    // httpsms.com sends: { event_type, data: { content, from, to, ... } }
    let content = "";
    let sender = "";

    if (body?.data?.content) {
      // httpsms.com format
      content = body.data.content;
      sender = body.data.from || body.data.contact || "MTN/AIRTEL";
    } else if (body?.content) {
      // Direct/manual format (for testing)
      content = body.content;
      sender = body.sender || "UNKNOWN";
    }

    if (!content) {
      return NextResponse.json({ error: "No SMS content found in payload" }, { status: 400 });
    }

    console.log(`[Webhook] 📩 SMS from ${sender}: ${content.substring(0, 80)}...`);

    // ── RegEx: Extract Transaction ID ────────────────────────────────────────
    // MTN MoMo format:  "...Trans. ID: 12345678901..."
    // Airtel format:    "...Ref: ABCD12345..." or "...ID: 40266720157..."
    const idMatch = content.match(
      /(?:Trans(?:action)?\.?\s*ID|Ref(?:erence)?|TxID|Receipt|\bID\b)[:\s]+([0-9]{4,25})/i
    );
    const trId = idMatch ? idMatch[1].trim().toUpperCase() : null;

    // ── RegEx: Extract Amount ────────────────────────────────────────────────
    const amountMatch = content.match(/(?:UGX|SHS?)\.?\s*([\d,]+)|([\d,]+)\s*(?:UGX|SHS?)/i);
    const amountStr = amountMatch ? (amountMatch[1] || amountMatch[2]) : null;
    const amount = amountStr ? parseInt(amountStr.replace(/,/g, '')) : null;

    // ── Log the SMS to database ──────────────────────────────────────────────
    const isAmountValid = amount === null || amount >= 1000;
    const initialStatus = (trId && isAmountValid) ? 'processing' : 'ignored';

    const insertLogRes = await db.prepare(
      `INSERT INTO sms_logs (content, sender, status) VALUES (?, ?, ?)`
    ).bind(content, sender, initialStatus).run();

    const logId = insertLogRes?.meta?.last_row_id;

    if (!trId) {
      console.log("[Webhook] No Transaction ID found — SMS logged as ignored.");
      return NextResponse.json({ message: "SMS logged. No Transaction ID detected.", amount });
    }

    if (!isAmountValid) {
      console.log(`[Webhook] ⛔ Payment rejected: Low amount (UGX ${amount}). Minimum is 1000.`);
      if (logId) {
        await db.prepare(`UPDATE sms_logs SET status = 'ignored' WHERE id = ?`).bind(logId).run();
      }
      return NextResponse.json({ message: "Payment too low. Minimum 1000 required.", amount });
    }

    console.log(`[Webhook] 🔍 Found Transaction ID: ${trId}, Amount: UGX ${amount}`);

    // ── Match against pending payment requests ───────────────────────────────
    const request = await db.prepare(
      `SELECT * FROM payment_requests WHERE transaction_id = ? AND status = 'pending' LIMIT 1`
    ).bind(trId).first();

    if (request) {
      console.log(`[Webhook] ✅ MATCH! Auto-verifying request for ${request.phone_number} (${request.tier})`);

      const today = new Date().toISOString().slice(0, 10);

      // Mark SMS log as matched
      if (logId) {
        await db.prepare(`UPDATE sms_logs SET status = 'matched' WHERE id = ?`).bind(logId).run();
      }

      // Verify the payment request
      await db.prepare(`UPDATE payment_requests SET status = 'verified' WHERE id = ?`).bind(request.id).run();

      // Unlock the ticket for the customer
      await db.prepare(
        `INSERT OR IGNORE INTO unlocked_tickets (phone_number, tier, date) VALUES (?, ?, ?)`
      ).bind(request.phone_number, request.tier, today).run();

      return NextResponse.json({
        success: true,
        message: `Ticket unlocked for ${request.phone_number}`,
        trId,
        amount,
        tier: request.tier
      });
    }

    // No match yet — SMS is stored, will match when user submits their TX ID
    return NextResponse.json({
      success: true,
      message: "SMS logged. No matching pending request found for this Transaction ID.",
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
    const db = getD1();

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
