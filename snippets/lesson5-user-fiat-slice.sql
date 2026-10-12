-- DuckDB Editor Pro 本体第五课
-- 只读：main.users、main.fiat_transactions
-- 将 Alice Chen 改成其他真实用户名即可切换子图
WITH target AS (
    SELECT 'Alice Chen' AS user_name
)
SELECT
    CAST(u.uid AS VARCHAR) AS uid,        -- 用户节点 ID
    u.user_name,                         -- 用户节点名称
    CASE WHEN f.fiat_order_id IS NOT NULL
         THEN 'HAS_TRANSACTION' ELSE NULL END AS relation,  -- 关系类型
    CAST(f.fiat_order_id AS VARCHAR) AS fiat_order_id,     -- 交易节点 ID
    CAST(f.amount AS DOUBLE) AS amount,  -- 交易金额
    CAST(f.currency AS VARCHAR) AS currency,
    CAST(f.status AS VARCHAR) AS status
FROM main.users AS u
LEFT JOIN main.fiat_transactions AS f
    ON TRY_CAST(u.uid AS BIGINT) = TRY_CAST(f.uid AS BIGINT)
WHERE u.user_name = (SELECT user_name FROM target)
ORDER BY f.fiat_order_id NULLS LAST;