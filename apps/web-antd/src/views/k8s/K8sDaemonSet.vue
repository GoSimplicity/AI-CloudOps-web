<template>
  <div class="cluster-management-container daemonset-management-container">
    <!-- 页面头部 -->
    <div class="page-header">
      <div class="header-content">
        <div class="title-section">
          <div class="page-title">
            <DeploymentUnitOutlined class="title-icon" />
            <h1>Kubernetes DaemonSet 管理</h1>
          </div>
          <p class="page-subtitle">管理和监控集群中的所有守护进程集资源</p>
        </div>
        <div class="header-actions">
          <a-button type="primary" size="large" @click="isCreateModalVisible = true">
            <template #icon><PlusOutlined /></template>
            创建 DaemonSet
          </a-button>
          <a-button type="primary" size="large" @click="refreshData" :loading="loading">
            <template #icon><ReloadOutlined /></template>
            刷新数据
          </a-button>
        </div>
      </div>
    </div>

    <!-- 数据概览卡片 -->
    <div class="overview-cards">
      <div class="overview-card total-clusters">
        <div class="card-icon">
          <DeploymentUnitOutlined />
        </div>
        <div class="card-info">
          <div class="card-number">{{ daemonsets.length }}</div>
          <div class="card-label">DaemonSet 总数</div>
        </div>
      </div>
      
      <div class="overview-card running-clusters">
        <div class="card-icon">
          <CheckCircleOutlined />
        </div>
        <div class="card-info">
          <div class="card-number">{{ runningDaemonSets }}</div>
          <div class="card-label">运行中</div>
        </div>
      </div>
      
      <div class="overview-card env-types">
        <div class="card-icon">
          <NodeIndexOutlined />
        </div>
        <div class="card-info">
          <div class="card-number">{{ totalDesiredPods }}</div>
          <div class="card-label">期望 Pod 数</div>
        </div>
      </div>
      
      <div class="overview-card resource-usage">
        <div class="card-icon">
          <DatabaseOutlined />
        </div>
        <div class="card-info">
          <div class="card-number">{{ totalReadyPods }}</div>
          <div class="card-label">就绪 Pod 数</div>
        </div>
      </div>
    </div>

    <!-- 操作工具栏 -->
    <div class="toolbar">
      <div class="toolbar-left">
        <a-select
          v-model:value="selectedCluster"
          placeholder="选择集群"
          class="env-filter cluster-selector"
          :loading="clustersLoading"
          @change="handleClusterChange"
        >
          <template #suffixIcon><ClusterOutlined /></template>
          <a-select-option v-for="cluster in clusters" :key="cluster.id" :value="cluster.id">
            <span class="cluster-option">
              <CloudServerOutlined />
              {{ cluster.name }}
            </span>
          </a-select-option>
        </a-select>
        
        <a-select
          v-model:value="selectedNamespace"
          placeholder="选择命名空间"
          class="env-filter namespace-selector"
          :loading="namespacesLoading"
          @change="handleNamespaceChange"
        >
          <template #suffixIcon><PartitionOutlined /></template>
          <a-select-option v-for="ns in namespaces" :key="ns" :value="ns">
            <span class="namespace-option">
              <AppstoreOutlined />
              {{ ns }}
            </span>
          </a-select-option>
        </a-select>

        <a-select
          v-model:value="statusFilter"
          placeholder="状态筛选"
          class="env-filter"
          allow-clear
          @change="handleFilterChange"
        >
          <template #suffixIcon><FilterOutlined /></template>
          <a-select-option value="Running">运行中</a-select-option>
          <a-select-option value="Pending">等待中</a-select-option>
          <a-select-option value="Failed">失败</a-select-option>
        </a-select>
        
        <a-input-search
          v-model:value="searchText"
          placeholder="搜索 DaemonSet 名称"
          class="search-input"
          @search="onSearch"
          allow-clear
        />
      </div>
      
      <div class="toolbar-right">
        <div class="view-toggle">
          <a-radio-group v-model:value="viewMode" button-style="solid" size="small">
            <a-radio-button value="table">
              <TableOutlined />
            </a-radio-button>
            <a-radio-button value="card">
              <AppstoreOutlined />
            </a-radio-button>
          </a-radio-group>
        </div>
        
        <a-button @click="refreshData" :loading="loading">
          <template #icon><ReloadOutlined /></template>
        </a-button>
        
        <a-button 
          type="primary" 
          @click="handleBatchRestart" 
          :disabled="!selectedRows.length"
          v-if="selectedRows.length > 0"
        >
          <template #icon><RedoOutlined /></template>
          重启 ({{ selectedRows.length }})
        </a-button>
        
        <a-button 
          type="primary" 
          danger 
          @click="handleBatchDelete" 
          :disabled="!selectedRows.length"
          v-if="selectedRows.length > 0"
        >
          <template #icon><DeleteOutlined /></template>
          删除 ({{ selectedRows.length }})
        </a-button>
      </div>
    </div>

    <!-- 数据展示区域 -->
    <div class="data-display">
      <div class="display-header" v-if="filteredDaemonSets.length > 0">
        <div class="result-info">
          <span class="result-count">共 {{ filteredDaemonSets.length }} 个DaemonSet</span>
          <div class="env-tags">
            <a-tag color="green">运行中 {{ runningDaemonSets }}</a-tag>
            <a-tag color="blue">Pod {{ totalReadyPods }}/{{ totalDesiredPods }}</a-tag>
          </div>
        </div>
      </div>

      <!-- 表格视图 -->
      <a-table
        v-if="viewMode === 'table'"
        :columns="columns"
        :data-source="filteredDaemonSets"
        :row-selection="rowSelection"
        :loading="loading"
        row-key="uid"
        :pagination="{
          current: currentPage,
          pageSize: pageSize,
          total: totalItems,
          showSizeChanger: true,
          showQuickJumper: true,
          showTotal: (total: number, range: number[]) => `显示 ${range[0]}-${range[1]} 条，共 ${total} 条数据`,
          pageSizeOptions: ['12', '24', '48', '96']
        }"
        @change="handleTableChange"
        class="cluster-table daemonsets-table"
      >
        <!-- DaemonSet名称列 -->
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'name'">
            <div class="daemonset-name">
              <DeploymentUnitOutlined />
              <span>{{ record.name }}</span>
            </div>
          </template>

          <!-- Pod状态列 -->
          <template v-else-if="column.key === 'podStatus'">
            <div class="pod-status-info">
              <a-progress
                :percent="getPodReadyPercentage(record)"
                size="small"
                :status="getPodReadyPercentage(record) === 100 ? 'success' : 'active'"
                style="width: 120px"
              />
              <span class="pod-numbers">
                {{ record.number_ready }}/{{ record.desired_number_scheduled }}
              </span>
            </div>
          </template>

          <!-- 状态列 -->
          <template v-else-if="column.key === 'status'">
            <a-badge 
              :status="getStatusBadgeType(record.status)" 
              :text="record.status"
              class="status-badge"
            />
          </template>

          <!-- 创建时间列 -->
          <template v-else-if="column.key === 'creationTimestamp'">
            <div class="timestamp">
              <ClockCircleOutlined />
              <a-tooltip :title="formatDateTime(record.creation_timestamp)">
                <span>{{ formatDate(record.creation_timestamp) }}</span>
              </a-tooltip>
            </div>
          </template>

          <!-- 操作列 -->
          <template v-else-if="column.key === 'action'">
            <div class="action-column">
              <a-tooltip title="查看详情">
                <a-button type="primary" ghost shape="circle" size="small" @click="viewDetails(record)">
                  <template #icon><EyeOutlined /></template>
                </a-button>
              </a-tooltip>

              <a-tooltip title="查看YAML">
                <a-button type="primary" ghost shape="circle" size="small" @click="viewYaml(record)">
                  <template #icon><CodeOutlined /></template>
                </a-button>
              </a-tooltip>

              <a-tooltip title="查看历史">
                <a-button type="primary" ghost shape="circle" size="small" @click="viewHistory(record)">
                  <template #icon><HistoryOutlined /></template>
                </a-button>
              </a-tooltip>

              <a-dropdown>
                <a-button type="primary" ghost shape="circle" size="small">
                  <template #icon><MoreOutlined /></template>
                </a-button>
                <template #overlay>
                  <a-menu>
                    <a-menu-item key="edit" @click="handleEdit(record)">
                      <EditOutlined />
                      编辑
                    </a-menu-item>
                    <a-menu-item key="restart" @click="handleRestart(record)">
                      <RedoOutlined />
                      重启
                    </a-menu-item>
                    <a-menu-item key="pause" @click="handlePause(record)" v-if="!record.paused">
                      <PauseCircleOutlined />
                      暂停更新
                    </a-menu-item>
                    <a-menu-item key="resume" @click="handleResume(record)" v-if="record.paused">
                      <PlayCircleOutlined />
                      恢复更新
                    </a-menu-item>
                    <a-menu-item key="rollback" @click="handleRollback(record)">
                      <RollbackOutlined />
                      回滚
                    </a-menu-item>
                    <a-menu-divider />
                    <a-menu-item key="delete" @click="handleDelete(record)" danger>
                      <DeleteOutlined />
                      删除
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
            <DeploymentUnitOutlined style="font-size: 48px; color: #d9d9d9; margin-bottom: 16px" />
            <p>暂无DaemonSet数据</p>
            <a-button type="primary" @click="refreshData">刷新数据</a-button>
          </div>
        </template>
      </a-table>

      <!-- 卡片视图 -->
      <div v-else class="card-view">
        <a-spin :spinning="loading">
          <a-empty v-if="filteredDaemonSets.length === 0" description="暂无DaemonSet数据">
            <template #image>
              <DeploymentUnitOutlined style="font-size: 64px; color: #d9d9d9;" />
            </template>
            <template #description>
              <span style="color: #999;">暂无DaemonSet数据</span>
            </template>
            <a-button type="primary" @click="refreshData">刷新数据</a-button>
          </a-empty>
          <div v-else class="cluster-cards daemonset-cards">
            <a-checkbox-group v-model:value="selectedCardIds" class="card-checkbox-group">
              <div v-for="daemonset in filteredDaemonSets" :key="daemonset.uid" class="cluster-card daemonset-card">
                <div class="card-header">
                  <a-checkbox :value="daemonset.uid" class="card-checkbox" />
                  <div class="service-title daemonset-title">
                    <DeploymentUnitOutlined class="service-icon" />
                    <h3>{{ daemonset.name }}</h3>
                  </div>
                  <a-badge 
                    :status="getStatusBadgeType(daemonset.status)" 
                    class="card-badge"
                  />
                </div>
                
                <div class="card-content">
                  <div class="card-detail">
                    <span class="detail-label">命名空间:</span>
                    <span class="detail-value">
                      <a-tag color="blue" size="small">{{ daemonset.namespace }}</a-tag>
                    </span>
                  </div>
                  <div class="card-detail">
                    <span class="detail-label">Pod状态:</span>
                    <span class="detail-value">
                      <a-progress
                        :percent="getPodReadyPercentage(daemonset)"
                        size="small"
                        :status="getPodReadyPercentage(daemonset) === 100 ? 'success' : 'active'"
                        style="width: 80px; margin-right: 8px"
                      />
                      {{ daemonset.number_ready }}/{{ daemonset.desired_number_scheduled }}
                    </span>
                  </div>
                  <div class="card-detail">
                    <span class="detail-label">状态:</span>
                    <span class="detail-value">
                      <a-badge 
                        :status="getStatusBadgeType(daemonset.status)" 
                        :text="daemonset.status"
                      />
                    </span>
                  </div>
                  <div class="card-detail">
                    <span class="detail-label">镜像:</span>
                    <span class="detail-value">
                      <a-tooltip v-if="daemonset.images?.length" :title="daemonset.images.join(', ')">
                        <a-tag color="green" size="small">{{ daemonset.images.length }} 个</a-tag>
                      </a-tooltip>
                      <span v-else>-</span>
                    </span>
                  </div>
                  <div class="card-detail">
                    <span class="detail-label">创建时间:</span>
                    <span class="detail-value">
                      <ClockCircleOutlined />
                      {{ formatDate(daemonset.creation_timestamp) }}
                    </span>
                  </div>
                </div>
                
                <div class="card-footer card-action-footer">
                  <a-button type="primary" ghost size="small" @click="viewDetails(daemonset)">
                    <template #icon><EyeOutlined /></template>
                    详情
                  </a-button>
                  <a-button type="primary" ghost size="small" @click="viewYaml(daemonset)">
                    <template #icon><CodeOutlined /></template>
                    YAML
                  </a-button>
                  <a-button type="primary" ghost size="small" @click="handleRestart(daemonset)">
                    <template #icon><RedoOutlined /></template>
                    重启
                  </a-button>
                  <a-popconfirm
                    title="确定要删除该DaemonSet吗?"
                    description="删除DaemonSet将删除其管理的所有Pod，此操作不可撤销！"
                    @confirm="handleDelete(daemonset)"
                    ok-text="确定"
                    cancel-text="取消"
                  >
                    <a-button type="primary" danger ghost size="small">
                      <template #icon><DeleteOutlined /></template>
                      删除
                    </a-button>
                  </a-popconfirm>
                </div>
              </div>
            </a-checkbox-group>
          </div>
        </a-spin>
      </div>
    </div>

    <!-- 创建DaemonSet模态框 -->
    <a-modal
      v-model:open="isCreateModalVisible"
      title="创建DaemonSet"
      @ok="handleCreateConfirm"
      @cancel="handleCreateCancel"
      :confirmLoading="loading"
      class="cluster-modal daemonset-modal"
      width="800px"
    >
      <a-alert class="modal-alert" type="info" show-icon>
        <template #message>创建新的DaemonSet</template>
        <template #description>DaemonSet确保在每个节点上运行Pod的副本</template>
      </a-alert>

      <a-form :model="createForm" layout="vertical" class="cluster-form daemonset-form">
        <a-row :gutter="16">
          <a-col :span="12">
            <a-form-item
              label="DaemonSet名称"
              name="name"
              :rules="[
                { required: true, message: '请输入DaemonSet名称' },
                { pattern: /^[a-z0-9]([-a-z0-9]*[a-z0-9])?$/, message: '名称只能包含小写字母、数字和连字符' }
              ]"
            >
              <a-input
                v-model:value="createForm.name"
                placeholder="请输入DaemonSet名称"
                class="form-input"
              >
                <template #prefix><DeploymentUnitOutlined /></template>
              </a-input>
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item
              label="容器镜像"
              name="image"
              :rules="[{ required: true, message: '请输入容器镜像' }]"
            >
              <a-input
                v-model:value="createForm.image"
                placeholder="例如: nginx:latest"
                class="form-input"
              />
            </a-form-item>
          </a-col>
        </a-row>

        <a-form-item label="端口配置 (可选)">
          <div class="port-config">
            <div v-for="(port, index) in createForm.ports" :key="index" class="port-row">
              <a-input
                v-model:value="port.name"
                placeholder="端口名称"
                style="width: 25%"
                class="form-input"
              />
              <a-input-number
                v-model:value="port.container_port"
                placeholder="容器端口"
                style="width: 25%"
                :min="1"
                :max="65535"
                class="form-input"
              />
              <a-select
                v-model:value="port.protocol"
                placeholder="协议"
                style="width: 25%"
                class="form-input"
              >
                <a-select-option value="TCP">TCP</a-select-option>
                <a-select-option value="UDP">UDP</a-select-option>
              </a-select>
              <a-button
                type="text"
                danger
                @click="removePort(index)"
                v-if="createForm.ports.length > 1"
                style="width: 20%"
              >
                删除
              </a-button>
              <a-button
                type="text"
                @click="addPort"
                v-else
                style="width: 20%"
              >
                添加
              </a-button>
            </div>
            <a-button
              v-if="createForm.ports.length > 1"
              type="dashed"
              @click="addPort"
              style="width: 100%; margin-top: 8px"
            >
              <template #icon><PlusOutlined /></template>
              添加端口
            </a-button>
          </div>
        </a-form-item>

        <a-form-item label="环境变量 (可选)">
          <div class="env-config">
            <div v-for="(env, index) in createForm.env" :key="index" class="env-row">
              <a-input
                v-model:value="env.name"
                placeholder="变量名"
                style="width: 40%"
                class="form-input"
              />
              <a-input
                v-model:value="env.value"
                placeholder="变量值"
                style="width: 40%"
                class="form-input"
              />
              <a-button
                type="text"
                danger
                @click="removeEnv(index)"
                v-if="createForm.env.length > 1"
                style="width: 15%"
              >
                删除
              </a-button>
              <a-button
                type="text"
                @click="addEnv"
                v-else
                style="width: 15%"
              >
                添加
              </a-button>
            </div>
            <a-button
              v-if="createForm.env.length > 1"
              type="dashed"
              @click="addEnv"
              style="width: 100%; margin-top: 8px"
            >
              <template #icon><PlusOutlined /></template>
              添加环境变量
            </a-button>
          </div>
        </a-form-item>
      </a-form>
    </a-modal>

    <!-- DaemonSet详情模态框 -->
    <a-modal
      v-model:open="detailsModalVisible"
      title="DaemonSet详情"
      width="900px"
      :footer="null"
      class="cluster-modal daemonset-detail-modal"
    >
      <div v-if="currentDaemonSet" class="daemonset-details">
        <a-alert class="modal-alert" type="info" show-icon>
          <template #message>{{ currentDaemonSet.name }}</template>
          <template #description>
            状态: {{ currentDaemonSet.status }} | Pod: {{ currentDaemonSet.number_ready }}/{{ currentDaemonSet.desired_number_scheduled }}
          </template>
        </a-alert>

        <a-tabs default-active-key="1">
          <a-tab-pane key="1" tab="基本信息">
            <div class="details-grid">
              <div class="detail-card">
                <h4><DeploymentUnitOutlined /> 基本信息</h4>
                <div class="detail-item">
                  <div class="detail-label">名称:</div>
                  <div class="detail-value">{{ currentDaemonSet.name }}</div>
                </div>
                <div class="detail-item">
                  <div class="detail-label">命名空间:</div>
                  <div class="detail-value">{{ currentDaemonSet.namespace }}</div>
                </div>
                <div class="detail-item">
                  <div class="detail-label">状态:</div>
                  <div class="detail-value">
                    <a-badge 
                      :status="getStatusBadgeType(currentDaemonSet.status)" 
                      :text="currentDaemonSet.status"
                    />
                  </div>
                </div>
                <div class="detail-item">
                  <div class="detail-label">创建时间:</div>
                  <div class="detail-value">{{ formatDateTime(currentDaemonSet.creation_timestamp) }}</div>
                </div>
              </div>

              <div class="detail-card">
                <h4><NodeIndexOutlined /> Pod状态</h4>
                <div class="detail-item">
                  <div class="detail-label">期望调度数:</div>
                  <div class="detail-value">{{ currentDaemonSet.desired_number_scheduled }}</div>
                </div>
                <div class="detail-item">
                  <div class="detail-label">当前调度数:</div>
                  <div class="detail-value">{{ currentDaemonSet.current_number_scheduled }}</div>
                </div>
                <div class="detail-item">
                  <div class="detail-label">就绪数:</div>
                  <div class="detail-value">{{ currentDaemonSet.number_ready }}</div>
                </div>
                <div class="detail-item">
                  <div class="detail-label">可用数:</div>
                  <div class="detail-value">{{ currentDaemonSet.number_available }}</div>
                </div>
                <div class="detail-item">
                  <div class="detail-label">不可用数:</div>
                  <div class="detail-value">{{ currentDaemonSet.number_unavailable }}</div>
                </div>
              </div>
            </div>
          </a-tab-pane>

          <a-tab-pane key="2" tab="容器镜像">
            <div class="images-list">
              <a-empty v-if="!currentDaemonSet.images?.length" description="暂无镜像信息" />
              <div v-for="image in currentDaemonSet.images" :key="image" class="image-item">
                <a-tag color="green">{{ image }}</a-tag>
                <a-button type="text" size="small" @click="copyToClipboard(image)">
                  <template #icon><CopyOutlined /></template>
                  复制
                </a-button>
              </div>
            </div>
          </a-tab-pane>

          <a-tab-pane key="3" tab="事件" @click="loadDaemonSetEvents">
            <div class="events-container">
              <a-spin :spinning="eventsLoading">
                <a-timeline>
                  <a-timeline-item 
                    v-for="(event, index) in daemonsetEvents" 
                    :key="index"
                    :color="event.type === 'Normal' ? 'green' : 'red'"
                  >
                    <div class="event-card">
                      <div class="event-header">
                        <span class="event-reason">{{ event.reason }}</span>
                        <span class="event-time">{{ formatDateTime(event.lastTimestamp) }}</span>
                      </div>
                      <div class="event-message">{{ event.message }}</div>
                      <div class="event-meta">
                        <span><strong>类型:</strong> {{ event.type }}</span>
                        <span><strong>来源:</strong> {{ event.source }}</span>
                        <span><strong>次数:</strong> {{ event.count }}</span>
                      </div>
                    </div>
                  </a-timeline-item>
                </a-timeline>
                <a-empty v-if="!daemonsetEvents.length && !eventsLoading" description="暂无事件" />
              </a-spin>
            </div>
          </a-tab-pane>
        </a-tabs>
      </div>
    </a-modal>

    <!-- YAML查看模态框 -->
    <a-modal
      v-model:open="yamlModalVisible"
      title="DaemonSet YAML配置"
      width="800px"
      :footer="null"
      class="yaml-modal"
    >
      <div class="yaml-content">
        <div class="yaml-actions">
          <a-button type="primary" @click="copyYamlToClipboard" size="small">
            <template #icon><CopyOutlined /></template>
            复制YAML
          </a-button>
        </div>
        <pre class="yaml-display"><code>{{ currentYaml }}</code></pre>
      </div>
    </a-modal>

    <!-- 历史版本模态框 -->
    <a-modal
      v-model:open="historyModalVisible"
      title="DaemonSet历史版本"
      width="700px"
      :footer="null"
      class="history-modal"
    >
      <div class="history-content">
        <a-spin :spinning="historyLoading">
          <a-table
            :columns="[
              { title: '版本', dataIndex: 'revision', key: 'revision', width: '20%' },
              { title: '变更原因', dataIndex: 'changeReason', key: 'changeReason', width: '40%' },
              { title: '创建时间', dataIndex: 'creationTimestamp', key: 'creationTimestamp', width: '30%' },
              { title: '操作', key: 'action', width: '10%' }
            ]"
            :data-source="historyVersions"
            :pagination="false"
            row-key="revision"
          >
            <template #bodyCell="{ column, record }">
              <template v-if="column.key === 'action'">
                <a-button type="primary" ghost size="small" @click="rollbackToVersion(record.revision)">
                  回滚
                </a-button>
              </template>
            </template>
          </a-table>
          <a-empty v-if="!historyVersions.length && !historyLoading" description="暂无历史版本" />
        </a-spin>
      </div>
    </a-modal>
  </div>
</template>

<script lang="ts" setup>
import { ref, computed, onMounted, watch } from 'vue';
import { message } from 'ant-design-vue';
import {
  getDaemonSetListApi,
  createDaemonSetApi,
  deleteDaemonSetApi,
  batchDeleteDaemonSetApi,
  restartDaemonSetApi,
  batchRestartDaemonSetApi,
  getDaemonSetYamlApi,
  getDaemonSetEventsApi,
  pauseDaemonSetApi,
  resumeDaemonSetApi,
  getDaemonSetHistoryApi,
  rollbackDaemonSetApi,
  getAllClustersApi,
  getNamespacesByClusterIdApi,
} from '#/api';
import type { 
  DaemonSetInfo, 
  DaemonSetListReq,
  ContainerPort,
  EnvVar
} from '#/api';
import { 
  CloudServerOutlined, 
  TableOutlined, 
  AppstoreOutlined, 
  ReloadOutlined,
  DeleteOutlined,
  CodeOutlined,
  DeploymentUnitOutlined,
  ClockCircleOutlined,
  CheckCircleOutlined,
  NodeIndexOutlined,
  DatabaseOutlined,
  CopyOutlined,
  ClusterOutlined,
  PartitionOutlined,
  PlusOutlined,
  EditOutlined,
  EyeOutlined,
  HistoryOutlined,
  FilterOutlined,
  RedoOutlined,
  MoreOutlined,
  PauseCircleOutlined,
  PlayCircleOutlined,
  RollbackOutlined
} from '@ant-design/icons-vue';

// 状态变量
const loading = ref(false);
const clustersLoading = ref(false);
const namespacesLoading = ref(false);
const daemonsets = ref<DaemonSetInfo[]>([]);
const searchText = ref('');
const statusFilter = ref<string>();
const selectedRows = ref<DaemonSetInfo[]>([]);
const namespaces = ref<string[]>(['default']);
const selectedNamespace = ref<string>('default');
const isCreateModalVisible = ref(false);
const clusters = ref<Array<{id: number, name: string}>>([]);
const selectedCluster = ref<number>();
const viewMode = ref<'table' | 'card'>('table');
const selectedCardIds = ref<string[]>([]);
const currentPage = ref(1);
const pageSize = ref(12);
const totalItems = ref(0);

// 根据卡片选择更新 selectedRows
watch(selectedCardIds, (newValue) => {
  selectedRows.value = daemonsets.value.filter(ds => 
    newValue.includes(ds.uid)
  );
});

// 表格列配置
const columns = [
  {
    title: 'DaemonSet 名称',
    dataIndex: 'name',
    key: 'name',
    width: '20%',
    sorter: (a: DaemonSetInfo, b: DaemonSetInfo) => a.name.localeCompare(b.name),
  },
  {
    title: '命名空间',
    dataIndex: 'namespace',
    key: 'namespace',
    width: '15%',
    sorter: (a: DaemonSetInfo, b: DaemonSetInfo) => a.namespace.localeCompare(b.namespace),
  },
  {
    title: 'Pod 状态',
    dataIndex: 'podStatus',
    key: 'podStatus',
    width: '25%',
  },
  {
    title: '状态',
    dataIndex: 'status',
    key: 'status',
    width: '10%',
    sorter: (a: DaemonSetInfo, b: DaemonSetInfo) => a.status.localeCompare(b.status),
  },
  {
    title: '创建时间',
    dataIndex: 'creation_timestamp',
    key: 'creationTimestamp',
    width: '15%',
    sorter: (a: DaemonSetInfo, b: DaemonSetInfo) => new Date(a.creation_timestamp).getTime() - new Date(b.creation_timestamp).getTime(),
  },
  {
    title: '操作',
    key: 'action',
    width: '15%',
    fixed: 'right',
  },
];

// 计算属性
const filteredDaemonSets = computed(() => {
  let result = daemonsets.value;
  
  if (statusFilter.value) {
    result = result.filter(ds => ds.status === statusFilter.value);
  }
  
  const searchValue = searchText.value.toLowerCase().trim();
  if (searchValue) {
    result = result.filter(ds => 
      ds.name.toLowerCase().includes(searchValue)
    );
  }
  
  return result;
});

const runningDaemonSets = computed(() => 
  daemonsets.value.filter(ds => ds.status === 'Running').length
);

const totalDesiredPods = computed(() => 
  daemonsets.value.reduce((total, ds) => total + (ds.desired_number_scheduled || 0), 0)
);

const totalReadyPods = computed(() => 
  daemonsets.value.reduce((total, ds) => total + (ds.number_ready || 0), 0)
);

// 表格选择配置
const rowSelection = {
  onChange: (_: string[], selectedRowsData: DaemonSetInfo[]) => {
    selectedRows.value = selectedRowsData;
    selectedCardIds.value = selectedRowsData.map(row => row.uid);
  },
  getCheckboxProps: (_: DaemonSetInfo) => ({
    disabled: false,
  }),
};

// 格式化日期
const formatDate = (dateString: string) => {
  if (!dateString) return '-';
  const date = new Date(dateString);
  return `${date.getMonth() + 1}月${date.getDate()}日 ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
};

// API 方法
const getClusters = async () => {
  clustersLoading.value = true;
  try {
    const res = await getAllClustersApi();
    clusters.value = res ?? [];
    if (clusters.value.length > 0 && !selectedCluster.value) {
      selectedCluster.value = clusters.value[0]?.id;
      if (selectedCluster.value) {
        await getNamespaces();
        await getDaemonSets(1, pageSize.value);
      }
    }
  } catch (error: any) {
    message.error(error.message || '获取集群列表失败');
  } finally {
    clustersLoading.value = false;
  }
};

const getNamespaces = async () => {
  if (!selectedCluster.value) {
    message.warning('请先选择集群');
    return;
  }

  namespacesLoading.value = true;
  try {
    const res = await getNamespacesByClusterIdApi(selectedCluster.value);
    namespaces.value = res.map((ns: { name: string }) => ns.name);
    if (namespaces.value.length > 0) {
      selectedNamespace.value = namespaces.value[0] || 'default';
    }
  } catch (error: any) {
    message.error(error.message || '获取命名空间列表失败');
    namespaces.value = ['default'];
    selectedNamespace.value = 'default';
  } finally {
    namespacesLoading.value = false;
  }
};

const getDaemonSets = async (page = 1, size = pageSize.value) => {
  if (!selectedCluster.value || !selectedNamespace.value) {
    message.warning('请先选择集群和命名空间');
    return;
  }
  
  loading.value = true;
  try {
    const params: DaemonSetListReq = {
      cluster_id: selectedCluster.value,
      namespace: selectedNamespace.value,
      page,
      page_size: size,
      status: statusFilter.value
    };
    
    const res = await getDaemonSetListApi(params);
    daemonsets.value = res || [];
    totalItems.value = daemonsets.value.length;
    currentPage.value = page;
    selectedRows.value = [];
    selectedCardIds.value = [];
  } catch (error: any) {
    message.error(error.message || '获取DaemonSet列表失败');
    daemonsets.value = [];
    totalItems.value = 0;
  } finally {
    loading.value = false;
  }
};

// 刷新数据
const refreshData = () => {
  getDaemonSets(currentPage.value, pageSize.value);
};

// 搜索
const onSearch = () => {
  // 搜索逻辑已经在计算属性中实现
};

// 筛选处理
const handleFilterChange = () => {
  currentPage.value = 1;
  getDaemonSets(1, pageSize.value);
};

// 批量重启
const handleBatchRestart = async () => {
  if (!selectedRows.value.length || !selectedCluster.value) return;
  
  try {
    loading.value = true;
    await batchRestartDaemonSetApi(
      selectedCluster.value,
      selectedNamespace.value,
      selectedRows.value.map(ds => ds.name)
    );
    
    message.success(`成功重启 ${selectedRows.value.length} 个DaemonSet`);
    selectedRows.value = [];
    selectedCardIds.value = [];
    getDaemonSets(currentPage.value, pageSize.value);
  } catch (error: any) {
    message.error(error.message || '批量重启失败');
  } finally {
    loading.value = false;
  }
};

// 批量删除DaemonSet
const handleBatchDelete = async () => {
  if (!selectedRows.value.length || !selectedCluster.value) return;
  
  try {
    loading.value = true;
    await batchDeleteDaemonSetApi({
      cluster_id: selectedCluster.value,
      namespace: selectedNamespace.value,
      names: selectedRows.value.map(ds => ds.name)
    });
    
    message.success(`成功删除 ${selectedRows.value.length} 个DaemonSet`);
    selectedRows.value = [];
    selectedCardIds.value = [];
    getDaemonSets(currentPage.value, pageSize.value);
  } catch (error: any) {
    message.error(error.message || '批量删除失败');
  } finally {
    loading.value = false;
  }
};

// 切换命名空间
const handleNamespaceChange = () => {
  currentPage.value = 1;
  getDaemonSets(1, pageSize.value);
};

// 切换集群
const handleClusterChange = () => {
  selectedNamespace.value = 'default';
  daemonsets.value = [];
  currentPage.value = 1;
  totalItems.value = 0;
  getNamespaces();
  getDaemonSets(1, pageSize.value);
};

// 分页处理
const handleTableChange = (pagination: any) => {
  currentPage.value = pagination.current;
  pageSize.value = pagination.pageSize;
  getDaemonSets(pagination.current, pagination.pageSize);
};

// 新增状态变量
const detailsModalVisible = ref(false);
const yamlModalVisible = ref(false);
const historyModalVisible = ref(false);
const eventsLoading = ref(false);
const historyLoading = ref(false);
const currentDaemonSet = ref<DaemonSetInfo | null>(null);
const currentYaml = ref('');
const daemonsetEvents = ref<any[]>([]);
const historyVersions = ref<any[]>([]);

// 创建表单
const createForm = ref<{
  name: string;
  image: string;
  ports: ContainerPort[];
  env: EnvVar[];
}>({
  name: '',
  image: '',
  ports: [{ container_port: 80, protocol: 'TCP' }],
  env: [{ name: '', value: '' }]
});

// 工具方法
const getPodReadyPercentage = (daemonset: DaemonSetInfo) => {
  if (!daemonset.desired_number_scheduled) return 0;
  return Math.round((daemonset.number_ready / daemonset.desired_number_scheduled) * 100);
};

const getStatusBadgeType = (status: string) => {
  switch (status) {
    case 'Running':
      return 'success';
    case 'Pending':
      return 'processing';
    case 'Failed':
      return 'error';
    default:
      return 'default';
  }
};

const formatDateTime = (dateString: string): string => {
  if (!dateString) return '-';
  const date = new Date(dateString);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}:${String(date.getSeconds()).padStart(2, '0')}`;
};

// 表单操作方法
const addPort = () => {
  createForm.value.ports.push({ container_port: 80, protocol: 'TCP' });
};

const removePort = (index: number) => {
  createForm.value.ports.splice(index, 1);
};

const addEnv = () => {
  createForm.value.env.push({ name: '', value: '' });
};

const removeEnv = (index: number) => {
  createForm.value.env.splice(index, 1);
};

// 创建DaemonSet
const handleCreateConfirm = async () => {
  if (!selectedCluster.value || !selectedNamespace.value) {
    message.warning('请先选择集群和命名空间');
    return;
  }

  if (!createForm.value.name || !createForm.value.image) {
    message.warning('请填写必要信息');
    return;
  }

  try {
    loading.value = true;
    await createDaemonSetApi({
      cluster_id: selectedCluster.value,
      namespace: selectedNamespace.value,
      name: createForm.value.name,
      image: createForm.value.image,
      ports: createForm.value.ports.filter(p => p.container_port),
      env: createForm.value.env.filter(e => e.name)
    });

    message.success('DaemonSet创建成功');
    isCreateModalVisible.value = false;
    resetCreateForm();
    getDaemonSets(currentPage.value, pageSize.value);
  } catch (error: any) {
    message.error(error.message || 'DaemonSet创建失败');
  } finally {
    loading.value = false;
  }
};

const handleCreateCancel = () => {
  isCreateModalVisible.value = false;
  resetCreateForm();
};

const resetCreateForm = () => {
  createForm.value = {
    name: '',
    image: '',
    ports: [{ container_port: 80, protocol: 'TCP' }],
    env: [{ name: '', value: '' }]
  };
};

// DaemonSet操作方法
const viewDetails = async (daemonset: DaemonSetInfo) => {
  currentDaemonSet.value = daemonset;
  detailsModalVisible.value = true;
};

const viewYaml = async (daemonset: DaemonSetInfo) => {
  try {
    loading.value = true;
    const yaml = await getDaemonSetYamlApi(selectedCluster.value!, daemonset.namespace, daemonset.name);
    currentYaml.value = yaml;
    yamlModalVisible.value = true;
  } catch (error: any) {
    message.error(error.message || '获取YAML失败');
  } finally {
    loading.value = false;
  }
};

const viewHistory = async (daemonset: DaemonSetInfo) => {
  try {
    historyLoading.value = true;
    currentDaemonSet.value = daemonset;
    const history = await getDaemonSetHistoryApi(selectedCluster.value!, daemonset.namespace, daemonset.name);
    historyVersions.value = history || [];
    historyModalVisible.value = true;
  } catch (error: any) {
    message.error(error.message || '获取历史版本失败');
  } finally {
    historyLoading.value = false;
  }
};

const handleEdit = (_: DaemonSetInfo) => {
  message.info('编辑功能开发中...');
};

const handleRestart = async (daemonset: DaemonSetInfo) => {
  try {
    loading.value = true;
    await restartDaemonSetApi({
      cluster_id: selectedCluster.value!,
      namespace: daemonset.namespace,
      name: daemonset.name
    });
    message.success('DaemonSet重启成功');
    getDaemonSets(currentPage.value, pageSize.value);
  } catch (error: any) {
    message.error(error.message || 'DaemonSet重启失败');
  } finally {
    loading.value = false;
  }
};

const handlePause = async (daemonset: DaemonSetInfo) => {
  try {
    loading.value = true;
    await pauseDaemonSetApi(selectedCluster.value!, daemonset.namespace, daemonset.name);
    message.success('DaemonSet更新已暂停');
    getDaemonSets(currentPage.value, pageSize.value);
  } catch (error: any) {
    message.error(error.message || '暂停更新失败');
  } finally {
    loading.value = false;
  }
};

const handleResume = async (daemonset: DaemonSetInfo) => {
  try {
    loading.value = true;
    await resumeDaemonSetApi(selectedCluster.value!, daemonset.namespace, daemonset.name);
    message.success('DaemonSet更新已恢复');
    getDaemonSets(currentPage.value, pageSize.value);
  } catch (error: any) {
    message.error(error.message || '恢复更新失败');
  } finally {
    loading.value = false;
  }
};

const handleRollback = async (daemonset: DaemonSetInfo) => {
  try {
    loading.value = true;
    await rollbackDaemonSetApi(selectedCluster.value!, daemonset.namespace, daemonset.name);
    message.success('DaemonSet回滚成功');
    getDaemonSets(currentPage.value, pageSize.value);
  } catch (error: any) {
    message.error(error.message || 'DaemonSet回滚失败');
  } finally {
    loading.value = false;
  }
};

const handleDelete = async (daemonset: DaemonSetInfo) => {
  try {
    loading.value = true;
    await deleteDaemonSetApi({
      cluster_id: selectedCluster.value!,
      namespace: daemonset.namespace,
      name: daemonset.name
    });
    message.success('DaemonSet删除成功');
    getDaemonSets(currentPage.value, pageSize.value);
  } catch (error: any) {
    message.error(error.message || 'DaemonSet删除失败');
  } finally {
    loading.value = false;
  }
};

// 事件加载
const loadDaemonSetEvents = async () => {
  if (!currentDaemonSet.value) return;
  
  try {
    eventsLoading.value = true;
    const events = await getDaemonSetEventsApi(
      selectedCluster.value!,
      currentDaemonSet.value.namespace,
      currentDaemonSet.value.name
    );
    daemonsetEvents.value = events || [];
  } catch (error: any) {
    message.error(error.message || '获取事件失败');
  } finally {
    eventsLoading.value = false;
  }
};

// 版本回滚
const rollbackToVersion = async (revision: number) => {
  if (!currentDaemonSet.value) return;
  
  try {
    loading.value = true;
    await rollbackDaemonSetApi(
      selectedCluster.value!,
      currentDaemonSet.value.namespace,
      currentDaemonSet.value.name,
      revision
    );
    message.success(`成功回滚到版本 ${revision}`);
    historyModalVisible.value = false;
    getDaemonSets(currentPage.value, pageSize.value);
  } catch (error: any) {
    message.error(error.message || '版本回滚失败');
  } finally {
    loading.value = false;
  }
};

// 复制功能
const copyToClipboard = async (text: string) => {
  try {
    await navigator.clipboard.writeText(text);
    message.success('已复制到剪贴板');
  } catch (error) {
    message.error('复制失败');
  }
};

const copyYamlToClipboard = async () => {
  await copyToClipboard(currentYaml.value);
};

// 页面加载时获取数据
onMounted(() => {
  getClusters();
});
</script>

<style>
/* 继承现有样式系统 */

.daemonset-name {
  display: flex;
  align-items: center;
  gap: 10px;
  font-weight: 500;
}

.pod-status-info {
  display: flex;
  align-items: center;
  gap: 8px;
}

.pod-numbers {
  font-weight: 500;
  color: #666;
  font-size: 12px;
}

.port-config, .env-config {
  border: 1px solid #f0f0f0;
  border-radius: 6px;
  padding: 12px;
  background: #fafafa;
}

.port-row, .env-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}

.port-row:last-child, .env-row:last-child {
  margin-bottom: 0;
}

.images-list {
  padding: 16px;
}

.image-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 0;
  border-bottom: 1px solid #f0f0f0;
}

.image-item:last-child {
  border-bottom: none;
}

.yaml-content {
  position: relative;
}

.yaml-actions {
  position: absolute;
  top: 8px;
  right: 8px;
  z-index: 1;
}

.yaml-display {
  background: #2d3748;
  color: #e2e8f0;
  padding: 16px;
  border-radius: 6px;
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
  font-size: 13px;
  line-height: 1.5;
  max-height: 500px;
  overflow: auto;
  white-space: pre-wrap;
  word-break: break-all;
}

.history-content {
  min-height: 200px;
}

.event-card {
  padding: 12px;
  background: #f9f9f9;
  border-radius: 6px;
  margin-bottom: 8px;
}

.event-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.event-reason {
  font-weight: 600;
  color: #1890ff;
}

.event-time {
  font-size: 12px;
  color: #999;
}

.event-message {
  margin-bottom: 8px;
  color: #333;
}

.event-meta {
  display: flex;
  gap: 16px;
  font-size: 12px;
  color: #666;
}

.daemonset-cards .cluster-card {
  margin-bottom: 16px;
}

.daemonset-title {
  display: flex;
  align-items: center;
  gap: 8px;
}

.daemonset-title h3 {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
}

.card-action-footer {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.card-action-footer .ant-btn {
  flex: 1;
  min-width: 80px;
}
</style>
