import { ref, computed } from 'vue';
import { message, Modal } from 'ant-design-vue';
import type { FormInstance, Rule } from 'ant-design-vue/es/form';
import {
  NodeStatus,
  type K8sNode,
  type GetK8sNodeListReq,
  type GetK8sNodeDetailReq,
  type UpdateNodeLabelsReq,
  type DrainK8sNodeReq,
  type K8sNodeCordonReq,
  type K8sNodeUncordonReq,
  type GetK8sNodeTaintsReq,
  type AddK8sNodeTaintsReq,
  type DeleteK8sNodeTaintsReq,
  type CheckTaintYamlReq,
  type CoreTaint,
  getK8sNodeList,
  getK8sNodeDetail,
  updateK8sNodeLabels,
  drainK8sNode,
  cordonK8sNode,
  uncordonK8sNode,
  getK8sNodeTaints,
  addK8sNodeTaints,
  deleteK8sNodeTaints,
  checkK8sNodeTaintYaml,
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
    originalTaints: CoreTaint[]; // 用于跟踪原始污点
    taintsToDelete: string[]; // 用于跟踪要删除的污点键
  }>({
    taints: [],
    originalTaints: [],
    taintsToDelete: [],
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
        status: filterStatus.value !== undefined ? [filterStatus.value] : undefined,
      };
      const res = await getK8sNodeList(params);
      // 确保每个node对象都有正确的cluster_id和防御性字段
      const nodesWithClusterId = (res?.items || []).map((node: any) => ({
        ...node,
        cluster_id: node.cluster_id || filterClusterId.value || 0,
        taints: Array.isArray(node.taints) ? node.taints : [],
        labels: node.labels || {},
        roles: Array.isArray(node.roles) ? node.roles : [],
        conditions: Array.isArray(node.conditions) ? node.conditions : []
      }));
      nodes.value = nodesWithClusterId;
      total.value = res?.total || 0;
    } catch (err) {
      message.error('获取节点列表失败');

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
      const nodeDetailWithDefaults = {
        ...(res || record),
        cluster_id: clusterId,
        taints: Array.isArray((res || record).taints) ? (res || record).taints : [],
        labels: (res || record).labels || {},
        roles: Array.isArray((res || record).roles) ? (res || record).roles : [],
        conditions: Array.isArray((res || record).conditions) ? (res || record).conditions : []
      };
      currentNodeDetail.value = nodeDetailWithDefaults;
    } catch (err) {
      message.error('获取节点详情失败');

      currentNodeDetail.value = {
        ...record,
        cluster_id: clusterId,
        taints: Array.isArray(record.taints) ? record.taints : [],
        labels: record.labels || {},
        roles: Array.isArray(record.roles) ? record.roles : [],
        conditions: Array.isArray(record.conditions) ? record.conditions : []
      };
    } finally {
      detailLoading.value = false;
    }
  };

  const closeDetailModal = () => {
    isDetailModalVisible.value = false;
    currentNodeDetail.value = null;
  };

  // 标签管理（覆盖式更新）
  const openEditLabelModal = (record: K8sNode) => {
    currentOperationNode.value = record;
    labelFormModel.value = {
      labels: { ...record.labels }, // 复制当前标签，修改后直接覆盖
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
      
      // 使用覆盖式更新，直接发送当前所有标签（会完全覆盖现有标签）
      const params: UpdateNodeLabelsReq = {
        cluster_id: currentOperationNode.value.cluster_id,
        node_name: currentOperationNode.value.name,
        labels: labelFormModel.value.labels, // 直接发送当前标签，实现增删改的聚合操作
      };
      await updateK8sNodeLabels(params);
      
      message.success('节点标签保存成功');
      isLabelModalVisible.value = false;
      await fetchNodes();
    } catch (err: unknown) {
      message.error('标签保存失败');

    } finally {
      submitLoading.value = false;
    }
  };

  // 污点管理
  const openTaintModal = async (record: K8sNode) => {
    currentOperationNode.value = record;
    const clusterId = validateClusterId(record);
    if (!clusterId) return;
    
    try {
      // 从服务器获取最新的污点信息
      const params: GetK8sNodeTaintsReq = {
        cluster_id: clusterId,
        node_name: record.name,
      };
      const res = await getK8sNodeTaints(params);
      const taints = Array.isArray(res?.taints) ? res.taints : (Array.isArray(record.taints) ? record.taints : []);
      
      taintFormModel.value = {
        taints: [...taints],
        originalTaints: [...taints],
        taintsToDelete: [],
      };
      isTaintModalVisible.value = true;
    } catch (err) {
      // 如果获取失败，使用记录中的污点数据
      const taints = Array.isArray(record.taints) ? record.taints : [];
      taintFormModel.value = {
        taints: [...taints],
        originalTaints: [...taints],
        taintsToDelete: [],
      };
      isTaintModalVisible.value = true;

    }
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
    const taint = taintFormModel.value.taints[index];
    // 如果是原始污点，添加到删除列表
    if (taint && taint.key) {
      const isOriginal = taintFormModel.value.originalTaints.some(t => t.key === taint.key);
      if (isOriginal && !taintFormModel.value.taintsToDelete.includes(taint.key)) {
        taintFormModel.value.taintsToDelete.push(taint.key);
      }
    }
    // 从当前污点列表中删除
    taintFormModel.value.taints.splice(index, 1);
  };

  const submitTaintForm = async () => {
    if (!taintFormRef.value || !currentOperationNode.value) return;
    
    try {
      submitLoading.value = true;
      
      // 先删除标记为删除的污点
      if (taintFormModel.value.taintsToDelete.length > 0) {
        const deleteParams: DeleteK8sNodeTaintsReq = {
          cluster_id: currentOperationNode.value.cluster_id,
          node_name: currentOperationNode.value.name,
          taint_keys: taintFormModel.value.taintsToDelete,
        };
        await deleteK8sNodeTaints(deleteParams);
      }
      
      // 再添加或更新污点（只发送新的或修改过的污点）
      const taintsToAdd: CoreTaint[] = taintFormModel.value.taints.filter(taint => {
        if (!taint.key) return false; // 忽略没有key的污点
        
        // 检查是否是新污点或者是否发生了变化
        const originalTaint = taintFormModel.value.originalTaints.find(t => t.key === taint.key);
        if (!originalTaint) return true; // 新污点
        
        // 检查是否有修改
        return originalTaint.value !== taint.value || 
               originalTaint.effect !== taint.effect;
      });
      
      if (taintsToAdd.length > 0) {
        const addParams: AddK8sNodeTaintsReq = {
          cluster_id: currentOperationNode.value.cluster_id,
          node_name: currentOperationNode.value.name,
          taints: taintsToAdd,
        };
        await addK8sNodeTaints(addParams);
      }
      
      message.success('节点污点更新成功');
      isTaintModalVisible.value = false;
      await fetchNodes();
    } catch (err: unknown) {
      message.error('污点更新失败');

    } finally {
      submitLoading.value = false;
    }
  };

  // 验证污点YAML配置
  const validateTaintYaml = async (yamlData: string): Promise<boolean> => {
    if (!currentOperationNode.value) {
      message.error('未选择节点');
      return false;
    }
    
    const clusterId = validateClusterId(currentOperationNode.value);
    if (!clusterId) return false;
    
    try {
      const params: CheckTaintYamlReq = {
        cluster_id: clusterId,
        node_name: currentOperationNode.value.name,
        yaml_data: yamlData,
      };
      await checkK8sNodeTaintYaml(params);
      message.success('YAML配置验证通过');
      return true;
    } catch (err) {
      message.error('YAML配置验证失败');

      return false;
    }
  };

  // 节点调度操作（使用 cordon/uncordon 接口）
  const toggleNodeSchedule = async (record: K8sNode) => {
    // schedulable === 1 表示可调度，需要禁用调度（cordon）
    // schedulable === 2 表示不可调度，需要启用调度（uncordon）
    const needCordon = record.schedulable === 1;
    const action = needCordon ? '禁用' : '启用';
    
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
          
          if (needCordon) {
            // 禁用调度
            const params: K8sNodeCordonReq = {
              cluster_id: clusterId,
              node_name: record.name,
            };
            await cordonK8sNode(params);
          } else {
            // 启用调度
            const params: K8sNodeUncordonReq = {
              cluster_id: clusterId,
              node_name: record.name,
            };
            await uncordonK8sNode(params);
          }
          
          message.success(`节点调度已${action}`);
          await fetchNodes();
        } catch (err) {
          message.error(`${action}节点调度失败`);

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
      message.success('节点驱逐操作已启动');
      isDrainModalVisible.value = false;
      await fetchNodes();
    } catch (err: unknown) {
      if (err && typeof err === 'object' && 'errorFields' in err) {
        message.warning('请检查表单填写是否正确');
        return;
      }
      message.error('节点驱逐失败');

    } finally {
      submitLoading.value = false;
    }
  };

  const removeLabelField = (key: string) => {
    // 覆盖式更新：直接从当前标签中删除即可，提交时会完全覆盖
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
    validateTaintYaml,
    
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
