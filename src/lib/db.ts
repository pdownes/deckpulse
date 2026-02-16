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
  db.exec(`
    CREATE TABLE IF NOT EXISTS presentations (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      share_code TEXT NOT NULL UNIQUE,
      presenter_code TEXT NOT NULL UNIQUE,
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

    CREATE INDEX IF NOT EXISTS idx_feedback_presentation ON feedback(presentation_id);
    CREATE INDEX IF NOT EXISTS idx_feedback_slide ON feedback(presentation_id, slide_number);
    CREATE INDEX IF NOT EXISTS idx_slides_presentation ON slides(presentation_id);
    CREATE INDEX IF NOT EXISTS idx_presentations_share_code ON presentations(share_code);
    CREATE INDEX IF NOT EXISTS idx_presentations_presenter_code ON presentations(presenter_code);
  `);
}
