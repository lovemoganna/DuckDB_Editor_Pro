import React, { useState, useEffect, useMemo } from 'react';
import {
  Layers,
  Database,
  Search,
  Plus,
  Sparkles,
  RefreshCw,
  FolderTree,
  ChevronRight,
  Download,
  Upload,
  RotateCcw,
  Table as TableIcon,
  Check,
  BrainCircuit,
  Trash2,
  Link2,
  Eye,
  EyeOff,
  X,
  FileCode,
} from 'lucide-react';
import { useOntologyStudioStore } from '../../hooks/useOntologyStudioStore';
import { LINK_TYPE_COLOR_TOKENS } from '../Library/ontologyStyles';
import type { RelationCardinality } from '../../types/ontologyStudioTypes';
import { toastService } from '../../services/toastService';
import { useConfirmDialog } from '../ui/ConfirmDialog';

type SidebarTab = 'entities' | 'tables' | 'rules' | 'templates' | 'relations';

const ALL_CARDINALITIES: RelationCardinality[] = ['1:1', '1:N', 'N:1', 'N:M'];

export const OntologyStudioSidebar: React.FC = () => {
  const {
    entities,
    relations,
    selectedId,
    selectedType,
    selectElement,
    searchQuery,
    setSearchQuery,
    addEntity,
    physicalTables,
    isLoadingTables,
    loadPhysicalTables,
    importFromDuckDBTables,
    loadSampleCommerceModel,
    resetToEmpty,
    exportModelJson,
    importModelJson,
    deductionRules,
    deleteDeductionRule,
    hiddenCardinalities,
    toggleCardinalityVisibility,
    setAllCardinalitiesVisible,
  } = useOntologyStudioStore();

  const { confirm } = useConfirmDialog();
  const [activeTab, setActiveTab] = useState<SidebarTab>('entities');
  const [selectedTableNames, setSelectedTableNames] = useState<string[]>([]);
  const [copiedNotification, setCopiedNotification] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importJsonText, setImportJsonText] = useState('');

  useEffect(() => {
    loadPhysicalTables();
  }, [loadPhysicalTables]);

  const filteredEntities = entities.filter(
    (e) =>
      e.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (e.label && e.label.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (e.mappedTable && e.mappedTable.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const toggleTableSelect = (tableName: string) => {
    setSelectedTableNames((prev) =>
      prev.includes(tableName) ? prev.filter((t) => t !== tableName) : [...prev, tableName]
    );
  };

  const handleImportSelectedTables = async () => {
    if (selectedTableNames.length === 0) return;
    await importFromDuckDBTables(selectedTableNames);
    setSelectedTableNames([]);
    setActiveTab('entities');
  };

  const handleImportAllTables = async () => {
    const all = physicalTables.map((t) => t.name);
    if (all.length === 0) return;
    await importFromDuckDBTables(all);
    setSelectedTableNames([]);
    setActiveTab('entities');
  };

  const handleExportJson = () => {
    const json = exportModelJson();
    navigator.clipboard.writeText(json);
    setCopiedNotification(true);
    toastService.success('本体模型 JSON 已复制到剪贴板');
    setTimeout(() => setCopiedNotification(false), 2000);
  };

  const handleConfirmImportJson = () => {
    if (!importJsonText.trim()) {
      toastService.warning('请输入模型 JSON 内容');
      return;
    }
    const ok = importModelJson(importJsonText.trim());
    if (ok) {
      toastService.success('模型导入成功！');
      setIsImportModalOpen(false);
      setImportJsonText('');
    } else {
      toastService.error('导入失败：JSON 格式不合法');
    }
  };

  return (
    <aside className="w-80 shrink-0 border-r border-monokai-border bg-monokai-sidebar flex flex-col h-full select-none text-monokai-fg-muted">
      {/* Top Header & Tabs */}
      <div className="p-3 border-b border-monokai-border space-y-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-monokai-cyan animate-pulse" />
            <span className="font-mono font-bold text-monokai-fg text-xs tracking-wide">
              ONTOLOGY STUDIO
            </span>
          </div>
          <span className="text-meta font-mono px-2 py-0.5 rounded-md bg-monokai-surface text-monokai-cyan border border-monokai-border">
            {entities.length} 实体 / {relations.length} 关系
          </span>
        </div>

        {/* Tab Buttons (5 Tab) */}
        <div className="grid grid-cols-5 gap-1 bg-monokai-bg p-1 rounded-md border border-monokai-border">
          <button
            onClick={() => setActiveTab('entities')}
            className={`py-1 px-1 rounded font-medium text-xs transition-colors cursor-pointer flex items-center justify-center gap-1 ${
              activeTab === 'entities'
                ? 'bg-monokai-surface text-monokai-fg shadow-xs border border-monokai-border'
                : 'text-monokai-comment hover:text-monokai-fg border border-transparent'
            }`}
            title="业务实体库"
          >
            <Layers className="w-3.5 h-3.5" />
            <span>实体</span>
          </button>
          <button
            onClick={() => setActiveTab('tables')}
            className={`py-1 px-1 rounded font-medium text-xs transition-colors cursor-pointer flex items-center justify-center gap-1 ${
              activeTab === 'tables'
                ? 'bg-monokai-surface text-monokai-fg shadow-xs border border-monokai-border'
                : 'text-monokai-comment hover:text-monokai-fg border border-transparent'
            }`}
            title="DuckDB 物理数据表"
          >
            <Database className="w-3.5 h-3.5" />
            <span>物理</span>
          </button>
          <button
            onClick={() => setActiveTab('relations')}
            className={`py-1 px-1 rounded font-medium text-xs transition-colors cursor-pointer flex items-center justify-center gap-1 ${
              activeTab === 'relations'
                ? 'bg-monokai-surface text-monokai-fg shadow-xs border border-monokai-border'
                : 'text-monokai-comment hover:text-monokai-fg border border-transparent'
            }`}
            title="关系类型与过滤"
          >
            <Link2 className="w-3.5 h-3.5" />
            <span>关系</span>
          </button>
          <button
            onClick={() => setActiveTab('rules')}
            className={`py-1 px-1 rounded font-medium text-xs transition-colors cursor-pointer flex items-center justify-center gap-1 ${
              activeTab === 'rules'
                ? 'bg-monokai-surface text-monokai-fg shadow-xs border border-monokai-border'
                : 'text-monokai-comment hover:text-monokai-fg border border-transparent'
            }`}
            title="演绎推演规则库"
          >
            <BrainCircuit className="w-3.5 h-3.5" />
            <span>推演</span>
          </button>
          <button
            onClick={() => setActiveTab('templates')}
            className={`py-1 px-1 rounded font-medium text-xs transition-colors cursor-pointer flex items-center justify-center gap-1 ${
              activeTab === 'templates'
                ? 'bg-monokai-surface text-monokai-fg shadow-xs border border-monokai-border'
                : 'text-monokai-comment hover:text-monokai-fg border border-transparent'
            }`}
            title="预设模板与导入导出"
          >
            <FolderTree className="w-3.5 h-3.5" />
            <span>工具</span>
          </button>
        </div>
      </div>

      {/* Main Tab Content */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        {/* 1. ENTITIES TAB */}
        {activeTab === 'entities' && (
          <div className="p-3 space-y-3">
            {/* Search and Add */}
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="w-3.5 h-3.5 text-monokai-comment absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="搜索实体、物理表..."
                  className="w-full pl-8 pr-2.5 py-1.5 rounded-md bg-monokai-bg border border-monokai-border text-xs text-monokai-fg placeholder-monokai-comment focus:outline-none focus:border-monokai-accent/70 transition-colors"
                />
              </div>
              <button
                onClick={() => addEntity()}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-md bg-monokai-accent text-[#102022] hover:bg-monokai-accent-hover font-semibold text-xs cursor-pointer transition-colors shrink-0 shadow-xs active:scale-98"
                title="新建实体"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>新建</span>
              </button>
            </div>

            {/* Entity List */}
            {filteredEntities.length === 0 ? (
              <div className="text-center py-10 text-monokai-comment space-y-2.5">
                <Layers className="w-8 h-8 mx-auto opacity-30 text-monokai-comment" />
                <p className="text-xs">暂无匹配的业务实体</p>
                <button
                  onClick={() => addEntity()}
                  className="text-xs text-monokai-cyan hover:underline cursor-pointer"
                >
                  点击创建第一个实体
                </button>
              </div>
            ) : (
              <div className="space-y-1.5">
                {filteredEntities.map((ent) => {
                  const isSelected = selectedType === 'entity' && selectedId === ent.id;
                  const color = ent.color || '#66d9ef';

                  return (
                    <div
                      key={ent.id}
                      onClick={() => selectElement('entity', ent.id)}
                      className={`flex items-center justify-between p-2.5 rounded-md cursor-pointer transition-all border ${
                        isSelected
                          ? 'bg-monokai-surface border-monokai-accent/60 text-monokai-fg shadow-xs ring-1 ring-monokai-accent/30'
                          : 'bg-monokai-surface/60 border-monokai-border hover:bg-monokai-surface hover:border-white/15 text-monokai-fg'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span
                          className="w-2.5 h-2.5 rounded-full shrink-0 shadow-xs"
                          style={{ backgroundColor: color }}
                        />
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-xs truncate">{ent.name}</span>
                            {ent.label && (
                              <span className="text-xs text-monokai-comment truncate">
                                {ent.label}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 mt-0.5 text-meta text-monokai-comment">
                            {ent.mappedTable ? (
                              <span className="truncate text-monokai-cyan font-mono">
                                ⌗ {ent.mappedTable}
                              </span>
                            ) : (
                              <span className="italic text-monokai-pink">无物理表</span>
                            )}
                            <span>•</span>
                            <span>{ent.properties.length} 字段</span>
                          </div>
                        </div>
                      </div>

                      <ChevronRight className="w-4 h-4 text-monokai-comment shrink-0" />
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* 2. PHYSICAL TABLES TAB (DUCKDB GROUNDING) */}
        {activeTab === 'tables' && (
          <div className="p-3 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-monokai-fg">DuckDB 物理表检测</span>
              <button
                onClick={() => loadPhysicalTables()}
                disabled={isLoadingTables}
                className="flex items-center gap-1.5 text-xs text-monokai-cyan hover:underline cursor-pointer disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isLoadingTables ? 'animate-spin' : ''}`} />
                <span>刷新</span>
              </button>
            </div>

            {/* Batch Actions */}
            {physicalTables.length > 0 && (
              <div className="flex items-center gap-2 pt-1">
                <button
                  onClick={handleImportAllTables}
                  className="flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2.5 rounded-md bg-monokai-accent/15 hover:bg-monokai-accent/25 text-monokai-accent border border-monokai-accent/30 font-semibold text-xs cursor-pointer transition-colors shadow-xs"
                >
                  <Sparkles className="w-3.5 h-3.5 text-monokai-accent" />
                  <span>一键逆向推导全库</span>
                </button>
                {selectedTableNames.length > 0 && (
                  <button
                    onClick={handleImportSelectedTables}
                    className="flex items-center gap-1 py-1.5 px-2.5 rounded-md bg-monokai-accent text-monokai-bg hover:bg-monokai-accent-hover font-semibold text-xs cursor-pointer transition-colors shadow-xs"
                  >
                    <span>导入 ({selectedTableNames.length})</span>
                  </button>
                )}
              </div>
            )}

            {/* Table List */}
            {isLoadingTables ? (
              <div className="text-center py-10 text-monokai-comment font-mono text-xs">
                正在读取 DuckDB Catalog…
              </div>
            ) : physicalTables.length === 0 ? (
              <div className="text-center py-10 text-monokai-comment space-y-2">
                <Database className="w-8 h-8 mx-auto opacity-30 text-monokai-comment" />
                <p className="text-xs">当前数据库中未检测到物理表</p>
                <p className="text-meta text-monokai-comment">
                  请在工作台导入 CSV/Parquet 或建表，或使用预置模板。
                </p>
              </div>
            ) : (
              <div className="space-y-1.5">
                {physicalTables.map((tbl) => {
                  const isImported = entities.some((e) => e.mappedTable === tbl.name);
                  const isChecked = selectedTableNames.includes(tbl.name);

                  return (
                    <div
                      key={tbl.name}
                      onClick={() => !isImported && toggleTableSelect(tbl.name)}
                      className={`p-2.5 rounded-md border transition-all ${
                        isImported
                          ? 'bg-monokai-surface/40 border-monokai-border opacity-70'
                          : isChecked
                          ? 'bg-monokai-surface border-monokai-accent/60 cursor-pointer shadow-xs ring-1 ring-monokai-accent/30'
                          : 'bg-monokai-surface/60 border-monokai-border hover:border-white/15 hover:bg-monokai-surface cursor-pointer'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 min-w-0">
                          <input
                            type="checkbox"
                            checked={isImported || isChecked}
                            disabled={isImported}
                            onChange={() => toggleTableSelect(tbl.name)}
                            className="rounded border-monokai-border bg-monokai-bg text-monokai-accent focus:ring-0 cursor-pointer"
                          />
                          <span className="font-mono font-medium text-xs text-monokai-fg truncate">
                            {tbl.name}
                          </span>
                        </div>
                        {isImported ? (
                          <span className="text-meta px-1.5 py-0.5 rounded bg-monokai-accent/15 text-monokai-accent border border-monokai-accent/30 shrink-0">
                            已在模型中
                          </span>
                        ) : (
                          <span className="text-meta text-monokai-comment font-mono shrink-0">
                            {tbl.rowCount} 行
                          </span>
                        )}
                      </div>

                      <div className="mt-1.5 pl-6 flex items-center gap-2 text-meta text-monokai-comment">
                        <span>{tbl.columns.length} 个字段</span>
                        <span>•</span>
                        <span className="truncate font-mono">
                          主键:{' '}
                          {tbl.columns.find((c) => c.pk)?.name ||
                            tbl.columns[0]?.name ||
                            '无'}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* 3. RELATIONS TAB (关系基数过滤) */}
        {activeTab === 'relations' && (
          <div className="p-3 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Link2 className="w-3.5 h-3.5 text-monokai-cyan" />
                <span className="text-xs font-semibold text-monokai-fg">
                  关系类型过滤
                </span>
              </div>
              {hiddenCardinalities.length > 0 && (
                <button
                  onClick={() => setAllCardinalitiesVisible()}
                  className="text-xs text-monokai-cyan hover:underline cursor-pointer"
                  title="全部显示"
                >
                  全显
                </button>
              )}
            </div>

            <p className="text-xs text-monokai-comment leading-relaxed">
              按关系基数（cardinality）显示或隐藏对应连线，颜色按类型自动区分。
            </p>

            <div className="space-y-1.5">
              {ALL_CARDINALITIES.map((card) => {
                const info = LINK_TYPE_COLOR_TOKENS[card];
                const count = relations.filter((r) => r.cardinality === card).length;
                const isHidden = hiddenCardinalities.includes(card);
                return (
                  <div
                    key={card}
                    className={`p-2 rounded-md border transition-colors ${
                      isHidden
                        ? 'bg-monokai-bg/60 border-monokai-border opacity-70'
                        : 'bg-monokai-surface/60 border-monokai-border hover:border-white/15'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span
                          className="w-3.5 h-3.5 rounded shrink-0"
                          style={{
                            backgroundColor: isHidden ? 'rgba(113,113,122,0.4)' : info.color,
                            border: `1px solid ${info.color}80`,
                          }}
                        />
                        <span
                          className="font-mono font-semibold text-xs"
                          style={{ color: isHidden ? undefined : info.color }}
                        >
                          {card}
                        </span>
                        <span className="text-xs text-monokai-comment truncate">
                          {info.label}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <span className="text-xs font-mono text-monokai-fg-muted">
                          {count} 条
                        </span>
                        <button
                          onClick={() => toggleCardinalityVisibility(card)}
                          disabled={count === 0 && !isHidden}
                          className={`p-1 rounded transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed ${
                            isHidden
                              ? 'text-monokai-comment hover:text-monokai-accent hover:bg-monokai-bg'
                              : 'text-monokai-accent hover:text-monokai-fg hover:bg-monokai-bg'
                          }`}
                          title={isHidden ? '显示该类型' : '隐藏该类型'}
                        >
                          {isHidden ? (
                            <EyeOff className="w-3.5 h-3.5" />
                          ) : (
                            <Eye className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {relations.length === 0 && (
              <div className="text-center py-8 text-monokai-comment space-y-2">
                <Link2 className="w-8 h-8 mx-auto opacity-30" />
                <p className="text-xs">当前画布暂无关系</p>
              </div>
            )}
          </div>
        )}

        {/* 4. DEDUCTION RULES TAB */}
        {activeTab === 'rules' && (
          <div className="p-3 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-monokai-fg">业务语义推演规则</span>
              <span className="text-meta font-mono text-amber-300 px-2 py-0.5 rounded bg-amber-500/10 border border-monokai-border-subtle">
                {deductionRules.length} 条规则
              </span>
            </div>

            <p className="text-meta text-monokai-comment leading-relaxed">
              基于实体间关联拓扑与多跳条件，自动推断高阶业务事实与标签。
            </p>

            <div className="space-y-2">
              {deductionRules.map((rule) => (
                <div
                  key={rule.id}
                  className="p-3 rounded-md border border-monokai-border bg-monokai-surface/60 hover:border-white/15 transition-colors space-y-2"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <span className="font-semibold text-xs text-monokai-fg block truncate">
                        {rule.name}
                      </span>
                      <span className="text-meta text-monokai-comment line-clamp-2 mt-0.5">
                        {rule.description}
                      </span>
                    </div>
                    <button
                      onClick={() => deleteDeductionRule(rule.id)}
                      className="text-monokai-comment hover:text-monokai-pink p-1 rounded hover:bg-monokai-surface transition-colors shrink-0 cursor-pointer"
                      title="删除规则"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div className="p-2 rounded bg-monokai-bg border border-monokai-border font-mono text-meta space-y-1">
                    <div className="text-monokai-yellow truncate">
                      <span className="text-monokai-comment">IF: </span>
                      {rule.condition}
                    </div>
                    <div className="text-monokai-accent truncate">
                      <span className="text-monokai-comment">THEN: </span>
                      {rule.inferredFact}
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-meta text-monokai-comment pt-0.5">
                    <span>置信度: {(rule.confidence * 100).toFixed(0)}%</span>
                    <span className="px-1.5 py-0.5 rounded bg-monokai-surface font-mono text-2xs text-monokai-fg-muted border border-monokai-border">
                      活跃生效中
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 5. TEMPLATES & MODEL TOOLS TAB */}
        {activeTab === 'templates' && (
          <div className="p-3 space-y-3.5">
            <div>
              <span className="text-xs font-semibold text-monokai-fg block mb-2">预置行业语义模板</span>
              <div className="space-y-2">
                <div
                  onClick={() => loadSampleCommerceModel()}
                  className="p-3 rounded-md border border-monokai-border bg-monokai-surface/60 hover:bg-monokai-surface hover:border-monokai-border-strong cursor-pointer transition-all space-y-1.5 shadow-xs"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-xs text-monokai-fg">电商交易体系 (Commerce)</span>
                    <span className="text-meta font-mono px-2 py-0.5 rounded bg-monokai-bg text-monokai-fg-muted border border-monokai-border-subtle">
                      4 实体 / 3 关联
                    </span>
                  </div>
                  <p className="text-meta text-monokai-comment leading-relaxed">
                    客户(Customer) &rarr; 订单(Order) &rarr; 明细(OrderItem) &rarr; 商品(Product)
                  </p>
                </div>
              </div>
            </div>

            <div className="border-t border-monokai-border pt-3 space-y-2">
              <span className="text-xs font-semibold text-monokai-fg block">模型导入 / 导出</span>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={handleExportJson}
                  className="flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-md bg-monokai-surface hover:bg-monokai-surface/80 text-monokai-fg border border-monokai-border text-xs cursor-pointer transition-colors shadow-xs"
                >
                  <Download className="w-3.5 h-3.5 text-monokai-cyan" />
                  <span>{copiedNotification ? '已复制 JSON' : '复制模型 JSON'}</span>
                </button>
                <button
                  onClick={() => setIsImportModalOpen(true)}
                  className="flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-md bg-monokai-surface hover:bg-monokai-surface/80 text-monokai-fg border border-monokai-border text-xs cursor-pointer transition-colors shadow-xs"
                >
                  <Upload className="w-3.5 h-3.5 text-monokai-accent" />
                  <span>导入模型 JSON</span>
                </button>
              </div>
            </div>

            <div className="border-t border-monokai-border pt-3">
              <button
                onClick={async () => {
                  const ok = await confirm({
                    title: '清空画布确认',
                    message: '确认清空当前本体模型图谱吗？此操作无法撤销。',
                    variant: 'danger',
                    confirmText: '确认清空',
                  });
                  if (ok) {
                    resetToEmpty();
                    toastService.info('已清空当前画布');
                  }
                }}
                className="w-full flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-md bg-monokai-surface hover:bg-rose-500/10 text-monokai-comment hover:text-rose-400 border border-monokai-border hover:border-rose-500/30 text-xs font-medium cursor-pointer transition-colors"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>重置清空当前画布</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 导入模型 JSON 模态对话框 */}
      {isImportModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-monokai-sidebar border border-monokai-border rounded-xl shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between px-4 py-3 border-b border-monokai-border bg-monokai-surface/50">
              <div className="flex items-center gap-2">
                <FileCode className="w-4 h-4 text-monokai-cyan" />
                <span className="font-semibold text-xs text-monokai-fg">导入本体模型 JSON</span>
              </div>
              <button
                onClick={() => {
                  setIsImportModalOpen(false);
                  setImportJsonText('');
                }}
                className="text-monokai-comment hover:text-monokai-fg p-1 rounded-md hover:bg-monokai-surface transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 space-y-3">
              <p className="text-xs text-monokai-comment">
                请在下方粘贴导出的本体模型 JSON 字符串（包含 entities、relations、rules 等配置）：
              </p>
              <textarea
                value={importJsonText}
                onChange={(e) => setImportJsonText(e.target.value)}
                placeholder='{"entities": [...], "relations": [...]}'
                rows={8}
                className="w-full bg-monokai-bg border border-monokai-border rounded-lg p-3 text-xs font-mono text-monokai-fg placeholder-monokai-comment/50 focus:outline-none focus:border-monokai-accent/70 resize-none transition-colors"
              />
            </div>

            <div className="flex items-center justify-end gap-2 px-4 py-3 border-t border-monokai-border bg-monokai-surface/30">
              <button
                onClick={() => {
                  setIsImportModalOpen(false);
                  setImportJsonText('');
                }}
                className="px-3 py-1.5 rounded-lg border border-monokai-border bg-monokai-surface text-monokai-fg-muted hover:text-monokai-fg text-xs transition-colors cursor-pointer"
              >
                取消
              </button>
              <button
                onClick={handleConfirmImportJson}
                className="px-3 py-1.5 rounded-lg bg-monokai-accent text-[#102022] hover:bg-monokai-accent-hover text-xs font-semibold shadow-xs transition-colors cursor-pointer"
              >
                解析并导入
              </button>
            </div>
          </div>
        </div>
      )}
    </aside>
  );
};
