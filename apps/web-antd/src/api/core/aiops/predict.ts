import { requestClientAIOps } from '#/api/request';

// 预测类型枚举
export enum PredictionType {
  QPS = 'qps',
  CPU = 'cpu',
  MEMORY = 'memory',
  DISK = 'disk'
}

// 预测时间粒度枚举
export enum PredictionGranularity {
  MINUTE = 'minute',
  HOUR = 'hour',
  DAY = 'day'
}

// 扩缩容建议动作枚举
export enum ScalingAction {
  SCALE_UP = 'scale_up',
  SCALE_DOWN = 'scale_down',
  MAINTAIN = 'maintain'
}

// 资源约束配置接口
export interface ResourceConstraints {
  cpu_cores?: number;
  memory_gb?: number;
  disk_gb?: number;
  max_instances?: number;
  min_instances?: number;
  cost_per_hour?: number;
}

// 预测请求基础接口
export interface BasePredictionRequest {
  metric_query?: string;
  prediction_hours?: number;
  granularity?: PredictionGranularity;
  resource_constraints?: ResourceConstraints;
  include_confidence?: boolean;
  include_anomaly_detection?: boolean;
  consider_historical_pattern?: boolean;
  target_utilization?: number;
  sensitivity?: number;
  enable_ai_insights?: boolean;
  ai_report_style?: string;
}

// QPS预测专用请求接口
export interface QpsPredictionRequest extends BasePredictionRequest {
  current_qps: number;
}

// CPU预测专用请求接口
export interface CpuPredictionRequest extends BasePredictionRequest {
  current_cpu_percent: number;
}

// 内存预测专用请求接口
export interface MemoryPredictionRequest extends BasePredictionRequest {
  current_memory_percent: number;
}

// 磁盘预测专用请求接口
export interface DiskPredictionRequest extends BasePredictionRequest {
  current_disk_percent: number;
}

// 预测数据点接口
export interface PredictionDataPoint {
  timestamp: string;
  predicted_value: number;
  confidence_lower?: number;
  confidence_upper?: number;
  confidence_level?: number;
}

// 资源利用率预测接口
export interface ResourceUtilization {
  timestamp: string;
  cpu_utilization?: number;
  memory_utilization?: number;
  disk_utilization?: number;
  predicted_load?: number;
}

// 扩缩容建议接口
export interface ScalingRecommendation {
  action: ScalingAction;
  trigger_time: string;
  confidence: number;
  reason: string;
  target_instances?: number;
  target_cpu_cores?: number;
  target_memory_gb?: number;
  target_disk_gb?: number;
  estimated_cost_change?: number;
}

// 成本分析接口
export interface CostAnalysis {
  current_hourly_cost?: number;
  predicted_hourly_cost?: number;
  cost_savings_potential?: number;
  cost_trend_analysis: Record<string, any>;
}

// 异常预测接口
export interface AnomalyPrediction {
  timestamp: string;
  anomaly_score: number;
  anomaly_type: string;
  impact_level: string;
  predicted_value: number;
  expected_value: number;
}

// 模型信息接口
export interface ModelInfo {
  model_name: string;
  model_version: string;
  model_type: string;
  supported_prediction_types: PredictionType[];
  training_data_size?: number;
  last_trained?: string;
  accuracy_metrics: Record<string, number>;
  feature_importance: Record<string, number>;
}

// 统一预测响应接口
export interface PredictionResponse {
  prediction_type: PredictionType;
  prediction_hours: number;
  granularity: PredictionGranularity;
  current_value: number;
  predicted_data: PredictionDataPoint[];
  resource_utilization: ResourceUtilization[];
  scaling_recommendations: ScalingRecommendation[];
  anomaly_predictions: AnomalyPrediction[];
  cost_analysis?: CostAnalysis;
  pattern_analysis: Record<string, any>;
  trend_insights: string[];
  model_accuracy?: number;
  prediction_summary: Record<string, any>;
  ai_enhanced?: boolean;
  ai_insights?: string[];
  ai_analysis_context?: Record<string, any>;
  ai_prediction_interpretation?: Record<string, any>;
  ai_reports?: Record<string, any>;
  analysis_id?: string;
  processing_time_seconds?: number;
  data_quality_assessment?: Record<string, any>;
  timestamp: string;
}

// 预测服务健康检查响应接口
export interface PredictionServiceHealthResponse {
  service_status: string;
  model_status: string;
  models_loaded: ModelInfo[];
  supported_prediction_types: PredictionType[];
  last_prediction_time?: string;
  total_predictions: number;
  error_rate: number;
  average_response_time_ms?: number;
  resource_usage: Record<string, number>;
  timestamp: string;
}

// AI分析上下文接口
export interface AIAnalysisContext {
  status: string;
  analysis: Record<string, any>;
  timestamp: string;
}

// AI预测解读接口
export interface AIPredictionInterpretation {
  status: string;
  interpretation: Record<string, any>;
  quantitative_metrics: Record<string, any>;
  timestamp: string;
}

// AI报告接口
export interface AIReport {
  comprehensive_report?: Record<string, any>;
  executive_summary?: Record<string, any>;
  action_plan?: Record<string, any>;
  cost_optimization?: Record<string, any>;
}

// AI增强预测响应接口
export interface AIEnhancedPredictionResponse {
  prediction_type: PredictionType;
  prediction_hours: number;
  granularity: PredictionGranularity;
  current_value: number;
  predicted_data: PredictionDataPoint[];
  resource_utilization: ResourceUtilization[];
  scaling_recommendations: ScalingRecommendation[];
  anomaly_predictions: AnomalyPrediction[];
  cost_analysis?: CostAnalysis;
  pattern_analysis: Record<string, any>;
  trend_insights: string[];
  model_accuracy?: number;
  prediction_summary: Record<string, any>;
  ai_enhanced: boolean;
  analysis_context?: AIAnalysisContext;
  prediction_interpretation?: AIPredictionInterpretation;
  ai_insights: string[];
  ai_reports?: AIReport;
  analysis_id?: string;
  processing_time_seconds?: number;
  ai_processing_stages: Record<string, string>;
  data_quality_assessment: Record<string, any>;
  fallback_mode?: boolean;
  fallback_reason?: string;
  timestamp: string;
}

// 多维度预测响应接口
export interface MultiDimensionPredictionResponse {
  analysis_id: string;
  prediction_results: Record<string, Record<string, any>>;
  correlation_analysis?: Record<string, any>;
  multi_dimension_insights: string[];
  summary_statistics: Record<string, any>;
  processing_time_seconds: number;
  analyzed_dimensions: string[];
  timestamp: string;
}

// 预测报告响应接口
export interface PredictionReportResponse {
  analysis_id: string;
  report_type: string;
  report_style: string;
  status: string;
  report_content?: string;
  metadata: Record<string, any>;
  generated_at: string;
}

// AI功能能力响应接口
export interface AICapabilitiesResponse {
  ai_enhanced_prediction: Record<string, any>;
  multi_dimension_analysis: Record<string, any>;
  intelligent_reporting: Record<string, any>;
  ai_models: Record<string, any>;
  service_info: Record<string, any>;
}

// 模型信息响应接口
export interface ModelInfoResponse {
  models: Record<string, any>[];
  total_models: number;
  loaded_models: number;
  status: string;
  timestamp: string;
}

// 服务信息响应接口
export interface ServiceInfoResponse {
  service: string;
  version: string;
  description: string;
  capabilities: string[];
  endpoints: Record<string, string>;
  constraints: Record<string, any>;
  status: string;
}

// 服务就绪响应接口
export interface ServiceReadyResponse {
  ready: boolean;
  service: string;
  timestamp: string;
  message: string;
}

// QPS预测API
export async function predictQps(request: QpsPredictionRequest): Promise<PredictionResponse> {
  return requestClientAIOps.post('/predict/qps', request);
};

// CPU预测API
export async function predictCpu(request: CpuPredictionRequest): Promise<PredictionResponse> {
  return requestClientAIOps.post('/predict/cpu', request);
};

// 内存预测API
export async function predictMemory(request: MemoryPredictionRequest): Promise<PredictionResponse> {
  return requestClientAIOps.post('/predict/memory', request);
};

// 磁盘预测API
export async function predictDisk(request: DiskPredictionRequest): Promise<PredictionResponse> {
  return requestClientAIOps.post('/predict/disk', request);
};

// 预测服务健康检查API
export async function getPredictionHealth(): Promise<PredictionServiceHealthResponse> {
  return requestClientAIOps.get('/predict/health');
};

// 预测服务就绪检查API
export async function getPredictionReady(): Promise<ServiceReadyResponse> {
  return requestClientAIOps.get('/predict/ready');
};

// 预测服务信息API
export async function getPredictionInfo(): Promise<ServiceInfoResponse> {
  return requestClientAIOps.get('/predict/info');
};

// 模型信息API
export async function getModelInfo(): Promise<ModelInfoResponse> {
  return requestClientAIOps.get('/predict/models');
};
