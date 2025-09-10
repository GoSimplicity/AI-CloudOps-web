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
  
  // detail modal state
  const isDetailModalVisible = ref(false);
  const detailLoading = ref(false);
  const currentClusterDetail = ref<K8sCluster | null>(null);
  
  // kubeconfig modal state
  const isKubeConfigModalVisible = ref(false);
  const currentKubeConfigCluster = ref<K8sCluster | null>(null);
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

  // 表单验证规则
  const formRules: Record<string, Rule[]> = {
    name: [
      { required: true, message: '请输入集群名称', trigger: 'blur' },
      { min: 2, max: 50, message: '集群名称长度应在2-50个字符之间', trigger: 'blur' },
      { pattern: /^[a-zA-Z0-9\u4e00-\u9fa5_-]+$/, message: '集群名称只能包含字母、数字、中文、下划线和横线', trigger: 'blur' }
    ],
    api_server_addr: [
      { 
        validator: (_rule: Rule, value: string) => {
          if (!value) return Promise.resolve();
          const urlPattern = /^https?:\/\/.+:\d+$/;
          if (!urlPattern.test(value)) {
            return Promise.reject('API Server地址格式不正确，应为 https://host:port 格式');
          }
          return Promise.resolve();
        }, 
        trigger: 'blur' 
      }
    ],
    kube_config_content: [
      { required: true, message: '请输入 KubeConfig 内容', trigger: 'blur' },
      { min: 100, message: 'KubeConfig 内容过短，请检查是否完整', trigger: 'blur' }
    ]
  };

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

  const getStatusText = (s?: ClusterStatus) => {
    const map: Record<number, string> = {
      [ClusterStatus.Running]: '运行中',
      [ClusterStatus.Stopped]: '已停止',
      [ClusterStatus.Error]: '异常',
    } as Record<number, string>;
    return s !== undefined ? map[s] || '未知' : '未知';
  };

  // crud
  const fetchClusters = async () => {
    try {
      loading.value = true;
      const params: ListClustersReq = {
        page: currentPage.value,
        size: pageSize.value,
        search: searchText.value || undefined,
        // 将数字枚举转换为字符串
        env: filterEnv.value ? String(filterEnv.value) : undefined,
        status: filterStatus.value ? String(filterStatus.value) : undefined,
      };
      const res = await getClustersListApi(params);
      clusters.value = res?.items || [];
      total.value = res?.total || 0;
    } catch (err) {
      message.error('获取集群失败');
      console.error(err);
    } finally {
      loading.value = false;
    }
  };

  const openCreate = () => {
    isEdit.value = false;
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

  const openEdit = (record: K8sCluster) => {
    isEdit.value = true;
    formModel.value = {
      id: record.id,
      name: record.name,
      restrict_namespace: record.restrict_namespace || [],
      env: record.env,
      version: record.version,
      api_server_addr: record.api_server_addr,
      kube_config_content: record.kube_config_content,
      cpu_request: record.cpu_request,
      cpu_limit: record.cpu_limit,
      memory_request: record.memory_request,
      memory_limit: record.memory_limit,
      action_timeout_seconds: record.action_timeout_seconds,
      tags: record.tags || [],
    } as UpdateClusterReq & { id?: number };
    isModalVisible.value = true;
  };

  const closeModal = () => {
    isModalVisible.value = false;
  };

  const submitForm = async () => {
    if (!formRef.value) return;
    
    try {
      // 先进行表单验证
      await formRef.value.validate();
      
      submitLoading.value = true;
      if (
        isEdit.value &&
        (formModel.value as UpdateClusterReq & { id?: number }).id
      ) {
        const m = formModel.value as UpdateClusterReq & { id?: number };
        await updateClusterApi(m.id as number, m as UpdateClusterReq);
        message.success('🎉 集群更新成功');
      } else {
        await createClusterApi(formModel.value as CreateClusterReq);
        message.success('🎉 集群创建成功');
      }
      isModalVisible.value = false;
      await fetchClusters();
    } catch (err: unknown) {
      if (err && typeof err === 'object' && 'errorFields' in err) {
        // 表单验证错误
        message.warning('请检查表单填写是否正确');
        return;
      }
      message.error(isEdit.value ? '❌ 集群更新失败' : '❌ 集群创建失败');
      console.error(err);
    } finally {
      submitLoading.value = false;
    }
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
          message.success('🗑️ 集群删除成功');
          await fetchClusters();
        } catch (err) {
          message.error('❌ 集群删除失败');
          console.error(err);
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
          message.success(`🗑️ 成功删除 ${selectedRows.value.length} 个集群`);
          selectedRowKeys.value = [];
          selectedRows.value = [];
          await fetchClusters();
        } catch (err) {
          message.error('❌ 批量删除失败');
          console.error(err);
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
      console.error(err);
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
      currentClusterDetail.value = res || record;
    } catch (err) {
      message.error('获取集群详情失败');
      console.error(err);
      currentClusterDetail.value = record; // 使用列表中的数据作为fallback
    } finally {
      detailLoading.value = false;
    }
  };

  const closeDetailModal = () => {
    isDetailModalVisible.value = false;
    currentClusterDetail.value = null;
  };

  // KubeConfig 模态框相关函数
  const showKubeConfigModal = (record: K8sCluster) => {
    currentKubeConfigCluster.value = record;
    isKubeConfigModalVisible.value = true;
  };

  const closeKubeConfigModal = () => {
    isKubeConfigModalVisible.value = false;
    currentKubeConfigCluster.value = null;
  };

  const copyKubeConfig = async () => {
    try {
      if (!currentKubeConfigCluster.value?.kube_config_content) {
        message.warning('暂无配置内容可复制');
        return;
      }
      await navigator.clipboard.writeText(currentKubeConfigCluster.value.kube_config_content);
      message.success('📋 KubeConfig 配置已复制到剪贴板');
    } catch (err) {
      message.error('复制失败，请手动复制');
      console.error(err);
    }
  };

  const downloadKubeConfig = () => {
    try {
      if (!currentKubeConfigCluster.value?.kube_config_content) {
        message.warning('暂无配置内容可下载');
        return;
      }
      
      const content = currentKubeConfigCluster.value.kube_config_content;
      const filename = `${currentKubeConfigCluster.value.name || 'cluster'}-kubeconfig.yaml`;
      
      const blob = new Blob([content], { type: 'text/yaml' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
      message.success(`📥 KubeConfig 配置已下载为 ${filename}`);
    } catch (err) {
      message.error('下载失败');
      console.error(err);
    }
  };

  // 详情模态框中的 KubeConfig 操作函数
  const copyDetailKubeConfig = async () => {
    try {
      if (!currentClusterDetail.value?.kube_config_content) {
        message.warning('暂无配置内容可复制');
        return;
      }
      await navigator.clipboard.writeText(currentClusterDetail.value.kube_config_content);
      message.success('📋 KubeConfig 配置已复制到剪贴板');
    } catch (err) {
      message.error('复制失败，请手动复制');
      console.error(err);
    }
  };

  const downloadDetailKubeConfig = () => {
    try {
      if (!currentClusterDetail.value?.kube_config_content) {
        message.warning('暂无配置内容可下载');
        return;
      }
      
      const content = currentClusterDetail.value.kube_config_content;
      const filename = `${currentClusterDetail.value.name || 'cluster'}-kubeconfig.yaml`;
      
      const blob = new Blob([content], { type: 'text/yaml' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
      message.success(`📥 KubeConfig 配置已下载为 ${filename}`);
    } catch (err) {
      message.error('下载失败');
      console.error(err);
    }
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
    formModel,
    formRules,
    formRef,
    filteredClusters,
    rowSelection,
    getEnvText,
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
    // kubeconfig modal
    isKubeConfigModalVisible,
    currentKubeConfigCluster,
    showKubeConfigModal,
    closeKubeConfigModal,
    copyKubeConfig,
    downloadKubeConfig,
    copyDetailKubeConfig,
    downloadDetailKubeConfig,
    
    // pagination
    handlePageChange,
  };
}
