import { NextResponse } from "next/server";
import { testProvider, type ProviderInput } from "@/lib/llm/providers";

export async function POST(request: Request) {
  try {
    const input = await request.json() as ProviderInput;
    return NextResponse.json(await testProvider(input));
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "连接失败" }, { status: 400 });
  }
}
