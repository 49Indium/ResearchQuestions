import { NextRequest, NextResponse } from "next/server";
import { getQuestion, updateQuestion, deleteQuestion, setTagsForQuestion } from "@/lib/queries";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const question = getQuestion(parseInt(id));
  if (!question) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  return NextResponse.json(question);
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const questionId = parseInt(id);
  const body = await request.json();

  const existing = getQuestion(questionId);
  if (!existing) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const updated = updateQuestion(questionId, body);

  if (body.tags && Array.isArray(body.tags)) {
    setTagsForQuestion(questionId, body.tags);
  }

  return NextResponse.json(updated);
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  deleteQuestion(parseInt(id));
  return NextResponse.json({ ok: true });
}
