import { requestClient } from '#/api/request';

// RBAC相关接口和类型定义

// Role信息
export interface RoleInfo {
  name: string;
  namespace: string;
  cluster_id: number;
  uid: string;
  creation_timestamp: string;
  labels: Record<string, string>;
  annotations: Record<string, string>;
  rules: PolicyRule[];
  resource_version: string;
  age: string;
}

// ClusterRole信息
export interface ClusterRoleInfo {
  name: string;
  cluster_id: number;
  uid: string;
  creation_timestamp: string;
  labels: Record<string, string>;
  annotations: Record<string, string>;
  rules: PolicyRule[];
  resource_version: string;
  age: string;
}

// PolicyRule权限规则
export interface PolicyRule {
  api_groups: string[];
  resources: string[];
  verbs: string[];
  resource_names?: string[];
  non_resource_urls?: string[];
}

// RoleBinding信息
export interface RoleBindingInfo {
  name: string;
  namespace: string;
  cluster_id: number;
  uid: string;
  creation_timestamp: string;
  labels: Record<string, string>;
  annotations: Record<string, string>;
  role_ref: RoleRef;
  subjects: Subject[];
  resource_version: string;
  age: string;
}

// ClusterRoleBinding信息
export interface ClusterRoleBindingInfo {
  name: string;
  cluster_id: number;
  uid: string;
  creation_timestamp: string;
  labels: Record<string, string>;
  annotations: Record<string, string>;
  role_ref: RoleRef;
  subjects: Subject[];
  resource_version: string;
  age: string;
}

// 角色引用
export interface RoleRef {
  api_group: string;
  kind: string;
  name: string;
}

// 主体（用户、组或服务账户）
export interface Subject {
  kind: string;
  name: string;
  namespace?: string;
  api_group?: string;
}

// RBAC统计信息
export interface RBACStatistics {
  total_roles: number;
  total_cluster_roles: number;
  total_role_bindings: number;
  total_cluster_role_bindings: number;
  active_subjects: number;
  system_roles: number;
  custom_roles: number;
}

// Role列表请求参数
export interface RoleListReq {
  cluster_id: number;
  namespace?: string;
  keyword?: string;
  page?: number;
  page_size?: number;
}

// ClusterRole列表请求参数
export interface ClusterRoleListReq {
  cluster_id: number;
  keyword?: string;
  page?: number;
  page_size?: number;
}

// RoleBinding列表请求参数
export interface RoleBindingListReq {
  cluster_id: number;
  namespace?: string;
  keyword?: string;
  page?: number;
  page_size?: number;
}

// ClusterRoleBinding列表请求参数
export interface ClusterRoleBindingListReq {
  cluster_id: number;
  keyword?: string;
  page?: number;
  page_size?: number;
}

// 创建Role请求参数
export interface CreateRoleReq {
  cluster_id: number;
  name: string;
  namespace: string;
  labels?: Record<string, string>;
  annotations?: Record<string, string>;
  rules: PolicyRule[];
}

// 创建ClusterRole请求参数
export interface CreateClusterRoleReq {
  cluster_id: number;
  name: string;
  labels?: Record<string, string>;
  annotations?: Record<string, string>;
  rules: PolicyRule[];
}

// 创建RoleBinding请求参数
export interface CreateRoleBindingReq {
  cluster_id: number;
  name: string;
  namespace: string;
  labels?: Record<string, string>;
  annotations?: Record<string, string>;
  role_ref: RoleRef;
  subjects: Subject[];
}

// 创建ClusterRoleBinding请求参数
export interface CreateClusterRoleBindingReq {
  cluster_id: number;
  name: string;
  labels?: Record<string, string>;
  annotations?: Record<string, string>;
  role_ref: RoleRef;
  subjects: Subject[];
}

// 更新Role请求参数
export interface UpdateRoleReq extends CreateRoleReq {
  original_name?: string;
}

// 更新ClusterRole请求参数
export interface UpdateClusterRoleReq extends CreateClusterRoleReq {
  original_name?: string;
}

// 更新RoleBinding请求参数
export interface UpdateRoleBindingReq extends CreateRoleBindingReq {
  original_name?: string;
}

// 更新ClusterRoleBinding请求参数
export interface UpdateClusterRoleBindingReq extends CreateClusterRoleBindingReq {
  original_name?: string;
}

// Role相关API

// 获取Role列表
export async function getRoleListApi(params: RoleListReq) {
  return requestClient.get('/k8s/role/list', { params });
}

// 获取Role详情
export async function getRoleDetailsApi(cluster_id: number, namespace: string, name: string) {
  return requestClient.get(`/k8s/role/details/${cluster_id}/${namespace}/${name}`);
}

// 创建Role
export async function createRoleApi(data: CreateRoleReq) {
  return requestClient.post('/k8s/role/create', data);
}

// 更新Role
export async function updateRoleApi(data: UpdateRoleReq) {
  return requestClient.put('/k8s/role/update', data);
}

// 删除Role
export async function deleteRoleApi(cluster_id: number, namespace: string, name: string) {
  return requestClient.delete(`/k8s/role/delete/${cluster_id}/${namespace}/${name}`);
}

// 批量删除Role
export async function batchDeleteRoleApi(data: { cluster_id: number; roles: Array<{ namespace: string; name: string }> }) {
  return requestClient.post('/k8s/role/batch-delete', data);
}

// 获取Role YAML
export async function getRoleYamlApi(cluster_id: number, namespace: string, name: string) {
  return requestClient.get(`/k8s/role/yaml/${cluster_id}/${namespace}/${name}`);
}

// 更新Role YAML
export async function updateRoleYamlApi(data: { cluster_id: number; namespace: string; name: string; yaml_content: string }) {
  return requestClient.put('/k8s/role/yaml', data);
}

// ClusterRole相关API

// 获取ClusterRole列表
export async function getClusterRoleListApi(params: ClusterRoleListReq) {
  return requestClient.get('/k8s/cluster-role/list', { params });
}

// 获取ClusterRole详情
export async function getClusterRoleDetailsApi(cluster_id: number, name: string) {
  return requestClient.get(`/k8s/cluster-role/details/${cluster_id}/${name}`);
}

// 创建ClusterRole
export async function createClusterRoleApi(data: CreateClusterRoleReq) {
  return requestClient.post('/k8s/cluster-role/create', data);
}

// 更新ClusterRole
export async function updateClusterRoleApi(data: UpdateClusterRoleReq) {
  return requestClient.put('/k8s/cluster-role/update', data);
}

// 删除ClusterRole
export async function deleteClusterRoleApi(cluster_id: number, name: string) {
  return requestClient.delete(`/k8s/cluster-role/delete/${cluster_id}/${name}`);
}

// 批量删除ClusterRole
export async function batchDeleteClusterRoleApi(data: { cluster_id: number; names: string[] }) {
  return requestClient.post('/k8s/cluster-role/batch-delete', data);
}

// 获取ClusterRole YAML
export async function getClusterRoleYamlApi(cluster_id: number, name: string) {
  return requestClient.get(`/k8s/cluster-role/yaml/${cluster_id}/${name}`);
}

// 更新ClusterRole YAML
export async function updateClusterRoleYamlApi(data: { cluster_id: number; name: string; yaml_content: string }) {
  return requestClient.put('/k8s/cluster-role/yaml', data);
}

// RoleBinding相关API

// 获取RoleBinding列表
export async function getRoleBindingListApi(params: RoleBindingListReq) {
  return requestClient.get('/k8s/role-binding/list', { params });
}

// 获取RoleBinding详情
export async function getRoleBindingDetailsApi(cluster_id: number, namespace: string, name: string) {
  return requestClient.get(`/k8s/role-binding/details/${cluster_id}/${namespace}/${name}`);
}

// 创建RoleBinding
export async function createRoleBindingApi(data: CreateRoleBindingReq) {
  return requestClient.post('/k8s/role-binding/create', data);
}

// 更新RoleBinding
export async function updateRoleBindingApi(data: UpdateRoleBindingReq) {
  return requestClient.put('/k8s/role-binding/update', data);
}

// 删除RoleBinding
export async function deleteRoleBindingApi(cluster_id: number, namespace: string, name: string) {
  return requestClient.delete(`/k8s/role-binding/delete/${cluster_id}/${namespace}/${name}`);
}

// 批量删除RoleBinding
export async function batchDeleteRoleBindingApi(data: { cluster_id: number; bindings: Array<{ namespace: string; name: string }> }) {
  return requestClient.post('/k8s/role-binding/batch-delete', data);
}

// 获取RoleBinding YAML
export async function getRoleBindingYamlApi(cluster_id: number, namespace: string, name: string) {
  return requestClient.get(`/k8s/role-binding/yaml/${cluster_id}/${namespace}/${name}`);
}

// 更新RoleBinding YAML
export async function updateRoleBindingYamlApi(data: { cluster_id: number; namespace: string; name: string; yaml_content: string }) {
  return requestClient.put('/k8s/role-binding/yaml', data);
}

// ClusterRoleBinding相关API

// 获取ClusterRoleBinding列表
export async function getClusterRoleBindingListApi(params: ClusterRoleBindingListReq) {
  return requestClient.get('/k8s/cluster-role-binding/list', { params });
}

// 获取ClusterRoleBinding详情
export async function getClusterRoleBindingDetailsApi(cluster_id: number, name: string) {
  return requestClient.get(`/k8s/cluster-role-binding/details/${cluster_id}/${name}`);
}

// 创建ClusterRoleBinding
export async function createClusterRoleBindingApi(data: CreateClusterRoleBindingReq) {
  return requestClient.post('/k8s/cluster-role-binding/create', data);
}

// 更新ClusterRoleBinding
export async function updateClusterRoleBindingApi(data: UpdateClusterRoleBindingReq) {
  return requestClient.put('/k8s/cluster-role-binding/update', data);
}

// 删除ClusterRoleBinding
export async function deleteClusterRoleBindingApi(cluster_id: number, name: string) {
  return requestClient.delete(`/k8s/cluster-role-binding/delete/${cluster_id}/${name}`);
}

// 批量删除ClusterRoleBinding
export async function batchDeleteClusterRoleBindingApi(data: { cluster_id: number; names: string[] }) {
  return requestClient.post('/k8s/cluster-role-binding/batch-delete', data);
}

// 获取ClusterRoleBinding YAML
export async function getClusterRoleBindingYamlApi(cluster_id: number, name: string) {
  return requestClient.get(`/k8s/cluster-role-binding/yaml/${cluster_id}/${name}`);
}

// 更新ClusterRoleBinding YAML
export async function updateClusterRoleBindingYamlApi(data: { cluster_id: number; name: string; yaml_content: string }) {
  return requestClient.put('/k8s/cluster-role-binding/yaml', data);
}

// 统计和其他API

// 获取RBAC统计信息
export async function getRBACStatisticsApi(cluster_id: number) {
  return requestClient.get(`/k8s/rbac/statistics/${cluster_id}`);
}

// 获取所有权限验证信息
export async function checkPermissionsApi(data: { cluster_id: number; subject: Subject; resources: Array<{ namespace?: string; resource: string; verb: string }> }) {
  return requestClient.post('/k8s/rbac/check-permissions', data);
}

// 获取主体的有效权限列表
export async function getSubjectPermissionsApi(cluster_id: number, subject: Subject) {
  return requestClient.post(`/k8s/rbac/subject-permissions/${cluster_id}`, subject);
}

// 获取预定义的资源和动作列表
export async function getResourceVerbsApi() {
  return requestClient.get('/k8s/rbac/resource-verbs');
}
