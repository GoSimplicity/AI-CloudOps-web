import { ref, computed } from 'vue';
import { message, Modal } from 'ant-design-vue';
import { h } from 'vue';
import {
  getServiceListApi,
  getServiceDetailsApi,
  getServiceYamlApi,
  createServiceApi,
  updateServiceApi,
  deleteServiceApi,
  getServiceEndpointsApi,
  getServiceMetricsApi,
  getServiceEventsApi,
} from '../../../api';
import type {
  K8sService,
  GetServiceListReq,
  CreateServiceReq,
  UpdateServiceReq,
  ServiceEndpoint,
  K8sServiceMetrics,
  K8sServiceEvent,
  K8sYaml,
} from '../../../api';

export function useServiceManagement() {
  // 基础状态
  const loading = ref(false);
  const services = ref<K8sService[]>([]);
  const searchText = ref('');
  const filterServiceType = ref<string | undefined>(undefined);
  const selectedRows = ref<K8sService[]>([]);
  const currentPage = ref(1);
  const pageSize = ref(12);
  const totalItems = ref(0);
  
  // 模态框状态
  const viewYamlModalVisible = ref(false);
  const endpointsModalVisible = ref(false);
  const metricsModalVisible = ref(false);
  const eventsModalVisible = ref(false);
  const detailsModalVisible = ref(false);
  
  // 当前操作的服务数据
  const currentService = ref<K8sService | null>(null);
  const serviceYaml = ref('');
  const serviceEndpoints = ref<ServiceEndpoint[]>([]);
  const serviceMetrics = ref<K8sServiceMetrics | null>(null);
  const serviceEvents = ref<K8sServiceEvent[]>([]);
  const serviceDetails = ref<K8sService | null>(null);
  
  // 各种loading状态
  const endpointsLoading = ref(false);
  const metricsLoading = ref(false);
  const eventsLoading = ref(false);
  const detailsLoading = ref(false);

  // 获取Service列表
  const getServices = async (clusterId: number, namespace: string, page = currentPage.value, size = pageSize.value) => {
    if (!clusterId || !namespace) {
      message.warning('请先选择集群和命名空间');
      return;
    }

    loading.value = true;
    try {
      const params: GetServiceListReq = {
        page,
        size,
        cluster_id: clusterId,
        namespace,
      };

      if (searchText.value && searchText.value.trim()) {
        params.search = searchText.value.trim();
      }

      if (filterServiceType.value) {
        params.type = filterServiceType.value;
      }

      const res = await getServiceListApi(params);

      let serviceItems: K8sService[] = [];
      let responseTotal = 0;

      if (res) {
        if (Array.isArray(res)) {
          serviceItems = res;
          responseTotal = res.length;
        } else {
          const resAny = res as any;
          if (resAny.items && Array.isArray(resAny.items)) {
            serviceItems = resAny.items;
            responseTotal = resAny.total || resAny.items.length;
          } else if (resAny.data) {
            if (Array.isArray(resAny.data)) {
              serviceItems = resAny.data;
              responseTotal = resAny.total || resAny.data.length;
            } else if (resAny.data.items && Array.isArray(resAny.data.items)) {
              serviceItems = resAny.data.items;
              responseTotal = resAny.data.total || resAny.data.items.length;
            }
          }
        }
      }

      services.value = serviceItems;
      totalItems.value = responseTotal;
      currentPage.value = page;
      selectedRows.value = [];
    } catch (error: any) {
      console.error('获取Service列表失败:', error);
      message.error(error.message || '获取Service列表失败');
      services.value = [];
      totalItems.value = 0;
    } finally {
      loading.value = false;
    }
  };

  // 查看Service YAML
  const viewServiceYaml = async (clusterId: number, service: K8sService) => {
    try {
      currentService.value = service;
      const res = await getServiceYamlApi(clusterId, service.namespace, service.name);

      if (res && typeof res === 'object' && 'yaml' in res) {
        serviceYaml.value = (res as K8sYaml).yaml;
      } else if (typeof res === 'string') {
        serviceYaml.value = res;
      } else {
        serviceYaml.value = JSON.stringify(res, null, 2);
      }

      viewYamlModalVisible.value = true;
    } catch (error: any) {
      console.error('获取Service YAML失败:', error);
      message.error(error.message || '获取Service YAML失败');
    }
  };

  // 查看端点
  const viewEndpoints = async (clusterId: number, service: K8sService) => {
    try {
      currentService.value = service;
      endpointsLoading.value = true;
      const endpoints = await getServiceEndpointsApi(clusterId, service.namespace, service.name);
      serviceEndpoints.value = endpoints || [];
      endpointsModalVisible.value = true;
    } catch (error: any) {
      console.error('获取端点信息失败:', error);
      message.error(error.message || '获取端点信息失败');
    } finally {
      endpointsLoading.value = false;
    }
  };

  // 查看Service指标
  const viewServiceMetrics = async (clusterId: number, service: K8sService) => {
    try {
      currentService.value = service;
      metricsLoading.value = true;
      const metrics = await getServiceMetricsApi(clusterId, service.namespace, service.name);
      serviceMetrics.value = metrics || null;
      metricsModalVisible.value = true;
    } catch (error: any) {
      console.error('获取Service指标失败:', error);
      message.error(error.message || '获取Service指标失败');
    } finally {
      metricsLoading.value = false;
    }
  };

  // 查看Service事件
  const viewServiceEvents = async (clusterId: number, service: K8sService) => {
    try {
      currentService.value = service;
      eventsLoading.value = true;
      const events = await getServiceEventsApi(clusterId, service.namespace, service.name);
      serviceEvents.value = events || [];
      eventsModalVisible.value = true;
    } catch (error: any) {
      console.error('获取Service事件失败:', error);
      message.error(error.message || '获取Service事件失败');
    } finally {
      eventsLoading.value = false;
    }
  };

  // 查看Service详情
  const viewServiceDetails = async (clusterId: number, service: K8sService) => {
    try {
      currentService.value = service;
      detailsLoading.value = true;
      const details = await getServiceDetailsApi(clusterId, service.namespace, service.name);
      serviceDetails.value = details || null;
      detailsModalVisible.value = true;
    } catch (error: any) {
      console.error('获取Service详情失败:', error);
      message.error(error.message || '获取Service详情失败');
    } finally {
      detailsLoading.value = false;
    }
  };

  // 删除Service
  const deleteService = async (clusterId: number, service: K8sService) => {
    try {
      await deleteServiceApi(clusterId, service.namespace, service.name);
      message.success('Service删除成功');
      return true;
    } catch (error: any) {
      console.error('删除Service失败:', error);
      message.error(error.message || '删除Service失败');
      return false;
    }
  };

  // 批量删除Service
  const batchDeleteServices = (clusterId: number, onSuccess: () => void) => {
    if (!selectedRows.value.length) {
      message.warning('请先选择要删除的Service');
      return;
    }

    Modal.confirm({
      title: `确定要删除选中的 ${selectedRows.value.length} 个Service吗?`,
      content: h('div', [
        h('p', { style: 'margin-bottom: 8px; color: #ff4d4f; font-weight: 500;' }, '⚠️ 危险操作警告'),
        h('p', { style: 'margin-bottom: 8px;' }, '删除Service将会：'),
        h('ul', { style: 'margin: 8px 0; padding-left: 20px; color: #666;' }, [
          h('li', '断开所有到该Service的网络连接'),
          h('li', '移除服务发现和负载均衡配置'),
          h('li', '影响依赖此Service的应用程序')
        ]),
        h('p', { style: 'margin-top: 12px; font-weight: 500; color: #ff4d4f;' }, '此操作不可撤销，请谨慎操作！')
      ]),
      okText: '我已了解风险，确认删除',
      cancelText: '取消操作',
      okType: 'danger',
      width: 500,
      async onOk() {
        try {
          loading.value = true;
          let successCount = 0;
          let errorCount = 0;
          const errors: string[] = [];

          for (const service of selectedRows.value) {
            try {
              await deleteServiceApi(clusterId, service.namespace, service.name);
              successCount++;
            } catch (error: any) {
              errorCount++;
              errors.push(`${service.name}: ${error.message || '删除失败'}`);
            }
          }

          if (successCount > 0 && errorCount === 0) {
            message.success(`成功删除 ${successCount} 个Service`);
          } else if (successCount > 0 && errorCount > 0) {
            message.warning(`成功删除 ${successCount} 个，失败 ${errorCount} 个Service`);
            console.error('删除失败的Service:', errors);
          } else {
            message.error('批量删除失败');
            console.error('删除错误:', errors);
          }

          selectedRows.value = [];
          onSuccess();
        } catch (error: any) {
          message.error(error.message || '批量删除操作失败');
        } finally {
          loading.value = false;
        }
      }
    });
  };

  // 计算属性：过滤后的Service列表
  const filteredServices = computed(() => {
    const searchValue = searchText.value.toLowerCase().trim();
    let filtered = services.value || [];

    if (searchValue) {
      filtered = filtered.filter(service =>
        service?.name?.toLowerCase()?.includes(searchValue) || false
      );
    }

    if (filterServiceType.value) {
      filtered = filtered.filter(service => service?.type === filterServiceType.value);
    }

    return filtered;
  });

  // 计算属性：运行中服务数量
  const runningServices = computed(() =>
    services.value.filter(service => service.endpoints && service.endpoints.length > 0).length
  );

  // 服务类型分布统计
  const serviceTypeDistribution = computed(() => {
    const distribution: Record<string, number> = {};
    services.value.forEach(service => {
      const type = service.type || 'Unknown';
      if (!distribution[type]) {
        distribution[type] = 0;
      }
      distribution[type]++;
    });
    return distribution;
  });

  // 获取服务类型颜色
  const getServiceTypeColor = (type: string) => {
    const typeColors: Record<string, string> = {
      ClusterIP: 'blue',
      NodePort: 'green',
      LoadBalancer: 'orange',
      ExternalName: 'purple',
    };
    return typeColors[type] || 'default';
  };

  // 表格选择配置
  const rowSelection = {
    onChange: (_: string[], selectedRowsData: K8sService[]) => {
      selectedRows.value = selectedRowsData;
    },
    getCheckboxProps: (_: K8sService) => ({
      disabled: false,
    }),
  };

  // 关闭模态框方法
  const closeYamlModal = () => {
    viewYamlModalVisible.value = false;
    currentService.value = null;
    serviceYaml.value = '';
  };

  const closeEndpointsModal = () => {
    endpointsModalVisible.value = false;
    currentService.value = null;
    serviceEndpoints.value = [];
  };

  const closeMetricsModal = () => {
    metricsModalVisible.value = false;
    currentService.value = null;
    serviceMetrics.value = null;
  };

  const closeEventsModal = () => {
    eventsModalVisible.value = false;
    currentService.value = null;
    serviceEvents.value = [];
  };

  const closeDetailsModal = () => {
    detailsModalVisible.value = false;
    currentService.value = null;
    serviceDetails.value = null;
  };

  return {
    // 状态
    loading,
    services,
    searchText,
    filterServiceType,
    selectedRows,
    currentPage,
    pageSize,
    totalItems,
    currentService,
    serviceYaml,
    serviceEndpoints,
    serviceMetrics,
    serviceEvents,
    serviceDetails,
    
    // 模态框状态
    viewYamlModalVisible,
    endpointsModalVisible,
    metricsModalVisible,
    eventsModalVisible,
    detailsModalVisible,
    
    // 加载状态
    endpointsLoading,
    metricsLoading,
    eventsLoading,
    detailsLoading,
    
    // 计算属性
    filteredServices,
    runningServices,
    serviceTypeDistribution,
    
    // 方法
    getServices,
    viewServiceYaml,
    viewEndpoints,
    viewServiceMetrics,
    viewServiceEvents,
    viewServiceDetails,
    deleteService,
    batchDeleteServices,
    getServiceTypeColor,
    rowSelection,
    
    // 模态框关闭方法
    closeYamlModal,
    closeEndpointsModal,
    closeMetricsModal,
    closeEventsModal,
    closeDetailsModal,
  };
}
