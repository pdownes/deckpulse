import { NextRequest, NextResponse } from "next/server";
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
    return NextResponse.json(
      { error: "Presentation not found" },
      { status: 404 }
    );
  }

  const feedback = db
    .prepare(
      `SELECT slide_number, author_name, feedback_type, content, created_at
       FROM feedback WHERE presentation_id = ? ORDER BY slide_number, created_at`
    )
    .all(presentation.id as string) as Array<{
    slide_number: number;
    author_name: string;
    feedback_type: string;
    content: string;
    created_at: string;
  }>;

  // Build CSV
  const escCsv = (s: string) => `"${s.replace(/"/g, '""')}"`;
  const rows = [
    "Slide,Type,Author,Content,Timestamp",
    ...feedback.map(
      (f) =>
        `${f.slide_number},${escCsv(f.feedback_type)},${escCsv(f.author_name)},${escCsv(f.content)},${escCsv(f.created_at)}`
    ),
  ];
  const csv = rows.join("\n");

  const title = (presentation.title as string).replace(/[^a-zA-Z0-9]/g, "_");

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename="${title}_feedback.csv"`,
    },
  });
}
