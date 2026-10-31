<template>
  <OpsPage
    description="基于模板创建和执行 Kubernetes YAML 部署任务"
    title="YAML 任务管理"
  >
    <template #actions>
      <a-button
        :disabled="!filterClusterId || !templates.length"
        type="primary"
        @click="openCreateModal"
      >
        <template #icon><PlusOutlined aria-hidden="true" /></template>
        创建任务
      </a-button>
      <a-button
        :disabled="!filterClusterId"
        :loading="loading"
        @click="fetchTasks"
      >
        <template #icon><ReloadOutlined aria-hidden="true" /></template>
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
              :disabled="clustersLoading"
              :loading="clustersLoading"
              allow-clear
              aria-label="选择集群"
              class="k8s-cluster-selector"
              placeholder="选择集群"
              @change="handleClusterChange"
              @popup-scroll="handleClusterDropdownScroll"
            >
              <template #suffixIcon>
                <DatabaseOutlined aria-hidden="true" />
              </template>
              <a-select-option
                v-for="cluster in clusters"
                :key="cluster.id"
                :value="cluster.id"
              >
                <div
                  style="
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                  "
                >
                  <span :title="cluster.name" class="k8s-cluster-name">{{
                    cluster.name
                  }}</span>
                  <a-tag color="blue" size="small">
                    {{ getEnvText(cluster.env) }}
                  </a-tag>
                </div>
              </a-select-option>
              <a-select-option
                v-if="clusters.length > 0 && clusters.length < clustersTotal"
                :value="'__load_more__'"
                disabled
                style="text-align: center; color: #999"
              >
                <a-spin :spinning="clustersLoading" size="small" />
                <span v-if="!clustersLoading">滚动加载更多...</span>
              </a-select-option>
            </a-select>

            <a-select
              v-model:value="filterTemplateId"
              :disabled="!filterClusterId"
              :loading="templatesLoading"
              allow-clear
              class="k8s-filter-select"
              placeholder="选择模板"
              @change="handleFilterChange"
            >
              <template #suffixIcon>
                <FileTextOutlined aria-hidden="true" />
              </template>
              <a-select-option
                v-for="template in templates"
                :key="template.id"
                :value="template.id"
              >
                {{ template.name }}
              </a-select-option>
              <a-select-option
                v-if="templates.length > 0 && templates.length < templatesTotal"
                :value="'__load_more_templates__'"
                disabled
                style="text-align: center; color: #999"
              >
                <a-button
                  :loading="templatesLoading"
                  size="small"
                  type="link"
                  @click.stop="loadMoreTemplates"
                >
                  加载更多...
                </a-button>
              </a-select-option>
            </a-select>

            <a-select
              v-model:value="filterStatus"
              allow-clear
              class="k8s-filter-select"
              placeholder="状态筛选"
              @change="handleFilterChange"
            >
              <template #suffixIcon>
                <FilterOutlined aria-hidden="true" />
              </template>
              <a-select-option :value="TaskStatus.PENDING">
                等待中
              </a-select-option>
              <a-select-option :value="TaskStatus.RUNNING">
                运行中
              </a-select-option>
              <a-select-option :value="TaskStatus.SUCCESS">
                成功
              </a-select-option>
              <a-select-option :value="TaskStatus.FAILED">失败</a-select-option>
              <a-select-option :value="TaskStatus.CANCELLED">
                已取消
              </a-select-option>
            </a-select>
          </div>

          <div class="k8s-search-group">
            <a-input
              v-model:value="searchText"
              allow-clear
              class="k8s-search-input"
              placeholder="🔍 搜索任务名称"
              @input="onSearch"
              @pressEnter="onSearch"
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
              :disabled="
                !filterStatus &&
                !searchText &&
                !filterClusterId &&
                !filterTemplateId
              "
              class="k8s-toolbar-btn"
              title="重置所有筛选条件"
              @click="resetFilters"
            >
              <template #icon><DeleteOutlined aria-hidden="true" /></template>
              重置筛选
            </a-button>

            <a-button
              type="primary"
              @click="() => batchOperation('执行')"
              :disabled="
                !selectedRows.length ||
                selectedRows.some((row) => row.status === TaskStatus.RUNNING)
              "
              v-if="can('k8s.task.batchApply') && selectedRows.length > 0"
              class="k8s-toolbar-btn"
              title="批量执行选中的任务"
            >
              <template #icon>
                <PlayCircleOutlined aria-hidden="true" />
              </template>
              执行 ({{ selectedRows.length }})
            </a-button>

            <a-button
              type="primary"
              danger
              @click="() => batchOperation('删除')"
              :disabled="!selectedRows.length"
              v-if="can('k8s.task.batchDelete') && selectedRows.length > 0"
              class="k8s-toolbar-btn"
              title="批量删除选中的任务"
            >
              <template #icon><DeleteOutlined aria-hidden="true" /></template>
              删除 ({{ selectedRows.length }})
            </a-button>
          </div>
        </div>
      </div>
    </template>
    <a-alert
      v-if="clustersError"
      :message="clustersError"
      show-icon
      type="error"
    >
      <template #action>
        <a-button size="small" @click="fetchClusters(true)">
          重试集群
        </a-button>
      </template>
    </a-alert>
    <a-alert
      v-if="templatesError"
      :message="templatesError"
      show-icon
      type="error"
    >
      <template #action>
        <a-button size="small" @click="fetchTemplates(true)">
          重试模板目录
        </a-button>
      </template>
    </a-alert>
    <a-alert v-if="loadError" :message="loadError" show-icon type="error">
      <template #action>
        <a-button size="small" @click="fetchTasks"> 重试查询 </a-button>
      </template>
    </a-alert>

    <!-- 数据展示区域 -->
    <div class="k8s-data-display">
      <a-table
        :columns="columns"
        :data-source="filteredTasks"
        :loading="loading"
        :pagination="{
          current: currentPage,
          pageSize: pageSize,
          total: total,
          showSizeChanger: true,
          showQuickJumper: true,
          showTotal: (total: number, range: number[]) =>
            `显示 ${range[0]}-${range[1]} 条，共 ${total} 条数据`,
          pageSizeOptions: ['10', '20', '30', '50'],
        }"
        :row-selection="rowSelection"
        :scroll="{ x: 1400 }"
        class="k8s-table task-table"
        row-key="id"
        @change="handleTableChange"
      >
        <template #bodyCell="{ column, text, record }">
          <template v-if="column.key === 'status'">
            <a-badge
              :status="getStatusColor(text)"
              :text="getStatusText(text)"
            />
          </template>
          <template v-else-if="column.key === 'template_id'">
            <a-tag v-if="text" color="blue">{{ getTemplateName(text) }}</a-tag>
            <span v-else class="k8s-no-data">-</span>
          </template>
          <template v-else-if="column.key === 'variables'">
            <div class="task-variables">
              <a-tag
                v-for="(variable, index) in (text || []).slice(0, 3)"
                :key="index"
                color="cyan"
                class="variable-tag"
              >
                {{ variable }}
              </a-tag>
              <a-tooltip
                v-if="(text || []).length > 3"
                :title="(text || []).join('\n')"
              >
                <a-tag class="variable-tag" color="cyan">
                  +{{ (text || []).length - 3 }} 更多
                </a-tag>
              </a-tooltip>
              <span
                v-if="!text || !Array.isArray(text) || text.length === 0"
                class="k8s-no-data"
                >-</span
              >
            </div>
          </template>
          <template v-else-if="column.key === 'apply_result'">
            <div class="apply-result-preview">
              <code v-if="text" class="result-preview">{{
                getResultPreview(text)
              }}</code>
              <span v-else class="k8s-no-data">-</span>
            </div>
          </template>
          <template v-else-if="column.key === 'created_at'">
            <div v-if="text" style="font-size: 12px; color: #666">
              <div>{{ formatDateTime(text) }}</div>
              <div style="color: #999; font-size: 11px; margin-top: 2px">
                {{ getRelativeTime(text) }}
              </div>
            </div>
            <span v-else class="k8s-no-data">-</span>
          </template>
          <template v-else-if="column.key === 'updated_at'">
            <div v-if="text" style="font-size: 12px; color: #666">
              <div>{{ formatDateTime(text) }}</div>
              <div style="color: #999; font-size: 11px; margin-top: 2px">
                {{ getRelativeTime(text) }}
              </div>
            </div>
            <span v-else class="k8s-no-data">-</span>
          </template>
          <template v-else-if="column.key === 'actions'">
            <div class="k8s-action-column">
              <a-tooltip title="查看详情">
                <a-button title="查看详情" @click="showTaskDetail(record)">
                  <template #icon><EyeOutlined aria-hidden="true" /></template>
                </a-button>
              </a-tooltip>
              <a-tooltip v-if="can('k8s.task.apply')" title="执行任务">
                <a-button
                  :disabled="record.status === TaskStatus.RUNNING"
                  title="执行任务"
                  @click="openExecuteModal(record)"
                >
                  <template #icon>
                    <PlayCircleOutlined aria-hidden="true" />
                  </template>
                </a-button>
              </a-tooltip>
              <a-tooltip title="编辑">
                <a-button
                  :disabled="record.status === TaskStatus.RUNNING"
                  title="编辑"
                  @click="openEditModal(record)"
                >
                  <template #icon><EditOutlined aria-hidden="true" /></template>
                </a-button>
              </a-tooltip>
              <a-tooltip v-if="can('k8s.task.delete')" title="删除">
                <a-button
                  :disabled="record.status === TaskStatus.RUNNING"
                  danger
                  title="删除"
                  @click="deleteTask(record)"
                >
                  <template #icon>
                    <DeleteOutlined aria-hidden="true" />
                  </template>
                </a-button>
              </a-tooltip>
            </div>
          </template>
        </template>

        <template #emptyText>
          <div class="k8s-empty-state">
            <PlayCircleOutlined aria-hidden="true" />
            <p>暂无任务数据</p>
            <p>请先选择集群和模板</p>
          </div>
        </template>
      </a-table>
    </div>

    <!-- 创建任务模态框 -->
    <a-modal
      v-model:open="isCreateModalVisible"
      :confirmLoading="submitLoading"
      :maskClosable="false"
      cancelText="取消"
      destroyOnClose
      okText="创建"
      title="创建 YAML 任务"
      width="700px"
      @cancel="closeCreateModal"
      @ok="submitCreateForm"
    >
      <a-form
        ref="formRef"
        :model="createFormModel"
        :rules="createFormRules"
        class="k8s-form"
        layout="vertical"
      >
        <a-form-item :required="true" label="任务名称" name="name">
          <a-input
            v-model:value="createFormModel.name"
            :maxlength="50"
            class="k8s-form-input"
            placeholder="请输入任务名称（例如：deploy-nginx-prod）"
          />
          <div style="color: #999; font-size: 12px; margin-top: 4px">
            支持中英文、数字、下划线和连字符，用于标识和查找任务
          </div>
        </a-form-item>

        <a-form-item :required="true" label="选择模板" name="template_id">
          <a-select
            v-model:value="createFormModel.template_id"
            :disabled="!filterClusterId"
            :loading="templatesLoading"
            class="k8s-form-input"
            placeholder="请选择 YAML 模板"
            @popup-scroll="handleTemplateDropdownScroll"
          >
            <a-select-option
              v-for="template in templates"
              :key="template.id"
              :value="template.id"
            >
              <div
                style="
                  display: flex;
                  align-items: center;
                  width: 100%;
                  gap: 8px;
                "
              >
                <span
                  style="
                    flex: 1;
                    overflow: hidden;
                    text-overflow: ellipsis;
                    white-space: nowrap;
                  "
                  >{{ template.name }}</span
                >
                <a-tag color="green" size="small" style="flex-shrink: 0">
                  ID: {{ template.id }}
                </a-tag>
              </div>
            </a-select-option>
            <a-select-option
              v-if="templates.length > 0 && templates.length < templatesTotal"
              :value="'__load_more_templates_create__'"
              disabled
              style="text-align: center; color: #999"
            >
              <a-button
                :loading="templatesLoading"
                size="small"
                type="link"
                @click.stop="loadMoreTemplates"
              >
                加载更多...
              </a-button>
            </a-select-option>
          </a-select>
        </a-form-item>

        <a-form-item label="任务变量（可选）">
          <div class="task-variables-config">
            <div
              v-if="createFormModel.variables.length === 0"
              style="text-align: center; color: #999; padding: 16px"
            >
              暂无变量，点击下方按钮添加
            </div>
            <div
              v-for="(_, index) in createFormModel.variables"
              :key="index"
              class="variable-input-row"
            >
              <a-input
                v-model:value="createFormModel.variables[index]"
                :maxlength="200"
                class="k8s-form-input"
                placeholder="输入变量值（例如：nginx:1.20）"
              />
              <a-button
                danger
                size="small"
                type="text"
                @click="removeVariableField(index)"
              >
                <template #icon><DeleteOutlined aria-hidden="true" /></template>
              </a-button>
            </div>
            <a-button
              style="margin-top: 8px; width: 100%"
              type="dashed"
              @click="addVariableField"
            >
              <template #icon><PlusOutlined aria-hidden="true" /></template>
              添加变量
            </a-button>
          </div>
        </a-form-item>
      </a-form>
    </a-modal>

    <!-- 编辑任务模态框 -->
    <a-modal
      v-model:open="isEditModalVisible"
      :confirmLoading="submitLoading"
      :maskClosable="false"
      cancelText="取消"
      destroyOnClose
      okText="保存"
      title="编辑 YAML 任务"
      width="700px"
      @cancel="closeEditModal"
      @ok="submitEditForm"
    >
      <a-form
        ref="editFormRef"
        :model="editFormModel"
        :rules="editFormRules"
        class="k8s-form"
        layout="vertical"
      >
        <a-form-item :required="true" label="任务名称" name="name">
          <a-input
            v-model:value="editFormModel.name"
            :maxlength="255"
            class="k8s-form-input"
            placeholder="请输入任务名称"
          />
        </a-form-item>

        <a-form-item label="选择模板">
          <a-select
            v-model:value="editFormModel.template_id"
            :disabled="!filterClusterId"
            :loading="templatesLoading"
            class="k8s-form-input"
            placeholder="请选择 YAML 模板"
          >
            <a-select-option
              v-for="template in templates"
              :key="template.id"
              :value="template.id"
            >
              <div
                style="
                  display: flex;
                  align-items: center;
                  width: 100%;
                  gap: 8px;
                "
              >
                <span
                  style="
                    flex: 1;
                    overflow: hidden;
                    text-overflow: ellipsis;
                    white-space: nowrap;
                  "
                  >{{ template.name }}</span
                >
                <a-tag color="green" size="small" style="flex-shrink: 0">
                  ID: {{ template.id }}
                </a-tag>
              </div>
            </a-select-option>
          </a-select>
        </a-form-item>

        <a-form-item label="任务变量">
          <div class="task-variables-config">
            <div
              v-if="editFormModel.variables.length === 0"
              style="text-align: center; color: #999; padding: 16px"
            >
              暂无变量，点击下方按钮添加
            </div>
            <div
              v-for="(_, index) in editFormModel.variables"
              :key="index"
              class="variable-input-row"
            >
              <a-input
                v-model:value="editFormModel.variables[index]"
                :maxlength="200"
                class="k8s-form-input"
                placeholder="输入变量值"
              />
              <a-button
                danger
                size="small"
                type="text"
                @click="removeEditVariableField(index)"
              >
                <template #icon><DeleteOutlined aria-hidden="true" /></template>
              </a-button>
            </div>
            <a-button
              style="margin-top: 8px; width: 100%"
              type="dashed"
              @click="addEditVariableField"
            >
              <template #icon><PlusOutlined aria-hidden="true" /></template>
              添加变量
            </a-button>
          </div>
        </a-form-item>
      </a-form>
    </a-modal>

    <!-- 执行任务模态框 -->
    <a-modal
      v-model:open="isExecuteModalVisible"
      :confirmLoading="executeLoading"
      :maskClosable="false"
      cancelText="取消"
      destroyOnClose
      okText="执行"
      title="执行任务"
      width="500px"
      @cancel="closeExecuteModal"
      @ok="submitExecuteForm"
    >
      <a-alert
        :description="`即将执行任务 '${currentOperationTask?.name}'，请确认执行选项`"
        message="任务执行"
        show-icon
        style="margin-bottom: 24px"
        type="info"
      />

      <a-form
        ref="executeFormRef"
        :model="executeFormModel"
        class="k8s-form"
        layout="vertical"
      >
        <a-form-item label="执行选项">
          <a-checkbox v-model:checked="executeFormModel.dry_run">
            预检查模式 (Dry Run)
          </a-checkbox>
          <div style="color: #999; font-size: 12px; margin-top: 4px">
            勾选后将仅进行预检查，不会实际应用到集群
          </div>
        </a-form-item>

        <a-form-item v-if="currentOperationTask" label="任务信息">
          <div class="task-info-display">
            <div class="info-item">
              <span class="info-label">任务名称:</span>
              <span class="info-value">{{ currentOperationTask.name }}</span>
            </div>
            <div class="info-item">
              <span class="info-label">使用模板:</span>
              <span class="info-value">{{
                getTemplateName(currentOperationTask.template_id)
              }}</span>
            </div>
            <div
              v-if="
                currentOperationTask.variables &&
                currentOperationTask.variables.length > 0
              "
              class="info-item"
            >
              <span class="info-label">变量列表:</span>
              <div class="info-variables">
                <a-tag
                  v-for="(variable, index) in currentOperationTask.variables"
                  :key="index"
                  color="cyan"
                >
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
      :footer="null"
      :maskClosable="false"
      destroyOnClose
      title="任务详情"
      width="900px"
      @cancel="closeDetailModal"
    >
      <div v-if="currentTaskDetail" class="k8s-detail-content">
        <a-row :gutter="[24, 16]">
          <a-col :lg="12" :xs="24">
            <a-card class="k8s-detail-card" size="small" title="基本信息">
              <div class="k8s-detail-item">
                <span class="k8s-detail-label">任务ID:</span>
                <span class="k8s-detail-value">{{ currentTaskDetail.id }}</span>
              </div>
              <div class="k8s-detail-item">
                <span class="k8s-detail-label">任务名称:</span>
                <span class="k8s-detail-value">{{
                  currentTaskDetail.name
                }}</span>
              </div>
              <div class="k8s-detail-item">
                <span class="k8s-detail-label">状态:</span>
                <a-badge
                  :status="getStatusColor(currentTaskDetail.status)"
                  :text="getStatusText(currentTaskDetail.status)"
                />
              </div>
              <div class="k8s-detail-item">
                <span class="k8s-detail-label">集群ID:</span>
                <span class="k8s-detail-value">{{
                  currentTaskDetail.cluster_id
                }}</span>
              </div>
              <div class="k8s-detail-item">
                <span class="k8s-detail-label">用户ID:</span>
                <span class="k8s-detail-value">{{
                  currentTaskDetail.user_id || '-'
                }}</span>
              </div>
            </a-card>
          </a-col>

          <a-col :lg="12" :xs="24">
            <a-card class="k8s-detail-card" size="small" title="执行信息">
              <div class="k8s-detail-item">
                <span class="k8s-detail-label">使用模板:</span>
                <span class="k8s-detail-value">{{
                  getTemplateName(currentTaskDetail.template_id)
                }}</span>
              </div>
              <div class="k8s-detail-item">
                <span class="k8s-detail-label">创建时间:</span>
                <span class="k8s-detail-value">{{
                  formatK8sTime(currentTaskDetail.created_at)
                }}</span>
              </div>
              <div class="k8s-detail-item">
                <span class="k8s-detail-label">更新时间:</span>
                <span class="k8s-detail-value">{{
                  formatK8sTime(currentTaskDetail.updated_at)
                }}</span>
              </div>
            </a-card>
          </a-col>
        </a-row>

        <a-row :gutter="[24, 16]" style="margin-top: 16px">
          <a-col :lg="12" :xs="24">
            <a-card class="k8s-detail-card" size="small" title="任务变量">
              <div class="task-variables">
                <a-tag
                  v-for="(variable, index) in currentTaskDetail.variables || []"
                  :key="index"
                  color="cyan"
                  style="margin-bottom: 8px"
                >
                  {{ variable }}
                </a-tag>
                <span
                  v-if="
                    !currentTaskDetail.variables ||
                    currentTaskDetail.variables.length === 0
                  "
                  class="k8s-no-data"
                >
                  暂无变量
                </span>
              </div>
            </a-card>
          </a-col>

          <a-col :lg="12" :xs="24">
            <a-card class="k8s-detail-card" size="small" title="执行结果">
              <pre
                v-if="currentTaskDetail.apply_result"
                class="apply-result-detail"
                >{{ currentTaskDetail.apply_result }}</pre
              >
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
  DatabaseOutlined,
  DeleteOutlined,
  EditOutlined,
  EyeOutlined,
  FileTextOutlined,
  FilterOutlined,
  PlayCircleOutlined,
  PlusOutlined,
  ReloadOutlined,
  SearchOutlined,
} from '@ant-design/icons-vue';

import { usePermission } from '#/utils/permission';

const { can } = usePermission();

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
  }
};

const handleTableChange = (pagination: {
  current?: number;
  pageSize?: number;
}) => {
  if (pagination) {
    handlePageChange(
      pagination.current || currentPage.value,
      pagination.pageSize,
    );
  }
};

// 处理集群下拉选择的滚动事件
const handleClusterDropdownScroll = (e: Event) => {
  const { target } = e;
  if (
    target &&
    'scrollTop' in target &&
    'scrollHeight' in target &&
    'clientHeight' in target
  ) {
    const scrollTarget = target as HTMLElement;
    if (
      scrollTarget.scrollTop + scrollTarget.clientHeight >=
      scrollTarget.scrollHeight - 5
    ) {
      loadMoreClusters();
    }
  }
};

// 处理模板下拉选择的滚动事件
const handleTemplateDropdownScroll = (e: Event) => {
  const { target } = e;
  if (
    target &&
    'scrollTop' in target &&
    'scrollHeight' in target &&
    'clientHeight' in target
  ) {
    const scrollTarget = target as HTMLElement;
    if (
      scrollTarget.scrollTop + scrollTarget.clientHeight >=
      scrollTarget.scrollHeight - 5
    ) {
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
  {
    title: '名称',
    dataIndex: 'name',
    key: 'name',
    width: 150,
    ellipsis: true,
    fixed: 'left',
  },
  {
    title: '状态',
    dataIndex: 'status',
    key: 'status',
    width: 90,
    align: 'center',
  },
  {
    title: '使用模板',
    dataIndex: 'template_id',
    key: 'template_id',
    width: 150,
  },
  { title: '变量', dataIndex: 'variables', key: 'variables', width: 150 },
  {
    title: '执行结果',
    dataIndex: 'apply_result',
    key: 'apply_result',
    width: 200,
  },
  { title: '创建时间', dataIndex: 'created_at', key: 'created_at', width: 160 },
  { title: '更新时间', dataIndex: 'updated_at', key: 'updated_at', width: 160 },
  {
    title: '操作',
    key: 'actions',
    width: 200,
    fixed: 'right',
    align: 'center',
  },
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
