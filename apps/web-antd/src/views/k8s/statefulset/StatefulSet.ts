import { ref, computed } from 'vue';
import { message, Modal } from 'ant-design-vue';
import type { FormInstance, Rule } from 'ant-design-vue/es/form';
import {
  type K8sStatefulSet,
  type K8sStatefulSetHistory,
  type GetStatefulSetListReq,
  type CreateStatefulSetReq,
  type CreateStatefulSetByYamlReq,
  type UpdateStatefulSetReq,
  type UpdateStatefulSetByYamlReq,
  type ScaleStatefulSetReq,
  type RestartStatefulSetReq,
  type RollbackStatefulSetReq,
  K8sStatefulSetStatus,
  getStatefulSetListApi,
  getStatefulSetDetailsApi,
  getStatefulSetYamlApi,
  createStatefulSetApi,
  createStatefulSetByYamlApi,
  updateStatefulSetApi,
  updateStatefulSetByYamlApi,
  deleteStatefulSetApi,
  restartStatefulSetApi,
  scaleStatefulSetApi,
  rollbackStatefulSetApi,
  getStatefulSetPodsApi,
  getStatefulSetHistoryApi,
} from '#/api/core/k8s/k8s_statefulset';
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

export function useStatefulSetPage() {
  // state
  const statefulSets = ref<K8sStatefulSet[]>([]);
  const clusters = ref<K8sCluster[]>([]);
  const namespaces = ref<K8sNamespace[]>([]);
  const loading = ref(false);
  const clustersLoading = ref(false);
  const namespacesLoading = ref(false);
  const searchText = ref('');
  const filterStatus = ref<K8sStatefulSetStatus | undefined>(undefined);
  const filterClusterId = ref<number | undefined>(undefined);
  const filterNamespace = ref<string | undefined>(undefined);
  const filterServiceName = ref<string | undefined>(undefined);
  const filterLabels = ref<Record<string, string>>({});
  const selectedRowKeys = ref<string[]>([]);
  const selectedRows = ref<K8sStatefulSet[]>([]);
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
  const scaleFormRef = ref<FormInstance>();
  const rollbackFormRef = ref<FormInstance>();
  const yamlFormRef = ref<FormInstance>();
  const createYamlFormRef = ref<FormInstance>();

  // modal/form state
  const isCreateModalVisible = ref(false);
  const isCreateYamlModalVisible = ref(false);
  const isEditModalVisible = ref(false);
  const isDetailModalVisible = ref(false);
  const isScaleModalVisible = ref(false);
  const isRollbackModalVisible = ref(false);
  const isYamlModalVisible = ref(false);
  const isPodModalVisible = ref(false);
  const isHistoryModalVisible = ref(false);
  const submitLoading = ref(false);
  const detailLoading = ref(false);

  // current operation target
  const currentOperationStatefulSet = ref<K8sStatefulSet | null>(null);
  const currentStatefulSetDetail = ref<K8sStatefulSet | null>(null);
  const currentYamlContent = ref('');
  const statefulSetPods = ref<any[]>([]);
  const statefulSetHistory = ref<K8sStatefulSetHistory[]>([]);

  // form models
  const createFormModel = ref<{
    name: string;
    namespace: string;
    replicas: number;
    service_name: string;
    images: string[];
    labels: Record<string, string>;
    annotations: Record<string, string>;
  }>({
    name: '',
    namespace: '',
    replicas: 1,
    service_name: '',
    images: [''],
    labels: {},
    annotations: {},
  });

  const editFormModel = ref<{
    name: string;
    namespace: string;
    replicas: number;
    service_name: string;
    images: string[];
    labels: KeyValueList;
    annotations: KeyValueList;
  }>({
    name: '',
    namespace: '',
    replicas: 1,
    service_name: '',
    images: [''],
    labels: [],
    annotations: [],
  });

  const scaleFormModel = ref<{
    replicas: number;
  }>({
    replicas: 1,
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
      { required: true, message: '请输入 StatefulSet 名称', trigger: 'blur' },
      { pattern: /^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/, message: 'StatefulSet 名称只能包含小写字母、数字和连字符，且不能以连字符开头或结尾', trigger: 'blur' },
      { max: 63, message: 'StatefulSet 名称长度不能超过63个字符', trigger: 'blur' }
    ],
    namespace: [
      { required: true, message: '请选择命名空间', trigger: 'change' }
    ],
    replicas: [
      { required: true, message: '请输入副本数量', trigger: 'blur' },
      { type: 'number', min: 0, max: 100, message: '副本数量必须在0-100之间', trigger: 'blur' }
    ],
    service_name: [
      { required: true, message: '请输入服务名称', trigger: 'blur' },
      { pattern: /^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/, message: '服务名称只能包含小写字母、数字和连字符，且不能以连字符开头或结尾', trigger: 'blur' }
    ]
  };

  const scaleFormRules: Record<string, Rule[]> = {
    replicas: [
      { required: true, message: '请输入副本数量', trigger: 'blur' },
      { type: 'number', min: 0, max: 100, message: '副本数量必须在0-100之间', trigger: 'blur' }
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

  const editFormRules: Record<string, Rule[]> = {
    name: [
      { required: true, message: '请输入 StatefulSet 名称', trigger: 'blur' },
      { pattern: /^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/, message: 'StatefulSet 名称只能包含小写字母、数字和连字符，且不能以连字符开头或结尾', trigger: 'blur' },
      { max: 63, message: 'StatefulSet 名称长度不能超过63个字符', trigger: 'blur' }
    ],
    namespace: [
      { required: true, message: '请选择命名空间', trigger: 'change' }
    ],
    replicas: [
      { required: true, message: '请输入副本数量', trigger: 'blur' },
      { type: 'number', min: 0, max: 100, message: '副本数量必须在0-100之间', trigger: 'blur' }
    ]
  };

  // computed
  const filteredStatefulSets = computed(() => {
    return statefulSets.value;
  });

  const rowSelection = computed(() => ({
    selectedRowKeys: selectedRowKeys.value,
    onChange: (keys: string[], rows: K8sStatefulSet[]) => {
      selectedRowKeys.value = keys;
      selectedRows.value = rows;
    },
  }));

  // helpers
  const validateClusterId = (record: K8sStatefulSet): number | null => {
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

  const getStatusText = (status?: K8sStatefulSetStatus) => {
    const map: Record<K8sStatefulSetStatus, string> = {
      [K8sStatefulSetStatus.Running]: '运行中',
      [K8sStatefulSetStatus.Stopped]: '已停止',
      [K8sStatefulSetStatus.Updating]: '更新中',
      [K8sStatefulSetStatus.Error]: '异常',
    };
    return status !== undefined ? map[status] || '未知' : '未知';
  };

  const getStatusColor = (status?: K8sStatefulSetStatus) => {
    const map: Record<K8sStatefulSetStatus, string> = {
      [K8sStatefulSetStatus.Running]: 'success',
      [K8sStatefulSetStatus.Stopped]: 'default',
      [K8sStatefulSetStatus.Updating]: 'processing',
      [K8sStatefulSetStatus.Error]: 'error',
    };
    return status !== undefined ? map[status] || 'default' : 'default';
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
  const clearStatefulSets = () => {
    statefulSets.value = [];
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
          // 自动加载该集群的命名空间和StatefulSet数据
          await fetchNamespaces();
          await fetchStatefulSets();
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
  const fetchStatefulSets = async () => {
    if (!filterClusterId.value || filterClusterId.value === 0) {
      message.warning('请先选择有效的集群');
      statefulSets.value = [];
      total.value = 0;
      return;
    }

    try {
      loading.value = true;
      const params: GetStatefulSetListReq = {
        page: currentPage.value,
        size: pageSize.value,
        search: searchText.value || undefined,
        cluster_id: filterClusterId.value,
        namespace: filterNamespace.value || undefined,
        status: filterStatus.value?.toString() || undefined,
        service_name: filterServiceName.value || undefined,
        labels: Object.keys(filterLabels.value).length > 0 ? recordToKeyValueList(filterLabels.value) : undefined,
      };
      const res = await getStatefulSetListApi(filterClusterId.value, params);
      // 确保每个statefulSet对象都有正确的cluster_id
      const statefulSetsWithClusterId = (res?.items || []).map((statefulSet: K8sStatefulSet) => ({
        ...statefulSet,
        cluster_id: statefulSet.cluster_id || filterClusterId.value || 0
      }));
      statefulSets.value = statefulSetsWithClusterId;
      total.value = res?.total || 0;
    } catch (err) {
      message.error('获取 StatefulSet 列表失败');
      console.error(err);
    } finally {
      loading.value = false;
    }
  };

  // 查看详情
  const showStatefulSetDetail = async (record: K8sStatefulSet) => {
    const clusterId = validateClusterId(record);
    if (!clusterId) return;
    
    try {
      detailLoading.value = true;
      isDetailModalVisible.value = true;
      const res = await getStatefulSetDetailsApi(clusterId, record.namespace, record.name);
      
      // 处理详情数据
      const processedDetail = res ? {
        ...res,
        cluster_id: clusterId,
        labels: res.labels,
        annotations: res.annotations
      } : { 
        ...record, 
        cluster_id: clusterId,
        labels: record.labels,
        annotations: record.annotations
      };
      
      currentStatefulSetDetail.value = processedDetail;
    } catch (err) {
      message.error('获取 StatefulSet 详情失败');
      console.error(err);
      // 错误时也要处理格式转换
      const fallbackDetail = { 
        ...record, 
        cluster_id: clusterId,
        labels: record.labels,
        annotations: record.annotations
      };
      currentStatefulSetDetail.value = fallbackDetail;
    } finally {
      detailLoading.value = false;
    }
  };

  const closeDetailModal = () => {
    isDetailModalVisible.value = false;
    currentStatefulSetDetail.value = null;
  };

  // YAML 操作
  const showYamlModal = async (record: K8sStatefulSet) => {
    const clusterId = validateClusterId(record);
    if (!clusterId) return;
    
    try {
      submitLoading.value = true;
      currentOperationStatefulSet.value = { ...record, cluster_id: clusterId };
      const res = await getStatefulSetYamlApi(clusterId, record.namespace, record.name);
      currentYamlContent.value = res?.yaml || '';
      yamlFormModel.value.yaml = res?.yaml || '';
      isYamlModalVisible.value = true;
    } catch (err) {
      message.error('获取 StatefulSet YAML 失败');
      console.error(err);
    } finally {
      submitLoading.value = false;
    }
  };

  const closeYamlModal = () => {
    isYamlModalVisible.value = false;
    currentOperationStatefulSet.value = null;
    currentYamlContent.value = '';
    yamlFormModel.value.yaml = '';
  };

  const submitYamlForm = async () => {
    if (!yamlFormRef.value || !currentOperationStatefulSet.value) return;
    
    try {
      await yamlFormRef.value.validate();
      submitLoading.value = true;
      
      const params: UpdateStatefulSetByYamlReq = {
        cluster_id: currentOperationStatefulSet.value.cluster_id,
        namespace: currentOperationStatefulSet.value.namespace,
        name: currentOperationStatefulSet.value.name,
        yaml: yamlFormModel.value.yaml,
      };
      
      await updateStatefulSetByYamlApi(
        currentOperationStatefulSet.value.cluster_id,
        currentOperationStatefulSet.value.namespace,
        currentOperationStatefulSet.value.name,
        params
      );
      message.success('🎉 StatefulSet YAML 更新成功');
      isYamlModalVisible.value = false;
      await fetchStatefulSets();
    } catch (err: unknown) {
      if (err && typeof err === 'object' && 'errorFields' in err) {
        message.warning('请检查 YAML 格式是否正确');
        return;
      }
      message.error('❌ StatefulSet YAML 更新失败');
      console.error(err);
    } finally {
      submitLoading.value = false;
    }
  };

  // 创建 StatefulSet
  const openCreateModal = () => {
    createFormModel.value = {
      name: '',
      namespace: '',
      replicas: 1,
      service_name: '',
      images: [''],
      labels: {},
      annotations: {},
    };
    isCreateModalVisible.value = true;
  };

  const closeCreateModal = () => {
    isCreateModalVisible.value = false;
  };

  // 通过 YAML 创建 StatefulSet
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
      
      const params: CreateStatefulSetReq = {
        cluster_id: filterClusterId.value,
        name: createFormModel.value.name,
        namespace: createFormModel.value.namespace,
        replicas: createFormModel.value.replicas,
        service_name: createFormModel.value.service_name,
        images: createFormModel.value.images.filter(img => img.trim()),
        labels: Object.keys(createFormModel.value.labels).length > 0 ? recordToKeyValueList(createFormModel.value.labels) : undefined,
        annotations: Object.keys(createFormModel.value.annotations).length > 0 ? recordToKeyValueList(createFormModel.value.annotations) : undefined,
        spec: {
          replicas: createFormModel.value.replicas,
          service_name: createFormModel.value.service_name,
        },
      };
      
      await createStatefulSetApi(filterClusterId.value, params);
      message.success('🎉 StatefulSet 创建成功');
      isCreateModalVisible.value = false;
      await fetchStatefulSets();
    } catch (err: unknown) {
      if (err && typeof err === 'object' && 'errorFields' in err) {
        message.warning('请检查表单填写是否正确');
        return;
      }
      message.error('❌ StatefulSet 创建失败');
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
      
      const params: CreateStatefulSetByYamlReq = {
        cluster_id: filterClusterId.value,
        yaml: createYamlFormModel.value.yaml,
      };
      
      await createStatefulSetByYamlApi(filterClusterId.value, params);
      message.success('🎉 StatefulSet YAML 创建成功');
      isCreateYamlModalVisible.value = false;
      await fetchStatefulSets();
    } catch (err: unknown) {
      if (err && typeof err === 'object' && 'errorFields' in err) {
        message.warning('请检查 YAML 格式是否正确');
        return;
      }
      message.error('❌ StatefulSet YAML 创建失败');
      console.error(err);
    } finally {
      submitLoading.value = false;
    }
  };

  // 删除 StatefulSet
  const deleteStatefulSet = (record: K8sStatefulSet) => {
    const clusterId = validateClusterId(record);
    if (!clusterId) return;
    
    Modal.confirm({
      title: '删除 StatefulSet',
      content: `确定要删除 StatefulSet "${record.name}" 吗？此操作不可逆！`,
      okText: '确认删除',
      okType: 'danger',
      cancelText: '取消',
      centered: true,
      onOk: async () => {
        try {
          await deleteStatefulSetApi(clusterId, record.namespace, record.name);
          message.success('✅ StatefulSet 删除成功');
          await fetchStatefulSets();
        } catch (err) {
          message.error('❌ StatefulSet 删除失败');
          console.error(err);
        }
      },
    });
  };

  // 重启 StatefulSet
  const restartStatefulSet = (record: K8sStatefulSet) => {
    const clusterId = validateClusterId(record);
    if (!clusterId) return;
    
    Modal.confirm({
      title: '重启 StatefulSet',
      content: `确定要重启 StatefulSet "${record.name}" 吗？这将重启所有 Pod。`,
      okText: '确认重启',
      okType: 'primary',
      cancelText: '取消',
      centered: true,
      onOk: async () => {
        try {
          const params: RestartStatefulSetReq = {
            cluster_id: clusterId,
            namespace: record.namespace,
            name: record.name,
          };
          await restartStatefulSetApi(clusterId, record.namespace, record.name, params);
          message.success('✅ StatefulSet 重启成功');
          await fetchStatefulSets();
        } catch (err) {
          message.error('❌ StatefulSet 重启失败');
          console.error(err);
        }
      },
    });
  };

  // 编辑 StatefulSet
  const openEditModal = (record: K8sStatefulSet) => {
    const clusterId = validateClusterId(record);
    if (!clusterId) return;
    
    currentOperationStatefulSet.value = { ...record, cluster_id: clusterId };
    
    // 填充编辑表单数据
    editFormModel.value = {
      name: record.name,
      namespace: record.namespace,
      replicas: record.replicas,
      service_name: record.service_name || '',
      images: record.images || [],
      labels: recordToKeyValueList(keyValueListToRecord(record.labels)),
      annotations: recordToKeyValueList(keyValueListToRecord(record.annotations)),
    };
    
    isEditModalVisible.value = true;
  };

  const closeEditModal = () => {
    isEditModalVisible.value = false;
    currentOperationStatefulSet.value = null;
    editFormModel.value = {
      name: '',
      namespace: '',
      replicas: 1,
      service_name: '',
      images: [''],
      labels: [],
      annotations: [],
    };
  };

  const submitEditForm = async () => {
    if (!editFormRef.value || !currentOperationStatefulSet.value) return;
    
    try {
      await editFormRef.value.validate();
      submitLoading.value = true;
      
      const params: UpdateStatefulSetReq = {
        cluster_id: currentOperationStatefulSet.value.cluster_id,
        name: editFormModel.value.name,
        namespace: editFormModel.value.namespace,
        replicas: editFormModel.value.replicas,
        images: editFormModel.value.images.filter(img => img.trim()),
        labels: editFormModel.value.labels.length > 0 ? keyValueListToRecord(editFormModel.value.labels) : undefined,
        annotations: editFormModel.value.annotations.length > 0 ? keyValueListToRecord(editFormModel.value.annotations) : undefined,
      };
      
      await updateStatefulSetApi(
        currentOperationStatefulSet.value.cluster_id,
        currentOperationStatefulSet.value.namespace,
        currentOperationStatefulSet.value.name,
        params
      );
      message.success('🎉 StatefulSet 更新成功');
      isEditModalVisible.value = false;
      await fetchStatefulSets();
    } catch (err: unknown) {
      if (err && typeof err === 'object' && 'errorFields' in err) {
        message.warning('请检查表单填写是否正确');
        return;
      }
      message.error('❌ StatefulSet 更新失败');
      console.error(err);
    } finally {
      submitLoading.value = false;
    }
  };

  // 伸缩 StatefulSet
  const openScaleModal = (record: K8sStatefulSet) => {
    const clusterId = validateClusterId(record);
    if (!clusterId) return;
    
    currentOperationStatefulSet.value = { ...record, cluster_id: clusterId };
    scaleFormModel.value.replicas = record.replicas;
    isScaleModalVisible.value = true;
  };

  const closeScaleModal = () => {
    isScaleModalVisible.value = false;
    currentOperationStatefulSet.value = null;
  };

  const submitScaleForm = async () => {
    if (!scaleFormRef.value || !currentOperationStatefulSet.value) return;
    
    try {
      await scaleFormRef.value.validate();
      submitLoading.value = true;
      
      const params: ScaleStatefulSetReq = {
        cluster_id: currentOperationStatefulSet.value.cluster_id,
        namespace: currentOperationStatefulSet.value.namespace,
        name: currentOperationStatefulSet.value.name,
        replicas: scaleFormModel.value.replicas,
      };
      
      await scaleStatefulSetApi(
        currentOperationStatefulSet.value.cluster_id,
        currentOperationStatefulSet.value.namespace,
        currentOperationStatefulSet.value.name,
        params
      );
      message.success('🎉 StatefulSet 伸缩成功');
      isScaleModalVisible.value = false;
      await fetchStatefulSets();
    } catch (err: unknown) {
      if (err && typeof err === 'object' && 'errorFields' in err) {
        message.warning('请检查表单填写是否正确');
        return;
      }
      message.error('❌ StatefulSet 伸缩失败');
      console.error(err);
    } finally {
      submitLoading.value = false;
    }
  };

  // 回滚 StatefulSet
  const openRollbackModal = (record: K8sStatefulSet) => {
    const clusterId = validateClusterId(record);
    if (!clusterId) return;
    
    currentOperationStatefulSet.value = { ...record, cluster_id: clusterId };
    rollbackFormModel.value.revision = 1;
    isRollbackModalVisible.value = true;
  };

  const closeRollbackModal = () => {
    isRollbackModalVisible.value = false;
    currentOperationStatefulSet.value = null;
  };

  const submitRollbackForm = async () => {
    if (!rollbackFormRef.value || !currentOperationStatefulSet.value) return;
    
    try {
      await rollbackFormRef.value.validate();
      submitLoading.value = true;
      
      const params: RollbackStatefulSetReq = {
        cluster_id: currentOperationStatefulSet.value.cluster_id,
        namespace: currentOperationStatefulSet.value.namespace,
        name: currentOperationStatefulSet.value.name,
        revision: rollbackFormModel.value.revision,
      };
      
      await rollbackStatefulSetApi(
        currentOperationStatefulSet.value.cluster_id,
        currentOperationStatefulSet.value.namespace,
        currentOperationStatefulSet.value.name,
        params
      );
      message.success('🎉 StatefulSet 回滚成功');
      isRollbackModalVisible.value = false;
      await fetchStatefulSets();
    } catch (err: unknown) {
      if (err && typeof err === 'object' && 'errorFields' in err) {
        message.warning('请检查表单填写是否正确');
        return;
      }
      message.error('❌ StatefulSet 回滚失败');
      console.error(err);
    } finally {
      submitLoading.value = false;
    }
  };

  // 查看 Pod 列表
  const showPodModal = async (record: K8sStatefulSet) => {
    const clusterId = validateClusterId(record);
    if (!clusterId) return;
    
    try {
      submitLoading.value = true;
      currentOperationStatefulSet.value = { ...record, cluster_id: clusterId };
      const res = await getStatefulSetPodsApi(clusterId, record.namespace, record.name);
      statefulSetPods.value = res?.items || [];
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
    currentOperationStatefulSet.value = null;
    statefulSetPods.value = [];
  };

  // 查看版本历史
  const showHistoryModal = async (record: K8sStatefulSet) => {
    const clusterId = validateClusterId(record);
    if (!clusterId) return;
    
    try {
      submitLoading.value = true;
      currentOperationStatefulSet.value = { ...record, cluster_id: clusterId };
      const res = await getStatefulSetHistoryApi(clusterId, record.namespace, record.name);
      statefulSetHistory.value = res?.items || [];
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
    currentOperationStatefulSet.value = null;
    statefulSetHistory.value = [];
  };

  // 标签过滤管理
  const addFilterLabel = (key: string, value: string) => {
    if (key && key.trim()) {
      filterLabels.value[key.trim()] = value;
      currentPage.value = 1;
      fetchStatefulSets();
    }
  };

  const removeFilterLabel = (key: string) => {
    delete filterLabels.value[key];
    currentPage.value = 1;
    fetchStatefulSets();
  };

  const clearFilterLabels = () => {
    filterLabels.value = {};
    currentPage.value = 1;
    fetchStatefulSets();
  };

  // 批量操作
  const batchOperation = (operation: string) => {
    if (!selectedRows.value.length) return;
    
    Modal.confirm({
      title: `批量${operation}`,
      content: `确定要对选中的 ${selectedRows.value.length} 个 StatefulSet 执行${operation}操作吗？`,
      okText: '确认执行',
      okType: operation === '删除' ? 'danger' : 'primary',
      cancelText: '取消',
      centered: true,
      onOk: async () => {
        try {
          for (const statefulSet of selectedRows.value) {
            const clusterId = statefulSet.cluster_id || filterClusterId.value;
            if (!clusterId) {
              message.error(`StatefulSet "${statefulSet.name}" 缺少有效的集群ID，跳过操作`);
              continue;
            }
            
            if (operation === '删除') {
              await deleteStatefulSetApi(clusterId, statefulSet.namespace, statefulSet.name);
            } else if (operation === '重启') {
              const params: RestartStatefulSetReq = {
                cluster_id: clusterId,
                namespace: statefulSet.namespace,
                name: statefulSet.name,
              };
              await restartStatefulSetApi(clusterId, statefulSet.namespace, statefulSet.name, params);
            }
          }
          message.success(`✅ 批量${operation}操作已完成`);
          selectedRowKeys.value = [];
          selectedRows.value = [];
          await fetchStatefulSets();
        } catch (err) {
          message.error(`❌ 批量${operation}失败`);
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
    await fetchStatefulSets();
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

  const addEditImageField = () => {
    editFormModel.value.images.push('');
  };

  const removeEditImageField = (index: number) => {
    if (editFormModel.value.images.length > 1) {
      editFormModel.value.images.splice(index, 1);
    }
  };

  const removeLabelField = (key: string) => {
    delete createFormModel.value.labels[key];
  };

  const removeAnnotationField = (key: string) => {
    delete createFormModel.value.annotations[key];
  };

  const removeEditLabelField = (key: string) => {
    editFormModel.value.labels = editFormModel.value.labels.filter(item => item.key !== key);
  };

  const removeEditAnnotationField = (key: string) => {
    editFormModel.value.annotations = editFormModel.value.annotations.filter(item => item.key !== key);
  };

  return {
    // state
    statefulSets,
    clusters,
    namespaces,
    loading,
    clustersLoading,
    namespacesLoading,
    searchText,
    filterStatus,
    filterClusterId,
    filterNamespace,
    filterServiceName,
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
    scaleFormRef,
    rollbackFormRef,
    yamlFormRef,
    createYamlFormRef,
    
    // modal state
    isCreateModalVisible,
    isCreateYamlModalVisible,
    isEditModalVisible,
    isDetailModalVisible,
    isScaleModalVisible,
    isRollbackModalVisible,
    isYamlModalVisible,
    isPodModalVisible,
    isHistoryModalVisible,
    submitLoading,
    detailLoading,
    
    // operation targets
    currentOperationStatefulSet,
    currentStatefulSetDetail,
    currentYamlContent,
    statefulSetPods,
    statefulSetHistory,
    
    // form models
    createFormModel,
    editFormModel,
    scaleFormModel,
    rollbackFormModel,
    yamlFormModel,
    createYamlFormModel,
    
    // form rules
    createFormRules,
    editFormRules,
    scaleFormRules,
    rollbackFormRules,
    yamlFormRules,
    createYamlFormRules,
    
    // computed
    filteredStatefulSets,
    rowSelection,
    
    // helpers
    validateClusterId,
    getEnvText,
    getStatusText,
    getStatusColor,
    recordToKeyValueList,
    keyValueListToRecord,
    
    // operations
    fetchClusters,
    fetchNamespaces,
    fetchStatefulSets,
    clearStatefulSets,
    clearNamespaces,
    loadMoreClusters,
    loadMoreNamespaces,
    
    // detail operations
    showStatefulSetDetail,
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
    
    // statefulSet operations
    deleteStatefulSet,
    restartStatefulSet,
    
    // scale operations
    openScaleModal,
    closeScaleModal,
    submitScaleForm,
    
    // rollback operations
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
    addEditImageField,
    removeEditImageField,
    removeLabelField,
    removeAnnotationField,
    removeEditLabelField,
    removeEditAnnotationField,
    
    // constants
    K8sStatefulSetStatus,
  };
}
