CREATE TABLE IF NOT EXISTS source_sync_runs (
  id TEXT PRIMARY KEY,
  started_at TEXT NOT NULL,
  completed_at TEXT NOT NULL,
  status TEXT NOT NULL,
  source_count INTEGER NOT NULL DEFAULT 0,
  discovered_count INTEGER NOT NULL DEFAULT 0,
  inserted_count INTEGER NOT NULL DEFAULT 0,
  ai_status TEXT NOT NULL DEFAULT '未运行',
  error_summary TEXT
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_articles_url_unique
ON articles(url);

CREATE INDEX IF NOT EXISTS idx_source_sync_runs_completed
ON source_sync_runs(completed_at);

PRAGMA optimize;
