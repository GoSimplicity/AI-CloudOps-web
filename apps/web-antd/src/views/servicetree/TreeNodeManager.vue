<template>
  <div class="tree-node-container">
    <!-- 页面标题 -->
    <div class="page-header">
      <div class="header-actions">
        <a-button type="primary" @click="handleCreateNode" class="btn-create">
          <template #icon>
            <PlusOutlined />
          </template>
          <span class="btn-text">创建节点</span>
        </a-button>
        <div class="search-filters">
          <a-input-search 
            v-model:value="searchQuery" 
            placeholder="搜索节点名称..." 
            class="search-input" 
            @search="handleSearch"
            @change="handleSearchChange" 
            allow-clear 
          />
          <a-select 
            v-model:value="levelFilter" 
            placeholder="节点层级" 
            class="filter-select"
            @change="handleLevelChange" 
            allow-clear
          >
            <a-select-option :value="undefined">全部层级</a-select-option>
            <a-select-option :value="1">第1层</a-select-option>
            <a-select-option :value="2">第2层</a-select-option>
            <a-select-option :value="3">第3层</a-select-option>
            <a-select-option :value="4">第4层</a-select-option>
          </a-select>
          <a-select 
            v-model:value="statusFilter" 
            placeholder="节点状态" 
            class="filter-select"
            @change="handleStatusChange" 
            allow-clear
          >
            <a-select-option :value="undefined">全部状态</a-select-option>
            <a-select-option :value="1">活跃</a-select-option>
            <a-select-option :value="2">非活跃</a-select-option>
          </a-select>
          <a-button @click="handleResetFilters" class="reset-btn">
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
              title="总节点" 
              :value="stats.total_nodes" 
              :value-style="{ color: '#3f8600' }"
            >
              <template #prefix>
                <Icon icon="carbon:tree-view" />
              </template>
            </a-statistic>
          </a-card>
        </a-col>
        <a-col :xs="12" :sm="6" :md="6" :lg="6">
          <a-card class="stats-card">
            <a-statistic 
              title="活跃节点" 
              :value="stats.active_nodes" 
              :value-style="{ color: '#52c41a' }"
            >
              <template #prefix>
                <Icon icon="carbon:checkmark-outline" />
              </template>
            </a-statistic>
          </a-card>
        </a-col>
        <a-col :xs="12" :sm="6" :md="6" :lg="6">
          <a-card class="stats-card">
            <a-statistic 
              title="绑定资源" 
              :value="stats.total_resources" 
              :value-style="{ color: '#faad14' }"
            >
              <template #prefix>
                <Icon icon="carbon:data-table" />
              </template>
            </a-statistic>
          </a-card>
        </a-col>
        <a-col :xs="12" :sm="6" :md="6" :lg="6">
          <a-card class="stats-card">
            <a-statistic 
              title="管理员" 
              :value="stats.total_admins" 
              :value-style="{ color: '#cf1322' }"
            >
              <template #prefix>
                <Icon icon="carbon:user-admin" />
              </template>
            </a-statistic>
          </a-card>
        </a-col>
      </a-row>
    </div>

    <!-- 树状结构和详情展示 -->
    <div class="content-layout">
      <a-row :gutter="16">
        <!-- 左侧树状结构 -->
        <a-col :xs="24" :sm="24" :md="8" :lg="6">
          <a-card class="tree-card" :loading="treeLoading">
            <template #title>
              <div class="tree-header">
                <Icon icon="carbon:tree-view" />
                <span>节点树</span>
                <a-button 
                  type="text" 
                  size="small" 
                  @click="refreshTree"
                  :loading="treeLoading"
                >
                  <Icon icon="carbon:refresh" />
                </a-button>
              </div>
            </template>
            <a-tree
              v-model:selectedKeys="selectedKeys"
              v-model:expandedKeys="expandedKeys"
              :tree-data="treeData"
              :field-names="{ children: 'children', title: 'name', key: 'id' }"
              show-icon
              @select="handleTreeSelect"
              @expand="handleTreeExpand"
              class="node-tree"
            >
              <template #icon="{ dataRef }">
                <Icon 
                  :icon="dataRef.is_leaf === 1 ? 'carbon:document' : 'carbon:folder'" 
                  :class="getNodeIconClass(dataRef)"
                />
              </template>
              <template #title="{ dataRef }">
                <div class="tree-node-title">
                  <span>{{ dataRef.name }}</span>
                  <div class="tree-node-badges">
                    <a-tag 
                      v-if="dataRef.status === 1" 
                      color="success" 
                      size="small"
                    >
                      活跃
                    </a-tag>
                    <a-tag 
                      v-if="dataRef.is_leaf === 1" 
                      color="blue" 
                      size="small"
                    >
                      叶子
                    </a-tag>
                  </div>
                </div>
              </template>
            </a-tree>
          </a-card>
        </a-col>

        <!-- 右侧详情展示 -->
        <a-col :xs="24" :sm="24" :md="16" :lg="18">
          <a-card v-if="selectedNode" class="detail-card" :loading="detailLoading">
            <template #title>
              <div class="detail-header">
                <Icon icon="carbon:information" />
                <span>{{ selectedNode.name }}</span>
                <div class="detail-actions">
                  <a-button 
                    type="primary" 
                    size="small" 
                    @click="handleEditNode(selectedNode)"
                  >
                    编辑
                  </a-button>
                  <a-dropdown>
                    <template #overlay>
                      <a-menu @click="(e: any) => handleMenuClick(e.key, selectedNode!)">
                        <a-menu-item key="move">移动节点</a-menu-item>
                        <a-menu-item key="children">添加子节点</a-menu-item>
                        <a-menu-item key="delete" danger>删除</a-menu-item>
                      </a-menu>
                    </template>
                    <a-button size="small">
                      更多
                      <DownOutlined />
                    </a-button>
                  </a-dropdown>
                </div>
              </div>
            </template>

            <a-tabs>
              <!-- 基本信息 -->
              <a-tab-pane key="info" tab="基本信息">
                <a-descriptions bordered :column="2" :labelStyle="{ width: '120px' }">
                  <a-descriptions-item label="节点ID">{{ selectedNode.id }}</a-descriptions-item>
                  <a-descriptions-item label="父节点ID">{{ selectedNode.parent_id || '无' }}</a-descriptions-item>
                  <a-descriptions-item label="节点层级">第{{ selectedNode.level }}层</a-descriptions-item>
                  <a-descriptions-item label="节点状态">
                    <a-tag :color="selectedNode.status === 1 ? 'success' : 'default'">
                      {{ selectedNode.status === 1 ? '活跃' : '非活跃' }}
                    </a-tag>
                  </a-descriptions-item>
                  <a-descriptions-item label="节点类型">
                    <a-tag :color="selectedNode.is_leaf === 1 ? 'blue' : 'green'">
                      {{ selectedNode.is_leaf === 1 ? '叶子节点' : '分支节点' }}
                    </a-tag>
                  </a-descriptions-item>
                  <a-descriptions-item label="创建人">{{ selectedNode.create_user_name }}</a-descriptions-item>
                  <a-descriptions-item label="创建时间" :span="2">
                    {{ formatFullDateTime(selectedNode.created_at) }}
                  </a-descriptions-item>
                  <a-descriptions-item label="更新时间" :span="2">
                    {{ formatFullDateTime(selectedNode.updated_at) }}
                  </a-descriptions-item>
                  <a-descriptions-item label="描述" :span="2">
                    {{ selectedNode.description || '无描述' }}
                  </a-descriptions-item>
                </a-descriptions>
              </a-tab-pane>

              <!-- 成员管理 -->
              <a-tab-pane key="members" tab="成员管理">
                <div class="members-section">
                  <div class="section-header">
                    <h4>管理员 ({{ selectedNode.admins?.length || 0 }})</h4>
                    <a-button 
                      type="primary" 
                      size="small" 
                      @click="handleAddMember(1)"
                    >
                      添加管理员
                    </a-button>
                  </div>
                  <div class="member-list">
                    <div 
                      v-for="admin in selectedNode.admins" 
                      :key="admin.id" 
                      class="member-item"
                    >
                      <a-avatar 
                        :style="{ backgroundColor: getAvatarColor(admin.real_name) }"
                      >
                        {{ getInitials(admin.real_name) }}
                      </a-avatar>
                      <div class="member-info">
                        <div class="member-name">{{ admin.real_name }}</div>
                        <div class="member-email">{{ admin.email }}</div>
                      </div>
                      <a-button 
                        type="text" 
                        danger 
                        size="small"
                        @click="removeMember(admin.id, 1)"
                      >
                        移除
                      </a-button>
                    </div>
                  </div>

                  <div class="section-header">
                    <h4>普通成员 ({{ selectedNode.members?.length || 0 }})</h4>
                    <a-button 
                      type="primary" 
                      size="small" 
                      @click="handleAddMember(2)"
                    >
                      添加成员
                    </a-button>
                  </div>
                  <div class="member-list">
                    <div 
                      v-for="member in selectedNode.members" 
                      :key="member.id" 
                      class="member-item"
                    >
                      <a-avatar 
                        :style="{ backgroundColor: getAvatarColor(member.real_name) }"
                      >
                        {{ getInitials(member.real_name) }}
                      </a-avatar>
                      <div class="member-info">
                        <div class="member-name">{{ member.real_name }}</div>
                        <div class="member-email">{{ member.email }}</div>
                      </div>
                      <a-button 
                        type="text" 
                        danger 
                        size="small"
                        @click="removeMember(member.id, 2)"
                      >
                        移除
                      </a-button>
                    </div>
                  </div>
                </div>
              </a-tab-pane>

              <!-- 绑定资源 -->
              <a-tab-pane key="resources" tab="绑定资源">
                <div class="resources-section">
                  <div class="section-header">
                    <h4>绑定资源 ({{ selectedNode.tree_local_resources?.length || 0 }})</h4>
                    <a-button 
                      type="primary" 
                      size="small" 
                      @click="handleBindResource"
                    >
                      绑定资源
                    </a-button>
                  </div>
                  <div class="resource-list">
                    <div 
                      v-for="resource in selectedNode.tree_local_resources" 
                      :key="resource.id" 
                      class="resource-item"
                    >
                      <div class="resource-icon">
                        <Icon icon="carbon:server" />
                      </div>
                      <div class="resource-info">
                        <div class="resource-name">{{ resource.name }}</div>
                        <div class="resource-address">{{ resource.ip_addr }}:{{ resource.port }}</div>
                        <a-tag 
                          :color="getResourceStatusColor(resource.status)" 
                          size="small"
                        >
                          {{ getResourceStatusText(resource.status) }}
                        </a-tag>
                      </div>
                      <a-button 
                        type="text" 
                        danger 
                        size="small"
                        @click="handleUnbindResource(resource.id)"
                      >
                        解绑
                      </a-button>
                    </div>
                  </div>
                </div>
              </a-tab-pane>
            </a-tabs>
          </a-card>

          <!-- 空状态 -->
          <a-card v-else class="empty-card">
            <a-empty description="请选择一个节点查看详情" />
          </a-card>
        </a-col>
      </a-row>
    </div>

    <!-- 创建/编辑节点对话框 -->
    <a-modal 
      :open="formDialogVisible" 
      :title="formDialog.isEdit ? '编辑节点' : '创建节点'" 
      :width="formDialogWidth"
      @ok="saveNode" 
      @cancel="closeFormDialog" 
      :destroy-on-close="true" 
      class="responsive-modal node-modal"
    >
      <a-form 
        ref="formRef" 
        :model="formDialog.form" 
        :rules="formRules" 
        layout="vertical"
      >
        <div class="form-section">
          <div class="section-title">基本信息</div>
          <a-row :gutter="16">
            <a-col :xs="24" :sm="12">
              <a-form-item 
                label="节点名称" 
                name="name" 
                :rules="[{ required: true, message: '请输入节点名称' }]"
              >
                <a-input 
                  v-model:value="formDialog.form.name" 
                  placeholder="请输入节点名称" 
                />
              </a-form-item>
            </a-col>
            <a-col :xs="24" :sm="12">
              <a-form-item label="父节点" name="parent_id">
                <a-tree-select
                  v-model:value="formDialog.form.parent_id"
                  :tree-data="treeData"
                  :field-names="{ children: 'children', label: 'name', value: 'id' }"
                  placeholder="请选择父节点"
                  allow-clear
                  tree-default-expand-all
                />
              </a-form-item>
            </a-col>
          </a-row>
          <a-row :gutter="16">
            <a-col :span="24">
              <a-form-item label="节点描述" name="description">
                <a-textarea 
                  v-model:value="formDialog.form.description" 
                  placeholder="请输入节点描述" 
                  :rows="3"
                />
              </a-form-item>
            </a-col>
          </a-row>
          <a-row :gutter="16">
            <a-col :xs="24" :sm="12">
              <a-form-item label="节点状态" name="status">
                <a-select v-model:value="formDialog.form.status" placeholder="请选择状态">
                  <a-select-option :value="1">活跃</a-select-option>
                  <a-select-option :value="2">非活跃</a-select-option>
                </a-select>
              </a-form-item>
            </a-col>
            <a-col :xs="24" :sm="12">
              <a-form-item label="是否叶子节点" name="is_leaf">
                <a-switch 
                  :checked="formDialog.form.is_leaf === 1"
                  @change="(checked: boolean) => formDialog.form.is_leaf = checked ? 1 : 2"
                  class="tech-switch" 
                />
              </a-form-item>
            </a-col>
          </a-row>
        </div>
      </a-form>
    </a-modal>

    <!-- 移动节点对话框 -->
    <a-modal 
      :open="moveDialogVisible" 
      title="移动节点" 
      @ok="handleMoveNode" 
      @cancel="closeMoveDialog"
    >
      <a-form layout="vertical">
        <a-form-item label="选择新的父节点">
          <a-tree-select
            v-model:value="moveDialog.newParentId"
            :tree-data="treeData"
            :field-names="{ children: 'children', label: 'name', value: 'id' }"
            placeholder="请选择新的父节点"
            allow-clear
            tree-default-expand-all
          />
        </a-form-item>
      </a-form>
    </a-modal>

    <!-- 添加成员对话框 -->
    <a-modal 
      :open="addMemberDialogVisible" 
      title="添加成员" 
      @ok="handleAddMemberConfirm" 
      @cancel="closeAddMemberDialog"
      :width="600"
    >
      <a-form layout="vertical">
        <a-form-item label="搜索用户">
          <a-input-search
            v-model:value="userSearchQuery"
            placeholder="搜索用户名或邮箱"
            @search="handleUserSearch"
            enter-button
          />
        </a-form-item>
        <a-form-item label="选择用户">
          <a-select
            v-model:value="addMemberDialog.selectedUsers"
            mode="multiple"
            placeholder="请选择用户"
            :options="userOptions"
            :field-names="{ label: 'real_name', value: 'id' }"
            show-search
            :filter-option="filterUserOption"
          />
          <div class="user-option-extra" v-if="userOptions.length > 0">
            <div class="user-option-list">
              <div v-for="user in userOptions" :key="user.id" class="user-option-item">
                <div class="user-option-info">
                  <div class="user-name">{{ user.real_name }}</div>
                  <div class="user-email">{{ user.email }}</div>
                </div>
              </div>
            </div>
            <a-pagination
              v-model:current="userPagination.current"
              v-model:pageSize="userPagination.pageSize"
              :total="userPagination.total"
              @change="handleUserPaginationChange"
              size="small"
              :show-size-changer="true"
              :show-total="userPagination.showTotal"
            />
          </div>
          <a-empty v-else description="没有找到用户" />
        </a-form-item>
      </a-form>
    </a-modal>

    <!-- 绑定资源对话框 -->
    <a-modal 
      :open="bindResourceDialogVisible" 
      title="绑定资源" 
      @ok="handleBindResourceConfirm" 
      @cancel="closeBindResourceDialog"
      :width="800"
    >
      <div class="bind-resource-content">
        <a-table
          :data-source="availableResources"
          :columns="resourceColumns"
          :row-selection="resourceRowSelection"
          :pagination="resourcePagination"
          :loading="resourceLoading"
          row-key="id"
          size="small"
        >
          <template #bodyCell="{ column, record }">
            <template v-if="column.key === 'status'">
              <a-tag :color="getResourceStatusColor(record.status)">
                {{ getResourceStatusText(record.status) }}
              </a-tag>
            </template>
            <template v-if="column.key === 'address'">
              {{ record.ip_addr }}:{{ record.port }}
            </template>
          </template>
        </a-table>
      </div>
    </a-modal>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted, computed, watch } from 'vue';
import { message, Modal } from 'ant-design-vue';
import {
  PlusOutlined,
  DownOutlined
} from '@ant-design/icons-vue';
import { Icon } from '@iconify/vue';
import {
  getTreeList,
  getNodeDetail,
  createNode,
  updateNode,
  deleteNode,
  removeNodeMember,
  bindResource,
  unbindResource,
  addNodeMember,
  moveNode,
  type TreeNode,
  type GetTreeNodeListReq,
  type CreateTreeNodeReq,
  type UpdateTreeNodeReq,
  TreeNodeStatus,
  TreeNodeMemberType
} from '#/api/core/tree/tree_node';

import { getUserList, type GetUserListReq } from '#/api/core/system/user';
import { getTreeLocalList, type GetTreeLocalResourceListReq, type TreeLocalResource, ResourceStatus } from '#/api/core/tree/tree_local';

// 为了兼容后端返回的节点详情结构，定义本地扩展类型
type NodeUser = { id: number; real_name: string; email?: string };
type TreeNodeWithRelations = TreeNode & {
  admins?: NodeUser[];
  members?: NodeUser[];
  tree_local_resources?: TreeLocalResource[];
};

// 表单引用
const formRef = ref();

const formDialogWidth = computed(() => {
  if (typeof window !== 'undefined') {
    const width = window.innerWidth;
    if (width < 768) return '95%';
    if (width < 1024) return '90%';
    return '800px';
  }
  return '800px';
});

// 状态数据
const treeLoading = ref(false);
const detailLoading = ref(false);
const resourceLoading = ref(false);
const searchQuery = ref('');
const levelFilter = ref<number | undefined>(undefined);
const statusFilter = ref<TreeNodeStatus | undefined>(undefined);

// 树状结构相关
const treeData = ref<TreeNodeWithRelations[]>([]);
const selectedKeys = ref<number[]>([]);
const expandedKeys = ref<number[]>([]);
const selectedNode = ref<TreeNodeWithRelations | null>(null);

// 防抖处理
let searchTimeout: any = null;

// 统计数据
const stats = reactive({
  total_nodes: 0,
  total_resources: 0,
  total_admins: 0,
  total_members: 0,
  active_nodes: 0,
  inactive_nodes: 0
});

// 对话框状态
const formDialogVisible = ref(false);
const moveDialogVisible = ref(false);
const addMemberDialogVisible = ref(false);
const bindResourceDialogVisible = ref(false);

// 表单对话框数据
const formDialog = reactive({
  isEdit: false,
  form: {
    id: undefined as number | undefined,
    name: '',
    parent_id: undefined as number | undefined,
    description: '',
    status: TreeNodeStatus.ACTIVE,
    is_leaf: 1 | 2
  }
});

// 移动节点对话框数据
const moveDialog = reactive({
  nodeId: undefined as number | undefined,
  newParentId: undefined as number | undefined
});

// 添加成员对话框数据
const addMemberDialog = reactive({
  nodeId: undefined as number | undefined,
  memberType: TreeNodeMemberType.AdminRole,
  selectedUsers: [] as number[]
});

// 用户选项和资源相关
const userOptions = ref<any[]>([]);
const availableResources = ref<TreeLocalResource[]>([]);
const selectedResourceIds = ref<number[]>([]);

// 用户分页配置
const userPagination = reactive({
  current: 1,
  pageSize: 10,
  total: 0,
  showSizeChanger: true,
  showTotal: (total: number) => `共 ${total} 条记录`
});

// 用户搜索
const userSearchQuery = ref('');

// 资源表格配置
const resourceColumns = [
  { title: '资源名称', dataIndex: 'name', key: 'name' },
  { title: '地址', key: 'address' },
  { title: '状态', dataIndex: 'status', key: 'status' },
  { title: '环境', dataIndex: 'environment', key: 'environment' },
  { title: '描述', dataIndex: 'description', key: 'description' }
];

const resourceRowSelection = {
  selectedRowKeys: selectedResourceIds,
  onChange: (selectedRowKeys: number[]) => {
    selectedResourceIds.value = selectedRowKeys;
  }
};

const resourcePagination = reactive({
  current: 1,
  pageSize: 10,
  total: 0,
  showSizeChanger: true,
  showTotal: (total: number) => `共 ${total} 条记录`
});

// 表单验证规则
const formRules = {
  name: [
    { required: true, message: '请输入节点名称', trigger: 'blur' },
    { min: 2, max: 50, message: '长度应为2到50个字符', trigger: 'blur' }
  ]
};


const getNodeIconClass = (node: TreeNodeWithRelations): string => {
  return node.status === TreeNodeStatus.ACTIVE ? 'node-icon-active' : 'node-icon-inactive';
};

const getAvatarColor = (name: string): string => {
  const colors = ['#1890ff', '#52c41a', '#faad14', '#f5222d', '#722ed1', '#13c2c2', '#eb2f96', '#fa8c16'];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length]!;
};

const getInitials = (name: string): string => {
  if (!name) return '';
  return name.slice(0, 2).toUpperCase();
};

const formatFullDateTime = (dateString?: string): string => {
  if (!dateString) return '';
  return new Date(dateString).toLocaleString('zh-CN');
};

const getResourceStatusColor = (status: ResourceStatus): string => {
  const statusColorMap = {
    [ResourceStatus.RUNNING]: 'success',
    [ResourceStatus.STOPPED]: 'default',
    [ResourceStatus.STARTING]: 'processing',
    [ResourceStatus.STOPPING]: 'warning',
    [ResourceStatus.RESTARTING]: 'processing',
    [ResourceStatus.DELETING]: 'error',
    [ResourceStatus.ERROR]: 'error'
  };
  return statusColorMap[status] || 'default';
};

const getResourceStatusText = (status: ResourceStatus): string => {
  const statusTextMap = {
    [ResourceStatus.RUNNING]: '运行中',
    [ResourceStatus.STOPPED]: '已停止',
    [ResourceStatus.STARTING]: '启动中',
    [ResourceStatus.STOPPING]: '停止中',
    [ResourceStatus.RESTARTING]: '重启中',
    [ResourceStatus.DELETING]: '删除中',
    [ResourceStatus.ERROR]: '错误'
  };
  return statusTextMap[status] || '未知';
};

const filterUserOption = (input: string, option: any) => {
  return option.real_name?.toLowerCase().includes(input.toLowerCase()) ||
         option.email?.toLowerCase().includes(input.toLowerCase());
};

// 更新统计数据
const updateStats = (nodes: TreeNodeWithRelations[]): void => {
  stats.total_nodes = nodes.length;
  stats.active_nodes = nodes.filter(node => node.status === TreeNodeStatus.ACTIVE).length;
  stats.inactive_nodes = nodes.filter(node => node.status === TreeNodeStatus.INACTIVE).length;
  stats.total_resources = nodes.reduce((total, node) => total + (node.tree_local_resources?.length || 0), 0);
  stats.total_admins = nodes.reduce((total, node) => total + (node.admins?.length || 0), 0);
  stats.total_members = nodes.reduce((total, node) => total + (node.members?.length || 0), 0);
};

// 数据加载
const loadTreeData = async (): Promise<void> => {
  treeLoading.value = true;
  try {
    const params: GetTreeNodeListReq = {
      level: levelFilter.value,
      status: statusFilter.value
    };

    const response = await getTreeList(params);
    if (response && response.items) {
      let nodes = response.items as TreeNodeWithRelations[];
      
      // 应用搜索过滤
      if (searchQuery.value) {
        nodes = nodes.filter((node: TreeNodeWithRelations) => 
          node.name.toLowerCase().includes(searchQuery.value.toLowerCase())
        );
      }
      
      // 由于接口返回的已经是树状结构，直接使用
      treeData.value = nodes;
      updateStats(nodes);
    }
  } catch (error: any) {
    console.error('加载树状数据失败:', error);
    message.error(error.message || '加载树状数据失败');
  } finally {
    treeLoading.value = false;
  }
};

// 加载用户列表
const loadUserList = async (): Promise<void> => {
  try {
    const params: GetUserListReq = {
      page: userPagination.current,
      size: userPagination.pageSize,
      search: userSearchQuery.value
    };
    const response = await getUserList(params);
    if (response && response.items) {
      userOptions.value = response.items;
      userPagination.total = response.total || 0;
      console.log('Loaded users:', userOptions.value.length, 'Total:', userPagination.total);
    } else {
      console.error('加载用户列表响应格式异常:', response);
      message.error('加载用户列表失败: 响应格式异常');
    }
  } catch (error: any) {
    console.error('加载用户列表失败:', error);
    message.error(error.message || '加载用户列表失败');
  }
};

// 处理用户分页变化
const handleUserPaginationChange = (page: number, pageSize: number) => {
  userPagination.current = page;
  userPagination.pageSize = pageSize;
  loadUserList();
};

// 处理用户搜索
const handleUserSearch = () => {
  userPagination.current = 1; // 重置到第一页
  loadUserList();
};

// 加载可用资源列表
const loadAvailableResources = async (): Promise<void> => {
  resourceLoading.value = true;
  try {
    const params: GetTreeLocalResourceListReq = {
      page: resourcePagination.current,
      size: resourcePagination.pageSize
    };
    const response = await getTreeLocalList(params);
    if (response && response.items) {
      availableResources.value = response.items;
      resourcePagination.total = response.total || 0;
    }
  } catch (error: any) {
    console.error('加载资源列表失败:', error);
    message.error(error.message || '加载资源列表失败');
  } finally {
    resourceLoading.value = false;
  }
};

// 树状结构事件处理
const handleTreeSelect = async (selectedKeys: number[]): Promise<void> => {
  if (selectedKeys.length > 0) {
    const nodeId = selectedKeys[0];
    detailLoading.value = true;
    try {
      const response = await getNodeDetail(nodeId!);
      selectedNode.value = response as TreeNodeWithRelations;
    } catch (error: any) {
      console.error('获取节点详情失败:', error);
      message.error(error.message || '获取节点详情失败');
    } finally {
      detailLoading.value = false;
    }
  } else {
    selectedNode.value = null;
  }
};

const handleTreeExpand = (): void => {
  // 处理树节点展开
};

const refreshTree = (): void => {
  loadTreeData();
};

// 搜索和筛选事件处理
const handleSearch = (): void => {
  loadTreeData();
};

const handleSearchChange = (): void => {
  if (searchTimeout) {
    clearTimeout(searchTimeout);
  }
  searchTimeout = setTimeout(() => {
    loadTreeData();
  }, 500);
};

const handleLevelChange = (): void => {
  loadTreeData();
};

const handleStatusChange = (): void => {
  loadTreeData();
};

const handleResetFilters = (): void => {
  searchQuery.value = '';
  levelFilter.value = undefined;
  statusFilter.value = undefined;
  loadTreeData();
  message.success('过滤条件已重置');
};

// 节点操作事件处理
const handleCreateNode = (): void => {
  formDialog.isEdit = false;
  resetFormDialog();
  formDialogVisible.value = true;
};

const handleEditNode = (record: TreeNodeWithRelations): void => {
  formDialog.isEdit = true;
  formDialog.form = {
    id: record.id,
    name: record.name,
    parent_id: record.parent_id || undefined,
    description: record.description,
    status: record.status,
    is_leaf: record.is_leaf
  };
  formDialogVisible.value = true;
};

const handleMenuClick = async (command: string, record: TreeNodeWithRelations): Promise<void> => {
  switch (command) {
    case 'members':
      break;
    case 'resources':
      handleBindResource();
      break;
    case 'move':
      handleMoveNodeDialog(record);
      break;
    case 'children':
      handleCreateChildNode(record);
      break;
    case 'delete':
      confirmDelete(record);
      break;
  }
};

const handleMoveNodeDialog = (record: TreeNodeWithRelations): void => {
  moveDialog.nodeId = record.id;
  moveDialog.newParentId = record.parent_id || undefined;
  moveDialogVisible.value = true;
};

const handleCreateChildNode = (record: TreeNodeWithRelations): void => {
  formDialog.isEdit = false;
  resetFormDialog();
  formDialog.form.parent_id = record.id;
  formDialogVisible.value = true;
};

const handleAddMember = (memberType: TreeNodeMemberType): void => {
  if (!selectedNode.value) return;
  addMemberDialog.nodeId = selectedNode.value.id;
  addMemberDialog.memberType = memberType;
  addMemberDialog.selectedUsers = [];
  // 确保用户列表已加载
  if (userOptions.value.length === 0) {
    loadUserList().then(() => {
      addMemberDialogVisible.value = true;
    });
  } else {
    addMemberDialogVisible.value = true;
  }
};

const handleBindResource = (): void => {
  if (!selectedNode.value) return;
  selectedResourceIds.value = [];
  loadAvailableResources();
  bindResourceDialogVisible.value = true;
};

const handleUnbindResource = async (resourceId: number): Promise<void> => {
  if (!selectedNode.value) return;
  
  try {
    await unbindResource({
      node_id: selectedNode.value.id,
      resource_id: resourceId
    });
    message.success('资源解绑成功');
    // 重新加载节点详情
    handleTreeSelect([selectedNode.value.id]);
    loadTreeData();
  } catch (error: any) {
    console.error('解绑资源失败:', error);
    message.error(error.message || '解绑资源失败');
  }
};

const removeMember = async (userId: number, memberType: TreeNodeMemberType): Promise<void> => {
  if (!selectedNode.value) return;
  
  try {
    await removeNodeMember(selectedNode.value.id, {
      node_id: selectedNode.value.id,
      user_id: userId,
      member_type: memberType
    });
    
    message.success('成员已移除');
    // 重新加载节点详情
    handleTreeSelect([selectedNode.value.id]);
    loadTreeData();
  } catch (error: any) {
    console.error('移除成员失败:', error);
    message.error(error.message || '移除成员失败');
  }
};

const confirmDelete = (record: TreeNode): void => {
  Modal.confirm({
    title: '警告',
    content: `确定要删除节点 "${record.name}" 吗？删除后将无法恢复！`,
    okText: '删除',
    okButtonProps: { danger: true },
    cancelText: '取消',
    async onOk() {
      try {
        await deleteNode(record.id);
        message.success(`节点 "${record.name}" 已删除`);
        selectedNode.value = null;
        selectedKeys.value = [];
        loadTreeData();
      } catch (error: any) {
        console.error('删除节点失败:', error);
        message.error(error.message || '删除节点失败');
      }
    }
  });
};

// 对话框确认事件处理
const saveNode = async (): Promise<void> => {
  if (!formDialog.form.name.trim()) {
    message.error('节点名称不能为空');
    return;
  }

  try {
    const formData = {
      name: formDialog.form.name,
      parent_id: formDialog.form.parent_id,
      description: formDialog.form.description,
      status: formDialog.form.status,
      is_leaf: formDialog.form.is_leaf
    };

    if (formDialog.isEdit && formDialog.form.id) {
      const updateData: UpdateTreeNodeReq = {
        id: formDialog.form.id,
        ...formData
      };
      await updateNode(formDialog.form.id, updateData);
      message.success(`节点 "${formDialog.form.name}" 已更新`);
    } else {
      const createData: CreateTreeNodeReq = formData;
      await createNode(createData);
      message.success(`节点 "${formDialog.form.name}" 已创建`);
    }

    formDialogVisible.value = false;
    loadTreeData();
    
    // 如果是编辑模式，重新选择该节点
    if (formDialog.isEdit && formDialog.form.id) {
      selectedKeys.value = [formDialog.form.id];
      handleTreeSelect([formDialog.form.id]);
    }
  } catch (error: any) {
    console.error('保存节点失败:', error);
    message.error(error.message || '保存节点失败');
  }
};

const handleMoveNode = async (): Promise<void> => {
  if (!moveDialog.nodeId || moveDialog.newParentId === undefined) {
    message.error('请选择新的父节点');
    return;
  }

  try {
    await moveNode(moveDialog.nodeId, {
      id: moveDialog.nodeId,
      new_parent_id: moveDialog.newParentId
    });
    message.success('节点移动成功');
    moveDialogVisible.value = false;
    loadTreeData();
    
    // 重新选择该节点
    selectedKeys.value = [moveDialog.nodeId];
    handleTreeSelect([moveDialog.nodeId]);
  } catch (error: any) {
    console.error('移动节点失败:', error);
    message.error(error.message || '移动节点失败');
  }
};

const handleAddMemberConfirm = async (): Promise<void> => {
  if (!addMemberDialog.nodeId || addMemberDialog.selectedUsers.length === 0) {
    message.error('请选择要添加的用户');
    return;
  }

  try {
    for (const userId of addMemberDialog.selectedUsers) {
      await addNodeMember({
        node_id: addMemberDialog.nodeId,
        user_id: userId,
        member_type: addMemberDialog.memberType
      });
    }
    
    message.success('成员添加成功');
    addMemberDialogVisible.value = false;
    
    // 重新加载节点详情
    if (selectedNode.value) {
      handleTreeSelect([selectedNode.value.id]);
    }
    loadTreeData();
  } catch (error: any) {
    console.error('添加成员失败:', error);
    message.error(error.message || '添加成员失败');
  }
};

const handleBindResourceConfirm = async (): Promise<void> => {
  if (!selectedNode.value || selectedResourceIds.value.length === 0) {
    message.error('请选择要绑定的资源');
    return;
  }

  try {
    await bindResource({
      node_id: selectedNode.value.id,
      resource_ids: selectedResourceIds.value
    });
    
    message.success('资源绑定成功');
    bindResourceDialogVisible.value = false;
    
    // 重新加载节点详情
    handleTreeSelect([selectedNode.value.id]);
    loadTreeData();
  } catch (error: any) {
    console.error('绑定资源失败:', error);
    message.error(error.message || '绑定资源失败');
  }
};

// 对话框关闭事件处理
const closeFormDialog = (): void => {
  formDialogVisible.value = false;
};

const closeMoveDialog = (): void => {
  moveDialogVisible.value = false;
};

const closeAddMemberDialog = (): void => {
  addMemberDialogVisible.value = false;
  // 重置用户搜索和分页
  userSearchQuery.value = '';
  userPagination.current = 1;
};

const closeBindResourceDialog = (): void => {
  bindResourceDialogVisible.value = false;
};

// 重置表单对话框
const resetFormDialog = (): void => {
  formDialog.form = {
    id: undefined,
    name: '',
    parent_id: undefined,
    description: '',
    status: TreeNodeStatus.ACTIVE,
    is_leaf: 1
  };
};

// 监听选中节点变化
watch(selectedKeys, (newKeys) => {
  if (newKeys.length > 0) {
    expandedKeys.value = [...new Set([...expandedKeys.value, ...newKeys])];
  }
});

// 生命周期钩子
onMounted(() => {
  loadTreeData();
  loadUserList();
});
</script>

<style scoped>
.tree-node-container {
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
  /* Use Ant Design default primary button visuals */
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

.content-layout {
  margin-bottom: 24px;
}

.tree-card {
  max-height: 70vh;
  overflow: auto;
}

.tree-header {
  display: flex;
  align-items: center;
  gap: 8px;
}

.node-tree {
  max-height: 62vh;
  overflow-y: auto;
}

.tree-node-title {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  padding-right: 8px;
}

.tree-node-badges {
  display: flex;
  gap: 4px;
}

.node-icon-active {
  color: #52c41a;
}

.node-icon-inactive {
  color: #d9d9d9;
}

.detail-card,
.empty-card {
  max-height: 70vh;
  overflow: auto;
}

.detail-header {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
}

.detail-actions {
  margin-left: auto;
  display: flex;
  gap: 8px;
}

.members-section,
.resources-section {
  max-height: 52vh;
  overflow-y: auto;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
  padding-bottom: 8px;
  border-bottom: 1px solid #f0f0f0;
}

.section-header h4 {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
}

.member-list,
.resource-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 24px;
}

.member-item,
.resource-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  border: 1px solid #f0f0f0;
  border-radius: 6px;
  transition: all 0.3s;
}

.member-item:hover,
.resource-item:hover {
  border-color: #1890ff;
  box-shadow: 0 2px 8px rgba(24, 144, 255, 0.1);
}

.member-info,
.resource-info {
  flex: 1;
}

.member-name,
.resource-name {
  font-weight: 500;
  font-size: 14px;
  margin-bottom: 4px;
}

.member-email,
.resource-address {
  font-size: 12px;
  color: #8c8c8c;
  margin-bottom: 4px;
}

.resource-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  background-color: #f5f5f5;
  border-radius: 6px;
  color: #1890ff;
  font-size: 18px;
}

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
  border-left: 3px solid #1677ff;
}

.tech-switch {}

.tech-switch.ant-switch-checked {}

.bind-resource-content {
  max-height: 400px;
  overflow-y: auto;
}

/* 响应式设计 */
@media (max-width: 1200px) {
  .tree-card {
    max-height: 65vh;
  }
  
  .detail-card,
  .empty-card {
    max-height: 65vh;
  }
  
  .node-tree {
    max-height: 58vh;
  }
}

@media (max-width: 992px) {
  .content-layout {
    margin-bottom: 20px;
  }
  
  .tree-card,
  .detail-card,
  .empty-card {
    max-height: 60vh;
  }
  
  .node-tree {
    max-height: 52vh;
  }
  
  .members-section,
  .resources-section {
    max-height: 50vh;
  }
}

@media (max-width: 768px) {
  .tree-node-container {
    padding: 8px;
  }

  .header-actions {
    flex-direction: column;
    align-items: stretch;
    gap: 16px;
  }

  .search-filters {
    width: 100%;
    flex-direction: column;
    gap: 8px;
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
    width: 100%;
    justify-content: center;
  }

  .stats-card :deep(.ant-statistic-title) {
    font-size: 12px;
  }

  .stats-card :deep(.ant-statistic-content) {
    font-size: 16px;
  }

  .tree-card,
  .detail-card,
  .empty-card {
    max-height: none;
    min-height: 360px;
    margin-bottom: 16px;
  }

  .node-tree,
  .members-section,
  .resources-section {
    max-height: 320px;
  }

  .member-item,
  .resource-item {
    flex-direction: column;
    text-align: center;
    gap: 8px;
    padding: 16px 8px;
  }

  .section-header {
    flex-direction: column;
    gap: 8px;
    align-items: stretch;
  }

  .detail-actions {
    margin-left: 0;
    justify-content: center;
    flex-wrap: wrap;
  }
  
  .detail-actions .ant-btn {
    flex: 1;
    min-width: 80px;
  }
}

@media (max-width: 480px) {
  .tree-node-container {
    padding: 4px;
  }

  .header-actions {
    gap: 8px;
  }

  .stats-card {
    text-align: center;
  }

  .tree-node-badges {
    flex-direction: column;
    gap: 2px;
  }

  .detail-header {
    flex-direction: column;
    gap: 8px;
    align-items: stretch;
  }
  
  .tree-card,
  .detail-card,
  .empty-card {
    min-height: 320px;
  }
  
  .node-tree,
  .members-section,
  .resources-section {
    max-height: 300px;
  }
  
  .member-item,
  .resource-item {
    padding: 12px 4px;
  }
  
  .stats-row {
    margin-bottom: 16px;
  }
  
  .content-layout {
    margin-bottom: 16px;
  }
  
  .page-header {
    margin-bottom: 16px;
  }
}

/* 表格滚动优化 */
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
  
  .responsive-modal :deep(.ant-form-item) {
    margin-bottom: 16px;
  }
  
  .responsive-modal :deep(.ant-form-item-label) {
    padding-bottom: 4px;
  }
  
  .responsive-modal :deep(.ant-modal-footer) {
    padding: 12px 16px;
  }
}

@media (max-width: 480px) {
  .responsive-modal :deep(.ant-modal) {
    margin: 4px;
    max-width: calc(100vw - 8px);
  }
  
  .responsive-modal :deep(.ant-modal-body) {
    padding: 12px;
    max-height: calc(100vh - 140px);
  }
  
  .responsive-modal :deep(.ant-modal-header) {
    padding: 12px 16px;
  }
  
  .responsive-modal :deep(.ant-modal-title) {
    font-size: 16px;
  }
  
  .responsive-modal :deep(.ant-form-item) {
    margin-bottom: 12px;
  }
  
  .bind-resource-content {
    max-height: 300px;
  }
}

/* 表格和列表移动端优化 */
@media (max-width: 768px) {
  .bind-resource-content :deep(.ant-table) {
    font-size: 12px;
  }
  
  .bind-resource-content :deep(.ant-table-thead > tr > th) {
    font-size: 12px;
    padding: 8px 4px;
  }
  
  .bind-resource-content :deep(.ant-table-tbody > tr > td) {
    padding: 8px 4px;
  }
  
  .bind-resource-content :deep(.ant-table-cell) {
    word-break: break-all;
    white-space: normal;
  }
  
  .bind-resource-content :deep(.ant-pagination) {
    margin-top: 12px;
  }
}

@media (max-width: 480px) {
  .bind-resource-content :deep(.ant-table) {
    font-size: 11px;
  }
  
  .bind-resource-content :deep(.ant-table-thead > tr > th) {
    font-size: 11px;
    padding: 6px 2px;
  }
  
  .bind-resource-content :deep(.ant-table-tbody > tr > td) {
    padding: 6px 2px;
  }
  
  .bind-resource-content :deep(.ant-table-cell) {
    word-break: break-all;
    white-space: normal;
  }
  
  .bind-resource-content :deep(.ant-pagination) {
    margin-top: 8px;
  }
  
  .bind-resource-content :deep(.ant-pagination-item) {
    min-width: 24px;
    height: 24px;
    line-height: 22px;
  }
  
  .bind-resource-content :deep(.ant-pagination-prev),
  .bind-resource-content :deep(.ant-pagination-next) {
    min-width: 24px;
    height: 24px;
    line-height: 22px;
  }
}

/* 用户选项样式 */
.user-option-extra {
  margin-top: 12px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.user-option-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-height: 240px;
  overflow-y: auto;
  padding: 8px;
  border: 1px solid #f0f0f0;
  border-radius: 4px;
}

.user-option-item {
  display: flex;
  align-items: center;
  padding: 8px;
  border-radius: 4px;
  transition: all 0.2s;
  border: 1px solid transparent;
}

.user-option-item:hover {
  background-color: #f5f5f5;
  border-color: #e6e6e6;
}

.user-option-info {
  flex: 1;
}

.user-name {
  font-weight: 500;
  margin-bottom: 2px;
}

.user-email {
  font-size: 12px;
  color: #8c8c8c;
}

/* 树状结构样式优化 */
.node-tree :deep(.ant-tree-treenode) {
  padding: 4px 0;
}

.node-tree :deep(.ant-tree-node-content-wrapper) {
  border-radius: 4px;
  transition: all 0.3s;
}

.node-tree :deep(.ant-tree-node-content-wrapper:hover) {
  background-color: #f5f5f5;
}

.node-tree :deep(.ant-tree-node-selected .ant-tree-node-content-wrapper) {
  background-color: #e6f7ff;
  border: 1px solid #1890ff;
}

.node-tree :deep(.ant-tree-title) {
  width: 100%;
}

/* 树状结构移动端优化 */
@media (max-width: 768px) {
  .node-tree :deep(.ant-tree-treenode) {
    padding: 6px 0;
  }
  
  .node-tree :deep(.ant-tree-node-content-wrapper) {
    padding: 4px 8px;
  }
  
  .node-tree :deep(.ant-tree-switcher) {
    width: 20px;
    height: 20px;
    line-height: 20px;
  }
  
  .node-tree :deep(.ant-tree-icon__customize) {
    font-size: 14px;
  }
  
  .tree-node-title {
    font-size: 13px;
  }
  
  .tree-node-badges :deep(.ant-tag) {
    font-size: 10px;
    padding: 1px 4px;
    height: auto;
    line-height: 1.2;
  }
}

@media (max-width: 480px) {
  .node-tree :deep(.ant-tree-treenode) {
    padding: 8px 0;
  }
  
  .node-tree :deep(.ant-tree-node-content-wrapper) {
    padding: 6px 8px;
  }
  
  .node-tree :deep(.ant-tree-switcher) {
    width: 18px;
    height: 18px;
    line-height: 18px;
  }
  
  .node-tree :deep(.ant-tree-icon__customize) {
    font-size: 12px;
  }
  
  .tree-node-title {
    font-size: 12px;
  }
  
  .tree-node-badges :deep(.ant-tag) {
    font-size: 9px;
    padding: 1px 3px;
    height: auto;
    line-height: 1.1;
  }
}

/* 触摸交互优化 */
@media (hover: none) and (pointer: coarse) {
  .member-item,
  .resource-item {
    min-height: 48px;
    padding: 12px;
  }
  
  .node-tree :deep(.ant-tree-node-content-wrapper) {
    min-height: 44px;
    display: flex;
    align-items: center;
  }
  
  .btn-create,
  .reset-btn,
  .detail-actions .ant-btn {
    min-height: 44px;
    min-width: 44px;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  
  .search-input :deep(.ant-input),
  .filter-select :deep(.ant-select-selector) {
    min-height: 44px;
  }
  
  .search-input :deep(.ant-input),
  .filter-select :deep(.ant-select-selector) {
    padding: 8px 12px;
    font-size: 16px;
  }
  
  .member-item .ant-btn,
  .resource-item .ant-btn {
    min-height: 40px;
    min-width: 40px;
  }
  
  .tree-node-badges :deep(.ant-tag) {
    min-height: 24px;
    display: inline-flex;
    align-items: center;
  }
}
</style>
