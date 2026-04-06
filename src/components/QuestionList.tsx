"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import useSWR from "swr";
import QuestionCard from "./QuestionCard";
import LatexRenderer from "./LatexRenderer";
import StatusBadge from "./StatusBadge";
import type { Question } from "@/lib/queries";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

interface QuestionListProps {
  refreshKey?: number;
  selectMode?: boolean;
  selected?: Map<string, Question>;
  onSelectionChange?: (selected: Map<string, Question>) => void;
  statusFilter?: string;
  onStatusFilterChange?: (filter: string) => void;
  focusedIndex?: number | null;
  questionCount?: (count: number) => void;
  onFocusedQuestionId?: (id: string | null) => void;
}

export default function QuestionList({
  refreshKey,
  selectMode = false,
  selected,
  onSelectionChange,
  statusFilter: controlledFilter,
  onStatusFilterChange,
  focusedIndex,
  questionCount,
  onFocusedQuestionId,
}: QuestionListProps) {
  const [internalFilter, setInternalFilter] = useState<string>("");
  const statusFilter = controlledFilter ?? internalFilter;
  const setStatusFilter = onStatusFilterChange ?? setInternalFilter;
  const [search, setSearch] = useState("");
  const [noteWeight, setNoteWeight] = useState(0.3);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const dragNodeRef = useRef<HTMLDivElement | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);

  const isSearching = search.trim().length > 0;

  const questionsUrl = statusFilter
    ? `/api/questions?status=${statusFilter}`
    : `/api/questions`;

  const searchUrl = `/api/search?q=${encodeURIComponent(search.trim())}&noteWeight=${noteWeight}`;

  const { data: questions, mutate } = useSWR<Question[]>(
    isSearching ? null : [questionsUrl, refreshKey],
    ([url]: [string]) => fetcher(url)
  );

  const { data: searchResults } = useSWR(
    isSearching ? [searchUrl, refreshKey] : null,
    ([url]: [string]) => fetcher(url)
  );

  const displayQuestions: Question[] = isSearching
    ? searchResults?.questions || []
    : questions || [];

  const ftsQuestionCount: number = searchResults?.ftsQuestionCount ?? displayQuestions.length;

  // Report question count and focused ID to parent for keyboard navigation
  useEffect(() => {
    questionCount?.(displayQuestions.length);
  }, [displayQuestions.length, questionCount]);

  useEffect(() => {
    if (focusedIndex != null && focusedIndex < displayQuestions.length) {
      onFocusedQuestionId?.(displayQuestions[focusedIndex].id);
    } else {
      onFocusedQuestionId?.(null);
    }
  }, [focusedIndex, displayQuestions, onFocusedQuestionId]);

  // Scroll focused card into view
  useEffect(() => {
    if (focusedIndex == null || !listRef.current) return;
    const cards = listRef.current.querySelectorAll("[data-question-card]");
    cards[focusedIndex]?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [focusedIndex]);

  const canDrag = !isSearching && !statusFilter && !selectMode;

  const toggleSelect = useCallback(
    (q: Question) => {
      if (!selected || !onSelectionChange) return;
      const next = new Map(selected);
      if (next.has(q.id)) {
        next.delete(q.id);
      } else {
        next.set(q.id, q);
      }
      onSelectionChange(next);
    },
    [selected, onSelectionChange]
  );

  const selectAllVisible = useCallback(() => {
    if (!selected || !onSelectionChange) return;
    const next = new Map(selected);
    for (const q of displayQuestions) {
      next.set(q.id, q);
    }
    onSelectionChange(next);
  }, [selected, onSelectionChange, displayQuestions]);

  // Find the closest card index based on cursor Y position
  const getDropIndex = useCallback((clientY: number): number | null => {
    const container = listRef.current;
    if (!container) return null;
    const children = Array.from(container.children) as HTMLElement[];
    if (children.length === 0) return null;

    for (let i = 0; i < children.length; i++) {
      const rect = children[i].getBoundingClientRect();
      const midY = rect.top + rect.height / 2;
      if (clientY < midY) return i;
    }
    return children.length - 1;
  }, []);

  const handleDragStart = useCallback(
    (e: React.DragEvent<HTMLDivElement>, index: number) => {
      setDragIndex(index);
      dragNodeRef.current = e.currentTarget;
      e.dataTransfer.effectAllowed = "move";
      requestAnimationFrame(() => {
        if (dragNodeRef.current) {
          dragNodeRef.current.style.opacity = "0.4";
        }
      });
    },
    []
  );

  const commitReorder = useCallback(
    async (fromIndex: number, toIndex: number) => {
      if (fromIndex === toIndex) return;

      const reordered = [...displayQuestions];
      const [moved] = reordered.splice(fromIndex, 1);
      reordered.splice(toIndex, 0, moved);

      mutate(reordered, false);

      const orderedIds = reordered.map((q) => q.id);
      await fetch("/api/questions/reorder", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderedIds }),
      });

      mutate();
    },
    [displayQuestions, mutate]
  );

  const handleDragEnd = useCallback(() => {
    if (dragNodeRef.current) {
      dragNodeRef.current.style.opacity = "1";
    }
    // Commit the reorder based on whatever dragOverIndex we landed on
    if (dragIndex !== null && dragOverIndex !== null && dragIndex !== dragOverIndex) {
      commitReorder(dragIndex, dragOverIndex);
    }
    setDragIndex(null);
    setDragOverIndex(null);
    dragNodeRef.current = null;
  }, [dragIndex, dragOverIndex, commitReorder]);

  // Handle dragOver on the container so gaps between cards are covered
  const handleContainerDragOver = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      if (dragIndex === null || !canDrag) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
      const idx = getDropIndex(e.clientY);
      if (idx !== null) {
        setDragOverIndex(idx);
      }
    },
    [dragIndex, canDrag, getDropIndex]
  );

  // Prevent default on drop so the browser doesn't navigate
  const handleContainerDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
    },
    []
  );

  const statuses = [
    { value: "", label: "All" },
    { value: "unanswered", label: "Unanswered" },
    { value: "answered", label: "Answered" },
  ];

  return (
    <div className="space-y-3">
      {/* Search + filters */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search questions... (Ctrl+K)"
          className="flex-1 rounded-md border border-zinc-200 bg-transparent px-3 py-1.5 text-sm outline-none placeholder:text-zinc-400 focus:border-zinc-400 dark:border-zinc-700 dark:focus:border-zinc-500"
        />
        <div className="flex gap-1">
          {statuses.map((s) => (
            <button
              key={s.value}
              onClick={() => setStatusFilter(s.value)}
              className={`rounded-md px-2 py-1 text-xs font-medium transition-colors ${
                statusFilter === s.value
                  ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                  : "text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {/* Note weight slider — only visible when searching */}
      {isSearching && (
        <div className="flex items-center gap-3">
          <label className="text-[11px] text-zinc-400 whitespace-nowrap">
            Note influence
          </label>
          <input
            type="range"
            min="0"
            max="1"
            step="0.1"
            value={noteWeight}
            onChange={(e) => setNoteWeight(parseFloat(e.target.value))}
            className="h-1 w-28 cursor-pointer appearance-none rounded-full bg-zinc-200 accent-zinc-500 dark:bg-zinc-700"
          />
          <span className="text-[11px] tabular-nums text-zinc-400 w-6">
            {Math.round(noteWeight * 100)}%
          </span>
        </div>
      )}

      {/* Select mode bulk actions */}
      {selectMode && selected && onSelectionChange && (
        <div className="flex items-center gap-3">
          <button
            onClick={selectAllVisible}
            className="text-xs text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
          >
            Select all visible
          </button>
          <button
            onClick={() => onSelectionChange(new Map())}
            className="text-xs text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
          >
            Clear selection
          </button>
          <span className="text-xs text-zinc-400">
            {selected.size} selected
          </span>
        </div>
      )}

      {/* Question list */}
      {displayQuestions.length === 0 ? (
        <p className="py-8 text-center text-sm text-zinc-400">
          {isSearching ? "No results found." : "No questions yet. Add one above!"}
        </p>
      ) : selectMode && selected ? (
        <div className="space-y-1">
          {displayQuestions.map((q, i) => (
            <React.Fragment key={q.id}>
            {isSearching && i === ftsQuestionCount && ftsQuestionCount < displayQuestions.length && (
              <div className="flex items-center gap-3 py-2">
                <div className="h-px flex-1 bg-zinc-200 dark:bg-zinc-700" />
                <span className="text-[10px] font-medium uppercase tracking-wider text-zinc-400">Similar</span>
                <div className="h-px flex-1 bg-zinc-200 dark:bg-zinc-700" />
              </div>
            )}
            <label
              key={q.id}
              className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors ${
                selected.has(q.id)
                  ? "border-zinc-400 bg-zinc-50 dark:border-zinc-500 dark:bg-zinc-800/50"
                  : "border-zinc-200 hover:border-zinc-300 dark:border-zinc-700 dark:hover:border-zinc-600"
              }`}
            >
              <input
                type="checkbox"
                checked={selected.has(q.id)}
                onChange={() => toggleSelect(q)}
                className="mt-1 shrink-0"
              />
              <div className="min-w-0 flex-1">
                <div className="text-sm leading-relaxed dark:text-zinc-100">
                  <LatexRenderer text={q.text} />
                </div>
                {q.source && (
                  <p className="mt-0.5 text-xs text-zinc-500">{q.source}</p>
                )}
                {q.tags && q.tags.length > 0 && (
                  <div className="mt-1 flex flex-wrap gap-1">
                    {q.tags.map((tag) => (
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
              <StatusBadge status={q.status} />
            </label>
            </React.Fragment>
          ))}
        </div>
      ) : (
        <div
          ref={listRef}
          className="space-y-2"
          onDragOver={handleContainerDragOver}
          onDrop={handleContainerDrop}
        >
          {displayQuestions.map((q, i) => (
            <React.Fragment key={q.id}>
              {isSearching && i === ftsQuestionCount && ftsQuestionCount < displayQuestions.length && (
                <div className="flex items-center gap-3 py-1">
                  <div className="h-px flex-1 bg-zinc-200 dark:bg-zinc-700" />
                  <span className="text-[10px] font-medium uppercase tracking-wider text-zinc-400">Similar</span>
                  <div className="h-px flex-1 bg-zinc-200 dark:bg-zinc-700" />
                </div>
              )}
              <div
                data-question-card
                draggable={canDrag}
                onDragStart={(e) => canDrag && handleDragStart(e, i)}
                onDragEnd={handleDragEnd}
                className={`group relative ${
                  canDrag ? "cursor-grab active:cursor-grabbing" : ""
                } ${
                  dragOverIndex === i && dragIndex !== null && dragIndex !== i
                    ? dragIndex < i
                      ? "border-b-2 border-b-blue-400"
                      : "border-t-2 border-t-blue-400"
                    : ""
                }`}
              >
                {canDrag && (
                  <div className="absolute left-0 top-1/2 z-10 -translate-x-6 -translate-y-1/2 opacity-0 transition-opacity group-hover:opacity-100">
                    <svg
                      className="h-4 w-4 text-zinc-400"
                      viewBox="0 0 16 16"
                      fill="currentColor"
                    >
                      <circle cx="5" cy="3" r="1.5" />
                      <circle cx="11" cy="3" r="1.5" />
                      <circle cx="5" cy="8" r="1.5" />
                      <circle cx="11" cy="8" r="1.5" />
                      <circle cx="5" cy="13" r="1.5" />
                      <circle cx="11" cy="13" r="1.5" />
                    </svg>
                  </div>
                )}
                <QuestionCard question={q} focused={focusedIndex === i} />
              </div>
            </React.Fragment>
          ))}
        </div>
      )}
    </div>
  );
}
