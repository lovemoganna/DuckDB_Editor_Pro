# PLAN-graph-animation

## 任务目标
基于 `ui-ux-pro-max` 的专业设计规范，优化本体论图谱 (Ontology Graph) 的视觉体验，消除当前的“视觉污染”和不可读性，通过重构动画和发光逻辑，使其达到克制、专业、清晰的高级 SaaS 界面标准。

## 根因分析 (Visual Pollution Sources)
`D3GraphView` 已对齐 Network-Vector 视觉规范，重构已完成：
1. **过度动画 (Over-animation)**: 
   - `animated: link.weight >= 0.8 || isHighlighted`
   - 重量 >= 0.8 的连线默认就会开启流动动画（Marching Ants）。当核心连接较多时，满屏都是流动的线，极度干扰阅读。
2. **常驻光晕 (Persistent Node Glow)**:
   - 节点默认包含发光效 `0 0 8px ${theme.glow}`，大量节点同屏时会导致画面脏乱，失去焦点。
3. **连线高对比度轰炸 (High Contrast Edges)**:
   - 未选中的连线亮度过高，缺乏层级感。

## Socratic Gate (待确认的边界问题)
在实施改造前，需要与用户确认以下设计决策（见提示词询问）。

## 实现步骤分解

### Phase 1: 动画克制 (Animation Restraint)
- 移除边级别的默认动画，仅在 `isHighlighted` (路径追踪高亮) 或节点被明确选中 (`selectedNode`) 的关联入/出边上启用流动动画。
- 引入平滑动画曲线，使用 `transition: stroke 0.3s, opacity 0.3s` 确保状态切换自然。

### Phase 2: 视觉降噪 (Visual De-cluttering)
- 去除节点的默认发光（Glow）效果，改为基于干净的 Drop Shadow (`0 4px 12px rgba(0,0,0, 0.2)`) 构建纵深。
- 仅保留 `Hover` 和 `Selected` 状态下的克制性光晕强调。
- 调整默认连线的 Opacity (透明度)，降低未被激活时的视觉权重（从 1.0 降至 0.5 - 0.7 范围内），让节点本身成为主视觉。

### Phase 3: 连线与粗细重构 (Edge Thickness UX)
- 优化连线粗细逻辑，不再仅根据 weight 强行给过大的 strokeWidth。保持视觉纤细感。
- 优化 `strokeDasharray` 计算方式，减少由于密集虚线带来的摩尔纹或杂乱感。

### Phase 4: 性能验证与交互审查
- 根据 `@ui-ux-pro-max` 检查表：
  - Hover 状态是否引起布局位移 (Layout Shift) - 当前逻辑无，需保持。
  - 过渡时间是否处于 150-300ms 黄金区间。
  - 是否所有交互拥有稳定指针反馈。

## 执行代理指定
- **Agent**: `frontend-specialist` (React + Tailwind + CSS 专家)
- **Target File**: `components/Library/D3GraphView.tsx`
