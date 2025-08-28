import { requestClient } from '#/api/request';
import type { ServicePort } from './k8s_types';

// Service相关接口和类型定义

export interface ServiceInfo {
  name: string;
  namespace: string;
  cluster_id: number;
  uid: string;
  type: string;
  cluster_ip: string;
  external_ips?: string[];
  load_balancer_ip?: string;
  ports: ServicePort[];
  selector?: Record<string, string>;
  labels?: Record<string, string>;
  annotations?: Record<string, string>;
  creation_timestamp: string;
  age: string;
  status: string;
  endpoints: ServiceEndpoint[];
}



export interface ServiceEndpoint {
  ip: string;
  port: number;
  protocol: string;
  ready: boolean;
  node_name?: string;
}

export interface ServiceListReq {
  cluster_id: number;
  namespace?: string;
  label_selector?: string;
  field_selector?: string;
  type?: string;
  status?: string;
  page?: number;
  page_size?: number;
}

export interface ServiceCreateReq {
  cluster_id: number;
  namespace: string;
  name: string;
  type?: string;
  selector?: Record<string, string>;
  ports: ServicePort[];
  labels?: Record<string, string>;
  annotations?: Record<string, string>;
  service_yaml?: any;
}

export interface ServiceUpdateReq {
  cluster_id: number;
  namespace: string;
  name: string;
  type?: string;
  selector?: Record<string, string>;
  ports?: ServicePort[];
  labels?: Record<string, string>;
  annotations?: Record<string, string>;
  service_yaml?: any;
}

export interface ServiceDeleteReq {
  cluster_id: number;
  namespace: string;
  name: string;
  grace_period_seconds?: number;
  force?: boolean;
}

export interface ServiceBatchDeleteReq {
  cluster_id: number;
  namespace: string;
  names: string[];
  grace_period_seconds?: number;
  force?: boolean;
}

export interface PortForwardPort {
  local_port: number;
  remote_port: number;
}

// Service相关API函数

/**
 * 获取Service列表
 */
export async function getServiceListApi(id: number, namespace: string) {
  return requestClient.get<ServiceInfo[]>(`/k8s/services/${id}?namespace=${namespace}`);
}

/**
 * 获取Service列表（支持多种过滤条件）
 */
export async function getServiceListWithFilterApi(data: ServiceListReq) {
  const params = new URLSearchParams();
  if (data.namespace) params.append('namespace', data.namespace);
  if (data.label_selector) params.append('label_selector', data.label_selector);
  if (data.field_selector) params.append('field_selector', data.field_selector);
  if (data.type) params.append('type', data.type);
  if (data.status) params.append('status', data.status);
  if (data.page) params.append('page', data.page.toString());
  if (data.page_size) params.append('page_size', data.page_size.toString());
  
  return requestClient.get<ServiceInfo[]>(`/k8s/services/${data.cluster_id}/list?${params}`);
}

/**
 * 获取Service的YAML配置
 */
export async function getServiceYamlApi(
  id: number,
  svcName: string,
  namespace: string,
) {
  return requestClient.get(
    `/k8s/services/${id}/${svcName}/yaml?namespace=${namespace}`,
  );
}

/**
 * 更新Service
 */
export async function updateServiceApi(data: ServiceUpdateReq) {
  return requestClient.post('/k8s/services/update', data);
}

/**
 * 删除Service
 */
export async function deleteServiceApi(
  id: number,
  namespace: string,
  svcName: string,
) {
  return requestClient.delete(
    `/k8s/services/delete/${id}?namespace=${namespace}&svcName=${svcName}`,
  );
}

/**
 * 批量删除Service
 */
export async function batchDeleteServiceApi(data: ServiceBatchDeleteReq) {
  return requestClient.delete('/k8s/services/batch_delete', { data });
}

/**
 * 创建Service
 */
export async function createServiceApi(data: ServiceCreateReq) {
  return requestClient.post('/k8s/services/create', data);
}

/**
 * 获取Service端点信息
 */
export async function getServiceEndpointsApi(cluster_id: number, namespace: string, name: string) {
  return requestClient.get<ServiceEndpoint[]>(`/k8s/services/${cluster_id}/${name}/endpoints?namespace=${namespace}`);
}

/**
 * 获取Service事件
 */
export async function getServiceEventsApi(cluster_id: number, namespace: string, name: string) {
  return requestClient.get(`/k8s/services/${cluster_id}/${name}/events?namespace=${namespace}`);
}

/**
 * Service端口转发
 */
export async function portForwardServiceApi(cluster_id: number, namespace: string, name: string, ports: PortForwardPort[]) {
  return requestClient.post('/k8s/services/port-forward', {
    cluster_id,
    namespace,
    name,
    ports,
  });
}

/**
 * 测试Service连通性
 */
export async function testServiceConnectivityApi(cluster_id: number, namespace: string, name: string) {
  return requestClient.post('/k8s/services/test-connectivity', {
    cluster_id,
    namespace,
    name,
  });
}
