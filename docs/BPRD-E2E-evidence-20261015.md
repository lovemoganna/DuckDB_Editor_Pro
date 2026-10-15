# BPRD Visualization E2E Evidence — 2026-10-15

## Scope

This report covers the remote `main` baseline and Draft PR #12 only. No changes have been merged to `main`.

## Evidence by boundary

| Check | Result | Evidence |
| --- | --- | --- |
| DuckDB 1.4.2 read_xlsx on masked QA workbook | PASS | Local isolated run using existing four-tab QA XLSX and the previously generated SQL; `INSTALL/LOAD excel` once each; each tab read once |
| Masked workbook materialization | PASS | Counts 10/25/25/8; 25/25 fiat-user, 25/25 crypto-user and 25/25 asset-rate matches |
| Group / status logic | PASS | Completed fiat 21, completed crypto 22; USDT/BTC/ETH counts 15/4/3 |
| Synthetic workbook SQL in DuckDB 1.4.2 GitHub CI | PASS | https://github.com/lovemoganna/DuckDB_Editor_Pro/actions/runs/38714390330 |
| Real Chromium/Vite four-sheet XLSX upload | PASS | https://github.com/lovemoganna/DuckDB_Editor_Pro/actions/runs/38716613464 |
| Real in-browser DuckDB-WASM SQL / SQL result | PASS | Same browser run, two rows and three result columns |
| Chart.js rendered Canvas | PASS | Same run, width 1350, height 222 |
| Dashboard navigation → original query & chart restored | PASS after minimal repairs | Same browser run; no extra SQL execution, no page errors |
| Chart reused as a user-defined card on homepage | NOT IMPLEMENTED / FAIL | Dashboard screenshot and `components/Dashboard.tsx`; there is no verified path from this SQL result chart to a homepage chart card |
| Dashboard table metrics immediately reflect Workbench import | FAIL / separate issue | After mounting four sheets, dashboard screenshot still showed zero rows/tables while Workbench reported four active tables; needs independent data refresh/root-cause work |
| TypeScript new diagnostics | PASS | https://github.com/lovemoganna/DuckDB_Editor_Pro/actions/runs/38716621140 — baseline differential passed |
| Entire repository suite and security audit | NOT GREEN | Existing AcademyApp case-sensitive service import and production dependency audit failures; report separately, do not waive |

## Actual regressions repaired

1. `components/Workbench/WorkbenchView.tsx`: React-local `queryResults` reset when Workbench unmounts. Recover its already-owned in-memory `QuerySnapshotManager` snapshot. Do not persist private result rows to browser storage.
2. `components/Workbench/ResultSection.tsx`: React-local chart/data view resets on unmount. Persist only the chosen view in same-tab `sessionStorage`, not query data.
3. The existing chart aggregation and saved legend defects are covered by earlier tests and repairs.

## Remaining decision

Homepage chart promotion is a separate product capability, not proven by SQL-tab recovery. Do not add a new homepage module, change libraries, or merge PR #12 before the product contract and remaining full-suite gates are resolved. The real source data is not published in Git.
