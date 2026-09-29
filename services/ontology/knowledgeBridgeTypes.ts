/**
 * knowledgeBridgeTypes.ts
 * 「知识学习 × 本体建模」联动层核心数据结构与契约定义
 */

import { MECELayer } from '../../types/ontology';
import { AssetType, KnowledgeAsset } from '../../components/KnowledgeHub/types';

/** 概念关系类型（上位、下位、关联、因果约束等） */
export type ConceptRelationType = 'super' | 'sub' | 'associated' | 'constrains' | 'derived_from';

/** 概念节点摘要（用于轻量透镜渲染与三层关系树） */
export interface BridgeConceptNode {
  id: string;               // 唯一标识 (例如 'obj-1', 'type-2', 或语义化 key)
  name: string;             // 概念中文名称 (例如 'Parquet 列式存储')
  rawName?: string;          // 英文或技术原名 (例如 'ParquetStorage')
  category: string;         // 分类/标签
  meceLayer: MECELayer;     // MECE 分层：foundation | relations | methodology | patterns | domains
  description?: string;     // 概念简短定义
  entityType: 'objectType' | 'object' | 'linkType' | 'action'; // 对应本体层要素
  status?: string;          // 状态（如 'active', 'stable', 'warning'）
  propertiesCount?: number; // 属性数量
  sourceBlockIndex?: number;// 对应的代码块序号 (1-indexed)
  tutorialAnchor?: string;  // 反向定位锚点 (如 'code-block-1')
  customProperties?: Record<string, any>; // 动态提取的扩展字段与执行指标
}

/** 概念三层关系拓扑 */
export interface ConceptHierarchyNeighbors {
  currentNode: BridgeConceptNode;
  superConcepts: BridgeConceptNode[];    // 上位概念（抽象/父级）
  subConcepts: BridgeConceptNode[];      // 下位概念（具体/子级/实例）
  associatedConcepts: Array<{            // 关联概念（横向连线）
    node: BridgeConceptNode;
    predicate: string;                   // 连线谓词标签（例如 'optimizes', 'indexes', 'manages'）
    direction: 'incoming' | 'outgoing';
  }>;
}

/** 教程/笔记 与 本体节点的多维映射记录 */
export interface KnowledgeOntologyMapping {
  assetId?: string;                      // 对应的知识资产 ID (Note/Code/Metric)
  tutorialId?: string;                   // 对应的文档教程 ID (如 '001', 'Quick_Tutorial')
  sectionAnchor?: string;                // 章节锚点 / H2/H3 标题
  keywords: string[];                    // 匹配关键词（如 ['parquet', '列投影', 'wasm']）
  targetConceptId: string;               // 映射的目标本体概念 ID
  constructionRationale: string;         // 「本体是如何构建出来的」方法论解释
  suggestedAction?: string;              // 推荐实操/动手推演指令
}

/** 知识沉淀新增时的本体增量变动建议 (Impact Delta) */
export interface OntologyPrecipitationDelta {
  suggestedNewNodes: Array<{
    tempId: string;
    name: string;
    entityType: 'objectType' | 'object';
    meceLayer: MECELayer;
    reason: string;
    suggestedProperties: Record<string, any>;
  }>;
  suggestedNewLinks: Array<{
    tempId: string;
    sourceConceptId: string;
    targetConceptId: string;
    predicate: string;
    reason: string;
  }>;
  suggestedNodeUpdates: Array<{
    conceptId: string;
    conceptName: string;
    addProperties: Record<string, any>;
    reason: string;
  }>;
}

/** 反查关联教程条目 */
export interface ReverseTutorialItem {
  assetId: string;
  title: string;
  type: AssetType | 'tutorial';
  summary?: string;
  matchedKeywords: string[];
  relevanceScore: number;
}
