import { describe, expect, it, vi } from 'vitest';

import {
  getActionIcon,
  getActionLabel,
  getFaultLabel,
  getRiskTagColor,
  getStatusLabel,
  getStatusTagColor,
  normalizeWorkflowResult,
} from './autofix-format';

describe('autofix-format', () => {
  it('maps workflow status and action names to stable display values', () => {
    expect(getStatusTagColor('completed')).toBe('green');
    expect(getStatusTagColor('needs_human_confirmation')).toBe('orange');
    expect(getActionLabel('patch_image_pull_policy')).toBe('调整镜像拉取策略');
    expect(getActionLabel('restart_deployment')).toBe('重启Deployment');
  });

  it('maps risk levels and normalizes missing workflow fields', () => {
    expect(getRiskTagColor('low')).toBe('green');
    expect(getRiskTagColor('medium')).toBe('orange');
    expect(getRiskTagColor('high')).toBe('red');

    const result = normalizeWorkflowResult({
      status: 'completed',
      plan: {
        fault_type: 'image_pull_failure',
        candidate_actions: [
          {
            action_id: 'patch-image-pull-policy',
            action_type: 'patch_image_pull_policy',
            risk_assessment: { allowed: true, risk_level: 'low' },
          },
        ],
      },
    });

    expect(result.agents_used).toEqual([]);
    expect(result.candidate_actions).toHaveLength(1);
    expect(result.fault_type).toBe('image_pull_failure');
  });
});

it('does not invent a workflow completion state or timestamp', () => {
  const result = normalizeWorkflowResult({});
  expect(result.status).toBe('unknown');
  expect(result.timestamp).toBe('');
  expect(result.next_action).toBe('');
});

function hasPrototypeAccessor(value: object): value is { __proto__: unknown } {
  return (
    typeof Object.getOwnPropertyDescriptor(value, '__proto__')?.get ===
    'function'
  );
}

const displayCases = [
  [
    'status colour',
    getStatusTagColor,
    'running',
    'processing',
    'default',
    'default',
  ],
  ['risk colour', getRiskTagColor, 'high', 'red', 'default', 'default'],
  ['status label', getStatusLabel, 'completed', '已完成', null, '未知'],
  [
    'fault label',
    getFaultLabel,
    'image_pull_failure',
    '镜像拉取失败',
    null,
    '未知故障',
  ],
  [
    'action label',
    getActionLabel,
    'inspect_logs',
    '查看日志',
    null,
    '未知动作',
  ],
  [
    'action icon',
    getActionIcon,
    'inspect_logs',
    'lucide:file-search',
    'lucide:wrench',
    'lucide:wrench',
  ],
] as const;

it.each(displayCases)(
  '%s keeps owned values and routes unknown prototype names through the original fallback',
  (_name, format, knownKey, knownValue, fallback, emptyFallback) => {
    expect(format(knownKey)).toBe(knownValue);
    expect(format('')).toBe(emptyFallback);
    expect(format()).toBe(emptyFallback);
    for (const key of [
      'constructor',
      '__proto__',
      'toString',
      'future_status',
    ]) {
      expect(format(key)).toBe(fallback ?? key);
    }
  },
);

it.each(displayCases)(
  '%s never invokes an inherited lookup getter',
  (_name, format, _knownKey, _knownValue, fallback) => {
    const key = '__proto__';
    const prototype: object = Object.prototype;
    if (!hasPrototypeAccessor(prototype)) {
      throw new Error('Expected inherited prototype accessor fixture');
    }
    const inheritedGetter = vi.spyOn(prototype, key, 'get');
    try {
      expect(format(key)).toBe(fallback ?? key);
      expect(inheritedGetter).not.toHaveBeenCalled();
    } finally {
      inheritedGetter.mockRestore();
    }
  },
);
