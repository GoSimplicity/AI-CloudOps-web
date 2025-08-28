import { requestClient } from '#/api/request';

// Secret相关接口和类型定义

export interface SecretInfo {
  name: string;
  namespace: string;
  cluster_id: number;
  uid: string;
  type: string;
  data?: Record<string, string>;
  labels?: Record<string, string>;
  annotations?: Record<string, string>;
  creation_timestamp: string;
  age: string;
  data_count: number;
  size: string;
}

export interface SecretListReq {
  cluster_id: number;
  namespace?: string;
  label_selector?: string;
  field_selector?: string;
  type?: string;
  page?: number;
  page_size?: number;
}

export interface SecretCreateReq {
  cluster_id: number;
  namespace: string;
  name: string;
  type?: string;
  data?: Record<string, string>;
  string_data?: Record<string, string>;
  labels?: Record<string, string>;
  annotations?: Record<string, string>;
}

export interface SecretUpdateReq {
  cluster_id: number;
  namespace: string;
  name: string;
  type?: string;
  data?: Record<string, string>;
  string_data?: Record<string, string>;
  labels?: Record<string, string>;
  annotations?: Record<string, string>;
}

export interface SecretDeleteReq {
  cluster_id: number;
  namespace: string;
  name: string;
  grace_period_seconds?: number;
  force?: boolean;
}

export interface SecretBatchDeleteReq {
  cluster_id: number;
  namespace: string;
  names: string[];
  grace_period_seconds?: number;
  force?: boolean;
}

export interface SecretUsageInfo {
  pods: string[];
  deployments: string[];
  services: string[];
  ingresses: string[];
}

export interface TLSSecretReq {
  cluster_id: number;
  namespace: string;
  name: string;
  cert_file: File;
  key_file: File;
  labels?: Record<string, string>;
  annotations?: Record<string, string>;
}

export interface DockerConfigSecretReq {
  cluster_id: number;
  namespace: string;
  name: string;
  registry_url: string;
  username: string;
  password: string;
  email?: string;
  labels?: Record<string, string>;
  annotations?: Record<string, string>;
}

// Secret相关API函数

/**
 * 获取Secret列表
 */
export async function getSecretListApi(data: SecretListReq) {
  const params = new URLSearchParams();
  if (data.namespace) params.append('namespace', data.namespace);
  if (data.label_selector) params.append('label_selector', data.label_selector);
  if (data.field_selector) params.append('field_selector', data.field_selector);
  if (data.type) params.append('type', data.type);
  if (data.page) params.append('page', data.page.toString());
  if (data.page_size) params.append('page_size', data.page_size.toString());

  return requestClient.get<SecretInfo[]>(`/k8s/secrets/${data.cluster_id}?${params}`);
}

/**
 * 获取Secret详情
 */
export async function getSecretDetailApi(cluster_id: number, namespace: string, name: string) {
  return requestClient.get<SecretInfo>(`/k8s/secrets/${cluster_id}/${namespace}/${name}`);
}

/**
 * 创建Secret
 */
export async function createSecretApi(data: SecretCreateReq) {
  return requestClient.post('/k8s/secrets/create', data);
}

/**
 * 更新Secret
 */
export async function updateSecretApi(data: SecretUpdateReq) {
  return requestClient.post('/k8s/secrets/update', data);
}

/**
 * 删除Secret
 */
export async function deleteSecretApi(data: SecretDeleteReq) {
  return requestClient.delete('/k8s/secrets/delete', { data });
}

/**
 * 批量删除Secret
 */
export async function batchDeleteSecretApi(data: SecretBatchDeleteReq) {
  return requestClient.delete('/k8s/secrets/batch_delete', { data });
}

/**
 * 获取Secret使用情况
 */
export async function getSecretUsageApi(cluster_id: number, namespace: string, name: string) {
  return requestClient.get<SecretUsageInfo>(`/k8s/secrets/${cluster_id}/${namespace}/${name}/usage`);
}

/**
 * 创建TLS Secret
 */
export async function createTLSSecretApi(data: TLSSecretReq) {
  const formData = new FormData();
  formData.append('cluster_id', data.cluster_id.toString());
  formData.append('namespace', data.namespace);
  formData.append('name', data.name);
  formData.append('cert_file', data.cert_file);
  formData.append('key_file', data.key_file);
  if (data.labels) {
    formData.append('labels', JSON.stringify(data.labels));
  }
  if (data.annotations) {
    formData.append('annotations', JSON.stringify(data.annotations));
  }

  return requestClient.post('/k8s/secrets/create_tls', formData);
}

/**
 * 创建Docker配置Secret
 */
export async function createDockerConfigSecretApi(data: DockerConfigSecretReq) {
  return requestClient.post('/k8s/secrets/create_docker_config', data);
}

/**
 * 获取Secret的YAML配置
 */
export async function getSecretYamlApi(cluster_id: number, namespace: string, name: string) {
  return requestClient.get(`/k8s/secrets/${cluster_id}/${namespace}/${name}/yaml`);
}

/**
 * 复制Secret到其他命名空间
 */
export async function copySecretApi(cluster_id: number, source_namespace: string, target_namespace: string, name: string, new_name?: string) {
  return requestClient.post('/k8s/secrets/copy', {
    cluster_id,
    source_namespace,
    target_namespace,
    name,
    new_name: new_name || name,
  });
}

/**
 * 验证Secret格式
 */
export async function validateSecretApi(cluster_id: number, secret_data: Record<string, string>, secret_type: string) {
  return requestClient.post('/k8s/secrets/validate', {
    cluster_id,
    secret_data,
    secret_type,
  });
}
