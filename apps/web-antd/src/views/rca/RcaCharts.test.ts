import { describe, expect, it, vi } from 'vitest';
import * as echarts from 'echarts/core';
import { SVGRenderer } from 'echarts/renderers';
import { shallowMount } from '@vue/test-utils';
import RCAAnalysis from './RCAAnalysis.vue';
import RCADiagnosis from './RCADiagnosis.vue';

vi.mock('@vben/stores', () => ({
  useUserStore: () => ({ userInfo: { userId: '1' } }),
  useAccessStore: () => ({ accessToken: 'offline' }),
}));
vi.mock('#/api/core/aiops/rca', () => ({
  getAllPrometheusMetrics: vi.fn(async () => []),
  analyzeRootCause: vi.fn(),
  quickDiagnosis: vi.fn(),
  getEventPatterns: vi.fn(),
  getErrorSummary: vi.fn(),
}));

describe('RCA真实ECharts按需注册', () => {
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
      renderer: 'svg',
      ssr: true,
      width: 320,
      height: 180,
    });
    try {
      chart.setOption({
        xAxis: { type: 'category', data: ['actual'] },
        yAxis: { type: 'value' },
        series: [
          { type: 'bar', data: [0] },
          { type: 'pie', radius: '20%', data: [{ name: 'actual', value: 1 }] },
        ],
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
