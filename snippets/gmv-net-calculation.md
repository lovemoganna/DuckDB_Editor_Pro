---
id: "metric-gmv-net"
type: "metric"
isFavorite: true
createdAt: "2026-02-18T10:00:00.000Z"
updatedAt: "2026-03-21T15:00:00.000Z"
tags:
  - "GMV"
  - "交易口径"
  - "核心指标"
  - "电商"
name: "GMV (净成交交易总额)"
owner: "交易分析中台 / 商业智能组"
sourceTables:
  - "fact_order_payments"
  - "dim_product_category"
dimensions:
  - "stat_date (日期)"
  - "category_id (商品品类)"
  - "channel (渠道)"
---

## 业务定义与统计场景
统计在统计周期内用户成功下单并完成支付的总金额，剔除在T+1内立即发生的拒付与全部无理由退款，是衡量核心主营交易规模的北极星指标。

> [!NOTE]
> 净成交额与粗 GMV 的核心差异在于扣除了**渠道商户贴息**与**全额退款流水**，避免营销冲单虚增交易盘。

## 计算公式与度量逻辑
`SUM(支付流水总金额) - SUM(全额退款金额) - SUM(商户补贴金)`

## SQL 查询定义
```sql
SELECT 
    date_trunc('day', pay_time) AS stat_date,
    category_id,
    ROUND(SUM(pay_amount - coalesce(refund_amount, 0) - coalesce(merchant_subsidy, 0)), 2) AS net_gmv
FROM fact_order_payments
WHERE pay_status = 'SUCCESS'
  AND pay_time >= CURRENT_DATE - INTERVAL 30 DAYS
GROUP BY 1, 2;
```
