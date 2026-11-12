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
  getNamespacesListApi,
  type K8sNamespace,
  type K8sNamespaceListReq,
} from '#/api/core/k8s/k8s_namespace';
import {
  type CreateResourceByYamlReq,
  createServiceApi,
  createServiceByYamlApi,
  type CreateServiceReq,
  deleteServiceApi,
  getServiceDetailsApi,
  getServiceEndpointsApi,
  getServiceListApi,
  type GetServiceListReq,
  getServiceYamlApi,
  type K8sService,
  K8sSvcStatus,
  type ServiceEndpointItem,
  type ServicePort,
  type UpdateResourceByYamlReq,
  updateServiceApi,
  updateServiceByYamlApi,
  type UpdateServiceReq,
} from '#/api/core/k8s/k8s_service';
import { getOwnLookupValue } from '#/utils/own-lookup';
import {
  shouldNotifyPageError,
  shouldRecordPageError,
} from '#/utils/permission/request-notice';

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
    annotations: Record<string, string>;
    labels: Record<string, string>;
    name: string;
    namespace: string;
    ports: ServicePort[];
    selector: Record<string, string>;
    type: string;
  }>({
    annotations: {},
    labels: {},
    name: '',
    namespace: '',
    ports: [{ name: '', port: 80, protocol: 'TCP', target_port: 80 }],
    selector: {},
    type: 'ClusterIP',
  });

  const editFormModel = ref<{
    annotations: Record<string, string>;
    labels: Record<string, string>;
    name: string;
    namespace: string;
    ports: ServicePort[];
    selector: Record<string, string>;
    type: string;
  }>({
    annotations: {},
    labels: {},
    name: '',
    namespace: '',
    ports: [{ name: '', port: 80, protocol: 'TCP', target_port: 80 }],
    selector: {},
    type: 'ClusterIP',
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
      { message: '请输入 Service 名称', required: true, trigger: 'blur' },
      {
        message:
          'Service 名称只能包含小写字母、数字和连字符，且不能以连字符开头或结尾',
        pattern: /^[\da-z]([\da-z-]*[\da-z])?$/,
        trigger: 'blur',
      },
      { max: 63, message: 'Service 名称长度不能超过63个字符', trigger: 'blur' },
    ],
    namespace: [
      { message: '请选择命名空间', required: true, trigger: 'change' },
    ],
    type: [
      { message: '请选择 Service 类型', required: true, trigger: 'change' },
    ],
  };

  const yamlFormRules: Record<string, Rule[]> = {
    yaml: [
      { message: '请输入 YAML 内容', required: true, trigger: 'blur' },
      { message: 'YAML 内容过短，请检查是否完整', min: 50, trigger: 'blur' },
    ],
  };

  const editFormRules: Record<string, Rule[]> = {
    name: [
      { message: '请输入 Service 名称', required: true, trigger: 'blur' },
      {
        message:
          'Service 名称只能包含小写字母、数字和连字符，且不能以连字符开头或结尾',
        pattern: /^[\da-z]([\da-z-]*[\da-z])?$/,
        trigger: 'blur',
      },
      { max: 63, message: 'Service 名称长度不能超过63个字符', trigger: 'blur' },
    ],
    namespace: [
      { message: '请选择命名空间', required: true, trigger: 'change' },
    ],
    type: [
      { message: '请选择 Service 类型', required: true, trigger: 'change' },
    ],
  };

  const createYamlFormRules: Record<string, Rule[]> = {
    yaml: [
      { message: '请输入 YAML 内容', required: true, trigger: 'blur' },
      { message: 'YAML 内容过短，请检查是否完整', min: 50, trigger: 'blur' },
    ],
  };

  // computed
  const filteredServices = computed(() => {
    return services.value;
  });

  const rowSelection = computed(() => ({
    onChange: (keys: string[], rows: K8sService[]) => {
      selectedRowKeys.value = keys;
      selectedRows.value = rows;
    },
    selectedRowKeys: selectedRowKeys.value,
  }));

  // helpers
  const validateClusterId = (record: K8sService): null | number => {
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

  const getStatusText = (status?: K8sSvcStatus) => {
    const map: Record<K8sSvcStatus, string> = {
      [K8sSvcStatus.Error]: '异常',
      [K8sSvcStatus.Running]: '运行中',
      [K8sSvcStatus.Stopped]: '已停止',
    };
    return status === undefined ? '未知' : map[status] || '未知';
  };

  const getStatusColor = (status?: K8sSvcStatus) => {
    const map: Record<K8sSvcStatus, string> = {
      [K8sSvcStatus.Error]: 'error',
      [K8sSvcStatus.Running]: 'success',
      [K8sSvcStatus.Stopped]: 'default',
    };
    return status === undefined ? 'default' : map[status] || 'default';
  };

  const getServiceTypeText = (type?: string) => {
    const map: Record<string, string> = {
      ClusterIP: 'ClusterIP',
      ExternalName: 'ExternalName',
      LoadBalancer: 'LoadBalancer',
      NodePort: 'NodePort',
    };
    return type ? getOwnLookupValue(map, type) || type : '-';
  };

  const getServiceTypeColor = (type?: string) => {
    const map: Record<string, string> = {
      ClusterIP: 'blue',
      ExternalName: 'purple',
      LoadBalancer: 'orange',
      NodePort: 'green',
    };
    return type ? getOwnLookupValue(map, type) || 'default' : 'default';
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

  const resetNamespaces = () => {
    namespacesPage.value = 1;
    namespaces.value = [];
    namespacesTotal.value = 0;
  };

  const clearNamespaces = () => {
    namespaceRequestId++;
    namespacesLoading.value = false;
    namespacesError.value = '';
    resetNamespaces();
    filterNamespace.value = undefined;
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
      namespaces.value =
        namespacesPage.value === 1
          ? res?.items || []
          : [...namespaces.value, ...(res?.items || [])];
      namespacesTotal.value = res?.total || 0;
    } catch (error) {
      if (
        requestId !== namespaceRequestId ||
        filterClusterId.value !== clusterId
      )
        return;
      namespaces.value = [];
      namespacesTotal.value = 0;
      if (shouldRecordPageError(error))
        namespacesError.value = '获取命名空间列表失败，请重试';
      if (shouldNotifyPageError(error)) message.error(namespacesError.value);
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
        labels:
          Object.keys(filterLabels.value).length > 0
            ? filterLabels.value
            : undefined,
        namespace: namespace || undefined,
        page: currentPage.value,
        search: searchText.value || undefined,
        size: pageSize.value,
        status: filterStatus.value || undefined,
        type: filterType.value || undefined,
      };
      const res = await getServiceListApi(clusterId, params);
      if (
        requestId !== resourceRequestId ||
        filterClusterId.value !== clusterId ||
        filterNamespace.value !== namespace
      )
        return;
      // 确保每个service对象都有正确的cluster_id
      const servicesWithClusterId = (res?.items || []).map(
        (service: K8sService) => ({
          ...service,
          cluster_id: service.cluster_id || clusterId,
        }),
      );
      services.value = servicesWithClusterId;
      total.value = res?.total || 0;
    } catch (error) {
      if (
        requestId !== resourceRequestId ||
        filterClusterId.value !== clusterId ||
        filterNamespace.value !== namespace
      )
        return;
      clearServices();
      if (shouldRecordPageError(error))
        loadError.value = '获取 Service 列表失败，请重试';
      if (shouldNotifyPageError(error)) message.error(loadError.value);
    } finally {
      if (requestId === resourceRequestId) loading.value = false;
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
        size: clustersSize.value,
      };
      const res = await getClustersListApi(params);
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
          // 自动加载该集群的命名空间和Service数据
          await fetchNamespaces();
          await fetchServices();
        }
      }
    } catch (error) {
      if (clustersPage.value === 1) {
        clusters.value = [];
        clustersTotal.value = 0;
        filterClusterId.value = undefined;
        clearNamespaces();
        clearServices();
      }
      if (shouldRecordPageError(error))
        clustersError.value = '获取集群列表失败，请重试';
      if (shouldNotifyPageError(error)) message.error(clustersError.value);
    } finally {
      clustersLoading.value = false;
    }
  };

  // 查看详情
  const showServiceDetail = async (record: K8sService) => {
    const clusterId = validateClusterId(record);
    if (!clusterId) return;

    try {
      detailLoading.value = true;
      isDetailModalVisible.value = true;
      const res = await getServiceDetailsApi(
        clusterId,
        record.namespace,
        record.name,
      );

      // 直接使用详情数据，不需要转换格式
      const processedDetail = res
        ? {
            ...res,
            cluster_id: clusterId,
          }
        : {
            ...record,
            cluster_id: clusterId,
          };

      currentServiceDetail.value = processedDetail;
    } catch (error) {
      if (shouldNotifyPageError(error)) message.error('获取 Service 详情失败');

      // 错误时使用原始记录数据
      const fallbackDetail = {
        ...record,
        cluster_id: clusterId,
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
      const res = await getServiceYamlApi(
        clusterId,
        record.namespace,
        record.name,
      );
      currentYamlContent.value = res?.yaml || '';
      yamlFormModel.value.yaml = res?.yaml || '';
      isYamlModalVisible.value = true;
    } catch (error) {
      if (shouldNotifyPageError(error)) message.error('获取 Service YAML 失败');
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
        name: currentOperationService.value.name,
        namespace: currentOperationService.value.namespace,
        yaml: yamlFormModel.value.yaml,
      };

      await updateServiceByYamlApi(
        currentOperationService.value.cluster_id,
        currentOperationService.value.namespace,
        currentOperationService.value.name,
        params,
      );
      message.success('🎉 Service YAML 更新成功');
      isYamlModalVisible.value = false;
      await fetchServices();
    } catch (error: unknown) {
      if (error && typeof error === 'object' && 'errorFields' in error) {
        if (shouldNotifyPageError(error))
          message.warning('请检查 YAML 格式是否正确');
        return;
      }
      if (shouldNotifyPageError(error))
        message.error('❌ Service YAML 更新失败');
    } finally {
      submitLoading.value = false;
    }
  };

  // 创建 Service
  const openCreateModal = () => {
    createFormModel.value = {
      annotations: {},
      labels: {},
      name: '',
      namespace: '',
      ports: [{ name: '', port: 80, protocol: 'TCP', target_port: 80 }],
      selector: {},
      type: 'ClusterIP',
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
        annotations:
          Object.keys(createFormModel.value.annotations).length > 0
            ? createFormModel.value.annotations
            : undefined,
        cluster_id: filterClusterId.value,
        labels:
          Object.keys(createFormModel.value.labels).length > 0
            ? createFormModel.value.labels
            : undefined,
        name: createFormModel.value.name,
        namespace: createFormModel.value.namespace,
        ports: createFormModel.value.ports,
        selector:
          Object.keys(createFormModel.value.selector).length > 0
            ? createFormModel.value.selector
            : undefined,
        type: createFormModel.value.type,
      };

      await createServiceApi(filterClusterId.value, params);
      message.success('🎉 Service 创建成功');
      isCreateModalVisible.value = false;
      await fetchServices();
    } catch (error: unknown) {
      if (error && typeof error === 'object' && 'errorFields' in error) {
        if (shouldNotifyPageError(error))
          message.warning('请检查表单填写是否正确');
        return;
      }
      if (shouldNotifyPageError(error)) message.error('❌ Service 创建失败');
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
    } catch (error: unknown) {
      if (error && typeof error === 'object' && 'errorFields' in error) {
        if (shouldNotifyPageError(error))
          message.warning('请检查 YAML 格式是否正确');
        return;
      }
      if (shouldNotifyPageError(error))
        message.error('❌ Service YAML 创建失败');
    } finally {
      submitLoading.value = false;
    }
  };

  // 编辑 Service
  const openEditModal = (record: K8sService) => {
    currentOperationService.value = record;
    editFormModel.value = {
      annotations: record.annotations || {},
      labels: record.labels || {},
      name: record.name,
      namespace: record.namespace,
      ports: record.ports || [
        { name: '', port: 80, protocol: 'TCP', target_port: 80 },
      ],
      selector: record.selector || {},
      type: record.type,
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
        annotations:
          Object.keys(editFormModel.value.annotations).length > 0
            ? editFormModel.value.annotations
            : undefined,
        cluster_id: currentOperationService.value.cluster_id,
        labels:
          Object.keys(editFormModel.value.labels).length > 0
            ? editFormModel.value.labels
            : undefined,
        name: currentOperationService.value.name,
        namespace: currentOperationService.value.namespace,
        ports: editFormModel.value.ports,
        selector:
          Object.keys(editFormModel.value.selector).length > 0
            ? editFormModel.value.selector
            : undefined,
        type: editFormModel.value.type,
      };

      await updateServiceApi(
        currentOperationService.value.cluster_id,
        currentOperationService.value.namespace,
        currentOperationService.value.name,
        params,
      );
      message.success('🎉 Service 更新成功');
      isEditModalVisible.value = false;
      await fetchServices();
    } catch (error: unknown) {
      if (error && typeof error === 'object' && 'errorFields' in error) {
        if (shouldNotifyPageError(error))
          message.warning('请检查表单填写是否正确');
        return;
      }
      if (shouldNotifyPageError(error)) message.error('❌ Service 更新失败');
    } finally {
      submitLoading.value = false;
    }
  };

  // 删除 Service
  const deleteService = (record: K8sService) => {
    const clusterId = validateClusterId(record);
    if (!clusterId) return;

    Modal.confirm({
      cancelText: '取消',
      centered: true,
      content: `确定要删除 Service "${record.name}" 吗？此操作不可逆！`,
      okText: '确认删除',
      okType: 'danger',
      onOk: async () => {
        try {
          await deleteServiceApi(clusterId, record.namespace, record.name);
          message.success('✅ Service 删除成功');
          await fetchServices();
        } catch (error) {
          if (shouldNotifyPageError(error))
            message.error('❌ Service 删除失败');
        }
      },
      title: '删除 Service',
    });
  };

  // 查看端点
  const showEndpointsModal = async (record: K8sService) => {
    const clusterId = validateClusterId(record);
    if (!clusterId) return;

    try {
      submitLoading.value = true;
      currentOperationService.value = { ...record, cluster_id: clusterId };
      const res = await getServiceEndpointsApi(
        clusterId,
        record.namespace,
        record.name,
      );
      serviceEndpoints.value = res || [];
      isEndpointsModalVisible.value = true;
    } catch (error) {
      if (shouldNotifyPageError(error)) message.error('获取 Service 端点失败');
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
    Reflect.deleteProperty(filterLabels.value, key);
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
    if (selectedRows.value.length === 0) return;

    Modal.confirm({
      cancelText: '取消',
      centered: true,
      content: `确定要对选中的 ${selectedRows.value.length} 个 Service 执行${operation}操作吗？`,
      okText: '确认执行',
      okType: operation === '删除' ? 'danger' : 'primary',
      onOk: async () => {
        try {
          for (const service of selectedRows.value) {
            const clusterId = service.cluster_id || filterClusterId.value;
            if (!clusterId) {
              message.error(
                `Service "${service.name}" 缺少有效的集群ID，跳过操作`,
              );
              continue;
            }

            if (operation === '删除') {
              await deleteServiceApi(
                clusterId,
                service.namespace,
                service.name,
              );
            }
          }
          message.success(`✅ 批量${operation}操作已完成`);
          selectedRowKeys.value = [];
          selectedRows.value = [];
          await fetchServices();
        } catch (error) {
          if (shouldNotifyPageError(error))
            message.error(`❌ 批量${operation}失败`);
        }
      },
      title: `批量${operation}`,
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
    if (
      target &&
      'scrollTop' in target &&
      'scrollHeight' in target &&
      'clientHeight' in target
    ) {
      const scrollTarget = target as HTMLElement;
      if (
        scrollTarget.scrollTop + scrollTarget.clientHeight >=
        scrollTarget.scrollHeight - 5
      ) {
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
    createFormModel.value.ports.push({
      name: '',
      port: 80,
      protocol: 'TCP',
      target_port: 80,
    });
  };

  const removePortField = (index: number) => {
    if (createFormModel.value.ports.length > 1) {
      createFormModel.value.ports.splice(index, 1);
    }
  };

  // 编辑表单字段操作
  const addEditPortField = () => {
    editFormModel.value.ports.push({
      name: '',
      port: 80,
      protocol: 'TCP',
      target_port: 80,
    });
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
      Reflect.deleteProperty(editFormModel.value.labels, key);
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
      Reflect.deleteProperty(editFormModel.value.selector, key);
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
      Reflect.deleteProperty(editFormModel.value.annotations, key);
    }
  };

  const addLabelField = () => {
    // 标签字段通过模态框单独管理
  };

  const removeLabelField = (key: string) => {
    Reflect.deleteProperty(createFormModel.value.labels, key);
  };

  const addAnnotationField = () => {
    // 注解字段通过模态框单独管理
  };

  const removeAnnotationField = (key: string) => {
    Reflect.deleteProperty(createFormModel.value.annotations, key);
  };

  const addSelectorField = () => {
    // 选择器字段通过模态框单独管理
  };

  const removeSelectorField = (key: string) => {
    Reflect.deleteProperty(createFormModel.value.selector, key);
  };

  return {
    // form field operations
    addAnnotationField,
    // edit form field operations
    addEditPortField,
    // filter operations
    addFilterLabel,
    addLabelField,
    addNewEditAnnotation,
    addNewEditLabel,
    addNewEditSelector,
    addPortField,
    addSelectorField,
    // batch operations
    batchOperation,
    clearFilterLabels,
    // operations
    clearNamespaces,
    clearServices,
    // create operations
    closeCreateModal,
    closeCreateYamlModal,
    // detail operations
    closeDetailModal,
    // edit operations
    closeEditModal,
    // endpoints operations
    closeEndpointsModal,
    // YAML operations
    closeYamlModal,
    // state
    clusters,
    clustersError,
    clustersLoading,
    clustersPage,
    clustersSize,
    clustersTotal,
    // form models
    createFormModel,

    // form rules
    createFormRules,
    createYamlFormModel,
    // form refs
    createYamlFormRef,
    createYamlFormRules,

    // operation targets
    currentOperationService,
    currentPage,
    currentServiceDetail,
    currentYamlContent,
    // service operations
    deleteService,
    // modal state
    detailLoading,
    editFormModel,
    editFormRef,

    editFormRules,
    fetchClusters,
    fetchNamespaces,
    fetchServices,

    filterClusterId,
    // computed
    filteredServices,
    filterLabels,
    filterNamespace,

    filterStatus,
    filterType,
    formRef,
    // helpers
    getEnvText,

    getServiceTypeColor,
    getServiceTypeText,

    getStatusColor,
    getStatusText,
    // pagination operations
    handleClusterChange,
    handleClusterDropdownScroll,
    handleFilterChange,
    handlePageChange,
    isCreateModalVisible,
    isCreateYamlModalVisible,

    isDetailModalVisible,
    isEditModalVisible,
    isEndpointsModalVisible,
    isYamlModalVisible,
    // constants
    K8sSvcStatus,
    keyValueListToRecord,
    loadError,

    loading,
    loadMoreClusters,

    loadMoreNamespaces,
    namespaces,
    namespacesError,

    namespacesLoading,
    namespacesPage,
    namespacesSize,
    namespacesTotal,
    // edit form helper variables
    newEditAnnotationKey,
    newEditLabelKey,

    newEditSelectorKey,
    onSearch,
    openCreateModal,

    openCreateYamlModal,

    openEditModal,
    pageSize,

    recordToKeyValueList,
    removeAnnotationField,
    removeEditAnnotationField,

    removeEditLabelField,

    removeEditPortField,
    removeEditSelectorField,
    removeFilterLabel,
    removeLabelField,
    removePortField,
    removeSelectorField,

    resetClusters,
    rowSelection,
    searchText,
    selectedRowKeys,
    selectedRows,
    serviceEndpoints,
    services,
    showEndpointsModal,

    showServiceDetail,
    showYamlModal,
    submitCreateForm,
    submitCreateYamlForm,
    submitEditForm,
    submitLoading,
    submitYamlForm,
    total,

    validateClusterId,
    yamlFormModel,
    yamlFormRef,

    yamlFormRules,
  };
}
