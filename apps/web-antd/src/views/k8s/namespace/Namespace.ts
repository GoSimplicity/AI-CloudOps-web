import { ref, computed } from 'vue';
import { message, Modal } from 'ant-design-vue';
import type { FormInstance, Rule } from 'ant-design-vue/es/form';
import {
  type K8sNamespace,
  type K8sNamespaceListReq,
  type CreateNamespaceReq,
  type UpdateNamespaceReq,
  type DeleteNamespaceReq,
  getNamespacesListApi,
  createNamespaceApi,
  deleteNamespaceApi,
  getNamespaceDetailsApi,
  updateNamespaceApi,
} from '#/api/core/k8s/k8s_namespace';
import {
  type K8sCluster,
  type ListClustersReq,
  type KeyValueList,
  getClustersListApi,
  Env,
} from '#/api/core/k8s/k8s_cluster';

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
    labels: Record<string, string>;
    annotations: Record<string, string>;
  }>({
    labels: {},
    annotations: {},
  });

  // 创建命名空间表单模型
  const createFormModel = ref<{
    name: string;
    labels: Record<string, string>;
    annotations: Record<string, string>;
  }>({
    name: '',
    labels: {},
    annotations: {},
  });

  // 删除命名空间表单模型
  const deleteFormModel = ref<{
    grace_period_seconds: number;
    force: 1 | 2;
  }>({
    grace_period_seconds: 30,
    force: 2, // 默认非强制删除
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
      { required: true, message: '请输入命名空间名称', trigger: 'blur' },
      { pattern: /^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/, message: '命名空间名称只能包含小写字母、数字和连字符，且不能以连字符开头或结尾', trigger: 'blur' },
      { max: 63, message: '命名空间名称长度不能超过63个字符', trigger: 'blur' }
    ]
  };

  const deleteFormRules: Record<string, Rule[]> = {
    grace_period_seconds: [
      { required: true, message: '请输入优雅删除时间', trigger: 'blur' },
      { type: 'number', min: 0, max: 3600, message: '优雅删除时间必须在0-3600秒之间', trigger: 'blur' }
    ]
  };


  // computed
  const filteredNamespaces = computed(() => {
    return namespaces.value;
  });

  const rowSelection = computed(() => ({
    selectedRowKeys: selectedRowKeys.value,
    onChange: (keys: string[], rows: K8sNamespace[]) => {
      selectedRowKeys.value = keys;
      selectedRows.value = rows;
    },
  }));

  // helpers
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

  // 转换函数：Record<string, string> -> KeyValueList
  const recordToKeyValueList = (record: Record<string, string>): KeyValueList => {
    return Object.entries(record).map(([key, value]) => ({ key, value }));
  };

  // 转换函数：KeyValueList -> Record<string, string>
  const keyValueListToRecord = (list?: KeyValueList): Record<string, string> => {
    if (!list) return {};
    return list.reduce((acc, { key, value }) => {
      acc[key] = value;
      return acc;
    }, {} as Record<string, string>);
  };

  const getStatusText = (status?: string) => {
    const map: Record<string, string> = {
      [NamespaceStatus.Active]: '活跃',
      [NamespaceStatus.Terminating]: '终止中',
      [NamespaceStatus.Unknown]: '未知',
    };
    return status ? map[status] || status : '未知';
  };

  const getStatusColor = (status?: string) => {
    const map: Record<string, string> = {
      [NamespaceStatus.Active]: 'success',
      [NamespaceStatus.Terminating]: 'warning',
      [NamespaceStatus.Unknown]: 'default',
    };
    return status ? map[status] || 'default' : 'default';
  };

  const getPhaseText = (phase?: string) => {
    return phase || '-';
  };

  const getPhaseColor = (phase?: string) => {
    const map: Record<string, string> = {
      'Active': 'success',
      'Terminating': 'warning',
    };
    return phase ? map[phase] || 'default' : 'default';
  };

  // cluster operations
  const clearNamespaces = () => {
    namespaces.value = [];
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
          // 自动加载该集群的命名空间数据
          await fetchNamespaces();
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
  const fetchNamespaces = async () => {
    if (!filterClusterId.value) {
      message.warning('请先选择集群');
      return;
    }

    try {
      loading.value = true;
      const params: K8sNamespaceListReq = {
        cluster_id: filterClusterId.value,
        page: currentPage.value,
        size: pageSize.value,
        search: searchText.value || undefined,
        status: filterStatus.value || undefined,
        labels: Object.keys(filterLabels.value).length > 0 ? recordToKeyValueList(filterLabels.value) : undefined,
      };
      const res = await getNamespacesListApi(filterClusterId.value, params);
      namespaces.value = res?.items || [];
      total.value = res?.total || 0;
    } catch (err) {
      message.error('获取命名空间列表失败');
      console.error(err);
    } finally {
      loading.value = false;
    }
  };

  // 查看详情
  const showNamespaceDetail = async (record: K8sNamespace) => {
    try {
      detailLoading.value = true;
      isDetailModalVisible.value = true;
      const res = await getNamespaceDetailsApi(record.cluster_id, record.name);
      currentNamespaceDetail.value = res || record;
    } catch (err) {
      message.error('获取命名空间详情失败');
      console.error(err);
      currentNamespaceDetail.value = record;
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
      name: '',
      labels: {},
      annotations: {},
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
        cluster_id: filterClusterId.value,
        name: createFormModel.value.name,
        labels: Object.keys(createFormModel.value.labels).length > 0 ? recordToKeyValueList(createFormModel.value.labels) : undefined,
        annotations: Object.keys(createFormModel.value.annotations).length > 0 ? recordToKeyValueList(createFormModel.value.annotations) : undefined,
      };
      
      await createNamespaceApi(filterClusterId.value, params);
      message.success('🎉 命名空间创建成功');
      isCreateModalVisible.value = false;
      await fetchNamespaces();
    } catch (err: unknown) {
      if (err && typeof err === 'object' && 'errorFields' in err) {
        message.warning('请检查表单填写是否正确');
        return;
      }
      message.error('❌ 命名空间创建失败');
      console.error(err);
    } finally {
      submitLoading.value = false;
    }
  };


  const openEditLabelModal = (record: K8sNamespace) => {
    currentOperationNamespace.value = record;
    isLabelEdit.value = true;
    labelFormModel.value = {
      labels: keyValueListToRecord(record.labels),
      annotations: keyValueListToRecord(record.annotations),
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
        cluster_id: currentOperationNamespace.value.cluster_id,
        name: currentOperationNamespace.value.name,
        labels: Object.keys(labelFormModel.value.labels).length > 0 ? recordToKeyValueList(labelFormModel.value.labels) : undefined,
        annotations: Object.keys(labelFormModel.value.annotations).length > 0 ? recordToKeyValueList(labelFormModel.value.annotations) : undefined,
      };
      
      await updateNamespaceApi(currentOperationNamespace.value.cluster_id, currentOperationNamespace.value.name, params);
      message.success('🎉 命名空间标签/注解更新成功');
      isLabelModalVisible.value = false;
      await fetchNamespaces();
    } catch (err: unknown) {
      message.error('❌ 标签/注解更新失败');
      console.error(err);
    } finally {
      submitLoading.value = false;
    }
  };

  // 删除命名空间
  const deleteNamespace = (record: K8sNamespace) => {
    currentOperationNamespace.value = record;
    deleteFormModel.value = {
      grace_period_seconds: 30,
      force: 2, // 非强制删除
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
        name: currentOperationNamespace.value.name,
        force: deleteFormModel.value.force,
        grace_period_seconds: deleteFormModel.value.grace_period_seconds,
      };
      
      await deleteNamespaceApi(currentOperationNamespace.value.cluster_id, currentOperationNamespace.value.name, params);
      message.success('✅ 命名空间删除成功');
      isDeleteModalVisible.value = false;
      await fetchNamespaces();
    } catch (err) {
      message.error('❌ 命名空间删除失败');
      console.error(err);
    } finally {
      submitLoading.value = false;
    }
  };

  const forceDeleteNamespace = (record: K8sNamespace) => {
    Modal.confirm({
      title: '强制删除命名空间',
      content: `确定要强制删除命名空间 "${record.name}" 吗？强制删除将忽略终结器，可能导致资源泄露！`,
      okText: '确认强制删除',
      okType: 'danger',
      cancelText: '取消',
      centered: true,
      onOk: async () => {
        try {
          const params: DeleteNamespaceReq = {
            cluster_id: record.cluster_id,
            name: record.name,
            force: 1, // 强制删除
            grace_period_seconds: 0,
          };
          await deleteNamespaceApi(record.cluster_id, record.name, params);
          message.success('✅ 命名空间强制删除成功');
          await fetchNamespaces();
        } catch (err) {
          message.error('❌ 命名空间强制删除失败');
          console.error(err);
        }
      },
    });
  };

  const removeLabelField = (key: string) => {
    delete labelFormModel.value.labels[key];
  };

  const removeAnnotationField = (key: string) => {
    delete labelFormModel.value.annotations[key];
  };

  const removeCreateLabelField = (key: string) => {
    delete createFormModel.value.labels[key];
  };

  const removeCreateAnnotationField = (key: string) => {
    delete createFormModel.value.annotations[key];
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
    delete filterLabels.value[key];
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
    if (!selectedRows.value.length) return;
    
    Modal.confirm({
      title: `批量${operation}`,
      content: `确定要对选中的 ${selectedRows.value.length} 个命名空间执行${operation}操作吗？`,
      okText: '确认执行',
      okType: operation === '删除' ? 'danger' : 'primary',
      cancelText: '取消',
      centered: true,
      onOk: async () => {
        try {
          // 根据不同操作类型执行相应的批量操作
          if (operation === '删除') {
            for (const ns of selectedRows.value) {
              const params: DeleteNamespaceReq = {
                cluster_id: ns.cluster_id,
                name: ns.name,
                force: 2,
              };
              await deleteNamespaceApi(ns.cluster_id, ns.name, params);
            }
          }
          message.success(`✅ 批量${operation}操作已完成`);
          selectedRowKeys.value = [];
          selectedRows.value = [];
          await fetchNamespaces();
        } catch (err) {
          message.error(`❌ 批量${operation}失败`);
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
    await fetchNamespaces();
  };

  // 标签检查辅助函数
  const hasSystemLabels = (labels: Record<string, string>) => {
    if (!labels) return false;
    return Object.keys(labels).some(key => 
      String(key).startsWith('kubernetes.io/') || String(key).startsWith('k8s.io/')
    );
  };

  const hasUserLabels = (labels: Record<string, string>) => {
    if (!labels) return false;
    return Object.keys(labels).some(key => 
      !String(key).startsWith('kubernetes.io/') && !String(key).startsWith('k8s.io/')
    );
  };

  // 针对 KeyValueList 类型的标签检查函数
  const getSystemLabelsFromKeyValueList = (labels?: KeyValueList) => {
    if (!labels) return [];
    return labels.filter(item => 
      String(item.key).startsWith('kubernetes.io/') || String(item.key).startsWith('k8s.io/')
    );
  };

  const getUserLabelsFromKeyValueList = (labels?: KeyValueList) => {
    if (!labels) return [];
    return labels.filter(item => 
      !String(item.key).startsWith('kubernetes.io/') && !String(item.key).startsWith('k8s.io/')
    );
  };

  return {
    // state
    namespaces,
    clusters,
    loading,
    clustersLoading,
    searchText,
    filterStatus,
    filterClusterId,
    filterLabels,
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
    createFormRef,
    
    // modal state
    isLabelModalVisible,
    isCreateModalVisible,
    isDeleteModalVisible,
    isLabelEdit,
    submitLoading,
    
    // detail modal
    isDetailModalVisible,
    detailLoading,
    currentNamespaceDetail,
    
    // operation target
    currentOperationNamespace,
    
    // form models
    labelFormModel,
    createFormModel,
    deleteFormModel,
    labelsFilterFormModel,
    
    // form rules
    labelFormRules,
    createFormRules,
    deleteFormRules,
    
    // computed
    filteredNamespaces,
    rowSelection,
    
    // helpers
    getEnvText,
    getStatusText,
    getStatusColor,
    getPhaseText,
    getPhaseColor,
    recordToKeyValueList,
    keyValueListToRecord,
    hasSystemLabels,
    hasUserLabels,
    getSystemLabelsFromKeyValueList,
    getUserLabelsFromKeyValueList,
    
    // operations
    fetchClusters,
    fetchNamespaces,
    clearNamespaces,
    showNamespaceDetail,
    closeDetailModal,
    
    // create operations
    openCreateModal,
    closeCreateModal,
    submitCreateForm,
    
    // label operations
    openEditLabelModal,
    closeLabelModal,
    submitLabelForm,
    removeLabelField,
    removeAnnotationField,
    removeCreateLabelField,
    removeCreateAnnotationField,
    
    // delete operations
    deleteNamespace,
    forceDeleteNamespace,
    closeDeleteModal,
    submitDeleteForm,
    
    // filter operations
    addFilterLabel,
    removeFilterLabel,
    clearFilterLabels,
    
    // batch operations
    batchOperation,
    
    // cluster pagination
    loadMoreClusters,
    resetClusters,
    handlePageChange,
    
    // constants
    NamespaceStatus,
  };
}
