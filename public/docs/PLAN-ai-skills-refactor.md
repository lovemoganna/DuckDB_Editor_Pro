# 🧠 PLAN - AI Skills Refactoring

## Description
Comprehensive architectural and UI/UX refactoring of the AI Skills module, transitioning from a monolithic `SkillPanel.tsx` to a modular, declarative, and scalable architecture. This plan integrates official DuckDB handbook rules, a declarative generator registry, and adheres to strict UI/UX Pro Max standards.

---

## 🛠 Refactoring Goals

1. **Decouple `SkillPanel.tsx`**
   - Move from `components/SkillPanel.tsx` to `components/skills/` directory.
   - Break down into smaller, focused sub-components.
   - Eliminate prop drilling using a centralized State Management solution (React Context or Zustand).

2. **Declarative Generator Registry**
   - Refactor `skillRouter.ts` and `skillRegistry.ts`.
   - Remove hardcoded if-else/switch routing.
   - Implement a dynamic plugin-like structure where skills define their triggers and execution strategies declaratively.

3. **Codebase Cleanup**
   - Remove deprecated stubs: `skillTester.ts`, `skillDiagnostics.ts`.
   - Remove mock/static marketplace data if applicable.

4. **UI/UX & Frontend Design Enhancements**
   - Adopt strict visual design principles (No purple/violet, NO bento grids if not needed).
   - Ensure High Contrast (Monokai theme optimization).
   - Add purposeful framer-motion micro-animations for Skill execution and transitions.
   - Ensure proper Accessibility (ARIA, focus-states).
   - Inject Official DuckDB Handbook guide rules directly into the execution UI.

---

## 📅 Implementation Phases

### Phase 1: Cleanup & Structure
- [ ] Create `components/skills/context/SkillContext.tsx` for state management.
- [ ] Move `components/SkillPanel.tsx` to `components/skills/index.tsx`.
- [ ] Delete `services/skillTester.ts` and `services/skillDiagnostics.ts`.
- [ ] Remove `SkillTestPanel.tsx` dependencies.

### Phase 2: React State & UI Decoupling
- [ ] Implement `SkillProvider` to wrap the Skills panel.
- [ ] Refactor `BrowseMode` and `OfficialMode` to consume the Context instead of props.
- [ ] Apply `ui-ux-pro-max` guidelines to the skills layout (replace any cliché glassmorphism with high-contrast flat Monokai styling, clear focal points, and proper spacing).

### Phase 3: Declarative Skill Routing
- [ ] Update `skillRegistry.ts` to fully support `triggers` for all routing (deprecate intentKeywords).
- [ ] Update `skillRouter.ts` to execute based on matched generators rather than hardcoded default mappings.
- [ ] Wire up DuckDB official rules dynamically during execution.

### Phase 4: Polish & Audit
- [ ] Verify animations (Framer Motion).
- [ ] Run `ux_audit.py` (if available) / manual UX check.
- [ ] Validate Type Definitions and ensure no TypeScript errors.

---

## 🚦 Socratic Gate Questions (For User Approval)

1. **State Management**: Would you prefer using React Context (built-in, lightweight) or Zustand (better performance, no re-rendering issues) for the new `SkillContext`?
2. **Routing Extensibility**: Should the declarative registry support async/lazy-loaded skill definitions, or will all built-in skills be bundled upfront?
3. **Design System**: Do you prefer a "High-contrast Brutalist" approach for the UI, or a "Refined Flat Minimal" approach (keeping within the Monokai theme)?

