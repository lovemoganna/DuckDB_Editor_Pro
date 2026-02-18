import { aiService } from './aiService';
import { duckDBService } from './duckdbService';
import { MetricDefinition, MetricPackage, MetricChart, ChartConfig } from '../types';

/**
 * 指标告警配置类型
 */
export interface MetricAlert {
  id: string;
  metricId: string;
  metricName: string;
  condition: 'above' | 'below' | 'change';
  threshold: number;
  webhookUrl?: string;
  enabled: boolean;
  createdAt: number;
}

/**
 * 指标订阅配置类型
 */
export interface MetricSubscription {
  id: string;
  metricId: string;
  metricName: string;
  notifyOn: ('change' | 'update' | 'anomaly')[];
  email?: string;
  enabled: boolean;
  createdAt: number;
}

/**
 * 指标分析服务
 * 负责收集表结构、调用AI分析、解析结果、保存到localStorage
 */
class MetricAnalyzerService {
  private readonly STORAGE_KEY = 'duckdb_metric_packages';
  private readonly CHART_STORAGE_KEY = 'duckdb_metric_charts';

  /**
   * 计算指标健康度评分
   * 评分维度：完整性(20%)、验证状态(30%)、图表配置(20%)、更新频率(15%)、版本历史(15%)
   */
  calculateHealthScore(metric: MetricDefinition, hasChart: boolean): {
    score: number;
    level: 'excellent' | 'good' | 'fair' | 'poor';
    details: { name: string; score: number; maxScore: number }[];
  } {
    const details: { name: string; score: number; maxScore: number }[] = [];
    
    // 1. 完整性评分 (20分)
    const completenessFields = ['name', 'definition', 'formula', 'scenario', 'value', 'unit', 'category'];
    const completedFields = completenessFields.filter(f => (metric as any)[f]).length;
    const completenessScore = Math.round((completedFields / completenessFields.length) * 20);
    details.push({ name: '完整性', score: completenessScore, maxScore: 20 });
    
    // 2. 验证状态评分 (30分)
    let validationScore = 0;
    if (metric.isValid === true) validationScore = 30;
    else if (metric.isValid === false) validationScore = 10;
    else if (metric.lastValidated) validationScore = 15;
    details.push({ name: '验证状态', score: validationScore, maxScore: 30 });
    
    // 3. 图表配置评分 (20分)
    const chartScore = hasChart ? 20 : 0;
    details.push({ name: '图表配置', score: chartScore, maxScore: 20 });
    
    // 4. 更新频率评分 (15分)
    let updateScore = 0;
    if (metric.updatedAt) {
      const daysSinceUpdate = (Date.now() - metric.updatedAt) / (1000 * 60 * 60 * 24);
      if (daysSinceUpdate < 7) updateScore = 15;
      else if (daysSinceUpdate < 30) updateScore = 10;
      else if (daysSinceUpdate < 90) updateScore = 5;
    } else if (metric.createdAt) {
      const daysSinceCreate = (Date.now() - metric.createdAt) / (1000 * 60 * 60 * 24);
      if (daysSinceCreate < 7) updateScore = 10;
      else if (daysSinceCreate < 30) updateScore = 5;
    }
    details.push({ name: '更新频率', score: updateScore, maxScore: 15 });
    
    // 5. 版本历史评分 (15分)
    let versionScore = 0;
    if (metric.history && metric.history.length > 0) {
      versionScore = Math.min(15, metric.history.length * 3);
    }
    details.push({ name: '版本管理', score: versionScore, maxScore: 15 });
    
    const totalScore = completenessScore + validationScore + chartScore + updateScore + versionScore;
    
    let level: 'excellent' | 'good' | 'fair' | 'poor';
    if (totalScore >= 90) level = 'excellent';
    else if (totalScore >= 70) level = 'good';
    else if (totalScore >= 50) level = 'fair';
    else level = 'poor';
    
    return { score: totalScore, level, details };
  }

  /**
   * 收集表的结构信息和样本数据
   */
  async collectTableSchema(tables: string[]): Promise<{
    tableName: string;
    columns: { name: string; type: string }[];
    sampleData: any[];
    rowCount: number;
  }[]> {
    const results = [];

    for (const table of tables) {
      try {
        // 获取表结构
        const schema = await duckDBService.getTableSchema(table);
        
        // 获取样本数据（前5行）
        const sampleQuery = `SELECT * FROM "${table}" LIMIT 5`;
        const sampleData = await duckDBService.query(sampleQuery);
        
        // 获取行数
        const countQuery = `SELECT COUNT(*) as cnt FROM "${table}"`;
        const countResult = await duckDBService.query(countQuery);
        const rowCount = countResult[0]?.cnt || 0;

        results.push({
          tableName: table,
          columns: schema.map((col: any) => ({
            name: col.name,
            type: col.type
          })),
          sampleData: sampleData,
          rowCount: rowCount
        });
      } catch (error) {
        console.error(`Error collecting schema for table ${table}:`, error);
      }
    }

    return results;
  }

  /**
   * 构建给AI的提示词
   */
  buildPrompt(tableInfos: {
    tableName: string;
    columns: { name: string; type: string }[];
    sampleData: any[];
    rowCount: number;
  }[]): string {
    const tableDescriptions = tableInfos.map(t => {
      const columnsStr = t.columns.map(c => `  - ${c.name} (${c.type})`).join('\n');
      const sampleRows = t.sampleData.slice(0, 3).map(row => 
        Object.values(row).join(' | ')
      ).join('\n');
      
      return `
### 表名: ${t.tableName}
- 行数: ${t.rowCount}
- 列结构:
${columnsStr}
- 样本数据:
${sampleRows}
`;
    }).join('\n---\n');

    return `请分析以下数据表结构，生成业务指标定义。

${tableDescriptions}

请为每个指标生成以下JSON字段（返回JSON数组）：
[
  {
    "name": "指标名称（英文变量名，如 gmv, arpu）",
    "scenario": "指标场景（用于什么业务分析，如：评估销售业绩）",
    "characteristics": "指标特点（如：可累加、比率型、趋势型、计数型）",
    "value": "价值说明（为什么这个指标重要）",
    "definition": "指标定义（精确的业务含义，用中文描述）",
    "formula": "计算公式（如：SUM(amount) 或 COUNT(DISTINCT user_id)）",
    "example": "典型案例（如：2024年1月GMV为100万元）",
    "dependencies": ["依赖的列名数组"],
    "unit": "单位（如：元、个、%）",
    "category": "分类（如：流量类、转化类、营收类）",
    "sqlValidation": "对应的DuckDB SQL验证/计算语句（如：SELECT SUM(amount) FROM table_name）"
  }
]

要求：
1. 每个表至少生成3-5个有价值的指标
2. 指标要有业务意义，不是简单的列名
3. dependencies必须填写依赖的列名
4. sqlValidation必须是有效的DuckDB SQL语句，用于验证或计算该指标
5. 只返回JSON数组，不要其他内容`;
  }

  /**
   * 验证指标定义完整性
   */
  validateMetrics(metrics: any[]): MetricDefinition[] {
    const validMetrics: MetricDefinition[] = [];
    const now = Date.now();

    for (const m of metrics) {
      // 验证必填字段
      if (!m.name || !m.scenario || !m.characteristics || 
          !m.value || !m.definition || !m.formula || !m.example) {
        console.warn('Invalid metric, missing required fields:', m);
        continue;
      }

      validMetrics.push({
        id: `metric_${now}_${Math.random().toString(36).substr(2, 9)}`,
        name: m.name,
        scenario: m.scenario,
        characteristics: m.characteristics,
        value: m.value,
        definition: m.definition,
        formula: m.formula,
        example: m.example,
        dependencies: m.dependencies || [],
        unit: m.unit,
        category: m.category,
        sqlValidation: m.sqlValidation || '',
        isValid: undefined,
        createdAt: now
      });
    }

    return validMetrics;
  }

  /**
   * 调用AI分析并生成指标定义
   */
  async analyzeMetrics(
    tables: string[],
    onChunk?: (chunk: string) => void
  ): Promise<MetricDefinition[]> {
    // 1. 收集表结构
    const tableInfos = await this.collectTableSchema(tables);
    
    if (tableInfos.length === 0) {
      throw new Error('没有找到有效的表数据');
    }

    // 2. 构建提示词
    const prompt = this.buildPrompt(tableInfos);

    // 3. 调用AI
    const systemInstruction = `你是一个资深数据分析师，擅长从数据表结构中提炼出有价值的业务指标。你的输出必须是有效的JSON数组。`;

    try {
      const result = await aiService.robustCall(
        'metric' as any,
        prompt,
        systemInstruction,
        true,
        3,
        onChunk
      );

      // 4. 解析结果
      let metricsData = result;
      
      // 如果返回的是对象且包含metrics字段，取metrics数组
      if (metricsData && typeof metricsData === 'object' && 'metrics' in metricsData) {
        metricsData = (metricsData as any).metrics;
      }

      // 确保是数组
      if (!Array.isArray(metricsData)) {
        metricsData = [metricsData];
      }

      // 5. 验证并转换
      return this.validateMetrics(metricsData as any[]);
    } catch (error) {
      console.error('AI analysis failed:', error);
      throw error;
    }
  }

  /**
   * 保存指标包到localStorage
   */
  saveMetricPackage(pkg: MetricPackage): void {
    const packages = this.loadMetricPackages();
    const existingIndex = packages.findIndex(p => p.id === pkg.id);
    
    if (existingIndex >= 0) {
      packages[existingIndex] = pkg;
    } else {
      packages.push(pkg);
    }

    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(packages));
  }

  /**
   * 保存所有指标包
   */
  saveAllPackages(packages: MetricPackage[]): void {
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(packages));
  }

  /**
   * 从localStorage加载所有指标包
   */
  loadMetricPackages(): MetricPackage[] {
    try {
      const data = localStorage.getItem(this.STORAGE_KEY);
      if (data) {
        return JSON.parse(data);
      }
    } catch (error) {
      console.error('Error loading metric packages:', error);
    }
    return [];
  }

  /**
   * 删除指标包
   */
  deleteMetricPackage(id: string): void {
    const packages = this.loadMetricPackages().filter(p => p.id !== id);
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(packages));
  }

  /**
   * 获取单个指标包
   */
  getMetricPackage(id: string): MetricPackage | undefined {
    return this.loadMetricPackages().find(p => p.id === id);
  }

  /**
   * 创建新的指标包
   */
  createMetricPackage(
    name: string,
    description: string,
    sourceTables: string[],
    metrics: MetricDefinition[]
  ): MetricPackage {
    const now = Date.now();
    return {
      id: `pkg_${now}_${Math.random().toString(36).substr(2, 9)}`,
      name,
      description,
      sourceTables,
      metrics,
      createdAt: now,
      updatedAt: now
    };
  }

  /**
   * 更新指标包
   */
  updateMetricPackage(
    id: string,
    updates: Partial<Omit<MetricPackage, 'id' | 'createdAt'>>
  ): MetricPackage | null {
    const packages = this.loadMetricPackages();
    const index = packages.findIndex(p => p.id === id);
    
    if (index < 0) return null;

    // 如果更新了 metrics，记录版本历史
    if (updates.metrics) {
      updates.metrics = updates.metrics.map(metric => {
        const existingMetric = packages[index].metrics.find(m => m.id === metric.id);
        if (existingMetric) {
          // 检测变更的字段
          const changedFields: string[] = [];
          const previousValues: Record<string, any> = {};
          
          const fieldsToCheck = ['name', 'definition', 'formula', 'scenario', 'characteristics', 'value', 'unit', 'category'];
          fieldsToCheck.forEach(field => {
            if (existingMetric[field as keyof MetricDefinition] !== metric[field as keyof MetricDefinition]) {
              changedFields.push(field);
              previousValues[field] = existingMetric[field as keyof MetricDefinition];
            }
          });
          
          if (changedFields.length > 0) {
            // 添加版本历史
            const newVersion = (existingMetric.version || 1) + 1;
            return {
              ...metric,
              version: newVersion,
              updatedAt: Date.now(),
              history: [
                ...(existingMetric.history || []),
                {
                  version: newVersion,
                  changedAt: Date.now(),
                  changedFields,
                  previousValues
                }
              ].slice(-10) // 只保留最近10条历史
            };
          }
        }
        return {
          ...metric,
          updatedAt: Date.now(),
          version: metric.version || 1,
          history: metric.history || []
        };
      });
    }

    packages[index] = {
      ...packages[index],
      ...updates,
      updatedAt: Date.now()
    };

    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(packages));
    return packages[index];
  }

  /**
   * 生成SQL验证语句
   * 根据指标的dependencies和sourceTable生成验证SQL
   */
  async generateValidationSql(
    metric: MetricDefinition,
    sourceTable: string
  ): Promise<string> {
    try {
      // 获取表结构
      const schema = await duckDBService.getTableSchema(sourceTable);
      const columnNames = schema.map((col: any) => col.name.toLowerCase());
      
      // 从dependencies中查找存在的列
      const validDeps = (metric.dependencies || []).filter(dep => 
        columnNames.includes(dep.toLowerCase())
      );

      if (validDeps.length === 0) {
        // 如果没有匹配的依赖，尝试查找相似的列名
        const allCols = schema.map((col: any) => col.name);
        return `-- 无法找到匹配的列，请检查指标定义
-- 可用列: ${allCols.join(', ')}
SELECT '需要手动设置' as status;`;
      }

      // 生成SQL - 基于formula生成计算SQL
      let sql = metric.formula || '';
      
      // 如果formula包含聚合函数，直接使用
      if (sql.toUpperCase().includes('SUM') || 
          sql.toUpperCase().includes('COUNT') || 
          sql.toUpperCase().includes('AVG') ||
          sql.toUpperCase().includes('MAX') ||
          sql.toUpperCase().includes('MIN')) {
        // 替换表名
        sql = sql.replace(/FROM\s+(\w+)/gi, `FROM "${sourceTable}"`);
        
        // 如果没有FROM子句，添加
        if (!sql.toUpperCase().includes('FROM')) {
          const firstCol = validDeps[0];
          sql = `SELECT ${sql} FROM "${sourceTable}"`;
        }
      } else {
        // 简单的列计算
        sql = `SELECT ${sql} as ${metric.name} FROM "${sourceTable}" LIMIT 1`;
      }

      return sql;
    } catch (error) {
      console.error('Error generating validation SQL:', error);
      return `-- 生成SQL失败: ${(error as Error).message}`;
    }
  }

  /**
   * 验证单个指标
   * 执行SQL验证语句，检查是否成功
   */
  async validateMetric(
    metric: MetricDefinition,
    sourceTable: string
  ): Promise<{ isValid: boolean; error?: string; result?: any }> {
    const sql = metric.sqlValidation || await this.generateValidationSql(metric, sourceTable);
    
    if (!sql || sql.includes('需要手动设置')) {
      return { 
        isValid: false, 
        error: 'SQL语句无效或无法生成' 
      };
    }

    try {
      // 尝试执行SQL
      const result = await duckDBService.query(sql);
      
      return {
        isValid: true,
        result: result
      };
    } catch (error) {
      const errorMsg = (error as Error).message;
      return {
        isValid: false,
        error: errorMsg
      };
    }
  }

  /**
   * 修复指标
   * 自动修正字段名以匹配实际表结构
   */
  async fixMetric(
    metric: MetricDefinition,
    sourceTable: string
  ): Promise<MetricDefinition> {
    try {
      // 获取表结构
      const schema = await duckDBService.getTableSchema(sourceTable);
      const columnMap = new Map<string, string>();
      
      // 建立列名映射（小写 -> 原始名称）
      schema.forEach((col: any) => {
        columnMap.set(col.name.toLowerCase(), col.name);
      });

      // 修复dependencies中的列名
      const fixedDependencies = (metric.dependencies || []).map(dep => {
        const lowerDep = dep.toLowerCase();
        return columnMap.get(lowerDep) || dep;
      });

      // 修复SQL中的列名
      let fixedSql = metric.sqlValidation || '';
      
      // 尝试替换SQL中的列名
      for (const [lowerCol, originalCol] of columnMap) {
        // 简单的列名替换（需要更智能的解析）
        const regex = new RegExp(`\\b${lowerCol}\\b`, 'gi');
        fixedSql = fixedSql.replace(regex, `"${originalCol}"`);
      }

      // 如果没有SQL，尝试基于formula生成
      if (!fixedSql) {
        const firstDep = fixedDependencies[0];
        if (firstDep) {
          fixedSql = `SELECT ${metric.formula || firstDep} as ${metric.name} FROM "${sourceTable}"`;
        }
      }

      return {
        ...metric,
        dependencies: fixedDependencies,
        sqlValidation: fixedSql,
        validationError: undefined
      };
    } catch (error) {
      console.error('Error fixing metric:', error);
      return {
        ...metric,
        validationError: (error as Error).message
      };
    }
  }

  // ========== 图表相关方法 ==========

  /**
   * 从指标生成图表
   * 执行SQL并根据数据特点自动生成图表配置
   */
  async generateChart(
    metric: MetricDefinition,
    metricPackageId: string,
    sourceTable: string
  ): Promise<MetricChart> {
    const now = Date.now();
    const chartId = `metric_chart_${now}_${Math.random().toString(36).substr(2, 9)}`;
    
    // 使用指标的 sqlValidation 或生成默认SQL
    let sql = metric.sqlValidation;
    if (!sql) {
      sql = await this.generateValidationSql(metric, sourceTable);
    }

    // 执行SQL获取数据
    let data: any[] = [];
    let columns: string[] = [];
    
    try {
      // 如果SQL包含多个语句，只取第一个SELECT
      const firstSelect = sql.split(';').find(s => s.trim().toUpperCase().startsWith('SELECT'));
      if (firstSelect) {
        const result = await duckDBService.query(firstSelect.trim());
        data = result;
        if (data.length > 0) {
          columns = Object.keys(data[0]);
        }
      }
    } catch (error) {
      console.error('Error executing SQL for chart:', error);
      // 即使SQL执行失败，也创建图表配置（可能数据为空）
    }

    // 分析数据特点，自动生成图表配置
    const chartConfig = this.analyzeAndGenerateChartConfig(metric, data, columns);
    
    // 标记图表来源为指标
    chartConfig.source = 'metric';
    chartConfig.metricId = metric.id;
    chartConfig.metricPackageId = metricPackageId;
    chartConfig.metricName = metric.name;

    const metricChart: MetricChart = {
      id: chartId,
      metricId: metric.id,
      metricPackageId,
      metricName: metric.name,
      sourceTable,
      chartConfig,
      sql: sql || '',
      createdAt: now,
      updatedAt: now
    };

    // 保存到存储
    this.saveMetricChart(metricChart);

    return metricChart;
  }

  /**
   * 分析数据特点并生成图表配置
   */
  private analyzeAndGenerateChartConfig(
    metric: MetricDefinition,
    data: any[],
    columns: string[]
  ): ChartConfig {
    const now = Date.now();
    const chartId = `chart_${now}`;
    
    // 基础配置
    const config: ChartConfig = {
      id: chartId,
      title: metric.name,
      type: 'bar', // 默认
      xKey: '',
      yKeys: [],
      aggregation: 'none',
      showLegend: true,
      showValues: true
    };

    if (data.length === 0) {
      // 没有数据，默认显示为计数器
      config.type = 'counter';
      config.yKeys = columns.length > 0 ? [columns[0]] : ['value'];
      return config;
    }

    // 分析列类型
    const columnTypes = this.analyzeColumnTypes(data, columns);
    
    // 根据指标特点选择图表类型
    const characteristics = metric.characteristics?.toLowerCase() || '';
    
    if (characteristics.includes('计数') || characteristics.includes('count')) {
      // 计数型指标 - 可能是单值（counter）
      if (data.length === 1 && columns.length <= 2) {
        config.type = 'counter';
        config.yKeys = columns.filter(c => c !== 'count' && c !== 'cnt');
        if (config.yKeys.length === 0) {
          config.yKeys = columns;
        }
      } else {
        config.type = 'bar';
        // 假设第一列是维度，第二列是值
        config.xKey = columns[0];
        config.yKeys = columns.slice(1).length > 0 ? [columns[1]] : [columns[0]];
        config.aggregation = 'sum';
      }
    } else if (characteristics.includes('趋势') || characteristics.includes('time') || characteristics.includes('时间')) {
      // 趋势型指标 - 使用折线图
      config.type = 'line';
      config.xKey = columns.find(c => c.toLowerCase().includes('date') || c.toLowerCase().includes('time') || c.toLowerCase().includes('month') || c.toLowerCase().includes('year')) || columns[0];
      config.yKeys = columns.filter(c => c !== config.xKey);
      if (config.yKeys.length === 0) {
        config.yKeys = [columns[columns.length - 1]];
      }
    } else if (characteristics.includes('比率') || characteristics.includes('比例') || characteristics.includes('rate') || characteristics.includes('ratio')) {
      // 比率型指标 - 使用饼图或柱状图
      if (data.length <= 6) {
        config.type = 'pie';
      } else {
        config.type = 'bar';
      }
      config.xKey = columns[0];
      config.yKeys = columns.slice(1).length > 0 ? [columns[1]] : [columns[0]];
    } else if (characteristics.includes('累加') || characteristics.includes('sum') || characteristics.includes('总量')) {
      // 累加型 - 柱状图
      config.type = 'bar';
      config.xKey = columns[0];
      config.yKeys = columns.slice(1).length > 0 ? [columns[1]] : [columns[0]];
      config.aggregation = 'sum';
    } else {
      // 默认使用柱状图
      config.type = 'bar';
      config.xKey = columns[0];
      config.yKeys = columns.slice(1).length > 0 ? [columns[1]] : [columns[columns.length - 1]];
    }

    // 设置单位
    if (metric.unit) {
      config.yAxisLabel = metric.unit;
    }

    return config;
  }

  /**
   * 分析列类型
   */
  private analyzeColumnTypes(data: any[], columns: string[]): Record<string, 'string' | 'number' | 'date'> {
    const types: Record<string, 'string' | 'number' | 'date'> = {};
    
    for (const col of columns) {
      const sample = data.slice(0, 10).map(row => row[col]).filter(v => v !== null && v !== undefined);
      
      if (sample.length === 0) {
        types[col] = 'string';
        continue;
      }

      // 检查是否是数字
      const isNumber = sample.every(v => !isNaN(Number(v)) && typeof v !== 'boolean');
      if (isNumber) {
        types[col] = 'number';
        continue;
      }

      // 检查是否是日期
      const isDate = sample.every(v => !isNaN(Date.parse(v)));
      if (isDate) {
        types[col] = 'date';
        continue;
      }

      types[col] = 'string';
    }

    return types;
  }

  /**
   * 保存指标图表到 localStorage
   */
  saveMetricChart(chart: MetricChart): void {
    const charts = this.loadMetricCharts();
    const existingIndex = charts.findIndex(c => c.id === chart.id);
    
    if (existingIndex >= 0) {
      charts[existingIndex] = chart;
    } else {
      charts.push(chart);
    }

    localStorage.setItem(this.CHART_STORAGE_KEY, JSON.stringify(charts));
  }

  /**
   * 从 localStorage 加载所有指标图表
   */
  loadMetricCharts(): MetricChart[] {
    try {
      const data = localStorage.getItem(this.CHART_STORAGE_KEY);
      if (data) {
        return JSON.parse(data);
      }
    } catch (error) {
      console.error('Error loading metric charts:', error);
    }
    return [];
  }

  /**
   * 获取指定指标包的所有图表
   */
  getChartsByPackage(metricPackageId: string): MetricChart[] {
    return this.loadMetricCharts().filter(c => c.metricPackageId === metricPackageId);
  }

  /**
   * 获取指定指标的图表
   */
  getChartByMetric(metricId: string): MetricChart | undefined {
    return this.loadMetricCharts().find(c => c.metricId === metricId);
  }

  /**
   * 删除指标图表
   */
  deleteMetricChart(chartId: string): void {
    const charts = this.loadMetricCharts().filter(c => c.id !== chartId);
    localStorage.setItem(this.CHART_STORAGE_KEY, JSON.stringify(charts));
  }

  /**
   * 更新指标图表
   */
  updateMetricChart(chartId: string, updates: Partial<MetricChart>): MetricChart | null {
    const charts = this.loadMetricCharts();
    const index = charts.findIndex(c => c.id === chartId);
    
    if (index < 0) return null;

    charts[index] = {
      ...charts[index],
      ...updates,
      updatedAt: Date.now()
    };

    localStorage.setItem(this.CHART_STORAGE_KEY, JSON.stringify(charts));
    return charts[index];
  }

  /**
   * 将指标图表转换为 SavedQuery
   * 这样可以添加到 Dashboard 中
   */
  async convertToSavedQuery(chart: MetricChart): Promise<string> {
    const { v4: uuidv4 } = await import('uuid');
    
    const savedQuery = {
      id: uuidv4(),
      name: `[指标] ${chart.metricName}`,
      sql: chart.sql,
      desc: `自动从指标 "${chart.metricName}" 生成的图表`,
      createdAt: Date.now(),
      charts: [chart.chartConfig],
      widgetType: 'chart' as const,
      // 标记这是从指标生成的
      metricChartId: chart.id
    };

    // 导入 dbService 并保存
    const { dbService } = await import('./dbService');
    await dbService.saveQuery(savedQuery);

    return savedQuery.id;
  }

  /**
   * 指标异常检测 - 基于统计方法检测异常值
   * 使用IQR (四分位距) 方法检测异常
   */
  detectAnomalies(data: number[], sensitivity: number = 1.5): { isAnomaly: boolean; value: number; zScore: number }[] {
    if (data.length < 4) return data.map(v => ({ isAnomaly: false, value: v, zScore: 0 }));

    // 计算四分位数
    const sorted = [...data].sort((a, b) => a - b);
    const q1 = sorted[Math.floor(sorted.length * 0.25)];
    const q3 = sorted[Math.floor(sorted.length * 0.75)];
    const iqr = q3 - q1;
    const median = sorted[Math.floor(sorted.length * 0.5)];

    // 计算标准差
    const mean = data.reduce((a, b) => a + b, 0) / data.length;
    const std = Math.sqrt(data.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / data.length);

    return data.map(value => {
      const zScore = std > 0 ? (value - mean) / std : 0;
      const lowerBound = q1 - sensitivity * iqr;
      const upperBound = q3 + sensitivity * iqr;
      const isAnomaly = value < lowerBound || value > upperBound;
      return { isAnomaly, value, zScore };
    });
  }

  /**
   * 指标预测 - 基于简单移动平均预测未来值
   * 使用线性回归进行趋势预测
   */
  predictFuture(values: number[], periods: number = 3): number[] {
    if (values.length < 2) return Array(periods).fill(values[0] || 0);

    // 简单线性回归
    const n = values.length;
    let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
    
    for (let i = 0; i < n; i++) {
      sumX += i;
      sumY += values[i];
      sumXY += i * values[i];
      sumX2 += i * i;
    }

    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;

    // 预测未来值
    const predictions: number[] = [];
    for (let i = 1; i <= periods; i++) {
      const predicted = intercept + slope * (n + i - 1);
      predictions.push(Math.max(0, predicted)); // 确保预测值非负
    }

    return predictions;
  }

  /**
   * 计算指标趋势 - 返回趋势方向和变化率
   */
  calculateTrend(values: number[]): { direction: 'up' | 'down' | 'stable'; changeRate: number; confidence: number } {
    if (values.length < 2) return { direction: 'stable', changeRate: 0, confidence: 0 };

    const recent = values.slice(-3);
    const older = values.slice(0, Math.min(3, values.length - 3));
    
    const recentAvg = recent.reduce((a, b) => a + b, 0) / recent.length;
    const olderAvg = older.length > 0 ? older.reduce((a, b) => a + b, 0) / older.length : recentAvg;

    const changeRate = olderAvg > 0 ? (recentAvg - olderAvg) / olderAvg : 0;
    const confidence = Math.min(1, values.length / 10); // 数据点越多，置信度越高

    let direction: 'up' | 'down' | 'stable' = 'stable';
    if (changeRate > 0.1) direction = 'up';
    else if (changeRate < -0.1) direction = 'down';

    return { direction, changeRate, confidence };
  }

  /**
   * 告警配置存储
   */
  private ALERT_STORAGE_KEY = 'duckdb_metric_alerts';

  /**
   * 加载告警配置
   */
  loadAlerts(): MetricAlert[] {
    try {
      const data = localStorage.getItem(this.ALERT_STORAGE_KEY);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  }

  /**
   * 保存告警配置
   */
  saveAlerts(alerts: MetricAlert[]): void {
    localStorage.setItem(this.ALERT_STORAGE_KEY, JSON.stringify(alerts));
  }

  /**
   * 创建告警
   */
  createAlert(alert: Omit<MetricAlert, 'id' | 'createdAt'>): MetricAlert {
    const alerts = this.loadAlerts();
    const newAlert: MetricAlert = {
      ...alert,
      id: Date.now().toString(),
      createdAt: Date.now()
    };
    alerts.push(newAlert);
    this.saveAlerts(alerts);
    return newAlert;
  }

  /**
   * 删除告警
   */
  deleteAlert(alertId: string): void {
    const alerts = this.loadAlerts();
    const filtered = alerts.filter(a => a.id !== alertId);
    this.saveAlerts(filtered);
  }

  /**
   * 触发告警 - 检查条件并发送Webhook
   */
  async triggerAlert(alertId: string, currentValue: number): Promise<boolean> {
    const alerts = this.loadAlerts();
    const alert = alerts.find(a => a.id === alertId);
    if (!alert || !alert.enabled) return false;

    let shouldTrigger = false;
    switch (alert.condition) {
      case 'above':
        shouldTrigger = currentValue > alert.threshold;
        break;
      case 'below':
        shouldTrigger = currentValue < alert.threshold;
        break;
      case 'change':
        shouldTrigger = Math.abs(currentValue - alert.threshold) > alert.threshold * 0.1;
        break;
    }

    if (shouldTrigger && alert.webhookUrl) {
      try {
        await fetch(alert.webhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            metricName: alert.metricName,
            currentValue,
            threshold: alert.threshold,
            condition: alert.condition,
            timestamp: new Date().toISOString()
          })
        });
        return true;
      } catch (error) {
        console.error('Webhook trigger failed:', error);
      }
    }
    return false;
  }

  /**
   * 订阅通知存储
   */
  private SUBSCRIPTION_STORAGE_KEY = 'duckdb_metric_subscriptions';

  /**
   * 加载订阅
   */
  loadSubscriptions(): MetricSubscription[] {
    try {
      const data = localStorage.getItem(this.SUBSCRIPTION_STORAGE_KEY);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  }

  /**
   * 创建订阅
   */
  createSubscription(subscription: Omit<MetricSubscription, 'id' | 'createdAt'>): MetricSubscription {
    const subscriptions = this.loadSubscriptions();
    const newSubscription: MetricSubscription = {
      ...subscription,
      id: Date.now().toString(),
      createdAt: Date.now()
    };
    subscriptions.push(newSubscription);
    localStorage.setItem(this.SUBSCRIPTION_STORAGE_KEY, JSON.stringify(subscriptions));
    return newSubscription;
  }

  /**
   * 删除订阅
   */
  deleteSubscription(subscriptionId: string): void {
    const subscriptions = this.loadSubscriptions();
    const filtered = subscriptions.filter(s => s.id !== subscriptionId);
    localStorage.setItem(this.SUBSCRIPTION_STORAGE_KEY, JSON.stringify(filtered));
  }

  /**
   * 通知订阅者
   */
  async notifySubscribers(metricId: string, event: 'change' | 'update' | 'anomaly', data: any): Promise<void> {
    const subscriptions = this.loadSubscriptions().filter(s => s.enabled && s.metricId === metricId);
    
    for (const sub of subscriptions) {
      if (sub.notifyOn.includes(event)) {
        // 本地通知
        if (Notification.permission === 'granted') {
          new Notification(`指标更新: ${sub.metricName}`, {
            body: `${event === 'change' ? '值发生变化' : event === 'update' ? '数据已更新' : '检测到异常'}: ${JSON.stringify(data)}`
          });
        }
      }
    }
  }
}

export const metricAnalyzer = new MetricAnalyzerService();
