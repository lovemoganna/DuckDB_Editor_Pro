# .codestable — 项目知识管理体系

> 本目录是 CodeStable 知识管理的根入口。AI 每次启动时，应首先读取 `attention.md` 建立最小上下文。

## 目录结构

```
.codestable/
├── attention.md          # 项目特殊配置（必读）
├── architecture/          # 架构文档（按模块组织）
│   └── ontology.md       # 本体模块架构
├── features/              # Feature 设计文档
├── requirements/           # 能力愿景文档
├── roadmaps/              # 路线图文档
├── brainstorms/           # 创意记录
├── learnings/              # AI 失败模式与踩坑记录
│   ├── README.md        # 反馈记录格式与已知失败模式
│   └── sessions/        # 按会话记录的反馈（每次会话结束追加）
├── checks/               # 自检清单（开始工作前 + 生成代码后）
│   └── README.md       # 预检清单
└── reference/
    └── shared-conventions.md  # 共享约定
```

## 核心原则

1. **知识存项目里不存脑子里** — 任何设计决策、技术选型、踩坑记录都要落盘
2. **文档是给未来的自己和 AI 看的** — 写清楚"为什么"而不是"是什么"
3. **先读再动** — 每次开始新任务前，先读 `attention.md` 和相关架构文档

## 维护节奏

- **每次会话结束**：记录发现的问题到 `learnings/`
- **每周**：将 bug 分析转为 fix-note，将设计讨论转为 roadmap
- **每月**：全面审查，删除过时规则

## 与 PROJECT-HARNESS.md 的关系

- `PROJECT-HARNESS.md` = AI 协作规则（AI 工作时的约束和语法）
- `.codestable/` = 项目知识积累（架构、决策、踩坑）

两者互补，共同构成项目的"公共记忆"。
