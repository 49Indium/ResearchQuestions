"use client";

import { useState, useRef, useEffect } from "react";
import useSWR from "swr";
import LatexRenderer from "./LatexRenderer";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

interface ClaudeChatProps {
  questionId: number;
}

interface Message {
  role: string;
  content: string;
  timestamp: string;
}

export default function ClaudeChat({ questionId }: ClaudeChatProps) {
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [streamedText, setStreamedText] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { data: conv, mutate } = useSWR(
    `/api/questions/${questionId}/claude`,
    fetcher
  );

  const messages: Message[] = conv?.messages || [];

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length, streamedText]);

  const send = async () => {
    if (!input.trim() || streaming) return;
    const message = input.trim();
    setInput("");
    setStreaming(true);
    setStreamedText("");

    try {
      const res = await fetch(`/api/questions/${questionId}/claude`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message }),
      });

      if (!res.ok || !res.body) {
        setStreaming(false);
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let text = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        text += decoder.decode(value, { stream: true });
        setStreamedText(text);
      }
    } finally {
      setStreaming(false);
      setStreamedText("");
      mutate();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      send();
    }
  };

  return (
    <div className="flex flex-col">
      {/* Messages */}
      <div className="max-h-96 space-y-3 overflow-y-auto">
        {messages.map((msg, i) => (
          <div
            key={i}
            className={`rounded-lg p-3 text-sm ${
              msg.role === "user"
                ? "ml-8 bg-zinc-100 dark:bg-zinc-800"
                : "mr-8 border border-zinc-200 dark:border-zinc-700"
            }`}
          >
            <div className="mb-1 text-[10px] font-medium text-zinc-400">
              {msg.role === "user" ? "You" : "Claude"}
            </div>
            <div className="leading-relaxed">
              <LatexRenderer text={msg.content} />
            </div>
          </div>
        ))}

        {/* Streaming response */}
        {streaming && streamedText && (
          <div className="mr-8 rounded-lg border border-zinc-200 p-3 text-sm dark:border-zinc-700">
            <div className="mb-1 text-[10px] font-medium text-zinc-400">Claude</div>
            <div className="leading-relaxed">
              <LatexRenderer text={streamedText} />
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="mt-3">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={messages.length === 0 ? "Ask Claude about this question... (Ctrl+Enter)" : "Follow up... (Ctrl+Enter)"}
          className="w-full resize-none rounded-md border border-zinc-200 bg-transparent p-2 text-sm outline-none placeholder:text-zinc-400 focus:border-zinc-400 dark:border-zinc-700 dark:focus:border-zinc-500"
          rows={2}
          disabled={streaming}
        />
        <button
          type="button"
          onClick={send}
          disabled={!input.trim() || streaming}
          className="mt-1 rounded-md bg-zinc-900 px-3 py-1 text-xs font-medium text-white hover:bg-zinc-700 disabled:opacity-40 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
        >
          {streaming ? "Thinking..." : "Ask Claude"}
        </button>
      </div>
    </div>
  );
}
