import React, { useState, useEffect, useCallback } from 'react';
import { duckDBService } from '../services/duckdbService';
import type { CatalogDatabaseInfo } from '../services/databaseCatalog';
import { MEMORY_DATABASE_NAME } from '../services/databaseCatalog';
import {
  X,
  Database,
  Plus,
  Trash2,
  HardDrive,
  Cpu,
  Unplug,
  Check,
  Upload,
  Layers,
  ChevronDown,
  ChevronRight,
  FolderOpen,
} from 'lucide-react';
import { copyDomainObjects, listDomainObjects, type DomainObject } from '../services/domainMigration';
import { ActionButton, ModalShell } from './ui/Workbench';
import { useConfirmDialog } from './ui/ConfirmDialog';
import { useAppStore } from '../hooks/store/useAppStore';

interface ProjectManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onProjectSelected: (name: string) => void;
  currentProject: string | null;
}

export const ProjectManagerModal: React.FC<ProjectManagerModalProps> = ({
  isOpen,
  onClose,
  onProjectSelected,
  currentProject,
}) => {
  const { confirm: confirmDialog } = useConfirmDialog();
  const [databases, setDatabases] = useState<CatalogDatabaseInfo[]>([]);
  const [detachedFiles, setDetachedFiles] = useState<string[]>([]);
  const [tableCounts, setTableCounts] = useState<Record<string, number>>({});
  const [dbSchemas, setDbSchemas] = useState<Record<string, string[]>>({});
  const [newDbName, setNewDbName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [persistentCreate, setPersistentCreate] = useState(true);
  const [showMigration, setShowMigration] = useState(false);
  const [migrationSource, setMigrationSource] = useState('');
  const [migrationTarget, setMigrationTarget] = useState('');
  const [migrationObjects, setMigrationObjects] = useState<DomainObject[]>([]);
  const [migrationSelection, setMigrationSelection] = useState<string[]>([]);
  const [migrationResult, setMigrationResult] = useState('');

  const migrationKey = (object: DomainObject) => `${object.kind}:${object.id}`;

  const inspectMigration = async () => {
    setLoading(true);
    setError(null);
    try {
      const objects = await listDomainObjects(migrationSource);
      setMigrationObjects(objects);
      setMigrationSelection([]);
      setMigrationResult(`源库有 ${objects.length} 个可迁移对象，请选择要复制的项目。`);
    } catch (e: any) { setError(e?.message || String(e)); }
    finally { setLoading(false); }
  };

  const runMigration = async () => {
    setLoading(true);
    setError(null);
    try {
      const selected = migrationObjects.filter((object) => migrationSelection.includes(migrationKey(object)));
      const result = await copyDomainObjects(migrationSource, migrationTarget, selected);
      setMigrationResult(`已复制 ${result.copied} 个对象、核对 ${result.rows} 行数据；源库保持不变。`);
      setMigrationObjects([]);
      setMigrationSelection([]);
      await loadDatabases();
    } catch (e: any) { setError(e?.message || String(e)); }
    finally { setLoading(false); }
  };

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    },
    [onClose],
  );

  const loadDatabases = useCallback(async () => {
    try {
      const [list, files, counts, schemas] = await Promise.all([
        duckDBService.listDatabases(),
        duckDBService.listDetachedDatabaseFiles(),
        duckDBService.getDatabaseTableCounts(),
        duckDBService.getDatabaseSchemas ? duckDBService.getDatabaseSchemas().catch(() => ({} as Record<string, string[]>)) : Promise.resolve({}),
      ]);
      setDatabases(list);
      const attached = new Set(list.map((db) => db.name));
      setDetachedFiles(files.filter((name) => !attached.has(name)));
      setTableCounts(counts);
      setDbSchemas(schemas || {});
    } catch (e) {
      console.error(e);
      setError('无法从 DuckDB Catalog 读取数据库列表');
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      void loadDatabases();
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }
  }, [isOpen, handleKeyDown, loadDatabases]);

  const handleCreate = async () => {
    if (!newDbName.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const created = await duckDBService.createDatabase(newDbName.trim(), {
        persistent: persistentCreate,
        activate: true,
      });
      await loadDatabases();
      setNewDbName('');
      onProjectSelected(created.name);
      onClose();
    } catch (e: any) {
      setError(e?.message || String(e));
    } finally {
      setLoading(false);
    }
  };

  const handleSelect = async (name: string) => {
    setLoading(true);
    setError(null);
    try {
      await duckDBService.useDatabase(name);
      onProjectSelected(name);
      onClose();
    } catch (e: any) {
      setError(e?.message || String(e));
    } finally {
      setLoading(false);
    }
  };

  const handleAttach = async (name: string, andOpen = false) => {
    setLoading(true);
    setError(null);
    try {
      const attached = await duckDBService.attachDatabase(name, { persistent: true });
      if (andOpen) {
        await duckDBService.useDatabase(attached.name);
        onProjectSelected(attached.name);
        onClose();
      } else {
        await loadDatabases();
      }
    } catch (e: any) {
      setError(e?.message || String(e));
    } finally {
      setLoading(false);
    }
  };

  const handleImport = async (file: File) => {
    setLoading(true);
    setError(null);
    try {
      const alias = (newDbName.trim() || file.name.replace(/\.duckdb$/i, '')).trim();
      const imported = await duckDBService.importDatabaseFile(file, alias);
      await duckDBService.useDatabase(imported.name);
      await loadDatabases();
      onProjectSelected(imported.name);
      onClose();
    } catch (e: any) {
      setError(e?.message || String(e));
    } finally {
      setLoading(false);
    }
  };

  const isCurrentActiveDb = (name: string) => {
    const storeDb = useAppStore.getState().currentDatabase;
    return Boolean(
      (currentProject && currentProject === name) ||
      (storeDb && storeDb === name) ||
      databases.find((d) => d.name === name)?.isCurrent
    );
  };

  const handleDetach = async (name: string) => {
    if (name === MEMORY_DATABASE_NAME) return;
    const ok = await confirmDialog({
      title: '确认卸载数据库？',
      message: `确定卸载数据库「${name}」？此操作将关闭数据库连接，但保留其 .duckdb 持久化文件，后续可随时重新挂载。`,
      variant: 'warning',
      confirmText: '卸载',
      cancelText: '取消',
    });
    if (!ok) return;

    setLoading(true);
    setError(null);
    const wasActive = isCurrentActiveDb(name);
    try {
      await duckDBService.detachDatabase(name);
      await loadDatabases();
      if (wasActive) {
        onProjectSelected(MEMORY_DATABASE_NAME);
      }
    } catch (e: any) {
      setError(e?.message || String(e));
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (name: string) => {
    if (name === MEMORY_DATABASE_NAME) return;
    const ok = await confirmDialog({
      title: '确认删除数据库？',
      message: `确定永久删除数据库「${name}」？将 DETACH 并物理删除对应的 .duckdb 持久化文件，数据将无法恢复！`,
      variant: 'danger',
      confirmText: '彻底删除',
      cancelText: '取消',
    });
    if (!ok) return;

    setLoading(true);
    setError(null);
    const wasActive = isCurrentActiveDb(name);
    try {
      await duckDBService.dropDatabase(name);
      await loadDatabases();
      if (wasActive) {
        onProjectSelected(MEMORY_DATABASE_NAME);
      }
    } catch (e: any) {
      setError(e?.message || String(e));
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteDetachedFile = async (name: string) => {
    const ok = await confirmDialog({
      title: '删除未挂载的数据库文件？',
      message: `确定从 OPFS 存储中永久删除文件「${name}.duckdb」？此操作不可撤销。`,
      variant: 'danger',
      confirmText: '删除文件',
      cancelText: '取消',
    });
    if (!ok) return;

    setLoading(true);
    setError(null);
    try {
      await duckDBService.deleteDetachedDatabaseFile(name);
      await loadDatabases();
    } catch (e: any) {
      setError(e?.message || String(e));
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <ModalShell
      open={isOpen}
      onClose={onClose}
      title="数据库管理"
      description="管理数据库实例、挂载与本地存储文件"
      icon={Database}
      iconColor="text-monokai-blue"
      size="lg"
    >
      <div className="flex flex-col gap-4 max-h-[75vh] overflow-y-auto pr-1">
        {error && (
          <div className="p-3 bg-monokai-red/10 border border-monokai-red/30 text-monokai-red text-xs rounded-lg flex items-center justify-between gap-2 shrink-0">
            <span className="min-w-0 break-words">{error}</span>
            <button type="button" onClick={() => setError(null)} className="cursor-pointer hover:opacity-80">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* 顶部：新建 / 导入数据库区域 */}
        <div className="flex flex-col gap-2.5 p-3.5 bg-monokai-surface/60 border border-monokai-border/80 rounded-xl shrink-0">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-monokai-fg flex items-center gap-1.5">
              <Plus className="w-3.5 h-3.5 text-monokai-accent" /> 创建或导入新数据库
            </span>
            <label className="inline-flex items-center gap-1.5 text-xs text-monokai-accent hover:underline cursor-pointer">
              <Upload className="w-3.5 h-3.5" /> 导入 .duckdb 文件
              <input
                type="file"
                accept=".duckdb"
                className="sr-only"
                disabled={loading}
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) void handleImport(file);
                  event.target.value = '';
                }}
              />
            </label>
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              value={newDbName}
              onChange={(e) => setNewDbName(e.target.value)}
              placeholder="新数据库名称…"
              className="flex-1 px-3 py-1.5 border border-monokai-border rounded-lg focus:outline-none focus:border-monokai-accent bg-monokai-bg text-monokai-fg placeholder-monokai-comment/50 text-xs transition-colors"
              onKeyDown={(e) => e.key === 'Enter' && void handleCreate()}
            />
            <ActionButton
              variant="primary"
              size="sm"
              loading={loading}
              disabled={!newDbName.trim()}
              onClick={() => void handleCreate()}
              icon={Plus}
            >
              创建并打开
            </ActionButton>
          </div>
          <label className="flex items-center gap-2 text-2xs text-monokai-comment cursor-pointer select-none">
            <input
              type="checkbox"
              checked={persistentCreate}
              onChange={(e) => setPersistentCreate(e.target.checked)}
              className="rounded border-monokai-border"
            />
            持久化保存到本地 (.duckdb 文件)
          </label>
        </div>

        {/* 核心板块 1：已挂载的数据库列表 */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-semibold text-monokai-fg flex items-center gap-1.5">
              <Database className="w-3.5 h-3.5 text-monokai-blue" />
              已挂载数据库 ({databases.length})
            </h4>
          </div>

          <div className="space-y-2">
            {databases.length === 0 ? (
              <div className="text-center py-8 border border-dashed border-monokai-border rounded-xl">
                <Database className="w-10 h-10 text-monokai-comment/30 mx-auto mb-2" />
                <p className="text-monokai-comment text-xs">Catalog 中暂无挂载的数据库</p>
              </div>
            ) : (
              databases.map((db) => {
                const isActive = isCurrentActiveDb(db.name);
                const isMemory = db.name === MEMORY_DATABASE_NAME;
                const isWorkspaceHub = db.name === 'duckdb_manager_workspace';
                const count = tableCounts[db.name] ?? 0;

                return (
                  <div
                    key={db.name}
                    className={`group flex items-center justify-between p-3 rounded-xl border transition-all ${
                      isActive
                        ? 'border-monokai-accent bg-monokai-accent/5 shadow-xs'
                        : 'border-monokai-border hover:border-monokai-border/80 bg-monokai-bg'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                          isActive
                            ? 'bg-monokai-accent/20 text-monokai-accent'
                            : 'bg-monokai-sidebar text-monokai-comment group-hover:bg-monokai-accent/10 group-hover:text-monokai-accent transition-colors'
                        }`}
                      >
                        {db.persistent ? (
                          <HardDrive className="w-4.5 h-4.5" />
                        ) : (
                          <Cpu className="w-4.5 h-4.5" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <h3
                            className={`text-xs font-semibold truncate ${
                              isActive ? 'text-monokai-accent' : 'text-monokai-fg'
                            }`}
                          >
                            {db.name}
                          </h3>
                          {isMemory && (
                            <span className="px-1.5 py-0.2 bg-monokai-surface text-monokai-comment text-2xs rounded border border-monokai-border">
                              临时空间
                            </span>
                          )}
                          {isWorkspaceHub && (
                            <span className="px-1.5 py-0.2 bg-monokai-surface text-monokai-comment text-2xs rounded border border-monokai-border">
                              系统主库
                            </span>
                          )}
                          {db.readonly && (
                            <span className="px-1.5 py-0.2 bg-amber-500/10 text-amber-400 text-2xs rounded border border-amber-500/20">
                              只读
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 mt-0.5 text-2xs text-monokai-comment font-mono">
                          <span>{count} 个数据表</span>
                          <span>·</span>
                          <span className="truncate max-w-[220px]">{db.path || ':memory:'}</span>
                          <span>·</span>
                          <span>{db.persistent ? 'OPFS 持久化' : '内存'}</span>
                        </div>
                        {dbSchemas[db.name] && dbSchemas[db.name].length > 0 && (
                          <div className="flex items-center flex-wrap gap-1 mt-1 text-2xs">
                            <span className="text-monokai-comment text-[10px]">Schema:</span>
                            {dbSchemas[db.name].map((sch) => (
                              <span
                                key={sch}
                                className="px-1.5 py-0.2 rounded bg-monokai-surface text-monokai-fg-muted font-mono text-[10px] border border-monokai-border/70"
                              >
                                {sch}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {isActive ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-monokai-accent/15 text-monokai-accent text-2xs font-bold rounded-md">
                          <Check className="w-3 h-3" /> 当前使用中
                        </span>
                      ) : (
                        <ActionButton
                          variant="secondary"
                          size="sm"
                          disabled={loading}
                          onClick={() => void handleSelect(db.name)}
                        >
                          切换
                        </ActionButton>
                      )}

                      {!isMemory && !isWorkspaceHub && (
                        <div className="flex items-center gap-1 border-l border-monokai-border/60 pl-2">
                          <button
                            type="button"
                            onClick={() => void handleDetach(db.name)}
                            disabled={loading}
                            className="p-1.5 text-monokai-comment hover:text-amber-400 hover:bg-amber-400/10 rounded-lg transition-colors cursor-pointer"
                            title="卸载 (DETACH)"
                          >
                            <Unplug className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => void handleDelete(db.name)}
                            disabled={loading}
                            className="p-1.5 text-monokai-comment hover:text-monokai-red hover:bg-monokai-red/10 rounded-lg transition-colors cursor-pointer"
                            title="删除数据库"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* 核心板块 2：未挂载的数据库文件列表 */}
        {detachedFiles.length > 0 && (
          <div className="space-y-2 pt-2 border-t border-monokai-border/60">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-semibold text-monokai-fg flex items-center gap-1.5">
                <FolderOpen className="w-3.5 h-3.5 text-amber-400" />
                未挂载的数据库文件 ({detachedFiles.length})
              </h4>
            </div>
            <div className="space-y-2">
              {detachedFiles.map((name) => (
                <div
                  key={name}
                  className="flex items-center justify-between rounded-xl border border-monokai-border px-3.5 py-2.5 text-xs bg-monokai-bg hover:border-monokai-border/80"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-monokai-sidebar flex items-center justify-center text-monokai-comment">
                      <HardDrive className="w-4 h-4" />
                    </div>
                    <div>
                      <span className="font-mono font-medium text-monokai-fg">{name}.duckdb</span>
                      <p className="text-2xs text-monokai-comment">离线文件</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <ActionButton
                      variant="primary"
                      size="sm"
                      disabled={loading}
                      onClick={() => void handleAttach(name, true)}
                    >
                      挂载并打开
                    </ActionButton>
                    <ActionButton
                      variant="secondary"
                      size="sm"
                      disabled={loading}
                      onClick={() => void handleAttach(name, false)}
                    >
                      挂载
                    </ActionButton>
                    <button
                      type="button"
                      onClick={() => void handleDeleteDetachedFile(name)}
                      disabled={loading}
                      className="p-1.5 text-monokai-comment hover:text-monokai-red hover:bg-monokai-red/10 rounded-lg transition-colors cursor-pointer border border-transparent hover:border-monokai-red/30"
                      title="删除文件"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 辅助板块 3：折叠式跨库对象迁移 */}
        {databases.length > 1 && (
          <div className="rounded-xl border border-monokai-border/80 bg-monokai-bg overflow-hidden">
            <button
              type="button"
              onClick={() => setShowMigration((prev) => !prev)}
              className="w-full flex items-center justify-between p-3 text-xs font-semibold text-monokai-fg hover:bg-monokai-surface/60 transition-colors cursor-pointer"
            >
              <span className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-monokai-accent" />
                跨库对象复制
              </span>
              {showMigration ? (
                <ChevronDown className="w-4 h-4 text-monokai-comment" />
              ) : (
                <ChevronRight className="w-4 h-4 text-monokai-comment" />
              )}
            </button>

            {showMigration && (
              <div className="p-3 border-t border-monokai-border/80 space-y-3 text-xs bg-monokai-surface/30">
                <div className="flex gap-2">
                  <select
                    aria-label="迁移源库"
                    value={migrationSource}
                    onChange={(e) => {
                      setMigrationSource(e.target.value);
                      setMigrationObjects([]);
                    }}
                    className="flex-1 bg-monokai-surface border border-monokai-border rounded-lg px-2.5 py-1.5 text-xs text-monokai-fg focus:outline-none focus:border-monokai-accent"
                  >
                    <option value="">选择源库</option>
                    {databases.map((db) => (
                      <option key={db.name} value={db.name}>
                        {db.name}
                      </option>
                    ))}
                  </select>
                  <select
                    aria-label="迁移目标库"
                    value={migrationTarget}
                    onChange={(e) => setMigrationTarget(e.target.value)}
                    className="flex-1 bg-monokai-surface border border-monokai-border rounded-lg px-2.5 py-1.5 text-xs text-monokai-fg focus:outline-none focus:border-monokai-accent"
                  >
                    <option value="">选择目标库</option>
                    {databases.map((db) => (
                      <option key={db.name} value={db.name}>
                        {db.name}
                      </option>
                    ))}
                  </select>
                  <ActionButton
                    variant="secondary"
                    size="sm"
                    disabled={
                      loading ||
                      !migrationSource ||
                      !migrationTarget ||
                      migrationSource === migrationTarget
                    }
                    onClick={() => void inspectMigration()}
                  >
                    核对对象
                  </ActionButton>
                </div>
                {migrationObjects.length > 0 && (
                  <div className="max-h-40 overflow-y-auto space-y-1 bg-monokai-surface rounded-lg p-2.5 border border-monokai-border/60">
                    {migrationObjects.map((object) => (
                      <label
                        key={migrationKey(object)}
                        className="flex items-center gap-2 cursor-pointer text-xs text-monokai-fg hover:text-monokai-accent"
                      >
                        <input
                          type="checkbox"
                          checked={migrationSelection.includes(migrationKey(object))}
                          onChange={(e) =>
                            setMigrationSelection((previous) =>
                              e.target.checked
                                ? [...previous, migrationKey(object)]
                                : previous.filter((key) => key !== migrationKey(object)),
                            )
                          }
                        />
                        <span className="font-mono text-2xs uppercase px-1 py-0.2 bg-monokai-sidebar rounded text-monokai-comment">
                          {object.kind}
                        </span>
                        <span>{object.label}</span>
                        {object.rowCount != null && (
                          <span className="text-2xs text-monokai-comment">
                            ({object.rowCount} 行)
                          </span>
                        )}
                      </label>
                    ))}
                  </div>
                )}
                {migrationObjects.length > 0 && (
                  <ActionButton
                    variant="primary"
                    size="sm"
                    disabled={loading || migrationSelection.length === 0}
                    onClick={() => void runMigration()}
                  >
                    复制所选 {migrationSelection.length} 个对象
                  </ActionButton>
                )}
                {migrationResult && (
                  <p className="text-xs text-monokai-accent font-medium">{migrationResult}</p>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </ModalShell>
  );
};

