import { requestClient } from '#/api/request';

// YAML模板相关接口和类型定义

export interface YamlTemplateInfo {
  id: number;
  name: string;
  user_id: number;
  content: string;
  cluster_id: number;
  created_at: string;
  updated_at: string;
}

export interface YamlTemplateListReq {
  cluster_id: number;
  page?: number;
  page_size?: number;
  keyword?: string;
}

export interface YamlTemplateCreateReq {
  name: string;
  content: string;
  cluster_id: number;
  user_id?: number;
}

export interface YamlTemplateUpdateReq {
  id: number;
  name?: string;
  content?: string;
  cluster_id: number;
}

export interface YamlTemplateDeleteReq {
  id: number;
  cluster_id: number;
}

export interface CheckYamlTemplateReq {
  content: string;
  cluster_id: number;
  variables?: Record<string, string>;
}

export interface YamlTemplateVariable {
  key: string;
  value: string;
  description?: string;
  required?: boolean;
  default_value?: string;
}

export interface YamlTemplateValidationResult {
  valid: boolean;
  errors?: string[];
  warnings?: string[];
}

// YAML模板相关API函数

/**
 * 获取YAML模板列表
 */
export async function getYamlTemplateApi(cluster_id: number) {
  return requestClient.get<YamlTemplateInfo[]>(
    `/k8s/yaml_templates/list/?cluster_id=${cluster_id}`,
  );
}

/**
 * 获取YAML模板列表（支持分页和搜索）
 */
export async function getYamlTemplateListWithFilterApi(data: YamlTemplateListReq) {
  const params = new URLSearchParams();
  params.append('cluster_id', data.cluster_id.toString());
  if (data.page) params.append('page', data.page.toString());
  if (data.page_size) params.append('page_size', data.page_size.toString());
  if (data.keyword) params.append('keyword', data.keyword);

  return requestClient.get<YamlTemplateInfo[]>(`/k8s/yaml_templates/list?${params}`);
}

/**
 * 创建YAML模板
 */
export async function createYamlTemplateApi(data: YamlTemplateCreateReq) {
  return requestClient.post('/k8s/yaml_templates/create', data);
}

/**
 * 更新YAML模板
 */
export async function updateYamlTemplateApi(data: YamlTemplateUpdateReq) {
  return requestClient.post('/k8s/yaml_templates/update', data);
}

/**
 * 删除YAML模板
 */
export async function deleteYamlTemplateApi(id: number, cluster_id: number) {
  return requestClient.delete(
    `/k8s/yaml_templates/delete/${id}?cluster_id=${cluster_id}`,
  );
}

/**
 * 批量删除YAML模板
 */
export async function batchDeleteYamlTemplateApi(ids: number[], cluster_id: number) {
  return requestClient.delete('/k8s/yaml_templates/batch_delete', {
    data: { ids, cluster_id },
  });
}

/**
 * 获取YAML模板详细内容
 */
export async function getYamlTemplateDetailApi(id: number, cluster_id: number) {
  return requestClient.get<YamlTemplateInfo>(
    `/k8s/yaml_templates/${id}/yaml?cluster_id=${cluster_id}`,
  );
}

/**
 * 检查YAML模板语法
 */
export async function checkYamlTemplateApi(data: CheckYamlTemplateReq) {
  return requestClient.post<YamlTemplateValidationResult>('/k8s/yaml_templates/check', data);
}

/**
 * 复制YAML模板
 */
export async function copyYamlTemplateApi(id: number, cluster_id: number, new_name: string) {
  return requestClient.post('/k8s/yaml_templates/copy', {
    template_id: id,
    cluster_id,
    new_name,
  });
}

/**
 * 导出YAML模板
 */
export async function exportYamlTemplateApi(id: number, cluster_id: number) {
  return requestClient.get(`/k8s/yaml_templates/${id}/export?cluster_id=${cluster_id}`);
}

/**
 * 导入YAML模板
 */
export async function importYamlTemplateApi(cluster_id: number, file: File) {
  const formData = new FormData();
  formData.append('cluster_id', cluster_id.toString());
  formData.append('file', file);

  return requestClient.post('/k8s/yaml_templates/import', formData);
}

/**
 * 预览YAML模板渲染结果
 */
export async function previewYamlTemplateApi(id: number, cluster_id: number, variables?: Record<string, string>) {
  return requestClient.post('/k8s/yaml_templates/preview', {
    template_id: id,
    cluster_id,
    variables,
  });
}
