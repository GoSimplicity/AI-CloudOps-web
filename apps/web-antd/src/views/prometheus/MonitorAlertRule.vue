<template>
  <div class="alert-rule-container">
    <!-- 页面标题 -->
    <div class="page-header">
      <div class="header-actions">
        <a-button type="primary" @click="showAddModal" class="btn-create">
          <template #icon>
            <PlusOutlined />
          </template>
          <span class="btn-text">新增AlertRule</span>
        </a-button>
        <div class="search-filters">
          <a-input-search
            v-model:value="searchParams.search"
            placeholder="搜索规则名称..."
            class="search-input"
            @search="handleSearch"
            allow-clear
          />
          <a-select
            v-model:value="searchParams.severity"
            placeholder="严重性"
            class="filter-select"
            @change="handleSearch"
            allow-clear
          >
            <a-select-option :value="AlertRuleSeverity.Critical">Critical</a-select-option>
            <a-select-option :value="AlertRuleSeverity.Warning">Warning</a-select-option>
            <a-select-option :value="AlertRuleSeverity.Info">Info</a-select-option>
          </a-select>
          <a-select
            v-model:value="searchParams.enable"
            placeholder="启用状态"
            class="filter-select"
            @change="handleSearch"
            allow-clear
          >
            <a-select-option :value="1">启用</a-select-option>
            <a-select-option :value="2">禁用</a-select-option>
          </a-select>
          <a-button @click="handleReset" class="reset-btn">
            重置
          </a-button>
        </div>
      </div>
    </div>

    <!-- 统计卡片 -->
    <div class="stats-row">
      <a-row :gutter="[16, 16]">
        <a-col :xs="12" :sm="6" :md="6" :lg="6">
          <a-card class="stats-card">
            <a-statistic 
              title="总规则" 
              :value="stats.total" 
              :value-style="{ color: '#3f8600' }"
            >
              <template #prefix>
                <Icon icon="carbon:container-registry" />
              </template>
            </a-statistic>
          </a-card>
        </a-col>
        <a-col :xs="12" :sm="6" :md="6" :lg="6">
          <a-card class="stats-card">
            <a-statistic 
              title="Critical" 
              :value="stats.critical" 
              :value-style="{ color: '#cf1322' }"
            >
              <template #prefix>
                <Icon icon="carbon:warning-alt" />
              </template>
            </a-statistic>
          </a-card>
        </a-col>
        <a-col :xs="12" :sm="6" :md="6" :lg="6">
          <a-card class="stats-card">
            <a-statistic 
              title="Warning" 
              :value="stats.warning" 
              :value-style="{ color: '#faad14' }"
            >
              <template #prefix>
                <Icon icon="carbon:notification" />
              </template>
            </a-statistic>
          </a-card>
        </a-col>
        <a-col :xs="12" :sm="6" :md="6" :lg="6">
          <a-card class="stats-card">
            <a-statistic 
              title="已启用" 
              :value="stats.enabled" 
              :value-style="{ color: '#1890ff' }"
            >
              <template #prefix>
                <Icon icon="carbon:checkmark-outline" />
              </template>
            </a-statistic>
          </a-card>
        </a-col>
      </a-row>
    </div>

    <!-- 表格容器 -->
    <div class="table-container">
      <a-card>
        <a-table
          :data-source="data"
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
              <div class="rule-name-cell">
                <div class="rule-badge" :class="getAlertStatusClass(record)"></div>
                <span class="rule-name-text">{{ record.name }}</span>
              </div>
            </template>

            <template v-if="column.key === 'expr'">
              <div class="expr-container" :title="record.expr">
                {{ record.expr }}
              </div>
            </template>

            <template v-if="column.key === 'labels'">
              <div class="tag-container">
                <template v-if="record.labels?.length && record.labels[0] !== ''">
                  <template v-for="label in getDisplayLabels(record.labels)" :key="label">
                    <a-tag class="tech-tag label-tag">
                      <span class="label-key">{{ label.split(',')[0] }}</span>
                      <span class="label-separator">:</span>
                      <span class="label-value">{{ label.split(',')[1] }}</span>
                    </a-tag>
                  </template>
                  <a-popover
                    v-if="record.labels.length > 2"
                    title="所有标签"
                    trigger="hover"
                    placement="topLeft"
                  >
                    <template #content>
                      <div class="all-tags-container">
                        <a-tag
                          v-for="label in record.labels"
                          :key="label"
                          class="tech-tag label-tag"
                        >
                          <span class="label-key">{{ label.split(',')[0] }}</span>
                          <span class="label-separator">:</span>
                          <span class="label-value">{{ label.split(',')[1] }}</span>
                        </a-tag>
                      </div>
                    </template>
                    <a-tag class="tech-tag more-tag">+{{ record.labels.length - 2 }}</a-tag>
                  </a-popover>
                </template>
                <span v-else class="empty-text">无标签</span>
              </div>
            </template>

            <template v-if="column.key === 'annotations'">
              <div class="tag-container">
                <template v-if="record.annotations?.length && record.annotations[0] !== ''">
                  <template v-for="annotation in getDisplayAnnotations(record.annotations)" :key="annotation">
                    <a-tag class="tech-tag annotation-tag">
                      <span class="label-key">{{ annotation.split(',')[0] }}</span>
                      <span class="label-separator">:</span>
                      <span class="label-value">{{ annotation.split(',')[1] }}</span>
                    </a-tag>
                  </template>
                  <a-popover
                    v-if="record.annotations.length > 2"
                    title="所有注解"
                    trigger="hover"
                    placement="topLeft"
                  >
                    <template #content>
                      <div class="all-tags-container">
                        <a-tag
                          v-for="annotation in record.annotations"
                          :key="annotation"
                          class="tech-tag annotation-tag"
                        >
                          <span class="label-key">{{ annotation.split(',')[0] }}</span>
                          <span class="label-separator">:</span>
                          <span class="label-value">{{ annotation.split(',')[1] }}</span>
                        </a-tag>
                      </div>
                    </template>
                    <a-tag class="tech-tag more-tag">+{{ record.annotations.length - 2 }}</a-tag>
                  </a-popover>
                </template>
                <span v-else class="empty-text">无注解</span>
              </div>
            </template>

            <template v-if="column.key === 'severity'">
              <a-tag :class="['tech-tag', `severity-${severityText(record.severity)}`]">
                {{ severityLabel(record.severity) }}
              </a-tag>
            </template>

            <template v-if="column.key === 'enable'">
              <a-tag :color="record.enable === 1 ? 'success' : 'default'">
                {{ record.enable === 1 ? '启用' : '禁用' }}
              </a-tag>
            </template>

            <template v-if="column.key === 'pool_config'">
              <div class="config-info">
                <div class="config-item">
                  <span class="config-label">实例池:</span>
                  <span class="config-value">{{ getPoolName(record.pool_id) }}</span>
                </div>
                <div class="config-item">
                  <span class="config-label">发送组:</span>
                  <span class="config-value">{{ getSendGroupName(record.send_group_id) }}</span>
                </div>
              </div>
            </template>

            <template v-if="column.key === 'creator'">
              <div class="creator-info">
                <a-avatar
                  size="small"
                  :style="{ backgroundColor: getAvatarColor(record.create_user_name || '') }"
                >
                  {{ getInitials(record.create_user_name) }}
                </a-avatar>
                <span class="creator-name">{{ record.create_user_name }}</span>
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
                <a-button type="primary" size="small" @click="showDetailModal(record)">
                  查看
                </a-button>
                <a-button type="default" size="small" @click="showEditModal(record)">
                  编辑
                </a-button>
                <a-dropdown>
                  <template #overlay>
                    <a-menu @click="(e: any) => handleMenuClick(e.key, record)">
                      <a-menu-divider />
                      <a-menu-item key="delete" danger> 删除 </a-menu-item>
                    </a-menu>
                  </template>
                  <a-button size="small"> 更多 <DownOutlined /> </a-button>
                </a-dropdown>
              </div>
            </template>
          </template>
        </a-table>
      </a-card>
    </div>

    <!-- 新增AlertRule对话框 -->
    <a-modal
      :open="isAddModalVisible"
      title="新增AlertRule"
      :width="formDialogWidth"
      @ok="handleAdd"
      @cancel="closeAddModal"
      :destroy-on-close="true"
      class="responsive-modal alert-rule-modal"
    >
      <a-form ref="addFormRef" :model="addForm" :rules="formRules" layout="vertical">
        <div class="form-section">
          <div class="section-title">基本信息</div>
          <a-row :gutter="16">
            <a-col :span="24">
              <a-form-item label="名称" name="name">
                <a-input v-model:value="addForm.name" placeholder="请输入名称" />
              </a-form-item>
            </a-col>
          </a-row>
          <a-row :gutter="16">
            <a-col :xs="24" :sm="12">
              <a-form-item label="所属实例池" name="pool_id">
                <a-select
                  v-model:value="addForm.pool_id"
                  placeholder="请选择所属实例池"
                  @dropdown-visible-change="onPoolDropdownChange"
                  @popupScroll="handlePoolScroll"
                  :loading="poolLoading"
                >
                  <a-select-option v-for="pool in scrapePools" :key="pool.id" :value="pool.id">
                    {{ pool.name }}
                  </a-select-option>
                </a-select>
              </a-form-item>
            </a-col>
            <a-col :xs="24" :sm="12">
              <a-form-item label="发送组" name="send_group_id">
                <a-select
                  v-model:value="addForm.send_group_id"
                  placeholder="请选择发送组"
                  @dropdown-visible-change="onSendGroupDropdownChange"
                  @popupScroll="handleSendGroupScroll"
                  :loading="sendGroupLoading"
                >
                  <a-select-option v-for="group in sendGroups" :key="group.id" :value="group.id">
                    {{ group.name }}
                  </a-select-option>
                </a-select>
              </a-form-item>
            </a-col>
          </a-row>
          <a-row :gutter="16">
            <a-col :xs="24" :sm="12">
              <a-form-item label="IP地址" name="ip">
                <a-input v-model:value="addForm.ip" placeholder="请输入IP地址" class="ip-input" />
              </a-form-item>
            </a-col>
            <a-col :xs="24" :sm="12">
              <a-form-item label="端口" name="port">
                <a-input v-model:value="addForm.port" placeholder="端口" class="port-input" />
              </a-form-item>
            </a-col>
          </a-row>
          <a-row :gutter="16">
            <a-col :xs="24" :sm="12">
              <a-form-item label="Grafana链接" name="grafana_link">
                <a-input v-model:value="addForm.grafana_link" placeholder="请输入Grafana链接" />
              </a-form-item>
            </a-col>
          </a-row>
        </div>

        <div class="form-section">
          <div class="section-title">规则配置</div>
          <a-form-item label="表达式" name="expr">
            <a-textarea v-model:value="addForm.expr" placeholder="请输入PromQL表达式" :rows="4" />
          </a-form-item>
          <a-form-item>
            <a-button type="primary" @click="validateExpression(addForm.expr)">
              验证表达式
            </a-button>
          </a-form-item>
          <a-row :gutter="16">
            <a-col :xs="24" :sm="12">
              <a-form-item label="严重性" name="severity">
                <a-select v-model:value="addForm.severity" placeholder="请选择严重性">
                  <a-select-option :value="AlertRuleSeverity.Critical">Critical</a-select-option>
                  <a-select-option :value="AlertRuleSeverity.Warning">Warning</a-select-option>
                  <a-select-option :value="AlertRuleSeverity.Info">Info</a-select-option>
                </a-select>
              </a-form-item>
            </a-col>
            <a-col :xs="24" :sm="12">
              <a-form-item label="持续时间" name="for_time">
                <a-input v-model:value="addForm.for_time" placeholder="例如: 10s" />
              </a-form-item>
            </a-col>
          </a-row>
        </div>

        <div class="form-section">
          <div class="section-title">标签配置</div>
          <a-form-item
            v-for="(label, index) in addForm.labels"
            :key="label.key"
            :label="index === 0 ? '分组标签' : ''"
          >
            <div class="label-input-group">
              <a-input v-model:value="label.labelKey" placeholder="标签名" class="label-key-input" />
              <div class="label-separator">:</div>
              <a-input v-model:value="label.labelValue" placeholder="标签值" class="label-value-input" />
              <MinusCircleOutlined
                v-if="addForm.labels.length > 1"
                class="dynamic-delete-button"
                @click="removeLabel(label)"
              />
            </div>
          </a-form-item>
          <a-form-item>
            <a-button type="dashed" class="add-dynamic-button" @click="addLabel">
              <PlusOutlined /> 添加标签
            </a-button>
          </a-form-item>
        </div>

        <div class="form-section">
          <div class="section-title">注解配置</div>
          <a-form-item
            v-for="(annotation, index) in addForm.annotations"
            :key="annotation.key"
            :label="index === 0 ? '注解' : ''"
          >
            <div class="label-input-group">
              <a-input v-model:value="annotation.labelKey" placeholder="注解名" class="label-key-input" />
              <div class="label-separator">:</div>
              <a-input v-model:value="annotation.labelValue" placeholder="注解值" class="label-value-input" />
              <MinusCircleOutlined
                v-if="addForm.annotations.length > 1"
                class="dynamic-delete-button"
                @click="removeAnnotation(annotation)"
              />
            </div>
          </a-form-item>
          <a-form-item>
            <a-button type="dashed" @click="addAnnotation" class="add-dynamic-button">
              <PlusOutlined /> 添加注解
            </a-button>
          </a-form-item>
        </div>
      </a-form>
    </a-modal>

    <!-- 编辑AlertRule对话框 -->
    <a-modal
      :open="isEditModalVisible"
      title="编辑AlertRule"
      :width="formDialogWidth"
      @ok="handleEdit"
      @cancel="closeEditModal"
      :destroy-on-close="true"
      class="responsive-modal alert-rule-modal"
    >
      <a-form ref="editFormRef" :model="editForm" :rules="formRules" layout="vertical">
        <div class="form-section">
          <div class="section-title">基本信息</div>
          <a-row :gutter="16">
            <a-col :span="24">
              <a-form-item label="名称" name="name">
                <a-input v-model:value="editForm.name" placeholder="请输入名称" />
              </a-form-item>
            </a-col>
          </a-row>
          <a-row :gutter="16">
            <a-col :xs="24" :sm="12">
              <a-form-item label="所属实例池" name="pool_id">
                <a-select
                  v-model:value="editForm.pool_id"
                  placeholder="请选择所属实例池"
                  @dropdown-visible-change="onPoolDropdownChange"
                  @popupScroll="handlePoolScroll"
                  :loading="poolLoading"
                >
                  <a-select-option v-for="pool in scrapePools" :key="pool.id" :value="pool.id">
                    {{ pool.name }}
                  </a-select-option>
                </a-select>
              </a-form-item>
            </a-col>
            <a-col :xs="24" :sm="12">
              <a-form-item label="发送组" name="send_group_id">
                <a-select
                  v-model:value="editForm.send_group_id"
                  placeholder="请选择发送组"
                  @dropdown-visible-change="onSendGroupDropdownChange"
                  @popupScroll="handleSendGroupScroll"
                  :loading="sendGroupLoading"
                >
                  <a-select-option v-for="group in sendGroups" :key="group.id" :value="group.id">
                    {{ group.name }}
                  </a-select-option>
                </a-select>
              </a-form-item>
            </a-col>
          </a-row>
          <a-row :gutter="16">
            <a-col :xs="24" :sm="12">
              <a-form-item label="IP地址" name="ip">
                <a-input v-model:value="editForm.ip" placeholder="请输入IP地址" class="ip-input" />
              </a-form-item>
            </a-col>
            <a-col :xs="24" :sm="12">
              <a-form-item label="端口" name="port">
                <a-input v-model:value="editForm.port" placeholder="端口" class="port-input" />
              </a-form-item>
            </a-col>
          </a-row>
          <a-row :gutter="16">
            <a-col :xs="24" :sm="12">
              <a-form-item label="Grafana链接" name="grafana_link">
                <a-input v-model:value="editForm.grafana_link" placeholder="请输入Grafana链接" />
              </a-form-item>
            </a-col>
          </a-row>
          <a-row :gutter="16">
            <a-col :span="24">
              <a-form-item label="启用状态" name="enable">
                <a-switch v-model:checked="editForm.enableSwitch" class="tech-switch" />
              </a-form-item>
            </a-col>
          </a-row>
        </div>

        <div class="form-section">
          <div class="section-title">规则配置</div>
          <a-form-item label="表达式" name="expr">
            <a-textarea v-model:value="editForm.expr" placeholder="请输入PromQL表达式" :rows="4" />
          </a-form-item>
          <a-form-item>
            <a-button type="primary" @click="validateExpression(editForm.expr)">
              验证表达式
            </a-button>
          </a-form-item>
          <a-row :gutter="16">
            <a-col :xs="24" :sm="12">
              <a-form-item label="严重性" name="severity">
                <a-select v-model:value="editForm.severity" placeholder="请选择严重性">
                  <a-select-option :value="AlertRuleSeverity.Critical">Critical</a-select-option>
                  <a-select-option :value="AlertRuleSeverity.Warning">Warning</a-select-option>
                  <a-select-option :value="AlertRuleSeverity.Info">Info</a-select-option>
                </a-select>
              </a-form-item>
            </a-col>
            <a-col :xs="24" :sm="12">
              <a-form-item label="持续时间" name="for_time">
                <a-input v-model:value="editForm.for_time" placeholder="例如: 10s" />
              </a-form-item>
            </a-col>
          </a-row>
        </div>

        <div class="form-section">
          <div class="section-title">标签配置</div>
          <a-form-item
            v-for="(label, index) in editForm.labels"
            :key="label.key"
            :label="index === 0 ? '分组标签' : ''"
          >
            <div class="label-input-group">
              <a-input v-model:value="label.labelKey" placeholder="标签名" class="label-key-input" />
              <div class="label-separator">:</div>
              <a-input v-model:value="label.labelValue" placeholder="标签值" class="label-value-input" />
              <MinusCircleOutlined
                v-if="editForm.labels.length > 1"
                class="dynamic-delete-button"
                @click="removeEditLabel(label)"
              />
            </div>
          </a-form-item>
          <a-form-item>
            <a-button type="dashed" class="add-dynamic-button" @click="addEditLabel">
              <PlusOutlined /> 添加标签
            </a-button>
          </a-form-item>
        </div>

        <div class="form-section">
          <div class="section-title">注解配置</div>
          <a-form-item
            v-for="(annotation, index) in editForm.annotations"
            :key="annotation.key"
            :label="index === 0 ? '注解' : ''"
          >
            <div class="label-input-group">
              <a-input v-model:value="annotation.labelKey" placeholder="注解名" class="label-key-input" />
              <div class="label-separator">:</div>
              <a-input v-model:value="annotation.labelValue" placeholder="注解值" class="label-value-input" />
              <MinusCircleOutlined
                v-if="editForm.annotations.length > 1"
                class="dynamic-delete-button"
                @click="removeEditAnnotation(annotation)"
              />
            </div>
          </a-form-item>
          <a-form-item>
            <a-button type="dashed" @click="addEditAnnotation" class="add-dynamic-button">
              <PlusOutlined /> 添加注解
            </a-button>
          </a-form-item>
        </div>
      </a-form>
    </a-modal>

    <!-- 详情对话框 -->
    <a-modal
      :open="detailModalVisible"
      title="AlertRule详情"
      :width="previewDialogWidth"
      :footer="null"
      @cancel="closeDetailModal"
      class="detail-dialog"
    >
      <div v-if="currentRecord" class="pool-details">
        <div class="detail-header">
          <h2>{{ currentRecord.name }}</h2>
          <div class="detail-badges">
            <a-tag :class="['tech-tag', `severity-${severityText(currentRecord.severity)}`]">
              {{ severityLabel(currentRecord.severity) }}
            </a-tag>
            <a-tag :color="currentRecord.enable === 1 ? 'success' : 'default'">
              {{ currentRecord.enable === 1 ? '启用' : '禁用' }}
            </a-tag>
          </div>
        </div>

        <a-descriptions bordered :column="1" :label-style="{ width: '150px' }">
          <a-descriptions-item label="ID">{{ currentRecord.id }}</a-descriptions-item>
          <a-descriptions-item label="表达式">{{ currentRecord.expr }}</a-descriptions-item>
          <a-descriptions-item label="持续时间">{{ currentRecord.for_time }}</a-descriptions-item>
          <a-descriptions-item label="目标地址">{{ currentRecord.ip_address }}</a-descriptions-item>
          <a-descriptions-item label="实例池">
            {{ getPoolName(currentRecord.pool_id) }}
          </a-descriptions-item>
          <a-descriptions-item label="发送组">
            {{ getSendGroupName(currentRecord.send_group_id) }}
          </a-descriptions-item>
          <a-descriptions-item label="创建人">
            {{ currentRecord.create_user_name }}
          </a-descriptions-item>
          <a-descriptions-item label="创建时间">
            {{ formatFullDateTime(currentRecord.created_at) }}
          </a-descriptions-item>
        </a-descriptions>

        <div class="detail-footer">
          <a-button @click="closeDetailModal">关闭</a-button>
          <a-button type="primary" @click="showEditModal(currentRecord!)">编辑</a-button>
        </div>
      </div>
    </a-modal>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted, computed } from 'vue';
import { message, Modal } from 'ant-design-vue';
import { PlusOutlined, DownOutlined, MinusCircleOutlined } from '@ant-design/icons-vue';
import { Icon } from '@iconify/vue';
import { useDebounceFn } from '@vueuse/core';
import {
  getMonitorAlertRuleListApi,
  createMonitorAlertRuleApi,
  updateMonitorAlertRuleApi,
  deleteMonitorAlertRuleApi,
  promqlExprCheckApi,
  AlertRuleSeverity,
  type GetMonitorAlertRuleListReq,
  type MonitorAlertRule,
  type CreateMonitorAlertRuleReq,
  type UpdateMonitorAlertRuleReq,
} from '#/api/core/prometheus/prometheus_alert_rule';
import {
  getMonitorAlertManagerPoolListApi,
  getMonitorAlertManagerPoolApi,
  type MonitorAlertManagerPool,
} from '#/api/core/prometheus/prometheus_alert_pool';
import {
  getMonitorSendGroupListApi,
  getMonitorSendGroupDetailApi,
  type MonitorSendGroup,
} from '#/api/core/prometheus/prometheus_send_group';

const ENABLE_STATUS = {
  ENABLED: 1,
  DISABLED: 2,
} as const;

// --- 类型定义 ---
interface LabelOrAnnotationItem {
  key: number;
  labelKey: string;
  labelValue: string;
}

// --- 分页状态 ---
const poolPagination = reactive({
  current: 1,
  pageSize: 20,
  total: 0,
});

const sendGroupPagination = reactive({
  current: 1,
  pageSize: 20,
  total: 0,
});

const poolLoading = ref(false);
const sendGroupLoading = ref(false);

const createInitialForm = () => ({
  name: '',
  pool_id: undefined as number | undefined,
  send_group_id: undefined as number | undefined,
  ip: '',
  port: '',
  expr: '',
  severity: undefined as AlertRuleSeverity | undefined,
  for_time: '10s',
  labels: [{ key: Date.now(), labelKey: '', labelValue: '' }] as LabelOrAnnotationItem[],
  annotations: [{ key: Date.now(), labelKey: '', labelValue: '' }] as LabelOrAnnotationItem[],
  grafana_link: '',
});

const handleApiError = (error: any, defaultMessage: string) => {
  const errorMessage = error?.response?.data?.message || error.message || defaultMessage;
  message.error(errorMessage);
};

// --- 响应式状态 ---
const loading = ref(false);
const data = ref<MonitorAlertRule[]>([]);
const scrapePools = ref<MonitorAlertManagerPool[]>([]);
const sendGroups = ref<MonitorSendGroup[]>([]);
const addFormRef = ref();
const editFormRef = ref();
const currentRecord = ref<MonitorAlertRule | null>(null);

// --- 筛选与分页 ---
const searchParams = reactive({
  search: '',
  severity: undefined as AlertRuleSeverity | undefined,
  enable: undefined as number | undefined,
});

const paginationConfig = reactive({
  current: 1,
  pageSize: 10,
  total: 0,
  showSizeChanger: true,
  showQuickJumper: true,
  showTotal: (total: number) => `共 ${total} 条记录`,
  size: 'default' as const
});

// --- 统计数据 ---
const stats = computed(() => ({
  total: paginationConfig.total,
  critical: data.value.filter((item) => item.severity === AlertRuleSeverity.Critical).length,
  warning: data.value.filter((item) => item.severity === AlertRuleSeverity.Warning).length,
  enabled: data.value.filter((item) => item.enable === ENABLE_STATUS.ENABLED).length,
}));

// --- 模态框状态 ---
const isAddModalVisible = ref(false);
const isEditModalVisible = ref(false);
const detailModalVisible = ref(false);

// --- 表单 ---
const addForm = reactive(createInitialForm());

const editForm = reactive({
  id: 0,
  name: '',
  pool_id: undefined as number | undefined,
  send_group_id: undefined as number | undefined,
  ip: '',
  port: '',
  enableSwitch: true,
  expr: '',
  severity: undefined as AlertRuleSeverity | undefined,
  for_time: '',
  labels: [] as LabelOrAnnotationItem[],
  annotations: [] as LabelOrAnnotationItem[],
  grafana_link: '',
});

const formRules = {
  name: [{ required: true, message: '请输入名称', trigger: 'blur' }],
  pool_id: [{ required: true, message: '请选择所属实例池', trigger: 'change' }],
  ip_address: [
    {
      required: true,
      validator: () => {
        const form = isEditModalVisible.value ? editForm : addForm;
        if (!form.ip || !form.port) {
          return Promise.reject('请输入IP地址和端口');
        }
        return Promise.resolve();
      },
      trigger: 'blur',
    },
  ],
  expr: [{ required: true, message: '请输入PromQL表达式', trigger: 'blur' }],
  severity: [{ required: true, message: '请选择严重性', trigger: 'change' }],
  for_time: [{ required: true, message: '请输入持续时间', trigger: 'blur' }],
};

// --- 响应式布局 ---
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

// --- 列定义 ---
const columns = [
  { title: 'AlertRule名称', dataIndex: 'name', key: 'name', width: 200, fixed: 'left' },
  { title: '表达式', dataIndex: 'expr', key: 'expr', width: 250, ellipsis: true },
  { title: '严重性', dataIndex: 'severity', key: 'severity', width: 100, align: 'center' as const },
  { title: '启用状态', dataIndex: 'enable', key: 'enable', width: 100, align: 'center' as const },
  { title: '标签', dataIndex: 'labels', key: 'labels', width: 220 },
  { title: '注解', dataIndex: 'annotations', key: 'annotations', width: 220 },
  { title: '实例配置', key: 'pool_config', width: 180 },
  { title: '创建人', dataIndex: 'create_user_name', key: 'creator', width: 120 },
  { title: '创建时间', dataIndex: 'created_at', key: 'createdAt', width: 180 },
  { title: '操作', key: 'action', width: 200, align: 'center' as const, fixed: 'right' },
];

// --- 标签显示函数 ---
const getDisplayLabels = (labels: string[]) => {
  if (!labels || labels.length === 0 || labels[0] === '') return [];
  return labels.slice(0, 2);
};

const getDisplayAnnotations = (annotations: string[]) => {
  if (!annotations || annotations.length === 0 || annotations[0] === '') return [];
  return annotations.slice(0, 2);
};

// --- API 调用 ---
const fetchAlertRules = async () => {
  loading.value = true;
  try {
    const params: GetMonitorAlertRuleListReq = {
      page: paginationConfig.current,
      size: paginationConfig.pageSize,
      search: searchParams.search || undefined,
      severity: searchParams.severity,
      enable: searchParams.enable,
    };
    const response = await getMonitorAlertRuleListApi(params);
    data.value = response.items || [];
    paginationConfig.total = response.total || 0;
  } catch (error: any) {
    handleApiError(error, '加载告警规则列表失败');
  } finally {
    loading.value = false;
  }
};

const fetchScrapePools = async (page = 1, size = 20) => {
  poolLoading.value = true;
  try {
    const response = await getMonitorAlertManagerPoolListApi({ page, size });
    const items = response.items || [];
    if (page === 1) {
      scrapePools.value = items;
    } else {
      scrapePools.value.push(...items);
    }
    poolPagination.total = response.total || 0;
    poolPagination.current = page;
  } catch (error: any) {
    handleApiError(error, '获取实例池数据失败');
  } finally {
    poolLoading.value = false;
  }
};

const fetchSendGroups = async (page = 1, size = 20) => {
  sendGroupLoading.value = true;
  try {
    const response = await getMonitorSendGroupListApi({ page, size });
    const items = response.items || [];
    if (page === 1) {
      sendGroups.value = items;
    } else {
      sendGroups.value.push(...items);
    }
    sendGroupPagination.total = response.total || 0;
    sendGroupPagination.current = page;
  } catch (error: any) {
    handleApiError(error, '获取发送组数据失败');
  } finally {
    sendGroupLoading.value = false;
  }
};

// --- 分页处理 ---
const handlePoolScroll = (e: any) => {
  const { scrollTop, scrollHeight, clientHeight } = e.target;
  if (
    scrollTop + clientHeight >= scrollHeight - 10 &&
    !poolLoading.value &&
    scrapePools.value.length < poolPagination.total
  ) {
    fetchScrapePools(poolPagination.current + 1, poolPagination.pageSize);
  }
};

const handleSendGroupScroll = (e: any) => {
  const { scrollTop, scrollHeight, clientHeight } = e.target;
  if (
    scrollTop + clientHeight >= scrollHeight - 10 &&
    !sendGroupLoading.value &&
    sendGroups.value.length < sendGroupPagination.total
  ) {
    fetchSendGroups(sendGroupPagination.current + 1, sendGroupPagination.pageSize);
  }
};

const onPoolDropdownChange = (open: boolean) => {
  if (open && scrapePools.value.length === 0) {
    fetchScrapePools(1, poolPagination.pageSize);
  }
};

const onSendGroupDropdownChange = (open: boolean) => {
  if (open && sendGroups.value.length === 0) {
    fetchSendGroups(1, sendGroupPagination.pageSize);
  }
};

// --- 事件处理 ---
const handleTableChange = (pagination: { current: number; pageSize: number }) => {
  paginationConfig.current = pagination.current;
  paginationConfig.pageSize = pagination.pageSize;
  fetchAlertRules();
};

const handleSearch = useDebounceFn(() => {
  paginationConfig.current = 1;
  fetchAlertRules();
}, 300);

const handleReset = () => {
  searchParams.search = '';
  searchParams.severity = undefined;
  searchParams.enable = undefined;
  paginationConfig.current = 1;
  fetchAlertRules();
  message.success('筛选条件已重置');
};

const handleMenuClick = (key: string, record: MonitorAlertRule) => {
  if (key === 'delete' && record.id != null) {
    handleDelete(record.id);
  }
};

const handleDelete = (id: number) => {
  Modal.confirm({
    title: '确认删除',
    content: '您确定要删除这条告警规则吗？此操作不可撤销。',
    okText: '确认',
    cancelText: '取消',
    onOk: async () => {
      try {
        await deleteMonitorAlertRuleApi(id);
        message.success('删除成功');
        fetchAlertRules();
      } catch (error: any) {
        handleApiError(error, '删除失败');
      }
    },
  });
};

// --- 模态框操作 ---
const showAddModal = () => {
  resetAddForm();
  isAddModalVisible.value = true;
};

const closeAddModal = () => {
  isAddModalVisible.value = false;
};

const showEditModal = async (record: MonitorAlertRule) => {
  // --- 确保关联数据显示 ---
  // 确保关联的实例池在选项列表中，以便正确显示名称
  if (record.pool_id && !scrapePools.value.some((p) => p.id === record.pool_id)) {
    try {
      const pool = await getMonitorAlertManagerPoolApi(record.pool_id);
      if (pool) {
        // 使用 unshift 将其添加到列表开头，以便用户能立即看到
        scrapePools.value.unshift(pool);
      }
    } catch (error) {
      handleApiError(error, `加载实例池 ${record.pool_id} 详情失败`);
    }
  }

  // 确保关联的发送组在选项列表中
  if (record.send_group_id && !sendGroups.value.some((g) => g.id === record.send_group_id)) {
    try {
      const group = await getMonitorSendGroupDetailApi(record.send_group_id);
      if (group) {
        sendGroups.value.unshift(group);
      }
    } catch (error) {
      handleApiError(error, `加载发送组 ${record.send_group_id} 详情失败`);
    }
  }

  const [ip, port] = record.ip_address?.split(':') || ['', ''];
  const parseItems = (items: string[] | undefined) =>
    items?.length && items[0] !== ''
      ? items.map((item) => {
          const [labelKey, labelValue] = item.split(',');
          return { key: Date.now() + Math.random(), labelKey, labelValue };
        })
      : [{ key: Date.now(), labelKey: '', labelValue: '' }];

  Object.assign(editForm, {
    id: record.id,
    name: record.name,
    pool_id: record.pool_id,
    send_group_id: record.send_group_id,
    ip,
    port,
    enableSwitch: record.enable === ENABLE_STATUS.ENABLED,
    expr: record.expr,
    severity: record.severity,
    for_time: record.for_time,
    labels: parseItems(record.labels),
    annotations: parseItems(record.annotations),
    grafana_link: record.grafana_link || '',
  });
  isEditModalVisible.value = true;
  detailModalVisible.value = false;
};

const closeEditModal = () => {
  isEditModalVisible.value = false;
};

const showDetailModal = (record: MonitorAlertRule) => {
  currentRecord.value = record;
  detailModalVisible.value = true;
};

const closeDetailModal = () => {
  detailModalVisible.value = false;
  currentRecord.value = null;
};

// --- 表单操作 ---
const resetAddForm = () => {
  Object.assign(addForm, createInitialForm());
};

const formatItemsForApi = (items: LabelOrAnnotationItem[]) => {
  return items
    .filter((item) => item.labelKey && item.labelValue)
    .map((item) => `${item.labelKey},${item.labelValue}`);
};

const handleAdd = async () => {
  try {
    await addFormRef.value?.validate();
    const apiData: CreateMonitorAlertRuleReq = {
      ...addForm,
      ip_address: `${addForm.ip}:${addForm.port}`,
      pool_id: addForm.pool_id!,
      send_group_id: addForm.send_group_id!,
      severity: addForm.severity!,
      labels: formatItemsForApi(addForm.labels),
      annotations: formatItemsForApi(addForm.annotations),
      grafana_link: addForm.grafana_link,
    };
    await createMonitorAlertRuleApi(apiData);
    message.success('新增成功');
    closeAddModal();
    fetchAlertRules();
  } catch (error: any) {
    handleApiError(error, '操作失败');
  }
};

const handleEdit = async () => {
  try {
    await editFormRef.value?.validate();
    const apiData: UpdateMonitorAlertRuleReq = {
      ...editForm,
      ip_address: `${editForm.ip}:${editForm.port}`,
      enable: editForm.enableSwitch ? ENABLE_STATUS.ENABLED : ENABLE_STATUS.DISABLED,
      pool_id: editForm.pool_id!,
      send_group_id: editForm.send_group_id!,
      severity: editForm.severity!,
      labels: formatItemsForApi(editForm.labels),
      annotations: formatItemsForApi(editForm.annotations),
      grafana_link: editForm.grafana_link,
    };
    await updateMonitorAlertRuleApi(apiData);
    message.success('更新成功');
    closeEditModal();
    fetchAlertRules();
  } catch (error: any) {
    handleApiError(error, '操作失败');
  }
};

const validateExpression = async (expr: string) => {
  if (!expr) {
    message.warning('请输入表达式');
    return;
  }
  try {
    await promqlExprCheckApi({ promql_expr: expr });
    message.success('表达式验证通过');
  } catch (error: any) {
    handleApiError(error, '表达式验证失败');
  }
};

// --- 动态表单项 ---
const addLabel = () => addForm.labels.push({ key: Date.now(), labelKey: '', labelValue: '' });
const removeLabel = (item: LabelOrAnnotationItem) => {
  const index = addForm.labels.indexOf(item);
  if (index !== -1) addForm.labels.splice(index, 1);
};
const addAnnotation = () => addForm.annotations.push({ key: Date.now(), labelKey: '', labelValue: '' });
const removeAnnotation = (item: LabelOrAnnotationItem) => {
  const index = addForm.annotations.indexOf(item);
  if (index !== -1) addForm.annotations.splice(index, 1);
};
const addEditLabel = () => editForm.labels.push({ key: Date.now(), labelKey: '', labelValue: '' });
const removeEditLabel = (item: LabelOrAnnotationItem) => {
  const index = editForm.labels.indexOf(item);
  if (index !== -1) editForm.labels.splice(index, 1);
};
const addEditAnnotation = () => editForm.annotations.push({ key: Date.now(), labelKey: '', labelValue: '' });
const removeEditAnnotation = (item: LabelOrAnnotationItem) => {
  const index = editForm.annotations.indexOf(item);
  if (index !== -1) editForm.annotations.splice(index, 1);
};

const severityText = (severity: AlertRuleSeverity | undefined): 'critical' | 'warning' | 'info' => {
  if (severity === AlertRuleSeverity.Critical) return 'critical';
  if (severity === AlertRuleSeverity.Warning) return 'warning';
  return 'info';
};

const severityLabel = (severity: AlertRuleSeverity | undefined): string => {
  const text = severityText(severity);
  if (text === 'critical') return 'Critical';
  if (text === 'warning') return 'Warning';
  return 'Info';
};

const getAlertStatusClass = (record: MonitorAlertRule): string => {
  if (record.enable === ENABLE_STATUS.ENABLED && record.severity === AlertRuleSeverity.Critical) return 'status-critical';
  if (record.enable === ENABLE_STATUS.ENABLED && record.severity === AlertRuleSeverity.Warning) return 'status-warning';
  if (record.enable === ENABLE_STATUS.ENABLED) return 'status-enabled';
  return 'status-disabled';
};

const getPoolName = (poolId?: number) => 
  scrapePools.value.find((p) => p.id === poolId)?.name || `ID: ${poolId}`;

const getSendGroupName = (groupId?: number) => 
  sendGroups.value.find((g) => g.id === groupId)?.name || `ID: ${groupId}`;

const getAvatarColor = (name: string): string => {
  const colors = ['#1890ff', '#52c41a', '#faad14', '#f5222d', '#722ed1', '#13c2c2', '#eb2f96', '#fa8c16'];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length]!;
};

const getInitials = (name?: string): string => {
  if (!name) return '';
  return name.slice(0, 2).toUpperCase();
};

const formatDate = (dateString: string): string => {
  if (!dateString) return '';
  return new Date(dateString).toLocaleDateString('zh-CN');
};

const formatTime = (dateString: string): string => {
  if (!dateString) return '';
  return new Date(dateString).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
};

const formatFullDateTime = (dateString?: string): string => {
  if (!dateString) return '';
  return new Date(dateString).toLocaleString('zh-CN');
};

// --- 生命周期 ---
onMounted(() => {
  fetchAlertRules();
});
</script>

<style scoped>
.alert-rule-container {
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

.filter-select {
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

.rule-name-cell {
  display: flex;
  align-items: center;
  gap: 10px;
}

.rule-badge {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}

.status-critical {
  background-color: #cf1322;
}

.status-warning {
  background-color: #faad14;
}

.status-enabled {
  background-color: #52c41a;
}

.status-disabled {
  background-color: #d9d9d9;
}

.rule-name-text {
  font-weight: 500;
  word-break: break-all;
}

.expr-container {
  max-width: 250px;
  word-break: break-all;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  font-family: 'Monaco', 'Menlo', monospace;
  background: #f8f9fa;
  padding: 4px 8px;
  border-radius: 4px;
  border-left: 3px solid #1890ff;
}

.tag-container {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.tech-tag {
  display: inline-flex;
  align-items: center;
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 500;
  border: none;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.1);
}

.severity-critical {
  background-color: #fff1f0;
  color: #cf1322;
  border-left: 3px solid #ff4d4f;
}

.severity-warning {
  background-color: #fff7e6;
  color: #d46b08;
  border-left: 3px solid #fa8c16;
}

.severity-info {
  background-color: #e6f7ff;
  color: #0958d9;
  border-left: 3px solid #1890ff;
}

.label-tag {
  background-color: #f6ffed;
  color: #389e0d;
  border-left: 3px solid #52c41a;
}

.annotation-tag {
  background-color: #f0f5ff;
  color: #1d39c4;
  border-left: 3px solid #2f54eb;
}

.more-tag {
  background-color: #f5f5f5;
  color: #8c8c8c;
  border-left: 3px solid #d9d9d9;
  cursor: pointer;
}

.empty-text {
  color: #999;
  font-style: italic;
  font-size: 12px;
}

.label-key {
  font-weight: 600;
}

.label-separator {
  margin: 0 4px;
  color: #8c8c8c;
}

.label-value {
  color: #555;
}

.all-tags-container {
  max-width: 400px;
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.config-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.config-item {
  display: flex;
  align-items: center;
  gap: 4px;
}

.config-label {
  font-size: 12px;
  color: #666;
}

.config-value {
  font-size: 12px;
  font-weight: 500;
  color: #333;
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

/* 表单样式 */
.form-section {
  margin-bottom: 28px;
  padding: 0;
  position: relative;
}

.section-title {
  font-size: 16px;
  font-weight: 600;
  color: #1a1a1a;
  margin-bottom: 16px;
  padding-left: 12px;
  border-left: 4px solid #1890ff;
}

.full-width {
  width: 100%;
}

.tech-switch {
  background-color: rgba(0, 0, 0, 0.25);
}

.tech-switch.ant-switch-checked {
  background: linear-gradient(45deg, #1890ff, #36cfc9);
}

.dynamic-input-container {
  display: flex;
  align-items: center;
  gap: 12px;
}

.dynamic-input {
  width: 100%;
}

.dynamic-delete-button {
  cursor: pointer;
  color: #ff4d4f;
  font-size: 18px;
  transition: all 0.3s;
}

.dynamic-delete-button:hover {
  color: #cf1322;
  transform: scale(1.1);
}

.add-dynamic-button {
  width: 100%;
  margin-top: 8px;
  background: #f5f5f5;
  border: 1px dashed #d9d9d9;
  color: #595959;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
}

.add-dynamic-button:hover {
  color: #1890ff;
  border-color: #1890ff;
  background: #f0f7ff;
}

.label-input-group {
  display: flex;
  align-items: center;
  gap: 8px;
}

.label-key-input,
.label-value-input {
  flex: 1;
}

.label-separator {
  font-weight: bold;
  color: #8c8c8c;
}

.ip-port-container {
  display: flex;
  align-items: center;
  gap: 8px;
}

.ip-input {
  flex: 3;
}

.port-input {
  flex: 1;
}

.separator {
  font-weight: bold;
  color: #1890ff;
  font-size: 16px;
}

/* 详情对话框样式 */
.detail-dialog .pool-details {
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

.detail-badges {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.detail-footer {
  margin-top: 24px;
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  flex-wrap: wrap;
}

/* 响应式设计 */
@media (max-width: 768px) {
  .alert-rule-container {
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

  .filter-select {
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

  .detail-footer {
    justify-content: center;
  }

  .detail-footer .ant-btn {
    flex: 1;
    max-width: 120px;
  }
}

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
</style>
