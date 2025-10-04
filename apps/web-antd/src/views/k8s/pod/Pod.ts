import { ref, computed, nextTick } from 'vue';
import { message, Modal } from 'ant-design-vue';
import type { FormInstance, Rule } from 'ant-design-vue/es/form';
import { Terminal } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import { WebLinksAddon } from 'xterm-addon-web-links';
import 'xterm/css/xterm.css';
import { useAccessStore } from '@vben/stores';
import { useAppConfig } from '@vben/hooks';
import {
  type K8sPod,
  type PodContainer,
  type GetPodListReq,
  type GetPodDetailsReq,
  type GetPodYamlReq,
  type CreatePodReq,
  type CreatePodContainer,
  type CreatePodByYamlReq,
  type UpdatePodReq,
  type UpdatePodByYamlReq,
  type DeletePodReq,
  type GetPodsByNodeReq,
  type GetPodContainersReq,
  type GetPodLogsReq,
  type PodExecReq,
  type PodPortForwardReq,
  type PodPortForwardPort,
  type PodFileUploadReq,
  type PodFileDownloadReq,
  K8sPodStatus,
  K8sPodPhase,
  getK8sPodList,
  getK8sPodDetails,
  getK8sPodYaml,
  createK8sPod,
  createK8sPodByYaml,
  updateK8sPod,
  updateK8sPodByYaml,
  deleteK8sPod,
  getK8sPodsByNode,
  getK8sPodContainers,
  execK8sPod,
  forwardK8sPodPort,
  uploadK8sPodFile,
  downloadK8sPodFile,
} from '#/api/core/k8s/k8s_pod';
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

export function usePodPage() {
  // state
  const pods = ref<K8sPod[]>([]);
  const clusters = ref<K8sCluster[]>([]);
  const namespaces = ref<K8sNamespace[]>([]);
  const nodes = ref<string[]>([]);
  const loading = ref(false);
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
  const terminalConnection = ref<{ sendCommand: (cmd: string) => void; close: () => void } | null>(null);
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
    containers: [{
      name: '',
      image: '',
      command: [],
      args: [],
      envs: [],
      ports: [],
      resources: {
        requests: { cpu: '', memory: '' },
        limits: { cpu: '', memory: '' }
      },
      volume_mounts: [],
      image_pull_policy: 'IfNotPresent'
    }],
    init_containers: [],
    restart_policy: 'Always',
    node_selector: {},
    tolerations: [],
    affinity: undefined,
    volumes: [],
    host_network: false,
    host_pid: false,
    dns_policy: 'ClusterFirst',
    service_account: ''
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
    annotations: {}
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
    limit_bytes: 0
  });

  const execFormModel = ref<{
    container: string;
    shell: string;
  }>({
    container: '',
    shell: '/bin/bash'
  });

  const portForwardFormModel = ref<{
    ports: PodPortForwardPort[];
  }>({
    ports: [{ local_port: 0, remote_port: 0 }]
  });

  // form validation rules
  const createFormRules: Record<string, Rule[]> = {
    name: [
      { required: true, message: '请输入 Pod 名称', trigger: 'blur' },
      { pattern: /^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/, message: 'Pod 名称只能包含小写字母、数字和连字符，且不能以连字符开头或结尾', trigger: 'blur' },
      { max: 63, message: 'Pod 名称长度不能超过63个字符', trigger: 'blur' }
    ],
    namespace: [
      { required: true, message: '请选择命名空间', trigger: 'change' }
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


  const execFormRules: Record<string, Rule[]> = {
    container: [
      { required: true, message: '请选择容器', trigger: 'change' }
    ]
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
  const recordToKeyValueList = (record: Record<string, string> | null | undefined): KeyValueList => {
    if (!record || typeof record !== 'object') {
      return [];
    }
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
    pods.value = [];
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
          // 自动加载该集群的命名空间和Pod数据
          await fetchNamespaces();
          await fetchPods();
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
  const fetchPods = async () => {
    if (!filterClusterId.value || filterClusterId.value === 0) {
      message.warning('请先选择有效的集群');
      pods.value = [];
      total.value = 0;
      return;
    }

    try {
      loading.value = true;
      const params: GetPodListReq = {
        cluster_id: filterClusterId.value,
        page: currentPage.value,
        page_size: pageSize.value,
        search: searchText.value || undefined,
        namespace: filterNamespace.value || undefined,
        status: filterStatus.value || undefined,
        labels: Object.keys(filterLabels.value).length > 0 ? filterLabels.value : undefined,
      };
      const res = await getK8sPodList(params);
      // 确保每个pod对象都有正确的cluster_id
      const podsWithClusterId = (res?.items || []).map((pod: K8sPod) => ({
        ...pod,
        cluster_id: pod.cluster_id || filterClusterId.value || 0,
        // 解析JSON字段
        labels: parseJsonField(pod.labels, {}),
        annotations: parseJsonField(pod.annotations, {}),
        conditions: parseJsonField(pod.conditions, []),
        containers: parseJsonField(pod.containers, []),
        init_containers: parseJsonField(pod.init_containers, []),
        volumes: parseJsonField(pod.volumes, []),
        owner_references: parseJsonField(pod.owner_references, []),
        spec: parseJsonField(pod.spec, {})
      }));
      pods.value = podsWithClusterId;
      total.value = res?.total || 0;
    } catch (err) {
      message.error('获取 Pod 列表失败');
      console.error(err);
    } finally {
      loading.value = false;
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
        name: record.name
      };
      const res = await getK8sPodDetails(params);
      
      // 转换标签和注解格式：从对象转为数组
      const processedDetail = res ? {
        ...res,
        cluster_id: clusterId,
        labels: recordToKeyValueList(parseJsonField(res.labels, {})),
        annotations: recordToKeyValueList(parseJsonField(res.annotations, {})),
        conditions: parseJsonField(res.conditions, []),
        containers: parseJsonField(res.containers, []),
        init_containers: parseJsonField(res.init_containers, []),
        volumes: parseJsonField(res.volumes, []),
        owner_references: parseJsonField(res.owner_references, []),
        spec: parseJsonField(res.spec, {})
      } : { 
        ...record, 
        cluster_id: clusterId,
        labels: recordToKeyValueList(parseJsonField(record.labels, {})),
        annotations: recordToKeyValueList(parseJsonField(record.annotations, {}))
      };
      
      currentPodDetail.value = processedDetail;
    } catch (err) {
      message.error('获取 Pod 详情失败');
      console.error(err);
      // 错误时也要处理格式转换
      try {
        const parsedLabels = parseJsonField(record.labels, {});
        const parsedAnnotations = parseJsonField(record.annotations, {});
        
        const fallbackDetail = { 
          ...record, 
          cluster_id: clusterId,
          labels: recordToKeyValueList(parsedLabels),
          annotations: recordToKeyValueList(parsedAnnotations)
        };
        currentPodDetail.value = fallbackDetail;
      } catch (fallbackError) {
        // 最终的安全fallback
        currentPodDetail.value = {
          ...record,
          cluster_id: clusterId,
          labels: [],
          annotations: []
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
        name: record.name
      };
      const res = await getK8sPodYaml(params);
      currentYamlContent.value = res?.yaml || '';
      yamlFormModel.value.yaml = res?.yaml || '';
      isYamlModalVisible.value = true;
    } catch (err) {
      message.error('获取 Pod YAML 失败');
      console.error(err);
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
      message.success('🎉 Pod YAML 更新成功');
      isYamlModalVisible.value = false;
      await fetchPods();
    } catch (err: unknown) {
      if (err && typeof err === 'object' && 'errorFields' in err) {
        message.warning('请检查 YAML 格式是否正确');
        return;
      }
      message.error('❌ Pod YAML 更新失败');
      console.error(err);
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
      containers: [{
        name: '',
        image: '',
        command: [],
        args: [],
        envs: [],
        ports: [],
        resources: {
          requests: { cpu: '', memory: '' },
          limits: { cpu: '', memory: '' }
        },
        volume_mounts: [],
        image_pull_policy: 'IfNotPresent'
      }],
      init_containers: [],
      restart_policy: 'Always',
      node_selector: {},
      tolerations: [],
      affinity: undefined,
      volumes: [],
      host_network: false,
      host_pid: false,
      dns_policy: 'ClusterFirst',
      service_account: ''
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
        labels: Object.keys(createFormModel.value.labels).length > 0 ? createFormModel.value.labels : undefined,
        annotations: Object.keys(createFormModel.value.annotations).length > 0 ? createFormModel.value.annotations : undefined,
        containers: createFormModel.value.containers,
        init_containers: createFormModel.value.init_containers.length > 0 ? createFormModel.value.init_containers : undefined,
        restart_policy: createFormModel.value.restart_policy,
        node_selector: Object.keys(createFormModel.value.node_selector).length > 0 ? createFormModel.value.node_selector : undefined,
        tolerations: createFormModel.value.tolerations.length > 0 ? createFormModel.value.tolerations : undefined,
        affinity: createFormModel.value.affinity,
        volumes: createFormModel.value.volumes.length > 0 ? createFormModel.value.volumes : undefined,
        host_network: createFormModel.value.host_network,
        host_pid: createFormModel.value.host_pid,
        dns_policy: createFormModel.value.dns_policy,
        service_account: createFormModel.value.service_account
      };
      
      await createK8sPod(params);
      message.success('🎉 Pod 创建成功');
      isCreateModalVisible.value = false;
      await fetchPods();
    } catch (err: unknown) {
      if (err && typeof err === 'object' && 'errorFields' in err) {
        message.warning('请检查表单填写是否正确');
        return;
      }
      message.error('❌ Pod 创建失败');
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
      
      const params: CreatePodByYamlReq = {
        cluster_id: filterClusterId.value,
        yaml: createYamlFormModel.value.yaml,
      };
      
      await createK8sPodByYaml(params);
      message.success('🎉 Pod YAML 创建成功');
      isCreateYamlModalVisible.value = false;
      await fetchPods();
    } catch (err: unknown) {
      if (err && typeof err === 'object' && 'errorFields' in err) {
        message.warning('请检查 YAML 格式是否正确');
        return;
      }
      message.error('❌ Pod YAML 创建失败');
      console.error(err);
    } finally {
      submitLoading.value = false;
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
        labels: Object.keys(editFormModel.value.labels).length > 0 ? editFormModel.value.labels : undefined,
        annotations: Object.keys(editFormModel.value.annotations).length > 0 ? editFormModel.value.annotations : undefined,
      };
      
      await updateK8sPod(params);
      message.success('🎉 Pod 更新成功');
      isEditModalVisible.value = false;
      await fetchPods();
    } catch (err: unknown) {
      if (err && typeof err === 'object' && 'errorFields' in err) {
        message.warning('请检查表单填写是否正确');
        return;
      }
      message.error('❌ Pod 更新失败');
      console.error(err);
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
          message.success('✅ Pod 删除成功');
          await fetchPods();
        } catch (err) {
          message.error('❌ Pod 删除失败');
          console.error(err);
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
        pod_name: record.name
      };
      const containersRes = await getK8sPodContainers(containersParams);
      podContainers.value = containersRes?.items || [];
      
      // 如果有容器，默认选择第一个
      if (podContainers.value.length > 0 && podContainers.value[0]) {
        selectedContainer.value = podContainers.value[0].name;
        logsFormModel.value.container = podContainers.value[0].name;
      }
      
      isLogsModalVisible.value = true;
    } catch (err) {
      message.error('获取 Pod 容器列表失败');
      console.error(err);
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
      limit_bytes: 0
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
    onClose?: () => void
  ) => {
    // 获取当前用户的访问令牌
    const accessStore = useAccessStore();
    const currentToken = accessStore.accessToken;
    
    // 获取应用配置中的API URL
    const { apiURL } = useAppConfig(import.meta.env, import.meta.env.PROD);
    const baseURL = apiURL || `${window.location.origin}/api`;
    const queryParams = new URLSearchParams();
    
    // 添加查询参数
    if (params.follow !== undefined) queryParams.append('follow', params.follow.toString());
    if (params.previous !== undefined) queryParams.append('previous', params.previous.toString());
    if (params.since_seconds !== undefined) queryParams.append('since_seconds', params.since_seconds.toString());
    if (params.since_time) queryParams.append('since_time', params.since_time);
    if (params.timestamps !== undefined) queryParams.append('timestamps', params.timestamps.toString());
    if (params.tail_lines !== undefined) queryParams.append('tail_lines', params.tail_lines.toString());
    if (params.limit_bytes !== undefined) queryParams.append('limit_bytes', params.limit_bytes.toString());

    const url = `${baseURL}/k8s/pod/${params.cluster_id}/${params.namespace}/${params.pod_name}/containers/${params.container}/logs?${queryParams.toString()}`;
    
    // 验证URL格式
    try {
      new URL(url, window.location.origin);
    } catch (urlError) {
      console.error('Invalid SSE URL:', url, urlError);
      onError?.(new Event('error'));
      return {
        eventSource: null as any,
        close: () => {}
      };
    }
    
    let abortController: AbortController;
    let reader: ReadableStreamDefaultReader<Uint8Array> | null = null;
    let isManualClose = false;
    let reconnectAttempts = 0;
    let reconnectTimeoutId: NodeJS.Timeout | null = null;

    const scheduleReconnect = () => {
      if (reconnectTimeoutId) {
        clearTimeout(reconnectTimeoutId);
        reconnectTimeoutId = null;
      }
      reconnectAttempts++;
      reconnectTimeoutId = setTimeout(() => {
        createFetchSSE();
      }, Math.min(1000 * Math.pow(2, reconnectAttempts - 1), 30000));
    };

    // 使用fetch API替换EventSource以支持自定义headers
    const createFetchSSE = async () => {
      try {
        abortController = new AbortController();
        
        const headers: Record<string, string> = {
          'Accept': 'text/event-stream',
          'Cache-Control': 'no-cache',
        };
        
        if (currentToken) {
          headers['Authorization'] = `Bearer ${currentToken}`;
        }
        
        
        const response = await fetch(url, {
          method: 'GET',
          headers,
          signal: abortController.signal,
        });
        
        if (!response.ok) {
          const errorText = await response.text().catch(() => 'Unknown error');
          console.error(`SSE连接失败 - 状态码: ${response.status}, 错误信息:`, errorText);
          throw new Error(`HTTP error! status: ${response.status}, message: ${errorText}`);
        }
        
        if (!response.body) {
          throw new Error('Response body is null');
        }        reconnectAttempts = 0;
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
            if (readError?.name === 'AbortError') {              break;
            }
            throw readError;
          }
          
          const { done, value } = readResult;
          
          if (done) {            scheduleReconnect();
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
              
              if (data === '[DONE]') {                onClose?.();
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
          console.error('SSE fetch错误:', error);
        }
        
        if (error?.name === 'AbortError') {          isManualClose = true;
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
          } catch (cancelError) {
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
      close: async () => {        isManualClose = true;
        
        if (reconnectTimeoutId) {
          clearTimeout(reconnectTimeoutId);
          reconnectTimeoutId = null;
        }
        
        if (abortController) {
          try {
            abortController.abort();
          } catch (error) {
            console.debug('AbortController.abort() 调用时的预期错误:', error);
          }
        }
        
        if (reader) {
          try {
            await reader.cancel().catch(() => {});
            reader = null;
          } catch (error) {
            console.debug('Reader.cancel() 调用时的预期错误:', error);
          }
        }
        
        try {
          onClose?.();
        } catch (error) {
          console.debug('onClose回调错误:', error);
        }
      }
    } as unknown as EventSource;
    
    return {
      eventSource: eventSource as unknown as EventSource,
      close: () => {
        Promise.resolve(eventSource.close()).catch((error) => {
          console.debug('关闭连接时的预期错误:', error);
        });      }
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
        (error: Event) => {
          // 现在有自动重连机制，不需要复杂的错误处理
          // 只在控制台记录，避免频繁打扰用户
          console.debug('SSE连接错误:', error);
        },
        // onOpen - 连接建立
        () => {
          message.success('✅ 实时日志连接已建立，支持自动重连');
          logsLoading.value = false;
          
          // 确保状态正确设置
          isLogsStreaming.value = true;
        },
        // onClose - 连接关闭（只有在真正结束时才调用）
        () => {
          isLogsStreaming.value = false;
          logsLoading.value = false;
          logsStreamConnection.value = null;
          
          // 只有在模态框还开着时才提示最终关闭
          if (isLogsModalVisible.value) {
            message.info('📡 实时日志连接已停止');
          }
        }
      );
    } catch (err) {
      console.error('启动实时日志失败:', err);
      let errorMessage = '启动实时日志失败';
      
      if (err instanceof Error) {
        if (err.message.includes('400')) {
          errorMessage = '请求参数错误，请检查Pod名称和容器名称是否正确';
        } else if (err.message.includes('404')) {
          errorMessage = 'Pod或容器未找到，请检查名称是否正确';
        } else if (err.message.includes('403')) {
          errorMessage = '权限不足，请检查访问权限';
        } else if (err.message.includes('500')) {
          errorMessage = '服务器内部错误，请稍后重试或联系管理员';
        } else if (err.message.includes('network') || err.message.includes('fetch')) {
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
    } catch (error) {
      console.debug('停止日志流时遇到错误:', error);
    } finally {
      // 确保状态被正确重置
      isLogsStreaming.value = false;
      logsLoading.value = false;
      message.info('⏹️ 实时日志流已停止');
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
        pod_name: record.name
      };
      const containersRes = await getK8sPodContainers(containersParams);
      podContainers.value = containersRes?.items || [];
      
      execFormModel.value = {
        container: podContainers.value.length > 0 ? podContainers.value[0]?.name || '' : '',
        shell: '/bin/bash'
      };
      isExecModalVisible.value = true;
    } catch (err) {
      message.error('获取 Pod 容器列表失败');
      console.error(err);
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
      shell: '/bin/bash'
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
          if (error instanceof Error && error.message.includes('Could not dispose an addon that has not been loaded')) {
            console.debug('预期的addon dispose错误:', error.message);
          } else {
            console.error('终端清理错误:', error);
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
          brightWhite: '#e5e5e5'
        },
        cols: 120,
        rows: 30,
        scrollback: 1000,
        convertEol: true
      });

      // 添加插件
      try {
        fitAddon.value = new FitAddon();
        terminal.value.loadAddon(fitAddon.value);
        
        // 安全加载WebLinksAddon
        const webLinksAddon = new WebLinksAddon();
        terminal.value.loadAddon(webLinksAddon);
      } catch (error) {        // 如果插件加载失败，继续初始化终端
      }

      // 将终端挂载到DOM
      terminal.value.open(terminalElement);
      
      // 自适应大小
      if (fitAddon.value) {
        fitAddon.value.fit();
      }
      
      // 监听窗口大小变化
      const resizeObserver = new ResizeObserver(() => {
        if (fitAddon.value && terminal.value) {
          fitAddon.value.fit();
        }
      });
      resizeObserver.observe(terminalElement);

      return true;
    } catch (error) {
      console.error('初始化终端失败:', error);
      message.error('初始化终端失败');
      return false;
    }
  };

  // WebSocket终端连接 - 移动到Pod.ts中的业务逻辑
  const execK8sPodWebSocket = (
    params: PodExecReq,
    onMessage: (data: string) => void,
    onError?: (error: Event) => void,
    onOpen?: () => void,
    onClose?: () => void
  ) => {
    // 获取认证token
    const accessStore = useAccessStore();
    const token = accessStore.accessToken;
    
    if (!token) {
      console.error('未获取到认证token');
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
        }
      };
    }

    // 构建WebSocket URL - 使用相对路径利用Vite代理
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    const url = `${protocol}//${host}/api/k8s/pod/${params.cluster_id}/${params.namespace}/${params.pod_name}/containers/${params.container}/exec?token=${encodeURIComponent(token)}`;
    
    let socket: WebSocket | null = null;
    let isManualClose = false;
    let reconnectAttempts = 0;
    let reconnectTimeoutId: NodeJS.Timeout | null = null;
    const maxReconnectAttempts = 5;
    const reconnectInterval = 3000; // 3秒重连间隔

    const scheduleReconnect = () => {
      if (isManualClose || reconnectAttempts >= maxReconnectAttempts) {
        return;
      }
      
      reconnectAttempts++;
      reconnectTimeoutId = setTimeout(() => {
        connect();
      }, reconnectInterval);
    };

    const connect = () => {
      try {
        // 清理之前的连接
        if (socket) {
          socket.close();
          socket = null;
        }
        
        // 创建WebSocket连接
        socket = new WebSocket(url);

        socket.onopen = () => {
          reconnectAttempts = 0; // 重置重连计数
          
          // 发送初始化参数
          const initMessage = {
            shell: params.shell || '/bin/bash',
            container: params.container
          };
          socket?.send(JSON.stringify(initMessage));
          
          onOpen?.();
        };

        socket.onmessage = (event) => {
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
              } catch (parseError) {
                // 如果不是JSON格式，直接传递原始数据
                onMessage(data);
              }
            }
          } catch (error) {
            console.error('处理WebSocket消息时出错:', error);
          }
        };

        socket.onerror = (error) => {
          console.error('Pod执行命令WebSocket连接错误:', error);
          onError?.(error);
        };

        socket.onclose = (event) => {
          socket = null;
          
          // 根据关闭代码提供更详细的错误信息
          if (event.code === 1006) {
            console.debug('WebSocket连接异常关闭');
          } else if (event.code === 1000) {
            console.debug('WebSocket正常关闭');
          } else if (event.code === 1003) {
            console.error('WebSocket协议错误');
          } else if (event.code === 4401) {
            console.error('WebSocket认证失败 - 请检查token是否有效');
          }
          
          if (!isManualClose && !event.wasClean) {
            // 非正常关闭且不是手动关闭，尝试重连
            scheduleReconnect();
          } else {
            onClose?.();
          }
        };

      } catch (error) {
        console.error('创建WebSocket连接失败:', error);
        onError?.(new Event('connection_failed'));
      }
    };

    // 发送命令到容器
    const sendCommand = (command: string) => {
      if (socket && socket.readyState === WebSocket.OPEN) {
        // 直接发送字符串命令
        socket.send(command);
      } else {
        console.warn('WebSocket未连接，无法发送命令');
      }
    };

    // 手动关闭连接
    const close = () => {
      isManualClose = true;
      
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
      }
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
        return;
      }

      const params: PodExecReq = {
        cluster_id: currentOperationPod.value.cluster_id,
        namespace: currentOperationPod.value.namespace,
        pod_name: currentOperationPod.value.name,
        container: execFormModel.value.container,
        shell: execFormModel.value.shell,
      };

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
        (error: Event) => {
          console.error('终端连接错误:', error);
          message.error('终端连接出现问题');
          isTerminalConnected.value = false;
        },
        // onOpen - 连接建立
        () => {
          message.success('✅ 终端连接已建立');
          isTerminalConnected.value = true;
          terminalLoading.value = false;
          
          // 监听终端输入
          if (terminal.value && terminalConnection.value) {
            terminal.value.onData((data) => {
              terminalConnection.value?.sendCommand(data);
            });
          }
          
          // 发送初始化信息
          if (terminal.value) {
            terminal.value.writeln(`\r\n连接到 Pod: ${currentOperationPod.value?.name}`);
            terminal.value.writeln(`容器: ${execFormModel.value.container}`);
            terminal.value.writeln(`Shell: ${execFormModel.value.shell}`);
            terminal.value.writeln('=' .repeat(50));
          }
        },
        // onClose - 连接关闭
        () => {
          isTerminalConnected.value = false;
          terminalLoading.value = false;
          
          if (terminal.value && isExecModalVisible.value) {
            terminal.value.writeln('\r\n\r\n📡 连接已断开');
            message.info('终端连接已断开');
          }
        }
      );

    } catch (err: unknown) {
      if (err && typeof err === 'object' && 'errorFields' in err) {
        message.warning('请检查表单填写是否正确');
        return;
      }
      message.error('❌ 建立终端连接失败');
      console.error(err);
      isTerminalConnected.value = false;
    } finally {
      terminalLoading.value = false;
    }
  };

  // 断开终端连接
  const disconnectTerminal = () => {
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
          if (error instanceof Error && error.message.includes('Could not dispose an addon that has not been loaded')) {
            console.debug('预期的addon dispose错误:', error.message);
          } else {
            console.error('终端清理错误:', error);
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
      
    } catch (error) {
      console.debug('断开终端连接时遇到错误:', error);
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
      message.success('🎉 命令执行成功');
      isExecModalVisible.value = false;
    } catch (err: unknown) {
      if (err && typeof err === 'object' && 'errorFields' in err) {
        message.warning('请检查表单填写是否正确');
        return;
      }
      message.error('❌ 命令执行失败');
      console.error(err);
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
      ports: [{ local_port: 0, remote_port: 0 }]
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
        ports: portForwardFormModel.value.ports.filter(p => p.local_port > 0 && p.remote_port > 0)
      };
      await forwardK8sPodPort(params);
      message.success('端口转发设置成功');
      isPortForwardModalVisible.value = false;
    } catch (err) {
      message.error('端口转发设置失败');
      console.error(err);
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
        pod_name: record.name
      };
      const containersRes = await getK8sPodContainers(containersParams);
      podContainers.value = containersRes?.items || [];
      
      isFileManagerModalVisible.value = true;
    } catch (err) {
      message.error('获取容器信息失败');
      console.error(err);
    }
  };

  const closeFileManagerModal = () => {
    isFileManagerModalVisible.value = false;
    currentOperationPod.value = null;
  };

  // 文件上传
  const uploadFile = async (file: File, filePath: string, container: string) => {
    if (!currentOperationPod.value) return;
    
    try {
      const params: PodFileUploadReq = {
        cluster_id: currentOperationPod.value.cluster_id,
        namespace: currentOperationPod.value.namespace,
        pod_name: currentOperationPod.value.name,
        container: container,
        file_path: filePath
      };
      await uploadK8sPodFile(params, file);
      message.success('文件上传成功');
    } catch (err) {
      message.error('文件上传失败');
      console.error(err);
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
        file_path: filePath
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
      
    } catch (err: any) {
      console.error('🔴 文件下载失败:', err);
      console.error('🔴 错误详情:', {
        message: err?.message,
        response: err?.response,
        status: err?.response?.status,
        statusText: err?.response?.statusText,
        data: err?.response?.data,
        config: err?.config,
        stack: err?.stack
      });
      
      // 更详细的错误处理
      let errorMessage = '文件下载失败';
      if (err?.response?.status) {
        if (err.response.status === 404) {
          errorMessage = '文件不存在或路径错误';
        } else if (err.response.status === 403) {
          errorMessage = '权限不足，无法访问该文件';
        } else if (err.response.status === 500) {
          errorMessage = '服务器内部错误';
        } else {
          errorMessage = `下载失败 (${err.response.status}): ${err.response.statusText || err.message}`;
        }
      } else if (err?.response?.data?.message) {
        errorMessage = `下载失败: ${err.response.data.message}`;
      } else if (err?.message) {
        errorMessage = `下载失败: ${err.message}`;
      } else if (typeof err === 'string') {
        errorMessage = `下载失败: ${err}`;
      }
      
      message.error(errorMessage);
    }
  };

  // 根据节点获取Pod
  const fetchPodsByNode = async (nodeName: string) => {
    if (!filterClusterId.value) return;
    
    try {
      loading.value = true;
      const params: GetPodsByNodeReq = {
        cluster_id: filterClusterId.value,
        node_name: nodeName
      };
      const res = await getK8sPodsByNode(params);
      pods.value = res?.items || [];
      total.value = res?.total || 0;
    } catch (err) {
      message.error('获取节点Pod失败');
      console.error(err);
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
                name: pod.name
              };
              await deleteK8sPod(params);
            }
            
          }
          
          message.success(`✅ 批量${operation}操作已完成`);
          selectedRowKeys.value = [];
          selectedRows.value = [];
          await fetchPods();
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
        limits: { cpu: '', memory: '' }
      },
      volume_mounts: [],
      image_pull_policy: 'IfNotPresent'
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
        limits: { cpu: '', memory: '' }
      },
      volume_mounts: [],
      image_pull_policy: 'IfNotPresent'
    });
  };

  const removeInitContainerField = (index: number) => {
    createFormModel.value.init_containers.splice(index, 1);
  };

  const addEnvField = (containerIndex: number, isInit = false) => {
    const containers = isInit ? createFormModel.value.init_containers : createFormModel.value.containers;
    if (containers[containerIndex]) {
      containers[containerIndex].envs = containers[containerIndex].envs || [];
      containers[containerIndex].envs?.push({ name: '', value: '' });
    }
  };

  const removeEnvField = (containerIndex: number, envIndex: number, isInit = false) => {
    const containers = isInit ? createFormModel.value.init_containers : createFormModel.value.containers;
    containers[containerIndex]?.envs?.splice(envIndex, 1);
  };

  const addPortField = (containerIndex: number, isInit = false) => {
    const containers = isInit ? createFormModel.value.init_containers : createFormModel.value.containers;
    if (containers[containerIndex]) {
      containers[containerIndex].ports = containers[containerIndex].ports || [];
      containers[containerIndex].ports?.push({ name: '', container_port: 0, protocol: 'TCP' });
    }
  };

  const removePortField = (containerIndex: number, portIndex: number, isInit = false) => {
    const containers = isInit ? createFormModel.value.init_containers : createFormModel.value.containers;
    containers[containerIndex]?.ports?.splice(portIndex, 1);
  };

  const addVolumeMountField = (containerIndex: number, isInit = false) => {
    const containers = isInit ? createFormModel.value.init_containers : createFormModel.value.containers;
    if (containers[containerIndex]) {
      containers[containerIndex].volume_mounts = containers[containerIndex].volume_mounts || [];
      containers[containerIndex].volume_mounts?.push({ 
        name: '', 
        mount_path: '', 
        read_only: false, 
        sub_path: '' 
      });
    }
  };

  const removeVolumeMountField = (containerIndex: number, mountIndex: number, isInit = false) => {
    const containers = isInit ? createFormModel.value.init_containers : createFormModel.value.containers;
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

  return {
    // state
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
