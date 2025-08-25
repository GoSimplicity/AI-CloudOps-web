import { requestClientAIOps } from '../request';
import type { ServiceConfigResponse, ServiceInfoResponse, ServiceReadyResponse } from './common';

/**
 * 严重程度级别枚举
 */
export enum SeverityLevel {
  CRITICAL = 'critical',
  HIGH = 'high',
  MEDIUM = 'medium',
  LOW = 'low',
}

/**
 * 数据源类型枚举
 */
export enum DataSourceType {
  METRICS = 'metrics',
  EVENTS = 'events',
  LOGS = 'logs',
}

/**
 * 关联分析结果模型
 */
export interface CorrelationResult {
  confidence: number; // 置信度 0-1
  correlation_type: string; // 关联类型
  evidence: string[]; // 证据列表
  timeline: Record<string, any>[]; // 时间线
}

/**
 * 根因结果模型
 */
export interface RootCause {
  cause_type: string; // 根因类型
  description: string; // 描述
  confidence: number; // 置信度
  affected_components: string[]; // 受影响组件
  evidence: Record<string, any>; // 证据
  recommendations: string[]; // 建议
}

/**
 * 指标数据模型
 */
export interface MetricData {
  name: string; // 指标名称
  values: Record<string, any>[]; // 时间序列值 [{timestamp, value}]
  labels: Record<string, string>; // 标签
  anomaly_score?: number; // 异常分数 (0-1)
  trend?: string; // 趋势: increasing, decreasing, stable
}

/**
 * 事件数据模型
 */
export interface EventData {
  timestamp: string; // 事件时间，ISO格式
  type: string; // 事件类型 (Normal, Warning)
  reason: string; // 事件原因
  message: string; // 事件消息
  involved_object: Record<string, string>; // 涉及的对象
  severity: SeverityLevel; // 严重程度
  count?: number; // 事件次数
}

/**
 * 日志数据模型
 */
export interface LogData {
  timestamp: string; // 日志时间，ISO格式
  pod_name: string; // Pod名称
  container_name: string; // 容器名称
  level: string; // 日志级别
  message: string; // 日志消息
  error_type?: string; // 错误类型
  stack_trace?: string; // 堆栈跟踪
}

/**
 * 根因分析结果模型
 */
export interface RootCauseAnalysis {
  timestamp: string; // 分析时间，ISO格式
  namespace: string; // 命名空间
  root_causes: any[]; // 根因列表
  anomalies?: Record<string, any>; // 异常检测结果
  correlations?: any[]; // 关联分析结果
  timeline?: Record<string, any>[]; // 事件时间线
  recommendations?: string[]; // 建议列表
  confidence_score?: number; // 置信度分数
  analysis_metadata?: Record<string, any>; // 元数据
}

/**
 * 指标数据响应模型
 */
export interface MetricDataResponse {
  name: string;
  values: Record<string, any>[];
  labels: Record<string, string>;
  anomaly_score: number;
  trend: string;
}

/**
 * 事件数据响应模型
 */
export interface EventDataResponse {
  timestamp: string;
  type: string;
  reason: string;
  message: string;
  involved_object: Record<string, string>;
  severity: SeverityLevel;
  count: number;
}

/**
 * 日志数据响应模型
 */
export interface LogDataResponse {
  timestamp: string;
  pod_name: string;
  container_name: string;
  level: string;
  message: string;
  error_type?: string;
  stack_trace?: string;
}

/**
 * 根因分析请求模型
 */
export interface RCAAnalyzeRequest {
  namespace: string; // Kubernetes命名空间
  time_window_hours: number; // 分析时间窗口（小时）
  metrics?: string[]; // 要分析的Prometheus指标列表
}

/**
 * 指标数据查询请求模型
 */
export interface RCAMetricsDataRequest {
  namespace: string; // Kubernetes命名空间
  start_time?: string; // 开始时间（ISO格式）
  end_time?: string; // 结束时间（ISO格式）
  metrics?: string; // 逗号分隔的指标名称
}

/**
 * 事件数据查询请求模型
 */
export interface RCAEventsDataRequest {
  namespace: string; // Kubernetes命名空间
  start_time?: string; // 开始时间（ISO格式）
  end_time?: string; // 结束时间（ISO格式）
  severity?: string; // 严重程度过滤
}

/**
 * 日志数据查询请求模型
 */
export interface RCALogsDataRequest {
  namespace: string; // Kubernetes命名空间
  start_time?: string; // 开始时间（ISO格式）
  end_time?: string; // 结束时间（ISO格式）
  pod_name?: string; // Pod名称
  error_only?: boolean; // 只返回错误日志
  max_lines?: number; // 最大日志行数
}

/**
 * 快速诊断请求模型
 */
export interface RCAQuickDiagnosisRequest {
  namespace: string; // Kubernetes命名空间
}

/**
 * 事件模式请求模型
 */
export interface RCAEventPatternsRequest {
  namespace: string; // Kubernetes命名空间
  hours: number; // 分析时间范围（小时）
}

/**
 * 错误摘要请求模型
 */
export interface RCAErrorSummaryRequest {
  namespace: string; // Kubernetes命名空间
  hours: number; // 分析时间范围（小时）
}

/**
 * 根因分析响应模型
 */
export interface RCAAnalysisResponse {
  namespace: string;
  analysis_id: string;
  timestamp: string;
  time_window_hours: number;
  root_causes: Record<string, any>[];
  anomalies: Record<string, any>;
  correlations: Record<string, any>[];
  recommendations: string[];
  confidence_score: number;
  status: string;
}

/**
 * 通用数据查询响应模型
 */
export interface RCADataResponse {
  namespace: string;
  items: Record<string, any>[];
  total: number;
  start_time?: string;
  end_time?: string;
  query_params?: Record<string, any>;
  timestamp: string;
}

/**
 * 缓存统计响应模型
 */
export interface RCACacheStatsResponse {
  available: boolean;
  healthy?: boolean;
  cache_prefix?: string;
  default_ttl?: number;
  hit_rate?: number;
  total_keys?: number;
  memory_usage?: string;
  timestamp: string;
  message?: string;
}

/**
 * 清理缓存响应模型
 */
export interface RCAClearCacheResponse {
  success: boolean;
  message: string;
  cleared_count: number;
  operation?: string;
  namespace?: string;
  timestamp: string;
}

/**
 * RCA健康检查响应模型
 */
export interface RCAHealthResponse {
  status: string;
  prometheus_connected: boolean;
  kubernetes_connected: boolean;
  redis_connected: boolean;
  last_check_time: string;
  version?: string;
}

/**
 * 快速诊断响应模型
 */
export interface QuickDiagnosisResponse {
  namespace: string;
  status: string;
  critical_issues: Record<string, any>[];
  warnings: Record<string, any>[];
  recommendations: string[];
  timestamp: string;
  analysis_duration: number;
}

/**
 * 事件模式响应模型
 */
export interface EventPatternsResponse {
  namespace: string;
  time_range_hours: number;
  patterns: Record<string, any>[];
  trending_events: string[];
  anomalous_events: string[];
  timestamp: string;
}

/**
 * 错误摘要响应模型
 */
export interface ErrorSummaryResponse {
  namespace: string;
  time_range_hours: number;
  total_errors: number;
  error_categories: Record<string, number>;
  top_errors: Record<string, any>[];
  error_timeline: Record<string, any>[];
  timestamp: string;
}

// 执行根因分析API
export async function analyzeRootCause(
  request: RCAAnalyzeRequest,
): Promise<RCAAnalysisResponse> {
  return requestClientAIOps.post('/rca/analyze', request);
}

// 获取所有可用的Prometheus指标API
export async function getAllPrometheusMetrics() {
  return requestClientAIOps.get('/rca/metrics');
}

// RCA服务健康检查API
export async function getRCAHealth(): Promise<RCAHealthResponse> {
  return requestClientAIOps.get('/rca/health');
}

// RCA服务就绪检查API
export async function getRCAReady(): Promise<ServiceReadyResponse> {
  return requestClientAIOps.get('/rca/ready');
}

// 获取RCA配置API
export async function getRCAConfig(): Promise<ServiceConfigResponse> {
  return requestClientAIOps.get('/rca/config');
}

// 快速诊断API
export async function quickDiagnosis(
  request: RCAQuickDiagnosisRequest,
): Promise<QuickDiagnosisResponse> {
  return requestClientAIOps.post('/rca/quick-diagnosis', request);
}

// 事件模式分析API
export async function getEventPatterns(
  request: RCAEventPatternsRequest,
): Promise<EventPatternsResponse> {
  return requestClientAIOps.post('/rca/event-patterns', request);
}

// 错误摘要API
export async function getErrorSummary(
  request: RCAErrorSummaryRequest,
): Promise<ErrorSummaryResponse> {
  return requestClientAIOps.post('/rca/error-summary', request);
}

// 查询指标数据API
export async function queryMetricsData(
  request: RCAMetricsDataRequest,
): Promise<RCADataResponse> {
  return requestClientAIOps.post('/rca/data/metrics', request);
}

// 查询事件数据API
export async function queryEventsData(
  request: RCAEventsDataRequest,
): Promise<RCADataResponse> {
  return requestClientAIOps.post('/rca/data/events', request);
}

// 查询日志数据API
export async function queryLogsData(
  request: RCALogsDataRequest,
): Promise<RCADataResponse> {
  return requestClientAIOps.post('/rca/data/logs', request);
}

// 获取缓存统计API
export async function getCacheStats(): Promise<RCACacheStatsResponse> {
  return requestClientAIOps.get('/rca/cache/stats');
}

// 清理所有缓存API
export async function clearAllCache(): Promise<RCAClearCacheResponse> {
  return requestClientAIOps.delete('/rca/cache/clear');
}

// 清理指定命名空间缓存API
export async function clearNamespaceCache(
  request: { namespace: string },
): Promise<RCAClearCacheResponse> {
  return requestClientAIOps.post('/rca/cache/clear/namespace', request);
}

// 清理指定操作缓存API
export async function clearOperationCache(
  request: { operation: string },
): Promise<RCAClearCacheResponse> {
  return requestClientAIOps.post('/rca/cache/clear/operation', request);
}

// 获取RCA服务信息API
export async function getRCAInfo(): Promise<ServiceInfoResponse> {
  return requestClientAIOps.get('/rca/info');
}
