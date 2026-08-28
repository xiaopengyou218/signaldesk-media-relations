export type ProviderInput = {
  provider: "openai" | "anthropic" | "gemini" | "minimax" | "compatible";
  apiKey: string;
  model: string;
  baseUrl?: string;
};

type EndpointResolution = {
  endpoint: string;
  notice?: string;
};

function validatePublicHttpsUrl(value: string) {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error("Base URL 格式不正确，请填写完整的 HTTPS 地址");
  }
  if (url.protocol !== "https:") throw new Error("自定义端点必须使用 HTTPS");
  const host = url.hostname.toLowerCase();
  const privateHost = host === "localhost" || host === "::1" || host.endsWith(".local") ||
    /^127\./.test(host) || /^10\./.test(host) || /^192\.168\./.test(host) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(host);
  if (privateHost) throw new Error("托管版本不能连接内网地址");
  url.search = "";
  url.hash = "";
  return url;
}

function compatibleEndpoint(input: ProviderInput): EndpointResolution {
  const url = validatePublicHttpsUrl(input.baseUrl || "");
  const isMiniMaxHost = url.hostname === "api.minimaxi.com" || url.hostname === "api.minimax.io";
  let notice: string | undefined;

  if (input.provider === "minimax") {
    if (!isMiniMaxHost) {
      throw new Error("MiniMax 端点应使用 https://api.minimaxi.com/v1（中国区）或 https://api.minimax.io/v1（国际区）");
    }
    if (!/^\/v1(?:\/chat\/completions)?\/?$/.test(url.pathname)) {
      url.pathname = "/v1";
      notice = "已自动改用 MiniMax 官方 /v1 端点";
    }
  }

  const pathname = url.pathname.replace(/\/+$/, "");
  if (!pathname.endsWith("/chat/completions")) url.pathname = `${pathname}/chat/completions`;
  return { endpoint: url.toString().replace(/\/$/, ""), notice };
}

function cleanUpstreamError(text: string) {
  const trimmed = text.trim();
  if (!trimmed) return "服务没有返回错误详情";
  try {
    const json = JSON.parse(trimmed) as { error?: { message?: string } | string; message?: string };
    if (typeof json.error === "string") return json.error;
    return json.error?.message || json.message || "服务返回了未知错误";
  } catch {
    return trimmed.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 180);
  }
}

async function checkedFetch(url: string, init: RequestInit, notFoundHint?: string) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetch(url, { ...init, signal: controller.signal });
    if (!response.ok) {
      const detail = cleanUpstreamError(await response.text());
      const hint = response.status === 404 && notFoundHint ? `。${notFoundHint}` : "";
      throw new Error(`连接失败（${response.status}）：${detail}${hint}`);
    }
    return response;
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") throw new Error("连接超时，请检查端点或网络状态");
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

export async function testProvider(input: ProviderInput) {
  const started = Date.now();
  if (!input.apiKey.trim()) throw new Error("请填写 API Key");
  if (!input.model.trim()) throw new Error("请填写模型名称");
  let endpoint: string | undefined;
  let notice: string | undefined;

  if (input.provider === "openai") {
    await checkedFetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: { Authorization: `Bearer ${input.apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: input.model, input: "Reply only with: connected", max_output_tokens: 12 }),
    });
  } else if (input.provider === "anthropic") {
    await checkedFetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "x-api-key": input.apiKey, "anthropic-version": "2023-06-01", "Content-Type": "application/json" },
      body: JSON.stringify({ model: input.model, max_tokens: 12, messages: [{ role: "user", content: "Reply only with: connected" }] }),
    });
  } else if (input.provider === "gemini") {
    await checkedFetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(input.model)}:generateContent?key=${encodeURIComponent(input.apiKey)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contents: [{ parts: [{ text: "Reply only with: connected" }] }] }),
    });
  } else {
    const resolved = compatibleEndpoint(input);
    endpoint = resolved.endpoint;
    notice = resolved.notice;
    await checkedFetch(endpoint, {
      method: "POST",
      headers: { Authorization: `Bearer ${input.apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: input.model, messages: [{ role: "user", content: "Reply only with: connected" }], max_tokens: 12 }),
    }, "请确认 Base URL 以 /v1 结尾；如果已粘贴完整路径，系统不会再次追加 /chat/completions");
  }
  return { ok: true, latencyMs: Date.now() - started, endpoint, notice };
}

export type ArticleAnalysisInput = ProviderInput & {
  article: {
    title: string;
    summary: string;
    topics: string;
    editor_name: string;
    media: string;
    editor_role: string;
    editor_topics: string;
  };
};

export type ArticleAnalysisOutput = {
  focus: string;
  relevance: string;
  xAngle: string;
  avoid: string;
};

function parseAnalysis(content: string): ArticleAnalysisOutput {
  const withoutThinking = content.replace(/<think>[\s\S]*?<\/think>/gi, "").replace(/```(?:json)?|```/gi, "").trim();
  const match = withoutThinking.match(/\{[\s\S]*\}/);
  if (!match) throw new Error("模型已响应，但没有返回可读取的结构化分析");
  const parsed = JSON.parse(match[0]) as Partial<ArticleAnalysisOutput>;
  if (!parsed.focus || !parsed.relevance || !parsed.xAngle || !parsed.avoid) {
    throw new Error("模型返回内容缺少必要字段，请重试一次");
  }
  return { focus: parsed.focus, relevance: parsed.relevance, xAngle: parsed.xAngle, avoid: parsed.avoid };
}

export async function analyzeArticleWithProvider(input: ArticleAnalysisInput): Promise<ArticleAnalysisOutput> {
  if (!input.apiKey.trim()) throw new Error("请临时输入 API Key");
  if (input.provider !== "minimax" && input.provider !== "compatible") {
    throw new Error("本次真实试跑先支持 MiniMax 和 OpenAI 兼容端点");
  }
  const { endpoint } = compatibleEndpoint(input);
  const prompt = `请分析下面这篇真实文章记录，目标是帮助用户理解科技媒体编辑的长期关注点，并决定是否值得在 X 上进行一次低打扰、增加信息量的公开互动。

编辑：${input.article.editor_name}
媒体：${input.article.media}
职位：${input.article.editor_role}
编辑历史关注领域：${input.article.editor_topics}
文章标题：${input.article.title}
文章摘要：${input.article.summary}
文章标签：${input.article.topics}

只返回一个 JSON 对象，不要 Markdown，不要额外说明：
{"focus":"用1-2句概括这篇文章反映出的编辑关注点","relevance":"用1-2句说明为何值得或不值得互动","xAngle":"一条自然、具体、不奉承的中文 X 回复建议；不超过120个汉字","avoid":"一句话说明互动时应避免什么"}`;
  const response = await checkedFetch(endpoint, {
    method: "POST",
    headers: { Authorization: `Bearer ${input.apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: input.model,
      messages: [
        { role: "system", content: "你是严谨的科技媒体关系研究助手。基于提供的数据判断，不编造作者观点或事实。" },
        { role: "user", content: prompt },
      ],
      temperature: 0.2,
      max_tokens: 700,
    }),
  }, "请确认模型 ID 与 Base URL；MiniMax 中国区应使用 https://api.minimaxi.com/v1");
  const payload = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
  const content = payload.choices?.[0]?.message?.content;
  if (!content) throw new Error("模型没有返回分析内容");
  try {
    return parseAnalysis(content);
  } catch (error) {
    if (error instanceof SyntaxError) throw new Error("模型返回的 JSON 格式不正确，请重试一次");
    throw error;
  }
}
