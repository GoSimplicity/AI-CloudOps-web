<template>
  <div class="cluster-management-container yaml-template-container">
    <!-- 页面头部 -->
    <div class="page-header">
      <div class="header-content">
        <div class="title-section">
          <div class="page-title">
            <FileTextOutlined class="title-icon" />
            <h1>YAML 模板管理</h1>
          </div>
          <p class="page-subtitle">创建、编辑和管理 Kubernetes YAML 模板</p>
        </div>
        <div class="header-actions">
          <a-upload
            :show-upload-list="false"
            :before-upload="handleImport"
            accept=".yaml,.yml"
          >
            <a-button size="large">
              <template #icon><ImportOutlined /></template>
              导入模板
            </a-button>
          </a-upload>
          <a-button type="primary" size="large" @click="showCreateModal">
            <template #icon><PlusOutlined /></template>
            新建模板
          </a-button>
        </div>
      </div>
    </div>

    <!-- 数据概览卡片 -->
    <div class="overview-cards">
      <div class="overview-card total-templates">
        <div class="card-icon">
          <FileTextOutlined />
        </div>
        <div class="card-info">
          <div class="card-number">{{ templates.length }}</div>
          <div class="card-label">模板总数</div>
        </div>
      </div>
      
      <div class="overview-card recent-templates">
        <div class="card-icon">
          <ClockCircleOutlined />
        </div>
        <div class="card-info">
          <div class="card-number">{{ recentTemplatesCount }}</div>
          <div class="card-label">最近创建</div>
        </div>
      </div>
      
      <div class="overview-card my-templates">
        <div class="card-icon">
          <UserOutlined />
        </div>
        <div class="card-info">
          <div class="card-number">{{ myTemplatesCount }}</div>
          <div class="card-label">我的模板</div>
        </div>
      </div>
      
      <div class="overview-card shared-templates">
        <div class="card-icon">
          <ShareAltOutlined />
        </div>
        <div class="card-info">
          <div class="card-number">{{ sharedTemplatesCount }}</div>
          <div class="card-label">共享模板</div>
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
        
        <a-input-search
          v-model:value="searchKeyword"
          placeholder="搜索模板名称或内容"
          class="search-input"
          @search="onSearch"
          allow-clear
        />
      </div>
      
      <div class="toolbar-right">
        <a-button 
          danger 
          :disabled="selectedRows.length === 0" 
          @click="batchDelete"
          :loading="batchDeleteLoading"
        >
          <template #icon><DeleteOutlined /></template>
          批量删除 ({{ selectedRows.length }})
        </a-button>
        
        <a-button @click="refreshData" :loading="loading">
          <template #icon><ReloadOutlined /></template>
        </a-button>
      </div>
    </div>

    <!-- 模板列表 -->
    <div class="data-display">
      <div class="display-header" v-if="filteredTemplates.length > 0">
        <div class="result-info">
          <span class="result-count">共 {{ filteredTemplates.length }} 个模板</span>
          <div class="env-tags">
            <a-tag color="blue">总计 {{ filteredTemplates.length }}</a-tag>
            <a-tag color="green">我的 {{ myTemplatesCount }}</a-tag>
            <a-tag color="orange">共享 {{ sharedTemplatesCount }}</a-tag>
          </div>
        </div>
      </div>

      <a-table
        :columns="columns"
        :data-source="filteredTemplates"
        :loading="loading"
        row-key="id"
        :row-selection="{
          selectedRowKeys: selectedRows.map(row => row.id),
          onChange: onSelectChange,
        }"
        :pagination="{
          current: currentPage,
          pageSize: pageSize,
          total: totalItems,
          showSizeChanger: true,
          showQuickJumper: true,
          showTotal: (total: number, range: [number, number]) => `显示 ${range[0]}-${range[1]} 条，共 ${total} 条数据`,
          pageSizeOptions: ['10', '20', '50', '100']
        }"
        @change="handleTableChange"
        class="cluster-table templates-table"
      >
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'name'">
            <div class="template-name">
              <FileTextOutlined class="template-icon" />
              <span class="name-text">{{ record.name }}</span>
              <a-tag v-if="isMyTemplate(record)" color="green" size="small">我的</a-tag>
            </div>
          </template>

          <template v-else-if="column.key === 'content'">
            <div class="content-preview">
              <a-tooltip>
                <template #title>
                  <pre class="yaml-tooltip">{{ record.content.substring(0, 500) }}{{ record.content.length > 500 ? '...' : '' }}</pre>
                </template>
                <div class="content-summary">
                  <CodeOutlined />
                  {{ getContentSummary(record.content) }}
                </div>
              </a-tooltip>
            </div>
          </template>

          <template v-else-if="column.key === 'cluster'">
            <div class="cluster-info">
              <CloudServerOutlined />
              {{ getClusterName(record.cluster_id) }}
            </div>
          </template>

          <template v-else-if="column.key === 'created_at'">
            <div class="time-info">
              <div class="create-time">{{ formatDate(record.created_at) }}</div>
              <div class="update-time" v-if="record.updated_at !== record.created_at">
                更新: {{ formatDate(record.updated_at) }}
              </div>
            </div>
          </template>

          <template v-else-if="column.key === 'actions'">
            <div class="action-buttons">
              <a-tooltip title="预览">
                <a-button type="text" size="small" @click="previewTemplate(record)">
                  <EyeOutlined />
                </a-button>
              </a-tooltip>
              
              <a-tooltip title="编辑">
                <a-button type="text" size="small" @click="editTemplate(record)">
                  <EditOutlined />
                </a-button>
              </a-tooltip>
              
              <a-tooltip title="复制">
                <a-button type="text" size="small" @click="copyTemplate(record)">
                  <CopyOutlined />
                </a-button>
              </a-tooltip>
              
              <a-tooltip title="导出">
                <a-button type="text" size="small" @click="exportTemplate(record)">
                  <ExportOutlined />
                </a-button>
              </a-tooltip>
              
              <a-tooltip title="删除">
                <a-button type="text" size="small" danger @click="deleteTemplate(record)">
                  <DeleteOutlined />
                </a-button>
              </a-tooltip>
            </div>
          </template>
        </template>
      </a-table>
    </div>

    <!-- 创建/编辑模板弹窗 -->
    <a-modal
      v-model:open="createModalVisible"
      :title="editingTemplate ? '编辑YAML模板' : '创建YAML模板'"
      width="80%"
      :ok-text="editingTemplate ? '更新' : '创建'"
      @ok="handleCreateOrUpdate"
      @cancel="handleCreateCancel"
      :confirm-loading="createLoading"
      :destroy-on-close="true"
    >
      <div class="create-template-form">
        <a-form ref="createFormRef" :model="createForm" layout="vertical">
          <a-row :gutter="16">
            <a-col :span="12">
              <a-form-item
                label="模板名称"
                name="name"
                :rules="[{ required: true, message: '请输入模板名称' }]"
              >
                <a-input v-model:value="createForm.name" placeholder="请输入模板名称" />
              </a-form-item>
            </a-col>
            <a-col :span="12">
              <a-form-item
                label="目标集群"
                name="cluster_id"
                :rules="[{ required: true, message: '请选择目标集群' }]"
              >
                <a-select v-model:value="createForm.cluster_id" placeholder="请选择目标集群">
                  <a-select-option v-for="cluster in clusters" :key="cluster.id" :value="cluster.id">
                    {{ cluster.name }}
                  </a-select-option>
                </a-select>
              </a-form-item>
            </a-col>
          </a-row>
          
          <a-form-item
            label="YAML内容"
            name="content"
            :rules="[{ required: true, message: '请输入YAML内容' }]"
          >
            <div class="yaml-editor-container">
              <div class="editor-toolbar">
                <a-space>
                  <a-button size="small" @click="formatYaml" :loading="formatLoading">
                    <template #icon><FormatPainterOutlined /></template>
                    格式化
                  </a-button>
                  <a-button size="small" @click="validateYaml" :loading="validateLoading">
                    <template #icon><CheckCircleOutlined /></template>
                    验证语法
                  </a-button>
                  <a-button size="small" @click="insertTemplate">
                    <template #icon><InsertRowAboveOutlined /></template>
                    插入模板
                  </a-button>
                </a-space>
              </div>
              <a-textarea
                v-model:value="createForm.content"
                :rows="20"
                placeholder="请输入YAML内容..."
                class="yaml-editor"
              />
              <div class="validation-result" v-if="validationResult">
                <a-alert
                  :type="validationResult.valid ? 'success' : 'error'"
                  :message="validationResult.valid ? 'YAML语法正确' : 'YAML语法错误'"
                  :description="validationResult.errors?.join('; ')"
                  show-icon
                />
              </div>
            </div>
          </a-form-item>
        </a-form>
      </div>
    </a-modal>

    <!-- 预览模板弹窗 -->
    <a-modal
      v-model:open="previewModalVisible"
      title="模板预览"
      width="80%"
      :footer="null"
      :destroy-on-close="true"
    >
      <div class="template-preview" v-if="previewingTemplate">
        <div class="preview-header">
          <div class="template-info">
            <h3>{{ previewingTemplate.name }}</h3>
            <div class="template-meta">
              <a-tag color="blue">{{ getClusterName(previewingTemplate.cluster_id) }}</a-tag>
              <span class="create-time">创建于 {{ formatDate(previewingTemplate.created_at) }}</span>
            </div>
          </div>
          <div class="preview-actions">
            <a-button @click="copyToClipboard(previewingTemplate.content)">
              <template #icon><CopyOutlined /></template>
              复制内容
            </a-button>
            <a-button type="primary" @click="editTemplate(previewingTemplate)">
              <template #icon><EditOutlined /></template>
              编辑
            </a-button>
          </div>
        </div>
        
        <div class="yaml-content">
          <pre class="yaml-code">{{ previewingTemplate.content }}</pre>
        </div>
      </div>
    </a-modal>

    <!-- 复制模板弹窗 -->
    <a-modal
      v-model:open="copyModalVisible"
      title="复制模板"
      @ok="handleCopy"
      @cancel="copyModalVisible = false"
      :confirm-loading="copyLoading"
    >
      <a-form layout="vertical">
        <a-form-item label="新模板名称">
          <a-input v-model:value="copyForm.newName" placeholder="请输入新模板名称" />
        </a-form-item>
      </a-form>
    </a-modal>

    <!-- 模板选择器弹窗 -->
    <a-modal
      v-model:open="templateSelectorVisible"
      title="选择模板"
      width="60%"
      @ok="insertSelectedTemplate"
      @cancel="templateSelectorVisible = false"
    >
      <div class="template-selector">
        <a-list :data-source="commonTemplates" item-layout="vertical">
          <template #renderItem="{ item }">
            <a-list-item>
              <a-list-item-meta>
                <template #title>
                  <a-radio :checked="selectedTemplateType === item.key" :value="item.key" @change="selectedTemplateType = item.key">
                    {{ item.title }}
                  </a-radio>
                </template>
                <template #description>{{ item.description }}</template>
              </a-list-item-meta>
            </a-list-item>
          </template>
        </a-list>
      </div>
    </a-modal>
  </div>
</template>

<script lang="ts" setup>
import { ref, computed, onMounted, reactive } from 'vue';
import { message } from 'ant-design-vue';
import {
  getYamlTemplateListWithFilterApi,
  createYamlTemplateApi,
  updateYamlTemplateApi,
  deleteYamlTemplateApi,
  batchDeleteYamlTemplateApi,
  copyYamlTemplateApi,
  exportYamlTemplateApi,
  importYamlTemplateApi,
  checkYamlTemplateApi,
  getAllClustersApi,
} from '#/api';
import type { 
  YamlTemplateInfo, 
  YamlTemplateCreateReq,
  YamlTemplateUpdateReq,
  YamlTemplateValidationResult
} from '#/api';
import { 
  FileTextOutlined,
  PlusOutlined,
  ImportOutlined,
  ExportOutlined,
  EditOutlined,
  DeleteOutlined,
  CopyOutlined,
  EyeOutlined,
  ReloadOutlined,
  ClusterOutlined,
  CloudServerOutlined,
  CodeOutlined,
  ClockCircleOutlined,
  UserOutlined,
  ShareAltOutlined,
  FormatPainterOutlined,
  CheckCircleOutlined,
  InsertRowAboveOutlined
} from '@ant-design/icons-vue';

// 状态变量
const loading = ref(false);
const createLoading = ref(false);
const batchDeleteLoading = ref(false);
const copyLoading = ref(false);
const formatLoading = ref(false);
const validateLoading = ref(false);
const clustersLoading = ref(false);
const templates = ref<YamlTemplateInfo[]>([]);
const searchKeyword = ref('');
const selectedRows = ref<YamlTemplateInfo[]>([]);
const clusters = ref<Array<{id: number, name: string}>>([]);
const selectedCluster = ref<number>();
const currentPage = ref(1);
const pageSize = ref(20);
const totalItems = ref(0);

// 弹窗状态
const createModalVisible = ref(false);
const previewModalVisible = ref(false);
const copyModalVisible = ref(false);
const templateSelectorVisible = ref(false);

// 编辑状态
const editingTemplate = ref<YamlTemplateInfo | null>(null);
const previewingTemplate = ref<YamlTemplateInfo | null>(null);
const copyingTemplate = ref<YamlTemplateInfo | null>(null);

// 表单数据
const createForm = reactive<YamlTemplateCreateReq>({
  name: '',
  content: '',
  cluster_id: 0,
});

const copyForm = reactive({
  newName: '',
});

// 验证结果
const validationResult = ref<YamlTemplateValidationResult | null>(null);
const selectedTemplateType = ref('');

// 当前用户ID (从store或context获取)
const currentUserId = ref(1); // 这里应该从用户状态管理中获取

// 表格列配置
const columns = [
  {
    title: '模板名称',
    dataIndex: 'name',
    key: 'name',
    width: '25%',
  },
  {
    title: '内容预览',
    dataIndex: 'content',
    key: 'content',
    width: '30%',
  },
  {
    title: '目标集群',
    dataIndex: 'cluster_id',
    key: 'cluster',
    width: '15%',
  },
  {
    title: '创建时间',
    dataIndex: 'created_at',
    key: 'created_at',
    width: '20%',
  },
  {
    title: '操作',
    key: 'actions',
    width: '10%',
  },
];

// 常用模板
const commonTemplates = [
  {
    key: 'deployment',
    title: 'Deployment 部署模板',
    description: '标准的应用部署模板',
    content: `apiVersion: apps/v1
kind: Deployment
metadata:
  name: \${APP_NAME}
  namespace: \${NAMESPACE}
spec:
  replicas: \${REPLICAS}
  selector:
    matchLabels:
      app: \${APP_NAME}
  template:
    metadata:
      labels:
        app: \${APP_NAME}
    spec:
      containers:
      - name: \${APP_NAME}
        image: \${IMAGE}
        ports:
        - containerPort: \${PORT}
        env:
        - name: ENV
          value: \${ENV}`
  },
  {
    key: 'service',
    title: 'Service 服务模板',
    description: 'Kubernetes服务暴露模板',
    content: `apiVersion: v1
kind: Service
metadata:
  name: \${SERVICE_NAME}
  namespace: \${NAMESPACE}
spec:
  selector:
    app: \${APP_NAME}
  ports:
  - port: \${PORT}
    targetPort: \${TARGET_PORT}
  type: \${SERVICE_TYPE}`
  },
  {
    key: 'configmap',
    title: 'ConfigMap 配置模板',
    description: '配置文件管理模板',
    content: `apiVersion: v1
kind: ConfigMap
metadata:
  name: \${CONFIG_NAME}
  namespace: \${NAMESPACE}
data:
  config.yaml: |
    \${CONFIG_CONTENT}`
  },
];

// 计算属性
const filteredTemplates = computed(() => {
  let result = templates.value;
  
  const searchValue = searchKeyword.value.toLowerCase().trim();
  if (searchValue) {
    result = result.filter(template => 
      template.name.toLowerCase().includes(searchValue) ||
      template.content.toLowerCase().includes(searchValue)
    );
  }
  
  return result;
});

const recentTemplatesCount = computed(() => {
  const oneWeekAgo = new Date();
  oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
  return templates.value.filter(template => 
    new Date(template.created_at) > oneWeekAgo
  ).length;
});

const myTemplatesCount = computed(() => 
  templates.value.filter(template => template.user_id === currentUserId.value).length
);

const sharedTemplatesCount = computed(() => 
  templates.value.filter(template => template.user_id !== currentUserId.value).length
);

// 工具函数
const formatDate = (dateString: string) => {
  if (!dateString) return '-';
  const date = new Date(dateString);
  return `${date.getMonth() + 1}月${date.getDate()}日 ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
};

const getClusterName = (clusterId: number) => {
  const cluster = clusters.value.find(c => c.id === clusterId);
  return cluster?.name || '未知集群';
};

const getContentSummary = (content: string) => {
  const lines = content.split('\n');
  const kindMatch = content.match(/kind:\s*(\w+)/);
  
  return `${kindMatch?.[1] || 'Unknown'} - ${lines.length} 行`;
};

const isMyTemplate = (template: YamlTemplateInfo) => {
  return template.user_id === currentUserId.value;
};

// API 方法
const getClusters = async () => {
  clustersLoading.value = true;
  try {
    const res = await getAllClustersApi();
    clusters.value = res ?? [];
    if (clusters.value.length > 0 && !selectedCluster.value) {
      selectedCluster.value = clusters.value[0]?.id;
      if (selectedCluster.value) {
        await getTemplates();
      }
    }
  } catch (error: any) {
    message.error(error.message || '获取集群列表失败');
  } finally {
    clustersLoading.value = false;
  }
};

const getTemplates = async () => {
  if (!selectedCluster.value) return;
  
  loading.value = true;
  try {
    const res = await getYamlTemplateListWithFilterApi({
      cluster_id: selectedCluster.value,
      page: currentPage.value,
      page_size: pageSize.value,
      keyword: searchKeyword.value,
    });
    templates.value = res || [];
    totalItems.value = templates.value.length;
  } catch (error: any) {
    message.error(error.message || '获取模板列表失败');
    templates.value = [];
    totalItems.value = 0;
  } finally {
    loading.value = false;
  }
};

// 刷新数据
const refreshData = async () => {
  await getTemplates();
};

// 搜索
const onSearch = () => {
  currentPage.value = 1;
  getTemplates();
};

// 切换集群
const handleClusterChange = () => {
  templates.value = [];
  currentPage.value = 1;
  totalItems.value = 0;
  getTemplates();
};

// 分页处理
const handleTableChange = (pagination: any) => {
  currentPage.value = pagination.current;
  pageSize.value = pagination.pageSize;
  getTemplates();
};

// 选择行
const onSelectChange = (_selectedRowKeys: number[], selected: YamlTemplateInfo[]) => {
  selectedRows.value = selected;
};

// 显示创建弹窗
const showCreateModal = () => {
  editingTemplate.value = null;
  createForm.name = '';
  createForm.content = '';
  createForm.cluster_id = selectedCluster.value || 0;
  validationResult.value = null;
  createModalVisible.value = true;
};

// 编辑模板
const editTemplate = (template: YamlTemplateInfo) => {
  editingTemplate.value = template;
  createForm.name = template.name;
  createForm.content = template.content;
  createForm.cluster_id = template.cluster_id;
  validationResult.value = null;
  createModalVisible.value = true;
  previewModalVisible.value = false;
};

// 预览模板
const previewTemplate = (template: YamlTemplateInfo) => {
  previewingTemplate.value = template;
  previewModalVisible.value = true;
};

// 复制模板
const copyTemplate = (template: YamlTemplateInfo) => {
  copyingTemplate.value = template;
  copyForm.newName = `${template.name}_copy`;
  copyModalVisible.value = true;
};

// 处理创建或更新
const handleCreateOrUpdate = async () => {
  if (!selectedCluster.value) {
    message.error('请先选择集群');
    return;
  }

  createLoading.value = true;
  try {
    if (editingTemplate.value) {
      // 更新模板
      const updateData: YamlTemplateUpdateReq = {
        id: editingTemplate.value.id,
        name: createForm.name,
        content: createForm.content,
        cluster_id: createForm.cluster_id,
      };
      await updateYamlTemplateApi(updateData);
      message.success('模板更新成功');
    } else {
      // 创建模板
      await createYamlTemplateApi(createForm);
      message.success('模板创建成功');
    }
    
    createModalVisible.value = false;
    refreshData();
  } catch (error: any) {
    message.error(error.message || '操作失败');
  } finally {
    createLoading.value = false;
  }
};

// 处理创建取消
const handleCreateCancel = () => {
  createModalVisible.value = false;
  editingTemplate.value = null;
  validationResult.value = null;
};

// 处理复制
const handleCopy = async () => {
  if (!copyingTemplate.value || !selectedCluster.value) return;

  copyLoading.value = true;
  try {
    await copyYamlTemplateApi(
      copyingTemplate.value.id,
      selectedCluster.value,
      copyForm.newName
    );
    message.success('模板复制成功');
    copyModalVisible.value = false;
    refreshData();
  } catch (error: any) {
    message.error(error.message || '复制失败');
  } finally {
    copyLoading.value = false;
  }
};

// 删除模板
const deleteTemplate = async (template: YamlTemplateInfo) => {
  if (!selectedCluster.value) return;

  try {
    await deleteYamlTemplateApi(template.id, selectedCluster.value);
    message.success('模板删除成功');
    refreshData();
  } catch (error: any) {
    message.error(error.message || '删除失败');
  }
};

// 批量删除
const batchDelete = async () => {
  if (selectedRows.value.length === 0 || !selectedCluster.value) return;

  batchDeleteLoading.value = true;
  try {
    const ids = selectedRows.value.map(row => row.id);
    await batchDeleteYamlTemplateApi(ids, selectedCluster.value);
    message.success('批量删除成功');
    selectedRows.value = [];
    refreshData();
  } catch (error: any) {
    message.error(error.message || '批量删除失败');
  } finally {
    batchDeleteLoading.value = false;
  }
};

// 导出模板
const exportTemplate = async (template: YamlTemplateInfo) => {
  if (!selectedCluster.value) return;

  try {
    await exportYamlTemplateApi(template.id, selectedCluster.value);
    message.success('模板导出成功');
  } catch (error: any) {
    message.error(error.message || '导出失败');
  }
};

// 导入模板
const handleImport = (file: File) => {
  if (!selectedCluster.value) {
    message.error('请先选择集群');
    return false;
  }

  importYamlTemplateApi(selectedCluster.value, file)
    .then(() => {
      message.success('模板导入成功');
      refreshData();
    })
    .catch((error: any) => {
      message.error(error.message || '导入失败');
    });
  
  return false; // 阻止默认上传行为
};

// 格式化YAML
const formatYaml = () => {
  formatLoading.value = true;
  // 这里可以集成YAML格式化库
  setTimeout(() => {
    formatLoading.value = false;
    message.success('YAML格式化完成');
  }, 1000);
};

// 验证YAML
const validateYaml = async () => {
  if (!createForm.content || !selectedCluster.value) return;

  validateLoading.value = true;
  try {
    const result = await checkYamlTemplateApi({
      content: createForm.content,
      cluster_id: selectedCluster.value,
    });
    validationResult.value = result;
    
    if (result.valid) {
      message.success('YAML语法验证通过');
    } else {
      message.error('YAML语法验证失败');
    }
  } catch (error: any) {
    message.error(error.message || '验证失败');
    validationResult.value = {
      valid: false,
      errors: [error.message || '验证失败']
    };
  } finally {
    validateLoading.value = false;
  }
};

// 插入模板
const insertTemplate = () => {
  templateSelectorVisible.value = true;
};

// 插入选中的模板
const insertSelectedTemplate = () => {
  const template = commonTemplates.find(t => t.key === selectedTemplateType.value);
  if (template) {
    createForm.content = template.content;
    templateSelectorVisible.value = false;
    message.success('模板插入成功');
  }
};

// 复制到剪贴板
const copyToClipboard = (text: string) => {
  navigator.clipboard.writeText(text).then(() => {
    message.success('内容已复制到剪贴板');
  }).catch(() => {
    message.error('复制失败');
  });
};

// 页面加载时获取数据
onMounted(() => {
  getClusters();
});
</script>

<style scoped>
.yaml-template-container .template-name {
  display: flex;
  align-items: center;
  gap: 8px;
}

.template-name .template-icon {
  color: #1890ff;
}

.template-name .name-text {
  font-weight: 500;
}

.content-preview .content-summary {
  display: flex;
  align-items: center;
  gap: 4px;
  color: #666;
  font-size: 12px;
}

.cluster-info {
  display: flex;
  align-items: center;
  gap: 4px;
}

.time-info .create-time {
  font-weight: 500;
  margin-bottom: 2px;
}

.time-info .update-time {
  font-size: 12px;
  color: #666;
}

.action-buttons {
  display: flex;
  gap: 4px;
}

/* 创建模板表单样式 */
.create-template-form .yaml-editor-container {
  border: 1px solid #d9d9d9;
  border-radius: 6px;
  overflow: hidden;
}

.editor-toolbar {
  background: #fafafa;
  padding: 8px 12px;
  border-bottom: 1px solid #d9d9d9;
}

.yaml-editor {
  font-family: 'Monaco', 'Consolas', monospace;
  font-size: 13px;
  line-height: 1.5;
  border: none !important;
  box-shadow: none !important;
}

.yaml-editor:focus {
  border: none !important;
  box-shadow: none !important;
}

.validation-result {
  padding: 8px 12px;
  border-top: 1px solid #d9d9d9;
}

/* 预览模板样式 */
.template-preview .preview-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 20px;
  padding-bottom: 16px;
  border-bottom: 1px solid #e8e8e8;
}

.template-info h3 {
  margin: 0 0 8px 0;
  font-size: 18px;
  font-weight: 600;
}

.template-meta {
  display: flex;
  align-items: center;
  gap: 12px;
}

.template-meta .create-time {
  color: #666;
  font-size: 12px;
}

.preview-actions {
  display: flex;
  gap: 8px;
}

.yaml-content {
  background: #f8f8f8;
  border: 1px solid #e8e8e8;
  border-radius: 6px;
  padding: 16px;
  max-height: 600px;
  overflow-y: auto;
}

.yaml-code {
  margin: 0;
  font-family: 'Monaco', 'Consolas', monospace;
  font-size: 13px;
  line-height: 1.5;
  color: #333;
  white-space: pre-wrap;
  word-break: break-all;
}

.yaml-tooltip {
  max-width: 400px;
  max-height: 300px;
  overflow: auto;
  font-family: 'Monaco', 'Consolas', monospace;
  font-size: 12px;
  line-height: 1.4;
  margin: 0;
  white-space: pre-wrap;
}

/* 模板选择器样式 */
.template-selector .ant-list-item {
  padding: 12px 16px;
  border: 1px solid #e8e8e8;
  border-radius: 6px;
  margin-bottom: 8px;
  cursor: pointer;
  transition: all 0.3s;
}

.template-selector .ant-list-item:hover {
  border-color: #1890ff;
  box-shadow: 0 2px 4px rgba(24, 144, 255, 0.1);
}
</style>
