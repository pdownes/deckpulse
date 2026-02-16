import { NextRequest } from "next/server";
import { getDb } from "@/lib/db";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const db = getDb();

  const presentation = db
    .prepare(
      `SELECT * FROM presentations WHERE presenter_code = ? OR id = ?`
    )
    .get(id, id) as Record<string, unknown> | undefined;

  if (!presentation) {
    return new Response("Presentation not found", { status: 404 });
  }

  const presentationId = presentation.id as string;
  let lastChecked = new Date().toISOString();

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const sendEvent = (event: string, data: unknown) => {
        controller.enqueue(
          encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
        );
      };

      // Send initial feedback
      const allFeedback = db
        .prepare(
          `SELECT * FROM feedback WHERE presentation_id = ? ORDER BY created_at DESC`
        )
        .all(presentationId);
      sendEvent("init", allFeedback);

      // Poll for new feedback every 2 seconds
      const interval = setInterval(() => {
        try {
          const newFeedback = db
            .prepare(
              `SELECT * FROM feedback WHERE presentation_id = ? AND created_at > ? ORDER BY created_at DESC`
            )
            .all(presentationId, lastChecked);

          if (newFeedback.length > 0) {
            sendEvent("new_feedback", newFeedback);
            lastChecked = new Date().toISOString();
          }

          // Send heartbeat
          sendEvent("heartbeat", { time: new Date().toISOString() });
        } catch {
          clearInterval(interval);
          controller.close();
        }
      }, 2000);

      // Clean up on abort
      request.signal.addEventListener("abort", () => {
        clearInterval(interval);
        controller.close();
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
