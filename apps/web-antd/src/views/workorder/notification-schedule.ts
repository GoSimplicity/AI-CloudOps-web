import {
  NotificationTrigger,
  type NotificationTriggerType,
} from '#/api/core/workorder/workorder_notification';

export interface NotificationScheduleForm {
  triggerType: string;
  triggerCondition: string;
  scheduledTime?: { isValid(): boolean; toISOString(): string };
  delayMinutes?: number;
  repeatInterval?: number;
  repeatCount?: number;
}

export interface NotificationSchedulePayload {
  trigger_type: NotificationTriggerType;
  trigger_condition?: Record<string, number>;
  scheduled_time?: string;
  delay_minutes?: number;
  repeat_interval?: number;
  repeat_count?: number;
}

/** 创建与更新共用的白名单校验；条件只匹配工单快照字段 */
export function buildNotificationSchedule(
  form: NotificationScheduleForm,
  now = Date.now(),
): NotificationSchedulePayload {
  const trigger = form.triggerType as NotificationTriggerType;
  const payload: NotificationSchedulePayload = { trigger_type: trigger };
  if (trigger === NotificationTrigger.DELAYED) {
    if (
      !Number.isInteger(form.delayMinutes) ||
      form.delayMinutes! < 1 ||
      form.delayMinutes! > 10080
    )
      throw new Error('延迟分钟须为1至10080的整数');
    payload.delay_minutes = form.delayMinutes;
  } else if (trigger === NotificationTrigger.SCHEDULED) {
    if (!form.scheduledTime?.isValid())
      throw new Error('请选择有效的定时发送时间');
    const scheduled = form.scheduledTime.toISOString();
    const instant = Date.parse(scheduled);
    if (instant <= now || instant > now + 366 * 24 * 60 * 60 * 1000)
      throw new Error('定时发送时间须在未来366天内');
    payload.scheduled_time = scheduled;
  } else if (trigger === NotificationTrigger.CONDITIONAL) {
    let value: unknown;
    try {
      value = JSON.parse(form.triggerCondition);
    } catch {
      throw new Error('条件必须是有效JSON对象');
    }
    if (!value || typeof value !== 'object' || Array.isArray(value))
      throw new Error('条件必须是JSON对象');
    const fields = Object.entries(value);
    if (
      !fields.length ||
      fields.some(
        ([key, number]) =>
          (key !== 'status' && key !== 'priority') ||
          typeof number !== 'number' ||
          !Number.isInteger(number) ||
          number < 1 ||
          number > (key === 'status' ? 6 : 3),
      )
    )
      throw new Error('条件仅支持 status（1至6）和 priority（1至3）的整数');
    payload.trigger_condition = Object.fromEntries(fields) as Record<
      string,
      number
    >;
  } else if (trigger !== NotificationTrigger.IMMEDIATE) {
    throw new Error('不支持的触发类型');
  }
  if ((form.repeatInterval == null) !== (form.repeatCount == null))
    throw new Error('重复间隔与总次数须同时设置');
  if (form.repeatInterval != null && form.repeatCount != null) {
    if (
      !Number.isInteger(form.repeatInterval) ||
      form.repeatInterval < 1 ||
      form.repeatInterval > 10080 ||
      !Number.isInteger(form.repeatCount) ||
      form.repeatCount < 2 ||
      form.repeatCount > 100
    )
      throw new Error('重复间隔须为1至10080分钟，总次数须为2至100');
    payload.repeat_interval = form.repeatInterval;
    payload.repeat_count = form.repeatCount;
  }
  return payload;
}

export function notificationScheduleFingerprint(
  form: NotificationScheduleForm,
): string {
  return JSON.stringify({
    type: form.triggerType,
    condition: form.triggerCondition.trim(),
    scheduled: form.scheduledTime?.isValid()
      ? form.scheduledTime.toISOString()
      : null,
    delay: form.delayMinutes ?? null,
    interval: form.repeatInterval ?? null,
    count: form.repeatCount ?? null,
  });
}
