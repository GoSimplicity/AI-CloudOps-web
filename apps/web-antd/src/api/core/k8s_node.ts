import { requestClient } from '#/api/request';

// 节点相关接口和类型定义

export interface NodesItems {
  name: string;
  cluster_id: number;
  status: string;
  roles: string[];
  ip: string;
  pod_num_info: string;
  created_at: string;
  schedulable?: boolean;
  labels?: string[];
  taints?: string[];
  age?: string;
}

export interface NodeDetails {
  name: string;
  cluster_id: number;
  status: string;
  schedulable: boolean;
  roles: string[];
  age: string;
  ip: string;
  pod_num: number;
  cpu_request_info: string;
  cpu_limit_info: string;
  cpu_usage_info: string;
  memory_request_info: string;
  memory_limit_info: string;
  memory_usage_info: string;
  pod_num_info: string;
  cpu_cores: string;
  mem_gibs: string;
  ephemeral_storage: string;
  kubelet_version: string;
  cri_version: string;
  os_version: string;
  kernel_version: string;
  labels: string[];
  taints: string;
  events: NodeEvent[];
  resourceUsage?: any;
}

export interface NodeEvent {
  type: string;
  component: string;
  reason: string;
  message: string;
  first_time: string;
  last_time: string;
  object: string;
  count: number;
}

export interface AddNodeLabelReq {
  cluster_id: number;
  mod_type: string;
  node_name: string[];
  labels: string[];
}

export interface DeleteNodeLabelReq {
  cluster_id: number;
  mod_type: string;
  node_name: string[];
  labels: string[];
}

export interface NodeListReq {
  cluster_id: number;
  label_selector?: string;
  field_selector?: string;
}

export interface NodeCordonReq {
  cluster_id: number;
  node_name: string;
}

export interface NodeUncordonReq {
  cluster_id: number;
  node_name: string;
}

export interface NodeDrainReq {
  cluster_id: number;
  node_name: string;
  force?: boolean;
  delete_local_data?: boolean;
  ignore_daemonsets?: boolean;
  grace_period_seconds?: number;
  timeout?: number;
}

// 节点相关API函数

/**
 * 获取集群节点列表
 */
export async function getNodeListApi(id: number) {
  return requestClient.get<NodesItems[]>(`/k8s/nodes/list/${id}`);
}

/**
 * 获取节点详细信息
 */
export async function getNodeDetailsApi(path: string, query: string) {
  return requestClient.get<NodeDetails>(`/k8s/nodes/${path}?id=${query}`);
}

/**
 * 添加节点标签
 */
export async function addNodeLabelApi(data: AddNodeLabelReq) {
  return requestClient.post('/k8s/nodes/labels/add', data);
}

/**
 * 删除节点标签
 */
export async function deleteNodeLabelApi(data: DeleteNodeLabelReq) {
  return requestClient.post('/k8s/nodes/labels/delete', data);
}

/**
 * 封锁节点（标记为不可调度）
 */
export async function cordonNodeApi(data: NodeCordonReq) {
  return requestClient.post('/k8s/nodes/cordon', data);
}

/**
 * 解封节点（标记为可调度）
 */
export async function uncordonNodeApi(data: NodeUncordonReq) {
  return requestClient.post('/k8s/nodes/uncordon', data);
}

/**
 * 排空节点（驱逐所有Pod）
 */
export async function drainNodeApi(data: NodeDrainReq) {
  return requestClient.post('/k8s/nodes/drain', data);
}

/**
 * 获取节点资源使用情况
 */
export async function getNodeResourcesApi(cluster_id: number, node_name: string) {
  return requestClient.get(`/k8s/nodes/${cluster_id}/${node_name}/resources`);
}

/**
 * 获取节点事件
 */
export async function getNodeEventsApi(cluster_id: number, node_name: string) {
  return requestClient.get(`/k8s/nodes/${cluster_id}/${node_name}/events`);
}
