import { NextResponse } from "next/server";
import { startBot } from "@/lib/bot/engine";
import { ensureDb } from "@/lib/db";
import type { ApiResponse } from "@/types";

export async function POST(): Promise<NextResponse<ApiResponse>> {
  await ensureDb();
  const result = await startBot();

  if (!result.success) {
    return NextResponse.json(
      { success: false, error: result.error },
      { status: 400 }
    );
  }

  return NextResponse.json({ success: true, data: { message: "Bot started" } });
}
