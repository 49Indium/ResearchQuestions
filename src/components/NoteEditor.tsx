"use client";

import { useState } from "react";
import LatexRenderer from "./LatexRenderer";

interface NoteEditorProps {
  questionId: string;
  onCreated?: () => void;
}

export default function NoteEditor({ questionId, onCreated }: NoteEditorProps) {
  const [content, setContent] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  const submit = async () => {
    if (!content.trim() || submitting) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/questions/${questionId}/notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: content.trim() }),
      });
      if (res.ok) {
        setContent("");
        setShowPreview(false);
        onCreated?.();
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      submit();
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-xs font-medium text-zinc-500">Add note</label>
        {content.trim() && (
          <button
            type="button"
            onClick={() => setShowPreview(!showPreview)}
            className="text-[10px] text-zinc-400 hover:text-zinc-600"
          >
            {showPreview ? "Edit" : "Preview"}
          </button>
        )}
      </div>

      {showPreview ? (
        <div className="min-h-[60px] rounded border border-zinc-200 p-2 text-sm dark:border-zinc-700">
          <LatexRenderer text={content} />
        </div>
      ) : (
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Add a note (markdown + LaTeX)... Ctrl+Enter to save"
          className="w-full resize-none rounded border border-zinc-200 bg-transparent p-2 text-sm outline-none placeholder:text-zinc-400 focus:border-zinc-400 dark:border-zinc-700 dark:focus:border-zinc-500"
          rows={3}
        />
      )}

      {content.trim() && (
        <button
          type="button"
          onClick={submit}
          disabled={submitting}
          className="rounded-md bg-zinc-900 px-3 py-1 text-xs font-medium text-white hover:bg-zinc-700 disabled:opacity-40 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
        >
          {submitting ? "Saving..." : "Add Note"}
        </button>
      )}
    </div>
  );
}
