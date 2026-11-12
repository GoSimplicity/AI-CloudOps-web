import type { FormInstance, Rule } from 'ant-design-vue/es/form';

import { computed, ref } from 'vue';

import { message, Modal } from 'ant-design-vue';

import {
  Env,
  getClustersListApi,
  type K8sCluster,
  type KeyValueList,
  type ListClustersReq,
} from '#/api/core/k8s/k8s_cluster';
import {
  createNamespaceApi,
  type CreateNamespaceReq,
  deleteNamespaceApi,
  type DeleteNamespaceReq,
  getNamespaceDetailsApi,
  getNamespacesListApi,
  type K8sNamespace,
  type K8sNamespaceListReq,
  updateNamespaceApi,
  type UpdateNamespaceReq,
} from '#/api/core/k8s/k8s_namespace';
import { getOwnLookupValue } from '#/utils/own-lookup';
import {
  shouldNotifyPageError,
  shouldRecordPageError,
} from '#/utils/permission/request-notice';

// 命名空间状态枚举
export enum NamespaceStatus {
  Active = 'Active',
  Terminating = 'Terminating',
  Unknown = 'Unknown',
}

export function useNamespacePage() {
  // state
  const namespaces = ref<K8sNamespace[]>([]);
  const clusters = ref<K8sCluster[]>([]);
  const loading = ref(false);
  const loadError = ref('');
  let namespaceRequestId = 0;
  const clustersError = ref('');
  const clustersLoading = ref(false);
  const searchText = ref('');
  const filterStatus = ref<string | undefined>(undefined);
  const filterClusterId = ref<number | undefined>(undefined);
  const filterLabels = ref<Record<string, string>>({}); // 新增：标签过滤
  const selectedRowKeys = ref<string[]>([]);
  const selectedRows = ref<K8sNamespace[]>([]);
  const currentPage = ref(1);
  const pageSize = ref(10);
  const total = ref(0);
  const clustersTotal = ref(0); // 用于集群下拉选择
  const clustersPage = ref(1);
  const clustersSize = ref(50); // 集群下拉选择每页数量

  // form refs
  const labelFormRef = ref<FormInstance>();
  const createFormRef = ref<FormInstance>();

  // modal/form state
  const isLabelModalVisible = ref(false);
  const isCreateModalVisible = ref(false);
  const isDeleteModalVisible = ref(false); // 新增：删除确认模态框
  const isLabelEdit = ref(false);
  const submitLoading = ref(false);

  // detail modal state
  const isDetailModalVisible = ref(false);
  const detailLoading = ref(false);
  const currentNamespaceDetail = ref<K8sNamespace | null>(null);

  // current namespace for operations
  const currentOperationNamespace = ref<K8sNamespace | null>(null);

  // 标签/注解表单模型
  const labelFormModel = ref<{
    annotations: Record<string, string>;
    labels: Record<string, string>;
  }>({
    annotations: {},
    labels: {},
  });

  // 创建命名空间表单模型
  const createFormModel = ref<{
    annotations: Record<string, string>;
    labels: Record<string, string>;
    name: string;
  }>({
    annotations: {},
    labels: {},
    name: '',
  });

  // 删除命名空间表单模型
  const deleteFormModel = ref<{
    force: 1 | 2;
    grace_period_seconds: number;
  }>({
    force: 2, // 默认非强制删除
    grace_period_seconds: 30,
  });

  // 标签过滤表单模型
  const labelsFilterFormModel = ref<{
    labels: Record<string, string>;
  }>({
    labels: {},
  });

  // 表单验证规则
  const labelFormRules: Record<string, Rule[]> = {
    // 动态验证标签和注解
  };

  const createFormRules: Record<string, Rule[]> = {
    name: [
      { message: '请输入命名空间名称', required: true, trigger: 'blur' },
      {
        message:
          '命名空间名称只能包含小写字母、数字和连字符，且不能以连字符开头或结尾',
        pattern: /^[\da-z]([\da-z-]*[\da-z])?$/,
        trigger: 'blur',
      },
      { max: 63, message: '命名空间名称长度不能超过63个字符', trigger: 'blur' },
    ],
  };

  const deleteFormRules: Record<string, Rule[]> = {
    grace_period_seconds: [
      { message: '请输入优雅删除时间', required: true, trigger: 'blur' },
      {
        max: 3600,
        message: '优雅删除时间必须在0-3600秒之间',
        min: 0,
        trigger: 'blur',
        type: 'number',
      },
    ],
  };

  // computed
  const filteredNamespaces = computed(() => {
    return namespaces.value;
  });

  const rowSelection = computed(() => ({
    onChange: (keys: string[], rows: K8sNamespace[]) => {
      selectedRowKeys.value = keys;
      selectedRows.value = rows;
    },
    selectedRowKeys: selectedRowKeys.value,
  }));

  // helpers
  const validateClusterId = (record: any): null | number => {
    const clusterId = record.cluster_id || filterClusterId.value;
    if (!clusterId || clusterId === 0) {
      message.error('无效的集群ID，请重新选择集群');
      return null;
    }
    return clusterId;
  };

  const getEnvText = (env?: Env | string) => {
    if (env === undefined || env === null) return '未知环境';
    const value = typeof env === 'string' ? Number.parseInt(env) : env;
    const map: Record<number, string> = {
      [Env.Dev]: '开发',
      [Env.Press]: '灰度',
      [Env.Prod]: '生产',
      [Env.Rc]: '测试',
      [Env.Stage]: '预发',
    };
    return map[value] || '未知环境';
  };

  // 转换函数：Record<string, string> -> KeyValueList
  const recordToKeyValueList = (
    record: Record<string, string>,
  ): KeyValueList => {
    return Object.entries(record).map(([key, value]: [string, string]) => ({
      key,
      value,
    }));
  };

  // 转换函数：KeyValueList 或对象 -> Record<string, string>
  const keyValueListToRecord = (
    data?: KeyValueList | Record<string, string>,
  ): Record<string, string> => {
    if (!data) return {};

    // 如果已经是对象格式，直接返回
    if (typeof data === 'object' && !Array.isArray(data)) {
      return data as Record<string, string>;
    }

    // 如果是数组格式，进行转换
    if (Array.isArray(data)) {
      const record: Record<string, string> = {};
      for (const { key, value } of data) record[key] = value;
      return record;
    }

    return {};
  };

  const getStatusText = (status?: string) => {
    if (!status) return '未知';

    // Handle both Chinese and English status
    const map: Record<string, string> = {
      [NamespaceStatus.Active]: '活跃',
      [NamespaceStatus.Terminating]: '终止中',
      [NamespaceStatus.Unknown]: '未知',
      未知: '未知',
      活跃: '活跃',
      终止中: '终止中',
    };
    return map[status] || status;
  };

  const getStatusColor = (status?: string) => {
    if (!status) return 'default';

    // Handle both Chinese and English status
    const map: Record<string, string> = {
      [NamespaceStatus.Active]: 'success',
      [NamespaceStatus.Terminating]: 'warning',
      [NamespaceStatus.Unknown]: 'default',
      未知: 'default',
      活跃: 'success',
      终止中: 'warning',
    };
    return map[status] || 'default';
  };

  const getPhaseText = (phase?: string) => {
    if (!phase) return '-';

    const map: Record<string, string> = {
      Active: '活跃',
      Failed: '失败',
      Pending: '待定',
      Terminating: '终止中',
    };
    return getOwnLookupValue(map, phase) || phase;
  };

  const getPhaseColor = (phase?: string) => {
    if (!phase) return 'default';

    const map: Record<string, string> = {
      Active: 'success',
      Failed: 'error',
      Pending: 'processing',
      Terminating: 'warning',
    };
    return getOwnLookupValue(map, phase) || 'default';
  };

  const getClusterName = (clusterId?: number) => {
    if (!clusterId) return '-';
    const cluster = clusters.value.find((c) => c.id === clusterId);
    return cluster?.name || `集群 ${clusterId}`;
  };

  // cluster operations
  const clearNamespaces = () => {
    namespaceRequestId++;
    loading.value = false;
    namespaces.value = [];
    total.value = 0;
    loadError.value = '';
    selectedRowKeys.value = [];
    selectedRows.value = [];
  };

  // crud operations
  const fetchNamespaces = async () => {
    const clusterId = filterClusterId.value;
    if (!clusterId) {
      clearNamespaces();
      return;
    }

    const requestId = ++namespaceRequestId;
    try {
      loading.value = true;
      loadError.value = '';
      selectedRowKeys.value = [];
      selectedRows.value = [];
      const params: K8sNamespaceListReq = {
        cluster_id: clusterId,
        labels:
          Object.keys(filterLabels.value).length > 0
            ? recordToKeyValueList(filterLabels.value)
            : undefined,
        page: currentPage.value,
        search: searchText.value || undefined,
        size: pageSize.value,
        status: filterStatus.value || undefined,
      };
      const res = await getNamespacesListApi(clusterId, params);
      if (
        requestId !== namespaceRequestId ||
        filterClusterId.value !== clusterId
      )
        return;
      // 确保每个namespace对象都有正确的cluster_id
      const namespacesWithClusterId = (res?.items || []).map(
        (namespace: any) => ({
          ...namespace,
          cluster_id: namespace.cluster_id || clusterId,
        }),
      );
      namespaces.value = namespacesWithClusterId;
      total.value = res?.total || 0;
    } catch (error) {
      if (
        requestId !== namespaceRequestId ||
        filterClusterId.value !== clusterId
      )
        return;
      clearNamespaces();
      if (shouldRecordPageError(error))
        loadError.value = '获取命名空间列表失败，请重试';
      if (shouldNotifyPageError(error)) message.error(loadError.value);
    } finally {
      if (requestId === namespaceRequestId) loading.value = false;
    }
  };

  // 重置集群列表
  const resetClusters = () => {
    clustersPage.value = 1;
    clusters.value = [];
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
        size: clustersSize.value, // 动态获取集群，用于下拉选择
      };
      const res = await getClustersListApi(params);
      // 如果是第一页，直接赋值；否则追加到现有数据
      clusters.value =
        clustersPage.value === 1
          ? res?.items || []
          : [...clusters.value, ...(res?.items || [])];
      clustersTotal.value = res?.total || 0;

      // 如果当前没有选择集群且有可用集群，自动选择第一个
      if (!filterClusterId.value && clusters.value.length > 0) {
        const firstCluster = clusters.value[0];
        if (firstCluster?.id) {
          filterClusterId.value = firstCluster.id;
          // 自动加载该集群的命名空间数据
          await fetchNamespaces();
        }
      }
    } catch (error) {
      if (clustersPage.value === 1) {
        clusters.value = [];
        clustersTotal.value = 0;
        filterClusterId.value = undefined;
        clearNamespaces();
      }
      if (shouldRecordPageError(error))
        clustersError.value = '获取集群列表失败，请重试';
      if (shouldNotifyPageError(error)) message.error(clustersError.value);
    } finally {
      clustersLoading.value = false;
    }
  };

  // 查看详情
  const showNamespaceDetail = async (record: K8sNamespace) => {
    const clusterId = validateClusterId(record);
    if (!clusterId) return;

    try {
      detailLoading.value = true;
      isDetailModalVisible.value = true;
      const res = await getNamespaceDetailsApi(clusterId, record.name);
      currentNamespaceDetail.value = res || {
        ...record,
        cluster_id: clusterId,
      };
    } catch (error) {
      if (shouldNotifyPageError(error)) message.error('获取命名空间详情失败');

      currentNamespaceDetail.value = { ...record, cluster_id: clusterId };
    } finally {
      detailLoading.value = false;
    }
  };

  const closeDetailModal = () => {
    isDetailModalVisible.value = false;
    currentNamespaceDetail.value = null;
  };

  // 创建命名空间
  const openCreateModal = () => {
    createFormModel.value = {
      annotations: {},
      labels: {},
      name: '',
    };
    isCreateModalVisible.value = true;
  };

  const closeCreateModal = () => {
    isCreateModalVisible.value = false;
  };

  const submitCreateForm = async () => {
    if (!createFormRef.value || !filterClusterId.value) return;

    try {
      await createFormRef.value.validate();
      submitLoading.value = true;

      const params: CreateNamespaceReq = {
        annotations:
          Object.keys(createFormModel.value.annotations).length > 0
            ? recordToKeyValueList(createFormModel.value.annotations)
            : undefined,
        cluster_id: filterClusterId.value,
        labels:
          Object.keys(createFormModel.value.labels).length > 0
            ? recordToKeyValueList(createFormModel.value.labels)
            : undefined,
        name: createFormModel.value.name,
      };

      await createNamespaceApi(filterClusterId.value, params);
      message.success('命名空间创建成功');
      isCreateModalVisible.value = false;
      await fetchNamespaces();
    } catch (error: unknown) {
      if (error && typeof error === 'object' && 'errorFields' in error) {
        if (shouldNotifyPageError(error))
          message.warning('请检查表单填写是否正确');
        return;
      }
      if (shouldNotifyPageError(error)) message.error('命名空间创建失败');
    } finally {
      submitLoading.value = false;
    }
  };

  const openEditLabelModal = (record: K8sNamespace) => {
    currentOperationNamespace.value = record;
    isLabelEdit.value = true;
    labelFormModel.value = {
      annotations: keyValueListToRecord(record.annotations),
      labels: keyValueListToRecord(record.labels),
    };
    isLabelModalVisible.value = true;
  };

  const closeLabelModal = () => {
    isLabelModalVisible.value = false;
    currentOperationNamespace.value = null;
  };

  const submitLabelForm = async () => {
    if (!labelFormRef.value || !currentOperationNamespace.value) return;

    try {
      submitLoading.value = true;

      const params: UpdateNamespaceReq = {
        annotations: recordToKeyValueList(labelFormModel.value.annotations),
        cluster_id: currentOperationNamespace.value.cluster_id,
        labels: recordToKeyValueList(labelFormModel.value.labels),
        name: currentOperationNamespace.value.name,
      };

      await updateNamespaceApi(
        currentOperationNamespace.value.cluster_id,
        currentOperationNamespace.value.name,
        params,
      );
      message.success('命名空间标签/注解更新成功');
      isLabelModalVisible.value = false;
      await fetchNamespaces();
    } catch (error: unknown) {
      if (shouldNotifyPageError(error)) message.error('标签/注解更新失败');
    } finally {
      submitLoading.value = false;
    }
  };

  // 删除命名空间
  const deleteNamespace = (record: K8sNamespace) => {
    currentOperationNamespace.value = record;
    deleteFormModel.value = {
      force: 2, // 非强制删除
      grace_period_seconds: 30,
    };
    isDeleteModalVisible.value = true;
  };

  const closeDeleteModal = () => {
    isDeleteModalVisible.value = false;
    currentOperationNamespace.value = null;
  };

  const submitDeleteForm = async () => {
    if (!currentOperationNamespace.value) return;

    try {
      submitLoading.value = true;

      const params: DeleteNamespaceReq = {
        cluster_id: currentOperationNamespace.value.cluster_id,
        force: deleteFormModel.value.force,
        grace_period_seconds: deleteFormModel.value.grace_period_seconds,
        name: currentOperationNamespace.value.name,
      };

      await deleteNamespaceApi(
        currentOperationNamespace.value.cluster_id,
        currentOperationNamespace.value.name,
        params,
      );
      message.success('命名空间删除成功');
      isDeleteModalVisible.value = false;
      await fetchNamespaces();
    } catch (error) {
      if (shouldNotifyPageError(error)) message.error('命名空间删除失败');
    } finally {
      submitLoading.value = false;
    }
  };

  const forceDeleteNamespace = (record: K8sNamespace) => {
    Modal.confirm({
      cancelText: '取消',
      centered: true,
      content: `确定要强制删除命名空间 "${record.name}" 吗？强制删除将忽略终结器，可能导致资源泄露！`,
      okText: '确认强制删除',
      okType: 'danger',
      onOk: async () => {
        try {
          const clusterId = record.cluster_id || filterClusterId.value;
          if (!clusterId || clusterId === 0) {
            message.error('无效的集群ID，请重新选择集群');
            return;
          }

          const params: DeleteNamespaceReq = {
            cluster_id: clusterId,
            force: 1, // 强制删除
            grace_period_seconds: 0,
            name: record.name,
          };
          await deleteNamespaceApi(clusterId, record.name, params);
          message.success('命名空间强制删除成功');
          await fetchNamespaces();
        } catch (error) {
          if (shouldNotifyPageError(error))
            message.error('命名空间强制删除失败');
        }
      },
      title: '强制删除命名空间',
    });
  };

  const removeLabelField = (key: string) => {
    Reflect.deleteProperty(labelFormModel.value.labels, key);
  };

  const removeAnnotationField = (key: string) => {
    Reflect.deleteProperty(labelFormModel.value.annotations, key);
  };

  const removeCreateLabelField = (key: string) => {
    Reflect.deleteProperty(createFormModel.value.labels, key);
  };

  const removeCreateAnnotationField = (key: string) => {
    Reflect.deleteProperty(createFormModel.value.annotations, key);
  };

  // 标签过滤管理
  const addFilterLabel = (key: string, value: string) => {
    if (key && key.trim()) {
      filterLabels.value[key.trim()] = value;
      currentPage.value = 1;
      fetchNamespaces();
    }
  };

  const removeFilterLabel = (key: string) => {
    Reflect.deleteProperty(filterLabels.value, key);
    currentPage.value = 1;
    fetchNamespaces();
  };

  const clearFilterLabels = () => {
    filterLabels.value = {};
    currentPage.value = 1;
    fetchNamespaces();
  };

  // 批量操作
  const batchOperation = (operation: string) => {
    if (selectedRows.value.length === 0) return;

    Modal.confirm({
      cancelText: '取消',
      centered: true,
      content: `确定要对选中的 ${selectedRows.value.length} 个命名空间执行${operation}操作吗？`,
      okText: '确认执行',
      okType: operation === '删除' ? 'danger' : 'primary',
      onOk: async () => {
        try {
          // 根据不同操作类型执行相应的批量操作
          if (operation === '删除') {
            for (const ns of selectedRows.value) {
              const params: DeleteNamespaceReq = {
                cluster_id: ns.cluster_id,
                force: 2,
                name: ns.name,
              };
              await deleteNamespaceApi(ns.cluster_id, ns.name, params);
            }
          }
          message.success(`批量${operation}操作已完成`);
          selectedRowKeys.value = [];
          selectedRows.value = [];
          await fetchNamespaces();
        } catch (error) {
          if (shouldNotifyPageError(error))
            message.error(`批量${operation}失败`);
        }
      },
      title: `批量${operation}`,
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

  // 分页变化处理
  const handlePageChange = async (page: number, size?: number) => {
    currentPage.value = page;
    if (size && size !== pageSize.value) {
      pageSize.value = size;
    }
    await fetchNamespaces();
  };

  // 标签检查辅助函数
  const hasSystemLabels = (labels: Record<string, string>) => {
    if (!labels) return false;
    return Object.keys(labels).some(
      (key) =>
        String(key).startsWith('kubernetes.io/') ||
        String(key).startsWith('k8s.io/'),
    );
  };

  const hasUserLabels = (labels: Record<string, string>) => {
    if (!labels) return false;
    return Object.keys(labels).some(
      (key) =>
        !String(key).startsWith('kubernetes.io/') &&
        !String(key).startsWith('k8s.io/'),
    );
  };

  // 针对 KeyValueList 类型的标签检查函数
  const getSystemLabelsFromKeyValueList = (labels?: KeyValueList) => {
    if (!labels) return [];
    return labels.filter(
      (item) =>
        String(item.key).startsWith('kubernetes.io/') ||
        String(item.key).startsWith('k8s.io/'),
    );
  };

  const getUserLabelsFromKeyValueList = (labels?: KeyValueList) => {
    if (!labels) return [];
    return labels.filter(
      (item) =>
        !String(item.key).startsWith('kubernetes.io/') &&
        !String(item.key).startsWith('k8s.io/'),
    );
  };

  return {
    // filter operations
    addFilterLabel,
    // batch operations
    batchOperation,
    clearFilterLabels,
    // operations
    clearNamespaces,
    // create operations
    closeCreateModal,
    // delete operations
    closeDeleteModal,
    closeDetailModal,
    // label operations
    closeLabelModal,
    // state
    clusters,
    clustersError,
    clustersLoading,
    clustersPage,
    clustersSize,
    clustersTotal,
    // form models
    createFormModel,
    // form refs
    createFormRef,
    // form rules
    createFormRules,
    // detail modal
    currentNamespaceDetail,

    // operation target
    currentOperationNamespace,
    currentPage,

    deleteFormModel,
    deleteFormRules,
    deleteNamespace,
    detailLoading,
    fetchClusters,

    fetchNamespaces,
    filterClusterId,
    // computed
    filteredNamespaces,

    filterLabels,

    filterStatus,
    forceDeleteNamespace,
    // helpers
    getClusterName,
    getEnvText,

    getPhaseColor,
    getPhaseText,
    getStatusColor,

    getStatusText,
    getSystemLabelsFromKeyValueList,

    getUserLabelsFromKeyValueList,
    // cluster pagination
    handlePageChange,
    hasSystemLabels,
    hasUserLabels,
    // modal state
    isCreateModalVisible,
    isDeleteModalVisible,
    isDetailModalVisible,
    isLabelEdit,
    isLabelModalVisible,
    keyValueListToRecord,
    labelFormModel,
    labelFormRef,

    labelFormRules,
    labelsFilterFormModel,
    loadError,
    loading,
    loadMoreClusters,

    namespaces,
    // constants
    NamespaceStatus,
    openCreateModal,

    openEditLabelModal,
    pageSize,
    recordToKeyValueList,
    removeAnnotationField,
    removeCreateAnnotationField,
    removeCreateLabelField,
    removeFilterLabel,

    removeLabelField,
    resetClusters,
    rowSelection,
    searchText,

    selectedRowKeys,
    selectedRows,
    showNamespaceDetail,

    submitCreateForm,

    submitDeleteForm,
    submitLabelForm,
    submitLoading,

    total,
  };
}
