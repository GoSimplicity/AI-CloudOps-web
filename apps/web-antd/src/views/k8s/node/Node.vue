<template>
  <div class="k8s-management-container">
    <!-- 页面头部 -->
    <div class="k8s-page-header">
      <a-row class="k8s-header-content" :gutter="[24, 16]">
        <a-col :xs="24" :sm="24" :md="16" :lg="16" :xl="18">
          <div class="k8s-title-section">
            <div class="k8s-page-title">
              <NodeIndexOutlined class="k8s-title-icon" />
              <div>
                <h1>节点管理</h1>
                <p class="k8s-page-subtitle">管理和监控集群中的所有 Kubernetes 节点</p>
              </div>
            </div>
          </div>
        </a-col>
        <a-col :xs="24" :sm="24" :md="8" :lg="8" :xl="6">
          <div class="k8s-header-actions">
            <a-button @click="fetchNodes" :loading="loading">
              <template #icon><ReloadOutlined /></template>
              刷新数据
            </a-button>
          </div>
        </a-col>
      </a-row>
    </div>

    <!-- 工具栏 -->
    <div class="k8s-toolbar">
      <!-- 筛选和搜索区域 -->
      <div class="k8s-toolbar-filters">
        <div class="k8s-filter-group">
          <a-select 
            v-model:value="filterClusterId" 
            placeholder="选择集群" 
            class="k8s-cluster-selector" 
            allow-clear 
            @change="handleClusterChange"
            :loading="clustersLoading"
            :disabled="clustersLoading"
            @popup-scroll="handleClusterDropdownScroll"
          >
            <template #suffixIcon><DeploymentUnitOutlined /></template>
            <a-select-option v-for="cluster in clusters" :key="cluster.id" :value="cluster.id">
              <div style="display: flex; align-items: center; justify-content: space-between;">
                <span>{{ cluster.name }}</span>
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
            v-model:value="filterStatus" 
            placeholder="状态筛选" 
            class="k8s-filter-select" 
            allow-clear 
            @change="handleFilterChange"
          >
            <template #suffixIcon><FilterOutlined /></template>
            <a-select-option :value="NodeStatus.Ready">就绪</a-select-option>
            <a-select-option :value="NodeStatus.NotReady">未就绪</a-select-option>
            <a-select-option :value="NodeStatus.SchedulingDisabled">调度禁用</a-select-option>
            <a-select-option :value="NodeStatus.Unknown">未知</a-select-option>
            <a-select-option :value="NodeStatus.Error">异常</a-select-option>
          </a-select>
        </div>
        
        <div class="k8s-search-group">
          <a-input 
            v-model:value="searchText" 
            placeholder="搜索节点名称" 
            class="k8s-search-input" 
            @pressEnter="onSearch"
            @input="onSearch"
            allow-clear 
          >
            <template #suffix>
              <SearchOutlined class="k8s-search-icon" />
            </template>
          </a-input>
        </div>
      </div>
      
      <!-- 操作区域 -->
      <div class="k8s-toolbar-actions">
        <div class="k8s-action-buttons">
          <a-button 
            @click="resetFilters" 
            :disabled="!filterClusterId && !filterStatus && !searchText"
            class="k8s-toolbar-btn"
            title="重置所有筛选条件"
          >
            <template #icon><DeleteOutlined /></template>
            重置筛选
          </a-button>
          
          <a-button 
            @click="fetchNodes" 
            :loading="loading"
            class="k8s-toolbar-btn"
            title="刷新数据"
          >
            <template #icon><ReloadOutlined /></template>
            刷新
          </a-button>
          
          <a-button 
            type="primary" 
            danger 
            @click="() => batchOperation('禁用调度')" 
            :disabled="!selectedRows.length" 
            v-if="selectedRows.length > 0"
            class="k8s-toolbar-btn"
            title="批量禁用调度"
          >
            <template #icon><StopOutlined /></template>
            批量操作 ({{ selectedRows.length }})
          </a-button>
        </div>
      </div>
    </div>

    <!-- 数据展示区域 -->
    <div class="k8s-data-display">
      <a-table
        :columns="columns"
        :data-source="filteredNodes"
        :row-selection="rowSelection"
        :loading="loading"
        row-key="name"
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
        class="k8s-table"
        :scroll="{ x: 1200 }"
      >
        <template #status="{ text }">
          <a-badge :status="getStatusColor(text)" :text="getStatusText(text)" />
        </template>

        <template #schedulable="{ text }">
          <a-badge :status="getSchedulableColor(text)" :text="getSchedulableText(text)" />
        </template>

        <template #roles="{ text }">
          <div class="k8s-roles-display">
            <a-tooltip v-for="role in (text || []).slice(0, 3)" :key="role" :title="role">
              <a-tag class="k8s-role-tag">
                {{ role }}
              </a-tag>
            </a-tooltip>
            <a-tooltip v-if="(text || []).length > 3" :title="(text || []).join(', ')">
              <a-tag class="k8s-role-tag">
                {{ (text || []).length }} 个角色
              </a-tag>
            </a-tooltip>
            <span v-if="!text || text.length === 0" class="k8s-no-data">-</span>
          </div>
        </template>

        <template #labels="{ text }">
          <div class="k8s-labels-display">
            <a-tooltip v-for="[key, value] in Object.entries(text || {}).slice(0, 3)" :key="key" :title="`${key}: ${value}`">
              <a-tag class="k8s-label-item">
                {{ key }}: {{ value }}
              </a-tag>
            </a-tooltip>
            <a-tooltip v-if="Object.keys(text || {}).length > 3" :title="Object.entries(text || {}).map(([k, v]: any) => `${k}: ${v}`).join('\n')">
              <a-tag class="k8s-label-item">
                {{ Object.keys(text || {}).length }} 个标签
              </a-tag>
            </a-tooltip>
            <span v-if="!text || Object.keys(text).length === 0" class="k8s-no-data">-</span>
          </div>
        </template>

        <template #taints="{ text }">
          <div class="k8s-taints-display">
            <a-tag v-for="taint in (text || []).slice(0, 2)" :key="taint.key" class="k8s-taint-item">
              {{ taint.key }}:{{ taint.effect }}
            </a-tag>
            <a-tooltip v-if="(text || []).length > 2" :title="(text || []).map((t: CoreTaint) => `${t.key}:${t.effect}`).join('\n')">
              <a-tag class="k8s-taint-item">
                +{{ (text || []).length - 2 }} 更多
              </a-tag>
            </a-tooltip>
            <span v-if="!text || text.length === 0" class="k8s-no-data">-</span>
          </div>
        </template>

        <template #actions="{ record }">
          <div class="k8s-action-column">
            <a-tooltip title="查看详情">
              <a-button title="查看详情" @click="showNodeDetail(record)">
                <template #icon><EyeOutlined /></template>
              </a-button>
            </a-tooltip>
            <a-tooltip title="管理标签">
              <a-button title="管理标签" @click="openEditLabelModal(record)">
                <template #icon><TagsOutlined /></template>
              </a-button>
            </a-tooltip>
            <a-tooltip title="管理污点">
              <a-button title="管理污点" @click="openTaintModal(record)">
                <template #icon><WarningOutlined /></template>
              </a-button>
            </a-tooltip>
            <a-tooltip :title="record.schedulable === 1 ? '禁用调度' : '启用调度'">
              <a-button 
                :title="record.schedulable === 1 ? '禁用调度' : '启用调度'"
                @click="toggleNodeSchedule(record)"
              >
                <template #icon>
                  <StopOutlined v-if="record.schedulable === 1" />
                  <PlayCircleOutlined v-else />
                </template>
              </a-button>
            </a-tooltip>
            <a-tooltip title="驱逐节点">
              <a-button title="驱逐" danger @click="openDrainModal(record)">
                <template #icon><DisconnectOutlined /></template>
              </a-button>
            </a-tooltip>
          </div>
        </template>

        <template #emptyText>
          <div class="k8s-empty-state">
            <NodeIndexOutlined />
            <p>暂无节点数据</p>
            <p>请先选择集群</p>
          </div>
        </template>
      </a-table>
    </div>

    <!-- 标签管理模态框 -->
    <a-modal
      v-model:open="isLabelModalVisible"
      title="管理节点标签"
      @ok="submitLabelForm"
      @cancel="closeLabelModal"
      :confirmLoading="submitLoading"
      width="800px"
      :maskClosable="false"
      destroyOnClose
      okText="保存"
      cancelText="取消"
    >
      <a-form 
        ref="labelFormRef"
        :model="labelFormModel" 
        layout="vertical" 
        class="k8s-form"
        :rules="labelFormRules"
      >
        <a-form-item label="标签配置">
          <a-form-item-rest>
            <div class="k8s-key-value-inputs">
              <div v-if="!labelFormModel.labels || Object.keys(labelFormModel.labels).length === 0" style="text-align: center; color: #999; padding: 20px;">
                暂无标签，点击下方按钮添加
              </div>
              <div v-for="(_, key) in labelFormModel.labels" :key="key" class="k8s-key-value-row">
                <a-input 
                  :value="key" 
                  :placeholder="`标签键: ${key}`" 
                  disabled
                  class="k8s-form-input k8s-key-input"
                />
                <a-input 
                  v-model:value="labelFormModel.labels[key]" 
                  placeholder="标签值" 
                  class="k8s-form-input k8s-value-input"
                  :maxlength="200"
                />
                <a-button type="text" danger @click="removeLabelField(key)" class="k8s-remove-btn">
                  <template #icon><DeleteOutlined /></template>
                  删除
                </a-button>
              </div>
              <div class="k8s-add-input-row" style="margin-top: 12px;">
                <a-input
                  v-model:value="newLabelKey"
                  placeholder="输入标签键"
                  style="flex: 1; margin-right: 8px;"
                  @press-enter="addNewLabel"
                />
                <a-button type="primary" @click="addNewLabel" :disabled="!newLabelKey.trim()">
                  <template #icon><PlusOutlined /></template>
                  添加
                </a-button>
              </div>
            </div>
          </a-form-item-rest>
        </a-form-item>
      </a-form>
    </a-modal>

    <!-- 污点管理模态框 -->
    <a-modal
      v-model:open="isTaintModalVisible"
      title="管理节点污点"
      @ok="submitTaintForm"
      @cancel="closeTaintModal"
      :confirmLoading="submitLoading"
      width="800px"
      :maskClosable="false"
      destroyOnClose
      okText="保存"
      cancelText="取消"
    >
      <a-form 
        ref="taintFormRef"
        :model="taintFormModel" 
        layout="vertical" 
        class="k8s-form"
        :rules="taintFormRules"
      >
        <a-form-item label="污点配置">
          <a-form-item-rest>
            <div class="k8s-key-value-inputs">
              <div v-if="!taintFormModel.taints || taintFormModel.taints.length === 0" style="text-align: center; color: #999; padding: 20px;">
                暂无污点，点击下方按钮添加
              </div>
              <div v-for="(taint, idx) in taintFormModel.taints" :key="idx" class="k8s-key-value-row">
                <a-input 
                  v-model:value="taint.key" 
                  placeholder="污点键" 
                  class="k8s-form-input"
                  :maxlength="100"
                />
                <a-input 
                  v-model:value="taint.value" 
                  placeholder="污点值（可选）" 
                  class="k8s-form-input"
                  :maxlength="100"
                />
                <a-select 
                  v-model:value="taint.effect" 
                  placeholder="污点效果" 
                  class="k8s-form-input"
                  style="width: 150px"
                >
                  <a-select-option value="NoSchedule">NoSchedule</a-select-option>
                  <a-select-option value="PreferNoSchedule">PreferNoSchedule</a-select-option>
                  <a-select-option value="NoExecute">NoExecute</a-select-option>
                </a-select>
                <a-button type="text" danger @click="removeTaint(idx)" class="k8s-remove-btn">
                  <template #icon><DeleteOutlined /></template>
                  删除
                </a-button>
              </div>
              <a-button type="dashed" @click="addTaint" block style="margin-top: 12px;">
                <template #icon><PlusOutlined /></template>
                添加污点
              </a-button>
            </div>
          </a-form-item-rest>
        </a-form-item>
      </a-form>
    </a-modal>

    <!-- 驱逐节点模态框 -->
    <a-modal
      v-model:open="isDrainModalVisible"
      title="驱逐节点"
      @ok="submitDrainForm"
      @cancel="closeDrainModal"
      :confirmLoading="submitLoading"
      width="600px"
      :maskClosable="false"
      destroyOnClose
      okText="确认驱逐"
      cancelText="取消"
    >
      <a-form 
        ref="drainFormRef"
        :model="drainFormModel" 
        layout="vertical" 
        class="k8s-form"
        :rules="drainFormRules"
      >
        <a-alert 
          message="警告：驱逐节点将强制迁移该节点上的所有Pod" 
          description="请谨慎操作，确保业务可以承受Pod迁移带来的影响。建议在维护窗口期间执行此操作。" 
          type="warning" 
          show-icon 
          style="margin-bottom: 20px;" 
        />

        <a-row :gutter="16">
          <a-col :xs="24" :sm="12">
            <a-form-item label="强制驱逐" name="force">
              <a-radio-group v-model:value="drainFormModel.force">
                <a-radio :value="1">是</a-radio>
                <a-radio :value="2">否</a-radio>
              </a-radio-group>
              <div style="color: #999; font-size: 12px; margin-top: 4px;">强制驱逐将忽略PodDisruptionBudget</div>
            </a-form-item>
          </a-col>
          <a-col :xs="24" :sm="12">
            <a-form-item label="忽略DaemonSet" name="ignore_daemon_sets">
              <a-radio-group v-model:value="drainFormModel.ignore_daemon_sets">
                <a-radio :value="1">是</a-radio>
                <a-radio :value="2">否</a-radio>
              </a-radio-group>
              <div style="color: #999; font-size: 12px; margin-top: 4px;">建议选择"是"</div>
            </a-form-item>
          </a-col>
        </a-row>

        <a-row :gutter="16">
          <a-col :xs="24" :sm="12">
            <a-form-item label="删除本地数据" name="delete_local_data">
              <a-radio-group v-model:value="drainFormModel.delete_local_data">
                <a-radio :value="1">是</a-radio>
                <a-radio :value="2">否</a-radio>
              </a-radio-group>
              <div style="color: #999; font-size: 12px; margin-top: 4px;">删除使用emptyDir的Pod</div>
            </a-form-item>
          </a-col>
          <a-col :xs="24" :sm="12">
            <a-form-item label="优雅关闭时间(秒)" name="grace_period_seconds">
              <a-input-number
                v-model:value="drainFormModel.grace_period_seconds"
                :min="0"
                :max="3600"
                :step="10"
                class="k8s-form-input"
                placeholder="30"
                style="width: 100%"
              />
            </a-form-item>
          </a-col>
        </a-row>

        <a-form-item label="超时时间(秒)" name="timeout_seconds">
          <a-input-number
            v-model:value="drainFormModel.timeout_seconds"
            :min="30"
            :max="7200"
            :step="30"
            class="k8s-form-input"
            placeholder="300"
            style="width: 100%"
          />
          <div style="color: #999; font-size: 12px; margin-top: 4px;">驱逐操作的最大等待时间</div>
        </a-form-item>
      </a-form>
    </a-modal>

    <!-- 详情模态框 -->
    <a-modal
      v-model:open="isDetailModalVisible"
      title="节点详情"
      :footer="null"
      @cancel="closeDetailModal"
      width="1000px"
      :maskClosable="false"
      destroyOnClose
    >
      <a-spin :spinning="detailLoading">
        <div v-if="currentNodeDetail" class="k8s-detail-content">
          <a-row :gutter="[24, 16]">
            <a-col :xs="24" :lg="12">
              <a-card title="基本信息" class="k8s-detail-card" size="small">
                <div class="k8s-detail-item">
                  <span class="k8s-detail-label">节点名称:</span>
                  <span class="k8s-detail-value">{{ currentNodeDetail.name }}</span>
                </div>
                <div class="k8s-detail-item">
                  <span class="k8s-detail-label">状态:</span>
                  <a-badge :status="getStatusColor(currentNodeDetail.status)" :text="getStatusText(currentNodeDetail.status)" />
                </div>
                <div class="k8s-detail-item">
                  <span class="k8s-detail-label">调度状态:</span>
                  <a-badge :status="getSchedulableColor(currentNodeDetail.schedulable)" :text="getSchedulableText(currentNodeDetail.schedulable)" />
                </div>
                <div class="k8s-detail-item">
                  <span class="k8s-detail-label">角色:</span>
                  <span class="k8s-detail-value">{{ (currentNodeDetail.roles || []).join(', ') || '-' }}</span>
                </div>
                <div class="k8s-detail-item">
                  <span class="k8s-detail-label">存在时间:</span>
                  <span class="k8s-detail-value">{{ currentNodeDetail.age || '-' }}</span>
                </div>
                <div class="k8s-detail-item">
                  <span class="k8s-detail-label">内部IP:</span>
                  <span class="k8s-detail-value">{{ currentNodeDetail.internal_ip || '-' }}</span>
                </div>
                <div class="k8s-detail-item">
                  <span class="k8s-detail-label">外部IP:</span>
                  <span class="k8s-detail-value">{{ currentNodeDetail.external_ip || '-' }}</span>
                </div>
                <div class="k8s-detail-item">
                  <span class="k8s-detail-label">主机名:</span>
                  <span class="k8s-detail-value">{{ currentNodeDetail.hostname || '-' }}</span>
                </div>
              </a-card>
            </a-col>
            
            <a-col :xs="24" :lg="12">
              <a-card title="系统信息" class="k8s-detail-card" size="small">
                <div class="k8s-detail-item">
                  <span class="k8s-detail-label">Kubelet版本:</span>
                  <span class="k8s-detail-value">{{ currentNodeDetail.kubelet_version || '-' }}</span>
                </div>
                <div class="k8s-detail-item">
                  <span class="k8s-detail-label">KubeProxy版本:</span>
                  <span class="k8s-detail-value">{{ currentNodeDetail.kube_proxy_version || '-' }}</span>
                </div>
                <div class="k8s-detail-item">
                  <span class="k8s-detail-label">容器运行时:</span>
                  <span class="k8s-detail-value">{{ currentNodeDetail.container_runtime || '-' }}</span>
                </div>
                <div class="k8s-detail-item">
                  <span class="k8s-detail-label">操作系统:</span>
                  <span class="k8s-detail-value">{{ currentNodeDetail.operating_system || '-' }}</span>
                </div>
                <div class="k8s-detail-item">
                  <span class="k8s-detail-label">系统架构:</span>
                  <span class="k8s-detail-value">{{ currentNodeDetail.architecture || '-' }}</span>
                </div>
                <div class="k8s-detail-item">
                  <span class="k8s-detail-label">内核版本:</span>
                  <span class="k8s-detail-value">{{ currentNodeDetail.kernel_version || '-' }}</span>
                </div>
                <div class="k8s-detail-item">
                  <span class="k8s-detail-label">系统镜像:</span>
                  <span class="k8s-detail-value">{{ currentNodeDetail.os_image || '-' }}</span>
                </div>
              </a-card>
            </a-col>
          </a-row>

          <a-row :gutter="[24, 16]" style="margin-top: 16px;">
            <a-col :xs="24" :lg="12">
              <a-card title="标签信息" class="k8s-detail-card" size="small">
                <div class="k8s-labels-display">
                  <a-tooltip v-for="(value, key) in (currentNodeDetail.labels || {})" :key="key" :title="`${key}: ${value}`">
                    <div class="k8s-label-item" style="margin-bottom: 8px;">
                      {{ key }}: {{ value }}
                    </div>
                  </a-tooltip>
                  <span v-if="!currentNodeDetail.labels || Object.keys(currentNodeDetail.labels).length === 0" class="k8s-no-data">
                    暂无标签
                  </span>
                </div>
              </a-card>
            </a-col>
            
            <a-col :xs="24" :lg="12">
              <a-card title="污点信息" class="k8s-detail-card" size="small">
                <div class="k8s-taints-display">
                  <div v-for="taint in (currentNodeDetail.taints || [])" :key="taint.key" class="k8s-taint-item" style="margin-bottom: 8px;">
                    {{ taint.key }}:{{ taint.effect }}
                    <span v-if="taint.value">({{ taint.value }})</span>
                  </div>
                  <span v-if="!currentNodeDetail.taints || currentNodeDetail.taints.length === 0" class="k8s-no-data">
                    暂无污点
                  </span>
                </div>
              </a-card>
            </a-col>
          </a-row>

          <a-row style="margin-top: 16px;">
            <a-col :span="24">
              <a-card title="节点条件" class="k8s-detail-card" size="small">
                <a-table 
                  :columns="conditionColumns" 
                  :data-source="currentNodeDetail.conditions || []" 
                  :pagination="false"
                  size="small"
                  row-key="type"
                  :scroll="{ x: 800 }"
                >
                  <template #status="{ text }">
                    <a-badge :status="text === 'True' ? 'success' : 'error'" :text="text" />
                  </template>
                </a-table>
              </a-card>
            </a-col>
          </a-row>
        </div>
      </a-spin>
    </a-modal>

  </div>
</template>

<script lang="ts" setup>
import { onMounted, ref } from 'vue';
import { message } from 'ant-design-vue';
import { useNodePage } from './Node';
import type { CoreTaint } from '#/api/core/k8s/k8s_node';
import { 
  PlusOutlined, 
  ReloadOutlined, 
  FilterOutlined, 
  DeleteOutlined, 
  NodeIndexOutlined,
  EyeOutlined,
  TagsOutlined,
  WarningOutlined,
  StopOutlined,
  PlayCircleOutlined,
  DisconnectOutlined,
  DeploymentUnitOutlined,
  SearchOutlined,
} from '@ant-design/icons-vue';

const {
  // state
  clusters,
  loading,
  clustersLoading,
  searchText,
  filterStatus,
  filterClusterId,
  selectedRows,
  currentPage,
  pageSize,
  
  // modal state
  isLabelModalVisible,
  isTaintModalVisible,
  isDrainModalVisible,
  submitLoading,
  
  // detail modal
  isDetailModalVisible,
  detailLoading,
  currentNodeDetail,
  
  // form models
  labelFormModel,
  taintFormModel,
  drainFormModel,
  
  // form refs
  labelFormRef,
  taintFormRef,
  drainFormRef,
  
  // form rules
  labelFormRules,
  taintFormRules,
  drainFormRules,
  
  // computed
  filteredNodes,
  rowSelection,
  
  // helpers
  getEnvText,
  getStatusText,
  getStatusColor,
  getSchedulableText,
  getSchedulableColor,
  
  // operations
  fetchClusters,
  fetchNodes,
  clearNodes,
  showNodeDetail,
  closeDetailModal,
  
  // label operations
  openEditLabelModal,
  closeLabelModal,
  submitLabelForm,
  removeLabelField,
  
  // taint operations
  openTaintModal,
  closeTaintModal,
  addTaint,
  removeTaint,
  submitTaintForm,
  
  // schedule operations
  toggleNodeSchedule,
  
  // drain operations
  openDrainModal,
  closeDrainModal,
  submitDrainForm,
  
  // batch operations
  batchOperation,
  
  // cluster pagination
  loadMoreClusters,
  handlePageChange,
  
  // pagination state
  total,
  clustersTotal,
  
  // constants
  NodeStatus,
} = useNodePage();

// 添加新标签的临时状态
const newLabelKey = ref('');
const newLabelValue = ref('');

const addNewLabel = () => {
  if (!newLabelKey.value || !newLabelKey.value.trim()) return;
  const key = newLabelKey.value.trim();
  const value = newLabelValue.value || '';
  
  // 先获取所有现有的键，然后重建对象确保新键在最后
  const existingKeys = Object.keys(labelFormModel.value.labels);
  const newLabels: Record<string, string> = {};
  
  // 先添加所有现有的标签（排除要添加的键，以防重复）
  existingKeys.forEach(k => {
    if (k !== key) {
      newLabels[k] = labelFormModel.value.labels[k] || '';
    }
  });
  
  // 最后添加新标签
  newLabels[key] = value;
  
  labelFormModel.value.labels = newLabels;
  newLabelKey.value = '';
  newLabelValue.value = '';
};

const onSearch = () => {
  currentPage.value = 1;
  fetchNodes();
};

const handleFilterChange = () => {
  currentPage.value = 1;
  fetchNodes();
};

// 重置所有筛选条件
const resetFilters = () => {
  filterStatus.value = undefined;
  filterClusterId.value = undefined;
  searchText.value = '';
  currentPage.value = 1;
  // 清空节点列表
  clearNodes();
  message.success('已重置所有筛选条件');
};

const handleClusterChange = () => {
  currentPage.value = 1;
  if (filterClusterId.value) {
    const selectedCluster = clusters.value.find(c => c.id === filterClusterId.value);
    if (selectedCluster) {
      message.info(`已切换到集群: ${selectedCluster.name}`);
    }
    fetchNodes();
  } else {
    // 清空节点列表和选择状态
    clearNodes();
    message.info('已清空节点列表，请选择集群查看节点');
  }
};

const handleTableChange = (pagination: { current?: number; pageSize?: number }) => {
  if (pagination) {
    handlePageChange(pagination.current || currentPage.value, pagination.pageSize);
  }
};

// 已弃用的函数：分页组件统一通过 handleTableChange 处理

// 处理集群下拉选择的滚动事件
const handleClusterDropdownScroll = (e: Event) => {
  const { target } = e;
  if (target && 'scrollTop' in target && 'scrollHeight' in target && 'clientHeight' in target) {
    const scrollTarget = target as HTMLElement;
    // 当滚动到底部附近时加载更多
    if (scrollTarget.scrollTop + scrollTarget.clientHeight >= scrollTarget.scrollHeight - 5) {
      loadMoreClusters();
    }
  }
};

const columns = [
  { title: '节点名称', dataIndex: 'name', key: 'name', width: '15%', ellipsis: true },
  { title: '状态', dataIndex: 'status', key: 'status', width: '8%', slots: { customRender: 'status' } },
  { title: '调度状态', dataIndex: 'schedulable', key: 'schedulable', width: '8%', slots: { customRender: 'schedulable' } },
  { title: '角色', dataIndex: 'roles', key: 'roles', width: '10%', slots: { customRender: 'roles' } },
  { title: '存在时间', dataIndex: 'age', key: 'age', width: '8%' },
  { title: '内部IP', dataIndex: 'internal_ip', key: 'internal_ip', width: '12%' },
  { title: 'Kubelet版本', dataIndex: 'kubelet_version', key: 'kubelet_version', width: '10%' },
  { title: '标签', dataIndex: 'labels', key: 'labels', width: '12%', slots: { customRender: 'labels' } },
  { title: '污点', dataIndex: 'taints', key: 'taints', width: '10%', slots: { customRender: 'taints' } },
  { title: '操作', key: 'actions', width: '17%', fixed: 'right', slots: { customRender: 'actions' } },
];

const conditionColumns = [
  { title: '类型', dataIndex: 'type', key: 'type' },
  { title: '状态', dataIndex: 'status', key: 'status', slots: { customRender: 'status' } },
  { title: '原因', dataIndex: 'reason', key: 'reason' },
  { title: '消息', dataIndex: 'message', key: 'message', ellipsis: true },
  { title: '最后转换时间', dataIndex: 'lastTransitionTime', key: 'lastTransitionTime' },
];

onMounted(async () => {
  // 页面加载时首先获取集群列表
  await fetchClusters();
});
</script>

<style scoped>
@import '../shared/k8s-common.css';
</style>

<style scoped src="./Node.css"></style>
