"""Independent DuckDB checks using a local copy of the user's workbook."""
import json, datetime, decimal
from pathlib import Path
import duckdb, openpyxl
root = Path(__file__).parent
book = openpyxl.load_workbook(root / 'funds-review-copy.xlsx', read_only=True, data_only=True)
db = duckdb.connect()
counts = {}
for sheet in book:
    source = list(sheet.values)
    headers = source[0]
    rows = [row for row in source[1:] if any(v is not None for v in row)]
    types = []
    for i, name in enumerate(headers):
        values = [row[i] for row in rows if row[i] is not None]
        kind = 'TIMESTAMP' if values and isinstance(values[0], datetime.datetime) else 'DOUBLE' if values and all(isinstance(v, (int,float)) for v in values) else 'VARCHAR'
        types.append('"' + name + '" ' + kind)
    db.execute('CREATE TABLE "' + sheet.title + '" (' + ','.join(types) + ')')
    db.executemany('INSERT INTO "' + sheet.title + '" VALUES (' + ','.join('?' for _ in headers) + ')', rows)
    counts[sheet.title] = len(rows)
join = 'SELECT f.*, u.country_code, u.account_status FROM fiat_transactions f LEFT JOIN users u ON f.uid=u.uid'
checks = {
    'counts': counts,
    'join_rows': db.execute('SELECT COUNT(*) FROM (' + join + ')').fetchone()[0],
    'amount_by_currency': db.execute('SELECT currency, SUM(amount) FROM (' + join + ') GROUP BY currency ORDER BY currency').fetchall(),
    'completed_amount_by_currency': db.execute("SELECT currency, SUM(amount) FROM (" + join + ") WHERE status='completed' GROUP BY currency ORDER BY currency").fetchall(),
    'statuses': db.execute('SELECT status, COUNT(*) FROM fiat_transactions GROUP BY status ORDER BY status').fetchall(),
    'monthly': db.execute("SELECT date_trunc('month',created_at), currency, SUM(amount) FROM (" + join + ") GROUP BY 1,2 ORDER BY 1,2").fetchall(),
    'completed_monthly': db.execute("SELECT date_trunc('month',created_at), currency, SUM(amount) FROM (" + join + ") WHERE status='completed' GROUP BY 1,2 ORDER BY 1,2").fetchall(),
    'null_completed_at': db.execute('SELECT COUNT(*) FROM fiat_transactions WHERE completed_at IS NULL').fetchone()[0],
}
assert checks['join_rows'] == counts['fiat_transactions']
assert db.execute('SELECT COUNT(*) FROM (SELECT uid FROM users GROUP BY uid HAVING COUNT(*)>1)').fetchone()[0] == 0
checks['union_rows'] = db.execute('SELECT COUNT(*) FROM (SELECT * FROM fiat_transactions UNION ALL BY NAME SELECT * FROM fiat_transactions)').fetchone()[0]
assert checks['union_rows'] == 2 * counts['fiat_transactions']
checks['five_batch_count'] = 5 * counts['fiat_transactions']
checks['january_completed'] = db.execute("SELECT currency,SUM(amount) FROM (" + join + ") WHERE status='completed' AND created_at >= TIMESTAMP '2025-01-01' AND created_at < TIMESTAMP '2025-02-01' GROUP BY 1 ORDER BY 1").fetchall()
assert len(checks['completed_monthly']) == 19
print(json.dumps(checks,ensure_ascii=False,indent=2,default=str))
(root/'real-data-oracle.json').write_text(json.dumps(checks,ensure_ascii=False,indent=2,default=str),encoding='utf-8')
