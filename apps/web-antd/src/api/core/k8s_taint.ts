import { requestClient } from '#/api/request';

// Taint相关接口和类型定义

export interface TaintInfo {
  key: string;
  value?: string;
  effect: 'NoSchedule' | 'PreferNoSchedule' | 'NoExecute';
  time_added?: string;
}

export interface AddTaintReq {
  cluster_id: number;
  node_name: string;
  mod_type: 'add' | 'del';
  taint_yaml?: string;
}

export interface DeleteTaintReq {
  cluster_id: number;
  node_name: string;
  mod_type: 'add' | 'del';
  taint_yaml?: string;
}

export interface CheckTaintYamlReq {
  cluster_id: number;
  node_name: string;
  taint_yaml: string;
}

export interface SetNodeScheduleReq {
  cluster_id: number;
  node_name: string;
  schedule_enable: boolean;
}

export interface ClearNodeTaintsReq {
  cluster_id: number;
  node_name: string;
  force?: boolean;
}

export interface NodeTaintListReq {
  cluster_id: number;
  node_name: string;
}

// Taint相关API函数

/**
 * 添加节点污点
 */
export async function addNodeTaintApi(data: AddTaintReq) {
  return requestClient.post('/k8s/taints/add', data);
}

/**
 * 删除节点污点
 */
export async function deleteNodeTaintApi(data: DeleteTaintReq) {
  return requestClient.delete('/k8s/taints/delete', { data });
}

/**
 * 检查污点YAML配置
 */
export async function checkTaintYamlApi(data: CheckTaintYamlReq) {
  return requestClient.post('/k8s/taints/taint_check', data);
}

/**
 * 设置节点调度状态（封锁/解封）
 */
export async function setNodeScheduleApi(data: SetNodeScheduleReq) {
  return requestClient.post('/k8s/taints/enable_switch', data);
}

/**
 * 清除节点所有污点
 */
export async function clearNodeTaintsApi(data: ClearNodeTaintsReq) {
  return requestClient.post('/k8s/taints/drain', data);
}

/**
 * 获取节点污点列表
 */
export async function getNodeTaintsApi(cluster_id: number, node_name: string) {
  return requestClient.get<TaintInfo[]>(`/k8s/taints/${cluster_id}/${node_name}`);
}

/**
 * 批量添加污点
 */
export async function batchAddTaintsApi(cluster_id: number, node_names: string[], taints: TaintInfo[]) {
  return requestClient.post('/k8s/taints/batch_add', {
    cluster_id,
    node_names,
    taints,
  });
}

/**
 * 批量删除污点
 */
export async function batchDeleteTaintsApi(cluster_id: number, node_names: string[], taint_keys: string[]) {
  return requestClient.post('/k8s/taints/batch_delete', {
    cluster_id,
    node_names,
    taint_keys,
  });
}

/**
 * 根据效果过滤污点
 */
export async function getTaintsByEffectApi(cluster_id: number, node_name: string, effect: string) {
  return requestClient.get<TaintInfo[]>(`/k8s/taints/${cluster_id}/${node_name}/effect?effect=${effect}`);
}
