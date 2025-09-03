import { requestClient } from '#/api/request';
import type { WorkorderProcessItem } from '../workorder_process';
import type { WorkorderFormDesignItem } from './workorder_form_design';
import type { WorkorderCategoryItem } from './workorder_category';

export const TemplateStatus = {
  Enabled: 1, // 启用
  Disabled: 2, // 禁用
} as const;

export const TemplateVisibility = {
  Private: 'private', // 私有
  Public: 'public', // 公开
  Shared: 'shared', // 共享
} as const;

export interface WorkorderTemplateItem {
  id: number; // 模板ID
  created_at: string; // 创建时间
  updated_at: string; // 更新时间
  name: string; // 模板名称
  description?: string; // 模板描述
  process_id: number; // 关联的流程ID
  form_design_id: number; // 关联的表单设计ID
  default_values?: Record<string, any>; // 默认值JSON
  status: number; // 状态：1-启用，2-禁用
  category_id?: number; // 分类ID
  operator_id: number; // 操作人ID
  operator_name: string; // 操作人名称
  tags?: string[]; // 标签
  process?: WorkorderProcessItem; // 流程
  form_design?: WorkorderFormDesignItem; // 表单设计
  category?: WorkorderCategoryItem; // 分类
}

export interface CreateWorkorderTemplateReq {
  name: string; // 模板名称
  description?: string; // 模板描述
  process_id: number; // 关联的流程ID
  form_design_id: number; // 关联的表单设计ID
  default_values?: Record<string, any>; // 默认值JSON
  status: number; // 状态：1-启用，2-禁用
  category_id?: number; // 分类ID
  tags?: string[]; // 标签
}

export interface UpdateWorkorderTemplateReq {
  id: number; // 模板ID
  name: string; // 模板名称
  description?: string; // 模板描述
  process_id: number; // 关联的流程ID
  form_design_id: number; // 关联的表单设计ID
  default_values?: Record<string, any>; // 默认值JSON
  status?: number; // 状态：1-启用，2-禁用
  category_id?: number; // 分类ID
  tags?: string[]; // 标签
}

export interface DeleteWorkorderTemplateReq {
  id: number; // 模板ID
}

export interface DetailWorkorderTemplateReq {
  id: number; // 模板ID
}

export interface ListWorkorderTemplateReq {
  page: number; // 页码
  size: number; // 每页大小
  search?: string; // 搜索关键词
  category_id?: number; // 分类ID
  process_id?: number; // 关联的流程ID
  form_design_id?: number; // 关联的表单设计ID
  status?: number; // 状态：1-启用，2-禁用
}

export async function createWorkorderTemplate(
  data: CreateWorkorderTemplateReq,
) {
  return requestClient.post('/workorder/template/create', data);
}

export async function updateWorkorderTemplate(
  data: UpdateWorkorderTemplateReq,
) {
  return requestClient.put(`/workorder/template/update/${data.id}`, data);
}

export async function deleteWorkorderTemplate(
  data: DeleteWorkorderTemplateReq,
) {
  return requestClient.delete(`/workorder/template/delete/${data.id}`);
}

export async function listWorkorderTemplate(
  params: ListWorkorderTemplateReq,
) {
  return requestClient.get('/workorder/template/list', { params });
}

export async function detailWorkorderTemplate(
  data: DetailWorkorderTemplateReq,
) {
  return requestClient.get(`/workorder/template/detail/${data.id}`);
}
