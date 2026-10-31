import type { CloudAccount, CloudAccountRegion } from './tree_account';

import { requestClient } from '#/api/request';

// 云厂商类型
export enum CloudProvider {
  ALIYUN = 1, // 阿里云
  TENCENT = 2, // 腾讯云
  AWS = 3, // AWS
  HUAWEI = 4, // 华为云
  AZURE = 5, // Azure
  GCP = 6, // Google Cloud
}

// 云资源类型
export enum CloudResourceType {
  ECS = 1, // 云服务器
  RDS = 2, // 云数据库
  SLB = 3, // 负载均衡
  OSS = 4, // 对象存储
  VPC = 5, // 虚拟私有云
  OTHER = 6, // 其他资源
}

// 云资源状态
export enum CloudResourceStatus {
  RUNNING = 1, // 运行中
  STOPPED = 2, // 已停止
  STARTING = 3, // 启动中
  STOPPING = 4, // 停止中
  DELETED = 5, // 已删除
  UNKNOWN = 6, // 未知状态
}

// 货币单位
export enum Currency {
  CNY = 'CNY', // 人民币
  USD = 'USD', // 美元
}

// 计费方式
export enum ChargeType {
  POST_PAID = 'PostPaid', // 按量付费
  PRE_PAID = 'PrePaid', // 包年包月
}

// 同步模式
export enum SyncMode {
  FULL = 'full', // 全量同步
  INCREMENTAL = 'incremental', // 增量同步
}

// SSH认证方式
export enum AuthMode {
  PASSWORD = 1, // 密码认证
  KEY = 2, // 密钥认证
}

// 键值对类型
export interface KeyValue {
  key: string;
  value: string;
}

export type KeyValueList = KeyValue[];

// 云资源基础信息
export interface TreeCloudResource {
  id: number;
  name: string;
  resource_type: CloudResourceType;
  status: CloudResourceStatus;
  environment?: string;
  description?: string;
  tags?: KeyValueList;
  create_user_id: number;
  create_user_name: string;
  cloud_account_id: number;
  cloud_account?: CloudAccount;
  cloud_account_region_id?: number;
  cloud_account_region?: CloudAccountRegion;
  region?: string;
  instance_id?: string;
  instance_type?: string;
  cpu: number;
  memory: number;
  disk: number;
  public_ip?: string;
  private_ip?: string;
  vpc_id?: string;
  zone_id?: string;
  charge_type?: ChargeType;
  expire_time?: string;
  monthly_cost: number;
  currency: Currency;
  os_type?: string;
  os_name?: string;
  image_id?: string;
  image_name?: string;
  port: number;
  username?: string;
  password?: string;
  key?: string;
  auth_mode: AuthMode;
  tree_nodes?: any[]; // TreeNode类型数组
  created_at: string;
  updated_at: string;
}

// 获取云资源列表请求
export interface GetTreeCloudResourceListReq {
  page?: number;
  size?: number;
  search?: string;
  cloud_account_id?: number;
  resource_type?: CloudResourceType;
  status?: CloudResourceStatus;
  environment?: string;
}

// 获取云资源详情请求
export interface GetTreeCloudResourceDetailReq {
  id: number;
}

// 更新云资源请求
export interface UpdateTreeCloudResourceReq {
  id: number;
  environment?: string;
  description?: string;
  tags?: KeyValueList;
  port?: number;
  username?: string;
  password?: string;
  key?: string;
  auth_mode?: AuthMode;
}

// 删除云资源请求
export interface DeleteTreeCloudResourceReq {
  id: number;
}

// 同步云资源请求
export interface SyncTreeCloudResourceReq {
  cloud_account_id: number;
  resource_types?: CloudResourceType[];
  cloud_account_region_ids?: number[];
  instance_ids?: string[];
  sync_mode?: SyncMode;
  auto_bind?: boolean;
  bind_node_id?: number;
}

// 同步云资源响应
export interface SyncCloudResourceRegionResult {
  region_id: number;
  region: string;
  status: 'success' | 'failed' | 'cancelled' | 'unknown';
  total_count: number;
  new_count: number;
  update_count: number;
  delete_count: number;
  error_category?: string;
  history_id?: number;
  retry_safe?: boolean;
}

export interface SyncCloudResourceResp {
  status?: 'success' | 'partial' | 'failed' | 'unknown';
  regions?: SyncCloudResourceRegionResult[];
  total_count: number;
  new_count: number;
  update_count: number;
  delete_count: number;
  failed_count: number;
  failed_instances: string[];
  sync_time: string;
  message?: string;
}

// 绑定云资源到树节点请求
export interface BindTreeCloudResourceReq {
  id: number;
  tree_node_ids: number[];
}

// 解绑云资源与树节点请求
export interface UnBindTreeCloudResourceReq {
  id: number;
  tree_node_ids: number[];
}

// 获取树节点下的云资源请求
export interface GetTreeNodeCloudResourcesReq {
  node_id: number;
  page?: number;
  page_size?: number;
  cloud_account_id?: number;
  resource_type?: CloudResourceType;
  status?: CloudResourceStatus;
}

// 连接云资源终端请求
export interface ConnectTreeCloudResourceTerminalReq {
  id: number;
}

// 更新云资源状态请求
export interface UpdateCloudResourceStatusReq {
  id: number;
  status: CloudResourceStatus;
}

// 云资源同步历史
export interface CloudResourceSyncHistory {
  id: number;
  region_id?: number;
  region?: string;
  retry_safe?: boolean;
  cloud_account_id: number;
  sync_mode: SyncMode;
  total_count: number;
  new_count: number;
  update_count: number;
  delete_count: number;
  failed_count: number;
  failed_instances: string;
  sync_status: string;
  error_message?: string;
  start_time: string;
  end_time: string;
  duration: number;
  created_at: string;
  updated_at: string;
}

// 获取同步历史请求
export interface GetCloudResourceSyncHistoryReq {
  page?: number;
  size?: number;
  search?: string;
  cloud_account_id?: number;
  sync_status?: string;
}

// 云资源变更日志
export interface CloudResourceChangeLog {
  id: number;
  resource_id: number;
  instance_id?: string;
  change_type: string;
  field_name?: string;
  old_value?: string;
  new_value?: string;
  change_source: string;
  operator_id: number;
  operator_name: string;
  change_time: string;
  created_at: string;
  updated_at: string;
}

// 获取资源变更日志请求
export interface GetCloudResourceChangeLogReq {
  page?: number;
  size?: number;
  search?: string;
  resource_id?: number;
  change_type?: string;
}

// 获取云资源列表
export async function getTreeCloudResourceListApi(
  params: GetTreeCloudResourceListReq,
) {
  return requestClient.get<{ items: TreeCloudResource[]; total: number }>(
    '/tree/cloud/list',
    { params },
  );
}

// 获取云资源详情
export async function getTreeCloudResourceDetailApi(id: number) {
  return requestClient.get<TreeCloudResource>(`/tree/cloud/${id}/detail`);
}

// 更新云资源
export async function updateTreeCloudResourceApi(
  id: number,
  data: Omit<UpdateTreeCloudResourceReq, 'id'>,
) {
  return requestClient.put(`/tree/cloud/${id}/update`, data);
}

// 删除云资源
export async function deleteTreeCloudResourceApi(id: number) {
  return requestClient.delete(`/tree/cloud/${id}/delete`);
}

// 绑定云资源到树节点
export async function bindTreeCloudResourceApi(
  id: number,
  data: Omit<BindTreeCloudResourceReq, 'id'>,
) {
  return requestClient.post(`/tree/cloud/${id}/bind`, data);
}

// 解绑云资源与树节点
export async function unBindTreeCloudResourceApi(
  id: number,
  data: Omit<UnBindTreeCloudResourceReq, 'id'>,
) {
  return requestClient.post(`/tree/cloud/${id}/unbind`, data);
}

// 同步云资源
export async function syncTreeCloudResourceApi(data: SyncTreeCloudResourceReq) {
  return requestClient.post<SyncCloudResourceResp>('/tree/cloud/sync', data);
}

// 获取同步历史
export async function getSyncHistoryApi(
  params: GetCloudResourceSyncHistoryReq,
) {
  return requestClient.get('/tree/cloud/sync/history', { params });
}

// 获取变更日志
export async function getChangeLogApi(params: GetCloudResourceChangeLogReq) {
  return requestClient.get('/tree/cloud/changelog', { params });
}

// 获取树节点下的云资源
export async function getTreeNodeCloudResourcesApi(
  nodeId: number,
  params?: Omit<GetTreeNodeCloudResourcesReq, 'node_id'>,
) {
  return requestClient.get(`/tree/cloud/${nodeId}/node`, { params });
}

// 连接云资源终端
export async function connectCloudResourceTerminalApi(id: number) {
  return requestClient.get(`/tree/cloud/${id}/terminal`);
}

// 更新云资源状态
export async function updateCloudResourceStatusApi(
  id: number,
  data: Omit<UpdateCloudResourceStatusReq, 'id'>,
) {
  return requestClient.put(`/tree/cloud/${id}/status`, data);
}

// 阿里云托管资源使用独立契约，不能当作 ECS/SSH 资源处理。
export type ManagedCloudKind = 'rds' | 'clb' | 'cache';
export interface ManagedRDS {
  instance_id: string;
  name: string;
  region: string;
  zone: string;
  status: string;
  engine: string;
  engine_version: string;
  instance_class: string;
}
export interface ManagedCLB {
  instance_id: string;
  name: string;
  region: string;
  status: string;
  address_type: string;
  vpc_id: string;
}
export interface ManagedCache {
  instance_id: string;
  name: string;
  region: string;
  zone: string;
  status: string;
  instance_type: string;
  engine_version: string;
  instance_class: string;
}
export interface ManagedCloudResource {
  id: number;
  cloud_account_id: number;
  cloud_account_region_id: number;
  kind: ManagedCloudKind;
  provider_id: string;
  rds?: ManagedRDS | null;
  clb?: ManagedCLB | null;
  cache?: ManagedCache | null;
  local_description: string;
  last_sync_time: string;
}
export interface ManagedCloudHistory {
  id: number;
  cloud_account_id: number;
  cloud_account_region_id: number;
  kind: ManagedCloudKind;
  operation_id?: string;
  resource_ids: string[];
  status: 'running' | 'success' | 'failed' | 'cancelled' | 'unknown';
  count: number;
  new_count: number;
  update_count: number;
  error_category?: string;
  retry_safe?: boolean;
  operator_id: number;
  started_at: string;
  finished_at?: string | null;
  resolved_at?: string | null;
  resolved_by?: number;
  resolution_reason?: string;
}
export interface ManagedCloudScope {
  cloud_account_id: number;
  cloud_account_region_id: number;
  kind: ManagedCloudKind;
}
export interface ManagedCloudSyncResult {
  operation_id?: string;
  status: 'success' | 'failed' | 'cancelled' | 'unknown';
  history_id?: number;
  count: number;
  new_count: number;
  update_count: number;
  error_category?: string;
  retry_safe: boolean;
}
export interface ManagedPermissions {
  version: number;
  super_admin: boolean;
  permissions: string[];
}
export const managedPermissions = {
  accountList: 'GET /api/tree/cloud/account/list',
  accountDetail: 'GET /api/tree/cloud/account/:id/detail',
  list: 'GET /api/tree/cloud/managed/list',
  detail: 'GET /api/tree/cloud/managed/detail/:id',
  history: 'GET /api/tree/cloud/managed/history',
  operationList: 'GET /api/tree/cloud/managed/operations',
  operationRead: 'GET /api/tree/cloud/managed/operations/:operation_id',
  operationReview:
    'POST /api/tree/cloud/managed/operations/:operation_id/resolve',
  sync: 'POST /api/tree/cloud/managed/sync',
  resolve: 'POST /api/tree/cloud/managed/history/:id/resolve',
} as const;
export const getManagedPermissions = () =>
  requestClient.get<ManagedPermissions>('/user/permissions');
export const getManagedResources = (
  params: ManagedCloudScope & { page: number; size: number },
) =>
  requestClient.get<{ items: ManagedCloudResource[]; total: number }>(
    '/tree/cloud/managed/list',
    { params },
  );
export const getManagedResourceDetail = (
  id: number,
  params: ManagedCloudScope,
) =>
  requestClient.get<ManagedCloudResource>(`/tree/cloud/managed/detail/${id}`, {
    params,
  });
export const getManagedSyncHistory = (
  params: ManagedCloudScope & { page: number; size: number },
) =>
  requestClient.get<{ items: ManagedCloudHistory[]; total: number }>(
    '/tree/cloud/managed/history',
    { params },
  );
export const syncManagedResources = (
  data: ManagedCloudScope & { resource_ids: string[]; operation_id: string },
) =>
  requestClient.post<ManagedCloudSyncResult>('/tree/cloud/managed/sync', data);

export const resolveManagedHistory = (
  id: number,
  data: ManagedCloudScope & { resources_verified: true; reason: string },
) => requestClient.post(`/tree/cloud/managed/history/${id}/resolve`, data);

export interface ManagedCloudOperation extends ManagedCloudScope {
  owner_id: number;
  operation_id: string;
  resource_ids: string[];
  state: 'running' | 'unknown' | 'completed' | 'reviewed';
  created_at?: string;
  updated_at?: string;
  result?: ManagedCloudSyncResult;
  reviewed_at?: string;
  reviewed_by?: number;
  review_reason?: string;
  previous_state?: string;
}
export const getManagedOperation = (operationID: string, ownerID?: number) =>
  ownerID === undefined
    ? requestClient.get<ManagedCloudOperation>(
        `/tree/cloud/managed/operations/${operationID}`,
      )
    : requestClient.get<ManagedCloudOperation>(
        `/tree/cloud/managed/operations/${operationID}`,
        { params: { owner_id: ownerID } },
      );
export const reviewManagedOperation = (
  operationID: string,
  data: ManagedCloudScope & {
    resource_ids: string[];
    resources_verified: true;
    reason: string;
    owner_id?: number;
  },
) =>
  requestClient.post<ManagedCloudOperation>(
    `/tree/cloud/managed/operations/${operationID}/resolve`,
    data,
  );

export interface ManagedCloudOperationList {
  items: ManagedCloudOperation[];
  total: number;
  scope_blocked: boolean;
}
export const listManagedOperations = (
  params: ManagedCloudScope & {
    page: number;
    size: number;
    unconfirmed_only: boolean;
    all_owners?: boolean;
  },
) =>
  requestClient.get<ManagedCloudOperationList>(
    '/tree/cloud/managed/operations',
    { params },
  );
