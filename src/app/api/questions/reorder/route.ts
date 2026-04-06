import { NextRequest, NextResponse } from "next/server";
import { reorderQuestions } from "@/lib/queries";

export async function PUT(request: NextRequest) {
  const body = await request.json();
  const { orderedIds } = body;

  if (!Array.isArray(orderedIds) || orderedIds.some((id) => typeof id !== "string")) {
    return NextResponse.json({ error: "orderedIds must be an array of strings" }, { status: 400 });
  }

  reorderQuestions(orderedIds);
  return NextResponse.json({ ok: true });
}
