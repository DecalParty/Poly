import { getRecentOutcomes } from "@/lib/prices/market-scanner";
import { getSettings } from "@/lib/db/queries";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const settings = getSettings();
    const outcomes = getRecentOutcomes(settings.enabledAssets);
    return NextResponse.json({ success: true, data: outcomes });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: String(err) },
      { status: 500 }
    );
  }
}
