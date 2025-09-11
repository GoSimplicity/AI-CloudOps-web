<template>
  <div class="template-management-container">
    <div class="page-header">
      <div class="header-actions">
        <a-button type="primary" @click="handleCreateTemplate" class="btn-create">
          <template #icon>
            <PlusOutlined />
          </template>
          创建模板
        </a-button>
        <div class="search-filters">
          <a-input-search 
            v-model:value="searchQuery" 
            placeholder="搜索模板名称..." 
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
            <a-select-option :value="null">全部状态</a-select-option>
            <a-select-option :value="1">启用</a-select-option>
            <a-select-option :value="2">禁用</a-select-option>
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
            <a-statistic title="总模板数" :value="stats.total" :value-style="{ color: '#3f8600' }">
              <template #prefix>
                <FileOutlined />
              </template>
            </a-statistic>
          </a-card>
        </a-col>
        <a-col :span="6">
          <a-card class="stats-card">
            <a-statistic title="启用" :value="stats.enabled" :value-style="{ color: '#52c41a' }">
              <template #prefix>
                <CheckCircleOutlined />
              </template>
            </a-statistic>
          </a-card>
        </a-col>
        <a-col :span="6">
          <a-card class="stats-card">
            <a-statistic title="禁用" :value="stats.disabled" :value-style="{ color: '#cf1322' }">
              <template #prefix>
                <StopOutlined />
              </template>
            </a-statistic>
          </a-card>
        </a-col>
        <a-col :span="6">
          <a-card class="stats-card">
            <a-statistic title="本月新增" :value="stats.thisMonth" :value-style="{ color: '#faad14' }">
              <template #prefix>
                <EditOutlined />
              </template>
            </a-statistic>
          </a-card>
        </a-col>
      </a-row>
    </div>

    <div class="table-container">
      <a-card>
        <a-table 
          :data-source="templateList" 
          :columns="columns" 
          :pagination="paginationConfig" 
          :loading="loading"
          row-key="id" 
          bordered 
          :scroll="{ x: 1300 }" 
          @change="handleTableChange"
        >
          <template #bodyCell="{ column, record }">
            <template v-if="column.key === 'name'">
              <div class="template-name-cell">
                <div class="status-badge" :class="getStatusClass(record.status)"></div>
                <span class="template-name-text">{{ record.name }}</span>
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

            <template v-if="column.key === 'category'">
              <a-tag v-if="record.category?.name" color="blue">
                {{ record.category.name }}
              </a-tag>
              <span v-else class="text-gray">未分类</span>
            </template>

            <template v-if="column.key === 'process'">
              <span v-if="record.process?.name">{{ record.process.name }}</span>
              <span v-else class="text-gray">未关联</span>
            </template>

            <template v-if="column.key === 'form_design'">
              <span v-if="record.form_design?.name">{{ record.form_design.name }}</span>
              <span v-else class="text-gray">未关联</span>
            </template>

            <template v-if="column.key === 'creator'">
              <div class="creator-info">
                <a-avatar size="small" :style="{ backgroundColor: getAvatarColor(record.operator_name || '') }">
                  {{ getInitials(record.operator_name) }}
                </a-avatar>
                <span class="creator-name">{{ record.operator_name }}</span>
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
                <a-button type="primary" size="small" @click="handleViewTemplate(record)">
                  查看
                </a-button>
                <a-button type="default" size="small" @click="handleEditTemplate(record)">
                  编辑
                </a-button>
                <a-dropdown>
                  <template #overlay>
                    <a-menu @click="(e: any) => handleCommand(e.key, record)">
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

    <!-- 模板创建/编辑对话框 -->
    <a-modal 
      :open="templateDialog.visible" 
      :title="templateDialog.isEdit ? '编辑模板' : '创建模板'" 
      :width="formDialogWidth"
      @ok="saveTemplate" 
      @cancel="() => { templateDialog.visible = false }" 
      :destroy-on-close="true"
      class="responsive-modal template-form-modal" 
      :confirm-loading="loading"
    >
      <a-form ref="formRef" :model="templateDialog.form" :rules="formRules" layout="vertical">
        <a-row :gutter="16">
          <a-col :span="12">
            <a-form-item label="模板名称" name="name">
              <a-input v-model:value="templateDialog.form.name" placeholder="请输入模板名称" />
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item label="状态" name="status">
              <a-select v-model:value="templateDialog.form.status" placeholder="请选择状态">
                <a-select-option :value="1">启用</a-select-option>
                <a-select-option :value="2">禁用</a-select-option>
              </a-select>
            </a-form-item>
          </a-col>
        </a-row>

        <a-row :gutter="16">
          <a-col :span="8">
            <a-form-item label="分类" name="category_id">
              <a-select 
                v-model:value="templateDialog.form.category_id" 
                placeholder="请选择分类" 
                style="width: 100%"
                show-search 
                :filter-option="false" 
                option-label-prop="children"
                :not-found-content="categorySelectorLoading ? undefined : (categorySearchKeyword ? '无搜索结果' : '无数据')"
                @search="handleCategorySearch" 
                @dropdown-visible-change="handleCategoryDropdownChange"
                @popup-scroll="handleCategoryScroll" 
                allow-clear 
                :loading="categorySelectorLoading"
              >
                <template #notFoundContent>
                  <div v-if="categorySelectorLoading" class="selector-loading">
                    <a-spin size="small" />
                    <span style="margin-left: 8px;">加载中...</span>
                  </div>
                  <div v-else class="selector-empty">
                    {{ categorySearchKeyword ? '无搜索结果' : '暂无分类数据' }}
                  </div>
                </template>

                <a-select-option v-for="cat in dialogCategories" :key="cat.id" :value="cat.id">
                  <div class="category-option">
                    <span class="category-name">{{ cat.name }}</span>
                    <span v-if="cat.description" class="category-desc">{{ cat.description }}</span>
                  </div>
                </a-select-option>

                <a-select-option 
                  v-if="categoryPagination.hasMore" 
                  :value="'__load_more__'" 
                  disabled
                  class="load-more-option"
                >
                  <div class="load-more-content" @click.stop="loadMoreCategories">
                    <a-button type="link" size="small" :loading="categorySelectorLoading"
                      style="padding: 0; height: auto; font-size: 12px;">
                      <template v-if="!categorySelectorLoading">
                        加载更多 ({{ categoryPagination.current }}/{{ categoryTotalPages }})
                      </template>
                      <template v-else>
                        正在加载...
                      </template>
                    </a-button>
                  </div>
                </a-select-option>
              </a-select>
            </a-form-item>
          </a-col>
          <a-col :span="8">
            <a-form-item label="关联流程" name="process_id">
              <a-select 
                v-model:value="templateDialog.form.process_id" 
                placeholder="请选择流程" 
                style="width: 100%"
                show-search 
                :filter-option="false" 
                option-label-prop="children"
                :not-found-content="processSelectorLoading ? undefined : (processSearchKeyword ? '无搜索结果' : '无数据')"
                @search="handleProcessSearch" 
                @dropdown-visible-change="handleProcessDropdownChange"
                @popup-scroll="handleProcessScroll" 
                allow-clear 
                :loading="processSelectorLoading"
              >
                <template #notFoundContent>
                  <div v-if="processSelectorLoading" class="selector-loading">
                    <a-spin size="small" />
                    <span style="margin-left: 8px;">加载中...</span>
                  </div>
                  <div v-else class="selector-empty">
                    {{ processSearchKeyword ? '无搜索结果' : '暂无流程数据' }}
                  </div>
                </template>

                <a-select-option v-for="process in dialogProcesses" :key="process.id" :value="process.id">
                  <div class="process-option">
                    <span class="process-name">{{ process.name }}</span>
                    <span v-if="process.description" class="process-desc">{{ process.description }}</span>
                  </div>
                </a-select-option>

                <a-select-option 
                  v-if="processPagination.hasMore" 
                  :value="'__load_more_process__'" 
                  disabled
                  class="load-more-option"
                >
                  <div class="load-more-content" @click.stop="loadMoreProcesses">
                    <a-button type="link" size="small" :loading="processSelectorLoading"
                      style="padding: 0; height: auto; font-size: 12px;">
                      <template v-if="!processSelectorLoading">
                        加载更多 ({{ processPagination.current }}/{{ processTotalPages }})
                      </template>
                      <template v-else>
                        正在加载...
                      </template>
                    </a-button>
                  </div>
                </a-select-option>
              </a-select>
            </a-form-item>
          </a-col>
          <a-col :span="8">
            <a-form-item label="关联表单" name="form_design_id">
              <a-select 
                v-model:value="templateDialog.form.form_design_id" 
                placeholder="请选择表单" 
                style="width: 100%"
                show-search 
                :filter-option="false" 
                option-label-prop="children"
                :not-found-content="formSelectorLoading ? undefined : (formSearchKeyword ? '无搜索结果' : '无数据')"
                @search="handleFormSearch" 
                @dropdown-visible-change="handleFormDropdownChange"
                @popup-scroll="handleFormScroll" 
                allow-clear 
                :loading="formSelectorLoading"
              >
                <template #notFoundContent>
                  <div v-if="formSelectorLoading" class="selector-loading">
                    <a-spin size="small" />
                    <span style="margin-left: 8px;">加载中...</span>
                  </div>
                  <div v-else class="selector-empty">
                    {{ formSearchKeyword ? '无搜索结果' : '暂无表单数据' }}
                  </div>
                </template>

                <a-select-option v-for="form in dialogForms" :key="form.id" :value="form.id">
                  <div class="form-option">
                    <span class="form-name">{{ form.name }}</span>
                    <span v-if="form.description" class="form-desc">{{ form.description }}</span>
                  </div>
                </a-select-option>

                <a-select-option 
                  v-if="formPagination.hasMore" 
                  :value="'__load_more_form__'" 
                  disabled
                  class="load-more-option"
                >
                  <div class="load-more-content" @click.stop="loadMoreForms">
                    <a-button type="link" size="small" :loading="formSelectorLoading"
                      style="padding: 0; height: auto; font-size: 12px;">
                      <template v-if="!formSelectorLoading">
                        加载更多 ({{ formPagination.current }}/{{ formTotalPages }})
                      </template>
                      <template v-else>
                        正在加载...
                      </template>
                    </a-button>
                  </div>
                </a-select-option>
              </a-select>
            </a-form-item>
          </a-col>
        </a-row>

        <a-form-item label="标签" name="tags">
          <a-select
            v-model:value="templateDialog.form.tags"
            mode="tags"
            placeholder="输入标签按回车添加"
            style="width: 100%"
            :max-tag-count="10"
            allow-clear
          >
          </a-select>
        </a-form-item>

        <a-form-item label="描述" name="description">
          <a-textarea v-model:value="templateDialog.form.description" :rows="3" placeholder="请输入模板描述" />
        </a-form-item>
      </a-form>
    </a-modal>

    <!-- 详情对话框 -->
    <a-modal 
      :open="detailDialog.visible" 
      title="模板详情" 
      :width="previewDialogWidth" 
      :footer="null"
      @cancel="() => { detailDialog.visible = false }" 
      class="detail-dialog responsive-modal"
    >
      <div v-if="detailDialog.template" class="template-details">
        <div class="detail-header">
          <h2>{{ detailDialog.template.name }}</h2>
          <a-tag :color="getStatusColor(detailDialog.template.status)">
            {{ getStatusText(detailDialog.template.status) }}
          </a-tag>
        </div>

        <a-descriptions bordered :column="2" :labelStyle="{ width: '120px' }">
          <a-descriptions-item label="模板ID">{{ detailDialog.template.id }}</a-descriptions-item>
          <a-descriptions-item label="创建人">{{ detailDialog.template.operator_name }}</a-descriptions-item>
          <a-descriptions-item label="创建时间">
            {{ formatFullDateTime(detailDialog.template.created_at || '') }}
          </a-descriptions-item>
          <a-descriptions-item label="更新时间">
            {{ formatFullDateTime(detailDialog.template.updated_at || '') }}
          </a-descriptions-item>
          <a-descriptions-item label="分类">
            <a-tag v-if="detailDialog.template.category?.name" color="blue">
              {{ detailDialog.template.category.name }}
            </a-tag>
            <span v-else class="text-gray">未分类</span>
          </a-descriptions-item>
          <a-descriptions-item label="关联流程">
            {{ detailDialog.template.process?.name || '未关联' }}
          </a-descriptions-item>
          <a-descriptions-item label="关联表单" :span="2">
            {{ detailDialog.template.form_design?.name || '未关联' }}
          </a-descriptions-item>
          <a-descriptions-item label="标签" :span="2">
            <template v-if="detailDialog.template.tags && detailDialog.template.tags.length">
              <a-tag v-for="tag in detailDialog.template.tags" :key="tag" color="blue">{{ tag }}</a-tag>
            </template>
            <span v-else class="text-gray">无标签</span>
          </a-descriptions-item>
          <a-descriptions-item label="描述" :span="2">
            {{ detailDialog.template.description || '无描述' }}
          </a-descriptions-item>
        </a-descriptions>

        <div class="detail-footer">
          <a-button @click="detailDialog.visible = false">关闭</a-button>
          <a-button type="primary" @click="handleEditTemplate(detailDialog.template)">编辑</a-button>
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
  FileOutlined,
  CheckCircleOutlined,
  EditOutlined,
  StopOutlined,
  DownOutlined
} from '@ant-design/icons-vue';

import {
  type WorkorderTemplateItem,
  type CreateWorkorderTemplateReq,
  type UpdateWorkorderTemplateReq,
  type DeleteWorkorderTemplateReq,
  type ListWorkorderTemplateReq,
  type DetailWorkorderTemplateReq,
  TemplateStatus,
  listWorkorderTemplate,
  detailWorkorderTemplate,
  createWorkorderTemplate,
  updateWorkorderTemplate,
  deleteWorkorderTemplate
} from '#/api/core/workorder/workorder_template';

import {
  type WorkorderCategoryItem,
  listWorkorderCategory
} from '#/api/core/workorder/workorder_category';

import {
  type WorkorderProcessItem,
  listWorkorderProcess
} from '#/api/core/workorder/workorder_process';

import {
  type WorkorderFormDesignItem,
  listWorkorderFormDesign
} from '#/api/core/workorder/workorder_form_design';

// 列定义 - 修复嵌套数据显示问题
const columns = [
  {
    title: '模板名称',
    dataIndex: 'name',
    key: 'name',
    width: 200,
    fixed: 'left'
  },
  {
    title: '描述',
    dataIndex: 'description',
    key: 'description',
    width: 200,
    ellipsis: true,
  },
  {
    title: '状态',
    dataIndex: 'status',
    key: 'status',
    width: 120,
    align: 'center' as const,
  },
  {
    title: '分类',
    key: 'category', // 修改：移除嵌套路径，使用 key 标识
    width: 120,
    align: 'center' as const,
  },
  {
    title: '关联流程',
    key: 'process', // 修改：移除嵌套路径，使用 key 标识
    width: 150,
  },
  {
    title: '关联表单',
    key: 'form_design', // 修改：移除嵌套路径，使用 key 标识
    width: 150,
  },
  {
    title: '创建人',
    dataIndex: 'operator_name',
    key: 'creator',
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
    fixed: 'right'
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

// 数据列表
const templateList = ref<WorkorderTemplateItem[]>([]);
const categories = ref<WorkorderCategoryItem[]>([]);

// 统计数据
const stats = reactive({
  total: 0,
  enabled: 0,
  disabled: 0,
  thisMonth: 0
});

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

// 模板对话框
const templateDialog = reactive({
  visible: false,
  isEdit: false,
  form: {
    id: undefined,
    name: '',
    description: '',
    status: TemplateStatus.Enabled,
    category_id: 0,
    process_id: 0,
    form_design_id: 0,
    tags: [],
    default_values: {}
  } as CreateWorkorderTemplateReq & { id?: number }
});

// 表单验证规则
const formRules = {
  name: [
    { required: true, message: '请输入模板名称', trigger: 'blur' },
    { min: 3, max: 50, message: '长度应为3到50个字符', trigger: 'blur' }
  ],
  process_id: [
    { required: true, message: '请选择关联流程', trigger: 'change' }
  ],
  form_design_id: [
    { required: true, message: '请选择关联表单', trigger: 'change' }
  ]
};

// 详情对话框
const detailDialog = reactive({
  visible: false,
  template: null as WorkorderTemplateItem | null
});

// 分类选择器相关
const dialogCategories = ref<WorkorderCategoryItem[]>([]);
const categorySelectorLoading = ref(false);
const categorySearchKeyword = ref('');
let categorySearchTimeout: any = null;

const categoryPagination = reactive({
  current: 1,
  pageSize: 20,
  total: 0,
  hasMore: false
});

// 流程选择器相关
const dialogProcesses = ref<WorkorderProcessItem[]>([]);
const processSelectorLoading = ref(false);
const processSearchKeyword = ref('');
let processSearchTimeout: any = null;

const processPagination = reactive({
  current: 1,
  pageSize: 20,
  total: 0,
  hasMore: false
});

// 表单选择器相关
const dialogForms = ref<WorkorderFormDesignItem[]>([]);
const formSelectorLoading = ref(false);
const formSearchKeyword = ref('');
let formSearchTimeout: any = null;

const formPagination = reactive({
  current: 1,
  pageSize: 20,
  total: 0,
  hasMore: false
});

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

const categoryTotalPages = computed(() => {
  return Math.ceil(categoryPagination.total / categoryPagination.pageSize);
});

const processTotalPages = computed(() => {
  return Math.ceil(processPagination.total / processPagination.pageSize);
});

const formTotalPages = computed(() => {
  return Math.ceil(formPagination.total / formPagination.pageSize);
});


const getStatusColor = (status: number): string => {
  const colorMap = {
    [TemplateStatus.Enabled]: 'green',
    [TemplateStatus.Disabled]: 'default'
  };
  return colorMap[status as keyof typeof colorMap] || 'default';
};

const getStatusText = (status: number): string => {
  const textMap = {
    [TemplateStatus.Enabled]: '启用',
    [TemplateStatus.Disabled]: '禁用'
  };
  return textMap[status as keyof typeof textMap] || '未知';
};

const getStatusClass = (status: number): string => {
  const classMap = {
    [TemplateStatus.Enabled]: 'status-enabled',
    [TemplateStatus.Disabled]: 'status-disabled'
  };
  return classMap[status as keyof typeof classMap] || '';
};

const formatDate = (dateStr: string | undefined) => {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' });
};

const formatTime = (dateStr: string | undefined) => {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
};

const formatFullDateTime = (dateStr: string | undefined) => {
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

const getInitials = (name: string | undefined) => {
  if (!name) return '';
  return name
    .split('')
    .slice(0, 2)
    .join('')
    .toUpperCase();
};

const getAvatarColor = (name: string | undefined) => {
  if (!name) return '#1890ff';

  const colors = [
    '#1890ff', '#52c41a', '#faad14', '#f5222d',
    '#722ed1', '#13c2c2', '#eb2f96', '#fa8c16'
  ];

  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }

  return colors[Math.abs(hash) % colors.length];
};

// 分类选择器方法
const loadDialogCategories = async (reset: boolean = false, search?: string): Promise<void> => {
  if (categorySelectorLoading.value && !reset) {
    return;
  }

  categorySelectorLoading.value = true;

  try {
    const params = {
      page: reset ? 1 : categoryPagination.current,
      size: categoryPagination.pageSize,
      search: search !== undefined ? search : categorySearchKeyword.value || undefined
    };

    const response = await listWorkorderCategory(params);

    if (response) {
      if (reset) {
        dialogCategories.value = response.items || [];
        categoryPagination.current = 1;
      } else {
        const existingIds = new Set(dialogCategories.value.map(cat => cat.id));
        const newItems = (response.items || []).filter((cat: any) => !existingIds.has(cat.id));
        dialogCategories.value = [...dialogCategories.value, ...newItems];
      }

      categoryPagination.total = response.total || 0;
      categoryPagination.hasMore = (response.items || []).length === categoryPagination.pageSize &&
        dialogCategories.value.length < categoryPagination.total;
    }
  } catch (error: any) {
    console.error('加载分类列表失败:', error);
    if (reset) {
      message.error(error.message || '加载分类列表失败');
      dialogCategories.value = [];
      categoryPagination.current = 1;
      categoryPagination.total = 0;
      categoryPagination.hasMore = false;
    }
  } finally {
    categorySelectorLoading.value = false;
  }
};

const handleCategorySearch = (value: string): void => {
  categorySearchKeyword.value = value;

  if (categorySearchTimeout) {
    clearTimeout(categorySearchTimeout);
  }

  categorySearchTimeout = setTimeout(() => {
    categoryPagination.current = 1;
    loadDialogCategories(true, value);
  }, 300);
};

const handleCategoryDropdownChange = (open: boolean): void => {
  if (open) {
    if (dialogCategories.value.length === 0) {
      loadDialogCategories(true);
    }
  }
};

const handleCategoryScroll = (e: Event): void => {
  const { target } = e;
  if (!target) return;

  const element = target as HTMLElement;
  const { scrollTop, scrollHeight, clientHeight } = element;

  if (scrollTop + clientHeight >= scrollHeight - 10 &&
    categoryPagination.hasMore &&
    !categorySelectorLoading.value) {
    loadMoreCategories();
  }
};

const loadMoreCategories = async (): Promise<void> => {
  if (!categoryPagination.hasMore || categorySelectorLoading.value) {
    return;
  }

  categoryPagination.current += 1;
  await loadDialogCategories(false);
};

// 流程选择器方法
const loadDialogProcesses = async (reset: boolean = false, search?: string): Promise<void> => {
  if (processSelectorLoading.value && !reset) {
    return;
  }

  processSelectorLoading.value = true;

  try {
    const params = {
      page: reset ? 1 : processPagination.current,
      size: processPagination.pageSize,
      search: search !== undefined ? search : processSearchKeyword.value || undefined
    };

    const response = await listWorkorderProcess(params);

    if (response) {
      if (reset) {
        dialogProcesses.value = response.items || [];
        processPagination.current = 1;
      } else {
        const existingIds = new Set(dialogProcesses.value.map(process => process.id));
        const newItems = (response.items || []).filter((process: any) => !existingIds.has(process.id));
        dialogProcesses.value = [...dialogProcesses.value, ...newItems];
      }

      processPagination.total = response.total || 0;
      processPagination.hasMore = (response.items || []).length === processPagination.pageSize &&
        dialogProcesses.value.length < processPagination.total;
    }
  } catch (error: any) {
    console.error('加载流程列表失败:', error);
    if (reset) {
      message.error(error.message || '加载流程列表失败');
      dialogProcesses.value = [];
      processPagination.current = 1;
      processPagination.total = 0;
      processPagination.hasMore = false;
    }
  } finally {
    processSelectorLoading.value = false;
  }
};

const handleProcessSearch = (value: string): void => {
  processSearchKeyword.value = value;

  if (processSearchTimeout) {
    clearTimeout(processSearchTimeout);
  }

  processSearchTimeout = setTimeout(() => {
    processPagination.current = 1;
    loadDialogProcesses(true, value);
  }, 300);
};

const handleProcessDropdownChange = (open: boolean): void => {
  if (open) {
    if (dialogProcesses.value.length === 0) {
      loadDialogProcesses(true);
    }
  }
};

const handleProcessScroll = (e: Event): void => {
  const { target } = e;
  if (!target) return;

  const element = target as HTMLElement;
  const { scrollTop, scrollHeight, clientHeight } = element;

  if (scrollTop + clientHeight >= scrollHeight - 10 &&
    processPagination.hasMore &&
    !processSelectorLoading.value) {
    loadMoreProcesses();
  }
};

const loadMoreProcesses = async (): Promise<void> => {
  if (!processPagination.hasMore || processSelectorLoading.value) {
    return;
  }

  processPagination.current += 1;
  await loadDialogProcesses(false);
};

// 表单选择器方法
const loadDialogForms = async (reset: boolean = false, search?: string): Promise<void> => {
  if (formSelectorLoading.value && !reset) {
    return;
  }

  formSelectorLoading.value = true;

  try {
    const params = {
      page: reset ? 1 : formPagination.current,
      size: formPagination.pageSize,
      search: search !== undefined ? search : formSearchKeyword.value || undefined
    };

    const response = await listWorkorderFormDesign(params);

    if (response) {
      if (reset) {
        dialogForms.value = response.items || [];
        formPagination.current = 1;
      } else {
        const existingIds = new Set(dialogForms.value.map(form => form.id));
        const newItems = (response.items || []).filter((form: any) => !existingIds.has(form.id));
        dialogForms.value = [...dialogForms.value, ...newItems];
      }

      formPagination.total = response.total || 0;
      formPagination.hasMore = (response.items || []).length === formPagination.pageSize &&
        dialogForms.value.length < formPagination.total;
    }
  } catch (error: any) {
    console.error('加载表单列表失败:', error);
    if (reset) {
      message.error(error.message || '加载表单列表失败');
      dialogForms.value = [];
      formPagination.current = 1;
      formPagination.total = 0;
      formPagination.hasMore = false;
    }
  } finally {
    formSelectorLoading.value = false;
  }
};

const handleFormSearch = (value: string): void => {
  formSearchKeyword.value = value;

  if (formSearchTimeout) {
    clearTimeout(formSearchTimeout);
  }

  formSearchTimeout = setTimeout(() => {
    formPagination.current = 1;
    loadDialogForms(true, value);
  }, 300);
};

const handleFormDropdownChange = (open: boolean): void => {
  if (open) {
    if (dialogForms.value.length === 0) {
      loadDialogForms(true);
    }
  }
};

const handleFormScroll = (e: Event): void => {
  const { target } = e;
  if (!target) return;

  const element = target as HTMLElement;
  const { scrollTop, scrollHeight, clientHeight } = element;

  if (scrollTop + clientHeight >= scrollHeight - 10 &&
    formPagination.hasMore &&
    !formSelectorLoading.value) {
    loadMoreForms();
  }
};

const loadMoreForms = async (): Promise<void> => {
  if (!formPagination.hasMore || formSelectorLoading.value) {
    return;
  }

  formPagination.current += 1;
  await loadDialogForms(false);
};

// 表格变化处理
const handleTableChange = (pagination: any): void => {
  if (pagination.current !== currentPage.value) {
    currentPage.value = pagination.current;
  }
  if (pagination.pageSize !== pageSize.value) {
    pageSize.value = pagination.pageSize;
    currentPage.value = 1;
  }
  loadTemplates();
};

// 数据加载
const loadTemplates = async () => {
  loading.value = true;
  try {
    const params: ListWorkorderTemplateReq = {
      page: currentPage.value,
      size: pageSize.value,
      search: searchQuery.value || undefined,
      status: statusFilter.value || undefined,
      category_id: categoryFilter.value || undefined
    };

    const res = await listWorkorderTemplate(params);
    if (res && res.items) {
      templateList.value = res.items || [];
      total.value = res.total || 0;
      
      // 计算统计数据
      stats.total = res.total || 0;
      stats.enabled = res.items?.filter((item: any) => item.status === TemplateStatus.Enabled).length || 0;
      stats.disabled = res.items?.filter((item: any) => item.status === TemplateStatus.Disabled).length || 0;
      
      // 计算本月新增（简单示例）
      const thisMonth = new Date();
      thisMonth.setDate(1);
      stats.thisMonth = res.items?.filter((item: any) => {
        const createdAt = new Date(item.created_at);
        return createdAt >= thisMonth;
      }).length || 0;
    }
  } catch (error) {
    message.error('加载模板数据失败');
    console.error('Failed to load templates:', error);
  } finally {
    loading.value = false;
  }
};

const loadCategories = async () => {
  try {
    let allCategories: any[] = [];
    let currentPage = 1;
    const pageSize = 50;
    let hasMoreData = true;

    while (hasMoreData) {
      const res = await listWorkorderCategory({ 
        page: currentPage, 
        size: pageSize 
      });
      
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
    message.error(`加载分类列表失败: ${error.message || '未知错误'}`);
    categories.value = [];
  }
};

// 事件处理
const handleSearch = () => {
  currentPage.value = 1;
  loadTemplates();
};

const handleStatusChange = () => {
  currentPage.value = 1;
  loadTemplates();
};

const handleCategoryChange = () => {
  currentPage.value = 1;
  loadTemplates();
};

const handleCreateTemplate = () => {
  templateDialog.isEdit = false;
  templateDialog.form = {
    name: '',
    description: '',
    status: TemplateStatus.Enabled,
    category_id: undefined,
    process_id: 0,
    form_design_id: 0,
    tags: [],
    default_values: {}
  };
  templateDialog.visible = true;
  resetSelectors();
};

const handleEditTemplate = async (row: WorkorderTemplateItem) => {
  templateDialog.isEdit = true;
  loading.value = true;

  try {
    const res = await detailWorkorderTemplate({ id: row.id } as DetailWorkorderTemplateReq);
    if (res) {
      templateDialog.form = {
        id: res.id,
        name: res.name,
        description: res.description,
        status: res.status,
        category_id: res.category_id,
        process_id: res.process_id,
        form_design_id: res.form_design_id,
        tags: res.tags || [],
        default_values: res.default_values || {}
      };

      templateDialog.visible = true;
      detailDialog.visible = false;
      await loadSelectorsForEdit(res);
    }
  } catch (error) {
    message.error('获取模板详情失败');
    console.error('Failed to get template details:', error);
  } finally {
    loading.value = false;
  }
};

const handleViewTemplate = async (row: WorkorderTemplateItem) => {
  loading.value = true;

  try {
    const res = await detailWorkorderTemplate({ id: row.id } as DetailWorkorderTemplateReq);
    if (res) {
      detailDialog.template = res;
      detailDialog.visible = true;
    }
  } catch (error) {
    message.error('获取模板详情失败');
    console.error('Failed to get template details:', error);
  } finally {
    loading.value = false;
  }
};

const handleCommand = async (command: string, row: WorkorderTemplateItem) => {
  switch (command) {
    case 'delete':
      confirmDelete(row);
      break;
  }
};

const confirmDelete = (template: WorkorderTemplateItem) => {
  Modal.confirm({
    title: '警告',
    content: `确定要删除模板 "${template.name}" 吗？这个操作不可恢复！`,
    okText: '删除',
    okType: 'danger',
    cancelText: '取消',
    async onOk() {
      try {
        loading.value = true;
        const params: DeleteWorkorderTemplateReq = {
          id: template.id
        };

        await deleteWorkorderTemplate(params);
        message.success(`模板 "${template.name}" 已删除`);

        if (templateList.value.length === 1 && currentPage.value > 1) {
          currentPage.value = currentPage.value - 1;
        }

        loadTemplates();
      } catch (error: any) {
        message.error(`删除模板失败: ${error.message || '未知错误'}`);
        console.error('Failed to delete template:', error);
      } finally {
        loading.value = false;
      }
    }
  });
};

const saveTemplate = async () => {
  try {
    if (!templateDialog.form.name.trim()) {
      message.error('模板名称不能为空');
      return;
    }

    if (!templateDialog.form.process_id) {
      message.error('请选择关联流程');
      return;
    }

    if (!templateDialog.form.form_design_id) {
      message.error('请选择关联表单');
      return;
    }

    loading.value = true;

    if (templateDialog.isEdit && templateDialog.form.id) {
      const updateData: UpdateWorkorderTemplateReq = {
        id: templateDialog.form.id,
        name: templateDialog.form.name,
        description: templateDialog.form.description || '',
        process_id: templateDialog.form.process_id,
        form_design_id: templateDialog.form.form_design_id,
        status: templateDialog.form.status,
        category_id: templateDialog.form.category_id,
        tags: templateDialog.form.tags
      };

      await updateWorkorderTemplate(updateData);
      message.success(`模板 "${templateDialog.form.name}" 已更新`);
    } else {
      const createData: CreateWorkorderTemplateReq = {
        name: templateDialog.form.name,
        description: templateDialog.form.description,
        process_id: templateDialog.form.process_id,
        form_design_id: templateDialog.form.form_design_id,
        status: templateDialog.form.status,
        category_id: templateDialog.form.category_id,
        tags: templateDialog.form.tags
      };

      await createWorkorderTemplate(createData);
      message.success(`模板 "${templateDialog.form.name}" 已创建`);

      currentPage.value = 1;
    }

    templateDialog.visible = false;
    loadTemplates();
  } catch (error: any) {
    message.error(templateDialog.isEdit
      ? `更新模板失败: ${error.message || '未知错误'}`
      : `创建模板失败: ${error.message || '未知错误'}`
    );
    console.error('Failed to save template:', error);
  } finally {
    loading.value = false;
  }
};

// 重置选择器状态
const resetSelectors = (): void => {
  // 重置分类选择器
  dialogCategories.value = [];
  categoryPagination.current = 1;
  categoryPagination.total = 0;
  categoryPagination.hasMore = false;
  categorySearchKeyword.value = '';
  categorySelectorLoading.value = false;

  if (categorySearchTimeout) {
    clearTimeout(categorySearchTimeout);
    categorySearchTimeout = null;
  }

  // 重置流程选择器
  dialogProcesses.value = [];
  processPagination.current = 1;
  processPagination.total = 0;
  processPagination.hasMore = false;
  processSearchKeyword.value = '';
  processSelectorLoading.value = false;

  if (processSearchTimeout) {
    clearTimeout(processSearchTimeout);
    processSearchTimeout = null;
  }

  // 重置表单选择器
  dialogForms.value = [];
  formPagination.current = 1;
  formPagination.total = 0;
  formPagination.hasMore = false;
  formSearchKeyword.value = '';
  formSelectorLoading.value = false;

  if (formSearchTimeout) {
    clearTimeout(formSearchTimeout);
    formSearchTimeout = null;
  }
};

// 为编辑模式加载选择器信息
const loadSelectorsForEdit = async (templateData: WorkorderTemplateItem): Promise<void> => {
  resetSelectors();

  try {
    await Promise.all([
      loadCategoryForEdit(templateData),
      loadProcessForEdit(templateData),
      loadFormForEdit(templateData)
    ]);
  } catch (error) {
    console.error('加载编辑模式选择器信息失败:', error);
  }
};

const loadCategoryForEdit = async (templateData: WorkorderTemplateItem): Promise<void> => {
  try {
    const existingCategory = categories.value.find(cat => cat.id === templateData.category_id);

    if (templateData.category_id && existingCategory) {
      dialogCategories.value = [existingCategory];
    }

    await loadDialogCategories(true);

    if (templateData.category_id && !dialogCategories.value.find(cat => cat.id === templateData.category_id)) {
      const categoryInfo: WorkorderCategoryItem = {
        id: templateData.category_id,
        name: templateData.category?.name || `分类${templateData.category_id}`,
        description: '',
        created_at: '',
        updated_at: '',
        operator_id: 0,
        operator_name: '',
        status: 1
      };

      dialogCategories.value = [categoryInfo, ...dialogCategories.value.filter(c => c.id !== categoryInfo.id)];
    }
  } catch (error) {
    console.error('加载编辑模式分类信息失败:', error);
  }
};

const loadProcessForEdit = async (templateData: WorkorderTemplateItem): Promise<void> => {
  try {
    await loadDialogProcesses(true);

    if (templateData.process_id && !dialogProcesses.value.find(process => process.id === templateData.process_id)) {
      const processInfo: WorkorderProcessItem = {
        id: templateData.process_id,
        name: templateData.process?.name || `流程${templateData.process_id}`,
        description: '',
        created_at: '',
        updated_at: '',
        operator_id: 0,
        operator_name: '',
        status: 1,
        is_default: 2,
        definition: {},
        form_design_id: 0
      };
      dialogProcesses.value = [processInfo, ...dialogProcesses.value.filter(p => p.id !== processInfo.id)];
    }
  } catch (error) {
    console.error('加载编辑模式流程信息失败:', error);
  }
};

const loadFormForEdit = async (templateData: WorkorderTemplateItem): Promise<void> => {
  try {
    await loadDialogForms(true);

    if (templateData.form_design_id && !dialogForms.value.find(form => form.id === templateData.form_design_id)) {
      const formInfo: WorkorderFormDesignItem = {
        id: templateData.form_design_id,
        name: templateData.form_design?.name || `表单${templateData.form_design_id}`,
        description: '',
        created_at: '',
        updated_at: '',
        operator_id: 0,
        operator_name: '',
        status: 1,
        is_template: 1,
        category_id: 0,
        schema: {
          fields: []
        }
      };
      dialogForms.value = [formInfo, ...dialogForms.value.filter(f => f.id !== formInfo.id)];
    }
  } catch (error) {
    console.error('加载编辑模式表单信息失败:', error);
  }
};

// 初始化加载
onMounted(async () => {
  loading.value = true;
  try {
    await Promise.all([
      loadCategories(),
      loadTemplates()
    ]);
  } catch (error: any) {
    console.error('初始化数据加载失败:', error);
    message.error(`初始化数据加载失败: ${error.message || '未知错误'}, 请刷新页面重试`);
  } finally {
    loading.value = false;
  }
});
</script>

<style scoped>
.template-management-container {
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

.status-filter,
.category-filter {
  width: 120px;
  min-width: 100px;
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

.template-name-cell {
  display: flex;
  align-items: center;
  gap: 10px;
}

.status-badge {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}

.status-enabled {
  background-color: #52c41a;
}

.status-disabled {
  background-color: #d9d9d9;
}

.template-name-text {
  font-weight: 500;
  word-break: break-all;
}

.description-text {
  color: #606266;
  display: -webkit-box;
  -webkit-box-orient: vertical;
  overflow: hidden;
  word-break: break-all;
}

.text-gray {
  color: #999;
  font-style: italic;
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

/* 选择器样式 */
.selector-loading,
.selector-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 8px 12px;
  color: #8c8c8c;
  font-size: 14px;
}

.category-option,
.process-option,
.form-option {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.category-name,
.process-name,
.form-name {
  font-weight: 500;
  color: #262626;
}

.category-desc,
.process-desc,
.form-desc {
  font-size: 12px;
  color: #8c8c8c;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 200px;
}

.load-more-option {
  text-align: center;
  border-top: 1px solid #f0f0f0;
  margin-top: 4px;
  background-color: #fafafa !important;
}

.load-more-option:hover {
  background-color: #f0f0f0 !important;
}

.load-more-content {
  padding: 8px 12px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.3s;
}

.load-more-content:hover {
  background-color: #e6f7ff;
  border-radius: 4px;
}

/* 详情对话框样式 */
.detail-dialog .template-details {
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
  word-break: break-all;
}

.detail-footer {
  margin-top: 24px;
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  flex-wrap: wrap;
}

/* 响应式对话框 */
.responsive-modal :deep(.ant-modal) {
  max-width: calc(100vw - 16px);
  margin: 8px;
}

.template-form-modal :deep(.ant-modal-body) {
  max-height: 70vh;
  overflow-y: auto;
}

/* 移动端适配 */
@media (max-width: 768px) {
  .template-management-container {
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

  .status-filter,
  .category-filter {
    width: 100%;
    min-width: auto;
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

  .category-desc,
  .process-desc,
  .form-desc {
    max-width: 150px;
  }

  .load-more-content {
    padding: 6px 8px;
  }
}

/* 平板端适配 */
@media (max-width: 1024px) and (min-width: 769px) {
  .template-management-container {
    padding: 16px;
  }

  .search-input {
    width: 200px;
  }
}

/* 超小屏幕适配 */
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

  .category-desc,
  .process-desc,
  .form-desc {
    max-width: 120px;
  }

  .load-more-content {
    padding: 4px 6px;
    font-size: 12px;
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
</style>
