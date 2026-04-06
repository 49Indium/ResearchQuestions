"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import JSZip from "jszip";
import QuickCapture from "@/components/QuickCapture";
import QuestionList from "@/components/QuestionList";
import KeyboardShortcutHelp from "@/components/KeyboardShortcutHelp";
import LatexPreambleEditor from "@/components/LatexPreambleEditor";
import type { Question, Note } from "@/lib/queries";

interface QuestionWithNotes extends Question {
  notes: Note[];
}

// --- Markdown generation ---

function questionToMarkdown(q: QuestionWithNotes, index?: number): string {
  const lines: string[] = [];

  if (index !== undefined) {
    lines.push(`## ${index + 1}. ${q.text}`);
  } else {
    lines.push(`# ${q.text}`);
  }

  lines.push("");

  if (q.source) {
    lines.push(`*Source: ${q.source}*`);
    lines.push("");
  }

  if (q.tags && q.tags.length > 0) {
    lines.push(`**Tags:** ${q.tags.join(", ")}`);
    lines.push("");
  }

  lines.push(`**Status:** ${q.status}`);
  lines.push("");

  if (q.notes.length > 0) {
    lines.push("### Notes");
    lines.push("");
    for (const note of q.notes) {
      lines.push(note.content);
      lines.push("");
    }
  }

  return lines.join("\n");
}

function allQuestionsToMarkdown(questions: QuestionWithNotes[]): string {
  const lines: string[] = [];
  lines.push("# Research Questions");
  lines.push("");
  lines.push(`*Exported ${new Date().toLocaleDateString()}*`);
  lines.push("");
  lines.push("---");
  lines.push("");

  for (let i = 0; i < questions.length; i++) {
    lines.push(questionToMarkdown(questions[i], i));
    if (i < questions.length - 1) {
      lines.push("---");
      lines.push("");
    }
  }

  return lines.join("\n");
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/\$[^$]*\$/g, "math")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

async function fetchBatch(ids: string[]): Promise<QuestionWithNotes[]> {
  const res = await fetch("/api/questions/batch", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ids }),
  });
  return res.json();
}

const homeShortcuts = [
  {
    title: "Navigation",
    shortcuts: [
      { key: "j / k", description: "Move focus down / up" },
      { key: "Enter", description: "Open focused question" },
      { key: "c", description: "New question (focus capture)" },
      { key: "/", description: "Focus search" },
      { key: "x", description: "Toggle select mode" },
    ],
  },
  {
    title: "Filters",
    shortcuts: [
      { key: "1", description: "Show all questions" },
      { key: "2", description: "Show unanswered" },
      { key: "3", description: "Show answered" },
    ],
  },
  {
    title: "General",
    shortcuts: [
      { key: "?", description: "Show keyboard shortcuts" },
      { key: "Esc", description: "Close dialog / exit select / clear focus" },
      { key: "Ctrl+Enter", description: "Save question" },
    ],
  },
];

export default function Home() {
  const [refreshKey, setRefreshKey] = useState(0);
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState<Map<string, Question>>(new Map());
  const [loading, setLoading] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState("");
  const [showHelp, setShowHelp] = useState(false);
  const [showPreamble, setShowPreamble] = useState(false);
  const [focusedIndex, setFocusedIndex] = useState<number | null>(null);
  const questionCountRef = useRef(0);
  const focusedQuestionIdRef = useRef<string | null>(null);
  const importInputRef = useRef<HTMLInputElement>(null);

  const handleQuestionCount = useCallback((count: number) => {
    questionCountRef.current = count;
  }, []);

  const handleFocusedQuestionId = useCallback((id: string | null) => {
    focusedQuestionIdRef.current = id;
  }, []);

  const refresh = useCallback(() => {
    setRefreshKey((k) => k + 1);
  }, []);

  const toggleSelectMode = useCallback(() => {
    setSelectMode((prev) => {
      if (prev) setSelected(new Map()); // clear on exit
      return !prev;
    });
  }, []);

  // Global keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const inInput = target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable;

      // Ctrl+K always focuses search
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        const searchInput = document.querySelector<HTMLInputElement>('input[placeholder*="Search"]');
        searchInput?.focus();
        return;
      }

      // Escape works even in inputs
      if (e.key === "Escape") {
        if (showHelp) {
          setShowHelp(false);
          return;
        }
        if (focusedIndex !== null) {
          setFocusedIndex(null);
          return;
        }
        if (selectMode) {
          setSelectMode(false);
          setSelected(new Map());
          return;
        }
        // Blur current input
        if (inInput) {
          (target as HTMLElement).blur();
          return;
        }
      }

      // Skip single-key shortcuts when typing
      if (inInput) return;

      switch (e.key) {
        case "?":
          e.preventDefault();
          setShowHelp(true);
          break;
        case "j":
          e.preventDefault();
          setFocusedIndex((prev) => {
            const max = questionCountRef.current;
            if (max === 0) return null;
            if (prev === null) return 0;
            return Math.min(prev + 1, max - 1);
          });
          break;
        case "k":
          e.preventDefault();
          setFocusedIndex((prev) => {
            if (prev === null || prev === 0) return 0;
            return prev - 1;
          });
          break;
        case "Enter":
          e.preventDefault();
          if (focusedQuestionIdRef.current !== null) {
            window.location.href = `/q/${focusedQuestionIdRef.current}`;
          }
          break;
        case "c": {
          e.preventDefault();
          setFocusedIndex(null);
          const textarea = document.querySelector<HTMLTextAreaElement>('textarea[placeholder*="question"]');
          textarea?.focus();
          break;
        }
        case "/": {
          e.preventDefault();
          setFocusedIndex(null);
          const searchInput = document.querySelector<HTMLInputElement>('input[placeholder*="Search"]');
          searchInput?.focus();
          break;
        }
        case "x":
          e.preventDefault();
          toggleSelectMode();
          break;
        case "1":
          e.preventDefault();
          setStatusFilter("");
          setFocusedIndex(null);
          break;
        case "2":
          e.preventDefault();
          setStatusFilter("unanswered");
          setFocusedIndex(null);
          break;
        case "3":
          e.preventDefault();
          setStatusFilter("answered");
          setFocusedIndex(null);
          break;
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [selectMode, showHelp, focusedIndex, toggleSelectMode]);

  const handleDownloadMarkdown = useCallback(async () => {
    if (selected.size === 0) return;
    setLoading("markdown");
    try {
      const data = await fetchBatch(Array.from(selected.keys()));
      const md = allQuestionsToMarkdown(data);
      const blob = new Blob([md], { type: "text/markdown;charset=utf-8" });
      downloadBlob(blob, "research-questions.md");
    } finally {
      setLoading(null);
    }
  }, [selected]);

  const handleDownloadZip = useCallback(async () => {
    if (selected.size === 0) return;
    setLoading("zip");
    try {
      const data = await fetchBatch(Array.from(selected.keys()));
      const zip = new JSZip();
      for (let i = 0; i < data.length; i++) {
        const q = data[i];
        const filename = `${String(i + 1).padStart(2, "0")}-${slugify(q.text)}.md`;
        zip.file(filename, questionToMarkdown(q));
      }
      const blob = await zip.generateAsync({ type: "blob" });
      downloadBlob(blob, "research-questions.zip");
    } finally {
      setLoading(null);
    }
  }, [selected]);

  const handlePreviewPDF = useCallback(() => {
    if (selected.size === 0) return;
    const ids = Array.from(selected.keys()).join(",");
    window.open(`/print?ids=${ids}`, "_blank");
  }, [selected]);

  const handleExportJSON = useCallback(async () => {
    if (selected.size === 0) return;
    setLoading("json");
    try {
      const data = await fetchBatch(Array.from(selected.keys()));
      const exportData = {
        version: 1,
        exported_at: new Date().toISOString(),
        questions: data.map((q) => ({
          text: q.text,
          source: q.source || undefined,
          status: q.status,
          tags: q.tags && q.tags.length > 0 ? q.tags : undefined,
          notes: q.notes.length > 0 ? q.notes.map((n) => ({ content: n.content })) : undefined,
        })),
      };
      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: "application/json;charset=utf-8" });
      downloadBlob(blob, "research-questions.json");
    } finally {
      setLoading(null);
    }
  }, [selected]);

  const handleImportJSON = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLoading("import");
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      const res = await fetch("/api/questions/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = await res.json();
        alert(`Import failed: ${err.error}`);
        return;
      }
      const result = await res.json();
      alert(`Imported ${result.imported} question${result.imported === 1 ? "" : "s"}`);
      refresh();
    } catch {
      alert("Import failed: invalid JSON file");
    } finally {
      setLoading(null);
      // Reset the input so the same file can be imported again
      if (importInputRef.current) importInputRef.current.value = "";
    }
  }, [refresh]);

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-6">
      <header className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-lg font-semibold dark:text-zinc-100">Research Questions</h1>
          <p className="text-xs text-zinc-500">Capture questions fast. Explore them later.</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowPreamble(true)}
            title="LaTeX preamble"
            className="rounded-md border border-zinc-200 px-3 py-1.5 text-xs text-zinc-500 transition-colors hover:border-zinc-300 hover:text-zinc-700 dark:border-zinc-700 dark:hover:border-zinc-600 dark:hover:text-zinc-300"
          >
            <span className="font-serif text-sm tracking-tight">T<span className="relative -mx-0.5" style={{ fontSize: "0.8em", top: "0.22em" }}>E</span>X</span>
          </button>
          <button
            onClick={() => importInputRef.current?.click()}
            disabled={loading !== null}
            title="Import questions from JSON"
            className="rounded-md border border-zinc-200 px-3 py-1.5 text-xs text-zinc-500 transition-colors hover:border-zinc-300 hover:text-zinc-700 disabled:opacity-40 dark:border-zinc-700 dark:hover:border-zinc-600 dark:hover:text-zinc-300"
          >
            {loading === "import" ? "Importing..." : "Import"}
          </button>
          <input
            ref={importInputRef}
            type="file"
            accept=".json"
            onChange={handleImportJSON}
            className="hidden"
          />
          <button
            onClick={toggleSelectMode}
            className={`rounded-md border px-3 py-1.5 text-xs transition-colors ${
              selectMode
                ? "border-zinc-400 bg-zinc-900 text-white dark:border-zinc-500 dark:bg-zinc-100 dark:text-zinc-900"
                : "border-zinc-200 text-zinc-500 hover:border-zinc-300 hover:text-zinc-700 dark:border-zinc-700 dark:hover:border-zinc-600 dark:hover:text-zinc-300"
            }`}
          >
            {selectMode ? "Done" : "Select"}
          </button>
        </div>
      </header>

      {!selectMode && (
        <div className="mb-6">
          <QuickCapture onCreated={refresh} />
        </div>
      )}

      {/* Export bar - shown in select mode */}
      {selectMode && (
        <div className="mb-4 flex flex-wrap gap-2">
          <button
            onClick={handleDownloadMarkdown}
            disabled={selected.size === 0 || loading !== null}
            className="rounded border border-zinc-200 px-3 py-1.5 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-50 disabled:opacity-40 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            {loading === "markdown" ? "Generating..." : "Markdown"}
          </button>
          <button
            onClick={handleDownloadZip}
            disabled={selected.size === 0 || loading !== null}
            className="rounded border border-zinc-200 px-3 py-1.5 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-50 disabled:opacity-40 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            {loading === "zip" ? "Generating..." : "Zip"}
          </button>
          <button
            onClick={handlePreviewPDF}
            disabled={selected.size === 0 || loading !== null}
            className="rounded border border-zinc-200 px-3 py-1.5 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-50 disabled:opacity-40 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            PDF
          </button>
          <button
            onClick={handleExportJSON}
            disabled={selected.size === 0 || loading !== null}
            className="rounded border border-zinc-200 px-3 py-1.5 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-50 disabled:opacity-40 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            {loading === "json" ? "Exporting..." : "Export JSON"}
          </button>
        </div>
      )}

      <QuestionList
        refreshKey={refreshKey}
        selectMode={selectMode}
        selected={selected}
        onSelectionChange={setSelected}
        statusFilter={statusFilter}
        onStatusFilterChange={setStatusFilter}
        focusedIndex={focusedIndex}
        questionCount={handleQuestionCount}
        onFocusedQuestionId={handleFocusedQuestionId}
      />

      <KeyboardShortcutHelp groups={homeShortcuts} open={showHelp} onClose={() => setShowHelp(false)} />
      <LatexPreambleEditor open={showPreamble} onClose={() => setShowPreamble(false)} />
    </div>
  );
}
