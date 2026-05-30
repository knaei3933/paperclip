export type EscalationStatus = 'pending' | 'approved' | 'rejected' | 'expired';
export type EscalationUrgency = 'low' | 'medium' | 'high' | 'critical';

export interface EscalationRequest {
  id: string;
  taskId: string;
  reason: string;
  urgency: EscalationUrgency;
  channel: string;
  status: EscalationStatus;
  createdAt: Date;
  resolvedAt: Date | null;
}
