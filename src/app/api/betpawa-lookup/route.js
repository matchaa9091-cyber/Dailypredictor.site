import { NextResponse } from "next/server";
import { parseBetPawaText, transformBetPawaApiItem } from "@/lib/betpawa-parser";

const BRANDS = [
  "betpawa-uganda",
  "betpawa-kenya",
  "betpawa-tanzania",
  "betpawa-rwanda",
  "betpawa-ghana",
  "betpawa-nigeria",
  "betpawa-zambia",
];

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code")?.trim().toUpperCase();

  if (!code) {
    return NextResponse.json({ error: "Missing booking code parameter" }, { status: 400 });
  }

  try {
    // 1. Live BetPawa internal API query using discovered native headers
    for (const brand of BRANDS) {
      try {
        const domain =
          brand === "betpawa-kenya"
            ? "www.betpawa.co.ke"
            : brand === "betpawa-tanzania"
            ? "www.betpawa.co.tz"
            : brand === "betpawa-rwanda"
            ? "www.betpawa.rw"
            : brand === "betpawa-ghana"
            ? "www.betpawa.com.gh"
            : brand === "betpawa-nigeria"
            ? "www.betpawa.ng"
            : brand === "betpawa-zambia"
            ? "www.betpawa.co.zm"
            : "www.betpawa.ug";

        const res = await fetch(
          `https://${domain}/api/sportsbook/v3/booking-number/${encodeURIComponent(code)}`,
          {
            headers: {
              "User-Agent":
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
              "Accept": "application/json, text/plain, */*",
              "X-Pawa-Brand": brand,
              "X-Pawa-Language": "en",
              "Referer": `https://${domain}/`,
            },
          }
        );

        if (res.ok) {
          const data = await res.json();
          if (data.items && data.items.length > 0) {
            const matches = data.items.map(transformBetPawaApiItem);
            return NextResponse.json({
              success: true,
              source: `betpawa_live (${brand})`,
              bookingCode: code,
              matches,
              count: matches.length,
            });
          }
        }
      } catch (subErr) {
        // Continue to fallback brand
      }
    }

    // 2. Fallback to external converter API if configured
    const converterApiUrl = process.env.BETPAWA_CONVERTER_API_URL;
    const converterApiKey = process.env.BETPAWA_CONVERTER_API_KEY;

    if (converterApiUrl) {
      const res = await fetch(`${converterApiUrl}?code=${encodeURIComponent(code)}`, {
        headers: {
          Authorization: converterApiKey ? `Bearer ${converterApiKey}` : "",
          Accept: "application/json",
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

    return NextResponse.json({
      success: false,
      bookingCode: code,
      error: `Could not find booking code "${code}" on BetPawa. It may have expired or belongs to an unlisted market.`,
      suggestion:
        "You can also use '📋 Paste Slip / Text' to paste the matches directly from BetPawa.",
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
