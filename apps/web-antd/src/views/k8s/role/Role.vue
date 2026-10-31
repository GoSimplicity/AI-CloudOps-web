<template>
  <OpsPage
    description="管理和监控集群中的所有 Kubernetes Role"
    title="Role 管理"
  >
    <template #actions>
      <a-button
        :disabled="!filterClusterId"
        type="primary"
        @click="openCreateModal"
      >
        <template #icon><PlusOutlined aria-hidden="true" /></template>
        创建 Role
      </a-button>
      <a-button
        :disabled="!filterClusterId"
        :loading="loading"
        @click="fetchRoles"
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
            <div class="role-labels-filter">
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
              placeholder="搜索 Role 名称"
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
              title="通过YAML创建Role"
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
              v-if="can('k8s.role.batchDelete') && selectedRows.length > 0"
              class="k8s-toolbar-btn"
              title="批量删除选中的 Role"
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
        <a-button size="small" @click="fetchRoles"> 重试查询 </a-button>
      </template>
    </a-alert>

    <!-- 数据展示区域 -->
    <div class="k8s-data-display">
      <a-table
        :columns="columns"
        :data-source="filteredRoles"
        :loading="loading"
        :pagination="{
          current: currentPage,
          pageSize: pageSize,
          total: total,
          showSizeChanger: true,
          showQuickJumper: true,
          showTotal: (total: number) =>
            `后端共 ${total} 条，本页匹配 ${filteredRoles.length} 条`,
          pageSizeOptions: ['10', '20', '30', '50'],
        }"
        :row-key="namespacedResourceKey"
        :row-selection="rowSelection"
        :scroll="{ x: 1600 }"
        class="k8s-table role-table"
        @change="handleTableChange"
      >
        <template #bodyCell="{ column, record, text }">
          <template v-if="column.key === 'rules'">
            <div class="role-rules">
              <template
                v-if="
                  getRulesFromRecord(record) &&
                  getRulesFromRecord(record).length > 0
                "
              >
                <div
                  v-for="(rule, index) in getRulesFromRecord(record).slice(
                    0,
                    2,
                  )"
                  :key="index"
                  class="rule-item"
                >
                  <div class="rule-verbs">
                    <a-tag
                      v-for="verb in (rule.verbs || []).slice(0, 3)"
                      :key="verb"
                      color="blue"
                      size="small"
                    >
                      {{ verb }}
                    </a-tag>
                    <a-tag v-if="(rule.verbs || []).length > 3" size="small">
                      +{{ (rule.verbs || []).length - 3 }}
                    </a-tag>
                  </div>
                  <div class="rule-resources">
                    <span class="rule-label">资源:</span>
                    <a-tag
                      v-for="resource in (rule.resources || []).slice(0, 2)"
                      :key="resource"
                      color="green"
                      size="small"
                    >
                      {{ resource }}
                    </a-tag>
                    <a-tag
                      v-if="(rule.resources || []).length > 2"
                      size="small"
                    >
                      +{{ (rule.resources || []).length - 2 }}
                    </a-tag>
                  </div>
                </div>
                <div
                  v-if="getRulesFromRecord(record).length > 2"
                  class="rule-more"
                >
                  <a-tag size="small">
                    +{{ getRulesFromRecord(record).length - 2 }}
                    更多规则
                  </a-tag>
                </div>
              </template>
              <span v-else class="k8s-no-data">无策略规则</span>
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
                <a-button title="查看详情" @click="showRoleDetail(record)">
                  <template #icon><EyeOutlined aria-hidden="true" /></template>
                </a-button>
              </a-tooltip>
              <a-tooltip title="编辑">
                <a-button title="编辑" @click="openEditModal(record)">
                  <template #icon><EditOutlined aria-hidden="true" /></template>
                </a-button>
              </a-tooltip>
              <a-tooltip title="查看 YAML">
                <a-button title="查看 YAML" @click="showYamlModal(record)">
                  <template #icon>
                    <FileTextOutlined aria-hidden="true" />
                  </template>
                </a-button>
              </a-tooltip>
              <a-tooltip v-if="can('k8s.role.delete')" title="删除">
                <a-button danger title="删除" @click="deleteRole(record)">
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
            <SafetyCertificateOutlined aria-hidden="true" />
            <p>暂无 Role 数据</p>
            <p v-if="!filterClusterId">请先选择集群</p>
            <p v-else>请调整筛选条件或刷新数据</p>
          </div>
        </template>
      </a-table>
    </div>

    <!-- 创建 Role 模态框 -->
    <a-modal
      v-model:open="isCreateModalVisible"
      :confirmLoading="submitLoading"
      :maskClosable="false"
      cancelText="取消"
      destroyOnClose
      okText="创建"
      title="创建 Role"
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
        <a-form-item :required="true" label="Role 名称" name="name">
          <a-input
            v-model:value="createFormModel.name"
            :maxlength="63"
            class="k8s-form-input"
            placeholder="请输入 Role 名称（例如：pod-reader）"
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

        <a-form-item :required="true" label="策略规则">
          <div class="role-rules-inputs">
            <div
              v-for="(rule, ruleIndex) in createFormModel.rules"
              :key="ruleIndex"
              class="rule-input-group"
            >
              <div class="rule-header">
                <span class="rule-title">规则 {{ ruleIndex + 1 }}</span>
                <a-button
                  :disabled="createFormModel.rules.length <= 1"
                  class="k8s-remove-btn"
                  danger
                  size="small"
                  title="删除此规则"
                  type="text"
                  @click="removeRuleField(ruleIndex)"
                >
                  <template #icon>
                    <DeleteOutlined aria-hidden="true" />
                  </template>
                </a-button>
              </div>

              <!-- 动词 -->
              <div class="rule-field">
                <label class="rule-field-label">动词 (Verbs) *</label>
                <div class="rule-tags-input">
                  <div class="tags-display">
                    <a-tag
                      v-for="(verb, verbIndex) in rule.verbs"
                      :key="verbIndex"
                      closable
                      color="blue"
                      @close="removeVerbFromRule(ruleIndex, verbIndex)"
                    >
                      {{ verb }}
                    </a-tag>
                  </div>
                  <div class="add-tag-row">
                    <a-select
                      :value="newVerbs[ruleIndex]"
                      placeholder="选择动词"
                      style="flex: 1; margin-right: 8px"
                      @change="(value: string) => (newVerbs[ruleIndex] = value)"
                    >
                      <a-select-option value="get">get</a-select-option>
                      <a-select-option value="list">list</a-select-option>
                      <a-select-option value="watch">watch</a-select-option>
                      <a-select-option value="create">create</a-select-option>
                      <a-select-option value="update">update</a-select-option>
                      <a-select-option value="patch">patch</a-select-option>
                      <a-select-option value="delete">delete</a-select-option>
                      <a-select-option value="deletecollection">
                        deletecollection
                      </a-select-option>
                      <a-select-option value="*">* (全部)</a-select-option>
                    </a-select>
                    <a-button
                      :disabled="!newVerbs[ruleIndex]"
                      size="small"
                      type="primary"
                      @click="
                        () => {
                          addVerbToRule(ruleIndex, newVerbs[ruleIndex] || '');
                          newVerbs[ruleIndex] = '';
                        }
                      "
                    >
                      <template #icon>
                        <PlusOutlined aria-hidden="true" />
                      </template>
                    </a-button>
                  </div>
                </div>
              </div>

              <!-- API 组 -->
              <div class="rule-field">
                <label class="rule-field-label">API 组 (API Groups)</label>
                <div class="rule-tags-input">
                  <div class="tags-display">
                    <a-tag
                      v-for="(apiGroup, groupIndex) in rule.api_groups"
                      :key="groupIndex"
                      closable
                      color="green"
                      @close="removeApiGroupFromRule(ruleIndex, groupIndex)"
                    >
                      {{ apiGroup || '""(core)' }}
                    </a-tag>
                  </div>
                  <div class="add-tag-row">
                    <a-input
                      :value="newApiGroups[ruleIndex]"
                      placeholder="输入API组，留空表示core组"
                      style="flex: 1; margin-right: 8px"
                      @input="
                        (e: any) => (newApiGroups[ruleIndex] = e.target.value)
                      "
                      @press-enter="
                        () => {
                          const value = newApiGroups[ruleIndex];
                          if (value !== undefined) {
                            addApiGroupToRule(ruleIndex, value.trim());
                            newApiGroups[ruleIndex] = '';
                          }
                        }
                      "
                    />
                    <a-button
                      size="small"
                      type="primary"
                      @click="
                        () => {
                          const value = newApiGroups[ruleIndex];
                          if (value !== undefined) {
                            addApiGroupToRule(ruleIndex, value.trim());
                            newApiGroups[ruleIndex] = '';
                          }
                        }
                      "
                    >
                      <template #icon>
                        <PlusOutlined aria-hidden="true" />
                      </template>
                    </a-button>
                  </div>
                </div>
              </div>

              <!-- 资源 -->
              <div class="rule-field">
                <label class="rule-field-label">资源 (Resources) *</label>
                <div class="rule-tags-input">
                  <div class="tags-display">
                    <a-tag
                      v-for="(resource, resourceIndex) in rule.resources || []"
                      :key="resourceIndex"
                      v-show="resource && resource.trim()"
                      closable
                      @close="removeResourceFromRule(ruleIndex, resourceIndex)"
                      color="orange"
                    >
                      {{ resource }}
                    </a-tag>
                  </div>
                  <div class="add-tag-row">
                    <a-input
                      :value="newResources[ruleIndex]"
                      placeholder="输入资源类型，如: pods, services"
                      style="flex: 1; margin-right: 8px"
                      @input="
                        (e: any) => (newResources[ruleIndex] = e.target.value)
                      "
                      @press-enter="
                        () => {
                          const value = newResources[ruleIndex];
                          if (value && value.trim()) {
                            addResourceToRule(ruleIndex, value.trim());
                            newResources[ruleIndex] = '';
                          }
                        }
                      "
                    />
                    <a-button
                      type="primary"
                      @click="
                        () => {
                          const value = newResources[ruleIndex];
                          if (value && value.trim()) {
                            addResourceToRule(ruleIndex, value.trim());
                            newResources[ruleIndex] = '';
                          }
                        }
                      "
                      :disabled="!newResources[ruleIndex]?.trim()"
                      size="small"
                    >
                      <template #icon>
                        <PlusOutlined aria-hidden="true" />
                      </template>
                    </a-button>
                  </div>
                </div>
              </div>
            </div>

            <a-button
              style="margin-top: 16px; width: 100%"
              type="dashed"
              @click="addRuleField"
            >
              <template #icon><PlusOutlined aria-hidden="true" /></template>
              添加策略规则
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

    <!-- 编辑 Role 模态框 -->
    <a-modal
      v-model:open="isEditModalVisible"
      :confirmLoading="submitLoading"
      :maskClosable="false"
      cancelText="取消"
      destroyOnClose
      okText="保存"
      title="编辑 Role"
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
        <!-- 基础配置 -->
        <a-row :gutter="16">
          <a-col :span="12">
            <a-form-item label="Role 名称" name="name">
              <a-input
                v-model:value="editFormModel.name"
                class="k8s-form-input"
                disabled
                placeholder="Role 名称"
              />
              <div
                style="
                  color: var(--ops-muted);
                  font-size: 12px;
                  margin-top: 4px;
                "
              >
                名称不可修改
              </div>
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item label="命名空间" name="namespace">
              <a-input
                v-model:value="editFormModel.namespace"
                class="k8s-form-input"
                disabled
                placeholder="命名空间"
              />
              <div
                style="
                  color: var(--ops-muted);
                  font-size: 12px;
                  margin-top: 4px;
                "
              >
                命名空间不可修改
              </div>
            </a-form-item>
          </a-col>
        </a-row>

        <!-- 策略规则 -->
        <a-form-item label="策略规则">
          <div class="role-rules-inputs">
            <div
              v-for="(rule, ruleIndex) in editFormModel.rules"
              :key="ruleIndex"
              class="rule-input-group"
            >
              <div class="rule-header">
                <span class="rule-title">规则 {{ ruleIndex + 1 }}</span>
                <a-button
                  :disabled="editFormModel.rules.length <= 1"
                  class="k8s-remove-btn"
                  danger
                  size="small"
                  title="删除此规则"
                  type="text"
                  @click="removeRuleField(ruleIndex)"
                >
                  <template #icon>
                    <DeleteOutlined aria-hidden="true" />
                  </template>
                </a-button>
              </div>

              <!-- 动词 -->
              <div class="rule-field">
                <label class="rule-field-label">动词 (Verbs) *</label>
                <div class="rule-tags-input">
                  <div class="tags-display">
                    <a-tag
                      v-for="(verb, verbIndex) in rule.verbs"
                      :key="verbIndex"
                      closable
                      color="blue"
                      @close="removeVerbFromRule(ruleIndex, verbIndex)"
                    >
                      {{ verb }}
                    </a-tag>
                  </div>
                  <div class="add-tag-row">
                    <a-select
                      :value="newVerbs[ruleIndex]"
                      placeholder="选择动词"
                      style="flex: 1; margin-right: 8px"
                      @change="(value: string) => (newVerbs[ruleIndex] = value)"
                    >
                      <a-select-option value="get">get</a-select-option>
                      <a-select-option value="list">list</a-select-option>
                      <a-select-option value="watch">watch</a-select-option>
                      <a-select-option value="create">create</a-select-option>
                      <a-select-option value="update">update</a-select-option>
                      <a-select-option value="patch">patch</a-select-option>
                      <a-select-option value="delete">delete</a-select-option>
                      <a-select-option value="deletecollection">
                        deletecollection
                      </a-select-option>
                      <a-select-option value="*">* (全部)</a-select-option>
                    </a-select>
                    <a-button
                      :disabled="!newVerbs[ruleIndex]"
                      size="small"
                      type="primary"
                      @click="
                        () => {
                          addVerbToRule(ruleIndex, newVerbs[ruleIndex] || '');
                          newVerbs[ruleIndex] = '';
                        }
                      "
                    >
                      <template #icon>
                        <PlusOutlined aria-hidden="true" />
                      </template>
                    </a-button>
                  </div>
                </div>
              </div>

              <!-- API 组 -->
              <div class="rule-field">
                <label class="rule-field-label">API 组 (API Groups)</label>
                <div class="rule-tags-input">
                  <div class="tags-display">
                    <a-tag
                      v-for="(apiGroup, groupIndex) in rule.api_groups"
                      :key="groupIndex"
                      closable
                      color="green"
                      @close="removeApiGroupFromRule(ruleIndex, groupIndex)"
                    >
                      {{ apiGroup || '""(core)' }}
                    </a-tag>
                  </div>
                  <div class="add-tag-row">
                    <a-input
                      :value="newApiGroups[ruleIndex]"
                      placeholder="输入API组，留空表示core组"
                      style="flex: 1; margin-right: 8px"
                      @input="
                        (e: any) => (newApiGroups[ruleIndex] = e.target.value)
                      "
                      @press-enter="
                        () => {
                          const value = newApiGroups[ruleIndex];
                          if (value !== undefined) {
                            addApiGroupToRule(ruleIndex, value.trim());
                            newApiGroups[ruleIndex] = '';
                          }
                        }
                      "
                    />
                    <a-button
                      size="small"
                      type="primary"
                      @click="
                        () => {
                          const value = newApiGroups[ruleIndex];
                          if (value !== undefined) {
                            addApiGroupToRule(ruleIndex, value.trim());
                            newApiGroups[ruleIndex] = '';
                          }
                        }
                      "
                    >
                      <template #icon>
                        <PlusOutlined aria-hidden="true" />
                      </template>
                    </a-button>
                  </div>
                </div>
              </div>

              <!-- 资源 -->
              <div class="rule-field">
                <label class="rule-field-label">资源 (Resources) *</label>
                <div class="rule-tags-input">
                  <div class="tags-display">
                    <a-tag
                      v-for="(resource, resourceIndex) in rule.resources || []"
                      :key="resourceIndex"
                      v-show="resource && resource.trim()"
                      closable
                      @close="removeResourceFromRule(ruleIndex, resourceIndex)"
                      color="orange"
                    >
                      {{ resource }}
                    </a-tag>
                  </div>
                  <div class="add-tag-row">
                    <a-input
                      :value="newResources[ruleIndex]"
                      placeholder="输入资源类型，如: pods, services"
                      style="flex: 1; margin-right: 8px"
                      @input="
                        (e: any) => (newResources[ruleIndex] = e.target.value)
                      "
                      @press-enter="
                        () => {
                          const value = newResources[ruleIndex];
                          if (value && value.trim()) {
                            addResourceToRule(ruleIndex, value.trim());
                            newResources[ruleIndex] = '';
                          }
                        }
                      "
                    />
                    <a-button
                      type="primary"
                      @click="
                        () => {
                          const value = newResources[ruleIndex];
                          if (value && value.trim()) {
                            addResourceToRule(ruleIndex, value.trim());
                            newResources[ruleIndex] = '';
                          }
                        }
                      "
                      :disabled="!newResources[ruleIndex]?.trim()"
                      size="small"
                    >
                      <template #icon>
                        <PlusOutlined aria-hidden="true" />
                      </template>
                    </a-button>
                  </div>
                </div>
              </div>
            </div>

            <a-button
              style="margin-top: 16px; width: 100%"
              type="dashed"
              @click="addRuleField"
            >
              <template #icon><PlusOutlined aria-hidden="true" /></template>
              添加策略规则
            </a-button>
          </div>
        </a-form-item>

        <!-- 标签配置 -->
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
                :maxlength="100"
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

        <!-- 注解配置 -->
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

    <!-- 通过 YAML 创建 Role 模态框 -->
    <a-modal
      v-model:open="isCreateYamlModalVisible"
      :confirmLoading="submitLoading"
      :maskClosable="false"
      cancelText="取消"
      destroyOnClose
      okText="创建"
      title="通过 YAML 创建 Role"
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
            placeholder="请输入 Role YAML 内容，或点击【插入模板】使用默认模板"
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
      title="Role 详情"
      width="1000px"
      @cancel="closeDetailModal"
    >
      <a-spin :spinning="detailLoading">
        <div v-if="currentRoleDetail" class="k8s-detail-content">
          <a-row :gutter="[24, 16]">
            <a-col :lg="12" :xs="24">
              <a-card class="k8s-detail-card" size="small" title="基本信息">
                <div class="k8s-detail-item">
                  <span class="k8s-detail-label">Role 名称:</span>
                  <span class="k8s-detail-value">{{
                    currentRoleDetail.name
                  }}</span>
                </div>
                <div class="k8s-detail-item">
                  <span class="k8s-detail-label">命名空间:</span>
                  <span class="k8s-detail-value">{{
                    currentRoleDetail.namespace
                  }}</span>
                </div>
                <div class="k8s-detail-item">
                  <span class="k8s-detail-label">集群ID:</span>
                  <span class="k8s-detail-value">{{
                    currentRoleDetail.cluster_id
                  }}</span>
                </div>
                <div class="k8s-detail-item">
                  <span class="k8s-detail-label">UID:</span>
                  <span class="k8s-detail-value">{{
                    currentRoleDetail.uid || '-'
                  }}</span>
                </div>
                <div class="k8s-detail-item">
                  <span class="k8s-detail-label">创建时间:</span>
                  <span class="k8s-detail-value">{{
                    currentRoleDetail.created_at || '-'
                  }}</span>
                </div>
                <div class="k8s-detail-item">
                  <span class="k8s-detail-label">存在时间:</span>
                  <span class="k8s-detail-value">{{
                    formatAge(
                      currentRoleDetail.age,
                      currentRoleDetail.created_at,
                    )
                  }}</span>
                </div>
              </a-card>
            </a-col>

            <a-col :lg="12" :xs="24">
              <a-card class="k8s-detail-card" size="small" title="策略规则统计">
                <div class="k8s-detail-item">
                  <span class="k8s-detail-label">规则数量:</span>
                  <span class="k8s-detail-value">{{
                    getRulesFromRecord(currentRoleDetail).length
                  }}</span>
                </div>
                <div class="k8s-detail-item">
                  <span class="k8s-detail-label">总动词数:</span>
                  <span class="k8s-detail-value">{{
                    getTotalVerbs(getRulesFromRecord(currentRoleDetail))
                  }}</span>
                </div>
                <div class="k8s-detail-item">
                  <span class="k8s-detail-label">总资源数:</span>
                  <span class="k8s-detail-value">{{
                    getTotalResources(getRulesFromRecord(currentRoleDetail))
                  }}</span>
                </div>
              </a-card>
            </a-col>
          </a-row>

          <a-row :gutter="[24, 16]" style="margin-top: 16px">
            <a-col :xs="24">
              <a-card class="k8s-detail-card" size="small" title="策略规则详情">
                <div class="role-rules-detail">
                  <template
                    v-if="getRulesFromRecord(currentRoleDetail).length > 0"
                  >
                    <div
                      v-for="(rule, index) in getRulesFromRecord(
                        currentRoleDetail,
                      )"
                      :key="index"
                      class="rule-detail-item"
                    >
                      <div class="rule-detail-header">
                        <span class="rule-detail-title"
                          >规则 {{ index + 1 }}</span
                        >
                      </div>
                      <div class="rule-detail-content">
                        <div class="rule-detail-row">
                          <span class="rule-detail-label">动词:</span>
                          <div class="rule-detail-tags">
                            <a-tag
                              v-for="verb in rule.verbs || []"
                              :key="verb"
                              color="blue"
                              size="small"
                            >
                              {{ verb }}
                            </a-tag>
                            <span
                              v-if="!(rule.verbs || []).length"
                              class="k8s-no-data"
                              >-</span
                            >
                          </div>
                        </div>
                        <div class="rule-detail-row">
                          <span class="rule-detail-label">API 组:</span>
                          <div class="rule-detail-tags">
                            <a-tag
                              v-for="apiGroup in rule.apiGroups || []"
                              :key="apiGroup"
                              color="green"
                              size="small"
                            >
                              {{ apiGroup || '"" (core)' }}
                            </a-tag>
                            <span
                              v-if="!(rule.apiGroups || []).length"
                              class="k8s-no-data"
                              >-</span
                            >
                          </div>
                        </div>
                        <div class="rule-detail-row">
                          <span class="rule-detail-label">资源:</span>
                          <div class="rule-detail-tags">
                            <a-tag
                              v-for="resource in rule.resources || []"
                              :key="resource"
                              color="orange"
                              size="small"
                            >
                              {{ resource }}
                            </a-tag>
                            <span
                              v-if="!(rule.resources || []).length"
                              class="k8s-no-data"
                              >-</span
                            >
                          </div>
                        </div>
                        <div
                          v-if="(rule.resourceNames || []).length > 0"
                          class="rule-detail-row"
                        >
                          <span class="rule-detail-label">资源名称:</span>
                          <div class="rule-detail-tags">
                            <a-tag
                              v-for="resourceName in rule.resourceNames || []"
                              :key="resourceName"
                              color="purple"
                              size="small"
                            >
                              {{ resourceName }}
                            </a-tag>
                          </div>
                        </div>
                      </div>
                    </div>
                  </template>
                  <span v-else class="k8s-no-data"> 暂无策略规则 </span>
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
                      currentRoleDetail.labels || {},
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
                      !currentRoleDetail.labels ||
                      Object.keys(currentRoleDetail.labels).length === 0
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
                      currentRoleDetail.annotations || {},
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
                      !currentRoleDetail.annotations ||
                      Object.keys(currentRoleDetail.annotations).length === 0
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
      :title="`查看/编辑 ${currentOperationRole?.name} YAML`"
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
import { onMounted, ref, watch } from 'vue';
import { useRolePage } from './Role';
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
  SafetyCertificateOutlined,
  SearchOutlined,
  TagsOutlined,
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
  currentOperationRole,
  currentRoleDetail,

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
  filteredRoles,
  rowSelection,

  // helpers
  getEnvText,

  // operations
  fetchClusters,
  fetchNamespaces,
  fetchRoles,
  clearRoles,
  clearNamespaces,
  loadMoreClusters,
  loadMoreNamespaces,

  // detail operations
  showRoleDetail,
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

  // role operations
  deleteRole,

  // filter operations
  addFilterLabel,
  removeFilterLabel,
  clearFilterLabels,

  // batch operations
  batchOperation,

  // pagination operations
  handlePageChange,

  // form field operations
  addRuleField,
  removeRuleField,
  addVerbToRule,
  removeVerbFromRule,
  addApiGroupToRule,
  removeApiGroupFromRule,
  addResourceToRule,
  removeResourceFromRule,
  removeLabelField,
  removeAnnotationField,

  // YAML utility functions
  insertYamlTemplate,
  formatYaml,
  validateYaml,
  clearYaml,
  formatEditYaml,
  validateEditYaml,
} = useRolePage();

// 添加新标签/注解的方法
const newLabelKey = ref('');
const newAnnotationKey = ref('');

const addNewLabel = () => {
  if (newLabelKey.value && newLabelKey.value.trim()) {
    const formModel = isEditModalVisible.value
      ? editFormModel.value
      : createFormModel.value;
    formModel.labels[newLabelKey.value.trim()] = '';
    newLabelKey.value = '';
  }
};

const addNewAnnotation = () => {
  if (newAnnotationKey.value && newAnnotationKey.value.trim()) {
    const formModel = isEditModalVisible.value
      ? editFormModel.value
      : createFormModel.value;
    formModel.annotations[newAnnotationKey.value.trim()] = '';
    newAnnotationKey.value = '';
  }
};

// 规则输入字段状态
const newVerbs = ref<string[]>([]);
const newApiGroups = ref<string[]>([]);
const newResources = ref<string[]>([]);

// 初始化规则输入字段
watch(
  () => createFormModel.value.rules.length,
  (newLength) => {
    while (newVerbs.value.length < newLength) {
      newVerbs.value.push('');
      newApiGroups.value.push('');
      newResources.value.push('');
    }
  },
  { immediate: true },
);

const onSearch = () => {
  currentPage.value = 1;
  fetchRoles();
};

const handleFilterChange = () => {
  currentPage.value = 1;
  fetchRoles();
};

const handleClusterChange = () => {
  currentPage.value = 1;
  clearNamespaces();
  clearRoles();

  if (filterClusterId.value) {
    fetchNamespaces(true);
    fetchRoles();
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

// 从record中获取rules信息，如果rules为null则尝试从annotations中解析
const getRulesFromRecord = (record: any): any[] => {
  if (!record) return [];

  // 如果rules字段存在且不为null，直接返回
  if (record.rules && Array.isArray(record.rules)) {
    return record.rules;
  }

  // 尝试从annotations中解析rules
  if (
    record.annotations &&
    record.annotations['kubectl.kubernetes.io/last-applied-configuration']
  ) {
    try {
      const config = JSON.parse(
        record.annotations['kubectl.kubernetes.io/last-applied-configuration'],
      );
      if (config.rules && Array.isArray(config.rules)) {
        return config.rules;
      }
    } catch {}
  }

  return [];
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

    if (days > 0) {
      return `${days}天`;
    } else if (hours > 0) {
      return `${hours}小时`;
    } else if (minutes > 0) {
      return `${minutes}分钟`;
    } else {
      return '刚刚';
    }
  } catch {
    return '-';
  }
};

// 计算统计信息
const getTotalVerbs = (rules: any[]) => {
  return rules.reduce((total, rule) => total + (rule.verbs || []).length, 0);
};

const getTotalResources = (rules: any[]) => {
  return rules.reduce(
    (total, rule) => total + (rule.resources || []).length,
    0,
  );
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
  { title: '策略规则', key: 'rules', width: 200 },
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
  clearRoles();
  clearNamespaces();
};

onMounted(async () => {
  await fetchClusters();
});
</script>

<style scoped>
@import '../shared/k8s-common.css';
</style>

<style scoped src="./Role.css"></style>
