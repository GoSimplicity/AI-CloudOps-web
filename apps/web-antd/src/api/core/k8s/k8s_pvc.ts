import { requestClient } from '#/api/request';

// PVC状态枚举
export enum K8sPVCStatus {
  Pending = 1,     // 等待中
  Bound = 2,       // 已绑定
  Lost = 3,        // 丢失
  Terminating = 4, // 终止中
  Unknown = 5,     // 未知
}

// Kubernetes PersistentVolumeClaim
export interface K8sPVC {
  name: string;                              // PVC名称
  namespace: string;                         // 所属命名空间
  cluster_id: number;                        // 所属集群ID
  uid: string;                               // PVC UID
  capacity: string;                          // 实际容量
  request_storage: string;                   // 请求存储
  access_modes: string[];                    // 访问模式
  storage_class: string;                     // 存储类
  volume_mode: string;                       // 卷模式
  status: K8sPVCStatus;                      // PVC状态
  volume_name: string;                       // 绑定的PV名称
  selector: Record<string, string>;          // 选择器
  labels: Record<string, string>;            // 标签
  annotations: Record<string, string>;       // 注解
  resource_version: string;                  // 资源版本
  created_at: string;                        // 创建时间
  age: string;                               // 年龄
}

// PVC条件
export interface PVCCondition {
  type: string;                              // 条件类型
  status: string;                            // 条件状态
  last_update_time: string;                  // 最后更新时间
  last_transition_time: string;              // 最后转换时间
  reason: string;                            // 原因
  message: string;                           // 消息
}

// PVC规格
export interface PVCSpec {
  request_storage: string;                   // 请求存储
  access_modes: string[];                    // 访问模式
  storage_class: string;                     // 存储类
  volume_mode: string;                       // 卷模式
  volume_name: string;                       // 指定PV名称
  selector: Record<string, string>;          // 选择器
}

// 获取PVC列表请求
export interface GetPVCListReq {
  cluster_id: number;                        // 集群ID
  namespace?: string;                        // 命名空间
  page?: number;                             // 页码
  size?: number;                        // 每页大小
  search?: string;                        // 搜索关键词
  status?: string;                           // PVC状态
  labels?: Record<string, string>;           // 标签
  access_mode?: string;                      // 访问模式
}

// 获取PVC详情请求
export interface GetPVCDetailsReq {
  cluster_id: number;                        // 集群ID
  namespace: string;                         // 命名空间
  name: string;                              // PVC名称
}

// 获取PVC YAML请求
export interface GetPVCYamlReq {
  cluster_id: number;                        // 集群ID
  namespace: string;                         // 命名空间
  name: string;                              // PVC名称
}

// 创建PVC请求
export interface CreatePVCReq {
  cluster_id: number;                        // 集群ID
  namespace: string;                         // 命名空间
  name: string;                              // PVC名称
  labels?: Record<string, string>;           // 标签
  annotations?: Record<string, string>;      // 注解
  spec: PVCSpec;                             // PVC规格
}

// 更新PVC请求
export interface UpdatePVCReq {
  cluster_id: number;                        // 集群ID
  namespace: string;                         // 命名空间
  name: string;                              // PVC名称
  labels?: Record<string, string>;           // 标签
  annotations?: Record<string, string>;      // 注解
  spec: PVCSpec;                             // PVC规格
}

// 通过YAML创建PVC请求
export interface CreatePVCByYamlReq {
  cluster_id: number;                        // 集群ID
  yaml: string;                              // YAML内容
}

// 通过YAML更新PVC请求
export interface UpdatePVCByYamlReq {
  cluster_id: number;                        // 集群ID
  namespace: string;                         // 命名空间
  name: string;                              // PVC名称
  yaml: string;                              // YAML内容
}

// 删除PVC请求
export interface DeletePVCReq {
  cluster_id: number;                        // 集群ID
  namespace: string;                         // 命名空间
  name: string;                              // PVC名称
}

// 扩容PVC请求
export interface ExpandPVCReq {
  cluster_id: number;                        // 集群ID
  namespace: string;                         // 命名空间
  name: string;                              // PVC名称
  new_capacity: string;                      // 新容量
}

// 获取使用PVC的Pod列表请求
export interface GetPVCPodsReq {
  cluster_id: number;                        // 集群ID
  namespace: string;                         // 命名空间
  name: string;                              // PVC名称
}

// API 函数

// 获取PVC列表
export async function getK8sPVCList (params: GetPVCListReq) {
  return requestClient.get(`/k8s/pvc/${params.cluster_id}/list`, { params });
};

// 获取PVC详情
export async function getK8sPVCDetails(params: GetPVCDetailsReq) {
  return requestClient.get<K8sPVC>(`/k8s/pvc/${params.cluster_id}/${params.namespace}/${params.name}/detail`);
}

// 获取PVC YAML
export async function getK8sPVCYaml(params: GetPVCYamlReq) {
  return requestClient.get<{ yaml: string }>(`/k8s/pvc/${params.cluster_id}/${params.namespace}/${params.name}/detail/yaml`);
}

// 创建PVC
export async function createK8sPVC(params: CreatePVCReq) {
  return requestClient.post(`/k8s/pvc/${params.cluster_id}/create`, params);
}

// 通过YAML创建PVC
export async function createK8sPVCByYaml(params: CreatePVCByYamlReq) {
  return requestClient.post(`/k8s/pvc/${params.cluster_id}/create/yaml`, params);
}

// 更新PVC
export async function updateK8sPVC(params: UpdatePVCReq) {
  return requestClient.put(`/k8s/pvc/${params.cluster_id}/${params.namespace}/${params.name}/update`, params);
}

// 通过YAML更新PVC
export async function updateK8sPVCByYaml(params: UpdatePVCByYamlReq) {
  return requestClient.put(`/k8s/pvc/${params.cluster_id}/${params.namespace}/${params.name}/update/yaml`, params);
}

// 删除PVC
export async function deleteK8sPVC(params: DeletePVCReq) {
  return requestClient.delete(`/k8s/pvc/${params.cluster_id}/${params.namespace}/${params.name}/delete`, { data: params });
}

// 扩容PVC
export async function expandK8sPVC(params: ExpandPVCReq) {
  return requestClient.post(`/k8s/pvc/${params.cluster_id}/${params.namespace}/${params.name}/expand`, params);
}

// 获取使用PVC的Pod列表
export async function getK8sPVCPods(params: GetPVCPodsReq) {
  return requestClient.get(`/k8s/pvc/${params.cluster_id}/${params.namespace}/${params.name}/pods`);
}
