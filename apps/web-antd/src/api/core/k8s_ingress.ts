import { requestClient } from '#/api/request';

// Ingress相关接口和类型定义

export interface IngressInfo {
  name: string;
  namespace: string;
  cluster_id: number;
  uid: string;
  ingress_class?: string;
  hosts: string[];
  addresses?: string[];
  rules: IngressRule[];
  tls?: IngressTLS[];
  labels?: Record<string, string>;
  annotations?: Record<string, string>;
  creation_timestamp: string;
  age: string;
  status: string;
}

export interface IngressRule {
  host?: string;
  http: {
    paths: IngressPath[];
  };
}

export interface IngressPath {
  path?: string;
  path_type: string;
  backend: {
    service?: {
      name: string;
      port: {
        number?: number;
        name?: string;
      };
    };
    resource?: {
      api_group?: string;
      kind: string;
      name: string;
    };
  };
}

export interface IngressTLS {
  hosts: string[];
  secret_name?: string;
}

export interface IngressListReq {
  cluster_id: number;
  namespace?: string;
  label_selector?: string;
  field_selector?: string;
  ingress_class?: string;
  host?: string;
  page?: number;
  page_size?: number;
}

export interface IngressCreateReq {
  cluster_id: number;
  namespace: string;
  name: string;
  ingress_class?: string;
  rules: IngressRule[];
  tls?: IngressTLS[];
  annotations?: Record<string, string>;
  labels?: Record<string, string>;
}

export interface IngressUpdateReq {
  cluster_id: number;
  namespace: string;
  name: string;
  ingress_class?: string;
  rules?: IngressRule[];
  tls?: IngressTLS[];
  annotations?: Record<string, string>;
  labels?: Record<string, string>;
}

export interface IngressDeleteReq {
  cluster_id: number;
  namespace: string;
  name: string;
  grace_period_seconds?: number;
  force?: boolean;
}

export interface IngressBatchDeleteReq {
  cluster_id: number;
  namespace: string;
  names: string[];
  grace_period_seconds?: number;
  force?: boolean;
}

export interface IngressCertificateReq {
  cluster_id: number;
  namespace: string;
  name: string;
  hosts: string[];
  secret_name: string;
  cert_provider?: string;
}

// Ingress相关API函数

/**
 * 获取Ingress列表
 */
export async function getIngressListApi(data: IngressListReq) {
  const params = new URLSearchParams();
  if (data.namespace) params.append('namespace', data.namespace);
  if (data.label_selector) params.append('label_selector', data.label_selector);
  if (data.field_selector) params.append('field_selector', data.field_selector);
  if (data.ingress_class) params.append('ingress_class', data.ingress_class);
  if (data.host) params.append('host', data.host);
  if (data.page) params.append('page', data.page.toString());
  if (data.page_size) params.append('page_size', data.page_size.toString());

  return requestClient.get<IngressInfo[]>(`/k8s/ingress/${data.cluster_id}?${params}`);
}

/**
 * 获取Ingress详情
 */
export async function getIngressDetailApi(cluster_id: number, namespace: string, name: string) {
  return requestClient.get<IngressInfo>(`/k8s/ingress/${cluster_id}/${namespace}/${name}`);
}

/**
 * 创建Ingress
 */
export async function createIngressApi(data: IngressCreateReq) {
  return requestClient.post('/k8s/ingress/create', data);
}

/**
 * 更新Ingress
 */
export async function updateIngressApi(data: IngressUpdateReq) {
  return requestClient.post('/k8s/ingress/update', data);
}

/**
 * 删除Ingress
 */
export async function deleteIngressApi(data: IngressDeleteReq) {
  return requestClient.delete('/k8s/ingress/delete', { data });
}

/**
 * 批量删除Ingress
 */
export async function batchDeleteIngressApi(data: IngressBatchDeleteReq) {
  return requestClient.delete('/k8s/ingress/batch_delete', { data });
}

/**
 * 获取Ingress的YAML配置
 */
export async function getIngressYamlApi(cluster_id: number, namespace: string, name: string) {
  return requestClient.get(`/k8s/ingress/${cluster_id}/${namespace}/${name}/yaml`);
}

/**
 * 获取Ingress事件
 */
export async function getIngressEventsApi(cluster_id: number, namespace: string, name: string) {
  return requestClient.get(`/k8s/ingress/${cluster_id}/${namespace}/${name}/events`);
}

/**
 * 测试Ingress连通性
 */
export async function testIngressConnectivityApi(cluster_id: number, namespace: string, name: string, host?: string) {
  return requestClient.post('/k8s/ingress/test-connectivity', {
    cluster_id,
    namespace,
    name,
    host,
  });
}

/**
 * 为Ingress创建证书
 */
export async function createIngressCertificateApi(data: IngressCertificateReq) {
  return requestClient.post('/k8s/ingress/create_certificate', data);
}

/**
 * 获取Ingress控制器列表
 */
export async function getIngressControllersApi(cluster_id: number) {
  return requestClient.get(`/k8s/ingress/${cluster_id}/controllers`);
}

/**
 * 获取Ingress类列表
 */
export async function getIngressClassesApi(cluster_id: number) {
  return requestClient.get(`/k8s/ingress/${cluster_id}/classes`);
}

/**
 * 验证Ingress规则
 */
export async function validateIngressRulesApi(cluster_id: number, rules: IngressRule[]) {
  return requestClient.post('/k8s/ingress/validate_rules', {
    cluster_id,
    rules,
  });
}
