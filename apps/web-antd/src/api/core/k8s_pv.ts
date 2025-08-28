import { requestClient } from '#/api/request';

// PersistentVolume相关接口和类型定义

export interface PVInfo {
  name: string;
  cluster_id: number;
  uid: string;
  capacity: string;
  access_modes: string[];
  reclaim_policy: string;
  status: string;
  claim?: string;
  storage_class?: string;
  volume_mode?: string;
  labels?: Record<string, string>;
  annotations?: Record<string, string>;
  creation_timestamp: string;
  age: string;
  reason?: string;
}

export interface PVListReq {
  cluster_id: number;
  label_selector?: string;
  field_selector?: string;
  status?: string;
  storage_class?: string;
  access_mode?: string;
  page?: number;
  page_size?: number;
}

export interface PVCreateReq {
  cluster_id: number;
  name: string;
  capacity: string;
  access_modes: string[];
  reclaim_policy?: string;
  storage_class?: string;
  volume_mode?: string;
  persistent_volume_source: PVSource;
  labels?: Record<string, string>;
  annotations?: Record<string, string>;
}

export interface PVUpdateReq {
  cluster_id: number;
  name: string;
  reclaim_policy?: string;
  labels?: Record<string, string>;
  annotations?: Record<string, string>;
}

export interface PVDeleteReq {
  cluster_id: number;
  name: string;
  force?: boolean;
}

export interface PVSource {
  type: 'nfs' | 'hostPath' | 'cephfs' | 'glusterfs' | 'iscsi' | 'local' | 'csi';
  nfs?: {
    server: string;
    path: string;
  };
  host_path?: {
    path: string;
    type?: string;
  };
  cephfs?: {
    monitors: string[];
    user?: string;
    secret_ref?: {
      name: string;
      namespace?: string;
    };
  };
  csi?: {
    driver: string;
    volume_handle: string;
    volume_attributes?: Record<string, string>;
  };
  local?: {
    path: string;
  };
}

export interface PVStatistics {
  total_count: number;
  available_count: number;
  bound_count: number;
  released_count: number;
  failed_count: number;
  total_capacity: string;
  used_capacity: string;
}

// PersistentVolume相关API函数

/**
 * 获取PV列表
 */
export async function getPVListApi(data: PVListReq) {
  const params = new URLSearchParams();
  if (data.label_selector) params.append('label_selector', data.label_selector);
  if (data.field_selector) params.append('field_selector', data.field_selector);
  if (data.status) params.append('status', data.status);
  if (data.storage_class) params.append('storage_class', data.storage_class);
  if (data.access_mode) params.append('access_mode', data.access_mode);
  if (data.page) params.append('page', data.page.toString());
  if (data.page_size) params.append('page_size', data.page_size.toString());

  return requestClient.get<PVInfo[]>(`/k8s/pv/${data.cluster_id}?${params}`);
}

/**
 * 获取PV详情
 */
export async function getPVDetailApi(cluster_id: number, name: string) {
  return requestClient.get<PVInfo>(`/k8s/pv/${cluster_id}/${name}`);
}

/**
 * 创建PV
 */
export async function createPVApi(data: PVCreateReq) {
  return requestClient.post('/k8s/pv/create', data);
}

/**
 * 更新PV
 */
export async function updatePVApi(data: PVUpdateReq) {
  return requestClient.post('/k8s/pv/update', data);
}

/**
 * 删除PV
 */
export async function deletePVApi(data: PVDeleteReq) {
  return requestClient.delete('/k8s/pv/delete', { data });
}

/**
 * 批量删除PV
 */
export async function batchDeletePVApi(cluster_id: number, names: string[], force?: boolean) {
  return requestClient.delete('/k8s/pv/batch_delete', {
    data: { cluster_id, names, force },
  });
}

/**
 * 回收PV
 */
export async function reclaimPVApi(cluster_id: number, name: string) {
  return requestClient.post('/k8s/pv/reclaim', {
    cluster_id,
    name,
  });
}

/**
 * 获取PV统计信息
 */
export async function getPVStatisticsApi(cluster_id: number) {
  return requestClient.get<PVStatistics>(`/k8s/pv/${cluster_id}/statistics`);
}

/**
 * 获取可用PV列表
 */
export async function getAvailablePVListApi(cluster_id: number, capacity?: string, access_mode?: string) {
  const params = new URLSearchParams();
  if (capacity) params.append('capacity', capacity);
  if (access_mode) params.append('access_mode', access_mode);

  return requestClient.get<PVInfo[]>(`/k8s/pv/${cluster_id}/available?${params}`);
}

/**
 * 获取PV的YAML配置
 */
export async function getPVYamlApi(cluster_id: number, name: string) {
  return requestClient.get(`/k8s/pv/${cluster_id}/${name}/yaml`);
}

/**
 * 扩容PV
 */
export async function expandPVApi(cluster_id: number, name: string, new_capacity: string) {
  return requestClient.post('/k8s/pv/expand', {
    cluster_id,
    name,
    new_capacity,
  });
}
