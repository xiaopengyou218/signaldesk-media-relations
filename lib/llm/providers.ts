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
