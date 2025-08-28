<template>
  <div class="cluster-management-container container-management-container">
    <!-- 页面头部 -->
    <div class="page-header">
      <div class="header-content">
        <div class="title-section">
          <div class="page-title">
            <ContainerOutlined class="title-icon" />
            <h1>Kubernetes 容器管理</h1>
          </div>
          <p class="page-subtitle">管理和监控集群中的所有容器实例</p>
        </div>
        <div class="header-actions">
          <a-button type="primary" size="large" @click="refreshContainers" :loading="loading">
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
          <DashboardOutlined />
        </div>
        <div class="card-info">
          <div class="card-number">{{ containers.length }}</div>
          <div class="card-label">容器总数</div>
        </div>
      </div>
      
      <div class="overview-card running-clusters">
        <div class="card-icon">
          <CheckCircleOutlined />
        </div>
        <div class="card-info">
          <div class="card-number">{{ runningContainersCount }}</div>
          <div class="card-label">运行中</div>
        </div>
      </div>
      
      <div class="overview-card env-types">
        <div class="card-icon">
          <WarningOutlined />
        </div>
        <div class="card-info">
          <div class="card-number">{{ problemContainersCount }}</div>
          <div class="card-label">问题容器</div>
        </div>
      </div>
      
      <div class="overview-card resources">
        <div class="card-icon">
          <BarChartOutlined />
        </div>
        <div class="card-info">
          <div class="card-number">{{ totalImageCount }}</div>
          <div class="card-label">镜像数量</div>
        </div>
      </div>
    </div>

    <!-- 工具栏 -->
    <div class="toolbar">
      <div class="toolbar-left">
        <a-space size="middle">
          <div class="filter-group">
            <label>集群:</label>
            <a-select
              v-model:value="selectedCluster"
              placeholder="选择集群"
              style="width: 160px"
              :loading="clustersLoading"
              @change="onClusterChange"
              allowClear
            >
              <a-select-option
                v-for="cluster in clusters"
                :key="cluster.id"
                :value="cluster.id"
              >
                {{ cluster.name }}
              </a-select-option>
            </a-select>
          </div>
          
          <div class="filter-group">
            <label>命名空间:</label>
            <a-select
              v-model:value="selectedNamespace"
              placeholder="选择命名空间"
              style="width: 160px"
              :loading="namespacesLoading"
              @change="onNamespaceChange"
              allowClear
            >
              <a-select-option
                v-for="ns in namespaces"
                :key="ns.name"
                :value="ns.name"
              >
                {{ ns.name }}
              </a-select-option>
            </a-select>
          </div>

          <div class="filter-group">
            <label>状态:</label>
            <a-select
              v-model:value="selectedStatus"
              placeholder="选择状态"
              style="width: 120px"
              @change="filterContainers"
              allowClear
            >
              <a-select-option value="running">运行中</a-select-option>
              <a-select-option value="waiting">等待中</a-select-option>
              <a-select-option value="terminated">已终止</a-select-option>
            </a-select>
          </div>

          <a-input-search
            v-model:value="searchQuery"
            placeholder="搜索容器名称、镜像或Pod"
            style="width: 240px"
            @search="filterContainers"
            @change="filterContainers"
            allowClear
          />
        </a-space>
      </div>
      
      <div class="toolbar-right">
        <a-radio-group v-model:value="viewMode" button-style="solid" size="middle">
          <a-radio-button value="table">
            <UnorderedListOutlined />
            表格
          </a-radio-button>
          <a-radio-button value="card">
            <AppstoreOutlined />
            卡片
          </a-radio-button>
        </a-radio-group>
      </div>
    </div>

    <!-- 表格视图 -->
    <div v-if="viewMode === 'table'" class="table-container">
      <a-table
        :columns="columns"
        :data-source="filteredContainers"
        :loading="loading"
        :pagination="{
          current: currentPage,
          pageSize: pageSize,
          total: filteredContainers.length,
          showSizeChanger: true,
          showQuickJumper: true,
          showTotal: (total: number, range: [number, number]) => `第 ${range[0]}-${range[1]} 条，共 ${total} 条`,
          onChange: onPageChange,
          onShowSizeChange: onPageSizeChange,
        }"
        :scroll="{ x: 1500 }"
        size="middle"
        :row-selection="{
          selectedRowKeys: selectedRowKeys,
          onChange: onSelectChange,
        }"
      >
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'name'">
            <div class="container-name-cell">
              <ContainerOutlined class="container-icon" />
              <div class="container-info">
                <div class="container-name">{{ record.name }}</div>
                <div class="pod-name">Pod: {{ record.pod_name }}</div>
              </div>
            </div>
          </template>
          
          <template v-else-if="column.key === 'image'">
            <div class="image-cell">
              <a-tooltip :title="record.image">
                <div class="image-name">{{ record.image_short }}</div>
              </a-tooltip>
              <a-tag v-if="record.image_pull_policy" size="small" color="blue">
                {{ record.image_pull_policy }}
              </a-tag>
            </div>
          </template>
          
          <template v-else-if="column.key === 'status'">
            <a-tag :color="getStatusColor(record.state)" class="status-tag">
              <template #icon>
                <LoadingOutlined v-if="record.state === 'waiting'" />
                <CheckCircleOutlined v-else-if="record.state === 'running'" />
                <ExclamationCircleOutlined v-else />
              </template>
              {{ getStatusText(record.state) }}
            </a-tag>
          </template>
          
          <template v-else-if="column.key === 'ready'">
            <a-tag :color="record.ready ? 'success' : 'error'" class="ready-tag">
              {{ record.ready ? '就绪' : '未就绪' }}
            </a-tag>
          </template>
          
          <template v-else-if="column.key === 'restarts'">
            <div class="restart-count">
              <span :class="{ 'high-restarts': record.restart_count > 5 }">
                {{ record.restart_count }}
              </span>
            </div>
          </template>
          
          <template v-else-if="column.key === 'resources'">
            <div class="resources-cell">
              <div v-if="record.resources?.requests" class="resource-info">
                <small>请求:</small>
                <div class="resource-values">
                  <span v-if="record.resources.requests.cpu">CPU: {{ record.resources.requests.cpu }}</span>
                  <span v-if="record.resources.requests.memory">内存: {{ record.resources.requests.memory }}</span>
                </div>
              </div>
              <div v-if="record.resources?.limits" class="resource-info">
                <small>限制:</small>
                <div class="resource-values">
                  <span v-if="record.resources.limits.cpu">CPU: {{ record.resources.limits.cpu }}</span>
                  <span v-if="record.resources.limits.memory">内存: {{ record.resources.limits.memory }}</span>
                </div>
              </div>
            </div>
          </template>
          
          <template v-else-if="column.key === 'ports'">
            <div class="ports-cell">
              <a-tag v-for="port in record.ports" :key="port.container_port" size="small">
                {{ port.container_port }}
                <span v-if="port.protocol">/{{ port.protocol }}</span>
              </a-tag>
            </div>
          </template>

          <template v-else-if="column.key === 'actions'">
            <div class="action-buttons">
              <a-dropdown :trigger="['click']">
                <a-button type="link" size="small">
                  操作 <DownOutlined />
                </a-button>
                <template #overlay>
                  <a-menu>
                    <a-menu-item key="details" @click="showContainerDetails(record)">
                      <EyeOutlined />
                      查看详情
                    </a-menu-item>
                    <a-menu-item key="logs" @click="showContainerLogs(record)">
                      <FileTextOutlined />
                      查看日志
                    </a-menu-item>
                    <a-menu-item key="exec" @click="execIntoContainer(record)">
                      进入容器
                    </a-menu-item>
                    <a-menu-divider />
                    <a-menu-item key="restart" @click="restartContainer(record)" danger>
                      <ReloadOutlined />
                      重启容器
                    </a-menu-item>
                  </a-menu>
                </template>
              </a-dropdown>
            </div>
          </template>
        </template>
      </a-table>
    </div>

    <!-- 卡片视图 -->
    <div v-else-if="viewMode === 'card'" class="cards-container">
      <div class="cards-grid">
        <div
          v-for="container in paginatedContainers"
          :key="`${container.namespace}-${container.pod_name}-${container.name}`"
          class="container-card"
          :class="{ selected: selectedRowKeys.includes(`${container.namespace}-${container.pod_name}-${container.name}`) }"
          @click="toggleCardSelection(`${container.namespace}-${container.pod_name}-${container.name}`)"
        >
          <div class="card-header">
            <div class="container-info">
              <div class="container-name">
                <ContainerOutlined class="container-icon" />
                {{ container.name }}
              </div>
              <div class="pod-info">Pod: {{ container.pod_name }}</div>
            </div>
            <div class="container-status">
              <a-tag :color="getStatusColor(container.state)" class="status-tag">
                {{ getStatusText(container.state) }}
              </a-tag>
            </div>
          </div>
          
          <div class="card-content">
            <div class="image-info">
              <strong>镜像:</strong>
              <a-tooltip :title="container.image">
                <div class="image-name">{{ container.image_short }}</div>
              </a-tooltip>
            </div>
            
            <div class="basic-info">
              <div class="info-item">
                <strong>命名空间:</strong> {{ container.namespace }}
              </div>
              <div class="info-item">
                <strong>就绪状态:</strong>
                <a-tag :color="container.ready ? 'success' : 'error'" size="small">
                  {{ container.ready ? '就绪' : '未就绪' }}
                </a-tag>
              </div>
              <div class="info-item">
                <strong>重启次数:</strong>
                <span :class="{ 'high-restarts': container.restart_count > 5 }">
                  {{ container.restart_count }}
                </span>
              </div>
            </div>

            <div v-if="container.ports && container.ports.length > 0" class="ports-info">
              <strong>端口:</strong>
              <div class="ports-list">
                <a-tag v-for="port in container.ports" :key="port.container_port" size="small">
                  {{ port.container_port }}{{ port.protocol ? `/${port.protocol}` : '' }}
                </a-tag>
              </div>
            </div>

            <div v-if="container.resources" class="resources-info">
              <strong>资源配置:</strong>
              <div class="resource-details">
                <div v-if="container.resources.requests" class="resource-item">
                  <small>请求:</small>
                  <span v-if="container.resources.requests.cpu">CPU: {{ container.resources.requests.cpu }}</span>
                  <span v-if="container.resources.requests.memory">内存: {{ container.resources.requests.memory }}</span>
                </div>
                <div v-if="container.resources.limits" class="resource-item">
                  <small>限制:</small>
                  <span v-if="container.resources.limits.cpu">CPU: {{ container.resources.limits.cpu }}</span>
                  <span v-if="container.resources.limits.memory">内存: {{ container.resources.limits.memory }}</span>
                </div>
              </div>
            </div>
          </div>
          
          <div class="card-actions">
            <a-button size="small" @click.stop="showContainerDetails(container)">
              <EyeOutlined />
              详情
            </a-button>
            <a-button size="small" @click.stop="showContainerLogs(container)">
              <FileTextOutlined />
              日志
            </a-button>
            <a-button size="small" @click.stop="execIntoContainer(container)">
              进入
            </a-button>
            <a-dropdown :trigger="['click']" @click.stop>
              <a-button size="small">
                <MoreOutlined />
              </a-button>
              <template #overlay>
                <a-menu>
                  <a-menu-item key="restart" @click="restartContainer(container)" danger>
                    <ReloadOutlined />
                    重启容器
                  </a-menu-item>
                </a-menu>
              </template>
            </a-dropdown>
          </div>
        </div>
      </div>
      
      <!-- 卡片视图分页 -->
      <div class="cards-pagination">
        <a-pagination
          v-model:current="currentPage"
          v-model:page-size="pageSize"
          :total="filteredContainers.length"
          :show-size-changer="true"
          :show-quick-jumper="true"
          :show-total="(total: number, range: [number, number]) => `第 ${range[0]}-${range[1]} 条，共 ${total} 条`"
          @change="onPageChange"
          @show-size-change="onPageSizeChange"
        />
      </div>
    </div>

    <!-- 批量操作栏 -->
    <div v-if="selectedRowKeys.length > 0" class="batch-actions">
      <div class="batch-info">
        已选择 {{ selectedRowKeys.length }} 个容器
      </div>
      <div class="batch-buttons">
        <a-button @click="batchViewLogs" :loading="batchLoading">
          <FileTextOutlined />
          批量查看日志
        </a-button>
        <a-button @click="batchRestart" danger :loading="batchLoading">
          <ReloadOutlined />
          批量重启
        </a-button>
      </div>
    </div>

    <!-- 容器详情模态框 -->
    <a-modal
      v-model:open="detailsVisible"
      title="容器详情"
      width="800px"
      :footer="null"
      destroy-on-close
    >
      <div v-if="currentContainer" class="container-details">
        <a-alert class="modal-alert" type="info" show-icon>
          <template #message>{{ currentContainer.name }}</template>
          <template #description>
            状态: {{ getStatusText(currentContainer.state) }} | 就绪: {{ currentContainer.ready ? '是' : '否' }} | 重启次数: {{ currentContainer.restart_count }}
          </template>
        </a-alert>

        <a-tabs default-active-key="1">
          <a-tab-pane key="1" tab="基本信息">
            <div class="details-section">
              <a-descriptions :column="2" bordered size="small">
                <a-descriptions-item label="容器名称">{{ currentContainer.name }}</a-descriptions-item>
                <a-descriptions-item label="Pod名称">{{ currentContainer.pod_name }}</a-descriptions-item>
                <a-descriptions-item label="命名空间">{{ currentContainer.namespace }}</a-descriptions-item>
                <a-descriptions-item label="镜像">{{ currentContainer.image }}</a-descriptions-item>
                <a-descriptions-item label="镜像拉取策略">{{ currentContainer.image_pull_policy || '默认' }}</a-descriptions-item>
                <a-descriptions-item label="状态">
                  <a-tag :color="getStatusColor(currentContainer.state)">
                    {{ getStatusText(currentContainer.state) }}
                  </a-tag>
                </a-descriptions-item>
                <a-descriptions-item label="就绪状态">
                  <a-tag :color="currentContainer.ready ? 'success' : 'error'">
                    {{ currentContainer.ready ? '就绪' : '未就绪' }}
                  </a-tag>
                </a-descriptions-item>
                <a-descriptions-item label="重启次数">{{ currentContainer.restart_count }}</a-descriptions-item>
              </a-descriptions>
            </div>
          </a-tab-pane>

          <a-tab-pane key="2" tab="资源配置">
            <div class="details-section">
              <div v-if="currentContainer.resources">
                <h4>资源限制和请求</h4>
                <a-row :gutter="16">
                  <a-col v-if="currentContainer.resources.requests" :span="12">
                    <a-card title="资源请求" size="small">
                      <div v-for="(value, key) in currentContainer.resources.requests" :key="key">
                        <strong>{{ key }}:</strong> {{ value }}
                      </div>
                    </a-card>
                  </a-col>
                  <a-col v-if="currentContainer.resources.limits" :span="12">
                    <a-card title="资源限制" size="small">
                      <div v-for="(value, key) in currentContainer.resources.limits" :key="key">
                        <strong>{{ key }}:</strong> {{ value }}
                      </div>
                    </a-card>
                  </a-col>
                </a-row>
              </div>
              <a-empty v-else description="未配置资源限制" />
            </div>
          </a-tab-pane>

          <a-tab-pane key="3" tab="端口配置">
            <div class="details-section">
              <div v-if="currentContainer.ports && currentContainer.ports.length > 0">
                <a-table
                  :columns="portColumns"
                  :data-source="currentContainer.ports"
                  :pagination="false"
                  size="small"
                />
              </div>
              <a-empty v-else description="未配置端口" />
            </div>
          </a-tab-pane>

          <a-tab-pane key="4" tab="环境变量">
            <div class="details-section">
              <div v-if="currentContainer.env && currentContainer.env.length > 0">
                <a-table
                  :columns="envColumns"
                  :data-source="currentContainer.env"
                  :pagination="false"
                  size="small"
                />
              </div>
              <a-empty v-else description="未配置环境变量" />
            </div>
          </a-tab-pane>

          <a-tab-pane key="5" tab="挂载卷">
            <div class="details-section">
              <div v-if="currentContainer.volume_mounts && currentContainer.volume_mounts.length > 0">
                <a-table
                  :columns="volumeColumns"
                  :data-source="currentContainer.volume_mounts"
                  :pagination="false"
                  size="small"
                />
              </div>
              <a-empty v-else description="未配置挂载卷" />
            </div>
          </a-tab-pane>

          <a-tab-pane key="6" tab="探针配置">
            <div class="details-section">
              <a-row :gutter="16">
                <a-col v-if="currentContainer.liveness_probe" :span="12">
                  <a-card title="存活探针" size="small">
                    <pre>{{ JSON.stringify(currentContainer.liveness_probe, null, 2) }}</pre>
                  </a-card>
                </a-col>
                <a-col v-if="currentContainer.readiness_probe" :span="12">
                  <a-card title="就绪探针" size="small">
                    <pre>{{ JSON.stringify(currentContainer.readiness_probe, null, 2) }}</pre>
                  </a-card>
                </a-col>
              </a-row>
              <a-empty v-if="!currentContainer.liveness_probe && !currentContainer.readiness_probe" description="未配置探针" />
            </div>
          </a-tab-pane>
        </a-tabs>
      </div>
    </a-modal>

    <!-- 容器日志模态框 -->
    <a-modal
      v-model:open="logsVisible"
      title="容器日志"
      width="1000px"
      :footer="null"
      destroy-on-close
    >
      <div v-if="currentContainer" class="logs-container">
        <div class="logs-header">
          <a-space>
            <span>容器: {{ currentContainer.name }}</span>
            <span>Pod: {{ currentContainer.pod_name }}</span>
            <a-select v-model:value="logLines" @change="getContainerLogs" style="width: 120px">
              <a-select-option value="100">最近100行</a-select-option>
              <a-select-option value="500">最近500行</a-select-option>
              <a-select-option value="1000">最近1000行</a-select-option>
            </a-select>
            <a-button @click="getContainerLogs" :loading="logsLoading">
              <ReloadOutlined />
              刷新
            </a-button>
          </a-space>
        </div>
        
        <div class="logs-content">
          <a-textarea
            v-model:value="containerLogs"
            :rows="25"
            readonly
            class="logs-textarea"
            placeholder="日志加载中..."
          />
        </div>
      </div>
    </a-modal>

    <!-- 进入容器模态框 -->
    <a-modal
      v-model:open="execVisible"
      title="进入容器"
      width="800px"
      :footer="null"
      destroy-on-close
    >
      <div v-if="currentContainer" class="exec-container">
        <a-alert class="modal-alert" type="info" show-icon>
          <template #message>{{ currentContainer.name }}</template>
          <template #description>
            在容器中执行命令
          </template>
        </a-alert>
        
        <div class="exec-form">
          <a-form layout="vertical">
            <a-form-item label="命令">
              <a-select v-model:value="execCommand" placeholder="选择或输入命令">
                <a-select-option value="/bin/sh">Shell (/bin/sh)</a-select-option>
                <a-select-option value="/bin/bash">Bash (/bin/bash)</a-select-option>
                <a-select-option value="ls -la">列出文件 (ls -la)</a-select-option>
                <a-select-option value="ps aux">查看进程 (ps aux)</a-select-option>
              </a-select>
            </a-form-item>
            <a-form-item>
              <a-button type="primary" @click="executeCommand" :loading="execLoading">
                执行命令
              </a-button>
            </a-form-item>
          </a-form>
        </div>
        
        <div v-if="execResult" class="exec-result">
          <h4>执行结果:</h4>
          <pre class="exec-output">{{ execResult }}</pre>
        </div>
      </div>
    </a-modal>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue';
import { message } from 'ant-design-vue';
import type { TableColumnsType } from 'ant-design-vue';
import {
  ContainerOutlined,
  ReloadOutlined,
  DashboardOutlined,
  CheckCircleOutlined,
  WarningOutlined,
  BarChartOutlined,
  UnorderedListOutlined,
  AppstoreOutlined,
  DownOutlined,
  EyeOutlined,
  FileTextOutlined,

  ExclamationCircleOutlined,
  LoadingOutlined,
  MoreOutlined,
} from '@ant-design/icons-vue';

import { getAllClustersApi } from '#/api/core/k8s_cluster';
import { getNamespacesByClusterIdApi } from '#/api/core/k8s_namespace';
import { 
  getPodListApi, 
  getContainerLogsApi,
  execPodApi,
  restartPodApi,
  type PodInfo,
  type PodContainer 
} from '#/api/core/k8s_pod';

// 响应式数据

// 基础数据
const loading = ref(false);
const clustersLoading = ref(false);
const namespacesLoading = ref(false);
const batchLoading = ref(false);
const logsLoading = ref(false);
const execLoading = ref(false);

// 集群和命名空间
const clusters = ref<Array<{ id: number; name: string }>>([]);
const namespaces = ref<Array<{ name: string }>>([]);
const selectedCluster = ref<number>();
const selectedNamespace = ref<string>();

// 筛选和搜索
const selectedStatus = ref<string>();
const searchQuery = ref<string>('');
const viewMode = ref<'table' | 'card'>('table');

// 容器数据
const pods = ref<PodInfo[]>([]);
const containers = ref<EnhancedContainer[]>([]);
const filteredContainers = ref<EnhancedContainer[]>([]);

// 分页
const currentPage = ref(1);
const pageSize = ref(20);

// 选择
const selectedRowKeys = ref<string[]>([]);

// 模态框状态
const detailsVisible = ref(false);
const logsVisible = ref(false);
const execVisible = ref(false);

// 当前操作的容器
const currentContainer = ref<EnhancedContainer>();

// 日志相关
const containerLogs = ref<string>('');
const logLines = ref('100');

// 执行命令相关
const execCommand = ref<string>('/bin/sh');
const execResult = ref<string>('');

// 接口类型扩展

interface EnhancedContainer extends PodContainer {
  namespace: string;
  pod_name: string;
  cluster_id: number;
  image_short: string;
}

// 计算属性

const runningContainersCount = computed(() => {
  return containers.value.filter(container => container.state === 'running').length;
});

const problemContainersCount = computed(() => {
  return containers.value.filter(container => 
    container.state !== 'running' || !container.ready || container.restart_count > 5
  ).length;
});

const totalImageCount = computed(() => {
  const images = new Set(containers.value.map(container => container.image));
  return images.size;
});

const paginatedContainers = computed(() => {
  const start = (currentPage.value - 1) * pageSize.value;
  const end = start + pageSize.value;
  return filteredContainers.value.slice(start, end);
});

// 表格列配置

const columns: TableColumnsType = [
  {
    title: '容器名称',
    key: 'name',
    dataIndex: 'name',
    width: 220,
    fixed: 'left',
    sorter: (a: EnhancedContainer, b: EnhancedContainer) => a.name.localeCompare(b.name),
  },
  {
    title: '镜像',
    key: 'image',
    dataIndex: 'image',
    width: 200,
    ellipsis: true,
  },
  {
    title: '命名空间',
    key: 'namespace',
    dataIndex: 'namespace',
    width: 120,
    filters: [],
    onFilter: (value: string | number | boolean, record: EnhancedContainer) => record.namespace === value as string,
  },
  {
    title: '状态',
    key: 'status',
    dataIndex: 'state',
    width: 100,
    filters: [
      { text: '运行中', value: 'running' },
      { text: '等待中', value: 'waiting' },
      { text: '已终止', value: 'terminated' },
    ],
    onFilter: (value: string | number | boolean, record: EnhancedContainer) => record.state === value as string,
  },
  {
    title: '就绪',
    key: 'ready',
    dataIndex: 'ready',
    width: 80,
    filters: [
      { text: '就绪', value: true },
      { text: '未就绪', value: false },
    ],
    onFilter: (value: string | number | boolean, record: EnhancedContainer) => record.ready === value as boolean,
  },
  {
    title: '重启次数',
    key: 'restarts',
    dataIndex: 'restart_count',
    width: 100,
    sorter: (a: EnhancedContainer, b: EnhancedContainer) => a.restart_count - b.restart_count,
  },
  {
    title: '资源配置',
    key: 'resources',
    width: 200,
  },
  {
    title: '端口',
    key: 'ports',
    width: 120,
  },
  {
    title: '操作',
    key: 'actions',
    width: 100,
    fixed: 'right',
  },
];

// 端口表格列
const portColumns: TableColumnsType = [
  { title: '名称', dataIndex: 'name', key: 'name' },
  { title: '端口', dataIndex: 'container_port', key: 'container_port' },
  { title: '协议', dataIndex: 'protocol', key: 'protocol' },
  { title: '主机端口', dataIndex: 'host_port', key: 'host_port' },
];

// 环境变量表格列
const envColumns: TableColumnsType = [
  { title: '变量名', dataIndex: 'name', key: 'name' },
  { title: '值', dataIndex: 'value', key: 'value', ellipsis: true },
];

// 挂载卷表格列
const volumeColumns: TableColumnsType = [
  { title: '名称', dataIndex: 'name', key: 'name' },
  { title: '挂载路径', dataIndex: 'mount_path', key: 'mount_path' },
  { title: '只读', dataIndex: 'read_only', key: 'read_only' },
  { title: '子路径', dataIndex: 'sub_path', key: 'sub_path' },
];

// 生命周期

onMounted(() => {
  getClusters();
});

// 监听器

watch([selectedCluster, selectedNamespace], () => {
  if (selectedCluster.value) {
    loadContainers();
  }
});

watch([searchQuery, selectedStatus], () => {
  filterContainers();
});

// 方法

// 获取集群列表
const getClusters = async () => {
  try {
    clustersLoading.value = true;
    const response = await getAllClustersApi();
    clusters.value = response || [];
    
    // 选择第一个集群
    if (clusters.value.length > 0 && clusters.value[0]) {
      selectedCluster.value = clusters.value[0].id;
      await getNamespaces();
    }
  } catch (error) {
    console.error('获取集群列表失败:', error);
    message.error('获取集群列表失败');
  } finally {
    clustersLoading.value = false;
  }
};

// 获取命名空间列表
const getNamespaces = async () => {
  if (!selectedCluster.value) return;
  
  try {
    namespacesLoading.value = true;
    const response = await getNamespacesByClusterIdApi(selectedCluster.value);
    namespaces.value = response || [];
  } catch (error) {
    console.error('获取命名空间列表失败:', error);
    message.error('获取命名空间列表失败');
  } finally {
    namespacesLoading.value = false;
  }
};

// 集群变更处理
const onClusterChange = () => {
  selectedNamespace.value = undefined;
  containers.value = [];
  filteredContainers.value = [];
  if (selectedCluster.value) {
    getNamespaces();
  }
};

// 命名空间变更处理
const onNamespaceChange = () => {
  if (selectedCluster.value) {
    loadContainers();
  }
};

// 加载容器数据
const loadContainers = async () => {
  if (!selectedCluster.value) return;
  
  try {
    loading.value = true;
    
    // 获取Pod列表
    const podRequest: any = {
      cluster_id: selectedCluster.value,
    };
    
    if (selectedNamespace.value) {
      podRequest.namespace = selectedNamespace.value;
    }
    
    const podResponse = await getPodListApi(podRequest);
    pods.value = podResponse || [];
    
    // 获取所有容器信息
    const allContainers: EnhancedContainer[] = [];
    
    for (const pod of pods.value) {
      for (const container of pod.containers) {
        const enhancedContainer: EnhancedContainer = {
          ...container,
          namespace: pod.namespace,
          pod_name: pod.name,
          cluster_id: selectedCluster.value,
          image_short: getShortImageName(container.image),
        };
        allContainers.push(enhancedContainer);
      }
    }
    
    containers.value = allContainers;
    filterContainers();
    
  } catch (error) {
    console.error('获取容器列表失败:', error);
    message.error('获取容器列表失败');
  } finally {
    loading.value = false;
  }
};

// 刷新容器数据
const refreshContainers = () => {
  loadContainers();
};

// 过滤容器
const filterContainers = () => {
  let filtered = [...containers.value];
  
  // 状态筛选
  if (selectedStatus.value) {
    filtered = filtered.filter(container => container.state === selectedStatus.value);
  }
  
  // 搜索筛选
  if (searchQuery.value) {
    const query = searchQuery.value.toLowerCase();
    filtered = filtered.filter(container =>
      container.name.toLowerCase().includes(query) ||
      container.image.toLowerCase().includes(query) ||
      container.pod_name.toLowerCase().includes(query)
    );
  }
  
  filteredContainers.value = filtered;
  currentPage.value = 1;
};

// 获取短镜像名
const getShortImageName = (fullImage: string): string => {
  const parts = fullImage.split('/');
  const nameTag = parts[parts.length - 1] || '';
  return nameTag.length > 30 ? nameTag.substring(0, 30) + '...' : nameTag;
};

// 获取状态颜色
const getStatusColor = (state: string): string => {
  switch (state) {
    case 'running':
      return 'success';
    case 'waiting':
      return 'warning';
    case 'terminated':
      return 'error';
    default:
      return 'default';
  }
};

// 获取状态文本
const getStatusText = (state: string): string => {
  switch (state) {
    case 'running':
      return '运行中';
    case 'waiting':
      return '等待中';
    case 'terminated':
      return '已终止';
    default:
      return '未知';
  }
};

// 分页处理
const onPageChange = (page: number, size: number) => {
  currentPage.value = page;
  pageSize.value = size;
};

const onPageSizeChange = (current: number, size: number) => {
  currentPage.value = current;
  pageSize.value = size;
};

// 选择处理
const onSelectChange = (keys: string[]) => {
  selectedRowKeys.value = keys;
};

const toggleCardSelection = (key: string) => {
  const index = selectedRowKeys.value.indexOf(key);
  if (index > -1) {
    selectedRowKeys.value.splice(index, 1);
  } else {
    selectedRowKeys.value.push(key);
  }
};

// 显示容器详情
const showContainerDetails = (container: EnhancedContainer) => {
  currentContainer.value = container;
  detailsVisible.value = true;
};

// 显示容器日志
const showContainerLogs = async (container: EnhancedContainer) => {
  currentContainer.value = container;
  logsVisible.value = true;
  await getContainerLogs();
};

// 获取容器日志
const getContainerLogs = async () => {
  if (!currentContainer.value) return;
  
  try {
    logsLoading.value = true;
    const response = await getContainerLogsApi(
      currentContainer.value.cluster_id,
      currentContainer.value.pod_name,
      currentContainer.value.name,
      currentContainer.value.namespace,
      parseInt(logLines.value)
    );
    containerLogs.value = response || '';
  } catch (error) {
    console.error('获取容器日志失败:', error);
    message.error('获取容器日志失败');
    containerLogs.value = '获取日志失败';
  } finally {
    logsLoading.value = false;
  }
};

// 进入容器
const execIntoContainer = (container: EnhancedContainer) => {
  currentContainer.value = container;
  execVisible.value = true;
  execResult.value = '';
};

// 执行命令
const executeCommand = async () => {
  if (!currentContainer.value || !execCommand.value) return;
  
  try {
    execLoading.value = true;
    const commands = execCommand.value.split(' ');
    const response = await execPodApi(
      currentContainer.value.cluster_id,
      currentContainer.value.namespace,
      currentContainer.value.pod_name,
      currentContainer.value.name,
      commands
    );
    execResult.value = response || '';
  } catch (error) {
    console.error('执行命令失败:', error);
    message.error('执行命令失败');
    execResult.value = '执行命令失败';
  } finally {
    execLoading.value = false;
  }
};

// 重启容器（通过重启Pod实现）
const restartContainer = async (container: EnhancedContainer) => {
  try {
    loading.value = true;
    await restartPodApi(container.cluster_id, container.namespace, container.pod_name);
    message.success('容器重启指令已发送');
    setTimeout(() => {
      loadContainers();
    }, 2000);
  } catch (error) {
    console.error('重启容器失败:', error);
    message.error('重启容器失败');
  } finally {
    loading.value = false;
  }
};

// 批量查看日志
const batchViewLogs = () => {
  message.info('批量日志查看功能开发中...');
};

// 批量重启
const batchRestart = async () => {
  try {
    batchLoading.value = true;
    
    // 获取选中的容器
    const selectedContainers = containers.value.filter(container => 
      selectedRowKeys.value.includes(`${container.namespace}-${container.pod_name}-${container.name}`)
    );
    
    // 按Pod分组，避免重复重启同一个Pod
    const podsToRestart = new Set<string>();
    selectedContainers.forEach(container => {
      podsToRestart.add(`${container.cluster_id}-${container.namespace}-${container.pod_name}`);
    });
    
    // 逐个重启Pod
    for (const podKey of podsToRestart) {
      const parts = podKey.split('-');
      if (parts.length >= 3 && parts[0] && parts[1]) {
        const clusterId = parts[0];
        const namespace = parts[1];
        const podName = parts.slice(2).join('-'); // 处理pod名称中可能包含'-'的情况
        await restartPodApi(parseInt(clusterId), namespace, podName);
      }
    }
    
    message.success(`已发送 ${podsToRestart.size} 个Pod的重启指令`);
    selectedRowKeys.value = [];
    
    setTimeout(() => {
      loadContainers();
    }, 2000);
    
  } catch (error) {
    console.error('批量重启失败:', error);
    message.error('批量重启失败');
  } finally {
    batchLoading.value = false;
  }
};
</script>

<style scoped>
.container-management-container {
  background: #f5f5f5;
  min-height: calc(100vh - 64px);
}

.container-name-cell {
  display: flex;
  align-items: center;
  gap: 8px;
}

.container-icon {
  color: #1890ff;
  font-size: 16px;
}

.container-info {
  flex: 1;
}

.container-name {
  font-weight: 500;
  color: #262626;
}

.pod-name {
  font-size: 12px;
  color: #8c8c8c;
  margin-top: 2px;
}

.image-cell {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.image-name {
  font-family: 'Monaco', 'Consolas', monospace;
  font-size: 12px;
}

.status-tag {
  display: flex;
  align-items: center;
  gap: 4px;
}

.ready-tag {
  font-size: 12px;
}

.restart-count .high-restarts {
  color: #ff4d4f;
  font-weight: bold;
}

.resources-cell {
  font-size: 12px;
}

.resource-info {
  margin-bottom: 4px;
}

.resource-info small {
  color: #8c8c8c;
  display: block;
}

.resource-values {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.ports-cell {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.container-card {
  background: white;
  border-radius: 8px;
  padding: 16px;
  border: 1px solid #f0f0f0;
  transition: all 0.3s;
  cursor: pointer;
}

.container-card:hover {
  border-color: #1890ff;
  box-shadow: 0 2px 8px rgba(24, 144, 255, 0.15);
}

.container-card.selected {
  border-color: #1890ff;
  background: #f6ffed;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 12px;
}

.card-content {
  margin-bottom: 12px;
}

.image-info {
  margin-bottom: 12px;
}

.image-info .image-name {
  font-family: 'Monaco', 'Consolas', monospace;
  font-size: 12px;
  color: #666;
  margin-top: 4px;
}

.basic-info {
  margin-bottom: 12px;
}

.info-item {
  margin-bottom: 6px;
  font-size: 13px;
}

.info-item strong {
  color: #262626;
  margin-right: 8px;
}

.ports-info, .resources-info {
  margin-bottom: 12px;
  font-size: 13px;
}

.ports-list {
  margin-top: 4px;
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.resource-details {
  margin-top: 4px;
}

.resource-item {
  margin-bottom: 4px;
}

.resource-item small {
  color: #8c8c8c;
  margin-right: 8px;
}

.resource-item span {
  font-size: 12px;
  margin-right: 12px;
}

.card-actions {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
  border-top: 1px solid #f0f0f0;
  padding-top: 12px;
}

.batch-actions {
  position: fixed;
  bottom: 24px;
  left: 50%;
  transform: translateX(-50%);
  background: white;
  border: 1px solid #d9d9d9;
  border-radius: 8px;
  padding: 12px 24px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  display: flex;
  align-items: center;
  gap: 16px;
  z-index: 1000;
}

.batch-info {
  color: #262626;
  font-weight: 500;
}

.batch-buttons {
  display: flex;
  gap: 8px;
}

.logs-container {
  max-height: 600px;
}

.logs-header {
  margin-bottom: 16px;
  padding-bottom: 8px;
  border-bottom: 1px solid #f0f0f0;
}

.logs-content {
  max-height: 500px;
  overflow: auto;
}

.logs-textarea {
  font-family: 'Monaco', 'Consolas', monospace !important;
  font-size: 12px !important;
  line-height: 1.4 !important;
  background: #1e1e1e !important;
  color: #d4d4d4 !important;
  border: none !important;
}

.exec-container {
  max-height: 600px;
  overflow: auto;
}

.exec-form {
  margin: 16px 0;
}

.exec-result {
  margin-top: 16px;
  padding-top: 16px;
  border-top: 1px solid #f0f0f0;
}

.exec-output {
  background: #1e1e1e;
  color: #d4d4d4;
  padding: 12px;
  border-radius: 4px;
  font-family: 'Monaco', 'Consolas', monospace;
  font-size: 12px;
  line-height: 1.4;
  max-height: 300px;
  overflow: auto;
}

.container-details .details-section {
  padding: 16px 0;
}

.container-details .modal-alert {
  margin-bottom: 16px;
}
</style>
