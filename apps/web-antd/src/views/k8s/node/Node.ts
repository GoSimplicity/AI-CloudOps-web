import { ref, computed } from 'vue';
import { message, Modal } from 'ant-design-vue';
import type { FormInstance, Rule } from 'ant-design-vue/es/form';
import {
  NodeStatus,
  type K8sNode,
  type GetK8sNodeListReq,
  type GetK8sNodeDetailReq,
  type AddLabelNodesReq,
  type DrainK8sNodeReq,
  type K8sNodeCordonReq,
  type K8sNodeUncordonReq,
  type AddK8sNodeTaintsReq,
  type CoreTaint,
  getK8sNodeList,
  getK8sNodeDetail,
  addK8sNodeLabels,
  drainK8sNode,
  cordonK8sNode,
  uncordonK8sNode,
  addK8sNodeTaints,
} from '#/api/core/k8s/k8s_node';
import {
  type K8sCluster,
  type ListClustersReq,
  getClustersListApi,
  Env,
} from '#/api/core/k8s/k8s_cluster';

export function useNodePage() {
  // state
  const nodes = ref<K8sNode[]>([]);
  const clusters = ref<K8sCluster[]>([]);
  const loading = ref(false);
  const clustersLoading = ref(false);
  const searchText = ref('');
  const filterStatus = ref<NodeStatus | undefined>(undefined);
  const filterClusterId = ref<number | undefined>(undefined);
  const selectedRowKeys = ref<string[]>([]);
  const selectedRows = ref<K8sNode[]>([]);
  const currentPage = ref(1);
  const pageSize = ref(10);
  const total = ref(0);
  const clustersTotal = ref(0); // 用于集群下拉选择
  const clustersPage = ref(1);
  const clustersSize = ref(50); // 集群下拉选择每页数量
  
  // form refs
  const labelFormRef = ref<FormInstance>();
  const taintFormRef = ref<FormInstance>();
  const drainFormRef = ref<FormInstance>();

  // modal/form state
  const isLabelModalVisible = ref(false);
  const isTaintModalVisible = ref(false);
  const isDrainModalVisible = ref(false);
  const submitLoading = ref(false);
  
  // detail modal state
  const isDetailModalVisible = ref(false);
  const detailLoading = ref(false);
  const currentNodeDetail = ref<K8sNode | null>(null);
  
  // current node for operations
  const currentOperationNode = ref<K8sNode | null>(null);
  
  // 标签表单模型
  const labelFormModel = ref<{
    labels: Record<string, string>;
  }>({
    labels: {},
  });

  // 污点表单模型
  const taintFormModel = ref<{
    taints: CoreTaint[];
  }>({
    taints: [],
  });

  // 驱逐表单模型
  const drainFormModel = ref<{
    force: number;
    ignore_daemon_sets: number;
    delete_local_data: number;
    grace_period_seconds?: number;
    timeout_seconds?: number;
  }>({
    force: 2,
    ignore_daemon_sets: 1,
    delete_local_data: 2,
    grace_period_seconds: 30,
    timeout_seconds: 300,
  });

  // 表单验证规则
  const labelFormRules: Record<string, Rule[]> = {
    // 动态验证标签
  };

  const taintFormRules: Record<string, Rule[]> = {
    // 动态验证污点
  };

  const drainFormRules: Record<string, Rule[]> = {
    grace_period_seconds: [
      { type: 'number', min: 0, max: 3600, message: '优雅关闭时间应在0-3600秒之间', trigger: 'blur' }
    ],
    timeout_seconds: [
      { type: 'number', min: 30, max: 7200, message: '超时时间应在30-7200秒之间', trigger: 'blur' }
    ]
  };

  // computed
  const filteredNodes = computed(() => {
    return nodes.value;
  });

  const rowSelection = computed(() => ({
    selectedRowKeys: selectedRowKeys.value,
    onChange: (keys: string[], rows: K8sNode[]) => {
      selectedRowKeys.value = keys;
      selectedRows.value = rows;
    },
  }));

  // helpers
  const validateClusterId = (record: any): number | null => {
    const clusterId = record.cluster_id || filterClusterId.value;
    if (!clusterId || clusterId === 0) {
      message.error('无效的集群ID，请重新选择集群');
      return null;
    }
    return clusterId;
  };

  const getEnvText = (env?: Env | string) => {
    if (env === undefined || env === null) return '未知环境';
    const value = typeof env === 'string' ? parseInt(env) : env;
    const map: Record<number, string> = {
      [Env.Prod]: '生产',
      [Env.Dev]: '开发',
      [Env.Stage]: '预发',
      [Env.Rc]: '测试',
      [Env.Press]: '灰度',
    };
    return map[value] || '未知环境';
  };

  const getStatusText = (status?: NodeStatus) => {
    const map: Record<number, string> = {
      [NodeStatus.Ready]: '就绪',
      [NodeStatus.NotReady]: '未就绪',
      [NodeStatus.SchedulingDisabled]: '调度禁用',
      [NodeStatus.Unknown]: '未知',
      [NodeStatus.Error]: '异常',
    };
    return status !== undefined ? map[status] || '未知' : '未知';
  };

  const getStatusColor = (status?: NodeStatus) => {
    const map: Record<number, string> = {
      [NodeStatus.Ready]: 'success',
      [NodeStatus.NotReady]: 'warning',
      [NodeStatus.SchedulingDisabled]: 'default',
      [NodeStatus.Unknown]: 'default',
      [NodeStatus.Error]: 'error',
    };
    return status !== undefined ? map[status] || 'default' : 'default';
  };

  const getSchedulableText = (schedulable?: number) => {
    return schedulable === 1 ? '可调度' : '不可调度';
  };

  const getSchedulableColor = (schedulable?: number) => {
    return schedulable === 1 ? 'success' : 'error';
  };

  // cluster operations
  const clearNodes = () => {
    nodes.value = [];
    selectedRowKeys.value = [];
    selectedRows.value = [];
  };

  const fetchClusters = async (reset = false) => {
    if (reset) {
      resetClusters();
    }
    try {
      clustersLoading.value = true;
      const params: ListClustersReq = {
        page: clustersPage.value,
        size: clustersSize.value, // 动态获取集群，用于下拉选择
      };
      const res = await getClustersListApi(params);
      // 如果是第一页，直接赋值；否则追加到现有数据
      if (clustersPage.value === 1) {
        clusters.value = res?.items || [];
      } else {
        clusters.value = [...clusters.value, ...(res?.items || [])];
      }
      clustersTotal.value = res?.total || 0;
      
      // 如果当前没有选择集群且有可用集群，自动选择第一个
      if (!filterClusterId.value && clusters.value.length > 0) {
        const firstCluster = clusters.value[0];
        if (firstCluster?.id) {
          filterClusterId.value = firstCluster.id;
          message.info(`已自动选择集群: ${firstCluster.name || '未知集群'}`);
          // 自动加载该集群的节点数据
          await fetchNodes();
        }
      }
    } catch (err) {
      message.error('获取集群列表失败');
      console.error(err);
    } finally {
      clustersLoading.value = false;
    }
  };

  // crud operations
  const fetchNodes = async () => {
    if (!filterClusterId.value) {
      message.warning('请先选择集群');
      return;
    }

    try {
      loading.value = true;
      const params: GetK8sNodeListReq = {
        cluster_id: filterClusterId.value,
        page: currentPage.value,
        size: pageSize.value,
        search: searchText.value || undefined,
        status: filterStatus.value ? filterStatus.value : undefined,
      };
      const res = await getK8sNodeList(params);
      // 确保每个node对象都有正确的cluster_id
      const nodesWithClusterId = (res?.items || []).map((node: any) => ({
        ...node,
        cluster_id: node.cluster_id || filterClusterId.value || 0
      }));
      nodes.value = nodesWithClusterId;
      total.value = res?.total || 0;
    } catch (err) {
      message.error('获取节点列表失败');
      console.error(err);
    } finally {
      loading.value = false;
    }
  };

  // 查看详情
  const showNodeDetail = async (record: K8sNode) => {
    const clusterId = validateClusterId(record);
    if (!clusterId) return;
    
    try {
      detailLoading.value = true;
      isDetailModalVisible.value = true;
      const params: GetK8sNodeDetailReq = {
        cluster_id: clusterId,
        node_name: record.name,
      };
      const res = await getK8sNodeDetail(params);
      currentNodeDetail.value = res || { ...record, cluster_id: clusterId };
    } catch (err) {
      message.error('获取节点详情失败');
      console.error(err);
      currentNodeDetail.value = { ...record, cluster_id: clusterId };
    } finally {
      detailLoading.value = false;
    }
  };

  const closeDetailModal = () => {
    isDetailModalVisible.value = false;
    currentNodeDetail.value = null;
  };

  // 标签管理
  const openEditLabelModal = (record: K8sNode) => {
    currentOperationNode.value = record;
    labelFormModel.value = {
      labels: { ...record.labels },
    };
    isLabelModalVisible.value = true;
  };

  const closeLabelModal = () => {
    isLabelModalVisible.value = false;
    currentOperationNode.value = null;
  };

  const submitLabelForm = async () => {
    if (!labelFormRef.value || !currentOperationNode.value) return;
    
    try {
      submitLoading.value = true;
      
      const params: AddLabelNodesReq = {
        cluster_id: currentOperationNode.value.cluster_id,
        node_name: currentOperationNode.value.name,
        labels: labelFormModel.value.labels,
      };
      await addK8sNodeLabels(params);
      message.success('节点标签保存成功');
      
      isLabelModalVisible.value = false;
      await fetchNodes();
    } catch (err: unknown) {
      message.error('标签保存失败');
      console.error(err);
    } finally {
      submitLoading.value = false;
    }
  };

  // 污点管理
  const openTaintModal = (record: K8sNode) => {
    currentOperationNode.value = record;
    taintFormModel.value = {
      taints: [...record.taints],
    };
    isTaintModalVisible.value = true;
  };

  const closeTaintModal = () => {
    isTaintModalVisible.value = false;
    currentOperationNode.value = null;
  };

  const addTaint = () => {
    taintFormModel.value.taints.push({
      key: '',
      value: '',
      effect: 'NoSchedule',
    });
  };

  const removeTaint = (index: number) => {
    taintFormModel.value.taints.splice(index, 1);
  };

  const submitTaintForm = async () => {
    if (!taintFormRef.value || !currentOperationNode.value) return;
    
    try {
      submitLoading.value = true;
      const params: AddK8sNodeTaintsReq = {
        cluster_id: currentOperationNode.value.cluster_id,
        node_name: currentOperationNode.value.name,
        taints: taintFormModel.value.taints,
      };
      await addK8sNodeTaints(params);
      message.success('节点污点更新成功');
      isTaintModalVisible.value = false;
      await fetchNodes();
    } catch (err: unknown) {
      message.error('污点更新失败');
      console.error(err);
    } finally {
      submitLoading.value = false;
    }
  };

  // 节点调度操作
  const toggleNodeSchedule = async (record: K8sNode) => {
    const enable = record.schedulable === 2 ? 1 : 2; // 切换调度状态
    const action = enable === 1 ? '启用' : '禁用';
    
    Modal.confirm({
      title: `${action}节点调度`,
      content: `确定要${action}节点 "${record.name}" 的调度吗？`,
      okText: `确认${action}`,
      cancelText: '取消',
      centered: true,
      onOk: async () => {
        try {
          const clusterId = record.cluster_id || filterClusterId.value;
          if (!clusterId || clusterId === 0) {
            message.error('无效的集群ID，请重新选择集群');
            return;
          }
          
          if (enable === 1) {
            const params: K8sNodeUncordonReq = {
              cluster_id: clusterId,
              node_name: record.name,
            };
            await uncordonK8sNode(params);
            message.success('节点调度已启用');
          } else {
            const params: K8sNodeCordonReq = {
              cluster_id: clusterId,
              node_name: record.name,
            };
            await cordonK8sNode(params);
            message.success('节点调度已禁用');
          }
          await fetchNodes();
        } catch (err) {
          message.error(`${action}节点调度失败`);
          console.error(err);
        }
      },
    });
  };

  // 驱逐节点
  const openDrainModal = (record: K8sNode) => {
    currentOperationNode.value = record;
    drainFormModel.value = {
      force: 2,
      ignore_daemon_sets: 1,
      delete_local_data: 2,
      grace_period_seconds: 30,
      timeout_seconds: 300,
    };
    isDrainModalVisible.value = true;
  };

  const closeDrainModal = () => {
    isDrainModalVisible.value = false;
    currentOperationNode.value = null;
  };

  const submitDrainForm = async () => {
    if (!drainFormRef.value || !currentOperationNode.value) return;
    
    try {
      await drainFormRef.value.validate();
      
      submitLoading.value = true;
      const params: DrainK8sNodeReq = {
        cluster_id: currentOperationNode.value.cluster_id,
        node_name: currentOperationNode.value.name,
        ...drainFormModel.value,
      };
      await drainK8sNode(params);
      message.success('🔄 节点驱逐操作已启动');
      isDrainModalVisible.value = false;
      await fetchNodes();
    } catch (err: unknown) {
      if (err && typeof err === 'object' && 'errorFields' in err) {
        message.warning('请检查表单填写是否正确');
        return;
      }
      message.error('节点驱逐失败');
      console.error(err);
    } finally {
      submitLoading.value = false;
    }
  };


  const removeLabelField = (key: string) => {
    delete labelFormModel.value.labels[key];
  };

  // 批量操作
  const batchOperation = (operation: string) => {
    if (!selectedRows.value.length) return;
    
    Modal.confirm({
      title: `批量${operation}`,
      content: `确定要对选中的 ${selectedRows.value.length} 个节点执行${operation}操作吗？`,
      okText: '确认执行',
      cancelText: '取消',
      centered: true,
      onOk: async () => {
        try {
          // 根据不同操作类型执行相应的批量操作
          // 这里可以扩展更多批量操作
          message.success(`批量${operation}操作已启动`);
          selectedRowKeys.value = [];
          selectedRows.value = [];
          await fetchNodes();
        } catch (err) {
          message.error(`批量${operation}失败`);
          console.error(err);
        }
      },
    });
  };

  // 加载更多集群（用于下拉选择的动态加载）
  const loadMoreClusters = async () => {
    if (clustersPage.value * clustersSize.value >= clustersTotal.value) {
      return; // 已加载完所有数据
    }
    clustersPage.value += 1;
    await fetchClusters();
  };

  // 重置集群列表
  const resetClusters = () => {
    clustersPage.value = 1;
    clusters.value = [];
  };

  // 分页变化处理
  const handlePageChange = async (page: number, size?: number) => {
    currentPage.value = page;
    if (size && size !== pageSize.value) {
      pageSize.value = size;
    }
    await fetchNodes();
  };

  return {
    // state
    nodes,
    clusters,
    loading,
    clustersLoading,
    searchText,
    filterStatus,
    filterClusterId,
    selectedRowKeys,
    selectedRows,
    currentPage,
    pageSize,
    total,
    clustersTotal,
    clustersPage,
    clustersSize,
    
    // form refs
    labelFormRef,
    taintFormRef,
    drainFormRef,
    
    // modal state
    isLabelModalVisible,
    isTaintModalVisible,
    isDrainModalVisible,
    submitLoading,
    
    // detail modal
    isDetailModalVisible,
    detailLoading,
    currentNodeDetail,
    
    // form models
    labelFormModel,
    taintFormModel,
    drainFormModel,
    
    // form rules
    labelFormRules,
    taintFormRules,
    drainFormRules,
    
    // computed
    filteredNodes,
    rowSelection,
    
    // helpers
    getEnvText,
    getStatusText,
    getStatusColor,
    getSchedulableText,
    getSchedulableColor,
    
    // operations
    fetchClusters,
    fetchNodes,
    clearNodes,
    showNodeDetail,
    closeDetailModal,
    
    // label operations
    openEditLabelModal,
    closeLabelModal,
    submitLabelForm,
    removeLabelField,
    
    // taint operations
    openTaintModal,
    closeTaintModal,
    addTaint,
    removeTaint,
    submitTaintForm,
    
    // schedule operations
    toggleNodeSchedule,
    
    // drain operations
    openDrainModal,
    closeDrainModal,
    submitDrainForm,
    
    // batch operations
    batchOperation,
    
    // cluster pagination
    loadMoreClusters,
    resetClusters,
    handlePageChange,
    
    // constants
    NodeStatus,
  };
}
