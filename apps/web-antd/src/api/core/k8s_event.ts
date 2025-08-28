import { requestClient } from '#/api/request';

// Event相关接口和类型定义

export interface EventInfo {
  type: string;
  reason: string;
  message: string;
  component: string;
  first_timestamp: string;
  last_timestamp: string;
  count: number;
  object_name: string;
  object_kind: string;
  object_namespace?: string;
  source_component: string;
  source_host?: string;
  uid: string;
}

export interface EventListReq {
  cluster_id: number;
  namespace?: string;
  object_name?: string;
  object_kind?: string;
  type?: 'Normal' | 'Warning';
  reason?: string;
  limit_days?: number;
  page?: number;
  page_size?: number;
}

export interface EventWatchReq {
  cluster_id: number;
  namespace?: string;
  resource_version?: string;
}

export interface EventStatistics {
  total_count: number;
  warning_count: number;
  normal_count: number;
  recent_count: number;
  top_reasons: Array<{
    reason: string;
    count: number;
  }>;
}

// Event相关API函数

/**
 * 获取事件列表
 */
export async function getEventsApi(data: EventListReq) {
  const params = new URLSearchParams();
  if (data.namespace) params.append('namespace', data.namespace);
  if (data.object_name) params.append('object_name', data.object_name);
  if (data.object_kind) params.append('object_kind', data.object_kind);
  if (data.type) params.append('type', data.type);
  if (data.reason) params.append('reason', data.reason);
  if (data.limit_days) params.append('limit_days', data.limit_days.toString());
  if (data.page) params.append('page', data.page.toString());
  if (data.page_size) params.append('page_size', data.page_size.toString());

  return requestClient.get<EventInfo[]>(`/k8s/events/${data.cluster_id}?${params}`);
}

/**
 * 获取资源相关事件
 */
export async function getResourceEventsApi(cluster_id: number, namespace: string, resource_type: string, resource_name: string) {
  return requestClient.get<EventInfo[]>(`/k8s/events/${cluster_id}/${namespace}/${resource_type}/${resource_name}`);
}

/**
 * 获取事件统计信息
 */
export async function getEventStatisticsApi(cluster_id: number, namespace?: string, days?: number) {
  const params = new URLSearchParams();
  if (namespace) params.append('namespace', namespace);
  if (days) params.append('days', days.toString());

  return requestClient.get<EventStatistics>(`/k8s/events/${cluster_id}/statistics?${params}`);
}

/**
 * 监听事件变化
 */
export async function watchEventsApi(data: EventWatchReq) {
  const params = new URLSearchParams();
  if (data.namespace) params.append('namespace', data.namespace);
  if (data.resource_version) params.append('resource_version', data.resource_version);

  return requestClient.get(`/k8s/events/${data.cluster_id}/watch?${params}`);
}

/**
 * 清理历史事件
 */
export async function cleanupEventsApi(cluster_id: number, namespace?: string, days_before?: number) {
  return requestClient.post('/k8s/events/cleanup', {
    cluster_id,
    namespace,
    days_before: days_before || 30,
  });
}

/**
 * 导出事件
 */
export async function exportEventsApi(data: EventListReq) {
  const params = new URLSearchParams();
  if (data.namespace) params.append('namespace', data.namespace);
  if (data.object_name) params.append('object_name', data.object_name);
  if (data.object_kind) params.append('object_kind', data.object_kind);
  if (data.type) params.append('type', data.type);
  if (data.reason) params.append('reason', data.reason);
  if (data.limit_days) params.append('limit_days', data.limit_days.toString());

  return requestClient.get(`/k8s/events/${data.cluster_id}/export?${params}`);
}
