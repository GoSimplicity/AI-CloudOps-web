import { requestClient } from '#/api/request';

// 节点状态枚举
export enum NodeStatus {
  Ready = 1,              // 就绪
  NotReady = 2,           // 未就绪
  SchedulingDisabled = 3, // 调度禁用
  Unknown = 4,            // 未知
  Error = 5               // 异常
}

// 节点资源信息结构
export interface NodeResource {
  used: string;     // 已使用量
  total: string;    // 总量
  percent: number;  // 使用百分比
  requests: string; // 请求量
  limits: string;   // 限制量
}

// 节点事件
export interface NodeEvent {
  type: string;            // 事件类型 (Normal, Warning)
  reason: string;          // 事件原因
  message: string;         // 事件消息
  component: string;       // 事件来源组件
  host: string;            // 主机
  first_timestamp: string; // 首次发生时间
  last_timestamp: string;  // 最后发生时间
  count: number;           // 发生次数
}

// 节点条件
export interface NodeCondition {
  type: string;              // 条件类型
  status: string;            // 条件状态
  lastHeartbeatTime: string; // 最后心跳时间
  lastTransitionTime: string; // 最后转换时间
  reason: string;            // 原因
  message: string;           // 消息
}

// 节点污点
export interface NodeTaint {
  key: string;    // 污点键
  value: string;  // 污点值
  effect: string; // 污点效果
}

// Kubernetes 节点
export interface K8sNode {
  name: string;                        // 节点名称
  cluster_id: number;                  // 所属集群ID
  status: NodeStatus;                  // 节点状态
  schedulable: number;                 // 节点是否可调度 (1: 可调度, 2: 不可调度)
  roles: string[];                     // 节点角色，例如 master, worker
  age: string;                         // 节点存在时间，例如 5d
  internal_ip: string;                 // 节点内部IP
  external_ip: string;                 // 节点外部IP（如果有）
  hostname: string;                    // 主机名
  cpu: NodeResource;                   // CPU 资源信息
  memory: NodeResource;                // 内存资源信息
  storage: NodeResource;               // 存储资源信息
  pods: NodeResource;                  // Pod 资源信息
  ephemeral_storage: NodeResource;     // 临时存储信息
  kubelet_version: string;             // Kubelet 版本
  kube_proxy_version: string;          // KubeProxy 版本
  container_runtime: string;           // 容器运行时
  operating_system: string;            // 操作系统
  architecture: string;                // 系统架构
  kernel_version: string;              // 内核版本
  os_image: string;                    // 操作系统镜像
  labels: Record<string, string>;      // 节点标签
  annotations: Record<string, string>; // 节点注解
  conditions: NodeCondition[];         // 节点条件
  taints: NodeTaint[];                 // 节点污点
  events: NodeEvent[];                 // 节点相关事件
  created_at: string;                  // 创建时间
  updated_at: string;                  // 更新时间
}

// 节点污点实体
export interface NodeTaintEntity {
  key: string;    // 污点键
  value: string;  // 污点值
  effect: string; // 污点效果: NoSchedule, PreferNoSchedule, NoExecute
}

// 节点指标信息
export interface NodeMetrics {
  node_name: string;  // 节点名称
  timestamp: string;  // 采集时间
  window: string;     // 时间窗口
  usage: Record<string, string>; // 资源使用量
}

// 获取节点列表请求
export interface GetNodeListReq {
  page?: number;
  size?: number;
  search?: string;
  cluster_id: number;        // 集群ID
  status?: NodeStatus[];     // 状态过滤
  label_selector?: string;   // 标签选择器
}

// 获取节点详情请求
export interface GetNodeDetailReq {
  cluster_id: number; // 集群ID
  node_name: string;  // 节点名称
}

// 添加节点标签请求
export interface AddLabelNodesReq {
  cluster_id: number;                // 集群ID
  node_name: string;                 // 节点名称
  labels: Record<string, string>;    // 要添加的标签
  overwrite: number;                 // 是否覆盖已存在的标签 (1: 是, 2: 否)
}

// 删除节点标签请求
export interface DeleteLabelNodesReq {
  cluster_id: number; // 集群ID
  node_name: string;  // 节点名称
  label_keys: string[]; // 要删除的标签键
}

// 获取节点资源请求
export interface GetNodeResourceReq {
  cluster_id: number; // 集群ID
  node_name?: string; // 节点名称（可选，为空则获取所有节点）
}

// 获取节点事件请求
export interface GetNodeEventsReq {
  cluster_id: number; // 集群ID
  node_name: string;  // 节点名称
  limit?: number;     // 事件数量限制
}

// 驱逐节点请求
export interface DrainNodeReq {
  cluster_id: number;          // 集群ID
  node_name: string;           // 节点名称
  force: number;               // 是否强制驱逐 (1: 是, 2: 否)
  ignore_daemon_sets: number;  // 是否忽略DaemonSet (1: 是, 2: 否)
  delete_local_data: number;   // 是否删除本地数据 (1: 是, 2: 否)
  grace_period_seconds?: number; // 优雅关闭时间(秒)
  timeout_seconds?: number;    // 超时时间(秒)
}

// 禁止节点调度请求
export interface NodeCordonReq {
  cluster_id: number; // 集群ID
  node_name: string;  // 节点名称
}

// 解除节点调度限制请求
export interface NodeUncordonReq {
  cluster_id: number; // 集群ID
  node_name: string;  // 节点名称
}

// 获取节点污点请求
export interface GetNodeTaintsReq {
  cluster_id: number; // 集群ID
  node_name: string;  // 节点名称
}

// 添加节点污点请求
export interface AddNodeTaintsReq {
  cluster_id: number;        // 集群ID
  node_name: string;         // 节点名称
  taints: NodeTaintEntity[]; // 要添加的污点
}

// 删除节点污点请求
export interface DeleteNodeTaintsReq {
  cluster_id: number; // 集群ID
  node_name: string;  // 节点名称
  taint_keys: string[]; // 要删除的污点键
}

// 检查污点YAML配置请求
export interface CheckTaintYamlReq {
  cluster_id: number; // 集群ID
  node_name: string;  // 节点名称
  yaml_data: string;  // YAML数据
}

// 切换节点调度状态请求
export interface SwitchNodeScheduleReq {
  cluster_id: number; // 集群ID
  node_name: string;  // 节点名称
  enable: number;     // 是否启用调度 (1: 启用, 2: 禁用)
}

// 获取节点指标请求
export interface GetNodeMetricsReq {
  cluster_id: number; // 集群ID
  node_names?: string[]; // 节点名称列表（可选）
}

// 获取节点列表
export const getNodeList = (params: GetNodeListReq) => {
  return requestClient.get(`/k8s/nodes/${params.cluster_id}/list`, { params });
};

// 获取节点详情
export const getNodeDetail = (params: GetNodeDetailReq) => {
  return requestClient.get(`/k8s/nodes/${params.cluster_id}/${params.node_name}/detail`);
};

// 获取节点资源使用情况
export const getNodeResource = (params: GetNodeResourceReq) => {
  return requestClient.get(`/k8s/nodes/${params.cluster_id}/${params.node_name}/resource`);
};

// 获取节点事件
export const getNodeEvents = (params: GetNodeEventsReq) => {
  return requestClient.get(`/k8s/nodes/${params.cluster_id}/${params.node_name}/events`, { params });
};

// 获取节点指标信息
export const getNodeMetrics = (params: GetNodeMetricsReq) => {
  return requestClient.get(`/k8s/nodes/${params.cluster_id}/metrics`, { params });
};

// 添加节点标签
export const addLabelNodes = (params: AddLabelNodesReq) => {
  return requestClient.post(`/k8s/nodes/${params.cluster_id}/${params.node_name}/labels/add`, params);
};

// 删除节点标签
export const deleteLabelNodes = (params: DeleteLabelNodesReq) => {
  return requestClient.delete(`/k8s/nodes/${params.cluster_id}/${params.node_name}/labels/delete`, { data: params });
};

// 驱逐节点Pod
export const drainNode = (params: DrainNodeReq) => {
  return requestClient.post(`/k8s/nodes/${params.cluster_id}/${params.node_name}/drain`, params);
};

// 禁止节点调度
export const cordonNode = (params: NodeCordonReq) => {
  return requestClient.post(`/k8s/nodes/${params.cluster_id}/${params.node_name}/cordon`, params);
};

// 解除节点调度限制
export const uncordonNode = (params: NodeUncordonReq) => {
  return requestClient.post(`/k8s/nodes/${params.cluster_id}/${params.node_name}/uncordon`, params);
};

// 切换节点调度状态
export const switchNodeSchedule = (params: SwitchNodeScheduleReq) => {
  return requestClient.post(`/k8s/nodes/${params.cluster_id}/${params.node_name}/schedule/switch`, params);
};

// 获取节点污点列表
export const getNodeTaints = (params: GetNodeTaintsReq) => {
  return requestClient.get(`/k8s/nodes/${params.cluster_id}/${params.node_name}/taints`);
};

// 添加节点污点
export const addNodeTaints = (params: AddNodeTaintsReq) => {
  return requestClient.post(`/k8s/nodes/${params.cluster_id}/${params.node_name}/taints/add`, params);
};

// 删除节点污点
export const deleteNodeTaints = (params: DeleteNodeTaintsReq) => {
  return requestClient.delete(`/k8s/nodes/${params.cluster_id}/${params.node_name}/taints/delete`, { data: params });
};

// 检查污点YAML配置
export const checkTaintYaml = (params: CheckTaintYamlReq) => {
  return requestClient.post(`/k8s/nodes/${params.cluster_id}/${params.node_name}/taints/check`, params);
};
