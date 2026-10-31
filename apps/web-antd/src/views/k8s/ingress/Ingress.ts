import { ref, computed } from 'vue';
import { message, Modal } from 'ant-design-vue';
import type { FormInstance, Rule } from 'ant-design-vue/es/form';
import {
  type K8sIngress,
  type IngressRule,
  type IngressTLS,
  type IngressHTTPRuleValue,
  type IngressHTTPIngressPath,
  type IngressLoadBalancer,
  type IngressLoadBalancerIngress,
  type IngressPortStatus,
  type GetIngressListReq,
  type CreateIngressReq,
  type UpdateIngressReq,
  type CreateIngressByYamlReq,
  type UpdateIngressByYamlReq,
  K8sIngressStatus,
  getK8sIngressList,
  getK8sIngressDetails,
  getK8sIngressYaml,
  createK8sIngress,
  createK8sIngressByYaml,
  updateK8sIngress,
  updateK8sIngressByYaml,
  deleteK8sIngress,
} from '#/api/core/k8s/k8s_ingress';
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
import {
  shouldNotifyPageError,
  shouldRecordPageError,
} from '#/utils/permission/request-notice';

export function useIngressPage() {
  // state
  const ingresses = ref<K8sIngress[]>([]);
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
  const filterStatus = ref<K8sIngressStatus | undefined>(undefined);
  const filterClusterId = ref<number | undefined>(undefined);
  const filterNamespace = ref<string | undefined>(undefined);
  const filterLabels = ref<Record<string, string>>({});
  const selectedRowKeys = ref<string[]>([]);
  const selectedRows = ref<K8sIngress[]>([]);
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
  const submitLoading = ref(false);
  const detailLoading = ref(false);

  // current operation target
  const currentOperationIngress = ref<K8sIngress | null>(null);
  const currentIngressDetail = ref<K8sIngress | null>(null);
  const currentYamlContent = ref('');

  // form models
  const createFormModel = ref<{
    name: string;
    namespace: string;
    ingress_class_name?: string;
    rules: IngressRule[];
    tls: IngressTLS[];
    labels: Record<string, string>;
    annotations: Record<string, string>;
  }>({
    name: '',
    namespace: '',
    ingress_class_name: '',
    rules: [
      {
        host: '',
        http: {
          paths: [
            {
              path: '/',
              path_type: 'Prefix',
              backend: {
                service: {
                  name: '',
                  port: {
                    number: 80,
                  },
                },
              },
            } as IngressHTTPIngressPath,
          ],
        } as IngressHTTPRuleValue,
      },
    ],
    tls: [],
    labels: {},
    annotations: {},
  });

  const editFormModel = ref<{
    name: string;
    namespace: string;
    ingress_class_name?: string;
    rules: IngressRule[];
    tls: IngressTLS[];
    labels: Record<string, string>;
    annotations: Record<string, string>;
  }>({
    name: '',
    namespace: '',
    ingress_class_name: '',
    rules: [
      {
        host: '',
        http: {
          paths: [
            {
              path: '/',
              path_type: 'Prefix',
              backend: {
                service: {
                  name: '',
                  port: {
                    number: 80,
                  },
                },
              },
            } as IngressHTTPIngressPath,
          ],
        } as IngressHTTPRuleValue,
      },
    ],
    tls: [],
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
      { required: true, message: '请输入 Ingress 名称', trigger: 'blur' },
      {
        pattern: /^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/,
        message:
          'Ingress 名称只能包含小写字母、数字和连字符，且不能以连字符开头或结尾',
        trigger: 'blur',
      },
      { max: 63, message: 'Ingress 名称长度不能超过63个字符', trigger: 'blur' },
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

  const editFormRules: Record<string, Rule[]> = {
    name: [
      { required: true, message: '请输入 Ingress 名称', trigger: 'blur' },
      {
        pattern: /^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/,
        message:
          'Ingress 名称只能包含小写字母、数字和连字符，且不能以连字符开头或结尾',
        trigger: 'blur',
      },
      { max: 63, message: 'Ingress 名称长度不能超过63个字符', trigger: 'blur' },
    ],
    namespace: [
      { required: true, message: '请选择命名空间', trigger: 'change' },
    ],
  };

  const createYamlFormRules: Record<string, Rule[]> = {
    yaml: [
      { required: true, message: '请输入 YAML 内容', trigger: 'blur' },
      { min: 50, message: 'YAML 内容过短，请检查是否完整', trigger: 'blur' },
    ],
  };

  // computed
  const filteredIngresses = computed(() => {
    return ingresses.value;
  });

  const rowSelection = computed(() => ({
    selectedRowKeys: selectedRowKeys.value,
    onChange: (keys: string[], rows: K8sIngress[]) => {
      selectedRowKeys.value = keys;
      selectedRows.value = rows;
    },
  }));

  // helpers
  const validateClusterId = (record: K8sIngress): number | null => {
    const clusterId = record.cluster_id || filterClusterId.value;
    if (!clusterId || clusterId === 0) {
      message.error('无效的集群ID，请重新选择集群');
      return null;
    }
    return clusterId;
  };

  // 解析负载均衡器信息
  const parseLoadBalancerInfo = (
    loadBalancer?: IngressLoadBalancer,
  ): string[] => {
    if (!loadBalancer || !loadBalancer.ingress) return [];

    const info: string[] = [];
    loadBalancer.ingress.forEach((lb: IngressLoadBalancerIngress) => {
      if (lb.ip) {
        info.push(`IP: ${lb.ip}`);
      }
      if (lb.hostname) {
        info.push(`Host: ${lb.hostname}`);
      }
      if (lb.ports && lb.ports.length > 0) {
        lb.ports.forEach((port: IngressPortStatus) => {
          info.push(`Port: ${port.port}/${port.protocol}`);
        });
      }
    });
    return info;
  };

  // 解析HTTP路径信息
  const parseHTTPPaths = (httpRule?: IngressHTTPRuleValue): string[] => {
    if (!httpRule || !httpRule.paths) return [];

    return httpRule.paths.map((path: IngressHTTPIngressPath) => {
      const pathType = path.path_type || 'Prefix';
      return `${path.path} (${pathType})`;
    });
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

  const getStatusText = (status?: K8sIngressStatus) => {
    const map: Record<K8sIngressStatus, string> = {
      [K8sIngressStatus.RUNNING]: '运行中',
      [K8sIngressStatus.PENDING]: '等待中',
      [K8sIngressStatus.FAILED]: '失败',
    };
    return status !== undefined ? map[status] || '未知' : '未知';
  };

  const getStatusColor = (status?: K8sIngressStatus) => {
    const map: Record<K8sIngressStatus, string> = {
      [K8sIngressStatus.RUNNING]: 'success',
      [K8sIngressStatus.PENDING]: 'warning',
      [K8sIngressStatus.FAILED]: 'error',
    };
    return status !== undefined ? map[status] || 'default' : 'default';
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

  // cluster operations
  const clearIngresses = () => {
    resourceRequestId++;
    loading.value = false;
    total.value = 0;
    loadError.value = '';
    ingresses.value = [];
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
          // 自动加载该集群的命名空间和Ingress数据
          await fetchNamespaces();
          await fetchIngresses();
        }
      }
    } catch (err) {
      if (clustersPage.value === 1) {
        clusters.value = [];
        clustersTotal.value = 0;
        filterClusterId.value = undefined;
        clearNamespaces();
        clearIngresses();
      }
      if (shouldRecordPageError(err))
        clustersError.value = '获取集群列表失败，请重试';
      if (shouldNotifyPageError(err)) message.error(clustersError.value);
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
      if (shouldRecordPageError(err))
        namespacesError.value = '获取命名空间列表失败，请重试';
      if (shouldNotifyPageError(err)) message.error(namespacesError.value);
    } finally {
      if (requestId === namespaceRequestId) namespacesLoading.value = false;
    }
  };

  // crud operations
  const fetchIngresses = async () => {
    const clusterId = filterClusterId.value;
    const namespace = filterNamespace.value;
    if (!clusterId) {
      clearIngresses();
      return;
    }
    const requestId = ++resourceRequestId;
    try {
      loading.value = true;
      loadError.value = '';
      selectedRowKeys.value = [];
      selectedRows.value = [];
      const params: GetIngressListReq = {
        cluster_id: clusterId,
        namespace: namespace || undefined,
        search: searchText.value || undefined,
        status: filterStatus.value || undefined,
        labels:
          Object.keys(filterLabels.value).length > 0
            ? filterLabels.value
            : undefined,
        page: currentPage.value,
        size: pageSize.value,
      };
      const res = await getK8sIngressList(params);
      if (
        requestId !== resourceRequestId ||
        filterClusterId.value !== clusterId ||
        filterNamespace.value !== namespace
      )
        return;
      // 确保每个ingress对象都有正确的cluster_id
      const ingressesWithClusterId = (res?.items || []).map(
        (ingress: K8sIngress) => ({
          ...ingress,
          cluster_id: ingress.cluster_id || clusterId || 0,
          // 计算前端使用的字段
          age: calculateAge(ingress.created_at),
          hosts: extractHosts(ingress.rules),
        }),
      );
      ingresses.value = ingressesWithClusterId;
      total.value = res?.total || 0;
    } catch (error) {
      if (
        requestId !== resourceRequestId ||
        filterClusterId.value !== clusterId ||
        filterNamespace.value !== namespace
      )
        return;
      clearIngresses();
      if (shouldRecordPageError(error))
        loadError.value = '获取 Ingress 列表失败，请重试';
      if (shouldNotifyPageError(error)) message.error(loadError.value);
    } finally {
      if (requestId === resourceRequestId) loading.value = false;
    }
  };

  // 提取主机列表
  const extractHosts = (rules?: IngressRule[]): string[] => {
    if (!rules || rules.length === 0) return [];
    return rules
      .map((rule) => rule.host)
      .filter((host) => host && host.trim() !== '');
  };

  // 计算年龄
  const calculateAge = (createdAt?: string): string => {
    if (!createdAt) return '-';

    const created = new Date(createdAt);
    const now = new Date();
    const diffMs = now.getTime() - created.getTime();

    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    const diffHours = Math.floor(
      (diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60),
    );
    const diffMinutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

    if (diffDays > 0) {
      return `${diffDays}d ${diffHours}h`;
    } else if (diffHours > 0) {
      return `${diffHours}h ${diffMinutes}m`;
    } else {
      return `${diffMinutes}m`;
    }
  };

  // 查看详情
  const showIngressDetail = async (record: K8sIngress) => {
    const clusterId = validateClusterId(record);
    if (!clusterId) return;

    try {
      detailLoading.value = true;
      isDetailModalVisible.value = true;
      const res = await getK8sIngressDetails({
        cluster_id: clusterId,
        namespace: record.namespace,
        name: record.name,
      });

      // 直接使用详情数据，不需要转换格式
      const processedDetail = res
        ? {
            ...res,
            cluster_id: clusterId,
            age: calculateAge(res.created_at),
            hosts: extractHosts(res.rules),
          }
        : {
            ...record,
            cluster_id: clusterId,
            age: calculateAge(record.created_at),
            hosts: extractHosts(record.rules),
          };

      currentIngressDetail.value = processedDetail;
    } catch (err) {
      if (shouldNotifyPageError(err)) message.error('获取 Ingress 详情失败');

      // 错误时使用原始记录数据
      const fallbackDetail = {
        ...record,
        cluster_id: clusterId,
        age: calculateAge(record.created_at),
        hosts: extractHosts(record.rules),
      };
      currentIngressDetail.value = fallbackDetail;
    } finally {
      detailLoading.value = false;
    }
  };

  const closeDetailModal = () => {
    isDetailModalVisible.value = false;
    currentIngressDetail.value = null;
  };

  // YAML 操作
  const showYamlModal = async (record: K8sIngress) => {
    const clusterId = validateClusterId(record);
    if (!clusterId) return;

    try {
      submitLoading.value = true;
      currentOperationIngress.value = { ...record, cluster_id: clusterId };
      const res = await getK8sIngressYaml({
        cluster_id: clusterId,
        namespace: record.namespace,
        name: record.name,
      });
      currentYamlContent.value = res?.yaml || '';
      yamlFormModel.value.yaml = res?.yaml || '';
      isYamlModalVisible.value = true;
    } catch (err) {
      if (shouldNotifyPageError(err)) message.error('获取 Ingress YAML 失败');
    } finally {
      submitLoading.value = false;
    }
  };

  const closeYamlModal = () => {
    isYamlModalVisible.value = false;
    currentOperationIngress.value = null;
    currentYamlContent.value = '';
    yamlFormModel.value.yaml = '';
  };

  const submitYamlForm = async () => {
    if (!yamlFormRef.value || !currentOperationIngress.value) return;

    try {
      await yamlFormRef.value.validate();
      submitLoading.value = true;

      const params: UpdateIngressByYamlReq = {
        cluster_id: currentOperationIngress.value.cluster_id,
        namespace: currentOperationIngress.value.namespace,
        name: currentOperationIngress.value.name,
        yaml: yamlFormModel.value.yaml,
      };

      await updateK8sIngressByYaml(params);
      message.success('🎉 Ingress YAML 更新成功');
      isYamlModalVisible.value = false;
      await fetchIngresses();
    } catch (err: unknown) {
      if (err && typeof err === 'object' && 'errorFields' in err) {
        if (shouldNotifyPageError(err))
          message.warning('请检查 YAML 格式是否正确');
        return;
      }
      if (shouldNotifyPageError(err)) message.error('❌ Ingress YAML 更新失败');
    } finally {
      submitLoading.value = false;
    }
  };

  // 创建 Ingress
  const openCreateModal = () => {
    createFormModel.value = {
      name: '',
      namespace: '',
      ingress_class_name: '',
      rules: [
        {
          host: '',
          http: {
            paths: [
              {
                path: '/',
                path_type: 'Prefix',
                backend: {
                  service: {
                    name: '',
                    port: {
                      number: 80,
                    },
                  },
                },
              },
            ],
          },
        },
      ],
      tls: [],
      labels: {},
      annotations: {},
    };
    isCreateModalVisible.value = true;
  };

  const closeCreateModal = () => {
    isCreateModalVisible.value = false;
  };

  // 通过 YAML 创建 Ingress
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

      const params: CreateIngressReq = {
        cluster_id: filterClusterId.value,
        name: createFormModel.value.name,
        namespace: createFormModel.value.namespace,
        ingress_class_name:
          createFormModel.value.ingress_class_name || undefined,
        rules: createFormModel.value.rules,
        tls:
          createFormModel.value.tls.length > 0 ? createFormModel.value.tls : [],
        labels:
          Object.keys(createFormModel.value.labels).length > 0
            ? createFormModel.value.labels
            : {},
        annotations:
          Object.keys(createFormModel.value.annotations).length > 0
            ? createFormModel.value.annotations
            : {},
      };

      await createK8sIngress(params);
      message.success('🎉 Ingress 创建成功');
      isCreateModalVisible.value = false;
      await fetchIngresses();
    } catch (err: unknown) {
      if (err && typeof err === 'object' && 'errorFields' in err) {
        if (shouldNotifyPageError(err))
          message.warning('请检查表单填写是否正确');
        return;
      }
      if (shouldNotifyPageError(err)) message.error('❌ Ingress 创建失败');
    } finally {
      submitLoading.value = false;
    }
  };

  const submitCreateYamlForm = async () => {
    if (!createYamlFormRef.value || !filterClusterId.value) return;

    try {
      await createYamlFormRef.value.validate();
      submitLoading.value = true;

      const params: CreateIngressByYamlReq = {
        cluster_id: filterClusterId.value,
        yaml: createYamlFormModel.value.yaml,
      };

      await createK8sIngressByYaml(params);
      message.success('🎉 Ingress YAML 创建成功');
      isCreateYamlModalVisible.value = false;
      await fetchIngresses();
    } catch (err: unknown) {
      if (err && typeof err === 'object' && 'errorFields' in err) {
        if (shouldNotifyPageError(err))
          message.warning('请检查 YAML 格式是否正确');
        return;
      }
      if (shouldNotifyPageError(err)) message.error('❌ Ingress YAML 创建失败');
    } finally {
      submitLoading.value = false;
    }
  };

  // 编辑 Ingress
  const openEditModal = (record: K8sIngress) => {
    currentOperationIngress.value = record;
    editFormModel.value = {
      name: record.name,
      namespace: record.namespace,
      ingress_class_name: record.ingress_class_name || '',
      rules: record.rules || [
        {
          host: '',
          http: {
            paths: [
              {
                path: '/',
                path_type: 'Prefix',
                backend: {
                  service: {
                    name: '',
                    port: {
                      number: 80,
                    },
                  },
                },
              },
            ],
          },
        },
      ],
      tls: record.tls || [],
      labels: record.labels || {},
      annotations: record.annotations || {},
    };
    isEditModalVisible.value = true;
  };

  const closeEditModal = () => {
    isEditModalVisible.value = false;
    currentOperationIngress.value = null;
    if (editFormRef.value) {
      editFormRef.value.resetFields();
    }
  };

  const submitEditForm = async () => {
    if (!editFormRef.value || !currentOperationIngress.value) return;

    try {
      await editFormRef.value.validate();
      submitLoading.value = true;

      const params: UpdateIngressReq = {
        cluster_id: currentOperationIngress.value.cluster_id,
        namespace: currentOperationIngress.value.namespace,
        name: currentOperationIngress.value.name,
        ingress_class_name: editFormModel.value.ingress_class_name || undefined,
        rules: editFormModel.value.rules,
        tls: editFormModel.value.tls.length > 0 ? editFormModel.value.tls : [],
        labels:
          Object.keys(editFormModel.value.labels).length > 0
            ? editFormModel.value.labels
            : {},
        annotations:
          Object.keys(editFormModel.value.annotations).length > 0
            ? editFormModel.value.annotations
            : {},
      };

      await updateK8sIngress(params);
      message.success('🎉 Ingress 更新成功');
      isEditModalVisible.value = false;
      await fetchIngresses();
    } catch (err: unknown) {
      if (err && typeof err === 'object' && 'errorFields' in err) {
        if (shouldNotifyPageError(err))
          message.warning('请检查表单填写是否正确');
        return;
      }
      if (shouldNotifyPageError(err)) message.error('❌ Ingress 更新失败');
    } finally {
      submitLoading.value = false;
    }
  };

  // 删除 Ingress
  const deleteIngress = (record: K8sIngress) => {
    const clusterId = validateClusterId(record);
    if (!clusterId) return;

    Modal.confirm({
      title: '删除 Ingress',
      content: `确定要删除 Ingress "${record.name}" 吗？此操作不可逆！`,
      okText: '确认删除',
      okType: 'danger',
      cancelText: '取消',
      centered: true,
      onOk: async () => {
        try {
          await deleteK8sIngress({
            cluster_id: clusterId,
            namespace: record.namespace,
            name: record.name,
          });
          message.success('✅ Ingress 删除成功');
          await fetchIngresses();
        } catch (err) {
          if (shouldNotifyPageError(err)) message.error('❌ Ingress 删除失败');
        }
      },
    });
  };

  // 标签过滤管理
  const addFilterLabel = (key: string, value: string) => {
    if (key && key.trim()) {
      filterLabels.value[key.trim()] = value;
      currentPage.value = 1;
      fetchIngresses();
    }
  };

  const removeFilterLabel = (key: string) => {
    delete filterLabels.value[key];
    currentPage.value = 1;
    fetchIngresses();
  };

  const clearFilterLabels = () => {
    filterLabels.value = {};
    currentPage.value = 1;
    fetchIngresses();
  };

  // 批量操作
  const batchOperation = (operation: string) => {
    if (!selectedRows.value.length) return;

    Modal.confirm({
      title: `批量${operation}`,
      content: `确定要对选中的 ${selectedRows.value.length} 个 Ingress 执行${operation}操作吗？`,
      okText: '确认执行',
      okType: operation === '删除' ? 'danger' : 'primary',
      cancelText: '取消',
      centered: true,
      onOk: async () => {
        try {
          for (const ingress of selectedRows.value) {
            const clusterId = ingress.cluster_id || filterClusterId.value;
            if (!clusterId) {
              message.error(
                `Ingress "${ingress.name}" 缺少有效的集群ID，跳过操作`,
              );
              continue;
            }

            if (operation === '删除') {
              await deleteK8sIngress({
                cluster_id: clusterId,
                namespace: ingress.namespace,
                name: ingress.name,
              });
            }
          }
          message.success(`✅ 批量${operation}操作已完成`);
          selectedRowKeys.value = [];
          selectedRows.value = [];
          await fetchIngresses();
        } catch (err) {
          if (shouldNotifyPageError(err))
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
    await fetchIngresses();
  };

  // 编辑表单辅助变量
  const newEditLabelKey = ref('');
  const newEditAnnotationKey = ref('');

  // 表单字段操作
  const addRuleField = () => {
    createFormModel.value.rules.push({
      host: '',
      http: {
        paths: [
          {
            path: '/',
            path_type: 'Prefix',
            backend: {
              service: {
                name: '',
                port: {
                  number: 80,
                },
              },
            },
          } as IngressHTTPIngressPath,
        ],
      } as IngressHTTPRuleValue,
    });
  };

  const removeRuleField = (index: number) => {
    if (createFormModel.value.rules.length > 1) {
      createFormModel.value.rules.splice(index, 1);
    }
  };

  const addTlsField = () => {
    createFormModel.value.tls.push({
      secret_name: '',
      hosts: [],
    });
  };

  const removeTlsField = (index: number) => {
    createFormModel.value.tls.splice(index, 1);
  };

  // 编辑表单字段操作
  const addEditRuleField = () => {
    editFormModel.value.rules.push({
      host: '',
      http: {
        paths: [
          {
            path: '/',
            path_type: 'Prefix',
            backend: {
              service: {
                name: '',
                port: {
                  number: 80,
                },
              },
            },
          } as IngressHTTPIngressPath,
        ],
      } as IngressHTTPRuleValue,
    });
  };

  const removeEditRuleField = (index: number) => {
    if (editFormModel.value.rules.length > 1) {
      editFormModel.value.rules.splice(index, 1);
    }
  };

  const addEditTlsField = () => {
    editFormModel.value.tls.push({
      secret_name: '',
      hosts: [],
    });
  };

  const removeEditTlsField = (index: number) => {
    editFormModel.value.tls.splice(index, 1);
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

  const removeLabelField = (key: string) => {
    delete createFormModel.value.labels[key];
  };

  const removeAnnotationField = (key: string) => {
    delete createFormModel.value.annotations[key];
  };

  return {
    // state
    ingresses,
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
    submitLoading,
    detailLoading,

    // operation targets
    currentOperationIngress,
    currentIngressDetail,
    currentYamlContent,

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
    filteredIngresses,
    rowSelection,

    // helpers
    validateClusterId,
    getEnvText,
    getStatusText,
    getStatusColor,
    recordToKeyValueList,
    keyValueListToRecord,
    extractHosts,
    calculateAge,
    parseLoadBalancerInfo,
    parseHTTPPaths,

    // operations
    fetchClusters,
    fetchNamespaces,
    fetchIngresses,
    clearIngresses,
    clearNamespaces,
    loadMoreClusters,
    loadMoreNamespaces,

    // detail operations
    showIngressDetail,
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

    // ingress operations
    deleteIngress,

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
    addRuleField,
    removeRuleField,
    addTlsField,
    removeTlsField,
    removeLabelField,
    removeAnnotationField,

    // edit form field operations
    addEditRuleField,
    removeEditRuleField,
    addEditTlsField,
    removeEditTlsField,
    addNewEditLabel,
    removeEditLabelField,
    addNewEditAnnotation,
    removeEditAnnotationField,

    // edit form helper variables
    newEditLabelKey,
    newEditAnnotationKey,

    // constants
    K8sIngressStatus,
  };
}
