"use client";

import { useMemo } from "react";
import katex from "katex";

interface LatexRendererProps {
  text: string;
  className?: string;
}

function renderLatex(text: string): string {
  // Replace $$...$$ (display math) then $...$ (inline math)
  let result = text;

  // Display math: $$...$$
  result = result.replace(/\$\$([\s\S]*?)\$\$/g, (_, math) => {
    try {
      return katex.renderToString(math, { displayMode: true, throwOnError: false });
    } catch {
      return `<span class="text-red-500" title="LaTeX error">$$${math}$$</span>`;
    }
  });

  // Inline math: $...$  (but not escaped \$)
  result = result.replace(/(?<![\\$])\$([^\$\n]+?)\$/g, (_, math) => {
    try {
      return katex.renderToString(math, { displayMode: false, throwOnError: false });
    } catch {
      return `<span class="text-red-500" title="LaTeX error">$${math}$</span>`;
    }
  });

  return result;
}

export default function LatexRenderer({ text, className }: LatexRendererProps) {
  const html = useMemo(() => renderLatex(text), [text]);

  return (
    <span
      className={className}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
