import { NextRequest, NextResponse } from "next/server";
import { getQuestion, getNotesForQuestion } from "@/lib/queries";

export async function POST(request: NextRequest) {
  const { ids } = await request.json();

  if (!Array.isArray(ids) || ids.length === 0) {
    return NextResponse.json({ error: "ids required" }, { status: 400 });
  }

  const results = ids
    .map((id: string) => {
      const question = getQuestion(id);
      if (!question) return null;
      const notes = getNotesForQuestion(id);
      return { ...question, notes };
    })
    .filter(Boolean);

  return NextResponse.json(results);
}
