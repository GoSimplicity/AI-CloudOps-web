import { requestClient } from '#/api/request';
import type { 
  ContainerPort,
  EnvVar,
  ResourceRequirements,
  VolumeMount,
  Probe
} from './k8s_types';

// Pod相关接口和类型定义

export interface PodInfo {
  name: string;
  namespace: string;
  status: string;
  node_name: string;
  labels: Record<string, string>;
  annotations: Record<string, string>;
  containers: PodContainer[];
  creation_timestamp: string;
  age: string;
  ready: string;
  restarts: number;
}

export interface PodContainer {
  name: string;
  image: string;
  command?: string[];
  args?: string[];
  env?: EnvVar[];
  ports?: ContainerPort[];
  resources?: ResourceRequirements;
  volume_mounts?: VolumeMount[];
  liveness_probe?: Probe;
  readiness_probe?: Probe;
  image_pull_policy?: string;
  state: string;
  ready: boolean;
  restart_count: number;
}


export interface PodListReq {
  cluster_id: number;
  namespace?: string;
  label_selector?: string;
  field_selector?: string;
  limit?: number;
}

export interface PodCreateReq {
  cluster_id: number;
  namespace: string;
  name: string;
  yaml?: string;
  labels?: Record<string, string>;
  annotations?: Record<string, string>;
}

export interface PodUpdateReq {
  cluster_id: number;
  namespace: string;
  name: string;
  yaml?: string;
  labels?: Record<string, string>;
  annotations?: Record<string, string>;
}

export interface PodDeleteReq {
  cluster_id: number;
  namespace: string;
  pod_name: string;
  grace_period_seconds?: number;
  force?: boolean;
}

// Pod相关API函数

/**
 * 根据命名空间获取Pod列表
 */
export async function getPodsByNamespaceApi(id: number, namespace: string) {
  return requestClient.get<PodInfo[]>(`/k8s/pods/${id}?namespace=${namespace}`);
}

/**
 * 获取Pod列表（支持多种过滤条件）
 */
export async function getPodListApi(data: PodListReq) {
  const params = new URLSearchParams();
  if (data.namespace) params.append('namespace', data.namespace);
  if (data.label_selector) params.append('label_selector', data.label_selector);
  if (data.field_selector) params.append('field_selector', data.field_selector);
  if (data.limit) params.append('limit', data.limit.toString());
  
  return requestClient.get<PodInfo[]>(`/k8s/pods/${data.cluster_id}/list?${params}`);
}

/**
 * 获取Pod内的容器列表
 */
export async function getContainersByPodNameApi(
  id: number,
  podName: string,
  namespace: string,
) {
  return requestClient.get<PodContainer[]>(
    `/k8s/pods/${id}/${podName}/containers?namespace=${namespace}`,
  );
}

/**
 * 获取容器日志
 */
export async function getContainerLogsApi(
  id: number,
  podName: string,
  container: string,
  namespace: string,
  lines?: number,
  follow?: boolean,
) {
  const params = new URLSearchParams({ namespace });
  if (lines) params.append('lines', lines.toString());
  if (follow) params.append('follow', follow.toString());

  return requestClient.get(
    `/k8s/pods/${id}/${podName}/${container}/logs?${params}`,
  );
}

/**
 * 获取Pod的YAML配置
 */
export async function getPodYamlApi(
  id: number,
  podName: string,
  namespace: string,
) {
  return requestClient.get(
    `/k8s/pods/${id}/${podName}/yaml?namespace=${namespace}`,
  );
}

/**
 * 删除Pod
 */
export async function deletePodApi(
  id: number,
  podName: string,
  namespace: string,
) {
  return requestClient.delete(
    `/k8s/pods/delete/${id}?podName=${podName}&namespace=${namespace}`,
  );
}

/**
 * 创建Pod
 */
export async function createPodApi(data: PodCreateReq) {
  return requestClient.post('/k8s/pods/create', data);
}

/**
 * 更新Pod
 */
export async function updatePodApi(data: PodUpdateReq) {
  return requestClient.post('/k8s/pods/update', data);
}

/**
 * 重启Pod
 */
export async function restartPodApi(cluster_id: number, namespace: string, pod_name: string) {
  return requestClient.post('/k8s/pods/restart', {
    cluster_id,
    namespace,
    pod_name,
  });
}

/**
 * 获取Pod事件
 */
export async function getPodEventsApi(cluster_id: number, namespace: string, pod_name: string) {
  return requestClient.get(`/k8s/pods/${cluster_id}/${pod_name}/events?namespace=${namespace}`);
}

/**
 * 执行Pod内命令
 */
export async function execPodApi(cluster_id: number, namespace: string, pod_name: string, container: string, command: string[]) {
  return requestClient.post('/k8s/pods/exec', {
    cluster_id,
    namespace,
    pod_name,
    container,
    command,
  });
}

/**
 * 端口转发
 */
export async function portForwardPodApi(cluster_id: number, namespace: string, pod_name: string, ports: Array<{local: number, remote: number}>) {
  return requestClient.post('/k8s/pods/port-forward', {
    cluster_id,
    namespace,
    pod_name,
    ports,
  });
}
