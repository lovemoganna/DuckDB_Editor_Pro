/**
 * ontologyModelingService — AI 本体建模编排层
 *
 * 在 ontologyAiService 基础上提供更高层的建模编排：
 * - 输入概念 → 完整本体模型 → DDL → 种子数据 → 可视化布局
 * - 支持 google / groq / openai / claude 多种后端
 */

import { ontologyAiService } from './ontologyAiService';

// ============================================================
// Types
// ============================================================

export interface ModelingObjectType {
  name: string;
  description: string;
  properties?: Record<string, string>;
}

export interface ModelingObject {
  name: string;
  objectType: string;
  properties: Record<string, any>;
  annotations?: string;
}

export interface ModelingLinkType {
  name: string;
  description: string;
  fromType: string;
  toType: string;
}

export interface ModelingLink {
  from: string;
  to: string;
  linkType: string;
  weight: number;
}

export interface ModelingLayoutNode {
  id: string;
  label: string;
  group: string;
  x?: number;
  y?: number;
}

export interface ModelingLayoutLink {
  source: string;
  target: string;
  label?: string;
}

export interface OntologyModelingResult {
  objectTypes: ModelingObjectType[];
  objects: ModelingObject[];
  linkTypes: ModelingLinkType[];
  links: ModelingLink[];
  suggestedDDL: string;
  seedData: Record<string, ModelingObject[]>;
  graphLayout: {
    nodes: ModelingLayoutNode[];
    links: ModelingLayoutLink[];
  };
  raw?: any;
}

export interface ModelingProgress {
  phase: 'parsing' | 'object-model' | 'link-model' | 'seed-data' | 'layout' | 'done' | 'error';
  message: string;
  progress: number; // 0-100
}

// ============================================================
// Service
// ============================================================

class OntologyModelingService {
  /**
   * 从概念描述生成本体模型（完整流程）
   * @param concept 用户输入的概念描述，如"在线教育平台：课程、学生、教师"
   * @param onProgress 进度回调
   */
  async modelFromConcept(
    concept: string,
    onProgress?: (p: ModelingProgress) => void
  ): Promise<OntologyModelingResult> {
    const report = (phase: ModelingProgress['phase'], message: string, progress: number) => {
      onProgress?.({ phase, message, progress });
    };

    try {
      // Phase 1: 对象建模
      report('parsing', '解析概念并规划本体结构...', 10);
      report('object-model', 'AI 正在生成本体对象模型...', 20);

      const objectModel = await ontologyAiService.generateObjectModel(concept);

      report('object-model', `解析完成：${objectModel.objectTypes?.length || 0} 个对象类型`, 40);

      // Phase 2: 关系建模（基于生成的对象类型生成关系）
      report('link-model', 'AI 正在推导关系模型...', 50);

      const objectTypeNames = (objectModel.objectTypes || []).map((t: any) => t.name);
      const linkTypes: ModelingLinkType[] = [];
      const links: ModelingLink[] = [];

      if (objectTypeNames.length >= 2) {
        // 生成两两关系候选
        const linkModel = await ontologyAiService.generateLinkModel(
          objectTypeNames[0],
          objectTypeNames.slice(1).join(', '),
          concept
        );
        if (linkModel.linkType) {
          linkTypes.push({
            name: linkModel.linkType.name,
            description: linkModel.linkType.description || '',
            fromType: objectTypeNames[0],
            toType: objectTypeNames[1] || objectTypeNames[0],
          });
        }
      }

      // Phase 3: 种子数据整理
      report('seed-data', '生成种子数据...', 65);

      const seedData: Record<string, ModelingObject[]> = {};
      for (const obj of (objectModel.objects || [])) {
        const typeName = obj.typeName || objectTypeNames[0];
        if (!seedData[typeName]) seedData[typeName] = [];
        seedData[typeName].push({
          name: obj.name,
          objectType: typeName,
          properties: obj.properties || {},
          annotations: obj.annotations,
        });
      }

      // Phase 4: 图谱布局
      report('layout', '生成可视化布局...', 80);

      const graphLayout = this._generateLayout(
        objectModel.objectTypes || [],
        seedData,
        linkTypes,
        links
      );

      report('done', '建模完成', 100);

      return {
        objectTypes: (objectModel.objectTypes || []).map((t: any) => ({
          name: t.name,
          description: t.description || '',
          properties: t.properties,
        })),
        objects: Object.values(seedData).flat(),
        linkTypes,
        links,
        suggestedDDL: objectModel.suggestedDDL || '',
        seedData,
        graphLayout,
        raw: objectModel,
      };
    } catch (e: any) {
      report('error', `建模失败: ${e.message}`, 0);
      throw e;
    }
  }

  /**
   * 快速建模：仅调用对象建模，不生成关系和布局
   */
  async quickModel(concept: string): Promise<OntologyModelingResult> {
    const objectModel = await ontologyAiService.generateObjectModel(concept);

    const objectTypeNames = (objectModel.objectTypes || []).map((t: any) => t.name);
    const seedData: Record<string, ModelingObject[]> = {};
    for (const obj of (objectModel.objects || [])) {
      const typeName = obj.typeName || objectTypeNames[0];
      if (!seedData[typeName]) seedData[typeName] = [];
      seedData[typeName].push({
        name: obj.name,
        objectType: typeName,
        properties: obj.properties || {},
        annotations: obj.annotations,
      });
    }

    return {
      objectTypes: (objectModel.objectTypes || []).map((t: any) => ({
        name: t.name,
        description: t.description || '',
        properties: t.properties,
      })),
      objects: Object.values(seedData).flat(),
      linkTypes: [],
      links: [],
      suggestedDDL: objectModel.suggestedDDL || '',
      seedData,
      graphLayout: this._generateLayout(objectModel.objectTypes || [], seedData, [], []),
      raw: objectModel,
    };
  }

  /**
   * 根据对象类型和种子数据生成图谱布局
   * 使用力导向布局算法在内存中计算初始位置
   */
  private _generateLayout(
    objectTypes: any[],
    seedData: Record<string, ModelingObject[]>,
    linkTypes: ModelingLinkType[],
    links: ModelingLink[]
  ): { nodes: ModelingLayoutNode[]; links: ModelingLayoutLink[] } {
    const nodes: ModelingLayoutNode[] = [];
    const layoutLinks: ModelingLayoutLink[] = [];

    // 按类型分组以便环形布局
    const typeNames = Object.keys(seedData);
    const typeCount = typeNames.length;
    const centerX = 400;
    const centerY = 300;
    const ringRadius = 200;

    typeNames.forEach((typeName, typeIndex) => {
      const objects = seedData[typeName] || [];
      const angleStep = (2 * Math.PI) / Math.max(objects.length, 1);
      const baseAngle = (typeIndex / typeCount) * 2 * Math.PI;

      objects.forEach((obj, objIndex) => {
        const objAngle = baseAngle + objIndex * angleStep;
        const x = centerX + ringRadius * Math.cos(objAngle);
        const y = centerY + ringRadius * Math.sin(objAngle);
        nodes.push({
          id: obj.name,
          label: obj.name,
          group: typeName,
          x,
          y,
        });
      });
    });

    // 添加类型节点（虚拟节点，用于图例）
    objectTypes.forEach((ot: any, i: number) => {
      const angle = (i / objectTypes.length) * 2 * Math.PI - Math.PI / 2;
      nodes.push({
        id: `__type__${ot.name}`,
        label: ot.name,
        group: '__schema__',
        x: centerX + (ringRadius + 80) * Math.cos(angle),
        y: centerY + (ringRadius + 80) * Math.sin(angle),
      });
    });

    // 关系连线
    for (const link of links) {
      layoutLinks.push({
        source: link.from,
        target: link.to,
        label: link.linkType,
      });
    }

    return { nodes, links: layoutLinks };
  }
}

export const ontologyModelingService = new OntologyModelingService();
