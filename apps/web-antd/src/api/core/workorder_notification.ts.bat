import { requestClient } from '#/api/request';

// 通知状态枚举
export enum NotificationStatus {
  ENABLED = 'enabled',
  DISABLED = 'disabled'
}

// 通知渠道枚举
export enum NotificationChannel {
  FEISHU = 'feishu',
  EMAIL = 'email',
  DINGTALK = 'dingtalk',
  WECHAT = 'wechat'
}

// 通知触发类型枚举
export enum NotificationTrigger {
  MANUAL = 'manual',
  IMMEDIATE = 'immediate',
  SCHEDULED = 'scheduled'
}

// 通知渠道类型
export type NotificationChannelType = NotificationChannel;

// 通知触发类型
export type NotificationTriggerType = NotificationTrigger;

// 通知配置接口
export interface Notification {
  id: number;
  formId: number;
  formUrl?: string;
  channels: NotificationChannelType[];
  recipients: string[];
  messageTemplate?: string;
  triggerType: NotificationTriggerType;
  scheduledTime?: string;
  status: NotificationStatus;
  sentCount?: number;
  lastSent?: string;
  createdAt: string;
  updatedAt?: string;
  statusLoading?: boolean;
}

// 通知日志接口
export interface NotificationLog {
  id: string;
  notificationId: string;
  channel: NotificationChannelType;
  recipient: string;
  message: string;
  status: string;
  sentAt: string;
  error?: string;
}

// 创建通知请求接口
export interface CreateNotificationReq {
  formId: number;
  formUrl?: string;
  channels: NotificationChannelType[];
  recipients: string[];
  messageTemplate?: string;
  triggerType: NotificationTriggerType;
  scheduledTime?: string;
  status?: NotificationStatus;
}

// 更新通知请求接口
export interface UpdateNotificationReq {
  id: number;
  formUrl?: string;
  channels?: NotificationChannelType[];
  recipients?: string[];
  messageTemplate?: string;
  triggerType?: NotificationTriggerType;
  scheduledTime?: string;
  status?: NotificationStatus;
}

// 获取通知列表请求接口
export interface ListNotificationReq {
  page?: number;
  pageSize?: number;
  search?: string;
  channel?: NotificationChannelType;
  status?: NotificationStatus;
  formId?: number;
}

// 获取发送日志请求接口
export interface ListSendLogReq {
  page?: number;
  pageSize?: number;
  notificationId?: string;
  channel?: NotificationChannelType;
  status?: string;
  startTime?: string;
  endTime?: string;
}

// API 函数声明
export const getNotificationList = (params: ListNotificationReq) => {
  return requestClient.get('/workorder/notifications', { params });
};

export const getNotificationDetail = (id: number) => {
  return requestClient.get(`/workorder/notifications/${id}`);
};

export const createNotification = (data: CreateNotificationReq) => {
  return requestClient.post('/workorder/notifications', data);
};

export const updateNotification = (data: UpdateNotificationReq) => {
  return requestClient.put(`/workorder/notifications/${data.id}`, data);
};

export const deleteNotification = (id: number) => {
  return requestClient.delete(`/workorder/notifications/${id}`);
};

export const updateNotificationStatus = (id: number, status: NotificationStatus) => {
  return requestClient.put(`/workorder/notifications/${id}/status`, { status });
};

export const getNotificationStats = () => {
  return requestClient.get('/workorder/notifications/stats');
};

export const getSendLogs = (params: ListSendLogReq) => {
  return requestClient.get('/workorder/notifications/logs', { params });
};

export const testSendNotification = (id: number) => {
  return requestClient.post(`/workorder/notifications/${id}/test`);
};

export const duplicateNotification = (id: number) => {
  return requestClient.post(`/workorder/notifications/${id}/duplicate`);
};
