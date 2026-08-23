-- 0001_clicks.sql
-- Link-click tracking tables for the Swansea Esports website.
-- One row per click event, bucketed by UTC day for per-day reports.
CREATE TABLE IF NOT EXISTS clicks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  label TEXT NOT NULL,             -- data-track label or derived label
  href TEXT NOT NULL DEFAULT '',   -- full href clicked
  page TEXT NOT NULL DEFAULT '',   -- page path where the click happened
  day TEXT NOT NULL,               -- UTC date bucket YYYY-MM-DD
  ts INTEGER NOT NULL              -- epoch ms
);
-- Composite index serves the analytics GROUP BY (day, label, href, page).
CREATE INDEX IF NOT EXISTS idx_clicks_day_label ON clicks(day, label, href, page);

-- Privacy-light per-IP daily write counter (HMAC'd IP hash, 2000/day cap).
CREATE TABLE IF NOT EXISTS track_ip_day (
  ip_hash TEXT NOT NULL,
  day TEXT NOT NULL,
  n INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (ip_hash, day)
);
