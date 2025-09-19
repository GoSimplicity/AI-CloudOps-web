import { requestClient } from '#/api/request';

/**
 * K8sSvcStatus Service状态枚举
 */
export enum K8sSvcStatus {
  Running = 1, // 运行中
  Stopped = 2, // 停止
  Error = 3,   // 异常
}

/**
 * K8sServiceEndpoint k8s service端点信息
 */
export interface K8sServiceEndpoint {
  ip: string;         // 端点IP
  port: number;       // 端点端口
  protocol: string;   // 端口协议
  ready: boolean;     // 端点是否就绪
}

/**
 * ServicePort 服务端口配置
 */
export interface ServicePort {
  name: string;                // 端口名称
  protocol: string;            // 协议类型
  port: number;                // 服务端口
  target_port: number | string;// 目标端口
  node_port?: number;          // 节点端口（NodePort类型）
  app_protocol?: string;       // 应用协议
}

/**
 * K8sService k8s service
 */
export interface K8sService {
  name: string;                        // Service名称
  namespace: string;                   // 所属命名空间
  cluster_id: number;                  // 所属集群ID
  uid: string;                         // Service UID
  type: string;                        // Service类型
  cluster_ip: string;                  // 集群内部IP
  external_ips: string[];              // 外部IP列表
  load_balancer_ip: string;            // 负载均衡器IP
  ports: ServicePort[];                // 端口配置
  selector: Record<string, string>;    // Pod选择器
  labels: Record<string, string>;      // 标签
  annotations: Record<string, string>; // 注解
  created_at: string;                  // 创建时间
  age: string;                         // 存在时间，前端计算使用
  status: K8sSvcStatus;                // Service状态，前端计算使用
  endpoints: K8sServiceEndpoint[];     // 服务端点，前端使用
}

/**
 * EndpointPort 端点端口信息
 */
export interface EndpointPort {
  name: string;                // 端口名称
  port: number;                // 端口号
  protocol: string;            // 协议
  app_protocol?: string;       // 应用协议
}

/**
 * EndpointCondition 端点条件
 */
export interface EndpointCondition {
  type: string;                 // 条件类型
  status: string;               // 条件状态
  last_transition_time: string; // 最后转换时间
  reason: string;               // 原因
  message: string;              // 消息
}

/**
 * EndpointTargetRef 端点目标引用
 */
export interface EndpointTargetRef {
  kind: string;             // 资源类型
  namespace: string;        // 命名空间
  name: string;             // 资源名称
  uid: string;              // 资源UID
  api_version: string;      // API版本
  resource_version: string; // 资源版本
}

/**
 * ServiceEndpoint 服务端点详细信息
 */
export interface ServiceEndpoint {
  addresses: string[];                  // 端点地址列表
  ports: EndpointPort[];                // 端点端口列表
  ready: boolean;                       // 是否就绪
  conditions: EndpointCondition[];      // 端点条件
  target_ref?: EndpointTargetRef;       // 目标引用
  topology: Record<string, string>;     // 拓扑信息
  last_change: string;                  // 最后变更时间
}

/**
 * ServiceEndpointItem 服务端点项（实际API返回格式）
 */
export interface ServiceEndpointItem {
  ip: string;                           // IP地址
  port: number;                         // 端口号
  protocol: string;                     // 协议
  ready: boolean;                       // 是否就绪
}

/**
 * K8sServiceYaml
 */
export interface K8sServiceYaml {
  yaml: string;
}

/**
 * GetServiceListReq Service列表请求
 */
export interface GetServiceListReq {
  cluster_id: number;                   // 集群ID
  namespace?: string;                   // 命名空间
  type?: string;                        // Service类型
  labels?: Record<string, string>;      // 标签
  [key: string]: any;                   // 兼容分页等其它参数
}

/**
 * GetServiceListRes Service列表响应
 */
export interface GetServiceListRes {
  items: K8sService[];                  // Service列表
  total?: number;                       // 总数
  [key: string]: any;                   // 兼容其它字段
}

/**
 * GetServiceDetailsReq 获取Service详情请求
 */
export interface GetServiceDetailsReq {
  cluster_id: number;                   // 集群ID
  namespace: string;                    // 命名空间
  name: string;                         // Service名称
}

/**
 * GetServiceYamlReq 获取Service YAML请求
 */
export interface GetServiceYamlReq {
  cluster_id: number;                   // 集群ID
  namespace: string;                    // 命名空间
  name: string;                         // Service名称
}

/**
 * CreateServiceReq 创建Service请求
 */
export interface CreateServiceReq {
  cluster_id: number;                   // 集群ID
  name: string;                         // Service名称
  namespace: string;                    // 命名空间
  type: string;                         // Service类型
  ports: ServicePort[];                 // 端口配置
  selector?: Record<string, string>;    // Pod选择器
  labels?: Record<string, string>;      // 标签
  annotations?: Record<string, string>; // 注解
  yaml?: string;                        // YAML内容
}

/**
 * UpdateServiceReq 更新Service请求
 */
export interface UpdateServiceReq {
  cluster_id: number;                   // 集群ID
  name: string;                         // Service名称
  namespace: string;                    // 命名空间
  type?: string;                        // Service类型
  ports?: ServicePort[];                // 端口配置
  selector?: Record<string, string>;    // Pod选择器
  labels?: Record<string, string>;      // 标签
  annotations?: Record<string, string>; // 注解
  yaml?: string;                        // YAML内容
}

/**
 * DeleteServiceReq 删除Service请求
 */
export interface DeleteServiceReq {
  cluster_id: number;                   // 集群ID
  namespace: string;                    // 命名空间
  name: string;                         // Service名称
}

/**
 * GetServiceEndpointsReq 获取Service端点请求
 */
export interface GetServiceEndpointsReq {
  cluster_id: number;                   // 集群ID
  namespace: string;                    // 命名空间
  name: string;                         // Service名称
}

/**
 * CreateResourceByYamlReq 通过YAML创建资源请求
 */
export interface CreateResourceByYamlReq {
  cluster_id: number;                   // 集群ID
  yaml: string;                         // YAML内容
}

/**
 * UpdateResourceByYamlReq 通过YAML更新资源请求
 */
export interface UpdateResourceByYamlReq {
  cluster_id: number;                   // 集群ID
  namespace: string;                    // 命名空间
  name: string;                         // 资源名称
  yaml: string;                         // YAML内容
}

/**
 * 获取Service列表
 */
export async function getServiceListApi(cluster_id: number, params: GetServiceListReq) {
  return requestClient.get<GetServiceListRes>(`/k8s/service/${cluster_id}/list`, { params });
}

/**
 * 获取Service详情
 */
export async function getServiceDetailsApi(cluster_id: number, namespace: string, name: string) {
  return requestClient.get<K8sService>(`/k8s/service/${cluster_id}/${namespace}/${name}/detail`);
}

/**
 * 获取Service YAML
 */
export async function getServiceYamlApi(cluster_id: number, namespace: string, name: string) {
  return requestClient.get<K8sServiceYaml>(`/k8s/service/${cluster_id}/${namespace}/${name}/detail/yaml`);
}

/**
 * 创建Service
 */
export async function createServiceApi(cluster_id: number, data: CreateServiceReq) {
  return requestClient.post(`/k8s/service/${cluster_id}/create`, data);
}

/**
 * 通过YAML创建Service
 */
export async function createServiceByYamlApi(cluster_id: number, data: CreateResourceByYamlReq) {
  return requestClient.post(`/k8s/service/${cluster_id}/create/yaml`, data);
}

/**
 * 更新Service
 */
export async function updateServiceApi(cluster_id: number, namespace: string, name: string, data: UpdateServiceReq) {
  return requestClient.put(`/k8s/service/${cluster_id}/${namespace}/${name}/update`, data);
}

/**
 * 通过YAML更新Service
 */
export async function updateServiceByYamlApi(cluster_id: number, namespace: string, name: string, data: UpdateResourceByYamlReq) {
  return requestClient.put(`/k8s/service/${cluster_id}/${namespace}/${name}/update/yaml`, data);
}

/**
 * 删除Service
 */
export async function deleteServiceApi(cluster_id: number, namespace: string, name: string) {
  return requestClient.delete(`/k8s/service/${cluster_id}/${namespace}/${name}/delete`);
}

/**
 * 获取Service端点
 */
export async function getServiceEndpointsApi(cluster_id: number, namespace: string, name: string) {
  return requestClient.get<ServiceEndpointItem[]>(`/k8s/service/${cluster_id}/${namespace}/${name}/endpoints`);
}
