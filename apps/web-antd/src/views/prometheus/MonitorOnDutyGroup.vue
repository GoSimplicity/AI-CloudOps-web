<script setup lang="ts">
import {
  computed,
  onBeforeUnmount,
  onMounted,
  reactive,
  ref,
  toRaw,
  watch,
} from 'vue';
import { useRouter } from 'vue-router';

import { useUserStore } from '@vben/stores';
import { cloneDeep } from '@vben/utils';

import { DownOutlined, PlusOutlined } from '@ant-design/icons-vue';
import { Icon } from '@iconify/vue';
import { type FormInstance, message, Modal } from 'ant-design-vue';
import dayjs, { type Dayjs } from 'dayjs';

import {
  createMonitorOnDutyGroupApi,
  createMonitorOnDutyGroupChangeApi,
  type CreateMonitorOnDutyGroupChangeReq,
  type CreateMonitorOnDutyGroupReq,
  deleteMonitorOnDutyGroupApi,
  getMonitorOnDutyGroupChangeListApi,
  getMonitorOnDutyGroupDetailApi,
  getMonitorOnDutyGroupListApi,
  type GetMonitorOnDutyGroupListReq,
  getMonitorOnDutyHistoryApi,
  type MonitorOnDutyChange,
  type MonitorOnDutyGroup,
  type MonitorOnDutyHistory,
  updateMonitorOnDutyGroupApi,
  type UpdateMonitorOnDutyGroupReq,
} from '#/api/core/prometheus/prometheus_onduty';
import { getUserList, type GetUserListReq } from '#/api/core/system/user';
import OpsPage from '#/components/ops/OpsPage.vue';
import { useAuthStore } from '#/store';
import { getAvatarColor } from '#/utils/avatar-color';
import { usePermission } from '#/utils/permission';
import { shouldNotifyPageError } from '#/utils/permission/request-notice';

import { useListRequest } from './useListRequest';

const { can, hasPerm } = usePermission();

const operationOwner = (): string | undefined => {
  const userId = Number(useUserStore().userInfo?.userId);
  if (!Number.isSafeInteger(userId) || userId <= 0) return;
  return JSON.stringify([userId, useAuthStore().getAuthGeneration()]);
};
const validPositiveId = (value: unknown): value is number =>
  typeof value === 'number' && Number.isSafeInteger(value) && value > 0;
let disposed = false;
let changeWindowRevision = 0;
let changeReadRevision = 0;
let changeFormRevision = 0;
let changeUsersRevision = 0;
let userListRevision = 0;
let changeDialogOwner: string | undefined;
let changeFormOwner: string | undefined;
const changeSubmitting = ref(false);

const crudRevision = ref(0);
const crudSubmitting = ref(false);
let crudOwner: string | undefined;
let deleteDialog: ReturnType<typeof Modal.confirm> | undefined;
const statusTickets = new Map<number, symbol>();

const router = useRouter();

// 用户接口类型

// 响应式对话框宽度
const formDialogWidth = computed(() => {
  if (typeof window !== 'undefined') {
    const width = window.innerWidth;
    if (width < 768) return '95%';
    if (width < 1024) return '90%';
    return '700px';
  }
  return '700px';
});

const previewDialogWidth = computed(() => {
  if (typeof window !== 'undefined') {
    const width = window.innerWidth;
    if (width < 768) return '95%';
    if (width < 1024) return '90%';
    return '80%';
  }
  return '80%';
});

// 列定义
const columns = [
  { dataIndex: 'id', fixed: 'left', key: 'id', title: 'ID', width: 80 },
  { dataIndex: 'name', key: 'name', title: '值班组名称', width: 200 },
  { dataIndex: 'shift_info', key: 'shift_info', title: '值班信息', width: 150 },
  { dataIndex: 'users', key: 'users', title: '成员列表', width: 200 },
  {
    dataIndex: 'duty_status',
    key: 'duty_status',
    title: '值班状态',
    width: 200,
  },
  { dataIndex: 'enable', key: 'enable', title: '启用状态', width: 100 },
  {
    dataIndex: 'create_user_name',
    key: 'creator',
    title: '创建人',
    width: 120,
  },
  { dataIndex: 'created_at', key: 'createdAt', title: '创建时间', width: 180 },
  {
    align: 'center' as const,
    fixed: 'right',
    key: 'action',
    title: '操作',
    width: 240,
  },
];

// 调班记录列定义
const changeColumns = [
  { dataIndex: 'id', key: 'id', title: 'ID', width: 80 },
  { dataIndex: 'date', key: 'date', title: '日期', width: 120 },
  { dataIndex: 'users', key: 'users', title: '人员变更', width: 250 },
  { dataIndex: 'reason', key: 'reason', title: '调班原因', width: 200 },
  {
    dataIndex: 'create_user_name',
    key: 'creator',
    title: '创建人',
    width: 150,
  },
  { dataIndex: 'created_at', key: 'created_at', title: '创建时间', width: 180 },
];

// 值班历史列定义
const historyColumns = [
  { dataIndex: 'id', key: 'id', title: 'ID', width: 80 },
  { dataIndex: 'date_string', key: 'date', title: '日期', width: 120 },
  { dataIndex: 'users', key: 'users', title: '人员信息', width: 300 },
  { dataIndex: 'created_at', key: 'created_at', title: '记录时间', width: 180 },
];

// 状态数据
const data = ref<MonitorOnDutyGroup[]>([]);
const searchText = ref('');
const enableFilter = ref<1 | 2 | undefined>(undefined);
const loading = ref(false);
const { beginRequest, invalidate, loadError } = useListRequest(loading);
const addFormRef = ref<FormInstance>();
const editFormRef = ref<FormInstance>();
const createChangeFormRef = ref<FormInstance>();

// 防抖处理
let searchTimeout: null | ReturnType<typeof setTimeout> = null;
onBeforeUnmount(() => {
  if (searchTimeout) clearTimeout(searchTimeout);
});

// 分页配置
const paginationConfig = reactive({
  current: 1,
  pageSize: 10,
  total: 0,
  showSizeChanger: true,
  showQuickJumper: true,
  showTotal: (total: number) => `共 ${total} 条记录`,
  size: 'default' as const,
});

// 用户选择相关状态
const userOptions = ref<{ label: string; value: number }[]>([]);
const usersLoading = ref(false);
const userSearchText = ref('');

// 用户列表分页配置
const userPaginationConfig = reactive({
  current: 1,
  pageSize: 20,
  total: 0,
  hasMore: true,
});

// 用户数据缓存
const userCache = ref<Map<number, string>>(new Map());

// 计划用户选择相关状态
const planUserOptions = ref<{ label: string; value: string }[]>([]);

// 排班计划分页配置
const planPaginationConfig = reactive({
  current: 1,
  pageSize: 15,
  total: 0,
  showSizeChanger: true,
  showTotal: (total: number) => `共 ${total} 条记录`,
});

// 统计数据
const stats = reactive({
  total: 0,
  activeusers: 0,
  avgShiftDays: 0,
  todayOnDuty: 0,
});

// 对话框状态
const isAddModalVisible = ref(false);
const isEditModalVisible = ref(false);
const detailDialogVisible = ref(false);
const futurePlanDialogVisible = ref(false);
const historyDialogVisible = ref(false);
const changeDialogVisible = ref(false);
const isCreateChangeModalVisible = ref(false);

// 表单数据
const addForm = reactive<CreateMonitorOnDutyGroupReq>({
  name: '',
  user_ids: [],
  shift_days: 7,
  description: '',
});

const editForm = reactive<UpdateMonitorOnDutyGroupReq>({
  id: 0,
  name: '',
  shift_days: 7,
  user_ids: [],
  description: '',
  enable: 1,
});

const createChangeForm = reactive<{
  date: Dayjs | null;
  on_duty_group_id: number;
  on_duty_user_id: null | number;
  origin_user_id: null | number;
  reason: string;
}>({
  on_duty_group_id: 0,
  date: null,
  origin_user_id: null,
  on_duty_user_id: null,
  reason: '',
});

// 调班记录用户选择相关状态
const changeUserOptions = ref<{ label: string; value: number }[]>([]);
const changeUsersLoading = ref(false);
const changeUserSearchText = ref('');
const changeUserPagination = reactive({
  current: 1,
  hasMore: true,
  pageSize: 20,
  total: 0,
});

// 详情对话框数据
const detailDialog = reactive({
  data: null as MonitorOnDutyGroup | null,
});

// 未来排班计划对话框数据
const futurePlanDialog = reactive({
  data: null as any | null,
  groupId: 0,
  groupName: '',
  shiftDays: 0,
  availableUsers: [] as string[],
  loading: false,
});

// 值班历史对话框数据
const historyDialog = reactive({
  data: [] as MonitorOnDutyHistory[],
  groupId: 0,
  groupName: '',
  loading: false,
});

// 值班历史分页配置
const historyPaginationConfig = reactive({
  current: 1,
  pageSize: 10,
  total: 0,
  showSizeChanger: true,
  showQuickJumper: true,
  showTotal: (total: number) => `共 ${total} 条记录`,
});

// 调班记录对话框数据
const changeDialog = reactive({
  data: [] as MonitorOnDutyChange[],
  groupId: 0,
  groupName: '',
  loading: false,
});

// 调班记录分页配置
const changePaginationConfig = reactive({
  current: 1,
  pageSize: 10,
  total: 0,
  showSizeChanger: true,
  showQuickJumper: true,
  showTotal: (total: number) => `共 ${total} 条记录`,
});

// 排班计划筛选
const planDateFilter = ref<Dayjs | null>(null);
const planUserFilter = ref('');

// 值班历史筛选
const historyDateRange = ref<[Dayjs, Dayjs] | null>(null);

// 表单验证规则
const formRules = {
  name: [
    { message: '请输入值班组名称', required: true, trigger: 'blur' },
    {
      min: 1,
      max: 50,
      message: '长度应为1到50个字符',
      transform: (value: string) => value.trim(),
      trigger: 'blur',
    },
  ],
  shift_days: [
    {
      message: '请输入正整数轮班周期',
      min: 1,
      required: true,
      trigger: 'blur',
      type: 'integer' as const,
    },
  ],
  description: [
    {
      max: 255,
      message: '描述最多255个字符',
      transform: (value?: string) => value?.trim(),
      trigger: 'blur',
    },
  ],
  user_ids: [
    { message: '请选择至少一个值班成员', required: true, trigger: 'change' },
  ],
};

const changeFormRules = {
  date: [{ message: '请选择调班日期', required: true, trigger: 'change' }],
  origin_user_id: [
    { message: '请选择原值班人员', required: true, trigger: 'change' },
  ],
  on_duty_user_id: [
    { message: '请选择调班后人员', required: true, trigger: 'change' },
  ],
};

const captureChangeWindow = () => {
  const groupId = changeDialog.groupId;
  const owner = changeDialogOwner;
  if (
    disposed ||
    !changeDialogVisible.value ||
    !owner ||
    owner !== operationOwner() ||
    !validPositiveId(groupId)
  )
    return;
  return { groupId, owner, revision: changeWindowRevision };
};
type ChangeWindow = NonNullable<ReturnType<typeof captureChangeWindow>>;
const ownsChangeWindow = (window: ChangeWindow) =>
  !disposed &&
  changeDialogVisible.value &&
  changeWindowRevision === window.revision &&
  changeDialog.groupId === window.groupId &&
  changeDialogOwner === window.owner &&
  operationOwner() === window.owner;

const invalidateChangeForm = () => {
  ++changeFormRevision;
  ++changeUsersRevision;
  changeFormOwner = undefined;
  changeSubmitting.value = false;
  changeUsersLoading.value = false;
  changeUserOptions.value = [];
  isCreateChangeModalVisible.value = false;
  Object.assign(createChangeForm, {
    date: null,
    on_duty_group_id: 0,
    on_duty_user_id: null,
    origin_user_id: null,
    reason: '',
  });
};
const invalidateChangeWindow = () => {
  ++changeWindowRevision;
  ++changeReadRevision;
  changeDialogOwner = undefined;
  invalidateChangeForm();
  changeDialogVisible.value = false;
  changeDialog.data = [];
  changeDialog.groupId = 0;
  changeDialog.groupName = '';
  changeDialog.loading = false;
  changePaginationConfig.current = 1;
  changePaginationConfig.total = 0;
};
watch(
  operationOwner,
  () => {
    invalidateChangeWindow();
    invalidateCrud();
    statusTickets.clear();
    addForm.user_ids = [];
    editForm.user_ids = [];
    addForm.name = '';
    editForm.name = '';
    addForm.description = '';
    editForm.description = '';
    editForm.id = 0;
    invalidate();
    data.value = [];
    paginationConfig.total = 0;
    updateStats();
    ++userListRevision;
    userOptions.value = [];
    userCache.value.clear();
    usersLoading.value = false;
  },
  { flush: 'sync' },
);
onBeforeUnmount(() => {
  disposed = true;
  invalidateChangeWindow();
  invalidateCrud();
  ++userListRevision;
});

interface ChangeUserOptionSource {
  id?: number;
  real_name?: string;
  realName?: string;
  user_id?: number;
  userId?: number;
  username?: string;
}
const fetchChangeUsers = async (page = 1, search = ''): Promise<void> => {
  const window = captureChangeWindow();
  const formRevision = changeFormRevision;
  const owner = changeFormOwner;
  if (!window || !isCreateChangeModalVisible.value || owner !== window.owner)
    return;
  const ticket = ++changeUsersRevision;
  const isCurrent = () =>
    ownsChangeWindow(window) &&
    ticket === changeUsersRevision &&
    formRevision === changeFormRevision &&
    isCreateChangeModalVisible.value &&
    changeFormOwner === owner;
  changeUsersLoading.value = true;
  try {
    const response = await getUserList({
      page,
      search,
      size: changeUserPagination.pageSize,
    });
    if (!isCurrent()) return;
    const items = response?.items || response?.list || response?.data || [];
    const options = Array.isArray(items)
      ? items.flatMap((user: ChangeUserOptionSource) => {
          const id = user.id ?? user.userId ?? user.user_id;
          if (!validPositiveId(id)) return [];
          const label =
            user.real_name || user.username || user.realName || `用户${id}`;
          userCache.value.set(id, label);
          return [{ label, value: id }];
        })
      : [];
    changeUserOptions.value =
      page === 1
        ? options
        : [
            ...changeUserOptions.value,
            ...options.filter(
              (option) =>
                !changeUserOptions.value.some(
                  (existing) => existing.value === option.value,
                ),
            ),
          ];
    changeUserPagination.current = page;
    changeUserPagination.total = response?.total || response?.count || 0;
    changeUserPagination.hasMore =
      page * changeUserPagination.pageSize < changeUserPagination.total;
  } catch (error: unknown) {
    if (isCurrent() && shouldNotifyPageError(error))
      message.error('获取调班用户列表失败');
  } finally {
    if (isCurrent()) changeUsersLoading.value = false;
  }
};

// 计算属性 - 筛选后的未来排班
const filteredFuturePlans = computed(() => {
  if (!futurePlanDialog.data?.details) return [];

  let plans = [...futurePlanDialog.data.details];

  // 按日期筛选
  if (planDateFilter.value) {
    const filterDate = dayjs(planDateFilter.value).format('YYYY-MM-DD');
    plans = plans.filter((plan: any) => plan.date === filterDate);
  }

  // 按用户筛选
  if (planUserFilter.value) {
    plans = plans.filter(
      (plan: any) => plan.user?.username === planUserFilter.value,
    );
  }

  // 更新计划分页总数
  planPaginationConfig.total = plans.length;

  // 应用分页
  const startIndex =
    (planPaginationConfig.current - 1) * planPaginationConfig.pageSize;
  const endIndex = startIndex + planPaginationConfig.pageSize;
  return plans.slice(startIndex, endIndex);
});

const getInitials = (name: string): string => {
  if (!name) return '';
  return name.slice(0, 2).toUpperCase();
};

const formatDate = (timestamp: number | string): string => {
  if (!timestamp) return '';
  // 如果是字符串，直接解析；如果是数字，按Unix时间戳处理
  const date =
    typeof timestamp === 'string' ? dayjs(timestamp) : dayjs(timestamp * 1000);
  return date.format('YYYY-MM-DD');
};

const formatTime = (timestamp: number | string): string => {
  if (!timestamp) return '';
  // 如果是字符串，直接解析；如果是数字，按Unix时间戳处理
  const date =
    typeof timestamp === 'string' ? dayjs(timestamp) : dayjs(timestamp * 1000);
  return date.format('HH:mm');
};

const formatFullDateTime = (timestamp: number | string): string => {
  if (!timestamp) return '';
  // 如果是字符串，直接解析；如果是数字，按Unix时间戳处理
  const date =
    typeof timestamp === 'string' ? dayjs(timestamp) : dayjs(timestamp * 1000);
  return date.format('YYYY-MM-DD HH:mm:ss');
};

const formatPlanDate = (date: string): string => {
  return dayjs(date).format('MM-DD');
};

const formatPlanWeekday = (date: string): string => {
  if (!date) return '';
  const weekdays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
  return weekdays[dayjs(date).day()] || '';
};

const isToday = (date: string): boolean => {
  return dayjs(date).isSame(dayjs(), 'day');
};

const isTomorrow = (date: string): boolean => {
  return dayjs(date).isSame(dayjs().add(1, 'day'), 'day');
};

const getPlanTimelineColor = (date: string, index: number): string => {
  if (isToday(date)) return 'red';
  if (isTomorrow(date)) return 'orange';
  return index % 2 === 0 ? 'blue' : 'green';
};

const getCycleDay = (index: number): number => {
  return (index % futurePlanDialog.shiftDays) + 1;
};

const filterOption = (input: string, option: any) => {
  return option.value.toLowerCase().indexOf(input.toLowerCase()) >= 0;
};

// 更新统计数据
function updateStats(): void {
  stats.total = paginationConfig.total;

  if (data.value.length > 0) {
    const currentPageActiveusers = data.value.reduce(
      (total, item) => total + (item.users?.length || 0),
      0,
    );
    const currentPageAvgShiftDays = Math.round(
      data.value.reduce((sum, item) => sum + item.shift_days, 0) /
        data.value.length,
    );
    const currentPageTodayOnDuty = data.value.filter(
      (item) => item.today_duty_user,
    ).length;

    stats.activeusers = currentPageActiveusers;
    stats.avgShiftDays = currentPageAvgShiftDays;
    stats.todayOnDuty = currentPageTodayOnDuty;
  } else {
    stats.activeusers = 0;
    stats.avgShiftDays = 0;
    stats.todayOnDuty = 0;
  }
}

// 数据加载
const fetchOnDutyGroups = async (): Promise<void> => {
  const owner = operationOwner();
  if (disposed || !owner) return;
  const request = beginRequest();
  try {
    const params: GetMonitorOnDutyGroupListReq = {
      page: paginationConfig.current,
      size: paginationConfig.pageSize,
      search: searchText.value.trim() || undefined,
      enable: enableFilter.value,
    };
    const response = await getMonitorOnDutyGroupListApi(params);
    if (!request.isCurrent() || owner !== operationOwner()) return;

    if (response && response.items) {
      data.value = response.items;
      paginationConfig.total = response.total || 0;
      updateStats();
    } else {
      data.value = [];
      paginationConfig.total = 0;
      updateStats();
      if (!response) {
        message.warning('获取值班组列表失败，请稍后重试');
      }
    }
  } catch (error: any) {
    if (
      owner !== operationOwner() ||
      !request.fail(new Error('获取值班组列表失败'), '获取值班组列表失败')
    )
      return;
    data.value = [];
    paginationConfig.total = 0;
    updateStats();
    if (shouldNotifyPageError(error)) message.error(loadError.value);
  } finally {
    request.finish();
  }
};

const fetchUserList = async (page = 1, search = ''): Promise<void> => {
  const owner = operationOwner();
  if (!owner || disposed) return;
  const revision = crudRevision.value;
  const ticket = ++userListRevision;
  const isCurrent = () =>
    !disposed &&
    ticket === userListRevision &&
    owner === operationOwner() &&
    revision === crudRevision.value;
  try {
    usersLoading.value = true;
    const req: GetUserListReq = {
      page,
      size: userPaginationConfig.pageSize,
      search: search || '',
    };
    const res = await getUserList(req);
    if (!isCurrent()) return;

    // 处理返回数据
    const items = res?.items || res?.list || res?.data || [];
    const total = res?.total || res?.count || 0;

    const newOptions = items.flatMap(
      (user: {
        id?: number;
        real_name?: string;
        realName?: string;
        user_id?: number;
        userId?: number;
        username?: string;
      }) => {
        const userId = user.id ?? user.userId ?? user.user_id;
        if (!validPositiveId(userId)) return [];
        const userName =
          user.real_name || user.username || user.realName || `用户${userId}`;

        // 缓存用户信息
        userCache.value.set(userId, userName);

        return [{ value: userId, label: userName }];
      },
    );

    if (page === 1) {
      userOptions.value = newOptions;
    } else {
      const existingIds = new Set(userOptions.value.map((opt) => opt.value));
      userOptions.value = [
        ...userOptions.value,
        ...newOptions.filter((opt: any) => !existingIds.has(opt.value)),
      ];
    }

    userPaginationConfig.total = total;
    userPaginationConfig.hasMore = page * userPaginationConfig.pageSize < total;
  } catch (error: any) {
    if (!isCurrent()) return;
    if (shouldNotifyPageError(error)) message.error('获取用户列表失败');
  } finally {
    if (isCurrent()) usersLoading.value = false;
  }
};

// 处理用户选择下拉框滚动
const handleUserSelectScroll = (e: any): void => {
  const { target } = e;
  if (target.scrollTop + target.offsetHeight >= target.scrollHeight - 20) {
    if (userPaginationConfig.hasMore && !usersLoading.value) {
      userPaginationConfig.current += 1;
      fetchUserList(userPaginationConfig.current, userSearchText.value);
    }
  }
};

// 处理用户搜索
const handleUserSearch = (value: string): void => {
  userSearchText.value = value;
  userPaginationConfig.current = 1;
  userPaginationConfig.hasMore = true;
  fetchUserList(1, value);
};

// 处理调班记录用户选择下拉框滚动
const handleChangeUserSelectScroll = (e: any): void => {
  const { target } = e;
  if (target.scrollTop + target.offsetHeight >= target.scrollHeight - 20) {
    if (changeUserPagination.hasMore && !changeUsersLoading.value) {
      fetchChangeUsers(
        changeUserPagination.current + 1,
        changeUserSearchText.value,
      );
    }
  }
};

// 处理调班记录用户搜索
const handleChangeUserSearch = (value: string): void => {
  changeUserSearchText.value = value;
  changeUserPagination.current = 1;
  changeUserPagination.hasMore = true;
  fetchChangeUsers(1, value);
};

// 获取值班组详情
// 获取未来排班计划

// 获取值班历史
const fetchOnDutyHistory = async (
  id: number,
  startDate?: string,
  endDate?: string,
  page = 1,
  append = false,
): Promise<void> => {
  try {
    historyDialog.loading = true;

    // 构建API请求参数
    const apiParams: {
      end_date?: string;
      page?: number;
      size?: number;
      start_date?: string;
    } = {
      page,
      size: historyPaginationConfig.pageSize,
    };

    if (startDate) apiParams.start_date = startDate;
    if (endDate) apiParams.end_date = endDate;

    const response = await getMonitorOnDutyHistoryApi(id, apiParams);

    if (response && response.items) {
      historyDialog.data = append
        ? [...historyDialog.data, ...response.items]
        : response.items;
      historyPaginationConfig.total = response.total || 0;
      historyPaginationConfig.current = page;
    } else {
      if (!append) {
        historyDialog.data = [];
      }
      historyPaginationConfig.total = 0;
      if (!response) {
        message.warning('获取值班历史失败，请稍后重试');
      }
    }
  } catch (error: any) {
    if (shouldNotifyPageError(error))
      message.error(error.message || '获取值班历史失败');
    if (!append) {
      historyDialog.data = [];
    }
    historyPaginationConfig.total = 0;
  } finally {
    historyDialog.loading = false;
  }
};

// 获取调班记录
const fetchChangeRecords = async (page = 1, append = false): Promise<void> => {
  const context = captureChangeWindow();
  if (!context || !hasPerm('/api/monitor/onduty_groups/changes/:id')) return;
  const ticket = ++changeReadRevision;
  const ownsRequest = () =>
    ownsChangeWindow(context) && ticket === changeReadRevision;
  const isCurrent = () =>
    ownsRequest() && hasPerm('/api/monitor/onduty_groups/changes/:id');
  try {
    changeDialog.loading = true;

    const response = await getMonitorOnDutyGroupChangeListApi(context.groupId, {
      page,
      size: changePaginationConfig.pageSize,
    });
    if (!isCurrent()) return;

    if (response && response.items) {
      changeDialog.data = append
        ? [...changeDialog.data, ...response.items]
        : response.items;
      changePaginationConfig.total = response.total || 0;
      changePaginationConfig.current = page;
    } else {
      if (!append) {
        changeDialog.data = [];
      }
      changePaginationConfig.total = 0;
      if (!response) {
        message.warning('获取调班记录失败，请稍后重试');
      }
    }
  } catch (error: any) {
    if (!isCurrent()) return;
    if (shouldNotifyPageError(error))
      message.error(error.message || '获取调班记录失败');
    if (!append) {
      changeDialog.data = [];
    }
    changePaginationConfig.total = 0;
  } finally {
    if (ownsRequest()) changeDialog.loading = false;
  }
};

// 事件处理
const handleTableChange = (pagination: any): void => {
  paginationConfig.current = pagination.current;
  paginationConfig.pageSize = pagination.pageSize;
  fetchOnDutyGroups();
};

const handleChangeTableChange = (pagination: any): void => {
  changePaginationConfig.current = pagination.current;
  changePaginationConfig.pageSize = pagination.pageSize;
  fetchChangeRecords(pagination.current);
};

const handleSearch = (): void => {
  paginationConfig.current = 1;
  fetchOnDutyGroups();
};

const handleSearchChange = (): void => {
  if (searchTimeout) {
    clearTimeout(searchTimeout);
  }
  searchTimeout = setTimeout(() => {
    paginationConfig.current = 1;
    fetchOnDutyGroups();
  }, 500);
};

const handleEnableFilterChange = (): void => {
  paginationConfig.current = 1;
  fetchOnDutyGroups();
};

const handleReset = (): void => {
  searchText.value = '';
  enableFilter.value = undefined;
  paginationConfig.current = 1;
  fetchOnDutyGroups();
};

const handleEnableChange = async (
  record: MonitorOnDutyGroup & { statusLoading?: boolean },
  checked: boolean,
): Promise<void> => {
  const owner = operationOwner();
  const id = record.id;
  if (!owner || disposed || !validPositiveId(id) || statusTickets.has(id))
    return;
  const userIds = record.users?.map((user) => user.id) ?? [];
  const payload: UpdateMonitorOnDutyGroupReq = {
    description: record.description,
    enable: checked ? 1 : 2,
    id,
    name: record.name,
    shift_days: record.shift_days,
    user_ids: [...userIds],
  };
  if (!validGroupPayload(payload)) {
    message.error('值班组信息不合法');
    return;
  }
  const fingerprint = JSON.stringify({ ...payload, enable: record.enable });
  const ticket = Symbol('status-request');
  statusTickets.set(id, ticket);
  const ownsRequest = () =>
    !disposed && owner === operationOwner() && statusTickets.get(id) === ticket;
  const current = () =>
    ownsRequest() &&
    data.value.includes(record) &&
    fingerprint ===
      JSON.stringify({
        description: record.description,
        enable: record.enable,
        id: record.id,
        name: record.name,
        shift_days: record.shift_days,
        user_ids: record.users?.map((user) => user.id) ?? [],
      });
  record.statusLoading = true;
  try {
    await updateMonitorOnDutyGroupApi(payload);
    if (!current()) return;
    record.enable = checked ? 1 : 2;
    message.success(`值班组已${checked ? '启用' : '禁用'}`);
  } catch (error: unknown) {
    if (current() && shouldNotifyPageError(error))
      message.error('更新值班组状态失败');
  } finally {
    if (ownsRequest()) {
      record.statusLoading = false;
      statusTickets.delete(id);
    }
  }
};

const handleViewDetail = async (record: MonitorOnDutyGroup): Promise<void> => {
  const id = record.id;
  if (!validPositiveId(id)) {
    message.error('记录ID不合法');
    return;
  }
  if (!beginCrud()) return;
  const current = captureCrud();
  detailDialog.data = null;
  detailDialogVisible.value = true;
  try {
    const response = await getMonitorOnDutyGroupDetailApi(id);
    if (!current()) return;
    if (!response || response.id !== id)
      throw new Error('Invalid group response');
    detailDialog.data = response;
  } catch (error: unknown) {
    if (current()) {
      detailDialogVisible.value = false;
      if (shouldNotifyPageError(error)) message.error('获取值班组详情失败');
    }
  }
};

// 查看未来排班计划
const handleViewFuturePlan = async (
  record: MonitorOnDutyGroup,
): Promise<void> => {
  router.push({
    path: '/monitor_onduty_group_table',
    query: { id: record.id.toString() },
  });
};

// 查看值班历史
const handleViewHistory = async (record: MonitorOnDutyGroup): Promise<void> => {
  historyDialog.groupId = record.id;
  historyDialog.groupName = record.name;
  historyPaginationConfig.current = 1;
  await fetchOnDutyHistory(record.id, undefined, undefined, 1);
  historyDialogVisible.value = true;
};

// 从详情页面查看排班计划
const handleViewFuturePlanFromDetail = async (): Promise<void> => {
  if (detailDialog.data) {
    router.push({
      path: '/monitor_onduty_group_table',
      query: { id: detailDialog.data.id.toString() },
    });
  }
};

// 从详情页面查看历史
const handleViewHistoryFromDetail = async (): Promise<void> => {
  if (detailDialog.data) {
    historyDialog.groupId = detailDialog.data.id;
    historyDialog.groupName = detailDialog.data.name;
    historyPaginationConfig.current = 1;
    await fetchOnDutyHistory(detailDialog.data.id, undefined, undefined, 1);
    detailDialogVisible.value = false;
    historyDialogVisible.value = true;
  }
};

// 排班计划筛选处理
const handlePlanDateChange = (): void => {
  planPaginationConfig.current = 1;
};

const handlePlanUserChange = (): void => {
  planPaginationConfig.current = 1;
};

const resetPlanFilters = (): void => {
  planDateFilter.value = null;
  planUserFilter.value = '';
  planPaginationConfig.current = 1;
};

// 处理排班计划分页变化
const handlePlanPaginationChange = (
  current: number,
  pageSize: number,
): void => {
  planPaginationConfig.current = current;
  planPaginationConfig.pageSize = pageSize;
};

// 处理历史日期筛选
const handleHistoryDateChange = (dates: [Dayjs, Dayjs] | null): void => {
  if (dates && historyDialog.groupId) {
    const startDate = dates[0].format('YYYY-MM-DD');
    const endDate = dates[1].format('YYYY-MM-DD');
    historyPaginationConfig.current = 1;
    fetchOnDutyHistory(historyDialog.groupId, startDate, endDate, 1);
  }
};

const resetHistoryFilters = (): void => {
  historyDateRange.value = null;
  if (historyDialog.groupId) {
    historyPaginationConfig.current = 1;
    fetchOnDutyHistory(historyDialog.groupId, undefined, undefined, 1);
  }
};

// 处理历史记录分页变化

// 处理历史分页页码变化
const handleHistoryPageChange = (page: number): void => {
  historyPaginationConfig.current = page;
  const startDate = historyDateRange.value
    ? historyDateRange.value[0].format('YYYY-MM-DD')
    : undefined;
  const endDate = historyDateRange.value
    ? historyDateRange.value[1].format('YYYY-MM-DD')
    : undefined;
  fetchOnDutyHistory(historyDialog.groupId, startDate, endDate, page);
};

// 导出功能
const exportPlan = (): void => {
  if (!futurePlanDialog.data?.details) return;

  const headers = ['日期', '星期', '值班人员', '值班类型'];
  const csvContent = [
    headers.join(','),
    ...filteredFuturePlans.value.map((plan: any) =>
      [
        plan.date,
        formatPlanWeekday(plan.date || ''),
        plan.user?.username || '未指定',
        '正常值班',
      ].join(','),
    ),
  ].join('\n');

  const blob = new Blob(['\uFEFF' + csvContent], {
    type: 'text/csv;charset=utf-8;',
  });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `${futurePlanDialog.groupName}_排班计划_${dayjs().format('YYYY-MM-DD')}.csv`;
  link.click();

  message.success('排班计划已导出');
};

const exportHistory = async (): Promise<void> => {
  if (historyDialog.data.length === 0) return;

  try {
    // 导出前获取所有历史记录
    historyDialog.loading = true;
    message.loading('正在准备导出数据...');

    // 获取所有历史记录
    const apiParams: {
      end_date?: string;
      size?: number;
      start_date?: string;
    } = {
      size: 1000, // 设置较大的size以获取尽可能多的记录
    };

    // 如果有日期范围筛选，添加到参数中
    if (historyDateRange.value) {
      apiParams.start_date = historyDateRange.value[0].format('YYYY-MM-DD');
      apiParams.end_date = historyDateRange.value[1].format('YYYY-MM-DD');
    }

    const response = await getMonitorOnDutyHistoryApi(
      historyDialog.groupId,
      apiParams,
    );
    const exportData = response?.items || historyDialog.data;

    const headers = ['日期', '星期', '值班人员ID', '原值班人员ID', '创建时间'];
    const csvContent = [
      headers.join(','),
      ...exportData.map((history: MonitorOnDutyHistory) =>
        [
          history.date_string,
          formatPlanWeekday(history.date_string),
          history.on_duty_user_id,
          history.origin_user_id,
          formatFullDateTime(history.created_at),
        ].join(','),
      ),
    ].join('\n');

    const blob = new Blob(['\uFEFF' + csvContent], {
      type: 'text/csv;charset=utf-8;',
    });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${historyDialog.groupName}_值班历史_${dayjs().format('YYYY-MM-DD')}.csv`;
    link.click();

    message.success(`值班历史已导出 (${exportData.length}条记录)`);
  } catch (error: any) {
    if (shouldNotifyPageError(error))
      message.error(error.message || '导出值班历史失败');
  } finally {
    historyDialog.loading = false;
  }
};

function invalidateCrud() {
  crudRevision.value += 1;
  ++userListRevision;
  deleteDialog?.destroy();
  deleteDialog = undefined;
  isAddModalVisible.value = false;
  isEditModalVisible.value = false;
  detailDialogVisible.value = false;
  detailDialog.data = null;
  crudSubmitting.value = false;
  usersLoading.value = false;
  userOptions.value = [];
}
function beginCrud() {
  const owner = operationOwner();
  if (!owner || disposed) return false;
  invalidateCrud();
  invalidateChangeWindow();
  crudOwner = owner;
  return true;
}
function captureCrud() {
  const revision = crudRevision.value;
  const owner = crudOwner;
  return () =>
    !disposed &&
    owner !== undefined &&
    owner === operationOwner() &&
    revision === crudRevision.value;
}
function validGroupPayload(
  payload: CreateMonitorOnDutyGroupReq | UpdateMonitorOnDutyGroupReq,
) {
  const length = [...payload.name].length;
  return (
    length >= 1 &&
    length <= 50 &&
    [...(payload.description ?? '')].length <= 255 &&
    Number.isSafeInteger(payload.shift_days) &&
    payload.shift_days > 0 &&
    payload.user_ids.length > 0 &&
    payload.user_ids.every((id) => validPositiveId(id)) &&
    new Set(payload.user_ids).size === payload.user_ids.length &&
    (!('enable' in payload) || payload.enable === 1 || payload.enable === 2)
  );
}

const resetAddForm = (): void => {
  if (addFormRef.value) {
    addFormRef.value.resetFields();
  }
  addForm.name = '';
  addForm.shift_days = 7;
  addForm.user_ids = [];
  addForm.description = '';
};

// 模态框控制
const showAddModal = (): void => {
  if (!beginCrud()) return;
  resetAddForm();
  userSearchText.value = '';
  userPaginationConfig.current = 1;
  fetchUserList(1);
  isAddModalVisible.value = true;
};

const closeAddModal = (): void => {
  resetAddForm();
  invalidateCrud();
};

const showEditModal = (record: MonitorOnDutyGroup): void => {
  if (!validPositiveId(record.id)) {
    message.error('记录ID不合法');
    return;
  }
  if (!beginCrud()) return;
  const current = captureCrud();
  const id = record.id;
  const selectedUsers = cloneDeep(record.users ?? []);
  editForm.id = record.id;
  editForm.name = record.name;
  editForm.shift_days = record.shift_days;
  editForm.user_ids = record.users?.map((user) => user.id) || [];
  editForm.description = record.description || '';
  editForm.enable = record.enable;

  userSearchText.value = '';
  userPaginationConfig.current = 1;
  fetchUserList(1).then(() => {
    if (!current() || !isEditModalVisible.value || editForm.id !== id) return;
    for (const user of selectedUsers) {
      if (
        validPositiveId(user.id) &&
        !userOptions.value.some((option) => option.value === user.id)
      ) {
        userOptions.value.push({ value: user.id, label: user.username });
      }
    }
  });

  isEditModalVisible.value = true;
};

// 从详情页面编辑
const handleEditFromDetail = (): void => {
  if (detailDialog.data) {
    showEditModal(detailDialog.data);
    detailDialogVisible.value = false;
  }
};

const closeEditModal = (): void => {
  if (editFormRef.value) {
    editFormRef.value.resetFields();
  }
  invalidateCrud();
};

const closeDetailDialog = (): void => {
  invalidateCrud();
};

const closeFuturePlanDialog = (): void => {
  futurePlanDialogVisible.value = false;
  planDateFilter.value = null;
  planUserFilter.value = '';
};

const closeHistoryDialog = (): void => {
  historyDialogVisible.value = false;
  historyDateRange.value = null;
  historyDialog.data = [];
  historyPaginationConfig.current = 1;
};

const closeChangeDialog = (): void => {
  invalidateChangeWindow();
};

const showCreateChangeModal = (): void => {
  const context = captureChangeWindow();
  if (!context || !hasPerm('/api/monitor/onduty_groups/changes')) return;
  invalidateChangeForm();
  changeFormOwner = context.owner;
  createChangeForm.on_duty_group_id = context.groupId;
  createChangeForm.date = null;
  createChangeForm.origin_user_id = null;
  createChangeForm.on_duty_user_id = null;
  createChangeForm.reason = '';

  // 加载用户列表
  changeUserSearchText.value = '';
  changeUserPagination.current = 1;
  changeUserPagination.hasMore = true;
  changeUserPagination.total = 0;
  isCreateChangeModalVisible.value = true;
  fetchChangeUsers(1);
};

const closeCreateChangeModal = (): void => {
  invalidateChangeForm();
};

// CRUD操作
const saveGroup = async (mode: 'add' | 'edit'): Promise<void> => {
  const form = mode === 'add' ? addForm : editForm;
  const formRef = mode === 'add' ? addFormRef.value : editFormRef.value;
  const current = captureCrud();
  const id = mode === 'edit' ? editForm.id : undefined;
  if (
    !current() ||
    crudSubmitting.value ||
    !(mode === 'add' ? isAddModalVisible.value : isEditModalVisible.value) ||
    (mode === 'edit' && !validPositiveId(id))
  )
    return;
  if (!formRef || typeof formRef.validate !== 'function') {
    message.error('表单尚未就绪');
    return;
  }
  const snapshot = cloneDeep(toRaw(form));
  const fingerprint = JSON.stringify(snapshot);
  const currentFields = () => current() && fingerprint === JSON.stringify(form);
  crudSubmitting.value = true;
  try {
    try {
      await formRef.validate();
    } catch {
      return;
    }
    if (!currentFields()) return;
    const payload: CreateMonitorOnDutyGroupReq = {
      description: snapshot.description?.trim(),
      name: snapshot.name.trim(),
      shift_days: snapshot.shift_days,
      user_ids: [...snapshot.user_ids],
    };
    if (!validGroupPayload(payload)) {
      message.error('值班组信息不合法');
      return;
    }
    if (mode === 'edit') {
      if (
        !validPositiveId(id) ||
        !('enable' in snapshot) ||
        (snapshot.enable !== 1 && snapshot.enable !== 2)
      ) {
        message.error('值班组信息不合法');
        return;
      }
      await updateMonitorOnDutyGroupApi({
        ...payload,
        id,
        enable: snapshot.enable,
      });
    } else await createMonitorOnDutyGroupApi(payload);
    if (!currentFields()) return;
    message.success(mode === 'add' ? '新增值班组成功' : '更新值班组成功');
    if (mode === 'add') paginationConfig.current = 1;
    invalidateCrud();
    await fetchOnDutyGroups();
  } catch (error: unknown) {
    if (currentFields() && shouldNotifyPageError(error))
      message.error(mode === 'add' ? '新增值班组失败' : '更新值班组失败');
  } finally {
    if (current()) crudSubmitting.value = false;
  }
};
const handleAdd = () => saveGroup('add');
const handleUpdate = () => saveGroup('edit');

const handleCreateChange = async (): Promise<void> => {
  const context = captureChangeWindow();
  const form = createChangeFormRef.value;
  const owner = changeFormOwner;
  if (
    !context ||
    !isCreateChangeModalVisible.value ||
    changeSubmitting.value ||
    owner !== context.owner ||
    !hasPerm('/api/monitor/onduty_groups/changes')
  )
    return;
  if (!form || typeof form.validate !== 'function') {
    message.warning('表单尚未就绪，请稍后重试');
    return;
  }
  const ticket = changeFormRevision;
  const date = createChangeForm.date;
  const dateValue = dayjs.isDayjs(date) ? date.valueOf() : undefined;
  const snapshot = {
    groupId: createChangeForm.on_duty_group_id,
    newUserId: createChangeForm.on_duty_user_id,
    originUserId: createChangeForm.origin_user_id,
    reason: createChangeForm.reason,
  };
  const ownsOperation = () =>
    ownsChangeWindow(context) &&
    ticket === changeFormRevision &&
    changeFormOwner === owner &&
    isCreateChangeModalVisible.value;
  const isCurrent = () =>
    ownsOperation() &&
    hasPerm('/api/monitor/onduty_groups/changes') &&
    createChangeFormRef.value === form &&
    createChangeForm.on_duty_group_id === context.groupId &&
    snapshot.groupId === context.groupId &&
    createChangeForm.date === date &&
    Object.is(
      dayjs.isDayjs(createChangeForm.date)
        ? createChangeForm.date.valueOf()
        : undefined,
      dateValue,
    ) &&
    createChangeForm.origin_user_id === snapshot.originUserId &&
    createChangeForm.on_duty_user_id === snapshot.newUserId &&
    createChangeForm.reason === snapshot.reason;
  if (!isCurrent()) return;
  changeSubmitting.value = true;
  try {
    await form.validate();
  } catch {
    if (ownsOperation()) changeSubmitting.value = false;
    return;
  }
  if (!isCurrent()) {
    if (ownsOperation()) changeSubmitting.value = false;
    return;
  }
  try {
    const groupId = snapshot.groupId;
    const originUserId = snapshot.originUserId;
    const newUserId = snapshot.newUserId;
    if (
      !validPositiveId(groupId) ||
      !validPositiveId(originUserId) ||
      !validPositiveId(newUserId) ||
      !dayjs.isDayjs(date) ||
      !date.isValid()
    ) {
      message.warning('请选择有效的调班日期、值班组和人员');
      return;
    }
    const payload: CreateMonitorOnDutyGroupChangeReq = {
      date: date.format('YYYY-MM-DD'),
      on_duty_group_id: groupId,
      on_duty_user_id: newUserId,
      origin_user_id: originUserId,
      reason: snapshot.reason?.trim(),
    };

    const response = await createMonitorOnDutyGroupChangeApi(payload);
    if (!isCurrent()) return;

    if (response) {
      message.success('创建调班记录成功');
      closeCreateChangeModal();
      // 刷新调班记录列表
      if (ownsChangeWindow(context)) {
        await fetchChangeRecords(1);
      }
    } else {
      message.error('创建调班记录失败');
    }
  } catch (error: unknown) {
    if (!isCurrent()) return;
    if (shouldNotifyPageError(error)) message.error('创建调班记录失败');
  } finally {
    if (ownsOperation()) changeSubmitting.value = false;
  }
};

// 加载更多调班记录
const loadMoreChangeRecords = async (): Promise<void> => {
  if (changePaginationConfig.total > changeDialog.data.length) {
    const nextPage =
      Math.floor(changeDialog.data.length / changePaginationConfig.pageSize) +
      1;
    await fetchChangeRecords(nextPage, true);
  }
};

// 加载更多历史记录

const handleCreatePlanFromDialog = (): void => {
  router.push({
    path: '/monitor_onduty_group_table',
    query: { id: futurePlanDialog.groupId.toString() },
  });
};

const handleViewChange = async (record: MonitorOnDutyGroup): Promise<void> => {
  const owner = operationOwner();
  if (
    disposed ||
    !owner ||
    !validPositiveId(record.id) ||
    !hasPerm('/api/monitor/onduty_groups/changes/:id')
  ) {
    message.warning('值班组或账号标识无效，请刷新后重试');
    return;
  }
  invalidateChangeWindow();
  changeDialogOwner = owner;
  changeDialog.groupId = record.id;
  changeDialog.groupName = record.name;
  changePaginationConfig.current = 1;
  changeDialogVisible.value = true;
  await fetchChangeRecords(1);
};

const confirmDelete = (record: MonitorOnDutyGroup): void => {
  const id = record.id;
  const name = record.name;
  if (!validPositiveId(id)) {
    message.error('记录ID不合法');
    return;
  }
  if (!beginCrud()) return;
  const current = captureCrud();
  let consumed = false;
  deleteDialog = Modal.confirm({
    title: '警告',
    content: `确定要删除值班组 "${name}" 吗？`,
    okText: '删除',
    okType: 'danger',
    cancelText: '取消',
    onCancel() {
      consumed = true;
    },
    async onOk() {
      if (consumed || !current() || record.id !== id) return;
      consumed = true;
      try {
        await deleteMonitorOnDutyGroupApi(id);
        if (!current()) return;
        message.success(`值班组 "${name}" 已删除`);
        if (data.value.length === 1 && paginationConfig.current > 1)
          paginationConfig.current--;
        await fetchOnDutyGroups();
      } catch (error: unknown) {
        if (current() && shouldNotifyPageError(error))
          message.error('删除值班组失败');
      }
    },
  });
};

const handleMenuClick = (command: string, record: MonitorOnDutyGroup): void => {
  switch (command) {
    case 'change': {
      handleViewChange(record);
      break;
    }
    case 'delete': {
      confirmDelete(record);
      break;
    }
    case 'edit': {
      showEditModal(record);
      break;
    }
    case 'history': {
      handleViewHistory(record);
      break;
    }
  }
};

// 生命周期钩子
onMounted(async () => {
  paginationConfig.current = 1;
  paginationConfig.pageSize = 10;

  await Promise.all([fetchOnDutyGroups(), fetchUserList(1)]);
});

// 处理调班日期选择
const handleChangeDateSelect = (date: Dayjs | null): void => {
  createChangeForm.date = date;
  // Another date has no verified original assignee; require an explicit choice.
  createChangeForm.origin_user_id = null;
};
</script>

<template>
  <OpsPage description="维护值班成员、轮转周期与换班安排" title="值班组">
    <!-- 页面标题 -->
    <template #actions>
      <a-button class="btn-create" type="primary" @click="showAddModal">
        <template #icon>
          <PlusOutlined />
        </template>
        <span class="btn-text">新增值班组</span>
      </a-button>
    </template>
    <template #filters>
      <div class="search-filters">
        <a-input-search
          v-model:value="searchText"
          allow-clear
          class="search-input"
          placeholder="搜索值班组名称..."
          @change="handleSearchChange"
          @search="handleSearch"
        />
        <a-select
          v-model:value="enableFilter"
          allow-clear
          placeholder="状态筛选"
          style="width: 120px"
          @change="handleEnableFilterChange"
        >
          <a-select-option :value="1">启用</a-select-option>
          <a-select-option :value="2">禁用</a-select-option>
        </a-select>
        <a-button class="reset-btn" @click="handleReset"> 重置 </a-button>
      </div>
    </template>

    <!-- 统计卡片 -->
    <template #summary>
      <div class="stats-row">
        <a-row :gutter="[16, 16]">
          <a-col :lg="6" :md="6" :sm="6" :xs="12">
            <a-card class="stats-card">
              <a-statistic
                :value="loadError ? '未知' : stats.total"
                :value-style="{ color: '#3f8600' }"
                title="总值班组"
              >
                <template #prefix>
                  <Icon icon="carbon:user-multiple" />
                </template>
              </a-statistic>
            </a-card>
          </a-col>
          <a-col :lg="6" :md="6" :sm="6" :xs="12">
            <a-card class="stats-card">
              <a-statistic
                :value="loadError ? '未知' : stats.activeusers"
                :value-style="{ color: '#52c41a' }"
                title="当前页成员"
              >
                <template #prefix>
                  <Icon icon="carbon:user-activity" />
                </template>
              </a-statistic>
            </a-card>
          </a-col>
          <a-col :lg="6" :md="6" :sm="6" :xs="12">
            <a-card class="stats-card">
              <a-statistic
                :value="loadError ? '未知' : stats.avgShiftDays"
                :value-style="{ color: '#faad14' }"
                suffix="天"
                title="本页平均周期"
              >
                <template #prefix>
                  <Icon icon="carbon:calendar" />
                </template>
              </a-statistic>
            </a-card>
          </a-col>
          <a-col :lg="6" :md="6" :sm="6" :xs="12">
            <a-card class="stats-card">
              <a-statistic
                :value="loadError ? '未知' : stats.todayOnDuty"
                :value-style="{ color: '#cf1322' }"
                title="当前页今日值班"
              >
                <template #prefix>
                  <Icon icon="carbon:user-certification" />
                </template>
              </a-statistic>
            </a-card>
          </a-col>
        </a-row>
      </div>
    </template>

    <!-- 表格容器 -->
    <a-alert
      v-if="loadError"
      :message="loadError"
      role="alert"
      show-icon
      type="error"
    >
      <template #action>
        <a-button :loading="loading" size="small" @click="fetchOnDutyGroups">
          重试
        </a-button>
      </template>
    </a-alert>

    <div class="table-container">
      <a-card>
        <a-table
          :columns="columns"
          :data-source="data"
          :loading="loading"
          :pagination="paginationConfig"
          :scroll="{ x: 1400 }"
          bordered
          row-key="id"
          @change="handleTableChange"
        >
          <template #bodyCell="{ column, record }">
            <template v-if="column.key === 'name'">
              <div class="group-name-cell">
                <div
                  class="group-badge"
                  :class="[
                    record.enable === 1 ? 'status-active' : 'status-inactive',
                  ]"
                ></div>
                <span class="group-name-text">{{ record.name }}</span>
              </div>
            </template>

            <template v-if="column.key === 'users'">
              <div class="tag-container">
                <a-tag
                  v-for="user in record.users"
                  :key="user.id"
                  class="tech-tag user-tag"
                >
                  {{ user.real_name || user.username }}
                </a-tag>
                <span v-if="!record.users?.length" class="empty-text"
                  >无成员</span
                >
              </div>
            </template>

            <template v-if="column.key === 'shift_info'">
              <div class="config-info">
                <div class="config-item">
                  <span class="config-label">周期:</span>
                  <span class="config-value">{{ record.shift_days }}天</span>
                </div>
                <div class="config-item">
                  <span class="config-label">成员:</span>
                  <span class="config-value"
                    >{{ record.users?.length || 0 }}人</span
                  >
                </div>
              </div>
            </template>

            <template v-if="column.key === 'duty_status'">
              <div class="duty-status-container">
                <div v-if="record.today_duty_user" class="today-duty">
                  <a-avatar
                    size="small"
                    :style="{
                      backgroundColor: getAvatarColor(
                        record.today_duty_user.real_name ||
                          record.today_duty_user.username,
                      ),
                    }"
                  >
                    {{
                      getInitials(
                        record.today_duty_user.real_name ||
                          record.today_duty_user.username,
                      )
                    }}
                  </a-avatar>
                  <span class="duty-user-name">{{
                    record.today_duty_user.real_name ||
                    record.today_duty_user.username
                  }}</span>
                  <a-tag color="green" size="small">今日值班</a-tag>
                </div>
                <span v-else class="no-duty">暂无值班</span>
              </div>
            </template>

            <template v-if="column.key === 'enable'">
              <a-switch
                :checked="record.enable === 1"
                :loading="record.statusLoading"
                @change="
                  (checked: boolean) => handleEnableChange(record, checked)
                "
              />
            </template>

            <template v-if="column.key === 'creator'">
              <div class="creator-info">
                <a-avatar
                  size="small"
                  :style="{
                    backgroundColor: getAvatarColor(
                      record.create_user_name || '',
                    ),
                  }"
                >
                  {{ getInitials(record.create_user_name || '') }}
                </a-avatar>
                <span class="creator-name">{{
                  record.create_user_name || '未知'
                }}</span>
              </div>
            </template>

            <template v-if="column.key === 'createdAt'">
              <div class="date-info">
                <span class="date">{{ formatDate(record.created_at) }}</span>
                <span class="time">{{ formatTime(record.created_at) }}</span>
              </div>
            </template>

            <template v-if="column.key === 'action'">
              <div class="action-buttons">
                <a-button
                  size="small"
                  type="primary"
                  @click="handleViewDetail(record)"
                >
                  查看
                </a-button>
                <a-button
                  size="small"
                  type="default"
                  @click="handleViewFuturePlan(record)"
                >
                  排班计划
                </a-button>
                <a-dropdown>
                  <template #overlay>
                    <a-menu @click="(e: any) => handleMenuClick(e.key, record)">
                      <a-menu-item key="edit">
                        <Icon icon="carbon:edit" /> 编辑
                      </a-menu-item>
                      <a-menu-item key="history">
                        <Icon icon="carbon:time" /> 值班历史
                      </a-menu-item>
                      <a-menu-item key="change">
                        <Icon icon="carbon:change-catalog" /> 调班记录
                      </a-menu-item>
                      <a-menu-divider
                        v-if="can('monitor.onDutyGroup.delete')"
                      />
                      <a-menu-item
                        v-if="can('monitor.onDutyGroup.delete')"
                        key="delete"
                        danger
                      >
                        删除
                      </a-menu-item>
                    </a-menu>
                  </template>
                  <a-button size="small">
                    更多
                    <DownOutlined />
                  </a-button>
                </a-dropdown>
              </div>
            </template>
          </template>
        </a-table>
      </a-card>
    </div>

    <!-- 新增值班组模态框 -->
    <a-modal
      :confirm-loading="crudSubmitting"
      :destroy-on-close="true"
      :open="isAddModalVisible"
      :width="formDialogWidth"
      class="responsive-modal on-duty-group-modal"
      title="新增值班组"
      @cancel="closeAddModal"
      @ok="handleAdd"
    >
      <a-form
        :key="crudRevision"
        ref="addFormRef"
        :model="addForm"
        :rules="formRules"
        layout="vertical"
      >
        <div class="form-section">
          <div class="section-title">基本信息</div>
          <a-row :gutter="16">
            <a-col :span="24">
              <a-form-item label="值班组名称" name="name">
                <a-input
                  v-model:value="addForm.name"
                  placeholder="请输入值班组名称"
                />
              </a-form-item>
            </a-col>
          </a-row>
          <a-row :gutter="16">
            <a-col :span="24">
              <a-form-item label="轮班周期（天）" name="shift_days">
                <a-input-number
                  v-model:value="addForm.shift_days"
                  :min="1"
                  class="full-width"
                />
              </a-form-item>
            </a-col>
          </a-row>
          <a-row :gutter="16">
            <a-col :span="24">
              <a-form-item label="描述" name="description">
                <a-textarea
                  v-model:value="addForm.description"
                  :rows="3"
                  placeholder="请输入值班组描述（可选）"
                />
              </a-form-item>
            </a-col>
          </a-row>
        </div>

        <div class="form-section">
          <div class="section-title">值班人员</div>
          <a-row :gutter="16">
            <a-col :span="24">
              <a-form-item label="值班成员" name="user_ids">
                <a-select
                  v-model:value="addForm.user_ids"
                  :filter-option="false"
                  :loading="usersLoading"
                  :maxTagCount="3"
                  :options="userOptions"
                  allow-clear
                  mode="multiple"
                  placeholder="请搜索并选择值班成员"
                  show-search
                  style="width: 100%"
                  @popupScroll="handleUserSelectScroll"
                  @search="handleUserSearch"
                />
              </a-form-item>
            </a-col>
          </a-row>
        </div>
      </a-form>
    </a-modal>

    <!-- 编辑值班组模态框 -->
    <a-modal
      :confirm-loading="crudSubmitting"
      :destroy-on-close="true"
      :open="isEditModalVisible"
      :width="formDialogWidth"
      class="responsive-modal on-duty-group-modal"
      title="编辑值班组"
      @cancel="closeEditModal"
      @ok="handleUpdate"
    >
      <a-form
        :key="crudRevision"
        ref="editFormRef"
        :model="editForm"
        :rules="formRules"
        layout="vertical"
      >
        <div class="form-section">
          <div class="section-title">基本信息</div>
          <a-row :gutter="16">
            <a-col :span="24">
              <a-form-item label="值班组名称" name="name">
                <a-input
                  v-model:value="editForm.name"
                  placeholder="请输入值班组名称"
                />
              </a-form-item>
            </a-col>
          </a-row>
          <a-row :gutter="16">
            <a-col :span="12">
              <a-form-item label="轮班周期（天）" name="shift_days">
                <a-input-number
                  v-model:value="editForm.shift_days"
                  :min="1"
                  class="full-width"
                />
              </a-form-item>
            </a-col>
            <a-col :span="12">
              <a-form-item label="状态" name="enable">
                <a-select
                  v-model:value="editForm.enable"
                  placeholder="请选择状态"
                  style="width: 100%"
                >
                  <a-select-option :value="1">启用</a-select-option>
                  <a-select-option :value="2">禁用</a-select-option>
                </a-select>
              </a-form-item>
            </a-col>
          </a-row>
          <a-row :gutter="16">
            <a-col :span="24">
              <a-form-item label="描述" name="description">
                <a-textarea
                  v-model:value="editForm.description"
                  :rows="3"
                  placeholder="请输入值班组描述（可选）"
                />
              </a-form-item>
            </a-col>
          </a-row>
        </div>

        <div class="form-section">
          <div class="section-title">值班人员</div>
          <a-row :gutter="16">
            <a-col :span="24">
              <a-form-item label="值班成员" name="user_ids">
                <a-select
                  v-model:value="editForm.user_ids"
                  :filter-option="false"
                  :loading="usersLoading"
                  :maxTagCount="3"
                  :options="userOptions"
                  allow-clear
                  mode="multiple"
                  placeholder="请搜索并选择值班成员"
                  show-search
                  style="width: 100%"
                  @popupScroll="handleUserSelectScroll"
                  @search="handleUserSearch"
                />
              </a-form-item>
            </a-col>
          </a-row>
        </div>
      </a-form>
    </a-modal>

    <!-- 详情对话框 -->
    <a-modal
      :footer="null"
      :open="detailDialogVisible"
      :width="previewDialogWidth"
      class="detail-dialog"
      title="值班组详情"
      @cancel="closeDetailDialog"
    >
      <div v-if="detailDialog.data" class="group-details">
        <div class="detail-header">
          <h2>{{ detailDialog.data.name }}</h2>
          <div class="detail-badges">
            <a-tag :color="detailDialog.data.enable === 1 ? 'green' : 'red'">
              {{ detailDialog.data.enable === 1 ? '启用' : '禁用' }}
            </a-tag>
            <a-tag color="blue">
              {{ detailDialog.data.shift_days }}天轮班
            </a-tag>
            <a-tag color="green">
              {{ detailDialog.data.users?.length || 0 }}名成员
            </a-tag>
          </div>
        </div>

        <a-descriptions :column="1" :labelStyle="{ width: '150px' }" bordered>
          <a-descriptions-item label="ID">
            {{ detailDialog.data.id }}
          </a-descriptions-item>
          <a-descriptions-item label="值班组名称">
            {{ detailDialog.data.name }}
          </a-descriptions-item>
          <a-descriptions-item label="轮班周期">
            {{ detailDialog.data.shift_days }}天
          </a-descriptions-item>
          <a-descriptions-item label="状态">
            <a-tag :color="detailDialog.data.enable === 1 ? 'green' : 'red'">
              {{ detailDialog.data.enable === 1 ? '启用' : '禁用' }}
            </a-tag>
          </a-descriptions-item>
          <a-descriptions-item label="描述">
            {{ detailDialog.data.description || '无描述' }}
          </a-descriptions-item>
          <a-descriptions-item label="成员数量">
            {{ detailDialog.data.users?.length || 0 }}人
          </a-descriptions-item>
          <a-descriptions-item label="成员列表">
            <div class="tag-container">
              <a-tag
                v-for="user in detailDialog.data.users"
                :key="user.id"
                class="tech-tag user-tag"
              >
                {{ user.real_name || user.username }}
              </a-tag>
              <span v-if="!detailDialog.data.users?.length" class="empty-text"
                >无成员</span
              >
            </div>
          </a-descriptions-item>
          <a-descriptions-item label="今日值班">
            <div
              v-if="detailDialog.data.today_duty_user"
              class="duty-user-info"
            >
              <a-avatar
                size="small"
                :style="{
                  backgroundColor: getAvatarColor(
                    detailDialog.data.today_duty_user.real_name ||
                      detailDialog.data.today_duty_user.username,
                  ),
                }"
              >
                {{
                  getInitials(
                    detailDialog.data.today_duty_user.real_name ||
                      detailDialog.data.today_duty_user.username,
                  )
                }}
              </a-avatar>
              <span>{{
                detailDialog.data.today_duty_user.real_name ||
                detailDialog.data.today_duty_user.username
              }}</span>
            </div>
            <span v-else>暂无</span>
          </a-descriptions-item>
          <a-descriptions-item label="创建人">
            {{ detailDialog.data.create_user_name }}
          </a-descriptions-item>
          <a-descriptions-item label="创建时间">
            {{ formatFullDateTime(detailDialog.data.created_at) }}
          </a-descriptions-item>
          <a-descriptions-item label="更新时间">
            {{ formatFullDateTime(detailDialog.data.updated_at) }}
          </a-descriptions-item>
        </a-descriptions>

        <div class="detail-footer">
          <a-button @click="closeDetailDialog">关闭</a-button>
          <a-button type="primary" @click="handleEditFromDetail">编辑</a-button>
          <a-button type="default" @click="handleViewFuturePlanFromDetail">
            查看排班计划
          </a-button>
          <a-button type="default" @click="handleViewHistoryFromDetail">
            值班历史
          </a-button>
        </div>
      </div>
    </a-modal>

    <!-- 未来排班计划对话框 -->
    <a-modal
      :footer="null"
      :open="futurePlanDialogVisible"
      :width="previewDialogWidth"
      class="detail-dialog future-plan-dialog"
      title="未来排班计划"
      @cancel="closeFuturePlanDialog"
    >
      <a-spin :spinning="futurePlanDialog.loading">
        <div v-if="futurePlanDialog.data" class="future-plan-content">
          <div class="plan-header">
            <h3>{{ futurePlanDialog.groupName }} - 未来排班计划</h3>
            <div class="plan-info">
              <a-tag color="blue">
                计划时长:
                {{ futurePlanDialog.data.details?.length || 0 }}天
              </a-tag>
              <a-tag color="green">
                轮班周期: {{ futurePlanDialog.shiftDays }}天
              </a-tag>
            </div>
          </div>

          <div class="plan-filters">
            <a-date-picker
              v-model:value="planDateFilter"
              placeholder="选择日期筛选"
              style="margin-right: 12px"
              @change="handlePlanDateChange"
            />
            <a-select
              v-model:value="planUserFilter"
              :filter-option="filterOption"
              :options="planUserOptions"
              allow-clear
              placeholder="选择用户筛选"
              show-search
              style="width: 150px; margin-right: 12px"
              @change="handlePlanUserChange"
            />
            <a-button @click="resetPlanFilters">重置筛选</a-button>
          </div>

          <div class="plan-timeline">
            <a-timeline mode="left">
              <a-timeline-item
                v-for="(plan, index) in filteredFuturePlans"
                :key="index"
                :color="getPlanTimelineColor(plan.date, index)"
              >
                <template #label>
                  <div class="timeline-date">
                    <div class="date-main">{{ formatPlanDate(plan.date) }}</div>
                    <div class="date-sub">
                      {{ formatPlanWeekday(plan.date) }}
                    </div>
                  </div>
                </template>
                <div class="timeline-content">
                  <div class="duty-user">
                    <a-avatar
                      size="small"
                      :style="{
                        backgroundColor: getAvatarColor(
                          plan.user?.username || '',
                        ),
                      }"
                    >
                      {{ getInitials(plan.user?.username || '') }}
                    </a-avatar>
                    <span class="user-name">{{
                      plan.user?.username || '未指定'
                    }}</span>
                    <a-tag
                      v-if="isToday(plan.date)"
                      color="red"
                      class="today-tag"
                    >
                      今日
                    </a-tag>
                    <a-tag
                      v-else-if="isTomorrow(plan.date)"
                      color="orange"
                      class="tomorrow-tag"
                    >
                      明日
                    </a-tag>
                  </div>
                  <div class="duty-details">
                    <span class="duty-type">正常值班</span>
                    <span class="cycle-info">第{{ getCycleDay(index) }}天</span>
                  </div>
                </div>
              </a-timeline-item>
            </a-timeline>

            <!-- 分页 -->
            <div
              v-if="
                futurePlanDialog.data?.details &&
                futurePlanDialog.data.details.length >
                  planPaginationConfig.pageSize
              "
              class="pagination-container"
            >
              <a-pagination
                v-model:current="planPaginationConfig.current"
                :pageSize="planPaginationConfig.pageSize"
                :pageSizeOptions="['10', '15', '30', '50']"
                :showSizeChanger="true"
                :total="planPaginationConfig.total"
                @change="handlePlanPaginationChange"
                @showSizeChange="handlePlanPaginationChange"
              />
            </div>
          </div>

          <div class="plan-summary">
            <a-space size="large" wrap>
              <a-statistic
                :value="futurePlanDialog.data.details?.length || 0"
                suffix="天"
                title="总计划天数"
              />
              <a-statistic
                :value="futurePlanDialog.availableUsers.length"
                suffix="人"
                title="参与人数"
              />
              <a-statistic
                :value="futurePlanDialog.shiftDays"
                suffix="天"
                title="轮班周期"
              />
            </a-space>
          </div>

          <div class="detail-footer">
            <a-button @click="closeFuturePlanDialog">关闭</a-button>
            <a-button type="primary" @click="exportPlan">导出计划</a-button>
            <a-button type="default" @click="handleCreatePlanFromDialog">
              创建排班计划
            </a-button>
          </div>
        </div>
        <div v-else class="empty-state">
          <Icon class="empty-icon" icon="carbon:calendar" />
          <div class="empty-title">暂无排班计划</div>
          <div class="empty-description">该值班组尚未生成未来排班计划</div>
          <a-button type="primary" @click="handleCreatePlanFromDialog">
            <Icon icon="carbon:add" />
            创建排班计划
          </a-button>
        </div>
      </a-spin>
    </a-modal>

    <!-- 值班历史对话框 -->
    <a-modal
      :footer="null"
      :open="historyDialogVisible"
      :width="previewDialogWidth"
      class="detail-dialog history-dialog"
      title="值班历史"
      @cancel="closeHistoryDialog"
    >
      <a-spin :spinning="historyDialog.loading">
        <div
          v-if="historyDialog.data && historyDialog.data.length > 0"
          class="history-content"
        >
          <div class="history-header">
            <h3>{{ historyDialog.groupName }} - 值班历史</h3>
            <div class="history-info">
              <a-tag color="blue">
                历史记录: {{ historyDialog.data.length || 0 }}条
              </a-tag>
            </div>
          </div>

          <div class="history-filters">
            <a-range-picker
              v-model:value="historyDateRange"
              placeholder="选择日期范围"
              style="margin-right: 12px"
              @change="handleHistoryDateChange"
            />
            <a-button @click="resetHistoryFilters">重置筛选</a-button>
          </div>

          <div class="history-table">
            <a-table
              :columns="historyColumns"
              :data-source="historyDialog.data"
              :loading="historyDialog.loading"
              :pagination="false"
              row-key="id"
              size="small"
            >
              <template #bodyCell="{ column, record }">
                <template v-if="column.key === 'id'">
                  <span class="record-id">#{{ record.id }}</span>
                </template>
                <template v-if="column.key === 'date'">
                  <div class="date-info">
                    <span class="date">{{ record.date_string }}</span>
                    <span class="weekday">{{
                      formatPlanWeekday(record.date_string)
                    }}</span>
                  </div>
                </template>
                <template v-if="column.key === 'users'">
                  <div class="user-change-info">
                    <div class="user-item">
                      <span class="label">原值班:</span>
                      <span class="user-id"
                        >ID {{ record.origin_user_id }}</span
                      >
                    </div>
                    <Icon icon="carbon:arrow-right" style="margin: 0 8px" />
                    <div class="user-item">
                      <span class="label">实际值班:</span>
                      <span class="user-id"
                        >ID {{ record.on_duty_user_id }}</span
                      >
                    </div>
                    <a-tag
                      v-if="record.origin_user_id !== record.on_duty_user_id"
                      class="changed-tag"
                      color="orange"
                      size="small"
                    >
                      已调班
                    </a-tag>
                  </div>
                </template>
                <template v-if="column.key === 'created_at'">
                  <div class="date-info">
                    <span class="date">{{
                      formatDate(record.created_at)
                    }}</span>
                    <span class="time">{{
                      formatTime(record.created_at)
                    }}</span>
                  </div>
                </template>
              </template>
              <template #emptyText>
                <div class="empty-state table-empty">
                  <Icon class="empty-icon" icon="carbon:time" />
                  <div class="empty-title">暂无值班历史</div>
                  <div class="empty-description">
                    该值班组尚未有值班历史记录
                  </div>
                </div>
              </template>
            </a-table>
          </div>

          <div class="detail-footer">
            <div class="footer-left">
              <a-button @click="closeHistoryDialog">关闭</a-button>
              <a-button type="primary" @click="exportHistory">
                导出历史
              </a-button>
            </div>
            <div class="footer-right">
              <a-pagination
                v-model:current="historyPaginationConfig.current"
                :pageSize="historyPaginationConfig.pageSize"
                :showTotal="historyPaginationConfig.showTotal"
                :total="historyPaginationConfig.total"
                size="small"
                @change="handleHistoryPageChange"
              />
            </div>
          </div>
        </div>
        <div v-else class="empty-state">
          <Icon class="empty-icon" icon="carbon:time" />
          <div class="empty-title">暂无值班历史</div>
          <div class="empty-description">该值班组尚未有值班历史记录</div>
        </div>
      </a-spin>
    </a-modal>

    <!-- 调班记录对话框 -->
    <a-modal
      :footer="null"
      :open="changeDialogVisible"
      :width="previewDialogWidth"
      class="detail-dialog change-dialog"
      title="调班记录"
      @cancel="closeChangeDialog"
    >
      <a-spin :spinning="changeDialog.loading">
        <div class="change-content">
          <div class="change-header">
            <h3>{{ changeDialog.groupName }} - 调班记录</h3>
            <a-button type="primary" @click="showCreateChangeModal">
              <PlusOutlined /> 新增调班
            </a-button>
          </div>

          <a-table
            :columns="changeColumns"
            :data-source="changeDialog.data"
            :loading="changeDialog.loading"
            :pagination="changePaginationConfig"
            row-key="id"
            size="small"
            @change="handleChangeTableChange"
          >
            <template #bodyCell="{ column, record }">
              <template v-if="column.key === 'id'">
                <span class="record-id">#{{ record.id }}</span>
              </template>
              <template v-if="column.key === 'date'">
                <div class="date-info">
                  <span class="date">{{ record.date }}</span>
                  <span class="weekday">{{
                    formatPlanWeekday(record.date)
                  }}</span>
                </div>
              </template>
              <template v-if="column.key === 'users'">
                <div class="user-change-info">
                  <div class="user-item">
                    <span class="label">原值班:</span>
                    <span class="user-id">ID {{ record.origin_user_id }}</span>
                  </div>
                  <Icon icon="carbon:arrow-right" style="margin: 0 8px" />
                  <div class="user-item">
                    <span class="label">调班后:</span>
                    <span class="user-id">ID {{ record.on_duty_user_id }}</span>
                  </div>
                </div>
              </template>
              <template v-if="column.key === 'reason'">
                <span class="reason-text">{{ record.reason || '无' }}</span>
              </template>
              <template v-if="column.key === 'creator'">
                <div class="creator-info">
                  <a-avatar
                    size="small"
                    :style="{
                      backgroundColor: getAvatarColor(
                        record.create_user_name || '',
                      ),
                    }"
                  >
                    {{ getInitials(record.create_user_name || '') }}
                  </a-avatar>
                  <span class="creator-name">{{
                    record.create_user_name || '未知'
                  }}</span>
                </div>
              </template>
              <template v-if="column.key === 'created_at'">
                <div class="date-info">
                  <span class="date">{{ formatDate(record.created_at) }}</span>
                  <span class="time">{{ formatTime(record.created_at) }}</span>
                </div>
              </template>
            </template>
            <template #emptyText>
              <div class="empty-state table-empty">
                <Icon class="empty-icon" icon="carbon:document" />
                <div class="empty-title">暂无调班记录</div>
                <div class="empty-description">该值班组尚未有调班记录</div>
              </div>
            </template>
          </a-table>

          <div class="detail-footer">
            <a-button @click="closeChangeDialog">关闭</a-button>
            <a-button
              v-if="changePaginationConfig.total > changeDialog.data.length"
              :loading="changeDialog.loading"
              type="primary"
              @click="loadMoreChangeRecords"
            >
              加载更多
            </a-button>
          </div>
        </div>
      </a-spin>
    </a-modal>

    <!-- 新增调班记录模态框 -->
    <a-modal
      :confirm-loading="changeSubmitting"
      :destroy-on-close="true"
      :open="isCreateChangeModalVisible"
      :width="formDialogWidth"
      class="responsive-modal"
      title="新增调班记录"
      @cancel="closeCreateChangeModal"
      @ok="handleCreateChange"
    >
      <a-form
        ref="createChangeFormRef"
        :model="createChangeForm"
        :rules="changeFormRules"
        layout="vertical"
      >
        <a-form-item label="调班日期" name="date">
          <a-date-picker
            v-model:value="createChangeForm.date"
            placeholder="请选择调班日期"
            style="width: 100%"
            @change="handleChangeDateSelect"
          />
        </a-form-item>
        <a-form-item label="原值班人员" name="origin_user_id">
          <a-select
            v-model:value="createChangeForm.origin_user_id"
            :filter-option="false"
            :loading="changeUsersLoading"
            :options="changeUserOptions"
            allow-clear
            placeholder="请选择原值班人员"
            show-search
            style="width: 100%"
            @popupScroll="handleChangeUserSelectScroll"
            @search="handleChangeUserSearch"
          />
        </a-form-item>
        <a-form-item label="调班后人员" name="on_duty_user_id">
          <a-select
            v-model:value="createChangeForm.on_duty_user_id"
            :filter-option="false"
            :loading="changeUsersLoading"
            :options="changeUserOptions"
            allow-clear
            placeholder="请选择调班后人员"
            show-search
            style="width: 100%"
            @popupScroll="handleChangeUserSelectScroll"
            @search="handleChangeUserSearch"
          />
        </a-form-item>
        <a-form-item label="调班原因" name="reason">
          <a-textarea
            v-model:value="createChangeForm.reason"
            :rows="3"
            placeholder="请输入调班原因（可选）"
          />
        </a-form-item>
      </a-form>
    </a-modal>
  </OpsPage>
</template>

<style scoped>
/* 响应式设计 */
@media (max-width: 768px) {
  .search-input {
    width: calc(100% - 140px);
    min-width: auto;
  }

  .stats-card :deep(.ant-statistic-title) {
    font-size: 12px;
  }

  .stats-card :deep(.ant-statistic-content) {
    font-size: 16px;
  }

  .action-buttons {
    gap: 2px;
  }

  .action-buttons .ant-btn {
    padding: 0 4px;
    font-size: 12px;
  }

  .detail-footer {
    justify-content: center;
  }

  .detail-footer .ant-btn {
    flex: 1;
    max-width: 120px;
  }

  .plan-filters,
  .history-filters {
    flex-direction: column;
    align-items: stretch;
  }

  .timeline-date {
    text-align: left;
    padding-right: 0;
    margin-bottom: 8px;
  }

  .duty-user {
    flex-wrap: wrap;
  }

  .user-change-info {
    flex-direction: column;
    align-items: flex-start;
  }

  .plan-header,
  .history-header,
  .change-header {
    flex-direction: column;
    align-items: stretch;
  }
}

@media (max-width: 480px) {
  .stats-card {
    text-align: center;
  }

  .creator-info {
    flex-direction: column;
    gap: 4px;
    align-items: center;
  }

  .creator-name {
    font-size: 12px;
  }

  .date-info {
    text-align: center;
  }

  .date {
    font-size: 12px;
  }

  .time {
    font-size: 10px;
  }
}

@media (max-width: 768px) {
  .responsive-modal :deep(.ant-modal-body) {
    padding: 16px;
    max-height: calc(100vh - 160px);
    overflow-y: auto;
  }
}

@media (max-width: 768px) {
  :deep(.ant-timeline-item-label) {
    width: auto !important;
    position: relative !important;
  }

  :deep(.ant-timeline-item-content) {
    margin-left: 0 !important;
  }
}

.search-input {
  width: 250px;
  min-width: 200px;
}

.reset-btn {
  flex-shrink: 0;
}

.stats-row {
  margin-bottom: 20px;
}

.stats-card {
  border-radius: var(--ops-radius);
  box-shadow: 0 2px 8px rgb(0 0 0 / 5%);
  height: 100%;
}

.table-container {
  margin-bottom: 24px;
}

.group-name-cell {
  display: flex;
  align-items: center;
  gap: 10px;
}

.group-badge {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}

.status-active {
  background-color: #52c41a;
}

.status-inactive {
  background-color: #ff4d4f;
}

.group-name-text {
  font-weight: 500;
  word-break: break-all;
}

.tag-container {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.tech-tag {
  display: inline-flex;
  align-items: center;
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 500;
  border: none;
  box-shadow: 0 1px 4px rgb(0 0 0 / 10%);
}

.user-tag {
  background-color: #e6f7ff;
  color: #0958d9;
  border-left: 1px solid #1890ff;
}

.empty-text {
  color: #999;
  font-style: italic;
  font-size: 12px;
}

.config-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.config-item {
  display: flex;
  align-items: center;
  gap: 4px;
}

.config-label {
  font-size: 12px;
  color: var(--ops-muted);
}

.config-value {
  font-size: 12px;
  font-weight: 500;
  color: var(--ops-ink);
}

.duty-status-container {
  display: flex;
  align-items: center;
  gap: 8px;
}

.today-duty {
  display: flex;
  align-items: center;
  gap: 8px;
}

.duty-user-name {
  font-weight: 500;
}

.no-duty {
  color: #999;
  font-style: italic;
}

.creator-info {
  display: flex;
  align-items: center;
  gap: 8px;
}

.creator-name {
  font-size: 14px;
  word-break: break-all;
}

.date-info {
  display: flex;
  flex-direction: column;
}

.date {
  font-weight: 500;
  font-size: 14px;
}

.time {
  font-size: 12px;
  color: var(--ops-muted);
}

.weekday {
  font-size: 12px;
  color: var(--ops-muted);
}

.action-buttons {
  display: flex;
  gap: 4px;
  justify-content: center;
  flex-wrap: wrap;
}

.form-section {
  margin-bottom: 28px;
  padding: 0;
  position: relative;
}

.section-title {
  font-size: 16px;
  font-weight: 600;
  color: var(--ops-ink);
  margin-bottom: 16px;
  padding-left: 12px;
  border-left: 1px solid #1890ff;
}

.full-width {
  width: 100%;
}

.detail-dialog .group-details {
  margin-bottom: 20px;
}

.detail-header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 20px;
  flex-wrap: wrap;
}

.detail-header h2 {
  margin: 0;
  font-size: 24px;
  color: var(--ops-ink);
  word-break: break-all;
}

.detail-badges {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.duty-user-info {
  display: flex;
  align-items: center;
  gap: 8px;
}

.detail-footer {
  margin-top: 24px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}

.footer-left {
  display: flex;
  gap: 8px;
}

.footer-right {
  display: flex;
  align-items: center;
}

.future-plan-content,
.history-content,
.change-content {
  max-height: 70vh;
  overflow-y: auto;
}

.plan-header,
.history-header,
.change-header {
  margin-bottom: 20px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 12px;
}

.plan-header h3,
.history-header h3,
.change-header h3 {
  margin: 0;
  font-size: 20px;
  color: var(--ops-ink);
}

.plan-info,
.history-info {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.plan-filters,
.history-filters {
  margin-bottom: 20px;
  padding: 16px;
  background: var(--ops-ground);
  border-radius: var(--ops-radius);
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 12px;
}

.plan-timeline,
.history-timeline {
  margin-bottom: 20px;
}

.history-table {
  margin-bottom: 20px;
}

.history-table :deep(.ant-table-thead > tr > th) {
  background-color: var(--ops-ground);
  font-weight: 600;
}

.history-table :deep(.ant-table-tbody > tr:hover > td) {
  background-color: #e6f7ff;
}

.pagination-container {
  margin-top: 20px;
  display: flex;
  justify-content: center;
}

.timeline-date {
  text-align: right;
  padding-right: 12px;
}

.date-main {
  font-weight: 600;
  font-size: 14px;
  color: var(--ops-ink);
}

.date-sub {
  font-size: 12px;
  color: var(--ops-muted);
}

.timeline-content {
  padding: 8px 12px;
  background: var(--ops-ground);
  border-radius: 6px;
  border-left: 1px solid #1890ff;
}

.duty-user {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 4px;
}

.user-name {
  font-weight: 500;
  color: var(--ops-ink);
}

.today-tag,
.tomorrow-tag,
.changed-tag {
  font-size: 10px;
  padding: 2px 6px;
}

.duty-details {
  display: flex;
  gap: 12px;
  font-size: 12px;
  color: var(--ops-muted);
}

.duty-type {
  font-weight: 500;
}

.cycle-info,
.create-info {
  color: #9ca3af;
}

.plan-summary {
  margin-bottom: 20px;
  padding: 16px;
  background: var(--ops-ground);
  border-radius: var(--ops-radius);
}

.user-change-info {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.user-item {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.label {
  font-size: 12px;
  color: var(--ops-muted);
}

.user-id {
  font-weight: 500;
  color: #1890ff;
}

.create-time {
  font-size: 12px;
  color: var(--ops-muted);
}

/* 表格滚动优化 */
.table-container :deep(.ant-table-wrapper) {
  overflow: auto;
}

.table-container :deep(.ant-table-thead > tr > th) {
  white-space: nowrap;
}

.table-container :deep(.ant-table-tbody > tr > td) {
  word-break: break-word;
}

/* 对话框响应式优化 */
.responsive-modal :deep(.ant-modal) {
  max-width: calc(100vw - 16px);
  margin: 8px;
}

/* Timeline 响应式优化 */
:deep(.ant-timeline-item-label) {
  width: 100px !important;
}

:deep(.ant-timeline-item-content) {
  margin-left: 120px !important;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px;
  background-color: #f8f9fa;
  border-radius: var(--ops-radius);
}

.empty-icon {
  font-size: 48px;
  color: #ccc;
  margin-bottom: 20px;
}

.empty-title {
  font-size: 18px;
  color: var(--ops-ink);
  margin-bottom: 10px;
}

.empty-description {
  font-size: 14px;
  color: var(--ops-muted);
  text-align: center;
}

.table-empty.empty-state {
  padding: 20px;
  background-color: transparent;
}

.table-empty .empty-icon {
  font-size: 32px;
  margin-bottom: 10px;
}

.record-id {
  font-weight: 600;
  color: #1890ff;
  font-family: 'Courier New', monospace;
}

.reason-text {
  color: var(--ops-muted);
  font-style: italic;
}

.change-dialog .ant-table-wrapper {
  max-height: 60vh;
  overflow-y: auto;
}

.change-dialog .ant-table-thead > tr > th {
  position: sticky;
  top: 0;
  background: var(--ops-ground);
  z-index: 1;
}

.change-dialog .detail-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 16px;
  padding-top: 16px;
  border-top: 1px solid var(--ops-border);
}

.change-dialog .ant-table-tbody > tr > td {
  vertical-align: top;
  padding: 12px 8px;
}

.change-dialog .ant-table-tbody > tr:hover > td {
  background-color: var(--ops-ground);
}
</style>
