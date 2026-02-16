import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const db = getDb();

  // Look up by share_code or presenter_code
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

  const slides = db
    .prepare(
      `SELECT * FROM slides WHERE presentation_id = ? ORDER BY slide_number`
    )
    .all(presentation.id as string);

  return NextResponse.json({ ...presentation, slides });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json();
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

  if (body.is_live !== undefined) {
    db.prepare(`UPDATE presentations SET is_live = ?, updated_at = datetime('now') WHERE id = ?`).run(
      body.is_live ? 1 : 0,
      presentation.id
    );
  }

  if (body.current_slide !== undefined) {
    db.prepare(
      `UPDATE presentations SET current_slide = ?, updated_at = datetime('now') WHERE id = ?`
    ).run(body.current_slide, presentation.id);
  }

  const updated = db
    .prepare(`SELECT * FROM presentations WHERE id = ?`)
    .get(presentation.id as string);

  return NextResponse.json(updated);
}
