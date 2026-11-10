<script setup lang="ts">
import OpsPage from '#/components/ops/OpsPage.vue';

import { useListRequest } from './useListRequest';
import {
  computed,
  onBeforeUnmount,
  onMounted,
  reactive,
  ref,
  toRaw,
  watch,
} from 'vue';

import { useUserStore } from '@vben/stores';
import { cloneDeep } from '@vben/utils';

import { type FormInstance, message, Modal } from 'ant-design-vue';
import { DownOutlined, PlusOutlined } from '@ant-design/icons-vue';
import { Icon } from '@iconify/vue';

import {
  createMonitorSendGroupApi,
  type CreateMonitorSendGroupReq,
  deleteMonitorSendGroupApi,
  getMonitorSendGroupDetailApi,
  getMonitorSendGroupListApi,
  type GetMonitorSendGroupListReq,
  type MonitorSendGroup,
  updateMonitorSendGroupApi,
  type UpdateMonitorSendGroupReq,
} from '#/api/core/prometheus/prometheus_send_group';
import { getUserList } from '#/api/core/system/user';
import {
  getMonitorAlertManagerPoolApi,
  getMonitorAlertManagerPoolListApi,
  type MonitorAlertManagerPool,
} from '#/api/core/prometheus/prometheus_alert_pool';
import {
  getMonitorOnDutyGroupListApi,
  type MonitorOnDutyGroup,
} from '#/api/core/prometheus/prometheus_onduty';
import { useAuthStore } from '#/store';
import { getAvatarColor } from '#/utils/avatar-color';
import { usePermission } from '#/utils/permission';
import { shouldNotifyPageError } from '#/utils/permission/request-notice';

const { can, hasPerm } = usePermission();
const formRef = ref<FormInstance>();
const submitting = ref(false);
const detailLoading = ref(false);
let disposed = false;
let interactionRevision = 0;
let catalogRevision = 0;
let poolRevision = 0;
let dutyRevision = 0;
let usersRevision = 0;
let formOwner: string | undefined;
let catalogOwner: string | undefined;
let deleteDialog: ReturnType<typeof Modal.confirm> | undefined;

const operationOwner = (): string | undefined => {
  const userId = Number(useUserStore().userInfo?.userId);
  if (!Number.isSafeInteger(userId) || userId <= 0) return;
  return JSON.stringify([userId, useAuthStore().getAuthGeneration()]);
};
const validPositiveId = (value: unknown): value is number =>
  typeof value === 'number' && Number.isSafeInteger(value) && value > 0;

// 修复类型定义
interface UserOption {
  label: string;
  username?: string;
  value: number;
}

interface UserInfo {
  id: number;
  username: string;
  real_name?: string;
  name?: string;
}

// interface MenuClickEvent { key: string } // 未使用

// AlertManager池简化接口：发送组pool_id用于生成AlertManager路由。
interface Pool {
  id: number;
  name: string;
}

// 修复API响应类型
interface ApiListResponse<T> {
  items: T[];
  total: number;
}

// 响应式对话框宽度
const formDialogWidth = computed(() => {
  if (typeof window !== 'undefined') {
    const width = window.innerWidth;
    if (width < 768) return '95%';
    if (width < 1024) return '90%';
    return '900px';
  }
  return '900px';
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
  {
    dataIndex: 'name',
    fixed: 'left',
    key: 'name',
    title: '发送组名称',
    width: 200,
  },
  { dataIndex: 'name_zh', key: 'name_zh', title: '中文名称', width: 180 },
  { key: 'pool_config', title: '关联配置', width: 180 },
  {
    dataIndex: 'static_receive_users',
    key: 'static_receive_users',
    title: '静态接收用户',
    width: 200,
  },
  {
    dataIndex: 'notify_methods',
    key: 'notify_methods',
    title: '通知方式',
    width: 180,
  },
  {
    align: 'center' as const,
    dataIndex: 'enable',
    key: 'enable',
    title: '启用状态',
    width: 100,
  },
  { key: 'notification_config', title: '通知配置', width: 160 },
  { key: 'upgrade_config', title: '升级配置', width: 120 },
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
    width: 200,
  },
];

// 状态数据
const loading = ref(false);
const {
  beginRequest,
  invalidate: invalidateList,
  loadError,
} = useListRequest(loading);
const searchQuery = ref('');
const enableFilter = ref<1 | 2 | undefined>(undefined);
const upgradeFilter = ref<1 | 2 | undefined>(undefined);
const sendGroupList = ref<MonitorSendGroup[]>([]);

// 防抖变量
let poolSearchDebounce: ReturnType<typeof setTimeout> | undefined;
let onDutyGroupSearchDebounce: ReturnType<typeof setTimeout> | undefined;
let userSearchDebounce: ReturnType<typeof setTimeout> | undefined;

// 防抖处理
let searchTimeout: null | ReturnType<typeof setTimeout> = null;
onBeforeUnmount(() => {
  if (searchTimeout) clearTimeout(searchTimeout);
  clearTimeout(poolSearchDebounce);
  clearTimeout(onDutyGroupSearchDebounce);
  clearTimeout(userSearchDebounce);
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

// 统计数据
const stats = reactive({
  total: 0,
  enabled: 0,
  needUpgrade: 0,
  associatedPools: 0,
});

// 对话框状态
const formDialogVisible = ref(false);
const detailDialogVisible = ref(false);

// 选项数据
const alertManagerPools = ref<Pool[]>([]);
const onDutyGroups = ref<MonitorOnDutyGroup[]>([]);
const userOptions = ref<UserOption[]>([]);

// 动态加载选项数据
const dialogPoolLoading = ref(false);
const dialogPoolSearch = ref('');
const dialogPoolPage = ref(1);
const dialogPoolHasMore = ref(true);
const dialogPools = ref<Pool[]>([]);

const dialogOnDutyGroupLoading = ref(false);
const dialogOnDutyGroupSearch = ref('');
const dialogOnDutyGroupPage = ref(1);
const dialogOnDutyGroupHasMore = ref(true);
const dialogOnDutyGroups = ref<Pool[]>([]);

const dialogUserLoading = ref(false);
const dialogUserSearch = ref('');
const dialogUserPage = ref(1);
const dialogUserHasMore = ref(true);
const dialogUsers = ref<UserOption[]>([]);

interface SendForm {
  enable: boolean;
  fei_shu_qun_robot_token: string;
  first_upgrade_users: number[];
  id?: number;
  name: string;
  name_zh: string;
  need_upgrade: boolean;
  notify_methods: string[];
  on_duty_group_id: null | number;
  pool_id: null | number;
  repeat_interval: string;
  second_upgrade_users: number[];
  send_resolved: boolean;
  static_receive_users: number[];
  upgrade_minutes: number;
}
const initialSendForm = (): SendForm => ({
  enable: false,
  fei_shu_qun_robot_token: '',
  first_upgrade_users: [],
  id: undefined,
  name: '',
  name_zh: '',
  need_upgrade: false,
  notify_methods: [],
  on_duty_group_id: null,
  pool_id: null,
  repeat_interval: '30s',
  second_upgrade_users: [],
  send_resolved: false,
  static_receive_users: [],
  upgrade_minutes: 0,
});

// 表单对话框数据
const formDialog = reactive({
  isEdit: false,
  form: initialSendForm(),
});

// 详情对话框数据
const detailDialog = reactive({
  form: null as MonitorSendGroup | null,
});

const invalidateInteraction = () => {
  ++interactionRevision;
  ++poolRevision;
  ++dutyRevision;
  ++usersRevision;
  formOwner = undefined;
  submitting.value = false;
  detailLoading.value = false;
  dialogPoolLoading.value = false;
  dialogOnDutyGroupLoading.value = false;
  dialogUserLoading.value = false;
  clearTimeout(poolSearchDebounce);
  clearTimeout(onDutyGroupSearchDebounce);
  clearTimeout(userSearchDebounce);
  const dialog = deleteDialog;
  deleteDialog = undefined;
  dialog?.destroy();
};
const captureForm = () => {
  const owner = formOwner;
  if (
    disposed ||
    !formDialogVisible.value ||
    !owner ||
    owner !== operationOwner()
  )
    return;
  const revision = interactionRevision;
  const id = formDialog.form.id;
  const isEdit = formDialog.isEdit;
  return {
    id,
    isEdit,
    owner,
    revision,
    isCurrent: () =>
      !disposed &&
      formDialogVisible.value &&
      revision === interactionRevision &&
      owner === operationOwner() &&
      owner === formOwner &&
      formDialog.isEdit === isEdit &&
      formDialog.form.id === id,
  };
};
const poolOptions = (items: MonitorAlertManagerPool[]): Pool[] =>
  items.flatMap((pool) => {
    const id = pool.id;
    return validPositiveId(id) ? [{ id, name: pool.name }] : [];
  });

watch(
  operationOwner,
  () => {
    invalidateInteraction();
    ++catalogRevision;
    catalogOwner = undefined;
    formDialogVisible.value = false;
    formDialog.form = initialSendForm();
    detailDialogVisible.value = false;
    detailDialog.form = null;
    alertManagerPools.value = [];
    onDutyGroups.value = [];
    userOptions.value = [];
    dialogPools.value = [];
    dialogOnDutyGroups.value = [];
    dialogUsers.value = [];
    sendGroupList.value = [];
    paginationConfig.total = 0;
    Object.assign(stats, {
      associatedPools: 0,
      enabled: 0,
      needUpgrade: 0,
      total: 0,
    });
    invalidateList();
  },
  { flush: 'sync' },
);
onBeforeUnmount(() => {
  disposed = true;
  invalidateInteraction();
  ++catalogRevision;
});

// 表单验证规则
const formRules = {
  name: [
    { message: '请输入发送组名称', required: true, trigger: 'blur' },
    { max: 50, message: '长度应为2到50个字符', min: 2, trigger: 'blur' },
  ],
  name_zh: [
    { message: '请输入发送组中文名称', required: true, trigger: 'blur' },
    { max: 50, message: '长度应为2到50个字符', min: 2, trigger: 'blur' },
  ],
  pool_id: [
    { message: '请选择关联AlertManager池', required: true, trigger: 'change' },
  ],
};

const getPoolStatusClass = (record: MonitorSendGroup): string => {
  if (record.enable === 1 && record.need_upgrade === 1) return 'status-full';
  if (record.enable === 1 || record.need_upgrade === 1) return 'status-partial';
  return 'status-none';
};

const getInitials = (name: string): string => {
  if (!name) return '';
  return name.slice(0, 2).toUpperCase();
};

const maskToken = (token: string): string => {
  return token ? '********' : '';
};

// 通过ID获取名称
const getPoolName = (poolId?: number): string => {
  if (!poolId) return '';
  const pool = alertManagerPools.value.find((p) => p.id === poolId);
  return (
    pool?.name || (validPositiveId(poolId) ? `AlertManager池ID: ${poolId}` : '')
  );
};

const getOnDutyGroupName = (groupId?: number): string => {
  if (!groupId) return '';
  const group = onDutyGroups.value.find((g) => g.id === groupId);
  return group?.name || '';
};

const formatDate = (dateString: string): string => {
  if (!dateString) return '';
  return new Date(dateString).toLocaleDateString('zh-CN');
};

const formatTime = (dateString: string): string => {
  if (!dateString) return '';
  return new Date(dateString).toLocaleTimeString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
  });
};

const formatFullDateTime = (dateString: string): string => {
  if (!dateString) return '';
  return new Date(dateString).toLocaleString('zh-CN');
};

// 修复的通知方式处理方法
const getNotifyMethods = (record: MonitorSendGroup): string[] => {
  if (!record.notify_methods) return [];

  try {
    if (Array.isArray(record.notify_methods)) {
      return record.notify_methods
        .map((method) => {
          // 处理字符串类型的方法
          if (typeof method === 'string') {
            // 尝试解析可能是JSON字符串的方法
            if (method.startsWith('[') && method.endsWith(']')) {
              try {
                return JSON.parse(method);
              } catch {
                return method;
              }
            }
            return method;
          }
          return method;
        })
        .flat();
    }

    // 如果是字符串，尝试解析为JSON
    if (typeof record.notify_methods === 'string') {
      try {
        const parsed = JSON.parse(record.notify_methods);
        return Array.isArray(parsed) ? parsed : [record.notify_methods];
      } catch {
        return [record.notify_methods];
      }
    }

    return [];
  } catch {
    return [];
  }
};

// 更新统计数据
const updateStats = () => {
  stats.total = paginationConfig.total;
  stats.enabled = sendGroupList.value.filter(
    (item) => item.enable === 1,
  ).length;
  stats.needUpgrade = sendGroupList.value.filter(
    (item) => item.need_upgrade === 1,
  ).length;
  stats.associatedPools = new Set(
    sendGroupList.value.map((item) => item.pool_id).filter(Boolean),
  ).size;
};

// 数据加载
const loadSendGroupList = async (
  stillCurrent: () => boolean = () => true,
): Promise<void> => {
  const owner = operationOwner();
  if (disposed || !stillCurrent()) return;
  const request = beginRequest();
  const isCurrent = () =>
    request.isCurrent() && owner === operationOwner() && stillCurrent();
  try {
    const params: GetMonitorSendGroupListReq = {
      page: paginationConfig.current,
      size: paginationConfig.pageSize,
      search: searchQuery.value || undefined,
      enable: enableFilter.value,
    };

    const response = (await getMonitorSendGroupListApi(
      params,
    )) as ApiListResponse<MonitorSendGroup>;
    if (!isCurrent()) return;
    if (response) {
      let list = response.items || [];

      // 过滤升级配置
      if (upgradeFilter.value !== undefined) {
        list = list.filter(
          (item: MonitorSendGroup) => item.need_upgrade === upgradeFilter.value,
        );
      }

      // 规范数据结构
      list = list.map((item: MonitorSendGroup) => ({
        ...item,
        notify_methods: getNotifyMethods(item),
        static_receive_users: Array.isArray(item.static_receive_users)
          ? item.static_receive_users
          : [],
      }));

      sendGroupList.value = list;
      paginationConfig.total = response.total || 0;
      updateStats();
    }
  } catch (error: any) {
    if (!isCurrent()) return;
    if (!request.fail(error, '加载发送组列表失败')) return;
    sendGroupList.value = [];
    paginationConfig.total = 0;
    updateStats();
    if (shouldNotifyPageError(error)) message.error(loadError.value);
  } finally {
    request.finish();
  }
};

// 加载选项数据
const loadOptionsData = async (): Promise<void> => {
  const owner = operationOwner();
  if (disposed || !owner) return;
  if (catalogOwner !== owner) {
    alertManagerPools.value = [];
    onDutyGroups.value = [];
    userOptions.value = [];
  }
  catalogOwner = owner;
  const ticket = ++catalogRevision;
  const isCurrent = () =>
    !disposed && ticket === catalogRevision && owner === operationOwner();
  try {
    const pageSize = 50;

    // 加载AlertManager池
    let allAlertManagerPools: MonitorAlertManagerPool[] = [];
    let currentPage = 1;
    let hasMoreData = true;

    while (hasMoreData) {
      if (!isCurrent()) return;
      const poolResponse = (await getMonitorAlertManagerPoolListApi({
        page: currentPage,
        size: pageSize,
      })) as ApiListResponse<MonitorAlertManagerPool>;
      if (!isCurrent()) return;

      if (poolResponse && poolResponse.items && poolResponse.items.length > 0) {
        allAlertManagerPools = [...allAlertManagerPools, ...poolResponse.items];

        if (
          poolResponse.items.length < pageSize ||
          allAlertManagerPools.length >= (poolResponse.total || 0)
        ) {
          hasMoreData = false;
        } else {
          currentPage++;
        }
      } else {
        hasMoreData = false;
      }
    }
    alertManagerPools.value = poolOptions(allAlertManagerPools);

    // 加载值班组 - 实现真分页
    let allOnDutyGroups: MonitorOnDutyGroup[] = [];
    currentPage = 1;
    hasMoreData = true;

    while (hasMoreData) {
      if (!isCurrent()) return;
      const onDutyGroupResponse = (await getMonitorOnDutyGroupListApi({
        page: currentPage,
        size: pageSize,
      })) as ApiListResponse<MonitorOnDutyGroup>;
      if (!isCurrent()) return;

      if (
        onDutyGroupResponse &&
        onDutyGroupResponse.items &&
        onDutyGroupResponse.items.length > 0
      ) {
        allOnDutyGroups = [...allOnDutyGroups, ...onDutyGroupResponse.items];

        if (
          onDutyGroupResponse.items.length < pageSize ||
          allOnDutyGroups.length >= (onDutyGroupResponse.total || 0)
        ) {
          hasMoreData = false;
        } else {
          currentPage++;
        }
      } else {
        hasMoreData = false;
      }
    }
    onDutyGroups.value = allOnDutyGroups.filter((group) =>
      validPositiveId(group.id),
    );

    // 加载用户列表 - 实现真分页
    let allUsers: UserInfo[] = [];
    currentPage = 1;
    hasMoreData = true;

    while (hasMoreData) {
      if (!isCurrent()) return;
      const userResponse = (await getUserList({
        page: currentPage,
        size: pageSize,
        search: '',
      })) as ApiListResponse<UserInfo>;
      if (!isCurrent()) return;

      if (userResponse && userResponse.items && userResponse.items.length > 0) {
        allUsers = [...allUsers, ...userResponse.items];

        if (
          userResponse.items.length < pageSize ||
          allUsers.length >= (userResponse.total || 0)
        ) {
          hasMoreData = false;
        } else {
          currentPage++;
        }
      } else {
        hasMoreData = false;
      }
    }

    userOptions.value = allUsers.flatMap((user: UserInfo) =>
      validPositiveId(user.id)
        ? [
            {
              label: user.username,
              username: user.username,
              value: user.id,
            },
          ]
        : [],
    );
  } catch (error: any) {
    if (isCurrent() && shouldNotifyPageError(error))
      message.error('加载选项数据失败');
  }
};

// 动态加载AlertManager池数据
const loadDialogPools = async (isNewSearch = false) => {
  const context = captureForm();
  if (!context || (!isNewSearch && dialogPoolLoading.value)) return;

  if (isNewSearch) {
    dialogPoolPage.value = 1;
    dialogPoolHasMore.value = true;
    dialogPools.value = dialogPools.value.filter(
      (pool) => pool.id === formDialog.form.pool_id,
    );
  }

  if (!dialogPoolHasMore.value) return;

  const ticket = ++poolRevision;
  const page = dialogPoolPage.value;
  const search = dialogPoolSearch.value;
  const ownsRequest = () => context.isCurrent() && ticket === poolRevision;
  const isCurrent = () => ownsRequest() && search === dialogPoolSearch.value;
  dialogPoolLoading.value = true;
  try {
    const response = (await getMonitorAlertManagerPoolListApi({
      page,
      size: 20,
      search,
    })) as ApiListResponse<MonitorAlertManagerPool>;
    if (!isCurrent()) return;

    if (response && response.items && response.items.length > 0) {
      const items = poolOptions(response.items);
      const retained = dialogPools.value.filter(
        (pool) =>
          (page !== 1 || pool.id === formDialog.form.pool_id) &&
          !items.some((item) => item.id === pool.id),
      );
      dialogPools.value =
        page === 1
          ? [...items, ...retained]
          : [
              ...dialogPools.value,
              ...items.filter(
                (item) =>
                  !dialogPools.value.some(
                    (existing) => existing.id === item.id,
                  ),
              ),
            ];
      dialogPoolPage.value = page + 1;
      dialogPoolHasMore.value = page * 20 < (response.total || 0);
    } else {
      dialogPoolHasMore.value = false;
    }
  } catch (error: unknown) {
    if (isCurrent() && shouldNotifyPageError(error))
      message.error('获取AlertManager池数据失败');
  } finally {
    if (ownsRequest()) dialogPoolLoading.value = false;
  }
};

// 动态加载值班组数据
const loadDialogOnDutyGroups = async (isNewSearch = false) => {
  const context = captureForm();
  if (!context || (!isNewSearch && dialogOnDutyGroupLoading.value)) return;

  if (isNewSearch) {
    dialogOnDutyGroupPage.value = 1;
    dialogOnDutyGroupHasMore.value = true;
    dialogOnDutyGroups.value = dialogOnDutyGroups.value.filter(
      (group) => group.id === formDialog.form.on_duty_group_id,
    );
  }

  if (!dialogOnDutyGroupHasMore.value) return;

  const ticket = ++dutyRevision;
  const page = dialogOnDutyGroupPage.value;
  const search = dialogOnDutyGroupSearch.value;
  const ownsRequest = () => context.isCurrent() && ticket === dutyRevision;
  const isCurrent = () =>
    ownsRequest() && search === dialogOnDutyGroupSearch.value;
  dialogOnDutyGroupLoading.value = true;
  try {
    const response = (await getMonitorOnDutyGroupListApi({
      page,
      size: 20,
      search,
    })) as ApiListResponse<MonitorOnDutyGroup>;
    if (!isCurrent()) return;

    if (response && response.items && response.items.length > 0) {
      const items = response.items.flatMap((group) =>
        validPositiveId(group.id) ? [{ id: group.id, name: group.name }] : [],
      );
      const retained = dialogOnDutyGroups.value.filter(
        (group) =>
          (page !== 1 || group.id === formDialog.form.on_duty_group_id) &&
          !items.some((item) => item.id === group.id),
      );
      dialogOnDutyGroups.value =
        page === 1
          ? [...items, ...retained]
          : [
              ...dialogOnDutyGroups.value,
              ...items.filter(
                (item) =>
                  !dialogOnDutyGroups.value.some(
                    (existing) => existing.id === item.id,
                  ),
              ),
            ];
      dialogOnDutyGroupPage.value = page + 1;
      dialogOnDutyGroupHasMore.value = page * 20 < (response.total || 0);
    } else {
      dialogOnDutyGroupHasMore.value = false;
    }
  } catch (error: unknown) {
    if (isCurrent() && shouldNotifyPageError(error))
      message.error('获取值班组数据失败');
  } finally {
    if (ownsRequest()) dialogOnDutyGroupLoading.value = false;
  }
};

// 动态加载用户数据
const loadDialogUsers = async (isNewSearch = false) => {
  const context = captureForm();
  if (!context || (!isNewSearch && dialogUserLoading.value)) return;

  if (isNewSearch) {
    dialogUserPage.value = 1;
    dialogUserHasMore.value = true;
    const selected = new Set([
      ...formDialog.form.first_upgrade_users,
      ...formDialog.form.second_upgrade_users,
      ...formDialog.form.static_receive_users,
    ]);
    dialogUsers.value = dialogUsers.value.filter((user) =>
      selected.has(user.value),
    );
  }

  if (!dialogUserHasMore.value) return;

  const ticket = ++usersRevision;
  const page = dialogUserPage.value;
  const search = dialogUserSearch.value;
  const ownsRequest = () => context.isCurrent() && ticket === usersRevision;
  const isCurrent = () => ownsRequest() && search === dialogUserSearch.value;
  dialogUserLoading.value = true;
  try {
    const response = (await getUserList({
      page,
      size: 20,
      search,
    })) as ApiListResponse<UserInfo>;
    if (!isCurrent()) return;

    if (response && response.items && response.items.length > 0) {
      const items = response.items.flatMap((user: UserInfo) => {
        if (!validPositiveId(user.id)) return [];
        // 优先使用username，如果没有则使用real_name或name
        const displayName =
          user.username || user.real_name || user.name || `用户ID: ${user.id}`;
        return [
          {
            label: displayName,
            username: user.username || '',
            value: user.id,
          },
        ];
      });
      const selected = new Set([
        ...formDialog.form.first_upgrade_users,
        ...formDialog.form.second_upgrade_users,
        ...formDialog.form.static_receive_users,
      ]);
      const retained = dialogUsers.value.filter(
        (user) =>
          (page !== 1 || selected.has(user.value)) &&
          !items.some((item) => item.value === user.value),
      );
      dialogUsers.value =
        page === 1
          ? [...items, ...retained]
          : [
              ...dialogUsers.value,
              ...items.filter(
                (item) =>
                  !dialogUsers.value.some(
                    (existing) => existing.value === item.value,
                  ),
              ),
            ];
      dialogUserPage.value = page + 1;
      dialogUserHasMore.value = page * 20 < (response.total || 0);
    } else {
      dialogUserHasMore.value = false;
    }
  } catch (error: unknown) {
    if (isCurrent() && shouldNotifyPageError(error))
      message.error('获取用户数据失败');
  } finally {
    if (ownsRequest()) dialogUserLoading.value = false;
  }
};

// 搜索处理函数
const handleDialogPoolSearch = (value: string) => {
  clearTimeout(poolSearchDebounce);
  dialogPoolSearch.value = value;
  poolSearchDebounce = setTimeout(() => {
    loadDialogPools(true);
  }, 300);
};

const handleDialogOnDutyGroupSearch = (value: string) => {
  clearTimeout(onDutyGroupSearchDebounce);
  dialogOnDutyGroupSearch.value = value;
  onDutyGroupSearchDebounce = setTimeout(() => {
    loadDialogOnDutyGroups(true);
  }, 300);
};

const handleDialogUserSearch = (value: string) => {
  clearTimeout(userSearchDebounce);
  dialogUserSearch.value = value;
  userSearchDebounce = setTimeout(() => {
    loadDialogUsers(true);
  }, 300);
};

// 滚动处理函数
const handleDialogPoolScroll = (e: any) => {
  const { target } = e;
  if (target.scrollTop + target.offsetHeight >= target.scrollHeight - 5) {
    loadDialogPools();
  }
};

const handleDialogOnDutyGroupScroll = (e: any) => {
  const { target } = e;
  if (target.scrollTop + target.offsetHeight >= target.scrollHeight - 5) {
    loadDialogOnDutyGroups();
  }
};

const handleDialogUserScroll = (e: any) => {
  const { target } = e;
  if (target.scrollTop + target.offsetHeight >= target.scrollHeight - 5) {
    loadDialogUsers();
  }
};

// 事件处理
const handleTableChange = (pagination: any): void => {
  paginationConfig.current = pagination.current;
  paginationConfig.pageSize = pagination.pageSize;
  loadSendGroupList();
};

const handleSearch = (): void => {
  paginationConfig.current = 1;
  loadSendGroupList();
};

const handleSearchChange = (): void => {
  if (searchTimeout) {
    clearTimeout(searchTimeout);
  }
  searchTimeout = setTimeout(() => {
    paginationConfig.current = 1;
    loadSendGroupList();
  }, 500);
};

const handleEnableChange = (): void => {
  paginationConfig.current = 1;
  loadSendGroupList();
};

const handleUpgradeChange = (): void => {
  paginationConfig.current = 1;
  loadSendGroupList();
};

const handleResetFilters = (): void => {
  searchQuery.value = '';
  enableFilter.value = undefined;
  upgradeFilter.value = undefined;
  paginationConfig.current = 1;
  loadSendGroupList();
};

const prepareForm = (owner: string) => {
  invalidateInteraction();
  formOwner = owner;
  dialogPoolSearch.value = '';
  dialogOnDutyGroupSearch.value = '';
  dialogUserSearch.value = '';
  dialogPools.value = [];
  dialogOnDutyGroups.value = [];
  dialogUsers.value = [];
  detailDialogVisible.value = false;
  detailDialog.form = null;
};

const loadFormOptions = () => {
  loadDialogPools(true);
  loadDialogOnDutyGroups(true);
  loadDialogUsers(true);
};

const handleCreateSendGroup = (): void => {
  const owner = operationOwner();
  if (disposed || !owner || !hasPerm('/api/monitor/send_groups/create')) return;
  prepareForm(owner);
  formDialog.isEdit = false;
  formDialog.form = initialSendForm();
  formDialogVisible.value = true;
  if (catalogOwner !== owner) loadOptionsData();
  loadFormOptions();
};

type SendFormContext = NonNullable<ReturnType<typeof captureForm>>;
const retainSavedPool = async (
  context: SendFormContext,
  id: number,
): Promise<void> => {
  const isCurrent = () => context.isCurrent() && formDialog.form.pool_id === id;
  if (!isCurrent()) return;
  const cached =
    catalogOwner === context.owner
      ? alertManagerPools.value.find((pool) => pool.id === id)
      : undefined;
  if (cached) {
    if (!dialogPools.value.some((pool) => pool.id === id))
      dialogPools.value.push(cached);
    return;
  }
  try {
    const pool: MonitorAlertManagerPool =
      await getMonitorAlertManagerPoolApi(id);
    if (!isCurrent()) return;
    const poolId = pool?.id;
    if (!validPositiveId(poolId) || poolId !== id)
      throw new Error('AlertManager池详情标识不匹配');
    if (!dialogPools.value.some((option) => option.id === id))
      dialogPools.value.push({ id: poolId, name: pool.name });
  } catch (error: unknown) {
    if (isCurrent() && shouldNotifyPageError(error))
      message.error('加载已保存AlertManager池失败');
  }
};

const handleEditSendGroup = (record: MonitorSendGroup): void => {
  const owner = operationOwner();
  const id = record.id;
  if (
    disposed ||
    !owner ||
    !validPositiveId(id) ||
    !hasPerm('/api/monitor/send_groups/update/:id')
  ) {
    message.warning('发送组或账号标识无效，请刷新后重试');
    return;
  }
  const lists = [
    record.static_receive_users,
    record.first_upgrade_users,
    record.second_upgrade_users,
  ];
  if (
    lists.some(
      (users) =>
        users !== undefined &&
        users !== null &&
        (!Array.isArray(users) ||
          users.some((user) => !user || !validPositiveId(user.id))),
    )
  ) {
    message.warning('发送组接收人数据无效，请刷新后重试');
    return;
  }
  const methods = getNotifyMethods(record);
  if (methods.some((method) => typeof method !== 'string')) {
    message.warning('发送组通知方式无效，请刷新后重试');
    return;
  }
  const data: SendForm = {
    enable: record.enable === 1,
    fei_shu_qun_robot_token: record.fei_shu_qun_robot_token || '',
    first_upgrade_users: (record.first_upgrade_users || []).map(
      (user) => user.id,
    ),
    id,
    name: record.name || '',
    name_zh: record.name_zh || '',
    need_upgrade: record.need_upgrade === 1,
    notify_methods: methods,
    on_duty_group_id: record.on_duty_group_id,
    pool_id: record.pool_id,
    repeat_interval: record.repeat_interval || '30s',
    second_upgrade_users: (record.second_upgrade_users || []).map(
      (user) => user.id,
    ),
    send_resolved: record.send_resolved === 1,
    static_receive_users: (record.static_receive_users || []).map(
      (user) => user.id,
    ),
    upgrade_minutes: record.upgrade_minutes || 0,
  };
  prepareForm(owner);
  formDialog.isEdit = true;
  formDialog.form = data;
  const selectedUsers = [
    ...(record.static_receive_users || []),
    ...(record.first_upgrade_users || []),
    ...(record.second_upgrade_users || []),
  ];
  dialogUsers.value = selectedUsers
    .flatMap((user) =>
      validPositiveId(user.id)
        ? [
            {
              label: user.username || `用户ID: ${user.id}`,
              username: user.username || '',
              value: user.id,
            },
          ]
        : [],
    )
    .filter(
      (user, index, all) =>
        all.findIndex((other) => other.value === user.value) === index,
    );
  const dutyId = record.on_duty_group_id;
  if (validPositiveId(dutyId)) {
    const cached =
      catalogOwner === owner
        ? onDutyGroups.value.find((group) => group.id === dutyId)
        : undefined;
    dialogOnDutyGroups.value = [
      { id: dutyId, name: cached?.name || `值班组ID: ${dutyId}` },
    ];
  }
  formDialogVisible.value = true;
  if (catalogOwner !== owner) loadOptionsData();
  loadFormOptions();
  const context = captureForm();
  if (context && validPositiveId(record.pool_id))
    retainSavedPool(context, record.pool_id);
};

const handleViewSendGroup = async (record: MonitorSendGroup): Promise<void> => {
  const owner = operationOwner();
  const id = record.id;
  if (
    disposed ||
    !owner ||
    !validPositiveId(id) ||
    !hasPerm('/api/monitor/send_groups/detail/:id')
  )
    return;
  invalidateInteraction();
  formDialogVisible.value = false;
  formDialog.form = initialSendForm();
  detailDialog.form = null;
  detailDialogVisible.value = true;
  const ticket = interactionRevision;
  const ownsRequest = () =>
    !disposed && ticket === interactionRevision && owner === operationOwner();
  const isCurrent = () =>
    ownsRequest() &&
    detailDialogVisible.value &&
    record.id === id &&
    hasPerm('/api/monitor/send_groups/detail/:id');
  detailLoading.value = true;
  try {
    const response: MonitorSendGroup = await getMonitorSendGroupDetailApi(id);
    if (!isCurrent()) return;
    if (!response || response.id !== id)
      throw new Error('发送组详情标识不匹配');
    detailDialog.form = response;
  } catch (error: unknown) {
    if (isCurrent() && shouldNotifyPageError(error))
      message.error('获取发送组详情失败');
  } finally {
    if (ownsRequest()) detailLoading.value = false;
  }
};

const handleDeleteClick = (record: MonitorSendGroup): void => {
  const id = record.id;
  const owner = operationOwner();
  if (
    disposed ||
    !owner ||
    !validPositiveId(id) ||
    !hasPerm('/api/monitor/send_groups/delete/:id')
  )
    return;
  invalidateInteraction();
  formDialogVisible.value = false;
  detailDialogVisible.value = false;
  const ticket = interactionRevision;
  const name = record.name_zh || record.name;
  const isCurrent = () =>
    !disposed &&
    ticket === interactionRevision &&
    owner === operationOwner() &&
    record.id === id &&
    hasPerm('/api/monitor/send_groups/delete/:id');
  let consumed = false;
  deleteDialog = Modal.confirm({
    cancelText: '取消',
    content: `确定要删除发送组 "${name}" 吗？`,
    okText: '删除',
    okType: 'danger',
    onCancel() {
      if (ticket === interactionRevision && owner === operationOwner())
        invalidateInteraction();
    },
    async onOk() {
      if (consumed || !isCurrent()) return;
      consumed = true;
      try {
        await deleteMonitorSendGroupApi(id);
        if (!isCurrent()) return;
        message.success(`发送组 "${name}" 已删除`);
        await loadSendGroupList(isCurrent);
      } catch (error: unknown) {
        if (isCurrent() && shouldNotifyPageError(error))
          message.error('删除发送组失败');
      }
    },
    title: '警告',
  });
};

const closeFormDialog = (): void => {
  if (!formDialogVisible.value) return;
  invalidateInteraction();
  formDialogVisible.value = false;
  formDialog.form = initialSendForm();
  dialogPools.value = [];
  dialogOnDutyGroups.value = [];
  dialogUsers.value = [];
};

const fingerprintForm = (): string | undefined => {
  try {
    return JSON.stringify(formDialog.form);
  } catch {
    return undefined;
  }
};

const saveSendGroup = async (): Promise<void> => {
  const context = captureForm();
  const form = formRef.value;
  if (!context || submitting.value) return;
  const permission = context.isEdit
    ? '/api/monitor/send_groups/update/:id'
    : '/api/monitor/send_groups/create';
  if (!hasPerm(permission) || (context.isEdit && !validPositiveId(context.id)))
    return;
  if (!form || typeof form.validate !== 'function') {
    message.warning('表单尚未就绪，请稍后重试');
    return;
  }
  const data = formDialog.form;
  const fingerprint = fingerprintForm();
  if (fingerprint === undefined) return;
  const snapshot = cloneDeep(toRaw(data));
  const names = new Map(
    dialogUsers.value.map((user) => [user.value, user.username || '']),
  );
  const ownsOperation = () =>
    !disposed &&
    context.revision === interactionRevision &&
    context.owner === operationOwner();
  const isCurrent = () =>
    context.isCurrent() &&
    hasPerm(permission) &&
    formRef.value === form &&
    formDialog.form === data &&
    fingerprintForm() === fingerprint;
  submitting.value = true;
  try {
    await form.validate();
  } catch {
    if (ownsOperation()) submitting.value = false;
    return;
  }
  if (!isCurrent()) {
    if (ownsOperation()) submitting.value = false;
    return;
  }
  try {
    const poolId = snapshot.pool_id;
    const dutyId = snapshot.on_duty_group_id ?? 0;
    const recipientLists = [
      snapshot.static_receive_users,
      snapshot.first_upgrade_users,
      snapshot.second_upgrade_users,
    ];
    if (
      !validPositiveId(poolId) ||
      (dutyId !== 0 && !validPositiveId(dutyId)) ||
      recipientLists.some(
        (ids) => !Array.isArray(ids) || ids.some((id) => !validPositiveId(id)),
      ) ||
      !Array.isArray(snapshot.notify_methods) ||
      snapshot.notify_methods.some((method) => typeof method !== 'string') ||
      !Number.isSafeInteger(snapshot.upgrade_minutes) ||
      snapshot.upgrade_minutes < 0
    ) {
      message.warning('关联池、接收人或升级参数无效，请重新选择');
      return;
    }
    if (!snapshot.name.trim() || !snapshot.name_zh.trim()) {
      message.warning('请输入有效的发送组名称');
      return;
    }
    const users = (ids: number[]) =>
      ids.map((id) => ({ id, username: names.get(id) || '' }));
    const payload: CreateMonitorSendGroupReq = {
      enable: snapshot.enable ? 1 : 2,
      fei_shu_qun_robot_token: snapshot.fei_shu_qun_robot_token,
      first_upgrade_users: users(snapshot.first_upgrade_users),
      name: snapshot.name,
      name_zh: snapshot.name_zh,
      need_upgrade: snapshot.need_upgrade ? 1 : 2,
      notify_methods: snapshot.notify_methods,
      on_duty_group_id: dutyId,
      pool_id: poolId,
      repeat_interval: snapshot.repeat_interval,
      second_upgrade_users: users(snapshot.second_upgrade_users),
      send_resolved: snapshot.send_resolved ? 1 : 2,
      static_receive_users: users(snapshot.static_receive_users),
      upgrade_minutes: snapshot.upgrade_minutes,
    };
    if (context.isEdit) {
      const id = context.id;
      if (!validPositiveId(id)) return;
      const update: UpdateMonitorSendGroupReq = { ...payload, id };
      await updateMonitorSendGroupApi(update);
    } else {
      await createMonitorSendGroupApi(payload);
    }
    if (!isCurrent()) return;
    message.success(
      `发送组 "${snapshot.name_zh}" 已${context.isEdit ? '更新' : '创建'}`,
    );
    closeFormDialog();
    const refreshRevision = interactionRevision;
    await loadSendGroupList(
      () =>
        !disposed &&
        refreshRevision === interactionRevision &&
        context.owner === operationOwner() &&
        hasPerm(permission),
    );
  } catch (error: unknown) {
    if (isCurrent() && shouldNotifyPageError(error))
      message.error('保存发送组失败');
  } finally {
    if (ownsOperation()) submitting.value = false;
  }
};

const closeDetailDialog = (): void => {
  if (!detailDialogVisible.value) return;
  invalidateInteraction();
  detailDialogVisible.value = false;
  detailDialog.form = null;
};

// 生命周期钩子
onMounted(() => {
  loadOptionsData();
  loadSendGroupList();
});
</script>

<template>
  <OpsPage description="配置接收对象、通知方式与升级规则" title="发送组">
    <!-- 页面标题 -->
    <template #actions>
      <a-button
        class="btn-create"
        type="primary"
        @click="handleCreateSendGroup"
      >
        <template #icon>
          <PlusOutlined />
        </template>
        <span class="btn-text">创建发送组</span>
      </a-button>
    </template>
    <template #filters>
      <div class="search-filters">
        <a-input-search
          v-model:value="searchQuery"
          allow-clear
          class="search-input"
          placeholder="搜索发送组名称..."
          @change="handleSearchChange"
          @search="handleSearch"
        />
        <a-select
          v-model:value="enableFilter"
          allow-clear
          class="filter-select"
          placeholder="启用状态"
          @change="handleEnableChange"
        >
          <a-select-option :value="undefined">全部</a-select-option>
          <a-select-option :value="1">启用</a-select-option>
          <a-select-option :value="2">禁用</a-select-option>
        </a-select>
        <a-select
          v-model:value="upgradeFilter"
          allow-clear
          class="filter-select"
          placeholder="升级配置"
          @change="handleUpgradeChange"
        >
          <a-select-option :value="undefined">全部</a-select-option>
          <a-select-option :value="1">需要升级</a-select-option>
          <a-select-option :value="2">无需升级</a-select-option>
        </a-select>
        <a-button class="reset-btn" @click="handleResetFilters">
          重置
        </a-button>
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
                title="总发送组"
              >
                <template #prefix>
                  <Icon icon="carbon:send" />
                </template>
              </a-statistic>
            </a-card>
          </a-col>
          <a-col :lg="6" :md="6" :sm="6" :xs="12">
            <a-card class="stats-card">
              <a-statistic
                :value="loadError ? '未知' : stats.enabled"
                :value-style="{ color: '#52c41a' }"
                title="本页启用中"
              >
                <template #prefix>
                  <Icon icon="carbon:checkmark" />
                </template>
              </a-statistic>
            </a-card>
          </a-col>
          <a-col :lg="6" :md="6" :sm="6" :xs="12">
            <a-card class="stats-card">
              <a-statistic
                :value="loadError ? '未知' : stats.needUpgrade"
                :value-style="{ color: '#faad14' }"
                title="本页配置升级"
              >
                <template #prefix>
                  <Icon icon="carbon:upgrade" />
                </template>
              </a-statistic>
            </a-card>
          </a-col>
          <a-col :lg="6" :md="6" :sm="6" :xs="12">
            <a-card class="stats-card">
              <a-statistic
                :value="loadError ? '未知' : stats.associatedPools"
                :value-style="{ color: '#cf1322' }"
                title="本页关联池数"
              >
                <template #prefix>
                  <Icon icon="carbon:link" />
                </template>
              </a-statistic>
            </a-card>
          </a-col>
        </a-row>
      </div>
    </template>

    <a-alert
      v-if="loadError"
      :message="loadError"
      role="alert"
      show-icon
      type="error"
    >
      <template #action>
        <a-button :loading="loading" size="small" @click="loadSendGroupList()">
          重试
        </a-button>
      </template>
    </a-alert>

    <!-- 表格容器 -->
    <div class="table-container">
      <a-card>
        <a-table
          :columns="columns"
          :data-source="sendGroupList"
          :loading="loading"
          :pagination="paginationConfig"
          :scroll="{ x: 1400 }"
          bordered
          row-key="id"
          @change="handleTableChange"
        >
          <template #bodyCell="{ column, record }">
            <template v-if="column.key === 'name'">
              <div class="pool-name-cell">
                <div
                  class="pool-badge"
                  :class="getPoolStatusClass(record)"
                ></div>
                <span class="pool-name-text">{{ record.name }}</span>
              </div>
            </template>

            <template v-if="column.key === 'name_zh'">
              <div class="tag-container">
                <a-tag class="tech-tag label-tag">
                  {{ record.name_zh }}
                </a-tag>
              </div>
            </template>

            <template v-if="column.key === 'pool_config'">
              <div class="tag-container">
                <a-tag
                  v-if="getPoolName(record.pool_id)"
                  class="tech-tag prometheus-tag"
                >
                  {{ getPoolName(record.pool_id) }}
                </a-tag>
                <a-tag
                  v-if="getOnDutyGroupName(record.on_duty_group_id)"
                  class="tech-tag alert-tag"
                >
                  {{ getOnDutyGroupName(record.on_duty_group_id) }}
                </a-tag>
                <span
                  v-if="
                    !getPoolName(record.pool_id) &&
                    !getOnDutyGroupName(record.on_duty_group_id)
                  "
                  class="empty-text"
                  >无关联</span
                >
              </div>
            </template>

            <template v-if="column.key === 'static_receive_users'">
              <div class="tag-container">
                <a-tag
                  v-for="(user, index) in record.static_receive_users"
                  :key="user?.id || index"
                  class="tech-tag label-tag"
                >
                  {{
                    user?.username ||
                    user?.name ||
                    (typeof user === 'string' ? user : '未命名用户')
                  }}
                </a-tag>
                <span
                  v-if="
                    !record.static_receive_users?.length &&
                    !record.static_receive_user_names?.length
                  "
                  class="empty-text"
                  >无用户</span
                >
                <a-tag
                  v-for="(name, index) in record.static_receive_user_names"
                  :key="`name-${index}`"
                  class="tech-tag label-tag"
                >
                  {{ name }}
                </a-tag>
              </div>
            </template>

            <template v-if="column.key === 'notify_methods'">
              <div class="tag-container">
                <a-tag
                  v-for="method in getNotifyMethods(record)"
                  :key="method"
                  class="tech-tag alert-tag"
                >
                  {{ method }}
                </a-tag>
                <span
                  v-if="!getNotifyMethods(record)?.length"
                  class="empty-text"
                  >无通知方式</span
                >
              </div>
            </template>

            <template v-if="column.key === 'enable'">
              <a-tag :color="record.enable === 1 ? 'success' : 'default'">
                {{ record.enable === 1 ? '启用' : '禁用' }}
              </a-tag>
            </template>

            <template v-if="column.key === 'notification_config'">
              <div class="config-info">
                <div class="config-item">
                  <span class="config-label">重复间隔:</span>
                  <span class="config-value">{{
                    record.repeat_interval || '30s'
                  }}</span>
                </div>
                <div class="config-item">
                  <span class="config-label">发送恢复:</span>
                  <span class="config-value">{{
                    record.send_resolved === 1 ? '是' : '否'
                  }}</span>
                </div>
              </div>
            </template>

            <template v-if="column.key === 'upgrade_config'">
              <div class="config-info">
                <div class="config-item">
                  <span class="config-label">需要升级:</span>
                  <span class="config-value">{{
                    record.need_upgrade === 1 ? '是' : '否'
                  }}</span>
                </div>
                <div v-if="record.need_upgrade === 1" class="config-item">
                  <span class="config-label">升级时间:</span>
                  <span class="config-value"
                    >{{ record.upgrade_minutes }}分钟</span
                  >
                </div>
              </div>
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
                  {{ getInitials(record.create_user_name) }}
                </a-avatar>
                <span class="creator-name">{{ record.create_user_name }}</span>
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
                  @click="handleViewSendGroup(record)"
                >
                  查看
                </a-button>
                <a-button
                  size="small"
                  type="default"
                  @click="handleEditSendGroup(record)"
                >
                  编辑
                </a-button>
                <a-dropdown v-if="can('monitor.sendGroup.delete')">
                  <template #overlay>
                    <a-menu @click="handleDeleteClick(record)">
                      <a-menu-item key="delete" danger>删除</a-menu-item>
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

    <!-- 创建/编辑发送组对话框 -->
    <a-modal
      :confirm-loading="submitting"
      :destroy-on-close="true"
      :open="formDialogVisible"
      :title="formDialog.isEdit ? '编辑发送组' : '创建发送组'"
      :width="formDialogWidth"
      class="responsive-modal send-group-modal"
      @cancel="closeFormDialog"
      @ok="saveSendGroup"
    >
      <a-form
        :key="interactionRevision"
        ref="formRef"
        :model="formDialog.form"
        :rules="formRules"
        layout="vertical"
      >
        <div class="form-section">
          <div class="section-title">基本信息</div>
          <a-row :gutter="16">
            <a-col :sm="12" :xs="24">
              <a-form-item
                :rules="[{ required: true, message: '请输入发送组名称' }]"
                label="发送组名称"
                name="name"
              >
                <a-input
                  v-model:value="formDialog.form.name"
                  placeholder="请输入发送组名称"
                />
              </a-form-item>
            </a-col>
            <a-col :sm="12" :xs="24">
              <a-form-item
                :rules="[{ required: true, message: '请输入发送组中文名称' }]"
                label="发送组中文名称"
                name="name_zh"
              >
                <a-input
                  v-model:value="formDialog.form.name_zh"
                  placeholder="请输入发送组中文名称"
                />
              </a-form-item>
            </a-col>
          </a-row>
        </div>

        <div class="form-section">
          <div class="section-title">关联配置</div>
          <a-row :gutter="16">
            <a-col :sm="12" :xs="24">
              <a-form-item label="关联AlertManager池" name="pool_id">
                <a-select
                  v-model:value="formDialog.form.pool_id"
                  :filter-option="false"
                  :loading="dialogPoolLoading"
                  allow-clear
                  class="full-width"
                  placeholder="请搜索并选择AlertManager池"
                  show-search
                  @popupScroll="handleDialogPoolScroll"
                  @search="handleDialogPoolSearch"
                >
                  <a-select-option
                    v-for="pool in dialogPools"
                    :key="pool.id"
                    :value="pool.id"
                  >
                    {{ pool.name }}
                  </a-select-option>
                </a-select>
              </a-form-item>
            </a-col>
            <a-col :sm="12" :xs="24">
              <a-form-item label="关联值班组" name="on_duty_group_id">
                <a-select
                  v-model:value="formDialog.form.on_duty_group_id"
                  :filter-option="false"
                  :loading="dialogOnDutyGroupLoading"
                  allow-clear
                  class="full-width"
                  placeholder="请搜索并选择值班组"
                  show-search
                  @popupScroll="handleDialogOnDutyGroupScroll"
                  @search="handleDialogOnDutyGroupSearch"
                >
                  <a-select-option
                    v-for="group in dialogOnDutyGroups"
                    :key="group.id"
                    :value="group.id"
                  >
                    {{ group.name }}
                  </a-select-option>
                </a-select>
              </a-form-item>
            </a-col>
          </a-row>
        </div>

        <div class="form-section">
          <div class="section-title">通知配置</div>
          <a-row :gutter="16">
            <a-col :sm="12" :xs="24">
              <a-form-item label="是否启用" name="enable">
                <a-switch
                  v-model:checked="formDialog.form.enable"
                  class="tech-switch"
                />
              </a-form-item>
            </a-col>
            <a-col :sm="12" :xs="24">
              <a-form-item label="发送恢复消息" name="send_resolved">
                <a-switch
                  v-model:checked="formDialog.form.send_resolved"
                  class="tech-switch"
                />
              </a-form-item>
            </a-col>
          </a-row>
          <a-row :gutter="16">
            <a-col :sm="12" :xs="24">
              <a-form-item label="重复发送间隔" name="repeat_interval">
                <a-input
                  v-model:value="formDialog.form.repeat_interval"
                  placeholder="例如：30s, 5m, 1h"
                />
              </a-form-item>
            </a-col>
            <a-col :sm="12" :xs="24">
              <a-form-item label="需要升级" name="need_upgrade">
                <a-switch
                  v-model:checked="formDialog.form.need_upgrade"
                  class="tech-switch"
                />
              </a-form-item>
            </a-col>
          </a-row>
          <a-row :gutter="16">
            <a-col :span="24">
              <a-form-item
                label="飞书群机器人Token"
                name="fei_shu_qun_robot_token"
              >
                <a-input
                  v-model:value="formDialog.form.fei_shu_qun_robot_token"
                  placeholder="请输入飞书群机器人Token"
                />
              </a-form-item>
            </a-col>
          </a-row>
        </div>

        <div v-if="formDialog.form.need_upgrade" class="form-section">
          <div class="section-title">升级配置</div>
          <a-row :gutter="16">
            <a-col :sm="12" :xs="24">
              <a-form-item label="升级时间间隔(分钟)" name="upgrade_minutes">
                <a-input-number
                  v-model:value="formDialog.form.upgrade_minutes"
                  :min="1"
                  class="full-width"
                  placeholder="请输入升级时间间隔"
                />
              </a-form-item>
            </a-col>
          </a-row>
        </div>

        <div class="form-section">
          <div class="section-title">接收用户配置</div>
          <!-- 静态接收用户 -->
          <a-form-item label="静态接收用户" name="static_receive_users">
            <a-select
              v-model:value="formDialog.form.static_receive_users"
              :filter-option="false"
              :loading="dialogUserLoading"
              :options="dialogUsers"
              class="full-width"
              mode="multiple"
              placeholder="请搜索并选择静态接收用户"
              show-search
              @popupScroll="handleDialogUserScroll"
              @search="handleDialogUserSearch"
            />
          </a-form-item>

          <!-- 通知方式 -->
          <a-form-item label="通知方式" name="notify_methods">
            <a-select
              v-model:value="formDialog.form.notify_methods"
              class="full-width"
              mode="multiple"
              placeholder="请选择通知方式"
            >
              <a-select-option value="email">邮件</a-select-option>
              <a-select-option value="sms">短信</a-select-option>
              <a-select-option value="feishu">飞书</a-select-option>
              <a-select-option value="webhook">Webhook</a-select-option>
            </a-select>
          </a-form-item>

          <!-- 首次升级用户 -->
          <a-form-item
            v-if="formDialog.form.need_upgrade"
            label="首次升级用户"
            name="first_upgrade_users"
          >
            <a-select
              v-model:value="formDialog.form.first_upgrade_users"
              :filter-option="false"
              :loading="dialogUserLoading"
              :options="dialogUsers"
              class="full-width"
              mode="multiple"
              placeholder="请搜索并选择首次升级用户"
              show-search
              @popupScroll="handleDialogUserScroll"
              @search="handleDialogUserSearch"
            />
          </a-form-item>

          <!-- 二次升级用户 -->
          <a-form-item
            v-if="formDialog.form.need_upgrade"
            label="二次升级用户"
            name="second_upgrade_users"
          >
            <a-select
              v-model:value="formDialog.form.second_upgrade_users"
              :filter-option="false"
              :loading="dialogUserLoading"
              :options="dialogUsers"
              class="full-width"
              mode="multiple"
              placeholder="请搜索并选择二次升级用户"
              show-search
              @popupScroll="handleDialogUserScroll"
              @search="handleDialogUserSearch"
            />
          </a-form-item>
        </div>
      </a-form>
    </a-modal>

    <!-- 详情对话框 -->
    <a-modal
      :footer="null"
      :open="detailDialogVisible"
      :width="previewDialogWidth"
      class="detail-dialog"
      title="发送组详情"
      @cancel="closeDetailDialog"
    >
      <a-spin v-if="detailLoading" />
      <a-alert
        v-else-if="!detailDialog.form"
        message="发送组详情读取失败，请关闭后重新打开"
        show-icon
        type="error"
      />
      <div v-else class="pool-details">
        <div class="detail-header">
          <h2>{{ detailDialog.form.name_zh || detailDialog.form.name }}</h2>
          <div class="detail-badges">
            <a-tag
              :color="detailDialog.form.enable === 1 ? 'success' : 'default'"
            >
              {{ detailDialog.form.enable === 1 ? '启用' : '禁用' }}
            </a-tag>
            <a-tag
              :color="
                detailDialog.form.need_upgrade === 1 ? 'warning' : 'default'
              "
            >
              {{
                detailDialog.form.need_upgrade === 1 ? '需要升级' : '无需升级'
              }}
            </a-tag>
            <a-tag
              :color="
                detailDialog.form.send_resolved === 1 ? 'success' : 'default'
              "
            >
              {{
                detailDialog.form.send_resolved === 1
                  ? '发送恢复'
                  : '不发送恢复'
              }}
            </a-tag>
          </div>
        </div>

        <a-descriptions :column="1" :labelStyle="{ width: '150px' }" bordered>
          <a-descriptions-item label="ID">
            {{ detailDialog.form.id }}
          </a-descriptions-item>
          <a-descriptions-item label="发送组名称">
            {{ detailDialog.form.name }}
          </a-descriptions-item>
          <a-descriptions-item label="中文名称">
            {{ detailDialog.form.name_zh }}
          </a-descriptions-item>
          <a-descriptions-item label="关联AlertManager池">
            {{ getPoolName(detailDialog.form.pool_id) || '未关联' }}
          </a-descriptions-item>
          <a-descriptions-item label="关联值班组">
            {{
              getOnDutyGroupName(detailDialog.form.on_duty_group_id) || '未关联'
            }}
          </a-descriptions-item>
          <a-descriptions-item label="重复间隔">
            {{ detailDialog.form.repeat_interval || '30s' }}
          </a-descriptions-item>
          <a-descriptions-item label="升级时间">
            {{
              detailDialog.form.need_upgrade === 1
                ? `${detailDialog.form.upgrade_minutes || 0}分钟`
                : '无需升级'
            }}
          </a-descriptions-item>
          <a-descriptions-item label="飞书Token">
            {{
              detailDialog.form.fei_shu_qun_robot_token
                ? maskToken(detailDialog.form.fei_shu_qun_robot_token)
                : '未配置'
            }}
          </a-descriptions-item>
          <a-descriptions-item label="创建人">
            {{ detailDialog.form.create_user_name }}
          </a-descriptions-item>
          <a-descriptions-item label="创建时间">
            {{ formatFullDateTime(detailDialog.form.created_at) }}
          </a-descriptions-item>
        </a-descriptions>

        <div class="detail-footer">
          <a-button @click="closeDetailDialog">关闭</a-button>
          <a-button
            type="primary"
            @click="handleEditSendGroup(detailDialog.form)"
          >
            编辑
          </a-button>
        </div>
      </div>
    </a-modal>
  </OpsPage>
</template>

<style scoped>
/* 响应式设计 */
@media (max-width: 768px) {
  .search-input {
    width: 100%;
    min-width: auto;
  }

  .filter-select {
    width: 100%;
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

  .action-buttons :deep(.ant-btn) {
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

.search-input {
  width: 250px;
  min-width: 200px;
}

.filter-select {
  width: 120px;
  min-width: 100px;
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

.pool-name-cell {
  display: flex;
  align-items: center;
  gap: 10px;
}

.pool-badge {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}

.status-full {
  background-color: #52c41a;
}

.status-partial {
  background-color: #faad14;
}

.status-none {
  background-color: var(--ops-border);
}

.pool-name-text {
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

.prometheus-tag {
  background-color: #e6f7ff;
  color: #0958d9;
  border-left: 1px solid #1890ff;
}

.alert-tag {
  background-color: #fff7e6;
  color: #d46b08;
  border-left: 1px solid #fa8c16;
}

.label-tag {
  background-color: #f6ffed;
  color: #389e0d;
  border-left: 1px solid #52c41a;
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

.action-buttons {
  display: flex;
  gap: 4px;
  justify-content: center;
  flex-wrap: wrap;
}

/* 表单样式 */
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

.tech-switch {
  background-color: rgb(0 0 0 / 25%);
}

.tech-switch.ant-switch-checked {
  background: var(--ops-accent);
}

/* 详情对话框样式 */
.detail-dialog .pool-details {
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

.detail-footer {
  margin-top: 24px;
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  flex-wrap: wrap;
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
</style>
