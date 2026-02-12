import { NextRequest, NextResponse } from "next/server";
import { getRecentTrades, getPnlHistory } from "@/lib/db/queries";
import { ensureDb } from "@/lib/db";
import type { ApiResponse, TradeRecord, PnlDataPoint, MarketAsset, SubStrategy } from "@/types";

export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest
): Promise<NextResponse<ApiResponse<{ trades: TradeRecord[]; pnlHistory: PnlDataPoint[] }>>> {
  await ensureDb();
  const params = req.nextUrl.searchParams;
  const limit = parseInt(params.get("limit") || "100");
  const asset = params.get("asset") as MarketAsset | null;
  const strategy = params.get("strategy") as SubStrategy | null;
  const from = params.get("from") || undefined;
  const to = params.get("to") || undefined;

  const trades = getRecentTrades(limit, {
    asset: asset || undefined,
    strategy: strategy || undefined,
    from,
    to,
  });
  const pnlHistory = getPnlHistory();

  return NextResponse.json({
    success: true,
    data: { trades, pnlHistory },
  });
}
