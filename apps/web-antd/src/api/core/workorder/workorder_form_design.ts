import { requestClient } from '#/api/request';
import type { WorkorderCategoryItem } from './workorder_category';

export const FormDesignStatus = {
  Draft: 1,
  Published: 2,
  Archived: 3,
} as const;

export const FormFieldType = {
  Text: 'text',
  Number: 'number',
  Password: 'password',
  Textarea: 'textarea',
  Select: 'select',
  Radio: 'radio',
  Checkbox: 'checkbox',
  Date: 'date',
  Switch: 'switch',
} as const;

export interface FormField {
  name: string; // 字段名称
  type: string; // 字段类型
  label: string; // 字段标签
  required?: number; // 是否必填
  placeholder?: string; // 占位符
  default?: any; // 默认值
  options?: string[]; // 选项（如下拉、单选等）
}

export interface FormSchema {
  fields: FormField[]; // 字段列表
}

export interface WorkorderFormDesignItem {
  id: number;
  created_at: string;
  updated_at: string;
  name: string;
  description: string;
  schema: FormSchema;
  status: number;
  category_id?: number;
  operator_id?: number;
  operator_name?: string;
  tags?: string[];
  is_template: number;
  category?: WorkorderCategoryItem;
}

export interface CreateWorkorderFormDesignReq {
  name: string; // 表单名称
  description?: string; // 表单描述
  schema: FormSchema; // 表单结构
  status: number; // 状态：1-草稿，2-已发布，3-已归档
  category_id?: number; // 分类ID
  tags?: string[]; // 标签
  is_template: number; // 是否为模板：1-是，2-否
}

export interface UpdateWorkorderFormDesignReq {
  id: number; // 表单ID
  name: string; // 表单名称
  description?: string; // 表单描述
  schema: FormSchema; // 表单结构
  status: number; // 状态：1-草稿，2-已发布，3-已归档
  category_id?: number; // 分类ID
  tags?: string[]; // 标签
  is_template: number; // 是否为模板：1-是，2-否
}

export interface DeleteWorkorderFormDesignReq {
  id: number; // 表单ID
}

export interface DetailWorkorderFormDesignReq {
  id: number; // 表单ID
}

export interface ListWorkorderFormDesignReq {
  page: number; // 页码
  size: number; // 每页大小
  search?: string; // 搜索关键词
  category_id?: number; // 分类ID
  status?: number; // 状态
  is_template?: number; // 是否为模板
}

export async function createWorkorderFormDesign(
  data: CreateWorkorderFormDesignReq,
) {
  return requestClient.post('/workorder/form-design/create', data);
}

export async function updateWorkorderFormDesign(
  data: UpdateWorkorderFormDesignReq,
) {
  return requestClient.put(`/workorder/form-design/update/${data.id}`, data);
}

export async function deleteWorkorderFormDesign(
  data: DeleteWorkorderFormDesignReq,
) {
  return requestClient.delete(`/workorder/form-design/delete/${data.id}`);
}

export async function listWorkorderFormDesign(
  params: ListWorkorderFormDesignReq,
) {
  return requestClient.get('/workorder/form-design/list', { params });
}

export async function detailWorkorderFormDesign(
  data: DetailWorkorderFormDesignReq,
) {
  return requestClient.get(`/workorder/form-design/detail/${data.id}`);
}
