import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

// Secret key used to verify requests coming from httpsms.com webhook
// Set this in your httpsms.com webhook headers as: X-Api-Key: Danvid_API_Key_256
const SECRET_WEBHOOK_KEY = "Danvid_API_Key_256";

export async function POST(req) {
  try {
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
      /(?:Trans(?:action)?\.?\s*ID|Ref(?:erence)?|TxID|\bID\b)[:\s]+([A-Z0-9]{6,15})/i
    );
    const trId = idMatch ? idMatch[1].trim() : null;

    // ── RegEx: Extract Amount ────────────────────────────────────────────────
    const amountMatch = content.match(/UGX\s*([\d,]+)/i);
    const amount = amountMatch ? parseInt(amountMatch[1].replace(/,/g, '')) : null;

    // ── Log the SMS to database ──────────────────────────────────────────────
    const { data: logData, error: logError } = await supabase
      .from('sms_logs')
      .insert({
        content,
        sender,
        status: trId ? 'processing' : 'ignored'
      })
      .select()
      .single();

    if (logError) {
      console.error("[Webhook] Log insert error:", logError);
      // Don't throw — still try to match
    }

    if (!trId) {
      console.log("[Webhook] No Transaction ID found — SMS logged as ignored.");
      return NextResponse.json({ message: "SMS logged. No Transaction ID detected.", amount });
    }

    console.log(`[Webhook] 🔍 Found Transaction ID: ${trId}, Amount: UGX ${amount}`);

    // ── Match against pending payment requests ───────────────────────────────
    const { data: request, error: reqError } = await supabase
      .from('payment_requests')
      .select('*')
      .eq('transaction_id', trId)
      .eq('status', 'pending')
      .maybeSingle();

    if (reqError) {
      console.error("[Webhook] DB match error:", reqError);
    }

    if (request) {
      console.log(`[Webhook] ✅ MATCH! Auto-verifying request for ${request.phone_number} (${request.tier})`);

      const today = new Date().toISOString().slice(0, 10);

      // Mark SMS log as matched
      if (logData?.id) {
        await supabase.from('sms_logs').update({ status: 'matched' }).eq('id', logData.id);
      }

      // Verify the payment request
      await supabase.from('payment_requests')
        .update({ status: 'verified' })
        .eq('id', request.id);

      // Unlock the ticket for the customer
      await supabase.from('unlocked_tickets').insert({
        phone_number: request.phone_number,
        tier: request.tier,
        date: today
      });

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
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
