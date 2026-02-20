import { NextRequest, NextResponse } from "next/server";
import { generateMagicToken } from "@/lib/auth";
import { sendMagicLinkEmail } from "@/lib/email";

export async function POST(request: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { email } = body;

  if (!email || typeof email !== "string" || !/^.+@.+\..+$/.test(email)) {
    return NextResponse.json(
      { error: "Valid email is required" },
      { status: 400 }
    );
  }

  const token = generateMagicToken(email);
  const sent = await sendMagicLinkEmail(email, token);

  if (!sent) {
    return NextResponse.json(
      { error: "Failed to send email" },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true });
}
