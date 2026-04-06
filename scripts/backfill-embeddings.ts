import Database from "better-sqlite3";
import * as sqliteVec from "sqlite-vec";
import path from "path";
import { pipeline, type FeatureExtractionPipeline } from "@huggingface/transformers";

// Cache models in data/models alongside the DB
if (!process.env.TRANSFORMERS_CACHE) {
  process.env.TRANSFORMERS_CACHE = path.join(process.cwd(), "data", "models");
}

const DB_PATH = path.join(process.cwd(), "data", "questions.db");
const MODEL_ID = "nomic-ai/nomic-embed-text-v1.5";

function stripLatex(text: string): string {
  let s = text;
  s = s.replace(/\$\$([\s\S]*?)\$\$/g, "$1");
  s = s.replace(/\$(.*?)\$/g, "$1");
  s = s.replace(/\\frac\{([^}]*)\}\{([^}]*)\}/g, "$1/$2");
  s = s.replace(/\\math(?:frak|bb|cal|scr|rm)\{([^}]*)\}/g, "$1");
  s = s.replace(/\\([a-zA-Z]+)/g, "$1");
  s = s.replace(/\s+/g, " ").trim();
  return s;
}

async function main() {
  console.log("Opening database...");
  const db = new Database(DB_PATH);
  sqliteVec.load(db);

  console.log("Loading embedding model (this may download ~135MB on first run)...");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pipe = await (pipeline as any)("feature-extraction", MODEL_ID, {
    dtype: "q8",
    revision: "main",
  }) as FeatureExtractionPipeline;

  async function embed(text: string): Promise<Float32Array> {
    const output = await pipe(text, { pooling: "mean", normalize: true });
    return new Float32Array(output.data as Float64Array);
  }

  const deleteQuestion = db.prepare(`DELETE FROM vec_questions WHERE question_id = ?`);
  const insertQuestion = db.prepare(`INSERT INTO vec_questions (question_id, embedding) VALUES (?, ?)`);
  const deleteNote = db.prepare(`DELETE FROM vec_notes WHERE note_id = ?`);
  const insertNote = db.prepare(`INSERT INTO vec_notes (note_id, embedding) VALUES (?, ?)`);

  // Backfill questions
  const questions = db.prepare(`
    SELECT q.id, q.text, q.source, GROUP_CONCAT(t.name, ', ') as tags
    FROM questions q
    LEFT JOIN question_tags qt ON qt.question_id = q.id
    LEFT JOIN tags t ON t.id = qt.tag_id
    GROUP BY q.id
  `).all() as { id: string; text: string; source: string; tags: string | null }[];

  console.log(`Embedding ${questions.length} questions...`);
  for (let i = 0; i < questions.length; i++) {
    const q = questions[i];
    const parts = [stripLatex(q.text)];
    if (q.source) parts.push(q.source);
    if (q.tags) parts.push(q.tags);
    const prepared = "search_document: " + parts.join(" | ");

    const vec = await embed(prepared);
    deleteQuestion.run(q.id);
    insertQuestion.run(q.id, Buffer.from(vec.buffer));

    if ((i + 1) % 10 === 0 || i === questions.length - 1) {
      console.log(`  Questions: ${i + 1}/${questions.length}`);
    }
  }

  // Backfill notes
  const notes = db.prepare(`
    SELECT n.id, n.content, q.text as question_text
    FROM notes n
    JOIN questions q ON q.id = n.question_id
  `).all() as { id: string; content: string; question_text: string }[];

  console.log(`Embedding ${notes.length} notes...`);
  for (let i = 0; i < notes.length; i++) {
    const n = notes[i];
    const prepared = "search_document: " + stripLatex(n.content) + " | " + stripLatex(n.question_text);

    const vec = await embed(prepared);
    deleteNote.run(n.id);
    insertNote.run(n.id, Buffer.from(vec.buffer));

    if ((i + 1) % 10 === 0 || i === notes.length - 1) {
      console.log(`  Notes: ${i + 1}/${notes.length}`);
    }
  }

  console.log("Done!");
  db.close();
}

main().catch(console.error);
