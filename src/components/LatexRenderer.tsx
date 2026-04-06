"use client";

import { useMemo } from "react";
import katex from "katex";
import { useLatexMacros } from "./LatexMacrosContext";

interface LatexRendererProps {
  text: string;
  className?: string;
}

function renderLatex(text: string, macros: Record<string, string>): string {
  let result = text;

  const opts = { throwOnError: false, macros };

  // Display math: $$...$$
  result = result.replace(/\$\$([\s\S]*?)\$\$/g, (_, math) => {
    try {
      return katex.renderToString(math, { ...opts, displayMode: true });
    } catch {
      return `<span class="text-red-500" title="LaTeX error">$$${math}$$</span>`;
    }
  });

  // Inline math: $...$  (but not escaped \$)
  result = result.replace(/(?<![\\$])\$([^\$\n]+?)\$/g, (_, math) => {
    try {
      return katex.renderToString(math, { ...opts, displayMode: false });
    } catch {
      return `<span class="text-red-500" title="LaTeX error">$${math}$</span>`;
    }
  });

  return result;
}

export default function LatexRenderer({ text, className }: LatexRendererProps) {
  const macros = useLatexMacros();
  const html = useMemo(() => renderLatex(text, macros), [text, macros]);

  return (
    <span
      className={className}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
