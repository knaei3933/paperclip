---
name: deal-advancement
description: Guide deal stage progression with evidence-based criteria. Each transition requires specific verification. Prevents premature advancement and identifies stalled deals. Supports Japanese (案件進行), Korean (거래 진행), and English.
argument-hint: "<deal-id>"
---

# Deal Advancement / 案件進行 / 거래 진행

## How It Works

```
Standalone:
  User provides deal details + target stage → Evidence checklist → Advance or recommend actions

Supercharged (with Paperclip API):
  API: GET /deals/:id → Current deal state
  API: POST /deals/:id/advance → Execute stage transition
  API: GET /encoding-check → Verify data before advancement
```

## Stage Transition Requirements

### lead → qualified (リード → 有望案件)

**Required evidence:**
- [ ] Customer contact person identified (担当者確認済み)
- [ ] Budget range discussed or estimated (予算範囲確認)
- [ ] Timeline or urgency assessed (導入時期確認)
- [ ] Equipment requirements初步ly identified (機器要件の初期確認)

**Red flags:**
- No specific contact person → Stay in lead
- Customer says "just looking" → Stay in lead
- Budget completely unknown → Request qualification call

### qualified → proposal (有望案件 → 提案)

**Required evidence:**
- [ ] Detailed requirements documented (要件定義書完了)
- [ ] Manufacturer pricing obtained (メーカー価格取得済み)
- [ ] Customer decision criteria understood (選定基準の把握)
- [ ] Competition identified (競合の把握)
- [ ] Deal amount estimated (案件金額の見積もり)

**Red flags:**
- No manufacturer quote → Cannot submit proposal
- Requirements unclear → Schedule requirements workshop
- No budget approval → Wait for budget confirmation

### proposal → negotiation (提案 → 交渉)

**Required evidence:**
- [ ] Customer received and reviewed proposal (提案書確認済み)
- [ ] Specific feedback received (具体的フィードバック受領)
- [ ] Price discussion initiated (価格協議開始)
- [ ] Terms and conditions under discussion (条件協議中)

**Red flags:**
- No response after 14 days → Follow up
- Competitor proposal preferred → Escalate to account strategy
- Requirements changed significantly → Return to qualified

### negotiation → contract (交渉 → 契約)

**Required evidence:**
- [ ] Price and terms agreed (価格・条件合意済み)
- [ ] Legal review complete if required (法務確認完了)
- [ ] Contract draft prepared (契約書案作成済み)
- [ ] Payment terms confirmed (支払条件確認済み)
- [ ] Delivery timeline agreed (納期合意済み)

**Red flags:**
- Unusual liability clauses → Legal review mandatory
- Payment terms > 90 days → Credit check required
- Single-source justification needed → Document rationale

### contract → delivery (契約 → 納品)

**Required evidence:**
- [ ] Signed contract on file (署名済み契約書)
- [ ] Purchase order received (発注書受領)
- [ ] Manufacturer delivery confirmed (メーカー出荷確認)
- [ ] Shipping/logistics arranged (物流手配完了)

### delivery → installation (納品 → 設置)

**Required evidence:**
- [ ] Delivery confirmed by customer (納品確認)
- [ ] Installation date scheduled (設置日決定)
- [ ] Technical team assigned (技術担当者決定)
- [ ] Site preparation confirmed (設置場所準備完了)

### installation → complete (設置 → 完了)

**Required evidence:**
- [ ] Installation sign-off (設置完了確認書)
- [ ] Customer training completed (操作教育完了)
- [ ] Invoice submitted (請求書送付済み)
- [ ] Warranty activated (保証期間開始)

### complete → as (完了 → AS/保守)

**Required evidence:**
- [ ] Warranty terms defined (保証条項定義済み)
- [ ] Support contact established (サポート窓口設置)
- [ ] Maintenance schedule agreed (保守スケジュール合意)

## Stalled Deal Detection

| Stage | Stalled Threshold | Action |
|-------|-------------------|--------|
| lead | > 14 days | Re-qualify or archive |
| qualified | > 21 days | Schedule proposal meeting |
| proposal | > 30 days | Follow up or revise proposal |
| negotiation | > 45 days | Escalate to decision maker |
| contract | > 14 days | Verify legal review status |
| delivery | > 60 days | Check manufacturer status |
| installation | > 30 days | Confirm customer readiness |

## Workflow

1. **Get current deal** — GET /deals/:id
2. **Verify encoding** — GET /encoding-check (prevent corrupted data in transitions)
3. **Check transition requirements** — Match against stage-specific checklist
4. **Recommend action** — Advance, hold, or revert based on evidence
5. **Execute** — POST /deals/:id/advance (if criteria met)

## Anti-patterns

- **Happy ears**: Advancing based on positive signals without concrete evidence
- **Stage skipping**: Never advance 2+ stages regardless of urgency
- **Force advancement**: Override criteria only with explicit management approval
- **Ignoring stalls**: Stalled deals degrade pipeline accuracy — address immediately

## Related Skills

- `pipeline-review` — Overall pipeline health including stalled detection
- `customer-research` — Customer context for qualification decisions
- `multilingual-terminology` — Business term translations
