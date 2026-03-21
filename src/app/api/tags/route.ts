import { NextResponse } from "next/server";
import { getAllTags } from "@/lib/queries";

export async function GET() {
  const tags = getAllTags();
  return NextResponse.json(tags);
}
