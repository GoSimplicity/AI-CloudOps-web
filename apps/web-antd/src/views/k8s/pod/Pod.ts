import { ref, computed } from 'vue';
import { message, Modal } from 'ant-design-vue';
import type { FormInstance, Rule } from 'ant-design-vue/es/form';
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
  getK8sPodLogs,
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
        console.warn('处理fallback数据时出现错误:', fallbackError);
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
    isLogsModalVisible.value = false;
    currentOperationPod.value = null;
    podLogs.value = '';
    podContainers.value = [];
    selectedContainer.value = '';
  };

  const fetchPodLogs = async () => {
    if (!currentOperationPod.value || !logsFormModel.value.container) return;
    
    try {
      logsLoading.value = true;
      const params: GetPodLogsReq = {
        cluster_id: currentOperationPod.value.cluster_id,
        namespace: currentOperationPod.value.namespace,
        pod_name: currentOperationPod.value.name,
        container: logsFormModel.value.container,
        follow: logsFormModel.value.follow,
        previous: logsFormModel.value.previous,
        since_seconds: logsFormModel.value.since_seconds || undefined,
        since_time: logsFormModel.value.since_time || undefined,
        timestamps: logsFormModel.value.timestamps,
        tail_lines: logsFormModel.value.tail_lines || undefined,
        limit_bytes: logsFormModel.value.limit_bytes || undefined,
      };
      const res = await getK8sPodLogs(params);
      podLogs.value = res?.items || '暂无日志';
    } catch (err) {
      message.error('获取 Pod 日志失败');
      console.error(err);
      podLogs.value = '获取日志失败';
    } finally {
      logsLoading.value = false;
    }
  };

  // 执行命令
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
    isExecModalVisible.value = false;
    currentOperationPod.value = null;
    podContainers.value = [];
  };

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
      // 这里可以打开一个新的终端窗口或模态框显示命令执行结果
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
  const showFileManagerModal = (record: K8sPod) => {
    const clusterId = validateClusterId(record);
    if (!clusterId) return;
    
    currentOperationPod.value = { ...record, cluster_id: clusterId };
    isFileManagerModalVisible.value = true;
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
    if (!currentOperationPod.value) return;
    
    try {
      const params: PodFileDownloadReq = {
        cluster_id: currentOperationPod.value.cluster_id,
        namespace: currentOperationPod.value.namespace,
        pod_name: currentOperationPod.value.name,
        container: container,
        file_path: filePath
      };
      const res = await downloadK8sPodFile(params);
      // 处理文件下载
      const url = window.URL.createObjectURL(new Blob([res]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', filePath.split('/').pop() || 'download');
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      message.success('文件下载成功');
    } catch (err) {
      message.error('文件下载失败');
      console.error(err);
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
      total.value = res?.items?.length || 0;
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
    
    // exec operations
    showExecModal,
    closeExecModal,
    executePodCommand,
    
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
