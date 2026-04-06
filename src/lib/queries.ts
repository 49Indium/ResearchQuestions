import { randomUUID } from "crypto";
import db from "./db";
import { embedQuery, isModelLoaded } from "./embeddings";

export interface Question {
  id: string;
  text: string;
  source: string;
  status: "unanswered" | "answered";
  parent_id: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
  tags?: string[];
}

export interface Note {
  id: string;
  question_id: string;
  content: string;
  created_at: string;
  updated_at: string;
}

// ---- Questions ----

const insertQuestion = db.prepare(`
  INSERT INTO questions (id, text, source) VALUES (?, ?, ?)
`);

const selectQuestions = db.prepare(`
  SELECT * FROM questions ORDER BY sort_order ASC LIMIT ? OFFSET ?
`);

const selectQuestionsByStatus = db.prepare(`
  SELECT * FROM questions WHERE status = ? ORDER BY sort_order ASC LIMIT ? OFFSET ?
`);

const selectQuestionById = db.prepare(`
  SELECT * FROM questions WHERE id = ?
`);

const updateQuestionStatus = db.prepare(`
  UPDATE questions SET status = ?, updated_at = datetime('now') WHERE id = ?
`);

const updateQuestionText = db.prepare(`
  UPDATE questions SET text = ?, source = ?, updated_at = datetime('now') WHERE id = ?
`);

const deleteQuestionById = db.prepare(`
  DELETE FROM questions WHERE id = ?
`);

const selectRelatedQuestions = db.prepare(`
  SELECT q.* FROM questions q
  JOIN related_questions rq ON (rq.question_id_1 = q.id OR rq.question_id_2 = q.id)
  WHERE (rq.question_id_1 = ? OR rq.question_id_2 = ?) AND q.id != ?
  ORDER BY q.created_at ASC
`);

const insertRelatedQuestion = db.prepare(`
  INSERT OR IGNORE INTO related_questions (question_id_1, question_id_2) VALUES (?, ?)
`);

const deleteRelatedQuestion = db.prepare(`
  DELETE FROM related_questions WHERE (question_id_1 = ? AND question_id_2 = ?) OR (question_id_1 = ? AND question_id_2 = ?)
`);

const shiftSortOrders = db.prepare(`UPDATE questions SET sort_order = sort_order + 1`);

export function createQuestion(text: string, source: string = ""): Question {
  shiftSortOrders.run();
  const id = randomUUID();
  insertQuestion.run(id, text, source);
  return getQuestion(id)!;
}

export function listQuestions(limit: number = 50, offset: number = 0, status?: string): Question[] {
  const rows = status
    ? (selectQuestionsByStatus.all(status, limit, offset) as Question[])
    : (selectQuestions.all(limit, offset) as Question[]);
  return rows.map((q) => ({ ...q, tags: getTagsForQuestion(q.id) }));
}

export function getQuestion(id: string): Question | undefined {
  const q = selectQuestionById.get(id) as Question | undefined;
  if (q) {
    q.tags = getTagsForQuestion(q.id);
  }
  return q;
}

export function updateQuestion(id: string, updates: { text?: string; source?: string; status?: string }) {
  if (updates.status) {
    updateQuestionStatus.run(updates.status, id);
  }
  if (updates.text !== undefined || updates.source !== undefined) {
    const current = getQuestion(id);
    if (current) {
      updateQuestionText.run(
        updates.text ?? current.text,
        updates.source ?? current.source,
        id
      );
    }
  }
  return getQuestion(id);
}

export function deleteQuestion(id: string) {
  return deleteQuestionById.run(id);
}

export function getRelatedQuestions(questionId: string): Question[] {
  return (selectRelatedQuestions.all(questionId, questionId, questionId) as Question[]).map((q) => ({
    ...q,
    tags: getTagsForQuestion(q.id),
  }));
}

export function linkQuestions(id1: string, id2: string) {
  const lo = id1 < id2 ? id1 : id2;
  const hi = id1 < id2 ? id2 : id1;
  insertRelatedQuestion.run(lo, hi);
}

export function unlinkQuestions(id1: string, id2: string) {
  deleteRelatedQuestion.run(id1, id2, id2, id1);
}

// ---- Reorder ----

const updateSortOrder = db.prepare(`UPDATE questions SET sort_order = ? WHERE id = ?`);

export function reorderQuestions(orderedIds: string[]) {
  const txn = db.transaction(() => {
    for (let i = 0; i < orderedIds.length; i++) {
      updateSortOrder.run(i, orderedIds[i]);
    }
  });
  txn();
}

// ---- Tags ----

const insertTag = db.prepare(`INSERT OR IGNORE INTO tags (id, name) VALUES (?, ?)`);
const selectTagByName = db.prepare(`SELECT id FROM tags WHERE name = ? COLLATE NOCASE`);
const insertQuestionTag = db.prepare(`INSERT OR IGNORE INTO question_tags (question_id, tag_id) VALUES (?, ?)`);
const selectTagsForQuestion = db.prepare(`
  SELECT t.name FROM tags t
  JOIN question_tags qt ON qt.tag_id = t.id
  WHERE qt.question_id = ?
  ORDER BY t.name
`);
const selectAllTags = db.prepare(`SELECT name FROM tags ORDER BY name`);
const deleteQuestionTags = db.prepare(`DELETE FROM question_tags WHERE question_id = ?`);

export function getTagsForQuestion(questionId: string): string[] {
  return (selectTagsForQuestion.all(questionId) as { name: string }[]).map((t) => t.name);
}

export function setTagsForQuestion(questionId: string, tags: string[]) {
  deleteQuestionTags.run(questionId);
  for (const tag of tags) {
    const trimmed = tag.trim().toLowerCase();
    if (!trimmed) continue;
    insertTag.run(randomUUID(), trimmed);
    const row = selectTagByName.get(trimmed) as { id: string };
    insertQuestionTag.run(questionId, row.id);
  }
}

export function getAllTags(): string[] {
  return (selectAllTags.all() as { name: string }[]).map((t) => t.name);
}

// ---- Notes ----

const insertNote = db.prepare(`INSERT INTO notes (id, question_id, content) VALUES (?, ?, ?)`);
const selectNotesForQuestion = db.prepare(`
  SELECT * FROM notes WHERE question_id = ? ORDER BY created_at ASC
`);
const deleteNoteById = db.prepare(`DELETE FROM notes WHERE id = ?`);
const updateNoteById = db.prepare(`UPDATE notes SET content = ?, updated_at = datetime('now') WHERE id = ?`);

export function createNote(questionId: string, content: string): Note {
  const id = randomUUID();
  insertNote.run(id, questionId, content);
  return {
    id,
    question_id: questionId,
    content,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

export function getNotesForQuestion(questionId: string): Note[] {
  return selectNotesForQuestion.all(questionId) as Note[];
}

export function deleteNote(id: string) {
  return deleteNoteById.run(id);
}

export function updateNote(id: string, content: string): Note | undefined {
  updateNoteById.run(content, id);
  return db.prepare(`SELECT * FROM notes WHERE id = ?`).get(id) as Note | undefined;
}

// ---- Search ----

const searchQuestionsFts = db.prepare(`
  SELECT q.* FROM questions q
  JOIN questions_fts fts ON fts.id = q.id
  WHERE questions_fts MATCH ?
  ORDER BY rank
  LIMIT ?
`);

const searchNotesFts = db.prepare(`
  SELECT n.*, q.text as question_text FROM notes n
  JOIN notes_fts fts ON fts.id = n.id
  JOIN questions q ON q.id = n.question_id
  WHERE notes_fts MATCH ?
  ORDER BY rank
  LIMIT ?
`);

function ftsPrefix(query: string): string {
  const tokens = query.trim().split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return query;
  tokens[tokens.length - 1] += "*";
  return tokens.join(" ");
}

export function searchQuestions(query: string, limit: number = 50): Question[] {
  try {
    return (searchQuestionsFts.all(ftsPrefix(query), limit) as Question[]).map((q) => ({
      ...q,
      tags: getTagsForQuestion(q.id),
    }));
  } catch {
    return [];
  }
}

export function searchNotes(query: string, limit: number = 50) {
  try {
    return searchNotesFts.all(ftsPrefix(query), limit);
  } catch {
    return [];
  }
}

// ---- Vector search ----

export function searchQuestionsVector(queryEmbedding: Float32Array, limit: number = 50): Question[] {
  try {
    const rows = db.prepare(`
      SELECT q.* FROM vec_questions v
      JOIN questions q ON q.id = v.question_id
      WHERE v.embedding MATCH ?
      AND k = ?
      ORDER BY distance
    `).all(Buffer.from(queryEmbedding.buffer), limit) as Question[];
    return rows.map((q) => ({
      ...q,
      tags: getTagsForQuestion(q.id),
    }));
  } catch {
    return [];
  }
}

export function searchNotesVector(queryEmbedding: Float32Array, limit: number = 50) {
  try {
    return db.prepare(`
      SELECT n.*, q.text as question_text FROM vec_notes v
      JOIN notes n ON n.id = v.note_id
      JOIN questions q ON q.id = n.question_id
      WHERE v.embedding MATCH ?
      AND k = ?
      ORDER BY distance
    `).all(Buffer.from(queryEmbedding.buffer), limit);
  } catch {
    return [];
  }
}

// ---- Hybrid search (RRF) ----

export interface HybridResults<T> {
  items: T[];
  ftsCount: number;
}

function mergeHybrid<T extends { id: string }>(ftsResults: T[], vecResults: T[], limit: number = 50): HybridResults<T> {
  const ftsIds = new Set(ftsResults.map((r) => r.id));

  // FTS results first (in their original rank order), then semantic-only
  const seen = new Set<string>();
  const ftsItems: T[] = [];
  const semanticItems: T[] = [];

  for (const item of ftsResults) {
    if (!seen.has(item.id)) {
      seen.add(item.id);
      ftsItems.push(item);
    }
  }

  for (const item of vecResults) {
    if (!seen.has(item.id) && !ftsIds.has(item.id)) {
      seen.add(item.id);
      semanticItems.push(item);
    }
  }

  const items = [...ftsItems, ...semanticItems].slice(0, limit);
  return { items, ftsCount: ftsItems.length };
}

// Vector search on notes, returning parent question IDs ranked by best note match
function searchQuestionsByNoteVectors(queryEmbedding: Float32Array, limit: number = 50): { questionId: string; rank: number }[] {
  try {
    const rows = db.prepare(`
      SELECT n.question_id FROM vec_notes v
      JOIN notes n ON n.id = v.note_id
      WHERE v.embedding MATCH ?
      AND k = ?
      ORDER BY distance
    `).all(Buffer.from(queryEmbedding.buffer), limit) as { question_id: string }[];

    // Deduplicate by question_id, keeping best rank
    const seen = new Set<string>();
    const results: { questionId: string; rank: number }[] = [];
    for (let i = 0; i < rows.length; i++) {
      if (!seen.has(rows[i].question_id)) {
        seen.add(rows[i].question_id);
        results.push({ questionId: rows[i].question_id, rank: results.length });
      }
    }
    return results;
  } catch {
    return [];
  }
}

export async function hybridSearchQuestions(query: string, limit: number = 50, noteWeight: number = 0.3): Promise<HybridResults<Question>> {
  const ftsResults = searchQuestions(query, limit);

  const modelReady = await isModelLoaded();
  if (!modelReady) return { items: ftsResults, ftsCount: ftsResults.length };

  try {
    const queryVec = await embedQuery(query);
    const vecResults = searchQuestionsVector(queryVec, limit);

    // If noteWeight is 0, skip note search entirely
    if (noteWeight <= 0) {
      return mergeHybrid(ftsResults, vecResults, limit);
    }

    const noteHits = searchQuestionsByNoteVectors(queryVec, limit);

    // Score semantic results: question vector rank + weighted note rank
    const k = 60;
    const ftsIds = new Set(ftsResults.map((q) => q.id));
    const scores = new Map<string, { score: number; item: Question }>();

    // Score from question vectors
    for (let i = 0; i < vecResults.length; i++) {
      const q = vecResults[i];
      scores.set(q.id, { score: 1 / (k + i + 1), item: q });
    }

    // Add weighted score from note vectors
    for (const { questionId, rank } of noteHits) {
      const existing = scores.get(questionId);
      const noteScore = noteWeight / (k + rank + 1);
      if (existing) {
        existing.score += noteScore;
      } else {
        // Question only matched via notes — need to fetch it
        const q = getQuestion(questionId);
        if (q) {
          scores.set(questionId, { score: noteScore, item: q });
        }
      }
    }

    // Sort semantic results by combined score
    const rankedSemantic = [...scores.values()]
      .filter((s) => !ftsIds.has(s.item.id))
      .sort((a, b) => b.score - a.score)
      .map((s) => s.item);

    // FTS first, then ranked semantic
    const seen = new Set<string>();
    const ftsItems: Question[] = [];
    for (const item of ftsResults) {
      if (!seen.has(item.id)) {
        seen.add(item.id);
        ftsItems.push(item);
      }
    }
    const semanticItems: Question[] = [];
    for (const item of rankedSemantic) {
      if (!seen.has(item.id)) {
        seen.add(item.id);
        semanticItems.push(item);
      }
    }

    const items = [...ftsItems, ...semanticItems].slice(0, limit);
    return { items, ftsCount: ftsItems.length };
  } catch {
    return { items: ftsResults, ftsCount: ftsResults.length };
  }
}

export async function hybridSearchNotes(query: string, limit: number = 50): Promise<HybridResults<{ id: string } & Record<string, unknown>>> {
  const ftsResults = searchNotes(query, limit) as ({ id: string } & Record<string, unknown>)[];

  const modelReady = await isModelLoaded();
  if (!modelReady) return { items: ftsResults, ftsCount: ftsResults.length };

  try {
    const queryVec = await embedQuery(query);
    const vecResults = searchNotesVector(queryVec, limit) as ({ id: string } & Record<string, unknown>)[];
    return mergeHybrid(ftsResults, vecResults, limit);
  } catch {
    return { items: ftsResults, ftsCount: ftsResults.length };
  }
}
