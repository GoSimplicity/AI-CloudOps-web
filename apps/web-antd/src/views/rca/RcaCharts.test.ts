import { shallowMount } from '@vue/test-utils';
import * as echarts from 'echarts/core';
import { SVGRenderer } from 'echarts/renderers';
import { describe, expect, it, vi } from 'vitest';

import RCAAnalysis from './RCAAnalysis.vue';
import RCADiagnosis from './RCADiagnosis.vue';

vi.mock('@vben/stores', () => ({
  useAccessStore: () => ({ accessToken: 'offline' }),
  useUserStore: () => ({ userInfo: { userId: '1' } }),
}));
vi.mock('#/api/core/aiops/rca', () => ({
  analyzeRootCause: vi.fn(),
  getAllPrometheusMetrics: vi.fn(async () => []),
  getErrorSummary: vi.fn(),
  getEventPatterns: vi.fn(),
  quickDiagnosis: vi.fn(),
}));

describe('rCA真实ECharts按需注册', () => {
  it('实际柱图和饼图可渲染，不依赖未注册图表的空画布', () => {
    const errors = vi.spyOn(console, 'error').mockImplementation(() => {});
    // jsdom没有Canvas字体测量，图表仍使用真实ECharts/SVG渲染
    const measure = vi
      .spyOn(HTMLCanvasElement.prototype, 'getContext')
      .mockReturnValue({
        measureText: (text: string) => ({ width: String(text).length * 7 }),
      } as any);
    const wrappers = [RCAAnalysis, RCADiagnosis].map((component) =>
      shallowMount(component, {
        global: { config: { warnHandler: () => {} } },
      }),
    );
    echarts.use(SVGRenderer);
    const chart = echarts.init(null, undefined, {
      height: 180,
      renderer: 'svg',
      ssr: true,
      width: 320,
    });
    try {
      chart.setOption({
        series: [
          { data: [0], type: 'bar' },
          { data: [{ name: 'actual', value: 1 }], radius: '20%', type: 'pie' },
        ],
        xAxis: { data: ['actual'], type: 'category' },
        yAxis: { type: 'value' },
      });
      expect(chart.renderToSVGString()).toContain('<path');
      expect(errors).not.toHaveBeenCalled();
    } finally {
      chart.dispose();
      wrappers.forEach((wrapper) => wrapper.unmount());
      measure.mockRestore();
      errors.mockRestore();
    }
  });
});
