import type { FormInstance, Rule } from 'ant-design-vue/es/form';

import { computed, ref } from 'vue';

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
  getNamespacesListApi,
  type K8sNamespace,
  type K8sNamespaceListReq,
} from '#/api/core/k8s/k8s_namespace';
import {
  createStatefulSetApi,
  createStatefulSetByYamlApi,
  type CreateStatefulSetByYamlReq,
  type CreateStatefulSetReq,
  deleteStatefulSetApi,
  getStatefulSetDetailsApi,
  getStatefulSetHistoryApi,
  getStatefulSetListApi,
  type GetStatefulSetListReq,
  getStatefulSetPodsApi,
  getStatefulSetYamlApi,
  type K8sStatefulSet,
  type K8sStatefulSetHistory,
  K8sStatefulSetStatus,
  restartStatefulSetApi,
  type RestartStatefulSetReq,
  rollbackStatefulSetApi,
  type RollbackStatefulSetReq,
  scaleStatefulSetApi,
  type ScaleStatefulSetReq,
  updateStatefulSetApi,
  updateStatefulSetByYamlApi,
  type UpdateStatefulSetByYamlReq,
  type UpdateStatefulSetReq,
} from '#/api/core/k8s/k8s_statefulset';
import {
  shouldNotifyPageError,
  shouldRecordPageError,
} from '#/utils/permission/request-notice';

import { useWorkloadHistoryScope } from '../shared/use-workload-rollback-scope';

// YAML 模板常量
const STATEFULSET_YAML_TEMPLATE = `apiVersion: apps/v1
kind: StatefulSet
metadata:
  name: my-statefulset
  labels:
    app: my-app
spec:
  serviceName: my-service
  replicas: 3
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
          name: web
        resources:
          limits:
            cpu: "500m"
            memory: "512Mi"
          requests:
            cpu: "250m"
            memory: "256Mi"
        volumeMounts:
        - name: data
          mountPath: /usr/share/nginx/html
  volumeClaimTemplates:
  - metadata:
      name: data
    spec:
      accessModes: [ "ReadWriteOnce" ]
      resources:
        requests:
          storage: 1Gi`;

export function useStatefulSetPage() {
  // state
  const statefulSets = ref<K8sStatefulSet[]>([]);
  const clusters = ref<K8sCluster[]>([]);
  const namespaces = ref<K8sNamespace[]>([]);
  const loading = ref(false);
  const loadError = ref('');
  const clustersError = ref('');
  const namespacesError = ref('');
  let namespaceRequestId = 0;
  let resourceRequestId = 0;
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
    annotations: Record<string, string>;
    images: string[];
    labels: Record<string, string>;
    name: string;
    namespace: string;
    replicas: number;
    service_name: string;
  }>({
    annotations: {},
    images: [''],
    labels: {},
    name: '',
    namespace: '',
    replicas: 1,
    service_name: '',
  });

  const editFormModel = ref<{
    annotations: KeyValueList;
    images: string[];
    labels: KeyValueList;
    name: string;
    namespace: string;
    replicas: number;
    service_name: string;
  }>({
    annotations: [],
    images: [''],
    labels: [],
    name: '',
    namespace: '',
    replicas: 1,
    service_name: '',
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
      { message: '请输入 StatefulSet 名称', required: true, trigger: 'blur' },
      {
        message:
          'StatefulSet 名称只能包含小写字母、数字和连字符，且不能以连字符开头或结尾',
        pattern: /^[\da-z]([\da-z-]*[\da-z])?$/,
        trigger: 'blur',
      },
      {
        max: 63,
        message: 'StatefulSet 名称长度不能超过63个字符',
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
    service_name: [
      { message: '请输入服务名称', required: true, trigger: 'blur' },
      {
        message:
          '服务名称只能包含小写字母、数字和连字符，且不能以连字符开头或结尾',
        pattern: /^[\da-z]([\da-z-]*[\da-z])?$/,
        trigger: 'blur',
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

  const rollbackFormRules: Record<string, Rule[]> = {
    revision: [
      { message: '请输入回滚版本', required: true, trigger: 'blur' },
      { message: '版本号必须大于0', min: 1, trigger: 'blur', type: 'number' },
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
    name: [
      { message: '请输入 StatefulSet 名称', required: true, trigger: 'blur' },
      {
        message:
          'StatefulSet 名称只能包含小写字母、数字和连字符，且不能以连字符开头或结尾',
        pattern: /^[\da-z]([\da-z-]*[\da-z])?$/,
        trigger: 'blur',
      },
      {
        max: 63,
        message: 'StatefulSet 名称长度不能超过63个字符',
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

  // computed
  const filteredStatefulSets = computed(() => {
    return statefulSets.value;
  });

  const rowSelection = computed(() => ({
    onChange: (keys: string[], rows: K8sStatefulSet[]) => {
      selectedRowKeys.value = keys;
      selectedRows.value = rows;
    },
    selectedRowKeys: selectedRowKeys.value,
  }));

  // helpers
  const validateClusterId = (record: K8sStatefulSet): null | number => {
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

  const getStatusText = (status?: K8sStatefulSetStatus) => {
    const map: Record<K8sStatefulSetStatus, string> = {
      [K8sStatefulSetStatus.Error]: '异常',
      [K8sStatefulSetStatus.Running]: '运行中',
      [K8sStatefulSetStatus.Stopped]: '已停止',
      [K8sStatefulSetStatus.Updating]: '更新中',
    };
    return status === undefined ? '未知' : map[status] || '未知';
  };

  const getStatusColor = (status?: K8sStatefulSetStatus) => {
    const map: Record<K8sStatefulSetStatus, string> = {
      [K8sStatefulSetStatus.Error]: 'error',
      [K8sStatefulSetStatus.Running]: 'success',
      [K8sStatefulSetStatus.Stopped]: 'default',
      [K8sStatefulSetStatus.Updating]: 'processing',
    };
    return status === undefined ? 'default' : map[status] || 'default';
  };

  // 时间格式化函数
  const formatTime = (time?: string) => {
    if (!time) return '-';
    try {
      const date = new Date(time);
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      const hours = String(date.getHours()).padStart(2, '0');
      const minutes = String(date.getMinutes()).padStart(2, '0');
      const seconds = String(date.getSeconds()).padStart(2, '0');
      return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
    } catch {
      return time;
    }
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
  const clearStatefulSets = () => {
    resourceRequestId++;
    loading.value = false;
    total.value = 0;
    loadError.value = '';
    statefulSets.value = [];
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
  const fetchStatefulSets = async () => {
    const clusterId = filterClusterId.value;
    const namespace = filterNamespace.value;
    if (!clusterId) {
      clearStatefulSets();
      return;
    }
    const requestId = ++resourceRequestId;
    try {
      loading.value = true;
      loadError.value = '';
      selectedRowKeys.value = [];
      selectedRows.value = [];
      const params: GetStatefulSetListReq = {
        cluster_id: clusterId,
        labels:
          Object.keys(filterLabels.value).length > 0
            ? filterLabels.value
            : undefined,
        namespace: namespace || undefined,
        page: currentPage.value,
        search: searchText.value || undefined,
        service_name: filterServiceName.value || undefined,
        size: pageSize.value,
        status: filterStatus.value?.toString() || undefined,
      };
      const res = await getStatefulSetListApi(clusterId, params);
      if (
        requestId !== resourceRequestId ||
        filterClusterId.value !== clusterId ||
        filterNamespace.value !== namespace
      )
        return;
      // 确保每个statefulSet对象都有正确的cluster_id
      const statefulSetsWithClusterId = (res?.items || []).map(
        (statefulSet: K8sStatefulSet) => ({
          ...statefulSet,
          cluster_id: statefulSet.cluster_id || clusterId || 0,
        }),
      );
      statefulSets.value = statefulSetsWithClusterId;
      total.value = res?.total || 0;
    } catch (error) {
      if (
        requestId !== resourceRequestId ||
        filterClusterId.value !== clusterId ||
        filterNamespace.value !== namespace
      )
        return;
      clearStatefulSets();
      if (shouldRecordPageError(error))
        loadError.value = '获取 StatefulSet 列表失败，请重试';
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
          // 自动加载该集群的命名空间和StatefulSet数据
          await fetchNamespaces();
          await fetchStatefulSets();
        }
      }
    } catch (error) {
      if (clustersPage.value === 1) {
        clusters.value = [];
        clustersTotal.value = 0;
        filterClusterId.value = undefined;
        clearNamespaces();
        clearStatefulSets();
      }
      if (shouldRecordPageError(error))
        clustersError.value = '获取集群列表失败，请重试';
      if (shouldNotifyPageError(error)) message.error(clustersError.value);
    } finally {
      clustersLoading.value = false;
    }
  };

  // 查看详情
  const showStatefulSetDetail = async (record: K8sStatefulSet) => {
    const clusterId = validateClusterId(record);
    if (!clusterId) return;

    try {
      detailLoading.value = true;
      isDetailModalVisible.value = true;
      const res = await getStatefulSetDetailsApi(
        clusterId,
        record.namespace,
        record.name,
      );

      // 处理详情数据
      const processedDetail = res
        ? {
            ...res,
            annotations: res.annotations,
            cluster_id: clusterId,
            labels: res.labels,
          }
        : {
            ...record,
            annotations: record.annotations,
            cluster_id: clusterId,
            labels: record.labels,
          };

      currentStatefulSetDetail.value = processedDetail;
    } catch (error) {
      if (shouldNotifyPageError(error))
        message.error('获取 StatefulSet 详情失败');

      // 错误时也要处理格式转换
      const fallbackDetail = {
        ...record,
        annotations: record.annotations,
        cluster_id: clusterId,
        labels: record.labels,
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
      const res = await getStatefulSetYamlApi(
        clusterId,
        record.namespace,
        record.name,
      );
      currentYamlContent.value = res?.yaml || '';
      yamlFormModel.value.yaml = res?.yaml || '';
      isYamlModalVisible.value = true;
    } catch (error) {
      if (shouldNotifyPageError(error))
        message.error('获取 StatefulSet YAML 失败');
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
        name: currentOperationStatefulSet.value.name,
        namespace: currentOperationStatefulSet.value.namespace,
        yaml: yamlFormModel.value.yaml,
      };

      await updateStatefulSetByYamlApi(
        currentOperationStatefulSet.value.cluster_id,
        currentOperationStatefulSet.value.namespace,
        currentOperationStatefulSet.value.name,
        params,
      );
      message.success('StatefulSet YAML 更新成功');
      isYamlModalVisible.value = false;
      await fetchStatefulSets();
    } catch (error: unknown) {
      if (error && typeof error === 'object' && 'errorFields' in error) {
        if (shouldNotifyPageError(error))
          message.warning('请检查 YAML 格式是否正确');
        return;
      }
      if (shouldNotifyPageError(error))
        message.error('StatefulSet YAML 更新失败');
    } finally {
      submitLoading.value = false;
    }
  };

  // 创建 StatefulSet
  const openCreateModal = () => {
    createFormModel.value = {
      annotations: {},
      images: [''],
      labels: {},
      name: '',
      namespace: '',
      replicas: 1,
      service_name: '',
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
        annotations:
          Object.keys(createFormModel.value.annotations).length > 0
            ? createFormModel.value.annotations
            : undefined,
        cluster_id: filterClusterId.value,
        images: createFormModel.value.images.filter((img) => img.trim()),
        labels:
          Object.keys(createFormModel.value.labels).length > 0
            ? createFormModel.value.labels
            : undefined,
        name: createFormModel.value.name,
        namespace: createFormModel.value.namespace,
        replicas: createFormModel.value.replicas,
        service_name: createFormModel.value.service_name,
        spec: {
          replicas: createFormModel.value.replicas,
          service_name: createFormModel.value.service_name,
        },
      };

      await createStatefulSetApi(filterClusterId.value, params);
      message.success('StatefulSet 创建成功');
      isCreateModalVisible.value = false;
      await fetchStatefulSets();
    } catch (error: unknown) {
      if (error && typeof error === 'object' && 'errorFields' in error) {
        if (shouldNotifyPageError(error))
          message.warning('请检查表单填写是否正确');
        return;
      }
      if (shouldNotifyPageError(error)) message.error('StatefulSet 创建失败');
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
      message.success('StatefulSet YAML 创建成功');
      isCreateYamlModalVisible.value = false;
      await fetchStatefulSets();
    } catch (error: unknown) {
      if (error && typeof error === 'object' && 'errorFields' in error) {
        if (shouldNotifyPageError(error))
          message.warning('请检查 YAML 格式是否正确');
        return;
      }
      if (shouldNotifyPageError(error))
        message.error('StatefulSet YAML 创建失败');
    } finally {
      submitLoading.value = false;
    }
  };

  // 删除 StatefulSet
  const deleteStatefulSet = (record: K8sStatefulSet) => {
    const clusterId = validateClusterId(record);
    if (!clusterId) return;

    Modal.confirm({
      cancelText: '取消',
      centered: true,
      content: `确定要删除 StatefulSet "${record.name}" 吗？此操作不可逆！`,
      okText: '确认删除',
      okType: 'danger',
      onOk: async () => {
        try {
          await deleteStatefulSetApi(clusterId, record.namespace, record.name);
          message.success('StatefulSet 删除成功');
          await fetchStatefulSets();
        } catch (error) {
          if (shouldNotifyPageError(error))
            message.error('StatefulSet 删除失败');
        }
      },
      title: '删除 StatefulSet',
    });
  };

  // 重启 StatefulSet
  const restartStatefulSet = (record: K8sStatefulSet) => {
    const clusterId = validateClusterId(record);
    if (!clusterId) return;

    Modal.confirm({
      cancelText: '取消',
      centered: true,
      content: `确定要重启 StatefulSet "${record.name}" 吗？这将重启所有 Pod。`,
      okText: '确认重启',
      okType: 'primary',
      onOk: async () => {
        try {
          const params: RestartStatefulSetReq = {
            cluster_id: clusterId,
            name: record.name,
            namespace: record.namespace,
          };
          await restartStatefulSetApi(
            clusterId,
            record.namespace,
            record.name,
            params,
          );
          message.success('StatefulSet 重启成功');
          await fetchStatefulSets();
        } catch (error) {
          if (shouldNotifyPageError(error))
            message.error('StatefulSet 重启失败');
        }
      },
      title: '重启 StatefulSet',
    });
  };

  // 编辑 StatefulSet
  const openEditModal = (record: K8sStatefulSet) => {
    const clusterId = validateClusterId(record);
    if (!clusterId) return;

    currentOperationStatefulSet.value = { ...record, cluster_id: clusterId };

    // 填充编辑表单数据
    editFormModel.value = {
      annotations: recordToKeyValueList(
        keyValueListToRecord(record.annotations),
      ),
      images: record.images || [],
      labels: recordToKeyValueList(keyValueListToRecord(record.labels)),
      name: record.name,
      namespace: record.namespace,
      replicas: record.replicas,
      service_name: record.service_name || '',
    };

    isEditModalVisible.value = true;
  };

  const closeEditModal = () => {
    isEditModalVisible.value = false;
    currentOperationStatefulSet.value = null;
    editFormModel.value = {
      annotations: [],
      images: [''],
      labels: [],
      name: '',
      namespace: '',
      replicas: 1,
      service_name: '',
    };
  };

  const submitEditForm = async () => {
    if (!editFormRef.value || !currentOperationStatefulSet.value) return;

    try {
      await editFormRef.value.validate();
      submitLoading.value = true;

      const params: UpdateStatefulSetReq = {
        annotations:
          editFormModel.value.annotations.length > 0
            ? keyValueListToRecord(editFormModel.value.annotations)
            : undefined,
        cluster_id: currentOperationStatefulSet.value.cluster_id,
        images: editFormModel.value.images.filter((img) => img.trim()),
        labels:
          editFormModel.value.labels.length > 0
            ? keyValueListToRecord(editFormModel.value.labels)
            : undefined,
        name: editFormModel.value.name,
        namespace: editFormModel.value.namespace,
        replicas: editFormModel.value.replicas,
      };

      await updateStatefulSetApi(
        currentOperationStatefulSet.value.cluster_id,
        currentOperationStatefulSet.value.namespace,
        currentOperationStatefulSet.value.name,
        params,
      );
      message.success('StatefulSet 更新成功');
      isEditModalVisible.value = false;
      await fetchStatefulSets();
    } catch (error: unknown) {
      if (error && typeof error === 'object' && 'errorFields' in error) {
        if (shouldNotifyPageError(error))
          message.warning('请检查表单填写是否正确');
        return;
      }
      if (shouldNotifyPageError(error)) message.error('StatefulSet 更新失败');
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
        name: currentOperationStatefulSet.value.name,
        namespace: currentOperationStatefulSet.value.namespace,
        replicas: scaleFormModel.value.replicas,
      };

      await scaleStatefulSetApi(
        currentOperationStatefulSet.value.cluster_id,
        currentOperationStatefulSet.value.namespace,
        currentOperationStatefulSet.value.name,
        params,
      );
      message.success('StatefulSet 伸缩成功');
      isScaleModalVisible.value = false;
      await fetchStatefulSets();
    } catch (error: unknown) {
      if (error && typeof error === 'object' && 'errorFields' in error) {
        if (shouldNotifyPageError(error))
          message.warning('请检查表单填写是否正确');
        return;
      }
      if (shouldNotifyPageError(error)) message.error('StatefulSet 伸缩失败');
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
        name: currentOperationStatefulSet.value.name,
        namespace: currentOperationStatefulSet.value.namespace,
        revision: rollbackFormModel.value.revision,
      };

      await rollbackStatefulSetApi(
        currentOperationStatefulSet.value.cluster_id,
        currentOperationStatefulSet.value.namespace,
        currentOperationStatefulSet.value.name,
        params,
      );
      message.success('StatefulSet 回滚成功');
      isRollbackModalVisible.value = false;
      await fetchStatefulSets();
    } catch (error: unknown) {
      if (error && typeof error === 'object' && 'errorFields' in error) {
        if (shouldNotifyPageError(error))
          message.warning('请检查表单填写是否正确');
        return;
      }
      if (shouldNotifyPageError(error)) message.error('StatefulSet 回滚失败');
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
      const res = await getStatefulSetPodsApi(
        clusterId,
        record.namespace,
        record.name,
      );
      statefulSetPods.value = res?.items || [];
      isPodModalVisible.value = true;
    } catch (error) {
      if (shouldNotifyPageError(error)) message.error('获取 Pod 列表失败');
    } finally {
      submitLoading.value = false;
    }
  };

  const closePodModal = () => {
    isPodModalVisible.value = false;
    currentOperationStatefulSet.value = null;
    statefulSetPods.value = [];
  };

  // 历史窗口及其读取结果只能属于发起时的资源和登录会话。
  const {
    close: closeHistoryModal,
    isCurrent: isHistoryCurrent,
    loading: historyLoading,
    show: showHistoryModal,
  } = useWorkloadHistoryScope({
    cluster: filterClusterId,
    history: statefulSetHistory,
    namespace: filterNamespace,
    read: getStatefulSetHistoryApi,
    target: currentOperationStatefulSet,
    visible: isHistoryModalVisible,
  });

  // 标签过滤管理
  const addFilterLabel = (key: string, value: string) => {
    if (key && key.trim()) {
      filterLabels.value[key.trim()] = value;
      currentPage.value = 1;
      fetchStatefulSets();
    }
  };

  const removeFilterLabel = (key: string) => {
    Reflect.deleteProperty(filterLabels.value, key);
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
    if (selectedRows.value.length === 0) return;

    Modal.confirm({
      cancelText: '取消',
      centered: true,
      content: `确定要对选中的 ${selectedRows.value.length} 个 StatefulSet 执行${operation}操作吗？`,
      okText: '确认执行',
      okType: operation === '删除' ? 'danger' : 'primary',
      onOk: async () => {
        try {
          for (const statefulSet of selectedRows.value) {
            const clusterId = statefulSet.cluster_id || filterClusterId.value;
            if (!clusterId) {
              message.error(
                `StatefulSet "${statefulSet.name}" 缺少有效的集群ID，跳过操作`,
              );
              continue;
            }

            if (operation === '删除') {
              await deleteStatefulSetApi(
                clusterId,
                statefulSet.namespace,
                statefulSet.name,
              );
            } else if (operation === '重启') {
              const params: RestartStatefulSetReq = {
                cluster_id: clusterId,
                name: statefulSet.name,
                namespace: statefulSet.namespace,
              };
              await restartStatefulSetApi(
                clusterId,
                statefulSet.namespace,
                statefulSet.name,
                params,
              );
            }
          }
          message.success(`批量${operation}操作已完成`);
          selectedRowKeys.value = [];
          selectedRows.value = [];
          await fetchStatefulSets();
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
    Reflect.deleteProperty(createFormModel.value.labels, key);
  };

  const removeAnnotationField = (key: string) => {
    Reflect.deleteProperty(createFormModel.value.annotations, key);
  };

  const removeEditLabelField = (key: string) => {
    editFormModel.value.labels = editFormModel.value.labels.filter(
      (item) => item.key !== key,
    );
  };

  const removeEditAnnotationField = (key: string) => {
    editFormModel.value.annotations = editFormModel.value.annotations.filter(
      (item) => item.key !== key,
    );
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
          createYamlFormModel.value.yaml = STATEFULSET_YAML_TEMPLATE;
          message.success('模板已插入');
        },
        title: '确认操作',
      });
    } else {
      createYamlFormModel.value.yaml = STATEFULSET_YAML_TEMPLATE;
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
      const parsed = yaml.load(yamlContent);
      const formatted = yaml.dump(parsed, {
        indent: 2,
        lineWidth: -1,
        noRefs: true,
        sortKeys: false,
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
      const parsed = yaml.load(yamlContent);

      if (!parsed || typeof parsed !== 'object') {
        message.warning('YAML 内容无效：应为对象格式');
        return;
      }

      const statefulset = parsed as any;
      const issues: string[] = [];

      if (!statefulset.apiVersion) {
        issues.push('缺少 apiVersion 字段');
      }
      if (!statefulset.kind) {
        issues.push('缺少 kind 字段');
      } else if (statefulset.kind !== 'StatefulSet') {
        issues.push(`kind 应为 "StatefulSet"，当前为 "${statefulset.kind}"`);
      }
      if (!statefulset.metadata?.name) {
        issues.push('缺少 metadata.name 字段');
      }
      if (statefulset.spec) {
        if (!statefulset.spec.serviceName) {
          issues.push('缺少 spec.serviceName 字段');
        }
        if (!statefulset.spec.selector) {
          issues.push('缺少 spec.selector 字段');
        }
        if (!statefulset.spec.template) {
          issues.push('缺少 spec.template 字段');
        }
      } else {
        issues.push('缺少 spec 字段');
      }

      if (issues.length > 0) {
        Modal.warning({
          centered: true,
          content: issues.join('\n'),
          okText: '知道了',
          title: 'YAML 检查发现问题',
        });
      } else {
        message.success('YAML 格式检查通过');
      }
    } catch (error: any) {
      message.error(`YAML 检查失败: ${error.message || '未知错误'}`);
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

      const statefulset = parsed as any;
      const issues: string[] = [];

      if (!statefulset.apiVersion) {
        issues.push('缺少 apiVersion 字段');
      }
      if (!statefulset.kind) {
        issues.push('缺少 kind 字段');
      } else if (statefulset.kind !== 'StatefulSet') {
        issues.push(`kind 应为 "StatefulSet"，当前为 "${statefulset.kind}"`);
      }
      if (!statefulset.metadata?.name) {
        issues.push('缺少 metadata.name 字段');
      }
      if (statefulset.spec) {
        if (!statefulset.spec.serviceName) {
          issues.push('缺少 spec.serviceName 字段');
        }
        if (!statefulset.spec.selector) {
          issues.push('缺少 spec.selector 字段');
        }
        if (!statefulset.spec.template) {
          issues.push('缺少 spec.template 字段');
        }
      } else {
        issues.push('缺少 spec 字段');
      }

      if (issues.length > 0) {
        Modal.warning({
          centered: true,
          content: issues.join('\n'),
          okText: '知道了',
          title: 'YAML 检查发现问题',
        });
      } else {
        message.success('YAML 格式检查通过');
      }
    } catch (error: any) {
      message.error(`YAML 检查失败: ${error.message || '未知错误'}`);
    }
  };

  return {
    // form field operations
    addEditImageField,
    // filter operations
    addFilterLabel,
    addImageField,
    // batch operations
    batchOperation,
    clearFilterLabels,
    // operations
    clearNamespaces,
    clearStatefulSets,
    // YAML operations
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
    // rollback operations
    closeRollbackModal,
    // scale operations
    closeScaleModal,
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
    currentOperationStatefulSet,
    currentPage,
    currentStatefulSetDetail,
    currentYamlContent,

    // statefulSet operations
    deleteStatefulSet,
    // modal state
    detailLoading,
    editFormModel,
    editFormRef,
    editFormRules,
    fetchClusters,
    fetchNamespaces,
    fetchStatefulSets,
    filterClusterId,
    // computed
    filteredStatefulSets,
    filterLabels,

    filterNamespace,
    filterServiceName,
    filterStatus,
    formatEditYaml,
    // helpers
    formatTime,

    formatYaml,
    formRef,
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
    isRollbackModalVisible,
    isScaleModalVisible,
    isYamlModalVisible,
    // constants
    K8sStatefulSetStatus,
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
    openRollbackModal,
    openScaleModal,
    pageSize,
    recordToKeyValueList,
    removeAnnotationField,
    removeEditAnnotationField,

    removeEditImageField,
    removeEditLabelField,
    removeFilterLabel,
    removeImageField,
    removeLabelField,
    resetClusters,

    restartStatefulSet,
    rollbackFormModel,
    rollbackFormRef,

    rollbackFormRules,
    rowSelection,

    scaleFormModel,
    scaleFormRef,
    scaleFormRules,

    searchText,
    selectedRowKeys,
    selectedRows,

    showHistoryModal,
    showPodModal,

    showStatefulSetDetail,
    showYamlModal,
    statefulSetHistory,
    statefulSetPods,

    statefulSets,
    submitCreateForm,
    submitCreateYamlForm,

    submitEditForm,

    submitLoading,
    submitRollbackForm,

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
