import { NextRequest, NextResponse } from "next/server";
import { searchQuestions, searchNotes } from "@/lib/queries";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q");
  const limit = parseInt(searchParams.get("limit") || "50");

  if (!query || !query.trim()) {
    return NextResponse.json({ questions: [], notes: [] });
  }

  const questions = searchQuestions(query.trim(), limit);
  const notes = searchNotes(query.trim(), limit);

  return NextResponse.json({ questions, notes });
}
