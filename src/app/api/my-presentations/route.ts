import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getDb } from "@/lib/db";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const db = getDb();
  const presentations = db
    .prepare(
      `SELECT
        p.id, p.title, p.share_code, p.presenter_code, p.slide_count,
        p.is_live, p.created_at,
        COUNT(f.id) as feedback_count
      FROM presentations p
      LEFT JOIN feedback f ON f.presentation_id = p.id
      WHERE p.presenter_email = ?
      GROUP BY p.id
      ORDER BY p.created_at DESC`
    )
    .all(session.email.toLowerCase().trim());

  return NextResponse.json(presentations);
}
