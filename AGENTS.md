# Codex Operating Profile

This repository is a Windows-based Vite/React DuckDB-WASM product. Treat it as a product/UX-heavy frontend application with a complex ontology module, not as a small SQL demo.

## Default Workflow

1. Inspect the relevant module before editing.
2. Keep changes scoped to the user's requested surface.
3. Prefer real verification over explanation-only answers.
4. Preserve the existing dirty worktree; do not revert unrelated changes.
5. For UI work, run a local build and verify the rendered page in the in-app browser when practical.

## Recommended Plugin Route

Use this route before choosing tools:

- Browser: local app smoke tests, screenshots, console checks, interaction checks on `localhost` or `127.0.0.1`.
- Build Web Apps: React/Vite UI implementation, visual QA, responsive checks, frontend debugging.
- Product Design: product audits, UX structure, flow critique, redesign direction, acceptance screenshots.
- GitHub: PR review, CI failures, review comments, branch/PR publishing.
- Figma: only when the user explicitly wants a Figma artifact, design system, diagram, or screen.
- OpenAI Developers: only for OpenAI API/app/key questions.
- Documents/PDF/Spreadsheets/Presentations: only for artifact work in those formats.
- Notion/Linear/Canva/Chrome/Binance: use only when the user asks for those external surfaces or the task clearly depends on them.

Detailed rationale lives in `.codestable/reference/codex-plugin-routing.md`.

## Project Validation

Use the narrowest validation that proves the change:

- `npm run test:run -- <target>` for targeted Vitest checks.
- `npm run build` for production build validation.
- `npx tsc --noEmit` only when type-level changes need it; this project may have pre-existing global TypeScript errors, so report blockers precisely.
- Browser preview: `npm run preview -- --host 127.0.0.1 --port 4173`, then open `http://127.0.0.1:4173/DuckDB_Editor_Pro/`.

## Ontology Module Guardrails

- `hooks/useOntologyStore.ts` is the source of truth for ontology object/type/link data.
- `OntologyCanvas.tsx` should remain focused on the high-level structure canvas.
- Do not bypass `useOntologyStore` to write ontology facts directly.
- Keep SQL/topology views as advanced outputs, not the first mental model of the ontology canvas.
- When editing canvas behavior, add or update focused tests around pure conversion/state logic.
