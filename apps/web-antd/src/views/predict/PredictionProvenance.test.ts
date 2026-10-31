import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import type { PredictionResponse } from '#/api/core/aiops/predict';
import PredictionProvenance from './PredictionProvenance.vue';
import { formatProbability } from './prediction-display';

const result = (fields: Partial<PredictionResponse>) =>
  fields as PredictionResponse;

describe('预测来源展示', () => {
  it('规则与 AI 可以各自降级，未知模型版本不伪造', () => {
    const wrapper = mount(PredictionProvenance, {
      props: {
        aiRequested: true,
        result: result({
          method: 'rule_based',
          model_version: null,
          fallback_mode: true,
          fallback_reason: '预测模型不可用',
          ai_enhanced: false,
          ai_fallback_reason: 'AI分析未完成',
          analysis_failures: ['成本分析失败'],
        }),
      },
    });
    expect(wrapper.text()).toContain('预测方式：规则降级');
    expect(wrapper.text()).toContain('模型版本：未知');
    expect(wrapper.text()).toContain('模型降级：预测模型不可用');
    expect(wrapper.text()).toContain('AI 分析未完成：AI分析未完成');
    expect(wrapper.text()).toContain('成本分析失败');
  });
  it('模型正常但 AI 未完成不会误称模型降级', () => {
    const wrapper = mount(PredictionProvenance, {
      props: {
        aiRequested: true,
        result: result({
          method: 'model:Example',
          model_version: 'v1',
          ai_enhanced: false,
          ai_fallback_reason: 'AI分析未完成',
        }),
      },
    });
    expect(wrapper.text()).toContain('预测方式：模型预测');
    expect(wrapper.text()).toContain('模型版本：v1');
    expect(wrapper.text()).toContain('AI 分析未完成');
    expect(wrapper.text()).not.toContain('模型降级');
  });
  it('缺失来源不会猜测模型预测，未启用与已完成分别显示', async () => {
    const wrapper = mount(PredictionProvenance, {
      props: { aiRequested: false, result: result({}) },
    });
    expect(wrapper.text()).toContain('预测方式：未知');
    expect(wrapper.text()).toContain('AI 分析：未启用');
    await wrapper.setProps({ result: result({ ai_enhanced: true }) });
    expect(wrapper.text()).toContain('AI 分析：已完成');
  });
  it('真实零保留，缺失、非有限及超范围值显示未知', () => {
    expect(formatProbability(0)).toBe('0.0%');
    expect(formatProbability(0.8)).toBe('80.0%');
    for (const value of [null, undefined, NaN, Infinity, -0.1, 1.1])
      expect(formatProbability(value)).toBe('未知');
  });
});
