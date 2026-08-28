import { NextResponse } from "next/server";
import { addInteraction, getAppState, saveModelConnection, updateEditorStage, updateOpportunity } from "@/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return NextResponse.json(await getAppState());
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "读取失败" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as Record<string, unknown>;
    if (body.type === "update_opportunity") {
      await updateOpportunity(String(body.id), String(body.status), String(body.xPostStatus), body.xPostUrl ? String(body.xPostUrl) : undefined);
    } else if (body.type === "update_editor_stage") {
      await updateEditorStage(String(body.id), String(body.stage));
    } else if (body.type === "add_interaction") {
      await addInteraction({
        editorId: String(body.editorId),
        date: String(body.date),
        interactionType: String(body.interactionType),
        xPostUrl: body.xPostUrl ? String(body.xPostUrl) : undefined,
        replyUrl: body.replyUrl ? String(body.replyUrl) : undefined,
        summary: String(body.summary || "已完成互动"),
        responseReceived: Boolean(body.responseReceived),
        followedByEditor: Boolean(body.followedByEditor),
      });
    } else if (body.type === "save_model_connection") {
      await saveModelConnection({
        label: String(body.label), provider: String(body.provider), model: String(body.model),
        baseUrl: body.baseUrl ? String(body.baseUrl) : undefined,
        keyHint: body.keyHint ? String(body.keyHint) : undefined,
        status: String(body.status || "已测试"),
      });
    } else {
      return NextResponse.json({ error: "未知操作" }, { status: 400 });
    }
    return NextResponse.json(await getAppState());
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "保存失败" }, { status: 500 });
  }
}
