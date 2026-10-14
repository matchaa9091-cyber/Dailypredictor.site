/**
 * BetPawa Smart Text & Slip Parser
 * Intelligently extracts match details, odds, picks, markets, and booking codes
 * from BetPawa betslips, share messages, or raw match lists.
 */

// Common league to flag emoji mapping
const LEAGUE_FLAGS = {
  "premier league": "🏴󠁧󠁢󠁥󠁮󠁧󠁿",
  "championship": "🏴󠁧󠁢󠁥󠁮󠁧󠁿",
  "fa cup": "🏴󠁧󠁢󠁥󠁮󠁧󠁿",
  "la liga": "🇪🇸",
  "copa del rey": "🇪🇸",
  "serie a": "🇮🇹",
  "coppa italia": "🇮🇹",
  "bundesliga": "🇩🇪",
  "dfb pokal": "🇩🇪",
  "ligue 1": "🇫🇷",
  "champions league": "🏆",
  "europa league": "🏆",
  "conference league": "🏆",
  "world cup": "🌍",
  "afcon": "🌍",
  "nations league": "🌍",
  "eredivisie": "🇳🇱",
  "primeira liga": "🇵🇹",
  "super lig": "🇹🇷",
  "mls": "🇺🇸",
  "saudi": "🇸🇦",
  "uganda": "🇺🇬",
  "kenya": "🇰🇪",
  "tanzania": "🇹🇿",
  "nigeria": "🇳🇬",
  "ghana": "🇬🇭",
  "zambia": "🇿🇲",
};

export function getLeagueFlag(leagueName) {
  if (!leagueName) return "⚽";
  const lower = leagueName.toLowerCase();
  for (const [key, flag] of Object.entries(LEAGUE_FLAGS)) {
    if (lower.includes(key)) return flag;
  }
  return "⚽";
}

/**
 * Extracts booking code from text if present
 */
export function extractBookingCode(text) {
  if (!text) return "";
  // Look for "Booking code: ABC123", "Code: ABC123", "bookingCode=ABC123"
  const patterns = [
    /(?:booking\s*code|share\s*code|code)\s*[:=]\s*([a-zA-Z0-9]{4,10})/i,
    /bookingCode=([a-zA-Z0-9]{4,10})/i,
    /#([a-zA-Z0-9]{5,8})\b/,
  ];

  for (const pat of patterns) {
    const m = text.match(pat);
    if (m && m[1]) return m[1].toUpperCase();
  }
  return "";
}

/**
 * Parses raw BetPawa text into an array of match objects compatible with blankMatch()
 */
export function parseBetPawaText(rawText) {
  if (!rawText || typeof rawText !== "string") {
    return { matches: [], bookingCode: "" };
  }

  const bookingCode = extractBookingCode(rawText);
  const matches = [];

  // Clean lines
  const lines = rawText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  // Strategy 1: Check for numbered matches (e.g. "1. Arsenal vs Chelsea", "2. Real Madrid vs Barcelona")
  const numberedBlocks = [];
  let currentBlock = [];

  for (const line of lines) {
    // Skip greeting or booking code lines
    if (
      line.match(/^(?:booking\s*code|check\s*out|this\s*is\s*my|bet\s*id)/i) ||
      line.match(/^https?:\/\//i)
    ) {
      continue;
    }

    if (line.match(/^(\d+)[\.\)\-]\s+/)) {
      if (currentBlock.length > 0) {
        numberedBlocks.push(currentBlock);
      }
      currentBlock = [line];
    } else if (currentBlock.length > 0) {
      currentBlock.push(line);
    } else {
      currentBlock.push(line);
    }
  }
  if (currentBlock.length > 0) {
    numberedBlocks.push(currentBlock);
  }

  // If numbered blocks were found and split properly
  if (numberedBlocks.length > 1 || (numberedBlocks.length === 1 && numberedBlocks[0][0].match(/^(\d+)[\.\)\-]\s+/))) {
    for (const block of numberedBlocks) {
      const match = parseMatchBlock(block);
      if (match) matches.push(match);
    }
  } else {
    // Strategy 2: Line by line / vs pattern parsing
    let i = 0;
    while (i < lines.length) {
      const line = lines[i];

      // Check if line contains "vs", " v ", or " - " indicating two teams
      const vsMatch = line.match(/(.+?)(?:\s+vs\.?\s+|\s+v\s+|\s+-\s+)(.+)/i);
      if (vsMatch && !line.toLowerCase().startsWith("booking")) {
        const block = [line];
        // Peek next 1-3 lines for market, pick, odds, league
        let j = i + 1;
        while (j < lines.length && j <= i + 4) {
          const nextLine = lines[j];
          if (nextLine.match(/(.+?)(?:\s+vs\.?\s+|\s+v\s+|\s+-\s+)(.+)/i) && !nextLine.match(/^(1x2|over|under|both|odd)/i)) {
            break; // next match starts
          }
          block.push(nextLine);
          j++;
        }
        const m = parseMatchBlock(block);
        if (m) matches.push(m);
        i = j - 1;
      }
      i++;
    }
  }

  return { matches, bookingCode };
}

/**
 * Parses a block of lines representing a single match
 */
function parseMatchBlock(lines) {
  if (!lines || lines.length === 0) return null;

  const fullText = lines.join(" ");

  // Default match object
  let h = "";
  let a = "";
  let lg = "";
  let mkt = "Match Result";
  let pick = "";
  let odds = 1.8;
  let kickoff = new Date().toISOString();

  // 1. Detect Teams from first line or block
  const firstLine = lines[0].replace(/^(\d+)[\.\)\-]\s+/, "").trim();
  const vsMatch = firstLine.match(/(.+?)(?:\s+vs\.?\s+|\s+v\s+|\s+-\s+)(.+)/i);

  if (vsMatch) {
    h = cleanTeamName(vsMatch[1]);
    a = cleanTeamName(vsMatch[2]);
  } else if (lines.length >= 2 && !lines[0].includes(":") && !lines[1].includes(":")) {
    h = cleanTeamName(lines[0]);
    a = cleanTeamName(lines[1]);
  }

  // If no teams found, cannot be a valid match
  if (!h || !a) return null;

  // 2. Detect Odds (prioritize parenthesis like (1.65), @ 1.85, odds: 1.85)
  let oddsMatch = fullText.match(/\(([1-9]\d{0,1}\.\d{1,3})\)/);
  if (!oddsMatch) {
    oddsMatch = fullText.match(/(?:@|\bodds\b\s*[:=]?)\s*([1-9]\d{0,1}\.\d{1,3})/i);
  }
  if (!oddsMatch) {
    // Strip out Over/Under numbers before matching standalone float
    const textWithoutLines = fullText.replace(/(?:over|under)\s*[0-9]\.[0-9]/gi, "");
    oddsMatch = textWithoutLines.match(/([1-9]\d{0,1}\.\d{2,3})/);
  }
  if (oddsMatch) {
    const val = parseFloat(oddsMatch[1]);
    if (!isNaN(val) && val >= 1.01 && val <= 100) {
      odds = val;
    }
  }

  // 3. Detect Market & Pick
  if (fullText.match(/over\s*2\.5/i)) {
    mkt = "Over/Under 2.5";
    pick = "Over 2.5";
  } else if (fullText.match(/under\s*2\.5/i)) {
    mkt = "Over/Under 2.5";
    pick = "Under 2.5";
  } else if (fullText.match(/over\s*1\.5/i)) {
    mkt = "Over/Under 1.5";
    pick = "Over 1.5";
  } else if (fullText.match(/under\s*1\.5/i)) {
    mkt = "Over/Under 1.5";
    pick = "Under 1.5";
  } else if (fullText.match(/(?:gg|both teams to score|btts|yes)/i) && fullText.includes("yes")) {
    mkt = "Both Teams to Score";
    pick = "Yes (GG)";
  } else if (fullText.match(/(?:ng|both teams to score|btts|no)/i) && fullText.includes("no")) {
    mkt = "Both Teams to Score";
    pick = "No (NG)";
  } else if (fullText.match(/\b1x\b/i)) {
    mkt = "Double Chance";
    pick = "1X";
  } else if (fullText.match(/\bx2\b/i)) {
    mkt = "Double Chance";
    pick = "X2";
  } else if (fullText.match(/\b12\b/)) {
    mkt = "Double Chance";
    pick = "12";
  } else if (fullText.match(/\bpick\s*:\s*1\b|\bhome\s*win\b/i)) {
    mkt = "Match Result";
    pick = `${h} Win (1)`;
  } else if (fullText.match(/\bpick\s*:\s*2\b|\baway\s*win\b/i)) {
    mkt = "Match Result";
    pick = `${a} Win (2)`;
  } else if (fullText.match(/\bpick\s*:\s*x\b|\bdraw\b/i)) {
    mkt = "Match Result";
    pick = "Draw (X)";
  } else {
    // Generic pick extraction
    const pickMatch = fullText.match(/(?:pick|selection|tip)\s*[:=]\s*([^\(\n,]+)/i);
    if (pickMatch) {
      pick = pickMatch[1].trim();
    } else {
      pick = `${h} Win`;
    }
  }

  // 4. Detect League
  const leagues = [
    "Premier League", "La Liga", "Serie A", "Bundesliga", "Ligue 1",
    "Champions League", "Europa League", "Conference League",
    "Championship", "Eredivisie", "Primeira Liga", "MLS", "Saudi Pro League"
  ];
  for (const l of leagues) {
    if (fullText.toLowerCase().includes(l.toLowerCase())) {
      lg = l;
      break;
    }
  }

  // 5. Detect Kickoff Date/Time
  const dateMatch = fullText.match(/(\d{4}-\d{2}-\d{2}(?:T|\s+)\d{2}:\d{2})|(\d{1,2}\/\d{1,2}\/\d{4}\s+\d{2}:\d{2})/);
  if (dateMatch) {
    const parsedDate = new Date(dateMatch[0].replace(" ", "T"));
    if (!isNaN(parsedDate.getTime())) {
      kickoff = parsedDate.toISOString();
    }
  }

  return {
    h,
    a,
    lg: lg || "Football",
    fl: getLeagueFlag(lg),
    mkt,
    pick,
    odds: Number(odds) || 1.8,
    conf: 90,
    analysis: "",
    hot: false,
    kickoff,
  };
}

function cleanTeamName(name) {
  if (!name) return "";
  return name
    .replace(/^(\d+)[\.\)\-]\s+/, "")
    .replace(/\s*\(.*?\)/g, "")
    .replace(/(?:pick|odds|@|1x2|over|under|ft|ht|kickoff|time|date).*/i, "")
    .trim();
}

/**
 * Transforms native BetPawa API item to internal match object
 */
export function transformBetPawaApiItem(item) {
  const event = item.eventInfo || {};
  const participants = event.participants || [];
  const home = participants.find((p) => p.position === 1)?.name || participants[0]?.name || "Home";
  const away = participants.find((p) => p.position === 2)?.name || participants[1]?.name || "Away";
  const league = event.competition?.name || "Football";
  const kickoff = event.startTime || new Date().toISOString();

  const selection = item.selections?.[0] || {};
  const market = selection.market || {};
  const selectionInfo = selection.selectionInfo || {};

  let mkt = market.displayName || market.name || "Match Result";
  mkt = mkt.replace("{home}", home).replace("{away}", away);

  let pick = selectionInfo.name || "1";
  if (selectionInfo.handicap) {
    pick = `${selectionInfo.name} ${selectionInfo.handicap}`;
  }
  if (market.displayName && market.displayName.includes("{home}")) {
    pick = `${home} ${pick}`;
  } else if (market.displayName && market.displayName.includes("{away}")) {
    pick = `${away} ${pick}`;
  }

  const odds = Number(item.odds?.price) || 1.8;

  return {
    h: home,
    a: away,
    lg: league,
    fl: getLeagueFlag(league),
    mkt,
    pick,
    odds,
    conf: 90,
    analysis: "",
    hot: false,
    kickoff,
  };
}

