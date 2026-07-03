import React from 'react';
import { Box, Layers, Database } from 'lucide-react';
import type { CanvasMode, MECELayer } from './OntologyCanvas.types';

export const CANVAS_MODE_DESIGN: Record<CanvasMode, {
  label: string;
  labelZh: string;
  icon: React.ReactNode;
  description: string;
  color: string;
  nodeTypes: string[];
  meceLayer: MECELayer | null;
}> = {
  pipeline: {
    label: 'Pipeline',
    labelZh: '管道设计',
    icon: <Box className="w-3.5 h-3.5" />,
    description: '将表拖入画布，手动连线，生成 JOIN / CTE SQL',
    color: '#4f46e5',
    nodeTypes: ['Source', 'Transform', 'Sink', 'Insight'],
    meceLayer: null,
  },
  knowledge: {
    label: 'Knowledge',
    labelZh: '知识结构',
    icon: <Layers className="w-3.5 h-3.5" />,
    description: '用 MECE 五层组织知识本体，沉淀关系与洞察',
    color: '#a78bfa',
    nodeTypes: ['Concept', 'Event', 'Goal', 'Insight'],
    meceLayer: 'foundation',
  },
  explorer: {
    label: 'Explorer',
    labelZh: '表关系探索',
    icon: <Database className="w-3.5 h-3.5" />,
    description: '读取数据库 schema，可视化表与表之间的外键和依赖',
    color: '#38bdf8',
    nodeTypes: ['Table'],
    meceLayer: null,
  },
};
