import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { randomUUID } from "crypto";

const VALID_FEEDBACK_TYPES = ["comment", "question", "note"];
const MAX_CONTENT_LENGTH = 2000;
const MAX_NAME_LENGTH = 100;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const db = getDb();

  const presentation = db
    .prepare(
      `SELECT id FROM presentations WHERE share_code = ? OR presenter_code = ? OR id = ?`
    )
    .get(id, id, id) as { id: string } | undefined;

  if (!presentation) {
    return NextResponse.json(
      { error: "Presentation not found" },
      { status: 404 }
    );
  }

  const url = new URL(request.url);
  const slideNumber = url.searchParams.get("slide");
  const since = url.searchParams.get("since");

  let query = `SELECT id, presentation_id, slide_number, author_name, feedback_type, content, created_at FROM feedback WHERE presentation_id = ?`;
  const queryParams: unknown[] = [presentation.id];

  if (slideNumber) {
    const parsed = parseInt(slideNumber, 10);
    if (!Number.isNaN(parsed)) {
      query += ` AND slide_number = ?`;
      queryParams.push(parsed);
    }
  }

  if (since) {
    // Normalize to SQLite datetime format
    query += ` AND created_at > ?`;
    queryParams.push(since.replace("T", " ").replace("Z", "").split(".")[0]);
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
  const db = getDb();

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const presentation = db
    .prepare(
      `SELECT id, slide_count FROM presentations WHERE share_code = ? OR id = ?`
    )
    .get(id, id) as { id: string; slide_count: number } | undefined;

  if (!presentation) {
    return NextResponse.json(
      { error: "Presentation not found" },
      { status: 404 }
    );
  }

  const { slide_number, content, author_name, feedback_type } = body;

  if (!slide_number || !content || typeof content !== "string") {
    return NextResponse.json(
      { error: "slide_number and content are required" },
      { status: 400 }
    );
  }

  const slideNum = Number(slide_number);
  if (!Number.isInteger(slideNum) || slideNum < 1 || slideNum > presentation.slide_count) {
    return NextResponse.json(
      { error: "Invalid slide number" },
      { status: 400 }
    );
  }

  const trimmedContent = String(content).slice(0, MAX_CONTENT_LENGTH).trim();
  if (!trimmedContent) {
    return NextResponse.json({ error: "Content cannot be empty" }, { status: 400 });
  }

  const type = VALID_FEEDBACK_TYPES.includes(feedback_type as string)
    ? (feedback_type as string)
    : "comment";
  const name = typeof author_name === "string"
    ? author_name.slice(0, MAX_NAME_LENGTH).trim() || "Anonymous"
    : "Anonymous";

  const feedbackId = randomUUID();
  db.prepare(
    `INSERT INTO feedback (id, presentation_id, slide_number, author_name, feedback_type, content)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(feedbackId, presentation.id, slideNum, name, type, trimmedContent);

  const inserted = db
    .prepare(
      `SELECT id, presentation_id, slide_number, author_name, feedback_type, content, created_at FROM feedback WHERE id = ?`
    )
    .get(feedbackId);

  return NextResponse.json(inserted, { status: 201 });
}
