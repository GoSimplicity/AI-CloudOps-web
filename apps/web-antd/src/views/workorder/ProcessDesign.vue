<template>
  <div class="process-design-engine">
    <div class="edit-mode-tabs">
      <a-tabs v-model:activeKey="editMode" type="card">
        <a-tab-pane key="basic" tab="基本信息">
          <div class="basic-info-form">
            <a-form layout="vertical" :model="processBasicInfo">
              <a-row :gutter="16">
                <a-col :span="12">
                  <a-form-item label="流程名称" required>
                    <a-input v-model:value="processBasicInfo.name" placeholder="请输入流程名称" />
                  </a-form-item>
                </a-col>
                <a-col :span="12">
                  <a-form-item label="关联表单" required>
                    <a-select v-model:value="processBasicInfo.form_design_id" placeholder="选择关联表单" :loading="loading">
                      <a-select-option v-for="form in formDesigns" :key="form.id" :value="form.id">
                        {{ form.name }}
                      </a-select-option>
                    </a-select>
                    <div class="field-hint">
                      <InfoCircleOutlined /> 只能选择已发布的表单设计
                    </div>
                  </a-form-item>
                </a-col>
              </a-row>

              <a-row :gutter="16">
                <a-col :span="12">
                  <a-form-item label="分类">
                    <a-select v-model:value="processBasicInfo.category_id" placeholder="选择分类" allow-clear
                      :loading="loading">
                      <a-select-option v-for="category in categories" :key="category.id" :value="category.id">
                        {{ category.name }}
                      </a-select-option>
                    </a-select>
                  </a-form-item>
                </a-col>
                <a-col :span="12">
                  <a-form-item label="状态">
                    <a-select v-model:value="processBasicInfo.status" placeholder="选择状态">
                      <a-select-option :value="ProcessStatus.Draft">草稿</a-select-option>
                      <a-select-option :value="ProcessStatus.Published">已发布</a-select-option>
                    </a-select>
                  </a-form-item>
                </a-col>
              </a-row>

              <a-form-item label="描述">
                <a-textarea v-model:value="processBasicInfo.description" placeholder="请输入流程描述" :rows="3" />
              </a-form-item>

              <a-form-item label="标签">
                <a-select v-model:value="processBasicInfo.tags" mode="tags" placeholder="输入标签，按回车添加"
                  style="width: 100%" />
              </a-form-item>

              <a-form-item label="设为默认流程">
                <a-radio-group v-model:value="processBasicInfo.is_default">
                  <a-radio :value="1">是</a-radio>
                  <a-radio :value="2">否</a-radio>
                </a-radio-group>
              </a-form-item>

              <div class="form-actions">
                <a-space>
                  <a-button type="primary" @click="saveProcess" :loading="loading">
                    <SaveOutlined /> 保存流程
                  </a-button>
                  <a-button @click="copyProcessJson">
                    <CopyOutlined /> 复制JSON
                  </a-button>
                </a-space>
              </div>
            </a-form>
          </div>
        </a-tab-pane>

        <a-tab-pane key="visual" tab="可视化设计">
          <div class="visual-designer">
            <div class="designer-toolbar">
              <a-space>
                <a-button type="primary" @click="addProcessStep">
                  <PlusOutlined /> 添加步骤
                </a-button>
                <a-button @click="previewFlow">
                  <EyeOutlined /> 预览流程
                </a-button>
                <a-button @click="validateFlow">
                  <CheckCircleOutlined /> 验证流程
                </a-button>
              </a-space>
            </div>

            <div class="-canvas">
              <div v-if="processSteps.length === 0" class="empty-canvas">
                <a-empty description="暂无流程步骤" :image="emptyImage">
                  <a-button type="primary" @click="addProcessStep">
                    开始设计流程
                  </a-button>
                </a-empty>
              </div>

              <div v-else class="steps-">
                <div v-for="(step, index) in sortedProcessSteps" :key="step.id" class="step-container">
                  <div class="-step" :class="{ 'active': selectedStep?.id === step.id }"
                    @click="selectStepById(step.id)">
                    <div class="step-header">
                      <div class="step-icon" :class="getStepTypeClass(step.type)">
                        <component :is="getStepIcon(step.type)" />
                      </div>
                      <div class="step-info">
                        <div class="step-title">{{ step.name || `步骤 ${index + 1}` }}</div>
                        <div class="step-type">{{ getStepTypeText(step.type) }}</div>
                      </div>
                      <div class="step-actions">
                        <a-button type="text" size="small" danger @click.stop="removeStepById(step.id)" title="删除">
                          <DeleteOutlined />
                        </a-button>
                      </div>
                    </div>

                    <div v-if="step.assignee_type && step.assignee_ids?.length" class="step-assignees">
                      <a-tag size="small" color="blue">
                        {{ getAssigneeTypeText(step.assignee_type) }}: {{ step.assignee_ids.length }}人
                      </a-tag>
                    </div>

                    <div v-if="step.actions?.length" class="step-actions-list">
                      <a-tag v-for="action in step.actions" :key="action" size="small" color="green">
                        {{ getActionText(action) }}
                      </a-tag>
                    </div>
                  </div>

                  <div v-if="getOutgoingConnections(step.id).length > 0" class="step-connections-display">
                    <div class="connector-arrow">
                      <ArrowDownOutlined />
                    </div>
                    <div class="connection-tags">
                      <a-tag v-for="conn in getOutgoingConnections(step.id)" :key="conn.to" color="purple">
                        连接到: {{ getStepNameById(conn.to) || '未知步骤' }}
                      </a-tag>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div v-if="selectedStep" class="step-detail-panel">
              <a-card :title="`编辑步骤: ${selectedStep.name || '未命名'}`" size="small">
                <template #extra>
                  <a-button type="text" size="small" @click="selectedStepIndex = null">
                    <CloseOutlined />
                  </a-button>
                </template>

                <a-form layout="vertical" :model="selectedStep">
                  <a-row :gutter="16">
                    <a-col :span="12">
                      <a-form-item label="步骤名称">
                        <a-input v-model:value="selectedStep.name" placeholder="请输入步骤名称" />
                      </a-form-item>
                    </a-col>
                    <a-col :span="12">
                      <a-form-item label="步骤类型">
                        <a-select v-model:value="selectedStep.type" placeholder="选择步骤类型">
                          <a-select-option :value="ProcessStepType.Start">开始</a-select-option>
                          <a-select-option :value="ProcessStepType.Approval">审批</a-select-option>
                          <a-select-option :value="ProcessStepType.Task">任务</a-select-option>
                          <a-select-option :value="ProcessStepType.End">结束</a-select-option>
                        </a-select>
                      </a-form-item>
                    </a-col>
                  </a-row>

                  <a-row :gutter="16">
                    <a-col :span="12">
                      <a-form-item label="受理人类型">
                        <a-select v-model:value="selectedStep.assignee_type" placeholder="选择受理人类型" allow-clear>
                          <a-select-option :value="AssigneeType.User">用户</a-select-option>
                          <a-select-option :value="AssigneeType.Group">系统</a-select-option>
                        </a-select>
                      </a-form-item>
                    </a-col>
                    <a-col :span="12">
                      <a-form-item label="排序(仅影响显示顺序)">
                        <a-input-number v-model:value="selectedStep.sort_order" :min="1" style="width: 100%" />
                      </a-form-item>
                    </a-col>
                  </a-row>

                  <a-divider />

                  <a-form-item label="后续步骤 (连接)">
                    <a-select v-model:value="selectedStepConnections" mode="multiple" placeholder="选择此步骤完成后要流向的步骤"
                      style="width: 100%" :options="otherStepsOptions">
                    </a-select>
                    <div class="field-hint">
                      定义流程分支、并行或汇合。可选择多个后续步骤。
                    </div>
                  </a-form-item>

                  <a-divider />

                  <a-form-item label="受理人ID列表">
                    <a-select v-model:value="selectedStep.assignee_ids" mode="multiple" placeholder="搜索并选择受理人"
                      style="width: 100%" :options="userOptions" :loading="userLoading" :filter-option="false"
                      @search="handleUserSearch" @popupScroll="handleUserScroll">
                      <template #notFoundContent v-if="userLoading">
                        <div style="text-align: center;">
                          <a-spin size="small" />
                        </div>
                      </template>
                    </a-select>
                    <div class="field-hint">
                      点击下拉框，滚动加载更多用户，或输入关键词搜索。
                    </div>
                  </a-form-item>

                  <a-form-item label="可执行动作">
                    <a-checkbox-group v-model:value="selectedStep.actions" :options="actionOptions" />
                    <div class="field-hint">
                      选择该步骤可以执行的动作
                    </div>
                  </a-form-item>
                </a-form>
              </a-card>
            </div>
          </div>
        </a-tab-pane>

        <a-tab-pane key="json" tab="JSON编辑">
          <div class="json-editor">
            <div class="json-toolbar">
              <a-space>
                <a-button @click="formatJson">
                  <FormatPainterOutlined /> 格式化
                </a-button>
                <a-button @click="validateJson">
                  <CheckCircleOutlined /> 验证JSON
                </a-button>
                <a-button type="primary" @click="syncToVisual">
                  <SyncOutlined /> 应用到可视化
                </a-button>
                <a-button @click="copyProcessJson">
                  <CopyOutlined /> 复制JSON
                </a-button>
              </a-space>
            </div>

            <a-form-item>
              <a-textarea v-model:value="definitionJsonString" :rows="20" placeholder="请输入或粘贴流程定义JSON"
                class="json-textarea" />
              <div class="json-hint">
                <a-typography-text type="secondary">
                  <InfoCircleOutlined /> JSON格式说明：包含steps（步骤数组）和connections（连接数组）
                </a-typography-text>
              </div>
            </a-form-item>
          </div>
        </a-tab-pane>
      </a-tabs>
    </div>

    <a-modal v-model:visible="isPreviewModalVisible" title="流程动画预览" :footer="null" width="800px"
      @cancel="handlePreviewCancel">
      <div class="preview-container">
        <div v-if="processSteps.length === 0" class="empty-canvas">
          <a-empty description="没有可供预览的流程" />
        </div>
        <div v-else class="preview-steps-wrapper">
          <div v-for="(step, index) in sortedProcessSteps" :key="`preview-${step.id}`" class="preview-step-container">
            <div class="preview-step" :style="{ animationDelay: `${index * 0.2}s` }">
              <div class="preview-step-icon" :class="getStepTypeClass(step.type)">
                <component :is="getStepIcon(step.type)" />
              </div>
              <div class="preview-step-info">
                <div class="preview-step-title">{{ step.name }}</div>
                <div class="preview-step-type">{{ getStepTypeText(step.type) }}</div>
              </div>
            </div>
            <div v-if="getOutgoingConnections(step.id).length > 0" class="preview-connections"
              :style="{ animationDelay: `${index * 0.2 + 0.1}s` }">
              <div v-for="conn in getOutgoingConnections(step.id)" :key="conn.to" class="preview-connection-item">
                <ArrowDownOutlined class="preview-arrow" />
                <a-tag color="cyan">{{ getStepNameById(conn.to) }}</a-tag>
              </div>
            </div>
          </div>
        </div>
      </div>
    </a-modal>

  </div>
</template>

<script setup lang="ts">
import { ref, watch, computed, h, onMounted } from 'vue';
import { message, Modal, Empty, Spin as ASpin } from 'ant-design-vue';
import {
  PlusOutlined,
  EyeOutlined,
  CheckCircleOutlined,
  DeleteOutlined,
  ArrowDownOutlined,
  CloseOutlined,
  FormatPainterOutlined,
  SyncOutlined,
  InfoCircleOutlined,
  PlayCircleOutlined,
  StopOutlined,
  EditOutlined,
  SaveOutlined,
  CopyOutlined
} from '@ant-design/icons-vue';
import { debounce } from 'lodash-es';

// API导入
import { getUserList, type GetUserListReq } from '#/api/core/system/user';
import {
  type CreateWorkorderProcessReq,
  type ProcessConnection,
  ProcessStatus,
  createWorkorderProcess
} from '#/api/core/workorder/workorder_process';
import {
  type WorkorderCategoryItem,
  listWorkorderCategory
} from '#/api/core/workorder/workorder_category';
import {
  type WorkorderFormDesignItem,
  listWorkorderFormDesign,
  FormDesignStatus
} from '#/api/core/workorder/workorder_form_design';

interface UserInfo {
  id: number;
  username: string;
  real_name: string;
}

// 类型定义
interface ProcessStep {
  id: string;
  type: string;
  name: string;
  assignee_type?: string;
  // 【修改点 1】: 将 assignee_ids 的类型修改为 number[]
  assignee_ids?: number[];
  actions?: string[];
  sort_order: number;
}

interface ProcessDefinition {
  steps: ProcessStep[];
  connections: ProcessConnection[];
}

// 枚举
const ProcessStepType = { Start: 'start', Approval: 'approval', Task: 'task', End: 'end' };
const Action = { Start: 'Start', Approve: 'Approve', Reject: 'Reject', Complete: 'Complete', Notify: 'Notify' };
const AssigneeType = { User: 'User', Group: 'Group' };

// Props & Emits
interface Props {
  modelValue: ProcessDefinition;
}
const props = withDefaults(defineProps<Props>(), {
  modelValue: () => ({ steps: [], connections: [] }),
});
interface Emits {
  (e: 'update:modelValue', value: ProcessDefinition): void;
}
const emit = defineEmits<Emits>();

// 响应式状态
const editMode = ref('basic');
const processSteps = ref<ProcessStep[]>([]);
const connections = ref<ProcessConnection[]>([]);
const selectedStepIndex = ref<number | null>(null);
const isPreviewModalVisible = ref(false);
const definitionJsonString = ref('{"steps":[],"connections":[]}');

// 流程基本信息
const processBasicInfo = ref({
  name: '',
  description: '',
  form_design_id: undefined as number | undefined,
  category_id: undefined as number | undefined,
  status: ProcessStatus.Draft,
  tags: [] as string[],
  is_default: 2 as 1 | 2
});

// 数据列表
const categories = ref<WorkorderCategoryItem[]>([]);
const formDesigns = ref<WorkorderFormDesignItem[]>([]);
const loading = ref(false);

// === 受理人选择器相关状态 ===
const userList = ref<UserInfo[]>([]);
const userPagination = ref({ page: 1, pageSize: 20, total: 0 });
const userLoading = ref(false);
const userSearchKeyword = ref('');
// =============================

// 计算属性
const selectedStep = computed(() => {
  if (selectedStepIndex.value === null) return null;
  return processSteps.value[selectedStepIndex.value] || null;
});

const otherStepsOptions = computed(() => {
  if (!selectedStep.value) return [];
  return processSteps.value
    .filter(step => step.id !== selectedStep.value!.id)
    .map(step => ({ label: `${step.name} (${getStepTypeText(step.type)})`, value: step.id }));
});

const selectedStepConnections = computed({
  get() {
    if (!selectedStep.value) return [];
    return connections.value
      .filter(c => c.from === selectedStep.value!.id)
      .map(c => c.to);
  },
  set(newTargetIds: string[]) {
    if (!selectedStep.value) return;
    const currentStepId = selectedStep.value.id;
    const otherConnections = connections.value.filter(c => c.from !== currentStepId);
    const newConns = newTargetIds.map(targetId => ({
      id: `conn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      from: currentStepId,
      to: targetId
    }));
    connections.value = [...otherConnections, ...newConns];
  }
});

const sortedProcessSteps = computed(() => {
  return [...processSteps.value].sort((a, b) => a.sort_order - b.sort_order);
});

const actionOptions = [
  { label: '开始', value: Action.Start },
  { label: '审批', value: Action.Approve },
  { label: '驳回', value: Action.Reject },
  { label: '完成', value: Action.Complete },
  { label: '通知', value: Action.Notify },
];

const emptyImage = Empty.PRESENTED_IMAGE_SIMPLE;

// === 受理人选项计算属性 ===
const userOptions = computed(() => {
  return userList.value.map(user => ({
    label: user.username,
    // 【修改点 2】: a-select 的 value 直接使用 number 类型的 id
    value: user.id,
  }));
});
// ========================

// 监听器
watch(() => props.modelValue, (newValue) => {
  if (!newValue) return;

  const internalDef = JSON.stringify({ steps: processSteps.value, connections: connections.value });
  if (internalDef === JSON.stringify(newValue)) return;

  processSteps.value = JSON.parse(JSON.stringify(newValue.steps || []));
  connections.value = JSON.parse(JSON.stringify(newValue.connections || []));

  definitionJsonString.value = JSON.stringify(newValue, null, 2);
}, { immediate: true, deep: true });

watch([processSteps, connections], () => {
  const definition: ProcessDefinition = {
    steps: processSteps.value,
    connections: connections.value,
  };
  if (JSON.stringify(definition) !== JSON.stringify(props.modelValue)) {
    emit('update:modelValue', definition);
  }
  definitionJsonString.value = JSON.stringify(definition, null, 2);
}, { deep: true });

watch(selectedStep, (newStep) => {
  if (newStep) {
    userSearchKeyword.value = '';
    fetchUserList(false);
  } else {
    userList.value = [];
    userPagination.value = { page: 1, pageSize: 20, total: 0 };
  }
});

// 方法

// === 获取用户列表方法 ===
const fetchUserList = async (loadMore = false) => {
  if (userLoading.value) return;
  userLoading.value = true;

  try {
    const currentPage = loadMore ? userPagination.value.page + 1 : 1;
    const params: GetUserListReq = {
      page: currentPage,
      size: userPagination.value.pageSize, // 使用 size 作为分页大小参数
      search: userSearchKeyword.value,    // 使用 search 作为搜索关键词参数
    };

    // 假设 API 返回 { items: UserInfo[], total: number }
    const res = await getUserList(params);

    // 【修改点 3】: 修正 "加载更多" 的逻辑
    if (loadMore) {
      userList.value.push(...(res.items || []));
    } else {
      userList.value = res.items || [];
    }

    userPagination.value.page = currentPage;
    userPagination.value.total = res.total || 0;

  } catch (error) {
    message.error('获取用户列表失败');

  } finally {
    userLoading.value = false;
  }
};

// === 用户搜索处理器 (带防抖) ===
const handleUserSearch = debounce((keyword: string) => {
  userSearchKeyword.value = keyword;
  fetchUserList(false);
}, 300);

// === 下拉列表滚动到底部处理器 ===
const handleUserScroll = (e: Event) => {
  const target = e.target as HTMLElement;
  if (target.scrollTop + target.clientHeight >= target.scrollHeight - 10) {
    if (userList.value.length < userPagination.value.total) {
      fetchUserList(true);
    }
  }
};

const addProcessStep = (): void => {
  const tempId = `temp_${Date.now()}`;
  const newStep: ProcessStep = {
    id: tempId,
    type: ProcessStepType.Start,
    name: `新步骤 ${processSteps.value.length + 1}`,
    assignee_type: AssigneeType.User,
    assignee_ids: [], // 初始化为空的 number 数组
    actions: [Action.Approve, Action.Reject],
    sort_order: (processSteps.value.length > 0 ? Math.max(...processSteps.value.map(s => s.sort_order)) : 0) + 1
  };
  processSteps.value.push(newStep);
  selectStepById(tempId);
};

const removeStepById = (stepIdToRemove: string): void => {
  const index = processSteps.value.findIndex(s => s.id === stepIdToRemove);
  if (index === -1) return;

  processSteps.value.splice(index, 1);
  connections.value = connections.value.filter(c => c.from !== stepIdToRemove && c.to !== stepIdToRemove);

  if (selectedStep.value?.id === stepIdToRemove) {
    selectedStepIndex.value = null;
  }
};

const selectStepById = (stepId: string): void => {
  const index = processSteps.value.findIndex(s => s.id === stepId);
  if (index !== -1) {
    selectedStepIndex.value = index;
  }
};

const previewFlow = (): void => {
  if (processSteps.value.length === 0) {
    message.warning('请先添加流程步骤');
    return;
  }
  isPreviewModalVisible.value = true;
};

const handlePreviewCancel = () => {
  isPreviewModalVisible.value = false;
};

const validateFlow = (): void => {
  const errors: string[] = [];
  if (processSteps.value.length === 0) {
    errors.push('流程至少需要一个步骤');
  } else {
    const startSteps = processSteps.value.filter(s => s.type === ProcessStepType.Start);
    if (startSteps.length === 0) errors.push('流程必须有一个“开始”类型的步骤。');
    if (startSteps.length > 1) errors.push('流程只能有一个“开始”类型的步骤。');
  }

  const stepIds = new Set(processSteps.value.map(s => s.id));
  connections.value.forEach(conn => {
    if (!stepIds.has(conn.from) || !stepIds.has(conn.to)) {
      errors.push(`发现无效连接: ${conn.from} -> ${conn.to}`);
    }
  });

  processSteps.value.forEach((step) => {
    if (!step.name?.trim()) errors.push(`步骤 (${step.id}) 缺少名称`);
    if (step.type !== ProcessStepType.End && !connections.value.some(c => c.from === step.id)) {
      errors.push(`非结束步骤 "${step.name}" 必须至少有一个后续连接。`);
    }
  });

  if (errors.length > 0) {
    Modal.error({ title: '流程验证失败', content: h('pre', errors.join('\n')) });
  } else {
    message.success('流程验证通过！');
  }
};

const formatJson = (): void => {
  try {
    const parsed = JSON.parse(definitionJsonString.value);
    definitionJsonString.value = JSON.stringify(parsed, null, 2);
    message.success('JSON已格式化');
  } catch (e) {
    message.error('JSON格式错误，无法格式化');
  }
};

const validateJson = (): void => {
  try {
    const parsed = JSON.parse(definitionJsonString.value);
    if (!parsed.steps || !Array.isArray(parsed.steps)) {
      message.error('JSON缺少有效的steps数组');
      return;
    }
    if (!parsed.connections || !Array.isArray(parsed.connections)) {
      message.warning('JSON缺少connections数组');
    }
    message.success('JSON格式验证通过');
  } catch (e) {
    message.error('JSON格式错误');
  }
};

const syncToVisual = (): void => {
  try {
    const definition = JSON.parse(definitionJsonString.value);
    if (definition.steps && Array.isArray(definition.steps)) {
      processSteps.value = definition.steps;
      connections.value = definition.connections || [];
      message.success('已从JSON同步到可视化设计');
    } else {
      message.error('JSON中没有有效的steps数据');
    }
  } catch (e) {
    message.error('JSON格式错误，无法同步');
  }
};

const getOutgoingConnections = (stepId: string) => connections.value.filter(c => c.from === stepId);
const getStepNameById = (stepId: string) => processSteps.value.find(s => s.id === stepId)?.name || '未知步骤';
const getStepTypeClass = (type: string): string => `step-${type.toLowerCase()}`;
const getStepIcon = (type: string) => {
  const icons: { [key: string]: any } = { start: PlayCircleOutlined, approval: CheckCircleOutlined, task: EditOutlined, end: StopOutlined };
  // 【修改点 4】: 直接使用小写的 type 进行查找，不再错误地转为大写
  return icons[type] || EditOutlined;
};
const getStepTypeText = (type: string): string => {
  const types: { [key: string]: string } = { start: '开始', approval: '审批', task: '任务', end: '结束' };
  return types[type] || '未知';
};
const getAssigneeTypeText = (type: string | undefined): string => type === AssigneeType.User ? '用户' : '系统';
const getActionText = (action: string): string => {
  const actions: { [key: string]: string } = { Start: '开始', Approve: '审批', Reject: '驳回', Complete: '完成', Notify: '通知' };
  return actions[action] || action;
};

// === 数据加载函数 ===
/**
 * 加载分类数据
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

    categories.value = [];
  }
};

/**
 * 加载表单设计数据
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

    formDesigns.value = [];
  }
};

// === 保存流程函数 ===
const saveProcess = async (): Promise<void> => {
  try {
    // 验证基本信息
    if (!processBasicInfo.value.name.trim()) {
      message.error('流程名称不能为空');
      return;
    }

    if (!processBasicInfo.value.form_design_id) {
      message.error('请选择关联表单');
      return;
    }

    // 验证流程定义
    if (processSteps.value.length === 0) {
      message.error('请至少添加一个流程步骤');
      return;
    }

    // 验证流程结构
    const startSteps = processSteps.value.filter(s => s.type === ProcessStepType.Start);
    if (startSteps.length === 0) {
      message.error('流程必须有一个"开始"类型的步骤');
      return;
    }
    if (startSteps.length > 1) {
      message.error('流程只能有一个"开始"类型的步骤');
      return;
    }

    loading.value = true;

    const createData: CreateWorkorderProcessReq = {
      name: processBasicInfo.value.name,
      description: processBasicInfo.value.description || '',
      form_design_id: processBasicInfo.value.form_design_id,
      definition: {
        steps: processSteps.value,
        connections: connections.value
      },
      category_id: processBasicInfo.value.category_id,
      status: processBasicInfo.value.status,
      tags: processBasicInfo.value.tags,
      is_default: processBasicInfo.value.is_default
    };

    await createWorkorderProcess(createData);
    message.success(`流程 "${processBasicInfo.value.name}" 创建成功！`);

    // 重置表单
    processBasicInfo.value = {
      name: '',
      description: '',
      form_design_id: undefined,
      category_id: undefined,
      status: ProcessStatus.Draft,
      tags: [],
      is_default: 2
    };
    processSteps.value = [];
    connections.value = [];
    selectedStepIndex.value = null;

  } catch (error: any) {
    message.error(`创建流程失败: ${error.message || '未知错误'}`);
  } finally {
    loading.value = false;
  }
};

// === 复制JSON函数 ===
const copyProcessJson = async (): Promise<void> => {
  try {
    const processData = {
      basicInfo: processBasicInfo.value,
      definition: {
        steps: processSteps.value,
        connections: connections.value
      }
    };

    const jsonString = JSON.stringify(processData, null, 2);
    await navigator.clipboard.writeText(jsonString);
    message.success('流程JSON已复制到剪贴板！');
  } catch (error) {
    // 降级方案：使用传统方法复制
    const textArea = document.createElement('textarea');
    const processData = {
      basicInfo: processBasicInfo.value,
      definition: {
        steps: processSteps.value,
        connections: connections.value
      }
    };
    textArea.value = JSON.stringify(processData, null, 2);
    document.body.appendChild(textArea);
    textArea.select();
    document.execCommand('copy');
    document.body.removeChild(textArea);
    message.success('流程JSON已复制到剪贴板！');
  }
};

// === 组件初始化 ===
onMounted(async () => {
  loading.value = true;
  try {
    await Promise.all([
      loadCategories(),
      loadFormDesigns()
    ]);
  } catch (error: any) {

    message.error(`初始化数据加载失败: ${error.message || '未知错误'}`);
  } finally {
    loading.value = false;
  }
});
</script>

<style scoped>
.process-design-engine {
  min-height: 500px;
}

/* 基本信息表单样式 */
.basic-info-form {
  padding: 20px;
  background: #fafafa;
  border-radius: 8px;
  margin-bottom: 16px;
}

.form-actions {
  margin-top: 24px;
  padding-top: 16px;
  border-top: 1px solid #f0f0f0;
  text-align: right;
}

.form-actions .ant-btn {
  margin-left: 8px;
}

.edit-mode-tabs :deep(.ant-tabs-content-holder) {
  max-height: 70vh;
  overflow-y: auto;
}

.visual-designer {
  min-height: 500px;
}

.designer-toolbar {
  margin-bottom: 20px;
  padding: 12px;
  background: #f8f9fa;
  border-radius: 6px;
}

.-canvas {
  border: 2px dashed #d9d9d9;
  border-radius: 8px;
  min-height: 400px;
  background: #fafafa;
  position: relative;
  padding: 20px;
}

.empty-canvas {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 400px;
}

.steps- {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
}

.step-container {
  width: 100%;
  max-width: 600px;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.-step {
  background: white;
  border: 2px solid #e6f7ff;
  border-radius: 8px;
  padding: 16px;
  cursor: pointer;
  transition: all 0.3s ease;
  position: relative;
  width: 100%;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
}

.-step:hover {
  border-color: #1890ff;
  box-shadow: 0 2px 8px rgba(24, 144, 255, 0.15);
}

.-step.active {
  border-color: #1890ff;
  background: #e6f7ff;
}

.step-header {
  display: flex;
  align-items: center;
  gap: 12px;
}

.step-icon {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  font-size: 16px;
  flex-shrink: 0;
}

.step-start {
  background: #52c41a;
}

.step-approval {
  background: #1890ff;
}

.step-task {
  background: #faad14;
}

.step-end {
  background: #f5222d;
}

.step-default {
  background: #8c8c8c;
}

.step-info {
  flex: 1;
}

.step-title {
  font-weight: 600;
  font-size: 16px;
  color: #1f2937;
}

.step-type {
  font-size: 12px;
  color: #8c8c8c;
}

.step-actions {
  display: flex;
  gap: 4px;
}

.step-assignees {
  margin-top: 8px;
}

.step-actions-list {
  margin-top: 8px;
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.step-connections-display {
  display: flex;
  flex-direction: column;
  align-items: center;
  margin-top: 10px;
  width: 100%;
}

.connector-arrow {
  color: #8c8c8c;
  font-size: 16px;
}

.connection-tags {
  margin-top: 8px;
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 8px;
}

.step-detail-panel {
  margin-top: 20px;
  border-top: 1px solid #f0f0f0;
  padding-top: 20px;
}

.field-hint {
  font-size: 12px;
  color: #8c8c8c;
  margin-top: 4px;
}

.json-editor {
  min-height: 500px;
}

.json-toolbar {
  margin-bottom: 16px;
  padding: 12px;
  background: #f8f9fa;
  border-radius: 6px;
}

.json-textarea {
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
  font-size: 13px;
  line-height: 1.4;
}

.json-hint {
  margin-top: 8px;
}

/* 动画预览模态框样式 */
.preview-container {
  background-color: #f0f2f5;
  padding: 24px;
  border-radius: 8px;
  min-height: 400px;
  max-height: 60vh;
  overflow-y: auto;
}

.preview-steps-wrapper {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
}

@keyframes fadeInUp {
  from {
    opacity: 0;
    transform: translateY(20px);
  }

  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.preview-step-container {
  width: 100%;
  max-width: 500px;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.preview-step {
  display: flex;
  align-items: center;
  background: white;
  border-radius: 8px;
  padding: 16px;
  width: 100%;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  opacity: 0;
  animation: fadeInUp 0.5s ease-out forwards;
}

.preview-step-icon {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  font-size: 20px;
  margin-right: 16px;
  flex-shrink: 0;
}

.preview-step-info {
  text-align: left;
}

.preview-step-title {
  font-size: 18px;
  font-weight: 600;
  color: #333;
}

.preview-step-type {
  font-size: 14px;
  color: #666;
}

.preview-connections {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  opacity: 0;
  animation: fadeInUp 0.5s ease-out forwards;
  margin-top: 16px;
}

.preview-connection-item {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.preview-arrow {
  font-size: 20px;
  color: #888;
  margin-bottom: 4px;
}

.field-hint {
  font-size: 12px;
  color: #8c8c8c;
  margin-top: 4px;
  line-height: 1.4;
}
</style>
