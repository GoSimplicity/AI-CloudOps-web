import { computed, reactive, ref, toRefs } from 'vue';
import { message, Modal } from 'ant-design-vue';
// import { useRouter } from 'vue-router'; // 暂时未使用
import type { FormInstance } from 'ant-design-vue';
import axios from 'axios';
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
import {
  isCanceledRequest,
  looksNotifiedByRequestLayer,
  shouldNotifyPageError,
} from '#/utils/permission/request-notice';

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
  filterStatus: CronJobStatus | undefined;
  filterJobType: CronJobType | undefined;

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

  // 后端是否允许本地命令/脚本任务（列表接口 allow_local_exec）
  allowLocalExec: boolean;
}

// 本地执行类任务：命令行(2)、脚本(4)，受后端 cron.allow_local_exec 开关控制
const LOCAL_EXEC_JOB_TYPES: CronJobType[] = [CronJobType.COMMAND, CronJobType.SCRIPT];
export const isLocalExecJobType = (jobType?: CronJobType) =>
  jobType !== undefined && LOCAL_EXEC_JOB_TYPES.includes(jobType);

// 列表接口未返回 allow_local_exec（旧版后端没有该开关）时按允许处理：
// 旧后端本来就能执行本地任务，前端不应凭空禁用；新后端在开关关闭时会显式返回 false，且写入/触发由后端兜底拒绝
export const resolveAllowLocalExec = (data: any): boolean =>
  typeof data?.allow_local_exec === 'boolean' ? data.allow_local_exec : true;

// 取后端返回的原始提示：业务码非 0 时响应解构抛出 `Error <HTTP状态>: <message>`。
// 不读 HTTP 错误的响应体 message：带 response 的 HTTP 错误已由请求层提示过，页面不再展示原文（见 shouldNotifyPageError）
export const getBackendErrorMessage = (error: any, fallback: string): string => {
  const raw = error?.message;
  if (typeof raw !== 'string' || !raw.trim()) return fallback;
  return raw.replace(/^Error \d{3}: /, '') || fallback;
};

// 请求层已提示 / 取消类的判断移到 utils/permission/request-notice.ts（FE-02b 全页面共用），
// 形状判断 looksNotifiedByRequestLayer（incr3 由 isNotifiedByRequestLayer 改名）在这里转导出，供本页用例使用
export { looksNotifiedByRequestLayer };

// 列表类请求（任务列表 / SSH 资源列表）各类失败对应的页面文案
interface ListFailureTexts {
  unauthorized: string;
  forbidden: string;
  badRequest: string;
  server: string;
  network: string;
  fallback: string;
}

// 按错误类型取页面文案；网络错误 / 超时含 ECONNABORTED、ETIMEDOUT 以及发出请求但没有响应的 axios 错误
const resolveListFailureText = (error: any, texts: ListFailureTexts): string => {
  const status = error?.response?.status;
  if (status === 401) return texts.unauthorized;
  if (status === 403) return texts.forbidden;
  if (status === 400) return texts.badRequest;
  if (status >= 500) return texts.server;
  if (
    !error?.response &&
    (error?.code === 'ECONNABORTED' ||
      error?.code === 'ETIMEDOUT' ||
      error?.message?.includes?.('Network Error') ||
      (axios.isAxiosError(error) && !!error.request))
  ) {
    return texts.network;
  }
  return texts.fallback;
};

// 列表类请求失败的统一处理：取消类静默（返回 null，不写错误状态）；
// 请求层已提示（HTTP 错误、网络错误 / 超时、已弹后端原文的业务错误，见 shouldNotifyPageError）页面不再弹；
// 其余由页面弹一条（401 用 warning），返回页面错误文案
const handleListFailure = (error: any, texts: ListFailureTexts): string | null => {
  if (isCanceledRequest(error)) return null;
  const text = resolveListFailureText(error, texts);
  if (shouldNotifyPageError(error)) {
    if (error?.response?.status === 401) message.warning(text);
    else message.error(text);
  }
  return text;
};

const CRON_LIST_FAILURE_TEXTS: ListFailureTexts = {
  unauthorized: '登录已过期，请重新登录',
  forbidden: '没有权限访问定时任务功能',
  badRequest: '请求参数错误，请检查筛选条件',
  server: '服务器内部错误，请稍后重试',
  network: '网络连接失败，请检查网络后重试',
  fallback: '获取定时任务列表失败，请刷新重试',
};

const SSH_LIST_FAILURE_TEXTS: ListFailureTexts = {
  unauthorized: '获取SSH资源失败：登录已过期',
  forbidden: '没有权限获取SSH资源',
  badRequest: '获取SSH资源列表失败，请稍后重试',
  server: '获取SSH资源列表失败，请稍后重试',
  network: '获取SSH资源列表失败，请稍后重试',
  fallback: '获取SSH资源列表失败，请稍后重试',
};

// 创建表单初始数据
const createInitialFormModel = (): CreateCronJobReq => ({
  name: '',
  description: '',
  job_type: CronJobType.HTTP,
  schedule: '',
  timeout: 300,
  max_retry: 3,
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
  job_type: CronJobType.HTTP,
  schedule: '',
  timeout: 300,
  max_retry: 3,
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

    allowLocalExec: true,
  });

  // 计算属性
  // 筛选和总数由后端统一计算，避免再筛当前页造成分页不一致
  const filteredCronJobs = computed(() => state.cronJobs);
  const rowSelection = computed(() => ({
    selectedRowKeys: state.selectedRowKeys,
    onChange: (keys: (number | string)[], rows: CronJob[]) => {
      state.selectedRowKeys = keys as number[];
      state.selectedRows = rows;
    },
  }));
  let pageGeneration = 0;
  let createRequest = 0;
  let listRequest = 0;
  let detailRequest = 0;
  let editRequest = 0;
  let sshRequest = 0;
  const clearPage = () => {
    pageGeneration++;
    createRequest++;
    listRequest++;
    detailRequest++;
    editRequest++;
    sshRequest++;
    state.cronJobs = [];
    state.total = 0;
    state.selectedRows = [];
    state.selectedRowKeys = [];
    state.currentJobDetail = null;
    state.isDetailModalVisible = false;
    state.isCreateModalVisible = false;
    state.isEditModalVisible = false;
    state.createFormModel = createInitialFormModel();
    state.editFormModel = createInitialEditFormModel();
    state.sshResources = [];
    state.filteredSshResources = [];
    state.loading = state.detailLoading = state.submitLoading = state.sshResourcesLoading = false;
    state.error = null;
    state.allowLocalExec = true;
  };

  // 开关关闭时，已有的命令行/脚本任务不可编辑、不可触发（后端会拒绝）
  const isLocalExecLocked = (job?: Pick<CronJob, 'job_type'> | null) =>
    !state.allowLocalExec && isLocalExecJobType(job?.job_type);

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
    const ticket = ++listRequest;
    state.selectedRows = [];
    state.selectedRowKeys = [];
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
      if (ticket !== listRequest) return;
      // 根据实际API返回结构处理数据
      state.cronJobs = response.data?.items || response.items || [];
      state.total = response.data?.total || response.total || 0;
      state.allowLocalExec = resolveAllowLocalExec(response.data ?? response);
    } catch (error: any) {
      if (ticket !== listRequest) return;
      // 列表加载双提示修复：取消类静默；请求层已提示（任意 HTTP 4xx/5xx、网络错误 / 超时含 ETIMEDOUT）
      // 页面只保留错误状态；业务错误（HTTP 200 + code≠0）由请求层弹后端原文一条，处理不变
      state.error = handleListFailure(error, CRON_LIST_FAILURE_TEXTS);
      state.cronJobs = [];
      state.total = 0;
    } finally {
      if (ticket === listRequest) state.loading = false;
    }
  };

  const fetchSshResources = async () => {
    const ticket = ++sshRequest;
    try {
      state.sshResourcesLoading = true;
      const response = await getTreeLocalList({
        page: 1,
        size: 1000, // 获取足够多的SSH资源
        status: 1, // 只获取启用的资源
      });
      if (ticket !== sshRequest) return;
      // 根据实际API返回结构处理数据
      const items = response.data?.items || response.items || [];
      state.sshResources = items;
      state.filteredSshResources = items;
    } catch (error: any) {
      if (ticket !== sshRequest) return;
      // 与任务列表同一口径：取消类静默，请求层已提示的不再叠加
      handleListFailure(error, SSH_LIST_FAILURE_TEXTS);
      state.sshResources = [];
      state.filteredSshResources = [];
    } finally {
      if (ticket === sshRequest) state.sshResourcesLoading = false;
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
    const ticket = ++detailRequest;
    state.currentJobDetail = null;
    try {
      state.detailLoading = true;
      state.isDetailModalVisible = true;
      const response = await getCronJobDetail({ id: job.id });
      if (ticket === detailRequest) state.currentJobDetail = response;
    } catch (error) {
      if (ticket === detailRequest && shouldNotifyPageError(error)) message.error('获取任务详情失败');

    } finally {
      if (ticket === detailRequest) state.detailLoading = false;
    }
  };

  const closeDetailModal = () => {
    detailRequest++;
    state.detailLoading = false;
    state.isDetailModalVisible = false;
    state.currentJobDetail = null;
  };

  // 创建操作
  const openCreateModal = () => {
    createRequest++;
    state.createFormModel = createInitialFormModel();
    state.isCreateModalVisible = true;
  };

  const closeCreateModal = () => {
    createRequest++;
    state.submitLoading = false;
    state.isCreateModalVisible = false;
    state.createFormModel = createInitialFormModel();
  };

  const submitCreateForm = async () => {
    const generation = pageGeneration;
    const ticket = createRequest;
    if (state.submitLoading || !state.isCreateModalVisible) return;
    state.submitLoading = true;
    try {
      await formRef.value?.validate();
      if (!state.isCreateModalVisible || generation !== pageGeneration || ticket !== createRequest) return;

      // job_type 显式随请求发送，后端为必填
      await createCronJob({ ...state.createFormModel, job_type: state.createFormModel.job_type });
      if (generation !== pageGeneration || ticket !== createRequest) return;
      message.success('定时任务创建成功');

      closeCreateModal();
      await fetchCronJobs();
    } catch (error: any) {
      if (generation !== pageGeneration || ticket !== createRequest) return;
      if (error?.errorFields) {
        if (shouldNotifyPageError(error)) message.error('请检查表单输入');
      } else {
        if (shouldNotifyPageError(error)) message.error(getBackendErrorMessage(error, '定时任务创建失败'));

      }
    } finally {
      if (generation === pageGeneration && ticket === createRequest) state.submitLoading = false;
    }
  };

  // 编辑操作
  const openEditModal = async (job: CronJob) => {
    if (isLocalExecLocked(job)) return;
    const ticket = ++editRequest;
    try {
      state.submitLoading = true;
      const response = await getCronJobDetail({ id: job.id });
      if (ticket !== editRequest) return;
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
      if (ticket === editRequest && shouldNotifyPageError(error)) message.error('获取任务详情失败');

    } finally {
      if (ticket === editRequest) state.submitLoading = false;
    }
  };

  const closeEditModal = () => {
    editRequest++;
    state.submitLoading = false;
    state.isEditModalVisible = false;
    state.editFormModel = createInitialEditFormModel();
  };

  const submitEditForm = async () => {
    const generation = pageGeneration;
    const ticket = editRequest;
    if (state.submitLoading || !state.isEditModalVisible) return;
    state.submitLoading = true;
    try {
      await formRef.value?.validate();
      if (!state.isEditModalVisible || generation !== pageGeneration || ticket !== editRequest) return;

      await updateCronJob({ ...state.editFormModel, job_type: state.editFormModel.job_type });
      if (generation !== pageGeneration || ticket !== editRequest) return;
      message.success('定时任务更新成功');

      closeEditModal();
      await fetchCronJobs();
    } catch (error: any) {
      if (generation !== pageGeneration || ticket !== editRequest) return;
      if (error?.errorFields) {
        if (shouldNotifyPageError(error)) message.error('请检查表单输入');
      } else {
        if (shouldNotifyPageError(error)) message.error(getBackendErrorMessage(error, '定时任务更新失败'));

      }
    } finally {
      if (generation === pageGeneration && ticket === editRequest) state.submitLoading = false;
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
          message.success(`定时任务 "${job.name}" 删除成功`);
          await fetchCronJobs();
        } catch (error) {
          if (shouldNotifyPageError(error)) message.error(`定时任务删除失败`);

        }
      },
    });
  };

  const enableJob = async (job: CronJob) => {
    try {
      await enableCronJob({ id: job.id });
      message.success(`定时任务 "${job.name}" 启用成功`);
      await fetchCronJobs();
    } catch (error) {
      if (shouldNotifyPageError(error)) message.error(`定时任务启用失败`);

    }
  };

  const disableJob = async (job: CronJob) => {
    try {
      await disableCronJob({ id: job.id });
      message.success(`定时任务 "${job.name}" 禁用成功`);
      await fetchCronJobs();
    } catch (error) {
      if (shouldNotifyPageError(error)) message.error(`定时任务禁用失败`);

    }
  };

  const triggerJob = (job: CronJob) => {
    if (isLocalExecLocked(job)) return;
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
          message.success(`定时任务 "${job.name}" 触发成功`);
          await fetchCronJobs();
        } catch (error) {
          if (shouldNotifyPageError(error)) message.error(getBackendErrorMessage(error, '定时任务触发失败'));

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

    if (!['删除', '启用', '禁用'].includes(operation)) return;
    const selected = state.selectedRows.map(job => ({ id: job.id, name: job.name }));
    const generation = pageGeneration;
    const jobNames = selected.map(job => job.name).join('、');

    Modal.confirm({
      title: `批量${operation}确认`,
      content: `确定要${operation}以下定时任务吗？\n${jobNames}`,
      okText: `确认${operation}`,
      okType: operation === '删除' ? 'danger' : 'primary',
      cancelText: '取消',
      centered: true,
      onOk: async () => {
        try {
          if (generation !== pageGeneration) return;
          const promises = selected.map(job => {
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

          const results = await Promise.allSettled(promises);
          if (generation !== pageGeneration) return;
          const failed = results.filter(result => result.status === 'rejected').length;
          if (failed) message.error(`批量${operation}：${results.length - failed} 项成功，${failed} 项失败，请核对后重试`);
          else message.success(`批量${operation}成功`);

          // 清空选中状态
          state.selectedRows = [];
          state.selectedRowKeys = [];

          await fetchCronJobs();
        } catch (error) {
          if (shouldNotifyPageError(error)) message.error(`批量${operation}失败`);

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
      if (shouldNotifyPageError(error)) message.error('调度表达式验证失败');

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
    clearPage,

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

    // 本地执行开关
    isLocalExecLocked,

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
