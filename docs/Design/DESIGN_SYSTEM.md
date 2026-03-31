# 设计系统规范 — DuckDB Manager Pro

> ⚠️ 本文档由 AI 扫描生成并经人工审计修订，所有后续开发必须严格遵循以下规范。
> 更新时间：2026-03-07
> 扫描基于：`tailwind.config.js`, `index.css`, `package.json`, 全部组件文件

---

## 📌 概览

- **技术栈**：React 18 + TypeScript + Vite + Tailwind CSS + CodeMirror 6
- **CSS 方案**：Tailwind CSS (v3.4) + CSS 自定义属性 + 全局 `!important` 覆盖层 (`index.css`)
- **UI 组件库**：自定义组件 (基于 Monokai 主题) + Lucide React 图标库
- **图表库**：Chart.js 4 + react-chartjs-2 + Recharts
- **辅助库**：ReactFlow (工作流)、Mermaid (图表)、react-grid-layout (仪表盘)
- **设计风格**：Monokai 经典代码编辑器主题 — 深色系、高对比度
- **暗色模式**：✅ 仅暗色模式

---

## 🎨 颜色系统

### Monokai 主题色板
> 来源：`tailwind.config.js` `extend.colors.monokai`

| 名称 | Tailwind Class | 色值 | 用途 |
|------|---------------|------|------|
| **背景色** | | | |
| bg | `bg-monokai-bg` | #272822 | 主背景 |
| surface | `bg-monokai-surface` | #1e1f1c | 输入框/表面/卡片紧凑背景 |
| sidebar | `bg-monokai-sidebar` | #3e3d32 | 侧边栏/面板/卡片标准背景 |
| **前景色** | | | |
| fg | `text-monokai-fg` | #f8f8f2 | 主要文字 |
| fg-muted | `text-monokai-fg-muted` | #75715e | 次要文字 |
| comment | `text-monokai-comment` | #75715e | 注释/占位符 (同 fg-muted) |
| **强调色** | | | |
| accent | `text-monokai-accent` | #66d9ef | 蓝色强调 (同 blue/primary/info) |
| accent-hover | — | #8be9fd | 蓝色悬停态 |
| **语法色** | | | |
| pink | `text-monokai-pink` | #f92672 | 关键字/错误/危险 |
| green | `text-monokai-green` | #a6e22e | 字符串/成功/主操作 |
| yellow | `text-monokai-yellow` | #e6db74 | 警告/高亮 |
| orange | `text-monokai-orange` | #fd971f | 数字/强调操作 |
| blue | `text-monokai-blue` | #66d9ef | 函数/信息/链接 |
| purple | `text-monokai-purple` | #ae81ff | 常量/次要操作 |
| **语义色** | | | |
| primary | `text-monokai-primary` | #66d9ef | 主色 (= accent = blue) |
| success | `text-monokai-success` | #a6e22e | 成功 (= green) |
| warning | `text-monokai-warning` | #e6db74 | 警告 (= yellow) |
| danger | `text-monokai-danger` | #f92672 | 危险 (= pink) |
| info | `text-monokai-info` | #66d9ef | 信息 (= accent) |
| **边框色** | | | |
| border | `border-monokai-border` | #49483e | 独立边框 token |

> ⚠️ **全局覆盖注意**：`index.css` 中 `[class*="border-"]` 被 `!important` 强制覆盖为 `#3e3d32`，因此所有边框实际渲染色为 **#3e3d32** 而非 #49483e。

### Learn 模块扩展色板
> 来源：Learn/ 子组件中硬编码使用

| 色值 | 用途 | 备注 |
|------|------|------|
| #21222c | sidebar/浮窗/代码块头背景 | Dracula 风格深色 |
| #282a36 | 代码区/表格/卡片背景 | Dracula 风格 |
| #2a2b24 | 代码块 header/标题栏 | Monokai 变体 |
| #22231e / #22241e | 斑马纹行/交替行背景 | Monokai 变体 |

> ⚠️ 这些色值未纳入 Tailwind token 体系，目前以 `bg-[#xxx]` 硬编码方式使用。
> **优化方向**：应将常用色值提取到 `tailwind.config.js` 的 `monokai` token 中。

### 其他硬编码色值
> ⚠️ 以下色值在个别组件中使用，应尽量避免

| 色值 | 出现位置 | 说明 |
|------|----------|------|
| #1a1b18 | TableTree | 更深层级背景 |
| #1d1d1b | ChartBuilder | 面板标题背景 |
| #121111 / #121211 | ChartBuilder | 极深背景 |
| #030303 | App.tsx (表格编辑) | 近乎纯黑 |

### 颜色使用规则

- ✅ 所有新组件必须使用 `monokai-*` 颜色变量
- ✅ 背景使用 `monokai-bg` (#272822) / `monokai-surface` (#1e1f1c) / `monokai-sidebar` (#3e3d32)
- ✅ 文字主要使用 `monokai-fg`，次要使用 `monokai-comment`
- ✅ 交互元素使用 `monokai-accent` (#66d9ef) 作为强调色
- ❌ 禁止使用 Tailwind 默认的 gray/slate/red/blue/green 等色板 (已被全局覆盖，视觉效果不可预测)
- ❌ 禁止使用白色背景 (#FFFFFF)
- ❌ 禁止新增 `bg-[#xxx]` 硬编码色值

---

## 📝 排版系统

### 字体
> 来源：`index.css` 全局覆盖 + `tailwind.config.js`

| 类型 | font-family | 来源 | 备注 |
|------|-------------|------|------|
| 全局默认 | `'Victor Mono', 'Noto Sans SC', monospace` | `index.css` `*` 选择器 | 所有 UI + 编辑器统一字体 |
| CodeMirror 编辑器 | `'Victor Mono', 'Noto Sans SC', monospace` | `index.css` `.cm-editor` `!important` | 覆盖 Tailwind 配置 |
| Tailwind font-mono | `'JetBrains Mono', 'Menlo', 'Monaco', ...` | `tailwind.config.js` | ⚠️ 被全局 CSS 覆盖，**实际不生效** |
| Tailwind font-sans | `'Space Grotesk', 'Inter', 'system-ui', ...` | `tailwind.config.js` | 备用配置 |
| Markdown 代码块 | `'Fira Code', 'Consolas', monospace` | `index.css` `.markdown-body pre code` | ⚠️ 遗留用法 |
| Markdown 行内代码 | `'Fira Code', monospace` | `index.css` `.markdown-body code.inline-code` | ⚠️ 遗留用法 |

> ⚠️ **已知问题**：Markdown 区域仍使用 Fira Code，应统一为 Victor Mono。

### 字号层级
> 来源：组件中提取 + index.css

| 名称 | 大小 | 字重 | 用途 |
|------|------|------|------|
| Display | 36px / 2.25rem | 700 | 页面主标题 |
| H1 | 32px / 2rem | 700 | 大标题 |
| H2 | 24px / 1.5rem | 600 | 区块标题 |
| H3 | 20px / 1.25rem | 600 | 卡片标题 |
| Body-lg | 15px | 400 | Markdown 正文 (.markdown-body) |
| Body | 14px / 0.875rem (text-sm) | 400 | 正文 |
| Body-sm | 12px / 0.75rem (text-xs) | 400 | 次要信息/按钮文字 |
| Caption | 10px / 0.625rem (text-[10px]) | 400~700 | 辅助说明/标签/CodeMirror |

### 排版规则

- ✅ 全局使用 Victor Mono
- ✅ 中文 fallback 使用 Noto Sans SC
- ✅ CodeMirror 编辑器/自动补全字号 10px
- ❌ 新组件禁止使用 Fira Code / JetBrains Mono 等其他等宽字体

---

## 📐 间距系统

### 间距基数
> 基于 Tailwind 默认间距 (4px 基准)

| Token | 值 | 常用场景 |
|-------|-----|---------|
| spacing-1 | 4px | 图标与文字间距 |
| spacing-2 | 8px | 元素内边距 |
| spacing-3 | 12px | 紧凑布局 |
| spacing-4 | 16px | 组件内边距 |
| spacing-6 | 24px | 区块间距 |
| spacing-8 | 32px | 页面边距 |

### 常用间距组合

```tsx
// 按钮
px-3 py-1     // 紧凑按钮 (sm)
px-4 py-1.5   // 标准按钮 (md)
px-6 py-2     // 大按钮 (lg)
px-6 py-2.5   // 特大按钮 (xl, 上传类)

// 卡片
p-4           // 紧凑卡片
p-6           // 标准卡片
gap-4         // 网格间隙
gap-2         // 紧凑间隙

// 页面布局
p-6 / p-8     // 页面容器
px-4 md:px-8  // 响应式边距
```

---

## 🔲 圆角系统

> 来源：`index.css` + 组件实际使用

| Token | 值 | 用途 |
|-------|-----|------|
| rounded-sm | 2px | 微型元素 |
| rounded | 4px | 按钮/输入框/模态框(实际) |
| rounded-md | 6px | 代码块 |
| rounded-lg | 8px | 标准卡片/下拉菜单/命令面板 |
| rounded-xl | 12px | 浮窗卡片/大面板 |
| rounded-2xl | 16px | 特大面板 (较少使用) |
| rounded-full | 9999px | 状态徽章/进度条/返回顶部按钮 |

### 圆角使用规则

- ✅ 按钮使用 `rounded` (4px)
- ✅ 标准卡片使用 `rounded-lg`
- ✅ 浮窗/侧边栏面板使用 `rounded-xl`
- ✅ 徽章/标签使用 `rounded-full`
- ✅ 模态框主体——实际代码多用 `rounded`，少数用 `rounded-xl`
- ⚠️ **已知不一致**：应统一模态框为 `rounded-lg` 或 `rounded-xl`

---

## 🌫️ 阴影系统

> 来源：`index.css` 全局覆盖

| Token | 实际渲染值 | 说明 |
|-------|-----------|------|
| shadow-sm | `0 1px 3px rgba(0,0,0,0.3)` | 统一覆盖 |
| shadow | `0 1px 3px rgba(0,0,0,0.3)` | 统一覆盖 |
| shadow-lg | `0 1px 3px rgba(0,0,0,0.3)` | 统一覆盖 |
| shadow-xl | `0 1px 3px rgba(0,0,0,0.3)` | 统一覆盖 |
| shadow-md | *未覆盖* (Tailwind 默认) | ⚠️ 遗漏 |
| shadow-2xl | *未覆盖* (Tailwind 默认) | ⚠️ 组件中大量使用但未统一覆盖 |
| shadow-inner | Tailwind 默认 | 极少使用 |

> ⚠️ **已知问题**：`shadow-md` 和 `shadow-2xl` 未被全局覆盖，与其他阴影表现不一致。

### 发光效果

```tsx
// 状态指示发光 (成功)
shadow-[0_0_5px_rgba(166,226,46,0.5)]

// 微弱色彩阴影悬停 (Learn 模块常用)
hover:shadow-lg hover:shadow-monokai-pink/5
hover:shadow-lg hover:shadow-monokai-yellow/5
```

---

## ✨ 动画与过渡

### 过渡时长

| Token | 值 | 用途 |
|-------|-----|------|
| duration-fast | 150ms / 0.2s | 快速交互 |
| duration-normal | 200ms | 通用过渡 (最常用) |
| duration-slow | 300ms | 页面转场/侧边栏滑入 |

### 缓动函数
- 默认：`ease-in-out`
- 滑入动画：`ease-out`

### 关键帧动画
> 来源：`index.css` + 组件内联

| 动画名 | 效果 | 用途 |
|--------|------|------|
| `fadeIn` | 透明度 0→1 | 模态框遮罩/通知弹窗 |
| `slideIn` | translateY(100%)→0 + 透明度 | 模态框内容 |
| `slideUp` | translateY(100%)→0 + 透明度 | 通知横幅 (定义在 index.css) |

```css
/* index.css 已定义 */
@keyframes slideUp {
    from { transform: translateY(100%); opacity: 0; }
    to { transform: translateY(0); opacity: 1; }
}

/* 组件中内联使用 (未定义为全局 keyframes，通过 Tailwind JIT 模式生效) */
animate-[fadeIn_0.2s]
animate-[slideIn_0.2s_ease-out]
animate-[slideIn_0.1s_ease-out]  /* 命令面板 */
animate-[slideUp_0.3s_ease-out]  /* AI 限流横幅 */
```

### Tailwind 内置动画

| 类名 | 用途 |
|------|------|
| `animate-spin` | 加载旋转 (Loader2 图标、自定义 spinner) |
| `animate-pulse` | 加载脉冲/状态指示 |
| `animate-bounce` | 空状态图标 |

### 交互动画

```tsx
// 按钮点击缩放 (仅 SqlEditor/Uploader/ChartBuilder 中使用)
active:scale-95

// 通用过渡
transition-colors      // 最常用
transition-all         // 多属性变化
transition-transform   // 按钮缩放
```

> ⚠️ **已知问题**：部分 Learn 组件使用 `animate-in fade-in zoom-in-95`（需要 `tailwindcss-animate` 插件），但 `tailwind.config.js` 未安装该插件，可能不生效。

---

## 📱 断点与响应式

> 基于 Tailwind 默认断点

| 断点 | 值 | 用途 |
|------|-----|------|
| sm | 640px | 手机横屏 |
| md | 768px | 平板 |
| lg | 1024px | 小桌面 |
| xl | 1280px | 桌面 |
| 2xl | 1536px | 大桌面 |

- 策略：**Mobile-First** (默认移动端，向上兼容)

```tsx
// 网格响应式
grid-cols-1 md:grid-cols-2 lg:grid-cols-3

// 边距响应式
px-4 md:px-8 lg:px-12
```

---

## 🔣 图标系统

- **图标库**：Lucide React (v0.563.0)
- **默认尺寸**：
  - xs: 10-12px (标签/徽章/状态指示)
  - sm: 14px (按钮图标)
  - md: 16px (工具栏)
  - lg: 20px (标题)
  - xl: 24px (空状态)
- **颜色规则**：跟随 `text-monokai-*` 语义颜色
- ❌ 禁止使用 emoji 替代图标 (目前存在少量遗留 emoji)

```tsx
import { Play, Save, Settings, Loader2, RefreshCw } from 'lucide-react';

// 用法
<Play size={16} className="text-monokai-green" />
<Loader2 size={14} className="animate-spin text-monokai-purple" />
<RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
```

---

## 🧩 组件规范

### Button

**变体：**
| 变体 | Class / 样式 | 用途 |
|------|-------------|------|
| primary | `bg-monokai-green text-monokai-bg font-bold` | 执行/创建/保存 |
| secondary | `bg-monokai-purple text-monokai-fg font-bold` | 次要操作 (AI 修复等) |
| accent | `bg-monokai-blue text-monokai-bg font-bold` | 强调操作 (复制/导入) |
| ghost | `text-monokai-comment hover:text-white` / `hover:bg-monokai-accent` | 低优先级/取消 |
| destructive | `bg-monokai-pink/20 text-monokai-pink hover:bg-monokai-pink hover:text-white` | 危险操作 |
| outline | `border border-monokai-purple text-monokai-purple hover:bg-monokai-purple hover:text-white` | 带边框次要 |
| inline | `bg-monokai-blue/10 border border-monokai-blue/40 text-monokai-blue` | 内联小操作 |

**尺寸：**
| 尺寸 | 内边距 | 字号 | 圆角 |
|------|--------|------|------|
| xs | `px-2 py-1` | text-xs (12px) | rounded |
| sm | `px-3 py-1` | text-xs (12px) | rounded |
| md | `px-4 py-1.5` | text-xs (12px) | rounded |
| lg | `px-6 py-2` | text-sm (14px) | rounded / rounded-lg |

> ⚠️ **全局覆盖注意**：`index.css` 将所有 `<button>` 默认设为 `bg: #3e3d32; text-align: left; color: #f8f8f2`。
> 组件中的具体类名必须足够具体以覆盖此默认值 (Tailwind 实用类通常能覆盖)。

**代码示例：**
```tsx
// 主按钮 (Run/Execute/Create)
<button className="px-4 py-1.5 bg-monokai-green text-monokai-bg font-bold rounded text-xs hover:opacity-90 transition-transform active:scale-95">
  Run
</button>

// 取消按钮
<button className="px-4 py-2 rounded text-sm hover:bg-monokai-accent">
  Cancel
</button>

// 危险按钮
<button className="px-3 py-1 bg-monokai-pink/20 border border-monokai-pink text-monokai-pink rounded hover:bg-monokai-pink hover:text-white">
  Delete
</button>
```

---

### Input / Textarea / Select

> ⚠️ `index.css` 全局覆盖了 `input, textarea, select`：bg=#1e1f1c, color=#f8f8f2, border=#49483e

```tsx
<input
  className="w-full bg-monokai-bg border border-monokai-accent p-2 rounded text-white
             outline-none focus:border-monokai-blue transition-colors
             placeholder-monokai-comment"
/>

// Select (常用样式)
<select className="w-full px-3 py-2 bg-monokai-sidebar border border-monokai-accent rounded text-sm text-monokai-fg focus:outline-none focus:ring-1 focus:ring-monokai-blue">
```

---

### Card / Panel

```tsx
// 标准卡片 (sidebar 背景)
<div className="bg-monokai-sidebar border border-monokai-accent rounded-lg p-6 shadow-lg">

// 紧凑卡片 (主背景或 surface)
<div className="bg-monokai-bg border border-monokai-accent/30 rounded p-4">

// 悬停交互卡片
<div className="bg-monokai-bg border border-monokai-accent rounded-lg p-4 hover:border-monokai-blue transition-colors">
```

---

### Modal / Dialog

```tsx
// 遮罩层
<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md animate-[fadeIn_0.2s]">
  {/* 或使用 z-[100], bg-black/50, backdrop-blur-sm */}

  // 模态框主体
  <div className="bg-monokai-sidebar border border-monokai-accent p-6 rounded shadow-2xl w-96 animate-[slideIn_0.2s_ease-out]">
    {/* 内容 */}
  </div>
</div>
```

> ⚠️ **实际用法不一致**：遮罩层在 `z-50` / `z-[100]` 之间混用，blur 在 `md` / `sm` 之间混用。
> **建议标准**：常规模态 `z-50`，堆叠型弹窗 `z-[100]`。

---

### Table

```tsx
<table className="w-full text-left text-sm whitespace-nowrap border-collapse">
  <thead className="bg-[#1e1f1c] sticky top-0 z-10">
    <tr>
      <th className="p-2 font-mono text-xs text-monokai-blue border-b border-r border-monokai-accent/50">
        Column
      </th>
    </tr>
  </thead>
  <tbody className="font-mono text-xs">
    <tr className="border-b border-monokai-accent/20 hover:bg-monokai-accent/30">
      <td className="p-2 text-monokai-fg">Data</td>
    </tr>
  </tbody>
</table>
```

- 表头背景：`bg-[#1e1f1c]` (surface 色)
- 表头文字：`text-monokai-blue`
- 悬停行：`hover:bg-monokai-accent/30`
- 文本选中色 (可选)：`selection:bg-monokai-pink selection:text-white`

---

### Badge / Tag

```tsx
// 状态徽章
<span className="px-2 py-0.5 bg-monokai-green/20 rounded-full text-xs text-monokai-green">
  已验证
</span>

// 分类标签
<span className="px-2 py-0.5 bg-monokai-purple/30 rounded text-xs text-monokai-purple">
  指标分类
</span>
```

---

### Dropdown / Menu

```tsx
<div className="absolute top-full left-0 mt-1 bg-monokai-sidebar border border-monokai-accent rounded shadow-xl z-50 min-w-[200px]">
  <button className="w-full text-left px-4 py-2 text-xs text-monokai-fg hover:bg-monokai-accent hover:text-monokai-blue transition-colors">
    Menu Item
  </button>
</div>
```

---

### Toast / Notification

```tsx
// 固定底部通知
<div className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-[200] flex items-center gap-2 px-4 py-2.5 rounded-lg shadow-2xl text-sm font-medium transition-all animate-[fadeIn_0.2s] border ${
  type === 'success' ? 'bg-monokai-sidebar border-monokai-green text-monokai-green' :
  type === 'error'   ? 'bg-monokai-sidebar border-monokai-pink text-monokai-pink' :
                       'bg-monokai-sidebar border-monokai-blue text-monokai-blue'
}`}>
```

---

### Tab (选项卡)

```tsx
// 活动/非活动状态切换
<button className={`flex-1 py-2 text-sm font-bold transition-colors ${
  active
    ? 'text-monokai-orange border-b-2 border-monokai-orange bg-monokai-accent/20'
    : 'text-monokai-comment hover:text-white'
}`}>
```

---

## 🎨 全局 CSS 覆盖层

> ⚠️ **重要架构决策**：`index.css` 通过 `!important` 覆盖了大量 Tailwind 默认行为，是设计系统的隐含基础层。

### 被覆盖的类
| 覆盖对象 | 实际效果 |
|---------|----------|
| `.bg-white`, `.bg-gray-*`, `.bg-slate-*` | → `#1e1f1c` (surface) |
| `button, .btn` | → bg: `#3e3d32`, color: `#f8f8f2`, text-align: left |
| `button:hover` | → bg: `#49483e` |
| `input, textarea, select` | → bg: `#1e1f1c`, color: `#f8f8f2`, border: `#49483e` |
| `::placeholder` | → color: `#75715e` |
| `.border`, `[class*="border-"]` | → `#3e3d32` |
| `.text-gray-400~900`, `.text-slate-*` | → `#f8f8f2` |
| `.text-gray-300` | → `#75715e` |
| `.shadow-sm~xl` | → `0 1px 3px rgba(0,0,0,0.3)` |
| `*:focus`, `*:focus-visible` | → outline: `#3e3d32` |
| `.ring-1, .ring-2` | → ring-color: `#3e3d32` |
| `.card, .panel, .rounded-*` | → bg: `#1e1f1c`, border: `#49483e` |

### 滚动条样式
```css
::-webkit-scrollbar { width: 10px; height: 10px; }
::-webkit-scrollbar-track { background: #1e1f1c; border-left: 1px solid #49483e; }
::-webkit-scrollbar-thumb { background: #3e3d32; border-radius: 5px; border: 2px solid #1e1f1c; }
::-webkit-scrollbar-thumb:hover { background: #75715e; }
```

另有 `.custom-scrollbar` 工具类提供相同效果 (通过 `@layer utilities` 定义)。

---

## 📐 布局系统

- **最大宽度**：无全局限制 (全屏应用)
- **页面内容区边距**：`p-6` / `p-8` / `p-10`
- **栅格系统**：Tailwind `grid`
- **栅格间距**：`gap-4` / `gap-6`

### 布局示例

```tsx
// 主布局
<div className="flex h-full">
  <aside className="bg-monokai-sidebar border-r border-monokai-accent">
    {/* 侧边栏 */}
  </aside>
  <main className="flex-1 flex flex-col">
    <header className="bg-monokai-sidebar border-b border-monokai-accent">
      {/* 顶部栏 */}
    </header>
    <div className="flex-1 p-6 bg-monokai-bg overflow-auto">
      {/* 内容区 */}
    </div>
  </main>
</div>
```

---

## 📚 z-index 层级

| 层级 | z-index | 用途 |
|------|---------|------|
| base | 0 | 默认 |
| sticky | 10 | 固定表头/固定元素 |
| dropdown | 20 | 下拉菜单 |
| sidebar | 40 | 侧边栏浮窗 |
| modal | 50 | 标准模态框遮罩+内容 |
| stacked-modal | `z-[100]` | 堆叠弹窗/命令面板/浮窗 |
| toast | `z-[200]` | 通知弹窗 |
| critical-banner | `z-[9999]` | AI 限流等关键提示 |

---

## 📏 CSS 子系统

### Markdown 渲染 (`.markdown-body`)
> 定义在 `index.css`，约 140 行

- 正文色：`#ccc`，行高 1.7，字号 15px
- 标题 h1~h3：`#fff` / `#f8f8f2`，带底部边框
- 链接：`#66d9ef` (accent 色)，hover 下划线
- 粗体：`#fff`；斜体：`#ae81ff` (purple)
- 列表标记：ul `#66d9ef`，ol `#a6e22e`
- 引用块：左边框 `#66d9ef`，背景 `#2a2b24`
- 表格：表头背景 `#2a2b24`，斑马纹 `#22241e`
- 代码块：`.code-block-wrapper` 带 `.copy-btn` + `.run-code-btn`

### SQL 语法高亮
> 定义在 `index.css`

| 类名 | 颜色 | 对应 Monokai 语法色 |
|------|------|---------------------|
| `.sql-keyword` | #ae81ff + font-weight: 600 | purple |
| `.sql-function` | #66d9ef + font-weight: 500 | blue |
| `.sql-string` | #a6e22e + italic | green |
| `.sql-number` | #fd971f | orange |
| `.sql-comment` | #75715e + italic | comment |

### TOC 导航高亮
```css
.toc-highlight {
    outline: 2px solid #66d9ef !important;
    outline-offset: 4px !important;
}
```

---

## 📏 命名约定

- **CSS 变量命名**：`--monokai-[名称]`
- **Tailwind Token**：`monokai-*` 前缀
- **组件文件命名**：PascalCase (`SqlEditor.tsx`, `MetricCard.tsx`)
- **组件目录命名**：kebab-case 或 PascalCase (`schema-generator/`, `Learn/`)
- **UI 基础组件目录**：`components/ui/` (ConfirmDialog, DropZone, EmptyState, Skeleton, Toast)

---

## ✅ 通用规则

### 必须遵守

1. ✅ 所有颜色必须使用 `monokai-*` 变量，禁止硬编码色值
2. ✅ 所有间距必须使用 Tailwind spacing 系统
3. ✅ 所有字号必须使用 Tailwind 文本尺寸 (text-xs / text-sm / text-base 等)
4. ✅ 新建组件必须参考现有组件的变体/尺寸模式
5. ✅ 响应式实现必须使用 Tailwind 断点
6. ✅ SQL 编辑器使用 CodeMirror + Monokai 主题
7. ✅ 所有输入控件占位符颜色 `placeholder-monokai-comment`
8. ✅ 交互元素必须设置 hover/focus 状态
9. ✅ 图标使用 Lucide React，禁止 emoji
10. ✅ 新模态框应使用 `z-50` 或 `z-[100]`，遮罩 `bg-black/50~60 backdrop-blur-sm`

### 禁止事项

1. ❌ 禁止使用 `style={{ }}` 内联样式 (除动态计算值外)
2. ❌ 禁止使用 Tailwind 默认 gray/slate 等色板 (被全局覆盖，效果不可预测)
3. ❌ 禁止使用白色背景 (#FFFFFF)
4. ❌ 禁止跳过组件的 hover/focus/active 状态样式
5. ❌ 禁止在深色主题中使用浅色系 (如 text-gray-900、bg-white)
6. ❌ 禁止新增 `bg-[#xxx]` / `text-[#xxx]` 硬编码色值
7. ❌ 禁止使用 emoji 作为图标

---

## ⚠️ 已知设计一致性问题

### 需优化的遗留模块

| 模块 | 问题 | 优先级 |
|------|------|--------|
| `schema-generator/QualityPanel.tsx` | 大量使用浅色 Tailwind 类 (gray/red/amber/blue/green/indigo/rose) | P1 |
| `schema-generator/QualityBadge.tsx` | 同上 | P1 |
| `schema-generator/EnhancedUI.tsx` | 同上 | P1 |
| `schema-generator/CustomAssertionPanel.tsx` | 同上 | P1 |
| `schema-generator/HistorySidebar.tsx` | 同上 | P1 |
| `TableManager.tsx` | 使用浅色 Tailwind 类 | P1 |
| Markdown 代码字体 | 使用 Fira Code 而非 Victor Mono | P2 |
| `shadow-md` / `shadow-2xl` | 未被全局覆盖，表现不一致 | P2 |
| Learn 模块 `animate-in` | 依赖未安装的 tailwindcss-animate 插件 | P2 |
| 少量 emoji 残留 | `🦆` `⏳` `⌨️` `📂` 等 | P3 |

---

## 🧩 组件代码模板

### 新建组件模板

```tsx
import React from 'react';
import { IconName } from 'lucide-react';

interface Props {
  className?: string;
  children?: React.ReactNode;
}

export const ComponentName: React.FC<Props> = ({ className = '', children }) => {
  return (
    <div className={`bg-monokai-sidebar border border-monokai-accent rounded-lg p-4 ${className}`}>
      <div className="text-monokai-fg">
        {children}
      </div>
    </div>
  );
};
```

---

## 📋 快速参考卡片

### 常用类名速查

| 用途 | 类名 |
|------|------|
| 主背景 | `bg-monokai-bg` |
| 卡片/面板背景 | `bg-monokai-sidebar` |
| 输入框/表面背景 | `bg-monokai-surface` |
| 主文字 | `text-monokai-fg` |
| 次要文字 | `text-monokai-comment` |
| 强调文字 | `text-monokai-accent` |
| 成功 | `text-monokai-green` |
| 警告 | `text-monokai-yellow` |
| 错误/危险 | `text-monokai-pink` |
| 边框 | `border-monokai-accent` |
| 主按钮 | `bg-monokai-green text-monokai-bg font-bold` |
| 次按钮 | `border border-monokai-purple text-monokai-purple` |
| 强调按钮 | `bg-monokai-blue text-monokai-bg font-bold` |
| 取消按钮 | `hover:bg-monokai-accent` |
| 加载旋转 | `animate-spin` |
| 加载脉冲 | `animate-pulse` |
| 模态遮罩 | `bg-black/60 backdrop-blur-md` |
| 模态动画 | `animate-[fadeIn_0.2s]` + `animate-[slideIn_0.2s_ease-out]` |

---

*本文档基于项目代码全面审计后修订，最后更新：2026-03-07*
