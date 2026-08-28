export type ProviderInput = {
  provider: "openai" | "anthropic" | "gemini" | "compatible";
  apiKey: string;
  model: string;
  baseUrl?: string;
};

function safeCustomBaseUrl(value: string) {
  const url = new URL(value);
  if (url.protocol !== "https:") throw new Error("自定义端点必须使用 HTTPS");
  const host = url.hostname.toLowerCase();
  const privateHost = host === "localhost" || host === "::1" || host.endsWith(".local") ||
    /^127\./.test(host) || /^10\./.test(host) || /^192\.168\./.test(host) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(host);
  if (privateHost) throw new Error("托管版本不能连接内网地址");
  return value.replace(/\/$/, "");
}

async function checkedFetch(url: string, init: RequestInit) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetch(url, { ...init, signal: controller.signal });
    if (!response.ok) {
      const text = await response.text();
      throw new Error(`连接失败（${response.status}）：${text.slice(0, 160)}`);
    }
    return response;
  } finally {
    clearTimeout(timeout);
  }
}

export async function testProvider(input: ProviderInput) {
  const started = Date.now();
  if (!input.apiKey.trim()) throw new Error("请填写 API Key");
  if (!input.model.trim()) throw new Error("请填写模型名称");

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
    const base = safeCustomBaseUrl(input.baseUrl || "");
    await checkedFetch(`${base}/chat/completions`, {
      method: "POST",
      headers: { Authorization: `Bearer ${input.apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: input.model, messages: [{ role: "user", content: "Reply only with: connected" }], max_tokens: 12 }),
    });
  }
  return { ok: true, latencyMs: Date.now() - started };
}
