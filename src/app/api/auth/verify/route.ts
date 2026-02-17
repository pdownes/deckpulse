import { NextRequest, NextResponse } from "next/server";
import { verifyMagicToken, createSession } from "@/lib/auth";

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token");

  if (!token) {
    return NextResponse.redirect(new URL("/login?error=missing_token", request.url));
  }

  const result = verifyMagicToken(token);

  if (!result) {
    return NextResponse.redirect(
      new URL("/login?error=invalid_or_expired", request.url)
    );
  }

  await createSession(result.email);
  return NextResponse.redirect(new URL("/my-presentations", request.url));
}
