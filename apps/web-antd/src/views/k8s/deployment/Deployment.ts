import type { FormInstance, Rule } from 'ant-design-vue/es/form';

import { computed, h, ref } from 'vue';

import { message, Modal } from 'ant-design-vue';
import yaml from 'js-yaml';

import {
  Env,
  getClustersListApi,
  type K8sCluster,
  type KeyValueList,
  type ListClustersReq,
} from '#/api/core/k8s/k8s_cluster';
import {
  createDeploymentApi,
  createDeploymentByYamlApi,
  type CreateDeploymentByYamlReq,
  type CreateDeploymentReq,
  deleteDeploymentApi,
  getDeploymentDetailsApi,
  getDeploymentHistoryApi,
  getDeploymentListApi,
  type GetDeploymentListReq,
  getDeploymentPodsApi,
  getDeploymentYamlApi,
  type K8sDeployment,
  K8sDeploymentStatus,
  pauseDeploymentApi,
  restartDeploymentApi,
  resumeDeploymentApi,
  scaleDeploymentApi,
  updateDeploymentApi,
  updateDeploymentByYamlApi,
  type UpdateDeploymentByYamlReq,
  type UpdateDeploymentReq,
} from '#/api/core/k8s/k8s_deployment';
import {
  getNamespacesListApi,
  type K8sNamespace,
  type K8sNamespaceListReq,
} from '#/api/core/k8s/k8s_namespace';
import {
  shouldNotifyPageError,
  shouldRecordPageError,
} from '#/utils/permission/request-notice';

import { useWorkloadHistoryScope } from '../shared/use-workload-rollback-scope';

// YAML 模板常量
const DEPLOYMENT_YAML_TEMPLATE = `apiVersion: apps/v1
kind: Deployment
metadata:
  name: my-deployment
  labels:
    app: my-app
spec:
  replicas: 1
  selector:
    matchLabels:
      app: my-app
  template:
    metadata:
      labels:
        app: my-app
    spec:
      containers:
      - name: nginx
        image: nginx:latest
        ports:
        - containerPort: 80
        resources:
          limits:
            cpu: "500m"
            memory: "512Mi"
          requests:
            cpu: "250m"
            memory: "256Mi"`;

export function useDeploymentPage() {
  // state
  const deployments = ref<K8sDeployment[]>([]);
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
  const editFormRef = ref<FormInstance>();
  const scaleFormRef = ref<FormInstance>();
  const yamlFormRef = ref<FormInstance>();
  const createYamlFormRef = ref<FormInstance>();

  // modal/form state
  const isCreateModalVisible = ref(false);
  const isCreateYamlModalVisible = ref(false);
  const isEditModalVisible = ref(false);
  const isDetailModalVisible = ref(false);
  const isScaleModalVisible = ref(false);
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
    annotations: Record<string, string>;
    images: string[];
    labels: Record<string, string>;
    name: string;
    namespace: string;
    replicas: number;
  }>({
    annotations: {},
    images: [''],
    labels: {},
    name: '',
    namespace: '',
    replicas: 1,
  });

  const editFormModel = ref<{
    annotations: Record<string, string>;
    images: string[];
    labels: Record<string, string>;
    name: string;
    namespace: string;
    replicas: number;
  }>({
    annotations: {},
    images: [''],
    labels: {},
    name: '',
    namespace: '',
    replicas: 1,
  });

  const scaleFormModel = ref<{
    replicas: number;
  }>({
    replicas: 1,
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
      { message: '请输入 Deployment 名称', required: true, trigger: 'blur' },
      {
        message:
          'Deployment 名称只能包含小写字母、数字和连字符，且不能以连字符开头或结尾',
        pattern: /^[\da-z]([\da-z-]*[\da-z])?$/,
        trigger: 'blur',
      },
      {
        max: 63,
        message: 'Deployment 名称长度不能超过63个字符',
        trigger: 'blur',
      },
    ],
    namespace: [
      { message: '请选择命名空间', required: true, trigger: 'change' },
    ],
    replicas: [
      { message: '请输入副本数量', required: true, trigger: 'blur' },
      {
        max: 100,
        message: '副本数量必须在0-100之间',
        min: 0,
        trigger: 'blur',
        type: 'number',
      },
    ],
  };

  const scaleFormRules: Record<string, Rule[]> = {
    replicas: [
      { message: '请输入副本数量', required: true, trigger: 'blur' },
      {
        max: 100,
        message: '副本数量必须在0-100之间',
        min: 0,
        trigger: 'blur',
        type: 'number',
      },
    ],
  };

  const yamlFormRules: Record<string, Rule[]> = {
    yaml: [
      { message: '请输入 YAML 内容', required: true, trigger: 'blur' },
      { message: 'YAML 内容过短，请检查是否完整', min: 50, trigger: 'blur' },
    ],
  };

  const createYamlFormRules: Record<string, Rule[]> = {
    yaml: [
      { message: '请输入 YAML 内容', required: true, trigger: 'blur' },
      { message: 'YAML 内容过短，请检查是否完整', min: 50, trigger: 'blur' },
    ],
  };

  const editFormRules: Record<string, Rule[]> = {
    replicas: [
      { message: '请输入副本数量', required: true, trigger: 'blur' },
      {
        max: 100,
        message: '副本数量必须在0-100之间',
        min: 0,
        trigger: 'blur',
        type: 'number',
      },
    ],
  };

  // computed
  const filteredDeployments = computed(() => {
    return deployments.value;
  });

  const rowSelection = computed(() => ({
    onChange: (keys: string[], rows: K8sDeployment[]) => {
      selectedRowKeys.value = keys;
      selectedRows.value = rows;
    },
    selectedRowKeys: selectedRowKeys.value,
  }));

  // helpers
  const validateClusterId = (record: K8sDeployment): null | number => {
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

  const getStatusText = (status?: K8sDeploymentStatus) => {
    const map: Record<K8sDeploymentStatus, string> = {
      [K8sDeploymentStatus.Error]: '异常',
      [K8sDeploymentStatus.Paused]: '已暂停',
      [K8sDeploymentStatus.Running]: '运行中',
      [K8sDeploymentStatus.Stopped]: '已停止',
    };
    return status === undefined ? '未知' : map[status] || '未知';
  };

  const getStatusColor = (status?: K8sDeploymentStatus) => {
    const map: Record<K8sDeploymentStatus, string> = {
      [K8sDeploymentStatus.Error]: 'error',
      [K8sDeploymentStatus.Paused]: 'warning',
      [K8sDeploymentStatus.Running]: 'success',
      [K8sDeploymentStatus.Stopped]: 'default',
    };
    return status === undefined ? 'default' : map[status] || 'default';
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
  const clearDeployments = () => {
    resourceRequestId++;
    loading.value = false;
    total.value = 0;
    loadError.value = '';
    deployments.value = [];
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
  const fetchDeployments = async () => {
    const clusterId = filterClusterId.value;
    const namespace = filterNamespace.value;
    if (!clusterId) {
      clearDeployments();
      return;
    }
    const requestId = ++resourceRequestId;

    try {
      loading.value = true;
      loadError.value = '';
      selectedRowKeys.value = [];
      selectedRows.value = [];
      const params: GetDeploymentListReq = {
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
      };
      const res = await getDeploymentListApi(clusterId, params);
      if (
        requestId !== resourceRequestId ||
        filterClusterId.value !== clusterId ||
        filterNamespace.value !== namespace
      )
        return;
      // 确保每个deployment对象都有正确的cluster_id
      const deploymentsWithClusterId = (res?.items || []).map(
        (deployment: K8sDeployment) => ({
          ...deployment,
          cluster_id: deployment.cluster_id || clusterId,
        }),
      );
      deployments.value = deploymentsWithClusterId;
      total.value = res?.total || 0;
    } catch (error) {
      if (
        requestId !== resourceRequestId ||
        filterClusterId.value !== clusterId ||
        filterNamespace.value !== namespace
      )
        return;
      clearDeployments();
      if (shouldRecordPageError(error))
        loadError.value = '获取 Deployment 列表失败，请重试';
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
          // 自动加载该集群的命名空间和Deployment数据
          await fetchNamespaces();
          await fetchDeployments();
        }
      }
    } catch (error) {
      if (clustersPage.value === 1) {
        clusters.value = [];
        clustersTotal.value = 0;
        filterClusterId.value = undefined;
        clearNamespaces();
        clearDeployments();
      }
      if (shouldRecordPageError(error))
        clustersError.value = '获取集群列表失败，请重试';
      if (shouldNotifyPageError(error)) message.error(clustersError.value);
    } finally {
      clustersLoading.value = false;
    }
  };

  // 查看详情
  const showDeploymentDetail = async (record: K8sDeployment) => {
    const clusterId = validateClusterId(record);
    if (!clusterId) return;

    try {
      detailLoading.value = true;
      isDetailModalVisible.value = true;
      const res = await getDeploymentDetailsApi(
        clusterId,
        record.namespace,
        record.name,
      );

      // 转换标签和注解格式：从对象转为数组
      const processedDetail = res
        ? {
            ...res,
            annotations: res.annotations
              ? recordToKeyValueList(res.annotations)
              : [],
            cluster_id: clusterId,
            labels: res.labels ? recordToKeyValueList(res.labels) : [],
          }
        : {
            ...record,
            annotations: record.annotations
              ? recordToKeyValueList(record.annotations)
              : [],
            cluster_id: clusterId,
            labels: record.labels ? recordToKeyValueList(record.labels) : [],
          };

      currentDeploymentDetail.value = processedDetail;
    } catch (error) {
      if (shouldNotifyPageError(error))
        message.error('获取 Deployment 详情失败');

      // 错误时也要处理格式转换
      const fallbackDetail = {
        ...record,
        annotations: record.annotations
          ? recordToKeyValueList(record.annotations)
          : [],
        cluster_id: clusterId,
        labels: record.labels ? recordToKeyValueList(record.labels) : [],
      };
      currentDeploymentDetail.value = fallbackDetail;
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
    const clusterId = validateClusterId(record);
    if (!clusterId) return;

    try {
      submitLoading.value = true;
      currentOperationDeployment.value = { ...record, cluster_id: clusterId };
      const res = await getDeploymentYamlApi(
        clusterId,
        record.namespace,
        record.name,
      );
      currentYamlContent.value = res?.yaml || '';
      yamlFormModel.value.yaml = res?.yaml || '';
      isYamlModalVisible.value = true;
    } catch (error) {
      if (shouldNotifyPageError(error))
        message.error('获取 Deployment YAML 失败');
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

      const params: Omit<
        UpdateDeploymentByYamlReq,
        'cluster_id' | 'name' | 'namespace'
      > = {
        yaml: yamlFormModel.value.yaml,
      };

      await updateDeploymentByYamlApi(
        currentOperationDeployment.value.cluster_id,
        currentOperationDeployment.value.namespace,
        currentOperationDeployment.value.name,
        params,
      );
      message.success('Deployment YAML 更新成功');
      isYamlModalVisible.value = false;
      await fetchDeployments();
    } catch (error: unknown) {
      if (error && typeof error === 'object' && 'errorFields' in error) {
        if (shouldNotifyPageError(error))
          message.warning('请检查 YAML 格式是否正确');
        return;
      }
      if (shouldNotifyPageError(error))
        message.error('Deployment YAML 更新失败');
    } finally {
      submitLoading.value = false;
    }
  };

  // 创建 Deployment
  const openCreateModal = () => {
    createFormModel.value = {
      annotations: {},
      images: [''],
      labels: {},
      name: '',
      namespace: '',
      replicas: 1,
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
        annotations:
          Object.keys(createFormModel.value.annotations).length > 0
            ? createFormModel.value.annotations
            : undefined,
        images: createFormModel.value.images.filter((img) => img.trim()),
        labels:
          Object.keys(createFormModel.value.labels).length > 0
            ? createFormModel.value.labels
            : undefined,
        name: createFormModel.value.name,
        namespace: createFormModel.value.namespace,
        replicas: createFormModel.value.replicas,
        spec: {
          replicas: createFormModel.value.replicas,
        },
      };

      await createDeploymentApi(filterClusterId.value, params);
      message.success('Deployment 创建成功');
      isCreateModalVisible.value = false;
      await fetchDeployments();
    } catch (error: unknown) {
      if (error && typeof error === 'object' && 'errorFields' in error) {
        if (shouldNotifyPageError(error))
          message.warning('请检查表单填写是否正确');
        return;
      }
      if (shouldNotifyPageError(error)) message.error('Deployment 创建失败');
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
      message.success('Deployment YAML 创建成功');
      isCreateYamlModalVisible.value = false;
      await fetchDeployments();
    } catch (error: unknown) {
      if (error && typeof error === 'object' && 'errorFields' in error) {
        if (shouldNotifyPageError(error))
          message.warning('请检查 YAML 格式是否正确');
        return;
      }
      if (shouldNotifyPageError(error))
        message.error('Deployment YAML 创建失败');
    } finally {
      submitLoading.value = false;
    }
  };

  // 编辑 Deployment
  const openEditModal = (record: K8sDeployment) => {
    const clusterId = validateClusterId(record);
    if (!clusterId) return;

    currentOperationDeployment.value = { ...record, cluster_id: clusterId };
    editFormModel.value = {
      annotations: keyValueListToRecord(record.annotations),
      images:
        record.images && record.images.length > 0 ? [...record.images] : [''],
      labels: keyValueListToRecord(record.labels),
      name: record.name,
      namespace: record.namespace,
      replicas: record.replicas,
    };
    isEditModalVisible.value = true;
  };

  const closeEditModal = () => {
    isEditModalVisible.value = false;
    currentOperationDeployment.value = null;
  };

  const submitEditForm = async () => {
    if (!editFormRef.value || !currentOperationDeployment.value) return;

    try {
      await editFormRef.value.validate();
      submitLoading.value = true;

      const params: Omit<
        UpdateDeploymentReq,
        'cluster_id' | 'name' | 'namespace'
      > = {
        annotations:
          Object.keys(editFormModel.value.annotations).length > 0
            ? editFormModel.value.annotations
            : undefined,
        images: editFormModel.value.images.filter((img) => img.trim()),
        labels:
          Object.keys(editFormModel.value.labels).length > 0
            ? editFormModel.value.labels
            : undefined,
        replicas: editFormModel.value.replicas,
        spec: {
          replicas: editFormModel.value.replicas,
        },
      };

      await updateDeploymentApi(
        currentOperationDeployment.value.cluster_id,
        currentOperationDeployment.value.namespace,
        currentOperationDeployment.value.name,
        params,
      );
      message.success('Deployment 更新成功');
      isEditModalVisible.value = false;
      await fetchDeployments();
    } catch (error: unknown) {
      if (error && typeof error === 'object' && 'errorFields' in error) {
        if (shouldNotifyPageError(error))
          message.warning('请检查表单填写是否正确');
        return;
      }
      if (shouldNotifyPageError(error)) message.error('Deployment 更新失败');
    } finally {
      submitLoading.value = false;
    }
  };

  // 删除 Deployment
  const deleteDeployment = (record: K8sDeployment) => {
    const clusterId = validateClusterId(record);
    if (!clusterId) return;

    Modal.confirm({
      cancelText: '取消',
      centered: true,
      content: `确定要删除 Deployment "${record.name}" 吗？此操作不可逆！`,
      okText: '确认删除',
      okType: 'danger',
      onOk: async () => {
        try {
          await deleteDeploymentApi(clusterId, record.namespace, record.name);
          message.success('Deployment 删除成功');
          await fetchDeployments();
        } catch (error) {
          if (shouldNotifyPageError(error))
            message.error('Deployment 删除失败');
        }
      },
      title: '删除 Deployment',
    });
  };

  // 重启 Deployment
  const restartDeployment = (record: K8sDeployment) => {
    const clusterId = validateClusterId(record);
    if (!clusterId) return;

    Modal.confirm({
      cancelText: '取消',
      centered: true,
      content: `确定要重启 Deployment "${record.name}" 吗？这将重启所有 Pod。`,
      okText: '确认重启',
      okType: 'primary',
      onOk: async () => {
        try {
          await restartDeploymentApi(clusterId, record.namespace, record.name);
          message.success('Deployment 重启成功');
          await fetchDeployments();
        } catch (error) {
          if (shouldNotifyPageError(error))
            message.error('Deployment 重启失败');
        }
      },
      title: '重启 Deployment',
    });
  };

  // 伸缩 Deployment
  const openScaleModal = (record: K8sDeployment) => {
    const clusterId = validateClusterId(record);
    if (!clusterId) return;

    currentOperationDeployment.value = { ...record, cluster_id: clusterId };
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
        params,
      );
      message.success('Deployment 伸缩成功');
      isScaleModalVisible.value = false;
      await fetchDeployments();
    } catch (error: unknown) {
      if (error && typeof error === 'object' && 'errorFields' in error) {
        if (shouldNotifyPageError(error))
          message.warning('请检查表单填写是否正确');
        return;
      }
      if (shouldNotifyPageError(error)) message.error('Deployment 伸缩失败');
    } finally {
      submitLoading.value = false;
    }
  };

  // 暂停/恢复 Deployment
  const pauseDeployment = (record: K8sDeployment) => {
    const clusterId = validateClusterId(record);
    if (!clusterId) return;

    Modal.confirm({
      cancelText: '取消',
      centered: true,
      content: `确定要暂停 Deployment "${record.name}" 吗？`,
      okText: '确认暂停',
      okType: 'primary',
      onOk: async () => {
        try {
          await pauseDeploymentApi(clusterId, record.namespace, record.name);
          message.success('Deployment 暂停成功');
          await fetchDeployments();
        } catch (error) {
          if (shouldNotifyPageError(error))
            message.error('Deployment 暂停失败');
        }
      },
      title: '暂停 Deployment',
    });
  };

  const resumeDeployment = (record: K8sDeployment) => {
    const clusterId = validateClusterId(record);
    if (!clusterId) return;

    Modal.confirm({
      cancelText: '取消',
      centered: true,
      content: `确定要恢复 Deployment "${record.name}" 吗？`,
      okText: '确认恢复',
      okType: 'primary',
      onOk: async () => {
        try {
          await resumeDeploymentApi(clusterId, record.namespace, record.name);
          message.success('Deployment 恢复成功');
          await fetchDeployments();
        } catch (error) {
          if (shouldNotifyPageError(error))
            message.error('Deployment 恢复失败');
        }
      },
      title: '恢复 Deployment',
    });
  };

  // 查看 Pod 列表
  const showPodModal = async (record: K8sDeployment) => {
    const clusterId = validateClusterId(record);
    if (!clusterId) return;

    try {
      submitLoading.value = true;
      currentOperationDeployment.value = { ...record, cluster_id: clusterId };
      const res = await getDeploymentPodsApi(
        clusterId,
        record.namespace,
        record.name,
      );
      deploymentPods.value = res?.items || [];
      isPodModalVisible.value = true;
    } catch (error) {
      if (shouldNotifyPageError(error)) message.error('获取 Pod 列表失败');
    } finally {
      submitLoading.value = false;
    }
  };

  const closePodModal = () => {
    isPodModalVisible.value = false;
    currentOperationDeployment.value = null;
    deploymentPods.value = [];
  };

  // 历史窗口及其读取结果只能属于发起时的资源和登录会话。
  const {
    close: closeHistoryModal,
    isCurrent: isHistoryCurrent,
    loading: historyLoading,
    show: showHistoryModal,
  } = useWorkloadHistoryScope({
    cluster: filterClusterId,
    history: deploymentHistory,
    namespace: filterNamespace,
    read: getDeploymentHistoryApi,
    target: currentOperationDeployment,
    visible: isHistoryModalVisible,
  });

  // 标签过滤管理
  const addFilterLabel = (key: string, value: string) => {
    if (key && key.trim()) {
      filterLabels.value[key.trim()] = value;
      currentPage.value = 1;
      fetchDeployments();
    }
  };

  const removeFilterLabel = (key: string) => {
    Reflect.deleteProperty(filterLabels.value, key);
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
    if (selectedRows.value.length === 0) return;

    Modal.confirm({
      cancelText: '取消',
      centered: true,
      content: `确定要对选中的 ${selectedRows.value.length} 个 Deployment 执行${operation}操作吗？`,
      okText: '确认执行',
      okType: operation === '删除' ? 'danger' : 'primary',
      onOk: async () => {
        try {
          for (const deployment of selectedRows.value) {
            const clusterId = deployment.cluster_id || filterClusterId.value;
            if (!clusterId) {
              message.error(
                `Deployment "${deployment.name}" 缺少有效的集群ID，跳过操作`,
              );
              continue;
            }

            if (operation === '删除') {
              await deleteDeploymentApi(
                clusterId,
                deployment.namespace,
                deployment.name,
              );
            } else if (operation === '重启') {
              await restartDeploymentApi(
                clusterId,
                deployment.namespace,
                deployment.name,
              );
            }
          }
          message.success(`批量${operation}操作已完成`);
          selectedRowKeys.value = [];
          selectedRows.value = [];
          await fetchDeployments();
        } catch (error) {
          if (shouldNotifyPageError(error))
            message.error(`批量${operation}失败`);
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
    Reflect.deleteProperty(createFormModel.value.labels, key);
  };

  const addAnnotationField = () => {
    // 注解字段通过模态框单独管理
  };

  const removeAnnotationField = (key: string) => {
    Reflect.deleteProperty(createFormModel.value.annotations, key);
  };

  // YAML 操作辅助函数
  const insertYamlTemplate = () => {
    if (
      createYamlFormModel.value.yaml &&
      createYamlFormModel.value.yaml.trim()
    ) {
      Modal.confirm({
        cancelText: '取消',
        centered: true,
        content: '当前已有内容，插入模板将覆盖现有内容，是否继续？',
        okText: '确认',
        onOk: () => {
          createYamlFormModel.value.yaml = DEPLOYMENT_YAML_TEMPLATE;
          message.success('模板已插入');
        },
        title: '确认操作',
      });
    } else {
      createYamlFormModel.value.yaml = DEPLOYMENT_YAML_TEMPLATE;
      message.success('模板已插入');
    }
  };

  const formatYaml = () => {
    const yamlContent = createYamlFormModel.value.yaml;
    if (!yamlContent || !yamlContent.trim()) {
      message.warning('YAML 内容为空，无法格式化');
      return;
    }

    try {
      // 解析 YAML
      const parsed = yaml.load(yamlContent);
      // 重新格式化为 YAML（缩进2空格）
      const formatted = yaml.dump(parsed, {
        indent: 2,
        lineWidth: -1, // 不限制行宽
        noRefs: true, // 不使用引用
        sortKeys: false, // 保持原有顺序
      });
      createYamlFormModel.value.yaml = formatted;
      message.success('YAML 格式化成功');
    } catch (error: any) {
      message.error(`YAML 格式化失败: ${error.message || '未知错误'}`);
    }
  };

  const validateYaml = () => {
    const yamlContent = createYamlFormModel.value.yaml;
    if (!yamlContent || !yamlContent.trim()) {
      message.warning('YAML 内容为空，无法检查');
      return;
    }

    try {
      // 尝试解析 YAML
      const parsed = yaml.load(yamlContent);

      // 检查是否是有效的对象
      if (!parsed || typeof parsed !== 'object') {
        message.warning('YAML 内容无效：应为对象格式');
        return;
      }

      // 基本的 Deployment 字段检查
      const deployment = parsed as any;
      const issues: string[] = [];

      if (!deployment.apiVersion) {
        issues.push('缺少 apiVersion 字段');
      }
      if (!deployment.kind) {
        issues.push('缺少 kind 字段');
      } else if (deployment.kind !== 'Deployment') {
        issues.push(`kind 应为 "Deployment"，当前为 "${deployment.kind}"`);
      }
      if (!deployment.metadata?.name) {
        issues.push('缺少 metadata.name 字段');
      }
      if (deployment.spec) {
        if (deployment.spec.replicas === undefined) {
          issues.push('建议设置 spec.replicas 字段');
        }
        if (!deployment.spec.selector) {
          issues.push('缺少 spec.selector 字段');
        }
        if (!deployment.spec.template) {
          issues.push('缺少 spec.template 字段');
        }
      } else {
        issues.push('缺少 spec 字段');
      }

      if (issues.length > 0) {
        Modal.warning({
          centered: true,
          content: () =>
            h('div', [
              h('p', 'YAML 语法正确，但发现以下问题：'),
              h(
                'ul',
                { style: 'margin: 8px 0; padding-left: 20px;' },
                issues.map((issue) => h('li', issue)),
              ),
            ]),
          title: 'YAML 格式检查警告',
          width: 500,
        });
      } else {
        message.success('YAML 格式检查通过，所有必需字段完整');
      }
    } catch (error: any) {
      Modal.error({
        centered: true,
        content: () =>
          h('div', [
            h(
              'p',
              {
                style: 'color: #ff4d4f; font-weight: 600; margin-bottom: 8px;',
              },
              '语法错误：',
            ),
            h(
              'pre',
              {
                style:
                  'background: #f5f5f5; padding: 12px; border-radius: 4px; font-size: 12px; overflow: auto; max-height: 200px;',
              },
              error.message || '未知错误',
            ),
          ]),
        title: 'YAML 格式检查失败',
        width: 600,
      });
    }
  };

  const clearYaml = () => {
    if (
      createYamlFormModel.value.yaml &&
      createYamlFormModel.value.yaml.trim()
    ) {
      Modal.confirm({
        cancelText: '取消',
        centered: true,
        content: '确定要清空当前的 YAML 内容吗？此操作不可恢复。',
        okText: '确认清空',
        okType: 'danger',
        onOk: () => {
          createYamlFormModel.value.yaml = '';
          message.success('YAML 内容已清空');
        },
        title: '确认清空',
      });
    } else {
      message.info('YAML 内容已为空');
    }
  };

  // 编辑 YAML 的格式化和验证函数
  const formatEditYaml = () => {
    const yamlContent = yamlFormModel.value.yaml;
    if (!yamlContent || !yamlContent.trim()) {
      message.warning('YAML 内容为空，无法格式化');
      return;
    }

    try {
      const parsed = yaml.load(yamlContent);
      const formatted = yaml.dump(parsed, {
        indent: 2,
        lineWidth: -1,
        noRefs: true,
        sortKeys: false,
      });
      yamlFormModel.value.yaml = formatted;
      message.success('YAML 格式化成功');
    } catch (error: any) {
      message.error(`YAML 格式化失败: ${error.message || '未知错误'}`);
    }
  };

  const validateEditYaml = () => {
    const yamlContent = yamlFormModel.value.yaml;
    if (!yamlContent || !yamlContent.trim()) {
      message.warning('YAML 内容为空，无法检查');
      return;
    }

    try {
      const parsed = yaml.load(yamlContent);

      if (!parsed || typeof parsed !== 'object') {
        message.warning('YAML 内容无效：应为对象格式');
        return;
      }

      const deployment = parsed as any;
      const issues: string[] = [];

      if (!deployment.apiVersion) {
        issues.push('缺少 apiVersion 字段');
      }
      if (!deployment.kind) {
        issues.push('缺少 kind 字段');
      } else if (deployment.kind !== 'Deployment') {
        issues.push(`kind 应为 "Deployment"，当前为 "${deployment.kind}"`);
      }
      if (!deployment.metadata?.name) {
        issues.push('缺少 metadata.name 字段');
      }
      if (deployment.spec) {
        if (deployment.spec.replicas === undefined) {
          issues.push('建议设置 spec.replicas 字段');
        }
        if (!deployment.spec.selector) {
          issues.push('缺少 spec.selector 字段');
        }
        if (!deployment.spec.template) {
          issues.push('缺少 spec.template 字段');
        }
      } else {
        issues.push('缺少 spec 字段');
      }

      if (issues.length > 0) {
        Modal.warning({
          centered: true,
          content: () =>
            h('div', [
              h('p', 'YAML 语法正确，但发现以下问题：'),
              h(
                'ul',
                { style: 'margin: 8px 0; padding-left: 20px;' },
                issues.map((issue) => h('li', issue)),
              ),
            ]),
          title: 'YAML 格式检查警告',
          width: 500,
        });
      } else {
        message.success('YAML 格式检查通过，所有必需字段完整');
      }
    } catch (error: any) {
      Modal.error({
        centered: true,
        content: () =>
          h('div', [
            h(
              'p',
              {
                style: 'color: #ff4d4f; font-weight: 600; margin-bottom: 8px;',
              },
              '语法错误：',
            ),
            h(
              'pre',
              {
                style:
                  'background: #f5f5f5; padding: 12px; border-radius: 4px; font-size: 12px; overflow: auto; max-height: 200px;',
              },
              error.message || '未知错误',
            ),
          ]),
        title: 'YAML 格式检查失败',
        width: 600,
      });
    }
  };

  return {
    // form field operations
    addAnnotationField,
    // filter operations
    addFilterLabel,
    addImageField,
    addLabelField,
    // batch operations
    batchOperation,
    // operations
    clearDeployments,
    clearFilterLabels,
    clearNamespaces,
    // yaml operations
    clearYaml,
    // create operations
    closeCreateModal,
    closeCreateYamlModal,
    // detail operations
    closeDetailModal,
    // edit operations
    closeEditModal,
    // history operations
    closeHistoryModal,
    // pod operations
    closePodModal,
    // scale operations
    closeScaleModal,
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
    currentDeploymentDetail,
    currentOperationDeployment,

    currentPage,
    currentYamlContent,
    // deployment operations
    deleteDeployment,
    deploymentHistory,
    deploymentPods,
    deployments,
    // modal state
    detailLoading,
    editFormModel,
    editFormRef,
    editFormRules,

    fetchClusters,
    fetchDeployments,
    fetchNamespaces,
    filterClusterId,
    // computed
    filteredDeployments,

    filterLabels,
    filterNamespace,
    filterStatus,
    formatEditYaml,
    formatYaml,

    formRef,
    // helpers
    getEnvText,
    getStatusColor,
    getStatusText,
    // pagination operations
    handlePageChange,

    historyLoading,
    insertYamlTemplate,

    isCreateModalVisible,
    isCreateYamlModalVisible,
    isDetailModalVisible,
    isEditModalVisible,
    isHistoryCurrent,
    isHistoryModalVisible,

    isPodModalVisible,
    isScaleModalVisible,
    isYamlModalVisible,
    // constants
    K8sDeploymentStatus,
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
    openCreateModal,
    openCreateYamlModal,
    openEditModal,

    openScaleModal,
    pageSize,
    pauseDeployment,

    recordToKeyValueList,
    removeAnnotationField,
    removeFilterLabel,
    removeImageField,

    removeLabelField,
    resetClusters,
    restartDeployment,

    resumeDeployment,
    rowSelection,

    scaleFormModel,
    scaleFormRef,
    scaleFormRules,
    searchText,

    selectedRowKeys,
    selectedRows,
    showDeploymentDetail,

    showHistoryModal,

    showPodModal,
    showYamlModal,

    submitCreateForm,
    submitCreateYamlForm,
    submitEditForm,
    submitLoading,
    submitScaleForm,
    submitYamlForm,

    total,
    validateClusterId,
    validateEditYaml,
    validateYaml,
    yamlFormModel,
    yamlFormRef,

    yamlFormRules,
  };
}
