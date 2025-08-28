import { requestClient } from '#/api/request';
import type { ContainerPort, EnvVar, ResourceRequirements, Toleration } from './k8s_types';

// DaemonSet相关接口和类型定义

export interface DaemonSetInfo {
  name: string;
  namespace: string;
  cluster_id: number;
  uid: string;
  desired_number_scheduled: number;
  current_number_scheduled: number;
  number_misscheduled: number;
  number_ready: number;
  updated_number_scheduled: number;
  number_available: number;
  number_unavailable: number;
  labels?: Record<string, string>;
  annotations?: Record<string, string>;
  creation_timestamp: string;
  images: string[];
  age: string;
  status: string;
  node_selector?: Record<string, string>;
}

export interface DaemonSetListReq {
  cluster_id: number;
  namespace?: string;
  label_selector?: string;
  field_selector?: string;
  status?: string;
  page?: number;
  page_size?: number;
}

export interface DaemonSetCreateReq {
  cluster_id: number;
  namespace: string;
  name: string;
  image: string;
  ports?: ContainerPort[];
  env?: EnvVar[];
  resources?: ResourceRequirements;
  node_selector?: Record<string, string>;
  tolerations?: Toleration[];
  labels?: Record<string, string>;
  annotations?: Record<string, string>;
  daemonset_yaml?: any;
}

export interface DaemonSetUpdateReq {
  cluster_id: number;
  namespace: string;
  name: string;
  image?: string;
  ports?: ContainerPort[];
  env?: EnvVar[];
  resources?: ResourceRequirements;
  node_selector?: Record<string, string>;
  tolerations?: Toleration[];
  labels?: Record<string, string>;
  annotations?: Record<string, string>;
  daemonset_yaml?: any;
}

export interface DaemonSetDeleteReq {
  cluster_id: number;
  namespace: string;
  name: string;
  grace_period_seconds?: number;
  force?: boolean;
}

export interface DaemonSetBatchDeleteReq {
  cluster_id: number;
  namespace: string;
  names: string[];
  grace_period_seconds?: number;
  force?: boolean;
}

export interface DaemonSetRestartReq {
  cluster_id: number;
  namespace: string;
  name: string;
}



export interface DaemonSetContainerPort {
  name?: string;
  container_port: number;
  protocol?: string;
  host_port?: number;
}

export interface DaemonSetEnvVar {
  name: string;
  value?: string;
  value_from?: any;
}

export interface DaemonSetResourceRequirements {
  limits?: Record<string, string>;
  requests?: Record<string, string>;
}

export interface DaemonSetRolloutStatus {
  observed_generation: number;
  updated_number_scheduled: number;
  desired_number_scheduled: number;
  number_ready: number;
  rollout_complete: boolean;
}

// DaemonSet相关API函数

/**
 * 获取DaemonSet列表
 */
export async function getDaemonSetListApi(data: DaemonSetListReq) {
  const params = new URLSearchParams();
  if (data.namespace) params.append('namespace', data.namespace);
  if (data.label_selector) params.append('label_selector', data.label_selector);
  if (data.field_selector) params.append('field_selector', data.field_selector);
  if (data.status) params.append('status', data.status);
  if (data.page) params.append('page', data.page.toString());
  if (data.page_size) params.append('page_size', data.page_size.toString());

  return requestClient.get<DaemonSetInfo[]>(`/k8s/daemonsets/${data.cluster_id}?${params}`);
}

/**
 * 获取DaemonSet详情
 */
export async function getDaemonSetDetailApi(cluster_id: number, namespace: string, name: string) {
  return requestClient.get<DaemonSetInfo>(`/k8s/daemonsets/${cluster_id}/${namespace}/${name}`);
}

/**
 * 创建DaemonSet
 */
export async function createDaemonSetApi(data: DaemonSetCreateReq) {
  return requestClient.post('/k8s/daemonsets/create', data);
}

/**
 * 更新DaemonSet
 */
export async function updateDaemonSetApi(data: DaemonSetUpdateReq) {
  return requestClient.post('/k8s/daemonsets/update', data);
}

/**
 * 删除DaemonSet
 */
export async function deleteDaemonSetApi(data: DaemonSetDeleteReq) {
  return requestClient.delete('/k8s/daemonsets/delete', { data });
}

/**
 * 批量删除DaemonSet
 */
export async function batchDeleteDaemonSetApi(data: DaemonSetBatchDeleteReq) {
  return requestClient.delete('/k8s/daemonsets/batch_delete', { data });
}

/**
 * 重启DaemonSet
 */
export async function restartDaemonSetApi(data: DaemonSetRestartReq) {
  return requestClient.post('/k8s/daemonsets/restart', data);
}

/**
 * 批量重启DaemonSet
 */
export async function batchRestartDaemonSetApi(cluster_id: number, namespace: string, names: string[]) {
  return requestClient.post('/k8s/daemonsets/batch_restart', {
    cluster_id,
    namespace,
    names,
  });
}

/**
 * 获取DaemonSet的YAML配置
 */
export async function getDaemonSetYamlApi(cluster_id: number, namespace: string, name: string) {
  return requestClient.get(`/k8s/daemonsets/${cluster_id}/${namespace}/${name}/yaml`);
}

/**
 * 获取DaemonSet事件
 */
export async function getDaemonSetEventsApi(cluster_id: number, namespace: string, name: string) {
  return requestClient.get(`/k8s/daemonsets/${cluster_id}/${namespace}/${name}/events`);
}

/**
 * 获取DaemonSet回滚状态
 */
export async function getDaemonSetRolloutStatusApi(cluster_id: number, namespace: string, name: string) {
  return requestClient.get<DaemonSetRolloutStatus>(`/k8s/daemonsets/${cluster_id}/${namespace}/${name}/rollout-status`);
}

/**
 * 暂停DaemonSet更新
 */
export async function pauseDaemonSetApi(cluster_id: number, namespace: string, name: string) {
  return requestClient.post('/k8s/daemonsets/pause', {
    cluster_id,
    namespace,
    name,
  });
}

/**
 * 恢复DaemonSet更新
 */
export async function resumeDaemonSetApi(cluster_id: number, namespace: string, name: string) {
  return requestClient.post('/k8s/daemonsets/resume', {
    cluster_id,
    namespace,
    name,
  });
}

/**
 * 获取DaemonSet历史版本
 */
export async function getDaemonSetHistoryApi(cluster_id: number, namespace: string, name: string) {
  return requestClient.get(`/k8s/daemonsets/${cluster_id}/${namespace}/${name}/history`);
}

/**
 * 回滚DaemonSet
 */
export async function rollbackDaemonSetApi(cluster_id: number, namespace: string, name: string, revision?: number) {
  return requestClient.post('/k8s/daemonsets/rollback', {
    cluster_id,
    namespace,
    name,
    revision,
  });
}
