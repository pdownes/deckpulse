import Database from "better-sqlite3";
import path from "path";

const DB_PATH = path.join(process.cwd(), "deckpulse.db");

let db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (!db) {
    db = new Database(DB_PATH);
    db.pragma("journal_mode = WAL");
    db.pragma("foreign_keys = ON");
    initializeDb(db);
  }
  return db;
}

function initializeDb(db: Database.Database) {
  // Core tables
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

    CREATE INDEX IF NOT EXISTS idx_feedback_presentation ON feedback(presentation_id);
    CREATE INDEX IF NOT EXISTS idx_feedback_slide ON feedback(presentation_id, slide_number);
    CREATE INDEX IF NOT EXISTS idx_slides_presentation ON slides(presentation_id);
    CREATE INDEX IF NOT EXISTS idx_presentations_share_code ON presentations(share_code);
    CREATE INDEX IF NOT EXISTS idx_presentations_presenter_code ON presentations(presenter_code);
    CREATE INDEX IF NOT EXISTS idx_auth_tokens_token ON auth_tokens(token);
    CREATE INDEX IF NOT EXISTS idx_auth_tokens_email ON auth_tokens(email);
  `);

  // Migration: add presenter_email column if missing (existing databases)
  const cols = db.prepare("PRAGMA table_info(presentations)").all() as Array<{ name: string }>;
  if (!cols.some((c) => c.name === "presenter_email")) {
    db.exec("ALTER TABLE presentations ADD COLUMN presenter_email TEXT");
  }

  // Create index after migration ensures the column exists
  db.exec(`CREATE INDEX IF NOT EXISTS idx_presentations_email ON presentations(presenter_email)`);
}
