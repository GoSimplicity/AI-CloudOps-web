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
          <div class="card-number">{{ Array.isArray(daemonsets) ? daemonsets.length : 0 }}</div>
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
          :options="clusterOptions"
          :field-names="{ label: 'name', value: 'id' }"
          show-search
          :filter-option="false"
        >
          <template #suffixIcon><ClusterOutlined /></template>
        </a-select>
        
        <a-select
          v-model:value="selectedNamespace"
          placeholder="选择命名空间"
          class="env-filter namespace-selector"
          :loading="namespacesLoading"
          @change="handleNamespaceChange"
        >
          <template #suffixIcon><PartitionOutlined /></template>
          <a-select-option 
            v-for="(ns, index) in (Array.isArray(namespaces) ? namespaces : [])" 
            :key="ns?.name || ns || `namespace-${index}`" 
            :value="ns?.name || ns"
            v-show="ns !== undefined && ns !== null && (typeof ns === 'string' ? ns !== '' : ns?.name !== '')"
          >
            <span class="namespace-option">
              <AppstoreOutlined />
              {{ ns?.name || ns || 'Unknown' }}
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
          <a-select-option value="Updating">更新中</a-select-option>
          <a-select-option value="Error">异常</a-select-option>
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
              :text="formatStatus(record.status)"
              class="status-badge"
            />
          </template>

          <!-- 创建时间列 -->
          <template v-else-if="column.key === 'createdAt'">
            <div class="timestamp">
              <ClockCircleOutlined />
              <a-tooltip :title="formatDateTime(record.created_at)">
                <span>{{ formatDate(record.created_at) }}</span>
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
                    <!-- DaemonSet不支持暂停/恢复操作 -->
                    <a-menu-item key="history" @click="viewHistory(record)">
                      <HistoryOutlined />
                      版本历史
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
    </div>

    <!-- 创建DaemonSet模态框 -->
    <a-modal
      v-model:open="isCreateModalVisible"
      title="创建DaemonSet"
      :footer="null"
      class="cluster-modal create-daemonset-modal"
      width="900px"
      :maskClosable="false"
    >
      <div class="create-content">
        <a-alert class="modal-alert" type="info" show-icon>
          <template #message>创建新的DaemonSet</template>
          <template #description>DaemonSet确保在每个节点上运行Pod的副本</template>
        </a-alert>

        <!-- 创建模式切换 -->
        <div class="create-mode-switcher">
          <a-radio-group v-model:value="createMode" size="large">
            <a-radio-button value="visual">
              <EditOutlined />
              可视化创建
            </a-radio-button>
            <a-radio-button value="yaml">
              <CodeOutlined />
              YAML创建
            </a-radio-button>
          </a-radio-group>
        </div>

        <div class="create-content-wrapper">
          <!-- 可视化创建模式 -->
          <div class="visual-create-content" v-show="createMode === 'visual'">
            <a-form :model="createForm" layout="vertical" class="create-form">
              <!-- 基本信息 -->
              <div class="form-section">
                <div class="section-title">基本信息</div>
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
                      name="images[0]"
                      :rules="[{ required: true, message: '请输入容器镜像' }]"
                    >
                      <a-input
                        v-model:value="createForm.images[0]"
                        placeholder="例如: nginx:latest"
                        class="form-input"
                      />
                    </a-form-item>
                  </a-col>
                </a-row>
              </div>

              <!-- 容器配置 -->
              <div class="form-section">
                <div class="section-title">容器配置</div>
                <div v-for="(container, containerIndex) in createForm.spec.template.spec.containers" :key="containerIndex" class="container-item">
                  <div class="container-header">
                    <span class="container-title">容器 {{ containerIndex + 1 }}: {{ container.name || '未命名' }}</span>
                  </div>

                  <a-row :gutter="16">
                    <a-col :span="8">
                      <a-form-item label="容器名称" required>
                        <a-input
                          v-model:value="container.name"
                          placeholder="请输入容器名称"
                        />
                      </a-form-item>
                    </a-col>
                    <a-col :span="8">
                      <a-form-item label="镜像地址" required>
                        <a-input
                          v-model:value="container.image"
                          placeholder="例如: nginx:latest"
                          @input="updateImages"
                        />
                      </a-form-item>
                    </a-col>
                    <a-col :span="8">
                      <a-form-item label="镜像拉取策略">
                        <a-select
                          v-model:value="container.imagePullPolicy"
                          placeholder="选择拉取策略"
                        >
                          <a-select-option value="Always">Always - 总是拉取</a-select-option>
                          <a-select-option value="IfNotPresent">IfNotPresent - 本地不存在时拉取</a-select-option>
                          <a-select-option value="Never">Never - 从不拉取</a-select-option>
                        </a-select>
                      </a-form-item>
                    </a-col>
                  </a-row>

                  <!-- 端口配置 -->
                  <div class="sub-section">
                    <div class="sub-section-title">
                      端口配置
                      <a-button type="dashed" size="small" @click="addCreatePort(containerIndex)">
                        <template #icon><PlusOutlined /></template>
                        添加端口
                      </a-button>
                    </div>
                    <div v-if="container.ports && container.ports.length > 0" class="port-list">
                      <div v-for="(port, portIndex) in container.ports" :key="portIndex" class="port-item">
                        <a-row :gutter="8">
                          <a-col :span="6">
                            <a-input
                              v-model:value="port.name"
                              placeholder="端口名称 (如: http)"
                              :status="!isValidPortName(port.name) && port.name ? 'error' : ''"
                            />
                            <div v-if="!isValidPortName(port.name) && port.name" class="ant-form-item-explain ant-form-item-explain-error">
                              <div role="alert">端口名称必须包含字母且符合DNS标准</div>
                            </div>
                          </a-col>
                          <a-col :span="6">
                            <a-input-number
                              v-model:value="port.containerPort"
                              placeholder="容器端口"
                              :min="1"
                              :max="65535"
                              style="width: 100%"
                            />
                          </a-col>
                          <a-col :span="6">
                            <a-select
                              v-model:value="port.protocol"
                              placeholder="协议"
                            >
                              <a-select-option value="TCP">TCP</a-select-option>
                              <a-select-option value="UDP">UDP</a-select-option>
                            </a-select>
                          </a-col>
                          <a-col :span="6">
                            <a-button
                              type="primary"
                              danger
                              ghost
                              size="small"
                              @click="removeCreatePort(containerIndex, portIndex)"
                            >
                              删除
                            </a-button>
                          </a-col>
                        </a-row>
                      </div>
                    </div>
                  </div>

                  <!-- 环境变量 -->
                  <div class="sub-section">
                    <div class="sub-section-title">
                      环境变量
                      <a-button type="dashed" size="small" @click="addCreateEnv(containerIndex)">
                        <template #icon><PlusOutlined /></template>
                        添加环境变量
                      </a-button>
                    </div>
                    <div v-if="container.env && container.env.length > 0" class="env-list">
                      <div v-for="(env, envIndex) in container.env" :key="envIndex" class="env-item">
                        <a-row :gutter="8">
                          <a-col :span="8">
                            <a-input
                              v-model:value="env.name"
                              placeholder="变量名"
                            />
                          </a-col>
                          <a-col :span="10">
                            <a-input
                              v-model:value="env.value"
                              placeholder="变量值"
                            />
                          </a-col>
                          <a-col :span="6">
                            <a-button
                              type="primary"
                              danger
                              ghost
                              size="small"
                              @click="removeCreateEnv(containerIndex, envIndex)"
                            >
                              删除
                            </a-button>
                          </a-col>
                        </a-row>
                      </div>
                    </div>
                  </div>

                  <!-- 资源配置 -->
                  <div class="sub-section" v-if="container.resources && container.resources.requests && container.resources.limits">
                    <div class="sub-section-title">资源配置</div>
                    <a-row :gutter="16">
                      <a-col :span="6">
                        <a-form-item label="CPU请求">
                          <a-input
                            v-model:value="container.resources.requests.cpu"
                            placeholder="如: 100m"
                          />
                        </a-form-item>
                      </a-col>
                      <a-col :span="6">
                        <a-form-item label="内存请求">
                          <a-input
                            v-model:value="container.resources.requests.memory"
                            placeholder="如: 128Mi"
                          />
                        </a-form-item>
                      </a-col>
                      <a-col :span="6">
                        <a-form-item label="CPU限制">
                          <a-input
                            v-model:value="container.resources.limits.cpu"
                            placeholder="如: 500m"
                          />
                        </a-form-item>
                      </a-col>
                      <a-col :span="6">
                        <a-form-item label="内存限制">
                          <a-input
                            v-model:value="container.resources.limits.memory"
                            placeholder="如: 512Mi"
                          />
                        </a-form-item>
                      </a-col>
                    </a-row>
                  </div>
                </div>
              </div>

              <!-- 标签配置 -->
              <div class="form-section">
                <div class="section-title">标签和注解 (可选)</div>
                <a-row :gutter="24">
                  <a-col :span="12">
                    <a-form-item label="标签">
                      <div v-for="(_, key) in createForm.labels" :key="key" class="label-item">
                        <a-row :gutter="8" align="middle">
                          <a-col :span="10">
                            <a-input :value="key" placeholder="键" readonly />
                          </a-col>
                          <a-col :span="10">
                            <a-input v-model:value="createForm.labels[key]" placeholder="值" />
                          </a-col>
                          <a-col :span="4">
                            <a-button type="primary" danger ghost size="small" @click="delete createForm.labels[key]">
                              删除
                            </a-button>
                          </a-col>
                        </a-row>
                      </div>
                      <a-button type="dashed" @click="addCreateLabel" style="width: 100%; margin-top: 8px">
                        <template #icon><PlusOutlined /></template>
                        添加标签
                      </a-button>
                    </a-form-item>
                  </a-col>

                  <a-col :span="12">
                    <a-form-item label="注解">
                      <div v-for="(_, key) in createForm.annotations" :key="key" class="label-item">
                        <a-row :gutter="8" align="middle">
                          <a-col :span="10">
                            <a-input :value="key" placeholder="键" readonly />
                          </a-col>
                          <a-col :span="10">
                            <a-input v-model:value="createForm.annotations[key]" placeholder="值" />
                          </a-col>
                          <a-col :span="4">
                            <a-button type="primary" danger ghost size="small" @click="delete createForm.annotations[key]">
                              删除
                            </a-button>
                          </a-col>
                        </a-row>
                      </div>
                      <a-button type="dashed" @click="addCreateAnnotation" style="width: 100%; margin-top: 8px">
                        <template #icon><PlusOutlined /></template>
                        添加注解
                      </a-button>
                    </a-form-item>
                  </a-col>
                </a-row>
              </div>
            </a-form>
          </div>

          <!-- YAML创建模式 -->
          <div class="yaml-create-content" v-show="createMode === 'yaml'">
            <div class="yaml-actions">
              <a-space>
                <a-button type="primary" ghost @click="formatCreateYaml" :loading="createYamlFormatting">
                  <template #icon><FormatPainterOutlined /></template>
                  格式化YAML
                </a-button>
                <a-button @click="loadDefaultYaml">
                  <template #icon><ReloadOutlined /></template>
                  加载模板
                </a-button>
                <a-button @click="validateCreateYaml">
                  <template #icon><ExclamationCircleOutlined /></template>
                  验证格式
                </a-button>
              </a-space>
            </div>

            <!-- YAML验证提示 -->
            <div v-if="createYamlValidationError" class="yaml-validation-error">
              <a-alert
                type="error"
                :message="`YAML格式错误: ${createYamlValidationError}`"
                show-icon
                closable
                @close="createYamlValidationError = ''"
              />
            </div>

            <div v-if="createYamlValidationSuccess" class="yaml-validation-success">
              <a-alert
                type="success"
                message="YAML格式验证通过"
                show-icon
                closable
                @close="createYamlValidationSuccess = false"
              />
            </div>

            <div class="yaml-editor-container">
              <a-textarea
                v-model:value="createYamlContent"
                :rows="20"
                placeholder="请输入DaemonSet的YAML配置..."
                class="yaml-textarea"
                :status="createYamlValidationError ? 'error' : ''"
              />
            </div>
          </div>
        </div>

        <!-- 操作按钮 -->
        <div class="create-footer">
          <a-space>
            <a-button @click="handleCreateCancel">
              <template #icon><CloseOutlined /></template>
              取消
            </a-button>
            <a-button type="primary" @click="handleCreateConfirm" :loading="loading">
              <template #icon><SaveOutlined /></template>
              创建 DaemonSet
            </a-button>
          </a-space>
        </div>
      </div>
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

        <a-tabs default-active-key="1" @change="handleTabChange">
          <a-tab-pane key="1" tab="基本信息">
            <div class="details-grid">
              <div class="detail-card">
                <h4><DeploymentUnitOutlined /> 基本信息</h4>
                <div class="detail-item">
                  <div class="detail-label">ID:</div>
                  <div class="detail-value">{{ currentDaemonSet.id }}</div>
                </div>
                <div class="detail-item">
                  <div class="detail-label">名称:</div>
                  <div class="detail-value">{{ currentDaemonSet.name }}</div>
                </div>
                <div class="detail-item">
                  <div class="detail-label">命名空间:</div>
                  <div class="detail-value">{{ currentDaemonSet.namespace }}</div>
                </div>
                <div class="detail-item">
                  <div class="detail-label">UID:</div>
                  <div class="detail-value">
                    <a-typography-text copyable style="font-size: 12px;">{{ currentDaemonSet.uid }}</a-typography-text>
                  </div>
                </div>
                <div class="detail-item">
                  <div class="detail-label">状态:</div>
                  <div class="detail-value">
                    <a-badge 
                      :status="getStatusBadgeType(currentDaemonSet.status)" 
                      :text="formatStatus(currentDaemonSet.status)"
                    />
                  </div>
                </div>
                <div class="detail-item">
                  <div class="detail-label">创建时间:</div>
                  <div class="detail-value">{{ formatDateTime(currentDaemonSet.created_at) }}</div>
                </div>
                <div class="detail-item">
                  <div class="detail-label">更新时间:</div>
                  <div class="detail-value">{{ formatDateTime(currentDaemonSet.updated_at) }}</div>
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
                  <div class="detail-value">{{ currentDaemonSet.number_unavailable || 0 }}</div>
                </div>
                <div class="detail-item">
                  <div class="detail-label">更新调度数:</div>
                  <div class="detail-value">{{ currentDaemonSet.updated_number_scheduled || 0 }}</div>
                </div>
                <div class="detail-item">
                  <div class="detail-label">错误调度数:</div>
                  <div class="detail-value">{{ currentDaemonSet.number_misscheduled || 0 }}</div>
                </div>
              </div>

              <div class="detail-card">
                <h4><DatabaseOutlined /> 配置信息</h4>
                <div class="detail-item">
                  <div class="detail-label">更新策略:</div>
                  <div class="detail-value">{{ currentDaemonSet.update_strategy || '未设置' }}</div>
                </div>
                <div class="detail-item">
                  <div class="detail-label">历史版本限制:</div>
                  <div class="detail-value">{{ currentDaemonSet.revision_history_limit || '默认' }}</div>
                </div>
                <div class="detail-item">
                  <div class="detail-label">集群ID:</div>
                  <div class="detail-value">{{ currentDaemonSet.cluster_id }}</div>
                </div>
              </div>
            </div>
          </a-tab-pane>

          <a-tab-pane key="6" tab="条件状态">
            <div class="conditions-container">
              <div class="conditions-header">
                <a-button @click="loadDaemonSetConditions" type="primary" ghost size="small">
                  <template #icon><ReloadOutlined /></template>
                  刷新条件状态
                </a-button>
              </div>
              <a-empty v-if="!currentDaemonSet.conditions?.length" description="暂无条件信息" />
              <div v-else class="conditions-list">
                <div 
                  v-for="(condition, index) in currentDaemonSet.conditions" 
                  :key="index" 
                  class="condition-card"
                  :class="{
                    'condition-success': condition.status === 'True',
                    'condition-error': condition.status === 'False',
                    'condition-unknown': condition.status === 'Unknown'
                  }"
                >
                  <div class="condition-header">
                    <div class="condition-type">
                      <a-badge 
                        :status="condition.status === 'True' ? 'success' : condition.status === 'False' ? 'error' : 'default'"
                        :text="condition.type"
                      />
                    </div>
                    <div class="condition-status">{{ condition.status }}</div>
                  </div>
                  <div class="condition-body">
                    <div class="condition-reason" v-if="condition.reason">
                      <strong>原因:</strong> {{ condition.reason }}
                    </div>
                    <div class="condition-message" v-if="condition.message">
                      <strong>消息:</strong> {{ condition.message }}
                    </div>
                    <div class="condition-times">
                      <div v-if="condition.last_update_time">
                        <strong>最后更新:</strong> {{ formatDateTime(condition.last_update_time) }}
                      </div>
                      <div v-if="condition.last_transition_time">
                        <strong>最后转换:</strong> {{ formatDateTime(condition.last_transition_time) }}
                      </div>
                    </div>
                  </div>
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

          <a-tab-pane key="7" tab="标签与注解">
            <div class="labels-annotations">
              <div class="label-section">
                <h4><TagOutlined /> 标签 (Labels)</h4>
                <div class="label-content">
                  <a-empty v-if="!currentDaemonSet.labels || Object.keys(currentDaemonSet.labels).length === 0" description="暂无标签" />
                  <div v-else class="labels-grid">
                    <div v-for="(value, key) in currentDaemonSet.labels" :key="key" class="label-item">
                      <a-tag color="blue">
                        <strong>{{ key }}:</strong> {{ value }}
                      </a-tag>
                      <a-button type="text" size="small" @click="copyToClipboard(`${key}=${value}`)">
                        <template #icon><CopyOutlined /></template>
                      </a-button>
                    </div>
                  </div>
                </div>
              </div>
              
              <a-divider />
              
              <div class="annotation-section">
                <h4><FileTextOutlined /> 注解 (Annotations)</h4>
                <div class="annotation-content">
                  <a-empty v-if="!currentDaemonSet.annotations || Object.keys(currentDaemonSet.annotations).length === 0" description="暂无注解" />
                  <div v-else class="annotations-list">
                    <div v-for="(value, key) in currentDaemonSet.annotations" :key="key" class="annotation-item">
                      <div class="annotation-key">{{ key }}</div>
                      <div class="annotation-value">
                        <a-typography-text copyable>{{ value }}</a-typography-text>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              
              <a-divider />
              
              <div class="selector-section">
                <h4><FilterOutlined /> 选择器 (Selector)</h4>
                <div class="selector-content">
                  <a-empty v-if="!currentDaemonSet.selector || Object.keys(currentDaemonSet.selector).length === 0" description="暂无选择器" />
                  <div v-else class="selectors-grid">
                    <div v-for="(value, key) in currentDaemonSet.selector" :key="key" class="selector-item">
                      <a-tag color="purple">
                        <strong>{{ key }}:</strong> {{ value }}
                      </a-tag>
                      <a-button type="text" size="small" @click="copyToClipboard(`${key}=${value}`)">
                        <template #icon><CopyOutlined /></template>
                      </a-button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </a-tab-pane>

          <a-tab-pane key="3" tab="Pod列表">
            <div class="pods-container">
              <div class="pods-header">
                <a-button @click="loadDaemonSetPods" type="primary" ghost size="small" :loading="podsLoading">
                  <template #icon><ReloadOutlined /></template>
                  刷新Pod列表
                </a-button>
              </div>
              <a-spin :spinning="podsLoading">
                <a-table
                  :columns="[
                    { title: 'Pod名称', dataIndex: 'name', key: 'name', width: '30%' },
                    { title: '状态', dataIndex: 'status', key: 'status', width: '15%' },
                    { title: '节点', dataIndex: 'node_name', key: 'node_name', width: '25%' },
                    { title: '创建时间', dataIndex: 'created_at', key: 'created_at', width: '30%' }
                  ]"
                  :data-source="daemonsetPods"
                  :pagination="false"
                  size="small"
                  row-key="name"
                >
                  <template #bodyCell="{ column, record }">
                    <template v-if="column.key === 'name'">
                      <div class="pod-name">
                        <NodeIndexOutlined style="color: #1677ff; margin-right: 8px;" />
                        <span>{{ record.name }}</span>
                      </div>
                    </template>
                    <template v-else-if="column.key === 'status'">
                      <a-badge 
                        :status="getPodStatusBadgeType(record.status)" 
                        :text="record.status"
                      />
                    </template>
                    <template v-else-if="column.key === 'node_name'">
                      <div class="pod-node">
                        <CloudServerOutlined style="color: #52c41a; margin-right: 8px;" />
                        <span>{{ record.node_name || '-' }}</span>
                      </div>
                    </template>
                    <template v-else-if="column.key === 'created_at'">
                      <a-tooltip :title="formatDateTime(record.created_at)">
                        <span>{{ formatDate(record.created_at) }}</span>
                      </a-tooltip>
                    </template>
                  </template>
                </a-table>
                <a-empty v-if="!daemonsetPods.length && !podsLoading" description="暂无Pod数据">
                  <template #description>
                    <span>当前DaemonSet没有运行的Pod实例</span>
                  </template>
                  <a-button @click="loadDaemonSetPods" type="primary" ghost>
                    <template #icon><ReloadOutlined /></template>
                    刷新Pod列表
                  </a-button>
                </a-empty>
              </a-spin>
            </div>
          </a-tab-pane>

          <a-tab-pane key="4" tab="指标监控">
            <div class="metrics-container">
              <div class="metrics-header">
                <a-button @click="loadDaemonSetMetrics" type="primary" ghost size="small" :loading="metricsLoading">
                  <template #icon><ReloadOutlined /></template>
                  刷新指标数据
                </a-button>
              </div>
              <a-spin :spinning="metricsLoading">
                <div v-if="daemonsetMetrics && daemonsetMetrics.metrics_available" class="metrics-content">
                  <div class="metrics-grid">
                    <div class="metric-card">
                      <h4><DashboardOutlined /> CPU 使用率</h4>
                      <div class="metric-value">{{ (daemonsetMetrics.cpu_usage || 0).toFixed(2) }}%</div>
                      <a-progress 
                        :percent="Math.min(daemonsetMetrics.cpu_usage || 0, 100)" 
                        :status="daemonsetMetrics.cpu_usage > 80 ? 'exception' : 'normal'"
                        size="small"
                      />
                    </div>
                    
                    <div class="metric-card">
                      <h4><DatabaseOutlined /> 内存使用率</h4>
                      <div class="metric-value">{{ (daemonsetMetrics.memory_usage || 0).toFixed(2) }}%</div>
                      <a-progress 
                        :percent="Math.min(daemonsetMetrics.memory_usage || 0, 100)" 
                        :status="daemonsetMetrics.memory_usage > 80 ? 'exception' : 'normal'"
                        size="small"
                      />
                    </div>
                    
                    <div class="metric-card">
                      <h4><GlobalOutlined /> 网络流量</h4>
                      <div class="metric-detail">
                        <div>入流量: {{ (daemonsetMetrics.network_in || 0).toFixed(2) }} MB/s</div>
                        <div>出流量: {{ (daemonsetMetrics.network_out || 0).toFixed(2) }} MB/s</div>
                      </div>
                    </div>
                    
                    <div class="metric-card">
                      <h4><HddOutlined /> 磁盘使用率</h4>
                      <div class="metric-value">{{ (daemonsetMetrics.disk_usage || 0).toFixed(2) }}%</div>
                      <a-progress 
                        :percent="Math.min(daemonsetMetrics.disk_usage || 0, 100)" 
                        :status="daemonsetMetrics.disk_usage > 90 ? 'exception' : 'normal'"
                        size="small"
                      />
                    </div>
                    
                    <div class="metric-card">
                      <h4><CheckCircleOutlined /> 节点状态</h4>
                      <div class="metric-detail">
                        <div>就绪节点: {{ daemonsetMetrics.nodes_ready || 0 }}</div>
                        <div>总节点: {{ daemonsetMetrics.nodes_total || 0 }}</div>
                        <div>可用性: {{ (daemonsetMetrics.availability_rate || 0).toFixed(2) }}%</div>
                      </div>
                    </div>
                    
                    <div class="metric-card">
                      <h4><ReloadOutlined /> 重启次数</h4>
                      <div class="metric-value">{{ daemonsetMetrics.restart_count || 0 }}</div>
                    </div>
                  </div>
                  
                  <div class="metrics-info" v-if="daemonsetMetrics.metrics_note">
                    <a-alert :message="daemonsetMetrics.metrics_note" type="info" show-icon />
                  </div>
                  
                  <div class="metrics-footer">
                    <small>最后更新: {{ formatDateTime(daemonsetMetrics.last_updated) }}</small>
                  </div>
                </div>
                <!-- 当有指标数据但不可用时显示说明 -->
                <div v-else-if="daemonsetMetrics && !daemonsetMetrics.metrics_available" class="metrics-unavailable">
                  <a-result
                    status="info"
                    title="指标数据不可用"
                    :sub-title="daemonsetMetrics.metrics_note || '请确保集群已安装并配置了metrics-server组件'"
                  >
                    <template #extra>
                      <a-button @click="loadDaemonSetMetrics" :loading="metricsLoading">
                        <template #icon><ReloadOutlined /></template>
                        重试
                      </a-button>
                    </template>
                  </a-result>
                </div>
                
                <!-- 完全没有指标数据时显示 -->
                <a-empty v-else-if="!metricsLoading && !daemonsetMetrics" description="暂无指标数据">
                  <template #description>
                    <span>当前集群可能未安装metrics-server</span>
                  </template>
                  <a-button @click="loadDaemonSetMetrics" type="primary" ghost>
                    <template #icon><ReloadOutlined /></template>
                    重新加载
                  </a-button>
                </a-empty>
              </a-spin>
            </div>
          </a-tab-pane>

          <a-tab-pane key="5" tab="事件">
            <div class="events-container">
              <div class="events-header">
                <a-button @click="loadDaemonSetEvents" type="primary" ghost size="small" :loading="eventsLoading">
                  <template #icon><ReloadOutlined /></template>
                  刷新事件列表
                </a-button>
              </div>
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
                        <span class="event-time">{{ formatDateTime(event.last_time || event.first_time) }}</span>
                      </div>
                      <div class="event-message">{{ event.message }}</div>
                      <div class="event-meta">
                        <span><strong>类型:</strong> {{ event.type }}</span>
                        <span><strong>来源:</strong> {{ event.source }}</span>
                        <span><strong>次数:</strong> {{ event.count }}</span>
                        <span v-if="event.first_time"><strong>首次发生:</strong> {{ formatDateTime(event.first_time) }}</span>
                      </div>
                    </div>
                  </a-timeline-item>
                </a-timeline>
                <a-empty v-if="!daemonsetEvents.length && !eventsLoading" description="暂无事件">
                  <template #description>
                    <span>当前DaemonSet没有事件记录</span>
                  </template>
                  <a-button @click="loadDaemonSetEvents" type="primary" ghost>
                    <template #icon><ReloadOutlined /></template>
                    刷新事件列表
                  </a-button>
                </a-empty>
              </a-spin>
            </div>
          </a-tab-pane>
        </a-tabs>
      </div>
    </a-modal>

    <!-- YAML查看/编辑模态框 -->
    <a-modal
      v-model:open="yamlModalVisible"
      :title="isEditMode ? 'DaemonSet YAML 编辑' : 'DaemonSet YAML 配置'"
      width="900px"
      class="cluster-modal yaml-modal"
      :footer="null"
    >
      <a-alert v-if="currentDaemonSet" class="modal-alert" type="info" show-icon>
        <template #message>
          <span>{{ currentDaemonSet.name }} ({{ currentDaemonSet.namespace }})</span>
        </template>
        <template #description>
          <div>状态: {{ formatStatus(currentDaemonSet.status) }} | Pod: {{ currentDaemonSet.number_ready || 0 }}/{{ currentDaemonSet.desired_number_scheduled || 0 }} | 创建于: {{ formatDate(currentDaemonSet.created_at || '') }}</div>
        </template>
      </a-alert>
      
      <div class="yaml-actions">
        <a-space>
          <a-button v-if="!isEditMode" type="primary" size="small" @click="enterEditMode">
            <template #icon><EditOutlined /></template>
            编辑
          </a-button>
          <a-button v-if="isEditMode" type="primary" size="small" @click="submitEdit" :loading="loading">
            <template #icon><SaveOutlined /></template>
            保存
          </a-button>
          <a-button v-if="isEditMode" size="small" @click="cancelEdit">
            <template #icon><CloseOutlined /></template>
            取消
          </a-button>
          <a-button type="primary" size="small" @click="copyYamlToClipboard">
            <template #icon><CopyOutlined /></template>
            复制
          </a-button>
        </a-space>
      </div>
      
      <div v-if="!isEditMode" class="yaml-viewer">
        <pre class="yaml-editor">{{ currentYaml }}</pre>
      </div>
      
      <div v-if="isEditMode" class="yaml-editor-container">
        <a-textarea
          v-model:value="editedYaml"
          :rows="20"
          class="yaml-textarea"
          placeholder="请输入YAML配置..."
        />
      </div>
    </a-modal>

    <!-- 编辑DaemonSet模态框 -->
    <a-modal
      v-model:open="isEditModalVisible"
      title="编辑DaemonSet"
      width="1200px"
      :footer="null"
      class="cluster-modal edit-modal"
      :maskClosable="false"
      :closable="true"
    >
      <div class="edit-content">
        <a-alert v-if="currentDaemonSet" class="modal-alert" type="info" show-icon>
          <template #message>
            <span>编辑 {{ currentDaemonSet.name }} ({{ currentDaemonSet.namespace }})</span>
          </template>
          <template #description>
            <div>状态: {{ formatStatus(currentDaemonSet.status) }} | Pod: {{ currentDaemonSet.number_ready || 0 }}/{{ currentDaemonSet.desired_number_scheduled || 0 }}</div>
          </template>
        </a-alert>
        
        <!-- 编辑模式切换 -->
        <div class="edit-mode-switcher">
          <a-radio-group v-model:value="editMode" size="large">
            <a-radio-button value="visual">
              <EditOutlined />
              可视化编辑
            </a-radio-button>
            <a-radio-button value="yaml">
              <CodeOutlined />
              YAML编辑
            </a-radio-button>
          </a-radio-group>
        </div>
        
        <div class="edit-content-wrapper">
          <!-- 可视化编辑模式 -->
          <template v-if="editMode === 'visual'">
            <span class="edit-mode-label">
              <EditOutlined />
              可视化编辑
            </span>
          </template>
          
          <div class="visual-edit-content" v-show="editMode === 'visual'">
            <a-form :model="editForm" layout="vertical">
              <!-- 基本信息 -->
              <div class="form-section">
                <div class="section-title">基本信息</div>
                <a-row :gutter="16">
                  <a-col :span="8">
                    <a-form-item label="DaemonSet名称">
                      <a-input 
                        v-model:value="editForm.name" 
                        disabled
                        placeholder="DaemonSet名称"
                      />
                    </a-form-item>
                  </a-col>
                  <a-col :span="8">
                    <a-form-item label="命名空间">
                      <a-input 
                        v-model:value="editForm.namespace" 
                        disabled
                        placeholder="命名空间"
                      />
                    </a-form-item>
                  </a-col>
                  <a-col :span="8">
                    <a-form-item label="历史版本限制">
                      <a-input-number 
                        v-model:value="editForm.revision_history_limit" 
                        :min="1" 
                        :max="100" 
                        style="width: 100%" 
                        placeholder="历史版本限制"
                      />
                    </a-form-item>
                  </a-col>
                </a-row>
              </div>

              <!-- 容器配置 -->
              <div class="form-section">
                <div class="section-title">容器配置</div>
                <div class="container-list">
                  <div v-for="(container, index) in editForm.containers" :key="index" class="container-item">
                    <div class="container-header">
                      <span class="container-title">容器 {{ index + 1 }}: {{ container.name || '未命名' }}</span>
                      <a-button 
                        v-if="editForm.containers.length > 1" 
                        type="primary" 
                        danger 
                        ghost 
                        size="small" 
                        @click="removeContainer(index)"
                      >
                        <template #icon><DeleteOutlined /></template>
                        删除容器
                      </a-button>
                    </div>
                    
                    <a-row :gutter="16">
                      <a-col :span="8">
                        <a-form-item label="容器名称" required>
                          <a-input 
                            v-model:value="container.name" 
                            placeholder="请输入容器名称"
                          />
                        </a-form-item>
                      </a-col>
                      <a-col :span="8">
                        <a-form-item label="镜像地址" required>
                          <a-input 
                            v-model:value="container.image" 
                            placeholder="例如: nginx:latest"
                          />
                        </a-form-item>
                      </a-col>
                      <a-col :span="8">
                        <a-form-item label="镜像拉取策略">
                          <a-select 
                            v-model:value="container.image_pull_policy" 
                            placeholder="选择拉取策略"
                          >
                            <a-select-option value="Always">Always - 总是拉取</a-select-option>
                            <a-select-option value="IfNotPresent">IfNotPresent - 本地不存在时拉取</a-select-option>
                            <a-select-option value="Never">Never - 从不拉取</a-select-option>
                          </a-select>
                        </a-form-item>
                      </a-col>
                    </a-row>
                    
                    <!-- 端口配置 -->
                    <div class="sub-section">
                      <div class="sub-section-title">
                        端口配置
                        <a-button type="dashed" size="small" @click="addPort(index)">
                          <template #icon><PlusOutlined /></template>
                          添加端口
                        </a-button>
                      </div>
                      <div v-if="container.ports && container.ports.length > 0" class="port-list">
                        <div v-for="(port, portIndex) in container.ports" :key="portIndex" class="port-item">
                          <a-row :gutter="8">
                            <a-col :span="6">
                              <a-input
                                v-model:value="port.name"
                                placeholder="端口名称"
                              />
                            </a-col>
                            <a-col :span="6">
                              <a-input-number
                                v-model:value="port.container_port"
                                placeholder="容器端口"
                                :min="1"
                                :max="65535"
                                style="width: 100%"
                              />
                            </a-col>
                            <a-col :span="6">
                              <a-select
                                v-model:value="port.protocol"
                                placeholder="协议"
                              >
                                <a-select-option value="TCP">TCP</a-select-option>
                                <a-select-option value="UDP">UDP</a-select-option>
                              </a-select>
                            </a-col>
                            <a-col :span="6">
                              <a-button
                                type="primary"
                                danger
                                ghost
                                size="small"
                                @click="removePort(index, portIndex)"
                              >
                                删除
                              </a-button>
                            </a-col>
                          </a-row>
                        </div>
                      </div>
                    </div>
                    
                    <!-- 环境变量 -->
                    <div class="sub-section">
                      <div class="sub-section-title">
                        环境变量
                        <a-button type="dashed" size="small" @click="addEnvVar(index)">
                          <template #icon><PlusOutlined /></template>
                          添加环境变量
                        </a-button>
                      </div>
                      <div v-if="container.env_vars && container.env_vars.length > 0" class="env-list">
                        <div v-for="(env, envIndex) in container.env_vars" :key="envIndex" class="env-item">
                          <a-row :gutter="8">
                            <a-col :span="8">
                              <a-input
                                v-model:value="env.name"
                                placeholder="变量名"
                              />
                            </a-col>
                            <a-col :span="10">
                              <a-input
                                v-model:value="env.value"
                                placeholder="变量值"
                              />
                            </a-col>
                            <a-col :span="6">
                              <a-button
                                type="primary"
                                danger
                                ghost
                                size="small"
                                @click="removeEnvVar(index, envIndex)"
                              >
                                删除
                              </a-button>
                            </a-col>
                          </a-row>
                        </div>
                      </div>
                    </div>
                    
                    <!-- 资源配置 -->
                    <div class="sub-section">
                      <div class="sub-section-title">资源配置</div>
                      <a-row :gutter="16">
                        <a-col :span="6">
                          <a-form-item label="CPU请求">
                            <a-input 
                              v-model:value="container.resources.requests.cpu" 
                              placeholder="如: 100m"
                            />
                          </a-form-item>
                        </a-col>
                        <a-col :span="6">
                          <a-form-item label="内存请求">
                            <a-input 
                              v-model:value="container.resources.requests.memory" 
                              placeholder="如: 128Mi"
                            />
                          </a-form-item>
                        </a-col>
                        <a-col :span="6">
                          <a-form-item label="CPU限制">
                            <a-input 
                              v-model:value="container.resources.limits.cpu" 
                              placeholder="如: 500m"
                            />
                          </a-form-item>
                        </a-col>
                        <a-col :span="6">
                          <a-form-item label="内存限制">
                            <a-input 
                              v-model:value="container.resources.limits.memory" 
                              placeholder="如: 512Mi"
                            />
                          </a-form-item>
                        </a-col>
                      </a-row>
                    </div>
                  </div>
                  
                  <a-button 
                    type="dashed" 
                    @click="addContainer" 
                    style="width: 100%; margin-top: 16px"
                  >
                    <template #icon><PlusOutlined /></template>
                    添加容器
                  </a-button>
                </div>
              </div>

              <!-- 部署策略 -->
              <div class="form-section">
                <div class="section-title">部署策略</div>
                <a-row :gutter="16">
                  <a-col :span="8">
                    <a-form-item label="更新策略">
                      <a-select 
                        v-model:value="editForm.update_strategy" 
                        placeholder="选择更新策略"
                      >
                        <a-select-option value="RollingUpdate">RollingUpdate - 滚动更新</a-select-option>
                        <a-select-option value="OnDelete">OnDelete - 删除时更新</a-select-option>
                      </a-select>
                    </a-form-item>
                  </a-col>
                  <a-col :span="8">
                    <a-form-item label="最小就绪时间">
                      <a-input-number 
                        v-model:value="editForm.min_ready_seconds" 
                        :min="0"
                        style="width: 100%" 
                        placeholder="秒"
                      />
                    </a-form-item>
                  </a-col>
                </a-row>
              </div>

              <!-- 标签和注解 -->
              <div class="form-section">
                <div class="section-title">标签和注解</div>
                <a-row :gutter="24">
                  <a-col :span="12">
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
                      <a-button type="dashed" @click="addLabel" style="width: 100%; margin-top: 8px">
                        <template #icon><PlusOutlined /></template>
                        添加标签
                      </a-button>
                    </a-form-item>
                  </a-col>
                  
                  <a-col :span="12">
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
                      <a-button type="dashed" @click="addAnnotation" style="width: 100%; margin-top: 8px">
                        <template #icon><PlusOutlined /></template>
                        添加注解
                      </a-button>
                    </a-form-item>
                  </a-col>
                </a-row>
              </div>
            </a-form>
          </div>
          
          <!-- YAML编辑模式 -->
          <div class="yaml-edit-content" v-show="editMode === 'yaml'">
            <template v-if="editMode === 'yaml'">
              <span class="edit-mode-label">
                <CodeOutlined />
                YAML编辑
              </span>
            </template>
            
            <div class="yaml-actions">
              <a-space>
                <a-button type="primary" ghost @click="formatYaml" :loading="yamlFormatting">
                  <template #icon><FormatPainterOutlined /></template>
                  格式化YAML
                </a-button>
                <a-button @click="loadCurrentYaml" :loading="loadingYaml">
                  <template #icon><ReloadOutlined /></template>
                  重新加载
                </a-button>
                <a-button @click="validateYaml">
                  <template #icon><ExclamationCircleOutlined /></template>
                  验证格式
                </a-button>
              </a-space>
            </div>
            
            <!-- YAML验证提示 -->
            <div v-if="yamlValidationError" class="yaml-validation-error">
              <a-alert 
                type="error" 
                :message="`YAML格式错误: ${yamlValidationError}`" 
                show-icon 
                closable 
                @close="yamlValidationError = ''"
              />
            </div>
            
            <div v-if="yamlValidationSuccess" class="yaml-validation-success">
              <a-alert 
                type="success" 
                message="YAML格式验证通过" 
                show-icon 
                closable 
                @close="yamlValidationSuccess = false"
              />
            </div>
            
            <div class="yaml-editor-container">
              <a-textarea
                v-model:value="editForm.yaml_content"
                :rows="20"
                placeholder="YAML内容将在这里显示..."
                class="yaml-textarea"
                :status="yamlValidationError ? 'error' : ''"
              />
            </div>
          </div>
        </div>
        
        <!-- 操作按钮 -->
        <div class="edit-footer">
          <a-space>
            <a-button @click="isEditModalVisible = false">
              <template #icon><CloseOutlined /></template>
              取消
            </a-button>
            <a-button type="primary" @click="submitEditForm" :loading="loading">
              <template #icon><SaveOutlined /></template>
              保存更改
            </a-button>
          </a-space>
        </div>
      </div>
    </a-modal>

    <!-- 历史版本模态框 -->
    <a-modal
      v-model:open="historyModalVisible"
      title="版本历史与回滚"
      width="900px"
      :footer="null"
      class="history-modal"
      :maskClosable="false"
    >
      <div class="history-content">
        <div class="history-header" v-if="currentDaemonSet">
          <div class="history-info">
            <span class="history-title">
              <HistoryOutlined />
              {{ currentDaemonSet.name }} - 版本历史
            </span>
            <span class="history-namespace">
              命名空间: {{ currentDaemonSet.namespace }} | 选择版本进行回滚
            </span>
          </div>
          <div class="history-stats">
            <a-statistic 
              title="版本总数" 
              :value="historyVersions.length" 
              :value-style="{ fontSize: '16px' }"
            />
          </div>
        </div>
        
        <div class="history-instructions">
          <a-alert
            message="版本回滚说明"
            description="您可以查看该DaemonSet的所有历史版本，并选择任意版本进行回滚。回滚操作将会更新DaemonSet配置到选定的版本状态。"
            type="info"
            show-icon
            style="margin-bottom: 16px;"
          />
        </div>
        
        <a-spin :spinning="historyLoading" tip="加载历史版本中...">
          <a-table
            :columns="[
              { 
                title: '版本', 
                dataIndex: 'revision', 
                key: 'revision', 
                width: '15%',
                customRender: ({ text }: { text: string | number }) => `v${text}`
              },
              { 
                title: '变更原因', 
                dataIndex: 'message', 
                key: 'message', 
                width: '40%',
                customRender: ({ text }: { text: string }) => text || '无变更信息'
              },
              { 
                title: '创建时间', 
                dataIndex: 'date', 
                key: 'date', 
                width: '35%',
                customRender: ({ text }: { text: string }) => {
                  if (!text) return '-';
                  try {
                    const date = new Date(text);
                    return date.toLocaleString('zh-CN', {
                      year: 'numeric',
                      month: '2-digit',
                      day: '2-digit',
                      hour: '2-digit',
                      minute: '2-digit',
                      second: '2-digit'
                    });
                  } catch (error) {
                    return text;
                  }
                }
              },
              { title: '操作', key: 'action', width: '10%', align: 'center' }
            ]"
            :data-source="historyVersions"
            :pagination="false"
            row-key="revision"
            size="small"
          >
            <template #bodyCell="{ column, record }">
              <template v-if="column.key === 'action'">
                <a-tooltip :title="record.revision === 1 ? '当前为最新版本，无需回滚' : `回滚到版本 v${record.revision}`">
                  <a-button 
                    type="primary" 
                    ghost 
                    size="small" 
                    @click="rollbackToVersion(record.revision)"
                    :disabled="record.revision === 1"
                  >
                    <template #icon><RollbackOutlined /></template>
                    回滚
                  </a-button>
                </a-tooltip>
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
import { ref, computed, onMounted } from 'vue';
import { message } from 'ant-design-vue';
import {
  getDaemonSetListApi,
  getDaemonSetDetailsApi,
  getDaemonSetYamlApi,
  createDaemonSetApi,
  updateDaemonSetApi,
  deleteDaemonSetApi,
  restartDaemonSetApi,
  getDaemonSetEventsApi,
  getDaemonSetPodsApi,
  getDaemonSetMetricsApi,
  getDaemonSetHistoryApi,
  rollbackDaemonSetApi,
} from '#/api/core/k8s_daemonset';
import type {
  K8sDaemonSet,
  K8sDaemonSetEvent,
  K8sDaemonSetMetrics,
  K8sDaemonSetHistory,
  GetDaemonSetListReq,
} from '#/api/core/k8s_daemonset';
import { getClustersListApi, type K8sCluster } from '#/api/core/k8s_cluster';
import { getNamespacesListApi, type K8sNamespace } from '#/api/core/k8s_namespace';
import { 
  CloudServerOutlined, 
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
  RollbackOutlined,
  SaveOutlined,
  CloseOutlined,
  TagOutlined,
  FileTextOutlined,
  DashboardOutlined,
  GlobalOutlined,
  HddOutlined,
  AppstoreOutlined,
  FormatPainterOutlined,
  ExclamationCircleOutlined,

} from '@ant-design/icons-vue';
import * as yaml from 'js-yaml';

// 状态变量
const loading = ref(false);
const clustersLoading = ref(false);
const namespacesLoading = ref(false);
const daemonsets = ref<K8sDaemonSet[]>([]);
const searchText = ref('');
const statusFilter = ref<string>();
const selectedRows = ref<K8sDaemonSet[]>([]);
const namespaces = ref<K8sNamespace[]>([]);
const selectedNamespace = ref<string>('default');
const isCreateModalVisible = ref(false);
const clusters = ref<K8sCluster[]>([]);
const selectedCluster = ref<number>();
const currentPage = ref(1);
const pageSize = ref(12);
const totalItems = ref(0);



// 表格列配置
const columns = [
  {
    title: 'DaemonSet 名称',
    dataIndex: 'name',
    key: 'name',
    width: '20%',
    sorter: (a: K8sDaemonSet, b: K8sDaemonSet) => a.name.localeCompare(b.name),
  },
  {
    title: '命名空间',
    dataIndex: 'namespace',
    key: 'namespace',
    width: '15%',
    sorter: (a: K8sDaemonSet, b: K8sDaemonSet) => a.namespace.localeCompare(b.namespace),
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
    sorter: (a: K8sDaemonSet, b: K8sDaemonSet) => Number(a.status) - Number(b.status),
  },
  {
    title: '创建时间',
    dataIndex: 'created_at',
    key: 'createdAt',
    width: '15%',
    sorter: (a: K8sDaemonSet, b: K8sDaemonSet) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
  },
  {
    title: '操作',
    key: 'action',
    width: '15%',
    fixed: 'right',
  },
];

// 计算属性
const clusterOptions = computed(() => {
  if (!Array.isArray(clusters.value)) return [];
  return clusters.value.map(cluster => ({
    label: cluster?.name || `集群-${cluster.id}`,
    value: cluster.id,
    id: cluster.id,
    name: cluster?.name || `集群-${cluster.id}`
  }));
});

const filteredDaemonSets = computed(() => {
  if (!Array.isArray(daemonsets.value)) return [];
  
  let result = daemonsets.value;
  
  if (statusFilter.value) {
    result = result.filter(ds => formatStatus(ds.status) === statusFilter.value);
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
  Array.isArray(daemonsets.value) 
    ? daemonsets.value.filter(ds => formatStatus(ds.status) === 'Running').length
    : 0
);

const totalDesiredPods = computed(() => 
  Array.isArray(daemonsets.value) 
    ? daemonsets.value.reduce((total, ds) => total + (ds.desired_number_scheduled || 0), 0)
    : 0
);

const totalReadyPods = computed(() => 
  Array.isArray(daemonsets.value) 
    ? daemonsets.value.reduce((total, ds) => total + (ds.number_ready || 0), 0)
    : 0
);

// 表格选择配置
const rowSelection = {
  onChange: (_: string[], selectedRowsData: K8sDaemonSet[]) => {
    selectedRows.value = selectedRowsData;
  },
  getCheckboxProps: (_: K8sDaemonSet) => ({
    disabled: false,
  }),
};

// 格式化日期
const formatDate = (dateString: string) => {
  if (!dateString || dateString === '0001-01-01T00:00:00Z') return '-';
  const date = new Date(dateString);
  return `${date.getMonth() + 1}月${date.getDate()}日 ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
};

// API 方法
const getClusters = async () => {
  clustersLoading.value = true;
  try {
    console.log('开始获取集群列表...');
    const res = await getClustersListApi();
    console.log('API响应:', res);
    
    // 处理不同的API响应格式
    let clusterItems: K8sCluster[] = [];
    
    if (res) {
      // 标准格式：{ items: [], total: number }
      if (res.items && Array.isArray(res.items)) {
        clusterItems = res.items.filter((item: any) => item && item.id !== null && item.id !== undefined);
      }
      // 直接是数组格式
      else if (Array.isArray(res)) {
        clusterItems = res.filter((item: any) => item && item.id !== null && item.id !== undefined);
      }
      // 包含 data 字段的格式
      else if (res.data) {
        if (Array.isArray(res.data)) {
          clusterItems = res.data.filter((item: any) => item && item.id !== null && item.id !== undefined);
        } else if (res.data.items && Array.isArray(res.data.items)) {
          clusterItems = res.data.items.filter((item: any) => item && item.id !== null && item.id !== undefined);
        }
      }
    }
    
    console.log('处理后的集群数据:', clusterItems);
    clusters.value = clusterItems;
    
    // 如果没有集群数据，清空选中状态
    if (clusters.value.length === 0) {
      selectedCluster.value = undefined;
      selectedNamespace.value = 'default';
      message.warning('暂无可用集群');
      return;
    }
    
    // 如果有集群数据但没有选中任何集群，或者选中的集群不在列表中
    const currentClusterExists = selectedCluster.value && 
      clusters.value.some(cluster => cluster.id === selectedCluster.value);
    
    if (!selectedCluster.value || !currentClusterExists) {
      selectedCluster.value = clusters.value[0]?.id;
      console.log('设置默认集群:', selectedCluster.value);
      
      if (selectedCluster.value) {
        await getNamespaces();
        await getDaemonSets(1, pageSize.value);
      }
    }
  } catch (error: any) {
    console.error('获取集群列表失败:', error);
    message.error(error.message || '获取集群列表失败');
    clusters.value = [];
    selectedCluster.value = undefined;
    selectedNamespace.value = 'default';
  } finally {
    clustersLoading.value = false;
  }
};

const getNamespaces = async () => {
  if (!selectedCluster.value) {
    console.warn('没有选中的集群，无法获取命名空间');
    namespaces.value = [{ cluster_id: 0, name: 'default' }];
    selectedNamespace.value = 'default';
    return;
  }

  namespacesLoading.value = true;
  try {
    console.log('获取命名空间列表，集群ID:', selectedCluster.value);
    const res = await getNamespacesListApi(selectedCluster.value);
    console.log('命名空间API响应:', res);
    
    // 处理不同的API响应格式
    let namespaceItems: K8sNamespace[] = [];
    
    if (res) {
      // 标准格式：{ items: [], total: number }
      if (res.items && Array.isArray(res.items)) {
        namespaceItems = res.items.filter((item: any) => item && (item.name || item));
      }
      // 直接是数组格式
      else if (Array.isArray(res)) {
        namespaceItems = res.filter((item: any) => item && (item.name || item));
      }
      // 包含 data 字段的格式
      else if (res.data) {
        if (Array.isArray(res.data)) {
          namespaceItems = res.data.filter((item: any) => item && (item.name || item));
        } else if (res.data.items && Array.isArray(res.data.items)) {
          namespaceItems = res.data.items.filter((item: any) => item && (item.name || item));
        }
      }
    }
    
    console.log('处理后的命名空间数据:', namespaceItems);
    namespaces.value = namespaceItems;
    
    if (namespaces.value.length > 0) {
      selectedNamespace.value = namespaces.value[0]?.name || 'default';
    } else {
      selectedNamespace.value = 'default';
      message.warning('暂无可用命名空间，使用默认命名空间');
    }
  } catch (error: any) {
    console.error('获取命名空间列表失败:', error);
    message.error(error.message || '获取命名空间列表失败');
    namespaces.value = [{ cluster_id: selectedCluster.value!, name: 'default' }];
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
    const params: GetDaemonSetListReq = {
      cluster_id: selectedCluster.value,
      namespace: selectedNamespace.value,
      page,
      size,
      status: statusFilter.value,
    };
    
    const res = await getDaemonSetListApi(params);
    
    // 处理不同的API响应格式，确保daemonsets.value始终是数组
    let responseItems: K8sDaemonSet[] = [];
    let responseTotal = 0;
    
    if (res) {
      // 新格式：{ code: 0, data: { items: [], total: number }, message: string }
      if (res.code !== undefined && res.data && res.data.items && Array.isArray(res.data.items)) {
        responseItems = res.data.items.filter((item: any) => item && (item.uid || item.name));
        responseTotal = res.data.total || responseItems.length;
      }
      // 标准格式：{ items: [], total: number }
      else if (res.items && Array.isArray(res.items)) {
        responseItems = res.items.filter((item: any) => item && (item.uid || item.name));
        responseTotal = res.total || responseItems.length;
      }
      // 直接是数组格式
      else if (Array.isArray(res)) {
        responseItems = res.filter((item: any) => item && (item.uid || item.name));
        responseTotal = responseItems.length;
      }
      // 包含 data 字段的格式（其他格式）
      else if (res.data) {
        if (Array.isArray(res.data)) {
          responseItems = res.data.filter((item: any) => item && (item.uid || item.name));
          responseTotal = res.total || responseItems.length;
        } else if (res.data.items && Array.isArray(res.data.items)) {
          responseItems = res.data.items.filter((item: any) => item && (item.uid || item.name));
          responseTotal = res.data.total || responseItems.length;
        }
      }
    }
    
    daemonsets.value = responseItems;
    totalItems.value = responseTotal;
    currentPage.value = page;
    selectedRows.value = [];
  } catch (error: any) {
    message.error(error.message || '获取DaemonSet列表失败');
    daemonsets.value = [];
    totalItems.value = 0;
  } finally {
    loading.value = false;
  }
};

// 刷新数据
const refreshData = async () => {
  console.log('开始刷新所有数据...');
  try {
    // 重新获取集群列表
    await getClusters();
    
    // 如果有选中的集群，刷新相关数据
    if (selectedCluster.value) {
      await getNamespaces();
      await getDaemonSets(currentPage.value, pageSize.value);
    }
  } catch (error) {
    console.error('刷新数据失败:', error);
    message.error('刷新数据失败');
  }
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

// 批量操作已移除（当前API未提供批量接口）

// 切换命名空间
const handleNamespaceChange = () => {
  currentPage.value = 1;
  getDaemonSets(1, pageSize.value);
};

// 切换集群
const handleClusterChange = (clusterId: number) => {
  console.log('集群切换:', clusterId);
  console.log('当前clusters数据:', clusters.value);
  console.log('clusterOptions:', clusterOptions.value);
  selectedCluster.value = clusterId;
  selectedNamespace.value = 'default';
  daemonsets.value = [];
  currentPage.value = 1;
  totalItems.value = 0;
  
  if (clusterId) {
    getNamespaces();
    getDaemonSets(1, pageSize.value);
  }
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
const isEditModalVisible = ref(false);
const eventsLoading = ref(false);
const historyLoading = ref(false);
const podsLoading = ref(false);
const metricsLoading = ref(false);
const loadingYaml = ref(false);
const yamlFormatting = ref(false);
const yamlValidationError = ref('');
const yamlValidationSuccess = ref(false);
const currentDaemonSet = ref<K8sDaemonSet | null>(null);
const currentYaml = ref('');
const isEditMode = ref(false);
const editedYaml = ref('');
const editMode = ref<'visual' | 'yaml'>('visual');
const editForm = ref<any>({});
const daemonsetEvents = ref<K8sDaemonSetEvent[]>([]);
const daemonsetPods = ref<any[]>([]);
const daemonsetMetrics = ref<K8sDaemonSetMetrics | null>(null);
const historyVersions = ref<K8sDaemonSetHistory[]>([]);



// 创建表单和模式
const createMode = ref<'visual' | 'yaml'>('visual');
const createYamlContent = ref('');
const createYamlValidationError = ref('');
const createYamlValidationSuccess = ref(false);
const createYamlFormatting = ref(false);

// 创建表单数据结构 - 严格按照CreateDaemonSetReq接口
const createForm = ref<{
  name: string;
  namespace: string;
  cluster_id: number;
  images: string[];
  labels: Record<string, string>;
  annotations: Record<string, string>;
    spec: {
    selector?: {
      matchLabels?: Record<string, string>;
    };
    template: {
      metadata?: {
        labels?: Record<string, string>;
        annotations?: Record<string, string>;
      };
      spec: {
        containers: Array<{
          name: string;
          image: string;
          imagePullPolicy?: string;
          ports?: Array<{
            name?: string;
            containerPort: number;
            protocol?: string;
          }>;
          env?: Array<{
            name: string;
            value: string;
          }>;
          resources?: {
            requests?: {
              cpu?: string;
              memory?: string;
            };
            limits?: {
              cpu?: string;
              memory?: string;
            };
          };
        }>;
      };
    };
    updateStrategy?: {
      type?: string;
    };
    revisionHistoryLimit?: number;
  };
  yaml?: string;
}>({
  name: '',
  namespace: '',
  cluster_id: 0,
  images: [''],
  labels: {},
  annotations: {},
  spec: {
    template: {
      metadata: {
        labels: {},
        annotations: {}
      },
      spec: {
        containers: [{
          name: '',
          image: '',
          imagePullPolicy: 'IfNotPresent',
          ports: [{ name: 'http', containerPort: 80, protocol: 'TCP' }],
          env: [{ name: '', value: '' }],
          resources: {
            requests: { cpu: '', memory: '' },
            limits: { cpu: '', memory: '' }
          }
        }]
      }
    },
    updateStrategy: {
      type: 'RollingUpdate'
    },
    revisionHistoryLimit: 10
  }
});

// 工具方法
const getPodReadyPercentage = (daemonset: K8sDaemonSet | null | undefined) => {
  if (!daemonset || !daemonset.desired_number_scheduled) return 0;
  const ready = daemonset.number_ready || 0;
  const desired = daemonset.desired_number_scheduled || 1; // 避免除零
  return Math.round((ready / desired) * 100);
};

const formatStatus = (status: number | string | null | undefined) => {
  if (status === null || status === undefined) return 'Unknown';
  const s = typeof status === 'number' ? status : Number(status || 0);
  switch (s) {
    case 1:
      return 'Running';
    case 3:
      return 'Updating';
    case 2:
      return 'Error';
    default:
      return 'Unknown';
  }
};

const getStatusBadgeType = (status: number | string | null | undefined) => {
  const text = formatStatus(status);
  switch (text) {
    case 'Running':
      return 'success';
    case 'Updating':
      return 'processing';
    case 'Error':
      return 'error';
    default:
      return 'default';
  }
};

const formatDateTime = (dateString: string): string => {
  if (!dateString || dateString === '0001-01-01T00:00:00Z') return '-';
  const date = new Date(dateString);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}:${String(date.getSeconds()).padStart(2, '0')}`;
};

// Pod状态徽章类型
const getPodStatusBadgeType = (status: string) => {
  switch (status) {
    case 'Running':
      return 'success';
    case 'Pending':
      return 'processing';
    case 'Succeeded':
      return 'success';
    case 'Failed':
      return 'error';
    case 'Unknown':
      return 'default';
    default:
      return 'default';
  }
};

// 表单操作方法（创建表单专用）
const updateImages = () => {
  // 从容器配置中更新镜像列表
  createForm.value.images = createForm.value.spec.template.spec.containers
    .map(container => container.image)
    .filter(image => image);
};

// 验证端口名称是否符合Kubernetes规范
const isValidPortName = (name: string | undefined): boolean => {
  if (!name) return true; // 空名称是可选的
  
  // Kubernetes端口名称规则：
  // 1. 必须是小写字母数字字符或'-'
  // 2. 必须以字母数字字符开头和结尾
  // 3. 长度不超过15个字符
  // 4. 必须包含至少一个字母
  const regex = /^[a-z0-9]([-a-z0-9]*[a-z0-9])?$/;
  const hasLetter = /[a-z]/.test(name);
  
  return name.length <= 15 && regex.test(name) && hasLetter;
};

// 确保容器结构完整性
const ensureContainerStructure = (container: any) => {
  if (!container.resources) {
    container.resources = {
      requests: { cpu: '', memory: '' },
      limits: { cpu: '', memory: '' }
    };
  } else {
    if (!container.resources.requests) {
      container.resources.requests = { cpu: '', memory: '' };
    }
    if (!container.resources.limits) {
      container.resources.limits = { cpu: '', memory: '' };
    }
  }
  if (!container.ports) {
    container.ports = [];
  }
  if (!container.env) {
    container.env = [];
  }
  if (!container.imagePullPolicy) {
    container.imagePullPolicy = 'IfNotPresent';
  }
};

const addCreatePort = (containerIndex: number) => {
  const container = createForm.value.spec.template.spec.containers[containerIndex];
  if (container) {
    ensureContainerStructure(container);
    container.ports!.push({ 
      name: `port-${container.ports!.length + 1}`,
      containerPort: 80, 
      protocol: 'TCP' 
    });
  }
};

const removeCreatePort = (containerIndex: number, portIndex: number) => {
  const container = createForm.value.spec.template.spec.containers[containerIndex];
  if (container && container.ports) {
    container.ports.splice(portIndex, 1);
  }
};

const addCreateEnv = (containerIndex: number) => {
  const container = createForm.value.spec.template.spec.containers[containerIndex];
  if (container) {
    ensureContainerStructure(container);
    container.env!.push({ name: '', value: '' });
  }
};

const removeCreateEnv = (containerIndex: number, envIndex: number) => {
  const container = createForm.value.spec.template.spec.containers[containerIndex];
  if (container && container.env) {
    container.env.splice(envIndex, 1);
  }
};

const addCreateLabel = () => {
  const key = prompt('请输入标签键名:');
  if (key && key.trim()) {
    createForm.value.labels[key.trim()] = '';
  }
};

const addCreateAnnotation = () => {
  const key = prompt('请输入注解键名:');
  if (key && key.trim()) {
    createForm.value.annotations[key.trim()] = '';
  }
};

// YAML模式相关函数
const loadDefaultYaml = () => {
  const defaultYaml = `apiVersion: apps/v1
kind: DaemonSet
metadata:
  name: example-daemonset
  namespace: default
  labels:
    app: example
spec:
  selector:
    matchLabels:
      app: example
  template:
    metadata:
      labels:
        app: example
    spec:
      containers:
      - name: example-container
        image: nginx:latest
        ports:
        - name: http
          containerPort: 80
          protocol: TCP
        resources:
          requests:
            cpu: 100m
            memory: 128Mi
          limits:
            cpu: 500m
            memory: 512Mi
  updateStrategy:
    type: RollingUpdate
  revisionHistoryLimit: 10`;
  
  createYamlContent.value = defaultYaml;
  createYamlValidationError.value = '';
  message.success('已加载默认模板');
};

const formatCreateYaml = async () => {
  if (!createYamlContent.value || !createYamlContent.value.trim()) {
    message.warning('请先输入YAML内容');
    return;
  }
  
  createYamlFormatting.value = true;
  try {
    const parsed = yaml.load(createYamlContent.value);
    const formatted = yaml.dump(parsed, {
      indent: 2,
      lineWidth: -1,
      noRefs: true,
      quotingType: '"'
    });
    
    createYamlContent.value = formatted;
    createYamlValidationError.value = '';
    createYamlValidationSuccess.value = true;
    message.success('YAML格式化成功');
    
    setTimeout(() => {
      createYamlValidationSuccess.value = false;
    }, 3000);
  } catch (error: any) {
    createYamlValidationError.value = error.message || 'YAML格式化失败';
    message.error('YAML格式化失败: ' + error.message);
  } finally {
    createYamlFormatting.value = false;
  }
};

const validateCreateYaml = () => {
  if (!createYamlContent.value || !createYamlContent.value.trim()) {
    createYamlValidationError.value = '';
    return true;
  }
  
  try {
    yaml.load(createYamlContent.value);
    createYamlValidationError.value = '';
    createYamlValidationSuccess.value = true;
    message.success('YAML格式验证通过');
    
    setTimeout(() => {
      createYamlValidationSuccess.value = false;
    }, 3000);
    return true;
  } catch (error: any) {
    createYamlValidationError.value = error.message || 'YAML格式错误';
    return false;
  }
};

// 创建DaemonSet
const handleCreateConfirm = async () => {
  if (!selectedCluster.value || !selectedNamespace.value) {
    message.warning('请先选择集群和命名空间');
    return;
  }

  try {
    loading.value = true;
    
    if (createMode.value === 'yaml') {
      // YAML模式创建
      if (!createYamlContent.value.trim()) {
        message.error('YAML内容不能为空');
        return;
      }
      
      if (!validateCreateYaml()) {
        message.error('YAML格式验证失败');
        return;
      }
      
      await createDaemonSetApi({
        cluster_id: selectedCluster.value,
        namespace: selectedNamespace.value,
        name: 'from-yaml', // 从YAML中解析名称
        images: [], // 从YAML中解析镜像
        spec: {}, // 空spec，因为使用yaml字段
        yaml: createYamlContent.value
      });
    } else {
      // 可视化模式创建
      if (!createForm.value.name) {
        message.error('请输入DaemonSet名称');
        return;
      }
      
      const firstContainer = createForm.value.spec.template.spec.containers[0];
      if (!firstContainer || !firstContainer.name || !firstContainer.image) {
        message.error('请填写容器名称和镜像');
        return;
      }
      
      // 更新表单数据
      createForm.value.cluster_id = selectedCluster.value;
      createForm.value.namespace = selectedNamespace.value;
      
      // 更新镜像列表
      updateImages();
      
      // 验证和清理端口配置
      for (const container of createForm.value.spec.template.spec.containers) {
        if (container.ports) {
          // 验证端口名称
          for (const port of container.ports) {
            if (port.name && !isValidPortName(port.name)) {
              message.error(`端口名称 "${port.name}" 无效。端口名称必须包含字母、符合DNS标准，且长度不超过15个字符。`);
              return;
            }
          }
          // 清理空端口
          container.ports = container.ports.filter(port => port.containerPort);
        }
        if (container.env) {
          container.env = container.env.filter(env => env.name);
        }
        
        // 清理空的资源配置
        if (container.resources) {
          if (container.resources.requests && 
              !container.resources.requests.cpu && 
              !container.resources.requests.memory) {
            delete container.resources.requests;
          }
          if (container.resources.limits && 
              !container.resources.limits.cpu && 
              !container.resources.limits.memory) {
            delete container.resources.limits;
          }
          if (!container.resources.requests && !container.resources.limits) {
            delete container.resources;
          }
        }
      }
      
      // 设置模板标签（必须与selector匹配）
      if (!createForm.value.spec.template.metadata) {
        createForm.value.spec.template.metadata = {};
      }
      if (!createForm.value.spec.template.metadata.labels) {
        createForm.value.spec.template.metadata.labels = {};
      }
      
      // 添加默认标签
      createForm.value.spec.template.metadata.labels['app'] = createForm.value.name;
      
      // 添加selector
      if (!createForm.value.spec.selector) {
        createForm.value.spec.selector = {
          matchLabels: {
            app: createForm.value.name
          }
        };
      }
      
      await createDaemonSetApi({
        cluster_id: createForm.value.cluster_id,
        namespace: createForm.value.namespace,
        name: createForm.value.name,
        images: createForm.value.images,
        labels: createForm.value.labels,
        annotations: createForm.value.annotations,
        spec: createForm.value.spec
      });
    }

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
  createMode.value = 'visual';
  createYamlContent.value = '';
  createYamlValidationError.value = '';
  createYamlValidationSuccess.value = false;
  
  const initialContainer = {
    name: '',
    image: '',
    imagePullPolicy: 'IfNotPresent',
    ports: [{ name: 'http', containerPort: 80, protocol: 'TCP' }],
    env: [{ name: '', value: '' }],
    resources: {
      requests: { cpu: '', memory: '' },
      limits: { cpu: '', memory: '' }
    }
  };
  
  // 确保容器结构完整性
  ensureContainerStructure(initialContainer);
  
  createForm.value = {
    name: '',
    namespace: selectedNamespace.value || '',
    cluster_id: selectedCluster.value || 0,
    images: [''],
    labels: {},
    annotations: {},
    spec: {
      template: {
        metadata: {
          labels: {},
          annotations: {}
        },
        spec: {
          containers: [initialContainer]
        }
      },
      updateStrategy: {
        type: 'RollingUpdate'
      },
      revisionHistoryLimit: 10
    }
  };
};

// DaemonSet操作方法
const viewDetails = async (daemonset: K8sDaemonSet) => {
  try {
    loading.value = true;
    
    // 获取详细信息
    const res = await getDaemonSetDetailsApi(selectedCluster.value!, daemonset.namespace, daemonset.name);
    
    // 处理API响应格式
    let detail = null;
    if (res) {
      // 新格式：{ code: 0, data: {...}, message: string }
      if (res.code !== undefined && res.data) {
        detail = res.data;
      }
      // 直接返回详情对象
      else if (res.name || res.uid) {
        detail = res;
      }
    }
    
    currentDaemonSet.value = detail || daemonset;
    
    // 重置所有tab的数据
    daemonsetPods.value = [];
    daemonsetMetrics.value = null;
    daemonsetEvents.value = [];
    
    // 打开模态框
    detailsModalVisible.value = true;
    
    // 预加载基础数据（可选，也可以等到用户点击tab时再加载）
    // 这里可以选择性地预加载一些重要数据
    
  } catch (error: any) {
    console.error('获取DaemonSet详情失败:', error);
    message.error(error.message || '获取详情失败');
  } finally {
    loading.value = false;
  }
};



const viewYaml = async (daemonset: K8sDaemonSet) => {
  try {
    loading.value = true;
    currentDaemonSet.value = daemonset;
    const res = await getDaemonSetYamlApi(selectedCluster.value!, daemonset.namespace, daemonset.name);
    
    let yamlContent = '';
    if (res) {
      // 新格式：{ code: 0, data: string, message: string } 或 { code: 0, data: { yaml: string }, message: string }
      if (res.code !== undefined && res.data) {
        if (typeof res.data === 'string') {
          yamlContent = res.data;
        } else if (typeof res.data === 'object' && res.data.yaml) {
          yamlContent = res.data.yaml;
        } else {
          yamlContent = JSON.stringify(res.data, null, 2);
        }
      }
      // 旧格式：{ yaml: string }
      else if (res && typeof res === 'object' && 'yaml' in res) {
        yamlContent = (res as any).yaml;
      }
      // 直接是字符串
      else if (typeof res === 'string') {
        yamlContent = res;
      }
      // 其他对象格式
      else {
        yamlContent = JSON.stringify(res, null, 2);
      }
    }
    
    currentYaml.value = yamlContent;
    
    yamlModalVisible.value = true;
  } catch (error: any) {
    message.error(error.message || '获取YAML失败');
  } finally {
    loading.value = false;
  }
};

const viewHistory = async (daemonset: K8sDaemonSet) => {
  try {
    historyLoading.value = true;
    currentDaemonSet.value = daemonset;
    const res = await getDaemonSetHistoryApi(selectedCluster.value!, daemonset.namespace, daemonset.name);
    
    // 处理API响应格式
    let historyItems: K8sDaemonSetHistory[] = [];
    if (res) {
      // 新格式：{ code: 0, data: { items: [], total: number }, message: string }
      if (res.code !== undefined && res.data && res.data.items && Array.isArray(res.data.items)) {
        historyItems = res.data.items;
      }
      // 标准格式：{ items: [], total: number }
      else if (res.items && Array.isArray(res.items)) {
        historyItems = res.items;
      }
      // 直接是数组格式
      else if (Array.isArray(res)) {
        historyItems = res;
      }
    }
    
    historyVersions.value = historyItems;
    historyModalVisible.value = true;
  } catch (error: any) {
    message.error(error.message || '获取历史版本失败');
  } finally {
    historyLoading.value = false;
  }
};

const handleEdit = async (daemonset: K8sDaemonSet) => {
  try {
    loading.value = true;
    currentDaemonSet.value = daemonset;
    
    // 构建editForm数据
    buildEditForm(daemonset);
    
    // 加载YAML内容
    const res = await getDaemonSetYamlApi(selectedCluster.value!, daemonset.namespace, daemonset.name);
    
    let yamlContent = '';
    if (res) {
      // 新格式：{ code: 0, data: string, message: string } 或 { code: 0, data: { yaml: string }, message: string }
      if (res.code !== undefined && res.data) {
        if (typeof res.data === 'string') {
          yamlContent = res.data;
        } else if (typeof res.data === 'object' && res.data.yaml) {
          yamlContent = res.data.yaml;
        } else {
          yamlContent = JSON.stringify(res.data, null, 2);
        }
      }
      // 旧格式：{ yaml: string }
      else if (res && typeof res === 'object' && 'yaml' in res) {
        yamlContent = (res as any).yaml;
      }
      // 直接是字符串
      else if (typeof res === 'string') {
        yamlContent = res;
      }
      // 其他对象格式
      else {
        yamlContent = JSON.stringify(res, null, 2);
      }
    }
    
    editForm.value.yaml_content = yamlContent;
    editMode.value = 'visual'; // 默认进入可视化编辑模式
    isEditModalVisible.value = true;
  } catch (error: any) {
    message.error(error.message || '加载编辑数据失败');
  } finally {
    loading.value = false;
  }
};

// 进入编辑模式
const enterEditMode = () => {
  isEditMode.value = true;
  editedYaml.value = currentYaml.value;
};

// 取消编辑
const cancelEdit = () => {
  isEditMode.value = false;
  editedYaml.value = '';
};

// 提交编辑（旧的YAML编辑模式）
const submitEdit = async () => {
  if (!currentDaemonSet.value || !editedYaml.value.trim()) {
    message.error('YAML内容不能为空');
    return;
  }

  try {
    loading.value = true;
    await updateDaemonSetApi(
      selectedCluster.value!,
      currentDaemonSet.value.namespace,
      currentDaemonSet.value.name,
      {
        cluster_id: selectedCluster.value!,
        name: currentDaemonSet.value.name,
        namespace: currentDaemonSet.value.namespace,
        edit_mode: 'yaml',
        yaml: editedYaml.value
      }
    );
    
    message.success('DaemonSet更新成功');
    isEditMode.value = false;
    yamlModalVisible.value = false;
    
    // 刷新列表
    getDaemonSets(currentPage.value, pageSize.value);
  } catch (error: any) {
    message.error(error.message || 'DaemonSet更新失败');
  } finally {
    loading.value = false;
  }
};

const handleRestart = async (daemonset: K8sDaemonSet) => {
  try {
    loading.value = true;
    await restartDaemonSetApi(selectedCluster.value!, daemonset.namespace, daemonset.name, { cluster_id: selectedCluster.value!, namespace: daemonset.namespace, name: daemonset.name });
    message.success('DaemonSet重启成功');
    getDaemonSets(currentPage.value, pageSize.value);
  } catch (error: any) {
    message.error(error.message || 'DaemonSet重启失败');
  } finally {
    loading.value = false;
  }
};

// 暂停/恢复功能当前接口未定义，已移除



const handleDelete = async (daemonset: K8sDaemonSet) => {
  try {
    loading.value = true;
    await deleteDaemonSetApi(selectedCluster.value!, daemonset.namespace, daemonset.name);
    message.success('DaemonSet删除成功');
    getDaemonSets(currentPage.value, pageSize.value);
  } catch (error: any) {
    message.error(error.message || 'DaemonSet删除失败');
  } finally {
    loading.value = false;
  }
};

// 批量重启
const handleBatchRestart = async () => {
  if (!selectedRows.value.length || !selectedCluster.value) return;
  try {
    loading.value = true;
    for (const item of selectedRows.value) {
      await restartDaemonSetApi(selectedCluster.value, item.namespace, item.name, { cluster_id: selectedCluster.value, namespace: item.namespace, name: item.name });
    }
    message.success(`成功重启 ${selectedRows.value.length} 个DaemonSet`);
    selectedRows.value = [];
    getDaemonSets(currentPage.value, pageSize.value);
  } catch (error: any) {
    message.error(error.message || '批量重启失败');
  } finally {
    loading.value = false;
  }
};

// 批量删除
const handleBatchDelete = async () => {
  if (!selectedRows.value.length || !selectedCluster.value) return;
  try {
    loading.value = true;
    for (const item of selectedRows.value) {
      await deleteDaemonSetApi(selectedCluster.value, item.namespace, item.name);
    }
    message.success(`成功删除 ${selectedRows.value.length} 个DaemonSet`);
    selectedRows.value = [];
    getDaemonSets(currentPage.value, pageSize.value);
  } catch (error: any) {
    message.error(error.message || '批量删除失败');
  } finally {
    loading.value = false;
  }
};

// Pod列表加载
const loadDaemonSetPods = async () => {
  if (!currentDaemonSet.value || !selectedCluster.value) {
    console.warn('缺少必要参数，无法加载Pod列表');
    return;
  }
  
  try {
    podsLoading.value = true;
    const res = await getDaemonSetPodsApi(
      selectedCluster.value,
      currentDaemonSet.value.namespace,
      currentDaemonSet.value.name
    );
    
    // 处理不同的API响应格式
    let podItems: any[] = [];
    
    if (res) {
      // 新格式：{ code: 0, data: { items: [], total: number }, message: string }
      if (res.code !== undefined && res.data && res.data.items && Array.isArray(res.data.items)) {
        podItems = res.data.items.filter((item: any) => item && item.name);
      }
      // 标准格式：{ items: [], total: number }
      else if (res.items && Array.isArray(res.items)) {
        podItems = res.items.filter((item: any) => item && (item.name || item.metadata?.name));
      }
      // 直接是数组格式
      else if (Array.isArray(res)) {
        podItems = res.filter((item: any) => item && (item.name || item.metadata?.name));
      }
      // 包含 data 字段的格式（其他格式）
      else if (res.data) {
        if (Array.isArray(res.data)) {
          podItems = res.data.filter((item: any) => item && (item.name || item.metadata?.name));
        } else if (res.data.items && Array.isArray(res.data.items)) {
          podItems = res.data.items.filter((item: any) => item && (item.name || item.metadata?.name));
        }
      }
    }
    
    // 处理Pod数据，确保字段完整性
    daemonsetPods.value = podItems.map((pod: any) => ({
      ...pod,
      // 确保有默认值，避免显示异常
      name: pod.name || '',
      status: pod.status || 'Unknown',
      node_name: pod.node_name || '-',
      created_at: pod.created_at || '',
      namespace: pod.namespace || currentDaemonSet.value?.namespace || '',
    }));
    
    if (podItems.length === 0) {
      console.info('当前DaemonSet没有Pod实例');
    } else {
      console.log(`成功加载 ${podItems.length} 个Pod实例`);
    }
  } catch (error: any) {
    console.error('获取Pod列表失败:', error);
    message.error(error.message || '获取Pod列表失败');
    daemonsetPods.value = [];
  } finally {
    podsLoading.value = false;
  }
};

// 指标加载
const loadDaemonSetMetrics = async () => {
  if (!currentDaemonSet.value || !selectedCluster.value) {
    console.warn('缺少必要参数，无法加载指标数据');
    return;
  }
  
  try {
    metricsLoading.value = true;
    const res = await getDaemonSetMetricsApi(
      selectedCluster.value,
      currentDaemonSet.value.namespace,
      currentDaemonSet.value.name
    );
    
    // 处理不同的API响应格式
    let metricsData: K8sDaemonSetMetrics | null = null;
    
    if (res) {
      // 新格式：{ code: 0, data: {...}, message: string }
      if (res.code !== undefined && res.data) {
        if (res.data.cpu_usage !== undefined || res.data.memory_usage !== undefined) {
          metricsData = res.data as K8sDaemonSetMetrics;
        }
      }
      // 直接是指标对象
      else if (res.cpu_usage !== undefined || res.memory_usage !== undefined) {
        metricsData = res as K8sDaemonSetMetrics;
      }
      // 包含 data 字段的格式（其他格式）
      else if (res.data && (res.data.cpu_usage !== undefined || res.data.memory_usage !== undefined)) {
        metricsData = res.data as K8sDaemonSetMetrics;
      }
      // 空的指标响应
      else if (Object.keys(res).length === 0) {
        metricsData = null;
      }
    }
    
    daemonsetMetrics.value = metricsData;
    
    if (!metricsData) {
      console.info('当前DaemonSet没有可用的指标数据，可能需要安装metrics-server');
    }
  } catch (error: any) {
    console.error('获取指标失败:', error);
    // 指标获取失败通常不是严重错误，不显示错误提示
    // message.error(error.message || '获取指标失败');
    daemonsetMetrics.value = null;
  } finally {
    metricsLoading.value = false;
  }
};

// 处理tab切换
const handleTabChange = (activeKey: string) => {
  if (!currentDaemonSet.value) return;
  
  switch (activeKey) {
    case '3': // Pod列表
      loadDaemonSetPods();
      break;
    case '4': // 指标监控
      loadDaemonSetMetrics();
      break;
    case '5': // 事件
      loadDaemonSetEvents();
      break;
    case '6': // 条件状态
      loadDaemonSetConditions();
      break;
    default:
      break;
  }
};

// 条件加载
const loadDaemonSetConditions = async () => {
  // 条件已经在currentDaemonSet中，但可以提供刷新功能
  if (!currentDaemonSet.value || !selectedCluster.value) return;
  
  try {
    // 重新获取详情来刷新条件状态
    const res = await getDaemonSetDetailsApi(
      selectedCluster.value,
      currentDaemonSet.value.namespace,
      currentDaemonSet.value.name
    );
    
    // 处理API响应格式
    let detail = null;
    if (res) {
      // 新格式：{ code: 0, data: {...}, message: string }
      if (res.code !== undefined && res.data) {
        detail = res.data;
      }
      // 直接返回详情对象
      else if (res.name || res.uid) {
        detail = res;
      }
    }
    
    if (detail && detail.conditions) {
      currentDaemonSet.value = { ...currentDaemonSet.value, conditions: detail.conditions };
    }
  } catch (error: any) {
    console.error('刷新条件状态失败:', error);
    // 条件状态刷新失败不显示错误提示，因为这不是关键操作
  }
};

// 事件加载
const loadDaemonSetEvents = async () => {
  if (!currentDaemonSet.value || !selectedCluster.value) {
    console.warn('缺少必要参数，无法加载事件数据');
    return;
  }
  
  try {
    eventsLoading.value = true;
    const res = await getDaemonSetEventsApi(
      selectedCluster.value,
      currentDaemonSet.value.namespace,
      currentDaemonSet.value.name,
      {
        cluster_id: selectedCluster.value,
        namespace: currentDaemonSet.value.namespace,
        name: currentDaemonSet.value.name,
        limit: 50 // 限制事件数量
      }
    );
    
    // 处理不同的API响应格式
    let eventItems: K8sDaemonSetEvent[] = [];
    
    if (res) {
      // 新格式：{ code: 0, data: { items: [], total: number }, message: string }
      if (res.code !== undefined && res.data && res.data.items && Array.isArray(res.data.items)) {
        eventItems = res.data.items.filter((item: any) => item && (item.type || item.reason));
      }
      // 标准格式：{ items: [], total: number }
      else if (res.items && Array.isArray(res.items)) {
        eventItems = res.items.filter((item: any) => item && (item.type || item.reason));
      }
      // 直接是数组格式
      else if (Array.isArray(res)) {
        eventItems = res.filter((item: any) => item && (item.type || item.reason));
      }
      // 包含 data 字段的格式（其他格式）
      else if (res.data) {
        if (Array.isArray(res.data)) {
          eventItems = res.data.filter((item: any) => item && (item.type || item.reason));
        } else if (res.data.items && Array.isArray(res.data.items)) {
          eventItems = res.data.items.filter((item: any) => item && (item.type || item.reason));
        }
      }
    }
    
    // 按时间排序，最新的在前面
    eventItems.sort((a, b) => {
      const timeA = new Date(a.last_time || a.first_time || 0).getTime();
      const timeB = new Date(b.last_time || b.first_time || 0).getTime();
      return timeB - timeA;
    });
    
    daemonsetEvents.value = eventItems;
    
    if (eventItems.length === 0) {
      console.info('当前DaemonSet没有事件记录');
    }
  } catch (error: any) {
    console.error('获取事件失败:', error);
    message.error(error.message || '获取事件失败');
    daemonsetEvents.value = [];
  } finally {
    eventsLoading.value = false;
  }
};

// 版本回滚
const rollbackToVersion = async (revision: number) => {
  if (!currentDaemonSet.value) return;
  
  try {
    loading.value = true;
    await rollbackDaemonSetApi(selectedCluster.value!, currentDaemonSet.value.namespace, currentDaemonSet.value.name, {
      cluster_id: selectedCluster.value!,
      namespace: currentDaemonSet.value.namespace,
      name: currentDaemonSet.value.name,
      revision,
    });
    message.success(`成功回滚到版本 ${revision}`);
    historyModalVisible.value = false;
    getDaemonSets(currentPage.value, pageSize.value);
  } catch (error: any) {
    message.error(error.message || '版本回滚失败');
  } finally {
    loading.value = false;
  }
};

// loadDaemonSetPods和loadDaemonSetMetrics函数已移除，相关功能可通过详情页面实现

// 复制功能
const copyToClipboard = async (text: string) => {
  try {
    await navigator.clipboard.writeText(text);
    message.success('已复制到剪贴板');
  } catch (error) {
    message.error('复制失败');
  }
};

// 复制YAML
const copyYaml = async () => {
  try {
    await navigator.clipboard.writeText(currentYaml.value);
    message.success('YAML 已复制到剪贴板');
  } catch (err) {
    message.error('复制失败，请手动选择并复制');
  }
};

const copyYamlToClipboard = async () => {
  await copyYaml();
};

// 构建编辑表单数据
const buildEditForm = (daemonset: K8sDaemonSet) => {
  // 提取容器配置
  const containers = daemonset.images?.map((image, index) => ({
    name: `container-${index + 1}`,
    image: image,
    image_pull_policy: 'IfNotPresent',
    ports: [] as any[],
    env_vars: [] as any[],
    resources: {
      requests: { cpu: '', memory: '' },
      limits: { cpu: '', memory: '' }
    },
    volume_mounts: [] as any[],
    liveness_probe: null,
    readiness_probe: null
  })) || [{
    name: 'container-1',
    image: '',
    image_pull_policy: 'IfNotPresent',
    ports: [] as any[],
    env_vars: [] as any[],
    resources: {
      requests: { cpu: '', memory: '' },
      limits: { cpu: '', memory: '' }
    },
    volume_mounts: [] as any[],
    liveness_probe: null,
    readiness_probe: null
  }];

  editForm.value = {
    // 基本信息
    name: daemonset.name,
    namespace: daemonset.namespace,
    
    // 容器配置
    containers: containers,
    
    // 部署策略
    update_strategy: daemonset.update_strategy || 'RollingUpdate',
    min_ready_seconds: 0,
    revision_history_limit: daemonset.revision_history_limit || 10,
    
    // 标签和注解
    labels: { ...(daemonset.labels || {}) },
    annotations: { ...(daemonset.annotations || {}) },
    
    // YAML内容
    yaml_content: '',
    
    // 编辑模式
    edit_mode: 'visual'
  };
};

// 容器管理函数
const addContainer = () => {
  editForm.value.containers.push({
    name: `container-${editForm.value.containers.length + 1}`,
    image: '',
    image_pull_policy: 'IfNotPresent',
    ports: [],
    env_vars: [],
    resources: {
      requests: { cpu: '', memory: '' },
      limits: { cpu: '', memory: '' }
    },
    volume_mounts: [],
    liveness_probe: null,
    readiness_probe: null
  });
};

const removeContainer = (index: number) => {
  if (editForm.value.containers.length > 1) {
    editForm.value.containers.splice(index, 1);
  } else {
    message.warning('至少需要保留一个容器');
  }
};

// 端口管理函数
const addPort = (containerIndex: number) => {
  editForm.value.containers[containerIndex].ports.push({
    name: '',
    container_port: 80,
    protocol: 'TCP'
  });
};

const removePort = (containerIndex: number, portIndex: number) => {
  editForm.value.containers[containerIndex].ports.splice(portIndex, 1);
};

// 环境变量管理函数
const addEnvVar = (containerIndex: number) => {
  editForm.value.containers[containerIndex].env_vars.push({
    name: '',
    value: ''
  });
};

const removeEnvVar = (containerIndex: number, envIndex: number) => {
  editForm.value.containers[containerIndex].env_vars.splice(envIndex, 1);
};

// 标签和注解管理函数
const addLabel = () => {
  const key = prompt('请输入标签键名:');
  if (key && key.trim()) {
    editForm.value.labels[key.trim()] = '';
  }
};

const addAnnotation = () => {
  const key = prompt('请输入注解键名:');
  if (key && key.trim()) {
    editForm.value.annotations[key.trim()] = '';
  }
};

// YAML相关函数
const loadCurrentYaml = async () => {
  if (!currentDaemonSet.value) {
    message.warning('请先选择DaemonSet');
    return;
  }

  loadingYaml.value = true;
  try {
    const res = await getDaemonSetYamlApi(
      selectedCluster.value!,
      currentDaemonSet.value.namespace,
      currentDaemonSet.value.name
    );
    
    let yamlContent = '';
    if (res) {
      // 新格式：{ code: 0, data: string, message: string } 或 { code: 0, data: { yaml: string }, message: string }
      if (res.code !== undefined && res.data) {
        if (typeof res.data === 'string') {
          yamlContent = res.data;
        } else if (typeof res.data === 'object' && res.data.yaml) {
          yamlContent = res.data.yaml;
        } else {
          yamlContent = JSON.stringify(res.data, null, 2);
        }
      }
      // 旧格式：{ yaml: string }
      else if (res && typeof res === 'object' && 'yaml' in res) {
        yamlContent = (res as any).yaml;
      }
      // 直接是字符串
      else if (typeof res === 'string') {
        yamlContent = res;
      }
      // 其他对象格式
      else {
        yamlContent = JSON.stringify(res, null, 2);
      }
    }
    
    editForm.value.yaml_content = yamlContent;
    yamlValidationError.value = '';
    message.success('YAML内容加载成功');
  } catch (error: any) {
    console.error('加载YAML失败:', error);
    message.error(error.message || '加载YAML失败');
  } finally {
    loadingYaml.value = false;
  }
};

// YAML格式化功能
const formatYaml = async () => {
  if (!editForm.value.yaml_content || !editForm.value.yaml_content.trim()) {
    message.warning('请先输入YAML内容');
    return;
  }
  
  yamlFormatting.value = true;
  try {
    // 使用js-yaml进行解析和格式化
    const parsed = yaml.load(editForm.value.yaml_content);
    const formatted = yaml.dump(parsed, {
      indent: 2,
      lineWidth: -1,
      noRefs: true,
      quotingType: '"'
    });
    
    editForm.value.yaml_content = formatted;
    yamlValidationError.value = '';
    yamlValidationSuccess.value = true;
    message.success('YAML格式化成功');
    
    // 3秒后隐藏成功提示
    setTimeout(() => {
      yamlValidationSuccess.value = false;
    }, 3000);
  } catch (error: any) {
    console.error('YAML格式化失败:', error);
    yamlValidationError.value = error.message || 'YAML格式化失败';
    message.error('YAML格式化失败: ' + error.message);
  } finally {
    yamlFormatting.value = false;
  }
};

// YAML验证功能
const validateYaml = () => {
  if (!editForm.value.yaml_content || !editForm.value.yaml_content.trim()) {
    yamlValidationError.value = '';
    return true;
  }
  
  try {
    yaml.load(editForm.value.yaml_content);
    yamlValidationError.value = '';
    return true;
  } catch (error: any) {
    yamlValidationError.value = error.message || 'YAML格式错误';
    return false;
  }
};

// 提交编辑
const submitEditForm = async () => {
  if (!currentDaemonSet.value) {
    message.error('请先选择DaemonSet');
    return;
  }

  // 验证表单数据
  if (editMode.value === 'visual') {
    if (!editForm.value.containers || editForm.value.containers.length === 0) {
      message.error('至少需要一个容器配置');
      return;
    }
    
    for (let container of editForm.value.containers) {
      if (!container.name || !container.image) {
        message.error('容器名称和镜像不能为空');
        return;
      }
    }
  } else if (editMode.value === 'yaml') {
    if (!validateYaml()) {
      message.error('YAML格式验证失败');
      return;
    }
  }

  try {
    loading.value = true;
    const updateData = {
      cluster_id: selectedCluster.value!,
      name: currentDaemonSet.value.name,
      namespace: currentDaemonSet.value.namespace,
      edit_mode: editMode.value,
      ...editForm.value
    };

    await updateDaemonSetApi(
      selectedCluster.value!,
      currentDaemonSet.value.namespace,
      currentDaemonSet.value.name,
      updateData
    );
    
    message.success('DaemonSet更新成功');
    isEditModalVisible.value = false;
    
    // 刷新列表
    getDaemonSets(currentPage.value, pageSize.value);
  } catch (error: any) {
    message.error(error.message || 'DaemonSet更新失败');
  } finally {
    loading.value = false;
  }
};

// 页面加载时获取数据
onMounted(() => {
  getClusters();
});
</script>

<style scoped>
/* 保持与Namespace页面一致的样式系统 */
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

.daemonset-name {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 500;
}

.daemonset-name .anticon {
  color: #1677ff;
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

.timestamp {
  display: flex;
  align-items: center;
  gap: 8px;
  color: #00000073;
}

.timestamp .anticon {
  color: #00000040;
}

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

.empty-state {
  text-align: center;
  padding: 60px 0;
  color: #00000073;
}

.empty-state p {
  margin: 16px 0;
  font-size: 16px;
}

/* 模态框样式 */
.cluster-modal :deep(.ant-modal-content) {
  border-radius: 8px;
}

.cluster-modal :deep(.ant-modal-header) {
  background: #fff;
  border-bottom: 1px solid #f0f0f0;
  padding: 20px 24px;
}

.cluster-modal :deep(.ant-modal-title) {
  font-size: 16px;
  font-weight: 600;
}

.cluster-modal :deep(.ant-modal-body) {
  padding: 24px;
}

.cluster-modal :deep(.ant-modal-footer) {
  border-top: 1px solid #f0f0f0;
  padding: 16px 24px;
  background: #fafafa;
}

.modal-alert {
  margin-bottom: 20px;
  border-radius: 6px;
}

.cluster-form,
.daemonset-form {
  padding: 8px 0;
}

.form-input {
  border-radius: 6px;
  transition: all 0.3s;
  font-size: 14px;
  height: 40px;
  border: 1px solid #d9d9d9;
}

.form-input:focus,
.form-input:hover {
  border-color: #1677ff;
  box-shadow: 0 0 0 2px rgba(22, 119, 255, 0.1);
}

.port-config, .env-config {
  border: 1px solid #d9d9d9;
  border-radius: 6px;
  padding: 16px;
  background-color: #fafafa;
}

.port-row, .env-row {
  display: flex;
  gap: 8px;
  align-items: center;
  margin-bottom: 8px;
}

.port-row:last-child, .env-row:last-child {
  margin-bottom: 0;
}

/* 创建模态框样式 */
.create-daemonset-modal .ant-modal-content {
  border-radius: 8px;
}

.create-daemonset-modal .ant-modal-body {
  padding: 0;
  max-height: 80vh;
  overflow-y: auto;
}

.create-content {
  padding: 20px;
}

.create-mode-switcher {
  margin: 16px 0 24px 0;
  text-align: center;
}

.create-mode-switcher .ant-radio-button-wrapper {
  height: 40px;
  line-height: 38px;
  padding: 0 24px;
  font-weight: 500;
}

.create-content-wrapper {
  min-height: 400px;
}

.visual-create-content {
  background: #fafafa;
  border-radius: 8px;
  padding: 20px;
  border: 1px solid #f0f0f0;
}

.yaml-create-content {
  background: #fafafa;
  border-radius: 8px;
  padding: 20px;
  border: 1px solid #f0f0f0;
}

.create-form .form-section {
  background: #fff;
  border-radius: 8px;
  padding: 20px;
  margin-bottom: 16px;
  border: 1px solid #f0f0f0;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.02);
}

.create-form .section-title {
  font-size: 16px;
  font-weight: 600;
  color: #1677ff;
  margin-bottom: 16px;
  padding-bottom: 8px;
  border-bottom: 1px solid #f0f0f0;
  display: flex;
  align-items: center;
  gap: 8px;
}

.create-form .section-title::before {
  content: '';
  width: 4px;
  height: 16px;
  background: #1677ff;
  border-radius: 2px;
}

.create-form .container-item {
  background: #f9f9f9;
  border-radius: 8px;
  padding: 16px;
  border: 1px solid #e8e8e8;
  margin-bottom: 16px;
}

.create-form .container-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
  padding-bottom: 8px;
  border-bottom: 1px solid #e8e8e8;
}

.create-form .container-title {
  font-size: 14px;
  font-weight: 600;
  color: #333;
}

.create-form .sub-section {
  margin: 16px 0;
  padding: 12px;
  background: #fff;
  border-radius: 6px;
  border: 1px solid #f0f0f0;
}

.create-form .sub-section-title {
  font-size: 14px;
  font-weight: 600;
  color: #555;
  margin-bottom: 12px;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.create-form .port-list, 
.create-form .env-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.create-form .port-item, 
.create-form .env-item {
  background: #f8f8f8;
  padding: 8px;
  border-radius: 4px;
  border: 1px solid #e8e8e8;
}

.create-form .label-item {
  margin-bottom: 8px;
}

.yaml-actions {
  margin-bottom: 16px;
  display: flex;
  justify-content: flex-end;
}

.yaml-validation-error, 
.yaml-validation-success {
  margin-bottom: 12px;
}

.yaml-editor-container {
  border-radius: 6px;
  overflow: hidden;
}

.create-footer {
  margin-top: 24px;
  padding-top: 16px;
  border-top: 1px solid #f0f0f0;
  text-align: right;
}

/* 端口名称验证错误提示样式 */
.ant-form-item-explain-error {
  color: #ff4d4f;
  font-size: 12px;
  line-height: 1.5;
  margin-top: 4px;
}

.ant-form-item-explain-error div[role="alert"] {
  margin: 0;
  padding: 0;
}

/* 详情页面 */
.daemonset-details {
  padding: 8px 0;
}

.details-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 16px;
  margin-bottom: 24px;
}

.detail-card {
  background: #fafafa;
  border-radius: 8px;
  padding: 16px;
  border: 1px solid #f0f0f0;
}

.detail-card h4 {
  margin: 0 0 16px 0;
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 8px;
  color: #000000d9;
  font-size: 16px;
}

.detail-item {
  display: flex;
  justify-content: space-between;
  margin-bottom: 12px;
  align-items: flex-start;
}

.detail-item:last-child {
  margin-bottom: 0;
}

.detail-label {
  color: #00000073;
  font-weight: 500;
  min-width: 100px;
  font-size: 14px;
}

.detail-value {
  color: #000000d9;
  font-weight: 400;
  flex: 1;
  text-align: right;
  word-break: break-all;
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
  flex-wrap: wrap;
}

/* 条件样式 */
.conditions-container {
  padding: 16px;
}

.conditions-header, .pods-header, .metrics-header, .events-header {
  display: flex;
  justify-content: flex-end;
  margin-bottom: 16px;
  padding-bottom: 8px;
  border-bottom: 1px solid #f0f0f0;
}

.conditions-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.condition-card {
  border: 1px solid #f0f0f0;
  border-radius: 8px;
  padding: 16px;
  background: #fafafa;
  transition: all 0.3s;
}

.condition-card:hover {
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.condition-card.condition-success {
  border-left: 4px solid #52c41a;
  background: #f6ffed;
}

.condition-card.condition-error {
  border-left: 4px solid #ff4d4f;
  background: #fff2f0;
}

.condition-card.condition-unknown {
  border-left: 4px solid #d9d9d9;
}

.condition-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.condition-type {
  font-weight: 600;
}

.condition-status {
  font-size: 12px;
  color: #666;
  background: #f0f0f0;
  padding: 2px 8px;
  border-radius: 4px;
}

.condition-body {
  font-size: 14px;
}

.condition-reason {
  margin-bottom: 8px;
  color: #1890ff;
}

.condition-message {
  margin-bottom: 12px;
  color: #333;
}

.condition-times {
  font-size: 12px;
  color: #666;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

/* 标签注解样式 */
.labels-annotations {
  padding: 16px;
}

.label-section, .annotation-section, .selector-section {
  margin-bottom: 24px;
}

.label-section h4, .annotation-section h4, .selector-section h4 {
  margin: 0 0 16px 0;
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 8px;
  color: #000000d9;
}

.labels-grid, .selectors-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.label-item, .selector-item {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}

.annotations-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.annotation-item {
  background: #f9f9f9;
  border: 1px solid #f0f0f0;
  border-radius: 6px;
  padding: 12px;
}

.annotation-key {
  font-weight: 600;
  color: #1890ff;
  margin-bottom: 8px;
  font-size: 14px;
}

.annotation-value {
  color: #333;
  word-break: break-all;
  line-height: 1.5;
}

/* Pod列表样式 */
.pods-container {
  padding: 16px;
}

.pods-container .ant-table {
  margin-top: 0;
}

.pod-name {
  display: flex;
  align-items: center;
  font-weight: 500;
}

.pod-node {
  display: flex;
  align-items: center;
  font-weight: 500;
}

/* 指标监控样式 */
.metrics-container {
  padding: 16px;
}

.metrics-content {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.metrics-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 16px;
}

.metric-card {
  background: #fff;
  border: 1px solid #f0f0f0;
  border-radius: 8px;
  padding: 20px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.02);
  transition: all 0.3s;
}

.metric-card:hover {
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
  transform: translateY(-2px);
}

.metric-card h4 {
  margin: 0 0 16px 0;
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 8px;
  color: #000000d9;
  font-size: 16px;
}

.metric-value {
  font-size: 24px;
  font-weight: 600;
  color: #1890ff;
  margin-bottom: 12px;
}

.metric-detail {
  display: flex;
  flex-direction: column;
  gap: 8px;
  font-size: 14px;
  color: #666;
}

.metrics-info {
  margin-top: 16px;
}

.metrics-footer {
  text-align: center;
  margin-top: 16px;
  color: #999;
  font-size: 12px;
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
  
  .port-row, .env-row {
    flex-direction: column;
    gap: 8px;
    align-items: stretch;
  }
  
  .port-row .form-input, .env-row .form-input {
    width: 100% !important;
  }
  
  .port-row .ant-btn, .env-row .ant-btn {
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
}

/* YAML模态框样式 */
.yaml-modal {
  font-family: "Consolas", "Monaco", monospace;
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

.yaml-editor-container {
  margin-top: 16px;
}

.yaml-textarea {
  font-family: 'JetBrains Mono', 'Courier New', monospace !important;
  font-size: 14px !important;
  line-height: 1.5 !important;
  background-color: #fafafa;
  border: 1px solid #d9d9d9;
  border-radius: 4px;
}

.yaml-textarea:focus {
  border-color: #1890ff;
  box-shadow: 0 0 0 2px rgba(24, 144, 255, 0.2);
}

.yaml-viewer {
  margin-top: 16px;
}

/* 历史版本模态框样式 */
.history-modal .ant-modal-body {
  padding: 0;
}

.history-content {
  max-height: 70vh;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.history-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  border-bottom: 1px solid #f0f0f0;
  background: #fafafa;
}

.history-info {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.history-title {
  font-size: 16px;
  font-weight: 600;
  color: #262626;
  display: flex;
  align-items: center;
  gap: 8px;
}

.history-namespace {
  font-size: 12px;
  color: #8c8c8c;
}

.history-stats {
  text-align: center;
}

.history-content .ant-table {
  margin: 16px 20px;
}

.history-content .ant-empty {
  margin: 40px 0;
}

.history-instructions {
  padding: 0 20px;
}

.history-instructions .ant-alert {
  border-radius: 6px;
}

/* ==================== 现代化模态框样式 ==================== */
.cluster-modal .ant-modal-content,
.edit-modal .ant-modal-content {
  border-radius: 16px;
  overflow: hidden;
  box-shadow: 0 25px 50px rgba(0, 0, 0, 0.15);
  border: none;
}

.cluster-modal .ant-modal-header,
.edit-modal .ant-modal-header {
  background: linear-gradient(135deg, #ffffff 0%, #f8fafc 100%);
  border-bottom: 1px solid rgba(0, 0, 0, 0.06);
  padding: 24px 32px;
  position: relative;
}

.cluster-modal .ant-modal-header::before,
.edit-modal .ant-modal-header::before {
  content: '';
  position: absolute;
  left: 0;
  bottom: 0;
  width: 100%;
  height: 1px;
  background: linear-gradient(90deg, transparent 0%, rgba(22, 119, 255, 0.2) 50%, transparent 100%);
}

.cluster-modal .ant-modal-title,
.edit-modal .ant-modal-title {
  font-size: 20px;
  font-weight: 700;
  color: #1a1a1a;
  display: flex;
  align-items: center;
  gap: 12px;
}

.cluster-modal .ant-modal-body,
.edit-modal .ant-modal-body {
  padding: 32px;
  background: #ffffff;
  max-height: 80vh;
  overflow-y: auto;
}

.edit-content {
  position: relative;
}

.edit-mode-switcher {
  background: #f8fafc;
  border-radius: 12px;
  padding: 6px;
  margin-bottom: 32px;
  border: 1px solid #e2e8f0;
  box-shadow: inset 0 1px 3px rgba(0, 0, 0, 0.1);
}

.edit-mode-switcher .ant-radio-group {
  width: 100%;
  display: flex;
}

.edit-mode-switcher .ant-radio-button-wrapper {
  flex: 1;
  text-align: center;
  height: 44px;
  line-height: 42px;
  border: none;
  background: transparent;
  border-radius: 8px;
  font-weight: 600;
  font-size: 15px;
  color: #64748b;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  position: relative;
  overflow: hidden;
}

.edit-mode-switcher .ant-radio-button-wrapper::before {
  display: none;
}

.edit-mode-switcher .ant-radio-button-wrapper-checked {
  background: linear-gradient(135deg, #1677ff 0%, #4096ff 100%);
  color: #ffffff;
  box-shadow: 0 4px 12px rgba(22, 119, 255, 0.3);
  transform: translateY(-1px);
}

.edit-mode-switcher .ant-radio-button-wrapper:hover {
  color: #1677ff;
  background: rgba(22, 119, 255, 0.05);
}

.edit-mode-switcher .ant-radio-button-wrapper-checked:hover {
  color: #ffffff;
  background: linear-gradient(135deg, #1677ff 0%, #4096ff 100%);
}

.edit-mode-label {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 16px;
  font-weight: 600;
  color: #1677ff;
  margin-bottom: 16px;
}

.edit-content-wrapper {
  position: relative;
  background: #ffffff;
  min-height: 400px;
}

.visual-edit-content {
  animation: fadeInUp 0.3s ease-out;
}

.yaml-edit-content {
  animation: fadeInUp 0.3s ease-out;
}

@keyframes fadeInUp {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* ==================== 表单样式优化 ==================== */
.form-section {
  background: #fafbfc;
  border-radius: 12px;
  padding: 24px;
  margin-bottom: 24px;
  border: 1px solid #e2e8f0;
  transition: all 0.3s ease;
  position: relative;
}

.form-section:hover {
  border-color: #d1d9e0;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
}

.section-title {
  font-size: 16px;
  font-weight: 700;
  color: #1a1a1a;
  margin-bottom: 20px;
  padding-bottom: 8px;
  border-bottom: 2px solid #e2e8f0;
  position: relative;
}

.section-title::before {
  content: '';
  position: absolute;
  left: 0;
  bottom: -2px;
  width: 40px;
  height: 2px;
  background: linear-gradient(90deg, #1677ff, #4096ff);
  border-radius: 1px;
  display: flex;
  align-items: center;
  gap: 8px;
}

.section-title::before {
  content: '';
  width: 4px;
  height: 16px;
  background: #1677ff;
  border-radius: 2px;
}

.container-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.container-item {
  background: #f9f9f9;
  border-radius: 8px;
  padding: 16px;
  border: 1px solid #e8e8e8;
  position: relative;
}

.container-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
  padding-bottom: 8px;
  border-bottom: 1px solid #e8e8e8;
}

.container-title {
  font-size: 14px;
  font-weight: 600;
  color: #333;
}

.sub-section {
  margin: 16px 0;
  padding: 12px;
  background: #fff;
  border-radius: 6px;
  border: 1px solid #f0f0f0;
}

.sub-section-title {
  font-size: 14px;
  font-weight: 600;
  color: #555;
  margin-bottom: 12px;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.port-list, .env-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.port-item, .env-item {
  background: #f8f8f8;
  padding: 8px;
  border-radius: 4px;
  border: 1px solid #e8e8e8;
}

.label-item {
  margin-bottom: 8px;
}

.yaml-actions {
  margin-bottom: 16px;
  display: flex;
  justify-content: flex-end;
}

.yaml-validation-error, .yaml-validation-success {
  margin-bottom: 12px;
}

.yaml-editor-container {
  border-radius: 6px;
  overflow: hidden;
}

.yaml-textarea {
  font-family: 'JetBrains Mono', 'Courier New', monospace !important;
  font-size: 14px !important;
  line-height: 1.5 !important;
  background-color: #fafafa;
  border: 1px solid #d9d9d9;
  border-radius: 4px;
  resize: vertical;
}

.yaml-textarea:focus {
  border-color: #1890ff;
  box-shadow: 0 0 0 2px rgba(24, 144, 255, 0.2);
}

/* 容器配置样式 */
.container-config {
  background: #ffffff;
  border-radius: 10px;
  padding: 20px;
  margin-bottom: 16px;
  border: 1px solid #e5e7eb;
  position: relative;
  transition: all 0.3s ease;
}

.container-config:hover {
  border-color: #d1d5db;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.04);
}

.container-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
  padding-bottom: 12px;
  border-bottom: 1px solid #f3f4f6;
}

.container-remove-btn {
  background: #fef2f2;
  border: 1px solid #fecaca;
  color: #dc2626;
  border-radius: 6px;
  padding: 4px 8px;
  font-size: 12px;
  height: auto;
  line-height: 1.2;
}

.container-remove-btn:hover {
  background: #fee2e2;
  border-color: #fca5a5;
  color: #dc2626;
}

/* 动态项目样式 */
.port-item, .env-item {
  background: #f9fafb;
  border-radius: 8px;
  padding: 16px;
  margin-bottom: 12px;
  border: 1px solid #e5e7eb;
  position: relative;
}

.port-item:last-child, .env-item:last-child {
  margin-bottom: 0;
}

/* YAML编辑器样式 */
.yaml-actions {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
  padding: 16px;
  background: #f8fafc;
  border-radius: 8px 8px 0 0;
  border: 1px solid #e2e8f0;
  border-bottom: none;
}

.yaml-actions .ant-btn {
  border-radius: 6px;
  height: 36px;
  font-weight: 500;
  display: flex;
  align-items: center;
  gap: 6px;
}

.yaml-actions .ant-btn-primary {
  background: linear-gradient(135deg, #1677ff 0%, #4096ff 100%);
  border: none;
  box-shadow: 0 2px 6px rgba(22, 119, 255, 0.3);
}

.yaml-actions .ant-btn-primary:hover {
  background: linear-gradient(135deg, #0958d9 0%, #1677ff 100%);
  box-shadow: 0 4px 12px rgba(22, 119, 255, 0.4);
  transform: translateY(-1px);
}

.yaml-textarea {
  font-family: 'JetBrains Mono', 'SF Mono', 'Monaco', 'Inconsolata', 'Fira Code', 'Source Code Pro', monospace !important;
  font-size: 13px !important;
  line-height: 1.6 !important;
  background: #1e1e1e !important;
  color: #d4d4d4 !important;
  border: 1px solid #e2e8f0;
  border-top: none;
  border-radius: 0 0 8px 8px;
  resize: vertical;
}

.yaml-textarea::-webkit-scrollbar {
  width: 8px;
  height: 8px;
}

.yaml-textarea::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.3);
  border-radius: 4px;
}

.yaml-textarea::-webkit-scrollbar-thumb:hover {
  background: rgba(255, 255, 255, 0.5);
}

.yaml-textarea::-webkit-scrollbar-track {
  background: transparent;
}

.yaml-textarea:focus {
  border-color: #1677ff;
  box-shadow: none;
}

/* YAML验证提示 */
.yaml-validation-error, .yaml-validation-success {
  margin-bottom: 16px;
  border-radius: 8px;
}

.yaml-validation-error .ant-alert {
  border-radius: 8px;
  background: #fef2f2;
  border: 1px solid #fecaca;
}

.yaml-validation-success .ant-alert {
  border-radius: 8px;
  background: #f0f9ff;
  border: 1px solid #bfdbfe;
}

.edit-footer {
  margin-top: 24px;
  padding-top: 16px;
  border-top: 1px solid #f0f0f0;
  text-align: right;
}

/* 模态框按钮样式 */
.cluster-modal .ant-modal-footer,
.edit-modal .ant-modal-footer {
  padding: 20px 32px 24px;
  background: #fafbfc;
  border-top: 1px solid #e2e8f0;
  border-radius: 0 0 16px 16px;
}

.cluster-modal .ant-modal-footer .ant-btn,
.edit-modal .ant-modal-footer .ant-btn {
  height: 44px;
  padding: 0 24px;
  border-radius: 8px;
  font-weight: 600;
  font-size: 14px;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.cluster-modal .ant-modal-footer .ant-btn-primary,
.edit-modal .ant-modal-footer .ant-btn-primary {
  background: linear-gradient(135deg, #1677ff 0%, #4096ff 100%);
  border: none;
  color: #ffffff;
  box-shadow: 0 4px 12px rgba(22, 119, 255, 0.3);
}

.cluster-modal .ant-modal-footer .ant-btn-primary:hover,
.edit-modal .ant-modal-footer .ant-btn-primary:hover {
  background: linear-gradient(135deg, #0958d9 0%, #1677ff 100%);
  box-shadow: 0 6px 16px rgba(22, 119, 255, 0.4);
  transform: translateY(-1px);
}

.cluster-modal .ant-modal-footer .ant-btn-default,
.edit-modal .ant-modal-footer .ant-btn-default {
  background: #ffffff;
  border: 1px solid #d1d5db;
  color: #374151;
}

.cluster-modal .ant-modal-footer .ant-btn-default:hover,
.edit-modal .ant-modal-footer .ant-btn-default:hover {
  background: #f9fafb;
  border-color: #9ca3af;
  color: #1f2937;
  transform: translateY(-1px);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

/* 响应式设计 */
@media (max-width: 1200px) {
  .edit-modal {
    width: 95% !important;
    max-width: 1000px;
  }
}

@media (max-width: 768px) {
  .edit-content {
    padding: 12px;
  }
  
  .form-section {
    padding: 16px;
    margin-bottom: 12px;
  }
  
  .container-item {
    padding: 12px;
  }
  
  .sub-section {
    padding: 8px;
  }
  
  .edit-mode-switcher .ant-radio-button-wrapper {
    padding: 0 16px;
    font-size: 14px;
  }
}
</style>
