import { requestClient } from '#/api/request';

// 环境枚举
export enum Env {
  Prod = 1, // 生产环境
  Dev = 2, // 开发环境
  Stage = 3, // 预发环境
  Rc = 4, // 测试环境
  Press = 5, // 灰度环境
}

// 集群状态枚举
export enum ClusterStatus {
  Running = 1, // 运行中
  Stopped = 2, // 停止
  Error = 3, // 异常
}

// 键值对类型
export interface KeyValue {
  key: string;
  value: string;
}

export type KeyValueList = KeyValue[];
export type StringList = string[];

// K8s集群
export interface K8sCluster {
  id?: number;
  name: string; // 集群名称
  cpu_request?: string; // CPU 请求量 (m)
  cpu_limit?: string; // CPU 限制量 (m)
  memory_request?: string; // 内存请求量 (Mi)
  memory_limit?: string; // 内存限制量 (Mi)
  restrict_namespace: StringList; // 资源限制命名空间
  status: ClusterStatus; // 集群状态
  env?: Env; // 集群环境
  version?: string; // 集群版本
  api_server_addr?: string; // API Server 地址
  kube_config_content?: string; // kubeConfig 内容
  action_timeout_seconds?: number; // 操作超时时间（秒）
  create_user_name?: string; // 创建者用户名
  create_user_id?: number; // 创建者用户ID
  tags?: KeyValueList; // 标签
  created_at?: string;
  updated_at?: string;
}

// 创建集群请求
export interface CreateClusterReq {
  name: string; // 集群名称
  cpu_request?: string; // CPU 请求量
  cpu_limit?: string; // CPU 限制量
  memory_request?: string; // 内存请求量
  memory_limit?: string; // 内存限制量
  restrict_namespace: StringList; // 资源限制命名空间
  env?: Env; // 集群环境
  version?: string; // 集群版本
  api_server_addr?: string; // API Server 地址
  kube_config_content?: string; // kubeConfig 内容
  action_timeout_seconds?: number; // 操作超时时间（秒）
  tags?: KeyValueList; // 标签
}

// 更新集群请求
export interface UpdateClusterReq {
  id: number; // 集群ID
  name: string; // 集群名称
  cpu_request?: string; // CPU 请求量
  cpu_limit?: string; // CPU 限制量
  memory_request?: string; // 内存请求量
  memory_limit?: string; // 内存限制量
  restrict_namespace: StringList; // 资源限制命名空间
  env?: Env; // 集群环境
  version?: string; // 集群版本
  api_server_addr?: string; // API Server 地址
  kube_config_content?: string; // kubeConfig 内容
  action_timeout_seconds?: number; // 操作超时时间（秒）
  tags?: KeyValueList; // 标签
}

// 删除集群请求
export interface DeleteClusterReq {
  id: number; // 集群ID
}

// 刷新集群请求
export interface RefreshClusterReq {
  id: number; // 集群ID
}

// 获取单个集群请求
export interface GetClusterReq {
  id: number; // 集群ID
}

// 获取集群列表请求
export interface ListClustersReq {
  page?: number; // 页码
  size?: number; // 每页数量
  search?: string; // 搜索
  status?: string; // 集群状态过滤
  env?: string; // 环境过滤
}

// 刷新集群状态请求
export interface RefreshClusterStatusReq {
  id: number; // 集群ID
}

/**
 * 获取集群列表
 */
export async function getClustersListApi(params?: ListClustersReq) {
  return requestClient.get('/k8s/cluster/list', { params });
}

/**
 * 获取集群详情
 */
export async function getClusterDetailApi(id: number) {
  return requestClient.get(`/k8s/cluster/${id}/detail`);
}

/**
 * 创建集群
 */
export async function createClusterApi(data: CreateClusterReq) {
  return requestClient.post('/k8s/cluster/create', data);
}

/**
 * 更新集群
 */
export async function updateClusterApi(id: number, data: UpdateClusterReq) {
  return requestClient.put(`/k8s/cluster/${id}/update`, data);
}

/**
 * 删除集群
 */
export async function deleteClusterApi(id: number) {
  return requestClient.delete(`/k8s/cluster/${id}/delete`);
}

/**
 * 刷新集群状态
 */
export async function refreshClusterApi(id: number) {
  return requestClient.post(`/k8s/clusters/${id}/refresh`);
}
