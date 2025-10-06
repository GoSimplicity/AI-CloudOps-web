import { requestClient } from '#/api/request';

// K8sPod状态枚举
export enum K8sPodStatus {
  Pending = 'Pending',
  Running = 'Running',
  Succeeded = 'Succeeded',
  Failed = 'Failed',
  Unknown = 'Unknown',
}

// Pod阶段枚举
export enum K8sPodPhase {
  Pending = 'Pending',
  Running = 'Running',
  Succeeded = 'Succeeded',
  Failed = 'Failed',
  Unknown = 'Unknown',
}

// K8sPod Kubernetes Pod模型
export interface K8sPod {
  cluster_id: number; // 集群ID
  name: string; // Pod名称
  namespace: string; // 所属命名空间
  uid: string; // Pod UID
  labels: string; // 标签(JSON字符串)
  annotations: string; // 注解(JSON字符串)
  status: string; // Pod状态
  phase: string; // Pod阶段
  node_name: string; // 所在节点
  pod_ip: string; // Pod IP地址
  host_ip: string; // 宿主机IP地址
  qos_class: string; // QoS等级
  restart_count: number; // 重启次数
  ready: string; // 就绪状态(如"1/1")
  service_account: string; // 服务账户
  restart_policy: string; // 重启策略
  dns_policy: string; // DNS策略
  conditions: string; // Pod条件(JSON字符串)
  containers: string; // 容器列表(JSON字符串)
  init_containers: string; // 初始化容器列表(JSON字符串)
  volumes: string; // 卷列表(JSON字符串)
  created_at: string; // 创建时间
  start_time?: string; // 启动时间
  deleted_at?: string; // 删除时间戳
  owner_references: string; // 所有者引用(JSON字符串)
  resource_version: string; // 资源版本
  generation: number; // 生成版本号
  spec: string; // Pod规格(JSON字符串)
}

// PodContainer Pod容器信息
export interface PodContainer {
  name: string; // 容器名称
  image: string; // 容器镜像
  command: string[]; // 启动命令
  args: string[]; // 启动参数
  envs: PodEnvVar[]; // 环境变量
  ports: PodContainerPort[]; // 容器端口
  resources: PodResourceRequirements; // 资源要求
  volume_mounts: PodVolumeMount[]; // 卷挂载
  liveness_probe?: PodProbe; // 存活探测
  readiness_probe?: PodProbe; // 就绪探测
  image_pull_policy: string; // 镜像拉取策略
  ready: boolean; // 是否就绪
  restart_count: number; // 重启次数
  state: PodContainerState; // 容器状态
}

// PodEnvVar 环境变量
export interface PodEnvVar {
  name: string; // 环境变量名称
  value: string; // 环境变量值
}

// PodContainerPort 容器端口
export interface PodContainerPort {
  name: string; // 端口名称
  container_port: number; // 容器端口号
  protocol: string; // 协议类型
}

// PodResourceRequirements 资源要求
export interface PodResourceRequirements {
  requests: PodResourceList; // 资源请求
  limits: PodResourceList; // 资源限制
}

// PodResourceList 资源列表
export interface PodResourceList {
  cpu: string; // CPU数量
  memory: string; // 内存数量
}

// PodVolumeMount 卷挂载
export interface PodVolumeMount {
  name: string; // 卷名称
  mount_path: string; // 挂载路径
  read_only: boolean; // 是否只读
  sub_path: string; // 子路径
}

// PodProbe 探测配置
export interface PodProbe {
  http_get?: PodHTTPGetAction; // HTTP GET探测
  initial_delay_seconds: number; // 初始延迟时间
  period_seconds: number; // 探测间隔时间
  timeout_seconds: number; // 探测超时时间
  success_threshold: number; // 成功阈值
  failure_threshold: number; // 失败阈值
}

// PodHTTPGetAction HTTP GET探测动作
export interface PodHTTPGetAction {
  path: string; // 探测路径
  port: number; // 探测端口
  scheme: string; // 协议类型
}

// PodContainerState 容器状态
export interface PodContainerState {
  waiting?: PodContainerStateWaiting; // 等待状态
  running?: PodContainerStateRunning; // 运行状态
  terminated?: PodContainerStateTerminated; // 终止状态
}

// PodContainerStateWaiting 容器等待状态
export interface PodContainerStateWaiting {
  reason: string; // 等待原因
  message: string; // 等待消息
}

// PodContainerStateRunning 容器运行状态
export interface PodContainerStateRunning {
  started_at: string; // 开始时间
}

// PodContainerStateTerminated 容器终止状态
export interface PodContainerStateTerminated {
  exit_code: number; // 退出码
  signal: number; // 信号
  reason: string; // 终止原因
  message: string; // 终止消息
  started_at: string; // 开始时间
  finished_at: string; // 结束时间
  container_id: string; // 容器ID
}

// PodCondition Pod条件
export interface PodCondition {
  type: string; // 条件类型
  status: string; // 条件状态
  last_probe_time: string; // 最后探测时间
  last_transition_time: string; // 最后转换时间
  reason: string; // 原因
  message: string; // 消息
}

// GetPodListReq 获取Pod列表请求
export interface GetPodListReq {
  cluster_id: number; // 集群ID
  namespace?: string; // 命名空间
  status?: string; // Pod状态
  page?: number; // 页码
  page_size?: number; // 每页数量
  search?: string; // 搜索关键词
  labels?: Record<string, string>; // 标签筛选
}

// GetPodDetailsReq 获取Pod详情请求
export interface GetPodDetailsReq {
  cluster_id: number; // 集群ID
  namespace: string; // 命名空间
  name: string; // Pod名称
}

// GetPodYamlReq 获取Pod YAML请求
export interface GetPodYamlReq {
  cluster_id: number; // 集群ID
  namespace: string; // 命名空间
  name: string; // Pod名称
}

// CreatePodReq 创建Pod请求
export interface CreatePodReq {
  cluster_id: number; // 集群ID
  name: string; // Pod名称
  namespace: string; // 命名空间
  labels?: Record<string, string>; // 标签
  annotations?: Record<string, string>; // 注解
  containers: CreatePodContainer[]; // 容器列表
  init_containers?: CreatePodContainer[]; // 初始化容器列表
  restart_policy?: string; // 重启策略
  node_selector?: Record<string, string>; // 节点选择器
  tolerations?: any[]; // 容忍度
  affinity?: any; // 亲和性
  volumes?: any[]; // 卷
  host_network?: boolean; // 是否使用主机网络
  host_pid?: boolean; // 是否使用主机PID
  dns_policy?: string; // DNS策略
  service_account?: string; // 服务账户
}

// CreatePodContainer 创建Pod容器配置
export interface CreatePodContainer {
  name: string; // 容器名称
  image: string; // 容器镜像
  command?: string[]; // 启动命令
  args?: string[]; // 启动参数
  envs?: PodEnvVar[]; // 环境变量
  ports?: PodContainerPort[]; // 容器端口
  resources?: PodResourceRequirements; // 资源要求
  volume_mounts?: PodVolumeMount[]; // 卷挂载
  liveness_probe?: PodProbe; // 存活探测
  readiness_probe?: PodProbe; // 就绪探测
  image_pull_policy?: string; // 镜像拉取策略
  working_dir?: string; // 工作目录
  security_context?: any; // 安全上下文
}

// CreatePodByYamlReq 通过YAML创建Pod请求
export interface CreatePodByYamlReq {
  cluster_id: number; // 集群ID
  yaml: string; // YAML内容
}

// UpdatePodReq 更新Pod请求
export interface UpdatePodReq {
  cluster_id: number; // 集群ID
  name: string; // Pod名称
  namespace: string; // 命名空间
  labels?: Record<string, string>; // 标签
  annotations?: Record<string, string>; // 注解
}

// UpdatePodByYamlReq 通过YAML更新Pod请求
export interface UpdatePodByYamlReq {
  cluster_id: number; // 集群ID
  namespace: string; // 命名空间
  name: string; // Pod名称
  yaml: string; // YAML内容
}

// DeletePodReq 删除Pod请求
export interface DeletePodReq {
  cluster_id: number; // 集群ID
  namespace: string; // 命名空间
  name: string; // Pod名称
  grace_period_seconds?: number; // 优雅删除时间（秒）
  force?: boolean; // 是否强制删除
}

// GetPodsByNodeReq 根据节点获取Pod列表请求
export interface GetPodsByNodeReq {
  cluster_id: number; // 集群ID
  node_name: string; // 节点名称
}

// GetPodContainersReq 获取Pod容器列表请求
export interface GetPodContainersReq {
  cluster_id: number; // 集群ID
  namespace: string; // 命名空间
  pod_name: string; // Pod名称
}

// GetPodLogsReq Pod日志查询请求
export interface GetPodLogsReq {
  cluster_id: number; // 集群ID
  namespace: string; // 命名空间
  pod_name: string; // Pod名称
  container: string; // 容器名称
  follow?: boolean; // 是否持续跟踪
  previous?: boolean; // 是否获取前一个容器的日志
  since_seconds?: number; // 获取多少秒内的日志
  since_time?: string; // 从指定时间开始获取日志
  timestamps?: boolean; // 是否显示时间戳
  tail_lines?: number; // 获取最后几行日志
  limit_bytes?: number; // 限制日志字节数
}

// PodExecReq Pod执行命令请求
export interface PodExecReq {
  cluster_id: number; // 集群ID
  namespace: string; // 命名空间
  pod_name: string; // Pod名称
  container: string; // 容器名称
  shell?: string; // shell类型
}

// PodPortForwardReq Pod端口转发请求
export interface PodPortForwardReq {
  cluster_id: number; // 集群ID
  namespace: string; // 命名空间
  pod_name: string; // Pod名称
  ports: PodPortForwardPort[]; // 端口转发配置
}

// PodPortForwardPort 端口转发端口配置
export interface PodPortForwardPort {
  local_port: number; // 本地端口
  remote_port: number; // 远程端口
}

// PodFileUploadReq Pod文件上传请求
export interface PodFileUploadReq {
  cluster_id: number; // 集群ID
  namespace: string; // 命名空间
  pod_name: string; // Pod名称
  container: string; // 容器名称
  file_path: string; // 文件路径
}

// PodFileDownloadReq Pod文件下载请求
export interface PodFileDownloadReq {
  cluster_id: number; // 集群ID
  namespace: string; // 命名空间
  pod_name: string; // Pod名称
  container: string; // 容器名称
  file_path: string; // 文件路径
}

// 获取Pod列表
export const getK8sPodList = (params: GetPodListReq) => {
  return requestClient.get(`/k8s/pod/${params.cluster_id}/list`, { params });
};

// 获取Pod详情
export const getK8sPodDetails = (params: GetPodDetailsReq) => {
  return requestClient.get(`/k8s/pod/${params.cluster_id}/${params.namespace}/${params.name}/detail`);
};

// 获取Pod YAML
export const getK8sPodYaml = (params: GetPodYamlReq) => {
  return requestClient.get(`/k8s/pod/${params.cluster_id}/${params.namespace}/${params.name}/detail/yaml`);
};

// 创建Pod
export const createK8sPod = (data: CreatePodReq) => {
  return requestClient.post(`/k8s/pod/${data.cluster_id}/create`, data);
};

// 通过YAML创建Pod
export const createK8sPodByYaml = (data: CreatePodByYamlReq) => {
  return requestClient.post(`/k8s/pod/${data.cluster_id}/create/yaml`, data);
};

// 更新Pod
export const updateK8sPod = (data: UpdatePodReq) => {
  return requestClient.put(`/k8s/pod/${data.cluster_id}/${data.namespace}/${data.name}/update`, data);
};

// 通过YAML更新Pod
export const updateK8sPodByYaml = (data: UpdatePodByYamlReq) => {
  return requestClient.put(`/k8s/pod/${data.cluster_id}/${data.namespace}/${data.name}/update/yaml`, data);
};

// 删除Pod
export const deleteK8sPod = (params: DeletePodReq) => {
  return requestClient.delete(`/k8s/pod/${params.cluster_id}/${params.namespace}/${params.name}/delete`, { params });
};

// 根据节点获取Pod列表
export const getK8sPodsByNode = (params: GetPodsByNodeReq) => {
  return requestClient.get(`/k8s/pod/${params.cluster_id}/node/${params.node_name}/pods`);
};

// 获取Pod容器列表
export const getK8sPodContainers = (params: GetPodContainersReq) => {
  return requestClient.get(`/k8s/pod/${params.cluster_id}/${params.namespace}/${params.pod_name}/containers`);
};


// 获取Pod日志 - 简单版本，不包含复杂的SSE逻辑
export const getK8sPodLogs = (params: GetPodLogsReq) => {
  const queryParams = new URLSearchParams();
  if (params.follow !== undefined) queryParams.append('follow', params.follow.toString());
  if (params.previous !== undefined) queryParams.append('previous', params.previous.toString());
  if (params.since_seconds !== undefined) queryParams.append('since_seconds', params.since_seconds.toString());
  if (params.since_time) queryParams.append('since_time', params.since_time);
  if (params.timestamps !== undefined) queryParams.append('timestamps', params.timestamps.toString());
  if (params.tail_lines !== undefined) queryParams.append('tail_lines', params.tail_lines.toString());
  if (params.limit_bytes !== undefined) queryParams.append('limit_bytes', params.limit_bytes.toString());
  
  return requestClient.get(`/k8s/pod/${params.cluster_id}/${params.namespace}/${params.pod_name}/containers/${params.container}/logs`, { params: queryParams });
};

// Pod执行命令 - WebSocket连接，简化版本
export const createK8sPodWebSocketConnection = (params: PodExecReq) => {
  return requestClient.get(`/k8s/pod/${params.cluster_id}/${params.namespace}/${params.pod_name}/containers/${params.container}/exec`, { params });
};

// 保留原有的简单版本API作为备用
export const execK8sPod = (params: PodExecReq) => {
  const { cluster_id, namespace, pod_name, container, shell } = params;
  return requestClient.post(`/k8s/pod/${cluster_id}/${namespace}/${pod_name}/containers/${container}/exec`, {
    shell
  });
};

// Pod端口转发
export const forwardK8sPodPort = (data: PodPortForwardReq) => {
  return requestClient.post(`/k8s/pod/${data.cluster_id}/${data.namespace}/${data.pod_name}/port-forward`, data);
};

// Pod文件上传
export const uploadK8sPodFile = (data: PodFileUploadReq, file: File) => {
  const formData = new FormData();
  formData.append('file', file);
  // 将目标路径作为表单字段传递
  formData.append('file_path', data.file_path);
  
  return requestClient.post(
    `/k8s/pod/${data.cluster_id}/${data.namespace}/${data.pod_name}/containers/${data.container}/files/upload`, 
    formData, 
    {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    }
  );
};

// Pod文件下载
export const downloadK8sPodFile = (params: PodFileDownloadReq) => {
  // 根据后端API路径构建URL: /api/k8s/pod/:cluster_id/:namespace/:name/containers/:container/files/download
  const url = `/k8s/pod/${params.cluster_id}/${params.namespace}/${params.pod_name}/containers/${params.container}/files/download`;
  
  // 构建查询参数
  const queryParams = new URLSearchParams();
  queryParams.append('file_path', params.file_path);
  
  const config = {
    responseType: 'blob' as const,
    params: queryParams,
    timeout: 300000, // 5分钟超时
    headers: {
      'Accept': 'application/octet-stream, */*',
    },
  };
  
  return requestClient.get(url, config);
};
