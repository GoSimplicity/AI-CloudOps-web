<template>
  <OpsPage title="YAML 任务管理" description="基于模板创建和执行 Kubernetes YAML 部署任务">
    <template #actions>
            <a-button type="primary" @click="openCreateModal" :disabled="!filterClusterId || !templates.length">
              <template #icon><PlusOutlined aria-hidden="true"  /></template>
              创建任务
            </a-button>
            <a-button @click="fetchTasks" :loading="loading" :disabled="!filterClusterId">
              <template #icon><ReloadOutlined aria-hidden="true"  /></template>
              刷新数据
            </a-button>
    </template>

    <!-- 工具栏 -->
    <template #filters>
    <div class="ops-filter-row">
      <!-- 筛选和搜索区域 -->
      <div class="k8s-toolbar-filters">
        <div class="k8s-filter-group">
          <a-select 
            v-model:value="filterClusterId" 
            placeholder="选择集群" 
            class="k8s-cluster-selector"
            aria-label="选择集群"
            allow-clear 
            @change="handleClusterChange"
            :loading="clustersLoading"
            :disabled="clustersLoading"
            @popup-scroll="handleClusterDropdownScroll"
          >
            <template #suffixIcon><DatabaseOutlined aria-hidden="true"  /></template>
            <a-select-option v-for="cluster in clusters" :key="cluster.id" :value="cluster.id">
              <div style="display: flex; align-items: center; justify-content: space-between;">
                <span class="k8s-cluster-name" :title="cluster.name">{{ cluster.name }}</span>
                <a-tag color="blue" size="small">{{ getEnvText(cluster.env) }}</a-tag>
              </div>
            </a-select-option>
            <a-select-option 
              v-if="clusters.length > 0 && clusters.length < clustersTotal" 
              :value="'__load_more__'" 
              disabled
              style="text-align: center; color: #999;"
            >
              <a-spin size="small" :spinning="clustersLoading" />
              <span v-if="!clustersLoading">滚动加载更多...</span>
            </a-select-option>
          </a-select>

          <a-select 
            v-model:value="filterTemplateId" 
            placeholder="选择模板" 
            class="k8s-filter-select" 
            allow-clear 
            @change="handleFilterChange"
            :disabled="!filterClusterId"
            :loading="templatesLoading"
          >
            <template #suffixIcon><FileTextOutlined aria-hidden="true"  /></template>
            <a-select-option v-for="template in templates" :key="template.id" :value="template.id">
              {{ template.name }}
            </a-select-option>
            <a-select-option 
              v-if="templates.length > 0 && templates.length < templatesTotal" 
              :value="'__load_more_templates__'" 
              disabled
              style="text-align: center; color: #999;"
            >
              <a-button type="link" size="small" @click.stop="loadMoreTemplates" :loading="templatesLoading">
                加载更多...
              </a-button>
            </a-select-option>
          </a-select>

          <a-select 
            v-model:value="filterStatus" 
            placeholder="状态筛选" 
            class="k8s-filter-select" 
            allow-clear 
            @change="handleFilterChange"
          >
            <template #suffixIcon><FilterOutlined aria-hidden="true"  /></template>
            <a-select-option :value="TaskStatus.PENDING">等待中</a-select-option>
            <a-select-option :value="TaskStatus.RUNNING">运行中</a-select-option>
            <a-select-option :value="TaskStatus.SUCCESS">成功</a-select-option>
            <a-select-option :value="TaskStatus.FAILED">失败</a-select-option>
            <a-select-option :value="TaskStatus.CANCELLED">已取消</a-select-option>
          </a-select>
        </div>

        <div class="k8s-search-group">
          <a-input 
            v-model:value="searchText" 
            placeholder="🔍 搜索任务名称" 
            class="k8s-search-input" 
            @pressEnter="onSearch"
            @input="onSearch"
            allow-clear 
          >
            <template #suffix>
              <SearchOutlined aria-hidden="true" class="k8s-search-icon" />
            </template>
          </a-input>
        </div>
      </div>

      <!-- 操作区域 -->
      <div class="k8s-toolbar-actions">
        <div class="k8s-action-buttons">
          <a-button 
            @click="resetFilters" 
            :disabled="!filterStatus && !searchText && !filterClusterId && !filterTemplateId"
            class="k8s-toolbar-btn"
            title="重置所有筛选条件"
          >
            <template #icon><DeleteOutlined aria-hidden="true"  /></template>
            重置筛选
          </a-button>


          <a-button 
            type="primary" 
            @click="() => batchOperation('执行')" 
            :disabled="!selectedRows.length || selectedRows.some(row => row.status === TaskStatus.RUNNING)" 
            v-if="selectedRows.length > 0"
            class="k8s-toolbar-btn"
            title="批量执行选中的任务"
          >
            <template #icon><PlayCircleOutlined aria-hidden="true"  /></template>
            执行 ({{ selectedRows.length }})
          </a-button>

          <a-button 
            type="primary" 
            danger 
            @click="() => batchOperation('删除')" 
            :disabled="!selectedRows.length" 
            v-if="selectedRows.length > 0"
            class="k8s-toolbar-btn"
            title="批量删除选中的任务"
          >
            <template #icon><DeleteOutlined aria-hidden="true"  /></template>
            删除 ({{ selectedRows.length }})
          </a-button>
        </div>
      </div>
    </div>

    </template>
    <a-alert v-if="clustersError" type="error" :message="clustersError" show-icon>
      <template #action><a-button size="small" @click="fetchClusters(true)">重试集群</a-button></template>
    </a-alert>
    <a-alert v-if="templatesError" type="error" :message="templatesError" show-icon>
      <template #action><a-button size="small" @click="fetchTemplates(true)">重试模板目录</a-button></template>
    </a-alert>
    <a-alert v-if="loadError" type="error" :message="loadError" show-icon>
      <template #action><a-button size="small" @click="fetchTasks">重试查询</a-button></template>
    </a-alert>

    <!-- 数据展示区域 -->
    <div class="k8s-data-display">
      <a-table
        :columns="columns"
        :data-source="filteredTasks"
        :row-selection="rowSelection"
        :loading="loading"
        row-key="id"
        :pagination="{
          current: currentPage,
          pageSize: pageSize,
          total: total,
          showSizeChanger: true,
          showQuickJumper: true,
          showTotal: (total: number, range: number[]) => `显示 ${range[0]}-${range[1]} 条，共 ${total} 条数据`,
          pageSizeOptions: ['10', '20', '30', '50']
        }"
        @change="handleTableChange"
        class="k8s-table task-table"
        :scroll="{ x: 1400 }"
      >
        <template #status="{ text }">
          <a-badge :status="getStatusColor(text)" :text="getStatusText(text)" />
        </template>

        <template #template_id="{ text }">
          <a-tag color="blue" v-if="text">{{ getTemplateName(text) }}</a-tag>
          <span v-else class="k8s-no-data">-</span>
        </template>

        <template #variables="{ text }">
          <div class="task-variables">
            <a-tag v-for="(variable, index) in (text || []).slice(0, 3)" :key="index" color="cyan" class="variable-tag">
              {{ variable }}
            </a-tag>
            <a-tooltip v-if="(text || []).length > 3" :title="(text || []).join('\n')">
              <a-tag color="cyan" class="variable-tag">
                +{{ (text || []).length - 3 }} 更多
              </a-tag>
            </a-tooltip>
            <span v-if="!text || !Array.isArray(text) || text.length === 0" class="k8s-no-data">-</span>
          </div>
        </template>

        <template #apply_result="{ text }">
          <div class="apply-result-preview">
            <code v-if="text" class="result-preview">{{ getResultPreview(text) }}</code>
            <span v-else class="k8s-no-data">-</span>
          </div>
        </template>

        <template #createdAt="{ text }">
          <div v-if="text" style="font-size: 12px; color: #666;">
            <div>{{ formatDateTime(text) }}</div>
            <div style="color: #999; font-size: 11px; margin-top: 2px;">{{ getRelativeTime(text) }}</div>
          </div>
          <span v-else class="k8s-no-data">-</span>
        </template>

        <template #updatedAt="{ text }">
          <div v-if="text" style="font-size: 12px; color: #666;">
            <div>{{ formatDateTime(text) }}</div>
            <div style="color: #999; font-size: 11px; margin-top: 2px;">{{ getRelativeTime(text) }}</div>
          </div>
          <span v-else class="k8s-no-data">-</span>
        </template>

        <template #actions="{ record }">
          <div class="k8s-action-column">
            <a-tooltip title="查看详情">
              <a-button title="查看详情" @click="showTaskDetail(record)">
                <template #icon><EyeOutlined aria-hidden="true"  /></template>
              </a-button>
            </a-tooltip>
            <a-tooltip title="执行任务">
              <a-button 
                title="执行任务" 
                @click="openExecuteModal(record)"
                :disabled="record.status === TaskStatus.RUNNING"
              >
                <template #icon><PlayCircleOutlined aria-hidden="true"  /></template>
              </a-button>
            </a-tooltip>
            <a-tooltip title="编辑">
              <a-button 
                title="编辑" 
                @click="openEditModal(record)"
                :disabled="record.status === TaskStatus.RUNNING"
              >
                <template #icon><EditOutlined aria-hidden="true"  /></template>
              </a-button>
            </a-tooltip>
            <a-tooltip title="删除">
              <a-button 
                title="删除" 
                danger 
                @click="deleteTask(record)"
                :disabled="record.status === TaskStatus.RUNNING"
              >
                <template #icon><DeleteOutlined aria-hidden="true"  /></template>
              </a-button>
            </a-tooltip>
          </div>
        </template>

        <template #emptyText>
          <div class="k8s-empty-state">
            <PlayCircleOutlined aria-hidden="true"  />
            <p>暂无任务数据</p>
            <p>请先选择集群和模板</p>
          </div>
        </template>
      </a-table>
    </div>

    <!-- 创建任务模态框 -->
    <a-modal
      v-model:open="isCreateModalVisible"
      title="创建 YAML 任务"
      @ok="submitCreateForm"
      @cancel="closeCreateModal"
      :confirmLoading="submitLoading"
      width="700px"
      :maskClosable="false"
      destroyOnClose
      okText="创建"
      cancelText="取消"
    >
      <a-form 
        ref="formRef"
        :model="createFormModel" 
        layout="vertical" 
        class="k8s-form"
        :rules="createFormRules"
      >
        <a-form-item label="任务名称" name="name" :required="true">
          <a-input 
            v-model:value="createFormModel.name" 
            placeholder="请输入任务名称（例如：deploy-nginx-prod）" 
            class="k8s-form-input"
            :maxlength="50"
          />
          <div style="color: #999; font-size: 12px; margin-top: 4px;">
            支持中英文、数字、下划线和连字符，用于标识和查找任务
          </div>
        </a-form-item>

        <a-form-item label="选择模板" name="template_id" :required="true">
          <a-select 
            v-model:value="createFormModel.template_id" 
            placeholder="请选择 YAML 模板" 
            class="k8s-form-input"
            :disabled="!filterClusterId"
            :loading="templatesLoading"
            @popup-scroll="handleTemplateDropdownScroll"
          >
            <a-select-option v-for="template in templates" :key="template.id" :value="template.id">
              <div style="display: flex; align-items: center; width: 100%; gap: 8px;">
                <span style="flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">{{ template.name }}</span>
                <a-tag color="green" size="small" style="flex-shrink: 0;">ID: {{ template.id }}</a-tag>
              </div>
            </a-select-option>
            <a-select-option 
              v-if="templates.length > 0 && templates.length < templatesTotal" 
              :value="'__load_more_templates_create__'" 
              disabled
              style="text-align: center; color: #999;"
            >
              <a-button type="link" size="small" @click.stop="loadMoreTemplates" :loading="templatesLoading">
                加载更多...
              </a-button>
            </a-select-option>
          </a-select>
        </a-form-item>

        <a-form-item label="任务变量（可选）">
          <div class="task-variables-config">
            <div v-if="createFormModel.variables.length === 0" style="text-align: center; color: #999; padding: 16px;">
              暂无变量，点击下方按钮添加
            </div>
            <div v-for="(_, index) in createFormModel.variables" :key="index" class="variable-input-row">
              <a-input 
                v-model:value="createFormModel.variables[index]" 
                placeholder="输入变量值（例如：nginx:1.20）" 
                class="k8s-form-input"
                :maxlength="200"
              />
              <a-button 
                type="text" 
                danger 
                @click="removeVariableField(index)" 
                size="small"
              >
                <template #icon><DeleteOutlined aria-hidden="true"  /></template>
              </a-button>
            </div>
            <a-button type="dashed" @click="addVariableField" style="margin-top: 8px; width: 100%;">
              <template #icon><PlusOutlined aria-hidden="true"  /></template>
              添加变量
            </a-button>
          </div>
        </a-form-item>
      </a-form>
    </a-modal>

    <!-- 编辑任务模态框 -->
    <a-modal
      v-model:open="isEditModalVisible"
      title="编辑 YAML 任务"
      @ok="submitEditForm"
      @cancel="closeEditModal"
      :confirmLoading="submitLoading"
      width="700px"
      :maskClosable="false"
      destroyOnClose
      okText="保存"
      cancelText="取消"
    >
      <a-form 
        ref="editFormRef"
        :model="editFormModel" 
        layout="vertical" 
        class="k8s-form"
        :rules="editFormRules"
      >
        <a-form-item label="任务名称" name="name" :required="true">
          <a-input 
            v-model:value="editFormModel.name" 
            placeholder="请输入任务名称" 
            class="k8s-form-input"
            :maxlength="255"
          />
        </a-form-item>

        <a-form-item label="选择模板">
          <a-select 
            v-model:value="editFormModel.template_id" 
            placeholder="请选择 YAML 模板" 
            class="k8s-form-input"
            :disabled="!filterClusterId"
            :loading="templatesLoading"
          >
            <a-select-option v-for="template in templates" :key="template.id" :value="template.id">
              <div style="display: flex; align-items: center; width: 100%; gap: 8px;">
                <span style="flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">{{ template.name }}</span>
                <a-tag color="green" size="small" style="flex-shrink: 0;">ID: {{ template.id }}</a-tag>
              </div>
            </a-select-option>
          </a-select>
        </a-form-item>

        <a-form-item label="任务变量">
          <div class="task-variables-config">
            <div v-if="editFormModel.variables.length === 0" style="text-align: center; color: #999; padding: 16px;">
              暂无变量，点击下方按钮添加
            </div>
            <div v-for="(_, index) in editFormModel.variables" :key="index" class="variable-input-row">
              <a-input 
                v-model:value="editFormModel.variables[index]" 
                placeholder="输入变量值" 
                class="k8s-form-input"
                :maxlength="200"
              />
              <a-button 
                type="text" 
                danger 
                @click="removeEditVariableField(index)" 
                size="small"
              >
                <template #icon><DeleteOutlined aria-hidden="true"  /></template>
              </a-button>
            </div>
            <a-button type="dashed" @click="addEditVariableField" style="margin-top: 8px; width: 100%;">
              <template #icon><PlusOutlined aria-hidden="true"  /></template>
              添加变量
            </a-button>
          </div>
        </a-form-item>
      </a-form>
    </a-modal>

    <!-- 执行任务模态框 -->
    <a-modal
      v-model:open="isExecuteModalVisible"
      title="执行任务"
      @ok="submitExecuteForm"
      @cancel="closeExecuteModal"
      :confirmLoading="executeLoading"
      width="500px"
      :maskClosable="false"
      destroyOnClose
      okText="执行"
      cancelText="取消"
    >
      <a-alert
        message="任务执行"
        :description="`即将执行任务 '${currentOperationTask?.name}'，请确认执行选项`"
        type="info"
        show-icon
        style="margin-bottom: 24px;"
      />

      <a-form 
        ref="executeFormRef"
        :model="executeFormModel" 
        layout="vertical" 
        class="k8s-form"
      >
        <a-form-item label="执行选项">
          <a-checkbox v-model:checked="executeFormModel.dry_run">
            预检查模式 (Dry Run)
          </a-checkbox>
          <div style="color: #999; font-size: 12px; margin-top: 4px;">
            勾选后将仅进行预检查，不会实际应用到集群
          </div>
        </a-form-item>

        <a-form-item label="任务信息" v-if="currentOperationTask">
          <div class="task-info-display">
            <div class="info-item">
              <span class="info-label">任务名称:</span>
              <span class="info-value">{{ currentOperationTask.name }}</span>
            </div>
            <div class="info-item">
              <span class="info-label">使用模板:</span>
              <span class="info-value">{{ getTemplateName(currentOperationTask.template_id) }}</span>
            </div>
            <div class="info-item" v-if="currentOperationTask.variables && currentOperationTask.variables.length > 0">
              <span class="info-label">变量列表:</span>
              <div class="info-variables">
                <a-tag v-for="(variable, index) in currentOperationTask.variables" :key="index" color="cyan">
                  {{ variable }}
                </a-tag>
              </div>
            </div>
          </div>
        </a-form-item>
      </a-form>
    </a-modal>

    <!-- 详情模态框 -->
    <a-modal
      v-model:open="isDetailModalVisible"
      title="任务详情"
      :footer="null"
      @cancel="closeDetailModal"
      width="900px"
      :maskClosable="false"
      destroyOnClose
    >
      <div v-if="currentTaskDetail" class="k8s-detail-content">
        <a-row :gutter="[24, 16]">
          <a-col :xs="24" :lg="12">
            <a-card title="基本信息" class="k8s-detail-card" size="small">
              <div class="k8s-detail-item">
                <span class="k8s-detail-label">任务ID:</span>
                <span class="k8s-detail-value">{{ currentTaskDetail.id }}</span>
              </div>
              <div class="k8s-detail-item">
                <span class="k8s-detail-label">任务名称:</span>
                <span class="k8s-detail-value">{{ currentTaskDetail.name }}</span>
              </div>
              <div class="k8s-detail-item">
                <span class="k8s-detail-label">状态:</span>
                <a-badge :status="getStatusColor(currentTaskDetail.status)" :text="getStatusText(currentTaskDetail.status)" />
              </div>
              <div class="k8s-detail-item">
                <span class="k8s-detail-label">集群ID:</span>
                <span class="k8s-detail-value">{{ currentTaskDetail.cluster_id }}</span>
              </div>
              <div class="k8s-detail-item">
                <span class="k8s-detail-label">用户ID:</span>
                <span class="k8s-detail-value">{{ currentTaskDetail.user_id || '-' }}</span>
              </div>
            </a-card>
          </a-col>

          <a-col :xs="24" :lg="12">
            <a-card title="执行信息" class="k8s-detail-card" size="small">
              <div class="k8s-detail-item">
                <span class="k8s-detail-label">使用模板:</span>
                <span class="k8s-detail-value">{{ getTemplateName(currentTaskDetail.template_id) }}</span>
              </div>
              <div class="k8s-detail-item">
                <span class="k8s-detail-label">创建时间:</span>
                <span class="k8s-detail-value">{{ formatK8sTime(currentTaskDetail.created_at) }}</span>
              </div>
              <div class="k8s-detail-item">
                <span class="k8s-detail-label">更新时间:</span>
                <span class="k8s-detail-value">{{ formatK8sTime(currentTaskDetail.updated_at) }}</span>
              </div>
            </a-card>
          </a-col>
        </a-row>

        <a-row :gutter="[24, 16]" style="margin-top: 16px;">
          <a-col :xs="24" :lg="12">
            <a-card title="任务变量" class="k8s-detail-card" size="small">
              <div class="task-variables">
                <a-tag v-for="(variable, index) in (currentTaskDetail.variables || [])" :key="index" color="cyan" style="margin-bottom: 8px;">
                  {{ variable }}
                </a-tag>
                <span v-if="!currentTaskDetail.variables || currentTaskDetail.variables.length === 0" class="k8s-no-data">
                  暂无变量
                </span>
              </div>
            </a-card>
          </a-col>

          <a-col :xs="24" :lg="12">
            <a-card title="执行结果" class="k8s-detail-card" size="small">
              <pre v-if="currentTaskDetail.apply_result" class="apply-result-detail">{{ currentTaskDetail.apply_result }}</pre>
              <span v-else class="k8s-no-data">暂无执行结果</span>
            </a-card>
          </a-col>
        </a-row>
      </div>
    </a-modal>

  </OpsPage>
</template>

<script lang="ts" setup>
import OpsPage from '#/components/ops/OpsPage.vue';
import { onMounted } from 'vue';
import { useTaskPage } from './Task';
import { formatDateTime, getRelativeTime } from '../shared/utils';
import { 
  PlusOutlined, 
  ReloadOutlined, 
  FilterOutlined, 
  DeleteOutlined, 
  PlayCircleOutlined,
  EyeOutlined,
  SearchOutlined,
  EditOutlined,
  FileTextOutlined,
  DatabaseOutlined,
} from '@ant-design/icons-vue';

const {
  // state

  templates,
  clusters,
  loading,
  loadError,
  clustersError,
  templatesError,
  clustersLoading,
  templatesLoading,
  searchText,
  filterClusterId,
  filterTemplateId,
  filterStatus,
  selectedRows,
  currentPage,
  pageSize,
  total,
  clustersTotal,
  templatesTotal,

  // modal state
  isCreateModalVisible,
  isEditModalVisible,
  isDetailModalVisible,
  isExecuteModalVisible,
  submitLoading,
  executeLoading,

  // operation targets
  currentOperationTask,
  currentTaskDetail,

  // form models
  createFormModel,
  editFormModel,
  executeFormModel,

  // form refs
  formRef,
  editFormRef,

  // form rules
  createFormRules,
  editFormRules,

  // computed
  filteredTasks,
  rowSelection,

  // helpers
  getEnvText,
  getStatusText,
  getStatusColor,
  formatK8sTime,
  getTemplateName,

  // operations
  fetchClusters,
  fetchTemplates,
  fetchTasks,
  clearTasks,
  clearTemplates,
  loadMoreClusters,
  loadMoreTemplates,

  // detail operations
  showTaskDetail,
  closeDetailModal,

  // create operations
  openCreateModal,
  closeCreateModal,
  submitCreateForm,

  // edit operations
  openEditModal,
  closeEditModal,
  submitEditForm,

  // execute operations
  openExecuteModal,
  closeExecuteModal,
  submitExecuteForm,

  // task operations
  deleteTask,

  // batch operations
  batchOperation,

  // pagination operations
  handlePageChange,

  // form field operations
  addVariableField,
  removeVariableField,
  addEditVariableField,
  removeEditVariableField,

  // constants
  TaskStatus,
} = useTaskPage();

const onSearch = () => {
  currentPage.value = 1;
  fetchTasks();
};

const handleFilterChange = () => {
  currentPage.value = 1;
  fetchTasks();
};

const handleClusterChange = () => {
  currentPage.value = 1;
  clearTemplates();
  clearTasks();

  if (filterClusterId.value) {
    fetchTemplates(true); // 重置模板分页
    fetchTasks();
  } else {
  }
};

const handleTableChange = (pagination: { current?: number; pageSize?: number }) => {
  if (pagination) {
    handlePageChange(pagination.current || currentPage.value, pagination.pageSize);
  }
};

// 处理集群下拉选择的滚动事件
const handleClusterDropdownScroll = (e: Event) => {
  const { target } = e;
  if (target && 'scrollTop' in target && 'scrollHeight' in target && 'clientHeight' in target) {
    const scrollTarget = target as HTMLElement;
    if (scrollTarget.scrollTop + scrollTarget.clientHeight >= scrollTarget.scrollHeight - 5) {
      loadMoreClusters();
    }
  }
};

// 处理模板下拉选择的滚动事件
const handleTemplateDropdownScroll = (e: Event) => {
  const { target } = e;
  if (target && 'scrollTop' in target && 'scrollHeight' in target && 'clientHeight' in target) {
    const scrollTarget = target as HTMLElement;
    if (scrollTarget.scrollTop + scrollTarget.clientHeight >= scrollTarget.scrollHeight - 5) {
      loadMoreTemplates();
    }
  }
};

// 获取执行结果预览内容
const getResultPreview = (result: string) => {
  if (!result) return '暂无结果';
  const lines = result.split('\n');
  if (lines.length <= 2) return result;
  return lines.slice(0, 2).join('\n') + '\n...';
};

const columns = [
  { title: 'ID', dataIndex: 'id', key: 'id', width: 80 },
  { title: '名称', dataIndex: 'name', key: 'name', width: 150, ellipsis: true, fixed: 'left' },
  { title: '状态', dataIndex: 'status', key: 'status', width: 90, align: 'center', slots: { customRender: 'status' } },
  { title: '使用模板', dataIndex: 'template_id', key: 'template_id', width: 150, slots: { customRender: 'template_id' } },
  { title: '变量', dataIndex: 'variables', key: 'variables', width: 150, slots: { customRender: 'variables' } },
  { title: '执行结果', dataIndex: 'apply_result', key: 'apply_result', width: 200, slots: { customRender: 'apply_result' } },
  { title: '创建时间', dataIndex: 'created_at', key: 'created_at', width: 160, slots: { customRender: 'createdAt' } },
  { title: '更新时间', dataIndex: 'updated_at', key: 'updated_at', width: 160, slots: { customRender: 'updatedAt' } },
  { title: '操作', key: 'actions', width: 200, fixed: 'right', align: 'center', slots: { customRender: 'actions' } },
];

// 重置所有筛选条件
const resetFilters = () => {
  filterStatus.value = undefined;
  filterTemplateId.value = undefined;
  searchText.value = '';
  filterClusterId.value = undefined;
  currentPage.value = 1;
  clearTasks();
  clearTemplates();
};

onMounted(async () => {
  await fetchClusters();
});
</script>

<style scoped>
@import '../shared/k8s-common.css';
</style>

<style scoped src="./Task.css"></style>
