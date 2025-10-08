import { requestClient } from '#/api/request';

// 云厂商类型枚举
export enum CloudProvider {
  AliCloud = 1,
  TencentCloud = 2,
  HuaweiCloud = 3,
  AWS = 4,
  Azure = 5,
  GCP = 6,
}

// 云账户状态枚举
export enum CloudAccountStatus {
  Enabled = 1,  // 启用
  Disabled = 2, // 禁用
}

// 云账户模型
export interface CloudAccount {
  id: number;
  name: string;
  provider: CloudProvider;
  region: string;
  account_id?: string;
  account_name?: string;
  account_alias?: string;
  description?: string;
  status: CloudAccountStatus;
  create_user_id?: number;
  create_user_name?: string;
  created_at?: string;
  updated_at?: string;
}

// 获取云账户列表请求参数
export interface GetCloudAccountListReq {
  page?: number;
  size?: number;
  search?: string;
  provider?: CloudProvider;
  region?: string;
  status?: CloudAccountStatus;
}

// 获取云账户详情请求参数
export interface GetCloudAccountDetailReq {
  id: number;
}

// 创建云账户请求参数
export interface CreateCloudAccountReq {
  name: string;
  provider: CloudProvider;
  region: string;
  access_key: string;
  secret_key: string;
  account_id?: string;
  account_name?: string;
  account_alias?: string;
  description?: string;
}

// 更新云账户请求参数
export interface UpdateCloudAccountReq {
  id: number;
  name?: string;
  access_key?: string;
  secret_key?: string;
  account_id?: string;
  account_name?: string;
  account_alias?: string;
  description?: string;
}

// 删除云账户请求参数
export interface DeleteCloudAccountReq {
  id: number;
}

// 更新云账户状态请求参数
export interface UpdateCloudAccountStatusReq {
  id: number;
  status: CloudAccountStatus;
}

// 验证云账户凭证请求参数
export interface VerifyCloudAccountReq {
  id: number;
}

// 获取云账户列表
export async function getCloudAccountListApi(params: GetCloudAccountListReq) {
  return requestClient.get('/tree/cloud/account/list', { params });
}

// 获取云账户详情
export async function getCloudAccountDetailApi(id: number) {
  return requestClient.get(`/tree/cloud/account/${id}/detail`);
}

// 创建云账户
export async function createCloudAccountApi(data: CreateCloudAccountReq) {
  return requestClient.post('/tree/cloud/account/create', data);
}

// 更新云账户
export async function updateCloudAccountApi(id: number, data: Omit<UpdateCloudAccountReq, 'id'>) {
  return requestClient.put(`/tree/cloud/account/${id}/update`, data);
}

// 删除云账户
export async function deleteCloudAccountApi(id: number) {
  return requestClient.delete(`/tree/cloud/account/${id}/delete`);
}

// 更新云账户状态
export async function updateCloudAccountStatusApi(id: number, status: CloudAccountStatus) {
  return requestClient.put(`/tree/cloud/account/${id}/status`, { status });
}

// 验证云账户凭证
export async function verifyCloudAccountApi(id: number) {
  return requestClient.post(`/tree/cloud/account/${id}/verify`);
}
