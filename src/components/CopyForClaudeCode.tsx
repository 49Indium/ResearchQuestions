"use client";

import { useState } from "react";
import type { Question, Note } from "@/lib/queries";

interface CopyForClaudeCodeProps {
  question: Question;
  notes: Note[];
  children: Question[];
}

export default function CopyForClaudeCode({ question, notes, children }: CopyForClaudeCodeProps) {
  const [copied, setCopied] = useState(false);

  const format = () => {
    let text = `## Research Question\n${question.text}\n`;

    if (question.source) {
      text += `\n### Source\n${question.source}\n`;
    }

    if (question.tags && question.tags.length > 0) {
      text += `\n### Tags\n${question.tags.join(", ")}\n`;
    }

    if (notes.length > 0) {
      text += `\n### Notes\n`;
      for (const note of notes) {
        text += `- ${note.content}\n`;
      }
    }

    if (children.length > 0) {
      text += `\n### Sub-questions\n`;
      for (const child of children) {
        text += `- ${child.text}\n`;
      }
    }

    return text;
  };

  const copy = async () => {
    await navigator.clipboard.writeText(format());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <button
      type="button"
      onClick={copy}
      className="rounded-md border border-zinc-200 px-3 py-1 text-xs font-medium text-zinc-600 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800"
    >
      {copied ? "Copied!" : "Copy for Claude Code"}
    </button>
  );
}
