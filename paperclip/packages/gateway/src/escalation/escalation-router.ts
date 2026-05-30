import type { EscalationRequest, EscalationUrgency, EventBus, AppDomainEvent } from '@paperclip/shared-types';
import type { TelegramAdapter } from '../chat/telegram-adapter.js';
import type { SlackAdapter } from '../chat/slack-adapter.js';
import type { DiscordAdapter } from '../chat/discord-adapter.js';

export interface ChannelPreference {
  channel: 'telegram' | 'slack' | 'discord';
  minUrgency: EscalationUrgency;
}

const URGENCY_ORDER: Record<EscalationUrgency, number> = {
  low: 0,
  medium: 1,
  high: 2,
  critical: 3,
};

export class EscalationRouter {
  private telegram: TelegramAdapter | null = null;
  private slack: SlackAdapter | null = null;
  private discord: DiscordAdapter | null = null;
  private preferences: ChannelPreference[] = [
    { channel: 'telegram', minUrgency: 'low' },
    { channel: 'slack', minUrgency: 'medium' },
    { channel: 'discord', minUrgency: 'high' },
  ];

  setAdapters(adapters: {
    telegram?: TelegramAdapter | null;
    slack?: SlackAdapter | null;
    discord?: DiscordAdapter | null;
  }): void {
    this.telegram = adapters.telegram ?? null;
    this.slack = adapters.slack ?? null;
    this.discord = adapters.discord ?? null;
  }

  setChannelPreference(prefs: ChannelPreference[]): void {
    this.preferences = prefs;
  }

  getActiveChannels(): string[] {
    const channels: string[] = [];
    if (this.telegram?.isRunning()) channels.push('telegram');
    if (this.slack?.isRunning()) channels.push('slack');
    if (this.discord?.isRunning()) channels.push('discord');
    return channels;
  }

  async routeEscalation(escalation: EscalationRequest): Promise<string[]> {
    const notified: string[] = [];
    const urgencyLevel = URGENCY_ORDER[escalation.urgency];

    for (const pref of this.preferences) {
      if (URGENCY_ORDER[pref.minUrgency] > urgencyLevel) continue;

      try {
        if (pref.channel === 'telegram' && this.telegram?.isRunning()) {
          await this.telegram.sendEscalation(escalation);
          notified.push('telegram');
        } else if (pref.channel === 'slack' && this.slack?.isRunning()) {
          await this.slack.sendEscalation(escalation);
          notified.push('slack');
        } else if (pref.channel === 'discord' && this.discord?.isRunning()) {
          await this.discord.sendEscalation(escalation);
          notified.push('discord');
        }
      } catch (err) {
        console.error(`[EscalationRouter] Failed to route to ${pref.channel}:`, err);
      }
    }

    return notified;
  }

  async routeTaskNotification(task: { id: string; title: string; status: string }, result?: unknown): Promise<void> {
    if (this.telegram?.isRunning()) {
      await this.telegram.sendTaskNotification(task, result);
    }
  }

  async routeDailyScan(results: Array<{ department: string; tasksCreated: number; summary: string }>): Promise<void> {
    if (this.telegram?.isRunning()) {
      await this.telegram.sendDailyScan(results);
    }
  }

  subscribeToEvents(eventBus: EventBus): void {
    eventBus.on('TaskCompleted', (event) => {
      const { taskId, result } = (event as any).payload as { taskId: string; result: unknown };
      this.routeTaskNotification({ id: taskId, title: 'Task completed', status: 'completed' }, result).catch(() => {});
    });
    eventBus.on('TaskFailed', (event) => {
      const { taskId, error } = (event as any).payload as { taskId: string; error: string };
      this.routeTaskNotification({ id: taskId, title: 'Task failed', status: 'failed' }, error).catch(() => {});
    });
  }
}
