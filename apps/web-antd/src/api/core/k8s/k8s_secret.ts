import { requestClient } from '#/api/request';

// K8s Secret类型枚举
export enum K8sSecretType {
  Opaque = 'Opaque', // 通用Secret
  ServiceAccountToken = 'kubernetes.io/service-account-token', // ServiceAccount令牌
  Dockercfg = 'kubernetes.io/dockercfg', // Docker配置
  DockerConfigJson = 'kubernetes.io/dockerconfigjson', // Docker配置JSON
  BasicAuth = 'kubernetes.io/basic-auth', // 基础认证
  SSHAuth = 'kubernetes.io/ssh-auth', // SSH认证
  TLS = 'kubernetes.io/tls', // TLS证书
  BootstrapToken = 'bootstrap.kubernetes.io/token', // 引导令牌
}

// K8s Secret模型
export interface K8sSecret {
  name: string; // Secret名称
  namespace: string; // 所属命名空间
  cluster_id: number; // 所属集群ID
  uid: string; // Secret UID
  type: K8sSecretType; // Secret类型
  data: Record<string, Uint8Array>; // 加密数据
  string_data: Record<string, string>; // 明文数据
  labels: Record<string, string>; // 标签
  annotations: Record<string, string>; // 注解
  immutable: boolean; // 是否不可变
  data_count: number; // 数据条目数量
  size: string; // 数据大小
  age: string; // 存在时间
  created_at: string; // 创建时间
  updated_at: string; // 更新时间
}

// 获取Secret列表请求
export interface GetSecretListReq {
  cluster_id: number; // 集群ID，必填
  namespace?: string; // 命名空间
  type?: K8sSecretType; // Secret类型
  labels?: Record<string, string>; // 标签
  page?: number; // 页码
  size?: number; // 每页大小
}

// 获取Secret详情请求
export interface GetSecretDetailsReq {
  cluster_id: number; // 集群ID，必填
  namespace: string; // 命名空间，必填
  name: string; // Secret名称，必填
}

// 获取Secret YAML请求
export interface GetSecretYamlReq {
  cluster_id: number; // 集群ID，必填
  namespace: string; // 命名空间，必填
  name: string; // Secret名称，必填
}

// 创建Secret请求
export interface CreateSecretReq {
  cluster_id: number; // 集群ID，必填
  name: string; // Secret名称，必填
  namespace: string; // 命名空间，必填
  type?: K8sSecretType; // Secret类型
  data?: Record<string, Uint8Array>; // 加密数据
  string_data?: Record<string, string>; // 明文数据
  labels?: Record<string, string>; // 标签
  annotations?: Record<string, string>; // 注解
  immutable?: boolean; // 是否不可变
}

// 更新Secret请求
export interface UpdateSecretReq {
  cluster_id: number; // 集群ID，必填
  name: string; // Secret名称，必填
  namespace: string; // 命名空间，必填
  data?: Record<string, Uint8Array>; // 加密数据
  string_data?: Record<string, string>; // 明文数据
  labels?: Record<string, string>; // 标签
  annotations?: Record<string, string>; // 注解
}

// 通过YAML创建Secret请求
export interface CreateSecretByYamlReq {
  cluster_id: number; // 集群ID，必填
  yaml: string; // YAML内容，必填
}

// 通过YAML更新Secret请求
export interface UpdateSecretByYamlReq {
  cluster_id: number; // 集群ID，必填
  namespace: string; // 命名空间，必填
  name: string; // Secret名称，必填
  yaml: string; // YAML内容，必填
}

// 删除Secret请求
export interface DeleteSecretReq {
  cluster_id: number; // 集群ID，必填
  namespace: string; // 命名空间，必填
  name: string; // Secret名称，必填
}

/**
 * 获取Secret列表
 */
export async function getSecretListApi(params: GetSecretListReq) {
  return requestClient.get(
    `/k8s/secret/${params.cluster_id}/list`,
    {
      params: {
        namespace: params.namespace,
        type: params.type,
        labels: params.labels,
        page: params.page,
        size: params.size,
      },
    },
  );
}

/**
 * 获取Secret详情
 */
export async function getSecretDetailsApi(params: GetSecretDetailsReq) {
  return requestClient.get(
    `/k8s/secret/${params.cluster_id}/${params.namespace}/${params.name}/detail`,
  );
}

/**
 * 获取Secret YAML
 */
export async function getSecretYamlApi(params: GetSecretYamlReq) {
  return requestClient.get(
    `/k8s/secret/${params.cluster_id}/${params.namespace}/${params.name}/detail/yaml`,
  );
}

/**
 * 创建Secret
 */
export async function createSecretApi(params: CreateSecretReq) {
  return requestClient.post(
    `/k8s/secret/${params.cluster_id}/create`,
    params,
  );
}

/**
 * 更新Secret
 */
export async function updateSecretApi(params: UpdateSecretReq) {
  return requestClient.put(
    `/k8s/secret/${params.cluster_id}/${params.namespace}/${params.name}/update`,
    params,
  );
}

/**
 * 通过YAML创建Secret
 */
export async function createSecretByYamlApi(params: CreateSecretByYamlReq) {
  return requestClient.post(
    `/k8s/secret/${params.cluster_id}/create/yaml`,
    params,
  );
}

/**
 * 通过YAML更新Secret
 */
export async function updateSecretByYamlApi(params: UpdateSecretByYamlReq) {
  return requestClient.put(
    `/k8s/secret/${params.cluster_id}/${params.namespace}/${params.name}/update/yaml`,
    params,
  );
}

/**
 * 删除Secret
 */
export async function deleteSecretApi(params: DeleteSecretReq) {
  return requestClient.delete(
    `/k8s/secret/${params.cluster_id}/${params.namespace}/${params.name}/delete`,
  );
}
