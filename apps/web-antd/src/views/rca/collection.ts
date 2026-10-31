import type { RCACollection } from '#/api/core/aiops/rca';

export function analysisStatus(status?: string) {
  switch (status) {
    case 'completed': {
      return {
        label: '分析完成',
        type: 'success' as const,
        description: '请结合采集范围和证据评估结果。',
      };
    }
    case 'degraded': {
      return {
        label: '分析降级',
        type: 'warning' as const,
        description: '部分数据采集失败或不完整，结果仅供参考。',
      };
    }
    case 'failed': {
      return {
        label: '分析失败',
        type: 'error' as const,
        description: '没有足够的有效采集数据，无法生成可靠分析。',
      };
    }
    default: {
      return {
        label: '状态未知',
        type: 'warning' as const,
        description: '服务未提供可识别的分析状态，请核对服务结果。',
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
    case 'success': {
      return '采集成功';
    }
    case 'empty': {
      return '采集成功，数据为空';
    }
    case 'partial': {
      return '部分采集失败';
    }
    case 'failed': {
      return '采集失败';
    }
    default: {
      return '状态未知';
    }
  }
}
