import { NextRequest, NextResponse } from "next/server";
import { hybridSearchQuestions, hybridSearchNotes } from "@/lib/queries";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q");
  const limit = parseInt(searchParams.get("limit") || "50");
  const noteWeight = parseFloat(searchParams.get("noteWeight") || "0.3");

  if (!query || !query.trim()) {
    return NextResponse.json({ questions: [], notes: [], ftsQuestionCount: 0, ftsNoteCount: 0 });
  }

  const [qResults, nResults] = await Promise.all([
    hybridSearchQuestions(query.trim(), limit, noteWeight),
    hybridSearchNotes(query.trim(), limit),
  ]);

  return NextResponse.json({
    questions: qResults.items,
    notes: nResults.items,
    ftsQuestionCount: qResults.ftsCount,
    ftsNoteCount: nResults.ftsCount,
  });
}
