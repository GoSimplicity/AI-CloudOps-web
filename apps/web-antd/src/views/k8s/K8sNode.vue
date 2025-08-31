<template>
  <div class="cluster-management-container node-management-container">
    <!-- 页面头部 -->
    <div class="page-header">
      <div class="header-content">
        <div class="title-section">
          <div class="page-title">
            <ClusterOutlined class="title-icon" />
            <h1>Kubernetes 节点管理</h1>
          </div>
          <p class="page-subtitle">管理和监控集群中的所有Kubernetes节点</p>
        </div>
        <div class="header-actions">
          <a-button type="primary" size="large" @click="refreshData" :loading="loading">
            <template #icon>
              <ReloadOutlined />
            </template>
            刷新数据
          </a-button>
        </div>
      </div>
    </div>

    <!-- 数据概览卡片 -->
    <div class="overview-cards">
      <div class="overview-card total-clusters">
        <div class="card-icon">
          <DashboardOutlined />
        </div>
        <div class="card-info">
          <div class="card-number">{{ nodes.length }}</div>
          <div class="card-label">节点总数</div>
        </div>
      </div>

      <div class="overview-card running-clusters">
        <div class="card-icon">
          <CheckCircleOutlined />
        </div>
        <div class="card-info">
          <div class="card-number">{{ healthyNodes }}</div>
          <div class="card-label">健康节点</div>
        </div>
      </div>

      <div class="overview-card env-types">
        <div class="card-icon">
          <WarningOutlined />
        </div>
        <div class="card-info">
          <div class="card-number">{{ warningNodes + errorNodes }}</div>
          <div class="card-label">问题节点</div>
        </div>
      </div>

      <div class="overview-card resource-usage">
        <div class="card-icon">
          <ClusterOutlined />
        </div>
        <div class="card-info">
          <div class="card-number">{{ clusters.find(c => c.id === selectedCluster)?.name || '-' }}</div>
          <div class="card-label">当前集群</div>
        </div>
      </div>
    </div>

    <!-- 操作工具栏 -->
    <div class="toolbar">
      <div class="toolbar-left">
        <a-select v-model:value="selectedCluster" placeholder="选择集群" class="env-filter cluster-selector"
          :loading="clustersLoading" @change="handleClusterChange">
          <template #suffixIcon>
            <ClusterOutlined />
          </template>
          <a-select-option v-for="cluster in runningClusters" :key="cluster.id" :value="cluster.id">
            <span class="cluster-option">
              <CloudServerOutlined />
              {{ cluster.name }}
              <a-tag color="green" size="small">运行中</a-tag>
            </span>
          </a-select-option>
        </a-select>

        <a-input-search v-model:value="searchText" placeholder="搜索节点名称、IP或角色" class="search-input"
          @search="handleSearchChange" allow-clear />

        <a-select v-model:value="statusFilter" placeholder="状态筛选" class="env-filter" allow-clear
          @change="handleSearchChange">
          <a-select-option value="Ready">
            <span class="status-option">
              <CheckCircleOutlined style="color: #52c41a" />
              正常
            </span>
          </a-select-option>
          <a-select-option value="NotReady">
            <span class="status-option">
              <StopOutlined style="color: #f5222d" />
              异常
            </span>
          </a-select-option>
          <a-select-option value="Unknown">
            <span class="status-option">
              <WarningOutlined style="color: #faad14" />
              未知
            </span>
          </a-select-option>
        </a-select>

        <a-select v-model:value="roleFilter" placeholder="角色筛选" class="env-filter" allow-clear
          @change="handleSearchChange">
          <a-select-option value="master">
            <span class="role-option">
              <CrownOutlined style="color: #722ed1" />
              Master
            </span>
          </a-select-option>
          <a-select-option value="worker">
            <span class="role-option">
              <CodeSandboxOutlined style="color: #1890ff" />
              Worker
            </span>
          </a-select-option>
        </a-select>
      </div>

      <div class="toolbar-right">
        <a-dropdown>
          <a-button type="primary">
            <template #icon>
              <SettingOutlined />
            </template>
            节点管理
            <DownOutlined />
          </a-button>
          <template #overlay>
            <a-menu>
              <a-menu-item key="1" @click="handleClearTaints">
                <ClearOutlined /> 清空 Taint
              </a-menu-item>
            </a-menu>
          </template>
        </a-dropdown>

        <a-button type="primary" danger @click="handleToggleSchedule()" :disabled="!hasSelectedNode">
          <template #icon>
            <ScheduleOutlined />
          </template>
          启用/禁用调度
        </a-button>
      </div>
    </div>

    <!-- 数据展示区域 -->
    <div class="data-display">
      <div class="display-header" v-if="filteredData.length > 0">
        <div class="result-info">
          <span class="result-count">共 {{ filteredData.length }} 个节点</span>
          <div class="env-tags">
            <a-tag color="green">健康 {{ healthyNodes }}</a-tag>
            <a-tag color="orange" v-if="warningNodes > 0">警告 {{ warningNodes }}</a-tag>
            <a-tag color="red" v-if="errorNodes > 0">错误 {{ errorNodes }}</a-tag>
          </div>
        </div>
      </div>

      <!-- 表格视图 -->
      <a-table :columns="columns" :data-source="filteredData" :row-selection="{
        type: 'radio',
        onChange: onSelectChange,
        selectedRowKeys: selectedRowKeys
      }" :loading="loading" row-key="name" :pagination="{
        current: currentPage,
        pageSize: pageSize,
        total: totalNodes,
        showSizeChanger: true,
        showQuickJumper: true,
        showTotal: (total: number) => `共 ${total} 条数据`,
        pageSizeOptions: ['12', '24', '48', '96'],
        onChange: handlePageChange,
        onShowSizeChange: handlePageChange
      }" class="cluster-table node-table">
        <!-- 通用的表格单元格渲染 -->
        <template #bodyCell="{ column, record, text }">
          <!-- 节点名称列 -->
          <template v-if="column.key === 'name'">
            <div class="cluster-name node-name">
              <div class="node-status-dot" :class="getNodeStatusClass(record.status)"></div>
              <span>{{ text }}</span>
            </div>
          </template>

          <!-- 状态列 -->
          <template v-else-if="column.key === 'status'">
            <a-tag :color="getStatusColor(record.status)" class="status-tag">
              <span class="status-dot"></span>
              {{ getStatusText(record.status) }}
            </a-tag>
          </template>

          <!-- IP地址列 -->
          <template v-else-if="column.key === 'ip'">
            <div class="timestamp ip-address">
              <GlobalOutlined />
              <span>{{ record.internal_ip || record.external_ip || '-' }}</span>
            </div>
          </template>

          <!-- 角色列 -->
          <template v-else-if="column.key === 'roles'">
            <div class="roles-cell">
              <template v-if="record.roles && record.roles.length > 0">
                <a-tag v-for="role in record.roles" :key="role" :color="getRoleColor(role)" class="env-tag role-tag">
                  <span class="status-dot"></span>
                  {{ role }}
                </a-tag>
              </template>
              <a-tag v-else color="default" class="env-tag role-tag">
                <span class="status-dot"></span>
                未知
              </a-tag>
            </div>
          </template>

          <!-- 创建时间列 -->
          <template v-else-if="column.key === 'age'">
            <div class="timestamp">
              <ClockCircleOutlined />
              <span>{{ text }}</span>
            </div>
          </template>

          <!-- 资源使用列 -->
          <template v-else-if="column.key === 'resources'">
            <div class="node-info-cell">
              <a-tooltip :title="`CPU使用率: ${record.cpu?.percent || 0}%`">
                <div class="progress-chart">
                  <div class="chart-icon">
                    <ApiOutlined style="color: #1890ff" />
                  </div>
                  <div class="chart-bar">
                    <div class="chart-fill" :style="`width: ${record.cpu?.percent || 0}%; background-color: #1890ff;`">
                    </div>
                  </div>
                  <span class="chart-title">CPU {{ record.cpu?.percent || 0 }}%</span>
                </div>
              </a-tooltip>
              <a-tooltip :title="`内存使用率: ${record.memory?.percent || 0}%`">
                <div class="progress-chart">
                  <div class="chart-icon">
                    <EnvironmentOutlined style="color: #52c41a" />
                  </div>
                  <div class="chart-bar">
                    <div class="chart-fill" :style="`width: ${record.memory?.percent || 0}%; background-color: #52c41a;`">
                    </div>
                  </div>
                  <span class="chart-title">内存 {{ record.memory?.percent || 0 }}%</span>
                </div>
              </a-tooltip>
              <a-tooltip :title="`存储使用率: ${record.storage?.percent || 0}%`">
                <div class="progress-chart">
                  <div class="chart-icon">
                    <StopOutlined style="color: #722ed1" />
                  </div>
                  <div class="chart-bar">
                    <div class="chart-fill"
                      :style="`width: ${record.storage?.percent || 0}%; background-color: #722ed1;`"></div>
                  </div>
                  <span class="chart-title">存储 {{ record.storage?.percent || 0 }}%</span>
                </div>
              </a-tooltip>
            </div>
          </template>

          <!-- 标签列 -->
          <template v-else-if="column.key === 'labels'">
            <div class="labels-cell">
              <a-tag v-for="(label, index) in getNodeLabels(record)" :key="index" color="blue" class="label-tag">
                {{ label }}
              </a-tag>
              <a-tag v-if="getNodeLabels(record).length > 3" color="blue" class="label-tag">
                +{{ getNodeLabels(record).length - 3 }}
              </a-tag>
            </div>
          </template>

          <!-- 操作列 -->
          <template v-else-if="column.key === 'action'">
            <div class="action-buttons">
              <a-tooltip title="查看详情">
                <a-button type="primary" ghost shape="circle" size="small" @click="handleViewDetails(record)">
                  <template #icon>
                    <EyeOutlined />
                  </template>
                </a-button>
              </a-tooltip>

              <a-tooltip title="删除标签">
                <a-button type="primary" ghost shape="circle" size="small" @click="showDeleteLabelModal(record)">
                  <template #icon>
                    <TagOutlined />
                  </template>
                </a-button>
              </a-tooltip>

              <a-tooltip :title="record.schedulable === 1 ? '禁用调度' : '启用调度'">
                <a-button :type="record.schedulable === 1 ? 'primary' : 'primary'" :ghost="record.schedulable === 1"
                  :danger="record.schedulable !== 1" shape="circle" size="small" @click="handleToggleSchedule(record)">
                  <template #icon>
                    <PauseOutlined v-if="record.schedulable === 1" />
                    <CaretRightOutlined v-else />
                  </template>
                </a-button>
              </a-tooltip>

              <a-dropdown>
                <a-button type="primary" ghost shape="circle" size="small">
                  <template #icon>
                    <MoreOutlined />
                  </template>
                </a-button>
                <template #overlay>
                  <a-menu>
                    <a-menu-item key="1" @click="handleAddLabel(record)">
                      <TagOutlined /> 添加标签
                    </a-menu-item>
                    <a-menu-item key="2" @click="handleAddTaint(record)">
                      <WarningOutlined /> 添加 Taint
                    </a-menu-item>
                    <a-menu-item key="3" @click="handleDeleteTaint(record)">
                      <DeleteOutlined /> 删除 Taint
                    </a-menu-item>
                    <a-menu-divider />
                    <a-menu-item key="4" @click="handleCordon(record)" danger>
                      <StopOutlined /> 维护模式
                    </a-menu-item>
                  </a-menu>
                </template>
              </a-dropdown>
            </div>
          </template>
        </template>

        <!-- 空状态 -->
        <template #emptyText>
          <div class="empty-state">
            <ClusterOutlined style="font-size: 48px; color: #d9d9d9; margin-bottom: 16px" />
            <p>暂无节点数据</p>
            <a-button type="primary" @click="refreshData">刷新数据</a-button>
          </div>
        </template>
      </a-table>
    </div>

    <!-- 添加标签模态框 -->
    <a-modal v-model:open="isAddLabelModalVisible" title="添加节点标签" :width="800" @ok="handleSubmitAddLabel"
      @cancel="closeAddLabelModal" :confirmLoading="submitLoading" class="cluster-modal node-modal">
      <a-alert type="info" show-icon class="modal-alert">
        <template #message>添加节点标签</template>
        <template #description>节点标签可用于 Pod 调度及资源分配</template>
      </a-alert>

      <a-form :model="labelForm" layout="vertical" class="cluster-form node-form">
        <a-form-item label="节点名称" name="nodeName" :rules="[{ required: true, message: '请选择节点名称' }]">
          <a-select v-model:value="labelForm.nodeName" placeholder="请选择节点名称" show-search :loading="nodeOptionsLoading"
            :search-value="nodeSearchValue" @search="handleNodeSearch"
            @dropdown-visible-change="(open: boolean) => open && loadNodeOptions('', true)"
            @popup-scroll="handleNodePopupScroll" :filter-option="false" class="form-select">
            <template #suffixIcon>
              <ClusterOutlined />
            </template>
            <a-select-option v-for="node in nodeOptions" :key="node.name" :value="node.name">
              <span class="node-option">
                <ClusterOutlined />
                {{ node.name }}
              </span>
            </a-select-option>
            <a-select-option v-if="nodeOptionsLoading" disabled key="loading">
              <div style="text-align: center; padding: 8px;">
                <a-spin size="small" /> 加载中...
              </div>
            </a-select-option>
          </a-select>
        </a-form-item>

        <a-row :gutter="16">
          <a-col :span="12">
            <a-form-item label="标签键" name="key" :rules="[{ required: true, message: '请输入标签键' }]">
              <a-input v-model:value="labelForm.key" placeholder="请输入标签键" class="form-input">
                <template #prefix>
                  <TagOutlined />
                </template>
              </a-input>
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item label="标签值" name="value" :rules="[{ required: true, message: '请输入标签值' }]">
              <a-input v-model:value="labelForm.value" placeholder="请输入标签值" class="form-input">
                <template #prefix>
                  <TagsOutlined />
                </template>
              </a-input>
            </a-form-item>
          </a-col>
        </a-row>

        <a-form-item>
          <a-alert type="warning" show-icon message="注意: 添加标签可能会影响现有的 Pod 调度" />
        </a-form-item>
      </a-form>
    </a-modal>

    <!-- 添加Taint模态框 -->
    <a-modal v-model:open="isAddTaintModalVisible" title="添加节点 Taint" :width="800" @ok="handleSubmitAddTaint"
      @cancel="closeAddTaintModal" :confirmLoading="submitLoading" class="cluster-modal node-modal">
      <a-alert type="info" show-icon class="modal-alert">
        <template #message>添加节点 Taint</template>
        <template #description>Taint 用于阻止 Pod 调度到节点上</template>
      </a-alert>

      <a-form :model="taintForm" layout="vertical" class="cluster-form node-form">
        <a-form-item label="节点名称" name="nodeName" :rules="[{ required: true, message: '请选择节点名称' }]">
          <a-select v-model:value="taintForm.nodeName" placeholder="请选择节点名称" show-search :loading="nodeOptionsLoading"
            :search-value="nodeSearchValue" @search="handleNodeSearch"
            @dropdown-visible-change="(open: boolean) => open && loadNodeOptions('', true)"
            @popup-scroll="handleNodePopupScroll" :filter-option="false" class="form-select">
            <template #suffixIcon>
              <ClusterOutlined />
            </template>
            <a-select-option v-for="node in nodeOptions" :key="node.name" :value="node.name">
              <span class="node-option">
                <ClusterOutlined />
                {{ node.name }} ({{ node.internal_ip || node.external_ip || '-' }})
              </span>
            </a-select-option>
            <a-select-option v-if="nodeOptionsLoading" disabled key="loading">
              <div style="text-align: center; padding: 8px;">
                <a-spin size="small" /> 加载中...
              </div>
            </a-select-option>
          </a-select>
        </a-form-item>

        <a-form-item label="Taint YAML" name="taintYaml" :rules="[{ required: true, message: '请输入 Taint YAML' }]">
          <div class="yaml-actions">
            <a-button type="primary" size="small" @click="handleCheckTaintYaml(taintForm.nodeName, taintForm.taintYaml)">
              <template #icon>
                <CodeOutlined />
              </template>
              验证 YAML 格式
            </a-button>
            <a-popover title="Taint 效果说明" placement="right">
              <template #content>
                <p><strong>NoSchedule</strong>: 不允许新 Pod 调度</p>
                <p><strong>PreferNoSchedule</strong>: 尽量不调度</p>
                <p><strong>NoExecute</strong>: 驱逐现有 Pod</p>
              </template>
              <a-button size="small">
                <template #icon>
                  <QuestionCircleOutlined />
                </template>
                效果说明
              </a-button>
            </a-popover>
          </div>
          <a-textarea v-model:value="taintForm.taintYaml" :rows="6" :auto-size="{ minRows: 6, maxRows: 10 }"
            placeholder="示例：- key: &quot;example-key&quot;
  value: &quot;example-value&quot; 
  effect: &quot;NoSchedule&quot;" class="form-textarea yaml-editor" />
        </a-form-item>

        <a-form-item>
          <a-alert type="warning" show-icon message="注意: 添加 NoExecute 效果的 Taint 将驱逐不容忍该污点的现有 Pod" />
        </a-form-item>
      </a-form>
    </a-modal>

    <!-- 删除Taint模态框 -->
    <a-modal v-model:open="isDeleteTaintModalVisible" title="删除节点 Taint" :width="800" @ok="handleSubmitDeleteTaint"
      @cancel="closeDeleteTaintModal" :confirmLoading="submitLoading" class="cluster-modal node-modal">
      <a-alert type="info" show-icon class="modal-alert">
        <template #message>删除节点 Taint</template>
        <template #description>输入要删除的 Taint Key（每行一个），删除后将允许 Pod 重新调度到该节点</template>
      </a-alert>

      <a-form :model="deleteTaintForm" layout="vertical" class="cluster-form node-form">
        <a-form-item label="节点名称" name="nodeName" :rules="[{ required: true, message: '请选择节点名称' }]">
          <a-select v-model:value="deleteTaintForm.nodeName" placeholder="请选择节点名称" show-search
            :loading="nodeOptionsLoading" :search-value="nodeSearchValue" @search="handleNodeSearch"
            @dropdown-visible-change="(open: boolean) => open && loadNodeOptions('', true)"
            @popup-scroll="handleNodePopupScroll" :filter-option="false" class="form-select">
            <template #suffixIcon>
              <ClusterOutlined />
            </template>
            <a-select-option v-for="node in nodeOptions" :key="node.name" :value="node.name">
              <span class="node-option">
                <ClusterOutlined />
                {{ node.name }} ({{ node.internal_ip || node.external_ip || '-' }})
              </span>
            </a-select-option>
            <a-select-option v-if="nodeOptionsLoading" disabled key="loading">
              <div style="text-align: center; padding: 8px;">
                <a-spin size="small" /> 加载中...
              </div>
            </a-select-option>
          </a-select>
        </a-form-item>

        <a-form-item label="Taint Keys" name="taintYaml" :rules="[{ required: true, message: '请输入要删除的 Taint Key' }]">
          <div class="yaml-actions">
            <a-button type="primary" size="small" @click="handleCheckTaintYaml(deleteTaintForm.nodeName, deleteTaintForm.taintYaml, true)">
              <template #icon>
                <CodeOutlined />
              </template>
              验证格式
            </a-button>
            <a-popover title="删除说明" placement="right">
              <template #content>
                <p><strong>删除模式</strong>：只需输入 Taint 的 key 即可</p>
                <p>多个 key 请换行输入</p>
                <p>例如：<br/>node.kubernetes.io/not-ready<br/>node.kubernetes.io/unreachable</p>
              </template>
              <a-button size="small">
                <template #icon>
                  <QuestionCircleOutlined />
                </template>
                删除说明
              </a-button>
            </a-popover>
          </div>
          <a-textarea v-model:value="deleteTaintForm.taintYaml" :rows="4" :auto-size="{ minRows: 4, maxRows: 8 }"
            placeholder="请输入要删除的 Taint Key（每行一个）：
node.kubernetes.io/not-ready
node.kubernetes.io/unreachable
example-key" class="form-textarea taint-keys-editor" />
        </a-form-item>
      </a-form>
    </a-modal>

    <!-- 删除标签模态框 -->
    <a-modal v-model:open="isDeleteLabelModalVisible" title="删除节点标签" :width="600" @ok="handleDeleteLabel"
      @cancel="closeDeleteLabelModal" :confirmLoading="submitLoading" class="cluster-modal node-modal">
      <a-alert type="warning" show-icon class="modal-alert">
        <template #message>删除节点标签</template>
        <template #description>删除标签可能会影响依赖此标签的 Pod 调度</template>
      </a-alert>

      <a-form :model="deleteLabelForm" layout="vertical" class="cluster-form node-form">
        <a-form-item label="选择标签" name="label" :rules="[{ required: true, message: '请选择标签' }]">
          <a-select v-model:value="deleteLabelForm.label" placeholder="请选择标签" class="form-select">
            <template #suffixIcon>
              <TagOutlined />
            </template>
            <a-select-option v-for="(label, index) in labelOptions" :key="index" :value="label">
              <span class="label-option">
                <TagOutlined />
                {{ label }}
              </span>
            </a-select-option>
          </a-select>
        </a-form-item>
      </a-form>
    </a-modal>

    <!-- 节点详情模态框 -->
    <a-modal v-model:open="isViewDetailsModalVisible" title="节点详情" width="900px" @cancel="closeViewDetailsModal"
      :footer="null" class="cluster-modal node-detail-modal">
      <a-spin :spinning="detailsLoading">
        <div v-if="selectedNodeDetails" class="node-details">
          <a-alert class="modal-alert" type="info" show-icon>
            <template #message>
              <span>{{ selectedNodeDetails.name }}</span>
            </template>
            <template #description>
              <div>状态: {{ getStatusText(selectedNodeDetails.status) }} | IP: {{ selectedNodeDetails.internal_ip ||
                selectedNodeDetails.external_ip || '-' }}</div>
            </template>
          </a-alert>

          <a-tabs default-active-key="1">
            <a-tab-pane key="1" tab="基本信息">
              <div class="details-grid">
                <div class="detail-card">
                  <h4>
                    <EnvironmentOutlined /> 基础配置
                  </h4>
                  <div class="detail-item">
                    <div class="detail-label">内部IP:</div>
                    <div class="detail-value">{{ selectedNodeDetails.internal_ip || '-' }}</div>
                  </div>
                  <div class="detail-item">
                    <div class="detail-label">外部IP:</div>
                    <div class="detail-value">{{ selectedNodeDetails.external_ip || '-' }}</div>
                  </div>
                  <div class="detail-item">
                    <div class="detail-label">角色:</div>
                    <div class="detail-value">
                      <template v-if="selectedNodeDetails.roles && selectedNodeDetails.roles.length > 0">
                        <a-tag v-for="role in selectedNodeDetails.roles" :key="role" :color="getRoleColor(role)"
                          class="env-tag role-tag">
                          <span class="status-dot"></span>
                          {{ role }}
                        </a-tag>
                      </template>
                      <a-tag v-else color="default" class="env-tag role-tag">
                        <span class="status-dot"></span>
                        未知
                      </a-tag>
                    </div>
                  </div>
                  <div class="detail-item">
                    <div class="detail-label">创建时间:</div>
                    <div class="detail-value">{{ selectedNodeDetails.age }}</div>
                  </div>
                  <div class="detail-item">
                    <div class="detail-label">调度状态:</div>
                    <div class="detail-value">
                      <a-tag :color="selectedNodeDetails.schedulable === 1 ? 'green' : 'red'" class="status-tag">
                        <span class="status-dot"></span>
                        {{ selectedNodeDetails.schedulable === 1 ? '可调度' : '不可调度' }}
                      </a-tag>
                    </div>
                  </div>
                </div>

                <div class="detail-card">
                  <h4>
                    <ApiOutlined /> 资源状态
                  </h4>
                  <div class="detail-item">
                    <div class="detail-label">CPU 请求:</div>
                    <div class="detail-value">{{ selectedNodeDetails.cpu?.requests || '-' }}</div>
                  </div>
                  <div class="detail-item">
                    <div class="detail-label">CPU 使用:</div>
                    <div class="detail-value">{{ selectedNodeDetails.cpu?.used || '-' }} / {{
                      selectedNodeDetails.cpu?.total
                      || '-' }}</div>
                  </div>
                  <div class="detail-item">
                    <div class="detail-label">内存请求:</div>
                    <div class="detail-value">{{ selectedNodeDetails.memory?.requests || '-' }}</div>
                  </div>
                  <div class="detail-item">
                    <div class="detail-label">内存使用:</div>
                    <div class="detail-value">{{ selectedNodeDetails.memory?.used || '-' }} / {{
                      selectedNodeDetails.memory?.total || '-' }}</div>
                  </div>
                  <div class="detail-item">
                    <div class="detail-label">临时存储:</div>
                    <div class="detail-value">{{ selectedNodeDetails.ephemeral_storage?.used || '-' }} / {{
                      selectedNodeDetails.ephemeral_storage?.total || '-' }}</div>
                  </div>
                </div>
              </div>

              <div class="resource-charts">
                <div class="resource-chart">
                  <h4>CPU 使用率</h4>
                  <div class="usage-gauge">
                    <div class="gauge-value">{{ selectedNodeDetails.cpu?.percent || 0 }}%</div>
                    <div class="gauge-bar">
                      <div class="gauge-fill"
                        :style="`width: ${selectedNodeDetails.cpu?.percent || 0}%; background-color: #1890ff;`"></div>
                    </div>
                  </div>
                </div>
                <div class="resource-chart">
                  <h4>内存使用率</h4>
                  <div class="usage-gauge">
                    <div class="gauge-value">{{ selectedNodeDetails.memory?.percent || 0 }}%</div>
                    <div class="gauge-bar">
                      <div class="gauge-fill"
                        :style="`width: ${selectedNodeDetails.memory?.percent || 0}%; background-color: #52c41a;`">
                      </div>
                    </div>
                  </div>
                </div>
                <div class="resource-chart">
                  <h4>存储使用率</h4>
                  <div class="usage-gauge">
                    <div class="gauge-value">{{ selectedNodeDetails.storage?.percent || 0 }}%</div>
                    <div class="gauge-bar">
                      <div class="gauge-fill"
                        :style="`width: ${selectedNodeDetails.storage?.percent || 0}%; background-color: #722ed1;`">
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </a-tab-pane>

            <a-tab-pane key="2" tab="标签和污点">
              <div class="details-grid">
                <div class="detail-card">
                  <div class="card-header">
                    <h4>
                      <TagOutlined /> 节点标签
                    </h4>
                    <a-button type="primary" size="small" @click="handleAddLabel(selectedNodeDetails)">
                      <template #icon>
                        <PlusOutlined />
                      </template>
                      添加标签
                    </a-button>
                  </div>
                  <div class="labels-list">
                    <a-empty v-if="!selectedNodeDetails.labels || Object.keys(selectedNodeDetails.labels).length === 0"
                      description="暂无标签" />
                    <a-tag v-for="([key, value], index) in Object.entries(selectedNodeDetails.labels || {})"
                      :key="index" color="blue" closable @close="handleQuickDeleteLabel(`${key}=${value}`)"
                      class="label-tag">
                      {{ key }}={{ value }}
                    </a-tag>
                  </div>
                </div>

                <div class="detail-card">
                  <div class="card-header">
                    <h4>
                      <WarningOutlined /> 节点污点
                    </h4>
                    <a-button type="primary" size="small" @click="handleAddTaint(selectedNodeDetails)">
                      <template #icon>
                        <PlusOutlined />
                      </template>
                      添加污点
                    </a-button>
                  </div>
                  <div class="taints-list">
                    <a-empty v-if="!selectedNodeDetails.taints || selectedNodeDetails.taints.length === 0"
                      description="暂无污点" />
                    <a-tag v-for="(taint, index) in selectedNodeDetails.taints" :key="index"
                      :color="getTaintColor(`${taint.key}=${taint.value}:${taint.effect}`)" closable
                      @close="handleQuickDeleteTaint(`${taint.key}=${taint.value}:${taint.effect}`)" class="taint-tag">
                      <span class="status-dot"></span>
                      {{ taint.key }}={{ taint.value }}:{{ taint.effect }}
                    </a-tag>
                  </div>
                </div>
              </div>
            </a-tab-pane>

            <a-tab-pane key="3" tab="事件日志">
              <div class="events-container">
                <a-timeline>
                  <a-timeline-item v-for="(event, index) in selectedNodeDetails.events || []" :key="index"
                    :color="getEventColor(event.type)">
                    <div class="event-card">
                      <div class="event-header">
                        <span class="event-reason">{{ event.reason }}</span>
                        <span class="event-time">{{ formatTime(new Date(event.last_timestamp).getTime()) }}</span>
                      </div>
                      <div class="event-message">{{ event.message }}</div>
                      <div class="event-meta">
                        <span><strong>类型:</strong> {{ event.type }}</span>
                        <span><strong>组件:</strong> {{ event.component }}</span>
                        <span><strong>发生次数:</strong> {{ event.count }}</span>
                      </div>
                      <div class="event-time-range">
                        <CalendarOutlined />
                        {{ formatTime(new Date(event.first_timestamp).getTime()) }} - {{ formatTime(new
                          Date(event.last_timestamp).getTime()) }}
                      </div>
                    </div>
                  </a-timeline-item>
                </a-timeline>
                <a-empty v-if="!selectedNodeDetails.events || selectedNodeDetails.events.length === 0"
                  description="暂无事件" />
              </div>
            </a-tab-pane>
          </a-tabs>

          <div class="modal-footer">
            <a-space>
              <a-button @click="closeViewDetailsModal">关闭</a-button>
              <a-button type="primary" ghost @click="refreshNodeDetails(selectedNodeDetails)">
                <template #icon>
                  <ReloadOutlined />
                </template>
                刷新数据
              </a-button>
              <a-button :type="selectedNodeDetails.schedulable === 1 ? 'primary' : 'primary'"
                :ghost="selectedNodeDetails.schedulable !== 1" :danger="selectedNodeDetails.schedulable === 1"
                @click="handleToggleSchedule(selectedNodeDetails)">
                <template #icon>
                  <PauseOutlined v-if="selectedNodeDetails.schedulable === 1" />
                  <CaretRightOutlined v-else />
                </template>
                {{ selectedNodeDetails.schedulable === 1 ? '禁用调度' : '启用调度' }}
              </a-button>
            </a-space>
          </div>
        </div>
      </a-spin>
    </a-modal>
  </div>
</template>

<script lang="ts" setup>
import { computed, ref, reactive, onMounted } from 'vue';
import { message, Modal } from 'ant-design-vue';
import { NodeStatus } from '#/api/core/k8s_node';
import type {
  K8sNode,
  NodeTaint,
  GetNodeListReq
} from '#/api/core/k8s_node';
import { 
  getNodeList, 
  getNodeDetail, 
  addLabelNodes,
  deleteLabelNodes,
  cordonNode,
  uncordonNode, 
  drainNode, 
  addNodeTaints, 
  deleteNodeTaints, 
  checkTaintYaml
} from '#/api/core/k8s_node';
import { getClustersListApi, type K8sCluster, ClusterStatus } from '#/api/core/k8s_cluster';

import {
  EyeOutlined,
  DeleteOutlined,
  ReloadOutlined,
  TagOutlined,
  TagsOutlined,
  WarningOutlined,
  CheckCircleOutlined,
  StopOutlined,
  EnvironmentOutlined,
  ApiOutlined,
  ClusterOutlined,
  CloudServerOutlined,
  DownOutlined,
  PauseOutlined,
  CaretRightOutlined,
  MoreOutlined,
  CodeOutlined,
  QuestionCircleOutlined,
  PlusOutlined,
  ClearOutlined,
  CalendarOutlined,
  ScheduleOutlined,
  SettingOutlined,
  GlobalOutlined,
  ClockCircleOutlined,
  CrownOutlined,
  CodeSandboxOutlined,
  DashboardOutlined,
} from '@ant-design/icons-vue';

// 状态和常量
const loading = ref(false);
const detailsLoading = ref(false);
const submitLoading = ref(false);
const clustersLoading = ref(false);

// 集群相关状态
const clusters = ref<K8sCluster[]>([]);
const selectedCluster = ref<number>();
const nodes = ref<K8sNode[]>([]);
const totalNodes = ref(0);
const currentPage = ref(1);
const pageSize = ref(12);
const searchText = ref('');
const statusFilter = ref<string>('');
const roleFilter = ref<string>('');
const selectedNodeDetails = ref<K8sNode | null>(null);
const selectedRowKeys = ref<string[]>([]);
const selectedNode = ref<K8sNode | null>(null);

// 表单节点选择器的动态加载状态
const nodeOptions = ref<K8sNode[]>([]);
const nodeOptionsLoading = ref(false);
const nodeOptionsPage = ref(1);
const nodeOptionsHasMore = ref(true);
const nodeSearchValue = ref('');

// 模态框控制
const isAddLabelModalVisible = ref(false);
const isAddTaintModalVisible = ref(false);
const isDeleteTaintModalVisible = ref(false);
const isViewDetailsModalVisible = ref(false);
const isDeleteLabelModalVisible = ref(false);

// 表单数据
const labelForm = reactive({
  key: '',
  nodeName: '',
  value: '',
});

const taintForm = reactive({
  nodeName: '',
  taintYaml: '',
});

const deleteTaintForm = reactive({
  nodeName: '',
  taintYaml: '',
});

const deleteLabelForm = reactive({
  label: '',
});

// 计算属性：状态统计
const healthyNodes = computed(() => {
  return nodes.value.filter((node) => node.status === NodeStatus.Ready).length;
});

const warningNodes = computed(() => {
  return nodes.value.filter((node) => node.status === NodeStatus.Unknown).length;
});

const errorNodes = computed(() => {
  return nodes.value.filter((node) => node.status === NodeStatus.NotReady || node.status === NodeStatus.Error).length;
});

// 计算属性：运行中的集群
const runningClusters = computed(() => {
  return clusters.value.filter(cluster => cluster.status === ClusterStatus.Running);
});

// 计算属性：过滤后的节点数据
const filteredData = computed(() => {
  let result = [...nodes.value];

  // 搜索过滤
  if (searchText.value) {
    const searchValue = searchText.value.trim().toLowerCase();
    result = result.filter((node) => {
      return node.name.toLowerCase().includes(searchValue) ||
        node.internal_ip?.toLowerCase().includes(searchValue) ||
        node.external_ip?.toLowerCase().includes(searchValue) ||
        node.hostname?.toLowerCase().includes(searchValue) ||
        (node.roles && node.roles.some(role => role.toLowerCase().includes(searchValue)));
    });
  }

  // 状态过滤
  if (statusFilter.value) {
    const statusValue = statusFilter.value;
    result = result.filter((node) => {
      if (statusValue === 'Ready') return node.status === NodeStatus.Ready;
      if (statusValue === 'NotReady') return node.status === NodeStatus.NotReady;
      if (statusValue === 'Unknown') return node.status === NodeStatus.Unknown;
      return false;
    });
  }

  // 角色过滤
  if (roleFilter.value) {
    result = result.filter((node) => {
      return node.roles && node.roles.some(role => role.toLowerCase().includes(roleFilter.value.toLowerCase()));
    });
  }

  return result;
});


// 计算属性：是否有选中节点
const hasSelectedNode = computed(() => {
  return selectedRowKeys.value.length > 0;
});

// 计算属性：标签选项
const labelOptions = computed(() => {
  if (!selectedNodeDetails.value?.labels) return [];
  
  // 将标签对象转换为 key=value 格式的字符串数组
  return Object.entries(selectedNodeDetails.value.labels).map(([key, value]) => `${key}=${value}`);
});

// 表格列配置
const columns = [
  {
    title: '节点名称',
    dataIndex: 'name',
    key: 'name',
    width: '15%',
    sorter: (a: K8sNode, b: K8sNode) => a.name.localeCompare(b.name),
  },
  {
    title: '状态',
    dataIndex: 'status',
    key: 'status',
    width: '10%',
    filters: [
      { text: '正常', value: 'Ready' },
      { text: '异常', value: 'NotReady' },
      { text: '未知', value: 'Unknown' },
    ],
    onFilter: (value: string, record: K8sNode) => {
      if (value === 'Ready') return record.status === NodeStatus.Ready;
      if (value === 'NotReady') return record.status === NodeStatus.NotReady;
      if (value === 'Unknown') return record.status === NodeStatus.Unknown;
      return false;
    },
  },
  {
    title: 'IP 地址',
    dataIndex: 'internal_ip',
    key: 'ip',
    width: '12%',
  },
  {
    title: '角色',
    dataIndex: 'roles',
    key: 'roles',
    width: '12%',
  },
  {
    title: '创建时间',
    dataIndex: 'age',
    key: 'age',
    width: '10%',
  },
  {
    title: '资源使用',
    key: 'resources',
    width: '20%',
  },
  {
    title: '标签',
    key: 'labels',
    width: '12%',
  },
  {
    title: '操作',
    key: 'action',
    width: '13%',
    fixed: 'right' as const,
  },
];

// 状态颜色映射
const getStatusColor = (status: NodeStatus | undefined): string => {
  if (status === undefined) return 'default';

  switch (status) {
    case NodeStatus.Ready:
      return 'green';
    case NodeStatus.NotReady:
    case NodeStatus.Error:
      return 'red';
    case NodeStatus.Unknown:
      return 'orange';
    case NodeStatus.SchedulingDisabled:
      return 'blue';
    default:
      return 'default';
  }
};

// 节点状态类名
const getNodeStatusClass = (status: NodeStatus | undefined): string => {
  if (status === undefined) return 'status-unknown';

  switch (status) {
    case NodeStatus.Ready:
      return 'status-ready';
    case NodeStatus.NotReady:
    case NodeStatus.Error:
      return 'status-error';
    case NodeStatus.Unknown:
      return 'status-warning';
    case NodeStatus.SchedulingDisabled:
      return 'status-warning';
    default:
      return 'status-unknown';
  }
};

// 状态显示文本映射
const getStatusText = (status: NodeStatus | undefined): string => {
  if (status === undefined) return '未知';

  switch (status) {
    case NodeStatus.Ready:
      return '就绪';
    case NodeStatus.NotReady:
      return '未就绪';
    case NodeStatus.SchedulingDisabled:
      return '调度禁用';
    case NodeStatus.Unknown:
      return '未知';
    case NodeStatus.Error:
      return '异常';
    default:
      return '未知';
  }
};

// 角色颜色映射
const getRoleColor = (role: string): string => {
  if (!role) return 'default';

  const trimmedRole = role.trim().toLowerCase();

  if (trimmedRole.includes('master') || trimmedRole.includes('control')) {
    return 'purple';
  } else if (trimmedRole.includes('worker')) {
    return 'blue';
  } else if (trimmedRole.includes('infra')) {
    return 'orange';
  } else if (trimmedRole.includes('app')) {
    return 'green';
  }

  return 'default';
};

// 事件颜色映射
const getEventColor = (type: string | undefined): string => {
  if (!type) return 'blue';

  const typeMap: Record<string, string> = {
    'Normal': 'green',
    'Warning': 'orange',
    'Error': 'red',
  };

  return typeMap[type] || 'blue';
};


const getTaintColor = (taint: string): string => {
  if (!taint) return 'blue';

  if (taint.includes('NoExecute')) {
    return 'red';
  } else if (taint.includes('NoSchedule')) {
    return 'orange';
  } else if (taint.includes('PreferNoSchedule')) {
    return 'yellow';
  }

  return 'blue';
};

// 获取节点标签
const getNodeLabels = (node: K8sNode): string[] => {
  if (!node || !node.labels) return [];

  // 将标签对象转换为 key=value 格式的数组
  const labelArray = Object.entries(node.labels).map(([key, value]) => `${key}=${value}`);

  // 只显示前3个标签，完整列表在详情中显示
  return labelArray.slice(0, 3);
};

// 格式化时间
const formatTime = (timestamp: number | undefined): string => {
  if (!timestamp) return '-';

  const date = new Date(timestamp);
  return `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}-${date.getDate().toString().padStart(2, '0')} ${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}:${date.getSeconds().toString().padStart(2, '0')}`;
};



// 动态加载节点选项
const loadNodeOptions = async (search?: string, reset = false): Promise<void> => {
  if (nodeOptionsLoading.value) return;

  nodeOptionsLoading.value = true;
  try {
    const cluster_id = selectedCluster.value;
    if (!cluster_id) {
      // 如果没有选择集群，清空节点选项并静默返回
      nodeOptions.value = [];
      return;
    }
    
    const page = reset ? 1 : nodeOptionsPage.value;
    const params: GetNodeListReq = {
      page,
      size: 20, // 每次加载20个
      search: search || undefined,
      cluster_id,
    };

    const res = await getNodeList(params);

    if (res.items) {
      if (reset) {
        nodeOptions.value = res.items;
        nodeOptionsPage.value = 1;
      } else {
        nodeOptions.value = [...nodeOptions.value, ...res.items];
      }

      nodeOptionsHasMore.value = (page * 20) < (res.total || 0);
      nodeOptionsPage.value = page + 1;
    } else {
      const items = Array.isArray(res) ? res : [];
      if (reset) {
        nodeOptions.value = items;
      } else {
        nodeOptions.value = [...nodeOptions.value, ...items];
      }
      nodeOptionsHasMore.value = false;
    }
  } catch (error: any) {
    console.error('加载节点选项失败:', error);
    message.error('加载节点选项失败');
  } finally {
    nodeOptionsLoading.value = false;
  }
};

// 节点搜索处理
const handleNodeSearch = (value: string): void => {
  nodeSearchValue.value = value;
  loadNodeOptions(value, true);
};

// 节点选择器滚动加载
const handleNodePopupScroll = (e: Event): void => {
  const { target } = e;
  if (target && nodeOptionsHasMore.value && !nodeOptionsLoading.value) {
    const element = target as HTMLElement;
    if (element.scrollTop + element.offsetHeight === element.scrollHeight) {
      loadNodeOptions(nodeSearchValue.value, false);
    }
  }
};

// 加载集群列表
const loadClusters = async (): Promise<void> => {
  try {
    clustersLoading.value = true;
    const allClusters: K8sCluster[] = [];
    let currentPage = 1;
    const pageSize = 50;
    let hasMoreData = true;

    while (hasMoreData) {
      const res = await getClustersListApi({
        page: currentPage,
        size: pageSize,
      });

      if (res) {
        allClusters.push(...res.items);
        hasMoreData = res.total === pageSize;
      } else {
        hasMoreData = false;
      }

      currentPage++;
    }

    clusters.value = allClusters;

    // 智能选择集群
    if (!selectedCluster.value || !runningClusters.value.find(c => c.id === selectedCluster.value)) {
      selectedCluster.value = runningClusters.value[0]?.id;
      if (selectedCluster.value) {
        await getNodes();
        // 集群选择完成后加载节点选项
        loadNodeOptions('', true);
      }
    }
  } catch (error: any) {
    console.error('获取集群列表失败:', error);
    message.error(error.message || '获取集群列表失败');
  } finally {
    clustersLoading.value = false;
  }
};

// 处理集群切换
const handleClusterChange = () => {
  nodes.value = [];
  currentPage.value = 1;
  totalNodes.value = 0;
  getNodes();
  // 重新加载节点选项
  loadNodeOptions('', true);
};

// 验证集群状态
const validateClusterStatus = (): boolean => {
  if (!selectedCluster.value) {
    message.error('请先选择集群');
    return false;
  }

  const currentCluster = clusters.value.find(c => c.id === selectedCluster.value);
  if (!currentCluster) {
    message.error('未找到指定的集群');
    return false;
  }

  if (currentCluster.status !== ClusterStatus.Running) {
    message.error('选中的集群未在运行状态，无法操作');
    return false;
  }

  return true;
};



// 解析Taint YAML
const parseTaintYaml = (yamlContent: string): NodeTaint[] => {
  try {
    // 简单的YAML解析，实际项目中应该使用专门的YAML库
    const lines = yamlContent.split('\n').filter(line => line.trim());
    const taints: NodeTaint[] = [];
    let currentTaint: Partial<NodeTaint> = {};

    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith('- key:')) {
        if (currentTaint.key) {
          taints.push(currentTaint as NodeTaint);
        }
        currentTaint = { key: trimmed.replace('- key:', '').replace(/"/g, '').trim() };
      } else if (trimmed.startsWith('value:')) {
        currentTaint.value = trimmed.replace('value:', '').replace(/"/g, '').trim();
      } else if (trimmed.startsWith('effect:')) {
        currentTaint.effect = trimmed.replace('effect:', '').replace(/"/g, '').trim();
      }
    }

    if (currentTaint.key) {
      taints.push(currentTaint as NodeTaint);
    }

    return taints;
  } catch (error) {
    throw new Error('YAML格式解析失败');
  }
};

// 验证 Taint YAML 或 Key列表
const handleCheckTaintYaml = async (nodeName: string, yamlData: string, isDeleteMode = false): Promise<void> => {
  if (!nodeName || !yamlData) {
    message.warning(isDeleteMode ? '请先选择节点并输入Taint Key' : '请先选择节点并输入YAML数据');
    return;
  }

  if (isDeleteMode) {
    // 删除模式下验证Key列表格式
    try {
      const keys = parseTaintKeys(yamlData);
      message.success(`格式验证通过，将删除 ${keys.length} 个Taint Key`);
    } catch (error: any) {
      message.error(error.message || 'Taint Key格式验证失败');
    }
    return;
  }

  // 添加模式下验证完整YAML
  if (!validateClusterStatus()) {
    return;
  }

  try {
    const cluster_id = selectedCluster.value!;
    await checkTaintYaml({
      cluster_id,
      node_name: nodeName,
      yaml_data: yamlData
    });
    message.success('YAML格式验证通过');
  } catch (error: any) {
    message.error(error.message || 'YAML格式验证失败');
  }
};

// 获取节点列表
const getNodes = async (page = 1, size = pageSize.value): Promise<void> => {
  loading.value = true;
  try {
    // 验证集群状态
    if (!validateClusterStatus()) {
      loading.value = false;
      return;
    }

    const cluster_id = selectedCluster.value!;

    const params: GetNodeListReq = {
      cluster_id,
      page,
      size,
      search: searchText.value || undefined,
      label_selector: undefined
    };

    if (statusFilter.value) {
      const statusMapping: Record<string, NodeStatus> = {
        'Ready': NodeStatus.Ready,
        'NotReady': NodeStatus.NotReady,
        'Unknown': NodeStatus.Unknown
      };
      const mappedStatus = statusMapping[statusFilter.value];
      if (mappedStatus !== undefined) {
        params.status = [mappedStatus];
      }
    }

    const res = await getNodeList(params);

    if (res.items) {
      nodes.value = res.items;
      totalNodes.value = res.total || 0;
      currentPage.value = page;
      message.success('节点数据加载成功');
    } else {
      // 兼容直接返回数组的情况
      nodes.value = Array.isArray(res) ? res : [];
      totalNodes.value = nodes.value.length;
    }
  } catch (error: any) {
    message.error(error.message || '获取节点数据失败');
    nodes.value = [];
    totalNodes.value = 0;
  } finally {
    loading.value = false;
  }
};

// 刷新数据
const refreshData = (): void => {
  searchText.value = '';
  statusFilter.value = '';
  roleFilter.value = '';
  selectedRowKeys.value = [];
  selectedNode.value = null;
  currentPage.value = 1;
  getNodes();
};



// 选择表格行
const onSelectChange = (keys: string[], rows: K8sNode[]): void => {
  selectedRowKeys.value = keys;
  selectedNode.value = rows.length > 0 ? (rows[0] || null) : null;
};

// 分页处理
const handlePageChange = (page: number, size: number): void => {
  pageSize.value = size;
  getNodes(page, size);
};

// 搜索处理
const handleSearchChange = (): void => {
  currentPage.value = 1;
  getNodes(1, pageSize.value);
};

// 进入维护模式（先封锁后排空）
const handleCordon = (record: K8sNode): void => {
  if (!validateClusterStatus()) {
    return;
  }
  
  const cluster_id = selectedCluster.value!;

    Modal.confirm({
    title: '确认进入维护模式',
    content: `是否确认将节点 ${record.name} 设置为维护模式？这将：\n1. 封锁节点阻止新Pod调度\n2. 驱逐现有Pod到其他节点`,
    okText: '确认',
    cancelText: '取消',
    onOk: async () => {
      try {
        submitLoading.value = true;

        // 先封锁节点
        await cordonNode({
          cluster_id,
          node_name: record.name
        });
        message.success(`节点 ${record.name} 已被封锁`);

        // 再排空节点
        await drainNode({
          cluster_id,
          node_name: record.name,
          force: 1,
          ignore_daemon_sets: 1,
          delete_local_data: 1,
          grace_period_seconds: 60
        });
        message.success(`节点 ${record.name} 已进入维护模式`);

        // 刷新数据
        getNodes();

        // 如果当前有节点详情打开，刷新详情
        if (selectedNodeDetails.value && selectedNodeDetails.value.name === record.name) {
          refreshNodeDetails(selectedNodeDetails.value);
        }
      } catch (error: any) {
        message.error(error.message || '进入维护模式失败');
      } finally {
        submitLoading.value = false;
      }
    }
  });
};

// 获取节点详情
const handleViewDetails = async (record: K8sNode): Promise<void> => {
  detailsLoading.value = true;
  try {
    if (!validateClusterStatus()) {
      detailsLoading.value = false;
      return;
    }
    
    const nodeDetails = await getNodeDetail({
      cluster_id: selectedCluster.value!,
      node_name: record.name
    });

    selectedNodeDetails.value = nodeDetails;
    isViewDetailsModalVisible.value = true;
  } catch (error: any) {
    message.error(error.message || '获取节点详情失败');
  } finally {
    detailsLoading.value = false;
  }
};

// 刷新节点详情
const refreshNodeDetails = async (node: K8sNode): Promise<void> => {
  if (!node) return;

  detailsLoading.value = true;
  try {
    if (!validateClusterStatus()) {
      detailsLoading.value = false;
      return;
    }
    
    const nodeDetails = await getNodeDetail({
      cluster_id: selectedCluster.value!,
      node_name: node.name
    });

    selectedNodeDetails.value = nodeDetails;
    message.success('节点详情刷新成功');
  } catch (error: any) {
    message.error(error.message || '刷新节点详情失败');
  } finally {
    detailsLoading.value = false;
  }
};

// 打开添加标签操作
const handleAddLabel = (record: K8sNode | null = null): void => {
  // 如果没有传入节点，检查是否有选中的节点
  if (!record) {
    if (!selectedNode.value) {
      message.warning('请先选择一个节点');
      return;
    }
    record = selectedNode.value;
  }
  
  labelForm.nodeName = record.name;
  isAddLabelModalVisible.value = true;
};

// 添加节点标签
const handleSubmitAddLabel = async (): Promise<void> => {
  submitLoading.value = true;
  const { key, nodeName, value } = labelForm;
  
  try {
    if (!validateClusterStatus()) {
      submitLoading.value = false;
      return;
    }
    
    const cluster_id = selectedCluster.value!;
    await addLabelNodes({
      cluster_id,
      node_name: nodeName,
      labels: { [key]: value },
      overwrite: 1,
    });
    message.success('标签添加成功');

    labelForm.nodeName = '';
    labelForm.key = '';
    labelForm.value = '';

    getNodes();

    if (selectedNodeDetails.value?.name === nodeName) {
      refreshNodeDetails(selectedNodeDetails.value);
    }

    isAddLabelModalVisible.value = false;
  } catch (error: any) {
    message.error(error.message || '标签添加失败');
  } finally {
    submitLoading.value = false;
  }
};

// 快速删除标签
const handleQuickDeleteLabel = (label: string): void => {
  Modal.confirm({
    title: '确认删除标签',
    content: `确定要删除标签 ${label} 吗？`,
    okText: '删除',
    okType: 'danger',
    cancelText: '取消',
    onOk: async () => {
      const [key, val] = label.split('=');
      if (!key || !val) {
        message.error('标签格式不正确');
        return;
      }

      try {
        if (!selectedNodeDetails.value) {
          message.error('未选中节点');
          return;
        }

        if (!validateClusterStatus()) {
          return;
        }

        const cluster_id = selectedCluster.value!;
        await deleteLabelNodes({
          cluster_id,
          node_name: selectedNodeDetails.value.name,
          label_keys: [key],
        });
        message.success('标签删除成功');

        if (selectedNodeDetails.value) {
          refreshNodeDetails(selectedNodeDetails.value);
        }

        getNodes();
      } catch (error: any) {
        message.error(error.message || '删除标签失败');
      }
    }
  });
};

// 删除标签
const handleDeleteLabel = async (): Promise<void> => {
  const selectedLabel = deleteLabelForm.label;
  
  if (!validateClusterStatus()) {
    return;
  }

  if (!selectedLabel) {
    message.error('请选择一个标签');
    return;
  }

  const [key, val] = selectedLabel.split('=');

  if (!key || !val) {
    message.error('标签格式不正确');
    return;
  }

  if (!selectedNodeDetails.value) {
    message.error('未选中节点');
    return;
  }

  // 二次确认
  Modal.confirm({
    title: '确认删除节点标签',
    content: `确定要删除节点 "${selectedNodeDetails.value.name}" 的标签 "${selectedLabel}" 吗？删除标签可能会影响依赖此标签的 Pod 调度。`,
    okText: '确认删除',
    okType: 'danger',
    cancelText: '取消',
    onOk: async () => {
      submitLoading.value = true;
      try {
        const cluster_id = selectedCluster.value!;
        
        await deleteLabelNodes({
          cluster_id,
          node_name: selectedNodeDetails.value!.name,
          label_keys: [key],
        });
        message.success('标签删除成功');

        getNodes();

        if (selectedNodeDetails.value) {
          refreshNodeDetails(selectedNodeDetails.value);
        }

        closeDeleteLabelModal();
      } catch (error: any) {
        message.error(error.message || '删除标签失败');
      } finally {
        submitLoading.value = false;
      }
    }
  });
};


const handleAddTaint = (record: K8sNode | null = null): void => {
  // 如果没有传入节点，检查是否有选中的节点
  if (!record) {
    if (!selectedNode.value) {
      message.warning('请先选择一个节点');
      return;
    }
    record = selectedNode.value;
  }
  
  taintForm.nodeName = record.name;
  isAddTaintModalVisible.value = true;
};


const handleSubmitAddTaint = async (): Promise<void> => {
  submitLoading.value = true;
  try {
    if (!validateClusterStatus()) {
      submitLoading.value = false;
      return;
    }
    
    // 解析YAML数据为Taint对象数组
    const taints = parseTaintYaml(taintForm.taintYaml);

    const cluster_id = selectedCluster.value!;
    await addNodeTaints({
      cluster_id,
      node_name: taintForm.nodeName,
      taints: taints,
    });
    message.success('Taint添加成功');

    taintForm.nodeName = '';
    taintForm.taintYaml = '';

    getNodes();

    if (selectedNodeDetails.value?.name === taintForm.nodeName) {
      refreshNodeDetails(selectedNodeDetails.value);
    }

    isAddTaintModalVisible.value = false;
  } catch (error: any) {
    message.error(error.message || '添加Taint失败');
  } finally {
    submitLoading.value = false;
  }
};


const handleDeleteTaint = (record: K8sNode | null = null): void => {
  // 如果没有传入节点，检查是否有选中的节点
  if (!record) {
    if (!selectedNode.value) {
      message.warning('请先选择一个节点');
      return;
    }
    record = selectedNode.value;
  }
  
  deleteTaintForm.nodeName = record.name;
  isDeleteTaintModalVisible.value = true;
};


// 解析删除模式的Taint Key列表
const parseTaintKeys = (keysText: string): string[] => {
  if (!keysText || !keysText.trim()) {
    throw new Error('请输入Taint Key');
  }

  // 按行分割并过滤空行
  const keys = keysText
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0);

  if (keys.length === 0) {
    throw new Error('请输入有效的Taint Key');
  }

  // 验证key格式（简单验证，确保不包含特殊字符）
  for (const key of keys) {
    if (key.includes('=') || key.includes(':')) {
      throw new Error(`删除模式下只需要输入Key，请移除 "${key}" 中的 "=" 或 ":"`);
    }
  }

  return keys;
};

const handleSubmitDeleteTaint = async (): Promise<void> => {
  if (!validateClusterStatus()) {
    return;
  }
  
  if (!deleteTaintForm.nodeName) {
    message.error('请选择节点');
    return;
  }

  if (!deleteTaintForm.taintYaml.trim()) {
    message.error('请输入要删除的Taint Key');
    return;
  }

  let taintKeys;
  try {
    taintKeys = parseTaintKeys(deleteTaintForm.taintYaml);
  } catch (error: any) {
    message.error(error.message || 'Taint Key格式不正确');
    return;
  }

  const keysList = taintKeys.join(', ');

  // 二次确认
  Modal.confirm({
    title: '确认删除节点Taint',
    content: `确定要删除节点 "${deleteTaintForm.nodeName}" 的以下Taint Key吗？\n\n${keysList}\n\n删除Taint将允许Pod重新调度到该节点上。`,
    okText: '确认删除',
    okType: 'danger',
    cancelText: '取消',
    onOk: async () => {
      submitLoading.value = true;
      try {
        const cluster_id = selectedCluster.value!;
        await deleteNodeTaints({
          cluster_id,
          node_name: deleteTaintForm.nodeName,
          taint_keys: taintKeys,
        });
        message.success('Taint删除成功');

        deleteTaintForm.nodeName = '';
        deleteTaintForm.taintYaml = '';

        getNodes();

        if (selectedNodeDetails.value?.name === deleteTaintForm.nodeName) {
          refreshNodeDetails(selectedNodeDetails.value);
        }

        isDeleteTaintModalVisible.value = false;
      } catch (error: any) {
        message.error(error.message || '删除Taint失败');
      } finally {
        submitLoading.value = false;
      }
    }
  });
};


const handleQuickDeleteTaint = (taint: string): void => {
  Modal.confirm({
    title: '确认删除污点',
    content: `确定要删除污点 ${taint} 吗？`,
    okText: '删除',
    okType: 'danger',
    cancelText: '取消',
    onOk: async () => {
      try {
        if (!selectedNodeDetails.value) {
          message.error('未选中节点');
          return;
        }

        if (!validateClusterStatus()) {
          return;
        }

        const taintParts = taint.split(':');
        const keyValue = taintParts[0]?.trim().split('=') || [];
        const taintKey = keyValue[0] || '';

        const cluster_id = selectedCluster.value!;
        await deleteNodeTaints({
          cluster_id,
          node_name: selectedNodeDetails.value.name,
          taint_keys: [taintKey],
        });
        message.success('污点删除成功');

        if (selectedNodeDetails.value) {
          refreshNodeDetails(selectedNodeDetails.value);
        }

        getNodes();
      } catch (error: any) {
        message.error(error.message || '删除污点失败');
      }
    }
  });
};



const handleClearTaints = (): void => {
  // 检查是否有选中节点
  if (!selectedNode.value && !selectedNodeDetails.value) {
    message.warning('请先选择一个节点');
    return;
  }

  const node = selectedNode.value || selectedNodeDetails.value;

  if (!node) {
    message.warning('未选中节点');
    return;
  }

  Modal.confirm({
    title: '确认清空污点',
    content: `确定要清空节点 ${node.name} 的所有污点吗？这可能会导致新的Pod被调度到该节点。`,
    okText: '确认清空',
    okType: 'danger',
    cancelText: '取消',
    onOk: async () => {
      try {

        message.success(`已清空节点 ${node.name} 的所有污点`);

        // 刷新数据
        getNodes();

        // 如果当前有节点详情打开，刷新详情
        if (selectedNodeDetails.value && selectedNodeDetails.value.name === node.name) {
          refreshNodeDetails(selectedNodeDetails.value);
        }
      } catch (error: any) {
        message.error(error.message || '清空污点失败');
      }
    }
  });
};

// 启用/禁用调度
const handleToggleSchedule = (record: K8sNode | null = null, newState: boolean | null = null): void => {
  // 如果没有传入节点，检查是否有选中节点
  if (!record) {
    if (!selectedNode.value) {
      message.warning('请先选择一个节点');
      return;
    }
    record = selectedNode.value;
  }

  try {
    if (!validateClusterStatus()) {
      return;
    }
    
    const cluster_id = selectedCluster.value!;

    const schedulable = newState !== null ? newState : (record.schedulable !== 1);
    const action = schedulable ? '启用' : '禁用';

    Modal.confirm({
    title: `确认${action}节点调度`,
    content: `确定要${action}节点 ${record.name} 的调度功能吗？${!schedulable ? '这将阻止新的Pod被调度到该节点。' : ''}`,
    okText: '确认',
    cancelText: '取消',
    onOk: async () => {
      try {
        // 调用对应的API
        if (schedulable) {
          await uncordonNode({
            cluster_id,
            node_name: record.name
          });
        } else {
          await cordonNode({
            cluster_id,
            node_name: record.name
          });
        }

        message.success(`已${action}节点 ${record.name} 的调度功能`);

        // 刷新数据
        getNodes();

        // 如果当前有节点详情打开，刷新详情
        if (selectedNodeDetails.value && selectedNodeDetails.value.name === record.name) {
          refreshNodeDetails(selectedNodeDetails.value);
        }
      } catch (error: any) {
        message.error(error.message || `${action}调度失败`);
      }
    }
  });
  } catch (error: any) {
    message.error(error.message || '获取集群信息失败');
  }
};

// 模态框控制
// 弹出删除标签模态框
const showDeleteLabelModal = (record: K8sNode): void => {
  selectedNodeDetails.value = record;
  isDeleteLabelModalVisible.value = true;
};

// 关闭添加标签模态框
const closeAddLabelModal = (): void => {
  labelForm.nodeName = '';
  labelForm.key = '';
  labelForm.value = '';
  isAddLabelModalVisible.value = false;
};


const closeAddTaintModal = (): void => {
  taintForm.nodeName = '';
  taintForm.taintYaml = '';
  isAddTaintModalVisible.value = false;
};


const closeDeleteTaintModal = (): void => {
  deleteTaintForm.nodeName = '';
  deleteTaintForm.taintYaml = '';
  isDeleteTaintModalVisible.value = false;
};

// 关闭删除标签模态框
const closeDeleteLabelModal = (): void => {
  deleteLabelForm.label = '';
  isDeleteLabelModalVisible.value = false;
};

// 关闭查看详情模态框
const closeViewDetailsModal = (): void => {
  isViewDetailsModalVisible.value = false;
};

// 初始化数据
onMounted(() => {
  loadClusters();
});
</script>

<style>
/* 现代化大气设计系统 */
:root {
  --primary-color: #1677ff;
  --primary-hover: #4096ff;
  --primary-active: #0958d9;
  --success-color: #52c41a;
  --warning-color: #faad14;
  --error-color: #ff4d4f;
  --text-primary: #000000d9;
  --text-secondary: #00000073;
  --text-tertiary: #00000040;
  --text-quaternary: #00000026;
  --border-color: #d9d9d9;
  --border-color-split: #f0f0f0;
  --background-color: #f5f5f5;
  --component-background: #ffffff;
  --layout-header-background: #001529;
  --shadow-1: 0 2px 8px rgba(0, 0, 0, 0.06);
  --shadow-2: 0 6px 16px rgba(0, 0, 0, 0.08);
  --shadow-3: 0 9px 28px rgba(0, 0, 0, 0.12);
  --border-radius-base: 8px;
  --border-radius-sm: 6px;
  --border-radius-lg: 12px;
  --font-size-base: 14px;
  --font-size-lg: 16px;
  --font-size-xl: 20px;
  --font-size-xxl: 24px;
  --line-height-base: 1.5714;
  --transition-duration: 0.3s;
  --transition-function: cubic-bezier(0.645, 0.045, 0.355, 1);
}

/* ==================== 布局容器 ==================== */
.cluster-management-container {
  min-height: 100vh;
  background: var(--background-color);
  padding: 24px;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
}

/* ==================== 页面头部 ==================== */
.page-header {
  background: var(--component-background);
  border-radius: var(--border-radius-base);
  margin-bottom: 24px;
  box-shadow: var(--shadow-1);
  overflow: hidden;
}

.header-content {
  padding: 32px 40px;
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
}

.title-section {
  flex: 1;
}

.page-title {
  display: flex;
  align-items: center;
  margin-bottom: 8px;
}

.title-icon {
  font-size: 28px;
  color: var(--primary-color);
  margin-right: 16px;
}

.page-title h1 {
  font-size: var(--font-size-xxl);
  font-weight: 600;
  color: var(--text-primary);
  margin: 0;
  line-height: 1.2;
}

.page-subtitle {
  font-size: var(--font-size-base);
  color: var(--text-secondary);
  margin: 0;
  line-height: var(--line-height-base);
}

.header-actions {
  flex-shrink: 0;
}

.overview-cards {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  gap: 20px;
  margin-bottom: 32px;
}

.overview-card {
  background: var(--component-background);
  border-radius: var(--border-radius-base);
  padding: 24px;
  box-shadow: var(--shadow-1);
  display: flex;
  align-items: center;
  transition: all var(--transition-duration) var(--transition-function);
  border: 1px solid var(--border-color-split);
}

.overview-card:hover {
  box-shadow: var(--shadow-2);
  transform: translateY(-2px);
}

.card-icon {
  width: 48px;
  height: 48px;
  border-radius: var(--border-radius-base);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
  margin-right: 16px;
  flex-shrink: 0;
}

.total-clusters .card-icon {
  background: rgba(22, 119, 255, 0.1);
  color: var(--primary-color);
}

.running-clusters .card-icon {
  background: rgba(82, 196, 26, 0.1);
  color: var(--success-color);
}

.env-types .card-icon {
  background: rgba(250, 173, 20, 0.1);
  color: var(--warning-color);
}

.resource-usage .card-icon {
  background: rgba(114, 46, 209, 0.1);
  color: #722ed1;
}

.card-info {
  flex: 1;
}

.card-number {
  font-size: var(--font-size-xl);
  font-weight: 600;
  color: var(--text-primary);
  line-height: 1.2;
  margin-bottom: 4px;
}

.card-label {
  font-size: var(--font-size-base);
  color: var(--text-secondary);
  line-height: var(--line-height-base);
}

/* ==================== 工具栏 ==================== */
.toolbar {
  background: var(--component-background);
  border-radius: var(--border-radius-base);
  padding: 20px 24px;
  margin-bottom: 24px;
  box-shadow: var(--shadow-1);
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 20px;
  border: 1px solid var(--border-color-split);
}

.toolbar-left {
  display: flex;
  gap: 16px;
  align-items: center;
  flex: 1;
}

.search-input {
  width: 320px;
}

.search-input :deep(.ant-input) {
  border-radius: var(--border-radius-sm);
  font-size: var(--font-size-base);
  height: 40px;
  transition: all 0.3s ease;
  border: 1px solid rgba(0, 0, 0, 0.06);
}

.search-input :deep(.ant-input:focus) {
  border-color: var(--primary-color);
  box-shadow: 0 0 0 2px rgba(22, 119, 255, 0.1);
}

.env-filter {
  width: 160px;
}

.env-filter :deep(.ant-select-selector) {
  border-radius: var(--border-radius-sm);
  height: 40px;
  transition: all 0.3s ease;
  border: 1px solid rgba(0, 0, 0, 0.06);
}

.env-filter :deep(.ant-select-selector:hover) {
  border-color: rgba(24, 144, 255, 0.3);
}

.env-filter :deep(.ant-select-focused .ant-select-selector) {
  border-color: var(--primary-color);
  box-shadow: 0 0 0 2px rgba(22, 119, 255, 0.1);
}

.cluster-selector {
  width: 200px;
}

.cluster-selector :deep(.ant-select-selector) {
  border-radius: var(--border-radius-sm);
  height: 40px;
  transition: all 0.3s ease;
  border: 1px solid rgba(0, 0, 0, 0.06);
}

.cluster-selector :deep(.ant-select-selector:hover) {
  border-color: rgba(24, 144, 255, 0.3);
}

.cluster-selector :deep(.ant-select-focused .ant-select-selector) {
  border-color: var(--primary-color);
  box-shadow: 0 0 0 2px rgba(22, 119, 255, 0.1);
}

.toolbar-right {
  display: flex;
  gap: 12px;
  align-items: center;
  flex-shrink: 0;
}

.data-display {
  background: var(--component-background);
  border-radius: var(--border-radius-base);
  box-shadow: var(--shadow-1);
  border: 1px solid var(--border-color-split);
  overflow: hidden;
}

.display-header {
  padding: 16px 24px;
  border-bottom: 1px solid var(--border-color-split);
  background: var(--component-background);
}

.result-info {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.result-count {
  font-size: var(--font-size-base);
  color: var(--text-secondary);
  font-weight: 500;
}

.env-tags {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.env-tags :deep(.ant-tag) {
  border-radius: var(--border-radius-sm);
  font-size: 12px;
  font-weight: 500;
  margin: 0;
}

/* ==================== 表格样式 ==================== */
.cluster-table {
  border: none;
}

.cluster-table :deep(.ant-table-container) {
  border-radius: 0;
}

.cluster-table :deep(.ant-table-thead > tr > th) {
  background: #fafafa;
  font-weight: 600;
  padding: 16px 16px;
  border-bottom: 1px solid var(--border-color-split);
  color: var(--text-primary);
  font-size: var(--font-size-base);
}

.cluster-table :deep(.ant-table-tbody > tr) {
  transition: all var(--transition-duration) var(--transition-function);
}

.cluster-table :deep(.ant-table-tbody > tr:hover) {
  background-color: #fafafa;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
}

.cluster-table :deep(.ant-table-tbody > tr > td) {
  padding: 16px;
  border-bottom: 1px solid var(--border-color-split);
  vertical-align: middle;
  font-size: var(--font-size-base);
}

.cluster-name {
  display: flex;
  align-items: center;
  gap: 12px;
  font-weight: 500;
}

.cluster-name a {
  color: #1677ff;
  text-decoration: none;
  cursor: pointer;
}

.cluster-name a:hover {
  color: #4096ff;
}

.node-name {
  display: flex;
  align-items: center;
  gap: 10px;
  font-weight: 500;
}

.node-status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
}

.status-ready {
  background-color: #52c41a;
}

.status-warning {
  background-color: #faad14;
}

.status-error {
  background-color: #f5222d;
}

.status-unknown {
  background-color: #d9d9d9;
}

.env-tag,
.status-tag,
.role-tag,
.label-tag,
.taint-tag {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-weight: 500;
  padding: 4px 12px;
  border-radius: var(--border-radius-base);
  font-size: 12px;
  border: none;
}

.status-dot {
  display: inline-block;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background-color: currentColor;
}

.timestamp {
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--text-secondary);
  font-size: var(--font-size-base);
}

.ip-address {
  display: flex;
  align-items: center;
  gap: 10px;
  font-family: 'Courier New', monospace;
  color: #595959;
}

.roles-cell {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.labels-cell {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.action-buttons {
  display: flex;
  gap: 6px;
  align-items: center;
  justify-content: flex-start;
}

.action-buttons .ant-btn {
  height: 32px;
  width: 32px;
  border-radius: 8px;
  border: 1px solid rgba(0, 0, 0, 0.06);
  background: #ffffff;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.02);
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  position: relative;
  overflow: hidden;
}

.action-buttons .ant-btn:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
  border-color: rgba(24, 144, 255, 0.3);
  background: linear-gradient(145deg, #ffffff 0%, #f8fafc 100%);
  z-index: 10;
}

.action-buttons .ant-btn:active {
  transform: translateY(0);
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.04);
}

.action-buttons .ant-btn-primary.ant-btn-dangerous {
  border-color: rgba(255, 77, 79, 0.2);
}

.action-buttons .ant-btn-primary.ant-btn-dangerous:hover {
  border-color: rgba(255, 77, 79, 0.4);
  background: linear-gradient(145deg, #ffffff 0%, #fef2f2 100%);
}

.action-buttons .ant-btn .anticon {
  font-size: 14px;
  color: #64748b;
  transition: color 0.3s ease;
}

.action-buttons .ant-btn:hover .anticon {
  color: #1677ff;
}

.action-buttons .ant-btn-primary.ant-btn-dangerous:hover .anticon {
  color: #ff4d4f;
}

/* 节点信息单元格 */
.node-info-cell {
  display: flex;
  flex-direction: column;
  gap: 8px;
  align-items: flex-start;
}

/* 进度图表组件 */
.progress-chart {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 4px;
}

.chart-icon {
  color: #8c8c8c;
  font-size: 14px;
}

.chart-bar {
  width: 60px;
  height: 6px;
  background-color: #f0f0f0;
  border-radius: 3px;
  overflow: hidden;
}

.chart-fill {
  height: 100%;
  border-radius: 3px;
}

.chart-title {
  font-size: 12px;
  color: #595959;
  white-space: nowrap;
}

/* ==================== 模态框样式 ==================== */
.cluster-modal :deep(.ant-modal-content) {
  border-radius: var(--border-radius-base);
  overflow: hidden;
  box-shadow: var(--shadow-3);
}

.cluster-modal :deep(.ant-modal-header) {
  background: var(--component-background);
  border-bottom: 1px solid var(--border-color-split);
  padding: 20px 24px;
}

.cluster-modal :deep(.ant-modal-title) {
  font-size: var(--font-size-lg);
  font-weight: 600;
  color: var(--text-primary);
}

.modal-alert {
  margin-bottom: 20px;
  border-radius: var(--border-radius-sm);
}

.cluster-form {
  padding: 8px 0;
}

.form-input,
.form-select,
.form-textarea {
  border-radius: var(--border-radius-sm);
  transition: all var(--transition-duration) var(--transition-function);
  font-size: var(--font-size-base);
}

.form-input {
  height: 40px;
}

.form-input:focus,
.form-select:focus,
.form-textarea:focus {
  border-color: var(--primary-color);
  box-shadow: 0 0 0 2px rgba(22, 119, 255, 0.1);
}

.yaml-editor {
  font-family: 'JetBrains Mono', 'Fira Code', 'Courier New', monospace;
  font-size: 14px;
  line-height: 1.5;
  border-radius: 8px;
  background-color: #f9f9f9;
  padding: 12px;
  transition: all 0.3s;
  tab-size: 2;
}

.taint-keys-editor {
  font-family: 'JetBrains Mono', 'Fira Code', 'Courier New', monospace;
  font-size: 14px;
  line-height: 1.6;
  border-radius: 8px;
  background-color: #f6f8fa;
  padding: 12px;
  transition: all 0.3s;
  border: 1px solid #e1e4e8;
}

.taint-keys-editor:focus {
  background-color: #ffffff;
  border-color: var(--primary-color);
  box-shadow: 0 0 0 2px rgba(22, 119, 255, 0.1);
}

.yaml-actions {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  margin-bottom: 10px;
}

.status-option,
.role-option,
.node-option,
.label-option,
.cluster-option {
  display: flex;
  align-items: center;
  gap: 10px;
}

.status-option :deep(svg),
.role-option :deep(svg),
.node-option :deep(svg),
.label-option :deep(svg),
.cluster-option :deep(svg) {
  margin-right: 4px;
}

/* 节点详情样式 */
.node-detail-modal .ant-tabs-nav {
  margin-bottom: 16px;
}

.details-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 16px;
  margin-bottom: 24px;
}

.detail-card {
  background-color: #fafafa;
  border-radius: 8px;
  padding: 16px;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.card-header h4 {
  margin: 0;
  font-weight: 500;
  display: flex;
  align-items: center;
  gap: 8px;
}

.detail-item {
  display: flex;
  justify-content: space-between;
  margin-bottom: 12px;
}

.detail-label {
  color: #8c8c8c;
  font-weight: 500;
}

.detail-value {
  color: #262626;
  font-weight: 400;
}

/* 资源图表 */
.resource-charts {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 16px;
  margin-top: 24px;
}

.resource-chart {
  background-color: #fafafa;
  border-radius: 8px;
  padding: 16px;
}

.resource-chart h4 {
  margin: 0 0 16px;
  font-weight: 500;
}

.usage-gauge {
  position: relative;
}

.gauge-value {
  font-size: 24px;
  font-weight: 600;
  margin-bottom: 8px;
}

.gauge-bar {
  height: 8px;
  background-color: #f0f0f0;
  border-radius: 4px;
  overflow: hidden;
}

.gauge-fill {
  height: 100%;
  border-radius: 4px;
}

/* 标签和污点列表 */
.labels-list,
.taints-list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 12px;
}

/* 事件容器 */
.events-container {
  padding: 8px;
  max-height: 400px;
  overflow-y: auto;
}

.event-card {
  background-color: #fafafa;
  border-radius: 8px;
  padding: 12px;
  margin-bottom: 8px;
}

.event-header {
  display: flex;
  justify-content: space-between;
  margin-bottom: 8px;
}

.event-reason {
  font-weight: 600;
  color: #262626;
}

.event-time {
  color: #8c8c8c;
  font-size: 12px;
}

.event-message {
  margin-bottom: 12px;
  line-height: 1.5;
}

.event-meta {
  display: flex;
  gap: 16px;
  font-size: 12px;
  color: #595959;
  margin-bottom: 8px;
}

.event-time-range {
  font-size: 12px;
  color: #8c8c8c;
  display: flex;
  align-items: center;
  gap: 4px;
}

/* 模态框底部 */
.modal-footer {
  display: flex;
  justify-content: flex-end;
  margin-top: 16px;
}

/* ==================== 空状态 ==================== */
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 60px 0;
  color: var(--text-secondary);
}

.empty-state p {
  margin: 16px 0 24px;
  font-size: var(--font-size-base);
}

/* ==================== 响应式设计 ==================== */
@media (max-width: 1400px) {
  .overview-cards {
    grid-template-columns: repeat(2, 1fr);
  }

  .details-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 1024px) {
  .cluster-management-container {
    padding: 16px;
  }

  .header-content {
    flex-direction: column;
    align-items: stretch;
    gap: 20px;
    padding: 24px 32px;
  }

  .toolbar {
    flex-direction: column;
    gap: 16px;
    align-items: stretch;
  }

  .toolbar-left {
    flex-direction: column;
    gap: 12px;
  }

  .search-input {
    width: 100%;
  }

  .env-filter {
    width: 100%;
  }

  .toolbar-right {
    justify-content: space-between;
  }

  .node-info-cell {
    align-items: flex-start;
  }
}

@media (max-width: 768px) {
  .cluster-management-container {
    padding: 12px;
  }

  .header-content {
    padding: 20px 24px;
  }

  .page-title h1 {
    font-size: var(--font-size-xl);
  }

  .overview-cards {
    grid-template-columns: repeat(2, 1fr);
    gap: 12px;
  }

  .overview-card {
    padding: 16px;
  }

  .card-icon {
    width: 40px;
    height: 40px;
    font-size: 18px;
    margin-right: 12px;
  }

  .card-number {
    font-size: var(--font-size-lg);
  }
}

@media (max-width: 480px) {
  .overview-cards {
    grid-template-columns: 1fr;
    gap: 8px;
  }

  .overview-card {
    padding: 12px;
  }

  .card-icon {
    width: 36px;
    height: 36px;
    font-size: 16px;
    margin-right: 8px;
  }

  .toolbar-right {
    flex-direction: column;
    gap: 8px;
  }

  .cluster-table :deep(.ant-table-tbody > tr > td) {
    padding: 12px 8px;
    font-size: 13px;
  }

  .action-buttons {
    flex-direction: column;
    gap: 4px;
  }

  .action-buttons .ant-btn {
    width: 28px;
    height: 28px;
  }
}

</style>
