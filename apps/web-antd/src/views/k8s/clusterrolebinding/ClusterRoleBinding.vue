<template>
  <OpsPage
    description="管理和监控集群中的所有 Kubernetes ClusterRoleBinding"
    title="ClusterRoleBinding 管理"
  >
    <template #actions>
      <a-button
        :disabled="!filterClusterId"
        type="primary"
        @click="openCreateModal"
      >
        <template #icon><PlusOutlined aria-hidden="true" /></template>
        创建 ClusterRoleBinding
      </a-button>
      <a-button
        :disabled="!filterClusterId"
        :loading="loading"
        @click="fetchClusterRoleBindings"
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
                <DeploymentUnitOutlined aria-hidden="true" />
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
                    {{ cluster.env ? getEnvText(cluster.env) : '未知' }}
                  </a-tag>
                </div>
              </a-select-option>
              <a-select-option
                v-if="clusters.length > 0 && clusters.length < clustersTotal"
                :value="'__load_more__'"
                disabled
                style="text-align: center; color: var(--ops-muted)"
              >
                <a-spin :spinning="clustersLoading" size="small" />
                <span v-if="!clustersLoading">滚动加载更多...</span>
              </a-select-option>
            </a-select>

            <!-- 标签过滤器 -->
            <div class="clusterrolebinding-labels-filter">
              <a-button
                class="k8s-toolbar-btn"
                type="dashed"
                @click="openLabelsFilter"
              >
                <template #icon><TagsOutlined aria-hidden="true" /></template>
                标签过滤（本页）
                <a-tag
                  v-if="Object.keys(filterLabels).length > 0"
                  color="blue"
                  size="small"
                  style="margin-left: 8px"
                >
                  {{ Object.keys(filterLabels).length }}
                </a-tag>
              </a-button>
              <div
                v-if="Object.keys(filterLabels).length > 0"
                class="active-filters"
                style="margin-top: 8px"
              >
                <a-tag
                  v-for="(value, key) in filterLabels"
                  :key="key"
                  closable
                  color="blue"
                  size="small"
                  style="margin-right: 4px; margin-bottom: 4px"
                  @close="removeFilterLabel(key)"
                >
                  {{ key }}: {{ value }}
                </a-tag>
              </div>
            </div>
          </div>

          <div class="k8s-search-group">
            <a-input
              v-model:value="searchText"
              allow-clear
              class="k8s-search-input"
              placeholder="搜索 ClusterRoleBinding 名称"
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
              @click="resetFilters"
              :disabled="
                !searchText &&
                !filterClusterId &&
                Object.keys(filterLabels).length === 0
              "
              class="k8s-toolbar-btn"
              title="重置所有筛选条件"
            >
              <template #icon><DeleteOutlined aria-hidden="true" /></template>
              重置筛选
            </a-button>

            <a-button
              :disabled="!filterClusterId"
              class="k8s-toolbar-btn"
              title="通过YAML创建ClusterRoleBinding"
              @click="openCreateYamlModal"
            >
              <template #icon><FileTextOutlined aria-hidden="true" /></template>
              YAML 创建
            </a-button>

            <a-button
              type="primary"
              danger
              @click="() => batchOperation('删除')"
              :disabled="!selectedRows.length"
              v-if="
                can('k8s.clusterrolebinding.batchDelete') &&
                selectedRows.length > 0
              "
              class="k8s-toolbar-btn"
              title="批量删除选中的 ClusterRoleBinding"
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
    <a-alert v-if="loadError" :message="loadError" show-icon type="error">
      <template #action>
        <a-button size="small" @click="fetchClusterRoleBindings">
          重试查询
        </a-button>
      </template>
    </a-alert>

    <!-- 数据展示区域 -->
    <div class="k8s-data-display">
      <a-table
        :columns="columns"
        :data-source="filteredClusterRoleBindings"
        :loading="loading"
        :pagination="{
          current: currentPage,
          pageSize: pageSize,
          total: total,
          showSizeChanger: true,
          showQuickJumper: true,
          showTotal: (total: number) =>
            `后端共 ${total} 条，本页匹配 ${filteredClusterRoleBindings.length} 条`,
          pageSizeOptions: ['10', '20', '30', '50'],
        }"
        :row-key="clusterResourceKey"
        :row-selection="rowSelection"
        :scroll="{ x: 1600 }"
        class="k8s-table clusterrolebinding-table"
        @change="handleTableChange"
      >
        <template #bodyCell="{ column, record, text }">
          <template v-if="column.key === 'roleRef'">
            <div class="clusterrolebinding-role-ref">
              <template
                v-if="
                  record.role_ref &&
                  (record.role_ref.kind ||
                    record.role_ref.name ||
                    record.role_ref.api_group)
                "
              >
                <a-tag color="green">
                  {{ record.role_ref.kind || 'Unknown' }}
                </a-tag>
                <span class="role-name">{{
                  record.role_ref.name || 'Unknown'
                }}</span>
                <div
                  v-if="record.role_ref.api_group"
                  class="api-group"
                  style="
                    font-size: 12px;
                    color: var(--ops-muted);
                    margin-top: 2px;
                  "
                >
                  API Group: {{ record.role_ref.api_group }}
                </div>
              </template>
              <template v-else>
                <a-tag color="red">未配置</a-tag>
                <span class="role-name">-</span>
              </template>
            </div>
          </template>
          <template v-else-if="column.key === 'subjects'">
            <div class="clusterrolebinding-subjects">
              <template v-if="record.subjects && record.subjects.length > 0">
                <a-tag
                  v-for="(subject, index) in record.subjects.slice(0, 2)"
                  :key="index"
                  :color="getSubjectColor(subject?.kind)"
                  class="subject-tag"
                >
                  {{ subject?.kind || 'Unknown' }}:
                  {{ subject?.name || 'Unknown' }}
                  <span
                    v-if="subject?.namespace"
                    style="font-size: 11px; opacity: 0.8"
                  >
                    @{{ subject.namespace }}
                  </span>
                </a-tag>
                <a-tooltip
                  v-if="record.subjects.length > 2"
                  :title="
                    record.subjects
                      .map(
                        (s: any) =>
                          `${s.kind || 'Unknown'}: ${s.name || 'Unknown'}${s.namespace ? ' @' + s.namespace : ''}`,
                      )
                      .join('\n')
                  "
                >
                  <a-tag class="subject-tag">
                    +{{ record.subjects.length - 2 }} 更多
                  </a-tag>
                </a-tooltip>
              </template>
              <template v-else>
                <a-tag color="orange">无主体</a-tag>
                <span class="k8s-no-data">未绑定任何主体</span>
              </template>
            </div>
          </template>
          <template v-else-if="column.key === 'labels'">
            <div class="k8s-labels-display">
              <template v-if="Array.isArray(text)">
                <!-- 数组格式 -->
                <a-tooltip
                  v-for="label in text.slice(0, 3)"
                  :key="label.key"
                  :title="`${label.key}: ${label.value}`"
                >
                  <a-tag class="k8s-label-item">
                    {{ label.key }}: {{ label.value }}
                  </a-tag>
                </a-tooltip>
                <a-tooltip
                  v-if="text.length > 3"
                  :title="
                    text
                      .map((item: any) => `${item.key}: ${item.value}`)
                      .join('\n')
                  "
                >
                  <a-tag class="k8s-label-item">
                    {{ text.length }} 个标签
                  </a-tag>
                </a-tooltip>
                <span v-if="text.length === 0" class="k8s-no-data">-</span>
              </template>
              <template v-else-if="text && typeof text === 'object'">
                <!-- 对象格式 -->
                <a-tooltip
                  v-for="[key, value] in Object.entries(text).slice(0, 3)"
                  :key="key"
                  :title="`${key}: ${value}`"
                >
                  <a-tag class="k8s-label-item"> {{ key }}: {{ value }} </a-tag>
                </a-tooltip>
                <a-tooltip
                  v-if="Object.keys(text).length > 3"
                  :title="
                    Object.entries(text)
                      .map(([k, v]: [string, any]) => `${k}: ${v}`)
                      .join('\n')
                  "
                >
                  <a-tag class="k8s-label-item">
                    {{ Object.keys(text).length }} 个标签
                  </a-tag>
                </a-tooltip>
                <span v-if="Object.keys(text).length === 0" class="k8s-no-data"
                  >-</span
                >
              </template>
              <template v-else>
                <span class="k8s-no-data">-</span>
              </template>
            </div>
          </template>
          <template v-else-if="column.key === 'created_at'">
            <div class="k8s-time-display">
              <div :title="record.created_at" class="creation-time">
                {{ formatCreationTime(record.created_at) }}
              </div>
              <div
                class="age-display"
                style="font-size: 12px; color: var(--ops-muted)"
              >
                {{ formatAge(record.age, record.created_at) }}
              </div>
              <div
                v-if="record.resource_version"
                class="resource-version"
                style="font-size: 11px; color: var(--ops-muted)"
              >
                版本: {{ record.resource_version }}
              </div>
            </div>
          </template>
          <template v-else-if="column.key === 'actions'">
            <div class="k8s-action-column">
              <a-tooltip title="查看详情">
                <a-button
                  title="查看详情"
                  @click="showClusterRoleBindingDetail(record)"
                >
                  <template #icon><EyeOutlined aria-hidden="true" /></template>
                </a-button>
              </a-tooltip>
              <a-tooltip title="查看 YAML">
                <a-button title="查看 YAML" @click="showYamlModal(record)">
                  <template #icon>
                    <FileTextOutlined aria-hidden="true" />
                  </template>
                </a-button>
              </a-tooltip>
              <a-tooltip title="编辑">
                <a-button title="编辑" @click="openEditModal(record)">
                  <template #icon><EditOutlined aria-hidden="true" /></template>
                </a-button>
              </a-tooltip>
              <a-tooltip
                v-if="can('k8s.clusterrolebinding.delete')"
                title="删除"
              >
                <a-button
                  danger
                  title="删除"
                  @click="deleteClusterRoleBinding(record)"
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
            <UserSwitchOutlined aria-hidden="true" />
            <p>暂无 ClusterRoleBinding 数据</p>
            <p v-if="!filterClusterId">请先选择集群</p>
            <p v-else>请调整筛选条件或刷新数据</p>
          </div>
        </template>
      </a-table>
    </div>

    <!-- 创建 ClusterRoleBinding 模态框 -->
    <a-modal
      v-model:open="isCreateModalVisible"
      :confirmLoading="submitLoading"
      :maskClosable="false"
      cancelText="取消"
      destroyOnClose
      okText="创建"
      title="创建 ClusterRoleBinding"
      width="900px"
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
        <a-form-item
          :required="true"
          label="ClusterRoleBinding 名称"
          name="name"
        >
          <a-input
            v-model:value="createFormModel.name"
            :maxlength="63"
            class="k8s-form-input"
            placeholder="请输入 ClusterRoleBinding 名称（例如：my-clusterrolebinding）"
          />
          <div
            style="color: var(--ops-muted); font-size: 12px; margin-top: 4px"
          >
            只能包含小写字母、数字和连字符，且不能以连字符开头或结尾
          </div>
        </a-form-item>

        <a-form-item :required="true" label="角色引用">
          <a-row :gutter="12">
            <a-col :span="8">
              <a-form-item :name="['role_ref', 'kind']" no-style>
                <a-select
                  v-model:value="createFormModel.role_ref.kind"
                  class="k8s-form-input"
                  placeholder="角色类型"
                >
                  <a-select-option value="ClusterRole">
                    ClusterRole
                  </a-select-option>
                  <a-select-option value="Role">Role</a-select-option>
                </a-select>
              </a-form-item>
            </a-col>
            <a-col :span="16">
              <a-form-item
                :name="['role_ref', 'name']"
                :rules="[
                  {
                    required: true,
                    message: '请输入角色名称',
                    trigger: 'blur',
                  },
                ]"
                no-style
              >
                <a-input
                  v-model:value="createFormModel.role_ref.name"
                  class="k8s-form-input"
                  placeholder="请输入角色名称（例如：cluster-admin）"
                />
              </a-form-item>
            </a-col>
          </a-row>
        </a-form-item>

        <a-form-item :required="true" label="主体配置">
          <div class="k8s-key-value-inputs">
            <div
              v-for="(subject, index) in createFormModel.subjects"
              :key="index"
              class="k8s-key-value-row"
            >
              <a-select
                v-model:value="subject.kind"
                class="k8s-form-input"
                placeholder="主体类型"
                style="width: 120px"
              >
                <a-select-option value="User">User</a-select-option>
                <a-select-option value="Group">Group</a-select-option>
                <a-select-option value="ServiceAccount">
                  ServiceAccount
                </a-select-option>
              </a-select>
              <a-input
                v-model:value="subject.name"
                class="k8s-form-input"
                placeholder="主体名称"
              />
              <a-input
                v-model:value="subject.namespace"
                :disabled="subject.kind !== 'ServiceAccount'"
                class="k8s-form-input"
                placeholder="命名空间（ServiceAccount需要）"
              />
              <a-button
                :disabled="createFormModel.subjects.length <= 1"
                class="k8s-remove-btn"
                danger
                size="small"
                type="text"
                @click="removeSubjectField(index)"
              >
                <template #icon><DeleteOutlined aria-hidden="true" /></template>
              </a-button>
            </div>
            <a-button
              style="margin-top: 8px"
              type="dashed"
              @click="addSubjectField"
            >
              <template #icon><PlusOutlined aria-hidden="true" /></template>
              添加主体
            </a-button>
          </div>
        </a-form-item>

        <a-form-item label="标签配置（可选）" name="labels">
          <div class="k8s-key-value-inputs">
            <div
              v-if="
                !createFormModel.labels ||
                Object.keys(createFormModel.labels).length === 0
              "
              style="text-align: center; color: var(--ops-muted); padding: 16px"
            >
              暂无标签，点击下方按钮添加
            </div>
            <div
              v-for="(_, key) in createFormModel.labels"
              :key="key"
              class="k8s-key-value-row"
            >
              <a-input
                :placeholder="`标签键: ${key}`"
                :value="key"
                class="k8s-form-input"
                disabled
              />
              <a-input
                v-model:value="createFormModel.labels[key]"
                :maxlength="200"
                class="k8s-form-input"
                placeholder="标签值"
              />
              <a-button
                class="k8s-remove-btn"
                danger
                size="small"
                type="text"
                @click="removeLabelField(key)"
              >
                <template #icon><DeleteOutlined aria-hidden="true" /></template>
              </a-button>
            </div>
            <div class="add-input-row" style="margin-top: 8px">
              <a-input
                v-model:value="newLabelKey"
                placeholder="输入标签键"
                style="flex: 1; margin-right: 8px"
                @press-enter="addNewLabel"
              />
              <a-button
                type="primary"
                @click="addNewLabel"
                :disabled="!newLabelKey.trim()"
              >
                <template #icon><PlusOutlined aria-hidden="true" /></template>
                添加
              </a-button>
            </div>
          </div>
        </a-form-item>

        <a-form-item label="注解配置（可选）" name="annotations">
          <div class="k8s-key-value-inputs">
            <div
              v-if="
                !createFormModel.annotations ||
                Object.keys(createFormModel.annotations).length === 0
              "
              style="text-align: center; color: var(--ops-muted); padding: 16px"
            >
              暂无注解，点击下方按钮添加
            </div>
            <div
              v-for="(_, key) in createFormModel.annotations"
              :key="key"
              class="k8s-key-value-row"
            >
              <a-input
                :placeholder="`注解键: ${key}`"
                :value="key"
                class="k8s-form-input"
                disabled
              />
              <a-input
                v-model:value="createFormModel.annotations[key]"
                :maxlength="500"
                class="k8s-form-input"
                placeholder="注解值"
              />
              <a-button
                class="k8s-remove-btn"
                danger
                size="small"
                type="text"
                @click="removeAnnotationField(key)"
              >
                <template #icon><DeleteOutlined aria-hidden="true" /></template>
              </a-button>
            </div>
            <div class="add-input-row" style="margin-top: 8px">
              <a-input
                v-model:value="newAnnotationKey"
                placeholder="输入注解键"
                style="flex: 1; margin-right: 8px"
                @press-enter="addNewAnnotation"
              />
              <a-button
                type="primary"
                @click="addNewAnnotation"
                :disabled="!newAnnotationKey.trim()"
              >
                <template #icon><PlusOutlined aria-hidden="true" /></template>
                添加
              </a-button>
            </div>
          </div>
        </a-form-item>
      </a-form>
    </a-modal>

    <!-- 编辑 ClusterRoleBinding 模态框 -->
    <a-modal
      v-model:open="isEditModalVisible"
      :confirmLoading="submitLoading"
      :maskClosable="false"
      cancelText="取消"
      destroyOnClose
      okText="保存"
      title="编辑 ClusterRoleBinding"
      width="900px"
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
        <a-alert
          description="ClusterRoleBinding 创建后只能编辑主体、标签和注解信息。名称和角色引用（roleRef）是不可变的，无法修改。如需更改角色引用，请删除后重新创建。"
          message="编辑提示"
          show-icon
          style="margin-bottom: 24px"
          type="warning"
        />

        <!-- 基础信息（只读） -->
        <a-form-item label="ClusterRoleBinding 名称">
          <a-input
            :value="editFormModel.name"
            class="k8s-form-input"
            disabled
          />
        </a-form-item>

        <a-form-item label="角色引用（不可修改）">
          <a-row :gutter="12">
            <a-col :span="8">
              <a-select
                v-model:value="editFormModel.role_ref.kind"
                class="k8s-form-input"
                disabled
                placeholder="角色类型"
              >
                <a-select-option value="ClusterRole">
                  ClusterRole
                </a-select-option>
                <a-select-option value="Role">Role</a-select-option>
              </a-select>
            </a-col>
            <a-col :span="16">
              <a-input
                v-model:value="editFormModel.role_ref.name"
                class="k8s-form-input"
                disabled
                placeholder="角色名称"
              />
            </a-col>
          </a-row>
          <div style="color: #ff4d4f; font-size: 12px; margin-top: 4px">
            ⚠️ Kubernetes 限制：roleRef 字段创建后不可修改
          </div>
        </a-form-item>

        <a-form-item :required="true" label="主体配置">
          <div class="k8s-key-value-inputs">
            <div
              v-for="(subject, index) in editFormModel.subjects"
              :key="index"
              class="k8s-key-value-row"
            >
              <a-select
                v-model:value="subject.kind"
                class="k8s-form-input"
                placeholder="主体类型"
                style="width: 120px"
              >
                <a-select-option value="User">User</a-select-option>
                <a-select-option value="Group">Group</a-select-option>
                <a-select-option value="ServiceAccount">
                  ServiceAccount
                </a-select-option>
              </a-select>
              <a-input
                v-model:value="subject.name"
                class="k8s-form-input"
                placeholder="主体名称"
              />
              <a-input
                v-model:value="subject.namespace"
                :disabled="subject.kind !== 'ServiceAccount'"
                class="k8s-form-input"
                placeholder="命名空间（ServiceAccount需要）"
              />
              <a-button
                :disabled="editFormModel.subjects.length <= 1"
                class="k8s-remove-btn"
                danger
                size="small"
                type="text"
                @click="removeEditSubjectField(index)"
              >
                <template #icon><DeleteOutlined aria-hidden="true" /></template>
              </a-button>
            </div>
            <a-button
              style="margin-top: 8px"
              type="dashed"
              @click="addEditSubjectField"
            >
              <template #icon><PlusOutlined aria-hidden="true" /></template>
              添加主体
            </a-button>
          </div>
        </a-form-item>

        <a-form-item label="标签配置（可选）" name="labels">
          <div class="k8s-key-value-inputs">
            <div
              v-if="
                !editFormModel.labels ||
                Object.keys(editFormModel.labels).length === 0
              "
              style="text-align: center; color: var(--ops-muted); padding: 16px"
            >
              暂无标签，点击下方按钮添加
            </div>
            <div
              v-for="(_, key) in editFormModel.labels"
              :key="key"
              class="k8s-key-value-row"
            >
              <a-input
                :placeholder="`标签键: ${key}`"
                :value="key"
                class="k8s-form-input"
                disabled
              />
              <a-input
                v-model:value="editFormModel.labels[key]"
                :maxlength="200"
                class="k8s-form-input"
                placeholder="标签值"
              />
              <a-button
                class="k8s-remove-btn"
                danger
                size="small"
                type="text"
                @click="removeEditLabelField(String(key))"
              >
                <template #icon><DeleteOutlined aria-hidden="true" /></template>
              </a-button>
            </div>
            <div class="add-input-row" style="margin-top: 8px">
              <a-input
                v-model:value="editLabelKey"
                placeholder="输入标签键"
                style="flex: 1; margin-right: 8px"
                @press-enter="addEditLabel"
              />
              <a-button
                type="primary"
                @click="addEditLabel"
                :disabled="!editLabelKey.trim()"
              >
                <template #icon><PlusOutlined aria-hidden="true" /></template>
                添加
              </a-button>
            </div>
          </div>
        </a-form-item>

        <a-form-item label="注解配置（可选）" name="annotations">
          <div class="k8s-key-value-inputs">
            <div
              v-if="
                !editFormModel.annotations ||
                Object.keys(editFormModel.annotations).length === 0
              "
              style="text-align: center; color: var(--ops-muted); padding: 16px"
            >
              暂无注解，点击下方按钮添加
            </div>
            <div
              v-for="(_, key) in editFormModel.annotations"
              :key="key"
              class="k8s-key-value-row"
            >
              <a-input
                :placeholder="`注解键: ${key}`"
                :value="key"
                class="k8s-form-input"
                disabled
              />
              <a-input
                v-model:value="editFormModel.annotations[key]"
                :maxlength="500"
                class="k8s-form-input"
                placeholder="注解值"
              />
              <a-button
                class="k8s-remove-btn"
                danger
                size="small"
                type="text"
                @click="removeEditAnnotationField(String(key))"
              >
                <template #icon><DeleteOutlined aria-hidden="true" /></template>
              </a-button>
            </div>
            <div class="add-input-row" style="margin-top: 8px">
              <a-input
                v-model:value="editAnnotationKey"
                placeholder="输入注解键"
                style="flex: 1; margin-right: 8px"
                @press-enter="addEditAnnotation"
              />
              <a-button
                type="primary"
                @click="addEditAnnotation"
                :disabled="!editAnnotationKey.trim()"
              >
                <template #icon><PlusOutlined aria-hidden="true" /></template>
                添加
              </a-button>
            </div>
          </div>
        </a-form-item>
      </a-form>
    </a-modal>

    <!-- 通过 YAML 创建 ClusterRoleBinding 模态框 -->
    <a-modal
      v-model:open="isCreateYamlModalVisible"
      :confirmLoading="submitLoading"
      :maskClosable="false"
      cancelText="取消"
      destroyOnClose
      okText="创建"
      title="通过 YAML 创建 ClusterRoleBinding"
      width="900px"
      @cancel="closeCreateYamlModal"
      @ok="submitCreateYamlForm"
    >
      <a-form
        ref="createYamlFormRef"
        :model="createYamlFormModel"
        :rules="createYamlFormRules"
        class="k8s-form"
        layout="vertical"
      >
        <a-form-item name="yaml">
          <div class="yaml-toolbar">
            <a-button
              class="yaml-toolbar-btn yaml-btn-template"
              @click="insertYamlTemplate"
            >
              <template #icon><FileAddOutlined aria-hidden="true" /></template>
              插入模板
            </a-button>
            <a-button
              class="yaml-toolbar-btn yaml-btn-format"
              @click="formatYaml"
            >
              <template #icon>
                <FormatPainterOutlined aria-hidden="true" />
              </template>
              格式化
            </a-button>
            <a-button
              class="yaml-toolbar-btn yaml-btn-validate"
              @click="validateYaml"
            >
              <template #icon>
                <CheckCircleOutlined aria-hidden="true" />
              </template>
              检查格式
            </a-button>
            <a-button
              class="yaml-toolbar-btn yaml-btn-clear"
              @click="clearYaml"
            >
              <template #icon><ClearOutlined aria-hidden="true" /></template>
              清空
            </a-button>
          </div>
          <a-textarea
            v-model:value="createYamlFormModel.yaml"
            :rows="20"
            class="k8s-config-textarea"
            placeholder="请输入 ClusterRoleBinding YAML 内容，或点击【插入模板】使用默认模板"
          />
        </a-form-item>
      </a-form>
    </a-modal>

    <!-- 详情模态框 -->
    <a-modal
      v-model:open="isDetailModalVisible"
      :footer="null"
      :maskClosable="false"
      destroyOnClose
      title="ClusterRoleBinding 详情"
      width="1000px"
      @cancel="closeDetailModal"
    >
      <a-spin :spinning="detailLoading">
        <div v-if="currentClusterRoleBindingDetail" class="k8s-detail-content">
          <a-row :gutter="[24, 16]">
            <a-col :lg="12" :xs="24">
              <a-card class="k8s-detail-card" size="small" title="基本信息">
                <div class="k8s-detail-item">
                  <span class="k8s-detail-label">ClusterRoleBinding 名称:</span>
                  <span class="k8s-detail-value">{{
                    currentClusterRoleBindingDetail.name
                  }}</span>
                </div>
                <div class="k8s-detail-item">
                  <span class="k8s-detail-label">集群ID:</span>
                  <span class="k8s-detail-value">{{
                    currentClusterRoleBindingDetail.cluster_id
                  }}</span>
                </div>
                <div class="k8s-detail-item">
                  <span class="k8s-detail-label">UID:</span>
                  <span class="k8s-detail-value">{{
                    currentClusterRoleBindingDetail.uid || '-'
                  }}</span>
                </div>
                <div class="k8s-detail-item">
                  <span class="k8s-detail-label">创建时间:</span>
                  <span class="k8s-detail-value">{{
                    currentClusterRoleBindingDetail.created_at || '-'
                  }}</span>
                </div>
                <div class="k8s-detail-item">
                  <span class="k8s-detail-label">存在时间:</span>
                  <span class="k8s-detail-value">{{
                    formatAge(
                      currentClusterRoleBindingDetail.age,
                      currentClusterRoleBindingDetail.created_at,
                    )
                  }}</span>
                </div>
                <div
                  v-if="currentClusterRoleBindingDetail.resource_version"
                  class="k8s-detail-item"
                >
                  <span class="k8s-detail-label">资源版本:</span>
                  <span class="k8s-detail-value">{{
                    currentClusterRoleBindingDetail.resource_version
                  }}</span>
                </div>
              </a-card>
            </a-col>

            <a-col :lg="12" :xs="24">
              <a-card class="k8s-detail-card" size="small" title="角色引用">
                <div class="k8s-detail-item">
                  <span class="k8s-detail-label">角色类型:</span>
                  <span class="k8s-detail-value">
                    <a-tag
                      :color="
                        currentClusterRoleBindingDetail.role_ref?.kind
                          ? 'green'
                          : 'red'
                      "
                    >
                      {{
                        currentClusterRoleBindingDetail.role_ref?.kind ||
                        '未配置'
                      }}
                    </a-tag>
                  </span>
                </div>
                <div class="k8s-detail-item">
                  <span class="k8s-detail-label">角色名称:</span>
                  <span class="k8s-detail-value">{{
                    currentClusterRoleBindingDetail.role_ref?.name || '-'
                  }}</span>
                </div>
                <div class="k8s-detail-item">
                  <span class="k8s-detail-label">API 组:</span>
                  <span class="k8s-detail-value">{{
                    currentClusterRoleBindingDetail.role_ref?.api_group || '-'
                  }}</span>
                </div>
              </a-card>
            </a-col>
          </a-row>

          <a-row :gutter="[24, 16]" style="margin-top: 16px">
            <a-col :xs="24">
              <a-card class="k8s-detail-card" size="small" title="主体信息">
                <div class="clusterrolebinding-subjects-detail">
                  <div
                    v-for="(
                      subject, index
                    ) in currentClusterRoleBindingDetail.subjects || []"
                    :key="index"
                    class="subject-detail-item"
                  >
                    <div class="subject-detail-row">
                      <span class="subject-label">类型:</span>
                      <a-tag :color="getSubjectColor(subject?.kind)">
                        {{ subject?.kind || '-' }}
                      </a-tag>
                    </div>
                    <div class="subject-detail-row">
                      <span class="subject-label">名称:</span>
                      <span class="subject-value">{{
                        subject?.name || '-'
                      }}</span>
                    </div>
                    <div v-if="subject?.namespace" class="subject-detail-row">
                      <span class="subject-label">命名空间:</span>
                      <span class="subject-value">{{ subject.namespace }}</span>
                    </div>
                    <div v-if="subject?.api_group" class="subject-detail-row">
                      <span class="subject-label">API 组:</span>
                      <span class="subject-value">{{ subject.api_group }}</span>
                    </div>
                  </div>
                  <span
                    v-if="
                      !currentClusterRoleBindingDetail.subjects ||
                      currentClusterRoleBindingDetail.subjects.length === 0
                    "
                    class="k8s-no-data"
                  >
                    暂无主体信息
                  </span>
                </div>
              </a-card>
            </a-col>
          </a-row>

          <a-row :gutter="[24, 16]" style="margin-top: 16px">
            <a-col :lg="12" :xs="24">
              <a-card class="k8s-detail-card" size="small" title="标签信息">
                <div class="k8s-labels-display">
                  <a-tooltip
                    v-for="[key, value] in Object.entries(
                      currentClusterRoleBindingDetail?.labels || {},
                    )"
                    :key="key"
                    :title="`${key}: ${value || '-'}`"
                    placement="top"
                  >
                    <a-tag
                      class="k8s-label-item"
                      style="
                        margin-bottom: 8px;
                        max-width: 200px;
                        overflow: hidden;
                        text-overflow: ellipsis;
                        white-space: nowrap;
                      "
                    >
                      {{ key }}: {{ value || '-' }}
                    </a-tag>
                  </a-tooltip>
                  <span
                    v-if="
                      !currentClusterRoleBindingDetail?.labels ||
                      Object.keys(currentClusterRoleBindingDetail.labels)
                        .length === 0
                    "
                    class="k8s-no-data"
                  >
                    暂无标签
                  </span>
                </div>
              </a-card>
            </a-col>

            <a-col :lg="12" :xs="24">
              <a-card class="k8s-detail-card" size="small" title="注解信息">
                <div class="k8s-annotations-display">
                  <a-tooltip
                    v-for="[key, value] in Object.entries(
                      currentClusterRoleBindingDetail?.annotations || {},
                    )"
                    :key="key"
                    :title="`${key}: ${value || '-'}`"
                    placement="top"
                  >
                    <a-tag
                      class="k8s-annotation-item"
                      style="
                        margin-bottom: 8px;
                        max-width: 200px;
                        overflow: hidden;
                        text-overflow: ellipsis;
                        white-space: nowrap;
                      "
                    >
                      {{ key }}: {{ value || '-' }}
                    </a-tag>
                  </a-tooltip>
                  <span
                    v-if="
                      !currentClusterRoleBindingDetail?.annotations ||
                      Object.keys(currentClusterRoleBindingDetail.annotations)
                        .length === 0
                    "
                    class="k8s-no-data"
                  >
                    暂无注解
                  </span>
                </div>
              </a-card>
            </a-col>
          </a-row>
        </div>
      </a-spin>
    </a-modal>

    <!-- YAML 模态框 -->
    <a-modal
      v-model:open="isYamlModalVisible"
      :confirmLoading="submitLoading"
      :maskClosable="false"
      :title="`查看/编辑 ${currentOperationClusterRoleBinding?.name} YAML`"
      cancelText="取消"
      destroyOnClose
      okText="保存修改"
      width="900px"
      @cancel="closeYamlModal"
      @ok="submitYamlForm"
    >
      <a-form
        ref="yamlFormRef"
        :model="yamlFormModel"
        :rules="yamlFormRules"
        class="k8s-form"
        layout="vertical"
      >
        <a-form-item name="yaml">
          <div class="yaml-toolbar">
            <a-button
              class="yaml-toolbar-btn yaml-btn-format"
              @click="formatEditYaml"
            >
              <template #icon>
                <FormatPainterOutlined aria-hidden="true" />
              </template>
              格式化
            </a-button>
            <a-button
              class="yaml-toolbar-btn yaml-btn-validate"
              @click="validateEditYaml"
            >
              <template #icon>
                <CheckCircleOutlined aria-hidden="true" />
              </template>
              检查格式
            </a-button>
          </div>
          <a-textarea
            v-model:value="yamlFormModel.yaml"
            :rows="20"
            class="k8s-config-textarea"
            placeholder="YAML 内容"
          />
        </a-form-item>
      </a-form>
    </a-modal>

    <!-- 标签过滤模态框 -->
    <a-modal
      v-model:open="isLabelsFilterModalVisible"
      :maskClosable="false"
      cancelText="取消"
      destroyOnClose
      okText="应用过滤"
      title="本页标签过滤设置"
      width="550px"
      @cancel="closeLabelsFilterModal"
      @ok="applyLabelsFilter"
    >
      <div class="labels-filter-form">
        <div
          class="current-filters"
          v-if="Object.keys(filterLabels).length > 0"
        >
          <h4>当前过滤条件：</h4>
          <div class="filter-tags">
            <a-tag
              v-for="(value, key) in filterLabels"
              :key="key"
              closable
              color="blue"
              style="margin-right: 8px; margin-bottom: 8px"
              @close="removeFilterLabel(key)"
            >
              {{ key }}: {{ value }}
            </a-tag>
          </div>
          <a-button
            danger
            style="padding: 0; margin-bottom: 16px"
            type="link"
            @click="clearFilterLabels"
          >
            清除所有过滤条件
          </a-button>
        </div>

        <div class="add-filter-section">
          <h4>添加过滤条件</h4>
          <div class="filter-input-row" style="gap: 8px">
            <a-input
              v-model:value="newFilterKey"
              placeholder="标签键"
              style="flex: 1"
            />
            <a-input
              v-model:value="newFilterValue"
              placeholder="标签值"
              style="flex: 1"
            />
            <a-button
              type="primary"
              @click="addNewFilterLabel"
              :disabled="!newFilterKey.trim()"
              size="small"
            >
              <template #icon><PlusOutlined aria-hidden="true" /></template>
            </a-button>
          </div>
        </div>
      </div>
    </a-modal>
  </OpsPage>
</template>

<script lang="ts" setup>
import OpsPage from '#/components/ops/OpsPage.vue';
import { clusterResourceKey } from '../shared/utils';
import { onMounted, ref } from 'vue';
import { formatK8sTime } from '../shared/utils';
import { useClusterRoleBindingPage } from './ClusterRoleBinding';
import {
  CheckCircleOutlined,
  ClearOutlined,
  DeleteOutlined,
  DeploymentUnitOutlined,
  EditOutlined,
  EyeOutlined,
  FileAddOutlined,
  FileTextOutlined,
  FormatPainterOutlined,
  PlusOutlined,
  ReloadOutlined,
  SearchOutlined,
  TagsOutlined,
  UserSwitchOutlined,
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
  filterLabels,
  selectedRows,
  currentPage,
  pageSize,
  total,
  clustersTotal,

  // modal state
  isCreateModalVisible,
  isCreateYamlModalVisible,
  isEditModalVisible,
  isDetailModalVisible,
  isYamlModalVisible,
  submitLoading,
  detailLoading,

  // operation targets
  currentOperationClusterRoleBinding,
  currentClusterRoleBindingDetail,

  // form models
  createFormModel,
  editFormModel,
  createYamlFormModel,
  yamlFormModel,

  // form refs
  formRef,
  editFormRef,
  yamlFormRef,
  createYamlFormRef,

  // form rules
  createFormRules,
  editFormRules,
  createYamlFormRules,
  yamlFormRules,

  // computed
  filteredClusterRoleBindings,
  rowSelection,

  // helpers
  getEnvText,

  // operations
  fetchClusters,
  fetchClusterRoleBindings,
  clearClusterRoleBindings,
  loadMoreClusters,

  // detail operations
  showClusterRoleBindingDetail,
  closeDetailModal,

  // YAML operations
  showYamlModal,
  closeYamlModal,
  submitYamlForm,

  // create operations
  openCreateModal,
  closeCreateModal,
  submitCreateForm,
  openCreateYamlModal,
  closeCreateYamlModal,
  submitCreateYamlForm,

  // edit operations
  openEditModal,
  closeEditModal,
  submitEditForm,

  // clusterRoleBinding operations
  deleteClusterRoleBinding,

  // filter operations
  addFilterLabel,
  removeFilterLabel,
  clearFilterLabels,

  // batch operations
  batchOperation,

  // pagination operations
  handlePageChange,

  // form field operations
  addSubjectField,
  removeSubjectField,
  removeLabelField,
  removeAnnotationField,
  addEditSubjectField,
  removeEditSubjectField,
  removeEditLabelField,
  removeEditAnnotationField,

  // YAML utility functions
  insertYamlTemplate,
  formatYaml,
  validateYaml,
  clearYaml,
  formatEditYaml,
  validateEditYaml,
} = useClusterRoleBindingPage();

// 添加新标签/注解的方法
const newLabelKey = ref('');
const newAnnotationKey = ref('');
const editLabelKey = ref('');
const editAnnotationKey = ref('');

const addNewLabel = () => {
  if (newLabelKey.value && newLabelKey.value.trim()) {
    createFormModel.value.labels[newLabelKey.value.trim()] = '';
    newLabelKey.value = '';
  }
};

const addNewAnnotation = () => {
  if (newAnnotationKey.value && newAnnotationKey.value.trim()) {
    createFormModel.value.annotations[newAnnotationKey.value.trim()] = '';
    newAnnotationKey.value = '';
  }
};

const addEditLabel = () => {
  if (editLabelKey.value && editLabelKey.value.trim()) {
    editFormModel.value.labels[editLabelKey.value.trim()] = '';
    editLabelKey.value = '';
  }
};

const addEditAnnotation = () => {
  if (editAnnotationKey.value && editAnnotationKey.value.trim()) {
    editFormModel.value.annotations[editAnnotationKey.value.trim()] = '';
    editAnnotationKey.value = '';
  }
};

// 格式化age显示
const formatAge = (age: string, creationTimestamp?: string): string => {
  if (age && age.trim() !== '') {
    return age;
  }

  if (!creationTimestamp) {
    return '-';
  }

  try {
    const createTime = new Date(creationTimestamp);
    const now = new Date();
    const diff = now.getTime() - createTime.getTime();

    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

    if (days > 365) {
      const years = Math.floor(days / 365);
      return `${years}年${days % 365}天`;
    } else if (days > 30) {
      const months = Math.floor(days / 30);
      return `${months}月${days % 30}天`;
    } else if (days > 0) {
      return `${days}天${hours}小时`;
    } else if (hours > 0) {
      return `${hours}小时${minutes}分钟`;
    } else if (minutes > 0) {
      return `${minutes}分钟`;
    } else {
      return '刚刚';
    }
  } catch {
    return '-';
  }
};

// 注意：时间格式化函数已移至 shared/utils.ts，使用 formatK8sTime
const formatCreationTime = formatK8sTime;

const onSearch = () => {
  currentPage.value = 1;
  fetchClusterRoleBindings();
};

const handleClusterChange = () => {
  currentPage.value = 1;
  clearClusterRoleBindings();

  if (filterClusterId.value) {
    fetchClusterRoleBindings();
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

// 获取主体类型对应的颜色
const getSubjectColor = (kind?: string | null) => {
  if (!kind) return 'default';

  switch (kind) {
    case 'User': {
      return 'blue';
    }
    case 'Group': {
      return 'green';
    }
    case 'ServiceAccount': {
      return 'orange';
    }
    default: {
      return 'default';
    }
  }
};

const columns = [
  {
    title: '名称',
    dataIndex: 'name',
    key: 'name',
    width: '18%',
    ellipsis: true,
    sorter: (a: any, b: any) => a.name.localeCompare(b.name),
  },
  {
    title: '角色引用',
    key: 'roleRef',
    width: '22%',
    ellipsis: true,
  },
  {
    title: '主体',
    key: 'subjects',
    width: '25%',
    ellipsis: true,
  },
  {
    title: '标签',
    dataIndex: 'labels',
    key: 'labels',
    width: '15%',
    ellipsis: true,
  },
  {
    title: '创建时间',
    key: 'created_at',
    width: '12%',
    sorter: (a: any, b: any) => {
      const timeA = new Date(a.created_at).getTime();
      const timeB = new Date(b.created_at).getTime();
      return timeA - timeB;
    },
  },
  {
    title: '操作',
    key: 'actions',
    width: '8%',
    fixed: 'right',
  },
];

// 标签过滤器状态
const isLabelsFilterModalVisible = ref(false);
const newFilterKey = ref('');
const newFilterValue = ref('');

// 标签过滤器操作
const openLabelsFilter = () => {
  isLabelsFilterModalVisible.value = true;
};

const closeLabelsFilterModal = () => {
  isLabelsFilterModalVisible.value = false;
  newFilterKey.value = '';
  newFilterValue.value = '';
};

const addNewFilterLabel = () => {
  if (newFilterKey.value.trim() && newFilterValue.value.trim()) {
    addFilterLabel(newFilterKey.value.trim(), newFilterValue.value.trim());
    newFilterKey.value = '';
    newFilterValue.value = '';
  }
};

const applyLabelsFilter = () => {
  if (newFilterKey.value.trim() && newFilterValue.value.trim()) {
    addNewFilterLabel();
  }
  closeLabelsFilterModal();
};

// 重置所有筛选条件
const resetFilters = () => {
  searchText.value = '';
  filterClusterId.value = undefined;
  clearFilterLabels();
  currentPage.value = 1;
  clearClusterRoleBindings();
};

onMounted(async () => {
  await fetchClusters();
});
</script>

<style scoped>
@import '../shared/k8s-common.css';
</style>

<style scoped src="./ClusterRoleBinding.css"></style>
