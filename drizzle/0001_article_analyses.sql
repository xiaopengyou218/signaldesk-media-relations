CREATE TABLE IF NOT EXISTS article_analyses (
  id TEXT PRIMARY KEY,
  article_id TEXT NOT NULL,
  connection_id TEXT NOT NULL,
  focus TEXT NOT NULL,
  relevance TEXT NOT NULL,
  x_angle TEXT NOT NULL,
  avoid TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (article_id) REFERENCES articles(id),
  FOREIGN KEY (connection_id) REFERENCES model_connections(id)
);

CREATE INDEX IF NOT EXISTS idx_article_analyses_article_created
ON article_analyses(article_id, created_at);
