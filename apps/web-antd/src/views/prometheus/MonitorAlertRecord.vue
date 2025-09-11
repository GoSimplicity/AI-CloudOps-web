<template>
  <div class="scrape-pool-container">
    <!-- 页面标题 -->
    <div class="page-header">
      <div class="header-actions">
        <a-button type="primary" @click="showAddModal" class="btn-create">
          <template #icon>
            <PlusOutlined />
          </template>
          <span class="btn-text">新增记录</span>
        </a-button>
        <div class="search-filters">
          <a-input-search 
            v-model:value="searchText" 
            placeholder="搜索记录名称..." 
            class="search-input" 
            @search="handleSearch"
            @change="handleSearchChange" 
            allow-clear 
          />
          <a-select 
            v-model:value="enabledFilter" 
            placeholder="启用状态" 
            class="filter-select"
            @change="handleEnabledFilterChange" 
            allow-clear
          >
            <a-select-option :value="undefined">全部</a-select-option>
            <a-select-option :value="1">已启用</a-select-option>
            <a-select-option :value="2">已禁用</a-select-option>
          </a-select>
          <a-button @click="handleReset" class="reset-btn">
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
              title="总记录" 
              :value="stats.total" 
              :value-style="{ color: '#3f8600' }"
            >
              <template #prefix>
                <Icon icon="carbon:data-table" />
              </template>
            </a-statistic>
          </a-card>
        </a-col>
        <a-col :xs="12" :sm="6" :md="6" :lg="6">
          <a-card class="stats-card">
            <a-statistic 
              title="已启用" 
              :value="stats.enabled" 
              :value-style="{ color: '#52c41a' }"
            >
              <template #prefix>
                <Icon icon="carbon:check-mark" />
              </template>
            </a-statistic>
          </a-card>
        </a-col>
        <a-col :xs="12" :sm="6" :md="6" :lg="6">
          <a-card class="stats-card">
            <a-statistic 
              title="已禁用" 
              :value="stats.disabled" 
              :value-style="{ color: '#faad14' }"
            >
              <template #prefix>
                <Icon icon="carbon:close-filled" />
              </template>
            </a-statistic>
          </a-card>
        </a-col>
        <a-col :xs="12" :sm="6" :md="6" :lg="6">
          <a-card class="stats-card">
            <a-statistic 
              title="实例池" 
              :value="stats.pools" 
              :value-style="{ color: '#cf1322' }"
            >
              <template #prefix>
                <Icon icon="carbon:server" />
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
          :data-source="data" 
          :columns="columns" 
          :pagination="paginationConfig" 
          :loading="loading"
          row-key="id" 
          bordered 
          :scroll="{ x: 1500 }" 
          @change="handleTableChange"
        >
          <template #bodyCell="{ column, record }">
            <template v-if="column.key === 'name'">
              <div class="pool-name-cell">
                <div class="pool-badge" :class="getRecordStatusClass(record)"></div>
                <span class="pool-name-text">{{ record.name }}</span>
              </div>
            </template>

            <template v-if="column.key === 'pool_name'">
              <div class="tag-container">
                <a-tag 
                  v-if="record.pool_name" 
                  class="tech-tag prometheus-tag"
                >
                  {{ record.pool_name }}
                </a-tag>
                <span v-else class="empty-text">无关联池</span>
              </div>
            </template>

            <template v-if="column.key === 'ip_address'">
              <span>{{ record.ip_address || '' }}</span>
            </template>

            <template v-if="column.key === 'enable'">
              <a-tag :color="record.enable === 1 ? 'success' : 'default'">
                {{ record.enable === 1 ? '启用' : '禁用' }}
              </a-tag>
            </template>

            <template v-if="column.key === 'expr'">
              <div class="expr-content">
                <span class="expr-text" :title="record.expr">{{ truncateText(record.expr, 50) }}</span>
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

            <template v-if="column.key === 'created_at'">
              <div class="date-info">
                <span class="date">{{ formatDate(record.created_at) }}</span>
                <span class="time">{{ formatTime(record.created_at) }}</span>
              </div>
            </template>

            <template v-if="column.key === 'action'">
              <div class="action-buttons">
                <a-button type="primary" size="small" @click="handleViewRecord(record)">
                  查看
                </a-button>
                <a-button type="default" size="small" @click="showEditModal(record)">
                  编辑
                </a-button>
                <a-dropdown>
                  <template #overlay>
                    <a-menu @click="(e: any) => handleMenuClick(e.key, record)">
                      <a-menu-item key="enable" v-if="record.enable === 2">启用</a-menu-item>
                      <a-menu-item key="disable" v-if="record.enable === 1">禁用</a-menu-item>
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

    <!-- 新增记录规则模态框 -->
    <a-modal 
      :open="isAddModalVisible" 
      title="新增记录规则" 
      :width="formDialogWidth"
      @ok="handleAdd" 
      @cancel="closeAddModal" 
      :confirm-loading="submitLoading" 
      :destroy-on-close="true" 
      class="responsive-modal scrape-pool-modal"
    >
      <a-form 
        ref="addFormRef" 
        :model="addForm" 
        :rules="formRules" 
        layout="vertical"
      >
        <div class="form-section">
          <div class="section-title">基本信息</div>
          <a-row :gutter="16">
            <a-col :span="24">
              <a-form-item 
                label="记录名称" 
                name="name"
              >
                <a-input 
                  v-model:value="addForm.name" 
                  placeholder="请输入记录名称" 
                />
              </a-form-item>
            </a-col>
          </a-row>

          <a-row :gutter="16">
            <a-col :span="24">
              <a-form-item 
                label="Prometheus 实例池" 
                name="pool_id"
              >
                <a-select 
                  v-model:value="addForm.pool_id" 
                  placeholder="请选择实例池" 
                  class="full-width"
                  show-search
                  :filter-option="false"
                  @search="handlePoolSearch"
                  @dropdown-visible-change="handlePoolDropdownChange"
                >
                  <a-select-option v-for="pool in poolOptions" :key="pool.id" :value="pool.id">
                    {{ pool.name }}
                  </a-select-option>
                </a-select>
                <!-- Prometheus实例池分页 -->
                <div v-if="showPoolPagination" class="pool-pagination">
                  <a-pagination
                    v-model:current="poolPagination.current"
                    v-model:page-size="poolPagination.pageSize"
                    :total="poolPagination.total"
                    size="small"
                    simple
                    @change="loadPools"
                  />
                </div>
              </a-form-item>
            </a-col>
          </a-row>

          <a-row :gutter="16">
            <a-col :span="24">
              <a-form-item 
                label="IP地址" 
                name="ip_address"
              >
                <a-input 
                  v-model:value="addForm.ip_address" 
                  placeholder="例如: 192.168.1.100:9090 或 localhost:9090" 
                />
              </a-form-item>
            </a-col>
          </a-row>
        </div>

        <div class="form-section">
          <div class="section-title">规则配置</div>
          <a-row :gutter="16">
            <a-col :xs="24" :sm="12">
              <a-form-item 
                label="是否启用" 
                name="enable"
              >
                <a-switch 
                  :checked="addForm.enable === 1"
                  @change="(checked: boolean) => addForm.enable = checked ? 1 : 2" 
                  class="tech-switch" 
                />
              </a-form-item>
            </a-col>
            
          </a-row>

          <a-row :gutter="16">
            <a-col :span="24">
              <a-form-item 
                label="表达式" 
                name="expr"
              >
                <a-textarea 
                  v-model:value="addForm.expr" 
                  placeholder="请输入表达式" 
                  :rows="3"
                />
              </a-form-item>
              <a-form-item>
                <a-button 
                  type="primary" 
                  class="validate-button" 
                  @click="validateAddExpression"
                  :loading="validatingExpr"
                >
                  <template #icon>
                    <Icon icon="mdi:check-circle-outline" />
                  </template>
                  验证表达式
                </a-button>
              </a-form-item>
            </a-col>
          </a-row>
        </div>
      </a-form>
    </a-modal>

    <!-- 编辑记录规则模态框 -->
    <a-modal 
      :open="isEditModalVisible" 
      title="编辑记录规则" 
      :width="formDialogWidth"
      @ok="handleUpdate" 
      @cancel="closeEditModal" 
      :confirm-loading="submitLoading" 
      :destroy-on-close="true" 
      class="responsive-modal scrape-pool-modal"
    >
      <a-form 
        ref="editFormRef" 
        :model="editForm" 
        :rules="formRules" 
        layout="vertical"
      >
        <div class="form-section">
          <div class="section-title">基本信息</div>
          <a-row :gutter="16">
            <a-col :span="24">
              <a-form-item 
                label="记录名称" 
                name="name"
              >
                <a-input 
                  v-model:value="editForm.name" 
                  placeholder="请输入记录名称" 
                />
              </a-form-item>
            </a-col>
          </a-row>

          <a-row :gutter="16">
            <a-col :span="24">
              <a-form-item 
                label="Prometheus 实例池" 
                name="pool_id"
              >
                <a-select 
                  v-model:value="editForm.pool_id" 
                  placeholder="请选择实例池" 
                  class="full-width"
                  show-search
                  :filter-option="false"
                  @search="handlePoolSearch"
                  @dropdown-visible-change="handlePoolDropdownChange"
                >
                  <a-select-option v-for="pool in poolOptions" :key="pool.id" :value="pool.id">
                    {{ pool.name }}
                  </a-select-option>
                </a-select>
                <!-- Prometheus实例池分页 -->
                <div v-if="showPoolPagination" class="pool-pagination">
                  <a-pagination
                    v-model:current="poolPagination.current"
                    v-model:page-size="poolPagination.pageSize"
                    :total="poolPagination.total"
                    size="small"
                    simple
                    @change="loadPools"
                  />
                </div>
              </a-form-item>
            </a-col>
          </a-row>

          <a-row :gutter="16">
            <a-col :span="24">
              <a-form-item 
                label="IP地址" 
                name="ip_address"
              >
                <a-input 
                  v-model:value="editForm.ip_address" 
                  placeholder="例如: 192.168.1.100:9090 或 localhost:9090" 
                />
              </a-form-item>
            </a-col>
          </a-row>
        </div>

        <div class="form-section">
          <div class="section-title">规则配置</div>
          <a-row :gutter="16">
            <a-col :xs="24" :sm="12">
              <a-form-item 
                label="是否启用" 
                name="enable"
              >
                <a-switch 
                  :checked="editForm.enable === 1"
                  @change="(checked: boolean) => editForm.enable = checked ? 1 : 2" 
                  class="tech-switch" 
                />
              </a-form-item>
            </a-col>
            
          </a-row>

          <a-row :gutter="16">
            <a-col :span="24">
              <a-form-item 
                label="表达式" 
                name="expr"
              >
                <a-textarea 
                  v-model:value="editForm.expr" 
                  placeholder="请输入表达式" 
                  :rows="3"
                />
              </a-form-item>
              <a-form-item>
                <a-button 
                  type="primary" 
                  class="validate-button" 
                  @click="validateEditExpression"
                  :loading="validatingExpr"
                >
                  <template #icon>
                    <Icon icon="mdi:check-circle-outline" />
                  </template>
                  验证表达式
                </a-button>
              </a-form-item>
            </a-col>
          </a-row>
        </div>
      </a-form>
    </a-modal>

    <!-- 详情对话框 -->
    <a-modal 
      :open="detailDialogVisible" 
      title="记录规则详情" 
      :width="previewDialogWidth" 
      :footer="null"
      @cancel="closeDetailDialog" 
      class="detail-dialog"
    >
      <div v-if="detailDialog.form" class="pool-details">
        <div class="detail-header">
          <h2>{{ detailDialog.form.name }}</h2>
          <div class="detail-badges">
            <a-tag :color="detailDialog.form.enable === 1 ? 'success' : 'default'">
              {{ detailDialog.form.enable === 1 ? '已启用' : '已禁用' }}
            </a-tag>
          </div>
        </div>

        <a-descriptions bordered :column="1" :labelStyle="{ width: '150px' }">
          <a-descriptions-item label="ID">{{ detailDialog.form.id }}</a-descriptions-item>
          <a-descriptions-item label="记录名称">{{ detailDialog.form.name }}</a-descriptions-item>
          <a-descriptions-item label="关联实例池">{{ detailDialog.form.pool_name || '无关联池' }}</a-descriptions-item>
          <a-descriptions-item label="IP地址">{{ detailDialog.form.ip_address || '' }}</a-descriptions-item>
          <a-descriptions-item label="是否启用">{{ detailDialog.form.enable === 1 ? '启用' : '禁用' }}</a-descriptions-item>
          <a-descriptions-item label="表达式">
            <div class="expr-detail">{{ detailDialog.form.expr }}</div>
          </a-descriptions-item>
          <a-descriptions-item label="创建人">{{ detailDialog.form.create_user_name }}</a-descriptions-item>
          <a-descriptions-item label="创建时间">{{ formatFullDateTime(detailDialog.form?.created_at || '') }}</a-descriptions-item>
        </a-descriptions>

        <div class="detail-footer">
          <a-button @click="closeDetailDialog">关闭</a-button>
          <a-button 
            v-if="detailDialog.form.enable === 2" 
            type="primary" 
            @click="handleEnableRecord(detailDialog.form)"
          >
            启用
          </a-button>
          <a-button type="primary" @click="showEditModal(detailDialog.form)">编辑</a-button>
        </div>
      </div>
    </a-modal>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted, computed } from 'vue';
import { message, Modal } from 'ant-design-vue';
import { PlusOutlined, DownOutlined } from '@ant-design/icons-vue';
import { Icon } from '@iconify/vue';
import type { FormInstance } from 'ant-design-vue';
import {
  getMonitorRecordRuleListApi,
  createMonitorRecordRuleApi,
  updateMonitorRecordRuleApi,
  deleteMonitorRecordRuleApi,
  getMonitorRecordRuleApi,
  type MonitorRecordRule,
} from '#/api/core/prometheus/prometheus_alert_record';
import { getMonitorScrapePoolListApi } from '#/api/core/prometheus/prometheus_scrape_pool';
import { promqlExprCheckApi } from '#/api/core/prometheus/prometheus_alert_rule';

// 定义 Pool 类型
interface Pool {
  id: number;
  name: string;
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
  { title: '记录名称', dataIndex: 'name', key: 'name', width: 200, fixed: 'left' },
  { title: '关联实例池', dataIndex: 'pool_name', key: 'pool_name', width: 180 },
  { title: 'IP地址', dataIndex: 'ip_address', key: 'ip_address', width: 200 },
  { title: '是否启用', dataIndex: 'enable', key: 'enable', width: 100, align: 'center' as const },
  { title: '表达式', dataIndex: 'expr', key: 'expr', width: 250 },
  { title: '创建人', dataIndex: 'create_user_name', key: 'creator', width: 120 },
  { title: '创建时间', dataIndex: 'created_at', key: 'created_at', width: 180 },
  { title: '操作', key: 'action', width: 200, align: 'center' as const, fixed: 'right' }
];

// 状态数据
const loading = ref(false);
const submitLoading = ref(false);
const validatingExpr = ref(false);
const searchText = ref('');
const enabledFilter = ref<1 | 2 | undefined>(undefined);
const data = ref<MonitorRecordRule[]>([]);
const poolOptions = ref<Pool[]>([]);
const showPoolPagination = ref(false);

// 防抖处理
let searchTimeout: any = null;
let poolSearchTimeout: any = null;

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

// Prometheus实例池分页配置
const poolPagination = reactive({
  current: 1,
  pageSize: 10,
  total: 0,
  search: ''
});

// 统计数据
const stats = reactive({
  total: 0,
  enabled: 0,
  disabled: 0,
  pools: 0
});

// 对话框状态
const isAddModalVisible = ref(false);
const isEditModalVisible = ref(false);
const detailDialogVisible = ref(false);

// 表单引用
const addFormRef = ref<FormInstance>();
const editFormRef = ref<FormInstance>();

// 新增表单
const addForm = reactive({
  name: '',
  pool_id: 0,
  ip_address: '',
  enable: 2 as 1 | 2,
  expr: '',
  labels: [],
});

// 编辑表单
const editForm = reactive({
  id: 0,
  name: '',
  pool_id: 0,
  ip_address: '',
  enable: 1 as 1 | 2,
  expr: '',
  labels: [],
});

// 详情对话框数据
const detailDialog = reactive({
  form: null as MonitorRecordRule | null
});

// 表单验证规则
const formRules = {
  name: [
    { required: true, message: '请输入记录名称', trigger: 'blur' },
    { min: 3, max: 50, message: '长度应为3到50个字符', trigger: 'blur' }
  ],
  pool_id: [
    { required: true, message: '请选择实例池', trigger: 'change' }
  ],
  ip_address: [
    { required: true, message: '请输入IP地址', trigger: 'blur' },
    { validator: (_rule: any, value: string) => {
      if (!value) {
        return Promise.reject('请输入IP地址');
      }
      // 支持 IP:PORT 格式，如 192.168.1.100:9090 或 localhost:9090
      const ipPortPattern = /^(([a-zA-Z0-9]|[a-zA-Z0-9][a-zA-Z0-9\-]*[a-zA-Z0-9])\.)*([A-Za-z0-9]|[A-Za-z0-9][A-Za-z0-9\-]*[A-Za-z0-9])(:[0-9]+)?$/;
      if (!ipPortPattern.test(value)) {
        return Promise.reject('请输入有效的IP地址，如 192.168.1.100:9090 或 localhost:9090');
      }
      // 如果包含端口，验证端口范围
      if (value.includes(':')) {
        const portStr = value.split(':')[1];
        if (portStr) {
          const port = parseInt(portStr);
          if (port < 1 || port > 65535) {
            return Promise.reject('端口必须在1-65535之间');
          }
        }
      }
      return Promise.resolve();
    }, trigger: 'blur' }
  ],
  expr: [
    { required: true, message: '请输入表达式', trigger: 'blur' }
  ],
};


const getRecordStatusClass = (record: MonitorRecordRule): string => {
  return record.enable === 1 ? 'status-full' : 'status-none';
};

const getAvatarColor = (name: string): string => {
  const colors = ['#1890ff', '#52c41a', '#faad14', '#f5222d', '#722ed1', '#13c2c2', '#eb2f96', '#fa8c16'];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length]!;
};

const getInitials = (name: string): string => {
  if (!name) return '';
  return name.slice(0, 2).toUpperCase();
};

const formatDate = (timestamp: number | string): string => {
  if (!timestamp) return '';
  return new Date(typeof timestamp === 'string' ? timestamp : timestamp * 1000).toLocaleDateString('zh-CN');
};

const formatTime = (timestamp: number | string): string => {
  if (!timestamp) return '';
  return new Date(typeof timestamp === 'string' ? timestamp : timestamp * 1000).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
};

const formatFullDateTime = (timestamp: string): string => {
  if (!timestamp) return '';
  return new Date(timestamp).toLocaleString('zh-CN');
};

const truncateText = (text: string, maxLength: number): string => {
  if (!text) return '';
  return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
};

// 更新统计数据
const updateStats = () => {
  stats.total = paginationConfig.total;
  stats.enabled = data.value.filter(item => item.enable === 1).length;
  stats.disabled = data.value.filter(item => item.enable === 2).length;
  stats.pools = new Set(data.value.map(item => item.pool_id)).size;
};

// 数据加载
const fetchRecordRules = async (): Promise<void> => {
  loading.value = true;
  try {
    const response = await getMonitorRecordRuleListApi({
      page: paginationConfig.current,
      size: paginationConfig.pageSize,
      search: searchText.value || undefined,
      enable: enabledFilter.value,
    });
    data.value = response.items || [];
    paginationConfig.total = response.total || 0;
    updateStats();
  } catch (error: any) {
    console.error('加载记录规则列表失败:', error);
    message.error(error.message || '加载记录规则列表失败');
  } finally {
    loading.value = false;
  }
};

// 获取Prometheus实例池数据（支持分页和搜索）
const loadPools = async () => {
  try {
    const response = await getMonitorScrapePoolListApi({
      page: poolPagination.current,
      size: poolPagination.pageSize,
      search: poolPagination.search
    });
    poolOptions.value = response.items;
    poolPagination.total = response.total;
  } catch (error: any) {
    message.error(error.message || '获取实例池数据失败，请稍后重试');
    console.error(error);
  }
};

// 处理实例池搜索
const handlePoolSearch = (value: string) => {
  if (poolSearchTimeout) {
    clearTimeout(poolSearchTimeout);
  }
  poolSearchTimeout = setTimeout(() => {
    poolPagination.search = value;
    poolPagination.current = 1;
    loadPools();
  }, 300);
};

// 处理实例池下拉框显示/隐藏
const handlePoolDropdownChange = (open: boolean) => {
  showPoolPagination.value = open;
  if (open && poolOptions.value.length === 0) {
    loadPools();
  }
};

// 事件处理
const handleTableChange = (pagination: any): void => {
  paginationConfig.current = pagination.current;
  paginationConfig.pageSize = pagination.pageSize;
  fetchRecordRules();
};

const handleSearch = (): void => {
  paginationConfig.current = 1;
  fetchRecordRules();
};

const handleSearchChange = (): void => {
  if (searchTimeout) {
    clearTimeout(searchTimeout);
  }
  searchTimeout = setTimeout(() => {
    paginationConfig.current = 1;
    fetchRecordRules();
  }, 500);
};

const handleEnabledFilterChange = (): void => {
  paginationConfig.current = 1;
  fetchRecordRules();
};

const handleReset = (): void => {
  searchText.value = '';
  enabledFilter.value = undefined;
  paginationConfig.current = 1;
  fetchRecordRules();
  message.success('过滤条件已重置');
};

// 查看记录详情
const handleViewRecord = async (record: MonitorRecordRule): Promise<void> => {
  try {
    const response = await getMonitorRecordRuleApi(record.id!);
    detailDialog.form = response;
    detailDialogVisible.value = true;
  } catch (error: any) {
    console.error('获取记录详情失败:', error);
    message.error(error.message || '获取记录详情失败');
  }
};

// 菜单点击处理
const handleMenuClick = (command: string, record: MonitorRecordRule): void => {
  switch (command) {
    case 'enable':
      handleEnableRecord(record);
      break;
    case 'disable':
      handleDisableRecord(record);
      break;
    case 'delete':
      handleDelete(record);
      break;
  }
};

// 启用记录
const handleEnableRecord = async (record: MonitorRecordRule): Promise<void> => {
  try {
    const payload = {
      id: record.id!,
      name: record.name,
      pool_id: record.pool_id,
      ip_address: record.ip_address,
      enable: 1 as 1 | 2,
      expr: record.expr,
      labels: record.labels,
    };
    await updateMonitorRecordRuleApi(payload);
    message.success(`记录规则 "${record.name}" 已启用`);
    fetchRecordRules();
    if (detailDialogVisible.value) {
      detailDialog.form!.enable = 1;
    }
  } catch (error: any) {
    console.error('启用记录规则失败:', error);
    message.error(error.message || '启用记录规则失败');
  }
};

// 禁用记录
const handleDisableRecord = async (record: MonitorRecordRule): Promise<void> => {
  try {
    const payload = {
      id: record.id!,
      name: record.name,
      pool_id: record.pool_id,
      ip_address: record.ip_address,
      enable: 2 as 1 | 2,
      expr: record.expr,
      labels: record.labels,
    };
    await updateMonitorRecordRuleApi(payload);
    message.success(`记录规则 "${record.name}" 已禁用`);
    fetchRecordRules();
  } catch (error: any) {
    console.error('禁用记录规则失败:', error);
    message.error(error.message || '禁用记录规则失败');
  }
};

// 模态框操作
const showAddModal = (): void => {
  resetAddForm();
  isAddModalVisible.value = true;
};

const closeAddModal = (): void => {
  isAddModalVisible.value = false;
};

const showEditModal = (record: MonitorRecordRule): void => {
  Object.assign(editForm, {
    id: record.id,
    name: record.name,
    pool_id: record.pool_id,
    ip_address: record.ip_address,
    enable: record.enable,
    expr: record.expr,
    labels: record.labels,
  });
  isEditModalVisible.value = true;
  detailDialogVisible.value = false;
};

const closeEditModal = (): void => {
  isEditModalVisible.value = false;
};

const closeDetailDialog = (): void => {
  detailDialogVisible.value = false;
};

// 重置新增表单
const resetAddForm = (): void => {
  addForm.name = '';
  addForm.pool_id = 0;
  addForm.ip_address = '';
  addForm.enable = 2 as 1 | 2;
  addForm.expr = '';
  addForm.labels = [];
};

// 提交新增记录
const handleAdd = async (): Promise<void> => {
  try {
    await addFormRef.value?.validate();
    submitLoading.value = true;

    const payload = {
      name: addForm.name,
      pool_id: addForm.pool_id,
      ip_address: addForm.ip_address,
      enable: Number(addForm.enable) as 1 | 2,
      expr: addForm.expr,
      labels: addForm.labels,
    };

    await createMonitorRecordRuleApi(payload);
    message.success('新增记录成功');
    fetchRecordRules();
    closeAddModal();
  } catch (error: any) {
    console.error('新增记录失败:', error);
    message.error(error.message || '新增记录失败');
  } finally {
    submitLoading.value = false;
  }
};

// 提交更新记录
const handleUpdate = async (): Promise<void> => {
  try {
    await editFormRef.value?.validate();
    submitLoading.value = true;

    const payload = {
      id: editForm.id,
      name: editForm.name,
      pool_id: editForm.pool_id,
      ip_address: editForm.ip_address,
      enable: Number(editForm.enable) as 1 | 2,
      expr: editForm.expr,
      labels: editForm.labels,
    };

    await updateMonitorRecordRuleApi(payload);
    message.success('更新记录规则成功');
    fetchRecordRules();
    closeEditModal();
  } catch (error: any) {
    console.error('更新记录规则失败:', error);
    message.error(error.message || '更新记录规则失败');
  } finally {
    submitLoading.value = false;
  }
};

// 处理删除记录规则
const handleDelete = (record: MonitorRecordRule) => {
  Modal.confirm({
    title: '警告',
    content: `确定要删除记录规则 "${record.name}" 吗？`,
    okText: '删除',
    okType: 'danger',
    cancelText: '取消',
    onOk: async () => {
      try {
        await deleteMonitorRecordRuleApi(record.id!);
        message.success('记录规则已删除');
        fetchRecordRules();
      } catch (error: any) {
        console.error('删除记录规则失败:', error);
        message.error(error.message || '删除记录规则失败');
      }
    },
  });
};

// 表达式验证（新增）
const validateAddExpression = async () => {
  try {
    if (!addForm.expr) {
      message.error('表达式不能为空');
      return;
    }
    validatingExpr.value = true;
    const payload = { promql_expr: addForm.expr };
    await promqlExprCheckApi(payload);
    message.success('表达式验证成功');
  } catch (error: any) {
    message.error(error.message || '表达式验证失败，请稍后重试');
    console.error(error);
  } finally {
    validatingExpr.value = false;
  }
};

// 表达式验证（编辑）
const validateEditExpression = async () => {
  try {
    if (!editForm.expr) {
      message.error('表达式不能为空');
      return;
    }
    validatingExpr.value = true;
    const payload = { promql_expr: editForm.expr };
    await promqlExprCheckApi(payload);
    message.success('表达式验证成功');
  } catch (error: any) {
    message.error(error.message || '表达式验证失败，请稍后重试');
    console.error(error);
  } finally {
    validatingExpr.value = false;
  }
};

// 生命周期钩子
onMounted(() => {
  fetchRecordRules();
  loadPools();
});
</script>

<style scoped>
.scrape-pool-container {
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

.empty-text {
  color: #999;
  font-style: italic;
  font-size: 12px;
}

.expr-content {
  max-width: 250px;
}

.expr-text {
  display: block;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  cursor: help;
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

.validate-button {
  display: flex;
  align-items: center;
  gap: 8px;
  background: #52c41a;
  border: none;
  box-shadow: 0 2px 6px rgba(82, 196, 26, 0.4);
  transition: all 0.3s;
}

.validate-button:hover {
  background: #389e0d;
  transform: translateY(-1px);
  box-shadow: 0 4px 8px rgba(82, 196, 26, 0.5);
}

.pool-pagination {
  margin-top: 8px;
  text-align: center;
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

.expr-detail {
  white-space: pre-wrap;
  word-break: break-all;
  background: #f5f5f5;
  padding: 8px;
  border-radius: 4px;
  font-family: monospace;
  max-height: 200px;
  overflow-y: auto;
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
  .scrape-pool-container {
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

@media (max-width: 480px) {
  .header-actions {
    gap: 8px;
  }

  .stats-card {
    text-align: center;
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
