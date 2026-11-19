import type { CostAnalysis } from '#/api/core/aiops/predict';

export interface PredictionCostView {
  current: string;
  lines: string[];
  predicted: string;
  savings: string;
}

export function formatPredictionAmount(
  value: null | number | undefined,
): string {
  return typeof value === 'number' && Number.isFinite(value)
    ? value.toFixed(2)
    : '未知';
}

function sourceLine(source: CostAnalysis['price_source']): string {
  if (source === 'caller') return '价格来源：调用方单价';
  if (source === 'configured_price') return '价格来源：配置单价';
  return '价格来源：未标明';
}

/** 没有成本对象时不画卡片。旧响应缺来源字段时不称完整或实测。 */
export function describePredictionCost(
  cost: CostAnalysis | null | undefined,
): null | PredictionCostView {
  if (!cost) return null;
  const lines = [sourceLine(cost.price_source)];
  if (cost.priced_components && cost.priced_components.length > 0) {
    lines.push(`已估价资源：${cost.priced_components.join('、')}`);
  }
  if (cost.unpriced_components && cost.unpriced_components.length > 0) {
    lines.push(
      '不完整估算',
      `未估价资源：${cost.unpriced_components.join('、')}`,
    );
  }
  return {
    current: formatPredictionAmount(cost.current_hourly_cost),
    lines,
    predicted: formatPredictionAmount(cost.predicted_hourly_cost),
    savings: formatPredictionAmount(cost.cost_savings_potential),
  };
}
