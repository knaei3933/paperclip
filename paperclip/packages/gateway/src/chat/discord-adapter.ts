import type { EscalationRequest } from '@paperclip/shared-types';

export interface DiscordConfig {
  botToken: string;
  channelId: string;
}

export class DiscordAdapter {
  private config: DiscordConfig;
  private started = false;

  constructor(config: DiscordConfig) {
    this.config = config;
  }

  async start(): Promise<void> {
    if (!this.config.botToken) {
      throw new Error('Discord bot token is required');
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

    const embed = {
      title: `Escalation: ${escalation.urgency.toUpperCase()}`,
      description: [
        `**Task:** ${escalation.taskId}`,
        `**Reason:** ${escalation.reason}`,
        `**Status:** ${escalation.status}`,
      ].join('\n'),
      color: escalation.urgency === 'critical' ? 0xff0000 : 0xffaa00,
      timestamp: escalation.createdAt.toISOString(),
    };

    const url = `https://discord.com/api/v10/channels/${this.config.channelId}/messages`;
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bot ${this.config.botToken}`,
        },
        body: JSON.stringify({
          embeds: [embed],
        }),
      });
      if (!response.ok) {
        console.error(`[Discord] Failed to send message: ${response.status}`);
        return;
      }

      // Add reaction-based approval
      const msgData = await response.json() as { id: string };
      const reactionsUrl = `https://discord.com/api/v10/channels/${this.config.channelId}/messages/${msgData.id}/reactions`;
      // Add thumbs up for approve
      await fetch(`${reactionsUrl}/%F0%9F%91%8D/@me`, {
        method: 'PUT',
        headers: { Authorization: `Bot ${this.config.botToken}` },
      });
      // Add thumbs down for reject
      await fetch(`${reactionsUrl}/%F0%9F%91%8E/@me`, {
        method: 'PUT',
        headers: { Authorization: `Bot ${this.config.botToken}` },
      });
    } catch (err) {
      console.error('[Discord] Error sending escalation:', err);
    }
  }

  handleReaction(emoji: { name: string }, userId: string): { action: 'approve' | 'reject' } | null {
    // Ignore bot's own reactions
    if (emoji.name === '👍') {
      return { action: 'approve' };
    }
    if (emoji.name === '👎') {
      return { action: 'reject' };
    }
    return null;
  }
}
