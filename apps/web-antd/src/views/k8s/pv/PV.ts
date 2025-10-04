import { ref, computed, nextTick } from 'vue';
import { message, Modal } from 'ant-design-vue';
import type { FormInstance, Rule } from 'ant-design-vue/es/form';
import {
  type K8sPV,
  type GetPVListReq,
  type GetPVDetailsReq,
  type GetPVYamlReq,
  type CreatePVReq,
  type CreatePVByYamlReq,
  type UpdatePVReq,
  type UpdatePVByYamlReq,
  type DeletePVReq,
  type ReclaimPVReq,
  K8sPVStatus,
  getK8sPVList,
  getK8sPVDetails,
  getK8sPVYaml,
  createK8sPV,
  createK8sPVByYaml,
  updateK8sPV,
  updateK8sPVByYaml,
  deleteK8sPV,
  reclaimK8sPV,
} from '#/api/core/k8s/k8s_pv';
import {
  type K8sCluster,
  type ListClustersReq,
  getClustersListApi,
  Env,
} from '#/api/core/k8s/k8s_cluster';

export function usePVPage() {
  // state
  const pvs = ref<K8sPV[]>([]);
  const clusters = ref<K8sCluster[]>([]);
  const loading = ref(false);
  const clustersLoading = ref(false);
  const searchText = ref('');
  const filterClusterId = ref<number | undefined>(undefined);
  const filterStatus = ref<K8sPVStatus | undefined>(undefined);
  const filterAccessMode = ref<string | undefined>(undefined);
  const filterVolumeType = ref<string | undefined>(undefined);
  const selectedRowKeys = ref<string[]>([]);
  const selectedRows = ref<K8sPV[]>([]);
  const currentPage = ref(1);
  const pageSize = ref(10);
  const total = ref(0);
  const clustersTotal = ref(0);
  const clustersPage = ref(1);
  const clustersSize = ref(50);

  // form refs
  const formRef = ref<FormInstance>();
  const yamlFormRef = ref<FormInstance>();
  const createYamlFormRef = ref<FormInstance>();

  // modal/form state
  const isCreateModalVisible = ref(false);
  const isCreateYamlModalVisible = ref(false);
  const isEditModalVisible = ref(false);
  const isDetailModalVisible = ref(false);
  const isYamlModalVisible = ref(false);
  const submitLoading = ref(false);
  const detailLoading = ref(false);

  // current operation target
  const currentOperationPV = ref<K8sPV | null>(null);
  const currentPVDetail = ref<K8sPV | null>(null);
  const currentYamlContent = ref('');

  // form models
  const createFormModel = ref<{
    name: string;
    capacity: string;
    access_modes: string[];
    reclaim_policy: string;
    storage_class: string;
    volume_mode: string;
    volume_source: Record<string, any>;
    node_affinity: Record<string, any>;
    labels: Record<string, string>;
    annotations: Record<string, string>;
  }>({
    name: '',
    capacity: '',
    access_modes: ['ReadWriteOnce'],
    reclaim_policy: 'Retain',
    storage_class: '',
    volume_mode: 'Filesystem',
    volume_source: {},
    node_affinity: {},
    labels: {},
    annotations: {},
  });

  const editFormModel = ref<{
    name: string;
    capacity: string;
    access_modes: string[];
    reclaim_policy: string;
    storage_class: string;
    volume_mode: string;
    volume_source: Record<string, any>;
    node_affinity: Record<string, any>;
    labels: Record<string, string>;
    annotations: Record<string, string>;
  }>({
    name: '',
    capacity: '',
    access_modes: [],
    reclaim_policy: '',
    storage_class: '',
    volume_mode: '',
    volume_source: {},
    node_affinity: {},
    labels: {},
    annotations: {},
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

  // form validation rules
  const createFormRules: Record<string, Rule[]> = {
    name: [
      { required: true, message: '请输入 PV 名称', trigger: 'blur' },
      { pattern: /^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/, message: 'PV 名称只能包含小写字母、数字和连字符，且不能以连字符开头或结尾', trigger: 'blur' },
      { max: 253, message: 'PV 名称长度不能超过253个字符', trigger: 'blur' }
    ],
    capacity: [
      { required: true, message: '请输入存储容量', trigger: 'blur' },
      { pattern: /^[0-9]+[KMGTPE]i?$/, message: '请输入有效的存储容量，如: 1Gi, 100Mi', trigger: 'blur' }
    ],
    access_modes: [
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

  // computed
  const filteredPVs = computed(() => {
    return pvs.value;
  });

  const rowSelection = computed(() => ({
    selectedRowKeys: selectedRowKeys.value,
    onChange: (keys: string[], rows: K8sPV[]) => {
      selectedRowKeys.value = keys;
      selectedRows.value = rows;
    },
  }));

  // helpers
  const validateClusterId = (record: K8sPV): number | null => {
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

  // 获取PV状态显示文本
  const getPVStatusText = (status: K8sPVStatus): string => {
    const statusMap: Record<K8sPVStatus, string> = {
      [K8sPVStatus.Available]: '可用',
      [K8sPVStatus.Bound]: '已绑定',
      [K8sPVStatus.Released]: '已释放',
      [K8sPVStatus.Failed]: '失败',
      [K8sPVStatus.Unknown]: '未知',
    };
    return statusMap[status] || '未知';
  };

  // 获取PV状态颜色
  const getPVStatusColor = (status: K8sPVStatus): string => {
    const colorMap: Record<K8sPVStatus, string> = {
      [K8sPVStatus.Available]: 'success',
      [K8sPVStatus.Bound]: 'processing',
      [K8sPVStatus.Released]: 'warning',
      [K8sPVStatus.Failed]: 'error',
      [K8sPVStatus.Unknown]: 'default',
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
  const clearPVs = () => {
    pvs.value = [];
    selectedRowKeys.value = [];
    selectedRows.value = [];
  };

  const resetClusters = () => {
    clustersPage.value = 1;
    clusters.value = [];
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
          // 自动加载该集群的PV数据
          await fetchPVs();
        }
      }
    } catch (error: any) {

      message.error(error?.message || '获取集群列表失败');
    } finally {
      clustersLoading.value = false;
    }
  };

  const fetchPVs = async () => {
    if (!filterClusterId.value || filterClusterId.value === 0) {
      message.warning('请先选择有效的集群');
      pvs.value = [];
      total.value = 0;
      return;
    }

    try {
      loading.value = true;
      const params: GetPVListReq = {
        cluster_id: filterClusterId.value,
        page: currentPage.value,
        size: pageSize.value,
        search: searchText.value || undefined,
        status: filterStatus.value ? String(filterStatus.value) : undefined,
        access_mode: filterAccessMode.value || undefined,
        volume_type: filterVolumeType.value || undefined,
      };

      const res = await getK8sPVList(params);
      
      // 确保每个PV对象都有正确的cluster_id
      const pvsWithClusterId = (res?.items || []).map((pv: K8sPV) => ({
        ...pv,
        cluster_id: pv.cluster_id || filterClusterId.value || 0
      }));
      pvs.value = pvsWithClusterId;
      total.value = res?.total || 0;
    } catch (error: any) {

      message.error(error?.message || '获取PV列表失败');
      pvs.value = [];
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

  const fetchPVDetails = async (record: K8sPV) => {
    const clusterId = validateClusterId(record);
    if (!clusterId) return;

    try {
      detailLoading.value = true;
      const params: GetPVDetailsReq = {
        cluster_id: clusterId,
        name: record.name,
      };

      const response = await getK8sPVDetails(params);
      
      if (response) {
        currentPVDetail.value = response;
      }
    } catch (error: any) {

      message.error(error?.message || '获取PV详情失败');
    } finally {
      detailLoading.value = false;
    }
  };

  const fetchPVYaml = async (record: K8sPV) => {
    const clusterId = validateClusterId(record);
    if (!clusterId) return;

    try {
      const params: GetPVYamlReq = {
        cluster_id: clusterId,
        name: record.name,
      };

      const response = await getK8sPVYaml(params);
      
      if (response && response.yaml) {
        currentYamlContent.value = response.yaml;
      }
    } catch (error: any) {

      message.error(error?.message || '获取PV YAML失败');
    }
  };

  const createPV = async () => {
    if (!filterClusterId.value) {
      message.error('请先选择集群');
      return;
    }

    try {
      await formRef.value?.validate();
      submitLoading.value = true;

      const params: CreatePVReq = {
        cluster_id: filterClusterId.value,
        name: createFormModel.value.name,
        capacity: createFormModel.value.capacity,
        access_modes: createFormModel.value.access_modes,
        reclaim_policy: createFormModel.value.reclaim_policy,
        storage_class: createFormModel.value.storage_class || undefined,
        volume_mode: createFormModel.value.volume_mode || undefined,
        volume_source: createFormModel.value.volume_source,
        node_affinity: Object.keys(createFormModel.value.node_affinity).length > 0 ? createFormModel.value.node_affinity : undefined,
        labels: Object.keys(createFormModel.value.labels).length > 0 ? createFormModel.value.labels : undefined,
        annotations: Object.keys(createFormModel.value.annotations).length > 0 ? createFormModel.value.annotations : undefined,
      };

      await createK8sPV(params);
      message.success('创建PV成功');
      isCreateModalVisible.value = false;
      resetCreateForm();
      await fetchPVs();
    } catch (error: any) {

      message.error(error?.message || '创建PV失败');
    } finally {
      submitLoading.value = false;
    }
  };

  const createPVByYaml = async () => {
    if (!filterClusterId.value) {
      message.error('请先选择集群');
      return;
    }

    try {
      await createYamlFormRef.value?.validate();
      submitLoading.value = true;

      const params: CreatePVByYamlReq = {
        cluster_id: filterClusterId.value,
        yaml: createYamlFormModel.value.yaml,
      };

      await createK8sPVByYaml(params);
      message.success('通过YAML创建PV成功');
      isCreateYamlModalVisible.value = false;
      resetCreateYamlForm();
      await fetchPVs();
    } catch (error: any) {

      message.error(error?.message || '通过YAML创建PV失败');
    } finally {
      submitLoading.value = false;
    }
  };

  const updatePV = async () => {
    if (!currentOperationPV.value) return;

    const clusterId = validateClusterId(currentOperationPV.value);
    if (!clusterId) return;

    try {
      await formRef.value?.validate();
      submitLoading.value = true;

      const params: UpdatePVReq = {
        cluster_id: clusterId,
        name: currentOperationPV.value.name,
        capacity: editFormModel.value.capacity || undefined,
        access_modes: editFormModel.value.access_modes.length > 0 ? editFormModel.value.access_modes : undefined,
        reclaim_policy: editFormModel.value.reclaim_policy || undefined,
        storage_class: editFormModel.value.storage_class || undefined,
        volume_mode: editFormModel.value.volume_mode || undefined,
        volume_source: Object.keys(editFormModel.value.volume_source).length > 0 ? editFormModel.value.volume_source : undefined,
        node_affinity: Object.keys(editFormModel.value.node_affinity).length > 0 ? editFormModel.value.node_affinity : undefined,
        labels: Object.keys(editFormModel.value.labels).length > 0 ? editFormModel.value.labels : undefined,
        annotations: Object.keys(editFormModel.value.annotations).length > 0 ? editFormModel.value.annotations : undefined,
      };

      await updateK8sPV(params);
      message.success('更新PV成功');
      isEditModalVisible.value = false;
      resetEditForm();
      await fetchPVs();
    } catch (error: any) {

      message.error(error?.message || '更新PV失败');
    } finally {
      submitLoading.value = false;
    }
  };

  const updatePVByYaml = async () => {
    if (!currentOperationPV.value) return;

    const clusterId = validateClusterId(currentOperationPV.value);
    if (!clusterId) return;

    try {
      await yamlFormRef.value?.validate();
      submitLoading.value = true;

      const params: UpdatePVByYamlReq = {
        cluster_id: clusterId,
        name: currentOperationPV.value.name,
        yaml: yamlFormModel.value.yaml,
      };

      await updateK8sPVByYaml(params);
      message.success('通过YAML更新PV成功');
      isYamlModalVisible.value = false;
      resetYamlForm();
      await fetchPVs();
    } catch (error: any) {

      message.error(error?.message || '通过YAML更新PV失败');
    } finally {
      submitLoading.value = false;
    }
  };

  const deletePV = async (record: K8sPV, force: boolean = false) => {
    const clusterId = validateClusterId(record);
    if (!clusterId) return;

    Modal.confirm({
      title: `确认删除PV "${record.name}"?`,
      content: force ? '这将强制删除PV，此操作不可恢复！' : '此操作不可恢复，请确认！',
      okText: '确认删除',
      cancelText: '取消',
      okType: 'danger',
      onOk: async () => {
        try {
          const params: DeletePVReq = {
            cluster_id: clusterId,
            name: record.name,
            force: force,
          };

          await deleteK8sPV(params);
          message.success(`删除PV "${record.name}" 成功`);
          await fetchPVs();
        } catch (error: any) {

          message.error(error?.message || '删除PV失败');
        }
      },
    });
  };

  const reclaimPV = async (record: K8sPV) => {
    const clusterId = validateClusterId(record);
    if (!clusterId) return;

    Modal.confirm({
      title: `确认回收PV "${record.name}"?`,
      content: '回收后PV将变为可用状态，请确认！',
      okText: '确认回收',
      cancelText: '取消',
      onOk: async () => {
        try {
          const params: ReclaimPVReq = {
            cluster_id: clusterId,
            name: record.name,
          };

          await reclaimK8sPV(params);
          message.success(`回收PV "${record.name}" 成功`);
          await fetchPVs();
        } catch (error: any) {

          message.error(error?.message || '回收PV失败');
        }
      },
    });
  };

  const deleteBatchPVs = async () => {
    if (selectedRows.value.length === 0) {
      message.warning('请先选择要删除的PV');
      return;
    }

    Modal.confirm({
      title: `确认删除选中的 ${selectedRows.value.length} 个PV?`,
      content: '此操作不可恢复，请确认！',
      okText: '确认删除',
      cancelText: '取消',
      okType: 'danger',
      onOk: async () => {
        try {
          const promises = selectedRows.value.map(async (record) => {
            const clusterId = validateClusterId(record);
            if (!clusterId) return Promise.resolve();

            const params: DeletePVReq = {
              cluster_id: clusterId,
              name: record.name,
            };

            return deleteK8sPV(params);
          });

          await Promise.all(promises);
          message.success(`成功删除 ${selectedRows.value.length} 个PV`);
          selectedRowKeys.value = [];
          selectedRows.value = [];
          await fetchPVs();
        } catch (error: any) {

          message.error(error?.message || '批量删除PV失败');
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

  const openEditModal = async (record: K8sPV) => {
    currentOperationPV.value = record;
    resetEditForm();
    // 填充编辑表单
    editFormModel.value = {
      name: record.name,
      capacity: record.capacity,
      access_modes: record.access_modes || [],
      reclaim_policy: record.reclaim_policy,
      storage_class: record.storage_class,
      volume_mode: record.volume_mode,
      volume_source: record.volume_source || {},
      node_affinity: record.node_affinity || {},
      labels: record.labels || {},
      annotations: record.annotations || {},
    };
    isEditModalVisible.value = true;
  };

  const openDetailModal = async (record: K8sPV) => {
    currentOperationPV.value = record;
    isDetailModalVisible.value = true;
    await fetchPVDetails(record);
  };

  const openYamlModal = async (record: K8sPV) => {
    currentOperationPV.value = record;
    resetYamlForm();
    isYamlModalVisible.value = true;
    await fetchPVYaml(record);
    yamlFormModel.value.yaml = currentYamlContent.value;
  };

  // form helpers
  const resetCreateForm = () => {
    createFormModel.value = {
      name: '',
      capacity: '',
      access_modes: ['ReadWriteOnce'],
      reclaim_policy: 'Retain',
      storage_class: '',
      volume_mode: 'Filesystem',
      volume_source: {},
      node_affinity: {},
      labels: {},
      annotations: {},
    };
    formRef.value?.resetFields();
  };

  const resetEditForm = () => {
    editFormModel.value = {
      name: '',
      capacity: '',
      access_modes: [],
      reclaim_policy: '',
      storage_class: '',
      volume_mode: '',
      volume_source: {},
      node_affinity: {},
      labels: {},
      annotations: {},
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

  // filter handlers
  const handleClusterChange = (value: number | undefined) => {
    filterClusterId.value = value;
    clearPVs();
    total.value = 0;
    currentPage.value = 1;
    if (value) {
      fetchPVs();
    }
  };

  const handleFilterChange = () => {
    currentPage.value = 1;
    fetchPVs();
  };

  const handleSearch = (value: string) => {
    searchText.value = value;
    currentPage.value = 1;
    fetchPVs();
  };

  const handlePageChange = (page: number, size: number) => {
    currentPage.value = page;
    pageSize.value = size;
    fetchPVs();
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

  // volume source helpers
  const addVolumeSourceItem = () => {
    createFormModel.value.volume_source[''] = '';
  };

  const removeVolumeSourceItem = (key: string) => {
    delete createFormModel.value.volume_source[key];
  };

  const addEditVolumeSourceItem = () => {
    editFormModel.value.volume_source[''] = '';
  };

  const removeEditVolumeSourceItem = (key: string) => {
    delete editFormModel.value.volume_source[key];
  };

  return {
    // state
    pvs,
    clusters,
    loading,
    clustersLoading,
    searchText,
    filterClusterId,
    filterStatus,
    filterAccessMode,
    filterVolumeType,
    selectedRowKeys,
    selectedRows,
    currentPage,
    pageSize,
    total,
    clustersPage,
    clustersSize,
    
    // form refs
    formRef,
    yamlFormRef,
    createYamlFormRef,
    
    // modal state
    isCreateModalVisible,
    isCreateYamlModalVisible,
    isEditModalVisible,
    isDetailModalVisible,
    isYamlModalVisible,
    submitLoading,
    detailLoading,
    
    // current operation
    currentOperationPV,
    currentPVDetail,
    currentYamlContent,
    
    // form models
    createFormModel,
    editFormModel,
    yamlFormModel,
    createYamlFormModel,
    
    // form rules
    createFormRules,
    yamlFormRules,
    createYamlFormRules,
    
    // computed
    filteredPVs,
    rowSelection,
    
    // helpers
    getEnvText,
    getPVStatusText,
    getPVStatusColor,
    getAccessModeText,
    
    // operations
    fetchClusters,
    fetchPVs,
    fetchPVDetails,
    fetchPVYaml,
    clearPVs,
    loadMoreClusters,
    resetClusters,
    
    // crud operations
    createPV,
    createPVByYaml,
    updatePV,
    updatePVByYaml,
    deletePV,
    reclaimPV,
    deleteBatchPVs,
    
    // modal handlers
    openCreateModal,
    openCreateYamlModal,
    openEditModal,
    openDetailModal,
    openYamlModal,
    
    // form helpers
    resetCreateForm,
    resetEditForm,
    resetYamlForm,
    resetCreateYamlForm,
    
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
    
    // volume source helpers
    addVolumeSourceItem,
    removeVolumeSourceItem,
    addEditVolumeSourceItem,
    removeEditVolumeSourceItem,
    
    // constants
    K8sPVStatus,
    
    // additional required properties
    clustersTotal,
  };
}
