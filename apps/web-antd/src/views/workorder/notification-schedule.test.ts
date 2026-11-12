import dayjs from 'dayjs';
import { describe, expect, it } from 'vitest';

import {
  buildNotificationSchedule,
  notificationScheduleFingerprint,
} from './notification-schedule';

const base = { triggerCondition: '', triggerType: 'immediate' };

describe('通知排期合同', () => {
  it('支持即时、延迟、UTC定时和有限重复', () => {
    expect(buildNotificationSchedule(base)).toEqual({
      trigger_type: 'immediate',
    });
    expect(
      buildNotificationSchedule({
        ...base,
        delayMinutes: 15,
        repeatCount: 3,
        repeatInterval: 10,
        triggerType: 'delayed',
      }),
    ).toEqual({
      delay_minutes: 15,
      repeat_count: 3,
      repeat_interval: 10,
      trigger_type: 'delayed',
    });
    const time = dayjs('2030-01-02T12:30:00+08:00');
    expect(
      buildNotificationSchedule(
        { ...base, scheduledTime: time, triggerType: 'scheduled' },
        Date.parse('2030-01-01T00:00:00Z'),
      ).scheduled_time,
    ).toBe('2030-01-02T04:30:00.000Z');
  });
  it('只接受工单状态与优先级的整数白名单', () => {
    expect(
      buildNotificationSchedule({
        ...base,
        triggerCondition: '{"status":2,"priority":1}',
        triggerType: 'conditional',
      }).trigger_condition,
    ).toEqual({ priority: 1, status: 2 });
    for (const value of [
      '{}',
      '{"status":1.5}',
      '{"priority":4}',
      '{"script":"run"}',
      '[]',
      '{',
    ]) {
      expect(() =>
        buildNotificationSchedule({
          ...base,
          triggerCondition: value,
          triggerType: 'conditional',
        }),
      ).toThrow();
    }
  });
  it('拒绝不完整或越界排期并识别配置变更', () => {
    for (const form of [
      { ...base, triggerType: 'delayed' },
      { ...base, delayMinutes: 0, triggerType: 'delayed' },
      { ...base, repeatInterval: 1 },
      { ...base, repeatCount: 101, repeatInterval: 1 },
      { ...base, triggerType: 'scheduled' },
    ])
      expect(() => buildNotificationSchedule(form)).toThrow();
    expect(notificationScheduleFingerprint(base)).not.toBe(
      notificationScheduleFingerprint({
        ...base,
        repeatCount: 2,
        repeatInterval: 2,
      }),
    );
  });
});
