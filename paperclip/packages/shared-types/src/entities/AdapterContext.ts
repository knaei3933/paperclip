export interface AdapterContext {
  skillHints: string[];
  toolHints: string[];
  memorySummary: string;
  enrichedPrompt: string;
  skillApplied: boolean;
  skillId?: string;
}
