import { describe, it, expect, vi, beforeEach } from 'vitest';
import { 
  synthesizeOntologyFromExecution,
  synthesizeBaselineOntology,
  getUnifiedDomainOntologyRepository,
  BatchExecutionReport,
  executeAllSqlBlocks
} from './ontologySynthesisEngine';

describe('Unified Domain Ontology Engine - 真实领域本体与验收测试', () => {
  const repo = getUnifiedDomainOntologyRepository();

  beforeEach(() => {
    // 每次测试前清空统一本体库，确保单测隔离
    repo.clear();
  });

  // ─────────────────────────────────────────────────────────────────────────
  // 验收测试 1: 两篇教程都出现 Customer，结果只能存在同一个 Customer 本体定义
  // ─────────────────────────────────────────────────────────────────────────
  it('验收测试 1: 两篇教程都出现 Customer，结果只能存在同一个 Customer 本体定义并自动合并属性', () => {
    // 教程 A: Parquet 订单实战，引用了 customer_id 与 pay_amount
    const reportA: BatchExecutionReport = {
      total: 1,
      successCount: 1,
      failedCount: 0,
      totalDurationMs: 12,
      results: [
        {
          index: 1,
          sql: "SELECT order_id, customer_id, pay_amount FROM 'orders.parquet';",
          durationMs: 12,
          success: true,
          rowCount: 100,
          columns: ['order_id', 'customer_id', 'pay_amount'],
        },
      ],
      synthesizedAt: new Date().toISOString(),
    };

    const graphA = synthesizeOntologyFromExecution(
      { id: 'tut-A', title: 'Tutorial A - Parquet 订单与客户分析' },
      reportA
    );

    // 此时全局应当有 Customer 实体
    const customerInA = repo.getEntity('ent-customer');
    expect(customerInA).toBeDefined();
    expect(customerInA?.name).toContain('Customer');
    expect(customerInA?.properties).toHaveProperty('customer_id');

    // 教程 B: 账单交易分析，引用了 uid、billing_amount、credit_level
    const reportB: BatchExecutionReport = {
      total: 1,
      successCount: 1,
      failedCount: 0,
      totalDurationMs: 14,
      results: [
        {
          index: 1,
          sql: 'SELECT uid, billing_amount, credit_level FROM fact_billing;',
          durationMs: 14,
          success: true,
          rowCount: 80,
          columns: ['uid', 'billing_amount', 'credit_level'],
        },
      ],
      synthesizedAt: new Date().toISOString(),
    };

    const graphB = synthesizeOntologyFromExecution(
      { id: 'tut-B', title: 'Tutorial B - 账户与账单流水分析' },
      reportB
    );

    // 核心断言 1: 全局本体库中 Customer 实体数量【只能为 1】
    const allCustomers = repo.getAllEntities().filter(e => e.canonicalId === 'ent-customer');
    expect(allCustomers.length).toBe(1);

    // 核心断言 2: Customer 实体属性自动合并了来自两篇教程的字段
    const mergedCustomer = repo.getEntity('ent-customer')!;
    expect(mergedCustomer.properties).toHaveProperty('customer_id');
    expect(mergedCustomer.properties).toHaveProperty('uid');
    expect(mergedCustomer.properties).toHaveProperty('billing_amount');
    expect(mergedCustomer.properties).toHaveProperty('credit_level');

    // 核心断言 3: 溯源信息记录了两个教程的来源
    expect(mergedCustomer.provenance.length).toBe(2);
    expect(mergedCustomer.provenance.some(p => p.tutorialId === 'tut-A')).toBe(true);
    expect(mergedCustomer.provenance.some(p => p.tutorialId === 'tut-B')).toBe(true);
  });

  // ─────────────────────────────────────────────────────────────────────────
  // 验收测试 2: 教程只查询 SELECT uid, amount FROM transactions;
  // 不得机械生成 SELECT -> uid -> amount -> FROM -> transactions
  // ─────────────────────────────────────────────────────────────────────────
  it('验收测试 2: 教程查询 SELECT uid, amount FROM transactions; 不得机械生成语法链路，属性必须作为内部属性', () => {
    const report: BatchExecutionReport = {
      total: 1,
      successCount: 1,
      failedCount: 0,
      totalDurationMs: 10,
      results: [
        {
          index: 1,
          sql: 'SELECT uid, amount FROM transactions;',
          durationMs: 10,
          success: true,
          rowCount: 50,
          columns: ['uid', 'amount'],
        },
      ],
      synthesizedAt: new Date().toISOString(),
    };

    const dynamic = synthesizeOntologyFromExecution(
      { id: 'tut-tx', title: '交易记录基础查询' },
      report
    );

    const generatedNodeNames = dynamic.generatedNodes.map(n => n.name.toLowerCase());

    // 核心断言 1: 绝对不存在 SQL 语法关键字作为图谱节点
    expect(generatedNodeNames.includes('select')).toBe(false);
    expect(generatedNodeNames.includes('from')).toBe(false);
    expect(generatedNodeNames.includes('where')).toBe(false);
    expect(generatedNodeNames.includes('group by')).toBe(false);

    // 核心断言 2: uid 与 amount 绝对不得作为独立图谱实体节点
    expect(generatedNodeNames.includes('uid')).toBe(false);
    expect(generatedNodeNames.includes('amount')).toBe(false);

    // 核心断言 3: 应识别真实业务实体 Transaction 与 Customer
    const txNode = dynamic.generatedNodes.find(n => n.id === 'ent-transaction');
    expect(txNode).toBeDefined();

    // 核心断言 4: uid 与 amount 完整保存在实体属性中，挂在详情面板供查看
    const txEntity = repo.getEntity('ent-transaction');
    expect(txEntity?.properties).toHaveProperty('amount');
    expect(txEntity?.properties).toHaveProperty('uid');

    // 核心断言 5: 真实业务关系 Customer -(performs)-> Transaction
    const performsRel = dynamic.generatedLinks.find(l => l.predicate === 'performs');
    expect(performsRel).toBeDefined();
    expect(performsRel?.sourceId).toBe('ent-customer');
    expect(performsRel?.targetId).toBe('ent-transaction');
  });

  // ─────────────────────────────────────────────────────────────────────────
  // 验收测试 3: 执行结果证明 Customer -> CryptoTransaction -> Network 才允许增加对应对象和关系
  // ─────────────────────────────────────────────────────────────────────────
  it('验收测试 3: 只有执行证据证明关联时，才允许建立 Customer -> CryptoTransaction -> Network', () => {
    const report: BatchExecutionReport = {
      total: 1,
      successCount: 1,
      failedCount: 0,
      totalDurationMs: 18,
      results: [
        {
          index: 1,
          sql: `SELECT c.uid, tx.tx_hash, tx.gas, net.network_id, net.chain_id 
                FROM customers c 
                JOIN crypto_transactions tx ON c.uid = tx.uid 
                JOIN networks net ON tx.network_id = net.network_id;`,
          durationMs: 18,
          success: true,
          rowCount: 25,
          columns: ['uid', 'tx_hash', 'gas', 'network_id', 'chain_id'],
        },
      ],
      synthesizedAt: new Date().toISOString(),
    };

    const dynamic = synthesizeOntologyFromExecution(
      { id: 'tut-web3', title: '链上多表联合分析' },
      report
    );

    // 验证识别的三个业务实体
    expect(dynamic.generatedNodes.some(n => n.id === 'ent-customer')).toBe(true);
    expect(dynamic.generatedNodes.some(n => n.id === 'ent-crypto-transaction')).toBe(true);
    expect(dynamic.generatedNodes.some(n => n.id === 'ent-network')).toBe(true);

    // 验证建立的真实业务语义连线
    const performsRel = dynamic.generatedLinks.find(
      l => l.sourceId === 'ent-customer' && l.targetId === 'ent-crypto-transaction' && l.predicate === 'performs'
    );
    expect(performsRel).toBeDefined();

    const occursOnRel = dynamic.generatedLinks.find(
      l => l.sourceId === 'ent-crypto-transaction' && l.targetId === 'ent-network' && l.predicate === 'occurs_on'
    );
    expect(occursOnRel).toBeDefined();
  });

  // ─────────────────────────────────────────────────────────────────────────
  // 验收测试 4: 切换教程后：全局本体结构累积保持，但画布渲染严格切换为当前教程子图，杜绝旧数据残留
  // ─────────────────────────────────────────────────────────────────────────
  it('验收测试 4: 切换教程后，全局本体沉淀累积，画布渲染仅展示当前教程子图（旧教程实体绝无残留）', () => {
    // 步骤 1: 学习教程 1（包含 Store 与 City）
    const report1: BatchExecutionReport = {
      total: 1,
      successCount: 1,
      failedCount: 0,
      totalDurationMs: 15,
      results: [
        {
          index: 1,
          sql: 'SELECT s.store_id, c.city_name FROM stores s JOIN cities c ON s.city_name = c.city_name;',
          durationMs: 15,
          success: true,
          rowCount: 10,
          columns: ['store_id', 'city_name'],
        },
      ],
      synthesizedAt: new Date().toISOString(),
    };

    const graph1 = synthesizeOntologyFromExecution(
      { id: 'tut-retail', title: 'Tutorial 1 - 零售门店与地理空间' },
      report1
    );

    expect(repo.getEntity('ent-store')).toBeDefined();
    expect(repo.getEntity('ent-city')).toBeDefined();
    // 教程 1 画布包含 Store 与 City 领域对象类型（无任何固定死数据父节点）
    const storeType1 = graph1.storeState?.objectTypes.find(o => o.name.includes('Store'));
    const cityType1 = graph1.storeState?.objectTypes.find(o => o.name.includes('City'));
    expect(storeType1).toBeDefined();
    expect(cityType1).toBeDefined();
    expect(graph1.storeState?.objectTypes.length).toBe(2);
    // 约束 1: 绝对不存在固定死数据父节点“业务交易与凭据”
    expect(graph1.storeState?.objectTypes.some(o => o.name.includes('业务交易'))).toBe(false);

    // 步骤 2: 切换到教程 2（包含 Customer 与 Order）
    const report2: BatchExecutionReport = {
      total: 1,
      successCount: 1,
      failedCount: 0,
      totalDurationMs: 20,
      results: [
        {
          index: 1,
          sql: "SELECT order_id, customer_id, pay_amount FROM 'orders.parquet';",
          durationMs: 20,
          success: true,
          rowCount: 200,
          columns: ['order_id', 'customer_id', 'pay_amount'],
        },
      ],
      synthesizedAt: new Date().toISOString(),
    };

    const graph2 = synthesizeOntologyFromExecution(
      { id: 'tut-order', title: 'Tutorial 2 - 订单与客户订购' },
      report2
    );

    // 核心断言 1: 全局本体库结构累积保持！Store 与 City 依然存在于统一本体字典中供概念复用
    expect(repo.getEntity('ent-store')).toBeDefined();
    expect(repo.getEntity('ent-city')).toBeDefined();
    expect(repo.getEntity('ent-customer')).toBeDefined();
    expect(repo.getEntity('ent-order')).toBeDefined();

    // 核心断言 2: 画布数据 (storeState.objectTypes 与 links) 仅包含当前教程 2 的子图，教程 1 的 Store/City 彻底消失，无残留！
    const custType2 = graph2.storeState?.objectTypes.find(o => o.name.includes('Customer'));
    const orderType2 = graph2.storeState?.objectTypes.find(o => o.name.includes('Order'));
    expect(custType2).toBeDefined();
    expect(orderType2).toBeDefined();
    expect(graph2.storeState?.objectTypes.some(o => o.name.includes('Store'))).toBe(false);
    expect(graph2.storeState?.objectTypes.some(o => o.name.includes('City'))).toBe(false);
    expect(graph2.storeState?.objectTypes.length).toBe(2);
    expect(graph2.storeState?.links.length).toBe(1); // Customer -> places -> Order

    // 步骤 3: 动态修改代码并重新执行：在教程 2 中追加查询 user_events
    const report2Modified: BatchExecutionReport = {
      total: 2,
      successCount: 2,
      failedCount: 0,
      totalDurationMs: 32,
      results: [
        {
          index: 1,
          sql: "SELECT order_id, customer_id, pay_amount FROM 'orders.parquet';",
          durationMs: 16,
          success: true,
          rowCount: 200,
          columns: ['order_id', 'customer_id', 'pay_amount'],
        },
        {
          index: 2,
          sql: 'SELECT event_id, customer_id, event_type FROM user_events;',
          durationMs: 16,
          success: true,
          rowCount: 50,
          columns: ['event_id', 'customer_id', 'event_type'],
        },
      ],
      synthesizedAt: new Date().toISOString(),
    };

    const graph2Modified = synthesizeOntologyFromExecution(
      { id: 'tut-order', title: 'Tutorial 2 - 订单与客户订购（追加事件追踪）' },
      report2Modified
    );

    // 核心断言 3: 修改代码后，图谱真实增删节点与关系！UserEvent 节点与 Customer -> triggers -> UserEvent 关系动态加入
    const userEventType = graph2Modified.storeState?.objectTypes.find(o => o.name.includes('UserEvent'));
    expect(userEventType).toBeDefined();
    expect(graph2Modified.storeState?.objectTypes.length).toBe(3); // Customer, Order, UserEvent
    expect(graph2Modified.storeState?.links.length).toBe(2); // places, triggers
    expect(graph2Modified.storeState?.links.some(l => l.link_type_id === 7)).toBe(true); // triggers
  });

  // ─────────────────────────────────────────────────────────────────────────
  // 验收测试 5: 没有足够语义依据：宁可少生成，也不要生搬硬套
  // ─────────────────────────────────────────────────────────────────────────
  it('验收测试 5: 无真实业务语义依据（如纯算术计算或虚拟生成序列表），绝不捏造伪节点与伪连线', () => {
    const report: BatchExecutionReport = {
      total: 2,
      successCount: 2,
      failedCount: 0,
      totalDurationMs: 8,
      results: [
        {
          index: 1,
          sql: 'SELECT 1 + 1 AS calc_result, current_timestamp AS now_time;',
          durationMs: 4,
          success: true,
          rowCount: 1,
          columns: ['calc_result', 'now_time'],
        },
        {
          index: 2,
          sql: 'SELECT * FROM range(10);',
          durationMs: 4,
          success: true,
          rowCount: 10,
          columns: ['range'],
        },
      ],
      synthesizedAt: new Date().toISOString(),
    };

    const dynamic = synthesizeOntologyFromExecution(
      { id: 'tut-dummy', title: 'DuckDB 基础算术与 range 函数' },
      report
    );

    // 核心断言: range、calc_result、current_timestamp 等绝不进入本体实体库
    expect(dynamic.generatedNodes.length).toBe(0);
    expect(dynamic.generatedLinks.length).toBe(0);
    expect(repo.getAllEntities().length).toBe(0);
  });

  // ─────────────────────────────────────────────────────────────────────────
  // 验收测试 6: Prompt 8 核心验收 - 彻底删除固定父节点 + 实例级图谱与真实证据约束
  // ─────────────────────────────────────────────────────────────────────────
  it('验收测试 6: 彻底删除固定父节点，从表级图谱升级为实例级图谱，受真实执行证据约束', () => {
    // 1. 基线状态（未执行代码）：绝不凭空捏造假实例！
    const mockTutorial = {
      id: 'tut-real-order',
      title: '订单与客户实战分析',
      content: '```sql\nSELECT order_id, customer_id, pay_amount FROM "orders.parquet" LIMIT 5;\n```',
    };
    const baseline = synthesizeBaselineOntology(mockTutorial);
    // 约束 1: 顶层节点直接由真实领域概念构成，绝无固定父节点“业务交易与凭据”
    expect(baseline.storeState?.objectTypes.some(t => t.name.includes('业务交易'))).toBe(false);
    expect(baseline.storeState?.objectTypes.some(t => t.name === 'Customer')).toBe(true);
    expect(baseline.storeState?.objectTypes.some(t => t.name === 'Order')).toBe(true);
    // 约束 3: 没有执行结果证据时，绝不强行捏造伪实例！
    expect(baseline.storeState?.objects.length).toBe(0);

    // 2. 执行代码并获取真实行记录结果：真实驱动 Object Type -> Object Instance -> Property / Link
    const reportWithRows: BatchExecutionReport = {
      total: 1,
      successCount: 1,
      failedCount: 0,
      totalDurationMs: 16,
      results: [
        {
          index: 1,
          sql: 'SELECT order_id, customer_id, pay_amount FROM "orders.parquet" LIMIT 5;',
          durationMs: 16,
          success: true,
          rowCount: 2,
          columns: ['order_id', 'customer_id', 'pay_amount'],
          rows: [
            { order_id: 101, customer_id: 'C99', pay_amount: 88.0 },
            { order_id: 102, customer_id: 'C99', pay_amount: 156.5 },
          ],
        },
      ],
      synthesizedAt: new Date().toISOString(),
    };

    const verified = synthesizeOntologyFromExecution(mockTutorial, reportWithRows);
    const storeState = verified.storeState!;

    // 约束 1 & 2: Object Type 直接作为顶层节点，无泛化父类
    expect(storeState.objectTypes.some(t => t.name.includes('业务交易'))).toBe(false);
    const custType = storeState.objectTypes.find(t => t.name === 'Customer');
    const ordType = storeState.objectTypes.find(t => t.name === 'Order');
    expect(custType).toBeDefined();
    expect(ordType).toBeDefined();

    // 约束 2: 下钻生成实际记录的 Object Instance
    const custInst = storeState.objects.find(o => o.name.includes('Customer #C99'));
    const ordInst1 = storeState.objects.find(o => o.name.includes('Order #101'));
    const ordInst2 = storeState.objects.find(o => o.name.includes('Order #102'));
    expect(custInst).toBeDefined();
    expect(ordInst1).toBeDefined();
    expect(ordInst2).toBeDefined();

    // 约束 2: 实例指向各自的 Object Type (Object Type -> Object Instance)
    expect(custInst?.object_type_id).toBe(custType?.id);
    expect(ordInst1?.object_type_id).toBe(ordType?.id);
    expect(ordInst2?.object_type_id).toBe(ordType?.id);

    // 约束 2: 字段映射为属性
    const ord1Props = JSON.parse(ordInst1!.properties);
    expect(ord1Props.order_id).toBe(101);
    expect(ord1Props.pay_amount).toBe(88.0);

    // 约束 2: 实例级别关联 (Customer #C99 -> places -> Order #101, Order #102)
    const instLinks = storeState.links.filter(l => l.link_type_id === 1);
    expect(instLinks.length).toBe(2);
    expect(instLinks.some(l => l.source_object_id === custInst?.id && l.target_object_id === ordInst1?.id)).toBe(true);

    // 约束 4: 表名与本体语义分离，绝对不把 'orders.parquet' 作为节点名
    expect(storeState.objects.some(o => o.name.includes('orders.parquet'))).toBe(false);
    expect(storeState.objectTypes.some(t => t.name.includes('orders.parquet'))).toBe(false);
  });

  // ─────────────────────────────────────────────────────────────────────────
  // 附加执行管道测试: SQL 带前置注释正常执行
  // ─────────────────────────────────────────────────────────────────────────
  it('执行管道测试: 成功执行带单行与多行注释的 SQL 代码块', async () => {
    const { duckDBService } = await import('../duckdbService');
    const executedQueries: string[] = [];
    const querySpy = vi.spyOn(duckDBService, 'query').mockImplementation(async (sql: string) => {
      executedQueries.push(sql.trim());
      if (sql.includes('orders.parquet')) {
        return [{ order_id: 1, user_id: 1001, amount: 99.5 }];
      }
      return [];
    });

    const sqlBlocks = [
      `-- 注释测试
SELECT order_id, user_id, amount 
FROM 'orders.parquet'
WHERE status = 'PAID';`,
      `/* 多行注释说明 */
SELECT count(*) 
FROM 'orders.parquet' 
WHERE order_date >= '2026-03-01';`
    ];

    const report = await executeAllSqlBlocks(sqlBlocks);

    expect(report.total).toBe(2);
    expect(report.successCount).toBe(2);
    expect(report.failedCount).toBe(0);
    expect(report.results[0].rows).toEqual([{ order_id: 1, user_id: 1001, amount: 99.5 }]);

    querySpy.mockRestore();
  });

  // ─────────────────────────────────────────────────────────────────────────
  // 验收测试: 正确识别哲学教程中的概念/思想家/学派领域实体与关系
  // ─────────────────────────────────────────────────────────────────────────
  it('preserves quoted SQL in batch execution and reports malformed blocks without aborting the batch', async () => {
    const { duckDBService } = await import('../duckdbService');
    const querySpy = vi.spyOn(duckDBService, 'query').mockResolvedValue([]);
    try {
      const report = await executeAllSqlBlocks([
        "SELECT 'a;b--c/*d*/' AS value; SELECT $$x;y$$ AS other;",
        "SELECT 'unterminated",
        'SELECT 42 AS answer;',
      ]);
      expect(querySpy).toHaveBeenCalledTimes(3);
      expect(querySpy).toHaveBeenNthCalledWith(1, "SELECT 'a;b--c/*d*/' AS value;");
      expect(querySpy).toHaveBeenNthCalledWith(2, 'SELECT $$x;y$$ AS other;');
      expect(querySpy).toHaveBeenNthCalledWith(3, 'SELECT 42 AS answer;');
      expect(report.results.map(result => result.success)).toEqual([true, false, true]);
      expect(report.failedCount).toBe(1);
      expect(report.results[1].error).toBeTruthy();
    } finally {
      querySpy.mockRestore();
    }
  });

  it('执行管道与本体合成: 正确识别哲学教程中的概念/思想家/学派领域实体与关系', () => {
    const report: BatchExecutionReport = {
      total: 3,
      successCount: 3,
      failedCount: 0,
      totalDurationMs: 45,
      results: [
        {
          index: 1,
          sql: "SELECT name, definition FROM concepts WHERE domain = '本体论';",
          durationMs: 15,
          success: true,
          rowCount: 4,
          columns: ['name', 'definition'],
          rows: [
            { name: '理念', definition: '独立于感官世界的永恒实体' },
            { name: '实体', definition: '独立存在的存在者' },
            { name: '形式', definition: '事物的结构与本质' },
            { name: '物自身', definition: '不依赖主体的真实存在' }
          ]
        },
        {
          index: 2,
          sql: "SELECT c.name FROM concepts c JOIN thinkers t ON c.introduced_by = t.thinker_id WHERE t.name = '康德';",
          durationMs: 15,
          success: true,
          rowCount: 2,
          columns: ['name'],
          rows: [{ name: '先验' }, { name: '物自身' }]
        },
        {
          index: 3,
          sql: "SELECT s.name, COUNT(*) AS thinker_count FROM schools s JOIN thinker_schools ts ON s.school_id = ts.school_id GROUP BY s.name;",
          durationMs: 15,
          success: true,
          rowCount: 3,
          columns: ['name', 'thinker_count'],
          rows: [
            { name: '理性主义', thinker_count: 3 },
            { name: '经验主义', thinker_count: 2 },
            { name: '现象学', thinker_count: 1 }
          ]
        }
      ],
      synthesizedAt: new Date().toISOString(),
    };

    const graph = synthesizeOntologyFromExecution(
      {
        id: 'duckdb-sql-lesson-1',
        title: 'Lesson 1 · DuckDB SQL 入门',
        content: '哲学知识图谱 · 思想家（Thinker）与概念（Concept）及学派（School）'
      },
      report
    );

    expect(graph).toBeDefined();
    expect(graph.storeState.objectTypes.length).toBe(3); // Schools, Thinkers, Concepts
    expect(graph.storeState.objects.length).toBeGreaterThan(0);
    // 验证子节点包含具体实例
    expect(graph.storeState.objects.some(o => o.name === '理性主义')).toBe(true);
    expect(graph.storeState.objects.some(o => o.name === '理念')).toBe(true);
  });

  // ─────────────────────────────────────────────────────────────────────────
  // 验收测试 9: 教程包含 DDL 与 INSERT 种子数据时，完整生成一级 Object Type 与二级 Object Instance 子节点
  // ─────────────────────────────────────────────────────────────────────────
  it('验收测试 9: 教程包含 DDL 与 INSERT 种子数据时，完整生成一级 Object Type 与二级 Object Instance 子节点', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const mdPath = path.resolve(__dirname, '../../snippets/duckdb-sql-lesson-1_md.md');
    const content = fs.readFileSync(mdPath, 'utf-8');

    const asset = {
      id: 'duckdb-sql-lesson-1',
      title: 'Lesson 1 · DuckDB SQL 入门',
      content,
    };

    // 1. 基线状态（未执行代码）：直接从正文 DDL 与 INSERT 种子生成一级节点与二级子节点
    const baseline = synthesizeBaselineOntology(asset);
    expect(baseline.storeState?.objectTypes.length).toBe(3); // Schools, Thinkers, Concepts
    const typeNames = baseline.storeState?.objectTypes.map(t => t.name) || [];
    expect(typeNames).toContain('Schools');
    expect(typeNames).toContain('Thinkers');
    expect(typeNames).toContain('Concepts');

    // 必须包含下级本体子节点 (Object Instances)
    expect(baseline.storeState?.objects.length).toBeGreaterThanOrEqual(15);
    const instanceNames = baseline.storeState?.objects.map(o => o.name) || [];
    expect(instanceNames).toContain('理性主义');
    expect(instanceNames).toContain('经验主义');
    expect(instanceNames).toContain('柏拉图');
    expect(instanceNames).toContain('笛卡尔');
    expect(instanceNames).toContain('康德');
    expect(instanceNames).toContain('理念');
    expect(instanceNames).toContain('先验');

    // 必须包含跨实体的语义连线 (belongs_to: 9, introduced_by: 10)
    expect(baseline.storeState?.links.some(l => l.link_type_id === 9)).toBe(true);
    expect(baseline.storeState?.links.some(l => l.link_type_id === 10)).toBe(true);

    // 2. 验证与 D3 图谱可视化构建器转换契约：一级节点为 typeHub，二级子节点为 instance
    const { buildGraphDataFromState } = await import('../../components/Library/D3GraphView/D3GraphView.data');
    const graphData = buildGraphDataFromState(baseline.storeState, baseline.storeState!.mapping);
    expect(graphData).not.toBeNull();
    
    const typeHubNodes = graphData!.nodes.filter(n => n.group === 'typeHub');
    const instanceSubNodes = graphData!.nodes.filter(n => n.group === 'instance');
    expect(typeHubNodes.length).toBe(3);
    expect(instanceSubNodes.length).toBeGreaterThanOrEqual(15);

    // 每个 instance 节点自动建立指向所属 typeHub 的连接边
    const typeInstLinks = graphData!.links.filter(l => (l as any)._isTypeInstLink);
    expect(typeInstLinks.length).toBe(instanceSubNodes.length);
  });
});

