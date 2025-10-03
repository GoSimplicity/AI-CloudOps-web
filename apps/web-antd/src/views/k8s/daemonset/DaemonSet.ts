import { ref, computed } from 'vue';
import { message, Modal } from 'ant-design-vue';
import type { FormInstance, Rule } from 'ant-design-vue/es/form';
import {
  type K8sDaemonSet,
  type K8sDaemonSetHistory,
  type GetDaemonSetListReq,
  type CreateDaemonSetReq,
  type CreateDaemonSetByYamlReq,
  type UpdateDaemonSetReq,
  type UpdateDaemonSetByYamlReq,
  type RestartDaemonSetReq,
  type RollbackDaemonSetReq,
  K8sDaemonSetStatus,
  getDaemonSetListApi,
  getDaemonSetDetailsApi,
  getDaemonSetYamlApi,
  createDaemonSetApi,
  createDaemonSetByYamlApi,
  updateDaemonSetApi,
  updateDaemonSetByYamlApi,
  deleteDaemonSetApi,
  restartDaemonSetApi,
  rollbackDaemonSetApi,
  getDaemonSetPodsApi,
  getDaemonSetHistoryApi,
} from '#/api/core/k8s/k8s_daemonset';
import {
  type K8sCluster,
  type ListClustersReq,
  type KeyValueList,
  getClustersListApi,
  Env,
} from '#/api/core/k8s/k8s_cluster';
import {
  type K8sNamespace,
  type K8sNamespaceListReq,
  getNamespacesListApi,
} from '#/api/core/k8s/k8s_namespace';

export function useDaemonSetPage() {
  // state
  const daemonSets = ref<K8sDaemonSet[]>([]);
  const clusters = ref<K8sCluster[]>([]);
  const namespaces = ref<K8sNamespace[]>([]);
  const loading = ref(false);
  const clustersLoading = ref(false);
  const namespacesLoading = ref(false);
  const searchText = ref('');
  const filterStatus = ref<K8sDaemonSetStatus | undefined>(undefined);
  const filterClusterId = ref<number | undefined>(undefined);
  const filterNamespace = ref<string | undefined>(undefined);
  const filterLabels = ref<Record<string, string>>({});
  const selectedRowKeys = ref<string[]>([]);
  const selectedRows = ref<K8sDaemonSet[]>([]);
  const currentPage = ref(1);
  const pageSize = ref(10);
  const total = ref(0);
  const clustersTotal = ref(0);
  const clustersPage = ref(1);
  const clustersSize = ref(50);
  const namespacesTotal = ref(0);
  const namespacesPage = ref(1);
  const namespacesSize = ref(50);

  // form refs
  const formRef = ref<FormInstance>();
  const editFormRef = ref<FormInstance>();
  const rollbackFormRef = ref<FormInstance>();
  const yamlFormRef = ref<FormInstance>();
  const createYamlFormRef = ref<FormInstance>();

  // modal/form state
  const isCreateModalVisible = ref(false);
  const isCreateYamlModalVisible = ref(false);
  const isEditModalVisible = ref(false);
  const isDetailModalVisible = ref(false);
  const isRollbackModalVisible = ref(false);
  const isYamlModalVisible = ref(false);
  const isPodModalVisible = ref(false);
  const isHistoryModalVisible = ref(false);
  const submitLoading = ref(false);
  const detailLoading = ref(false);

  // current operation target
  const currentOperationDaemonSet = ref<K8sDaemonSet | null>(null);
  const currentDaemonSetDetail = ref<K8sDaemonSet | null>(null);
  const currentYamlContent = ref('');
  const daemonSetPods = ref<any[]>([]);
  const daemonSetHistory = ref<K8sDaemonSetHistory[]>([]);

  // form models
  const createFormModel = ref<{
    name: string;
    namespace: string;
    images: string[];
    labels: Record<string, string>;
    annotations: Record<string, string>;
  }>({
    name: '',
    namespace: '',
    images: [''],
    labels: {},
    annotations: {},
  });

  const editFormModel = ref<{
    name: string;
    namespace: string;
    image: string;
    labels: Record<string, string>;
    annotations: Record<string, string>;
  }>({
    name: '',
    namespace: '',
    image: '',
    labels: {},
    annotations: {},
  });

  const rollbackFormModel = ref<{
    revision: number;
  }>({
    revision: 1,
  });

  const yamlFormModel = ref<{
    yaml: string;
  }>({
    yaml: '',
  });

  const createYamlFormModel = ref<{
    yaml: string;
  }>({
    yaml: '',
  });

  // form validation rules
  const createFormRules: Record<string, Rule[]> = {
    name: [
      { required: true, message: '请输入 DaemonSet 名称', trigger: 'blur' },
      { pattern: /^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/, message: 'DaemonSet 名称只能包含小写字母、数字和连字符，且不能以连字符开头或结尾', trigger: 'blur' },
      { max: 63, message: 'DaemonSet 名称长度不能超过63个字符', trigger: 'blur' }
    ],
    namespace: [
      { required: true, message: '请选择命名空间', trigger: 'change' }
    ]
  };

  const rollbackFormRules: Record<string, Rule[]> = {
    revision: [
      { required: true, message: '请输入回滚版本', trigger: 'blur' },
      { type: 'number', min: 1, message: '版本号必须大于0', trigger: 'blur' }
    ]
  };

  const yamlFormRules: Record<string, Rule[]> = {
    yaml: [
      { required: true, message: '请输入 YAML 内容', trigger: 'blur' },
      { min: 50, message: 'YAML 内容过短，请检查是否完整', trigger: 'blur' }
    ]
  };

  const createYamlFormRules: Record<string, Rule[]> = {
    yaml: [
      { required: true, message: '请输入 YAML 内容', trigger: 'blur' },
      { min: 50, message: 'YAML 内容过短，请检查是否完整', trigger: 'blur' }
    ]
  };

  // computed
  const filteredDaemonSets = computed(() => {
    return daemonSets.value;
  });

  const rowSelection = computed(() => ({
    selectedRowKeys: selectedRowKeys.value,
    onChange: (keys: string[], rows: K8sDaemonSet[]) => {
      selectedRowKeys.value = keys;
      selectedRows.value = rows;
    },
  }));

  // helpers
  const validateClusterId = (record: K8sDaemonSet): number | null => {
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

  const getStatusText = (status?: K8sDaemonSetStatus) => {
    const map: Record<K8sDaemonSetStatus, string> = {
      [K8sDaemonSetStatus.Running]: '运行中',
      [K8sDaemonSetStatus.Error]: '异常',
      [K8sDaemonSetStatus.Updating]: '更新中',
    };
    return status !== undefined ? map[status] || '未知' : '未知';
  };

  const getStatusColor = (status?: K8sDaemonSetStatus) => {
    const map: Record<K8sDaemonSetStatus, string> = {
      [K8sDaemonSetStatus.Running]: 'success',
      [K8sDaemonSetStatus.Error]: 'error',
      [K8sDaemonSetStatus.Updating]: 'processing',
    };
    return status !== undefined ? map[status] || 'default' : 'default';
  };

  // 转换函数：KeyValueList 或对象 -> Record<string, string>
  const keyValueListToRecord = (data?: KeyValueList | Record<string, string>): Record<string, string> => {
    if (!data) return {};
    
    // 如果已经是对象格式，直接返回
    if (typeof data === 'object' && !Array.isArray(data)) {
      return data as Record<string, string>;
    }
    
    // 如果是数组格式，进行转换
    if (Array.isArray(data)) {
      return data.reduce((acc, { key, value }) => {
        acc[key] = value;
        return acc;
      }, {} as Record<string, string>);
    }
    
    return {};
  };

  // cluster operations
  const clearDaemonSets = () => {
    daemonSets.value = [];
    selectedRowKeys.value = [];
    selectedRows.value = [];
  };

  const clearNamespaces = () => {
    resetNamespaces();
    filterNamespace.value = undefined;
  };

  const fetchClusters = async (reset = false) => {
    if (reset) {
      resetClusters();
    }
    try {
      clustersLoading.value = true;
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
          message.info(`已自动选择集群: ${firstCluster.name || '未知集群'}`);
          // 自动加载该集群的命名空间和DaemonSet数据
          await fetchNamespaces();
          await fetchDaemonSets();
        }
      }
    } catch (err) {
      message.error('获取集群列表失败');
      console.error(err);
    } finally {
      clustersLoading.value = false;
    }
  };

  const fetchNamespaces = async (reset = false) => {
    if (!filterClusterId.value) return;
    
    if (reset) {
      resetNamespaces();
    }
    
    try {
      namespacesLoading.value = true;
      const params: K8sNamespaceListReq = {
        cluster_id: filterClusterId.value,
        page: namespacesPage.value,
        size: namespacesSize.value,
      };
      const res = await getNamespacesListApi(filterClusterId.value, params);
      if (namespacesPage.value === 1) {
        namespaces.value = res?.items || [];
      } else {
        namespaces.value = [...namespaces.value, ...(res?.items || [])];
      }
      namespacesTotal.value = res?.total || 0;
    } catch (err) {
      message.error('获取命名空间列表失败');
      console.error(err);
    } finally {
      namespacesLoading.value = false;
    }
  };

  // crud operations
  const fetchDaemonSets = async () => {
    if (!filterClusterId.value || filterClusterId.value === 0) {
      message.warning('请先选择有效的集群');
      daemonSets.value = [];
      total.value = 0;
      return;
    }

    try {
      loading.value = true;
      const params: GetDaemonSetListReq = {
        page: currentPage.value,
        size: pageSize.value,
        search: searchText.value || undefined,
        cluster_id: filterClusterId.value,
        namespace: filterNamespace.value || undefined,
        status: filterStatus.value?.toString() || undefined,
        labels: Object.keys(filterLabels.value).length > 0 
          ? filterLabels.value
          : undefined,
      };
      const res = await getDaemonSetListApi(filterClusterId.value, params);
      // 确保每个daemonSet对象都有正确的cluster_id
      const daemonSetsWithClusterId = (res?.items || []).map((daemonSet: K8sDaemonSet) => ({
        ...daemonSet,
        cluster_id: daemonSet.cluster_id || filterClusterId.value || 0
      }));
      daemonSets.value = daemonSetsWithClusterId;
      total.value = res?.total || 0;
    } catch (err) {
      message.error('获取 DaemonSet 列表失败');
      console.error(err);
    } finally {
      loading.value = false;
    }
  };

  // 查看详情
  const showDaemonSetDetail = async (record: K8sDaemonSet) => {
    const clusterId = validateClusterId(record);
    if (!clusterId) return;
    
    try {
      detailLoading.value = true;
      isDetailModalVisible.value = true;
      const res = await getDaemonSetDetailsApi(clusterId, record.namespace, record.name);
      
      // 处理详情数据
      const processedDetail = res ? {
        ...res,
        cluster_id: clusterId
      } : { 
        ...record, 
        cluster_id: clusterId
      };
      
      currentDaemonSetDetail.value = processedDetail;
    } catch (err) {
      message.error('获取 DaemonSet 详情失败');
      console.error(err);
      // 错误时设置fallback数据
      const fallbackDetail = { 
        ...record, 
        cluster_id: clusterId
      };
      currentDaemonSetDetail.value = fallbackDetail;
    } finally {
      detailLoading.value = false;
    }
  };

  const closeDetailModal = () => {
    isDetailModalVisible.value = false;
    currentDaemonSetDetail.value = null;
  };

  // YAML 操作
  const showYamlModal = async (record: K8sDaemonSet) => {
    const clusterId = validateClusterId(record);
    if (!clusterId) return;
    
    try {
      submitLoading.value = true;
      currentOperationDaemonSet.value = { ...record, cluster_id: clusterId };
      const res = await getDaemonSetYamlApi(clusterId, record.namespace, record.name);
      currentYamlContent.value = res?.yaml || '';
      yamlFormModel.value.yaml = res?.yaml || '';
      isYamlModalVisible.value = true;
    } catch (err) {
      message.error('获取 DaemonSet YAML 失败');
      console.error(err);
    } finally {
      submitLoading.value = false;
    }
  };

  const closeYamlModal = () => {
    isYamlModalVisible.value = false;
    currentOperationDaemonSet.value = null;
    currentYamlContent.value = '';
    yamlFormModel.value.yaml = '';
  };

  const submitYamlForm = async () => {
    if (!yamlFormRef.value || !currentOperationDaemonSet.value) return;
    
    try {
      await yamlFormRef.value.validate();
      submitLoading.value = true;
      
      const params: UpdateDaemonSetByYamlReq = {
        cluster_id: currentOperationDaemonSet.value.cluster_id,
        namespace: currentOperationDaemonSet.value.namespace,
        name: currentOperationDaemonSet.value.name,
        yaml: yamlFormModel.value.yaml,
      };
      
      await updateDaemonSetByYamlApi(
        currentOperationDaemonSet.value.cluster_id,
        currentOperationDaemonSet.value.namespace,
        currentOperationDaemonSet.value.name,
        params
      );
      message.success('DaemonSet YAML 更新成功');
      isYamlModalVisible.value = false;
      await fetchDaemonSets();
    } catch (err: unknown) {
      if (err && typeof err === 'object' && 'errorFields' in err) {
        message.warning('请检查 YAML 格式是否正确');
        return;
      }
      message.error('DaemonSet YAML 更新失败');
      console.error(err);
    } finally {
      submitLoading.value = false;
    }
  };

  // 创建 DaemonSet
  const openCreateModal = () => {
    createFormModel.value = {
      name: '',
      namespace: '',
      images: [''],
      labels: {},
      annotations: {},
    };
    isCreateModalVisible.value = true;
  };

  const closeCreateModal = () => {
    isCreateModalVisible.value = false;
  };

  // 通过 YAML 创建 DaemonSet
  const openCreateYamlModal = () => {
    createYamlFormModel.value.yaml = '';
    isCreateYamlModalVisible.value = true;
  };

  const closeCreateYamlModal = () => {
    isCreateYamlModalVisible.value = false;
    createYamlFormModel.value.yaml = '';
  };

  const submitCreateForm = async () => {
    if (!formRef.value || !filterClusterId.value) return;
    
    try {
      await formRef.value.validate();
      submitLoading.value = true;
      
      const params: CreateDaemonSetReq = {
        cluster_id: filterClusterId.value,
        name: createFormModel.value.name,
        namespace: createFormModel.value.namespace,
        images: createFormModel.value.images.filter(img => img.trim()),
        labels: Object.keys(createFormModel.value.labels).length > 0 ? createFormModel.value.labels : undefined,
        annotations: Object.keys(createFormModel.value.annotations).length > 0 ? createFormModel.value.annotations : undefined,
      };
      
      await createDaemonSetApi(filterClusterId.value, params);
      message.success('DaemonSet 创建成功');
      isCreateModalVisible.value = false;
      await fetchDaemonSets();
    } catch (err: unknown) {
      if (err && typeof err === 'object' && 'errorFields' in err) {
        message.warning('请检查表单填写是否正确');
        return;
      }
      message.error('DaemonSet 创建失败');
      console.error(err);
    } finally {
      submitLoading.value = false;
    }
  };

  const submitCreateYamlForm = async () => {
    if (!createYamlFormRef.value || !filterClusterId.value) return;
    
    try {
      await createYamlFormRef.value.validate();
      submitLoading.value = true;
      
      const params: CreateDaemonSetByYamlReq = {
        cluster_id: filterClusterId.value,
        yaml: createYamlFormModel.value.yaml,
      };
      
      await createDaemonSetByYamlApi(filterClusterId.value, params);
      message.success('DaemonSet YAML 创建成功');
      isCreateYamlModalVisible.value = false;
      await fetchDaemonSets();
    } catch (err: unknown) {
      if (err && typeof err === 'object' && 'errorFields' in err) {
        message.warning('请检查 YAML 格式是否正确');
        return;
      }
      message.error('DaemonSet YAML 创建失败');
      console.error(err);
    } finally {
      submitLoading.value = false;
    }
  };

  // 删除 DaemonSet
  const deleteDaemonSet = (record: K8sDaemonSet) => {
    const clusterId = validateClusterId(record);
    if (!clusterId) return;
    
    Modal.confirm({
      title: '删除 DaemonSet',
      content: `确定要删除 DaemonSet "${record.name}" 吗？此操作不可逆！`,
      okText: '确认删除',
      okType: 'danger',
      cancelText: '取消',
      centered: true,
      onOk: async () => {
        try {
          await deleteDaemonSetApi(clusterId, record.namespace, record.name);
          message.success('DaemonSet 删除成功');
          await fetchDaemonSets();
        } catch (err) {
          message.error('DaemonSet 删除失败');
          console.error(err);
        }
      },
    });
  };

  // 重启 DaemonSet
  const restartDaemonSet = (record: K8sDaemonSet) => {
    const clusterId = validateClusterId(record);
    if (!clusterId) return;
    
    Modal.confirm({
      title: '重启 DaemonSet',
      content: `确定要重启 DaemonSet "${record.name}" 吗？这将重启所有 Pod。`,
      okText: '确认重启',
      okType: 'primary',
      cancelText: '取消',
      centered: true,
      onOk: async () => {
        try {
          const params: RestartDaemonSetReq = {
            cluster_id: clusterId,
            namespace: record.namespace,
            name: record.name,
          };
          await restartDaemonSetApi(clusterId, record.namespace, record.name, params);
          message.success('DaemonSet 重启成功');
          await fetchDaemonSets();
        } catch (err) {
          message.error('DaemonSet 重启失败');
          console.error(err);
        }
      },
    });
  };

  // 编辑 DaemonSet
  const openEditModal = (record: K8sDaemonSet) => {
    const clusterId = validateClusterId(record);
    if (!clusterId) return;
    
    currentOperationDaemonSet.value = { ...record, cluster_id: clusterId };
    editFormModel.value = {
      name: record.name,
      namespace: record.namespace,
      image: record.images?.[0] || '',
      labels: keyValueListToRecord(record.labels),
      annotations: keyValueListToRecord(record.annotations),
    };
    isEditModalVisible.value = true;
  };

  const closeEditModal = () => {
    isEditModalVisible.value = false;
    currentOperationDaemonSet.value = null;
  };

  const submitEditForm = async () => {
    if (!editFormRef.value || !currentOperationDaemonSet.value) return;
    
    try {
      await editFormRef.value.validate();
      submitLoading.value = true;
      
      const params: UpdateDaemonSetReq = {
        cluster_id: currentOperationDaemonSet.value.cluster_id,
        images: editFormModel.value.image ? [editFormModel.value.image] : undefined,
        labels: Object.keys(editFormModel.value.labels).length > 0 ? editFormModel.value.labels : undefined,
        annotations: Object.keys(editFormModel.value.annotations).length > 0 ? editFormModel.value.annotations : undefined,
      };
      
      await updateDaemonSetApi(
        currentOperationDaemonSet.value.cluster_id,
        currentOperationDaemonSet.value.namespace,
        currentOperationDaemonSet.value.name,
        params
      );
      message.success('DaemonSet 更新成功');
      isEditModalVisible.value = false;
      await fetchDaemonSets();
    } catch (err: unknown) {
      if (err && typeof err === 'object' && 'errorFields' in err) {
        message.warning('请检查表单填写是否正确');
        return;
      }
      message.error('DaemonSet 更新失败');
      console.error(err);
    } finally {
      submitLoading.value = false;
    }
  };

  // 回滚 DaemonSet
  const openRollbackModal = (record: K8sDaemonSet) => {
    const clusterId = validateClusterId(record);
    if (!clusterId) return;
    
    currentOperationDaemonSet.value = { ...record, cluster_id: clusterId };
    rollbackFormModel.value.revision = 1;
    isRollbackModalVisible.value = true;
  };

  const closeRollbackModal = () => {
    isRollbackModalVisible.value = false;
    currentOperationDaemonSet.value = null;
  };

  const submitRollbackForm = async () => {
    if (!rollbackFormRef.value || !currentOperationDaemonSet.value) return;
    
    try {
      await rollbackFormRef.value.validate();
      submitLoading.value = true;
      
      const params: RollbackDaemonSetReq = {
        cluster_id: currentOperationDaemonSet.value.cluster_id,
        namespace: currentOperationDaemonSet.value.namespace,
        name: currentOperationDaemonSet.value.name,
        revision: rollbackFormModel.value.revision,
      };
      
      await rollbackDaemonSetApi(
        currentOperationDaemonSet.value.cluster_id,
        currentOperationDaemonSet.value.namespace,
        currentOperationDaemonSet.value.name,
        params
      );
      message.success('DaemonSet 回滚成功');
      isRollbackModalVisible.value = false;
      await fetchDaemonSets();
    } catch (err: unknown) {
      if (err && typeof err === 'object' && 'errorFields' in err) {
        message.warning('请检查表单填写是否正确');
        return;
      }
      message.error('DaemonSet 回滚失败');
      console.error(err);
    } finally {
      submitLoading.value = false;
    }
  };

  // 查看 Pod 列表
  const showPodModal = async (record: K8sDaemonSet) => {
    const clusterId = validateClusterId(record);
    if (!clusterId) return;
    
    try {
      submitLoading.value = true;
      currentOperationDaemonSet.value = { ...record, cluster_id: clusterId };
      const res = await getDaemonSetPodsApi(clusterId, record.namespace, record.name);
      daemonSetPods.value = res?.items || [];
      isPodModalVisible.value = true;
    } catch (err) {
      message.error('获取 Pod 列表失败');
      console.error(err);
    } finally {
      submitLoading.value = false;
    }
  };

  const closePodModal = () => {
    isPodModalVisible.value = false;
    currentOperationDaemonSet.value = null;
    daemonSetPods.value = [];
  };

  // 查看版本历史
  const showHistoryModal = async (record: K8sDaemonSet) => {
    const clusterId = validateClusterId(record);
    if (!clusterId) return;
    
    try {
      submitLoading.value = true;
      currentOperationDaemonSet.value = { ...record, cluster_id: clusterId };
      const res = await getDaemonSetHistoryApi(clusterId, record.namespace, record.name);
      daemonSetHistory.value = res?.items || [];
      isHistoryModalVisible.value = true;
    } catch (err) {
      message.error('获取版本历史失败');
      console.error(err);
    } finally {
      submitLoading.value = false;
    }
  };

  const closeHistoryModal = () => {
    isHistoryModalVisible.value = false;
    currentOperationDaemonSet.value = null;
    daemonSetHistory.value = [];
  };

  // 标签过滤管理
  const addFilterLabel = (key: string, value: string) => {
    if (key && key.trim()) {
      filterLabels.value[key.trim()] = value;
      currentPage.value = 1;
      fetchDaemonSets();
    }
  };

  const removeFilterLabel = (key: string) => {
    delete filterLabels.value[key];
    currentPage.value = 1;
    fetchDaemonSets();
  };

  const clearFilterLabels = () => {
    filterLabels.value = {};
    currentPage.value = 1;
    fetchDaemonSets();
  };

  // 批量操作
  const batchOperation = (operation: string) => {
    if (!selectedRows.value.length) return;
    
    Modal.confirm({
      title: `批量${operation}`,
      content: `确定要对选中的 ${selectedRows.value.length} 个 DaemonSet 执行${operation}操作吗？`,
      okText: '确认执行',
      okType: operation === '删除' ? 'danger' : 'primary',
      cancelText: '取消',
      centered: true,
      onOk: async () => {
        try {
          for (const daemonSet of selectedRows.value) {
            const clusterId = daemonSet.cluster_id || filterClusterId.value;
            if (!clusterId) {
              message.error(`DaemonSet "${daemonSet.name}" 缺少有效的集群ID，跳过操作`);
              continue;
            }
            
            if (operation === '删除') {
              await deleteDaemonSetApi(clusterId, daemonSet.namespace, daemonSet.name);
            } else if (operation === '重启') {
              const params: RestartDaemonSetReq = {
                cluster_id: clusterId,
                namespace: daemonSet.namespace,
                name: daemonSet.name,
              };
              await restartDaemonSetApi(clusterId, daemonSet.namespace, daemonSet.name, params);
            }
          }
          message.success(`批量${operation}操作已完成`);
          selectedRowKeys.value = [];
          selectedRows.value = [];
          await fetchDaemonSets();
        } catch (err) {
          message.error(`批量${operation}失败`);
          console.error(err);
        }
      },
    });
  };

  // 加载更多集群
  const loadMoreClusters = async () => {
    if (clustersPage.value * clustersSize.value >= clustersTotal.value) {
      return;
    }
    clustersPage.value += 1;
    await fetchClusters();
  };

  const loadMoreNamespaces = async () => {
    if (namespacesPage.value * namespacesSize.value >= namespacesTotal.value) {
      return;
    }
    namespacesPage.value += 1;
    await fetchNamespaces();
  };

  // 重置集群列表
  const resetClusters = () => {
    clustersPage.value = 1;
    clusters.value = [];
  };

  const resetNamespaces = () => {
    namespacesPage.value = 1;
    namespaces.value = [];
    namespacesTotal.value = 0;
  };

  // 分页变化处理
  const handlePageChange = async (page: number, size?: number) => {
    currentPage.value = page;
    if (size && size !== pageSize.value) {
      pageSize.value = size;
    }
    await fetchDaemonSets();
  };

  // 表单字段操作
  const addImageField = () => {
    createFormModel.value.images.push('');
  };

  const removeImageField = (index: number) => {
    if (createFormModel.value.images.length > 1) {
      createFormModel.value.images.splice(index, 1);
    }
  };

  const removeLabelField = (key: string) => {
    delete createFormModel.value.labels[key];
  };

  const removeAnnotationField = (key: string) => {
    delete createFormModel.value.annotations[key];
  };

  // 编辑模态框专用的移除方法
  const removeEditLabelField = (key: string) => {
    delete editFormModel.value.labels[key];
  };

  const removeEditAnnotationField = (key: string) => {
    delete editFormModel.value.annotations[key];
  };

  return {
    // state
    daemonSets,
    clusters,
    namespaces,
    loading,
    clustersLoading,
    namespacesLoading,
    searchText,
    filterStatus,
    filterClusterId,
    filterNamespace,
    filterLabels,
    selectedRowKeys,
    selectedRows,
    currentPage,
    pageSize,
    total,
    clustersTotal,
    clustersPage,
    clustersSize,
    namespacesTotal,
    namespacesPage,
    namespacesSize,
    
    // form refs
    formRef,
    editFormRef,
    rollbackFormRef,
    yamlFormRef,
    createYamlFormRef,
    
    // modal state
    isCreateModalVisible,
    isCreateYamlModalVisible,
    isEditModalVisible,
    isDetailModalVisible,
    isRollbackModalVisible,
    isYamlModalVisible,
    isPodModalVisible,
    isHistoryModalVisible,
    submitLoading,
    detailLoading,
    
    // operation targets
    currentOperationDaemonSet,
    currentDaemonSetDetail,
    currentYamlContent,
    daemonSetPods,
    daemonSetHistory,
    
    // form models
    createFormModel,
    editFormModel,
    rollbackFormModel,
    yamlFormModel,
    createYamlFormModel,
    
    // form rules
    createFormRules,
    rollbackFormRules,
    yamlFormRules,
    createYamlFormRules,
    
    // computed
    filteredDaemonSets,
    rowSelection,
    
    // helpers
    validateClusterId,
    getEnvText,
    getStatusText,
    getStatusColor,
    keyValueListToRecord,
    
    // operations
    fetchClusters,
    fetchNamespaces,
    fetchDaemonSets,
    clearDaemonSets,
    clearNamespaces,
    loadMoreClusters,
    loadMoreNamespaces,
    
    // detail operations
    showDaemonSetDetail,
    closeDetailModal,
    
    // YAML operations
    showYamlModal,
    closeYamlModal,
    submitYamlForm,
    
    // create operations
    openCreateModal,
    closeCreateModal,
    submitCreateForm,
    openCreateYamlModal,
    closeCreateYamlModal,
    submitCreateYamlForm,
    
    // daemonSet operations
    deleteDaemonSet,
    restartDaemonSet,
    
    // rollback operations
    openEditModal,
    closeEditModal,
    submitEditForm,
    openRollbackModal,
    closeRollbackModal,
    submitRollbackForm,
    
    // pod operations
    showPodModal,
    closePodModal,
    
    // history operations
    showHistoryModal,
    closeHistoryModal,
    
    // filter operations
    addFilterLabel,
    removeFilterLabel,
    clearFilterLabels,
    
    // batch operations
    batchOperation,
    
    // pagination operations  
    resetClusters,
    handlePageChange,
    
    // form field operations
    addImageField,
    removeImageField,
    removeLabelField,
    removeAnnotationField,
    removeEditLabelField,
    removeEditAnnotationField,
    
    // constants
    K8sDaemonSetStatus,
  };
}
