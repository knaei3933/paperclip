// @paperclip/trading - Kanei Trading business automation
export type { DbPool } from './db/pool.js';
export * from './customers/customer.service.js';
export * from './manufacturers/manufacturer.service.js';
export * from './equipment/equipment.service.js';
export * from './deals/deal.service.js';
export * from './documents/template-engine.js';
export * from './documents/document.service.js';
export * from './email/email.service.js';
export { TradingApiRouter } from './api/trading-api-router.js';
export * from './telegram/trading-commands.js';
export * from './marketing/proposal-generator.js';
export { checkEmails, type EmailDraft } from './skills/email-auto-reply/handler.js';
export { runPipelineReview } from './skills/pipeline-review/handler.js';
export * from './documents/pdf-extractor.js';
export { createProposalDraft } from './skills/proposal-draft/handler.js';
export * from './skills/proposal-draft/margin-calculator.js';
export * from './skills/proposal-draft/proposal-draft.service.js';
export * from './documents/proposal-template.js';
