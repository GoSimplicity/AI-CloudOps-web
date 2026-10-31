<template>
  <OpsPage
    description="管理和监控集群中的所有 Kubernetes 节点"
    title="节点管理"
  >
    <template #actions>
      <a-button
        :disabled="!filterClusterId"
        :loading="loading"
        @click="fetchNodes"
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
              v-model:value="filterStatus"
              allow-clear
              class="k8s-filter-select"
              placeholder="状态筛选"
              @change="handleFilterChange"
            >
              <template #suffixIcon>
                <FilterOutlined aria-hidden="true" />
              </template>
              <a-select-option :value="NodeStatus.Ready">就绪</a-select-option>
              <a-select-option :value="NodeStatus.NotReady">
                未就绪
              </a-select-option>
              <a-select-option :value="NodeStatus.SchedulingDisabled">
                调度禁用
              </a-select-option>
              <a-select-option :value="NodeStatus.Unknown">
                未知
              </a-select-option>
              <a-select-option :value="NodeStatus.Error">异常</a-select-option>
            </a-select>
          </div>

          <div class="k8s-search-group">
            <a-input
              v-model:value="searchText"
              allow-clear
              class="k8s-search-input"
              placeholder="搜索节点名称"
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
              :disabled="!filterClusterId && !filterStatus && !searchText"
              class="k8s-toolbar-btn"
              title="重置所有筛选条件"
              @click="resetFilters"
            >
              <template #icon><DeleteOutlined aria-hidden="true" /></template>
              重置筛选
            </a-button>

            <a-button
              type="primary"
              danger
              @click="() => batchOperation('禁用调度')"
              :disabled="!selectedRows.length"
              v-if="selectedRows.length > 0 && can('k8s.node.batchCordon')"
              class="k8s-toolbar-btn"
              title="批量禁用调度"
            >
              <template #icon><StopOutlined aria-hidden="true" /></template>
              批量操作 ({{ selectedRows.length }})
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
        <a-button size="small" @click="fetchNodes"> 重试查询 </a-button>
      </template>
    </a-alert>

    <!-- 数据展示区域 -->
    <div class="k8s-data-display">
      <a-table
        :columns="columns"
        :data-source="filteredNodes"
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
        :row-key="clusterResourceKey"
        :row-selection="rowSelection"
        :scroll="{ x: 1200 }"
        class="k8s-table"
        @change="handleTableChange"
      >
        <template #bodyCell="{ column, text, record }">
          <template v-if="column.key === 'status'">
            <a-badge
              :status="getStatusColor(text)"
              :text="getStatusText(text)"
            />
          </template>
          <template v-else-if="column.key === 'schedulable'">
            <a-badge
              :status="getSchedulableColor(text)"
              :text="getSchedulableText(text)"
            />
          </template>
          <template v-else-if="column.key === 'roles'">
            <div class="k8s-roles-display">
              <template v-if="text && text.length > 0">
                <a-tooltip
                  v-for="role in text.slice(0, 2)"
                  :key="role"
                  :title="role"
                >
                  <a-tag class="k8s-role-tag">{{ role }}</a-tag>
                </a-tooltip>
                <a-tooltip v-if="text.length > 2" :title="text.join(', ')">
                  <a-tag class="k8s-role-tag">+{{ text.length - 2 }}</a-tag>
                </a-tooltip>
              </template>
              <span v-else class="k8s-no-data">-</span>
            </div>
          </template>
          <template v-else-if="column.key === 'labels'">
            <div class="k8s-labels-display">
              <template v-if="Array.isArray(text)">
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
                <a-button title="查看详情" @click="showNodeDetail(record)">
                  <template #icon><EyeOutlined aria-hidden="true" /></template>
                </a-button>
              </a-tooltip>
              <a-tooltip title="管理标签">
                <a-button title="管理标签" @click="openEditLabelModal(record)">
                  <template #icon><TagsOutlined aria-hidden="true" /></template>
                </a-button>
              </a-tooltip>
              <a-tooltip
                v-if="can('k8s.node.taintAdd') || can('k8s.node.taintDelete')"
                title="管理污点"
              >
                <a-button title="管理污点" @click="openTaintModal(record)">
                  <template #icon>
                    <WarningOutlined aria-hidden="true" />
                  </template>
                </a-button>
              </a-tooltip>
              <a-tooltip
                v-if="
                  record.schedulable === 1
                    ? can('k8s.node.cordon')
                    : can('k8s.node.uncordon')
                "
                :title="record.schedulable === 1 ? '禁用调度' : '启用调度'"
              >
                <a-button
                  :title="record.schedulable === 1 ? '禁用调度' : '启用调度'"
                  data-action="schedule"
                  @click="toggleNodeSchedule(record)"
                >
                  <template #icon>
                    <StopOutlined
                      v-if="record.schedulable === 1"
                      aria-hidden="true"
                    />
                    <PlayCircleOutlined v-else aria-hidden="true" />
                  </template>
                </a-button>
              </a-tooltip>
              <a-tooltip title="驱逐节点">
                <a-button
                  danger
                  data-action="drain"
                  title="驱逐节点"
                  @click="openDrainModal(record)"
                >
                  <template #icon>
                    <DisconnectOutlined aria-hidden="true" />
                  </template>
                </a-button>
              </a-tooltip>
            </div>
          </template>
        </template>

        <template #os_image="{ text }">
          <span v-if="text && text.trim()" :title="text">{{ text }}</span>
          <span v-else class="k8s-no-data">-</span>
        </template>

        <template #emptyText>
          <div class="k8s-empty-state">
            <NodeIndexOutlined aria-hidden="true" />
            <p>暂无节点数据</p>
            <p v-if="!filterClusterId">请先选择集群</p>
            <p v-else>请调整筛选条件或刷新数据</p>
          </div>
        </template>
      </a-table>
    </div>

    <!-- 标签管理模态框 -->
    <a-modal
      v-model:open="isLabelModalVisible"
      :autoFocus="false"
      :confirmLoading="submitLoading"
      :focusTriggerAfterClose="false"
      :keyboard="true"
      :maskClosable="false"
      cancelText="取消"
      destroyOnClose
      okText="保存更改"
      title="管理节点标签 (Node Labels)"
      width="800px"
      @cancel="closeLabelModal"
      @ok="submitLabelForm"
    >
      <a-alert
        closable
        description="标签用于组织和选择 Kubernetes 资源。可以为节点添加自定义标签，用于 Pod 调度选择器、节点亲和性等场景。保存后将完全覆盖现有标签配置。"
        message="标签管理说明"
        show-icon
        style="margin-bottom: 16px"
        type="info"
      />

      <a-form
        ref="labelFormRef"
        :model="labelFormModel"
        :rules="labelFormRules"
        class="k8s-form"
        layout="vertical"
      >
        <a-form-item label="标签配置 (Key-Value)">
          <a-form-item-rest>
            <div class="k8s-key-value-inputs">
              <div
                v-if="
                  !labelFormModel.labels ||
                  Object.keys(labelFormModel.labels).length === 0
                "
                style="
                  text-align: center;
                  color: var(--ops-muted);
                  padding: 20px;
                "
              >
                暂无标签，点击下方"添加"按钮添加新标签
              </div>
              <div
                v-for="(_, key) in labelFormModel.labels"
                :key="key"
                class="k8s-key-value-row"
              >
                <a-input
                  :placeholder="`标签键: ${key}`"
                  :value="key"
                  class="k8s-form-input k8s-key-input"
                  disabled
                />
                <a-input
                  v-model:value="labelFormModel.labels[key]"
                  :maxlength="200"
                  class="k8s-form-input k8s-value-input"
                  placeholder="标签值"
                />
                <a-button
                  class="k8s-remove-btn"
                  danger
                  type="text"
                  @click="removeLabelField(key)"
                >
                  <template #icon>
                    <DeleteOutlined aria-hidden="true" />
                  </template>
                  删除
                </a-button>
              </div>
              <div class="k8s-add-input-row" style="margin-top: 12px">
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
          </a-form-item-rest>
        </a-form-item>
      </a-form>
    </a-modal>

    <!-- 污点管理模态框 -->
    <a-modal
      v-model:open="isTaintModalVisible"
      :autoFocus="false"
      :confirmLoading="submitLoading"
      :focusTriggerAfterClose="false"
      :keyboard="true"
      :maskClosable="false"
      :okButtonProps="{ disabled: !hasTaintChanges }"
      cancelText="取消"
      destroyOnClose
      okText="保存更改"
      title="管理节点污点 (Node Taints)"
      width="800px"
      @cancel="closeTaintModal"
      @ok="submitTaintForm"
    >
      <a-alert
        closable
        message="污点管理说明"
        show-icon
        style="margin-bottom: 16px"
        type="info"
      >
        <template #description>
          <div>
            污点（Taints）用于排斥 Pod 调度到节点上，除非 Pod
            具有相应的容忍度（Tolerations）。
            <div style="margin-top: 8px">
              <strong>污点效果说明：</strong>
              <ul style="margin: 4px 0 0 0; padding-left: 20px">
                <li>
                  <code>NoSchedule</code>: 禁止新 Pod 调度，不影响已有 Pod
                </li>
                <li><code>PreferNoSchedule</code>: 尽量避免调度，但不强制</li>
                <li>
                  <code>NoExecute</code>: 驱逐不容忍的 Pod，禁止新 Pod 调度
                </li>
              </ul>
            </div>
          </div>
        </template>
      </a-alert>

      <a-form
        ref="taintFormRef"
        :model="taintFormModel"
        :rules="taintFormRules"
        class="k8s-form"
        layout="vertical"
      >
        <a-form-item label="污点配置 (Key, Value, Effect)">
          <a-form-item-rest>
            <div class="k8s-key-value-inputs">
              <div
                v-if="
                  !taintFormModel.taints || taintFormModel.taints.length === 0
                "
                style="
                  text-align: center;
                  color: var(--ops-muted);
                  padding: 20px;
                "
              >
                暂无污点，点击下方"添加污点"按钮添加新污点
              </div>
              <div
                v-for="(taint, idx) in taintFormModel.taints"
                :key="idx"
                class="k8s-key-value-row"
              >
                <a-input
                  v-model:value="taint.key"
                  placeholder="污点键"
                  class="k8s-form-input"
                  :maxlength="100"
                  :disabled="!can('k8s.node.taintAdd')"
                  :readonly="!isNewTaint(taint)"
                />
                <a-input
                  v-model:value="taint.value"
                  placeholder="污点值（可选）"
                  class="k8s-form-input"
                  :maxlength="100"
                  :disabled="!can('k8s.node.taintAdd')"
                />
                <a-select
                  v-model:value="taint.effect"
                  placeholder="污点效果"
                  class="k8s-form-input"
                  style="width: 150px"
                  :disabled="!can('k8s.node.taintAdd')"
                >
                  <a-select-option value="NoSchedule">
                    NoSchedule
                  </a-select-option>
                  <a-select-option value="PreferNoSchedule">
                    PreferNoSchedule
                  </a-select-option>
                  <a-select-option value="NoExecute">NoExecute</a-select-option>
                </a-select>
                <a-button
                  v-if="can('k8s.node.taintDelete') || isNewTaint(taint)"
                  type="text"
                  danger
                  @click="removeTaint(idx)"
                  class="k8s-remove-btn"
                >
                  <template #icon>
                    <DeleteOutlined aria-hidden="true" />
                  </template>
                  删除
                </a-button>
              </div>
              <a-button
                v-if="can('k8s.node.taintAdd')"
                type="dashed"
                @click="addTaint"
                block
                style="margin-top: 12px"
              >
                <template #icon><PlusOutlined aria-hidden="true" /></template>
                添加污点
              </a-button>
            </div>
          </a-form-item-rest>
        </a-form-item>

        <a-divider>YAML 配置验证</a-divider>

        <a-form-item
          help="可选：输入污点的 YAML 配置进行验证"
          label="YAML 数据"
        >
          <a-form-item-rest>
            <a-textarea
              v-model:value="taintYamlData"
              :rows="6"
              placeholder="taints:
  - key: node-role.kubernetes.io/master
    effect: NoSchedule
  - key: dedicated
    value: gpu
    effect: NoExecute"
              style="font-family: monospace; margin-bottom: 8px"
            />
            <a-button
              type="default"
              @click="handleValidateYaml"
              :loading="yamlValidating"
              :disabled="!taintYamlData || !taintYamlData.trim()"
            >
              <template #icon><CheckOutlined aria-hidden="true" /></template>
              验证 YAML
            </a-button>
          </a-form-item-rest>
        </a-form-item>
      </a-form>
    </a-modal>

    <!-- 驱逐节点模态框 -->
    <a-modal
      v-model:open="isDrainModalVisible"
      :autoFocus="false"
      :confirmLoading="submitLoading"
      :focusTriggerAfterClose="false"
      :keyboard="true"
      :maskClosable="false"
      cancelText="取消"
      destroyOnClose
      okText="确认驱逐"
      title="驱逐节点 (Drain Node)"
      width="650px"
      @cancel="closeDrainModal"
      @ok="submitDrainForm"
    >
      <a-form
        ref="drainFormRef"
        :model="drainFormModel"
        :rules="drainFormRules"
        class="k8s-form"
        layout="vertical"
      >
        <a-alert
          message="警告：驱逐节点将安全迁移该节点上的所有 Pod"
          show-icon
          style="margin-bottom: 20px"
          type="warning"
        >
          <template #description>
            <div>
              驱逐（Drain）操作会：
              <ul style="margin: 8px 0 0 0; padding-left: 20px">
                <li>先将节点标记为不可调度（Cordon）</li>
                <li>然后安全地驱逐节点上的所有 Pod</li>
                <li>等待 Pod 在其他节点上重新调度</li>
              </ul>
              <div style="margin-top: 8px; color: #d4380d">
                <strong>请谨慎操作！</strong>确保业务可以承受 Pod
                迁移带来的影响，建议在维护窗口期间执行。
              </div>
            </div>
          </template>
        </a-alert>

        <a-row :gutter="16">
          <a-col :sm="12" :xs="24">
            <a-form-item name="force">
              <template #label>
                <span
                  >强制驱逐
                  <a-tag color="orange" size="small">慎用</a-tag></span
                >
              </template>
              <a-radio-group v-model:value="drainFormModel.force">
                <a-radio :value="1">是</a-radio>
                <a-radio :value="2">否（推荐）</a-radio>
              </a-radio-group>
              <div
                style="
                  color: var(--ops-muted);
                  font-size: 12px;
                  margin-top: 4px;
                "
              >
                强制驱逐将忽略 PodDisruptionBudget（PDB），可能影响服务可用性
              </div>
            </a-form-item>
          </a-col>
          <a-col :sm="12" :xs="24">
            <a-form-item name="ignore_daemon_sets">
              <template #label>
                <span
                  >忽略 DaemonSet
                  <a-tag color="green" size="small">推荐</a-tag></span
                >
              </template>
              <a-radio-group v-model:value="drainFormModel.ignore_daemon_sets">
                <a-radio :value="1">是（推荐）</a-radio>
                <a-radio :value="2">否</a-radio>
              </a-radio-group>
              <div
                style="
                  color: var(--ops-muted);
                  font-size: 12px;
                  margin-top: 4px;
                "
              >
                DaemonSet Pod 会在每个节点上运行，通常应忽略
              </div>
            </a-form-item>
          </a-col>
        </a-row>

        <a-row :gutter="16">
          <a-col :sm="12" :xs="24">
            <a-form-item name="delete_local_data">
              <template #label>
                <span
                  >删除本地数据
                  <a-tag color="orange" size="small">注意</a-tag></span
                >
              </template>
              <a-radio-group v-model:value="drainFormModel.delete_local_data">
                <a-radio :value="1">是</a-radio>
                <a-radio :value="2">否（推荐）</a-radio>
              </a-radio-group>
              <div
                style="
                  color: var(--ops-muted);
                  font-size: 12px;
                  margin-top: 4px;
                "
              >
                允许删除使用 emptyDir 卷的 Pod（本地数据会丢失）
              </div>
            </a-form-item>
          </a-col>
          <a-col :sm="12" :xs="24">
            <a-form-item label="优雅关闭时间 (秒)" name="grace_period_seconds">
              <a-input-number
                v-model:value="drainFormModel.grace_period_seconds"
                :max="3600"
                :min="0"
                :step="10"
                class="k8s-form-input"
                placeholder="30"
                style="width: 100%"
              />
              <div
                style="
                  color: var(--ops-muted);
                  font-size: 12px;
                  margin-top: 4px;
                "
              >
                Pod 优雅停止的等待时间（默认 30 秒）
              </div>
            </a-form-item>
          </a-col>
        </a-row>

        <a-form-item label="超时时间 (秒)" name="timeout_seconds">
          <a-input-number
            v-model:value="drainFormModel.timeout_seconds"
            :max="7200"
            :min="30"
            :step="30"
            class="k8s-form-input"
            placeholder="300"
            style="width: 100%"
          />
          <div
            style="color: var(--ops-muted); font-size: 12px; margin-top: 4px"
          >
            驱逐操作的最大等待时间（默认 300 秒），超时后操作将失败
          </div>
        </a-form-item>
      </a-form>
    </a-modal>

    <!-- 详情模态框 -->
    <a-modal
      v-model:open="isDetailModalVisible"
      :autoFocus="false"
      :focusTriggerAfterClose="false"
      :footer="null"
      :keyboard="true"
      :maskClosable="false"
      destroyOnClose
      title="节点详情 (Node Details)"
      width="1000px"
      @cancel="closeDetailModal"
    >
      <a-spin :spinning="detailLoading">
        <div v-if="currentNodeDetail" class="k8s-detail-content">
          <a-row :gutter="[24, 16]">
            <a-col :lg="12" :xs="24">
              <a-card class="k8s-detail-card" size="small" title="基本信息">
                <div class="k8s-detail-item">
                  <span class="k8s-detail-label">节点名称:</span>
                  <span class="k8s-detail-value">{{
                    currentNodeDetail.name || '-'
                  }}</span>
                </div>
                <div class="k8s-detail-item">
                  <span class="k8s-detail-label">状态:</span>
                  <a-badge
                    :status="getStatusColor(currentNodeDetail.status)"
                    :text="getStatusText(currentNodeDetail.status)"
                  />
                </div>
                <div class="k8s-detail-item">
                  <span class="k8s-detail-label">调度状态:</span>
                  <a-badge
                    :status="getSchedulableColor(currentNodeDetail.schedulable)"
                    :text="getSchedulableText(currentNodeDetail.schedulable)"
                  />
                </div>
                <div
                  v-if="
                    currentNodeDetail.roles &&
                    currentNodeDetail.roles.length > 0
                  "
                  class="k8s-detail-item"
                >
                  <span class="k8s-detail-label">角色:</span>
                  <span class="k8s-detail-value">{{
                    currentNodeDetail.roles.join(', ')
                  }}</span>
                </div>
                <div v-if="currentNodeDetail.age" class="k8s-detail-item">
                  <span class="k8s-detail-label">运行时间:</span>
                  <span class="k8s-detail-value">{{
                    currentNodeDetail.age
                  }}</span>
                </div>
                <div
                  v-if="currentNodeDetail.internal_ip"
                  class="k8s-detail-item"
                >
                  <span class="k8s-detail-label">内部IP:</span>
                  <span class="k8s-detail-value">{{
                    currentNodeDetail.internal_ip
                  }}</span>
                </div>
                <div
                  class="k8s-detail-item"
                  v-if="
                    currentNodeDetail.external_ip &&
                    currentNodeDetail.external_ip.trim()
                  "
                >
                  <span class="k8s-detail-label">外部IP:</span>
                  <span class="k8s-detail-value">{{
                    currentNodeDetail.external_ip
                  }}</span>
                </div>
                <div v-if="currentNodeDetail.hostname" class="k8s-detail-item">
                  <span class="k8s-detail-label">主机名:</span>
                  <span class="k8s-detail-value">{{
                    currentNodeDetail.hostname
                  }}</span>
                </div>
              </a-card>
            </a-col>

            <a-col :lg="12" :xs="24">
              <a-card class="k8s-detail-card" size="small" title="系统信息">
                <div
                  v-if="currentNodeDetail.kubelet_version"
                  class="k8s-detail-item"
                >
                  <span class="k8s-detail-label">Kubelet版本:</span>
                  <span class="k8s-detail-value">{{
                    currentNodeDetail.kubelet_version
                  }}</span>
                </div>
                <div
                  class="k8s-detail-item"
                  v-if="
                    currentNodeDetail.kube_proxy_version &&
                    currentNodeDetail.kube_proxy_version.trim()
                  "
                >
                  <span class="k8s-detail-label">KubeProxy版本:</span>
                  <span class="k8s-detail-value">{{
                    currentNodeDetail.kube_proxy_version
                  }}</span>
                </div>
                <div
                  v-if="currentNodeDetail.container_runtime"
                  class="k8s-detail-item"
                >
                  <span class="k8s-detail-label">容器运行时:</span>
                  <span class="k8s-detail-value">{{
                    currentNodeDetail.container_runtime
                  }}</span>
                </div>
                <div
                  v-if="currentNodeDetail.operating_system"
                  class="k8s-detail-item"
                >
                  <span class="k8s-detail-label">操作系统:</span>
                  <span class="k8s-detail-value">{{
                    currentNodeDetail.operating_system
                  }}</span>
                </div>
                <div
                  v-if="currentNodeDetail.architecture"
                  class="k8s-detail-item"
                >
                  <span class="k8s-detail-label">系统架构:</span>
                  <span class="k8s-detail-value">{{
                    currentNodeDetail.architecture
                  }}</span>
                </div>
                <div
                  v-if="currentNodeDetail.kernel_version"
                  class="k8s-detail-item"
                >
                  <span class="k8s-detail-label">内核版本:</span>
                  <span class="k8s-detail-value">{{
                    currentNodeDetail.kernel_version
                  }}</span>
                </div>
                <div v-if="currentNodeDetail.os_image" class="k8s-detail-item">
                  <span class="k8s-detail-label">系统镜像:</span>
                  <span class="k8s-detail-value">{{
                    currentNodeDetail.os_image
                  }}</span>
                </div>
                <div
                  class="k8s-detail-item"
                  v-if="!hasSystemInfo(currentNodeDetail)"
                  style="
                    text-align: center;
                    color: var(--ops-muted);
                    padding: 20px;
                  "
                >
                  暂无系统信息
                </div>
              </a-card>
            </a-col>
          </a-row>

          <a-row :gutter="[24, 16]" style="margin-top: 16px">
            <a-col :lg="12" :xs="24">
              <a-card class="k8s-detail-card" size="small" title="标签信息">
                <div
                  class="k8s-labels-display"
                  style="max-height: 300px; overflow-y: auto"
                >
                  <template
                    v-if="
                      currentNodeDetail.labels &&
                      Object.keys(currentNodeDetail.labels).length > 0
                    "
                  >
                    <div
                      v-for="(value, key) in currentNodeDetail.labels"
                      :key="key"
                      class="k8s-detail-kv-item"
                    >
                      <span class="k8s-kv-key">{{ key }}</span>
                      <span class="k8s-kv-separator">:</span>
                      <span class="k8s-kv-value">{{ value }}</span>
                    </div>
                  </template>
                  <div
                    v-else
                    style="
                      text-align: center;
                      color: var(--ops-muted);
                      padding: 20px;
                    "
                  >
                    暂无标签
                  </div>
                </div>
              </a-card>
            </a-col>

            <a-col :lg="12" :xs="24">
              <a-card class="k8s-detail-card" size="small" title="污点信息">
                <div
                  class="k8s-taints-display"
                  style="max-height: 300px; overflow-y: auto"
                >
                  <template
                    v-if="
                      currentNodeDetail.taints &&
                      currentNodeDetail.taints.length > 0
                    "
                  >
                    <div
                      v-for="(taint, index) in currentNodeDetail.taints"
                      :key="index"
                      class="k8s-detail-taint-item"
                    >
                      <div><strong>键:</strong> {{ taint.key }}</div>
                      <div><strong>效果:</strong> {{ taint.effect }}</div>
                      <div v-if="taint.value">
                        <strong>值:</strong> {{ taint.value }}
                      </div>
                    </div>
                  </template>
                  <div
                    v-else
                    style="
                      text-align: center;
                      color: var(--ops-muted);
                      padding: 20px;
                    "
                  >
                    暂无污点
                  </div>
                </div>
              </a-card>
            </a-col>
          </a-row>

          <a-row
            :gutter="[24, 16]"
            style="margin-top: 16px"
            v-if="
              currentNodeDetail.annotations &&
              Object.keys(currentNodeDetail.annotations).length > 0
            "
          >
            <a-col :span="24">
              <a-card class="k8s-detail-card" size="small" title="注解信息">
                <div
                  class="k8s-annotations-display"
                  style="max-height: 200px; overflow-y: auto"
                >
                  <div
                    v-for="(value, key) in currentNodeDetail.annotations"
                    :key="key"
                    class="k8s-detail-kv-item"
                  >
                    <span class="k8s-kv-key">{{ key }}</span>
                    <span class="k8s-kv-separator">:</span>
                    <span class="k8s-kv-value">{{ value }}</span>
                  </div>
                </div>
              </a-card>
            </a-col>
          </a-row>

          <a-row
            v-if="
              currentNodeDetail.conditions &&
              currentNodeDetail.conditions.length > 0
            "
            style="margin-top: 16px"
          >
            <a-col :span="24">
              <a-card class="k8s-detail-card" size="small" title="节点状况">
                <a-table
                  :columns="conditionColumns"
                  :data-source="currentNodeDetail.conditions"
                  :pagination="false"
                  :scroll="{ x: 800 }"
                  row-key="type"
                  size="small"
                >
                  <template #bodyCell="{ column, text }">
                    <template v-if="column.key === 'status'">
                      <a-badge
                        :status="
                          text === 'True'
                            ? 'success'
                            : text === 'False'
                              ? 'default'
                              : 'error'
                        "
                        :text="text"
                      />
                    </template>
                  </template>
                  <template #emptyText>
                    <div
                      style="
                        text-align: center;
                        color: var(--ops-muted);
                        padding: 20px;
                      "
                    >
                      暂无节点状况信息
                    </div>
                  </template>
                </a-table>
              </a-card>
            </a-col>
          </a-row>
        </div>
      </a-spin>
    </a-modal>
  </OpsPage>
</template>

<script lang="ts" setup>
import OpsPage from '#/components/ops/OpsPage.vue';
import { clusterResourceKey } from '../shared/utils';
import { onMounted, ref } from 'vue';
import { message } from 'ant-design-vue';
import { useNodePage } from './Node';
import { formatDateTime, getRelativeTime } from '../shared/utils';
import {
  CheckOutlined,
  DeleteOutlined,
  DeploymentUnitOutlined,
  DisconnectOutlined,
  EyeOutlined,
  FilterOutlined,
  NodeIndexOutlined,
  PlayCircleOutlined,
  PlusOutlined,
  ReloadOutlined,
  SearchOutlined,
  StopOutlined,
  TagsOutlined,
  WarningOutlined,
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
  filterStatus,
  filterClusterId,
  selectedRows,
  currentPage,
  pageSize,

  // modal state
  isLabelModalVisible,
  isTaintModalVisible,
  isDrainModalVisible,
  submitLoading,

  // detail modal
  isDetailModalVisible,
  detailLoading,
  currentNodeDetail,

  // form models
  labelFormModel,
  taintFormModel,
  drainFormModel,

  // form refs
  labelFormRef,
  taintFormRef,
  drainFormRef,

  // form rules
  labelFormRules,
  taintFormRules,
  drainFormRules,

  // computed
  filteredNodes,
  rowSelection,

  // helpers
  getEnvText,
  getStatusText,
  getStatusColor,
  getSchedulableText,
  getSchedulableColor,

  // operations
  fetchClusters,
  fetchNodes,
  clearNodes,
  showNodeDetail,
  closeDetailModal,

  // label operations
  openEditLabelModal,
  closeLabelModal,
  submitLabelForm,
  removeLabelField,

  // taint operations
  openTaintModal,
  closeTaintModal,
  addTaint,
  removeTaint,
  isNewTaint,
  submitTaintForm,
  hasTaintChanges,
  validateTaintYaml,

  // schedule operations
  toggleNodeSchedule,

  // drain operations
  openDrainModal,
  closeDrainModal,
  submitDrainForm,

  // batch operations
  batchOperation,

  // cluster pagination
  loadMoreClusters,
  handlePageChange,

  // pagination state
  total,
  clustersTotal,

  // constants
  NodeStatus,
} = useNodePage();

// 添加新标签的临时状态
const newLabelKey = ref('');
const newLabelValue = ref('');

// YAML 验证相关状态
const taintYamlData = ref('');
const yamlValidating = ref(false);

const handleValidateYaml = async () => {
  if (!taintYamlData.value || !taintYamlData.value.trim()) {
    message.warning('请输入 YAML 数据');
    return;
  }

  yamlValidating.value = true;
  try {
    await validateTaintYaml(taintYamlData.value);
  } finally {
    yamlValidating.value = false;
  }
};

const addNewLabel = () => {
  if (!newLabelKey.value || !newLabelKey.value.trim()) return;
  const key = newLabelKey.value.trim();
  const value = newLabelValue.value || '';

  // 先获取所有现有的键，然后重建对象确保新键在最后
  const existingKeys = Object.keys(labelFormModel.value.labels);
  const newLabels: Record<string, string> = {};

  // 先添加所有现有的标签（排除要添加的键，以防重复）
  existingKeys.forEach((k) => {
    if (k !== key) {
      newLabels[k] = labelFormModel.value.labels[k] || '';
    }
  });

  // 最后添加新标签
  newLabels[key] = value;

  labelFormModel.value.labels = newLabels;
  newLabelKey.value = '';
  newLabelValue.value = '';
};

const onSearch = () => {
  currentPage.value = 1;
  fetchNodes();
};

const handleFilterChange = () => {
  currentPage.value = 1;
  fetchNodes();
};

// 重置所有筛选条件
const resetFilters = () => {
  filterStatus.value = undefined;
  filterClusterId.value = undefined;
  searchText.value = '';
  currentPage.value = 1;
  // 清空节点列表
  clearNodes();
};

const handleClusterChange = () => {
  currentPage.value = 1;
  if (filterClusterId.value) {
    fetchNodes();
  } else {
    // 清空节点列表和选择状态
    clearNodes();
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

// 已弃用的函数：分页组件统一通过 handleTableChange 处理

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
    // 当滚动到底部附近时加载更多
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
    title: '状态',
    dataIndex: 'status',
    key: 'status',
    width: 90,
    align: 'center',
  },
  {
    title: '调度',
    dataIndex: 'schedulable',
    key: 'schedulable',
    width: 90,
    align: 'center',
  },
  { title: '角色', dataIndex: 'roles', key: 'roles', width: 120 },
  {
    title: '运行时间',
    dataIndex: 'age',
    key: 'age',
    width: 110,
    align: 'center',
  },
  {
    title: '内部IP',
    dataIndex: 'internal_ip',
    key: 'internal_ip',
    width: 130,
    ellipsis: true,
  },
  {
    title: 'Kubelet',
    dataIndex: 'kubelet_version',
    key: 'kubelet_version',
    width: 120,
    align: 'center',
    ellipsis: true,
  },
  {
    title: '系统',
    dataIndex: 'os_image',
    key: 'os_image',
    width: 140,
    align: 'center',
    ellipsis: true,
  },
  { title: '标签', dataIndex: 'labels', key: 'labels', width: 150 },
  { title: '注解', dataIndex: 'annotations', key: 'annotations', width: 120 },
  { title: 'UID', dataIndex: 'uid', key: 'uid', width: 100, ellipsis: true },
  { title: '创建时间', dataIndex: 'created_at', key: 'created_at', width: 160 },
  {
    title: '操作',
    key: 'actions',
    width: 280,
    fixed: 'right',
    align: 'center',
  },
];

const conditionColumns = [
  { title: '类型', dataIndex: 'type', key: 'type', width: '15%' },
  { title: '状态', dataIndex: 'status', key: 'status', width: '10%' },
  { title: '原因', dataIndex: 'reason', key: 'reason', width: '20%' },
  {
    title: '消息',
    dataIndex: 'message',
    key: 'message',
    width: '35%',
    ellipsis: true,
  },
  {
    title: '最后更新',
    dataIndex: 'lastTransitionTime',
    key: 'lastTransitionTime',
    width: '20%',
  },
];

// 检查是否有系统信息
const hasSystemInfo = (node: any) => {
  return (
    node.kubelet_version ||
    (node.kube_proxy_version && node.kube_proxy_version.trim()) ||
    node.container_runtime ||
    node.operating_system ||
    node.architecture ||
    node.kernel_version ||
    node.os_image
  );
};

onMounted(async () => {
  // 页面加载时首先获取集群列表
  await fetchClusters();
});
</script>

<style scoped>
@import '../shared/k8s-common.css';
</style>

<style scoped src="./Node.css"></style>
