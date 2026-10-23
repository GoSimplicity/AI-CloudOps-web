import { ref, computed } from 'vue';
import { message, Modal } from 'ant-design-vue';
import type { FormInstance, Rule } from 'ant-design-vue/es/form';
import {
  type K8sService,
  type ServicePort,
  type ServiceEndpointItem,
  type GetServiceListReq,
  type CreateServiceReq,
  type UpdateServiceReq,
  type CreateResourceByYamlReq,
  type UpdateResourceByYamlReq,
  K8sSvcStatus,
  getServiceListApi,
  getServiceDetailsApi,
  getServiceYamlApi,
  createServiceApi,
  createServiceByYamlApi,
  updateServiceApi,
  updateServiceByYamlApi,
  deleteServiceApi,
  getServiceEndpointsApi,
} from '#/api/core/k8s/k8s_service';
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

export function useServicePage() {
  // state
  const services = ref<K8sService[]>([]);
  const clusters = ref<K8sCluster[]>([]);
  const namespaces = ref<K8sNamespace[]>([]);
  const loading = ref(false);
  const loadError = ref('');
  const clustersError = ref('');
  const namespacesError = ref('');
  let resourceRequestId = 0;
  let namespaceRequestId = 0;
  const clustersLoading = ref(false);
  const namespacesLoading = ref(false);
  const searchText = ref('');
  const filterStatus = ref<K8sSvcStatus | undefined>(undefined);
  const filterClusterId = ref<number | undefined>(undefined);
  const filterNamespace = ref<string | undefined>(undefined);
  const filterType = ref<string | undefined>(undefined);
  const filterLabels = ref<Record<string, string>>({});
  const selectedRowKeys = ref<string[]>([]);
  const selectedRows = ref<K8sService[]>([]);
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
  const yamlFormRef = ref<FormInstance>();
  const createYamlFormRef = ref<FormInstance>();

  // modal/form state
  const isCreateModalVisible = ref(false);
  const isCreateYamlModalVisible = ref(false);
  const isEditModalVisible = ref(false);
  const isDetailModalVisible = ref(false);
  const isYamlModalVisible = ref(false);
  const isEndpointsModalVisible = ref(false);
  const submitLoading = ref(false);
  const detailLoading = ref(false);

  // current operation target
  const currentOperationService = ref<K8sService | null>(null);
  const currentServiceDetail = ref<K8sService | null>(null);
  const currentYamlContent = ref('');
  const serviceEndpoints = ref<ServiceEndpointItem[]>([]);

  // form models
  const createFormModel = ref<{
    name: string;
    namespace: string;
    type: string;
    ports: ServicePort[];
    selector: Record<string, string>;
    labels: Record<string, string>;
    annotations: Record<string, string>;
  }>({
    name: '',
    namespace: '',
    type: 'ClusterIP',
    ports: [{ name: '', protocol: 'TCP', port: 80, target_port: 80 }],
    selector: {},
    labels: {},
    annotations: {},
  });

  const editFormModel = ref<{
    name: string;
    namespace: string;
    type: string;
    ports: ServicePort[];
    selector: Record<string, string>;
    labels: Record<string, string>;
    annotations: Record<string, string>;
  }>({
    name: '',
    namespace: '',
    type: 'ClusterIP',
    ports: [{ name: '', protocol: 'TCP', port: 80, target_port: 80 }],
    selector: {},
    labels: {},
    annotations: {},
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
      { required: true, message: '请输入 Service 名称', trigger: 'blur' },
      { pattern: /^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/, message: 'Service 名称只能包含小写字母、数字和连字符，且不能以连字符开头或结尾', trigger: 'blur' },
      { max: 63, message: 'Service 名称长度不能超过63个字符', trigger: 'blur' }
    ],
    namespace: [
      { required: true, message: '请选择命名空间', trigger: 'change' }
    ],
    type: [
      { required: true, message: '请选择 Service 类型', trigger: 'change' }
    ]
  };

  const yamlFormRules: Record<string, Rule[]> = {
    yaml: [
      { required: true, message: '请输入 YAML 内容', trigger: 'blur' },
      { min: 50, message: 'YAML 内容过短，请检查是否完整', trigger: 'blur' }
    ]
  };

  const editFormRules: Record<string, Rule[]> = {
    name: [
      { required: true, message: '请输入 Service 名称', trigger: 'blur' },
      { pattern: /^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/, message: 'Service 名称只能包含小写字母、数字和连字符，且不能以连字符开头或结尾', trigger: 'blur' },
      { max: 63, message: 'Service 名称长度不能超过63个字符', trigger: 'blur' }
    ],
    namespace: [
      { required: true, message: '请选择命名空间', trigger: 'change' }
    ],
    type: [
      { required: true, message: '请选择 Service 类型', trigger: 'change' }
    ]
  };

  const createYamlFormRules: Record<string, Rule[]> = {
    yaml: [
      { required: true, message: '请输入 YAML 内容', trigger: 'blur' },
      { min: 50, message: 'YAML 内容过短，请检查是否完整', trigger: 'blur' }
    ]
  };

  // computed
  const filteredServices = computed(() => {
    return services.value;
  });

  const rowSelection = computed(() => ({
    selectedRowKeys: selectedRowKeys.value,
    onChange: (keys: string[], rows: K8sService[]) => {
      selectedRowKeys.value = keys;
      selectedRows.value = rows;
    },
  }));

  // helpers
  const validateClusterId = (record: K8sService): number | null => {
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

  const getStatusText = (status?: K8sSvcStatus) => {
    const map: Record<K8sSvcStatus, string> = {
      [K8sSvcStatus.Running]: '运行中',
      [K8sSvcStatus.Stopped]: '已停止',
      [K8sSvcStatus.Error]: '异常',
    };
    return status !== undefined ? map[status] || '未知' : '未知';
  };

  const getStatusColor = (status?: K8sSvcStatus) => {
    const map: Record<K8sSvcStatus, string> = {
      [K8sSvcStatus.Running]: 'success',
      [K8sSvcStatus.Stopped]: 'default',
      [K8sSvcStatus.Error]: 'error',
    };
    return status !== undefined ? map[status] || 'default' : 'default';
  };

  const getServiceTypeText = (type?: string) => {
    const map: Record<string, string> = {
      'ClusterIP': 'ClusterIP',
      'NodePort': 'NodePort',
      'LoadBalancer': 'LoadBalancer',
      'ExternalName': 'ExternalName',
    };
    return type ? map[type] || type : '-';
  };

  const getServiceTypeColor = (type?: string) => {
    const map: Record<string, string> = {
      'ClusterIP': 'blue',
      'NodePort': 'green',
      'LoadBalancer': 'orange',
      'ExternalName': 'purple',
    };
    return type ? map[type] || 'default' : 'default';
  };

  // 转换函数：Record<string, string> -> KeyValueList
  const recordToKeyValueList = (record: Record<string, string>): KeyValueList => {
    return Object.entries(record).map(([key, value]: [string, string]) => ({ key, value }));
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
  const clearServices = () => {
    resourceRequestId++;
    loading.value = false;
    total.value = 0;
    loadError.value = '';
    services.value = [];
    selectedRowKeys.value = [];
    selectedRows.value = [];
  };

  const clearNamespaces = () => {
    namespaceRequestId++;
    namespacesLoading.value = false;
    namespacesError.value = '';
    resetNamespaces();
    filterNamespace.value = undefined;
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
          // 自动加载该集群的命名空间和Service数据
          await fetchNamespaces();
          await fetchServices();
        }
      }
    } catch (err) {
      if (clustersPage.value === 1) {
        clusters.value = [];
        clustersTotal.value = 0;
        filterClusterId.value = undefined;
        clearNamespaces();
        clearServices();
      }
      clustersError.value = '获取集群列表失败，请重试';
      message.error(clustersError.value);
    } finally {
      clustersLoading.value = false;
    }
  };

  const fetchNamespaces = async (reset = false) => {
    const clusterId = filterClusterId.value;
    if (!clusterId) {
      clearNamespaces();
      return;
    }
    const requestId = ++namespaceRequestId;

    if (reset) {
      resetNamespaces();
    }

    try {
      namespacesLoading.value = true;
      namespacesError.value = '';
      const params: K8sNamespaceListReq = {
        cluster_id: clusterId,
        page: namespacesPage.value,
        size: namespacesSize.value,
      };
      const res = await getNamespacesListApi(clusterId, params);
      if (
        requestId !== namespaceRequestId ||
        filterClusterId.value !== clusterId
      )
        return;
      if (namespacesPage.value === 1) {
        namespaces.value = res?.items || [];
      } else {
        namespaces.value = [...namespaces.value, ...(res?.items || [])];
      }
      namespacesTotal.value = res?.total || 0;
    } catch (err) {
      if (
        requestId !== namespaceRequestId ||
        filterClusterId.value !== clusterId
      )
        return;
      namespaces.value = [];
      namespacesTotal.value = 0;
      namespacesError.value = '获取命名空间列表失败，请重试';
      message.error(namespacesError.value);
    } finally {
      if (requestId === namespaceRequestId) namespacesLoading.value = false;
    }
  };

  // crud operations
  const fetchServices = async () => {
    const clusterId = filterClusterId.value;
    const namespace = filterNamespace.value;
    if (!clusterId) {
      clearServices();
      return;
    }
    const requestId = ++resourceRequestId;
    try {
      loading.value = true;
      loadError.value = '';
      selectedRowKeys.value = [];
      selectedRows.value = [];
      const params: GetServiceListReq = {
        cluster_id: clusterId,
        page: currentPage.value,
        size: pageSize.value,
        search: searchText.value || undefined,
        namespace: namespace || undefined,
        type: filterType.value || undefined,
        status: filterStatus.value || undefined,
        labels: Object.keys(filterLabels.value).length > 0 ? filterLabels.value : undefined,
      };
      const res = await getServiceListApi(clusterId, params);
      if (requestId !== resourceRequestId || filterClusterId.value !== clusterId || filterNamespace.value !== namespace) return;
      // 确保每个service对象都有正确的cluster_id
      const servicesWithClusterId = (res?.items || []).map((service: K8sService) => ({
        ...service,
        cluster_id: service.cluster_id || clusterId
      }));
      services.value = servicesWithClusterId;
      total.value = res?.total || 0;
    } catch (err) {
      if (requestId !== resourceRequestId || filterClusterId.value !== clusterId || filterNamespace.value !== namespace) return;
      clearServices();
      loadError.value = '获取 Service 列表失败，请重试';
      message.error(loadError.value);

    } finally {
      if (requestId === resourceRequestId) loading.value = false;
    }
  };

  // 查看详情
  const showServiceDetail = async (record: K8sService) => {
    const clusterId = validateClusterId(record);
    if (!clusterId) return;
    
    try {
      detailLoading.value = true;
      isDetailModalVisible.value = true;
      const res = await getServiceDetailsApi(clusterId, record.namespace, record.name);
      
      // 直接使用详情数据，不需要转换格式
      const processedDetail = res ? {
        ...res,
        cluster_id: clusterId
      } : { 
        ...record, 
        cluster_id: clusterId
      };
      
      currentServiceDetail.value = processedDetail;
    } catch (err) {
      message.error('获取 Service 详情失败');

      // 错误时使用原始记录数据
      const fallbackDetail = { 
        ...record, 
        cluster_id: clusterId
      };
      currentServiceDetail.value = fallbackDetail;
    } finally {
      detailLoading.value = false;
    }
  };

  const closeDetailModal = () => {
    isDetailModalVisible.value = false;
    currentServiceDetail.value = null;
  };

  // YAML 操作
  const showYamlModal = async (record: K8sService) => {
    const clusterId = validateClusterId(record);
    if (!clusterId) return;
    
    try {
      submitLoading.value = true;
      currentOperationService.value = { ...record, cluster_id: clusterId };
      const res = await getServiceYamlApi(clusterId, record.namespace, record.name);
      currentYamlContent.value = res?.yaml || '';
      yamlFormModel.value.yaml = res?.yaml || '';
      isYamlModalVisible.value = true;
    } catch (err) {
      message.error('获取 Service YAML 失败');

    } finally {
      submitLoading.value = false;
    }
  };

  const closeYamlModal = () => {
    isYamlModalVisible.value = false;
    currentOperationService.value = null;
    currentYamlContent.value = '';
    yamlFormModel.value.yaml = '';
  };

  const submitYamlForm = async () => {
    if (!yamlFormRef.value || !currentOperationService.value) return;
    
    try {
      await yamlFormRef.value.validate();
      submitLoading.value = true;
      
      const params: UpdateResourceByYamlReq = {
        cluster_id: currentOperationService.value.cluster_id,
        namespace: currentOperationService.value.namespace,
        name: currentOperationService.value.name,
        yaml: yamlFormModel.value.yaml,
      };
      
      await updateServiceByYamlApi(
        currentOperationService.value.cluster_id,
        currentOperationService.value.namespace,
        currentOperationService.value.name,
        params
      );
      message.success('🎉 Service YAML 更新成功');
      isYamlModalVisible.value = false;
      await fetchServices();
    } catch (err: unknown) {
      if (err && typeof err === 'object' && 'errorFields' in err) {
        message.warning('请检查 YAML 格式是否正确');
        return;
      }
      message.error('❌ Service YAML 更新失败');

    } finally {
      submitLoading.value = false;
    }
  };

  // 创建 Service
  const openCreateModal = () => {
    createFormModel.value = {
      name: '',
      namespace: '',
      type: 'ClusterIP',
      ports: [{ name: '', protocol: 'TCP', port: 80, target_port: 80 }],
      selector: {},
      labels: {},
      annotations: {},
    };
    isCreateModalVisible.value = true;
  };

  const closeCreateModal = () => {
    isCreateModalVisible.value = false;
  };

  // 通过 YAML 创建 Service
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
      
      const params: CreateServiceReq = {
        cluster_id: filterClusterId.value,
        name: createFormModel.value.name,
        namespace: createFormModel.value.namespace,
        type: createFormModel.value.type,
        ports: createFormModel.value.ports,
        selector: Object.keys(createFormModel.value.selector).length > 0 ? createFormModel.value.selector : undefined,
        labels: Object.keys(createFormModel.value.labels).length > 0 ? createFormModel.value.labels : undefined,
        annotations: Object.keys(createFormModel.value.annotations).length > 0 ? createFormModel.value.annotations : undefined,
      };
      
      await createServiceApi(filterClusterId.value, params);
      message.success('🎉 Service 创建成功');
      isCreateModalVisible.value = false;
      await fetchServices();
    } catch (err: unknown) {
      if (err && typeof err === 'object' && 'errorFields' in err) {
        message.warning('请检查表单填写是否正确');
        return;
      }
      message.error('❌ Service 创建失败');

    } finally {
      submitLoading.value = false;
    }
  };

  const submitCreateYamlForm = async () => {
    if (!createYamlFormRef.value || !filterClusterId.value) return;
    
    try {
      await createYamlFormRef.value.validate();
      submitLoading.value = true;
      
      const params: CreateResourceByYamlReq = {
        cluster_id: filterClusterId.value,
        yaml: createYamlFormModel.value.yaml,
      };
      
      await createServiceByYamlApi(filterClusterId.value, params);
      message.success('🎉 Service YAML 创建成功');
      isCreateYamlModalVisible.value = false;
      await fetchServices();
    } catch (err: unknown) {
      if (err && typeof err === 'object' && 'errorFields' in err) {
        message.warning('请检查 YAML 格式是否正确');
        return;
      }
      message.error('❌ Service YAML 创建失败');

    } finally {
      submitLoading.value = false;
    }
  };

  // 编辑 Service
  const openEditModal = (record: K8sService) => {
    currentOperationService.value = record;
    editFormModel.value = {
      name: record.name,
      namespace: record.namespace,
      type: record.type,
      ports: record.ports || [{ name: '', protocol: 'TCP', port: 80, target_port: 80 }],
      selector: record.selector || {},
      labels: record.labels || {},
      annotations: record.annotations || {},
    };
    isEditModalVisible.value = true;
  };

  const closeEditModal = () => {
    isEditModalVisible.value = false;
    currentOperationService.value = null;
    if (editFormRef.value) {
      editFormRef.value.resetFields();
    }
  };

  const submitEditForm = async () => {
    if (!editFormRef.value || !currentOperationService.value) return;
    
    try {
      await editFormRef.value.validate();
      submitLoading.value = true;
      
      const params: UpdateServiceReq = {
        cluster_id: currentOperationService.value.cluster_id,
        namespace: currentOperationService.value.namespace,
        name: currentOperationService.value.name,
        type: editFormModel.value.type,
        ports: editFormModel.value.ports,
        selector: Object.keys(editFormModel.value.selector).length > 0 ? editFormModel.value.selector : undefined,
        labels: Object.keys(editFormModel.value.labels).length > 0 ? editFormModel.value.labels : undefined,
        annotations: Object.keys(editFormModel.value.annotations).length > 0 ? editFormModel.value.annotations : undefined,
      };
      
      await updateServiceApi(
        currentOperationService.value.cluster_id,
        currentOperationService.value.namespace,
        currentOperationService.value.name,
        params
      );
      message.success('🎉 Service 更新成功');
      isEditModalVisible.value = false;
      await fetchServices();
    } catch (err: unknown) {
      if (err && typeof err === 'object' && 'errorFields' in err) {
        message.warning('请检查表单填写是否正确');
        return;
      }
      message.error('❌ Service 更新失败');

    } finally {
      submitLoading.value = false;
    }
  };

  // 删除 Service
  const deleteService = (record: K8sService) => {
    const clusterId = validateClusterId(record);
    if (!clusterId) return;
    
    Modal.confirm({
      title: '删除 Service',
      content: `确定要删除 Service "${record.name}" 吗？此操作不可逆！`,
      okText: '确认删除',
      okType: 'danger',
      cancelText: '取消',
      centered: true,
      onOk: async () => {
        try {
          await deleteServiceApi(clusterId, record.namespace, record.name);
          message.success('✅ Service 删除成功');
          await fetchServices();
        } catch (err) {
          message.error('❌ Service 删除失败');

        }
      },
    });
  };

  // 查看端点
  const showEndpointsModal = async (record: K8sService) => {
    const clusterId = validateClusterId(record);
    if (!clusterId) return;
    
    try {
      submitLoading.value = true;
      currentOperationService.value = { ...record, cluster_id: clusterId };
      const res = await getServiceEndpointsApi(clusterId, record.namespace, record.name);
      serviceEndpoints.value = res || [];
      isEndpointsModalVisible.value = true;
    } catch (err) {
      message.error('获取 Service 端点失败');

    } finally {
      submitLoading.value = false;
    }
  };

  const closeEndpointsModal = () => {
    isEndpointsModalVisible.value = false;
    currentOperationService.value = null;
    serviceEndpoints.value = [];
  };

  // 标签过滤管理
  const addFilterLabel = (key: string, value: string) => {
    if (key && key.trim()) {
      filterLabels.value[key.trim()] = value;
      currentPage.value = 1;
      fetchServices();
    }
  };

  const removeFilterLabel = (key: string) => {
    delete filterLabels.value[key];
    currentPage.value = 1;
    fetchServices();
  };

  const clearFilterLabels = () => {
    filterLabels.value = {};
    currentPage.value = 1;
    fetchServices();
  };

  // 批量操作
  const batchOperation = (operation: string) => {
    if (!selectedRows.value.length) return;
    
    Modal.confirm({
      title: `批量${operation}`,
      content: `确定要对选中的 ${selectedRows.value.length} 个 Service 执行${operation}操作吗？`,
      okText: '确认执行',
      okType: operation === '删除' ? 'danger' : 'primary',
      cancelText: '取消',
      centered: true,
      onOk: async () => {
        try {
          for (const service of selectedRows.value) {
            const clusterId = service.cluster_id || filterClusterId.value;
            if (!clusterId) {
              message.error(`Service "${service.name}" 缺少有效的集群ID，跳过操作`);
              continue;
            }
            
            if (operation === '删除') {
              await deleteServiceApi(clusterId, service.namespace, service.name);
            }
          }
          message.success(`✅ 批量${operation}操作已完成`);
          selectedRowKeys.value = [];
          selectedRows.value = [];
          await fetchServices();
        } catch (err) {
          message.error(`❌ 批量${operation}失败`);

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
    await fetchServices();
  };

  // 搜索处理
  const onSearch = () => {
    currentPage.value = 1; // 搜索时重置到第一页
    fetchServices();
  };

  // 筛选条件变化处理
  const handleFilterChange = () => {
    currentPage.value = 1; // 筛选时重置到第一页
    fetchServices();
  };

  // 集群变化处理
  const handleClusterChange = () => {
    currentPage.value = 1;
    clearNamespaces();
    clearServices();
    
    if (filterClusterId.value) {
      fetchNamespaces(true); // 重置命名空间分页
      fetchServices();
    }
  };

  // 处理集群下拉选择的滚动事件
  const handleClusterDropdownScroll = (e: Event) => {
    const { target } = e;
    if (target && 'scrollTop' in target && 'scrollHeight' in target && 'clientHeight' in target) {
      const scrollTarget = target as HTMLElement;
      if (scrollTarget.scrollTop + scrollTarget.clientHeight >= scrollTarget.scrollHeight - 5) {
        loadMoreClusters();
      }
    }
  };

  // 编辑表单辅助变量
  const newEditLabelKey = ref('');
  const newEditSelectorKey = ref('');
  const newEditAnnotationKey = ref('');

  // 表单字段操作
  const addPortField = () => {
    createFormModel.value.ports.push({ name: '', protocol: 'TCP', port: 80, target_port: 80 });
  };

  const removePortField = (index: number) => {
    if (createFormModel.value.ports.length > 1) {
      createFormModel.value.ports.splice(index, 1);
    }
  };

  // 编辑表单字段操作
  const addEditPortField = () => {
    editFormModel.value.ports.push({ name: '', protocol: 'TCP', port: 80, target_port: 80 });
  };

  const removeEditPortField = (index: number) => {
    if (editFormModel.value.ports.length > 1) {
      editFormModel.value.ports.splice(index, 1);
    }
  };

  const addNewEditLabel = () => {
    if (newEditLabelKey.value.trim()) {
      if (!editFormModel.value.labels) {
        editFormModel.value.labels = {};
      }
      editFormModel.value.labels[newEditLabelKey.value.trim()] = '';
      newEditLabelKey.value = '';
    }
  };

  const removeEditLabelField = (key: string) => {
    if (editFormModel.value.labels) {
      delete editFormModel.value.labels[key];
    }
  };

  const addNewEditSelector = () => {
    if (newEditSelectorKey.value.trim()) {
      if (!editFormModel.value.selector) {
        editFormModel.value.selector = {};
      }
      editFormModel.value.selector[newEditSelectorKey.value.trim()] = '';
      newEditSelectorKey.value = '';
    }
  };

  const removeEditSelectorField = (key: string) => {
    if (editFormModel.value.selector) {
      delete editFormModel.value.selector[key];
    }
  };

  const addNewEditAnnotation = () => {
    if (newEditAnnotationKey.value.trim()) {
      if (!editFormModel.value.annotations) {
        editFormModel.value.annotations = {};
      }
      editFormModel.value.annotations[newEditAnnotationKey.value.trim()] = '';
      newEditAnnotationKey.value = '';
    }
  };

  const removeEditAnnotationField = (key: string) => {
    if (editFormModel.value.annotations) {
      delete editFormModel.value.annotations[key];
    }
  };

  const addLabelField = () => {
    // 标签字段通过模态框单独管理
  };

  const removeLabelField = (key: string) => {
    delete createFormModel.value.labels[key];
  };

  const addAnnotationField = () => {
    // 注解字段通过模态框单独管理
  };

  const removeAnnotationField = (key: string) => {
    delete createFormModel.value.annotations[key];
  };

  const addSelectorField = () => {
    // 选择器字段通过模态框单独管理
  };

  const removeSelectorField = (key: string) => {
    delete createFormModel.value.selector[key];
  };

  return {
    // state
    services,
    clusters,
    namespaces,
    loading,
    loadError,
    clustersError,
    namespacesError,
    clustersLoading,
    namespacesLoading,
    searchText,
    filterStatus,
    filterClusterId,
    filterNamespace,
    filterType,
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
    yamlFormRef,
    createYamlFormRef,
    
    // modal state
    isCreateModalVisible,
    isCreateYamlModalVisible,
    isEditModalVisible,
    isDetailModalVisible,
    isYamlModalVisible,
    isEndpointsModalVisible,
    submitLoading,
    detailLoading,
    
    // operation targets
    currentOperationService,
    currentServiceDetail,
    currentYamlContent,
    serviceEndpoints,
    
    // form models
    createFormModel,
    editFormModel,
    yamlFormModel,
    createYamlFormModel,
    
    // form rules
    createFormRules,
    editFormRules,
    yamlFormRules,
    createYamlFormRules,
    
    // computed
    filteredServices,
    rowSelection,
    
    // helpers
    validateClusterId,
    getEnvText,
    getStatusText,
    getStatusColor,
    getServiceTypeText,
    getServiceTypeColor,
    recordToKeyValueList,
    keyValueListToRecord,
    
    // operations
    fetchClusters,
    fetchNamespaces,
    fetchServices,
    clearServices,
    clearNamespaces,
    loadMoreClusters,
    loadMoreNamespaces,
    
    // detail operations
    showServiceDetail,
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
    
    // edit operations
    openEditModal,
    closeEditModal,
    submitEditForm,
    
    // service operations
    deleteService,
    
    // endpoints operations
    showEndpointsModal,
    closeEndpointsModal,
    
    // filter operations
    addFilterLabel,
    removeFilterLabel,
    clearFilterLabels,
    
    // batch operations
    batchOperation,
    
    // pagination operations  
    resetClusters,
    handlePageChange,
    onSearch,
    handleFilterChange,
    handleClusterChange,
    handleClusterDropdownScroll,
    
    // form field operations
    addPortField,
    removePortField,
    addLabelField,
    removeLabelField,
    addAnnotationField,
    removeAnnotationField,
    addSelectorField,
    removeSelectorField,
    
    // edit form field operations
    addEditPortField,
    removeEditPortField,
    addNewEditLabel,
    removeEditLabelField,
    addNewEditSelector,
    removeEditSelectorField,
    addNewEditAnnotation,
    removeEditAnnotationField,
    
    // edit form helper variables
    newEditLabelKey,
    newEditSelectorKey,
    newEditAnnotationKey,
    
    // constants
    K8sSvcStatus,
  };
}
