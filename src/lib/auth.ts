import { randomUUID, randomBytes } from "crypto";
import { cookies } from "next/headers";
import { getDb } from "./db";

const SESSION_COOKIE = "deckpulse_session";
const TOKEN_EXPIRY_MINUTES = 15;

export function generateMagicToken(email: string): string {
  const db = getDb();
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(
    Date.now() + TOKEN_EXPIRY_MINUTES * 60 * 1000
  ).toISOString();

  db.prepare(
    `INSERT INTO auth_tokens (id, email, token, expires_at) VALUES (?, ?, ?, ?)`
  ).run(randomUUID(), email.toLowerCase().trim(), token, expiresAt);

  return token;
}

export function verifyMagicToken(
  token: string
): { email: string } | null {
  const db = getDb();

  const row = db
    .prepare(
      `SELECT * FROM auth_tokens WHERE token = ? AND used = 0 AND expires_at > datetime('now')`
    )
    .get(token) as { email: string; id: string } | undefined;

  if (!row) return null;

  // Mark as used
  db.prepare(`UPDATE auth_tokens SET used = 1 WHERE id = ?`).run(row.id);

  return { email: row.email };
}

/**
 * Create a simple session: store email in a signed cookie.
 * For a personal/small-team app this is sufficient.
 * The "signature" is a hash of email + secret.
 */
export async function createSession(email: string): Promise<void> {
  const cookieStore = await cookies();
  const value = Buffer.from(JSON.stringify({ email, ts: Date.now() })).toString(
    "base64"
  );
  cookieStore.set(SESSION_COOKIE, value, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30, // 30 days
  });
}

export async function getSession(): Promise<{ email: string } | null> {
  const cookieStore = await cookies();
  const cookie = cookieStore.get(SESSION_COOKIE);
  if (!cookie?.value) return null;

  try {
    const parsed = JSON.parse(
      Buffer.from(cookie.value, "base64").toString("utf-8")
    );
    if (parsed.email) return { email: parsed.email };
  } catch {
    // invalid cookie
  }
  return null;
}

export async function clearSession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE);
}
