<template>
  <div class="config-container">
    <!-- 页面标题 -->
    <div class="page-header">
      <div class="header-actions">
        <a-button type="primary" @click="showAddModal" class="btn-create">
          <template #icon>
            <PlusOutlined />
          </template>
          <span class="btn-text">新增监控配置</span>
        </a-button>
        <div class="search-filters">
          <a-input-search 
            v-model:value="searchText" 
            placeholder="搜索配置名称..." 
            class="search-input" 
            @search="handleSearch"
            @change="handleSearchChange" 
            allow-clear 
          />
          <a-select 
            v-model:value="searchPoolId" 
            placeholder="全部实例池" 
            class="filter-select"
            @change="handleFilterChange" 
            allow-clear
          >
            <a-select-option :value="undefined">全部实例池</a-select-option>
            <a-select-option v-for="pool in poolOptions" :key="pool.id" :value="pool.id">
              {{ pool.name }}
            </a-select-option>
          </a-select>
          <a-select 
            v-model:value="searchConfigType" 
            placeholder="全部类型" 
            class="filter-select"
            @change="handleFilterChange" 
            allow-clear
          >
            <a-select-option :value="undefined">全部类型</a-select-option>
            <a-select-option :value="ConfigType.Prometheus">Prometheus配置</a-select-option>
            <a-select-option :value="ConfigType.AlertManager">AlertManager配置</a-select-option>
            <a-select-option :value="ConfigType.AlertRule">告警规则配置</a-select-option>
            <a-select-option :value="ConfigType.RecordRule">预聚合规则配置</a-select-option>
            <a-select-option :value="ConfigType.WebhookFile">Webhook文件</a-select-option>
          </a-select>
          <a-select 
            v-model:value="searchStatus" 
            placeholder="全部状态" 
            class="filter-select"
            @change="handleFilterChange" 
            allow-clear
          >
            <a-select-option :value="undefined">全部状态</a-select-option>
            <a-select-option :value="ConfigStatus.Active">激活</a-select-option>
            <a-select-option :value="ConfigStatus.Inactive">非激活</a-select-option>
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
              title="总配置数" 
              :value="stats.total" 
              :value-style="{ color: '#3f8600' }"
            >
              <template #prefix>
                <Icon icon="carbon:settings" />
              </template>
            </a-statistic>
          </a-card>
        </a-col>
        <a-col :xs="12" :sm="6" :md="6" :lg="6">
          <a-card class="stats-card">
            <a-statistic 
              title="激活配置" 
              :value="stats.active" 
              :value-style="{ color: '#52c41a' }"
            >
              <template #prefix>
                <Icon icon="carbon:checkmark-filled" />
              </template>
            </a-statistic>
          </a-card>
        </a-col>
        <a-col :xs="12" :sm="6" :md="6" :lg="6">
          <a-card class="stats-card">
            <a-statistic 
              title="告警规则" 
              :value="stats.alertRules" 
              :value-style="{ color: '#faad14' }"
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
              title="实例数" 
              :value="stats.instances" 
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
          :scroll="{ x: 1400 }" 
          @change="handleTableChange"
        >
          <template #bodyCell="{ column, record }">
            <template v-if="column.key === 'name'">
              <div class="config-name-cell">
                <div class="status-dot" :class="record.status === ConfigStatus.Active ? 'status-dot-active' : 'status-dot-inactive'"></div>
                <span class="config-name">{{ record.name }}</span>
              </div>
            </template>

            <template v-if="column.key === 'config_type'">
              <a-tag 
                class="tech-tag" 
                :class="getConfigTypeColor(record.config_type)"
              >
                {{ getConfigTypeName(record.config_type) }}
              </a-tag>
            </template>

            <template v-if="column.key === 'instance_info'">
              <div class="instance-info">
                <div class="instance-item">实例池: {{ getPoolName(record.pool_id) }}</div>
                <div class="instance-item instance-ip">IP: {{ record.instance_ip }}</div>
              </div>
            </template>

            <template v-if="column.key === 'status'">
              <a-tag :color="record.status === ConfigStatus.Active ? 'success' : 'default'">
                {{ record.status === ConfigStatus.Active ? '激活' : '非激活' }}
              </a-tag>
            </template>

            <template v-if="column.key === 'last_generated_time'">
              <div class="date-info">
                <span class="date">{{ formatDate(record.last_generated_time) }}</span>
                <span class="time">{{ formatTime(record.last_generated_time) }}</span>
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
                <a-button type="primary" size="small" @click="handleViewDetail(record)">
                  查看
                </a-button>
                <a-button type="default" size="small" @click="showEditModal(record)">
                  编辑
                </a-button>
                <a-dropdown>
                  <template #overlay>
                    <a-menu @click="(e: any) => handleMenuClick(e.key, record)">
                      <a-menu-item key="preview">预览配置</a-menu-item>
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

    <!-- 新增配置模态框 -->
    <a-modal 
      :open="isAddModalVisible" 
      title="新增监控配置" 
      :width="formDialogWidth"
      @ok="handleAdd" 
      @cancel="closeAddModal" 
      :destroy-on-close="true" 
      class="responsive-modal config-modal"
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
            <a-col :xs="24" :sm="12">
              <a-form-item 
                label="配置名称" 
                name="name" 
                :rules="[{ required: true, message: '请输入配置名称' }]"
              >
                <a-input 
                  v-model:value="addForm.name" 
                  placeholder="请输入配置名称" 
                />
              </a-form-item>
            </a-col>
            <a-col :xs="24" :sm="12">
              <a-form-item 
                label="配置类型" 
                name="config_type"
                :rules="[{ required: true, message: '请选择配置类型' }]"
              >
                <a-select 
                  v-model:value="addForm.config_type" 
                  placeholder="请选择配置类型"
                >
                  <a-select-option :value="ConfigType.Prometheus">Prometheus配置</a-select-option>
                  <a-select-option :value="ConfigType.AlertManager">AlertManager配置</a-select-option>
                  <a-select-option :value="ConfigType.AlertRule">告警规则配置</a-select-option>
                  <a-select-option :value="ConfigType.RecordRule">预聚合规则配置</a-select-option>
                  <a-select-option :value="ConfigType.WebhookFile">Webhook文件</a-select-option>
                </a-select>
              </a-form-item>
            </a-col>
          </a-row>
          <a-row :gutter="16">
            <a-col :xs="24" :sm="12">
              <a-form-item 
                label="实例池" 
                name="pool_id"
                :rules="[{ required: true, message: '请选择实例池' }]"
              >
                <a-select 
                  v-model:value="addForm.pool_id" 
                  placeholder="请选择实例池"
                >
                  <a-select-option v-for="pool in poolOptions" :key="pool.id" :value="pool.id">
                    {{ pool.name }}
                  </a-select-option>
                </a-select>
              </a-form-item>
            </a-col>
            <a-col :xs="24" :sm="12">
              <a-form-item 
                label="实例IP" 
                name="instance_ip"
                :rules="[{ required: true, message: '请输入实例IP' }]"
              >
                <a-input 
                  v-model:value="addForm.instance_ip" 
                  placeholder="请输入实例IP" 
                />
              </a-form-item>
            </a-col>
          </a-row>
        </div>

        <div class="form-section">
          <div class="section-title">配置内容</div>
          <a-form-item 
            label="配置内容" 
            name="config_content"
            :rules="[{ required: true, message: '请输入配置内容' }]"
          >
            <a-textarea 
              v-model:value="addForm.config_content" 
              :rows="12" 
              placeholder="请输入配置内容"
            />
          </a-form-item>
        </div>

        <div class="form-section">
          <div class="section-title">状态设置</div>
          <a-form-item label="状态" name="status">
            <a-switch 
              v-model:checked="addForm.status" 
              :checked-value="ConfigStatus.Active"
              :un-checked-value="ConfigStatus.Inactive"
              checked-children="激活"
              un-checked-children="非激活"
              class="tech-switch" 
            />
          </a-form-item>
        </div>
      </a-form>
    </a-modal>

    <!-- 编辑配置模态框 -->
    <a-modal 
      :open="isEditModalVisible" 
      title="编辑监控配置" 
      :width="formDialogWidth"
      @ok="handleEdit" 
      @cancel="closeEditModal" 
      :destroy-on-close="true" 
      class="responsive-modal config-modal"
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
            <a-col :xs="24" :sm="12">
              <a-form-item 
                label="配置名称" 
                name="name" 
                :rules="[{ required: true, message: '请输入配置名称' }]"
              >
                <a-input 
                  v-model:value="editForm.name" 
                  placeholder="请输入配置名称" 
                />
              </a-form-item>
            </a-col>
            <a-col :xs="24" :sm="12">
              <a-form-item 
                label="配置类型" 
                name="config_type"
                :rules="[{ required: true, message: '请选择配置类型' }]"
              >
                <a-select 
                  v-model:value="editForm.config_type" 
                  placeholder="请选择配置类型"
                >
                  <a-select-option :value="ConfigType.Prometheus">Prometheus配置</a-select-option>
                  <a-select-option :value="ConfigType.AlertManager">AlertManager配置</a-select-option>
                  <a-select-option :value="ConfigType.AlertRule">告警规则配置</a-select-option>
                  <a-select-option :value="ConfigType.RecordRule">预聚合规则配置</a-select-option>
                  <a-select-option :value="ConfigType.WebhookFile">Webhook文件</a-select-option>
                </a-select>
              </a-form-item>
            </a-col>
          </a-row>
          <a-row :gutter="16">
            <a-col :xs="24" :sm="12">
              <a-form-item 
                label="实例池" 
                name="pool_id"
                :rules="[{ required: true, message: '请选择实例池' }]"
              >
                <a-select 
                  v-model:value="editForm.pool_id" 
                  placeholder="请选择实例池"
                >
                  <a-select-option v-for="pool in poolOptions" :key="pool.id" :value="pool.id">
                    {{ pool.name }}
                  </a-select-option>
                </a-select>
              </a-form-item>
            </a-col>
            <a-col :xs="24" :sm="12">
              <a-form-item 
                label="实例IP" 
                name="instance_ip"
                :rules="[{ required: true, message: '请输入实例IP' }]"
              >
                <a-input 
                  v-model:value="editForm.instance_ip" 
                  placeholder="请输入实例IP" 
                />
              </a-form-item>
            </a-col>
          </a-row>
        </div>

        <div class="form-section">
          <div class="section-title">配置内容</div>
          <a-form-item 
            label="配置内容" 
            name="config_content"
            :rules="[{ required: true, message: '请输入配置内容' }]"
          >
            <a-textarea 
              v-model:value="editForm.config_content" 
              :rows="12" 
              placeholder="请输入配置内容"
            />
          </a-form-item>
        </div>

        <div class="form-section">
          <div class="section-title">状态设置</div>
          <a-form-item label="状态" name="status">
            <a-switch 
              v-model:checked="editForm.status" 
              :checked-value="ConfigStatus.Active"
              :un-checked-value="ConfigStatus.Inactive"
              checked-children="激活"
              un-checked-children="非激活"
              class="tech-switch" 
            />
          </a-form-item>
        </div>
      </a-form>
    </a-modal>

    <!-- 配置预览模态框 -->
    <a-modal 
      :open="isPreviewModalVisible" 
      title="配置内容预览" 
      :width="previewDialogWidth" 
      :footer="null"
      @cancel="closePreviewModal" 
      class="detail-dialog"
    >
      <div v-if="previewConfig" class="config-preview">
        <div class="preview-header">
          <h3 class="preview-name">{{ previewConfig.name }}</h3>
          <div class="preview-badges">
            <a-tag 
              class="tech-tag" 
              :class="getConfigTypeColor(previewConfig.config_type)"
            >
              {{ getConfigTypeName(previewConfig.config_type) }}
            </a-tag>
          </div>
        </div>

        <a-textarea 
          :value="previewConfig.config_content" 
          readonly 
          :rows="20"
          class="preview-textarea"
        />

        <div class="detail-footer">
          <a-button @click="closePreviewModal">关闭</a-button>
        </div>
      </div>
    </a-modal>

    <!-- 详情模态框 -->
    <a-modal 
      :open="isDetailModalVisible" 
      title="配置详情" 
      :width="previewDialogWidth" 
      :footer="null"
      @cancel="closeDetailModal" 
      class="detail-dialog"
    >
      <div v-if="detailConfig" class="config-details">
        <div class="detail-header">
          <h2>{{ detailConfig.name }}</h2>
          <div class="detail-badges">
            <a-tag 
              class="tech-tag" 
              :class="getConfigTypeColor(detailConfig.config_type)"
            >
              {{ getConfigTypeName(detailConfig.config_type) }}
            </a-tag>
            <a-tag :color="detailConfig.status === ConfigStatus.Active ? 'success' : 'default'">
              {{ detailConfig.status === ConfigStatus.Active ? '激活' : '非激活' }}
            </a-tag>
          </div>
        </div>

        <a-descriptions bordered :column="1" :labelStyle="{ width: '150px' }">
          <a-descriptions-item label="ID">{{ detailConfig.id }}</a-descriptions-item>
          <a-descriptions-item label="实例池">{{ getPoolName(detailConfig.pool_id) }}</a-descriptions-item>
          <a-descriptions-item label="实例IP">{{ detailConfig.instance_ip }}</a-descriptions-item>
          <a-descriptions-item label="配置Hash">{{ detailConfig.config_hash }}</a-descriptions-item>
          <a-descriptions-item label="最后生成时间">{{ formatFullDateTime(detailConfig.last_generated_time) }}</a-descriptions-item>
          <a-descriptions-item label="创建时间">{{ formatFullDateTime(detailConfig.created_at) }}</a-descriptions-item>
          <a-descriptions-item label="更新时间">{{ formatFullDateTime(detailConfig.updated_at) }}</a-descriptions-item>
        </a-descriptions>

        <div class="config-content-section">
          <h4 class="content-title">配置内容</h4>
          <a-textarea 
            :value="detailConfig.config_content" 
            readonly 
            :rows="15"
            class="preview-textarea"
          />
        </div>

        <div class="detail-footer">
          <a-button @click="closeDetailModal">关闭</a-button>
          <a-button type="primary" @click="showEditModalFromDetail(detailConfig)">编辑</a-button>
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
  getMonitorConfigListApi,
  getMonitorConfigApi,
  createMonitorConfigApi,
  updateMonitorConfigApi,
  deleteMonitorConfigApi,
  ConfigType,
  ConfigStatus,
  type MonitorConfigItem,
  type GetMonitorConfigListParams,
  type CreateMonitorConfigParams,
  type UpdateMonitorConfigParams
} from '#/api/core/prometheus/prometheus_config';

import {
  getMonitorScrapePoolListApi,
  type MonitorScrapePool
} from '#/api/core/prometheus/prometheus_scrape_pool';

// 实例池接口
type PoolOption = Pick<MonitorScrapePool, 'id' | 'name'>;

// 分页接口
interface PaginationConfig {
  current: number;
  pageSize: number;
  total: number;
  showSizeChanger: boolean;
  showQuickJumper: boolean;
  showTotal: (total: number) => string;
  size: 'default' | 'small';
}

// 统计数据接口
interface Stats {
  total: number;
  active: number;
  alertRules: number;
  instances: number;
}

// 表单数据接口
interface ConfigForm {
  id?: number;
  name: string;
  pool_id: number | undefined;
  instance_ip: string;
  config_type: ConfigType | undefined;
  config_content: string;
  status: ConfigStatus;
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
  { title: '配置名称', dataIndex: 'name', key: 'name', width: 200, fixed: 'left' },
  { title: '配置类型', dataIndex: 'config_type', key: 'config_type', width: 150 },
  { title: '实例信息', dataIndex: 'instance_info', key: 'instance_info', width: 200 },
  { title: '状态', dataIndex: 'status', key: 'status', width: 100, align: 'center' as const },
  { title: '最后生成时间', dataIndex: 'last_generated_time', key: 'last_generated_time', width: 180 },
  { title: '创建时间', dataIndex: 'created_at', key: 'created_at', width: 180 },
  { title: '操作', key: 'action', width: 200, align: 'center' as const, fixed: 'right' }
];

// 实例池数据
const poolOptions = ref<PoolOption[]>([]);

// 状态数据
const loading = ref(false);
const data = ref<MonitorConfigItem[]>([]);
const searchText = ref('');
const searchPoolId = ref<number | undefined>(undefined);
const searchConfigType = ref<ConfigType | undefined>(undefined);
const searchStatus = ref<ConfigStatus | undefined>(undefined);

// 防抖处理
let searchTimeout: any = null;

// 分页配置
const paginationConfig = reactive<PaginationConfig>({
  current: 1,
  pageSize: 10,
  total: 0,
  showSizeChanger: true,
  showQuickJumper: true,
  showTotal: (total: number) => `共 ${total} 条记录`,
  size: 'default'
});

// 统计数据
const stats = reactive<Stats>({
  total: 0,
  active: 0,
  alertRules: 0,
  instances: 0
});

// 模态框状态
const isAddModalVisible = ref(false);
const isEditModalVisible = ref(false);
const isPreviewModalVisible = ref(false);
const isDetailModalVisible = ref(false);
const previewConfig = ref<MonitorConfigItem | null>(null);
const detailConfig = ref<MonitorConfigItem | null>(null);

// 表单数据
const addForm = reactive<ConfigForm>({
  name: '',
  pool_id: undefined,
  instance_ip: '',
  config_type: undefined,
  config_content: '',
  status: ConfigStatus.Active
});

const editForm = reactive<ConfigForm>({
  id: undefined,
  name: '',
  pool_id: undefined,
  instance_ip: '',
  config_type: undefined,
  config_content: '',
  status: ConfigStatus.Active
});

// 表单验证规则
const formRules = {
  name: [
    { required: true, message: '请输入配置名称', trigger: 'blur' },
    { min: 3, max: 50, message: '长度应为3到50个字符', trigger: 'blur' }
  ],
  config_type: [
    { required: true, message: '请选择配置类型', trigger: 'change' }
  ],
  pool_id: [
    { required: true, message: '请选择实例池', trigger: 'change' }
  ],
  instance_ip: [
    { required: true, message: '请输入实例IP', trigger: 'blur' }
  ],
  config_content: [
    { required: true, message: '请输入配置内容', trigger: 'blur' }
  ]
};

const getConfigTypeName = (type: ConfigType): string => {
  const typeNames: Record<ConfigType, string> = {
    [ConfigType.Prometheus]: 'Prometheus',
    [ConfigType.AlertManager]: 'AlertManager',
    [ConfigType.AlertRule]: '告警规则',
    [ConfigType.RecordRule]: '预聚合规则',
    [ConfigType.WebhookFile]: 'Webhook文件'
  };
  return typeNames[type] || '未知';
};

const getConfigTypeColor = (type: ConfigType): string => {
  const typeColors: Record<ConfigType, string> = {
    [ConfigType.Prometheus]: 'prometheus-tag',
    [ConfigType.AlertManager]: 'alert-tag',
    [ConfigType.AlertRule]: 'rule-tag',
    [ConfigType.RecordRule]: 'record-tag',
    [ConfigType.WebhookFile]: 'webhook-tag'
  };
  return typeColors[type] || 'default-tag';
};

const getPoolName = (poolId: number): string => {
  const pool = poolOptions.value.find(p => p.id === poolId);
  return pool?.name || `Pool-${poolId}`;
};

const formatDate = (input: number | string): string => {
  if (!input) return '';
  const date = typeof input === 'number'
    ? new Date(input * 1000)
    : new Date(input);
  if (isNaN(date.getTime())) return '';
  return date.toLocaleDateString('zh-CN');
};

const formatTime = (input: number | string): string => {
  if (!input) return '';
  const date = typeof input === 'number'
    ? new Date(input * 1000)
    : new Date(input);
  if (isNaN(date.getTime())) return '';
  return date.toLocaleTimeString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit'
  });
};

const formatFullDateTime = (input: string | number): string => {
  if (!input) return '';
  const date = typeof input === 'number'
    ? new Date(input * 1000)
    : new Date(input);
  if (isNaN(date.getTime())) return '';
  return date.toLocaleString('zh-CN');
};

// 更新统计数据
const updateStats = (): void => {
  stats.total = paginationConfig.total;
  stats.active = data.value.filter((item: MonitorConfigItem) => item.status === ConfigStatus.Active).length;
  stats.alertRules = data.value.filter((item: MonitorConfigItem) => item.config_type === ConfigType.AlertRule).length;
  stats.instances = new Set(data.value.map((item: MonitorConfigItem) => item.instance_ip)).size;
};

// 数据加载
const fetchConfigs = async (): Promise<void> => {
  loading.value = true;
  try {
    const params: GetMonitorConfigListParams = {
      page: paginationConfig.current,
      size: paginationConfig.pageSize,
      search: searchText.value || undefined,
      config_type: searchConfigType.value,
      status: searchStatus.value
    };

    const response = await getMonitorConfigListApi(params);
    if (response) {
      let items: MonitorConfigItem[] = response.items || [];
      // 客户端按实例池过滤（后端参数未定义）
      if (searchPoolId.value !== undefined) {
        items = items.filter((item: MonitorConfigItem) => item.pool_id === searchPoolId.value);
      }
      data.value = items;
      paginationConfig.total = (response.total ?? items.length) as number;
      updateStats();
    }
  } catch (error: any) {

    message.error(error.message || '加载配置列表失败');
  } finally {
    loading.value = false;
  }
};

// 加载实例池数据
const loadPoolOptions = async (): Promise<void> => {
  try {
    let allPools: MonitorScrapePool[] = [];
    let currentPage = 1;
    const pageSize = 10;
    let hasMore = true;

    while (hasMore) {
      const res = await getMonitorScrapePoolListApi({ 
        page: currentPage, 
        size: pageSize 
      });
      
      if (res?.items && res.items.length > 0) {
        allPools = allPools.concat(res.items);
        
        // 检查是否还有更多数据
        hasMore = res.items.length === pageSize && allPools.length < (res.total || 0);
        currentPage++;
      } else {
        hasMore = false;
      }
    }

    poolOptions.value = allPools
      .filter((item: MonitorScrapePool) => item.id !== undefined)
      .map((item: MonitorScrapePool) => ({
        id: item.id!,
        name: item.name
      }));
  } catch (error: any) {

    poolOptions.value = [];
  }
};

// 事件处理
const handleTableChange = (pagination: any): void => {
  paginationConfig.current = pagination.current;
  paginationConfig.pageSize = pagination.pageSize;
  fetchConfigs();
};

const handleSearch = (): void => {
  paginationConfig.current = 1;
  fetchConfigs();
};

const handleSearchChange = (): void => {
  if (searchTimeout) {
    clearTimeout(searchTimeout);
  }
  searchTimeout = setTimeout(() => {
    paginationConfig.current = 1;
    fetchConfigs();
  }, 500);
};

const handleFilterChange = (): void => {
  paginationConfig.current = 1;
  fetchConfigs();
};

const handleReset = (): void => {
  searchText.value = '';
  searchPoolId.value = undefined;
  searchConfigType.value = undefined;
  searchStatus.value = undefined;
  paginationConfig.current = 1;
  fetchConfigs();
  message.success('过滤条件已重置');
};

const handleMenuClick = (command: string, record: MonitorConfigItem): void => {
  switch (command) {
    case 'preview':
      showPreviewModal(record);
      break;
    case 'delete':
      confirmDelete(record);
      break;
  }
};

const confirmDelete = (record: MonitorConfigItem): void => {
  Modal.confirm({
    title: '警告',
    content: `确定要删除配置 "${record.name}" 吗？`,
    okText: '删除',
    okType: 'danger',
    cancelText: '取消',
    async onOk() {
      try {
        await deleteMonitorConfigApi({ id: record.id });
        message.success(`配置 "${record.name}" 已删除`);
        fetchConfigs();
      } catch (error: any) {

        message.error(error.message || '删除配置失败');
      }
    }
  });
};

// 表单处理
const resetAddForm = (): void => {
  Object.assign(addForm, {
    name: '',
    pool_id: undefined,
    instance_ip: '',
    config_type: undefined,
    config_content: '',
    status: ConfigStatus.Active
  });
};

const showAddModal = (): void => {
  resetAddForm();
  isAddModalVisible.value = true;
};

const closeAddModal = (): void => {
  isAddModalVisible.value = false;
};

const handleAdd = async (): Promise<void> => {
  try {
    const params: CreateMonitorConfigParams = {
      name: addForm.name,
      pool_id: addForm.pool_id!,
      instance_ip: addForm.instance_ip,
      config_type: addForm.config_type!,
      config_content: addForm.config_content,
      status: addForm.status
    };

    await createMonitorConfigApi(params);
    closeAddModal();
    fetchConfigs();
    message.success('新增配置成功');
  } catch (error: any) {
    message.error('新增配置失败: ' + (error.message || '未知错误'));
  }
};

const showEditModal = (record: MonitorConfigItem): void => {
  editForm.id = record.id;
  editForm.name = record.name;
  editForm.pool_id = record.pool_id;
  editForm.instance_ip = record.instance_ip;
  editForm.config_type = record.config_type;
  editForm.config_content = record.config_content;
  editForm.status = record.status;
  isEditModalVisible.value = true;
};

const showEditModalFromDetail = (record: MonitorConfigItem): void => {
  closeDetailModal();
  showEditModal(record);
};

const closeEditModal = (): void => {
  isEditModalVisible.value = false;
};

const handleEdit = async (): Promise<void> => {
  try {
    const params: UpdateMonitorConfigParams = {
      id: editForm.id!,
      name: editForm.name,
      pool_id: editForm.pool_id!,
      instance_ip: editForm.instance_ip,
      config_type: editForm.config_type!,
      config_content: editForm.config_content,
      status: editForm.status
    };

    await updateMonitorConfigApi(params);
    closeEditModal();
    fetchConfigs();
    message.success('更新配置成功');
  } catch (error: any) {
    message.error('更新配置失败: ' + (error.message || '未知错误'));
  }
};

const handleViewDetail = async (record: MonitorConfigItem): Promise<void> => {
  try {
    const detail = await getMonitorConfigApi({ id: record.id });
    detailConfig.value = detail;
    isDetailModalVisible.value = true;
  } catch (error: any) {

    message.error('获取配置详情失败: ' + (error.message || '未知错误'));
  }
};

const showPreviewModal = (record: MonitorConfigItem): void => {
  previewConfig.value = record;
  isPreviewModalVisible.value = true;
};

const closePreviewModal = (): void => {
  isPreviewModalVisible.value = false;
  previewConfig.value = null;
};

const closeDetailModal = (): void => {
  isDetailModalVisible.value = false;
  detailConfig.value = null;
};

// 生命周期
onMounted(() => {
  loadPoolOptions();
  fetchConfigs();
});
</script>

<style scoped>
.config-container {
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

.config-name-cell {
  display: flex;
  align-items: center;
  gap: 10px;
}

.status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}

.status-dot-active {
  background-color: #52c41a;
}

.status-dot-inactive {
  background-color: #d9d9d9;
}

.config-name {
  font-weight: 500;
  word-break: break-all;
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

.rule-tag {
  background-color: #fff1f0;
  color: #cf1322;
  border-left: 3px solid #ff4d4f;
}

.record-tag {
  background-color: #f6ffed;
  color: #389e0d;
  border-left: 3px solid #52c41a;
}

.webhook-tag {
  background-color: #f9f0ff;
  color: #722ed1;
  border-left: 3px solid #722ed1;
}

.default-tag {
  background-color: #f5f5f5;
  color: #595959;
  border-left: 3px solid #d9d9d9;
}

.instance-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.instance-item {
  font-size: 14px;
  color: rgba(0, 0, 0, 0.85);
}

.instance-ip {
  font-size: 12px;
  color: #8c8c8c;
  font-family: monospace;
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

.tech-switch {
  background-color: rgba(0, 0, 0, 0.25);
}

.tech-switch.ant-switch-checked {
  background: linear-gradient(45deg, #1890ff, #36cfc9);
}

/* 预览和详情样式 */
.config-preview,
.config-details {
  margin-bottom: 20px;
}

.preview-header,
.detail-header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 20px;
  flex-wrap: wrap;
}

.preview-name {
  font-size: 16px;
  font-weight: 500;
  color: #1f2937;
  margin: 0;
}

.detail-header h2 {
  margin: 0;
  font-size: 24px;
  color: #1f2937;
  word-break: break-all;
}

.preview-badges,
.detail-badges {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.preview-textarea {
  background-color: #fafafa;
  font-family: monospace;
  cursor: default;
}

.config-content-section {
  margin-top: 24px;
}

.content-title {
  font-size: 14px;
  font-weight: 500;
  color: rgba(0, 0, 0, 0.85);
  margin-bottom: 12px;
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
  .config-container {
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

  .instance-info {
    text-align: center;
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
