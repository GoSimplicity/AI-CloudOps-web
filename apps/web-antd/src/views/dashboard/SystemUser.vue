<script lang="ts" setup>
import type { FormInstance } from 'ant-design-vue';

import { computed, onMounted, onUnmounted, reactive, ref, watch } from 'vue';

import { useUserStore } from '@vben/stores';

import { Icon } from '@iconify/vue';
import { message } from 'ant-design-vue';

import {
  assignRolesToUserApi,
  getUserRolesApi,
  listRolesApi,
  revokeRolesFromUserApi,
} from '#/api/core/system/system';
import {
  changePassword,
  type ChangePasswordReq,
  deleteUser,
  getUserDetailApi,
  getUserList,
  type GetUserListReq,
  getUserStatistics,
  registerApi,
  type UpdateProfileReq,
  updateUserInfo,
  type UserSignUpReq,
} from '#/api/core/system/user';
import OpsPage from '#/components/ops/OpsPage.vue';
import { useAuthStore } from '#/store/auth';
import { usePermission } from '#/utils/permission';
import { shouldNotifyPageError } from '#/utils/permission/request-notice';

const { can, hasPerm } = usePermission();
const userStore = useUserStore();
const authStore = useAuthStore();

// 类型定义
interface UserStatistics {
  admin_count: number;
  active_user_count: number;
}

interface UserRole {
  id: number;
  name: string;
  code?: string;
  description?: string;
  status?: number;
}

interface UserInfo {
  id: number;
  username: string;
  real_name?: string;
  mobile?: string;
  email?: string;
  desc?: string;
  enable: number;
  account_type: number;
  avatar?: string;
  created_at?: any;
  roles?: UserRole[];
  fei_shu_user_id?: string;
  home_path?: string;
}

// 表单引用
const formRef = ref<FormInstance>();

// 表格列配置
const tableColumns = [
  { fixed: 'left', key: 'user', title: '用户', width: 200 },
  { key: 'contact', title: '联系方式', width: 160 },
  { align: 'center', key: 'type', title: '类型', width: 100 },
  { align: 'center', key: 'status', title: '状态', width: 80 },
  { align: 'center', key: 'roles', title: '角色数', width: 80 },
  { key: 'created_at', title: '注册时间', width: 120 },
  { fixed: 'right', key: 'actions', title: '操作', width: 160 },
];

// 状态管理
const loading = ref(false);
const submitLoading = ref(false);
const avatarUploading = ref(false);
const modalVisible = ref(false);
const roleModalVisible = ref(false);
const viewModalVisible = ref(false);
const pwdModalVisible = ref(false);
const modalTitle = ref('');

// 数据
const userList = ref<UserInfo[]>([]);
const roleList = ref<UserRole[]>([]);
const currentUser = ref<null | UserInfo>(null);
const assignedRoles = ref<UserRole[]>([]);
const rolesLoading = ref(false);
const rolesLoaded = ref(false);
const roleOperationLoading = ref(false);
let pageDisposed = false;
let roleWindowRevision = 0;
let roleReadRevision = 0;
let roleActionRevision = 0;
let userListRevision = 0;
let userStatisticsRevision = 0;
let roleCatalogRevision = 0;
let roleWindowOwner: string | undefined;
const roleReadPermission = '/api/role/user_roles/:id';

const pageOwner = () =>
  JSON.stringify([
    userStore.userInfo?.userId ?? '',
    authStore.getAuthGeneration(),
  ]);

const isValidRoleTargetId = (id: number) => Number.isSafeInteger(id) && id > 0;

const invalidateRoleWindow = () => {
  ++roleWindowRevision;
  ++roleReadRevision;
  ++roleActionRevision;
  roleWindowOwner = undefined;
  currentUser.value = null;
  assignedRoles.value = [];
  rolesLoading.value = false;
  rolesLoaded.value = false;
  roleOperationLoading.value = false;
};

const captureRoleWindow = () => {
  const userId = currentUser.value?.id;
  if (
    pageDisposed ||
    !userStore.userInfo?.userId ||
    !roleModalVisible.value ||
    userId === undefined ||
    !isValidRoleTargetId(userId) ||
    roleWindowOwner !== pageOwner() ||
    !hasPerm(roleReadPermission)
  ) {
    return;
  }
  return {
    owner: roleWindowOwner,
    userId,
    windowRevision: roleWindowRevision,
  };
};

type RoleWindowTarget = NonNullable<ReturnType<typeof captureRoleWindow>>;

const isCurrentRoleWindow = (target: RoleWindowTarget) =>
  !pageDisposed &&
  roleModalVisible.value &&
  roleWindowRevision === target.windowRevision &&
  currentUser.value?.id === target.userId &&
  roleWindowOwner === target.owner &&
  pageOwner() === target.owner &&
  hasPerm(roleReadPermission);

watch(
  roleModalVisible,
  (visible) => {
    if (!visible) invalidateRoleWindow();
  },
  { flush: 'sync' },
);
watch(
  pageOwner,
  () => {
    invalidateRoleWindow();
    roleModalVisible.value = false;
    roleList.value = [];
    ++roleCatalogRevision;
    ++userListRevision;
    ++userStatisticsRevision;
    loading.value = false;
  },
  { flush: 'sync' },
);
watch(
  () => hasPerm(roleReadPermission),
  (allowed) => {
    if (!allowed) {
      invalidateRoleWindow();
      roleModalVisible.value = false;
    }
  },
  { flush: 'sync' },
);
onUnmounted(() => {
  pageDisposed = true;
  invalidateRoleWindow();
  ++roleCatalogRevision;
  ++userListRevision;
  ++userStatisticsRevision;
});
const viewUserData = ref<null | UserInfo>(null);
const userStatistics = ref<UserStatistics>({
  active_user_count: 0,
  admin_count: 0,
});

// 搜索参数
const searchParams = reactive({
  account_type: undefined as number | undefined,
  enable: undefined as number | undefined,
  search: '',
});

// 分页配置
const paginationConfig = reactive({
  current: 1,
  pageSize: 20,
  pageSizeOptions: ['10', '20', '50', '100'],
  showQuickJumper: true,
  showSizeChanger: true,
  showTotal: (total: number, range: [number, number]) =>
    `第 ${range[0]}-${range[1]} 条，共 ${total} 条`,
  total: 0,
});

// 表单数据初始化
const initFormData = () => ({
  account_type: 1,
  avatar: '',
  confirmPassword: '',
  desc: '',
  email: '',
  enable: 1,
  fei_shu_user_id: '',
  home_path: '',
  id: 0,
  mobile: '',
  newPassword: '',
  password: '',
  real_name: '',
  username: '',
});

const formData = reactive(initFormData());

// 表单验证规则
const formRules = computed(() => {
  const rules: any = {
    mobile: [{ message: '请输入手机号', required: true, trigger: 'blur' }],
    real_name: [{ message: '请输入真实姓名', required: true, trigger: 'blur' }],
    username: [{ message: '请输入用户名', required: true, trigger: 'blur' }],
  };

  if (modalTitle.value === '新建用户') {
    rules.password = [
      { message: '请输入密码', required: true, trigger: 'blur' },
      { message: '密码长度至少6位', min: 6, trigger: 'blur' },
    ];
    rules.confirmPassword = [
      { message: '请确认密码', required: true, trigger: 'blur' },
      {
        trigger: 'blur',
        validator: (_rule: any, value: string) => {
          if (value && value !== formData.password) {
            return Promise.reject(new Error('两次输入的密码不一致'));
          }
          return Promise.resolve();
        },
      },
    ];
  }

  return rules;
});

// 修改密码表单验证规则
const formChangPwdRules = computed(() => {
  const rules: any = {
    password: [{ message: '请输入密码', required: true, trigger: 'blur' }],
  };

  if (modalTitle.value === '修改密码') {
    rules.password = [
      { message: '请输入密码', required: true, trigger: 'blur' },
      { message: '密码长度至少6位', min: 6, trigger: 'blur' },
    ];
    rules.newPassword = [
      { message: '请输入密码', required: true, trigger: 'blur' },
      { message: '密码长度至少6位', min: 6, trigger: 'blur' },
    ];

    rules.confirmPassword = [
      { message: '请确认密码', required: true, trigger: 'blur' },
      {
        trigger: 'blur',
        validator: (_rule: any, value: string) => {
          if (value && value !== formData.newPassword) {
            return Promise.reject(new Error('两次输入的密码不一致'));
          }
          return Promise.resolve();
        },
      },
    ];
  }

  return rules;
});

// 计算属性
const availableRoles = computed(() => {
  if (!currentUser.value || !rolesLoaded.value) return [];
  const assignedIds = new Set(assignedRoles.value.map((role) => role.id));
  return roleList.value.filter((role) => !assignedIds.has(role.id));
});

// 头像相关函数
const getAvatarUrl = (avatar: string) => {
  if (!avatar) return '';
  if (avatar.startsWith('http')) return avatar;
  if (avatar.startsWith('data:')) return avatar;
  return `/api/uploads/${avatar}`;
};

const getInitials = (username: string) => {
  if (!username) return 'U';
  return username.charAt(0).toUpperCase();
};

const handleAvatarError = (event: Event) => {
  const target = event.target as HTMLImageElement;
  if (target) {
    target.style.display = 'none';
  }
};

const handleAvatarUploadLocal = (file: File) => {
  avatarUploading.value = true;
  const reader = new FileReader();
  reader.addEventListener('load', (e) => {
    setTimeout(() => {
      if (e.target?.result) {
        formData.avatar = e.target.result as string;
        message.success('头像设置成功');
      }
      avatarUploading.value = false;
    }, 1000);
  });
  reader.readAsDataURL(file);
};

const beforeAvatarUpload = (file: File) => {
  const isJpgOrPng =
    file.type === 'image/jpeg' ||
    file.type === 'image/png' ||
    file.type === 'image/gif' ||
    file.type === 'image/webp';
  if (!isJpgOrPng) {
    message.error('只能上传 JPG/PNG/GIF/WebP 格式的图片!');
    return false;
  }

  const isLt2M = file.size / 1024 / 1024 < 2;
  if (!isLt2M) {
    message.error('图片大小不能超过 2MB!');
    return false;
  }

  handleAvatarUploadLocal(file);
  return false;
};

const handleAvatarChange = (info: any) => {
  if (info.file.status === 'uploading') {
    avatarUploading.value = true;
    return;
  }

  if (info.file.status === 'done') {
    avatarUploading.value = false;
    if (
      info.file.response &&
      info.file.response.data &&
      info.file.response.data.url
    ) {
      formData.avatar = info.file.response.data.url;
      message.success('头像上传成功');
    } else if (info.file.response && info.file.response.url) {
      formData.avatar = info.file.response.url;
      message.success('头像上传成功');
    } else {
      message.error('头像上传失败，返回数据格式错误');
    }
  }

  if (info.file.status === 'error') {
    avatarUploading.value = false;
    message.error('头像上传失败');
  }
};

const handleRemoveAvatar = () => {
  formData.avatar = '';
  message.success('头像已移除');
};

// 工具函数
const formatTime = (timestamp: any) => {
  if (!timestamp) return '-';
  return new Date(
    typeof timestamp === 'number' ? timestamp * 1000 : timestamp,
  ).toLocaleDateString('zh-CN');
};

const isAdminUser = (user: UserInfo) => {
  return user.roles?.some((role: UserRole) => role.code === 'admin') || false;
};

// API 调用
const fetchUserList = async (stillCurrent: () => boolean = () => true) => {
  const owner = pageOwner();
  const revision = ++userListRevision;
  const ownsRequest = () =>
    !pageDisposed && revision === userListRevision && owner === pageOwner();
  const isCurrent = () => ownsRequest() && stillCurrent();
  if (!isCurrent()) return;
  loading.value = true;
  try {
    const params: GetUserListReq = {
      account_type: 0,
      enable: 0,
      page: paginationConfig.current,
      search: searchParams.search || '',
      size: paginationConfig.pageSize,
    };

    if (searchParams.enable === 1 || searchParams.enable === 2) {
      params.enable = searchParams.enable;
    }

    if (searchParams.account_type === 1 || searchParams.account_type === 2) {
      params.account_type = searchParams.account_type;
    }

    const response = await getUserList(params);
    if (!isCurrent()) return;
    userList.value = response.items || [];
    paginationConfig.total = response.total || 0;
  } catch (error: any) {
    if (!isCurrent()) return;
    if (shouldNotifyPageError(error))
      message.error(error.message || '获取用户列表失败');
    userList.value = [];
    paginationConfig.total = 0;
  } finally {
    if (ownsRequest()) loading.value = false;
  }
};

const fetchRoleList = async () => {
  const owner = pageOwner();
  const revision = ++roleCatalogRevision;
  const isCurrent = () =>
    !pageDisposed && revision === roleCatalogRevision && owner === pageOwner();
  try {
    let allRoles: any[] = [];
    let currentPage = 1;
    const pageSize = 50;
    let hasMoreData = true;

    while (hasMoreData) {
      if (!isCurrent()) return;
      const response = await listRolesApi({
        page: currentPage,
        size: pageSize,
      });
      if (!isCurrent()) return;

      if (response && response.items && response.items.length > 0) {
        allRoles = [...allRoles, ...response.items];

        if (
          response.items.length < pageSize ||
          allRoles.length >= (response.total || 0)
        ) {
          hasMoreData = false;
        } else {
          currentPage++;
        }
      } else {
        hasMoreData = false;
      }
    }

    roleList.value = allRoles;
  } catch (error: any) {
    if (!isCurrent()) return;
    if (shouldNotifyPageError(error))
      message.error(error.message || '获取角色列表失败');
    roleList.value = [];
  }
};

const fetchUserRoles = async (
  target: RoleWindowTarget,
  stillCurrent: () => boolean = () => true,
) => {
  if (!isCurrentRoleWindow(target) || !stillCurrent()) return;
  const revision = ++roleReadRevision;
  const ownsRequest = () =>
    revision === roleReadRevision && isCurrentRoleWindow(target);
  const isCurrent = () => ownsRequest() && stillCurrent();
  rolesLoading.value = true;
  rolesLoaded.value = false;
  try {
    const response = await getUserRolesApi(target.userId);
    if (!isCurrent()) return;
    assignedRoles.value = response.items || [];
    rolesLoaded.value = true;
    return true;
  } catch (error: any) {
    if (!isCurrent()) return;
    if (shouldNotifyPageError(error)) message.error('获取用户角色失败');
  } finally {
    if (ownsRequest()) rolesLoading.value = false;
  }
};

const fetchUserStatistics = async (
  stillCurrent: () => boolean = () => true,
) => {
  const owner = pageOwner();
  const revision = ++userStatisticsRevision;
  const isCurrent = () =>
    !pageDisposed &&
    revision === userStatisticsRevision &&
    owner === pageOwner() &&
    stillCurrent();
  if (!isCurrent()) return;
  try {
    const response = await getUserStatistics();
    if (!isCurrent()) return;
    userStatistics.value = response;
  } catch (error: any) {
    if (!isCurrent()) return;
    if (shouldNotifyPageError(error))
      message.error(error.message || '获取用户统计失败');
    // 设置默认值避免显示undefined
    userStatistics.value = {
      active_user_count: 0,
      admin_count: 0,
    };
  }
};

// 事件处理
const handleSearch = () => {
  paginationConfig.current = 1;
  fetchUserList();
};

const handleReset = () => {
  searchParams.search = '';
  searchParams.enable = undefined;
  searchParams.account_type = undefined;
  paginationConfig.current = 1;
  fetchUserList();
};

const handleRefresh = () => {
  fetchUserList();
  fetchUserStatistics();
};

const handleTableChange = (pagination: any) => {
  paginationConfig.current = pagination.current;
  paginationConfig.pageSize = pagination.pageSize;
  fetchUserList();
};

const handleAdd = () => {
  modalTitle.value = '新建用户';
  Object.assign(formData, initFormData());
  modalVisible.value = true;
};

const handleEPwd = async (user: UserInfo) => {
  try {
    modalTitle.value = '修改密码';
    const response = await getUserDetailApi(user.id);
    Object.assign(formData, {
      id: response.id,
      username: response.username,
    });
    pwdModalVisible.value = true;
  } catch (error: any) {
    if (shouldNotifyPageError(error))
      message.error(error.message || '获取用户数据失败');
  }
};

const handleEdit = async (user: UserInfo) => {
  try {
    modalTitle.value = '编辑用户';
    const response = await getUserDetailApi(user.id);
    Object.assign(formData, {
      account_type: response.account_type,
      avatar: response.avatar || '',
      desc: response.desc || '',
      email: response.email || '',
      enable: response.enable,
      fei_shu_user_id: response.fei_shu_user_id || '',
      home_path: response.home_path || '',
      id: response.id,
      mobile: response.mobile,
      real_name: response.real_name,
      username: response.username,
    });
    modalVisible.value = true;
  } catch (error: any) {
    if (shouldNotifyPageError(error))
      message.error(error.message || '获取用户详情失败');
  }
};

const handleView = async (user: UserInfo) => {
  try {
    const response = await getUserDetailApi(user.id);
    viewUserData.value = response;
    viewModalVisible.value = true;
  } catch (error: any) {
    if (shouldNotifyPageError(error))
      message.error(error.message || '获取用户详情失败');
  }
};

const handleRoleManagement = async (user: UserInfo) => {
  if (
    pageDisposed ||
    !userStore.userInfo?.userId ||
    !isValidRoleTargetId(user.id) ||
    !hasPerm(roleReadPermission)
  ) {
    message.warning('用户标识无效或无权读取角色，请刷新后重试');
    return;
  }
  invalidateRoleWindow();
  currentUser.value = user;
  roleWindowOwner = pageOwner();
  roleModalVisible.value = true;
  if (roleList.value.length === 0) fetchRoleList();
  const target = captureRoleWindow();
  if (target) await fetchUserRoles(target);
};

const handleDelete = async (user: UserInfo) => {
  try {
    await deleteUser(user.id);
    message.success('删除成功');
    if (userList.value.length === 1 && paginationConfig.current > 1) {
      paginationConfig.current--;
    }
    await fetchUserList();
    await fetchUserStatistics(); // 删除后更新统计
  } catch (error: any) {
    if (shouldNotifyPageError(error))
      message.error(error.message || '删除失败');
  }
};

// 修复状态变更函数
const handleStatusChange = async (user: UserInfo, newStatus: number) => {
  const originalStatus = user.enable;

  try {
    // 乐观更新
    user.enable = newStatus;

    const updateData: UpdateProfileReq = {
      account_type: user.account_type as 1 | 2,
      avatar: user.avatar || '',
      desc: user.desc || '',
      email: user.email || '',
      enable: newStatus as 1 | 2,
      fei_shu_user_id: user.fei_shu_user_id || '',
      home_path: user.home_path || '',
      id: user.id,
      mobile: user.mobile || '',
      real_name: user.real_name || '',
    };

    await updateUserInfo(updateData);
    message.success('状态更新成功');

    // 更新统计数据
    await fetchUserStatistics();
  } catch (error: any) {
    // 发生错误时，恢复原来的状态
    user.enable = originalStatus;
    if (shouldNotifyPageError(error))
      message.error(error.message || '状态更新失败');
  }
};

const handleChangePasswordSubmit = async () => {
  try {
    await formRef.value?.validate();
    submitLoading.value = true;

    const changePasswordData: ChangePasswordReq = {
      confirm_password: formData.confirmPassword,
      new_password: formData.newPassword,
      password: formData.password,
      user_id: formData.id as number,
      username: formData.username,
    };
    // message.info(JSON.stringify(changePasswordData))
    await changePassword(changePasswordData);
    message.success('更新成功');
    pwdModalVisible.value = false;
  } catch (error: any) {
    if (!error.errorFields && shouldNotifyPageError(error))
      message.error(error.message || '操作失败');
  } finally {
    submitLoading.value = false;
  }
};

const handleSubmit = async () => {
  try {
    await formRef.value?.validate();
    submitLoading.value = true;

    if (modalTitle.value === '新建用户') {
      const signUpData: UserSignUpReq = {
        account_type: formData.account_type as 1 | 2,
        desc: formData.desc,
        enable: formData.enable as 1 | 2,
        fei_shu_user_id: formData.fei_shu_user_id || '',
        home_path: formData.home_path,
        mobile: formData.mobile,
        password: formData.password,
        real_name: formData.real_name,
        username: formData.username,
      };

      // 添加可选字段
      if (formData.email) {
        (signUpData as any).email = formData.email;
      }

      if (formData.avatar) {
        (signUpData as any).avatar = formData.avatar;
      }

      // 修复：添加飞书ID字段
      if (formData.fei_shu_user_id) {
        (signUpData as any).fei_shu_user_id = formData.fei_shu_user_id;
      }

      await registerApi(signUpData);
      message.success('创建成功');
    } else {
      const updateData: UpdateProfileReq = {
        account_type: formData.account_type as 1 | 2,
        avatar: formData.avatar || '',
        desc: formData.desc,
        email: formData.email || '',
        enable: formData.enable as 1 | 2,
        fei_shu_user_id: formData.fei_shu_user_id || '',
        home_path: formData.home_path,
        id: formData.id as number,
        mobile: formData.mobile,
        real_name: formData.real_name,
      };
      await updateUserInfo(updateData);
      message.success('更新成功');
    }

    modalVisible.value = false;
    await fetchUserList();
    await fetchUserStatistics(); // 更新统计数据
  } catch (error: any) {
    if (!error.errorFields && shouldNotifyPageError(error))
      message.error(error.message || '操作失败');
  } finally {
    submitLoading.value = false;
  }
};

const updateUserRole = async (role: UserRole, action: 'assign' | 'revoke') => {
  const target = captureRoleWindow();
  const roleId = role.id;
  const permission =
    action === 'assign' ? '/api/role/assign_users' : '/api/role/revoke_users';
  if (
    !target ||
    !rolesLoaded.value ||
    roleOperationLoading.value ||
    !isValidRoleTargetId(roleId) ||
    !hasPerm(permission)
  ) {
    return;
  }
  const revision = ++roleActionRevision;
  const ownsOperation = () =>
    revision === roleActionRevision && isCurrentRoleWindow(target);
  const isCurrent = () => ownsOperation() && hasPerm(permission);
  roleOperationLoading.value = true;
  try {
    const request = { role_ids: [roleId], user_id: target.userId };
    const changeRoles =
      action === 'assign' ? assignRolesToUserApi : revokeRolesFromUserApi;
    await changeRoles(request);
    if (!isCurrent()) return;
    message.success(action === 'assign' ? '角色分配成功' : '角色移除成功');
    if (!(await fetchUserRoles(target, isCurrent))) return;
    if (!isCurrent()) return;
    await fetchUserList(isCurrent);
    if (!isCurrent()) return;
    await fetchUserStatistics(isCurrent);
  } catch (error: any) {
    if (!isCurrent()) return;
    if (shouldNotifyPageError(error))
      message.error(action === 'assign' ? '角色分配失败' : '角色移除失败');
  } finally {
    if (ownsOperation()) roleOperationLoading.value = false;
  }
};

const handleAssignRole = (role: UserRole) => updateUserRole(role, 'assign');

const handleRevokeRole = (role: UserRole) => updateUserRole(role, 'revoke');

// 初始化
onMounted(() => {
  fetchUserList();
  fetchRoleList();
  fetchUserStatistics();
});
</script>

<template>
  <OpsPage title="用户管理">
    <!-- 页面头部 -->
    <template #actions>
      <a-button @click="handleRefresh">
        <Icon icon="material-symbols:refresh" />
        刷新
      </a-button>
      <a-button type="primary" @click="handleAdd">
        <Icon icon="material-symbols:add" />
        新建用户
      </a-button>
    </template>

    <!-- 统计卡片 -->
    <template #summary>
      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-number">{{ paginationConfig.total }}</div>
          <div class="stat-label">总用户数</div>
        </div>
        <div class="stat-card">
          <div class="stat-number">
            {{ userStatistics.active_user_count || 0 }}
          </div>
          <div class="stat-label">活跃用户</div>
        </div>
        <div class="stat-card">
          <div class="stat-number">{{ userStatistics.admin_count || 0 }}</div>
          <div class="stat-label">管理员</div>
        </div>
      </div>
    </template>

    <!-- 搜索筛选区域 -->
    <template #filters>
      <div class="ops-filter-row">
        <div class="search-left">
          <a-input
            v-model:value="searchParams.search"
            allow-clear
            aria-label="搜索用户"
            class="search-input"
            placeholder="搜索用户名"
            @press-enter="handleSearch"
          >
            <template #prefix>
              <Icon icon="material-symbols:search" />
            </template>
          </a-input>

          <a-select
            v-model:value="searchParams.enable"
            allow-clear
            class="status-select"
            placeholder="状态筛选"
          >
            <a-select-option :value="1">启用</a-select-option>
            <a-select-option :value="2">禁用</a-select-option>
          </a-select>

          <a-select
            v-model:value="searchParams.account_type"
            allow-clear
            class="type-select"
            placeholder="账号类型"
          >
            <a-select-option :value="1">普通用户</a-select-option>
            <a-select-option :value="2">服务账号</a-select-option>
          </a-select>
        </div>

        <div class="search-right">
          <a-button type="primary" @click="handleSearch">搜索</a-button>
          <a-button @click="handleReset">重置</a-button>
        </div>
      </div>
    </template>

    <!-- 用户表格 -->
    <div class="table-container">
      <a-table
        :columns="tableColumns"
        :data-source="userList"
        :loading="loading"
        :pagination="paginationConfig"
        :scroll="{ x: 'max-content' }"
        row-key="id"
        size="middle"
        @change="handleTableChange"
      >
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'user'">
            <div class="user-info">
              <div class="user-avatar">
                <img
                  v-if="record.avatar"
                  :alt="record.username"
                  :src="getAvatarUrl(record.avatar)"
                  @error="handleAvatarError"
                />
                <div v-else class="default-avatar">
                  {{ getInitials(record.username) }}
                </div>
              </div>
              <div>
                <div class="user-name">
                  {{ record.real_name || record.username }}
                </div>
                <div class="user-username">{{ record.username }}</div>
              </div>
            </div>
          </template>

          <template v-if="column.key === 'contact'">
            <div class="contact-info">
              <div v-if="record.mobile">{{ record.mobile }}</div>
              <div v-if="record.email">{{ record.email }}</div>
            </div>
          </template>

          <template v-if="column.key === 'type'">
            <a-tag v-if="record.account_type === 2" color="orange">
              服务账号
            </a-tag>
            <a-tag v-else-if="isAdminUser(record)" color="red">管理员</a-tag>
            <a-tag v-else color="blue">普通用户</a-tag>
          </template>

          <template v-if="column.key === 'status'">
            <a-switch
              :checked="record.enable === 1"
              size="small"
              @change="
                (checked: boolean) =>
                  handleStatusChange(record, checked ? 1 : 2)
              "
            />
          </template>

          <template v-if="column.key === 'roles'">
            {{ record.roles?.length || 0 }}
          </template>

          <template v-if="column.key === 'created_at'">
            {{ formatTime(record.created_at) }}
          </template>

          <template v-if="column.key === 'actions'">
            <div class="action-buttons">
              <a-button size="small" type="text" @click="handleView(record)">
                查看
              </a-button>
              <a-button size="small" type="text" @click="handleEdit(record)">
                编辑信息
              </a-button>
              <a-button size="small" type="text" @click="handleEPwd(record)">
                修改密码
              </a-button>
              <a-button
                size="small"
                type="text"
                @click="handleRoleManagement(record)"
              >
                角色
              </a-button>
              <a-popconfirm
                v-if="can('system.user.delete')"
                title="确定要删除吗？"
                @confirm="handleDelete(record)"
              >
                <a-button danger size="small" type="text">删除</a-button>
              </a-popconfirm>
            </div>
          </template>
        </template>
      </a-table>
    </div>

    <!-- 查看用户详情 -->
    <a-modal
      v-model:open="viewModalVisible"
      :footer="null"
      title="用户详情"
      width="700px"
    >
      <div v-if="viewUserData" class="user-detail">
        <div class="detail-section">
          <h3>基本信息</h3>
          <div class="detail-grid">
            <div class="detail-item">
              <label>用户名</label>
              <span>{{ viewUserData.username }}</span>
            </div>
            <div class="detail-item">
              <label>真实姓名</label>
              <span>{{ viewUserData.real_name || '-' }}</span>
            </div>
            <div class="detail-item">
              <label>手机号</label>
              <span>{{ viewUserData.mobile || '-' }}</span>
            </div>
            <div class="detail-item">
              <label>邮箱</label>
              <span>{{ viewUserData.email || '-' }}</span>
            </div>
            <div class="detail-item">
              <label>飞书ID</label>
              <span>{{ viewUserData.fei_shu_user_id || '-' }}</span>
            </div>
            <div class="detail-item avatar-detail">
              <label>头像</label>
              <div class="detail-avatar">
                <img
                  v-if="viewUserData.avatar"
                  :alt="viewUserData.username"
                  :src="getAvatarUrl(viewUserData.avatar)"
                  @error="handleAvatarError"
                />
                <div v-else class="default-avatar">
                  {{ getInitials(viewUserData.username) }}
                </div>
              </div>
            </div>
            <div class="detail-item">
              <label>账号类型</label>
              <a-tag
                :color="viewUserData.account_type === 2 ? 'orange' : 'blue'"
              >
                {{ viewUserData.account_type === 2 ? '服务账号' : '普通用户' }}
              </a-tag>
            </div>
            <div class="detail-item">
              <label>状态</label>
              <a-tag :color="viewUserData.enable === 1 ? 'green' : 'red'">
                {{ viewUserData.enable === 1 ? '启用' : '禁用' }}
              </a-tag>
            </div>
            <div class="detail-item">
              <label>注册时间</label>
              <span>{{ formatTime(viewUserData.created_at) }}</span>
            </div>
            <div v-if="viewUserData.desc" class="detail-item">
              <label>用户描述</label>
              <span>{{ viewUserData.desc }}</span>
            </div>
          </div>
        </div>

        <div v-if="viewUserData.roles?.length" class="detail-section">
          <h3>角色信息</h3>
          <div class="roles-list">
            <a-tag
              v-for="role in viewUserData.roles"
              :key="role.id"
              :color="role.status === 1 ? 'blue' : 'default'"
            >
              {{ role.name }}
            </a-tag>
          </div>
        </div>
      </div>
    </a-modal>
    <!-- 修改密码 -->
    <a-modal
      v-model:open="pwdModalVisible"
      :confirm-loading="submitLoading"
      :title="modalTitle"
      width="600px"
      @ok="handleChangePasswordSubmit"
    >
      <a-form
        ref="formRef"
        :model="formData"
        :rules="formChangPwdRules"
        layout="vertical"
      >
        <a-row :gutter="16">
          <a-col :span="12">
            <a-form-item label="用户名" name="username">
              <a-input v-model:value="formData.username" :disabled="true" />
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item
              :rules="[{ required: true, message: '请输入密码' }]"
              label="登录密码"
              name="password"
            >
              <a-input-password v-model:value="formData.password" />
            </a-form-item>
          </a-col>
        </a-row>
        <a-row :gutter="16">
          <a-col :span="12">
            <a-form-item label="新的密码" name="newPassword">
              <a-input-password v-model:value="formData.newPassword" />
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item label="密码确认" name="confirmPassword">
              <a-input-password v-model:value="formData.confirmPassword" />
            </a-form-item>
          </a-col>
        </a-row>
      </a-form>
    </a-modal>
    <!-- 编辑用户,不修改密码 -->
    <a-modal
      v-model:open="modalVisible"
      :confirm-loading="submitLoading"
      :title="modalTitle"
      width="600px"
      @ok="handleSubmit"
    >
      <a-form
        ref="formRef"
        :model="formData"
        :rules="formRules"
        layout="vertical"
      >
        <a-form-item label="头像" name="avatar">
          <div class="avatar-upload">
            <div
              :class="{ 'avatar-upload-loading': avatarUploading }"
              class="avatar-preview"
            >
              <img
                v-if="formData.avatar"
                :src="getAvatarUrl(formData.avatar)"
                alt="用户头像"
                @error="handleAvatarError"
              />
              <div v-else class="default-avatar">
                <Icon icon="material-symbols:person" style="font-size: 48px" />
              </div>
              <div v-if="avatarUploading" class="upload-loading">
                <Icon class="loading-icon" icon="material-symbols:refresh" />
              </div>
            </div>
            <div class="avatar-upload-actions">
              <a-upload
                :before-upload="beforeAvatarUpload"
                :show-upload-list="false"
                accept="image/*"
                action="/api/upload"
                name="avatar"
                @change="handleAvatarChange"
              >
                <a-button :loading="avatarUploading">
                  <Icon icon="material-symbols:upload" />
                  上传头像
                </a-button>
              </a-upload>
              <a-button
                v-if="formData.avatar"
                danger
                @click="handleRemoveAvatar"
              >
                <Icon icon="material-symbols:delete" />
                移除头像
              </a-button>
            </div>
          </div>
        </a-form-item>

        <a-row :gutter="16">
          <a-col :span="12">
            <a-form-item label="用户名" name="username">
              <a-input
                v-model:value="formData.username"
                :disabled="modalTitle === '编辑用户'"
              />
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item label="真实姓名" name="real_name">
              <a-input v-model:value="formData.real_name" />
            </a-form-item>
          </a-col>
        </a-row>

        <a-row :gutter="16">
          <a-col :span="12">
            <a-form-item label="手机号" name="mobile">
              <a-input v-model:value="formData.mobile" />
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item label="邮箱" name="email">
              <a-input v-model:value="formData.email" />
            </a-form-item>
          </a-col>
        </a-row>

        <a-row :gutter="16">
          <a-col :span="12">
            <a-form-item label="飞书ID" name="fei_shu_user_id">
              <a-input v-model:value="formData.fei_shu_user_id" />
            </a-form-item>
          </a-col>
        </a-row>

        <a-row v-if="modalTitle === '新建用户'" :gutter="16">
          <a-col :span="12">
            <a-form-item label="密码" name="password">
              <a-input-password v-model:value="formData.password" />
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item label="确认密码" name="confirmPassword">
              <a-input-password v-model:value="formData.confirmPassword" />
            </a-form-item>
          </a-col>
        </a-row>

        <a-row :gutter="16">
          <a-col :span="12">
            <a-form-item label="账号类型" name="account_type">
              <a-select v-model:value="formData.account_type">
                <a-select-option :value="1">普通用户</a-select-option>
                <a-select-option :value="2">服务账号</a-select-option>
              </a-select>
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item label="状态" name="enable">
              <a-select v-model:value="formData.enable">
                <a-select-option :value="1">启用</a-select-option>
                <a-select-option :value="2">禁用</a-select-option>
              </a-select>
            </a-form-item>
          </a-col>
        </a-row>

        <a-form-item label="用户描述" name="desc">
          <a-textarea
            v-model:value="formData.desc"
            :rows="3"
            placeholder="请输入用户描述信息"
          />
        </a-form-item>
      </a-form>
    </a-modal>

    <!-- 角色管理 -->
    <a-modal
      v-model:open="roleModalVisible"
      :footer="null"
      title="角色管理"
      width="700px"
    >
      <div v-if="currentUser">
        <div class="role-header">
          <h4>{{ currentUser.real_name || currentUser.username }} 的角色</h4>
        </div>

        <a-spin v-if="rolesLoading" />
        <a-alert
          v-else-if="!rolesLoaded"
          message="用户角色读取失败，请重新打开角色管理后重试"
          show-icon
          type="error"
        />
        <a-tabs v-else>
          <a-tab-pane key="assigned" tab="已分配角色">
            <div class="role-list">
              <div v-if="assignedRoles.length === 0" class="empty-state">
                暂无已分配的角色
              </div>
              <div
                v-for="role in assignedRoles"
                :key="role.id"
                class="role-item"
              >
                <div class="role-info">
                  <div class="role-name">{{ role.name }}</div>
                  <div class="role-desc">
                    {{ role.description || '暂无描述' }}
                  </div>
                </div>
                <a-button
                  :loading="roleOperationLoading"
                  danger
                  size="small"
                  type="text"
                  @click="handleRevokeRole(role)"
                >
                  移除
                </a-button>
              </div>
            </div>
          </a-tab-pane>

          <a-tab-pane key="available" tab="可分配角色">
            <div class="role-list">
              <div v-if="availableRoles.length === 0" class="empty-state">
                暂无可分配的角色
              </div>
              <div
                v-for="role in availableRoles"
                :key="role.id"
                class="role-item"
              >
                <div class="role-info">
                  <div class="role-name">{{ role.name }}</div>
                  <div class="role-desc">
                    {{ role.description || '暂无描述' }}
                  </div>
                </div>
                <a-button
                  :loading="roleOperationLoading"
                  size="small"
                  type="primary"
                  @click="handleAssignRole(role)"
                >
                  分配
                </a-button>
              </div>
            </div>
          </a-tab-pane>
        </a-tabs>
      </div>
    </a-modal>
  </OpsPage>
</template>

<style scoped>
@keyframes rotate {
  from {
    transform: rotate(0deg);
  }

  to {
    transform: rotate(360deg);
  }
}

@media (max-width: 1200px) {
  .search-left {
    flex-direction: column;
    gap: 12px;
  }

  .search-input {
    max-width: none;
  }

  .status-select,
  .type-select {
    width: 100%;
  }

  .search-right {
    justify-content: flex-end;
  }
}

@media (max-width: 768px) {
  .stats-grid {
    grid-template-columns: 1fr;
  }

  .search-right {
    flex-direction: column;
    gap: 8px;
  }

  .detail-grid {
    grid-template-columns: 1fr;
  }

  .action-buttons {
    flex-direction: column;
    width: 100%;
  }

  .user-info {
    flex-direction: column;
    align-items: flex-start;
    gap: 8px;
  }

  .avatar-upload {
    flex-direction: column;
    gap: 12px;
    text-align: center;
  }

  .avatar-preview {
    width: 60px;
    height: 60px;
  }

  .user-avatar {
    width: 32px;
    height: 32px;
  }

  .detail-avatar {
    width: 50px;
    height: 50px;
  }
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 16px;
  margin-bottom: 20px;
}

.stat-card {
  background: var(--ops-surface);
  padding: 20px;
  border-radius: var(--ops-radius);
  text-align: center;
  border: 1px solid var(--ops-border);
}

.stat-number {
  font-size: 28px;
  font-weight: 600;
  color: #1890ff;
  margin-bottom: 8px;
}

.stat-label {
  font-size: 14px;
  color: var(--ops-muted);
}

.search-left {
  display: flex;
  gap: 12px;
  flex: 1;
  align-items: flex-end;
}

.search-input {
  flex: 1;
  max-width: 300px;
}

.status-select,
.type-select {
  width: 140px;
}

.search-right {
  display: flex;
  gap: 8px;
  flex-shrink: 0;
}

.table-container {
  min-width: 0;
  background: var(--ops-surface);
  border-radius: var(--ops-radius);
  border: 1px solid var(--ops-border);
  overflow: hidden;
}

.table-container :deep(.ant-table-thead > tr > th) {
  background: var(--ops-ground);
  font-weight: 600;
  color: var(--ops-ink);
  border-bottom: 1px solid var(--ops-border);
}

.table-container :deep(.ant-table-tbody > tr:hover > td) {
  background: var(--ops-ground);
}

.user-info {
  display: flex;
  align-items: center;
  gap: 12px;
}

.user-avatar {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: var(--ops-border);
  display: flex;
  align-items: center;
  justify-content: center;
  color: hsl(var(--primary-foreground));
  font-weight: 600;
  overflow: hidden;
  flex-shrink: 0;
  position: relative;
  border: 1px solid rgb(0 0 0 / 10%);
}

.user-avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.user-avatar:hover {
  transform: scale(1.05);
  transition: transform 0.2s ease;
}

.default-avatar {
  background: var(--ops-accent);
  color: hsl(var(--primary-foreground));
  font-weight: 600;
  font-size: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  border-radius: 50%;
}

.user-name {
  font-weight: 600;
  color: var(--ops-ink);
  margin-bottom: 2px;
}

.user-username {
  font-size: 12px;
  color: var(--ops-muted);
}

.contact-info {
  font-size: 13px;
  color: var(--ops-muted);
  line-height: 1.4;
}

.action-buttons {
  display: flex;
  gap: 4px;
}

.avatar-upload {
  display: flex;
  align-items: flex-start;
  gap: 16px;
}

.avatar-preview {
  width: 80px;
  height: 80px;
  border-radius: 50%;
  border: 2px solid var(--ops-border);
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--ops-ground);
  overflow: hidden;
  flex-shrink: 0;
  position: relative;
}

.avatar-preview img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.avatar-preview:hover {
  border-color: #1890ff;
  transition: border-color 0.2s ease;
}

.avatar-upload-loading {
  position: relative;
}

.upload-loading {
  position: absolute;
  inset: 0;
  background: rgb(255 255 255 / 80%);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.loading-icon {
  animation: rotate 1s linear infinite;
  font-size: 24px;
  color: #1890ff;
}

.avatar-upload-actions {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.avatar-upload-actions .ant-btn {
  display: flex;
  align-items: center;
  gap: 6px;
}

.user-detail {
  padding: 8px 0;
}

.detail-section {
  margin-bottom: 24px;
}

.detail-section h3 {
  margin: 0 0 16px;
  font-size: 16px;
  font-weight: 600;
  color: var(--ops-ink);
  padding-bottom: 8px;
  border-bottom: 1px solid var(--ops-border);
}

.detail-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 16px;
}

.detail-item {
  padding: 12px;
  background: var(--ops-ground);
  border-radius: 6px;
  border: 1px solid var(--ops-border);
}

.detail-item label {
  display: block;
  font-size: 12px;
  color: var(--ops-muted);
  font-weight: 600;
  margin-bottom: 4px;
}

.detail-item span {
  font-size: 14px;
  color: var(--ops-ink);
}

.avatar-detail {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
}

.detail-avatar {
  width: 60px;
  height: 60px;
  border-radius: 50%;
  border: 2px solid var(--ops-border);
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--ops-ground);
  margin-top: 8px;
}

.detail-avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.detail-avatar .default-avatar {
  font-size: 24px;
}

.roles-list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.role-header {
  margin-bottom: 20px;
  padding-bottom: 12px;
  border-bottom: 1px solid var(--ops-border);
}

.role-header h4 {
  margin: 0;
  font-size: 16px;
  color: var(--ops-ink);
  font-weight: 600;
}

.role-list {
  max-height: 400px;
  overflow-y: auto;
}

.empty-state {
  text-align: center;
  color: var(--ops-muted);
  padding: 40px 0;
  background: var(--ops-ground);
  border: 1px dashed var(--ops-border);
  border-radius: 6px;
}

.role-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px;
  background: var(--ops-ground);
  border: 1px solid var(--ops-border);
  border-radius: 6px;
  margin-bottom: 8px;
}

.role-item:hover {
  background: var(--ops-border);
}

.role-info {
  flex: 1;
}

.role-name {
  font-weight: 600;
  color: var(--ops-ink);
  margin-bottom: 4px;
}

.role-desc {
  font-size: 12px;
  color: var(--ops-muted);
}

.table-container :deep(.ant-btn-text) {
  color: #1890ff;
}

.table-container :deep(.ant-btn-text:hover) {
  color: #40a9ff;
  background: #f0f9ff;
}

.table-container :deep(.ant-btn-text.ant-btn-dangerous) {
  color: #ff4d4f;
}

.table-container :deep(.ant-btn-text.ant-btn-dangerous:hover) {
  color: #ff7875;
  background: #fff2f0;
}

.role-list::-webkit-scrollbar {
  width: 6px;
}

.role-list::-webkit-scrollbar-track {
  background: var(--ops-border);
  border-radius: 3px;
}

.role-list::-webkit-scrollbar-thumb {
  background: var(--ops-border);
  border-radius: 3px;
}

.role-list::-webkit-scrollbar-thumb:hover {
  background: #bfbfbf;
}

/* 原有样式保持不变 */
</style>
