import { NextRequest } from "next/server";
import { getDb } from "@/lib/db";

/** Convert JS Date to SQLite datetime format: "YYYY-MM-DD HH:MM:SS" */
function toSqliteDatetime(date: Date): string {
  return date.toISOString().replace("T", " ").replace("Z", "").split(".")[0];
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const db = getDb();

  const presentation = db
    .prepare(
      `SELECT id FROM presentations WHERE presenter_code = ? OR id = ?`
    )
    .get(id, id) as { id: string } | undefined;

  if (!presentation) {
    return new Response("Presentation not found", { status: 404 });
  }

  const presentationId = presentation.id;
  let lastChecked = toSqliteDatetime(new Date());
  let closed = false;

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const sendEvent = (event: string, data: unknown) => {
        if (closed) return;
        controller.enqueue(
          encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
        );
      };

      // Send initial feedback
      const allFeedback = db
        .prepare(
          `SELECT id, presentation_id, slide_number, author_name, feedback_type, content, created_at
           FROM feedback WHERE presentation_id = ? ORDER BY created_at DESC`
        )
        .all(presentationId);
      sendEvent("init", allFeedback);

      // Poll for new feedback every 3 seconds
      const interval = setInterval(() => {
        try {
          const newFeedback = db
            .prepare(
              `SELECT id, presentation_id, slide_number, author_name, feedback_type, content, created_at
               FROM feedback WHERE presentation_id = ? AND created_at > ? ORDER BY created_at DESC`
            )
            .all(presentationId, lastChecked);

          if (newFeedback.length > 0) {
            sendEvent("new_feedback", newFeedback);
            lastChecked = toSqliteDatetime(new Date());
          }

          // Heartbeat every poll cycle
          sendEvent("heartbeat", { time: lastChecked });
        } catch {
          cleanup();
        }
      }, 3000);

      function cleanup() {
        if (closed) return;
        closed = true;
        clearInterval(interval);
        try {
          controller.close();
        } catch {
          // already closed
        }
      }

      request.signal.addEventListener("abort", cleanup);
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
