"use client";

import Link from "next/link";
import LatexRenderer from "./LatexRenderer";
import StatusBadge from "./StatusBadge";
import type { Question } from "@/lib/queries";

interface QuestionCardProps {
  question: Question;
}

export default function QuestionCard({ question }: QuestionCardProps) {
  return (
    <Link
      href={`/q/${question.id}`}
      className="block rounded-lg border border-zinc-200 p-4 transition-colors hover:border-zinc-300 hover:bg-zinc-50 dark:border-zinc-700 dark:hover:border-zinc-600 dark:hover:bg-zinc-800/50"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="text-sm leading-relaxed dark:text-zinc-100">
            <LatexRenderer text={question.text} />
          </div>
          {question.source && (
            <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
              {question.source}
            </p>
          )}
          {question.tags && question.tags.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {question.tags.map((tag) => (
                <span
                  key={tag}
                  className="rounded bg-zinc-100 px-1.5 py-0.5 text-[10px] text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <StatusBadge status={question.status} />
          <time className="text-[10px] text-zinc-400">
            {new Date(question.created_at).toLocaleDateString()}
          </time>
        </div>
      </div>
    </Link>
  );
}
