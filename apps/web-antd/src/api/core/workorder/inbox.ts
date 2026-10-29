import { requestClient } from '#/api/request';

export interface InboxMessage {
  id: number;
  event_id: number;
  notification_id: number;
  instance_id: number;
  event_type: string;
  subject: string;
  content: string;
  read_at: string | null;
  created_at: string;
}
export interface InboxPermissions { version: number; super_admin: boolean; permissions: string[] }
export const inboxPermissions = {
  list: 'GET /api/workorder/notification/inbox',
  unread: 'GET /api/workorder/notification/inbox/unread',
  read: 'POST /api/workorder/notification/inbox/:id/read',
  readAll: 'POST /api/workorder/notification/inbox/read-all',
  delete: 'DELETE /api/workorder/notification/inbox/:id',
} as const;
export const getInboxPermissions = () => requestClient.get<InboxPermissions>('/user/permissions');
export const getInboxMessages = (params: { page: number; size: number; unread?: boolean }) =>
  requestClient.get<{ items: InboxMessage[]; total: number }>('/workorder/notification/inbox', { params });
export const getInboxUnreadCount = () => requestClient.get<{ unread: number }>('/workorder/notification/inbox/unread');
export const markInboxRead = (id: number) => requestClient.post(`/workorder/notification/inbox/${id}/read`);
export const markAllInboxRead = () => requestClient.post('/workorder/notification/inbox/read-all');
export const deleteInboxMessage = (id: number) => requestClient.delete(`/workorder/notification/inbox/${id}`);
