import Database from "better-sqlite3";
import * as sqliteVec from "sqlite-vec";
import path from "path";
import fs from "fs";

const DB_DIR = path.join(process.cwd(), "data");
const DB_PATH = path.join(DB_DIR, "questions.db");

if (!fs.existsSync(DB_DIR)) {
  fs.mkdirSync(DB_DIR, { recursive: true });
}

const db = new Database(DB_PATH);

// Performance pragmas
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

// Load sqlite-vec extension
sqliteVec.load(db);

// Detect if this is an old integer-ID database that needs migration
const _tableInfo = db.prepare("PRAGMA table_info(questions)").all() as { name: string; type: string }[];
const _idCol = _tableInfo.find((c) => c.name === "id");
const needsMigration = _tableInfo.length > 0 && _idCol?.type !== "TEXT";

if (needsMigration) {
  console.warn("[db] Old integer-ID schema detected. Run 'npx tsx scripts/migrate-to-uuid.ts' to migrate.");
}

// Schema creation — UUID-based primary keys for sync compatibility
db.exec(`
  CREATE TABLE IF NOT EXISTS questions (
    id TEXT PRIMARY KEY,
    text TEXT NOT NULL,
    source TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'unanswered'
      CHECK(status IN ('unanswered', 'answered')),
    parent_id TEXT REFERENCES questions(id) ON DELETE SET NULL,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_questions_status ON questions(status);
  CREATE INDEX IF NOT EXISTS idx_questions_parent ON questions(parent_id);
  CREATE INDEX IF NOT EXISTS idx_questions_created ON questions(created_at DESC);

  CREATE TABLE IF NOT EXISTS tags (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE COLLATE NOCASE,
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS question_tags (
    question_id TEXT NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
    tag_id TEXT NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
    PRIMARY KEY (question_id, tag_id)
  );

  CREATE TABLE IF NOT EXISTS notes (
    id TEXT PRIMARY KEY,
    question_id TEXT NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_notes_question ON notes(question_id);

  CREATE TABLE IF NOT EXISTS related_questions (
    question_id_1 TEXT NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
    question_id_2 TEXT NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    PRIMARY KEY (question_id_1, question_id_2),
    CHECK (question_id_1 < question_id_2)
  );

  CREATE INDEX IF NOT EXISTS idx_related_q1 ON related_questions(question_id_1);
  CREATE INDEX IF NOT EXISTS idx_related_q2 ON related_questions(question_id_2);
`);

// FTS5 tables — standalone (not content-linked) since TEXT PKs don't work with content_rowid
try {
  db.exec(`
    CREATE VIRTUAL TABLE questions_fts USING fts5(
      id UNINDEXED, text, source,
      tokenize='unicode61 remove_diacritics 2'
    );
  `);
} catch {
  // Table already exists
}

try {
  db.exec(`
    CREATE VIRTUAL TABLE notes_fts USING fts5(
      id UNINDEXED, content,
      tokenize='unicode61 remove_diacritics 2'
    );
  `);
} catch {
  // Table already exists
}

if (!needsMigration) {
  // FTS sync triggers — maintain standalone FTS tables
  const triggers = `
    CREATE TRIGGER IF NOT EXISTS questions_ai AFTER INSERT ON questions BEGIN
      INSERT INTO questions_fts(id, text, source) VALUES (new.id, new.text, new.source);
    END;

    CREATE TRIGGER IF NOT EXISTS questions_ad AFTER DELETE ON questions BEGIN
      DELETE FROM questions_fts WHERE id = old.id;
    END;

    CREATE TRIGGER IF NOT EXISTS questions_au AFTER UPDATE ON questions BEGIN
      DELETE FROM questions_fts WHERE id = old.id;
      INSERT INTO questions_fts(id, text, source) VALUES (new.id, new.text, new.source);
    END;

    CREATE TRIGGER IF NOT EXISTS notes_ai AFTER INSERT ON notes BEGIN
      INSERT INTO notes_fts(id, content) VALUES (new.id, new.content);
    END;

    CREATE TRIGGER IF NOT EXISTS notes_ad AFTER DELETE ON notes BEGIN
      DELETE FROM notes_fts WHERE id = old.id;
    END;

    CREATE TRIGGER IF NOT EXISTS notes_au AFTER UPDATE ON notes BEGIN
      DELETE FROM notes_fts WHERE id = old.id;
      INSERT INTO notes_fts(id, content) VALUES (new.id, new.content);
    END;
  `;

  db.exec(triggers);
}

// Vector tables for semantic search
try {
  db.exec(`
    CREATE VIRTUAL TABLE vec_questions USING vec0(
      question_id TEXT PRIMARY KEY,
      embedding float[768]
    );
  `);
} catch {
  // Table already exists
}

try {
  db.exec(`
    CREATE VIRTUAL TABLE vec_notes USING vec0(
      note_id TEXT PRIMARY KEY,
      embedding float[768]
    );
  `);
} catch {
  // Table already exists
}

// Settings table (key-value store)
db.exec(`
  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);

// Add updated_at to settings if missing (pre-migration databases)
try {
  db.exec("ALTER TABLE settings ADD COLUMN updated_at TEXT NOT NULL DEFAULT (datetime('now'))");
} catch {
  // Column already exists
}

// Seed default LaTeX macros if not present
const existingMacros = db.prepare("SELECT 1 FROM settings WHERE key = 'latex_macros'").get();
if (!existingMacros) {
  db.prepare("INSERT INTO settings (key, value) VALUES (?, ?)").run(
    "latex_macros",
    JSON.stringify({
      "\\RR": "\\mathbb{R}",
      "\\ZZ": "\\mathbb{Z}",
      "\\QQ": "\\mathbb{Q}",
      "\\CC": "\\mathbb{C}",
      "\\NN": "\\mathbb{N}",
    })
  );
}

export default db;
