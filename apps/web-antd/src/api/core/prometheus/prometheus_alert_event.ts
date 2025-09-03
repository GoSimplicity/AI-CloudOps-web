import { requestClient } from '#/api/request';

// 告警事件状态枚举
export enum MonitorAlertEventStatus {
  FIRING = 1,    // 告警触发
  SILENCED = 2,  // 告警静默
  CLAIMED = 3,   // 告警认领
  RESOLVED = 4,  // 告警恢复
  UPGRADED = 5,  // 告警升级
}

// 告警事件模型
export interface MonitorAlertEvent {
  id?: number;
  alert_name: string;
  fingerprint: string;
  status: MonitorAlertEventStatus;
  rule_id: number;
  send_group_id: number;
  event_times: number;
  silence_id?: string;
  ren_ling_user_id?: number;
  labels: string[];
  send_group?: any;
  ren_ling_user?: any;
  labels_map?: Record<string, string>;
  created_at?: string;
  updated_at?: string;
}

// 获取告警事件列表请求参数
export interface GetMonitorAlertEventListReq {
  page?: number;
  size?: number;
  search?: string;
  status?: string;
  severity?: string;
}

// 告警静默请求参数
export interface EventAlertSilenceReq {
  id: number;
  user_id: number;
  use_name?: number; // 1或2，是否启用名称静默
  time: string;
}

// 告警认领请求参数
export interface EventAlertClaimReq {
  id: number;
  user_id: number;
}

// 告警取消静默请求参数
export interface EventAlertUnSilenceReq {
  id: number;
  user_id: number;
}

// 获取告警事件列表
export async function getMonitorAlertEventListApi(data: GetMonitorAlertEventListReq) {
  return requestClient.get(`/monitor/alert_events/list`, { params: data });
}

// 告警事件静默
export async function eventAlertSilenceApi(data: EventAlertSilenceReq) {
  return requestClient.post(`/monitor/alert_events/silence/${data.id}`, {
    use_name: data.use_name,
    time: data.time,
  });
}

  // 认领告警事件
export async function eventAlertClaimApi(data: EventAlertClaimReq) {
  return requestClient.post(`/monitor/alert_events/claim/${data.id}`);
}

// 取消告警事件静默
export async function eventAlertUnSilenceApi(data: EventAlertUnSilenceReq) {
  return requestClient.post(`/monitor/alert_events/unsilence/${data.id}`);
}
