import { requestClient } from '#/api/request';

// 工单事件类型常量
export const WorkorderEventTypes = {
  INSTANCE_CREATED: 'instance_created',   // 工单创建
  INSTANCE_SUBMITTED: 'instance_submitted', // 工单提交
  INSTANCE_ASSIGNED: 'instance_assigned',  // 工单指派
  INSTANCE_APPROVED: 'instance_approved',  // 工单审批通过
  INSTANCE_REJECTED: 'instance_rejected',  // 工单拒绝
  INSTANCE_COMPLETED: 'instance_completed', // 工单完成
  INSTANCE_CANCELLED: 'instance_cancelled', // 工单取消
  INSTANCE_UPDATED: 'instance_updated',   // 工单更新
  INSTANCE_COMMENTED: 'instance_commented', // 工单评论
  INSTANCE_DELETED: 'instance_deleted',   // 工单删除
  INSTANCE_RETURNED: 'instance_returned',  // 工单退回
} as const;

// 通知状态常量
export const NotificationStatus = {
  Enabled: 1,   // 启用
  Disabled: 2,  // 禁用
} as const;

// 优先级常量
export const NotificationPriority = {
  High: 1,     // 高
  Medium: 2,   // 中
  Low: 3,      // 低
} as const;

// 是否默认配置常量
export const IsDefault = {
  Yes: 1,  // 是
  No: 2,   // 否
} as const;

// 通知渠道常量
export const NotificationChannel = {
  EMAIL: 'email',       // 邮箱
  FEISHU: 'feishu',     // 飞书
  SMS: 'sms',           // 短信
  WEBHOOK: 'webhook',   // Webhook
} as const;

// 触发类型常量
export const NotificationTrigger = {
  IMMEDIATE: 'immediate',     // 立即触发
  DELAYED: 'delayed',         // 延迟触发
  SCHEDULED: 'scheduled',     // 定时触发
  CONDITIONAL: 'conditional', // 条件触发
} as const;

// 接收人类型常量
export const RecipientTypes = {
  CREATOR: 'creator',   // 工单创建人
  ASSIGNEE: 'assignee', // 工单处理人
  USER: 'user',         // 指定用户
  ROLE: 'role',         // 角色用户
  DEPT: 'dept',         // 部门用户
  CUSTOM: 'custom',     // 自定义用户
} as const;

// 发送状态常量
export const SendStatus = {
  Pending: 1,    // 待发送
  Sending: 2,    // 发送中
  Success: 3,    // 发送成功
  Failed: 4,     // 发送失败
  Cancelled: 5,  // 已取消
} as const;

// 队列状态常量
export const QueueStatus = {
  Pending: 1,     // 待处理
  Processing: 2,  // 处理中
  Success: 3,     // 处理成功
  Failed: 4,      // 处理失败
} as const;

// 通知任务类型常量
export const TaskTypes = {
  SEND_NOTIFICATION: 'notification:send',
  BATCH_SEND_NOTIFICATION: 'notification:batch_send',
  SCHEDULED_NOTIFICATION: 'notification:scheduled',
  RETRY_FAILED_NOTIFICATION: 'notification:retry_failed',
} as const;

// 流程动作常量
export const FlowActions = {
  UPDATE: 'update',   // 更新
  COMMENT: 'comment', // 评论
} as const;

// 类型定义
export type WorkorderEventType = typeof WorkorderEventTypes[keyof typeof WorkorderEventTypes];
export type NotificationChannelType = typeof NotificationChannel[keyof typeof NotificationChannel];
export type NotificationTriggerType = typeof NotificationTrigger[keyof typeof NotificationTrigger];
export type NotificationStatusType = typeof NotificationStatus[keyof typeof NotificationStatus];
export type RecipientType = typeof RecipientTypes[keyof typeof RecipientTypes];
export type SendStatusType = typeof SendStatus[keyof typeof SendStatus];
export type QueueStatusType = typeof QueueStatus[keyof typeof QueueStatus];
export type TaskType = typeof TaskTypes[keyof typeof TaskTypes];
export type FlowActionType = typeof FlowActions[keyof typeof FlowActions];

// 简化别名，方便组件使用
export type Notification = WorkorderNotificationItem;
export type NotificationLog = WorkorderNotificationLogItem;
export type NotificationQueue = WorkorderNotificationQueueItem;

// 工单通知配置
export interface WorkorderNotificationItem {
  id: number; // ID
  created_at: string; // 创建时间
  updated_at: string; // 更新时间
  name: string; // 通知配置名称
  description: string; // 通知配置描述
  process_id?: number; // 关联流程ID
  template_id?: number; // 关联模板ID
  category_id?: number; // 关联分类ID
  event_types: string[]; // 触发事件类型
  trigger_type: string; // 触发类型
  trigger_condition?: Record<string, any>; // 触发条件
  channels: string[]; // 通知渠道
  recipient_types: string[]; // 接收人类型
  recipient_users?: string[]; // 自定义接收人用户ID
  recipient_roles?: string[]; // 接收人角色ID
  recipient_depts?: string[]; // 接收人部门ID
  message_template: string; // 消息模板
  subject_template?: string; // 主题模板
  scheduled_time?: string; // 定时发送时间
  repeat_interval?: number; // 重复间隔(分钟)
  max_retries: number; // 最大重试次数
  retry_interval: number; // 重试间隔(分钟)
  status: number; // 状态
  priority: number; // 优先级
  operator_id: number; // 操作人ID
  is_default: number; // 是否默认配置：1-是，2-否
  settings?: Record<string, any>; // 通知设置
}

// 创建工单通知配置请求
export interface CreateNotificationReq {
  name: string; // 通知配置名称
  description?: string; // 通知配置描述
  process_id?: number; // 关联流程ID
  template_id?: number; // 关联模板ID
  category_id?: number; // 关联分类ID
  event_types: string[]; // 触发事件类型
  trigger_type: string; // 触发类型
  trigger_condition?: Record<string, any>; // 触发条件
  channels: string[]; // 通知渠道
  recipient_types: string[]; // 接收人类型
  recipient_users?: string[]; // 自定义接收人用户ID
  recipient_roles?: string[]; // 接收人角色ID
  recipient_depts?: string[]; // 接收人部门ID
  message_template: string; // 消息模板
  subject_template?: string; // 主题模板
  scheduled_time?: string; // 定时发送时间
  repeat_interval?: number; // 重复间隔(分钟)
  max_retries?: number; // 最大重试次数
  retry_interval?: number; // 重试间隔(分钟)
  status?: number; // 状态
  priority?: number; // 优先级
  is_default?: number; // 是否默认配置：1-是，2-否
  settings?: Record<string, any>; // 通知设置
}

// 更新工单通知配置请求
export interface UpdateNotificationReq {
  id: number; // ID
  name?: string; // 通知配置名称
  description?: string; // 通知配置描述
  process_id?: number; // 关联流程ID
  template_id?: number; // 关联模板ID
  category_id?: number; // 关联分类ID
  event_types?: string[]; // 触发事件类型
  trigger_type?: string; // 触发类型
  trigger_condition?: Record<string, any>; // 触发条件
  channels?: string[]; // 通知渠道
  recipient_types?: string[]; // 接收人类型
  recipient_users?: string[]; // 自定义接收人用户ID
  recipient_roles?: string[]; // 接收人角色ID
  recipient_depts?: string[]; // 接收人部门ID
  message_template?: string; // 消息模板
  subject_template?: string; // 主题模板
  scheduled_time?: string; // 定时发送时间
  repeat_interval?: number; // 重复间隔(分钟)
  max_retries?: number; // 最大重试次数
  retry_interval?: number; // 重试间隔(分钟)
  status?: number; // 状态
  priority?: number; // 优先级
  is_default?: number; // 是否默认配置：1-是，2-否
  settings?: Record<string, any>; // 通知设置
}

// 删除工单通知配置请求
export interface DeleteNotificationReq {
  id: number; // ID
}

// 工单通知配置列表请求
export interface ListNotificationReq {
  page?: number; // 页码
  size?: number; // 每页数量
  name?: string; // 通知配置名称
  process_id?: number; // 关联流程ID
  template_id?: number; // 关联模板ID
  category_id?: number; // 关联分类ID
  status?: number; // 状态
  is_default?: number; // 是否默认配置：1-是，2-否
  channel?: string; // 通知渠道过滤
}

// 工单通知配置详情请求
export interface DetailNotificationReq {
  id: number; // ID
}

// 工单通知发送记录
export interface WorkorderNotificationLogItem {
  id: number; // ID
  created_at: string; // 创建时间
  updated_at: string; // 更新时间
  notification_id: number; // 通知配置ID
  instance_id?: number; // 工单实例ID
  event_type: string; // 触发事件类型
  channel: string; // 发送渠道
  recipient_type: string; // 接收人类型
  recipient_id: string; // 接收人ID
  recipient_name?: string; // 接收人名称
  recipient_addr: string; // 接收人地址
  subject?: string; // 消息主题
  content: string; // 发送内容
  status: number; // 发送状态
  error_message?: string; // 错误信息
  response_data?: Record<string, any>; // 响应数据
  send_at: string; // 发送时间
  delivered_at?: string; // 送达时间
  read_at?: string; // 阅读时间
  cost?: number; // 发送成本
  retry_count: number; // 重试次数
  next_retry_at?: string; // 下次重试时间
  sender_id: number; // 发送人ID
  extended_data?: Record<string, any>; // 扩展数据
}

// 工单通知发送记录列表请求
export interface ListSendLogReq {
  page?: number; // 页码
  size?: number; // 每页数量
  notificationId?: number; // 通知配置ID
  instance_id?: number; // 工单实例ID
  event_type?: string; // 触发事件类型
  channel?: string; // 发送渠道
  recipient_type?: string; // 接收人类型
  recipient_id?: string; // 接收人ID
  status?: number; // 发送状态
}

// 工单通知队列
export interface WorkorderNotificationQueueItem {
  id: number; // ID
  created_at: string; // 创建时间
  updated_at: string; // 更新时间
  notification_id: number; // 通知配置ID
  instance_id?: number; // 工单实例ID
  event_type: string; // 触发事件类型
  channel: string; // 发送渠道
  recipient_type: string; // 接收人类型
  recipient_id: string; // 接收人ID
  recipient_addr: string; // 接收人地址
  subject?: string; // 消息主题
  content: string; // 发送内容
  priority: number; // 优先级
  status: number; // 状态
  scheduled_at: string; // 计划发送时间
  processed_at?: string; // 处理时间
  retry_count: number; // 重试次数
  next_retry_at?: string; // 下次重试时间
  error_message?: string; // 错误信息
  extended_data?: Record<string, any>; // 扩展数据
}

// 测试发送工单通知请求
export interface TestSendNotificationReq {
  notification_id: number; // 通知配置ID
  recipient?: string; // 接收人地址（可选，使用默认接收人）
}

// 工单通知队列列表请求
export interface ListNotificationQueueReq {
  page?: number; // 页码
  size?: number; // 每页数量
  notification_id?: number; // 通知配置ID
  instance_id?: number; // 工单实例ID
  event_type?: string; // 触发事件类型
  channel?: string; // 发送渠道
  recipient_type?: string; // 接收人类型
  recipient_id?: string; // 接收人ID
  status?: number; // 状态
  priority?: number; // 优先级
}

export interface ManualSendNotificationReq {
  channels: string[]; // 通知渠道列表
  recipient: string; // 接收人地址
  subject: string; // 通知主题
  content: string; // 通知内容
}

export const getEventTypeName = (eventType: string): string => {
  const eventNames: Record<string, string> = {
    [WorkorderEventTypes.INSTANCE_CREATED]: '工单创建',
    [WorkorderEventTypes.INSTANCE_SUBMITTED]: '工单提交',
    [WorkorderEventTypes.INSTANCE_ASSIGNED]: '工单指派',
    [WorkorderEventTypes.INSTANCE_APPROVED]: '工单审批通过',
    [WorkorderEventTypes.INSTANCE_REJECTED]: '工单拒绝',
    [WorkorderEventTypes.INSTANCE_COMPLETED]: '工单完成',
    [WorkorderEventTypes.INSTANCE_CANCELLED]: '工单取消',
    [WorkorderEventTypes.INSTANCE_UPDATED]: '工单更新',
    [WorkorderEventTypes.INSTANCE_COMMENTED]: '工单评论',
    [WorkorderEventTypes.INSTANCE_DELETED]: '工单删除',
    [WorkorderEventTypes.INSTANCE_RETURNED]: '工单退回',
  };
  return eventNames[eventType] || '未知事件';
};

export const getNotificationChannelName = (channel: string): string => {
  const channelNames: Record<string, string> = {
    [NotificationChannel.EMAIL]: '邮件',
    [NotificationChannel.FEISHU]: '飞书',
    [NotificationChannel.SMS]: '短信',
    [NotificationChannel.WEBHOOK]: 'Webhook',
  };
  return channelNames[channel] || '未知渠道';
};

export const getRecipientTypeName = (recipientType: string): string => {
  const typeNames: Record<string, string> = {
    [RecipientTypes.CREATOR]: '工单创建人',
    [RecipientTypes.ASSIGNEE]: '工单处理人',
    [RecipientTypes.USER]: '指定用户',
    [RecipientTypes.ROLE]: '角色用户',
    [RecipientTypes.DEPT]: '部门用户',
    [RecipientTypes.CUSTOM]: '自定义用户',
  };
  return typeNames[recipientType] || '未知类型';
};

export const getAllEventTypes = (): string[] => {
  return Object.values(WorkorderEventTypes);
};

export const getAllNotificationChannels = (): string[] => {
  return Object.values(NotificationChannel);
};

export const getAllRecipientTypes = (): string[] => {
  return Object.values(RecipientTypes);
};

export const getNotificationList = (params: ListNotificationReq) => {
  return requestClient.get('/workorder/notification/list', { params });
};

export const getNotificationDetail = (id: number) => {
  return requestClient.get(`/workorder/notification/detail/${id}`);
};

export const createNotification = (data: CreateNotificationReq) => {
  return requestClient.post('/workorder/notification/create', data);
};

export const updateNotification = (data: UpdateNotificationReq) => {
  return requestClient.put(`/workorder/notification/update/${data.id}`, data);
};

export const deleteNotification = (id: number) => {
  return requestClient.delete(`/workorder/notification/delete/${id}`);
};

export const updateNotificationStatus = (id: number, status: number) => {
  return requestClient.put(`/workorder/notification/update/${id}`, { status });
};

export const getSendLogs = (params: ListSendLogReq) => {
  return requestClient.get('/workorder/notification/logs', { params });
};

export const testSendNotification = (data: TestSendNotificationReq) => {
  return requestClient.post('/workorder/notification/test/send', data);
};

export const duplicateNotification = (id: number) => {
  return requestClient.post(`/workorder/notification/${id}/duplicate`);
};

export const getAvailableChannels = () => {
  return requestClient.get('/workorder/notification/channels');
};

export const sendNotificationManually = (data: ManualSendNotificationReq) => {
  return requestClient.post('/workorder/notification/send', data);
};
