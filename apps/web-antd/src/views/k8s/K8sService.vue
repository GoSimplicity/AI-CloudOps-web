<template>
  <div class="cluster-management-container service-management-container">
    <!-- 页面头部 -->
    <div class="page-header">
      <div class="header-content">
        <div class="title-section">
          <div class="page-title">
            <ApiOutlined class="title-icon" />
            <h1>Kubernetes Service 管理</h1>
          </div>
          <p class="page-subtitle">管理和监控集群中的所有Service资源</p>
        </div>
        <div class="header-actions">
          <a-button type="primary" size="large" @click="showCreateModal">
            <template #icon>
              <PlusOutlined />
            </template>
            创建服务
          </a-button>
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
          <ApiOutlined />
        </div>
        <div class="card-info">
          <div class="card-number">{{ totalItems }}</div>
          <div class="card-label">Service 总数</div>
        </div>
      </div>

      <div class="overview-card running-clusters">
        <div class="card-icon">
          <CheckCircleOutlined />
        </div>
        <div class="card-info">
          <div class="card-number">{{ runningServices }}</div>
          <div class="card-label">运行中服务</div>
        </div>
      </div>

      <div class="overview-card env-types">
        <div class="card-icon">
          <PartitionOutlined />
        </div>
        <div class="card-info">
          <div class="card-number">{{ Object.keys(serviceTypeDistribution).length }}</div>
          <div class="card-label">服务类型</div>
        </div>
      </div>

      <div class="overview-card resource-usage">
        <div class="card-icon">
          <ClusterOutlined />
        </div>
        <div class="card-info">
          <div class="card-number">{{clusters.find(c => c.id === selectedCluster)?.name || '-'}}</div>
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

        <a-select v-model:value="selectedNamespace" placeholder="选择命名空间" class="env-filter namespace-selector"
          :loading="namespacesLoading" @change="handleNamespaceChange">
          <template #suffixIcon>
            <PartitionOutlined />
          </template>
          <a-select-option v-for="ns in namespaces" :key="ns.name" :value="ns.name">
            <span class="namespace-option">
              <AppstoreOutlined />
              {{ ns.name }}
            </span>
          </a-select-option>
        </a-select>

        <a-select v-model:value="filterServiceType" placeholder="服务类型" class="env-filter type-selector" allow-clear
          @change="handleTypeFilterChange">
          <template #suffixIcon>
            <ApiOutlined />
          </template>
          <a-select-option value="ClusterIP">ClusterIP</a-select-option>
          <a-select-option value="NodePort">NodePort</a-select-option>
          <a-select-option value="LoadBalancer">LoadBalancer</a-select-option>
          <a-select-option value="ExternalName">ExternalName</a-select-option>
        </a-select>

        <a-input-search v-model:value="searchText" placeholder="搜索 Service 名称" class="search-input" @search="onSearch"
          allow-clear />
      </div>

      <div class="toolbar-right">
        <div class="page-size-selector">
          <span class="selector-label">每页显示:</span>
          <a-select v-model:value="pageSize" size="small" style="width: 80px" @change="handlePageSizeChange">
            <a-select-option :value="12">12</a-select-option>
            <a-select-option :value="24">24</a-select-option>
            <a-select-option :value="48">48</a-select-option>
            <a-select-option :value="96">96</a-select-option>
          </a-select>
        </div>

        <a-button @click="refreshData" :loading="loading">
          <template #icon>
            <ReloadOutlined />
          </template>
        </a-button>

        <a-button type="primary" danger @click="handleBatchDelete" :disabled="!selectedRows.length"
          v-if="selectedRows.length > 0">
          <template #icon>
            <DeleteOutlined />
          </template>
          删除 ({{ selectedRows.length }})
        </a-button>
      </div>
    </div>

    <!-- 数据展示区域 -->
    <div class="data-display">
      <div class="display-header" v-if="filteredServices.length > 0">
        <div class="result-info">
          <span class="result-count">共 {{ totalItems }} 个Service，当前显示 {{ filteredServices.length }} 个</span>
          <div class="env-tags">
            <a-tag v-for="(count, type) in serviceTypeDistribution" :key="type" :color="getServiceTypeColor(type)">
              {{ type }} {{ count }}
            </a-tag>
            <a-tag color="blue">当前页 {{ services.length }}</a-tag>
          </div>
        </div>
      </div>

      <!-- 表格视图 -->
      <a-table :columns="columns" :data-source="filteredServices" :row-selection="rowSelection" :loading="loading"
        row-key="uid" :pagination="{
          current: currentPage,
          pageSize: pageSize,
          total: totalItems,
          showSizeChanger: true,
          showQuickJumper: true,
          showTotal: (total: number, range: number[]) => `显示 ${range[0]}-${range[1]} 条，共 ${total} 条数据`,
          pageSizeOptions: ['12', '24', '48', '96']
        }" @change="handleTableChange" class="cluster-table services-table">
        <!-- Service名称列 -->
        <template #name="{ text }">
          <div class="cluster-name service-name">
            <ApiOutlined />
            <span>{{ text }}</span>
          </div>
        </template>

        <!-- 命名空间列 -->
        <template #namespace="{ text }">
          <a-tag class="env-tag namespace-tag">
            <AppstoreOutlined /> {{ text }}
          </a-tag>
        </template>

        <!-- 类型列 -->
        <template #type="{ text }">
          <a-tag :color="getServiceTypeColor(text)" class="type-tag">
            {{ text }}
          </a-tag>
        </template>

        <!-- 集群IP列 -->
        <template #cluster_ip="{ text }">
          <div class="ip-address">
            <GlobalOutlined />
            <span>{{ text }}</span>
          </div>
        </template>

        <!-- 端口列 -->
        <template #ports="{ record }">
          <div class="ports-info">
            <a-tag v-for="port in record.ports.slice(0, 2)" :key="`${port.port}-${port.protocol}`" color="blue"
              class="port-tag">
              {{ port.port }}{{ port.target_port ? ':' + port.target_port : '' }}/{{ port.protocol }}
            </a-tag>
            <a-tag v-if="record.ports.length > 2" color="default">
              +{{ record.ports.length - 2 }}
            </a-tag>
          </div>
        </template>

        <!-- 端点列 -->
        <template #endpoints="{ record }">
          <div class="endpoints-info">
            <a-badge :count="record.endpoints?.length || 0" :number-style="{ backgroundColor: '#52c41a' }">
              <a-button type="link" size="small" @click="viewEndpoints(record)">
                端点
              </a-button>
            </a-badge>
          </div>
        </template>

        <!-- 创建时间列 -->
        <template #creationTimestamp="{ record }">
          <div class="timestamp">
            <ClockCircleOutlined />
            <a-tooltip :title="formatDateTime(record.created_at)">
              <span>{{ formatDate(record.created_at) }}</span>
            </a-tooltip>
          </div>
        </template>

        <!-- 操作列 -->
        <template #action="{ record }">
          <div class="action-column">
            <a-tooltip title="查看 YAML">
              <a-button type="primary" ghost shape="circle" size="small" @click="viewServiceYaml(record)">
                <template #icon>
                  <CodeOutlined />
                </template>
              </a-button>
            </a-tooltip>

            <a-tooltip title="端点详情">
              <a-button type="primary" ghost shape="circle" size="small" @click="viewEndpoints(record)">
                <template #icon>
                  <LinkOutlined />
                </template>
              </a-button>
            </a-tooltip>

            <a-tooltip title="查看指标">
              <a-button type="primary" ghost shape="circle" size="small" @click="viewServiceMetrics(record)">
                <template #icon>
                  <BarChartOutlined />
                </template>
              </a-button>
            </a-tooltip>

            <a-tooltip title="查看事件">
              <a-button type="primary" ghost shape="circle" size="small" @click="viewServiceEvents(record)">
                <template #icon>
                  <HistoryOutlined />
                </template>
              </a-button>
            </a-tooltip>

            <a-tooltip title="查看详情">
              <a-button type="primary" ghost shape="circle" size="small" @click="viewServiceDetails(record)">
                <template #icon>
                  <EyeOutlined />
                </template>
              </a-button>
            </a-tooltip>

            <a-tooltip title="编辑服务">
              <a-button type="primary" ghost shape="circle" size="small" @click="handleEdit(record)">
                <template #icon>
                  <EditOutlined />
                </template>
              </a-button>
            </a-tooltip>

            <a-tooltip title="删除服务">
              <a-popconfirm title="确定要删除该服务吗?" description="此操作不可撤销" @confirm="handleDelete(record)" ok-text="确定"
                cancel-text="取消">
                <a-button type="primary" danger ghost shape="circle" size="small">
                  <template #icon>
                    <DeleteOutlined />
                  </template>
                </a-button>
              </a-popconfirm>
            </a-tooltip>
          </div>
        </template>

        <!-- 空状态 -->
        <template #emptyText>
          <div class="empty-state">
            <ApiOutlined style="font-size: 48px; color: #d9d9d9; margin-bottom: 16px" />
            <p>暂无Service数据</p>
            <a-button type="primary" @click="refreshData">刷新数据</a-button>
          </div>
        </template>
      </a-table>
    </div>

    <!-- 查看 Service YAML 模态框 -->
    <a-modal v-model:open="viewYamlModalVisible" title="Service YAML 配置" width="900px" class="cluster-modal yaml-modal"
      :footer="null">
      <a-alert v-if="currentService" class="modal-alert" type="info" show-icon>
        <template #message>
          <span>{{ currentService.name }} ({{ currentService.namespace }})</span>
        </template>
        <template #description>
          <div>类型: {{ currentService.type }} | 集群IP: {{ currentService.cluster_ip }}</div>
        </template>
      </a-alert>

      <div class="yaml-actions">
        <a-button type="primary" size="small" @click="copyYaml">
          <template #icon>
            <CopyOutlined />
          </template>
          复制
        </a-button>
      </div>
      <pre class="yaml-editor">{{ serviceYaml }}</pre>
    </a-modal>

    <!-- 端点详情模态框 -->
    <a-modal v-model:open="endpointsModalVisible" title="Service 端点详情" width="800px" class="cluster-modal"
      :footer="null">
      <a-alert v-if="currentService" class="modal-alert" type="info" show-icon>
        <template #message>
          <span>{{ currentService.name }} ({{ currentService.namespace }})</span>
        </template>
        <template #description>
          <div>端点总数: {{ serviceEndpoints.length }}</div>
        </template>
      </a-alert>

      <a-table :data-source="serviceEndpoints" :columns="[
        { title: 'IP地址', dataIndex: 'ip', key: 'ip' },
        { title: '端口', dataIndex: 'port', key: 'port', width: '100px' },
        { title: '协议', dataIndex: 'protocol', key: 'protocol', width: '100px' },
        { title: '状态', key: 'ready', width: '100px' },
        { title: '节点', dataIndex: 'node_name', key: 'node_name' }
      ]" :loading="endpointsLoading" :pagination="false">
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'ready'">
            <a-tag :color="record.ready ? 'green' : 'red'">
              {{ record.ready ? '就绪' : '未就绪' }}
            </a-tag>
          </template>
        </template>
      </a-table>
    </a-modal>

    <!-- Service指标模态框 -->
    <a-modal v-model:open="metricsModalVisible" title="Service 指标信息" width="800px" class="cluster-modal" :footer="null">
      <a-alert v-if="currentService" class="modal-alert" type="info" show-icon>
        <template #message>
          <span>{{ currentService.name }} ({{ currentService.namespace }})</span>
        </template>
        <template #description>
          <div>Service性能指标和监控数据</div>
        </template>
      </a-alert>

      <a-spin :spinning="metricsLoading">
        <div v-if="serviceMetrics" class="metrics-content">
          <a-row :gutter="16">
            <a-col :span="12">
              <a-statistic title="请求总数" :value="serviceMetrics.request_count" />
            </a-col>
            <a-col :span="12">
              <a-statistic title="请求速率" :value="serviceMetrics.request_rate" suffix="/秒" />
            </a-col>
          </a-row>
          <a-row :gutter="16" style="margin-top: 16px">
            <a-col :span="12">
              <a-statistic title="响应时间" :value="serviceMetrics.response_time" suffix="ms" />
            </a-col>
            <a-col :span="12">
              <a-statistic title="错误率" :value="serviceMetrics.error_rate" suffix="%" />
            </a-col>
          </a-row>
          <a-row :gutter="16" style="margin-top: 16px">
            <a-col :span="12">
              <a-statistic title="连接数" :value="serviceMetrics.connection_count" />
            </a-col>
            <a-col :span="12">
              <a-statistic title="入站带宽" :value="serviceMetrics.bandwidth_in" suffix="KB/s" />
            </a-col>
          </a-row>
          <a-row :gutter="16" style="margin-top: 16px">
            <a-col :span="12">
              <a-statistic title="出站带宽" :value="serviceMetrics.bandwidth_out" suffix="KB/s" />
            </a-col>
            <a-col :span="12">
              <div>
                <div style="font-size: 14px; color: #666; margin-bottom: 4px;">最后更新</div>
                <div>{{ formatDateTime(serviceMetrics.last_updated) }}</div>
              </div>
            </a-col>
          </a-row>
        </div>
        <a-empty v-else description="暂无指标数据" />
      </a-spin>
    </a-modal>

    <!-- Service事件模态框 -->
    <a-modal v-model:open="eventsModalVisible" title="Service 事件列表" width="900px" class="cluster-modal" :footer="null">
      <a-alert v-if="currentService" class="modal-alert" type="info" show-icon>
        <template #message>
          <span>{{ currentService.name }} ({{ currentService.namespace }})</span>
        </template>
        <template #description>
          <div>Service相关事件记录</div>
        </template>
      </a-alert>

      <a-table :data-source="serviceEvents" :columns="[
        { title: '类型', dataIndex: 'type', key: 'type', width: '80px' },
        { title: '原因', dataIndex: 'reason', key: 'reason', width: '120px' },
        { title: '消息', dataIndex: 'message', key: 'message' },
        { title: '次数', dataIndex: 'count', key: 'count', width: '80px' },
        { title: '首次时间', key: 'first_time', width: '150px' },
        { title: '最后时间', key: 'last_time', width: '150px' },
        { title: '来源', dataIndex: 'source', key: 'source', width: '120px' }
      ]" :loading="eventsLoading" :pagination="{ pageSize: 10 }" size="small">
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'first_time'">
            {{ formatDateTime(record.first_time) }}
          </template>
          <template v-if="column.key === 'last_time'">
            {{ formatDateTime(record.last_time) }}
          </template>
        </template>
      </a-table>
    </a-modal>

    <!-- 创建Service模态框 -->
    <a-modal v-model:open="createFormVisible" title="创建Service" width="900px" class="cluster-modal" :footer="null">
      <a-alert class="modal-alert" type="info" show-icon>
        <template #message>创建新的Service</template>
        <template #description>Service用于暴露运行在一组Pod上的应用程序</template>
      </a-alert>

      <a-form :model="createForm" :rules="createFormRules" layout="vertical" style="margin-top: 24px;">
        <a-row :gutter="16">
          <a-col :span="12">
            <a-form-item label="Service名称" name="name">
              <a-input v-model:value="createForm.name" placeholder="请输入Service名称" />
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item label="命名空间" name="namespace">
              <a-select v-model:value="createForm.namespace" placeholder="选择命名空间">
                <a-select-option v-for="ns in namespaces" :key="ns.name" :value="ns.name">
                  {{ ns.name }}
                </a-select-option>
              </a-select>
            </a-form-item>
          </a-col>
        </a-row>

        <a-form-item label="Service类型" name="type">
          <a-select v-model:value="createForm.type" placeholder="选择Service类型">
            <a-select-option value="ClusterIP">ClusterIP</a-select-option>
            <a-select-option value="NodePort">NodePort</a-select-option>
            <a-select-option value="LoadBalancer">LoadBalancer</a-select-option>
            <a-select-option value="ExternalName">ExternalName</a-select-option>
          </a-select>
        </a-form-item>

        <!-- 端口配置 -->
        <a-form-item label="端口配置">
          <div v-for="(port, index) in createForm.ports" :key="index" class="port-config-item">
            <a-row :gutter="16" align="middle">
              <a-col :span="5">
                <a-input v-model:value="port.name" placeholder="端口名称(可选)" />
              </a-col>
              <a-col :span="4">
                <a-select v-model:value="port.protocol" placeholder="协议">
                  <a-select-option value="TCP">TCP</a-select-option>
                  <a-select-option value="UDP">UDP</a-select-option>
                  <a-select-option value="SCTP">SCTP</a-select-option>
                </a-select>
              </a-col>
              <a-col :span="4">
                <a-input-number v-model:value="port.port" :min="1" :max="65535" placeholder="端口" style="width: 100%" />
              </a-col>
              <a-col :span="5">
                <a-input-number v-model:value="port.target_port" :min="1" :max="65535" placeholder="目标端口"
                  style="width: 100%" />
              </a-col>
              <a-col :span="4" v-if="createForm.type === 'NodePort'">
                <a-input-number v-model:value="port.node_port" :min="30000" :max="32767" placeholder="节点端口"
                  style="width: 100%" />
              </a-col>
              <a-col :span="2">
                <a-button type="primary" danger ghost size="small" shape="circle" @click="removeServicePort(index)"
                  :disabled="createForm.ports.length === 1">
                  <template #icon>
                    <DeleteOutlined />
                  </template>
                </a-button>
              </a-col>
            </a-row>
          </div>
          <a-button type="dashed" @click="addServicePort" block style="margin-top: 12px;">
            <template #icon>
              <PlusOutlined />
            </template>
            添加端口
          </a-button>
        </a-form-item>

        <!-- 选择器 -->
        <a-form-item label="选择器">
          <div v-for="(_, key) in createForm.selector" :key="key" class="label-item">
            <a-row :gutter="8" align="middle">
              <a-col :span="10">
                <a-input :value="key" @change="(e: any) => updateCreateSelectorKey(String(key), e.target.value)"
                  placeholder="键" />
              </a-col>
              <a-col :span="10">
                <a-input v-model:value="createForm.selector![key]" placeholder="值" />
              </a-col>
              <a-col :span="4">
                <a-button type="primary" danger ghost size="small" @click="removeSelector(createForm, String(key))">
                  删除
                </a-button>
              </a-col>
            </a-row>
          </div>
          <a-button type="dashed" @click="addSelector(createForm)" block>
            <template #icon>
              <PlusOutlined />
            </template>
            添加选择器
          </a-button>
        </a-form-item>

        <!-- 标签 -->
        <a-form-item label="标签">
          <div v-for="(_, key) in createForm.labels" :key="key" class="label-item">
            <a-row :gutter="8" align="middle">
              <a-col :span="10">
                <a-input :value="key" @change="(e: any) => updateCreateLabelKey(String(key), e.target.value)" placeholder="键" />
              </a-col>
              <a-col :span="10">
                <a-input v-model:value="createForm.labels![key]" placeholder="值" />
              </a-col>
              <a-col :span="4">
                <a-button type="primary" danger ghost size="small" @click="removeLabel(createForm, String(key))">
                  删除
                </a-button>
              </a-col>
            </a-row>
          </div>
          <a-button type="dashed" @click="addLabel(createForm)" block>
            <template #icon>
              <PlusOutlined />
            </template>
            添加标签
          </a-button>
        </a-form-item>
      </a-form>

      <div class="modal-footer">
        <a-button @click="createFormVisible = false">取消</a-button>
        <a-button type="primary" @click="handleCreateService" :loading="createFormLoading">
          创建Service
        </a-button>
      </div>
    </a-modal>

    <!-- 编辑Service模态框 -->
    <a-modal v-model:open="editFormVisible" title="编辑Service" width="900px" class="cluster-modal" :footer="null">
      <a-alert v-if="currentService" class="modal-alert" type="info" show-icon>
        <template #message>编辑Service: {{ currentService.name }}</template>
        <template #description>修改Service配置和属性</template>
      </a-alert>

      <a-form :model="editForm" layout="vertical" style="margin-top: 24px;">
        <a-row :gutter="16">
          <a-col :span="12">
            <a-form-item label="Service名称">
              <a-input v-model:value="editForm.name" placeholder="Service名称" :disabled="true" />
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item label="命名空间">
              <a-input v-model:value="editForm.namespace" placeholder="命名空间" :disabled="true" />
            </a-form-item>
          </a-col>
        </a-row>

        <a-form-item label="Service类型">
          <a-select v-model:value="editForm.type" placeholder="选择Service类型">
            <a-select-option value="ClusterIP">ClusterIP</a-select-option>
            <a-select-option value="NodePort">NodePort</a-select-option>
            <a-select-option value="LoadBalancer">LoadBalancer</a-select-option>
            <a-select-option value="ExternalName">ExternalName</a-select-option>
          </a-select>
        </a-form-item>

        <!-- 端口配置 -->
        <a-form-item label="端口配置">
          <div v-for="(port, index) in editForm.ports" :key="index" class="port-config-item">
            <a-row :gutter="16" align="middle">
              <a-col :span="5">
                <a-input v-model:value="port.name" placeholder="端口名称(可选)" />
              </a-col>
              <a-col :span="4">
                <a-select v-model:value="port.protocol" placeholder="协议">
                  <a-select-option value="TCP">TCP</a-select-option>
                  <a-select-option value="UDP">UDP</a-select-option>
                  <a-select-option value="SCTP">SCTP</a-select-option>
                </a-select>
              </a-col>
              <a-col :span="4">
                <a-input-number v-model:value="port.port" :min="1" :max="65535" placeholder="端口" style="width: 100%" />
              </a-col>
              <a-col :span="5">
                <a-input-number v-model:value="port.target_port" :min="1" :max="65535" placeholder="目标端口"
                  style="width: 100%" />
              </a-col>
              <a-col :span="4" v-if="editForm.type === 'NodePort'">
                <a-input-number v-model:value="port.node_port" :min="30000" :max="32767" placeholder="节点端口"
                  style="width: 100%" />
              </a-col>
              <a-col :span="2">
                <a-button type="primary" danger ghost size="small" shape="circle" @click="removeEditServicePort(index)"
                  :disabled="editForm.ports && editForm.ports.length === 1">
                  <template #icon>
                    <DeleteOutlined />
                  </template>
                </a-button>
              </a-col>
            </a-row>
          </div>
          <a-button type="dashed" @click="addEditServicePort" block style="margin-top: 12px;">
            <template #icon>
              <PlusOutlined />
            </template>
            添加端口
          </a-button>
        </a-form-item>

        <!-- 选择器 -->
        <a-form-item label="选择器">
          <div v-for="(_, key) in editForm.selector" :key="key" class="label-item">
            <a-row :gutter="8" align="middle">
              <a-col :span="10">
                <a-input :value="key" @change="(e: any) => updateSelectorKey(String(key), e.target.value)" placeholder="键" />
              </a-col>
              <a-col :span="10">
                <a-input v-model:value="editForm.selector![key]" placeholder="值" />
              </a-col>
              <a-col :span="4">
                <a-button type="primary" danger ghost size="small" @click="removeSelector(editForm, String(key))">
                  删除
                </a-button>
              </a-col>
            </a-row>
          </div>
          <a-button type="dashed" @click="addSelector(editForm)" block>
            <template #icon>
              <PlusOutlined />
            </template>
            添加选择器
          </a-button>
        </a-form-item>

        <!-- 标签 -->
        <a-form-item label="标签">
          <div v-for="(_, key) in editForm.labels" :key="key" class="label-item">
            <a-row :gutter="8" align="middle">
              <a-col :span="10">
                <a-input :value="key" @change="(e: any) => updateLabelKey(String(key), e.target.value)" placeholder="键" />
              </a-col>
              <a-col :span="10">
                <a-input v-model:value="editForm.labels![key]" placeholder="值" />
              </a-col>
              <a-col :span="4">
                <a-button type="primary" danger ghost size="small" @click="removeLabel(editForm, String(key))">
                  删除
                </a-button>
              </a-col>
            </a-row>
          </div>
          <a-button type="dashed" @click="addLabel(editForm)" block>
            <template #icon>
              <PlusOutlined />
            </template>
            添加标签
          </a-button>
        </a-form-item>

        <!-- 注解 -->
        <a-form-item label="注解">
          <div v-for="(_, key) in editForm.annotations" :key="key" class="label-item">
            <a-row :gutter="8" align="middle">
              <a-col :span="10">
                <a-input :value="key" @change="(e: any) => updateAnnotationKey(String(key), e.target.value)" placeholder="键" />
              </a-col>
              <a-col :span="10">
                <a-input v-model:value="editForm.annotations![key]" placeholder="值" />
              </a-col>
              <a-col :span="4">
                <a-button type="primary" danger ghost size="small" @click="removeAnnotation(editForm, String(key))">
                  删除
                </a-button>
              </a-col>
            </a-row>
          </div>
          <a-button type="dashed" @click="addAnnotation(editForm)" block>
            <template #icon>
              <PlusOutlined />
            </template>
            添加注解
          </a-button>
        </a-form-item>
      </a-form>

      <div class="modal-footer">
        <a-button @click="editFormVisible = false">取消</a-button>
        <a-button type="primary" @click="handleUpdateService" :loading="editFormLoading">
          更新Service
        </a-button>
      </div>
    </a-modal>

    <!-- 查看Service详情模态框 -->
    <a-modal v-model:open="detailsModalVisible" title="Service 详情" width="800px" class="cluster-modal" :footer="null">
      <a-alert v-if="serviceDetails" class="modal-alert" type="info" show-icon>
        <template #message>
          <span>{{ serviceDetails.name }} ({{ serviceDetails.namespace }})</span>
        </template>
        <template #description>
          <div>Service详情</div>
        </template>
      </a-alert>

      <a-spin :spinning="detailsLoading">
        <div v-if="serviceDetails" class="details-content">
          <div class="detail-item">
            <span class="label">名称:</span>
            <span class="value">{{ serviceDetails.name }}</span>
          </div>
          <div class="detail-item">
            <span class="label">命名空间:</span>
            <span class="value">{{ serviceDetails.namespace }}</span>
          </div>
          <div class="detail-item">
            <span class="label">类型:</span>
            <span class="value">{{ serviceDetails.type }}</span>
          </div>
          <div class="detail-item">
            <span class="label">集群IP:</span>
            <span class="value">{{ serviceDetails.cluster_ip }}</span>
          </div>
          <div class="detail-item">
            <span class="label">端口:</span>
            <span class="value">
              <a-tag v-for="port in serviceDetails.ports" :key="`${port.port}-${port.protocol}`" color="blue"
                size="small">
                {{ port.port }}/{{ port.protocol }}
              </a-tag>
              <span v-if="serviceDetails.ports.length > 2">+{{ serviceDetails.ports.length - 2 }}</span>
            </span>
          </div>
          <div class="detail-item">
            <span class="label">端点:</span>
            <span class="value">{{ serviceDetails.endpoints?.length || 0 }}</span>
          </div>
          <div class="detail-item">
            <span class="label">创建时间:</span>
            <span class="value">
              <ClockCircleOutlined />
              {{ formatDate(serviceDetails.created_at) }}
            </span>
          </div>
          <div class="detail-item">
            <span class="label">更新时间:</span>
            <span class="value">
              <ClockCircleOutlined />
              {{ formatDate(serviceDetails.updated_at) }}
            </span>
          </div>
          <div class="detail-item">
            <span class="label">标签:</span>
            <span class="value">
              <a-tag v-for="(value, key) in serviceDetails.labels" :key="key" style="margin-right: 4px;">
                {{ key }}: {{ value }}
              </a-tag>
            </span>
          </div>
          <div class="detail-item">
            <span class="label">注解:</span>
            <span class="value">
              <a-tag v-for="(value, key) in serviceDetails.annotations" :key="key" style="margin-right: 4px;">
                {{ key }}: {{ value }}
              </a-tag>
            </span>
          </div>
        </div>
        <a-empty v-else description="暂无详情数据" />
      </a-spin>
    </a-modal>
  </div>
</template>

<script lang="ts" setup>
import { ref, computed, onMounted, h } from 'vue';
import { message, Modal } from 'ant-design-vue';
import {
  getServiceListApi,
  getServiceDetailsApi,
  getServiceYamlApi,
  createServiceApi,
  updateServiceApi,
  deleteServiceApi,
  getServiceEndpointsApi,
  getServiceMetricsApi,
  getServiceEventsApi,
  getClustersListApi,
  getNamespacesListApi,
} from '../../api';
import type {
  K8sService,
  GetServiceListReq,
  CreateServiceReq,
  UpdateServiceReq,
  ServiceEndpoint,
  K8sServiceMetrics,
  K8sServiceEvent,
  K8sYaml,
  K8sCluster,
} from '../../api';
import { ClusterStatus } from '../../api';
import { 
  CloudServerOutlined, 
  AppstoreOutlined, 
  ReloadOutlined,
  DeleteOutlined,
  CodeOutlined,
  ApiOutlined,
  ClockCircleOutlined,
  CheckCircleOutlined,
  CopyOutlined,
  ClusterOutlined,
  PartitionOutlined,
  GlobalOutlined,
  PlusOutlined,
  EditOutlined,
  LinkOutlined,
  BarChartOutlined,
  HistoryOutlined,
  EyeOutlined
} from '@ant-design/icons-vue';

// 状态变量
const loading = ref(false);
const clustersLoading = ref(false);
const namespacesLoading = ref(false);
const endpointsLoading = ref(false);
const metricsLoading = ref(false);
const eventsLoading = ref(false);
const detailsLoading = ref(false);
const services = ref<K8sService[]>([]);
const searchText = ref('');
const filterServiceType = ref<string | undefined>(undefined);
const selectedRows = ref<K8sService[]>([]);
const namespaces = ref<Array<{ name: string }>>([]);
const selectedNamespace = ref<string>('default');
const viewYamlModalVisible = ref(false);
const endpointsModalVisible = ref(false);
const metricsModalVisible = ref(false);
const eventsModalVisible = ref(false);
const detailsModalVisible = ref(false);
const serviceYaml = ref('');
const clusters = ref<K8sCluster[]>([]);
const selectedCluster = ref<number>();
const currentService = ref<K8sService | null>(null);
const serviceDetails = ref<K8sService | null>(null);
const currentPage = ref(1);
const pageSize = ref(12);
const totalItems = ref(0);
const serviceEndpoints = ref<ServiceEndpoint[]>([]);
const serviceMetrics = ref<K8sServiceMetrics | null>(null);
const serviceEvents = ref<K8sServiceEvent[]>([]);

// 创建表单状态
const createFormVisible = ref(false);
const createFormLoading = ref(false);
const createForm = ref<CreateServiceReq>({
  cluster_id: 0,
  name: '',
  namespace: 'default',
  type: 'ClusterIP',
  ports: [{
    name: '',
    protocol: 'TCP',
    port: 80,
    target_port: 80
  }],
  selector: {},
  labels: {},
  annotations: {}
});

// 编辑表单状态
const editFormVisible = ref(false);
const editFormLoading = ref(false);
const editForm = ref<UpdateServiceReq>({
  cluster_id: 0,
  name: '',
  namespace: '',
  type: 'ClusterIP',
  ports: [],
  selector: {},
  labels: {},
  annotations: {}
});

// 表单验证规则
const createFormRules = {
  name: [
    { required: true, message: '请输入Service名称', trigger: 'blur' },
    { pattern: /^[a-z0-9]([-a-z0-9]*[a-z0-9])?$/, message: 'Service名称必须符合DNS规范', trigger: 'blur' }
  ],
  namespace: [
    { required: true, message: '请选择命名空间', trigger: 'change' }
  ],
  type: [
    { required: true, message: '请选择Service类型', trigger: 'change' }
  ]
};



// 表格列配置
const columns = [
  {
    title: 'Service 名称',
    dataIndex: 'name',
    key: 'name',
    slots: { customRender: 'name' },
    width: '16%',
    sorter: (a: K8sService, b: K8sService) => a.name.localeCompare(b.name),
  },
  {
    title: '命名空间',
    dataIndex: 'namespace',
    key: 'namespace',
    width: '12%',
    slots: { customRender: 'namespace' },
    sorter: (a: K8sService, b: K8sService) => a.namespace.localeCompare(b.namespace),
  },
  {
    title: '类型',
    dataIndex: 'type',
    key: 'type',
    width: '10%',
    slots: { customRender: 'type' },
    filters: [
      { text: 'ClusterIP', value: 'ClusterIP' },
      { text: 'NodePort', value: 'NodePort' },
      { text: 'LoadBalancer', value: 'LoadBalancer' },
      { text: 'ExternalName', value: 'ExternalName' },
    ],
    onFilter: (value: string, record: K8sService) => record.type === value,
  },
  {
    title: '集群IP',
    dataIndex: 'cluster_ip',
    key: 'cluster_ip',
    width: '12%',
    slots: { customRender: 'cluster_ip' },
  },
  {
    title: '端口',
    key: 'ports',
    width: '15%',
    slots: { customRender: 'ports' },
  },
  {
    title: '端点',
    key: 'endpoints',
    width: '8%',
    slots: { customRender: 'endpoints' },
  },
  {
    title: '创建时间',
    dataIndex: 'created_at',
    key: 'creationTimestamp',
    width: '12%',
    sorter: (a: K8sService, b: K8sService) => {
      const dateA = a.created_at ? new Date(a.created_at).getTime() : 0;
      const dateB = b.created_at ? new Date(b.created_at).getTime() : 0;
      return dateA - dateB;
    },
    slots: { customRender: 'creationTimestamp' },
  },
  {
    title: '操作',
    key: 'action',
    width: '15%',
    fixed: 'right',
    slots: { customRender: 'action' },
  },
];

// 计算属性：过滤后的Service列表
const filteredServices = computed(() => {
  const searchValue = searchText.value.toLowerCase().trim();
  let filtered = services.value;

  // 按名称搜索
  if (searchValue) {
    filtered = filtered.filter(service =>
      service.name.toLowerCase().includes(searchValue)
    );
  }

  // 按类型过滤
  if (filterServiceType.value) {
    filtered = filtered.filter(service => service.type === filterServiceType.value);
  }

  return filtered;
});

// 计算属性：运行中服务数量（有端点的服务）
const runningServices = computed(() =>
  services.value.filter(service => service.endpoints && service.endpoints.length > 0).length
);

// 计算属性：运行中的集群
const runningClusters = computed(() =>
  clusters.value.filter(cluster => cluster.status === ClusterStatus.Running)
);

// 服务类型分布统计
const serviceTypeDistribution = computed(() => {
  const distribution: Record<string, number> = {};
  services.value.forEach(service => {
    const type = service.type || 'Unknown';
    if (!distribution[type]) {
      distribution[type] = 0;
    }
    distribution[type]++;
  });
  return distribution;
});

// 获取服务类型颜色
const getServiceTypeColor = (type: string) => {
  const typeColors: Record<string, string> = {
    ClusterIP: 'blue',
    NodePort: 'green',
    LoadBalancer: 'orange',
    ExternalName: 'purple',
  };
  return typeColors[type] || 'default';
};

// 表格选择配置
const rowSelection = {
  onChange: (_: string[], selectedRowsData: K8sService[]) => {
    selectedRows.value = selectedRowsData;
  },
  getCheckboxProps: (_: K8sService) => ({
    disabled: false,
  }),
};

// 格式化日期
const formatDate = (dateString?: string) => {
  if (!dateString) return '-';
  const date = new Date(dateString);
  return `${date.getMonth() + 1}月${date.getDate()}日 ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
};

// 日期时间格式化
const formatDateTime = (dateString?: string): string => {
  if (!dateString) return '-';
  const date = new Date(dateString);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}:${String(date.getSeconds()).padStart(2, '0')}`;
};

// 复制YAML
const copyYaml = async () => {
  try {
    await navigator.clipboard.writeText(serviceYaml.value);
    message.success('YAML 已复制到剪贴板');
  } catch (err) {
    message.error('复制失败，请手动选择并复制');
  }
};

// 获取集群列表
const getClusters = async () => {
  clustersLoading.value = true;
  try {
    let allClusters: K8sCluster[] = [];
    let currentPage = 1;
    const pageSizeForClusters = 50;
    let hasMoreData = true;

    // 分页获取所有集群
    while (hasMoreData) {
      const res = await getClustersListApi({
        page: currentPage,
        size: pageSizeForClusters,
      });

      let pageItems: K8sCluster[] = [];
      let totalCount = 0;

      if (res && res.items && Array.isArray(res.items)) {
        pageItems = res.items;
        totalCount = res.total || res.items.length;
      } else if (Array.isArray(res)) {
        pageItems = res;
        totalCount = res.length;
        hasMoreData = false;
      } else if (res && res.data) {
        if (Array.isArray(res.data)) {
          pageItems = res.data;
          totalCount = res.total || res.data.length;
          hasMoreData = false;
        } else if (res.data.items && Array.isArray(res.data.items)) {
          pageItems = res.data.items;
          totalCount = res.data.total || res.data.items.length;
        }
      }

      allClusters.push(...pageItems);

      if (pageItems.length < pageSizeForClusters || allClusters.length >= totalCount) {
        hasMoreData = false;
      } else {
        currentPage++;
      }

      if (currentPage > 10) {
        console.warn('集群数据过多，已达到最大获取页数限制');
        break;
      }
    }

    clusters.value = allClusters;
    console.log(`成功获取 ${allClusters.length} 个集群`);

    // 过滤出运行中的集群
    const runningClustersList = clusters.value.filter(cluster => cluster.status === ClusterStatus.Running);

    if (runningClustersList.length === 0) {
      message.warning('当前没有运行中的集群，无法管理Service');
      return;
    }

    // 智能选择集群
    if (!selectedCluster.value || !runningClustersList.find(c => c.id === selectedCluster.value)) {
      selectedCluster.value = runningClustersList[0]?.id;
      if (selectedCluster.value) {
        await getNamespaces();
        await getServices();
      }
    }
  } catch (error: any) {
    console.error('获取集群列表失败:', error);
    message.error(error.message || '获取集群列表失败');
    clusters.value = [];
  } finally {
    clustersLoading.value = false;
  }
};

// 获取命名空间列表
const getNamespaces = async () => {
  if (!selectedCluster.value) {
    message.warning('请先选择集群');
    return;
  }

  // 验证集群状态
  const currentCluster = clusters.value.find(c => c.id === selectedCluster.value);
  if (!currentCluster || currentCluster.status !== ClusterStatus.Running) {
    message.error('集群状态异常，无法获取命名空间');
    return;
  }

  namespacesLoading.value = true;
  try {
    // 构建查询参数
    const params = {
      page: 1,
      size: 100, // 获取所有命名空间
      cluster_id: selectedCluster.value,
    };

    const res = await getNamespacesListApi(selectedCluster.value, params);

    // 处理返回的数据
    let namespaceItems: any[] = [];

    if (res && res.items && Array.isArray(res.items)) {
      namespaceItems = res.items;
    } else if (Array.isArray(res)) {
      namespaceItems = res;
    } else if (res && res.data) {
      if (Array.isArray(res.data)) {
        namespaceItems = res.data;
      } else if (res.data.items && Array.isArray(res.data.items)) {
        namespaceItems = res.data.items;
      }
    }

    namespaces.value = namespaceItems.map(ns => ({ name: ns.name }));

    if (namespaces.value.length > 0) {
      selectedNamespace.value = namespaces.value[0]?.name || 'default';
    } else {
      selectedNamespace.value = 'default';
    }
  } catch (error: any) {
    console.error('获取命名空间列表失败:', error);
    message.error(error.message || '获取命名空间列表失败');
    namespaces.value = [{ name: 'default' }];
    selectedNamespace.value = 'default';
  } finally {
    namespacesLoading.value = false;
  }
};

// 获取Service列表（支持分页）
const getServices = async (page = currentPage.value, size = pageSize.value) => {
  if (!selectedCluster.value || !selectedNamespace.value) {
    message.warning('请先选择集群和命名空间');
    return;
  }

  // 验证集群状态
  const currentCluster = clusters.value.find(c => c.id === selectedCluster.value);
  if (!currentCluster || currentCluster.status !== ClusterStatus.Running) {
    message.error('集群状态异常，无法获取Service列表');
    return;
  }

  loading.value = true;
  try {
    const params: GetServiceListReq = {
      page,
      size,
      cluster_id: selectedCluster.value,
      namespace: selectedNamespace.value,
    };

    // 添加搜索条件
    if (searchText.value && searchText.value.trim()) {
      params.search = searchText.value.trim();
    }

    // 添加类型过滤
    if (filterServiceType.value) {
      params.type = filterServiceType.value;
    }

    console.log('获取Service列表参数:', params);

    const res = await getServiceListApi(params);

    // 处理返回的数据 - 支持多种响应格式
    let serviceItems: K8sService[] = [];
    let responseTotal = 0;

    console.log('Service API响应:', res);

    if (res) {
      // 直接是数组格式
      if (Array.isArray(res)) {
        serviceItems = res;
        responseTotal = res.length;
      }
      // 包含 items/data 字段的格式
      else {
        const resAny = res as any;
        // 标准格式：{ items: [], total: number }
        if (resAny.items && Array.isArray(resAny.items)) {
          serviceItems = resAny.items;
          responseTotal = resAny.total || resAny.items.length;
        }
        // 包含 data 字段的格式
        else if (resAny.data) {
          if (Array.isArray(resAny.data)) {
            serviceItems = resAny.data;
            responseTotal = resAny.total || resAny.data.length;
          } else if (resAny.data.items && Array.isArray(resAny.data.items)) {
            serviceItems = resAny.data.items;
            responseTotal = resAny.data.total || resAny.data.items.length;
          }
        }
      }
    }

    console.log(`处理Service数据: ${serviceItems.length} 个Service，总数: ${responseTotal}`);

    services.value = serviceItems;
    totalItems.value = responseTotal;
    currentPage.value = page;
    selectedRows.value = [];
  } catch (error: any) {
    console.error('获取Service列表失败:', error);
    message.error(error.message || '获取Service列表失败');
    services.value = [];
    totalItems.value = 0;
  } finally {
    loading.value = false;
  }
};

// 刷新数据
const refreshData = () => {
  getServices(currentPage.value, pageSize.value);
};

// 搜索
const onSearch = () => {
  // 搜索逻辑已经在计算属性中实现
};

// 类型筛选变化
const handleTypeFilterChange = () => {
  currentPage.value = 1;
  getServices(1, pageSize.value);
};

// 查看Service YAML
const viewServiceYaml = async (service: K8sService) => {
  if (!selectedCluster.value) return;
  try {
    currentService.value = service;
    const res = await getServiceYamlApi(selectedCluster.value, service.namespace, service.name);

    if (res && typeof res === 'object' && 'yaml' in res) {
      serviceYaml.value = (res as K8sYaml).yaml;
    } else if (typeof res === 'string') {
      serviceYaml.value = res;
    } else {
      serviceYaml.value = JSON.stringify(res, null, 2);
    }

    viewYamlModalVisible.value = true;
  } catch (error: any) {
    console.error('获取Service YAML失败:', error);
    message.error(error.message || '获取Service YAML失败');
  }
};

// 查看端点
const viewEndpoints = async (service: K8sService) => {
  if (!selectedCluster.value) return;
  try {
    currentService.value = service;
    endpointsLoading.value = true;
    const endpoints = await getServiceEndpointsApi(selectedCluster.value, service.namespace, service.name);
    serviceEndpoints.value = endpoints || [];
    endpointsModalVisible.value = true;
  } catch (error: any) {
    console.error('获取端点信息失败:', error);
    message.error(error.message || '获取端点信息失败');
  } finally {
    endpointsLoading.value = false;
  }
};

// 查看Service指标
const viewServiceMetrics = async (service: K8sService) => {
  if (!selectedCluster.value) return;
  try {
    currentService.value = service;
    metricsLoading.value = true;
    const metrics = await getServiceMetricsApi(selectedCluster.value, service.namespace, service.name);
    serviceMetrics.value = metrics || null;
    metricsModalVisible.value = true;
  } catch (error: any) {
    console.error('获取Service指标失败:', error);
    message.error(error.message || '获取Service指标失败');
  } finally {
    metricsLoading.value = false;
  }
};

// 查看Service事件
const viewServiceEvents = async (service: K8sService) => {
  if (!selectedCluster.value) return;
  try {
    currentService.value = service;
    eventsLoading.value = true;
    const events = await getServiceEventsApi(selectedCluster.value, service.namespace, service.name);
    serviceEvents.value = events || [];
    eventsModalVisible.value = true;
  } catch (error: any) {
    console.error('获取Service事件失败:', error);
    message.error(error.message || '获取Service事件失败');
  } finally {
    eventsLoading.value = false;
  }
};

// 查看Service详情
const viewServiceDetails = async (service: K8sService) => {
  if (!selectedCluster.value) return;
  try {
    currentService.value = service;
    detailsLoading.value = true;
    const details = await getServiceDetailsApi(selectedCluster.value, service.namespace, service.name);
    serviceDetails.value = details || null;
    detailsModalVisible.value = true;
  } catch (error: any) {
    console.error('获取Service详情失败:', error);
    message.error(error.message || '获取Service详情失败');
  } finally {
    detailsLoading.value = false;
  }
};

// 编辑服务
const handleEdit = (service: K8sService) => {
  showEditModal(service);
};

// 删除Service
const handleDelete = async (service: K8sService) => {
  if (!selectedCluster.value) return;

  try {
    await deleteServiceApi(selectedCluster.value, service.namespace, service.name);
    message.success('Service删除成功');
    await getServices(currentPage.value, pageSize.value);
  } catch (error: any) {
    console.error('删除Service失败:', error);
    message.error(error.message || '删除Service失败');
  }
};

// 批量删除Service
const handleBatchDelete = () => {
  if (!selectedRows.value.length || !selectedCluster.value) {
    message.warning('请先选择要删除的Service');
    return;
  }

  Modal.confirm({
    title: `确定要删除选中的 ${selectedRows.value.length} 个Service吗?`,
    content: h('div', [
      h('p', { style: 'margin-bottom: 8px; color: #ff4d4f; font-weight: 500;' }, '⚠️ 危险操作警告'),
      h('p', { style: 'margin-bottom: 8px;' }, '删除Service将会：'),
      h('ul', { style: 'margin: 8px 0; padding-left: 20px; color: #666;' }, [
        h('li', '断开所有到该Service的网络连接'),
        h('li', '移除服务发现和负载均衡配置'),
        h('li', '影响依赖此Service的应用程序')
      ]),
      h('p', { style: 'margin-top: 12px; font-weight: 500; color: #ff4d4f;' }, '此操作不可撤销，请谨慎操作！')
    ]),
    okText: '我已了解风险，确认删除',
    cancelText: '取消操作',
    okType: 'danger',
    width: 500,
    async onOk() {
      try {
        loading.value = true;
        let successCount = 0;
        let errorCount = 0;
        const errors: string[] = [];

        // 逐个删除Service
        for (const service of selectedRows.value) {
          try {
            await deleteServiceApi(selectedCluster.value!, service.namespace, service.name);
            successCount++;
          } catch (error: any) {
            errorCount++;
            errors.push(`${service.name}: ${error.message || '删除失败'}`);
          }
        }

        // 显示结果
        if (successCount > 0 && errorCount === 0) {
          message.success(`成功删除 ${successCount} 个Service`);
        } else if (successCount > 0 && errorCount > 0) {
          message.warning(`成功删除 ${successCount} 个，失败 ${errorCount} 个Service`);
          console.error('删除失败的Service:', errors);
        } else {
          message.error('批量删除失败');
          console.error('删除错误:', errors);
        }

        selectedRows.value = [];
        await getServices(currentPage.value, pageSize.value);
      } catch (error: any) {
        message.error(error.message || '批量删除操作失败');
      } finally {
        loading.value = false;
      }
    }
  });
};

// 切换命名空间
const handleNamespaceChange = () => {
  currentPage.value = 1;
  getServices(1, pageSize.value);
};

// 切换集群
const handleClusterChange = () => {
  selectedNamespace.value = 'default';
  services.value = [];
  currentPage.value = 1;
  totalItems.value = 0;
  getNamespaces();
  getServices(1, pageSize.value);
};

// 分页处理
const handleTableChange = (pagination: any) => {
  if (pagination) {
    currentPage.value = pagination.current || currentPage.value;
    pageSize.value = pagination.pageSize || pageSize.value;
  }
  getServices(currentPage.value, pageSize.value);
};

// 页面大小变化处理
const handlePageSizeChange = () => {
  currentPage.value = 1; // 重置到第一页
  getServices(1, pageSize.value);
};

// 创建Service相关函数
const showCreateModal = () => {
  createForm.value = {
    cluster_id: selectedCluster.value || 0,
    name: '',
    namespace: selectedNamespace.value || 'default',
    type: 'ClusterIP',
    ports: [{
      name: '',
      protocol: 'TCP',
      port: 80,
      target_port: 80
    }],
    selector: {},
    labels: {},
    annotations: {}
  };
  createFormVisible.value = true;
};

const addServicePort = () => {
  createForm.value.ports.push({
    name: '',
    protocol: 'TCP',
    port: 80,
    target_port: 80
  });
};

const removeServicePort = (index: number) => {
  if (createForm.value.ports.length > 1) {
    createForm.value.ports.splice(index, 1);
  }
};

const handleCreateService = async () => {
  if (!selectedCluster.value) {
    message.error('请先选择集群');
    return;
  }

  createFormLoading.value = true;
  try {
    createForm.value.cluster_id = selectedCluster.value;
    await createServiceApi(createForm.value);
    message.success('Service创建成功');
    createFormVisible.value = false;
    await getServices(currentPage.value, pageSize.value);
  } catch (error: any) {
    console.error('创建Service失败:', error);
    message.error(error.message || '创建Service失败');
  } finally {
    createFormLoading.value = false;
  }
};

// 编辑Service相关函数
const showEditModal = (service: K8sService) => {
  currentService.value = service;
  editForm.value = {
    cluster_id: selectedCluster.value || 0,
    name: service.name,
    namespace: service.namespace,
    type: service.type,
    ports: service.ports || [],
    selector: service.selector || {},
    labels: service.labels || {},
    annotations: service.annotations || {}
  };
  editFormVisible.value = true;
};

const addEditServicePort = () => {
  editForm.value.ports = editForm.value.ports || [];
  editForm.value.ports.push({
    name: '',
    protocol: 'TCP',
    port: 80,
    target_port: 80
  });
};

const removeEditServicePort = (index: number) => {
  if (editForm.value.ports && editForm.value.ports.length > 1) {
    editForm.value.ports.splice(index, 1);
  }
};

const handleUpdateService = async () => {
  if (!selectedCluster.value || !currentService.value) {
    message.error('缺少必要参数');
    return;
  }

  editFormLoading.value = true;
  try {
    editForm.value.cluster_id = selectedCluster.value;
    await updateServiceApi(
      selectedCluster.value,
      currentService.value.namespace,
      currentService.value.name,
      editForm.value
    );
    message.success('Service更新成功');
    editFormVisible.value = false;
    await getServices(currentPage.value, pageSize.value);
  } catch (error: any) {
    console.error('更新Service失败:', error);
    message.error(error.message || '更新Service失败');
  } finally {
    editFormLoading.value = false;
  }
};

// 动态标签/选择器处理
const addLabel = (form: any) => {
  if (!form.labels) form.labels = {};
  form.labels[''] = '';
};

const removeLabel = (form: any, key: string) => {
  if (form.labels) {
    delete form.labels[key];
  }
};

const addSelector = (form: any) => {
  if (!form.selector) form.selector = {};
  form.selector[''] = '';
};

const removeSelector = (form: any, key: string) => {
  if (form.selector) {
    delete form.selector[key];
  }
};

const addAnnotation = (form: any) => {
  if (!form.annotations) form.annotations = {};
  form.annotations[''] = '';
};

const removeAnnotation = (form: any, key: string) => {
  if (form.annotations) {
    delete form.annotations[key];
  }
};

// 更新键值对的键名
const updateSelectorKey = (oldKey: string, newKey: string) => {
  if (editForm.value.selector && oldKey !== newKey && newKey.trim()) {
    const value = editForm.value.selector[oldKey];
    delete editForm.value.selector[oldKey];
    if (newKey.trim() && value !== undefined) {
      editForm.value.selector[newKey.trim()] = value;
    }
  }
};

const updateLabelKey = (oldKey: string, newKey: string) => {
  if (editForm.value.labels && oldKey !== newKey && newKey.trim()) {
    const value = editForm.value.labels[oldKey];
    delete editForm.value.labels[oldKey];
    if (newKey.trim() && value !== undefined) {
      editForm.value.labels[newKey.trim()] = value;
    }
  }
};

const updateAnnotationKey = (oldKey: string, newKey: string) => {
  if (editForm.value.annotations && oldKey !== newKey && newKey.trim()) {
    const value = editForm.value.annotations[oldKey];
    delete editForm.value.annotations[oldKey];
    if (newKey.trim() && value !== undefined) {
      editForm.value.annotations[newKey.trim()] = value;
    }
  }
};

// 创建表单键值更新函数
const updateCreateSelectorKey = (oldKey: string, newKey: string) => {
  if (createForm.value.selector && oldKey !== newKey && newKey.trim()) {
    const value = createForm.value.selector[oldKey];
    delete createForm.value.selector[oldKey];
    if (newKey.trim() && value !== undefined) {
      createForm.value.selector[newKey.trim()] = value;
    }
  }
};

const updateCreateLabelKey = (oldKey: string, newKey: string) => {
  if (createForm.value.labels && oldKey !== newKey && newKey.trim()) {
    const value = createForm.value.labels[oldKey];
    delete createForm.value.labels[oldKey];
    if (newKey.trim() && value !== undefined) {
      createForm.value.labels[newKey.trim()] = value;
    }
  }
};

// 页面加载时获取数据
onMounted(() => {
  getClusters();
});
</script>

<style>
/* 继承现有样式系统 */
/* 端口标签样式 */
.port-tag {
  margin-right: 4px;
  margin-bottom: 4px;
}

.ports-info {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.endpoints-info {
  display: flex;
  justify-content: center;
}

.type-tag {
  font-weight: 500;
}

.service-name {
  display: flex;
  align-items: center;
  gap: 10px;
  font-weight: 500;
}

.port-mapping-item {
  display: flex;
  align-items: center;
  margin-bottom: 8px;
}

.port-mapping-item:last-child {
  margin-bottom: 0;
}

/* 操作按钮样式优化 */
.action-column {
  display: flex;
  gap: 6px;
  align-items: center;
  justify-content: flex-start;
}

.action-column .ant-btn {
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

.action-column .ant-btn:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
  border-color: rgba(24, 144, 255, 0.3);
  background: linear-gradient(145deg, #ffffff 0%, #f8fafc 100%);
  z-index: 10;
}

.action-column .ant-btn:active {
  transform: translateY(0);
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.04);
}

.action-column .ant-btn-primary.ant-btn-dangerous {
  border-color: rgba(255, 77, 79, 0.2);
}

.action-column .ant-btn-primary.ant-btn-dangerous:hover {
  border-color: rgba(255, 77, 79, 0.4);
  background: linear-gradient(145deg, #ffffff 0%, #fef2f2 100%);
}

.action-column .ant-btn .anticon {
  font-size: 14px;
  color: #64748b;
  transition: color 0.3s ease;
}

.action-column .ant-btn:hover .anticon {
  color: #1677ff;
}

.action-column .ant-btn-primary.ant-btn-dangerous:hover .anticon {
  color: #ff4d4f;
}

/* 指标内容样式 */
.metrics-content {
  padding: 16px 0;
}

.metrics-content .ant-statistic {
  text-align: center;
  padding: 16px;
  background: #fafafa;
  border-radius: 6px;
  border: 1px solid #f0f0f0;
}

.metrics-content .ant-statistic-title {
  font-size: 14px;
  color: #666;
  margin-bottom: 8px;
}

.metrics-content .ant-statistic-content {
  font-size: 20px;
  font-weight: 600;
  color: #1677ff;
}

/* 表单相关样式 */
.port-config-item {
  margin-bottom: 12px;
  padding: 12px;
  border: 1px solid #f0f0f0;
  border-radius: 6px;
  background: #fafafa;
}

.label-item {
  margin-bottom: 8px;
  padding: 8px;
  border: 1px solid #f0f0f0;
  border-radius: 4px;
  background: #fafafa;
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  margin-top: 24px;
  padding-top: 16px;
  border-top: 1px solid #f0f0f0;
}

/* 详情页面样式 */
.details-content {
  padding: 16px 0;
}

.detail-item {
  display: flex;
  margin-bottom: 16px;
  padding: 12px;
  background: #fafafa;
  border-radius: 6px;
  border: 1px solid #f0f0f0;
}

.detail-item .label {
  font-weight: 500;
  color: #666;
  min-width: 100px;
  margin-right: 16px;
}

.detail-item .value {
  flex: 1;
  color: #333;
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.detail-item .value .anticon {
  color: #1677ff;
}

/* 继承namespace页面的完整样式系统 */
.cluster-management-container {
  min-height: 100vh;
  background: #f5f5f5;
  padding: 24px;
}

.page-header {
  background: #fff;
  border-radius: 8px;
  margin-bottom: 24px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
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
  color: #1677ff;
  margin-right: 16px;
}

.page-title h1 {
  font-size: 24px;
  font-weight: 600;
  margin: 0;
}

.page-subtitle {
  font-size: 14px;
  color: #00000073;
  margin: 0;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 16px;
}

.overview-cards {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  gap: 20px;
  margin-bottom: 32px;
}

.overview-card {
  background: #fff;
  border-radius: 8px;
  padding: 24px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
  display: flex;
  align-items: center;
  transition: all 0.3s;
  border: 1px solid #f0f0f0;
}

.overview-card:hover {
  box-shadow: 0 6px 16px rgba(0, 0, 0, 0.08);
  transform: translateY(-2px);
}

.card-icon {
  width: 48px;
  height: 48px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
  margin-right: 16px;
}

.total-clusters .card-icon {
  background: rgba(22, 119, 255, 0.1);
  color: #1677ff;
}

.running-clusters .card-icon {
  background: rgba(82, 196, 26, 0.1);
  color: #52c41a;
}

.env-types .card-icon {
  background: rgba(114, 46, 209, 0.1);
  color: #722ed1;
}

.resource-usage .card-icon {
  background: rgba(22, 119, 255, 0.1);
  color: #1677ff;
}

.card-info {
  flex: 1;
}

.card-number {
  font-size: 20px;
  font-weight: 600;
  margin-bottom: 4px;
}

.card-label {
  font-size: 14px;
  color: #00000073;
}

.toolbar {
  background: #fff;
  border-radius: 8px;
  padding: 20px 24px;
  margin-bottom: 24px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 20px;
}

.toolbar-left {
  display: flex;
  gap: 16px;
  align-items: center;
  flex: 1;
}

.toolbar-right {
  display: flex;
  gap: 12px;
  align-items: center;
}

.search-input {
  width: 320px;
}

.env-filter,
.cluster-selector {
  width: 160px;
}

.cluster-selector .cluster-option {
  display: flex;
  align-items: center;
  gap: 8px;
}

.data-display {
  background: #fff;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
  overflow: hidden;
}

.display-header {
  padding: 16px 24px;
  border-bottom: 1px solid #f0f0f0;
  background: #fafafa;
}

.result-info {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.result-count {
  font-size: 14px;
  color: #00000073;
  font-weight: 500;
}

.env-tags {
  display: flex;
  gap: 8px;
}

.service-name {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 500;
}

.service-name .anticon {
  color: #1677ff;
}

.namespace-option {
  display: flex;
  align-items: center;
  gap: 8px;
}

.page-size-selector {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-right: 16px;
}

.selector-label {
  font-size: 14px;
  color: #00000073;
  white-space: nowrap;
}

.view-toggle {
  display: flex;
  align-items: center;
}

/* 响应式设计 */
@media (max-width: 1024px) {
  .cluster-management-container {
    padding: 16px;
  }
  
  .header-content {
    flex-direction: column;
    gap: 20px;
  }
  
  .header-actions {
    justify-content: flex-end;
  }
  
  .overview-cards {
    grid-template-columns: repeat(2, 1fr);
  }
  
  .toolbar {
    flex-direction: column;
    gap: 16px;
  }
  
  .toolbar-left {
    width: 100%;
    flex-direction: column;
  }
  
  .toolbar-right {
    width: 100%;
    justify-content: space-between;
    flex-wrap: wrap;
  }
  
  .search-input,
  .env-filter,
  .cluster-selector {
    width: 100%;
  }
}

@media (max-width: 768px) {
  .overview-cards {
    grid-template-columns: 1fr;
  }
  
  .toolbar-right {
    flex-direction: column;
    gap: 8px;
    align-items: stretch;
  }
  
  .page-size-selector {
    margin-right: 0;
    justify-content: center;
  }
  
  .key-value-row {
    flex-direction: column;
    gap: 8px;
    align-items: stretch;
  }
  
  .key-value-row .form-input {
    width: 100% !important;
  }
  
  .key-value-row .ant-btn {
    width: 100% !important;
  }
  
  .details-grid {
    grid-template-columns: 1fr;
  }
  
  .detail-item {
    flex-direction: column;
    align-items: flex-start;
    gap: 4px;
  }
  
  .detail-value {
    text-align: left;
  }
  
  .action-column {
    flex-direction: column;
    gap: 4px;
    align-items: stretch;
  }
  
  .action-column .ant-btn {
    width: 100%;
  }
}

@media (max-width: 480px) {
  .cluster-management-container {
    padding: 12px;
  }
  
  .header-content {
    padding: 20px 16px;
  }
  
  .page-title h1 {
    font-size: 20px;
  }
  
  .card-number {
    font-size: 16px;
  }
  
  .toolbar {
    padding: 16px;
  }
  
  .card-view {
    padding: 16px;
  }
  
  .service-card {
    padding: 16px;
  }
}
</style>
