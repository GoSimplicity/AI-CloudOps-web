import { requestClient } from '#/api/request';
import type { KeyValueList } from './k8s_cluster';

// K8s命名空间接口
export interface K8sNamespace {
  cluster_id: number; // 所属集群ID
  name: string; // 命名空间名称
  uid?: string; // 命名空间UID
  status?: string; // 命名空间状态
  phase?: string; // 命名空间阶段
  labels?: KeyValueList; // 标签
  annotations?: KeyValueList; // 注解
}

// 命名空间列表查询请求
export interface K8sNamespaceListReq {
  page?: number; // 页码
  size?: number; // 每页数量
  search?: string; // 搜索
  cluster_id: number; // 集群ID，必填
  status?: string; // 状态过滤
  labels?: KeyValueList; // 标签
}

// 创建命名空间请求
export interface CreateNamespaceReq {
  cluster_id: number; // 集群ID，必填
  name: string; // 命名空间名称，必填
  labels?: KeyValueList; // 标签
  annotations?: KeyValueList; // 注解
}

// 更新命名空间请求
export interface UpdateNamespaceReq {
  cluster_id: number; // 集群ID，必填
  name: string; // 命名空间名称，必填
  labels?: KeyValueList; // 标签
  annotations?: KeyValueList; // 注解
}

// 删除命名空间请求
export interface DeleteNamespaceReq {
  cluster_id: number; // 集群ID，必填
  name: string; // 命名空间名称，必填
  grace_period_seconds?: number; // 优雅删除时间（秒）
  force: 1 | 2; // 是否强制删除
}

// 获取命名空间详情请求
export interface GetNamespaceDetailsReq {
  cluster_id: number; // 集群ID，必填
  name: string; // 命名空间名称，必填
}

/**
 * 获取命名空间列表
 */
export async function getNamespacesListApi(
  clusterId: number,
  params?: K8sNamespaceListReq,
) {
  return requestClient.get(`/k8s/clusters/${clusterId}/namespace/list`, { params });
}

/**
 * 创建命名空间
 */
export async function createNamespaceApi(
  clusterId: number,
  data: CreateNamespaceReq,
) {
  return requestClient.post(`/k8s/clusters/${clusterId}/namespace/create`, data);
}

/**
 * 删除命名空间
 */
export async function deleteNamespaceApi(
  clusterId: number,
  name: string,
  data?: DeleteNamespaceReq,
) {
  return requestClient.delete(`/k8s/clusters/${clusterId}/namespace/${name}/delete`, {
    data,
  });
}

/**
 * 获取命名空间详情
 */
export async function getNamespaceDetailsApi(clusterId: number, name: string) {
  return requestClient.get(`/k8s/clusters/${clusterId}/namespace/${name}/detail`);
}

/**
 * 更新命名空间
 */
export async function updateNamespaceApi(
  clusterId: number,
  name: string,
  data: UpdateNamespaceReq,
) {
  return requestClient.put(`/k8s/clusters/${clusterId}/namespace/${name}/update`, data);
}
