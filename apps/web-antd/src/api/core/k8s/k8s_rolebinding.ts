import { requestClient } from '#/api/request';

// 获取RoleBinding列表请求参数
export interface GetRoleBindingListReq {
  cluster_id: number;
  namespace?: string;
  search?: string;
  page?: number;
  size?: number;
}

// 获取RoleBinding详情请求参数
export interface GetRoleBindingDetailsReq {
  cluster_id: number;
  namespace: string;
  name: string;
}

// 获取RoleBinding YAML请求参数
export interface GetRoleBindingYamlReq {
  cluster_id: number;
  namespace: string;
  name: string;
}

// RoleRef 角色引用
export interface RoleRef {
  kind: string;
  name: string;
  api_group: string;
}

// Subject 主体
export interface Subject {
  kind: string;
  name: string;
  namespace?: string;
  api_group?: string;
}

// 创建RoleBinding请求参数
export interface CreateRoleBindingReq {
  cluster_id: number;
  namespace: string;
  name: string;
  labels?: Record<string, string>;
  annotations?: Record<string, string>;
  role_ref: RoleRef;
  subjects: Subject[];
}

// 通过YAML创建RoleBinding请求参数
export interface CreateRoleBindingByYamlReq {
  cluster_id: number;
  yaml_content: string;
}

// 更新RoleBinding请求参数
export interface UpdateRoleBindingReq {
  cluster_id: number;
  namespace: string;
  name: string;
  labels?: Record<string, string>;
  annotations?: Record<string, string>;
  role_ref: RoleRef;
  subjects: Subject[];
}

// 通过YAML更新RoleBinding请求参数
export interface UpdateRoleBindingByYamlReq {
  cluster_id: number;
  namespace: string;
  name: string;
  yaml_content: string;
}

// 删除RoleBinding请求参数
export interface DeleteRoleBindingReq {
  cluster_id: number;
  namespace: string;
  name: string;
}

// K8sRoleBinding RoleBinding响应数据
export interface K8sRoleBinding {
  name: string;
  namespace: string;
  cluster_id: number;
  uid: string;
  created_at: string;
  labels?: Record<string, string>;
  annotations?: Record<string, string>;
  role_ref: RoleRef;
  subjects: Subject[] | null;
  resource_version: string;
  age: string;
}

// 获取RoleBinding列表
export const getRoleBindingListApi = (params: GetRoleBindingListReq) => {
  return requestClient.get(`/k8s/rolebinding/${params.cluster_id}/list`, {
    params: {
      namespace: params.namespace,
      search: params.search,
      page: params.page,
      size: params.size,
    },
  });
};

// 获取RoleBinding详情
export const getRoleBindingDetailsApi = (params: GetRoleBindingDetailsReq) => {
  return requestClient.get(`/k8s/rolebinding/${params.cluster_id}/${params.namespace}/${params.name}/detail`);
};

// 获取RoleBinding YAML
export const getRoleBindingYamlApi = (params: GetRoleBindingYamlReq) => {
  return requestClient.get(`/k8s/rolebinding/${params.cluster_id}/${params.namespace}/${params.name}/detail/yaml`);
};

// 创建RoleBinding
export const createRoleBindingApi = (data: CreateRoleBindingReq) => {
  return requestClient.post(`/k8s/rolebinding/${data.cluster_id}/create`, data);
};

// 通过YAML创建RoleBinding
export const createRoleBindingByYamlApi = (data: CreateRoleBindingByYamlReq) => {
  return requestClient.post(`/k8s/rolebinding/${data.cluster_id}/create/yaml`, data);
};

// 更新RoleBinding
export const updateRoleBindingApi = (data: UpdateRoleBindingReq) => {
  return requestClient.put(`/k8s/rolebinding/${data.cluster_id}/${data.namespace}/${data.name}/update`, data);
};

// 通过YAML更新RoleBinding
export const updateRoleBindingByYamlApi = (data: UpdateRoleBindingByYamlReq) => {
  return requestClient.put(`/k8s/rolebinding/${data.cluster_id}/${data.namespace}/${data.name}/update/yaml`, data);
};

// 删除RoleBinding
export const deleteRoleBindingApi = (params: DeleteRoleBindingReq) => {
  return requestClient.delete(`/k8s/rolebinding/${params.cluster_id}/${params.namespace}/${params.name}/delete`);
};
