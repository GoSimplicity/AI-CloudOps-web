<template>
  <div class="process-management-container">
    <div class="page-header">
      <div class="header-actions">
        <a-button type="primary" @click="handleCreateProcess" class="btn-create">
          <template #icon>
            <PlusOutlined />
          </template>
          创建新流程
        </a-button>
        <div class="search-filters">
          <a-input-search 
            v-model:value="searchQuery" 
            placeholder="搜索流程..." 
            class="search-input" 
            @search="handleSearch"
            allow-clear 
          />
          <a-select 
            v-model:value="statusFilter" 
            placeholder="状态" 
            class="status-filter" 
            @change="handleStatusChange"
          >
            <a-select-option :value="null">全部</a-select-option>
            <a-select-option :value="ProcessStatus.Draft">草稿</a-select-option>
            <a-select-option :value="ProcessStatus.Published">已发布</a-select-option>
            <a-select-option :value="ProcessStatus.Archived">已归档</a-select-option>
          </a-select>
          <a-select 
            v-model:value="categoryFilter" 
            placeholder="分类" 
            class="category-filter"
            @change="handleCategoryChange"
          >
            <a-select-option :value="null">全部分类</a-select-option>
            <a-select-option v-for="category in categories" :key="category.id" :value="category.id">
              {{ category.name }}
            </a-select-option>
          </a-select>
        </div>
      </div>
    </div>

    <div class="stats-row">
      <a-row :gutter="16">
        <a-col :span="6">
          <a-card class="stats-card">
            <a-statistic title="总流程数" :value="stats.total" :value-style="{ color: '#3f8600' }">
              <template #prefix>
                <ApartmentOutlined />
              </template>
            </a-statistic>
          </a-card>
        </a-col>
        <a-col :span="6">
          <a-card class="stats-card">
            <a-statistic title="已发布" :value="stats.published" :value-style="{ color: '#52c41a' }">
              <template #prefix>
                <CheckCircleOutlined />
              </template>
            </a-statistic>
          </a-card>
        </a-col>
        <a-col :span="6">
          <a-card class="stats-card">
            <a-statistic title="草稿" :value="stats.draft" :value-style="{ color: '#faad14' }">
              <template #prefix>
                <EditOutlined />
              </template>
            </a-statistic>
          </a-card>
        </a-col>
        <a-col :span="6">
          <a-card class="stats-card">
            <a-statistic title="已归档" :value="stats.archived" :value-style="{ color: '#cf1322' }">
              <template #prefix>
                <StopOutlined />
              </template>
            </a-statistic>
          </a-card>
        </a-col>
      </a-row>
    </div>

    <div class="table-container">
      <a-card>
        <a-table 
          :data-source="processList" 
          :columns="columns" 
          :pagination="paginationConfig" 
          :loading="loading"
          row-key="id" 
          bordered 
          :scroll="{ x: 1200 }" 
          @change="handleTableChange"
        >
          <template #bodyCell="{ column, record }">
            <template v-if="column.key === 'name'">
              <div class="process-name-cell">
                <div class="process-badge" :class="getStatusClass(record.status)"></div>
                <span class="process-name-text">{{ record.name }}</span>
              </div>
            </template>

            <template v-if="column.key === 'description'">
              <span class="description-text">{{ record.description || '无描述' }}</span>
            </template>

            <template v-if="column.key === 'status'">
              <a-tag :color="getStatusColor(record.status)">
                {{ getStatusText(record.status) }}
              </a-tag>
            </template>

            <template v-if="column.key === 'form_design'">
              <span>{{ getFormName(record.form_design_id) }}</span>
            </template>

            <template v-if="column.key === 'category'">
              <span>{{ getCategoryName(record.category_id) }}</span>
            </template>

            <template v-if="column.key === 'operator'">
              <div class="creator-info">
                <a-avatar size="small" :style="{ backgroundColor: getAvatarColor(record.operator_name) }">
                  {{ getInitials(record.operator_name) }}
                </a-avatar>
                <span class="creator-name">{{ record.operator_name }}</span>
              </div>
            </template>

            <template v-if="column.key === 'is_default'">
              <a-tag :color="record.is_default ? 'green' : 'default'">
                {{ record.is_default ? '是' : '否' }}
              </a-tag>
            </template>

            <template v-if="column.key === 'tags'">
              <div class="tags-container">
                <a-tag v-for="tag in record.tags" :key="tag" color="blue">
                  {{ tag }}
                </a-tag>
                <span v-if="!record.tags || record.tags.length === 0" class="no-tags">无标签</span>
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
                <a-button type="primary" size="small" @click="handleViewProcess(record)">
                  查看
                </a-button>
                <a-button type="default" size="small" @click="handleEditProcess(record)">
                  编辑
                </a-button>
                <a-dropdown>
                  <template #overlay>
                    <a-menu @click="(e: any) => handleCommand(e.key, record)">
                      <a-menu-item key="publish" v-if="record.status === ProcessStatus.Draft">发布</a-menu-item>
                      <a-menu-item key="archive" v-if="record.status === ProcessStatus.Published">归档</a-menu-item>
                      <a-menu-item key="activate" v-if="record.status === ProcessStatus.Archived">激活</a-menu-item>
                      <a-menu-item key="setDefault" v-if="!record.is_default">设为默认</a-menu-item>
                      <a-menu-divider />
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

    <!-- 流程创建/编辑对话框 -->
    <a-modal 
      :open="processDialog.visible" 
      :title="processDialog.isEdit ? '编辑流程' : '创建流程'" 
      :width="formDialogWidth"
      @ok="saveProcess" 
      @cancel="closeProcessDialog" 
      :destroy-on-close="true"
      class="responsive-modal process-design-modal" 
      :confirm-loading="loading"
    >
      <div class="modal-content">
        <!-- 流程编辑模式切换 -->
        <div class="edit-mode-tabs">
          <a-tabs v-model:activeKey="editMode" type="card">
            <a-tab-pane key="basic" tab="基本信息">
              <ProcessBasicConfig
                ref="basicConfigRef"
                v-model="processDialog.form"
                :categories="categories"
                :forms="formDesigns"
              />
            </a-tab-pane>
          </a-tabs>
        </div>
      </div>
    </a-modal>

    <!-- 详情对话框 -->
    <a-modal 
      :open="detailDialog.visible" 
      title="流程详情" 
      :width="previewDialogWidth" 
      :footer="null"
      @cancel="closeDetailDialog" 
      class="detail-dialog responsive-modal"
    >
      <div v-if="detailDialog.process" class="process-details">
        <div class="detail-header">
          <h2>{{ detailDialog.process.name }}</h2>
          <a-tag :color="getStatusColor(detailDialog.process.status)">
            {{ getStatusText(detailDialog.process.status) }}
          </a-tag>
        </div>

        <a-descriptions bordered :column="2">
          <a-descriptions-item label="ID">{{ detailDialog.process.id }}</a-descriptions-item>
          <a-descriptions-item label="操作人">{{ detailDialog.process.operator_name }}</a-descriptions-item>
          <a-descriptions-item label="创建时间">{{ formatFullDateTime(detailDialog.process.created_at) }}</a-descriptions-item>
          <a-descriptions-item label="更新时间">{{ formatFullDateTime(detailDialog.process.updated_at) }}</a-descriptions-item>
          <a-descriptions-item label="关联表单">{{ getFormName(detailDialog.process.form_design_id) }}</a-descriptions-item>
          <a-descriptions-item label="分类">{{ getCategoryName(detailDialog.process.category_id) }}</a-descriptions-item>
          <a-descriptions-item label="是否默认">{{ detailDialog.process.is_default ? '是' : '否' }}</a-descriptions-item>
          <a-descriptions-item label="标签">
            <div class="tags-container">
              <a-tag v-for="tag in detailDialog.process.tags" :key="tag" color="blue">
                {{ tag }}
              </a-tag>
              <span v-if="!detailDialog.process.tags || detailDialog.process.tags.length === 0">无标签</span>
            </div>
          </a-descriptions-item>
          <a-descriptions-item label="描述" :span="2">{{ detailDialog.process.description || '无描述' }}</a-descriptions-item>
        </a-descriptions>

        <div class="process-preview">
          <h3>流程定义</h3>
          <a-card>
            <pre class="definition-json">{{ formatDefinitionForDisplay(detailDialog.process.definition) }}</pre>
          </a-card>
        </div>

        <div class="detail-footer">
          <a-button @click="closeDetailDialog">关闭</a-button>
          <a-button type="primary" @click="handleEditProcess(detailDialog.process)">编辑</a-button>
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
  ApartmentOutlined,
  CheckCircleOutlined,
  EditOutlined,
  StopOutlined,
  DownOutlined
} from '@ant-design/icons-vue';

import {
  type WorkorderProcessItem,
  type CreateWorkorderProcessReq,
  type UpdateWorkorderProcessReq,
  type ListWorkorderProcessReq,
  ProcessStatus,
  listWorkorderProcess,
  detailWorkorderProcess,
  createWorkorderProcess,
  updateWorkorderProcess,
  deleteWorkorderProcess
} from '#/api/core/workorder_process';

import { 
  type WorkorderCategoryItem, 
  listWorkorderCategory 
} from '#/api/core/workorder_category';

import { 
  type WorkorderFormDesignItem, 
  listWorkorderFormDesign,
  FormDesignStatus
} from '#/api/core/workorder_form_design';

import ProcessBasicConfig from './components/ProcessBasicConfig.vue';

// 列定义
const columns = [
  {
    title: '流程名称',
    dataIndex: 'name',
    key: 'name',
    width: 200,
  },
  {
    title: '描述',
    dataIndex: 'description',
    key: 'description',
    width: 200,
    ellipsis: true,
  },
  {
    title: '关联表单',
    dataIndex: 'form_design_id',
    key: 'form_design',
    width: 150,
  },
  {
    title: '分类',
    dataIndex: 'category_id',
    key: 'category',
    width: 120,
  },
  {
    title: '状态',
    dataIndex: 'status',
    key: 'status',
    width: 120,
    align: 'center' as const,
  },
  {
    title: '默认流程',
    dataIndex: 'is_default',
    key: 'is_default',
    width: 100,
    align: 'center' as const,
  },
  {
    title: '标签',
    dataIndex: 'tags',
    key: 'tags',
    width: 150,
  },
  {
    title: '操作人',
    dataIndex: 'operator_name',
    key: 'operator',
    width: 150,
  },
  {
    title: '创建时间',
    dataIndex: 'created_at',
    key: 'createdAt',
    width: 180,
  },
  {
    title: '操作',
    key: 'action',
    width: 200,
    align: 'center' as const,
  },
];

// 状态数据
const loading = ref(false);
const searchQuery = ref('');
const statusFilter = ref<number | null>(null);
const categoryFilter = ref<number | null>(null);
const currentPage = ref(1);
const pageSize = ref(10);
const total = ref(0);

// 编辑模式
const editMode = ref('basic');

// 组件引用
const basicConfigRef = ref();

// 统计数据
const stats = reactive({
  total: 0,
  published: 0,
  draft: 0,
  archived: 0
});

// 数据列表
const processList = ref<WorkorderProcessItem[]>([]);
const categories = ref<WorkorderCategoryItem[]>([]);
const formDesigns = ref<WorkorderFormDesignItem[]>([]);

// 分页配置
const paginationConfig = computed(() => ({
  current: currentPage.value,
  pageSize: pageSize.value,
  total: total.value,
  showSizeChanger: true,
  showQuickJumper: true,
  showTotal: (total: number) => `共 ${total} 条`,
  pageSizeOptions: ['10', '20', '50', '100'],
}));

// 流程对话框
const processDialog = reactive({
  visible: false,
  isEdit: false,
  form: {
    id: undefined,
    name: '',
    description: '',
    form_design_id: 0,
    category_id: undefined,
    status: ProcessStatus.Draft,
    tags: [],
    is_default: 2,
    definition: {
      steps: [],
      connections: []
    }
  } as CreateWorkorderProcessReq & { id?: number }
});

// 详情对话框
const detailDialog = reactive({
  visible: false,
  process: null as WorkorderProcessItem | null
});

const formDialogWidth = computed(() => {
  if (typeof window !== 'undefined') {
    const width = window.innerWidth;
    if (width < 768) return '95%';
    if (width < 1024) return '90%';
    return '1000px';
  }
  return '1000px';
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

// 表格变化处理 - 实现真分页
const handleTableChange = (pagination: any): void => {
  if (pagination.current !== currentPage.value) {
    currentPage.value = pagination.current;
  }
  if (pagination.pageSize !== pageSize.value) {
    pageSize.value = pagination.pageSize;
    currentPage.value = 1; // 改变页大小时重置到第一页
  }
  loadProcesses();
};

/**
 * 加载流程列表数据 - 实现真分页
 */
const loadProcesses = async (): Promise<void> => {
  loading.value = true;
  try {
    const params: ListWorkorderProcessReq = {
      page: currentPage.value,
      size: pageSize.value,
      search: searchQuery.value || undefined,
      status: statusFilter.value || undefined,
      category_id: categoryFilter.value || undefined
    };

    const res = await listWorkorderProcess(params) as any;
    if (res && res.items) {
      processList.value = res.items || [];
      total.value = res.total || 0;

      // 更新统计数据
      const allProcesses = res.items || [];
      stats.total = res.total || 0;
      stats.published = allProcesses.filter((p: WorkorderProcessItem) => p.status === ProcessStatus.Published).length;
      stats.draft = allProcesses.filter((p: WorkorderProcessItem) => p.status === ProcessStatus.Draft).length;
      stats.archived = allProcesses.filter((p: WorkorderProcessItem) => p.status === ProcessStatus.Archived).length;
    }
  } catch (error: any) {
    message.error('加载流程数据失败');
    console.error('Failed to load processes:', error);
  } finally {
    loading.value = false;
  }
};

/**
 * 加载分类数据 - 实现真分页
 */
const loadCategories = async (): Promise<void> => {
  try {
    let allCategories: any[] = [];
    let currentPage = 1;
    const pageSize = 50;
    let hasMoreData = true;

    while (hasMoreData) {
      const params = {
        page: currentPage,
        size: pageSize,
        search: undefined
      };

      const res = await listWorkorderCategory(params) as any;
      if (res && res.items && res.items.length > 0) {
        allCategories = [...allCategories, ...res.items];
        
        // 检查是否还有更多数据
        if (res.items.length < pageSize || allCategories.length >= (res.total || 0)) {
          hasMoreData = false;
        } else {
          currentPage++;
        }
      } else {
        hasMoreData = false;
      }
    }

    categories.value = allCategories;
  } catch (error: any) {
    console.error('Failed to load categories:', error);
    categories.value = [];
  }
};

/**
 * 加载表单列表用于显示 - 实现真分页
 */
const loadFormDesigns = async (): Promise<void> => {
  try {
    let allForms: any[] = [];
    let currentPage = 1;
    const pageSize = 50;
    let hasMoreData = true;

    while (hasMoreData) {
      const params = {
        page: currentPage,
        size: pageSize,
        search: undefined,
        status: FormDesignStatus.Published // 只获取已发布的表单
      };

      const res = await listWorkorderFormDesign(params) as any;
      if (res && res.items && res.items.length > 0) {
        allForms = [...allForms, ...res.items];
        
        // 检查是否还有更多数据
        if (res.items.length < pageSize || allForms.length >= (res.total || 0)) {
          hasMoreData = false;
        } else {
          currentPage++;
        }
      } else {
        hasMoreData = false;
      }
    }

    formDesigns.value = allForms;
  } catch (error: any) {
    console.error('Failed to load forms:', error);
    formDesigns.value = [];
  }
};

// 事件处理
const handleSearch = (): void => {
  currentPage.value = 1;
  loadProcesses();
};

const handleStatusChange = (): void => {
  currentPage.value = 1;
  loadProcesses();
};

const handleCategoryChange = (): void => {
  currentPage.value = 1;
  loadProcesses();
};

const handleCreateProcess = (): void => {
  processDialog.isEdit = false;
  processDialog.form = {
    name: '',
    description: '',
    form_design_id: 0,
    category_id: undefined,
    status: ProcessStatus.Draft,
    tags: [],
    is_default: 2,
    definition: {
      steps: [],
      connections: []
    }
  };
  editMode.value = 'basic';
  processDialog.visible = true;
};

const handleEditProcess = async (row: WorkorderProcessItem): Promise<void> => {
  processDialog.isEdit = true;
  loading.value = true;

  try {
    const res = await detailWorkorderProcess({ id: row.id! }) as WorkorderProcessItem;
    if (res) {
      processDialog.form = {
        id: res.id,
        name: res.name,
        description: res.description,
        form_design_id: res.form_design_id,
        category_id: res.category_id,
        status: res.status,
        tags: res.tags || [],
        is_default: res.is_default as 1 | 2,
        definition: res.definition
      };

      editMode.value = 'basic';
      processDialog.visible = true;
      detailDialog.visible = false;
    }
  } catch (error: any) {
    message.error('获取流程详情失败');
    console.error('Failed to get process details:', error);
  } finally {
    loading.value = false;
  }
};

const handleViewProcess = async (row: WorkorderProcessItem): Promise<void> => {
  loading.value = true;

  try {
    const res = await detailWorkorderProcess({ id: row.id! }) as WorkorderProcessItem;
    if (res) {
      detailDialog.process = res;
      detailDialog.visible = true;
    }
  } catch (error: any) {
    message.error('获取流程详情失败');
    console.error('Failed to get process details:', error);
  } finally {
    loading.value = false;
  }
};

const handleCommand = async (command: string, row: WorkorderProcessItem): Promise<void> => {
  switch (command) {
    case 'publish':
      await publishProcess(row);
      break;
    case 'archive':
      await archiveProcess(row);
      break;
    case 'activate':
      await activateProcess(row);
      break;
    case 'setDefault':
      await setDefaultProcess(row);
      break;
    case 'delete':
      confirmDelete(row);
      break;
  }
};

const publishProcess = async (process: WorkorderProcessItem): Promise<void> => {
  loading.value = true;
  try {
    const params: UpdateWorkorderProcessReq = {
      id: process.id!,
      name: process.name,
      description: process.description || '',
      form_design_id: process.form_design_id,
      category_id: process.category_id,
      status: ProcessStatus.Published,
      tags: process.tags,
      is_default: process.is_default as 1 | 2,
      definition: process.definition
    };

    await updateWorkorderProcess(params);
    message.success(`流程 "${process.name}" 已发布`);
    loadProcesses();
  } catch (error: any) {
    message.error(`发布流程失败: ${error.message || '未知错误'}`);
  } finally {
    loading.value = false;
  }
};

const archiveProcess = async (process: WorkorderProcessItem): Promise<void> => {
  loading.value = true;
  try {
    const params: UpdateWorkorderProcessReq = {
      id: process.id!,
      name: process.name,
      description: process.description || '',
      form_design_id: process.form_design_id,
      category_id: process.category_id,
      status: ProcessStatus.Archived,
      tags: process.tags,
      is_default: process.is_default as 1 | 2,
      definition: process.definition
    };

    await updateWorkorderProcess(params);
    message.success(`流程 "${process.name}" 已归档`);
    loadProcesses();
  } catch (error: any) {
    message.error(`归档流程失败: ${error.message || '未知错误'}`);
  } finally {
    loading.value = false;
  }
};

const activateProcess = async (process: WorkorderProcessItem): Promise<void> => {
  loading.value = true;
  try {
    const params: UpdateWorkorderProcessReq = {
      id: process.id!,
      name: process.name,
      description: process.description || '',
      form_design_id: process.form_design_id,
      category_id: process.category_id,
      status: ProcessStatus.Draft,
      tags: process.tags,
      is_default: process.is_default as 1 | 2,
      definition: process.definition
    };

    await updateWorkorderProcess(params);
    message.success(`流程 "${process.name}" 已激活`);
    loadProcesses();
  } catch (error: any) {
    message.error(`激活流程失败: ${error.message || '未知错误'}`);
  } finally {
    loading.value = false;
  }
};

const setDefaultProcess = async (process: WorkorderProcessItem): Promise<void> => {
  loading.value = true;
  try {
    const params: UpdateWorkorderProcessReq = {
      id: process.id!,
      name: process.name,
      description: process.description || '',
      form_design_id: process.form_design_id,
      category_id: process.category_id,
      status: process.status,
      tags: process.tags,
      is_default: 1 as 1 | 2,
      definition: process.definition
    };

    await updateWorkorderProcess(params);
    message.success(`流程 "${process.name}" 已设为默认`);
    loadProcesses();
  } catch (error: any) {
    message.error(`设置默认流程失败: ${error.message || '未知错误'}`);
  } finally {
    loading.value = false;
  }
};

const confirmDelete = (process: WorkorderProcessItem): void => {
  Modal.confirm({
    title: '警告',
    content: `确定要删除流程 "${process.name}" 吗？这个操作不可恢复！`,
    okText: '删除',
    okType: 'danger',
    cancelText: '取消',
    async onOk() {
      try {
        loading.value = true;
        await deleteWorkorderProcess({ id: process.id! });
        message.success(`流程 "${process.name}" 已删除`);

        // 如果删除后当前页没有数据且不是第一页，则返回上一页
        if (processList.value.length === 1 && currentPage.value > 1) {
          currentPage.value = currentPage.value - 1;
        }

        loadProcesses();
      } catch (error: any) {
        message.error(`删除流程失败: ${error.message || '未知错误'}`);
      } finally {
        loading.value = false;
      }
    }
  });
};

const saveProcess = async (): Promise<void> => {
  try {
    // 验证基础配置
    if (editMode.value === 'basic') {
      const isValid = await basicConfigRef.value?.validate();
      if (!isValid) {
        return;
      }
    }

    if (!processDialog.form.name.trim()) {
      message.error('流程名称不能为空');
      return;
    }

    if (!processDialog.form.form_design_id) {
      message.error('请选择关联表单');
      return;
    }

    loading.value = true;

    if (processDialog.isEdit && processDialog.form.id) {
      const updateData: UpdateWorkorderProcessReq = {
        id: processDialog.form.id,
        name: processDialog.form.name,
        description: processDialog.form.description || '',
        form_design_id: processDialog.form.form_design_id,
        definition: processDialog.form.definition,
        category_id: processDialog.form.category_id,
        status: processDialog.form.status,
        tags: processDialog.form.tags,
        is_default: processDialog.form.is_default
      };

      await updateWorkorderProcess(updateData);
      message.success(`流程 "${processDialog.form.name}" 已更新`);
    } else {
      const createData: CreateWorkorderProcessReq = {
        name: processDialog.form.name,
        description: processDialog.form.description,
        form_design_id: processDialog.form.form_design_id,
        definition: processDialog.form.definition,
        category_id: processDialog.form.category_id,
        status: processDialog.form.status,
        tags: processDialog.form.tags,
        is_default: processDialog.form.is_default
      };

      await createWorkorderProcess(createData);
      message.success(`流程 "${processDialog.form.name}" 已创建`);
      currentPage.value = 1;
    }

    processDialog.visible = false;
    loadProcesses();
  } catch (error: any) {
    message.error(processDialog.isEdit
      ? `更新流程失败: ${error.message || '未知错误'}`
      : `创建流程失败: ${error.message || '未知错误'}`
    );
  } finally {
    loading.value = false;
  }
};

// 对话框关闭方法
const closeProcessDialog = (): void => {
  processDialog.visible = false;
};

const closeDetailDialog = (): void => {
  detailDialog.visible = false;
};


const formatDate = (dateStr: string | undefined): string => {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' });
};

const formatTime = (dateStr: string | undefined): string => {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
};

const formatFullDateTime = (dateStr: string | undefined): string => {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleString('zh-CN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

const getInitials = (name: string | undefined): string => {
  if (!name) return '';
  return name
    .split('')
    .slice(0, 2)
    .join('')
    .toUpperCase();
};

const getStatusClass = (status: number): string => {
  switch (status) {
    case ProcessStatus.Draft: return 'status-draft';
    case ProcessStatus.Published: return 'status-published';
    case ProcessStatus.Archived: return 'status-archived';
    default: return '';
  }
};

const getStatusColor = (status: number): string => {
  switch (status) {
    case ProcessStatus.Draft: return 'orange';
    case ProcessStatus.Published: return 'green';
    case ProcessStatus.Archived: return 'default';
    default: return 'default';
  }
};

const getStatusText = (status: number): string => {
  switch (status) {
    case ProcessStatus.Draft: return '草稿';
    case ProcessStatus.Published: return '已发布';
    case ProcessStatus.Archived: return '已归档';
    default: return '未知';
  }
};

const getAvatarColor = (name: string | undefined): string => {
  if (!name) return '#1890ff';

  const colors = [
    '#1890ff', '#52c41a', '#faad14', '#f5222d',
    '#722ed1', '#13c2c2', '#eb2f96', '#fa8c16'
  ];

  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }

  return colors[Math.abs(hash) % colors.length] || '#1890ff';
};

const getFormName = (formId: number | undefined): string => {
  if (!formId) return '未知表单';
  const form = formDesigns.value.find(f => f.id === formId);
  return form ? form.name : `表单${formId}`;
};

const getCategoryName = (categoryId: number | undefined): string => {
  if (!categoryId) return '无分类';
  const category = categories.value.find(c => c.id === categoryId);
  return category ? category.name : `分类${categoryId}`;
};

const formatDefinitionForDisplay = (definition: any): string => {
  if (!definition) return '{}';
  if (typeof definition === 'string') {
    try {
      return JSON.stringify(JSON.parse(definition), null, 2);
    } catch (e) {
      return definition;
    }
  }
  return JSON.stringify(definition, null, 2);
};

// 初始化
onMounted(async (): Promise<void> => {
  loading.value = true;
  try {
    await Promise.all([
      loadProcesses(),
      loadCategories(),
      loadFormDesigns()
    ]);
  } catch (error: any) {
    console.error('初始化数据加载失败:', error);
    message.error(`初始化数据加载失败: ${error.message || '未知错误'}`);
  } finally {
    loading.value = false;
  }
});
</script>

<style scoped>
.process-management-container {
  padding: 12px;
  min-height: 100vh;
}

.page-header {
  margin-bottom: 20px;
}

.header-actions {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 12px;
  align-items: center;
}

@media (max-width: 768px) {
  .header-actions {
    grid-template-columns: 1fr;
  }
}

.btn-create {
  background: linear-gradient(135deg, #1890ff 0%);
  border: none;
}

.search-filters {
  display: grid;
  grid-template-columns: 1fr auto auto;
  gap: 12px;
  align-items: center;
}

@media (max-width: 768px) {
  .search-filters {
    grid-template-columns: 1fr;
  }
}

.search-input {
  min-width: 200px;
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

.process-name-cell {
  display: flex;
  align-items: center;
  gap: 10px;
}

.process-badge {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}

.status-draft {
  background-color: #faad14;
}

.status-published {
  background-color: #52c41a;
}

.status-archived {
  background-color: #d9d9d9;
}

.process-name-text {
  font-weight: 500;
}

.description-text {
  color: #606266;
}

.creator-info {
  display: flex;
  align-items: center;
  gap: 8px;
}

.creator-name {
  font-size: 14px;
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

.tags-container {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.no-tags {
  color: #8c8c8c;
  font-style: italic;
}

.action-buttons {
  display: flex;
  gap: 8px;
  justify-content: center;
  flex-wrap: wrap;
}

.detail-dialog .process-details {
  margin-bottom: 20px;
}

.detail-header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 24px;
  flex-wrap: wrap;
}

.detail-header h2 {
  margin: 0;
  font-size: 24px;
  color: #1f2937;
}

.process-preview {
  margin-top: 24px;
}

.process-preview h3 {
  margin: 24px 0 16px 0;
  color: #1f2937;
  font-size: 18px;
  font-weight: 600;
}

.definition-json {
  background: #f5f5f5;
  padding: 16px;
  border-radius: 4px;
  overflow-x: auto;
  max-height: 400px;
  overflow-y: auto;
}

.detail-footer {
  margin-top: 24px;
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  flex-wrap: wrap;
}

/* 模态框内容样式 */
.modal-content {
  max-height: 70vh;
  overflow-y: auto;
}

.edit-mode-tabs :deep(.ant-tabs-content-holder) {
  max-height: 60vh;
  overflow-y: auto;
}

.responsive-modal :deep(.ant-modal) {
  max-width: calc(100vw - 16px);
  margin: 8px;
}

.process-design-modal :deep(.ant-modal-body) {
  max-height: 80vh;
  overflow-y: auto;
  padding: 16px;
}

@media (max-width: 768px) {
  .process-management-container {
    padding: 8px;
  }

  .search-input {
    min-width: auto;
  }

  .stats-card :deep(.ant-statistic-title) {
    font-size: 12px;
  }

  .stats-card :deep(.ant-statistic-content) {
    font-size: 16px;
  }

  .action-buttons {
    gap: 4px;
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

  .responsive-modal :deep(.ant-modal-body) {
    padding: 12px;
    max-height: calc(100vh - 160px);
    overflow-y: auto;
  }
}
</style>
