import { requestClient } from '#/api/request';

export interface NotificationEvent {
  id: number;
  parent_event_id: number | null;
  notification_id: number | null;
  occurrence: number | null;
  repeat_count: number;
  repeat_minutes: number;
  instance_id: number;
  event_type: string;
  status: string;
  attempts: number;
  next_attempt_at: string;
  created_at: string;
  updated_at: string;
}

export interface NotificationDelivery {
  id: number;
  event_id: number;
  notification_id: number;
  channel: string;
  recipient_hash: string;
  recipient_masked?: string | null;
  status: string;
  attempts: number;
  max_retries: number;
  next_attempt_at: string | null;
}

export interface NotificationResolution {
  id: number;
  delivery_id: number;
  action: string;
  operator_id: number;
  created_at: string;
}

export interface CurrentPermissions {
  version: number;
  super_admin: boolean;
  permissions: string[];
}

export const notificationEventPermissions = {
  list: 'GET /api/workorder/notification/events',
  deliveries: 'GET /api/workorder/notification/events/:id/deliveries',
  resolutions: 'GET /api/workorder/notification/events/:id/resolutions',
  cancel: 'POST /api/workorder/notification/events/:id/cancel',
  retry: 'POST /api/workorder/notification/events/:id/retry',
  resolve: 'POST /api/workorder/notification/events/:id/resolve',
} as const;

export function getCurrentPermissions() {
  return requestClient.get<CurrentPermissions>('/user/permissions');
}

export function listNotificationEvents(params: {
  page: number;
  size: number;
  status?: string;
}) {
  return requestClient.get<{ items: NotificationEvent[]; total: number }>(
    '/workorder/notification/events',
    { params },
  );
}

export function getNotificationDeliveries(id: number) {
  return requestClient.get<NotificationDelivery[]>(
    `/workorder/notification/events/${id}/deliveries`,
  );
}

export function getNotificationResolutions(id: number) {
  return requestClient.get<NotificationResolution[]>(
    `/workorder/notification/events/${id}/resolutions`,
  );
}

export function cancelNotificationEvent(id: number, reason: string) {
  return requestClient.post(`/workorder/notification/events/${id}/cancel`, {
    reason,
  });
}

export function retryNotificationEvent(id: number, reason: string) {
  return requestClient.post(`/workorder/notification/events/${id}/retry`, {
    reason,
  });
}

export function resolveNotificationDelivery(
  id: number,
  deliveryId: number,
  action: 'delivered' | 'retry',
  reason: string,
) {
  return requestClient.post(`/workorder/notification/events/${id}/resolve`, {
    delivery_id: deliveryId,
    action,
    reason,
  });
}
