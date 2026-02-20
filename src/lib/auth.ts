import { randomUUID, randomBytes, createHmac } from "crypto";
import { cookies } from "next/headers";
import { getDb } from "./db";

const SESSION_COOKIE = "deckpulse_session";
const TOKEN_EXPIRY_MINUTES = 15;
const SESSION_SECRET = process.env.SESSION_SECRET || randomBytes(32).toString("hex");

function sign(payload: string): string {
  return createHmac("sha256", SESSION_SECRET).update(payload).digest("hex");
}

export function generateMagicToken(email: string): string {
  const db = getDb();
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(
    Date.now() + TOKEN_EXPIRY_MINUTES * 60 * 1000
  ).toISOString();

  db.prepare(
    `INSERT INTO auth_tokens (id, email, token, expires_at) VALUES (?, ?, ?, ?)`
  ).run(randomUUID(), email.toLowerCase().trim(), token, expiresAt);

  // Clean up expired/used tokens
  db.prepare(
    `DELETE FROM auth_tokens WHERE used = 1 OR expires_at < datetime('now')`
  ).run();

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

export async function createSession(email: string): Promise<void> {
  const cookieStore = await cookies();
  const payload = Buffer.from(
    JSON.stringify({ email: email.toLowerCase().trim(), ts: Date.now() })
  ).toString("base64");
  const signature = sign(payload);
  const value = `${payload}.${signature}`;

  cookieStore.set(SESSION_COOKIE, value, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
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
    const [payload, signature] = cookie.value.split(".");
    if (!payload || !signature) return null;

    // Verify HMAC signature
    const expected = sign(payload);
    if (signature !== expected) return null;

    const parsed = JSON.parse(
      Buffer.from(payload, "base64").toString("utf-8")
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
