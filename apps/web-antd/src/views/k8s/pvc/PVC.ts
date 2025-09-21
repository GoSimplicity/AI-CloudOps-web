import { ref, computed, nextTick } from 'vue';
import { message, Modal } from 'ant-design-vue';
import type { FormInstance, Rule } from 'ant-design-vue/es/form';
import {
  type K8sPVC,
  type PVCSpec,
  type GetPVCListReq,
  type GetPVCDetailsReq,
  type GetPVCYamlReq,
  type CreatePVCReq,
  type CreatePVCByYamlReq,
  type UpdatePVCReq,
  type UpdatePVCByYamlReq,
  type DeletePVCReq,
  type ExpandPVCReq,
  type GetPVCPodsReq,
  K8sPVCStatus,
  getK8sPVCList,
  getK8sPVCDetails,
  getK8sPVCYaml,
  createK8sPVC,
  createK8sPVCByYaml,
  updateK8sPVC,
  updateK8sPVCByYaml,
  deleteK8sPVC,
  expandK8sPVC,
  getK8sPVCPods,
} from '#/api/core/k8s/k8s_pvc';
import {
  type K8sCluster,
  type ListClustersReq,
  getClustersListApi,
  Env,
} from '#/api/core/k8s/k8s_cluster';
import {
  type K8sNamespace,
  type K8sNamespaceListReq,
  getNamespacesListApi,
} from '#/api/core/k8s/k8s_namespace';

export function usePVCPage() {
  // state
  const pvcs = ref<K8sPVC[]>([]);
  const clusters = ref<K8sCluster[]>([]);
  const namespaces = ref<K8sNamespace[]>([]);
  const loading = ref(false);
  const clustersLoading = ref(false);
  const namespacesLoading = ref(false);
  const searchText = ref('');
  const filterClusterId = ref<number | undefined>(undefined);
  const filterNamespace = ref<string | undefined>(undefined);
  const filterStatus = ref<K8sPVCStatus | undefined>(undefined);
  const filterAccessMode = ref<string | undefined>(undefined);
  const selectedRowKeys = ref<string[]>([]);
  const selectedRows = ref<K8sPVC[]>([]);
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
  const yamlFormRef = ref<FormInstance>();
  const createYamlFormRef = ref<FormInstance>();
  const expandFormRef = ref<FormInstance>();

  // modal/form state
  const isCreateModalVisible = ref(false);
  const isCreateYamlModalVisible = ref(false);
  const isEditModalVisible = ref(false);
  const isDetailModalVisible = ref(false);
  const isYamlModalVisible = ref(false);
  const isExpandModalVisible = ref(false);
  const isPodsModalVisible = ref(false);
  const submitLoading = ref(false);
  const detailLoading = ref(false);
  const podsLoading = ref(false);

  // current operation target
  const currentOperationPVC = ref<K8sPVC | null>(null);
  const currentPVCDetail = ref<K8sPVC | null>(null);
  const currentYamlContent = ref('');
  const currentPVCPods = ref<any[]>([]);

  // form models
  const createFormModel = ref<{
    name: string;
    namespace: string;
    labels: Record<string, string>;
    annotations: Record<string, string>;
    spec: PVCSpec;
  }>({
    name: '',
    namespace: '',
    labels: {},
    annotations: {},
    spec: {
      request_storage: '',
      access_modes: ['ReadWriteOnce'],
      storage_class: '',
      volume_mode: 'Filesystem',
      volume_name: '',
      selector: {},
    },
  });

  const editFormModel = ref<{
    name: string;
    namespace: string;
    labels: Record<string, string>;
    annotations: Record<string, string>;
    spec: PVCSpec;
  }>({
    name: '',
    namespace: '',
    labels: {},
    annotations: {},
    spec: {
      request_storage: '',
      access_modes: [],
      storage_class: '',
      volume_mode: '',
      volume_name: '',
      selector: {},
    },
  });

  const yamlFormModel = ref<{
    yaml: string;
  }>({
    yaml: ''
  });

  const createYamlFormModel = ref<{
    yaml: string;
  }>({
    yaml: ''
  });

  const expandFormModel = ref<{
    new_capacity: string;
  }>({
    new_capacity: ''
  });

  // form validation rules
  const createFormRules: Record<string, Rule[]> = {
    name: [
      { required: true, message: '请输入 PVC 名称', trigger: 'blur' },
      { pattern: /^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/, message: 'PVC 名称只能包含小写字母、数字和连字符，且不能以连字符开头或结尾', trigger: 'blur' },
      { max: 253, message: 'PVC 名称长度不能超过253个字符', trigger: 'blur' }
    ],
    namespace: [
      { required: true, message: '请选择命名空间', trigger: 'change' }
    ],
    'spec.request_storage': [
      { required: true, message: '请输入请求存储容量', trigger: 'blur' },
      { pattern: /^[0-9]+[KMGTPE]i?$/, message: '请输入有效的存储容量，如: 1Gi, 100Mi', trigger: 'blur' }
    ],
    'spec.access_modes': [
      { required: true, message: '请选择访问模式', trigger: 'change' }
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

  const expandFormRules: Record<string, Rule[]> = {
    new_capacity: [
      { required: true, message: '请输入新容量', trigger: 'blur' },
      { pattern: /^[0-9]+[KMGTPE]i?$/, message: '请输入有效的存储容量，如: 10Gi, 200Mi', trigger: 'blur' }
    ]
  };

  // computed
  const filteredPVCs = computed(() => {
    return pvcs.value;
  });

  const rowSelection = computed(() => ({
    selectedRowKeys: selectedRowKeys.value,
    onChange: (keys: string[], rows: K8sPVC[]) => {
      selectedRowKeys.value = keys;
      selectedRows.value = rows;
    },
  }));

  // helpers
  const validateClusterId = (record: K8sPVC): number | null => {
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

  // 获取PVC状态显示文本
  const getPVCStatusText = (status: K8sPVCStatus): string => {
    const statusMap: Record<K8sPVCStatus, string> = {
      [K8sPVCStatus.Pending]: '等待中',
      [K8sPVCStatus.Bound]: '已绑定',
      [K8sPVCStatus.Lost]: '丢失',
      [K8sPVCStatus.Terminating]: '终止中',
      [K8sPVCStatus.Unknown]: '未知',
    };
    return statusMap[status] || '未知';
  };

  // 获取PVC状态颜色
  const getPVCStatusColor = (status: K8sPVCStatus): string => {
    const colorMap: Record<K8sPVCStatus, string> = {
      [K8sPVCStatus.Pending]: 'warning',
      [K8sPVCStatus.Bound]: 'success',
      [K8sPVCStatus.Lost]: 'error',
      [K8sPVCStatus.Terminating]: 'processing',
      [K8sPVCStatus.Unknown]: 'default',
    };
    return colorMap[status] || 'default';
  };

  // 获取访问模式显示文本
  const getAccessModeText = (mode: string): string => {
    const modeMap: Record<string, string> = {
      'ReadWriteOnce': 'RWO',
      'ReadOnlyMany': 'ROX',
      'ReadWriteMany': 'RWX',
      'ReadWriteOncePod': 'RWOP',
    };
    return modeMap[mode] || mode;
  };

  // cluster operations
  const clearPVCs = () => {
    pvcs.value = [];
    selectedRowKeys.value = [];
    selectedRows.value = [];
  };

  const clearNamespaces = () => {
    resetNamespaces();
    filterNamespace.value = undefined;
  };

  const resetClusters = () => {
    clustersPage.value = 1;
    clusters.value = [];
  };

  const resetNamespaces = () => {
    namespacesPage.value = 1;
    namespaces.value = [];
    namespacesTotal.value = 0;
  };

  // api calls
  const fetchClusters = async (reset: boolean = false) => {
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
          // 自动加载该集群的命名空间和PVC数据
          await fetchNamespaces();
          await fetchPVCs();
        }
      }
    } catch (error: any) {
      console.error('获取集群列表失败:', error);
      message.error(error?.message || '获取集群列表失败');
    } finally {
      clustersLoading.value = false;
    }
  };

  const fetchNamespaces = async (reset: boolean = false) => {
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
    } catch (error: any) {
      console.error('获取命名空间列表失败:', error);
      message.error(error?.message || '获取命名空间列表失败');
    } finally {
      namespacesLoading.value = false;
    }
  };

  const fetchPVCs = async () => {
    if (!filterClusterId.value || filterClusterId.value === 0) {
      message.warning('请先选择有效的集群');
      pvcs.value = [];
      total.value = 0;
      return;
    }

    try {
      loading.value = true;
      const params: GetPVCListReq = {
        cluster_id: filterClusterId.value,
        namespace: filterNamespace.value || undefined,
        page: currentPage.value,
        size: pageSize.value,
        search: searchText.value || undefined,
        status: filterStatus.value ? String(filterStatus.value) : undefined,
        access_mode: filterAccessMode.value || undefined,
      };

      const res = await getK8sPVCList(params);
      
      // 确保每个PVC对象都有正确的cluster_id
      const pvcsWithClusterId = (res?.items || []).map((pvc: K8sPVC) => ({
        ...pvc,
        cluster_id: pvc.cluster_id || filterClusterId.value || 0
      }));
      pvcs.value = pvcsWithClusterId;
      total.value = res?.total || 0;
    } catch (error: any) {
      console.error('获取PVC列表失败:', error);
      message.error(error?.message || '获取PVC列表失败');
      pvcs.value = [];
      total.value = 0;
    } finally {
      loading.value = false;
    }
  };

  const loadMoreClusters = async () => {
    if (clustersPage.value * clustersSize.value >= clustersTotal.value) {
      return;
    }
    clustersPage.value += 1;
    await fetchClusters();
  };

  const fetchPVCDetails = async (record: K8sPVC) => {
    const clusterId = validateClusterId(record);
    if (!clusterId) return;

    try {
      detailLoading.value = true;
      const params: GetPVCDetailsReq = {
        cluster_id: clusterId,
        namespace: record.namespace,
        name: record.name,
      };

      const response = await getK8sPVCDetails(params);
      
      if (response) {
        currentPVCDetail.value = response;
      }
    } catch (error: any) {
      console.error('获取PVC详情失败:', error);
      message.error(error?.message || '获取PVC详情失败');
    } finally {
      detailLoading.value = false;
    }
  };

  const fetchPVCYaml = async (record: K8sPVC) => {
    const clusterId = validateClusterId(record);
    if (!clusterId) return;

    try {
      const params: GetPVCYamlReq = {
        cluster_id: clusterId,
        namespace: record.namespace,
        name: record.name,
      };

      const response = await getK8sPVCYaml(params);
      
      if (response && response.yaml) {
        currentYamlContent.value = response.yaml;
      }
    } catch (error: any) {
      console.error('获取PVC YAML失败:', error);
      message.error(error?.message || '获取PVC YAML失败');
    }
  };

  const fetchPVCPods = async (record: K8sPVC) => {
    const clusterId = validateClusterId(record);
    if (!clusterId) return;

    try {
      podsLoading.value = true;
      const params: GetPVCPodsReq = {
        cluster_id: clusterId,
        namespace: record.namespace,
        name: record.name,
      };

      const res = await getK8sPVCPods(params);
      
      currentPVCPods.value = res?.items || [];
    } catch (error: any) {
      console.error('获取使用PVC的Pod列表失败:', error);
      message.error(error?.message || '获取使用PVC的Pod列表失败');
      currentPVCPods.value = [];
    } finally {
      podsLoading.value = false;
    }
  };

  const createPVC = async () => {
    if (!filterClusterId.value) {
      message.error('请先选择集群');
      return;
    }

    try {
      await formRef.value?.validate();
      submitLoading.value = true;

      const params: CreatePVCReq = {
        cluster_id: filterClusterId.value,
        namespace: createFormModel.value.namespace,
        name: createFormModel.value.name,
        labels: Object.keys(createFormModel.value.labels).length > 0 ? createFormModel.value.labels : undefined,
        annotations: Object.keys(createFormModel.value.annotations).length > 0 ? createFormModel.value.annotations : undefined,
        spec: createFormModel.value.spec,
      };

      await createK8sPVC(params);
      message.success('创建PVC成功');
      isCreateModalVisible.value = false;
      resetCreateForm();
      await fetchPVCs();
    } catch (error: any) {
      console.error('创建PVC失败:', error);
      message.error(error?.message || '创建PVC失败');
    } finally {
      submitLoading.value = false;
    }
  };

  const createPVCByYaml = async () => {
    if (!filterClusterId.value) {
      message.error('请先选择集群');
      return;
    }

    try {
      await createYamlFormRef.value?.validate();
      submitLoading.value = true;

      const params: CreatePVCByYamlReq = {
        cluster_id: filterClusterId.value,
        yaml: createYamlFormModel.value.yaml,
      };

      await createK8sPVCByYaml(params);
      message.success('通过YAML创建PVC成功');
      isCreateYamlModalVisible.value = false;
      resetCreateYamlForm();
      await fetchPVCs();
    } catch (error: any) {
      console.error('通过YAML创建PVC失败:', error);
      message.error(error?.message || '通过YAML创建PVC失败');
    } finally {
      submitLoading.value = false;
    }
  };

  const updatePVC = async () => {
    if (!currentOperationPVC.value) return;

    const clusterId = validateClusterId(currentOperationPVC.value);
    if (!clusterId) return;

    try {
      await formRef.value?.validate();
      submitLoading.value = true;

      const params: UpdatePVCReq = {
        cluster_id: clusterId,
        namespace: currentOperationPVC.value.namespace,
        name: currentOperationPVC.value.name,
        labels: Object.keys(editFormModel.value.labels).length > 0 ? editFormModel.value.labels : undefined,
        annotations: Object.keys(editFormModel.value.annotations).length > 0 ? editFormModel.value.annotations : undefined,
        spec: editFormModel.value.spec,
      };

      await updateK8sPVC(params);
      message.success('更新PVC成功');
      isEditModalVisible.value = false;
      resetEditForm();
      await fetchPVCs();
    } catch (error: any) {
      console.error('更新PVC失败:', error);
      message.error(error?.message || '更新PVC失败');
    } finally {
      submitLoading.value = false;
    }
  };

  const updatePVCByYaml = async () => {
    if (!currentOperationPVC.value) return;

    const clusterId = validateClusterId(currentOperationPVC.value);
    if (!clusterId) return;

    try {
      await yamlFormRef.value?.validate();
      submitLoading.value = true;

      const params: UpdatePVCByYamlReq = {
        cluster_id: clusterId,
        namespace: currentOperationPVC.value.namespace,
        name: currentOperationPVC.value.name,
        yaml: yamlFormModel.value.yaml,
      };

      await updateK8sPVCByYaml(params);
      message.success('通过YAML更新PVC成功');
      isYamlModalVisible.value = false;
      resetYamlForm();
      await fetchPVCs();
    } catch (error: any) {
      console.error('通过YAML更新PVC失败:', error);
      message.error(error?.message || '通过YAML更新PVC失败');
    } finally {
      submitLoading.value = false;
    }
  };

  const deletePVC = async (record: K8sPVC) => {
    const clusterId = validateClusterId(record);
    if (!clusterId) return;

    Modal.confirm({
      title: `确认删除PVC "${record.name}"?`,
      content: '此操作不可恢复，请确认！',
      okText: '确认删除',
      cancelText: '取消',
      okType: 'danger',
      onOk: async () => {
        try {
          const params: DeletePVCReq = {
            cluster_id: clusterId,
            namespace: record.namespace,
            name: record.name,
          };

          await deleteK8sPVC(params);
          message.success(`删除PVC "${record.name}" 成功`);
          await fetchPVCs();
        } catch (error: any) {
          console.error('删除PVC失败:', error);
          message.error(error?.message || '删除PVC失败');
        }
      },
    });
  };

  const expandPVC = async () => {
    if (!currentOperationPVC.value) return;

    const clusterId = validateClusterId(currentOperationPVC.value);
    if (!clusterId) return;

    try {
      await expandFormRef.value?.validate();
      submitLoading.value = true;

      const params: ExpandPVCReq = {
        cluster_id: clusterId,
        namespace: currentOperationPVC.value.namespace,
        name: currentOperationPVC.value.name,
        new_capacity: expandFormModel.value.new_capacity,
      };

      await expandK8sPVC(params);
      message.success(`扩容PVC "${currentOperationPVC.value.name}" 成功`);
      isExpandModalVisible.value = false;
      resetExpandForm();
      await fetchPVCs();
    } catch (error: any) {
      console.error('扩容PVC失败:', error);
      message.error(error?.message || '扩容PVC失败');
    } finally {
      submitLoading.value = false;
    }
  };

  const deleteBatchPVCs = async () => {
    if (selectedRows.value.length === 0) {
      message.warning('请先选择要删除的PVC');
      return;
    }

    Modal.confirm({
      title: `确认删除选中的 ${selectedRows.value.length} 个PVC?`,
      content: '此操作不可恢复，请确认！',
      okText: '确认删除',
      cancelText: '取消',
      okType: 'danger',
      onOk: async () => {
        try {
          const promises = selectedRows.value.map(async (record) => {
            const clusterId = validateClusterId(record);
            if (!clusterId) return Promise.resolve();

            const params: DeletePVCReq = {
              cluster_id: clusterId,
              namespace: record.namespace,
              name: record.name,
            };

            return deleteK8sPVC(params);
          });

          await Promise.all(promises);
          message.success(`成功删除 ${selectedRows.value.length} 个PVC`);
          selectedRowKeys.value = [];
          selectedRows.value = [];
          await fetchPVCs();
        } catch (error: any) {
          console.error('批量删除PVC失败:', error);
          message.error(error?.message || '批量删除PVC失败');
        }
      },
    });
  };

  // modal handlers
  const openCreateModal = () => {
    if (!filterClusterId.value) {
      message.warning('请先选择集群');
      return;
    }
    resetCreateForm();
    // 如果选择了命名空间，预填充
    if (filterNamespace.value) {
      createFormModel.value.namespace = filterNamespace.value;
    }
    isCreateModalVisible.value = true;
  };

  const openCreateYamlModal = () => {
    if (!filterClusterId.value) {
      message.warning('请先选择集群');
      return;
    }
    resetCreateYamlForm();
    isCreateYamlModalVisible.value = true;
  };

  const openEditModal = async (record: K8sPVC) => {
    currentOperationPVC.value = record;
    resetEditForm();
    // 填充编辑表单
    editFormModel.value = {
      name: record.name,
      namespace: record.namespace,
      labels: record.labels || {},
      annotations: record.annotations || {},
      spec: {
        request_storage: record.request_storage,
        access_modes: record.access_modes || [],
        storage_class: record.storage_class,
        volume_mode: record.volume_mode,
        volume_name: record.volume_name,
        selector: record.selector || {},
      },
    };
    isEditModalVisible.value = true;
  };

  const openDetailModal = async (record: K8sPVC) => {
    currentOperationPVC.value = record;
    isDetailModalVisible.value = true;
    await fetchPVCDetails(record);
  };

  const openYamlModal = async (record: K8sPVC) => {
    currentOperationPVC.value = record;
    resetYamlForm();
    isYamlModalVisible.value = true;
    await fetchPVCYaml(record);
    yamlFormModel.value.yaml = currentYamlContent.value;
  };

  const openExpandModal = (record: K8sPVC) => {
    currentOperationPVC.value = record;
    resetExpandForm();
    isExpandModalVisible.value = true;
  };

  const openPodsModal = async (record: K8sPVC) => {
    currentOperationPVC.value = record;
    isPodsModalVisible.value = true;
    await fetchPVCPods(record);
  };

  // form helpers
  const resetCreateForm = () => {
    createFormModel.value = {
      name: '',
      namespace: '',
      labels: {},
      annotations: {},
      spec: {
        request_storage: '',
        access_modes: ['ReadWriteOnce'],
        storage_class: '',
        volume_mode: 'Filesystem',
        volume_name: '',
        selector: {},
      },
    };
    formRef.value?.resetFields();
  };

  const resetEditForm = () => {
    editFormModel.value = {
      name: '',
      namespace: '',
      labels: {},
      annotations: {},
      spec: {
        request_storage: '',
        access_modes: [],
        storage_class: '',
        volume_mode: '',
        volume_name: '',
        selector: {},
      },
    };
    formRef.value?.resetFields();
  };

  const resetYamlForm = () => {
    yamlFormModel.value = {
      yaml: ''
    };
    yamlFormRef.value?.resetFields();
  };

  const resetCreateYamlForm = () => {
    createYamlFormModel.value = {
      yaml: ''
    };
    createYamlFormRef.value?.resetFields();
  };

  const resetExpandForm = () => {
    expandFormModel.value = {
      new_capacity: ''
    };
    expandFormRef.value?.resetFields();
  };

  // filter handlers
  const handleClusterChange = (value: number | undefined) => {
    filterClusterId.value = value;
    filterNamespace.value = undefined;
    clearPVCs();
    clearNamespaces();
    total.value = 0;
    currentPage.value = 1;
    if (value) {
      fetchNamespaces(true);
      fetchPVCs();
    }
  };

  const handleFilterChange = () => {
    currentPage.value = 1;
    fetchPVCs();
  };

  const handleSearch = (value: string) => {
    searchText.value = value;
    currentPage.value = 1;
    fetchPVCs();
  };

  const handlePageChange = (page: number, size: number) => {
    currentPage.value = page;
    pageSize.value = size;
    fetchPVCs();
  };

  const handleClusterDropdownScroll = (e: Event) => {
    const target = e.target as HTMLElement;
    if (target.scrollTop + target.offsetHeight === target.scrollHeight) {
      if (clusters.value.length < clustersTotal.value && !clustersLoading.value) {
        clustersPage.value += 1;
        fetchClusters(false);
      }
    }
  };

  const loadMoreNamespaces = async () => {
    if (namespacesPage.value * namespacesSize.value >= namespacesTotal.value) {
      return;
    }
    namespacesPage.value += 1;
    await fetchNamespaces();
  };

  // label/annotation helpers
  const addLabelItem = (type: 'labels' | 'annotations') => {
    if (type === 'labels') {
      createFormModel.value.labels[''] = '';
    } else {
      createFormModel.value.annotations[''] = '';
    }
  };

  const removeLabelItem = (key: string, type: 'labels' | 'annotations') => {
    if (type === 'labels') {
      delete createFormModel.value.labels[key];
    } else {
      delete createFormModel.value.annotations[key];
    }
  };

  const addEditLabelItem = (type: 'labels' | 'annotations') => {
    if (type === 'labels') {
      editFormModel.value.labels[''] = '';
    } else {
      editFormModel.value.annotations[''] = '';
    }
  };

  const removeEditLabelItem = (key: string, type: 'labels' | 'annotations') => {
    if (type === 'labels') {
      delete editFormModel.value.labels[key];
    } else {
      delete editFormModel.value.annotations[key];
    }
  };

  const updateEditLabelKey = async (oldKey: string, newKey: string, type: 'labels' | 'annotations') => {
    if (oldKey === newKey || !newKey.trim()) {
      return;
    }
    
    // 使用 nextTick 确保在下一个事件循环中执行，避免和当前的DOM更新冲突
    await nextTick();
    
    if (type === 'labels') {
      if (editFormModel.value.labels[newKey] !== undefined) {
        message.warning('标签键已存在');
        return;
      }
      const value = editFormModel.value.labels[oldKey];
      if (value !== undefined) {
        editFormModel.value.labels[newKey] = value;
        delete editFormModel.value.labels[oldKey];
      }
    } else {
      if (editFormModel.value.annotations[newKey] !== undefined) {
        message.warning('注解键已存在');
        return;
      }
      const value = editFormModel.value.annotations[oldKey];
      if (value !== undefined) {
        editFormModel.value.annotations[newKey] = value;
        delete editFormModel.value.annotations[oldKey];
      }
    }
  };

  // selector helpers
  const addSelectorItem = () => {
    createFormModel.value.spec.selector[''] = '';
  };

  const removeSelectorItem = (key: string) => {
    delete createFormModel.value.spec.selector[key];
  };

  const addEditSelectorItem = () => {
    editFormModel.value.spec.selector[''] = '';
  };

  const removeEditSelectorItem = (key: string) => {
    delete editFormModel.value.spec.selector[key];
  };

  return {
    // state
    pvcs,
    clusters,
    namespaces,
    loading,
    clustersLoading,
    namespacesLoading,
    searchText,
    filterClusterId,
    filterNamespace,
    filterStatus,
    filterAccessMode,
    selectedRowKeys,
    selectedRows,
    currentPage,
    pageSize,
    total,
    clustersPage,
    clustersSize,
    namespacesPage,
    namespacesSize,
    
    // form refs
    formRef,
    yamlFormRef,
    createYamlFormRef,
    expandFormRef,
    
    // modal state
    isCreateModalVisible,
    isCreateYamlModalVisible,
    isEditModalVisible,
    isDetailModalVisible,
    isYamlModalVisible,
    isExpandModalVisible,
    isPodsModalVisible,
    submitLoading,
    detailLoading,
    podsLoading,
    
    // current operation
    currentOperationPVC,
    currentPVCDetail,
    currentYamlContent,
    currentPVCPods,
    
    // form models
    createFormModel,
    editFormModel,
    yamlFormModel,
    createYamlFormModel,
    expandFormModel,
    
    // form rules
    createFormRules,
    yamlFormRules,
    createYamlFormRules,
    expandFormRules,
    
    // computed
    filteredPVCs,
    rowSelection,
    
    // helpers
    getEnvText,
    getPVCStatusText,
    getPVCStatusColor,
    getAccessModeText,
    
    // operations
    fetchClusters,
    fetchNamespaces,
    fetchPVCs,
    fetchPVCDetails,
    fetchPVCYaml,
    fetchPVCPods,
    clearPVCs,
    clearNamespaces,
    loadMoreClusters,
    loadMoreNamespaces,
    resetClusters,
    resetNamespaces,
    
    // crud operations
    createPVC,
    createPVCByYaml,
    updatePVC,
    updatePVCByYaml,
    deletePVC,
    expandPVC,
    deleteBatchPVCs,
    
    // modal handlers
    openCreateModal,
    openCreateYamlModal,
    openEditModal,
    openDetailModal,
    openYamlModal,
    openExpandModal,
    openPodsModal,
    
    // form helpers
    resetCreateForm,
    resetEditForm,
    resetYamlForm,
    resetCreateYamlForm,
    resetExpandForm,
    
    // filter handlers
    handleClusterChange,
    handleFilterChange,
    handleSearch,
    handlePageChange,
    handleClusterDropdownScroll,
    
    // label/annotation helpers
    addLabelItem,
    removeLabelItem,
    addEditLabelItem,
    removeEditLabelItem,
    updateEditLabelKey,
    
    // selector helpers
    addSelectorItem,
    removeSelectorItem,
    addEditSelectorItem,
    removeEditSelectorItem,
    
    // constants
    K8sPVCStatus,
    
    // additional required properties
    clustersTotal,
    namespacesTotal,
  };
}
