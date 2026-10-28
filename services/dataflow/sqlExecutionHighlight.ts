import { StateEffect, StateField } from "@codemirror/state";
import { Decoration, EditorView, type DecorationSet } from "@codemirror/view";

export const setExecutionHighlight = StateEffect.define<{
  from: number;
  to: number;
} | null>();
export const executionHighlight = StateField.define<DecorationSet>({
  create: () => Decoration.none,
  update(value, transaction) {
    for (const effect of transaction.effects)
      if (effect.is(setExecutionHighlight)) {
        if (!effect.value) return Decoration.none;
        const from = Math.max(
          0,
          Math.min(effect.value.from, transaction.newDoc.length),
        );
        const to = Math.max(
          from,
          Math.min(effect.value.to, transaction.newDoc.length),
        );
        return from === to
          ? Decoration.none
          : Decoration.set([
              Decoration.mark({ class: "cm-dataflow-highlight" }).range(
                from,
                to,
              ),
            ]);
      }
    return value.map(transaction.changes);
  },
  provide: (field) => EditorView.decorations.from(field),
});
export const executionHighlightTheme = EditorView.baseTheme({
  ".cm-dataflow-highlight": {
    backgroundColor:
      "color-mix(in srgb, var(--color-monokai-accent, #a6e22e) 20%, transparent)",
    borderBottom: "2px solid var(--color-monokai-accent, #a6e22e)",
  },
});
