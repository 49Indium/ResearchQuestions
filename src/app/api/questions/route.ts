import { NextRequest, NextResponse } from "next/server";
import { createQuestion, listQuestions, setTagsForQuestion, linkQuestions } from "@/lib/queries";
import { embedQuestionAsync } from "@/lib/embeddings";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const limit = parseInt(searchParams.get("limit") || "50");
  const offset = parseInt(searchParams.get("offset") || "0");
  const status = searchParams.get("status") || undefined;

  const questions = listQuestions(limit, offset, status);
  return NextResponse.json(questions);
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { text, source, link_to, tags } = body;

  if (!text || typeof text !== "string" || !text.trim()) {
    return NextResponse.json({ error: "text is required" }, { status: 400 });
  }

  const question = createQuestion(text.trim(), source || "");

  if (link_to) {
    linkQuestions(question.id, link_to);
  }

  if (tags && Array.isArray(tags) && tags.length > 0) {
    setTagsForQuestion(question.id, tags);
    question.tags = tags;
  }

  embedQuestionAsync(question.id, text.trim(), source || "", tags || []);

  return NextResponse.json(question, { status: 201 });
}
