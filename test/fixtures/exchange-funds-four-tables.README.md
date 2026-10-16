# 真实四表验收样本

`exchange-funds-four-tables.xlsx` 是用户授权本地工作簿中 users、fiat_transactions、crypto_transactions、exchange_rates 四张表的实际值副本，行数 10/25/25/8；只排除空白尾行。不是 Mock 数据。

原文件 SHA256：`1630f146e0d7e92005881be3a1a4e15fd34d31ba31133de76a7258e2f86bc1fc`。

来源、口径、独立 DuckDB 计算、运行证据及限制见 `docs/real-data-acceptance-20261016.md`。本次未将该数据提交或发布到远端。再生成使用 `scripts/prepare-funds-acceptance.py --source <原文件> --output <独立输出目录>`。
