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
      `SELECT id, presentation_id, slide_number, image_path FROM slides WHERE presentation_id = ? ORDER BY slide_number`
    )
    .all(presentation.id as string);

  // Only include presenter_code if the lookup was by presenter_code
  const isPresenter = id === presentation.presenter_code;
  const { presenter_code, presenter_email, ...publicFields } = presentation;

  return NextResponse.json({
    ...publicFields,
    ...(isPresenter ? { presenter_code, presenter_email } : {}),
    slides,
  });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const db = getDb();

  // PATCH only allowed via presenter_code (not share_code or raw id)
  const presentation = db
    .prepare(`SELECT * FROM presentations WHERE presenter_code = ?`)
    .get(id) as Record<string, unknown> | undefined;

  if (!presentation) {
    return NextResponse.json(
      { error: "Presentation not found" },
      { status: 404 }
    );
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (body.is_live !== undefined) {
    db.prepare(`UPDATE presentations SET is_live = ?, updated_at = datetime('now') WHERE id = ?`).run(
      body.is_live ? 1 : 0,
      presentation.id
    );
  }

  if (body.current_slide !== undefined) {
    const slide = Number(body.current_slide);
    if (!Number.isInteger(slide) || slide < 1 || slide > (presentation.slide_count as number)) {
      return NextResponse.json({ error: "Invalid slide number" }, { status: 400 });
    }
    db.prepare(
      `UPDATE presentations SET current_slide = ?, updated_at = datetime('now') WHERE id = ?`
    ).run(slide, presentation.id);
  }

  const updated = db
    .prepare(`SELECT id, title, share_code, presenter_code, slide_count, is_live, current_slide, created_at, updated_at FROM presentations WHERE id = ?`)
    .get(presentation.id as string);

  return NextResponse.json(updated);
}
