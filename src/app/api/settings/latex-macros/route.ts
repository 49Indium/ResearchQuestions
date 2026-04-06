import { NextResponse } from "next/server";
import db from "@/lib/db";

export function GET() {
  const row = db.prepare("SELECT value FROM settings WHERE key = 'latex_macros'").get() as
    | { value: string }
    | undefined;

  const macros = row ? JSON.parse(row.value) : {};
  return NextResponse.json(macros);
}

export async function PUT(request: Request) {
  const macros = await request.json();

  // Validate: must be a plain object with string keys and string values
  if (
    typeof macros !== "object" ||
    macros === null ||
    Array.isArray(macros) ||
    !Object.entries(macros).every(
      ([k, v]) => typeof k === "string" && typeof v === "string"
    )
  ) {
    return NextResponse.json({ error: "Invalid macros format" }, { status: 400 });
  }

  db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)").run(
    "latex_macros",
    JSON.stringify(macros)
  );

  return NextResponse.json(macros);
}
