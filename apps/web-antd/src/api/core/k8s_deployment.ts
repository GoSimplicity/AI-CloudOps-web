import { requestClient } from '#/api/request';

// Deployment状态枚举
export enum K8sDeploymentStatus {
  RUNNING = 1, // 运行中
  STOPPED = 2, // 停止
  PAUSED = 3,  // 暂停
  ERROR = 4,   // 异常
}

// Deployment条件
export interface DeploymentCondition {
  type: string;                 // 条件类型
  status: string;               // 条件状态
  last_update_time: string;     // 最后更新时间
  last_transition_time: string; // 最后转换时间
  reason: string;               // 原因
  message: string;              // 消息
}

// 标签选择器
export interface LabelSelector {
  match_labels?: Record<string, string>;     // 匹配标签
  match_expressions?: LabelSelectorRequirement[]; // 匹配表达式
}

// 标签选择器要求
export interface LabelSelectorRequirement {
  key: string;        // 键
  operator: string;   // 操作符
  values?: string[];  // 值列表
}

// 容器端口
export interface ContainerPort {
  name?: string;           // 端口名称
  container_port: number;  // 容器端口
  protocol?: string;       // 协议
  host_port?: number;      // 主机端口
  host_ip?: string;        // 主机IP
}

// 环境变量
export interface EnvVar {
  name: string;   // 环境变量名
  value?: string; // 环境变量值
}

// 资源要求
export interface ResourceRequirements {
  limits?: Record<string, string>;   // 资源限制
  requests?: Record<string, string>; // 资源请求
}

// 容器配置
export interface Container {
  name: string;                              // 容器名称
  image: string;                             // 容器镜像
  ports?: ContainerPort[];                   // 端口配置
  env?: EnvVar[];                           // 环境变量
  resources?: ResourceRequirements;          // 资源配置
  image_pull_policy?: string;               // 镜像拉取策略
  command?: string[];                       // 启动命令
  args?: string[];                          // 启动参数
}

// Pod模板规格
export interface PodTemplateSpec {
  metadata?: {
    labels?: Record<string, string>;      // 标签
    annotations?: Record<string, string>; // 注解
  };
  spec?: {
    containers: Container[];                    // 容器列表
    restart_policy?: string;                   // 重启策略
    termination_grace_period_seconds?: number; // 终止宽限期
    dns_policy?: string;                       // DNS策略
    service_account_name?: string;             // 服务账户名
    security_context?: any;                    // 安全上下文
    image_pull_secrets?: Array<{name: string}>; // 镜像拉取密钥
  };
}

// 滚动更新策略
export interface RollingUpdateDeployment {
  max_unavailable?: string; // 最大不可用数量
  max_surge?: string;       // 最大超出数量
}

// 部署策略
export interface DeploymentStrategy {
  type?: string;                               // 策略类型
  rolling_update?: RollingUpdateDeployment;   // 滚动更新配置
}

// Deployment规格
export interface DeploymentSpec {
  replicas?: number;                        // 副本数量
  selector?: LabelSelector;                 // 标签选择器
  template?: PodTemplateSpec;               // Pod模板
  strategy?: DeploymentStrategy;            // 部署策略
  min_ready_seconds?: number;               // 最小就绪时间
  revision_history_limit?: number;          // 历史版本限制
  paused?: boolean;                         // 是否暂停
  progress_deadline_seconds?: number;       // 进度截止时间
}

// Kubernetes Deployment实体
export interface K8sDeployment {
  id?: number;                              // ID
  name: string;                             // Deployment名称
  namespace: string;                        // 所属命名空间
  cluster_id: number;                       // 所属集群ID
  uid?: string;                            // Deployment UID
  replicas?: number;                       // 期望副本数
  ready_replicas?: number;                 // 就绪副本数
  available_replicas?: number;             // 可用副本数
  updated_replicas?: number;               // 更新副本数
  strategy?: string;                       // 部署策略
  max_unavailable?: string;                // 最大不可用数量
  max_surge?: string;                      // 最大超出数量
  selector?: Record<string, string>;       // 标签选择器
  labels?: Record<string, string>;         // 标签
  annotations?: Record<string, string>;    // 注解
  images?: string[];                       // 容器镜像列表
  status?: K8sDeploymentStatus;            // 部署状态
  conditions?: DeploymentCondition[];      // 部署条件
  created_at?: string;                     // 创建时间
  updated_at?: string;                     // 更新时间
}

// Deployment相关事件
export interface K8sDeploymentEvent {
  type: string;       // 事件类型
  reason: string;     // 事件原因
  message: string;    // 事件消息
  count: number;      // 事件计数
  first_time: string; // 首次发生时间
  last_time: string;  // 最后发生时间
  source: string;     // 事件源
}

// Deployment指标信息
export interface K8sDeploymentMetrics {
  cpu_usage: number;         // CPU使用率
  memory_usage: number;      // 内存使用率
  network_in: number;        // 网络入流量（MB/s）
  network_out: number;       // 网络出流量（MB/s）
  disk_usage: number;        // 磁盘使用率
  replicas_ready: number;    // 就绪副本数
  replicas_total: number;    // 总副本数
  restart_count: number;     // 重启次数
  availability_rate: number; // 可用性
  last_updated: string;      // 最后更新时间
}

// Deployment版本历史
export interface K8sDeploymentHistory {
  revision: number; // 版本
  date: string;     // 日期
  message: string;  // 消息
}

// 获取Deployment列表请求
export interface GetDeploymentListReq {
  page?: number;                         // 页码
  size?: number;                         // 每页大小  
  cluster_id?: number;                   // 集群ID
  namespace?: string;                    // 命名空间
  status?: string;                       // Deployment状态
  labels?: Record<string, string>;       // 标签
  annotations?: Record<string, string>; // 注解
  search?: string;                       // 关键词搜索
}

// 获取Deployment详情请求
export interface GetDeploymentDetailsReq {
  cluster_id: number; // 集群ID
  namespace: string;  // 命名空间
  name: string;       // Deployment名称
}

// 获取Deployment YAML请求
export interface GetDeploymentYamlReq {
  cluster_id: number; // 集群ID
  namespace: string;  // 命名空间
  name: string;       // Deployment名称
}

// 创建Deployment请求
export interface CreateDeploymentReq {
  cluster_id: number;                    // 集群ID
  name: string;                         // Deployment名称
  namespace: string;                    // 命名空间
  replicas: number;                     // 副本数量
  images: string[];                     // 容器镜像列表
  labels?: Record<string, string>;      // 标签
  annotations?: Record<string, string>; // 注解
  spec?: DeploymentSpec;                // Deployment规格
  yaml?: string;                        // YAML内容
}

// 更新Deployment请求
export interface UpdateDeploymentReq {
  cluster_id: number;                   // 集群ID
  name: string;                        // Deployment名称
  namespace: string;                   // 命名空间
  replicas?: number;                    // 副本数量
  images?: string[];                    // 容器镜像列表
  labels?: Record<string, string>;      // 标签
  annotations?: Record<string, string>; // 注解
  spec?: DeploymentSpec;                // Deployment规格
  yaml?: string;                        // YAML内容
}

// 删除Deployment请求
export interface DeleteDeploymentReq {
  cluster_id: number; // 集群ID
  namespace: string;  // 命名空间
  name: string;       // Deployment名称
}

// 重启Deployment请求
export interface RestartDeploymentReq {
  cluster_id: number; // 集群ID
  namespace: string;  // 命名空间
  name: string;       // Deployment名称
}

// 伸缩Deployment请求
export interface ScaleDeploymentReq {
  cluster_id: number; // 集群ID
  namespace: string;  // 命名空间
  name: string;       // Deployment名称
  replicas: number;   // 副本数量
}

// 暂停Deployment请求
export interface PauseDeploymentReq {
  cluster_id: number; // 集群ID
  namespace: string;  // 命名空间
  name: string;       // Deployment名称
}

// 恢复Deployment请求
export interface ResumeDeploymentReq {
  cluster_id: number; // 集群ID
  namespace: string;  // 命名空间
  name: string;       // Deployment名称
}

// 获取Deployment指标请求
export interface GetDeploymentMetricsReq {
  cluster_id: number;  // 集群ID
  namespace: string;   // 命名空间
  name: string;        // Deployment名称
  start_time?: string; // 开始时间
  end_time?: string;   // 结束时间
  step?: string;       // 查询步长
}

// 获取Deployment事件请求
export interface GetDeploymentEventsReq {
  cluster_id: number;   // 集群ID
  namespace: string;    // 命名空间
  name: string;         // Deployment名称
  event_type?: string;  // 事件类型
  limit?: number;       // 限制数量
}

// 获取Deployment下的Pod列表请求
export interface GetDeploymentPodsReq {
  cluster_id: number; // 集群ID
  namespace: string;  // 命名空间
  name: string;       // Deployment名称
}

// 获取Deployment版本历史请求
export interface GetDeploymentHistoryReq {
  cluster_id: number; // 集群ID
  namespace: string;  // 命名空间
  name: string;       // Deployment名称
}

// 回滚Deployment请求
export interface RollbackDeploymentReq {
  cluster_id: number; // 集群ID
  namespace: string;  // 命名空间
  name: string;       // Deployment名称
  revision: number;   // 回滚到的版本号
}

/**
 * 获取Deployment列表
 */
export async function getDeploymentListApi(
  params?: GetDeploymentListReq,
) {
  return requestClient.get('/k8s/deployments', { params });
}

/**
 * 获取Deployment详情
 */
export async function getDeploymentDetailsApi(
  clusterId: number,
  namespace: string,
  name: string,
) {
  return requestClient.get(`/k8s/deployments/${clusterId}/${namespace}/${name}`);
}

/**
 * 获取Deployment YAML
 */
export async function getDeploymentYamlApi(
  clusterId: number,
  namespace: string,
  name: string,
) {
  return requestClient.get(`/k8s/deployments/${clusterId}/${namespace}/${name}/yaml`);
}

/**
 * 创建Deployment
 */
export async function createDeploymentApi(
  data: CreateDeploymentReq,
) {
  return requestClient.post('/k8s/deployments', data);
}

/**
 * 更新Deployment
 */
export async function updateDeploymentApi(
  clusterId: number,
  namespace: string,
  name: string,
  data: UpdateDeploymentReq,
) {
  return requestClient.put(`/k8s/deployments/${clusterId}/${namespace}/${name}`, data);
}

/**
 * 删除Deployment
 */
export async function deleteDeploymentApi(
  clusterId: number,
  namespace: string,
  name: string,
) {
  return requestClient.delete(`/k8s/deployments/${clusterId}/${namespace}/${name}`);
}

/**
 * 重启Deployment
 */
export async function restartDeploymentApi(
  clusterId: number,
  namespace: string,
  name: string,
) {
  return requestClient.post(`/k8s/deployments/${clusterId}/${namespace}/${name}/restart`);
}

/**
 * 伸缩Deployment
 */
export async function scaleDeploymentApi(
  clusterId: number,
  namespace: string,
  name: string,
  data: ScaleDeploymentReq,
) {
  return requestClient.post(`/k8s/deployments/${clusterId}/${namespace}/${name}/scale`, data);
}

/**
 * 暂停Deployment
 */
export async function pauseDeploymentApi(
  clusterId: number,
  namespace: string,
  name: string,
) {
  return requestClient.post(`/k8s/deployments/${clusterId}/${namespace}/${name}/pause`);
}

/**
 * 恢复Deployment
 */
export async function resumeDeploymentApi(
  clusterId: number,
  namespace: string,
  name: string,
) {
  return requestClient.post(`/k8s/deployments/${clusterId}/${namespace}/${name}/resume`);
}

/**
 * 获取Deployment指标
 */
export async function getDeploymentMetricsApi(
  clusterId: number,
  namespace: string,
  name: string,
  params?: GetDeploymentMetricsReq,
) {
  return requestClient.get(`/k8s/deployments/${clusterId}/${namespace}/${name}/metrics`, { params });
}

/**
 * 获取Deployment事件
 */
export async function getDeploymentEventsApi(
  clusterId: number,
  namespace: string,
  name: string,
  params?: GetDeploymentEventsReq,
) {
  return requestClient.get(`/k8s/deployments/${clusterId}/${namespace}/${name}/events`, { params });
}

/**
 * 获取Deployment下的Pod列表
 */
export async function getDeploymentPodsApi(
  clusterId: number,
  namespace: string,
  name: string,
) {
  return requestClient.get(`/k8s/deployments/${clusterId}/${namespace}/${name}/pods`);
}

/**
 * 获取Deployment版本历史
 */
export async function getDeploymentHistoryApi(
  clusterId: number,
  namespace: string,
  name: string,
) {
  return requestClient.get(`/k8s/deployments/${clusterId}/${namespace}/${name}/history`);
}

/**
 * 回滚Deployment
 */
export async function rollbackDeploymentApi(
  clusterId: number,
  namespace: string,
  name: string,
  data: RollbackDeploymentReq,
) {
  return requestClient.post(`/k8s/deployments/${clusterId}/${namespace}/${name}/rollback`, data);
}
