import { requestClient } from '#/api/request';

// 获取ServiceAccount列表请求
export interface GetServiceAccountListReq {
  cluster_id: number;
  namespace?: string;
  search?: string;
  page?: number;
  size?: number;
}

// 获取ServiceAccount详情请求
export interface GetServiceAccountDetailsReq {
  cluster_id: number;
  namespace: string;
  name: string;
}

// 获取ServiceAccount YAML请求
export interface GetServiceAccountYamlReq {
  cluster_id: number;
  namespace: string;
  name: string;
}

// 创建ServiceAccount请求
export interface CreateServiceAccountReq {
  cluster_id: number;
  namespace: string;
  name: string;
  labels?: Record<string, string>;
  annotations?: Record<string, string>;
  automount_service_account_token?: boolean;
  image_pull_secrets?: string[];
  secrets?: string[];
}

// 通过YAML创建ServiceAccount请求
export interface CreateServiceAccountByYamlReq {
  cluster_id: number;
  yaml_content: string;
}

// 更新ServiceAccount请求
export interface UpdateServiceAccountReq {
  cluster_id: number;
  namespace: string;
  name: string;
  labels?: Record<string, string>;
  annotations?: Record<string, string>;
  automount_service_account_token?: boolean;
  image_pull_secrets?: string[];
  secrets?: string[];
}

// 通过YAML更新ServiceAccount请求
export interface UpdateServiceAccountByYamlReq {
  cluster_id: number;
  namespace: string;
  name: string;
  yaml_content: string;
}

// 删除ServiceAccount请求
export interface DeleteServiceAccountReq {
  cluster_id: number;
  namespace: string;
  name: string;
}

// 获取ServiceAccount Token请求
export interface GetServiceAccountTokenReq {
  cluster_id: number;
  namespace: string;
  name: string;
}

// 创建ServiceAccount Token请求
export interface CreateServiceAccountTokenReq {
  cluster_id: number;
  namespace: string;
  service_account_name: string;
  expiration_seconds?: number;
}

// ServiceAccount主model
export interface K8sServiceAccount {
  name: string;
  namespace: string;
  cluster_id: number;
  uid: string;
  creation_timestamp: string;
  labels: Record<string, string>;
  annotations: Record<string, string>;
  automount_service_account_token?: boolean;
  image_pull_secrets: string[];
  secrets: string[];
  resource_version: string;
  age: string;
}

// ServiceAccount Token信息响应
export interface ServiceAccountTokenInfo {
  token: string;
  expiration_seconds?: number;
  creation_timestamp: string;
  expiration_time: string;
}

// 获取ServiceAccount列表
export const getServiceAccountList = (params: GetServiceAccountListReq) => {
  return requestClient.get(`/k8s/serviceaccount/${params.cluster_id}/list`, {
    params: {
      namespace: params.namespace,
      search: params.search,
      page: params.page,
      size: params.size,
    },
  });
};

// 获取ServiceAccount详情
export const getServiceAccountDetails = (
  params: GetServiceAccountDetailsReq,
) => {
  return requestClient.get(
    `/k8s/serviceaccount/${params.cluster_id}/${params.namespace}/${params.name}/detail`,
  );
};

// 获取ServiceAccount YAML
export const getServiceAccountYaml = (params: GetServiceAccountYamlReq) => {
  return requestClient.get(
    `/k8s/serviceaccount/${params.cluster_id}/${params.namespace}/${params.name}/detail/yaml`,
  );
};

// 创建ServiceAccount
export const createServiceAccount = (data: CreateServiceAccountReq) => {
  return requestClient.post(
    `/k8s/serviceaccount/${data.cluster_id}/create`,
    data,
  );
};

// 通过YAML创建ServiceAccount
export const createServiceAccountByYaml = (
  data: CreateServiceAccountByYamlReq,
) => {
  return requestClient.post(
    `/k8s/serviceaccount/${data.cluster_id}/create/yaml`,
    data,
  );
};

// 更新ServiceAccount
export const updateServiceAccount = (data: UpdateServiceAccountReq) => {
  return requestClient.put(
    `/k8s/serviceaccount/${data.cluster_id}/${data.namespace}/${data.name}/update`,
    data,
  );
};

// 通过YAML更新ServiceAccount
export const updateServiceAccountByYaml = (
  data: UpdateServiceAccountByYamlReq,
) => {
  return requestClient.put(
    `/k8s/serviceaccount/${data.cluster_id}/${data.namespace}/${data.name}/update/yaml`,
    data,
  );
};

// 删除ServiceAccount
export const deleteServiceAccount = (params: DeleteServiceAccountReq) => {
  return requestClient.delete(
    `/k8s/serviceaccount/${params.cluster_id}/${params.namespace}/${params.name}/delete`,
  );
};

// 获取ServiceAccount Token
export const getServiceAccountToken = (params: GetServiceAccountTokenReq) => {
  return requestClient.get(
    `/k8s/serviceaccount/${params.cluster_id}/${params.namespace}/${params.name}/token`,
  );
};

// 创建ServiceAccount Token
export const createServiceAccountToken = (
  data: CreateServiceAccountTokenReq,
) => {
  return requestClient.post(
    `/k8s/serviceaccount/${data.cluster_id}/${data.namespace}/${data.service_account_name}/token`,
    data,
  );
};
