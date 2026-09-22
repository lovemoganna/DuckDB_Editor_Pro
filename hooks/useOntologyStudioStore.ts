import { create } from 'zustand';
import dagre from 'dagre';
import {
  OntologyEntity,
  OntologyRelation,
  SelectedElementType,
  PhysicalTableInfo,
  PhysicalTableColumn,
  RelationCardinality,
  RelationJoinType,
  PropertyItem,
  OntologyStudioMode,
  DeductionRule,
  MultiHopPath,
} from '../types/ontologyStudioTypes';
import { duckDBService } from '../services/duckdbService';
import { compileOntologyGraphToSql, SqlCompilerNode, SqlCompilerEdge } from '../utils/ontologySqlCompiler';

const STORAGE_KEY = 'duckdb_ontology_studio_model_v1';

const ENTITY_COLORS = [
  '#66D9EF', // cyan
  '#A6E22E', // green
  '#FD971F', // orange
  '#F92672', // magenta/rose
  '#0EA5E9', // ocean blue (replaces purple per Purple Ban)
  '#38BDF8', // sky
  '#FBBF24', // amber
];

const DEFAULT_SAMPLE_ENTITIES: OntologyEntity[] = [
  {
    id: 'ent_customer',
    name: 'Customer',
    label: '客户',
    description: '企业注册客户及消费主体',
    color: '#66D9EF',
    mappedTable: 'customers',
    primaryKey: 'customer_id',
    position: { x: 50, y: 120 },
    properties: [
      { name: 'customer_id', type: 'INTEGER', isPrimaryKey: true, isNullable: false, description: '客户唯一编号' },
      { name: 'customer_name', type: 'VARCHAR', isPrimaryKey: false, isNullable: false, description: '客户姓名' },
      { name: 'email', type: 'VARCHAR', isPrimaryKey: false, isNullable: true, description: '注册邮箱' },
      { name: 'city', type: 'VARCHAR', isPrimaryKey: false, isNullable: true, description: '所在城市' },
      { name: 'registered_at', type: 'TIMESTAMP', isPrimaryKey: false, isNullable: false, description: '注册时间' },
    ],
    metrics: [
      { id: 'm1', name: 'customer_count', label: '客户总数', expression: 'COUNT(customer_id)', aggregation: 'COUNT' },
    ],
    rowCount: 1250,
  },
  {
    id: 'ent_order',
    name: 'Order',
    label: '订单',
    description: '交易订单主表记录',
    color: '#A6E22E',
    mappedTable: 'orders',
    primaryKey: 'order_id',
    position: { x: 420, y: 120 },
    properties: [
      { name: 'order_id', type: 'INTEGER', isPrimaryKey: true, isNullable: false, description: '订单唯一流水号' },
      { name: 'customer_id', type: 'INTEGER', isForeignKey: true, isNullable: false, description: '所属客户编号' },
      { name: 'order_date', type: 'DATE', isNullable: false, description: '下单日期' },
      { name: 'total_amount', type: 'DECIMAL(12,2)', isNullable: false, description: '订单支付总金额' },
      { name: 'order_status', type: 'VARCHAR', isNullable: false, description: '订单状态 (PAID/SHIPPED/CANCELLED)' },
    ],
    metrics: [
      { id: 'm2', name: 'order_count', label: '订单总量', expression: 'COUNT(order_id)', aggregation: 'COUNT' },
      { id: 'm3', name: 'gmv', label: '总GMV', expression: 'SUM(total_amount)', aggregation: 'SUM' },
    ],
    rowCount: 8520,
  },
  {
    id: 'ent_order_item',
    name: 'OrderItem',
    label: '订单明细',
    description: '订单包含的具体商品项行级明细',
    color: '#FD971F',
    mappedTable: 'order_items',
    primaryKey: 'item_id',
    position: { x: 780, y: 120 },
    properties: [
      { name: 'item_id', type: 'INTEGER', isPrimaryKey: true, isNullable: false, description: '明细项编号' },
      { name: 'order_id', type: 'INTEGER', isForeignKey: true, isNullable: false, description: '所属订单编号' },
      { name: 'product_id', type: 'INTEGER', isForeignKey: true, isNullable: false, description: '所购商品编号' },
      { name: 'quantity', type: 'INTEGER', isNullable: false, description: '购买数量' },
      { name: 'unit_price', type: 'DECIMAL(10,2)', isNullable: false, description: '购买单价' },
    ],
    metrics: [
      { id: 'm4', name: 'item_quantity_sum', label: '销售件数', expression: 'SUM(quantity)', aggregation: 'SUM' },
    ],
    rowCount: 24600,
  },
  {
    id: 'ent_product',
    name: 'Product',
    label: '商品',
    description: '上架销售的标品库',
    color: '#F92672',
    mappedTable: 'products',
    primaryKey: 'product_id',
    position: { x: 780, y: 440 },
    properties: [
      { name: 'product_id', type: 'INTEGER', isPrimaryKey: true, isNullable: false, description: '商品唯一编号' },
      { name: 'product_name', type: 'VARCHAR', isNullable: false, description: '商品标题' },
      { name: 'category', type: 'VARCHAR', isNullable: false, description: '所属类目' },
      { name: 'price', type: 'DECIMAL(10,2)', isNullable: false, description: '标价' },
    ],
    metrics: [
      { id: 'm5', name: 'product_count', label: '在售商品数', expression: 'COUNT(product_id)', aggregation: 'COUNT' },
    ],
    rowCount: 380,
  },
];

const DEFAULT_SAMPLE_RELATIONS: OntologyRelation[] = [
  {
    id: 'rel_cust_order',
    sourceEntityId: 'ent_customer',
    targetEntityId: 'ent_order',
    name: 'places_orders',
    label: '下达订单',
    cardinality: '1:N',
    joinType: 'LEFT',
    sourceField: 'customer_id',
    targetField: 'customer_id',
    description: '一名客户可以产生多笔订单',
  },
  {
    id: 'rel_order_item',
    sourceEntityId: 'ent_order',
    targetEntityId: 'ent_order_item',
    name: 'contains_items',
    label: '包含明细',
    cardinality: '1:N',
    joinType: 'INNER',
    sourceField: 'order_id',
    targetField: 'order_id',
    description: '每笔订单包含一个或多个购买项',
  },
  {
    id: 'rel_item_prod',
    sourceEntityId: 'ent_order_item',
    targetEntityId: 'ent_product',
    name: 'references_product',
    label: '关联商品',
    cardinality: 'N:1',
    joinType: 'LEFT',
    sourceField: 'product_id',
    targetField: 'product_id',
    description: '明细项归属于具体某个商品',
  },
];

const DEFAULT_SAMPLE_RULES: DeductionRule[] = [
  {
    id: 'rule_high_value_customer',
    name: '高价值客户推演',
    description: '累计订单金额大于 5000 且有多次复购记录的客户实体',
    sourceEntityId: 'ent_customer',
    targetEntityId: 'ent_order',
    condition: 'SUM(orders.total_amount) > 5000',
    inferredFact: '标记为「VIP 核心客户」，享有大客户售后服务与专属权益',
    confidence: 0.95,
  },
  {
    id: 'rule_cross_sell_candidate',
    name: '商品交叉复购潜客',
    description: '购买过商品明细但尚未复购相关品类的客户群',
    sourceEntityId: 'ent_order_item',
    targetEntityId: 'ent_product',
    condition: 'OrderItem.product_id IS NOT NULL',
    inferredFact: '推演商品推荐候选队列 (Recommendation Candidate Set)',
    confidence: 0.88,
  },
];

function loadSavedModel(): { entities: OntologyEntity[]; relations: OntologyRelation[] } {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed.entities) && Array.isArray(parsed.relations)) {
        return {
          entities: parsed.entities,
          relations: parsed.relations,
        };
      }
    }
  } catch (e) {
    console.warn('[OntologyStudio] Failed to load saved state from localStorage:', e);
  }
  return {
    entities: [],
    relations: [],
  };
}

function saveModel(entities: OntologyEntity[], relations: OntologyRelation[]) {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        entities,
        relations,
        updatedAt: new Date().toISOString(),
      })
    );
  } catch (e) {
    console.warn('[OntologyStudio] Failed to save state to localStorage:', e);
  }
}

export interface OntologyStudioState {
  entities: OntologyEntity[];
  relations: OntologyRelation[];
  selectedType: SelectedElementType;
  selectedId: string | null;
  searchQuery: string;
  activeMode: OntologyStudioMode;
  physicalTables: PhysicalTableInfo[];
  isLoadingTables: boolean;
  compiledSql: string;
  livePreviewData: Record<string, any>[] | null;
  isLoadingPreview: boolean;
  previewError: string | null;
  deductionRules: DeductionRule[];
  activeDeductionPath: MultiHopPath | null;
  /** 隐藏的关系基数（session 内有效，不持久化） */
  hiddenCardinalities: RelationCardinality[];

  // Actions
  setActiveMode: (mode: OntologyStudioMode) => void;
  selectElement: (type: SelectedElementType, id: string | null) => void;
  setSearchQuery: (q: string) => void;
  addEntity: (entity?: Partial<OntologyEntity>) => string;
  updateEntity: (id: string, updates: Partial<OntologyEntity>) => void;
  deleteEntity: (id: string) => void;
  updateEntityPosition: (id: string, position: { x: number; y: number }) => void;

  addRelation: (relation: Omit<OntologyRelation, 'id'>) => string;
  updateRelation: (id: string, updates: Partial<OntologyRelation>) => void;
  deleteRelation: (id: string) => void;

  // Deduction Actions
  addDeductionRule: (rule: Omit<DeductionRule, 'id'>) => string;
  deleteDeductionRule: (id: string) => void;
  findMultiHopPaths: (sourceId: string, targetId: string, maxHops?: number) => MultiHopPath[];
  setActiveDeductionPath: (path: MultiHopPath | null) => void;

  // Relation Cardinality Visibility Actions (session only)
  toggleCardinalityVisibility: (card: RelationCardinality) => void;
  isCardinalityVisible: (card: RelationCardinality) => boolean;
  setAllCardinalitiesVisible: () => void;
  getVisibleRelations: () => OntologyRelation[];

  loadPhysicalTables: () => Promise<void>;
  importFromDuckDBTables: (tableNames: string[]) => Promise<void>;
  autoLayout: (direction?: 'TB' | 'LR') => void;
  compileToSql: () => string;
  fetchLivePreview: (tableName: string) => Promise<void>;
  clearLivePreview: () => void;
  loadSampleCommerceModel: () => void;
  resetToEmpty: () => void;
  exportModelJson: () => string;
  importModelJson: (json: string) => boolean;
}

export const useOntologyStudioStore = create<OntologyStudioState>((set, get) => {
  const initial = loadSavedModel();

  return {
    entities: initial.entities,
    relations: initial.relations,
    selectedType: null,
    selectedId: null,
    searchQuery: '',
    activeMode: 'modeling',
    physicalTables: [],
    isLoadingTables: false,
    compiledSql: '',
    livePreviewData: null,
    isLoadingPreview: false,
    previewError: null,
    deductionRules: DEFAULT_SAMPLE_RULES,
    activeDeductionPath: null,
    hiddenCardinalities: [],

    setActiveMode: (mode) => {
      set({ activeMode: mode });
    },

    setActiveDeductionPath: (path) => {
      set({ activeDeductionPath: path });
    },

    // 新增：关系基数可见性控制
    toggleCardinalityVisibility: (card) => {
      set((state) => {
        const isHidden = state.hiddenCardinalities.includes(card);
        return {
          hiddenCardinalities: isHidden
            ? state.hiddenCardinalities.filter((c) => c !== card)
            : [...state.hiddenCardinalities, card],
        };
      });
    },

    isCardinalityVisible: (card) => {
      return !get().hiddenCardinalities.includes(card);
    },

    setAllCardinalitiesVisible: () => {
      set({ hiddenCardinalities: [] });
    },

    getVisibleRelations: () => {
      const { relations, hiddenCardinalities } = get();
      if (hiddenCardinalities.length === 0) return relations;
      return relations.filter((r) => !hiddenCardinalities.includes(r.cardinality));
    },

    addDeductionRule: (rule) => {
      const id = `rule_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 6)}`;
      const newRule: DeductionRule = { id, ...rule };
      set((state) => ({ deductionRules: [...state.deductionRules, newRule] }));
      return id;
    },

    deleteDeductionRule: (id) => {
      set((state) => ({
        deductionRules: state.deductionRules.filter((r) => r.id !== id),
      }));
    },

    findMultiHopPaths: (sourceId, targetId, maxHops = 4) => {
      if (!sourceId || !targetId || sourceId === targetId) return [];
      const { entities, relations } = get();
      const entityMap = new Map(entities.map((e) => [e.id, e]));
      const paths: MultiHopPath[] = [];

      type EdgeInfo = { edgeId: string; nextNode: string; label: string; forward: boolean };
      const adj = new Map<string, EdgeInfo[]>();
      entities.forEach((e) => adj.set(e.id, []));

      relations.forEach((r) => {
        adj.get(r.sourceEntityId)?.push({
          edgeId: r.id,
          nextNode: r.targetEntityId,
          label: r.label || r.name,
          forward: true,
        });
        adj.get(r.targetEntityId)?.push({
          edgeId: r.id,
          nextNode: r.sourceEntityId,
          label: r.label || r.name,
          forward: false,
        });
      });

      interface QueueItem {
        node: string;
        nodes: string[];
        edges: string[];
        descParts: string[];
      }

      const queue: QueueItem[] = [
        {
          node: sourceId,
          nodes: [sourceId],
          edges: [],
          descParts: [entityMap.get(sourceId)?.label || entityMap.get(sourceId)?.name || sourceId],
        },
      ];

      while (queue.length > 0) {
        const current = queue.shift()!;
        if (current.nodes.length > maxHops + 1) continue;

        if (current.node === targetId && current.nodes.length > 1) {
          paths.push({
            id: `path_${paths.length + 1}_${current.nodes.join('_')}`,
            nodes: current.nodes,
            edges: current.edges,
            description: current.descParts.join(' ➔ '),
          });
          if (paths.length >= 6) break;
          continue;
        }

        const neighbors = adj.get(current.node) || [];
        for (const neighbor of neighbors) {
          if (!current.nodes.includes(neighbor.nextNode)) {
            const nextEnt = entityMap.get(neighbor.nextNode);
            const nextLabel = nextEnt?.label || nextEnt?.name || neighbor.nextNode;
            queue.push({
              node: neighbor.nextNode,
              nodes: [...current.nodes, neighbor.nextNode],
              edges: [...current.edges, neighbor.edgeId],
              descParts: [
                ...current.descParts,
                `${neighbor.label}`,
                nextLabel,
              ],
            });
          }
        }
      }

      return paths;
    },

    selectElement: (type, id) => {
      set({ selectedType: type, selectedId: id });
    },

    setSearchQuery: (q) => {
      set({ searchQuery: q });
    },

    addEntity: (partial = {}) => {
      const { entities, relations } = get();
      const id = `ent_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 6)}`;
      const colorIndex = entities.length % ENTITY_COLORS.length;
      const count = entities.length + 1;

      const newEntity: OntologyEntity = {
        id,
        name: partial.name || `Entity_${count}`,
        label: partial.label || `业务实体 ${count}`,
        description: partial.description || '',
        color: partial.color || ENTITY_COLORS[colorIndex],
        mappedTable: partial.mappedTable || '',
        primaryKey: partial.primaryKey || 'id',
        properties: partial.properties || [
          { name: 'id', type: 'INTEGER', isPrimaryKey: true, isNullable: false, description: '主键标识' },
          { name: 'created_at', type: 'TIMESTAMP', isNullable: false, description: '创建时间' },
        ],
        metrics: partial.metrics || [
          { id: `m_${Date.now()}`, name: 'total_count', label: '总记录数', expression: 'COUNT(*)', aggregation: 'COUNT' },
        ],
        position: partial.position || { x: 100 + (entities.length % 5) * 80, y: 100 + (entities.length % 5) * 60 },
        rowCount: partial.rowCount || 0,
      };

      const updatedEntities = [...entities, newEntity];
      saveModel(updatedEntities, relations);
      set({
        entities: updatedEntities,
        selectedType: 'entity',
        selectedId: id,
      });
      return id;
    },

    updateEntity: (id, updates) => {
      const { entities, relations } = get();
      const updatedEntities = entities.map((ent) => (ent.id === id ? { ...ent, ...updates } : ent));
      saveModel(updatedEntities, relations);
      set({ entities: updatedEntities });
    },

    deleteEntity: (id) => {
      const { entities, relations, selectedId, selectedType } = get();
      const updatedEntities = entities.filter((ent) => ent.id !== id);
      const updatedRelations = relations.filter(
        (rel) => rel.sourceEntityId !== id && rel.targetEntityId !== id
      );
      saveModel(updatedEntities, updatedRelations);
      set({
        entities: updatedEntities,
        relations: updatedRelations,
        selectedType: selectedId === id ? null : selectedType,
        selectedId: selectedId === id ? null : selectedId,
      });
    },

    updateEntityPosition: (id, position) => {
      const { entities, relations } = get();
      const updatedEntities = entities.map((ent) => (ent.id === id ? { ...ent, position } : ent));
      saveModel(updatedEntities, relations);
      set({ entities: updatedEntities });
    },

    addRelation: (relationData) => {
      const { entities, relations } = get();
      const id = `rel_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 6)}`;
      const newRelation: OntologyRelation = {
        id,
        ...relationData,
      };
      const updatedRelations = [...relations, newRelation];
      saveModel(entities, updatedRelations);
      set({
        relations: updatedRelations,
        selectedType: 'relation',
        selectedId: id,
      });
      return id;
    },

    updateRelation: (id, updates) => {
      const { entities, relations } = get();
      const updatedRelations = relations.map((rel) => (rel.id === id ? { ...rel, ...updates } : rel));
      saveModel(entities, updatedRelations);
      set({ relations: updatedRelations });
    },

    deleteRelation: (id) => {
      const { entities, relations, selectedId, selectedType } = get();
      const updatedRelations = relations.filter((rel) => rel.id !== id);
      saveModel(entities, updatedRelations);
      set({
        relations: updatedRelations,
        selectedType: selectedId === id ? null : selectedType,
        selectedId: selectedId === id ? null : selectedId,
      });
    },

    loadPhysicalTables: async () => {
      set({ isLoadingTables: true });
      try {
        let tableNames: string[] = [];
        try {
          tableNames = await duckDBService.getTables();
        } catch {
          const res = await duckDBService.query('SHOW TABLES');
          tableNames = (res || []).map((r: any) => String(r.name || Object.values(r)[0] || ''));
        }

        const tableInfos: PhysicalTableInfo[] = [];

        for (const tName of tableNames) {
          if (!tName || tName.startsWith('_sys_')) continue;
          try {
            const pragma = await duckDBService.query(`PRAGMA table_info('${tName}')`);
            const columns: PhysicalTableColumn[] = (pragma || []).map((col: any) => ({
              name: String(col.name || ''),
              type: String(col.type || 'VARCHAR'),
              pk: Boolean(col.pk),
              notnull: Boolean(col.notnull),
            }));

            let rowCount = 0;
            try {
              const countRes = await duckDBService.query(`SELECT COUNT(*) as c FROM "${tName}"`);
              if (countRes && countRes[0]) {
                rowCount = Number(countRes[0].c || 0);
              }
            } catch {
              rowCount = 0;
            }

            tableInfos.push({
              name: tName,
              rowCount,
              columns,
            });
          } catch (e) {
            console.warn(`[OntologyStudio] Failed to inspect table ${tName}:`, e);
          }
        }

        set({ physicalTables: tableInfos, isLoadingTables: false });
      } catch (err) {
        console.error('[OntologyStudio] Error loading physical tables:', err);
        set({ physicalTables: [], isLoadingTables: false });
      }
    },

    importFromDuckDBTables: async (tableNames: string[]) => {
      const { entities, relations, physicalTables } = get();
      const newEntities: OntologyEntity[] = [...entities];
      const newRelations: OntologyRelation[] = [...relations];

      for (const tName of tableNames) {
        // If already imported, skip
        if (newEntities.some((e) => e.mappedTable === tName)) {
          continue;
        }

        const tableMeta = physicalTables.find((t) => t.name === tName);
        let columns: PhysicalTableColumn[] = tableMeta ? tableMeta.columns : [];

        if (columns.length === 0) {
          try {
            const pragma = await duckDBService.query(`PRAGMA table_info('${tName}')`);
            columns = (pragma || []).map((c: any) => ({
              name: String(c.name || ''),
              type: String(c.type || 'VARCHAR'),
              pk: Boolean(c.pk),
              notnull: Boolean(c.notnull),
            }));
          } catch {
            columns = [{ name: 'id', type: 'INTEGER', pk: true, notnull: true }];
          }
        }

        const pkCol = columns.find((c) => c.pk)?.name || columns[0]?.name || 'id';
        const color = ENTITY_COLORS[newEntities.length % ENTITY_COLORS.length];

        const properties: PropertyItem[] = columns.map((col) => {
          const isFkCandidate = col.name.endsWith('_id') && col.name !== pkCol;
          return {
            name: col.name,
            type: col.type,
            isPrimaryKey: col.pk,
            isForeignKey: isFkCandidate,
            isNullable: !col.notnull,
            description: col.pk ? '主键标识' : isFkCandidate ? '外键候选' : '',
          };
        });

        // Derive meaningful entity label from table name
        const cleanName = tName.replace(/^.*?\./, '');
        const entityName = cleanName
          .split('_')
          .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
          .join('');

        const newEnt: OntologyEntity = {
          id: `ent_${cleanName}_${Date.now().toString(36)}`,
          name: entityName,
          label: cleanName,
          description: `从物理表 ${tName} 导入的业务实体`,
          color,
          mappedTable: tName,
          primaryKey: pkCol,
          properties,
          metrics: [
            {
              id: `m_${Date.now()}_${cleanName}`,
              name: `${cleanName}_count`,
              label: '记录总数',
              expression: 'COUNT(*)',
              aggregation: 'COUNT',
            },
          ],
          position: {
            x: 80 + (newEntities.length % 4) * 320,
            y: 80 + Math.floor(newEntities.length / 4) * 280,
          },
          rowCount: tableMeta?.rowCount || 0,
        };

        newEntities.push(newEnt);
      }

      // Automatically deduce foreign key relationships between imported entities
      for (const ent of newEntities) {
        for (const prop of ent.properties) {
          if (prop.isForeignKey && prop.name.endsWith('_id')) {
            const targetBase = prop.name.replace(/_id$/, '').toLowerCase();
            const targetEnt = newEntities.find(
              (candidate) =>
                candidate.id !== ent.id &&
                (candidate.mappedTable?.toLowerCase().includes(targetBase) ||
                  candidate.name.toLowerCase().includes(targetBase))
            );

            if (targetEnt) {
              const alreadyExists = newRelations.some(
                (rel) =>
                  (rel.sourceEntityId === ent.id && rel.targetEntityId === targetEnt.id) ||
                  (rel.sourceEntityId === targetEnt.id && rel.targetEntityId === ent.id)
              );

              if (!alreadyExists) {
                newRelations.push({
                  id: `rel_${ent.id}_${targetEnt.id}`,
                  sourceEntityId: targetEnt.id,
                  targetEntityId: ent.id,
                  name: `${targetEnt.name.toLowerCase()}_to_${ent.name.toLowerCase()}`,
                  label: `${targetEnt.label} 关联 ${ent.label}`,
                  cardinality: '1:N',
                  joinType: 'LEFT',
                  sourceField: targetEnt.primaryKey || 'id',
                  targetField: prop.name,
                  description: `根据外键 ${prop.name} 自动推导关系`,
                });
              }
            }
          }
        }
      }

      saveModel(newEntities, newRelations);
      set({ entities: newEntities, relations: newRelations });
      get().autoLayout('LR');
    },

    autoLayout: (direction = 'LR') => {
      const { entities, relations } = get();
      if (entities.length === 0) return;

      const g = new dagre.graphlib.Graph();
      g.setGraph({
        rankdir: direction,
        nodesep: 120,
        ranksep: 200,
        marginx: 60,
        marginy: 60,
      });
      g.setDefaultEdgeLabel(() => ({}));

      const nodeWidth = 280;
      const nodeHeight = 220;

      entities.forEach((ent) => {
        g.setNode(ent.id, { width: nodeWidth, height: nodeHeight });
      });

      relations.forEach((rel) => {
        g.setEdge(rel.sourceEntityId, rel.targetEntityId);
      });

      dagre.layout(g);

      const updatedEntities = entities.map((ent) => {
        const nodeWithPos = g.node(ent.id);
        if (nodeWithPos) {
          return {
            ...ent,
            position: {
              x: Math.round(nodeWithPos.x - nodeWidth / 2),
              y: Math.round(nodeWithPos.y - nodeHeight / 2),
            },
          };
        }
        return ent;
      });

      saveModel(updatedEntities, relations);
      set({ entities: updatedEntities });
    },

    compileToSql: () => {
      const { entities, relations } = get();
      const compilerNodes: SqlCompilerNode[] = entities.map((ent) => ({
        id: ent.id,
        name: ent.name,
        sourceTable: ent.mappedTable || ent.name.toLowerCase(),
        selectFields: ent.properties.map((p) => p.name),
      }));

      const compilerEdges: SqlCompilerEdge[] = relations.map((rel) => {
        const sourceEnt = entities.find((e) => e.id === rel.sourceEntityId);
        const targetEnt = entities.find((e) => e.id === rel.targetEntityId);
        const sourceT = sourceEnt?.mappedTable || sourceEnt?.name.toLowerCase() || 'src';
        const targetT = targetEnt?.mappedTable || targetEnt?.name.toLowerCase() || 'tgt';

        return {
          id: rel.id,
          sourceNodeId: rel.sourceEntityId,
          targetNodeId: rel.targetEntityId,
          joinType: rel.joinType || 'LEFT',
          onCondition: `${targetT}.${rel.targetField} = ${sourceT}.${rel.sourceField}`,
        };
      });

      const compileResult = compileOntologyGraphToSql(compilerNodes, compilerEdges);
      return compileResult.sql;
    },

    fetchLivePreview: async (tableName: string) => {
      if (!tableName) return;
      set({ isLoadingPreview: true, previewError: null });
      try {
        const querySql = `SELECT * FROM "${tableName.replace(/"/g, '""')}" LIMIT 10`;
        const res = await duckDBService.query(querySql);
        set({
          livePreviewData: res || [],
          isLoadingPreview: false,
          previewError: null,
        });
      } catch (err: any) {
        set({
          livePreviewData: null,
          isLoadingPreview: false,
          previewError: err?.message || '读取物理表样本失败',
        });
      }
    },

    clearLivePreview: () => {
      set({ livePreviewData: null, previewError: null });
    },

    loadSampleCommerceModel: () => {
      saveModel(DEFAULT_SAMPLE_ENTITIES, DEFAULT_SAMPLE_RELATIONS);
      set({
        entities: DEFAULT_SAMPLE_ENTITIES,
        relations: DEFAULT_SAMPLE_RELATIONS,
        selectedType: 'entity',
        selectedId: DEFAULT_SAMPLE_ENTITIES[0].id,
      });
      get().autoLayout('LR');
    },

    resetToEmpty: () => {
      saveModel([], []);
      set({
        entities: [],
        relations: [],
        selectedType: null,
        selectedId: null,
        compiledSql: '',
        livePreviewData: null,
        hiddenCardinalities: [],
      });
    },

    exportModelJson: () => {
      const { entities, relations } = get();
      return JSON.stringify(
        {
          version: '1.0.0',
          name: 'DuckDB_Ontology_Model',
          updatedAt: new Date().toISOString(),
          entities,
          relations,
        },
        null,
        2
      );
    },

    importModelJson: (jsonString: string) => {
      try {
        const parsed = JSON.parse(jsonString);
        if (Array.isArray(parsed.entities) && Array.isArray(parsed.relations)) {
          saveModel(parsed.entities, parsed.relations);
          set({
            entities: parsed.entities,
            relations: parsed.relations,
            selectedType: null,
            selectedId: null,
          });
          get().autoLayout('LR');
          return true;
        }
      } catch (e) {
        console.error('[OntologyStudio] Failed to parse model json:', e);
      }
      return false;
    },
  };
});
