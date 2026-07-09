# Handover Document: Ontology Canvas Module

This document outlines the design, implementation state, and future direction of the **Ontology Canvas (本体画布) Module** within the DuckDB Manager project. It serves as a comprehensive guide for any developer stepping in to continue development.

---

## 1. 当前项目理解 (Project Understanding)
**DuckDB Manager** is a visual analytics and schema design suite powered by DuckDB in the browser. The **Ontology Module** represents a high-level conceptual layer built on top of traditional database schemas, enabling users to:
1. Model real-world entities (Objects) and semantic associations (Links) instead of just raw database tables.
2. Formulate logical schemas through visual graph interactions and dynamic AI generation.
3. Automatically transform high-level ontological specifications into executable DuckDB SQL pipelines (CTEs, transforms).

---

## 2. 当前模块状态 (Module Status)
The Ontology module operates using a **Three-View Architecture**:
* **Graph View (`D3GraphView.tsx`)**: Global topological network representation using D3 force-directed simulations.
* **Data View (`OntologyDataView.tsx`)**: Grid-based CRUD management for base tables/objects.
* **Canvas View (`OntologyCanvas.tsx`)**: The primary visual modeling workspace enabling free-form layout, logical groupings (Spaces), step-by-step methodologies, and AI-driven structure generation.

### Completed Features:
- [x] Unified global state via React Context/Hooks (`useOntologyStore.ts`) synced to DuckDB tables.
- [x] Zooming, panning, dragging, and dynamic collision resolution in the workspace (`OntologyCanvas.tsx`).
- [x] Multi-tier clearing mechanism (L1 selected node, L2 selected space, L3 canvas reset).
- [x] Visual semantic mapping using MECE colors (Foundation, Relations, Methodology, Patterns, Domains).
- [x] History undo/redo state stacks and card locking states in local storage.
- [x] Context-aware AI Fill options linked to `ontologyAiService.ts`.

---

## 3. 设计原则 (Design Principles)
All work on the Ontology Canvas must adhere to these foundational principles:

### A. DOM-over-D3 Viewport
* **Why**: Pure Canvas or SVG elements make complex nested UI cards (such as cards containing dropdowns, form inputs, status tags, and action buttons) extremely difficult to develop and maintain.
* **Implementation**: We use D3.js exclusively to calculate and apply transform strings (`translate(x, y) scale(s)`) to a container `div`. All child cards inside this container are standard React/HTML components with absolute coordinates.

### B. MECE-Guided AI Synthesis
* **Why**: LLM layout generations are highly chaotic when unconstrained.
* **Implementation**: We restrict layout logic to the **MECE** framework. Prompts sent to `ontologyAiService` must ask the model to produce data categorized strictly into one of the 5 layers:
  1. **Foundation (对象类/基础层)**: Main classes and object definitions.
  2. **Relations (关系层)**: Connection paths and joining keys.
  3. **Methodology (方法层)**: Sequenced workflows or logical stages.
  4. **Patterns (模式层)**: Core SQL/Transform patterns.
  5. **Domains (领域层)**: Bounded contexts/Subdomains.

### C. Single Source of Truth (SSOT)
* **Why**: Prevent divergence between graph visualizations, raw CRUD data sheets, and AI workspace states.
* **Implementation**: View states are localized to the Canvas, but all physical entity metadata must reside in `useOntologyStore.ts` and write back to DuckDB.

---

## 4. Coding Conventions
When writing or refactoring code in this module:
* **Pragmatism Over Boilerplate**: Keep code direct, concise, and self-documenting. Avoid deeply nested helper wrappers unless they encapsulate discrete algorithms (like `resolveCollisions`).
* **Zustand/Store Operations**: Always invoke state modifications using actions defined inside `useOntologyStore.ts`. Do not attempt to mutate store states from components directly.
* **Tailwind Class Concatenation**: Avoid arbitrary styling utilities where possible. Ensure semantic themes (such as MECE colors) are mapped to tailwind config primitives or structured constants like `MECE_LAYER_COLORS`.
* **TypeScript Integrity**: Avoid casting to `any`. Type definitions for the Ontology Canvas reside in `components/Library/OntologyCanvas.types.ts` and `types/ontology.ts`.

---

## 5. 未完成 TODO (Unfinished Tasks)
- [ ] **SQL Compilation Pipeline**: Translate the absolute canvas paths (Space -> Item -> Edge) into nested SQL CTE templates and generate duckdb execution flows.
- [ ] **Canvas State Serialization**: Move spatial layout data (e.g. coordinates `x, y`, node locks) from LocalStorage to DuckDB metadata tables to ensure layouts persist across browsers.
- [ ] **Dynamic Layout Engine Integration**: Integrate layout engines (e.g., Dagre or ELK) to handle visual placement programmatically upon AI updates.
- [ ] **Component Decomposition**: Refactor the monstrous `OntologyCanvas.tsx` (1800+ lines) into cleaner subcomponents:
  - `CanvasToolbar.tsx`
  - `CanvasItemCard.tsx`
  - `CanvasEdgeRenderer.tsx`

---

## 6. 已知 Bug (Known Bugs)
- **Grid Lock Alignment Shift**: When dragging multiple components rapidly, the collision avoidance system (`resolveCollisions`) pushes nodes onto grid coordinate multiples which occasionally results in a permanent 1-pixel rounding offset.
- **D3 Focus Reset Zoom Stutter**: Activating Focus Mode on a deeply nested element occasionally triggers a dual state update, causing D3's transition to jitter before centering.
- **Edge Anchor Disconnection**: When zooming out below `0.5`, SVGs drawing line edges sometimes miscalculate bounding box boundaries, causing arrows to float off the cards.

---

## 7. 已知风险 (Known Risks)
* **Performance Degradation (No Virtualization)**: Since the canvas renders standard React DOM elements, rendering >100 entity cards with heavy state and input boxes simultaneously will result in UI lag during D3 pan/zoom events.
* **AI Output Hallucinations**: Prompt parameters rely on the AI returning strict coordinate coordinates. If the model hallucinates or fails to parse numeric fields, cards may render out-of-bounds or overlap.

---

## 8. 下一步建议 (Next Steps)
1. **Move Positions to Database**: Address the LocalStorage persistence gap first. Create a DuckDB table `ontology_canvas_layout` containing `(object_id, x, y, is_locked)`.
2. **Break down `OntologyCanvas.tsx`**: Extract the SVG rendering paths (`CanvasEdgeRenderer`) and toolbar menus to shrink the main file.
3. **Enhance SQL Generation**: Bind the Canvas "Preview SQL" action to compile nodes sequentially according to Edge dependencies (e.g. topological sort of items).
