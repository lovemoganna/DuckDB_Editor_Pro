/**
 * OntologyApp - 本体论知识管理主组件
 *
 * 三列布局：左侧 MECE 五层 Tab + 中间内容 + 右侧帮助面板
 *
 * 左侧导航（6 个 Tab）：
 * 1. 基础层 — 核心概念定义（Object/Link Type）
 * 2. 关系层 — 关系实例建模（Link CRUD + 权重）
 * 3. 方法层 — 建模方法论（反思/清理）
 * 4. 模式层 — 核心模式（递归/视图）
 * 5. 领域层 — 垂直领域（种子数据导入）
 * 6. 图谱  — ReactFlow 交互式图谱
 *
 * 每个 Tab 内按语义子导航展开：类型 / 实例 / 模板
 */

import React, { useState } from 'react';
import {
  X,
  Sparkles,
} from 'lucide-react';

import { OntologyMECEPanel } from './OntologyMECEPanel';

interface OntologyAppProps {
  isOpen: boolean;
  onClose: () => void;
  onInsertToEditor?: (sql: string) => void;
  onTablesReady?: () => void;
}

export const OntologyApp: React.FC<OntologyAppProps> = ({
  isOpen,
  onClose,
  onInsertToEditor,
  onTablesReady,
}) => {
  if (!isOpen) return null;

  return (
    <div className="flex h-full w-full overflow-hidden">
      {/* 主内容区 — 复用 OntologyMECEPanel 的完整布局（已含三列结构） */}
      <OntologyMECEPanel
        onInsert={onInsertToEditor}
        onTablesReady={onTablesReady}
      />
    </div>
  );
};

export default OntologyApp;
