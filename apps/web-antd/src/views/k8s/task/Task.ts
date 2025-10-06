import { ref, computed } from 'vue';
import { message, Modal } from 'ant-design-vue';
import type { FormInstance, Rule } from 'ant-design-vue/es/form';
import { formatK8sTime } from '../shared/utils';
import {
  type K8sYamlTask,
  type K8sYamlTemplate,
  type YamlTaskListReq,
  type YamlTaskCreateReq,
  type YamlTaskUpdateReq,
  type YamlTaskExecuteReq,
  type YamlTaskDeleteReq,
  type YamlTemplateListReq,
  type YamlTaskDetailReq,
  getYamlTaskList,
  createYamlTask,
  updateYamlTask,
  applyYamlTask,
  deleteYamlTask,
  getYamlTemplateList,
  getYamlTaskDetail,
} from '#/api/core/k8s/k8s_yaml';
import {
  type K8sCluster,
  type ListClustersReq,
  getClustersListApi,
  Env,
} from '#/api/core/k8s/k8s_cluster';

// 任务状态枚举
export const TaskStatus = {
  PENDING: 'pending',
  RUNNING: 'running', 
  SUCCESS: 'success',
  FAILED: 'failed',
  CANCELLED: 'cancelled',
} as const;

export type TaskStatusType = typeof TaskStatus[keyof typeof TaskStatus];

export function useTaskPage() {
  // state
  const tasks = ref<K8sYamlTask[]>([]);
  const templates = ref<K8sYamlTemplate[]>([]);
  const clusters = ref<K8sCluster[]>([]);
  const loading = ref(false);
  const clustersLoading = ref(false);
  const templatesLoading = ref(false);
  const searchText = ref('');
  const filterClusterId = ref<number | undefined>(undefined);
  const filterTemplateId = ref<number | undefined>(undefined);
  const filterStatus = ref<TaskStatusType | undefined>(undefined);
  const selectedRowKeys = ref<(string | number)[]>([]);
  const selectedRows = ref<K8sYamlTask[]>([]);
  const currentPage = ref(1);
  const pageSize = ref(10);
  const total = ref(0);
  const clustersTotal = ref(0);
  const clustersPage = ref(1);
  const clustersSize = ref(50);
  const templatesTotal = ref(0);
  const templatesPage = ref(1);
  const templatesSize = ref(100);

  // form refs
  const formRef = ref<FormInstance>();
  const editFormRef = ref<FormInstance>();
  const executeFormRef = ref<FormInstance>();
  const checkLoading = ref(false);

  // modal/form state
  const isCreateModalVisible = ref(false);
  const isEditModalVisible = ref(false);
  const isDetailModalVisible = ref(false);
  const isExecuteModalVisible = ref(false);
  const submitLoading = ref(false);
  const detailLoading = ref(false);
  const executeLoading = ref(false);

  // current operation target
  const currentOperationTask = ref<K8sYamlTask | null>(null);
  const currentTaskDetail = ref<K8sYamlTask | null>(null);

  // form models
  const createFormModel = ref<{
    name: string;
    template_id: number | undefined;
    variables: string[];
  }>({
    name: '',
    template_id: undefined,
    variables: [],
  });

  const editFormModel = ref<{
    name: string;
    template_id: number | undefined;
    variables: string[];
  }>({
    name: '',
    template_id: undefined,
    variables: [],
  });

  const executeFormModel = ref<{
    dry_run: boolean;
  }>({
    dry_run: false,
  });

  // form validation rules
  const createFormRules: Record<string, Rule[]> = {
    name: [
      { required: true, message: '请输入任务名称', trigger: 'blur' },
      { pattern: /^[a-zA-Z0-9-_\u4e00-\u9fa5]+$/, message: '任务名称只能包含中英文、数字、下划线和连字符', trigger: 'blur' },
      { max: 100, message: '任务名称长度不能超过100个字符', trigger: 'blur' }
    ],
    template_id: [
      { required: true, message: '请选择模板', trigger: 'change' }
    ]
  };

  const editFormRules: Record<string, Rule[]> = {
    name: [
      { required: true, message: '请输入任务名称', trigger: 'blur' },
      { pattern: /^[a-zA-Z0-9-_\u4e00-\u9fa5]+$/, message: '任务名称只能包含中英文、数字、下划线和连字符', trigger: 'blur' },
      { max: 100, message: '任务名称长度不能超过100个字符', trigger: 'blur' }
    ]
  };

  // computed
  const filteredTasks = computed(() => {
    return tasks.value;
  });

  const rowSelection = computed(() => ({
    selectedRowKeys: selectedRowKeys.value,
    onChange: (keys: (string | number)[], rows: K8sYamlTask[]) => {
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

  const getStatusText = (status?: string) => {
    const map: Record<string, string> = {
      [TaskStatus.PENDING]: '等待中',
      [TaskStatus.RUNNING]: '运行中',
      [TaskStatus.SUCCESS]: '成功',
      [TaskStatus.FAILED]: '失败',
      [TaskStatus.CANCELLED]: '已取消',
    };
    return status ? map[status] || status : '未知';
  };

  const getStatusColor = (status?: string) => {
    const map: Record<string, string> = {
      [TaskStatus.PENDING]: 'default',
      [TaskStatus.RUNNING]: 'processing',
      [TaskStatus.SUCCESS]: 'success',
      [TaskStatus.FAILED]: 'error',
      [TaskStatus.CANCELLED]: 'warning',
    };
    return status ? map[status] || 'default' : 'default';
  };

  // 注意：时间格式化函数已移至 shared/utils.ts，使用 formatK8sTime

  const getTemplateName = (templateId?: number) => {
    const template = templates.value.find(t => t.id === templateId);
    return template?.name || `模板 ${templateId}`;
  };

  // cluster operations
  const clearTasks = () => {
    tasks.value = [];
    selectedRowKeys.value = [];
    selectedRows.value = [];
  };

  const clearTemplates = () => {
    templates.value = [];
    filterTemplateId.value = undefined;
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
          // 自动加载该集群的模板和任务数据
          await fetchTemplates();
          await fetchTasks();
        }
      }
    } catch (err) {
      message.error('获取集群列表失败');

    } finally {
      clustersLoading.value = false;
    }
  };

  const fetchTemplates = async (reset = false) => {
    const clusterId = validateClusterId();
    if (!clusterId) {
      clearTemplates();
      return;
    }

    if (reset) {
      resetTemplates();
    }

    try {
      templatesLoading.value = true;
      const params: YamlTemplateListReq = {
        page: templatesPage.value,
        size: templatesSize.value,
        cluster_id: clusterId,
      };
      const res = await getYamlTemplateList(params);
      if (templatesPage.value === 1) {
        templates.value = res?.items || [];
      } else {
        templates.value = [...templates.value, ...(res?.items || [])];
      }
      templatesTotal.value = res?.total || 0;
    } catch (err) {
      message.error('获取模板列表失败');

    } finally {
      templatesLoading.value = false;
    }
  };

  // crud operations
  const fetchTasks = async () => {
    const clusterId = validateClusterId();
    if (!clusterId) {
      clearTasks();
      return;
    }

    try {
      loading.value = true;
      const params: YamlTaskListReq = {
        page: currentPage.value,
        size: pageSize.value,
        cluster_id: clusterId,
        template_id: filterTemplateId.value || undefined,
        status: filterStatus.value || undefined,
        search: searchText.value || undefined,
      };
      const res = await getYamlTaskList(params);
      tasks.value = res?.items || [];
      total.value = res?.total || 0;
    } catch (err) {
      message.error('获取任务列表失败');

    } finally {
      loading.value = false;
    }
  };

  // 查看详情
  const showTaskDetail = async (record: K8sYamlTask) => {
    const clusterId = validateClusterId();
    if (!clusterId) return;
    
    try {
      detailLoading.value = true;
      isDetailModalVisible.value = true;
      const params: YamlTaskDetailReq = {
        id: record.id!,
        cluster_id: clusterId
      };
      const res = await getYamlTaskDetail(params);
      currentTaskDetail.value = res || record;
    } catch (err) {
      message.error('获取任务详情失败');

      currentTaskDetail.value = record;
    } finally {
      detailLoading.value = false;
    }
  };

  const closeDetailModal = () => {
    isDetailModalVisible.value = false;
    currentTaskDetail.value = null;
  };

  // 创建任务
  const openCreateModal = () => {
    createFormModel.value = {
      name: '',
      template_id: undefined,
      variables: [],
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
      
      const params: YamlTaskCreateReq = {
        name: createFormModel.value.name,
        template_id: createFormModel.value.template_id!,
        cluster_id: clusterId,
        variables: createFormModel.value.variables.filter(v => v.trim()),
      };
      
      await createYamlTask(params);
      message.success('任务创建成功');
      isCreateModalVisible.value = false;
      await fetchTasks();
    } catch (err: unknown) {
      if (err && typeof err === 'object' && 'errorFields' in err) {
        message.warning('请检查表单填写是否正确');
        return;
      }
      message.error('任务创建失败');

    } finally {
      submitLoading.value = false;
    }
  };

  // 编辑任务
  const openEditModal = (record: K8sYamlTask) => {
    currentOperationTask.value = record;
    editFormModel.value = {
      name: record.name,
      template_id: record.template_id,
      variables: record.variables || [],
    };
    isEditModalVisible.value = true;
  };

  const closeEditModal = () => {
    isEditModalVisible.value = false;
    currentOperationTask.value = null;
  };

  const submitEditForm = async () => {
    if (!editFormRef.value || !currentOperationTask.value) return;
    
    const clusterId = validateClusterId();
    if (!clusterId) return;
    
    try {
      await editFormRef.value.validate();
      submitLoading.value = true;
      
      const params: YamlTaskUpdateReq = {
        id: currentOperationTask.value.id!,
        name: editFormModel.value.name,
        template_id: editFormModel.value.template_id,
        cluster_id: clusterId,
        variables: editFormModel.value.variables.filter(v => v.trim()),
      };
      
      await updateYamlTask(params);
      message.success('任务更新成功');
      isEditModalVisible.value = false;
      await fetchTasks();
    } catch (err: unknown) {
      if (err && typeof err === 'object' && 'errorFields' in err) {
        message.warning('请检查表单填写是否正确');
        return;
      }
      message.error('任务更新失败');

    } finally {
      submitLoading.value = false;
    }
  };

  // 执行任务
  const openExecuteModal = (record: K8sYamlTask) => {
    currentOperationTask.value = record;
    executeFormModel.value = {
      dry_run: false,
    };
    isExecuteModalVisible.value = true;
  };

  const closeExecuteModal = () => {
    isExecuteModalVisible.value = false;
    currentOperationTask.value = null;
  };

  const submitExecuteForm = async () => {
    if (!currentOperationTask.value) return;
    
    const clusterId = validateClusterId();
    if (!clusterId) return;
    
    try {
      executeLoading.value = true;
      
      const params: YamlTaskExecuteReq = {
        id: currentOperationTask.value.id!,
        cluster_id: clusterId,
        dry_run: executeFormModel.value.dry_run,
      };
      
      await applyYamlTask(params);
      message.success(executeFormModel.value.dry_run ? '任务预检查成功' : '任务执行成功');
      isExecuteModalVisible.value = false;
      await fetchTasks();
    } catch (err) {
      message.error(executeFormModel.value.dry_run ? '任务预检查失败' : '任务执行失败');

    } finally {
      executeLoading.value = false;
    }
  };

  // 删除任务
  const deleteTask = (record: K8sYamlTask) => {
    const clusterId = validateClusterId();
    if (!clusterId) return;
    
    Modal.confirm({
      title: '删除任务',
      content: `确定要删除任务 "${record.name}" 吗？此操作不可逆！`,
      okText: '确认删除',
      okType: 'danger',
      cancelText: '取消',
      centered: true,
      onOk: async () => {
        try {
          const params: YamlTaskDeleteReq = {
            id: record.id!,
            cluster_id: clusterId
          };
          await deleteYamlTask(params);
          message.success('任务删除成功');
          await fetchTasks();
        } catch (err) {
          message.error('任务删除失败');

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
      content: `确定要对选中的 ${selectedRows.value.length} 个任务执行${operation}操作吗？`,
      okText: '确认执行',
      okType: operation === '删除' ? 'danger' : 'primary',
      cancelText: '取消',
      centered: true,
      onOk: async () => {
        try {
          for (const task of selectedRows.value) {
            if (operation === '删除') {
              const params: YamlTaskDeleteReq = {
                id: task.id!,
                cluster_id: clusterId
              };
              await deleteYamlTask(params);
            } else if (operation === '执行') {
              await applyYamlTask({
                id: task.id!,
                cluster_id: clusterId,
                dry_run: false,
              });
            }
          }
          message.success(`批量${operation}操作已完成`);
          selectedRowKeys.value = [];
          selectedRows.value = [];
          await fetchTasks();
        } catch (err) {
          message.error(`批量${operation}失败`);

        }
      },
    });
  };

  // 加载更多集群/模板
  const loadMoreClusters = async () => {
    if (clustersPage.value * clustersSize.value >= clustersTotal.value) {
      return;
    }
    clustersPage.value += 1;
    await fetchClusters();
  };

  const loadMoreTemplates = async () => {
    if (templatesPage.value * templatesSize.value >= templatesTotal.value) {
      return;
    }
    templatesPage.value += 1;
    await fetchTemplates();
  };

  // 重置集群/模板列表
  const resetClusters = () => {
    clustersPage.value = 1;
    clusters.value = [];
  };

  const resetTemplates = () => {
    templatesPage.value = 1;
    templates.value = [];
  };

  // 分页变化处理
  const handlePageChange = async (page: number, size?: number) => {
    currentPage.value = page;
    if (size && size !== pageSize.value) {
      pageSize.value = size;
    }
    await fetchTasks();
  };

  // 表单字段操作
  const addVariableField = () => {
    createFormModel.value.variables.push('');
  };

  const removeVariableField = (index: number) => {
    if (createFormModel.value.variables.length > 1) {
      createFormModel.value.variables.splice(index, 1);
    }
  };

  const addEditVariableField = () => {
    editFormModel.value.variables.push('');
  };

  const removeEditVariableField = (index: number) => {
    if (editFormModel.value.variables.length > 0) {
      editFormModel.value.variables.splice(index, 1);
    }
  };

  return {
    // state
    tasks,
    templates,
    clusters,
    loading,
    clustersLoading,
    templatesLoading,
    searchText,
    filterClusterId,
    filterTemplateId,
    filterStatus,
    selectedRowKeys,
    selectedRows,
    currentPage,
    pageSize,
    total,
    clustersTotal,
    clustersPage,
    clustersSize,
    templatesTotal,
    templatesPage,
    templatesSize,
    
    // form refs
    formRef,
    editFormRef,
    executeFormRef,
    
    // modal state
    isCreateModalVisible,
    isEditModalVisible,
    isDetailModalVisible,
    isExecuteModalVisible,
    submitLoading,
    detailLoading,
    executeLoading,
    checkLoading,
    
    // operation targets
    currentOperationTask,
    currentTaskDetail,
    
    // form models
    createFormModel,
    editFormModel,
    executeFormModel,
    
    // form rules
    createFormRules,
    editFormRules,
    
    // computed
    filteredTasks,
    rowSelection,
    
    // helpers
    validateClusterId,
    getEnvText,
    getStatusText,
    getStatusColor,
    formatK8sTime,
    getTemplateName,
    
    // operations
    fetchClusters,
    fetchTemplates,
    fetchTasks,
    clearTasks,
    clearTemplates,
    loadMoreClusters,
    loadMoreTemplates,
    
    // detail operations
    showTaskDetail,
    closeDetailModal,
    
    // create operations
    openCreateModal,
    closeCreateModal,
    submitCreateForm,
    
    // edit operations
    openEditModal,
    closeEditModal,
    submitEditForm,
    
    // execute operations
    openExecuteModal,
    closeExecuteModal,
    submitExecuteForm,
    
    // task operations
    deleteTask,
    
    // batch operations
    batchOperation,
    
    // pagination operations
    resetClusters,
    resetTemplates,
    handlePageChange,
    
    // form field operations
    addVariableField,
    removeVariableField,
    addEditVariableField,
    removeEditVariableField,
    
    // constants
    TaskStatus,
  };
}
