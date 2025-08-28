<template>
  <div class="cluster-management-container configmap-management-container">
    <!-- 页面头部 -->
    <div class="page-header">
      <div class="header-content">
        <div class="title-section">
          <div class="page-title">
            <SettingOutlined class="title-icon" />
            <h1>Kubernetes ConfigMap 管理</h1>
          </div>
          <p class="page-subtitle">管理和监控集群中的所有配置映射资源</p>
        </div>
        <div class="header-actions">
          <a-button type="primary" size="large" @click="isCreateModalVisible = true">
            <template #icon><PlusOutlined /></template>
            创建配置
          </a-button>
          <a-button type="primary" size="large" @click="refreshData" :loading="loading">
            <template #icon><ReloadOutlined /></template>
            刷新数据
          </a-button>
        </div>
      </div>
    </div>

    <!-- 数据概览卡片 -->
    <div class="overview-cards">
      <div class="overview-card total-clusters">
        <div class="card-icon">
          <SettingOutlined />
        </div>
        <div class="card-info">
          <div class="card-number">{{ configmaps.length }}</div>
          <div class="card-label">ConfigMap 总数</div>
        </div>
      </div>
      
      <div class="overview-card running-clusters">
        <div class="card-icon">
          <CheckCircleOutlined />
        </div>
        <div class="card-info">
          <div class="card-number">{{ configmapsWithData }}</div>
          <div class="card-label">有数据配置</div>
        </div>
      </div>
      
      <div class="overview-card env-types">
        <div class="card-icon">
          <FileTextOutlined />
        </div>
        <div class="card-info">
          <div class="card-number">{{ totalDataKeys }}</div>
          <div class="card-label">数据键总数</div>
        </div>
      </div>
      
      <div class="overview-card resource-usage">
        <div class="card-icon">
          <PartitionOutlined />
        </div>
        <div class="card-info">
          <div class="card-number">{{ selectedNamespace }}</div>
          <div class="card-label">命名空间</div>
        </div>
      </div>
    </div>

    <!-- 操作工具栏 -->
    <div class="toolbar">
      <div class="toolbar-left">
        <a-select
          v-model:value="selectedCluster"
          placeholder="选择集群"
          class="env-filter cluster-selector"
          :loading="clustersLoading"
          @change="handleClusterChange"
        >
          <template #suffixIcon><ClusterOutlined /></template>
          <a-select-option v-for="cluster in clusters" :key="cluster.id" :value="cluster.id">
            <span class="cluster-option">
              <CloudServerOutlined />
              {{ cluster.name }}
            </span>
          </a-select-option>
        </a-select>
        
        <a-select
          v-model:value="selectedNamespace"
          placeholder="选择命名空间"
          class="env-filter namespace-selector"
          :loading="namespacesLoading"
          @change="handleNamespaceChange"
        >
          <template #suffixIcon><PartitionOutlined /></template>
          <a-select-option v-for="ns in namespaces" :key="ns" :value="ns">
            <span class="namespace-option">
              <AppstoreOutlined />
              {{ ns }}
            </span>
          </a-select-option>
        </a-select>
        
        <a-input-search
          v-model:value="searchText"
          placeholder="搜索 ConfigMap 名称或数据键"
          class="search-input"
          @search="onSearch"
          allow-clear
        />
      </div>
      
      <div class="toolbar-right">
        <div class="view-toggle">
          <a-radio-group v-model:value="viewMode" button-style="solid" size="small">
            <a-radio-button value="table">
              <TableOutlined />
            </a-radio-button>
            <a-radio-button value="card">
              <AppstoreOutlined />
            </a-radio-button>
          </a-radio-group>
        </div>
        
        <a-button @click="refreshData" :loading="loading">
          <template #icon><ReloadOutlined /></template>
        </a-button>
        
        <a-button 
          type="primary" 
          @click="handleBatchBackup" 
          :disabled="!selectedRows.length"
          v-if="selectedRows.length > 0"
        >
          <template #icon><SaveOutlined /></template>
          备份 ({{ selectedRows.length }})
        </a-button>
        
        <a-button 
          type="primary" 
          danger 
          @click="handleBatchDelete" 
          :disabled="!selectedRows.length"
          v-if="selectedRows.length > 0"
        >
          <template #icon><DeleteOutlined /></template>
          删除 ({{ selectedRows.length }})
        </a-button>
      </div>
    </div>

    <!-- 数据展示区域 -->
    <div class="data-display">
      <div class="display-header" v-if="filteredConfigMaps.length > 0">
        <div class="result-info">
          <span class="result-count">共 {{ filteredConfigMaps.length }} 个ConfigMap</span>
          <div class="env-tags">
            <a-tag color="green">有数据 {{ configmapsWithData }}</a-tag>
            <a-tag color="blue">{{ selectedNamespace }}</a-tag>
          </div>
        </div>
      </div>

      <!-- 表格视图 -->
      <a-table
        v-if="viewMode === 'table'"
        :columns="columns"
        :data-source="filteredConfigMaps"
        :row-selection="rowSelection"
        :loading="loading"
        row-key="uid"
        :pagination="{
          current: currentPage,
          pageSize: pageSize,
          total: totalItems,
          showSizeChanger: true,
          showQuickJumper: true,
          showTotal: (total: number, range: number[]) => `显示 ${range[0]}-${range[1]} 条，共 ${total} 条数据`,
          pageSizeOptions: ['12', '24', '48', '96']
        }"
        @change="handleTableChange"
        class="cluster-table configmaps-table"
      >
        <!-- ConfigMap名称列 -->
        <template #name="{ text }">
          <div class="cluster-name configmap-name">
            <SettingOutlined />
            <span>{{ text }}</span>
          </div>
        </template>

        <!-- 命名空间列 -->
        <template #namespace="{ text }">
          <a-tag class="env-tag namespace-tag">
            <AppstoreOutlined /> {{ text }}
          </a-tag>
        </template>
        
        <!-- 数据键数量列 -->
        <template #data_count="{ text }">
          <a-badge :count="text" :number-style="{ backgroundColor: text > 0 ? '#52c41a' : '#d9d9d9' }">
            <span>{{ text }} 个键</span>
          </a-badge>
        </template>

        <!-- 大小列 -->
        <template #size="{ text }">
          <div class="size-info">
            <FileTextOutlined />
            <span>{{ text }}</span>
          </div>
        </template>

        <!-- 创建时间列 -->
        <template #creationTimestamp="{ record }">
          <div class="timestamp">
            <ClockCircleOutlined />
            <a-tooltip :title="formatDateTime(record.creation_timestamp)">
              <span>{{ formatDate(record.creation_timestamp) }}</span>
            </a-tooltip>
          </div>
        </template>

        <!-- 操作列 -->
        <template #action="{ record }">
          <div class="action-column">
            <a-tooltip title="查看数据">
              <a-button type="primary" ghost shape="circle" size="small" @click="viewConfigMapData(record)">
                <template #icon><EyeOutlined /></template>
              </a-button>
            </a-tooltip>

            <a-tooltip title="查看 YAML">
              <a-button type="primary" ghost shape="circle" size="small" @click="viewConfigMapYaml(record)">
                <template #icon><CodeOutlined /></template>
              </a-button>
            </a-tooltip>

            <a-tooltip title="使用情况">
              <a-button type="primary" ghost shape="circle" size="small" @click="viewUsage(record)">
                <template #icon><LinkOutlined /></template>
              </a-button>
            </a-tooltip>

            <a-tooltip title="备份">
              <a-button type="primary" ghost shape="circle" size="small" @click="backupConfigMap(record)">
                <template #icon><SaveOutlined /></template>
              </a-button>
            </a-tooltip>

            <a-tooltip title="编辑">
              <a-button type="primary" ghost shape="circle" size="small" @click="handleEdit(record)">
                <template #icon><EditOutlined /></template>
              </a-button>
            </a-tooltip>
            
            <a-tooltip title="删除">
              <a-popconfirm
                title="确定要删除该ConfigMap吗?"
                description="此操作不可撤销，可能影响使用此配置的应用"
                @confirm="handleDelete(record)"
                ok-text="确定"
                cancel-text="取消"
              >
                <a-button type="primary" danger ghost shape="circle" size="small">
                  <template #icon><DeleteOutlined /></template>
                </a-button>
              </a-popconfirm>
            </a-tooltip>
          </div>
        </template>

        <!-- 空状态 -->
        <template #emptyText>
          <div class="empty-state">
            <SettingOutlined style="font-size: 48px; color: #d9d9d9; margin-bottom: 16px" />
            <p>暂无ConfigMap数据</p>
            <a-button type="primary" @click="refreshData">刷新数据</a-button>
          </div>
        </template>
      </a-table>

      <!-- 卡片视图 -->
      <div v-else class="card-view">
        <a-spin :spinning="loading">
          <a-empty v-if="filteredConfigMaps.length === 0" description="暂无ConfigMap数据">
            <template #image>
              <SettingOutlined style="font-size: 64px; color: #d9d9d9;" />
            </template>
            <template #description>
              <span style="color: #999;">暂无ConfigMap数据</span>
            </template>
            <a-button type="primary" @click="refreshData">刷新数据</a-button>
          </a-empty>
          <div v-else class="cluster-cards configmap-cards">
            <a-checkbox-group v-model:value="selectedCardIds" class="card-checkbox-group">
              <div v-for="configmap in filteredConfigMaps" :key="configmap.uid" class="cluster-card configmap-card">
                <div class="card-header">
                  <a-checkbox :value="configmap.uid" class="card-checkbox" />
                  <div class="service-title configmap-title">
                    <SettingOutlined class="service-icon" />
                    <h3>{{ configmap.name }}</h3>
                  </div>
                  <a-badge :count="configmap.data_count" :number-style="{ backgroundColor: '#52c41a' }" class="card-badge">
                    <div></div>
                  </a-badge>
                </div>
                
                <div class="card-content">
                  <div class="card-detail">
                    <span class="detail-label">命名空间:</span>
                    <span class="detail-value">
                      <AppstoreOutlined />
                      {{ configmap.namespace }}
                    </span>
                  </div>
                  <div class="card-detail">
                    <span class="detail-label">数据键:</span>
                    <span class="detail-value">{{ configmap.data_count }} 个</span>
                  </div>
                  <div class="card-detail">
                    <span class="detail-label">大小:</span>
                    <span class="detail-value">
                      <FileTextOutlined />
                      {{ configmap.size }}
                    </span>
                  </div>
                  <div class="card-detail">
                    <span class="detail-label">创建时间:</span>
                    <span class="detail-value">
                      <ClockCircleOutlined />
                      {{ formatDate(configmap.creation_timestamp) }}
                    </span>
                  </div>
                </div>
                
                <div class="card-footer card-action-footer">
                  <a-button type="primary" ghost size="small" @click="viewConfigMapData(configmap)">
                    <template #icon><EyeOutlined /></template>
                    数据
                  </a-button>
                  <a-button type="primary" ghost size="small" @click="viewConfigMapYaml(configmap)">
                    <template #icon><CodeOutlined /></template>
                    YAML
                  </a-button>
                  <a-button type="primary" ghost size="small" @click="handleEdit(configmap)">
                    <template #icon><EditOutlined /></template>
                    编辑
                  </a-button>
                  <a-popconfirm
                    title="确定要删除该ConfigMap吗?"
                    @confirm="handleDelete(configmap)"
                    ok-text="确定"
                    cancel-text="取消"
                  >
                    <a-button type="primary" danger ghost size="small">
                      <template #icon><DeleteOutlined /></template>
                      删除
                    </a-button>
                  </a-popconfirm>
                </div>
              </div>
            </a-checkbox-group>
          </div>
        </a-spin>
      </div>
    </div>

    <!-- 查看数据模态框 -->
    <a-modal
      v-model:open="dataModalVisible"
      title="ConfigMap 数据"
      width="900px"
      class="cluster-modal data-modal"
      :footer="null"
    >
      <a-alert v-if="currentConfigMap" class="modal-alert" type="info" show-icon>
        <template #message>
          <span>{{ currentConfigMap.name }} ({{ currentConfigMap.namespace }})</span>
        </template>
        <template #description>
          <div>数据键: {{ currentConfigMap.data_count }} 个 | 大小: {{ currentConfigMap.size }}</div>
        </template>
      </a-alert>
      
      <div class="data-actions">
        <a-button type="primary" size="small" @click="copyData">
          <template #icon><CopyOutlined /></template>
          复制所有数据
        </a-button>
        <a-button type="primary" size="small" @click="downloadData">
          <template #icon><DownloadOutlined /></template>
          下载数据
        </a-button>
      </div>

      <div class="configmap-data-view">
        <a-collapse v-if="configmapData && Object.keys(configmapData).length > 0">
          <a-collapse-panel 
            v-for="(value, key) in configmapData" 
            :key="key" 
            :header="key"
            class="data-panel"
          >
            <template #extra>
              <a-button type="link" size="small" @click="copyDataKey(key, value)" @click.stop>
                <template #icon><CopyOutlined /></template>
              </a-button>
            </template>
            <pre class="data-content">{{ value }}</pre>
          </a-collapse-panel>
        </a-collapse>
        <a-empty v-else description="暂无数据" />
      </div>
    </a-modal>

    <!-- 查看 YAML 模态框 -->
    <a-modal
      v-model:open="viewYamlModalVisible"
      title="ConfigMap YAML 配置"
      width="900px"
      class="cluster-modal yaml-modal"
      :footer="null"
    >
      <a-alert v-if="currentConfigMap" class="modal-alert" type="info" show-icon>
        <template #message>
          <span>{{ currentConfigMap.name }} ({{ currentConfigMap.namespace }})</span>
        </template>
        <template #description>
          <div>数据键: {{ currentConfigMap.data_count }} 个</div>
        </template>
      </a-alert>
      
      <div class="yaml-actions">
        <a-button type="primary" size="small" @click="copyYaml">
          <template #icon><CopyOutlined /></template>
          复制
        </a-button>
      </div>
      <pre class="yaml-editor">{{ configmapYaml }}</pre>
    </a-modal>

    <!-- 使用情况模态框 -->
    <a-modal
      v-model:open="usageModalVisible"
      title="ConfigMap 使用情况"
      width="800px"
      class="cluster-modal"
      :footer="null"
    >
      <a-alert v-if="currentConfigMap" class="modal-alert" type="info" show-icon>
        <template #message>
          <span>{{ currentConfigMap.name }} ({{ currentConfigMap.namespace }})</span>
        </template>
        <template #description>
          <div>查看哪些资源使用了此ConfigMap</div>
        </template>
      </a-alert>

      <div class="usage-content">
        <a-descriptions bordered size="small">
          <a-descriptions-item label="使用的Pods" :span="3">
            <a-tag v-for="pod in configmapUsage.pods" :key="pod" color="blue" class="usage-tag">
              {{ pod }}
            </a-tag>
            <span v-if="!configmapUsage.pods?.length" class="no-usage">无</span>
          </a-descriptions-item>
          <a-descriptions-item label="使用的Deployments" :span="3">
            <a-tag v-for="deployment in configmapUsage.deployments" :key="deployment" color="green" class="usage-tag">
              {{ deployment }}
            </a-tag>
            <span v-if="!configmapUsage.deployments?.length" class="no-usage">无</span>
          </a-descriptions-item>
          <a-descriptions-item label="使用的Services" :span="3">
            <a-tag v-for="service in configmapUsage.services" :key="service" color="orange" class="usage-tag">
              {{ service }}
            </a-tag>
            <span v-if="!configmapUsage.services?.length" class="no-usage">无</span>
          </a-descriptions-item>
        </a-descriptions>
      </div>
    </a-modal>

    <!-- 创建ConfigMap模态框 -->
    <a-modal
      v-model:open="isCreateModalVisible"
      title="创建 ConfigMap"
      width="800px"
      @ok="handleCreate"
      @cancel="resetCreateForm"
      :confirmLoading="loading"
      class="cluster-modal"
    >
      <a-form :model="createForm" layout="vertical">
        <a-row :gutter="16">
          <a-col :span="12">
            <a-form-item label="ConfigMap 名称" required>
              <a-input v-model:value="createForm.name" placeholder="请输入ConfigMap名称" />
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item label="命名空间" required>
              <a-select v-model:value="createForm.namespace" placeholder="请选择命名空间">
                <a-select-option v-for="ns in namespaces" :key="ns" :value="ns">
                  {{ ns }}
                </a-select-option>
              </a-select>
            </a-form-item>
          </a-col>
        </a-row>

        <a-form-item label="数据">
          <div class="data-entries">
            <div v-for="(entry, index) in createForm.dataEntries" :key="index" class="data-entry">
              <a-input 
                v-model:value="entry.key" 
                placeholder="键名" 
                style="width: 30%; margin-right: 8px;"
              />
              <a-textarea 
                v-model:value="entry.value" 
                placeholder="键值" 
                style="width: 60%; margin-right: 8px;" 
                :auto-size="{ minRows: 1, maxRows: 4 }"
              />
              <a-button type="link" danger @click="removeDataEntry(index)" v-if="createForm.dataEntries.length > 1">
                <template #icon><DeleteOutlined /></template>
              </a-button>
            </div>
            <a-button type="dashed" @click="addDataEntry" block>
              <template #icon><PlusOutlined /></template>
              添加数据项
            </a-button>
          </div>
        </a-form-item>

        <a-form-item label="从文件创建">
          <a-upload
            :file-list="fileList"
            :before-upload="handleBeforeUpload"
            @remove="handleRemoveFile"
            multiple
          >
            <a-button>
              <template #icon><UploadOutlined /></template>
              选择文件
            </a-button>
          </a-upload>
          <div class="upload-tip">支持上传多个配置文件，文件名将作为键名</div>
        </a-form-item>
      </a-form>
    </a-modal>
  </div>
</template>

<script lang="ts" setup>
import { ref, computed, onMounted, watch } from 'vue';
import { message } from 'ant-design-vue';
import {
  getConfigMapListWithFilterApi,
  getConfigMapYamlApi,
  deleteConfigMapApi,
  batchDeleteConfigMapApi,
  createConfigMapApi,
  getConfigMapDataApi,
  getConfigMapUsageApi,
  backupConfigMapApi,
  createConfigMapFromFileApi,
  getAllClustersApi,
  getNamespacesByClusterIdApi,
} from '#/api';
import type { 
  ConfigMapInfo, 
  ConfigMapListReq,
  ConfigMapCreateReq,
  ConfigMapUsageInfo,
  ConfigMapBackupReq 
} from '#/api';
import { 
  CloudServerOutlined, 
  TableOutlined, 
  AppstoreOutlined, 
  ReloadOutlined,
  DeleteOutlined,
  CodeOutlined,
  SettingOutlined,
  ClockCircleOutlined,
  CheckCircleOutlined,
  CopyOutlined,
  ClusterOutlined,
  PartitionOutlined,
  PlusOutlined,
  EditOutlined,
  EyeOutlined,
  LinkOutlined,
  SaveOutlined,
  FileTextOutlined,
  DownloadOutlined,
  UploadOutlined
} from '@ant-design/icons-vue';

// 状态变量
const loading = ref(false);
const clustersLoading = ref(false);
const namespacesLoading = ref(false);
const configmaps = ref<ConfigMapInfo[]>([]);
const searchText = ref('');
const selectedRows = ref<ConfigMapInfo[]>([]);
const namespaces = ref<string[]>(['default']);
const selectedNamespace = ref<string>('default');
const dataModalVisible = ref(false);
const viewYamlModalVisible = ref(false);
const usageModalVisible = ref(false);
const isCreateModalVisible = ref(false);
const configmapYaml = ref('');
const configmapData = ref<Record<string, string>>({});
const configmapUsage = ref<ConfigMapUsageInfo>({ pods: [], deployments: [], services: [] });
const clusters = ref<Array<{id: number, name: string}>>([]);
const selectedCluster = ref<number>();
const viewMode = ref<'table' | 'card'>('table');
const currentConfigMap = ref<ConfigMapInfo | null>(null);
const selectedCardIds = ref<string[]>([]);
const currentPage = ref(1);
const pageSize = ref(12);
const totalItems = ref(0);
const fileList = ref<any[]>([]);

// 创建表单
const createForm = ref<{
  name: string;
  namespace: string;
  dataEntries: Array<{ key: string; value: string }>;
}>({
  name: '',
  namespace: 'default',
  dataEntries: [{ key: '', value: '' }]
});

// 根据卡片选择更新 selectedRows
watch(selectedCardIds, (newValue) => {
  selectedRows.value = configmaps.value.filter(configmap => 
    newValue.includes(configmap.uid)
  );
});

// 表格列配置
const columns = [
  {
    title: 'ConfigMap 名称',
    dataIndex: 'name',
    key: 'name',
    slots: { customRender: 'name' },
    width: '20%',
    sorter: (a: ConfigMapInfo, b: ConfigMapInfo) => a.name.localeCompare(b.name),
  },
  {
    title: '命名空间',
    dataIndex: 'namespace',
    key: 'namespace',
    width: '12%',
    slots: { customRender: 'namespace' },
    sorter: (a: ConfigMapInfo, b: ConfigMapInfo) => a.namespace.localeCompare(b.namespace),
  },
  {
    title: '数据键数',
    dataIndex: 'data_count',
    key: 'data_count',
    width: '10%',
    slots: { customRender: 'data_count' },
    sorter: (a: ConfigMapInfo, b: ConfigMapInfo) => (a.data_count || 0) - (b.data_count || 0),
  },
  {
    title: '大小',
    dataIndex: 'size',
    key: 'size',
    width: '10%',
    slots: { customRender: 'size' },
  },
  {
    title: '创建时间',
    dataIndex: 'creation_timestamp',
    key: 'creationTimestamp',
    width: '15%',
    sorter: (a: ConfigMapInfo, b: ConfigMapInfo) => new Date(a.creation_timestamp).getTime() - new Date(b.creation_timestamp).getTime(),
    slots: { customRender: 'creationTimestamp' },
  },
  {
    title: '操作',
    key: 'action',
    width: '18%',
    fixed: 'right',
    slots: { customRender: 'action' },
  },
];

// 计算属性：过滤后的ConfigMap列表
const filteredConfigMaps = computed(() => {
  const searchValue = searchText.value.toLowerCase().trim();
  if (!searchValue) return configmaps.value;
  return configmaps.value.filter(configmap => 
    configmap.name.toLowerCase().includes(searchValue)
  );
});

// 计算属性：有数据的ConfigMap数量
const configmapsWithData = computed(() => 
  configmaps.value.filter(cm => cm.data_count && cm.data_count > 0).length
);

// 计算属性：总数据键数
const totalDataKeys = computed(() => 
  configmaps.value.reduce((total, cm) => total + (cm.data_count || 0), 0)
);

// 表格选择配置
const rowSelection = {
  onChange: (_: string[], selectedRowsData: ConfigMapInfo[]) => {
    selectedRows.value = selectedRowsData;
    selectedCardIds.value = selectedRowsData.map(row => row.uid);
  },
  getCheckboxProps: (_: ConfigMapInfo) => ({
    disabled: false,
  }),
};

// 格式化日期
const formatDate = (dateString: string) => {
  if (!dateString) return '-';
  const date = new Date(dateString);
  return `${date.getMonth() + 1}月${date.getDate()}日 ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
};

// 日期时间格式化
const formatDateTime = (dateString: string): string => {
  if (!dateString) return '-';
  const date = new Date(dateString);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}:${String(date.getSeconds()).padStart(2, '0')}`;
};

// 复制YAML
const copyYaml = async () => {
  try {
    await navigator.clipboard.writeText(configmapYaml.value);
    message.success('YAML 已复制到剪贴板');
  } catch (err) {
    message.error('复制失败，请手动选择并复制');
  }
};

// 复制数据
const copyData = async () => {
  try {
    await navigator.clipboard.writeText(JSON.stringify(configmapData.value, null, 2));
    message.success('数据已复制到剪贴板');
  } catch (err) {
    message.error('复制失败，请手动选择并复制');
  }
};

// 复制数据键
const copyDataKey = async (key: string, value: string) => {
  try {
    await navigator.clipboard.writeText(value);
    message.success(`数据键 "${key}" 已复制到剪贴板`);
  } catch (err) {
    message.error('复制失败，请手动选择并复制');
  }
};

// 下载数据
const downloadData = () => {
  const dataStr = JSON.stringify(configmapData.value, null, 2);
  const dataBlob = new Blob([dataStr], { type: 'application/json' });
  const url = URL.createObjectURL(dataBlob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${currentConfigMap.value?.name}-configmap-data.json`;
  link.click();
  URL.revokeObjectURL(url);
  message.success('数据下载成功');
};

// 获取集群列表
const getClusters = async () => {
  clustersLoading.value = true;
  try {
    const res = await getAllClustersApi();
    clusters.value = res ?? [];
    if (clusters.value.length > 0 && !selectedCluster.value) {
      selectedCluster.value = clusters.value[0]?.id;
      if (selectedCluster.value) {
        await getNamespaces();
        await getConfigMaps(1, pageSize.value);
      }
    }
  } catch (error: any) {
    message.error(error.message || '获取集群列表失败');
  } finally {
    clustersLoading.value = false;
  }
};

// 获取命名空间列表
const getNamespaces = async () => {
  if (!selectedCluster.value) {
    message.warning('请先选择集群');
    return;
  }

  namespacesLoading.value = true;
  try {
    const res = await getNamespacesByClusterIdApi(selectedCluster.value);
    namespaces.value = res.map((ns: { name: string }) => ns.name);
    if (namespaces.value.length > 0) {
      selectedNamespace.value = namespaces.value[0] || 'default';
    }
  } catch (error: any) {
    message.error(error.message || '获取命名空间列表失败');
    namespaces.value = ['default'];
    selectedNamespace.value = 'default';
  } finally {
    namespacesLoading.value = false;
  }
};

// 获取ConfigMap列表（支持分页）
const getConfigMaps = async (page = 1, size = pageSize.value) => {
  if (!selectedCluster.value || !selectedNamespace.value) {
    message.warning('请先选择集群和命名空间');
    return;
  }
  
  loading.value = true;
  try {
    const params: ConfigMapListReq = {
      cluster_id: selectedCluster.value,
      namespace: selectedNamespace.value,
      page,
      page_size: size
    };
    
    const res = await getConfigMapListWithFilterApi(params);
    configmaps.value = res || [];
    
    // 默认设置总数为当前数据长度（如果API未返回分页信息）
    totalItems.value = configmaps.value.length;
    
    currentPage.value = page;
    selectedRows.value = [];
    selectedCardIds.value = [];
  } catch (error: any) {
    message.error(error.message || '获取ConfigMap列表失败');
    configmaps.value = [];
    totalItems.value = 0;
  } finally {
    loading.value = false;
  }
};

// 刷新数据
const refreshData = () => {
  getConfigMaps(currentPage.value, pageSize.value);
};

// 搜索
const onSearch = () => {
  // 搜索逻辑已经在计算属性中实现
};

// 查看ConfigMap数据
const viewConfigMapData = async (configmap: ConfigMapInfo) => {
  if (!selectedCluster.value) return;
  try {
    currentConfigMap.value = configmap;
    const res = await getConfigMapDataApi({
      cluster_id: selectedCluster.value,
      namespace: configmap.namespace,
      name: configmap.name
    });
    configmapData.value = res || {};
    dataModalVisible.value = true;
  } catch (error: any) {
    message.error(error.message || '获取ConfigMap数据失败');
  }
};

// 查看ConfigMap YAML
const viewConfigMapYaml = async (configmap: ConfigMapInfo) => {
  if (!selectedCluster.value) return;
  try {
    currentConfigMap.value = configmap;
    const res = await getConfigMapYamlApi(selectedCluster.value, configmap.name, configmap.namespace);
    configmapYaml.value = typeof res === 'string' ? res : JSON.stringify(res, null, 2);
    viewYamlModalVisible.value = true;
  } catch (error: any) {
    message.error(error.message || '获取ConfigMap YAML失败');
  }
};

// 查看使用情况
const viewUsage = async (configmap: ConfigMapInfo) => {
  if (!selectedCluster.value) return;
  try {
    currentConfigMap.value = configmap;
    const usage = await getConfigMapUsageApi(selectedCluster.value, configmap.namespace, configmap.name);
    configmapUsage.value = usage || { pods: [], deployments: [], services: [] };
    usageModalVisible.value = true;
  } catch (error: any) {
    message.error(error.message || '获取使用情况失败');
  }
};

// 备份ConfigMap
const backupConfigMap = async (configmap: ConfigMapInfo) => {
  if (!selectedCluster.value) return;
  try {
    const backupData: ConfigMapBackupReq = {
      cluster_id: selectedCluster.value,
      namespace: configmap.namespace,
      names: [configmap.name],
      backup_name: `${configmap.name}-backup-${Date.now()}`,
      description: `备份ConfigMap ${configmap.name}`
    };
    
    await backupConfigMapApi(backupData);
    message.success(`ConfigMap ${configmap.name} 备份成功`);
  } catch (error: any) {
    message.error(error.message || '备份失败');
  }
};

// 批量备份
const handleBatchBackup = async () => {
  if (!selectedRows.value.length || !selectedCluster.value) return;
  
  try {
    loading.value = true;
    const backupData: ConfigMapBackupReq = {
      cluster_id: selectedCluster.value,
      namespace: selectedNamespace.value,
      names: selectedRows.value.map(cm => cm.name),
      backup_name: `batch-backup-${Date.now()}`,
      description: `批量备份 ${selectedRows.value.length} 个ConfigMap`
    };
    
    await backupConfigMapApi(backupData);
    message.success(`成功备份 ${selectedRows.value.length} 个ConfigMap`);
    selectedRows.value = [];
    selectedCardIds.value = [];
  } catch (error: any) {
    message.error(error.message || '批量备份失败');
  } finally {
    loading.value = false;
  }
};

// 编辑ConfigMap
const handleEdit = (_: ConfigMapInfo) => {
  // 编辑功能
  message.info('编辑功能开发中...');
};

// 删除ConfigMap
const handleDelete = async (configmap: ConfigMapInfo) => {
  if (!selectedCluster.value) return;
  
  try {
    await deleteConfigMapApi(selectedCluster.value, configmap.namespace, configmap.name);
    message.success('ConfigMap删除成功');
    getConfigMaps(currentPage.value, pageSize.value);
  } catch (error: any) {
    message.error(error.message || '删除ConfigMap失败');
  }
};

// 批量删除ConfigMap
const handleBatchDelete = async () => {
  if (!selectedRows.value.length || !selectedCluster.value) return;
  
  try {
    loading.value = true;
    await batchDeleteConfigMapApi({
      cluster_id: selectedCluster.value,
      namespace: selectedNamespace.value,
      names: selectedRows.value.map(cm => cm.name)
    });
    
    message.success(`成功删除 ${selectedRows.value.length} 个ConfigMap`);
    selectedRows.value = [];
    selectedCardIds.value = [];
    getConfigMaps(currentPage.value, pageSize.value);
  } catch (error: any) {
    message.error(error.message || '批量删除失败');
  } finally {
    loading.value = false;
  }
};

// 创建ConfigMap
const handleCreate = async () => {
  if (!selectedCluster.value) return;
  
  try {
    loading.value = true;
    
    // 构建数据对象
    const data: Record<string, string> = {};
    createForm.value.dataEntries.forEach(entry => {
      if (entry.key && entry.value) {
        data[entry.key] = entry.value;
      }
    });
    
    if (fileList.value.length > 0) {
      // 使用文件创建
      await createConfigMapFromFileApi(
        selectedCluster.value,
        createForm.value.namespace,
        createForm.value.name,
        fileList.value
      );
    } else {
      // 使用表单数据创建
      const createData: ConfigMapCreateReq = {
        cluster_id: selectedCluster.value,
        namespace: createForm.value.namespace,
        name: createForm.value.name,
        data
      };
      
      await createConfigMapApi(createData);
    }
    
    message.success('ConfigMap创建成功');
    isCreateModalVisible.value = false;
    resetCreateForm();
    getConfigMaps(currentPage.value, pageSize.value);
  } catch (error: any) {
    message.error(error.message || '创建ConfigMap失败');
  } finally {
    loading.value = false;
  }
};

// 重置创建表单
const resetCreateForm = () => {
  createForm.value = {
    name: '',
    namespace: selectedNamespace.value,
    dataEntries: [{ key: '', value: '' }]
  };
  fileList.value = [];
};

// 添加数据项
const addDataEntry = () => {
  createForm.value.dataEntries.push({ key: '', value: '' });
};

// 移除数据项
const removeDataEntry = (index: number) => {
  createForm.value.dataEntries.splice(index, 1);
};

// 文件上传前处理
const handleBeforeUpload = (file: any) => {
  fileList.value.push(file);
  return false;
};

// 移除文件
const handleRemoveFile = (file: any) => {
  const index = fileList.value.indexOf(file);
  if (index > -1) {
    fileList.value.splice(index, 1);
  }
};

// 切换命名空间
const handleNamespaceChange = () => {
  currentPage.value = 1;
  getConfigMaps(1, pageSize.value);
};

// 切换集群
const handleClusterChange = () => {
  selectedNamespace.value = 'default';
  configmaps.value = [];
  currentPage.value = 1;
  totalItems.value = 0;
  getNamespaces();
  getConfigMaps(1, pageSize.value);
};

// 分页处理
const handleTableChange = (pagination: any) => {
  currentPage.value = pagination.current;
  pageSize.value = pagination.pageSize;
  getConfigMaps(pagination.current, pagination.pageSize);
};

// 页面加载时获取数据
onMounted(() => {
  getClusters();
});
</script>

<style>
/* 继承现有样式系统 */

.configmap-name {
  display: flex;
  align-items: center;
  gap: 10px;
  font-weight: 500;
}

.size-info {
  display: flex;
  align-items: center;
  gap: 8px;
  font-family: 'Courier New', monospace;
  font-size: 13px;
}

.data-entries {
  border: 1px solid #f0f0f0;
  border-radius: 6px;
  padding: 16px;
  background: #fafafa;
}

.data-entry {
  display: flex;
  align-items: flex-start;
  margin-bottom: 8px;
}

.data-entry:last-child {
  margin-bottom: 0;
}

.configmap-data-view {
  margin-top: 16px;
}

.data-panel {
  margin-bottom: 8px;
}

.data-content {
  background: #f5f5f5;
  border-radius: 4px;
  padding: 12px;
  margin: 0;
  white-space: pre-wrap;
  font-family: 'Courier New', monospace;
  font-size: 13px;
  max-height: 300px;
  overflow-y: auto;
}

.data-actions {
  display: flex;
  gap: 8px;
  margin-bottom: 16px;
}

.usage-content {
  margin-top: 16px;
}

.usage-tag {
  margin-bottom: 4px;
}

.no-usage {
  color: #999;
  font-style: italic;
}

.upload-tip {
  margin-top: 8px;
  color: #666;
  font-size: 12px;
}

.card-badge {
  position: absolute;
  top: 16px;
  right: 40px;
}

/* 操作按钮样式优化 */
.action-column {
  display: flex;
  gap: 4px;
  justify-content: flex-end;
  flex-wrap: wrap;
}

.action-column :deep(.ant-btn) {
  min-width: 28px;
}
</style>
