import { requestClient } from '#/api/request';

// 策略规则 - 对应API返回格式
export interface PolicyRule {
  verbs: string[];
  apiGroups?: string[];
  resources?: string[];
  resourceNames?: string[];
  nonResourceURLs?: string[];
}

// 策略规则 - 对应后端接口参数格式
export interface PolicyRuleParam {
  verbs: string[];
  api_groups?: string[];
  resources?: string[];
  resource_names?: string[];
  non_resource_urls?: string[];
}

// K8s Role
export interface K8sRole {
  name: string;
  namespace: string;
  cluster_id: number;
  uid: string;
  creation_timestamp: string;
  labels: Record<string, string>;
  annotations: Record<string, string>;
  rules: PolicyRule[] | null;
  resource_version: string;
  age: string;
}

// 获取Role列表请求
export interface GetRoleListReq {
  cluster_id: number;
  namespace?: string;
  search?: string;
  page?: number;
  size?: number;
}

// 获取Role详情请求
export interface GetRoleDetailsReq {
  cluster_id: number;
  namespace: string;
  name: string;
}

// 获取Role YAML请求
export interface GetRoleYamlReq {
  cluster_id: number;
  namespace: string;
  name: string;
}

// 创建Role请求
export interface CreateRoleReq {
  cluster_id: number;
  namespace: string;
  name: string;
  labels?: Record<string, string>;
  annotations?: Record<string, string>;
  rules: PolicyRuleParam[];
}

// 通过YAML创建Role请求
export interface CreateRoleByYamlReq {
  cluster_id: number;
  yaml_content: string;
}

// 更新Role请求
export interface UpdateRoleReq {
  cluster_id: number;
  namespace: string;
  name: string;
  labels?: Record<string, string>;
  annotations?: Record<string, string>;
  rules: PolicyRuleParam[];
}

// 通过YAML更新Role请求
export interface UpdateRoleByYamlReq {
  cluster_id: number;
  namespace: string;
  name: string;
  yaml_content: string;
}

// 删除Role请求
export interface DeleteRoleReq {
  cluster_id: number;
  namespace: string;
  name: string;
}

// 获取Role列表
export async function getRoleListApi(params: GetRoleListReq) {
  return requestClient.get(`/k8s/role/${params.cluster_id}/list`, {
    params: {
      namespace: params.namespace,
      search: params.search,
      page: params.page,
      size: params.size,
    },
  });
}

// 获取Role详情
export async function getRoleDetailsApi(params: GetRoleDetailsReq) {
  return requestClient.get(`/k8s/role/${params.cluster_id}/${params.namespace}/${params.name}/detail`);
}

// 获取Role YAML
export async function getRoleYamlApi(params: GetRoleYamlReq) {
  return requestClient.get(`/k8s/role/${params.cluster_id}/${params.namespace}/${params.name}/detail/yaml`);
}

// 创建Role
export async function createRoleApi(params: CreateRoleReq) {
  return requestClient.post(`/k8s/role/${params.cluster_id}/create`, params);
}

// 通过YAML创建Role
export async function createRoleByYamlApi(params: CreateRoleByYamlReq) {
  return requestClient.post(`/k8s/role/${params.cluster_id}/create/yaml`, params);
}

// 更新Role
export async function updateRoleApi(params: UpdateRoleReq) {
  return requestClient.put(`/k8s/role/${params.cluster_id}/${params.namespace}/${params.name}/update`, params);
}

// 通过YAML更新Role
export async function updateRoleYamlApi(params: UpdateRoleByYamlReq) {
  return requestClient.put(`/k8s/role/${params.cluster_id}/${params.namespace}/${params.name}/update/yaml`, params);
}

// 删除Role
export async function deleteRoleApi(params: DeleteRoleReq) {
  return requestClient.delete(`/k8s/role/${params.cluster_id}/${params.namespace}/${params.name}/delete`);
}
