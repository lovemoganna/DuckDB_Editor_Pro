# OntologyCanvas MECE 优化设计文档

> 本文档定义了本体图谱画布组件的 MECE（Mutually Exclusive, Collectively Exhaustive）优化方案，解决当前组件冗余、功能重叠、交互碎片化等问题。

---

## 一、痛点分析

### 1.1 组件冗余问题

| 问题组件 | 冗余类型 | 影响 |
|---------|---------|------|
| `BatchOperationsPanel.tsx` | 功能与 `UnifiedCanvasSidebar` 完全重叠 | 维护困难，代码重复 |
| `HistoryPanel.tsx` | 独立面板 vs 侧边栏Tab | 交互不一致 |
| `MeceLayerPanel.tsx` | 独立面板 vs 侧边栏Tab | 功能分散 |
| `BatchPropertiesPanel.tsx` | 与 `UnifiedCanvasSidebar` 属性编辑重叠 | 入口混乱 |

### 1.2 UI/UX 痛点

```
当前布局问题:
┌─────────────────────────────────────────────────────────────┐
│  OntologyCanvasHeader (缺失文件)                           │
├──────┬────────────────────────────────────────────────────┤
│      │                                                     │
│ [侧边栏] │         ReactFlow Canvas                       │
│ 多个按钮 │                                                     │
│ 散布各处 │                                                     │
│      │                                                     │
└──────┴────────────────────────────────────────────────────┘

问题:
1. BatchOperationsPanel: left-3, top-[130px] - 独立按钮
2. MeceLayerPanel: left-3, top-[72px] - 独立按钮  
3. UnifiedCanvasSidebar: left-3, top-[72px] - 已有完整功能
4. 多个面板功能重叠，用户困惑
```

### 1.3 功能边界不清

| 功能模块 | BatchOperationsPanel | UnifiedCanvasSidebar | HistoryPanel | MeceLayerPanel |
|---------|---------------------|-------------------|--------------|----------------|
| 全选/反选 | ✅ | ✅ | ❌ | ❌ |
| 批量重命名 | ✅ | ✅ | ❌ | ❌ |
| 批量移动 | ✅ | ✅ | ❌ | ❌ |
| 批量删除 | ✅ | ✅ | ❌ | ❌ |
| 导出 | ✅ | ✅ | ❌ | ❌ |
| 图层管理 | ❌ | ✅ | ❌ | ✅ |
| 历史记录 | ❌ | ✅ | ✅ | ❌ |

### 1.4 缺失功能

- ❌ 完整的快捷键帮助对话框
- ❌ 搜索增强功能未集成到主界面
- ❌ 拖拽排序节点
- ❌ 批量复制/粘贴
- ❌ 节点属性批量比较视图
- ❌ 路径追踪可视化配置

---

## 二、MECE 解决方案

### 2.1 组件结构重构

```
优化后布局:
┌─────────────────────────────────────────────────────────────┐
│  UnifiedCanvasToolbar (整合所有工具)                        │
├─────────────────────────────────────────────────────────── ┤
│ ┌──────────┐                                            │
│ │ 统一侧边栏 │              ReactFlow Canvas             │
│ │  (单一入口) │                                         │
│ │           │                                            │
│ │ - 选择Tab │                                            │
│ │ - 编辑Tab │                                            │
│ │ - 属性Tab │                                            │
│ │ - 图层Tab │                                            │
│ │ - 历史Tab │                                            │
│ └──────────┘                                            │
└─────────────────────────────────────────────────────────────┘
```

### 2.2 功能 MECE 分层

```
┌─────────────────────────────────────────────────────────────┐
│ L1: 选择层 (Select)                                       │
│   - 单选/多选/框选                                         │
│   - 按类型筛选                                            │
│   - 搜索定位                                              │
├─────────────────────────────────────────────────────────────┤
│ L2: 编辑层 (Edit)                                         │
│   - 批量重命名 (前缀/后缀/替换)                            │
│   - 批量移动 (坐标偏移)                                    │
│   - 批量类型修改                                          │
│   - 复制/剪切/粘贴                                        │
├─────────────────────────────────────────────────────────────┤
│ L3: 属性层 (Properties)                                   │
│   - 批量属性设置/添加/删除                                 │
│   - 属性值批量替换                                        │
│   - 属性比较视图                                          │
├─────────────────────────────────────────────────────────────┤
│ L4: 图层层 (Layers)                                       │
│   - MECE分层                                              │
│   - 可见性/锁定控制                                       │
│   - 图层拖拽分组                                          │
├─────────────────────────────────────────────────────────────┤
│ L5: 历史层 (History)                                      │
│   - 操作历史记录                                          │
│   - 撤销/重做                                            │
│   - 历史跳转                                              │
└─────────────────────────────────────────────────────────────┘
```

### 2.3 统一工具栏设计

```
┌────────────────────────────────────────────────────────────────────────┐
│ [Logo] 本体画布    | 搜索框... | [布局▼] [视图▼] | [撤销][重做] | [导出▼] │
└────────────────────────────────────────────────────────────────────────┘

工具栏分区:
┌─────────┬─────────────────────┬─────────────┬────────────┬──────────┐
│ 品牌区   │      搜索区         │   布局区    │   操作区    │   导出区  │
│ Logo    │  模糊搜索+过滤      │ 布局预设    │ 撤销/重做   │ 格式导出  │
│ 名称    │  类型筛选           │ 间距微调    │ 只读切换    │ 截图导出  │
└─────────┴─────────────────────┴────────────┴────────────┴──────────┘
```

---

## 三、具体优化任务

### 3.1 删除冗余组件

| 文件 | 操作 | 理由 |
|------|------|------|
| `BatchOperationsPanel.tsx` | 删除 | 功能已整合到 `UnifiedCanvasSidebar` |
| `HistoryPanel.tsx` | 删除 | 功能已整合到 `UnifiedCanvasSidebar` |
| `MeceLayerPanel.tsx` | 删除 | 功能已整合到 `UnifiedCanvasSidebar` |
| `BatchPropertiesPanel.tsx` | 删除 | 功能已整合到 `UnifiedCanvasSidebar` |
| `SearchEnhancement.tsx` | 整合 | 合并到 `UnifiedCanvasToolbar` |

### 3.2 重构组件清单

| 组件 | 职责 | 状态 |
|------|------|------|
| `UnifiedCanvasToolbar.tsx` | 统一工具栏 | 需完善 |
| `UnifiedCanvasSidebar.tsx` | 统一侧边栏 | 需优化 |
| `OntologyNode.tsx` | 节点渲染 | 需优化交互 |
| `OntologyEdge.tsx` | 连线渲染 | 已完成 |
| `CanvasContextMenu.tsx` | 右键菜单 | 已完成 |
| `ShortcutsHelpDialog.tsx` | 快捷键帮助 | 需完善 |
| `OntologyCanvas.tsx` | 主画布 | 需整合 |

### 3.3 UnifiedCanvasSidebar Tab 优化

```typescript
// 当前: 5个Tab
type SidebarTab = 'select' | 'edit' | 'properties' | 'layers' | 'history';

// 优化: 精简为4个Tab，符合MECE原则
type SidebarTab = 'select' | 'edit' | 'layers' | 'history';

// 优化理由:
// 1. 'edit' Tab 合并了属性操作
// 2. 减少Tab数量降低认知负担
// 3. 属性操作作为 Edit Tab 的子功能
```

### 3.4 OntologyNode 交互优化

```
当前问题:
┌────────────────────────────────────────┐
│  节点名称                               │
│  ──────────────────────────────────    │
│  [锁定][编辑][复制][删除]  ← hover显示  │
│  ──────────────────────────────────    │
│  属性1: 值1                            │
│  属性2: 值2                            │
│  ──────────────────────────────────    │
│  [类型] 入:3 | 出:5                   │
└────────────────────────────────────────┘

优化后:
┌────────────────────────────────────────┐
│  [锁定] 节点名称 [展开▼]               │ ← 操作按钮稳定化
│  ──────────────────────────────────    │
│  属性: 值                              │
│  ──────────────────────────────────    │
│  [类型] 入:3 | 出:5                   │
│  ──────────────────────────────────    │
│  [选中时显示编辑栏]                    │ ← 选中状态编辑
└────────────────────────────────────────┘

优化点:
1. 锁定状态始终可见图标
2. 展开/折叠按钮稳定
3. 选中时显示快捷编辑栏
4. 双击打开完整编辑对话框
```

---

## 四、交互体验优化

### 4.1 快捷键系统

| 快捷键 | 功能 | 当前状态 |
|--------|------|---------|
| `Ctrl+A` | 全选 | ✅ 已实现 |
| `Ctrl+C` | 复制 | ✅ 已实现 |
| `Ctrl+V` | 粘贴 | ✅ 已实现 |
| `Ctrl+X` | 剪切 | ✅ 已实现 |
| `Ctrl+Z` | 撤销 | ✅ 已实现 |
| `Ctrl+Y` | 重做 | ✅ 已实现 |
| `Delete` | 删除 | ✅ 已实现 |
| `N` | 新建节点 | ✅ 已实现 |
| `F` | 聚焦节点 | ✅ 已实现 |
| `L` | 锁定/解锁 | ✅ 已实现 |
| `R` | 反转连线 | ✅ 已实现 |
| `?` | 帮助对话框 | ⚠️ 需完善 |
| `Escape` | 取消选择 | ⚠️ 需完善 |
| `Ctrl+D` | 复制并新建 | ⚠️ 需完善 |
| `Space` | 框选模式 | ❌ 缺失 |
| `H` | 历史面板 | ❌ 缺失 |

### 4.2 Toast 通知优化

```typescript
// 当前: Toast 分散在各处
addToast?.(`已复制 ${nodeIds.length} 个节点`, 'success');

// 优化: 统一 Toast 工厂函数
const notify = {
  success: (msg: string) => addToast?.(msg, 'success'),
  error: (msg: string) => addToast?.(msg, 'error'),
  info: (msg: string) => addToast?.(msg, 'info'),
  warning: (msg: string) => addToast?.(msg, 'warning'),
};

// 使用
notify.success(`已复制 ${nodeIds.length} 个节点`);
```

### 4.3 确认对话框统一

```typescript
// 当前: 各组件自行实现
const ok = await confirm({
  title: '批量删除节点',
  message: `确定要删除...`,
  variant: 'danger',
});

// 优化: 封装常用确认场景
const confirmDelete = async (count: number) => {
  return confirm({
    title: '批量删除',
    message: `确定要删除选中的 ${count} 个节点吗？`,
    variant: 'danger',
    confirmText: '删除',
    dangerConfirmText: 'DELETE', // 危险操作需输入确认
  });
};
```

---

## 五、技术实现

### 5.1 文件结构

```
components/Library/OntologyCanvas/
├── UnifiedCanvasToolbar.tsx    # 统一工具栏 (重构)
├── UnifiedCanvasSidebar.tsx     # 统一侧边栏 (优化)
├── OntologyNode.tsx            # 节点组件 (优化)
├── OntologyEdge.tsx            # 连线组件
├── CanvasContextMenu.tsx        # 右键菜单
├── ShortcutsHelpDialog.tsx      # 快捷键帮助 (完善)
├── OntologyLayout.ts            # 布局算法
├── OntologyRouting.ts           # 路由算法
├── OntologyExport.ts             # 导出功能
├── OntologyCteCompiler.ts       # CTE编译
├── OntologyCanvas.helpers.ts    # 辅助函数
├── OntologyCanvas.types.ts      # 类型定义
├── hooks/
│   ├── useSelection.ts
│   ├── useHistory.ts
│   ├── useClipboard.ts
│   ├── useKeyboardShortcuts.ts
│   └── useLayoutPresets.ts
└── index.ts

// 删除以下文件
├── BatchOperationsPanel.tsx     # 删除 (功能已整合)
├── BatchPropertiesPanel.tsx     # 删除 (功能已整合)
├── HistoryPanel.tsx             # 删除 (功能已整合)
├── MeceLayerPanel.tsx           # 删除 (功能已整合)
└── SearchEnhancement.tsx        # 删除 (功能已整合到工具栏)
```

### 5.2 类型定义优化

```typescript
// OntologyCanvas.types.ts
export type SidebarTab = 'select' | 'edit' | 'layers' | 'history';

export interface CanvasNotification {
  id: string;
  type: 'success' | 'error' | 'info' | 'warning';
  message: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  duration?: number;
}

export interface CanvasConfirmOptions {
  title: string;
  message: string;
  variant?: 'default' | 'danger' | 'warning';
  confirmText?: string;
  cancelText?: string;
  dangerConfirmText?: string; // 危险操作需输入确认
}
```

### 5.3 Hooks 整合

```typescript
// hooks/useCanvasNotifications.ts - 统一的通知系统
export const useCanvasNotifications = () => {
  const { addToast } = useToastManager();
  
  const notify = useMemo(() => ({
    success: (msg: string) => addToast?.(msg, 'success'),
    error: (msg: string) => addToast?.(msg, 'error'),
    info: (msg: string) => addToast?.(msg, 'info'),
    warning: (msg: string) => addToast?.(msg, 'warning'),
  }), [addToast]);
  
  return notify;
};

// hooks/useCanvasConfirmation.ts - 统一的确认对话框
export const useCanvasConfirmation = () => {
  const { confirm } = useConfirmDialog();
  
  const confirmDelete = async (count: number) => {
    return confirm({
      title: '批量删除',
      message: `确定要删除选中的 ${count} 个节点吗？`,
      variant: 'danger',
      confirmText: '删除',
    });
  };
  
  return { confirm, confirmDelete };
};
```

---

## 六、优先级与里程碑

### Phase 1: 核心整合 (当前)
- [x] 扫描分析
- [ ] 创建统一工具栏
- [ ] 优化统一侧边栏
- [ ] 删除冗余组件

### Phase 2: 交互优化
- [ ] 完善快捷键系统
- [ ] 统一Toast/确认对话框
- [ ] 优化节点交互

### Phase 3: 功能增强
- [ ] 拖拽排序节点
- [ ] 批量复制/粘贴
- [ ] 属性比较视图

---

## 七、验收标准

### 7.1 功能完整性
- [ ] 所有批量操作功能可用
- [ ] 所有快捷键正常工作
- [ ] 历史记录准确追踪

### 7.2 UI/UX 质量
- [ ] 界面层次清晰
- [ ] 功能边界明确
- [ ] 交互流畅无卡顿

### 7.3 代码质量
- [ ] 无组件冗余
- [ ] 类型定义完整
- [ ] 无lint错误

---

*文档版本: v1.0*
*更新时间: 2026-09-14*
*负责人: AI Assistant*
