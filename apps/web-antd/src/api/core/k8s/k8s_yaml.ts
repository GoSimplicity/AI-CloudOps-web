import { requestClient } from '#/api/request';

// K8s YAML 任务相关接口类型定义
export interface K8sYamlTask {
  id?: number;
  name: string;
  user_id: number;
  template_id: number;
  cluster_id: number;
  variables?: string[];
  status?: string;
  apply_result?: string;
  created_at?: string;
  updated_at?: string;
}

export interface K8sYamlTemplate {
  id?: number;
  name: string;
  user_id: number;
  username?: string; // 用户名（后端可能返回）
  content: string;
  cluster_id: number;
  cluster_name?: string; // 集群名称（前端补充）
  created_at?: string;
  updated_at?: string;
}

export interface YamlTemplateCreateReq {
  name: string;
  content: string;
  cluster_id: number;
}

export interface YamlTemplateUpdateReq {
  id: number;
  name: string;
  content: string;
  cluster_id: number;
}

export interface YamlTemplateCheckReq {
  name: string;
  content: string;
  cluster_id: number;
}

export interface YamlTemplateListReq {
  page?: number;
  size?: number;
  cluster_id: number;
  search?: string;
}

export interface YamlTemplateDeleteReq {
  id: number;
  cluster_id: number;
}

export interface YamlTaskCreateReq {
  name: string;
  template_id: number;
  cluster_id: number;
  variables?: string[];
}

export interface YamlTaskListReq {
  page?: number;
  size?: number;
  cluster_id: number;
  template_id?: number;
  status?: string;
  search?: string;
}

export interface YamlTaskExecuteReq {
  id: number;
  dry_run?: boolean;
  cluster_id: number;
}

export interface YamlTaskUpdateReq {
  id: number;
  name: string;
  template_id?: number;
  cluster_id: number;
  variables?: string[];
}

export interface YamlTaskDeleteReq {
  id: number;
  cluster_id: number;
}

export interface YamlTemplateDetailReq {
  id: number;
  cluster_id: number;
}

export interface YamlTaskDetailReq {
  id: number;
  cluster_id: number;
}

// 获取 YAML 模板列表
export const getYamlTemplateList = (params: YamlTemplateListReq) => {
  return requestClient.get(`/k8s/yaml_template/${params.cluster_id}/list`, {
    params,
  });
};

// 创建新的 YAML 模板
export const createYamlTemplate = (data: YamlTemplateCreateReq) => {
  return requestClient.post(`/k8s/yaml_template/${data.cluster_id}/create`, data);
};

// 检查 YAML 模板是否可用
export const checkYamlTemplate = (data: YamlTemplateCheckReq) => {
  return requestClient.post(`/k8s/yaml_template/${data.cluster_id}/check`, data);
};

// 更新指定 ID 的 YAML 模板
export const updateYamlTemplate = (data: YamlTemplateUpdateReq) => {
  return requestClient.post(
    `/k8s/yaml_template/${data.cluster_id}/${data.id}/update`,
    data,
  );
};

// 删除指定 ID 的 YAML 模板
export const deleteYamlTemplate = (params: YamlTemplateDeleteReq) => {
  return requestClient.delete(
    `/k8s/yaml_template/${params.cluster_id}/${params.id}/delete`,
  );
};

// 获取 YAML 模板详情
export const getYamlTemplateDetail = (params: YamlTemplateDetailReq) => {
  return requestClient.get(
    `/k8s/yaml_template/${params.cluster_id}/${params.id}/yaml`,
  );
};

// 获取 YAML 任务详情
export const getYamlTaskDetail = (params: YamlTaskDetailReq) => {
  return requestClient.get(
    `/k8s/yaml_task/${params.cluster_id}/${params.id}/detail`,
  );
};

// 获取 YAML 任务列表
export const getYamlTaskList = (params: YamlTaskListReq) => {
  return requestClient.get(`/k8s/yaml_task/${params.cluster_id}/list`, {
    params,
  });
};

// 创建新的 YAML 任务
export const createYamlTask = (data: YamlTaskCreateReq) => {
  return requestClient.post(`/k8s/yaml_task/${data.cluster_id}/create`, data);
};

// 更新指定 ID 的 YAML 任务
export const updateYamlTask = (data: YamlTaskUpdateReq) => {
  return requestClient.post(
    `/k8s/yaml_task/${data.cluster_id}/${data.id}/update`,
    data,
  );
};

// 应用指定 ID 的 YAML 任务
export const applyYamlTask = (data: YamlTaskExecuteReq) => {
  return requestClient.post(
    `/k8s/yaml_task/${data.cluster_id}/${data.id}/apply`,
    data,
  );
};

// 删除指定 ID 的 YAML 任务
export const deleteYamlTask = (params: YamlTaskDeleteReq) => {
  return requestClient.delete(
    `/k8s/yaml_task/${params.cluster_id}/${params.id}/delete`,
  );
};
