# Codex Plugin Routing For DuckDB Manager

Last updated: 2026-06-24

## Why This Exists

This project has accumulated several AI collaboration systems: legacy `.agent` skills, CodeStable notes, project Harness files, and Codex/OpenAI plugins. The current risk is not a lack of tools. The risk is tool sprawl: using the wrong capability for a product/UI task, or treating a rendered UX problem as a code-only task.

The right setup is a small active plugin set with clear routing.

## Repository Shape

- App type: Vite + React 18 + TypeScript.
- Domain: DuckDB-WASM manager with SQL editor, data views, AI skills, Library, Analysis Hub, and Ontology.
- High-risk area: `components/Library/` and `hooks/useOntologyStore.ts`.
- Validation path: targeted Vitest, production build, browser preview.
- User work style: bounded work orders, real execution evidence, product/UX critique before feature sprawl, and careful preservation of dirty worktree changes.

## Active Plugin Set

### Keep Always Enabled

| Plugin | Role in this repo | Use when |
|---|---|---|
| Browser | Rendered local QA | Local preview, screenshots, DOM checks, console errors, interaction smoke tests |
| Build Web Apps | Frontend implementation and debugging | React/Vite UI work, responsive fixes, browser-assisted debugging |
| Product Design | UX audit and product flow critique | Product structure, information architecture, canvas/flow redesign, design QA |
| GitHub | Remote collaboration | PRs, review comments, CI failures, draft PR creation |
| OpenAI Developers | OpenAI platform correctness | API keys, OpenAI API usage, ChatGPT app/platform docs |
| PDF/Documents/Spreadsheets/Presentations | Artifact handling | Only when the user asks for those artifact types |

### Keep Available But Not Default

| Plugin | Why not default |
|---|---|
| Figma | Valuable for design artifacts, but overkill for ordinary code/UI fixes |
| Canva | Presentation/social design only |
| Notion | Only if the user asks to capture or retrieve Notion knowledge |
| Linear | Only if tickets/projects are involved |
| Chrome | Use when existing Chrome login/session state matters; otherwise prefer Browser |
| Binance | Not relevant to DuckDB Manager development |
| Template Creator | Useful only for reusable artifact templates |

## Decision Rules

1. If the task changes visible UI, use Build Web Apps guidance and verify with Browser.
2. If the task is a UX/product audit, start with Product Design and Browser evidence before editing.
3. If the task touches Ontology canvas semantics, add or update pure model tests before broad UI tests.
4. If the task is GitHub-specific, use the GitHub plugin route instead of local-only guessing.
5. If a plugin would require external account state, use it only when the user has asked for that surface.
6. Do not install extra plugins just because a topic is adjacent; first check whether the active set already covers the job.

## Current Local Codex Configuration Notes

The global Codex config already enables the main OpenAI plugins used here:

- `browser@openai-bundled`
- `chrome@openai-bundled`
- `build-web-apps@openai-curated`
- `github@openai-curated`
- `openai-developers@openai-curated`
- `figma@openai-curated`
- `notion@openai-curated`
- `linear@openai-curated`
- `canva@openai-curated`
- `documents`, `pdf`, `spreadsheets`, `presentations`, `template-creator`

The project-level setup should therefore focus on routing, not bulk installation.
