<template>
  <div class="scrape-pool-container">
    <!-- 页面标题 -->
    <div class="page-header">
      <div class="header-actions">
        <a-button type="primary" @click="handleCreateScrapePool" class="btn-create">
          <template #icon>
            <PlusOutlined />
          </template>
          <span class="btn-text">创建采集池</span>
        </a-button>
        <div class="search-filters">
          <a-input-search 
            v-model:value="searchQuery" 
            placeholder="搜索采集池名称..." 
            class="search-input" 
            @search="handleSearch"
            @change="handleSearchChange" 
            allow-clear 
          />
          <a-select 
            v-model:value="supportAlertFilter" 
            placeholder="告警支持" 
            class="filter-select"
            @change="handleSupportAlertChange" 
            allow-clear
          >
            <a-select-option :value="undefined">全部</a-select-option>
            <a-select-option :value="1">支持告警</a-select-option>
            <a-select-option :value="2">不支持告警</a-select-option>
          </a-select>
          <a-select 
            v-model:value="supportRecordFilter" 
            placeholder="记录支持" 
            class="filter-select"
            @change="handleSupportRecordChange" 
            allow-clear
          >
            <a-select-option :value="undefined">全部</a-select-option>
            <a-select-option :value="1">支持记录</a-select-option>
            <a-select-option :value="2">不支持记录</a-select-option>
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
              title="总采集池" 
              :value="stats.total" 
              :value-style="{ color: '#3f8600' }"
            >
              <template #prefix>
                <Icon icon="carbon:container-registry" />
              </template>
            </a-statistic>
          </a-card>
        </a-col>
        <a-col :xs="12" :sm="6" :md="6" :lg="6">
          <a-card class="stats-card">
            <a-statistic 
              title="支持告警" 
              :value="stats.supportAlert" 
              :value-style="{ color: '#52c41a' }"
            >
              <template #prefix>
                <Icon icon="carbon:warning-alt" />
              </template>
            </a-statistic>
          </a-card>
        </a-col>
        <a-col :xs="12" :sm="6" :md="6" :lg="6">
          <a-card class="stats-card">
            <a-statistic 
              title="支持记录" 
              :value="stats.supportRecord" 
              :value-style="{ color: '#faad14' }"
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
              title="活跃实例" 
              :value="stats.activeInstances" 
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
          :data-source="scrapePoolList" 
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

            <template v-if="column.key === 'prometheus_instances'">
              <div class="tag-container">
                <a-tag 
                  v-for="instance in record.prometheus_instances" 
                  :key="instance" 
                  class="tech-tag prometheus-tag"
                >
                  {{ instance }}
                </a-tag>
                <span v-if="!record.prometheus_instances?.length" class="empty-text">无实例</span>
              </div>
            </template>

            <template v-if="column.key === 'tags'">
              <div class="tag-container">
                <a-tag v-for="tag in record.tags" :key="tag" class="tech-tag label-tag">
                  {{ tag }}
                </a-tag>
                <span v-if="!record.tags?.length" class="empty-text">无标签</span>
              </div>
            </template>

            <template v-if="column.key === 'support_alert'">
              <a-tag :color="record.support_alert === 1 ? 'success' : 'default'">
                {{ record.support_alert === 1 ? '支持' : '不支持' }}
              </a-tag>
            </template>

            <template v-if="column.key === 'support_record'">
              <a-tag :color="record.support_record === 1 ? 'success' : 'default'">
                {{ record.support_record === 1 ? '支持' : '不支持' }}
              </a-tag>
            </template>

            <template v-if="column.key === 'scrape_config'">
              <div class="config-info">
                <div class="config-item">
                  <span class="config-label">间隔:</span>
                  <span class="config-value">{{ record.scrape_interval }}s</span>
                </div>
                <div class="config-item">
                  <span class="config-label">超时:</span>
                  <span class="config-value">{{ record.scrape_timeout }}s</span>
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
                <a-button type="primary" size="small" @click="handleViewScrapePool(record)">
                  查看
                </a-button>
                <a-button type="default" size="small" @click="handleEditScrapePool(record)">
                  编辑
                </a-button>
                <a-dropdown>
                  <template #overlay>
                    <a-menu @click="(e: any) => handleMenuClick(e.key, record)">
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

    <!-- 创建/编辑采集池对话框 -->
    <a-modal 
      :open="formDialogVisible" 
      :title="formDialog.isEdit ? '编辑采集池' : '创建采集池'" 
      :width="formDialogWidth"
      @ok="saveScrapePool" 
      @cancel="closeFormDialog" 
      :destroy-on-close="true" 
      class="responsive-modal scrape-pool-modal"
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
            <a-col :span="24">
              <a-form-item 
                label="采集池名称" 
                name="name" 
                :rules="[{ required: true, message: '请输入采集池名称' }]"
              >
                <a-input 
                  v-model:value="formDialog.form.name" 
                  placeholder="请输入采集池名称" 
                />
              </a-form-item>
            </a-col>
          </a-row>
        </div>

        <div class="form-section">
          <div class="section-title">实例配置</div>
          <!-- Prometheus实例 -->
          <a-form-item 
            v-for="(instance, index) in formDialog.form.prometheus_instances" 
            :key="instance.key"
            :label="index === 0 ? 'Prometheus实例' : ''" 
            :name="['prometheus_instances', index, 'value']"
            :rules="{ required: true, message: '请输入Prometheus实例地址' }"
          >
            <div class="dynamic-input-container">
              <a-input 
                v-model:value="instance.value" 
                placeholder="请输入Prometheus实例地址" 
                class="dynamic-input" 
              />
              <MinusCircleOutlined 
                v-if="formDialog.form.prometheus_instances.length > 1" 
                class="dynamic-delete-button"
                @click="removePrometheusInstance(instance)" 
              />
            </div>
          </a-form-item>
          <a-form-item>
            <a-button 
              type="dashed" 
              class="add-dynamic-button" 
              @click="addPrometheusInstance"
            >
              <PlusOutlined />
              添加Prometheus实例
            </a-button>
          </a-form-item>
        </div>

        <div class="form-section">
          <div class="section-title">采集配置</div>
          <a-row :gutter="16">
            <a-col :xs="24" :sm="12">
              <a-form-item 
                label="采集间隔(秒)" 
                name="scrape_interval"
                :rules="[{ required: true, message: '请输入采集间隔' }]"
              >
                <a-input-number 
                  v-model:value="formDialog.form.scrape_interval" 
                  :min="1" 
                  placeholder="请输入采集间隔（秒）"
                  class="full-width" 
                />
              </a-form-item>
            </a-col>
            <a-col :xs="24" :sm="12">
              <a-form-item 
                label="采集超时(秒)" 
                name="scrape_timeout"
                :rules="[{ required: true, message: '请输入采集超时时间' }]"
              >
                <a-input-number 
                  v-model:value="formDialog.form.scrape_timeout" 
                  :min="1" 
                  placeholder="请输入采集超时时间（秒）"
                  class="full-width" 
                />
              </a-form-item>
            </a-col>
          </a-row>
          <a-row :gutter="16">
            <a-col :xs="24" :sm="12">
              <a-form-item label="支持告警" name="support_alert">
                <a-switch 
                  v-model:checked="formDialog.form.support_alert" 
                  class="tech-switch" 
                />
              </a-form-item>
            </a-col>
            <a-col :xs="24" :sm="12">
              <a-form-item label="支持记录" name="support_record">
                <a-switch 
                  v-model:checked="formDialog.form.support_record" 
                  class="tech-switch" 
                />
              </a-form-item>
            </a-col>
          </a-row>
          <a-row :gutter="16">
            <a-col :span="24">
              <a-form-item 
                label="远程超时(秒)" 
                name="remote_timeout_seconds"
                :rules="[{ required: true, message: '请输入远程超时时间' }]"
              >
                <a-input-number 
                  v-model:value="formDialog.form.remote_timeout_seconds" 
                  :min="1" 
                  placeholder="请输入远程超时（秒）"
                  class="full-width" 
                />
              </a-form-item>
            </a-col>
          </a-row>
        </div>

        <div class="form-section">
          <div class="section-title">远程配置</div>
          <a-row :gutter="16">
            <a-col :span="24">
              <a-form-item label="远程写入地址" name="remote_write_url">
                <a-input 
                  v-model:value="formDialog.form.remote_write_url" 
                  placeholder="请输入远程写入地址" 
                />
              </a-form-item>
            </a-col>
          </a-row>
          <a-row :gutter="16">
            <a-col :xs="24" :sm="12">
              <a-form-item label="远程读取地址" name="remote_read_url">
                <a-input 
                  v-model:value="formDialog.form.remote_read_url" 
                  placeholder="请输入远程读取地址" 
                />
              </a-form-item>
            </a-col>
            <a-col :xs="24" :sm="12">
              <a-form-item label="AlertManager地址" name="alert_manager_url">
                <a-input 
                  v-model:value="formDialog.form.alert_manager_url" 
                  placeholder="请输入AlertManager地址，例如：http://localhost:9090" 
                />
              </a-form-item>
            </a-col>
          </a-row>
        </div>

        <div class="form-section">
          <div class="section-title">文件路径配置</div>
          <a-row :gutter="16">
            <a-col :xs="24" :sm="12">
              <a-form-item label="规则文件路径" name="rule_file_path">
                <a-input 
                  v-model:value="formDialog.form.rule_file_path" 
                  placeholder="请输入规则文件路径" 
                />
              </a-form-item>
            </a-col>
            <a-col :xs="24" :sm="12">
              <a-form-item label="记录文件路径" name="record_file_path">
                <a-input 
                  v-model:value="formDialog.form.record_file_path" 
                  placeholder="请输入记录文件路径" 
                />
              </a-form-item>
            </a-col>
          </a-row>
        </div>

        <div class="form-section">
          <div class="section-title">标签配置</div>
          <a-form-item label="标签" name="tags">
            <a-select
              mode="tags"
              v-model:value="formDialog.form.tags"
              placeholder="输入并回车添加标签"
              :token-separators="[',']"
              style="width: 100%"
            />
          </a-form-item>
        </div>
      </a-form>
    </a-modal>


    <!-- 详情对话框 -->
    <a-modal 
      :open="detailDialogVisible" 
      title="采集池详情" 
      :width="previewDialogWidth" 
      :footer="null"
      @cancel="closeDetailDialog" 
      class="detail-dialog"
    >
      <div v-if="detailDialog.form" class="pool-details">
        <div class="detail-header">
          <h2>{{ detailDialog.form.name }}</h2>
      <div class="detail-badges">
            <a-tag :color="detailDialog.form.support_alert === 1 ? 'success' : 'default'">
              {{ detailDialog.form.support_alert === 1 ? '支持告警' : '不支持告警' }}
            </a-tag>
            <a-tag :color="detailDialog.form.support_record === 1 ? 'success' : 'default'">
              {{ detailDialog.form.support_record === 1 ? '支持记录' : '不支持记录' }}
            </a-tag>
          </div>
        </div>

        <a-descriptions bordered :column="1" :labelStyle="{ width: '150px' }">
          <a-descriptions-item label="ID">{{ detailDialog.form.id }}</a-descriptions-item>
          <a-descriptions-item label="采集间隔">{{ detailDialog.form.scrape_interval }}秒</a-descriptions-item>
          <a-descriptions-item label="采集超时">{{ detailDialog.form.scrape_timeout }}秒</a-descriptions-item>
          <a-descriptions-item label="远程超时">{{ detailDialog.form.remote_timeout_seconds }}秒</a-descriptions-item>
          <a-descriptions-item label="创建人">{{ detailDialog.form.create_user_name }}</a-descriptions-item>
          <a-descriptions-item label="创建时间">{{ formatFullDateTime(detailDialog.form.created_at || '') }}</a-descriptions-item>
          <a-descriptions-item label="远程写入地址">
            {{ detailDialog.form.remote_write_url || '未配置' }}
          </a-descriptions-item>
          <a-descriptions-item label="远程读取地址">
            {{ detailDialog.form.remote_read_url || '未配置' }}
          </a-descriptions-item>
          <a-descriptions-item label="AlertManager地址">
            {{ detailDialog.form.alert_manager_url || '未配置' }}
          </a-descriptions-item>
          <a-descriptions-item label="规则文件路径">
            {{ detailDialog.form.rule_file_path || '未配置' }}
          </a-descriptions-item>
          <a-descriptions-item label="记录文件路径">
            {{ detailDialog.form.record_file_path || '未配置' }}
          </a-descriptions-item>
          <a-descriptions-item label="标签">
            {{ detailDialog.form.tags && detailDialog.form.tags.length ? detailDialog.form.tags.join(', ') : '未配置' }}
          </a-descriptions-item>
        </a-descriptions>

        <div class="detail-footer">
          <a-button @click="closeDetailDialog">关闭</a-button>
          <a-button type="primary" @click="handleEditScrapePool(detailDialog.form)">编辑</a-button>
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
  DownOutlined,
  MinusCircleOutlined
} from '@ant-design/icons-vue';
import { Icon } from '@iconify/vue';
import {
  getMonitorScrapePoolListApi,
  createMonitorScrapePoolApi,
  updateMonitorScrapePoolApi,
  deleteMonitorScrapePoolApi,
  getMonitorScrapePoolDetailApi,
  type MonitorScrapePool,
  type GetMonitorScrapePoolListReq,
  type CreateMonitorScrapePoolReq,
  type UpdateMonitorScrapePoolReq
} from '#/api/core/prometheus/prometheus_scrape_pool';

// 动态表单项接口
interface DynamicItem {
  value: string;
  key: number;
}

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
  { title: '采集池名称', dataIndex: 'name', key: 'name', width: 200, fixed: 'left' },
  { title: 'Prometheus实例', dataIndex: 'prometheus_instances', key: 'prometheus_instances', width: 260 },
  { title: '标签', dataIndex: 'tags', key: 'tags', width: 200 },
  { title: '告警支持', dataIndex: 'support_alert', key: 'support_alert', width: 100, align: 'center' as const },
  { title: '记录支持', dataIndex: 'support_record', key: 'support_record', width: 100, align: 'center' as const },
  { title: '采集配置', dataIndex: 'scrape_config', key: 'scrape_config', width: 140 },
  { title: '创建人', dataIndex: 'create_user_name', key: 'creator', width: 120 },
  { title: '创建时间', dataIndex: 'created_at', key: 'createdAt', width: 180 },
  { title: '操作', key: 'action', width: 200, align: 'center' as const, fixed: 'right' }
];

// 状态数据
const loading = ref(false);
const searchQuery = ref('');
const supportAlertFilter = ref<1 | 2 | undefined>(undefined);
const supportRecordFilter = ref<1 | 2 | undefined>(undefined);
const scrapePoolList = ref<MonitorScrapePool[]>([]);

// 防抖处理
let searchTimeout: any = null;

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
  supportAlert: 0,
  supportRecord: 0,
  activeInstances: 0
});

// 对话框状态
const formDialogVisible = ref(false);
const detailDialogVisible = ref(false);

// 表单对话框数据
const formDialog = reactive({
  isEdit: false,
  form: {
    id: undefined as number | undefined,
    name: '',
    prometheus_instances: [] as DynamicItem[],
    scrape_interval: 15,
    scrape_timeout: 10,
    remote_timeout_seconds: 30,
    support_alert: false,
    support_record: false,
    tags: [] as string[],
    remote_write_url: '',
    remote_read_url: '',
    alert_manager_url: '',
    rule_file_path: '',
    record_file_path: '',
  }
});


// 详情对话框数据
const detailDialog = reactive({
  form: null as MonitorScrapePool | null
});

// 表单验证规则
const formRules = {
  name: [
    { required: true, message: '请输入采集池名称', trigger: 'blur' },
    { min: 3, max: 50, message: '长度应为3到50个字符', trigger: 'blur' }
  ],
  scrape_interval: [
    { required: true, message: '请输入采集间隔', trigger: 'blur' }
  ],
  scrape_timeout: [
    { required: true, message: '请输入采集超时时间', trigger: 'blur' }
  ],
  remote_timeout_seconds: [
    { required: true, message: '请输入远程超时时间', trigger: 'blur' }
  ]
};


const getPoolStatusClass = (record: MonitorScrapePool): string => {
  if (record.support_alert === 1 && record.support_record === 1) return 'status-full';
  if (record.support_alert === 1 || record.support_record === 1) return 'status-partial';
  return 'status-none';
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

// 更新统计数据
const updateStats = () => {
  stats.total = paginationConfig.total;
  stats.supportAlert = scrapePoolList.value.filter(item => item.support_alert === 1).length;
  stats.supportRecord = scrapePoolList.value.filter(item => item.support_record === 1).length;
  stats.activeInstances = scrapePoolList.value.reduce((total, item) => {
    return total + (item.prometheus_instances?.length || 0);
  }, 0);
};

// 数据加载
const loadScrapePoolList = async (): Promise<void> => {
  loading.value = true;
  try {
    const params: GetMonitorScrapePoolListReq = {
      page: paginationConfig.current,
      size: paginationConfig.pageSize,
      search: searchQuery.value || undefined,
      support_alert: supportAlertFilter.value,
      support_record: supportRecordFilter.value
    };

    const response = await getMonitorScrapePoolListApi(params);
    if (response) {
      scrapePoolList.value = response.items || [];
      paginationConfig.total = response.total || 0;
      updateStats();
    }
  } catch (error: any) {
    console.error('加载采集池列表失败:', error);
    message.error(error.message || '加载采集池列表失败');
  } finally {
    loading.value = false;
  }
};

// 事件处理
const handleTableChange = (pagination: any): void => {
  paginationConfig.current = pagination.current;
  paginationConfig.pageSize = pagination.pageSize;
  loadScrapePoolList();
};

const handleSearch = (): void => {
  paginationConfig.current = 1;
  loadScrapePoolList();
};

const handleSearchChange = (): void => {
  if (searchTimeout) {
    clearTimeout(searchTimeout);
  }
  searchTimeout = setTimeout(() => {
    paginationConfig.current = 1;
    loadScrapePoolList();
  }, 500);
};

const handleSupportAlertChange = (): void => {
  paginationConfig.current = 1;
  loadScrapePoolList();
};

const handleSupportRecordChange = (): void => {
  paginationConfig.current = 1;
  loadScrapePoolList();
};

const handleResetFilters = (): void => {
  searchQuery.value = '';
  supportAlertFilter.value = undefined;
  supportRecordFilter.value = undefined;
  paginationConfig.current = 1;
  loadScrapePoolList();
  message.success('过滤条件已重置');
};

const handleCreateScrapePool = (): void => {
  formDialog.isEdit = false;
  resetFormDialog();
  formDialogVisible.value = true;
};

const handleEditScrapePool = (record: MonitorScrapePool): void => {
  formDialog.isEdit = true;
  formDialog.form = {
    id: record.id,
    name: record.name,
    scrape_interval: record.scrape_interval,
    scrape_timeout: record.scrape_timeout,
    remote_timeout_seconds: record.remote_timeout_seconds,
    support_alert: record.support_alert === 1,
    support_record: record.support_record === 1,
    remote_write_url: record.remote_write_url || '',
    remote_read_url: record.remote_read_url || '',
    alert_manager_url: record.alert_manager_url || '',
    rule_file_path: record.rule_file_path || '',
    record_file_path: record.record_file_path || '',
    prometheus_instances: record.prometheus_instances?.map(value => ({ value, key: Date.now() + Math.random() })) || [{ value: '', key: Date.now() }],
    tags: record.tags ? [...record.tags] : []
  };
  formDialogVisible.value = true;
  detailDialogVisible.value = false;
};

const handleViewScrapePool = async (record: MonitorScrapePool): Promise<void> => {
  try {
    const response = await getMonitorScrapePoolDetailApi(record.id!);
    detailDialog.form = response;
    detailDialogVisible.value = true;
  } catch (error: any) {
    console.error('获取采集池详情失败:', error);
    message.error(error.message || '获取采集池详情失败');
  }
};

const handleMenuClick = (command: string, record: MonitorScrapePool): void => {
  switch (command) {
    case 'delete':
      confirmDelete(record);
      break;
  }
};

const confirmDelete = (record: MonitorScrapePool): void => {
  Modal.confirm({
    title: '警告',
    content: `确定要删除采集池 "${record.name}" 吗？`,
    okText: '删除',
    okType: 'danger',
    cancelText: '取消',
    async onOk() {
      try {
        await deleteMonitorScrapePoolApi(record.id!);
        message.success(`采集池 "${record.name}" 已删除`);
        loadScrapePoolList();
      } catch (error: any) {
        console.error('删除采集池失败:', error);
        message.error(error.message || '删除采集池失败');
      }
    }
  });
};

// 表单保存
const saveScrapePool = async (): Promise<void> => {
  if (!formDialog.form.name.trim()) {
    message.error('采集池名称不能为空');
    return;
  }

  if (formDialog.form.prometheus_instances.length === 0 || !formDialog.form.prometheus_instances[0]?.value) {
    message.error('请至少添加一个Prometheus实例');
    return;
  }

  try {
    const formData = {
      ...formDialog.form,
      user_id: 1, // 这里应该从用户上下文获取
      prometheus_instances: formDialog.form.prometheus_instances.map(item => item.value).filter(v => v.trim() !== ''),
      support_alert: formDialog.form.support_alert ? 1 : 2,
      support_record: formDialog.form.support_record ? 1 : 2,
      tags: Array.isArray(formDialog.form.tags) ? formDialog.form.tags.filter(t => String(t).trim() !== '') : []
    };

    if (formDialog.isEdit && formDialog.form.id) {
      const updateData: UpdateMonitorScrapePoolReq = {
        ...(formData as any),
        id: formDialog.form.id!
      } as UpdateMonitorScrapePoolReq;
      await updateMonitorScrapePoolApi(updateData);
      message.success(`采集池 "${formDialog.form.name}" 已更新`);
    } else {
      const createData: CreateMonitorScrapePoolReq = formData as CreateMonitorScrapePoolReq;
      await createMonitorScrapePoolApi(createData);
      message.success(`采集池 "${formDialog.form.name}" 已创建`);
    }

    formDialogVisible.value = false;
    loadScrapePoolList();
  } catch (error: any) {
    console.error('保存采集池失败:', error);
    message.error(error.message || '保存采集池失败');
  }
};


// 重置表单对话框
const resetFormDialog = (): void => {
  formDialog.form = {
    id: undefined,
    name: '',
    scrape_interval: 15,
    scrape_timeout: 10,
    remote_timeout_seconds: 30,
    support_alert: false,
    support_record: false,
    remote_write_url: '',
    remote_read_url: '',
    alert_manager_url: '',
    rule_file_path: '',
    record_file_path: '',
    prometheus_instances: [{ value: '', key: Date.now() }],
    tags: []
  };
};

// 动态表单项操作
const addPrometheusInstance = (): void => {
  formDialog.form.prometheus_instances.push({
    value: '',
    key: Date.now(),
  });
};

const removePrometheusInstance = (item: DynamicItem): void => {
  const index = formDialog.form.prometheus_instances.indexOf(item);
  if (index !== -1) {
    formDialog.form.prometheus_instances.splice(index, 1);
  }
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
  loadScrapePoolList();
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

.label-key {
  font-weight: 600;
}

.label-separator {
  margin: 0 4px;
  color: #8c8c8c;
}

.label-value {
  color: #555;
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

.dynamic-input-container {
  display: flex;
  align-items: center;
  gap: 12px;
}

.dynamic-input {
  width: 100%;
}

.dynamic-delete-button {
  cursor: pointer;
  color: #ff4d4f;
  font-size: 18px;
  transition: all 0.3s;
}

.dynamic-delete-button:hover {
  color: #cf1322;
  transform: scale(1.1);
}

.add-dynamic-button {
  width: 100%;
  margin-top: 8px;
  background: #f5f5f5;
  border: 1px dashed #d9d9d9;
  color: #595959;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
}

.add-dynamic-button:hover {
  color: #1890ff;
  border-color: #1890ff;
  background: #f0f7ff;
}

.label-input-group {
  display: flex;
  align-items: center;
  gap: 8px;
}

.label-key-input,
.label-value-input {
  flex: 1;
}

.label-separator {
  font-weight: bold;
  color: #8c8c8c;
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
