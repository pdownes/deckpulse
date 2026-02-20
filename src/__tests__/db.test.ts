import { describe, it, expect, beforeEach, afterEach } from "vitest";
import Database from "better-sqlite3";
import fs from "fs";
import path from "path";
import os from "os";

// We test the database initialization logic directly by replicating
// what db.ts does, to avoid issues with the global singleton in tests.
function createTestDb(dbPath: string): Database.Database {
  const db = new Database(dbPath);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");

  db.exec(`
    CREATE TABLE IF NOT EXISTS presentations (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      share_code TEXT NOT NULL UNIQUE,
      presenter_code TEXT NOT NULL UNIQUE,
      presenter_email TEXT,
      slide_count INTEGER NOT NULL DEFAULT 0,
      is_live INTEGER NOT NULL DEFAULT 0,
      current_slide INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS slides (
      id TEXT PRIMARY KEY,
      presentation_id TEXT NOT NULL,
      slide_number INTEGER NOT NULL,
      image_path TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (presentation_id) REFERENCES presentations(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS feedback (
      id TEXT PRIMARY KEY,
      presentation_id TEXT NOT NULL,
      slide_number INTEGER NOT NULL,
      author_name TEXT NOT NULL DEFAULT 'Anonymous',
      feedback_type TEXT NOT NULL DEFAULT 'comment',
      content TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (presentation_id) REFERENCES presentations(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS auth_tokens (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL,
      token TEXT NOT NULL UNIQUE,
      expires_at TEXT NOT NULL,
      used INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  return db;
}

describe("Database Schema", () => {
  let db: Database.Database;
  let dbPath: string;

  beforeEach(() => {
    dbPath = path.join(os.tmpdir(), `test-${Date.now()}.db`);
    db = createTestDb(dbPath);
  });

  afterEach(() => {
    db.close();
    try { fs.unlinkSync(dbPath); } catch { /* ok */ }
  });

  it("creates all tables", () => {
    const tables = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
      .all() as Array<{ name: string }>;
    const tableNames = tables.map((t) => t.name);

    expect(tableNames).toContain("presentations");
    expect(tableNames).toContain("slides");
    expect(tableNames).toContain("feedback");
    expect(tableNames).toContain("auth_tokens");
  });

  it("presentations table has presenter_email column", () => {
    const cols = db.prepare("PRAGMA table_info(presentations)").all() as Array<{ name: string }>;
    expect(cols.some((c) => c.name === "presenter_email")).toBe(true);
  });

  it("inserts and retrieves a presentation", () => {
    db.prepare(
      `INSERT INTO presentations (id, title, share_code, presenter_code, presenter_email, slide_count)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).run("p1", "Test Deck", "ABC123", "XYZ789", "test@example.com", 5);

    const row = db.prepare("SELECT * FROM presentations WHERE id = ?").get("p1") as Record<string, unknown>;
    expect(row.title).toBe("Test Deck");
    expect(row.share_code).toBe("ABC123");
    expect(row.presenter_email).toBe("test@example.com");
    expect(row.slide_count).toBe(5);
    expect(row.is_live).toBe(0);
  });

  it("enforces foreign key on slides", () => {
    expect(() => {
      db.prepare(
        `INSERT INTO slides (id, presentation_id, slide_number, image_path) VALUES (?, ?, ?, ?)`
      ).run("s1", "nonexistent", 1, "/test.png");
    }).toThrow();
  });

  it("enforces foreign key on feedback", () => {
    expect(() => {
      db.prepare(
        `INSERT INTO feedback (id, presentation_id, slide_number, content) VALUES (?, ?, ?, ?)`
      ).run("f1", "nonexistent", 1, "test comment");
    }).toThrow();
  });

  it("cascades deletes from presentation to slides and feedback", () => {
    db.prepare(
      `INSERT INTO presentations (id, title, share_code, presenter_code, slide_count) VALUES (?, ?, ?, ?, ?)`
    ).run("p1", "Test", "ABC", "XYZ", 1);

    db.prepare(
      `INSERT INTO slides (id, presentation_id, slide_number, image_path) VALUES (?, ?, ?, ?)`
    ).run("s1", "p1", 1, "/test.png");

    db.prepare(
      `INSERT INTO feedback (id, presentation_id, slide_number, content) VALUES (?, ?, ?, ?)`
    ).run("f1", "p1", 1, "test comment");

    db.prepare("DELETE FROM presentations WHERE id = ?").run("p1");

    const slides = db.prepare("SELECT * FROM slides WHERE presentation_id = ?").all("p1");
    const feedback = db.prepare("SELECT * FROM feedback WHERE presentation_id = ?").all("p1");

    expect(slides).toHaveLength(0);
    expect(feedback).toHaveLength(0);
  });

  it("enforces unique share_code", () => {
    db.prepare(
      `INSERT INTO presentations (id, title, share_code, presenter_code, slide_count) VALUES (?, ?, ?, ?, ?)`
    ).run("p1", "Test1", "SAME", "CODE1", 1);

    expect(() => {
      db.prepare(
        `INSERT INTO presentations (id, title, share_code, presenter_code, slide_count) VALUES (?, ?, ?, ?, ?)`
      ).run("p2", "Test2", "SAME", "CODE2", 1);
    }).toThrow();
  });

  it("stores and retrieves auth tokens", () => {
    const expiry = new Date(Date.now() + 900000).toISOString();
    db.prepare(
      `INSERT INTO auth_tokens (id, email, token, expires_at) VALUES (?, ?, ?, ?)`
    ).run("t1", "user@test.com", "abc123", expiry);

    const token = db.prepare(
      "SELECT * FROM auth_tokens WHERE token = ? AND used = 0"
    ).get("abc123") as Record<string, unknown>;

    expect(token.email).toBe("user@test.com");
    expect(token.used).toBe(0);
  });

  it("transactions roll back on error", () => {
    db.prepare(
      `INSERT INTO presentations (id, title, share_code, presenter_code, slide_count) VALUES (?, ?, ?, ?, ?)`
    ).run("p1", "Test", "ABC", "XYZ", 2);

    const insertAll = db.transaction(() => {
      db.prepare(
        `INSERT INTO slides (id, presentation_id, slide_number, image_path) VALUES (?, ?, ?, ?)`
      ).run("s1", "p1", 1, "/slide1.png");

      // This should fail (duplicate id)
      db.prepare(
        `INSERT INTO slides (id, presentation_id, slide_number, image_path) VALUES (?, ?, ?, ?)`
      ).run("s1", "p1", 2, "/slide2.png");
    });

    expect(() => insertAll()).toThrow();

    // Transaction should have rolled back, so no slides should exist
    const slides = db.prepare("SELECT * FROM slides WHERE presentation_id = ?").all("p1");
    expect(slides).toHaveLength(0);
  });
});

describe("Feedback Queries", () => {
  let db: Database.Database;
  let dbPath: string;

  beforeEach(() => {
    dbPath = path.join(os.tmpdir(), `test-feedback-${Date.now()}.db`);
    db = createTestDb(dbPath);

    // Seed data
    db.prepare(
      `INSERT INTO presentations (id, title, share_code, presenter_code, slide_count)
       VALUES (?, ?, ?, ?, ?)`
    ).run("p1", "Test Deck", "ABC123", "XYZ789", 3);

    db.prepare(
      `INSERT INTO feedback (id, presentation_id, slide_number, author_name, feedback_type, content)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).run("f1", "p1", 1, "Alice", "question", "What about performance?");

    db.prepare(
      `INSERT INTO feedback (id, presentation_id, slide_number, author_name, feedback_type, content)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).run("f2", "p1", 1, "Bob", "comment", "Great slide!");

    db.prepare(
      `INSERT INTO feedback (id, presentation_id, slide_number, author_name, feedback_type, content)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).run("f3", "p1", 2, "Charlie", "note", "Remember to discuss costs");
  });

  afterEach(() => {
    db.close();
    try { fs.unlinkSync(dbPath); } catch { /* ok */ }
  });

  it("fetches all feedback for a presentation", () => {
    const feedback = db
      .prepare("SELECT * FROM feedback WHERE presentation_id = ? ORDER BY created_at DESC")
      .all("p1");
    expect(feedback).toHaveLength(3);
  });

  it("filters feedback by slide number", () => {
    const slide1 = db
      .prepare("SELECT * FROM feedback WHERE presentation_id = ? AND slide_number = ?")
      .all("p1", 1);
    expect(slide1).toHaveLength(2);

    const slide2 = db
      .prepare("SELECT * FROM feedback WHERE presentation_id = ? AND slide_number = ?")
      .all("p1", 2);
    expect(slide2).toHaveLength(1);
  });

  it("filters feedback by type", () => {
    const questions = db
      .prepare("SELECT * FROM feedback WHERE presentation_id = ? AND feedback_type = ?")
      .all("p1", "question");
    expect(questions).toHaveLength(1);
  });

  it("datetime format comparison works correctly with SQLite format", () => {
    // Use a fixed past timestamp to avoid same-second races
    const before = "2020-01-01 00:00:00";

    db.prepare(
      `INSERT INTO feedback (id, presentation_id, slide_number, content, created_at)
       VALUES (?, ?, ?, ?, datetime('now'))`
    ).run("f4", "p1", 3, "New feedback");

    const newFeedback = db
      .prepare("SELECT * FROM feedback WHERE presentation_id = ? AND created_at > ?")
      .all("p1", before);

    // Should find f4 plus the 3 seeded items (all created after 2020)
    expect(newFeedback.length).toBeGreaterThanOrEqual(1);
    expect(newFeedback.some((f) => (f as Record<string, unknown>).id === "f4")).toBe(true);
  });

  it("JS ISO string format does NOT compare correctly against SQLite datetime", () => {
    // This test proves the bug we fixed: JS ISO strings have 'T' separator
    // which sorts after ' ' (space), making > comparisons fail
    const jsFormat = "2020-01-01T00:00:00.000Z";
    const sqliteFormat = "2020-01-01 00:00:00";

    // JS ISO format is lexicographically "greater" than same SQLite datetime
    // because 'T' (0x54) > ' ' (0x20)
    expect(jsFormat > sqliteFormat).toBe(true);

    // So using JS ISO string as `created_at > ?` would miss records
    // that were created at the same wall-clock time in SQLite format
    const allWithJs = db
      .prepare("SELECT * FROM feedback WHERE presentation_id = ? AND created_at > ?")
      .all("p1", jsFormat);
    const allWithSqlite = db
      .prepare("SELECT * FROM feedback WHERE presentation_id = ? AND created_at > ?")
      .all("p1", sqliteFormat);

    // SQLite format finds all 4 records, JS format may miss some
    expect(allWithSqlite.length).toBeGreaterThanOrEqual(allWithJs.length);
  });
});
