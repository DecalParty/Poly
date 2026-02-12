import { NextRequest, NextResponse } from "next/server";
import { getSettings, updateSettings } from "@/lib/db/queries";
import { ensureDb } from "@/lib/db";
import { invalidateSettingsCache } from "@/lib/bot/engine";
import type { ApiResponse, BotSettings } from "@/types";

export const dynamic = "force-dynamic";

export async function GET(): Promise<NextResponse<ApiResponse<BotSettings>>> {
  await ensureDb();
  const settings = getSettings();
  return NextResponse.json({ success: true, data: settings });
}

export async function PUT(req: NextRequest): Promise<NextResponse<ApiResponse<BotSettings>>> {
  try {
    await ensureDb();
    const body = await req.json();
    const updated = updateSettings(body);
    invalidateSettingsCache();
    return NextResponse.json({ success: true, data: updated });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: `Invalid settings: ${err}` },
      { status: 400 }
    );
  }
}
