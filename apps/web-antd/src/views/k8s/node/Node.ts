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
import { usePermission } from '#/utils/permission';
import { clusterResourceKey } from '../shared/utils';
import {
  isPermissionDeniedError,
  PERMISSION_DENIED_MESSAGE,
  PERMISSION_DENIED_MESSAGE_KEY,
} from '#/utils/permission/forbidden';

/** 批量禁用调度的最大并发请求数（复审 P2-1：避免一次性打出 N 个请求） */
export const BATCH_CORDON_CONCURRENCY = 5;

/**
 * 小型并发池：按顺序取任务，同时最多 limit 个在跑；结果按输入顺序返回，语义同 Promise.allSettled。
 */
export async function runWithConcurrency<T, R>(
  items: readonly T[],
  limit: number,
  worker: (item: T, index: number) => Promise<R>,
): Promise<PromiseSettledResult<R>[]> {
  const results: PromiseSettledResult<R>[] = new Array(items.length);
  let next = 0;
  const runner = async () => {
    while (next < items.length) {
      const index = next++;
      try {
        results[index] = { status: 'fulfilled', value: await worker(items[index] as T, index) };
      } catch (reason) {
        results[index] = { status: 'rejected', reason };
      }
    }
  };
  const size = Math.max(1, Math.min(limit, items.length));
  await Promise.all(Array.from({ length: size }, runner));
  return results;
}

export function useNodePage() {
  // state
  const nodes = ref<K8sNode[]>([]);
  const clusters = ref<K8sCluster[]>([]);
  const loading = ref(false);
  const loadError = ref('');
  const clustersError = ref('');
  let resourceRequestId = 0;
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
    resourceRequestId++;
    loading.value = false;
    total.value = 0;
    loadError.value = '';
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
      clustersError.value = '';
      const params: ListClustersReq = {
        page: clustersPage.value,
        size: clustersSize.value,
      };
      const res = await getClustersListApi(params);
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
          // 自动加载该集群的命名空间和Node数据
          await fetchNodes();
        }
      }
    } catch (err) {
      if (clustersPage.value === 1) {
        clusters.value = [];
        clustersTotal.value = 0;
        filterClusterId.value = undefined;
        clearNodes();
      }
      clustersError.value = '获取集群列表失败，请重试';
      if (!isPermissionDeniedError(err)) message.error(clustersError.value);
    } finally {
      clustersLoading.value = false;
    }
  };

  // crud operations
  const fetchNodes = async () => {
    const clusterId = filterClusterId.value;
    if (!clusterId) { clearNodes(); return; }
    const requestId = ++resourceRequestId;
    try {
      loading.value = true;
      loadError.value = '';
      selectedRowKeys.value = [];
      selectedRows.value = [];
      const params: GetK8sNodeListReq = {
        cluster_id: clusterId,
        page: currentPage.value,
        size: pageSize.value,
        search: searchText.value || undefined,
        status: filterStatus.value !== undefined ? [filterStatus.value] : undefined,
      };
      const res = await getK8sNodeList(params);
      if (requestId !== resourceRequestId || filterClusterId.value !== clusterId) return;
      // 确保每个node对象都有正确的cluster_id和防御性字段
      const nodesWithClusterId = (res?.items || []).map((node: any) => ({
        ...node,
        cluster_id: node.cluster_id || clusterId || 0,
        taints: Array.isArray(node.taints) ? node.taints : [],
        labels: node.labels || {},
        roles: Array.isArray(node.roles) ? node.roles : [],
        conditions: Array.isArray(node.conditions) ? node.conditions : []
      }));
      nodes.value = nodesWithClusterId;
      total.value = res?.total || 0;
    } catch (error) {
      if (requestId !== resourceRequestId || filterClusterId.value !== clusterId) return;
      clearNodes();
      loadError.value = '获取 节点列表失败，请重试';
      if (!isPermissionDeniedError(error)) message.error(loadError.value);
    } finally {
      if (requestId === resourceRequestId) loading.value = false;
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
      if (!isPermissionDeniedError(err)) message.error('获取节点详情失败');

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
      if (!isPermissionDeniedError(err)) message.error('标签保存失败');

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
      
      // originalTaints 存副本：行内编辑不能改到原始值，否则检测不到 value/effect 的修改
      taintFormModel.value = {
        taints: taints.map((taint: CoreTaint) => ({ ...taint })),
        originalTaints: taints.map((taint: CoreTaint) => ({ ...taint })),
        taintsToDelete: [],
      };
      isTaintModalVisible.value = true;
    } catch (err) {
      // 如果获取失败，使用记录中的污点数据
      const taints = Array.isArray(record.taints) ? record.taints : [];
      taintFormModel.value = {
        taints: taints.map((taint: CoreTaint) => ({ ...taint })),
        originalTaints: taints.map((taint: CoreTaint) => ({ ...taint })),
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

  // 是否为本次弹窗里新增、尚未保存的行（不在原始污点里）：删除它只改本地表单，不调删除接口
  const isNewTaint = (taint: CoreTaint) =>
    !taintFormModel.value.originalTaints.some((t) => t.key === taint.key);

  // 要添加或更新的污点（只发送新的或修改过的污点）
  const getTaintsToAdd = (): CoreTaint[] =>
    taintFormModel.value.taints.filter((taint) => {
      if (!taint.key) return false; // 忽略没有key的污点
      // 先删后加同一个 key（复审 P3-4）：提交时先删除再添加，必须重新添加，否则最终被删掉
      if (taintFormModel.value.taintsToDelete.includes(taint.key)) return true;

      // 检查是否是新污点或者是否发生了变化
      const originalTaint = taintFormModel.value.originalTaints.find(
        (t) => t.key === taint.key,
      );
      if (!originalTaint) return true; // 新污点

      // 检查是否有修改
      return (
        originalTaint.value !== taint.value ||
        originalTaint.effect !== taint.effect
      );
    });

  // c-7：没有可提交的变更时「保存更改」禁用
  const hasTaintChanges = computed(
    () =>
      taintFormModel.value.taintsToDelete.length > 0 ||
      getTaintsToAdd().length > 0,
  );

  const submitTaintForm = async () => {
    if (!taintFormRef.value || !currentOperationNode.value) return;

    const taintsToDelete = [...taintFormModel.value.taintsToDelete];
    const taintsToAdd = getTaintsToAdd();
    if (taintsToDelete.length === 0 && taintsToAdd.length === 0) return;

    // c-6：调用接口前按变更内容逐项校验，任一越权就整单不发请求，弹窗保持打开
    const { can } = usePermission();
    if (
      (taintsToDelete.length > 0 && !can('k8s.node.taintDelete')) ||
      (taintsToAdd.length > 0 && !can('k8s.node.taintAdd'))
    ) {
      message.error({
        content: PERMISSION_DENIED_MESSAGE,
        key: PERMISSION_DENIED_MESSAGE_KEY,
      });
      return;
    }

    const node = currentOperationNode.value;
    let deleted = false;
    let added = false;
    try {
      submitLoading.value = true;

      // 先删除标记为删除的污点
      if (taintsToDelete.length > 0) {
        const deleteParams: DeleteK8sNodeTaintsReq = {
          cluster_id: node.cluster_id,
          node_name: node.name,
          taint_keys: taintsToDelete,
        };
        await deleteK8sNodeTaints(deleteParams);
        deleted = true;
      }

      // 再添加或更新污点
      if (taintsToAdd.length > 0) {
        const addParams: AddK8sNodeTaintsReq = {
          cluster_id: node.cluster_id,
          node_name: node.name,
          taints: taintsToAdd,
        };
        await addK8sNodeTaints(addParams);
      }
      added = true;

      message.success('节点污点更新成功');
      isTaintModalVisible.value = false;
      await fetchNodes();
    } catch (err: unknown) {
      if (deleted && !added) {
        // c-9：删除已生效、添加失败 → 部分成功，刷新列表，不提示整体成功
        message.warning(
          `部分成功：已删除污点 ${taintsToDelete.join('、')}，添加/修改污点失败`,
        );
        isTaintModalVisible.value = false;
        await fetchNodes();
      } else if (!isPermissionDeniedError(err)) {
        // c-8：403 已由请求层统一提示，不再弹通用失败
        message.error('污点更新失败');
      }
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
      if (!isPermissionDeniedError(err)) message.error('YAML配置验证失败');

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
          if (!isPermissionDeniedError(err)) message.error(`${action}节点调度失败`);

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
        if (!isPermissionDeniedError(err)) message.warning('请检查表单填写是否正确');
        return;
      }
      if (!isPermissionDeniedError(err)) message.error('节点驱逐失败');

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
        // 后端只有单节点 cordon（POST /api/k8s/node/:cluster_id/:node_name/cordon），没有批量接口，
        // 这里逐个节点调用单节点接口，再汇总成功/失败
        if (operation !== '禁用调度') {
          message.error(`暂不支持批量${operation}`);
          return;
        }
        const selected = [...selectedRows.value];
        // 只对可调度（schedulable === 1，与行内按钮判断一致）的节点发 cordon；
        // 已禁用调度的节点跳过，不发请求，在汇总里列出（复审 P3-5）
        const targets = selected.filter((record) => record.schedulable === 1);
        const skipped = selected.filter((record) => record.schedulable !== 1);
        const skippedText = skipped.length
          ? `，跳过 ${skipped.length} 个已禁用调度的节点（${skipped.map((record) => record.name).join('、')}）`
          : '';
        if (targets.length === 0) {
          message.info(`选中的 ${selected.length} 个节点均已禁用调度，无需操作`);
          return;
        }
        // 每个节点一个请求，最多 BATCH_CORDON_CONCURRENCY 个同时进行
        const results = await runWithConcurrency(
          targets,
          BATCH_CORDON_CONCURRENCY,
          (record) => {
            const clusterId = record.cluster_id || filterClusterId.value;
            if (!clusterId) return Promise.reject(new Error('无效的集群ID'));
            const params: K8sNodeCordonReq = {
              cluster_id: clusterId,
              node_name: record.name,
            };
            return cordonK8sNode(params);
          },
        );
        const failed = targets.filter((_, index) => results[index]?.status === 'rejected');
        const failedNames = failed.map((record) => record.name).join('、');
        const successCount = targets.length - failed.length;

        if (failed.length === 0) {
          message.success(`批量${operation}完成：${successCount} 个节点已${operation}${skippedText}`);
        } else if (successCount > 0) {
          message.warning(
            `批量${operation}部分成功：成功 ${successCount} 个，失败 ${failed.length} 个（${failedNames}）${skippedText}`,
          );
        } else {
          // 全部失败且每个失败都已有统一提示（403 / 业务错误原文）时不再叠加
          const allNotified = results.every(
            (result) => result.status === 'rejected' && isPermissionDeniedError(result.reason),
          );
          if (!allNotified) {
            message.error(`批量${operation}失败：${failed.length} 个节点均未成功（${failedNames}）${skippedText}`);
          }
        }

        if (successCount > 0) {
          try {
            await fetchNodes();
          } catch {
            // fetchNodes 自己处理加载失败状态
          }
          // 部分失败时保留失败节点的勾选，方便重试；全部成功则清空（复审 P3-5）
          const failedKeys = failed.map((record) => clusterResourceKey(record));
          selectedRowKeys.value = failedKeys;
          selectedRows.value = failed.map(
            (record) =>
              nodes.value.find((node) => clusterResourceKey(node) === clusterResourceKey(record)) ?? record,
          );
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
    loadError,
    clustersError,
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
    isNewTaint,
    submitTaintForm,
    hasTaintChanges,
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
