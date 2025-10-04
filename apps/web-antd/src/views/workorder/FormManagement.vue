<template>
  <div class="form-management-container">
    <div class="page-header">
      <div class="header-actions">
        <a-button type="primary" @click="handleCreateForm" class="btn-create">
          <template #icon>
            <PlusOutlined />
          </template>
          <span class="btn-text">创建新表单</span>
        </a-button>
        <div class="search-filters">
          <a-input-search 
            v-model:value="searchQuery" 
            placeholder="搜索表单..." 
            class="search-input" 
            @search="handleSearch"
            @change="handleSearchChange" 
            allow-clear 
          />
          <a-select 
            v-model:value="categoryFilter" 
            placeholder="选择分类" 
            class="category-filter"
            @change="handleCategoryChange" 
            allow-clear
          >
            <a-select-option :value="undefined">全部分类</a-select-option>
            <a-select-option v-for="category in categories" :key="category.id" :value="category.id">
              {{ category.name }}
            </a-select-option>
          </a-select>
          <a-select 
            v-model:value="statusFilter" 
            placeholder="状态" 
            class="status-filter" 
            @change="handleStatusChange"
            allow-clear
          >
            <a-select-option :value="undefined">全部状态</a-select-option>
            <a-select-option :value="1">草稿</a-select-option>
            <a-select-option :value="2">已发布</a-select-option>
            <a-select-option :value="3">已归档</a-select-option>
          </a-select>
          <a-select 
            v-model:value="templateFilter" 
            placeholder="模板类型" 
            class="template-filter" 
            @change="handleTemplateChange"
            allow-clear
          >
            <a-select-option :value="undefined">全部类型</a-select-option>
            <a-select-option :value="1">模板</a-select-option>
            <a-select-option :value="2">非模板</a-select-option>
          </a-select>
          <a-button @click="handleResetFilters" class="reset-btn">
            重置
          </a-button>
        </div>
      </div>
    </div>

    <div class="stats-row">
      <a-row :gutter="[16, 16]">
        <a-col :xs="12" :sm="12" :md="6" :lg="6">
          <a-card class="stats-card">
            <a-statistic title="总表单数" :value="stats.total" :value-style="{ color: '#3f8600' }">
              <template #prefix>
                <FormOutlined />
              </template>
            </a-statistic>
          </a-card>
        </a-col>
        <a-col :xs="12" :sm="12" :md="6" :lg="6">
          <a-card class="stats-card">
            <a-statistic title="已发布" :value="stats.published" :value-style="{ color: '#52c41a' }">
              <template #prefix>
                <CheckCircleOutlined />
              </template>
            </a-statistic>
          </a-card>
        </a-col>
        <a-col :xs="12" :sm="12" :md="6" :lg="6">
          <a-card class="stats-card">
            <a-statistic title="草稿" :value="stats.draft" :value-style="{ color: '#faad14' }">
              <template #prefix>
                <EditOutlined />
              </template>
            </a-statistic>
          </a-card>
        </a-col>
        <a-col :xs="12" :sm="12" :md="6" :lg="6">
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
          :data-source="formDesigns" 
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
              <div class="form-name-cell">
                <div class="form-badge" :class="getStatusClass(record.status)"></div>
                <span class="form-name-text">{{ record.name }}</span>
                <a-tag v-if="record.is_template === 1" color="purple" size="small">模板</a-tag>
              </div>
            </template>

            <template v-if="column.key === 'category'">
              <a-tag v-if="record.category?.name" color="blue">
                {{ record.category.name }}
              </a-tag>
              <span v-else class="text-gray">未分类</span>
            </template>

            <template v-if="column.key === 'description'">
              <a-tooltip :title="record.description" placement="topLeft">
                <span class="description-text">{{ record.description || '无描述' }}</span>
              </a-tooltip>
            </template>

            <template v-if="column.key === 'status'">
              <a-tag :color="getStatusColor(record.status)">
                {{ getStatusText(record.status) }}
              </a-tag>
            </template>

            <template v-if="column.key === 'operator'">
              <div class="operator-info">
                <a-avatar 
                  size="small" 
                  :style="{ backgroundColor: getAvatarColor(record.operator_name || '') }"
                >
                  {{ getInitials(record.operator_name) }}
                </a-avatar>
                <span class="operator-name">{{ record.operator_name || '系统' }}</span>
              </div>
            </template>

            <template v-if="column.key === 'tags'">
              <div class="tags-cell">
                <a-tag 
                  v-for="tag in (record.tags || []).slice(0, 2)" 
                  :key="tag" 
                  size="small"
                >
                  {{ tag }}
                </a-tag>
                <a-popover 
                  v-if="(record.tags || []).length > 2" 
                  placement="topLeft"
                  trigger="hover"
                >
                  <template #content>
                    <div class="tags-popover">
                      <a-tag 
                        v-for="tag in record.tags" 
                        :key="tag" 
                        size="small"
                        style="margin-bottom: 4px;"
                      >
                        {{ tag }}
                      </a-tag>
                    </div>
                  </template>
                  <a-tag size="small" color="default">+{{ (record.tags || []).length - 2 }}</a-tag>
                </a-popover>
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
                <a-button type="primary" size="small" @click="handleViewForm(record)">
                  查看
                </a-button>
                <a-button type="default" size="small" @click="handleEditForm(record)">
                  编辑
                </a-button>
                <a-dropdown>
                  <template #overlay>
                    <a-menu @click="(e: any) => handleMenuClick(e.key, record)">
                      <a-menu-item key="preview">
                        <EyeOutlined /> 预览
                      </a-menu-item>
                      <a-menu-divider />
                      <a-menu-item key="publish" v-if="record.status === 1">发布</a-menu-item>
                      <a-menu-item key="archive" v-if="record.status === 2">归档</a-menu-item>
                      <a-menu-item key="unarchive" v-if="record.status === 3">取消归档</a-menu-item>
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

    <!-- 表单创建/编辑对话框 -->
    <a-modal 
      :open="formDialogVisible" 
      :title="formDialog.isEdit ? '编辑表单' : '创建表单'" 
      :width="formDialogWidth"
      @ok="saveForm" 
      @cancel="closeFormDialog" 
      :destroy-on-close="true" 
      class="responsive-modal form-design-modal"
    >
      <a-form ref="formRef" :model="formDialog.form" :rules="formRules" layout="vertical">
        <a-form-item label="表单名称" name="name">
          <a-input v-model:value="formDialog.form.name" placeholder="请输入表单名称" />
        </a-form-item>

        <a-form-item label="描述" name="description">
          <a-textarea v-model:value="formDialog.form.description" :rows="3" placeholder="请输入表单描述" />
        </a-form-item>

        <!-- 分类选择器 - 使用真分页 -->
        <a-form-item label="分类" name="category_id">
          <a-select 
            v-model:value="formDialog.form.category_id" 
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
              <div v-if="categorySelectorLoading" class="category-loading">
                <a-spin size="small" />
                <span style="margin-left: 8px;">加载中...</span>
              </div>
              <div v-else class="category-empty">
                {{ categorySearchKeyword ? '无搜索结果' : '暂无分类数据' }}
              </div>
            </template>

            <a-select-option v-for="cat in formDialogCategories" :key="cat.id" :value="cat.id">
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
                <a-button 
                  type="link" 
                  size="small" 
                  :loading="categorySelectorLoading"
                  style="padding: 0; height: auto; font-size: 12px;"
                >
                  <template v-if="!categorySelectorLoading">
                    <Icon icon="material-symbols:keyboard-arrow-down" style="margin-right: 4px;" />
                    加载更多 ({{ categoryPagination.current }}/{{ totalPages }})
                  </template>
                  <template v-else>
                    正在加载...
                  </template>
                </a-button>
              </div>
            </a-select-option>
          </a-select>
        </a-form-item>

        <a-form-item label="标签" name="tags">
          <a-select
            v-model:value="formDialog.form.tags"
            mode="tags"
            placeholder="请输入标签，按回车添加"
            style="width: 100%"
            :max-tag-count="5"
            :max-tag-text-length="10"
          >
          </a-select>
        </a-form-item>

        <a-form-item label="是否为模板" name="is_template">
          <a-radio-group v-model:value="formDialog.form.is_template">
            <a-radio :value="2">否</a-radio>
            <a-radio :value="1">是</a-radio>
          </a-radio-group>
        </a-form-item>

        <a-form-item label="状态" name="status" v-if="formDialog.isEdit">
          <a-select v-model:value="formDialog.form.status" placeholder="请选择状态" style="width: 100%">
            <a-select-option :value="1">草稿</a-select-option>
            <a-select-option :value="2">已发布</a-select-option>
            <a-select-option :value="3">已归档</a-select-option>
          </a-select>
        </a-form-item>

        <a-form-item label="表单字段设计" name="fields">
          <div class="form-fields-section">
            <div class="section-header">
              <h4>字段配置 (JSON格式)</h4>
              <div class="header-actions">
                <a-button size="small" @click="formatFieldsJson" :disabled="!formDialog.form.fieldsJson">
                  格式化
                </a-button>
                <a-button size="small" @click="validateFieldsJson" :disabled="!formDialog.form.fieldsJson">
                  验证
                </a-button>
                <a-button size="small" @click="showFieldsExample">
                  示例
                </a-button>
              </div>
            </div>

            <a-textarea 
              v-model:value="formDialog.form.fieldsJson" 
              placeholder="请输入表单字段JSON配置..." 
              :rows="12"
              class="json-editor" 
              :class="{ 'json-error': jsonValidationError }" 
            />

            <div v-if="jsonValidationError" class="json-error-message">
              <a-alert 
                type="error" 
                :message="jsonValidationError" 
                show-icon 
                closable
                @close="jsonValidationError = ''" 
              />
            </div>

            <div class="json-help">
              <a-alert type="info" message="字段配置说明" :description="fieldsHelpText" show-icon />
            </div>
          </div>
        </a-form-item>

        <a-alert 
          v-if="!formDialog.isEdit" 
          message="提示" 
          description="您可以现在设计表单字段，也可以创建后再进行设计。" 
          type="info" 
          show-icon
          style="margin-bottom: 16px;" 
        />
      </a-form>
    </a-modal>

    <!-- 字段示例对话框 -->
    <a-modal 
      :open="exampleDialogVisible" 
      title="表单字段JSON示例" 
      :width="800" 
      :footer="null" 
      @cancel="closeExampleDialog"
      class="example-dialog"
    >
      <div class="example-content">
        <a-tabs>
          <a-tab-pane key="simple" tab="简单示例">
            <pre class="json-example">{{ simpleFieldsExample }}</pre>
            <a-button @click="copyExample(simpleFieldsExample)" size="small">复制到编辑器</a-button>
          </a-tab-pane>
          <a-tab-pane key="complex" tab="复杂示例">
            <pre class="json-example">{{ complexFieldsExample }}</pre>
            <a-button @click="copyExample(complexFieldsExample)" size="small">复制到编辑器</a-button>
          </a-tab-pane>
          <a-tab-pane key="all-types" tab="所有字段类型">
            <pre class="json-example">{{ allTypesFieldsExample }}</pre>
            <a-button @click="copyExample(allTypesFieldsExample)" size="small">复制到编辑器</a-button>
          </a-tab-pane>
        </a-tabs>
      </div>
    </a-modal>

    <!-- 预览对话框 -->
    <a-modal 
      :open="previewDialogVisible" 
      title="表单预览" 
      :width="previewDialogWidth" 
      :footer="null"
      @cancel="closePreviewDialog" 
      class="preview-dialog"
    >
      <div v-if="previewDialog.form" class="form-preview-wrapper">
        <a-spin :spinning="previewLoading">
          <div class="preview-header">
            <h3>{{ previewDialog.form.name }}</h3>
            <p v-if="previewDialog.form.description" class="preview-description">
              {{ previewDialog.form.description }}
            </p>
            <div class="preview-mode-notice">
              <a-alert message="预览模式" description="您可以查看和选择表单字段，但无法提交表单。" type="info" show-icon banner />
            </div>
          </div>

          <div class="preview-form">
            <a-form :model="previewFormData" layout="vertical" class="dynamic-form">
              <template v-for="field in previewDialog.form.schema.fields" :key="field.name">
                <a-form-item :label="field.label" :name="field.name" :required="field.required" class="form-field">
                  <!-- 文本输入框 -->
                  <a-input 
                    v-if="field.type === FormFieldType.Text" 
                    v-model:value="previewFormData[field.name]"
                    :placeholder="field.placeholder" 
                    class="preview-input" 
                  />

                  <!-- 数字输入框 -->
                  <a-input-number 
                    v-else-if="field.type === FormFieldType.Number" 
                    v-model:value="previewFormData[field.name]"
                    :placeholder="field.placeholder" 
                    style="width: 100%" 
                    class="preview-input" 
                  />

                  <!-- 密码输入框 -->
                  <a-input-password 
                    v-else-if="field.type === FormFieldType.Password" 
                    v-model:value="previewFormData[field.name]"
                    :placeholder="field.placeholder" 
                    class="preview-input" 
                  />

                  <!-- 多行文本 -->
                  <a-textarea 
                    v-else-if="field.type === FormFieldType.Textarea" 
                    v-model:value="previewFormData[field.name]"
                    :placeholder="field.placeholder" 
                    :rows="4" 
                    class="preview-input" 
                  />

                  <!-- 日期选择器 -->
                  <a-date-picker 
                    v-else-if="field.type === FormFieldType.Date" 
                    v-model:value="previewFormData[field.name]"
                    :placeholder="field.placeholder" 
                    style="width: 100%" 
                    class="preview-input" 
                  />

                  <!-- 下拉选择 -->
                  <a-select 
                    v-else-if="field.type === FormFieldType.Select" 
                    v-model:value="previewFormData[field.name]"
                    :placeholder="field.placeholder || '请选择'" 
                    style="width: 100%" 
                    class="preview-input"
                  >
                    <a-select-option v-for="option in field.options" :key="option" :value="option">
                      {{ option }}
                    </a-select-option>
                  </a-select>

                  <!-- 单选框组 -->
                  <a-radio-group 
                    v-else-if="field.type === FormFieldType.Radio" 
                    v-model:value="previewFormData[field.name]"
                    class="preview-radio-group"
                  >
                    <div class="radio-options">
                      <a-radio v-for="option in field.options" :key="option" :value="option" class="preview-radio">
                        {{ option }}
                      </a-radio>
                    </div>
                  </a-radio-group>

                  <!-- 复选框组 -->
                  <a-checkbox-group 
                    v-else-if="field.type === FormFieldType.Checkbox" 
                    v-model:value="previewFormData[field.name]"
                    class="preview-checkbox-group"
                  >
                    <div class="checkbox-options">
                      <a-checkbox v-for="option in field.options" :key="option" :value="option" class="preview-checkbox">
                        {{ option }}
                      </a-checkbox>
                    </div>
                  </a-checkbox-group>

                  <!-- 开关 -->
                  <a-switch 
                    v-else-if="field.type === FormFieldType.Switch" 
                    v-model:checked="previewFormData[field.name]"
                  />
                </a-form-item>
              </template>

              <div class="preview-form-actions">
                <a-tooltip title="预览模式下无法提交表单">
                  <a-button type="primary" disabled size="large">
                    提交表单 (预览模式)
                  </a-button>
                </a-tooltip>
                <a-button @click="resetPreviewForm" size="large" style="margin-left: 12px;">
                  重置表单
                </a-button>
              </div>
            </a-form>
          </div>
        </a-spin>
      </div>
    </a-modal>

    <!-- 详情对话框 -->
    <a-modal 
      :open="detailDialogVisible" 
      title="表单详情" 
      :width="previewDialogWidth" 
      :footer="null"
      @cancel="closeDetailDialog" 
      class="detail-dialog"
    >
      <div v-if="detailDialog.form" class="form-details">
        <div class="detail-header">
          <h2>{{ detailDialog.form.name }}</h2>
          <div class="detail-tags">
            <a-tag :color="getStatusColor(detailDialog.form.status)">
              {{ getStatusText(detailDialog.form.status) }}
            </a-tag>
            <a-tag v-if="detailDialog.form.is_template === 1" color="purple">模板</a-tag>
          </div>
        </div>

        <a-descriptions bordered :column="1" :labelStyle="{ width: '120px' }">
          <a-descriptions-item label="ID">{{ detailDialog.form.id }}</a-descriptions-item>
          <a-descriptions-item label="分类">
            <a-tag v-if="detailDialog.form.category" color="blue">
              {{ detailDialog.form.category.name }}
            </a-tag>
            <span v-else class="text-gray">未分类</span>
          </a-descriptions-item>
          <a-descriptions-item label="操作人">{{ detailDialog.form.operator_name || '系统' }}</a-descriptions-item>
          <a-descriptions-item label="创建时间">{{ formatFullDateTime(detailDialog.form.created_at || '') }}</a-descriptions-item>
          <a-descriptions-item label="更新时间">{{ formatFullDateTime(detailDialog.form.updated_at || '') }}</a-descriptions-item>
          <a-descriptions-item label="标签" v-if="detailDialog.form.tags && detailDialog.form.tags.length">
            <div class="detail-tags-list">
              <a-tag v-for="tag in detailDialog.form.tags" :key="tag" size="small">{{ tag }}</a-tag>
            </div>
          </a-descriptions-item>
          <a-descriptions-item label="描述">{{ detailDialog.form.description || '无描述' }}</a-descriptions-item>
        </a-descriptions>

        <div class="schema-preview">
          <h3>表单结构</h3>
          <a-table 
            :data-source="detailDialog.form.schema.fields" 
            :columns="schemaColumns" 
            :pagination="false" 
            bordered
            size="small" 
            row-key="name" 
            :scroll="{ x: 600 }"
          >
            <template #bodyCell="{ column, record }">
              <template v-if="column.key === 'required'">
                <a-tag :color="record.required ? 'red' : ''">
                  {{ record.required ? '必填' : '可选' }}
                </a-tag>
              </template>
              <template v-if="column.key === 'type'">
                {{ getFieldTypeName(record.type) }}
              </template>
            </template>
          </a-table>
        </div>

        <div class="detail-footer">
          <a-button @click="closeDetailDialog">关闭</a-button>
          <a-button type="primary" @click="handleEditForm(detailDialog.form)">编辑</a-button>
          <a-button type="default" @click="handlePreviewForm(detailDialog.form)">预览</a-button>
        </div>
      </div>
    </a-modal>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted, onBeforeUnmount, computed } from 'vue';
import { message, Modal } from 'ant-design-vue';
import {
  PlusOutlined,
  FormOutlined,
  CheckCircleOutlined,
  EditOutlined,
  StopOutlined,
  DownOutlined,
  EyeOutlined
} from '@ant-design/icons-vue';
import { Icon } from '@iconify/vue';
import {
  listWorkorderFormDesign,
  detailWorkorderFormDesign,
  createWorkorderFormDesign,
  updateWorkorderFormDesign,
  deleteWorkorderFormDesign,
  FormDesignStatus,
  FormFieldType,
  type WorkorderFormDesignItem,
  type FormField,
  type FormSchema,
  type ListWorkorderFormDesignReq,
  type CreateWorkorderFormDesignReq,
  type UpdateWorkorderFormDesignReq
} from '#/api/core/workorder/workorder_form_design';
import type { WorkorderCategoryItem } from '#/api/core/workorder/workorder_category';
import { listWorkorderCategory } from '#/api/core/workorder/workorder_category';

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

const totalPages = computed(() => {
  return Math.ceil(categoryPagination.total / categoryPagination.pageSize);
});

// 列定义
const columns = [
  { title: '表单名称', dataIndex: 'name', key: 'name', width: 200, fixed: 'left' },
  { title: '分类', dataIndex: 'category', key: 'category', width: 120, align: 'center' as const },
  { title: '描述', dataIndex: 'description', key: 'description', width: 200, ellipsis: true },
  { title: '状态', dataIndex: 'status', key: 'status', width: 100, align: 'center' as const },
  { title: '操作人', dataIndex: 'operator_name', key: 'operator', width: 120 },
  { title: '标签', dataIndex: 'tags', key: 'tags', width: 150 },
  { title: '创建时间', dataIndex: 'created_at', key: 'createdAt', width: 180 },
  { title: '操作', key: 'action', width: 200, align: 'center' as const, fixed: 'right' }
];

const schemaColumns = [
  { title: '类型', dataIndex: 'type', key: 'type', width: 120 },
  { title: '标签', dataIndex: 'label', key: 'label', width: 180 },
  { title: '字段名', dataIndex: 'name', key: 'name', width: 180 },
  { title: '是否必填', dataIndex: 'required', key: 'required', width: 100 }
];

// 状态数据
const loading = ref(false);
const previewLoading = ref(false);
const searchQuery = ref('');
const categoryFilter = ref<number | undefined>(undefined);
const statusFilter = ref<number | undefined>(undefined);
const templateFilter = ref<number | undefined>(undefined);
const formDesigns = ref<WorkorderFormDesignItem[]>([]);
const categories = ref<WorkorderCategoryItem[]>([]);
const previewFormData = ref<Record<string, any>>({});

// 表单对话框中的分页分类数据
const formDialogCategories = ref<WorkorderCategoryItem[]>([]);
const categorySelectorLoading = ref(false);
const categorySearchKeyword = ref('');
let categorySearchTimeout: NodeJS.Timeout | null = null;

// 分类分页状态
const categoryPagination = reactive({
  current: 1,
  pageSize: 20,
  total: 0,
  hasMore: false
});

// JSON相关状态
const jsonValidationError = ref('');
const exampleDialogVisible = ref(false);

// 防抖处理
let searchTimeout: NodeJS.Timeout | null = null;

// 清理定时器
onBeforeUnmount(() => {
  if (categorySearchTimeout) clearTimeout(categorySearchTimeout);
  if (searchTimeout) clearTimeout(searchTimeout);
});

// 分页配置
const paginationConfig = reactive({
  current: 1,
  pageSize: 10,
  total: 0,
  showSizeChanger: true,
  showQuickJumper: true,
  showTotal: (total: number) => `共 ${total} 条记录`,
  size: 'default' as const
});

// 统计数据
const stats = reactive({
  total: 0,
  published: 0,
  draft: 0,
  archived: 0
});

// 对话框状态
const formDialogVisible = ref(false);
const detailDialogVisible = ref(false);
const previewDialogVisible = ref(false);

// 表单对话框数据
const formDialog = reactive({
  isEdit: false,
  form: {
    id: undefined as number | undefined,
    name: '',
    description: '',
    category_id: undefined as number | undefined,
    status: FormDesignStatus.Draft as number,
    tags: [] as string[],
    is_template: 2 as number,
    fieldsJson: ''
  }
});

// 详情对话框数据
const detailDialog = reactive({
  form: null as WorkorderFormDesignItem | null
});

// 预览对话框数据
const previewDialog = reactive({
  form: null as WorkorderFormDesignItem | null
});

// 表单验证规则
const formRules = {
  name: [
    { required: true, message: '请输入表单名称', trigger: 'blur' },
    { min: 3, max: 50, message: '长度应为3到50个字符', trigger: 'blur' }
  ],
  category_id: [
    { required: true, message: '请选择分类', trigger: 'change' }
  ]
};

// 字段帮助文本
const fieldsHelpText = `支持的字段类型：text(文本), number(数字), password(密码), textarea(多行文本), select(下拉), radio(单选), checkbox(复选), date(日期), switch(开关)。
必需属性：name, type, label, required, placeholder, default, options（选择类型必需）。`;

// 字段示例
const simpleFieldsExample = JSON.stringify([
  {
    "name": "name",
    "type": "text",
    "label": "姓名",
    "required": 1,
    "placeholder": "请输入姓名"
  },
  {
    "name": "gender",
    "type": "select",
    "label": "性别",
    "required": 1,
    "placeholder": "请选择性别",
    "options": ["男", "女"]
  }
], null, 2);

const complexFieldsExample = JSON.stringify([
  {
    "name": "username",
    "type": "text",
    "label": "用户名",
    "required": 1,
    "placeholder": "请输入用户名"
  },
  {
    "name": "age",
    "type": "number",
    "label": "年龄",
    "required": 1,
    "placeholder": "请输入年龄",
    "default": 18
  },
  {
    "name": "hobbies",
    "type": "checkbox",
    "label": "兴趣爱好",
    "required": 0,
    "options": ["读书", "运动", "音乐", "旅行"],
    "default": ["读书"]
  }
], null, 2);

const allTypesFieldsExample = JSON.stringify([
  {
    "name": "text_input",
    "type": "text",
    "label": "文本字段",
    "required": 1,
    "placeholder": "请输入文本"
  },
  {
    "name": "number_input",
    "type": "number",
    "label": "数字字段",
    "required": 0,
    "placeholder": "请输入数字"
  },
  {
    "name": "password_input",
    "type": "password",
    "label": "密码字段",
    "required": 1,
    "placeholder": "请输入密码"
  },
  {
    "name": "textarea_input",
    "type": "textarea",
    "label": "多行文本",
    "required": 0,
    "placeholder": "请输入详细内容"
  },
  {
    "name": "date_input",
    "type": "date",
    "label": "日期字段",
    "required": 0,
    "placeholder": "请选择日期"
  },
  {
    "name": "select_input",
    "type": "select",
    "label": "下拉选择",
    "required": 1,
    "placeholder": "请选择",
    "options": ["选项1", "选项2", "选项3"]
  },
  {
    "name": "radio_input",
    "type": "radio",
    "label": "单选字段",
    "required": 1,
    "options": ["是", "否"]
  },
  {
    "name": "checkbox_input",
    "type": "checkbox",
    "label": "复选字段",
    "required": 0,
    "options": ["选项A", "选项B", "选项C"]
  },
  {
    "name": "switch_input",
    "type": "switch",
    "label": "开关字段",
    "required": 0,
    "default": false
  }
], null, 2);

const getStatusColor = (status: number): string => {
  const colorMap = { 
    [FormDesignStatus.Draft]: 'orange', 
    [FormDesignStatus.Published]: 'green', 
    [FormDesignStatus.Archived]: 'default' 
  };
  return colorMap[status as keyof typeof colorMap] || 'default';
};

const getStatusText = (status: number): string => {
  const textMap = { 
    [FormDesignStatus.Draft]: '草稿', 
    [FormDesignStatus.Published]: '已发布', 
    [FormDesignStatus.Archived]: '已归档' 
  };
  return textMap[status as keyof typeof textMap] || '未知';
};

const getStatusClass = (status: number): string => {
  const classMap = { 
    [FormDesignStatus.Draft]: 'status-draft', 
    [FormDesignStatus.Published]: 'status-published', 
    [FormDesignStatus.Archived]: 'status-archived' 
  };
  return classMap[status as keyof typeof classMap] || '';
};

const getFieldTypeName = (type: string): string => {
  const typeMap: Record<string, string> = {
    text: '文本框', 
    number: '数字', 
    password: '密码',
    textarea: '多行文本',
    date: '日期', 
    select: '下拉选择',
    checkbox: '复选框', 
    radio: '单选框',
    switch: '开关'
  };
  return typeMap[type] || type;
};

const formatDate = (dateStr: string): string => {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleDateString('zh-CN');
};

const formatTime = (dateStr: string): string => {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
};

const formatFullDateTime = (dateStr: string): string => {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleString('zh-CN');
};

const getInitials = (name: string): string => {
  if (!name) return '';
  return name.slice(0, 2).toUpperCase();
};

const getAvatarColor = (name: string): string => {
  const colors = ['#1890ff', '#52c41a', '#faad14', '#f5222d', '#722ed1', '#13c2c2', '#eb2f96', '#fa8c16'];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length]!;
};

// 分页分类加载方法
const loadFormDialogCategories = async (reset: boolean = false, search?: string): Promise<void> => {
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
        formDialogCategories.value = response.items || [];
        categoryPagination.current = 1;
      } else {
        const existingIds = new Set(formDialogCategories.value.map(cat => cat.id));
        const newItems = (response.items || []).filter((cat: any) => !existingIds.has(cat.id));
        formDialogCategories.value = [...formDialogCategories.value, ...newItems];
      }

      categoryPagination.total = response.total || 0;
      categoryPagination.hasMore = (response.items || []).length === categoryPagination.pageSize &&
        formDialogCategories.value.length < categoryPagination.total;
    }
  } catch (error: any) {

    if (reset) {
      message.error(error.message || '加载分类列表失败');
      formDialogCategories.value = [];
      categoryPagination.current = 1;
      categoryPagination.total = 0;
      categoryPagination.hasMore = false;
    }
  } finally {
    categorySelectorLoading.value = false;
  }
};

// 处理分类搜索
const handleCategorySearch = (value: string): void => {
  categorySearchKeyword.value = value;

  if (categorySearchTimeout) {
    clearTimeout(categorySearchTimeout);
  }

  categorySearchTimeout = setTimeout(() => {
    categoryPagination.current = 1;
    loadFormDialogCategories(true, value);
  }, 300);
};

// 处理下拉框显示/隐藏
const handleCategoryDropdownChange = (open: boolean): void => {
  if (open) {
    if (formDialogCategories.value.length === 0) {
      loadFormDialogCategories(true);
    }
  }
};

// 处理滚动加载更多
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

// 加载更多分类
const loadMoreCategories = async (): Promise<void> => {
  if (!categoryPagination.hasMore || categorySelectorLoading.value) {
    return;
  }

  categoryPagination.current += 1;
  await loadFormDialogCategories(false);
};

// JSON相关方法
const formatFieldsJson = (): void => {
  try {
    if (!formDialog.form.fieldsJson.trim()) {
      message.warning('请先输入JSON内容');
      return;
    }
    const parsed = JSON.parse(formDialog.form.fieldsJson);
    formDialog.form.fieldsJson = JSON.stringify(parsed, null, 2);
    jsonValidationError.value = '';
    message.success('JSON格式化成功');
  } catch (error) {
    jsonValidationError.value = `JSON格式错误: ${(error as Error).message}`;
    message.error('JSON格式化失败');
  }
};

const validateFieldsJson = (): void => {
  try {
    if (!formDialog.form.fieldsJson.trim()) {
      jsonValidationError.value = '';
      message.info('JSON内容为空');
      return;
    }

    const parsed = JSON.parse(formDialog.form.fieldsJson);

    if (!Array.isArray(parsed)) {
      throw new Error('字段配置必须是数组格式');
    }

    parsed.forEach((field: any, index: number) => {
      const requiredProps = ['name', 'type', 'label', 'required'];
      const missingProps = requiredProps.filter(prop => field[prop] === undefined);

      if (missingProps.length > 0) {
        throw new Error(`字段 ${index + 1} 缺少必需属性: ${missingProps.join(', ')}`);
      }

      const validTypes = Object.values(FormFieldType);
      if (!validTypes.includes(field.type)) {
        throw new Error(`字段 ${index + 1} 的类型 "${field.type}" 不支持`);
      }

      if ([FormFieldType.Select, FormFieldType.Radio, FormFieldType.Checkbox].includes(field.type) && 
          (!field.options || !Array.isArray(field.options))) {
        throw new Error(`字段 ${index + 1} (${field.type}类型) 必须包含options数组`);
      }
    });

    jsonValidationError.value = '';
    message.success('JSON验证通过');
  } catch (error) {
    jsonValidationError.value = `验证失败: ${(error as Error).message}`;
    message.error('JSON验证失败');
  }
};

const showFieldsExample = (): void => {
  exampleDialogVisible.value = true;
};

const copyExample = (example: string): void => {
  formDialog.form.fieldsJson = example;
  exampleDialogVisible.value = false;
  message.success('示例已复制到编辑器');
};

const closeExampleDialog = (): void => {
  exampleDialogVisible.value = false;
};

// 解析字段JSON为FormField数组
const parseFieldsJson = (jsonStr: string): FormField[] => {
  try {
    if (!jsonStr.trim()) {
      return [];
    }
    const parsed = JSON.parse(jsonStr);
    if (!Array.isArray(parsed)) {
      throw new Error('字段配置必须是数组格式');
    }
    return parsed;
  } catch (error) {
    throw new Error(`字段JSON解析失败: ${(error as Error).message}`);
  }
};

// 更新统计数据
const updateStats = (items: WorkorderFormDesignItem[]) => {
  stats.total = items.length;
  stats.draft = items.filter(item => item.status === FormDesignStatus.Draft).length;
  stats.published = items.filter(item => item.status === FormDesignStatus.Published).length;
  stats.archived = items.filter(item => item.status === FormDesignStatus.Archived).length;
};

// 数据加载
const loadFormDesigns = async (): Promise<void> => {
  loading.value = true;
  try {
    const params: ListWorkorderFormDesignReq = {
      page: paginationConfig.current,
      size: paginationConfig.pageSize,
      search: searchQuery.value || undefined,
      status: statusFilter.value,
      category_id: categoryFilter.value,
      is_template: templateFilter.value
    };

    const response = await listWorkorderFormDesign(params);
    if (response) {
      formDesigns.value = response.items || [];
      paginationConfig.total = response.total || 0;
      updateStats(response.items || []);
    }
  } catch (error) {

    message.error('加载表单列表失败');
  } finally {
    loading.value = false;
  }
};

const loadCategories = async (): Promise<void> => {
  try {
    let allCategories: any[] = [];
    let currentPage = 1;
    const pageSize = 50;
    let hasMoreData = true;

    while (hasMoreData) {
      const response = await listWorkorderCategory({ 
        page: currentPage, 
        size: pageSize 
      });
      
      if (response && response.items && response.items.length > 0) {
        allCategories = [...allCategories, ...response.items];
        
        // 检查是否还有更多数据
        if (response.items.length < pageSize || allCategories.length >= (response.total || 0)) {
          hasMoreData = false;
        } else {
          currentPage++;
        }
      } else {
        hasMoreData = false;
      }
    }

    categories.value = allCategories;
  } catch (error) {

    message.error('加载分类列表失败');
    categories.value = [];
  }
};

// 事件处理
const handleTableChange = (pagination: any): void => {
  paginationConfig.current = pagination.current;
  paginationConfig.pageSize = pagination.pageSize;
  loadFormDesigns();
};

const handleSearch = (): void => {
  paginationConfig.current = 1;
  loadFormDesigns();
};

const handleSearchChange = (): void => {
  if (searchTimeout) {
    clearTimeout(searchTimeout);
  }
  searchTimeout = setTimeout(() => {
    paginationConfig.current = 1;
    loadFormDesigns();
  }, 500);
};

const handleCategoryChange = (): void => {
  paginationConfig.current = 1;
  loadFormDesigns();
};

const handleStatusChange = (): void => {
  paginationConfig.current = 1;
  loadFormDesigns();
};

const handleTemplateChange = (): void => {
  paginationConfig.current = 1;
  loadFormDesigns();
};

const handleResetFilters = (): void => {
  searchQuery.value = '';
  categoryFilter.value = undefined;
  statusFilter.value = undefined;
  templateFilter.value = undefined;
  paginationConfig.current = 1;
  loadFormDesigns();
  message.success('过滤条件已重置');
};

const handleCreateForm = (): void => {
  formDialog.isEdit = false;
  formDialog.form = {
    id: undefined,
    name: '',
    description: '',
    category_id: undefined,
    status: FormDesignStatus.Draft,
    tags: [],
    is_template: 2,
    fieldsJson: ''
  };
  jsonValidationError.value = '';
  formDialogVisible.value = true;
  resetCategorySelector();
};

const handleEditForm = async (record: WorkorderFormDesignItem): Promise<void> => {
  try {
    const response = await detailWorkorderFormDesign({ id: record.id });
    if (response) {
      formDialog.isEdit = true;
      formDialog.form = {
        id: response.id,
        name: response.name,
        description: response.description,
        category_id: response.category_id,
        status: response.status,
        tags: response.tags || [],
        is_template: response.is_template,
        fieldsJson: JSON.stringify(response.schema.fields || [], null, 2)
      };
      jsonValidationError.value = '';
      formDialogVisible.value = true;
      detailDialogVisible.value = false;
      await loadCategoryForEdit(response);
    }
  } catch (error) {

    message.error('加载表单详情失败');
  }
};

// 为编辑模式加载分类信息的专用方法
const loadCategoryForEdit = async (formData: WorkorderFormDesignItem): Promise<void> => {
  resetCategorySelector();

  try {
    await loadFormDialogCategories(true);

    if (formData.category_id && !formDialogCategories.value.find(cat => cat.id === formData.category_id)) {
      if (formData.category && formData.category.name) {
        const categoryInfo: WorkorderCategoryItem = {
          id: formData.category_id,
          name: formData.category.name,
          description: formData.category.description || '',
          created_at: '',
          updated_at: '',
          status: 1,
          operator_id: 0,
          operator_name: ''
        };

        formDialogCategories.value = [categoryInfo, ...formDialogCategories.value];
      }
    }
  } catch (error) {

    if (formData.category_id && formData.category?.name) {
      const categoryInfo: WorkorderCategoryItem = {
        id: formData.category_id,
        name: formData.category.name || `分类${formData.category_id}`,
        description: formData.category?.description || '',
        created_at: '',
        updated_at: '',
        status: 1,
        operator_id: 0,
        operator_name: ''
      };
      formDialogCategories.value = [categoryInfo];
    }
  }
};

// 重置分类选择器状态
const resetCategorySelector = (): void => {
  formDialogCategories.value = [];
  categoryPagination.current = 1;
  categoryPagination.total = 0;
  categoryPagination.hasMore = false;
  categorySearchKeyword.value = '';
  categorySelectorLoading.value = false;

  if (categorySearchTimeout) {
    clearTimeout(categorySearchTimeout);
    categorySearchTimeout = null;
  }
};

const handleViewForm = async (record: WorkorderFormDesignItem): Promise<void> => {
  try {
    const response = await detailWorkorderFormDesign({ id: record.id });
    if (response) {
      detailDialog.form = response;
      detailDialogVisible.value = true;
    }
  } catch (error) {

    message.error('加载表单详情失败');
  }
};

const handleMenuClick = (command: string, record: WorkorderFormDesignItem): void => {
  switch (command) {
    case 'preview':
      handlePreviewForm(record);
      break;
    case 'publish':
      publishForm(record);
      break;
    case 'archive':
      archiveForm(record);
      break;
    case 'unarchive':
      unarchiveForm(record);
      break;
    case 'delete':
      confirmDelete(record);
      break;
  }
};

const handlePreviewForm = async (record: WorkorderFormDesignItem): Promise<void> => {
  previewLoading.value = true;
  previewDialogVisible.value = true;

  try {
    const response = await detailWorkorderFormDesign({ id: record.id });
    if (response) {
      previewDialog.form = response;
      initPreviewFormData(response.schema);
    }
  } catch (error) {

    message.error('加载预览数据失败');
  } finally {
    previewLoading.value = false;
  }
};

const publishForm = async (record: WorkorderFormDesignItem): Promise<void> => {
  try {
    const updateData: UpdateWorkorderFormDesignReq = {
      id: record.id,
      name: record.name,
      description: record.description,
      schema: record.schema,
      status: FormDesignStatus.Published,
      category_id: record.category_id,
      tags: record.tags,
      is_template: record.is_template
    };
    await updateWorkorderFormDesign(updateData);
    message.success(`表单 "${record.name}" 已发布`);
    loadFormDesigns();
  } catch (error) {

    message.error('发布表单失败');
  }
};

const archiveForm = async (record: WorkorderFormDesignItem): Promise<void> => {
  try {
    const updateData: UpdateWorkorderFormDesignReq = {
      id: record.id,
      name: record.name,
      description: record.description,
      schema: record.schema,
      status: FormDesignStatus.Archived,
      category_id: record.category_id,
      tags: record.tags,
      is_template: record.is_template
    };
    await updateWorkorderFormDesign(updateData);
    message.success(`表单 "${record.name}" 已归档`);
    loadFormDesigns();
  } catch (error) {

    message.error('归档表单失败');
  }
};

const unarchiveForm = async (record: WorkorderFormDesignItem): Promise<void> => {
  try {
    const updateData: UpdateWorkorderFormDesignReq = {
      id: record.id,
      name: record.name,
      description: record.description,
      schema: record.schema,
      status: FormDesignStatus.Draft,
      category_id: record.category_id,
      tags: record.tags,
      is_template: record.is_template
    };
    await updateWorkorderFormDesign(updateData);
    message.success(`表单 "${record.name}" 已取消归档`);
    loadFormDesigns();
  } catch (error) {

    message.error('取消归档表单失败');
  }
};

const confirmDelete = (record: WorkorderFormDesignItem): void => {
  Modal.confirm({
    title: '警告',
    content: `确定要删除表单 "${record.name}" 吗？`,
    okText: '删除',
    okType: 'danger',
    cancelText: '取消',
    async onOk() {
      try {
        await deleteWorkorderFormDesign({ id: record.id });
        message.success(`表单 "${record.name}" 已删除`);
        loadFormDesigns();
      } catch (error) {

        message.error('删除表单失败');
      }
    }
  });
};

// 表单保存
const saveForm = async (): Promise<void> => {
  if (!formDialog.form.name.trim()) {
    message.error('表单名称不能为空');
    return;
  }

  if (!formDialog.form.category_id) {
    message.error('请选择分类');
    return;
  }

  let fields: FormField[] = [];
  try {
    fields = parseFieldsJson(formDialog.form.fieldsJson);
  } catch (error) {
    message.error((error as Error).message);
    return;
  }

  try {
    const schema: FormSchema = {
      fields: fields
    };

    if (formDialog.isEdit && formDialog.form.id) {
      const updateData: UpdateWorkorderFormDesignReq = {
        id: formDialog.form.id,
        name: formDialog.form.name,
        description: formDialog.form.description,
        schema: schema,
        status: formDialog.form.status,
        category_id: formDialog.form.category_id,
        tags: formDialog.form.tags,
        is_template: formDialog.form.is_template
      };
      await updateWorkorderFormDesign(updateData);
      message.success(`表单 "${formDialog.form.name}" 已更新`);
    } else {
      const createData: CreateWorkorderFormDesignReq = {
        name: formDialog.form.name,
        description: formDialog.form.description,
        schema: schema,
        status: formDialog.form.status,
        category_id: formDialog.form.category_id,
        tags: formDialog.form.tags,
        is_template: formDialog.form.is_template
      };
      await createWorkorderFormDesign(createData);
      message.success(`表单 "${formDialog.form.name}" 已创建`);
    }

    formDialogVisible.value = false;
    loadFormDesigns();
  } catch (error) {

    message.error('保存表单失败');
  }
};

// 预览表单数据初始化
const initPreviewFormData = (schema: FormSchema): void => {
  const data: Record<string, any> = {};

  schema.fields.forEach((field: FormField) => {
    switch (field.type) {
      case FormFieldType.Text:
      case FormFieldType.Password:
      case FormFieldType.Textarea:
        data[field.name] = field.default || '';
        break;
      case FormFieldType.Number:
        data[field.name] = field.default || undefined;
        break;
      case FormFieldType.Date:
        data[field.name] = field.default || undefined;
        break;
      case FormFieldType.Select:
      case FormFieldType.Radio:
        data[field.name] = field.default || undefined;
        break;
      case FormFieldType.Checkbox:
        data[field.name] = field.default || [];
        break;
      case FormFieldType.Switch:
        data[field.name] = field.default || false;
        break;
      default:
        data[field.name] = field.default || '';
    }
  });

  previewFormData.value = data;
};

const resetPreviewForm = (): void => {
  if (previewDialog.form) {
    initPreviewFormData(previewDialog.form.schema);
    message.success('表单已重置');
  }
};

// 对话框关闭
const closeFormDialog = (): void => {
  formDialogVisible.value = false;
  jsonValidationError.value = '';
  resetCategorySelector();
};

const closeDetailDialog = (): void => {
  detailDialogVisible.value = false;
};

const closePreviewDialog = (): void => {
  previewDialogVisible.value = false;
  previewDialog.form = null;
  previewFormData.value = {};
};

// 生命周期钩子
onMounted(() => {
  loadCategories();
  loadFormDesigns();
});
</script>

<style scoped>
.form-management-container {
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

.category-filter,
.status-filter,
.template-filter {
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

.form-name-cell {
  display: flex;
  align-items: center;
  gap: 10px;
}

.form-badge {
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

.form-name-text {
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

.operator-info {
  display: flex;
  align-items: center;
  gap: 8px;
}

.operator-name {
  font-size: 14px;
  word-break: break-all;
}

.tags-cell {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  align-items: center;
}

.tags-popover {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  max-width: 200px;
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

/* 分页分类选择器样式 */
.category-loading,
.category-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 8px 12px;
  color: #8c8c8c;
  font-size: 14px;
}

.category-option {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.category-name {
  font-weight: 500;
  color: #262626;
}

.category-desc {
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

/* 表单字段设计样式 */
.form-fields-section {
  border: 1px solid #d9d9d9;
  border-radius: 6px;
  padding: 16px;
  background: #fafafa;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
  flex-wrap: wrap;
  gap: 8px;
}

.section-header h4 {
  margin: 0;
  color: #333;
  font-size: 16px;
}

.header-actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.json-editor {
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
  font-size: 13px;
  line-height: 1.5;
  border: 1px solid #d9d9d9;
  border-radius: 4px;
  background: white;
  transition: all 0.3s;
}

.json-editor:hover {
  border-color: #40a9ff;
}

.json-editor:focus {
  border-color: #1890ff;
  box-shadow: 0 0 0 2px rgba(24, 144, 255, 0.2);
}

.json-error {
  border-color: #ff4d4f !important;
}

.json-error:focus {
  box-shadow: 0 0 0 2px rgba(255, 77, 79, 0.2) !important;
}

.json-error-message {
  margin-top: 8px;
}

.json-help {
  margin-top: 12px;
}

.json-help :deep(.ant-alert-description) {
  white-space: pre-line;
}

/* 示例对话框样式 */
.example-content {
  max-height: 600px;
  overflow-y: auto;
}

.json-example {
  background: #f5f5f5;
  border: 1px solid #d9d9d9;
  border-radius: 4px;
  padding: 16px;
  margin-bottom: 12px;
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
  font-size: 12px;
  line-height: 1.4;
  overflow-x: auto;
  white-space: pre;
}

.form-design-modal :deep(.ant-modal-body) {
  max-height: 70vh;
  overflow-y: auto;
}

.detail-dialog .form-details {
  margin-bottom: 20px;
}

.detail-header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 20px;
  flex-wrap: wrap;
}

.detail-header h2 {
  margin: 0;
  font-size: 24px;
  color: #1f2937;
  word-break: break-all;
}

.detail-tags {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.detail-tags-list {
  display: flex;
  gap: 4px;
  flex-wrap: wrap;
}

.schema-preview {
  margin-top: 24px;
}

.schema-preview h3 {
  margin-bottom: 16px;
  color: #1f2937;
  font-size: 18px;
}

.detail-footer {
  margin-top: 24px;
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  flex-wrap: wrap;
}

.form-preview-wrapper {
  background: #fafafa;
  border-radius: 8px;
  padding: 16px;
  min-height: 400px;
}

.preview-header {
  text-align: center;
  margin-bottom: 32px;
  padding-bottom: 16px;
  border-bottom: 1px solid #e8e8e8;
}

.preview-header h3 {
  margin: 0 0 8px 0;
  font-size: 24px;
  color: #1f2937;
  font-weight: 600;
  word-break: break-all;
}

.preview-description {
  margin: 0 0 16px 0;
  color: #666;
  font-size: 14px;
  word-break: break-all;
}

.preview-mode-notice {
  margin-top: 16px;
}

.preview-form {
  background: white;
  border-radius: 8px;
  padding: 24px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
  max-width: 600px;
  margin: 0 auto;
}

.dynamic-form .form-field {
  margin-bottom: 24px;
}

.dynamic-form .form-field :deep(.ant-form-item-label) {
  font-weight: 500;
  color: #333;
}

.dynamic-form .form-field :deep(.ant-form-item-required::before) {
  content: '*';
  color: #ff4d4f;
  margin-right: 4px;
}

.preview-input {
  transition: all 0.3s ease;
}

.preview-input:hover {
  box-shadow: 0 2px 8px rgba(24, 144, 255, 0.2);
  border-color: #40a9ff;
}

.preview-input:focus {
  box-shadow: 0 2px 8px rgba(24, 144, 255, 0.3);
  border-color: #1890ff;
}

.preview-radio-group,
.preview-checkbox-group {
  padding: 8px;
  border-radius: 6px;
  transition: all 0.3s ease;
}

.preview-radio-group:hover,
.preview-checkbox-group:hover {
  background-color: #f5f5f5;
}

.radio-options,
.checkbox-options {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.preview-radio,
.preview-checkbox {
  transition: all 0.3s ease;
  padding: 4px 8px;
  border-radius: 4px;
}

.preview-radio:hover,
.preview-checkbox:hover {
  background-color: #e6f7ff;
}

.preview-form-actions {
  margin-top: 32px;
  text-align: center;
  padding-top: 24px;
  border-top: 1px solid #f0f0f0;
  display: flex;
  justify-content: center;
  gap: 12px;
  flex-wrap: wrap;
}

.responsive-modal :deep(.ant-modal-content) {
  margin: 0;
}

/* 选择器下拉列表样式优化 */
:deep(.ant-select-dropdown) {
  .load-more-option.ant-select-item-option-disabled {
    color: #1890ff !important;
    cursor: pointer !important;
    background-color: #fafafa !important;
  }

  .load-more-option.ant-select-item-option-disabled:hover {
    background-color: #f0f0f0 !important;
  }
}

/* 分类选择器加载状态 */
:deep(.ant-select-selector) {
  .ant-select-selection-placeholder {
    color: #bfbfbf;
  }
}

:deep(.ant-select-loading) {
  .ant-select-clear {
    display: none;
  }
}

/* 移动端适配 */
@media (max-width: 768px) {
  .form-management-container {
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

  .category-filter,
  .status-filter,
  .template-filter {
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

  .section-header {
    flex-direction: column;
    align-items: stretch;
  }

  .header-actions {
    justify-content: center;
  }

  .json-editor {
    font-size: 12px;
  }

  .form-preview-wrapper {
    padding: 12px;
  }

  .preview-form {
    padding: 16px;
  }

  .preview-header h3 {
    font-size: 18px;
  }

  .radio-options,
  .checkbox-options {
    gap: 8px;
  }

  .preview-form-actions {
    flex-direction: column;
    align-items: center;
  }

  .preview-form-actions .ant-btn {
    width: 100%;
    max-width: 200px;
  }

  .detail-footer {
    justify-content: center;
  }

  .detail-footer .ant-btn {
    flex: 1;
    max-width: 120px;
  }

  .category-desc {
    max-width: 150px;
  }

  .load-more-content {
    padding: 6px 8px;
  }

  .tags-cell {
    max-width: 120px;
  }

  .tags-popover {
    max-width: 150px;
  }
}

/* 平板端适配 */
@media (max-width: 1024px) and (min-width: 769px) {
  .form-management-container {
    padding: 16px;
  }

  .search-input {
    width: 200px;
  }

  .preview-form {
    padding: 20px;
  }

  .category-desc {
    max-width: 180px;
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

  .json-example {
    font-size: 10px;
    padding: 12px;
  }

  .category-desc {
    max-width: 120px;
  }

  .load-more-content {
    padding: 4px 6px;
    font-size: 12px;
  }

  .tags-cell {
    max-width: 100px;
  }

  .detail-tags,
  .detail-tags-list {
    gap: 4px;
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

/* 焦点状态优化 */
.preview-input:focus-within,
.preview-radio-group:focus-within,
.preview-checkbox-group:focus-within {
  box-shadow: 0 0 0 2px rgba(24, 144, 255, 0.2);
  border-radius: 6px;
}

.preview-radio :deep(.ant-radio-checked .ant-radio-inner),
.preview-checkbox :deep(.ant-checkbox-checked .ant-checkbox-inner) {
  background-color: #1890ff;
  border-color: #1890ff;
}

.preview-form-actions .ant-btn[disabled] {
  opacity: 0.7;
  cursor: not-allowed;
}
</style>
