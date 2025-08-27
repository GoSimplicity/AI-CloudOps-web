<template>
  <div class="send-group-container">
    <!-- 页面标题 -->
    <div class="page-header">
      <div class="header-actions">
        <a-button type="primary" @click="handleCreateSendGroup" class="btn-create">
          <template #icon>
            <PlusOutlined />
          </template>
          <span class="btn-text">创建发送组</span>
        </a-button>
        <div class="search-filters">
          <a-input-search 
            v-model:value="searchQuery" 
            placeholder="搜索发送组名称..." 
            class="search-input"
            @search="handleSearch" 
            @change="handleSearchChange" 
            allow-clear 
          />
            <a-select 
            v-model:value="enableFilter" 
            placeholder="启用状态" 
            class="filter-select" 
            @change="handleEnableChange"
            allow-clear
          >
            <a-select-option :value="undefined">全部</a-select-option>
            <a-select-option :value="1">启用</a-select-option>
            <a-select-option :value="2">禁用</a-select-option>
          </a-select>
            <a-select 
            v-model:value="upgradeFilter" 
            placeholder="升级配置" 
            class="filter-select" 
            @change="handleUpgradeChange"
            allow-clear
          >
            <a-select-option :value="undefined">全部</a-select-option>
            <a-select-option :value="1">需要升级</a-select-option>
            <a-select-option :value="2">无需升级</a-select-option>
          </a-select>
          <a-button @click="handleResetFilters" class="reset-btn">
            重置
          </a-button>
        </div>
      </div>
    </div>

    <!-- 统计卡片 -->
    <div class="stats-row">
      <a-row :gutter="[16, 16]">
        <a-col :xs="12" :sm="6" :md="6" :lg="6">
          <a-card class="stats-card">
            <a-statistic 
              title="总发送组" 
              :value="stats.total" 
              :value-style="{ color: '#3f8600' }"
            >
              <template #prefix>
                <Icon icon="carbon:send" />
              </template>
            </a-statistic>
          </a-card>
        </a-col>
        <a-col :xs="12" :sm="6" :md="6" :lg="6">
          <a-card class="stats-card">
            <a-statistic 
              title="启用中" 
              :value="stats.enabled" 
              :value-style="{ color: '#52c41a' }"
            >
              <template #prefix>
                <Icon icon="carbon:checkmark" />
              </template>
            </a-statistic>
          </a-card>
        </a-col>
        <a-col :xs="12" :sm="6" :md="6" :lg="6">
          <a-card class="stats-card">
            <a-statistic 
              title="配置升级" 
              :value="stats.needUpgrade" 
              :value-style="{ color: '#faad14' }"
            >
              <template #prefix>
                <Icon icon="carbon:upgrade" />
              </template>
            </a-statistic>
          </a-card>
        </a-col>
        <a-col :xs="12" :sm="6" :md="6" :lg="6">
          <a-card class="stats-card">
            <a-statistic 
              title="关联池数" 
              :value="stats.associatedPools" 
              :value-style="{ color: '#cf1322' }"
            >
              <template #prefix>
                <Icon icon="carbon:link" />
              </template>
            </a-statistic>
          </a-card>
        </a-col>
      </a-row>
    </div>

    <!-- 表格容器 -->
    <div class="table-container">
      <a-card>
        <a-table 
          :data-source="sendGroupList" 
          :columns="columns" 
          :pagination="paginationConfig" 
          :loading="loading"
          row-key="id" 
          bordered 
          :scroll="{ x: 1400 }" 
          @change="handleTableChange"
        >
          <template #bodyCell="{ column, record }">
            <template v-if="column.key === 'name'">
              <div class="pool-name-cell">
                <div class="pool-badge" :class="getPoolStatusClass(record)"></div>
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
                <span v-if="!getPoolName(record.pool_id) && !getOnDutyGroupName(record.on_duty_group_id)" class="empty-text">无关联</span>
              </div>
            </template>

            <template v-if="column.key === 'static_receive_users'">
              <div class="tag-container">
                <a-tag 
                  v-for="(user, index) in record.static_receive_users" 
                  :key="user?.id || index" 
                  class="tech-tag label-tag"
                >
                  {{ user?.username || user?.name || (typeof user === 'string' ? user : '未命名用户') }}
                </a-tag>
                <span v-if="!record.static_receive_users?.length && !record.static_receive_user_names?.length" class="empty-text">无用户</span>
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
                <span v-if="!getNotifyMethods(record)?.length" class="empty-text">无通知方式</span>
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
                  <span class="config-value">{{ record.repeat_interval || '30s' }}</span>
                </div>
                <div class="config-item">
                  <span class="config-label">发送恢复:</span>
                  <span class="config-value">{{ record.send_resolved === 1 ? '是' : '否' }}</span>
                </div>
              </div>
            </template>

            <template v-if="column.key === 'upgrade_config'">
              <div class="config-info">
                <div class="config-item">
                  <span class="config-label">需要升级:</span>
                  <span class="config-value">{{ record.need_upgrade === 1 ? '是' : '否' }}</span>
                </div>
                <div class="config-item" v-if="record.need_upgrade === 1">
                  <span class="config-label">升级时间:</span>
                  <span class="config-value">{{ record.upgrade_minutes }}分钟</span>
                </div>
              </div>
            </template>

            <template v-if="column.key === 'creator'">
              <div class="creator-info">
                <a-avatar 
                  size="small" 
                  :style="{ backgroundColor: getAvatarColor(record.create_user_name || '') }"
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
                <a-button type="primary" size="small" @click="handleViewSendGroup(record)">
                  查看
                </a-button>
                <a-button type="default" size="small" @click="handleEditSendGroup(record)">
                  编辑
                </a-button>
                <a-dropdown>
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
      :open="formDialogVisible" 
      :title="formDialog.isEdit ? '编辑发送组' : '创建发送组'" 
      :width="formDialogWidth"
      @ok="saveSendGroup" 
      @cancel="closeFormDialog" 
      :destroy-on-close="true" 
      class="responsive-modal send-group-modal"
    >
      <a-form 
        ref="formRef" 
        :model="formDialog.form" 
        :rules="formRules" 
        layout="vertical"
      >
        <div class="form-section">
          <div class="section-title">基本信息</div>
          <a-row :gutter="16">
            <a-col :xs="24" :sm="12">
              <a-form-item 
                label="发送组名称" 
                name="name" 
                :rules="[{ required: true, message: '请输入发送组名称' }]"
              >
                <a-input 
                  v-model:value="formDialog.form.name" 
                  placeholder="请输入发送组名称" 
                />
              </a-form-item>
            </a-col>
            <a-col :xs="24" :sm="12">
              <a-form-item 
                label="发送组中文名称" 
                name="name_zh" 
                :rules="[{ required: true, message: '请输入发送组中文名称' }]"
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
            <a-col :xs="24" :sm="12">
              <a-form-item label="关联采集池" name="pool_id">
                <a-select 
                  v-model:value="formDialog.form.pool_id" 
                  placeholder="请搜索并选择采集池" 
                  class="full-width" 
                  show-search
                  :filter-option="false"
                  @search="handleDialogPoolSearch"
                  @popupScroll="handleDialogPoolScroll"
                  :loading="dialogPoolLoading"
                  allow-clear
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
            <a-col :xs="24" :sm="12">
              <a-form-item label="关联值班组" name="on_duty_group_id">
                <a-select 
                  v-model:value="formDialog.form.on_duty_group_id" 
                  placeholder="请搜索并选择值班组" 
                  class="full-width"
                  show-search
                  :filter-option="false"
                  @search="handleDialogOnDutyGroupSearch"
                  @popupScroll="handleDialogOnDutyGroupScroll"
                  :loading="dialogOnDutyGroupLoading"
                  allow-clear
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
            <a-col :xs="24" :sm="12">
              <a-form-item label="是否启用" name="enable">
                <a-switch v-model:checked="formDialog.form.enable" class="tech-switch" />
              </a-form-item>
            </a-col>
            <a-col :xs="24" :sm="12">
              <a-form-item label="发送恢复消息" name="send_resolved">
                <a-switch v-model:checked="formDialog.form.send_resolved" class="tech-switch" />
              </a-form-item>
            </a-col>
          </a-row>
          <a-row :gutter="16">
            <a-col :xs="24" :sm="12">
              <a-form-item label="重复发送间隔" name="repeat_interval">
                <a-input 
                  v-model:value="formDialog.form.repeat_interval" 
                  placeholder="例如：30s, 5m, 1h" 
                />
              </a-form-item>
            </a-col>
            <a-col :xs="24" :sm="12">
              <a-form-item label="需要升级" name="need_upgrade">
                <a-switch v-model:checked="formDialog.form.need_upgrade" class="tech-switch" />
              </a-form-item>
            </a-col>
          </a-row>
          <a-row :gutter="16">
            <a-col :span="24">
              <a-form-item label="飞书群机器人Token" name="fei_shu_qun_robot_token">
                <a-input 
                  v-model:value="formDialog.form.fei_shu_qun_robot_token" 
                  placeholder="请输入飞书群机器人Token" 
                />
              </a-form-item>
            </a-col>
          </a-row>
        </div>

        <div class="form-section" v-if="formDialog.form.need_upgrade">
          <div class="section-title">升级配置</div>
          <a-row :gutter="16">
            <a-col :xs="24" :sm="12">
              <a-form-item label="升级时间间隔(分钟)" name="upgrade_minutes">
                <a-input-number 
                  v-model:value="formDialog.form.upgrade_minutes" 
                  :min="1" 
                  placeholder="请输入升级时间间隔"
                  class="full-width" 
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
              mode="multiple" 
              placeholder="请搜索并选择静态接收用户"
              class="full-width" 
              show-search
              :filter-option="false"
              @search="handleDialogUserSearch"
              @popupScroll="handleDialogUserScroll"
              :loading="dialogUserLoading"
              :options="dialogUsers" 
            />
          </a-form-item>

          <!-- 通知方式 -->
          <a-form-item label="通知方式" name="notify_methods">
            <a-select 
              v-model:value="formDialog.form.notify_methods" 
              mode="multiple" 
              placeholder="请选择通知方式"
              class="full-width"
            >
              <a-select-option value="email">邮件</a-select-option>
              <a-select-option value="sms">短信</a-select-option>
              <a-select-option value="feishu">飞书</a-select-option>
              <a-select-option value="webhook">Webhook</a-select-option>
            </a-select>
          </a-form-item>

          <!-- 首次升级用户 -->
          <a-form-item v-if="formDialog.form.need_upgrade" label="首次升级用户" name="first_upgrade_users">
            <a-select 
              v-model:value="formDialog.form.first_upgrade_users" 
              mode="multiple" 
              placeholder="请搜索并选择首次升级用户"
              class="full-width" 
              show-search
              :filter-option="false"
              @search="handleDialogUserSearch"
              @popupScroll="handleDialogUserScroll"
              :loading="dialogUserLoading"
              :options="dialogUsers" 
            />
          </a-form-item>

          <!-- 二次升级用户 -->
          <a-form-item v-if="formDialog.form.need_upgrade" label="二次升级用户" name="second_upgrade_users">
            <a-select 
              v-model:value="formDialog.form.second_upgrade_users" 
              mode="multiple" 
              placeholder="请搜索并选择二次升级用户"
              class="full-width" 
              show-search
              :filter-option="false"
              @search="handleDialogUserSearch"
              @popupScroll="handleDialogUserScroll"
              :loading="dialogUserLoading"
              :options="dialogUsers" 
            />
          </a-form-item>
        </div>
      </a-form>
    </a-modal>

    <!-- 详情对话框 -->
    <a-modal 
      :open="detailDialogVisible" 
      title="发送组详情" 
      :width="previewDialogWidth" 
      :footer="null"
      @cancel="closeDetailDialog" 
      class="detail-dialog"
    >
      <div v-if="detailDialog.form" class="pool-details">
        <div class="detail-header">
          <h2>{{ detailDialog.form.name_zh || detailDialog.form.name }}</h2>
          <div class="detail-badges">
            <a-tag :color="detailDialog.form.enable === 1 ? 'success' : 'default'">
              {{ detailDialog.form.enable === 1 ? '启用' : '禁用' }}
            </a-tag>
            <a-tag :color="detailDialog.form.need_upgrade === 1 ? 'warning' : 'default'">
              {{ detailDialog.form.need_upgrade === 1 ? '需要升级' : '无需升级' }}
            </a-tag>
            <a-tag :color="detailDialog.form.send_resolved === 1 ? 'success' : 'default'">
              {{ detailDialog.form.send_resolved === 1 ? '发送恢复' : '不发送恢复' }}
            </a-tag>
          </div>
        </div>

        <a-descriptions bordered :column="1" :labelStyle="{ width: '150px' }">
          <a-descriptions-item label="ID">{{ detailDialog.form.id }}</a-descriptions-item>
          <a-descriptions-item label="发送组名称">{{ detailDialog.form.name }}</a-descriptions-item>
          <a-descriptions-item label="中文名称">{{ detailDialog.form.name_zh }}</a-descriptions-item>
          <a-descriptions-item label="关联采集池">{{ getPoolName(detailDialog.form.pool_id) || '未关联' }}</a-descriptions-item>
          <a-descriptions-item label="关联值班组">{{ getOnDutyGroupName(detailDialog.form.on_duty_group_id) || '未关联' }}</a-descriptions-item>
          <a-descriptions-item label="重复间隔">{{ detailDialog.form.repeat_interval || '30s' }}</a-descriptions-item>
          <a-descriptions-item label="升级时间">
            {{ detailDialog.form.need_upgrade === 1 ? `${detailDialog.form.upgrade_minutes || 0}分钟` : '无需升级' }}
          </a-descriptions-item>
          <a-descriptions-item label="飞书Token">
            {{ detailDialog.form.fei_shu_qun_robot_token ? maskToken(detailDialog.form.fei_shu_qun_robot_token) : '未配置' }}
          </a-descriptions-item>
          <a-descriptions-item label="创建人">{{ detailDialog.form.create_user_name }}</a-descriptions-item>
          <a-descriptions-item label="创建时间">{{ formatFullDateTime(detailDialog.form.created_at) }}</a-descriptions-item>
        </a-descriptions>

        <div class="detail-footer">
          <a-button @click="closeDetailDialog">关闭</a-button>
          <a-button type="primary" @click="handleEditSendGroup(detailDialog.form)">编辑</a-button>
        </div>
      </div>
    </a-modal>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted, computed } from 'vue';
import { message, Modal } from 'ant-design-vue';
import {
  PlusOutlined,
  DownOutlined
} from '@ant-design/icons-vue';
import { Icon } from '@iconify/vue';
import {
  getMonitorSendGroupListApi,
  createMonitorSendGroupApi,
  updateMonitorSendGroupApi,
  deleteMonitorSendGroupApi,
  getMonitorSendGroupDetailApi,
  type MonitorSendGroup,
  type GetMonitorSendGroupListReq,
  type CreateMonitorSendGroupReq,
  type UpdateMonitorSendGroupReq
} from '#/api/core/prometheus_send_group';
import { getUserList } from '#/api/core/user';
import { getMonitorScrapePoolListApi, type MonitorScrapePool } from '#/api/core/prometheus_scrape_pool';
import { getMonitorOnDutyGroupListApi, type MonitorOnDutyGroup } from '#/api/core/prometheus_onduty';

// 修复类型定义
interface UserOption {
  label: string;
  value: number;
}

interface UserInfo {
  id: number;
  username: string;
  real_name?: string;
  name?: string;
}

// interface MenuClickEvent { key: string } // 未使用

// 采集池简化接口
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
  { title: '发送组名称', dataIndex: 'name', key: 'name', width: 200, fixed: 'left' },
  { title: '中文名称', dataIndex: 'name_zh', key: 'name_zh', width: 180 },
  { title: '关联配置', key: 'pool_config', width: 180 },
  { title: '静态接收用户', dataIndex: 'static_receive_users', key: 'static_receive_users', width: 200 },
  { title: '通知方式', dataIndex: 'notify_methods', key: 'notify_methods', width: 180 },
  { title: '启用状态', dataIndex: 'enable', key: 'enable', width: 100, align: 'center' as const },
  { title: '通知配置', key: 'notification_config', width: 160 },
  { title: '升级配置', key: 'upgrade_config', width: 120 },
  { title: '创建人', dataIndex: 'create_user_name', key: 'creator', width: 120 },
  { title: '创建时间', dataIndex: 'created_at', key: 'createdAt', width: 180 },
  { title: '操作', key: 'action', width: 200, align: 'center' as const, fixed: 'right' }
];

// 状态数据
const loading = ref(false);
const searchQuery = ref('');
const enableFilter = ref<1 | 2 | undefined>(undefined);
const upgradeFilter = ref<1 | 2 | undefined>(undefined);
const sendGroupList = ref<MonitorSendGroup[]>([]);

// 防抖处理
let searchTimeout: NodeJS.Timeout | null = null;

// 分页配置
const paginationConfig = reactive({
  current: 1,
  pageSize: 10,
  total: 0,
  showSizeChanger: true,
  showQuickJumper: true,
  showTotal: (total: number) => `共 ${total} 条记录`,
  size: 'default' as const
});

// 统计数据
const stats = reactive({
  total: 0,
  enabled: 0,
  needUpgrade: 0,
  associatedPools: 0
});

// 对话框状态
const formDialogVisible = ref(false);
const detailDialogVisible = ref(false);

// 选项数据
const scrapePools = ref<MonitorScrapePool[]>([]);
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
const dialogOnDutyGroups = ref<MonitorOnDutyGroup[]>([]);

const dialogUserLoading = ref(false);
const dialogUserSearch = ref('');
const dialogUserPage = ref(1);
const dialogUserHasMore = ref(true);
const dialogUsers = ref<UserOption[]>([]);

// 防抖变量
let poolSearchDebounce: any;
let onDutyGroupSearchDebounce: any;
let userSearchDebounce: any;

// 表单对话框数据 - 修复类型
const formDialog = reactive({
  isEdit: false,
  form: {
    id: undefined as number | undefined,
    name: '',
    name_zh: '',
    enable: false,
    pool_id: null as number | null,
    on_duty_group_id: null as number | null,
    repeat_interval: '30s',
    send_resolved: false,
    need_upgrade: false,
    upgrade_minutes: 0,
    fei_shu_qun_robot_token: '',
    static_receive_users: [] as number[],
    notify_methods: [] as string[],
    first_upgrade_users: [] as number[],
    second_upgrade_users: [] as number[]
  }
});

// 详情对话框数据
const detailDialog = reactive({
  form: null as MonitorSendGroup | null
});

// 表单验证规则
const formRules = {
  name: [
    { required: true, message: '请输入发送组名称', trigger: 'blur' },
    { min: 2, max: 50, message: '长度应为2到50个字符', trigger: 'blur' }
  ],
  name_zh: [
    { required: true, message: '请输入发送组中文名称', trigger: 'blur' },
    { min: 2, max: 50, message: '长度应为2到50个字符', trigger: 'blur' }
  ]
};


const getPoolStatusClass = (record: MonitorSendGroup): string => {
  if (record.enable === 1 && record.need_upgrade === 1) return 'status-full';
  if (record.enable === 1 || record.need_upgrade === 1) return 'status-partial';
  return 'status-none';
};

const getAvatarColor = (name: string): string => {
  const colors = ['#1890ff', '#52c41a', '#faad14', '#f5222d', '#722ed1', '#13c2c2', '#eb2f96', '#fa8c16'];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length] || '#1890ff';
};

const getInitials = (name: string): string => {
  if (!name) return '';
  return name.slice(0, 2).toUpperCase();
};

const maskToken = (token: string): string => {
  if (!token || token.length <= 8) return token;
  return token.substring(0, 4) + '****' + token.substring(token.length - 4);
};

// 通过ID获取名称
const getPoolName = (poolId?: number): string => {
  if (!poolId) return '';
  const pool = scrapePools.value.find(p => p.id === poolId);
  return pool?.name || '';
};

const getOnDutyGroupName = (groupId?: number): string => {
  if (!groupId) return '';
  const group = onDutyGroups.value.find(g => g.id === groupId);
  return group?.name || '';
};

const formatDate = (dateString: string): string => {
  if (!dateString) return '';
  return new Date(dateString).toLocaleDateString('zh-CN');
};

const formatTime = (dateString: string): string => {
  if (!dateString) return '';
  return new Date(dateString).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
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
      return record.notify_methods.map(method => {
        // 处理字符串类型的方法
        if (typeof method === 'string') {
          // 尝试解析可能是JSON字符串的方法
          if (method.startsWith('[') && method.endsWith(']')) {
            try {
              return JSON.parse(method);
            } catch (e) {
              return method;
            }
          }
          return method;
        }
        return method;
      }).flat();
    }
    
    // 如果是字符串，尝试解析为JSON
    if (typeof record.notify_methods === 'string') {
      try {
        const parsed = JSON.parse(record.notify_methods);
        return Array.isArray(parsed) ? parsed : [record.notify_methods];
      } catch (e) {
        return [record.notify_methods];
      }
    }
    
    return [];
  } catch (error) {
    console.error('Error parsing notify_methods:', error);
    return [];
  }
};

// 更新统计数据
const updateStats = () => {
  stats.total = paginationConfig.total;
  stats.enabled = sendGroupList.value.filter(item => item.enable === 1).length;
  stats.needUpgrade = sendGroupList.value.filter(item => item.need_upgrade === 1).length;
  stats.associatedPools = new Set(sendGroupList.value.map(item => item.pool_id).filter(Boolean)).size;
};

// 数据加载
const loadSendGroupList = async (): Promise<void> => {
  loading.value = true;
  try {
    const params: GetMonitorSendGroupListReq = {
      page: paginationConfig.current,
      size: paginationConfig.pageSize,
      search: searchQuery.value || undefined,
      enable: enableFilter.value
    };

    const response = await getMonitorSendGroupListApi(params) as ApiListResponse<MonitorSendGroup>;
    if (response) {
      let list = response.items || [];
      
      // 过滤升级配置
      if (upgradeFilter.value !== undefined) {
        list = list.filter((item: MonitorSendGroup) => item.need_upgrade === upgradeFilter.value);
      }

      // 规范数据结构
      list = list.map((item: MonitorSendGroup) => {
        // 确保static_receive_users是数组
        if (!Array.isArray(item.static_receive_users)) {
          item.static_receive_users = [] as any;
        }

        // 确保notify_methods是数组
        if (!Array.isArray(item.notify_methods)) {
          item.notify_methods = [] as any;
        } else {
          // 处理可能的字符串数组
          item.notify_methods = item.notify_methods
            .map((method: any) => {
              if (typeof method === 'string') {
                try {
                  if (method.startsWith('[') && method.endsWith(']')) {
                    return JSON.parse(method);
                  }
                } catch (e) {
                  // ignore
                }
              }
              return method;
            })
            .flat();
        }

        return item;
      });

      sendGroupList.value = list;
      paginationConfig.total = response.total || 0;
      updateStats();
    }
  } catch (error: any) {
    console.error('加载发送组列表失败:', error);
    message.error(error.message || '加载发送组列表失败');
  } finally {
    loading.value = false;
  }
};

// 加载选项数据
const loadOptionsData = async (): Promise<void> => {
  try {
    const pageSize = 50;

    // 加载采集池
    let allScrapePools: MonitorScrapePool[] = [];
    let currentPage = 1;
    let hasMoreData = true;

    while (hasMoreData) {
      const scrapePoolResponse = await getMonitorScrapePoolListApi({
        page: currentPage,
        size: pageSize
      }) as ApiListResponse<MonitorScrapePool>;
      
      if (scrapePoolResponse && scrapePoolResponse.items && scrapePoolResponse.items.length > 0) {
        allScrapePools = [...allScrapePools, ...scrapePoolResponse.items];
        
        if (scrapePoolResponse.items.length < pageSize || allScrapePools.length >= (scrapePoolResponse.total || 0)) {
          hasMoreData = false;
        } else {
          currentPage++;
        }
      } else {
        hasMoreData = false;
      }
    }
    scrapePools.value = allScrapePools;

    // 加载值班组 - 实现真分页
    let allOnDutyGroups: MonitorOnDutyGroup[] = [];
    currentPage = 1;
    hasMoreData = true;

    while (hasMoreData) {
      const onDutyGroupResponse = await getMonitorOnDutyGroupListApi({
        page: currentPage,
        size: pageSize
      }) as ApiListResponse<MonitorOnDutyGroup>;
      
      if (onDutyGroupResponse && onDutyGroupResponse.items && onDutyGroupResponse.items.length > 0) {
        allOnDutyGroups = [...allOnDutyGroups, ...onDutyGroupResponse.items];
        
        if (onDutyGroupResponse.items.length < pageSize || allOnDutyGroups.length >= (onDutyGroupResponse.total || 0)) {
          hasMoreData = false;
        } else {
          currentPage++;
        }
      } else {
        hasMoreData = false;
      }
    }
    onDutyGroups.value = allOnDutyGroups;

    // 加载用户列表 - 实现真分页
    let allUsers: UserInfo[] = [];
    currentPage = 1;
    hasMoreData = true;

    while (hasMoreData) {
      const userResponse = await getUserList({
        page: currentPage,
        size: pageSize,
        search: ''
      }) as ApiListResponse<UserInfo>;
      
      if (userResponse && userResponse.items && userResponse.items.length > 0) {
        allUsers = [...allUsers, ...userResponse.items];
        
        if (userResponse.items.length < pageSize || allUsers.length >= (userResponse.total || 0)) {
          hasMoreData = false;
        } else {
          currentPage++;
        }
      } else {
        hasMoreData = false;
      }
    }

    userOptions.value = allUsers.map((user: UserInfo) => ({
      label: user.username,
      value: user.id
    }));
  } catch (error: any) {
    console.error('加载选项数据失败:', error);
    message.error('加载选项数据失败');
  }
};

// 动态加载采集池数据
const loadDialogPools = async (isNewSearch = false) => {
  if (dialogPoolLoading.value) return;

  if (isNewSearch) {
    dialogPoolPage.value = 1;
    dialogPoolHasMore.value = true;
    dialogPools.value = [];
  }

  if (!dialogPoolHasMore.value) return;

  dialogPoolLoading.value = true;
  try {
    const response = await getMonitorScrapePoolListApi({
      page: dialogPoolPage.value,
      size: 20,
      search: dialogPoolSearch.value,
    }) as ApiListResponse<MonitorScrapePool>;

    if (response && response.items && response.items.length > 0) {
      const newPools = response.items.map((p: MonitorScrapePool) => ({ id: p.id!, name: p.name }));
      dialogPools.value.push(...newPools);
      dialogPoolPage.value++;
      if (dialogPools.value.length >= (response.total || 0)) {
        dialogPoolHasMore.value = false;
      }
    } else {
      dialogPoolHasMore.value = false;
    }
  } catch (error: any) {
    message.error(error.message || '获取采集池数据失败');
  } finally {
    dialogPoolLoading.value = false;
  }
};

// 动态加载值班组数据
const loadDialogOnDutyGroups = async (isNewSearch = false) => {
  if (dialogOnDutyGroupLoading.value) return;

  if (isNewSearch) {
    dialogOnDutyGroupPage.value = 1;
    dialogOnDutyGroupHasMore.value = true;
    dialogOnDutyGroups.value = [];
  }

  if (!dialogOnDutyGroupHasMore.value) return;

  dialogOnDutyGroupLoading.value = true;
  try {
    const response = await getMonitorOnDutyGroupListApi({
      page: dialogOnDutyGroupPage.value,
      size: 20,
      search: dialogOnDutyGroupSearch.value,
    }) as ApiListResponse<MonitorOnDutyGroup>;

    if (response && response.items && response.items.length > 0) {
      dialogOnDutyGroups.value.push(...response.items);
      dialogOnDutyGroupPage.value++;
      if (dialogOnDutyGroups.value.length >= (response.total || 0)) {
        dialogOnDutyGroupHasMore.value = false;
      }
    } else {
      dialogOnDutyGroupHasMore.value = false;
    }
  } catch (error: any) {
    message.error(error.message || '获取值班组数据失败');
  } finally {
    dialogOnDutyGroupLoading.value = false;
  }
};

// 动态加载用户数据
const loadDialogUsers = async (isNewSearch = false) => {
  if (dialogUserLoading.value) return;

  if (isNewSearch) {
    dialogUserPage.value = 1;
    dialogUserHasMore.value = true;
    dialogUsers.value = [];
  }

  if (!dialogUserHasMore.value) return;

  dialogUserLoading.value = true;
  try {
    const response = await getUserList({
      page: dialogUserPage.value,
      size: 20,
      search: dialogUserSearch.value,
    }) as ApiListResponse<UserInfo>;

    if (response && response.items && response.items.length > 0) {
      const newUsers = response.items.map((user: UserInfo) => {
        // 优先使用username，如果没有则使用real_name或name
        const displayName = user.username || user.real_name || user.name || `用户ID: ${user.id}`;
        return {
          label: displayName,
          value: user.id
        };
      });
      dialogUsers.value.push(...newUsers);
      dialogUserPage.value++;
      if (dialogUsers.value.length >= (response.total || 0)) {
        dialogUserHasMore.value = false;
      }
    } else {
      dialogUserHasMore.value = false;
    }
  } catch (error: any) {
    message.error(error.message || '获取用户数据失败');
  } finally {
    dialogUserLoading.value = false;
  }
};

// 搜索处理函数
const handleDialogPoolSearch = (value: string) => {
  clearTimeout(poolSearchDebounce);
  poolSearchDebounce = setTimeout(() => {
    dialogPoolSearch.value = value;
    loadDialogPools(true);
  }, 300);
};

const handleDialogOnDutyGroupSearch = (value: string) => {
  clearTimeout(onDutyGroupSearchDebounce);
  onDutyGroupSearchDebounce = setTimeout(() => {
    dialogOnDutyGroupSearch.value = value;
    loadDialogOnDutyGroups(true);
  }, 300);
};

const handleDialogUserSearch = (value: string) => {
  clearTimeout(userSearchDebounce);
  userSearchDebounce = setTimeout(() => {
    dialogUserSearch.value = value;
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
  message.success('过滤条件已重置');
};

const handleCreateSendGroup = (): void => {
  formDialog.isEdit = false;
  resetFormDialog();
  
  // 重置并加载动态数据
  dialogPoolSearch.value = '';
  dialogOnDutyGroupSearch.value = '';
  dialogUserSearch.value = '';
  
  loadDialogPools(true);
  loadDialogOnDutyGroups(true);
  loadDialogUsers(true);
  
  formDialogVisible.value = true;
};

const handleEditSendGroup = (record: MonitorSendGroup): void => {
  formDialog.isEdit = true;
  formDialog.form = {
    id: record.id,
    name: record.name,
    name_zh: record.name_zh,
    enable: record.enable === 1,
    pool_id: record.pool_id,
    on_duty_group_id: record.on_duty_group_id,
    repeat_interval: record.repeat_interval || '30s',
    send_resolved: record.send_resolved === 1,
    need_upgrade: record.need_upgrade === 1,
    upgrade_minutes: record.upgrade_minutes || 0,
    fei_shu_qun_robot_token: record.fei_shu_qun_robot_token || '',
    static_receive_users: (record.static_receive_users || []).map((user: any) => user.id) || [],
    notify_methods: getNotifyMethods(record),
    first_upgrade_users: (record.first_upgrade_users || []).map((user: any) => user.id) || [],
    second_upgrade_users: (record.second_upgrade_users || []).map((user: any) => user.id) || []
  };
  
  // 重置并加载动态数据
  dialogPoolSearch.value = '';
  dialogOnDutyGroupSearch.value = '';
  dialogUserSearch.value = '';
  
  // 加载动态数据
  loadDialogPools(true).then(() => {
    // 确保当前选中的采集池在列表中
    const selectedPoolInList = dialogPools.value.some(p => p.id === record.pool_id);
    if (!selectedPoolInList && record.pool_id) {
      const pool = scrapePools.value.find(p => p.id === record.pool_id);
      if (pool) {
        dialogPools.value.unshift({ id: pool.id!, name: pool.name });
      }
    }
  });
  
  loadDialogOnDutyGroups(true).then(() => {
    // 确保当前选中的值班组在列表中
    const selectedGroupInList = dialogOnDutyGroups.value.some(g => g.id === record.on_duty_group_id);
    if (!selectedGroupInList && record.on_duty_group_id) {
      const group = onDutyGroups.value.find(g => g.id === record.on_duty_group_id);
      if (group) {
        dialogOnDutyGroups.value.unshift(group);
      }
    }
  });
  
  loadDialogUsers(true).then(() => {
    // 确保当前选中的用户在列表中
    const selectedUserIds = [
      ...(record.static_receive_users?.map((u: any) => u.id) || []),
      ...(record.first_upgrade_users?.map((u: any) => u.id) || []),
      ...(record.second_upgrade_users?.map((u: any) => u.id) || [])
    ];
    
    // 将已选用户添加到列表
    selectedUserIds.forEach(userId => {
      const userInList = dialogUsers.value.some(u => u.value === userId);
      if (!userInList) {
        // 尝试从已有用户中获取用户信息
        const user = userOptions.value.find(u => u.value === userId);
        if (user) {
          dialogUsers.value.unshift(user);
        } else {
          // 如果在现有选项中找不到用户，则从记录中获取用户名
          let username = '';
          
          // 尝试从static_receive_users中查找
          const staticUser = record.static_receive_users?.find((u: any) => u.id === userId);
          if (staticUser?.username) {
            username = staticUser.username;
          }
          
          // 尝试从first_upgrade_users中查找
          if (!username) {
            const firstUpgradeUser = record.first_upgrade_users?.find((u: any) => u.id === userId);
            if (firstUpgradeUser?.username) {
              username = firstUpgradeUser.username;
            }
          }
          
          // 尝试从second_upgrade_users中查找
          if (!username) {
            const secondUpgradeUser = record.second_upgrade_users?.find(u => u.id === userId);
            if (secondUpgradeUser?.username) {
              username = secondUpgradeUser.username;
            }
          }
          
          // 如果找到了用户名，添加到选项列表中
          if (username) {
            dialogUsers.value.unshift({
              label: username,
              value: userId
            });
          } else {
            // 如果没有找到用户名，则添加一个带有ID的占位符
            dialogUsers.value.unshift({
              label: `用户ID: ${userId}`,
              value: userId
            });
          }
        }
      }
    });
  });
  
  formDialogVisible.value = true;
  detailDialogVisible.value = false;
};

const handleViewSendGroup = async (record: MonitorSendGroup): Promise<void> => {
  try {
    const response = await getMonitorSendGroupDetailApi(record.id) as MonitorSendGroup;
    detailDialog.form = response;
    detailDialogVisible.value = true;
  } catch (error: any) {
    console.error('获取发送组详情失败:', error);
    message.error(error.message || '获取发送组详情失败');
  }
};

const handleDeleteClick = (record: MonitorSendGroup): void => {
  Modal.confirm({
    title: '警告',
    content: `确定要删除发送组 "${record.name_zh || record.name}" 吗？`,
    okText: '删除',
    okType: 'danger',
    cancelText: '取消',
    onOk: async () => {
      try {
        await deleteMonitorSendGroupApi(record.id);
        message.success(`发送组 "${record.name_zh || record.name}" 已删除`);
        await loadSendGroupList();
      } catch (error: any) {
        console.error('删除发送组失败:', error);
        message.error(error.message || '删除发送组失败');
      }
    },
  });
};

// 表单保存
const saveSendGroup = async (): Promise<void> => {
  if (!formDialog.form.name.trim()) {
    message.error('发送组名称不能为空');
    return;
  }

  if (!formDialog.form.name_zh.trim()) {
    message.error('发送组中文名称不能为空');
    return;
  }

  try {
    const formData = {
      ...formDialog.form,
      user_id: 1, // 这里应该从用户上下文获取
      enable: formDialog.form.enable ? 1 : 2,
      send_resolved: formDialog.form.send_resolved ? 1 : 2,
      need_upgrade: formDialog.form.need_upgrade ? 1 : 2,
      // 修复：确保pool_id和on_duty_group_id不为null时才传递
      pool_id: formDialog.form.pool_id || 0,
      on_duty_group_id: formDialog.form.on_duty_group_id || 0
    };

    // 获取用户名映射，用于填充username字段
    const userIdToUsername = new Map<number, string>();
    dialogUsers.value.forEach(user => {
      userIdToUsername.set(user.value, user.label);
    });

    if (formDialog.isEdit && formDialog.form.id) {
      // 准备用户数据，确保每个用户对象都有id和username
      const staticReceiveUsers = formData.static_receive_users.map((id: number) => ({
        id,
        username: userIdToUsername.get(id) || ''
      }));
      
      const firstUpgradeUsers = formData.first_upgrade_users.map((id: number) => ({
        id,
        username: userIdToUsername.get(id) || ''
      }));
      
      const secondUpgradeUsers = formData.second_upgrade_users.map((id: number) => ({
        id,
        username: userIdToUsername.get(id) || ''
      }));

      const updateData: UpdateMonitorSendGroupReq = {
        id: formDialog.form.id,
        name: formData.name,
        name_zh: formData.name_zh,
        enable: formData.enable as 1 | 2,
        pool_id: formData.pool_id,
        on_duty_group_id: formData.on_duty_group_id,
        static_receive_users: staticReceiveUsers,
        fei_shu_qun_robot_token: formData.fei_shu_qun_robot_token,
        repeat_interval: formData.repeat_interval,
        send_resolved: formData.send_resolved as 1 | 2,
        notify_methods: formData.notify_methods,
        need_upgrade: formData.need_upgrade as 1 | 2,
        first_upgrade_users: firstUpgradeUsers,
        upgrade_minutes: formData.upgrade_minutes,
        second_upgrade_users: secondUpgradeUsers,
      };
      await updateMonitorSendGroupApi(updateData);
      message.success(`发送组 "${formDialog.form.name_zh}" 已更新`);
    } else {
      // 准备用户数据，确保每个用户对象都有id和username
      const staticReceiveUsers = formData.static_receive_users.map((id: number) => ({
        id,
        username: userIdToUsername.get(id) || ''
      }));
      
      const firstUpgradeUsers = formData.first_upgrade_users.map((id: number) => ({
        id,
        username: userIdToUsername.get(id) || ''
      }));
      
      const secondUpgradeUsers = formData.second_upgrade_users.map((id: number) => ({
        id,
        username: userIdToUsername.get(id) || ''
      }));

      const createData: CreateMonitorSendGroupReq = {
        name: formData.name,
        name_zh: formData.name_zh,
        enable: formData.enable as 1 | 2,
        pool_id: formData.pool_id,
        on_duty_group_id: formData.on_duty_group_id,
        static_receive_users: staticReceiveUsers,
        fei_shu_qun_robot_token: formData.fei_shu_qun_robot_token,
        repeat_interval: formData.repeat_interval,
        send_resolved: formData.send_resolved as 1 | 2,
        notify_methods: formData.notify_methods,
        need_upgrade: formData.need_upgrade as 1 | 2,
        first_upgrade_users: firstUpgradeUsers,
        upgrade_minutes: formData.upgrade_minutes,
        second_upgrade_users: secondUpgradeUsers,
      };
      await createMonitorSendGroupApi(createData);
      message.success(`发送组 "${formDialog.form.name_zh}" 已创建`);
    }

    formDialogVisible.value = false;
    loadSendGroupList();
  } catch (error: any) {
    console.error('保存发送组失败:', error);
    message.error(error.message || '保存发送组失败');
  }
};

// 重置表单对话框
const resetFormDialog = (): void => {
  formDialog.form = {
    id: undefined,
    name: '',
    name_zh: '',
    enable: false,
    pool_id: null,
    on_duty_group_id: null,
    repeat_interval: '30s',
    send_resolved: false,
    need_upgrade: false,
    upgrade_minutes: 0,
    fei_shu_qun_robot_token: '',
    static_receive_users: [],
    notify_methods: [],
    first_upgrade_users: [],
    second_upgrade_users: []
  };
};

// 对话框关闭
const closeFormDialog = (): void => {
  formDialogVisible.value = false;
};

const closeDetailDialog = (): void => {
  detailDialogVisible.value = false;
};

// 生命周期钩子
onMounted(() => {
  loadOptionsData();
  loadSendGroupList();
});
</script>

<style scoped>
.send-group-container {
  padding: 12px;
  min-height: 100vh;
}

.page-header {
  margin-bottom: 20px;
}

.header-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  align-items: center;
}

.btn-create {
  background: linear-gradient(135deg, #1890ff 0%);
  border: none;
  flex-shrink: 0;
}

.search-filters {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  flex: 1;
  min-width: 0;
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
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
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
  background-color: #d9d9d9;
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
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.1);
}

.prometheus-tag {
  background-color: #e6f7ff;
  color: #0958d9;
  border-left: 3px solid #1890ff;
}

.alert-tag {
  background-color: #fff7e6;
  color: #d46b08;
  border-left: 3px solid #fa8c16;
}

.label-tag {
  background-color: #f6ffed;
  color: #389e0d;
  border-left: 3px solid #52c41a;
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
  color: #666;
}

.config-value {
  font-size: 12px;
  font-weight: 500;
  color: #333;
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
  color: #8c8c8c;
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
  color: #1a1a1a;
  margin-bottom: 16px;
  padding-left: 12px;
  border-left: 4px solid #1890ff;
}

.full-width {
  width: 100%;
}

.tech-switch {
  background-color: rgba(0, 0, 0, 0.25);
}

.tech-switch.ant-switch-checked {
  background: linear-gradient(45deg, #1890ff, #36cfc9);
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
  color: #1f2937;
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

/* 响应式设计 */
@media (max-width: 768px) {
  .send-group-container {
    padding: 8px;
  }

  .header-actions {
    flex-direction: column;
    align-items: stretch;
  }

  .search-filters {
    width: 100%;
  }

  .search-input {
    width: 100%;
    min-width: auto;
  }

  .filter-select {
    width: 100%;
    min-width: auto;
  }

  .btn-text {
    display: none;
  }

  .btn-create {
    padding: 4px 8px;
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
  .header-actions {
    gap: 8px;
  }

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

@media (max-width: 768px) {
  .responsive-modal :deep(.ant-modal-body) {
    padding: 16px;
    max-height: calc(100vh - 160px);
    overflow-y: auto;
  }
}
</style>
