# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

A local-first web app for capturing and exploring math research questions. Built for a single user on localhost — no auth. The core design principle is **speed of question capture** (under 10 seconds from thought to saved question).

## Tech Stack

- Next.js (App Router) + TypeScript + Tailwind CSS
- SQLite via `better-sqlite3` (synchronous, server-side only)
- `sqlite-vec` for vector similarity search
- KaTeX for LaTeX rendering (`$...$` inline, `$$...$$` display)
- SWR for client-side data fetching
- `@huggingface/transformers` for local embeddings (nomic-embed-text-v1.5)

## Commands

```bash
npm run dev          # Start dev server (localhost:3000)
npm run build        # Production build
npm run lint         # ESLint
npx tsx scripts/migrate-to-uuid.ts     # Migrate old integer-ID database to UUIDs
npx tsx scripts/backfill-embeddings.ts # Regenerate vector embeddings
```

## Architecture

### Database

SQLite file at `./data/questions.db`, auto-created on first run. Schema lives in `src/lib/db.ts` (runs CREATE IF NOT EXISTS on import). No ORM — direct `better-sqlite3` prepared statements in `src/lib/queries.ts`.

**Primary keys are UUIDs** (TEXT) generated with `crypto.randomUUID()`. All ID types in TypeScript are `string`, not `number`. Never use `parseInt()` on IDs from URL params — pass them as strings.

**Tables:** `questions`, `tags`, `question_tags` (junction), `notes`, `related_questions` (junction, CHECK constraint ensures `question_id_1 < question_id_2` via string comparison), `settings` (key-value store for LaTeX macros etc).

**Search:** FTS5 virtual tables (`questions_fts`, `notes_fts`) are standalone (not content-linked) with an `id` TEXT column for joining back to base tables. Kept in sync via triggers. `vec_questions` and `vec_notes` are `sqlite-vec` vec0 tables with TEXT primary keys.

**Hybrid search:** `queries.ts` implements RRF-based hybrid search combining FTS5 keyword matches with vector similarity, with configurable note influence weight.

### Routing

Next.js App Router. Pages: `/` (home with QuickCapture + question list), `/q/[id]` (question detail with notes and related questions), `/print` (PDF preview for selected questions).

API routes: `/api/questions/`, `/api/questions/[id]/notes`, `/api/questions/[id]/related`, `/api/notes/[noteId]`, `/api/questions/batch`, `/api/questions/reorder`, `/api/search`, `/api/tags`, `/api/settings/latex-macros`.

### LaTeX

`LatexRenderer` component wraps KaTeX. Used in question cards, detail view, notes. `LatexMacrosContext` provides user-defined macros from settings. `LatexPreambleEditor` for editing macros.

## Key Conventions

- `better-sqlite3` and `sqlite-vec` require `serverExternalPackages` in `next.config.ts`
- Database file (`data/`) is gitignored — schema is code, data is not
- Tags use normalized tables (tags + question_tags), not JSON arrays
- All math rendering goes through the shared `LatexRenderer` component
- QuickCapture component is the highest-priority UX — keep it fast and minimal
- All IDs are UUIDs (TEXT type) — never use integer IDs or `parseInt` on them
- FTS5 tables are standalone (not content-linked) — triggers maintain them
- The `updated_at` column exists on questions, notes, tags, and settings
