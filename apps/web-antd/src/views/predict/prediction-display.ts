export function formatProbability(value: null | number | undefined) {
  return typeof value === 'number' &&
    Number.isFinite(value) &&
    value >= 0 &&
    value <= 1
    ? `${(value * 100).toFixed(1)}%`
    : '未知';
}

export function formatMeasuredMetric(value: unknown) {
  if (typeof value === 'boolean') return value ? '是' : '否';
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  if (typeof value === 'string' && value.trim()) return value;
  return '—';
}

const metricPaths = [
  ['周期性', ['pattern_analysis', 'has_periodicity']],
  ['日周期', ['pattern_analysis', 'seasonality', 'daily_pattern']],
  ['周周期', ['pattern_analysis', 'seasonality', 'weekly_pattern']],
  ['月周期', ['pattern_analysis', 'seasonality', 'monthly_pattern']],
  ['波动', ['pattern_analysis', 'volatility']],
  [
    '平均值',
    [
      'prediction_interpretation',
      'quantitative_metrics',
      'value_statistics',
      'mean',
    ],
  ],
  [
    '中位数',
    [
      'prediction_interpretation',
      'quantitative_metrics',
      'value_statistics',
      'median',
    ],
  ],
  [
    '变化率',
    [
      'prediction_interpretation',
      'quantitative_metrics',
      'trend_analysis',
      'change_percentage',
    ],
  ],
] as const;

function readPath(source: object, path: readonly string[]) {
  let current: unknown = source;
  for (const key of path) {
    if (current === null || typeof current !== 'object') return;
    current = (current as Record<string, unknown>)[key];
  }
  return current;
}

export function predictionMetricRows(result: object) {
  return metricPaths.map(([label, path]) => ({
    label,
    value: formatMeasuredMetric(readPath(result, path)),
  }));
}
