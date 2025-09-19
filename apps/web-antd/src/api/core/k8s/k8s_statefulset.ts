import { requestClient } from '#/api/request';
import type { KeyValueList } from './k8s_cluster';

// StatefulSet状态枚举
export enum K8sStatefulSetStatus {
  Running = 1, // 运行中
  Stopped = 2, // 停止
  Updating = 3, // 更新中
  Error = 4    // 异常
}

// StatefulSet条件
export interface StatefulSetCondition {
  type: string; // 条件类型
  status: string; // 条件状态
  last_update_time: string; // 最后更新时间
  last_transition_time: string; // 最后转换时间
  reason: string; // 原因
  message: string; // 消息
}

// StatefulSet规格
export interface statefulsetpec {
  replicas?: number; // 副本数量
  selector?: any; // 标签选择器
  template?: any; // Pod模板
  volume_claim_templates?: any[]; // 卷声明模板
  service_name: string; // 服务名称
  pod_management_policy?: string; // Pod管理策略
  update_strategy?: any; // 更新策略
  revision_history_limit?: number; // 历史版本限制
  min_ready_seconds?: number; // 最小就绪时间
}

// StatefulSet信息
export interface K8sStatefulSet {
  name: string; // StatefulSet名称
  namespace: string; // 所属命名空间
  cluster_id: number; // 所属集群ID
  uid?: string; // StatefulSet UID
  replicas: number; // 期望副本数
  ready_replicas: number; // 就绪副本数
  current_replicas: number; // 当前副本数
  updated_replicas: number; // 更新副本数
  service_name: string; // 服务名称
  update_strategy?: string; // 更新策略
  revision_history_limit?: number; // 历史版本限制
  pod_management_policy?: string; // Pod管理策略
  selector?: KeyValueList; // 选择器
  labels?: KeyValueList; // 标签
  annotations?: KeyValueList; // 注解
  images?: string[]; // 容器镜像列表
  status: K8sStatefulSetStatus; // StatefulSet状态
  conditions?: StatefulSetCondition[]; // StatefulSet条件
  created_at: string; // 创建时间
  updated_at: string; // 更新时间
}

// StatefulSet历史版本
export interface K8sStatefulSetHistory {
  revision: number; // 版本
  date: string; // 日期
  message: string; // 消息
}

// 获取StatefulSet列表请求
export interface GetStatefulSetListReq {
  page?: number; // 页码
  size?: number; // 每页数量
  search?: string; // 搜索
  cluster_id: number; // 集群ID，必填
  namespace?: string; // 命名空间
  status?: string; // StatefulSet状态
  service_name?: string; // 服务名称
  labels?: KeyValueList; // 标签
}

// 获取StatefulSet详情请求
export interface GetStatefulSetDetailsReq {
  cluster_id: number; // 集群ID
  namespace: string; // 命名空间
  name: string; // StatefulSet名称
}

// 获取StatefulSet YAML请求
export interface GetStatefulSetYamlReq {
  cluster_id: number; // 集群ID
  namespace: string; // 命名空间
  name: string; // StatefulSet名称
}

// 创建StatefulSet请求
export interface CreateStatefulSetReq {
  cluster_id: number; // 集群ID，必填
  name: string; // StatefulSet名称，必填
  namespace: string; // 命名空间，必填
  replicas: number; // 副本数量，必填
  service_name: string; // 服务名称，必填
  images: string[]; // 容器镜像列表，必填
  labels?: KeyValueList; // 标签
  annotations?: KeyValueList; // 注解
  spec?: statefulsetpec; // StatefulSet规格
  yaml?: string; // YAML内容
}

// 通过YAML创建StatefulSet请求
export interface CreateStatefulSetByYamlReq {
  cluster_id: number; // 集群ID，必填
  yaml: string; // YAML内容，必填
}

// 更新StatefulSet请求
export interface UpdateStatefulSetReq {
  cluster_id?: number; // 集群ID
  name?: string; // StatefulSet名称
  namespace?: string; // 命名空间
  replicas?: number; // 副本数量
  service_name?: string; // 服务名称
  images?: string[]; // 容器镜像列表
  labels?: Record<string, string>; // 标签
  annotations?: Record<string, string>; // 注解
  spec?: statefulsetpec; // StatefulSet规格
  yaml?: string; // YAML内容
}

// 通过YAML更新StatefulSet请求
export interface UpdateStatefulSetByYamlReq {
  cluster_id?: number; // 集群ID
  namespace?: string; // 命名空间
  name?: string; // StatefulSet名称
  yaml: string; // YAML内容，必填
}

// 删除StatefulSet请求
export interface DeleteStatefulSetReq {
  cluster_id?: number; // 集群ID
  namespace?: string; // 命名空间
  name?: string; // StatefulSet名称
}

// 重启StatefulSet请求
export interface RestartStatefulSetReq {
  cluster_id: number; // 集群ID
  namespace: string; // 命名空间
  name: string; // StatefulSet名称
}

// 伸缩StatefulSet请求
export interface ScaleStatefulSetReq {
  cluster_id: number; // 集群ID
  namespace: string; // 命名空间
  name: string; // StatefulSet名称
  replicas: number; // 副本数量，必填
}

// 获取StatefulSet下的Pod列表请求
export interface GetStatefulSetPodsReq {
  cluster_id: number; // 集群ID
  namespace: string; // 命名空间
  name: string; // StatefulSet名称
}

// 获取StatefulSet版本历史请求
export interface GetStatefulSetHistoryReq {
  cluster_id: number; // 集群ID
  namespace: string; // 命名空间
  name: string; // StatefulSet名称
}

// 回滚StatefulSet请求
export interface RollbackStatefulSetReq {
  cluster_id: number; // 集群ID
  namespace: string; // 命名空间
  name: string; // StatefulSet名称
  revision: number; // 回滚到的版本号，必填
}

// YAML响应
export interface K8sStatefulSetYaml {
  yaml: string; // YAML内容
}

/**
 * 获取StatefulSet列表
 */
export async function getStatefulSetListApi(clusterId: number, params?: GetStatefulSetListReq) {
  return requestClient.get(`/k8s/statefulset/${clusterId}/list`, { params });
}

/**
 * 获取StatefulSet详情
 */
export async function getStatefulSetDetailsApi(clusterId: number, namespace: string, name: string) {
  return requestClient.get(`/k8s/statefulset/${clusterId}/${namespace}/${name}/detail`);
}

/**
 * 获取StatefulSet YAML
 */
export async function getStatefulSetYamlApi(clusterId: number, namespace: string, name: string) {
  return requestClient.get(`/k8s/statefulset/${clusterId}/${namespace}/${name}/detail/yaml`);
}

/**
 * 创建StatefulSet
 */
export async function createStatefulSetApi(clusterId: number, data: CreateStatefulSetReq) {
  return requestClient.post(`/k8s/statefulset/${clusterId}/create`, data);
}

/**
 * 通过YAML创建StatefulSet
 */
export async function createStatefulSetByYamlApi(clusterId: number, data: CreateStatefulSetByYamlReq) {
  return requestClient.post(`/k8s/statefulset/${clusterId}/create/yaml`, data);
}

/**
 * 更新StatefulSet
 */
export async function updateStatefulSetApi(clusterId: number, namespace: string, name: string, data: UpdateStatefulSetReq) {
  return requestClient.put(`/k8s/statefulset/${clusterId}/${namespace}/${name}/update`, data);
}

/**
 * 通过YAML更新StatefulSet
 */
export async function updateStatefulSetByYamlApi(clusterId: number, namespace: string, name: string, data: UpdateStatefulSetByYamlReq) {
  return requestClient.put(`/k8s/statefulset/${clusterId}/${namespace}/${name}/update/yaml`, data);
}

/**
 * 删除StatefulSet
 */
export async function deleteStatefulSetApi(clusterId: number, namespace: string, name: string, data?: DeleteStatefulSetReq) {
  return requestClient.delete(`/k8s/statefulset/${clusterId}/${namespace}/${name}/delete`, { data });
}

/**
 * 重启StatefulSet
 */
export async function restartStatefulSetApi(clusterId: number, namespace: string, name: string, data: RestartStatefulSetReq) {
  return requestClient.post(`/k8s/statefulset/${clusterId}/${namespace}/${name}/restart`, data);
}

/**
 * 伸缩StatefulSet
 */
export async function scaleStatefulSetApi(clusterId: number, namespace: string, name: string, data: ScaleStatefulSetReq) {
  return requestClient.post(`/k8s/statefulset/${clusterId}/${namespace}/${name}/scale`, data);
}

/**
 * 回滚StatefulSet
 */
export async function rollbackStatefulSetApi(clusterId: number, namespace: string, name: string, data: RollbackStatefulSetReq) {
  return requestClient.post(`/k8s/statefulset/${clusterId}/${namespace}/${name}/rollback`, data);
}

/**
 * 获取StatefulSet下的Pod列表
 */
export async function getStatefulSetPodsApi(clusterId: number, namespace: string, name: string) {
  return requestClient.get(`/k8s/statefulset/${clusterId}/${namespace}/${name}/pods`);
}

/**
 * 获取StatefulSet版本历史
 */
export async function getStatefulSetHistoryApi(clusterId: number, namespace: string, name: string) {
  return requestClient.get(`/k8s/statefulset/${clusterId}/${namespace}/${name}/history`);
}
