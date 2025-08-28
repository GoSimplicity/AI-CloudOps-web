<template>
  <div class="cluster-management-container secret-management-container">
    <!-- 页面头部 -->
    <div class="page-header">
      <div class="header-content">
        <div class="title-section">
          <div class="page-title">
            <SafetyOutlined class="title-icon" />
            <h1>Kubernetes Secret 管理</h1>
          </div>
          <p class="page-subtitle">管理和监控集群中的所有密钥配置资源</p>
        </div>
        <div class="header-actions">
          <a-dropdown>
            <template #overlay>
              <a-menu @click="handleCreateMenuClick">
                <a-menu-item key="generic">
                  <KeyOutlined />
                  通用密钥
                </a-menu-item>
                <a-menu-item key="tls">
                  <LockOutlined />
                  TLS 证书
                </a-menu-item>
                <a-menu-item key="docker">
                  <ContainerOutlined />
                  Docker 配置
                </a-menu-item>
              </a-menu>
            </template>
            <a-button type="primary" size="large">
              <PlusOutlined />
              创建 Secret
              <DownOutlined />
            </a-button>
          </a-dropdown>
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
          <SafetyOutlined />
        </div>
        <div class="card-info">
          <div class="card-number">{{ secrets.length }}</div>
          <div class="card-label">Secret 总数</div>
        </div>
      </div>
      
      <div class="overview-card running-clusters">
        <div class="card-icon">
          <KeyOutlined />
        </div>
        <div class="card-info">
          <div class="card-number">{{ genericSecrets }}</div>
          <div class="card-label">通用密钥</div>
        </div>
      </div>
      
      <div class="overview-card env-types">
        <div class="card-icon">
          <LockOutlined />
        </div>
        <div class="card-info">
          <div class="card-number">{{ tlsSecrets }}</div>
          <div class="card-label">TLS 证书</div>
        </div>
      </div>
      
      <div class="overview-card resource-usage">
        <div class="card-icon">
          <ContainerOutlined />
        </div>
        <div class="card-info">
          <div class="card-number">{{ dockerSecrets }}</div>
          <div class="card-label">Docker 配置</div>
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
          v-model:value="typeFilter"
          placeholder="类型筛选"
          class="env-filter"
          allow-clear
          @change="handleFilterChange"
        >
          <template #suffixIcon><FilterOutlined /></template>
          <a-select-option value="Opaque">通用</a-select-option>
          <a-select-option value="kubernetes.io/tls">TLS</a-select-option>
          <a-select-option value="kubernetes.io/dockerconfigjson">Docker配置</a-select-option>
          <a-select-option value="kubernetes.io/service-account-token">服务账户令牌</a-select-option>
        </a-select>
        
        <a-input-search
          v-model:value="searchText"
          placeholder="搜索 Secret 名称"
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
          @click="handleBatchCopy" 
          :disabled="!selectedRows.length"
          v-if="selectedRows.length > 0"
        >
          <template #icon><CopyOutlined /></template>
          复制 ({{ selectedRows.length }})
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
      <div class="display-header" v-if="filteredSecrets.length > 0">
        <div class="result-info">
          <span class="result-count">共 {{ filteredSecrets.length }} 个Secret</span>
          <div class="env-tags">
            <a-tag color="green">通用 {{ genericSecrets }}</a-tag>
            <a-tag color="blue">TLS {{ tlsSecrets }}</a-tag>
            <a-tag color="orange">Docker {{ dockerSecrets }}</a-tag>
          </div>
        </div>
      </div>

      <!-- 表格视图 -->
      <a-table
        v-if="viewMode === 'table'"
        :columns="columns"
        :data-source="filteredSecrets"
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
        class="cluster-table secrets-table"
      >
        <!-- Secret 名称列 -->
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'name'">
            <div class="cluster-name secret-name">
              <component :is="getSecretTypeIcon(record.type)" class="secret-icon" />
              <span>{{ record.name }}</span>
            </div>
          </template>

          <!-- 命名空间列 -->
          <template v-else-if="column.key === 'namespace'">
            <a-tag color="blue" size="small">
              <AppstoreOutlined style="margin-right: 4px;" />
              {{ record.namespace }}
            </a-tag>
          </template>

          <!-- 类型列 -->
          <template v-else-if="column.key === 'type'">
            <a-tag :color="getSecretTypeColor(record.type)" size="small">
              <component :is="getSecretTypeIcon(record.type)" style="margin-right: 4px;" />
              {{ getSecretTypeLabel(record.type) }}
            </a-tag>
          </template>

          <!-- 数据键数列 -->
          <template v-else-if="column.key === 'data_count'">
            <a-badge 
              :count="record.data_count || 0" 
              :number-style="{ backgroundColor: '#52c41a' }"
              show-zero
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

              <a-tooltip title="使用情况">
                <a-button type="primary" ghost shape="circle" size="small" @click="viewUsage(record)">
                  <template #icon><LinkOutlined /></template>
                </a-button>
              </a-tooltip>

              <a-tooltip title="查看YAML">
                <a-button type="primary" ghost shape="circle" size="small" @click="viewYaml(record)">
                  <template #icon><FileTextOutlined /></template>
                </a-button>
              </a-tooltip>

              <a-tooltip title="复制">
                <a-button type="primary" ghost shape="circle" size="small" @click="copySecret(record)">
                  <template #icon><CopyOutlined /></template>
                </a-button>
              </a-tooltip>

              <a-tooltip title="编辑">
                <a-button type="primary" ghost shape="circle" size="small" @click="editSecret(record)">
                  <template #icon><EditOutlined /></template>
                </a-button>
              </a-tooltip>
              
              <a-tooltip title="删除">
                <a-popconfirm
                  title="确定要删除该Secret吗?"
                  description="删除Secret可能影响依赖它的应用，此操作不可撤销！"
                  @confirm="deleteSecret(record)"
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
        </template>

        <!-- 空状态 -->
        <template #emptyText>
          <div class="empty-state">
            <SafetyOutlined style="font-size: 48px; color: #d9d9d9; margin-bottom: 16px" />
            <p>暂无Secret数据</p>
            <a-button type="primary" @click="refreshData">刷新数据</a-button>
          </div>
        </template>
      </a-table>

      <!-- 卡片视图 -->
      <div v-else class="card-view">
        <a-spin :spinning="loading">
          <a-empty v-if="filteredSecrets.length === 0" description="暂无Secret数据">
            <template #image>
              <SafetyOutlined style="font-size: 64px; color: #d9d9d9;" />
            </template>
            <template #description>
              <span style="color: #999;">暂无Secret数据</span>
            </template>
            <a-button type="primary" @click="refreshData">刷新数据</a-button>
          </a-empty>
          <div v-else class="cluster-cards secret-cards">
            <a-checkbox-group v-model:value="selectedCardIds" class="card-checkbox-group">
              <div v-for="secret in filteredSecrets" :key="secret.uid" class="cluster-card secret-card">
                <div class="card-header">
                  <a-checkbox :value="secret.uid" class="card-checkbox" />
                  <div class="service-title secret-title">
                    <component :is="getSecretTypeIcon(secret.type)" class="service-icon" />
                    <h3>{{ secret.name }}</h3>
                  </div>
                  <a-tag :color="getSecretTypeColor(secret.type)" size="small" class="card-badge">
                    {{ getSecretTypeLabel(secret.type) }}
                  </a-tag>
                </div>
                
                <div class="card-content">
                  <div class="card-detail">
                    <span class="detail-label">命名空间:</span>
                    <span class="detail-value">
                      <a-tag color="blue" size="small">
                        <AppstoreOutlined style="margin-right: 4px;" />
                        {{ secret.namespace }}
                      </a-tag>
                    </span>
                  </div>
                  <div class="card-detail">
                    <span class="detail-label">数据键数:</span>
                    <span class="detail-value">
                      <a-badge 
                        :count="secret.data_count || 0" 
                        :number-style="{ backgroundColor: '#52c41a' }"
                        show-zero
                        style="margin-right: 8px"
                      />
                      {{ secret.data_count || 0 }} 个
                    </span>
                  </div>
                  <div class="card-detail">
                    <span class="detail-label">创建时间:</span>
                    <span class="detail-value">
                      <ClockCircleOutlined />
                      {{ formatDate(secret.creation_timestamp) }}
                    </span>
                  </div>
                </div>
                
                <div class="card-footer card-action-footer">
                  <a-button type="primary" ghost size="small" @click="viewDetails(secret)">
                    <template #icon><EyeOutlined /></template>
                    详情
                  </a-button>
                  <a-button type="primary" ghost size="small" @click="viewUsage(secret)">
                    <template #icon><LinkOutlined /></template>
                    使用情况
                  </a-button>
                  <a-button type="primary" ghost size="small" @click="viewYaml(secret)">
                    <template #icon><FileTextOutlined /></template>
                    YAML
                  </a-button>
                  <a-popconfirm
                    title="确定要删除该Secret吗?"
                    @confirm="deleteSecret(secret)"
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

    <!-- 创建通用密钥模态框 -->
    <a-modal
      v-model:open="createModalVisible"
      title="创建通用密钥"
      @ok="handleCreateSecret"
      @cancel="handleCreateCancel"
      :confirmLoading="loading"
      class="cluster-modal secret-modal"
      width="800px"
    >
      <a-alert class="modal-alert" type="info" show-icon>
        <template #message>创建通用密钥</template>
        <template #description>密钥用于存储敏感信息，如密码、OAuth令牌、SSH密钥等</template>
      </a-alert>

      <a-form :model="createForm" layout="vertical" class="cluster-form secret-form">
        <a-form-item
          label="密钥名称"
          name="name"
          :rules="[
            { required: true, message: '请输入密钥名称' },
            { pattern: /^[a-z0-9]([-a-z0-9]*[a-z0-9])?$/, message: '名称只能包含小写字母、数字和连字符，且不能以连字符开头或结尾' }
          ]"
        >
          <a-input
            v-model:value="createForm.name"
            placeholder="请输入密钥名称"
            class="form-input"
          >
            <template #prefix><SafetyOutlined /></template>
          </a-input>
        </a-form-item>

        <a-form-item label="数据键值对">
          <div class="key-value-inputs">
            <div v-for="(entry, index) in createForm.dataEntries" :key="index" class="key-value-row">
              <a-input
                v-model:value="entry.key"
                placeholder="键名"
                style="width: 35%"
                class="form-input"
              />
              <a-input
                v-model:value="entry.value"
                placeholder="键值"
                style="width: 35%"
                type="password"
                class="form-input"
              />
              <a-button
                v-if="createForm.dataEntries.length > 1"
                type="text"
                danger
                @click="removeDataEntry(index)"
                style="width: 25%"
              >
                删除
              </a-button>
              <a-button
                v-else
                type="text"
                @click="addDataEntry"
                style="width: 25%"
              >
                添加
              </a-button>
            </div>
            <a-button
              v-if="createForm.dataEntries.length > 1"
              type="dashed"
              @click="addDataEntry"
              style="width: 100%; margin-top: 8px"
            >
              <template #icon><PlusOutlined /></template>
              添加数据键值对
            </a-button>
          </div>
        </a-form-item>
      </a-form>
    </a-modal>

    <!-- 创建TLS证书模态框 -->
    <a-modal
      v-model:open="tlsModalVisible"
      title="创建TLS证书"
      @ok="handleCreateTLS"
      @cancel="handleTLSCancel"
      :confirmLoading="loading"
      class="cluster-modal tls-modal"
      width="800px"
    >
      <a-alert class="modal-alert" type="info" show-icon>
        <template #message>创建TLS证书密钥</template>
        <template #description>用于存储TLS证书和私钥</template>
      </a-alert>

      <a-form :model="tlsForm" layout="vertical" class="cluster-form tls-form">
        <a-form-item
          label="密钥名称"
          name="name"
          :rules="[
            { required: true, message: '请输入密钥名称' },
            { pattern: /^[a-z0-9]([-a-z0-9]*[a-z0-9])?$/, message: '名称只能包含小写字母、数字和连字符' }
          ]"
        >
          <a-input v-model:value="tlsForm.name" placeholder="请输入密钥名称" class="form-input">
            <template #prefix><LockOutlined /></template>
          </a-input>
        </a-form-item>

        <a-form-item label="证书内容" :rules="[{ required: true, message: '请输入证书内容' }]">
          <a-textarea
            v-model:value="tlsForm.cert_file"
            placeholder="-----BEGIN CERTIFICATE-----&#10;...&#10;-----END CERTIFICATE-----"
            :rows="6"
            class="form-input"
          />
        </a-form-item>

        <a-form-item label="私钥内容" :rules="[{ required: true, message: '请输入私钥内容' }]">
          <a-textarea
            v-model:value="tlsForm.key_file"
            placeholder="-----BEGIN PRIVATE KEY-----&#10;...&#10;-----END PRIVATE KEY-----"
            :rows="6"
            class="form-input"
          />
        </a-form-item>
      </a-form>
    </a-modal>

    <!-- 创建Docker配置模态框 -->
    <a-modal
      v-model:open="dockerModalVisible"
      title="创建Docker配置"
      @ok="handleCreateDocker"
      @cancel="handleDockerCancel"
      :confirmLoading="loading"
      class="cluster-modal docker-modal"
      width="800px"
    >
      <a-alert class="modal-alert" type="info" show-icon>
        <template #message>创建Docker配置密钥</template>
        <template #description>用于存储Docker镜像仓库的认证信息</template>
      </a-alert>

      <a-form :model="dockerForm" layout="vertical" class="cluster-form docker-form">
        <a-form-item
          label="密钥名称"
          name="name"
          :rules="[{ required: true, message: '请输入密钥名称' }]"
        >
          <a-input v-model:value="dockerForm.name" placeholder="请输入密钥名称" class="form-input">
            <template #prefix><ContainerOutlined /></template>
          </a-input>
        </a-form-item>

        <a-form-item label="镜像仓库地址" :rules="[{ required: true, message: '请输入镜像仓库地址' }]">
          <a-input v-model:value="dockerForm.registry_url" placeholder="如: docker.io" class="form-input" />
        </a-form-item>

        <a-form-item label="用户名" :rules="[{ required: true, message: '请输入用户名' }]">
          <a-input v-model:value="dockerForm.username" placeholder="请输入用户名" class="form-input" />
        </a-form-item>

        <a-form-item label="密码" :rules="[{ required: true, message: '请输入密码' }]">
          <a-input
            v-model:value="dockerForm.password"
            placeholder="请输入密码"
            type="password"
            class="form-input"
          />
        </a-form-item>

        <a-form-item label="邮箱 (可选)">
          <a-input v-model:value="dockerForm.email" placeholder="请输入邮箱" class="form-input" />
        </a-form-item>
      </a-form>
    </a-modal>

    <!-- 密钥详情模态框 -->
    <a-modal
      v-model:open="detailsModalVisible"
      title="密钥详情"
      width="900px"
      :footer="null"
      class="cluster-modal secret-detail-modal"
    >
      <div v-if="currentSecret" class="secret-details">
        <a-alert class="modal-alert" type="info" show-icon>
          <template #message>{{ currentSecret.name }}</template>
          <template #description>
            类型: {{ getSecretTypeLabel(currentSecret.type) }} | 
            命名空间: {{ currentSecret.namespace }} | 
            创建时间: {{ formatDateTime(currentSecret.creation_timestamp) }}
          </template>
        </a-alert>

        <a-tabs default-active-key="1">
          <a-tab-pane key="1" tab="基本信息">
            <div class="details-grid">
              <div class="detail-card">
                <h4><SafetyOutlined /> 基本信息</h4>
                <div class="detail-item">
                  <div class="detail-label">名称:</div>
                  <div class="detail-value">{{ currentSecret.name }}</div>
                </div>
                <div class="detail-item">
                  <div class="detail-label">命名空间:</div>
                  <div class="detail-value">{{ currentSecret.namespace }}</div>
                </div>
                <div class="detail-item">
                  <div class="detail-label">类型:</div>
                  <div class="detail-value">
                    <a-tag :color="getSecretTypeColor(currentSecret.type)">
                      <component :is="getSecretTypeIcon(currentSecret.type)" style="margin-right: 4px;" />
                      {{ getSecretTypeLabel(currentSecret.type) }}
                    </a-tag>
                  </div>
                </div>
                <div class="detail-item">
                  <div class="detail-label">数据键数:</div>
                  <div class="detail-value">{{ currentSecret.data_count || 0 }} 个</div>
                </div>
                <div class="detail-item">
                  <div class="detail-label">创建时间:</div>
                  <div class="detail-value">{{ formatDateTime(currentSecret.creation_timestamp) }}</div>
                </div>
                <div class="detail-item">
                  <div class="detail-label">UID:</div>
                  <div class="detail-value">{{ currentSecret.uid }}</div>
                </div>
              </div>
            </div>
          </a-tab-pane>

          <a-tab-pane key="2" tab="数据键" @click="loadSecretDetails">
            <div class="data-keys-container">
              <a-spin :spinning="detailsLoading">
                <div v-if="secretDetails" class="data-keys-list">
                  <div v-for="(value, key) in secretDetails.data" :key="key" class="data-key-item">
                    <div class="key-header">
                      <span class="key-name">{{ key }}</span>
                      <a-button 
                        type="text" 
                        size="small" 
                        @click="toggleDataValue(String(key))"
                      >
                        <template #icon>
                          <EyeInvisibleOutlined v-if="showDataValues[key]" />
                          <EyeOutlined v-else />
                        </template>
                        {{ showDataValues[key] ? '隐藏' : '显示' }}
                      </a-button>
                    </div>
                    <div v-if="showDataValues[key]" class="key-value">
                      <a-input 
                        :value="value"
                        readonly
                        type="textarea"
                        :rows="3"
                      />
                    </div>
                    <div v-else class="key-value-hidden">
                      <span>*** 已隐藏 ***</span>
                    </div>
                  </div>
                </div>
                <a-empty v-else description="暂无数据键" />
              </a-spin>
            </div>
          </a-tab-pane>
        </a-tabs>

        <div class="modal-footer">
          <a-space>
            <a-button @click="detailsModalVisible = false">关闭</a-button>
            <a-button type="primary" ghost @click="viewUsage(currentSecret)">
              <template #icon><LinkOutlined /></template>
              使用情况
            </a-button>
            <a-button type="primary" ghost @click="viewYaml(currentSecret)">
              <template #icon><FileTextOutlined /></template>
              查看YAML
            </a-button>
            <a-button type="primary" ghost @click="editSecret(currentSecret)">
              <template #icon><EditOutlined /></template>
              编辑
            </a-button>
          </a-space>
        </div>
      </div>
    </a-modal>

    <!-- 使用情况模态框 -->
    <a-modal
      v-model:open="usageModalVisible"
      title="密钥使用情况"
      width="800px"
      :footer="null"
      class="cluster-modal usage-modal"
    >
      <div v-if="currentSecret" class="usage-content">
        <a-alert class="modal-alert" type="info" show-icon>
          <template #message>{{ currentSecret.name }} 使用情况</template>
          <template #description>该密钥正在被以下资源使用</template>
        </a-alert>

        <a-spin :spinning="usageLoading">
          <a-table
            v-if="secretUsage && secretUsage.length"
            :columns="[
              { title: '资源类型', dataIndex: 'resource_type', key: 'resource_type', width: '20%' },
              { title: '资源名称', dataIndex: 'resource_name', key: 'resource_name', width: '30%' },
              { title: '命名空间', dataIndex: 'namespace', key: 'namespace', width: '20%' },
              { title: '使用方式', dataIndex: 'usage_type', key: 'usage_type', width: '30%' }
            ]"
            :data-source="secretUsage"
            :pagination="false"
            row-key="resource_name"
          />
          <a-empty v-else description="该密钥当前未被使用" />
        </a-spin>
      </div>
    </a-modal>

    <!-- YAML 查看模态框 -->
    <a-modal
      v-model:open="yamlModalVisible"
      title="YAML 配置"
      width="900px"
      :footer="null"
      class="cluster-modal yaml-modal"
    >
      <div v-if="currentSecret" class="yaml-content">
        <a-alert class="modal-alert" type="info" show-icon>
          <template #message>{{ currentSecret.name }} YAML配置</template>
          <template #description>查看密钥的YAML配置文件</template>
        </a-alert>

        <a-spin :spinning="yamlLoading">
          <div class="yaml-editor-container">
            <pre><code class="yaml-code">{{ secretYaml }}</code></pre>
          </div>
        </a-spin>
      </div>
    </a-modal>
  </div>
</template>

<script lang="ts" setup>
import { ref, computed, onMounted, watch } from 'vue';
import { message } from 'ant-design-vue';
import {
  getSecretListApi,
  getSecretDetailApi,
  createSecretApi,
  deleteSecretApi,
  batchDeleteSecretApi,
  getSecretUsageApi,
  createDockerConfigSecretApi,
  getSecretYamlApi,
  copySecretApi,
  getAllClustersApi,
  getNamespacesByClusterIdApi,
} from '#/api';
import type { 
  SecretInfo, 
  SecretListReq,
  SecretCreateReq,
  DockerConfigSecretReq
} from '#/api';
import { 
  CloudServerOutlined, 
  TableOutlined, 
  AppstoreOutlined, 
  ReloadOutlined,
  DeleteOutlined,
  SafetyOutlined,
  ClockCircleOutlined,
  KeyOutlined,
  LockOutlined,
  ContainerOutlined,
  CopyOutlined,
  ClusterOutlined,
  PartitionOutlined,
  PlusOutlined,
  DownOutlined,
  EditOutlined,
  EyeOutlined,
  EyeInvisibleOutlined,
  LinkOutlined,
  FilterOutlined,
  FileTextOutlined
} from '@ant-design/icons-vue';

// 状态变量
const loading = ref(false);
const clustersLoading = ref(false);
const namespacesLoading = ref(false);
const detailsLoading = ref(false);
const usageLoading = ref(false);
const yamlLoading = ref(false);
const secrets = ref<SecretInfo[]>([]);
const searchText = ref('');
const typeFilter = ref<string>();
const selectedRows = ref<SecretInfo[]>([]);
const namespaces = ref<string[]>(['default']);
const selectedNamespace = ref<string>('default');
const clusters = ref<Array<{id: number, name: string}>>([]);
const selectedCluster = ref<number>();
const viewMode = ref<'table' | 'card'>('table');
const selectedCardIds = ref<string[]>([]);
const currentPage = ref(1);
const pageSize = ref(12);
const totalItems = ref(0);

// 模态框状态
const createModalVisible = ref(false);
const tlsModalVisible = ref(false);
const dockerModalVisible = ref(false);
const detailsModalVisible = ref(false);
const usageModalVisible = ref(false);
const yamlModalVisible = ref(false);

// 当前操作的Secret
const currentSecret = ref<SecretInfo | null>(null);
const secretDetails = ref<any>(null);
const secretUsage = ref<any[]>([]);
const secretYaml = ref('');
const showDataValues = ref<Record<string, boolean>>({});

// 表单数据
const createForm = ref<{
  name: string;
  dataEntries: Array<{ key: string; value: string }>;
}>({
  name: '',
  dataEntries: [{ key: '', value: '' }]
});

const tlsForm = ref<{
  name: string;
  cert_file: string;
  key_file: string;
}>({
  name: '',
  cert_file: '',
  key_file: ''
});

const dockerForm = ref<{
  name: string;
  registry_url: string;
  username: string;
  password: string;
  email: string;
}>({
  name: '',
  registry_url: '',
  username: '',
  password: '',
  email: ''
});

// 根据卡片选择更新 selectedRows
watch(selectedCardIds, (newValue) => {
  selectedRows.value = secrets.value.filter(secret => 
    newValue.includes(secret.uid)
  );
});

// 表格列配置
const columns = [
  {
    title: 'Secret 名称',
    dataIndex: 'name',
    key: 'name',
    width: '20%',
    sorter: (a: SecretInfo, b: SecretInfo) => a.name.localeCompare(b.name),
  },
  {
    title: '命名空间',
    dataIndex: 'namespace',
    key: 'namespace',
    width: '15%',
    sorter: (a: SecretInfo, b: SecretInfo) => a.namespace.localeCompare(b.namespace),
  },
  {
    title: '类型',
    dataIndex: 'type',
    key: 'type',
    width: '20%',
    sorter: (a: SecretInfo, b: SecretInfo) => a.type.localeCompare(b.type),
  },
  {
    title: '数据键数',
    dataIndex: 'data_count',
    key: 'data_count',
    width: '10%',
    sorter: (a: SecretInfo, b: SecretInfo) => (a.data_count || 0) - (b.data_count || 0),
  },
  {
    title: '创建时间',
    dataIndex: 'creation_timestamp',
    key: 'creationTimestamp',
    width: '20%',
    sorter: (a: SecretInfo, b: SecretInfo) => new Date(a.creation_timestamp).getTime() - new Date(b.creation_timestamp).getTime(),
  },
  {
    title: '操作',
    key: 'action',
    width: '15%',
    fixed: 'right',
  },
];

// 计算属性
const filteredSecrets = computed(() => {
  let result = secrets.value;
  
  if (typeFilter.value) {
    result = result.filter(secret => secret.type === typeFilter.value);
  }
  
  const searchValue = searchText.value.toLowerCase().trim();
  if (searchValue) {
    result = result.filter(secret => 
      secret.name.toLowerCase().includes(searchValue)
    );
  }
  
  return result;
});

const genericSecrets = computed(() => 
  secrets.value.filter(s => s.type === 'Opaque').length
);

const tlsSecrets = computed(() => 
  secrets.value.filter(s => s.type === 'kubernetes.io/tls').length
);

const dockerSecrets = computed(() => 
  secrets.value.filter(s => s.type === 'kubernetes.io/dockerconfigjson').length
);

// 表格选择配置
const rowSelection = {
  onChange: (_: string[], selectedRowsData: SecretInfo[]) => {
    selectedRows.value = selectedRowsData;
    selectedCardIds.value = selectedRowsData.map(row => row.uid);
  },
  getCheckboxProps: () => ({
    disabled: false,
  }),
};

// 工具函数
const getSecretTypeColor = (type: string) => {
  const typeColors: Record<string, string> = {
    'Opaque': 'blue',
    'kubernetes.io/tls': 'green',
    'kubernetes.io/dockerconfigjson': 'orange',
    'kubernetes.io/service-account-token': 'purple',
  };
  return typeColors[type] || 'default';
};

const getSecretTypeIcon = (type: string) => {
  const typeIcons: Record<string, any> = {
    'Opaque': KeyOutlined,
    'kubernetes.io/tls': LockOutlined,
    'kubernetes.io/dockerconfigjson': ContainerOutlined,
    'kubernetes.io/service-account-token': SafetyOutlined,
  };
  return typeIcons[type] || KeyOutlined;
};

const getSecretTypeLabel = (type: string) => {
  const typeLabels: Record<string, string> = {
    'Opaque': '通用',
    'kubernetes.io/tls': 'TLS',
    'kubernetes.io/dockerconfigjson': 'Docker配置',
    'kubernetes.io/service-account-token': '服务账户令牌',
  };
  return typeLabels[type] || type;
};

// 格式化日期
const formatDate = (dateString: string) => {
  if (!dateString) return '-';
  const date = new Date(dateString);
  return `${date.getMonth() + 1}月${date.getDate()}日 ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
};

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
        await getSecrets(1, pageSize.value);
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

// 获取Secret列表
const getSecrets = async (page = 1, size = pageSize.value) => {
  if (!selectedCluster.value || !selectedNamespace.value) {
    message.warning('请先选择集群和命名空间');
    return;
  }
  
  loading.value = true;
  try {
    const params: SecretListReq = {
      cluster_id: selectedCluster.value,
      namespace: selectedNamespace.value,
      page,
      page_size: size,
      type: typeFilter.value
    };
    
    const res = await getSecretListApi(params);
    secrets.value = res || [];
    totalItems.value = secrets.value.length;
    currentPage.value = page;
    selectedRows.value = [];
    selectedCardIds.value = [];
  } catch (error: any) {
    message.error(error.message || '获取Secret列表失败');
    secrets.value = [];
    totalItems.value = 0;
  } finally {
    loading.value = false;
  }
};

// 刷新数据
const refreshData = () => {
  getSecrets(currentPage.value, pageSize.value);
};

// 搜索
const onSearch = () => {
  // 搜索逻辑已经在计算属性中实现
};

// 筛选处理
const handleFilterChange = () => {
  currentPage.value = 1;
  getSecrets(1, pageSize.value);
};

// 创建菜单点击处理
const handleCreateMenuClick = ({ key }: { key: string }) => {
  switch (key) {
    case 'generic':
      createForm.value = {
        name: '',
        dataEntries: [{ key: '', value: '' }]
      };
      createModalVisible.value = true;
      break;
    case 'tls':
      tlsForm.value = {
        name: '',
        cert_file: '',
        key_file: ''
      };
      tlsModalVisible.value = true;
      break;
    case 'docker':
      dockerForm.value = {
        name: '',
        registry_url: '',
        username: '',
        password: '',
        email: ''
      };
      dockerModalVisible.value = true;
      break;
  }
};

// 批量复制
const handleBatchCopy = async () => {
  message.info('批量复制功能开发中...');
};

// 批量删除Secret
const handleBatchDelete = async () => {
  if (!selectedRows.value.length || !selectedCluster.value) return;
  
  try {
    loading.value = true;
    await batchDeleteSecretApi({
      cluster_id: selectedCluster.value,
      namespace: selectedNamespace.value,
      names: selectedRows.value.map(s => s.name)
    });
    
    message.success(`成功删除 ${selectedRows.value.length} 个Secret`);
    selectedRows.value = [];
    selectedCardIds.value = [];
    getSecrets(currentPage.value, pageSize.value);
  } catch (error: any) {
    message.error(error.message || '批量删除失败');
  } finally {
    loading.value = false;
  }
};

// 切换命名空间
const handleNamespaceChange = () => {
  currentPage.value = 1;
  getSecrets(1, pageSize.value);
};

// 切换集群
const handleClusterChange = () => {
  selectedNamespace.value = 'default';
  secrets.value = [];
  currentPage.value = 1;
  totalItems.value = 0;
  getNamespaces();
  getSecrets(1, pageSize.value);
};

// 分页处理
const handleTableChange = (pagination: any) => {
  currentPage.value = pagination.current;
  pageSize.value = pagination.pageSize;
  getSecrets(pagination.current, pagination.pageSize);
};

// 表单处理函数
const addDataEntry = () => {
  createForm.value.dataEntries.push({ key: '', value: '' });
};

const removeDataEntry = (index: number) => {
  createForm.value.dataEntries.splice(index, 1);
};

// 创建通用密钥
const handleCreateSecret = async () => {
  if (!selectedCluster.value || !selectedNamespace.value) {
    message.warning('请先选择集群和命名空间');
    return;
  }

  try {
    loading.value = true;
    const data: Record<string, string> = {};
    createForm.value.dataEntries.forEach(entry => {
      if (entry.key && entry.value) {
        data[entry.key] = btoa(entry.value); // Base64编码
      }
    });

    const params: SecretCreateReq = {
      cluster_id: selectedCluster.value,
      namespace: selectedNamespace.value,
      name: createForm.value.name,
      type: 'Opaque',
      data
    };

    await createSecretApi(params);
    message.success('通用密钥创建成功');
    createModalVisible.value = false;
    getSecrets(currentPage.value, pageSize.value);
  } catch (error: any) {
    message.error(error.message || '创建密钥失败');
  } finally {
    loading.value = false;
  }
};

const handleCreateCancel = () => {
  createModalVisible.value = false;
  createForm.value = {
    name: '',
    dataEntries: [{ key: '', value: '' }]
  };
};

// 创建TLS证书
const handleCreateTLS = async () => {
  if (!selectedCluster.value || !selectedNamespace.value) {
    message.warning('请先选择集群和命名空间');
    return;
  }

  try {
    loading.value = true;
    // 简化实现：创建通用密钥存储TLS证书数据
    const data: Record<string, string> = {
      'tls.crt': btoa(tlsForm.value.cert_file),
      'tls.key': btoa(tlsForm.value.key_file)
    };

    const params: SecretCreateReq = {
      cluster_id: selectedCluster.value,
      namespace: selectedNamespace.value,
      name: tlsForm.value.name,
      type: 'kubernetes.io/tls',
      data
    };

    await createSecretApi(params);
    message.success('TLS证书创建成功');
    tlsModalVisible.value = false;
    getSecrets(currentPage.value, pageSize.value);
  } catch (error: any) {
    message.error(error.message || '创建TLS证书失败');
  } finally {
    loading.value = false;
  }
};

const handleTLSCancel = () => {
  tlsModalVisible.value = false;
  tlsForm.value = {
    name: '',
    cert_file: '',
    key_file: ''
  };
};

// 创建Docker配置
const handleCreateDocker = async () => {
  if (!selectedCluster.value || !selectedNamespace.value) {
    message.warning('请先选择集群和命名空间');
    return;
  }

  try {
    loading.value = true;
    const params: DockerConfigSecretReq = {
      cluster_id: selectedCluster.value,
      namespace: selectedNamespace.value,
      name: dockerForm.value.name,
      registry_url: dockerForm.value.registry_url,
      username: dockerForm.value.username,
      password: dockerForm.value.password,
      email: dockerForm.value.email
    };

    await createDockerConfigSecretApi(params);
    message.success('Docker配置创建成功');
    dockerModalVisible.value = false;
    getSecrets(currentPage.value, pageSize.value);
  } catch (error: any) {
    message.error(error.message || '创建Docker配置失败');
  } finally {
    loading.value = false;
  }
};

const handleDockerCancel = () => {
  dockerModalVisible.value = false;
  dockerForm.value = {
    name: '',
    registry_url: '',
    username: '',
    password: '',
    email: ''
  };
};

// 查看详情
const viewDetails = async (secret: SecretInfo) => {
  currentSecret.value = secret;
  detailsModalVisible.value = true;
};

// 加载密钥详细数据
const loadSecretDetails = async () => {
  if (!currentSecret.value || !selectedCluster.value) return;

  try {
    detailsLoading.value = true;
    const details = await getSecretDetailApi(selectedCluster.value, currentSecret.value.namespace, currentSecret.value.name);
    secretDetails.value = details;
    showDataValues.value = {};
  } catch (error: any) {
    message.error(error.message || '获取密钥详情失败');
  } finally {
    detailsLoading.value = false;
  }
};

// 切换数据键的显示/隐藏
const toggleDataValue = (key: string) => {
  showDataValues.value[key] = !showDataValues.value[key];
};

// 查看使用情况
const viewUsage = async (secret: SecretInfo) => {
  if (!selectedCluster.value) return;

  try {
    currentSecret.value = secret;
    usageLoading.value = true;
    const usage = await getSecretUsageApi(selectedCluster.value, secret.namespace, secret.name);
    // 转换 SecretUsageInfo 为表格数据格式
    const usageData = [];
    if (usage?.pods?.length) {
      usageData.push(...usage.pods.map(pod => ({
        resource_type: 'Pod',
        resource_name: pod,
        namespace: secret.namespace,
        usage_type: 'Volume/Env'
      })));
    }
    if (usage?.deployments?.length) {
      usageData.push(...usage.deployments.map(deployment => ({
        resource_type: 'Deployment',
        resource_name: deployment,
        namespace: secret.namespace,
        usage_type: 'Template'
      })));
    }
    if (usage?.services?.length) {
      usageData.push(...usage.services.map(service => ({
        resource_type: 'Service',
        resource_name: service,
        namespace: secret.namespace,
        usage_type: 'TLS'
      })));
    }
    if (usage?.ingresses?.length) {
      usageData.push(...usage.ingresses.map(ingress => ({
        resource_type: 'Ingress',
        resource_name: ingress,
        namespace: secret.namespace,
        usage_type: 'TLS'
      })));
    }
    secretUsage.value = usageData;
    usageModalVisible.value = true;
  } catch (error: any) {
    message.error(error.message || '获取使用情况失败');
  } finally {
    usageLoading.value = false;
  }
};

// 查看YAML
const viewYaml = async (secret: SecretInfo) => {
  if (!selectedCluster.value) return;

  try {
    currentSecret.value = secret;
    yamlLoading.value = true;
    const yaml = await getSecretYamlApi(selectedCluster.value, secret.namespace, secret.name);
    secretYaml.value = yaml || '';
    yamlModalVisible.value = true;
  } catch (error: any) {
    message.error(error.message || '获取YAML失败');
  } finally {
    yamlLoading.value = false;
  }
};

// 复制密钥
const copySecret = async (secret: SecretInfo) => {
  if (!selectedCluster.value) return;

  try {
    loading.value = true;
    await copySecretApi(
      selectedCluster.value,
      secret.namespace,
      selectedNamespace.value,
      secret.name,
      `${secret.name}-copy`
    );
    message.success('密钥复制成功');
    getSecrets(currentPage.value, pageSize.value);
  } catch (error: any) {
    message.error(error.message || '复制密钥失败');
  } finally {
    loading.value = false;
  }
};

// 编辑密钥
const editSecret = (_: SecretInfo) => {
  message.info('编辑功能开发中...');
};

// 删除密钥
const deleteSecret = async (secret: SecretInfo) => {
  if (!selectedCluster.value) return;

  try {
    loading.value = true;
    await deleteSecretApi({
      cluster_id: selectedCluster.value,
      namespace: secret.namespace,
      name: secret.name
    });
    message.success('密钥删除成功');
    getSecrets(currentPage.value, pageSize.value);
  } catch (error: any) {
    message.error(error.message || '删除密钥失败');
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
/* 继承现有样式系统 */

.secret-name {
  display: flex;
  align-items: center;
  gap: 10px;
  font-weight: 500;
}

.secret-icon {
  color: #faad14;
  font-size: 12px;
}

.secret-cards {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(380px, 1fr));
  gap: 20px;
  padding: 20px 0;
}

.secret-card {
  border: 1px solid #d9d9d9;
  border-radius: 8px;
  padding: 16px;
  background: #fff;
  transition: all 0.3s ease;
}

.secret-card:hover {
  border-color: #1890ff;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

.data-keys-container {
  padding: 16px 0;
}

.data-keys-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.data-key-item {
  border: 1px solid #f0f0f0;
  border-radius: 6px;
  padding: 12px;
  background: #fafafa;
}

.key-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.key-name {
  font-weight: 500;
  color: #1890ff;
}

.key-value {
  margin-top: 8px;
}

.key-value-hidden {
  color: #999;
  font-style: italic;
  padding: 8px 0;
}

.yaml-editor-container {
  background: #f6f8fa;
  border: 1px solid #d9d9d9;
  border-radius: 6px;
  padding: 16px;
  max-height: 500px;
  overflow-y: auto;
}

.yaml-code {
  font-family: 'Monaco', 'Consolas', 'Courier New', monospace;
  font-size: 12px;
  line-height: 1.5;
  white-space: pre-wrap;
  margin: 0;
  color: #24292e;
}

.secret-detail-modal .ant-tabs-content-holder {
  min-height: 300px;
}

.secret-management-container .overview-cards {
  grid-template-columns: repeat(4, 1fr);
}

.secret-management-container .overview-card {
  min-height: 120px;
}

.namespace-selector,
.cluster-selector {
  width: 200px;
}

.key-value-inputs {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.key-value-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.secret-title {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 1;
}

.secret-title h3 {
  margin: 0;
  font-size: 16px;
  font-weight: 500;
}
</style>
