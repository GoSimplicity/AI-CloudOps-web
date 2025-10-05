import { requestClient } from '#/api/request';

// PV状态枚举
export enum K8sPVStatus {
  Available = 1, // 可用
  Bound = 2,     // 已绑定
  Released = 3,  // 已释放
  Failed = 4,    // 失败
  Unknown = 5,   // 未知
}

// Kubernetes PersistentVolume
export interface K8sPV {
  name: string;                              // PV名称
  cluster_id: number;                        // 所属集群ID
  uid: string;                               // PV UID
  capacity: string;                          // 存储容量
  access_modes: string[];                    // 访问模式
  reclaim_policy: string;                    // 回收策略
  storage_class: string;                     // 存储类
  volume_mode: string;                       // 卷模式
  status: K8sPVStatus;                       // PV状态
  claim_ref: Record<string, string>;         // 绑定的PVC信息
  volume_source: Record<string, any>;        // 卷源配置
  node_affinity: Record<string, any>;        // 节点亲和性
  labels: Record<string, string>;            // 标签
  annotations: Record<string, string>;       // 注解
  resource_version: string;                  // 资源版本
  created_at: string;                        // 创建时间
  age: string;                               // 存活时长
}

// 获取PV列表请求
export interface GetPVListReq {
  cluster_id: number;                        // 集群ID
  page?: number;                             // 页码
  size?: number;                        // 每页大小
  search?: string;                        // 搜索关键词
  status?: string;                           // PV状态过滤
  access_mode?: string;                      // 访问模式过滤
  volume_type?: string;                      // 卷类型过滤
}

// 获取PV详情请求
export interface GetPVDetailsReq {
  cluster_id: number;                        // 集群ID
  name: string;                              // PV名称
}

// 获取PV YAML请求
export interface GetPVYamlReq {
  cluster_id: number;                        // 集群ID
  name: string;                              // PV名称
}

// 创建PV请求
export interface CreatePVReq {
  cluster_id: number;                              // 集群ID
  name: string;                                    // PV名称
  capacity: string;                                // 存储容量
  access_modes: string[];                          // 访问模式
  reclaim_policy: string;                          // 回收策略
  storage_class: string;                           // 存储类
  volume_mode: string;                             // 卷模式
  volume_source: Record<string, any>;              // 卷源配置
  node_affinity: Record<string, any>;              // 节点亲和性
  labels: Record<string, string>;                  // 标签
  annotations: Record<string, string>;             // 注解
}

// 通过YAML创建PV请求
export interface CreatePVByYamlReq {
  cluster_id: number;                        // 集群ID
  yaml: string;                              // YAML内容
}

// 更新PV请求
export interface UpdatePVReq {
  cluster_id: number;                        // 集群ID
  name: string;                              // PV名称
  capacity?: string;                         // 存储容量
  access_modes?: string[];                   // 访问模式
  reclaim_policy?: string;                   // 回收策略
  storage_class?: string;                    // 存储类
  volume_mode?: string;                      // 卷模式
  volume_source?: Record<string, any>;       // 卷源配置
  node_affinity?: Record<string, any>;       // 节点亲和性
  labels?: Record<string, string>;           // 标签
  annotations?: Record<string, string>;      // 注解
}

// 通过YAML更新PV请求
export interface UpdatePVByYamlReq {
  cluster_id: number;                        // 集群ID
  name: string;                              // PV名称
  yaml: string;                              // YAML内容
}

// 删除PV请求
export interface DeletePVReq {
  cluster_id: number;                        // 集群ID
  name: string;                              // PV名称
  grace_period_seconds?: number;             // 优雅删除时间（秒）
  force?: boolean;                           // 是否强制删除
}

// 回收PV请求
export interface ReclaimPVReq {
  cluster_id: number;                        // 集群ID
  name: string;                              // PV名称
}

// 获取PV列表
export async function getK8sPVList (params: GetPVListReq) {
  return requestClient.get(`/k8s/pv/${params.cluster_id}/list`, { params });
};

// 获取PV详情
export async function getK8sPVDetails(params: GetPVDetailsReq) {
  return requestClient.get<K8sPV>(`/k8s/pv/${params.cluster_id}/${params.name}/detail`);
}

// 获取PV YAML
export async function getK8sPVYaml(params: GetPVYamlReq) {
  return requestClient.get<{ yaml: string }>(`/k8s/pv/${params.cluster_id}/${params.name}/detail/yaml`);
}

// 创建PV
export async function createK8sPV(params: CreatePVReq) {
  return requestClient.post(`/k8s/pv/${params.cluster_id}/create`, params);
}

// 通过YAML创建PV
export async function createK8sPVByYaml(params: CreatePVByYamlReq) {
  return requestClient.post(`/k8s/pv/${params.cluster_id}/create/yaml`, params);
}

// 更新PV
export async function updateK8sPV(params: UpdatePVReq) {
  return requestClient.put(`/k8s/pv/${params.cluster_id}/${params.name}/update`, params);
}

// 通过YAML更新PV
export async function updateK8sPVByYaml(params: UpdatePVByYamlReq) {
  return requestClient.put(`/k8s/pv/${params.cluster_id}/${params.name}/update/yaml`, params);
}

// 删除PV
export async function deleteK8sPV(params: DeletePVReq) {
  return requestClient.delete(`/k8s/pv/${params.cluster_id}/${params.name}/delete`, { data: params });
}

// 回收PV
export async function reclaimK8sPV(params: ReclaimPVReq) {
  return requestClient.post(`/k8s/pv/${params.cluster_id}/${params.name}/reclaim`, params);
}
