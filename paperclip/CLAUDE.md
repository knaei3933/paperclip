# Paperclip Trading Platform

## Development
- Node.js >= 20.0.0, TypeScript strict, ESM (type: "module", NodeNext resolution)
- Build: `pnpm build` | Dev: `pnpm dev` | Test: `pnpm test` | Type check: `npx tsc --noEmit`
- Migrations: auto-applied on startup from SQL files in `packages/core/src/db/migrations/` and `packages/trading/src/db/migrations/`
- DB: PostgreSQL at `postgres://paperclip:paperclip@localhost:5432/paperclip`

## Conventions
- Service pattern: `(db: DbPool, ...params) => Promise<T>`
- Import paths: use `.js` extension for local imports (NodeNext ESM)
- Encoding: UTF-8 everywhere. Use `detectMojibake()` for text validation.
- Multilingual: JP/KR/EN. Customer language takes priority.
- No translation in MCP tools — return raw specs + `translationNeeded` flag.

## MCP Server
- SSE transport embedded in Gateway (not standalone)
- Enable: `MCP_ENABLED=true` env var
- Endpoints: `/mcp/sse` (SSE), `/mcp/rpc` (JSON-RPC POST)
- Auth: JWT token via query param or Authorization header
- Port: `PORT` env var (default 3100)

## Pricing Model
最終価格 = (メーカー価格 × 為替レート + 送金手数料) × (1 + マージン率)
- 送金手数料 = 固定手数料 + (金額 × パーセンテージ)
- Categories: 設備 15%, 工事 30%, 包装材 22.5%
- Exchange: KRW_JPY=0.11, USD_JPY=150
- Config: `packages/trading/trading.local.json`

## Structure
- `src/main.ts` — App entrypoint, HTTP server, migration runner
- `packages/gateway/src/mcp/` — MCP server framework + tools
- `packages/trading/src/skills/` — Business logic handlers
- `packages/trading/src/db/migrations/` — SQL migrations (V005-V008)
- `packages/dashboard/src/` — React SPA
