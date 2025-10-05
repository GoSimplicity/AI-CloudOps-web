import { requestClient } from '#/api/request';

// K8s ConfigMap模型
export interface K8sConfigMap {
  name: string; // ConfigMap名称
  namespace: string; // 所属命名空间
  cluster_id: number; // 所属集群ID
  uid: string; // ConfigMap UID
  data: Record<string, string>; // 字符串数据
  binary_data?: Record<string, string>; // 二进制数据（map，每个value是base64编码的字符串）
  labels: Record<string, string>; // 标签
  annotations: Record<string, string>; // 注解
  immutable: boolean; // 是否不可变
  data_count: number; // 数据条目数量
  size: string; // 数据大小
  created_at: string; // 创建时间
  updated_at: string; // 更新时间
  age: string; // 存在时间
}

// 获取ConfigMap列表请求
export interface GetConfigMapListReq {
  cluster_id: number; // 集群ID，必填
  namespace?: string; // 命名空间
  labels?: Record<string, string>; // 标签
  page?: number; // 页码
  size?: number; // 每页大小
}

// 获取ConfigMap详情请求
export interface GetConfigMapDetailsReq {
  cluster_id: number; // 集群ID，必填
  namespace: string; // 命名空间，必填
  name: string; // ConfigMap名称，必填
}

// 获取ConfigMap YAML请求
export interface GetConfigMapYamlReq {
  cluster_id: number; // 集群ID，必填
  namespace: string; // 命名空间，必填
  name: string; // ConfigMap名称，必填
}

// 创建ConfigMap请求
export interface CreateConfigMapReq {
  cluster_id: number; // 集群ID，必填
  name: string; // ConfigMap名称，必填
  namespace: string; // 命名空间，必填
  data?: Record<string, string>; // 字符串数据
  binary_data?: Record<string, string>; // 二进制数据（map，每个value是base64编码的字符串）
  labels?: Record<string, string>; // 标签
  annotations?: Record<string, string>; // 注解
  immutable?: boolean; // 是否不可变
}

// 更新ConfigMap请求
export interface UpdateConfigMapReq {
  cluster_id: number; // 集群ID，必填
  name: string; // ConfigMap名称，必填
  namespace: string; // 命名空间，必填
  data?: Record<string, string>; // 字符串数据
  binary_data?: Record<string, string>; // 二进制数据（map，每个value是base64编码的字符串）
  labels?: Record<string, string>; // 标签
  annotations?: Record<string, string>; // 注解
}

// 通过YAML创建ConfigMap请求
export interface CreateConfigMapByYamlReq {
  cluster_id: number; // 集群ID，必填
  yaml: string; // YAML内容，必填
}

// 通过YAML更新ConfigMap请求
export interface UpdateConfigMapByYamlReq {
  cluster_id: number; // 集群ID，必填
  namespace: string; // 命名空间，必填
  name: string; // ConfigMap名称，必填
  yaml: string; // YAML内容，必填
}

// 删除ConfigMap请求
export interface DeleteConfigMapReq {
  cluster_id: number; // 集群ID，必填
  namespace: string; // 命名空间，必填
  name: string; // ConfigMap名称，必填
}

/**
 * 获取ConfigMap列表
 */
export async function getConfigMapListApi(params: GetConfigMapListReq) {
  return requestClient.get(
    `/k8s/configmap/${params.cluster_id}/list`,
    {
      params: {
        namespace: params.namespace,
        labels: params.labels,
        page: params.page,
        size: params.size,
      },
    },
  );
}

/**
 * 获取ConfigMap详情
 */
export async function getConfigMapDetailsApi(params: GetConfigMapDetailsReq) {
  return requestClient.get(
    `/k8s/configmap/${params.cluster_id}/${params.namespace}/${params.name}/detail`,
  );
}

/**
 * 获取ConfigMap YAML
 */
export async function getConfigMapYamlApi(params: GetConfigMapYamlReq) {
  return requestClient.get(
    `/k8s/configmap/${params.cluster_id}/${params.namespace}/${params.name}/detail/yaml`,
  );
}

/**
 * 创建ConfigMap
 */
export async function createConfigMapApi(params: CreateConfigMapReq) {
  return requestClient.post(
    `/k8s/configmap/${params.cluster_id}/create`,
    params,
  );
}

/**
 * 通过YAML创建ConfigMap
 */
export async function createConfigMapByYamlApi(params: CreateConfigMapByYamlReq) {
  return requestClient.post(
    `/k8s/configmap/${params.cluster_id}/create/yaml`,
    params,
  );
}

/**
 * 更新ConfigMap
 */
export async function updateConfigMapApi(params: UpdateConfigMapReq) {
  return requestClient.put(
    `/k8s/configmap/${params.cluster_id}/${params.namespace}/${params.name}/update`,
    params,
  );
}

/**
 * 通过YAML更新ConfigMap
 */
export async function updateConfigMapByYamlApi(params: UpdateConfigMapByYamlReq) {
  return requestClient.put(
    `/k8s/configmap/${params.cluster_id}/${params.namespace}/${params.name}/update/yaml`,
    params,
  );
}

/**
 * 删除ConfigMap
 */
export async function deleteConfigMapApi(params: DeleteConfigMapReq) {
  return requestClient.delete(
    `/k8s/configmap/${params.cluster_id}/${params.namespace}/${params.name}/delete`,
  );
}
