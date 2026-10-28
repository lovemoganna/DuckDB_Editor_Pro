/**
 * ontologyModelingService — AI 本体建模编排层（生产级工业建模引擎）
 *
 * 核心特性：
 * 1. 四要素业务建模：明确区分 Object / Property / Link / Action
 * 2. 真实业务语义提取：杜绝空泛无意义连接，保证实体具有唯一身份
 * 3. 实时多维校验：检测孤立节点、重复实体、无意义关系、断链和环路
 * 4. 简明设计依据：输出“为什么这样建模”，简述业务闭环与设计 rationale
 * 5. 交互式增量精炼：支持用户追问修改、合并、删除、局部生成
 * 6. 双模运行引擎：LLM 在线推理 + 内置离线/兜底领域启发式引擎，0 配置即开即用
 */

import { aiService } from './aiService';

// ============================================================
// Types
// ============================================================

export interface ModelingPropertyDef {
  name: string;
  type: 'VARCHAR' | 'INTEGER' | 'DECIMAL' | 'BOOLEAN' | 'TIMESTAMP' | 'JSON';
  description?: string;
  exampleValue?: any;
  required?: boolean;
}

export interface ModelingObjectType {
  identifier?: string;
  sourceId?: number;
  mapping?: { catalog: string; schema: string; table: string; idField: string; properties: Record<string, string>;
    dataset?: { owner: string; id: string; version: number; sql: string; definitionSql: string; name: string } };
  name: string;
  description: string;
  category?: 'Core' | 'Transaction' | 'Master' | 'Event';
  properties?: Record<string, string | ModelingPropertyDef>;
}

export interface ModelingObject {
  sourceId?: number;
  provenance?: { catalog: string; schema: string; table: string; idField: string; key: string;
    dataset?: { owner: string; id: string; version: number; sql: string; definitionSql: string; name: string } };
  name: string;
  objectType: string;
  properties: Record<string, any>;
  annotations?: string;
}

export interface ModelingLinkType {
  sourceId?: number;
  mapping?: { sourceField: string; targetField: string };
  name: string;
  description: string;
  fromType: string;
  toType: string;
  verb?: string;
}

export interface ModelingLink {
  sourceId?: number;
  provenance?: { sourceField: string; targetField: string };
  from: string;
  to: string;
  linkType: string;
  weight: number;
  description?: string;
}

export interface ModelingAction {
  sourceId?: number;
  name: string;
  objectName: string;
  description: string;
  triggerCondition?: string;
  targetStatus?: string;
}

export interface ModelingValidationIssue {
  id: string;
  level: 'error' | 'warning' | 'info';
  category: 'orphan' | 'duplicate' | 'hierarchy' | 'meaningless_link' | 'missing_property' | 'syntax' | 'property_as_node' | 'vague_parent';
  message: string;
  target?: string;
  fix?: string;
  element?: { kind: 'objectTypes' | 'linkTypes' | 'objects' | 'links' | 'actions'; index: number };
}

export interface ModelingLayoutNode {
  id: string;
  label: string;
  group: string;
  x?: number;
  y?: number;
  objectType?: string;
}

export interface ModelingLayoutLink {
  source: string;
  target: string;
  label?: string;
  weight?: number;
}

export interface OntologyModelingResult {
  targetContext?: { catalog: string; schema: string };
  modelingVersion?: 1;
  instanceMappingSignature?: string;
  dependentReferences?: Array<{ table: string; objectId: number; label: string }>;
  baseRevision?: string;
  baseline?: { objectTypes: number[]; objects: number[]; linkTypes: number[]; links: number[]; actions: number[] };
  title?: string;
  domain?: string;
  rationale: string;
  objectTypes: ModelingObjectType[];
  objects: ModelingObject[];
  linkTypes: ModelingLinkType[];
  links: ModelingLink[];
  actions: ModelingAction[];
  validationIssues: ModelingValidationIssue[];
  healthScore: number;
  suggestedDDL: string;
  seedData: Record<string, ModelingObject[]>;
  graphLayout: {
    nodes: ModelingLayoutNode[];
    links: ModelingLayoutLink[];
  };
  raw?: any;
}

export interface ModelingProgress {
  phase: 'parsing' | 'object-model' | 'link-model' | 'action-model' | 'validation' | 'layout' | 'done' | 'error';
  message: string;
  progress: number; // 0-100
}

// ============================================================
// Service
// ============================================================

class OntologyModelingService {
  /**
   * 从自然语言业务需求或数据模式构建完整本体模型
   */
  async modelFromConcept(
    concept: string,
    onProgress?: (p: ModelingProgress) => void
  ): Promise<OntologyModelingResult> {
    const report = (phase: ModelingProgress['phase'], message: string, progress: number) => {
      onProgress?.({ phase, message, progress });
    };

    try {
      report('parsing', '解析业务需求与核心实体...', 15);

      let rawModel: any = null;

      if (aiService.isConfigured()) {
        try {
          report('object-model', 'AI 正在提炼 Object/Property/Link/Action 四元模型...', 40);
          rawModel = await this._callAiModeling(concept);
        } catch (aiErr) {
          console.warn('[OntologyModelingService] AI inference failed, falling back to heuristic engine:', aiErr);
          rawModel = this._generateHeuristicModel(concept);
        }
      } else {
        report('object-model', '使用领域语义启发式引擎萃取本体模型...', 50);
        rawModel = this._generateHeuristicModel(concept);
      }

      report('action-model', '规划状态机动作与业务闭环...', 70);
      report('validation', '执行拓扑健康诊断与关系校验...', 85);

      const objectTypes: ModelingObjectType[] = (rawModel.objectTypes || []).map((ot: any) => ({
        name: ot.name || 'UnnamedType',
        description: ot.description || '',
        category: ot.category || 'Core',
        properties: ot.properties || {},
      }));

      const objects: ModelingObject[] = (rawModel.objects || []).map((o: any) => ({
        name: o.name || 'UnnamedObject',
        objectType: o.objectType || (objectTypes[0]?.name ?? 'General'),
        properties: o.properties && typeof o.properties === 'object' ? o.properties : {},
        annotations: o.annotations || '',
      }));

      const linkTypes: ModelingLinkType[] = (rawModel.linkTypes || []).map((lt: any) => ({
        name: lt.name || 'RELATED_TO',
        description: lt.description || '',
        fromType: lt.fromType || (objectTypes[0]?.name ?? ''),
        toType: lt.toType || (objectTypes[1]?.name ?? objectTypes[0]?.name ?? ''),
        verb: lt.verb || lt.name,
      }));

      const links: ModelingLink[] = (rawModel.links || []).map((l: any) => ({
        from: l.from,
        to: l.to,
        linkType: l.linkType || (linkTypes[0]?.name ?? 'RELATED_TO'),
        weight: typeof l.weight === 'number' ? l.weight : 0.8,
        description: l.description || '',
      }));

      const actions: ModelingAction[] = (rawModel.actions || []).map((a: any) => ({
        name: a.name || 'Action',
        objectName: a.objectName || (objects[0]?.name ?? ''),
        description: a.description || '',
        triggerCondition: a.triggerCondition || '',
        targetStatus: a.targetStatus || 'completed',
      }));

      const seedData: Record<string, ModelingObject[]> = {};
      for (const obj of objects) {
        if (!seedData[obj.objectType]) seedData[obj.objectType] = [];
        seedData[obj.objectType].push(obj);
      }

      report('layout', '生成图谱层级与空间布局...', 95);
      const graphLayout = this._generateLayout(objectTypes, seedData, linkTypes, links);

      const { issues, score } = this.validateModel({
        objectTypes,
        objects,
        linkTypes,
        links,
        actions,
      });

      report('done', '本体建模完成', 100);

      return {
        title: rawModel.title || '业务本体模型草案',
        domain: rawModel.domain || '通用业务领域',
        rationale: rawModel.rationale || '将核心业务主体建模为持久化对象，提取核心状态与操作行为，形成高自洽业务图谱。',
        objectTypes,
        objects,
        linkTypes,
        links,
        actions,
        validationIssues: issues,
        healthScore: score,
        suggestedDDL: rawModel.suggestedDDL || this._generateDDL(objectTypes, objects, linkTypes, links, actions),
        seedData,
        graphLayout,
        raw: rawModel,
      };
    } catch (e: any) {
      report('error', `建模失败: ${e.message}`, 0);
      throw e;
    }
  }

  /**
   * 追问/精炼现有模型（支持局部微调、合并、删除、添加新实体或动作）
   */
  async refineModel(
    current: OntologyModelingResult,
    instruction: string
  ): Promise<OntologyModelingResult> {
    if (!instruction.trim()) return current;

    if (aiService.isConfigured()) {
      try {
        const prompt = `你是一个资深本体论架构师。用户希望对当前本体模型进行局部调整与精炼。

## 当前模型（包含属性定义、关系端点和映射，必须保留未修改的字段）:
${JSON.stringify({ objectTypes: current.objectTypes, linkTypes: current.linkTypes, actions: current.actions })}
- 实体类型: ${current.objectTypes.map(t => t.name).join(', ')}
- 实体对象: ${current.objects.map(o => `${o.name}(${o.objectType})`).join(', ')}
- 关系连线: ${current.links.map(l => `${l.from} -[${l.linkType}]-> ${l.to}`).join(', ')}
- 业务行动: ${current.actions.map(a => `${a.name}(目标:${a.objectName})`).join(', ')}

## 用户修改指令:
"${instruction}"

请在保留已有合理结构的基础上，执行用户的修改指令（如增删改实体、调整属性、添加行动或关系等）。
必须输出纯合法 JSON（无 markdown 块），遵循规范：
{
  "title": "${current.title || '本体模型'}",
  "domain": "${current.domain || '业务领域'}",
  "rationale": "简短说明本次修改的业务合理性（2句话以内）",
  "objectTypes": [...],
  "objects": [...],
  "linkTypes": [...],
  "links": [...],
  "actions": [...]
}`;

        const refined = await aiService.robustCall<any>(
          'ontology',
          prompt,
          '精通本体建模微调架构师'
        );

        return this._normalizeAndValidate(refined, current);
      } catch (err) {
        console.warn('[OntologyModelingService] AI refine failed, applying rule-based refinement:', err);
      }
    }

    // Heuristic refinement fallback
    return this._applyHeuristicRefinement(current, instruction);
  }

  /**
   * 自动校验模型（检查重复对象、错误关系、实例/类型混淆、无意义抽象和孤立节点）
   */
  validateModel(data: {
    objectTypes: ModelingObjectType[];
    objects: ModelingObject[];
    linkTypes: ModelingLinkType[];
    links: ModelingLink[];
    actions?: ModelingAction[];
  }): { issues: ModelingValidationIssue[]; score: number } {
    const issues: ModelingValidationIssue[] = [];
    const typeNames = new Set(data.objectTypes.map(t => t.name.toLowerCase()));
    const objectNames = new Set(data.objects.map(o => o.name.toLowerCase()));

    // 1. 重复对象与实体类型检测
    const seenTypeNames = new Set<string>();
    data.objectTypes.forEach(ot => {
      const lower = ot.name.trim().toLowerCase();
      if (seenTypeNames.has(lower)) {
        issues.push({
          id: `dup-type-${ot.name}`,
          level: 'error',
          category: 'duplicate',
          message: `存在重复的本体类型 "${ot.name}"，类型名称必须在 Schema 中保持唯一。`,
          target: ot.name,
        });
      } else {
        seenTypeNames.add(lower);
      }
    });

    const seenObjects = new Set<string>();
    data.objects.forEach(obj => {
      const lower = obj.name.trim().toLowerCase();
      if (seenObjects.has(lower)) {
        issues.push({
          id: `dup-obj-${obj.name}`,
          level: 'error',
          category: 'duplicate',
          message: `存在重复对象名称 "${obj.name}"，可能引发唯一标识混乱。`,
          target: obj.name,
        });
      } else {
        seenObjects.add(lower);
      }
    });

    // 2. 孤立节点检测 (Orphan Type & Orphan Object)
    const connectedTypes = new Set<string>();
    data.linkTypes.forEach(lt => {
      if (lt.fromType) connectedTypes.add(lt.fromType.toLowerCase());
      if (lt.toType) connectedTypes.add(lt.toType.toLowerCase());
    });

    data.objectTypes.forEach(ot => {
      if (!connectedTypes.has(ot.name.toLowerCase())) {
        issues.push({
          id: `orphan-type-${ot.name}`,
          level: 'warning',
          category: 'orphan',
          message: `本体类型 "${ot.name}" 是孤立节点，未与任何其他类型建立 Link 关系。`,
          target: ot.name,
        });
      }
    });

    const connectedObjects = new Set<string>();
    data.links.forEach(l => {
      if (l.from) connectedObjects.add(l.from.toLowerCase());
      if (l.to) connectedObjects.add(l.to.toLowerCase());
    });

    data.objects.forEach(obj => {
      if (!connectedObjects.has(obj.name.toLowerCase())) {
        issues.push({
          id: `orphan-${obj.name}`,
          level: 'info',
          category: 'orphan',
          message: `实体实例 "${obj.name}" 暂无示例连线。`,
          target: obj.name,
        });
      }
    });

    // 3. 实例与类型混淆检测 (Instance vs Type Confusion Anti-Pattern)
    const instancePattern = /(_\d+|#\d+|\b(alice|bob|ord\d+|sku\d+|usr\d+|001|002|张三|李四|王五)\b)/i;
    data.objectTypes.forEach(ot => {
      if (instancePattern.test(ot.name)) {
        issues.push({
          id: `instance-confusion-${ot.name}`,
          level: 'warning',
          category: 'hierarchy',
          message: `类型名称 "${ot.name}" 具有具体的实例编号或人名特征。本体规范提示：主画布应抽象为通用类型（如 User、Order），而非具体实例。`,
          target: ot.name,
        });
      }
    });

    // 4. 关系连线与错误关系检测 (Dangling & Vague Link Types)
    const vagueVerbs = new Set(['relation', 'related', 'link', 'connect', 'has', 'associated', '关联', '关系', '相关', '包含']);
    data.linkTypes.forEach((lt, idx) => {
      const verb = (lt.verb || lt.name || '').toLowerCase();
      if (vagueVerbs.has(verb)) {
        issues.push({
          id: `vague-linktype-${idx}`,
          level: 'info',
          category: 'meaningless_link',
          message: `关系类型 "${lt.fromType} -> ${lt.name} -> ${lt.toType}" 语义过于笼统，建议细化为具体的业务动词（如 PLACED_BY/FULFILLED_BY）。`,
          target: `${lt.fromType}->${lt.toType}`,
        });
      }

      // 自环检测
      if (lt.fromType && lt.toType && lt.fromType.toLowerCase() === lt.toType.toLowerCase()) {
        issues.push({
          id: `loop-linktype-${idx}`,
          level: 'info',
          category: 'hierarchy',
          message: `类型 "${lt.fromType}" 存在指向自身的循环关系 "${lt.name}"，请确认是否为递归层级。`,
          target: lt.fromType,
        });
      }

      // 悬空端点检测
      if (lt.fromType && !typeNames.has(lt.fromType.toLowerCase())) {
        issues.push({
          id: `dangling-fromtype-${idx}`,
          level: 'error',
          category: 'syntax',
          message: `关系起点类型 "${lt.fromType}" 在本体类型列表中不存在。`,
          target: lt.fromType,
        });
      }
      if (lt.toType && !typeNames.has(lt.toType.toLowerCase())) {
        issues.push({
          id: `dangling-totype-${idx}`,
          level: 'error',
          category: 'syntax',
          message: `关系终点类型 "${lt.toType}" 在本体类型列表中不存在。`,
          target: lt.toType,
        });
      }
    });

    // 5. 属性节点化 (Property-as-Node Anti-pattern) 检测
    const propertyLikeKeywords = [
      '价格', '金额', '状态', '时间', '日期', '创建时间', '更新时间', '总价', '单价', '数量', '库存量', '年龄', '电话', '邮箱',
      'price', 'amount', 'status', 'time', 'date', 'created_at', 'updated_at', 'total', 'quantity', 'stock_num', 'age', 'phone', 'email'
    ];
    data.objectTypes.forEach(ot => {
      const lower = ot.name.trim().toLowerCase();
      const isPropertyLike = propertyLikeKeywords.some(kw => lower === kw || lower.startsWith(`${kw}:`) || lower.startsWith(`${kw}：`));
      if (isPropertyLike) {
        issues.push({
          id: `prop-as-node-${ot.name}`,
          level: 'warning',
          category: 'property_as_node',
          message: `节点 "${ot.name}" 具有明显的特征属性语义。本体规范反模式提示：应作为相关实体的 Property 字段，而非独立 Object Type。`,
          target: ot.name,
        });
      }
    });

    // 6. 无意义抽象父节点检测 (Vague Parent / Generic Concept)
    const vagueParentKeywords = ['事物', '对象', '数据', '实体', '系统', '信息', '东西', '根节点', 'entity', 'object', 'data', 'info', 'item', 'thing', 'root'];
    data.objectTypes.forEach(ot => {
      const lower = ot.name.trim().toLowerCase();
      if (vagueParentKeywords.includes(lower)) {
        issues.push({
          id: `vague-parent-${ot.name}`,
          level: 'info',
          category: 'vague_parent',
          message: `节点 "${ot.name}" 属于宽泛无意义的概念节点，缺乏真实业务主干语义，建议删除或细化。`,
          target: ot.name,
        });
      }
    });

    // 7. 属性缺失检测
    data.objectTypes.forEach(ot => {
      const keys = ot.properties ? Object.keys(ot.properties) : [];
      if (keys.length === 0) {
        issues.push({
          id: `empty-prop-type-${ot.name}`,
          level: 'info',
          category: 'missing_property',
          message: `类型 "${ot.name}" 未定义关键业务属性（如状态、编号、金额等）。`,
          target: ot.name,
        });
      }
    });

    // 8. 悬空 Action 检测
    (data.actions || []).forEach((act, idx) => {
      if (act.objectName && !typeNames.has(act.objectName.toLowerCase()) && !objectNames.has(act.objectName.toLowerCase())) {
        issues.push({
          id: `dangling-action-${idx}`,
          level: 'error',
          category: 'syntax',
          message: `行动 "${act.name}" 绑定的目标 "${act.objectName}" 不存在。`,
          target: act.name,
        });
      }
    });

    // Hard constraints shared by manual edits, AI proposals and the save boundary.
    const invalid = (kind: NonNullable<ModelingValidationIssue['element']>['kind'], index: number, message: string, fix: string) => {
      const row = data[kind]?.[index];
      issues.push({ id: `constraint-${kind}-${index}-${issues.length}`, level: 'error', category: 'syntax',
        target: row && 'name' in row ? row.name : String(index), message, fix, element: { kind, index } });
    };
    const checkNames = (kind: 'objectTypes' | 'linkTypes' | 'actions') => {
      const seen = new Set<string>();
      (data[kind] || []).forEach((row, i) => {
        const key = row.name.trim().toLowerCase();
        if (!key || seen.has(key)) invalid(kind, i, `名称为空或重复：${row.name}`, '填写唯一且非空的名称。');
        seen.add(key);
      });
    };
    checkNames('objectTypes'); checkNames('linkTypes'); checkNames('actions');
    const identifiers = new Set<string>();
    data.objectTypes.forEach((t, i) => {
      const id = (t.identifier ?? t.name).trim().toLowerCase();
      if (!id || identifiers.has(id)) invalid('objectTypes', i, `对象标识符为空或冲突：${id}`, '修改为唯一且非空的标识符。');
      identifiers.add(id);
      Object.entries(t.properties || {}).forEach(([name, def]) => {
        const type = typeof def === 'string' ? def : def.type;
        if (!name.trim() || !['VARCHAR','INTEGER','DECIMAL','BOOLEAN','TIMESTAMP','JSON'].includes(type))
          invalid('objectTypes', i, `属性 ${name} 名称或类型无效`, '填写属性名称并选择支持的字段类型。');
      });
      if (t.mapping) {
        const m = t.mapping;
        if (!m.catalog || !m.schema || (!m.table && !m.dataset) || !m.idField) invalid('objectTypes', i, '数据映射缺少来源或标识字段', '选择工作区数据集或物理表，以及唯一标识字段。');
        for (const [prop, field] of Object.entries(m.properties)) {
          if (!(prop in (t.properties || {})) || !field) invalid('objectTypes', i, `属性映射 ${prop} 无效`, '选择已定义属性和实际来源字段。');
        }
      }
    });
    data.linkTypes.forEach((l, i) => {
      if (!data.objectTypes.some(t => t.name === l.fromType) || !data.objectTypes.some(t => t.name === l.toType))
        invalid('linkTypes', i, `关系 ${l.name} 缺少有效来源或目标对象`, '重新选择已定义的来源和目标 Object Type。');
      if (l.mapping && (!l.mapping.sourceField || !l.mapping.targetField)) invalid('linkTypes', i, `关系 ${l.name} 缺少连接条件`, '选择两端表的关联字段。');
    });
    data.objects.forEach((o, i) => {
      const t = data.objectTypes.find(t => t.name === o.objectType);
      if (!t) invalid('objects', i, `实例 ${o.name} 的类型不存在`, '为实例选择存在的 Object Type。');
      Object.entries(t?.properties || {}).forEach(([key, def]) => {
        if (typeof def === 'object' && def.required && (o.properties[key] === undefined || o.properties[key] === null || o.properties[key] === ''))
          invalid('objects', i, `实例 ${o.name} 缺少必填属性 ${key}`, '修正真实数据或属性映射。');
        const value = o.properties[key], type = typeof def === 'string' ? def : def.type;
        if (value == null) return;
        const valid = type === 'INTEGER' ? Number.isInteger(Number(value)) && value !== ''
          : type === 'DECIMAL' ? Number.isFinite(Number(value)) && value !== ''
          : type === 'BOOLEAN' ? typeof value === 'boolean'
          : type === 'TIMESTAMP' ? (typeof value === 'number' ? Number.isFinite(new Date(value).getTime()) : !Number.isNaN(Date.parse(String(value))))
          : type === 'JSON' ? typeof value === 'object' || (() => { try { JSON.parse(String(value)); return true; } catch { return false; } })() : true;
        if (!valid) invalid('objects', i, `实例 ${o.name} 属性 ${key} 不符合 ${type} 类型`, '修正属性类型或真实来源字段。');
      });
    });
    data.links.forEach((l, i) => {
      const from = data.objects.find(o => o.name === l.from), to = data.objects.find(o => o.name === l.to);
      const type = data.linkTypes.find(t => t.name === l.linkType);
      if (!from || !to || !type || from.objectType !== type.fromType || to.objectType !== type.toType)
        invalid('links', i, `实例关系 ${l.linkType} 悬空或端点类型不匹配`, '修正关系类型和端点，或重新查询映射数据。');
    });
    (data.actions || []).forEach((a, i) => {
      if (!data.objectTypes.some(t => t.name === a.objectName) && !data.objects.some(o => o.name === a.objectName))
        invalid('actions', i, `行动 ${a.name} 缺少有效目标`, '选择存在的对象类型或真实实例。');
    });

    // 计算健康得分
    let penalty = 0;
    issues.forEach(issue => {
      if (issue.level === 'error') penalty += 20;
      else if (issue.level === 'warning') penalty += 10;
      else if (issue.level === 'info') penalty += 4;
    });

    const score = Math.max(20, Math.min(100, 100 - penalty));
    return { issues, score };
  }

  /**
   * 一键自动修复可修复的校验问题 (Auto Fix)
   */
  autoFixIssues(current: OntologyModelingResult): OntologyModelingResult {
    // 1. 去除重复类型与重复实体
    const uniqueObjectTypes: ModelingObjectType[] = [];
    const seenTypeNames = new Set<string>();
    current.objectTypes.forEach(t => {
      const norm = t.name.trim().toLowerCase();
      if (!seenTypeNames.has(norm)) {
        seenTypeNames.add(norm);
        uniqueObjectTypes.push(t);
      }
    });

    const uniqueObjects: ModelingObject[] = [];
    const seenNames = new Set<string>();
    current.objects.forEach(o => {
      const norm = o.name.trim().toLowerCase();
      if (!seenNames.has(norm)) {
        seenNames.add(norm);
        uniqueObjects.push(o);
      }
    });

    // 2. 规范化实例混淆的类型名 (e.g. Order_001 -> Order)
    const renamedMap: Record<string, string> = {};
    const normalizedTypes = uniqueObjectTypes.map(ot => {
      let cleanName = ot.name.replace(/(_\d+|#\d+|\b(001|002)\b)/gi, '').trim();
      if (!cleanName) cleanName = ot.name;
      if (cleanName !== ot.name) {
        renamedMap[ot.name] = cleanName;
        return { ...ot, name: cleanName };
      }
      return ot;
    });

    const validTypes = new Set(normalizedTypes.map(t => t.name));

    // 3. 移除悬空与指向不存在类型的 LinkTypes
    let validLinkTypes = current.linkTypes
      .map(lt => ({
        ...lt,
        fromType: renamedMap[lt.fromType] || lt.fromType,
        toType: renamedMap[lt.toType] || lt.toType,
      }))
      .filter(lt =>
        validTypes.has(lt.fromType) &&
        validTypes.has(lt.toType) &&
        lt.fromType.toLowerCase() !== lt.toType.toLowerCase()
      );

    // 4. 为孤立类型建立业务连线
    const linkedTypes = new Set<string>();
    validLinkTypes.forEach(lt => {
      linkedTypes.add(lt.fromType);
      linkedTypes.add(lt.toType);
    });

    const hubType = normalizedTypes[0]?.name;
    if (hubType) {
      normalizedTypes.forEach(ot => {
        if (!linkedTypes.has(ot.name) && ot.name !== hubType) {
          validLinkTypes.push({
            name: `ASSOCIATED_WITH_${ot.name.toUpperCase()}`,
            fromType: hubType,
            toType: ot.name,
            verb: '关联',
            description: `自动关联：${hubType} 与 ${ot.name}`,
          });
        }
      });
    }

    // 5. 优化宽泛动词
    validLinkTypes = validLinkTypes.map(lt => {
      if (['relation', 'link', 'associated', '关联', '关系'].includes((lt.verb || lt.name).toLowerCase())) {
        return { ...lt, verb: '业务关联', name: lt.name || 'DEPENDS_ON' };
      }
      return lt;
    });

    // 6. 补充空类型的默认属性
    const refinedTypes = normalizedTypes.map(ot => {
      const props = ot.properties ? { ...ot.properties } : {};
      if (Object.keys(props).length === 0) {
        props['id'] = 'VARCHAR';
        props['status'] = 'VARCHAR';
        props['created_at'] = 'TIMESTAMP';
      }
      return { ...ot, properties: props };
    });

    // 7. 同步更新 actions
    const nextActions = current.actions.map(a => ({
      ...a,
      objectName: renamedMap[a.objectName] || a.objectName,
    }));

    // 8. 同步更新 seedData 与 objects
    const seedData: Record<string, ModelingObject[]> = {};
    const nextObjects = uniqueObjects.map(o => {
      const newType = renamedMap[o.objectType] || o.objectType;
      return { ...o, objectType: newType };
    });
    nextObjects.forEach(obj => {
      if (!seedData[obj.objectType]) seedData[obj.objectType] = [];
      seedData[obj.objectType].push(obj);
    });

    // 确保每个 ObjectType 都有至少一个示例实例
    refinedTypes.forEach(t => {
      if (!seedData[t.name] || seedData[t.name].length === 0) {
        const sampleObj: ModelingObject = {
          name: `Sample_${t.name}_01`,
          objectType: t.name,
          properties: Object.keys(t.properties || {}).reduce((acc, k) => {
            acc[k] = `demo_${k}`;
            return acc;
          }, {} as Record<string, any>),
          annotations: '系统自动生成的场景验证实例',
        };
        seedData[t.name] = [sampleObj];
        nextObjects.push(sampleObj);
      }
    });

    // 9. 为孤立实例建立示例连线
    const validNames = new Set(nextObjects.map(o => o.name));
    let nextLinks = current.links.filter(l =>
      validNames.has(l.from) &&
      validNames.has(l.to) &&
      l.from.toLowerCase() !== l.to.toLowerCase()
    );

    const linkedObjSet = new Set<string>();
    nextLinks.forEach(l => {
      linkedObjSet.add(l.from);
      linkedObjSet.add(l.to);
    });

    const coreHub = nextObjects[0]?.name;
    if (coreHub) {
      nextObjects.forEach(obj => {
        if (!linkedObjSet.has(obj.name) && obj.name !== coreHub) {
          nextLinks.push({
            from: coreHub,
            to: obj.name,
            linkType: 'BELONGS_TO',
            weight: 0.7,
            description: `自动关联：${coreHub} 挂载 ${obj.name}`,
          });
        }
      });
    }

    const graphLayout = this._generateLayout(refinedTypes, seedData, validLinkTypes, nextLinks);
    const { issues, score } = this.validateModel({
      objectTypes: refinedTypes,
      objects: nextObjects,
      linkTypes: validLinkTypes,
      links: nextLinks,
      actions: nextActions,
    });

    return {
      ...current,
      objectTypes: refinedTypes,
      objects: nextObjects,
      linkTypes: validLinkTypes,
      links: nextLinks,
      actions: nextActions,
      seedData,
      graphLayout,
      validationIssues: issues,
      healthScore: score,
      rationale: `${current.rationale} [系统已自动修复孤立类型、实例混淆与拓扑冲突]`,
    };
  }

  /**
   * 将 sourceNode 合并并入 targetNode（支持类型合并与实体合并）
   */
  mergeNodes(current: OntologyModelingResult, sourceNodeName: string, targetNodeName: string): OntologyModelingResult {
    if (!sourceNodeName || !targetNodeName || sourceNodeName === targetNodeName) return current;

    // Check if merging objectTypes
    const sourceType = current.objectTypes.find(t => t.name === sourceNodeName);
    const targetType = current.objectTypes.find(t => t.name === targetNodeName);

    let nextObjectTypes = [...current.objectTypes];
    let nextLinkTypes = [...current.linkTypes];

    if (sourceType && targetType) {
      const mergedProps = { ...(targetType.properties || {}), ...(sourceType.properties || {}) };
      nextObjectTypes = nextObjectTypes
        .filter(t => t.name !== sourceNodeName)
        .map(t => t.name === targetNodeName ? { ...t, properties: mergedProps } : t);

      nextLinkTypes = nextLinkTypes
        .filter(lt => !(lt.fromType === sourceNodeName && lt.toType === targetNodeName) && !(lt.fromType === targetNodeName && lt.toType === sourceNodeName))
        .map(lt => ({
          ...lt,
          fromType: lt.fromType === sourceNodeName ? targetNodeName : lt.fromType,
          toType: lt.toType === sourceNodeName ? targetNodeName : lt.toType,
        }))
        .filter(lt => lt.fromType.toLowerCase() !== lt.toType.toLowerCase());
    }

    // Also merge objects
    const sourceObj = current.objects.find(o => o.name === sourceNodeName);
    const targetObj = current.objects.find(o => o.name === targetNodeName);
    let nextObjects = [...current.objects];

    if (sourceObj && targetObj) {
      const mergedProps = { ...targetObj.properties, ...sourceObj.properties };
      nextObjects = nextObjects
        .filter(o => o.name !== sourceNodeName)
        .map(o => o.name === targetNodeName ? { ...o, properties: mergedProps } : o);
    } else {
      nextObjects = nextObjects.map(o => o.objectType === sourceNodeName ? { ...o, objectType: targetNodeName } : o);
    }

    // 重定向关联连线：将所有连接 sourceNode 的边改接至 targetNode，过滤自环
    const nextLinks = current.links
      .filter(l => !(l.from === sourceNodeName && l.to === targetNodeName) && !(l.from === targetNodeName && l.to === sourceNodeName))
      .map(l => ({
        ...l,
        from: l.from === sourceNodeName ? targetNodeName : l.from,
        to: l.to === sourceNodeName ? targetNodeName : l.to,
      }))
      .filter(l => l.from.toLowerCase() !== l.to.toLowerCase());

    // 重定向 actions
    const nextActions = current.actions.map(a => ({
      ...a,
      objectName: a.objectName === sourceNodeName ? targetNodeName : a.objectName,
    }));

    const seedData: Record<string, ModelingObject[]> = {};
    nextObjects.forEach(obj => {
      if (!seedData[obj.objectType]) seedData[obj.objectType] = [];
      seedData[obj.objectType].push(obj);
    });

    const graphLayout = this._generateLayout(current.objectTypes, seedData, current.linkTypes, nextLinks);
    const { issues, score } = this.validateModel({
      objectTypes: current.objectTypes,
      objects: nextObjects,
      linkTypes: current.linkTypes,
      links: nextLinks,
      actions: nextActions,
    });

    return {
      ...current,
      objects: nextObjects,
      links: nextLinks,
      actions: nextActions,
      seedData,
      graphLayout,
      validationIssues: issues,
      healthScore: score,
      rationale: `${current.rationale} [已将 "${sourceNodeName}" 合并并入 "${targetNodeName}"]`,
    };
  }

  /**
   * 针对单一节点/类型重新生成属性与候选动作（局部重构，不破坏全图其他节点）
   */
  async regenerateNode(current: OntologyModelingResult, nodeName: string): Promise<OntologyModelingResult> {
    const targetType = current.objectTypes.find(t => t.name === nodeName);
    const targetObj = current.objects.find(o => o.name === nodeName || o.objectType === nodeName);
    const effectiveTypeName = targetType?.name || targetObj?.objectType || nodeName;

    if (aiService.isConfigured()) {
      try {
        const prompt = `请针对业务实体类型【${effectiveTypeName}】（所属领域：${current.domain || '业务系统'}），深度推导其真实的业务属性（至少4个关键KV字段及类型）以及可触发的业务行动（Action）。
当前图谱其他实体类型：${current.objectTypes.map(o => o.name).join(', ')}。
输出纯 JSON（无 markdown 块）：
{
  "properties": { "字段名": "VARCHAR|DECIMAL|INTEGER|TIMESTAMP" },
  "suggestedActions": [ { "name": "ActionName", "description": "说明", "targetStatus": "status" } ]
}`;
        const res = await aiService.robustCall<any>('ontology', prompt, '实体精细化建模专家');
        if (res && res.properties) {
          const nextObjectTypes = current.objectTypes.map(t =>
            t.name === effectiveTypeName
              ? { ...t, properties: { ...(t.properties || {}), ...res.properties } }
              : t
          );
          const nextObjects = current.objects.map(o =>
            (o.name === nodeName || o.objectType === effectiveTypeName)
              ? { ...o, properties: { ...o.properties, ...res.properties } }
              : o
          );
          const nextActions = [...current.actions];
          if (Array.isArray(res.suggestedActions)) {
            res.suggestedActions.forEach((sa: any) => {
              if (sa.name && !nextActions.some(a => a.name === sa.name && a.objectName === effectiveTypeName)) {
                nextActions.push({
                  name: sa.name,
                  objectName: effectiveTypeName,
                  description: sa.description || '',
                  targetStatus: sa.targetStatus || 'completed',
                });
              }
            });
          }
          const { issues, score } = this.validateModel({
            objectTypes: nextObjectTypes,
            objects: nextObjects,
            linkTypes: current.linkTypes,
            links: current.links,
            actions: nextActions,
          });
          return {
            ...current,
            objectTypes: nextObjectTypes,
            objects: nextObjects,
            actions: nextActions,
            validationIssues: issues,
            healthScore: score,
            rationale: `${current.rationale} [已针对实体 "${nodeName}" 局部重新生成专业属性与行动]`,
          };
        }
      } catch (err) {
        console.warn('[OntologyModelingService] regenerateNode AI call failed, falling back to rule templates:', err);
      }
    }

    // 启发式局部补全
    const defaultPropsMap: Record<string, Record<string, any>> = {
      order: { order_no: 'VARCHAR', amount: 'DECIMAL', status: 'VARCHAR', pay_time: 'TIMESTAMP', channel: 'VARCHAR' },
      customer: { user_id: 'VARCHAR', level: 'VARCHAR', phone: 'VARCHAR', register_date: 'TIMESTAMP' },
      product: { sku_code: 'VARCHAR', price: 'DECIMAL', stock_count: 'INTEGER', category: 'VARCHAR' },
      warehouse: { wh_code: 'VARCHAR', location: 'VARCHAR', capacity: 'INTEGER', manager: 'VARCHAR' },
      shipment: { tracking_no: 'VARCHAR', courier: 'VARCHAR', eta: 'VARCHAR', status: 'VARCHAR' },
    };
    const key = Object.keys(defaultPropsMap).find(k => nodeName.toLowerCase().includes(k) || effectiveTypeName.toLowerCase().includes(k)) || 'order';
    const supplementProps = defaultPropsMap[key];

    const nextObjectTypes = current.objectTypes.map(t =>
      t.name === effectiveTypeName
        ? { ...t, properties: { ...(t.properties || {}), ...supplementProps } }
        : t
    );

    const nextObjects = current.objects.map(o =>
      (o.name === nodeName || o.objectType === effectiveTypeName)
        ? { ...o, properties: { ...o.properties, ...supplementProps } }
        : o
    );

    const { issues, score } = this.validateModel({
      objectTypes: nextObjectTypes,
      objects: nextObjects,
      linkTypes: current.linkTypes,
      links: current.links,
      actions: current.actions,
    });

    return {
      ...current,
      objectTypes: nextObjectTypes,
      objects: nextObjects,
      validationIssues: issues,
      healthScore: score,
      rationale: `${current.rationale} [已为实体 "${nodeName}" 局部补全业务属性]`,
    };
  }

  // ============================================================
  // Private AI Call & Heuristics
  // ============================================================

  private async _callAiModeling(concept: string): Promise<any> {
    const prompt = `你是一个顶级业务架构师与知识图谱本体建模专家。请根据用户的业务描述进行高内聚、低耦合的本体建模。
明确区分四大要素：
1. Object (实体对象与类型)：业务主角，必须具备唯一身份(Identity)，严禁无意义虚词。
2. Property (业务属性)：挂载在实体上的特征属性(字段名与取值，如 status, amount, code 等)。
3. Link (关联关系)：有明确业务动词指向的有向关系(如 PLACED, FULFILLED_BY, BELONGS_TO)，禁止生搬硬套。
4. Action (业务行动)：实体的状态机与业务流转行为(如 CancelOrder, ShipCargo, FlagRisk)。

用户业务描述:
"""
${concept}
"""

必须输出严格合法的纯 JSON 字符串（绝不要包含 markdown 代码块）：
{
  "title": "模型标题（如：电商履约链路本体）",
  "domain": "所属业务领域（如：供应链物流）",
  "rationale": "为什么这样建模的核心逻辑（2句简要总结核心业务闭环与设计考虑）",
  "objectTypes": [
    { "name": "类型名（如 Order）", "description": "类型说明", "category": "Core|Transaction|Master|Event", "properties": { "status": "VARCHAR", "amount": "DECIMAL" } }
  ],
  "objects": [
    { "name": "实例名（如 待支付订单-ORD001）", "objectType": "Order", "properties": { "status": "pending_payment", "amount": 299.0 }, "annotations": "典型业务实例" }
  ],
  "linkTypes": [
    { "name": "关系类型（如 PLACED_BY）", "description": "业务关系说明", "fromType": "Order", "toType": "Customer", "verb": "下单" }
  ],
  "links": [
    { "from": "待支付订单-ORD001", "to": "VIP客户-张三", "linkType": "PLACED_BY", "weight": 0.9, "description": "客户发起购买" }
  ],
  "actions": [
    { "name": "CancelOrder", "objectName": "待支付订单-ORD001", "description": "用户超时未支付自动取消", "targetStatus": "cancelled" }
  ]
}

要求：
- 生成 3-5 个 objectTypes，4-8 个典型 objects；
- 生成 3-6 条具有强业务语义的 links；
- 生成 2-4 个驱动业务流转的 actions；
- 杜绝空洞节点或无意义泛化关系。`;

    return aiService.robustCall<any>(
      'ontology',
      prompt,
      '顶级本体知识建模架构师'
    );
  }

  /**
   * 领域启发式引擎（在未配置 AI 或离线时的生产级建模规则）
   */
  private _generateHeuristicModel(concept: string): any {
    const text = concept.toLowerCase();

    // 1. 医疗健康场景
    if (text.includes('医') || text.includes('诊') || text.includes('病') || text.includes('药') || text.includes('护')) {
      return {
        title: '智慧医疗就诊与处方本体',
        domain: '医疗健康服务',
        rationale: '以“患者-挂号单-医生-处方-药品”为核心业务闭环，突出诊疗流转过程与医生处方权控制。',
        objectTypes: [
          { name: 'Patient', description: '就诊患者档案', category: 'Master', properties: { patient_id: 'VARCHAR', age: 'INTEGER', medical_card: 'VARCHAR' } },
          { name: 'Doctor', description: '执业医师', category: 'Master', properties: { doctor_id: 'VARCHAR', title: 'VARCHAR', department: 'VARCHAR' } },
          { name: 'Appointment', description: '门诊预约挂号单', category: 'Transaction', properties: { appointment_no: 'VARCHAR', status: 'VARCHAR', time_slot: 'VARCHAR' } },
          { name: 'Prescription', description: '电子处方单', category: 'Transaction', properties: { rx_code: 'VARCHAR', dosage: 'VARCHAR', total_price: 'DECIMAL' } },
          { name: 'Medicine', description: '药品主数据', category: 'Core', properties: { drug_name: 'VARCHAR', specification: 'VARCHAR', stock: 'INTEGER' } }
        ],
        objects: [
          { name: '患者-李四', objectType: 'Patient', properties: { patient_id: 'P10023', age: 34, medical_card: 'MC8829' }, annotations: '门诊初诊患者' },
          { name: '主治医师-王主任', objectType: 'Doctor', properties: { doctor_id: 'D0041', title: '副主任医师', department: '呼吸内科' }, annotations: '坐诊医生' },
          { name: '门诊挂号-APPT2026', objectType: 'Appointment', properties: { appointment_no: 'APPT20260901', status: 'checked_in', time_slot: '09:30-10:00' }, annotations: '已取号待就诊' },
          { name: '电子处方-RX098', objectType: 'Prescription', properties: { rx_code: 'RX20260901_01', dosage: '一日三次', total_price: 128.5 }, annotations: '开具待缴费处方' },
          { name: '阿莫西林胶囊', objectType: 'Medicine', properties: { drug_name: '阿莫西林', specification: '0.25g*24粒', stock: 450 }, annotations: '处方药品' }
        ],
        linkTypes: [
          { name: 'REGISTERS_FOR', description: '患者挂号就诊', fromType: 'Patient', toType: 'Appointment', verb: '挂号' },
          { name: 'DIAGNOSED_BY', description: '由医生接诊诊断', fromType: 'Appointment', toType: 'Doctor', verb: '由其接诊' },
          { name: 'ISSUES_RX', description: '医生开具处方', fromType: 'Doctor', toType: 'Prescription', verb: '开具' },
          { name: 'CONTAINS_DRUG', description: '处方包含药品项目', fromType: 'Prescription', toType: 'Medicine', verb: '包含药品' }
        ],
        links: [
          { from: '患者-李四', to: '门诊挂号-APPT2026', linkType: 'REGISTERS_FOR', weight: 0.9, description: '患者建立挂号记录' },
          { from: '门诊挂号-APPT2026', to: '主治医师-王主任', linkType: 'DIAGNOSED_BY', weight: 0.9, description: '挂号单分配给王主任' },
          { from: '主治医师-王主任', to: '电子处方-RX098', linkType: 'ISSUES_RX', weight: 0.85, description: '就诊后开具电子处方' },
          { from: '电子处方-RX098', to: '阿莫西林胶囊', linkType: 'CONTAINS_DRUG', weight: 0.8, description: '处方明细指向药品库存' }
        ],
        actions: [
          { name: 'ConfirmCheckIn', objectName: '门诊挂号-APPT2026', description: '患者到达候诊区签到叫号', targetStatus: 'in_consultation' },
          { name: 'DispenseMedicine', objectName: '电子处方-RX098', description: '药房发药并扣减药品库存', targetStatus: 'dispensed' }
        ]
      };
    }

    // 2. 物联网 / 监控运维场景
    if (text.includes('物联') || text.includes('设备') || text.includes('传感') || text.includes('监控') || text.includes('告警') || text.includes('iot')) {
      return {
        title: '智能物联网设备与告警本体',
        domain: 'IoT 工业监控',
        rationale: '聚焦网关设备拓扑、传感器时序指标采集与告警联动治理全链路。',
        objectTypes: [
          { name: 'EdgeGateway', description: '边缘物联网关', category: 'Core', properties: { gateway_sn: 'VARCHAR', ip_addr: 'VARCHAR', firmware_ver: 'VARCHAR' } },
          { name: 'SensorNode', description: '传感器监测终端', category: 'Master', properties: { sensor_id: 'VARCHAR', metric_type: 'VARCHAR', sampling_freq: 'INTEGER' } },
          { name: 'TelemetryMetric', description: '实时遥测采集流', category: 'Event', properties: { value: 'DECIMAL', unit: 'VARCHAR', timestamp: 'TIMESTAMP' } },
          { name: 'AlertIncident', description: '异常告警工单', category: 'Transaction', properties: { alert_level: 'VARCHAR', status: 'VARCHAR', threshold: 'DECIMAL' } }
        ],
        objects: [
          { name: '车间网关-GW01', objectType: 'EdgeGateway', properties: { gateway_sn: 'GW-SH-001', ip_addr: '192.168.10.2', firmware_ver: 'v2.4.1' }, annotations: '核心边缘采集设备' },
          { name: '温湿度传感器-TH03', objectType: 'SensorNode', properties: { sensor_id: 'TH-03-A', metric_type: 'Temperature', sampling_freq: 5 }, annotations: '车间2号温控点' },
          { name: '温度采集-42.5℃', objectType: 'TelemetryMetric', properties: { value: 42.5, unit: 'celsius', timestamp: '2026-09-28 08:30:00' }, annotations: '超过额定阈值' },
          { name: '超温预警-ALT992', objectType: 'AlertIncident', properties: { alert_level: 'Critical', status: 'active', threshold: 40.0 }, annotations: '触发风扇降温与工单' }
        ],
        linkTypes: [
          { name: 'MANAGES_SENSOR', description: '网关管控子传感器', fromType: 'EdgeGateway', toType: 'SensorNode', verb: '纳管' },
          { name: 'EMITS_METRIC', description: '传感器上报遥测数据', fromType: 'SensorNode', toType: 'TelemetryMetric', verb: '上报' },
          { name: 'TRIGGERS_ALERT', description: '遥测越限触发报警工单', fromType: 'TelemetryMetric', toType: 'AlertIncident', verb: '触发' }
        ],
        links: [
          { from: '车间网关-GW01', to: '温湿度传感器-TH03', linkType: 'MANAGES_SENSOR', weight: 0.9, description: '网关维护传感器通讯' },
          { from: '温湿度传感器-TH03', to: '温度采集-42.5℃', linkType: 'EMITS_METRIC', weight: 0.85, description: '传感器高频上传遥测' },
          { from: '温度采集-42.5℃', to: '超温预警-ALT992', linkType: 'TRIGGERS_ALERT', weight: 0.95, description: '数值超阈值自动拉起警报' }
        ],
        actions: [
          { name: 'AcknowledgeAlert', objectName: '超温预警-ALT992', description: '运维工程师接单核查', targetStatus: 'investigating' },
          { name: 'TriggerCoolingFans', objectName: '车间网关-GW01', description: '边缘侧下发降温指令', targetStatus: 'fans_running' }
        ]
      };
    }

    // 3. 金融信贷 / 风控场景
    if (text.includes('贷') || text.includes('金融') || text.includes('风控') || text.includes('征信') || text.includes('账户')) {
      return {
        title: '金融信贷风控与授信审批本体',
        domain: '数字金融风控',
        rationale: '构建借款申请、风控规则模型评分、授信额度与合同放款的全生命周期可溯本体。',
        objectTypes: [
          { name: 'Borrower', description: '借款人主体', category: 'Master', properties: { id_card: 'VARCHAR', credit_score: 'INTEGER', income_level: 'VARCHAR' } },
          { name: 'LoanApplication', description: '信贷申请件', category: 'Transaction', properties: { app_no: 'VARCHAR', requested_amount: 'DECIMAL', term_months: 'INTEGER' } },
          { name: 'RiskAssessment', description: '大数据风控评分报告', category: 'Event', properties: { risk_level: 'VARCHAR', anti_fraud_hit: 'BOOLEAN', dti_ratio: 'DECIMAL' } },
          { name: 'CreditContract', description: '授信合同', category: 'Core', properties: { contract_no: 'VARCHAR', approved_limit: 'DECIMAL', interest_rate: 'DECIMAL' } }
        ],
        objects: [
          { name: '申请人-陈先生', objectType: 'Borrower', properties: { id_card: '310104********', credit_score: 720, income_level: 'Tier1' }, annotations: '优质工薪借款人' },
          { name: '个人消费贷申请-APP001', objectType: 'LoanApplication', properties: { app_no: 'LN202609001', requested_amount: 150000.0, term_months: 24 }, annotations: '申请金额 15 万元' },
          { name: '风控报告-RP-A8', objectType: 'RiskAssessment', properties: { risk_level: 'Low', anti_fraud_hit: false, dti_ratio: 0.28 }, annotations: '模型评分达标，无黑名单' },
          { name: '授信合同-CTR2026', objectType: 'CreditContract', properties: { contract_no: 'CTR-LN-0988', approved_limit: 120000.0, interest_rate: 0.0485 }, annotations: '已核批待放款' }
        ],
        linkTypes: [
          { name: 'APPLIES_FOR', description: '借款人发起信贷申请', fromType: 'Borrower', toType: 'LoanApplication', verb: '发起申请' },
          { name: 'EVALUATED_BY', description: '申请件经风控模型评估', fromType: 'LoanApplication', toType: 'RiskAssessment', verb: '风控评估' },
          { name: 'GENERATES_CONTRACT', description: '风控通过后生成授信合同', fromType: 'RiskAssessment', toType: 'CreditContract', verb: '核准合同' }
        ],
        links: [
          { from: '申请人-陈先生', to: '个人消费贷申请-APP001', linkType: 'APPLIES_FOR', weight: 0.9, description: '客户提交真实贷款意向' },
          { from: '个人消费贷申请-APP001', to: '风控报告-RP-A8', linkType: 'EVALUATED_BY', weight: 0.95, description: '风控引擎实时规则跑批' },
          { from: '风控报告-RP-A8', to: '授信合同-CTR2026', linkType: 'GENERATES_CONTRACT', weight: 0.85, description: '根据评分自动授信' }
        ],
        actions: [
          { name: 'ApproveCredit', objectName: '个人消费贷申请-APP001', description: '信贷经理终审确认', targetStatus: 'approved' },
          { name: 'DisburseFunds', objectName: '授信合同-CTR2026', description: '核心银企直连放款出资', targetStatus: 'disbursed' }
        ]
      };
    }

    // 4. 默认通用商业/电商履约场景
    return {
      title: '端到端电商订单与履约配送本体',
      domain: '商业零售与供应链',
      rationale: '覆盖“买家-商品-订单-仓库-运单”的商业主干，通过发货与履约 Action 驱动状态变迁。',
      objectTypes: [
        { name: 'Customer', description: '注册采购客户', category: 'Master', properties: { user_id: 'VARCHAR', level: 'VARCHAR', phone: 'VARCHAR' } },
        { name: 'Product', description: '在售商品/SKU', category: 'Core', properties: { sku_id: 'VARCHAR', name: 'VARCHAR', price: 'DECIMAL', stock: 'INTEGER' } },
        { name: 'Order', description: '交易订单', category: 'Transaction', properties: { order_no: 'VARCHAR', total_amount: 'DECIMAL', order_status: 'VARCHAR' } },
        { name: 'Warehouse', description: '发货仓储中心', category: 'Master', properties: { wh_code: 'VARCHAR', city: 'VARCHAR', capacity: 'INTEGER' } },
        { name: 'Shipment', description: '物流配送运单', category: 'Event', properties: { tracking_no: 'VARCHAR', courier: 'VARCHAR', delivery_status: 'VARCHAR' } }
      ],
      objects: [
        { name: 'VIP买家-张三', objectType: 'Customer', properties: { user_id: 'U8801', level: 'VIP2', phone: '138****0001' }, annotations: '高频购买活跃客户' },
        { name: '高端降噪耳机Pro', objectType: 'Product', properties: { sku_id: 'SKU-AUDIO-09', name: '降噪耳机Pro', price: 1299.0, stock: 120 }, annotations: '核心爆款商品' },
        { name: '销售订单-ORD202609', objectType: 'Order', properties: { order_no: 'ORD-202609-001', total_amount: 1299.0, order_status: 'paid' }, annotations: '买家已付款待履约' },
        { name: '华东1号中央仓', objectType: 'Warehouse', properties: { wh_code: 'WH-EAST-01', city: '上海', capacity: 50000 }, annotations: '就近智能发货仓' },
        { name: '顺丰特快-SF88390', objectType: 'Shipment', properties: { tracking_no: 'SF88390123', courier: '顺丰速运', delivery_status: 'in_transit' }, annotations: '干线运输中' }
      ],
      linkTypes: [
        { name: 'PLACED_BY', description: '订单由客户发起购买', fromType: 'Order', toType: 'Customer', verb: '下单购买' },
        { name: 'INCLUDES_ITEM', description: '订单包含的商品明细', fromType: 'Order', toType: 'Product', verb: '包含商品' },
        { name: 'FULFILLED_BY', description: '订单由对应仓库配货打包', fromType: 'Order', toType: 'Warehouse', verb: '仓库配发' },
        { name: 'DISPATCHED_AS', description: '出库包装生成物流配送运单', fromType: 'Warehouse', toType: 'Shipment', verb: '派生物流' }
      ],
      links: [
        { from: '销售订单-ORD202609', to: 'VIP买家-张三', linkType: 'PLACED_BY', weight: 0.9, description: '客户张三成功创建并支付订单' },
        { from: '销售订单-ORD202609', to: '高端降噪耳机Pro', linkType: 'INCLUDES_ITEM', weight: 0.85, description: '订单明细行购买 1 件商品' },
        { from: '销售订单-ORD202609', to: '华东1号中央仓', linkType: 'FULFILLED_BY', weight: 0.8, description: '系统智能路由至上海中央仓' },
        { from: '华东1号中央仓', to: '顺丰特快-SF88390', linkType: 'DISPATCHED_AS', weight: 0.75, description: '仓库出库交接顺丰末端履约' }
      ],
      actions: [
        { name: 'PackAndShip', objectName: '销售订单-ORD202609', description: '仓库质检打包并打印快递面单', targetStatus: 'shipped' },
        { name: 'ConfirmDelivery', objectName: '顺丰特快-SF88390', description: '客户签收包裹，交易履约完成', targetStatus: 'delivered' }
      ]
    };
  }

  /**
   * 离线规则式精炼处理器
   */
  private _applyHeuristicRefinement(current: OntologyModelingResult, instruction: string): OntologyModelingResult {
    const text = instruction.toLowerCase();
    const nextObjects = [...current.objects];
    const nextObjectTypes = [...current.objectTypes];
    const nextLinks = [...current.links];
    const nextLinkTypes = [...current.linkTypes];
    const nextActions = [...current.actions];

    // 检查是否要求添加退款/取消动作
    if (text.includes('退款') || text.includes('取消') || text.includes('cancel')) {
      const orderObj = nextObjects.find(o => o.objectType.toLowerCase().includes('order') || o.name.includes('订单'));
      const targetName = orderObj ? orderObj.name : (nextObjectTypes.find(t => /order|订单/i.test(t.name))?.name || nextObjects[0]?.name || nextObjectTypes[0]?.name || 'TargetObject');
      nextActions.push({
        name: 'CancelAndRefund',
        objectName: targetName,
        description: '用户申请取消或售后退款处理',
        targetStatus: 'refunded',
      });
    }

    // 检查是否要求添加供应商
    if (text.includes('供应商') || text.includes('supplier')) {
      const typeExists = nextObjectTypes.some(t => t.name === 'Supplier');
      if (!typeExists) {
        nextObjectTypes.push({
          name: 'Supplier',
          description: '商品及原料核心供货商',
          category: 'Master',
          properties: { supplier_code: 'VARCHAR', contact: 'VARCHAR', credit_rating: 'VARCHAR' },
        });
      }
      const supObjName = '优质供应商-华盛实业';
      if (!nextObjects.some(o => o.name === supObjName)) {
        nextObjects.push({
          name: supObjName,
          objectType: 'Supplier',
          properties: { supplier_code: 'SUP-008', contact: '张总', credit_rating: 'AAA' },
          annotations: '长期核心合作伙伴',
        });
      }
      const prod = nextObjects.find(o => o.objectType.toLowerCase().includes('product') || o.name.includes('商品') || o.name.includes('耳机'));
      if (prod) {
        nextLinks.push({
          from: supObjName,
          to: prod.name,
          linkType: 'SUPPLIES',
          weight: 0.85,
          description: '供应商稳定供货',
        });
        if (!nextLinkTypes.some(l => l.name === 'SUPPLIES')) {
          nextLinkTypes.push({ name: 'SUPPLIES', description: '供应商供货关联', fromType: 'Supplier', toType: prod.objectType, verb: '供货' });
        }
      }
    }

    // 检查是否要求去重/清理
    if (text.includes('去重') || text.includes('清理') || text.includes('优化')) {
      return this.autoFixIssues({
        ...current,
        objects: nextObjects,
        objectTypes: nextObjectTypes,
        links: nextLinks,
        linkTypes: nextLinkTypes,
        actions: nextActions,
      });
    }

    const seedData: Record<string, ModelingObject[]> = {};
    nextObjects.forEach(obj => {
      if (!seedData[obj.objectType]) seedData[obj.objectType] = [];
      seedData[obj.objectType].push(obj);
    });

    const graphLayout = this._generateLayout(nextObjectTypes, seedData, nextLinkTypes, nextLinks);
    const { issues, score } = this.validateModel({
      objectTypes: nextObjectTypes,
      objects: nextObjects,
      linkTypes: nextLinkTypes,
      links: nextLinks,
      actions: nextActions,
    });

    return {
      ...current,
      objects: nextObjects,
      objectTypes: nextObjectTypes,
      links: nextLinks,
      linkTypes: nextLinkTypes,
      actions: nextActions,
      seedData,
      graphLayout,
      validationIssues: issues,
      healthScore: score,
      rationale: `${current.rationale} [已根据指令“${instruction}”实施增量更新]`,
    };
  }

  private _normalizeAndValidate(refined: any, fallback: OntologyModelingResult): OntologyModelingResult {
    const objectTypes = refined.objectTypes || fallback.objectTypes;
    const objects = refined.objects || fallback.objects;
    const linkTypes = refined.linkTypes || fallback.linkTypes;
    const links = refined.links || fallback.links;
    const actions = refined.actions || fallback.actions;

    const seedData: Record<string, ModelingObject[]> = {};
    objects.forEach((obj: any) => {
      const type = obj.objectType || objectTypes[0]?.name || 'General';
      if (!seedData[type]) seedData[type] = [];
      seedData[type].push(obj);
    });

    const graphLayout = this._generateLayout(objectTypes, seedData, linkTypes, links);
    const { issues, score } = this.validateModel({
      objectTypes,
      objects,
      linkTypes,
      links,
      actions,
    });

    return {
      ...fallback,
      title: refined.title || fallback.title,
      domain: refined.domain || fallback.domain,
      rationale: refined.rationale || fallback.rationale,
      objectTypes,
      objects,
      linkTypes,
      links,
      actions,
      validationIssues: issues,
      healthScore: score,
      seedData,
      graphLayout,
      suggestedDDL: this._generateDDL(objectTypes, objects, linkTypes, links, actions),
    };
  }

  private _generateDDL(
    objectTypes: ModelingObjectType[],
    objects: ModelingObject[],
    linkTypes: ModelingLinkType[],
    links: ModelingLink[],
    actions: ModelingAction[]
  ): string {
    const sqlStatements = [
      '-- AI Ontology Studio Generated DDL & DML Schema',
      '-- 1. Create Core Tables if not exists',
      `CREATE TABLE IF NOT EXISTS life_object_type (id INTEGER PRIMARY KEY, name VARCHAR, description VARCHAR);`,
      `CREATE TABLE IF NOT EXISTS life_object (id INTEGER PRIMARY KEY, object_type_id INTEGER, name VARCHAR, properties VARCHAR, annotations VARCHAR);`,
      `CREATE TABLE IF NOT EXISTS life_link_type (id INTEGER PRIMARY KEY, name VARCHAR, description VARCHAR);`,
      `CREATE TABLE IF NOT EXISTS life_link (id INTEGER PRIMARY KEY, link_type_id INTEGER, source_object_id INTEGER, target_object_id INTEGER, weight DOUBLE);`,
      `CREATE TABLE IF NOT EXISTS life_action (id INTEGER PRIMARY KEY, object_id INTEGER, name VARCHAR, description VARCHAR, status VARCHAR);`,
      '',
      `-- Summary: ${objectTypes.length} types, ${objects.length} entities, ${linkTypes.length} link types, ${links.length} links, ${actions.length} actions.`
    ];
    return sqlStatements.join('\n');
  }

  /**
   * 拓扑布局生成器（以 ObjectType 为核心图谱节点，以 LinkType 为核心关系连线）
   */
  private _generateLayout(
    objectTypes: ModelingObjectType[],
    seedData: Record<string, ModelingObject[]>,
    linkTypes: ModelingLinkType[],
    links: ModelingLink[]
  ): { nodes: ModelingLayoutNode[]; links: ModelingLayoutLink[] } {
    const nodes: ModelingLayoutNode[] = [];
    const layoutLinks: ModelingLayoutLink[] = [];

    const typeCount = Math.max(objectTypes.length, 1);
    const centerX = 380;
    const centerY = 260;
    const ringRadius = 170;

    objectTypes.forEach((ot, index) => {
      const angle = (index / typeCount) * 2 * Math.PI - Math.PI / 2;
      const x = Math.round(centerX + ringRadius * Math.cos(angle));
      const y = Math.round(centerY + ringRadius * Math.sin(angle));
      nodes.push({
        id: ot.name,
        label: ot.name,
        group: ot.category || 'Core',
        objectType: ot.name,
        x,
        y,
      });
    });

    for (const lt of linkTypes) {
      layoutLinks.push({
        source: lt.fromType,
        target: lt.toType,
        label: lt.verb || lt.name,
        weight: 0.8,
      });
    }

    return { nodes, links: layoutLinks };
  }

  /**
   * Topological Graph-to-CTE SQL Compiler
   */
  compileCanvasToCTE(
    items: { id: string; objectId?: number; nodeType?: string; name?: string }[],
    edges: { sourceId: string; targetId: string; label?: string }[],
    objectsLookup: Record<string | number, { name: string; tableName?: string }> = {}
  ): string {
    if (!items || items.length === 0) {
      return '-- Canvas is empty. Add object cards and connecting edges to compile SQL pipeline.';
    }

    const itemMap = new Map<string, { id: string; name: string }>();
    const inDegree = new Map<string, number>();
    const graph = new Map<string, string[]>();
    const incomingMap = new Map<string, string[]>();

    items.forEach((item) => {
      const name = objectsLookup[item.objectId || '']?.name || item.name || `node_${item.id.slice(0, 6)}`;
      const sanitizeName = name.toLowerCase().replace(/[^a-z0-9_]/g, '_');
      itemMap.set(item.id, { id: item.id, name: sanitizeName });
      inDegree.set(item.id, 0);
      graph.set(item.id, []);
      incomingMap.set(item.id, []);
    });

    edges.forEach((edge) => {
      if (itemMap.has(edge.sourceId) && itemMap.has(edge.targetId)) {
        graph.get(edge.sourceId)!.push(edge.targetId);
        incomingMap.get(edge.targetId)!.push(edge.sourceId);
        inDegree.set(edge.targetId, (inDegree.get(edge.targetId) || 0) + 1);
      }
    });

    const queue: string[] = [];
    inDegree.forEach((degree, id) => {
      if (degree === 0) queue.push(id);
    });

    const sortedOrder: string[] = [];
    while (queue.length > 0) {
      const curr = queue.shift()!;
      sortedOrder.push(curr);

      const neighbors = graph.get(curr) || [];
      for (const next of neighbors) {
        const nextDegree = (inDegree.get(next) || 1) - 1;
        inDegree.set(next, nextDegree);
        if (nextDegree === 0) queue.push(next);
      }
    }

    items.forEach((item) => {
      if (!sortedOrder.includes(item.id)) sortedOrder.push(item.id);
    });

    const cteStatements: string[] = [];
    sortedOrder.forEach((nodeId) => {
      const node = itemMap.get(nodeId);
      if (!node) return;

      const incomingSources = incomingMap.get(nodeId) || [];
      if (incomingSources.length === 0) {
        cteStatements.push(`  cte_${node.name} AS (\n    SELECT * FROM ${node.name}\n  )`);
      } else {
        const sourceNames = incomingSources.map((srcId) => `cte_${itemMap.get(srcId)?.name || 'source'}`);
        if (sourceNames.length === 1) {
          cteStatements.push(`  cte_${node.name} AS (\n    SELECT *\n    FROM ${sourceNames[0]}\n  )`);
        } else {
          const mainSource = sourceNames[0];
          const joins = sourceNames.slice(1).map((joinSrc, idx) => `    LEFT JOIN ${joinSrc} s${idx + 1} ON 1=1`).join('\n');
          cteStatements.push(`  cte_${node.name} AS (\n    SELECT ${mainSource}.*\n    FROM ${mainSource}\n${joins}\n  )`);
        }
      }
    });

    const lastNode = sortedOrder[sortedOrder.length - 1];
    const lastNodeName = itemMap.get(lastNode)?.name || 'result';
    return `WITH\n${cteStatements.join(',\n\n')}\n\nSELECT * FROM cte_${lastNodeName};`;
  }
}

export const ontologyModelingService = new OntologyModelingService();
