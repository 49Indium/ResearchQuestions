import type { FeatureExtractionPipeline } from "@huggingface/transformers";
import path from "path";
import db from "./db";

// Cache models in data/models alongside the DB (gitignored)
if (!process.env.TRANSFORMERS_CACHE) {
  process.env.TRANSFORMERS_CACHE = path.join(process.cwd(), "data", "models");
}

const MODEL_ID = "nomic-ai/nomic-embed-text-v1.5";

// Lazy singleton — survives Next.js HMR in dev
const globalAny = globalThis as unknown as {
  _embedderPromise?: Promise<FeatureExtractionPipeline>;
};

function getEmbedder(): Promise<FeatureExtractionPipeline> {
  if (!globalAny._embedderPromise) {
    globalAny._embedderPromise = (async () => {
      const { pipeline } = await import("@huggingface/transformers");
      const pipe = await pipeline("feature-extraction", MODEL_ID, {
        dtype: "q8",
        revision: "main",
      });
      return pipe;
    })();
  }
  return globalAny._embedderPromise;
}

// Warm the model eagerly on first import
getEmbedder().catch((err) => console.error("[embeddings] model warm-up failed:", err));

// --- Text preparation ---

export function stripLatexForEmbedding(text: string): string {
  let s = text;
  // Remove display math delimiters
  s = s.replace(/\$\$([\s\S]*?)\$\$/g, "$1");
  // Remove inline math delimiters
  s = s.replace(/\$(.*?)\$/g, "$1");
  // \frac{a}{b} → a/b
  s = s.replace(/\\frac\{([^}]*)\}\{([^}]*)\}/g, "$1/$2");
  // \mathfrak{g} → g, \mathbb{R} → R, etc.
  s = s.replace(/\\math(?:frak|bb|cal|scr|rm)\{([^}]*)\}/g, "$1");
  // \ker → ker, \alpha → alpha, etc.
  s = s.replace(/\\([a-zA-Z]+)/g, "$1");
  // Collapse whitespace
  s = s.replace(/\s+/g, " ").trim();
  return s;
}

function prepareQuestionText(text: string, source: string, tags: string[]): string {
  const parts = [stripLatexForEmbedding(text)];
  if (source) parts.push(source);
  if (tags.length > 0) parts.push(tags.join(", "));
  return "search_document: " + parts.join(" | ");
}

function prepareNoteText(content: string, questionText: string): string {
  return "search_document: " + stripLatexForEmbedding(content) + " | " + stripLatexForEmbedding(questionText);
}

// --- Core embedding ---

export async function embed(text: string): Promise<Float32Array> {
  const pipe = await getEmbedder();
  const output = await pipe(text, { pooling: "mean", normalize: true });
  return new Float32Array(output.data as Float64Array);
}

// --- DB upserts (vec0 doesn't support ON CONFLICT, so delete+insert) ---

const deleteQuestionVec = db.prepare(`DELETE FROM vec_questions WHERE question_id = ?`);
const insertQuestionVec = db.prepare(`INSERT INTO vec_questions (question_id, embedding) VALUES (?, ?)`);

const deleteNoteVec = db.prepare(`DELETE FROM vec_notes WHERE note_id = ?`);
const insertNoteVec = db.prepare(`INSERT INTO vec_notes (note_id, embedding) VALUES (?, ?)`);

export function upsertQuestionEmbedding(questionId: string, embedding: Float32Array) {
  deleteQuestionVec.run(questionId);
  insertQuestionVec.run(questionId, Buffer.from(embedding.buffer));
}

export function upsertNoteEmbedding(noteId: string, embedding: Float32Array) {
  deleteNoteVec.run(noteId);
  insertNoteVec.run(noteId, Buffer.from(embedding.buffer));
}

// --- Fire-and-forget wrappers ---

export async function embedQuestionAsync(id: string, text: string, source: string, tags: string[]) {
  try {
    const prepared = prepareQuestionText(text, source, tags);
    const vec = await embed(prepared);
    upsertQuestionEmbedding(id, vec);
  } catch (err) {
    console.error(`[embeddings] failed to embed question ${id}:`, err);
  }
}

export async function embedNoteAsync(noteId: string, content: string, questionText: string) {
  try {
    const prepared = prepareNoteText(content, questionText);
    const vec = await embed(prepared);
    upsertNoteEmbedding(noteId, vec);
  } catch (err) {
    console.error(`[embeddings] failed to embed note ${noteId}:`, err);
  }
}

// --- Status ---

export function isModelReady(): boolean {
  // Check if the promise has resolved by testing a synchronous flag
  return !!globalAny._embedderPromise;
}

export async function isModelLoaded(): Promise<boolean> {
  if (!globalAny._embedderPromise) return false;
  try {
    await globalAny._embedderPromise;
    return true;
  } catch {
    return false;
  }
}

// --- Query embedding ---

export async function embedQuery(text: string): Promise<Float32Array> {
  const cleaned = stripLatexForEmbedding(text);
  return embed("search_query: " + cleaned);
}
