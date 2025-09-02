import { ref, computed } from 'vue';
import { message, Modal } from 'ant-design-vue';
import { h } from 'vue';
import {
  getDeploymentListApi,
  getDeploymentYamlApi,
  deleteDeploymentApi,
  restartDeploymentApi,
  createDeploymentApi,
  updateDeploymentApi,
  scaleDeploymentApi,
  rollbackDeploymentApi,
  getDeploymentHistoryApi,
  getDeploymentEventsApi,
  getDeploymentMetricsApi,
  getDeploymentPodsApi,
  pauseDeploymentApi,
  resumeDeploymentApi,
} from '../../../api';
import type {
  K8sDeployment,
  GetDeploymentListReq,
  CreateDeploymentReq,
  K8sDeploymentHistory,
  UpdateDeploymentReq,
  ScaleDeploymentReq,
  RollbackDeploymentReq
} from '../../../api';
import { K8sDeploymentStatus } from '../../../api';

export function useDeploymentManagement() {
  // 基础状态
  const loading = ref(false);
  const deployments = ref<K8sDeployment[]>([]);
  const searchText = ref('');
  const selectedRows = ref<K8sDeployment[]>([]);
  const currentPage = ref(1);
  const pageSize = ref(12);
  const totalItems = ref(0);

  // 模态框状态
  const viewYamlModalVisible = ref(false);
  const scaleModalVisible = ref(false);
  const historyModalVisible = ref(false);
  const editModalVisible = ref(false);
  const metricsModalVisible = ref(false);
  const eventsModalVisible = ref(false);
  const podsModalVisible = ref(false);
  const createModalVisible = ref(false);

  // 当前操作的部署数据
  const currentDeployment = ref<K8sDeployment | null>(null);
  const deploymentYaml = ref('');
  const deploymentHistory = ref<K8sDeploymentHistory[]>([]);
  const deploymentMetrics = ref<any>(null);
  const deploymentEvents = ref<any[]>([]);
  const deploymentPods = ref<any[]>([]);

  // 各种loading状态
  const metricsLoading = ref(false);
  const eventsLoading = ref(false);
  const podsLoading = ref(false);
  const pauseResumeLoading = ref(false);

  // 表单状态
  const scaleForm = ref({ replicas: 1 });
  const editForm = ref<any>({});
  const createForm = ref<CreateDeploymentReq>({
    cluster_id: 0,
    name: '',
    namespace: 'default',
    replicas: 1,
    images: [''],
    labels: {},
    annotations: {}
  });

  // 获取Deployment列表
  const getDeployments = async (clusterId: number, namespace: string, page = currentPage.value, size = pageSize.value) => {
    if (!clusterId || !namespace) {
      message.warning('请先选择集群和命名空间');
      return;
    }

    loading.value = true;
    try {
      const params: GetDeploymentListReq = {
        page,
        size,
        cluster_id: clusterId,
        namespace,
      };

      if (searchText.value && searchText.value.trim()) {
        params.search = searchText.value.trim();
      }

      const res = await getDeploymentListApi(params);

      let deploymentItems: K8sDeployment[] = [];
      let responseTotal = 0;

      if (res) {
        if (Array.isArray(res)) {
          deploymentItems = res;
          responseTotal = res.length;
        } else {
          const resAny = res as any;
          if (resAny.items && Array.isArray(resAny.items)) {
            deploymentItems = resAny.items;
            responseTotal = resAny.total || resAny.items.length;
          } else if (resAny.data) {
            if (Array.isArray(resAny.data)) {
              deploymentItems = resAny.data;
              responseTotal = resAny.total || resAny.data.length;
            } else if (resAny.data.items && Array.isArray(resAny.data.items)) {
              deploymentItems = resAny.data.items;
              responseTotal = resAny.data.total || resAny.data.items.length;
            }
          }
        }
      }

      deployments.value = deploymentItems;
      totalItems.value = responseTotal;
      currentPage.value = page;
      selectedRows.value = [];
    } catch (error: any) {
      console.error('获取Deployment列表失败:', error);
      message.error(error.message || '获取Deployment列表失败');
      deployments.value = [];
      totalItems.value = 0;
    } finally {
      loading.value = false;
    }
  };

  // 查看Deployment YAML
  const viewDeploymentYaml = async (clusterId: number, deployment: K8sDeployment) => {
    try {
      currentDeployment.value = deployment;
      const res = await getDeploymentYamlApi(clusterId, deployment.namespace, deployment.name);

      if (res && typeof res === 'object' && 'yaml' in res) {
        deploymentYaml.value = (res as any).yaml;
      } else if (typeof res === 'string') {
        deploymentYaml.value = res;
      } else {
        deploymentYaml.value = JSON.stringify(res, null, 2);
      }

      viewYamlModalVisible.value = true;
    } catch (error: any) {
      console.error('获取Deployment YAML失败:', error);
      message.error(error.message || '获取Deployment YAML失败');
    }
  };

  // 查看指标
  const viewDeploymentMetrics = async (clusterId: number, deployment: K8sDeployment) => {
    currentDeployment.value = deployment;
    metricsLoading.value = true;
    metricsModalVisible.value = true;

    try {
      const metrics = await getDeploymentMetricsApi(clusterId, deployment.namespace, deployment.name);
      deploymentMetrics.value = metrics;
    } catch (error: any) {
      console.error('获取Deployment指标失败:', error);
      message.error(error.message || '获取Deployment指标失败');
      deploymentMetrics.value = null;
    } finally {
      metricsLoading.value = false;
    }
  };

  // 查看事件
  const viewDeploymentEvents = async (clusterId: number, deployment: K8sDeployment) => {
    currentDeployment.value = deployment;
    eventsLoading.value = true;
    eventsModalVisible.value = true;

    try {
      const events = await getDeploymentEventsApi(clusterId, deployment.namespace, deployment.name);
      deploymentEvents.value = events.items || events || [];
    } catch (error: any) {
      console.error('获取Deployment事件失败:', error);
      message.error(error.message || '获取Deployment事件失败');
      deploymentEvents.value = [];
    } finally {
      eventsLoading.value = false;
    }
  };

  // 查看Pod
  const viewDeploymentPods = async (clusterId: number, deployment: K8sDeployment) => {
    currentDeployment.value = deployment;
    podsLoading.value = true;
    podsModalVisible.value = true;

    try {
      const pods = await getDeploymentPodsApi(clusterId, deployment.namespace, deployment.name);
      deploymentPods.value = pods.items || pods || [];
    } catch (error: any) {
      console.error('获取Deployment Pod失败:', error);
      message.error(error.message || '获取Deployment Pod失败');
      deploymentPods.value = [];
    } finally {
      podsLoading.value = false;
    }
  };

  // 查看历史版本
  const viewHistory = async (clusterId: number, deployment: K8sDeployment) => {
    try {
      loading.value = true;
      currentDeployment.value = deployment;
      const history = await getDeploymentHistoryApi(clusterId, deployment.namespace, deployment.name);
      deploymentHistory.value = history.items || [];
      historyModalVisible.value = true;
    } catch (error: any) {
      console.error('获取历史版本失败:', error);
      message.error(error.message || '获取历史版本失败');
    } finally {
      loading.value = false;
    }
  };

  // 删除Deployment
  const deleteDeployment = async (clusterId: number, deployment: K8sDeployment) => {
    const success = await new Promise<boolean>((resolve) => {
      Modal.confirm({
        title: '确定要删除该Deployment吗?',
        content: h('div', [
          h('p', { style: 'margin-bottom: 8px; color: #ff4d4f; font-weight: 500;' }, '⚠️ 危险操作警告'),
          h('p', { style: 'margin-bottom: 8px;' }, `Deployment: ${deployment.name}`),
          h('p', { style: 'margin-bottom: 8px;' }, `命名空间: ${deployment.namespace}`),
          h('p', { style: 'margin-top: 12px; font-weight: 500; color: #ff4d4f;' }, '此操作不可撤销，请谨慎操作！')
        ]),
        okText: '确认删除',
        cancelText: '取消',
        okType: 'danger',
        async onOk() {
          try {
            await deleteDeploymentApi(clusterId, deployment.namespace, deployment.name);
            message.success('Deployment删除成功');
            resolve(true);
          } catch (error: any) {
            console.error('删除Deployment失败:', error);
            message.error(error.message || '删除Deployment失败');
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

  // 批量删除Deployment
  const batchDeleteDeployments = async (clusterId: number, refreshCallback?: () => void) => {
    if (!selectedRows.value.length) {
      message.warning('请先选择要删除的Deployment');
      return;
    }

    Modal.confirm({
      title: `确定要删除选中的 ${selectedRows.value.length} 个Deployment吗?`,
      content: h('div', [
        h('p', { style: 'margin-bottom: 8px; color: #ff4d4f; font-weight: 500;' }, '⚠️ 危险操作警告'),
        h('p', { style: 'margin-bottom: 8px;' }, '删除Deployment将会：'),
        h('ul', { style: 'margin: 8px 0; padding-left: 20px; color: #666;' }, [
          h('li', '停止所有相关的Pod实例'),
          h('li', '删除相关的ReplicaSet'),
          h('li', '中断应用程序的运行'),
          h('li', '影响依赖此Deployment的服务')
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

          for (const deployment of selectedRows.value) {
            try {
              await deleteDeploymentApi(clusterId, deployment.namespace, deployment.name);
              successCount++;
            } catch (error: any) {
              errorCount++;
              errors.push(`${deployment.name}: ${error.message || '删除失败'}`);
            }
          }

          if (successCount > 0 && errorCount === 0) {
            message.success(`成功删除 ${successCount} 个Deployment`);
          } else if (successCount > 0 && errorCount > 0) {
            message.warning(`成功删除 ${successCount} 个，失败 ${errorCount} 个Deployment`);
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

  // 重启Deployment
  const restartDeployment = async (clusterId: number, deployment: K8sDeployment) => {
    const success = await new Promise<boolean>((resolve) => {
      Modal.confirm({
        title: '确定要重启该Deployment吗?',
        content: `Deployment: ${deployment.name}`,
        okText: '确定',
        cancelText: '取消',
        async onOk() {
          try {
            await restartDeploymentApi(clusterId, deployment.namespace, deployment.name);
            message.success('Deployment重启成功');
            resolve(true);
          } catch (error: any) {
            console.error('重启Deployment失败:', error);
            message.error(error.message || '重启Deployment失败');
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
  const scaleDeployment = async (clusterId: number, deployment: K8sDeployment, replicas: number) => {
    try {
      loading.value = true;
      await scaleDeploymentApi(clusterId, deployment.namespace, deployment.name, {
        cluster_id: clusterId,
        namespace: deployment.namespace,
        name: deployment.name,
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

  // 暂停/恢复Deployment
  const pauseResumeDeployment = async (clusterId: number, deployment: K8sDeployment) => {
    const isPaused = isDeploymentPaused(deployment);
    const operation = isPaused ? '恢复' : '暂停';

    const success = await new Promise<boolean>((resolve) => {
      Modal.confirm({
        title: `确定要${operation}该 Deployment 吗?`,
        content: h('div', [
          h('p', { style: 'margin-bottom: 8px;' }, `Deployment: ${deployment.name}`),
          h('p', { style: 'margin-bottom: 8px;' }, `命名空间: ${deployment.namespace}`),
          h('p', { style: 'color: #666;' }, 
            isPaused 
              ? '恢复后，Deployment将重新开始更新流程' 
              : '暂停后，Deployment的滚动更新将会停止'
          )
        ]),
        okText: `确认${operation}`,
        cancelText: '取消',
        okType: isPaused ? 'primary' : 'danger',
        async onOk() {
          pauseResumeLoading.value = true;
          try {
            if (isPaused) {
              await resumeDeploymentApi(clusterId, deployment.namespace, deployment.name);
              message.success(`Deployment "${deployment.name}" 恢复成功`);
            } else {
              await pauseDeploymentApi(clusterId, deployment.namespace, deployment.name);
              message.success(`Deployment "${deployment.name}" 暂停成功`);
            }
            resolve(true);
          } catch (error: any) {
            console.error(`${operation}Deployment失败:`, error);
            const errorMessage = error.response?.data?.message || error.message || `${operation}操作失败`;
            message.error(`${operation}失败: ${errorMessage}`);
            resolve(false);
          } finally {
            pauseResumeLoading.value = false;
          }
        },
        onCancel() {
          resolve(false);
        }
      });
    });

    return success;
  };

  // 回滚
  const rollbackDeployment = async (clusterId: number, deployment: K8sDeployment, revision: number) => {
    try {
      loading.value = true;
      await rollbackDeploymentApi(clusterId, deployment.namespace, deployment.name, {
        cluster_id: clusterId,
        namespace: deployment.namespace,
        name: deployment.name,
        revision
      });
      message.success('回滚操作成功');
      return true;
    } catch (error: any) {
      console.error('回滚操作失败:', error);
      message.error(error.message || '回滚操作失败');
      return false;
    } finally {
      loading.value = false;
    }
  };

  // 创建Deployment
  const createDeployment = async (createData: CreateDeploymentReq) => {
    if (!createData.name.trim()) {
      message.error('请输入Deployment名称');
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
      await createDeploymentApi(createData);
      message.success('Deployment创建成功');
      return true;
    } catch (error: any) {
      console.error('创建Deployment失败:', error);
      message.error(error.message || '创建Deployment失败');
      return false;
    } finally {
      loading.value = false;
    }
  };

  // 更新Deployment
  const updateDeployment = async (clusterId: number, deployment: K8sDeployment, updateData: any) => {
    loading.value = true;
    try {
      await updateDeploymentApi(clusterId, deployment.namespace, deployment.name, updateData);
      message.success('Deployment更新成功');
      return true;
    } catch (error: any) {
      console.error('更新Deployment失败:', error);
      message.error(error.message || '更新Deployment失败');
      return false;
    } finally {
      loading.value = false;
    }
  };

  // 工具函数
  const isDeploymentPaused = (deployment: K8sDeployment) => {
    if (deployment.status !== undefined) {
      return deployment.status === K8sDeploymentStatus.PAUSED;
    }
    
    if (deployment.conditions) {
      const pausedCondition = deployment.conditions.find(condition => 
        condition.type === 'Progressing' && condition.reason === 'DeploymentPaused'
      );
      return !!pausedCondition;
    }
    
    return false;
  };

  const getStatusText = (deployment: K8sDeployment) => {
    if (deployment.status !== undefined) {
      switch (deployment.status) {
        case K8sDeploymentStatus.RUNNING:
          return '运行中';
        case K8sDeploymentStatus.PAUSED:
          return '已暂停';
        case K8sDeploymentStatus.STOPPED:
          return '已停止';
        case K8sDeploymentStatus.ERROR:
          return '异常';
        default:
          return '未知';
      }
    }
    
    return `${deployment.available_replicas || 0}/${deployment.replicas || 0} 副本`;
  };

  const getStatusColor = (deployment: K8sDeployment) => {
    if (deployment.status !== undefined) {
      switch (deployment.status) {
        case K8sDeploymentStatus.RUNNING:
          return 'success';
        case K8sDeploymentStatus.PAUSED:
          return 'warning';
        case K8sDeploymentStatus.STOPPED:
          return 'default';
        case K8sDeploymentStatus.ERROR:
          return 'error';
        default:
          return 'default';
      }
    }
    
    if (!deployment.replicas) return 'default';
    const available = deployment.available_replicas || 0;
    const total = deployment.replicas || 0;
    
    if (available === 0) return 'error';
    if (available < total) return 'warning';
    return 'success';
  };

  const getStatusPercent = (deployment: K8sDeployment) => {
    if (deployment.status === K8sDeploymentStatus.PAUSED) {
      return 50;
    }
    
    if (!deployment.replicas) return 0;
    const available = deployment.available_replicas || 0;
    const total = deployment.replicas || 0;
    
    return Math.round((available / total) * 100);
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
    onChange: (_: string[], selectedRowsData: K8sDeployment[]) => {
      selectedRows.value = selectedRowsData;
    },
    getCheckboxProps: () => ({
      disabled: false,
    }),
  };

  // 计算属性
  const filteredDeployments = computed(() => {
    const searchValue = searchText.value.toLowerCase().trim();
    if (!searchValue) return deployments.value;
    return deployments.value.filter(deploy => 
      deploy.name.toLowerCase().includes(searchValue) || 
      (deploy.images && deploy.images.some(img => img.toLowerCase().includes(searchValue)))
    );
  });

  const healthyDeployments = computed(() => 
    deployments.value.filter(deploy => {
      const available = deploy.available_replicas || 0;
      const total = deploy.replicas || 0;
      return total > 0 && available === total;
    }).length
  );

  const problemDeployments = computed(() => 
    deployments.value.filter(deploy => {
      const available = deploy.available_replicas || 0;
      const total = deploy.replicas || 0;
      return total > 0 && available < total;
    }).length
  );

  // 关闭模态框的方法
  const closeYamlModal = () => {
    viewYamlModalVisible.value = false;
    currentDeployment.value = null;
    deploymentYaml.value = '';
  };

  const closeScaleModal = () => {
    scaleModalVisible.value = false;
  };

  const closeHistoryModal = () => {
    historyModalVisible.value = false;
    deploymentHistory.value = [];
  };

  const closeEditModal = () => {
    editModalVisible.value = false;
    editForm.value = {};
  };

  const closeMetricsModal = () => {
    metricsModalVisible.value = false;
    deploymentMetrics.value = null;
  };

  const closeEventsModal = () => {
    eventsModalVisible.value = false;
    deploymentEvents.value = [];
  };

  const closePodsModal = () => {
    podsModalVisible.value = false;
    deploymentPods.value = [];
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
    deployments,
    searchText,
    selectedRows,
    currentPage,
    pageSize,
    totalItems,
    currentDeployment,
    deploymentYaml,
    deploymentHistory,
    deploymentMetrics,
    deploymentEvents,
    deploymentPods,
    
    // 模态框状态
    viewYamlModalVisible,
    scaleModalVisible,
    historyModalVisible,
    editModalVisible,
    metricsModalVisible,
    eventsModalVisible,
    podsModalVisible,
    createModalVisible,
    
    // 加载状态
    metricsLoading,
    eventsLoading,
    podsLoading,
    pauseResumeLoading,
    
    // 表单
    scaleForm,
    editForm,
    createForm,
    
    // 表格配置
    rowSelection,
    
    // 计算属性
    filteredDeployments,
    healthyDeployments,
    problemDeployments,
    
    // 方法
    getDeployments,
    viewDeploymentYaml,
    viewDeploymentMetrics,
    viewDeploymentEvents,
    viewDeploymentPods,
    viewHistory,
    deleteDeployment,
    batchDeleteDeployments,
    restartDeployment,
    scaleDeployment,
    pauseResumeDeployment,
    rollbackDeployment,
    createDeployment,
    updateDeployment,
    
    // 工具函数
    isDeploymentPaused,
    getStatusText,
    getStatusColor,
    getStatusPercent,
    getPodStatusColor,
    
    // 关闭模态框方法
    closeYamlModal,
    closeScaleModal,
    closeHistoryModal,
    closeEditModal,
    closeMetricsModal,
    closeEventsModal,
    closePodsModal,
    closeCreateModal,
  };
}
