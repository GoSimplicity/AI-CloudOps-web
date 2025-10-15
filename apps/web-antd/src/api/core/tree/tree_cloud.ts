import { requestClient } from '#/api/request';

// 云厂商类型
export enum CloudProvider {
  ALIYUN = 1,   // 阿里云
  TENCENT = 2,  // 腾讯云
  AWS = 3,      // AWS
  HUAWEI = 4,   // 华为云
  AZURE = 5,    // Azure
  GCP = 6,      // Google Cloud
}

// 云资源类型
export enum CloudResourceType {
  ECS = 1,   // 云服务器
  RDS = 2,   // 云数据库
  SLB = 3,   // 负载均衡
  OSS = 4,   // 对象存储
  VPC = 5,   // 虚拟私有云
  OTHER = 6, // 其他资源
}

// 云资源状态
export enum CloudResourceStatus {
  RUNNING = 1,  // 运行中
  STOPPED = 2,  // 已停止
  STARTING = 3, // 启动中
  STOPPING = 4, // 停止中
  DELETED = 5,  // 已删除
  UNKNOWN = 6,  // 未知状态
}

// 货币单位
export enum Currency {
  CNY = 'CNY', // 人民币
  USD = 'USD', // 美元
}

// 计费方式
export enum ChargeType {
  POST_PAID = 'PostPaid', // 按量付费
  PRE_PAID = 'PrePaid',   // 包年包月
}

// 同步模式
export enum SyncMode {
  FULL = 'full',               // 全量同步
  INCREMENTAL = 'incremental', // 增量同步
}

// SSH认证方式
export enum AuthMode {
  PASSWORD = 1, // 密码认证
  KEY = 2,      // 密钥认证
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
  cloud_account?: any; // CloudAccount类型
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
  page_size?: number;
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
  regions?: string[];
  instance_ids?: string[];
  sync_mode?: SyncMode;
  auto_bind?: boolean;
  bind_node_id?: number;
}

// 同步云资源响应
export interface SyncCloudResourceResp {
  total_count: number;
  new_count: number;
  update_count: number;
  delete_count: number;
  failed_count: number;
  failed_instances: string[];
  sync_time: string;
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
export async function getTreeCloudResourceListApi(params: GetTreeCloudResourceListReq) {
  return requestClient.get('/tree/cloud/list', { params });
}

// 获取云资源详情
export async function getTreeCloudResourceDetailApi(id: number) {
  return requestClient.get(`/tree/cloud/${id}/detail`);
}

// 更新云资源
export async function updateTreeCloudResourceApi(id: number, data: Omit<UpdateTreeCloudResourceReq, 'id'>) {
  return requestClient.put(`/tree/cloud/${id}/update`, data);
}

// 删除云资源
export async function deleteTreeCloudResourceApi(id: number) {
  return requestClient.delete(`/tree/cloud/${id}/delete`);
}

// 绑定云资源到树节点
export async function bindTreeCloudResourceApi(id: number, data: Omit<BindTreeCloudResourceReq, 'id'>) {
  return requestClient.post(`/tree/cloud/${id}/bind`, data);
}

// 解绑云资源与树节点
export async function unBindTreeCloudResourceApi(id: number, data: Omit<UnBindTreeCloudResourceReq, 'id'>) {
  return requestClient.post(`/tree/cloud/${id}/unbind`, data);
}

// 同步云资源
export async function syncTreeCloudResourceApi(data: SyncTreeCloudResourceReq) {
  return requestClient.post('/tree/cloud/sync', data);
}

// 获取同步历史
export async function getSyncHistoryApi(params: GetCloudResourceSyncHistoryReq) {
  return requestClient.get('/tree/cloud/sync/history', { params });
}

// 获取变更日志
export async function getChangeLogApi(params: GetCloudResourceChangeLogReq) {
  return requestClient.get('/tree/cloud/changelog', { params });
}

// 获取树节点下的云资源
export async function getTreeNodeCloudResourcesApi(nodeId: number, params?: Omit<GetTreeNodeCloudResourcesReq, 'node_id'>) {
  return requestClient.get(`/tree/cloud/${nodeId}/node`, { params });
}

// 连接云资源终端
export async function connectCloudResourceTerminalApi(id: number) {
  return requestClient.get(`/tree/cloud/${id}/terminal`);
}

// 更新云资源状态
export async function updateCloudResourceStatusApi(id: number, data: Omit<UpdateCloudResourceStatusReq, 'id'>) {
  return requestClient.put(`/tree/cloud/${id}/status`, data);
}
