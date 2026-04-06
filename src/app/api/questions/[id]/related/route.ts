import { NextRequest, NextResponse } from "next/server";
import { getRelatedQuestions, linkQuestions, unlinkQuestions, getQuestion } from "@/lib/queries";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const related = getRelatedQuestions(id);
  return NextResponse.json(related);
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await request.json();
  const { related_id } = body;

  if (!related_id || related_id === id) {
    return NextResponse.json({ error: "invalid related_id" }, { status: 400 });
  }

  const target = getQuestion(related_id);
  if (!target) {
    return NextResponse.json({ error: "question not found" }, { status: 404 });
  }

  linkQuestions(id, related_id);
  return NextResponse.json({ ok: true }, { status: 201 });
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { searchParams } = new URL(request.url);
  const relatedId = searchParams.get("related_id") || "";

  if (!relatedId) {
    return NextResponse.json({ error: "related_id required" }, { status: 400 });
  }

  unlinkQuestions(id, relatedId);
  return NextResponse.json({ ok: true });
}
