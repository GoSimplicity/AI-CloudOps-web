import { requestClient } from '#/api/request';

// DaemonSet状态枚举
export enum K8sDaemonSetStatus {
  Running = 1, // 运行中
  Error = 2,   // 异常
  Updating = 3 // 更新中
}

// DaemonSet条件
export interface DaemonSetCondition {
  type: string; // 条件类型
  status: string; // 条件状态
  last_update_time: string; // 最后更新时间
  last_transition_time: string; // 最后转换时间
  reason: string; // 原因
  message: string; // 消息
}

// DaemonSet规格
export interface DaemonSetSpec {
  selector?: any; // 标签选择器
  template?: any; // Pod模板
  update_strategy?: any; // 更新策略
  min_ready_seconds?: number; // 最小就绪时间
  revision_history_limit?: number; // 历史版本限制
}

// DaemonSet信息
export interface K8sDaemonSet {
  name: string; // DaemonSet名称
  namespace: string; // 所属命名空间
  cluster_id: number; // 所属集群ID
  uid?: string; // DaemonSet UID
  desired_number_scheduled: number; // 期望调度数量
  current_number_scheduled: number; // 当前调度数量
  number_ready: number; // 就绪数量
  number_available: number; // 可用数量
  number_unavailable: number; // 不可用数量
  updated_number_scheduled: number; // 更新调度数量
  number_misscheduled: number; // 错误调度数量
  update_strategy?: string; // 更新策略
  revision_history_limit?: number; // 历史版本限制
  selector?: Record<string, string>; // 标签选择器
  labels?: Record<string, string>; // 标签
  annotations?: Record<string, string>; // 注解
  images?: string[]; // 容器镜像列表
  status: K8sDaemonSetStatus; // DaemonSet状态
  conditions?: DaemonSetCondition[]; // DaemonSet条件
  created_at: string; // 创建时间
  updated_at: string; // 更新时间
}

// DaemonSet历史版本
export interface K8sDaemonSetHistory {
  revision: number; // 版本
  date: string; // 日期
  message: string; // 消息
}

// 获取DaemonSet列表请求
export interface GetDaemonSetListReq {
  page?: number; // 页码
  size?: number; // 每页数量
  search?: string; // 搜索
  cluster_id: number; // 集群ID，必填
  namespace?: string; // 命名空间
  status?: string; // DaemonSet状态
  labels?: Record<string, string>; // 标签
}

// 获取DaemonSet详情请求
export interface GetDaemonSetDetailsReq {
  cluster_id: number; // 集群ID
  namespace: string; // 命名空间
  name: string; // DaemonSet名称
}

// 获取DaemonSet YAML请求
export interface GetDaemonSetYamlReq {
  cluster_id: number; // 集群ID
  namespace: string; // 命名空间
  name: string; // DaemonSet名称
}

// 创建DaemonSet请求
export interface CreateDaemonSetReq {
  cluster_id: number; // 集群ID，必填
  name: string; // DaemonSet名称，必填
  namespace: string; // 命名空间，必填
  images: string[]; // 容器镜像列表，必填
  labels?: Record<string, string>; // 标签
  annotations?: Record<string, string>; // 注解
  spec?: DaemonSetSpec; // DaemonSet规格
  yaml?: string; // YAML内容
}

// 更新DaemonSet请求
export interface UpdateDaemonSetReq {
  cluster_id?: number; // 集群ID
  name?: string; // DaemonSet名称
  namespace?: string; // 命名空间
  images?: string[]; // 容器镜像列表
  labels?: Record<string, string>; // 标签
  annotations?: Record<string, string>; // 注解
  spec?: DaemonSetSpec; // DaemonSet规格
  yaml?: string; // YAML内容
}

// 删除DaemonSet请求
export interface DeleteDaemonSetReq {
  cluster_id: number; // 集群ID
  namespace: string; // 命名空间
  name: string; // DaemonSet名称
}

// 重启DaemonSet请求
export interface RestartDaemonSetReq {
  cluster_id: number; // 集群ID
  namespace: string; // 命名空间
  name: string; // DaemonSet名称
}

// 获取DaemonSet下的Pod列表请求
export interface GetDaemonSetPodsReq {
  cluster_id: number; // 集群ID
  namespace: string; // 命名空间
  name: string; // DaemonSet名称
}

// 获取DaemonSet版本历史请求
export interface GetDaemonSetHistoryReq {
  cluster_id: number; // 集群ID
  namespace: string; // 命名空间
  name: string; // DaemonSet名称
}

// 通过YAML创建DaemonSet请求
export interface CreateDaemonSetByYamlReq {
  cluster_id: number; // 集群ID，必填
  yaml: string; // YAML内容，必填
}

// 通过YAML更新DaemonSet请求
export interface UpdateDaemonSetByYamlReq {
  cluster_id?: number; // 集群ID
  namespace?: string; // 命名空间
  name?: string; // DaemonSet名称
  yaml: string; // YAML内容，必填
}

// 回滚DaemonSet请求
export interface RollbackDaemonSetReq {
  cluster_id: number; // 集群ID
  namespace: string; // 命名空间
  name: string; // DaemonSet名称
  revision: number; // 回滚到的版本号，必填
}

// YAML响应
export interface K8sDaemonSetYaml {
  yaml: string; // YAML内容
}

/**
 * 获取DaemonSet列表
 */
export async function getDaemonSetListApi(clusterId: number, params?: GetDaemonSetListReq) {
  return requestClient.get(`/k8s/daemonset/${clusterId}/list`, { params });
}

/**
 * 获取DaemonSet详情
 */
export async function getDaemonSetDetailsApi(clusterId: number, namespace: string, name: string) {
  return requestClient.get(`/k8s/daemonset/${clusterId}/${namespace}/${name}/detail`);
}

/**
 * 获取DaemonSet YAML
 */
export async function getDaemonSetYamlApi(clusterId: number, namespace: string, name: string) {
  return requestClient.get(`/k8s/daemonset/${clusterId}/${namespace}/${name}/detail/yaml`);
}

/**
 * 创建DaemonSet
 */
export async function createDaemonSetApi(clusterId: number, data: CreateDaemonSetReq) {
  return requestClient.post(`/k8s/daemonset/${clusterId}/create`, data);
}

/**
 * 通过YAML创建DaemonSet
 */
export async function createDaemonSetByYamlApi(clusterId: number, data: CreateDaemonSetByYamlReq) {
  return requestClient.post(`/k8s/daemonset/${clusterId}/create/yaml`, data);
}

/**
 * 更新DaemonSet
 */
export async function updateDaemonSetApi(clusterId: number, namespace: string, name: string, data: UpdateDaemonSetReq) {
  return requestClient.put(`/k8s/daemonset/${clusterId}/${namespace}/${name}/update`, data);
}

/**
 * 通过YAML更新DaemonSet
 */
export async function updateDaemonSetByYamlApi(clusterId: number, namespace: string, name: string, data: UpdateDaemonSetByYamlReq) {
  return requestClient.put(`/k8s/daemonset/${clusterId}/${namespace}/${name}/update/yaml`, data);
}

/**
 * 删除DaemonSet
 */
export async function deleteDaemonSetApi(clusterId: number, namespace: string, name: string, data?: DeleteDaemonSetReq) {
  return requestClient.delete(`/k8s/daemonset/${clusterId}/${namespace}/${name}/delete`, { data });
}

/**
 * 重启DaemonSet
 */
export async function restartDaemonSetApi(clusterId: number, namespace: string, name: string, data?: RestartDaemonSetReq) {
  return requestClient.post(`/k8s/daemonset/${clusterId}/${namespace}/${name}/restart`, data);
}

/**
 * 回滚DaemonSet
 */
export async function rollbackDaemonSetApi(clusterId: number, namespace: string, name: string, data: RollbackDaemonSetReq) {
  return requestClient.post(`/k8s/daemonset/${clusterId}/${namespace}/${name}/rollback`, data);
}

/**
 * 获取DaemonSet下的Pod列表
 */
export async function getDaemonSetPodsApi(clusterId: number, namespace: string, name: string) {
  return requestClient.get(`/k8s/daemonset/${clusterId}/${namespace}/${name}/pods`);
}

/**
 * 获取DaemonSet版本历史
 */
export async function getDaemonSetHistoryApi(clusterId: number, namespace: string, name: string) {
  return requestClient.get(`/k8s/daemonset/${clusterId}/${namespace}/${name}/history`);
}
