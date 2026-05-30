import type { EscalationRequest } from '@paperclip/shared-types';
import type { DealStage } from '@paperclip/trading';

export interface TelegramConfig {
  botToken: string;
  chatId: string;
}

const STAGE_LABELS: Record<DealStage, string> = {
  lead: 'リード',
  qualified: '有望',
  proposal: '提案',
  negotiation: '交渉中',
  contract: '契約',
  delivery: '納品',
  installation: '設置',
  complete: '完了',
  as: 'AS',
};

export class TelegramAdapter {
  private config: TelegramConfig;
  private started = false;

  constructor(config: TelegramConfig) {
    this.config = config;
  }

  async start(): Promise<void> {
    if (!this.config.botToken) {
      throw new Error('Telegram bot token is required');
    }
    this.started = true;
  }

  async stop(): Promise<void> {
    this.started = false;
  }

  isRunning(): boolean {
    return this.started;
  }

  async sendEscalation(escalation: EscalationRequest): Promise<void> {
    if (!this.started) return;

    const text = [
      `⚠️ *Escalation: ${escalation.urgency.toUpperCase()}*`,
      `Task: ${escalation.taskId}`,
      `Reason: ${escalation.reason}`,
      `Status: ${escalation.status}`,
    ].join('\n');

    const inlineKeyboard = {
      inline_keyboard: [
        [
          { text: '✅ Approve', callback_data: `approve:${escalation.id}` },
          { text: '❌ Reject', callback_data: `reject:${escalation.id}` },
        ],
      ],
    };

    await this.sendApiMessage(text, inlineKeyboard);
  }

  async sendTaskNotification(task: { id: string; title: string; status: string }, result?: unknown): Promise<void> {
    if (!this.started) return;

    const statusEmoji = task.status === 'completed' ? '✅' : task.status === 'failed' ? '❌' : '🔄';
    const lines = [
      `${statusEmoji} *Task ${task.status.toUpperCase()}*`,
      `Title: ${task.title}`,
      `ID: ${task.id}`,
    ];
    if (result) {
      const resultStr = typeof result === 'string' ? result : JSON.stringify(result);
      const truncated = resultStr.length > 500 ? resultStr.slice(0, 500) + '...' : resultStr;
      lines.push(`Result: ${truncated}`);
    }

    await this.sendText(lines.join('\n'));
  }

  async sendDailyScan(results: Array<{ department: string; tasksCreated: number; summary: string }>): Promise<void> {
    if (!this.started) return;

    const lines = [
      '📋 *Daily Scan Report*',
      `Time: ${new Date().toISOString()}`,
      '',
    ];
    for (const r of results) {
      lines.push(`• *${r.department}*: ${r.tasksCreated} tasks — ${r.summary}`);
    }
    lines.push('', `Total departments scanned: ${results.length}`);

    await this.sendText(lines.join('\n'));
  }

  async sendDealStageNotification(deal: {
    id: string;
    title: string;
    stage: DealStage;
    previousStage?: DealStage;
    customerName?: string;
    amount?: number | null;
  }): Promise<void> {
    if (!this.started) return;

    const fromLabel = deal.previousStage ? STAGE_LABELS[deal.previousStage] : '---';
    const toLabel = STAGE_LABELS[deal.stage];

    const lines = [
      `🔔 *案件ステージ変更*`,
      `案件: ${deal.title}`,
      `ステージ: ${fromLabel} → ${toLabel}`,
    ];
    if (deal.customerName) {
      lines.push(`顧客: ${deal.customerName}`);
    }
    if (deal.amount != null) {
      lines.push(`金額: ¥${deal.amount.toLocaleString()}`);
    }
    lines.push(`ID: ${deal.id}`);

    await this.sendText(lines.join('\n'));
  }

  async sendDealCreatedNotification(deal: {
    id: string;
    title: string;
    stage: DealStage;
    customerName?: string;
    amount?: number | null;
  }): Promise<void> {
    if (!this.started) return;

    const lines = [
      `🆕 *新規案件*`,
      `案件: ${deal.title}`,
      `ステージ: ${STAGE_LABELS[deal.stage]}`,
    ];
    if (deal.customerName) {
      lines.push(`顧客: ${deal.customerName}`);
    }
    if (deal.amount != null) {
      lines.push(`金額: ¥${deal.amount.toLocaleString()}`);
    }
    lines.push(`ID: ${deal.id}`);

    await this.sendText(lines.join('\n'));
  }

  private async sendText(text: string): Promise<void> {
    await this.sendApiMessage(text);
  }

  private async sendApiMessage(text: string, replyMarkup?: unknown): Promise<void> {
    const url = `https://api.telegram.org/bot${this.config.botToken}/sendMessage`;
    const body: Record<string, unknown> = {
      chat_id: this.config.chatId,
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
        console.error(`[Telegram] Failed to send message: ${response.status}`);
      }
    } catch (err) {
      console.error('[Telegram] Error sending message:', err);
    }
  }

  handleCallback(callbackData: string): { action: 'approve' | 'reject'; escalationId: string } | null {
    const [action, id] = callbackData.split(':');
    if ((action === 'approve' || action === 'reject') && id) {
      return { action, escalationId: id };
    }
    return null;
  }
}
