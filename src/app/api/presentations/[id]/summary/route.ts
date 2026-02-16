import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { summarizeFeedback } from "@/lib/summarize";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const db = getDb();

  const presentation = db
    .prepare(
      `SELECT * FROM presentations WHERE presenter_code = ? OR share_code = ? OR id = ?`
    )
    .get(id, id, id) as Record<string, unknown> | undefined;

  if (!presentation) {
    return NextResponse.json(
      { error: "Presentation not found" },
      { status: 404 }
    );
  }

  const url = new URL(request.url);
  const context = (url.searchParams.get("context") as "live" | "review") || "live";

  const feedback = db
    .prepare(
      `SELECT content, feedback_type, slide_number, author_name FROM feedback WHERE presentation_id = ? ORDER BY created_at DESC`
    )
    .all(presentation.id as string) as Array<{
    content: string;
    feedback_type: string;
    slide_number: number;
    author_name: string;
  }>;

  const summary = await summarizeFeedback(feedback, context);

  return NextResponse.json({ summary, feedbackCount: feedback.length });
}
