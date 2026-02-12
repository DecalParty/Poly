import { NextResponse } from "next/server";
import { resetCircuitBreaker } from "@/lib/bot/engine";
import type { ApiResponse } from "@/types";

export async function POST(): Promise<NextResponse<ApiResponse>> {
  const result = resetCircuitBreaker();
  return NextResponse.json({ success: result.success, data: { message: "Circuit breaker reset" } });
}
