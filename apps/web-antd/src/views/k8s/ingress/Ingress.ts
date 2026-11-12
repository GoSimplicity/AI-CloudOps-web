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
  type CreateIngressByYamlReq,
  type CreateIngressReq,
  createK8sIngress,
  createK8sIngressByYaml,
  deleteK8sIngress,
  type GetIngressListReq,
  getK8sIngressDetails,
  getK8sIngressList,
  getK8sIngressYaml,
  type IngressHTTPIngressPath,
  type IngressHTTPRuleValue,
  type IngressLoadBalancer,
  type IngressLoadBalancerIngress,
  type IngressPortStatus,
  type IngressRule,
  type IngressTLS,
  type K8sIngress,
  K8sIngressStatus,
  type UpdateIngressByYamlReq,
  type UpdateIngressReq,
  updateK8sIngress,
  updateK8sIngressByYaml,
} from '#/api/core/k8s/k8s_ingress';
import {
  getNamespacesListApi,
  type K8sNamespace,
  type K8sNamespaceListReq,
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
    annotations: Record<string, string>;
    ingress_class_name?: string;
    labels: Record<string, string>;
    name: string;
    namespace: string;
    rules: IngressRule[];
    tls: IngressTLS[];
  }>({
    annotations: {},
    ingress_class_name: '',
    labels: {},
    name: '',
    namespace: '',
    rules: [
      {
        host: '',
        http: {
          paths: [
            {
              backend: {
                service: {
                  name: '',
                  port: {
                    number: 80,
                  },
                },
              },
              path: '/',
              path_type: 'Prefix',
            } as IngressHTTPIngressPath,
          ],
        } as IngressHTTPRuleValue,
      },
    ],
    tls: [],
  });

  const editFormModel = ref<{
    annotations: Record<string, string>;
    ingress_class_name?: string;
    labels: Record<string, string>;
    name: string;
    namespace: string;
    rules: IngressRule[];
    tls: IngressTLS[];
  }>({
    annotations: {},
    ingress_class_name: '',
    labels: {},
    name: '',
    namespace: '',
    rules: [
      {
        host: '',
        http: {
          paths: [
            {
              backend: {
                service: {
                  name: '',
                  port: {
                    number: 80,
                  },
                },
              },
              path: '/',
              path_type: 'Prefix',
            } as IngressHTTPIngressPath,
          ],
        } as IngressHTTPRuleValue,
      },
    ],
    tls: [],
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
      { message: '请输入 Ingress 名称', required: true, trigger: 'blur' },
      {
        message:
          'Ingress 名称只能包含小写字母、数字和连字符，且不能以连字符开头或结尾',
        pattern: /^[\da-z]([\da-z-]*[\da-z])?$/,
        trigger: 'blur',
      },
      { max: 63, message: 'Ingress 名称长度不能超过63个字符', trigger: 'blur' },
    ],
    namespace: [
      { message: '请选择命名空间', required: true, trigger: 'change' },
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
      { message: '请输入 Ingress 名称', required: true, trigger: 'blur' },
      {
        message:
          'Ingress 名称只能包含小写字母、数字和连字符，且不能以连字符开头或结尾',
        pattern: /^[\da-z]([\da-z-]*[\da-z])?$/,
        trigger: 'blur',
      },
      { max: 63, message: 'Ingress 名称长度不能超过63个字符', trigger: 'blur' },
    ],
    namespace: [
      { message: '请选择命名空间', required: true, trigger: 'change' },
    ],
  };

  const createYamlFormRules: Record<string, Rule[]> = {
    yaml: [
      { message: '请输入 YAML 内容', required: true, trigger: 'blur' },
      { message: 'YAML 内容过短，请检查是否完整', min: 50, trigger: 'blur' },
    ],
  };

  // computed
  const filteredIngresses = computed(() => {
    return ingresses.value;
  });

  const rowSelection = computed(() => ({
    onChange: (keys: string[], rows: K8sIngress[]) => {
      selectedRowKeys.value = keys;
      selectedRows.value = rows;
    },
    selectedRowKeys: selectedRowKeys.value,
  }));

  // helpers
  const validateClusterId = (record: K8sIngress): null | number => {
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

  const getStatusText = (status?: K8sIngressStatus) => {
    const map: Record<K8sIngressStatus, string> = {
      [K8sIngressStatus.FAILED]: '失败',
      [K8sIngressStatus.PENDING]: '等待中',
      [K8sIngressStatus.RUNNING]: '运行中',
    };
    return status === undefined ? '未知' : map[status] || '未知';
  };

  const getStatusColor = (status?: K8sIngressStatus) => {
    const map: Record<K8sIngressStatus, string> = {
      [K8sIngressStatus.FAILED]: 'error',
      [K8sIngressStatus.PENDING]: 'warning',
      [K8sIngressStatus.RUNNING]: 'success',
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
          // 计算前端使用的字段
          age: calculateAge(ingress.created_at),
          cluster_id: ingress.cluster_id || clusterId || 0,
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
          // 自动加载该集群的命名空间和Ingress数据
          await fetchNamespaces();
          await fetchIngresses();
        }
      }
    } catch (error) {
      if (clustersPage.value === 1) {
        clusters.value = [];
        clustersTotal.value = 0;
        filterClusterId.value = undefined;
        clearNamespaces();
        clearIngresses();
      }
      if (shouldRecordPageError(error))
        clustersError.value = '获取集群列表失败，请重试';
      if (shouldNotifyPageError(error)) message.error(clustersError.value);
    } finally {
      clustersLoading.value = false;
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
        name: record.name,
        namespace: record.namespace,
      });

      // 直接使用详情数据，不需要转换格式
      const processedDetail = res
        ? {
            ...res,
            age: calculateAge(res.created_at),
            cluster_id: clusterId,
            hosts: extractHosts(res.rules),
          }
        : {
            ...record,
            age: calculateAge(record.created_at),
            cluster_id: clusterId,
            hosts: extractHosts(record.rules),
          };

      currentIngressDetail.value = processedDetail;
    } catch (error) {
      if (shouldNotifyPageError(error)) message.error('获取 Ingress 详情失败');

      // 错误时使用原始记录数据
      const fallbackDetail = {
        ...record,
        age: calculateAge(record.created_at),
        cluster_id: clusterId,
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
        name: record.name,
        namespace: record.namespace,
      });
      currentYamlContent.value = res?.yaml || '';
      yamlFormModel.value.yaml = res?.yaml || '';
      isYamlModalVisible.value = true;
    } catch (error) {
      if (shouldNotifyPageError(error)) message.error('获取 Ingress YAML 失败');
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
        name: currentOperationIngress.value.name,
        namespace: currentOperationIngress.value.namespace,
        yaml: yamlFormModel.value.yaml,
      };

      await updateK8sIngressByYaml(params);
      message.success('🎉 Ingress YAML 更新成功');
      isYamlModalVisible.value = false;
      await fetchIngresses();
    } catch (error: unknown) {
      if (error && typeof error === 'object' && 'errorFields' in error) {
        if (shouldNotifyPageError(error))
          message.warning('请检查 YAML 格式是否正确');
        return;
      }
      if (shouldNotifyPageError(error))
        message.error('❌ Ingress YAML 更新失败');
    } finally {
      submitLoading.value = false;
    }
  };

  // 创建 Ingress
  const openCreateModal = () => {
    createFormModel.value = {
      annotations: {},
      ingress_class_name: '',
      labels: {},
      name: '',
      namespace: '',
      rules: [
        {
          host: '',
          http: {
            paths: [
              {
                backend: {
                  service: {
                    name: '',
                    port: {
                      number: 80,
                    },
                  },
                },
                path: '/',
                path_type: 'Prefix',
              },
            ],
          },
        },
      ],
      tls: [],
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
        annotations:
          Object.keys(createFormModel.value.annotations).length > 0
            ? createFormModel.value.annotations
            : {},
        cluster_id: filterClusterId.value,
        ingress_class_name:
          createFormModel.value.ingress_class_name || undefined,
        labels:
          Object.keys(createFormModel.value.labels).length > 0
            ? createFormModel.value.labels
            : {},
        name: createFormModel.value.name,
        namespace: createFormModel.value.namespace,
        rules: createFormModel.value.rules,
        tls:
          createFormModel.value.tls.length > 0 ? createFormModel.value.tls : [],
      };

      await createK8sIngress(params);
      message.success('🎉 Ingress 创建成功');
      isCreateModalVisible.value = false;
      await fetchIngresses();
    } catch (error: unknown) {
      if (error && typeof error === 'object' && 'errorFields' in error) {
        if (shouldNotifyPageError(error))
          message.warning('请检查表单填写是否正确');
        return;
      }
      if (shouldNotifyPageError(error)) message.error('❌ Ingress 创建失败');
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
    } catch (error: unknown) {
      if (error && typeof error === 'object' && 'errorFields' in error) {
        if (shouldNotifyPageError(error))
          message.warning('请检查 YAML 格式是否正确');
        return;
      }
      if (shouldNotifyPageError(error))
        message.error('❌ Ingress YAML 创建失败');
    } finally {
      submitLoading.value = false;
    }
  };

  // 编辑 Ingress
  const openEditModal = (record: K8sIngress) => {
    currentOperationIngress.value = record;
    editFormModel.value = {
      annotations: record.annotations || {},
      ingress_class_name: record.ingress_class_name || '',
      labels: record.labels || {},
      name: record.name,
      namespace: record.namespace,
      rules: record.rules || [
        {
          host: '',
          http: {
            paths: [
              {
                backend: {
                  service: {
                    name: '',
                    port: {
                      number: 80,
                    },
                  },
                },
                path: '/',
                path_type: 'Prefix',
              },
            ],
          },
        },
      ],
      tls: record.tls || [],
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
        annotations:
          Object.keys(editFormModel.value.annotations).length > 0
            ? editFormModel.value.annotations
            : {},
        cluster_id: currentOperationIngress.value.cluster_id,
        ingress_class_name: editFormModel.value.ingress_class_name || undefined,
        labels:
          Object.keys(editFormModel.value.labels).length > 0
            ? editFormModel.value.labels
            : {},
        name: currentOperationIngress.value.name,
        namespace: currentOperationIngress.value.namespace,
        rules: editFormModel.value.rules,
        tls: editFormModel.value.tls.length > 0 ? editFormModel.value.tls : [],
      };

      await updateK8sIngress(params);
      message.success('🎉 Ingress 更新成功');
      isEditModalVisible.value = false;
      await fetchIngresses();
    } catch (error: unknown) {
      if (error && typeof error === 'object' && 'errorFields' in error) {
        if (shouldNotifyPageError(error))
          message.warning('请检查表单填写是否正确');
        return;
      }
      if (shouldNotifyPageError(error)) message.error('❌ Ingress 更新失败');
    } finally {
      submitLoading.value = false;
    }
  };

  // 删除 Ingress
  const deleteIngress = (record: K8sIngress) => {
    const clusterId = validateClusterId(record);
    if (!clusterId) return;

    Modal.confirm({
      cancelText: '取消',
      centered: true,
      content: `确定要删除 Ingress "${record.name}" 吗？此操作不可逆！`,
      okText: '确认删除',
      okType: 'danger',
      onOk: async () => {
        try {
          await deleteK8sIngress({
            cluster_id: clusterId,
            name: record.name,
            namespace: record.namespace,
          });
          message.success('✅ Ingress 删除成功');
          await fetchIngresses();
        } catch (error) {
          if (shouldNotifyPageError(error))
            message.error('❌ Ingress 删除失败');
        }
      },
      title: '删除 Ingress',
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
    if (selectedRows.value.length === 0) return;

    Modal.confirm({
      cancelText: '取消',
      centered: true,
      content: `确定要对选中的 ${selectedRows.value.length} 个 Ingress 执行${operation}操作吗？`,
      okText: '确认执行',
      okType: operation === '删除' ? 'danger' : 'primary',
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
                name: ingress.name,
                namespace: ingress.namespace,
              });
            }
          }
          message.success(`✅ 批量${operation}操作已完成`);
          selectedRowKeys.value = [];
          selectedRows.value = [];
          await fetchIngresses();
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
            backend: {
              service: {
                name: '',
                port: {
                  number: 80,
                },
              },
            },
            path: '/',
            path_type: 'Prefix',
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
      hosts: [],
      secret_name: '',
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
            backend: {
              service: {
                name: '',
                port: {
                  number: 80,
                },
              },
            },
            path: '/',
            path_type: 'Prefix',
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
      hosts: [],
      secret_name: '',
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
    // edit form field operations
    addEditRuleField,
    addEditTlsField,
    // filter operations
    addFilterLabel,
    addNewEditAnnotation,
    addNewEditLabel,
    // form field operations
    addRuleField,
    addTlsField,
    // batch operations
    batchOperation,
    // helpers
    calculateAge,
    clearFilterLabels,
    // operations
    clearIngresses,
    clearNamespaces,
    // create operations
    closeCreateModal,
    closeCreateYamlModal,
    // detail operations
    closeDetailModal,
    // edit operations
    closeEditModal,
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
    currentIngressDetail,

    currentOperationIngress,
    currentPage,
    currentYamlContent,
    // ingress operations
    deleteIngress,
    // modal state
    detailLoading,
    editFormModel,
    editFormRef,

    editFormRules,
    extractHosts,
    fetchClusters,

    fetchIngresses,
    fetchNamespaces,
    filterClusterId,
    // computed
    filteredIngresses,

    filterLabels,
    filterNamespace,
    filterStatus,
    formRef,

    getEnvText,
    getStatusColor,

    getStatusText,
    // pagination operations
    handlePageChange,
    ingresses,
    isCreateModalVisible,
    isCreateYamlModalVisible,
    isDetailModalVisible,
    isEditModalVisible,
    isYamlModalVisible,
    // constants
    K8sIngressStatus,
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

    openCreateModal,
    openCreateYamlModal,
    openEditModal,
    pageSize,
    parseHTTPPaths,
    parseLoadBalancerInfo,

    recordToKeyValueList,
    removeAnnotationField,
    removeEditAnnotationField,

    removeEditLabelField,

    removeEditRuleField,
    removeEditTlsField,
    removeFilterLabel,

    removeLabelField,

    removeRuleField,
    removeTlsField,

    resetClusters,
    rowSelection,
    searchText,
    selectedRowKeys,
    selectedRows,
    showIngressDetail,

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
