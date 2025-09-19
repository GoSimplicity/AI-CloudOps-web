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
  ssh_resource_id: number;
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
  ssh_resource_id?: number;
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
  ssh_resource_id?: number;
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
  valid: boolean;
  error_message?: string;
  next_run_times?: string[];
}

// 执行日志状态枚举
export enum ExecutionLogStatus {
  PENDING = 1, // 等待中
  RUNNING = 2, // 运行中
  SUCCESS = 3, // 成功
  FAILED = 4, // 失败
  TIMEOUT = 5, // 超时
  CANCELLED = 6, // 已取消
}

// 触发类型枚举
export enum TriggerType {
  SCHEDULED = 1, // 定时触发
  MANUAL = 2, // 手动触发
  API = 3, // API触发
}

// 执行日志模型
export interface ExecutionLog {
  id: number;
  created_at: string;
  updated_at: string;
  job_id: number;
  job_name: string;
  status: ExecutionLogStatus;
  start_time: string;
  end_time?: string;
  duration: number;
  output?: string;
  error_message?: string;
  trigger_type: TriggerType;
  triggered_by?: string;
}

// 获取执行日志列表请求参数
export interface GetExecutionLogsReq {
  page?: number;
  size?: number;
  job_id?: number;
  status?: ExecutionLogStatus;
  trigger_type?: TriggerType;
  start_date?: string;
  end_date?: string;
  search?: string;
}

// 删除执行日志请求参数
export interface DeleteExecutionLogReq {
  id: number;
}

// 清空执行日志请求参数
export interface ClearExecutionLogsReq {
  job_id?: number;
  before_date?: string;
}

// 获取定时任务列表
export async function getCronJobList(params: GetCronJobListReq) {
  return requestClient.get<CronJob[]>('/cron/job/list', { params });
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

// 获取执行日志列表
export async function getExecutionLogs(params: GetExecutionLogsReq) {
  return requestClient.get<ExecutionLog[]>('/cron/execution-log/list', { params });
}

// 删除执行日志
export async function deleteExecutionLog(params: DeleteExecutionLogReq) {
  return requestClient.delete(`/cron/execution-log/${params.id}/delete`);
}

// 清空执行日志
export async function clearExecutionLogs(params: ClearExecutionLogsReq) {
  return requestClient.post('/cron/execution-log/clear', params);
}
