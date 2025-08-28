<template>
  <div class="cluster-management-container namespace-management-container">
    <!-- 页面头部 -->
    <div class="page-header">
      <div class="header-content">
        <div class="title-section">
          <div class="page-title">
            <AppstoreOutlined class="title-icon" />
            <h1>Kubernetes 命名空间管理</h1>
          </div>
          <p class="page-subtitle">管理和监控集群中的所有命名空间资源</p>
        </div>
        <div class="header-actions">
          <a-button type="primary" size="large" @click="isCreateModalVisible = true">
            <template #icon><PlusOutlined /></template>
            创建命名空间
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
          <AppstoreOutlined />
        </div>
        <div class="card-info">
          <div class="card-number">{{ namespaces.length }}</div>
          <div class="card-label">命名空间总数</div>
        </div>
      </div>
      
      <div class="overview-card running-clusters">
        <div class="card-icon">
          <CheckCircleOutlined />
        </div>
        <div class="card-info">
          <div class="card-number">{{ activeNamespaces }}</div>
          <div class="card-label">活跃状态</div>
        </div>
      </div>
      
      <div class="overview-card env-types">
        <div class="card-icon">
          <DeploymentUnitOutlined />
        </div>
        <div class="card-info">
          <div class="card-number">{{ totalResources }}</div>
          <div class="card-label">总资源数</div>
        </div>
      </div>
      
      <div class="overview-card resource-usage">
        <div class="card-icon">
          <ClusterOutlined />
        </div>
        <div class="card-info">
          <div class="card-number">{{ selectedCluster || '-' }}</div>
          <div class="card-label">当前集群</div>
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
          v-model:value="statusFilter"
          placeholder="状态筛选"
          class="env-filter"
          allow-clear
          @change="handleFilterChange"
        >
          <template #suffixIcon><FilterOutlined /></template>
          <a-select-option value="Active">Active</a-select-option>
          <a-select-option value="Terminating">Terminating</a-select-option>
        </a-select>
        
        <a-input-search
          v-model:value="searchText"
          placeholder="搜索命名空间名称"
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
          @click="handleBatchQuota" 
          :disabled="!selectedRows.length"
          v-if="selectedRows.length > 0"
        >
          <template #icon><ControlOutlined /></template>
          配额 ({{ selectedRows.length }})
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
      <div class="display-header" v-if="filteredNamespaces.length > 0">
        <div class="result-info">
          <span class="result-count">共 {{ filteredNamespaces.length }} 个命名空间</span>
          <div class="env-tags">
            <a-tag color="green">活跃 {{ activeNamespaces }}</a-tag>
            <a-tag color="orange">资源 {{ totalResources }}</a-tag>
          </div>
        </div>
      </div>

      <!-- 表格视图 -->
      <a-table
        v-if="viewMode === 'table'"
        :columns="columns"
        :data-source="filteredNamespaces"
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
        class="cluster-table namespaces-table"
      >
        <!-- 命名空间名称列 -->
        <template #name="{ text }">
          <div class="cluster-name namespace-name">
            <AppstoreOutlined />
            <span>{{ text }}</span>
            <a-tag v-if="text === 'kube-system'" color="red" size="small">系统</a-tag>
            <a-tag v-if="text === 'default'" color="blue" size="small">默认</a-tag>
          </div>
        </template>

        <!-- 状态列 -->
        <template #status="{ text }">
          <a-badge 
            :status="text === 'Active' ? 'success' : 'processing'" 
            :text="text" 
            class="status-badge"
          />
        </template>
        
        <!-- 标签列 -->
        <template #labels="{ record }">
          <div class="labels-container">
            <a-tag 
              v-for="label in record.labels?.slice(0, 2)" 
              :key="label" 
              color="geekblue" 
              size="small"
              class="label-tag"
            >
              {{ label }}
            </a-tag>
            <a-tag 
              v-if="record.labels && record.labels.length > 2" 
              color="default" 
              size="small"
              @click="viewLabels(record)"
              class="more-tag"
            >
              +{{ record.labels.length - 2 }}
            </a-tag>
          </div>
        </template>

        <!-- 创建时间列 -->
        <template #creationTime="{ record }">
          <div class="timestamp">
            <ClockCircleOutlined />
            <a-tooltip :title="formatDateTime(record.creation_time)">
              <span>{{ formatDate(record.creation_time) }}</span>
            </a-tooltip>
          </div>
        </template>

        <!-- 操作列 -->
        <template #action="{ record }">
          <div class="action-column">
            <a-tooltip title="查看详情">
              <a-button type="primary" ghost shape="circle" size="small" @click="viewDetails(record)">
                <template #icon><EyeOutlined /></template>
              </a-button>
            </a-tooltip>

            <a-tooltip title="查看资源">
              <a-button type="primary" ghost shape="circle" size="small" @click="viewResources(record)">
                <template #icon><DeploymentUnitOutlined /></template>
              </a-button>
            </a-tooltip>

            <a-tooltip title="资源配额">
              <a-button type="primary" ghost shape="circle" size="small" @click="manageQuota(record)">
                <template #icon><ControlOutlined /></template>
              </a-button>
            </a-tooltip>

            <a-tooltip title="编辑">
              <a-button type="primary" ghost shape="circle" size="small" @click="handleEdit(record)">
                <template #icon><EditOutlined /></template>
              </a-button>
            </a-tooltip>
            
            <a-tooltip title="删除">
              <a-popconfirm
                title="确定要删除该命名空间吗?"
                description="删除命名空间将删除其中的所有资源，此操作不可撤销！"
                @confirm="handleDelete(record)"
                ok-text="确定"
                cancel-text="取消"
                :disabled="isSystemNamespace(record.name)"
              >
                <a-button 
                  type="primary" 
                  danger 
                  ghost 
                  shape="circle" 
                  size="small"
                  :disabled="isSystemNamespace(record.name)"
                >
                  <template #icon><DeleteOutlined /></template>
                </a-button>
              </a-popconfirm>
            </a-tooltip>
          </div>
        </template>

        <!-- 空状态 -->
        <template #emptyText>
          <div class="empty-state">
            <AppstoreOutlined style="font-size: 48px; color: #d9d9d9; margin-bottom: 16px" />
            <p>暂无命名空间数据</p>
            <a-button type="primary" @click="refreshData">刷新数据</a-button>
          </div>
        </template>
      </a-table>

      <!-- 卡片视图 -->
      <div v-else class="card-view">
        <a-spin :spinning="loading">
          <a-empty v-if="filteredNamespaces.length === 0" description="暂无命名空间数据">
            <template #image>
              <AppstoreOutlined style="font-size: 64px; color: #d9d9d9;" />
            </template>
            <template #description>
              <span style="color: #999;">暂无命名空间数据</span>
            </template>
            <a-button type="primary" @click="refreshData">刷新数据</a-button>
          </a-empty>
          <div v-else class="cluster-cards namespace-cards">
            <a-checkbox-group v-model:value="selectedCardIds" class="card-checkbox-group">
              <div v-for="namespace in filteredNamespaces" :key="namespace.uid" class="cluster-card namespace-card">
                <div class="card-header">
                  <a-checkbox 
                    :value="namespace.uid" 
                    class="card-checkbox"
                    :disabled="isSystemNamespace(namespace.name)"
                  />
                  <div class="service-title namespace-title">
                    <AppstoreOutlined class="service-icon" />
                    <h3>{{ namespace.name }}</h3>
                    <div class="namespace-tags">
                      <a-tag v-if="namespace.name === 'kube-system'" color="red" size="small">系统</a-tag>
                      <a-tag v-if="namespace.name === 'default'" color="blue" size="small">默认</a-tag>
                    </div>
                  </div>
                  <a-badge 
                    :status="namespace.status === 'Active' ? 'success' : 'processing'" 
                    class="card-badge"
                  />
                </div>
                
                <div class="card-content">
                  <div class="card-detail">
                    <span class="detail-label">状态:</span>
                    <span class="detail-value">
                      <a-badge 
                        :status="namespace.status === 'Active' ? 'success' : 'processing'" 
                        :text="namespace.status"
                      />
                    </span>
                  </div>
                  <div class="card-detail">
                    <span class="detail-label">标签:</span>
                    <span class="detail-value">
                      <a-tag 
                        v-for="label in namespace.labels?.slice(0, 1)" 
                        :key="label" 
                        color="geekblue" 
                        size="small"
                      >
                        {{ label }}
                      </a-tag>
                      <span v-if="namespace.labels && namespace.labels.length > 1" class="more-labels">
                        +{{ namespace.labels.length - 1 }}
                      </span>
                      <span v-if="!namespace.labels?.length" class="no-labels">无</span>
                    </span>
                  </div>
                  <div class="card-detail">
                    <span class="detail-label">创建时间:</span>
                    <span class="detail-value">
                      <ClockCircleOutlined />
                      {{ formatDate(namespace.creation_time) }}
                    </span>
                  </div>
                </div>
                
                <div class="card-footer card-action-footer">
                  <a-button type="primary" ghost size="small" @click="viewDetails(namespace)">
                    <template #icon><EyeOutlined /></template>
                    详情
                  </a-button>
                  <a-button type="primary" ghost size="small" @click="viewResources(namespace)">
                    <template #icon><DeploymentUnitOutlined /></template>
                    资源
                  </a-button>
                  <a-button type="primary" ghost size="small" @click="manageQuota(namespace)">
                    <template #icon><ControlOutlined /></template>
                    配额
                  </a-button>
                  <a-popconfirm
                    title="确定要删除该命名空间吗?"
                    @confirm="handleDelete(namespace)"
                    ok-text="确定"
                    cancel-text="取消"
                    :disabled="isSystemNamespace(namespace.name)"
                  >
                    <a-button 
                      type="primary" 
                      danger 
                      ghost 
                      size="small"
                      :disabled="isSystemNamespace(namespace.name)"
                    >
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

    <!-- 创建命名空间模态框 -->
    <a-modal
      v-model:open="isCreateModalVisible"
      title="创建命名空间"
      @ok="handleCreateConfirm"
      @cancel="handleCreateCancel"
      :confirmLoading="loading"
      class="cluster-modal namespace-modal"
      width="700px"
    >
      <a-alert class="modal-alert" type="info" show-icon>
        <template #message>创建新的命名空间</template>
        <template #description>命名空间用于逻辑隔离Kubernetes资源</template>
      </a-alert>

      <a-form :model="createForm" layout="vertical" class="cluster-form namespace-form">
        <a-form-item
          label="命名空间名称"
          name="namespace"
          :rules="[
            { required: true, message: '请输入命名空间名称' },
            { pattern: /^[a-z0-9]([-a-z0-9]*[a-z0-9])?$/, message: '名称只能包含小写字母、数字和连字符，且不能以连字符开头或结尾' }
          ]"
        >
          <a-input
            v-model:value="createForm.namespace"
            placeholder="请输入命名空间名称"
            class="form-input"
          >
            <template #prefix><AppstoreOutlined /></template>
          </a-input>
        </a-form-item>

        <a-form-item label="标签 (可选)">
          <div class="key-value-inputs">
            <div v-for="(entry, index) in createForm.labelEntries" :key="index" class="key-value-row">
              <a-input
                v-model:value="entry.key"
                placeholder="键"
                style="width: 40%"
                class="form-input"
              />
              <a-input
                v-model:value="entry.value"
                placeholder="值"
                style="width: 40%"
                class="form-input"
              />
              <a-button
                v-if="createForm.labelEntries.length > 1"
                type="text"
                danger
                @click="removeLabelEntry(index)"
                style="width: 15%"
              >
                删除
              </a-button>
              <a-button
                v-else
                type="text"
                @click="addLabelEntry"
                style="width: 15%"
              >
                添加
              </a-button>
            </div>
            <a-button
              v-if="createForm.labelEntries.length > 1"
              type="dashed"
              @click="addLabelEntry"
              style="width: 100%; margin-top: 8px"
            >
              <template #icon><PlusOutlined /></template>
              添加标签
            </a-button>
          </div>
        </a-form-item>

        <a-form-item label="注解 (可选)">
          <div class="key-value-inputs">
            <div v-for="(entry, index) in createForm.annotationEntries" :key="index" class="key-value-row">
              <a-input
                v-model:value="entry.key"
                placeholder="键"
                style="width: 40%"
                class="form-input"
              />
              <a-input
                v-model:value="entry.value"
                placeholder="值"
                style="width: 40%"
                class="form-input"
              />
              <a-button
                v-if="createForm.annotationEntries.length > 1"
                type="text"
                danger
                @click="removeAnnotationEntry(index)"
                style="width: 15%"
              >
                删除
              </a-button>
              <a-button
                v-else
                type="text"
                @click="addAnnotationEntry"
                style="width: 15%"
              >
                添加
              </a-button>
            </div>
            <a-button
              v-if="createForm.annotationEntries.length > 1"
              type="dashed"
              @click="addAnnotationEntry"
              style="width: 100%; margin-top: 8px"
            >
              <template #icon><PlusOutlined /></template>
              添加注解
            </a-button>
          </div>
        </a-form-item>
      </a-form>
    </a-modal>

    <!-- 编辑命名空间模态框 -->
    <a-modal
      v-model:open="editModalVisible"
      title="编辑命名空间"
      @ok="handleEditConfirm"
      @cancel="handleEditCancel"
      :confirmLoading="loading"
      class="cluster-modal namespace-modal"
      width="700px"
    >
      <a-alert v-if="currentNamespace" class="modal-alert" type="info" show-icon>
        <template #message>编辑命名空间: {{ currentNamespace.name }}</template>
        <template #description>修改命名空间的标签和注解</template>
      </a-alert>

      <a-form :model="editForm" layout="vertical" class="cluster-form namespace-form">
        <a-form-item label="命名空间名称">
          <a-input
            :value="currentNamespace?.name"
            disabled
            class="form-input disabled"
          >
            <template #prefix><AppstoreOutlined /></template>
          </a-input>
        </a-form-item>

        <a-form-item label="标签">
          <div class="key-value-inputs">
            <div v-for="(entry, index) in editForm.labelEntries" :key="index" class="key-value-row">
              <a-input
                v-model:value="entry.key"
                placeholder="键"
                style="width: 40%"
                class="form-input"
              />
              <a-input
                v-model:value="entry.value"
                placeholder="值"
                style="width: 40%"
                class="form-input"
              />
              <a-button
                type="text"
                danger
                @click="removeEditLabelEntry(index)"
                style="width: 15%"
              >
                删除
              </a-button>
            </div>
            <a-button
              type="dashed"
              @click="addEditLabelEntry"
              style="width: 100%; margin-top: 8px"
            >
              <template #icon><PlusOutlined /></template>
              添加标签
            </a-button>
          </div>
        </a-form-item>

        <a-form-item label="注解">
          <div class="key-value-inputs">
            <div v-for="(entry, index) in editForm.annotationEntries" :key="index" class="key-value-row">
              <a-input
                v-model:value="entry.key"
                placeholder="键"
                style="width: 40%"
                class="form-input"
              />
              <a-input
                v-model:value="entry.value"
                placeholder="值"
                style="width: 40%"
                class="form-input"
              />
              <a-button
                type="text"
                danger
                @click="removeEditAnnotationEntry(index)"
                style="width: 15%"
              >
                删除
              </a-button>
            </div>
            <a-button
              type="dashed"
              @click="addEditAnnotationEntry"
              style="width: 100%; margin-top: 8px"
            >
              <template #icon><PlusOutlined /></template>
              添加注解
            </a-button>
          </div>
        </a-form-item>
      </a-form>
    </a-modal>

    <!-- 命名空间详情模态框 -->
    <a-modal
      v-model:open="detailsModalVisible"
      title="命名空间详情"
      width="900px"
      :footer="null"
      class="cluster-modal namespace-detail-modal"
    >
      <div v-if="currentNamespace" class="namespace-details">
        <a-alert class="modal-alert" type="info" show-icon>
          <template #message>{{ currentNamespace.name }}</template>
          <template #description>
            状态: {{ currentNamespace.status }} | 创建时间: {{ formatDateTime(currentNamespace.creation_time) }}
          </template>
        </a-alert>

        <a-tabs default-active-key="1">
          <a-tab-pane key="1" tab="基本信息">
            <div class="details-grid">
              <div class="detail-card">
                <h4><AppstoreOutlined /> 基本信息</h4>
                <div class="detail-item">
                  <div class="detail-label">名称:</div>
                  <div class="detail-value">{{ currentNamespace.name }}</div>
                </div>
                <div class="detail-item">
                  <div class="detail-label">状态:</div>
                  <div class="detail-value">
                    <a-badge 
                      :status="currentNamespace.status === 'Active' ? 'success' : 'processing'" 
                      :text="currentNamespace.status"
                    />
                  </div>
                </div>
                <div class="detail-item">
                  <div class="detail-label">创建时间:</div>
                  <div class="detail-value">{{ formatDateTime(currentNamespace.creation_time) }}</div>
                </div>
                <div class="detail-item">
                  <div class="detail-label">UID:</div>
                  <div class="detail-value">{{ currentNamespace.uid }}</div>
                </div>
              </div>
            </div>
          </a-tab-pane>

          <a-tab-pane key="2" tab="标签和注解">
            <div class="details-grid">
              <div class="detail-card">
                <div class="card-header">
                  <h4><TagOutlined /> 标签</h4>
                  <a-button type="primary" size="small" @click="handleEdit(currentNamespace)">
                    <template #icon><EditOutlined /></template>
                    编辑
                  </a-button>
                </div>
                <div class="labels-list">
                  <a-empty v-if="!currentNamespace.labels?.length" description="暂无标签" />
                  <a-tag 
                    v-for="label in currentNamespace.labels" 
                    :key="label"
                    color="blue"
                    class="label-tag"
                  >
                    {{ label }}
                  </a-tag>
                </div>
              </div>

              <div class="detail-card">
                <h4><InfoCircleOutlined /> 注解</h4>
                <div class="annotations-list">
                  <a-empty v-if="!currentNamespace.annotations?.length" description="暂无注解" />
                  <div 
                    v-for="annotation in currentNamespace.annotations" 
                    :key="annotation"
                    class="annotation-item"
                  >
                    <div class="annotation-key">{{ annotation.split('=')[0] }}</div>
                    <div class="annotation-value">{{ annotation.split('=')[1] || '-' }}</div>
                  </div>
                </div>
              </div>
            </div>
          </a-tab-pane>

          <a-tab-pane key="3" tab="事件" @click="loadNamespaceEvents">
            <div class="events-container">
              <a-spin :spinning="eventsLoading">
                <a-timeline>
                  <a-timeline-item 
                    v-for="(event, index) in namespaceEvents" 
                    :key="index"
                    :color="event.type === 'Normal' ? 'green' : 'red'"
                  >
                    <div class="event-card">
                      <div class="event-header">
                        <span class="event-reason">{{ event.reason }}</span>
                        <span class="event-time">{{ formatDateTime(event.last_timestamp) }}</span>
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
                <a-empty v-if="!namespaceEvents.length && !eventsLoading" description="暂无事件" />
              </a-spin>
            </div>
          </a-tab-pane>
        </a-tabs>

        <div class="modal-footer">
          <a-space>
            <a-button @click="detailsModalVisible = false">关闭</a-button>
            <a-button type="primary" ghost @click="handleEdit(currentNamespace)">
              <template #icon><EditOutlined /></template>
              编辑
            </a-button>
            <a-button type="primary" ghost @click="viewResources(currentNamespace)">
              <template #icon><DeploymentUnitOutlined /></template>
              查看资源
            </a-button>
            <a-button type="primary" ghost @click="manageQuota(currentNamespace)">
              <template #icon><ControlOutlined /></template>
              管理配额
            </a-button>
          </a-space>
        </div>
      </div>
    </a-modal>

    <!-- 资源配额模态框 -->
    <a-modal
      v-model:open="quotaModalVisible"
      title="资源配额管理"
      @ok="handleQuotaConfirm"
      @cancel="quotaModalVisible = false"
      :confirmLoading="quotaLoading"
      class="cluster-modal quota-modal"
      width="800px"
    >
      <a-alert v-if="currentNamespace" class="modal-alert" type="info" show-icon>
        <template #message>{{ currentNamespace.name }} 资源配额</template>
        <template #description>设置命名空间的资源使用限制</template>
      </a-alert>

      <a-form :model="quotaForm" layout="vertical" class="cluster-form quota-form">
        <a-row :gutter="16">
          <a-col :span="12">
            <a-form-item label="CPU请求量">
              <a-input
                v-model:value="quotaForm.cpu_request"
                placeholder="如: 2, 500m"
                class="form-input"
              />
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item label="CPU限制量">
              <a-input
                v-model:value="quotaForm.cpu_limit"
                placeholder="如: 4, 1000m"
                class="form-input"
              />
            </a-form-item>
          </a-col>
        </a-row>

        <a-row :gutter="16">
          <a-col :span="12">
            <a-form-item label="内存请求量">
              <a-input
                v-model:value="quotaForm.memory_request"
                placeholder="如: 4Gi, 1024Mi"
                class="form-input"
              />
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item label="内存限制量">
              <a-input
                v-model:value="quotaForm.memory_limit"
                placeholder="如: 8Gi, 2048Mi"
                class="form-input"
              />
            </a-form-item>
          </a-col>
        </a-row>

        <a-row :gutter="16">
          <a-col :span="12">
            <a-form-item label="存储请求量">
              <a-input
                v-model:value="quotaForm.storage_request"
                placeholder="如: 100Gi"
                class="form-input"
              />
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item label="持久卷声明数量">
              <a-input
                v-model:value="quotaForm.persistent_volume_claims"
                placeholder="如: 10"
                class="form-input"
              />
            </a-form-item>
          </a-col>
        </a-row>

        <a-row :gutter="16">
          <a-col :span="8">
            <a-form-item label="Pod数量">
              <a-input
                v-model:value="quotaForm.pods"
                placeholder="如: 50"
                class="form-input"
              />
            </a-form-item>
          </a-col>
          <a-col :span="8">
            <a-form-item label="Service数量">
              <a-input
                v-model:value="quotaForm.services"
                placeholder="如: 10"
                class="form-input"
              />
            </a-form-item>
          </a-col>
          <a-col :span="8">
            <a-form-item label="Secret数量">
              <a-input
                v-model:value="quotaForm.secrets"
                placeholder="如: 20"
                class="form-input"
              />
            </a-form-item>
          </a-col>
        </a-row>

        <a-form-item label="ConfigMap数量">
          <a-input
            v-model:value="quotaForm.configmaps"
            placeholder="如: 20"
            class="form-input"
            style="width: 50%"
          />
        </a-form-item>
      </a-form>
    </a-modal>

    <!-- 命名空间资源模态框 -->
    <a-modal
      v-model:open="resourcesModalVisible"
      title="命名空间资源"
      width="900px"
      :footer="null"
      class="cluster-modal resources-modal"
    >
      <div v-if="currentNamespace" class="resources-content">
        <a-alert class="modal-alert" type="info" show-icon>
          <template #message>{{ currentNamespace.name }} 资源列表</template>
          <template #description>该命名空间下的所有资源</template>
        </a-alert>

        <a-spin :spinning="resourcesLoading">
          <a-table
            :columns="[
              { title: '资源类型', dataIndex: 'type', key: 'type', width: '20%' },
              { title: '资源名称', dataIndex: 'name', key: 'name', width: '30%' },
              { title: '状态', dataIndex: 'status', key: 'status', width: '15%' },
              { title: '创建时间', dataIndex: 'creation_time', key: 'creation_time', width: '35%' }
            ]"
            :data-source="namespaceResources"
            :pagination="false"
            row-key="name"
          >
            <template #bodyCell="{ column, record }">
              <template v-if="column.key === 'status'">
                <a-badge 
                  :status="record.status === 'Running' ? 'success' : 'processing'" 
                  :text="record.status"
                />
              </template>
              <template v-else-if="column.key === 'creation_time'">
                {{ formatDateTime(record.creation_time) }}
              </template>
            </template>
          </a-table>
          <a-empty v-if="!namespaceResources.length && !resourcesLoading" description="暂无资源" />
        </a-spin>
      </div>
    </a-modal>
  </div>
</template>

<script lang="ts" setup>
import { ref, computed, onMounted, watch } from 'vue';
import { message } from 'ant-design-vue';
import {
  getNamespacesByClusterIdApi,
  createNamespaceApi,
  deleteNamespaceApi,
  batchDeleteNamespaceApi,
  getNamespaceDetailsApi,
  updateNamespaceApi,
  getNamespaceResourcesApi,
  getNamespaceEventsApi,
  setNamespaceQuotaApi,
  getNamespaceQuotaApi,
  getAllClustersApi,
} from '#/api';
import type { 
  NamespaceDetails, 
  NamespaceResource,
  NamespaceEvent,
  ResourceQuota
} from '#/api';
import { 
  CloudServerOutlined, 
  TableOutlined, 
  AppstoreOutlined, 
  ReloadOutlined,
  DeleteOutlined,
  ClusterOutlined,
  FilterOutlined,
  PlusOutlined,
  EditOutlined,
  EyeOutlined,
  DeploymentUnitOutlined,
  ControlOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  TagOutlined,
  InfoCircleOutlined
} from '@ant-design/icons-vue';

// 基本状态变量
const loading = ref(false);
const clustersLoading = ref(false);
const resourcesLoading = ref(false);
const eventsLoading = ref(false);
const quotaLoading = ref(false);
const namespaces = ref<NamespaceDetails[]>([]);
const searchText = ref('');
const statusFilter = ref<string>();
const selectedRows = ref<NamespaceDetails[]>([]);
const detailsModalVisible = ref(false);
const resourcesModalVisible = ref(false);
const quotaModalVisible = ref(false);
const isCreateModalVisible = ref(false);
const editModalVisible = ref(false);
const clusters = ref<Array<{id: number, name: string}>>([]);
const selectedCluster = ref<number>();
const viewMode = ref<'table' | 'card'>('table');
const currentNamespace = ref<NamespaceDetails | null>(null);
const selectedCardIds = ref<string[]>([]);
const currentPage = ref(1);
const pageSize = ref(12);
const totalItems = ref(0);
const namespaceResources = ref<NamespaceResource[]>([]);
const namespaceEvents = ref<NamespaceEvent[]>([]);

// 表单状态
const createForm = ref<{
  namespace: string;
  labelEntries: Array<{ key: string; value: string }>;
  annotationEntries: Array<{ key: string; value: string }>;
}>({
  namespace: '',
  labelEntries: [{ key: '', value: '' }],
  annotationEntries: [{ key: '', value: '' }]
});

const editForm = ref<{
  namespace: string;
  labelEntries: Array<{ key: string; value: string }>;
  annotationEntries: Array<{ key: string; value: string }>;
}>({
  namespace: '',
  labelEntries: [{ key: '', value: '' }],
  annotationEntries: [{ key: '', value: '' }]
});

const quotaForm = ref<ResourceQuota>({
  cpu_request: '',
  cpu_limit: '',
  memory_request: '',
  memory_limit: '',
  storage_request: '',
  persistent_volume_claims: '',
  pods: '',
  services: '',
  secrets: '',
  configmaps: '',
});

// 根据卡片选择更新 selectedRows
watch(selectedCardIds, (newValue) => {
  selectedRows.value = namespaces.value.filter(ns => 
    newValue.includes(ns.uid)
  );
});

// 表格列配置
const columns = [
  {
    title: '命名空间名称',
    dataIndex: 'name',
    key: 'name',
    slots: { customRender: 'name' },
    width: '20%',
    sorter: (a: NamespaceDetails, b: NamespaceDetails) => a.name.localeCompare(b.name),
  },
  {
    title: '状态',
    dataIndex: 'status',
    key: 'status',
    width: '12%',
    slots: { customRender: 'status' },
    sorter: (a: NamespaceDetails, b: NamespaceDetails) => a.status.localeCompare(b.status),
  },
  {
    title: '标签',
    dataIndex: 'labels',
    key: 'labels',
    width: '25%',
    slots: { customRender: 'labels' },
  },
  {
    title: '创建时间',
    dataIndex: 'creation_time',
    key: 'creationTime',
    width: '15%',
    sorter: (a: NamespaceDetails, b: NamespaceDetails) => new Date(a.creation_time).getTime() - new Date(b.creation_time).getTime(),
    slots: { customRender: 'creationTime' },
  },
  {
    title: '操作',
    key: 'action',
    width: '18%',
    fixed: 'right',
    slots: { customRender: 'action' },
  },
];

// 计算属性
const filteredNamespaces = computed(() => {
  let result = namespaces.value;
  
  if (statusFilter.value) {
    result = result.filter(ns => ns.status === statusFilter.value);
  }
  
  const searchValue = searchText.value.toLowerCase().trim();
  if (searchValue) {
    result = result.filter(ns => 
      ns.name.toLowerCase().includes(searchValue)
    );
  }
  
  return result;
});

const activeNamespaces = computed(() => 
  namespaces.value.filter(ns => ns.status === 'Active').length
);

const totalResources = computed(() => 
  namespaces.value.length * 5
);

// 表格选择配置
const rowSelection = {
  onChange: (_: string[], selectedRowsData: NamespaceDetails[]) => {
    selectedRows.value = selectedRowsData;
    selectedCardIds.value = selectedRowsData.map(row => row.uid);
  },
  getCheckboxProps: (record: NamespaceDetails) => ({
    disabled: isSystemNamespace(record.name),
  }),
};

// 判断是否是系统命名空间
const isSystemNamespace = (name: string) => {
  const systemNamespaces = ['kube-system', 'kube-public', 'kube-node-lease'];
  return systemNamespaces.includes(name);
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

// 获取集群列表
const getClusters = async () => {
  clustersLoading.value = true;
  try {
    const res = await getAllClustersApi();
    clusters.value = res ?? [];
    if (clusters.value.length > 0 && !selectedCluster.value) {
      selectedCluster.value = clusters.value[0]?.id;
      if (selectedCluster.value) {
        await getNamespaces();
      }
    }
  } catch (error: any) {
    message.error(error.message || '获取集群列表失败');
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
  
  loading.value = true;
  try {
    const res = await getNamespacesByClusterIdApi(selectedCluster.value);
    
    const namespaceDetails: NamespaceDetails[] = [];
    for (const ns of res) {
      try {
        const details = await getNamespaceDetailsApi(selectedCluster.value, ns.name);
        namespaceDetails.push(details);
      } catch (error) {
        namespaceDetails.push({
          name: ns.name,
          uid: `${ns.name}-${Date.now()}`,
          status: 'Active',
          creation_time: new Date().toISOString(),
          labels: [],
          annotations: []
        });
      }
    }
    
    namespaces.value = namespaceDetails;
    totalItems.value = namespaceDetails.length;
    selectedRows.value = [];
    selectedCardIds.value = [];
  } catch (error: any) {
    message.error(error.message || '获取命名空间列表失败');
    namespaces.value = [];
    totalItems.value = 0;
  } finally {
    loading.value = false;
  }
};

// 刷新数据
const refreshData = () => {
  getNamespaces();
};

// 搜索
const onSearch = () => {
  // 搜索逻辑已经在计算属性中实现
};

// 筛选处理
const handleFilterChange = () => {
  // 筛选逻辑已经在计算属性中实现
};

// 批量操作
const handleBatchQuota = () => {
  message.info('批量配额管理功能开发中...');
};

const handleBatchDelete = async () => {
  if (!selectedRows.value.length || !selectedCluster.value) return;
  
  try {
    loading.value = true;
    await batchDeleteNamespaceApi({
      cluster_id: selectedCluster.value,
      names: selectedRows.value.map(ns => ns.name)
    });
    
    message.success(`成功删除 ${selectedRows.value.length} 个命名空间`);
    selectedRows.value = [];
    selectedCardIds.value = [];
    getNamespaces();
  } catch (error: any) {
    message.error(error.message || '批量删除失败');
  } finally {
    loading.value = false;
  }
};

// 查看详情
const viewDetails = async (namespace: NamespaceDetails) => {
  currentNamespace.value = namespace;
  detailsModalVisible.value = true;
};

// 查看标签
const viewLabels = (namespace: NamespaceDetails) => {
  currentNamespace.value = namespace;
  detailsModalVisible.value = true;
};

// 查看资源
const viewResources = async (namespace: NamespaceDetails) => {
  if (!selectedCluster.value) return;
  try {
    currentNamespace.value = namespace;
    resourcesLoading.value = true;
    const resources = await getNamespaceResourcesApi(selectedCluster.value, namespace.name);
    namespaceResources.value = resources || [];
    resourcesModalVisible.value = true;
  } catch (error: any) {
    message.error(error.message || '获取命名空间资源失败');
  } finally {
    resourcesLoading.value = false;
  }
};

// 管理配额
const manageQuota = async (namespace: NamespaceDetails) => {
  if (!selectedCluster.value) return;
  try {
    currentNamespace.value = namespace;
    const quota = await getNamespaceQuotaApi(selectedCluster.value, namespace.name);
    quotaForm.value = quota || {
      cpu_request: '',
      cpu_limit: '',
      memory_request: '',
      memory_limit: '',
      storage_request: '',
      persistent_volume_claims: '',
      pods: '',
      services: '',
      secrets: '',
      configmaps: '',
    };
    quotaModalVisible.value = true;
  } catch (error: any) {
    // 如果没有配额，使用空表单
    quotaForm.value = {
      cpu_request: '',
      cpu_limit: '',
      memory_request: '',
      memory_limit: '',
      storage_request: '',
      persistent_volume_claims: '',
      pods: '',
      services: '',
      secrets: '',
      configmaps: '',
    };
    quotaModalVisible.value = true;
  }
};

// 编辑命名空间
const handleEdit = async (namespace: NamespaceDetails) => {
  currentNamespace.value = namespace;
  editForm.value = {
    namespace: namespace.name,
    labelEntries: namespace.labels?.length 
      ? namespace.labels.map(label => {
          const [key, value] = label.split('=');
          return { key: key || '', value: value || '' };
        })
      : [{ key: '', value: '' }],
    annotationEntries: namespace.annotations?.length 
      ? namespace.annotations.map(annotation => {
          const [key, value] = annotation.split('=');
          return { key: key || '', value: value || '' };
        })
      : [{ key: '', value: '' }]
  };
  editModalVisible.value = true;
};

// 删除命名空间
const handleDelete = async (namespace: NamespaceDetails) => {
  if (!selectedCluster.value) return;
  
  try {
    await deleteNamespaceApi(selectedCluster.value, namespace.name);
    message.success('命名空间删除成功');
    getNamespaces();
  } catch (error: any) {
    message.error(error.message || '删除命名空间失败');
  }
};

// 切换集群
const handleClusterChange = () => {
  namespaces.value = [];
  currentPage.value = 1;
  totalItems.value = 0;
  getNamespaces();
};

// 分页处理
const handleTableChange = (pagination: any) => {
  currentPage.value = pagination.current;
  pageSize.value = pagination.pageSize;
};

// 表单处理函数
const addLabelEntry = () => {
  createForm.value.labelEntries.push({ key: '', value: '' });
};

const removeLabelEntry = (index: number) => {
  createForm.value.labelEntries.splice(index, 1);
};

const addAnnotationEntry = () => {
  createForm.value.annotationEntries.push({ key: '', value: '' });
};

const removeAnnotationEntry = (index: number) => {
  createForm.value.annotationEntries.splice(index, 1);
};

const addEditLabelEntry = () => {
  editForm.value.labelEntries.push({ key: '', value: '' });
};

const removeEditLabelEntry = (index: number) => {
  editForm.value.labelEntries.splice(index, 1);
};

const addEditAnnotationEntry = () => {
  editForm.value.annotationEntries.push({ key: '', value: '' });
};

const removeEditAnnotationEntry = (index: number) => {
  editForm.value.annotationEntries.splice(index, 1);
};

// 创建命名空间处理
const handleCreateConfirm = async () => {
  if (!selectedCluster.value) {
    message.error('请选择集群');
    return;
  }

  if (!createForm.value.namespace) {
    message.error('请输入命名空间名称');
    return;
  }

  loading.value = true;
  try {
    const labels = createForm.value.labelEntries
      .filter(entry => entry.key && entry.value)
      .map(entry => `${entry.key}=${entry.value}`);

    const annotations = createForm.value.annotationEntries
      .filter(entry => entry.key && entry.value)
      .map(entry => `${entry.key}=${entry.value}`);

    await createNamespaceApi({
      cluster_id: selectedCluster.value,
      namespace: createForm.value.namespace,
      labels,
      annotations
    });

    message.success('命名空间创建成功');
    isCreateModalVisible.value = false;
    resetCreateForm();
    getNamespaces();
  } catch (error: any) {
    message.error(error.message || '创建命名空间失败');
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
    namespace: '',
    labelEntries: [{ key: '', value: '' }],
    annotationEntries: [{ key: '', value: '' }]
  };
};

// 编辑命名空间处理
const handleEditConfirm = async () => {
  if (!selectedCluster.value || !currentNamespace.value) {
    message.error('无效的操作');
    return;
  }

  loading.value = true;
  try {
    const labels = editForm.value.labelEntries
      .filter(entry => entry.key && entry.value)
      .map(entry => `${entry.key}=${entry.value}`);

    const annotations = editForm.value.annotationEntries
      .filter(entry => entry.key && entry.value)
      .map(entry => `${entry.key}=${entry.value}`);

    await updateNamespaceApi({
      cluster_id: selectedCluster.value,
      namespace: currentNamespace.value.name,
      labels,
      annotations
    });

    message.success('命名空间更新成功');
    editModalVisible.value = false;
    getNamespaces();
  } catch (error: any) {
    message.error(error.message || '更新命名空间失败');
  } finally {
    loading.value = false;
  }
};

const handleEditCancel = () => {
  editModalVisible.value = false;
};

// 配额管理处理
const handleQuotaConfirm = async () => {
  if (!selectedCluster.value || !currentNamespace.value) {
    message.error('无效的操作');
    return;
  }

  quotaLoading.value = true;
  try {
    await setNamespaceQuotaApi(
      selectedCluster.value,
      currentNamespace.value.name,
      quotaForm.value
    );

    message.success('资源配额设置成功');
    quotaModalVisible.value = false;
  } catch (error: any) {
    message.error(error.message || '设置资源配额失败');
  } finally {
    quotaLoading.value = false;
  }
};

// 加载命名空间事件
const loadNamespaceEvents = async () => {
  if (!selectedCluster.value || !currentNamespace.value) return;

  eventsLoading.value = true;
  try {
    const events = await getNamespaceEventsApi(selectedCluster.value, currentNamespace.value.name);
    namespaceEvents.value = events || [];
  } catch (error: any) {
    message.error(error.message || '获取命名空间事件失败');
    namespaceEvents.value = [];
  } finally {
    eventsLoading.value = false;
  }
};

// 页面加载时获取数据
onMounted(() => {
  getClusters();
});
</script>

<style>
/* 继承现有样式系统 */
.namespace-management-container {
  /* 样式继承自父类 */
}

.namespace-name {
  display: flex;
  align-items: center;
  gap: 10px;
  font-weight: 500;
}

/* ==================== 命名空间特定样式 ==================== */
.namespace-tags {
  display: flex;
  gap: 4px;
}

.labels-container {
  display: flex;
  gap: 4px;
  flex-wrap: wrap;
}

.label-tag {
  margin-right: 4px !important;
}

.more-tag {
  cursor: pointer;
}

.more-labels {
  color: #999;
  font-size: 12px;
  margin-left: 4px;
}

.no-labels {
  color: #ccc;
  font-size: 12px;
}

/* ==================== 键值对输入样式 ==================== */
.key-value-inputs {
  border: 1px solid #d9d9d9;
  border-radius: 6px;
  padding: 16px;
  background-color: #fafafa;
}

.key-value-row {
  display: flex;
  gap: 8px;
  align-items: center;
  margin-bottom: 8px;
}

.key-value-row:last-child {
  margin-bottom: 0;
}

/* ==================== 模态框样式 ==================== */
.cluster-modal :deep(.ant-modal-content) {
  border-radius: 8px;
  overflow: hidden;
  box-shadow: 0 9px 28px rgba(0, 0, 0, 0.12);
}

.cluster-modal :deep(.ant-modal-header) {
  background: #ffffff;
  border-bottom: 1px solid #f0f0f0;
  padding: 20px 24px;
}

.cluster-modal :deep(.ant-modal-title) {
  font-size: 16px;
  font-weight: 600;
  color: #000000d9;
}

.modal-alert {
  margin-bottom: 20px;
  border-radius: 6px;
}

.cluster-form {
  padding: 8px 0;
}

.form-input {
  border-radius: 6px;
  transition: all 0.3s cubic-bezier(0.645, 0.045, 0.355, 1);
  font-size: 14px;
  height: 40px;
}

.form-input.disabled {
  background-color: #f5f5f5;
  color: #999;
}

.form-input:focus, .form-input:hover {
  border-color: #1677ff;
  box-shadow: 0 0 0 2px rgba(22, 119, 255, 0.1);
}

/* ==================== 详情模态框样式 ==================== */
.namespace-details {
  padding: 8px 0;
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

.detail-card h4 {
  margin: 0 0 16px 0;
  font-weight: 500;
  display: flex;
  align-items: center;
  gap: 8px;
  color: #000000d9;
}

.detail-item {
  display: flex;
  justify-content: space-between;
  margin-bottom: 12px;
  align-items: flex-start;
}

.detail-label {
  color: #00000073;
  font-weight: 500;
  min-width: 100px;
}

.detail-value {
  color: #000000d9;
  font-weight: 400;
  flex: 1;
  text-align: right;
}

/* 标签和注解样式 */
.labels-list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 12px;
}

.annotations-list {
  margin-top: 12px;
}

.annotation-item {
  display: flex;
  justify-content: space-between;
  padding: 8px 0;
  border-bottom: 1px solid #f0f0f0;
}

.annotation-item:last-child {
  border-bottom: none;
}

.annotation-key {
  font-weight: 600;
  color: #000000d9;
  flex: 1;
}

.annotation-value {
  color: #00000073;
  word-break: break-all;
  margin-left: 16px;
  flex: 2;
}

/* 事件容器样式 */
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
  align-items: center;
}

.event-reason {
  font-weight: 600;
  color: #000000d9;
}

.event-time {
  color: #00000073;
  font-size: 12px;
}

.event-message {
  margin-bottom: 12px;
  line-height: 1.5;
  color: #000000d9;
}

.event-meta {
  display: flex;
  gap: 16px;
  font-size: 12px;
  color: #00000073;
}

/* 模态框底部 */
.modal-footer {
  display: flex;
  justify-content: flex-end;
  margin-top: 16px;
}

/* ==================== 配额表单样式 ==================== */
.quota-form .form-input {
  height: 36px;
}

/* ==================== 资源表样式 ==================== */
.resources-content {
  padding: 8px 0;
}

/* ==================== 响应式设计 ==================== */
@media (max-width: 768px) {
  .key-value-row {
    flex-direction: column;
    gap: 8px;
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
  
  .event-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 4px;
  }
  
  .event-meta {
    flex-direction: column;
    gap: 8px;
  }
}
</style>
