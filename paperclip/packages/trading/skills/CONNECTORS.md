# Connectors / コネクター

This document maps connector categories used by Paperclip Trading skills to available services.

## Connector Categories

| Category | Purpose | Included MCP Server | Alternatives |
|----------|---------|--------------------|--------------|
| ~~API | Paperclip REST API | paperclip-api (localhost:3001) | Paperclip Gateway (localhost:3000) |
| ~~DB | Direct database access | paperclip-postgres (pg driver) | Adminer, pgAdmin |
| ~~Vault | Obsidian knowledge base | obsidian-vault (local filesystem) | Notion, Confluence |
| ~~CRM | Customer relationship management | Paperclip customers API | HubSpot, Salesforce |
| ~~Email | Email communication | Paperclip email service (Xserver) | Gmail, MS365 |
| ~~Chat | Team communication | Paperclip Telegram bot | Slack, Discord |
| ~~Documents | Document generation | Paperclip document service | DocuSign, PandaDoc |
| ~~ERP | Accounting & finance | (not yet connected) | NetSuite, SAP |

## Paperclip Built-in Services

These connectors are available by default when running Paperclip:

### ~~API — Paperclip Trading API
- **Endpoints**: /customers, /manufacturers, /equipment, /deals, /documents, /deals/:id/emails
- **Auth**: JWT (HS256, access + refresh tokens)
- **Encoding**: UTF-8 with mojibake validation on all text input

### ~~DB — PostgreSQL
- **Connection**: `postgres://paperclip:paperclip@localhost:5432/paperclip`
- **Encoding**: UTF8 (client_encoding verified on connect)
- **Safe import**: Use `safe-import.ts` with Node.js pg driver

### ~~Vault — Obsidian
- **Path**: `C:\Users\kanei\01.Obsidian Vault\03 카네이무역`
- **Content**: Company dossiers, meeting notes, reference materials
- **Note**: Korean paths require PowerShell for access

### ~~Email — Xserver
- **SMTP**: Configured via environment variables
- **IMAP**: Email sync for deal correspondence

## Graceful Degradation

All skills work in **standalone mode** without any connectors connected. When connectors are available, skills enter **supercharged mode** with automatic data fetching and richer context.

| Skill | Standalone | Supercharged |
|-------|-----------|--------------|
| pipeline-review | User pastes deal list | Auto-fetches from API, enriches with customer/manufacturer data |
| proposal-draft | User provides details | Auto-fetches customer + equipment + manufacturer from API |
| customer-research | Web search only | Searches existing DB + deal history + email archive |
| deal-advancement | Manual checklist | Auto-loads deal + validates encoding + executes transition |
| multilingual-terminology | Always available | N/A (reference only) |
