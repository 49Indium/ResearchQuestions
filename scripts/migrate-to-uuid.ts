/**
 * Migration script: converts existing integer-ID database to UUID-based schema.
 *
 * Usage: npx tsx scripts/migrate-to-uuid.ts
 *
 * This script:
 * 1. Backs up the database
 * 2. Maps all integer IDs to UUIDs
 * 3. Creates new tables with TEXT PKs
 * 4. Copies data with translated IDs
 * 5. Rebuilds FTS indexes
 * 6. Clears vector tables (re-embed after migration)
 */

import Database from "better-sqlite3";
import * as sqliteVec from "sqlite-vec";
import { randomUUID } from "crypto";
import path from "path";
import fs from "fs";

const DB_DIR = path.join(process.cwd(), "data");
const DB_PATH = path.join(DB_DIR, "questions.db");

if (!fs.existsSync(DB_PATH)) {
  console.log("No database found at", DB_PATH);
  console.log("Nothing to migrate. The app will create a new UUID-based database on first run.");
  process.exit(0);
}

// Check if already migrated — if questions.id is TEXT, skip
const checkDb = new Database(DB_PATH);
const tableInfo = checkDb.prepare("PRAGMA table_info(questions)").all() as { name: string; type: string }[];
const idCol = tableInfo.find((c) => c.name === "id");
if (idCol && idCol.type === "TEXT") {
  console.log("Database already uses TEXT primary keys. Nothing to migrate.");
  checkDb.close();
  process.exit(0);
}
checkDb.close();

// Backup
const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
const backupPath = path.join(DB_DIR, `questions.db.backup-${timestamp}`);
fs.copyFileSync(DB_PATH, backupPath);
console.log(`Backed up database to ${backupPath}`);

const db = new Database(DB_PATH);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = OFF"); // disable during migration
sqliteVec.load(db); // needed to drop vec0 tables

// Build ID mappings
const questionMap = new Map<number, string>();
const tagMap = new Map<number, string>();
const noteMap = new Map<number, string>();

const questions = db.prepare("SELECT id FROM questions").all() as { id: number }[];
for (const q of questions) {
  questionMap.set(q.id, randomUUID());
}
console.log(`Mapped ${questionMap.size} questions`);

const tags = db.prepare("SELECT id FROM tags").all() as { id: number }[];
for (const t of tags) {
  tagMap.set(t.id, randomUUID());
}
console.log(`Mapped ${tagMap.size} tags`);

const notes = db.prepare("SELECT id FROM notes").all() as { id: number }[];
for (const n of notes) {
  noteMap.set(n.id, randomUUID());
}
console.log(`Mapped ${noteMap.size} notes`);

// Run migration in a transaction
const migrate = db.transaction(() => {
  // 1. Drop FTS tables and triggers (they reference old schema)
  db.exec("DROP TRIGGER IF EXISTS questions_ai");
  db.exec("DROP TRIGGER IF EXISTS questions_ad");
  db.exec("DROP TRIGGER IF EXISTS questions_au");
  db.exec("DROP TRIGGER IF EXISTS notes_ai");
  db.exec("DROP TRIGGER IF EXISTS notes_ad");
  db.exec("DROP TRIGGER IF EXISTS notes_au");
  db.exec("DROP TABLE IF EXISTS questions_fts");
  db.exec("DROP TABLE IF EXISTS notes_fts");

  // 2. Drop vector tables
  db.exec("DROP TABLE IF EXISTS vec_questions");
  db.exec("DROP TABLE IF EXISTS vec_notes");

  // 3. Create new tables
  db.exec(`
    CREATE TABLE questions_new (
      id TEXT PRIMARY KEY,
      text TEXT NOT NULL,
      source TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'unanswered'
        CHECK(status IN ('unanswered', 'answered')),
      parent_id TEXT,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE tags_new (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL UNIQUE COLLATE NOCASE,
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE question_tags_new (
      question_id TEXT NOT NULL,
      tag_id TEXT NOT NULL,
      PRIMARY KEY (question_id, tag_id)
    );

    CREATE TABLE notes_new (
      id TEXT PRIMARY KEY,
      question_id TEXT NOT NULL,
      content TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE related_questions_new (
      question_id_1 TEXT NOT NULL,
      question_id_2 TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      PRIMARY KEY (question_id_1, question_id_2),
      CHECK (question_id_1 < question_id_2)
    );

    CREATE TABLE settings_new (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  // 5. Copy data with UUID translation
  const insertQ = db.prepare(`
    INSERT INTO questions_new (id, text, source, status, parent_id, sort_order, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const oldQuestions = db.prepare("SELECT * FROM questions").all() as {
    id: number; text: string; source: string; status: string;
    parent_id: number | null; sort_order: number; created_at: string; updated_at: string;
  }[];
  for (const q of oldQuestions) {
    insertQ.run(
      questionMap.get(q.id)!,
      q.text,
      q.source,
      q.status,
      q.parent_id ? (questionMap.get(q.parent_id) ?? null) : null,
      q.sort_order,
      q.created_at,
      q.updated_at
    );
  }
  console.log(`  Migrated ${oldQuestions.length} questions`);

  const insertT = db.prepare("INSERT INTO tags_new (id, name) VALUES (?, ?)");
  const oldTags = db.prepare("SELECT * FROM tags").all() as { id: number; name: string }[];
  for (const t of oldTags) {
    insertT.run(tagMap.get(t.id)!, t.name);
  }
  console.log(`  Migrated ${oldTags.length} tags`);

  const insertQT = db.prepare("INSERT INTO question_tags_new (question_id, tag_id) VALUES (?, ?)");
  const oldQTs = db.prepare("SELECT * FROM question_tags").all() as { question_id: number; tag_id: number }[];
  for (const qt of oldQTs) {
    const qUuid = questionMap.get(qt.question_id);
    const tUuid = tagMap.get(qt.tag_id);
    if (qUuid && tUuid) {
      insertQT.run(qUuid, tUuid);
    }
  }
  console.log(`  Migrated ${oldQTs.length} question_tags`);

  const insertN = db.prepare(`
    INSERT INTO notes_new (id, question_id, content, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?)
  `);
  const oldNotes = db.prepare("SELECT * FROM notes").all() as {
    id: number; question_id: number; content: string; created_at: string;
  }[];
  for (const n of oldNotes) {
    const qUuid = questionMap.get(n.question_id);
    if (qUuid) {
      insertN.run(noteMap.get(n.id)!, qUuid, n.content, n.created_at, n.created_at);
    }
  }
  console.log(`  Migrated ${oldNotes.length} notes`);

  const insertRQ = db.prepare("INSERT INTO related_questions_new (question_id_1, question_id_2, created_at) VALUES (?, ?, ?)");
  const oldRQs = db.prepare("SELECT * FROM related_questions").all() as {
    question_id_1: number; question_id_2: number; created_at: string;
  }[];
  for (const rq of oldRQs) {
    const uuid1 = questionMap.get(rq.question_id_1);
    const uuid2 = questionMap.get(rq.question_id_2);
    if (uuid1 && uuid2) {
      // Re-sort since UUID ordering differs from integer ordering
      const lo = uuid1 < uuid2 ? uuid1 : uuid2;
      const hi = uuid1 < uuid2 ? uuid2 : uuid1;
      insertRQ.run(lo, hi, rq.created_at);
    }
  }
  console.log(`  Migrated ${oldRQs.length} related_questions`);

  // Copy settings as-is (key is already TEXT)
  const insertS = db.prepare("INSERT INTO settings_new (key, value) VALUES (?, ?)");
  const oldSettings = db.prepare("SELECT * FROM settings").all() as { key: string; value: string }[];
  for (const s of oldSettings) {
    insertS.run(s.key, s.value);
  }
  console.log(`  Migrated ${oldSettings.length} settings`);

  // 6. Drop old tables and rename new ones
  db.exec("DROP TABLE IF EXISTS question_tags");
  db.exec("DROP TABLE IF EXISTS related_questions");
  db.exec("DROP TABLE IF EXISTS notes");
  db.exec("DROP TABLE IF EXISTS tags");
  db.exec("DROP TABLE IF EXISTS questions");
  db.exec("DROP TABLE IF EXISTS settings");

  db.exec("ALTER TABLE questions_new RENAME TO questions");
  db.exec("ALTER TABLE tags_new RENAME TO tags");
  db.exec("ALTER TABLE question_tags_new RENAME TO question_tags");
  db.exec("ALTER TABLE notes_new RENAME TO notes");
  db.exec("ALTER TABLE related_questions_new RENAME TO related_questions");
  db.exec("ALTER TABLE settings_new RENAME TO settings");

  // 7. Recreate indexes
  db.exec(`
    CREATE INDEX idx_questions_status ON questions(status);
    CREATE INDEX idx_questions_parent ON questions(parent_id);
    CREATE INDEX idx_questions_created ON questions(created_at DESC);
    CREATE INDEX idx_notes_question ON notes(question_id);
    CREATE INDEX idx_related_q1 ON related_questions(question_id_1);
    CREATE INDEX idx_related_q2 ON related_questions(question_id_2);
  `);
});

console.log("\nRunning migration...");
migrate();
console.log("\nMigration complete!");

db.close();

console.log("\nNext steps:");
console.log("  1. Start the app with 'npm run dev' — it will create FTS/vec/sync tables automatically");
console.log("  2. Run 'npx tsx scripts/backfill-embeddings.ts' to regenerate vector embeddings");
console.log(`  3. Your backup is at: ${backupPath}`);
