import { requestClient } from '#/api/request';

// StatefulSet相关接口和类型定义

export enum K8sStatefulSetStatus {
  Running = 1,  // 运行中
  Stopped = 2,  // 停止
  Updating = 3, // 更新中
  Error = 4,    // 异常
}

export interface StatefulSetCondition {
  type: string;                 // 条件类型
  status: string;               // 条件状态
  last_update_time: string;     // 最后更新时间
  last_transition_time: string; // 最后转换时间
  reason: string;               // 原因
  message: string;              // 消息
}

export interface K8sStatefulSet {
  id: number;
  name: string;                               // StatefulSet名称
  namespace: string;                          // 所属命名空间
  cluster_id: number;                         // 所属集群ID
  uid: string;                                // StatefulSet UID
  replicas: number;                           // 期望副本数
  ready_replicas: number;                     // 就绪副本数
  current_replicas: number;                   // 当前副本数
  updated_replicas: number;                   // 更新副本数
  service_name: string;                       // 服务名称
  update_strategy: string;                    // 更新策略
  revision_history_limit: number;             // 历史版本限制
  pod_management_policy: string;              // Pod管理策略
  selector: Record<string, string>;           // 选择器
  labels: Record<string, string>;             // 标签
  annotations: Record<string, string>;        // 注解
  images: string[];                           // 容器镜像列表
  status: K8sStatefulSetStatus;               // StatefulSet状态
  conditions: StatefulSetCondition[];         // StatefulSet条件
  created_at: string;                         // 创建时间
  updated_at: string;                         // 更新时间
}

export interface StatefulSetSpec {
  replicas?: number;                          // 副本数量
  selector?: any;                             // 标签选择器
  template?: any;                             // Pod模板
  volume_claim_templates?: any[];             // 卷声明模板
  service_name: string;                       // 服务名称
  pod_management_policy?: string;             // Pod管理策略
  update_strategy?: any;                      // 更新策略
  revision_history_limit?: number;            // 历史版本限制
  min_ready_seconds?: number;                 // 最小就绪时间
}

export interface K8sStatefulSetEvent {
  type: string;       // 事件类型
  reason: string;     // 事件原因
  message: string;    // 事件消息
  count: number;      // 事件计数
  first_time: string; // 首次发生时间
  last_time: string;  // 最后发生时间
  source: string;     // 事件源
}

export interface K8sStatefulSetMetrics {
  cpu_usage: number;              // CPU使用率
  memory_usage: number;           // 内存使用率
  network_in: number;             // 网络入流量（MB/s）
  network_out: number;            // 网络出流量（MB/s）
  disk_usage: number;             // 磁盘使用率
  replicas_ready: number;         // 就绪副本数
  replicas_total: number;         // 总副本数
  restart_count: number;          // 重启次数
  availability_rate: number;      // 可用性
  last_updated: string;           // 最后更新时间
  metrics_available: boolean;     // 是否有详细指标数据（需要metrics-server）
  metrics_note?: string;          // 指标说明信息
}

export interface K8sStatefulSetHistory {
  revision: number; // 版本
  date: string;     // 日期
  message: string;  // 消息
}

export interface GetStatefulSetListReq {
  cluster_id: number;                    // 集群ID
  namespace?: string;                    // 命名空间
  status?: string;                       // StatefulSet状态
  service_name?: string;                 // 服务名称
  labels?: Record<string, string>;       // 标签
  page?: number;
  page_size?: number;
  keyword?: string;
}

export interface GetStatefulSetDetailsReq {
  cluster_id: number; // 集群ID
  namespace: string;  // 命名空间
  name: string;       // StatefulSet名称
}

export interface GetStatefulSetYamlReq {
  cluster_id: number; // 集群ID
  namespace: string;  // 命名空间
  name: string;       // StatefulSet名称
}

export interface CreateStatefulSetReq {
  cluster_id: number;                     // 集群ID
  name: string;                           // StatefulSet名称
  namespace: string;                      // 命名空间
  replicas: number;                       // 副本数量
  service_name: string;                   // 服务名称
  images: string[];                       // 容器镜像列表
  labels?: Record<string, string>;        // 标签
  annotations?: Record<string, string>;   // 注解
  spec: StatefulSetSpec;                  // StatefulSet规格
  yaml?: string;                          // YAML内容
}

export interface UpdateStatefulSetReq {
  cluster_id: number;                     // 集群ID
  name: string;                           // StatefulSet名称
  namespace: string;                      // 命名空间
  replicas?: number;                      // 副本数量
  service_name?: string;                  // 服务名称
  images?: string[];                      // 容器镜像列表
  labels?: Record<string, string>;        // 标签
  annotations?: Record<string, string>;   // 注解
  spec?: StatefulSetSpec;                 // StatefulSet规格
  yaml?: string;                          // YAML内容
}

export interface DeleteStatefulSetReq {
  cluster_id: number; // 集群ID
  namespace: string;  // 命名空间
  name: string;       // StatefulSet名称
}

export interface RestartStatefulSetReq {
  cluster_id: number; // 集群ID
  namespace: string;  // 命名空间
  name: string;       // StatefulSet名称
}

export interface ScaleStatefulSetReq {
  cluster_id: number; // 集群ID
  namespace: string;  // 命名空间
  name: string;       // StatefulSet名称
  replicas: number;   // 副本数量
}

export interface GetStatefulSetMetricsReq {
  cluster_id: number;   // 集群ID
  namespace: string;    // 命名空间
  name: string;         // StatefulSet名称
  start_time?: string;  // 开始时间
  end_time?: string;    // 结束时间
  step?: string;        // 查询步长
}

export interface GetStatefulSetEventsReq {
  cluster_id: number;   // 集群ID
  namespace: string;    // 命名空间
  name: string;         // StatefulSet名称
  event_type?: string;  // 事件类型
  limit?: number;       // 限制数量
}

export interface GetStatefulSetPodsReq {
  cluster_id: number; // 集群ID
  namespace: string;  // 命名空间
  name: string;       // StatefulSet名称
}

export interface GetStatefulSetHistoryReq {
  cluster_id: number; // 集群ID
  namespace: string;  // 命名空间
  name: string;       // StatefulSet名称
}

export interface RollbackStatefulSetReq {
  cluster_id: number; // 集群ID
  namespace: string;  // 命名空间
  name: string;       // StatefulSet名称
  revision: number;   // 回滚到的版本号
}

export interface UpdateStatefulSetYamlReq {
  cluster_id: number; // 集群ID
  namespace: string;  // 命名空间
  name: string;       // StatefulSet名称
  yaml: string;       // YAML内容
}

export interface FormatYamlReq {
  yaml: string;       // 需要格式化的YAML内容
}

/**
 * 获取StatefulSet列表
 */
export async function getStatefulSetListApi(params: GetStatefulSetListReq) {
  return requestClient.get('/k8s/statefulsets', { params });
}

/**
 * 获取StatefulSet详情
 */
export async function getStatefulSetDetailsApi(
  clusterId: number,
  namespace: string,
  name: string,
) {
  return requestClient.get(`/k8s/statefulsets/${clusterId}/${namespace}/${name}`);
}

/**
 * 获取StatefulSet YAML
 */
export async function getStatefulSetYamlApi(
  clusterId: number,
  namespace: string,
  name: string,
) {
  return requestClient.get(`/k8s/statefulsets/${clusterId}/${namespace}/${name}/yaml`);
}

/**
 * 创建StatefulSet
 */
export async function createStatefulSetApi(data: CreateStatefulSetReq) {
  return requestClient.post('/k8s/statefulsets', data);
}

/**
 * 更新StatefulSet
 */
export async function updateStatefulSetApi(
  clusterId: number,
  namespace: string,
  name: string,
  data: UpdateStatefulSetReq,
) {
  return requestClient.put(`/k8s/statefulsets/${clusterId}/${namespace}/${name}`, data);
}

/**
 * 删除StatefulSet
 */
export async function deleteStatefulSetApi(
  clusterId: number,
  namespace: string,
  name: string,
) {
  return requestClient.delete(`/k8s/statefulsets/${clusterId}/${namespace}/${name}`);
}

/**
 * 重启StatefulSet
 */
export async function restartStatefulSetApi(
  clusterId: number,
  namespace: string,
  name: string,
  data: RestartStatefulSetReq,
) {
  return requestClient.post(`/k8s/statefulsets/${clusterId}/${namespace}/${name}/restart`, data);
}

/**
 * 缩放StatefulSet
 */
export async function scaleStatefulSetApi(
  clusterId: number,
  namespace: string,
  name: string,
  data: ScaleStatefulSetReq,
) {
  return requestClient.post(`/k8s/statefulsets/${clusterId}/${namespace}/${name}/scale`, data);
}

/**
 * 获取StatefulSet指标
 */
export async function getStatefulSetMetricsApi(
  clusterId: number,
  namespace: string,
  name: string,
  params?: GetStatefulSetMetricsReq,
) {
  return requestClient.get(`/k8s/statefulsets/${clusterId}/${namespace}/${name}/metrics`, { params });
}

/**
 * 获取StatefulSet事件
 */
export async function getStatefulSetEventsApi(
  clusterId: number,
  namespace: string,
  name: string,
  params?: GetStatefulSetEventsReq,
) {
  return requestClient.get(`/k8s/statefulsets/${clusterId}/${namespace}/${name}/events`, { params });
}

/**
 * 获取StatefulSet下的Pod列表
 */
export async function getStatefulSetPodsApi(
  clusterId: number,
  namespace: string,
  name: string,
) {
  return requestClient.get(`/k8s/statefulsets/${clusterId}/${namespace}/${name}/pods`);
}

/**
 * 获取StatefulSet历史
 */
export async function getStatefulSetHistoryApi(
  clusterId: number,
  namespace: string,
  name: string,
) {
  return requestClient.get(`/k8s/statefulsets/${clusterId}/${namespace}/${name}/history`);
}

/**
 * 回滚StatefulSet
 */
export async function rollbackStatefulSetApi(
  clusterId: number,
  namespace: string,
  name: string,
  data: RollbackStatefulSetReq,
) {
  return requestClient.post(`/k8s/statefulsets/${clusterId}/${namespace}/${name}/rollback`, data);
}

/**
 * 通过YAML更新StatefulSet
 */
export async function updateStatefulSetYamlApi(
  clusterId: number,
  namespace: string,
  name: string,
  data: UpdateStatefulSetYamlReq,
) {
  return requestClient.put(`/k8s/statefulsets/${clusterId}/${namespace}/${name}/yaml`, data);
}

/**
 * 格式化YAML内容
 */
export async function formatYamlApi(data: FormatYamlReq) {
  return requestClient.post('/k8s/yaml/format', data);
}
