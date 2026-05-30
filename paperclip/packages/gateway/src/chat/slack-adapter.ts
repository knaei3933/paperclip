import type { EscalationRequest } from '@paperclip/shared-types';

export interface SlackConfig {
  botToken: string;
  channelId: string;
}

export class SlackAdapter {
  private config: SlackConfig;
  private started = false;

  constructor(config: SlackConfig) {
    this.config = config;
  }

  async start(): Promise<void> {
    if (!this.config.botToken) {
      throw new Error('Slack bot token is required');
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

    const blocks = [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*Escalation: ${escalation.urgency.toUpperCase()}*\nTask: \`${escalation.taskId}\`\nReason: ${escalation.reason}`,
        },
      },
      {
        type: 'actions',
        elements: [
          {
            type: 'button',
            text: { type: 'plain_text', text: 'Approve' },
            style: 'primary',
            action_id: `approve_${escalation.id}`,
            value: escalation.id,
          },
          {
            type: 'button',
            text: { type: 'plain_text', text: 'Reject' },
            style: 'danger',
            action_id: `reject_${escalation.id}`,
            value: escalation.id,
          },
        ],
      },
    ];

    const url = 'https://slack.com/api/chat.postMessage';
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.config.botToken}`,
        },
        body: JSON.stringify({
          channel: this.config.channelId,
          blocks,
        }),
      });
      if (!response.ok) {
        console.error(`[Slack] Failed to send message: ${response.status}`);
      }
    } catch (err) {
      console.error('[Slack] Error sending escalation:', err);
    }
  }

  handleAction(actionId: string, value: string): { action: 'approve' | 'reject'; escalationId: string } | null {
    if (actionId.startsWith('approve_')) {
      return { action: 'approve', escalationId: value };
    }
    if (actionId.startsWith('reject_')) {
      return { action: 'reject', escalationId: value };
    }
    return null;
  }
}
