-- D1 Database Schema for Daily Predictor

CREATE TABLE IF NOT EXISTS daily_accums (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tier TEXT NOT NULL,
  total_odds REAL NOT NULL,
  date TEXT NOT NULL,
  first_kickoff TEXT NOT NULL,
  booking_code TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS match_details (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  accum_id INTEGER NOT NULL REFERENCES daily_accums(id) ON DELETE CASCADE,
  home_team TEXT NOT NULL,
  away_team TEXT NOT NULL,
  league TEXT,
  flag TEXT,
  kickoff TEXT NOT NULL,
  market TEXT NOT NULL,
  pick TEXT NOT NULL,
  odds REAL NOT NULL,
  confidence REAL,
  analysis TEXT,
  is_hot INTEGER DEFAULT 0,
  image_url TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS payment_requests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  phone_number TEXT NOT NULL,
  method TEXT NOT NULL,
  tier TEXT NOT NULL,
  amount INTEGER NOT NULL,
  transaction_id TEXT,
  receipt_url TEXT,
  status TEXT DEFAULT 'pending',
  device_id TEXT,
  date TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS unlocked_tickets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  phone_number TEXT NOT NULL,
  tier TEXT NOT NULL,
  date TEXT NOT NULL,
  device_id TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  UNIQUE(phone_number, tier, date)
);

CREATE TABLE IF NOT EXISTS sms_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  content TEXT NOT NULL,
  sender TEXT,
  status TEXT DEFAULT 'ignored',
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS performance_results (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tier TEXT NOT NULL,
  status TEXT NOT NULL,
  odds REAL,
  created_at TEXT DEFAULT (datetime('now'))
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_daily_accums_tier_date ON daily_accums(tier, date);
CREATE INDEX IF NOT EXISTS idx_match_details_accum_id ON match_details(accum_id);
CREATE INDEX IF NOT EXISTS idx_payment_requests_tx ON payment_requests(transaction_id);
CREATE INDEX IF NOT EXISTS idx_unlocked_tickets_lookup ON unlocked_tickets(phone_number, date);
