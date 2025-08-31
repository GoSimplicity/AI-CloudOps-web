<template>
  <div class="cluster-management-container">
    <!-- 页面头部 -->
    <div class="page-header">
      <div class="header-content">
        <div class="title-section">
          <div class="page-title">
            <ClusterOutlined class="title-icon" />
            <h1>Kubernetes 集群管理</h1>
          </div>
          <p class="page-subtitle">管理和监控您的 Kubernetes 集群资源</p>
        </div>
        <div class="header-actions">
          <a-button type="primary" size="large" @click="showAddModal">
            <template #icon><PlusOutlined /></template>
            新建集群
          </a-button>
        </div>
      </div>
    </div>

    <!-- 数据概览卡片 -->
    <div class="overview-cards">
      <div class="overview-card total-clusters">
        <div class="card-icon">
          <ClusterOutlined />
        </div>
        <div class="card-info">
          <div class="card-number">{{ clusters.length }}</div>
          <div class="card-label">集群总数</div>
        </div>
      </div>
      
      <div class="overview-card running-clusters">
        <div class="card-icon">
          <CheckCircleOutlined />
        </div>
        <div class="card-info">
          <div class="card-number">{{ runningClusters }}</div>
          <div class="card-label">运行中</div>
        </div>
      </div>
      
      <div class="overview-card error-clusters">
        <div class="card-icon">
          <CloseCircleOutlined />
        </div>
        <div class="card-info">
          <div class="card-number">{{ errorClusters }}</div>
          <div class="card-label">异常集群</div>
        </div>
      </div>
      
      <div class="overview-card resource-usage">
        <div class="card-icon">
          <DashboardOutlined />
        </div>
        <div class="card-info">
          <div class="card-number">{{ averageResourceUsage }}%</div>
          <div class="card-label">平均资源使用率</div>
        </div>
      </div>
    </div>

    <!-- 仪表板图表区域 -->
    <div class="dashboard-section">
      <a-card title="集群统计仪表板" class="dashboard-card">
        <div class="dashboard-charts">
          <div class="chart-row">
            <!-- 集群状态分布饼图 -->
            <div class="chart-container">
              <div class="chart-title">
                <DashboardOutlined class="chart-icon" />
                集群状态分布
              </div>
              <div ref="clusterStatusChartRef" class="chart-content"></div>
            </div>
            
            <!-- 环境分布饼图 -->
            <div class="chart-container">
              <div class="chart-title">
                <EnvironmentOutlined class="chart-icon" />
                环境分布
              </div>
              <div ref="envDistributionChartRef" class="chart-content"></div>
            </div>
            
            <!-- 健康状态统计 -->
            <div class="chart-container">
              <div class="chart-title">
                <HeartOutlined class="chart-icon" />
                组件健康统计
              </div>
              <div ref="healthStatsChartRef" class="chart-content"></div>
            </div>
          </div>
          
          <div class="chart-row">
            <!-- 资源使用趋势 -->
            <div class="chart-container chart-wide">
              <div class="chart-title">
                <BarChartOutlined class="chart-icon" />
                集群资源使用率
              </div>
              <div ref="resourceUsageChartRef" class="chart-content"></div>
            </div>
            

          </div>
          
          <div class="chart-row">
            <!-- 节点统计 -->
            <div class="chart-container">
              <div class="chart-title">
                <ClusterOutlined class="chart-icon" />
                节点状态统计
              </div>
              <div ref="nodeStatsChartRef" class="chart-content"></div>
            </div>
            
            <!-- Pod统计 -->
            <div class="chart-container">
              <div class="chart-title">
                <DatabaseOutlined class="chart-icon" />
                Pod状态分布
              </div>
              <div ref="podStatsChartRef" class="chart-content"></div>
            </div>
            
            <!-- 工作负载统计 -->
            <div class="chart-container">
              <div class="chart-title">
                <AppstoreOutlined class="chart-icon" />
                工作负载统计
              </div>
              <div ref="workloadStatsChartRef" class="chart-content"></div>
            </div>
          </div>
        </div>
        
        <div class="dashboard-actions">
          <a-button type="primary" @click="refreshDashboard" :loading="dashboardLoading">
            <template #icon><ReloadOutlined /></template>
            刷新仪表板
          </a-button>
        </div>
      </a-card>
    </div>

    <!-- 操作工具栏 -->
    <div class="toolbar">
      <div class="toolbar-left">
        <a-input-search
          v-model:value="searchText"
          placeholder="搜索集群名称"
          class="search-input"
          @search="onSearch"
          allow-clear
        />
        
        <a-select
          v-model:value="filterEnv"
          placeholder="选择环境"
          class="env-filter"
          allow-clear
          @change="onEnvFilterChange"
        >
          <a-select-option :value="Env.Prod">生产环境</a-select-option>
          <a-select-option :value="Env.Dev">开发环境</a-select-option>
          <a-select-option :value="Env.Stage">预发环境</a-select-option>
          <a-select-option :value="Env.Rc">测试环境</a-select-option>
          <a-select-option :value="Env.Press">灰度环境</a-select-option>
        </a-select>
        
        <a-select
          v-model:value="filterStatus"
          placeholder="选择状态"
          class="status-filter"
          allow-clear
          @change="onStatusFilterChange"
        >
          <a-select-option :value="ClusterStatus.Running">运行中</a-select-option>
          <a-select-option :value="ClusterStatus.Stopped">已停止</a-select-option>
          <a-select-option :value="ClusterStatus.Error">异常</a-select-option>
        </a-select>
      </div>
      
      <div class="toolbar-right">
        <a-button @click="refreshAll" :loading="loading">
          <template #icon><ReloadOutlined /></template>
          刷新全部
        </a-button>
        
        <a-button 
          type="primary" 
          danger 
          @click="showBatchDeleteConfirm" 
          :disabled="!selectedRows.length"
          v-if="selectedRows.length > 0"
        >
          <template #icon><DeleteOutlined /></template>
          批量删除 ({{ selectedRows.length }})
        </a-button>
      </div>
    </div>

    <!-- 数据表格 -->
    <div class="data-display">
      <a-table
        :columns="columns"
        :data-source="filteredData"
        :row-selection="rowSelection"
        :loading="loading"
        row-key="id"
        :pagination="{
          current: pagination.current,
          pageSize: pagination.pageSize,
          total: pagination.total,
          showSizeChanger: true, 
          showQuickJumper: true,
          showTotal: (total: number) => `共 ${total} 条数据`
        }"
        @change="handleTableChange"
        :expandable="{
          expandedRowRender,
          expandRowByClick: false
        }"
      >
        <!-- 集群名称列 -->
        <template #name="{ record }">
          <div class="cluster-name">
            <ClusterOutlined />
            <a @click="viewClusterDetail(record)">{{ record.name }}</a>
          </div>
        </template>
        
        <!-- 环境列 -->
        <template #env="{ record }">
          <a-tag :color="getEnvColor(record.env)" class="env-tag">
            {{ getEnvName(record.env) }}
          </a-tag>
        </template>
        
        <!-- 状态列 -->
        <template #status="{ record }">
          <a-badge :status="getStatusBadgeType(record.status)" :text="getStatusName(record.status)" />
        </template>

        <!-- 资源使用列 -->
        <template #resources="{ record }">
          <div v-if="record.cluster_stats?.resource_stats" class="resource-stats">
            <a-progress 
              :percent="record.cluster_stats.resource_stats.cpu_utilization" 
              :size="'small'" 
              :stroke-color="getProgressColor(record.cluster_stats.resource_stats.cpu_utilization)"
              :format="(percent: number) => `CPU: ${Math.round(percent)}%`"
            />
            <a-progress 
              :percent="record.cluster_stats.resource_stats.memory_utilization" 
              :size="'small'" 
              :stroke-color="getProgressColor(record.cluster_stats.resource_stats.memory_utilization)"
              :format="(percent: number) => `内存: ${Math.round(percent)}%`"
              style="margin-top: 4px"
            />
          </div>
          <span v-else class="no-data">暂无数据</span>
        </template>

        <!-- 组件健康列 -->
        <template #health="{ record }">
          <a-tooltip v-if="record.component_status?.length">
            <template #title>
              <div v-for="comp in record.component_status" :key="comp.name" class="health-tooltip-item">
                <span>{{ comp.name }}:</span>
                <span :class="['status', comp.status]">{{ comp.status }}</span>
              </div>
            </template>
            <a-tag :color="getHealthColor(record.component_status)">
              {{ getHealthSummary(record.component_status) }}
            </a-tag>
          </a-tooltip>
          <span v-else class="no-data">-</span>
        </template>

        <!-- 创建时间列 -->
        <template #created_at="{ record }">
          <a-tooltip :title="formatDateTime(record.created_at)">
            <ClockCircleOutlined style="margin-right: 4px" />
            {{ formatDate(record.created_at) }}
          </a-tooltip>
        </template>

        <!-- 操作列 -->
        <template #action="{ record }">
          <div class="action-buttons">
            <a-tooltip title="查看统计">
              <a-button type="primary" ghost shape="circle" size="small" @click="viewStats(record)">
                <template #icon><BarChartOutlined /></template>
              </a-button>
            </a-tooltip>
            
            <a-tooltip title="健康检查">
              <a-button type="primary" ghost shape="circle" size="small" @click="checkHealth(record)">
                <template #icon><HeartOutlined /></template>
              </a-button>
            </a-tooltip>
            
            <a-tooltip title="刷新状态">
              <a-button type="primary" ghost shape="circle" size="small" @click="refreshCluster(record)">
                <template #icon><SyncOutlined /></template>
              </a-button>
            </a-tooltip>
            
            <a-tooltip title="编辑">
              <a-button type="primary" ghost shape="circle" size="small" @click="editCluster(record)">
                <template #icon><EditOutlined /></template>
              </a-button>
            </a-tooltip>
            
            <a-popconfirm
              title="确定要删除该集群吗?"
              description="此操作不可撤销"
              @confirm="deleteCluster(record)"
            >
              <a-tooltip title="删除">
                <a-button type="primary" danger ghost shape="circle" size="small">
                  <template #icon><DeleteOutlined /></template>
                </a-button>
              </a-tooltip>
            </a-popconfirm>
          </div>
        </template>
      </a-table>
    </div>

    <!-- 新增/编辑集群模态框 -->
    <a-modal
      v-model:open="modalVisible"
      :title="isEdit ? `编辑集群: ${formData.name}` : '新增集群'"
      :width="900"
      @ok="handleSubmit"
      @cancel="closeModal"
      :confirmLoading="submitLoading"
      class="cluster-modal"
    >
      <a-form
        ref="formRef"
        :model="formData"
        :rules="formRules"
        layout="vertical"
        class="cluster-form"
      >
        <a-row :gutter="16">
          <a-col :span="12">
            <a-form-item label="集群名称" name="name">
              <a-input v-model:value="formData.name" placeholder="请输入集群名称">
                <template #prefix><ClusterOutlined /></template>
              </a-input>
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item label="集群版本" name="version">
              <a-input v-model:value="formData.version" placeholder="例如: v1.28.0">
                <template #prefix><TagOutlined /></template>
              </a-input>
            </a-form-item>
          </a-col>
        </a-row>
        
        <a-row :gutter="16">
          <a-col :span="12">
            <a-form-item label="环境" name="env">
              <a-select v-model:value="formData.env" placeholder="请选择环境">
                <a-select-option :value="Env.Prod">生产环境</a-select-option>
                <a-select-option :value="Env.Dev">开发环境</a-select-option>
                <a-select-option :value="Env.Stage">预发环境</a-select-option>
                <a-select-option :value="Env.Rc">测试环境</a-select-option>
                <a-select-option :value="Env.Press">灰度环境</a-select-option>
              </a-select>
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item label="状态" name="status">
              <a-select v-model:value="formData.status" placeholder="状态由后端自动填写" disabled>
                <a-select-option :value="ClusterStatus.Running">运行中</a-select-option>
                <a-select-option :value="ClusterStatus.Stopped">已停止</a-select-option>
                <a-select-option :value="ClusterStatus.Error">异常</a-select-option>
              </a-select>
              <div class="field-hint">状态由系统自动检测和更新</div>
            </a-form-item>
          </a-col>
        </a-row>

        <a-divider orientation="left">
          <span class="resource-limit-title">
            <ExclamationCircleOutlined class="danger-icon" />
            资源限制
          </span>
        </a-divider>
        
        <!-- 危险操作警告卡片 -->
        <a-alert
          type="warning"
          show-icon
          class="resource-warning-alert"
          message="⚠️ 危险操作警告"
          description="修改资源限制可能会影响集群性能和稳定性，设置过低可能导致Pod无法正常运行，设置过高可能浪费资源。请谨慎操作！"
          closable
        />
        
        <a-row :gutter="16">
          <a-col :span="12">
            <a-form-item label="CPU 请求 (m)" name="cpu_request">
              <a-input 
                v-model:value="formData.cpu_request" 
                placeholder="例如: 1000m"
                @change="handleResourceChange"
              >
                <template #addonAfter>
                  <a-tooltip title="CPU请求值，集群为Pod保证的最小CPU资源">
                    <QuestionCircleOutlined />
                  </a-tooltip>
                </template>
              </a-input>
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item label="CPU 限制 (m)" name="cpu_limit">
              <a-input 
                v-model:value="formData.cpu_limit" 
                placeholder="例如: 2000m"
                @change="handleResourceChange"
              >
                <template #addonAfter>
                  <a-tooltip title="CPU限制值，Pod能使用的最大CPU资源">
                    <QuestionCircleOutlined />
                  </a-tooltip>
                </template>
              </a-input>
            </a-form-item>
          </a-col>
        </a-row>
        
        <a-row :gutter="16">
          <a-col :span="12">
            <a-form-item label="内存请求 (Mi)" name="memory_request">
              <a-input 
                v-model:value="formData.memory_request" 
                placeholder="例如: 1024Mi"
                @change="handleResourceChange"
              >
                <template #addonAfter>
                  <a-tooltip title="内存请求值，集群为Pod保证的最小内存资源">
                    <QuestionCircleOutlined />
                  </a-tooltip>
                </template>
              </a-input>
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item label="内存限制 (Mi)" name="memory_limit">
              <a-input 
                v-model:value="formData.memory_limit" 
                placeholder="例如: 2048Mi"
                @change="handleResourceChange"
              >
                <template #addonAfter>
                  <a-tooltip title="内存限制值，Pod能使用的最大内存资源">
                    <QuestionCircleOutlined />
                  </a-tooltip>
                </template>
              </a-input>
            </a-form-item>
          </a-col>
        </a-row>

        <a-form-item label="限制命名空间" name="restrict_namespace">
          <a-select
            v-model:value="formData.restrict_namespace"
            mode="tags"
            placeholder="输入命名空间，按回车添加"
            style="width: 100%"
          />
        </a-form-item>

        <a-divider orientation="left">连接配置</a-divider>
        
        <a-form-item label="API Server 地址" name="api_server_addr">
          <a-input v-model:value="formData.api_server_addr" placeholder="https://api.k8s.example.com:6443">
            <template #prefix><ApiOutlined /></template>
          </a-input>
        </a-form-item>
        
        <a-form-item label="KubeConfig 内容" name="kube_config_content">
          <a-textarea
            v-model:value="formData.kube_config_content"
            placeholder="请粘贴 KubeConfig 内容"
            :auto-size="{ minRows: 4, maxRows: 8 }"
          />
        </a-form-item>
        
        <a-form-item label="操作超时时间（秒）" name="action_timeout_seconds">
          <a-slider
            v-model:value="formData.action_timeout_seconds"
            :min="10"
            :max="300"
            :step="10"
            :marks="{
              10: '10s',
              60: '60s',
              120: '120s',
              300: '300s',
            }"
          />
        </a-form-item>

        <a-form-item label="标签" name="tags">
          <div v-for="(tag, index) in formData.tags" :key="index" class="tag-input-group">
            <a-input-group compact>
              <a-input 
                v-model:value="tag.key" 
                placeholder="键" 
                style="width: 40%" 
              />
              <a-input 
                v-model:value="tag.value" 
                placeholder="值" 
                style="width: 40%" 
              />
              <a-button 
                type="primary" 
                danger 
                @click="removeTag(index)"
                style="width: 20%"
              >
                删除
              </a-button>
            </a-input-group>
          </div>
          <a-button type="dashed" block @click="addTag">
            <PlusOutlined /> 添加标签
          </a-button>
        </a-form-item>
      </a-form>
    </a-modal>

    <!-- 统计详情抽屉 -->
    <a-drawer
      v-model:open="statsDrawerVisible"
      :title="`集群统计详情 - ${currentCluster?.name}`"
      :width="800"
      placement="right"
    >
      <div v-if="currentStats" class="stats-detail">
        <a-descriptions title="基本信息" :column="2" bordered>
          <a-descriptions-item label="集群ID">{{ currentStats.cluster_id }}</a-descriptions-item>
          <a-descriptions-item label="集群名称">{{ currentStats.cluster_name }}</a-descriptions-item>
          <a-descriptions-item label="最后更新" :span="2">
            {{ formatDateTime(currentStats.last_update_time) }}
          </a-descriptions-item>
        </a-descriptions>

        <a-divider />

        <a-row :gutter="16">
          <a-col :span="12">
            <a-card title="节点统计" size="small">
              <a-statistic title="总节点数" :value="currentStats.node_stats?.total_nodes || 0" />
              <a-statistic title="就绪节点" :value="currentStats.node_stats?.ready_nodes || 0" />
              <a-statistic title="主节点" :value="currentStats.node_stats?.master_nodes || 0" />
              <a-statistic title="工作节点" :value="currentStats.node_stats?.worker_nodes || 0" />
            </a-card>
          </a-col>
          <a-col :span="12">
            <a-card title="Pod统计" size="small">
              <a-statistic title="总Pod数" :value="currentStats.pod_stats?.total_pods || 0" />
              <a-statistic title="运行中" :value="currentStats.pod_stats?.running_pods || 0" />
              <a-statistic title="等待中" :value="currentStats.pod_stats?.pending_pods || 0" />
              <a-statistic title="失败" :value="currentStats.pod_stats?.failed_pods || 0" />
            </a-card>
          </a-col>
        </a-row>

        <a-divider />

        <a-card title="资源使用情况" size="small">
          <a-row :gutter="16">
            <a-col :span="8">
              <a-statistic
                title="CPU使用"
                :value="currentStats.resource_stats?.cpu_utilization || 0"
                suffix="%"
              />
              <div class="resource-detail">
                {{ currentStats.resource_stats?.used_cpu }} / {{ currentStats.resource_stats?.total_cpu }}
              </div>
            </a-col>
            <a-col :span="8">
              <a-statistic
                title="内存使用"
                :value="Math.round(currentStats.resource_stats?.memory_utilization || 0)"
                suffix="%"
              />
              <div class="resource-detail">
                {{ currentStats.resource_stats?.used_memory }} / {{ currentStats.resource_stats?.total_memory }}
              </div>
            </a-col>
            <a-col :span="8">
              <a-statistic
                title="存储使用"
                :value="currentStats.resource_stats?.storage_utilization || 0"
                suffix="%"
              />
              <div class="resource-detail">
                {{ currentStats.resource_stats?.used_storage }} / {{ currentStats.resource_stats?.total_storage }}
              </div>
            </a-col>
          </a-row>
        </a-card>
      </div>
    </a-drawer>
  </div>
</template>

<script lang="ts" setup>
import { ref, reactive, computed, onMounted, onUnmounted, h, nextTick } from 'vue';
import { message, Modal, type FormInstance } from 'ant-design-vue';
import type { ColumnType } from 'ant-design-vue/es/table';
import * as echarts from 'echarts';
import { 
  ClusterOutlined, 
  PlusOutlined,
  EditOutlined, 
  DeleteOutlined, 
  ReloadOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  DashboardOutlined,
  ClockCircleOutlined,
  BarChartOutlined,
  HeartOutlined,
  SyncOutlined,
  ApiOutlined,
  TagOutlined,
  ExclamationCircleOutlined,
  QuestionCircleOutlined,
  EnvironmentOutlined,
  DatabaseOutlined,
  AppstoreOutlined
} from '@ant-design/icons-vue';
import {
  Env,
  ClusterStatus,
  type K8sCluster,
  type CreateClusterReq,
  type UpdateClusterReq,
  type ClusterStats,
  type ComponentHealthStatus,
  getClustersListApi,
  getClusterDetailApi,
  createClusterApi,
  updateClusterApi,
  deleteClusterApi,
  refreshClusterApi,
  checkClusterHealthApi,
  getClusterStatsApi
} from '#/api';

// 扩展集群数据接口，包含统计和健康信息
interface ExtendedCluster extends K8sCluster {
  cluster_stats?: ClusterStats;
  component_status?: ComponentHealthStatus[];
  stats_loading?: boolean;
  health_loading?: boolean;
}

// 响应式数据
const loading = ref(false);
const submitLoading = ref(false);
const dashboardLoading = ref(false);
const clusters = ref<ExtendedCluster[]>([]);
const searchText = ref('');
const filterEnv = ref<Env | undefined>(undefined);
const filterStatus = ref<ClusterStatus | undefined>(undefined);
const selectedRows = ref<ExtendedCluster[]>([]);
const modalVisible = ref(false);
const isEdit = ref(false);
const statsDrawerVisible = ref(false);
const currentCluster = ref<ExtendedCluster | null>(null);
const currentStats = ref<ClusterStats | null>(null);
const formRef = ref<FormInstance>();
const resourceChanged = ref(false);
const originalResourceLimits = ref<{
  cpu_request?: string;
  cpu_limit?: string;
  memory_request?: string;
  memory_limit?: string;
}>({});

// 仪表板图表引用
const clusterStatusChartRef = ref<HTMLElement>();
const envDistributionChartRef = ref<HTMLElement>();
const healthStatsChartRef = ref<HTMLElement>();
const resourceUsageChartRef = ref<HTMLElement>();
const nodeStatsChartRef = ref<HTMLElement>();
const podStatsChartRef = ref<HTMLElement>();
const workloadStatsChartRef = ref<HTMLElement>();

// 分页数据
const pagination = reactive({
  current: 1,
  pageSize: 10,
  total: 0,
  showSizeChanger: true,
  showQuickJumper: true,
  showTotal: (total: number) => `共 ${total} 条数据`
});

// 表单数据
const formData = reactive<CreateClusterReq & { id?: number }>({
  name: '',
  cpu_request: '',
  cpu_limit: '',
  memory_request: '',
  memory_limit: '',
  restrict_namespace: [],
  status: ClusterStatus.Running,
  env: Env.Dev,
  version: '',
  api_server_addr: '',
  kube_config_content: '',
  action_timeout_seconds: 60,
  tags: []
});

// 表单验证规则
const formRules = {
  name: [{ required: true, message: '请输入集群名称', trigger: 'blur' }],
  env: [{ required: true, message: '请选择环境', trigger: 'change' }]
  // status 字段不需要验证，由后端自动填写
};

// 表格列配置
const columns: ColumnType<ExtendedCluster>[] = [
  {
    title: '集群名称',
    dataIndex: 'name',
    key: 'name',
    width: 200,
    slots: { customRender: 'name' }
  },
  {
    title: '环境',
    dataIndex: 'env',
    key: 'env',
    width: 100,
    slots: { customRender: 'env' },
    filters: [
      { text: '生产环境', value: Env.Prod },
      { text: '开发环境', value: Env.Dev },
      { text: '预发环境', value: Env.Stage },
      { text: '测试环境', value: Env.Rc },
      { text: '灰度环境', value: Env.Press }
    ],
    onFilter: (value, record) => record.env === value
  },
  {
    title: '状态',
    dataIndex: 'status',
    key: 'status',
    width: 100,
    slots: { customRender: 'status' }
  },
  {
    title: '版本',
    dataIndex: 'version',
    key: 'version',
    width: 100
  },
  {
    title: '资源使用',
    key: 'resources',
    width: 150,
    slots: { customRender: 'resources' }
  },
  {
    title: '健康状态',
    key: 'health',
    width: 120,
    slots: { customRender: 'health' }
  },
  {
    title: '创建时间',
    dataIndex: 'created_at',
    key: 'created_at',
    width: 150,
    slots: { customRender: 'created_at' },
    sorter: (a, b) => {
      const dateA = new Date(a.created_at || 0).getTime();
      const dateB = new Date(b.created_at || 0).getTime();
      return dateA - dateB;
    }
  },
  {
    title: '操作',
    key: 'action',
    width: 200,
    fixed: 'right',
    slots: { customRender: 'action' }
  }
];

// 计算属性
const filteredData = computed(() => {
  return clusters.value.filter(cluster => {
    const matchSearch = !searchText.value || 
      cluster.name.toLowerCase().includes(searchText.value.toLowerCase());
    const matchEnv = filterEnv.value === undefined || cluster.env === filterEnv.value;
    const matchStatus = filterStatus.value === undefined || cluster.status === filterStatus.value;
    return matchSearch && matchEnv && matchStatus;
  });
});

const runningClusters = computed(() => {
  return clusters.value.filter(c => c.status === ClusterStatus.Running).length;
});

const errorClusters = computed(() => {
  return clusters.value.filter(c => c.status === ClusterStatus.Error).length;
});

const averageResourceUsage = computed(() => {
  const validClusters = clusters.value.filter(c => c.cluster_stats?.resource_stats);
  if (validClusters.length === 0) return 0;
  
  const totalUsage = validClusters.reduce((sum, c) => {
    const stats = c.cluster_stats!.resource_stats!;
    return sum + (Math.round(stats.cpu_utilization || 0) + Math.round(stats.memory_utilization || 0)) / 2;
  }, 0);
  
  return Math.round(totalUsage / validClusters.length);
});

// 行选择配置
const rowSelection = {
  onChange: (_selectedRowKeys: number[], selectedRowsData: ExtendedCluster[]) => {
    selectedRows.value = selectedRowsData;
  }
};

// 图表实例管理
const chartInstances = new Map<HTMLElement, echarts.ECharts>();

// 创建资源使用率饼图
const createResourceChart = (container: HTMLElement, stats: ClusterStats) => {
  // 如果已有实例，先销毁
  if (chartInstances.has(container)) {
    chartInstances.get(container)?.dispose();
  }
  
  const chart = echarts.init(container);
  chartInstances.set(container, chart);
  
  const option = {
    title: {
      text: '资源使用率',
      left: 'center',
      textStyle: { 
        fontSize: 14, 
        fontWeight: 'normal',
        color: '#333'
      }
    },
    tooltip: {
      trigger: 'item',
      formatter: '{b}: {c}%',
      backgroundColor: 'rgba(255, 255, 255, 0.9)',
      borderColor: '#ddd',
      borderWidth: 1,
      textStyle: { color: '#333' }
    },
    legend: {
      orient: 'horizontal',
      bottom: '5%',
      left: 'center'
    },
    series: [{
      type: 'pie',
      radius: ['40%', '65%'],
      center: ['50%', '45%'],
      avoidLabelOverlap: false,
      data: [
        { 
          name: 'CPU使用率', 
          value: stats.resource_stats?.cpu_utilization || 0,
          itemStyle: { color: '#5470c6' }
        },
        { 
          name: '内存使用率', 
          value: stats.resource_stats?.memory_utilization || 0,
          itemStyle: { color: '#91cc75' }
        },
        { 
          name: '存储使用率', 
          value: stats.resource_stats?.storage_utilization || 0,
          itemStyle: { color: '#fac858' }
        }
      ],
      emphasis: {
        itemStyle: {
          shadowBlur: 10,
          shadowOffsetX: 0,
          shadowColor: 'rgba(0, 0, 0, 0.5)'
        }
      },
      label: {
        show: false
      },
      labelLine: {
        show: false
      }
    }],
    animation: true,
    animationDuration: 1000,
    animationDelay: function () {
      return Math.random() * 200;
    }
  };
  
  chart.setOption(option);
  
  // 响应式处理
  const resizeChart = () => chart.resize();
  window.addEventListener('resize', resizeChart);
  
  return chart;
};

// 创建Pod状态分布图
const createPodStatusChart = (container: HTMLElement, stats: ClusterStats) => {
  // 如果已有实例，先销毁
  if (chartInstances.has(container)) {
    chartInstances.get(container)?.dispose();
  }
  
  const chart = echarts.init(container);
  chartInstances.set(container, chart);
  
  const podStats = stats.pod_stats;
  const option = {
    title: {
      text: 'Pod状态分布',
      left: 'center',
      textStyle: { 
        fontSize: 14, 
        fontWeight: 'normal',
        color: '#333'
      }
    },
    tooltip: {
      trigger: 'item',
      formatter: '{b}: {c}个 ({d}%)',
      backgroundColor: 'rgba(255, 255, 255, 0.9)',
      borderColor: '#ddd',
      borderWidth: 1,
      textStyle: { color: '#333' }
    },
    legend: {
      orient: 'horizontal',
      bottom: '5%',
      left: 'center'
    },
    series: [{
      type: 'pie',
      radius: '65%',
      center: ['50%', '45%'],
      data: [
        { name: '运行中', value: podStats?.running_pods || 0, itemStyle: { color: '#52c41a' } },
        { name: '等待中', value: podStats?.pending_pods || 0, itemStyle: { color: '#faad14' } },
        { name: '失败', value: podStats?.failed_pods || 0, itemStyle: { color: '#ff4d4f' } },
        { name: '成功', value: podStats?.succeeded_pods || 0, itemStyle: { color: '#1890ff' } },
        { name: '未知', value: podStats?.unknown_pods || 0, itemStyle: { color: '#d9d9d9' } }
      ].filter(item => item.value > 0),
      emphasis: {
        itemStyle: {
          shadowBlur: 10,
          shadowOffsetX: 0,
          shadowColor: 'rgba(0, 0, 0, 0.5)'
        }
      },
      label: {
        show: false
      },
      labelLine: {
        show: false
      }
    }],
    animation: true,
    animationDuration: 1000,
    animationDelay: function (idx: number) {
      return idx * 100;
    }
  };
  
  chart.setOption(option);
  
  // 响应式处理
  const resizeChart = () => chart.resize();
  window.addEventListener('resize', resizeChart);
  
  return chart;
};

// 创建工作负载统计柱状图
const createWorkloadChart = (container: HTMLElement, stats: ClusterStats) => {
  // 如果已有实例，先销毁
  if (chartInstances.has(container)) {
    chartInstances.get(container)?.dispose();
  }
  
  const chart = echarts.init(container);
  chartInstances.set(container, chart);
  
  const workloadStats = stats.workload_stats;
  const option = {
    title: {
      text: '工作负载统计',
      left: 'center',
      textStyle: { 
        fontSize: 14, 
        fontWeight: 'normal',
        color: '#333'
      }
    },
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      backgroundColor: 'rgba(255, 255, 255, 0.9)',
      borderColor: '#ddd',
      borderWidth: 1,
      textStyle: { color: '#333' }
    },
    grid: {
      left: '3%',
      right: '4%',
      bottom: '15%',
      containLabel: true
    },
    xAxis: {
      type: 'category',
      data: ['Deployments', 'Services', 'ConfigMaps', 'Secrets', 'StatefulSets', 'DaemonSets'],
      axisLabel: { 
        rotate: 45,
        color: '#666'
      },
      axisLine: {
        lineStyle: { color: '#ddd' }
      }
    },
    yAxis: {
      type: 'value',
      axisLabel: {
        color: '#666'
      },
      axisLine: {
        lineStyle: { color: '#ddd' }
      },
      splitLine: {
        lineStyle: { color: '#f0f0f0' }
      }
    },
    series: [{
      type: 'bar',
      data: [
        workloadStats?.deployments || 0,
        workloadStats?.services || 0,
        workloadStats?.configmaps || 0,
        workloadStats?.secrets || 0,
        workloadStats?.statefulsets || 0,
        workloadStats?.daemonsets || 0
      ],
      itemStyle: {
        color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
          { offset: 0, color: '#83bff6' },
          { offset: 0.5, color: '#188df0' },
          { offset: 1, color: '#188df0' }
        ]),
        borderRadius: [4, 4, 0, 0]
      },
      emphasis: {
        itemStyle: {
          shadowBlur: 10,
          shadowOffsetX: 0,
          shadowColor: 'rgba(0, 0, 0, 0.5)'
        }
      },
      animationDelay: function (idx: number) {
        return idx * 100;
      }
    }],
    animation: true,
    animationDuration: 1000
  };
  
  chart.setOption(option);
  
  // 响应式处理
  const resizeChart = () => chart.resize();
  window.addEventListener('resize', resizeChart);
  
  return chart;
};

// 创建集群状态分布饼图 - 基于真实的集群状态数据
const createClusterStatusChart = (container: HTMLElement) => {
  if (chartInstances.has(container)) {
    chartInstances.get(container)?.dispose();
  }
  
  const chart = echarts.init(container);
  chartInstances.set(container, chart);
  
  // 统计各状态的集群数量
  const statusStats = {
    running: clusters.value.filter(c => c.status === ClusterStatus.Running).length,
    stopped: clusters.value.filter(c => c.status === ClusterStatus.Stopped).length,
    error: clusters.value.filter(c => c.status === ClusterStatus.Error).length
  };
  
  // 只显示有数据的状态
  const statusData = [
    { name: '运行中', value: statusStats.running, itemStyle: { color: '#52c41a' } },
    { name: '已停止', value: statusStats.stopped, itemStyle: { color: '#d9d9d9' } },
    { name: '异常', value: statusStats.error, itemStyle: { color: '#ff4d4f' } }
  ].filter(item => item.value > 0);
  
  // 如果没有数据，显示空状态
  if (statusData.length === 0) {
    const option = {
      title: {
        text: '暂无集群数据',
        left: 'center',
        top: 'middle',
        textStyle: {
          color: '#999',
          fontSize: 14
        }
      }
    };
    chart.setOption(option);
    return chart;
  }
  
  const option = {
    tooltip: {
      trigger: 'item',
      formatter: '{b}: {c}个 ({d}%)'
    },
    legend: {
      orient: 'horizontal',
      bottom: '10%',
      left: 'center'
    },
    series: [{
      type: 'pie',
      radius: ['40%', '70%'],
      center: ['50%', '45%'],
      data: statusData,
      emphasis: {
        itemStyle: {
          shadowBlur: 10,
          shadowOffsetX: 0,
          shadowColor: 'rgba(0, 0, 0, 0.5)'
        }
      },
      label: {
        show: false
      }
    }]
  };
  
  chart.setOption(option);
  
  const resizeChart = () => chart.resize();
  window.addEventListener('resize', resizeChart);
  
  return chart;
};

// 创建环境分布饼图 - 基于真实的集群环境数据
const createEnvDistributionChart = (container: HTMLElement) => {
  if (chartInstances.has(container)) {
    chartInstances.get(container)?.dispose();
  }
  
  const chart = echarts.init(container);
  chartInstances.set(container, chart);
  
  // 只统计有环境信息的集群
  const clustersWithEnv = clusters.value.filter(c => c.env !== undefined && c.env !== null);
  
  if (clustersWithEnv.length === 0) {
    const option = {
      title: {
        text: '暂无环境数据',
        left: 'center',
        top: 'middle',
        textStyle: {
          color: '#999',
          fontSize: 14
        }
      }
    };
    chart.setOption(option);
    return chart;
  }
  
  const envStats = clustersWithEnv.reduce((acc, cluster) => {
    const envName = getEnvName(cluster.env);
    acc[envName] = (acc[envName] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  
  const envData = Object.entries(envStats)
    .filter(([_, value]) => value > 0)
    .map(([name, value], index) => ({
      name,
      value,
      itemStyle: { 
        color: ['#1677ff', '#52c41a', '#fa8c16', '#722ed1', '#eb2f96'][index % 5] 
      }
    }));
  
  const option = {
    tooltip: {
      trigger: 'item',
      formatter: '{b}: {c}个 ({d}%)'
    },
    legend: {
      orient: 'horizontal',
      bottom: '10%',
      left: 'center'
    },
    series: [{
      type: 'pie',
      radius: '65%',
      center: ['50%', '45%'],
      data: envData,
      emphasis: {
        itemStyle: {
          shadowBlur: 10,
          shadowOffsetX: 0,
          shadowColor: 'rgba(0, 0, 0, 0.5)'
        }
      },
      label: {
        show: false
      }
    }]
  };
  
  chart.setOption(option);
  
  const resizeChart = () => chart.resize();
  window.addEventListener('resize', resizeChart);
  
  return chart;
};

// 创建组件健康状态统计图 - 基于真实的组件健康数据
const createHealthStatsChart = (container: HTMLElement) => {
  if (chartInstances.has(container)) {
    chartInstances.get(container)?.dispose();
  }
  
  const chart = echarts.init(container);
  chartInstances.set(container, chart);
  
  // 只统计有组件健康状态数据的集群
  const clustersWithHealth = clusters.value.filter(c => c.component_status && c.component_status.length > 0);
  
  if (clustersWithHealth.length === 0) {
    const option = {
      title: {
        text: '暂无组件健康数据',
        left: 'center',
        top: 'middle',
        textStyle: {
          color: '#999',
          fontSize: 14
        }
      }
    };
    chart.setOption(option);
    return chart;
  }
  
  const healthStats = clustersWithHealth.reduce((acc, cluster) => {
    cluster.component_status!.forEach(component => {
      switch (component.status.toLowerCase()) {
        case 'healthy':
          acc.healthy++;
          break;
        case 'unhealthy':
          acc.unhealthy++;
          break;
        case 'error':
          acc.error++;
          break;
        default:
          acc.unknown++;
      }
      acc.total++;
    });
    return acc;
  }, { healthy: 0, unhealthy: 0, error: 0, unknown: 0, total: 0 });
  
  const healthData = [
    { name: '正常', value: healthStats.healthy, itemStyle: { color: '#52c41a' } },
    { name: '异常', value: healthStats.unhealthy, itemStyle: { color: '#faad14' } },
    { name: '错误', value: healthStats.error, itemStyle: { color: '#ff4d4f' } },
    { name: '未知', value: healthStats.unknown, itemStyle: { color: '#d9d9d9' } }
  ].filter(item => item.value > 0);
  
  const option = {
    tooltip: {
      trigger: 'item',
      formatter: '{b}: {c}个组件 ({d}%)'
    },
    legend: {
      orient: 'horizontal',
      bottom: '10%',
      left: 'center'
    },
    series: [{
      type: 'pie',
      radius: ['30%', '60%'],
      center: ['50%', '45%'],
      data: healthData,
      emphasis: {
        itemStyle: {
          shadowBlur: 10,
          shadowOffsetX: 0,
          shadowColor: 'rgba(0, 0, 0, 0.5)'
        }
      },
      label: {
        show: false
      }
    }]
  };
  
  chart.setOption(option);
  
  const resizeChart = () => chart.resize();
  window.addEventListener('resize', resizeChart);
  
  return chart;
};

// 创建资源使用率柱状图 - 基于真实的集群资源统计数据
const createResourceUsageOverviewChart = (container: HTMLElement) => {
  if (chartInstances.has(container)) {
    chartInstances.get(container)?.dispose();
  }
  
  const chart = echarts.init(container);
  chartInstances.set(container, chart);
  
  // 只获取有资源统计数据的集群
  const clustersWithResourceStats = clusters.value.filter(c => 
    c.cluster_stats?.resource_stats && 
    (c.cluster_stats.resource_stats.cpu_utilization !== undefined ||
     c.cluster_stats.resource_stats.memory_utilization !== undefined ||
     c.cluster_stats.resource_stats.storage_utilization !== undefined)
  );
  
  if (clustersWithResourceStats.length === 0) {
    const option = {
      title: {
        text: '暂无资源使用数据',
        left: 'center',
        top: 'middle',
        textStyle: {
          color: '#999',
          fontSize: 14
        }
      }
    };
    chart.setOption(option);
    return chart;
  }
  
  const resourceData = clustersWithResourceStats.map(c => {
    const stats = c.cluster_stats!.resource_stats!;
    return {
      name: c.name,
      cpu: stats.cpu_utilization || 0,
      memory: stats.memory_utilization || 0,
      storage: stats.storage_utilization || 0
    };
  });
  
  const option = {
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      formatter: (params: any) => {
        let result = `${params[0].axisValue}<br/>`;
        params.forEach((param: any) => {
          result += `${param.marker}${param.seriesName}: ${param.value}%<br/>`;
        });
        return result;
      }
    },
    legend: {
      data: ['CPU使用率', '内存使用率', '存储使用率'],
      bottom: '5%'
    },
    grid: {
      left: '3%',
      right: '4%',
      bottom: '15%',
      containLabel: true
    },
    xAxis: {
      type: 'category',
      data: resourceData.map(d => d.name),
      axisLabel: {
        rotate: resourceData.length > 5 ? 45 : 0,
        interval: 0
      }
    },
    yAxis: {
      type: 'value',
      name: '使用率(%)',
      min: 0,
      max: 100,
      axisLabel: {
        formatter: '{value}%'
      }
    },
    series: [
      {
        name: 'CPU使用率',
        type: 'bar',
        data: resourceData.map(d => d.cpu),
        itemStyle: { color: '#1677ff' },
        barMaxWidth: 50
      },
      {
        name: '内存使用率',
        type: 'bar',
        data: resourceData.map(d => d.memory),
        itemStyle: { color: '#52c41a' },
        barMaxWidth: 50
      },
      {
        name: '存储使用率',
        type: 'bar',
        data: resourceData.map(d => d.storage),
        itemStyle: { color: '#faad14' },
        barMaxWidth: 50
      }
    ]
  };
  
  chart.setOption(option);
  
  const resizeChart = () => chart.resize();
  window.addEventListener('resize', resizeChart);
  
  return chart;
};

// 创建节点统计图 - 基于真实的节点统计数据
const createNodeStatsChart = (container: HTMLElement) => {
  if (chartInstances.has(container)) {
    chartInstances.get(container)?.dispose();
  }
  
  const chart = echarts.init(container);
  chartInstances.set(container, chart);
  
  // 获取有节点统计数据的集群
  const clustersWithNodeStats = clusters.value.filter(c => c.cluster_stats?.node_stats);
  
  if (clustersWithNodeStats.length === 0) {
    const option = {
      title: {
        text: '暂无节点统计数据',
        left: 'center',
        top: 'middle',
        textStyle: {
          color: '#999',
          fontSize: 14
        }
      }
    };
    chart.setOption(option);
    return chart;
  }
  
  const nodeData = clustersWithNodeStats.map(c => {
    const stats = c.cluster_stats!.node_stats!;
    return {
      name: c.name,
      total: stats.total_nodes || 0,
      ready: stats.ready_nodes || 0,
      notReady: stats.not_ready_nodes || 0,
      master: stats.master_nodes || 0,
      worker: stats.worker_nodes || 0
    };
  });
  
  const option = {
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' }
    },
    legend: {
      data: ['就绪节点', '未就绪节点'],
      bottom: '5%'
    },
    grid: {
      left: '3%',
      right: '4%',
      bottom: '15%',
      containLabel: true
    },
    xAxis: {
      type: 'category',
      data: nodeData.map(d => d.name),
      axisLabel: {
        rotate: nodeData.length > 5 ? 45 : 0,
        interval: 0
      }
    },
    yAxis: {
      type: 'value',
      name: '节点数量'
    },
    series: [
      {
        name: '就绪节点',
        type: 'bar',
        stack: 'status',
        data: nodeData.map(d => d.ready),
        itemStyle: { color: '#52c41a' }
      },
      {
        name: '未就绪节点',
        type: 'bar',
        stack: 'status',
        data: nodeData.map(d => d.notReady),
        itemStyle: { color: '#ff4d4f' }
      }
    ]
  };
  
  chart.setOption(option);
  
  const resizeChart = () => chart.resize();
  window.addEventListener('resize', resizeChart);
  
  return chart;
};

// 创建Pod统计图 - 基于真实的Pod统计数据
const createPodStatsChart = (container: HTMLElement) => {
  if (chartInstances.has(container)) {
    chartInstances.get(container)?.dispose();
  }
  
  const chart = echarts.init(container);
  chartInstances.set(container, chart);
  
  // 获取有Pod统计数据的集群
  const clustersWithPodStats = clusters.value.filter(c => c.cluster_stats?.pod_stats);
  
  if (clustersWithPodStats.length === 0) {
    const option = {
      title: {
        text: '暂无Pod统计数据',
        left: 'center',
        top: 'middle',
        textStyle: {
          color: '#999',
          fontSize: 14
        }
      }
    };
    chart.setOption(option);
    return chart;
  }
  
  // 汇总所有集群的Pod统计
  const podStats = clustersWithPodStats.reduce((acc, cluster) => {
    const stats = cluster.cluster_stats!.pod_stats!;
    acc.running += stats.running_pods || 0;
    acc.pending += stats.pending_pods || 0;
    acc.succeeded += stats.succeeded_pods || 0;
    acc.failed += stats.failed_pods || 0;
    acc.unknown += stats.unknown_pods || 0;
    return acc;
  }, { running: 0, pending: 0, succeeded: 0, failed: 0, unknown: 0 });
  
  const podData = [
    { name: '运行中', value: podStats.running, itemStyle: { color: '#52c41a' } },
    { name: '等待中', value: podStats.pending, itemStyle: { color: '#faad14' } },
    { name: '成功', value: podStats.succeeded, itemStyle: { color: '#1677ff' } },
    { name: '失败', value: podStats.failed, itemStyle: { color: '#ff4d4f' } },
    { name: '未知', value: podStats.unknown, itemStyle: { color: '#d9d9d9' } }
  ].filter(item => item.value > 0);
  
  const option = {
    tooltip: {
      trigger: 'item',
      formatter: '{b}: {c}个Pod ({d}%)'
    },
    legend: {
      orient: 'horizontal',
      bottom: '10%',
      left: 'center'
    },
    series: [{
      type: 'pie',
      radius: ['40%', '70%'],
      center: ['50%', '45%'],
      data: podData,
      emphasis: {
        itemStyle: {
          shadowBlur: 10,
          shadowOffsetX: 0,
          shadowColor: 'rgba(0, 0, 0, 0.5)'
        }
      },
      label: {
        show: false
      }
    }]
  };
  
  chart.setOption(option);
  
  const resizeChart = () => chart.resize();
  window.addEventListener('resize', resizeChart);
  
  return chart;
};

// 创建工作负载统计图 - 基于真实的工作负载统计数据
const createWorkloadStatsChart = (container: HTMLElement) => {
  if (chartInstances.has(container)) {
    chartInstances.get(container)?.dispose();
  }
  
  const chart = echarts.init(container);
  chartInstances.set(container, chart);
  
  // 获取有工作负载统计数据的集群
  const clustersWithWorkloadStats = clusters.value.filter(c => c.cluster_stats?.workload_stats);
  
  if (clustersWithWorkloadStats.length === 0) {
    const option = {
      title: {
        text: '暂无工作负载统计数据',
        left: 'center',
        top: 'middle',
        textStyle: {
          color: '#999',
          fontSize: 14
        }
      }
    };
    chart.setOption(option);
    return chart;
  }
  
  // 汇总所有集群的工作负载统计
  const workloadStats = clustersWithWorkloadStats.reduce((acc, cluster) => {
    const stats = cluster.cluster_stats!.workload_stats!;
    acc.deployments += stats.deployments || 0;
    acc.statefulsets += stats.statefulsets || 0;
    acc.daemonsets += stats.daemonsets || 0;
    acc.jobs += stats.jobs || 0;
    acc.cronjobs += stats.cronjobs || 0;
    acc.services += stats.services || 0;
    acc.configmaps += stats.configmaps || 0;
    acc.secrets += stats.secrets || 0;
    acc.ingresses += stats.ingresses || 0;
    return acc;
  }, { 
    deployments: 0, 
    statefulsets: 0, 
    daemonsets: 0, 
    jobs: 0, 
    cronjobs: 0, 
    services: 0, 
    configmaps: 0, 
    secrets: 0, 
    ingresses: 0 
  });
  
  const workloadData = [
    { name: 'Deployments', value: workloadStats.deployments },
    { name: 'StatefulSets', value: workloadStats.statefulsets },
    { name: 'DaemonSets', value: workloadStats.daemonsets },
    { name: 'Jobs', value: workloadStats.jobs },
    { name: 'CronJobs', value: workloadStats.cronjobs },
    { name: 'Services', value: workloadStats.services },
    { name: 'ConfigMaps', value: workloadStats.configmaps },
    { name: 'Secrets', value: workloadStats.secrets },
    { name: 'Ingresses', value: workloadStats.ingresses }
  ].filter(item => item.value > 0);
  
  const option = {
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' }
    },
    grid: {
      left: '3%',
      right: '4%',
      bottom: '3%',
      containLabel: true
    },
    xAxis: {
      type: 'category',
      data: workloadData.map(d => d.name),
      axisLabel: {
        rotate: 45,
        interval: 0
      }
    },
    yAxis: {
      type: 'value',
      name: '数量'
    },
    series: [{
      type: 'bar',
      data: workloadData.map(d => d.value),
      itemStyle: { color: '#1677ff' },
      barMaxWidth: 50
    }]
  };
  
  chart.setOption(option);
  
  const resizeChart = () => chart.resize();
  window.addEventListener('resize', resizeChart);
  
  return chart;
};



// 初始化仪表板图表
const initDashboardCharts = () => {
  nextTick(() => {
    if (clusterStatusChartRef.value) {
      createClusterStatusChart(clusterStatusChartRef.value);
    }
    if (envDistributionChartRef.value) {
      createEnvDistributionChart(envDistributionChartRef.value);
    }
    if (healthStatsChartRef.value) {
      createHealthStatsChart(healthStatsChartRef.value);
    }
    if (resourceUsageChartRef.value) {
      createResourceUsageOverviewChart(resourceUsageChartRef.value);
    }
    if (nodeStatsChartRef.value) {
      createNodeStatsChart(nodeStatsChartRef.value);
    }
    if (podStatsChartRef.value) {
      createPodStatsChart(podStatsChartRef.value);
    }
    if (workloadStatsChartRef.value) {
      createWorkloadStatsChart(workloadStatsChartRef.value);
    }
  });
};

// 刷新仪表板
const refreshDashboard = async () => {
  dashboardLoading.value = true;
  try {
    await fetchClusters();
    // 加载所有集群的健康状态和统计信息
    const promises = clusters.value.map(async (cluster) => {
      if (cluster.id) {
        await Promise.all([
          loadClusterStats(cluster),
          loadClusterHealth(cluster)
        ]);
      }
    });
    await Promise.all(promises);
    
    // 重新初始化图表
    initDashboardCharts();
    message.success('仪表板刷新完成');
  } catch (error: any) {
    message.error(error.message || '仪表板刷新失败');
  } finally {
    dashboardLoading.value = false;
  }
};



// 展开行渲染
const expandedRowRender = (record: ExtendedCluster) => {
  if (!record.cluster_stats) {
    if (record.stats_loading) {
      return h('div', { style: 'padding: 20px; text-align: center; color: #999' }, [
        h('span', { class: 'ant-spin-dot ant-spin-dot-spin' }),
        h('span', { style: 'margin-left: 8px' }, '正在加载统计数据...')
      ]);
    }
    return h('div', { 
      style: 'padding: 20px; text-align: center; color: #999' 
    }, [
      h('span', '暂无统计数据'),
      h('a-button', { 
        type: 'link', 
        size: 'small',
        onClick: () => loadClusterStats(record)
      }, '点击加载')
    ]);
  }

  const stats = record.cluster_stats;
  
  return h('div', { class: 'expanded-content', style: 'padding: 20px' }, [
    h('h4', { style: 'margin-bottom: 20px; color: #1890ff' }, '集群统计信息'),
    
    // 基础统计信息卡片
    h('div', { 
      style: 'display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px; margin-bottom: 24px' 
    }, [
      // 节点统计卡片
      h('div', { class: 'stat-info-card' }, [
        h('div', { class: 'stat-card-header' }, [
          h('span', { class: 'stat-card-icon', style: 'background-color: #52c41a' }, '🖥️'),
          h('span', { class: 'stat-card-title' }, '节点统计')
        ]),
        h('div', { class: 'stat-card-content' }, [
          h('div', { class: 'stat-item' }, [
            h('span', '总节点: '),
            h('strong', stats.node_stats?.total_nodes || 0)
          ]),
          h('div', { class: 'stat-item' }, [
            h('span', '就绪节点: '),
            h('strong', { style: 'color: #52c41a' }, stats.node_stats?.ready_nodes || 0)
          ]),
          h('div', { class: 'stat-item' }, [
            h('span', '主节点: '),
            h('strong', stats.node_stats?.master_nodes || 0)
          ]),
          h('div', { class: 'stat-item' }, [
            h('span', '工作节点: '),
            h('strong', stats.node_stats?.worker_nodes || 0)
          ])
        ])
      ]),
      
      // 存储统计卡片
      h('div', { class: 'stat-info-card' }, [
        h('div', { class: 'stat-card-header' }, [
          h('span', { class: 'stat-card-icon', style: 'background-color: #fa8c16' }, '💾'),
          h('span', { class: 'stat-card-title' }, '存储统计')
        ]),
        h('div', { class: 'stat-card-content' }, [
          h('div', { class: 'stat-item' }, [
            h('span', 'PV总数: '),
            h('strong', stats.storage_stats?.total_pv || 0)
          ]),
          h('div', { class: 'stat-item' }, [
            h('span', '已绑定PV: '),
            h('strong', { style: 'color: #52c41a' }, stats.storage_stats?.bound_pv || 0)
          ]),
          h('div', { class: 'stat-item' }, [
            h('span', 'PVC总数: '),
            h('strong', stats.storage_stats?.total_pvc || 0)
          ]),
          h('div', { class: 'stat-item' }, [
            h('span', '存储类: '),
            h('strong', stats.storage_stats?.storage_classes || 0)
          ])
        ])
      ]),
      
      // 网络统计卡片
      h('div', { class: 'stat-info-card' }, [
        h('div', { class: 'stat-card-header' }, [
          h('span', { class: 'stat-card-icon', style: 'background-color: #1890ff' }, '🌐'),
          h('span', { class: 'stat-card-title' }, '网络统计')
        ]),
        h('div', { class: 'stat-card-content' }, [
          h('div', { class: 'stat-item' }, [
            h('span', 'Services: '),
            h('strong', stats.network_stats?.services || 0)
          ]),
          h('div', { class: 'stat-item' }, [
            h('span', 'Endpoints: '),
            h('strong', stats.network_stats?.endpoints || 0)
          ]),
          h('div', { class: 'stat-item' }, [
            h('span', 'Ingresses: '),
            h('strong', stats.network_stats?.ingresses || 0)
          ]),
          h('div', { class: 'stat-item' }, [
            h('span', '网络策略: '),
            h('strong', stats.network_stats?.network_policies || 0)
          ])
        ])
      ]),
      
      // 事件统计卡片
      h('div', { class: 'stat-info-card' }, [
        h('div', { class: 'stat-card-header' }, [
          h('span', { class: 'stat-card-icon', style: 'background-color: #722ed1' }, '📊'),
          h('span', { class: 'stat-card-title' }, '事件统计')
        ]),
        h('div', { class: 'stat-card-content' }, [
          h('div', { class: 'stat-item' }, [
            h('span', '总事件: '),
            h('strong', stats.event_stats?.total_events || 0)
          ]),
          h('div', { class: 'stat-item' }, [
            h('span', '警告事件: '),
            h('strong', { style: 'color: #faad14' }, stats.event_stats?.warning_events || 0)
          ]),
          h('div', { class: 'stat-item' }, [
            h('span', '正常事件: '),
            h('strong', { style: 'color: #52c41a' }, stats.event_stats?.normal_events || 0)
          ]),
          h('div', { class: 'stat-item' }, [
            h('span', '最近事件: '),
            h('strong', stats.event_stats?.recent_events || 0)
          ])
        ])
      ])
    ]),
    
    // 图表区域
    h('div', { 
      style: 'display: grid; grid-template-columns: repeat(auto-fit, minmax(350px, 1fr)); gap: 20px' 
    }, [
      // 资源使用率饼图
      h('div', { 
        class: 'chart-container resource-chart',
        style: 'height: 300px; background: #fafafa; border-radius: 8px; padding: 16px',
        onVnodeMounted: (vnode: any) => {
          if (vnode.el) {
            nextTick(() => createResourceChart(vnode.el, stats));
          }
        }
      }),
      
      // Pod状态分布图
      h('div', { 
        class: 'chart-container pod-chart',
        style: 'height: 300px; background: #fafafa; border-radius: 8px; padding: 16px',
        onVnodeMounted: (vnode: any) => {
          if (vnode.el) {
            nextTick(() => createPodStatusChart(vnode.el, stats));
          }
        }
      }),
      
      // 工作负载统计柱状图
      h('div', { 
        class: 'chart-container workload-chart',
        style: 'height: 300px; background: #fafafa; border-radius: 8px; padding: 16px',
        onVnodeMounted: (vnode: any) => {
          if (vnode.el) {
            nextTick(() => createWorkloadChart(vnode.el, stats));
          }
        }
      })
    ])
  ]);
};

// 获取集群列表
const fetchClusters = async (resetPage: boolean = false) => {
  loading.value = true;
  try {
    if (resetPage) {
      pagination.current = 1;
    }
    
    const params = {
      page: pagination.current,
      size: pagination.pageSize,
      status: filterStatus.value ? String(filterStatus.value) : undefined,
      env: filterEnv.value ? String(filterEnv.value) : undefined
    };
    const res = await getClustersListApi(params);
    if (res) {
      clusters.value = res.items.map((cluster: K8sCluster) => ({ 
        ...cluster,
        stats_loading: false,
        health_loading: false
      } as ExtendedCluster));
      pagination.total = res.length; // 如果没有total字段，这里可能需要调整
    } else {
      clusters.value = (res.items || []).map((cluster: K8sCluster) => ({ 
        ...cluster,
        stats_loading: false,
        health_loading: false
      } as ExtendedCluster));
      pagination.total = res.total || 0;
    }
  } catch (error: any) {
    message.error(error.message || '获取集群列表失败');
  } finally {
    loading.value = false;
  }
};

// 加载集群统计数据
const loadClusterStats = async (cluster: ExtendedCluster) => {
  if (!cluster.id || cluster.stats_loading) return;
  
  const targetCluster = clusters.value.find(c => c.id === cluster.id);
  if (!targetCluster) return;
  
  targetCluster.stats_loading = true;
  try {
    const stats = await getClusterStatsApi(cluster.id);
    targetCluster.cluster_stats = stats as unknown as ClusterStats;
  } catch (error: any) {
    message.error(`获取集群 ${cluster.name} 统计信息失败: ${error.message}`);
  } finally {
    targetCluster.stats_loading = false;
  }
};

// 加载集群健康状态
const loadClusterHealth = async (cluster: ExtendedCluster) => {
  if (!cluster.id || cluster.health_loading) return;
  
  const targetCluster = clusters.value.find(c => c.id === cluster.id);
  if (!targetCluster) return;
  
  targetCluster.health_loading = true;
  try {
    const health = await checkClusterHealthApi(cluster.id);
    targetCluster.component_status = health.items as unknown as ComponentHealthStatus[];
  } catch (error: any) {
    message.error(`获取集群 ${cluster.name} 健康状态失败: ${error.message}`);
  } finally {
    targetCluster.health_loading = false;
  }
};

// 表格分页变化处理
const handleTableChange = (pag: any) => {
  pagination.current = pag.current;
  pagination.pageSize = pag.pageSize;
  fetchClusters();
};

// 获取环境名称
const getEnvName = (env?: Env): string => {
  const envMap: Record<Env, string> = {
    [Env.Prod]: '生产环境',
    [Env.Dev]: '开发环境',
    [Env.Stage]: '预发环境',
    [Env.Rc]: '测试环境',
    [Env.Press]: '灰度环境'
  };
  return env ? envMap[env] : '未知';
};

// 获取环境颜色
const getEnvColor = (env?: Env): string => {
  const colorMap: Record<Env, string> = {
    [Env.Prod]: 'red',
    [Env.Dev]: 'blue',
    [Env.Stage]: 'orange',
    [Env.Rc]: 'green',
    [Env.Press]: 'purple'
  };
  return env ? colorMap[env] : 'default';
};

// 获取状态名称
const getStatusName = (status: ClusterStatus): string => {
  const statusMap: Record<ClusterStatus, string> = {
    [ClusterStatus.Running]: '运行中',
    [ClusterStatus.Stopped]: '已停止',
    [ClusterStatus.Error]: '异常'
  };
  return statusMap[status] || '未知';
};

// 获取状态徽标类型
const getStatusBadgeType = (status: ClusterStatus): string => {
  const typeMap: Record<ClusterStatus, string> = {
    [ClusterStatus.Running]: 'success',
    [ClusterStatus.Stopped]: 'default',
    [ClusterStatus.Error]: 'error'
  };
  return typeMap[status] || 'default';
};

// 获取进度条颜色
const getProgressColor = (percent: number): string => {
  if (percent < 60) return '#52c41a';
  if (percent < 80) return '#faad14';
  return '#ff4d4f';
};

// 获取健康状态颜色
const getHealthColor = (components: any[]): string => {
  if (!components || components.length === 0) return 'default';
  const hasError = components.some(c => c.status === 'error');
  const hasUnhealthy = components.some(c => c.status === 'unhealthy');
  if (hasError) return 'red';
  if (hasUnhealthy) return 'orange';
  return 'green';
};

// 获取健康状态摘要
const getHealthSummary = (components: any[]): string => {
  if (!components || components.length === 0) return '未知';
  const healthy = components.filter(c => c.status === 'healthy').length;
  return `${healthy}/${components.length} 正常`;
};

// 格式化日期
const formatDate = (dateString?: string): string => {
  if (!dateString) return '-';
  const date = new Date(dateString);
  return `${date.getMonth() + 1}月${date.getDate()}日 ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
};

// 格式化日期时间
const formatDateTime = (dateString?: string): string => {
  if (!dateString) return '-';
  const date = new Date(dateString);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}:${String(date.getSeconds()).padStart(2, '0')}`;
};

// 搜索处理
const onSearch = () => {
  // 搜索时自动触发过滤
};

// 环境筛选变化
const onEnvFilterChange = () => {
  fetchClusters(true);
};

// 状态筛选变化
const onStatusFilterChange = () => {
  fetchClusters(true);
};

// 刷新全部
const refreshAll = () => {
  searchText.value = '';
  filterEnv.value = undefined;
  filterStatus.value = undefined;
  selectedRows.value = [];
  fetchClusters(true);
};

// 显示新增模态框
const showAddModal = () => {
  isEdit.value = false;
  resetForm();
  modalVisible.value = true;
};

// 编辑集群
const editCluster = async (record: ExtendedCluster) => {
  isEdit.value = true;
  loading.value = true;
  try {
    const res = await getClusterDetailApi(record.id!);
    
    // 记录原始资源限制值
    originalResourceLimits.value = {
      cpu_request: res.cpu_request || '',
      cpu_limit: res.cpu_limit || '',
      memory_request: res.memory_request || '',
      memory_limit: res.memory_limit || ''
    };
    
    Object.assign(formData, {
      id: res.id,
      name: res.name,
      cpu_request: res.cpu_request || '',
      cpu_limit: res.cpu_limit || '',
      memory_request: res.memory_request || '',
      memory_limit: res.memory_limit || '',
      restrict_namespace: res.restrict_namespace || [],
      status: res.status,
      env: res.env,
      version: res.version || '',
      api_server_addr: res.api_server_addr || '',
      kube_config_content: res.kube_config_content || '',
      action_timeout_seconds: res.action_timeout_seconds || 60,
      tags: res.tags || []
    });
    
    // 重置资源变更标记
    resourceChanged.value = false;
    modalVisible.value = true;
  } catch (error: any) {
    message.error(error.message || '获取集群详情失败');
  } finally {
    loading.value = false;
  }
};

// 删除集群
const deleteCluster = async (record: ExtendedCluster) => {
  loading.value = true;
  try {
    await deleteClusterApi(record.id!);
    message.success('删除成功');
    fetchClusters();
  } catch (error: any) {
    message.error(error.message || '删除失败');
  } finally {
    loading.value = false;
  }
};

// 批量删除确认
const showBatchDeleteConfirm = () => {
  if (selectedRows.value.length === 0) {
    message.warning('请先选择要删除的集群');
    return;
  }
  
  Modal.confirm({
    title: `确定要删除选中的 ${selectedRows.value.length} 个集群吗?`,
    content: '此操作不可恢复',
    okType: 'danger',
    async onOk() {
      loading.value = true;
      try {
        for (const row of selectedRows.value) {
          await deleteClusterApi(row.id!);
        }
        message.success(`成功删除 ${selectedRows.value.length} 个集群`);
        selectedRows.value = [];
        fetchClusters();
      } catch (error: any) {
        message.error(error.message || '批量删除失败');
      } finally {
        loading.value = false;
      }
    }
  });
};

// 查看集群详情
const viewClusterDetail = (record: ExtendedCluster) => {
  console.log('查看集群详情:', record);
  // 可以展开行或跳转到详情页
};

// 查看统计
const viewStats = async (record: ExtendedCluster) => {
  loading.value = true;
  try {
    const stats = await getClusterStatsApi(record.id!);
    currentCluster.value = record;
    currentStats.value = stats as unknown as ClusterStats;
    statsDrawerVisible.value = true;
  } catch (error: any) {
    message.error(error.message || '获取统计信息失败');
  } finally {
    loading.value = false;
  }
};

// 健康检查
const checkHealth = async (record: ExtendedCluster) => {
  const hide = message.loading('正在检查健康状态...', 0);
  try {
    await loadClusterHealth(record);
    hide();
    message.success('健康检查完成');
  } catch (error: any) {
    hide();
    message.error(error.message || '健康检查失败');
  }
};

// 刷新集群
const refreshCluster = async (record: ExtendedCluster) => {
  const hide = message.loading('正在刷新集群状态...', 0);
  try {
    await refreshClusterApi(record.id!);
    hide();
    message.success('刷新成功');
    // 同时刷新统计和健康状态
    await Promise.all([
      loadClusterStats(record),
      loadClusterHealth(record)
    ]);
  } catch (error: any) {
    hide();
    message.error(error.message || '刷新失败');
  }
};

// 提交表单
const handleSubmit = async () => {
  try {
    await formRef.value?.validateFields();
    
    // 如果是编辑操作且资源限制发生变化，需要二次确认
    const confirmed = await showResourceLimitConfirm();
    if (!confirmed) {
      return;
    }
    
    submitLoading.value = true;
    
    if (isEdit.value) {
      const updateData: UpdateClusterReq = {
        ...formData,
        id: formData.id!
      };
      await updateClusterApi(formData.id!, updateData);
      message.success('更新成功');
    } else {
      await createClusterApi(formData as CreateClusterReq);
      message.success('创建成功');
    }
    
    modalVisible.value = false;
    resourceChanged.value = false; // 重置资源变更标记
    fetchClusters();
  } catch (error: any) {
    if (!error.errorFields) {
      message.error(error.message || (isEdit.value ? '更新失败' : '创建失败'));
    }
  } finally {
    submitLoading.value = false;
  }
};

// 关闭模态框
const closeModal = () => {
  modalVisible.value = false;
  resetForm();
};

// 重置表单
const resetForm = () => {
  formRef.value?.resetFields();
  Object.assign(formData, {
    id: undefined,
    name: '',
    cpu_request: '',
    cpu_limit: '',
    memory_request: '',
    memory_limit: '',
    restrict_namespace: [],
    status: ClusterStatus.Running,
    env: Env.Dev,
    version: '',
    api_server_addr: '',
    kube_config_content: '',
    action_timeout_seconds: 60,
    tags: []
  });
  
  // 重置资源限制相关状态
  resourceChanged.value = false;
  originalResourceLimits.value = {};
};

// 添加标签
const addTag = () => {
  if (!formData.tags) {
    formData.tags = [];
  }
  formData.tags.push({ key: '', value: '' });
};

// 删除标签
const removeTag = (index: number) => {
  formData.tags?.splice(index, 1);
};

// 处理资源限制变更
const handleResourceChange = () => {
  const current = {
    cpu_request: formData.cpu_request,
    cpu_limit: formData.cpu_limit,
    memory_request: formData.memory_request,
    memory_limit: formData.memory_limit
  };
  
  resourceChanged.value = isEdit.value && (
    current.cpu_request !== originalResourceLimits.value.cpu_request ||
    current.cpu_limit !== originalResourceLimits.value.cpu_limit ||
    current.memory_request !== originalResourceLimits.value.memory_request ||
    current.memory_limit !== originalResourceLimits.value.memory_limit
  );
};

// 显示资源限制确认对话框
const showResourceLimitConfirm = (): Promise<boolean> => {
  return new Promise((resolve) => {
    if (!resourceChanged.value) {
      resolve(true);
      return;
    }
    
    Modal.confirm({
      title: '⚠️ 确认修改资源限制',
      icon: h(ExclamationCircleOutlined, { style: { color: '#ff4d4f' } }),
      content: h('div', { style: 'line-height: 1.6' }, [
        h('p', { style: 'margin-bottom: 12px; font-weight: 500; color: #ff4d4f' }, 
          '您正在修改集群的资源限制，这是一个危险操作！'
        ),
        h('div', { style: 'background: #fff7e6; padding: 12px; border-radius: 6px; border-left: 4px solid #faad14; margin: 12px 0' }, [
          h('p', { style: 'margin: 0; color: #d46b08; font-weight: 500' }, '风险提示：'),
          h('ul', { style: 'margin: 8px 0 0 0; color: #d46b08' }, [
            h('li', '资源限制过低可能导致Pod启动失败或运行异常'),
            h('li', '资源限制过高可能造成资源浪费'),
            h('li', '不当的资源配置可能影响整个集群的稳定性')
          ])
        ]),
        h('p', { style: 'margin: 16px 0 8px 0; font-weight: 500' }, '变更详情：'),
        h('div', { style: 'background: #f6f6f6; padding: 12px; border-radius: 4px; font-family: monospace; font-size: 12px' }, [
          originalResourceLimits.value.cpu_request !== formData.cpu_request ? 
            h('div', [`CPU请求: ${originalResourceLimits.value.cpu_request || '未设置'} → ${formData.cpu_request || '未设置'}`]) : null,
          originalResourceLimits.value.cpu_limit !== formData.cpu_limit ? 
            h('div', [`CPU限制: ${originalResourceLimits.value.cpu_limit || '未设置'} → ${formData.cpu_limit || '未设置'}`]) : null,
          originalResourceLimits.value.memory_request !== formData.memory_request ? 
            h('div', [`内存请求: ${originalResourceLimits.value.memory_request || '未设置'} → ${formData.memory_request || '未设置'}`]) : null,
          originalResourceLimits.value.memory_limit !== formData.memory_limit ? 
            h('div', [`内存限制: ${originalResourceLimits.value.memory_limit || '未设置'} → ${formData.memory_limit || '未设置'}`]) : null
        ].filter(Boolean)),
        h('p', { style: 'margin: 16px 0 0 0; color: #1890ff; font-weight: 500' }, 
          '请确认您已充分了解风险并准备好承担后果。'
        )
      ]),
      okText: '我已了解风险，确认修改',
      cancelText: '取消操作',
      okType: 'danger',
      width: 600,
      onOk() {
        resolve(true);
      },
      onCancel() {
        resolve(false);
      }
    });
  });
};

// 组件挂载
onMounted(async () => {
  await fetchClusters();
  // 自动刷新仪表板
  await refreshDashboard();
});

// 组件销毁时清理图表实例
onUnmounted(() => {
  chartInstances.forEach((chart) => {
    chart.dispose();
  });
  chartInstances.clear();
});
</script>

<style scoped>
/* 保持原有样式系统 */
.cluster-management-container {
  min-height: 100vh;
  background: #f5f5f5;
  padding: 24px;
}

.page-header {
  background: #fff;
  border-radius: 8px;
  margin-bottom: 24px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
}

.header-content {
  padding: 32px 40px;
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
}

.title-section {
  flex: 1;
}

.page-title {
  display: flex;
  align-items: center;
  margin-bottom: 8px;
}

.title-icon {
  font-size: 28px;
  color: #1677ff;
  margin-right: 16px;
}

.page-title h1 {
  font-size: 24px;
  font-weight: 600;
  margin: 0;
}

.page-subtitle {
  font-size: 14px;
  color: #00000073;
  margin: 0;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 16px;
}

.overview-cards {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  gap: 20px;
  margin-bottom: 32px;
}

.overview-card {
  background: #fff;
  border-radius: 8px;
  padding: 24px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
  display: flex;
  align-items: center;
  transition: all 0.3s;
  border: 1px solid #f0f0f0;
}

.overview-card:hover {
  box-shadow: 0 6px 16px rgba(0, 0, 0, 0.08);
  transform: translateY(-2px);
}

.card-icon {
  width: 48px;
  height: 48px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
  margin-right: 16px;
}

.total-clusters .card-icon {
  background: rgba(22, 119, 255, 0.1);
  color: #1677ff;
}

.running-clusters .card-icon {
  background: rgba(82, 196, 26, 0.1);
  color: #52c41a;
}

.error-clusters .card-icon {
  background: rgba(255, 77, 79, 0.1);
  color: #ff4d4f;
}

.resource-usage .card-icon {
  background: rgba(114, 46, 209, 0.1);
  color: #722ed1;
}

.card-info {
  flex: 1;
}

.card-number {
  font-size: 20px;
  font-weight: 600;
  margin-bottom: 4px;
}

.card-label {
  font-size: 14px;
  color: #00000073;
}

.toolbar {
  background: #fff;
  border-radius: 8px;
  padding: 20px 24px;
  margin-bottom: 24px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 20px;
}

.toolbar-left {
  display: flex;
  gap: 16px;
  align-items: center;
  flex: 1;
}

.toolbar-right {
  display: flex;
  gap: 12px;
  align-items: center;
}

.search-input {
  width: 320px;
}

.env-filter,
.status-filter {
  width: 160px;
}

.data-display {
  background: #fff;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
  overflow: hidden;
}

.cluster-name {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 500;
}

.cluster-name a {
  color: #1677ff;
  text-decoration: none;
  cursor: pointer;
}

.cluster-name a:hover {
  color: #4096ff;
}

.action-buttons {
  display: flex;
  gap: 6px;
  align-items: center;
  justify-content: flex-start;
}

.action-buttons .ant-btn {
  height: 32px;
  width: 32px;
  border-radius: 8px;
  border: 1px solid rgba(0, 0, 0, 0.06);
  background: #ffffff;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.02);
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  position: relative;
  overflow: hidden;
}

.action-buttons .ant-btn:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
  border-color: rgba(24, 144, 255, 0.3);
  background: linear-gradient(145deg, #ffffff 0%, #f8fafc 100%);
  z-index: 10;
}

.action-buttons .ant-btn:active {
  transform: translateY(0);
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.04);
}

.action-buttons .ant-btn-primary.ant-btn-dangerous {
  border-color: rgba(255, 77, 79, 0.2);
}

.action-buttons .ant-btn-primary.ant-btn-dangerous:hover {
  border-color: rgba(255, 77, 79, 0.4);
  background: linear-gradient(145deg, #ffffff 0%, #fef2f2 100%);
}

.action-buttons .ant-btn .anticon {
  font-size: 14px;
  color: #64748b;
  transition: color 0.3s ease;
}

.action-buttons .ant-btn:hover .anticon {
  color: #1677ff;
}

.action-buttons .ant-btn-primary.ant-btn-dangerous:hover .anticon {
  color: #ff4d4f;
}

.resource-stats {
  min-width: 120px;
}

.no-data {
  color: #999;
}

.health-tooltip-item {
  display: flex;
  justify-content: space-between;
  margin-bottom: 4px;
}

.health-tooltip-item .status {
  font-weight: 500;
}

.health-tooltip-item .status.healthy {
  color: #52c41a;
}

.health-tooltip-item .status.unhealthy {
  color: #faad14;
}

.health-tooltip-item .status.error {
  color: #ff4d4f;
}

.cluster-modal :deep(.ant-modal-content) {
  border-radius: 8px;
}

.cluster-form {
  padding: 8px 0;
}

.tag-input-group {
  margin-bottom: 8px;
}

/* 资源限制相关样式 */
.resource-limit-title {
  display: flex;
  align-items: center;
  gap: 8px;
  color: #ff4d4f;
  font-weight: 600;
}

.resource-limit-title .danger-icon {
  color: #ff4d4f;
  font-size: 16px;
  animation: pulse 2s infinite;
}

.resource-warning-alert {
  margin-bottom: 24px;
  border: 2px solid #faad14;
  border-radius: 8px;
}

.resource-warning-alert :deep(.ant-alert-message) {
  font-weight: 600;
  color: #d46b08;
}

.resource-warning-alert :deep(.ant-alert-description) {
  color: #d46b08;
  line-height: 1.6;
}

/* 脉搏动画效果 */
@keyframes pulse {
  0% {
    transform: scale(1);
    opacity: 1;
  }
  50% {
    transform: scale(1.1);
    opacity: 0.7;
  }
  100% {
    transform: scale(1);
    opacity: 1;
  }
}

/* 字段提示样式 */
.field-hint {
  font-size: 12px;
  color: #8c8c8c;
  margin-top: 4px;
  font-style: italic;
}

.expanded-content .stat-card {
  padding: 12px;
  border: 1px solid #f0f0f0;
  border-radius: 6px;
  background: #fafafa;
}

.expanded-content .stat-card h5 {
  margin: 0 0 12px 0;
  font-weight: 600;
  color: #000000d9;
}

.expanded-content .stat-card div {
  margin-bottom: 8px;
  color: #00000073;
}

.stats-detail .resource-detail {
  color: #00000073;
  font-size: 12px;
  margin-top: 4px;
}

/* 新的统计卡片样式 */
.stat-info-card {
  background: white;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  overflow: hidden;
  transition: all 0.3s ease;
}

.stat-info-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.15);
}

.stat-card-header {
  display: flex;
  align-items: center;
  padding: 16px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
}

.stat-card-icon {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-right: 12px;
  font-size: 16px;
}

.stat-card-title {
  font-size: 14px;
  font-weight: 600;
}

.stat-card-content {
  padding: 16px;
}

.stat-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
  font-size: 13px;
}

.stat-item:last-child {
  margin-bottom: 0;
}

.stat-item strong {
  font-weight: 600;
  font-size: 14px;
}

/* 图表容器样式 */
.chart-container {
  background: white !important;
  border: 1px solid #e8e8e8;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  transition: all 0.3s ease;
}

.chart-container:hover {
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.15);
}

/* 高端商务仪表板样式 */
.dashboard-section {
  margin-bottom: 32px;
  position: relative;
}

.dashboard-card {
  border-radius: 12px;
  border: none;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.08), 
              0 4px 16px rgba(0, 0, 0, 0.04);
  background: linear-gradient(145deg, #ffffff 0%, #fafbfc 100%);
  overflow: hidden;
}

.dashboard-card::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 4px;
  background: linear-gradient(90deg, 
    #1e3a8a 0%, 
    #3b82f6 25%, 
    #06b6d4 50%, 
    #10b981 75%, 
    #f59e0b 100%);
}

.dashboard-card :deep(.ant-card-head) {
  background: linear-gradient(135deg, 
    #ffffff 0%, 
    #f8fafc 25%, 
    #f1f5f9 50%, 
    #e2e8f0 100%);
  border-radius: 12px 12px 0 0;
  border: none;
  border-bottom: 1px solid #e2e8f0;
  padding: 24px 32px 20px;
  position: relative;
  overflow: hidden;
}

.dashboard-card :deep(.ant-card-head)::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: linear-gradient(135deg, 
    rgba(59, 130, 246, 0.05) 0%, 
    rgba(16, 185, 129, 0.05) 100%);
  pointer-events: none;
}

.dashboard-card :deep(.ant-card-head-title) {
  color: #1e293b;
  font-weight: 700;
  font-size: 18px;
  letter-spacing: 0.5px;
  text-shadow: none;
  position: relative;
  z-index: 1;
  display: flex;
  align-items: center;
  gap: 12px;
}

.dashboard-card :deep(.ant-card-head-title)::before {
  content: '';
  width: 6px;
  height: 24px;
  background: linear-gradient(180deg, #3b82f6 0%, #06b6d4 100%);
  border-radius: 3px;
  box-shadow: 0 0 12px rgba(59, 130, 246, 0.4);
}

.dashboard-card :deep(.ant-card-body) {
  padding: 32px;
  background: transparent;
}

.dashboard-charts {
  padding: 0;
}

.chart-row {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
  gap: 28px;
  margin-bottom: 28px;
}

.chart-row:last-child {
  margin-bottom: 0;
}

.chart-container {
  background: linear-gradient(145deg, #ffffff 0%, #f8fafc 100%);
  border: 1px solid rgba(148, 163, 184, 0.1);
  border-radius: 16px;
  overflow: hidden;
  transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
  box-shadow: 
    0 4px 20px rgba(0, 0, 0, 0.08),
    0 1px 3px rgba(0, 0, 0, 0.06),
    inset 0 1px 0 rgba(255, 255, 255, 0.7);
  position: relative;
}

.chart-container::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 1px;
  background: linear-gradient(90deg, 
    transparent 0%, 
    rgba(59, 130, 246, 0.3) 50%, 
    transparent 100%);
}

.chart-container:hover {
  transform: translateY(-4px);
  box-shadow: 
    0 12px 40px rgba(0, 0, 0, 0.12),
    0 4px 16px rgba(0, 0, 0, 0.08),
    inset 0 1px 0 rgba(255, 255, 255, 0.8);
  border-color: rgba(59, 130, 246, 0.2);
}

.chart-container.chart-wide {
  grid-column: span 1;
}

.chart-title {
  background: linear-gradient(135deg, 
    #f8fafc 0%, 
    #f1f5f9 100%);
  padding: 18px 24px;
  font-weight: 700;
  font-size: 15px;
  color: #1e293b;
  border-bottom: 1px solid rgba(148, 163, 184, 0.1);
  letter-spacing: 0.3px;
  position: relative;
  text-transform: uppercase;
  display: flex;
  align-items: center;
  gap: 8px;
}

.chart-icon {
  color: #3b82f6;
  font-size: 16px;
  opacity: 0.8;
}

.chart-title::after {
  content: '';
  position: absolute;
  bottom: -1px;
  left: 24px;
  right: 24px;
  height: 2px;
  background: linear-gradient(90deg, 
    #3b82f6 0%, 
    #06b6d4 50%, 
    #10b981 100%);
  border-radius: 1px;
  opacity: 0;
  transition: opacity 0.3s ease;
}

.chart-container:hover .chart-title::after {
  opacity: 1;
}

.chart-content {
  height: 320px;
  padding: 20px;
  position: relative;
}

.dashboard-actions {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 20px;
  padding: 32px 0 16px;
  border-top: 1px solid rgba(148, 163, 184, 0.1);
  margin-top: 24px;
  position: relative;
}

.dashboard-actions::before {
  content: '';
  position: absolute;
  top: -1px;
  left: 50%;
  transform: translateX(-50%);
  width: 200px;
  height: 1px;
  background: linear-gradient(90deg, 
    transparent 0%, 
    rgba(148, 163, 184, 0.3) 50%, 
    transparent 100%);
}

.dashboard-actions .ant-btn {
  height: 44px;
  border-radius: 12px;
  font-weight: 600;
  font-size: 14px;
  letter-spacing: 0.3px;
  border: 1px solid rgba(148, 163, 184, 0.2);
  background: linear-gradient(145deg, #ffffff 0%, #f8fafc 100%);
  color: #475569;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
  transition: all 0.3s ease;
}

.dashboard-actions .ant-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
  border-color: rgba(59, 130, 246, 0.3);
  background: linear-gradient(145deg, #f8fafc 0%, #ffffff 100%);
}

/* 响应式设计 */
@media (max-width: 1024px) {
  .cluster-management-container {
    padding: 16px;
  }
  
  .header-content {
    flex-direction: column;
    gap: 20px;
  }
  
  .overview-cards {
    grid-template-columns: repeat(2, 1fr);
  }
  
  .toolbar {
    flex-direction: column;
    gap: 16px;
  }
  
  .toolbar-left {
    width: 100%;
    flex-direction: column;
  }
  
  .search-input,
  .env-filter,
  .status-filter {
    width: 100%;
  }
  
  .chart-row {
    grid-template-columns: 1fr;
    gap: 20px;
  }
  
  .dashboard-actions {
    flex-direction: column;
    gap: 16px;
  }
  
  .dashboard-card :deep(.ant-card-body) {
    padding: 24px;
  }
  
  .chart-container {
    border-radius: 12px;
  }
  
  .chart-content {
    height: 280px;
    padding: 16px;
  }
}

@media (max-width: 768px) {
  .dashboard-card :deep(.ant-card-head) {
    padding: 20px 24px 16px;
  }
  
  .dashboard-card :deep(.ant-card-head-title) {
    font-size: 16px;
  }
  
  .dashboard-card :deep(.ant-card-body) {
    padding: 20px;
  }
  
  .chart-row {
    gap: 16px;
    margin-bottom: 20px;
  }
  
  .chart-container {
    border-radius: 10px;
  }
  
  .chart-title {
    padding: 14px 20px;
    font-size: 13px;
  }
  
  .chart-content {
    height: 240px;
    padding: 12px;
  }
  
  .dashboard-actions {
    padding: 24px 0 12px;
    gap: 12px;
  }
  
  .dashboard-actions .ant-btn {
    height: 40px;
    font-size: 13px;
    border-radius: 10px;
  }

  .overview-cards {
    grid-template-columns: 1fr;
  }
}
</style>
