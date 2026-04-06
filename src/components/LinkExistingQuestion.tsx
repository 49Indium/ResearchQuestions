"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import LatexRenderer from "./LatexRenderer";
import type { Question } from "@/lib/queries";

interface LinkExistingQuestionProps {
  currentQuestionId: string;
  existingChildIds: string[];
  onLinked: () => void;
  onCancel: () => void;
}

export default function LinkExistingQuestion({
  currentQuestionId,
  existingChildIds,
  onLinked,
  onCancel,
}: LinkExistingQuestionProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Question[]>([]);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const search = useCallback(
    (q: string) => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (!q.trim()) {
        setResults([]);
        return;
      }
      debounceRef.current = setTimeout(async () => {
        setLoading(true);
        try {
          const res = await fetch(`/api/search?q=${encodeURIComponent(q)}&limit=10`);
          const data = await res.json();
          const questions = (data.questions as Question[]).filter(
            (r) => r.id !== currentQuestionId && !existingChildIds.includes(r.id)
          );
          setResults(questions);
        } catch {
          setResults([]);
        } finally {
          setLoading(false);
        }
      }, 200);
    },
    [currentQuestionId, existingChildIds]
  );

  const linkQuestion = async (targetId: string) => {
    await fetch(`/api/questions/${currentQuestionId}/related`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ related_id: targetId }),
    });
    onLinked();
  };

  return (
    <div className="rounded border border-zinc-200 bg-white p-2 dark:border-zinc-700 dark:bg-zinc-900">
      <input
        ref={inputRef}
        type="text"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          search(e.target.value);
        }}
        onKeyDown={(e) => {
          if (e.key === "Escape") onCancel();
        }}
        placeholder="Search questions to link..."
        className="w-full rounded border border-zinc-200 bg-transparent px-2 py-1.5 text-sm outline-none focus:border-zinc-400 dark:border-zinc-700 dark:focus:border-zinc-500"
      />
      {loading && <p className="mt-1 text-xs text-zinc-400">Searching...</p>}
      {results.length > 0 && (
        <ul className="mt-1 max-h-48 overflow-y-auto">
          {results.map((q) => (
            <li key={q.id}>
              <button
                onClick={() => linkQuestion(q.id)}
                className="w-full rounded px-2 py-1.5 text-left text-sm hover:bg-zinc-100 dark:hover:bg-zinc-800"
              >
                <LatexRenderer text={q.text} />
                {q.source && (
                  <span className="ml-1 text-[10px] text-zinc-400">{q.source}</span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
      {query.trim() && !loading && results.length === 0 && (
        <p className="mt-1 text-xs text-zinc-400">No matching questions found.</p>
      )}
    </div>
  );
}
