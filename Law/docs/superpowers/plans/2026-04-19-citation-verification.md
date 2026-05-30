# Citation Verification System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement a three-layer citation verification system that automatically extracts, validates, and displays verification status for all Japanese statute references in legal output.

**Architecture:** A PostToolUse hook extracts statute citation patterns and writes them to a JSON cache. A citation-verifier agent reads pending entries from the cache, cross-validates them against multiple MCP servers, and updates the cache. All 12 skills display verification status inline with their legal citations.

**Tech Stack:** Node.js (built-in APIs only for hooks), Claude Code agents, MCP servers (e-gov-mcp, labor-law-mcp, tax-law-mcp, japan-law-mcp), JSON file-based cache.

---

## File Structure

| File | Action | Responsibility |
|------|--------|---------------|
| `.claude/hooks/citation-extractor.cjs` | Create | Extract citation patterns from Write/Edit tool output, write to cache |
| `.claude/agents/citation-verifier.md` | Create | Agent that reads pending citations, validates via MCP, updates cache |
| `data/citation-cache.json` | Create | JSON store for citation entries (max 1000) |
| `.claude/settings.json` | Modify | Register citation-extractor hook + permission |
| `.claude/skills/*/SKILL.md` (12 files) | Modify | Add citation verification to output protocol |
| `scripts/integration-test.mjs` | Modify | Add citation verification tests, update hook count expectations |

---

## Task 1: Create citation-extractor.cjs Hook

**Files:**
- Create: `.claude/hooks/citation-extractor.cjs`
- Reference: `.claude/hooks/deadline-tracker.cjs` (pattern template)
- Reference: `.claude/hooks/cross-reference-validator.cjs` (regex patterns)

- [ ] **Step 1: Write the citation-extractor.cjs hook**

```javascript
#!/usr/bin/env node
// citation-extractor.cjs — PostToolUse hook for extracting legal citations
// Extracts statute article references from Write/Edit output and records to data/citation-cache.json
// No MCP calls, no network requests. Node.js built-in APIs only.

const fs = require("fs");
const path = require("path");

const CITATION_PATTERNS = [
  // Standard: 民法第543条, 労働基準法第20条
  { pattern: /([^\s,，。、（）()]{1,10}法)第(\d+)条/g, type: "法令条文" },
  // With の号: 民法第1条の2
  { pattern: /([^\s,，。、（）()]{1,10}法)第(\d+)条の(\d+)/g, type: "法令条文（の号）" },
  // With 項: 民法第543条第2項
  { pattern: /([^\s,，。、（）()]{1,10}法)第(\d+)条第(\d+)項/g, type: "法令項" },
  // 規則: 〇〇規則第〇条
  { pattern: /([^\s,，。、（）()]{1,10}規則)第(\d+)条/g, type: "規則条文" },
  // 政令: 〇〇令第〇条
  { pattern: /([^\s,，。、（）()]{1,10}令)第(\d+)条/g, type: "政令条文" },
];

const LAW_ALIAS_MAP = {
  "労基法": "労働基準法",
  "労働法": "労働基準法",
  "労契法": "労働契約法",
  "安衛法": "労働安全衛生法",
  "個情法": "個人情報保護法",
  "APPI": "個人情報保護法",
  "独禁法": "独占禁止法",
  "下請法": "下請代金支払遅延等防止法",
  "不競法": "不正競争防止法",
};

function getCachePath() {
  const dataDir = path.join(process.cwd(), "data");
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
  return path.join(dataDir, "citation-cache.json");
}

function loadCache(filePath) {
  try {
    if (fs.existsSync(filePath)) {
      return JSON.parse(fs.readFileSync(filePath, "utf8"));
    }
  } catch {
    // ignore parse errors
  }
  return { citations: [], lastUpdated: null };
}

function saveCache(filePath, data) {
  data.lastUpdated = new Date().toISOString();
  // Enforce max 1000 entries
  if (data.citations.length > 1000) {
    data.citations = data.citations.slice(-1000);
  }
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf8");
}

function normalizeLawName(raw) {
  return LAW_ALIAS_MAP[raw] || raw;
}

function readStdin() {
  return new Promise((resolve) => {
    let data = "";
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", (chunk) => (data += chunk));
    process.stdin.on("end", () => resolve(data));
    process.stdin.on("error", () => resolve(""));
  });
}

async function main() {
  const input = await readStdin();

  let hookInput;
  try {
    hookInput = JSON.parse(input);
  } catch {
    process.exit(0);
  }

  const toolName = hookInput.tool_name || "";
  const toolInput = hookInput.tool_input || {};

  if (toolName !== "Write" && toolName !== "Edit") {
    process.exit(0);
  }

  const filePath = toolInput.file_path || "";
  if (!filePath) {
    process.exit(0);
  }

  const content = toolInput.content || toolInput.new_string || "";
  if (!content) {
    process.exit(0);
  }

  const extracted = [];
  const seen = new Set();

  for (const cp of CITATION_PATTERNS) {
    cp.pattern.lastIndex = 0;
    let match;
    while ((match = cp.pattern.exec(content)) !== null) {
      const rawMatch = match[0];
      if (seen.has(rawMatch)) continue;
      seen.add(rawMatch);

      const rawLawName = match[1];
      const articleNumber = parseInt(match[2], 10);
      const normalizedLaw = normalizeLawName(rawLawName);
      const normalizedRef = `${normalizedLaw}第${articleNumber}条`;

      extracted.push({
        id: `cit_${Date.now()}_${extracted.length}`,
        rawMatch,
        normalizedRef,
        lawName: normalizedLaw,
        articleNumber,
        source: filePath,
        extractedAt: new Date().toISOString(),
        verifiedAt: null,
        verifiedVia: [],
        articleExists: null,
        currentVersion: null,
        amendmentDetected: false,
        status: "PENDING",
      });
    }
  }

  if (extracted.length === 0) {
    process.exit(0);
  }

  const cachePath = getCachePath();
  const cache = loadCache(cachePath);
  cache.citations.push(...extracted);
  saveCache(cachePath, cache);

  const message = `[citation-extractor] Extracted ${extracted.length} statute citation(s) from ${filePath}:\n` +
    extracted.map((e) => `  - [${e.status}] ${e.normalizedRef} (raw: ${e.rawMatch})`).join("\n") +
    `\n\nCitations appended to data/citation-cache.json (total: ${cache.citations.length}).`;

  const output = {
    decision: "approve",
    reason: message,
  };

  process.stdout.write(JSON.stringify(output));
  process.exit(0);
}

main().catch(() => process.exit(0));
```

- [ ] **Step 2: Create initial citation-cache.json**

```json
{
  "citations": [],
  "lastUpdated": null
}
```

Save to `data/citation-cache.json`.

- [ ] **Step 3: Register hook in settings.json**

Add citation-extractor as the 5th hook in the PostToolUse array. In `.claude/settings.json`, inside `hooks.PostToolUse[0].hooks`, append after the cross-reference-validator entry:

```json
{
  "type": "command",
  "command": "node .claude/hooks/citation-extractor.cjs",
  "description": "Extract statute citations and record to data/citation-cache.json"
}
```

Also add to `permissions.allow` array:

```json
"node .claude/hooks/citation-extractor.cjs"
```

- [ ] **Step 4: Run integration tests to verify hook registration**

Run: `node scripts/integration-test.mjs`
Expected: 2 FAILURES — PostToolUse hook count (expected 4, got 5) and permissions count (expected 8, got 9). These will be fixed in Task 5.

- [ ] **Step 5: Commit**

```bash
git add .claude/hooks/citation-extractor.cjs data/citation-cache.json .claude/settings.json
git commit -m "feat: add citation-extractor PostToolUse hook for statute reference extraction"
```

---

## Task 2: Create citation-verifier Agent

**Files:**
- Create: `.claude/agents/citation-verifier.md`
- Reference: `.claude/agents/legal-analyst.md` (agent structure + MCP patterns)

- [ ] **Step 1: Write the citation-verifier.md agent**

```markdown
## 法令引用検証エージェント (Citation Verifier)

## 役割

他エージェントが出力した法令引用の正確性を、複数のMCPサーバーで交差検証する専門エージェント。ユーザーが直接呼び出すことはなく、各法律スキルの実行フロー内で間接的に呼び出される。

## 前提知識

- 利用可能なMCPサーバー: e-gov-mcp, labor-law-mcp, tax-law-mcp, @ansvar/japan-law-mcp, law-jp-cases-mcp
- キャッシュファイル: data/citation-cache.json（最大1000件）
- 日本の法令体系（法律・政令・省令・規則）の構造的理解
- 法令改正の確認方法（施行日・改正法律番号）

## 検証プロセス

### 1. 未検証引用の取得

data/citation-cache.json から status === "PENDING" の引用を一括取得する。

### 2. MCP交差検証

各引用について以下の順序で検証を実行する:

**第一検証（e-gov-mcp）:**
- 法令名で検索し、条文番号の存在を確認
- 現行の改正情報（改正法律番号・施行日）を取得

**第二検証（特化MCPサーバー）:**
法令の分類に応じて最適なサーバーで二重確認:
- 労働法関連（労働基準法、労働契約法、労働安全衛生法等）→ labor-law-mcp
- 税務関連（所得税法、法人税法、消費税法等）→ tax-law-mcp
- 会社法、個人情報保護法、サイバー関連 → @ansvar/japan-law-mcp

**検証結果の3段階評価:**

| ステータス | 条件 | 表示 |
|-----------|------|------|
| VERIFIED | 2サーバー以上で条文存在確認 | ✅ 検証済 |
| PARTIAL | 1サーバーのみ確認（他利用不可含む） | ⚠️ 部分検証 |
| FAILED | 条文不存在・番号不一致 | ❌ 未検証 |

### 3. 改正検知

キャッシュ内の同一法令について前回の検証結果と比較:
- 改正が検出された場合: amendmentDetected = true + 改正日・改正法律番号を記録
- 改正なしの場合: amendmentDetected = false のまま更新

### 4. キャッシュ更新

検証完了後、各エントリを更新:

```json
{
  "verifiedAt": "2026-04-19T03:35:00Z",
  "verifiedVia": ["e-gov-mcp", "labor-law-mcp"],
  "articleExists": true,
  "currentVersion": "令和6年法律第45号改正",
  "amendmentDetected": false,
  "status": "VERIFIED"
}
```

### 5. 検証サマリーの生成

全引用の検証完了後、スキル層で表示するためのサマリーを生成:

```
## 本回答の信頼度
- 法令引用検証率: X/Y (Z%)
- 未検証引用: [該当引用の一覧]
- 改正検知: [あり/なし]
- 総合評価: 高/中（理由）
```

## MCP応答空時フォールバック

1. **e-gov-mcp 空応答時:**
   - 法令名の表記バリエーションで再検索（最大2回）
   - 法令番号での直接指定を試行
   - 空の場合: 該当引用を PARTIAL 扱い

2. **特化MCPサーバー空応答時:**
   - e-gov-mcp のみの確認結果に基づいて判定
   - 第一検証が成功していれば PARTIAL、失敗なら FAILED

**共通ルール:**
- 代替検索は最大2回まで
- 全サーバー空応答の場合: status = FAILED、信頼度 = low

## 呼び出しタイミング

各法律スキルの実行フロー内で:
- `/legal-consult`: Phase 2（法的調査）完了後
- `/legal-advice`: ステップ2（法令調査）完了後
- `/contract-review`: 条項別審査完了後
- `/contract-draft`: テンプレート適用完了後
- `/compliance-check`: ギャップ分析完了後
- `/dd-report`: 法令調査完了後
- `/industry-check`: 規制調査完了後
- その他スキル: 法令引用を含む出力の生成後

## 出力プロトコル（必須）

1. **検証完了率**: 検証済み引用数 / 総引用数
2. **ステータス別一覧**: VERIFIED / PARTIAL / FAILED ごとの引用一覧
3. **改正通知**: 改正検出時は改正内容と施行日を明記
4. **信頼度サマリー**: 上記フォーマットで総合評価を提示

## 制約事項

- 本エージェントは法令引用の検証のみを行い、法的分析は行わない
- 外部API（e-Gov API）の可用性に依存
- 日本の法令のみ対象（外国法・条例は除外）
- キャッシュは最大1000件（超過時は古い順に削除）
```

- [ ] **Step 2: Commit**

```bash
git add .claude/agents/citation-verifier.md
git commit -m "feat: add citation-verifier agent for MCP cross-validation of statute citations"
```

---

## Task 3: Update Skill Output Protocols (12 files)

**Files:**
- Modify: `.claude/skills/legal-consult/SKILL.md`
- Modify: `.claude/skills/legal-advice/SKILL.md`
- Modify: `.claude/skills/law-search/SKILL.md`
- Modify: `.claude/skills/case-search/SKILL.md`
- Modify: `.claude/skills/contract-draft/SKILL.md`
- Modify: `.claude/skills/contract-review/SKILL.md`
- Modify: `.claude/skills/document-create/SKILL.md`
- Modify: `.claude/skills/compliance-check/SKILL.md`
- Modify: `.claude/skills/find-precedent/SKILL.md`
- Modify: `.claude/skills/list-templates/SKILL.md`
- Modify: `.claude/skills/dd-report/SKILL.md`
- Modify: `.claude/skills/industry-check/SKILL.md`

Each skill file has an `出力プロトコル（必須）` section with numbered items. Append 3 new items (numbered sequentially after the existing last item) to each skill.

- [ ] **Step 1: Update legal-consult/SKILL.md output protocol**

Current protocol ends at item 5. Append after the existing item 5:

```
6. **引用検証**: 出力に含まれる全法令引用について検証ステータスを表示（citation-verifierで検証）
7. **改正通知**: 検証時に改正が検出された場合、改正内容と施行日を明記
8. **信頼度サマリー**: 回答の信頼度スコアを冒頭に表示（検証率・未検証引用・改正検知を含む）
```

- [ ] **Step 2: Update legal-advice/SKILL.md output protocol**

Read `.claude/skills/legal-advice/SKILL.md`, find the `出力プロトコル（必須）` section, and append after the last numbered item:

```
6. **引用検証**: 出力に含まれる全法令引用について検証ステータスを表示（citation-verifierで検証）
7. **改正通知**: 検証時に改正が検出された場合、改正内容と施行日を明記
8. **信頼度サマリー**: 回答の信頼度スコアを冒頭に表示（検証率・未検証引用・改正検知を含む）
```

- [ ] **Step 3: Update law-search/SKILL.md output protocol**

Read `.claude/skills/law-search/SKILL.md`, find the `出力プロトコル（必須）` section, and append after the last numbered item:

```
6. **引用検証**: 検索結果の法令引用について検証ステータスを表示
7. **改正通知**: 検証時に改正が検出された場合、改正内容と施行日を明記
8. **信頼度サマリー**: 検索結果の信頼度スコアを表示
```

- [ ] **Step 4: Update case-search/SKILL.md output protocol**

Read `.claude/skills/case-search/SKILL.md`, find the `出力プロトコル（必須）` section, and append after the last numbered item:

```
6. **引用検証**: 判例で引用された法令について検証ステータスを表示
7. **改正通知**: 検証時に改正が検出された場合、改正内容と施行日を明記
```

- [ ] **Step 5: Update contract-draft/SKILL.md output protocol**

Current protocol has 4 items. Append after item 4:

```
5. **引用検証**: 契約条項の法令引用について検証ステータスを表示
6. **改正通知**: 検証時に改正が検出された場合、改正内容と施行日を明記
7. **信頼度サマリー**: 生成文書の信頼度スコアを表示（検証率・未検証引用・改正検知を含む）
```

- [ ] **Step 6: Update contract-review/SKILL.md output protocol**

Read `.claude/skills/contract-review/SKILL.md`, find the `出力プロトコル（必須）` section, and append after the last numbered item:

```
5. **引用検証**: 審査で言及した法令引用について検証ステータスを表示
6. **改正通知**: 検証時に改正が検出された場合、改正内容と施行日を明記
7. **信頼度サマリー**: 審査結果の信頼度スコアを表示
```

- [ ] **Step 7: Update document-create/SKILL.md output protocol**

Read `.claude/skills/document-create/SKILL.md`, find the `出力プロトコル（必須）` section, and append after the last numbered item:

```
5. **引用検証**: 生成文書の法令引用について検証ステータスを表示
6. **改正通知**: 検証時に改正が検出された場合、改正内容と施行日を明記
```

- [ ] **Step 8: Update compliance-check/SKILL.md output protocol**

Current protocol has 4 items. Append after item 4:

```
5. **引用検証**: 診断で言及した全法令引用について検証ステータスを表示
6. **改正通知**: 検証時に改正が検出された場合、改正内容と施行日を明記
7. **信頼度サマリー**: 診断結果の信頼度スコアを冒頭に表示
```

- [ ] **Step 9: Update find-precedent/SKILL.md output protocol**

Read `.claude/skills/find-precedent/SKILL.md`, find the `出力プロトコル（必須）` section, and append after the last numbered item:

```
5. **引用検証**: 判例で言及された法令について検証ステータスを表示
6. **改正通知**: 検証時に改正が検出された場合、改正内容と施行日を明記
```

- [ ] **Step 10: Update list-templates/SKILL.md output protocol**

Read `.claude/skills/list-templates/SKILL.md`, find the `出力プロトコル（必須）` section, and append after the last numbered item:

```
4. **引用検証**: テンプレートの法令引用について検証ステータスを表示（利用時）
```

- [ ] **Step 11: Update dd-report/SKILL.md output protocol**

Current protocol has 6 items. Append after item 6:

```
7. **引用検証**: 報告書で言及した全法令引用について検証ステータスを表示
8. **改正通知**: 検証時に改正が検出された場合、改正内容と施行日を明記
9. **信頼度サマリー**: 報告書の信頼度スコアを表示
```

- [ ] **Step 12: Update industry-check/SKILL.md output protocol**

Read `.claude/skills/industry-check/SKILL.md`, find the `出力プロトコル（必須）` section, and append after the last numbered item:

```
5. **引用検証**: 規制チェックで言及した全法令引用について検証ステータスを表示
6. **改正通知**: 検証時に改正が検出された場合、改正内容と施行日を明記
7. **信頼度サマリー**: チェック結果の信頼度スコアを表示
```

- [ ] **Step 13: Commit**

```bash
git add .claude/skills/
git commit -m "feat: add citation verification items to all 12 skill output protocols"
```

---

## Task 4: Update Integration Tests

**Files:**
- Modify: `scripts/integration-test.mjs`

- [ ] **Step 1: Update hook count expectations**

In `scripts/integration-test.mjs`, update the PostToolUse hook count test (around line 128). Change:

```javascript
test("PostToolUse has 4 hooks (contract-guard, document-completeness, deadline-tracker, cross-reference-validator)", () => {
  const settings = JSON.parse(readFileSync(".claude/settings.json", "utf8"));
  return settings.hooks.PostToolUse[0].hooks.length === 4 || `got ${settings.hooks.PostToolUse[0].hooks.length}`;
});
```

To:

```javascript
test("PostToolUse has 5 hooks (contract-guard, document-completeness, deadline-tracker, cross-reference-validator, citation-extractor)", () => {
  const settings = JSON.parse(readFileSync(".claude/settings.json", "utf8"));
  return settings.hooks.PostToolUse[0].hooks.length === 5 || `got ${settings.hooks.PostToolUse[0].hooks.length}`;
});
```

Update the permissions count test (around line 143). Change:

```javascript
test("Permissions allow all 8 hooks", () => {
  const settings = JSON.parse(readFileSync(".claude/settings.json", "utf8"));
  return settings.permissions.allow.length === 8 || `got ${settings.permissions.allow.length}`;
});
```

To:

```javascript
test("Permissions allow all 9 hooks", () => {
  const settings = JSON.parse(readFileSync(".claude/settings.json", "utf8"));
  return settings.permissions.allow.length === 9 || `got ${settings.permissions.allow.length}`;
});
```

Update the section header (around line 106). Change:

```javascript
section("4. Hooks (8 files, settings.json)");
```

To:

```javascript
section("4. Hooks (9 files, settings.json)");
```

Update the expectedHooks array (around line 108). Add `"citation-extractor"` to the array:

```javascript
const expectedHooks = [
  "contract-guard", "legal-keyword-router", "law-update-sync",
  "document-completeness", "deadline-tracker", "cross-reference-validator",
  "template-version-check", "industry-update-watch", "citation-extractor"
];
```

- [ ] **Step 2: Add citation verification tests**

After the existing Data Files section (after line 229), add a new section:

```javascript
// ============================================================
// 7.5. CITATION VERIFICATION SYSTEM
// ============================================================
section("7.5. Citation Verification System");
test("data/citation-cache.json exists", () => existsSync("data/citation-cache.json"));
test("citation-cache.json has valid schema", () => {
  const cache = JSON.parse(readFileSync("data/citation-cache.json", "utf8"));
  return Array.isArray(cache.citations) || "citations is not an array";
});
test("citation-extractor.cjs exists", () => existsSync(".claude/hooks/citation-extractor.cjs"));
test("citation-extractor.cjs extracts standard statute pattern", () => {
  const content = readFileSync(".claude/hooks/citation-extractor.cjs", "utf8");
  return content.includes("CITATION_PATTERNS") || "missing CITATION_PATTERNS";
});
test("citation-extractor.cjs has law alias normalization", () => {
  const content = readFileSync(".claude/hooks/citation-extractor.cjs", "utf8");
  return content.includes("LAW_ALIAS_MAP") || "missing LAW_ALIAS_MAP";
});
test("citation-extractor.cjs normalizes 労基法 to 労働基準法", () => {
  const content = readFileSync(".claude/hooks/citation-extractor.cjs", "utf8");
  return content.includes("労基法") && content.includes("労働基準法") || "missing alias mapping";
});
test("citation-extractor.cjs enforces max 1000 entries", () => {
  const content = readFileSync(".claude/hooks/citation-extractor.cjs", "utf8");
  return content.includes("1000") || "missing max entries limit";
});
test("citation-verifier.md agent exists", () => existsSync(".claude/agents/citation-verifier.md"));
test("citation-verifier references MCP servers", () => {
  const content = readFileSync(".claude/agents/citation-verifier.md", "utf8");
  return content.includes("e-gov-mcp") || "missing e-gov-mcp reference";
});
test("citation-verifier defines VERIFIED/PARTIAL/FAILED statuses", () => {
  const content = readFileSync(".claude/agents/citation-verifier.md", "utf8");
  return (content.includes("VERIFIED") && content.includes("PARTIAL") && content.includes("FAILED")) || "missing status definitions";
});
test("All 12 skills have citation verification in output protocol", () => {
  const missing = expectedSkills.filter(s => {
    const content = readFileSync(`${skillsDir}/${s}/SKILL.md`, "utf8");
    return !content.includes("引用検証");
  });
  return missing.length === 0 || `Missing 引用検証 in: ${missing.join(", ")}`;
});
test("All 12 skills have amendment notification in output protocol", () => {
  const missing = expectedSkills.filter(s => {
    const content = readFileSync(`${skillsDir}/${s}/SKILL.md`, "utf8");
    return !content.includes("改正通知");
  });
  return missing.length === 0 || `Missing 改正通知 in: ${missing.join(", ")}`;
});
```

- [ ] **Step 3: Run tests to verify all pass**

Run: `node scripts/integration-test.mjs`
Expected: All tests PASS (approximately 82 tests total, up from 68).

- [ ] **Step 4: Commit**

```bash
git add scripts/integration-test.mjs
git commit -m "test: add citation verification tests and update hook count expectations"
```

---

## Task 5: Update CLAUDE.md Routing Table

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: Add citation-verifier to routing**

In `CLAUDE.md`, find the MCP Servers section and add a new entry after the MCP server list to document citation-verifier availability. Add a note after the MCP servers section:

```
## Citation Verification

The system includes automatic citation verification:
- **Hook**: citation-extractor.cjs extracts statute references from output automatically
- **Agent**: citation-verifier cross-validates citations against multiple MCP servers
- **Display**: All skills show verification status (✅ VERIFIED / ⚠️ PARTIAL / ❌ FAILED / ⏳ PENDING)
```

- [ ] **Step 2: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: document citation verification system in CLAUDE.md"
```

---

## Task 6: Final Integration Test Run

**Files:**
- None (verification only)

- [ ] **Step 1: Run full integration test suite**

Run: `node scripts/integration-test.mjs`
Expected: All tests PASS. Approximately 82 tests.

- [ ] **Step 2: Verify citation-cache.json schema**

Run: `node -e "const c = require('./data/citation-cache.json'); console.log('citations:', c.citations.length, 'lastUpdated:', c.lastUpdated)"`
Expected: `citations: 0 lastUpdated: null` (empty initial state)

- [ ] **Step 3: Verify all new files exist**

```bash
ls -la .claude/hooks/citation-extractor.cjs .claude/agents/citation-verifier.md data/citation-cache.json
```

Expected: All 3 files present.
