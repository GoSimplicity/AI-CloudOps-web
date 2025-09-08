// 服务配置响应接口
export interface ServiceConfigResponse {
  service: string;
  config: Record<string, any>;
  version?: string;
  timestamp: string;
}

// 服务就绪响应接口
export interface ServiceReadyResponse {
  ready: boolean;
  service: string;
  timestamp: string;
  message?: string;
  initialized?: boolean;
  healthy?: boolean;
  status?: string;
}

// 服务信息响应接口
export interface ServiceInfoResponse {
  service: string;
  version: string;
  description: string;
  capabilities: string[];
  endpoints: Record<string, string>;
  constraints?: Record<string, any>;
  status: string;
}
