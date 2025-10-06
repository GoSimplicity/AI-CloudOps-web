import { requestClient } from '#/api/request';

// 角色引用
export interface RoleRef {
  api_group: string;
  kind: string;
  name: string;
}

// 主体
export interface Subject {
  kind: string;
  name: string;
  namespace?: string;
  api_group?: string;
}

// K8s ClusterRoleBinding
export interface K8sClusterRoleBinding {
  name: string;
  cluster_id: number;
  uid: string;
  created_at: string;
  labels: Record<string, string> | null;
  annotations: Record<string, string> | null;
  role_ref: RoleRef;
  subjects: Subject[] | null;
  resource_version: string;
  age: string;
}

// 获取ClusterRoleBinding列表请求
export interface GetClusterRoleBindingListReq {
  cluster_id: number;
  search?: string;
  page?: number;
  size?: number;
}

// 获取ClusterRoleBinding详情请求
export interface GetClusterRoleBindingDetailsReq {
  cluster_id: number;
  name: string;
}

// 获取ClusterRoleBinding YAML请求
export interface GetClusterRoleBindingYamlReq {
  cluster_id: number;
  name: string;
}

// 创建ClusterRoleBinding请求
export interface CreateClusterRoleBindingReq {
  cluster_id: number;
  name: string;
  labels?: Record<string, string>;
  annotations?: Record<string, string>;
  role_ref: RoleRef;
  subjects: Subject[];
}

// 通过YAML创建ClusterRoleBinding请求
export interface CreateClusterRoleBindingByYamlReq {
  cluster_id: number;
  yaml_content: string;
}

// 更新ClusterRoleBinding请求
export interface UpdateClusterRoleBindingReq {
  cluster_id: number;
  name: string;
  labels?: Record<string, string>;
  annotations?: Record<string, string>;
  role_ref: RoleRef;
  subjects: Subject[];
}

// 通过YAML更新ClusterRoleBinding请求
export interface UpdateClusterRoleBindingByYamlReq {
  cluster_id: number;
  name: string;
  yaml_content: string;
}

// 删除ClusterRoleBinding请求
export interface DeleteClusterRoleBindingReq {
  cluster_id: number;
  name: string;
}

// 获取ClusterRoleBinding列表
export async function getClusterRoleBindingListApi(params: GetClusterRoleBindingListReq) {
  return requestClient.get(`/k8s/clusterrolebinding/${params.cluster_id}/list`, {
    params: {
      search: params.search,
      page: params.page,
      size: params.size,
    },
  });
}

// 获取ClusterRoleBinding详情
export async function getClusterRoleBindingDetailsApi(params: GetClusterRoleBindingDetailsReq) {
  return requestClient.get(`/k8s/clusterrolebinding/${params.cluster_id}/${params.name}/detail`);
}

// 获取ClusterRoleBinding YAML
export async function getClusterRoleBindingYamlApi(params: GetClusterRoleBindingYamlReq) {
  return requestClient.get(`/k8s/clusterrolebinding/${params.cluster_id}/${params.name}/detail/yaml`);
}

// 创建ClusterRoleBinding
export async function createClusterRoleBindingApi(params: CreateClusterRoleBindingReq) {
  return requestClient.post(`/k8s/clusterrolebinding/${params.cluster_id}/create`, params);
}

// 通过YAML创建ClusterRoleBinding
export async function createClusterRoleBindingByYamlApi(params: CreateClusterRoleBindingByYamlReq) {
  return requestClient.post(`/k8s/clusterrolebinding/${params.cluster_id}/create/yaml`, params);
}

// 更新ClusterRoleBinding
export async function updateClusterRoleBindingApi(params: UpdateClusterRoleBindingReq) {
  return requestClient.put(`/k8s/clusterrolebinding/${params.cluster_id}/${params.name}/update`, params);
}

// 通过YAML更新ClusterRoleBinding
export async function updateClusterRoleBindingYamlApi(params: UpdateClusterRoleBindingByYamlReq) {
  return requestClient.put(`/k8s/clusterrolebinding/${params.cluster_id}/${params.name}/update/yaml`, params);
}

// 删除ClusterRoleBinding
export async function deleteClusterRoleBindingApi(params: DeleteClusterRoleBindingReq) {
  return requestClient.delete(`/k8s/clusterrolebinding/${params.cluster_id}/${params.name}/delete`);
}
