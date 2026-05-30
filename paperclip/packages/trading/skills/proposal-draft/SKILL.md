---
name: proposal-draft
description: Generate equipment proposal documents (見積書/提案書/견적서) for trading deals. Creates structured proposals with multilingual support using Paperclip's template engine with 【placeholder】 syntax.
argument-hint: "<customer-id> <equipment-ids>"
---

# Proposal Draft / 見積書作成 / 견적서 작성

## How It Works

```
Standalone:
  User provides customer + equipment details → Structured proposal output

Supercharged (with Paperclip API):
  API: GET /customers/:id → Auto-fetch customer info
  API: GET /equipment/:id → Auto-fetch equipment details + manufacturer
  API: POST /documents → Save proposal draft
  API: GET /documents/:id/pdf → Generate PDF/HTML
```

## Proposal Types

| Type | Japanese | Korean | Use Case |
|------|----------|--------|----------|
| Equipment Proposal | 機器提案書 | 기기 제안서 | New equipment sales |
| Price Quote | 見積書 | 견적서 | Formal pricing response |
| Specification Sheet | 仕様書 | 사양서 | Technical specifications |
| Service Agreement | 保守契約書 | 유지보수 계약서 | After-sales support |

## Output Format

```markdown
# [機器提案書 / Equipment Proposal]

**Proposal No.**: [auto-generated]
**Date**: [作成日 / 작성일]
**Valid Until**: [有効期限 / 유효기간] (30 days from creation)

---

## 宛先 / To
**Company**: [顧客名 / 고객명]
**Contact**: [担当者 / 담당자]
**Address**: [住所 / 주소]
**Industry**: [業界 / 업종]

---

## 提案内容 / Proposal Contents

| # | 機器名 / Equipment | メーカー / Manufacturer | 国 / Country | 仕様 / Specs | 価格帯 / Price Range | 納期 / Lead Time |
|---|---------------------|-------------------------|--------------|--------------|----------------------|-------------------|
| 1 | [name] | [mfr] | [country] | [specs] | [range] | [time] |

---

## お支払い条件 / Payment Terms
[Standard: 30 days net / 標準: 締め切り後30日 / 표준: 30일 결제]

## 納入条件 / Delivery Terms
[To be discussed / ご相談 / 상담 필요]

## 備考 / Notes
[Any additional terms, conditions, or remarks]

---

**カネイ貿易株式会社**
Kanei Trading Co., Ltd.
 Kanei Boeki Kabushiki Gaisha)
```

## Template Engine

Paperclip uses `【placeholder】` syntax for template variables:

| Placeholder | Description | Example |
|-------------|-------------|---------|
| 【顧客名】 | Customer company name | 株式会社テスト |
| 【担当者名】 | Contact person | 田中太郎 |
| 【住所】 | Customer address | 東京都千代田区... |
| 【作成日】 | Creation date | 2026年5月28日 |
| 【有効期限】 | Valid until date | 2026年6月27日 |
| 【機器一覧】 | Equipment table | (auto-generated) |
| 【合計金額】 | Total amount | ¥10,000,000 |

## Workflow

1. **Identify customer** — GET /customers/:id or accept customer details
2. **Select equipment** — GET /equipment with manufacturerId filter
3. **Fetch manufacturer details** — GET /manufacturers/:id for each equipment item
4. **Generate proposal data** — Populate ProposalFormData structure
5. **Create document** — POST /documents with templateId and formData
6. **Generate PDF** — GET /documents/:id/pdf

## Multilingual Considerations

- **Customer-facing documents**: Use customer's language (detect from customer.name script)
  - Japanese customer → Japanese proposal
  - Korean customer → Korean proposal
  - International → English proposal
- **Internal documents**: Japanese (社内標準)
- **Equipment names**: Always include both `name` (English) and `nameJa` (Japanese) or Korean equivalent
- **Currency**: JPY (¥) for domestic, USD ($) for international, KRW (₩) for Korean transactions
- **Date format**: YYYY年MM月DD日 (JP), YYYY년 MM월 DD일 (KR), DD MMM YYYY (EN)

## Validity Period

- Standard: 30 days from creation
- High-value deals (>¥10M): 14 days
- Service agreements: 90 days

## Anti-patterns

- **Missing manufacturer**: Every equipment line MUST have a manufacturer
- **Empty price range**: Flag equipment without price_range for manual pricing
- **No lead time**: Equipment without lead_time requires explicit discussion note
- **Mixed currencies**: Never mix currencies in a single proposal without conversion table

## Related Skills

- `pipeline-review` — Check pipeline before generating proposals
- `customer-research` — Customer background for proposal personalization
- `multilingual-terminology` — Business term translations
