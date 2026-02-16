import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { randomUUID } from "crypto";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const db = getDb();

  const presentation = db
    .prepare(
      `SELECT * FROM presentations WHERE share_code = ? OR presenter_code = ? OR id = ?`
    )
    .get(id, id, id) as Record<string, unknown> | undefined;

  if (!presentation) {
    return NextResponse.json(
      { error: "Presentation not found" },
      { status: 404 }
    );
  }

  const url = new URL(request.url);
  const slideNumber = url.searchParams.get("slide");
  const since = url.searchParams.get("since");

  let query = `SELECT * FROM feedback WHERE presentation_id = ?`;
  const queryParams: unknown[] = [presentation.id];

  if (slideNumber) {
    query += ` AND slide_number = ?`;
    queryParams.push(parseInt(slideNumber));
  }

  if (since) {
    query += ` AND created_at > ?`;
    queryParams.push(since);
  }

  query += ` ORDER BY created_at DESC`;

  const feedback = db.prepare(query).all(...queryParams);
  return NextResponse.json(feedback);
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json();
  const db = getDb();

  const presentation = db
    .prepare(
      `SELECT * FROM presentations WHERE share_code = ? OR id = ?`
    )
    .get(id, id) as Record<string, unknown> | undefined;

  if (!presentation) {
    return NextResponse.json(
      { error: "Presentation not found" },
      { status: 404 }
    );
  }

  const { slide_number, content, author_name, feedback_type } = body;

  if (!slide_number || !content) {
    return NextResponse.json(
      { error: "slide_number and content are required" },
      { status: 400 }
    );
  }

  const feedbackId = randomUUID();
  db.prepare(
    `INSERT INTO feedback (id, presentation_id, slide_number, author_name, feedback_type, content)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(
    feedbackId,
    presentation.id,
    slide_number,
    author_name || "Anonymous",
    feedback_type || "comment",
    content
  );

  const inserted = db
    .prepare(`SELECT * FROM feedback WHERE id = ?`)
    .get(feedbackId);

  return NextResponse.json(inserted, { status: 201 });
}
