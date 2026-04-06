import { NextRequest, NextResponse } from "next/server";
import { createQuestion, setTagsForQuestion, updateQuestion, createNote } from "@/lib/queries";
import { embedQuestionAsync, embedNoteAsync } from "@/lib/embeddings";

interface ImportNote {
  content: string;
}

interface ImportQuestion {
  text: string;
  source?: string;
  status?: "unanswered" | "answered";
  tags?: string[];
  notes?: ImportNote[];
}

interface ImportPayload {
  version: number;
  questions: ImportQuestion[];
}

export async function POST(request: NextRequest) {
  const body = (await request.json()) as ImportPayload;

  if (!body.questions || !Array.isArray(body.questions) || body.questions.length === 0) {
    return NextResponse.json({ error: "No questions to import" }, { status: 400 });
  }

  let imported = 0;

  for (const q of body.questions) {
    if (!q.text || typeof q.text !== "string" || !q.text.trim()) continue;

    const question = createQuestion(q.text.trim(), q.source || "");

    if (q.status === "answered") {
      updateQuestion(question.id, { status: "answered" });
    }

    const tags = q.tags && Array.isArray(q.tags) ? q.tags : [];
    if (tags.length > 0) {
      setTagsForQuestion(question.id, tags);
    }

    embedQuestionAsync(question.id, q.text.trim(), q.source || "", tags);

    if (q.notes && Array.isArray(q.notes)) {
      for (const note of q.notes) {
        if (note.content && typeof note.content === "string" && note.content.trim()) {
          const created = createNote(question.id, note.content.trim());
          embedNoteAsync(created.id, note.content.trim(), q.text.trim());
        }
      }
    }

    imported++;
  }

  return NextResponse.json({ imported }, { status: 201 });
}
