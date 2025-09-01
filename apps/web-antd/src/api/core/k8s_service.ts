import { requestClient } from '#/api/request';

// K8s Service状态枚举
export enum K8sSvcStatus {
  Running = 1, // 运行中
  Stopped = 2, // 停止
  Error = 3, // 异常
}

// Service端口配置
export interface ServicePort {
  name?: string;
  protocol: string;
  port: number;
  target_port: number | string;
  node_port?: number;
  app_protocol?: string;
}

// K8s Service端点信息
export interface K8sServiceEndpoint {
  ip: string;
  port: number;
  protocol: string;
  ready: boolean;
}

// 端点端口信息
export interface EndpointPort {
  name?: string;
  port: number;
  protocol: string;
  app_protocol?: string;
}

// 端点条件
export interface EndpointCondition {
  type: string;
  status: string;
  last_transition_time: string;
  reason: string;
  message: string;
}

// 端点目标引用
export interface EndpointTargetRef {
  kind: string;
  namespace: string;
  name: string;
  uid: string;
  api_version: string;
  resource_version: string;
}

// 服务端点详细信息
export interface ServiceEndpoint {
  addresses: string[];
  ports: EndpointPort[];
  ready: boolean;
  conditions: EndpointCondition[];
  target_ref?: EndpointTargetRef;
  topology: Record<string, string>;
  last_change: string;
}

// K8s Service实体
export interface K8sService {
  id?: number;
  name: string;
  namespace: string;
  cluster_id: number;
  uid?: string;
  type: string;
  cluster_ip?: string;
  external_ips?: string[];
  load_balancer_ip?: string;
  ports: ServicePort[];
  selector?: Record<string, string>;
  labels?: Record<string, string>;
  annotations?: Record<string, string>;
  created_at?: string;
  updated_at?: string;
  age?: string;
  status: K8sSvcStatus;
  endpoints?: K8sServiceEndpoint[];
}

// Service相关事件
export interface K8sServiceEvent {
  type: string;
  reason: string;
  message: string;
  count: number;
  first_time: string;
  last_time: string;
  source: string;
}

// Service指标信息
export interface K8sServiceMetrics {
  request_count: number;
  request_rate: number;
  response_time: number;
  error_rate: number;
  connection_count: number;
  bandwidth_in: number;
  bandwidth_out: number;
  last_updated: string;
}

// YAML响应
export interface K8sYaml {
  yaml: string;
}

// Service列表请求
export interface GetServiceListReq {
  page?: number;
  size?: number;
  search?: string;
  cluster_id: number;
  namespace?: string;
  type?: string;
  labels?: Record<string, string>;
}

// 获取Service详情请求
export interface GetServiceDetailsReq {
  cluster_id: number;
  namespace: string;
  name: string;
}

// 获取Service YAML请求
export interface GetServiceYamlReq {
  cluster_id: number;
  namespace: string;
  name: string;
}

// 创建Service请求
export interface CreateServiceReq {
  cluster_id: number;
  name: string;
  namespace: string;
  type: string;
  ports: ServicePort[];
  selector?: Record<string, string>;
  labels?: Record<string, string>;
  annotations?: Record<string, string>;
  yaml?: string;
}

// 更新Service请求
export interface UpdateServiceReq {
  cluster_id: number;
  name: string;
  namespace: string;
  type?: string;
  ports?: ServicePort[];
  selector?: Record<string, string>;
  labels?: Record<string, string>;
  annotations?: Record<string, string>;
  yaml?: string;
}

// 删除Service请求
export interface DeleteServiceReq {
  cluster_id: number;
  namespace: string;
  name: string;
}

// 获取Service端点请求
export interface GetServiceEndpointsReq {
  cluster_id: number;
  namespace: string;
  name: string;
}

// 获取Service指标请求
export interface GetServiceMetricsReq {
  cluster_id: number;
  namespace: string;
  name: string;
  start_time?: string;
  end_time?: string;
  step?: string;
}

// 获取Service事件请求
export interface GetServiceEventsReq {
  cluster_id: number;
  namespace: string;
  name: string;
  event_type?: string;
  limit?: number;
}

/**
 * 获取Service列表
 */
export async function getServiceListApi(params: GetServiceListReq) {
  return requestClient.get<K8sService[]>('/k8s/services', { params });
}

/**
 * 获取Service详情
 */
export async function getServiceDetailsApi(
  clusterId: number,
  namespace: string,
  name: string,
) {
  return requestClient.get<K8sService>(
    `/k8s/services/${clusterId}/${namespace}/${name}`,
  );
}

/**
 * 获取Service YAML
 */
export async function getServiceYamlApi(
  clusterId: number,
  namespace: string,
  name: string,
) {
  return requestClient.get<K8sYaml>(
    `/k8s/services/${clusterId}/${namespace}/${name}/yaml`,
  );
}

/**
 * 创建Service
 */
export async function createServiceApi(data: CreateServiceReq) {
  return requestClient.post('/k8s/services', data);
}

/**
 * 更新Service
 */
export async function updateServiceApi(
  clusterId: number,
  namespace: string,
  name: string,
  data: UpdateServiceReq,
) {
  return requestClient.put(
    `/k8s/services/${clusterId}/${namespace}/${name}`,
    data,
  );
}

/**
 * 删除Service
 */
export async function deleteServiceApi(
  clusterId: number,
  namespace: string,
  name: string,
) {
  return requestClient.delete(
    `/k8s/services/${clusterId}/${namespace}/${name}`,
  );
}

/**
 * 获取Service端点
 */
export async function getServiceEndpointsApi(
  clusterId: number,
  namespace: string,
  name: string,
) {
  return requestClient.get<ServiceEndpoint[]>(
    `/k8s/services/${clusterId}/${namespace}/${name}/endpoints`,
  );
}

/**
 * 获取Service指标
 */
export async function getServiceMetricsApi(
  clusterId: number,
  namespace: string,
  name: string,
  params?: GetServiceMetricsReq,
) {
  return requestClient.get<K8sServiceMetrics>(
    `/k8s/services/${clusterId}/${namespace}/${name}/metrics`,
    { params },
  );
}

/**
 * 获取Service事件
 */
export async function getServiceEventsApi(
  clusterId: number,
  namespace: string,
  name: string,
  params?: GetServiceEventsReq,
) {
  return requestClient.get<K8sServiceEvent[]>(
    `/k8s/services/${clusterId}/${namespace}/${name}/events`,
    { params },
  );
}
