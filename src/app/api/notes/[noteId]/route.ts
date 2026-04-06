import { NextRequest, NextResponse } from "next/server";
import { deleteNote, updateNote } from "@/lib/queries";

export async function PUT(request: NextRequest, { params }: { params: Promise<{ noteId: string }> }) {
  const { noteId } = await params;
  const body = await request.json();

  if (!body.content || typeof body.content !== "string" || !body.content.trim()) {
    return NextResponse.json({ error: "content is required" }, { status: 400 });
  }

  const note = updateNote(noteId, body.content.trim());
  if (!note) {
    return NextResponse.json({ error: "note not found" }, { status: 404 });
  }
  return NextResponse.json(note);
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ noteId: string }> }) {
  const { noteId } = await params;
  deleteNote(noteId);
  return NextResponse.json({ ok: true });
}
