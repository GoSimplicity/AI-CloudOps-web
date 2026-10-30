<template>
  <OpsPage title="YAML 模板管理" description="管理和维护 Kubernetes YAML 配置模板">
    <template #actions>
            <a-button type="primary" @click="openCreateModal" :disabled="!filterClusterId">
              <template #icon><PlusOutlined aria-hidden="true"  /></template>
              创建模板
            </a-button>
            <a-button @click="fetchTemplates" :loading="loading" :disabled="!filterClusterId">
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
        </div>

        <div class="k8s-search-group">
          <a-input
            v-model:value="searchText"
            placeholder="🔍 搜索模板名称"
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
            :disabled="!searchText && !filterClusterId"
            class="k8s-toolbar-btn"
            title="重置所有筛选条件"
          >
            <template #icon><DeleteOutlined aria-hidden="true"  /></template>
            重置筛选
          </a-button>


          <a-button
            type="primary"
            danger
            @click="() => batchOperation('删除')"
            :disabled="!selectedRows.length"
            v-if="can('k8s.template.batchDelete') && (selectedRows.length > 0)"
            class="k8s-toolbar-btn"
            title="批量删除选中的模板"
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
    <a-alert v-if="loadError" type="error" :message="loadError" show-icon>
      <template #action><a-button size="small" @click="fetchTemplates">重试查询</a-button></template>
    </a-alert>

    <!-- 数据展示区域 -->
    <div class="k8s-data-display">
      <a-table
        :columns="columns"
        :data-source="filteredTemplates"
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
        class="k8s-table template-table"
        :scroll="{ x: 1200 }"
      >
        <template #bodyCell="{ column, record, text }">
          <template v-if="column.key === 'cluster_id'">
            <a-tag color="blue">{{ getClusterName(record.cluster_id) }}</a-tag>
          </template>
          <template v-else-if="column.key === 'user_id'">
            <a-tag color="green">{{ getUserDisplay(record.user_id, record.username) }}</a-tag>
          </template>
          <template v-else-if="column.key === 'actions'">
            <div class="k8s-action-column">
              <a-tooltip title="查看详情">
                <a-button title="查看详情" @click="showTemplateDetail(record)">
                  <template #icon><EyeOutlined aria-hidden="true"  /></template>
                </a-button>
              </a-tooltip>
              <a-tooltip title="查看 YAML">
                <a-button title="查看 YAML" @click="showYamlModal(record)">
                  <template #icon><FileTextOutlined aria-hidden="true"  /></template>
                </a-button>
              </a-tooltip>
              <a-tooltip title="检查模板">
                <a-button title="检查模板" @click="checkTemplate(record.content)" :loading="checkLoading">
                  <template #icon><CheckCircleOutlined aria-hidden="true"  /></template>
                </a-button>
              </a-tooltip>
              <a-tooltip title="编辑">
                <a-button title="编辑" @click="openEditModal(record)">
                  <template #icon><EditOutlined aria-hidden="true"  /></template>
                </a-button>
              </a-tooltip>
              <a-tooltip v-if="can('k8s.template.delete')" title="删除">
                <a-button
                  title="删除"
                  danger
                  @click="deleteTemplate(record)"
                >
                  <template #icon><DeleteOutlined aria-hidden="true"  /></template>
                </a-button>
              </a-tooltip>
            </div>
          </template>
          <template v-else-if="column.key === 'content'">
            <div class="yaml-content-preview">
              <code class="yaml-preview">{{ getYamlPreview(text) }}</code>
            </div>
          </template>
          <template v-else-if="column.key === 'created_at'">
            <div v-if="text" style="font-size: 13px; color: #595959;">
              <div>{{ formatDateTime(text) }}</div>
              <div style="color: #8c8c8c; font-size: 12px; margin-top: 2px;">{{ getRelativeTime(text) }}</div>
            </div>
            <span v-else style="color: #bfbfbf;">-</span>
          </template>
          <template v-else-if="column.key === 'updated_at'">
            <div v-if="text" style="font-size: 13px; color: #595959;">
              <div>{{ formatDateTime(text) }}</div>
              <div style="color: #8c8c8c; font-size: 12px; margin-top: 2px;">{{ getRelativeTime(text) }}</div>
            </div>
            <span v-else style="color: #bfbfbf;">-</span>
          </template>
        </template>

        <template #emptyText>
          <a-empty description="暂无模板数据，请先选择集群" />
        </template>
      </a-table>
    </div>

    <!-- 创建模板模态框 -->
    <a-modal
      v-model:open="isCreateModalVisible"
      title="创建 YAML 模板"
      @ok="submitCreateForm"
      @cancel="closeCreateModal"
      :confirmLoading="submitLoading"
      width="900px"
      :maskClosable="false"
      destroyOnClose
      okText="创建"
      cancelText="取消"
      centered
    >
      <a-form
        ref="formRef"
        :model="createFormModel"
        layout="vertical"
        class="k8s-form"
        :rules="createFormRules"
      >
        <a-form-item label="模板名称" name="name" :required="true">
          <a-input
            v-model:value="createFormModel.name"
            placeholder="请输入模板名称（例如：nginx-deployment-template）"
            class="k8s-form-input"
            :maxlength="50"
          />
          <div style="color: #999; font-size: 12px; margin-top: 4px;">
            支持中英文、数字、下划线和连字符，用于标识和查找模板
          </div>
        </a-form-item>

        <a-form-item label="YAML 内容" name="content" :required="true">
          <div class="yaml-toolbar">
            <a-button class="yaml-toolbar-btn yaml-btn-template" @click="insertYamlTemplate">
              <template #icon><FileAddOutlined aria-hidden="true"  /></template>
              插入模板
            </a-button>
            <a-button class="yaml-toolbar-btn yaml-btn-format" @click="formatYaml">
              <template #icon><FormatPainterOutlined aria-hidden="true"  /></template>
              格式化
            </a-button>
            <a-button class="yaml-toolbar-btn yaml-btn-validate" @click="validateYaml">
              <template #icon><CheckCircleOutlined aria-hidden="true"  /></template>
              检查格式
            </a-button>
            <a-button class="yaml-toolbar-btn yaml-btn-clear" @click="clearYaml">
              <template #icon><ClearOutlined aria-hidden="true"  /></template>
              清空
            </a-button>
          </div>
          <a-textarea
            v-model:value="createFormModel.content"
            placeholder="请输入 Kubernetes YAML 配置内容，或点击上方【插入模板】按钮使用默认模板"
            :rows="16"
            class="k8s-config-textarea"
            show-count
            :maxlength="50000"
          />
        </a-form-item>
      </a-form>
    </a-modal>

    <!-- 编辑模板模态框 -->
    <a-modal
      v-model:open="isEditModalVisible"
      title="编辑 YAML 模板"
      @ok="submitEditForm"
      @cancel="closeEditModal"
      :confirmLoading="submitLoading"
      width="900px"
      :maskClosable="false"
      destroyOnClose
      okText="保存"
      cancelText="取消"
      centered
    >
      <a-form
        ref="editFormRef"
        :model="editFormModel"
        layout="vertical"
        class="k8s-form"
        :rules="editFormRules"
      >
        <a-form-item label="模板名称" name="name" :required="true">
          <a-input
            v-model:value="editFormModel.name"
            placeholder="请输入模板名称"
            class="k8s-form-input"
            :maxlength="50"
          />
        </a-form-item>

        <a-form-item label="YAML 内容" name="content" :required="true">
          <div class="yaml-toolbar">
            <a-button class="yaml-toolbar-btn yaml-btn-format" @click="formatEditYaml">
              <template #icon><FormatPainterOutlined aria-hidden="true"  /></template>
              格式化
            </a-button>
            <a-button class="yaml-toolbar-btn yaml-btn-validate" @click="validateEditYaml">
              <template #icon><CheckCircleOutlined aria-hidden="true"  /></template>
              检查格式
            </a-button>
          </div>
          <a-textarea
            v-model:value="editFormModel.content"
            placeholder="请输入 Kubernetes YAML 配置内容"
            :rows="16"
            class="k8s-config-textarea"
            show-count
            :maxlength="50000"
          />
        </a-form-item>
      </a-form>
    </a-modal>

    <!-- 详情模态框 -->
    <a-modal
      v-model:open="isDetailModalVisible"
      title="模板详情"
      :footer="null"
      @cancel="closeDetailModal"
      width="900px"
      destroyOnClose
      centered
    >
      <a-spin :spinning="detailLoading">
        <div v-if="currentTemplateDetail" class="k8s-detail-content">
          <a-row :gutter="[24, 16]">
            <a-col :xs="24" :lg="12">
              <a-card title="基本信息" class="k8s-detail-card" size="small">
                <div class="k8s-detail-item">
                  <span class="k8s-detail-label">模板ID:</span>
                  <span class="k8s-detail-value">{{ currentTemplateDetail.id }}</span>
                </div>
                <div class="k8s-detail-item">
                  <span class="k8s-detail-label">模板名称:</span>
                  <span class="k8s-detail-value">{{ currentTemplateDetail.name }}</span>
                </div>
                <div class="k8s-detail-item">
                  <span class="k8s-detail-label">所属集群:</span>
                  <span class="k8s-detail-value">
                    <a-tag color="blue">{{ getClusterName(currentTemplateDetail.cluster_id) }}</a-tag>
                  </span>
                </div>
                <div class="k8s-detail-item">
                  <span class="k8s-detail-label">创建用户:</span>
                  <span class="k8s-detail-value">
                    <a-tag color="green">{{ getUserDisplay(currentTemplateDetail.user_id, currentTemplateDetail.username) }}</a-tag>
                  </span>
                </div>
              </a-card>
            </a-col>

            <a-col :xs="24" :lg="12">
              <a-card title="时间信息" class="k8s-detail-card" size="small">
                <div class="k8s-detail-item">
                  <span class="k8s-detail-label">创建时间:</span>
                  <span class="k8s-detail-value">{{ formatK8sTime(currentTemplateDetail.created_at) }}</span>
                </div>
                <div class="k8s-detail-item">
                  <span class="k8s-detail-label">更新时间:</span>
                  <span class="k8s-detail-value">{{ formatK8sTime(currentTemplateDetail.updated_at) }}</span>
                </div>
              </a-card>
            </a-col>
          </a-row>

          <a-row :gutter="[24, 16]" style="margin-top: 16px;">
            <a-col :span="24">
              <a-card title="YAML 内容" class="k8s-detail-card" size="small">
                <pre class="yaml-content-detail">{{ currentTemplateDetail.content || '暂无内容' }}</pre>
              </a-card>
            </a-col>
          </a-row>
        </div>
      </a-spin>
    </a-modal>

    <!-- YAML 查看模态框 -->
    <a-modal
      v-model:open="isYamlModalVisible"
      :title="`查看模板: ${currentOperationTemplate?.name}`"
      :footer="null"
      @cancel="closeYamlModal"
      width="900px"
      :maskClosable="false"
      destroyOnClose
    >
      <div class="yaml-view-modal">
        <div class="yaml-actions" style="margin-bottom: 16px;">
          <a-space>
            <a-button
              type="primary"
              @click="() => checkTemplate(yamlFormModel.content)"
              :loading="checkLoading"
              :disabled="!yamlFormModel.content"
            >
              <template #icon><CheckCircleOutlined aria-hidden="true"  /></template>
              检查格式
            </a-button>
            <a-button @click="copyYamlContent">
              <template #icon><CopyOutlined aria-hidden="true"  /></template>
              复制内容
            </a-button>
          </a-space>
        </div>
        <a-textarea
          v-model:value="yamlFormModel.content"
          :rows="20"
          class="k8s-config-textarea"
          readonly
        />
      </div>
    </a-modal>

  </OpsPage>
</template>

<script lang="ts" setup>
import OpsPage from '#/components/ops/OpsPage.vue';
import { onMounted } from 'vue';
import { message } from 'ant-design-vue';
import { useTemplatePage } from './Template';
import { formatDateTime, getRelativeTime } from '../shared/utils';
import {
  PlusOutlined,
  ReloadOutlined,
  DeleteOutlined,
  FileTextOutlined,
  EyeOutlined,
  SearchOutlined,
  EditOutlined,
  CheckCircleOutlined,
  DatabaseOutlined,
  CopyOutlined,
  FileAddOutlined,
  FormatPainterOutlined,
  ClearOutlined,
} from '@ant-design/icons-vue';

import { usePermission } from '#/utils/permission';

const { can } = usePermission();

const {
  // state
  clusters,
  loading,
  loadError,
  clustersError,
  clustersLoading,
  searchText,
  filterClusterId,
  selectedRows,
  currentPage,
  pageSize,
  total,
  clustersTotal,

  // modal state
  isCreateModalVisible,
  isEditModalVisible,
  isDetailModalVisible,
  isYamlModalVisible,
  submitLoading,
  detailLoading,
  checkLoading,

  // operation targets
  currentOperationTemplate,
  currentTemplateDetail,

  // form models
  createFormModel,
  editFormModel,
  yamlFormModel,

  // form refs
  formRef,
  editFormRef,

  // form rules
  createFormRules,
  editFormRules,

  // computed
  filteredTemplates,
  rowSelection,

  // helpers
  getEnvText,
  getClusterName,
  getUserDisplay,
  formatK8sTime,

  // operations
  fetchClusters,
  fetchTemplates,
  clearTemplates,
  loadMoreClusters,

  // detail operations
  showTemplateDetail,
  closeDetailModal,

  // YAML operations
  showYamlModal,
  closeYamlModal,

  // create operations
  openCreateModal,
  closeCreateModal,
  submitCreateForm,

  // edit operations
  openEditModal,
  closeEditModal,
  submitEditForm,

  // template operations
  deleteTemplate,
  checkTemplate,

  // batch operations
  batchOperation,

  // pagination operations
  handlePageChange,

  // YAML operations
  insertYamlTemplate,
  formatYaml,
  validateYaml,
  clearYaml,
  formatEditYaml,
  validateEditYaml,
} = useTemplatePage();

const onSearch = () => {
  currentPage.value = 1;
  fetchTemplates();
};

const handleClusterChange = () => {
  currentPage.value = 1;
  clearTemplates();

  if (filterClusterId.value) {
    fetchTemplates();
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

// 获取 YAML 预览内容
const getYamlPreview = (content: string) => {
  if (!content) return '暂无内容';
  const lines = content.split('\n');
  if (lines.length <= 3) return content;
  return lines.slice(0, 3).join('\n') + '\n...';
};

// 复制 YAML 内容
const copyYamlContent = () => {
  if (!yamlFormModel.value.content) {
    message.warning('暂无内容可复制');
    return;
  }

  navigator.clipboard.writeText(yamlFormModel.value.content).then(() => {
    message.success('YAML 内容已复制到剪贴板');
  }).catch(() => {
    message.error('复制失败，请手动选择复制');
  });
};

const columns = [
  { title: 'ID', dataIndex: 'id', key: 'id', width: 80 },
  { title: '名称', dataIndex: 'name', key: 'name', width: 150, ellipsis: true, fixed: 'left' },
  { title: '所属集群', dataIndex: 'cluster_id', key: 'cluster_id', width: 130 },
  { title: '创建用户', dataIndex: 'user_id', key: 'user_id', width: 120 },
  { title: 'YAML 内容', dataIndex: 'content', key: 'content', width: 250 },
  { title: '创建时间', dataIndex: 'created_at', key: 'created_at', width: 160 },
  { title: '更新时间', dataIndex: 'updated_at', key: 'updated_at', width: 160 },
  { title: '操作', key: 'actions', width: 200, fixed: 'right', align: 'center' },
];

// 重置所有筛选条件
const resetFilters = () => {
  searchText.value = '';
  filterClusterId.value = undefined;
  currentPage.value = 1;
  clearTemplates();
};

onMounted(async () => {
  await fetchClusters();
});
</script>

<style scoped>
@import '../shared/k8s-common.css';
</style>

<style scoped src="./Template.css"></style>
