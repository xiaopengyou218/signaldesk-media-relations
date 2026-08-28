import { NextResponse } from "next/server";
import { env } from "cloudflare:workers";
import { getAppState, getCollectionContext, saveCollectedArticles, saveSourceSyncRun } from "@/db";
import { collectTrackedArticles, fallbackArticleMetadata } from "@/lib/collection/feeds";
import { enrichCollectedArticlesWithProvider } from "@/lib/llm/providers";

export const dynamic = "force-dynamic";

export async function POST() {
  const startedAt = new Date().toISOString();
  try {
    const { editors, knownUrls, connection, lastAiStatus } = await getCollectionContext();
    const collected = await collectTrackedArticles(editors);
    const perEditor = new Map<string, number>();
    const recent = collected.articles.filter((article) => {
      const count = perEditor.get(article.editorId) || 0;
      if (count >= 3) return false;
      perEditor.set(article.editorId, count + 1);
      return true;
    }).slice(0, 30);
    const fresh = recent.filter((article) => !knownUrls.has(article.url));
    const shouldRetryAi = !fresh.length && (lastAiStatus.includes("失败") || lastAiStatus.includes("未运行"));
    const aiCandidates = fresh.length ? fresh.slice(0, 8) : shouldRetryAi ? recent.slice(0, 8) : [];

    const fallback = new Map(fresh.map((article) => [article.url, fallbackArticleMetadata(article)]));
    const apiKey = (env as unknown as { MINIMAX_API_KEY?: string }).MINIMAX_API_KEY?.trim();
    let aiStatus = aiCandidates.length ? "未运行：MiniMax 密钥未配置" : "无新增，无需调用";
    let aiError = "";

    if (aiCandidates.length && apiKey && connection) {
      try {
        const aiItems = await enrichCollectedArticlesWithProvider({
          provider: "minimax",
          apiKey,
          model: connection.model,
          baseUrl: connection.base_url || "https://api.minimaxi.com/v1",
          articles: aiCandidates,
        });
        for (const item of aiItems) fallback.set(item.url, { summary: item.summary, topics: item.topics });
        aiStatus = `MiniMax 已整理 ${aiItems.length} 篇`;
      } catch (error) {
        aiError = error instanceof Error ? `MiniMax: ${error.message}` : "MiniMax: 整理失败";
        aiStatus = "MiniMax 失败，已用本地规则完成";
      }
    }

    const saveCandidates = new Map(fresh.map((article) => [article.url, article]));
    if (aiStatus.startsWith("MiniMax 已整理")) {
      for (const article of aiCandidates) saveCandidates.set(article.url, article);
    }
    await saveCollectedArticles([...saveCandidates.values()].map((article) => ({
      ...article,
      ...(fallback.get(article.url) || fallbackArticleMetadata(article)),
    })));
    const errors = [...collected.errors, ...(aiError ? [aiError] : [])];
    const status = collected.sourceCount === 0 ? "失败" : errors.length ? "部分完成" : "完成";
    await saveSourceSyncRun({
      startedAt,
      status,
      sourceCount: collected.sourceCount,
      discoveredCount: recent.length,
      insertedCount: fresh.length,
      aiStatus,
      errorSummary: errors.slice(0, 5).join("；"),
    });
    return NextResponse.json(await getAppState());
  } catch (error) {
    const message = error instanceof Error ? error.message : "文章刷新失败";
    try {
      await saveSourceSyncRun({
        startedAt,
        status: "失败",
        sourceCount: 0,
        discoveredCount: 0,
        insertedCount: 0,
        aiStatus: "未运行",
        errorSummary: message,
      });
    } catch {
      // Keep the original collection error as the response.
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
