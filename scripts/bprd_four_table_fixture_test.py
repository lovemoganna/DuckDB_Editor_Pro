"""Isolated synthetic 4-table DuckDB contract (never uses production or Google Sheet rows)."""
from pathlib import Path
from tempfile import TemporaryDirectory
from openpyxl import Workbook
import duckdb

sheets = {
 "users": [["uid","country_code"],["U1","US"],["U2","GB"]],
 "fiat_transactions": [["fiat_order_id","uid","currency","amount","status"],["F1","U1","USD",10,"completed"],["F2","U2","GBP",5,"completed"],["F3","U1","USD",20,"failed"]],
 "crypto_transactions": [["crypto_order_id","uid","asset","amount","status"],["C1","U1","USDT",10,"completed"],["C2","U2","BTC",0.1,"completed"],["C3","U1","USDT",50,"processing"]],
 "exchange_rates": [["asset","quote_currency","rate_to_usdt","effective_date"],["USDT","USDT",1,"2024-09-01"],["BTC","USDT",64500,"2024-09-01"],["USD","USDT",1,"2024-09-01"],["GBP","USDT",1.285,"2024-09-01"]],
}
with TemporaryDirectory() as d:
 path=Path(d)/"four_tables.xlsx"
 wb=Workbook(); wb.remove(wb.active)
 for name, rows in sheets.items():
  ws=wb.create_sheet(name)
  for row in rows: ws.append(row)
 wb.save(path)
 con=duckdb.connect(":memory:")
 assert con.execute("SELECT version()").fetchone()[0].startswith("v1.4.2")
 con.execute("INSTALL excel")
 con.execute("LOAD excel")
 for name in sheets:
  con.execute(f"CREATE TEMP TABLE {name} AS SELECT * FROM read_xlsx(?, sheet = ?, header = true, all_varchar = true)",[str(path),name])
  assert con.execute(f"SELECT COUNT(*) FROM {name}").fetchone()[0]==len(sheets[name])-1
 joined=con.execute("SELECT f.currency, COUNT(*) orders, SUM(TRY_CAST(f.amount AS DOUBLE)) native_amount FROM fiat_transactions f JOIN users u ON f.uid=u.uid WHERE f.status='completed' GROUP BY f.currency ORDER BY f.currency").fetchall()
 assert joined==[("GBP",1,5.0),("USD",1,10.0)],joined
 crypto=con.execute("SELECT asset, COUNT(*) orders FROM crypto_transactions WHERE status='completed' GROUP BY asset ORDER BY asset").fetchall()
 assert crypto==[("BTC",1),("USDT",1)],crypto
 fx=con.execute("SELECT COUNT(*) FROM crypto_transactions c WHERE EXISTS(SELECT 1 FROM exchange_rates r WHERE r.asset=c.asset AND r.quote_currency='USDT')").fetchone()[0]
 assert fx==3,fx
 assert con.execute("SELECT COUNT(*) FROM exchange_rates WHERE effective_date='2024-09-01'").fetchone()[0]==4
 print("PASS: DuckDB", con.execute("SELECT version()").fetchone()[0], "4 sheets, read_xlsx once per sheet, 2 fiat currencies, 2 completed crypto assets, preserved rate date")
