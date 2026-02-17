import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { sendFeedbackReportEmail } from "@/lib/email";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { email } = await request.json();
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

  // Use provided email or fall back to presenter_email
  const recipientEmail =
    email || (presentation.presenter_email as string | null);

  if (!recipientEmail) {
    return NextResponse.json(
      { error: "No email address provided" },
      { status: 400 }
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

  if (feedback.length === 0) {
    return NextResponse.json(
      { error: "No feedback to report" },
      { status: 400 }
    );
  }

  const sent = await sendFeedbackReportEmail(
    recipientEmail,
    presentation.title as string,
    feedback
  );

  if (!sent) {
    return NextResponse.json(
      { error: "Failed to send email" },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true });
}
