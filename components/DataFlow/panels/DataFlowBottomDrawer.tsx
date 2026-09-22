/**
 * DataFlowBottomDrawer - 底部可伸缩控制台抽屉与全局执行监控
 *
 * 核心特性：
 * 1. 平时收起为 28px 精致状态栏（显示 WASM 状态、拓扑总数与耗时）
 * 2. 顶部带自由拖拽手柄 (Vertical Resizer)，支持 140px ~ 500px 自由伸缩并记忆
 * 3. 三大视图：全链路运行日志、当前节点历史、全量采样数据预览
 * 4. 日志支持一键清空与自动滚动开关
 */

import React, { useRef, useEffect, useState, useCallback } from 'react';
import {
  Trash2,
  CheckCircle2,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  Table,
  Terminal,
  Clock,
  Activity,
  GitBranch,
  Cpu,
} from 'lucide-react';
import { useWorkflowStore } from '../../../services/dataflow/workflowStore';
import { dfEmpty, dfEmptyHint, dfEmptyTitle, dfTabActive, dfTabIdle, dfTabUnderline, dfTable, dfTableHead, dfTableRow } from '../dataflowUi';

export const DataFlowBottomDrawer: React.FC = () => {
  const {
    runLogs,
    clearLogs,
    autoScrollLogs,
    setAutoScrollLogs,
    bottomDrawerTab,
    setBottomDrawerTab,
    isBottomDrawerOpen,
    toggleBottomDrawer,
    setIsBottomDrawerOpen,
    selectNode,
    selectedNodeId,
    nodes,
    edges,
    dataFlowMode,
  } = useWorkflowStore();

  const [drawerHeight, setDrawerHeight] = useState<number>(() => {
    const saved = localStorage.getItem('dataflow_drawer_height');
    return saved ? Math.max(140, Math.min(500, Number(saved))) : 210;
  });

  const [isDragging, setIsDragging] = useState(false);
  const logTableRef = useRef<HTMLDivElement>(null);

  // 垂直自由拖拽高度
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);

    const startY = e.clientY;
    const startHeight = drawerHeight;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const deltaY = startY - moveEvent.clientY;
      const nextHeight = Math.max(130, Math.min(520, startHeight + deltaY));
      setDrawerHeight(nextHeight);
      localStorage.setItem('dataflow_drawer_height', String(nextHeight));
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  }, [drawerHeight]);

  // 自动滚动到底部
  useEffect(() => {
    if (autoScrollLogs && logTableRef.current) {
      logTableRef.current.scrollTop = logTableRef.current.scrollHeight;
    }
  }, [runLogs, autoScrollLogs]);

  const selectedNode = nodes.find(n => n.id === selectedNodeId);

  // 当前节点的历史执行记录（按时间倒序）
  const nodeHistory = selectedNodeId
    ? [...runLogs].filter(l => l.nodeId === selectedNodeId).reverse()
    : [];

  return (
    <div
      style={{ height: isBottomDrawerOpen ? `${drawerHeight}px` : '28px' }}
      className={`border-t border-monokai-border bg-monokai-surface text-monokai-fg transition-[height] ${
        isDragging ? 'transition-none' : 'duration-200'
      } flex flex-col font-sans select-none relative z-20`}
    >
      {/* ── 拖拽调整手柄（仅展开时激活） ── */}
      {isBottomDrawerOpen && (
        <div
          onMouseDown={handleMouseDown}
          className="absolute -top-1.5 left-0 right-0 h-3 cursor-ns-resize z-30 group flex items-center justify-center hover:bg-monokai-accent/10 transition-colors"
          title="上下拖拽调整控制台高度"
        >
          <div className="w-10 h-1 rounded-full bg-monokai-border group-hover:bg-monokai-accent transition-colors" />
        </div>
      )}

      {/* ── 抽屉顶栏（28px 高度） ── */}
      <div className="flex h-7 shrink-0 items-center justify-between border-b border-monokai-border/80 px-3 bg-monokai-surface/90">
        {/* 左侧：Tabs 切换与快速状态指示 */}
        <div className="flex h-full items-center">
          {/* 运行日志 */}
          <button
            type="button"
            onClick={() => {
              setBottomDrawerTab('logs');
              if (!isBottomDrawerOpen) setIsBottomDrawerOpen(true);
            }}
            className={`relative mr-4 flex h-full items-center gap-1.5 transition-colors cursor-pointer ${
              isBottomDrawerOpen && bottomDrawerTab === 'logs'
                ? dfTabActive
                : dfTabIdle
            }`}
          >
            <Terminal className="w-3 h-3 shrink-0" />
            <span>运行日志</span>
            {runLogs.length > 0 && (
              <span className="text-3xs font-mono px-1 py-0.2 rounded-full bg-monokai-elevated border border-monokai-border text-monokai-comment">
                {runLogs.length}
              </span>
            )}
            {isBottomDrawerOpen && bottomDrawerTab === 'logs' && (
              <span className={dfTabUnderline} />
            )}
          </button>

          {/* 节点历史 */}
          <button
            type="button"
            onClick={() => {
              setBottomDrawerTab('node_history');
              if (!isBottomDrawerOpen) setIsBottomDrawerOpen(true);
            }}
            className={`relative mr-4 flex h-full items-center gap-1.5 transition-colors cursor-pointer ${
              isBottomDrawerOpen && bottomDrawerTab === 'node_history'
                ? dfTabActive
                : dfTabIdle
            }`}
          >
            <GitBranch className="w-3 h-3 shrink-0" />
            <span>节点历史</span>
            {selectedNode && (
              <span
                className="text-3xs font-mono px-1 py-0.2 rounded bg-monokai-elevated border border-monokai-border text-monokai-cyan truncate max-w-[80px]"
                title={selectedNode.data.title}
              >
                {selectedNode.data.title}
              </span>
            )}
            {isBottomDrawerOpen && bottomDrawerTab === 'node_history' && (
              <span className={dfTabUnderline} />
            )}
          </button>

          {/* 数据预览 */}
          <button
            type="button"
            onClick={() => {
              setBottomDrawerTab('preview');
              if (!isBottomDrawerOpen) setIsBottomDrawerOpen(true);
            }}
            className={`relative flex h-full items-center gap-1.5 transition-colors cursor-pointer mr-4 ${
              isBottomDrawerOpen && bottomDrawerTab === 'preview'
                ? dfTabActive
                : dfTabIdle
            }`}
          >
            <Table className="w-3 h-3 shrink-0" />
            <span>全量采样</span>
            {isBottomDrawerOpen && bottomDrawerTab === 'preview' && (
              <span className={dfTabUnderline} />
            )}
          </button>

          {/* 状态徽标 */}
          <div className="hidden sm:flex items-center gap-3 pl-3 border-l border-monokai-border/60 text-2xs font-mono text-monokai-comment">
            <span className="flex items-center gap-1 text-monokai-fg">
              <span className="w-1.5 h-1.5 rounded-full bg-monokai-accent shadow-[0_0_5px_rgba(166,226,46,0.6)]" />
              DuckDB 运行中
            </span>
            <span>{nodes.length} 个节点</span>
            <span>{edges.length} 条数据流</span>
          </div>
        </div>

        {/* 右侧控制项 */}
        <div className="flex items-center gap-3 text-xs text-monokai-comment">
          {isBottomDrawerOpen && bottomDrawerTab === 'logs' && (
            <button
              type="button"
              onClick={clearLogs}
              disabled={runLogs.length === 0}
              className="flex items-center gap-1 hover:text-monokai-pink transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
              title="清空运行日志"
            >
              <Trash2 className="h-3 w-3" />
              <span className="text-2xs">清空</span>
            </button>
          )}

          {isBottomDrawerOpen && (
            <button
              type="button"
              onClick={() => setAutoScrollLogs(!autoScrollLogs)}
              className="flex items-center gap-1 hover:text-monokai-fg transition-colors cursor-pointer text-2xs"
              title={autoScrollLogs ? '关闭自动滚动' : '开启自动滚动'}
            >
              <span className={`w-2 h-2 rounded-full ${autoScrollLogs ? 'bg-monokai-accent' : 'bg-monokai-comment/40'}`} />
              <span>自动滚动</span>
            </button>
          )}

          {/* 展开/折叠按钮 */}
          <button
            type="button"
            onClick={toggleBottomDrawer}
            className="p-1 hover:text-monokai-fg cursor-pointer transition-colors rounded hover:bg-monokai-elevated flex items-center gap-1 text-2xs"
            title={isBottomDrawerOpen ? '收起控制台抽屉' : '展开控制台抽屉'}
          >
            <span>{isBottomDrawerOpen ? '收起' : '展开控制台'}</span>
            {isBottomDrawerOpen ? (
              <ChevronDown className="h-3.5 w-3.5" />
            ) : (
              <ChevronUp className="h-3.5 w-3.5" />
            )}
          </button>
        </div>
      </div>

      {/* ── 抽屉内容主体（展开状态） ── */}
      {isBottomDrawerOpen && (
        <div ref={logTableRef} className="flex-1 overflow-y-auto custom-scrollbar font-mono text-meta bg-monokai-bg">
          {bottomDrawerTab === 'logs' ? (
            runLogs.length === 0 ? (
              <div className={dfEmpty}>
                <Terminal className="w-5 h-5 text-monokai-border-strong opacity-60" />
                <span className={dfEmptyTitle}>暂无执行日志</span>
                <span className={dfEmptyHint}>点击「运行全流程」或「运行节点」后，执行追踪将实时呈现在此</span>
              </div>
            ) : (
              <table className={dfTable}>
                <thead>
                  <tr className={dfTableHead}>
                    <th className="py-1 px-3 font-normal">时间</th>
                    <th className="py-1 px-3 font-normal">节点</th>
                    <th className="py-1 px-3 font-normal">类型</th>
                    <th className="py-1 px-3 font-normal">状态</th>
                    <th className="py-1 px-3 font-normal text-right">输出行数</th>
                    <th className="py-1 px-3 font-normal text-right">耗时</th>
                    <th className="py-1 px-3 font-normal">消息摘要</th>
                  </tr>
                </thead>
                <tbody>
                  {runLogs.map((log, idx) => (
                    <tr
                      key={log.id ? `${log.id}_${idx}` : `log_${idx}`}
                      onClick={() => selectNode(log.nodeId)}
                      className={`${dfTableRow} cursor-pointer ${
                        log.nodeId === selectedNodeId ? 'bg-monokai-accent/5' : ''
                      }`}
                    >
                      <td className="py-1 px-3 text-monokai-comment whitespace-nowrap">{log.timestamp}</td>
                      <td className="py-1 px-3 text-monokai-fg font-medium">{log.nodeName}</td>
                      <td className="py-1 px-3 text-monokai-comment">{log.nodeType}</td>
                      <td className="py-1 px-3 whitespace-nowrap">
                        {log.status === 'success' ? (
                          <span className="flex items-center gap-1 text-monokai-accent">
                            <CheckCircle2 className="h-3 w-3" />
                            <span>成功</span>
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-monokai-pink">
                            <AlertCircle className="h-3 w-3" />
                            <span>失败</span>
                          </span>
                        )}
                      </td>
                      <td className="py-1 px-3 text-right text-monokai-fg">
                        {log.rows !== undefined ? log.rows.toLocaleString() : '-'}
                      </td>
                      <td className="py-1 px-3 text-right text-monokai-comment whitespace-nowrap">{log.duration}</td>
                      <td className="py-1 px-3 text-monokai-fg-muted truncate max-w-sm">{log.message}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )
          ) : bottomDrawerTab === 'node_history' ? (
            !selectedNode ? (
              <div className={dfEmpty}>
                <GitBranch className="w-5 h-5 text-monokai-border-strong opacity-60" />
                <span className={dfEmptyTitle}>请在画布中选中一个节点</span>
                <span className={dfEmptyHint}>选中节点后，此处将显示该节点的执行历史</span>
              </div>
            ) : nodeHistory.length === 0 ? (
              <div className={dfEmpty}>
                <Clock className="w-5 h-5 text-monokai-border-strong opacity-60" />
                <span className={dfEmptyTitle}>{selectedNode.data.title}</span>
                <span className={dfEmptyHint}>该节点暂无执行历史，点击节点右侧「▶」试跑以生成</span>
              </div>
            ) : (
              <div className="p-3 space-y-2">
                <div className="flex items-center gap-1.5 text-2xs text-monokai-comment font-sans pb-1 border-b border-monokai-border/40">
                  <Activity className="w-3 h-3 text-monokai-cyan" />
                  <span className="font-semibold text-monokai-fg">{selectedNode.data.title}</span>
                  <span>的执行历史 ({nodeHistory.length} 条)</span>
                </div>
                {nodeHistory.map((log, idx) => (
                  <div
                    key={log.id || idx}
                    className="rounded border border-monokai-border/60 bg-monokai-bg/60 p-2 text-xs font-mono"
                  >
                    <div className="flex items-center justify-between text-2xs text-monokai-comment">
                      <span>{log.timestamp}</span>
                      <span className={log.status === 'success' ? 'text-monokai-accent' : 'text-monokai-pink'}>
                        {log.status === 'success' ? '✔ 成功' : '✖ 失败'}
                      </span>
                    </div>
                    <div className="mt-1 flex items-center justify-between text-monokai-fg">
                      <span>耗时: {log.duration}</span>
                      <span>输出: {(log.rows ?? 0).toLocaleString()} 行</span>
                    </div>
                    {log.message && (
                      <div className="mt-1 text-2xs text-monokai-comment truncate">{log.message}</div>
                    )}
                  </div>
                ))}
              </div>
            )
          ) : (
            /* 数据预览 Tab */
            <div className="p-3">
              {selectedNode?.data.executionResult?.rows && selectedNode.data.executionResult.rows.length > 0 ? (
                <div className="overflow-x-auto">
                  <div className="text-2xs text-monokai-comment font-sans mb-1.5 flex items-center gap-1.5">
                    <Table className="w-3 h-3 text-monokai-accent" />
                    <span className="font-semibold text-monokai-fg">{selectedNode.data.title}</span>
                    <span>— 采样 {selectedNode.data.executionResult.rows.length} 行 · {selectedNode.data.executionResult.columns.length} 列</span>
                  </div>
                  <table className="w-full text-left border-collapse text-meta">
                    <thead>
                      <tr className="border-b border-monokai-border bg-monokai-elevated text-monokai-fg-muted">
                        {selectedNode.data.executionResult.columns.map(c => (
                          <th key={c.name} className="py-1 px-2.5 font-medium whitespace-nowrap">
                            <div>{c.name}</div>
                            <div className="text-3xs text-monokai-comment font-normal">{c.type}</div>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {selectedNode.data.executionResult.rows.slice(0, 50).map((r, i) => (
                        <tr key={i} className="border-b border-monokai-border/30 hover:bg-white/[0.02]">
                          {selectedNode.data.executionResult!.columns.map(c => (
                            <td key={c.name} className="py-1 px-2.5 text-monokai-fg truncate max-w-[160px]">
                              {String(r[c.name] ?? '')}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className={dfEmpty}>
                  <Table className="w-5 h-5 text-monokai-border-strong opacity-60" />
                  <span className={dfEmptyTitle}>
                    {selectedNode ? `「${selectedNode.data.title}」暂无采样数据` : '请先选中一个节点'}
                  </span>
                  <span className={dfEmptyHint}>
                    {selectedNode ? '点击右侧「运行节点」触发真实查询生成采样' : '在画布中点击任意节点查看其实时数据采样'}
                  </span>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
