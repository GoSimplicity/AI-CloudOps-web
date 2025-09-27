import { computed, reactive, ref, toRefs } from 'vue';
import { message, Modal } from 'ant-design-vue';
// import { useRouter } from 'vue-router'; // 暂时未使用
import type { FormInstance } from 'ant-design-vue';
import {
  getCronJobList,
  getCronJobDetail,
  createCronJob,
  updateCronJob,
  deleteCronJob,
  enableCronJob,
  disableCronJob,
  triggerCronJob,
  validateSchedule,
  type CronJob,
  type CreateCronJobReq,
  type UpdateCronJobReq,
  type TreeLocalResource,
  CronJobStatus,
  CronJobType,
} from '#/api/core/cron/cron';
import { getTreeLocalList } from '#/api/core/tree/tree_local';

// 页面状态接口
interface CronJobPageState {
  // 基础状态
  loading: boolean;
  submitLoading: boolean;
  detailLoading: boolean;
  error: string | null;
  
  // 数据状态
  cronJobs: CronJob[];
  sshResources: TreeLocalResource[];
  filteredSshResources: TreeLocalResource[];
  sshResourcesLoading: boolean;
  sshSearchText: string;
  
  // 筛选和搜索
  searchText: string;
  filterStatus?: CronJobStatus;
  filterJobType?: CronJobType;
  
  // 分页
  currentPage: number;
  pageSize: number;
  total: number;
  
  // 选中的行
  selectedRows: CronJob[];
  selectedRowKeys: number[];
  
  // 模态框状态
  isCreateModalVisible: boolean;
  isEditModalVisible: boolean;
  isDetailModalVisible: boolean;
  
  // 当前操作的任务
  currentJobDetail: CronJob | null;
  currentOperationJob: CronJob | null;
  
  // 表单数据
  createFormModel: CreateCronJobReq;
  editFormModel: UpdateCronJobReq;
}

// 创建表单初始数据
const createInitialFormModel = (): CreateCronJobReq => ({
  name: '',
  description: '',
  job_type: CronJobType.COMMAND,
  schedule: '',
  timeout: 300,
  max_retry: 0,
  command: '',
  args: [],
  work_dir: '',
  environment: [],
  http_method: 'GET',
  http_url: '',
  http_headers: [],
  http_body: '',
  script_type: 'bash',
  script_content: '',
  ssh_resource_id: undefined,
  ssh_command: '',
  ssh_work_dir: '',
  ssh_environment: [],
});

// 创建编辑表单初始数据
const createInitialEditFormModel = (): UpdateCronJobReq => ({
  id: 0,
  name: '',
  description: '',
  job_type: CronJobType.COMMAND,
  schedule: '',
  timeout: 300,
  max_retry: 0,
  command: '',
  args: [],
  work_dir: '',
  environment: [],
  http_method: 'GET',
  http_url: '',
  http_headers: [],
  http_body: '',
  script_type: 'bash',
  script_content: '',
  ssh_resource_id: undefined,
  ssh_command: '',
  ssh_work_dir: '',
  ssh_environment: [],
});

export function useCronJobPage() {
  // 路由实例 - 暂时未使用
  // const router = useRouter();
  
  // 表单引用
  const formRef = ref<FormInstance>();
  
  // 页面状态
  const state = reactive<CronJobPageState>({
    // 基础状态
    loading: false,
    submitLoading: false,
    detailLoading: false,
    error: null,
    
    // 数据状态
    cronJobs: [],
    sshResources: [],
    filteredSshResources: [],
    sshResourcesLoading: false,
    sshSearchText: '',
    
    // 筛选和搜索
    searchText: '',
    filterStatus: undefined,
    filterJobType: undefined,
    
    // 分页
    currentPage: 1,
    pageSize: 20,
    total: 0,
    
    // 选中的行
    selectedRows: [],
    selectedRowKeys: [],
    
    // 模态框状态
    isCreateModalVisible: false,
    isEditModalVisible: false,
    isDetailModalVisible: false,
    
    // 当前操作的任务
    currentJobDetail: null,
    currentOperationJob: null,
    
    // 表单数据
    createFormModel: createInitialFormModel(),
    editFormModel: createInitialEditFormModel(),
  });

  // 计算属性
  const filteredCronJobs = computed(() => {
    let jobs = [...state.cronJobs];
    
    // 按状态筛选
    if (state.filterStatus !== undefined) {
      jobs = jobs.filter(job => job.status === state.filterStatus);
    }
    
    // 按类型筛选
    if (state.filterJobType !== undefined) {
      jobs = jobs.filter(job => job.job_type === state.filterJobType);
    }
    
    // 按搜索文本筛选
    if (state.searchText) {
      const searchLower = state.searchText.toLowerCase();
      jobs = jobs.filter(job => 
        job.name.toLowerCase().includes(searchLower) ||
        (job.description && job.description.toLowerCase().includes(searchLower))
      );
    }
    
    return jobs;
  });

  // 行选择配置
  const rowSelection = {
    selectedRowKeys: computed(() => state.selectedRowKeys),
    onChange: (selectedRowKeys: any[], selectedRows: CronJob[]) => {
      state.selectedRowKeys = selectedRowKeys as number[];
      state.selectedRows = selectedRows;
    },
  };

  // 创建表单验证规则
  const createFormRules = {
    name: [
      { required: true, message: '请输入任务名称' },
      { min: 1, max: 100, message: '任务名称长度应在1-100个字符之间' },
    ],
    job_type: [
      { required: true, message: '请选择任务类型' },
    ],
    schedule: [
      { required: true, message: '请输入调度表达式' },
    ],
    command: [
      { 
        required: computed(() => state.createFormModel.job_type === CronJobType.COMMAND), 
        message: '请输入执行命令' 
      },
    ],
    http_url: [
      { 
        required: computed(() => state.createFormModel.job_type === CronJobType.HTTP), 
        message: '请输入请求URL' 
      },
      { type: 'url', message: '请输入有效的URL' },
    ],
    http_method: [
      { 
        required: computed(() => state.createFormModel.job_type === CronJobType.HTTP), 
        message: '请选择HTTP方法' 
      },
    ],
    script_type: [
      { 
        required: computed(() => state.createFormModel.job_type === CronJobType.SCRIPT), 
        message: '请选择脚本类型' 
      },
    ],
    script_content: [
      { 
        required: computed(() => state.createFormModel.job_type === CronJobType.SCRIPT), 
        message: '请输入脚本内容' 
      },
    ],
    ssh_resource_id: [
      { 
        required: computed(() => state.createFormModel.job_type === CronJobType.SSH), 
        message: '请选择SSH资源' 
      },
    ],
    ssh_command: [
      { 
        required: computed(() => state.createFormModel.job_type === CronJobType.SSH), 
        message: '请输入SSH命令' 
      },
    ],
  };

  // 编辑表单验证规则
  const editFormRules = {
    name: [
      { required: true, message: '请输入任务名称' },
      { min: 1, max: 100, message: '任务名称长度应在1-100个字符之间' },
    ],
    job_type: [
      { required: true, message: '请选择任务类型' },
    ],
    schedule: [
      { required: true, message: '请输入调度表达式' },
    ],
    command: [
      { 
        required: computed(() => state.editFormModel.job_type === CronJobType.COMMAND), 
        message: '请输入执行命令' 
      },
    ],
    http_url: [
      { 
        required: computed(() => state.editFormModel.job_type === CronJobType.HTTP), 
        message: '请输入请求URL' 
      },
      { type: 'url', message: '请输入有效的URL' },
    ],
    http_method: [
      { 
        required: computed(() => state.editFormModel.job_type === CronJobType.HTTP), 
        message: '请选择HTTP方法' 
      },
    ],
    script_type: [
      { 
        required: computed(() => state.editFormModel.job_type === CronJobType.SCRIPT), 
        message: '请选择脚本类型' 
      },
    ],
    script_content: [
      { 
        required: computed(() => state.editFormModel.job_type === CronJobType.SCRIPT), 
        message: '请输入脚本内容' 
      },
    ],
    ssh_resource_id: [
      { 
        required: computed(() => state.editFormModel.job_type === CronJobType.SSH), 
        message: '请选择SSH资源' 
      },
    ],
    ssh_command: [
      { 
        required: computed(() => state.editFormModel.job_type === CronJobType.SSH), 
        message: '请输入SSH命令' 
      },
    ],
  };

  // 工具函数
  const getStatusText = (status: CronJobStatus): string => {
    const statusMap: Record<CronJobStatus, string> = {
      [CronJobStatus.ENABLED]: '启用',
      [CronJobStatus.DISABLED]: '禁用',
      [CronJobStatus.RUNNING]: '运行中',
      [CronJobStatus.ERROR]: '错误',
    };
    return statusMap[status] || '未知';
  };

  const getStatusColor = (status: CronJobStatus): string => {
    const colorMap: Record<CronJobStatus, string> = {
      [CronJobStatus.ENABLED]: 'success',
      [CronJobStatus.DISABLED]: 'default',
      [CronJobStatus.RUNNING]: 'processing',
      [CronJobStatus.ERROR]: 'error',
    };
    return colorMap[status] || 'default';
  };

  const getJobTypeText = (jobType: CronJobType): string => {
    const typeMap: Record<CronJobType, string> = {
      [CronJobType.SYSTEM]: '系统任务',
      [CronJobType.COMMAND]: '命令行',
      [CronJobType.HTTP]: 'HTTP请求',
      [CronJobType.SCRIPT]: '脚本任务',
      [CronJobType.SSH]: 'SSH远程',
    };
    return typeMap[jobType] || '未知';
  };

  const getJobTypeColor = (jobType: CronJobType): string => {
    const colorMap: Record<CronJobType, string> = {
      [CronJobType.SYSTEM]: 'purple',
      [CronJobType.COMMAND]: 'blue',
      [CronJobType.HTTP]: 'green',
      [CronJobType.SCRIPT]: 'orange',
      [CronJobType.SSH]: 'cyan',
    };
    return colorMap[jobType] || 'default';
  };

  const getLastRunStatusText = (status: number): string => {
    const statusMap: Record<number, string> = {
      0: '未运行',
      1: '成功',
      2: '失败',
      3: '超时',
      4: '取消',
    };
    return statusMap[status] || '未知';
  };

  const getLastRunStatusColor = (status: number): string => {
    const colorMap: Record<number, string> = {
      0: 'default',
      1: 'success',
      2: 'error',
      3: 'warning',
      4: 'default',
    };
    return colorMap[status] || 'default';
  };

  const formatDateTime = (dateTimeStr: string): string => {
    if (!dateTimeStr) return '';
    try {
      const date = new Date(dateTimeStr);
      return date.toLocaleString('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });
    } catch (error) {
      console.error('格式化日期时间失败:', error);
      return dateTimeStr;
    }
  };

  const formatDuration = (duration: number): string => {
    if (!duration || duration === 0) return '0';
    
    if (duration < 1) {
      return (duration * 1000).toFixed(0); // 毫秒
    } else if (duration < 60) {
      return duration.toFixed(2); // 秒
    } else if (duration < 3600) {
      const minutes = Math.floor(duration / 60);
      const seconds = (duration % 60).toFixed(0);
      return `${minutes}分${seconds}`;
    } else {
      const hours = Math.floor(duration / 3600);
      const minutes = Math.floor((duration % 3600) / 60);
      return `${hours}小时${minutes}分`;
    }
  };



  // 数据获取
  const fetchCronJobs = async (resetPage = false) => {
    if (resetPage) {
      state.currentPage = 1;
    }
    
    try {
      state.loading = true;
      state.error = null;
      
      const params = {
        page: state.currentPage,
        size: state.pageSize,
        status: state.filterStatus,
        job_type: state.filterJobType,
        search: state.searchText || undefined,
      };
      
      const response = await getCronJobList(params);
      // 根据实际API返回结构处理数据
      state.cronJobs = response.data?.items || response.items || [];
      state.total = response.data?.total || response.total || 0;
    } catch (error: any) {
      console.error('获取定时任务列表失败:', error);
      
      // 根据错误类型提供不同的处理
      if (error?.response?.status === 401) {
        state.error = '登录已过期，请重新登录';
        message.warning('登录已过期，请重新登录');
      } else if (error?.response?.status === 403) {
        state.error = '没有权限访问定时任务功能';
        message.error('没有权限访问定时任务功能');
      } else if (error?.response?.status === 400) {
        state.error = '请求参数错误，请检查筛选条件';
        message.error('请求参数错误，请检查筛选条件');
      } else if (error?.response?.status >= 500) {
        state.error = '服务器内部错误，请稍后重试';
        message.error('服务器内部错误，请稍后重试');
      } else if (error?.message?.includes('Network Error') || error?.code === 'ECONNABORTED') {
        state.error = '网络连接失败，请检查网络后重试';
        message.error('网络连接失败，请检查网络后重试');
      } else {
        state.error = '获取定时任务列表失败，请刷新重试';
        message.error('获取定时任务列表失败，请刷新重试');
      }
      
      state.cronJobs = [];
      state.total = 0;
    } finally {
      state.loading = false;
    }
  };

  const fetchSshResources = async () => {
    try {
      state.sshResourcesLoading = true;
      const response = await getTreeLocalList({
        page: 1,
        size: 1000, // 获取足够多的SSH资源
        status: 1, // 只获取启用的资源
      });
      // 根据实际API返回结构处理数据
      const items = response.data?.items || response.items || [];
      state.sshResources = items;
      state.filteredSshResources = items;
    } catch (error: any) {
      console.error('获取SSH资源列表失败:', error);
      if (error?.response?.status === 401) {
        message.warning('获取SSH资源失败：登录已过期');
      } else if (error?.response?.status === 403) {
        message.error('没有权限获取SSH资源');
      } else {
        message.error('获取SSH资源列表失败，请稍后重试');
      }
      state.sshResources = [];
      state.filteredSshResources = [];
    } finally {
      state.sshResourcesLoading = false;
    }
  };

  // SSH资源搜索
  const searchSshResources = (searchText: string) => {
    state.sshSearchText = searchText;
    if (!searchText) {
      state.filteredSshResources = [...state.sshResources];
    } else {
      const searchLower = searchText.toLowerCase();
      state.filteredSshResources = state.sshResources.filter(resource =>
        resource.name.toLowerCase().includes(searchLower) ||
        resource.ip_addr.toLowerCase().includes(searchLower) ||
        (resource.description && resource.description.toLowerCase().includes(searchLower))
      );
    }
  };


  // 详情操作
  const showJobDetail = async (job: CronJob) => {
    try {
      state.detailLoading = true;
      state.isDetailModalVisible = true;
      const response = await getCronJobDetail({ id: job.id });
      state.currentJobDetail = response;
    } catch (error) {
      message.error('获取任务详情失败');
      console.error('获取任务详情失败:', error);
    } finally {
      state.detailLoading = false;
    }
  };

  const closeDetailModal = () => {
    state.isDetailModalVisible = false;
    state.currentJobDetail = null;
  };

  // 创建操作
  const openCreateModal = () => {
    state.createFormModel = createInitialFormModel();
    state.isCreateModalVisible = true;
  };

  const closeCreateModal = () => {
    state.isCreateModalVisible = false;
    state.createFormModel = createInitialFormModel();
  };

  const submitCreateForm = async () => {
    try {
      await formRef.value?.validate();
      state.submitLoading = true;
      
      await createCronJob(state.createFormModel);
      message.success('🎉 定时任务创建成功');
      
      closeCreateModal();
      await fetchCronJobs();
    } catch (error: any) {
      if (error?.errorFields) {
        message.error('请检查表单输入');
      } else {
        message.error('❌ 定时任务创建失败');
        console.error('创建定时任务失败:', error);
      }
    } finally {
      state.submitLoading = false;
    }
  };

  // 编辑操作
  const openEditModal = async (job: CronJob) => {
    try {
      state.submitLoading = true;
      const response = await getCronJobDetail({ id: job.id });
      const jobDetail = response;
      
      state.editFormModel = {
        id: jobDetail.id,
        name: jobDetail.name,
        description: jobDetail.description,
        job_type: jobDetail.job_type,
        schedule: jobDetail.schedule,
        timeout: jobDetail.timeout,
        max_retry: jobDetail.max_retry,
        command: jobDetail.command,
        args: jobDetail.args,
        work_dir: jobDetail.work_dir,
        environment: jobDetail.environment,
        http_method: jobDetail.http_method,
        http_url: jobDetail.http_url,
        http_headers: jobDetail.http_headers,
        http_body: jobDetail.http_body,
        script_type: jobDetail.script_type,
        script_content: jobDetail.script_content,
        ssh_resource_id: jobDetail.ssh_resource_id,
        ssh_command: jobDetail.ssh_command,
        ssh_work_dir: jobDetail.ssh_work_dir,
        ssh_environment: jobDetail.ssh_environment,
      };
      
      state.isEditModalVisible = true;
    } catch (error) {
      message.error('获取任务详情失败');
      console.error('获取任务详情失败:', error);
    } finally {
      state.submitLoading = false;
    }
  };

  const closeEditModal = () => {
    state.isEditModalVisible = false;
    state.editFormModel = createInitialEditFormModel();
  };

  const submitEditForm = async () => {
    try {
      await formRef.value?.validate();
      state.submitLoading = true;
      
      await updateCronJob(state.editFormModel);
      message.success('🎉 定时任务更新成功');
      
      closeEditModal();
      await fetchCronJobs();
    } catch (error: any) {
      if (error?.errorFields) {
        message.error('请检查表单输入');
      } else {
        message.error('❌ 定时任务更新失败');
        console.error('更新定时任务失败:', error);
      }
    } finally {
      state.submitLoading = false;
    }
  };

  // 任务操作
  const deleteJob = (job: CronJob) => {
    Modal.confirm({
      title: '删除确认',
      content: `确定要删除定时任务 "${job.name}" 吗？此操作不可恢复。`,
      okText: '确认删除',
      okType: 'danger',
      cancelText: '取消',
      centered: true,
      onOk: async () => {
        try {
          await deleteCronJob({ id: job.id });
          message.success(`🗑️ 定时任务 "${job.name}" 删除成功`);
          await fetchCronJobs();
        } catch (error) {
          message.error(`❌ 定时任务删除失败`);
          console.error('删除定时任务失败:', error);
        }
      },
    });
  };

  const enableJob = async (job: CronJob) => {
    try {
      await enableCronJob({ id: job.id });
      message.success(`✅ 定时任务 "${job.name}" 启用成功`);
      await fetchCronJobs();
    } catch (error) {
      message.error(`❌ 定时任务启用失败`);
      console.error('启用定时任务失败:', error);
    }
  };

  const disableJob = async (job: CronJob) => {
    try {
      await disableCronJob({ id: job.id });
      message.success(`⏸️ 定时任务 "${job.name}" 禁用成功`);
      await fetchCronJobs();
    } catch (error) {
      message.error(`❌ 定时任务禁用失败`);
      console.error('禁用定时任务失败:', error);
    }
  };

  const triggerJob = (job: CronJob) => {
    Modal.confirm({
      title: '执行确认',
      content: `确定要立即执行定时任务 "${job.name}" 吗？`,
      okText: '确认执行',
      okType: 'primary',
      cancelText: '取消',
      centered: true,
      onOk: async () => {
        try {
          await triggerCronJob({ id: job.id });
          message.success(`🚀 定时任务 "${job.name}" 触发成功`);
          await fetchCronJobs();
        } catch (error) {
          message.error(`❌ 定时任务触发失败`);
          console.error('触发定时任务失败:', error);
        }
      },
    });
  };



  // 批量操作
  const batchOperation = (operation: string) => {
    if (state.selectedRows.length === 0) {
      message.warning('请先选择要操作的任务');
      return;
    }

    const jobNames = state.selectedRows.map(job => job.name).join('、');
    
    Modal.confirm({
      title: `批量${operation}确认`,
      content: `确定要${operation}以下定时任务吗？\n${jobNames}`,
      okText: `确认${operation}`,
      okType: operation === '删除' ? 'danger' : 'primary',
      cancelText: '取消',
      centered: true,
      onOk: async () => {
        try {
          const promises = state.selectedRows.map(job => {
            switch (operation) {
              case '删除':
                return deleteCronJob({ id: job.id });
              case '启用':
                return enableCronJob({ id: job.id });
              case '禁用':
                return disableCronJob({ id: job.id });
              default:
                return Promise.resolve();
            }
          });

          await Promise.all(promises);
          message.success(`🎉 批量${operation}成功`);
          
          // 清空选中状态
          state.selectedRows = [];
          state.selectedRowKeys = [];
          
          await fetchCronJobs();
        } catch (error) {
          message.error(`❌ 批量${operation}失败`);
          console.error(`批量${operation}失败:`, error);
        }
      },
    });
  };

  // 分页操作
  const handlePageChange = (page: number, pageSize?: number) => {
    state.currentPage = page;
    if (pageSize) {
      state.pageSize = pageSize;
    }
    fetchCronJobs();
  };

  // 日志分页操作

  // 表单操作
  const validateScheduleExpression = async () => {
    if (!state.createFormModel.schedule) return;
    
    try {
      const response = await validateSchedule({ schedule: state.createFormModel.schedule });
      const result = response;
      
      if (!result.valid) {
        message.error(`调度表达式验证失败：${result.error_message}`);
      } else {
        message.success('调度表达式验证通过');
        if (result.next_run_times?.length) {
          message.info(`下次执行时间：${result.next_run_times[0]}`);
        }
      }
    } catch (error) {
      message.error('调度表达式验证失败');
      console.error('验证调度表达式失败:', error);
    }
  };

  const handleJobTypeChange = () => {
    // 重置相关字段
    state.createFormModel.command = '';
    state.createFormModel.args = [];
    state.createFormModel.work_dir = '';
    state.createFormModel.environment = [];
    state.createFormModel.http_method = 'GET';
    state.createFormModel.http_url = '';
    state.createFormModel.http_headers = [];
    state.createFormModel.http_body = '';
    state.createFormModel.script_type = 'bash';
    state.createFormModel.script_content = '';
    state.createFormModel.ssh_resource_id = undefined;
    state.createFormModel.ssh_command = '';
    state.createFormModel.ssh_work_dir = '';
    state.createFormModel.ssh_environment = [];
  };

  // HTTP头部管理
  const addHttpHeader = () => {
    if (!state.createFormModel.http_headers) {
      state.createFormModel.http_headers = [];
    }
    state.createFormModel.http_headers.push({ key: '', value: '' });
  };

  const removeHttpHeader = (index: number) => {
    if (state.createFormModel.http_headers) {
      state.createFormModel.http_headers.splice(index, 1);
    }
  };

  // SSH环境变量管理
  const addSshEnvironment = () => {
    if (!state.createFormModel.ssh_environment) {
      state.createFormModel.ssh_environment = [];
    }
    state.createFormModel.ssh_environment.push({ key: '', value: '' });
  };

  const removeSshEnvironment = (index: number) => {
    if (state.createFormModel.ssh_environment) {
      state.createFormModel.ssh_environment.splice(index, 1);
    }
  };

  // 命令参数管理
  const addArg = () => {
    if (!state.createFormModel.args) {
      state.createFormModel.args = [];
    }
    state.createFormModel.args.push('');
  };

  const removeArg = (index: number) => {
    if (state.createFormModel.args) {
      state.createFormModel.args.splice(index, 1);
    }
  };

  // 环境变量管理（命令行任务用）
  const addEnvironment = () => {
    if (!state.createFormModel.environment) {
      state.createFormModel.environment = [];
    }
    state.createFormModel.environment.push({ key: '', value: '' });
  };

  const removeEnvironment = (index: number) => {
    if (state.createFormModel.environment) {
      state.createFormModel.environment.splice(index, 1);
    }
  };

  return {
    // 响应式状态
    ...toRefs(state),
    
    // 表单引用
    formRef,
    
    // 计算属性
    filteredCronJobs,
    rowSelection,
    
    // 表单验证规则
    createFormRules,
    editFormRules,
    
    // 工具函数
    getStatusText,
    getStatusColor,
    getJobTypeText,
    getJobTypeColor,
    getLastRunStatusText,
    getLastRunStatusColor,
    formatDateTime,
    formatDuration,
    
    // 数据操作
    fetchCronJobs,
    fetchSshResources,
    
    // 任务详情操作
    showJobDetail,
    closeDetailModal,
    
    
    // 创建操作
    openCreateModal,
    closeCreateModal,
    submitCreateForm,
    
    // 编辑操作
    openEditModal,
    closeEditModal,
    submitEditForm,
    
    // 任务操作
    deleteJob,
    enableJob,
    disableJob,
    triggerJob,
    
    // 批量操作
    batchOperation,
    
    // 分页操作
    handlePageChange,
    
    // 表单操作
    validateScheduleExpression,
    handleJobTypeChange,
    
    // HTTP头部管理
    addHttpHeader,
    removeHttpHeader,
    
    // SSH环境变量管理
    addSshEnvironment,
    removeSshEnvironment,
    
    // SSH资源搜索
    searchSshResources,
    
    // 命令参数管理
    addArg,
    removeArg,
    
    // 环境变量管理
    addEnvironment,
    removeEnvironment,
    
    // 常量
    CronJobStatus,
    CronJobType,
  };
}
