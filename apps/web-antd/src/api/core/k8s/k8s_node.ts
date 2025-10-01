import { requestClient } from '#/api/request';

// 节点状态枚举
export enum NodeStatus {
  Ready = 1,              // 就绪
  NotReady = 2,           // 未就绪
  SchedulingDisabled = 3, // 调度禁用
  Unknown = 4,            // 未知
  Error = 5               // 异常
}

// 节点污点接口
export interface NodeTaint {
  key: string;    // 污点键
  value: string;  // 污点值
  effect: string; // 污点效果
}

// 节点条件接口
export interface NodeCondition {
  type: string;               // 条件类型
  status: string;             // 条件状态
  lastHeartbeatTime?: string; // 最后心跳时间
  lastTransitionTime?: string; // 最后转换时间
  reason?: string;            // 原因
  message?: string;           // 消息
}

// 节点污点接口（K8s原生）
export interface CoreTaint {
  key: string;
  value?: string;
  effect: string;
  timeAdded?: string;
}

// K8s节点接口
export interface K8sNode {
  name: string;                     // 节点名称
  cluster_id: number;               // 所属集群ID
  status: NodeStatus;               // 节点状态
  schedulable: number;              // 节点是否可调度 (1: 可调度, 2: 不可调度)
  roles: string[];                  // 节点角色，例如 master, worker
  age: string;                      // 节点存在时间，例如 5d
  internal_ip: string;              // 节点内部IP
  external_ip: string;              // 节点外部IP（如果有）
  hostname: string;                 // 主机名
  kubelet_version: string;          // Kubelet 版本
  kube_proxy_version: string;       // KubeProxy 版本
  container_runtime: string;        // 容器运行时
  operating_system: string;         // 操作系统
  architecture: string;             // 系统架构
  kernel_version: string;           // 内核版本
  os_image: string;                 // 操作系统镜像
  labels: Record<string, string>;   // 节点标签
  annotations: Record<string, string>; // 节点注解
  conditions: NodeCondition[];      // 节点条件
  taints: CoreTaint[];              // 节点污点
  created_at: string;               // 创建时间
  updated_at: string;               // 更新时间
}

// 分页基础请求接口
export interface ListReq {
  page?: number;      // 页码
  size?: number; // 每页大小
  search?: string;   // 关键词搜索
}

// 获取节点列表请求接口
export interface GetK8sNodeListReq extends ListReq {
  cluster_id: number;         // 集群ID
  status?: NodeStatus;        // 状态过滤
  label_selector?: string;    // 标签选择器
}

// 获取节点详情请求接口
export interface GetK8sNodeDetailReq {
  cluster_id: number; // 集群ID
  node_name: string;  // 节点名称
}

// 添加节点标签请求接口
export interface AddLabelNodesReq {
  cluster_id: number;                 // 集群ID
  node_name: string;                  // 节点名称
  labels: Record<string, string>; 
}

// 驱逐节点请求接口
export interface DrainK8sNodeReq {
  cluster_id: number;          // 集群ID
  node_name: string;           // 节点名称
  force: number;               // 是否强制驱逐 (1: 是, 2: 否)
  ignore_daemon_sets: number;  // 是否忽略DaemonSet (1: 是, 2: 否)
  delete_local_data: number;   // 是否删除本地数据 (1: 是, 2: 否)
  grace_period_seconds?: number; // 优雅关闭时间(秒)
  timeout_seconds?: number;    // 超时时间(秒)
}

// 禁止节点调度请求接口
export interface K8sNodeCordonReq {
  cluster_id: number; // 集群ID
  node_name: string;  // 节点名称
}

// 解除节点调度限制请求接口
export interface K8sNodeUncordonReq {
  cluster_id: number; // 集群ID
  node_name: string;  // 节点名称
}

// 获取节点污点请求接口
export interface GetK8sNodeTaintsReq {
  cluster_id: number; // 集群ID
  node_name: string;  // 节点名称
}

// 添加节点污点请求接口
export interface AddK8sNodeTaintsReq {
  cluster_id: number; // 集群ID
  node_name: string;  // 节点名称
  taints: CoreTaint[]; // 要添加的污点
}

// 删除节点污点请求接口
export interface DeleteK8sNodeTaintsReq {
  cluster_id: number; // 集群ID
  node_name: string;  // 节点名称
  taint_keys: string[]; // 要删除的污点键
}

// 检查污点YAML配置请求接口
export interface CheckTaintYamlReq {
  cluster_id: number; // 集群ID
  node_name: string;  // 节点名称
  yaml_data: string;  // YAML数据
}

// 切换节点调度状态请求接口
export interface SwitchK8sNodeScheduleReq {
  cluster_id: number; // 集群ID
  node_name: string;  // 节点名称
  enable: number;     // 是否启用调度 (1: 启用, 2: 禁用)
}

// 获取节点列表
export const getK8sNodeList = (params: GetK8sNodeListReq) => {
  return requestClient.get(`/k8s/clusters/${params.cluster_id}/nodes`, { params });
};

// 获取节点详情
export const getK8sNodeDetail = (params: GetK8sNodeDetailReq) => {
  return requestClient.get(`/k8s/clusters/${params.cluster_id}/nodes/${params.node_name}`);
};

// 添加节点标签
export const addK8sNodeLabels = (params: AddLabelNodesReq) => {
  const { cluster_id, node_name, ...data } = params;
  return requestClient.post(`/k8s/clusters/${cluster_id}/nodes/${node_name}/labels`, data);
};

// 驱逐节点
export const drainK8sNode = (params: DrainK8sNodeReq) => {
  const { cluster_id, node_name, ...data } = params;
  return requestClient.post(`/k8s/clusters/${cluster_id}/nodes/${node_name}/drain`, data);
};

// 禁止节点调度
export const cordonK8sNode = (params: K8sNodeCordonReq) => {
  return requestClient.post(`/k8s/clusters/${params.cluster_id}/nodes/${params.node_name}/cordon`);
};

// 解除节点调度限制
export const uncordonK8sNode = (params: K8sNodeUncordonReq) => {
  return requestClient.post(`/k8s/clusters/${params.cluster_id}/nodes/${params.node_name}/uncordon`);
};

// 切换节点调度状态
export const switchK8sNodeSchedule = (params: SwitchK8sNodeScheduleReq) => {
  const { cluster_id, node_name, ...data } = params;
  return requestClient.post(`/k8s/clusters/${cluster_id}/nodes/${node_name}/schedule/switch`, data);
};

// 获取节点污点
export const getK8sNodeTaints = (params: GetK8sNodeTaintsReq) => {
  return requestClient.get(`/k8s/clusters/${params.cluster_id}/nodes/${params.node_name}/taints`);
};

// 添加节点污点
export const addK8sNodeTaints = (params: AddK8sNodeTaintsReq) => {
  const { cluster_id, node_name, ...data } = params;
  return requestClient.post(`/k8s/clusters/${cluster_id}/nodes/${node_name}/taints`, data);
};

// 删除节点污点
export const deleteK8sNodeTaints = (params: DeleteK8sNodeTaintsReq) => {
  const { cluster_id, node_name, ...data } = params;
  return requestClient.delete(`/k8s/clusters/${cluster_id}/nodes/${node_name}/taints`, { data });
};

// 检查污点YAML配置
export const checkK8sNodeTaintYaml = (params: CheckTaintYamlReq) => {
  const { cluster_id, node_name, ...data } = params;
  return requestClient.post(`/k8s/clusters/${cluster_id}/nodes/${node_name}/taints/check`, data);
};
