import db from "./db";

export interface Question {
  id: number;
  text: string;
  source: string;
  status: "unanswered" | "in-progress" | "answered";
  parent_id: number | null;
  created_at: string;
  updated_at: string;
  tags?: string[];
}

export interface Note {
  id: number;
  question_id: number;
  content: string;
  created_at: string;
}

export interface ClaudeConversation {
  id: number;
  question_id: number;
  messages: { role: string; content: string; timestamp: string }[];
  created_at: string;
  updated_at: string;
}

// ---- Questions ----

const insertQuestion = db.prepare(`
  INSERT INTO questions (text, source, parent_id) VALUES (?, ?, ?)
`);

const selectQuestions = db.prepare(`
  SELECT * FROM questions ORDER BY created_at DESC LIMIT ? OFFSET ?
`);

const selectQuestionsByStatus = db.prepare(`
  SELECT * FROM questions WHERE status = ? ORDER BY created_at DESC LIMIT ? OFFSET ?
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

const selectChildQuestions = db.prepare(`
  SELECT * FROM questions WHERE parent_id = ? ORDER BY created_at ASC
`);

export function createQuestion(text: string, source: string = "", parentId: number | null = null): Question {
  const result = insertQuestion.run(text, source, parentId);
  return getQuestion(result.lastInsertRowid as number)!;
}

export function listQuestions(limit: number = 50, offset: number = 0, status?: string): Question[] {
  const rows = status
    ? (selectQuestionsByStatus.all(status, limit, offset) as Question[])
    : (selectQuestions.all(limit, offset) as Question[]);
  return rows.map((q) => ({ ...q, tags: getTagsForQuestion(q.id) }));
}

export function getQuestion(id: number): Question | undefined {
  const q = selectQuestionById.get(id) as Question | undefined;
  if (q) {
    q.tags = getTagsForQuestion(q.id);
  }
  return q;
}

export function updateQuestion(id: number, updates: { text?: string; source?: string; status?: string }) {
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

export function deleteQuestion(id: number) {
  return deleteQuestionById.run(id);
}

export function getChildQuestions(parentId: number): Question[] {
  return selectChildQuestions.all(parentId) as Question[];
}

// ---- Tags ----

const insertTag = db.prepare(`INSERT OR IGNORE INTO tags (name) VALUES (?)`);
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

export function getTagsForQuestion(questionId: number): string[] {
  return (selectTagsForQuestion.all(questionId) as { name: string }[]).map((t) => t.name);
}

export function setTagsForQuestion(questionId: number, tags: string[]) {
  deleteQuestionTags.run(questionId);
  for (const tag of tags) {
    const trimmed = tag.trim().toLowerCase();
    if (!trimmed) continue;
    insertTag.run(trimmed);
    const row = selectTagByName.get(trimmed) as { id: number };
    insertQuestionTag.run(questionId, row.id);
  }
}

export function getAllTags(): string[] {
  return (selectAllTags.all() as { name: string }[]).map((t) => t.name);
}

// ---- Notes ----

const insertNote = db.prepare(`INSERT INTO notes (question_id, content) VALUES (?, ?)`);
const selectNotesForQuestion = db.prepare(`
  SELECT * FROM notes WHERE question_id = ? ORDER BY created_at ASC
`);
const deleteNoteById = db.prepare(`DELETE FROM notes WHERE id = ?`);

export function createNote(questionId: number, content: string): Note {
  const result = insertNote.run(questionId, content);
  return { id: result.lastInsertRowid as number, question_id: questionId, content, created_at: new Date().toISOString() };
}

export function getNotesForQuestion(questionId: number): Note[] {
  return selectNotesForQuestion.all(questionId) as Note[];
}

export function deleteNote(id: number) {
  return deleteNoteById.run(id);
}

// ---- Search ----

const searchQuestionsFts = db.prepare(`
  SELECT q.* FROM questions q
  JOIN questions_fts fts ON fts.rowid = q.id
  WHERE questions_fts MATCH ?
  ORDER BY rank
  LIMIT ?
`);

const searchNotesFts = db.prepare(`
  SELECT n.*, q.text as question_text FROM notes n
  JOIN notes_fts fts ON fts.rowid = n.id
  JOIN questions q ON q.id = n.question_id
  WHERE notes_fts MATCH ?
  ORDER BY rank
  LIMIT ?
`);

export function searchQuestions(query: string, limit: number = 50): Question[] {
  try {
    return (searchQuestionsFts.all(query, limit) as Question[]).map((q) => ({
      ...q,
      tags: getTagsForQuestion(q.id),
    }));
  } catch {
    return [];
  }
}

export function searchNotes(query: string, limit: number = 50) {
  try {
    return searchNotesFts.all(query, limit);
  } catch {
    return [];
  }
}

// ---- Claude Conversations ----

const insertConversation = db.prepare(`
  INSERT INTO claude_conversations (question_id, messages) VALUES (?, ?)
`);
const selectConversation = db.prepare(`
  SELECT * FROM claude_conversations WHERE question_id = ? ORDER BY created_at DESC LIMIT 1
`);
const updateConversationMessages = db.prepare(`
  UPDATE claude_conversations SET messages = ?, updated_at = datetime('now') WHERE id = ?
`);

export function getOrCreateConversation(questionId: number): ClaudeConversation {
  let conv = selectConversation.get(questionId) as (Omit<ClaudeConversation, "messages"> & { messages: string }) | undefined;
  if (!conv) {
    const result = insertConversation.run(questionId, "[]");
    conv = { id: result.lastInsertRowid as number, question_id: questionId, messages: "[]", created_at: new Date().toISOString(), updated_at: new Date().toISOString() };
  }
  return { ...conv, messages: JSON.parse(conv.messages) };
}

export function appendMessage(conversationId: number, role: string, content: string) {
  const conv = db.prepare(`SELECT messages FROM claude_conversations WHERE id = ?`).get(conversationId) as { messages: string } | undefined;
  if (!conv) return;
  const messages = JSON.parse(conv.messages);
  messages.push({ role, content, timestamp: new Date().toISOString() });
  updateConversationMessages.run(JSON.stringify(messages), conversationId);
}
