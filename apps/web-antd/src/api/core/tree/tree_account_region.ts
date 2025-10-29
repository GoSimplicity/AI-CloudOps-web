import { requestClient } from '#/api/request';

// 云账号区域状态
export enum CloudAccountRegionStatus {
  ENABLED = 1,  // 启用
  DISABLED = 2, // 禁用
}

// 云厂商类型
export enum CloudProvider {
  ALIYUN = 1,   // 阿里云
  TENCENT = 2,  // 腾讯云
  AWS = 3,      // AWS
  HUAWEI = 4,   // 华为云
  AZURE = 5,    // Azure
  GCP = 6,      // Google Cloud
}

// 云账号区域关联
export interface CloudAccountRegion {
  id: number;
  cloud_account_id: number;
  cloud_account?: any; // CloudAccount类型，根据需要定义
  region: string;
  region_name: string;
  status: CloudAccountRegionStatus;
  is_default: boolean;
  description: string;
  last_sync_time?: string;
  create_user_id: number;
  create_user_name: string;
  created_at: string;
  updated_at: string;
}

// 获取云账号区域列表请求参数
export interface GetCloudAccountRegionListReq {
  page?: number;
  size?: number;
  search?: string;
  cloud_account_id?: number;
  region?: string;
  status?: CloudAccountRegionStatus;
}

// 创建云账号区域关联请求参数
export interface CreateCloudAccountRegionReq {
  cloud_account_id: number;
  region: string;
  region_name?: string;
  is_default?: boolean;
  description?: string;
}

// 更新云账号区域关联请求参数
export interface UpdateCloudAccountRegionReq {
  id: number;
  region_name?: string;
  is_default?: boolean;
  description?: string;
}

// 删除云账号区域关联请求参数
export interface DeleteCloudAccountRegionReq {
  id: number;
}

// 更新云账号区域状态请求参数
export interface UpdateCloudAccountRegionStatusReq {
  id: number;
  status: CloudAccountRegionStatus;
}

// 批量创建云账号区域关联请求参数
export interface BatchCreateCloudAccountRegionReq {
  cloud_account_id: number;
  regions: CreateCloudAccountRegionItem[];
}

// 创建云账号区域项
export interface CreateCloudAccountRegionItem {
  region: string;
  region_name?: string;
  is_default?: boolean;
  description?: string;
}

// 获取可用区域列表请求参数
export interface GetAvailableRegionsReq {
  provider: CloudProvider;
  access_key?: string;
  secret_key?: string;
}

// 可用区域信息
export interface AvailableRegion {
  region: string;
  region_name: string;
  available: boolean;
}

// 获取可用区域列表响应
export interface GetAvailableRegionsResp {
  regions: AvailableRegion[];
}

// 获取云账号区域列表
export async function getCloudAccountRegionList(params: GetCloudAccountRegionListReq) {
  return requestClient.get('/tree/cloud/account/region/list', { params });
}

// 获取云账号区域详情
export async function getCloudAccountRegionDetail(id: number) {
  return requestClient.get(`/tree/cloud/account/region/${id}/detail`);
}

// 创建云账号区域关联
export async function createCloudAccountRegion(data: CreateCloudAccountRegionReq) {
  return requestClient.post('/tree/cloud/account/region/create', data);
}

// 批量创建云账号区域关联
export async function batchCreateCloudAccountRegion(data: BatchCreateCloudAccountRegionReq) {
  return requestClient.post('/tree/cloud/account/region/batch-create', data);
}

// 更新云账号区域关联
export async function updateCloudAccountRegion(id: number, data: Omit<UpdateCloudAccountRegionReq, 'id'>) {
  return requestClient.put(`/tree/cloud/account/region/${id}/update`, data);
}

// 删除云账号区域关联
export async function deleteCloudAccountRegion(id: number) {
  return requestClient.delete(`/tree/cloud/account/region/${id}/delete`);
}

// 更新云账号区域状态
export async function updateCloudAccountRegionStatus(id: number, status: CloudAccountRegionStatus) {
  return requestClient.put(`/tree/cloud/account/region/${id}/status`, { status });
}

// 获取可用区域列表
export async function getAvailableRegions(params: GetAvailableRegionsReq) {
  return requestClient.get('/tree/cloud/account/region/available-regions', { params });
}
