"use client";

import { Suspense, useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import LatexRenderer from "@/components/LatexRenderer";
import type { Question, Note } from "@/lib/queries";

interface QuestionWithNotes extends Question {
  notes: Note[];
}

export default function PrintPreviewPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto w-full max-w-3xl px-4 py-6">
          <p className="text-sm text-zinc-400">Loading...</p>
        </div>
      }
    >
      <PrintPreview />
    </Suspense>
  );
}

function PrintPreview() {
  const searchParams = useSearchParams();
  const [data, setData] = useState<QuestionWithNotes[] | null>(null);

  useEffect(() => {
    const idsParam = searchParams.get("ids");
    if (!idsParam) return;
    const ids = idsParam.split(",").filter(Boolean);
    if (ids.length === 0) return;

    fetch("/api/questions/batch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids }),
    })
      .then((r) => r.json())
      .then(setData);
  }, [searchParams]);

  if (!data) {
    return (
      <div className="mx-auto w-full max-w-3xl px-4 py-6">
        <p className="text-sm text-zinc-400">Loading...</p>
      </div>
    );
  }

  return (
    <div className="print-page">
      {/* Controls - hidden when printing */}
      <div className="no-print mx-auto w-full max-w-3xl px-4 py-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => window.close()}
            className="text-xs text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
          >
            &larr; Close
          </button>
          <button
            onClick={() => window.print()}
            className="rounded bg-zinc-900 px-4 py-1.5 text-xs font-medium text-white dark:bg-zinc-100 dark:text-zinc-900"
          >
            Print / Save PDF
          </button>
          <span className="text-xs text-zinc-400">
            {data.length} question{data.length !== 1 ? "s" : ""}
          </span>
        </div>
      </div>

      {/* Print content */}
      <div className="print-content mx-auto w-full max-w-3xl px-4 py-2">
        <h1 className="print-title mb-6 text-lg font-semibold dark:text-zinc-100">
          Research Questions
        </h1>
        <div className="space-y-6">
          {data.map((q, idx) => (
            <div key={q.id} className="print-question">
              <div className="mb-1 flex items-baseline gap-2">
                <span className="text-sm font-medium text-zinc-500">
                  {idx + 1}.
                </span>
                <div className="text-sm leading-relaxed dark:text-zinc-100">
                  <LatexRenderer text={q.text} />
                </div>
              </div>
              {q.source && (
                <p className="ml-5 text-xs text-zinc-500 italic">
                  Source: {q.source}
                </p>
              )}
              {q.tags && q.tags.length > 0 && (
                <div className="ml-5 mt-1 flex flex-wrap gap-1">
                  {q.tags.map((tag) => (
                    <span
                      key={tag}
                      className="print-tag rounded bg-zinc-100 px-1.5 py-0.5 text-[10px] text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              )}
              {q.notes.length > 0 && (
                <div className="ml-5 mt-2 space-y-1.5">
                  <p className="text-xs font-medium text-zinc-500">Notes:</p>
                  {q.notes.map((note) => (
                    <div
                      key={note.id}
                      className="print-note border-l-2 border-zinc-200 pl-3 text-sm dark:border-zinc-700"
                    >
                      <LatexRenderer text={note.content} />
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
