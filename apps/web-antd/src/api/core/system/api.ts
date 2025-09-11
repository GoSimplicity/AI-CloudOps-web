import { requestClient } from '#/api/request';

  // API管理相关接口
  export interface ListApisReq {
    page: number; // 页码
    size: number; // 每页数量
    search?: string; // 搜索关键词
  }

  export interface CreateApiReq {
    name: string; // API名称
    path: string; // API路径
    method: number; // 请求方法
    description?: string; // API描述
    version?: string; // API版本
    category?: number; // API分类
    is_public: 1 | 2; // 是否公开
  }

  export interface UpdateApiReq {
    id: number; // API ID
    name: string; // API名称
    path: string; // API路径
    method: number; // 请求方法
    description?: string; // API描述
    version?: string; // API版本
    category?: number; // API分类
    is_public: 1 | 2; // 是否公开
  }

  export interface DeleteApiReq {
    id: number; // API ID
  }


  // API管理
export async function listApisApi(data: ListApisReq) {
    return requestClient.get('/apis/list', { params: data });
  }
  
export async function createApiApi(data: CreateApiReq) {
  return requestClient.post('/apis/create', data);
}

export async function updateApiApi(data: UpdateApiReq) {
  return requestClient.put(`/apis/update/${data.id}`, data);
}

export async function deleteApiApi(id: number) {
  return requestClient.delete(`/apis/delete/${id}`);
}

export async function getApiDetailApi(id: number) {
  return requestClient.get(`/apis/detail/${id}`);
}
export async function getApiStatisticsApi() {
  return requestClient.get('/apis/statistics');
}
