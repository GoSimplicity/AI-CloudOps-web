import { describe, expect, it } from 'vitest';
import {
  alignForecasts,
  confidenceValues,
  forecastPoints,
  formatPredictionTime,
} from './prediction-series';
import type { PredictionResponse } from '#/api/core/aiops/predict';
const response = (points: any[]): PredictionResponse =>
  ({ current_value: 0, predicted_data: points }) as PredictionResponse;
const point = (timestamp: string, predicted_value = 0) => ({
  timestamp,
  predicted_value,
});

describe('预测数据展示契约', () => {
  it('使用真实时间排序并保留零和缺失，输入不被排序修改', () => {
    const cpu = response([
      point('2020-01-02T01:00:00Z', 25),
      point('2020-01-02T00:00:00Z', 0),
    ]);
    const before = JSON.stringify(cpu);
    const output = alignForecasts({
      cpu,
      qps: response([point('2020-01-02T02:00:00Z', 8)]),
    });
    expect(output.timeline).toEqual(
      [0, 1, 2].map((hour) => Date.parse(`2020-01-02T0${hour}:00:00Z`)),
    );
    expect(output.series.find((series) => series.type === 'cpu')?.data).toEqual(
      [0, 25, null],
    );
    expect(output.series.find((series) => series.type === 'qps')?.data).toEqual(
      [null, null, 8],
    );
    expect(JSON.stringify(cpu)).toBe(before);
  });
  it.each([
    [point('not-a-date')],
    [point('2020-01-02T00:00:00Z', Number.NaN)],
    [point('2020-01-02T00:00:00Z', Infinity)],
    [point('2020-01-02T00:00:00Z'), point('2020-01-02T08:00:00+08:00')],
  ])('无效或同一时刻重复的预测数据明确拒绝 %j', (...points) => {
    expect(() => forecastPoints(response(points))).toThrow();
  });
  it('空序列不制造时间点或零值', () => {
    expect(alignForecasts({ cpu: response([]) })).toEqual({
      timeline: [],
      labels: [],
      series: [],
    });
  });
  it('缺失置信区间不是零，真实零不是缺失', () => {
    const data = [
      { ...point('2020-01-02T00:00:00Z'), confidence_lower: 0 },
      point('2020-01-02T01:00:00Z', 9),
    ];
    expect(confidenceValues(data, 'confidence_lower')).toEqual([0, null]);
    expect(confidenceValues(data, 'confidence_upper')).toEqual([null, null]);
  });
  it('无效日期显示未知，不产生Invalid Date', () => {
    expect(formatPredictionTime('invalid')).toBe('未知');
  });
  it('拒绝缺少时区的预测点，不按浏览器本地时区猜测', () => {
    expect(() =>
      forecastPoints(response([point('2026-10-23T00:00:00')])),
    ).toThrow('时区');
  });
  it('缺少时区的文本时间显示未知，明确offset仍可展示', () => {
    expect(formatPredictionTime('2026-10-23T00:00:00')).toBe('未知');
    expect(formatPredictionTime('2026-10-23T08:00:00+08:00')).toBe(
      formatPredictionTime('2026-10-23T00:00:00Z'),
    );
  });
});
