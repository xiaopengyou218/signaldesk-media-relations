export type Editor = {
  id: string;
  name: string;
  media: string;
  role: string;
  topics: string;
  x_url: string | null;
  stage: string;
  priority: string;
  last_article_date: string | null;
  effective_interactions: number;
  responses: number;
};

export type Article = {
  id: string;
  editor_id: string;
  editor_name: string;
  media: string;
  title: string;
  url: string;
  published_at: string;
  summary: string;
  topics: string;
  source: string;
};

export type ArticleRefresh = {
  completedAt: string;
  status: string;
  sourceCount: number;
  discoveredCount: number;
  insertedCount: number;
  aiStatus: string;
  errorSummary: string | null;
};

export type Opportunity = {
  id: string;
  editor_id: string;
  editor_name: string;
  media: string;
  x_url: string | null;
  article_id: string;
  article_title: string;
  article_url: string;
  priority: string;
  suggested_angle: string;
  due_date: string;
  x_post_status: string;
  status: string;
  x_post_url: string | null;
};

export type Interaction = {
  id: string;
  editor_id: string;
  editor_name: string;
  media: string;
  occurred_at: string;
  interaction_type: string;
  x_post_url: string | null;
  reply_url: string | null;
  summary: string;
  response_received: number;
  followed_by_editor: number;
};

export type ModelConnection = {
  id: string;
  label: string;
  provider: string;
  model: string;
  base_url: string | null;
  key_hint: string | null;
  status: string;
  is_default: number;
  updated_at: string;
};

export type ArticleAnalysis = {
  id: string;
  article_id: string;
  connection_id: string;
  connection_label: string;
  model: string;
  focus: string;
  relevance: string;
  x_angle: string;
  avoid: string;
  created_at: string;
};

export type AppState = {
  editors: Editor[];
  articles: Article[];
  opportunities: Opportunity[];
  interactions: Interaction[];
  modelConnections: ModelConnection[];
  analyses: ArticleAnalysis[];
  articleRefresh: ArticleRefresh | null;
};
