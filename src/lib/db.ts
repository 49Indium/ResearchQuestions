import Database from "better-sqlite3";
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

// Schema creation
db.exec(`
  CREATE TABLE IF NOT EXISTS questions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    text TEXT NOT NULL,
    source TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'unanswered'
      CHECK(status IN ('unanswered', 'in-progress', 'answered')),
    parent_id INTEGER REFERENCES questions(id) ON DELETE SET NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_questions_status ON questions(status);
  CREATE INDEX IF NOT EXISTS idx_questions_parent ON questions(parent_id);
  CREATE INDEX IF NOT EXISTS idx_questions_created ON questions(created_at DESC);

  CREATE TABLE IF NOT EXISTS tags (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE COLLATE NOCASE
  );

  CREATE TABLE IF NOT EXISTS question_tags (
    question_id INTEGER NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
    tag_id INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
    PRIMARY KEY (question_id, tag_id)
  );

  CREATE TABLE IF NOT EXISTS notes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    question_id INTEGER NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_notes_question ON notes(question_id);

  CREATE TABLE IF NOT EXISTS claude_conversations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    question_id INTEGER NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
    messages TEXT NOT NULL DEFAULT '[]',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_claude_convos_question ON claude_conversations(question_id);
`);

// FTS5 tables — wrapped in try/catch since CREATE VIRTUAL TABLE doesn't support IF NOT EXISTS cleanly
try {
  db.exec(`
    CREATE VIRTUAL TABLE questions_fts USING fts5(
      text, source,
      content=questions,
      content_rowid=id,
      tokenize='unicode61 remove_diacritics 2'
    );
  `);
} catch {
  // Table already exists
}

try {
  db.exec(`
    CREATE VIRTUAL TABLE notes_fts USING fts5(
      content,
      content=notes,
      content_rowid=id,
      tokenize='unicode61 remove_diacritics 2'
    );
  `);
} catch {
  // Table already exists
}

// FTS sync triggers
const triggers = `
  CREATE TRIGGER IF NOT EXISTS questions_ai AFTER INSERT ON questions BEGIN
    INSERT INTO questions_fts(rowid, text, source) VALUES (new.id, new.text, new.source);
  END;

  CREATE TRIGGER IF NOT EXISTS questions_ad AFTER DELETE ON questions BEGIN
    INSERT INTO questions_fts(questions_fts, rowid, text, source) VALUES ('delete', old.id, old.text, old.source);
  END;

  CREATE TRIGGER IF NOT EXISTS questions_au AFTER UPDATE ON questions BEGIN
    INSERT INTO questions_fts(questions_fts, rowid, text, source) VALUES ('delete', old.id, old.text, old.source);
    INSERT INTO questions_fts(rowid, text, source) VALUES (new.id, new.text, new.source);
  END;

  CREATE TRIGGER IF NOT EXISTS notes_ai AFTER INSERT ON notes BEGIN
    INSERT INTO notes_fts(rowid, content) VALUES (new.id, new.content);
  END;

  CREATE TRIGGER IF NOT EXISTS notes_ad AFTER DELETE ON notes BEGIN
    INSERT INTO notes_fts(notes_fts, rowid, content) VALUES ('delete', old.id, old.content);
  END;

  CREATE TRIGGER IF NOT EXISTS notes_au AFTER UPDATE ON notes BEGIN
    INSERT INTO notes_fts(notes_fts, rowid, content) VALUES ('delete', old.id, old.content);
    INSERT INTO notes_fts(rowid, content) VALUES (new.id, new.content);
  END;
`;

db.exec(triggers);

export default db;
