import { NextResponse } from "next/server";
import {
  getPerformanceByAsset,
  getPerformanceByStrategy,
  getDailyStats,
  getHourlyPerformance,
  getAverageSlippage,
  resetAllStats,
} from "@/lib/db/queries";
import { ensureDb } from "@/lib/db";
import type { ApiResponse } from "@/types";

export const dynamic = "force-dynamic";

export async function GET(): Promise<NextResponse<ApiResponse>> {
  await ensureDb();

  const assets = getPerformanceByAsset();
  const strategies = getPerformanceByStrategy();
  const daily = getDailyStats();
  const hourly = getHourlyPerformance();
  const avgSlippage = getAverageSlippage();

  return NextResponse.json({
    success: true,
    data: {
      assets,
      strategies,
      daily,
      hourly,
      avgSlippage,
    },
  });
}

export async function DELETE(): Promise<NextResponse<ApiResponse>> {
  await ensureDb();
  resetAllStats();
  return NextResponse.json({ success: true, data: { message: "All stats reset" } });
}
