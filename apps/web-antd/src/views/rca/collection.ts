import type { RCACollection } from '#/api/core/aiops/rca';

export function analysisStatus(status?: string) {
  switch (status) {
    case 'completed': {
      return {
        description: '请结合采集范围和证据评估结果。',
        label: '分析完成',
        type: 'success' as const,
      };
    }
    case 'degraded': {
      return {
        description: '部分数据采集失败或不完整，结果仅供参考。',
        label: '分析降级',
        type: 'warning' as const,
      };
    }
    case 'failed': {
      return {
        description: '没有足够的有效采集数据，无法生成可靠分析。',
        label: '分析失败',
        type: 'error' as const,
      };
    }
    default: {
      return {
        description: '服务未提供可识别的分析状态，请核对服务结果。',
        label: '状态未知',
        type: 'warning' as const,
      };
    }
  }
}

export function coverageText(collection?: RCACollection) {
  const value = collection?.coverage;
  return typeof value === 'number' &&
    Number.isFinite(value) &&
    value >= 0 &&
    value <= 1
    ? `${(value * 100).toFixed(1)}%`
    : '未知';
}

export function sourceText(status?: string) {
  switch (status) {
    case 'empty': {
      return '采集成功，数据为空';
    }
    case 'failed': {
      return '采集失败';
    }
    case 'partial': {
      return '部分采集失败';
    }
    case 'success': {
      return '采集成功';
    }
    default: {
      return '状态未知';
    }
  }
}
