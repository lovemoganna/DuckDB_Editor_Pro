# 🧠 PLAN - AI Skills UI Optimization (Brainstorming)

## Context
The user has requested to **further optimize the AI Skills UI**. Based on the recent refactoring, the UI is already applying a high-contrast Monokai theme, but the layout in `SkillInvoker` is still predominantly a single-column vertical form. Since the requirements are open-ended (`需要进一步优化 AI Skills 的 UI`), according to the `frontend-design` and `ui-ux-pro-max` Socratic Gate protocols, we must clarify the preferred layout, style, and interaction model.

---

## 🛠 Brainstorming Options (User Review Required)

The current layout (`SkillInvoker.tsx`) is a vertical stack (Header → AI Suggestion → Form Fields → Live Preview → Buttons). To optimize this, we have 3 distinct structural paths.

### Option A: 📊 High-Density Tactical (Command Center Split-Pane)
**Best for**: Power users, complex SQL generation, desktop-first.
- **Description**: Convert the single column into a **Two-Column Split Pane**. Left side: Input fields (tightened padding, minimal spacing). Right side: Sticky Live SQL Preview and AI suggestions.
- ✅ **Pros**: Zero scrolling required to see the output. High visibility of cause-and-effect.
- ❌ **Cons**: Can feel overwhelming for beginners. Requires wider screen real estate.
- 📊 **Effort**: Medium

### Option B: 🎯 Focus Mode (Progressive Disclosure)
**Best for**: Clean, distraction-free workflow.
- **Description**: Hide advanced fields and Live SQL preview by default. Only show the absolute minimum required fields. Use larger typography (Mac-like Spotlight feel) for the primary "AI Suggestion" input.
- ✅ **Pros**: Follows Hick's Law. Extremely clean and premium look.
- ❌ **Cons**: Extra clicks needed for advanced SQL tweaking.
- 📊 **Effort**: Low-Medium

### Option C: 🤖 AI-First Conversational (Chat-Driven Configuration)
**Best for**: "Magic" UX experience.
- **Description**: Revolve the entire UI around the AI Prompt box. As the user types, the form fields below dynamically populate and animate. The form acts as a "receipt" of what the AI understood, rather than a primary input method.
- ✅ **Pros**: Feels highly futuristic and intelligent.
- ❌ **Cons**: Harder to implement perfectly. Could feel unpredictable if AI suggestions fail.
- 📊 **Effort**: High

---

## 💡 Proposed Recommendation

**Option A (High-Density Tactical)** is recommended because we previously transitioned the app to a "Command Center" architecture styling. It maximizes productivity by showing inputs and live SQL previews side-by-side, perfect for developer/analyst tools like DuckDB Editor.

**What direction would you like to explore?**
