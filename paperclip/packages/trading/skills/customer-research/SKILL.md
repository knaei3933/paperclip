---
name: customer-research
description: Research and analyze trading partners (customers and manufacturers/suppliers). Profiles include company background, industry classification, geographic coverage, and relationship history. Supports Japanese (顧客調査), Korean (고객 조사), and English.
argument-hint: "<company-name-or-id>"
---

# Customer Research / 顧客調査 / 고객 조사

## How It Works

```
Standalone:
  User provides company name → Web research + structured profile

Supercharged (with Paperclip API):
  API: GET /customers → Search existing customer records
  API: GET /manufacturers → Search existing manufacturer records
  API: GET /deals?customerId=X → Deal history
  API: GET /deals/:id/emails → Communication history
  Obsidian vault → Reference company dossier files
```

## Company Profile Template

```markdown
# Company Profile / 企業プロファイル / 기업 프로필

## Basic Info / 基本情報
- **Name / 名称**: [company name in all applicable languages]
- **Industry / 業界**: [classification]
- **Country / 国**: [country code + name]
- **Tier / 格付**: [1=Top, 2=Major, 3=Standard, 4=New/Unrated]

## Contact / 連絡先
- **Contact Person / 担当者**: [name]
- **Email**: [email]
- **Phone / 電話**: [phone]
- **Address / 住所**: [full address]
- **Website**: [url]

## Business Profile / 業務プロファイル
- **Primary Business**: [main activity]
- **Equipment Categories**: [categories of interest]
- **Typical Deal Size**: [range]
- **Geographic Coverage**: [regions served]

## Relationship / 関係
- **First Contact**: [date]
- **Total Deals**: [count]
- **Active Deals**: [count]
- **Deal Stages**: [current pipeline stages]
- **Last Communication**: [date + summary]

## Risk Assessment / リスク評価
- **Payment History**: [on-time/late/default]
- **Communication Quality**: [responsive/delayed/unreachable]
- **Market Position**: [leader/growing/declining]
```

## Industry Classification

| Code | Japanese | Korean | English |
|------|----------|--------|---------|
| MFG | 製造業 | 제조업 | Manufacturing |
| CHEM | 化学・化学 | 화학·화공 | Chemical/Petrochemical |
| PHARMA | 医薬品 | 제약 | Pharmaceuticals |
| FOOD | 食品 | 식품 | Food & Beverage |
| ELEC | 電子・電気 | 전자·전기 | Electronics/Electrical |
| AUTO | 自動車 | 자동차 | Automotive |
| CONST | 建設・建築 | 건설·건축 | Construction |
| MED | 医療・ヘルスケア | 의료·헬스케어 | Medical/Healthcare |
| ENV | 環境・水処理 | 환경·수처리 | Environmental/Water Treatment |
| ENERGY | エネルギー | 에너지 | Energy |
| TEXTILE | 繊維 | 섬유 | Textiles |
| RES | 研究・教育機関 | 연구·교육기관 | Research/Education |

## Manufacturer Tier Classification

| Tier | Criteria | Japanese | Korean |
|------|----------|----------|--------|
| 1 | Global top-tier, $1B+ revenue, multi-country presence | トップティア | 최상위 |
| 2 | Major regional, $100M+ revenue, strong market share | メジャー | 주요 |
| 3 | Standard, established manufacturer, reliable supply | スタンダード | 일반 |
| 4 | New/unrated, emerging manufacturer, limited history | 新規/未評価 | 신규/미평가 |

## Workflow

1. **Search existing records** — GET /customers?name=X or GET /manufacturers?name=X
2. **Check deal history** — GET /deals?customerId=X for existing relationships
3. **Review communications** — GET /deals/:id/emails for past correspondence
4. **Enrich from external sources** — Web search for company background (if needed)
5. **Generate profile** — Fill template with gathered information
6. **Save to database** — POST /customers or POST /manufacturers for new entries

## Anti-patterns

- **Duplicate entries**: Always search before creating — check name, name_kana, name_korean
- **Incomplete contacts**: Every record should have at least email OR phone
- **Missing industry**: Industry classification enables pipeline filtering
- **Stale data**: Customer data older than 6 months should be re-verified

## Related Skills

- `pipeline-review` — Pipeline context for customer relationships
- `deal-advancement` — Stage-specific customer engagement
- `multilingual-terminology` — Business term translations
