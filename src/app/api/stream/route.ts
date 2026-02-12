import { subscribeSSE } from "@/lib/bot/engine";
import { ensureDb } from "@/lib/db";
import type { SSEEvent } from "@/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(): Promise<Response> {
await ensureDb();
const encoder = new TextEncoder();

let cleanupFn: (() => void) | null = null;

const stream = new ReadableStream({
  start(controller) {
    // Send initial keepalive
    controller.enqueue(encoder.encode(": connected\n\n"));

    const unsubscribe = subscribeSSE((event: SSEEvent) => {
      try {
        const data = `data: ${JSON.stringify(event)}\n\n`;
        controller.enqueue(encoder.encode(data));
      } catch {
        // Stream closed
        unsubscribe();
      }
    });

    // Keepalive every 30 seconds
    const keepalive = setInterval(() => {
      try {
        controller.enqueue(encoder.encode(": keepalive\n\n"));
      } catch {
        clearInterval(keepalive);
        unsubscribe();
      }
    }, 30000);

    cleanupFn = () => {
      clearInterval(keepalive);
      unsubscribe();
    };
  },
  cancel() {
    if (cleanupFn) cleanupFn();
  },
});

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
