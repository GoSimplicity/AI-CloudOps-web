import { requestClient } from '#/api/request';
import type { 
  ContainerPort, 
  EnvVar, 
  ResourceRequirements, 
  VolumeMount, 
  Probe 
} from './k8s_types';

// DaemonSet相关接口和类型定义

export enum K8sDaemonSetStatus {
  Running = 1,  // 运行中
  Error = 2,    // 异常
  Updating = 3, // 更新中
}

export interface DaemonSetCondition {
  type: string;                 // 条件类型
  status: string;               // 条件状态
  last_update_time: string;     // 最后更新时间
  last_transition_time: string; // 最后转换时间
  reason: string;               // 原因
  message: string;              // 消息
}

export interface K8sDaemonSet {
  id: number;
  name: string;                               // DaemonSet名称
  namespace: string;                          // 所属命名空间
  cluster_id: number;                         // 所属集群ID
  uid: string;                                // DaemonSet UID
  desired_number_scheduled: number;           // 期望调度数量
  current_number_scheduled: number;           // 当前调度数量
  number_ready: number;                       // 就绪数量
  number_available: number;                   // 可用数量
  number_unavailable: number;                 // 不可用数量
  updated_number_scheduled: number;           // 更新调度数量
  number_misscheduled: number;                // 错误调度数量
  update_strategy: string;                    // 更新策略
  revision_history_limit: number;             // 历史版本限制
  selector: Record<string, string>;           // 标签选择器
  labels: Record<string, string>;             // 标签
  annotations: Record<string, string>;        // 注解
  images: string[];                           // 容器镜像列表
  status: K8sDaemonSetStatus;                 // DaemonSet状态
  conditions: DaemonSetCondition[];           // DaemonSet条件
  created_at: string;                         // 创建时间
  updated_at: string;                         // 更新时间
}

export interface DaemonSetSpec {
  selector?: any;                             // 标签选择器
  template?: any;                             // Pod模板
  update_strategy?: any;                      // 更新策略
  min_ready_seconds?: number;                 // 最小就绪时间
  revision_history_limit?: number;            // 历史版本限制
}

export interface K8sDaemonSetEvent {
  type: string;                              // 事件类型
  reason: string;                            // 事件原因
  message: string;                           // 事件消息
  count: number;                             // 事件计数
  first_time: string;                        // 首次发生时间
  last_time: string;                         // 最后发生时间
  source: string;                            // 事件源
}

export interface K8sDaemonSetMetrics {
  cpu_usage: number;                         // CPU使用率
  memory_usage: number;                      // 内存使用率
  network_in: number;                        // 网络入流量（MB/s）
  network_out: number;                       // 网络出流量（MB/s）
  disk_usage: number;                        // 磁盘使用率
  nodes_ready: number;                       // 就绪节点数
  nodes_total: number;                       // 总节点数
  restart_count: number;                     // 重启次数
  availability_rate: number;                 // 可用性
  last_updated: string;                      // 最后更新时间
  metrics_available: boolean;                // 是否有详细指标数据（需要metrics-server）
  metrics_note?: string;                     // 指标说明信息
}

export interface K8sDaemonSetHistory {
  revision: number;                          // 版本
  date: string;                              // 日期
  message: string;                           // 消息
}

export interface GetDaemonSetListReq {
  page?: number;                             // 页码
  size?: number;                             // 每页大小
  cluster_id: number;                        // 集群ID
  namespace?: string;                        // 命名空间
  status?: string;                           // DaemonSet状态
  labels?: Record<string, string>;           // 标签
}

export interface GetDaemonSetDetailsReq {
  cluster_id: number;                        // 集群ID
  namespace: string;                         // 命名空间
  name: string;                              // DaemonSet名称
}

export interface GetDaemonSetYamlReq {
  cluster_id: number;                        // 集群ID
  namespace: string;                         // 命名空间
  name: string;                              // DaemonSet名称
}

export interface CreateDaemonSetReq {
  cluster_id: number;                        // 集群ID
  name: string;                              // DaemonSet名称
  namespace: string;                         // 命名空间
  images: string[];                          // 容器镜像列表
  labels?: Record<string, string>;           // 标签
  annotations?: Record<string, string>;      // 注解
  spec: DaemonSetSpec;                       // DaemonSet规格
  yaml?: string;                             // YAML内容
}

export interface UpdateDaemonSetReq {
  cluster_id: number;                        // 集群ID
  name: string;                              // DaemonSet名称
  namespace: string;                         // 命名空间
  edit_mode: 'visual' | 'yaml';              // 编辑模式
  
  // 可视化编辑字段
  containers?: ContainerConfig[];            // 容器配置
  labels?: Record<string, string>;           // 标签
  annotations?: Record<string, string>;      // 注解
  update_strategy?: string;                  // 更新策略
  min_ready_seconds?: number;                // 最小就绪时间
  revision_history_limit?: number;           // 版本历史限制
  
  // YAML编辑字段
  yaml?: string;                             // YAML内容
  
  // 向后兼容
  images?: string[];                         // 容器镜像列表（向后兼容）
  spec?: DaemonSetSpec;                      // DaemonSet规格（向后兼容）
}

export interface ContainerConfig {
  name: string;                              // 容器名称
  image: string;                             // 镜像地址
  image_pull_policy?: string;                // 镜像拉取策略
  command?: string[];                        // 启动命令
  args?: string[];                           // 启动参数
  ports?: ContainerPort[];                   // 端口配置
  env_vars?: EnvVar[];                       // 环境变量
  resources?: ResourceRequirements;          // 资源配置
  volume_mounts?: VolumeMount[];             // 挂载配置
  liveness_probe?: Probe;                    // 存活探针
  readiness_probe?: Probe;                   // 就绪探针
}

export interface DeleteDaemonSetReq {
  cluster_id: number;                        // 集群ID
  namespace: string;                         // 命名空间
  name: string;                              // DaemonSet名称
}

export interface RestartDaemonSetReq {
  cluster_id: number;                        // 集群ID
  namespace: string;                         // 命名空间
  name: string;                              // DaemonSet名称
}

export interface GetDaemonSetMetricsReq {
  cluster_id: number;                        // 集群ID
  namespace: string;                         // 命名空间
  name: string;                              // DaemonSet名称
  start_time?: string;                       // 开始时间
  end_time?: string;                         // 结束时间
  step?: string;                             // 查询步长
}

export interface GetDaemonSetEventsReq {
  cluster_id: number;                        // 集群ID
  namespace: string;                         // 命名空间
  name: string;                              // DaemonSet名称
  event_type?: string;                       // 事件类型
  limit?: number;                            // 限制数量
}

export interface GetDaemonSetPodsReq {
  cluster_id: number;                        // 集群ID
  namespace: string;                         // 命名空间
  name: string;                              // DaemonSet名称
}

export interface GetDaemonSetHistoryReq {
  cluster_id: number;                        // 集群ID
  namespace: string;                         // 命名空间
  name: string;                              // DaemonSet名称
}

export interface RollbackDaemonSetReq {
  cluster_id: number;                        // 集群ID
  namespace: string;                         // 命名空间
  name: string;                              // DaemonSet名称
  revision: number;                          // 回滚到的版本号
}

/**
 * 获取DaemonSet列表
 */
export async function getDaemonSetListApi(params: GetDaemonSetListReq) {
  return requestClient.get('/k8s/daemonsets', { params });
}

/**
 * 获取DaemonSet详情
 */
export async function getDaemonSetDetailsApi(
  clusterId: number,
  namespace: string,
  name: string,
) {
  return requestClient.get(`/k8s/daemonsets/${clusterId}/${namespace}/${name}`);
}

/**
 * 获取DaemonSet YAML
 */
export async function getDaemonSetYamlApi(
  clusterId: number,
  namespace: string,
  name: string,
) {
  return requestClient.get(`/k8s/daemonsets/${clusterId}/${namespace}/${name}/yaml`);
}

/**
 * 创建DaemonSet
 */
export async function createDaemonSetApi(data: CreateDaemonSetReq) {
  return requestClient.post('/k8s/daemonsets', data);
}

/**
 * 更新DaemonSet
 */
export async function updateDaemonSetApi(
  clusterId: number,
  namespace: string,
  name: string,
  data: UpdateDaemonSetReq,
) {
  return requestClient.put(`/k8s/daemonsets/${clusterId}/${namespace}/${name}`, data);
}

/**
 * 删除DaemonSet
 */
export async function deleteDaemonSetApi(
  clusterId: number,
  namespace: string,
  name: string,
) {
  return requestClient.delete(`/k8s/daemonsets/${clusterId}/${namespace}/${name}`);
}

/**
 * 重启DaemonSet
 */
export async function restartDaemonSetApi(
  clusterId: number,
  namespace: string,
  name: string,
  data: RestartDaemonSetReq,
) {
  return requestClient.post(`/k8s/daemonsets/${clusterId}/${namespace}/${name}/restart`, data);
}

/**
 * 获取DaemonSet指标
 */
export async function getDaemonSetMetricsApi(
  clusterId: number,
  namespace: string,
  name: string,
  params?: GetDaemonSetMetricsReq,
) {
  return requestClient.get(`/k8s/daemonsets/${clusterId}/${namespace}/${name}/metrics`, { params });
}

/**
 * 获取DaemonSet事件
 */
export async function getDaemonSetEventsApi(
  clusterId: number,
  namespace: string,
  name: string,
  params?: GetDaemonSetEventsReq,
) {
  return requestClient.get(`/k8s/daemonsets/${clusterId}/${namespace}/${name}/events`, { params });
}

/**
 * 获取DaemonSet下的Pod列表
 */
export async function getDaemonSetPodsApi(
  clusterId: number,
  namespace: string,
  name: string,
) {
  return requestClient.get(`/k8s/daemonsets/${clusterId}/${namespace}/${name}/pods`);
}

/**
 * 获取DaemonSet历史
 */
export async function getDaemonSetHistoryApi(
  clusterId: number,
  namespace: string,
  name: string,
) {
  return requestClient.get(`/k8s/daemonsets/${clusterId}/${namespace}/${name}/history`);
}

/**
 * 回滚DaemonSet
 */
export async function rollbackDaemonSetApi(
  clusterId: number,
  namespace: string,
  name: string,
  data: RollbackDaemonSetReq,
) {
  return requestClient.post(`/k8s/daemonsets/${clusterId}/${namespace}/${name}/rollback`, data);
}
