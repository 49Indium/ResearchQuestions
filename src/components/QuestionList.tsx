"use client";

import useSWR from "swr";
import { useState } from "react";
import QuestionCard from "./QuestionCard";
import type { Question } from "@/lib/queries";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

interface QuestionListProps {
  refreshKey?: number;
}

export default function QuestionList({ refreshKey }: QuestionListProps) {
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [search, setSearch] = useState("");

  const isSearching = search.trim().length > 0;

  const questionsUrl = statusFilter
    ? `/api/questions?status=${statusFilter}`
    : `/api/questions`;

  const searchUrl = `/api/search?q=${encodeURIComponent(search.trim())}`;

  const { data: questions } = useSWR<Question[]>(
    isSearching ? null : [questionsUrl, refreshKey],
    ([url]: [string]) => fetcher(url)
  );

  const { data: searchResults } = useSWR(
    isSearching ? [searchUrl, refreshKey] : null,
    ([url]: [string]) => fetcher(url)
  );

  const displayQuestions: Question[] = isSearching
    ? searchResults?.questions || []
    : questions || [];

  const statuses = [
    { value: "", label: "All" },
    { value: "unanswered", label: "Unanswered" },
    { value: "in-progress", label: "In Progress" },
    { value: "answered", label: "Answered" },
  ];

  return (
    <div className="space-y-3">
      {/* Search + filters */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search questions... (Ctrl+K)"
          className="flex-1 rounded-md border border-zinc-200 bg-transparent px-3 py-1.5 text-sm outline-none placeholder:text-zinc-400 focus:border-zinc-400 dark:border-zinc-700 dark:focus:border-zinc-500"
        />
        <div className="flex gap-1">
          {statuses.map((s) => (
            <button
              key={s.value}
              onClick={() => setStatusFilter(s.value)}
              className={`rounded-md px-2 py-1 text-xs font-medium transition-colors ${
                statusFilter === s.value
                  ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                  : "text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {/* Question list */}
      {displayQuestions.length === 0 ? (
        <p className="py-8 text-center text-sm text-zinc-400">
          {isSearching ? "No results found." : "No questions yet. Add one above!"}
        </p>
      ) : (
        <div className="space-y-2">
          {displayQuestions.map((q) => (
            <QuestionCard key={q.id} question={q} />
          ))}
        </div>
      )}
    </div>
  );
}
