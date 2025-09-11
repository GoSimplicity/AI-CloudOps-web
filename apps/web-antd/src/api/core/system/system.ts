import { requestClient } from '#/api/request';

// 系统硬件信息接口
export interface System {
  id?: number;
  hostname: string; // 主机名
  os: string; // 操作系统
  os_version: string; // 操作系统版本
  arch: string; // 系统架构
  cpu_model: string; // CPU型号
  cpu_cores: number; // CPU核心数
  cpu_usage: number; // CPU使用率
  memory_total: number; // 总内存（MB）
  memory_used: number; // 已用内存（MB）
  memory_usage: number; // 内存使用率
  disk_total: number; // 总磁盘空间（GB）
  disk_used: number; // 已用磁盘空间（GB）
  disk_usage: number; // 磁盘使用率
  network_in: number; // 网络入流量（字节）
  network_out: number; // 网络出流量（字节）
  uptime: number; // 系统运行时长（秒）
  load_avg_1: number; // 1分钟平均负载
  load_avg_5: number; // 5分钟平均负载
  load_avg_15: number; // 15分钟平均负载
  process_count: number; // 进程数
  last_update_time: number; // 最后更新时间
  // 格式化字段
  memory_usage_formatted?: string; // 格式化的内存使用情况
  disk_usage_formatted?: string; // 格式化的磁盘使用情况
  uptime_formatted?: string; // 格式化的运行时长
  system_status?: string; // 系统状态
  created_at?: string;
  updated_at?: string;
  deleted_at?: number;
}

// 系统管理API
export async function getSystemInfoApi() {
  return requestClient.get<System>('/system/info');
}

export async function getSystemMetricsApi() {
  return requestClient.get<System>('/system/metrics');
}

export async function refreshSystemInfoApi() {
  return requestClient.post<System>('/system/refresh');
}

  // 角色管理相关接口
  export interface Role {
    id: number;
    name: string; // 角色名称
    code: string; // 角色编码
    description: string; // 角色描述
    status: 0 | 1; // 状态 0禁用 1启用
    is_system: 0 | 1; // 是否系统角色 0否 1是
    apis?: any[]; // 关联API
    users?: any[]; // 关联用户
    created_at?: string;
    updated_at?: string;
  }

  export interface ListRolesReq {
    page: number; // 页码
    size: number; // 每页数量
    search?: string; // 搜索关键词
    status?: 0 | 1; // 状态筛选
  }

  export interface CreateRoleReq {
    name: string; // 角色名称
    code: string; // 角色编码
    description?: string; // 角色描述
    status: 0 | 1; // 状态
    api_ids?: number[]; // 关联的API ID列表
  }

  export interface UpdateRoleReq {
    id: number; // 角色ID
    name: string; // 角色名称
    code: string; // 角色编码
    description?: string; // 角色描述
    status: 0 | 1; // 状态
    api_ids?: number[]; // 关联的API ID列表
  }

  export interface DeleteRoleReq {
    id: number; // 角色ID
  }

  export interface AssignRoleApiReq {
    role_id: number; // 角色ID
    api_ids: number[]; // API ID列表
  }

  export interface RevokeRoleApiReq {
    role_id: number; // 角色ID
    api_ids: number[]; // API ID列表
  }

  export interface AssignRolesToUserReq {
    user_id: number; // 用户ID
    role_ids: number[]; // 角色ID列表
  }

  export interface RevokeRolesFromUserReq {
    user_id: number; // 用户ID
    role_ids: number[]; // 角色ID列表
  }

  export interface CheckUserPermissionReq {
    user_id: number; // 用户ID
    method: string; // 请求方法
    path: string; // 请求路径
  }

// 角色管理
export async function listRolesApi(data: ListRolesReq) {
  return requestClient.get('/role/list', { params: data });
}

export async function createRoleApi(data: CreateRoleReq) {
  return requestClient.post('/role/create', data);
}

export async function updateRoleApi(data: UpdateRoleReq) {
  return requestClient.put(`/role/update/${data.id}`, data);
}

export async function deleteRoleApi(data: DeleteRoleReq) {
  return requestClient.delete(`/role/delete/${data.id}`);
}

export async function getRoleDetailApi(id: number) {
  return requestClient.get(`/role/detail/${id}`);
}

// 角色权限管理
export async function assignApisToRoleApi(data: AssignRoleApiReq) {
  return requestClient.post('/role/assign-apis', data);
}

export async function revokeApisFromRoleApi(data: RevokeRoleApiReq) {
  return requestClient.post('/role/revoke-apis', data);
}

export async function getRoleApisApi(id: number) {
  return requestClient.get(`/role/apis/${id}`);
}

// 用户角色管理
export async function assignRolesToUserApi(data: AssignRolesToUserReq) {
  return requestClient.post('/role/assign_users', data);
}

export async function revokeRolesFromUserApi(data: RevokeRolesFromUserReq) {
  return requestClient.post('/role/revoke_users', data);
}

export async function getRoleUsersApi(id: number) {
  return requestClient.get(`/role/users/${id}`);
}

export async function getUserRolesApi(id: number) {
  return requestClient.get(`/role/user_roles/${id}`);
}

// 权限检查
export async function checkUserPermissionApi(data: CheckUserPermissionReq) {
  return requestClient.post('/role/check_permission', data);
}

export async function getUserPermissionsApi(id: number) {
  return requestClient.get(`/role/user_permissions/${id}`);
}
