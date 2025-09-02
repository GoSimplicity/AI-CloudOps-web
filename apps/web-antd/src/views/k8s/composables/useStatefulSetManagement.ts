import { ref, computed } from 'vue';
import { message, Modal } from 'ant-design-vue';
import { h } from 'vue';
import {
  getStatefulSetListApi,
  getStatefulSetYamlApi,
  deleteStatefulSetApi,
  restartStatefulSetApi,
  createStatefulSetApi,
  updateStatefulSetApi,
  scaleStatefulSetApi,
  getStatefulSetEventsApi,
  getStatefulSetMetricsApi,
  getStatefulSetPodsApi,
} from '../../../api';
import type {
  K8sStatefulSet,
  GetStatefulSetListReq,
  CreateStatefulSetReq,
  UpdateStatefulSetReq,
  ScaleStatefulSetReq,
} from '../../../api';

export function useStatefulSetManagement() {
  // 基础状态
  const loading = ref(false);
  const statefulSets = ref<K8sStatefulSet[]>([]);
  const searchText = ref('');
  const selectedRows = ref<K8sStatefulSet[]>([]);
  const currentPage = ref(1);
  const pageSize = ref(12);
  const totalItems = ref(0);

  // 模态框状态
  const viewYamlModalVisible = ref(false);
  const scaleModalVisible = ref(false);
  const editModalVisible = ref(false);
  const metricsModalVisible = ref(false);
  const eventsModalVisible = ref(false);
  const podsModalVisible = ref(false);
  const createModalVisible = ref(false);

  // 当前操作的StatefulSet数据
  const currentStatefulSet = ref<K8sStatefulSet | null>(null);
  const statefulSetYaml = ref('');
  const statefulSetMetrics = ref<any>(null);
  const statefulSetEvents = ref<any[]>([]);
  const statefulSetPods = ref<any[]>([]);

  // 各种loading状态
  const metricsLoading = ref(false);
  const eventsLoading = ref(false);
  const podsLoading = ref(false);

  // 表单状态
  const scaleForm = ref({ replicas: 1 });
  const editForm = ref<any>({});
  const createForm = ref<CreateStatefulSetReq>({
    cluster_id: 0,
    name: '',
    namespace: 'default',
    replicas: 1,
    images: [''],
    labels: {},
    annotations: {}
  });

  // 获取StatefulSet列表
  const getStatefulSets = async (clusterId: number, namespace: string, page = currentPage.value, size = pageSize.value) => {
    if (!clusterId || !namespace) {
      message.warning('请先选择集群和命名空间');
      return;
    }

    loading.value = true;
    try {
      const params: GetStatefulSetListReq = {
        page,
        size,
        cluster_id: clusterId,
        namespace,
      };

      if (searchText.value && searchText.value.trim()) {
        params.search = searchText.value.trim();
      }

      const res = await getStatefulSetListApi(params);

      let statefulSetItems: K8sStatefulSet[] = [];
      let responseTotal = 0;

      if (res) {
        if (Array.isArray(res)) {
          statefulSetItems = res;
          responseTotal = res.length;
        } else {
          const resAny = res as any;
          if (resAny.items && Array.isArray(resAny.items)) {
            statefulSetItems = resAny.items;
            responseTotal = resAny.total || resAny.items.length;
          } else if (resAny.data) {
            if (Array.isArray(resAny.data)) {
              statefulSetItems = resAny.data;
              responseTotal = resAny.total || resAny.data.length;
            } else if (resAny.data.items && Array.isArray(resAny.data.items)) {
              statefulSetItems = resAny.data.items;
              responseTotal = resAny.data.total || resAny.data.items.length;
            }
          }
        }
      }

      statefulSets.value = statefulSetItems;
      totalItems.value = responseTotal;
      currentPage.value = page;
      selectedRows.value = [];
    } catch (error: any) {
      console.error('获取StatefulSet列表失败:', error);
      message.error(error.message || '获取StatefulSet列表失败');
      statefulSets.value = [];
      totalItems.value = 0;
    } finally {
      loading.value = false;
    }
  };

  // 查看StatefulSet YAML
  const viewStatefulSetYaml = async (clusterId: number, statefulSet: K8sStatefulSet) => {
    try {
      currentStatefulSet.value = statefulSet;
      const res = await getStatefulSetYamlApi(clusterId, statefulSet.namespace, statefulSet.name);

      if (res && typeof res === 'object' && 'yaml' in res) {
        statefulSetYaml.value = (res as any).yaml;
      } else if (typeof res === 'string') {
        statefulSetYaml.value = res;
      } else {
        statefulSetYaml.value = JSON.stringify(res, null, 2);
      }

      viewYamlModalVisible.value = true;
    } catch (error: any) {
      console.error('获取StatefulSet YAML失败:', error);
      message.error(error.message || '获取StatefulSet YAML失败');
    }
  };

  // 查看指标
  const viewStatefulSetMetrics = async (clusterId: number, statefulSet: K8sStatefulSet) => {
    currentStatefulSet.value = statefulSet;
    metricsLoading.value = true;
    metricsModalVisible.value = true;

    try {
      const metrics = await getStatefulSetMetricsApi(clusterId, statefulSet.namespace, statefulSet.name);
      statefulSetMetrics.value = metrics;
    } catch (error: any) {
      console.error('获取StatefulSet指标失败:', error);
      message.error(error.message || '获取StatefulSet指标失败');
      statefulSetMetrics.value = null;
    } finally {
      metricsLoading.value = false;
    }
  };

  // 查看事件
  const viewStatefulSetEvents = async (clusterId: number, statefulSet: K8sStatefulSet) => {
    currentStatefulSet.value = statefulSet;
    eventsLoading.value = true;
    eventsModalVisible.value = true;

    try {
      const events = await getStatefulSetEventsApi(clusterId, statefulSet.namespace, statefulSet.name);
      statefulSetEvents.value = events.items || events || [];
    } catch (error: any) {
      console.error('获取StatefulSet事件失败:', error);
      message.error(error.message || '获取StatefulSet事件失败');
      statefulSetEvents.value = [];
    } finally {
      eventsLoading.value = false;
    }
  };

  // 查看Pod
  const viewStatefulSetPods = async (clusterId: number, statefulSet: K8sStatefulSet) => {
    currentStatefulSet.value = statefulSet;
    podsLoading.value = true;
    podsModalVisible.value = true;

    try {
      const pods = await getStatefulSetPodsApi(clusterId, statefulSet.namespace, statefulSet.name);
      statefulSetPods.value = pods.items || pods || [];
    } catch (error: any) {
      console.error('获取StatefulSet Pod失败:', error);
      message.error(error.message || '获取StatefulSet Pod失败');
      statefulSetPods.value = [];
    } finally {
      podsLoading.value = false;
    }
  };

  // 删除StatefulSet
  const deleteStatefulSet = async (clusterId: number, statefulSet: K8sStatefulSet) => {
    const success = await new Promise<boolean>((resolve) => {
      Modal.confirm({
        title: '确定要删除该StatefulSet吗?',
        content: h('div', [
          h('p', { style: 'margin-bottom: 8px; color: #ff4d4f; font-weight: 500;' }, '⚠️ 危险操作警告'),
          h('p', { style: 'margin-bottom: 8px;' }, `StatefulSet: ${statefulSet.name}`),
          h('p', { style: 'margin-bottom: 8px;' }, `命名空间: ${statefulSet.namespace}`),
          h('p', { style: 'margin-top: 12px; font-weight: 500; color: #ff4d4f;' }, '此操作不可撤销，请谨慎操作！')
        ]),
        okText: '确认删除',
        cancelText: '取消',
        okType: 'danger',
        async onOk() {
          try {
            await deleteStatefulSetApi(clusterId, statefulSet.namespace, statefulSet.name);
            message.success('StatefulSet删除成功');
            resolve(true);
          } catch (error: any) {
            console.error('删除StatefulSet失败:', error);
            message.error(error.message || '删除StatefulSet失败');
            resolve(false);
          }
        },
        onCancel() {
          resolve(false);
        }
      });
    });

    return success;
  };

  // 批量删除StatefulSet
  const batchDeleteStatefulSets = async (clusterId: number, refreshCallback?: () => void) => {
    if (!selectedRows.value.length) {
      message.warning('请先选择要删除的StatefulSet');
      return;
    }

    Modal.confirm({
      title: `确定要删除选中的 ${selectedRows.value.length} 个StatefulSet吗?`,
      content: h('div', [
        h('p', { style: 'margin-bottom: 8px; color: #ff4d4f; font-weight: 500;' }, '⚠️ 危险操作警告'),
        h('p', { style: 'margin-bottom: 8px;' }, '删除StatefulSet将会：'),
        h('ul', { style: 'margin: 8px 0; padding-left: 20px; color: #666;' }, [
          h('li', '停止所有相关的Pod实例'),
          h('li', '删除持久化存储'),
          h('li', '中断有状态应用的运行'),
          h('li', '影响依赖此StatefulSet的服务')
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

          for (const statefulSet of selectedRows.value) {
            try {
              await deleteStatefulSetApi(clusterId, statefulSet.namespace, statefulSet.name);
              successCount++;
            } catch (error: any) {
              errorCount++;
              errors.push(`${statefulSet.name}: ${error.message || '删除失败'}`);
            }
          }

          if (successCount > 0 && errorCount === 0) {
            message.success(`成功删除 ${successCount} 个StatefulSet`);
          } else if (successCount > 0 && errorCount > 0) {
            message.warning(`成功删除 ${successCount} 个，失败 ${errorCount} 个StatefulSet`);
          } else {
            message.error('批量删除失败');
          }

          selectedRows.value = [];
          refreshCallback?.();
        } catch (error: any) {
          console.error('批量删除操作失败:', error);
          message.error(error.message || '批量删除操作失败');
        } finally {
          loading.value = false;
        }
      }
    });
  };

  // 重启StatefulSet
  const restartStatefulSet = async (clusterId: number, statefulSet: K8sStatefulSet) => {
    const success = await new Promise<boolean>((resolve) => {
      Modal.confirm({
        title: '确定要重启该StatefulSet吗?',
        content: `StatefulSet: ${statefulSet.name}`,
        okText: '确定',
        cancelText: '取消',
        async onOk() {
          try {
            await restartStatefulSetApi(clusterId, statefulSet.namespace, statefulSet.name);
            message.success('StatefulSet重启成功');
            resolve(true);
          } catch (error: any) {
            console.error('重启StatefulSet失败:', error);
            message.error(error.message || '重启StatefulSet失败');
            resolve(false);
          }
        },
        onCancel() {
          resolve(false);
        }
      });
    });

    return success;
  };

  // 扩缩容
  const scaleStatefulSet = async (clusterId: number, statefulSet: K8sStatefulSet, replicas: number) => {
    try {
      loading.value = true;
      await scaleStatefulSetApi(clusterId, statefulSet.namespace, statefulSet.name, {
        cluster_id: clusterId,
        namespace: statefulSet.namespace,
        name: statefulSet.name,
        replicas
      });
      message.success('扩缩容操作成功');
      return true;
    } catch (error: any) {
      console.error('扩缩容操作失败:', error);
      message.error(error.message || '扩缩容操作失败');
      return false;
    } finally {
      loading.value = false;
    }
  };

  // 创建StatefulSet
  const createStatefulSet = async (createData: CreateStatefulSetReq) => {
    if (!createData.name.trim()) {
      message.error('请输入StatefulSet名称');
      return false;
    }
    if (!createData.namespace) {
      message.error('请选择命名空间');
      return false;
    }
    if (!createData.images[0]?.trim()) {
      message.error('请输入容器镜像');
      return false;
    }

    loading.value = true;
    try {
      await createStatefulSetApi(createData);
      message.success('StatefulSet创建成功');
      return true;
    } catch (error: any) {
      console.error('创建StatefulSet失败:', error);
      message.error(error.message || '创建StatefulSet失败');
      return false;
    } finally {
      loading.value = false;
    }
  };

  // 更新StatefulSet
  const updateStatefulSet = async (clusterId: number, statefulSet: K8sStatefulSet, updateData: any) => {
    loading.value = true;
    try {
      await updateStatefulSetApi(clusterId, statefulSet.namespace, statefulSet.name, updateData);
      message.success('StatefulSet更新成功');
      return true;
    } catch (error: any) {
      console.error('更新StatefulSet失败:', error);
      message.error(error.message || '更新StatefulSet失败');
      return false;
    } finally {
      loading.value = false;
    }
  };

  // 工具函数
  const getStatusText = (statefulSet: K8sStatefulSet) => {
    return `${statefulSet.ready_replicas || 0}/${statefulSet.replicas || 0} 副本`;
  };

  const getStatusColor = (statefulSet: K8sStatefulSet) => {
    if (!statefulSet.replicas) return 'default';
    const ready = statefulSet.ready_replicas || 0;
    const total = statefulSet.replicas || 0;
    
    if (ready === 0) return 'error';
    if (ready < total) return 'warning';
    return 'success';
  };

  const getStatusPercent = (statefulSet: K8sStatefulSet) => {
    if (!statefulSet.replicas) return 0;
    const ready = statefulSet.ready_replicas || 0;
    const total = statefulSet.replicas || 0;
    
    return Math.round((ready / total) * 100);
  };

  const getPodStatusColor = (status: string) => {
    switch (status) {
      case 'Running':
        return 'green';
      case 'Pending':
        return 'orange';
      case 'Failed':
        return 'red';
      case 'Succeeded':
        return 'blue';
      default:
        return 'default';
    }
  };

  // 表格选择配置
  const rowSelection = {
    onChange: (_: string[], selectedRowsData: K8sStatefulSet[]) => {
      selectedRows.value = selectedRowsData;
    },
    getCheckboxProps: () => ({
      disabled: false,
    }),
  };

  // 计算属性
  const filteredStatefulSets = computed(() => {
    const searchValue = searchText.value.toLowerCase().trim();
    if (!searchValue) return statefulSets.value;
    return statefulSets.value.filter(sts => 
      sts.name.toLowerCase().includes(searchValue) || 
      (sts.images && sts.images.some(img => img.toLowerCase().includes(searchValue)))
    );
  });

  const healthyStatefulSets = computed(() => 
    statefulSets.value.filter(sts => {
      const ready = sts.ready_replicas || 0;
      const total = sts.replicas || 0;
      return total > 0 && ready === total;
    }).length
  );

  const problemStatefulSets = computed(() => 
    statefulSets.value.filter(sts => {
      const ready = sts.ready_replicas || 0;
      const total = sts.replicas || 0;
      return total > 0 && ready < total;
    }).length
  );

  // 关闭模态框的方法
  const closeYamlModal = () => {
    viewYamlModalVisible.value = false;
    currentStatefulSet.value = null;
    statefulSetYaml.value = '';
  };

  const closeScaleModal = () => {
    scaleModalVisible.value = false;
  };

  const closeEditModal = () => {
    editModalVisible.value = false;
    editForm.value = {};
  };

  const closeMetricsModal = () => {
    metricsModalVisible.value = false;
    statefulSetMetrics.value = null;
  };

  const closeEventsModal = () => {
    eventsModalVisible.value = false;
    statefulSetEvents.value = [];
  };

  const closePodsModal = () => {
    podsModalVisible.value = false;
    statefulSetPods.value = [];
  };

  const closeCreateModal = () => {
    createModalVisible.value = false;
    createForm.value = {
      cluster_id: 0,
      name: '',
      namespace: 'default',
      replicas: 1,
      images: [''],
      labels: {},
      annotations: {}
    };
  };

  return {
    // 状态
    loading,
    statefulSets,
    searchText,
    selectedRows,
    currentPage,
    pageSize,
    totalItems,
    currentStatefulSet,
    statefulSetYaml,
    statefulSetMetrics,
    statefulSetEvents,
    statefulSetPods,
    
    // 模态框状态
    viewYamlModalVisible,
    scaleModalVisible,
    editModalVisible,
    metricsModalVisible,
    eventsModalVisible,
    podsModalVisible,
    createModalVisible,
    
    // 加载状态
    metricsLoading,
    eventsLoading,
    podsLoading,
    
    // 表单
    scaleForm,
    editForm,
    createForm,
    
    // 表格配置
    rowSelection,
    
    // 计算属性
    filteredStatefulSets,
    healthyStatefulSets,
    problemStatefulSets,
    
    // 方法
    getStatefulSets,
    viewStatefulSetYaml,
    viewStatefulSetMetrics,
    viewStatefulSetEvents,
    viewStatefulSetPods,
    deleteStatefulSet,
    batchDeleteStatefulSets,
    restartStatefulSet,
    scaleStatefulSet,
    createStatefulSet,
    updateStatefulSet,
    
    // 工具函数
    getStatusText,
    getStatusColor,
    getStatusPercent,
    getPodStatusColor,
    
    // 关闭模态框方法
    closeYamlModal,
    closeScaleModal,
    closeEditModal,
    closeMetricsModal,
    closeEventsModal,
    closePodsModal,
    closeCreateModal,
  };
}
