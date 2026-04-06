import { NextRequest, NextResponse } from "next/server";
import { getQuestion, updateQuestion, deleteQuestion, setTagsForQuestion } from "@/lib/queries";
import { embedQuestionAsync } from "@/lib/embeddings";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const question = getQuestion(id);
  if (!question) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  return NextResponse.json(question);
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await request.json();

  const existing = getQuestion(id);
  if (!existing) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const updated = updateQuestion(id, body);

  if (body.tags && Array.isArray(body.tags)) {
    setTagsForQuestion(id, body.tags);
  }

  if (body.text !== undefined || body.source !== undefined || body.tags) {
    const fresh = updated!;
    embedQuestionAsync(id, fresh.text, fresh.source, fresh.tags || []);
  }

  return NextResponse.json(updated);
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  deleteQuestion(id);
  return NextResponse.json({ ok: true });
}
