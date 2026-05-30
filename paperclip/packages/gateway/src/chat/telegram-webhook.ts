import type { Pool } from 'pg';
import { createHmac } from 'node:crypto';
import { handleTradingCommand, handleProposalCustomerSelect } from '@paperclip/trading';
import { generateProposalDraft } from '@paperclip/trading';

export interface TelegramCallbackQuery {
  id: string;
  from: { id: number; first_name: string };
  message?: { chat: { id: number } };
  data?: string;
}

export interface TelegramMessage {
  message_id: number;
  from?: { id: number; first_name: string };
  chat: { id: number };
  text?: string;
}

export interface TelegramWebhookConfig {
  botToken: string;
  pool: Pool;
}

export function createTelegramWebhookHandler(config: TelegramWebhookConfig) {
  const { botToken, pool } = config;

  const dbPool = { pool };

  async function verifySignature(body: string, hash: string): Promise<boolean> {
    const secret = createHmac('sha256', botToken).update(body).digest('hex');
    return secret === hash;
  }

  async function sendTelegramMessage(chatId: number, text: string, replyMarkup?: unknown): Promise<void> {
    const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
    const body: Record<string, unknown> = {
      chat_id: chatId,
      text,
      parse_mode: 'Markdown',
    };
    if (replyMarkup) {
      body.reply_markup = replyMarkup;
    }
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!response.ok) {
        console.error(`[TelegramWebhook] Failed to send message: ${response.status}`);
      }
    } catch (err) {
      console.error('[TelegramWebhook] Error sending message:', err);
    }
  }

  async function answerCallbackQuery(callbackQueryId: string, text?: string): Promise<void> {
    const url = `https://api.telegram.org/bot${botToken}/answerCallbackQuery`;
    try {
      await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          callback_query_id: callbackQueryId,
          text: text ?? '',
        }),
      });
    } catch (err) {
      console.error('[TelegramWebhook] Error answering callback:', err);
    }
  }

  async function handleCallback(callback: TelegramCallbackQuery): Promise<void> {
    if (!callback.data) return;

    const chatId = callback.message?.chat?.id;
    if (!chatId) return;

    if (callback.data.startsWith('proposal_customer:')) {
      const customerId = callback.data.slice('proposal_customer:'.length);
      const response = await handleProposalCustomerSelect(dbPool, customerId);
      await sendTelegramMessage(chatId, response.text, response.reply_markup);
      await answerCallbackQuery(callback.id, '顧客を選択しました');
      return;
    }

    if (callback.data.startsWith('proposal_equip:')) {
      const parts = callback.data.slice('proposal_equip:'.length).split(':');
      const customerId = parts[0];
      const equipmentId = parts[1];
      if (customerId && equipmentId) {
        try {
          const draft = await generateProposalDraft(dbPool, customerId, [equipmentId]);
          const eqItem = draft.formData.equipmentItems[0];
          await sendTelegramMessage(
            chatId,
            [
              `✅ 提案書ドラフト作成完了`,
              ``,
              `顧客: ${draft.formData.customerName}`,
              `機材: ${eqItem?.nameJa ?? eqItem?.name ?? ''}`,
              `メーカー: ${eqItem?.manufacturerName || '未設定'}`,
              `有効期限: ${new Date(draft.formData.validUntil).toLocaleDateString('ja-JP')}`,
              ``,
              `_ステータス: ドラフト_`,
            ].join('\n'),
          );
        } catch (err) {
          await sendTelegramMessage(chatId, `❌ 提案書の作成に失敗しました: ${err instanceof Error ? err.message : 'unknown error'}`);
        }
        await answerCallbackQuery(callback.id, '提案書を作成中...');
      }
      return;
    }

    // Existing escalation callback handling
    const [action, escalationId] = callback.data.split(':');
    if (!escalationId) return;

    if (action === 'approve') {
      await pool.query(
        "UPDATE escalation_requests SET status = 'approved', resolved_at = NOW() WHERE id = $1 AND status = 'pending'",
        [escalationId],
      );
      console.log(`[TelegramWebhook] Approved escalation: ${escalationId}`);
      await answerCallbackQuery(callback.id, '承認しました');
    } else if (action === 'reject') {
      await pool.query(
        "UPDATE escalation_requests SET status = 'rejected', resolved_at = NOW() WHERE id = $1 AND status = 'pending'",
        [escalationId],
      );
      console.log(`[TelegramWebhook] Rejected escalation: ${escalationId}`);
      await answerCallbackQuery(callback.id, '却下しました');
    }
  }

  async function handleMessage(message: TelegramMessage): Promise<void> {
    const chatId = message.chat.id;
    const text = message.text;
    if (!text) return;

    const response = await handleTradingCommand(dbPool, text);
    if (response) {
      await sendTelegramMessage(chatId, response.text, response.reply_markup);
    }
  }

  async function handleWebhook(body: {
    callback_query?: TelegramCallbackQuery;
    message?: TelegramMessage;
  }) {
    if (body.callback_query) {
      await handleCallback(body.callback_query);
    } else if (body.message) {
      await handleMessage(body.message);
    }
    return { ok: true };
  }

  return { handleWebhook, verifySignature };
}
