import { NextRequest, NextResponse } from "next/server";
import { getNotesForQuestion, createNote } from "@/lib/queries";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const notes = getNotesForQuestion(parseInt(id));
  return NextResponse.json(notes);
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await request.json();

  if (!body.content || typeof body.content !== "string" || !body.content.trim()) {
    return NextResponse.json({ error: "content is required" }, { status: 400 });
  }

  const note = createNote(parseInt(id), body.content.trim());
  return NextResponse.json(note, { status: 201 });
}
