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
  const slideParam = url.searchParams.get("slide");

  let query = `SELECT content, feedback_type, slide_number, author_name FROM feedback WHERE presentation_id = ?`;
  const queryParams: unknown[] = [presentation.id as string];

  if (slideParam) {
    query += ` AND slide_number = ?`;
    queryParams.push(parseInt(slideParam));
  }

  query += ` ORDER BY created_at DESC`;

  const feedback = db.prepare(query).all(...queryParams) as Array<{
    content: string;
    feedback_type: string;
    slide_number: number;
    author_name: string;
  }>;

  const summary = await summarizeFeedback(feedback, context);

  return NextResponse.json({ summary, feedbackCount: feedback.length });
}
