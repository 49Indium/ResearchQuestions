"use client";

import { use, useState, useCallback } from "react";
import Link from "next/link";
import useSWR from "swr";
import LatexRenderer from "@/components/LatexRenderer";
import StatusBadge from "@/components/StatusBadge";
import NoteEditor from "@/components/NoteEditor";
import ClaudeChat from "@/components/ClaudeChat";
import CopyForClaudeCode from "@/components/CopyForClaudeCode";
import QuickCapture from "@/components/QuickCapture";
import type { Question, Note } from "@/lib/queries";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export default function QuestionDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const questionId = parseInt(id);

  const { data: question, mutate: mutateQuestion } = useSWR<Question>(
    `/api/questions/${questionId}`,
    fetcher
  );

  const { data: notes, mutate: mutateNotes } = useSWR<Note[]>(
    `/api/questions/${questionId}/notes`,
    fetcher
  );

  const { data: children, mutate: mutateChildren } = useSWR<Question[]>(
    `/api/questions?parent_id=${questionId}`,
    fetcher
  );

  const [showSubCapture, setShowSubCapture] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState("");
  const [editSource, setEditSource] = useState("");

  const cycleStatus = useCallback(async () => {
    if (!question) return;
    const order: ("unanswered" | "in-progress" | "answered")[] = ["unanswered", "in-progress", "answered"];
    const next = order[(order.indexOf(question.status) + 1) % order.length];
    await fetch(`/api/questions/${questionId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: next }),
    });
    mutateQuestion();
  }, [question, questionId, mutateQuestion]);

  const startEdit = () => {
    if (!question) return;
    setEditText(question.text);
    setEditSource(question.source);
    setEditing(true);
  };

  const saveEdit = async () => {
    await fetch(`/api/questions/${questionId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: editText, source: editSource }),
    });
    setEditing(false);
    mutateQuestion();
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
            <button onClick={startEdit} className="text-xs text-zinc-400 hover:text-zinc-600">
              Edit
            </button>
          )}
          <CopyForClaudeCode
            question={question}
            notes={notes || []}
            children={children || []}
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
                <LatexRenderer text={note.content} />
                <time className="mt-1 block text-[10px] text-zinc-400">
                  {new Date(note.created_at).toLocaleDateString()}
                </time>
              </div>
            ))}
          </div>
        )}
        <NoteEditor questionId={questionId} onCreated={() => mutateNotes()} />
      </section>

      {/* Sub-questions section */}
      <section className="mb-6">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Sub-questions</h2>
          <button
            onClick={() => setShowSubCapture(!showSubCapture)}
            className="text-xs text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
          >
            {showSubCapture ? "Cancel" : "+ Add sub-question"}
          </button>
        </div>
        {showSubCapture && (
          <div className="mb-3">
            <QuickCapture
              parentId={questionId}
              placeholder="Sub-question..."
              onCreated={() => {
                mutateChildren();
                setShowSubCapture(false);
              }}
            />
          </div>
        )}
        {children && children.length > 0 && (
          <div className="space-y-1">
            {children.map((child) => (
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

      {/* Claude chat section */}
      <section>
        <h2 className="mb-2 text-sm font-medium text-zinc-700 dark:text-zinc-300">Ask Claude</h2>
        <ClaudeChat questionId={questionId} />
      </section>
    </div>
  );
}
