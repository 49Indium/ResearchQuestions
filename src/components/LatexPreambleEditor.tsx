"use client";

import { useState, useEffect } from "react";
import useSWR, { mutate } from "swr";
import katex from "katex";

type Macros = Record<string, string>;

const fetcher = (url: string) => fetch(url).then((r) => r.json());

function macrosToText(macros: Macros): string {
  return Object.entries(macros)
    .map(([cmd, expansion]) => `${cmd} = ${expansion}`)
    .join("\n");
}

function textToMacros(text: string): Macros {
  const macros: Macros = {};
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("%")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx === -1) continue;
    const cmd = trimmed.slice(0, eqIdx).trim();
    const expansion = trimmed.slice(eqIdx + 1).trim();
    if (cmd && expansion) {
      macros[cmd] = expansion;
    }
  }
  return macros;
}

interface Props {
  open: boolean;
  onClose: () => void;
}

export default function LatexPreambleEditor({ open, onClose }: Props) {
  const { data } = useSWR<Macros>("/api/settings/latex-macros", fetcher);
  const [text, setText] = useState("");
  const [saving, setSaving] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);

  useEffect(() => {
    if (data && open) {
      setText(macrosToText(data));
    }
  }, [data, open]);

  if (!open) return null;

  const handleSave = async () => {
    setSaving(true);
    const macros = textToMacros(text);
    await fetch("/api/settings/latex-macros", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(macros),
    });
    await mutate("/api/settings/latex-macros");
    setSaving(false);
    onClose();
  };

  const handlePreview = () => {
    const macros = textToMacros(text);
    const parts: string[] = [];
    for (const [cmd, expansion] of Object.entries(macros)) {
      try {
        const rendered = katex.renderToString(`${cmd}`, {
          throwOnError: false,
          macros,
        });
        const expandedRendered = katex.renderToString(expansion, {
          throwOnError: false,
        });
        parts.push(
          `<span class="inline-flex items-center gap-2"><code class="text-xs bg-zinc-100 dark:bg-zinc-800 px-1 rounded">${cmd}</code> → ${rendered} <span class="text-zinc-400 text-xs">(${expansion} → ${expandedRendered})</span></span>`
        );
      } catch {
        parts.push(
          `<span class="text-red-500 text-xs">${cmd}: render error</span>`
        );
      }
    }
    setPreview(parts.join("<br/>"));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div
        className="mx-4 w-full max-w-lg rounded-lg border border-zinc-200 bg-white p-5 shadow-lg dark:border-zinc-700 dark:bg-zinc-900"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="mb-1 text-sm font-semibold dark:text-zinc-100">LaTeX Preamble</h2>
        <p className="mb-3 text-xs text-zinc-500">
          One macro per line: <code className="rounded bg-zinc-100 px-1 dark:bg-zinc-800">\RR = \mathbb{"{R}"}</code>
          &nbsp; Lines starting with <code className="rounded bg-zinc-100 px-1 dark:bg-zinc-800">%</code> are comments.
        </p>

        <textarea
          value={text}
          onChange={(e) => { setText(e.target.value); setPreview(null); }}
          rows={12}
          spellCheck={false}
          className="w-full rounded border border-zinc-200 bg-zinc-50 p-3 font-mono text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200 focus:outline-none focus:ring-1 focus:ring-zinc-400"
          placeholder={"\\RR = \\mathbb{R}\n\\ZZ = \\mathbb{Z}"}
        />

        {preview && (
          <div
            className="mt-2 max-h-40 overflow-auto rounded border border-zinc-200 bg-zinc-50 p-3 text-sm dark:border-zinc-700 dark:bg-zinc-800"
            dangerouslySetInnerHTML={{ __html: preview }}
          />
        )}

        <div className="mt-3 flex items-center justify-between">
          <button
            onClick={handlePreview}
            className="rounded border border-zinc-200 px-3 py-1.5 text-xs text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800"
          >
            Preview
          </button>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="rounded border border-zinc-200 px-3 py-1.5 text-xs text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="rounded bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
            >
              {saving ? "Saving..." : "Save"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
