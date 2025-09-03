import { requestClientAIOps } from '#/api/request';

// 智能助手请求模型
export interface AssistantRequest {
  question: string; // 用户提问
  mode?: number; // 助手模式：1=RAG模式，2=MCP模式，默认1
  chat_history?: Array<{ [key: string]: string }>; // 对话历史记录
  use_web_search?: boolean; // 是否使用网络搜索增强回答
  session_id?: string; // 会话ID，为空则创建新会话
}

// 添加文档请求模型
export interface AddDocumentRequest {
  title: string; // 文档标题
  content: string; // 文档内容
  file_name: string; // 文件名，必须包含文件扩展名
}

// 智能助手响应模型
export interface AssistantResponse {
  answer: string;
  source_documents?: Array<{ [key: string]: any }>;
  relevance_score?: number;
  recall_rate?: number; // 文档召回率
  follow_up_questions?: string[];
  session_id?: string;
}

// 会话信息响应模型
export interface SessionInfoResponse {
  session_id: string;
  created_time: string;
  last_activity: string;
  message_count: number;
  mode: number;
  status: string;
}

// 服务信息响应模型
export interface ServiceInfoResponse {
  service: string;
  version: string;
  description: string;
  capabilities: string[];
  endpoints: { [key: string]: string };
  constraints?: { [key: string]: any };
  status: string;
}

// 服务就绪响应模型
export interface ServiceReadyResponse {
  ready: boolean;
  service: string;
  timestamp: string;
  message?: string;
}

// 服务健康检查响应模型
export interface ServiceHealthResponse {
  status: string;
  service: string;
  version?: string;
  dependencies?: { [key: string]: boolean };
  last_check_time: string;
  uptime?: number;
}

// 服务配置响应模型
export interface ServiceConfigResponse {
  service: string;
  config: { [key: string]: any };
  version?: string;
  timestamp: string;
}

// 刷新知识库响应模型
export interface RefreshKnowledgeResponse {
  refreshed: boolean;
  documents_count: number;
  vector_count: number;
  timestamp: string;
  message: string;
}

// 清除缓存响应模型
export interface ClearCacheResponse {
  cleared: boolean;
  cache_keys_cleared: number;
  timestamp: string;
  message: string;
}

// 上传知识库响应模型
export interface UploadKnowledgeResponse {
  uploaded: boolean;
  document_id?: string;
  filename?: string;
  file_size?: number;
  message: string;
  timestamp: string;
}

// 添加文档响应模型
export interface AddDocumentResponse {
  added: boolean;
  document_id: string;
  message: string;
  timestamp: string;
}

// 智能助手问答
export async function assistantQuery(data: AssistantRequest) {
  return requestClientAIOps.post('/assistant/query', data);
}

// 获取会话信息
export async function getSessionInfo(session_id: string) {
  return requestClientAIOps.get(`/assistant/session/${session_id}`);
}

// 刷新知识库
export async function refreshKnowledgeBase() {
  return requestClientAIOps.post('/assistant/refresh');
}

// 健康检查
export async function assistantHealth() {
  return requestClientAIOps.get('/assistant/health');
}

// 服务就绪检查
export async function assistantReady() {
  return requestClientAIOps.get('/assistant/ready');
}

// 清除缓存
export async function clearAssistantCache() {
  return requestClientAIOps.post('/assistant/clear-cache');
}

// 上传知识库文件
export async function uploadKnowledgeFile(file: File) {
  const formData = new FormData();
  formData.append('file', file);
  return requestClientAIOps.post('/assistant/upload-knowledge-file', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
}

// 添加知识库文档
export async function addDocument(data: AddDocumentRequest) {
  return requestClientAIOps.post('/assistant/add-document', data);
}

// 获取智能助手配置
export async function getAssistantConfig() {
  return requestClientAIOps.get('/assistant/config');
}

// 获取服务信息
export async function getAssistantInfo() {
  return requestClientAIOps.get('/assistant/info');
}
