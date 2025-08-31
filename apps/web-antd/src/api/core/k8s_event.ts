import { requestClient } from '#/api/request';

// 事件类型枚举
export enum EventType {
  Normal = 1,
  Warning = 2,
}

// 事件原因枚举
export enum EventReason {
  BackOff = 1,
  Pulled = 2,
  Created = 3,
  Deleted = 4,
  Updated = 5,
  Restarted = 6,
  Started = 7,
  Stopped = 8,
  Failed = 9,
  Succeeded = 10,
  Unknown = 11,
  Warning = 12,
  Error = 13,
  Fatal = 14,
  Panic = 15,
  Timeout = 16,
  Cancelled = 17,
  Interrupted = 18,
  Aborted = 19,
  Ignored = 20,
  Other = 21,
}

// 事件严重程度
export enum EventSeverity {
  Low = 'Low',
  Medium = 'Medium',
  High = 'High',
  Critical = 'Critical',
}

// 涉及对象接口
export interface InvolvedObject {
  kind: string; // Pod, Service, Deployment等
  name: string; // 对象名称
  namespace: string; // 命名空间
  uid: string; // 对象UID
  api_version: string; // API版本
  field_path?: string; // 如：spec.containers{nginx}
}

// 事件源信息接口
export interface EventSource {
  component: string; // kubelet, controller-manager等
  host: string; // 节点名称
}

// K8s事件接口
export interface K8sEvent {
  name: string; // 名称
  namespace: string; // 命名空间
  uid: string; // UID
  cluster_id: number; // 集群ID
  type: EventType; // Normal, Warning
  reason: EventReason; // 事件原因，如：BackOff, Pulled, Created
  message: string; // 详细消息
  severity: EventSeverity; // 严重程度：low, medium, high, critical
  first_timestamp: string; // 首次发生时间
  last_timestamp: string; // 最后发生时间
  count: number; // 事件发生次数
  involved_object: InvolvedObject; // 涉及对象
  source: EventSource; // 事件源
  action?: string; // 执行的动作
  reporting_component?: string; // 报告组件
  reporting_instance?: string; // 报告实例
  labels?: Record<string, string>; // 标签
  annotations?: Record<string, string>; // 注解
}

// 时间范围接口
export interface TimeRange {
  start: string; // 开始时间
  end: string; // 结束时间
}

// 计数项接口
export interface CountItem {
  name: string; // 名称
  count: number; // 计数
  percentage: number; // 百分比
}

// 事件汇总接口
export interface EventSummary {
  total_events: number; // 总事件数
  unique_events: number; // 唯一事件数
  warning_events: number; // 警告事件数
  normal_events: number; // 正常事件数
  distribution: Record<string, number>; // 按severity分布
  top_reasons: CountItem[]; // 热门原因
  top_objects: CountItem[]; // 热门对象
}

// 事件分组数据接口
export interface EventGroupData {
  group: string; // 分组名称
  count: number; // 计数
  events?: K8sEvent[]; // 可选：包含该组的事件样本
}

// 事件趋势接口
export interface EventTrend {
  timestamp: string; // 时间戳
  count: number; // 计数
  type?: string; // 类型
}

// 事件统计接口
export interface EventStatistics {
  time_range: TimeRange; // 时间范围
  summary: EventSummary; // 汇总信息
  group_data: EventGroupData[]; // 分组数据
  trends?: EventTrend[]; // 趋势数据
}

// 事件时间线项接口
export interface EventTimelineItem {
  timestamp: string; // 时间戳
  type: string; // 类型
  reason: string; // 原因
  message: string; // 消息
  count: number; // 计数
}

// 事件时间线接口
export interface EventTimeline {
  object: InvolvedObject; // 涉及对象
  timeline: EventTimelineItem[]; // 时间线
}

// 获取事件列表请求参数
export interface GetEventListReq {
  cluster_id: number; // 集群ID
  namespace?: string; // 命名空间
  label_selector?: string; // 标签选择器
  field_selector?: string; // 字段选择器
  event_type?: string; // 事件类型：Normal,Warning
  reason?: string; // 事件原因
  source?: string; // 事件源组件
  involved_object_kind?: string; // 涉及对象类型
  involved_object_name?: string; // 涉及对象名称
  limit_days?: number; // 限制天数
  limit?: number; // 限制结果数量
  continue?: string; // 分页续订令牌
}

// 获取事件详情请求参数
export interface GetEventDetailReq {
  cluster_id: number; // 集群ID
  namespace: string; // 命名空间
  name: string; // 事件名称
}

// 获取Pod相关事件请求参数
export interface GetEventsByPodReq {
  cluster_id: number; // 集群ID
  namespace: string; // 命名空间
  pod_name: string; // Pod名称
}

// 获取Deployment相关事件请求参数
export interface GetEventsByDeploymentReq {
  cluster_id: number; // 集群ID
  namespace: string; // 命名空间
  deployment_name: string; // Deployment名称
}

// 获取Service相关事件请求参数
export interface GetEventsByServiceReq {
  cluster_id: number; // 集群ID
  namespace: string; // 命名空间
  service_name: string; // Service名称
}

// 获取Node相关事件请求参数
export interface GetEventsByNodeReq {
  cluster_id: number; // 集群ID
  node_name: string; // Node名称
}

// 获取事件统计请求参数
export interface GetEventStatisticsReq {
  cluster_id: number; // 集群ID
  namespace?: string; // 命名空间
  start_time?: string; // 开始时间
  end_time?: string; // 结束时间
  group_by?: string; // 分组方式：type,reason,object,severity
}

// 获取事件汇总请求参数
export interface GetEventSummaryReq {
  cluster_id: number; // 集群ID
  namespace?: string; // 命名空间
  start_time?: string; // 开始时间
  end_time?: string; // 结束时间
}

// 获取事件时间线请求参数
export interface GetEventTimelineReq {
  cluster_id: number; // 集群ID
  namespace: string; // 命名空间
  object_kind: string; // 对象类型
  object_name: string; // 对象名称
  start_time?: string; // 开始时间
  end_time?: string; // 结束时间
}

// 获取事件趋势请求参数
export interface GetEventTrendsReq {
  cluster_id: number; // 集群ID
  namespace?: string; // 命名空间
  start_time?: string; // 开始时间
  end_time?: string; // 结束时间
  interval?: string; // 时间间隔：1m,5m,15m,1h,1d
  event_type?: string; // 事件类型：Normal,Warning
}

// 获取事件分组数据请求参数
export interface GetEventGroupDataReq {
  cluster_id: number; // 集群ID
  namespace?: string; // 命名空间
  group_by: string; // 分组方式：type,reason,object,severity
  start_time?: string; // 开始时间
  end_time?: string; // 结束时间
  limit?: number; // 限制结果数量
}

// 删除事件请求参数
export interface DeleteEventReq {
  cluster_id: number; // 集群ID
  namespace: string; // 命名空间
  name: string; // 事件名称
}

// 清理旧事件请求参数
export interface CleanupOldEventsReq {
  cluster_id: number; // 集群ID
  namespace?: string; // 命名空间
  before_time: string; // 清理此时间之前的事件
  event_type?: string; // 事件类型：Normal,Warning
  dry_run?: boolean; // 是否为试运行
}

/**
 * 获取Event列表
 * @param params 请求参数
 */
export function getEventList(params: GetEventListReq) {
  return requestClient.get<K8sEvent[]>('/k8s/events/list', { params });
}

/**
 * 获取Event详情
 * @param params 请求参数
 */
export function getEventDetail(params: GetEventDetailReq) {
  const { cluster_id, namespace, name } = params;
  return requestClient.get<K8sEvent>(`/k8s/events/${cluster_id}/${namespace}/detail/${name}`);
}

/**
 * 获取Pod相关事件
 * @param params 请求参数
 */
export function getEventsByPod(params: GetEventsByPodReq) {
  const { cluster_id, namespace, pod_name } = params;
  return requestClient.get<K8sEvent[]>(`/k8s/events/${cluster_id}/${namespace}/by-pod/${pod_name}`);
}

/**
 * 获取Deployment相关事件
 * @param params 请求参数
 */
export function getEventsByDeployment(params: GetEventsByDeploymentReq) {
  const { cluster_id, namespace, deployment_name } = params;
  return requestClient.get<K8sEvent[]>(`/k8s/events/${cluster_id}/${namespace}/by-deployment/${deployment_name}`);
}

/**
 * 获取Service相关事件
 * @param params 请求参数
 */
export function getEventsByService(params: GetEventsByServiceReq) {
  const { cluster_id, namespace, service_name } = params;
  return requestClient.get<K8sEvent[]>(`/k8s/events/${cluster_id}/${namespace}/by-service/${service_name}`);
}

/**
 * 获取Node相关事件
 * @param params 请求参数
 */
export function getEventsByNode(params: GetEventsByNodeReq) {
  const { cluster_id, node_name } = params;
  return requestClient.get<K8sEvent[]>(`/k8s/events/${cluster_id}/by-node/${node_name}`);
}

/**
 * 获取事件统计信息
 * @param params 请求参数
 */
export function getEventStatistics(params: GetEventStatisticsReq) {
  return requestClient.get<EventStatistics>('/k8s/events/statistics', { params });
}

/**
 * 获取事件汇总
 * @param params 请求参数
 */
export function getEventSummary(params: GetEventSummaryReq) {
  return requestClient.get<EventSummary>('/k8s/events/summary', { params });
}

/**
 * 获取事件时间线
 * @param params 请求参数
 */
export function getEventTimeline(params: GetEventTimelineReq) {
  return requestClient.get<EventTimeline>('/k8s/events/timeline', { params });
}

/**
 * 获取事件趋势
 * @param params 请求参数
 */
export function getEventTrends(params: GetEventTrendsReq) {
  return requestClient.get<EventTrend[]>('/k8s/events/trends', { params });
}

/**
 * 获取事件分组数据
 * @param params 请求参数
 */
export function getEventGroupData(params: GetEventGroupDataReq) {
  return requestClient.get<EventGroupData[]>('/k8s/events/group', { params });
}

/**
 * 删除单个事件
 * @param params 请求参数
 */
export function deleteEvent(params: DeleteEventReq) {
  const { cluster_id, namespace, name } = params;
  return requestClient.delete(`/k8s/events/${cluster_id}/${namespace}/delete/${name}`);
}

/**
 * 清理旧事件
 * @param data 请求数据
 */
export function cleanupOldEvents(data: CleanupOldEventsReq) {
  return requestClient.post('/k8s/events/cleanup', data);
}
