import type {
  CostAnalysis,
  PredictionResponse,
  PredictionServiceHealthResponse,
} from '#/api/core/aiops/predict';

import { describe, expect, it } from 'vitest';

import { describePredictionCost } from './prediction-cost';

function requiredView(view: null | ReturnType<typeof describePredictionCost>) {
  if (!view) throw new Error('成本展示缺失');
  return view;
}

const amounts = {
  cost_savings_potential: 1.5,
  cost_trend_analysis: {},
  current_hourly_cost: 2,
  predicted_hourly_cost: 3.5,
};

const absentObservation: PredictionServiceHealthResponse = {
  error_rate: null,
  model_status: 'unknown',
  models_loaded: [],
  resource_usage: null,
  service_status: 'up',
  supported_prediction_types: [],
  timestamp: '2020-01-02T00:00:00.000Z',
  total_predictions: null,
};
const historyCode: Pick<PredictionResponse, 'fallback_code'> = {
  fallback_code: 'MODEL_HISTORY_INSUFFICIENT',
};

describe('预测成本展示', () => {
  it('旧响应没有新字段时不称完整账单或实测', () => {
    const view = requiredView(
      describePredictionCost({
        ...amounts,
      } as CostAnalysis),
    );
    const text = view.lines.join('\n');
    expect(view.current).toBe('2.00');
    expect(view.predicted).toBe('3.50');
    expect(view.savings).toBe('1.50');
    expect(text).toContain('价格来源：未标明');
    expect(text).not.toContain('完整');
    expect(text).not.toContain('实测');
    expect(text).not.toContain('不完整估算');
  });

  it('无依据的 null 显示未知，显式 0 保留', () => {
    const view = requiredView(
      describePredictionCost({
        cost_savings_potential: 0,
        cost_trend_analysis: {},
        current_hourly_cost: null,
        predicted_hourly_cost: 0,
      }),
    );
    expect(view.current).toBe('未知');
    expect(view.predicted).toBe('0.00');
    expect(view.savings).toBe('0.00');
  });

  it('部分资源未估价时标明不完整估算和来源', () => {
    const view = requiredView(
      describePredictionCost({
        ...amounts,
        estimated: true,
        price_source: 'caller',
        priced_components: ['cpu'],
        unpriced_components: ['disk'],
      }),
    );
    const text = view.lines.join('\n');
    expect(text).toContain('价格来源：调用方单价');
    expect(text).toContain('不完整估算');
    expect(text).toContain('未估价资源：disk');
    expect(text).toContain('已估价资源：cpu');
    expect(text).not.toContain('实测');
  });

  it('配置单价且没有未估价资源时仍不称实测账单', () => {
    const view = requiredView(
      describePredictionCost({
        ...amounts,
        estimated: true,
        price_source: 'configured_price',
        priced_components: ['qps', 'memory'],
        unpriced_components: [],
      }),
    );
    const text = view.lines.join('\n');
    expect(text).toContain('价格来源：配置单价');
    expect(text).toContain('已估价资源：qps、memory');
    expect(text).not.toContain('不完整估算');
    expect(text).not.toContain('实测');
    expect(text).not.toContain('完整账单');
  });

  it('来源为 null 时标明未标明，空约束没有成本卡', () => {
    const view = requiredView(
      describePredictionCost({
        ...amounts,
        price_source: null,
        priced_components: [],
        unpriced_components: [],
      }),
    );
    const omitted: CostAnalysis | undefined = undefined;
    expect(view.lines.join('\n')).toContain('价格来源：未标明');
    expect(describePredictionCost(null)).toBeNull();
    expect(describePredictionCost(omitted)).toBeNull();
    expect(absentObservation.error_rate).toBeNull();
    expect(historyCode.fallback_code).toBe('MODEL_HISTORY_INSUFFICIENT');
  });
});
