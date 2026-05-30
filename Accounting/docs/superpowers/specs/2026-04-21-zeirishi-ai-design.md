# ZeirishiAI — Japanese Tax Accountant Agent Plugin

**Date:** 2026-04-21
**Status:** Approved
**Approach:** Data Foundation First (Approach A)

## Overview

ZeirishiAI is a Claude Code plugin that provides AI-powered tax advisory and accounting support for small/medium enterprise accounting staff. It simulates tax accountant (税理士) expertise for consultation, transaction classification, tax optimization, risk alerts, filing support, annual planning, and payroll management through an interactive chat interface. **Note:** This is advisory software, not a licensed tax accountant. It cannot perform tax representation (税務代理) or sign official tax documents.

Built with Claude Code harness engineering: skills, agents, MCP servers, hooks, and .md configurations working together organically.

## Target Users

- SME accounting staff (中小企業の経理担当者)
- Process their own tax affairs without hiring a tax accountant
- Data sources: accounting software exports (freee, Money Forward) + various documents (receipts, invoices, CSV/PDF)
- Output: interactive reports within Claude Code chat

## 7-Layer Architecture

### Layer 1: Dialog Layer (税理士の顔)

Entry point via `/tax` skill. Natural language consultation with context-preserving conversation memory.

**Skill commands:**
- `/tax` — general tax consultation
- `/tax import [file]` — import financial data
- `/tax journal` — review/confirm journal entries
- `/tax consume` — consumption tax calculation
- `/tax income` — income tax calculation
- `/tax corporate` — corporate tax calculation
- `/tax payroll` — payroll calculation
- `/tax yearend` — year-end tax adjustment
- `/tax report` — generate interactive report
- `/tax bs` — balance sheet
- `/tax pl` — income statement
- `/tax optimize` — tax optimization proposals
- `/tax risk` — risk assessment
- `/tax plan` — annual tax planning

### Layer 2: Knowledge Layer (税理士の知識)

Reference data for tax law, rulings, and practical expertise.

| Source | Type | Coverage | License |
|--------|------|----------|---------|
| **tax-law-mcp** (78 stars) | MCP Server | e-Gov API: all tax laws, NTA circulars (17), 1,950+ KFS tax rulings | MIT |
| **labor-law-mcp** (55 stars) | MCP Server | Labor law, social insurance law, MHLW circulars, JAISH safety circulars | MIT |
| **financial-law-mcp** | MCP Server | FSA laws: Financial Instruments, Banking, Insurance | MIT |
| **e-Gov API** | REST API | All Japanese laws (free, no auth) | Public |
| **実務ナレッジ.md** | Config files | Tax optimization, audit response know-how, industry-specific rules | Curated from NTA publications, 税理士ドットコム, OBC360°, and MOF tax reform outlines |

**e-Gov API endpoints:**
- `GET /api/1/lawlists/{number}` — law list
- `GET /api/1/lawdata/{lawId}` — full law text
- `GET /api/1/articles/{lawId},{articleId}` — specific article
- `GET /api/1/revelist?date={YYYY-MM-DD}` — law updates

### Layer 3: Judgment Layer (税理士の頭脳)

Specialized agents for decision-making:

**bookkeeper agent:**
- Classify transactions into 勘定科目 (account items)
- Determine 経費 vs 非経費 with reasoning and legal basis
- Identify 課税 vs 非課税 transactions with article citations
- Map to appropriate tax categories

**tax-optimize agent:**
- 青色申告特別控除 application check (65万/55万/10万)
- 減価償却 method optimization (定額法 vs 定率法)
- 家事按分 ratio proposals
- 役員報酬 optimal amount simulation
- 法人成り benefit analysis

**risk-detector agent:**
- Filing deadline notifications
- Tax audit red flag detection:
  - Unreported income (申告漏れ所得)
  - Consumption tax improper refund claims
  - Overseas transaction issues
  - Incomplete bookkeeping/records
  - Lifestyle vs reported income discrepancies
- Invoice compliance warnings
- Social insurance underpayment alerts

**planner agent:**
- Monthly tax liability forecasts
- Equipment investment timing proposals
- Year-end preparation checklists
- Cash flow projections

### Layer 4: Calculation Layer (税理士の電卓)

Verified OSS calculation engines wrapped as MCP tools or direct library calls. Existing MCP servers (Layer 2) provide read-only legal reference. Custom MCP servers (`mcp/tax-engine/`, `mcp/tax-engine-python/`) wrap calculation libraries as callable tools for the agents.

| Library | Language | Stars | License | Coverage |
|---------|----------|-------|---------|----------|
| **shinkoku** | Python | 330 | MIT | Bookkeeping, journal entries, consumption tax (本則/簡易/2割特例), income tax, blue return |
| **tax_jp** | Ruby | 7 | MIT | Social insurance (健康保険・厚生年金), employment insurance, withholding tax, depreciation rates |
| **OpenFisca-Japan** | TS/Python | 38 | AGPL | Tax/benefit simulation, payroll, social benefits |
| **gensen** | TypeScript | 11 | MIT | Withholding tax tables |
| **account-codes-jp** | Python | — | AGPL | ~6,400 e-Tax/EDINET account codes |
| **jhia-fee-table** | Ruby | — | GPL | Health insurance premium tables (Excel→JSON) |

**Tax types covered by calculation engines:**

National Taxes (国税):
- 所得税 (Income Tax) — progressive rates 5%-45%
- 法人税 (Corporate Tax) — effective ~30%
- 消費税 (Consumption Tax) — 10% (8% reduced)
- 復興特別所得税 (Reconstruction Tax) — 2.1% surtax
- 相続税・贈与税 (Inheritance/Gift Tax)

Local Taxes (地方税):
- 住民税 (Resident Tax) — prefecture 4% + municipal 6%
- 事業税 (Enterprise Tax) — varies by industry/municipality
- 地方消費税 (Local Consumption Tax)

Social Insurance (社会保険):
- 健康保険 (Health Insurance) — 9.976%~11.256% by prefecture
- 厚生年金 (Employees' Pension) — 18.3% fixed
- 介護保険 (Nursing Care) — 1.809%~1.939% (age 40-64)
- 雇用保険 (Employment Insurance) — 0.35%~0.95% by industry
- 労災保険 (Workers' Comp) — industry-specific rates

### Layer 5: Collection Layer (税理士への資料提供)

Data import from multiple sources:

| Source | Type | SDK/Library |
|--------|------|-------------|
| **freee** | Accounting API | Go SDK (42 stars, BSD), Ruby SDK (7 stars, MIT), Python SDK (6 stars, MIT) |
| **Money Forward** | Expense/Invoice API | expense-api-doc (26 stars), mf-invoice-mcp |
| **CSV/PDF** | Generic import | Custom parser |
| **invoice-search-jp** | Invoice verification | PyPI package, MIT |
| **japan-data-mcp** | Government data | e-Stat, corporate number, invoice system |
| **edinet-mcp** | Financial data | EDINET XBRL parser, 4 stars |

### Layer 6: Memory Layer (税理士のファイル)

**SQLite schema:**
- `companies` — company settings, fiscal year, tax status
- `accounts` — 勘定科目 master (~6,400 codes from account-codes-jp)
- `transactions` — raw transaction data
- `journal_entries` — classified journal entries
- `tax_calculations` — calculation results and history
- `payroll_records` — employee payroll data
- `filings` — tax return history
- `alerts` — risk alerts and deadlines
- `master_rates` — tax rates, social insurance rates by year/prefecture

**Master data requirements:**
- Withholding tax tables (源泉徴収税額表) — annual NTA publication
- Social insurance rates — by prefecture, updated annually
- Depreciation tables (減価償却率表) — by asset category
- Basic deduction amounts (基礎控除額) — 580,000 yen (2026)
- Spouse/dependent deductions
- Income tax brackets — 7 tiers (5%-45%)

### Layer 7: Monitor Layer (税理士のカレンダー)

Hooks for automated monitoring:
- **Filing deadline hook** — alerts for 申告期限 (individual: Feb 16 - Mar 15, corporate: within 2 months of fiscal year-end)
- **Rate change hook** — monitors social insurance rate updates (annual September announcement)
- **Law change hook** — monitors MOF tax reform outlines (annual December publication)
- **Data import hook** — auto-starts import when CSV placed in `data/imports/`

## Phased Implementation Plan

### Phase 1: Data Foundation + Basic Bookkeeping
- `/tax` skill entry point
- CSV/PDF import pipeline
- Transaction → 勘定科目 auto-classification using bookkeeper agent
- Journal entry confirmation dialog
- SQLite storage with account-codes-jp master
- Hook: auto-import on file placement
- **Libraries:** shinkoku, account-codes-jp

### Phase 2: Tax Calculation Engine
- Consumption tax (消費税): 本則課税, 簡易課税, 2割特例
- Income tax (所得税): progressive brackets
- Corporate tax (法人税): effective rate calculation
- Tax optimization proposals via tax-optimize agent
- Risk detection via risk-detector agent
- **Libraries:** shinkoku, OpenFisca-Japan, tax-law-mcp

### Phase 3: Payroll Management
- Monthly payroll calculation
- Social insurance: 健康保険, 厚生年金, 介護保険, 雇用保険
- Withholding tax (源泉徴収)
- Year-end adjustment (年末調整)
- Health insurance premium table integration
- **Libraries:** tax_jp, gensen, labor-law-mcp, jhia-fee-table

### Phase 4: Financial Statements + Advisory
- Balance sheet (貸借対照表)
- Income statement (損益計算書)
- Cash flow statement (キャッシュフロー計算書)
- Annual tax planning via planner agent
- Interactive report generation
- **Libraries:** shinkoku, edinet-mcp

## Project Structure

```
Accounting/
├── CLAUDE.md                    # Project context for Claude Code
├── AGENTS.md                    # Agent definitions (bookkeeper, tax-optimize, risk-detector, planner)
├── .claude/
│   ├── settings.json            # Permissions, MCP server configs
│   ├── skills/
│   │   └── tax.md               # /tax skill definition
│   └── hooks/
│       └── tax-hooks.json       # Hook definitions
├── mcp/
│   ├── tax-engine/              # Calculation engine MCP (TypeScript)
│   │   ├── index.ts
│   │   └── package.json
│   └── tax-engine-python/       # shinkoku wrapper MCP (Python)
│       ├── server.py
│       └── requirements.txt
├── src/
│   ├── importers/               # Data import modules
│   │   ├── csv-parser.ts
│   │   ├── freee-client.ts
│   │   └── mf-client.ts
│   ├── engines/                 # Calculation logic wrappers
│   │   ├── bookkeeping.ts
│   │   ├── consumption-tax.ts
│   │   ├── income-tax.ts
│   │   ├── payroll.ts
│   │   └── financial-report.ts
│   ├── storage/
│   │   ├── schema.sql
│   │   └── db.ts               # SQLite connection
│   └── utils/
│       └── account-codes.ts     # Account code master
├── knowledge/                   # Tax accountant knowledge base
│   ├── tax-optimization.md      # 節税対策ナレッジ
│   ├── audit-response.md        # 税務調査対応ノウハウ
│   ├── filing-guide.md          # 申告手順ガイド
│   └── industry-rules/          # 業種別ルール
├── data/
│   ├── imports/                 # CSV drop folder
│   ├── db/                      # SQLite storage
│   └── master/                  # Rate tables, deduction amounts
├── tests/
└── docs/
    └── superpowers/
        └── specs/
```

## Data Flow

```
User: "この領収書、経費になりますか？"
  ↓
[/tax skill] → 解析 → bookkeeper agent
  ↓
[tax-law-mcp] → 関連法令検索 → 根拠条文取得
  ↓
[bookkeeper agent] → 判断: 経費OK/NG + 理由 + 根拠法令
  ↓
[User confirmation] → SQLite保存
  ↓
[risk-detector agent] → リスクチェック → 必要に応じて警告
```

## Key Constraints

- **No e-Tax XML output required** — interactive reports only
- **Local storage first** — SQLite, may migrate to Supabase later
- **Licensed appropriately** — MIT preferred, AGPL libraries isolated in separate MCP processes
- **Tax law compliance** — all calculations backed by specific law articles via tax-law-mcp
- **No tax representation (税務代理)** — advisory only, not a licensed tax accountant
- **Rate data maintenance** — annual updates from NTA/MHLW/MOF official sources

## Existing Competitive AI Tools

| Tool | Provider | Key Feature |
|------|----------|-------------|
| 税務ロボット | ROBON | AI decision-making robot, tax return automation |
| freee AI + Agent Hub | freee | Auto bank feed, expense automation, tax accountant hub |
| MF AIエージェント | Money Forward | Consumption tax classification check |
| TaxSys | TAX GROUP | Tax accountant data platform, AI-OCR |
| tofu | Hanada | Auto bookkeeping, 50 countries |

## Libraries Summary (17 verified OSS)

**MCP Servers (7, ready to use):**
1. tax-law-mcp (78★, MIT)
2. labor-law-mcp (55★, MIT)
3. financial-law-mcp
4. openfisca-japan-mcp (PyPI)
5. mf-invoice-mcp (1★, MIT)
6. edinet-mcp (4★)
7. japan-data-mcp (1★, MIT)

**Calculation Engines (5, wrapper needed):**
1. shinkoku (330★, Python, MIT)
2. tax_jp (Ruby, MIT)
3. account-codes-jp (Python, AGPL)
4. gensen (TypeScript, MIT)
5. OpenFisca-Japan (38★, AGPL)

**API Clients (5):**
1. freee API (Go SDK 42★, Ruby 7★, Python 6★)
2. MF expense-api (26★)
3. invoice-search-jp (PyPI)
4. e-Gov API (public)
5. edinet (PyPI, Apache-2.0)
