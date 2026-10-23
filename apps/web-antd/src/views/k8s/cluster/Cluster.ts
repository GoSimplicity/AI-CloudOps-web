import { ref, computed } from 'vue';
import { message, Modal } from 'ant-design-vue';
import type { FormInstance, Rule } from 'ant-design-vue/es/form';
import {
  Env,
  ClusterStatus,
  type K8sCluster,
  type CreateClusterReq,
  type UpdateClusterReq,
  type ListClustersReq,
  type KeyValue,
  getClustersListApi,
  getClusterDetailApi,
  createClusterApi,
  updateClusterApi,
  deleteClusterApi,
  refreshClusterApi,
} from '#/api/core/k8s/k8s_cluster';

export function useClusterPage() {
  // state
  const clusters = ref<K8sCluster[]>([]);
  const loading = ref(false);
  const loadError = ref('');
  let listRequestId = 0;
  const searchText = ref('');
  const filterEnv = ref<Env | undefined>(undefined);
  const filterStatus = ref<ClusterStatus | undefined>(undefined);
  const selectedRowKeys = ref<number[]>([]);
  const selectedRows = ref<K8sCluster[]>([]);
  const currentPage = ref(1);
  const pageSize = ref(10);
  const total = ref(0);
  const clustersTotal = ref(0); // 用于集群下拉选择

  // form refs
  const formRef = ref<FormInstance>();

  // modal/form state
  const isModalVisible = ref(false);
  const isEdit = ref(false);
  const submitLoading = ref(false);
  const editDetailLoading = ref(false);
  // 新建/编辑弹窗的打开会话序号：晚到的编辑详情只能写回发起它的那次打开
  let formSessionId = 0;

  // detail modal state
  const isDetailModalVisible = ref(false);
  const detailLoading = ref(false);
  const currentClusterDetail = ref<K8sCluster | null>(null);

  // 编辑时原集群是否已配置 kubeconfig（读接口只返回布尔值，不返回原文）
  const editHasKubeConfig = ref(false);
  const formModel = ref<
    CreateClusterReq | (UpdateClusterReq & { id?: number })
  >({
    name: '',
    restrict_namespace: [],
    env: undefined,
    version: '',
    api_server_addr: '',
    kube_config_content: '',
    cpu_request: '',
    cpu_limit: '',
    memory_request: '',
    memory_limit: '',
    action_timeout_seconds: undefined,
    tags: [],
  });

  // 表单验证规则：新建时 kubeconfig 必填；编辑时留空表示不修改，填了才校验
  const formRules = computed<Record<string, Rule[]>>(() => ({
    name: [
      { required: true, message: '请输入集群名称', trigger: 'blur' },
      {
        min: 2,
        max: 50,
        message: '集群名称长度应在2-50个字符之间',
        trigger: 'blur',
      },
      {
        pattern: /^[a-zA-Z0-9\u4e00-\u9fa5_-]+$/,
        message: '集群名称只能包含字母、数字、中文、下划线和横线',
        trigger: 'blur',
      },
    ],
    api_server_addr: [
      {
        validator: (_rule: Rule, value: string) => {
          if (!value) return Promise.resolve();
          const urlPattern = /^https?:\/\/.+:\d+$/;
          if (!urlPattern.test(value)) {
            return Promise.reject(
              'API Server地址格式不正确，应为 https://host:port 格式',
            );
          }
          return Promise.resolve();
        },
        trigger: 'blur',
      },
    ],
    kube_config_content: [
      {
        required: !isEdit.value,
        trigger: 'blur',
        // 先 trim 再判断：纯空白等同于未填写（新建报必填，编辑视为不修改）
        validator: (_rule: Rule, value: unknown) => {
          const content = typeof value === 'string' ? value.trim() : '';
          if (!content) {
            return isEdit.value
              ? Promise.resolve()
              : Promise.reject('请输入 KubeConfig 内容');
          }
          if (content.length < 100) {
            return Promise.reject('KubeConfig 内容过短，请检查是否完整');
          }
          return Promise.resolve();
        },
      },
    ],
  }));

  // computed - 不在前端做过滤，因为后端API已经处理了过滤
  const filteredClusters = computed(() => {
    return clusters.value;
  });

  const rowSelection = computed(() => ({
    selectedRowKeys: selectedRowKeys.value,
    onChange: (keys: number[], rows: K8sCluster[]) => {
      selectedRowKeys.value = keys;
      selectedRows.value = rows;
    },
  }));

  // helpers
  const getEnvText = (env?: Env | string) => {
    if (env === undefined || env === null) return '未知';
    const value = typeof env === 'string' ? parseInt(env) : env;
    const map: Record<number, string> = {
      [Env.Prod]: '生产',
      [Env.Dev]: '开发',
      [Env.Stage]: '预发',
      [Env.Rc]: '测试',
      [Env.Press]: '灰度',
    };
    return map[value] || '未知';
  };

  const getEnvColor = (env?: Env | string) => {
    if (env === undefined || env === null) return 'default';
    const value = typeof env === 'string' ? parseInt(env) : env;
    const map: Record<number, string> = {
      [Env.Prod]: 'red',
      [Env.Dev]: 'blue',
      [Env.Stage]: 'orange',
      [Env.Rc]: 'green',
      [Env.Press]: 'purple',
    };
    return map[value] || 'default';
  };

  const getStatusText = (s?: ClusterStatus) => {
    const map: Record<number, string> = {
      [ClusterStatus.Running]: '运行中',
      [ClusterStatus.Stopped]: '已停止',
      [ClusterStatus.Error]: '异常',
    } as Record<number, string>;
    return s !== undefined ? map[s] || '未知' : '未知';
  };

  // 防御：即使旧版后端仍回传 kubeconfig 原文，也不在前端状态里保留
  const stripKubeConfig = (cluster: K8sCluster): K8sCluster => {
    if (!cluster || typeof cluster !== 'object') return cluster;
    const { kube_config_content: content, ...rest } = cluster as K8sCluster & {
      kube_config_content?: string;
    };
    return {
      ...rest,
      has_kube_config: rest.has_kube_config ?? Boolean(content),
    };
  };

  // crud
  const fetchClusters = async () => {
    const requestId = ++listRequestId;
    try {
      loading.value = true;
      loadError.value = '';
      selectedRowKeys.value = [];
      selectedRows.value = [];
      const params: ListClustersReq = {
        page: currentPage.value,
        size: pageSize.value,
        search: searchText.value || undefined,
        // 将数字枚举转换为字符串
        env: filterEnv.value ? String(filterEnv.value) : undefined,
        status: filterStatus.value ? String(filterStatus.value) : undefined,
      };
      const res = await getClustersListApi(params);
      if (requestId !== listRequestId) return;
      clusters.value = (res?.items || []).map(stripKubeConfig);
      total.value = res?.total || 0;
    } catch (err) {
      if (requestId !== listRequestId) return;
      clusters.value = [];
      total.value = 0;
      loadError.value = '获取集群失败，请重试';
      message.error(loadError.value);
    } finally {
      if (requestId === listRequestId) loading.value = false;
    }
  };

  // 纯空白的 kubeconfig 归一为空串（编辑时即“留空不修改”）
  const normalizeKubeConfigInput = () => {
    const content = formModel.value.kube_config_content;
    if (typeof content === 'string' && !content.trim()) {
      formModel.value.kube_config_content = '';
    }
  };

  // 弹窗结束（取消/保存成功）后不在前端状态里保留 kubeconfig 输入
  const clearKubeConfigInput = () => {
    formModel.value.kube_config_content = '';
  };

  const openCreate = () => {
    formSessionId++;
    editDetailLoading.value = false;
    isEdit.value = false;
    editHasKubeConfig.value = false;
    formModel.value = {
      name: '',
      restrict_namespace: [],
      env: undefined,
      version: '',
      api_server_addr: '',
      kube_config_content: '',
      cpu_request: '',
      cpu_limit: '',
      memory_request: '',
      memory_limit: '',
      action_timeout_seconds: undefined,
      tags: [],
    };
    isModalVisible.value = true;
  };

  const openEdit = async (record: K8sCluster) => {
    const sessionId = ++formSessionId;
    const isCurrentSession = () => sessionId === formSessionId;
    try {
      isEdit.value = true;
      editDetailLoading.value = true;

      // 显示加载状态，先用列表数据填充基本信息
      formModel.value = {
        id: record.id,
        name: record.name,
        restrict_namespace: record.restrict_namespace || [],
        env: record.env,
        version: record.version,
        api_server_addr: record.api_server_addr,
        kube_config_content: '', // 留空表示不修改
        cpu_request: record.cpu_request,
        cpu_limit: record.cpu_limit,
        memory_request: record.memory_request,
        memory_limit: record.memory_limit,
        action_timeout_seconds: record.action_timeout_seconds,
        tags: record.tags || [],
      } as UpdateClusterReq & { id?: number };
      editHasKubeConfig.value = Boolean(record.has_kube_config);

      isModalVisible.value = true;

      // 获取最新的集群详情（不含 kubeconfig 原文）
      if (record.id) {
        const detailData = await getClusterDetailApi(record.id);
        // 响应晚到：期间已重新打开（新建/编辑其他集群）或已关闭，丢弃
        if (!isCurrentSession()) return;
        if (detailData) {
          editHasKubeConfig.value = Boolean(
            detailData.has_kube_config ?? record.has_kube_config,
          );
          formModel.value = {
            id: detailData.id || record.id,
            name: detailData.name || record.name,
            restrict_namespace: detailData.restrict_namespace || [],
            env: detailData.env || record.env,
            version: detailData.version || record.version,
            api_server_addr:
              detailData.api_server_addr || record.api_server_addr,
            kube_config_content: '', // 留空表示不修改，填写则整段替换
            cpu_request: detailData.cpu_request || record.cpu_request,
            cpu_limit: detailData.cpu_limit || record.cpu_limit,
            memory_request: detailData.memory_request || record.memory_request,
            memory_limit: detailData.memory_limit || record.memory_limit,
            action_timeout_seconds:
              detailData.action_timeout_seconds ||
              record.action_timeout_seconds,
            tags: detailData.tags || [],
          } as UpdateClusterReq & { id?: number };
        }
      }
    } catch (err) {
      if (!isCurrentSession()) return;
      isModalVisible.value = false;
      message.error('获取集群详细信息失败，请重试后再编辑');
    } finally {
      if (isCurrentSession()) editDetailLoading.value = false;
    }
  };

  const closeModal = () => {
    formSessionId++;
    editDetailLoading.value = false;
    isModalVisible.value = false;
    clearKubeConfigInput();
  };

  const submitForm = async () => {
    if (!formRef.value) return;

    try {
      // 先把纯空白归一为空串，再进行表单验证
      normalizeKubeConfigInput();
      await formRef.value.validate();

      // 检查是否需要二次确认
      const needsConfirmation = await checkDangerousOperations();
      if (needsConfirmation && !(await showDangerousOperationConfirm())) {
        return;
      }

      submitLoading.value = true;
      if (
        isEdit.value &&
        (formModel.value as UpdateClusterReq & { id?: number }).id
      ) {
        const m = formModel.value as UpdateClusterReq & { id?: number };
        const payload: UpdateClusterReq = { ...(m as UpdateClusterReq) };
        // 留空 = 保留原 kubeconfig，不把空串发给后端
        if (!payload.kube_config_content?.trim()) {
          delete payload.kube_config_content;
        }
        await updateClusterApi(m.id as number, payload);
        message.success('集群更新成功');
      } else {
        await createClusterApi({ ...formModel.value } as CreateClusterReq);
        message.success('集群创建成功');
      }
      formSessionId++;
      isModalVisible.value = false;
      clearKubeConfigInput();
      await fetchClusters();
    } catch (err: unknown) {
      if (err && typeof err === 'object' && 'errorFields' in err) {
        // 表单验证错误
        message.warning('请检查表单填写是否正确');
        return;
      }
      message.error(isEdit.value ? '集群更新失败' : '集群创建失败');
    } finally {
      submitLoading.value = false;
    }
  };

  // 检查是否为危险操作
  const checkDangerousOperations = async (): Promise<boolean> => {
    if (!isEdit.value) return false; // 新建不需要确认

    // 获取原始数据进行对比
    const currentFormData = formModel.value as UpdateClusterReq & {
      id?: number;
    };
    if (!currentFormData.id) return false;

    try {
      const originalData = await getClusterDetailApi(currentFormData.id);
      if (!originalData) return false;

      // 检查资源配置是否变化
      const resourceChanged =
        (originalData?.cpu_request || '') !==
          (currentFormData.cpu_request || '') ||
        (originalData?.cpu_limit || '') !== (currentFormData.cpu_limit || '') ||
        (originalData?.memory_request || '') !==
          (currentFormData.memory_request || '') ||
        (originalData?.memory_limit || '') !==
          (currentFormData.memory_limit || '');

      // 检查命名空间限制是否变化
      const namespaceChanged =
        JSON.stringify(originalData?.restrict_namespace || []) !==
        JSON.stringify(currentFormData.restrict_namespace || []);

      return resourceChanged || namespaceChanged;
    } catch (error) {
      return false;
    }
  };

  // 显示危险操作确认对话框
  const showDangerousOperationConfirm = (): Promise<boolean> => {
    return new Promise((resolve) => {
      Modal.confirm({
        title: '危险操作确认',
        content: `
          您正在修改集群的关键配置，这可能会影响集群的性能和安全性。
          
          请确认以下事项：
          • 资源配置修改可能影响集群性能
          • 命名空间限制修改会改变访问权限范围
          • 生产环境建议在维护时间窗口内操作
          • 建议先在测试环境验证配置的有效性
          
          是否继续执行此操作？
        `,
        okText: '确认执行',
        cancelText: '取消操作',
        okType: 'danger',
        centered: true,
        width: 520,
        onOk: () => resolve(true),
        onCancel: () => resolve(false),
      });
    });
  };

  const confirmDelete = (record: K8sCluster) => {
    Modal.confirm({
      title: '确认删除集群',
      content: `确定要删除集群 "${record.name}" 吗？此操作不可撤销。`,
      okText: '确认删除',
      cancelText: '取消',
      okType: 'danger',
      centered: true,
      onOk: async () => {
        try {
          await deleteClusterApi(record.id as number);
          message.success('集群删除成功');
          await fetchClusters();
        } catch (err) {
          message.error('集群删除失败');
        }
      },
    });
  };

  const addTag = () => {
    const currentTags = formModel.value.tags as KeyValue[] | undefined;
    formModel.value.tags = [...(currentTags || []), { key: '', value: '' }];
  };

  const removeTag = (index: number) => {
    const tags = formModel.value.tags as KeyValue[] | undefined;
    if (!tags || index < 0 || index >= tags.length) return;
    tags.splice(index, 1);
  };

  const batchDelete = () => {
    if (!selectedRows.value.length) return;
    Modal.confirm({
      title: '批量删除集群',
      content: `确定要删除选中的 ${selectedRows.value.length} 个集群吗？此操作不可撤销，请谨慎操作！`,
      okText: '确认删除',
      cancelText: '取消',
      okType: 'danger',
      centered: true,
      onOk: async () => {
        try {
          await Promise.all(
            selectedRows.value.map((c) => deleteClusterApi(c.id as number)),
          );
          message.success(`成功删除 ${selectedRows.value.length} 个集群`);
          selectedRowKeys.value = [];
          selectedRows.value = [];
          await fetchClusters();
        } catch (err) {
          message.error('批量删除失败');
        }
      },
    });
  };

  const refreshCluster = async (id: number) => {
    try {
      await refreshClusterApi(id);
      message.success('已触发刷新');
      await fetchClusters();
    } catch (err) {
      message.error('刷新失败');
    }
  };

  const resetFilters = async () => {
    searchText.value = '';
    filterEnv.value = undefined;
    filterStatus.value = undefined;
    currentPage.value = 1;
    await fetchClusters();
  };

  // 查看详情相关函数
  const showClusterDetail = async (record: K8sCluster) => {
    try {
      detailLoading.value = true;
      isDetailModalVisible.value = true;
      const res = await getClusterDetailApi(record.id as number);
      currentClusterDetail.value = stripKubeConfig(res || record);
    } catch (err) {
      message.error('获取集群详情失败');

      currentClusterDetail.value = stripKubeConfig(record); // 使用列表中的数据作为fallback
    } finally {
      detailLoading.value = false;
    }
  };

  const closeDetailModal = () => {
    isDetailModalVisible.value = false;
    currentClusterDetail.value = null;
  };

  // 搜索处理
  const onSearch = () => {
    currentPage.value = 1; // 搜索时重置到第一页
    fetchClusters();
  };

  // 实时搜索输入处理
  const onSearchInput = () => {
    // 可以添加防抖逻辑，这里暂时简化
    currentPage.value = 1;
    fetchClusters();
  };

  // 分页变化处理
  const handlePageChange = async (page: number, size?: number) => {
    currentPage.value = page;
    if (size && size !== pageSize.value) {
      pageSize.value = size;
    }
    await fetchClusters();
  };

  return {
    clusters,
    loading,
    loadError,
    searchText,
    filterEnv,
    filterStatus,
    selectedRowKeys,
    selectedRows,
    currentPage,
    pageSize,
    total,
    clustersTotal,
    isModalVisible,
    isEdit,
    submitLoading,
    editDetailLoading,
    formModel,
    formRules,
    formRef,
    filteredClusters,
    rowSelection,
    getEnvText,
    getEnvColor,
    getStatusText,
    fetchClusters,
    openCreate,
    openEdit,
    closeModal,
    submitForm,
    confirmDelete,
    batchDelete,
    refreshCluster,
    resetFilters,
    onSearch,
    onSearchInput,
    Env,
    ClusterStatus,
    addTag,
    removeTag,
    // detail modal
    isDetailModalVisible,
    detailLoading,
    currentClusterDetail,
    showClusterDetail,
    closeDetailModal,
    // kubeconfig 状态
    editHasKubeConfig,

    // pagination
    handlePageChange,
  };
}
