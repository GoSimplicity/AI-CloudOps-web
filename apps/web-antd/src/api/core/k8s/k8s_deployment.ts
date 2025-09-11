import { requestClient } from '#/api/request';

// K8sDeployment状态枚举
export enum K8sDeploymentStatus {
  Running = 1, // 运行中
  Stopped = 2, // 停止
  Paused = 3, // 暂停
  Error = 4, // 异常
}

// Deployment条件
export interface DeploymentCondition {
  type: string; // 条件类型
  status: string; // 条件状态
  last_update_time: string; // 最后更新时间
  last_transition_time: string; // 最后转换时间
  reason: string; // 原因
  message: string; // 消息
}

// DeploymentSpec 创建/更新Deployment时的配置信息
export interface DeploymentSpec {
  replicas?: number; // 副本数量
  selector?: any; // 标签选择器
  template?: any; // Pod模板
  strategy?: any; // 部署策略
  min_ready_seconds?: number; // 最小就绪时间
  revision_history_limit?: number; // 历史版本限制
  paused?: boolean; // 是否暂停
  progress_deadline_seconds?: number; // 进度截止时间
}

// K8sDeployment Kubernetes Deployment数据库实体
export interface K8sDeployment {
  name: string; // Deployment名称
  namespace: string; // 所属命名空间
  cluster_id: number; // 所属集群ID
  uid?: string; // Deployment UID
  replicas: number; // 期望副本数
  ready_replicas: number; // 就绪副本数
  available_replicas: number; // 可用副本数
  updated_replicas: number; // 更新副本数
  strategy?: string; // 部署策略
  max_unavailable?: string; // 最大不可用数量
  max_surge?: string; // 最大超出数量
  selector?: any; // 标签选择器 - 支持多种格式
  labels?: any; // 标签 - 支持多种格式
  annotations?: any; // 注解 - 支持多种格式
  images?: string[]; // 容器镜像列表
  status: K8sDeploymentStatus; // 部署状态
  conditions?: DeploymentCondition[]; // 部署条件
}

// K8sDeploymentEvent Deployment相关事件
export interface K8sDeploymentEvent {
  type: string; // 事件类型
  reason: string; // 事件原因
  message: string; // 事件消息
  count: number; // 事件计数
  first_time: string; // 首次发生时间
  last_time: string; // 最后发生时间
  source: string; // 事件源
}

// K8sDeploymentHistory Deployment版本历史
export interface K8sDeploymentHistory {
  revision: number; // 版本
  date: string; // 日期
  message: string; // 消息
}

// 获取Deployment列表请求
export interface GetDeploymentListReq {
  page?: number; // 页码
  size?: number; // 每页数量
  search?: string; // 搜索关键词
  cluster_id?: number; // 集群ID
  namespace?: string; // 命名空间
  status?: K8sDeploymentStatus; // Deployment状态
  labels?: any; // 标签 - 支持多种格式
}

// 获取Deployment详情请求
export interface GetDeploymentDetailsReq {
  cluster_id: number; // 集群ID
  namespace: string; // 命名空间
  name: string; // Deployment名称
}

// 获取Deployment YAML请求
export interface GetDeploymentYamlReq {
  cluster_id: number; // 集群ID
  namespace: string; // 命名空间
  name: string; // Deployment名称
}

// 创建Deployment请求
export interface CreateDeploymentReq {
  cluster_id: number; // 集群ID
  name: string; // Deployment名称
  namespace: string; // 命名空间
  replicas: number; // 副本数量
  images: string[]; // 容器镜像列表
  labels?: any; // 标签 - 支持多种格式
  annotations?: any; // 注解 - 支持多种格式
  spec: DeploymentSpec; // Deployment规格
}

// 更新Deployment请求
export interface UpdateDeploymentReq {
  cluster_id: number; // 集群ID
  name: string; // Deployment名称
  namespace: string; // 命名空间
  replicas?: number; // 副本数量
  images?: string[]; // 容器镜像列表
  labels?: any; // 标签 - 支持多种格式
  annotations?: any; // 注解 - 支持多种格式
  spec?: DeploymentSpec; // Deployment规格
}

// 通过YAML创建Deployment请求
export interface CreateDeploymentByYamlReq {
  cluster_id: number; // 集群ID
  yaml: string; // YAML内容
}

// 通过YAML更新Deployment请求
export interface UpdateDeploymentByYamlReq {
  cluster_id: number; // 集群ID
  namespace: string; // 命名空间
  name: string; // Deployment名称
  yaml: string; // YAML内容
}

// 删除Deployment请求
export interface DeleteDeploymentReq {
  cluster_id: number; // 集群ID
  namespace: string; // 命名空间
  name: string; // Deployment名称
}

// 重启Deployment请求
export interface RestartDeploymentReq {
  cluster_id: number; // 集群ID
  namespace: string; // 命名空间
  name: string; // Deployment名称
}

// 伸缩Deployment请求
export interface ScaleDeploymentReq {
  cluster_id: number; // 集群ID
  namespace: string; // 命名空间
  name: string; // Deployment名称
  replicas: number; // 副本数量
}

// 获取Deployment下的Pod列表请求
export interface GetDeploymentPodsReq {
  cluster_id: number; // 集群ID
  namespace: string; // 命名空间
  name: string; // Deployment名称
}

// 获取Deployment版本历史请求
export interface GetDeploymentHistoryReq {
  cluster_id: number; // 集群ID
  namespace: string; // 命名空间
  name: string; // Deployment名称
}

// 回滚Deployment请求
export interface RollbackDeploymentReq {
  cluster_id: number; // 集群ID
  namespace: string; // 命名空间
  name: string; // Deployment名称
  revision: number; // 回滚到的版本号
}

// 暂停Deployment请求
export interface PauseDeploymentReq {
  cluster_id: number; // 集群ID
  namespace: string; // 命名空间
  name: string; // Deployment名称
}

// 恢复Deployment请求
export interface ResumeDeploymentReq {
  cluster_id: number; // 集群ID
  namespace: string; // 命名空间
  name: string; // Deployment名称
}

/**
 * 获取Deployment列表
 */
export async function getDeploymentListApi(
  cluster_id: number,
  params?: Omit<GetDeploymentListReq, 'cluster_id'>,
) {
  return requestClient.get(`/k8s/deployment/${cluster_id}/list`, { params });
}

/**
 * 获取Deployment详情
 */
export async function getDeploymentDetailsApi(
  cluster_id: number,
  namespace: string,
  name: string,
) {
  return requestClient.get(
    `/k8s/deployment/${cluster_id}/${namespace}/${name}/detail`,
  );
}

/**
 * 获取Deployment YAML
 */
export async function getDeploymentYamlApi(
  cluster_id: number,
  namespace: string,
  name: string,
) {
  return requestClient.get(
    `/k8s/deployment/${cluster_id}/${namespace}/${name}/detail/yaml`,
  );
}

/**
 * 创建Deployment
 */
export async function createDeploymentApi(
  cluster_id: number,
  data: Omit<CreateDeploymentReq, 'cluster_id'>,
) {
  return requestClient.post(`/k8s/deployment/${cluster_id}/create`, data);
}

/**
 * 通过YAML创建Deployment
 */
export async function createDeploymentByYamlApi(
  cluster_id: number,
  data: Omit<CreateDeploymentByYamlReq, 'cluster_id'>,
) {
  return requestClient.post(`/k8s/deployment/${cluster_id}/create/yaml`, data);
}

/**
 * 更新Deployment
 */
export async function updateDeploymentApi(
  cluster_id: number,
  namespace: string,
  name: string,
  data: Omit<UpdateDeploymentReq, 'cluster_id' | 'namespace' | 'name'>,
) {
  return requestClient.put(
    `/k8s/deployment/${cluster_id}/${namespace}/${name}/update`,
    data,
  );
}

/**
 * 通过YAML更新Deployment
 */
export async function updateDeploymentByYamlApi(
  cluster_id: number,
  namespace: string,
  name: string,
  data: Omit<UpdateDeploymentByYamlReq, 'cluster_id' | 'namespace' | 'name'>,
) {
  return requestClient.put(
    `/k8s/deployment/${cluster_id}/${namespace}/${name}/update/yaml`,
    data,
  );
}

/**
 * 删除Deployment
 */
export async function deleteDeploymentApi(
  cluster_id: number,
  namespace: string,
  name: string,
) {
  return requestClient.delete(
    `/k8s/deployment/${cluster_id}/${namespace}/${name}/delete`,
  );
}

/**
 * 重启Deployment
 */
export async function restartDeploymentApi(
  cluster_id: number,
  namespace: string,
  name: string,
) {
  return requestClient.post(
    `/k8s/deployment/${cluster_id}/${namespace}/${name}/restart`,
  );
}

/**
 * 伸缩Deployment
 */
export async function scaleDeploymentApi(
  cluster_id: number,
  namespace: string,
  name: string,
  data: { replicas: number },
) {
  return requestClient.post(
    `/k8s/deployment/${cluster_id}/${namespace}/${name}/scale`,
    data,
  );
}

/**
 * 暂停Deployment
 */
export async function pauseDeploymentApi(
  cluster_id: number,
  namespace: string,
  name: string,
) {
  return requestClient.post(
    `/k8s/deployment/${cluster_id}/${namespace}/${name}/pause`,
  );
}

/**
 * 恢复Deployment
 */
export async function resumeDeploymentApi(
  cluster_id: number,
  namespace: string,
  name: string,
) {
  return requestClient.post(
    `/k8s/deployment/${cluster_id}/${namespace}/${name}/resume`,
  );
}

/**
 * 回滚Deployment
 */
export async function rollbackDeploymentApi(
  cluster_id: number,
  namespace: string,
  name: string,
  data: { revision: number },
) {
  return requestClient.post(
    `/k8s/deployment/${cluster_id}/${namespace}/${name}/rollback`,
    data,
  );
}

/**
 * 获取Deployment Pod列表
 */
export async function getDeploymentPodsApi(
  cluster_id: number,
  namespace: string,
  name: string,
) {
  return requestClient.get(
    `/k8s/deployment/${cluster_id}/${namespace}/${name}/pods`,
  );
}

/**
 * 获取Deployment版本历史
 */
export async function getDeploymentHistoryApi(
  cluster_id: number,
  namespace: string,
  name: string,
) {
  return requestClient.get(
    `/k8s/deployment/${cluster_id}/${namespace}/${name}/history`,
  );
}
