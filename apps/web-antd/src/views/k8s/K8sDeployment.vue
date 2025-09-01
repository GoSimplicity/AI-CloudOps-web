<template>
  <div class="cluster-management-container deployment-management-container">
    <!-- 页面头部 -->
    <div class="page-header">
      <div class="header-content">
        <div class="title-section">
          <div class="page-title">
            <RocketOutlined class="title-icon" />
            <h1>Kubernetes Deployment 管理</h1>
          </div>
          <p class="page-subtitle">管理和监控集群中的所有Deployment资源</p>
        </div>
        <div class="header-actions">
          <a-button type="primary" size="large" @click="showCreateModal">
            <template #icon><PlusOutlined /></template>
            创建部署
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
          <RocketOutlined />
        </div>
        <div class="card-info">
          <div class="card-number">{{ deployments.length }}</div>
          <div class="card-label">Deployment 总数</div>
        </div>
      </div>
      
      <div class="overview-card running-clusters">
        <div class="card-icon">
          <CheckCircleOutlined />
        </div>
        <div class="card-info">
          <div class="card-number">{{ healthyDeployments }}</div>
          <div class="card-label">健康部署</div>
        </div>
      </div>
      
      <div class="overview-card env-types">
        <div class="card-icon">
          <WarningOutlined />
        </div>
        <div class="card-info">
          <div class="card-number">{{ problemDeployments }}</div>
          <div class="card-label">问题部署</div>
        </div>
      </div>
      
      <div class="overview-card resource-usage">
        <div class="card-icon">
          <PartitionOutlined />
        </div>
        <div class="card-info">
          <div class="card-number">{{ selectedNamespace || '-' }}</div>
          <div class="card-label">命名空间</div>
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
          <a-select-option v-for="cluster in clusters.filter(c => c.status === ClusterStatus.Running)" :key="cluster.id" :value="cluster.id">
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
        
        <a-input-search
          v-model:value="searchText"
          placeholder="搜索 Deployment 名称"
          class="search-input"
          @search="onSearch"
          allow-clear
        />
      </div>
      
      <div class="toolbar-right">

        <a-button @click="refreshData" :loading="loading">
          <template #icon><ReloadOutlined /></template>
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
      <div class="display-header" v-if="filteredDeployments.length > 0">
        <div class="result-info">
          <span class="result-count">共 {{ filteredDeployments.length }} 个Deployment</span>
          <div class="env-tags">
            <a-tag color="green">健康 {{ healthyDeployments }}</a-tag>
            <a-tag color="orange" v-if="problemDeployments > 0">问题 {{ problemDeployments }}</a-tag>
            <a-tag color="blue">{{ selectedNamespace }}</a-tag>
          </div>
        </div>
      </div>

      <!-- 表格视图 -->
      <a-table
        :columns="columns"
        :data-source="filteredDeployments"
        :row-selection="rowSelection"
        :loading="loading"
        :row-key="(record: K8sDeployment) => record.uid || record.name"
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
        class="cluster-table deployments-table"
      >
        <!-- Deployment名称列 -->
        <template #name="{ text }">
          <div class="cluster-name deployment-name">
            <RocketOutlined />
            <span>{{ text }}</span>
          </div>
        </template>

        <!-- 副本列 -->
        <template #replicas="{ record }">
          <div class="replicas-info">
            <a-tag color="blue">{{ record.available_replicas || 0 }}/{{ record.replicas || 0 }}</a-tag>
          </div>
        </template>

        <!-- 命名空间列 -->
        <template #namespace="{ text }">
          <a-tag class="env-tag namespace-tag">
            <AppstoreOutlined /> {{ text }}
          </a-tag>
        </template>
        
        <!-- 状态列 -->
        <template #status="{ record }">
          <div class="status-wrapper">
            <a-tag :color="getStatusColor(record)" class="status-tag">
              {{ getStatusText(record) }}
            </a-tag>
            <a-progress 
              :percent="getStatusPercent(record)" 
              :status="getProgressStatus(record)"
              size="small"
              :stroke-color="getStatusColor(record)"
              :show-info="false"
              class="status-progress"
            />
          </div>
        </template>

        <!-- 镜像列 -->
        <template #image="{ record }">
          <div class="timestamp image-tag">
            <ContainerOutlined />
            <span class="image-text">{{ record.images?.[0] || '-' }}</span>
          </div>
        </template>

        <!-- 创建时间列 -->
        <template #creationTimestamp="{ record }">
          <div class="timestamp">
            <ClockCircleOutlined />
            <a-tooltip :title="formatDateTime(record.creation_timestamp)">
              <span>{{ formatDate(record.creation_timestamp) }}</span>
            </a-tooltip>
          </div>
        </template>

        <!-- 操作列 -->
        <template #action="{ record }">
          <div class="action-column">
            <a-tooltip title="查看 YAML">
              <a-button type="primary" ghost shape="circle" size="small" @click="viewDeploymentYaml(record)">
                <template #icon><CodeOutlined /></template>
              </a-button>
            </a-tooltip>

            <a-tooltip title="扩缩容">
              <a-button type="primary" ghost shape="circle" size="small" @click="handleScale(record)">
                <template #icon><ScaleOutlined /></template>
              </a-button>
            </a-tooltip>

            <a-tooltip title="历史版本">
              <a-button type="primary" ghost shape="circle" size="small" @click="viewHistory(record)">
                <template #icon><HistoryOutlined /></template>
              </a-button>
            </a-tooltip>
            
            <a-tooltip title="查看指标">
              <a-button type="primary" ghost shape="circle" size="small" @click="viewDeploymentMetrics(record)">
                <template #icon><BarChartOutlined /></template>
              </a-button>
            </a-tooltip>

            <a-tooltip title="查看事件">
              <a-button type="primary" ghost shape="circle" size="small" @click="viewDeploymentEvents(record)">
                <template #icon><UnorderedListOutlined /></template>
              </a-button>
            </a-tooltip>

            <a-tooltip title="查看Pod">
              <a-button type="primary" ghost shape="circle" size="small" @click="viewDeploymentPods(record)">
                <template #icon><AppstoreOutlined /></template>
              </a-button>
            </a-tooltip>

            <a-tooltip title="编辑 Deployment">
              <a-button type="primary" ghost shape="circle" size="small" @click="handleEdit(record)">
                <template #icon><EditOutlined /></template>
              </a-button>
            </a-tooltip>
            
            <a-tooltip title="重启 Deployment">
              <a-popconfirm
                title="确定要重启该 Deployment 吗?"
                @confirm="handleRestart(record)"
                ok-text="确定"
                cancel-text="取消"
              >
                <a-button type="primary" ghost shape="circle" size="small">
                  <template #icon><SyncOutlined /></template>
                </a-button>
              </a-popconfirm>
            </a-tooltip>

            <a-tooltip :title="isDeploymentPaused(record) ? '恢复部署' : '暂停部署'">
              <a-button type="primary" ghost shape="circle" size="small" @click="handlePauseResume(record)" :loading="isPauseResumeLoading">
                <template #icon>
                  <PlayCircleOutlined v-if="isDeploymentPaused(record)" />
                  <PauseCircleOutlined v-else />
                </template>
              </a-button>
            </a-tooltip>
            
            <a-tooltip title="删除 Deployment">
              <a-popconfirm
                title="确定要删除该 Deployment 吗?"
                description="此操作不可撤销"
                @confirm="handleDelete(record)"
                ok-text="确定"
                cancel-text="取消"
              >
                <a-button type="primary" danger ghost shape="circle" size="small">
                  <template #icon><DeleteOutlined /></template>
                </a-button>
              </a-popconfirm>
            </a-tooltip>
          </div>
        </template>

        <!-- 空状态 -->
        <template #emptyText>
          <div class="empty-state">
            <RocketOutlined style="font-size: 48px; color: #d9d9d9; margin-bottom: 16px" />
            <p>暂无Deployment数据</p>
            <a-button type="primary" @click="refreshData">刷新数据</a-button>
          </div>
        </template>
      </a-table>
    </div>

    <!-- 查看 Deployment YAML 模态框 -->
    <a-modal
      v-model:open="viewYamlModalVisible"
      title="Deployment YAML 配置"
      width="900px"
      class="cluster-modal yaml-modal"
      :footer="null"
    >
      <a-alert v-if="currentDeployment" class="modal-alert" type="info" show-icon>
        <template #message>
          <span>{{ currentDeployment.name }} ({{ currentDeployment.namespace }})</span>
        </template>
        <template #description>
          <div>状态: {{ currentDeployment.available_replicas || 0 }}/{{ currentDeployment.replicas || 0 }} | 创建于: {{ formatDate(currentDeployment.created_at || '') }}</div>
        </template>
      </a-alert>
      
      <div class="yaml-actions">
        <a-button type="primary" size="small" @click="copyYaml">
          <template #icon><CopyOutlined /></template>
          复制
        </a-button>
      </div>
      <pre class="yaml-editor">{{ deploymentYaml }}</pre>
    </a-modal>

    <!-- 扩缩容模态框 -->
    <a-modal
      v-model:open="isScaleModalVisible"
      title="扩缩容 Deployment"
      @ok="confirmScale"
      @cancel="isScaleModalVisible = false"
      :confirmLoading="loading"
      class="cluster-modal"
    >
      <a-alert v-if="selectedDeploymentForScale" class="modal-alert" type="info" show-icon>
        <template #message>
          <span>{{ selectedDeploymentForScale.name }} ({{ selectedDeploymentForScale.namespace }})</span>
        </template>
        <template #description>
          <div>当前副本数: {{ selectedDeploymentForScale.replicas }}</div>
        </template>
      </a-alert>

      <a-form layout="vertical">
        <a-form-item label="目标副本数" required>
          <a-input-number 
            v-model:value="scaleForm.replicas" 
            :min="0" 
            :max="100" 
            style="width: 100%" 
            placeholder="请输入目标副本数"
          />
        </a-form-item>
      </a-form>
    </a-modal>

    <!-- 历史版本模态框 -->
    <a-modal
      v-model:open="isHistoryModalVisible"
      title="历史版本"
      width="800px"
      :footer="null"
      class="cluster-modal"
    >
      <a-alert v-if="currentDeployment" class="modal-alert" type="info" show-icon>
        <template #message>
          <span>{{ currentDeployment.name }} ({{ currentDeployment.namespace }})</span>
        </template>
        <template #description>
          <div>查看历史版本记录</div>
        </template>
      </a-alert>

      <a-table 
        :data-source="deploymentHistory" 
        :columns="[
          { title: '版本', dataIndex: 'revision', key: 'revision', width: '15%' },
          { title: '变更信息', dataIndex: 'message', key: 'message', ellipsis: true },
          { title: '创建时间', dataIndex: 'date', key: 'date', width: '25%' },
          { title: '操作', key: 'action', width: '15%' }
        ]"
        :loading="loading"
        :pagination="false"
      >
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'date'">
            {{ formatDateTime(record.date) }}
          </template>
          <template v-else-if="column.key === 'action'">
            <a-button 
              type="primary" 
              size="small" 
              @click="rollbackToVersion(record.revision)"
              :loading="loading"
            >
              回滚
            </a-button>
          </template>
        </template>
      </a-table>
    </a-modal>

    <!-- 指标展示模态框 -->
    <a-modal
      v-model:open="isMetricsModalVisible"
      title="Deployment 指标"
      width="1000px"
      class="cluster-modal metrics-modal"
      :footer="null"
    >
      <a-alert v-if="currentDeployment" class="modal-alert" type="info" show-icon>
        <template #message>
          <span>{{ currentDeployment.name }} ({{ currentDeployment.namespace }})</span>
        </template>
        <template #description>
          <div>实时监控指标数据</div>
        </template>
      </a-alert>
      
      <a-spin :spinning="metricsLoading">
        <div v-if="deploymentMetrics" class="metrics-content">
          <!-- 概览卡片 -->
          <div class="metrics-overview">
            <div class="metric-card cpu-card">
              <div class="metric-icon">
                <BarChartOutlined />
              </div>
              <div class="metric-info">
                <div class="metric-value">{{ deploymentMetrics.cpu_usage || 0 }}%</div>
                <div class="metric-label">CPU 使用率</div>
              </div>
            </div>
            
            <div class="metric-card memory-card">
              <div class="metric-icon">
                <PieChartOutlined />
              </div>
              <div class="metric-info">
                <div class="metric-value">{{ deploymentMetrics.memory_usage || 0 }}%</div>
                <div class="metric-label">内存使用率</div>
              </div>
            </div>
            
            <div class="metric-card network-card">
              <div class="metric-icon">
                <GlobalOutlined />
              </div>
              <div class="metric-info">
                <div class="metric-value">{{ deploymentMetrics.network_in || 0 }}/{{ deploymentMetrics.network_out || 0 }}</div>
                <div class="metric-label">网络 IO (MB/s)</div>
              </div>
            </div>
            
            <div class="metric-card availability-card">
              <div class="metric-icon">
                <CheckCircleOutlined />
              </div>
              <div class="metric-info">
                <div class="metric-value">{{ deploymentMetrics.availability_rate || 0 }}%</div>
                <div class="metric-label">可用性</div>
              </div>
            </div>
          </div>
          
          <!-- 详细指标 -->
          <div class="metrics-details">
            <a-row :gutter="16">
              <a-col :span="12">
                <div class="detail-card">
                  <h4>副本状态</h4>
                  <div class="detail-content">
                    <div class="detail-item">
                      <span class="detail-label">就绪副本:</span>
                      <span class="detail-value">{{ deploymentMetrics.replicas_ready || 0 }}</span>
                    </div>
                    <div class="detail-item">
                      <span class="detail-label">总副本:</span>
                      <span class="detail-value">{{ deploymentMetrics.replicas_total || 0 }}</span>
                    </div>
                    <div class="detail-item">
                      <span class="detail-label">重启次数:</span>
                      <span class="detail-value">{{ deploymentMetrics.restart_count || 0 }}</span>
                    </div>
                  </div>
                </div>
              </a-col>
              <a-col :span="12">
                <div class="detail-card">
                  <h4>存储与时间</h4>
                  <div class="detail-content">
                    <div class="detail-item">
                      <span class="detail-label">磁盘使用率:</span>
                      <span class="detail-value">{{ deploymentMetrics.disk_usage || 0 }}%</span>
                    </div>
                    <div class="detail-item">
                      <span class="detail-label">最后更新:</span>
                      <span class="detail-value">{{ formatDateTime(deploymentMetrics.last_updated) }}</span>
                    </div>
                  </div>
                </div>
              </a-col>
            </a-row>
          </div>
        </div>
        
        <a-empty v-else description="暂无指标数据">
          <template #image>
            <BarChartOutlined style="font-size: 64px; color: #d9d9d9;" />
          </template>
        </a-empty>
      </a-spin>
    </a-modal>

    <!-- 事件展示模态框 -->
    <a-modal
      v-model:open="isEventsModalVisible"
      title="Deployment 事件"
      width="900px"
      class="cluster-modal events-modal"
      :footer="null"
    >
      <a-alert v-if="currentDeployment" class="modal-alert" type="info" show-icon>
        <template #message>
          <span>{{ currentDeployment.name }} ({{ currentDeployment.namespace }})</span>
        </template>
        <template #description>
          <div>查看相关事件日志</div>
        </template>
      </a-alert>
      
      <a-spin :spinning="eventsLoading">
        <div v-if="deploymentEvents.length > 0" class="events-content">
          <a-table 
            :data-source="deploymentEvents" 
            :columns="[
              { title: '类型', dataIndex: 'type', key: 'type', width: '12%' },
              { title: '原因', dataIndex: 'reason', key: 'reason', width: '18%' },
              { title: '消息', dataIndex: 'message', key: 'message', ellipsis: true },
              { title: '次数', dataIndex: 'count', key: 'count', width: '10%' },
              { title: '首次/最后发生时间', key: 'time', width: '20%' }
            ]"
            :pagination="false"
            size="small"
          >
            <template #bodyCell="{ column, record }">
              <template v-if="column.key === 'type'">
                <a-tag :color="record.type === 'Warning' ? 'orange' : 'green'">
                  {{ record.type }}
                </a-tag>
              </template>
              <template v-else-if="column.key === 'time'">
                <div class="time-info">
                  <div>首次: {{ formatDateTime(record.first_time) }}</div>
                  <div>最后: {{ formatDateTime(record.last_time) }}</div>
                </div>
              </template>
            </template>
          </a-table>
        </div>
        
        <a-empty v-else description="暂无事件数据">
          <template #image>
            <UnorderedListOutlined style="font-size: 64px; color: #d9d9d9;" />
          </template>
        </a-empty>
      </a-spin>
    </a-modal>

    <!-- Pod列表展示模态框 -->
    <a-modal
      v-model:open="isPodsModalVisible"
      title="Deployment Pod 列表"
      width="1100px"
      class="cluster-modal pods-modal"
      :footer="null"
    >
      <a-alert v-if="currentDeployment" class="modal-alert" type="info" show-icon>
        <template #message>
          <span>{{ currentDeployment.name }} ({{ currentDeployment.namespace }})</span>
        </template>
        <template #description>
          <div>查看所有Pod实例信息</div>
        </template>
      </a-alert>
      
      <a-spin :spinning="podsLoading">
        <div v-if="deploymentPods.length > 0" class="pods-content">
          <a-table 
            :data-source="deploymentPods" 
            :columns="[
              { title: 'Pod名称', dataIndex: 'name', key: 'name', width: '25%' },
              { title: '状态', dataIndex: 'status', key: 'status', width: '12%' },
              { title: '就绪', dataIndex: 'ready', key: 'ready', width: '10%' },
              { title: '重启次数', dataIndex: 'restart_count', key: 'restart_count', width: '12%' },
              { title: '节点', dataIndex: 'node', key: 'node', width: '18%' },
              { title: '创建时间', dataIndex: 'created_at', key: 'created_at', width: '18%' }
            ]"
            :pagination="{ pageSize: 10 }"
            size="small"
          >
            <template #bodyCell="{ column, record }">
              <template v-if="column.key === 'status'">
                <a-tag :color="getPodStatusColor(record.status)">
                  {{ record.status }}
                </a-tag>
              </template>
              <template v-else-if="column.key === 'ready'">
                <span>{{ record.ready_containers || 0 }}/{{ record.total_containers || 0 }}</span>
              </template>
              <template v-else-if="column.key === 'created_at'">
                {{ formatDateTime(record.created_at) }}
              </template>
            </template>
          </a-table>
        </div>
        
        <a-empty v-else description="暂无Pod数据">
          <template #image>
            <AppstoreOutlined style="font-size: 64px; color: #d9d9d9;" />
          </template>
        </a-empty>
      </a-spin>
    </a-modal>

    <!-- 编辑Deployment模态框 -->
    <a-modal
      v-model:open="isEditModalVisible"
      title="编辑Deployment"
      width="800px"
      class="cluster-modal"
      :footer="null"
    >
      <a-alert v-if="currentDeployment" class="modal-alert" type="info" show-icon>
        <template #message>编辑Deployment: {{ currentDeployment.name }}</template>
        <template #description>修改Deployment的配置信息</template>
      </a-alert>

      <a-form :model="editForm" layout="vertical" style="margin-top: 24px;">
        <a-row :gutter="16">
          <a-col :span="12">
            <a-form-item label="Deployment名称">
              <a-input :value="currentDeployment?.name" disabled />
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item label="命名空间">
              <a-input :value="currentDeployment?.namespace" disabled />
            </a-form-item>
          </a-col>
        </a-row>

        <a-row :gutter="16">
          <a-col :span="12">
            <a-form-item label="副本数量" required>
              <a-input-number 
                v-model:value="editForm.replicas" 
                :min="0" 
                :max="100" 
                style="width: 100%" 
                placeholder="请输入副本数量"
              />
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item label="容器镜像">
              <a-select 
                v-model:value="editForm.selectedImage" 
                placeholder="选择要更新的镜像"
                style="width: 100%"
              >
                <a-select-option v-for="(image, index) in editForm.images" :key="index" :value="index">
                  {{ image }}
                </a-select-option>
              </a-select>
            </a-form-item>
          </a-col>
        </a-row>

        <a-form-item v-if="editForm.selectedImage !== undefined" label="新镜像地址">
          <a-input 
            v-model:value="editForm.newImage" 
            placeholder="请输入新的镜像地址"
          />
        </a-form-item>

        <a-form-item label="标签">
          <div v-for="(_, key) in editForm.labels" :key="key" class="label-item">
            <a-row :gutter="8" align="middle">
              <a-col :span="10">
                <a-input :value="key" placeholder="键" readonly />
              </a-col>
              <a-col :span="10">
                <a-input v-model:value="editForm.labels[key]" placeholder="值" />
              </a-col>
              <a-col :span="4">
                <a-button type="primary" danger ghost size="small" @click="delete editForm.labels[key]">
                  删除
                </a-button>
              </a-col>
            </a-row>
          </div>
          <a-button type="dashed" @click="editForm.labels[''] = ''" block>
            <template #icon><PlusOutlined /></template>
            添加标签
          </a-button>
        </a-form-item>

        <a-form-item label="注解">
          <div v-for="(_, key) in editForm.annotations" :key="key" class="label-item">
            <a-row :gutter="8" align="middle">
              <a-col :span="10">
                <a-input :value="key" placeholder="键" readonly />
              </a-col>
              <a-col :span="10">
                <a-input v-model:value="editForm.annotations[key]" placeholder="值" />
              </a-col>
              <a-col :span="4">
                <a-button type="primary" danger ghost size="small" @click="delete editForm.annotations[key]">
                  删除
                </a-button>
              </a-col>
            </a-row>
          </div>
          <a-button type="dashed" @click="editForm.annotations[''] = ''" block>
            <template #icon><PlusOutlined /></template>
            添加注解
          </a-button>
        </a-form-item>
      </a-form>

      <div class="modal-footer">
        <a-button @click="isEditModalVisible = false">取消</a-button>
        <a-button type="primary" @click="handleUpdateDeployment" :loading="loading">
          更新Deployment
        </a-button>
      </div>
    </a-modal>

    <!-- 创建Deployment模态框 -->
    <a-modal
      v-model:open="isCreateModalVisible"
      title="创建Deployment"
      width="800px"
      class="cluster-modal"
      :footer="null"
    >
      <a-alert class="modal-alert" type="info" show-icon>
        <template #message>创建新的Deployment</template>
        <template #description>Deployment用于管理Pod的部署和更新</template>
      </a-alert>

      <a-form :model="createForm" layout="vertical" style="margin-top: 24px;">
        <a-row :gutter="16">
          <a-col :span="12">
            <a-form-item label="Deployment名称" required>
              <a-input v-model:value="createForm.name" placeholder="请输入Deployment名称" />
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item label="命名空间" required>
              <a-select v-model:value="createForm.namespace" placeholder="选择命名空间">
                <a-select-option v-for="ns in namespaces" :key="ns" :value="ns">
                  {{ ns }}
                </a-select-option>
              </a-select>
            </a-form-item>
          </a-col>
        </a-row>

        <a-row :gutter="16">
          <a-col :span="12">
            <a-form-item label="副本数量" required>
              <a-input-number 
                v-model:value="createForm.replicas" 
                :min="1" 
                :max="100" 
                style="width: 100%" 
                placeholder="请输入副本数量"
              />
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item label="容器镜像" required>
              <a-input v-model:value="createForm.images[0]" placeholder="请输入镜像地址" />
            </a-form-item>
          </a-col>
        </a-row>

        <a-form-item label="标签">
          <div v-for="(_, key) in createForm.labels" :key="key" class="label-item">
            <a-row :gutter="8" align="middle">
              <a-col :span="10">
                <a-input :value="key" placeholder="键" readonly />
              </a-col>
              <a-col :span="10">
                <a-input v-model:value="createForm.labels![key]" placeholder="值" />
              </a-col>
              <a-col :span="4">
                <a-button type="primary" danger ghost size="small" @click="delete createForm.labels![key]">
                  删除
                </a-button>
              </a-col>
            </a-row>
          </div>
          <a-button type="dashed" @click="createForm.labels![''] = ''" block>
            <template #icon><PlusOutlined /></template>
            添加标签
          </a-button>
        </a-form-item>

        <a-form-item label="注解">
          <div v-for="(_, key) in createForm.annotations" :key="key" class="label-item">
            <a-row :gutter="8" align="middle">
              <a-col :span="10">
                <a-input :value="key" placeholder="键" readonly />
              </a-col>
              <a-col :span="10">
                <a-input v-model:value="createForm.annotations![key]" placeholder="值" />
              </a-col>
              <a-col :span="4">
                <a-button type="primary" danger ghost size="small" @click="delete createForm.annotations![key]">
                  删除
                </a-button>
              </a-col>
            </a-row>
          </div>
          <a-button type="dashed" @click="createForm.annotations![''] = ''" block>
            <template #icon><PlusOutlined /></template>
            添加注解
          </a-button>
        </a-form-item>
      </a-form>

      <div class="modal-footer">
        <a-button @click="isCreateModalVisible = false">取消</a-button>
        <a-button type="primary" @click="handleCreateDeployment" :loading="loading">
          创建Deployment
        </a-button>
      </div>
    </a-modal>
  </div>
</template>

<script lang="ts" setup>
import { ref, computed, onMounted, h } from 'vue';
import { message, Modal } from 'ant-design-vue';
import {
  getDeploymentListApi,
  getDeploymentYamlApi,
  deleteDeploymentApi,
  restartDeploymentApi,
  createDeploymentApi,
  updateDeploymentApi,
  scaleDeploymentApi,
  rollbackDeploymentApi,
  getDeploymentHistoryApi,
  getDeploymentEventsApi,
  getDeploymentMetricsApi,
  getDeploymentPodsApi,
  pauseDeploymentApi,
  resumeDeploymentApi,
  getClustersListApi,
  getNamespacesListApi,
} from '#/api';
import type { 
  K8sDeployment, 
  GetDeploymentListReq,
  CreateDeploymentReq,
  K8sDeploymentHistory,
  K8sCluster
} from '#/api';
import { ClusterStatus, K8sDeploymentStatus } from '#/api';
import { 
  CloudServerOutlined, 
 
  AppstoreOutlined, 
  ReloadOutlined,
  DeleteOutlined,
  CodeOutlined,
  RocketOutlined,
  ClockCircleOutlined,
  CheckCircleOutlined,
  WarningOutlined,
  CopyOutlined,
  ClusterOutlined,
  PartitionOutlined,
  SyncOutlined,
  ContainerOutlined,
  PlusOutlined,
  ExpandOutlined as ScaleOutlined,
  HistoryOutlined,
  PlayCircleOutlined,
  PauseCircleOutlined,
  BarChartOutlined,
  UnorderedListOutlined,
  PieChartOutlined,
  GlobalOutlined,
  EditOutlined,
} from '@ant-design/icons-vue';

// 状态变量
const loading = ref(false);
const clustersLoading = ref(false);
const namespacesLoading = ref(false);
const deployments = ref<K8sDeployment[]>([]);
const currentPage = ref(1);
const pageSize = ref(12);
const totalItems = ref(0);
const isCreateModalVisible = ref(false);
const isScaleModalVisible = ref(false);
const isHistoryModalVisible = ref(false);
const isEditModalVisible = ref(false);
const isMetricsModalVisible = ref(false);
const isEventsModalVisible = ref(false);
const isPodsModalVisible = ref(false);
const isPauseResumeLoading = ref(false);
const metricsLoading = ref(false);
const eventsLoading = ref(false);
const podsLoading = ref(false);
const scaleForm = ref({
  replicas: 1
});
const createForm = ref<CreateDeploymentReq>({
  cluster_id: 0,
  name: '',
  namespace: 'default',
  replicas: 1,
  images: [''],
  labels: {},
  annotations: {}
});
const deploymentHistory = ref<K8sDeploymentHistory[]>([]);
const selectedDeploymentForScale = ref<K8sDeployment | null>(null);
const deploymentMetrics = ref<any>(null);
const deploymentEvents = ref<any[]>([]);
const deploymentPods = ref<any[]>([]);
const editForm = ref<any>({});
const searchText = ref('');
const selectedRows = ref<K8sDeployment[]>([]);
const namespaces = ref<string[]>(['default']);
const selectedNamespace = ref<string>('default');
const viewYamlModalVisible = ref(false);
const deploymentYaml = ref('');
const clusters = ref<K8sCluster[]>([]);
const selectedCluster = ref<number>();
const currentDeployment = ref<K8sDeployment | null>(null);



// 表格列配置
const columns = [
  {
    title: 'Deployment 名称',
    dataIndex: 'name',
    key: 'name',
    slots: { customRender: 'name' },
    width: '18%',
    sorter: (a: K8sDeployment, b: K8sDeployment) => a.name.localeCompare(b.name),
  },
  {
    title: '命名空间',
    dataIndex: 'namespace',
    key: 'namespace',
    width: '12%',
    slots: { customRender: 'namespace' },
    sorter: (a: K8sDeployment, b: K8sDeployment) => a.namespace.localeCompare(b.namespace),
  },
  {
    title: '状态',
    key: 'status',
    width: '15%',
    slots: { customRender: 'status' },
  },
  {
    title: '副本',
    key: 'replicas',
    width: '10%',
    slots: { customRender: 'replicas' },
  },
  {
    title: '镜像',
    dataIndex: 'images',
    key: 'image',
    width: '22%',
    slots: { customRender: 'image' },
  },
  {
    title: '创建时间',
    dataIndex: 'creation_timestamp',
    key: 'creationTimestamp',
    width: '13%',
    sorter: (a: K8sDeployment, b: K8sDeployment) => {
      const dateA = a.created_at ? new Date(a.created_at).getTime() : 0;
      const dateB = b.created_at ? new Date(b.created_at).getTime() : 0;
      return dateA - dateB;
    },
    slots: { customRender: 'creationTimestamp' },
  },
  {
    title: '操作',
    key: 'action',
    width: '20%',
    fixed: 'right',
    slots: { customRender: 'action' },
  },
];

// 计算属性：过滤后的Deployment列表
const filteredDeployments = computed(() => {
  const searchValue = searchText.value.toLowerCase().trim();
  if (!searchValue) return deployments.value;
  return deployments.value.filter(deploy => 
    deploy.name.toLowerCase().includes(searchValue) || 
    (deploy.images && deploy.images.some(img => img.toLowerCase().includes(searchValue)))
  );
});

// 计算属性：健康和问题部署统计
const healthyDeployments = computed(() => 
  deployments.value.filter(deploy => {
    const available = deploy.available_replicas || 0;
    const total = deploy.replicas || 0;
    return total > 0 && available === total;
  }).length
);

const problemDeployments = computed(() => 
  deployments.value.filter(deploy => {
    const available = deploy.available_replicas || 0;
    const total = deploy.replicas || 0;
    return total > 0 && available < total;
  }).length
);

// 获取状态颜色
const getStatusColor = (deployment: K8sDeployment) => {
  // 优先使用新的status字段
  if (deployment.status !== undefined) {
    switch (deployment.status) {
      case K8sDeploymentStatus.RUNNING:
        return 'success';
      case K8sDeploymentStatus.PAUSED:
        return 'warning';
      case K8sDeploymentStatus.STOPPED:
        return 'default';
      case K8sDeploymentStatus.ERROR:
        return 'error';
      default:
        return 'default';
    }
  }
  
  // 兼容旧的逻辑
  if (!deployment.replicas) return 'default';
  const available = deployment.available_replicas || 0;
  const total = deployment.replicas || 0;
  
  if (available === 0) return 'error';
  if (available < total) return 'warning';
  return 'success';
};

// 获取状态文本
const getStatusText = (deployment: K8sDeployment) => {
  // 优先使用新的status字段
  if (deployment.status !== undefined) {
    switch (deployment.status) {
      case K8sDeploymentStatus.RUNNING:
        return '运行中';
      case K8sDeploymentStatus.PAUSED:
        return '已暂停';
      case K8sDeploymentStatus.STOPPED:
        return '已停止';
      case K8sDeploymentStatus.ERROR:
        return '异常';
      default:
        return '未知';
    }
  }
  
  // 兼容旧的逻辑 - 返回副本状态
  return `${deployment.available_replicas || 0}/${deployment.replicas || 0} 副本`;
};

// 获取进度条百分比
const getStatusPercent = (deployment: K8sDeployment) => {
  // 暂停状态特殊处理
  if (deployment.status === K8sDeploymentStatus.PAUSED) {
    return 50; // 暂停状态显示50%
  }
  
  if (!deployment.replicas) return 0;
  const available = deployment.available_replicas || 0;
  const total = deployment.replicas || 0;
  
  return Math.round((available / total) * 100);
};

// 获取进度条状态
const getProgressStatus = (deployment: K8sDeployment) => {
  // 根据新的status字段判断
  if (deployment.status !== undefined) {
    switch (deployment.status) {
      case K8sDeploymentStatus.RUNNING:
        return 'success';
      case K8sDeploymentStatus.PAUSED:
        return 'active'; // 暂停状态显示为活跃状态
      case K8sDeploymentStatus.STOPPED:
        return 'normal';
      case K8sDeploymentStatus.ERROR:
        return 'exception';
      default:
        return 'normal';
    }
  }
  
  // 兼容旧的逻辑
  if (!deployment.replicas) return 'normal';
  const available = deployment.available_replicas || 0;
  const total = deployment.replicas || 0;
  
  if (available === 0) return 'exception';
  if (available < total) return 'active';
  return 'success';
};

// 格式化日期
const formatDate = (dateString: string) => {
  if (!dateString) return '-';
  const date = new Date(dateString);
  return `${date.getMonth() + 1}月${date.getDate()}日 ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
};

// 日期时间格式化
const formatDateTime = (dateString: string): string => {
  if (!dateString) return '-';
  const date = new Date(dateString);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}:${String(date.getSeconds()).padStart(2, '0')}`;
};

// 表格选择配置
const rowSelection = {
  onChange: (_: string[], selectedRowsData: K8sDeployment[]) => {
    selectedRows.value = selectedRowsData;
  },
  getCheckboxProps: () => ({
    disabled: false, // 可以根据条件禁用某些行的选择
  }),
};

// 复制YAML
const copyYaml = async () => {
  try {
    await navigator.clipboard.writeText(deploymentYaml.value);
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
      message.warning('当前没有运行中的集群，无法管理Deployment');
      return;
    }

    // 智能选择集群
    if (!selectedCluster.value || !runningClustersList.find(c => c.id === selectedCluster.value)) {
      selectedCluster.value = runningClustersList[0]?.id;
      if (selectedCluster.value) {
        await getNamespaces();
        await getDeployments(1, pageSize.value);
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

    namespaces.value = namespaceItems.map(ns => ns.name);

    if (namespaces.value.length > 0) {
      selectedNamespace.value = namespaces.value[0] || 'default';
    } else {
      selectedNamespace.value = 'default';
    }
  } catch (error: any) {
    console.error('获取命名空间列表失败:', error);
    message.error(error.message || '获取命名空间列表失败');
    namespaces.value = ['default'];
    selectedNamespace.value = 'default';
  } finally {
    namespacesLoading.value = false;
  }
};

// 获取Deployment列表（支持分页）
const getDeployments = async (page = currentPage.value, size = pageSize.value) => {
  if (!selectedCluster.value || !selectedNamespace.value) {
    message.warning('请先选择集群和命名空间');
    return;
  }

  // 验证集群状态
  const currentCluster = clusters.value.find(c => c.id === selectedCluster.value);
  if (!currentCluster || currentCluster.status !== ClusterStatus.Running) {
    message.error('集群状态异常，无法获取Deployment列表');
    return;
  }
  
  loading.value = true;
  try {
    const params: GetDeploymentListReq = {
      page,
      size,
      cluster_id: selectedCluster.value,
      namespace: selectedNamespace.value,
    };

    // 添加搜索条件
    if (searchText.value && searchText.value.trim()) {
      params.search = searchText.value.trim();
    }

    console.log('获取Deployment列表参数:', params);

    const res = await getDeploymentListApi(params);

    // 处理返回的数据 - 支持多种响应格式
    let deploymentItems: K8sDeployment[] = [];
    let responseTotal = 0;

    console.log('Deployment API响应:', res);

    if (res) {
      // 直接是数组格式
      if (Array.isArray(res)) {
        deploymentItems = res;
        responseTotal = res.length;
      }
      else {
        const resAny = res as any;
        // 标准格式：{ items: [], total: number }
        if (resAny.items && Array.isArray(resAny.items)) {
          deploymentItems = resAny.items;
          responseTotal = resAny.total || resAny.items.length;
        }
        // 包含 data 字段的格式
        else if (resAny) {
          if (Array.isArray(resAny.data)) {
            deploymentItems = resAny.data;
            responseTotal = resAny.total || resAny.data.length;
          } else if (resAny.data.items && Array.isArray(resAny.data.items)) {
            deploymentItems = resAny.data.items;
            responseTotal = resAny.data.total || resAny.data.items.length;
          }
        }
      }
    }

    console.log(`处理Deployment数据: ${deploymentItems.length} 个Deployment，总数: ${responseTotal}`);

    deployments.value = deploymentItems;
    totalItems.value = responseTotal;
    currentPage.value = page;
    selectedRows.value = [];
  } catch (error: any) {
    console.error('获取Deployment列表失败:', error);
    message.error(error.message || '获取Deployment列表失败');
    deployments.value = [];
    totalItems.value = 0;
  } finally {
    loading.value = false;
  }
};

// 刷新数据
const refreshData = () => {
  getDeployments(currentPage.value, pageSize.value);
};

// 扩缩容Deployment
const handleScale = (deployment: K8sDeployment) => {
  if (!selectedCluster.value) {
    message.error('请先选择集群');
    return;
  }
  selectedDeploymentForScale.value = deployment;
  scaleForm.value.replicas = deployment.replicas || 1;
  isScaleModalVisible.value = true;
};

const confirmScale = async () => {
  if (!selectedDeploymentForScale.value || !selectedCluster.value) {
    message.error('缺少必要参数');
    return;
  }
  
  try {
    loading.value = true;
    await scaleDeploymentApi(
      selectedCluster.value,
      selectedDeploymentForScale.value.namespace,
      selectedDeploymentForScale.value.name,
      {
        cluster_id: selectedCluster.value,
        namespace: selectedDeploymentForScale.value.namespace,
        name: selectedDeploymentForScale.value.name,
        replicas: scaleForm.value.replicas
      }
    );
    
    message.success('扩缩容操作成功');
    isScaleModalVisible.value = false;
    await getDeployments(currentPage.value, pageSize.value);
  } catch (error: any) {
    console.error('扩缩容操作失败:', error);
    message.error(error.message || '扩缩容操作失败');
  } finally {
    loading.value = false;
  }
};

// 判断Deployment是否已暂停
const isDeploymentPaused = (deployment: K8sDeployment) => {
  // 优先使用新的status字段
  if (deployment.status !== undefined) {
    return deployment.status === K8sDeploymentStatus.PAUSED;
  }
  
  // 兼容旧的逻辑 - 根据conditions判断
  if (deployment.conditions) {
    const pausedCondition = deployment.conditions.find(condition => 
      condition.type === 'Progressing' && condition.reason === 'DeploymentPaused'
    );
    return !!pausedCondition;
  }
  
  // 兼容旧的逻辑 - 检查 annotations 中是否有暂停标记
  if (deployment.annotations && deployment.annotations['deployment.kubernetes.io/revision']) {
    // 如果副本数为0但期望副本数不为0，可能是暂停状态
    return (deployment.replicas || 0) > 0 && (deployment.available_replicas || 0) === 0 && 
           (deployment.updated_replicas || 0) === 0;
  }
  
  return false;
};

// 暂停/恢复Deployment
const handlePauseResume = async (deployment: K8sDeployment) => {
  if (!selectedCluster.value) {
    message.error('请先选择集群');
    return;
  }
  
  const isPaused = isDeploymentPaused(deployment);
  const operation = isPaused ? '恢复' : '暂停';
  
  // 显示确认对话框
  Modal.confirm({
    title: `确定要${operation}该 Deployment 吗?`,
    content: h('div', [
      h('p', { style: 'margin-bottom: 8px;' }, `Deployment: ${deployment.name}`),
      h('p', { style: 'margin-bottom: 8px;' }, `命名空间: ${deployment.namespace}`),
      h('p', { style: 'color: #666;' }, 
        isPaused 
          ? '恢复后，Deployment将重新开始更新流程' 
          : '暂停后，Deployment的滚动更新将会停止'
      )
    ]),
    okText: `确认${operation}`,
    cancelText: '取消',
    okType: isPaused ? 'primary' : 'danger',
    async onOk() {
      isPauseResumeLoading.value = true;
      try {
        if (isPaused) {
          // 恢复Deployment
          await resumeDeploymentApi(
            selectedCluster.value!,
            deployment.namespace,
            deployment.name
          );
          message.success(`Deployment "${deployment.name}" 恢复成功`);
        } else {
          // 暂停Deployment
          await pauseDeploymentApi(
            selectedCluster.value!,
            deployment.namespace,
            deployment.name
          );
          message.success(`Deployment "${deployment.name}" 暂停成功`);
        }
        
        // 刷新数据
        await getDeployments(currentPage.value, pageSize.value);
      } catch (error: any) {
        console.error(`${operation}Deployment失败:`, error);
        const errorMessage = error.response?.data?.message || error.message || `${operation}操作失败`;
        message.error(`${operation}失败: ${errorMessage}`);
      } finally {
        isPauseResumeLoading.value = false;
      }
    }
  });
};

// 查看历史版本
const viewHistory = async (deployment: K8sDeployment) => {
  if (!selectedCluster.value) {
    message.error('请先选择集群');
    return;
  }
  
  try {
    loading.value = true;
    currentDeployment.value = deployment;
    const history = await getDeploymentHistoryApi(
      selectedCluster.value,
      deployment.namespace,
      deployment.name
    );
    deploymentHistory.value = history.items || [];
    isHistoryModalVisible.value = true;
  } catch (error: any) {
    console.error('获取历史版本失败:', error);
    message.error(error.message || '获取历史版本失败');
  } finally {
    loading.value = false;
  }
};

// 回滚到指定版本
const rollbackToVersion = async (revision: number) => {
  if (!currentDeployment.value || !selectedCluster.value) {
    message.error('缺少必要参数');
    return;
  }
  
  try {
    loading.value = true;
    await rollbackDeploymentApi(
      selectedCluster.value,
      currentDeployment.value.namespace,
      currentDeployment.value.name,
      {
        cluster_id: selectedCluster.value,
        namespace: currentDeployment.value.namespace,
        name: currentDeployment.value.name,
        revision
      }
    );
    
    message.success('回滚操作成功');
    isHistoryModalVisible.value = false;
    await getDeployments(currentPage.value, pageSize.value);
  } catch (error: any) {
    console.error('回滚操作失败:', error);
    message.error(error.message || '回滚操作失败');
  } finally {
    loading.value = false;
  }
};

// 分页处理
const handleTableChange = (pagination: any) => {
  currentPage.value = pagination.current;
  pageSize.value = pagination.pageSize;
  getDeployments(pagination.current, pagination.pageSize);
};

// 搜索
const onSearch = () => {
  // 搜索逻辑已经在计算属性中实现，这里可以添加其他触发行为
};

// 查看Deployment YAML
const viewDeploymentYaml = async (deployment: K8sDeployment) => {
  if (!selectedCluster.value) {
    message.error('请先选择集群');
    return;
  }
  try {
    currentDeployment.value = deployment;
    const res = await getDeploymentYamlApi(selectedCluster.value, deployment.namespace, deployment.name);
    
    if (res && typeof res === 'object' && 'yaml' in res) {
      deploymentYaml.value = (res as any).yaml;
    } else if (typeof res === 'string') {
      deploymentYaml.value = res;
    } else {
      deploymentYaml.value = JSON.stringify(res, null, 2);
    }
    
    viewYamlModalVisible.value = true;
  } catch (error: any) {
    console.error('获取Deployment YAML失败:', error);
    message.error(error.message || '获取Deployment YAML失败');
  }
};

// 删除Deployment
const handleDelete = async (deployment: K8sDeployment) => {
  if (!selectedCluster.value) {
    message.error('请先选择集群');
    return;
  }
  
  try {
    await deleteDeploymentApi(selectedCluster.value, deployment.namespace, deployment.name);
    message.success('Deployment删除成功');
    await getDeployments(currentPage.value, pageSize.value);
  } catch (error: any) {
    console.error('删除Deployment失败:', error);
    message.error(error.message || '删除Deployment失败');
  }
};

// 重启Deployment
const handleRestart = async (deployment: K8sDeployment) => {
  if (!selectedCluster.value) {
    message.error('请先选择集群');
    return;
  }
  
  try {
    await restartDeploymentApi(selectedCluster.value, deployment.namespace, deployment.name);
    message.success('Deployment重启成功');
    await getDeployments(currentPage.value, pageSize.value);
  } catch (error: any) {
    console.error('重启Deployment失败:', error);
    message.error(error.message || '重启Deployment失败');
  }
};

// 批量删除Deployment
const handleBatchDelete = () => {
  if (!selectedRows.value.length || !selectedCluster.value) {
    message.warning('请先选择要删除的Deployment');
    return;
  }

  Modal.confirm({
    title: `确定要删除选中的 ${selectedRows.value.length} 个Deployment吗?`,
    content: h('div', [
      h('p', { style: 'margin-bottom: 8px; color: #ff4d4f; font-weight: 500;' }, '⚠️ 危险操作警告'),
      h('p', { style: 'margin-bottom: 8px;' }, '删除Deployment将会：'),
      h('ul', { style: 'margin: 8px 0; padding-left: 20px; color: #666;' }, [
        h('li', '停止所有相关的Pod实例'),
        h('li', '删除相关的ReplicaSet'),
        h('li', '中断应用程序的运行'),
        h('li', '影响依赖此Deployment的服务')
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

        // 逐个删除Deployment
        for (const deployment of selectedRows.value) {
          try {
            await deleteDeploymentApi(selectedCluster.value!, deployment.namespace, deployment.name);
            successCount++;
          } catch (error: any) {
            errorCount++;
            errors.push(`${deployment.name}: ${error.message || '删除失败'}`);
          }
        }

        // 显示结果
        if (successCount > 0 && errorCount === 0) {
          message.success(`成功删除 ${successCount} 个Deployment`);
        } else if (successCount > 0 && errorCount > 0) {
          message.warning(`成功删除 ${successCount} 个，失败 ${errorCount} 个Deployment`);
          console.error('删除失败的Deployment:', errors);
        } else {
          message.error('批量删除失败');
          console.error('删除错误:', errors);
        }
        
        selectedRows.value = [];
        await getDeployments(currentPage.value, pageSize.value);
      } catch (error: any) {
        console.error('批量删除操作失败:', error);
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
  getDeployments(1, pageSize.value);
};

// 切换集群
const handleClusterChange = () => {
  selectedNamespace.value = 'default';
  deployments.value = [];
  currentPage.value = 1;
  totalItems.value = 0;
  getNamespaces();
  getDeployments(1, pageSize.value);
};

// 查看Deployment指标
const viewDeploymentMetrics = async (deployment: K8sDeployment) => {
  if (!selectedCluster.value) {
    message.error('请先选择集群');
    return;
  }
  
  currentDeployment.value = deployment;
  metricsLoading.value = true;
  isMetricsModalVisible.value = true;
  
  try {
    const metrics = await getDeploymentMetricsApi(selectedCluster.value, deployment.namespace, deployment.name);
    deploymentMetrics.value = metrics;
  } catch (error: any) {
    console.error('获取Deployment指标失败:', error);
    message.error(error.message || '获取Deployment指标失败');
    deploymentMetrics.value = null;
  } finally {
    metricsLoading.value = false;
  }
};

// 查看Deployment事件
const viewDeploymentEvents = async (deployment: K8sDeployment) => {
  if (!selectedCluster.value) {
    message.error('请先选择集群');
    return;
  }
  
  currentDeployment.value = deployment;
  eventsLoading.value = true;
  isEventsModalVisible.value = true;
  
  try {
    const events = await getDeploymentEventsApi(selectedCluster.value, deployment.namespace, deployment.name);
    deploymentEvents.value = events.items || events || [];
  } catch (error: any) {
    console.error('获取Deployment事件失败:', error);
    message.error(error.message || '获取Deployment事件失败');
    deploymentEvents.value = [];
  } finally {
    eventsLoading.value = false;
  }
};

// 查看Deployment下的Pod
const viewDeploymentPods = async (deployment: K8sDeployment) => {
  if (!selectedCluster.value) {
    message.error('请先选择集群');
    return;
  }
  
  currentDeployment.value = deployment;
  podsLoading.value = true;
  isPodsModalVisible.value = true;
  
  try {
    const pods = await getDeploymentPodsApi(selectedCluster.value, deployment.namespace, deployment.name);
    deploymentPods.value = pods.items || pods || [];
  } catch (error: any) {
    console.error('获取Deployment Pod失败:', error);
    message.error(error.message || '获取Deployment Pod失败');
    deploymentPods.value = [];
  } finally {
    podsLoading.value = false;
  }
};

// 获取Pod状态颜色
const getPodStatusColor = (status: string) => {
  switch (status) {
    case 'Running':
      return 'green';
    case 'Pending':
      return 'orange';
    case 'Failed':
      return 'red';
    case 'Succeeded':
      return 'blue';
    default:
      return 'default';
  }
};

// 编辑Deployment相关函数
const handleEdit = (deployment: K8sDeployment) => {
  if (!selectedCluster.value) {
    message.error('请先选择集群');
    return;
  }
  
  currentDeployment.value = deployment;
  editForm.value = {
    replicas: deployment.replicas || 1,
    images: deployment.images || [],
    selectedImage: undefined,
    newImage: '',
    labels: { ...(deployment.labels || {}) },
    annotations: { ...(deployment.annotations || {}) }
  };
  isEditModalVisible.value = true;
};

const handleUpdateDeployment = async () => {
  if (!currentDeployment.value || !selectedCluster.value) {
    message.error('缺少必要参数');
    return;
  }

  loading.value = true;
  try {
    const updateData: any = {
      cluster_id: selectedCluster.value,
      name: currentDeployment.value.name,
      namespace: currentDeployment.value.namespace,
      replicas: editForm.value.replicas,
      labels: editForm.value.labels,
      annotations: editForm.value.annotations
    };

    // 如果选择了镜像更新
    if (editForm.value.selectedImage !== undefined && editForm.value.newImage) {
      updateData.images = [...editForm.value.images];
      updateData.images[editForm.value.selectedImage] = editForm.value.newImage;
    }

    await updateDeploymentApi(
      selectedCluster.value,
      currentDeployment.value.namespace,
      currentDeployment.value.name,
      updateData
    );

    message.success('Deployment更新成功');
    isEditModalVisible.value = false;
    await getDeployments(currentPage.value, pageSize.value);
  } catch (error: any) {
    console.error('更新Deployment失败:', error);
    message.error(error.message || '更新Deployment失败');
  } finally {
    loading.value = false;
  }
};

// 创建Deployment相关函数
const showCreateModal = () => {
  if (!selectedCluster.value) {
    message.error('请先选择集群');
    return;
  }
  createForm.value = {
    cluster_id: selectedCluster.value,
    name: '',
    namespace: selectedNamespace.value || 'default',
    replicas: 1,
    images: [''],
    labels: {},
    annotations: {}
  };
  isCreateModalVisible.value = true;
};

const handleCreateDeployment = async () => {
  if (!selectedCluster.value) {
    message.error('请先选择集群');
    return;
  }

  // 验证必要字段
  if (!createForm.value.name.trim()) {
    message.error('请输入Deployment名称');
    return;
  }
  if (!createForm.value.namespace) {
    message.error('请选择命名空间');
    return;
  }
  if (!createForm.value.images[0]?.trim()) {
    message.error('请输入容器镜像');
    return;
  }

  loading.value = true;
  try {
    createForm.value.cluster_id = selectedCluster.value;
    await createDeploymentApi(createForm.value);
    message.success('Deployment创建成功');
    isCreateModalVisible.value = false;
    await getDeployments(currentPage.value, pageSize.value);
  } catch (error: any) {
    console.error('创建Deployment失败:', error);
    message.error(error.message || '创建Deployment失败');
  } finally {
    loading.value = false;
  }
};

// 页面加载时获取数据
onMounted(() => {
  getClusters();
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

/* ==================== 概览卡片 ==================== */
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
}

.env-filter {
  width: 160px;
}

.env-filter :deep(.ant-select-selector) {
  border-radius: var(--border-radius-sm);
  height: 40px;
}

.toolbar-right {
  display: flex;
  gap: 12px;
  align-items: center;
  flex-shrink: 0;
}

.view-toggle :deep(.ant-radio-group) {
  border-radius: var(--border-radius-sm);
}

.view-toggle :deep(.ant-radio-button-wrapper) {
  height: 32px;
  line-height: 30px;
  padding: 0 12px;
  border-radius: var(--border-radius-sm);
}

.view-toggle :deep(.ant-radio-button-wrapper:first-child) {
  border-radius: var(--border-radius-sm) 0 0 var(--border-radius-sm);
}

.view-toggle :deep(.ant-radio-button-wrapper:last-child) {
  border-radius: 0 var(--border-radius-sm) var(--border-radius-sm) 0;
}

.cluster-option, .namespace-option {
  display: flex;
  align-items: center;
  gap: 10px;
}

/* ==================== 数据展示区域 ==================== */
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
  transition: background-color var(--transition-duration) var(--transition-function);
}

.cluster-table :deep(.ant-table-tbody > tr:hover) {
  background-color: #fafafa;
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

.deployment-name {
  display: flex;
  align-items: center;
  gap: 10px;
  font-weight: 500;
}

.namespace-tag {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: #e6f7ff;
  color: #1890ff;
  border: 1px solid #91d5ff;
  font-size: 13px;
  padding: 2px 8px;
  border-radius: 4px;
}

.env-tag {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-weight: 500;
  padding: 4px 12px;
  border-radius: var(--border-radius-base);
  font-size: 12px;
  border: none;
}

.status-wrapper {
  display: flex;
  flex-direction: column;
  gap: 8px;
  width: 100%;
}

.status-tag {
  font-weight: 500;
  padding: 2px 8px;
  border-radius: 4px;
  text-align: center;
}

.status-progress {
  width: 100%;
  margin-top: 4px;
}

.image-tag {
  display: flex;
  align-items: center;
  gap: 10px;
}

.image-text {
  font-family: 'Courier New', monospace;
  font-size: 13px;
  color: #595959;
  word-break: break-all;
}

.timestamp {
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--text-secondary);
  font-size: var(--font-size-base);
}

.action-column {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
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

/* YAML模态框样式 */
.yaml-modal {
  font-family: "Consolas", "Monaco", monospace;
}

/* 指标模态框样式 */
.metrics-modal .metrics-content {
  padding: 16px 0;
}

.metrics-overview {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 16px;
  margin-bottom: 24px;
}

.metric-card {
  background: #fafafa;
  border-radius: 8px;
  padding: 20px;
  display: flex;
  align-items: center;
  border: 1px solid #f0f0f0;
  transition: all 0.3s ease;
}

.metric-card:hover {
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  transform: translateY(-2px);
}

.metric-icon {
  width: 48px;
  height: 48px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
  margin-right: 16px;
}

.cpu-card .metric-icon {
  background: rgba(22, 119, 255, 0.1);
  color: #1677ff;
}

.memory-card .metric-icon {
  background: rgba(82, 196, 26, 0.1);
  color: #52c41a;
}

.network-card .metric-icon {
  background: rgba(250, 173, 20, 0.1);
  color: #faad14;
}

.availability-card .metric-icon {
  background: rgba(114, 46, 209, 0.1);
  color: #722ed1;
}

.metric-info {
  flex: 1;
}

.metric-value {
  font-size: 24px;
  font-weight: 600;
  color: #000000d9;
  line-height: 1.2;
  margin-bottom: 4px;
}

.metric-label {
  font-size: 14px;
  color: #00000073;
}

.metrics-details {
  margin-top: 24px;
}

.metrics-details .detail-card {
  background: #fafafa;
  border-radius: 8px;
  padding: 16px;
  border: 1px solid #f0f0f0;
}

.metrics-details .detail-card h4 {
  margin: 0 0 16px 0;
  font-weight: 600;
  color: #000000d9;
  font-size: 16px;
}

.detail-content {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.detail-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.detail-label {
  color: #00000073;
  font-weight: 500;
  font-size: 14px;
}

.detail-value {
  color: #000000d9;
  font-weight: 600;
  font-size: 14px;
}

/* 事件模态框样式 */
.events-modal .events-content {
  padding: 16px 0;
}

.time-info {
  font-size: 12px;
  line-height: 1.4;
}

.time-info > div {
  margin-bottom: 2px;
}

/* Pod模态框样式 */
.pods-modal .pods-content {
  padding: 16px 0;
}

.yaml-actions {
  display: flex;
  justify-content: flex-end;
  margin-bottom: 10px;
}

.yaml-editor {
  font-family: 'JetBrains Mono', 'Courier New', monospace;
  font-size: 14px;
  line-height: 1.5;
  padding: 16px;
  background-color: #fafafa;
  border-radius: 4px;
  border: 1px solid #f0f0f0;
  overflow: auto;
  max-height: 500px;
  margin: 0;
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
  
  .cluster-cards {
    grid-template-columns: repeat(auto-fill, minmax(340px, 1fr));
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
  
  .action-column {
    flex-direction: column;
    gap: 4px;
  }
  
  .action-column :deep(.ant-btn) {
    width: 28px;
    height: 28px;
  }
}
</style>
