import { requestClient } from '#/api/request';

// 环境枚举
export enum Env {
  Prod = 1,  // 生产环境
  Dev = 2,   // 开发环境
  Stage = 3, // 预发环境
  Rc = 4,    // 测试环境
  Press = 5, // 灰度环境
}

// 集群状态枚举
export enum ClusterStatus {
  Running = 1, // 运行中
  Stopped = 2, // 停止
  Error = 3,   // 异常
}

// 键值对类型
export interface KeyValue {
  key: string;
  value: string;
}

export type KeyValueList = KeyValue[];
export type StringList = string[];

// 组件健康状态
export interface ComponentHealthStatus {
  name: string;      // 组件名称
  status: string;    // 状态: healthy, unhealthy
  message: string;   // 状态信息
  timestamp: string; // 时间戳
}

// 节点统计
export interface NodeStats {
  total_nodes: number;     // 总节点数
  ready_nodes: number;     // 就绪节点数
  not_ready_nodes: number; // 未就绪节点数
  master_nodes: number;    // 主节点数
  worker_nodes: number;    // 工作节点数
}

// Pod统计
export interface PodStats {
  total_pods: number;     // 总Pod数
  running_pods: number;   // 运行中Pod数
  pending_pods: number;   // 等待中Pod数
  succeeded_pods: number; // 成功Pod数
  failed_pods: number;    // 失败Pod数
  unknown_pods: number;   // 未知状态Pod数
}

// 命名空间统计
export interface NamespaceStats {
  total_namespaces: number;  // 总命名空间数
  active_namespaces: number; // 活跃命名空间数
  system_namespaces: number; // 系统命名空间数
  user_namespaces: number;   // 用户命名空间数
  top_namespaces: string[];  // 资源使用较多的命名空间
}

// 工作负载统计
export interface WorkloadStats {
  deployments: number;  // Deployment数量
  statefulsets: number; // StatefulSet数量
  daemonsets: number;   // DaemonSet数量
  jobs: number;         // Job数量
  cronjobs: number;     // CronJob数量
  services: number;     // Service数量
  configmaps: number;   // ConfigMap数量
  secrets: number;      // Secret数量
  ingresses: number;    // Ingress数量
}

// 资源统计
export interface ResourceStats {
  total_cpu: string;           // 总CPU
  total_memory: string;        // 总内存
  total_storage: string;       // 总存储
  used_cpu: string;            // 已使用CPU
  used_memory: string;         // 已使用内存
  used_storage: string;        // 已使用存储
  cpu_utilization: number;     // CPU使用率
  memory_utilization: number;  // 内存使用率
  storage_utilization: number; // 存储使用率
}

// 存储统计
export interface StorageStats {
  total_pv: number;        // 总PV数量
  bound_pv: number;        // 已绑定PV数量
  available_pv: number;    // 可用PV数量
  total_pvc: number;       // 总PVC数量
  bound_pvc: number;       // 已绑定PVC数量
  pending_pvc: number;     // 等待中PVC数量
  storage_classes: number; // 存储类数量
  total_capacity: string;  // 总容量
}

// 网络统计
export interface NetworkStats {
  services: number;         // Service数量
  endpoints: number;        // Endpoint数量
  ingresses: number;        // Ingress数量
  network_policies: number; // NetworkPolicy数量
}

// 事件统计
export interface EventStats {
  total_events: number;   // 总事件数
  warning_events: number; // 警告事件数
  normal_events: number;  // 正常事件数
  recent_events: number;  // 最近事件数（1小时内）
}

// 集群统计信息
export interface ClusterStats {
  cluster_id: number;       // 集群ID
  cluster_name: string;     // 集群名称
  last_update_time: string; // 最后更新时间
  node_stats: NodeStats;      // 节点统计
  pod_stats: PodStats;        // Pod统计
  namespace_stats: NamespaceStats;  // 命名空间统计
  workload_stats: WorkloadStats;    // 工作负载统计
  resource_stats: ResourceStats;    // 资源统计
  storage_stats: StorageStats;      // 存储统计
  network_stats: NetworkStats;      // 网络统计
  event_stats: EventStats;          // 事件统计
}

export interface K8sCluster {
  id?: number;
  name: string;                                    // 集群名称
  cpu_request?: string;                           // CPU 请求量 (m)
  cpu_limit?: string;                             // CPU 限制量 (m)
  memory_request?: string;                        // 内存请求量 (Mi)
  memory_limit?: string;                          // 内存限制量 (Mi)
  restrict_namespace: StringList;                 // 资源限制命名空间
  status: ClusterStatus;                          // 集群状态
  env?: Env;                                      // 集群环境
  version?: string;                               // 集群版本
  api_server_addr?: string;                       // API Server 地址
  kube_config_content?: string;                   // kubeConfig 内容
  action_timeout_seconds?: number;                // 操作超时时间（秒）
  create_user_name?: string;                      // 创建者用户名
  create_user_id?: number;                        // 创建者用户ID
  tags?: KeyValueList;                            // 标签
  created_at?: string;
  updated_at?: string;
}

// 创建集群请求
export interface CreateClusterReq {
  name: string;                           // 集群名称
  cpu_request?: string;                   // CPU 请求量
  cpu_limit?: string;                     // CPU 限制量
  memory_request?: string;                // 内存请求量
  memory_limit?: string;                  // 内存限制量
  restrict_namespace: StringList;         // 资源限制命名空间
  status: ClusterStatus;                  // 集群状态
  env?: Env;                              // 集群环境
  version?: string;                       // 集群版本
  api_server_addr?: string;               // API Server 地址
  kube_config_content?: string;           // kubeConfig 内容
  action_timeout_seconds?: number;        // 操作超时时间（秒）
  tags?: KeyValueList;                    // 标签
}

// 更新集群请求
export interface UpdateClusterReq {
  id: number;                             // 集群ID
  name: string;                           // 集群名称
  cpu_request?: string;                   // CPU 请求量
  cpu_limit?: string;                     // CPU 限制量
  memory_request?: string;                // 内存请求量
  memory_limit?: string;                  // 内存限制量
  restrict_namespace: StringList;         // 资源限制命名空间
  status: ClusterStatus;                  // 集群状态
  env?: Env;                              // 集群环境
  version?: string;                       // 集群版本
  api_server_addr?: string;               // API Server 地址
  kube_config_content?: string;           // kubeConfig 内容
  action_timeout_seconds?: number;        // 操作超时时间（秒）
  tags?: KeyValueList;                    // 标签
}

// 删除集群请求
export interface DeleteClusterReq {
  id: number; // 集群ID
}

// 刷新集群请求
export interface RefreshClusterReq {
  id: number; // 集群ID
}

// 检查集群健康请求
export interface CheckClusterHealthReq {
  id: number; // 集群ID
}

// 获取集群统计请求
export interface GetClusterStatsReq {
  id: number; // 集群ID
}

// 获取单个集群请求
export interface GetClusterReq {
  id: number; // 集群ID
}

// 获取集群列表请求
export interface ListClustersReq {
  page?: number;       // 页码
  size?: number;  // 每页数量
  search?: string;     // 搜索
  status?: string;     // 集群状态过滤
  env?: string;        // 环境过滤
}

// 刷新集群状态请求
export interface RefreshClusterStatusReq {
  id: number; // 集群ID
}

/**
 * 获取集群列表
 */
export async function getClustersListApi(params?: ListClustersReq) {
  return requestClient.get('/k8s/clusters/list', { params });
}

/**
 * 获取集群详情
 */
export async function getClusterDetailApi(id: number) {
  return requestClient.get(`/k8s/clusters/${id}/detail`);
}

/**
 * 创建集群
 */
export async function createClusterApi(data: CreateClusterReq) {
  return requestClient.post('/k8s/clusters/create', data);
}

/**
 * 更新集群
 */
export async function updateClusterApi(id: number, data: UpdateClusterReq) {
  return requestClient.put(`/k8s/clusters/${id}/update`, data);
}

/**
 * 删除集群
 */
export async function deleteClusterApi(id: number) {
  return requestClient.delete(`/k8s/clusters/${id}/delete`);
}

/**
 * 刷新集群状态
 */
export async function refreshClusterApi(id: number) {
  return requestClient.post(`/k8s/clusters/${id}/refresh`);
}

/**
 * 检查集群健康状态
 */
export async function checkClusterHealthApi(id: number) {
  return requestClient.get(`/k8s/clusters/${id}/health`);
}

/**
 * 获取集群统计信息
 */
export async function getClusterStatsApi(id: number) {
  return requestClient.get(`/k8s/clusters/${id}/stats`);
}
