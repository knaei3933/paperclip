export interface CostModel {
  /** Cost per 1K prompt tokens in USD */
  promptCostPer1K: number;
  /** Cost per 1K completion tokens in USD */
  completionCostPer1K: number;
}

export const DEFAULT_COST_MODELS: Record<string, CostModel> = {
  'claude-sonnet': { promptCostPer1K: 0.003, completionCostPer1K: 0.015 },
  'claude-opus': { promptCostPer1K: 0.015, completionCostPer1K: 0.075 },
  'claude-haiku': { promptCostPer1K: 0.00025, completionCostPer1K: 0.00125 },
  'generic': { promptCostPer1K: 0.002, completionCostPer1K: 0.008 },
};
