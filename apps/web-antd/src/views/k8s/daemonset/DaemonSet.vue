<template>
  <OpsPage
    description="管理和监控集群中的所有 Kubernetes DaemonSet"
    title="DaemonSet 管理"
  >
    <template #actions>
      <a-button
        :disabled="!filterClusterId"
        type="primary"
        @click="openCreateModal"
      >
        <template #icon><PlusOutlined aria-hidden="true" /></template>
        创建 DaemonSet
      </a-button>
      <a-button
        :disabled="!filterClusterId"
        :loading="loading"
        @click="fetchDaemonSets"
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
                    {{ getEnvText(cluster.env) }}
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

            <a-select
              v-model:value="filterStatus"
              allow-clear
              class="k8s-filter-select"
              placeholder="状态筛选"
              @change="handleFilterChange"
            >
              <template #suffixIcon>
                <FilterOutlined aria-hidden="true" />
              </template>
              <a-select-option :value="K8sDaemonSetStatus.Running">
                运行中
              </a-select-option>
              <a-select-option :value="K8sDaemonSetStatus.Error">
                异常
              </a-select-option>
              <a-select-option :value="K8sDaemonSetStatus.Updating">
                更新中
              </a-select-option>
            </a-select>

            <!-- 标签过滤器 -->
            <div class="k8s-labels-filter">
              <a-button
                class="k8s-toolbar-btn"
                type="dashed"
                @click="openLabelsFilter"
              >
                <template #icon><TagsOutlined aria-hidden="true" /></template>
                标签过滤
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
              placeholder="搜索 DaemonSet 名称"
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
                !filterStatus &&
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
              title="通过YAML创建DaemonSet"
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
              v-if="can('k8s.daemonset.batchDelete') && selectedRows.length > 0"
              class="k8s-toolbar-btn"
              title="批量删除选中的 DaemonSet"
            >
              <template #icon><DeleteOutlined aria-hidden="true" /></template>
              删除 ({{ selectedRows.length }})
            </a-button>

            <a-button
              v-if="selectedRows.length > 0"
              :disabled="!selectedRows.length"
              class="k8s-toolbar-btn"
              title="批量重启选中的 DaemonSet"
              @click="() => batchOperation('重启')"
            >
              <template #icon><RedoOutlined aria-hidden="true" /></template>
              重启 ({{ selectedRows.length }})
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
        <a-button size="small" @click="fetchDaemonSets"> 重试查询 </a-button>
      </template>
    </a-alert>

    <!-- 数据展示区域 -->
    <div class="k8s-data-display">
      <a-table
        :columns="columns"
        :data-source="filteredDaemonSets"
        :loading="loading"
        :pagination="{
          current: currentPage,
          pageSize: pageSize,
          total: total,
          showSizeChanger: true,
          showQuickJumper: true,
          showTotal: (total: number, range: number[]) =>
            `显示 ${range[0]}-${range[1]} 条，共 ${total} 条数据`,
          pageSizeOptions: ['10', '20', '30', '50'],
        }"
        :row-key="namespacedResourceKey"
        :row-selection="rowSelection"
        :scroll="{ x: 1340 }"
        class="k8s-table daemonset-table"
        @change="handleTableChange"
      >
        <template #bodyCell="{ column, text, record }">
          <template v-if="column.key === 'status'">
            <a-badge
              :status="getStatusColor(text)"
              :text="getStatusText(text)"
            />
          </template>
          <template v-else-if="column.key === 'pods'">
            <div class="k8s-replicas-display">
              <span class="k8s-replicas-text">
                {{ record.number_ready || 0 }}/{{
                  record.desired_number_scheduled || 0
                }}
              </span>
              <a-progress
                :percent="
                  record.desired_number_scheduled > 0
                    ? Math.round(
                        (record.number_ready /
                          record.desired_number_scheduled) *
                          100,
                      )
                    : 0
                "
                size="small"
                :show-info="false"
                :status="
                  record.number_ready === record.desired_number_scheduled
                    ? 'success'
                    : 'active'
                "
                style="margin-top: 4px; max-width: 100px"
              />
            </div>
          </template>
          <template v-else-if="column.key === 'availability'">
            <div class="daemonset-availability">
              <div class="availability-item">
                <a-tag color="green">
                  可用: {{ record.number_available || 0 }}
                </a-tag>
              </div>
              <div class="availability-item" style="margin-top: 4px">
                <a-tag
                  :color="
                    (record.number_unavailable || 0) > 0 ? 'red' : 'default'
                  "
                >
                  不可用: {{ record.number_unavailable || 0 }}
                </a-tag>
              </div>
            </div>
          </template>
          <template v-else-if="column.key === 'images'">
            <div class="k8s-images-display">
              <a-tooltip
                v-for="(image, index) in (Array.isArray(text)
                  ? text
                  : []
                ).slice(0, 2)"
                :key="index"
                :title="image"
              >
                <a-tag class="k8s-image-tag">
                  {{ image.split('/').pop()?.split(':')[0] || image }}
                </a-tag>
              </a-tooltip>
              <a-tooltip
                v-if="(Array.isArray(text) ? text : []).length > 2"
                :title="(Array.isArray(text) ? text : []).join('\n')"
              >
                <a-tag class="k8s-image-tag">
                  +{{ (Array.isArray(text) ? text : []).length - 2 }} 更多
                </a-tag>
              </a-tooltip>
              <span
                v-if="!text || !Array.isArray(text) || text.length === 0"
                class="k8s-no-data"
                >-</span
              >
            </div>
          </template>
          <template v-else-if="column.key === 'update_strategy'">
            <a-tag v-if="text" color="cyan">{{ text }}</a-tag>
            <span v-else class="k8s-no-data">-</span>
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
            <div
              v-if="record.created_at"
              style="font-size: 12px; color: var(--ops-muted)"
            >
              <div>{{ formatDateTime(record.created_at) }}</div>
              <div
                style="
                  color: var(--ops-muted);
                  font-size: 11px;
                  margin-top: 2px;
                "
              >
                {{ getRelativeTime(record.created_at) }}
              </div>
            </div>
            <span v-else class="k8s-no-data">-</span>
          </template>
          <template v-else-if="column.key === 'actions'">
            <div class="k8s-action-column">
              <a-tooltip title="查看详情">
                <a-button title="查看详情" @click="showDaemonSetDetail(record)">
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
              <a-tooltip title="重启">
                <a-button title="重启" @click="restartDaemonSet(record)">
                  <template #icon><RedoOutlined aria-hidden="true" /></template>
                </a-button>
              </a-tooltip>
              <a-tooltip title="查看 Pod">
                <a-button title="查看 Pod" @click="showPodModal(record)">
                  <template #icon>
                    <ContainerOutlined aria-hidden="true" />
                  </template>
                </a-button>
              </a-tooltip>
              <a-tooltip title="版本历史">
                <a-button title="版本历史" @click="showHistoryModal(record)">
                  <template #icon>
                    <HistoryOutlined aria-hidden="true" />
                  </template>
                </a-button>
              </a-tooltip>
              <a-tooltip v-if="can('k8s.daemonset.delete')" title="删除">
                <a-button danger title="删除" @click="deleteDaemonSet(record)">
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
            <HddOutlined aria-hidden="true" />
            <p>暂无 DaemonSet 数据</p>
            <p v-if="!filterClusterId">请先选择集群</p>
            <p v-else>请调整筛选条件或刷新数据</p>
          </div>
        </template>
      </a-table>
    </div>

    <!-- 创建 DaemonSet 模态框 -->
    <a-modal
      v-model:open="isCreateModalVisible"
      :confirmLoading="submitLoading"
      :maskClosable="false"
      cancelText="取消"
      destroyOnClose
      okText="创建"
      title="创建 DaemonSet"
      width="800px"
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
        <a-form-item :required="true" label="DaemonSet 名称" name="name">
          <a-input
            v-model:value="createFormModel.name"
            :maxlength="63"
            class="k8s-form-input"
            placeholder="请输入 DaemonSet 名称（例如：my-daemonset）"
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

        <a-form-item label="容器镜像">
          <div class="k8s-key-value-inputs">
            <div
              v-for="(_, index) in createFormModel.images"
              :key="index"
              class="k8s-key-value-row"
            >
              <a-input
                v-model:value="createFormModel.images[index]"
                class="k8s-form-input"
                placeholder="容器镜像（例如：nginx:latest）"
              />
              <a-button
                :disabled="createFormModel.images.length <= 1"
                class="k8s-remove-btn"
                danger
                size="small"
                type="text"
                @click="removeImageField(index)"
              >
                <template #icon><DeleteOutlined aria-hidden="true" /></template>
              </a-button>
            </div>
            <a-button
              style="margin-top: 8px"
              type="dashed"
              @click="addImageField"
            >
              <template #icon><PlusOutlined aria-hidden="true" /></template>
              添加镜像
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

    <!-- 通过 YAML 创建 DaemonSet 模态框 -->
    <a-modal
      v-model:open="isCreateYamlModalVisible"
      :confirmLoading="submitLoading"
      :maskClosable="false"
      cancelText="取消"
      destroyOnClose
      okText="创建"
      title="通过 YAML 创建 DaemonSet"
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
            placeholder="请输入 DaemonSet YAML 内容，或点击【插入模板】使用默认模板"
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
      title="DaemonSet 详情"
      width="1000px"
      @cancel="closeDetailModal"
    >
      <a-spin :spinning="detailLoading">
        <div v-if="currentDaemonSetDetail" class="k8s-detail-content">
          <a-row :gutter="[24, 16]">
            <a-col :lg="12" :xs="24">
              <a-card class="k8s-detail-card" size="small" title="基本信息">
                <div class="k8s-detail-item">
                  <span class="k8s-detail-label">DaemonSet 名称:</span>
                  <span class="k8s-detail-value">{{
                    currentDaemonSetDetail.name
                  }}</span>
                </div>
                <div class="k8s-detail-item">
                  <span class="k8s-detail-label">命名空间:</span>
                  <span class="k8s-detail-value">{{
                    currentDaemonSetDetail.namespace
                  }}</span>
                </div>
                <div class="k8s-detail-item">
                  <span class="k8s-detail-label">状态:</span>
                  <a-badge
                    :status="getStatusColor(currentDaemonSetDetail.status)"
                    :text="getStatusText(currentDaemonSetDetail.status)"
                  />
                </div>
                <div class="k8s-detail-item">
                  <span class="k8s-detail-label">集群ID:</span>
                  <span class="k8s-detail-value">{{
                    currentDaemonSetDetail.cluster_id
                  }}</span>
                </div>
                <div class="k8s-detail-item">
                  <span class="k8s-detail-label">UID:</span>
                  <span class="k8s-detail-value">{{
                    currentDaemonSetDetail.uid || '-'
                  }}</span>
                </div>
              </a-card>
            </a-col>

            <a-col :lg="12" :xs="24">
              <a-card class="k8s-detail-card" size="small" title="Pod 调度信息">
                <div class="k8s-detail-item">
                  <span class="k8s-detail-label">期望调度数:</span>
                  <span class="k8s-detail-value">{{
                    currentDaemonSetDetail.desired_number_scheduled
                  }}</span>
                </div>
                <div class="k8s-detail-item">
                  <span class="k8s-detail-label">当前调度数:</span>
                  <span class="k8s-detail-value">{{
                    currentDaemonSetDetail.current_number_scheduled
                  }}</span>
                </div>
                <div class="k8s-detail-item">
                  <span class="k8s-detail-label">就绪 Pod 数:</span>
                  <span class="k8s-detail-value">{{
                    currentDaemonSetDetail.number_ready
                  }}</span>
                </div>
                <div class="k8s-detail-item">
                  <span class="k8s-detail-label">可用 Pod 数:</span>
                  <span class="k8s-detail-value">{{
                    currentDaemonSetDetail.number_available
                  }}</span>
                </div>
                <div class="k8s-detail-item">
                  <span class="k8s-detail-label">不可用 Pod 数:</span>
                  <span class="k8s-detail-value">{{
                    currentDaemonSetDetail.number_unavailable
                  }}</span>
                </div>
              </a-card>
            </a-col>
          </a-row>

          <a-row :gutter="[24, 16]" style="margin-top: 16px">
            <a-col :lg="12" :xs="24">
              <a-card class="k8s-detail-card" size="small" title="更新策略">
                <div class="k8s-detail-item">
                  <span class="k8s-detail-label">策略类型:</span>
                  <span class="k8s-detail-value">{{
                    currentDaemonSetDetail.update_strategy || '-'
                  }}</span>
                </div>
                <div class="k8s-detail-item">
                  <span class="k8s-detail-label">历史版本限制:</span>
                  <span class="k8s-detail-value">{{
                    currentDaemonSetDetail.revision_history_limit || '-'
                  }}</span>
                </div>
                <div class="k8s-detail-item">
                  <span class="k8s-detail-label">更新策略:</span>
                  <span class="k8s-detail-value">{{
                    currentDaemonSetDetail.update_strategy || 'RollingUpdate'
                  }}</span>
                </div>
              </a-card>
            </a-col>

            <a-col :lg="12" :xs="24">
              <a-card class="k8s-detail-card" size="small" title="容器镜像">
                <div class="k8s-images-display">
                  <a-tooltip
                    v-for="(image, index) in currentDaemonSetDetail.images ||
                    []"
                    :key="index"
                    :title="image"
                  >
                    <a-tag
                      class="k8s-image-tag"
                      style="
                        margin-bottom: 8px;
                        max-width: 200px;
                        overflow: hidden;
                        text-overflow: ellipsis;
                        white-space: nowrap;
                        display: inline-block;
                      "
                    >
                      {{ image }}
                    </a-tag>
                  </a-tooltip>
                  <span
                    v-if="
                      !currentDaemonSetDetail.images ||
                      currentDaemonSetDetail.images.length === 0
                    "
                    class="k8s-no-data"
                  >
                    暂无镜像信息
                  </span>
                </div>
              </a-card>
            </a-col>
          </a-row>

          <a-row :gutter="[24, 16]" style="margin-top: 16px">
            <a-col :lg="12" :xs="24">
              <a-card class="k8s-detail-card" size="small" title="标签信息">
                <div class="k8s-labels-display">
                  <template v-if="Array.isArray(currentDaemonSetDetail.labels)">
                    <!-- 数组格式 -->
                    <a-tooltip
                      v-for="label in currentDaemonSetDetail.labels"
                      :key="label.key"
                      :title="`${label.key}: ${label.value}`"
                    >
                      <div
                        class="k8s-label-item"
                        style="
                          margin-bottom: 8px;
                          display: inline-block;
                          max-width: 100%;
                          text-overflow: ellipsis;
                          overflow: hidden;
                          white-space: nowrap;
                          margin-right: 8px;
                        "
                      >
                        {{ label.key }}: {{ label.value }}
                      </div>
                    </a-tooltip>
                    <span
                      v-if="currentDaemonSetDetail.labels.length === 0"
                      class="k8s-no-data"
                    >
                      暂无标签
                    </span>
                  </template>
                  <template
                    v-else-if="
                      currentDaemonSetDetail.labels &&
                      typeof currentDaemonSetDetail.labels === 'object'
                    "
                  >
                    <!-- 对象格式 -->
                    <a-tooltip
                      v-for="[key, value] in Object.entries(
                        currentDaemonSetDetail.labels,
                      )"
                      :key="key"
                      :title="`${key}: ${value}`"
                    >
                      <div
                        class="k8s-label-item"
                        style="
                          margin-bottom: 8px;
                          display: inline-block;
                          max-width: 100%;
                          text-overflow: ellipsis;
                          overflow: hidden;
                          white-space: nowrap;
                          margin-right: 8px;
                        "
                      >
                        {{ key }}: {{ value }}
                      </div>
                    </a-tooltip>
                    <span
                      v-if="
                        Object.keys(currentDaemonSetDetail.labels).length === 0
                      "
                      class="k8s-no-data"
                    >
                      暂无标签
                    </span>
                  </template>
                  <template v-else>
                    <span class="k8s-no-data"> 暂无标签 </span>
                  </template>
                </div>
              </a-card>
            </a-col>

            <a-col :lg="12" :xs="24">
              <a-card class="k8s-detail-card" size="small" title="注解信息">
                <div class="k8s-annotations-display">
                  <template
                    v-if="Array.isArray(currentDaemonSetDetail.annotations)"
                  >
                    <!-- 数组格式 -->
                    <a-tooltip
                      v-for="annotation in currentDaemonSetDetail.annotations"
                      :key="annotation.key"
                      :title="`${annotation.key}: ${annotation.value}`"
                    >
                      <div
                        class="k8s-annotation-item"
                        style="
                          margin-bottom: 8px;
                          display: inline-block;
                          max-width: 100%;
                          text-overflow: ellipsis;
                          overflow: hidden;
                          white-space: nowrap;
                          margin-right: 8px;
                        "
                      >
                        {{ annotation.key }}: {{ annotation.value }}
                      </div>
                    </a-tooltip>
                    <span
                      v-if="currentDaemonSetDetail.annotations.length === 0"
                      class="k8s-no-data"
                    >
                      暂无注解
                    </span>
                  </template>
                  <template
                    v-else-if="
                      currentDaemonSetDetail.annotations &&
                      typeof currentDaemonSetDetail.annotations === 'object'
                    "
                  >
                    <!-- 对象格式 -->
                    <a-tooltip
                      v-for="[key, value] in Object.entries(
                        currentDaemonSetDetail.annotations,
                      )"
                      :key="key"
                      :title="`${key}: ${value}`"
                    >
                      <div
                        class="k8s-annotation-item"
                        style="
                          margin-bottom: 8px;
                          display: inline-block;
                          max-width: 100%;
                          text-overflow: ellipsis;
                          overflow: hidden;
                          white-space: nowrap;
                          margin-right: 8px;
                        "
                      >
                        {{ key }}: {{ value }}
                      </div>
                    </a-tooltip>
                    <span
                      v-if="
                        Object.keys(currentDaemonSetDetail.annotations)
                          .length === 0
                      "
                      class="k8s-no-data"
                    >
                      暂无注解
                    </span>
                  </template>
                  <template v-else>
                    <span class="k8s-no-data"> 暂无注解 </span>
                  </template>
                </div>
              </a-card>
            </a-col>
          </a-row>
        </div>
      </a-spin>
    </a-modal>

    <!-- 编辑模态框 -->
    <a-modal
      v-model:open="isEditModalVisible"
      :confirmLoading="submitLoading"
      :maskClosable="false"
      cancelText="取消"
      destroyOnClose
      okText="确认更新"
      okType="primary"
      title="编辑 DaemonSet"
      width="800px"
      @cancel="closeEditModal"
      @ok="submitEditForm"
    >
      <a-form
        ref="editFormRef"
        :model="editFormModel"
        class="k8s-form"
        layout="vertical"
      >
        <a-row :gutter="16">
          <a-col :span="12">
            <a-form-item label="名称" name="name">
              <a-input
                v-model:value="editFormModel.name"
                class="k8s-form-input"
                disabled
              />
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item label="命名空间" name="namespace">
              <a-input
                v-model:value="editFormModel.namespace"
                class="k8s-form-input"
                disabled
              />
            </a-form-item>
          </a-col>
        </a-row>

        <a-form-item label="镜像" name="image">
          <a-input
            v-model:value="editFormModel.image"
            class="k8s-form-input"
            placeholder="请输入容器镜像"
          />
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
                :maxlength="200"
                :value="key"
                class="k8s-form-input"
                disabled
                placeholder="标签键"
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
                @click="() => removeEditLabelField(key)"
              >
                <template #icon><DeleteOutlined aria-hidden="true" /></template>
              </a-button>
            </div>
            <div class="add-input-row" style="margin-top: 8px">
              <a-input
                v-model:value="newEditLabelKey"
                placeholder="输入标签键"
                style="flex: 1; margin-right: 8px"
                @press-enter="addNewEditLabel"
              />
              <a-button
                type="primary"
                @click="addNewEditLabel"
                :disabled="!newEditLabelKey.trim()"
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
                :maxlength="500"
                :value="key"
                class="k8s-form-input"
                disabled
                placeholder="注解键"
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
                @click="() => removeEditAnnotationField(key)"
              >
                <template #icon><DeleteOutlined aria-hidden="true" /></template>
              </a-button>
            </div>
            <div class="add-input-row" style="margin-top: 8px">
              <a-input
                v-model:value="newEditAnnotationKey"
                placeholder="输入注解键"
                style="flex: 1; margin-right: 8px"
                @press-enter="addNewEditAnnotation"
              />
              <a-button
                type="primary"
                @click="addNewEditAnnotation"
                :disabled="!newEditAnnotationKey.trim()"
              >
                <template #icon><PlusOutlined aria-hidden="true" /></template>
                添加
              </a-button>
            </div>
          </div>
        </a-form-item>
      </a-form>
    </a-modal>

    <!-- YAML 模态框 -->
    <a-modal
      v-model:open="isYamlModalVisible"
      :confirmLoading="submitLoading"
      :maskClosable="false"
      :title="`查看/编辑 ${currentOperationDaemonSet?.name} YAML`"
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

    <!-- Pod 列表模态框 -->
    <a-modal
      v-model:open="isPodModalVisible"
      :footer="null"
      :maskClosable="false"
      :title="`${currentOperationDaemonSet?.name} Pod 列表`"
      destroyOnClose
      width="1000px"
      @cancel="closePodModal"
    >
      <a-table
        :data-source="daemonSetPods"
        :loading="submitLoading"
        :pagination="false"
        class="k8s-table"
        size="small"
      >
        <a-table-column key="name" dataIndex="name" title="Pod 名称" />
        <a-table-column key="status" dataIndex="status" title="状态">
          <template #default="{ text }">
            <a-badge
              :status="text === 'Running' ? 'success' : 'error'"
              :text="text"
            />
          </template>
        </a-table-column>
        <a-table-column
          key="restart_count"
          dataIndex="restart_count"
          title="重启次数"
        />
        <a-table-column key="created_at" title="创建时间">
          <template #default="{ record }">
            <span class="k8s-time-display">{{
              formatK8sTime(record.created_at)
            }}</span>
          </template>
        </a-table-column>
        <a-table-column
          key="node_name"
          dataIndex="node_name"
          title="节点名称"
        />
      </a-table>
    </a-modal>

    <!-- 版本历史模态框 -->
    <a-modal
      v-model:open="isHistoryModalVisible"
      :footer="null"
      :maskClosable="false"
      :title="`${currentOperationDaemonSet?.name} 版本历史`"
      destroyOnClose
      width="800px"
      @cancel="closeHistoryModal"
    >
      <a-table
        :data-source="daemonSetHistory"
        :loading="submitLoading"
        :pagination="false"
        class="k8s-table"
        size="small"
      >
        <a-table-column key="revision" dataIndex="revision" title="版本" />
        <a-table-column key="date" dataIndex="date" title="日期" />
        <a-table-column key="message" dataIndex="message" title="变更说明" />
        <a-table-column key="actions" title="操作" width="100">
          <template #default="{ record }">
            <a-button
              :disabled="record.revision === 1"
              size="small"
              type="link"
              @click="rollbackToVersion(record.revision)"
            >
              回滚到此版本
            </a-button>
          </template>
        </a-table-column>
      </a-table>
    </a-modal>

    <!-- 标签过滤模态框 -->
    <a-modal
      v-model:open="isLabelsFilterModalVisible"
      :maskClosable="false"
      cancelText="取消"
      destroyOnClose
      okText="应用过滤"
      title="标签过滤设置"
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
import { message, Modal } from 'ant-design-vue';
import { useDaemonSetPage } from './DaemonSet';
import { rollbackDaemonSetApi } from '#/api/core/k8s/k8s_daemonset';
import {
  formatDateTime,
  formatK8sTime,
  getRelativeTime,
} from '../shared/utils';
import {
  AppstoreOutlined,
  CheckCircleOutlined,
  ClearOutlined,
  ContainerOutlined,
  DeleteOutlined,
  DeploymentUnitOutlined,
  EditOutlined,
  EyeOutlined,
  FileAddOutlined,
  FileTextOutlined,
  FilterOutlined,
  FormatPainterOutlined,
  HddOutlined,
  HistoryOutlined,
  PlusOutlined,
  RedoOutlined,
  ReloadOutlined,
  SearchOutlined,
  TagsOutlined,
} from '@ant-design/icons-vue';

import { usePermission } from '#/utils/permission';
import { shouldNotifyPageError } from '#/utils/permission/request-notice';

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
  filterStatus,
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
  isPodModalVisible,
  isHistoryModalVisible,
  submitLoading,
  detailLoading,

  // operation targets
  currentOperationDaemonSet,
  currentDaemonSetDetail,
  daemonSetPods,
  daemonSetHistory,

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
  yamlFormRules,
  createYamlFormRules,

  // computed
  filteredDaemonSets,
  rowSelection,

  // helpers
  getEnvText,
  getStatusText,
  getStatusColor,

  // operations
  fetchClusters,
  fetchNamespaces,
  fetchDaemonSets,
  clearDaemonSets,
  clearNamespaces,
  loadMoreClusters,
  loadMoreNamespaces,

  // detail operations
  showDaemonSetDetail,
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

  // daemonSet operations
  deleteDaemonSet,
  restartDaemonSet,

  // edit operations
  openEditModal,
  closeEditModal,
  submitEditForm,

  // pod operations
  showPodModal,
  closePodModal,

  // history operations
  showHistoryModal,
  closeHistoryModal,

  // filter operations
  addFilterLabel,
  removeFilterLabel,
  clearFilterLabels,

  // batch operations
  batchOperation,

  // pagination operations
  handlePageChange,

  // form field operations
  addImageField,
  removeImageField,
  removeLabelField,
  removeAnnotationField,
  removeEditLabelField,
  removeEditAnnotationField,

  // yaml operations
  insertYamlTemplate,
  formatYaml,
  validateYaml,
  clearYaml,
  formatEditYaml,
  validateEditYaml,

  // constants
  K8sDaemonSetStatus,
} = useDaemonSetPage();

// 添加新标签/注解的方法
const newLabelKey = ref('');
const newAnnotationKey = ref('');
const newEditLabelKey = ref('');
const newEditAnnotationKey = ref('');

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

// 编辑模态框专用的方法
const addNewEditLabel = () => {
  if (newEditLabelKey.value && newEditLabelKey.value.trim()) {
    editFormModel.value.labels[newEditLabelKey.value.trim()] = '';
    newEditLabelKey.value = '';
  }
};

const addNewEditAnnotation = () => {
  if (newEditAnnotationKey.value && newEditAnnotationKey.value.trim()) {
    editFormModel.value.annotations[newEditAnnotationKey.value.trim()] = '';
    newEditAnnotationKey.value = '';
  }
};

const onSearch = () => {
  currentPage.value = 1;
  fetchDaemonSets();
};

const handleFilterChange = () => {
  currentPage.value = 1;
  fetchDaemonSets();
};

const handleClusterChange = () => {
  currentPage.value = 1;
  clearNamespaces();
  clearDaemonSets();

  if (filterClusterId.value) {
    fetchNamespaces(true); // 重置命名空间分页
    fetchDaemonSets();
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
  {
    title: '状态',
    dataIndex: 'status',
    key: 'status',
    width: 90,
    align: 'center',
  },
  { title: 'Pod状态', key: 'pods', width: 110, align: 'center' },
  { title: '可用/不可用', key: 'availability', width: 120, align: 'center' },
  {
    title: '更新策略',
    dataIndex: 'update_strategy',
    key: 'update_strategy',
    width: 110,
    align: 'center',
  },
  { title: '镜像', dataIndex: 'images', key: 'images', width: 200 },
  { title: '标签', dataIndex: 'labels', key: 'labels', width: 150 },
  { title: '注解', dataIndex: 'annotations', key: 'annotations', width: 120 },
  { title: 'UID', dataIndex: 'uid', key: 'uid', width: 100, ellipsis: true },
  { title: '创建时间', key: 'created_at', width: 160 },
  {
    title: '操作',
    key: 'actions',
    width: 350,
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
  filterStatus.value = undefined;
  searchText.value = '';
  filterClusterId.value = undefined;
  filterNamespace.value = undefined;
  clearFilterLabels();
  currentPage.value = 1;
  clearDaemonSets();
  clearNamespaces();
};

// 快速回滚到指定版本
const rollbackToVersion = (revision: number) => {
  if (!currentOperationDaemonSet.value) return;

  Modal.confirm({
    title: '回滚确认',
    content: `确定要将 DaemonSet "${currentOperationDaemonSet.value.name}" 回滚到版本 ${revision} 吗？`,
    okText: '确认回滚',
    okType: 'primary',
    cancelText: '取消',
    centered: true,
    onOk: async () => {
      try {
        const clusterId =
          currentOperationDaemonSet.value!.cluster_id || filterClusterId.value;
        if (!clusterId || clusterId === 0) {
          message.error('无效的集群ID，请重新选择集群');
          return;
        }

        await rollbackDaemonSetApi(
          clusterId,
          currentOperationDaemonSet.value!.namespace,
          currentOperationDaemonSet.value!.name,
          {
            cluster_id: clusterId,
            namespace: currentOperationDaemonSet.value!.namespace,
            name: currentOperationDaemonSet.value!.name,
            revision,
          },
        );
        message.success(`DaemonSet 回滚到版本 ${revision} 成功`);
        closeHistoryModal();
        await fetchDaemonSets();
      } catch (error) {
        if (shouldNotifyPageError(error))
          message.error(`DaemonSet 回滚到版本 ${revision} 失败`);
      }
    },
  });
};

onMounted(async () => {
  await fetchClusters();
});
</script>

<style scoped>
@import '../shared/k8s-common.css';
</style>

<style scoped src="./DaemonSet.css"></style>
