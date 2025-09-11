<template>
  <div class="local-resource-management">
    <!-- 页面标题 -->
    <div class="page-header">
      <div class="header-actions">
        <a-button type="primary" @click="handleTestConnection" class="btn-action">
          <template #icon>
            <api-outlined />
          </template>
          <span class="btn-text">批量测试连接</span>
        </a-button>
        <a-button type="primary" @click="showCreateModal" class="btn-create">
          <template #icon>
            <plus-outlined />
          </template>
          <span class="btn-text">添加服务器</span>
        </a-button>
        <div class="search-filters">
          <a-select
            v-model:value="filterForm.status"
            placeholder="连接状态"
            allow-clear
            class="filter-select"
            @change="handleSearch"
          >
            <a-select-option :value="ResourceStatus.RUNNING">运行中</a-select-option>
            <a-select-option :value="ResourceStatus.STOPPED">已停止</a-select-option>
            <a-select-option :value="ResourceStatus.STARTING">启动中</a-select-option>
            <a-select-option :value="ResourceStatus.STOPPING">停止中</a-select-option>
            <a-select-option :value="ResourceStatus.RESTARTING">重启中</a-select-option>
            <a-select-option :value="ResourceStatus.ERROR">错误</a-select-option>
          </a-select>
          <a-button @click="resetFilter" class="reset-btn">
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
              title="总服务器" 
              :value="localResources.length" 
              :value-style="{ color: '#3f8600' }"
            >
              <template #prefix>
                <desktop-outlined />
              </template>
            </a-statistic>
          </a-card>
        </a-col>
        <a-col :xs="12" :sm="6" :md="6" :lg="6">
          <a-card class="stats-card">
            <a-statistic 
              title="运行中" 
              :value="localResources.filter(item => item.status === ResourceStatus.RUNNING).length" 
              :value-style="{ color: '#52c41a' }"
            >
              <template #prefix>
                <api-outlined />
              </template>
            </a-statistic>
          </a-card>
        </a-col>
        <a-col :xs="12" :sm="6" :md="6" :lg="6">
          <a-card class="stats-card">
            <a-statistic 
              title="Linux系统" 
              :value="localResources.filter(item => item.os_type === 'linux').length" 
              :value-style="{ color: '#faad14' }"
            >
              <template #prefix>
                <desktop-outlined />
              </template>
            </a-statistic>
          </a-card>
        </a-col>
        <a-col :xs="12" :sm="6" :md="6" :lg="6">
          <a-card class="stats-card">
            <a-statistic 
              title="已绑定节点" 
              :value="localResources.filter(item => item.tree_nodes && item.tree_nodes.length > 0).length" 
              :value-style="{ color: '#cf1322' }"
            >
              <template #prefix>
                <deployment-unit-outlined />
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
          :columns="columns"
          :data-source="localResources"
          :loading="loading"
          :pagination="paginationConfig"
          @change="handleTableChange"
          row-key="id"
          :scroll="{ x: 1400 }"
          class="resource-table"
          bordered
        >
          <template #bodyCell="{ column, record }">
            <template v-if="column.key === 'name'">
              <div class="server-name-cell">
                <div class="server-badge" :class="getServerStatusClass(record)"></div>
                <span class="server-name-text">{{ record.name }}</span>
              </div>
            </template>

            <template v-if="column.key === 'status'">
              <a-badge
                :status="getStatusBadge(record.status)"
                :text="getStatusText(record.status)"
              />
            </template>

            <template v-if="column.key === 'os_type'">
              <a-tag :color="record.os_type === 'linux' ? 'blue' : 'green'" class="tech-tag">
                <windows-outlined v-if="record.os_type === 'windows'" />
                <desktop-outlined v-else />
                {{ record.os_type === 'linux' ? 'Linux' : 'Windows' }}
              </a-tag>
            </template>

            <template v-if="column.key === 'auth_mode'">
              <a-tag :color="record.auth_mode === AuthMode.PASSWORD ? 'orange' : 'purple'" class="tech-tag">
                {{ getAuthModeText(record.auth_mode) }}
              </a-tag>
            </template>

            <template v-if="column.key === 'tree_nodes'">
              <div class="tag-container">
                <template v-if="record.tree_nodes && record.tree_nodes.length > 0">
                  <a-tag 
                    v-for="node in record.tree_nodes.slice(0, 2)" 
                    :key="node.id" 
                    class="tech-tag node-tag"
                  >
                    {{ node.name }}
                  </a-tag>
                  <a-tag v-if="record.tree_nodes.length > 2" color="default">
                    +{{ record.tree_nodes.length - 2 }}
                  </a-tag>
                </template>
                <span v-else class="empty-text">未绑定</span>
              </div>
            </template>

            <template v-if="column.key === 'tags'">
              <div class="tag-container">
                <template v-if="record.tags && record.tags.length > 0">
                  <a-tag 
                    v-for="tag in record.tags.slice(0, 3)" 
                    :key="tag" 
                    class="tech-tag tag-item"
                  >
                    {{ tag }}
                  </a-tag>
                  <a-tag v-if="record.tags.length > 3" color="default">
                    +{{ record.tags.length - 3 }}
                  </a-tag>
                </template>
                <span v-else class="empty-text">无标签</span>
              </div>
            </template>

            <template v-if="column.key === 'connection_info'">
              <div class="connection-info">
                <div class="connection-item">
                  <span class="connection-label">IP:</span>
                  <span class="connection-value">{{ record.ip_addr }}</span>
                </div>
                <div class="connection-item">
                  <span class="connection-label">端口:</span>
                  <span class="connection-value">{{ record.port }}</span>
                </div>
              </div>
            </template>

            <template v-if="column.key === 'creator'">
              <div class="creator-info">
                <a-avatar 
                  size="small" 
                  :style="{ backgroundColor: getAvatarColor(record.create_user_name || '') }"
                >
                  {{ getInitials(record.create_user_name || 'Admin') }}
                </a-avatar>
                <span class="creator-name">{{ record.create_user_name || 'Admin' }}</span>
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
                <a-button type="primary" size="small" @click="handleViewDetail(record)">
                  查看
                </a-button>
                <a-button type="default" size="small" @click="handleEdit(record)">
                  编辑
                </a-button>
                <a-dropdown>
                  <template #overlay>
                    <a-menu>
                      <a-menu-item key="test" @click="handleTestSingleConnection(record)">
                        <api-outlined /> 测试连接
                      </a-menu-item>
                      <a-menu-item key="bind" @click="showBindModal(record)">
                        <deployment-unit-outlined /> 绑定服务树
                      </a-menu-item>
                      <a-menu-item 
                        key="unbind" 
                        @click="showUnbindModal(record)"
                        :disabled="!record.tree_nodes || record.tree_nodes.length === 0"
                      >
                        <deployment-unit-outlined /> 解绑服务树
                      </a-menu-item>
                      <a-menu-item key="terminal" @click="handleConnectTerminal(record)">
                        <code-outlined /> 连接终端
                      </a-menu-item>
                      <a-menu-divider />
                      <a-menu-item key="delete" @click="handleDelete(record)" danger>
                        <delete-outlined /> 删除
                      </a-menu-item>
                    </a-menu>
                  </template>
                  <a-button size="small">
                    更多
                    <down-outlined />
                  </a-button>
                </a-dropdown>
              </div>
            </template>
          </template>
        </a-table>
      </a-card>
    </div>

    <!-- 创建/编辑服务器对话框 -->
    <a-modal
      v-model:open="modalVisible"
      :title="isEdit ? '编辑服务器' : '添加服务器'"
      :width="modalWidth"
      :footer="null"
      :destroy-on-close="true"
      class="responsive-modal server-modal"
    >
      <a-form
        :model="formData"
        :rules="formRules"
        layout="vertical"
        ref="formRef"
        class="server-form"
      >
        <div class="form-section">
          <div class="section-title">基本信息</div>
          <div class="form-grid">
            <a-form-item label="服务器名称" name="name" class="form-item">
              <a-input
                v-model:value="formData.name"
                placeholder="请输入服务器名称"
              />
            </a-form-item>
            <a-form-item label="环境" name="environment" class="form-item">
              <a-select v-model:value="formData.environment" placeholder="选择环境">
                <a-select-option value="local">本地</a-select-option>
                <a-select-option value="dev">开发</a-select-option>
                <a-select-option value="test">测试</a-select-option>
                <a-select-option value="prod">生产</a-select-option>
              </a-select>
            </a-form-item>
            <a-form-item label="IP地址" name="ip_addr" class="form-item">
              <a-input
                v-model:value="formData.ip_addr"
                placeholder="192.168.1.100"
              />
            </a-form-item>
            <a-form-item label="SSH端口" name="port" class="form-item">
              <a-input-number
                v-model:value="formData.port"
                :min="1"
                :max="65535"
                style="width: 100%"
                placeholder="22"
              />
            </a-form-item>
            <a-form-item label="用户名" name="username" class="form-item">
              <a-input
                v-model:value="formData.username"
                placeholder="root"
              />
            </a-form-item>
            <a-form-item label="操作系统类型" name="os_type" class="form-item">
              <a-select v-model:value="formData.os_type" placeholder="选择操作系统">
                <a-select-option value="linux">
                  <desktop-outlined /> Linux
                </a-select-option>
                <a-select-option value="windows">
                  <windows-outlined /> Windows
                </a-select-option>
              </a-select>
            </a-form-item>
            <a-form-item label="操作系统名称" name="os_name" class="form-item">
              <a-input
                v-model:value="formData.os_name"
                placeholder="如: CentOS 7.9"
              />
            </a-form-item>
            <a-form-item label="镜像名称" name="image_name" class="form-item">
              <a-input
                v-model:value="formData.image_name"
                placeholder="如: centos-7.9-x86_64"
              />
            </a-form-item>
          </div>
        </div>

        <div class="form-section">
          <div class="section-title">认证配置</div>
          <a-form-item label="认证方式" name="auth_mode">
            <a-radio-group v-model:value="formData.auth_mode" @change="handleAuthModeChange">
              <a-radio :value="AuthMode.PASSWORD">密码认证</a-radio>
              <a-radio :value="AuthMode.KEY">密钥认证</a-radio>
            </a-radio-group>
          </a-form-item>

          <a-form-item 
            v-if="formData.auth_mode === AuthMode.PASSWORD" 
            label="登录密码" 
            name="password"
          >
            <a-input-password
              v-model:value="formData.password"
              placeholder="请输入登录密码"
              autocomplete="new-password"
            />
          </a-form-item>

          <a-form-item 
            v-if="formData.auth_mode === AuthMode.KEY" 
            label="私钥内容" 
            name="key"
          >
            <a-textarea
              v-model:value="formData.key"
              placeholder="请粘贴SSH私钥内容"
              :rows="6"
              style="font-family: 'Courier New', monospace;"
            />
          </a-form-item>
        </div>

        <div class="form-section">
          <div class="section-title">其他信息</div>
          <a-form-item label="描述信息">
            <a-textarea
              v-model:value="formData.description"
              placeholder="服务器用途描述"
              :rows="3"
            />
          </a-form-item>

          <a-form-item label="资源标签">
            <div class="tags-input">
              <div class="current-tags" v-if="formData.tags && formData.tags.length > 0">
                <a-tag
                  v-for="(tag, index) in formData.tags"
                  :key="`tag-${index}-${tag}`"
                  closable
                  @close="removeTag(index)"
                  class="tech-tag tag-item"
                >
                  {{ tag }}
                </a-tag>
              </div>
              <div class="add-tag">
                <a-input
                  ref="tagInputRef"
                  v-model:value="newTag"
                  placeholder="输入标签，按回车添加"
                  style="width: 200px; margin-right: 8px;"
                  @pressEnter="addTag"
                  @keyup.enter="addTag"
                />
                <a-button type="dashed" @click="addTag" class="add-tag-btn">
                  <plus-outlined /> 添加标签
                </a-button>
              </div>
            </div>
          </a-form-item>
        </div>

        <div class="form-actions">
          <a-button @click="modalVisible = false">取消</a-button>
          <a-button 
            type="primary" 
            @click="handleSubmit" 
            :loading="submitLoading"
            style="margin-left: 8px;"
          >
            {{ isEdit ? '更新' : '添加' }}
          </a-button>
          <a-button 
            v-if="!isEdit"
            @click="handleTestAndSubmit" 
            :loading="testLoading"
            style="margin-left: 8px;"
          >
            <api-outlined /> 测试并添加
          </a-button>
        </div>
      </a-form>
    </a-modal>

    <!-- 绑定服务树节点对话框 -->
    <a-modal
      v-model:open="bindModalVisible"
      title="绑定服务树节点"
      @ok="handleBind"
      :confirm-loading="bindLoading"
      :destroy-on-close="true"
      class="responsive-modal"
    >
      <a-form layout="vertical">
        <a-form-item label="选择要绑定的服务树节点" required>
          <a-tree-select
            v-model:value="selectedTreeNodeIds"
            style="width: 100%"
            placeholder="请选择服务树节点"
            allow-clear
            multiple
            :tree-data="treeData"
            :field-names="{ children: 'children', label: 'name', value: 'id' }"
          />
        </a-form-item>
      </a-form>
    </a-modal>

    <!-- 管理绑定对话框 -->
    <a-modal
      v-model:open="unbindModalVisible"
      title="管理服务树绑定"
      @ok="handleUnbind"
      :confirm-loading="unbindLoading"
      :destroy-on-close="true"
      class="responsive-modal"
    >
      <a-form layout="vertical">
        <a-form-item label="当前绑定的节点">
          <div v-if="currentResource?.tree_nodes && currentResource.tree_nodes.length > 0">
            <a-checkbox-group v-model:value="selectedUnbindNodeIds">
              <div v-for="node in currentResource.tree_nodes" :key="node.id" style="margin-bottom: 8px;">
                <a-checkbox :value="node.id">{{ node.name }}</a-checkbox>
              </div>
            </a-checkbox-group>
          </div>
          <a-empty v-else description="暂无绑定的节点" />
        </a-form-item>
      </a-form>
    </a-modal>

    <!-- 服务器详情抽屉 -->
    <a-drawer
      v-model:open="detailVisible"
      title="服务器详情"
      width="600"
      :destroy-on-close="true"
      class="detail-drawer"
    >
      <a-skeleton :loading="detailLoading" active>
        <template v-if="currentDetail">
          <div class="detail-content">
            <div class="detail-header">
              <h2>{{ currentDetail.name }}</h2>
              <div class="detail-badges">
                <a-badge
                  :status="getStatusBadge(currentDetail.status)"
                  :text="getStatusText(currentDetail.status)"
                />
                <a-tag :color="currentDetail.os_type === 'linux' ? 'blue' : 'green'" class="tech-tag">
                  <windows-outlined v-if="currentDetail.os_type === 'windows'" />
                  <desktop-outlined v-else />
                  {{ currentDetail.os_type === 'linux' ? 'Linux' : 'Windows' }}
                </a-tag>
              </div>
            </div>

            <a-descriptions bordered :column="1">
              <a-descriptions-item label="ID">
                {{ currentDetail.id }}
              </a-descriptions-item>
              <a-descriptions-item label="环境">
                {{ currentDetail.environment || '-' }}
              </a-descriptions-item>
              <a-descriptions-item label="IP地址">
                {{ currentDetail.ip_addr }}
              </a-descriptions-item>
              <a-descriptions-item label="SSH端口">
                {{ currentDetail.port }}
              </a-descriptions-item>
              <a-descriptions-item label="用户名">
                {{ currentDetail.username || '-' }}
              </a-descriptions-item>
              <a-descriptions-item label="系统名称">
                {{ currentDetail.os_name || '-' }}
              </a-descriptions-item>
              <a-descriptions-item label="镜像名称">
                {{ currentDetail.image_name || '-' }}
              </a-descriptions-item>
              <a-descriptions-item label="认证方式">
                <a-tag :color="currentDetail.auth_mode === AuthMode.PASSWORD ? 'orange' : 'purple'" class="tech-tag">
                  {{ getAuthModeText(currentDetail.auth_mode) }}
                </a-tag>
              </a-descriptions-item>
              <a-descriptions-item label="CPU">
                {{ currentDetail.cpu || '-' }}
              </a-descriptions-item>
              <a-descriptions-item label="内存">
                {{ currentDetail.memory || '-' }}
              </a-descriptions-item>
              <a-descriptions-item label="磁盘">
                {{ currentDetail.disk || '-' }}
              </a-descriptions-item>
              <a-descriptions-item label="描述">
                {{ currentDetail.description || '-' }}
              </a-descriptions-item>
              <a-descriptions-item label="创建时间">
                {{ formatDateTime(currentDetail.created_at) }}
              </a-descriptions-item>
              <a-descriptions-item label="更新时间">
                {{ formatDateTime(currentDetail.updated_at) }}
              </a-descriptions-item>
            </a-descriptions>

            <div class="detail-section">
              <div class="section-title">资源标签</div>
              <div class="tag-list">
                <template v-if="currentDetail.tags && currentDetail.tags.length > 0">
                  <a-tag 
                    v-for="(tag, index) in currentDetail.tags" 
                    :key="index" 
                    class="tech-tag tag-item"
                  >
                    {{ tag }}
                  </a-tag>
                </template>
                <a-empty v-else :image="Empty.PRESENTED_IMAGE_SIMPLE" description="暂无标签" />
              </div>
            </div>

            <div class="detail-section">
              <div class="section-title">绑定的服务树节点</div>
              <div class="tree-node-list">
                <template v-if="currentDetail.tree_nodes && currentDetail.tree_nodes.length > 0">
                  <a-tag 
                    v-for="node in currentDetail.tree_nodes" 
                    :key="node.id" 
                    class="tech-tag node-tag"
                  >
                    {{ node.name }}
                  </a-tag>
                </template>
                <a-empty v-else :image="Empty.PRESENTED_IMAGE_SIMPLE" description="暂无绑定节点" />
              </div>
            </div>
            
            <div class="drawer-actions">
              <a-button-group>
                <a-button type="primary" @click="handleTestSingleConnection(currentDetail)">
                  <api-outlined /> 测试连接
                </a-button>
                <a-button @click="handleEdit(currentDetail)">
                  <edit-outlined /> 编辑
                </a-button>
              </a-button-group>
              <a-button danger @click="handleDelete(currentDetail)">
                <delete-outlined /> 删除
              </a-button>
            </div>
          </div>
        </template>
      </a-skeleton>
    </a-drawer>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted, computed, nextTick } from 'vue';
import { useRouter } from 'vue-router';
import { message, Modal, Empty } from 'ant-design-vue';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  DownOutlined,
  ApiOutlined,
  WindowsOutlined,
  DesktopOutlined,
  DeploymentUnitOutlined,
  CodeOutlined,
} from '@ant-design/icons-vue';
import { useWindowSize } from '@vueuse/core';

import {
  getTreeLocalList,
  getTreeLocalDetail,
  createTreeLocal,
  updateTreeLocal,
  deleteTreeLocal,
  bindTreeLocal,
  unbindTreeLocal,
  AuthMode,
  ResourceStatus,
  type TreeLocalResource,
  type GetTreeLocalResourceListReq,
  type CreateTreeLocalResourceReq,
  type UpdateTreeLocalResourceReq,
  type BindTreeLocalResourceReq,
  type UnBindTreeLocalResourceReq,
  type TreeNode,
} from '#/api/core/tree/tree_local';
import { getTreeList } from '#/api/core/tree/tree_node';

const loading = ref(false);
const detailLoading = ref(false);
const submitLoading = ref(false);
const testLoading = ref(false);
const modalVisible = ref(false);
const detailVisible = ref(false);
const isEdit = ref(false);
const bindModalVisible = ref(false);
const bindLoading = ref(false);
const unbindModalVisible = ref(false);
const unbindLoading = ref(false);

const router = useRouter();
const { width: windowWidth } = useWindowSize();

const formRef = ref();
const newTag = ref('');
const tagInputRef = ref();
const selectedTreeNodeIds = ref<number[]>([]);
const selectedUnbindNodeIds = ref<number[]>([]);
const currentResource = ref<TreeLocalResource | null>(null);
const localResources = ref<TreeLocalResource[]>([]);
const currentDetail = ref<TreeLocalResource | null>(null);
const treeData = ref<TreeNode[]>([]);

const pagination = reactive({
  current: 1,
  pageSize: 10,
  total: 0,
  showSizeChanger: true,
  showQuickJumper: true,
  showTotal: (total: number) => `共 ${total} 条记录`,
});

const filterForm = reactive<GetTreeLocalResourceListReq>({
  page: 1,
  size: 10,
  status: undefined,
});

// 修复：使用 ref 而不是 reactive 来保证 tags 数组的响应式
const formData = ref<CreateTreeLocalResourceReq & { id?: number }>({
  name: '',
  environment: 'local',
  description: '',
  tags: [],
  ip_addr: '',
  port: 22,
  username: 'root',
  password: '',
  os_type: 'linux',
  os_name: '',
  image_name: '',
  auth_mode: AuthMode.PASSWORD,
  key: '',
});

const modalWidth = computed(() => {
  if (windowWidth.value < 768) return '95%';
  if (windowWidth.value < 1024) return '90%';
  return '900px';
});

const paginationConfig = computed(() => ({
  ...pagination,
  onChange: (page: number, pageSize: number) => handleTableChange({ current: page, pageSize }),
  onShowSizeChange: (current: number, size: number) => handleTableChange({ current, pageSize: size }),
}));

const formRules = computed(() => ({
  name: [
    { required: true, message: '请输入服务器名称', trigger: 'blur' },
    { min: 2, max: 50, message: '名称长度在2-50个字符之间', trigger: 'blur' },
  ],
  ip_addr: [
    { required: true, message: '请输入IP地址', trigger: 'blur' },
    {
      pattern: /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/,
      message: 'IP地址格式不正确',
      trigger: 'blur',
    },
  ],
  port: [
    { required: true, message: '请输入SSH端口', trigger: 'blur' },
    { type: 'number', min: 1, max: 65535, message: '端口范围为1-65535', trigger: 'blur' },
  ],
  username: [
    { required: true, message: '请输入用户名', trigger: 'blur' },
    { min: 1, max: 50, message: '用户名长度在1-50个字符之间', trigger: 'blur' },
  ],
  os_type: [{ required: true, message: '请选择操作系统类型', trigger: 'change' }],
  auth_mode: [{ required: true, message: '请选择认证方式', trigger: 'change' }],
  password:
    formData.value.auth_mode === AuthMode.PASSWORD && !isEdit.value
      ? [
          { required: true, message: '请输入登录密码', trigger: 'blur' },
          { min: 6, message: '密码长度至少6位', trigger: 'blur' },
        ]
      : [],
  key:
    formData.value.auth_mode === AuthMode.KEY
      ? [
          { required: true, message: '请输入SSH私钥', trigger: 'blur' },
          { validator: validatePrivateKey, trigger: 'blur' },
        ]
      : [],
}));

const showUnbindModal = (record: TreeLocalResource): void => {
  currentResource.value = record;
  selectedUnbindNodeIds.value = record.tree_nodes?.map(node => node.id) || [];
  unbindModalVisible.value = true;
};

// 表格列定义
const columns = [
  { title: '服务器名称', dataIndex: 'name', key: 'name', width: 200, fixed: 'left' as const },
  { title: '连接信息', dataIndex: 'connection_info', key: 'connection_info', width: 150 },
  { title: '用户名', dataIndex: 'username', key: 'username', width: 100 },
  { title: '操作系统', dataIndex: 'os_type', key: 'os_type', width: 120 },
  { title: '环境', dataIndex: 'environment', key: 'environment', width: 100 },
  { title: '认证方式', dataIndex: 'auth_mode', key: 'auth_mode', width: 100 },
  { title: '状态', dataIndex: 'status', key: 'status', width: 100 },
  { title: '服务树节点', dataIndex: 'tree_nodes', key: 'tree_nodes', width: 200 },
  { title: '标签', dataIndex: 'tags', key: 'tags', width: 200, ellipsis: true },
  { title: '创建人', dataIndex: 'create_user_name', key: 'creator', width: 120 },
  { title: '创建时间', dataIndex: 'created_at', key: 'createdAt', width: 180 },
  { title: '操作', key: 'action', fixed: 'right' as const, width: 200, align: 'center' as const },
];


const getServerStatusClass = (record: TreeLocalResource): string => {
  switch (record.status) {
    case ResourceStatus.RUNNING:
      return 'status-running';
    case ResourceStatus.STOPPED:
      return 'status-stopped';
    case ResourceStatus.ERROR:
      return 'status-error';
    default:
      return 'status-unknown';
  }
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

const formatDate = (dateString: string): string => {
  if (!dateString) return '';
  return new Date(dateString).toLocaleDateString('zh-CN');
};

const formatTime = (dateString: string): string => {
  if (!dateString) return '';
  return new Date(dateString).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
};

const formatDateTime = (dateTime?: string): string => {
  if (!dateTime) return '-';
  try {
    return new Date(dateTime).toLocaleString('zh-CN');
  } catch {
    return dateTime;
  }
};

const getStatusBadge = (status: ResourceStatus): string => {
  const statusMap: Record<ResourceStatus, string> = {
    [ResourceStatus.RUNNING]: 'success',
    [ResourceStatus.STOPPED]: 'error',
    [ResourceStatus.STARTING]: 'processing',
    [ResourceStatus.STOPPING]: 'warning',
    [ResourceStatus.RESTARTING]: 'processing',
    [ResourceStatus.DELETING]: 'warning',
    [ResourceStatus.ERROR]: 'error',
  };
  return statusMap[status] || 'default';
};

const getStatusText = (status: ResourceStatus): string => {
  const statusMap: Record<ResourceStatus, string> = {
    [ResourceStatus.RUNNING]: '运行中',
    [ResourceStatus.STOPPED]: '已停止',
    [ResourceStatus.STARTING]: '启动中',
    [ResourceStatus.STOPPING]: '停止中',
    [ResourceStatus.RESTARTING]: '重启中',
    [ResourceStatus.DELETING]: '删除中',
    [ResourceStatus.ERROR]: '错误',
  };
  return statusMap[status] || '未知';
};

const getAuthModeText = (authMode: AuthMode): string => {
  const authModeMap: Record<AuthMode, string> = {
    [AuthMode.PASSWORD]: '密码认证',
    [AuthMode.KEY]: '密钥认证',
  };
  return authModeMap[authMode] || '未知';
};

const simulateConnectionTest = async (_name: string): Promise<boolean> => {
  await new Promise(resolve => setTimeout(resolve, Math.random() * 2000 + 1000));
  return Math.random() > 0.2;
};

// 表单验证函数
async function validatePrivateKey(_rule: any, value: string): Promise<void> {
  if (formData.value.auth_mode === AuthMode.KEY && value && !value.includes('PRIVATE KEY')) {
    throw new Error('请输入有效的SSH私钥');
  }
}

const fetchTreeData = async (): Promise<void> => {
  try {
    const response = await getTreeList();
    treeData.value = response.items || [];
  } catch (error) {
    console.error('获取服务树数据失败:', error);
    message.error('获取服务树数据失败');
  }
};

const fetchLocalResources = async (): Promise<void> => {
  loading.value = true;
  try {
    const params: GetTreeLocalResourceListReq = {
      page: pagination.current,
      size: pagination.pageSize,
    };
    
    if (filterForm.status) {
      params.status = filterForm.status;
    }

    const response = await getTreeLocalList(params);

    // 确保返回的数据包含 tree_nodes 字段
    const items = response.items || [];
    localResources.value = items.map((item: TreeLocalResource) => ({
      ...item,
      tree_nodes: item.tree_nodes || []
    }));
    pagination.total = response.total || 0;
  } catch (error) {
    message.error('获取本地资源列表失败');
    console.error('获取本地资源列表失败:', error);
    localResources.value = [];
    pagination.total = 0;
  } finally {
    loading.value = false;
  }
};

const handleSearch = (): void => {
  pagination.current = 1;
  filterForm.page = 1;
  fetchLocalResources();
};

const resetFilter = (): void => {
  filterForm.status = undefined;
  pagination.current = 1;
  filterForm.page = 1;
  fetchLocalResources();
  message.success('过滤条件已重置');
};

const handleTableChange = (pag: { current?: number; pageSize?: number }): void => {
  pagination.current = pag.current || pagination.current;
  pagination.pageSize = pag.pageSize || pagination.pageSize;
  filterForm.page = pagination.current;
  filterForm.size = pagination.pageSize;
  fetchLocalResources();
};

const handleConnectTerminal = (record: TreeLocalResource) => {
  if (record.id) {
    router.push({ name: 'WebTerminal', params: { id: record.id } });
  } else {
    message.error('无效的资源ID');
  }
};

// 修复：重置表单数据的函数
const resetFormData = (): void => {
  formData.value = {
    name: '',
    environment: 'local',
    description: '',
    tags: [],
    ip_addr: '',
    port: 22,
    username: 'root',
    password: '',
    os_type: 'linux',
    os_name: '',
    image_name: '',
    auth_mode: AuthMode.PASSWORD,
    key: '',
  };
  newTag.value = '';
  if (formRef.value) {
    formRef.value.resetFields();
  }
};

const showCreateModal = (): void => {
  isEdit.value = false;
  resetFormData();
  modalVisible.value = true;
};

// 修复：编辑时的数据复制
const handleEdit = (record: TreeLocalResource): void => {
  isEdit.value = true;
  formData.value = {
    id: record.id,
    name: record.name,
    environment: record.environment,
    description: record.description,
    tags: Array.isArray(record.tags) ? [...record.tags] : [], // 确保复制数组
    ip_addr: record.ip_addr,
    port: record.port,
    username: record.username,
    password: '', // 密码不回显
    os_type: record.os_type,
    os_name: record.os_name,
    image_name: record.image_name,
    auth_mode: record.auth_mode,
    key: '', // 私钥不回显
  };
  modalVisible.value = true;
  if (detailVisible.value) {
    detailVisible.value = false;
  }
};

const handleViewDetail = async (record: TreeLocalResource): Promise<void> => {
  detailVisible.value = true;
  detailLoading.value = true;
  currentDetail.value = record;

  try {
    const response = await getTreeLocalDetail(record.id);
    // 确保详情数据包含 tree_nodes 字段
    currentDetail.value = {
      ...response,
      tree_nodes: response.tree_nodes || []
    };
  } catch (error) {
    console.error('获取资源详情失败:', error);
    message.error('获取资源详情失败');
  } finally {
    detailLoading.value = false;
  }
};

const handleAuthModeChange = (): void => {
  formData.value.password = '';
  formData.value.key = '';
  if (formRef.value) {
    formRef.value.clearValidate(['password', 'key']);
  }
};

// 修复：标签添加功能
const addTag = (): void => {
  const tagValue = newTag.value.trim();
  if (!tagValue) {
    message.warning('请输入标签内容');
    return;
  }
  
  // 确保 tags 数组存在且为响应式数组
  if (!Array.isArray(formData.value.tags)) {
    formData.value.tags = [];
  }

  if (formData.value.tags.includes(tagValue)) {
    message.warning('标签已存在');
    return;
  }
  
  if (formData.value.tags.length >= 10) {
    message.warning('最多只能添加10个标签');
    return;
  }
  
  // 使用 Vue 3 推荐的方式更新数组，确保响应式
  formData.value.tags = [...formData.value.tags, tagValue];
  
  // 使用 nextTick 确保DOM更新后再清空输入框
  nextTick(() => {
    newTag.value = '';
    // 让输入框失去焦点
    tagInputRef.value?.blur();
    // 添加调试信息
    console.log('添加标签后的tags:', formData.value.tags);
    console.log('newTag值:', newTag.value);
  });
};

// 修复：标签删除功能
const removeTag = (index: number): void => {
  if (Array.isArray(formData.value.tags) && index >= 0 && index < formData.value.tags.length) {
    // 使用 Vue 3 推荐的方式更新数组，确保响应式
    formData.value.tags = formData.value.tags.filter((_, i) => i !== index);
    console.log('删除标签后的tags:', formData.value.tags);
  }
};

const updateResourceStatus = (resourceId: number, status: ResourceStatus): void => {
  const resource = localResources.value.find((item: TreeLocalResource) => item.id === resourceId);
  if (resource) {
    resource.status = status;
  }
  if (currentDetail.value && currentDetail.value.id === resourceId) {
    currentDetail.value.status = status;
  }
};

const handleTestSingleConnection = async (record: TreeLocalResource): Promise<void> => {
  const hide = message.loading(`正在测试 ${record.name} 的连接...`, 0);
  
  try {
    const success = await simulateConnectionTest(record.name);
    
    if (success) {
      message.success(`${record.name} 连接测试成功`);
      updateResourceStatus(record.id, ResourceStatus.RUNNING);
    } else {
      message.error(`${record.name} 连接测试失败`);
      updateResourceStatus(record.id, ResourceStatus.STOPPED);
    }
  } catch (error) {
    message.error(`${record.name} 连接测试异常`);
    console.error('连接测试失败:', error);
  } finally {
    hide();
  }
};

const handleTestConnection = async (): Promise<void> => {
  if (localResources.value.length === 0) {
    message.warning('没有可测试的服务器');
    return;
  }
  
  const hide = message.loading('正在批量测试连接，请稍候...', 0);
  
  try {
    const testPromises = localResources.value.map(async (resource: TreeLocalResource) => {
      const success = await simulateConnectionTest(resource.name);
      updateResourceStatus(resource.id, success ? ResourceStatus.RUNNING : ResourceStatus.STOPPED);
      return success;
    });
    
    const results = await Promise.all(testPromises);
    const onlineCount = results.filter(Boolean).length;
    const totalCount = localResources.value.length;
    
    message.success(`批量测试完成，${onlineCount}/${totalCount} 台服务器在线`);
  } catch (error) {
    message.error('批量测试连接失败');
    console.error('批量测试失败:', error);
  } finally {
    hide();
  }
};

const handleTestAndSubmit = async (): Promise<void> => {
  try {
    await formRef.value?.validate();
    
    testLoading.value = true;
    
    const testHide = message.loading(`正在测试 ${formData.value.name!} 的连接...`, 0);
    
    try {
      const testSuccess = await simulateConnectionTest(formData.value.name!);
      testHide();
      
      if (!testSuccess) {
        message.error('连接测试失败，请检查服务器配置');
        return;
      }
      
      message.success('连接测试成功，正在添加服务器...');
      await handleSubmit();
      
    } catch (error) {
      testHide();
      message.error('连接测试失败');
    }
  } catch (error) {
    message.error('表单验证失败');
  } finally {
    testLoading.value = false;
  }
};

const showBindModal = (record: TreeLocalResource): void => {
  currentResource.value = record;
  selectedTreeNodeIds.value = [];
  bindModalVisible.value = true;
};

const handleBind = async (): Promise<void> => {
  if (!currentResource.value || selectedTreeNodeIds.value.length === 0) {
    message.warning('请选择要绑定的服务树节点');
    return;
  }

  bindLoading.value = true;
  try {
    const params: BindTreeLocalResourceReq = {
      id: currentResource.value.id,
      tree_node_ids: selectedTreeNodeIds.value,
    };
    await bindTreeLocal(currentResource.value.id, params);
    message.success('绑定成功');
    bindModalVisible.value = false;
    selectedTreeNodeIds.value = [];
    
    // 刷新数据以显示最新绑定的节点
    await fetchLocalResources();
    
    // 如果当前有详情显示，也刷新详情
    if (detailVisible.value && currentDetail.value && currentDetail.value.id === currentResource.value.id) {
      const response = await getTreeLocalDetail(currentResource.value.id);
      currentDetail.value = {
        ...response,
        tree_nodes: response.tree_nodes || []
      };
    }
  } catch (error) {
    message.error('绑定失败');
    console.error('绑定失败:', error);
  } finally {
    bindLoading.value = false;
  }
};

const handleUnbind = async (): Promise<void> => {
  if (!currentResource.value || selectedUnbindNodeIds.value.length === 0) {
    message.warning('请选择要解绑的节点');
    return;
  }

  unbindLoading.value = true;
  try {
    const params: UnBindTreeLocalResourceReq = {
      id: currentResource.value.id,
      tree_node_ids: selectedUnbindNodeIds.value,
    };
    await unbindTreeLocal(currentResource.value.id, params);
    message.success('解绑成功');
    unbindModalVisible.value = false;
    selectedUnbindNodeIds.value = [];
    
    // 刷新数据以显示最新的节点绑定状态
    await fetchLocalResources();
    
    // 如果当前有详情显示，也刷新详情
    if (detailVisible.value && currentDetail.value && currentDetail.value.id === currentResource.value.id) {
      const response = await getTreeLocalDetail(currentResource.value.id);
      currentDetail.value = {
        ...response,
        tree_nodes: response.tree_nodes || []
      };
    }
  } catch (error) {
    message.error('解绑失败');
    console.error('解绑失败:', error);
  } finally {
    unbindLoading.value = false;
  }
};

// 修复：表单提交功能
const handleSubmit = async (): Promise<void> => {
  try {
    await formRef.value?.validate();

    submitLoading.value = true;

    // 确保 tags 数组正确处理
    const submitData = {
      ...formData.value,
      tags: Array.isArray(formData.value.tags) ? formData.value.tags : []
    };

    // 移除 id 字段（用于区分创建和更新）
    const { id, ...rest } = submitData;
    
    console.log('提交数据:', rest); // 添加调试信息
    console.log('tags数据:', rest.tags); // 专门查看tags

    if (isEdit.value) {
      if (!id) {
        throw new Error('缺少资源ID');
      }
      await updateTreeLocal(id, rest as UpdateTreeLocalResourceReq);
      message.success('服务器信息更新成功');
    } else {
      await createTreeLocal(rest as CreateTreeLocalResourceReq);
      message.success('服务器添加成功');
    }

    modalVisible.value = false;
    await fetchLocalResources();
  } catch (error) {
    message.error(isEdit.value ? '更新服务器失败' : '添加服务器失败');
    console.error('提交表单失败:', error);
  } finally {
    submitLoading.value = false;
  }
};

const handleDelete = (record: TreeLocalResource): void => {
  Modal.confirm({
    title: '确定要删除此服务器吗？',
    content: `您正在删除服务器: ${record.name} (${record.ip_addr})，该操作不可恢复。`,
    okText: '确认删除',
    okType: 'danger',
    cancelText: '取消',
    async onOk() {
      try {
        await deleteTreeLocal(record.id);
        message.success('服务器删除成功');
        
        if (detailVisible.value && currentDetail.value?.id === record.id) {
          detailVisible.value = false;
        }
        
        await fetchLocalResources();
      } catch (error) {
        message.error('删除服务器失败');
        console.error('删除服务器失败:', error);
      }
    }
  });
};

onMounted(async () => {
  try {
    await Promise.all([
      fetchTreeData(),
      fetchLocalResources()
    ]);
  } catch (error) {
    console.error('初始化数据加载失败:', error);
    message.error('页面数据加载失败，请刷新页面重试');
  }
});
</script>

<style scoped>
.local-resource-management {
  padding: 16px;
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
  background-color: #1677ff;
  border-color: #1677ff;
  flex-shrink: 0;
  box-shadow: none;
}

.btn-action {
  background-color: #52c41a;
  border-color: #52c41a;
  flex-shrink: 0;
  box-shadow: none;
}

.search-filters {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  flex: 1;
  min-width: 0;
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
  border-radius: 6px;
  border: 1px solid #f0f0f0;
  box-shadow: none;
  height: 100%;
}

.stats-card:hover {
  transform: none;
  box-shadow: none;
}

.table-container {
  margin-bottom: 24px;
}

.table-container :deep(.ant-card) {
  border-radius: 8px;
  border: 1px solid #f0f0f0;
  box-shadow: none;
}

.server-name-cell {
  display: flex;
  align-items: center;
  gap: 10px;
}

.server-badge {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}

.status-running {
  background-color: #52c41a;
}

.status-stopped {
  background-color: #ff4d4f;
}

.status-error {
  background-color: #faad14;
}

.status-unknown {
  background-color: #d9d9d9;
}

.server-name-text {
  font-weight: 500;
  word-break: break-all;
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
  background: #fafafa;
  border: 1px solid #f0f0f0;
}

.tech-tag:hover {
  transform: none;
  box-shadow: none;
}

.node-tag {
  background-color: #f6ffed;
  color: #389e0d;
  border: 1px solid #b7eb8f;
}

.tag-item {
  background-color: #e6f7ff;
  color: #0958d9;
  border: 1px solid #91caff;
}

.empty-text {
  color: #999;
  font-style: italic;
  font-size: 12px;
}

.connection-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.connection-item {
  display: flex;
  align-items: center;
  gap: 4px;
}

.connection-label {
  font-size: 12px;
  color: #666;
}

.connection-value {
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

.form-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 16px;
}

.form-item {
  margin-bottom: 0;
}

.server-form {
  .tags-input {
    .current-tags {
      margin-bottom: 12px;
      
      .tech-tag {
        margin-bottom: 8px;
      }
    }
    
    .add-tag {
      display: flex;
      align-items: center;
      flex-wrap: wrap;
      gap: 8px;
    }
  }
  
  .form-actions {
    display: flex;
    justify-content: flex-end;
    margin-top: 24px;
    padding-top: 16px;
    border-top: 1px solid #f0f0f0;
  }
}

.add-tag-btn {
  background: #f5f5f5;
  border: 1px dashed #d9d9d9;
  color: #595959;
  display: flex;
  align-items: center;
  gap: 8px;
}

.add-tag-btn:hover {
  color: #1890ff;
  border-color: #1890ff;
  background: #f0f7ff;
}

/* 详情区域样式 */
.detail-content {
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

.detail-section {
  margin-top: 24px;
}

.tag-list, .tree-node-list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 16px;
}

.drawer-actions {
  display: flex;
  justify-content: space-between;
  margin-top: 24px;
  padding-top: 16px;
  border-top: 1px solid #f0f0f0;
}

/* 响应式设计 */
@media (max-width: 768px) {
  .local-resource-management {
    padding: 8px;
  }

  .header-actions {
    flex-direction: column;
    align-items: stretch;
  }

  .search-filters {
    width: 100%;
  }

  .filter-select {
    width: 100%;
    min-width: auto;
  }

  .btn-text {
    display: none;
  }

  .btn-create, .btn-action {
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

  .form-grid {
    grid-template-columns: 1fr;
    gap: 12px;
  }

  .server-form .add-tag {
    flex-direction: column;
    align-items: stretch;
  }

  .server-form .form-actions {
    flex-direction: column;
    gap: 8px;
  }

  .server-form .form-actions .ant-btn {
    margin-left: 0 !important;
    width: 100%;
  }

  .drawer-actions {
    flex-direction: column;
    gap: 8px;
  }

  .drawer-actions .ant-btn-group {
    display: flex;
    flex-direction: column;
    width: 100%;
  }

  .drawer-actions .ant-btn {
    width: 100%;
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
  background-color: #fafafa;
}

.table-container :deep(.ant-table-tbody > tr > td) {
  word-break: break-word;
}

.table-container :deep(.ant-table-tbody > tr:hover > td) {
  background-color: #fafafa;
}

/* 对话框响应式优化 */
.responsive-modal :deep(.ant-modal) {
  max-width: calc(100vw - 16px);
  margin: 8px;
}

.responsive-modal :deep(.ant-modal-content) {
  border-radius: 8px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.1);
}

@media (max-width: 768px) {
  .responsive-modal :deep(.ant-modal-body) {
    padding: 16px;
    max-height: calc(100vh - 160px);
    overflow-y: auto;
  }
}

/* 动画效果 */
.stats-card, .tech-tag, .action-buttons .ant-btn {
  transition: background-color 0.2s, border-color 0.2s, color 0.2s;
}

.btn-create:hover, .btn-action:hover {
  transform: none;
  box-shadow: none;
}

/* 加载状态优化 */
.table-container :deep(.ant-spin-nested-loading) {
  border-radius: 8px;
}

/* 分页器样式 */
.table-container :deep(.ant-pagination) {
  margin: 16px;
  text-align: right;
}

@media (max-width: 768px) {
  .table-container :deep(.ant-pagination) {
    text-align: center;
  }
}
</style>
