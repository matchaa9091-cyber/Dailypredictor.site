import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

// SECRET KEY for the phone app to authenticate
const SECRET_WEBHOOK_KEY = "Danvid_API_Key_256";

export async function POST(req) {
  try {
    const body = await req.json();
    const { sender, content, key } = body;

    // 1. Security Check
    if (key !== SECRET_WEBHOOK_KEY) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!content || !sender) {
      return NextResponse.json({ error: "Missing data" }, { status: 400 });
    }

    console.log(`[Webhook] 📩 SMS Received from ${sender}: ${content}`);

    // 2. Parse SMS for Transaction ID and Amount
    // Regex for MTN/Airtel Transaction IDs (Usually 10-12 chars, letters and numbers)
    // Examples: "Trans. ID: 12345678" or "ID: XYZ123"
    const idMatch = content.match(/(ID|Trans\. ID|Transaction ID|Ref)[:\s]+([A-Z0-9]+)/i);
    const trId = idMatch ? idMatch[2].trim() : null;

    // Regex for Amount: "UGX 1,000" or "UGX1000"
    const amountMatch = content.match(/UGX\s*([\d,]+)/i);
    const amount = amountMatch ? parseInt(amountMatch[1].replace(/,/g, '')) : null;

    // 3. Save to Logs
    const { data: logData, error: logError } = await supabase
      .from('sms_logs')
      .insert({
        content,
        sender,
        status: trId ? 'processing' : 'ignored'
      })
      .select()
      .single();

    if (logError) throw logError;

    if (!trId) {
      return NextResponse.json({ message: "No Transaction ID found in SMS", trId, amount });
    }

    // 4. Match with Payment Requests
    // We look for a pending request with this Transaction ID
    const { data: request, error: reqError } = await supabase
      .from('payment_requests')
      .select('*')
      .eq('transaction_id', trId)
      .eq('status', 'pending')
      .maybeSingle();

    if (reqError) {
      console.error("[Webhook] Matching error:", reqError);
    }

    if (request) {
      console.log(`[Webhook] ✅ Match Found! Request #${request.id}`);

      // 5. Update Statuses
      // Mark SMS as matched (ignore errors if column doesn't exist yet)
      try {
        await supabase.from('sms_logs').update({ 
          status: 'matched'
        }).eq('id', logData.id);
      } catch (e) {}

      // Verify the payment
      const today = new Date().toISOString().slice(0, 10);
      
      // Update request status
      await supabase.from('payment_requests').update({ 
        status: 'verified'
      }).eq('id', request.id);

      // Create the unlock entry
      await supabase.from('unlocked_tickets').insert({
        phone_number: request.phone_number,
        tier: request.tier,
        date: today
      });

      return NextResponse.json({ 
        success: true, 
        message: "Payment automatically verified and ticket unlocked!",
        trId,
        amount
      });
    }

    return NextResponse.json({ 
      success: true, 
      message: "SMS logged but no matching pending request found yet.",
      trId,
      amount
    });

  } catch (err) {
    console.error("[Webhook Error]:", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
