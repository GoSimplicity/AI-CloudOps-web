import { ref, computed } from 'vue';
import { message, Modal } from 'ant-design-vue';
import type { FormInstance, Rule } from 'ant-design-vue/es/form';
import {
  type K8sYamlTemplate,
  type YamlTemplateListReq,
  type YamlTemplateCreateReq,
  type YamlTemplateUpdateReq,
  type YamlTemplateCheckReq,
  type YamlTemplateDeleteReq,
  type YamlTemplateDetailReq,
  getYamlTemplateList,
  createYamlTemplate,
  updateYamlTemplate,
  deleteYamlTemplate,
  getYamlTemplateDetail,
  checkYamlTemplate,
} from '#/api/core/k8s/k8s_yaml';
import {
  type K8sCluster,
  type ListClustersReq,
  getClustersListApi,
  Env,
} from '#/api/core/k8s/k8s_cluster';

export function useTemplatePage() {
  // state
  const templates = ref<K8sYamlTemplate[]>([]);
  const clusters = ref<K8sCluster[]>([]);
  const loading = ref(false);
  const clustersLoading = ref(false);
  const searchText = ref('');
  const filterClusterId = ref<number | undefined>(undefined);
  const selectedRowKeys = ref<(string | number)[]>([]);
  const selectedRows = ref<K8sYamlTemplate[]>([]);
  const currentPage = ref(1);
  const pageSize = ref(10);
  const total = ref(0);
  const clustersTotal = ref(0);
  const clustersPage = ref(1);
  const clustersSize = ref(50);

  // form refs
  const formRef = ref<FormInstance>();
  const yamlFormRef = ref<FormInstance>();
  const editFormRef = ref<FormInstance>();

  // modal/form state
  const isCreateModalVisible = ref(false);
  const isEditModalVisible = ref(false);
  const isDetailModalVisible = ref(false);
  const isYamlModalVisible = ref(false);
  const submitLoading = ref(false);
  const detailLoading = ref(false);
  const checkLoading = ref(false);

  // current operation target
  const currentOperationTemplate = ref<K8sYamlTemplate | null>(null);
  const currentTemplateDetail = ref<K8sYamlTemplate | null>(null);

  // form models
  const createFormModel = ref<{
    name: string;
    content: string;
  }>({
    name: '',
    content: '',
  });

  const editFormModel = ref<{
    name: string;
    content: string;
  }>({
    name: '',
    content: '',
  });

  const yamlFormModel = ref<{
    content: string;
  }>({
    content: '',
  });

  // form validation rules
  const createFormRules: Record<string, Rule[]> = {
    name: [
      { required: true, message: '请输入模板名称', trigger: 'blur' },
      { pattern: /^[a-zA-Z0-9-_\u4e00-\u9fa5]+$/, message: '模板名称只能包含中英文、数字、下划线和连字符', trigger: 'blur' },
      { max: 100, message: '模板名称长度不能超过100个字符', trigger: 'blur' }
    ],
    content: [
      { required: true, message: '请输入YAML内容', trigger: 'blur' },
      { min: 10, message: 'YAML内容不能少于10个字符', trigger: 'blur' }
    ]
  };

  const editFormRules: Record<string, Rule[]> = {
    name: [
      { required: true, message: '请输入模板名称', trigger: 'blur' },
      { pattern: /^[a-zA-Z0-9-_\u4e00-\u9fa5]+$/, message: '模板名称只能包含中英文、数字、下划线和连字符', trigger: 'blur' },
      { max: 100, message: '模板名称长度不能超过100个字符', trigger: 'blur' }
    ],
    content: [
      { required: true, message: '请输入YAML内容', trigger: 'blur' },
      { min: 10, message: 'YAML内容不能少于10个字符', trigger: 'blur' }
    ]
  };

  // computed
  const filteredTemplates = computed(() => {
    return templates.value;
  });

  const rowSelection = computed(() => ({
    selectedRowKeys: selectedRowKeys.value,
    onChange: (keys: (string | number)[], rows: K8sYamlTemplate[]) => {
      selectedRowKeys.value = keys;
      selectedRows.value = rows;
    },
  }));

  // helpers
  const validateClusterId = (): number | null => {
    if (!filterClusterId.value || filterClusterId.value === 0) {
      message.error('请先选择集群');
      return null;
    }
    return filterClusterId.value;
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

  const formatTime = (timeStr?: string) => {
    if (!timeStr) return '-';
    try {
      return new Date(timeStr).toLocaleString('zh-CN');
    } catch {
      return timeStr;
    }
  };

  // cluster operations
  const clearTemplates = () => {
    templates.value = [];
    selectedRowKeys.value = [];
    selectedRows.value = [];
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
          // 自动加载该集群的模板数据
          await fetchTemplates();
        }
      }
    } catch (err) {
      message.error('获取集群列表失败');
      console.error(err);
    } finally {
      clustersLoading.value = false;
    }
  };

  // crud operations
  const fetchTemplates = async () => {
    const clusterId = validateClusterId();
    if (!clusterId) {
      clearTemplates();
      return;
    }

    try {
      loading.value = true;
      const params: YamlTemplateListReq = {
        page: currentPage.value,
        size: pageSize.value,
        cluster_id: clusterId,
        search: searchText.value || undefined,
      };
      const res = await getYamlTemplateList(params);
      templates.value = res?.items || [];
      total.value = res?.total || 0;
    } catch (err) {
      message.error('获取模板列表失败');
      console.error(err);
    } finally {
      loading.value = false;
    }
  };

  // 查看详情
  const showTemplateDetail = async (record: K8sYamlTemplate) => {
    const clusterId = validateClusterId();
    if (!clusterId) return;
    
    try {
      detailLoading.value = true;
      isDetailModalVisible.value = true;
      const res = await getYamlTemplateDetail({
        id: record.id!,
        cluster_id: clusterId
      });
      currentTemplateDetail.value = res || record;
    } catch (err) {
      message.error('获取模板详情失败');
      console.error(err);
      currentTemplateDetail.value = record;
    } finally {
      detailLoading.value = false;
    }
  };

  const closeDetailModal = () => {
    isDetailModalVisible.value = false;
    currentTemplateDetail.value = null;
  };

  // YAML 查看
  const showYamlModal = (record: K8sYamlTemplate) => {
    currentOperationTemplate.value = record;
    yamlFormModel.value.content = record.content || '';
    isYamlModalVisible.value = true;
  };

  const closeYamlModal = () => {
    isYamlModalVisible.value = false;
    currentOperationTemplate.value = null;
    yamlFormModel.value.content = '';
  };

  // 创建模板
  const openCreateModal = () => {
    createFormModel.value = {
      name: '',
      content: '',
    };
    isCreateModalVisible.value = true;
  };

  const closeCreateModal = () => {
    isCreateModalVisible.value = false;
  };

  const submitCreateForm = async () => {
    if (!formRef.value) return;
    
    const clusterId = validateClusterId();
    if (!clusterId) return;
    
    try {
      await formRef.value.validate();
      submitLoading.value = true;
      
      const params: YamlTemplateCreateReq = {
        name: createFormModel.value.name,
        content: createFormModel.value.content,
        cluster_id: clusterId,
      };
      
      await createYamlTemplate(params);
      message.success('🎉 模板创建成功');
      isCreateModalVisible.value = false;
      await fetchTemplates();
    } catch (err: unknown) {
      if (err && typeof err === 'object' && 'errorFields' in err) {
        message.warning('请检查表单填写是否正确');
        return;
      }
      message.error('❌ 模板创建失败');
      console.error(err);
    } finally {
      submitLoading.value = false;
    }
  };

  // 编辑模板
  const openEditModal = (record: K8sYamlTemplate) => {
    currentOperationTemplate.value = record;
    editFormModel.value = {
      name: record.name,
      content: record.content,
    };
    isEditModalVisible.value = true;
  };

  const closeEditModal = () => {
    isEditModalVisible.value = false;
    currentOperationTemplate.value = null;
  };

  const submitEditForm = async () => {
    if (!editFormRef.value || !currentOperationTemplate.value) return;
    
    const clusterId = validateClusterId();
    if (!clusterId) return;
    
    try {
      await editFormRef.value.validate();
      submitLoading.value = true;
      
      const params: YamlTemplateUpdateReq = {
        id: currentOperationTemplate.value.id!,
        name: editFormModel.value.name,
        content: editFormModel.value.content,
        cluster_id: clusterId,
      };
      
      await updateYamlTemplate(params);
      message.success('🎉 模板更新成功');
      isEditModalVisible.value = false;
      await fetchTemplates();
    } catch (err: unknown) {
      if (err && typeof err === 'object' && 'errorFields' in err) {
        message.warning('请检查表单填写是否正确');
        return;
      }
      message.error('❌ 模板更新失败');
      console.error(err);
    } finally {
      submitLoading.value = false;
    }
  };

  // 检查模板
  const checkTemplate = async (content: string) => {
    if (!content || content.trim().length < 10) {
      message.warning('请输入有效的 YAML 内容');
      return false;
    }

    const clusterId = validateClusterId();
    if (!clusterId) return false;

    try {
      checkLoading.value = true;
      const params: YamlTemplateCheckReq = {
        name: createFormModel.value.name || editFormModel.value.name || 'temp-check',
        content: content,
        cluster_id: clusterId,
      };
      
      await checkYamlTemplate(params);
      message.success('✅ YAML 格式检查通过');
      return true;
    } catch (err) {
      message.error('❌ YAML 格式检查失败');
      console.error(err);
      return false;
    } finally {
      checkLoading.value = false;
    }
  };


  // 删除模板
  const deleteTemplate = (record: K8sYamlTemplate) => {
    const clusterId = validateClusterId();
    if (!clusterId) return;
    
    Modal.confirm({
      title: '删除模板',
      content: `确定要删除模板 "${record.name}" 吗？此操作不可逆！`,
      okText: '确认删除',
      okType: 'danger',
      cancelText: '取消',
      centered: true,
      onOk: async () => {
        try {
          const params: YamlTemplateDeleteReq = {
            id: record.id!,
            cluster_id: clusterId
          };
          await deleteYamlTemplate(params);
          message.success('✅ 模板删除成功');
          await fetchTemplates();
        } catch (err) {
          message.error('❌ 模板删除失败');
          console.error(err);
        }
      },
    });
  };

  // 批量操作
  const batchOperation = (operation: string) => {
    if (!selectedRows.value.length) return;
    
    const clusterId = validateClusterId();
    if (!clusterId) return;
    
    Modal.confirm({
      title: `批量${operation}`,
      content: `确定要对选中的 ${selectedRows.value.length} 个模板执行${operation}操作吗？`,
      okText: '确认执行',
      okType: operation === '删除' ? 'danger' : 'primary',
      cancelText: '取消',
      centered: true,
      onOk: async () => {
        try {
          for (const template of selectedRows.value) {
            if (operation === '删除') {
              const params: YamlTemplateDeleteReq = {
                id: template.id!,
                cluster_id: clusterId
              };
              await deleteYamlTemplate(params);
            }
          }
          message.success(`✅ 批量${operation}操作已完成`);
          selectedRowKeys.value = [];
          selectedRows.value = [];
          await fetchTemplates();
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

  // 重置集群列表
  const resetClusters = () => {
    clustersPage.value = 1;
    clusters.value = [];
  };

  // 分页变化处理
  const handlePageChange = async (page: number, size?: number) => {
    currentPage.value = page;
    if (size && size !== pageSize.value) {
      pageSize.value = size;
    }
    await fetchTemplates();
  };

  return {
    // state
    templates,
    clusters,
    loading,
    clustersLoading,
    searchText,
    filterClusterId,
    selectedRowKeys,
    selectedRows,
    currentPage,
    pageSize,
    total,
    clustersTotal,
    clustersPage,
    clustersSize,
    
    // form refs
    formRef,
    yamlFormRef,
    editFormRef,
    
    // modal state
    isCreateModalVisible,
    isEditModalVisible,
    isDetailModalVisible,
    isYamlModalVisible,
    submitLoading,
    detailLoading,
    checkLoading,
    
    // operation targets
    currentOperationTemplate,
    currentTemplateDetail,
    
    // form models
    createFormModel,
    editFormModel,
    yamlFormModel,
    
    // form rules
    createFormRules,
    editFormRules,
    
    // computed
    filteredTemplates,
    rowSelection,
    
    // helpers
    validateClusterId,
    getEnvText,
    formatTime,
    
    // operations
    fetchClusters,
    fetchTemplates,
    clearTemplates,
    loadMoreClusters,
    
    // detail operations
    showTemplateDetail,
    closeDetailModal,
    
    // YAML operations
    showYamlModal,
    closeYamlModal,
    
    // create operations
    openCreateModal,
    closeCreateModal,
    submitCreateForm,
    
    // edit operations
    openEditModal,
    closeEditModal,
    submitEditForm,
    
    // template operations
    deleteTemplate,
    checkTemplate,
    
    // batch operations
    batchOperation,
    
    // pagination operations
    resetClusters,
    handlePageChange,
  };
}
