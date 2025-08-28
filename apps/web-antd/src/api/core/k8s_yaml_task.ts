import { requestClient } from '#/api/request';

// YAML任务相关接口和类型定义

export interface YamlTaskInfo {
  id: number;
  name: string;
  user_id: number;
  template_id: number;
  cluster_id: number;
  variables: string[];
  status: 'pending' | 'running' | 'success' | 'failed' | 'cancelled';
  apply_result?: string;
  created_at: string;
  updated_at: string;
}

export interface YamlTaskListReq {
  page?: number;
  page_size?: number;
  status?: string;
  cluster_id?: number;
  template_id?: number;
  keyword?: string;
}

export interface YamlTaskCreateReq {
  name: string;
  template_id: number;
  cluster_id: number;
  variables?: Record<string, string>;
}

export interface YamlTaskUpdateReq {
  id: number;
  name?: string;
  template_id?: number;
  cluster_id?: number;
  variables?: Record<string, string>;
}

export interface YamlTaskDeleteReq {
  id: number;
}

export interface ApplyYamlTaskReq {
  id: number;
  dry_run?: boolean;
}

export interface YamlTaskResult {
  success: boolean;
  message?: string;
  details?: any;
  resources_created?: string[];
  resources_updated?: string[];
  resources_failed?: string[];
}

export interface YamlTaskLog {
  id: number;
  task_id: number;
  level: 'info' | 'warning' | 'error';
  message: string;
  timestamp: string;
}

// YAML任务相关API函数

/**
 * 获取YAML任务列表
 */
export async function getYamlTaskListApi() {
  return requestClient.get<YamlTaskInfo[]>('/k8s/yaml_tasks/list');
}

/**
 * 获取YAML任务列表（支持过滤条件）
 */
export async function getYamlTaskListWithFilterApi(data: YamlTaskListReq) {
  const params = new URLSearchParams();
  if (data.page) params.append('page', data.page.toString());
  if (data.page_size) params.append('page_size', data.page_size.toString());
  if (data.status) params.append('status', data.status);
  if (data.cluster_id) params.append('cluster_id', data.cluster_id.toString());
  if (data.template_id) params.append('template_id', data.template_id.toString());
  if (data.keyword) params.append('keyword', data.keyword);

  return requestClient.get<YamlTaskInfo[]>(`/k8s/yaml_tasks/list?${params}`);
}

/**
 * 获取单个YAML任务详情
 */
export async function getYamlTaskDetailApi(id: number) {
  return requestClient.get<YamlTaskInfo>(`/k8s/yaml_tasks/${id}`);
}

/**
 * 创建YAML任务
 */
export async function createYamlTaskApi(data: YamlTaskCreateReq) {
  return requestClient.post('/k8s/yaml_tasks/create', data);
}

/**
 * 更新YAML任务
 */
export async function updateYamlTaskApi(data: YamlTaskUpdateReq) {
  return requestClient.post('/k8s/yaml_tasks/update', data);
}

/**
 * 删除YAML任务
 */
export async function deleteYamlTaskApi(id: number) {
  return requestClient.delete(`/k8s/yaml_tasks/delete/${id}`);
}

/**
 * 批量删除YAML任务
 */
export async function batchDeleteYamlTaskApi(ids: number[]) {
  return requestClient.delete('/k8s/yaml_tasks/batch_delete', {
    data: { ids },
  });
}

/**
 * 应用YAML任务
 */
export async function applyYamlTaskApi(id: number, dry_run?: boolean) {
  return requestClient.post<YamlTaskResult>(`/k8s/yaml_tasks/apply/${id}`, {
    dry_run: dry_run || false,
  });
}

/**
 * 取消YAML任务执行
 */
export async function cancelYamlTaskApi(id: number) {
  return requestClient.post(`/k8s/yaml_tasks/cancel/${id}`);
}

/**
 * 重新执行YAML任务
 */
export async function retryYamlTaskApi(id: number) {
  return requestClient.post<YamlTaskResult>(`/k8s/yaml_tasks/retry/${id}`);
}

/**
 * 获取YAML任务执行日志
 */
export async function getYamlTaskLogsApi(id: number, page?: number, page_size?: number) {
  const params = new URLSearchParams();
  if (page) params.append('page', page.toString());
  if (page_size) params.append('page_size', page_size.toString());

  return requestClient.get<YamlTaskLog[]>(`/k8s/yaml_tasks/${id}/logs?${params}`);
}

/**
 * 获取YAML任务状态
 */
export async function getYamlTaskStatusApi(id: number) {
  return requestClient.get<{ status: string; progress?: number }>(`/k8s/yaml_tasks/${id}/status`);
}

/**
 * 克隆YAML任务
 */
export async function cloneYamlTaskApi(id: number, new_name: string) {
  return requestClient.post('/k8s/yaml_tasks/clone', {
    task_id: id,
    new_name,
  });
}
