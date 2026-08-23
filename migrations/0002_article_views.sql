-- 0002_article_views.sql
-- Per-article view tracking: one row per page view, classified bot vs human
-- by user-agent at write time (isBot from _lib/clicks.js).
CREATE TABLE IF NOT EXISTS article_views (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  type TEXT NOT NULL,              -- news | events
  slug TEXT NOT NULL,
  ts INTEGER NOT NULL,             -- epoch ms
  is_bot INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_article_views_key ON article_views(type, slug, ts);
