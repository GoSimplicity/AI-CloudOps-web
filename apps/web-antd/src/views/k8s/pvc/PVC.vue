<template>
  <OpsPage
    description="管理和监控集群中的所有 Kubernetes PersistentVolumeClaim 持久化卷声明"
    title="PVC 管理"
  >
    <template #actions>
      <a-button
        :disabled="!filterClusterId"
        type="primary"
        @click="openCreateModal"
      >
        <template #icon><PlusOutlined aria-hidden="true" /></template>
        创建 PVC
      </a-button>
      <a-button
        :disabled="!filterClusterId"
        :loading="loading"
        @click="fetchPVCs"
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
                <CloudServerOutlined aria-hidden="true" />
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
              <a-select-option :value="K8sPVCStatus.Pending">
                等待中
              </a-select-option>
              <a-select-option :value="K8sPVCStatus.Bound">
                已绑定
              </a-select-option>
              <a-select-option :value="K8sPVCStatus.Lost">丢失</a-select-option>
              <a-select-option :value="K8sPVCStatus.Terminating">
                终止中
              </a-select-option>
              <a-select-option :value="K8sPVCStatus.Unknown">
                未知
              </a-select-option>
            </a-select>

            <a-select
              v-model:value="filterAccessMode"
              allow-clear
              class="k8s-filter-select"
              placeholder="访问模式"
              @change="handleFilterChange"
            >
              <template #suffixIcon>
                <KeyOutlined aria-hidden="true" />
              </template>
              <a-select-option value="ReadWriteOnce">RWO</a-select-option>
              <a-select-option value="ReadOnlyMany">ROX</a-select-option>
              <a-select-option value="ReadWriteMany">RWX</a-select-option>
              <a-select-option value="ReadWriteOncePod">RWOP</a-select-option>
            </a-select>
          </div>

          <div class="k8s-search-group">
            <a-input
              v-model:value="searchText"
              allow-clear
              class="k8s-search-input"
              placeholder="搜索 PVC 名称"
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
              :disabled="
                !filterStatus &&
                !filterAccessMode &&
                !searchText &&
                !filterClusterId &&
                !filterNamespace
              "
              class="k8s-toolbar-btn"
              title="重置所有筛选条件"
              @click="resetFilters"
            >
              <template #icon><DeleteOutlined aria-hidden="true" /></template>
              重置筛选
            </a-button>

            <a-button
              :disabled="!filterClusterId"
              class="k8s-toolbar-btn"
              title="通过YAML创建PVC"
              @click="openCreateYamlModal"
            >
              <template #icon><FileTextOutlined aria-hidden="true" /></template>
              YAML 创建
            </a-button>

            <a-button
              type="primary"
              danger
              @click="deleteBatchPVCs"
              :disabled="!selectedRows.length"
              v-if="can('k8s.pvc.batchDelete') && selectedRows.length > 0"
              class="k8s-toolbar-btn"
              title="批量删除选中的 PVC"
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
        <a-button size="small" @click="fetchPVCs">重试查询</a-button>
      </template>
    </a-alert>

    <!-- 数据展示区域 -->
    <div class="k8s-data-display">
      <a-table
        :columns="columns"
        :data-source="filteredPVCs"
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
        :scroll="{ x: 1600 }"
        class="k8s-table pvc-table"
        @change="handleTableChange"
      >
        <template #bodyCell="{ column, record, text }">
          <template v-if="column.key === 'name'">
            <div style="display: flex; align-items: center; gap: 8px">
              <InboxOutlined
                aria-hidden="true"
                style="color: #1677ff; font-size: 16px"
              />
              <span style="font-weight: 500; color: var(--ops-ink)">{{
                record.name
              }}</span>
            </div>
          </template>
          <template v-else-if="column.key === 'namespace'">
            <a-tag color="blue">{{ text }}</a-tag>
          </template>
          <template v-else-if="column.key === 'status'">
            <a-badge
              :status="getPVCStatusColor(text)"
              :text="getPVCStatusText(text)"
            />
          </template>
          <template v-else-if="column.key === 'capacity'">
            <div class="pvc-capacity-info">
              <div class="pvc-capacity-item">
                <span class="pvc-capacity-label">实际:</span>
                <a-tag color="green">{{ record.capacity || '未分配' }}</a-tag>
              </div>
              <div class="pvc-capacity-item">
                <span class="pvc-capacity-label">请求:</span>
                <a-tag color="blue">{{ record.request_storage }}</a-tag>
              </div>
            </div>
          </template>
          <template v-else-if="column.key === 'access_modes'">
            <div class="k8s-tags-display">
              <a-tag
                v-for="mode in text"
                :key="mode"
                color="green"
                size="small"
              >
                {{ getAccessModeText(mode) }}
              </a-tag>
              <span v-if="!text || text.length === 0" class="k8s-no-data">
                无访问模式
              </span>
            </div>
          </template>
          <template v-else-if="column.key === 'storage_class'">
            <span v-if="text">{{ text }}</span>
            <span v-else class="k8s-no-data">默认存储类</span>
          </template>
          <template v-else-if="column.key === 'volume_name'">
            <div v-if="text">
              <a-tag color="purple">{{ text }}</a-tag>
            </div>
            <span v-else class="k8s-no-data">未绑定</span>
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
                <a-button title="查看详情" @click="openDetailModal(record)">
                  <template #icon><EyeOutlined aria-hidden="true" /></template>
                </a-button>
              </a-tooltip>
              <a-tooltip title="查看 YAML">
                <a-button title="查看 YAML" @click="openYamlModal(record)">
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
                v-if="record.status === K8sPVCStatus.Bound"
                title="扩容PVC"
              >
                <a-button title="扩容PVC" @click="openExpandModal(record)">
                  <template #icon>
                    <ExpandOutlined aria-hidden="true" />
                  </template>
                </a-button>
              </a-tooltip>
              <a-tooltip title="查看关联Pod">
                <a-button title="查看关联Pod" @click="openPodsModal(record)">
                  <template #icon>
                    <ContainerOutlined aria-hidden="true" />
                  </template>
                </a-button>
              </a-tooltip>
              <a-tooltip v-if="can('k8s.pvc.delete')" title="删除">
                <a-button danger title="删除" @click="deletePVC(record)">
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
            <InboxOutlined aria-hidden="true" />
            <p>暂无 PVC 数据</p>
            <p v-if="!filterClusterId">请先选择集群</p>
            <p v-else>请调整筛选条件或刷新数据</p>
          </div>
        </template>
      </a-table>
    </div>

    <!-- 创建PVC模态框 -->
    <a-modal
      v-model:open="isCreateModalVisible"
      :confirm-loading="submitLoading"
      :maskClosable="false"
      :width="800"
      cancelText="取消"
      destroyOnClose
      okText="创建"
      title="创建 PersistentVolumeClaim"
      @cancel="resetCreateForm"
      @ok="createPVC"
    >
      <a-form
        ref="formRef"
        :model="createFormModel"
        :rules="createFormRules"
        class="k8s-form"
        layout="vertical"
      >
        <a-row :gutter="16">
          <a-col :span="12">
            <a-form-item :required="true" label="PVC名称" name="name">
              <a-input
                v-model:value="createFormModel.name"
                :maxlength="63"
                class="k8s-form-input"
                placeholder="请输入 PVC 名称（例如：pvc-web-data）"
              />
              <div
                style="
                  color: var(--ops-muted);
                  font-size: 12px;
                  margin-top: 4px;
                "
              >
                只能包含小写字母、数字和连字符，且不能以连字符开头或结尾
              </div>
            </a-form-item>
          </a-col>
          <a-col :span="12">
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
              </a-select>
              <div
                style="
                  color: var(--ops-muted);
                  font-size: 12px;
                  margin-top: 4px;
                "
              >
                PVC 必须属于某个命名空间
              </div>
            </a-form-item>
          </a-col>
        </a-row>

        <a-row :gutter="16">
          <a-col :span="12">
            <a-form-item
              :name="['spec', 'request_storage']"
              :required="true"
              label="请求存储"
            >
              <a-input
                v-model:value="createFormModel.spec.request_storage"
                :maxlength="20"
                class="k8s-form-input"
                placeholder="如: 10Gi, 500Mi, 1Ti"
              />
              <div
                style="
                  color: var(--ops-muted);
                  font-size: 12px;
                  margin-top: 4px;
                "
              >
                请求的存储容量大小
              </div>
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item
              :name="['spec', 'access_modes']"
              :required="true"
              label="访问模式"
            >
              <a-select
                v-model:value="createFormModel.spec.access_modes"
                :maxTagCount="1"
                class="k8s-form-input"
                mode="multiple"
                placeholder="选择访问模式"
              >
                <a-select-option value="ReadWriteOnce">
                  ReadWriteOnce (RWO)
                </a-select-option>
                <a-select-option value="ReadOnlyMany">
                  ReadOnlyMany (ROX)
                </a-select-option>
                <a-select-option value="ReadWriteMany">
                  ReadWriteMany (RWX)
                </a-select-option>
                <a-select-option value="ReadWriteOncePod">
                  ReadWriteOncePod (RWOP)
                </a-select-option>
              </a-select>
              <div
                style="
                  color: var(--ops-muted);
                  font-size: 12px;
                  margin-top: 4px;
                "
              >
                定义 PVC 可以请求的访问方式，可多选
              </div>
            </a-form-item>
          </a-col>
        </a-row>

        <a-row :gutter="16">
          <a-col :span="12">
            <a-form-item label="存储类">
              <a-input
                v-model:value="createFormModel.spec.storage_class"
                :maxlength="253"
                class="k8s-form-input"
                placeholder="输入存储类名称（可选）"
              />
              <div
                style="
                  color: var(--ops-muted);
                  font-size: 12px;
                  margin-top: 4px;
                "
              >
                留空表示使用默认存储类
              </div>
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item label="卷模式">
              <a-select
                v-model:value="createFormModel.spec.volume_mode"
                class="k8s-form-input"
                placeholder="选择卷模式"
              >
                <a-select-option value="Filesystem">
                  Filesystem (文件系统)
                </a-select-option>
                <a-select-option value="Block">Block (块设备)</a-select-option>
              </a-select>
              <div
                style="
                  color: var(--ops-muted);
                  font-size: 12px;
                  margin-top: 4px;
                "
              >
                默认为 Filesystem 模式
              </div>
            </a-form-item>
          </a-col>
        </a-row>

        <a-row :gutter="16">
          <a-col :span="24">
            <a-form-item label="绑定PV（可选）">
              <a-select
                v-model:value="createFormModel.spec.volume_name"
                :dropdown-match-select-width="false"
                :dropdown-style="{ minWidth: '550px', maxWidth: '650px' }"
                :filter-option="
                  (input: string, option: any) => {
                    if (!input || !option?.label) return true;
                    return option.label
                      .toLowerCase()
                      .includes(input.toLowerCase());
                  }
                "
                :loading="pvsLoading"
                :options="pvOptions"
                allow-clear
                class="k8s-form-input"
                placeholder="留空将自动选择合适的 PV"
                show-search
                @popup-scroll="handlePVDropdownScroll"
              >
                <template #option="{ value, label, capacity, accessModes }">
                  <div
                    v-if="value === '__load_more_pvs__'"
                    style="
                      text-align: center;
                      color: var(--ops-muted);
                      padding: 8px 0;
                    "
                  >
                    <a-spin :spinning="pvsLoading" size="small" />
                    <span v-if="!pvsLoading" style="margin-left: 8px"
                      >滚动加载更多...</span
                    >
                  </div>
                  <div
                    v-else
                    style="
                      display: flex;
                      align-items: center;
                      justify-content: space-between;
                      gap: 12px;
                      padding: 6px 4px;
                      min-height: 32px;
                    "
                  >
                    <span
                      :title="label"
                      style="
                        flex: 1;
                        min-width: 0;
                        overflow: hidden;
                        text-overflow: ellipsis;
                        white-space: nowrap;
                        font-weight: 500;
                        color: var(--ops-ink);
                      "
                    >
                      {{ label }}
                    </span>
                    <div
                      style="
                        flex: 0 0 auto;
                        display: flex;
                        align-items: center;
                        gap: 6px;
                      "
                    >
                      <a-tag
                        color="blue"
                        size="small"
                        style="margin: 0; font-size: 12px"
                      >
                        {{ capacity }}
                      </a-tag>
                      <a-tag
                        v-for="(mode, idx) in (accessModes || []).slice(0, 2)"
                        :key="idx"
                        color="green"
                        size="small"
                        style="margin: 0; font-size: 11px"
                      >
                        {{
                          mode === 'ReadWriteOnce'
                            ? 'RWO'
                            : mode === 'ReadOnlyMany'
                              ? 'ROX'
                              : mode === 'ReadWriteMany'
                                ? 'RWX'
                                : 'RWOP'
                        }}
                      </a-tag>
                      <a-tooltip
                        v-if="(accessModes || []).length > 2"
                        :title="
                          (accessModes || [])
                            .slice(2)
                            .map((m: string) =>
                              m === 'ReadWriteOnce'
                                ? 'RWO'
                                : m === 'ReadOnlyMany'
                                  ? 'ROX'
                                  : m === 'ReadWriteMany'
                                    ? 'RWX'
                                    : 'RWOP',
                            )
                            .join(', ')
                        "
                      >
                        <a-tag
                          size="small"
                          style="margin: 0; cursor: help; font-size: 11px"
                        >
                          +{{ (accessModes || []).length - 2 }}
                        </a-tag>
                      </a-tooltip>
                    </div>
                  </div>
                </template>
              </a-select>
              <div
                style="
                  color: var(--ops-muted);
                  font-size: 12px;
                  margin-top: 4px;
                  line-height: 1.5;
                "
              >
                <span v-if="availablePVs.length > 0">
                  已加载
                  <strong style="color: #1890ff">{{
                    availablePVs.length
                  }}</strong>
                  / <strong>{{ pvsTotal }}</strong> 个可用 PV
                </span>
                <span v-else-if="pvsLoading"> 正在加载可用的 PV... </span>
                <span v-else>
                  当前集群暂无可用 PV，留空将自动匹配或动态创建
                </span>
              </div>
            </a-form-item>
          </a-col>
        </a-row>

        <a-form-item label="PV选择器（可选）">
          <div class="k8s-key-value-inputs">
            <div
              v-if="
                !createFormModel.spec.selector ||
                Object.keys(createFormModel.spec.selector).length === 0
              "
              style="text-align: center; color: var(--ops-muted); padding: 16px"
            >
              暂无选择器，点击下方按钮添加
            </div>
            <div
              v-for="(_value, key) in createFormModel.spec.selector"
              :key="key"
              class="k8s-key-value-row"
            >
              <a-input
                :maxlength="63"
                :value="key"
                class="k8s-form-input"
                disabled
                placeholder="选择器键"
              />
              <a-input
                v-model:value="createFormModel.spec.selector[key]"
                :maxlength="63"
                class="k8s-form-input"
                placeholder="选择器值"
              />
              <a-button
                class="k8s-remove-btn"
                danger
                size="small"
                type="text"
                @click="removeSelectorItem(key)"
              >
                <template #icon><DeleteOutlined aria-hidden="true" /></template>
              </a-button>
            </div>
            <div class="add-input-row" style="margin-top: 8px">
              <a-input
                v-model:value="newSelectorKey"
                placeholder="选择器键"
                style="flex: 1; margin-right: 8px"
                @press-enter="addSelectorItem"
              />
              <a-input
                v-model:value="newSelectorValue"
                placeholder="选择器值"
                style="flex: 1; margin-right: 8px"
                @press-enter="addSelectorItem"
              />
              <a-button
                type="primary"
                @click="addSelectorItem"
                :disabled="!newSelectorKey.trim()"
              >
                <template #icon><PlusOutlined aria-hidden="true" /></template>
                添加
              </a-button>
            </div>
          </div>
          <div
            style="color: var(--ops-muted); font-size: 12px; margin-top: 4px"
          >
            通过标签选择器筛选符合条件的 PV
          </div>
        </a-form-item>

        <a-form-item label="标签配置（可选）">
          <a-form-item-rest>
            <div class="k8s-key-value-inputs">
              <div
                v-if="
                  !createFormModel.labels ||
                  Object.keys(createFormModel.labels).length === 0
                "
                style="
                  text-align: center;
                  color: var(--ops-muted);
                  padding: 16px;
                "
              >
                暂无标签，点击下方按钮添加
              </div>
              <div
                v-for="(_value, key) in createFormModel.labels"
                :key="key"
                class="k8s-key-value-row"
              >
                <a-input
                  :maxlength="63"
                  :value="key"
                  class="k8s-form-input"
                  disabled
                  placeholder="标签键"
                />
                <a-input
                  v-model:value="createFormModel.labels[key]"
                  :maxlength="63"
                  class="k8s-form-input"
                  placeholder="标签值"
                />
                <a-button
                  class="k8s-remove-btn"
                  danger
                  size="small"
                  type="text"
                  @click="removeLabelItem(key, 'labels')"
                >
                  <template #icon>
                    <DeleteOutlined aria-hidden="true" />
                  </template>
                </a-button>
              </div>
              <div class="add-input-row" style="margin-top: 8px">
                <a-input
                  v-model:value="newLabelKey"
                  placeholder="标签键"
                  style="flex: 1; margin-right: 8px"
                  @press-enter="addLabelItem('labels')"
                />
                <a-button
                  type="primary"
                  @click="addLabelItem('labels')"
                  :disabled="!newLabelKey.trim()"
                >
                  <template #icon><PlusOutlined aria-hidden="true" /></template>
                  添加标签
                </a-button>
              </div>
            </div>
          </a-form-item-rest>
        </a-form-item>

        <a-form-item label="注解配置（可选）">
          <a-form-item-rest>
            <div class="k8s-key-value-inputs">
              <div
                v-if="
                  !createFormModel.annotations ||
                  Object.keys(createFormModel.annotations).length === 0
                "
                style="
                  text-align: center;
                  color: var(--ops-muted);
                  padding: 16px;
                "
              >
                暂无注解，点击下方按钮添加
              </div>
              <div
                v-for="(_value, key) in createFormModel.annotations"
                :key="key"
                class="k8s-key-value-row"
              >
                <a-input
                  :maxlength="253"
                  :value="key"
                  class="k8s-form-input"
                  disabled
                  placeholder="注解键"
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
                  @click="removeLabelItem(key, 'annotations')"
                >
                  <template #icon>
                    <DeleteOutlined aria-hidden="true" />
                  </template>
                </a-button>
              </div>
              <div class="add-input-row" style="margin-top: 8px">
                <a-input
                  v-model:value="newAnnotationKey"
                  placeholder="注解键"
                  style="flex: 1; margin-right: 8px"
                  @press-enter="addLabelItem('annotations')"
                />
                <a-button
                  type="primary"
                  @click="addLabelItem('annotations')"
                  :disabled="!newAnnotationKey.trim()"
                >
                  <template #icon><PlusOutlined aria-hidden="true" /></template>
                  添加注解
                </a-button>
              </div>
            </div>
          </a-form-item-rest>
        </a-form-item>
      </a-form>
    </a-modal>

    <!-- YAML创建PVC模态框 -->
    <a-modal
      v-model:open="isCreateYamlModalVisible"
      :confirm-loading="submitLoading"
      :maskClosable="false"
      :width="900"
      cancelText="取消"
      destroyOnClose
      okText="创建"
      title="通过 YAML 创建 PVC"
      @cancel="resetCreateYamlForm"
      @ok="createPVCByYaml"
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
            placeholder="请输入 PVC 的 YAML 配置，或点击【插入模板】使用默认模板"
          />
        </a-form-item>
      </a-form>
    </a-modal>

    <!-- 编辑PVC模态框 -->
    <a-modal
      v-model:open="isEditModalVisible"
      :confirm-loading="submitLoading"
      :maskClosable="false"
      :width="800"
      cancelText="取消"
      destroyOnClose
      okText="保存"
      title="编辑 PersistentVolumeClaim"
      @cancel="resetEditForm"
      @ok="updatePVC"
    >
      <a-form
        ref="formRef"
        :model="editFormModel"
        class="k8s-form"
        layout="vertical"
      >
        <a-row :gutter="16">
          <a-col :span="12">
            <a-form-item label="PVC名称">
              <a-input
                v-model:value="editFormModel.name"
                class="k8s-form-input"
                disabled
              />
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item label="命名空间">
              <a-input
                v-model:value="editFormModel.namespace"
                class="k8s-form-input"
                disabled
              />
            </a-form-item>
          </a-col>
        </a-row>

        <a-row :gutter="16">
          <a-col :span="12">
            <a-form-item label="请求存储（只读）">
              <a-input
                v-model:value="editFormModel.spec.request_storage"
                class="k8s-form-input"
                disabled
              />
              <div
                style="
                  color: var(--ops-muted);
                  font-size: 12px;
                  margin-top: 4px;
                "
              >
                创建后不可修改，如需扩容请使用扩容功能
              </div>
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item label="存储类（只读）">
              <a-input
                v-model:value="editFormModel.spec.storage_class"
                class="k8s-form-input"
                disabled
                placeholder="默认存储类"
              />
            </a-form-item>
          </a-col>
        </a-row>

        <a-row :gutter="16">
          <a-col :span="12">
            <a-form-item label="访问模式（只读）">
              <div style="display: flex; gap: 8px; flex-wrap: wrap">
                <a-tag
                  v-for="mode in editFormModel.spec.access_modes"
                  :key="mode"
                  color="green"
                >
                  {{
                    mode === 'ReadWriteOnce'
                      ? 'RWO'
                      : mode === 'ReadOnlyMany'
                        ? 'ROX'
                        : mode === 'ReadWriteMany'
                          ? 'RWX'
                          : 'RWOP'
                  }}
                </a-tag>
                <span
                  v-if="
                    !editFormModel.spec.access_modes ||
                    editFormModel.spec.access_modes.length === 0
                  "
                  >-</span
                >
              </div>
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item label="卷模式（只读）">
              <a-input
                v-model:value="editFormModel.spec.volume_mode"
                class="k8s-form-input"
                disabled
              />
            </a-form-item>
          </a-col>
        </a-row>

        <a-form-item label="绑定PV（只读）">
          <a-input
            v-model:value="editFormModel.spec.volume_name"
            class="k8s-form-input"
            disabled
            placeholder="未绑定"
          />
        </a-form-item>

        <a-form-item label="标签">
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
              v-for="(_value, key) in editFormModel.labels"
              :key="key"
              class="k8s-key-value-row"
            >
              <a-input
                :maxlength="63"
                :value="key"
                class="k8s-form-input"
                disabled
                placeholder="标签键"
              />
              <a-input
                v-model:value="editFormModel.labels[key]"
                :maxlength="63"
                class="k8s-form-input"
                placeholder="标签值"
              />
              <a-button
                class="k8s-remove-btn"
                danger
                size="small"
                type="text"
                @click="removeEditLabelItem(key, 'labels')"
              >
                <template #icon><DeleteOutlined aria-hidden="true" /></template>
              </a-button>
            </div>
            <div class="add-input-row" style="margin-top: 8px">
              <a-input
                v-model:value="newEditLabelKey"
                placeholder="标签键"
                style="flex: 1; margin-right: 8px"
                @press-enter="addEditLabelItem('labels')"
              />
              <a-button
                type="primary"
                @click="addEditLabelItem('labels')"
                :disabled="!newEditLabelKey.trim()"
              >
                <template #icon><PlusOutlined aria-hidden="true" /></template>
                添加标签
              </a-button>
            </div>
          </div>
        </a-form-item>

        <a-form-item label="注解">
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
              v-for="(_value, key) in editFormModel.annotations"
              :key="key"
              class="k8s-key-value-row"
            >
              <a-input
                :maxlength="253"
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
                @click="removeEditLabelItem(key, 'annotations')"
              >
                <template #icon><DeleteOutlined aria-hidden="true" /></template>
              </a-button>
            </div>
            <div class="add-input-row" style="margin-top: 8px">
              <a-input
                v-model:value="newEditAnnotationKey"
                placeholder="注解键"
                style="flex: 1; margin-right: 8px"
                @press-enter="addEditLabelItem('annotations')"
              />
              <a-button
                type="primary"
                @click="addEditLabelItem('annotations')"
                :disabled="!newEditAnnotationKey.trim()"
              >
                <template #icon><PlusOutlined aria-hidden="true" /></template>
                添加注解
              </a-button>
            </div>
          </div>
        </a-form-item>
      </a-form>
    </a-modal>

    <!-- PVC详情模态框 -->
    <a-modal
      v-model:open="isDetailModalVisible"
      :footer="null"
      :maskClosable="false"
      :title="`PVC 详情: ${currentOperationPVC?.name}`"
      :width="900"
      class="k8s-detail-modal"
      destroyOnClose
    >
      <div v-if="currentPVCDetail" class="k8s-detail-content">
        <a-card class="k8s-detail-card" size="small" title="基本信息">
          <div class="k8s-detail-item">
            <span class="k8s-detail-label">名称:</span>
            <span class="k8s-detail-value">{{ currentPVCDetail.name }}</span>
          </div>
          <div class="k8s-detail-item">
            <span class="k8s-detail-label">命名空间:</span>
            <span class="k8s-detail-value">
              <a-tag color="blue">{{ currentPVCDetail.namespace }}</a-tag>
            </span>
          </div>
          <div class="k8s-detail-item">
            <span class="k8s-detail-label">UID:</span>
            <span class="k8s-detail-value">{{ currentPVCDetail.uid }}</span>
          </div>
          <div class="k8s-detail-item">
            <span class="k8s-detail-label">状态:</span>
            <span class="k8s-detail-value">
              <a-badge
                :status="getPVCStatusColor(currentPVCDetail.status)"
                :text="getPVCStatusText(currentPVCDetail.status)"
              />
            </span>
          </div>
          <div class="k8s-detail-item">
            <span class="k8s-detail-label">实际容量:</span>
            <span class="k8s-detail-value">
              <a-tag color="green">{{
                currentPVCDetail.capacity || '未分配'
              }}</a-tag>
            </span>
          </div>
          <div class="k8s-detail-item">
            <span class="k8s-detail-label">请求存储:</span>
            <span class="k8s-detail-value">
              <a-tag color="blue">{{ currentPVCDetail.request_storage }}</a-tag>
            </span>
          </div>
          <div class="k8s-detail-item">
            <span class="k8s-detail-label">访问模式:</span>
            <span class="k8s-detail-value">
              <a-tag
                v-for="mode in currentPVCDetail.access_modes"
                :key="mode"
                color="green"
              >
                {{ getAccessModeText(mode) }}
              </a-tag>
            </span>
          </div>
          <div class="k8s-detail-item">
            <span class="k8s-detail-label">存储类:</span>
            <span class="k8s-detail-value">{{
              currentPVCDetail.storage_class || '默认存储类'
            }}</span>
          </div>
          <div class="k8s-detail-item">
            <span class="k8s-detail-label">卷模式:</span>
            <span class="k8s-detail-value">{{
              currentPVCDetail.volume_mode
            }}</span>
          </div>
          <div class="k8s-detail-item">
            <span class="k8s-detail-label">绑定PV:</span>
            <span class="k8s-detail-value">
              <a-tag v-if="currentPVCDetail.volume_name" color="purple">{{
                currentPVCDetail.volume_name
              }}</a-tag>
              <span v-else class="k8s-no-data">未绑定</span>
            </span>
          </div>
          <div class="k8s-detail-item">
            <span class="k8s-detail-label">创建时间:</span>
            <span class="k8s-detail-value"
              >{{ currentPVCDetail.created_at }} ({{
                currentPVCDetail.age
              }})</span
            >
          </div>
        </a-card>

        <a-card
          title="选择器"
          size="small"
          class="k8s-detail-card"
          v-if="
            currentPVCDetail.selector &&
            Object.keys(currentPVCDetail.selector).length > 0
          "
        >
          <div
            v-for="(value, key) in currentPVCDetail.selector"
            :key="key"
            class="k8s-detail-item"
          >
            <span class="k8s-detail-label">{{ key }}:</span>
            <span class="k8s-detail-value">{{ value }}</span>
          </div>
        </a-card>

        <a-card class="k8s-detail-card" size="small" title="标签">
          <div class="k8s-labels-display">
            <template
              v-if="
                currentPVCDetail.labels &&
                Object.keys(currentPVCDetail.labels).length > 0
              "
            >
              <a-tooltip
                v-for="(value, key) in currentPVCDetail.labels"
                :key="key"
                :title="`${key}: ${value}`"
              >
                <span class="k8s-label-item">
                  <span class="k8s-label-key">{{ key }}</span>
                  <span class="k8s-label-separator">:</span>
                  <span class="k8s-label-value">{{ value }}</span>
                </span>
              </a-tooltip>
            </template>
            <span v-else class="k8s-no-data">暂无标签</span>
          </div>
        </a-card>

        <a-card class="k8s-detail-card" size="small" title="注解">
          <div class="k8s-annotations-display">
            <a-tooltip
              v-for="(value, key) in currentPVCDetail.annotations"
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
                !currentPVCDetail.annotations ||
                Object.keys(currentPVCDetail.annotations).length === 0
              "
              class="k8s-no-data"
            >
              暂无注解
            </span>
          </div>
        </a-card>
      </div>
      <div v-else-if="detailLoading" style="text-align: center; padding: 50px">
        <a-spin size="large" />
        <p style="margin-top: 16px; color: var(--ops-muted)">加载详情中...</p>
      </div>
    </a-modal>

    <!-- YAML编辑模态框 -->
    <a-modal
      v-model:open="isYamlModalVisible"
      :confirm-loading="submitLoading"
      :maskClosable="false"
      :title="`查看/编辑 ${currentOperationPVC?.name} YAML`"
      :width="900"
      cancelText="取消"
      destroyOnClose
      okText="保存修改"
      @cancel="resetYamlForm"
      @ok="updatePVCByYaml"
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

    <!-- 扩容PVC模态框 -->
    <a-modal
      v-model:open="isExpandModalVisible"
      :confirm-loading="submitLoading"
      :maskClosable="false"
      :title="`扩容 PVC: ${currentOperationPVC?.name}`"
      :width="600"
      cancelText="取消"
      destroyOnClose
      okText="确认扩容"
      @cancel="resetExpandForm"
      @ok="expandPVC"
    >
      <a-form
        ref="expandFormRef"
        :model="expandFormModel"
        :rules="expandFormRules"
        class="k8s-form"
        layout="vertical"
      >
        <a-alert
          :style="{ marginBottom: '16px' }"
          description="扩容只能增加存储容量，不能减少。请确认存储类支持卷扩容功能。"
          message="PVC扩容说明"
          show-icon
          type="info"
        />

        <div v-if="currentOperationPVC" class="pvc-expand-info">
          <a-descriptions :column="1" bordered size="small">
            <a-descriptions-item label="当前容量">
              <a-tag color="blue">
                {{
                  currentOperationPVC.capacity ||
                  currentOperationPVC.request_storage
                }}
              </a-tag>
            </a-descriptions-item>
            <a-descriptions-item label="存储类">
              {{ currentOperationPVC.storage_class || '默认存储类' }}
            </a-descriptions-item>
          </a-descriptions>
        </div>

        <a-form-item
          label="新容量"
          name="new_capacity"
          style="margin-top: 16px"
        >
          <a-input
            v-model:value="expandFormModel.new_capacity"
            class="k8s-form-input"
            placeholder="输入新的存储容量，如: 20Gi"
          />
          <div
            style="color: var(--ops-muted); font-size: 12px; margin-top: 4px"
          >
            支持的单位：Ki, Mi, Gi, Ti, Pi, K, M, G, T, P
          </div>
        </a-form-item>
      </a-form>
    </a-modal>

    <!-- 关联Pod模态框 -->
    <a-modal
      v-model:open="isPodsModalVisible"
      :footer="null"
      :maskClosable="false"
      :title="`使用 PVC 的 Pod: ${currentOperationPVC?.name}`"
      :width="800"
      class="k8s-detail-modal"
      destroyOnClose
    >
      <div v-if="podsLoading" style="text-align: center; padding: 50px">
        <a-spin size="large" />
        <p style="margin-top: 16px; color: var(--ops-muted)">
          加载Pod列表中...
        </p>
      </div>
      <div v-else-if="currentPVCPods.length > 0">
        <a-table
          :columns="podsColumns"
          :data-source="currentPVCPods"
          :pagination="false"
          row-key="name"
          size="small"
        >
          <template #bodyCell="{ column, record }">
            <template v-if="column.dataIndex === 'name'">
              <div style="display: flex; align-items: center; gap: 8px">
                <ContainerOutlined
                  aria-hidden="true"
                  style="color: #1677ff; font-size: 14px"
                />
                <span>{{ record.name }}</span>
              </div>
            </template>
            <template v-else-if="column.dataIndex === 'status'">
              <a-badge
                :status="record.status === 'Running' ? 'success' : 'warning'"
                :text="record.status"
              />
            </template>
          </template>
        </a-table>
      </div>
      <div
        v-else
        style="text-align: center; padding: 50px; color: var(--ops-muted)"
      >
        <ContainerOutlined
          aria-hidden="true"
          style="font-size: 48px; margin-bottom: 16px; color: var(--ops-border)"
        />
        <p>暂无Pod使用此PVC</p>
      </div>
    </a-modal>
  </OpsPage>
</template>

<script setup lang="ts">
import OpsPage from '#/components/ops/OpsPage.vue';
import { namespacedResourceKey } from '../shared/utils';
import { onMounted } from 'vue';
import {
  AppstoreOutlined,
  CheckCircleOutlined,
  ClearOutlined,
  CloudServerOutlined,
  ContainerOutlined,
  DeleteOutlined,
  EditOutlined,
  ExpandOutlined,
  EyeOutlined,
  FileAddOutlined,
  FileTextOutlined,
  FilterOutlined,
  FormatPainterOutlined,
  InboxOutlined,
  KeyOutlined,
  PlusOutlined,
  ReloadOutlined,
  SearchOutlined,
} from '@ant-design/icons-vue';
import { usePVCPage } from './PVC';
import { formatDateTime, getRelativeTime } from '../shared/utils';

import { usePermission } from '#/utils/permission';

const { can } = usePermission();

const {
  // state
  clusters,
  namespaces,
  availablePVs,
  loading,
  loadError,
  clustersError,
  namespacesError,
  clustersLoading,
  namespacesLoading,
  pvsLoading,
  searchText,
  filterClusterId,
  filterNamespace,
  filterStatus,
  filterAccessMode,
  selectedRows,
  currentPage,
  pageSize,
  total,
  clustersTotal,
  namespacesTotal,
  pvsTotal,

  // form refs
  formRef,
  yamlFormRef,
  createYamlFormRef,
  expandFormRef,

  // modal state
  isCreateModalVisible,
  isCreateYamlModalVisible,
  isEditModalVisible,
  isDetailModalVisible,
  isYamlModalVisible,
  isExpandModalVisible,
  isPodsModalVisible,
  submitLoading,
  detailLoading,
  podsLoading,

  // current operation
  currentOperationPVC,
  currentPVCDetail,
  currentPVCPods,

  // form models
  createFormModel,
  editFormModel,
  yamlFormModel,
  createYamlFormModel,
  expandFormModel,

  // form rules
  createFormRules,
  yamlFormRules,
  createYamlFormRules,
  expandFormRules,

  // computed
  filteredPVCs,
  rowSelection,
  pvOptions,

  // helpers
  getEnvText,
  getPVCStatusText,
  getPVCStatusColor,
  getAccessModeText,

  // api calls
  fetchClusters,
  fetchNamespaces,
  fetchPVCs,
  createPVC,
  createPVCByYaml,
  updatePVC,
  updatePVCByYaml,
  deletePVC,
  expandPVC,
  deleteBatchPVCs,

  // modal handlers
  openCreateModal,
  openCreateYamlModal,
  openEditModal,
  openDetailModal,
  openYamlModal,
  openExpandModal,
  openPodsModal,

  // form helpers
  resetCreateForm,
  resetEditForm,
  resetYamlForm,
  resetCreateYamlForm,
  resetExpandForm,

  // filter handlers
  handleClusterChange,
  handleFilterChange,
  handleClusterDropdownScroll,
  loadMoreNamespaces,
  loadMorePVs,

  // label/annotation helpers
  newLabelKey,
  newAnnotationKey,
  addLabelItem,
  removeLabelItem,
  newEditLabelKey,
  newEditAnnotationKey,
  addEditLabelItem,
  removeEditLabelItem,

  // selector helpers
  newSelectorKey,
  newSelectorValue,
  addSelectorItem,
  removeSelectorItem,

  // yaml operations
  insertYamlTemplate,
  formatYaml,
  validateYaml,
  clearYaml,
  formatEditYaml,
  validateEditYaml,

  // constants
  K8sPVCStatus,
} = usePVCPage();

const columns = [
  {
    title: 'PVC名称',
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
  {
    title: '容量信息',
    dataIndex: 'capacity',
    key: 'capacity',
    width: 120,
    align: 'center',
  },
  {
    title: '访问模式',
    dataIndex: 'access_modes',
    key: 'access_modes',
    width: 140,
  },
  {
    title: '存储类',
    dataIndex: 'storage_class',
    key: 'storage_class',
    width: 130,
    ellipsis: true,
  },
  {
    title: '绑定PV',
    dataIndex: 'volume_name',
    key: 'volume_name',
    width: 150,
    ellipsis: true,
  },
  { title: '标签', dataIndex: 'labels', key: 'labels', width: 150 },
  { title: '注解', dataIndex: 'annotations', key: 'annotations', width: 120 },
  { title: 'UID', dataIndex: 'uid', key: 'uid', width: 100, ellipsis: true },
  { title: '创建时间', dataIndex: 'created_at', key: 'created_at', width: 160 },
  {
    title: '操作',
    key: 'actions',
    width: 200,
    fixed: 'right',
    align: 'center',
  },
];

// Pod列表表格列定义
const podsColumns = [
  {
    title: 'Pod名称',
    dataIndex: 'name',
    key: 'name',
    width: 200,
  },
  {
    title: '命名空间',
    dataIndex: 'namespace',
    key: 'namespace',
    width: 120,
  },
  {
    title: '状态',
    dataIndex: 'status',
    key: 'status',
    width: 120,
  },
  {
    title: '节点',
    dataIndex: 'node_name',
    key: 'node_name',
    width: 150,
  },
  {
    title: '创建时间',
    dataIndex: 'created_at',
    key: 'created_at',
    width: 180,
  },
];

// 搜索功能
const onSearch = () => {
  currentPage.value = 1;
  fetchPVCs();
};

// 重置所有筛选条件
const resetFilters = () => {
  filterStatus.value = undefined;
  filterAccessMode.value = undefined;
  searchText.value = '';
  filterClusterId.value = undefined;
  filterNamespace.value = undefined;
  currentPage.value = 1;
  fetchPVCs();
};

// 表格变化处理
const handleTableChange = (pagination: {
  current?: number;
  pageSize?: number;
}) => {
  if (pagination) {
    currentPage.value = pagination.current || currentPage.value;
    if (pagination.pageSize) {
      pageSize.value = pagination.pageSize;
    }
    fetchPVCs();
  }
};

// PV 下拉框滚动处理
const handlePVDropdownScroll = (e: Event) => {
  const target = e.target as HTMLElement;
  if (target.scrollTop + target.offsetHeight === target.scrollHeight) {
    if (availablePVs.value.length < pvsTotal.value && !pvsLoading.value) {
      loadMorePVs();
    }
  }
};

// 页面初始化
onMounted(async () => {
  await fetchClusters(true);
});
</script>

<style scoped>
@import '../shared/k8s-common.css';
</style>

<style scoped src="./PVC.css"></style>
