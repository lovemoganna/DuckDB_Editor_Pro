import React from "react";
import { X, Code } from "lucide-react";
import { useWorkflowStore } from "../../../services/dataflow/workflowStore";
import type { DataFlowNode } from "../../../services/dataflow/workflowTypes";
import { dispatchFocusSqlEditor } from "../../../services/dataflow/dataflowEvents";
import {
  dfPanelHeader,
  dfPanelTitle,
  dfDrawerSectionLabel,
} from "../dataflowUi";

const labels = {
  queued: "等待",
  running: "执行中",
  success: "成功",
  failed: "失败",
  cancelled: "已取消",
  skipped: "已跳过",
};
const dimensions = {
  rows: "Rows · 行",
  columns: "Columns · 列",
  grain: "Grain · 粒度",
  order: "Order · 排序",
  shape: "Shape · 形状",
  uniqueness: "Uniqueness · 唯一性",
};
export function LogicalFlowInspector({
  node,
  onClose,
}: {
  node: DataFlowNode;
  onClose?: () => void;
}) {
  const flow = useWorkflowStore((s) => s.logicalFlowData);
  const isExecuting = useWorkflowStore((s) => s.isExecuting);
  const semantic = flow?.nodes.find((n) => n.id === node.id);
  const operator = semantic?.operator;
  const relations = semantic?.relation
    ? [semantic.relation]
    : flow?.relations.filter((r) =>
        operator?.outputRelationIds.includes(r.id),
      ) || [];
  const object = flow?.objects.find((o) => o.id === semantic?.object?.id);
  const statement = flow?.statements.find(
    (s) => s.id === node.data.statementId,
  );
  const measured = node.data.executionResult;
  return (
    <div className="flex h-full flex-col bg-monokai-bg text-monokai-fg text-xs">
      <div className={dfPanelHeader}>
        <div className={dfPanelTitle}>属性详情</div>
        <button type="button" aria-label="关闭属性抽屉" onClick={onClose}>
          <X size={14} />
        </button>
      </div>
      <div className="flex-1 overflow-auto p-4 space-y-4">
        <div>
          <div className="font-semibold">{node.data.title}</div>
          <p className="text-monokai-comment mt-1">
            {node.data.rolledBack
              ? "已回滚"
              : node.data.executionStatus
                ? labels[node.data.executionStatus]
                : "未执行"}{" "}
            ·{" "}
            {statement?.id
              .replace("statement_", "Statement ")
              .replace("_0", "")}
          </p>
          <p className="mt-1 text-monokai-comment">
            同一 Statement 的逻辑节点共享执行状态。
          </p>
        </div>
        {object && (
          <section>
            <div className={dfDrawerSectionLabel}>对象</div>
            <div>
              {object.objectType} · {object.scope}
            </div>
            <div className="font-mono break-all">
              {object.catalog}.{object.schema}.{object.name} · v{object.version}
            </div>
            <div>{object.runtimeState || object.state}</div>
          </section>
        )}
        {relations.map((relation) => (
          <section key={relation.id}>
            <div className={dfDrawerSectionLabel}>
              Relation 状态（语义推断）
            </div>
            {relation.bindingState === "unresolved" && (
              <p className="text-monokai-orange">
                未解析依赖：运行时目录尚未确认此对象。
              </p>
            )}
            <dl className="space-y-1 mt-2">
              {Object.entries(dimensions).map(([key, label]) => {
                const state = relation.state?.[key as keyof typeof dimensions];
                return (
                  <div key={key} className="flex justify-between gap-2">
                    <dt>{label}</dt>
                    <dd className="text-monokai-comment">
                      {!state || state.after === "unknown"
                        ? "未知"
                        : state.after}{" "}
                      · {state?.change || "unknown"}
                    </dd>
                  </div>
                );
              })}
            </dl>
          </section>
        ))}
        {operator && (
          <section>
            <div className={dfDrawerSectionLabel}>{operator.subtype}</div>
            <pre className="whitespace-pre-wrap break-all text-monokai-comment text-2xs">
              {JSON.stringify(operator.details, null, 2)}
            </pre>
          </section>
        )}
        <section>
          <div className={dfDrawerSectionLabel}>真实 Statement 输出</div>
          {measured ? (
            <>
              <p>
                {measured.rowCount} 行 · {measured.columnCount} 列 ·{" "}
                {(measured.executionTimeSec * 1000).toFixed(1)} ms
              </p>
              <pre className="text-2xs whitespace-pre-wrap break-all mt-2">
                {JSON.stringify(
                  measured.rows.slice(0, 20),
                  (_key, value) =>
                    typeof value === "bigint" ? value.toString() : value,
                  2,
                )}
              </pre>
            </>
          ) : (
            <p className="text-monokai-comment">
              {node.data.acceptsStatementOutput
                ? "尚未取得输出。"
                : "此逻辑节点没有独立实测结果。"}
            </p>
          )}
        </section>
        <section>
          <div className={dfDrawerSectionLabel}>原文</div>
          <pre className="whitespace-pre-wrap break-all text-2xs">
            {node.data.clauseSnippet}
          </pre>
        </section>
        <button
          type="button"
          disabled={
            isExecuting ||
            !node.data.sourceSpan ||
            node.data.sourceSpan.start >= node.data.sourceSpan.end
          }
          className="flex items-center gap-2 text-monokai-accent disabled:opacity-40"
          onClick={() => {
            if (node.data.sqlRange)
              dispatchFocusSqlEditor({ sqlRange: node.data.sqlRange });
          }}
        >
          <Code size={14} />
          定位 SQL
        </button>
      </div>
    </div>
  );
}
