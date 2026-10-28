"""Regenerate public/empty_domain.duckdb with DuckDB 1.3 storage compatibility.

Run with a Python environment containing duckdb. This file is the empty,
checkpointed starting point copied into OPFS when a user creates a domain.
"""

from pathlib import Path

import duckdb


target = Path(__file__).resolve().parent.parent / "public" / "empty_domain.duckdb"
if target.exists():
    target.unlink()

connection = duckdb.connect(
    str(target), config={"storage_compatibility_version": "v1.3.0"}
)
connection.execute("CHECKPOINT")
connection.close()
