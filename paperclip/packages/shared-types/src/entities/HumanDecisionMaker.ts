export interface HumanDecisionMaker {
  id: string;
  name: string;
  role: string;
  approvalThresholds: ApprovalThreshold[];
  preferredChannels: string[];
}

export interface ApprovalThreshold {
  id: string;
  dimension: 'budget' | 'risk' | 'sensitivity' | 'authority';
  value: number;
  timeoutMs: number;
  timeoutAction: 'auto_reject';
  scope: string;
}
