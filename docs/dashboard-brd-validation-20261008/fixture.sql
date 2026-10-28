-- Isolated chart-space regression fixture, never seeded into user databases.
CREATE TABLE chart_space_records AS
SELECT i AS record_id,
  '完整中文分类名称和超长英文CategoryName_' || lpad((i % 60)::VARCHAR, 2, '0') AS category,
  CASE WHEN i % 2 = 0 THEN 'USD' ELSE 'CNY' END AS currency,
  (i * 12345.67)::DECIMAL(18,2) AS amount,
  (i * 7654.32)::DECIMAL(18,2) AS secondary_amount,
  DATE '2025-01-01' + i::INTEGER AS event_date
FROM range(1,121) AS source(i);
