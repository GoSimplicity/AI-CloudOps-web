import { ref, computed } from 'vue';
import { message, Modal } from 'ant-design-vue';
import type { FormInstance, Rule } from 'ant-design-vue/es/form';
import {
  type K8sDeployment,
  type GetDeploymentListReq,
  type CreateDeploymentReq,
  type CreateDeploymentByYamlReq,
  type UpdateDeploymentReq,
  type UpdateDeploymentByYamlReq,
  K8sDeploymentStatus,
  getDeploymentListApi,
  getDeploymentDetailsApi,
  getDeploymentYamlApi,
  createDeploymentApi,
  createDeploymentByYamlApi,
  updateDeploymentApi,
  updateDeploymentByYamlApi,
  deleteDeploymentApi,
  restartDeploymentApi,
  scaleDeploymentApi,
  pauseDeploymentApi,
  resumeDeploymentApi,
  rollbackDeploymentApi,
  getDeploymentPodsApi,
  getDeploymentHistoryApi,
} from '#/api/core/k8s/k8s_deployment';
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

export function useDeploymentPage() {
  // state
  const deployments = ref<K8sDeployment[]>([]);
  const clusters = ref<K8sCluster[]>([]);
  const namespaces = ref<K8sNamespace[]>([]);
  const loading = ref(false);
  const clustersLoading = ref(false);
  const namespacesLoading = ref(false);
  const searchText = ref('');
  const filterStatus = ref<K8sDeploymentStatus | undefined>(undefined);
  const filterClusterId = ref<number | undefined>(undefined);
  const filterNamespace = ref<string | undefined>(undefined);
  const filterLabels = ref<Record<string, string>>({});
  const selectedRowKeys = ref<string[]>([]);
  const selectedRows = ref<K8sDeployment[]>([]);
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
  const currentOperationDeployment = ref<K8sDeployment | null>(null);
  const currentDeploymentDetail = ref<K8sDeployment | null>(null);
  const currentYamlContent = ref('');
  const deploymentPods = ref<any[]>([]);
  const deploymentHistory = ref<any[]>([]);

  // form models
  const createFormModel = ref<{
    name: string;
    namespace: string;
    replicas: number;
    images: string[];
    labels: Record<string, string>;
    annotations: Record<string, string>;
  }>({
    name: '',
    namespace: '',
    replicas: 1,
    images: [''],
    labels: {},
    annotations: {},
  });

  const editFormModel = ref<{
    name: string;
    namespace: string;
    replicas: number;
    images: string[];
    labels: Record<string, string>;
    annotations: Record<string, string>;
  }>({
    name: '',
    namespace: '',
    replicas: 1,
    images: [''],
    labels: {},
    annotations: {},
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
      { required: true, message: '请输入 Deployment 名称', trigger: 'blur' },
      { pattern: /^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/, message: 'Deployment 名称只能包含小写字母、数字和连字符，且不能以连字符开头或结尾', trigger: 'blur' },
      { max: 63, message: 'Deployment 名称长度不能超过63个字符', trigger: 'blur' }
    ],
    namespace: [
      { required: true, message: '请选择命名空间', trigger: 'change' }
    ],
    replicas: [
      { required: true, message: '请输入副本数量', trigger: 'blur' },
      { type: 'number', min: 0, max: 100, message: '副本数量必须在0-100之间', trigger: 'blur' }
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

  // computed
  const filteredDeployments = computed(() => {
    return deployments.value;
  });

  const rowSelection = computed(() => ({
    selectedRowKeys: selectedRowKeys.value,
    onChange: (keys: string[], rows: K8sDeployment[]) => {
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

  const getStatusText = (status?: K8sDeploymentStatus) => {
    const map: Record<K8sDeploymentStatus, string> = {
      [K8sDeploymentStatus.Running]: '运行中',
      [K8sDeploymentStatus.Stopped]: '已停止',
      [K8sDeploymentStatus.Paused]: '已暂停',
      [K8sDeploymentStatus.Error]: '异常',
    };
    return status !== undefined ? map[status] || '未知' : '未知';
  };

  const getStatusColor = (status?: K8sDeploymentStatus) => {
    const map: Record<K8sDeploymentStatus, string> = {
      [K8sDeploymentStatus.Running]: 'success',
      [K8sDeploymentStatus.Stopped]: 'default',
      [K8sDeploymentStatus.Paused]: 'warning',
      [K8sDeploymentStatus.Error]: 'error',
    };
    return status !== undefined ? map[status] || 'default' : 'default';
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

  // cluster operations
  const clearDeployments = () => {
    deployments.value = [];
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
          // 自动加载该集群的命名空间和Deployment数据
          await fetchNamespaces();
          await fetchDeployments();
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
  const fetchDeployments = async () => {
    if (!filterClusterId.value) {
      message.warning('请先选择集群');
      return;
    }

    try {
      loading.value = true;
      const params: GetDeploymentListReq = {
        page: currentPage.value,
        size: pageSize.value,
        search: searchText.value || undefined,
        cluster_id: filterClusterId.value,
        namespace: filterNamespace.value || undefined,
        status: filterStatus.value || undefined,
        labels: Object.keys(filterLabels.value).length > 0 ? filterLabels.value : undefined,
      };
      const res = await getDeploymentListApi(filterClusterId.value, params);
      deployments.value = res?.items || [];
      total.value = res?.total || 0;
    } catch (err) {
      message.error('获取 Deployment 列表失败');
      console.error(err);
    } finally {
      loading.value = false;
    }
  };

  // 查看详情
  const showDeploymentDetail = async (record: K8sDeployment) => {
    try {
      detailLoading.value = true;
      isDetailModalVisible.value = true;
      const res = await getDeploymentDetailsApi(record.cluster_id, record.namespace, record.name);
      currentDeploymentDetail.value = res || record;
    } catch (err) {
      message.error('获取 Deployment 详情失败');
      console.error(err);
      currentDeploymentDetail.value = record;
    } finally {
      detailLoading.value = false;
    }
  };

  const closeDetailModal = () => {
    isDetailModalVisible.value = false;
    currentDeploymentDetail.value = null;
  };

  // YAML 操作
  const showYamlModal = async (record: K8sDeployment) => {
    try {
      submitLoading.value = true;
      currentOperationDeployment.value = record;
      const res = await getDeploymentYamlApi(record.cluster_id, record.namespace, record.name);
      currentYamlContent.value = res?.yaml || '';
      yamlFormModel.value.yaml = res?.yaml || '';
      isYamlModalVisible.value = true;
    } catch (err) {
      message.error('获取 Deployment YAML 失败');
      console.error(err);
    } finally {
      submitLoading.value = false;
    }
  };

  const closeYamlModal = () => {
    isYamlModalVisible.value = false;
    currentOperationDeployment.value = null;
    currentYamlContent.value = '';
    yamlFormModel.value.yaml = '';
  };

  const submitYamlForm = async () => {
    if (!yamlFormRef.value || !currentOperationDeployment.value) return;
    
    try {
      await yamlFormRef.value.validate();
      submitLoading.value = true;
      
      const params: Omit<UpdateDeploymentByYamlReq, 'cluster_id' | 'namespace' | 'name'> = {
        yaml: yamlFormModel.value.yaml,
      };
      
      await updateDeploymentByYamlApi(
        currentOperationDeployment.value.cluster_id,
        currentOperationDeployment.value.namespace,
        currentOperationDeployment.value.name,
        params
      );
      message.success('🎉 Deployment YAML 更新成功');
      isYamlModalVisible.value = false;
      await fetchDeployments();
    } catch (err: unknown) {
      if (err && typeof err === 'object' && 'errorFields' in err) {
        message.warning('请检查 YAML 格式是否正确');
        return;
      }
      message.error('❌ Deployment YAML 更新失败');
      console.error(err);
    } finally {
      submitLoading.value = false;
    }
  };

  // 创建 Deployment
  const openCreateModal = () => {
    createFormModel.value = {
      name: '',
      namespace: '',
      replicas: 1,
      images: [''],
      labels: {},
      annotations: {},
    };
    isCreateModalVisible.value = true;
  };

  const closeCreateModal = () => {
    isCreateModalVisible.value = false;
  };

  // 通过 YAML 创建 Deployment
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
      
      const params: Omit<CreateDeploymentReq, 'cluster_id'> = {
        name: createFormModel.value.name,
        namespace: createFormModel.value.namespace,
        replicas: createFormModel.value.replicas,
        images: createFormModel.value.images.filter(img => img.trim()),
        labels: Object.keys(createFormModel.value.labels).length > 0 ? createFormModel.value.labels : undefined,
        annotations: Object.keys(createFormModel.value.annotations).length > 0 ? createFormModel.value.annotations : undefined,
        spec: {
          replicas: createFormModel.value.replicas,
        },
      };
      
      await createDeploymentApi(filterClusterId.value, params);
      message.success('🎉 Deployment 创建成功');
      isCreateModalVisible.value = false;
      await fetchDeployments();
    } catch (err: unknown) {
      if (err && typeof err === 'object' && 'errorFields' in err) {
        message.warning('请检查表单填写是否正确');
        return;
      }
      message.error('❌ Deployment 创建失败');
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
      
      const params: Omit<CreateDeploymentByYamlReq, 'cluster_id'> = {
        yaml: createYamlFormModel.value.yaml,
      };
      
      await createDeploymentByYamlApi(filterClusterId.value, params);
      message.success('🎉 Deployment YAML 创建成功');
      isCreateYamlModalVisible.value = false;
      await fetchDeployments();
    } catch (err: unknown) {
      if (err && typeof err === 'object' && 'errorFields' in err) {
        message.warning('请检查 YAML 格式是否正确');
        return;
      }
      message.error('❌ Deployment YAML 创建失败');
      console.error(err);
    } finally {
      submitLoading.value = false;
    }
  };

  // 编辑 Deployment
  const openEditModal = (record: K8sDeployment) => {
    currentOperationDeployment.value = record;
    editFormModel.value = {
      name: record.name,
      namespace: record.namespace,
      replicas: record.replicas,
      images: record.images || [''],
      labels: record.labels || {},
      annotations: record.annotations || {},
    };
    isEditModalVisible.value = true;
  };

  const closeEditModal = () => {
    isEditModalVisible.value = false;
    currentOperationDeployment.value = null;
  };

  const submitEditForm = async () => {
    if (!formRef.value || !currentOperationDeployment.value) return;
    
    try {
      await formRef.value.validate();
      submitLoading.value = true;
      
      const params: Omit<UpdateDeploymentReq, 'cluster_id' | 'namespace' | 'name'> = {
        replicas: editFormModel.value.replicas,
        images: editFormModel.value.images.filter(img => img.trim()),
        labels: Object.keys(editFormModel.value.labels).length > 0 ? editFormModel.value.labels : undefined,
        annotations: Object.keys(editFormModel.value.annotations).length > 0 ? editFormModel.value.annotations : undefined,
        spec: {
          replicas: editFormModel.value.replicas,
        },
      };
      
      await updateDeploymentApi(
        currentOperationDeployment.value.cluster_id,
        currentOperationDeployment.value.namespace,
        currentOperationDeployment.value.name,
        params
      );
      message.success('🎉 Deployment 更新成功');
      isEditModalVisible.value = false;
      await fetchDeployments();
    } catch (err: unknown) {
      if (err && typeof err === 'object' && 'errorFields' in err) {
        message.warning('请检查表单填写是否正确');
        return;
      }
      message.error('❌ Deployment 更新失败');
      console.error(err);
    } finally {
      submitLoading.value = false;
    }
  };

  // 删除 Deployment
  const deleteDeployment = (record: K8sDeployment) => {
    Modal.confirm({
      title: '删除 Deployment',
      content: `确定要删除 Deployment "${record.name}" 吗？此操作不可逆！`,
      okText: '确认删除',
      okType: 'danger',
      cancelText: '取消',
      centered: true,
      onOk: async () => {
        try {
          await deleteDeploymentApi(record.cluster_id, record.namespace, record.name);
          message.success('✅ Deployment 删除成功');
          await fetchDeployments();
        } catch (err) {
          message.error('❌ Deployment 删除失败');
          console.error(err);
        }
      },
    });
  };

  // 重启 Deployment
  const restartDeployment = (record: K8sDeployment) => {
    Modal.confirm({
      title: '重启 Deployment',
      content: `确定要重启 Deployment "${record.name}" 吗？这将重启所有 Pod。`,
      okText: '确认重启',
      okType: 'primary',
      cancelText: '取消',
      centered: true,
      onOk: async () => {
        try {
          await restartDeploymentApi(record.cluster_id, record.namespace, record.name);
          message.success('✅ Deployment 重启成功');
          await fetchDeployments();
        } catch (err) {
          message.error('❌ Deployment 重启失败');
          console.error(err);
        }
      },
    });
  };

  // 伸缩 Deployment
  const openScaleModal = (record: K8sDeployment) => {
    currentOperationDeployment.value = record;
    scaleFormModel.value.replicas = record.replicas;
    isScaleModalVisible.value = true;
  };

  const closeScaleModal = () => {
    isScaleModalVisible.value = false;
    currentOperationDeployment.value = null;
  };

  const submitScaleForm = async () => {
    if (!scaleFormRef.value || !currentOperationDeployment.value) return;
    
    try {
      await scaleFormRef.value.validate();
      submitLoading.value = true;
      
      const params = {
        replicas: scaleFormModel.value.replicas,
      };
      
      await scaleDeploymentApi(
        currentOperationDeployment.value.cluster_id,
        currentOperationDeployment.value.namespace,
        currentOperationDeployment.value.name,
        params
      );
      message.success('🎉 Deployment 伸缩成功');
      isScaleModalVisible.value = false;
      await fetchDeployments();
    } catch (err: unknown) {
      if (err && typeof err === 'object' && 'errorFields' in err) {
        message.warning('请检查表单填写是否正确');
        return;
      }
      message.error('❌ Deployment 伸缩失败');
      console.error(err);
    } finally {
      submitLoading.value = false;
    }
  };

  // 暂停/恢复 Deployment
  const pauseDeployment = (record: K8sDeployment) => {
    Modal.confirm({
      title: '暂停 Deployment',
      content: `确定要暂停 Deployment "${record.name}" 吗？`,
      okText: '确认暂停',
      okType: 'primary',
      cancelText: '取消',
      centered: true,
      onOk: async () => {
        try {
          await pauseDeploymentApi(record.cluster_id, record.namespace, record.name);
          message.success('✅ Deployment 暂停成功');
          await fetchDeployments();
        } catch (err) {
          message.error('❌ Deployment 暂停失败');
          console.error(err);
        }
      },
    });
  };

  const resumeDeployment = (record: K8sDeployment) => {
    Modal.confirm({
      title: '恢复 Deployment',
      content: `确定要恢复 Deployment "${record.name}" 吗？`,
      okText: '确认恢复',
      okType: 'primary',
      cancelText: '取消',
      centered: true,
      onOk: async () => {
        try {
          await resumeDeploymentApi(record.cluster_id, record.namespace, record.name);
          message.success('✅ Deployment 恢复成功');
          await fetchDeployments();
        } catch (err) {
          message.error('❌ Deployment 恢复失败');
          console.error(err);
        }
      },
    });
  };

  // 回滚 Deployment
  const openRollbackModal = (record: K8sDeployment) => {
    currentOperationDeployment.value = record;
    rollbackFormModel.value.revision = 1;
    isRollbackModalVisible.value = true;
  };

  const closeRollbackModal = () => {
    isRollbackModalVisible.value = false;
    currentOperationDeployment.value = null;
  };

  const submitRollbackForm = async () => {
    if (!rollbackFormRef.value || !currentOperationDeployment.value) return;
    
    try {
      await rollbackFormRef.value.validate();
      submitLoading.value = true;
      
      const params = {
        revision: rollbackFormModel.value.revision,
      };
      
      await rollbackDeploymentApi(
        currentOperationDeployment.value.cluster_id,
        currentOperationDeployment.value.namespace,
        currentOperationDeployment.value.name,
        params
      );
      message.success('🎉 Deployment 回滚成功');
      isRollbackModalVisible.value = false;
      await fetchDeployments();
    } catch (err: unknown) {
      if (err && typeof err === 'object' && 'errorFields' in err) {
        message.warning('请检查表单填写是否正确');
        return;
      }
      message.error('❌ Deployment 回滚失败');
      console.error(err);
    } finally {
      submitLoading.value = false;
    }
  };

  // 查看 Pod 列表
  const showPodModal = async (record: K8sDeployment) => {
    try {
      submitLoading.value = true;
      currentOperationDeployment.value = record;
      const res = await getDeploymentPodsApi(record.cluster_id, record.namespace, record.name);
      deploymentPods.value = res?.items || [];
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
    currentOperationDeployment.value = null;
    deploymentPods.value = [];
  };

  // 查看版本历史
  const showHistoryModal = async (record: K8sDeployment) => {
    try {
      submitLoading.value = true;
      currentOperationDeployment.value = record;
      const res = await getDeploymentHistoryApi(record.cluster_id, record.namespace, record.name);
      deploymentHistory.value = res?.items || [];
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
    currentOperationDeployment.value = null;
    deploymentHistory.value = [];
  };

  // 标签过滤管理
  const addFilterLabel = (key: string, value: string) => {
    if (key && key.trim()) {
      filterLabels.value[key.trim()] = value;
      currentPage.value = 1;
      fetchDeployments();
    }
  };

  const removeFilterLabel = (key: string) => {
    delete filterLabels.value[key];
    currentPage.value = 1;
    fetchDeployments();
  };

  const clearFilterLabels = () => {
    filterLabels.value = {};
    currentPage.value = 1;
    fetchDeployments();
  };

  // 批量操作
  const batchOperation = (operation: string) => {
    if (!selectedRows.value.length) return;
    
    Modal.confirm({
      title: `批量${operation}`,
      content: `确定要对选中的 ${selectedRows.value.length} 个 Deployment 执行${operation}操作吗？`,
      okText: '确认执行',
      okType: operation === '删除' ? 'danger' : 'primary',
      cancelText: '取消',
      centered: true,
      onOk: async () => {
        try {
          for (const deployment of selectedRows.value) {
            if (operation === '删除') {
              await deleteDeploymentApi(deployment.cluster_id, deployment.namespace, deployment.name);
            } else if (operation === '重启') {
              await restartDeploymentApi(deployment.cluster_id, deployment.namespace, deployment.name);
            }
          }
          message.success(`✅ 批量${operation}操作已完成`);
          selectedRowKeys.value = [];
          selectedRows.value = [];
          await fetchDeployments();
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
    await fetchDeployments();
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

  return {
    // state
    deployments,
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
    currentOperationDeployment,
    currentDeploymentDetail,
    currentYamlContent,
    deploymentPods,
    deploymentHistory,
    
    // form models
    createFormModel,
    editFormModel,
    scaleFormModel,
    rollbackFormModel,
    yamlFormModel,
    createYamlFormModel,
    
    // form rules
    createFormRules,
    scaleFormRules,
    rollbackFormRules,
    yamlFormRules,
    createYamlFormRules,
    
    // computed
    filteredDeployments,
    rowSelection,
    
    // helpers
    getEnvText,
    getStatusText,
    getStatusColor,
    recordToKeyValueList,
    keyValueListToRecord,
    
    // operations
    fetchClusters,
    fetchNamespaces,
    fetchDeployments,
    clearDeployments,
    clearNamespaces,
    loadMoreClusters,
    loadMoreNamespaces,
    
    // detail operations
    showDeploymentDetail,
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
    
    // deployment operations
    deleteDeployment,
    restartDeployment,
    pauseDeployment,
    resumeDeployment,
    
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
    addLabelField,
    removeLabelField,
    addAnnotationField,
    removeAnnotationField,
    
    // constants
    K8sDeploymentStatus,
  };
}
