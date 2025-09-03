import { requestClient } from '#/api/request';

// 节点状态枚举
export enum TreeNodeStatus {
  ACTIVE = 1,
  INACTIVE = 2,
}

// 节点成员类型枚举
export enum TreeNodeMemberType {
  AdminRole = 1,
  MemberRole = 2,
}

// 叶子节点标识常量
export const IsLeafYes = 1; // 是叶子节点
export const IsLeafNo = 2;  // 不是叶子节点

// 树节点接口
export interface TreeNode {
  id: number;
  name: string;
  parent_id: number;
  level: number;
  description: string;
  create_user_id: number;
  create_user_name: string;
  status: TreeNodeStatus;
  is_leaf: number;
  children?: TreeNode[];
  created_at?: string;
  updated_at?: string;
}

// 获取树节点列表请求参数
export interface GetTreeNodeListReq {
  level?: number;
  status?: TreeNodeStatus;
  search?: string;
}

// 获取节点详情请求参数
export interface GetTreeNodeDetailReq {
  id: number;
}

// 获取子节点列表请求参数
export interface GetTreeNodeChildNodesReq {
  id: number;
}

// 创建节点请求参数
export interface CreateTreeNodeReq {
  name: string;
  parent_id?: number;
  description?: string;
  is_leaf?: number;
  status?: TreeNodeStatus;
}

// 更新节点请求参数
export interface UpdateTreeNodeReq {
  id: number;
  name: string;
  parent_id?: number;
  description?: string;
  status?: TreeNodeStatus;
  is_leaf?: number;
}

// 更新节点状态请求参数
export interface UpdateTreeNodeStatusReq {
  id: number;
  status: TreeNodeStatus;
}

// 删除节点请求参数
export interface DeleteTreeNodeReq {
  id: number;
}

// 移动节点请求参数
export interface MoveTreeNodeReq {
  id: number;
  new_parent_id: number;
}

// 获取节点成员请求参数
export interface GetTreeNodeMembersReq {
  id: number;
  type?: TreeNodeMemberType;
}

// 添加节点成员请求参数
export interface AddTreeNodeMemberReq {
  node_id: number;
  user_id: number;
  member_type: TreeNodeMemberType;
}

// 移除节点成员请求参数
export interface RemoveTreeNodeMemberReq {
  node_id: number;
  user_id: number;
  member_type: TreeNodeMemberType;
}

// 绑定资源请求参数
export interface BindTreeNodeResourceReq {
  node_id: number;
  resource_ids: number[];
}

// 解绑资源请求参数
export interface UnbindTreeNodeResourceReq {
  node_id: number;
  resource_id: number;
}

// 检查节点权限请求参数
export interface CheckTreeNodePermissionReq {
  user_id: number;
  node_id: number;
  operation: string;
}

// 获取用户相关节点请求参数
export interface GetUserTreeNodesReq {
  user_id: number;
  role?: TreeNodeMemberType;
}

// 服务树统计响应
export interface TreeNodeStatisticsResp {
  total_nodes: number;
  total_resources: number;
  total_admins: number;
  total_members: number;
  active_nodes: number;
  inactive_nodes: number;
}

// 获取树节点列表
export async function getTreeList(params?: GetTreeNodeListReq) {
  return requestClient.get('/tree/node/list', { params });
}

// 获取节点详情
export async function getNodeDetail(id: number) {
  return requestClient.get(`/tree/node/detail/${id}`);
}

// 获取子节点列表
export async function getChildNodes(id: number) {
  return requestClient.get(`/tree/node/children/${id}`);
}

// 获取服务树统计信息
export async function getTreeStatistics() {
  return requestClient.get('/tree/node/statistics');
}

// 创建节点
export async function createNode(data: CreateTreeNodeReq) {
  return requestClient.post('/tree/node/create', data);
}

// 更新节点
export async function updateNode(id: number, data: UpdateTreeNodeReq) {
  return requestClient.put(`/tree/node/update/${id}`, data);
}

// 删除节点
export async function deleteNode(id: number) {
  return requestClient.delete(`/tree/node/delete/${id}`);
}

// 移动节点
export async function moveNode(id: number, data: MoveTreeNodeReq) {
  return requestClient.put(`/tree/node/move/${id}`, data);
}

// 获取节点成员
export async function getNodeMembers(id: number, type?: TreeNodeMemberType) {
  return requestClient.get(`/tree/node/members/${id}`, { params: { type } });
}

// 添加节点成员
export async function addNodeMember(data: AddTreeNodeMemberReq) {
  return requestClient.post('/tree/node/member/add', data);
}

// 移除节点成员
export async function removeNodeMember(id: number, data: RemoveTreeNodeMemberReq) {
  return requestClient.delete(`/tree/node/member/remove/${id}`, { data });
}

// 绑定资源
export async function bindResource(data: BindTreeNodeResourceReq) {
  return requestClient.post('/tree/node/resource/bind', data);
}

// 解绑资源
export async function unbindResource(data: UnbindTreeNodeResourceReq) {
  return requestClient.post('/tree/node/resource/unbind', data);
}
