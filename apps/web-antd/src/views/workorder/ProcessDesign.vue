<template>
  <OpsPage
    class="process-design-engine"
    description="关联已发布表单，配置步骤与连接后保存为草稿或发布"
    title="流程设计"
  >
    <template #actions>
      <a-button
        :disabled="formsLoading || !!formLoadError"
        :loading="saving"
        aria-label="保存流程"
        type="primary"
        @click="saveProcess"
      >
        <SaveOutlined /> 保存流程
      </a-button>
      <a-button @click="copyProcessJson"><CopyOutlined /> 复制JSON</a-button>
    </template>
    <a-alert v-if="saveError" :message="saveError" show-icon type="error" />
    <a-alert
      v-if="formLoadError"
      :message="formLoadError"
      show-icon
      type="error"
    >
      <template #action>
        <a-button :loading="formsLoading" @click="loadFormDesigns">
          重试表单
        </a-button>
      </template>
    </a-alert>
    <a-alert
      v-if="categoryLoadError"
      :message="categoryLoadError"
      show-icon
      type="error"
    >
      <template #action>
        <a-button :loading="categoriesLoading" @click="loadCategories">
          重试分类
        </a-button>
      </template>
    </a-alert>
    <div :inert="saving || undefined" class="edit-mode-tabs">
      <a-tabs v-model:activeKey="editMode" type="card">
        <a-tab-pane key="basic" tab="基本信息">
          <div class="basic-info-form">
            <a-form :model="processBasicInfo" layout="vertical">
              <a-row :gutter="16">
                <a-col :sm="12" :xs="24">
                  <a-form-item label="流程名称" required>
                    <a-input
                      v-model:value="processBasicInfo.name"
                      :maxlength="200"
                      placeholder="请输入流程名称"
                    />
                  </a-form-item>
                </a-col>
                <a-col :sm="12" :xs="24">
                  <a-form-item label="关联表单" required>
                    <a-select
                      id="process-design-form"
                      v-model:value="processBasicInfo.form_design_id"
                      :loading="formsLoading"
                      placeholder="选择关联表单"
                    >
                      <a-select-option
                        v-for="form in formDesigns"
                        :key="form.id"
                        :value="form.id"
                      >
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
                <a-col :sm="12" :xs="24">
                  <a-form-item label="分类">
                    <a-select
                      v-model:value="processBasicInfo.category_id"
                      :loading="categoriesLoading"
                      allow-clear
                      placeholder="选择分类"
                    >
                      <a-select-option
                        v-for="category in categories"
                        :key="category.id"
                        :value="category.id"
                      >
                        {{ category.name }}
                      </a-select-option>
                    </a-select>
                  </a-form-item>
                </a-col>
                <a-col :sm="12" :xs="24">
                  <a-form-item label="状态">
                    <a-select
                      id="process-design-status"
                      v-model:value="processBasicInfo.status"
                      placeholder="选择状态"
                    >
                      <a-select-option :value="ProcessStatus.Draft">
                        草稿
                      </a-select-option>
                      <a-select-option :value="ProcessStatus.Published">
                        已发布
                      </a-select-option>
                    </a-select>
                  </a-form-item>
                </a-col>
              </a-row>

              <a-form-item label="描述">
                <a-textarea
                  v-model:value="processBasicInfo.description"
                  :maxlength="1000"
                  :rows="3"
                  placeholder="请输入流程描述"
                />
              </a-form-item>

              <a-form-item label="标签">
                <a-select
                  v-model:value="processBasicInfo.tags"
                  mode="tags"
                  placeholder="输入标签，按回车添加"
                  style="width: 100%"
                />
              </a-form-item>

              <a-form-item label="设为默认流程">
                <a-radio-group v-model:value="processBasicInfo.is_default">
                  <a-radio :value="1">是</a-radio>
                  <a-radio :value="2">否</a-radio>
                </a-radio-group>
              </a-form-item>
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

            <div class="process-canvas">
              <div v-if="processSteps.length === 0" class="empty-canvas">
                <a-empty :image="emptyImage" description="暂无流程步骤">
                  <a-button type="primary" @click="addProcessStep">
                    开始设计流程
                  </a-button>
                </a-empty>
              </div>

              <div v-else class="process-steps">
                <div
                  v-for="(step, index) in sortedProcessSteps"
                  :key="step.id"
                  class="step-container"
                >
                  <div
                    class="process-step"
                    :class="{ active: selectedStep?.id === step.id }"
                    role="button"
                    tabindex="0"
                    @keydown.enter="selectStepById(step.id)"
                    @keydown.space.prevent="selectStepById(step.id)"
                    @click="selectStepById(step.id)"
                  >
                    <div class="step-header">
                      <div
                        class="step-icon"
                        :class="getStepTypeClass(step.type)"
                      >
                        <component :is="getStepIcon(step.type)" />
                      </div>
                      <div class="step-info">
                        <div class="step-title">
                          {{ step.name || `步骤 ${index + 1}` }}
                        </div>
                        <div class="step-type">
                          {{ getStepTypeText(step.type) }}
                        </div>
                      </div>
                      <div class="step-actions">
                        <a-button
                          danger
                          size="small"
                          title="删除"
                          type="text"
                          @click.stop="removeStepById(step.id)"
                        >
                          <DeleteOutlined />
                        </a-button>
                      </div>
                    </div>

                    <div
                      v-if="step.assignee_type && step.assignee_ids?.length"
                      class="step-assignees"
                    >
                      <a-tag color="blue" size="small">
                        {{ getAssigneeTypeText(step.assignee_type) }}:
                        {{ step.assignee_ids.length }}人
                      </a-tag>
                    </div>

                    <div v-if="step.actions?.length" class="step-actions-list">
                      <a-tag
                        v-for="action in step.actions"
                        :key="action"
                        color="green"
                        size="small"
                      >
                        {{ getActionText(action) }}
                      </a-tag>
                    </div>
                  </div>

                  <div
                    v-if="getOutgoingConnections(step.id).length > 0"
                    class="step-connections-display"
                  >
                    <div class="connector-arrow">
                      <ArrowDownOutlined />
                    </div>
                    <div class="connection-tags">
                      <a-tag
                        v-for="conn in getOutgoingConnections(step.id)"
                        :key="conn.to"
                        color="purple"
                      >
                        连接到: {{ getStepNameById(conn.to) || '未知步骤' }}
                      </a-tag>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div v-if="selectedStep" class="step-detail-panel">
              <a-card
                :title="`编辑步骤: ${selectedStep.name || '未命名'}`"
                size="small"
              >
                <template #extra>
                  <a-button
                    size="small"
                    type="text"
                    @click="selectedStepIndex = null"
                  >
                    <CloseOutlined />
                  </a-button>
                </template>

                <a-form :model="selectedStep" layout="vertical">
                  <a-row :gutter="16">
                    <a-col :sm="12" :xs="24">
                      <a-form-item label="步骤名称">
                        <a-input
                          v-model:value="selectedStep.name"
                          placeholder="请输入步骤名称"
                        />
                      </a-form-item>
                    </a-col>
                    <a-col :sm="12" :xs="24">
                      <a-form-item label="步骤类型">
                        <a-select
                          v-model:value="selectedStep.type"
                          placeholder="选择步骤类型"
                        >
                          <a-select-option :value="ProcessStepType.Start">
                            开始
                          </a-select-option>
                          <a-select-option :value="ProcessStepType.Approval">
                            审批
                          </a-select-option>
                          <a-select-option :value="ProcessStepType.Task">
                            任务
                          </a-select-option>
                          <a-select-option :value="ProcessStepType.End">
                            结束
                          </a-select-option>
                        </a-select>
                      </a-form-item>
                    </a-col>
                  </a-row>

                  <a-row :gutter="16">
                    <a-col :sm="12" :xs="24">
                      <a-form-item label="受理人类型">
                        <a-select
                          v-model:value="selectedStep.assignee_type"
                          allow-clear
                          placeholder="选择受理人类型"
                        >
                          <a-select-option :value="AssigneeType.User">
                            用户
                          </a-select-option>
                          <a-select-option :value="AssigneeType.Group">
                            系统
                          </a-select-option>
                        </a-select>
                      </a-form-item>
                    </a-col>
                    <a-col :sm="12" :xs="24">
                      <a-form-item label="排序(仅影响显示顺序)">
                        <a-input-number
                          v-model:value="selectedStep.sort_order"
                          :min="1"
                          style="width: 100%"
                        />
                      </a-form-item>
                    </a-col>
                  </a-row>

                  <a-divider />

                  <a-form-item label="后续步骤 (连接)">
                    <a-select
                      v-model:value="selectedStepConnections"
                      :options="otherStepsOptions"
                      mode="multiple"
                      placeholder="选择此步骤完成后要流向的步骤"
                      style="width: 100%"
                    />
                    <div class="field-hint">
                      定义流程分支、并行或汇合。可选择多个后续步骤。
                    </div>
                  </a-form-item>

                  <a-divider />

                  <a-alert
                    v-if="userLoadError"
                    :message="userLoadError"
                    show-icon
                    type="error"
                  >
                    <template #action>
                      <a-button @click="fetchUserList(false)">
                        重试用户
                      </a-button>
                    </template>
                  </a-alert>
                  <a-form-item label="受理人ID列表">
                    <a-select
                      id="process-assignees"
                      v-model:value="selectedStep.assignee_ids"
                      :filter-option="false"
                      :loading="userLoading"
                      :options="userOptions"
                      mode="multiple"
                      placeholder="搜索并选择受理人"
                      show-search
                      style="width: 100%"
                      @popupScroll="handleUserScroll"
                      @search="handleUserSearch"
                    >
                      <template v-if="userLoading" #notFoundContent>
                        <div style="text-align: center">
                          <a-spin size="small" />
                        </div>
                      </template>
                    </a-select>
                    <div class="field-hint">
                      点击下拉框，滚动加载更多用户，或输入关键词搜索。
                    </div>
                  </a-form-item>

                  <a-form-item label="可执行动作">
                    <a-checkbox-group
                      v-model:value="selectedStep.actions"
                      :options="actionOptions"
                    />
                    <div class="field-hint">选择该步骤可以执行的动作</div>
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
              <a-textarea
                v-model:value="definitionJsonString"
                :rows="20"
                class="json-textarea"
                placeholder="请输入或粘贴流程定义JSON"
              />
              <div class="json-hint">
                <a-typography-text type="secondary">
                  <InfoCircleOutlined />
                  JSON格式说明：包含steps（步骤数组）和connections（连接数组）
                </a-typography-text>
              </div>
            </a-form-item>
          </div>
        </a-tab-pane>
      </a-tabs>
    </div>

    <a-modal
      v-model:open="isPreviewModalVisible"
      :footer="null"
      title="流程预览"
      width="800px"
      @cancel="handlePreviewCancel"
    >
      <div class="preview-container">
        <div v-if="processSteps.length === 0" class="empty-canvas">
          <a-empty description="没有可供预览的流程" />
        </div>
        <div v-else class="preview-steps-wrapper">
          <div
            v-for="step in sortedProcessSteps"
            :key="`preview-${step.id}`"
            class="preview-step-container"
          >
            <div class="preview-step">
              <div
                class="preview-step-icon"
                :class="getStepTypeClass(step.type)"
              >
                <component :is="getStepIcon(step.type)" />
              </div>
              <div class="preview-step-info">
                <div class="preview-step-title">{{ step.name }}</div>
                <div class="preview-step-type">
                  {{ getStepTypeText(step.type) }}
                </div>
              </div>
            </div>
            <div
              v-if="getOutgoingConnections(step.id).length > 0"
              class="preview-connections"
            >
              <div
                v-for="conn in getOutgoingConnections(step.id)"
                :key="conn.to"
                class="preview-connection-item"
              >
                <ArrowDownOutlined class="preview-arrow" />
                <a-tag color="cyan">{{ getStepNameById(conn.to) }}</a-tag>
              </div>
            </div>
          </div>
        </div>
      </div>
    </a-modal>
  </OpsPage>
</template>

<script setup lang="ts">
import OpsPage from '#/components/ops/OpsPage.vue';
import { computed, h, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { Spin as ASpin, Empty, message, Modal } from 'ant-design-vue';
import {
  ArrowDownOutlined,
  CheckCircleOutlined,
  CloseOutlined,
  CopyOutlined,
  DeleteOutlined,
  EditOutlined,
  EyeOutlined,
  FormatPainterOutlined,
  InfoCircleOutlined,
  PlayCircleOutlined,
  PlusOutlined,
  SaveOutlined,
  StopOutlined,
  SyncOutlined,
} from '@ant-design/icons-vue';
import { debounce } from 'lodash-es';

// API导入
import { getUserList, type GetUserListReq } from '#/api/core/system/user';
import {
  Action,
  AssigneeType,
  createWorkorderProcess,
  type CreateWorkorderProcessReq,
  type ProcessConnection,
  ProcessStatus,
  ProcessStepType,
} from '#/api/core/workorder/workorder_process';
import {
  listWorkorderCategory,
  type WorkorderCategoryItem,
} from '#/api/core/workorder/workorder_category';
import {
  FormDesignStatus,
  listWorkorderFormDesign,
  type WorkorderFormDesignItem,
} from '#/api/core/workorder/workorder_form_design';
import {
  shouldNotifyPageError,
  shouldRecordPageError,
} from '#/utils/permission/request-notice';

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

// Props & Emits
interface Props {
  modelValue: ProcessDefinition;
}
const props = withDefaults(defineProps<Props>(), {
  modelValue: () => ({ steps: [], connections: [] }),
});
const emit = defineEmits<Emits>();
interface Emits {
  (e: 'update:modelValue', value: ProcessDefinition): void;
}
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
  is_default: 2 as 1 | 2,
});

// 数据列表
const categories = ref<WorkorderCategoryItem[]>([]);
const formDesigns = ref<WorkorderFormDesignItem[]>([]);
const saving = ref(false);
const saveError = ref<string | null>(null);
const formsLoading = ref(false);
const categoriesLoading = ref(false);
const formLoadError = ref<string | null>(null);
const categoryLoadError = ref<string | null>(null);
const userLoadError = ref<string | null>(null);
let formsRequest = 0;
let categoriesRequest = 0;
let userRequest = 0;
let saveRequest = 0;
let stepSequence = 0;
let validationDialog: ReturnType<typeof Modal.error> | undefined;

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
    .filter((step) => step.id !== selectedStep.value!.id)
    .map((step) => ({
      label: `${step.name} (${getStepTypeText(step.type)})`,
      value: step.id,
    }));
});

const selectedStepConnections = computed({
  get() {
    if (!selectedStep.value) return [];
    return connections.value
      .filter((c) => c.from === selectedStep.value!.id)
      .map((c) => c.to);
  },
  set(newTargetIds: string[]) {
    if (!selectedStep.value) return;
    const currentStepId = selectedStep.value.id;
    const otherConnections = connections.value.filter(
      (c) => c.from !== currentStepId,
    );
    const newConns = newTargetIds.map((targetId) => ({
      id: `conn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      from: currentStepId,
      to: targetId,
    }));
    connections.value = [...otherConnections, ...newConns];
  },
});

const sortedProcessSteps = computed(() => {
  return [...processSteps.value].sort((a, b) => a.sort_order - b.sort_order);
});

const actionOptions = [
  { label: '提交', value: Action.Submit },
  { label: '指派', value: Action.Assign },
  { label: '审批通过', value: Action.Approve },
  { label: '驳回', value: Action.Reject },
  { label: '完成', value: Action.Complete },
  { label: '退回', value: Action.Return },
  { label: '取消', value: Action.Cancel },
  { label: '通知', value: Action.Notify },
];

const emptyImage = Empty.PRESENTED_IMAGE_SIMPLE;

// === 受理人选项计算属性 ===
const userOptions = computed(() => {
  return userList.value.map((user) => ({
    label: user.username,
    // 【修改点 2】: a-select 的 value 直接使用 number 类型的 id
    value: user.id,
  }));
});
// ========================

// 监听器
watch(
  () => props.modelValue,
  (newValue) => {
    if (!newValue) return;

    const internalDef = JSON.stringify({
      steps: processSteps.value,
      connections: connections.value,
    });
    if (internalDef === JSON.stringify(newValue)) return;

    if (
      !Array.isArray(newValue.steps) ||
      !Array.isArray(newValue.connections) ||
      newValue.steps.some((step) => !step)
    )
      return;
    selectedStepIndex.value = null;
    processSteps.value = JSON.parse(JSON.stringify(newValue.steps || []));
    connections.value = JSON.parse(JSON.stringify(newValue.connections || []));

    definitionJsonString.value = JSON.stringify(newValue, null, 2);
  },
  { immediate: true, deep: true },
);

watch(
  [processSteps, connections],
  () => {
    const definition: ProcessDefinition = {
      steps: processSteps.value,
      connections: connections.value,
    };
    if (JSON.stringify(definition) !== JSON.stringify(props.modelValue)) {
      emit('update:modelValue', JSON.parse(JSON.stringify(definition)));
    }
    definitionJsonString.value = JSON.stringify(definition, null, 2);
  },
  { deep: true },
);

watch(selectedStep, (newStep) => {
  if (newStep) {
    userSearchKeyword.value = '';
    fetchUserList(false);
  } else {
    userRequest++;
    searchUsers.cancel();
    userList.value = [];
    userPagination.value = { page: 1, pageSize: 20, total: 0 };
  }
});

// 方法

// === 获取用户列表方法 ===
const fetchUserList = async (loadMore = false) => {
  if (!selectedStep.value || (loadMore && userLoading.value)) return;
  const ticket = ++userRequest;
  const owner = selectedStep.value.id;
  const keyword = userSearchKeyword.value;
  const currentPage = loadMore ? userPagination.value.page + 1 : 1;
  userLoading.value = true;
  userLoadError.value = null;
  if (!loadMore) {
    userList.value = [];
    userPagination.value.page = 1;
    userPagination.value.total = 0;
  }
  try {
    const params: GetUserListReq = {
      page: currentPage,
      size: userPagination.value.pageSize,
      search: keyword,
    };
    const res = await getUserList(params);
    if (
      ticket !== userRequest ||
      selectedStep.value?.id !== owner ||
      keyword !== userSearchKeyword.value
    )
      return;
    const items = res.items || [];
    userList.value = loadMore
      ? [
          ...new Map(
            [...userList.value, ...items].map((user) => [user.id, user]),
          ).values(),
        ]
      : items;
    userPagination.value.page = currentPage;
    userPagination.value.total = res.total || 0;
  } catch (error) {
    if (ticket === userRequest && selectedStep.value?.id === owner)
      if (shouldRecordPageError(error))
        userLoadError.value = '读取用户失败，请重试';
  } finally {
    if (ticket === userRequest) userLoading.value = false;
  }
};
const searchUsers = debounce(() => {
  void fetchUserList(false);
}, 300);
const handleUserSearch = (keyword: string) => {
  userSearchKeyword.value = keyword;
  userRequest++;
  searchUsers();
};

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
  let tempId: string;
  do {
    tempId = `step_${Date.now()}_${++stepSequence}`;
  } while (processSteps.value.some((step) => step.id === tempId));
  const isFirstStep = processSteps.value.length === 0;
  const newStep: ProcessStep = {
    id: tempId,
    type: isFirstStep ? ProcessStepType.Start : ProcessStepType.Approval,
    name: `新步骤 ${processSteps.value.length + 1}`,
    assignee_type: AssigneeType.User,
    assignee_ids: [], // 初始化为空的 number 数组
    actions: isFirstStep ? [Action.Submit] : [Action.Approve, Action.Reject],
    sort_order:
      (processSteps.value.length > 0
        ? Math.max(...processSteps.value.map((s) => s.sort_order))
        : 0) + 1,
  };
  processSteps.value.push(newStep);
  selectStepById(tempId);
};

const removeStepById = (stepIdToRemove: string): void => {
  const index = processSteps.value.findIndex((s) => s.id === stepIdToRemove);
  if (index === -1) return;

  const selectedId = selectedStep.value?.id;
  processSteps.value.splice(index, 1);
  connections.value = connections.value.filter(
    (c) => c.from !== stepIdToRemove && c.to !== stepIdToRemove,
  );

  const selectedIndex = processSteps.value.findIndex(
    (step) => step.id === selectedId,
  );
  selectedStepIndex.value = selectedIndex === -1 ? null : selectedIndex;
};

const selectStepById = (stepId: string): void => {
  const index = processSteps.value.findIndex((s) => s.id === stepId);
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

function definitionErrors(value: unknown): string[] {
  if (
    !value ||
    typeof value !== 'object' ||
    !('steps' in value) ||
    !Array.isArray(value.steps) ||
    !('connections' in value) ||
    !Array.isArray(value.connections)
  )
    return ['流程结构需要 steps 和 connections 数组'];
  const definition = value as ProcessDefinition;
  const errors: string[] = [];
  const ids = new Set<string>();
  if (!definition.steps.length) errors.push('流程至少需要一个步骤');
  for (const step of definition.steps) {
    if (
      !step ||
      typeof step.id !== 'string' ||
      !step.id.trim() ||
      ids.has(step.id) ||
      typeof step.name !== 'string' ||
      !step.name.trim() ||
      !Object.values(ProcessStepType).includes(
        step.type as typeof ProcessStepType.Start,
      )
    )
      return ['流程结构包含无效或重复的步骤'];
    if (
      step.assignee_ids &&
      (!Array.isArray(step.assignee_ids) ||
        step.assignee_ids.some((id) => !Number.isSafeInteger(id) || id <= 0))
    )
      return ['流程结构的受理人 ID 必须为正整数'];
    if (
      step.actions &&
      (!Array.isArray(step.actions) ||
        step.actions.some((action) => typeof action !== 'string'))
    )
      return ['流程结构的动作必须为字符串数组'];
    ids.add(step.id);
  }
  if (
    definition.steps.filter((step) => step.type === ProcessStepType.Start)
      .length !== 1
  )
    errors.push('流程必须有且仅有一个开始步骤');
  if (!definition.steps.some((step) => step.type === ProcessStepType.End))
    errors.push('流程必须包含结束步骤');
  for (const connection of definition.connections) {
    if (!connection || !ids.has(connection.from) || !ids.has(connection.to))
      return ['流程结构包含无效连接'];
  }
  for (const step of definition.steps) {
    if (
      step.type !== ProcessStepType.End &&
      !definition.connections.some((connection) => connection.from === step.id)
    )
      errors.push(`非结束步骤“${step.name}”需要后续连接`);
  }
  return errors;
}
const validateFlow = (): void => {
  const errors = definitionErrors({
    steps: processSteps.value,
    connections: connections.value,
  });
  if (errors.length)
    validationDialog = Modal.error({
      title: '流程验证失败',
      content: h('pre', errors.join('\n')),
    });
  else message.success('流程验证通过');
};
const hasUnappliedJson = computed(() => {
  try {
    return (
      JSON.stringify(JSON.parse(definitionJsonString.value)) !==
      JSON.stringify({
        steps: processSteps.value,
        connections: connections.value,
      })
    );
  } catch {
    return true;
  }
});

const formatJson = (): void => {
  try {
    const parsed = JSON.parse(definitionJsonString.value);
    definitionJsonString.value = JSON.stringify(parsed, null, 2);
    message.success('JSON已格式化');
  } catch {
    message.error('JSON格式错误，无法格式化');
  }
};

const validateJson = (): void => {
  try {
    const errors = definitionErrors(JSON.parse(definitionJsonString.value));
    if (errors.length) {
      message.error(errors[0]);
      return;
    }
    message.success('JSON结构验证通过');
  } catch {
    message.error('JSON格式错误');
  }
};
const syncToVisual = (): void => {
  try {
    const definition = JSON.parse(definitionJsonString.value);
    const errors = definitionErrors(definition);
    if (errors.length) {
      message.error(errors[0]);
      return;
    }
    processSteps.value = definition.steps;
    connections.value = definition.connections;
    selectedStepIndex.value = null;
    message.success('已从JSON应用到可视化设计');
  } catch {
    message.error('JSON格式错误，无法应用');
  }
};

const getOutgoingConnections = (stepId: string) =>
  connections.value.filter((c) => c.from === stepId);
const getStepNameById = (stepId: string) =>
  processSteps.value.find((s) => s.id === stepId)?.name || '未知步骤';
const getStepTypeClass = (type: string): string => `step-${type.toLowerCase()}`;
const getStepIcon = (type: string) => {
  const icons: { [key: string]: any } = {
    start: PlayCircleOutlined,
    approval: CheckCircleOutlined,
    task: EditOutlined,
    end: StopOutlined,
  };
  // 【修改点 4】: 直接使用小写的 type 进行查找，不再错误地转为大写
  return icons[type] || EditOutlined;
};
const getStepTypeText = (type: string): string => {
  const types: { [key: string]: string } = {
    start: '开始',
    approval: '审批',
    task: '任务',
    end: '结束',
  };
  return types[type] || '未知';
};
const getAssigneeTypeText = (type: string | undefined): string =>
  type === AssigneeType.User ? '用户' : '系统';
const getActionText = (action: string): string => {
  const actions: { [key: string]: string } = {
    submit: '提交',
    assign: '指派',
    approve: '审批通过',
    reject: '驳回',
    complete: '完成',
    return: '退回',
    cancel: '取消',
    notify: '通知',
  };
  return actions[action] || action;
};

// === 数据加载函数 ===
/**
 * 加载分类数据
 */
const loadCategories = async (): Promise<void> => {
  const ticket = ++categoriesRequest;
  categoryLoadError.value = null;
  categoriesLoading.value = true;
  try {
    let allCategories: any[] = [];
    let currentPage = 1;
    const pageSize = 50;
    let hasMoreData = true;

    while (hasMoreData) {
      const params = {
        page: currentPage,
        size: pageSize,
        search: undefined,
      };

      const res = (await listWorkorderCategory(params)) as any;
      if (ticket !== categoriesRequest) return;
      if (res && res.items && res.items.length > 0) {
        allCategories = [...allCategories, ...res.items];

        if (
          res.items.length < pageSize ||
          allCategories.length >= (res.total || 0)
        ) {
          hasMoreData = false;
        } else {
          currentPage++;
        }
      } else {
        hasMoreData = false;
      }
    }

    if (ticket === categoriesRequest) categories.value = allCategories;
  } catch (error) {
    if (ticket === categoriesRequest) {
      categories.value = [];
      if (shouldRecordPageError(error))
        categoryLoadError.value = '读取分类失败，请重试';
    }
  } finally {
    if (ticket === categoriesRequest) categoriesLoading.value = false;
  }
};

/**
 * 加载表单设计数据
 */
const loadFormDesigns = async (): Promise<void> => {
  const ticket = ++formsRequest;
  formLoadError.value = null;
  formsLoading.value = true;
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
        status: FormDesignStatus.Published, // 只获取已发布的表单
      };

      const res = (await listWorkorderFormDesign(params)) as any;
      if (ticket !== formsRequest) return;
      if (res && res.items && res.items.length > 0) {
        allForms = [...allForms, ...res.items];

        if (
          res.items.length < pageSize ||
          allForms.length >= (res.total || 0)
        ) {
          hasMoreData = false;
        } else {
          currentPage++;
        }
      } else {
        hasMoreData = false;
      }
    }

    if (ticket === formsRequest) formDesigns.value = allForms;
  } catch (error) {
    if (ticket === formsRequest) {
      formDesigns.value = [];
      if (shouldRecordPageError(error))
        formLoadError.value = '读取已发布表单失败，请重试';
    }
  } finally {
    if (ticket === formsRequest) formsLoading.value = false;
  }
};

// === 保存流程函数 ===
const saveProcess = async (): Promise<void> => {
  if (saving.value || formsLoading.value || formLoadError.value) return;
  if (hasUnappliedJson.value) {
    message.error('JSON修改尚未应用，请先应用到可视化');
    return;
  }
  const errors = definitionErrors({
    steps: processSteps.value,
    connections: connections.value,
  });
  if (errors.length) {
    message.error(errors[0]);
    return;
  }
  const ticket = ++saveRequest;
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
    const startSteps = processSteps.value.filter(
      (s) => s.type === ProcessStepType.Start,
    );
    if (startSteps.length === 0) {
      message.error('流程必须有一个"开始"类型的步骤');
      return;
    }
    if (startSteps.length > 1) {
      message.error('流程只能有一个"开始"类型的步骤');
      return;
    }

    saving.value = true;
    saveError.value = null;

    const createData: CreateWorkorderProcessReq = {
      name: processBasicInfo.value.name.trim(),
      description: processBasicInfo.value.description || '',
      form_design_id: processBasicInfo.value.form_design_id,
      definition: {
        steps: JSON.parse(JSON.stringify(processSteps.value)),
        connections: JSON.parse(JSON.stringify(connections.value)),
      },
      category_id: processBasicInfo.value.category_id,
      status: processBasicInfo.value.status,
      tags: [...processBasicInfo.value.tags],
      is_default: processBasicInfo.value.is_default,
    };

    await createWorkorderProcess(createData);
    if (ticket !== saveRequest) return;
    message.success('流程设计保存成功');

    // 重置表单
    processBasicInfo.value = {
      name: '',
      description: '',
      form_design_id: undefined,
      category_id: undefined,
      status: ProcessStatus.Draft,
      tags: [],
      is_default: 2,
    };
    processSteps.value = [];
    connections.value = [];
    selectedStepIndex.value = null;
  } catch (error) {
    if (ticket === saveRequest)
      if (shouldRecordPageError(error))
        saveError.value = '保存失败，请重试，当前流程设计已保留';
  } finally {
    if (ticket === saveRequest) saving.value = false;
  }
};

// === 复制JSON函数 ===
const copyProcessJson = async (): Promise<void> => {
  try {
    const processData = {
      basicInfo: processBasicInfo.value,
      definition: {
        steps: processSteps.value,
        connections: connections.value,
      },
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
        connections: connections.value,
      },
    };
    textArea.value = JSON.stringify(processData, null, 2);
    document.body.appendChild(textArea);
    textArea.select();
    const copied = document.execCommand('copy');
    document.body.removeChild(textArea);
    if (copied) message.success('流程JSON已复制到剪贴板');
    else if (shouldNotifyPageError(error))
      message.error('复制失败，请手动复制JSON');
  }
};

onMounted(() => {
  void Promise.all([loadCategories(), loadFormDesigns()]);
});
onBeforeUnmount(() => {
  formsRequest++;
  categoriesRequest++;
  userRequest++;
  saveRequest++;
  searchUsers.cancel();
  validationDialog?.destroy();
});
</script>

<style scoped>
.process-design-engine {
  min-height: 500px;
}

/* 基本信息表单样式 */
.basic-info-form {
  padding: 20px;
  background: var(--ops-ground);
  border-radius: var(--ops-radius);
  margin-bottom: 16px;
}

.form-actions {
  margin-top: 24px;
  padding-top: 16px;
  border-top: 1px solid var(--ops-border);
  text-align: right;
}

.form-actions .ant-btn {
  margin-left: 8px;
}

.edit-mode-tabs :deep(.ant-tabs-content-holder) {
  min-width: 0;
}

.visual-designer {
  min-height: 500px;
}

.designer-toolbar {
  margin-bottom: 20px;
  padding: 12px;
  background: var(--ops-ground);
  border-radius: var(--ops-radius);
}

.process-canvas {
  border: 1px dashed var(--ops-border);
  border-radius: var(--ops-radius);
  min-height: 400px;
  background: var(--ops-ground);
  position: relative;
  padding: 20px;
}

.empty-canvas {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 400px;
}

.process-steps {
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

.process-step {
  background: var(--ops-surface);
  border: 1px solid var(--ops-border);
  border-radius: var(--ops-radius);
  padding: 16px;
  cursor: pointer;
  transition:
    border-color 120ms ease,
    background-color 120ms ease;
  position: relative;
  width: 100%;
  box-shadow: none;
}

.process-step:hover {
  border-color: var(--ops-accent);
  box-shadow: none;
}

.process-step.active {
  border-color: var(--ops-accent);
  background: var(--ops-ground);
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
  color: hsl(var(--primary-foreground));
  font-size: 16px;
  flex-shrink: 0;
}

.step-start {
  background: #52c41a;
}

.step-approval {
  background: var(--ops-accent);
}

.step-task {
  background: #faad14;
}

.step-end {
  background: #f5222d;
}

.step-default {
  background: var(--ops-muted);
}

.step-info {
  flex: 1;
}

.step-title {
  font-weight: 600;
  font-size: 16px;
  color: var(--ops-ink);
}

.step-type {
  font-size: 12px;
  color: var(--ops-muted);
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
  color: var(--ops-muted);
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
  border-top: 1px solid var(--ops-border);
  padding-top: 20px;
}

.field-hint {
  font-size: 12px;
  color: var(--ops-muted);
  margin-top: 4px;
}

.json-editor {
  min-height: 500px;
}

.json-toolbar {
  margin-bottom: 16px;
  padding: 12px;
  background: var(--ops-ground);
  border-radius: var(--ops-radius);
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
  background-color: var(--ops-ground);
  padding: 24px;
  border-radius: var(--ops-radius);
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
  background: var(--ops-surface);
  border-radius: var(--ops-radius);
  padding: 16px;
  width: 100%;
  box-shadow: none;
}

.preview-step-icon {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: hsl(var(--primary-foreground));
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
  color: var(--ops-ink);
}

.preview-step-type {
  font-size: 14px;
  color: var(--ops-muted);
}

.preview-connections {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;

  margin-top: 16px;
}

.preview-connection-item {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.preview-arrow {
  font-size: 20px;
  color: var(--ops-muted);
  margin-bottom: 4px;
}

.field-hint {
  font-size: 12px;
  color: var(--ops-muted);
  margin-top: 4px;
  line-height: 1.4;
}

.process-design-engine :deep(.ant-space) {
  flex-wrap: wrap;
}
.edit-mode-tabs {
  min-width: 0;
  background: var(--ops-surface);
  border: 1px solid var(--ops-border);
  border-radius: var(--ops-radius);
  padding: var(--ops-space-lg);
}
.basic-info-form {
  background: var(--ops-surface);
  padding: var(--ops-space-sm);
}
.process-step {
  text-align: left;
}
.step-info,
.preview-step-info {
  min-width: 0;
  overflow-wrap: anywhere;
}
.json-textarea {
  font-family: SFMono-Regular, Consolas, monospace;
}
@media (max-width: 640px) {
  .edit-mode-tabs,
  .process-canvas,
  .preview-container {
    padding: var(--ops-space-sm);
  }
  .visual-designer,
  .process-canvas,
  .empty-canvas,
  .json-editor {
    min-height: 240px;
    height: auto;
  }
  .designer-toolbar,
  .json-toolbar {
    padding: var(--ops-space-sm);
  }
  .step-title {
    font-size: 14px;
  }
  .step-detail-panel {
    margin-top: var(--ops-space-lg);
    padding-top: var(--ops-space-lg);
  }
}
@media (prefers-reduced-motion: reduce) {
  .process-design-engine :deep(*) {
    animation: none !important;
    transition: none !important;
  }
}
</style>
