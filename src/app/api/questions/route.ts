import { NextRequest, NextResponse } from "next/server";
import { createQuestion, listQuestions, setTagsForQuestion, getChildQuestions } from "@/lib/queries";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const limit = parseInt(searchParams.get("limit") || "50");
  const offset = parseInt(searchParams.get("offset") || "0");
  const status = searchParams.get("status") || undefined;
  const parentId = searchParams.get("parent_id");

  if (parentId) {
    const children = getChildQuestions(parseInt(parentId));
    return NextResponse.json(children);
  }

  const questions = listQuestions(limit, offset, status);
  return NextResponse.json(questions);
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { text, source, parent_id, tags } = body;

  if (!text || typeof text !== "string" || !text.trim()) {
    return NextResponse.json({ error: "text is required" }, { status: 400 });
  }

  const question = createQuestion(text.trim(), source || "", parent_id || null);

  if (tags && Array.isArray(tags) && tags.length > 0) {
    setTagsForQuestion(question.id, tags);
    question.tags = tags;
  }

  return NextResponse.json(question, { status: 201 });
}
