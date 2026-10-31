<template>
  <OpsPage
    description="管理和监控集群中的所有 Kubernetes RoleBinding"
    title="RoleBinding 管理"
  >
    <template #actions>
      <a-button
        :disabled="!filterClusterId"
        type="primary"
        @click="openCreateModal"
      >
        <template #icon><PlusOutlined aria-hidden="true" /></template>
        创建 RoleBinding
      </a-button>
      <a-button
        :disabled="!filterClusterId"
        :loading="loading"
        @click="fetchRoleBindings"
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

            <a-select
              v-model:value="filterNamespace"
              :disabled="!filterClusterId"
              :loading="namespacesLoading"
              allow-clear
              aria-label="选择命名空间"
              class="k8s-filter-select k8s-namespace-selector"
              placeholder="选择命名空间"
              @change="handleFilterChange"
            >
              <template #suffixIcon>
                <AppstoreOutlined aria-hidden="true" />
              </template>
              <a-select-option
                v-for="ns in namespaces"
                :key="ns.name"
                :value="ns.name"
              >
                {{ ns.name }}
              </a-select-option>
              <a-select-option
                v-if="
                  namespaces.length > 0 && namespaces.length < namespacesTotal
                "
                :value="'__load_more_namespaces__'"
                disabled
                style="text-align: center; color: var(--ops-muted)"
              >
                <a-button
                  :loading="namespacesLoading"
                  size="small"
                  type="link"
                  @click.stop="loadMoreNamespaces"
                >
                  加载更多...
                </a-button>
              </a-select-option>
            </a-select>

            <!-- 标签过滤器 -->
            <div class="rolebinding-labels-filter">
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
              placeholder="搜索 RoleBinding 名称"
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
                !filterNamespace &&
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
              title="通过YAML创建RoleBinding"
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
                can('k8s.rolebinding.batchDelete') && selectedRows.length > 0
              "
              class="k8s-toolbar-btn"
              title="批量删除选中的 RoleBinding"
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
      v-if="namespacesError"
      :message="namespacesError"
      show-icon
      type="error"
    >
      <template #action>
        <a-button size="small" @click="fetchNamespaces(true)">
          重试命名空间
        </a-button>
      </template>
    </a-alert>
    <a-alert v-if="loadError" :message="loadError" show-icon type="error">
      <template #action>
        <a-button size="small" @click="fetchRoleBindings"> 重试查询 </a-button>
      </template>
    </a-alert>

    <!-- 数据展示区域 -->
    <div class="k8s-data-display">
      <a-table
        :columns="columns"
        :data-source="filteredRoleBindings"
        :loading="loading"
        :pagination="{
          current: currentPage,
          pageSize: pageSize,
          total: total,
          showSizeChanger: true,
          showQuickJumper: true,
          showTotal: (total: number) =>
            `后端共 ${total} 条，本页匹配 ${filteredRoleBindings.length} 条`,
          pageSizeOptions: ['10', '20', '30', '50'],
        }"
        :row-key="namespacedResourceKey"
        :row-selection="rowSelection"
        :scroll="{ x: 1600 }"
        class="k8s-table rolebinding-table"
        @change="handleTableChange"
      >
        <template #bodyCell="{ column, record, text }">
          <template v-if="column.key === 'roleRef'">
            <div class="rolebinding-role-ref">
              <a-tag color="green">{{ record.role_ref?.kind || '-' }}</a-tag>
              <span class="role-name">{{ record.role_ref?.name || '-' }}</span>
            </div>
          </template>
          <template v-else-if="column.key === 'subjects'">
            <div class="rolebinding-subjects">
              <a-tag
                v-for="(subject, index) in (record.subjects || []).slice(0, 2)"
                :key="index"
                :color="getSubjectColor(subject.kind)"
                class="subject-tag"
              >
                {{ subject.kind }}: {{ subject.name }}
              </a-tag>
              <a-tooltip
                v-if="(record.subjects || []).length > 2"
                :title="
                  (record.subjects || [])
                    .map((s: any) => `${s.kind}: ${s.name}`)
                    .join('\n')
                "
              >
                <a-tag class="subject-tag">
                  +{{ (record.subjects || []).length - 2 }} 更多
                </a-tag>
              </a-tooltip>
              <span
                v-if="!record.subjects || record.subjects.length === 0"
                class="k8s-no-data"
                >-</span
              >
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
          <template v-else-if="column.key === 'annotations'">
            <div class="k8s-annotations-display">
              <template v-if="Array.isArray(text)">
                <a-tooltip
                  v-if="text.length > 0"
                  :title="
                    text
                      .map((item: any) => `${item.key}: ${item.value}`)
                      .join('\n')
                  "
                >
                  <a-tag class="k8s-annotation-item" color="purple">
                    {{ text.length }} 个注解
                  </a-tag>
                </a-tooltip>
                <span v-else class="k8s-no-data">-</span>
              </template>
              <template v-else-if="text && typeof text === 'object'">
                <a-tooltip
                  v-if="Object.keys(text).length > 0"
                  :title="
                    Object.entries(text)
                      .map(([k, v]: [string, any]) => `${k}: ${v}`)
                      .join('\n')
                  "
                >
                  <a-tag class="k8s-annotation-item" color="purple">
                    {{ Object.keys(text).length }} 个注解
                  </a-tag>
                </a-tooltip>
                <span v-else class="k8s-no-data">-</span>
              </template>
              <template v-else>
                <span class="k8s-no-data">-</span>
              </template>
            </div>
          </template>
          <template v-else-if="column.key === 'uid'">
            <a-tooltip v-if="text" :title="text">
              <span
                class="k8s-uid-text"
                style="
                  font-family: monospace;
                  font-size: 11px;
                  color: var(--ops-muted);
                "
              >
                {{ text.substring(0, 8) }}...
              </span>
            </a-tooltip>
            <span v-else class="k8s-no-data">-</span>
          </template>
          <template v-else-if="column.key === 'created_at'">
            <div v-if="text" style="font-size: 12px; color: var(--ops-muted)">
              <div>{{ formatDateTime(text) }}</div>
              <div
                style="
                  color: var(--ops-muted);
                  font-size: 11px;
                  margin-top: 2px;
                "
              >
                {{ getRelativeTime(text) }}
              </div>
            </div>
            <span v-else class="k8s-no-data">-</span>
          </template>
          <template v-else-if="column.key === 'actions'">
            <div class="k8s-action-column">
              <a-tooltip title="查看详情">
                <a-button
                  title="查看详情"
                  @click="showRoleBindingDetail(record)"
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
              <a-tooltip v-if="can('k8s.rolebinding.delete')" title="删除">
                <a-button
                  danger
                  title="删除"
                  @click="deleteRoleBinding(record)"
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
            <TeamOutlined aria-hidden="true" />
            <p>暂无 RoleBinding 数据</p>
            <p v-if="!filterClusterId">请先选择集群</p>
            <p v-else>请调整筛选条件或刷新数据</p>
          </div>
        </template>
      </a-table>
    </div>

    <!-- 创建 RoleBinding 模态框 -->
    <a-modal
      v-model:open="isCreateModalVisible"
      :confirmLoading="submitLoading"
      :maskClosable="false"
      cancelText="取消"
      destroyOnClose
      okText="创建"
      title="创建 RoleBinding"
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
        <a-form-item :required="true" label="RoleBinding 名称" name="name">
          <a-input
            v-model:value="createFormModel.name"
            :maxlength="63"
            class="k8s-form-input"
            placeholder="请输入 RoleBinding 名称（例如：my-rolebinding）"
          />
          <div
            style="color: var(--ops-muted); font-size: 12px; margin-top: 4px"
          >
            只能包含小写字母、数字和连字符，且不能以连字符开头或结尾
          </div>
        </a-form-item>

        <a-form-item :required="true" label="命名空间" name="namespace">
          <a-select
            v-model:value="createFormModel.namespace"
            :disabled="!filterClusterId"
            class="k8s-form-input"
            placeholder="请选择命名空间"
          >
            <a-select-option
              v-for="ns in namespaces"
              :key="ns.name"
              :value="ns.name"
            >
              {{ ns.name }}
            </a-select-option>
            <a-select-option
              v-if="
                namespaces.length > 0 && namespaces.length < namespacesTotal
              "
              :value="'__load_more_namespaces_create__'"
              disabled
              style="text-align: center; color: var(--ops-muted)"
            >
              <a-button
                :loading="namespacesLoading"
                size="small"
                type="link"
                @click.stop="loadMoreNamespaces"
              >
                加载更多...
              </a-button>
            </a-select-option>
          </a-select>
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
                  <a-select-option value="Role">Role</a-select-option>
                  <a-select-option value="ClusterRole">
                    ClusterRole
                  </a-select-option>
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
                  placeholder="请输入角色名称（例如：pod-reader）"
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

    <!-- 编辑 RoleBinding 模态框 -->
    <a-modal
      v-model:open="isEditModalVisible"
      :confirmLoading="submitLoading"
      :maskClosable="false"
      cancelText="取消"
      destroyOnClose
      okText="保存"
      title="编辑 RoleBinding"
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
          description="RoleBinding 创建后只能编辑主体、标签和注解信息。名称、命名空间和角色引用（roleRef）是不可变的，无法修改。如需更改角色引用，请删除后重新创建。"
          message="编辑提示"
          show-icon
          style="margin-bottom: 24px"
          type="warning"
        />

        <!-- 基础信息（只读） -->
        <a-row :gutter="16">
          <a-col :span="12">
            <a-form-item label="RoleBinding 名称">
              <a-input
                :value="editFormModel.name"
                class="k8s-form-input"
                disabled
              />
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item label="命名空间">
              <a-input
                :value="editFormModel.namespace"
                class="k8s-form-input"
                disabled
              />
            </a-form-item>
          </a-col>
        </a-row>

        <a-form-item label="角色引用（不可修改）">
          <a-row :gutter="12">
            <a-col :span="8">
              <a-select
                v-model:value="editFormModel.role_ref.kind"
                class="k8s-form-input"
                disabled
                placeholder="角色类型"
              >
                <a-select-option value="Role">Role</a-select-option>
                <a-select-option value="ClusterRole">
                  ClusterRole
                </a-select-option>
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

    <!-- 通过 YAML 创建 RoleBinding 模态框 -->
    <a-modal
      v-model:open="isCreateYamlModalVisible"
      :confirmLoading="submitLoading"
      :maskClosable="false"
      cancelText="取消"
      destroyOnClose
      okText="创建"
      title="通过 YAML 创建 RoleBinding"
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
            placeholder="请输入 RoleBinding YAML 内容，或点击【插入模板】使用默认模板"
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
      title="RoleBinding 详情"
      width="1000px"
      @cancel="closeDetailModal"
    >
      <a-spin :spinning="detailLoading">
        <div v-if="currentRoleBindingDetail" class="k8s-detail-content">
          <a-row :gutter="[24, 16]">
            <a-col :lg="12" :xs="24">
              <a-card class="k8s-detail-card" size="small" title="基本信息">
                <div class="k8s-detail-item">
                  <span class="k8s-detail-label">RoleBinding 名称:</span>
                  <span class="k8s-detail-value">{{
                    currentRoleBindingDetail.name
                  }}</span>
                </div>
                <div class="k8s-detail-item">
                  <span class="k8s-detail-label">命名空间:</span>
                  <span class="k8s-detail-value">{{
                    currentRoleBindingDetail.namespace
                  }}</span>
                </div>
                <div class="k8s-detail-item">
                  <span class="k8s-detail-label">所属集群:</span>
                  <span class="k8s-detail-value">
                    <a-tag color="blue">{{
                      getClusterName(currentRoleBindingDetail.cluster_id)
                    }}</a-tag>
                  </span>
                </div>
                <div class="k8s-detail-item">
                  <span class="k8s-detail-label">UID:</span>
                  <span class="k8s-detail-value">{{
                    currentRoleBindingDetail.uid || '-'
                  }}</span>
                </div>
                <div class="k8s-detail-item">
                  <span class="k8s-detail-label">创建时间:</span>
                  <span class="k8s-detail-value">{{
                    currentRoleBindingDetail.created_at || '-'
                  }}</span>
                </div>
                <div class="k8s-detail-item">
                  <span class="k8s-detail-label">存在时间:</span>
                  <span class="k8s-detail-value">{{
                    currentRoleBindingDetail.age || '-'
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
                        currentRoleBindingDetail.role_ref?.kind
                          ? 'green'
                          : 'red'
                      "
                    >
                      {{ currentRoleBindingDetail.role_ref?.kind || '未配置' }}
                    </a-tag>
                  </span>
                </div>
                <div class="k8s-detail-item">
                  <span class="k8s-detail-label">角色名称:</span>
                  <span class="k8s-detail-value">{{
                    currentRoleBindingDetail.role_ref?.name || '-'
                  }}</span>
                </div>
                <div class="k8s-detail-item">
                  <span class="k8s-detail-label">API 组:</span>
                  <span class="k8s-detail-value">{{
                    currentRoleBindingDetail.role_ref?.api_group || '-'
                  }}</span>
                </div>
              </a-card>
            </a-col>
          </a-row>

          <a-row :gutter="[24, 16]" style="margin-top: 16px">
            <a-col :xs="24">
              <a-card class="k8s-detail-card" size="small" title="主体信息">
                <div class="rolebinding-subjects-detail">
                  <div
                    v-for="(
                      subject, index
                    ) in currentRoleBindingDetail.subjects || []"
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
                      !currentRoleBindingDetail.subjects ||
                      currentRoleBindingDetail.subjects.length === 0
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
                      currentRoleBindingDetail.labels || {},
                    )"
                    :key="key"
                    :title="`${key}: ${value}`"
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
                      {{ key }}: {{ value }}
                    </a-tag>
                  </a-tooltip>
                  <span
                    v-if="
                      !currentRoleBindingDetail.labels ||
                      Object.keys(currentRoleBindingDetail.labels).length === 0
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
                      currentRoleBindingDetail.annotations || {},
                    )"
                    :key="key"
                    :title="`${key}: ${value}`"
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
                      {{ key }}: {{ value }}
                    </a-tag>
                  </a-tooltip>
                  <span
                    v-if="
                      !currentRoleBindingDetail.annotations ||
                      Object.keys(currentRoleBindingDetail.annotations)
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
      :title="`查看/编辑 ${currentOperationRoleBinding?.name} YAML`"
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
import { namespacedResourceKey } from '../shared/utils';
import { onMounted, ref } from 'vue';
import { useRoleBindingPage } from './RoleBinding';
import { formatDateTime, getRelativeTime } from '../shared/utils';
import {
  AppstoreOutlined,
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
  TeamOutlined,
} from '@ant-design/icons-vue';

import { usePermission } from '#/utils/permission';

const { can } = usePermission();

const {
  // state
  clusters,
  namespaces,
  loading,
  loadError,
  clustersError,
  namespacesError,
  clustersLoading,
  namespacesLoading,
  searchText,
  filterClusterId,
  filterNamespace,
  filterLabels,
  selectedRows,
  currentPage,
  pageSize,
  total,
  clustersTotal,
  namespacesTotal,

  // modal state
  isCreateModalVisible,
  isCreateYamlModalVisible,
  isEditModalVisible,
  isDetailModalVisible,
  isYamlModalVisible,
  submitLoading,
  detailLoading,

  // operation targets
  currentOperationRoleBinding,
  currentRoleBindingDetail,

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
  filteredRoleBindings,
  rowSelection,

  // helpers
  getEnvText,
  getClusterName,

  // operations
  fetchClusters,
  fetchNamespaces,
  fetchRoleBindings,
  clearRoleBindings,
  clearNamespaces,
  loadMoreClusters,
  loadMoreNamespaces,

  // detail operations
  showRoleBindingDetail,
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

  // roleBinding operations
  deleteRoleBinding,

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
} = useRoleBindingPage();

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

const onSearch = () => {
  currentPage.value = 1;
  fetchRoleBindings();
};

const handleFilterChange = () => {
  currentPage.value = 1;
  fetchRoleBindings();
};

const handleClusterChange = () => {
  currentPage.value = 1;
  clearNamespaces();
  clearRoleBindings();

  if (filterClusterId.value) {
    fetchNamespaces(true);
    fetchRoleBindings();
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
const getSubjectColor = (kind: string) => {
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
    width: 150,
    ellipsis: true,
    fixed: 'left',
  },
  {
    title: '命名空间',
    dataIndex: 'namespace',
    key: 'namespace',
    width: 120,
    ellipsis: true,
  },
  { title: '角色引用', key: 'roleRef', width: 180 },
  { title: '主体', key: 'subjects', width: 200 },
  { title: '标签', dataIndex: 'labels', key: 'labels', width: 150 },
  { title: '注解', dataIndex: 'annotations', key: 'annotations', width: 120 },
  { title: 'UID', dataIndex: 'uid', key: 'uid', width: 100, ellipsis: true },
  { title: '创建时间', dataIndex: 'created_at', key: 'created_at', width: 160 },
  {
    title: '操作',
    key: 'actions',
    width: 230,
    fixed: 'right',
    align: 'center',
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
  filterNamespace.value = undefined;
  clearFilterLabels();
  currentPage.value = 1;
  clearRoleBindings();
  clearNamespaces();
};

onMounted(async () => {
  await fetchClusters();
});
</script>

<style scoped>
@import '../shared/k8s-common.css';
</style>

<style scoped src="./RoleBinding.css"></style>
