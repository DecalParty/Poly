import { NextResponse } from "next/server";
import { getState } from "@/lib/bot/engine";
import { ensureDb } from "@/lib/db";
import type { ApiResponse, BotState } from "@/types";

export const dynamic = "force-dynamic";

export async function GET(): Promise<NextResponse<ApiResponse<BotState>>> {
  await ensureDb();
  const state = getState();
  return NextResponse.json({ success: true, data: state });
}
