const mermaidSource =
  "https://cdn.jsdelivr.net/npm/mermaid@11.12.2/dist/mermaid.esm.min.mjs";

let mermaidPromise;

const loadMermaid = () => {
  mermaidPromise ??= import(mermaidSource).then(({ default: mermaid }) => {
    mermaid.initialize({
      startOnLoad: false,
      theme: "base",
      securityLevel: "strict",
      themeVariables: {
        fontFamily:
          'Inter, "Noto Sans SC", "Microsoft YaHei", system-ui, sans-serif',
        primaryColor: "#e4f0ec",
        primaryTextColor: "#1f2925",
        primaryBorderColor: "#176b5b",
        lineColor: "#65716b",
        secondaryColor: "#f8eadc",
        tertiaryColor: "#fffdf8",
      },
    });

    return mermaid;
  });

  return mermaidPromise;
};

const showFallback = (nodes) => {
  nodes.forEach((node) => {
    const status = document.createElement("p");
    status.className = "diagram-status";
    status.textContent =
      "图示暂未渲染。上方仍保留完整的节点与连线文本，可据此核对模型。";
    node.insertAdjacentElement("afterend", status);
  });
};

const renderDiagrams = async (root = document) => {
  const nodes = [
    ...root.querySelectorAll(".mermaid:not([data-processed='true'])"),
  ];

  if (nodes.length === 0) return;

  try {
    const mermaid = await loadMermaid();
    await mermaid.run({ nodes });
  } catch {
    showFallback(nodes);
  }
};

document.querySelectorAll("[data-reveal]").forEach((button) => {
  button.addEventListener("click", () => {
    const target = document.getElementById(button.dataset.reveal);

    if (target?.classList.contains("is-visible")) {
      renderDiagrams(target);
    }
  });
});
