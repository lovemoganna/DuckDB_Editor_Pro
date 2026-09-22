/**
 * AI 解读相关类型定义
 *
 * 用于:
 * - aiService.profileColumn() 单列画像
 * - aiService.profileColumns() 批量列画像
 * - InspectorPanel AI 解读子卡
 * - AiAssistantPanel / WorkbenchView 跨组件状态共享
 */

/**
 * 列的语义类型识别结果
 */
export type ColumnSemanticType =
  | 'identifier'    // 主键 / 唯一标识 (id, uuid, order_id, customer_id)
  | 'measure'       // 数值度量 (revenue, quantity, amount, price)
  | 'dimension'     // 分类维度 (region, category, status, type)
  | 'time'          // 时间维度 (date, timestamp, created_at)
  | 'flag'          // 布尔标记 (is_active, is_deleted, has_xxx)
  | 'free_text'     // 自由文本 (description, comment, notes, name)
  | 'unknown';      // 无法识别

/**
 * AI 解读结果 - 数据质量风险
 */
export interface ColumnQualityRisk {
  severity: 'LOW' | 'MEDIUM' | 'HIGH';
  title: string;
  detail: string;
}

/**
 * AI 解读结果 - 单列画像
 */
export interface ColumnAiProfile {
  columnName: string;
  semanticType: ColumnSemanticType;
  businessMeaning: string;          // 1~2 句中文业务含义
  usageHints: string[];              // 典型 SQL 用法建议 (WHERE / GROUP BY / JOIN ON ...)
  qualityRisks: ColumnQualityRisk[]; // 数据质量风险
  suggestedActions: string[];        // 建议下一步操作 (建立索引 / 校验口径 / ...)
}

/**
 * AI 解读结果 - 批量列画像
 */
export interface ColumnsAiProfileResult {
  profiles: ColumnAiProfile[];
  overallSummary: string;            // 整体数据画像总结 (1~2 句话)
}

/**
 * 传入 aiService.profileColumns 的列元数据
 *
 * 来源: services/workbench/columnProfiler.ts 的 ColumnProfileSnapshot
 */
export interface ColumnProfileInput {
  columnName: string;
  data: {
    columnType: string;              // DuckDB 类型 VARCHAR / BIGINT / ...
    isNumeric: boolean;
    isDate: boolean;
    totalRows: number;
    nullCount: number;
    nullPct: string;                 // "12.34%"
    distinctCount: number;
    distinctPct: string;
    min?: string;                    // 数值或字符串
    max?: string;
    avg?: string;
    median?: string;
    sum?: string;
    topValues: Array<{
      value: string;
      count: number;
      pct: string;
    }>;
    sampleValues: any[];             // 前 5 个非空样本值
  };
}
