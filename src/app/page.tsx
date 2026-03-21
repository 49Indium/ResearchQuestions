"use client";

import { useState, useEffect, useCallback } from "react";
import QuickCapture from "@/components/QuickCapture";
import QuestionList from "@/components/QuestionList";

export default function Home() {
  const [refreshKey, setRefreshKey] = useState(0);

  const refresh = useCallback(() => {
    setRefreshKey((k) => k + 1);
  }, []);

  // Global keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Ctrl+K to focus search
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        const searchInput = document.querySelector<HTMLInputElement>('input[placeholder*="Search"]');
        searchInput?.focus();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-6">
      <header className="mb-6">
        <h1 className="text-lg font-semibold dark:text-zinc-100">Research Questions</h1>
        <p className="text-xs text-zinc-500">Capture questions fast. Explore them later.</p>
      </header>

      <div className="mb-6">
        <QuickCapture onCreated={refresh} />
      </div>

      <QuestionList refreshKey={refreshKey} />
    </div>
  );
}
