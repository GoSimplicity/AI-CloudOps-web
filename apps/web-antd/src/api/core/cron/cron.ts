import { requestClient } from '#/api/request';

// 定时任务状态枚举
export enum CronJobStatus {
  ENABLED = 1, // 启用
  DISABLED = 2, // 禁用
  RUNNING = 3, // 运行中
  ERROR = 4, // 错误
}

// 定时任务类型枚举
export enum CronJobType {
  SYSTEM = 1, // 系统任务
  COMMAND = 2, // 命令行任务
  HTTP = 3, // HTTP请求任务
  SCRIPT = 4, // 脚本任务
  SSH = 5, // SSH远程执行任务
}

// 资源状态枚举
export enum ResourceStatus {
  ENABLED = 1, // 启用
  DISABLED = 2, // 禁用
}

// 认证方式枚举
export enum AuthMode {
  PASSWORD = 1, // 密码认证
  KEY = 2, // 密钥认证
}

// 键值对类型
export interface KeyValue {
  key: string;
  value: string;
}

// 树节点接口
export interface TreeNode {
  id: number;
  name: string;
  // 其他字段根据需要添加
}

// 树资源接口
export interface TreeLocalResource {
  id: number;
  created_at: string;
  updated_at: string;
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
  create_user_id: number;
  create_user_name: string;
  key: string;
  auth_mode: AuthMode;
  os_type: string;
  os_name: string;
  image_name: string;
  tree_nodes?: TreeNode[];
}

// 定时任务模型
export interface CronJob {
  id: number;
  created_at: string;
  updated_at: string;
  name: string;
  description: string;
  job_type: CronJobType;
  status: CronJobStatus;
  is_built_in: number; // 是否为内置任务 1是 2否
  schedule: string;
  command: string;
  args: string[];
  work_dir: string;
  environment: KeyValue[];
  http_method: string;
  http_url: string;
  http_headers: KeyValue[];
  http_body: string;
  script_type: string;
  script_content: string;
  ssh_resource_id?: number; // 可空字段
  ssh_resource?: TreeLocalResource;
  ssh_command: string;
  ssh_work_dir: string;
  ssh_environment: KeyValue[];
  timeout: number;
  max_retry: number;
  next_run_time?: string;
  last_run_time?: string;
  last_run_status: number;
  last_run_duration: number;
  last_run_error: string;
  last_run_output: string;
  run_count: number;
  success_count: number;
  failure_count: number;
  created_by: number;
  created_by_name: string;
}

// 获取定时任务列表请求参数
export interface GetCronJobListReq {
  page?: number;
  size?: number;
  status?: CronJobStatus;
  job_type?: CronJobType;
  search?: string;
}

// 创建定时任务请求参数
export interface CreateCronJobReq {
  name: string;
  description?: string;
  job_type: CronJobType;
  schedule: string;
  command?: string;
  args?: string[];
  work_dir?: string;
  environment?: KeyValue[];
  http_method?: string;
  http_url?: string;
  http_headers?: KeyValue[];
  http_body?: string;
  script_type?: string;
  script_content?: string;
  ssh_resource_id?: number | null; // 可空字段
  ssh_command?: string;
  ssh_work_dir?: string;
  ssh_environment?: KeyValue[];
  timeout?: number;
  max_retry?: number;
  created_by?: number;
  created_by_name?: string;
}

// 更新定时任务请求参数
export interface UpdateCronJobReq {
  id: number;
  name: string;
  description?: string;
  job_type: CronJobType;
  schedule: string;
  command?: string;
  args?: string[];
  work_dir?: string;
  environment?: KeyValue[];
  http_method?: string;
  http_url?: string;
  http_headers?: KeyValue[];
  http_body?: string;
  script_type?: string;
  script_content?: string;
  ssh_resource_id?: number | null; // 可空字段
  ssh_command?: string;
  ssh_work_dir?: string;
  ssh_environment?: KeyValue[];
  timeout?: number;
  max_retry?: number;
}

// 删除定时任务请求参数
export interface DeleteCronJobReq {
  id: number;
}

// 获取定时任务详情请求参数
export interface GetCronJobReq {
  id: number;
}

// 启用定时任务请求参数
export interface EnableCronJobReq {
  id: number;
}

// 触发定时任务请求参数
export interface TriggerCronJobReq {
  id: number;
}

// 验证调度表达式请求参数
export interface ValidateScheduleReq {
  schedule: string;
}

// 禁用定时任务请求参数
export interface DisableCronJobReq {
  id: number;
}

// 验证调度表达式响应
export interface ValidateScheduleResp {
  valid: number; // 是否有效 1有效 0无效
  error_message?: string;
  next_run_times?: string[];
}



// 获取定时任务列表
export async function getCronJobList(params: GetCronJobListReq) {
  return requestClient.get('/cron/job/list', { params });
}

// 获取定时任务详情
export async function getCronJobDetail(params: GetCronJobReq) {
  return requestClient.get<CronJob>(`/cron/job/${params.id}/detail`);
}

// 创建定时任务
export async function createCronJob(params: CreateCronJobReq) {
  return requestClient.post('/cron/job/create', params);
}

// 更新定时任务
export async function updateCronJob(params: UpdateCronJobReq) {
  return requestClient.put(`/cron/job/${params.id}/update`, params);
}

// 删除定时任务
export async function deleteCronJob(params: DeleteCronJobReq) {
  return requestClient.delete(`/cron/job/${params.id}/delete`);
}

// 启用定时任务
export async function enableCronJob(params: EnableCronJobReq) {
  return requestClient.post(`/cron/job/${params.id}/enable`);
}

// 禁用定时任务
export async function disableCronJob(params: DisableCronJobReq) {
  return requestClient.post(`/cron/job/${params.id}/disable`);
}

// 触发定时任务
export async function triggerCronJob(params: TriggerCronJobReq) {
  return requestClient.post(`/cron/job/${params.id}/trigger`);
}

// 验证调度表达式
export async function validateSchedule(params: ValidateScheduleReq) {
  return requestClient.post<ValidateScheduleResp>(
    '/cron/validate-schedule',
    params,
  );
}

