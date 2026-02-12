import { NextResponse } from "next/server";
import { stopBot } from "@/lib/bot/engine";
import type { ApiResponse } from "@/types";

export async function POST(): Promise<NextResponse<ApiResponse>> {
  const result = stopBot();

  if (!result.success) {
    return NextResponse.json(
      { success: false, error: result.error },
      { status: 400 }
    );
  }

  return NextResponse.json({ success: true, data: { message: "Bot stopped" } });
}
