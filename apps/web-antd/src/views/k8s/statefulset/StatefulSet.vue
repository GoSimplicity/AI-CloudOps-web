<template>
  <OpsPage
    description="管理和监控集群中的所有 Kubernetes StatefulSet"
    title="StatefulSet 管理"
  >
    <template #actions>
      <a-button
        :disabled="!filterClusterId"
        type="primary"
        @click="openCreateModal"
      >
        <template #icon><PlusOutlined aria-hidden="true" /></template>
        创建 StatefulSet
      </a-button>
      <a-button
        :disabled="!filterClusterId"
        :loading="loading"
        @click="fetchStatefulSets"
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
              <a-select-option :value="K8sStatefulSetStatus.Running">
                运行中
              </a-select-option>
              <a-select-option :value="K8sStatefulSetStatus.Stopped">
                已停止
              </a-select-option>
              <a-select-option :value="K8sStatefulSetStatus.Updating">
                更新中
              </a-select-option>
              <a-select-option :value="K8sStatefulSetStatus.Error">
                异常
              </a-select-option>
            </a-select>

            <a-input
              v-model:value="filterServiceName"
              allow-clear
              class="k8s-filter-select"
              placeholder="服务名称"
              style="width: 160px"
              @change="handleFilterChange"
            >
              <template #prefix><ApiOutlined aria-hidden="true" /></template>
            </a-input>

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
              placeholder="搜索 StatefulSet 名称"
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
                !filterServiceName &&
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
              title="通过YAML创建StatefulSet"
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
                can('k8s.statefulset.batchDelete') && selectedRows.length > 0
              "
              class="k8s-toolbar-btn"
              title="批量删除选中的 StatefulSet"
            >
              <template #icon><DeleteOutlined aria-hidden="true" /></template>
              删除 ({{ selectedRows.length }})
            </a-button>

            <a-button
              v-if="selectedRows.length > 0"
              :disabled="!selectedRows.length"
              class="k8s-toolbar-btn"
              title="批量重启选中的 StatefulSet"
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
        <a-button size="small" @click="fetchStatefulSets"> 重试查询 </a-button>
      </template>
    </a-alert>

    <!-- 数据展示区域 -->
    <div class="k8s-data-display">
      <a-table
        :columns="columns"
        :data-source="filteredStatefulSets"
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
        :scroll="{ x: 1440 }"
        class="k8s-table statefulset-table"
        @change="handleTableChange"
      >
        <template #bodyCell="{ column, text, record }">
          <template v-if="column.key === 'status'">
            <a-badge
              :status="getStatusColor(text)"
              :text="getStatusText(text)"
            />
          </template>
          <template v-else-if="column.key === 'replicas'">
            <div class="k8s-replicas-display">
              <a-tooltip>
                <template #title>
                  <div>期望: {{ record.replicas }}</div>
                  <div>就绪: {{ record.ready_replicas }}</div>
                  <div>当前: {{ record.current_replicas }}</div>
                  <div>已更新: {{ record.updated_replicas }}</div>
                </template>
                <span class="k8s-replicas-text">
                  {{ record.ready_replicas }}/{{ record.replicas }}
                </span>
              </a-tooltip>
              <a-progress
                :percent="
                  record.replicas > 0
                    ? Math.round(
                        (record.ready_replicas / record.replicas) * 100,
                      )
                    : 0
                "
                size="small"
                :show-info="false"
                :status="
                  record.ready_replicas === record.replicas
                    ? 'success'
                    : 'active'
                "
                style="margin-top: 4px; max-width: 100px"
              />
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
          <template v-else-if="column.key === 'service_name'">
            <a-tag v-if="text" color="purple">{{ text }}</a-tag>
            <span v-else class="k8s-no-data">-</span>
          </template>
          <template v-else-if="column.key === 'update_strategy'">
            <a-tag v-if="text" color="cyan">{{ text }}</a-tag>
            <span v-else class="k8s-no-data">-</span>
          </template>
          <template v-else-if="column.key === 'pod_management_policy'">
            <a-tag v-if="text" color="geekblue">{{ text }}</a-tag>
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
                <!-- 数组格式 -->
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
                <!-- 对象格式 -->
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
                  @click="showStatefulSetDetail(record)"
                >
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
              <a-tooltip title="伸缩">
                <a-button title="伸缩" @click="openScaleModal(record)">
                  <template #icon>
                    <ExpandOutlined aria-hidden="true" />
                  </template>
                </a-button>
              </a-tooltip>
              <a-tooltip title="重启">
                <a-button title="重启" @click="restartStatefulSet(record)">
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
              <a-tooltip v-if="can('k8s.statefulset.delete')" title="删除">
                <a-button
                  danger
                  title="删除"
                  @click="deleteStatefulSet(record)"
                >
                  <template #icon>
                    <DeleteOutlined aria-hidden="true" />
                  </template>
                </a-button>
              </a-tooltip>
            </div>
          </template>
        </template>

        <template #created_at="{ text }">
          <span v-if="text">{{ formatTime(text) }}</span>
          <span v-else class="k8s-no-data">-</span>
        </template>

        <template #emptyText>
          <div class="k8s-empty-state">
            <DatabaseOutlined aria-hidden="true" />
            <p>暂无 StatefulSet 数据</p>
            <p v-if="!filterClusterId">请先选择集群</p>
            <p v-else>请调整筛选条件或刷新数据</p>
          </div>
        </template>
      </a-table>
    </div>

    <!-- 创建 StatefulSet 模态框 -->
    <a-modal
      v-model:open="isCreateModalVisible"
      :confirmLoading="submitLoading"
      :maskClosable="false"
      cancelText="取消"
      destroyOnClose
      okText="创建"
      title="创建 StatefulSet"
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
        <a-form-item :required="true" label="StatefulSet 名称" name="name">
          <a-input
            v-model:value="createFormModel.name"
            :maxlength="63"
            class="k8s-form-input"
            placeholder="请输入 StatefulSet 名称（例如：my-statefulset）"
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

        <a-form-item :required="true" label="副本数量" name="replicas">
          <a-input-number
            v-model:value="createFormModel.replicas"
            :max="100"
            :min="0"
            class="k8s-form-input"
            placeholder="副本数量"
          />
        </a-form-item>

        <a-form-item :required="true" label="服务名称" name="service_name">
          <a-input
            v-model:value="createFormModel.service_name"
            :maxlength="63"
            class="k8s-form-input"
            placeholder="请输入关联的服务名称（例如：my-service）"
          />
          <div
            style="color: var(--ops-muted); font-size: 12px; margin-top: 4px"
          >
            StatefulSet 需要一个 Headless Service 来管理 Pod 的网络身份
          </div>
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

    <!-- 通过 YAML 创建 StatefulSet 模态框 -->
    <a-modal
      v-model:open="isCreateYamlModalVisible"
      :confirmLoading="submitLoading"
      :maskClosable="false"
      cancelText="取消"
      destroyOnClose
      okText="创建"
      title="通过 YAML 创建 StatefulSet"
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
            placeholder="请输入 StatefulSet YAML 内容，或点击【插入模板】使用默认模板"
          />
        </a-form-item>
      </a-form>
    </a-modal>

    <!-- 编辑 StatefulSet 模态框 -->
    <a-modal
      v-model:open="isEditModalVisible"
      :confirmLoading="submitLoading"
      :maskClosable="false"
      cancelText="取消"
      destroyOnClose
      okText="保存"
      title="编辑 StatefulSet"
      width="800px"
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
        <a-form-item :required="true" label="StatefulSet 名称" name="name">
          <a-input
            v-model:value="editFormModel.name"
            :maxlength="63"
            class="k8s-form-input"
            disabled
            placeholder="请输入 StatefulSet 名称"
          />
        </a-form-item>

        <a-form-item :required="true" label="命名空间" name="namespace">
          <a-input
            v-model:value="editFormModel.namespace"
            class="k8s-form-input"
            disabled
            placeholder="命名空间"
          />
        </a-form-item>

        <a-form-item :required="true" label="副本数量" name="replicas">
          <a-input-number
            v-model:value="editFormModel.replicas"
            :max="100"
            :min="0"
            class="k8s-form-input"
            placeholder="副本数量"
          />
        </a-form-item>

        <a-form-item label="容器镜像">
          <div class="k8s-key-value-inputs">
            <div
              v-for="(_, index) in editFormModel.images"
              :key="index"
              class="k8s-key-value-row"
            >
              <a-input
                v-model:value="editFormModel.images[index]"
                class="k8s-form-input"
                placeholder="容器镜像（例如：nginx:latest）"
              />
              <a-button
                :disabled="editFormModel.images.length <= 1"
                class="k8s-remove-btn"
                danger
                size="small"
                type="text"
                @click="removeEditImageField(index)"
              >
                <template #icon><DeleteOutlined aria-hidden="true" /></template>
              </a-button>
            </div>
            <a-button
              style="margin-top: 8px"
              type="dashed"
              @click="addEditImageField"
            >
              <template #icon><PlusOutlined aria-hidden="true" /></template>
              添加镜像
            </a-button>
          </div>
        </a-form-item>

        <a-form-item label="标签配置（可选）" name="labels">
          <div class="k8s-key-value-inputs">
            <div
              v-if="!editFormModel.labels || editFormModel.labels.length === 0"
              style="text-align: center; color: var(--ops-muted); padding: 16px"
            >
              暂无标签，点击下方按钮添加
            </div>
            <div
              v-for="(label, index) in editFormModel.labels"
              :key="index"
              class="k8s-key-value-row"
            >
              <a-input
                v-model:value="label.key"
                :maxlength="200"
                class="k8s-form-input"
                placeholder="标签键"
              />
              <a-input
                v-model:value="label.value"
                :maxlength="200"
                class="k8s-form-input"
                placeholder="标签值"
              />
              <a-button
                class="k8s-remove-btn"
                danger
                size="small"
                type="text"
                @click="() => removeEditLabelField(label.key)"
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
                editFormModel.annotations.length === 0
              "
              style="text-align: center; color: var(--ops-muted); padding: 16px"
            >
              暂无注解，点击下方按钮添加
            </div>
            <div
              v-for="(annotation, index) in editFormModel.annotations"
              :key="index"
              class="k8s-key-value-row"
            >
              <a-input
                v-model:value="annotation.key"
                :maxlength="500"
                class="k8s-form-input"
                placeholder="注解键"
              />
              <a-input
                v-model:value="annotation.value"
                :maxlength="500"
                class="k8s-form-input"
                placeholder="注解值"
              />
              <a-button
                class="k8s-remove-btn"
                danger
                size="small"
                type="text"
                @click="() => removeEditAnnotationField(annotation.key)"
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

    <!-- 详情模态框 -->
    <a-modal
      v-model:open="isDetailModalVisible"
      :footer="null"
      :maskClosable="false"
      destroyOnClose
      title="StatefulSet 详情"
      width="1000px"
      @cancel="closeDetailModal"
    >
      <a-spin :spinning="detailLoading">
        <div v-if="currentStatefulSetDetail" class="k8s-detail-content">
          <a-row :gutter="[24, 16]">
            <a-col :lg="12" :xs="24">
              <a-card class="k8s-detail-card" size="small" title="基本信息">
                <div class="k8s-detail-item">
                  <span class="k8s-detail-label">StatefulSet 名称:</span>
                  <span class="k8s-detail-value">{{
                    currentStatefulSetDetail.name
                  }}</span>
                </div>
                <div class="k8s-detail-item">
                  <span class="k8s-detail-label">命名空间:</span>
                  <span class="k8s-detail-value">{{
                    currentStatefulSetDetail.namespace
                  }}</span>
                </div>
                <div class="k8s-detail-item">
                  <span class="k8s-detail-label">状态:</span>
                  <a-badge
                    :status="getStatusColor(currentStatefulSetDetail.status)"
                    :text="getStatusText(currentStatefulSetDetail.status)"
                  />
                </div>
                <div class="k8s-detail-item">
                  <span class="k8s-detail-label">集群ID:</span>
                  <span class="k8s-detail-value">{{
                    currentStatefulSetDetail.cluster_id
                  }}</span>
                </div>
                <div class="k8s-detail-item">
                  <span class="k8s-detail-label">UID:</span>
                  <span class="k8s-detail-value">{{
                    currentStatefulSetDetail.uid || '-'
                  }}</span>
                </div>
                <div class="k8s-detail-item">
                  <span class="k8s-detail-label">创建时间:</span>
                  <span class="k8s-detail-value">{{
                    formatTime(currentStatefulSetDetail.created_at) || '-'
                  }}</span>
                </div>
                <div class="k8s-detail-item">
                  <span class="k8s-detail-label">更新时间:</span>
                  <span class="k8s-detail-value">{{
                    formatTime(currentStatefulSetDetail.updated_at) || '-'
                  }}</span>
                </div>
              </a-card>
            </a-col>

            <a-col :lg="12" :xs="24">
              <a-card class="k8s-detail-card" size="small" title="副本信息">
                <div class="k8s-detail-item">
                  <span class="k8s-detail-label">期望副本数:</span>
                  <span class="k8s-detail-value">
                    <a-badge
                      :count="currentStatefulSetDetail.replicas"
                      :number-style="{ backgroundColor: '#52c41a' }"
                    />
                  </span>
                </div>
                <div class="k8s-detail-item">
                  <span class="k8s-detail-label">就绪副本数:</span>
                  <span class="k8s-detail-value">
                    <a-badge
                      :count="currentStatefulSetDetail.ready_replicas"
                      :number-style="{
                        backgroundColor:
                          currentStatefulSetDetail.ready_replicas ===
                          currentStatefulSetDetail.replicas
                            ? '#52c41a'
                            : '#faad14',
                      }"
                    />
                  </span>
                </div>
                <div class="k8s-detail-item">
                  <span class="k8s-detail-label">当前副本数:</span>
                  <span class="k8s-detail-value">
                    <a-badge
                      :count="currentStatefulSetDetail.current_replicas"
                      :number-style="{ backgroundColor: '#1890ff' }"
                    />
                  </span>
                </div>
                <div class="k8s-detail-item">
                  <span class="k8s-detail-label">已更新副本数:</span>
                  <span class="k8s-detail-value">
                    <a-badge
                      :count="currentStatefulSetDetail.updated_replicas"
                      :number-style="{ backgroundColor: '#722ed1' }"
                    />
                  </span>
                </div>
                <div class="k8s-detail-item" style="margin-top: 12px">
                  <a-progress
                    :percent="
                      currentStatefulSetDetail.replicas > 0
                        ? Math.round(
                            (currentStatefulSetDetail.ready_replicas /
                              currentStatefulSetDetail.replicas) *
                              100,
                          )
                        : 0
                    "
                    :status="
                      currentStatefulSetDetail.ready_replicas ===
                      currentStatefulSetDetail.replicas
                        ? 'success'
                        : 'active'
                    "
                  />
                </div>
              </a-card>
            </a-col>
          </a-row>

          <a-row :gutter="[24, 16]" style="margin-top: 16px">
            <a-col :lg="12" :xs="24">
              <a-card class="k8s-detail-card" size="small" title="服务配置">
                <div class="k8s-detail-item">
                  <span class="k8s-detail-label">服务名称:</span>
                  <span class="k8s-detail-value">
                    <a-tag
                      v-if="currentStatefulSetDetail.service_name"
                      color="purple"
                      >{{ currentStatefulSetDetail.service_name }}</a-tag
                    >
                    <span v-else class="k8s-no-data">-</span>
                  </span>
                </div>
                <div class="k8s-detail-item">
                  <span class="k8s-detail-label">Pod 管理策略:</span>
                  <span class="k8s-detail-value">
                    <a-tag
                      v-if="currentStatefulSetDetail.pod_management_policy"
                      color="geekblue"
                      >{{
                        currentStatefulSetDetail.pod_management_policy
                      }}</a-tag
                    >
                    <span v-else class="k8s-no-data">-</span>
                  </span>
                </div>
                <div class="k8s-detail-item">
                  <span class="k8s-detail-label">更新策略:</span>
                  <span class="k8s-detail-value">
                    <a-tag
                      v-if="currentStatefulSetDetail.update_strategy"
                      color="cyan"
                      >{{ currentStatefulSetDetail.update_strategy }}</a-tag
                    >
                    <span v-else class="k8s-no-data">-</span>
                  </span>
                </div>
                <div class="k8s-detail-item">
                  <span class="k8s-detail-label">历史版本限制:</span>
                  <span class="k8s-detail-value">{{
                    currentStatefulSetDetail.revision_history_limit || '-'
                  }}</span>
                </div>
              </a-card>
            </a-col>

            <a-col :lg="12" :xs="24">
              <a-card class="k8s-detail-card" size="small" title="容器镜像">
                <div class="k8s-images-display">
                  <a-tooltip
                    v-for="(image, index) in currentStatefulSetDetail.images ||
                    []"
                    :key="index"
                    :title="image"
                  >
                    <a-tag
                      class="k8s-image-tag"
                      color="blue"
                      style="
                        margin-bottom: 8px;
                        max-width: 100%;
                        display: block;
                        overflow: hidden;
                        text-overflow: ellipsis;
                        white-space: nowrap;
                      "
                    >
                      {{ image }}
                    </a-tag>
                  </a-tooltip>
                  <span
                    v-if="
                      !currentStatefulSetDetail.images ||
                      currentStatefulSetDetail.images.length === 0
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
            <a-col :xs="24">
              <a-card
                class="k8s-detail-card"
                size="small"
                title="选择器 (Selector)"
              >
                <div class="k8s-selector-display">
                  <template
                    v-if="
                      currentStatefulSetDetail.selector &&
                      typeof currentStatefulSetDetail.selector === 'object' &&
                      Object.keys(currentStatefulSetDetail.selector).length > 0
                    "
                  >
                    <a-tag
                      v-for="[key, value] in Object.entries(
                        currentStatefulSetDetail.selector,
                      )"
                      :key="key"
                      color="processing"
                      style="margin-bottom: 8px; margin-right: 8px"
                    >
                      {{ key }}: {{ value }}
                    </a-tag>
                  </template>
                  <template v-else>
                    <span class="k8s-no-data">暂无选择器</span>
                  </template>
                </div>
              </a-card>
            </a-col>
          </a-row>

          <a-row :gutter="[24, 16]" style="margin-top: 16px">
            <a-col :lg="12" :xs="24">
              <a-card class="k8s-detail-card" size="small" title="标签信息">
                <div class="k8s-labels-display">
                  <template
                    v-if="Array.isArray(currentStatefulSetDetail.labels)"
                  >
                    <!-- 数组格式 -->
                    <a-tooltip
                      v-for="label in currentStatefulSetDetail.labels"
                      :key="label.key"
                      :title="`${label.key}: ${label.value}`"
                    >
                      <a-tag
                        color="blue"
                        style="
                          margin-bottom: 8px;
                          margin-right: 8px;
                          max-width: 100%;
                          overflow: hidden;
                          text-overflow: ellipsis;
                          display: inline-block;
                        "
                      >
                        {{ label.key }}: {{ label.value }}
                      </a-tag>
                    </a-tooltip>
                    <span
                      v-if="currentStatefulSetDetail.labels.length === 0"
                      class="k8s-no-data"
                    >
                      暂无标签
                    </span>
                  </template>
                  <template
                    v-else-if="
                      currentStatefulSetDetail.labels &&
                      typeof currentStatefulSetDetail.labels === 'object'
                    "
                  >
                    <!-- 对象格式 -->
                    <a-tooltip
                      v-for="[key, value] in Object.entries(
                        currentStatefulSetDetail.labels,
                      )"
                      :key="key"
                      :title="`${key}: ${value}`"
                    >
                      <a-tag
                        color="blue"
                        style="
                          margin-bottom: 8px;
                          margin-right: 8px;
                          max-width: 100%;
                          overflow: hidden;
                          text-overflow: ellipsis;
                          display: inline-block;
                        "
                      >
                        {{ key }}: {{ value }}
                      </a-tag>
                    </a-tooltip>
                    <span
                      v-if="
                        Object.keys(currentStatefulSetDetail.labels).length ===
                        0
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
                    v-if="Array.isArray(currentStatefulSetDetail.annotations)"
                  >
                    <!-- 数组格式 -->
                    <a-tooltip
                      v-for="annotation in currentStatefulSetDetail.annotations"
                      :key="annotation.key"
                      :title="`${annotation.key}: ${annotation.value}`"
                    >
                      <a-tag
                        color="orange"
                        style="
                          margin-bottom: 8px;
                          margin-right: 8px;
                          max-width: 100%;
                          overflow: hidden;
                          text-overflow: ellipsis;
                          display: inline-block;
                        "
                      >
                        {{ annotation.key }}: {{ annotation.value }}
                      </a-tag>
                    </a-tooltip>
                    <span
                      v-if="currentStatefulSetDetail.annotations.length === 0"
                      class="k8s-no-data"
                    >
                      暂无注解
                    </span>
                  </template>
                  <template
                    v-else-if="
                      currentStatefulSetDetail.annotations &&
                      typeof currentStatefulSetDetail.annotations === 'object'
                    "
                  >
                    <!-- 对象格式 -->
                    <a-tooltip
                      v-for="[key, value] in Object.entries(
                        currentStatefulSetDetail.annotations,
                      )"
                      :key="key"
                      :title="`${key}: ${value}`"
                    >
                      <a-tag
                        color="orange"
                        style="
                          margin-bottom: 8px;
                          margin-right: 8px;
                          max-width: 100%;
                          overflow: hidden;
                          text-overflow: ellipsis;
                          display: inline-block;
                        "
                      >
                        {{ key }}: {{ value }}
                      </a-tag>
                    </a-tooltip>
                    <span
                      v-if="
                        Object.keys(currentStatefulSetDetail.annotations)
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

    <!-- 伸缩模态框 -->
    <a-modal
      v-model:open="isScaleModalVisible"
      :confirmLoading="submitLoading"
      :maskClosable="false"
      cancelText="取消"
      destroyOnClose
      okText="确认伸缩"
      title="伸缩 StatefulSet"
      width="500px"
      @cancel="closeScaleModal"
      @ok="submitScaleForm"
    >
      <a-form
        ref="scaleFormRef"
        :model="scaleFormModel"
        :rules="scaleFormRules"
        class="k8s-form"
        layout="vertical"
      >
        <a-alert
          :description="`即将对 StatefulSet '${currentOperationStatefulSet?.name}' 进行伸缩操作`"
          message="伸缩操作"
          show-icon
          style="margin-bottom: 24px"
          type="info"
        />

        <a-form-item :required="true" label="副本数量" name="replicas">
          <a-input-number
            v-model:value="scaleFormModel.replicas"
            :max="100"
            :min="0"
            class="k8s-form-input"
            placeholder="请输入副本数量"
          />
          <div
            style="color: var(--ops-muted); font-size: 12px; margin-top: 4px"
          >
            当前副本数：{{ currentOperationStatefulSet?.replicas }}
          </div>
        </a-form-item>
      </a-form>
    </a-modal>

    <!-- YAML 模态框 -->
    <a-modal
      v-model:open="isYamlModalVisible"
      :confirmLoading="submitLoading"
      :maskClosable="false"
      :title="`查看/编辑 ${currentOperationStatefulSet?.name} YAML`"
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
      :title="`${currentOperationStatefulSet?.name} Pod 列表`"
      destroyOnClose
      width="1000px"
      @cancel="closePodModal"
    >
      <a-table
        :data-source="statefulSetPods"
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
        <a-table-column
          key="created_at"
          dataIndex="created_at"
          title="创建时间"
        />
      </a-table>
    </a-modal>

    <!-- 版本历史模态框 -->
    <a-modal
      v-model:open="isHistoryModalVisible"
      :footer="null"
      :maskClosable="false"
      :title="`${currentOperationStatefulSet?.name} 版本历史`"
      destroyOnClose
      width="800px"
      @cancel="closeHistoryModal"
    >
      <a-table
        :data-source="statefulSetHistory"
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
import { useStatefulSetPage } from './StatefulSet';
import { rollbackStatefulSetApi } from '#/api/core/k8s/k8s_statefulset';
import { formatDateTime, getRelativeTime } from '../shared/utils';
import {
  ApiOutlined,
  AppstoreOutlined,
  CheckCircleOutlined,
  ClearOutlined,
  ContainerOutlined,
  DatabaseOutlined,
  DeleteOutlined,
  DeploymentUnitOutlined,
  EditOutlined,
  ExpandOutlined,
  EyeOutlined,
  FileAddOutlined,
  FileTextOutlined,
  FilterOutlined,
  FormatPainterOutlined,
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
  filterServiceName,
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
  isScaleModalVisible,
  isYamlModalVisible,
  isPodModalVisible,
  isHistoryModalVisible,
  submitLoading,
  detailLoading,

  // operation targets
  currentOperationStatefulSet,
  currentStatefulSetDetail,
  statefulSetPods,
  statefulSetHistory,

  // form models
  createFormModel,
  createYamlFormModel,
  editFormModel,
  scaleFormModel,
  yamlFormModel,

  // form refs
  formRef,
  editFormRef,
  scaleFormRef,
  yamlFormRef,
  createYamlFormRef,

  // form rules
  createFormRules,
  editFormRules,
  scaleFormRules,
  yamlFormRules,
  createYamlFormRules,

  // computed
  filteredStatefulSets,
  rowSelection,

  // helpers
  getEnvText,
  getStatusText,
  getStatusColor,

  // operations
  fetchClusters,
  fetchNamespaces,
  fetchStatefulSets,
  clearStatefulSets,
  clearNamespaces,
  loadMoreClusters,
  loadMoreNamespaces,

  // detail operations
  showStatefulSetDetail,
  closeDetailModal,

  // YAML operations
  showYamlModal,
  closeYamlModal,
  submitYamlForm,
  insertYamlTemplate,
  formatYaml,
  validateYaml,
  clearYaml,
  formatEditYaml,
  validateEditYaml,

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

  // statefulSet operations
  deleteStatefulSet,
  restartStatefulSet,

  // scale operations
  openScaleModal,
  closeScaleModal,
  submitScaleForm,

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
  addEditImageField,
  removeEditImageField,
  removeLabelField,
  removeAnnotationField,
  removeEditLabelField,
  removeEditAnnotationField,

  // constants
  K8sStatefulSetStatus,

  // formatters
  formatTime,
} = useStatefulSetPage();

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

const addNewEditLabel = () => {
  if (newEditLabelKey.value && newEditLabelKey.value.trim()) {
    editFormModel.value.labels.push({
      key: newEditLabelKey.value.trim(),
      value: '',
    });
    newEditLabelKey.value = '';
  }
};

const addNewEditAnnotation = () => {
  if (newEditAnnotationKey.value && newEditAnnotationKey.value.trim()) {
    editFormModel.value.annotations.push({
      key: newEditAnnotationKey.value.trim(),
      value: '',
    });
    newEditAnnotationKey.value = '';
  }
};

const onSearch = () => {
  currentPage.value = 1;
  fetchStatefulSets();
};

const handleFilterChange = () => {
  currentPage.value = 1;
  fetchStatefulSets();
};

const handleClusterChange = () => {
  currentPage.value = 1;
  clearNamespaces();
  clearStatefulSets();

  if (filterClusterId.value) {
    fetchNamespaces(true); // 重置命名空间分页
    fetchStatefulSets();
  } else {}
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
  { title: '副本详情', key: 'replicas', width: 130, align: 'center' },
  {
    title: '服务名称',
    dataIndex: 'service_name',
    key: 'service_name',
    width: 130,
    ellipsis: true,
  },
  {
    title: '更新策略',
    dataIndex: 'update_strategy',
    key: 'update_strategy',
    width: 100,
    align: 'center',
  },
  {
    title: 'Pod策略',
    dataIndex: 'pod_management_policy',
    key: 'pod_management_policy',
    width: 100,
    align: 'center',
  },
  { title: '镜像', dataIndex: 'images', key: 'images', width: 200 },
  { title: '标签', dataIndex: 'labels', key: 'labels', width: 150 },
  { title: '注解', dataIndex: 'annotations', key: 'annotations', width: 120 },
  { title: 'UID', dataIndex: 'uid', key: 'uid', width: 100, ellipsis: true },
  { title: '创建时间', dataIndex: 'created_at', key: 'created_at', width: 160 },
  {
    title: '操作',
    key: 'actions',
    width: 380,
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
  filterServiceName.value = undefined;
  clearFilterLabels();
  currentPage.value = 1;
  clearStatefulSets();
  clearNamespaces();
};

// 快速回滚到指定版本
const rollbackToVersion = (revision: number) => {
  if (!currentOperationStatefulSet.value) return;

  Modal.confirm({
    title: '回滚确认',
    content: `确定要将 StatefulSet "${currentOperationStatefulSet.value.name}" 回滚到版本 ${revision} 吗？`,
    okText: '确认回滚',
    okType: 'primary',
    cancelText: '取消',
    centered: true,
    onOk: async () => {
      try {
        const clusterId =
          currentOperationStatefulSet.value!.cluster_id ||
          filterClusterId.value;
        if (!clusterId || clusterId === 0) {
          message.error('无效的集群ID，请重新选择集群');
          return;
        }

        await rollbackStatefulSetApi(
          clusterId,
          currentOperationStatefulSet.value!.namespace,
          currentOperationStatefulSet.value!.name,
          {
            cluster_id: clusterId,
            namespace: currentOperationStatefulSet.value!.namespace,
            name: currentOperationStatefulSet.value!.name,
            revision,
          },
        );
        message.success(`StatefulSet 回滚到版本 ${revision} 成功`);
        closeHistoryModal();
        await fetchStatefulSets();
      } catch (err) {
        if (shouldNotifyPageError(err))
          message.error(`StatefulSet 回滚到版本 ${revision} 失败`);
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

<style scoped src="./StatefulSet.css"></style>
