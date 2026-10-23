import { describe, expect, it } from 'vitest';

import {
  getActionLabel,
  getRiskTagColor,
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
