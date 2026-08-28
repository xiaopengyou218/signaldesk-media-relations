import { NextResponse } from "next/server";
import { getAnalysisInput, getAppState, saveArticleAnalysis } from "@/db";
import { analyzeArticleWithProvider } from "@/lib/llm/providers";

export async function POST(request: Request) {
  try {
    const input = await request.json() as { connectionId?: string; articleId?: string; apiKey?: string };
    if (!input.connectionId || !input.articleId) throw new Error("请选择模型连接和文章");
    if (!input.apiKey) throw new Error("请临时输入 API Key");

    const { connection, article } = await getAnalysisInput(input.connectionId, input.articleId);
    const analysis = await analyzeArticleWithProvider({
      provider: connection.provider as "minimax" | "compatible",
      apiKey: input.apiKey,
      model: connection.model,
      baseUrl: connection.base_url || undefined,
      article,
    });
    await saveArticleAnalysis({
      articleId: article.id,
      connectionId: connection.id,
      focus: analysis.focus,
      relevance: analysis.relevance,
      xAngle: analysis.xAngle,
      avoid: analysis.avoid,
    });
    return NextResponse.json(await getAppState());
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "分析失败" }, { status: 400 });
  }
}
