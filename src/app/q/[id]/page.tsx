"use client";

import { use, useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import useSWR from "swr";
import LatexRenderer from "@/components/LatexRenderer";
import StatusBadge from "@/components/StatusBadge";
import NoteEditor from "@/components/NoteEditor";
import CopyForClaudeCode from "@/components/CopyForClaudeCode";
import QuickCapture from "@/components/QuickCapture";
import KeyboardShortcutHelp from "@/components/KeyboardShortcutHelp";
import LinkExistingQuestion from "@/components/LinkExistingQuestion";
import type { Question, Note } from "@/lib/queries";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export default function QuestionDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();

  const { data: question, mutate: mutateQuestion } = useSWR<Question>(
    `/api/questions/${id}`,
    fetcher
  );

  const { data: notes, mutate: mutateNotes } = useSWR<Note[]>(
    `/api/questions/${id}/notes`,
    fetcher
  );

  const { data: related, mutate: mutateRelated } = useSWR<Question[]>(
    `/api/questions/${id}/related`,
    fetcher
  );

  const [showSubCapture, setShowSubCapture] = useState(false);
  const [showLinkSearch, setShowLinkSearch] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState("");
  const [editSource, setEditSource] = useState("");
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editNoteContent, setEditNoteContent] = useState("");
  const [showHelp, setShowHelp] = useState(false);

  const cycleStatus = useCallback(async () => {
    if (!question) return;
    const next = question.status === "unanswered" ? "answered" : "unanswered";
    await fetch(`/api/questions/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: next }),
    });
    mutateQuestion();
  }, [question, id, mutateQuestion]);

  const startEdit = useCallback(() => {
    if (!question) return;
    setEditText(question.text);
    setEditSource(question.source);
    setEditing(true);
  }, [question]);

  const detailShortcuts = [
    {
      title: "Actions",
      shortcuts: [
        { key: "e", description: "Edit question" },
        { key: "s", description: "Toggle status" },
        { key: "n", description: "Focus note editor" },
        { key: "q", description: "Add related question" },
      ],
    },
    {
      title: "Navigation",
      shortcuts: [
        { key: "Backspace", description: "Back to questions" },
      ],
    },
    {
      title: "General",
      shortcuts: [
        { key: "?", description: "Show keyboard shortcuts" },
        { key: "Esc", description: "Close dialog / cancel edit" },
        { key: "Ctrl+Enter", description: "Save note" },
      ],
    },
  ];

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const inInput = target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable;

      if (e.key === "Escape") {
        if (showHelp) {
          setShowHelp(false);
          return;
        }
        if (inInput) {
          (target as HTMLElement).blur();
          return;
        }
      }

      if (inInput) return;

      switch (e.key) {
        case "?":
          e.preventDefault();
          setShowHelp(true);
          break;
        case "e":
          e.preventDefault();
          if (!editing) startEdit();
          break;
        case "s":
          e.preventDefault();
          cycleStatus();
          break;
        case "n": {
          e.preventDefault();
          const noteTextarea = document.querySelector<HTMLTextAreaElement>('textarea[placeholder*="Add a note"]');
          noteTextarea?.focus();
          break;
        }
        case "q":
          e.preventDefault();
          setShowSubCapture(true);
          setTimeout(() => {
            const subTextarea = document.querySelector<HTMLTextAreaElement>('textarea[placeholder="Related question..."]');
            subTextarea?.focus();
          }, 50);
          break;
        case "Backspace":
          e.preventDefault();
          router.push("/");
          break;
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [showHelp, editing, startEdit, cycleStatus, router]);

  const saveEdit = async () => {
    await fetch(`/api/questions/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: editText, source: editSource }),
    });
    setEditing(false);
    mutateQuestion();
  };

  const saveNoteEdit = async (noteId: string) => {
    if (!editNoteContent.trim()) return;
    await fetch(`/api/notes/${noteId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: editNoteContent.trim() }),
    });
    setEditingNoteId(null);
    mutateNotes();
  };

  const deleteNoteHandler = async (noteId: string) => {
    await fetch(`/api/notes/${noteId}`, { method: "DELETE" });
    mutateNotes();
  };

  if (!question) {
    return (
      <div className="mx-auto w-full max-w-2xl px-4 py-6">
        <p className="text-sm text-zinc-400">Loading...</p>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-6">
      {/* Back link */}
      <Link href="/" className="mb-4 inline-block text-xs text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300">
        &larr; Back to questions
      </Link>

      {/* Question header */}
      <div className="mb-6">
        {editing ? (
          <div className="space-y-2">
            <textarea
              value={editText}
              onChange={(e) => setEditText(e.target.value)}
              className="w-full rounded border border-zinc-200 bg-transparent p-2 text-sm outline-none dark:border-zinc-700"
              rows={3}
            />
            <input
              value={editSource}
              onChange={(e) => setEditSource(e.target.value)}
              placeholder="Source"
              className="w-full rounded border border-zinc-200 bg-transparent px-2 py-1 text-xs outline-none dark:border-zinc-700"
            />
            <div className="flex gap-2">
              <button onClick={saveEdit} className="rounded bg-zinc-900 px-3 py-1 text-xs text-white dark:bg-zinc-100 dark:text-zinc-900">
                Save
              </button>
              <button onClick={() => setEditing(false)} className="text-xs text-zinc-500">
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="text-base leading-relaxed dark:text-zinc-100">
              <LatexRenderer text={question.text} />
            </div>
            {question.source && (
              <p className="mt-1 text-xs text-zinc-500">{question.source}</p>
            )}
          </>
        )}

        {/* Actions bar */}
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button onClick={cycleStatus} title="Click to change status">
            <StatusBadge status={question.status} />
          </button>
          {!editing && (
            <>
              <button onClick={startEdit} className="text-xs text-zinc-400 hover:text-zinc-600">
                Edit
              </button>
              <button
                onClick={async () => {
                  if (!confirm("Delete this question?")) return;
                  await fetch(`/api/questions/${id}`, { method: "DELETE" });
                  router.push("/");
                }}
                className="text-xs text-zinc-400 hover:text-red-500"
              >
                Delete
              </button>
            </>
          )}
          <CopyForClaudeCode
            question={question}
            notes={notes || []}
            relatedQuestions={related || []}
          />
          {question.tags && question.tags.length > 0 && (
            <div className="flex gap-1">
              {question.tags.map((tag) => (
                <span key={tag} className="rounded bg-zinc-100 px-1.5 py-0.5 text-[10px] text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
                  {tag}
                </span>
              ))}
            </div>
          )}
          <time className="text-[10px] text-zinc-400">
            {new Date(question.created_at).toLocaleDateString()}
          </time>
        </div>
      </div>

      {/* Notes section */}
      <section className="mb-6">
        <h2 className="mb-2 text-sm font-medium text-zinc-700 dark:text-zinc-300">Notes</h2>
        {notes && notes.length > 0 && (
          <div className="mb-3 space-y-2">
            {notes.map((note) => (
              <div key={note.id} className="rounded border border-zinc-100 p-2 text-sm dark:border-zinc-800">
                {editingNoteId === note.id ? (
                  <div className="space-y-2">
                    <textarea
                      value={editNoteContent}
                      onChange={(e) => setEditNoteContent(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
                          e.preventDefault();
                          saveNoteEdit(note.id);
                        }
                        if (e.key === "Escape") setEditingNoteId(null);
                      }}
                      className="w-full resize-none rounded border border-zinc-200 bg-transparent p-2 text-sm outline-none focus:border-zinc-400 dark:border-zinc-700 dark:focus:border-zinc-500"
                      rows={3}
                      autoFocus
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={() => saveNoteEdit(note.id)}
                        className="rounded bg-zinc-900 px-3 py-1 text-xs text-white dark:bg-zinc-100 dark:text-zinc-900"
                      >
                        Save
                      </button>
                      <button
                        onClick={() => setEditingNoteId(null)}
                        className="text-xs text-zinc-500"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <LatexRenderer text={note.content} />
                    <div className="mt-1 flex items-center gap-2">
                      <time className="text-[10px] text-zinc-400">
                        {new Date(note.created_at).toLocaleDateString()}
                      </time>
                      <button
                        onClick={() => {
                          setEditingNoteId(note.id);
                          setEditNoteContent(note.content);
                        }}
                        className="text-[10px] text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => deleteNoteHandler(note.id)}
                        className="text-[10px] text-zinc-400 hover:text-red-500"
                      >
                        Delete
                      </button>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        )}
        <NoteEditor questionId={id} onCreated={() => mutateNotes()} />
      </section>

      {/* Related questions section */}
      <section className="mb-6">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Related Questions</h2>
          <div className="flex gap-2">
            <button
              onClick={() => { setShowLinkSearch(!showLinkSearch); setShowSubCapture(false); }}
              className="text-xs text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
            >
              {showLinkSearch ? "Cancel" : "+ Link existing"}
            </button>
            <button
              onClick={() => { setShowSubCapture(!showSubCapture); setShowLinkSearch(false); }}
              className="text-xs text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
            >
              {showSubCapture ? "Cancel" : "+ Create new"}
            </button>
          </div>
        </div>
        {showLinkSearch && (
          <div className="mb-3">
            <LinkExistingQuestion
              currentQuestionId={id}
              existingChildIds={(related || []).map((c) => c.id)}
              onLinked={() => {
                mutateRelated();
                setShowLinkSearch(false);
              }}
              onCancel={() => setShowLinkSearch(false)}
            />
          </div>
        )}
        {showSubCapture && (
          <div className="mb-3">
            <QuickCapture
              linkTo={id}
              placeholder="Related question..."
              onCreated={() => {
                mutateRelated();
                setShowSubCapture(false);
              }}
            />
          </div>
        )}
        {related && related.length > 0 && (
          <div className="space-y-1">
            {related.map((child) => (
              <Link
                key={child.id}
                href={`/q/${child.id}`}
                className="block rounded border border-zinc-100 p-2 text-sm hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-800/50"
              >
                <LatexRenderer text={child.text} />
              </Link>
            ))}
          </div>
        )}
      </section>

      <KeyboardShortcutHelp groups={detailShortcuts} open={showHelp} onClose={() => setShowHelp(false)} />
    </div>
  );
}
