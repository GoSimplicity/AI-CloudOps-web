import type {
  PredictionDataPoint,
  PredictionResponse,
} from '#/api/core/aiops/predict';

function explicitTimezone(value: string) {
  return /T.*(?:Z|[+-]\d{2}:\d{2})$/i.test(value);
}

export function formatPredictionTime(timestamp: string | Date, chart = false) {
  if (typeof timestamp === 'string' && !explicitTimezone(timestamp))
    return '未知';
  const date = timestamp instanceof Date ? timestamp : new Date(timestamp);
  if (!Number.isFinite(date.getTime())) return '未知';
  return date.toLocaleString('zh-CN', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    ...(chart ? {} : { second: '2-digit' }),
  });
}

export function forecastPoints(response: PredictionResponse) {
  if (!Number.isFinite(response.current_value))
    throw new Error('预测响应缺少有效当前值');
  if (!Array.isArray(response.predicted_data))
    throw new Error('预测响应缺少时间序列');
  const seen = new Set<number>();
  return response.predicted_data
    .map((point) => {
      if (
        typeof point.timestamp !== 'string' ||
        !explicitTimezone(point.timestamp)
      )
        throw new Error('预测时间戳缺少明确时区，未展示有歧义的结果');
      const time = Date.parse(point.timestamp);
      if (
        !Number.isFinite(time) ||
        !Number.isFinite(point.predicted_value) ||
        seen.has(time)
      )
        throw new Error('预测时间序列包含无效或重复时间、数值，请检查源数据');
      seen.add(time);
      return { time, point };
    })
    .sort((left, right) => left.time - right.time);
}

export function confidenceValues(
  data: PredictionDataPoint[],
  field: 'confidence_lower' | 'confidence_upper',
) {
  return data.map((point) => {
    const value = point[field];
    return typeof value === 'number' && Number.isFinite(value) ? value : null;
  });
}

/** 各序列按同一实际时间轴对齐，缺失为null，不插值、补零或制造当前时间 */
export function alignForecasts(cache: Record<string, PredictionResponse>) {
  const labels: Record<string, string> = {
    qps: 'QPS',
    cpu: 'CPU',
    memory: '内存',
    disk: '磁盘',
  };
  const available = Object.entries(labels).flatMap(([type, name]) => {
    const response = cache[type];
    return response ? [{ type, name, points: forecastPoints(response) }] : [];
  });
  const timeline = [
    ...new Set(
      available.flatMap((item) => item.points.map((point) => point.time)),
    ),
  ].sort((a, b) => a - b);
  return {
    timeline,
    labels: timeline.map((time) => formatPredictionTime(new Date(time), true)),
    series: available
      .filter((item) => item.points.length > 0)
      .map((item) => {
        const values = new Map(
          item.points.map(({ time, point }) => [time, point.predicted_value]),
        );
        return {
          type: item.type,
          name: item.name,
          yAxisIndex: item.type === 'qps' ? 0 : 1,
          data: timeline.map((time) => values.get(time) ?? null),
        };
      }),
  };
}
