import { NextResponse } from "next/server";
import { parseBetPawaText } from "@/lib/betpawa-parser";

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code")?.trim().toUpperCase();

  if (!code) {
    return NextResponse.json({ error: "Missing booking code parameter" }, { status: 400 });
  }

  try {
    // If an external betting converter API is configured in environment variables
    const converterApiUrl = process.env.BETPAWA_CONVERTER_API_URL;
    const converterApiKey = process.env.BETPAWA_CONVERTER_API_KEY;

    if (converterApiUrl) {
      const res = await fetch(`${converterApiUrl}?code=${encodeURIComponent(code)}`, {
        headers: {
          "Authorization": converterApiKey ? `Bearer ${converterApiKey}` : "",
          "Accept": "application/json",
        },
      });

      if (res.ok) {
        const data = await res.json();
        if (data.matches && data.matches.length > 0) {
          return NextResponse.json({
            success: true,
            source: "converter_api",
            bookingCode: code,
            matches: data.matches,
          });
        }
      }
    }

    // Direct BetPawa online lookup
    // Because BetPawa protects its proprietary endpoints behind Cloudflare WAF,
    // we notify the client to use the smart text paste importer or manual input.
    return NextResponse.json({
      success: false,
      bookingCode: code,
      error: "BetPawa requires interactive session verification for direct code lookup.",
      suggestion: "Please use the '📋 Paste BetPawa Slip / Text' option to auto-fill all matches instantly from your copied BetPawa betslip or share message.",
    });
  } catch (err) {
    console.error("BetPawa lookup error:", err);
    return NextResponse.json(
      { error: "Internal server error during BetPawa lookup", details: err.message },
      { status: 500 }
    );
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const { text, code } = body;

    if (text) {
      const result = parseBetPawaText(text);
      return NextResponse.json({
        success: result.matches.length > 0,
        bookingCode: result.bookingCode || code || "",
        matches: result.matches,
        count: result.matches.length,
      });
    }

    if (code) {
      return NextResponse.json({
        success: false,
        bookingCode: code,
        message: "Direct code lookup needs slip text or external converter API.",
      });
    }

    return NextResponse.json({ error: "No text or code provided" }, { status: 400 });
  } catch (err) {
    console.error("BetPawa POST parse error:", err);
    return NextResponse.json(
      { error: "Failed to parse BetPawa input", details: err.message },
      { status: 500 }
    );
  }
}
