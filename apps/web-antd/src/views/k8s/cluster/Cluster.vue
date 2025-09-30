<template>
  <div class="k8s-management-container">
    <!-- 页面头部 -->
    <div class="k8s-page-header">
      <a-row class="k8s-header-content" :gutter="[24, 16]">
        <a-col :xs="24" :sm="24" :md="16" :lg="16" :xl="18">
          <div class="k8s-title-section">
            <div class="k8s-page-title">
              <DeploymentUnitOutlined class="k8s-title-icon" />
              <div>
                <h1>集群管理</h1>
                <p class="k8s-page-subtitle">管理和监控集群中的所有 Kubernetes 集群</p>
              </div>
            </div>
          </div>
        </a-col>
        <a-col :xs="24" :sm="24" :md="8" :lg="8" :xl="6">
          <div class="k8s-header-actions">
            <a-button type="primary" @click="openCreate">
              <template #icon><PlusOutlined /></template>
              新建集群
            </a-button>
            <a-button @click="fetchClusters" :loading="loading">
              <template #icon><ReloadOutlined /></template>
              刷新数据
            </a-button>
          </div>
        </a-col>
      </a-row>
    </div>

    <!-- 工具栏 -->
    <div class="k8s-toolbar">
      <!-- 筛选和搜索区域 -->
      <div class="k8s-toolbar-filters">
        <div class="k8s-filter-group">
          <a-select 
            v-model:value="filterEnv" 
            placeholder="环境筛选" 
            class="k8s-filter-select" 
            allow-clear 
            @change="handleFilterChange"
          >
            <template #suffixIcon><FilterOutlined /></template>
            <a-select-option :value="Env.Prod">生产环境</a-select-option>
            <a-select-option :value="Env.Dev">开发环境</a-select-option>
            <a-select-option :value="Env.Stage">预发环境</a-select-option>
            <a-select-option :value="Env.Rc">测试环境</a-select-option>
            <a-select-option :value="Env.Press">灰度环境</a-select-option>
          </a-select>
          
          <a-select 
            v-model:value="filterStatus" 
            placeholder="状态筛选" 
            class="k8s-filter-select" 
            allow-clear 
            @change="handleFilterChange"
          >
            <template #suffixIcon><FilterOutlined /></template>
            <a-select-option :value="ClusterStatus.Running">运行中</a-select-option>
            <a-select-option :value="ClusterStatus.Stopped">已停止</a-select-option>
            <a-select-option :value="ClusterStatus.Error">异常</a-select-option>
          </a-select>
        </div>
        
        <div class="k8s-search-group">
          <a-input 
            v-model:value="searchText" 
            placeholder="搜索集群名称、API地址等" 
            class="k8s-search-input" 
            @pressEnter="onSearch"
            @input="onSearchInput"
            allow-clear 
          >
            <template #suffix>
              <SearchOutlined class="k8s-search-icon" />
            </template>
          </a-input>
        </div>
      </div>
      
      <!-- 操作区域 -->
      <div class="k8s-toolbar-actions">
        <div class="k8s-action-buttons">
          <a-button 
            @click="resetFilters" 
            :disabled="!filterEnv && !filterStatus && !searchText"
            class="k8s-toolbar-btn"
            title="重置所有筛选条件"
          >
            <template #icon><DeleteOutlined /></template>
            重置筛选
          </a-button>
          
          <a-button 
            @click="fetchClusters" 
            :loading="loading"
            class="k8s-toolbar-btn"
            title="刷新数据"
          >
            <template #icon><ReloadOutlined /></template>
            刷新
          </a-button>
          
          <a-button 
            type="primary" 
            danger 
            @click="batchDelete" 
            :disabled="!selectedRows.length" 
            v-if="selectedRows.length > 0"
            class="k8s-toolbar-btn"
            title="批量删除选中的集群"
          >
            <template #icon><DeleteOutlined /></template>
            删除 ({{ selectedRows.length }})
          </a-button>
        </div>
      </div>
    </div>

    <!-- 数据展示区域 -->
    <div class="k8s-data-display">
      <a-table
        :columns="columns"
        :data-source="filteredClusters"
        :row-selection="rowSelection"
        :loading="loading"
        row-key="id"
        :pagination="{
          current: currentPage,
          pageSize: pageSize,
          total: total,
          showSizeChanger: true,
          showQuickJumper: true,
          showTotal: (total: number, range: number[]) => `显示 ${range[0]}-${range[1]} 条，共 ${total} 条数据`,
          pageSizeOptions: ['10', '20', '30', '50']
        }"
        @change="handleTableChange"
        class="k8s-table cluster-table"
        :scroll="{ x: 1400 }"
      >
        <template #bodyCell="{ column, text, record }">
          <template v-if="column.key === 'env'">
            <a-tag color="blue">{{ getEnvText(text) }}</a-tag>
          </template>
          
          <template v-else-if="column.key === 'status'">
            <a-badge :status="text === ClusterStatus.Running ? 'success' : text === ClusterStatus.Error ? 'error' : 'default'" :text="getStatusText(text)" />
          </template>
          
          <template v-else-if="column.key === 'tags'">
            <div class="k8s-labels-display">
              <a-tooltip v-for="tag in (text || []).slice(0, 3)" :key="tag.key" :title="`${tag.key}: ${tag.value}`">
                <a-tag class="k8s-label-item">
                  {{ tag.key }}: {{ tag.value }}
                </a-tag>
              </a-tooltip>
              <a-tooltip v-if="(text || []).length > 3" :title="(text || []).map((tag: any) => `${tag.key}: ${tag.value}`).join('\n')">
                <a-tag class="k8s-label-item">
                  {{ (text || []).length }} 个标签
                </a-tag>
              </a-tooltip>
              <span v-if="!text || text.length === 0" class="k8s-no-data">-</span>
            </div>
          </template>
          
          <template v-else-if="column.key === 'kubeconfig'">
            <div class="cluster-kubeconfig-column">
              <!-- 始终显示有配置状态，因为列表接口可能不返回完整内容 -->
              <div class="kubeconfig-preview-container">
                <!-- 配置状态和信息 -->
                <div class="kubeconfig-status-info">
                  <a-tag color="green" size="small">
                    <template #icon><FileTextOutlined /></template>
                    有配置
                  </a-tag>
                  <span v-if="record.kube_config_content" class="config-length-info">
                    {{ Math.ceil((record.kube_config_content?.length || 0) / 1024) }}KB
                  </span>
                </div>
                
                <!-- 配置预览 - 可点击 -->
                <div 
                  v-if="record.kube_config_content" 
                  class="kubeconfig-preview-content kubeconfig-clickable"
                  @click.stop="showKubeConfigModal(record)"
                  title="点击查看完整配置"
                >
                  <a-tooltip placement="topLeft" overlayClassName="kubeconfig-tooltip">
                    <template #title>
                      <div class="kubeconfig-tooltip-content">
                        <div class="tooltip-header">KubeConfig 预览：</div>
                        <pre class="tooltip-config-content">{{ (record.kube_config_content || '').substring(0, 500) }}{{ (record.kube_config_content || '').length > 500 ? '\n...' : '' }}</pre>
                      </div>
                    </template>
                    <div class="config-preview-text">
                      {{ getKubeConfigPreview(record.kube_config_content) }}
                    </div>
                  </a-tooltip>
                </div>
                
                <!-- 如果没有详细内容，显示简化信息 - 可点击 -->
                <div 
                  v-else 
                  class="kubeconfig-preview-content kubeconfig-clickable"
                  @click.stop="showKubeConfigModal(record)"
                  title="点击查看完整配置"
                >
                  <div class="config-preview-text">
                    集群: {{ record.name }} (点击查看完整配置)
                  </div>
                </div>
              </div>
            </div>
          </template>
          
          <template v-else-if="column.key === 'actions'">
            <div class="k8s-action-column">
              <a-tooltip title="查看详情">
                <a-button title="查看详情" @click="showClusterDetail(record)">
                  <template #icon><EyeOutlined /></template>
                </a-button>
              </a-tooltip>
              <a-tooltip title="编辑集群">
                <a-button title="编辑" @click="openEdit(record)">
                  <template #icon><EditOutlined /></template>
                </a-button>
              </a-tooltip>
              <a-tooltip title="删除集群">
                <a-popconfirm 
                  title="确定要删除该集群吗?" 
                  @confirm="confirmDelete(record)" 
                  ok-text="确定" 
                  cancel-text="取消"
                >
                  <a-button title="删除" danger>
                    <template #icon><DeleteOutlined /></template>
                  </a-button>
                </a-popconfirm>
              </a-tooltip>
              <a-tooltip title="刷新集群">
                <a-button title="刷新" @click="refreshCluster(record.id!)">
                  <template #icon><ReloadOutlined /></template>
                </a-button>
              </a-tooltip>
            </div>
          </template>
        </template>

        <template #emptyText>
          <div class="k8s-empty-state">
            <DeploymentUnitOutlined />
            <p>暂无集群数据</p>
            <a-button type="primary" @click="openCreate">新建集群</a-button>
          </div>
        </template>
      </a-table>
    </div>

    <a-modal
      v-model:open="isModalVisible"
      :title="isEdit ? '编辑集群' : '新建集群'"
      @ok="submitForm"
      @cancel="closeModal"
      :confirmLoading="submitLoading"
      width="800px"
      :maskClosable="false"
      :keyboard="false"
      destroyOnClose
      okText="保存"
      cancelText="取消"
    >
      <a-form 
        ref="formRef"
        :model="formModel" 
        layout="vertical" 
        class="cluster-form"
        :rules="formRules"
      >
        <a-row :gutter="16">
          <a-col :span="12">
            <a-form-item label="集群名称" name="name" required>
              <a-input 
                v-model:value="formModel.name" 
                placeholder="请输入集群名称" 
                class="form-input" 
                :maxlength="50"
                show-count
              />
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item label="环境" name="env">
              <a-select 
                v-model:value="formModel.env" 
                placeholder="请选择环境" 
                allow-clear 
                class="form-input"
              >
                <a-select-option :value="Env.Prod">生产环境</a-select-option>
                <a-select-option :value="Env.Dev">开发环境</a-select-option>
                <a-select-option :value="Env.Stage">预发环境</a-select-option>
                <a-select-option :value="Env.Rc">测试环境</a-select-option>
                <a-select-option :value="Env.Press">灰度环境</a-select-option>
              </a-select>
            </a-form-item>
          </a-col>
        </a-row>

        <a-row :gutter="16">
          <a-col :span="12">
            <a-form-item label="API Server 地址" name="api_server_addr">
              <a-input 
                v-model:value="formModel.api_server_addr" 
                placeholder="https://x.x.x.x:6443" 
                class="form-input"
                :maxlength="200"
              />
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item label="Kubernetes 版本" name="version">
              <a-input 
                v-model:value="formModel.version" 
                placeholder="如 v1.28.0" 
                class="form-input"
                :maxlength="20"
              />
            </a-form-item>
          </a-col>
        </a-row>

        <a-divider orientation="left">
          <span style="color: #666; font-size: 14px;">资源配置</span>
        </a-divider>
        
        <a-alert
          message="危险操作警告"
          description="修改资源配置可能影响集群性能和稳定性，请谨慎操作。生产环境建议经过充分测试后再进行调整。"
          type="warning"
          show-icon
          style="margin-bottom: 16px;"
        />

        <a-row :gutter="16">
          <a-col :span="12">
            <a-form-item label="CPU 请求 (millicores)" name="cpu_request">
              <a-input-number
                v-model:value="formModel.cpu_request"
                placeholder="500"
                class="form-input"
                :min="0"
                :max="100000"
                :step="100"
                style="width: 100%"
              />
              <div style="color: #999; font-size: 12px; margin-top: 4px;">建议值: 500-2000m</div>
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item label="CPU 限制 (millicores)" name="cpu_limit">
              <a-input-number
                v-model:value="formModel.cpu_limit"
                placeholder="2000"
                class="form-input"
                :min="0"
                :max="100000"
                :step="100"
                style="width: 100%"
              />
              <div style="color: #999; font-size: 12px; margin-top: 4px;">建议值: 1000-8000m</div>
            </a-form-item>
          </a-col>
        </a-row>

        <a-row :gutter="16">
          <a-col :span="12">
            <a-form-item label="内存请求 (MiB)" name="memory_request">
              <a-input-number
                v-model:value="formModel.memory_request"
                placeholder="1024"
                class="form-input"
                :min="0"
                :max="1048576"
                :step="256"
                style="width: 100%"
              />
              <div style="color: #999; font-size: 12px; margin-top: 4px;">建议值: 512-4096Mi</div>
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item label="内存限制 (MiB)" name="memory_limit">
              <a-input-number
                v-model:value="formModel.memory_limit"
                placeholder="4096"
                class="form-input"
                :min="0"
                :max="1048576"
                :step="256"
                style="width: 100%"
              />
              <div style="color: #999; font-size: 12px; margin-top: 4px;">建议值: 2048-16384Mi</div>
            </a-form-item>
          </a-col>
        </a-row>

        <a-divider orientation="left">
          <span style="color: #666; font-size: 14px;">配置信息</span>
        </a-divider>

        <a-form-item label="KubeConfig 内容" name="kube_config_content">
          <a-spin :spinning="editDetailLoading && isEdit" tip="正在获取完整的KubeConfig内容...">
            <a-textarea 
              v-model:value="formModel.kube_config_content" 
              :rows="6" 
              placeholder="请粘贴完整的 kubeconfig 内容..."
              class="form-input"
              :maxlength="10000"
              show-count
            />
          </a-spin>
          <div style="color: #999; font-size: 12px; margin-top: 4px;">
            提示：请确保 kubeconfig 内容格式正确且具有足够的权限
            <span v-if="editDetailLoading && isEdit" style="color: #1890ff;">
              <br/>正在从服务器获取完整的配置信息...
            </span>
          </div>
        </a-form-item>

        <a-form-item label="资源限制命名空间" name="restrict_namespace">
          <a-select 
            v-model:value="formModel.restrict_namespace" 
            mode="tags" 
            placeholder="输入命名空间名称并回车添加" 
            class="form-input"
            :maxTagCount="10"
          />
          <div style="color: #999; font-size: 12px; margin-top: 4px;">
            可限制该集群只能操作指定的命名空间，留空表示无限制
          </div>
          <a-alert
            message="重要提醒"
            description="修改命名空间限制会影响集群的访问权限范围，请确认操作的安全性。"
            type="info"
            show-icon
            style="margin-top: 8px;"
            v-if="isEdit"
          />
        </a-form-item>

        <a-form-item label="标签配置" name="tags">
          <div class="k8s-key-value-inputs">
            <div v-if="!formModel.tags || formModel.tags.length === 0" class="k8s-empty-state">
              <div class="empty-icon">🏷️</div>
              <div class="empty-text">暂无标签，点击下方按钮添加</div>
            </div>
            <a-form-item-rest>
              <div v-for="(tag, idx) in (formModel.tags || [])" :key="idx" class="k8s-key-value-row">
                <a-input 
                  v-model:value="tag.key" 
                  placeholder="标签键" 
                  class="k8s-form-input"
                  :maxlength="50"
                />
                <a-input 
                  v-model:value="tag.value" 
                  placeholder="标签值" 
                  class="k8s-form-input"
                  :maxlength="200"
                />
                <a-button type="text" danger @click="removeTag(idx)" class="k8s-remove-btn">
                  <template #icon><DeleteOutlined /></template>
                </a-button>
              </div>
            </a-form-item-rest>
            <a-button type="dashed" @click="addTag" block class="k8s-add-btn">
              <template #icon><PlusOutlined /></template>
              添加标签
            </a-button>
          </div>
        </a-form-item>

        <a-row :gutter="16">
          <a-col :span="12">
            <a-form-item label="操作超时时间 (秒)" name="action_timeout_seconds">
              <a-input-number 
                v-model:value="formModel.action_timeout_seconds" 
                :min="0" 
                :max="3600"
                :step="30"
                class="form-input"
                placeholder="300"
                style="width: 100%"
              />
              <div style="color: #999; font-size: 12px; margin-top: 4px;">默认: 300秒，范围: 0-3600秒</div>
            </a-form-item>
          </a-col>
        </a-row>
      </a-form>
    </a-modal>

    <!-- 详情模态框 -->
    <a-modal
      v-model:open="isDetailModalVisible"
      title="集群详情"
      :footer="null"
      @cancel="closeDetailModal"
      width="1000px"
      :maskClosable="false"
      destroyOnClose
    >
      <a-spin :spinning="detailLoading">
        <div v-if="currentClusterDetail" class="k8s-detail-content">
          <a-row :gutter="[24, 16]">
            <a-col :xs="24" :lg="12">
              <a-card title="基本信息" class="k8s-detail-card" size="small">
                <div class="k8s-detail-item">
                  <span class="k8s-detail-label">集群名称:</span>
                  <span class="k8s-detail-value">{{ currentClusterDetail.name }}</span>
                </div>
                <div class="k8s-detail-item">
                  <span class="k8s-detail-label">环境:</span>
                  <a-tag color="blue">{{ getEnvText(currentClusterDetail.env) }}</a-tag>
                </div>
                <div class="k8s-detail-item">
                  <span class="k8s-detail-label">状态:</span>
                  <a-badge 
                    :status="currentClusterDetail.status === ClusterStatus.Running ? 'success' : currentClusterDetail.status === ClusterStatus.Error ? 'error' : 'default'" 
                    :text="getStatusText(currentClusterDetail.status)" 
                  />
                </div>
                <div class="k8s-detail-item">
                  <span class="k8s-detail-label">版本:</span>
                  <span class="k8s-detail-value">{{ currentClusterDetail.version || '-' }}</span>
                </div>
                <div class="k8s-detail-item">
                  <span class="k8s-detail-label">API Server:</span>
                  <span class="k8s-detail-value">{{ currentClusterDetail.api_server_addr || '-' }}</span>
                </div>
                <div class="k8s-detail-item">
                  <span class="k8s-detail-label">创建者:</span>
                  <span class="k8s-detail-value">{{ currentClusterDetail.create_user_name || '-' }}</span>
                </div>
                <div class="k8s-detail-item">
                  <span class="k8s-detail-label">创建时间:</span>
                  <span class="k8s-detail-value">{{ currentClusterDetail.created_at || '-' }}</span>
                </div>
                <div class="k8s-detail-item">
                  <span class="k8s-detail-label">更新时间:</span>
                  <span class="k8s-detail-value">{{ currentClusterDetail.updated_at || '-' }}</span>
                </div>
              </a-card>
            </a-col>
            
            <a-col :xs="24" :lg="12">
              <a-card title="资源配置" class="k8s-detail-card" size="small">
                <div class="k8s-detail-item">
                  <span class="k8s-detail-label">CPU 请求:</span>
                  <span class="k8s-detail-value">{{ currentClusterDetail.cpu_request || '-' }}m</span>
                </div>
                <div class="k8s-detail-item">
                  <span class="k8s-detail-label">CPU 限制:</span>
                  <span class="k8s-detail-value">{{ currentClusterDetail.cpu_limit || '-' }}m</span>
                </div>
                <div class="k8s-detail-item">
                  <span class="k8s-detail-label">内存请求:</span>
                  <span class="k8s-detail-value">{{ currentClusterDetail.memory_request || '-' }}Mi</span>
                </div>
                <div class="k8s-detail-item">
                  <span class="k8s-detail-label">内存限制:</span>
                  <span class="k8s-detail-value">{{ currentClusterDetail.memory_limit || '-' }}Mi</span>
                </div>
                <div class="k8s-detail-item">
                  <span class="k8s-detail-label">操作超时:</span>
                  <span class="k8s-detail-value">{{ currentClusterDetail.action_timeout_seconds || '-' }}秒</span>
                </div>
              </a-card>
            </a-col>
          </a-row>

          <a-row :gutter="[24, 16]" style="margin-top: 16px;">
            <a-col :xs="24" :lg="12">
              <a-card title="命名空间限制" class="k8s-detail-card" size="small">
                <div class="k8s-namespace-list">
                  <a-tag v-for="ns in (currentClusterDetail.restrict_namespace || [])" :key="ns" class="k8s-namespace-tag" style="margin-bottom: 8px;">
                    {{ ns }}
                  </a-tag>
                  <span v-if="!currentClusterDetail.restrict_namespace || currentClusterDetail.restrict_namespace.length === 0" class="k8s-no-data">
                    无限制
                  </span>
                </div>
              </a-card>
            </a-col>
            
            <a-col :xs="24" :lg="12">
              <a-card title="标签信息" class="k8s-detail-card" size="small">
                <div class="k8s-labels-display">
                  <a-tooltip v-for="tag in (currentClusterDetail.tags || [])" :key="tag.key" :title="`${tag.key}: ${tag.value}`">
                    <div class="k8s-label-item" style="margin-bottom: 8px;">
                      {{ tag.key }}: {{ tag.value }}
                    </div>
                  </a-tooltip>
                  <span v-if="!currentClusterDetail.tags || currentClusterDetail.tags.length === 0" class="k8s-no-data">
                    暂无标签
                  </span>
                </div>
              </a-card>
            </a-col>
          </a-row>

          <a-row style="margin-top: 16px;">
            <a-col :span="24">
              <a-card title="详细信息" class="k8s-detail-card" size="small">
                <a-descriptions :column="{ xxl: 3, xl: 3, lg: 2, md: 2, sm: 1, xs: 1 }" size="small" bordered>
                  <a-descriptions-item label="集群名称">{{ currentClusterDetail.name }}</a-descriptions-item>
                  <a-descriptions-item label="环境">
                    <a-tag color="blue">{{ getEnvText(currentClusterDetail.env) }}</a-tag>
                  </a-descriptions-item>
                  <a-descriptions-item label="状态">
                    <a-badge 
                      :status="currentClusterDetail.status === ClusterStatus.Running ? 'success' : currentClusterDetail.status === ClusterStatus.Error ? 'error' : 'default'" 
                      :text="getStatusText(currentClusterDetail.status)" 
                    />
                  </a-descriptions-item>
                  <a-descriptions-item label="版本">{{ currentClusterDetail.version || '-' }}</a-descriptions-item>
                  <a-descriptions-item label="API Server">{{ currentClusterDetail.api_server_addr || '-' }}</a-descriptions-item>
                  <a-descriptions-item label="创建者">{{ currentClusterDetail.create_user_name || '-' }}</a-descriptions-item>
                  <a-descriptions-item label="创建时间">{{ currentClusterDetail.created_at || '-' }}</a-descriptions-item>
                  <a-descriptions-item label="更新时间">{{ currentClusterDetail.updated_at || '-' }}</a-descriptions-item>
                  <a-descriptions-item label="操作超时">{{ currentClusterDetail.action_timeout_seconds || '-' }}秒</a-descriptions-item>
                </a-descriptions>
              </a-card>
            </a-col>
          </a-row>

          <a-row style="margin-top: 16px;">
            <a-col :span="24">
              <a-card title="KubeConfig 配置" class="k8s-detail-card" size="small">
                <div class="k8s-config-actions" style="margin-bottom: 12px;">
                  <a-space>
                    <a-button size="small" @click="copyDetailKubeConfig" :disabled="!currentClusterDetail?.kube_config_content">
                      <template #icon><CopyOutlined /></template>
                      复制配置
                    </a-button>
                    <a-button size="small" @click="downloadDetailKubeConfig" :disabled="!currentClusterDetail?.kube_config_content">
                      <template #icon><DownloadOutlined /></template>
                      下载配置
                    </a-button>
                  </a-space>
                </div>
                <a-textarea 
                  :value="currentClusterDetail.kube_config_content || '暂无配置'" 
                  :rows="8" 
                  readonly 
                  class="k8s-config-textarea"
                  :style="{ maxHeight: '240px', overflow: 'auto' }"
                />
              </a-card>
            </a-col>
          </a-row>
        </div>
      </a-spin>
    </a-modal>

    <!-- KubeConfig 查看模态框 -->
    <a-modal
      v-model:open="isKubeConfigModalVisible"
      title="KubeConfig 配置内容"
      :footer="null"
      @cancel="closeKubeConfigModal"
      width="900px"
      :maskClosable="false"
      destroyOnClose
    >
      <div class="kubeconfig-modal-content">
        <div class="kubeconfig-header">
          <div class="cluster-info">
            <span class="cluster-name">{{ currentKubeConfigCluster?.name }}</span>
            <a-tag color="blue">{{ getEnvText(currentKubeConfigCluster?.env) }}</a-tag>
          </div>
          <div class="kubeconfig-actions">
            <a-tooltip title="复制到剪贴板">
              <a-button size="small" @click="copyKubeConfig">
                <template #icon><CopyOutlined /></template>
                复制
              </a-button>
            </a-tooltip>
            <a-tooltip title="下载为文件">
              <a-button size="small" @click="downloadKubeConfig">
                <template #icon><DownloadOutlined /></template>
                下载
              </a-button>
            </a-tooltip>
          </div>
        </div>
        <a-divider style="margin: 16px 0;" />
        <div class="kubeconfig-content">
          <a-spin :spinning="kubeConfigLoading" tip="正在获取完整的KubeConfig内容...">
            <a-textarea 
              :value="currentKubeConfigCluster?.kube_config_content || '暂无配置内容'" 
              :rows="20" 
              readonly 
              class="kubeconfig-textarea"
              placeholder="暂无 KubeConfig 配置内容"
            />
          </a-spin>
        </div>
      </div>
    </a-modal>

  </div>
</template>

<script lang="ts" setup>
import { onMounted } from 'vue';
import { useClusterPage } from './Cluster';
import './Cluster.css';
import { 
  PlusOutlined, 
  ReloadOutlined, 
  FilterOutlined, 
  DeleteOutlined, 
  EditOutlined, 
  DeploymentUnitOutlined,
  EyeOutlined,
  FileTextOutlined,
  CopyOutlined,
  DownloadOutlined,
  SearchOutlined
} from '@ant-design/icons-vue';

const {
  loading,
  searchText,
  filterEnv,
  filterStatus,
  selectedRows,
  currentPage,
  pageSize,
  isModalVisible,
  isEdit,
  submitLoading,
  editDetailLoading,
  formModel,
  formRules,
  formRef,
  filteredClusters,
  rowSelection,
  getEnvText,
  getStatusText,
  fetchClusters,
  openCreate,
  openEdit,
  closeModal,
  submitForm,
  confirmDelete,
  batchDelete,
  refreshCluster,
  Env,
  ClusterStatus,
  addTag,
  removeTag,
  // detail modal
  isDetailModalVisible,
  detailLoading,
  currentClusterDetail,
  showClusterDetail,
  closeDetailModal,
  // kubeconfig modal
  isKubeConfigModalVisible,
  kubeConfigLoading,
  currentKubeConfigCluster,
  showKubeConfigModal,
  closeKubeConfigModal,
  copyKubeConfig,
  downloadKubeConfig,
  copyDetailKubeConfig,
  downloadDetailKubeConfig,
  // pagination
  handlePageChange,
  // filters
  resetFilters,
  onSearch,
  onSearchInput,
  total,
  // kubeconfig preview
  getKubeConfigPreview,
} = useClusterPage();

const handleFilterChange = () => {
  currentPage.value = 1;
  fetchClusters();
};

const handleTableChange = (pagination: { current?: number; pageSize?: number }) => {
  if (pagination) {
    handlePageChange(pagination.current || currentPage.value, pagination.pageSize);
  }
};


const columns = [
  { title: '名称', dataIndex: 'name', key: 'name', width: '10%' },
  { title: '环境', dataIndex: 'env', key: 'env', width: '7%' },
  { title: '状态', dataIndex: 'status', key: 'status', width: '7%' },
  { title: 'API 地址', dataIndex: 'api_server_addr', key: 'api_server_addr', width: '15%', ellipsis: true },
  { title: '版本', dataIndex: 'version', key: 'version', width: '7%' },
  { title: 'KubeConfig', key: 'kubeconfig', width: '18%' },
  { title: '创建者', dataIndex: 'create_user_name', key: 'create_user_name', width: '8%' },
  { title: '标签', dataIndex: 'tags', key: 'tags', width: '8%' },
  { title: '创建时间', dataIndex: 'created_at', key: 'created_at', width: '8%' },
  { title: '操作', key: 'actions', width: '12%', fixed: 'right' },
];

onMounted(async () => {
  await fetchClusters();
});
</script>

<style scoped>
@import '../shared/k8s-common.css';
</style>

<style scoped src="./Cluster.css"></style>


