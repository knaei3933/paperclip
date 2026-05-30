---
name: pipeline-review
description: Review and analyze the trading deal pipeline. Assess pipeline health, identify stalled deals, calculate weighted forecast, and recommend actions. Supports Japanese (パイプライン分析), Korean (파이프라인 리뷰), and English.
argument-hint: "<stage-filter>"
---

# Pipeline Review / パイプライン分析 / 파이프라인 리뷰

## How It Works

```
Standalone (no connectors):
  User provides deal list → Pipeline analysis → Health scorecard + recommendations

Supercharged (with Paperclip API):
  API: GET /deals → Auto-fetch pipeline → Full analysis with customer/manufacturer context
  API: GET /encoding-check → Verify data integrity before analysis
```

## Deal Stages

| Stage | Japanese | Korean | Probability | Description |
|-------|----------|--------|-------------|-------------|
| lead | リード | 리드 | 10% | Initial inquiry received |
| qualified | 有望案件 | 유망 건 | 25% | Requirements confirmed, budget verified |
| proposal | 提案 | 제안 | 40% | Formal proposal submitted |
| negotiation | 交渉 | 협상 | 60% | Active price/terms negotiation |
| contract | 契約 | 계약 | 80% | Contract signing in progress |
| delivery | 納品 | 납품 | 90% | Equipment shipped/delivered |
| installation | 設置 | 설치 | 95% | Installation and setup at customer site |
| complete | 完了 | 완료 | 100% | Deal closed, payment received |
| as | AS/保守 | AS/유지보수 | 100% | After-sales support and maintenance |

## Pipeline Health Scorecard

For each pipeline, score these dimensions (1-5):

| Dimension | Weight | Criteria |
|-----------|--------|----------|
| Velocity | 20% | Average days per stage vs target (lead→contract: 90 days) |
| Balance | 20% | Even distribution across stages (no bottlenecks) |
| Volume | 15% | Total weighted pipeline value vs quota/target |
| Age | 15% | Percentage of deals < 30 days old in early stages |
| Coverage | 15% | Pipeline value ≥ 3× quota |
| Data Quality | 15% | % of deals with complete amount, customer, manufacturer |

### Scoring
- **5 (Excellent)**: On track, no intervention needed
- **4 (Good)**: Minor adjustments recommended
- **3 (Fair)**: Specific actions needed within 2 weeks
- **2 (Poor)**: Immediate intervention required
- **1 (Critical)**: Pipeline at risk of missing target

## Output Format

```markdown
# Pipeline Review / パイプライン分析

**Review Date**: [date]
**Pipeline Period**: [period]

## Summary / 概要
- Total Deals: [N]
- Weighted Value: ¥[X] (加重値)
- Unweighted Value: ¥[Y] (未加重値)
- Average Deal Age: [D] days (平均案件期間)

## Health Scorecard / 健全性スコア

| Dimension | Score | Status |
|-----------|-------|--------|
| Velocity | [1-5] | [🟢/🟡/🔴] |
| Balance | [1-5] | [🟢/🟡/🔴] |
| Volume | [1-5] | [🟢/🟡/🔴] |
| Age | [1-5] | [🟢/🟡/🔴] |
| Coverage | [1-5] | [🟢/🟡/🔴] |
| Data Quality | [1-5] | [🟢/🟡/🔴] |
| **Overall** | **[avg]** | **[status]** |

## Stage Breakdown / ステージ別内訳

| Stage | Count | Weighted ¥ | Avg Age |
|-------|-------|------------|---------|
| [stage] | [n] | ¥[val] | [d] days |

## Action Items / アクション項目
1. [Specific recommendation with deal reference]
2. ...

## Risk Alerts / リスク警告
- [Stalled deals, data gaps, at-risk customers]
```

## Workflow

1. **Fetch pipeline data** — GET /deals (or accept pasted CSV/JSON)
2. **Enrich with context** — GET /customers/:id, GET /manufacturers/:id for each deal
3. **Run encoding check** — GET /encoding-check to verify data integrity
4. **Calculate metrics** — Weighted values, velocity, aging, coverage
5. **Score health** — Apply scorecard dimensions
6. **Generate recommendations** — Stage-specific actions based on scoring

## Deal Advancement Criteria

Before advancing a deal to the next stage, verify:

| Transition | Required Evidence |
|------------|-------------------|
| lead → qualified | Customer contact confirmed, budget range verified, timeline discussed |
| qualified → proposal | Requirements document complete, pricing obtained from manufacturer |
| proposal → negotiation | Customer responded to proposal, specific feedback received |
| negotiation → contract | Terms agreed, legal review complete (if required) |
| contract → delivery | Signed contract on file, payment terms confirmed |
| delivery → installation | Delivery confirmed by customer, installation date scheduled |
| installation → complete | Customer sign-off obtained, invoice submitted |
| complete → as | Warranty terms defined, support contact established |

## Anti-patterns

- **Skipping stages**: Never advance 2+ stages at once — each transition requires evidence
- **Stale deals**: Any deal in the same stage > 60 days should be flagged for review
- **Missing amounts**: Every deal in `proposal` or later MUST have an amount
- **Orphan deals**: Every deal should have both customer_id AND manufacturer_id by `qualified` stage

## Related Skills

- `deal-advancement` — Detailed stage transition criteria
- `customer-research` — Customer background for pipeline enrichment
- `proposal-draft` — Generate proposals for qualified deals
- `multilingual-terminology` — Business term translations
