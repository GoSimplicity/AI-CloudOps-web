import { requestClient } from '#/api/request';

// Workload相关接口和类型定义

export interface WorkloadInfo {
  name: string;
  namespace: string;
  cluster_id: number;
  kind: 'Deployment' | 'StatefulSet' | 'DaemonSet' | 'Job' | 'CronJob';
  uid: string;
  labels?: Record<string, string>;
  annotations?: Record<string, string>;
  creation_timestamp: string;
  age: string;
  status: string;
  replicas?: number;
  ready_replicas?: number;
  images: string[];
  resources?: WorkloadResources;
}

export interface WorkloadResources {
  cpu_request?: string;
  cpu_limit?: string;
  memory_request?: string;
  memory_limit?: string;
}

export interface WorkloadListReq {
  cluster_id: number;
  namespace?: string;
  kind?: string;
  label_selector?: string;
  field_selector?: string;
  status?: string;
  page?: number;
  page_size?: number;
}

export interface WorkloadBatchOperationReq {
  cluster_id: number;
  namespace: string;
  workloads: Array<{
    name: string;
    kind: string;
  }>;
  operation: 'delete' | 'restart' | 'scale';
  scale_replicas?: number;
  grace_period_seconds?: number;
  force?: boolean;
}

export interface WorkloadStatistics {
  total_count: number;
  running_count: number;
  pending_count: number;
  failed_count: number;
  by_kind: Record<string, number>;
  by_namespace: Record<string, number>;
}

export interface WorkloadResourceUsage {
  workload_name: string;
  kind: string;
  namespace: string;
  cpu_usage: string;
  memory_usage: string;
  cpu_request: string;
  memory_request: string;
  cpu_limit: string;
  memory_limit: string;
  usage_percentage: {
    cpu: number;
    memory: number;
  };
}

export interface WorkloadHealthCheck {
  workload_name: string;
  kind: string;
  namespace: string;
  healthy: boolean;
  issues: string[];
  recommendations: string[];
}

// Workload相关API函数

/**
 * 获取工作负载列表
 */
export async function getWorkloadListApi(data: WorkloadListReq) {
  const params = new URLSearchParams();
  if (data.namespace) params.append('namespace', data.namespace);
  if (data.kind) params.append('kind', data.kind);
  if (data.label_selector) params.append('label_selector', data.label_selector);
  if (data.field_selector) params.append('field_selector', data.field_selector);
  if (data.status) params.append('status', data.status);
  if (data.page) params.append('page', data.page.toString());
  if (data.page_size) params.append('page_size', data.page_size.toString());

  return requestClient.get<WorkloadInfo[]>(`/k8s/workloads/${data.cluster_id}?${params}`);
}

/**
 * 获取工作负载详情
 */
export async function getWorkloadDetailApi(cluster_id: number, namespace: string, kind: string, name: string) {
  return requestClient.get<WorkloadInfo>(`/k8s/workloads/${cluster_id}/${namespace}/${kind}/${name}`);
}

/**
 * 批量操作工作负载
 */
export async function batchOperateWorkloadsApi(data: WorkloadBatchOperationReq) {
  return requestClient.post('/k8s/workloads/batch_operation', data);
}

/**
 * 获取工作负载统计信息
 */
export async function getWorkloadStatisticsApi(cluster_id: number, namespace?: string) {
  const params = new URLSearchParams();
  if (namespace) params.append('namespace', namespace);

  return requestClient.get<WorkloadStatistics>(`/k8s/workloads/${cluster_id}/statistics?${params}`);
}

/**
 * 获取工作负载资源使用情况
 */
export async function getWorkloadResourceUsageApi(cluster_id: number, namespace?: string, kind?: string) {
  const params = new URLSearchParams();
  if (namespace) params.append('namespace', namespace);
  if (kind) params.append('kind', kind);

  return requestClient.get<WorkloadResourceUsage[]>(`/k8s/workloads/${cluster_id}/resource-usage?${params}`);
}

/**
 * 检查工作负载健康状态
 */
export async function checkWorkloadHealthApi(cluster_id: number, namespace?: string) {
  const params = new URLSearchParams();
  if (namespace) params.append('namespace', namespace);

  return requestClient.get<WorkloadHealthCheck[]>(`/k8s/workloads/${cluster_id}/health-check?${params}`);
}

/**
 * 获取工作负载的Pod列表
 */
export async function getWorkloadPodsApi(cluster_id: number, namespace: string, kind: string, name: string) {
  return requestClient.get(`/k8s/workloads/${cluster_id}/${namespace}/${kind}/${name}/pods`);
}

/**
 * 获取工作负载事件
 */
export async function getWorkloadEventsApi(cluster_id: number, namespace: string, kind: string, name: string) {
  return requestClient.get(`/k8s/workloads/${cluster_id}/${namespace}/${kind}/${name}/events`);
}

/**
 * 扩缩容工作负载
 */
export async function scaleWorkloadApi(cluster_id: number, namespace: string, kind: string, name: string, replicas: number) {
  return requestClient.post('/k8s/workloads/scale', {
    cluster_id,
    namespace,
    kind,
    name,
    replicas,
  });
}

/**
 * 重启工作负载
 */
export async function restartWorkloadApi(cluster_id: number, namespace: string, kind: string, name: string) {
  return requestClient.post('/k8s/workloads/restart', {
    cluster_id,
    namespace,
    kind,
    name,
  });
}

/**
 * 暂停工作负载
 */
export async function pauseWorkloadApi(cluster_id: number, namespace: string, kind: string, name: string) {
  return requestClient.post('/k8s/workloads/pause', {
    cluster_id,
    namespace,
    kind,
    name,
  });
}

/**
 * 恢复工作负载
 */
export async function resumeWorkloadApi(cluster_id: number, namespace: string, kind: string, name: string) {
  return requestClient.post('/k8s/workloads/resume', {
    cluster_id,
    namespace,
    kind,
    name,
  });
}

/**
 * 获取工作负载YAML配置
 */
export async function getWorkloadYamlApi(cluster_id: number, namespace: string, kind: string, name: string) {
  return requestClient.get(`/k8s/workloads/${cluster_id}/${namespace}/${kind}/${name}/yaml`);
}

/**
 * 比较工作负载配置差异
 */
export async function compareWorkloadConfigApi(cluster_id: number, namespace: string, kind: string, name: string, target_yaml: string) {
  return requestClient.post('/k8s/workloads/compare', {
    cluster_id,
    namespace,
    kind,
    name,
    target_yaml,
  });
}
