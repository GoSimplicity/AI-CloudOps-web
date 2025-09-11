import { requestClient } from '#/api/request';

// 分类状态常量
export const CategoryStatus = {
  Enabled: 1, // 启用
  Disabled: 2, // 禁用
} as const;

// 工单分类实体
export interface WorkorderCategoryItem {
  id?: number; // 分类ID
  created_at: string; // 创建时间
  updated_at: string; // 更新时间
  name: string; // 分类名称
  status: number; // 状态：1-启用，2-禁用
  description?: string; // 分类描述
  operator_id: number; // 操作人ID
  operator_name: string; // 操作人名称
}

// 创建工单分类请求
export interface CreateWorkorderCategoryReq {
  name: string; // 分类名称
  status: number; // 状态
  description?: string; // 分类描述
}

// 更新工单分类请求
export interface UpdateWorkorderCategoryReq {
  id: number; // 分类ID
  name: string; // 分类名称
  description?: string; // 分类描述
  status: number; // 状态
}

// 删除工单分类请求
export interface DeleteWorkorderCategoryReq {
  id: number; // 分类ID
}

// 获取工单分类详情请求
export interface DetailWorkorderCategoryReq {
  id: number; // 分类ID
}

// 工单分类列表请求
export interface ListWorkorderCategoryReq {
  page: number; // 页码
  size: number; // 每页大小
  search?: string; // 搜索关键词
  status?: number; // 状态
}

export async function createWorkorderCategory(
  data: CreateWorkorderCategoryReq,
) {
  return requestClient.post('/workorder/category/create', data);
}

export async function updateWorkorderCategory(
  data: UpdateWorkorderCategoryReq,
) {
  return requestClient.put(`/workorder/category/update/${data.id}`, data);
}

export async function deleteWorkorderCategory(
  data: DeleteWorkorderCategoryReq,
) {
  return requestClient.delete(`/workorder/category/delete/${data.id}`);
}

export async function listWorkorderCategory(params: ListWorkorderCategoryReq) {
  return requestClient.get('/workorder/category/list', { params });
}

export async function detailWorkorderCategory(
  data: DetailWorkorderCategoryReq,
) {
  return requestClient.get(`/workorder/category/detail/${data.id}`);
}
