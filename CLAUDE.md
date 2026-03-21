# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

A local-first web app for capturing and exploring math research questions. Built for a single user on localhost — no auth. The core design principle is **speed of question capture** (under 10 seconds from thought to saved question).

## Tech Stack

- Next.js (App Router) + TypeScript + Tailwind CSS
- SQLite via `better-sqlite3` (synchronous, server-side only)
- KaTeX for LaTeX rendering (`$...$` inline, `$$...$$` display)
- Anthropic SDK for Claude API integration (streaming responses)
- SWR for client-side data fetching

## Commands

```bash
npm run dev          # Start dev server (localhost:3000)
npm run build        # Production build
npm run lint         # ESLint
```

## Architecture

**Database:** SQLite file at `./data/questions.db`, auto-created on first run. Schema lives in `src/lib/db.ts` (runs CREATE IF NOT EXISTS on import). FTS5 virtual tables with triggers keep search index in sync. No ORM — direct `better-sqlite3` prepared statements in `src/lib/queries.ts`.

**Routing:** Next.js App Router. Two pages: `/` (home with QuickCapture + question list) and `/q/[id]` (question detail with notes, sub-questions, Claude chat). API routes under `/api/questions/`, `/api/search`, `/api/tags`.

**Claude integration:** Streaming responses via `POST /api/questions/[id]/claude`. Uses Anthropic SDK streaming mode, piped as ReadableStream. Conversations stored as JSON message arrays in `claude_conversations` table. API key in `.env.local` as `ANTHROPIC_API_KEY`.

**LaTeX:** `LatexRenderer` component wraps KaTeX. Used in question cards, detail view, notes, and Claude responses. `LatexInput` provides live preview with debounced rendering.

## Key Conventions

- `better-sqlite3` requires `serverExternalPackages: ['better-sqlite3']` in `next.config.ts`
- Database file (`data/`) is gitignored — schema is code, data is not
- Tags use normalized tables (tags + question_tags), not JSON arrays
- All math rendering goes through the shared `LatexRenderer` component
- QuickCapture component is the highest-priority UX — keep it fast and minimal
