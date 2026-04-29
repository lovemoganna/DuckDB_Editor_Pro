/**
 * ontologyAiService — 本体论 AI 服务层
 *
 * 核心入口（推荐优先使用）：
 *  - generateOntologyDraft()    — 全局 Draft 生成，组合所有 AI 能力
 *  - generateGraphLayout()      — 图谱布局生成
 *  - generateCanvasLayout()    — 画布布局生成
 *  - generateSuggestions()       — 图谱补全建议
 *  - generateIntrospectionGuidance() — 引导性问题
 *
 * 辅助入口（按需调用）：
 *  - executeLayerWorkflow()   — 简化版层感知工作流（内部使用 LAYER_WORKFLOWS）
 *  - generateObjectModel()    — 对象建模
 *  - generateLinkModel()       — 关系建模
 *  - generateMethodologyAdvice() — 建模方法建议
 *  - generatePatternSQL()      — 高级 SQL 模式生成
 *  - generateDomainModel()     — 完整领域模型生成
 *  - generateCRUDFill()        — CRUD 表单预填充
 *  - generateAbstractionSQL()   — Abstraction 模块专用 SQL
 */

import { aiService } from './aiService';

// AIStage type (mirrored from aiValidator to avoid cross-file resolution issues)
type AIStage = 'p1_semantic' | 'p3_causal' | 'p4_insights' | 'sql_lifecycle' | 'sql_batch' | 'core_analysis' | 'deep_intelligence';

// ============================================================
// Layer-Specific AI Fill Response Types
// ============================================================

export interface OntologyDraftNode {
  id: number;
  object_type_id: number;
  name: string;
  properties: Record<string, any>;
  annotations: string;
}

export interface OntologyDraftLink {
  id: number;
  link_type_id: number;
  source_object_id: number;
  target_object_id: number;
  weight: number;
}

export interface OntologyDraftAction {
  id: number;
  object_id: number;
  name: string;
  description: string;
  status: string;
}

export interface OntologyDraftIntrospection {
  id: number;
  object_id: number;
  question: string;
  answer: string;
}

export interface OntologyDraftInsight {
  id: number;
  object_id: number;
  insight: string;
  tag: string;
}

export interface OntologyDraftPayload {
  objects: OntologyDraftNode[];
  links: OntologyDraftLink[];
  actions: OntologyDraftAction[];
  introspections: OntologyDraftIntrospection[];
  insights: OntologyDraftInsight[];
}

export interface ObjectModelFill {
  objectTypes: Array<{ name: string; description: string; properties: Record<string, string> }>;
  objects: Array<{ typeName: string; name: string; properties: Record<string, any>; annotations: string }>;
  linkTypes: Array<{ name: string; description: string }>;
  suggestedDDL: string;
}

export interface LinkModelFill {
  linkType: { name: string; description: string; temporal: boolean };
  linkInstances: Array<{ sourceName: string; targetName: string; weight: number; note: string }>;
  suggestedDML: string;
}

export interface MethodologyAdvice {
  recommendedMethod: string;
  steps: Array<{ step: number; action: string; sql?: string; introspection: string }>;
  totalComplexity: 'low' | 'medium' | 'high';
}

export interface PatternSQLFill {
  patternType: string;
  description: string;
  sql: string;
  explanation: string;
  tips: string[];
}

export interface DomainModelFill {
  domainName: string;
  objectTypes: Array<{ name: string; description: string }>;
  linkTypes: Array<{ source: string; name: string; target: string; description: string }>;
  seedObjects: Array<{ typeName: string; name: string; properties: Record<string, any> }>;
  seedLinks: Array<{ sourceName: string; linkTypeName: string; targetName: string; weight: number }>;
  views: Array<{ name: string; sql: string; description: string }>;
  initializationSQL: string;
  dynamicMapping: {
    objectTable: string;
    objectTypeTable: string;
    linkTable: string;
    linkTypeTable: string;
    actionTable: string;
  };
}

export interface GraphLayoutPlan {
  nodes: Array<{ id: string; label: string; type: string; x: number; y: number; color: string }>;
  edges: Array<{ source: string; target: string; label: string; weight: number }>;
  layoutAlgorithm: string;
  colorScheme: Record<string, string>;
}

export interface CanvasLayoutPlan {
  spaces: Array<{ id: string; name: string; x: number; y: number; w: number; h: number; color: string }>;
  groups: Array<{ spaceId: string; name: string; x: number; y: number; items: string[] }>;
  layoutDescription: string;
}

export type MECELayer = 'foundation' | 'relations' | 'methodology' | 'patterns' | 'domains';

/** MECE 层感知的画布布局方案 — 每层有独特结构 */
export interface MeceCanvasLayoutPlan {
  layer: MECELayer;
  spaces: Array<{ id: string; name: string; x: number; y: number; w: number; h: number; color: string }>;
  items: Array<{
    id: string;
    spaceId: string;
    objectId?: number;
    objectName: string;
    nodeType: 'Source' | 'Transform' | 'Sink';
    x: number;
    y: number;
    width: number;
    height: number;
    metadata: {
      tableName?: string;
      sqlFragment?: string;
      layerTag?: string;
    };
  }>;
  edges: Array<{ id: string; sourceId: string; targetId: string; label?: string }>;
  layoutDescription: string;
  meceLayerHint: string;
}

export interface CRUDFillContent {
  mode: 'objectType' | 'object' | 'linkType' | 'link' | 'action';
  name: string;
  description?: string;
  properties?: Record<string, any>;
  objectTypeName?: string;
  linkTypeName?: string;
  sourceObjectName?: string;
  targetObjectName?: string;
  weight?: number;
  status?: string;
}

export interface IntrospectionGuidance {
  topic: string;
  questions: Array<{ question: string; hint: string; relatedConcepts: string[] }>;
  reflectionTemplate: string;
}

export interface SuggestionItem {
  type: 'object' | 'link' | 'action' | 'introspection';
  title: string;
  description: string;
  confidence: number;
  action: string;
}

// ============================================================
// AI Workflow Engine
// ============================================================

type MECELayer = 'foundation' | 'relations' | 'methodology' | 'patterns' | 'domains';

interface AIWorkflowResult {
  /** 可直接执行的 SQL */
  executableSQL?: string;
  /** 可直接提交到 DuckDB 的 draft */
  draftPayload?: OntologyDraftPayload;
  /** 原始 AI 响应 */
  raw: any;
  /** 执行摘要 */
  summary: string;
}

interface LayerWorkflow {
  /** 该层的核心 AI 能力 */
  primaryCapability: string;
  /** 输入描述 */
  inputPlaceholder: string;
  /** 输出类型 */
  outputType: 'sql' | 'draft' | 'layout' | 'advice' | 'suggestions';
}

const LAYER_WORKFLOWS: Record<MECELayer, LayerWorkflow> = {
  foundation: {
    primaryCapability: '对象建模',
    inputPlaceholder: '输入业务概念，AI 生成 Object Type + Object 实例模型...',
    outputType: 'sql',
  },
  relations: {
    primaryCapability: '关系建模',
    inputPlaceholder: '输入源对象和目标对象，AI 生成 Link Type + Link 实例...',
    outputType: 'sql',
  },
  methodology: {
    primaryCapability: '方法论建议',
    inputPlaceholder: '输入建模场景，AI 推荐建模范式 + 分步计划...',
    outputType: 'advice',
  },
  patterns: {
    primaryCapability: 'SQL 模式生成',
    inputPlaceholder: '输入分析类型，AI 生成递归 CTE、聚合视图等高级 SQL...',
    outputType: 'sql',
  },
  domains: {
    primaryCapability: '领域模型生成',
    inputPlaceholder: '输入领域名称，AI 生成完整概念-关系模型 + 种子数据...',
    outputType: 'draft',
  },
};

// ============================================================
// Service — 保留 7 个核心方法
// 重构后核心入口为 generateOntologyDraft，其余按需调用。
// ============================================================

class OntologyAiService {

  // ── 全局 Draft 生成（顶层 AI 入口）─
  async generateOntologyDraft(topic: string, maxNodes: number = 8): Promise<OntologyDraftPayload> {
    const prompt = `你是一个顶级的数据科学家和系统架构师，擅长使用 MECE 原则进行本体论（Ontology）建模。
用户的输入主题是：【${topic}】
请构建一个结构化的领域知识图谱模型。

你的输出必须是一个严格的 JSON 对象，包含以下 5 个数组：
1. objects: 核心实体 (id, object_type_id, name, properties, annotations)。object_type_id 建议: 1=Aspect(维度), 2=Person(人物), 3=Goal(目标)。id 必须是 1 到 ${maxNodes} 之间的递增整数。
2. links: 实体之间的关系 (id, link_type_id, source_object_id, target_object_id, weight)。link_type_id: 1=影响(A作用于B), 2=养活(A为B提供基础), 3=锚定(A为B提供支撑), 4=支撑。 weight 是 0.1 到 1.0 的小数。
3. actions: 行动项（属于某个 entity 的具体行动）(id, object_id, name, description, status='pending')。
4. introspections: 沉思/深刻问题 (id, object_id, question, answer)。
5. insights: 洞察结晶 (id, object_id, insight, tag)。

约束：
- 所有 ID 必须从 1100 开始递增（为了避免覆盖本地现有的小 ID 数据，比如 id=1）。
- 每个对象的 properties 是一个 JSON 对象，存放相关的 KV 业务属性，例如 {"status": "active", "priority": "high"}。
- 不要包含 markdown 代码块包围，只要纯粹的 JSON 字符串输出。
- 确保外键引用（source_object_id, target_object_id, object_id）指向 objects 数组中实际生成的 ID。

输出 JSON 格式参考：
{
  "objects": [{"id": 1100, "object_type_id": 1, "name": "核心概念", "properties": {}, "annotations": ""}],
  "links": [{"id": 1100, "link_type_id": 1, "source_object_id": 1100, "target_object_id": 1101, "weight": 0.9}],
  "actions": [],
  "introspections": [],
  "insights": []
}`;

    const configStr = localStorage.getItem('ab-app-config');
    const aiConfig = configStr ? JSON.parse(configStr).ai : null;

    if (!aiConfig?.apiKey) {
      throw new Error('AI Provider API key not configured. Please set it in Settings.');
    }

    try {
      const payload = await aiService.robustCall<OntologyDraftPayload>(
        'ontology',
        prompt,
        '你是一个专门精通图数据库与本体论建模构建的架构师'
      );
      return payload;
    } catch (err) {
      console.error('Failed to parse Ontology Draft JSON:', err);
      throw new Error('AI returned invalid JSON format.');
    }
  }

  // ── 层感知 AI 工作流 ──
  async executeLayerWorkflow(
    layer: MECELayer,
    input: string,
    context?: {
      secondaryInput?: string;
      secondaryInput2?: string;
      existingObjects?: string[];
      existingLinks?: string[];
    }
  ): Promise<AIWorkflowResult> {
    switch (layer) {
      case 'foundation': {
        const result = await this.generateObjectModel(input);
        return {
          executableSQL: result.suggestedDDL,
          raw: result,
          summary: `生成了 ${result.objectTypes?.length || 0} 个对象类型、${result.objects?.length || 0} 个实例、${result.linkTypes?.length || 0} 个关系类型`,
        };
      }
      case 'relations': {
        const result = await this.generateLinkModel(
          input,
          context?.secondaryInput || input,
          context?.secondaryInput2 || ''
        );
        return {
          executableSQL: result.suggestedDML,
          raw: result,
          summary: `生成了关系类型 "${result.linkType?.name}"，含 ${result.linkInstances?.length || 0} 个关系实例`,
        };
      }
      case 'methodology': {
        const result = await this.generateMethodologyAdvice(input);
        return {
          executableSQL: result.steps?.filter(s => s.sql).map(s => s.sql!).join(';\n'),
          raw: result,
          summary: `推荐方法：${result.recommendedMethod}（${result.totalComplexity} 复杂度）`,
        };
      }
      case 'patterns': {
        const result = await this.generatePatternSQL(input, context?.secondaryInput || '');
        return {
          executableSQL: result.sql,
          raw: result,
          summary: `生成了 ${result.patternType} 模式，${result.tips?.length || 0} 条优化提示`,
        };
      }
      case 'domains': {
        const result = await this.generateDomainModel(input);
        return {
          executableSQL: result.initializationSQL,
          draftPayload: {
            objects: [], links: [], actions: [],
            introspections: [], insights: [],
            // @ts-ignore - internal use for mapping update
            mapping: result.dynamicMapping
          } as any,
          raw: result,
          summary: `生成了领域 "${result.domainName}"，包含自定义表：${result.dynamicMapping.objectTable}, ${result.dynamicMapping.linkTable}`,
        };
      }
      default:
        throw new Error(`Unknown layer: ${layer}`);
    }
  }

  // ── Graph / Canvas 布局生成 ──
  async generateGraphLayout(topic: string): Promise<GraphLayoutPlan> {
    return this._callAI<GraphLayoutPlan>(
      'ontology-graph-layout',
      `请为【${topic}】领域生成一个概念图谱的布局方案，用于可视化。

输出必须是纯 JSON（无 markdown 块），包含：
{
  "nodes": [{ "id": "node_1", "label": "节点标签", "type": "object/link/action", "x": 0, "y": 0, "color": "purple/blue/green/orange/yellow" }],
  "edges": [{ "source": "node_1", "target": "node_2", "label": "关系名", "weight": 0.0到1.0 }],
  "layoutAlgorithm": "推荐布局算法（dagre/force/manual）",
  "colorScheme": { "objectType名称": "对应颜色" }
}

要求：nodes 5-10 个，x/y 坐标为 100-600 之间的数值；color 使用 tailwind 支持的颜色名：purple/blue/green/orange/yellow/cyan/red`,
      '你是图可视化布局专家'
    );
  }

  async generateCanvasLayout(scene: string): Promise<CanvasLayoutPlan> {
    return this._callAI<CanvasLayoutPlan>(
      'ontology-canvas-layout',
      `请为【${scene}】场景设计一个自由画布的空间组织方案。

输出必须是纯 JSON（无 markdown 块）：
{
  "spaces": [{ "id": "space_1", "name": "空间名称", "x": 0, "y": 0, "w": 400, "h": 300, "color": "颜色" }],
  "groups": [{ "spaceId": "space_1", "name": "分组名称", "x": 10, "y": 10, "items": ["元素1", "元素2"] }],
  "layoutDescription": "空间布局的整体描述"
}

要求：spaces 1-3 个，groups 每个 space 内 2-4 个分组；color 使用 tailwind 支持的颜色名`,
      '你是空间设计专家'
    );
  }

  /**
   * MECE 层感知画布布局生成
   *
   * @param layer  MECE 五层之一
   * @param existingObjects  画布已有的对象名称列表
   * @param objectTypes      画布已有的对象类型名称列表
   * @param meceLayerHint    MECE 层描述提示（如 CANVAS_MECE_PROMPTS.example(layer)）
   */
  async generateMeceCanvasLayout(
    layer: MECELayer,
    existingObjects: string[] = [],
    objectTypes: string[] = [],
    meceLayerHint: string = '',
  ): Promise<MeceCanvasLayoutPlan> {
    const layerContext: Record<MECELayer, string> = {
      foundation: `当前是 MECE Foundation（基础层）。聚焦于对象类型（Object Type）和实例（Object Instance）的定义。每个 Space 对应一个对象类型，Item 对应实例。对象类型：${objectTypes.join(' / ') || '未定义'}。已有对象：${existingObjects.join(' / ') || '无'}。${meceLayerHint}`,
      relations: `当前是 MECE Relations（关系层）。聚焦于对象间的关系（Link）和关系类型（Link Type）。用 Item 表示对象，用边表示关系，metadata.sqlFragment 存放 JOIN 或 CTE 片段。已有对象：${existingObjects.join(' / ') || '无'}。${meceLayerHint}`,
      methodology: `当前是 MECE Methodology（方法论层）。聚焦于建模范式和分步计划。用 Group 表示方法论步骤（Plan/Build/Review），Item 表示操作要点，metadata.sqlFragment 存放方法论 SQL 示例。${meceLayerHint}`,
      patterns: `当前是 MECE Patterns（模式层）。聚焦于高级 SQL 模式（递归 CTE、聚合视图、时序版本化）。Item 使用 Transform 类型，metadata.sqlFragment 存放 DuckDB SQL 模板。${meceLayerHint}`,
      domains: `当前是 MECE Domains（领域层）。聚焦于完整的领域模型。多个 Space 代表子领域，Space 内 Item 表示核心对象，Item 间边表示领域内关系。${meceLayerHint}`,
    };

    const context = layerContext[layer];
    const existingObjectsStr = existingObjects.length > 0
      ? `已有对象：${existingObjects.join('、')}。`
      : '';

    const prompt = `${context}

${existingObjectsStr}

请为该 MECE 层生成完整的画布布局方案。

输出必须是纯 JSON（无 markdown 块）：
{
  "layer": "${layer}",
  "meceLayerHint": "该层对应的 MECE 描述（简短语）",
  "spaces": [
    { "id": "space_1", "name": "空间名称（如对象类型名或子领域名）", "x": 0, "y": 0, "w": 400, "h": 320, "color": "purple|blue|green|orange|yellow|cyan|red" }
  ],
  "items": [
    {
      "id": "item_1",
      "spaceId": "space_1",
      "objectName": "对象/概念名称",
      "nodeType": "Source|Transform|Sink",
      "x": 10, "y": 10, "width": 180, "height": 75,
      "metadata": { "tableName": "对应表名", "sqlFragment": "SQL片段（可选）", "layerTag": "${layer}" }
    }
  ],
  "edges": [
    { "id": "edge_1", "sourceId": "item_1", "targetId": "item_2", "label": "关系名（可选）" }
  ],
  "layoutDescription": "整体布局描述"
}

要求：
- Foundation 层：1-3 个 Space（每个 = 对象类型），2-5 个 Item（每个 = 实例），线性或分组布局
- Relations 层：0-1 个 Space（可选），3-6 个 Item，3-5 条边，树状或线性拓扑
- Methodology 层：0-2 个 Space（方法论步骤大类），4-8 个 Item，步骤式布局（从上到下或从左到右）
- Patterns 层：0-1 个 Space，2-4 个 Item（Transform 类型），0-2 条边
- Domains 层：2-3 个 Space（子领域），6-10 个 Item，网格或分组布局
- 所有 x/y/w/h 使用数字，不要使用变量
- color 使用 tailwind 支持的颜色名（小写英文）`;

    return this._callAI<MeceCanvasLayoutPlan>(
      'ontology-mece-canvas-layout',
      prompt,
      `你是 MECE 本体论画布布局专家，专注于 ${layer} 层的结构化建模`
    );
  }

  // ── Graph AI 构图（智能分析 + 布局）─
  async generateGraphAIWorkflow(topic: string): Promise<{
    graphLayout: GraphLayoutPlan;
    suggestions: SuggestionItem[];
  }> {
    const [graphLayout, suggestions] = await Promise.all([
      this.generateGraphLayout(topic),
      this.generateSuggestions([], [], 0, 0),
    ]);
    return { graphLayout, suggestions };
  }

  // ============================================================
  // Foundation Layer — Object Model Generation
  // ============================================================
  async generateObjectModel(topic: string): Promise<ObjectModelFill> {
    const prompt = `你是一个本体论建模专家。请为【${topic}】领域生成一个完整的对象模型。

输出必须是纯 JSON（无 markdown 块），包含以下字段：
{
  "objectTypes": [
    { "name": "类型名称（如 UserProfile）", "description": "类型描述", "properties": { "fieldName": "字段类型（VARCHAR/INTEGER/DATE/JSON）" } }
  ],
  "objects": [
    { "typeName": "对应的 objectType.name", "name": "对象名称", "properties": { "key": "value" }, "annotations": "备注" }
  ],
  "linkTypes": [
    { "name": "关系类型名称", "description": "关系描述" }
  ],
  "suggestedDDL": "完整五表 DDL SQL 字符串（包含 CREATE TABLE 和 INSERT 示例，用分号分隔）"
}

要求：
- objectTypes 至少 2 个，最多 4 个
- objects 每个类型至少 1 个
- suggestedDDL 包含 life_object_type、life_object、life_link_type、life_link 四张表的创建语句和示例插入语句
- ID 从 2000 开始递增，避免与现有数据冲突`;

    return this._callAI<ObjectModelFill>(
      'ontology-foundation', prompt, '你是本体论建模专家'
    );
  }

  // ============================================================
  // Relations Layer — Link Model Generation
  // ============================================================
  async generateLinkModel(sourceObject: string, targetObject: string, context: string): Promise<LinkModelFill> {
    const prompt = `你是一个关系建模专家。请分析【${sourceObject}】和【${targetObject}】之间的关系。

背景信息：${context || '无额外背景'}

输出必须是纯 JSON（无 markdown 块），包含：
{
  "linkType": {
    "name": "关系类型名称（英文大写下划线，如 EMPLOYED_BY）",
    "description": "关系语义描述",
    "temporal": true或false（是否有时间属性）
  },
  "linkInstances": [
    { "sourceName": "${sourceObject}", "targetName": "${targetObject}", "weight": 0.0到1.0的数值, "note": "这条关系的备注" }
  ],
  "suggestedDML": "INSERT INTO life_link_type ... 和 INSERT INTO life_link ... SQL 语句"
}

要求：
- linkType.name 使用全大写下划线格式
- weight 建议值：强关系 0.8-1.0，中等 0.5-0.8，弱 0.1-0.5`;

    return this._callAI<LinkModelFill>(
      'ontology-relations', prompt, '你是关系建模专家'
    );
  }

  // ============================================================
  // Methodology Layer — Modeling Approach Advice
  // ============================================================
  async generateMethodologyAdvice(scenario: string): Promise<MethodologyAdvice> {
    const prompt = `用户面临以下本体论建模场景：
【${scenario}】

请推荐合适的本体论建模范式，并给出分步实施计划。

输出必须是纯 JSON（无 markdown 块）：
{
  "recommendedMethod": "推荐的建模方法名称（如：自底向上、混合建模、领域驱动等）",
  "steps": [
    { "step": 1, "action": "具体操作描述", "sql": "相关 SQL 语句（可选）", "introspection": "此步的反思问题" }
  ],
  "totalComplexity": "low | medium | high"
}

要求：steps 至少 4 步，最多 6 步`;

    return this._callAI<MethodologyAdvice>(
      'ontology-methodology', prompt, '你是本体论方法论专家'
    );
  }

  /**
   * 生成 SQL 模板 — Abstraction 模块专用
   * 支持所有 SQL 操作类型 + schema 上下文注入
   */
  async generateAbstractionSQL(request: {
    operation: string;
    concept: string;
    property?: string;
    relation?: string;
    context?: string;
  }): Promise<{ sql: string; explanation: string; patternType: string; tips: string[] }> {
    const { operation, concept, property, relation, context } = request;

    // 根据操作类型映射到 patternType
    const patternDescriptions: Record<string, string> = {
      SELECT: '普通查询 SELECT',
      INSERT: '批量插入 INSERT INTO ... SELECT',
      UPDATE: '条件更新 UPDATE ... SET',
      DELETE: '条件删除 DELETE FROM ... WHERE',
      AGGREGATE: '聚合统计（COUNT/SUM/AVG/GROUP BY）',
      JOIN: '多表关联（LEFT/INNER JOIN）',
      WINDOW: '窗口函数（OVER/PARTITION BY/ROW_NUMBER）',
      CTE: '公用表表达式 WITH AS + 递归 CTE',
    };

    // 拼接完整 prompt
    const fullContext = [
      `## 任务`,
      `请为「${concept}」生成 ${patternDescriptions[operation] || operation} SQL 模板。`,
      property ? `分析维度：${property}` : '',
      relation ? `关联关系：${relation}` : '',
      context ? `\\n## 业务背景\\n${context}` : '',
    ].filter(Boolean).join('\\n');

    const prompt = `${fullContext}

输出必须是纯 JSON（无 markdown 块），包含：
{
  "patternType": "模式类型（英文）",
  "description": "模式功能描述",
  "sql": "完整可执行的 DuckDB SQL 模板（使用 {{placeholder}} 作为参数占位符）",
  "explanation": "SQL 工作原理说明",
  "tips": ["提示1", "提示2"]
}

要求：
- SQL 模板使用 {{placeholder}} 格式作为参数占位符（不要用 \${} 变量格式）
- 生成完整、可直接执行的 SQL 语句
- 注释清晰，便于理解
- 提供 2-3 条优化 tips`;

    try {
      const result = await this._callAI<{
        patternType: string;
        description: string;
        sql: string;
        explanation: string;
        tips: string[];
      }>('ontology-patterns', prompt, '你是 DuckDB SQL 专家');
      return {
        sql: result.sql,
        explanation: result.explanation || result.description,
        patternType: result.patternType,
        tips: result.tips || [],
      };
    } catch (err) {
      // 如果 AI 调用失败，返回一个基础的占位模板
      return {
        sql: this.getFallbackSQL(operation, concept, property),
        explanation: `基于「${concept}」生成了 ${operation} 类型 SQL 模板`,
        patternType: operation,
        tips: ['请根据实际表名替换模板中的占位符'],
      };
    }
  }

  private getFallbackSQL(operation: string, concept: string, property?: string): string {
    const fallbacks: Record<string, string> = {
      SELECT: `SELECT \${columns}
FROM \${table_name}
WHERE \${condition}
ORDER BY \${sort_column} DESC
LIMIT \${limit}`,
      INSERT: `INSERT INTO \${table_name} (\${columns})
SELECT \${values}
FROM \${source_table}
WHERE \${condition}`,
      UPDATE: `UPDATE \${table_name}
SET \${column} = \${new_value}
WHERE \${condition}`,
      DELETE: `DELETE FROM \${table_name}
WHERE \${condition}`,
      AGGREGATE: `SELECT
  \${group_by_column},
  COUNT(*) AS count,
  SUM(\${metric_column}) AS total,
  AVG(\${metric_column}) AS average
FROM \${table_name}
GROUP BY \${group_by_column}
ORDER BY total DESC`,
      JOIN: `SELECT
  t1.\${t1_column},
  t2.\${t2_column}
FROM \${table1} t1
LEFT JOIN \${table2} t2 ON t1.id = t2.\${fk_column}
WHERE \${condition}`,
      WINDOW: `SELECT
  \${columns},
  ROW_NUMBER() OVER (PARTITION BY \${partition_col} ORDER BY \${sort_col} DESC) AS rank_in_group,
  SUM(\${column}) OVER (PARTITION BY \${partition_col} ORDER BY \${sort_col}) AS running_total
FROM \${table_name}
WHERE \${condition}`,
      CTE: `WITH ranked AS (
  SELECT
    \${columns},
    ROW_NUMBER() OVER (PARTITION BY \${group_col} ORDER BY \${sort_col} DESC) AS rn
  FROM \${table_name}
  WHERE \${condition}
)
SELECT * FROM ranked WHERE rn <= \${top_n}`,
    };
    return fallbacks[operation] || fallbacks.SELECT;
  }

  // ============================================================
  // Patterns Layer — Advanced SQL Pattern Generation
  // ============================================================
  async generatePatternSQL(patternType: string, context: string): Promise<PatternSQLFill> {
    const patterns = [
      'recursive_cte', 'temporal_versioning', 'aggregation_view',
      'path_analysis', 'weight_ranking', 'grouping_suggestion'
    ];
    const prompt = `用户需要以下 SQL 模式/分析类型：
【${patternType}】（可选模式：${patterns.join(', ')}）

应用上下文：${context || '一般本体论查询'}

输出必须是纯 JSON（无 markdown 块）：
{
  "patternType": "模式类型（英文）",
  "description": "模式的功能描述",
  "sql": "完整可执行的 DuckDB SQL 语句",
  "explanation": "SQL 的工作原理说明",
  "tips": ["提示1", "提示2", "提示3"]
}

要求：
- SQL 必须使用 life_object, life_link, life_object_type, life_link_type 这几张表
- tips 提供 DuckDB 特有的优化建议（如 JSON 属性处理、递归深度限制等）`;

    return this._callAI<PatternSQLFill>(
      'ontology-patterns', prompt, '你是 DuckDB SQL 专家'
    );
  }

  // ============================================================
  // Domains Layer — Full Domain Model Generation
  // ============================================================
  async generateDomainModel(domain: string): Promise<DomainModelFill> {
    const prompt = `你是一个领域专家。请为【${domain}】领域设计一个完整的本体论模型，包括对象类型、关系类型、种子数据和视图。

输出必须是纯 JSON（无 markdown 块），包含：
{
  "domainName": "${domain}",
  "objectTypes": [{ "name": "类型名（英文）", "description": "类型描述" }],
  "linkTypes": [{ "source": "源类型名", "name": "关系名（大写下划线）", "target": "目标类型名", "description": "关系描述" }],
  "seedObjects": [{ "typeName": "对应 objectType.name", "name": "对象中文名", "properties": { "key": "value" } }],
  "seedLinks": [{ "sourceName": "对象名", "linkTypeName": "关系名", "targetName": "对象名", "weight": 0.0到1.0 }],
  "views": [{ "name": "视图名（v_前缀）", "sql": "CREATE VIEW 语句", "description": "视图用途" }],
  "initializationSQL": "完整 SQL：创建所有表+插入种子数据+创建视图（用分号分隔）"
}

要求：
- objectTypes 3-5 个，seedObjects 每个类型至少 1 个，共 6-12 个
- seedLinks 至少 5 条，initializationSQL 中 ID 从 3000 开始递增`;

    return this._callAI<DomainModelFill>(
      'ontology-domains', prompt, `你是${domain}领域的建模专家`
    );
  }

  // ============================================================
  // CRUD Panel — Form Pre-fill Content
  // ============================================================
  async generateCRUDFill(mode: string, context: string): Promise<CRUDFillContent> {
    const prompt = `用户正在 ${mode} 模式下创建本体论数据。
上下文：${context || '无额外上下文'}

mode 可选值：objectType, object, linkType, link, action

输出必须是纯 JSON（无 markdown 块），格式根据 mode 不同：

objectType 模式：
{ "mode": "objectType", "name": "类型名称", "description": "类型描述" }

object 模式：
{ "mode": "object", "name": "对象名称", "objectTypeName": "所属类型", "properties": { "key": "value" }, "annotations": "备注" }

linkType 模式：
{ "mode": "linkType", "name": "关系类型名称", "description": "关系描述" }

link 模式：
{ "mode": "link", "sourceObjectName": "源对象名", "linkTypeName": "关系类型名", "targetObjectName": "目标对象名", "weight": 0.5, "description": "备注" }

action 模式：
{ "mode": "action", "name": "行动名称", "description": "行动描述", "status": "pending" }

要求：名称使用清晰、描述性的中文或英文`;

    return this._callAI<CRUDFillContent>(
      'ontology-crud-fill', prompt, '你是本体论数据建模专家'
    );
  }

  // ============================================================
  // Introspection Panel — Guided Questions
  // ============================================================
  async generateIntrospectionGuidance(topic: string): Promise<IntrospectionGuidance> {
    const prompt = `用户正在进行关于【${topic}】的自我反思（Introspection）。

请生成一套引导性问题，帮助用户深度思考。

输出必须是纯 JSON（无 markdown 块）：
{
  "topic": "${topic}",
  "questions": [
    { "question": "问题1", "hint": "回答提示", "relatedConcepts": ["相关概念1", "相关概念2"] }
  ],
  "reflectionTemplate": "反思记录模板（Markdown 格式，包含占位符）"
}

要求：questions 至少 4 个，最多 6 个；覆盖 What/Why/How/Impact 四个维度`;

    return this._callAI<IntrospectionGuidance>(
      'ontology-introspection', prompt, '你是人生教练和反思引导专家'
    );
  }

  // ============================================================
  // Suggestions Panel — Graph Completion Recommendations
  // ============================================================
  async generateSuggestions(
    existingObjects: string[],
    existingLinks: string[],
    objectCount: number,
    linkCount: number
  ): Promise<SuggestionItem[]> {
    const prompt = `基于用户现有的本体论数据，生成补全建议。

现有对象（${objectCount}个）：${existingObjects.slice(0, 20).join(', ')}${objectCount > 20 ? '...' : ''}
现有关系（${linkCount}个）：${existingLinks.slice(0, 20).join(', ')}${linkCount > 20 ? '...' : ''}

输出必须是纯 JSON（无 markdown 块），格式为数组：
[
  { "type": "object|link|action|introspection", "title": "建议标题", "description": "建议描述", "confidence": 0.0到1.0, "action": "采纳后执行的操作说明" }
]

要求：返回 3-6 个建议；confidence 高的建议（>0.7）优先推荐；类型分布均衡`;

    try {
      const result = await this._callAI<SuggestionItem[]>(
        'ontology-suggestions', prompt, '你是本体论知识图谱补全专家'
      );
      return Array.isArray(result) ? result : [];
    } catch {
      return [];
    }
  }

  // ============================================================
  // Private helper
  // ============================================================
  private async _callAI<T>(taskName: string, prompt: string, role: string): Promise<T> {
    const configStr = localStorage.getItem('ab-app-config');
    const aiConfig = configStr ? JSON.parse(configStr).ai : null;
    if (!aiConfig?.apiKey) {
      throw new Error('AI Provider API key not configured. Please set it in Settings.');
    }
    try {
      return await aiService.robustCall<T>(taskName as AIStage, prompt, role);
    } catch (err) {
      console.error(`[OntologyAI] ${taskName} failed:`, err);
      throw new Error(`AI 返回格式无效，无法完成 ${taskName} 操作。`);
    }
  }
}

export const ontologyAiService = new OntologyAiService();

// Re-export all types for consumers
export type {
  AIWorkflowResult,
  LayerWorkflow,
  MECELayer,
  MeceCanvasLayoutPlan,
};
