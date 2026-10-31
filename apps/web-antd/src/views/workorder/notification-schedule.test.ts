import dayjs from 'dayjs';
import { describe, expect, it } from 'vitest';
import {
  buildNotificationSchedule,
  notificationScheduleFingerprint,
} from './notification-schedule';

const base = { triggerType: 'immediate', triggerCondition: '' };

describe('通知排期合同', () => {
  it('支持即时、延迟、UTC定时和有限重复', () => {
    expect(buildNotificationSchedule(base)).toEqual({
      trigger_type: 'immediate',
    });
    expect(
      buildNotificationSchedule({
        ...base,
        triggerType: 'delayed',
        delayMinutes: 15,
        repeatInterval: 10,
        repeatCount: 3,
      }),
    ).toEqual({
      trigger_type: 'delayed',
      delay_minutes: 15,
      repeat_interval: 10,
      repeat_count: 3,
    });
    const time = dayjs('2030-01-02T12:30:00+08:00');
    expect(
      buildNotificationSchedule(
        { ...base, triggerType: 'scheduled', scheduledTime: time },
        Date.parse('2030-01-01T00:00:00Z'),
      ).scheduled_time,
    ).toBe('2030-01-02T04:30:00.000Z');
  });
  it('只接受工单状态与优先级的整数白名单', () => {
    expect(
      buildNotificationSchedule({
        ...base,
        triggerType: 'conditional',
        triggerCondition: '{"status":2,"priority":1}',
      }).trigger_condition,
    ).toEqual({ status: 2, priority: 1 });
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
          triggerType: 'conditional',
          triggerCondition: value,
        }),
      ).toThrow();
    }
  });
  it('拒绝不完整或越界排期并识别配置变更', () => {
    for (const form of [
      { ...base, triggerType: 'delayed', delayMinutes: 0 },
      { ...base, repeatInterval: 1 },
      { ...base, repeatInterval: 1, repeatCount: 101 },
      { ...base, triggerType: 'scheduled' },
    ])
      expect(() => buildNotificationSchedule(form)).toThrow();
    expect(notificationScheduleFingerprint(base)).not.toBe(
      notificationScheduleFingerprint({
        ...base,
        repeatInterval: 2,
        repeatCount: 2,
      }),
    );
  });
});
