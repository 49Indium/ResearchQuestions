# Research Questions

A local-first web app for capturing and exploring math research questions. Optimized for speed of capture — under 10 seconds from thought to saved question.

## Setup

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). The SQLite database is auto-created at `data/questions.db` on first run.

## Features

- Quick capture with LaTeX support (`$...$` inline, `$$...$$` display)
- Full-text + semantic hybrid search
- Notes, tags, and question linking
- Drag-and-drop reordering
- Export to Markdown, ZIP, or PDF

## Migration

If upgrading from an older version with integer IDs:

```bash
npx tsx scripts/migrate-to-uuid.ts
npx tsx scripts/backfill-embeddings.ts  # regenerate vector embeddings
```
