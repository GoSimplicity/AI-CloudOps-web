import { requestClient } from '#/api/request';
import type { ContainerPort, EnvVar, ResourceRequirements } from './k8s_types';

// Deployment相关接口和类型定义

export interface DeploymentInfo {
  name: string;
  namespace: string;
  cluster_id: number;
  uid: string;
  replicas: number;
  ready_replicas: number;
  available_replicas: number;
  updated_replicas: number;
  strategy: string;
  labels?: Record<string, string>;
  annotations?: Record<string, string>;
  creation_timestamp: string;
  images: string[];
  age: string;
  status: string;
}

export interface DeploymentListReq {
  cluster_id: number;
  namespace?: string;
  label_selector?: string;
  field_selector?: string;
  status?: string;
  page?: number;
  page_size?: number;
}

export interface DeploymentCreateReq {
  cluster_id: number;
  namespace: string;
  name: string;
  replicas?: number;
  image: string;
  ports?: ContainerPort[];
  env?: EnvVar[];
  resources?: ResourceRequirements;
  labels?: Record<string, string>;
  annotations?: Record<string, string>;
  strategy?: DeploymentStrategy;
  deployment_yaml?: any;
}

export interface DeploymentUpdateReq {
  cluster_id: number;
  namespace: string;
  name: string;
  replicas?: number;
  image?: string;
  ports?: ContainerPort[];
  env?: EnvVar[];
  resources?: ResourceRequirements;
  labels?: Record<string, string>;
  annotations?: Record<string, string>;
  strategy?: DeploymentStrategy;
  deployment_yaml?: any;
}

export interface DeploymentDeleteReq {
  cluster_id: number;
  namespace: string;
  name: string;
  grace_period_seconds?: number;
  force?: boolean;
}

export interface DeploymentBatchDeleteReq {
  cluster_id: number;
  namespace: string;
  names: string[];
  grace_period_seconds?: number;
  force?: boolean;
}

export interface DeploymentScaleReq {
  cluster_id: number;
  namespace: string;
  name: string;
  replicas: number;
}

export interface DeploymentRestartReq {
  cluster_id: number;
  namespace: string;
  name: string;
}

export interface DeploymentRollbackReq {
  cluster_id: number;
  namespace: string;
  name: string;
  revision?: number;
}

export interface DeploymentStrategy {
  type: string;
  rolling_update?: RollingUpdateDeployment;
}

export interface RollingUpdateDeployment {
  max_unavailable?: number | string;
  max_surge?: number | string;
}



export interface DeploymentHistory {
  revision: number;
  change_cause?: string;
  creation_timestamp: string;
}

// Deployment相关API函数

/**
 * 获取Deployment列表
 */
export async function getDeployListApi(id: number, namespace: string) {
  return requestClient.get<DeploymentInfo[]>(`/k8s/deployments/${id}?namespace=${namespace}`);
}

/**
 * 获取Deployment列表（支持多种过滤条件）
 */
export async function getDeploymentListWithFilterApi(data: DeploymentListReq) {
  const params = new URLSearchParams();
  if (data.namespace) params.append('namespace', data.namespace);
  if (data.label_selector) params.append('label_selector', data.label_selector);
  if (data.field_selector) params.append('field_selector', data.field_selector);
  if (data.status) params.append('status', data.status);
  if (data.page) params.append('page', data.page.toString());
  if (data.page_size) params.append('page_size', data.page_size.toString());
  
  return requestClient.get<DeploymentInfo[]>(`/k8s/deployments/${data.cluster_id}/list?${params}`);
}

/**
 * 获取Deployment的YAML配置
 */
export async function getDeployYamlApi(
  id: number,
  deployment_name: string,
  namespace: string,
) {
  return requestClient.get(
    `/k8s/deployments/${id}/yaml?namespace=${namespace}&deployment_name=${deployment_name}`,
  );
}

/**
 * 删除Deployment
 */
export async function deleteDeployApi(
  id: number,
  namespace: string,
  deployment_name: string,
) {
  return requestClient.delete(
    `/k8s/deployments/delete/${id}?namespace=${namespace}&deployment_name=${deployment_name}`,
  );
}

/**
 * 批量删除Deployment
 */
export async function batchDeleteDeploymentApi(data: DeploymentBatchDeleteReq) {
  return requestClient.delete('/k8s/deployments/batch_delete', { data });
}

/**
 * 重启Deployment
 */
export async function restartDeployApi(
  id: number,
  namespace: string,
  deployment_name: string,
) {
  return requestClient.post(
    `/k8s/deployments/restart/${id}?namespace=${namespace}&deployment_name=${deployment_name}`,
  );
}

/**
 * 批量重启Deployment
 */
export async function batchRestartDeploymentApi(data: { cluster_id: number; namespace: string; names: string[] }) {
  return requestClient.post('/k8s/deployments/batch_restart', data);
}

/**
 * 创建Deployment
 */
export async function createDeploymentApi(data: DeploymentCreateReq) {
  return requestClient.post('/k8s/deployments/create', data);
}

/**
 * 更新Deployment
 */
export async function updateDeploymentApi(data: DeploymentUpdateReq) {
  return requestClient.post('/k8s/deployments/update', data);
}

/**
 * 扩缩容Deployment
 */
export async function scaleDeploymentApi(data: DeploymentScaleReq) {
  return requestClient.post('/k8s/deployments/scale', data);
}

/**
 * 回滚Deployment
 */
export async function rollbackDeploymentApi(data: DeploymentRollbackReq) {
  return requestClient.post('/k8s/deployments/rollback', data);
}

/**
 * 获取Deployment历史版本
 */
export async function getDeploymentHistoryApi(cluster_id: number, namespace: string, name: string) {
  return requestClient.get<DeploymentHistory[]>(`/k8s/deployments/${cluster_id}/${name}/history?namespace=${namespace}`);
}

/**
 * 获取Deployment事件
 */
export async function getDeploymentEventsApi(cluster_id: number, namespace: string, name: string) {
  return requestClient.get(`/k8s/deployments/${cluster_id}/${name}/events?namespace=${namespace}`);
}

/**
 * 暂停Deployment
 */
export async function pauseDeploymentApi(cluster_id: number, namespace: string, name: string) {
  return requestClient.post('/k8s/deployments/pause', {
    cluster_id,
    namespace,
    name,
  });
}

/**
 * 恢复Deployment
 */
export async function resumeDeploymentApi(cluster_id: number, namespace: string, name: string) {
  return requestClient.post('/k8s/deployments/resume', {
    cluster_id,
    namespace,
    name,
  });
}
