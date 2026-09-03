import { env } from "cloudflare:workers";
import { schemaStatements } from "./schema";
import { articleSeeds, editorExpansionSeeds, editorSeeds, existingEditorActivityUpdates, opportunitySeeds } from "./seed";
import type { AppState, Article, ArticleAnalysis, ArticleRefresh, Editor, Interaction, ModelConnection, Opportunity } from "@/lib/types";
import type { CollectedArticle } from "@/lib/collection/feeds";

type Statement = {
  bind(...values: unknown[]): Statement;
  run(): Promise<unknown>;
  all<T>(): Promise<{ results: T[] }>;
  first<T>(): Promise<T | null>;
};

type Database = {
  prepare(query: string): Statement;
  batch(statements: Statement[]): Promise<unknown>;
};

function getDatabase(): Database {
  const database = (env as unknown as { DB?: Database }).DB;
  if (!database) throw new Error("数据库绑定尚未配置");
  return database;
}

async function ensureEditorActivityColumns(db: Database) {
  const columns = await db.prepare("PRAGMA table_info(editors)").all<{ name: string }>();
  const existing = new Set(columns.results.map((column) => column.name));
  const additions = [
    ["x_activity_status", "ALTER TABLE editors ADD COLUMN x_activity_status TEXT NOT NULL DEFAULT '待核验'"],
    ["x_last_observed_at", "ALTER TABLE editors ADD COLUMN x_last_observed_at TEXT"],
    ["x_activity_note", "ALTER TABLE editors ADD COLUMN x_activity_note TEXT"],
    ["x_verified_at", "ALTER TABLE editors ADD COLUMN x_verified_at TEXT"],
  ] as const;
  for (const [name, sql] of additions) {
    if (!existing.has(name)) await db.prepare(sql).run();
  }
  await db.prepare("CREATE INDEX IF NOT EXISTS idx_editors_x_activity_priority ON editors(x_activity_status,priority)").run();
}

export async function ensureDatabase() {
  const db = getDatabase();
  await db.batch(schemaStatements.map((sql) => db.prepare(sql)));
  await ensureEditorActivityColumns(db);
  const count = await db.prepare("SELECT COUNT(*) AS total FROM editors").first<{ total: number }>();
  if ((count?.total ?? 0) === 0) {
    await db.batch(editorSeeds.map((row) => db.prepare(
      "INSERT INTO editors (id,name,media,role,topics,x_url,stage,priority,last_article_date) VALUES (?,?,?,?,?,?,?,?,?)",
    ).bind(...row)));
    await db.batch(articleSeeds.map((row) => db.prepare(
      "INSERT INTO articles (id,editor_id,title,url,published_at,summary,topics,source) VALUES (?,?,?,?,?,?,?,?)",
    ).bind(...row)));
    await db.batch(opportunitySeeds.map((row) => db.prepare(
      "INSERT INTO opportunities (id,editor_id,article_id,priority,suggested_angle,due_date,x_post_status,status) VALUES (?,?,?,?,?,?,?,?)",
    ).bind(...row)));
    await db.prepare(
      "INSERT INTO model_connections (id,label,provider,model,status,is_default) VALUES (?,?,?,?,?,?)",
    ).bind("demo", "内置演示模式", "demo", "规则引擎", "可用", 1).run();
  }
  await db.batch(editorExpansionSeeds.map((row) => db.prepare(`INSERT OR IGNORE INTO editors
    (id,name,media,role,topics,x_url,stage,priority,last_article_date,x_activity_status,x_last_observed_at,x_activity_note,x_verified_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`).bind(...row)));
  await db.batch(existingEditorActivityUpdates.map(([id, status, observedAt, note]) => db.prepare(`UPDATE editors SET
    x_activity_status=?, x_last_observed_at=?, x_activity_note=?, x_verified_at='2026-09-01',
    updated_at=CURRENT_TIMESTAMP WHERE id=?`).bind(status, observedAt, note, id)));
  const lowActivityIds = existingEditorActivityUpdates
    .filter(([, status]) => status === "低活跃")
    .map(([id]) => id);
  await db.batch(lowActivityIds.map((id) => db.prepare(`UPDATE editors SET priority='常规', updated_at=CURRENT_TIMESTAMP
    WHERE id=? AND stage='观察中'
    AND NOT EXISTS (SELECT 1 FROM interactions i WHERE i.editor_id=editors.id)`).bind(id)));
  await db.prepare(`INSERT OR IGNORE INTO model_connections
    (id,label,provider,model,base_url,status,is_default)
    VALUES (?,?,?,?,?,?,?)`).bind(
      "minimax-local-preset", "MiniMax 本地分析", "minimax", "MiniMax-M2.7",
      "https://api.minimaxi.com/v1", "本地预设", 0,
    ).run();
  await db.prepare("PRAGMA optimize").run();
}

export async function getAppState(): Promise<AppState> {
  await ensureDatabase();
  const db = getDatabase();
  const [editors, articles, opportunities, interactions, modelConnections, analyses, refresh] = await Promise.all([
    db.prepare(`SELECT e.*,
      COALESCE(SUM(CASE WHEN i.interaction_type IN ('公开回复','转发并补充') THEN 1 ELSE 0 END),0) AS effective_interactions,
      COALESCE(SUM(CASE WHEN i.response_received = 1 THEN 1 ELSE 0 END),0) AS responses
      FROM editors e LEFT JOIN interactions i ON i.editor_id=e.id
      GROUP BY e.id ORDER BY CASE e.priority WHEN 'X优先' THEN 0 WHEN '重点' THEN 1 ELSE 2 END, e.name`).all<Editor>(),
    db.prepare(`SELECT a.*, e.name AS editor_name, e.media
      FROM articles a JOIN editors e ON e.id=a.editor_id
      ORDER BY a.published_at DESC`).all<Article>(),
    db.prepare(`SELECT o.*, e.name AS editor_name, e.media, e.x_url,
      a.title AS article_title, a.url AS article_url
      FROM opportunities o JOIN editors e ON e.id=o.editor_id
      JOIN articles a ON a.id=o.article_id
      ORDER BY o.due_date`).all<Opportunity>(),
    db.prepare(`SELECT i.*, e.name AS editor_name, e.media
      FROM interactions i JOIN editors e ON e.id=i.editor_id
      ORDER BY i.occurred_at DESC`).all<Interaction>(),
    db.prepare("SELECT * FROM model_connections ORDER BY is_default DESC, updated_at DESC").all<ModelConnection>(),
    db.prepare(`SELECT aa.*, mc.label AS connection_label, mc.model
      FROM article_analyses aa JOIN model_connections mc ON mc.id=aa.connection_id
      ORDER BY aa.created_at DESC`).all<ArticleAnalysis>(),
    db.prepare(`SELECT completed_at AS completedAt, status,
      source_count AS sourceCount, discovered_count AS discoveredCount,
      inserted_count AS insertedCount, ai_status AS aiStatus,
      error_summary AS errorSummary
      FROM source_sync_runs ORDER BY completed_at DESC LIMIT 1`).first<ArticleRefresh>(),
  ]);
  return {
    editors: editors.results,
    articles: articles.results,
    opportunities: opportunities.results,
    interactions: interactions.results,
    modelConnections: modelConnections.results,
    analyses: analyses.results,
    articleRefresh: refresh,
  };
}

export async function getCollectionContext() {
  await ensureDatabase();
  const db = getDatabase();
  const [editors, urls, analyzedUrls, connection] = await Promise.all([
    db.prepare("SELECT id,name,media FROM editors").all<{ id: string; name: string; media: string }>(),
    db.prepare("SELECT url FROM articles").all<{ url: string }>(),
    db.prepare(`SELECT DISTINCT a.url FROM articles a
      JOIN article_analyses aa ON aa.article_id=a.id`).all<{ url: string }>(),
    db.prepare(`SELECT * FROM model_connections WHERE provider='minimax'
      ORDER BY CASE WHEN id='minimax-local-preset' THEN 0 ELSE 1 END, updated_at DESC LIMIT 1`).first<ModelConnection>(),
  ]);
  return {
    editors: editors.results,
    knownUrls: new Set(urls.results.map((item) => item.url)),
    analyzedUrls: new Set(analyzedUrls.results.map((item) => item.url)),
    connection,
  };
}

export async function saveCollectedArticles(input: Array<CollectedArticle & { summary: string; topics: string }>) {
  if (!input.length) return;
  await ensureDatabase();
  const db = getDatabase();
  await db.batch(input.map((article) => db.prepare(`INSERT INTO articles
    (id,editor_id,title,url,published_at,summary,topics,source)
    VALUES (?,?,?,?,?,?,?,?) ON CONFLICT(url) DO UPDATE SET
      editor_id=excluded.editor_id, title=excluded.title, published_at=excluded.published_at,
      summary=excluded.summary, topics=excluded.topics, source=excluded.source`).bind(
      `AR-LIVE-${crypto.randomUUID()}`, article.editorId, article.title, article.url,
      article.publishedAt, article.summary, article.topics, article.media,
    )));
  const latestByEditor = new Map<string, string>();
  for (const article of input) {
    const current = latestByEditor.get(article.editorId);
    if (!current || article.publishedAt > current) latestByEditor.set(article.editorId, article.publishedAt);
  }
  await db.batch([...latestByEditor].map(([editorId, publishedAt]) => db.prepare(`UPDATE editors
    SET last_article_date=CASE WHEN last_article_date IS NULL OR last_article_date < ? THEN ? ELSE last_article_date END,
    updated_at=CURRENT_TIMESTAMP WHERE id=?`).bind(publishedAt, publishedAt, editorId)));
}

export async function getArticleIdsByUrls(urls: string[]) {
  await ensureDatabase();
  const db = getDatabase();
  const rows = await Promise.all(urls.map((url) => db.prepare(
    "SELECT id,url FROM articles WHERE url=?",
  ).bind(url).first<{ id: string; url: string }>()));
  return new Map(rows.flatMap((row) => row ? [[row.url, row.id] as const] : []));
}

export async function saveSourceSyncRun(input: {
  startedAt: string;
  status: string;
  sourceCount: number;
  discoveredCount: number;
  insertedCount: number;
  aiStatus: string;
  errorSummary?: string;
}) {
  await ensureDatabase();
  await getDatabase().prepare(`INSERT INTO source_sync_runs
    (id,started_at,completed_at,status,source_count,discovered_count,inserted_count,ai_status,error_summary)
    VALUES (?,?,CURRENT_TIMESTAMP,?,?,?,?,?,?)`).bind(
      crypto.randomUUID(), input.startedAt, input.status, input.sourceCount,
      input.discoveredCount, input.insertedCount, input.aiStatus, input.errorSummary || null,
    ).run();
}

export async function updateOpportunity(id: string, status: string, xPostStatus: string, xPostUrl?: string) {
  await ensureDatabase();
  await getDatabase().prepare(
    "UPDATE opportunities SET status=?, x_post_status=?, x_post_url=? WHERE id=?",
  ).bind(status, xPostStatus, xPostUrl || null, id).run();
}

export async function updateEditorStage(id: string, stage: string) {
  await ensureDatabase();
  await getDatabase().prepare(
    "UPDATE editors SET stage=?, updated_at=CURRENT_TIMESTAMP WHERE id=?",
  ).bind(stage, id).run();
}

export async function addInteraction(input: {
  editorId: string;
  date: string;
  interactionType: string;
  xPostUrl?: string;
  replyUrl?: string;
  summary: string;
  responseReceived: boolean;
  followedByEditor: boolean;
}) {
  await ensureDatabase();
  const db = getDatabase();
  await db.prepare(`INSERT INTO interactions
    (id,editor_id,occurred_at,interaction_type,x_post_url,reply_url,summary,response_received,followed_by_editor)
    VALUES (?,?,?,?,?,?,?,?,?)`).bind(
      crypto.randomUUID(), input.editorId, input.date, input.interactionType,
      input.xPostUrl || null, input.replyUrl || null, input.summary,
      input.responseReceived ? 1 : 0, input.followedByEditor ? 1 : 0,
    ).run();
  const nextStage = input.responseReceived ? "对方回应" : input.interactionType === "点赞" ? null : "首次公开互动";
  if (nextStage) {
    await db.prepare(`UPDATE editors SET stage=CASE
      WHEN stage='观察中' OR ?='对方回应' THEN ? ELSE stage END,
      updated_at=CURRENT_TIMESTAMP WHERE id=?`).bind(nextStage, nextStage, input.editorId).run();
  }
}

export async function saveModelConnection(input: {
  label: string;
  provider: string;
  model: string;
  baseUrl?: string;
  keyHint?: string;
  status: string;
}) {
  await ensureDatabase();
  const db = getDatabase();
  await db.prepare(`INSERT INTO model_connections
    (id,label,provider,model,base_url,key_hint,status,is_default,updated_at)
    VALUES (?,?,?,?,?,?,?,0,CURRENT_TIMESTAMP)`).bind(
      crypto.randomUUID(), input.label, input.provider, input.model,
      input.baseUrl || null, input.keyHint || null, input.status,
    ).run();
}

export async function getAnalysisInput(connectionId: string, articleId: string) {
  await ensureDatabase();
  const db = getDatabase();
  const connection = await db.prepare("SELECT * FROM model_connections WHERE id=?").bind(connectionId).first<ModelConnection>();
  const article = await db.prepare(`SELECT a.*, e.name AS editor_name, e.media, e.role AS editor_role, e.topics AS editor_topics
    FROM articles a JOIN editors e ON e.id=a.editor_id WHERE a.id=?`).bind(articleId).first<Article & { editor_role: string; editor_topics: string }>();
  if (!connection) throw new Error("找不到模型连接");
  if (!article) throw new Error("找不到文章");
  if (connection.provider === "demo") throw new Error("演示模式不能执行真实模型分析");
  return { connection, article };
}

export async function saveArticleAnalysis(input: {
  articleId: string;
  connectionId: string;
  focus: string;
  relevance: string;
  xAngle: string;
  avoid: string;
}) {
  await saveArticleAnalyses([input]);
}

export async function saveArticleAnalyses(input: Array<{
  articleId: string;
  connectionId: string;
  focus: string;
  relevance: string;
  xAngle: string;
  avoid: string;
}>) {
  if (!input.length) return;
  await ensureDatabase();
  const db = getDatabase();
  await db.batch(input.map((analysis) => db.prepare(`INSERT INTO article_analyses
    (id,article_id,connection_id,focus,relevance,x_angle,avoid)
    VALUES (?,?,?,?,?,?,?)`).bind(
      crypto.randomUUID(), analysis.articleId, analysis.connectionId, analysis.focus,
      analysis.relevance, analysis.xAngle, analysis.avoid,
    )));
}
