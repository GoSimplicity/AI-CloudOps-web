import { requestClient } from '#/api/request';

// K8s Ingress状态枚举
export enum K8sIngressStatus {
  RUNNING = 1, // 运行中
  PENDING = 2, // 等待中
  FAILED = 3, // 失败
}

// Ingress端口状态
export interface IngressPortStatus {
  port: number; // 端口号
  protocol: string; // 协议
  error: string; // 错误信息
}

// 负载均衡器Ingress
export interface IngressLoadBalancerIngress {
  ip: string; // IP地址
  hostname: string; // 主机名
  ports: IngressPortStatus[]; // 端口状态
}

// 负载均衡器
export interface IngressLoadBalancer {
  ingress: IngressLoadBalancerIngress[]; // Ingress信息
}

// TLS配置
export interface IngressTLS {
  hosts: string[]; // 主机列表
  secret_name: string; // Secret名称
}

// HTTP路径
export interface IngressHTTPIngressPath {
  path: string; // 路径
  path_type?: string; // 路径类型
  backend: any; // 后端服务
}

// HTTP规则值
export interface IngressHTTPRuleValue {
  paths: IngressHTTPIngressPath[]; // 路径列表
}

// Ingress规则
export interface IngressRule {
  host: string; // 主机名
  http: IngressHTTPRuleValue; // HTTP规则
}

// K8s Ingress实体
export interface K8sIngress {
  id?: number;
  name: string; // Ingress名称
  namespace: string; // 所属命名空间
  cluster_id: number; // 所属集群ID
  uid: string; // Ingress UID
  ingress_class_name?: string; // Ingress类名
  rules: IngressRule[]; // Ingress规则
  tls: IngressTLS[]; // TLS配置
  load_balancer: IngressLoadBalancer; // 负载均衡器信息
  labels: Record<string, string>; // 标签
  annotations: Record<string, string>; // 注解
  created_at: string; // 创建时间
  age: string; // 存在时间，前端计算使用
  status: K8sIngressStatus; // Ingress状态，前端计算使用
  hosts: string[]; // 主机列表，前端使用
}

// 获取Ingress列表请求
export interface GetIngressListReq {
  page?: number;
  size?: number;
  cluster_id: number; // 集群ID
  search?: string; // 搜索关键词
  namespace?: string; // 命名空间
  status?: K8sIngressStatus; // 状态过滤
  labels?: Record<string, string>; // 标签
}

// 获取Ingress详情请求
export interface GetIngressDetailsReq {
  cluster_id: number; // 集群ID
  namespace: string; // 命名空间
  name: string; // Ingress名称
}

// 获取Ingress YAML请求
export interface GetIngressYamlReq {
  cluster_id: number; // 集群ID
  namespace: string; // 命名空间
  name: string; // Ingress名称
}

// 创建Ingress请求
export interface CreateIngressReq {
  cluster_id: number; // 集群ID
  name: string; // Ingress名称
  namespace: string; // 命名空间
  ingress_class_name?: string; // Ingress类名
  rules: IngressRule[]; // Ingress规则
  tls: IngressTLS[]; // TLS配置
  labels: Record<string, string>; // 标签
  annotations: Record<string, string>; // 注解
}

// 更新Ingress请求
export interface UpdateIngressReq {
  cluster_id: number; // 集群ID
  name: string; // Ingress名称
  namespace: string; // 命名空间
  ingress_class_name?: string; // Ingress类名
  rules: IngressRule[]; // Ingress规则
  tls: IngressTLS[]; // TLS配置
  labels: Record<string, string>; // 标签
  annotations: Record<string, string>; // 注解
}

// 通过YAML创建Ingress请求
export interface CreateIngressByYamlReq {
  cluster_id: number; // 集群ID
  yaml: string; // YAML内容
}

// 通过YAML更新Ingress请求
export interface UpdateIngressByYamlReq {
  cluster_id: number; // 集群ID
  namespace: string; // 命名空间
  name: string; // Ingress名称
  yaml: string; // YAML内容
}

// 删除Ingress请求
export interface DeleteIngressReq {
  cluster_id: number; // 集群ID
  namespace: string; // 命名空间
  name: string; // Ingress名称
}

// 获取Ingress列表
export const getK8sIngressList = (params: GetIngressListReq) => {
  return requestClient.get(`/k8s/ingress/${params.cluster_id}/list`, { params });
};

// 获取Ingress详情
export const getK8sIngressDetails = (params: GetIngressDetailsReq) => {
  return requestClient.get(`/k8s/ingress/${params.cluster_id}/${params.namespace}/${params.name}/detail`);
};

// 获取Ingress YAML
export const getK8sIngressYaml = (params: GetIngressYamlReq) => {
  return requestClient.get(`/k8s/ingress/${params.cluster_id}/${params.namespace}/${params.name}/detail/yaml`);
};

// 创建Ingress
export const createK8sIngress = (data: CreateIngressReq) => {
  return requestClient.post(`/k8s/ingress/${data.cluster_id}/create`, data);
};

// 通过YAML创建Ingress
export const createK8sIngressByYaml = (data: CreateIngressByYamlReq) => {
  return requestClient.post(`/k8s/ingress/${data.cluster_id}/create/yaml`, data);
};

// 更新Ingress
export const updateK8sIngress = (data: UpdateIngressReq) => {
  return requestClient.put(`/k8s/ingress/${data.cluster_id}/${data.namespace}/${data.name}/update`, data);
};

// 通过YAML更新Ingress
export const updateK8sIngressByYaml = (data: UpdateIngressByYamlReq) => {
  return requestClient.put(`/k8s/ingress/${data.cluster_id}/${data.namespace}/${data.name}/update/yaml`, data);
};

// 删除Ingress
export const deleteK8sIngress = (params: DeleteIngressReq) => {
  return requestClient.delete(`/k8s/ingress/${params.cluster_id}/${params.namespace}/${params.name}/delete`);
};
