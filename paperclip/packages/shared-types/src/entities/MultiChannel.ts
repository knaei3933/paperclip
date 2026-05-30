export interface PlatformConfig {
  type: string;
  enabled: boolean;
  config: Record<string, unknown>;
}

export interface ActiveConnection {
  platform: string;
  channelId: string;
  connectedAt: Date;
  metadata: Record<string, unknown>;
}

export interface MultiChannel {
  id: string;
  companyId: string;
  platforms: PlatformConfig[];
  activeConnections: ActiveConnection[];
}
