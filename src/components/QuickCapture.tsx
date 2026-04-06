"use client";

import { useState, useRef, useCallback } from "react";
import LatexRenderer from "./LatexRenderer";

interface QuickCaptureProps {
  onCreated?: () => void;
  linkTo?: string | null;
  placeholder?: string;
}

export default function QuickCapture({ onCreated, linkTo = null, placeholder }: QuickCaptureProps) {
  const [text, setText] = useState("");
  const [source, setSource] = useState("");
  const [showSource, setShowSource] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const submit = useCallback(async () => {
    if (!text.trim() || submitting) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/questions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: text.trim(),
          source: source.trim() || undefined,
          link_to: linkTo,
        }),
      });
      if (res.ok) {
        setText("");
        setSource("");
        setShowSource(false);
        onCreated?.();
      }
    } finally {
      setSubmitting(false);
      textareaRef.current?.focus();
    }
  }, [text, source, linkTo, submitting, onCreated]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      submit();
    }
  };

  return (
    <div className="w-full rounded-lg border border-zinc-200 bg-white p-3 shadow-sm dark:border-zinc-700 dark:bg-zinc-900">
      <textarea
        ref={textareaRef}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder || "What's your question? (Ctrl+Enter to save)"}
        className="w-full resize-none bg-transparent text-sm outline-none placeholder:text-zinc-400 dark:text-zinc-100"
        rows={2}
        autoFocus
      />

      {text.trim() && (
        <div className="mt-2 rounded border border-zinc-100 bg-zinc-50 p-2 text-sm dark:border-zinc-800 dark:bg-zinc-800/50">
          <LatexRenderer text={text} />
        </div>
      )}

      <div className="mt-2 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowSource(!showSource)}
            className="text-xs text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
          >
            {showSource ? "− source" : "+ source"}
          </button>
        </div>
        <button
          type="button"
          onClick={submit}
          disabled={text.trim().length === 0 || submitting}
          suppressHydrationWarning
          className="rounded-md bg-zinc-900 px-3 py-1 text-xs font-medium text-white transition-colors hover:bg-zinc-700 disabled:opacity-40 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
        >
          {submitting ? "Saving..." : "Save (Ctrl+Enter)"}
        </button>
      </div>

      {showSource && (
        <input
          value={source}
          onChange={(e) => setSource(e.target.value)}
          placeholder="Source (paper, textbook, context...)"
          className="mt-2 w-full rounded border border-zinc-200 bg-transparent px-2 py-1 text-xs outline-none placeholder:text-zinc-400 dark:border-zinc-700"
        />
      )}
    </div>
  );
}
