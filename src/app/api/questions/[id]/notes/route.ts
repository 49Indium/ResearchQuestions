import { NextRequest, NextResponse } from "next/server";
import { getNotesForQuestion, createNote, getQuestion } from "@/lib/queries";
import { embedNoteAsync } from "@/lib/embeddings";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const notes = getNotesForQuestion(id);
  return NextResponse.json(notes);
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await request.json();

  if (!body.content || typeof body.content !== "string" || !body.content.trim()) {
    return NextResponse.json({ error: "content is required" }, { status: 400 });
  }

  const note = createNote(id, body.content.trim());

  const question = getQuestion(id);
  embedNoteAsync(note.id, body.content.trim(), question?.text || "");

  return NextResponse.json(note, { status: 201 });
}
