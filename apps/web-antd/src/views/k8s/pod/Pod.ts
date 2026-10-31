import { utf8Chunks } from '#/utils/terminal-input';
import {
  computed,
  getCurrentScope,
  h,
  nextTick,
  onScopeDispose,
  ref,
} from 'vue';
import { message, Modal } from 'ant-design-vue';
import type { FormInstance, Rule } from 'ant-design-vue/es/form';
import yaml from 'js-yaml';
import { Terminal } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import { WebLinksAddon } from 'xterm-addon-web-links';
import 'xterm/css/xterm.css';
import { useAccessStore } from '@vben/stores';
import { useAppConfig } from '@vben/hooks';
import { websocketProtocols, websocketUrl } from '#/utils/websocket-url';
import {
  notifyStreamLoginExpired,
  refreshAccessTokenForStream,
} from '#/api/request';
import {
  createK8sPod,
  createK8sPodByYaml,
  type CreatePodByYamlReq,
  type CreatePodContainer,
  type CreatePodReq,
  deleteK8sPod,
  type DeletePodReq,
  downloadK8sPodFile,
  execK8sPod,
  forwardK8sPodPort,
  getK8sPodContainers,
  getK8sPodDetails,
  getK8sPodList,
  getK8sPodsByNode,
  getK8sPodYaml,
  type GetPodContainersReq,
  type GetPodDetailsReq,
  type GetPodListReq,
  type GetPodLogsReq,
  type GetPodsByNodeReq,
  type GetPodYamlReq,
  type K8sPod,
  K8sPodPhase,
  K8sPodStatus,
  type PodContainer,
  type PodExecReq,
  type PodFileDownloadReq,
  type PodFileUploadReq,
  type PodPortForwardPort,
  type PodPortForwardReq,
  updateK8sPod,
  updateK8sPodByYaml,
  type UpdatePodByYamlReq,
  type UpdatePodReq,
  uploadK8sPodFile,
} from '#/api/core/k8s/k8s_pod';
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
  shouldNotifyPageError,
  shouldRecordPageError,
} from '#/utils/permission/request-notice';

// YAML 模板常量
const POD_YAML_TEMPLATE = `apiVersion: v1
kind: Pod
metadata:
  name: my-pod
  labels:
    app: my-app
spec:
  restartPolicy: Always
  containers:
  - name: main-container
    image: nginx:latest
    imagePullPolicy: IfNotPresent
    ports:
    - containerPort: 80
      protocol: TCP
    env:
    - name: ENV_NAME
      value: production
    resources:
      requests:
        cpu: 100m
        memory: 128Mi
      limits:
        cpu: 500m
        memory: 512Mi
`;

/** 流式连接结束原因：login-expired = 令牌刷新失败或刷新后仍未授权（已提示重新登录） */
export type StreamCloseReason = 'login-expired';

/** 日志 SSE / 终端 WS 连续重连上限（连上后清零） */
export const STREAM_MAX_RECONNECT_ATTEMPTS = 5;

/**
 * 复审 P3-A：终端 WS 因连上后 4401 刷新令牌并重连后，连接稳定保持这么久（5 分钟）
 * 才允许下一次 4401 再刷新一次；不到这个时长再次 4401 仍直接停止并提示登录过期
 */
export const STREAM_UNAUTHORIZED_REFRESH_RESET_MS = 5 * 60 * 1000;

/** 指数退避：1s、2s、4s…，最长 30s */
export function streamReconnectDelay(attempt: number) {
  return Math.min(1000 * 2 ** Math.max(attempt - 1, 0), 30_000);
}

export function usePodPage() {
  // state
  const pods = ref<K8sPod[]>([]);
  const clusters = ref<K8sCluster[]>([]);
  const namespaces = ref<K8sNamespace[]>([]);
  const nodes = ref<string[]>([]);
  const loading = ref(false);
  const loadError = ref('');
  const clustersError = ref('');
  const namespacesError = ref('');
  let resourceRequestId = 0;
  let namespaceRequestId = 0;
  const clustersLoading = ref(false);
  const namespacesLoading = ref(false);
  const searchText = ref('');
  const filterStatus = ref<K8sPodStatus | undefined>(undefined);
  const filterPhase = ref<K8sPodPhase | undefined>(undefined);
  const filterClusterId = ref<number | undefined>(undefined);
  const filterNamespace = ref<string | undefined>(undefined);
  const filterNodeName = ref<string | undefined>(undefined);
  const filterLabels = ref<Record<string, string>>({});
  const selectedRowKeys = ref<string[]>([]);
  const selectedRows = ref<K8sPod[]>([]);
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
  const execFormRef = ref<FormInstance>();

  // modal/form state
  const isCreateModalVisible = ref(false);
  const isCreateYamlModalVisible = ref(false);
  const isEditModalVisible = ref(false);
  const isDetailModalVisible = ref(false);
  const isYamlModalVisible = ref(false);
  const isLogsModalVisible = ref(false);
  const isExecModalVisible = ref(false);
  const isPortForwardModalVisible = ref(false);
  const isContainersModalVisible = ref(false);
  const isFileManagerModalVisible = ref(false);
  const submitLoading = ref(false);
  const detailLoading = ref(false);
  const logsLoading = ref(false);
  const isLogsStreaming = ref(false);
  const logsStreamConnection = ref<{ close: () => void } | null>(null);

  // 终端相关状态
  const isTerminalConnected = ref(false);
  const terminalLoading = ref(false);
  const terminal = ref<Terminal | null>(null);
  let terminalInputSubscription: { dispose: () => void } | undefined;
  let terminalResizeObserver: ResizeObserver | undefined;
  const terminalConnection = ref<{
    sendCommand: (cmd: string) => void;
    close: () => void;
  } | null>(null);
  const fitAddon = ref<FitAddon | null>(null);

  // current operation target
  const currentOperationPod = ref<K8sPod | null>(null);
  const currentPodDetail = ref<any | null>(null);
  const currentYamlContent = ref('');
  const podLogs = ref<string>('');
  const podContainers = ref<PodContainer[]>([]);
  const selectedContainer = ref<string>('');

  // form models
  const createFormModel = ref<{
    name: string;
    namespace: string;
    labels: Record<string, string>;
    annotations: Record<string, string>;
    containers: CreatePodContainer[];
    init_containers: CreatePodContainer[];
    restart_policy: string;
    node_selector: Record<string, string>;
    tolerations: any[];
    affinity: any;
    volumes: any[];
    host_network: boolean;
    host_pid: boolean;
    dns_policy: string;
    service_account: string;
  }>({
    name: '',
    namespace: '',
    labels: {},
    annotations: {},
    containers: [
      {
        name: '',
        image: '',
        command: [],
        args: [],
        envs: [],
        ports: [],
        resources: {
          requests: { cpu: '', memory: '' },
          limits: { cpu: '', memory: '' },
        },
        volume_mounts: [],
        image_pull_policy: 'IfNotPresent',
      },
    ],
    init_containers: [],
    restart_policy: 'Always',
    node_selector: {},
    tolerations: [],
    affinity: undefined,
    volumes: [],
    host_network: false,
    host_pid: false,
    dns_policy: 'ClusterFirst',
    service_account: '',
  });

  const editFormModel = ref<{
    name: string;
    namespace: string;
    labels: Record<string, string>;
    annotations: Record<string, string>;
  }>({
    name: '',
    namespace: '',
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

  const logsFormModel = ref<{
    container: string;
    follow: boolean;
    previous: boolean;
    since_seconds: number;
    since_time: string;
    timestamps: boolean;
    tail_lines: number;
    limit_bytes: number;
  }>({
    container: '',
    follow: false,
    previous: false,
    since_seconds: 0,
    since_time: '',
    timestamps: true,
    tail_lines: 100,
    limit_bytes: 0,
  });

  const execFormModel = ref<{
    container: string;
    shell: string;
  }>({
    container: '',
    shell: '/bin/sh',
  });

  const portForwardFormModel = ref<{
    ports: PodPortForwardPort[];
  }>({
    ports: [{ local_port: 0, remote_port: 0 }],
  });

  // form validation rules
  const createFormRules: Record<string, Rule[]> = {
    name: [
      { required: true, message: '请输入 Pod 名称', trigger: 'blur' },
      {
        pattern: /^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/,
        message:
          'Pod 名称只能包含小写字母、数字和连字符，且不能以连字符开头或结尾',
        trigger: 'blur',
      },
      { max: 63, message: 'Pod 名称长度不能超过63个字符', trigger: 'blur' },
    ],
    namespace: [
      { required: true, message: '请选择命名空间', trigger: 'change' },
    ],
  };

  const yamlFormRules: Record<string, Rule[]> = {
    yaml: [
      { required: true, message: '请输入 YAML 内容', trigger: 'blur' },
      { min: 50, message: 'YAML 内容过短，请检查是否完整', trigger: 'blur' },
    ],
  };

  const createYamlFormRules: Record<string, Rule[]> = {
    yaml: [
      { required: true, message: '请输入 YAML 内容', trigger: 'blur' },
      { min: 50, message: 'YAML 内容过短，请检查是否完整', trigger: 'blur' },
    ],
  };

  const execFormRules: Record<string, Rule[]> = {
    container: [{ required: true, message: '请选择容器', trigger: 'change' }],
  };

  // computed
  const filteredPods = computed(() => {
    return pods.value;
  });

  const rowSelection = computed(() => ({
    selectedRowKeys: selectedRowKeys.value,
    onChange: (keys: string[], rows: K8sPod[]) => {
      selectedRowKeys.value = keys;
      selectedRows.value = rows;
    },
  }));

  // helpers
  const validateClusterId = (record: K8sPod): number | null => {
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

  const getStatusText = (status?: K8sPodStatus) => {
    const map: Record<K8sPodStatus, string> = {
      [K8sPodStatus.Pending]: '等待中',
      [K8sPodStatus.Running]: '运行中',
      [K8sPodStatus.Succeeded]: '已完成',
      [K8sPodStatus.Failed]: '失败',
      [K8sPodStatus.Unknown]: '未知',
    };
    return status !== undefined ? map[status] || '未知' : '未知';
  };

  const getStatusColor = (status?: K8sPodStatus) => {
    const map: Record<K8sPodStatus, string> = {
      [K8sPodStatus.Pending]: 'warning',
      [K8sPodStatus.Running]: 'success',
      [K8sPodStatus.Succeeded]: 'success',
      [K8sPodStatus.Failed]: 'error',
      [K8sPodStatus.Unknown]: 'default',
    };
    return status !== undefined ? map[status] || 'default' : 'default';
  };

  const getPhaseText = (phase?: K8sPodPhase) => {
    const map: Record<K8sPodPhase, string> = {
      [K8sPodPhase.Pending]: '等待中',
      [K8sPodPhase.Running]: '运行中',
      [K8sPodPhase.Succeeded]: '已完成',
      [K8sPodPhase.Failed]: '失败',
      [K8sPodPhase.Unknown]: '未知',
    };
    return phase !== undefined ? map[phase] || '未知' : '未知';
  };

  // 转换函数：Record<string, string> -> KeyValueList
  const recordToKeyValueList = (
    record: Record<string, string> | null | undefined,
  ): KeyValueList => {
    if (!record || typeof record !== 'object') {
      return [];
    }
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
      return data.reduce(
        (acc, { key, value }) => {
          acc[key] = value;
          return acc;
        },
        {} as Record<string, string>,
      );
    }

    return {};
  };

  // 解析JSON字段
  const parseJsonField = (field: string, fallback: any = null) => {
    if (!field) return fallback;
    try {
      return JSON.parse(field);
    } catch {
      return fallback;
    }
  };

  // cluster operations
  const clearPods = () => {
    resourceRequestId++;
    loading.value = false;
    total.value = 0;
    loadError.value = '';
    pods.value = [];
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
          // 自动加载该集群的命名空间和Pod数据
          await fetchNamespaces();
          await fetchPods();
        }
      }
    } catch (error) {
      if (clustersPage.value === 1) {
        clusters.value = [];
        clustersTotal.value = 0;
        filterClusterId.value = undefined;
        clearNamespaces();
        clearPods();
      }
      if (shouldRecordPageError(error))
        clustersError.value = '获取集群列表失败，请重试';
      if (shouldNotifyPageError(error)) message.error(clustersError.value);
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
  const fetchPods = async () => {
    const clusterId = filterClusterId.value;
    const namespace = filterNamespace.value;
    if (!clusterId) {
      clearPods();
      return;
    }
    const requestId = ++resourceRequestId;

    try {
      loading.value = true;
      loadError.value = '';
      selectedRowKeys.value = [];
      selectedRows.value = [];
      const params: GetPodListReq = {
        cluster_id: clusterId,
        page: currentPage.value,
        page_size: pageSize.value,
        search: searchText.value || undefined,
        namespace: namespace || undefined,
        status: filterStatus.value || undefined,
        labels:
          Object.keys(filterLabels.value).length > 0
            ? filterLabels.value
            : undefined,
      };
      const res = await getK8sPodList(params);
      if (
        requestId !== resourceRequestId ||
        filterClusterId.value !== clusterId ||
        filterNamespace.value !== namespace
      )
        return;
      // 确保每个pod对象都有正确的cluster_id
      const podsWithClusterId = (res?.items || []).map((pod: K8sPod) => ({
        ...pod,
        cluster_id: pod.cluster_id || clusterId,
        // 解析JSON字段
        labels: parseJsonField(pod.labels, {}),
        annotations: parseJsonField(pod.annotations, {}),
        conditions: parseJsonField(pod.conditions, []),
        containers: parseJsonField(pod.containers, []),
        init_containers: parseJsonField(pod.init_containers, []),
        volumes: parseJsonField(pod.volumes, []),
        owner_references: parseJsonField(pod.owner_references, []),
        spec: parseJsonField(pod.spec, {}),
      }));
      pods.value = podsWithClusterId;
      total.value = res?.total || 0;
    } catch (error) {
      if (
        requestId !== resourceRequestId ||
        filterClusterId.value !== clusterId ||
        filterNamespace.value !== namespace
      )
        return;
      clearPods();
      if (shouldRecordPageError(error))
        loadError.value = '获取 Pod 列表失败，请重试';
      if (shouldNotifyPageError(error)) message.error(loadError.value);
    } finally {
      if (requestId === resourceRequestId) loading.value = false;
    }
  };

  // 查看详情
  const showPodDetail = async (record: K8sPod) => {
    const clusterId = validateClusterId(record);
    if (!clusterId) return;

    try {
      detailLoading.value = true;
      isDetailModalVisible.value = true;
      const params: GetPodDetailsReq = {
        cluster_id: clusterId,
        namespace: record.namespace,
        name: record.name,
      };
      const res = await getK8sPodDetails(params);

      // 转换标签和注解格式：从对象转为数组
      const processedDetail = res
        ? {
            ...res,
            cluster_id: clusterId,
            labels: recordToKeyValueList(parseJsonField(res.labels, {})),
            annotations: recordToKeyValueList(
              parseJsonField(res.annotations, {}),
            ),
            conditions: parseJsonField(res.conditions, []),
            containers: parseJsonField(res.containers, []),
            init_containers: parseJsonField(res.init_containers, []),
            volumes: parseJsonField(res.volumes, []),
            owner_references: parseJsonField(res.owner_references, []),
            spec: parseJsonField(res.spec, {}),
          }
        : {
            ...record,
            cluster_id: clusterId,
            labels: recordToKeyValueList(parseJsonField(record.labels, {})),
            annotations: recordToKeyValueList(
              parseJsonField(record.annotations, {}),
            ),
          };

      currentPodDetail.value = processedDetail;
    } catch (error) {
      if (shouldNotifyPageError(error)) message.error('获取 Pod 详情失败');

      // 错误时也要处理格式转换
      try {
        const parsedLabels = parseJsonField(record.labels, {});
        const parsedAnnotations = parseJsonField(record.annotations, {});

        const fallbackDetail = {
          ...record,
          cluster_id: clusterId,
          labels: recordToKeyValueList(parsedLabels),
          annotations: recordToKeyValueList(parsedAnnotations),
        };
        currentPodDetail.value = fallbackDetail;
      } catch {
        // 最终的安全fallback
        currentPodDetail.value = {
          ...record,
          cluster_id: clusterId,
          labels: [],
          annotations: [],
        };
      }
    } finally {
      detailLoading.value = false;
    }
  };

  const closeDetailModal = () => {
    isDetailModalVisible.value = false;
    currentPodDetail.value = null;
  };

  // YAML 操作
  const showYamlModal = async (record: K8sPod) => {
    const clusterId = validateClusterId(record);
    if (!clusterId) return;

    try {
      submitLoading.value = true;
      currentOperationPod.value = { ...record, cluster_id: clusterId };
      const params: GetPodYamlReq = {
        cluster_id: clusterId,
        namespace: record.namespace,
        name: record.name,
      };
      const res = await getK8sPodYaml(params);
      currentYamlContent.value = res?.yaml || '';
      yamlFormModel.value.yaml = res?.yaml || '';
      isYamlModalVisible.value = true;
    } catch (error) {
      if (shouldNotifyPageError(error)) message.error('获取 Pod YAML 失败');
    } finally {
      submitLoading.value = false;
    }
  };

  const closeYamlModal = () => {
    isYamlModalVisible.value = false;
    currentOperationPod.value = null;
    currentYamlContent.value = '';
    yamlFormModel.value.yaml = '';
  };

  const submitYamlForm = async () => {
    if (!yamlFormRef.value || !currentOperationPod.value) return;

    try {
      await yamlFormRef.value.validate();
      submitLoading.value = true;

      const params: UpdatePodByYamlReq = {
        cluster_id: currentOperationPod.value.cluster_id,
        namespace: currentOperationPod.value.namespace,
        name: currentOperationPod.value.name,
        yaml: yamlFormModel.value.yaml,
      };

      await updateK8sPodByYaml(params);
      message.success('Pod YAML 更新成功');
      isYamlModalVisible.value = false;
      await fetchPods();
    } catch (error: unknown) {
      if (error && typeof error === 'object' && 'errorFields' in error) {
        if (shouldNotifyPageError(error))
          message.warning('请检查 YAML 格式是否正确');
        return;
      }
      if (shouldNotifyPageError(error)) message.error('Pod YAML 更新失败');
    } finally {
      submitLoading.value = false;
    }
  };

  // 创建 Pod
  const openCreateModal = () => {
    createFormModel.value = {
      name: '',
      namespace: '',
      labels: {},
      annotations: {},
      containers: [
        {
          name: '',
          image: '',
          command: [],
          args: [],
          envs: [],
          ports: [],
          resources: {
            requests: { cpu: '', memory: '' },
            limits: { cpu: '', memory: '' },
          },
          volume_mounts: [],
          image_pull_policy: 'IfNotPresent',
        },
      ],
      init_containers: [],
      restart_policy: 'Always',
      node_selector: {},
      tolerations: [],
      affinity: undefined,
      volumes: [],
      host_network: false,
      host_pid: false,
      dns_policy: 'ClusterFirst',
      service_account: '',
    };
    isCreateModalVisible.value = true;
  };

  const closeCreateModal = () => {
    isCreateModalVisible.value = false;
  };

  // 通过 YAML 创建 Pod
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

      const params: CreatePodReq = {
        cluster_id: filterClusterId.value,
        name: createFormModel.value.name,
        namespace: createFormModel.value.namespace,
        labels:
          Object.keys(createFormModel.value.labels).length > 0
            ? createFormModel.value.labels
            : undefined,
        annotations:
          Object.keys(createFormModel.value.annotations).length > 0
            ? createFormModel.value.annotations
            : undefined,
        containers: createFormModel.value.containers,
        init_containers:
          createFormModel.value.init_containers.length > 0
            ? createFormModel.value.init_containers
            : undefined,
        restart_policy: createFormModel.value.restart_policy,
        node_selector:
          Object.keys(createFormModel.value.node_selector).length > 0
            ? createFormModel.value.node_selector
            : undefined,
        tolerations:
          createFormModel.value.tolerations.length > 0
            ? createFormModel.value.tolerations
            : undefined,
        affinity: createFormModel.value.affinity,
        volumes:
          createFormModel.value.volumes.length > 0
            ? createFormModel.value.volumes
            : undefined,
        host_network: createFormModel.value.host_network,
        host_pid: createFormModel.value.host_pid,
        dns_policy: createFormModel.value.dns_policy,
        service_account: createFormModel.value.service_account,
      };

      await createK8sPod(params);
      message.success('Pod 创建成功');
      isCreateModalVisible.value = false;
      await fetchPods();
    } catch (error: unknown) {
      if (error && typeof error === 'object' && 'errorFields' in error) {
        if (shouldNotifyPageError(error))
          message.warning('请检查表单填写是否正确');
        return;
      }
      if (shouldNotifyPageError(error)) message.error('Pod 创建失败');
    } finally {
      submitLoading.value = false;
    }
  };

  const submitCreateYamlForm = async () => {
    if (!createYamlFormRef.value || !filterClusterId.value) return;

    try {
      await createYamlFormRef.value.validate();
      submitLoading.value = true;

      const params: CreatePodByYamlReq = {
        cluster_id: filterClusterId.value,
        yaml: createYamlFormModel.value.yaml,
      };

      await createK8sPodByYaml(params);
      message.success('Pod YAML 创建成功');
      isCreateYamlModalVisible.value = false;
      await fetchPods();
    } catch (error: unknown) {
      if (error && typeof error === 'object' && 'errorFields' in error) {
        if (shouldNotifyPageError(error))
          message.warning('请检查 YAML 格式是否正确');
        return;
      }
      if (shouldNotifyPageError(error)) message.error('Pod YAML 创建失败');
    } finally {
      submitLoading.value = false;
    }
  };

  // YAML 工具函数
  const insertYamlTemplate = () => {
    if (
      createYamlFormModel.value.yaml &&
      createYamlFormModel.value.yaml.trim()
    ) {
      Modal.confirm({
        title: '确认覆盖',
        content:
          '当前 YAML 编辑器中已有内容，插入模板将覆盖现有内容。是否继续？',
        okText: '继续插入',
        okType: 'primary',
        cancelText: '取消',
        centered: true,
        onOk: () => {
          createYamlFormModel.value.yaml = POD_YAML_TEMPLATE;
          message.success('模板已插入');
        },
      });
    } else {
      createYamlFormModel.value.yaml = POD_YAML_TEMPLATE;
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

      // 基本的 Pod 字段检查
      const pod = parsed as any;
      const issues: string[] = [];

      if (!pod.apiVersion) {
        issues.push('缺少 apiVersion 字段');
      }
      if (!pod.kind) {
        issues.push('缺少 kind 字段');
      } else if (pod.kind !== 'Pod') {
        issues.push(`kind 应为 "Pod"，当前为 "${pod.kind}"`);
      }
      if (!pod.metadata?.name) {
        issues.push('缺少 metadata.name 字段');
      }
      if (!pod.spec) {
        issues.push('缺少 spec 字段');
      } else {
        if (
          !pod.spec.containers ||
          !Array.isArray(pod.spec.containers) ||
          pod.spec.containers.length === 0
        ) {
          issues.push('缺少 spec.containers 字段或容器列表为空');
        }
        if (!pod.spec.restartPolicy) {
          issues.push('建议设置 spec.restartPolicy 字段');
        }
      }

      if (issues.length > 0) {
        Modal.warning({
          title: 'YAML 格式检查警告',
          content: () =>
            h('div', [
              h('p', 'YAML 语法正确，但发现以下问题：'),
              h(
                'ul',
                { style: 'margin: 8px 0; padding-left: 20px;' },
                issues.map((issue) => h('li', issue)),
              ),
            ]),
          width: 500,
          centered: true,
        });
      } else {
        message.success('YAML 格式检查通过，所有必需字段完整');
      }
    } catch (error: any) {
      Modal.error({
        title: 'YAML 格式检查失败',
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
        width: 600,
        centered: true,
      });
    }
  };

  const clearYaml = () => {
    if (
      createYamlFormModel.value.yaml &&
      createYamlFormModel.value.yaml.trim()
    ) {
      Modal.confirm({
        title: '确认清空',
        content: '确定要清空当前的 YAML 内容吗？此操作不可恢复。',
        okText: '确认清空',
        okType: 'danger',
        cancelText: '取消',
        centered: true,
        onOk: () => {
          createYamlFormModel.value.yaml = '';
          message.success('YAML 内容已清空');
        },
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

      const pod = parsed as any;
      const issues: string[] = [];

      if (!pod.apiVersion) {
        issues.push('缺少 apiVersion 字段');
      }
      if (!pod.kind) {
        issues.push('缺少 kind 字段');
      } else if (pod.kind !== 'Pod') {
        issues.push(`kind 应为 "Pod"，当前为 "${pod.kind}"`);
      }
      if (!pod.metadata?.name) {
        issues.push('缺少 metadata.name 字段');
      }
      if (!pod.spec) {
        issues.push('缺少 spec 字段');
      } else {
        if (
          !pod.spec.containers ||
          !Array.isArray(pod.spec.containers) ||
          pod.spec.containers.length === 0
        ) {
          issues.push('缺少 spec.containers 字段或容器列表为空');
        }
        if (!pod.spec.restartPolicy) {
          issues.push('建议设置 spec.restartPolicy 字段');
        }
      }

      if (issues.length > 0) {
        Modal.warning({
          title: 'YAML 格式检查警告',
          content: () =>
            h('div', [
              h('p', 'YAML 语法正确，但发现以下问题：'),
              h(
                'ul',
                { style: 'margin: 8px 0; padding-left: 20px;' },
                issues.map((issue) => h('li', issue)),
              ),
            ]),
          width: 500,
          centered: true,
        });
      } else {
        message.success('YAML 格式检查通过，所有必需字段完整');
      }
    } catch (error: any) {
      Modal.error({
        title: 'YAML 格式检查失败',
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
        width: 600,
        centered: true,
      });
    }
  };

  // 编辑 Pod
  const openEditModal = (record: K8sPod) => {
    currentOperationPod.value = record;
    editFormModel.value = {
      name: record.name,
      namespace: record.namespace,
      labels: parseJsonField(record.labels, {}),
      annotations: parseJsonField(record.annotations, {}),
    };
    isEditModalVisible.value = true;
  };

  const closeEditModal = () => {
    isEditModalVisible.value = false;
    currentOperationPod.value = null;
  };

  const submitEditForm = async () => {
    if (!formRef.value || !currentOperationPod.value) return;

    try {
      await formRef.value.validate();
      submitLoading.value = true;

      const params: UpdatePodReq = {
        cluster_id: currentOperationPod.value.cluster_id,
        name: currentOperationPod.value.name,
        namespace: currentOperationPod.value.namespace,
        labels:
          Object.keys(editFormModel.value.labels).length > 0
            ? editFormModel.value.labels
            : undefined,
        annotations:
          Object.keys(editFormModel.value.annotations).length > 0
            ? editFormModel.value.annotations
            : undefined,
      };

      await updateK8sPod(params);
      message.success('Pod 更新成功');
      isEditModalVisible.value = false;
      await fetchPods();
    } catch (error: unknown) {
      if (error && typeof error === 'object' && 'errorFields' in error) {
        if (shouldNotifyPageError(error))
          message.warning('请检查表单填写是否正确');
        return;
      }
      if (shouldNotifyPageError(error)) message.error('Pod 更新失败');
    } finally {
      submitLoading.value = false;
    }
  };

  // 删除 Pod
  const deletePod = (record: K8sPod) => {
    const clusterId = validateClusterId(record);
    if (!clusterId) return;

    Modal.confirm({
      title: '删除 Pod',
      content: `确定要删除 Pod "${record.name}" 吗？此操作不可逆！`,
      okText: '确认删除',
      okType: 'danger',
      cancelText: '取消',
      centered: true,
      onOk: async () => {
        try {
          const params: DeletePodReq = {
            cluster_id: clusterId,
            namespace: record.namespace,
            name: record.name,
          };
          await deleteK8sPod(params);
          message.success('Pod 删除成功');
          await fetchPods();
        } catch (error) {
          if (shouldNotifyPageError(error)) message.error('Pod 删除失败');
        }
      },
    });
  };

  // 查看日志
  const showLogsModal = async (record: K8sPod) => {
    const clusterId = validateClusterId(record);
    if (!clusterId) return;

    try {
      currentOperationPod.value = { ...record, cluster_id: clusterId };
      // 先获取容器列表
      const containersParams: GetPodContainersReq = {
        cluster_id: clusterId,
        namespace: record.namespace,
        pod_name: record.name,
      };
      const containersRes = await getK8sPodContainers(containersParams);
      podContainers.value = containersRes?.items || [];

      // 如果有容器，默认选择第一个
      if (podContainers.value.length > 0 && podContainers.value[0]) {
        selectedContainer.value = podContainers.value[0].name;
        logsFormModel.value.container = podContainers.value[0].name;
      }

      isLogsModalVisible.value = true;
    } catch (error) {
      if (shouldNotifyPageError(error)) message.error('获取 Pod 容器列表失败');
    }
  };

  const closeLogsModal = () => {
    // 停止SSE连接
    stopLogsStream();
    isLogsModalVisible.value = false;
    currentOperationPod.value = null;
    podLogs.value = '';
    podContainers.value = [];
    selectedContainer.value = '';
    // 重置表单模型
    logsFormModel.value = {
      container: '',
      follow: false,
      previous: false,
      since_seconds: 0,
      since_time: '',
      timestamps: true,
      tail_lines: 100,
      limit_bytes: 0,
    };
  };

  const fetchPodLogs = () => {
    if (!currentOperationPod.value || !logsFormModel.value.container) return;

    // 直接启动实时流模式
    startLogsStream();
  };

  // SSE流式获取Pod日志 - 移动到Pod.ts中的业务逻辑
  const streamK8sPodLogs = (
    params: GetPodLogsReq,
    onMessage: (data: string) => void,
    onError?: (error: Event) => void,
    onOpen?: () => void,
    onClose?: (reason?: StreamCloseReason) => void,
  ) => {
    // 每次连接前读最新的访问令牌（令牌可能已被刷新）
    const accessStore = useAccessStore();

    // 获取应用配置中的API URL
    const { apiURL } = useAppConfig(import.meta.env, import.meta.env.PROD);
    const baseURL = apiURL || `${window.location.origin}/api`;
    const queryParams = new URLSearchParams();

    // 添加查询参数
    if (params.follow !== undefined)
      queryParams.append('follow', params.follow.toString());
    if (params.previous !== undefined)
      queryParams.append('previous', params.previous.toString());
    if (params.since_seconds !== undefined)
      queryParams.append('since_seconds', params.since_seconds.toString());
    if (params.since_time) queryParams.append('since_time', params.since_time);
    if (params.timestamps !== undefined)
      queryParams.append('timestamps', params.timestamps.toString());
    if (params.tail_lines !== undefined)
      queryParams.append('tail_lines', params.tail_lines.toString());
    if (params.limit_bytes !== undefined)
      queryParams.append('limit_bytes', params.limit_bytes.toString());

    const url = `${baseURL}/k8s/pod/${params.cluster_id}/${params.namespace}/${params.pod_name}/containers/${params.container}/logs?${queryParams.toString()}`;

    // 验证URL格式
    try {
      new URL(url, window.location.origin);
    } catch {
      onError?.(new Event('error'));
      return {
        eventSource: null as any,
        close: () => {},
      };
    }

    let abortController: AbortController;
    let reader: ReadableStreamDefaultReader<Uint8Array> | null = null;
    let isManualClose = false;
    let reconnectAttempts = 0;
    let reconnectTimeoutId: NodeJS.Timeout | null = null;
    // 本轮断线（直到下次连上）是否已刷新过令牌：只刷新一次
    let tokenRefreshed = false;

    const clearReconnectTimer = () => {
      if (reconnectTimeoutId) {
        clearTimeout(reconnectTimeoutId);
        reconnectTimeoutId = null;
      }
    };

    // 停止重连并结束连接
    const stopStream = (reason?: StreamCloseReason) => {
      isManualClose = true;
      clearReconnectTimer();
      onClose?.(reason);
    };

    const scheduleReconnect = () => {
      clearReconnectTimer();
      if (isManualClose) return;
      if (reconnectAttempts >= STREAM_MAX_RECONNECT_ATTEMPTS) {
        stopStream();
        return;
      }
      reconnectAttempts++;
      reconnectTimeoutId = setTimeout(() => {
        createFetchSSE();
      }, streamReconnectDelay(reconnectAttempts));
    };

    // 401：先走统一刷新（单飞），成功后用新令牌重连；失败或刷新后仍 401 则停止并提示重新登录
    const recoverFromUnauthorized = async () => {
      if (tokenRefreshed) {
        stopStream('login-expired');
        await notifyStreamLoginExpired();
        return;
      }
      tokenRefreshed = true;
      const token = await refreshAccessTokenForStream();
      if (isManualClose) return;
      if (!token) {
        // 刷新失败已由 refreshAccessTokenForStream 提示「登录已过期，请重新登录」
        stopStream('login-expired');
        return;
      }
      if (reconnectAttempts >= STREAM_MAX_RECONNECT_ATTEMPTS) {
        stopStream();
        return;
      }
      reconnectAttempts++;
      createFetchSSE();
    };

    // 使用fetch API替换EventSource以支持自定义headers
    const createFetchSSE = async () => {
      try {
        abortController = new AbortController();

        const headers: Record<string, string> = {
          Accept: 'text/event-stream',
          'Cache-Control': 'no-cache',
        };

        const currentToken = accessStore.accessToken;
        if (currentToken) {
          headers['Authorization'] = `Bearer ${currentToken}`;
        }

        const response = await fetch(url, {
          method: 'GET',
          headers,
          signal: abortController.signal,
        });

        if (response.status === 401) {
          await response.body?.cancel().catch(() => {});
          await recoverFromUnauthorized();
          return;
        }

        if (!response.ok) {
          const errorText = await response.text().catch(() => 'Unknown error');

          throw new Error(
            `HTTP error! status: ${response.status}, message: ${errorText}`,
          );
        }

        if (!response.body) {
          throw new Error('Response body is null');
        }
        reconnectAttempts = 0;
        tokenRefreshed = false;
        onOpen?.();

        reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
          if (isManualClose) {
            break;
          }

          let readResult;
          try {
            readResult = await reader.read();
          } catch (readError: any) {
            if (readError?.name === 'AbortError') {
              break;
            }
            throw readError;
          }

          const { done, value } = readResult;

          if (done) {
            scheduleReconnect();
            break;
          }

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          let currentEvent = '';
          for (const line of lines) {
            const trimmedLine = line.trim();

            if (trimmedLine.startsWith('event:')) {
              currentEvent = trimmedLine.substring(6).trim();
              continue;
            }

            if (trimmedLine.startsWith('data:')) {
              const data = trimmedLine.substring(5).trim();

              if (data === '[DONE]') {
                onClose?.();
                return;
              }

              if (currentEvent === 'message' || currentEvent === '') {
                if (data && data.length > 0) {
                  onMessage(data);
                }
              }
            }

            if (trimmedLine === '') {
              currentEvent = '';
            }
          }
        }
      } catch (error: any) {
        if (!isManualClose) {
        }

        if (error?.name === 'AbortError') {
          isManualClose = true;
          onClose?.();
        } else if (!isManualClose) {
          // SSE连接错误，准备重连
          onError?.(new Event('error'));
          scheduleReconnect();
        }
      } finally {
        if (reader) {
          try {
            await reader.cancel().catch(() => {});
          } catch {
            // 忽略cancel错误
          }
          reader = null;
        }
      }
    };

    // 启动连接
    createFetchSSE();

    // 创建兼容EventSource接口的对象
    const eventSource = {
      readyState: 1, // OPEN
      close: async () => {
        isManualClose = true;

        if (reconnectTimeoutId) {
          clearTimeout(reconnectTimeoutId);
          reconnectTimeoutId = null;
        }

        if (abortController) {
          try {
            abortController.abort();
          } catch {}
        }

        if (reader) {
          try {
            await reader.cancel().catch(() => {});
            reader = null;
          } catch {}
        }

        try {
          onClose?.();
        } catch {}
      },
    } as unknown as EventSource;

    return {
      eventSource: eventSource as unknown as EventSource,
      close: () => {
        Promise.resolve(eventSource.close()).catch((_error) => {
          // Ignore close errors
        });
      },
    };
  };

  // 开始SSE实时日志流
  const startLogsStream = () => {
    if (!currentOperationPod.value || !logsFormModel.value.container) return;

    // 先停止之前的连接
    stopLogsStream();

    try {
      isLogsStreaming.value = true;
      logsLoading.value = true;

      const params: GetPodLogsReq = {
        cluster_id: currentOperationPod.value.cluster_id,
        namespace: currentOperationPod.value.namespace,
        pod_name: currentOperationPod.value.name,
        container: logsFormModel.value.container,
        follow: true, // SSE模式下强制为true
        previous: logsFormModel.value.previous,
        since_seconds: logsFormModel.value.since_seconds || undefined,
        since_time: logsFormModel.value.since_time || undefined,
        timestamps: logsFormModel.value.timestamps,
        tail_lines: logsFormModel.value.tail_lines || undefined,
        limit_bytes: logsFormModel.value.limit_bytes || undefined,
      };

      logsStreamConnection.value = streamK8sPodLogs(
        params,
        // onMessage - 接收到新的日志数据
        (data: string) => {
          if (data && data.trim()) {
            // 确保每行日志都有换行符
            const logLine = data.endsWith('\n') ? data : data + '\n';
            podLogs.value += logLine;

            // 自动滚动到底部
            setTimeout(() => {
              const logsContainer = document.querySelector('.logs-content');
              if (logsContainer) {
                logsContainer.scrollTop = logsContainer.scrollHeight;
              }
            }, 10);

            // 输出到控制台用于调试
          }
        },
        // onError - 连接错误（支持自动重连，减少用户干扰）
        // onError - 连接错误（支持自动重连，减少用户干扰）
        (_error: Event) => {
          // 现在有自动重连机制，不需要复杂的错误处理
          // 只在控制台记录，避免频繁打扰用户
        },
        // onOpen - 连接建立
        () => {
          message.success('实时日志连接已建立，支持自动重连');
          logsLoading.value = false;

          // 确保状态正确设置
          isLogsStreaming.value = true;
        },
        // onClose - 连接关闭（只有在真正结束时才调用）
        (reason?: StreamCloseReason) => {
          isLogsStreaming.value = false;
          logsLoading.value = false;
          logsStreamConnection.value = null;

          // 只有在模态框还开着时才提示最终关闭；登录过期只保留「登录已过期，请重新登录」
          if (isLogsModalVisible.value && reason !== 'login-expired') {
            message.info('📡 实时日志连接已停止');
          }
        },
      );
    } catch (error) {
      let errorMessage = '启动实时日志失败';

      if (error instanceof Error) {
        if (error.message.includes('400')) {
          errorMessage = '请求参数错误，请检查Pod名称和容器名称是否正确';
        } else if (error.message.includes('404')) {
          errorMessage = 'Pod或容器未找到，请检查名称是否正确';
        } else if (error.message.includes('403')) {
          errorMessage = '权限不足，请检查访问权限';
        } else if (error.message.includes('500')) {
          errorMessage = '服务器内部错误，请稍后重试或联系管理员';
        } else if (
          error.message.includes('network') ||
          error.message.includes('fetch')
        ) {
          errorMessage = '网络连接失败，请检查网络连接和服务器地址';
        }
      }

      message.error(errorMessage);
      isLogsStreaming.value = false;
      logsLoading.value = false;
    }
  };

  // 停止SSE实时日志流
  const stopLogsStream = () => {
    try {
      if (logsStreamConnection.value) {
        logsStreamConnection.value.close();
        logsStreamConnection.value = null;
      }
    } catch {
    } finally {
      // 确保状态被正确重置
      isLogsStreaming.value = false;
      logsLoading.value = false;
      message.info('实时日志流已停止');
    }
  };

  // 执行命令 - 使用WebSocket终端
  const showExecModal = async (record: K8sPod) => {
    const clusterId = validateClusterId(record);
    if (!clusterId) return;

    try {
      currentOperationPod.value = { ...record, cluster_id: clusterId };
      // 先获取容器列表
      const containersParams: GetPodContainersReq = {
        cluster_id: clusterId,
        namespace: record.namespace,
        pod_name: record.name,
      };
      const containersRes = await getK8sPodContainers(containersParams);
      podContainers.value = containersRes?.items || [];

      execFormModel.value = {
        container:
          podContainers.value.length > 0
            ? podContainers.value[0]?.name || ''
            : '',
        shell: '/bin/sh',
      };
      isExecModalVisible.value = true;
    } catch (error) {
      if (shouldNotifyPageError(error)) message.error('获取 Pod 容器列表失败');
    }
  };

  const closeExecModal = () => {
    // 断开终端连接
    disconnectTerminal();

    isExecModalVisible.value = false;
    currentOperationPod.value = null;
    podContainers.value = [];

    // 重置表单
    execFormModel.value = {
      container: '',
      shell: '/bin/sh',
    };
  };

  // 初始化终端
  const initializeTerminal = async () => {
    try {
      // 等待DOM更新
      await nextTick();

      const terminalElement = document.getElementById('terminal-container');
      if (!terminalElement) {
        throw new Error('终端容器元素未找到');
      }

      // 清理之前的终端
      if (terminal.value) {
        try {
          // 先清理addon，避免dispose错误
          if (fitAddon.value) {
            // FitAddon没有dispose方法，直接设置为null
            fitAddon.value = null;
          }

          // 安全地dispose terminal
          terminal.value.dispose();
          terminal.value = null;
        } catch (error) {
          // 捕获特定的addon dispose错误
          if (
            error instanceof Error &&
            error.message.includes(
              'Could not dispose an addon that has not been loaded',
            )
          ) {
          } else {
          }
          // 强制重置状态
          terminal.value = null;
          fitAddon.value = null;
        }
      }

      // 创建新的终端实例
      terminal.value = new Terminal({
        cursorBlink: true,
        fontSize: 14,
        fontFamily: 'Monaco, Menlo, "Ubuntu Mono", monospace',
        theme: {
          background: '#1e1e1e',
          foreground: '#d4d4d4',
          cursor: '#d4d4d4',
          black: '#000000',
          red: '#cd3131',
          green: '#0dbc79',
          yellow: '#e5e510',
          blue: '#2472c8',
          magenta: '#bc3fbc',
          cyan: '#11a8cd',
          white: '#e5e5e5',
          brightBlack: '#666666',
          brightRed: '#f14c4c',
          brightGreen: '#23d18b',
          brightYellow: '#f5f543',
          brightBlue: '#3b8eea',
          brightMagenta: '#d670d6',
          brightCyan: '#29b8db',
          brightWhite: '#e5e5e5',
        },
        cols: 120,
        rows: 30,
        scrollback: 1000,
        convertEol: true,
      });

      // 添加插件
      try {
        fitAddon.value = new FitAddon();
        terminal.value.loadAddon(fitAddon.value);

        // 安全加载WebLinksAddon
        const webLinksAddon = new WebLinksAddon();
        terminal.value.loadAddon(webLinksAddon);
      } catch {
        // 如果插件加载失败，继续初始化终端
      }

      // 将终端挂载到DOM
      terminal.value.open(terminalElement);

      // 自适应大小
      if (fitAddon.value) {
        fitAddon.value.fit();
      }

      // 监听窗口大小变化
      terminalResizeObserver?.disconnect();
      terminalResizeObserver = new ResizeObserver(() => {
        if (fitAddon.value && terminal.value) {
          fitAddon.value.fit();
        }
      });
      terminalResizeObserver.observe(terminalElement);

      return true;
    } catch (error) {
      if (shouldNotifyPageError(error)) message.error('初始化终端失败');
      return false;
    }
  };

  // WebSocket终端连接 - 移动到Pod.ts中的业务逻辑
  const execK8sPodWebSocket = (
    params: PodExecReq,
    onMessage: (data: string) => void,
    onError?: (error: Event) => void,
    onOpen?: () => void,
    onClose?: (reason?: StreamCloseReason) => void,
    onReconnect?: () => void,
  ) => {
    // 获取认证token
    const accessStore = useAccessStore();
    const token = accessStore.accessToken;

    if (!token) {
      onError?.(new Event('auth_error'));
      return {
        sendCommand: () => {
          // WebSocket未连接，无法发送命令
        },
        close: () => {
          // 空操作，因为没有连接可关闭
        },
        get readyState() {
          return WebSocket.CLOSED;
        },
      };
    }

    const { apiURL } = useAppConfig(import.meta.env, import.meta.env.PROD);
    const url = new URL(
      websocketUrl(
        apiURL,
        `k8s/pod/${params.cluster_id}/${encodeURIComponent(params.namespace)}/${encodeURIComponent(params.pod_name)}/containers/${encodeURIComponent(params.container)}/exec`,
        window.location.origin,
      ),
    );

    url.searchParams.set(
      'shell',
      (params.shell || 'sh').replace(/^\/bin\//, ''),
    );

    let socket: WebSocket | null = null;
    let resizeSubscription: { dispose: () => void } | undefined;
    let isManualClose = false;
    let reconnectAttempts = 0;
    let reconnectTimeoutId: NodeJS.Timeout | null = null;
    // 本轮断线（直到下次连上）是否已刷新过令牌：只刷新一次
    let tokenRefreshed = false;
    // 复审 v4 P2-C：连上之后收到 4401 是否已刷新过令牌。单独计数，不在 onopen 里清零，
    // 否则「连上 → 4401 → 刷新 → 连上（清零）→ 4401」会无限刷新重连
    // 复审 P3-A：重连后连接稳定保持满 STREAM_UNAUTHORIZED_REFRESH_RESET_MS 才清零（见 onopen）
    let unauthorizedAfterOpenRefreshed = false;
    // 复审 P3-A：「稳定满 5 分钟后清零」计时器；断开 / onclose、stopReconnect、close、重新 connect 前都会清掉
    let unauthorizedRefreshResetTimeoutId: null | ReturnType<
      typeof setTimeout
    > = null;
    const clearUnauthorizedRefreshResetTimer = () => {
      if (unauthorizedRefreshResetTimeoutId) {
        clearTimeout(unauthorizedRefreshResetTimeoutId);
        unauthorizedRefreshResetTimeoutId = null;
      }
    };
    // 握手阶段的 onerror 先暂存，等刷新结果出来再决定要不要报给调用方（刷新失败只提示登录过期）
    let pendingHandshakeError: Event | null = null;

    const stopReconnect = (reason?: StreamCloseReason) => {
      isManualClose = true;
      pendingHandshakeError = null;
      clearUnauthorizedRefreshResetTimer();
      if (reconnectTimeoutId) {
        clearTimeout(reconnectTimeoutId);
        reconnectTimeoutId = null;
      }
      onClose?.(reason);
    };

    const flushHandshakeError = () => {
      const error = pendingHandshakeError;
      pendingHandshakeError = null;
      if (error) onError?.(error);
    };

    const scheduleReconnect = () => {
      if (isManualClose || reconnectAttempts >= STREAM_MAX_RECONNECT_ATTEMPTS) {
        stopReconnect();
        return;
      }
      onReconnect?.();

      reconnectAttempts++;
      reconnectTimeoutId = setTimeout(() => {
        connect();
      }, streamReconnectDelay(reconnectAttempts));
    };

    // 握手失败（浏览器拿不到 HTTP 状态）或 4401：先走统一刷新（单飞）再重连；
    // 刷新失败则停止重连并提示重新登录；本轮已刷新过则按退避重连，4401 直接停止
    // 复审 v4 P3-5：握手失败（!opened）不一定是令牌问题——浏览器拿不到握手的 HTTP 状态，
    // 网络断开、网关/后端不可用、Pod 或容器不存在、403 等都会表现为同样的失败。这里先刷新一次令牌
    // 只是兜底（刷新成功但仍失败时按退避重连，最多 STREAM_MAX_RECONNECT_ATTEMPTS 次），并不说明原因是令牌
    const recoverFromHandshakeFailure = async (code: number) => {
      if (tokenRefreshed) {
        if (code === 4401) {
          stopReconnect('login-expired');
          await notifyStreamLoginExpired();
          return;
        }
        flushHandshakeError();
        scheduleReconnect();
        return;
      }
      tokenRefreshed = true;
      const token = await refreshAccessTokenForStream();
      if (isManualClose) return;
      if (!token) {
        // 刷新失败已提示「登录已过期，请重新登录」，不再报连接错误
        stopReconnect('login-expired');
        return;
      }
      flushHandshakeError();
      if (reconnectAttempts >= STREAM_MAX_RECONNECT_ATTEMPTS) {
        stopReconnect();
        return;
      }
      onReconnect?.();
      reconnectAttempts++;
      connect();
    };

    // 复审 v4 P2-C：连上之后收到 4401（令牌在会话中失效）：只刷新一次并重连；
    // 重连后再次收到 4401 就停止重连并提示重新登录（这个标记不随 onopen 清零）
    // 复审 P3-A：重连后连接稳定满 5 分钟会清零，之后的 4401 可以再刷新一次
    const recoverFromUnauthorizedAfterOpen = async () => {
      if (unauthorizedAfterOpenRefreshed) {
        stopReconnect('login-expired');
        await notifyStreamLoginExpired();
        return;
      }
      unauthorizedAfterOpenRefreshed = true;
      tokenRefreshed = true;
      const token = await refreshAccessTokenForStream();
      if (isManualClose) return;
      if (!token) {
        stopReconnect('login-expired');
        return;
      }
      if (reconnectAttempts >= STREAM_MAX_RECONNECT_ATTEMPTS) {
        stopReconnect();
        return;
      }
      onReconnect?.();
      reconnectAttempts++;
      connect();
    };

    const connect = () => {
      clearUnauthorizedRefreshResetTimer();
      try {
        // 清理之前的连接
        if (socket) {
          socket.close();
          socket = null;
        }

        // 创建WebSocket连接（每次重连都读最新的令牌）
        const currentToken = accessStore.accessToken;
        if (!currentToken) {
          stopReconnect();
          return;
        }
        socket = new WebSocket(
          url.toString(),
          websocketProtocols(currentToken),
        );

        const ownedSocket = socket;
        let opened = false;
        socket.onopen = () => {
          if (socket !== ownedSocket) return;
          opened = true;
          reconnectAttempts = 0; // 重置重连计数
          tokenRefreshed = false;
          // 复审 P3-A：4401 刷新后重连上：稳定满 5 分钟才清零，期间断开会清掉计时器
          clearUnauthorizedRefreshResetTimer();
          if (unauthorizedAfterOpenRefreshed) {
            unauthorizedRefreshResetTimeoutId = setTimeout(() => {
              unauthorizedRefreshResetTimeoutId = null;
              if (socket === ownedSocket && !isManualClose) {
                unauthorizedAfterOpenRefreshed = false;
              }
            }, STREAM_UNAUTHORIZED_REFRESH_RESET_MS);
          }

          const sendResize = (cols: number, rows: number) => {
            if (
              socket === ownedSocket &&
              ownedSocket.readyState === WebSocket.OPEN
            ) {
              ownedSocket.send(
                JSON.stringify({
                  op: 'resize',
                  col_size: cols,
                  row_size: rows,
                }),
              );
            }
          };
          resizeSubscription?.dispose();
          sendResize(terminal.value?.cols || 120, terminal.value?.rows || 30);
          resizeSubscription = terminal.value?.onResize(({ cols, rows }) =>
            sendResize(cols, rows),
          );

          onOpen?.();
        };

        socket.onmessage = (event) => {
          if (socket !== ownedSocket) return;
          try {
            const data = event.data;
            if (typeof data === 'string') {
              // 尝试解析JSON格式的响应
              try {
                const parsed = JSON.parse(data);
                // 如果是标准的终端输出格式
                if (parsed.op === 'stdout' && parsed.data) {
                  onMessage(parsed.data);
                } else {
                  // 如果不是标准格式，直接传递原始数据
                  onMessage(data);
                }
              } catch {
                // 如果不是JSON格式，直接传递原始数据
                onMessage(data);
              }
            }
          } catch {}
        };

        socket.onerror = (error) => {
          if (socket !== ownedSocket) return;
          if (!opened) {
            // 握手失败：onclose 里先刷新令牌，再决定是否报错
            pendingHandshakeError = error;
            return;
          }
          onError?.(error);
        };

        socket.onclose = (event) => {
          if (socket !== ownedSocket) return;
          clearUnauthorizedRefreshResetTimer();
          resizeSubscription?.dispose();
          resizeSubscription = undefined;
          socket = null;

          // 根据关闭代码提供更详细的错误信息
          if (event.code === 1006) {
          } else if (event.code === 1000) {
          } else if (event.code === 1003) {
          } else if (event.code === 4401) {
          }

          if (isManualClose) {
            pendingHandshakeError = null;
            onClose?.();
          } else if (!opened) {
            // 握手失败（含握手阶段的 4401）：先刷新令牌再重连，见 recoverFromHandshakeFailure 的说明（P3-5）
            void recoverFromHandshakeFailure(event.code);
          } else if (event.code === 4401) {
            // 连上之后令牌失效（P2-C）
            void recoverFromUnauthorizedAfterOpen();
          } else if (!event.wasClean) {
            // 非正常关闭且不是手动关闭，尝试重连
            scheduleReconnect();
          } else {
            onClose?.();
          }
        };
      } catch {
        onError?.(new Event('connection_failed'));
      }
    };

    // 发送命令到容器
    const sendCommand = (command: string) => {
      if (socket && socket.readyState === WebSocket.OPEN) {
        for (const chunk of utf8Chunks(command)) {
          socket.send(JSON.stringify({ op: 'stdin', data: chunk }));
        }
      } else {
      }
    };

    // 手动关闭连接
    const close = () => {
      isManualClose = true;
      clearUnauthorizedRefreshResetTimer();
      resizeSubscription?.dispose();
      resizeSubscription = undefined;

      // 清理重连定时器
      if (reconnectTimeoutId) {
        clearTimeout(reconnectTimeoutId);
        reconnectTimeoutId = null;
      }

      // 关闭WebSocket连接
      if (socket) {
        socket.close();
        socket = null;
      }
    };

    // 启动连接
    connect();

    return {
      sendCommand,
      close,
      get readyState() {
        return socket?.readyState;
      },
    };
  };

  // 连接到Pod终端
  const connectToTerminal = async () => {
    if (!execFormRef.value || !currentOperationPod.value) return;

    try {
      await execFormRef.value.validate();
      terminalLoading.value = true;

      // 初始化终端
      const terminalInitialized = await initializeTerminal();
      if (!terminalInitialized) {
        terminalLoading.value = false;
        return;
      }

      const params: PodExecReq = {
        cluster_id: currentOperationPod.value.cluster_id,
        namespace: currentOperationPod.value.namespace,
        pod_name: currentOperationPod.value.name,
        container: execFormModel.value.container,
        shell: execFormModel.value.shell,
      };

      // 「终端连接出现问题」每次连接流程（本次 connectToTerminal，含自动重连）只提示一次
      let terminalErrorNotified = false;

      // 建立WebSocket连接
      terminalConnection.value = execK8sPodWebSocket(
        params,
        // onMessage - 接收终端输出
        (data: string) => {
          if (terminal.value) {
            terminal.value.write(data);
          }
        },
        // onError - 连接错误
        (_error: Event) => {
          // Error occurred in terminal connection
          if (!terminalErrorNotified) {
            terminalErrorNotified = true;
            message.error('终端连接出现问题');
          }
          isTerminalConnected.value = false;
          terminalLoading.value = false;
        },
        // onOpen - 连接建立
        () => {
          message.success('终端连接已建立');
          isTerminalConnected.value = true;
          terminalLoading.value = false;

          // 监听终端输入
          if (terminal.value && terminalConnection.value) {
            terminalInputSubscription?.dispose();
            terminalInputSubscription = terminal.value.onData((data) => {
              terminalConnection.value?.sendCommand(data);
            });
          }

          // 发送初始化信息
          if (terminal.value) {
            terminal.value.writeln(
              `\r\n连接到 Pod: ${currentOperationPod.value?.name}`,
            );
            terminal.value.writeln(`容器: ${execFormModel.value.container}`);
            terminal.value.writeln(`Shell: ${execFormModel.value.shell}`);
            terminal.value.writeln('='.repeat(50));
          }
        },
        // onClose - 连接关闭
        (reason?: StreamCloseReason) => {
          isTerminalConnected.value = false;
          terminalLoading.value = false;

          if (terminal.value && isExecModalVisible.value) {
            terminal.value.writeln('\r\n\r\n连接已断开');
            // 登录过期只保留「登录已过期，请重新登录」
            if (reason !== 'login-expired') message.info('终端连接已断开');
          }
        },
        () => {
          isTerminalConnected.value = false;
          terminalLoading.value = true;
        },
      );
    } catch (error: unknown) {
      if (error && typeof error === 'object' && 'errorFields' in error) {
        if (shouldNotifyPageError(error))
          message.warning('请检查表单填写是否正确');
        return;
      }
      if (shouldNotifyPageError(error)) message.error('建立终端连接失败');

      isTerminalConnected.value = false;
    } finally {
      terminalLoading.value = false;
    }
  };

  // 断开终端连接
  const disconnectTerminal = () => {
    terminalResizeObserver?.disconnect();
    terminalResizeObserver = undefined;
    terminalInputSubscription?.dispose();
    terminalInputSubscription = undefined;
    try {
      // 关闭WebSocket连接
      if (terminalConnection.value) {
        terminalConnection.value.close();
        terminalConnection.value = null;
      }

      // 清理终端实例
      if (terminal.value) {
        try {
          // 先清理addons，避免dispose错误
          if (fitAddon.value) {
            // FitAddon没有dispose方法，直接设置为null
            fitAddon.value = null;
          }

          // 安全地dispose terminal，捕获addon相关错误
          terminal.value.dispose();
          terminal.value = null;
        } catch (error) {
          // 捕获特定的addon dispose错误
          if (
            error instanceof Error &&
            error.message.includes(
              'Could not dispose an addon that has not been loaded',
            )
          ) {
          } else {
          }
          // 强制重置状态，无论是否有错误
          terminal.value = null;
          fitAddon.value = null;
        }
      }

      // 确保fitAddon也被清理
      if (fitAddon.value) {
        fitAddon.value = null;
      }
    } catch {
    } finally {
      // 确保状态被正确重置
      isTerminalConnected.value = false;
      terminalLoading.value = false;
    }
  };

  // 保留原有的简单执行命令函数作为备用
  const executePodCommand = async () => {
    if (!execFormRef.value || !currentOperationPod.value) return;

    try {
      await execFormRef.value.validate();
      submitLoading.value = true;

      const params: PodExecReq = {
        cluster_id: currentOperationPod.value.cluster_id,
        namespace: currentOperationPod.value.namespace,
        pod_name: currentOperationPod.value.name,
        container: execFormModel.value.container,
        shell: execFormModel.value.shell,
      };
      await execK8sPod(params);
      message.success('命令执行成功');
      isExecModalVisible.value = false;
    } catch (error: unknown) {
      if (error && typeof error === 'object' && 'errorFields' in error) {
        if (shouldNotifyPageError(error))
          message.warning('请检查表单填写是否正确');
        return;
      }
      if (shouldNotifyPageError(error)) message.error('命令执行失败');
    } finally {
      submitLoading.value = false;
    }
  };

  // 端口转发
  const showPortForwardModal = (record: K8sPod) => {
    const clusterId = validateClusterId(record);
    if (!clusterId) return;

    currentOperationPod.value = { ...record, cluster_id: clusterId };
    portForwardFormModel.value = {
      ports: [{ local_port: 0, remote_port: 0 }],
    };
    isPortForwardModalVisible.value = true;
  };

  const closePortForwardModal = () => {
    isPortForwardModalVisible.value = false;
    currentOperationPod.value = null;
  };

  const submitPortForward = async () => {
    if (!currentOperationPod.value) return;

    try {
      submitLoading.value = true;
      const params: PodPortForwardReq = {
        cluster_id: currentOperationPod.value.cluster_id,
        namespace: currentOperationPod.value.namespace,
        pod_name: currentOperationPod.value.name,
        ports: portForwardFormModel.value.ports.filter(
          (p) => p.local_port > 0 && p.remote_port > 0,
        ),
      };
      await forwardK8sPodPort(params);
      message.success('端口转发设置成功');
      isPortForwardModalVisible.value = false;
    } catch (error) {
      if (shouldNotifyPageError(error)) message.error('端口转发设置失败');
    } finally {
      submitLoading.value = false;
    }
  };

  // 文件管理
  const showFileManagerModal = async (record: K8sPod) => {
    const clusterId = validateClusterId(record);
    if (!clusterId) return;

    currentOperationPod.value = { ...record, cluster_id: clusterId };

    try {
      // 获取Pod容器信息
      const containersParams: GetPodContainersReq = {
        cluster_id: clusterId,
        namespace: record.namespace,
        pod_name: record.name,
      };
      const containersRes = await getK8sPodContainers(containersParams);
      podContainers.value = containersRes?.items || [];

      isFileManagerModalVisible.value = true;
    } catch (error) {
      if (shouldNotifyPageError(error)) message.error('获取容器信息失败');
    }
  };

  const closeFileManagerModal = () => {
    isFileManagerModalVisible.value = false;
    currentOperationPod.value = null;
  };

  // 文件上传
  const uploadFile = async (
    file: File,
    filePath: string,
    container: string,
  ) => {
    if (!currentOperationPod.value) return;

    try {
      const params: PodFileUploadReq = {
        cluster_id: currentOperationPod.value.cluster_id,
        namespace: currentOperationPod.value.namespace,
        pod_name: currentOperationPod.value.name,
        container: container,
        file_path: filePath,
      };
      await uploadK8sPodFile(params, file);
      message.success('文件上传成功');
    } catch (error) {
      if (shouldNotifyPageError(error)) message.error('文件上传失败');
    }
  };

  // 文件下载
  const downloadFile = async (filePath: string, container: string) => {
    if (!currentOperationPod.value) {
      message.error('未选择Pod');
      return;
    }

    try {
      const params: PodFileDownloadReq = {
        cluster_id: currentOperationPod.value.cluster_id,
        namespace: currentOperationPod.value.namespace,
        pod_name: currentOperationPod.value.name,
        container: container,
        file_path: filePath,
      };

      // 调用API下载文件
      const res = await downloadK8sPodFile(params);

      // 检查响应类型
      if (!res) {
        throw new Error('服务器返回空响应');
      }

      // 检查响应数据
      let blob: Blob;
      if (res instanceof Blob) {
        blob = res;
      } else if (res.data instanceof Blob) {
        blob = res.data;
      } else if (typeof res === 'object' && res.data) {
        // 如果响应包装在data字段中
        blob = new Blob([res.data], { type: 'application/octet-stream' });
      } else {
        // 其他情况，直接创建Blob
        blob = new Blob([res], { type: 'application/octet-stream' });
      }

      // 检查Blob大小
      if (blob.size === 0) {
        throw new Error('下载的文件为空或文件不存在');
      }

      // 处理文件下载
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;

      // 获取文件名
      const fileName = filePath.split('/').pop() || 'download';
      link.setAttribute('download', fileName);

      // 添加到DOM并触发下载
      document.body.appendChild(link);
      link.click();

      // 清理
      setTimeout(() => {
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
      }, 100);

      message.success(`文件 "${fileName}" 下载成功`);
    } catch (error: any) {
      console.error('文件下载错误详情:', {
        message: error?.message,
        response: error?.response,
        status: error?.response?.status,
        statusText: error?.response?.statusText,
        data: error?.response?.data,
        config: error?.config,
        stack: error?.stack,
      });

      // 更详细的错误处理
      let errorMessage = '文件下载失败';
      if (error?.response?.status) {
        if (error.response.status === 404) {
          errorMessage = '文件不存在或路径错误';
        } else if (error.response.status === 403) {
          errorMessage = '权限不足，无法访问该文件';
        } else if (error.response.status === 500) {
          errorMessage = '服务器内部错误';
        } else {
          errorMessage = `下载失败 (${error.response.status}): ${error.response.statusText || error.message}`;
        }
      } else if (error?.response?.data?.message) {
        errorMessage = `下载失败: ${error.response.data.message}`;
      } else if (error?.message) {
        errorMessage = `下载失败: ${error.message}`;
      } else if (typeof error === 'string') {
        errorMessage = `下载失败: ${error}`;
      }

      if (shouldNotifyPageError(error)) message.error(errorMessage);
    }
  };

  // 根据节点获取Pod
  const fetchPodsByNode = async (nodeName: string) => {
    if (!filterClusterId.value) return;

    try {
      loading.value = true;
      const params: GetPodsByNodeReq = {
        cluster_id: filterClusterId.value,
        node_name: nodeName,
      };
      const res = await getK8sPodsByNode(params);
      pods.value = res?.items || [];
      total.value = res?.total || 0;
    } catch (error) {
      if (shouldNotifyPageError(error)) message.error('获取节点Pod失败');
    } finally {
      loading.value = false;
    }
  };

  // 标签过滤管理
  const addFilterLabel = (key: string, value: string) => {
    if (key && key.trim()) {
      filterLabels.value[key.trim()] = value;
      currentPage.value = 1;
      fetchPods();
    }
  };

  const removeFilterLabel = (key: string) => {
    delete filterLabels.value[key];
    currentPage.value = 1;
    fetchPods();
  };

  const clearFilterLabels = () => {
    filterLabels.value = {};
    currentPage.value = 1;
    fetchPods();
  };

  // 批量操作
  const batchOperation = (operation: string) => {
    if (!selectedRows.value.length) return;

    Modal.confirm({
      title: `批量${operation}`,
      content: `确定要对选中的 ${selectedRows.value.length} 个 Pod 执行${operation}操作吗？`,
      okText: '确认执行',
      okType: operation === '删除' ? 'danger' : 'primary',
      cancelText: '取消',
      centered: true,
      onOk: async () => {
        try {
          if (operation === '删除') {
            for (const pod of selectedRows.value) {
              const clusterId = pod.cluster_id || filterClusterId.value;
              if (!clusterId) {
                message.error(`Pod "${pod.name}" 缺少有效的集群ID，跳过操作`);
                continue;
              }

              const params: DeletePodReq = {
                cluster_id: clusterId,
                namespace: pod.namespace,
                name: pod.name,
              };
              await deleteK8sPod(params);
            }
          }

          message.success(`批量${operation}操作已完成`);
          selectedRowKeys.value = [];
          selectedRows.value = [];
          await fetchPods();
        } catch (error) {
          if (shouldNotifyPageError(error))
            message.error(`批量${operation}失败`);
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
    await fetchPods();
  };

  // 表单字段操作
  const addContainerField = () => {
    createFormModel.value.containers.push({
      name: '',
      image: '',
      command: [],
      args: [],
      envs: [],
      ports: [],
      resources: {
        requests: { cpu: '', memory: '' },
        limits: { cpu: '', memory: '' },
      },
      volume_mounts: [],
      image_pull_policy: 'IfNotPresent',
    });
  };

  const removeContainerField = (index: number) => {
    if (createFormModel.value.containers.length > 1) {
      createFormModel.value.containers.splice(index, 1);
    }
  };

  const addInitContainerField = () => {
    createFormModel.value.init_containers.push({
      name: '',
      image: '',
      command: [],
      args: [],
      envs: [],
      ports: [],
      resources: {
        requests: { cpu: '', memory: '' },
        limits: { cpu: '', memory: '' },
      },
      volume_mounts: [],
      image_pull_policy: 'IfNotPresent',
    });
  };

  const removeInitContainerField = (index: number) => {
    createFormModel.value.init_containers.splice(index, 1);
  };

  const addEnvField = (containerIndex: number, isInit = false) => {
    const containers = isInit
      ? createFormModel.value.init_containers
      : createFormModel.value.containers;
    if (containers[containerIndex]) {
      containers[containerIndex].envs = containers[containerIndex].envs || [];
      containers[containerIndex].envs?.push({ name: '', value: '' });
    }
  };

  const removeEnvField = (
    containerIndex: number,
    envIndex: number,
    isInit = false,
  ) => {
    const containers = isInit
      ? createFormModel.value.init_containers
      : createFormModel.value.containers;
    containers[containerIndex]?.envs?.splice(envIndex, 1);
  };

  const addPortField = (containerIndex: number, isInit = false) => {
    const containers = isInit
      ? createFormModel.value.init_containers
      : createFormModel.value.containers;
    if (containers[containerIndex]) {
      containers[containerIndex].ports = containers[containerIndex].ports || [];
      containers[containerIndex].ports?.push({
        name: '',
        container_port: 0,
        protocol: 'TCP',
      });
    }
  };

  const removePortField = (
    containerIndex: number,
    portIndex: number,
    isInit = false,
  ) => {
    const containers = isInit
      ? createFormModel.value.init_containers
      : createFormModel.value.containers;
    containers[containerIndex]?.ports?.splice(portIndex, 1);
  };

  const addVolumeMountField = (containerIndex: number, isInit = false) => {
    const containers = isInit
      ? createFormModel.value.init_containers
      : createFormModel.value.containers;
    if (containers[containerIndex]) {
      containers[containerIndex].volume_mounts =
        containers[containerIndex].volume_mounts || [];
      containers[containerIndex].volume_mounts?.push({
        name: '',
        mount_path: '',
        read_only: false,
        sub_path: '',
      });
    }
  };

  const removeVolumeMountField = (
    containerIndex: number,
    mountIndex: number,
    isInit = false,
  ) => {
    const containers = isInit
      ? createFormModel.value.init_containers
      : createFormModel.value.containers;
    containers[containerIndex]?.volume_mounts?.splice(mountIndex, 1);
  };

  const addPortForwardField = () => {
    portForwardFormModel.value.ports.push({ local_port: 0, remote_port: 0 });
  };

  const removePortForwardField = (index: number) => {
    if (portForwardFormModel.value.ports.length > 1) {
      portForwardFormModel.value.ports.splice(index, 1);
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

  const addNodeSelectorField = () => {
    // 节点选择器字段通过模态框单独管理
  };

  const removeNodeSelectorField = (key: string) => {
    delete createFormModel.value.node_selector[key];
  };

  if (getCurrentScope()) {
    onScopeDispose(() => {
      disconnectTerminal();
      logsStreamConnection.value?.close();
      logsStreamConnection.value = null;
      isLogsStreaming.value = false;
    });
  }

  return {
    // 日志 SSE / 终端 WS 连接（供令牌刷新重连测试使用）
    execK8sPodWebSocket,
    streamK8sPodLogs,
    // state
    loadError,
    clustersError,
    namespacesError,
    pods,
    clusters,
    namespaces,
    nodes,
    loading,
    clustersLoading,
    namespacesLoading,
    searchText,
    filterStatus,
    filterPhase,
    filterClusterId,
    filterNamespace,
    filterNodeName,
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
    yamlFormRef,
    createYamlFormRef,
    execFormRef,

    // modal state
    isCreateModalVisible,
    isCreateYamlModalVisible,
    isEditModalVisible,
    isDetailModalVisible,
    isYamlModalVisible,
    isLogsModalVisible,
    isExecModalVisible,
    isPortForwardModalVisible,
    isContainersModalVisible,
    isFileManagerModalVisible,
    submitLoading,
    detailLoading,
    logsLoading,
    isLogsStreaming,
    logsStreamConnection,

    // 终端状态
    isTerminalConnected,
    terminalLoading,
    terminal,
    terminalConnection,
    fitAddon,

    // operation targets
    currentOperationPod,
    currentPodDetail,
    currentYamlContent,
    podLogs,
    podContainers,
    selectedContainer,

    // form models
    createFormModel,
    editFormModel,
    yamlFormModel,
    createYamlFormModel,
    logsFormModel,
    execFormModel,
    portForwardFormModel,

    // form rules
    createFormRules,
    yamlFormRules,
    createYamlFormRules,
    execFormRules,

    // computed
    filteredPods,
    rowSelection,

    // helpers
    validateClusterId,
    getEnvText,
    getStatusText,
    getStatusColor,
    getPhaseText,
    recordToKeyValueList,
    keyValueListToRecord,
    parseJsonField,

    // operations
    fetchClusters,
    fetchNamespaces,
    fetchPods,
    clearPods,
    clearNamespaces,
    loadMoreClusters,
    loadMoreNamespaces,
    fetchPodsByNode,

    // detail operations
    showPodDetail,
    closeDetailModal,

    // YAML operations
    showYamlModal,
    closeYamlModal,
    submitYamlForm,

    // YAML toolbar operations
    insertYamlTemplate,
    formatYaml,
    validateYaml,
    clearYaml,
    formatEditYaml,
    validateEditYaml,

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

    // pod operations
    deletePod,

    // logs operations
    showLogsModal,
    closeLogsModal,
    fetchPodLogs,
    startLogsStream,
    stopLogsStream,

    // exec operations
    showExecModal,
    closeExecModal,
    executePodCommand,
    connectToTerminal,
    disconnectTerminal,
    initializeTerminal,

    // port forward operations
    showPortForwardModal,
    closePortForwardModal,
    submitPortForward,

    // file operations
    showFileManagerModal,
    closeFileManagerModal,
    uploadFile,
    downloadFile,

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
    addContainerField,
    removeContainerField,
    addInitContainerField,
    removeInitContainerField,
    addEnvField,
    removeEnvField,
    addPortField,
    removePortField,
    addVolumeMountField,
    removeVolumeMountField,
    addPortForwardField,
    removePortForwardField,
    addLabelField,
    removeLabelField,
    addAnnotationField,
    removeAnnotationField,
    addNodeSelectorField,
    removeNodeSelectorField,

    // constants
    K8sPodStatus,
    K8sPodPhase,
  };
}
