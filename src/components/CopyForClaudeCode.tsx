"use client";

import { useState, useRef, useEffect } from "react";
import type { Question, Note } from "@/lib/queries";

interface CopyForClaudeCodeProps {
  question: Question;
  notes: Note[];
  relatedQuestions: Question[];
}

export default function CopyForClaudeCode({ question, notes, relatedQuestions }: CopyForClaudeCodeProps) {
  const [copied, setCopied] = useState(false);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const buildContext = () => {
    let context = `## Research Question\n${question.text}\n`;
    if (question.source) context += `\n### Source\n${question.source}\n`;
    if (question.tags && question.tags.length > 0) context += `\n### Tags\n${question.tags.join(", ")}\n`;
    if (notes.length > 0) {
      context += `\n### Notes\n`;
      for (const note of notes) context += `- ${note.content}\n`;
    }
    if (relatedQuestions.length > 0) {
      context += `\n### Related Questions\n`;
      for (const child of relatedQuestions) context += `- ${child.text}\n`;
    }
    return context;
  };

  const copy = async (text: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setOpen(false);
    setTimeout(() => setCopied(false), 2000);
  };

  const options = [
    {
      label: "Question only",
      build: () => question.text,
    },
    {
      label: "Question + context",
      build: () => buildContext(),
    },
    {
      label: "Prompt with question",
      build: () =>
        `You are a mathematics research assistant. Below is a research question with its context. Please provide insights, known results, connections to other areas of mathematics, and potential approaches. Use LaTeX notation ($...$ inline, $$...$$ display). Be precise and rigorous.\n\n${buildContext()}`,
    },
    {
      label: "Deep report prompt",
      build: () =>
        `You are a mathematics research assistant. Write a detailed report on the following research question. The report should include:\n\n1. **Background & Definitions** — Define key terms and set up necessary context\n2. **Known Results** — Summarize established theorems, lemmas, and key results related to this question\n3. **Proof Techniques & Approaches** — Outline methods that have been used or could be applied\n4. **Connections** — Relate this question to other areas of mathematics\n5. **Open Problems** — Note any open problems or conjectures in this area\n6. **References** — Suggest key papers, books, or resources for further reading\n\nUse LaTeX notation ($...$ inline, $$...$$ display). Be precise, rigorous, and thorough.\n\n${buildContext()}`,
    },
  ];

  // Default click copies the prompt with question (option index 2)
  const defaultOption = options[2];

  return (
    <div ref={ref} className="relative inline-flex">
      <button
        type="button"
        onClick={() => copy(defaultOption.build())}
        className="rounded-l-md border border-zinc-200 px-3 py-1 text-xs font-medium text-zinc-600 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800"
      >
        {copied ? "Copied!" : "Copy for Claude"}
      </button>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="-ml-px rounded-r-md border border-zinc-200 px-1.5 py-1 text-xs text-zinc-600 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800"
      >
        <svg className="h-3 w-3" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M3 5l3 3 3-3" />
        </svg>
      </button>
      {open && (
        <div className="absolute right-0 top-full z-10 mt-1 min-w-[180px] rounded-md border border-zinc-200 bg-white py-1 shadow-lg dark:border-zinc-700 dark:bg-zinc-900">
          {options.map((opt) => (
            <button
              key={opt.label}
              type="button"
              onClick={() => copy(opt.build())}
              className="block w-full px-3 py-1.5 text-left text-xs text-zinc-600 hover:bg-zinc-50 dark:text-zinc-400 dark:hover:bg-zinc-800"
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
