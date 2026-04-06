"use client";

import { useEffect } from "react";

interface ShortcutGroup {
  title: string;
  shortcuts: { key: string; description: string }[];
}

interface KeyboardShortcutHelpProps {
  groups: ShortcutGroup[];
  open: boolean;
  onClose: () => void;
}

export default function KeyboardShortcutHelp({ groups, open, onClose }: KeyboardShortcutHelpProps) {
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape" || e.key === "?") {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div
        className="mx-4 w-full max-w-sm rounded-lg border border-zinc-200 bg-white p-5 shadow-lg dark:border-zinc-700 dark:bg-zinc-900"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-semibold dark:text-zinc-100">Keyboard shortcuts</h2>
          <button onClick={onClose} className="text-xs text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300">
            Esc
          </button>
        </div>
        <div className="space-y-4">
          {groups.map((group) => (
            <div key={group.title}>
              <h3 className="mb-1.5 text-[10px] font-medium uppercase tracking-wider text-zinc-400">
                {group.title}
              </h3>
              <div className="space-y-1">
                {group.shortcuts.map((s) => (
                  <div key={s.key} className="flex items-center justify-between text-xs">
                    <span className="text-zinc-600 dark:text-zinc-300">{s.description}</span>
                    <kbd className="ml-4 shrink-0 rounded border border-zinc-200 bg-zinc-50 px-1.5 py-0.5 font-mono text-[11px] text-zinc-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-400">
                      {s.key}
                    </kbd>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
