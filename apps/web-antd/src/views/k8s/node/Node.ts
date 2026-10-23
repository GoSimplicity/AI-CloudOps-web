import { ref, computed, toRaw } from 'vue';
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

/** 新增行与已保存污点同 key、但没有删除权限 */
export const TAINT_KEY_EXISTS_MESSAGE = '该 key 已存在，修改需先删除（需删除权限）';
/** 同一 key + effect 出现多行 */
export const TAINT_DUPLICATE_EFFECT_MESSAGE =
  '同一污点 key 的同一 effect 只能有一条，请修改原有的那一行';

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

  // c-5 行身份：弹窗打开时由已保存污点生成的行 → 它对应的 originalTaints 项。
  // 本次新增的行不在表里；判断“新增 / 撤销 / 删除已保存”按行身份，不按 key（同 key 的新增行撤销时不能当成删除已保存的污点）
  let savedTaintOrigins = new WeakMap<CoreTaint, CoreTaint>();
  const savedOriginOf = (row: CoreTaint) => savedTaintOrigins.get(toRaw(row));

  const resetTaintForm = (taints: CoreTaint[]) => {
    const rows = taints.map((taint: CoreTaint) => ({ ...taint }));
    // originalTaints 存副本：行内编辑不能改到原始值，否则检测不到 value/effect 的修改
    const originalTaints = taints.map((taint: CoreTaint) => ({ ...taint }));
    savedTaintOrigins = new WeakMap();
    rows.forEach((row, index) => savedTaintOrigins.set(row, originalTaints[index]!));
    taintFormModel.value = { taints: rows, originalTaints, taintsToDelete: [] };
  };

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
      
      resetTaintForm(taints);
      isTaintModalVisible.value = true;
    } catch (err) {
      // 如果获取失败，使用记录中的污点数据
      const taints = Array.isArray(record.taints) ? record.taints : [];
      resetTaintForm(taints);
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
    // 只有由已保存污点生成的行才加入删除列表（按它原始的 key）；本次新增的行只是撤销，即使 key 与已保存污点相同
    const origin = taint && savedOriginOf(taint);
    if (origin && origin.key && !taintFormModel.value.taintsToDelete.includes(origin.key)) {
      taintFormModel.value.taintsToDelete.push(origin.key);
    }
    // 从当前污点列表中删除
    taintFormModel.value.taints.splice(index, 1);
  };

  // 是否为本次弹窗里新增、尚未保存的行（不在原始污点里）：删除它只改本地表单，不调删除接口
  const isNewTaint = (taint: CoreTaint) => !savedOriginOf(taint);

  // 提交计划：要删除的 key、要添加（后端 add = mergeTaints）的行，以及需要拦下的情况
  // 后端 mergeTaints（AI-CloudOps internal/k8s/manager/taint_manager.go:247-263）按 key 整体替换：
  // 先去掉已有污点里所有出现在本次 add 里的 key，再追加本次的行；删除接口按 key 删掉该 key 的所有 effect（:312-344）
  const planTaintChanges = () => {
    const { taints, originalTaints, taintsToDelete } = taintFormModel.value;
    const deleteKeys = [...taintsToDelete];
    const rows = taints.filter((taint) => taint.key); // 忽略没有key的污点
    // 复审 P3-1 兜底：已保存的行 key 输入框只读；万一 key 被改了，当作先删原 key 再加新 key，不留下原 key 的孤儿
    for (const row of rows) {
      const origin = savedOriginOf(row);
      if (origin?.key && origin.key !== row.key && !deleteKeys.includes(origin.key)) {
        deleteKeys.push(origin.key);
      }
    }
    const savedKeys = new Set(originalTaints.map((taint) => taint.key));
    const dirtyKeys = new Set<string>();
    const conflictKeys = new Set<string>();
    for (const row of rows) {
      // 先删后加同一个 key（复审 P3-4）：提交时先删除再添加，必须重新添加，否则最终被删掉
      if (deleteKeys.includes(row.key)) {
        dirtyKeys.add(row.key);
        continue;
      }
      // 已保存的行和自己的原始值比较（行身份）
      const origin = savedOriginOf(row);
      if (origin && origin.key === row.key) {
        if (origin.value !== row.value || origin.effect !== row.effect) dirtyKeys.add(row.key);
        continue;
      }
      // 新增行：key 与仍保留的已保存污点相同，等于修改已有污点（窝窝头答复 2），需要删除权限
      dirtyKeys.add(row.key);
      if (savedKeys.has(row.key)) conflictKeys.add(row.key);
    }
    // 复审 P3-2：某个 key 只要有一行要发，就把这个 key 当前的所有行一起发，避免同 key 的其他 effect 被替换掉
    const taintsToAdd = rows.filter((row) => dirtyKeys.has(row.key));
    // 同一 key + effect 只能有一条（Kubernetes 校验），重复时整单不发
    const seen = new Set<string>();
    const duplicateKeys = new Set<string>();
    for (const row of taintsToAdd) {
      const id = `${row.key}\u0000${row.effect}`;
      if (seen.has(id)) duplicateKeys.add(row.key);
      seen.add(id);
    }
    return {
      conflictKeys: [...conflictKeys],
      duplicateKeys: [...duplicateKeys],
      taintsToAdd,
      taintsToDelete: deleteKeys,
    };
  };

  // 要添加或更新的污点（按 key 整组发送，见 planTaintChanges）
  const getTaintsToAdd = (): CoreTaint[] => planTaintChanges().taintsToAdd;

  // c-7：没有可提交的变更时「保存更改」禁用
  const hasTaintChanges = computed(() => {
    const plan = planTaintChanges();
    return plan.taintsToDelete.length > 0 || plan.taintsToAdd.length > 0;
  });

  const submitTaintForm = async () => {
    if (!taintFormRef.value || !currentOperationNode.value) return;

    const plan = planTaintChanges();
    const { taintsToAdd, taintsToDelete } = plan;
    if (taintsToDelete.length === 0 && taintsToAdd.length === 0) return;

    // c-6：调用接口前按变更内容逐项校验，任一越权就整单不发请求，弹窗保持打开
    const { can } = usePermission();
    // 新增行与已保存污点同 key（等于修改已有污点）：没有删除权限时拦下，不发请求
    if (plan.conflictKeys.length > 0 && !can('k8s.node.taintDelete')) {
      message.error({
        content: TAINT_KEY_EXISTS_MESSAGE,
        key: TAINT_KEY_EXISTS_MESSAGE,
      });
      return;
    }
    // 同一 key + effect 重复：谁都不能提交
    if (plan.duplicateKeys.length > 0) {
      message.error({
        content: TAINT_DUPLICATE_EFFECT_MESSAGE,
        key: TAINT_DUPLICATE_EFFECT_MESSAGE,
      });
      return;
    }
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

  // S1b（清单 v4 #84 / #85 / #87）始终按码判断：除了按钮不渲染，函数入口也拦截，
  // 没有码时不弹确认、不发 cordon / uncordon 请求（验收标准 v3 FE-02「包括直接调用对应函数」）
  const denyWithoutCode = (key: 'k8s.node.batchCordon' | 'k8s.node.cordon' | 'k8s.node.uncordon') => {
    if (usePermission().can(key)) return false;
    message.error({
      content: PERMISSION_DENIED_MESSAGE,
      key: PERMISSION_DENIED_MESSAGE_KEY,
    });
    return true;
  };

  // 节点调度操作（使用 cordon/uncordon 接口）
  const toggleNodeSchedule = async (record: K8sNode) => {
    // schedulable === 1 表示可调度，需要禁用调度（cordon）
    // schedulable === 2 表示不可调度，需要启用调度（uncordon）
    const needCordon = record.schedulable === 1;
    const action = needCordon ? '禁用' : '启用';
    if (denyWithoutCode(needCordon ? 'k8s.node.cordon' : 'k8s.node.uncordon')) return;
    
    Modal.confirm({
      title: `${action}节点调度`,
      content: `确定要${action}节点 "${record.name}" 的调度吗？`,
      okText: `确认${action}`,
      cancelText: '取消',
      centered: true,
      onOk: async () => {
        // 复审 P3-4：确认框打开期间权限可能被收回，点确定时再复核一次
        if (denyWithoutCode(needCordon ? 'k8s.node.cordon' : 'k8s.node.uncordon')) return;
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
    if (operation === '禁用调度' && denyWithoutCode('k8s.node.batchCordon')) return;
    
    Modal.confirm({
      title: `批量${operation}`,
      content: `确定要对选中的 ${selectedRows.value.length} 个节点执行${operation}操作吗？`,
      okText: '确认执行',
      cancelText: '取消',
      centered: true,
      onOk: async () => {
        // 复审 P3-4：确认框打开期间权限可能被收回，点确定时再复核一次
        if (operation === '禁用调度' && denyWithoutCode('k8s.node.batchCordon')) return;
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
