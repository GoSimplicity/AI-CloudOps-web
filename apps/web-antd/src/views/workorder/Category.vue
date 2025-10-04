<template>
  <div class="workorder-category-container">
    <!-- 页面头部操作区 -->
    <div class="page-header">
      <div class="header-actions">
        <a-button type="primary" @click="handleCreate" class="create-btn">
          <template #icon>
            <PlusOutlined />
          </template>
          创建分类
        </a-button>
        
        <div class="search-filters">
          <a-input-search 
            v-model:value="searchQuery" 
            placeholder="搜索分类名称..." 
            class="search-input"
            @search="handleSearch"
            allow-clear 
          />
          <a-select 
            v-model:value="statusFilter" 
            placeholder="状态筛选" 
            class="status-filter"
            @change="handleStatusChange"
            allow-clear
          >
            <a-select-option :value="CategoryStatus.Enabled">启用</a-select-option>
            <a-select-option :value="CategoryStatus.Disabled">禁用</a-select-option>
          </a-select>
        </div>
      </div>
    </div>

    <!-- 统计卡片 -->
    <div class="stats-grid">
      <a-card class="stats-card">
        <a-statistic 
          title="总分类数" 
          :value="statistics.total" 
          :value-style="{ color: '#1890ff' }"
        >
          <template #prefix>
            <FolderOutlined />
          </template>
        </a-statistic>
      </a-card>
      
      <a-card class="stats-card">
        <a-statistic 
          title="启用分类" 
          :value="statistics.enabled" 
          :value-style="{ color: '#52c41a' }"
        >
          <template #prefix>
            <CheckCircleOutlined />
          </template>
        </a-statistic>
      </a-card>
      
      <a-card class="stats-card">
        <a-statistic 
          title="禁用分类" 
          :value="statistics.disabled" 
          :value-style="{ color: '#ff4d4f' }"
        >
          <template #prefix>
            <StopOutlined />
          </template>
        </a-statistic>
      </a-card>
    </div>

    <!-- 数据表格 -->
    <div class="table-container">
      <a-card>
        <a-table 
          :data-source="categoryList" 
          :columns="tableColumns" 
          :pagination="paginationConfig"
          :loading="loading" 
          row-key="id"
          bordered
          :scroll="{ x: 'max-content' }"
          @change="handleTableChange"
        >
          <template #bodyCell="{ column, record }">
            <template v-if="column.key === 'name'">
              <div class="name-cell">
                <span class="category-name">{{ record.name }}</span>
              </div>
            </template>

            <template v-if="column.key === 'status'">
              <a-tag :color="record.status === CategoryStatus.Enabled ? 'green' : 'default'">
                {{ record.status === CategoryStatus.Enabled ? '启用' : '禁用' }}
              </a-tag>
            </template>

            <template v-if="column.key === 'operator'">
              <div class="operator-info">
                <a-avatar size="small" :style="{ backgroundColor: getAvatarColor(record.operator_name) }">
                  {{ getInitials(record.operator_name) }}
                </a-avatar>
                <span class="operator-name">{{ record.operator_name }}</span>
              </div>
            </template>

            <template v-if="column.key === 'created_at'">
              <div class="date-info">
                <div class="date">{{ formatDate(record.created_at) }}</div>
                <div class="time">{{ formatTime(record.created_at) }}</div>
              </div>
            </template>

            <template v-if="column.key === 'action'">
              <div class="action-buttons">
                <a-button type="primary" size="small" @click="handleView(record)">
                  查看
                </a-button>
                <a-button type="default" size="small" @click="handleEdit(record)">
                  编辑
                </a-button>
                <a-dropdown>
                  <template #overlay>
                    <a-menu @click="({ key }: any) => handleMenuAction(key, record)">
                      <a-menu-item key="toggleStatus">
                        <template v-if="record.status === CategoryStatus.Enabled">
                          <StopOutlined />
                          禁用
                        </template>
                        <template v-else>
                          <CheckCircleOutlined />
                          启用
                        </template>
                      </a-menu-item>
                      <a-menu-divider />
                      <a-menu-item key="delete" danger>
                        <DeleteOutlined />
                        删除
                      </a-menu-item>
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

    <!-- 创建/编辑对话框 -->
    <a-modal 
      :open="formDialog.visible" 
      :title="formDialog.isEdit ? '编辑分类' : '创建分类'" 
      :width="dialogWidth"
      @ok="handleSubmit" 
      @cancel="closeFormDialog"
      :confirm-loading="submitLoading"
      destroy-on-close
    >
      <a-form 
        ref="formRef" 
        :model="formDialog.data" 
        :rules="formRules" 
        layout="vertical"
      >
        <a-form-item label="分类名称" name="name">
          <a-input 
            v-model:value="formDialog.data.name" 
            placeholder="请输入分类名称" 
            maxlength="100"
          />
        </a-form-item>

        <a-form-item label="分类描述" name="description">
          <a-textarea 
            v-model:value="formDialog.data.description" 
            :rows="3" 
            placeholder="请输入分类描述（可选）"
            maxlength="500"
          />
        </a-form-item>

        <a-form-item label="状态" name="status">
          <a-radio-group v-model:value="formDialog.data.status">
            <a-radio :value="CategoryStatus.Enabled">启用</a-radio>
            <a-radio :value="CategoryStatus.Disabled">禁用</a-radio>
          </a-radio-group>
        </a-form-item>
      </a-form>
    </a-modal>

    <!-- 详情对话框 -->
    <a-modal 
      :open="detailDialog.visible" 
      title="分类详情" 
      :width="dialogWidth" 
      :footer="null" 
      @cancel="closeDetailDialog"
    >
      <div v-if="detailDialog.data" class="detail-content">
        <a-descriptions bordered :column="1">
          <a-descriptions-item label="分类ID">
            {{ detailDialog.data.id }}
          </a-descriptions-item>
          <a-descriptions-item label="分类名称">
            {{ detailDialog.data.name }}
          </a-descriptions-item>
          <a-descriptions-item label="分类描述">
            {{ detailDialog.data.description || '无描述' }}
          </a-descriptions-item>
          <a-descriptions-item label="状态">
            <a-tag :color="detailDialog.data.status === CategoryStatus.Enabled ? 'green' : 'default'">
              {{ detailDialog.data.status === CategoryStatus.Enabled ? '启用' : '禁用' }}
            </a-tag>
          </a-descriptions-item>
          <a-descriptions-item label="操作人">
            {{ detailDialog.data.operator_name }}
          </a-descriptions-item>
          <a-descriptions-item label="创建时间">
            {{ formatFullDateTime(detailDialog.data.created_at) }}
          </a-descriptions-item>
          <a-descriptions-item label="更新时间">
            {{ formatFullDateTime(detailDialog.data.updated_at) }}
          </a-descriptions-item>
        </a-descriptions>

        <div class="detail-footer">
          <a-button @click="closeDetailDialog">关闭</a-button>
          <a-button type="primary" @click="handleEdit(detailDialog.data)">
            编辑
          </a-button>
        </div>
      </div>
    </a-modal>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted, watch } from 'vue';
import { message, Modal, type FormInstance } from 'ant-design-vue';
import {
  PlusOutlined,
  FolderOutlined,
  CheckCircleOutlined,
  StopOutlined,
  DownOutlined,
  DeleteOutlined
} from '@ant-design/icons-vue';

import {
  CategoryStatus,
  type WorkorderCategoryItem,
  type CreateWorkorderCategoryReq,
  type UpdateWorkorderCategoryReq,
  type DeleteWorkorderCategoryReq,
  type DetailWorkorderCategoryReq,
  type ListWorkorderCategoryReq,
  createWorkorderCategory,
  updateWorkorderCategory,
  deleteWorkorderCategory,
  listWorkorderCategory,
  detailWorkorderCategory
} from '#/api/core/workorder/workorder_category';

/**
 * 表格列配置
 */
const tableColumns = [
  {
    title: '分类名称',
    dataIndex: 'name',
    key: 'name',
    width: 200,
    ellipsis: true
  },
  {
    title: '描述',
    dataIndex: 'description',
    key: 'description',
    width: 250,
    ellipsis: true
  },
  {
    title: '状态',
    dataIndex: 'status',
    key: 'status',
    width: 100,
    align: 'center' as const
  },
  {
    title: '操作人',
    dataIndex: 'operator_name',
    key: 'operator',
    width: 150
  },
  {
    title: '创建时间',
    dataIndex: 'created_at',
    key: 'created_at',
    width: 180
  },
  {
    title: '操作',
    key: 'action',
    width: 200,
    align: 'center' as const,
    fixed: 'right' as const
  }
];

/**
 * 响应式状态
 */
const loading = ref<boolean>(false);
const submitLoading = ref<boolean>(false);

// 搜索和筛选
const searchQuery = ref<string>('');
const statusFilter = ref<number | undefined>();

// 分页配置
const currentPage = ref<number>(1);
const pageSize = ref<number>(10);
const total = ref<number>(0);

// 数据列表
const categoryList = ref<WorkorderCategoryItem[]>([]);

// 统计数据
const statistics = reactive({
  total: 0,
  enabled: 0,
  disabled: 0
});

// 表单引用
const formRef = ref<FormInstance>();

// 响应式对话框宽度
const dialogWidth = computed(() => {
  if (typeof window !== 'undefined') {
    const width = window.innerWidth;
    if (width < 768) return '95%';
    if (width < 1024) return '80%';
    return '600px';
  }
  return '600px';
});

// 分页配置
const paginationConfig = computed(() => ({
  current: currentPage.value,
  pageSize: pageSize.value,
  total: total.value,
  showSizeChanger: true,
  showQuickJumper: true,
  showTotal: (total: number) => `共 ${total} 条记录`,
  pageSizeOptions: ['10', '20', '50', '100']
}));

/**
 * 对话框状态管理
 */
const formDialog = reactive({
  visible: false,
  isEdit: false,
  data: {
    name: '',
    description: '',
    status: CategoryStatus.Enabled
  } as CreateWorkorderCategoryReq & { id?: number }
});

const detailDialog = reactive({
  visible: false,
  data: null as WorkorderCategoryItem | null
});

/**
 * 表单验证规则
 */
const formRules = {
  name: [
    { required: true, message: '请输入分类名称', trigger: 'blur' },
    { min: 2, max: 100, message: '分类名称长度为2-100个字符', trigger: 'blur' }
  ],
  status: [
    { required: true, message: '请选择状态', trigger: 'change' }
  ]
};

/**
 * 核心数据加载方法 - 使用真分页
 */
const loadCategoryList = async (): Promise<void> => {
  loading.value = true;
  try {
    const params: ListWorkorderCategoryReq = {
      page: currentPage.value,
      size: pageSize.value
    };

    // 添加搜索条件
    if (searchQuery.value.trim()) {
      params.search = searchQuery.value.trim();
    }

    // 添加状态筛选
    if (statusFilter.value !== undefined) {
      params.status = statusFilter.value;
    }

    const response = await listWorkorderCategory(params);
    
    if (response) {
      categoryList.value = response.items || [];
      total.value = response.total || 0;
      
      // 更新统计数据
      updateStatistics();
    } else {
      categoryList.value = [];
      total.value = 0;
    }
  } catch (error) {

    message.error('加载分类列表失败');
    categoryList.value = [];
    total.value = 0;
  } finally {
    loading.value = false;
  }
};

/**
 * 更新统计数据
 */
const updateStatistics = (): void => {
  statistics.total = total.value;
  statistics.enabled = categoryList.value.filter(item => item.status === CategoryStatus.Enabled).length;
  statistics.disabled = categoryList.value.filter(item => item.status === CategoryStatus.Disabled).length;
};

/**
 * 表格变化处理 - 真分页
 */
const handleTableChange = (pagination: any): void => {
  if (pagination.current !== currentPage.value) {
    currentPage.value = pagination.current;
  }
  if (pagination.pageSize !== pageSize.value) {
    pageSize.value = pagination.pageSize;
    currentPage.value = 1; // 切换页面大小时重置到第一页
  }
  loadCategoryList();
};

/**
 * 搜索处理 - 重新分页
 */
const handleSearch = (): void => {
  currentPage.value = 1; // 搜索时重置到第一页
  loadCategoryList();
};

/**
 * 状态筛选变化 - 重新分页
 */
const handleStatusChange = (): void => {
  currentPage.value = 1; // 筛选时重置到第一页
  loadCategoryList();
};

/**
 * 操作处理方法
 */
const handleCreate = (): void => {
  formDialog.isEdit = false;
  formDialog.data = {
    name: '',
    description: '',
    status: CategoryStatus.Enabled
  };
  formDialog.visible = true;
};

const handleEdit = async (record: WorkorderCategoryItem): Promise<void> => {
  try {
    const loadingMsg = message.loading('加载分类详情...', 0);
    
    const params: DetailWorkorderCategoryReq = { id: record.id! };
    const response = await detailWorkorderCategory(params);
    
    loadingMsg();
    
    if (response) {
      formDialog.isEdit = true;
      formDialog.data = {
        id: response.id,
        name: response.name,
        description: response.description || '',
        status: response.status
      };
      formDialog.visible = true;
      detailDialog.visible = false; // 如果是从详情对话框打开的，关闭详情对话框
    }
  } catch (error) {

    message.error('加载分类详情失败');
  }
};

const handleView = async (record: WorkorderCategoryItem): Promise<void> => {
  try {
    const loadingMsg = message.loading('加载分类详情...', 0);
    
    const params: DetailWorkorderCategoryReq = { id: record.id! };
    const response = await detailWorkorderCategory(params);
    
    loadingMsg();
    
    if (response) {
      detailDialog.data = response;
      detailDialog.visible = true;
    }
  } catch (error) {

    message.error('加载分类详情失败');
  }
};

const handleMenuAction = (key: string, record: WorkorderCategoryItem): void => {
  switch (key) {
    case 'toggleStatus':
      handleToggleStatus(record);
      break;
    case 'delete':
      handleDelete(record);
      break;
  }
};

/**
 * 状态切换
 */
const handleToggleStatus = async (record: WorkorderCategoryItem): Promise<void> => {
  try {
    const newStatus = record.status === CategoryStatus.Enabled ? CategoryStatus.Disabled : CategoryStatus.Enabled;
    
    const params: UpdateWorkorderCategoryReq = {
      id: record.id!,
      name: record.name,
      description: record.description,
      status: newStatus
    };

    await updateWorkorderCategory(params);
    
    const statusText = newStatus === CategoryStatus.Enabled ? '启用' : '禁用';
    message.success(`分类 "${record.name}" 已${statusText}`);
    
    // 重新加载当前页数据
    await loadCategoryList();
  } catch (error) {

    message.error('更新分类状态失败');
  }
};

/**
 * 删除分类
 */
const handleDelete = (record: WorkorderCategoryItem): void => {
  Modal.confirm({
    title: '确认删除',
    content: `确定要删除分类 "${record.name}" 吗？删除后不可恢复。`,
    okText: '删除',
    okType: 'danger',
    cancelText: '取消',
    async onOk() {
      try {
        const params: DeleteWorkorderCategoryReq = { id: record.id! };
        await deleteWorkorderCategory(params);
        
        message.success(`分类 "${record.name}" 已删除`);
        
        // 如果当前页删除后没有数据且不是第一页，回到上一页
        if (categoryList.value.length === 1 && currentPage.value > 1) {
          currentPage.value = currentPage.value - 1;
        }
        
        await loadCategoryList();
      } catch (error) {

        message.error('删除分类失败');
      }
    }
  });
};

/**
 * 表单提交
 */
const handleSubmit = async (): Promise<void> => {
  if (!formRef.value) return;
  
  try {
    await formRef.value.validate();
  } catch (error) {
    return;
  }

  submitLoading.value = true;
  try {
    if (formDialog.isEdit) {
      // 更新分类
      const params: UpdateWorkorderCategoryReq = {
        id: formDialog.data.id!,
        name: formDialog.data.name,
        description: formDialog.data.description,
        status: formDialog.data.status
      };
      
      await updateWorkorderCategory(params);
      message.success(`分类 "${formDialog.data.name}" 更新成功`);
    } else {
      // 创建分类
      const params: CreateWorkorderCategoryReq = {
        name: formDialog.data.name,
        description: formDialog.data.description,
        status: formDialog.data.status
      };
      
      await createWorkorderCategory(params);
      message.success(`分类 "${formDialog.data.name}" 创建成功`);
      
      // 创建成功后跳转到第一页
      currentPage.value = 1;
    }
    
    closeFormDialog();
    await loadCategoryList();
  } catch (error) {

    message.error('保存分类失败');
  } finally {
    submitLoading.value = false;
  }
};

/**
 * 对话框控制
 */
const closeFormDialog = (): void => {
  formDialog.visible = false;
  formRef.value?.resetFields();
};

const closeDetailDialog = (): void => {
  detailDialog.visible = false;
};

/**
 * 辅助工具方法
 */
const formatDate = (dateStr: string): string => {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleDateString('zh-CN');
};

const formatTime = (dateStr: string): string => {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleTimeString('zh-CN', { 
    hour: '2-digit', 
    minute: '2-digit' 
  });
};

const formatFullDateTime = (dateStr: string): string => {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleString('zh-CN');
};

const getInitials = (name: string): string => {
  if (!name) return '';
  const words = name.trim().split('');
  return words.slice(0, 2).join('').toUpperCase();
};

const getAvatarColor = (name: string): string => {
  const colors = [
    '#1890ff', '#52c41a', '#faad14', '#f5222d',
    '#722ed1', '#13c2c2', '#eb2f96', '#fa8c16'
  ];
  
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  
  return colors[Math.abs(hash) % colors.length]!;
};

/**
 * 监听搜索条件变化，自动触发搜索
 */
watch([searchQuery, statusFilter], () => {
  // 防抖处理，避免频繁请求
  const timeoutId = setTimeout(() => {
    if (searchQuery.value.trim() !== '' || statusFilter.value !== undefined) {
      handleSearch();
    }
  }, 500);
  
  return () => clearTimeout(timeoutId);
});

/**
 * 组件挂载时初始化数据
 */
onMounted(() => {
  loadCategoryList();
});
</script>

<style scoped>
.workorder-category-container {
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

.create-btn {
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

.status-filter {
  width: 120px;
  min-width: 100px;
}

.stats-grid {
  margin-bottom: 20px;
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px;
}

.stats-card {
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
  height: 100%;
}

.table-container {
  margin-bottom: 24px;
}

.name-cell {
  display: flex;
  align-items: center;
  gap: 10px;
}

.category-name {
  font-weight: 500;
  word-break: break-all;
}

.operator-info {
  display: flex;
  align-items: center;
  gap: 8px;
}

.operator-name {
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
  gap: 8px;
  justify-content: center;
  flex-wrap: wrap;
}

.detail-content {
  margin-bottom: 20px;
}

.detail-footer {
  margin-top: 24px;
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  flex-wrap: wrap;
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
:deep(.ant-modal) {
  max-width: calc(100vw - 16px);
  margin: 8px;
}

/* 移动端适配 */
@media (max-width: 768px) {
  .workorder-category-container {
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
  
  .status-filter {
    width: 100%;
    min-width: auto;
  }
  
  .create-btn {
    padding: 4px 8px;
    min-width: auto;
  }
  
  .stats-grid {
    grid-template-columns: 1fr;
    gap: 12px;
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
  
  :deep(.ant-modal-body) {
    padding: 16px;
    max-height: calc(100vh - 160px);
    overflow-y: auto;
  }
}

/* 平板端适配 */
@media (max-width: 1024px) and (min-width: 769px) {
  .workorder-category-container {
    padding: 16px;
  }
  
  .search-input {
    width: 200px;
  }
  
  .stats-grid {
    grid-template-columns: repeat(2, 1fr);
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
  
  .operator-info {
    flex-direction: column;
    gap: 4px;
    align-items: center;
  }
  
  .operator-name {
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

/* 大屏幕优化 */
@media (min-width: 1200px) {
  .stats-grid {
    grid-template-columns: repeat(3, 1fr);
  }
}
</style>
