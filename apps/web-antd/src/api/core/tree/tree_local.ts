import { requestClient } from '#/api/request';

export enum AuthMode {
  PASSWORD = 1,
  KEY = 2,
}

export enum ResourceStatus {
  RUNNING = 1,
  STOPPED = 2,
  STARTING = 3,
  STOPPING = 4,
  RESTARTING = 5,
  DELETING = 6,
  ERROR = 7,
}

export interface TreeNode {
  id: number;
  name: string;
  parent_id: number;
  level: number;
  description: string;
  create_user_id: number;
  create_user_name: string;
  status: number;
  is_leaf: number;
  created_at: string;
  updated_at: string;
}

export interface TreeLocalResource {
  id: number;
  name: string;
  status: ResourceStatus;
  environment: string;
  description: string;
  tags: string[];
  cpu: number;
  memory: number;
  disk: number;
  ip_addr: string;
  port: number;
  username: string;
  key: string;
  auth_mode: AuthMode;
  os_type: string;
  os_name: string;
  image_name: string;
  tree_nodes: TreeNode[];
  created_at: string;
  updated_at: string;
}

export interface GetTreeLocalResourceListReq {
  page?: number;
  size?: number;
  status?: ResourceStatus;
}

export interface GetTreeLocalResourceDetailReq {
  id: number;
}

export interface CreateTreeLocalResourceReq {
  name: string;
  environment?: string;
  description?: string;
  tags?: string[];
  ip_addr: string;
  port?: number;
  username?: string;
  password?: string;
  os_type?: string;
  os_name?: string;
  image_name?: string;
  key?: string;
  auth_mode?: AuthMode;
}

export interface UpdateTreeLocalResourceReq {
  id: number;
  name?: string;
  environment?: string;
  description?: string;
  tags?: string[];
  ip_addr?: string;
  port?: number;
  os_type?: string;
  os_name?: string;
  image_name?: string;
  username?: string;
  password?: string;
  key?: string;
  auth_mode?: AuthMode;
}

export interface DeleteTreeLocalResourceReq {
  id: number;
}

export interface ConnectTerminalResourceReq {
  id: number;
  user_id?: number;
}

export interface BindTreeLocalResourceReq {
  id: number;
  tree_node_ids: number[];
}

export interface UnBindTreeLocalResourceReq {
  id: number;
  tree_node_ids: number[];
}

export async function getTreeLocalList(params: GetTreeLocalResourceListReq) {
  return requestClient.get('/tree/local/list', { params });
}

export async function getTreeLocalDetail(id: number) {
  return requestClient.get(`/tree/local/detail/${id}`);
}

export async function createTreeLocal(data: CreateTreeLocalResourceReq) {
  return requestClient.post('/tree/local/create', data);
}

export async function updateTreeLocal(id: number, data: UpdateTreeLocalResourceReq) {
  return requestClient.put(`/tree/local/update/${id}`, data);
}

export async function deleteTreeLocal(id: number) {
  return requestClient.delete(`/tree/local/delete/${id}`);
}

export async function connectTerminal(id: number, token: string) {
  return requestClient.get(`/tree/local/terminal/${id}?token=${token}`);
}

export async function bindTreeLocal(id: number, data: BindTreeLocalResourceReq) {
  return requestClient.post(`/tree/local/bind/${id}`, data);
}

export async function unbindTreeLocal(id: number, data: UnBindTreeLocalResourceReq) {
  return requestClient.post(`/tree/local/unbind/${id}`, data);
}
