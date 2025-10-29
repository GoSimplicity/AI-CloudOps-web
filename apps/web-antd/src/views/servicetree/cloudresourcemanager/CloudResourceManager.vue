<template>
  <div class="cloud-resource-manager">
    <!-- 页面头部 -->
    <div class="page-header">
      <div class="header-actions">
        <a-button type="primary" @click="showSyncModal" class="btn-create">
          <template #icon><sync-outlined /></template>
          <span class="btn-text">同步资源</span>
        </a-button>
        <a-button @click="handleRefresh" class="btn-action">
          <template #icon><reload-outlined /></template>
          <span class="btn-text">刷新</span>
        </a-button>
        <a-dropdown>
          <a-button>
            更多 <down-outlined />
          </a-button>
          <template #overlay>
            <a-menu>
              <a-menu-item key="history" @click="showSyncHistoryModal">
                <history-outlined /> 同步历史
              </a-menu-item>
              <a-menu-item key="changelog" @click="showChangeLogModal">
                <file-text-outlined /> 变更日志
              </a-menu-item>
              <a-menu-divider />
              <a-sub-menu key="export" title="导出数据">
                <template #icon><export-outlined /></template>
                <a-menu-item key="export-current" @click="handleExportCurrent">
                  <file-excel-outlined /> 导出当前页
                </a-menu-item>
                <a-menu-item key="export-all" @click="handleExportAll">
                  <file-excel-outlined /> 导出全部数据
                </a-menu-item>
              </a-sub-menu>
            </a-menu>
          </template>
        </a-dropdown>
      </div>
    </div>

    <!-- 统计卡片区 -->
    <div class="stats-row">
      <a-row :gutter="[16, 16]">
        <a-col :xs="12" :sm="6" :md="6" :lg="6">
          <a-card class="stats-card">
            <a-statistic 
              title="总资源数" 
              :value="stats.total" 
              :value-style="{ color: '#3f8600' }"
            >
              <template #prefix>
                <cloud-server-outlined />
              </template>
            </a-statistic>
          </a-card>
        </a-col>
        <a-col :xs="12" :sm="6" :md="6" :lg="6">
          <a-card class="stats-card">
            <a-statistic 
              title="运行中" 
              :value="stats.running" 
              :value-style="{ color: '#52c41a' }"
            >
              <template #prefix>
                <check-circle-outlined />
              </template>
            </a-statistic>
          </a-card>
        </a-col>
        <a-col :xs="12" :sm="6" :md="6" :lg="6">
          <a-card class="stats-card">
            <a-statistic 
              title="云服务器" 
              :value="stats.ecs" 
              :value-style="{ color: '#faad14' }"
            >
              <template #prefix>
                <desktop-outlined />
              </template>
            </a-statistic>
          </a-card>
        </a-col>
        <a-col :xs="12" :sm="6" :md="6" :lg="6">
          <a-card class="stats-card">
            <a-statistic 
              title="已绑定" 
              :value="stats.bound" 
              :value-style="{ color: '#cf1322' }"
            >
              <template #prefix>
                <apartment-outlined />
              </template>
            </a-statistic>
          </a-card>
        </a-col>
      </a-row>
    </div>

    <!-- 搜索筛选区 -->
    <div class="filter-section">
      <a-card class="filter-card">
        <a-form layout="inline" class="filter-form">
          <a-form-item>
            <a-input
              v-model:value="filterForm.search"
              placeholder="搜索资源名称/实例ID/IP地址"
              allow-clear
              style="width: 280px"
              @pressEnter="handleSearch"
            >
              <template #prefix><search-outlined /></template>
            </a-input>
          </a-form-item>
          <a-form-item label="云账户">
            <a-select
              v-model:value="filterForm.cloud_account_id"
              placeholder="全部账户"
              allow-clear
              style="width: 180px"
              @change="handleSearch"
            >
              <a-select-option v-for="account in cloudAccounts" :key="account.id" :value="account.id">
                <cloud-outlined /> {{ account.name }}
              </a-select-option>
            </a-select>
          </a-form-item>
          <a-form-item label="资源类型">
            <a-select
              v-model:value="filterForm.resource_type"
              placeholder="全部类型"
              allow-clear
              style="width: 140px"
              @change="handleSearch"
            >
              <a-select-option :value="CloudResourceType.ECS">
                <desktop-outlined /> 云服务器
              </a-select-option>
              <a-select-option :value="CloudResourceType.RDS">
                <database-outlined /> 云数据库
              </a-select-option>
              <a-select-option :value="CloudResourceType.SLB">
                <cluster-outlined /> 负载均衡
              </a-select-option>
              <a-select-option :value="CloudResourceType.OSS">
                <cloud-upload-outlined /> 对象存储
              </a-select-option>
              <a-select-option :value="CloudResourceType.VPC">
                <global-outlined /> 虚拟私有云
              </a-select-option>
              <a-select-option :value="CloudResourceType.OTHER">
                其他资源
              </a-select-option>
            </a-select>
          </a-form-item>
          <a-form-item label="状态">
            <a-select
              v-model:value="filterForm.status"
              placeholder="全部状态"
              allow-clear
              style="width: 130px"
              @change="handleSearch"
            >
              <a-select-option :value="CloudResourceStatus.RUNNING">运行中</a-select-option>
              <a-select-option :value="CloudResourceStatus.STOPPED">已停止</a-select-option>
              <a-select-option :value="CloudResourceStatus.STARTING">启动中</a-select-option>
              <a-select-option :value="CloudResourceStatus.STOPPING">停止中</a-select-option>
            </a-select>
          </a-form-item>
          <a-form-item label="环境">
            <a-select
              v-model:value="filterForm.environment"
              placeholder="全部环境"
              allow-clear
              style="width: 120px"
              @change="handleSearch"
            >
              <a-select-option value="dev">开发</a-select-option>
              <a-select-option value="test">测试</a-select-option>
              <a-select-option value="staging">预发布</a-select-option>
              <a-select-option value="prod">生产</a-select-option>
            </a-select>
          </a-form-item>
          <a-form-item>
            <a-space>
              <a-button type="primary" @click="handleSearch">
                <search-outlined /> 查询
              </a-button>
              <a-button @click="resetFilter">
                <clear-outlined /> 重置
              </a-button>
            </a-space>
          </a-form-item>
        </a-form>
      </a-card>
    </div>

    <!-- 资源列表表格 -->
    <div class="table-section">
      <a-card class="table-card">
        <a-table
          :columns="columns"
          :data-source="resources"
          :loading="loading"
          :pagination="paginationConfig"
          @change="handleTableChange"
          row-key="id"
          :scroll="{ x: 1800 }"
          class="resource-table"
        >
          <!-- 资源名称列 -->
          <template #bodyCell="{ column, record }">
            <template v-if="column.key === 'name'">
              <div class="name-cell">
                <a-badge :status="getStatusBadgeType(record.status)" />
                <a class="resource-name" @click="handleViewDetail(record)">
                  {{ record.name }}
                </a>
                <a-tag v-if="record.environment" :color="getEnvironmentColor(record.environment)" size="small" class="env-tag">
                  {{ getEnvironmentText(record.environment) }}
                </a-tag>
              </div>
            </template>

            <!-- 资源类型列 -->
            <template v-else-if="column.key === 'resource_type'">
              <a-tag :color="getResourceTypeColor(record.resource_type)" class="type-tag">
                <component :is="getResourceTypeIcon(record.resource_type)" class="tag-icon" />
                {{ getResourceTypeText(record.resource_type) }}
              </a-tag>
            </template>

            <!-- 云账户列 -->
            <template v-else-if="column.key === 'cloud_account'">
              <div v-if="record.cloud_account" class="account-cell">
                <cloud-outlined class="account-icon" />
                <span>{{ record.cloud_account.name }}</span>
              </div>
              <span v-else class="empty-text">-</span>
            </template>

            <!-- 实例信息列 -->
            <template v-else-if="column.key === 'instance'">
              <div class="instance-info">
                <div v-if="record.instance_id" class="info-row">
                  <span class="info-label">ID:</span>
                  <a-typography-text :copyable="{ text: record.instance_id }" class="info-value">
                    {{ truncateText(record.instance_id, 20) }}
                  </a-typography-text>
                </div>
                <div v-if="record.instance_type" class="info-row">
                  <span class="info-label">规格:</span>
                  <span class="info-value">{{ record.instance_type }}</span>
                </div>
                <div v-if="record.region" class="info-row">
                  <environment-outlined class="info-icon" />
                  <span class="info-value">{{ record.region }}</span>
                </div>
              </div>
            </template>

            <!-- 配置信息列 -->
            <template v-else-if="column.key === 'config'">
              <div class="config-info">
              <a-tooltip v-if="record.cpu || record.memory || record.disk" title="CPU / 内存 / 磁盘">
                <div class="config-item" v-if="record.cpu">
                  <span>{{ record.cpu }}核</span>
                </div>
                  <div class="config-item">
                    <hdd-outlined class="config-icon" />
                    <span v-if="record.memory">{{ record.memory }}GB</span>
                  </div>
                  <div class="config-item" v-if="record.disk">
                    <database-outlined class="config-icon" />
                    <span>{{ record.disk }}GB</span>
                  </div>
                </a-tooltip>
                <span v-else class="empty-text">-</span>
              </div>
            </template>

            <!-- IP地址列 -->
            <template v-else-if="column.key === 'ip'">
              <div class="ip-info">
                <div v-if="record.public_ip" class="ip-row">
                  <global-outlined class="ip-icon public" />
                  <a-typography-text :copyable="{ text: record.public_ip }" class="ip-text">
                    {{ record.public_ip }}
                  </a-typography-text>
                </div>
                <div v-if="record.private_ip" class="ip-row">
                  <lock-outlined class="ip-icon private" />
                  <a-typography-text :copyable="{ text: record.private_ip }" class="ip-text">
                    {{ record.private_ip }}
                  </a-typography-text>
                </div>
                <span v-if="!record.public_ip && !record.private_ip" class="empty-text">-</span>
              </div>
            </template>

            <!-- 状态列 -->
            <template v-else-if="column.key === 'status'">
              <a-dropdown :trigger="['click']">
                <a-badge 
                  :status="getStatusBadgeType(record.status)" 
                  :text="getStatusText(record.status)" 
                  class="status-badge clickable"
                />
                <template #overlay>
                  <a-menu @click="({key}: {key: string}) => handleUpdateStatus(record, Number(key))">
                    <a-menu-item :key="CloudResourceStatus.RUNNING" :disabled="record.status === CloudResourceStatus.RUNNING">
                      <check-circle-outlined /> 运行中
                    </a-menu-item>
                    <a-menu-item :key="CloudResourceStatus.STOPPED" :disabled="record.status === CloudResourceStatus.STOPPED">
                      <stop-outlined /> 已停止
                    </a-menu-item>
                    <a-menu-item :key="CloudResourceStatus.STARTING" :disabled="record.status === CloudResourceStatus.STARTING">
                      <loading-outlined /> 启动中
                    </a-menu-item>
                    <a-menu-item :key="CloudResourceStatus.STOPPING" :disabled="record.status === CloudResourceStatus.STOPPING">
                      <pause-circle-outlined /> 停止中
                    </a-menu-item>
                  </a-menu>
                </template>
              </a-dropdown>
            </template>

            <!-- 服务树节点列 -->
            <template v-else-if="column.key === 'tree_nodes'">
              <div class="nodes-wrapper">
                <template v-if="record.tree_nodes && record.tree_nodes.length > 0">
                  <a-tag 
                    v-for="node in record.tree_nodes.slice(0, 2)" 
                    :key="node.id" 
                    color="blue"
                    class="node-tag"
                  >
                    <apartment-outlined class="tag-icon" />
                    {{ node.name }}
                  </a-tag>
                  <a-tooltip v-if="record.tree_nodes.length > 2" :title="record.tree_nodes.slice(2).map((n: any) => n.name).join(', ')">
                    <a-tag color="blue" class="node-tag">
                      +{{ record.tree_nodes.length - 2 }}
                    </a-tag>
                  </a-tooltip>
                </template>
                <a-tag v-else color="default" class="node-tag">
                  未绑定
                </a-tag>
              </div>
            </template>

            <!-- 费用列 -->
            <template v-else-if="column.key === 'cost'">
              <div v-if="record.monthly_cost" class="cost-cell">
                <span class="cost-symbol">¥</span>
                <span class="cost-amount">{{ formatCost(record.monthly_cost) }}</span>
                <span class="cost-unit">/月</span>
              </div>
              <span v-else class="empty-text">-</span>
            </template>

            <!-- 操作列 -->
            <template v-else-if="column.key === 'action'">
              <a-space :size="4" class="action-buttons">
                <a-tooltip title="查看详情">
                  <a-button type="text" size="small" @click="handleViewDetail(record)">
                    <eye-outlined />
                  </a-button>
                </a-tooltip>
                <a-tooltip title="编辑">
                  <a-button type="text" size="small" @click="handleEdit(record)">
                    <edit-outlined />
                  </a-button>
                </a-tooltip>
                <a-tooltip title="绑定服务树">
                  <a-button type="text" size="small" @click="showBindModal(record)">
                    <apartment-outlined />
                  </a-button>
                </a-tooltip>
                <a-tooltip v-if="record.resource_type === CloudResourceType.ECS" title="连接终端">
                  <a-button type="text" size="small" @click="handleConnectTerminal(record)">
                    <code-outlined />
                  </a-button>
                </a-tooltip>
                <a-dropdown :trigger="['click']">
                  <a-button type="text" size="small">
                    <ellipsis-outlined />
                  </a-button>
                  <template #overlay>
                    <a-menu>
                      <a-menu-item key="unbind" @click="showUnbindModal(record)" :disabled="!record.tree_nodes || record.tree_nodes.length === 0">
                        <disconnect-outlined /> 解绑节点
                      </a-menu-item>
                      <a-menu-divider />
                      <a-menu-item key="delete" danger @click="handleDelete(record)">
                        <delete-outlined /> 删除资源
                      </a-menu-item>
                    </a-menu>
                  </template>
                </a-dropdown>
              </a-space>
            </template>
          </template>
        </a-table>
      </a-card>
    </div>

    <!-- 编辑资源对话框 -->
    <a-modal
      v-model:open="editModalVisible"
      title="编辑云资源"
      :width="800"
      @ok="handleUpdate"
      @cancel="editModalVisible = false"
      :confirm-loading="submitLoading"
      class="modern-modal"
    >
      <a-form :model="editForm" layout="vertical" class="edit-form">
        <a-divider orientation="left">
          <info-circle-outlined /> 基本信息
        </a-divider>
        <a-row :gutter="16">
          <a-col :span="12">
            <a-form-item label="环境标识">
              <a-select v-model:value="editForm.environment" placeholder="选择环境">
                <a-select-option value="dev">
                  <tag-outlined /> 开发环境
                </a-select-option>
                <a-select-option value="test">
                  <experiment-outlined /> 测试环境
                </a-select-option>
                <a-select-option value="staging">
                  <rocket-outlined /> 预发布环境
                </a-select-option>
                <a-select-option value="prod">
                  <fire-outlined /> 生产环境
                </a-select-option>
              </a-select>
            </a-form-item>
          </a-col>
          <a-col :span="24">
            <a-form-item label="资源描述">
              <a-textarea 
                v-model:value="editForm.description" 
                placeholder="请输入资源描述信息" 
                :rows="3"
                :maxlength="500"
                show-count
              />
            </a-form-item>
          </a-col>
        </a-row>

        <a-divider orientation="left" v-if="currentResource && currentResource.resource_type === CloudResourceType.ECS">
          <safety-outlined /> SSH配置（仅云服务器）
        </a-divider>
        <a-row :gutter="16" v-if="currentResource && currentResource.resource_type === CloudResourceType.ECS">
          <a-col :span="12">
            <a-form-item label="SSH端口">
              <a-input-number 
                v-model:value="editForm.port" 
                :min="1" 
                :max="65535" 
                placeholder="22"
                style="width: 100%"
              />
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item label="登录用户名">
              <a-input v-model:value="editForm.username" placeholder="root">
                <template #prefix><user-outlined /></template>
              </a-input>
            </a-form-item>
          </a-col>
          <a-col :span="24">
            <a-form-item label="认证方式">
              <a-radio-group v-model:value="editForm.auth_mode" button-style="solid">
                <a-radio-button :value="AuthMode.PASSWORD">
                  <lock-outlined /> 密码认证
                </a-radio-button>
                <a-radio-button :value="AuthMode.KEY">
                  <key-outlined /> 密钥认证
                </a-radio-button>
              </a-radio-group>
            </a-form-item>
          </a-col>
          <a-col :span="24" v-if="editForm.auth_mode === AuthMode.PASSWORD">
            <a-form-item label="登录密码">
              <a-input-password 
                v-model:value="editForm.password" 
                placeholder="请输入密码（留空则不修改）"
                autocomplete="new-password"
              >
                <template #prefix><lock-outlined /></template>
              </a-input-password>
            </a-form-item>
          </a-col>
          <a-col :span="24" v-if="editForm.auth_mode === AuthMode.KEY">
            <a-form-item label="SSH私钥">
              <a-textarea 
                v-model:value="editForm.key" 
                placeholder="请粘贴SSH私钥内容（留空则不修改）"
                :rows="6"
                style="font-family: 'Courier New', monospace;"
              />
            </a-form-item>
          </a-col>
        </a-row>

        <a-divider orientation="left">
          <tags-outlined /> 资源标签
        </a-divider>
        <div class="tags-editor">
          <div v-if="editForm.tags && editForm.tags.length > 0" class="tags-list">
            <a-tag
              v-for="(tag, index) in editForm.tags"
              :key="`${tag.key}-${tag.value}-${index}`"
              closable
              color="blue"
              @close="removeTag(index)"
              class="tag-item"
            >
              <strong>{{ tag.key }}</strong>: {{ tag.value }}
            </a-tag>
          </div>
          <div class="tag-input-group">
            <a-input
              v-model:value="newTagKey"
              placeholder="标签Key"
              style="width: 200px"
            />
            <a-input
              v-model:value="newTagValue"
              placeholder="标签Value"
              style="width: 200px"
              @pressEnter="addTag"
            />
            <a-button type="dashed" @click="addTag">
              <plus-outlined /> 添加标签
            </a-button>
          </div>
        </div>
      </a-form>
    </a-modal>

    <!-- 同步资源对话框 -->
    <a-modal
      v-model:open="syncModalVisible"
      title="同步云资源"
      @ok="handleSync"
      @cancel="syncModalVisible = false"
      :confirm-loading="syncLoading"
      :width="700"
      class="modern-modal"
    >
      <a-alert 
        message="同步说明" 
        description="从云厂商同步最新的资源信息到本地数据库，支持全量同步和增量同步两种模式。全量同步会更新所有资源，增量同步仅同步新增和变更的资源。"
        type="info" 
        show-icon 
        style="margin-bottom: 24px;"
      />
      <a-form layout="vertical" class="sync-form">
        <a-form-item label="云账户" required>
          <a-select
            v-model:value="syncForm.cloud_account_id"
            placeholder="请选择要同步的云账户"
            size="large"
          >
            <a-select-option v-for="account in cloudAccounts" :key="account.id" :value="account.id">
              <cloud-outlined /> {{ account.name }}
            </a-select-option>
          </a-select>
        </a-form-item>
        
        <a-form-item label="资源类型">
          <a-checkbox-group v-model:value="syncForm.resource_types" style="width: 100%">
            <a-row :gutter="[8, 8]">
              <a-col :span="12">
                <a-checkbox :value="CloudResourceType.ECS">
                  <desktop-outlined /> 云服务器
                </a-checkbox>
              </a-col>
              <a-col :span="12">
                <a-checkbox :value="CloudResourceType.RDS">
                  <database-outlined /> 云数据库
                </a-checkbox>
              </a-col>
              <a-col :span="12">
                <a-checkbox :value="CloudResourceType.SLB">
                  <cluster-outlined /> 负载均衡
                </a-checkbox>
              </a-col>
              <a-col :span="12">
                <a-checkbox :value="CloudResourceType.OSS">
                  <cloud-upload-outlined /> 对象存储
                </a-checkbox>
              </a-col>
              <a-col :span="12">
                <a-checkbox :value="CloudResourceType.VPC">
                  <global-outlined /> 虚拟私有云
                </a-checkbox>
              </a-col>
            </a-row>
          </a-checkbox-group>
          <div class="form-tip">不选择则同步所有类型资源</div>
        </a-form-item>

        <a-form-item label="同步模式">
          <a-radio-group v-model:value="syncForm.sync_mode" size="large">
            <a-radio :value="SyncMode.FULL" class="sync-mode-radio">
              <div class="radio-content">
                <div class="radio-title">
                  <sync-outlined /> 全量同步
                </div>
                <div class="radio-desc">同步所有资源，更新已有资源信息</div>
              </div>
            </a-radio>
            <a-radio :value="SyncMode.INCREMENTAL" class="sync-mode-radio">
              <div class="radio-content">
                <div class="radio-title">
                  <cloud-sync-outlined /> 增量同步
                </div>
                <div class="radio-desc">只同步新增和变更的资源</div>
              </div>
            </a-radio>
          </a-radio-group>
        </a-form-item>

        <a-form-item label="自动绑定服务树">
          <a-row align="middle">
            <a-col flex="auto">
              <a-switch v-model:checked="syncForm.auto_bind" />
              <span style="margin-left: 12px">自动将同步的资源绑定到指定节点</span>
            </a-col>
          </a-row>
        </a-form-item>

        <a-form-item v-if="syncForm.auto_bind" label="绑定到节点">
          <a-tree-select
            v-model:value="syncForm.bind_node_id"
            :tree-data="treeData"
            placeholder="请选择服务树节点"
            :field-names="{ children: 'children', label: 'name', value: 'id' }"
            tree-default-expand-all
            size="large"
          >
            <template #suffixIcon>
              <apartment-outlined />
            </template>
          </a-tree-select>
        </a-form-item>
      </a-form>
    </a-modal>

    <!-- 绑定服务树对话框 -->
    <a-modal
      v-model:open="bindModalVisible"
      title="绑定服务树节点"
      @ok="handleBind"
      @cancel="bindModalVisible = false"
      :confirm-loading="bindLoading"
      :width="600"
      class="modern-modal"
    >
      <a-form layout="vertical">
        <a-form-item label="选择服务树节点">
          <a-tree-select
            v-model:value="selectedTreeNodeIds"
            :tree-data="treeData"
            placeholder="请选择要绑定的节点（支持多选）"
            allow-clear
            multiple
            tree-checkable
            :show-checked-strategy="'SHOW_PARENT'"
            :field-names="{ children: 'children', label: 'name', value: 'id' }"
            size="large"
            style="width: 100%"
          />
        </a-form-item>
        <a-alert v-if="currentResource?.tree_nodes && currentResource.tree_nodes.length > 0" type="info" show-icon style="margin-top: 16px">
          <template #message>
            <div class="current-bindings">
              <div class="binding-title">当前已绑定节点：</div>
              <div class="binding-tags">
                <a-tag v-for="node in currentResource.tree_nodes" :key="node.id" color="blue">
                  <apartment-outlined /> {{ node.name }}
                </a-tag>
              </div>
            </div>
          </template>
        </a-alert>
      </a-form>
    </a-modal>

    <!-- 解绑节点对话框 -->
    <a-modal
      v-model:open="unbindModalVisible"
      title="解绑服务树节点"
      @ok="handleUnbind"
      @cancel="unbindModalVisible = false"
      :confirm-loading="unbindLoading"
      :width="600"
      class="modern-modal"
    >
      <a-alert 
        message="请选择要解绑的节点" 
        description="解绑后，该资源将不再关联到所选的服务树节点。"
        type="warning" 
        show-icon 
        style="margin-bottom: 16px;"
      />
      <a-form layout="vertical">
        <a-form-item label="选择要解绑的节点">
          <a-checkbox-group v-model:value="selectedUnbindNodeIds" style="width: 100%">
            <a-row :gutter="[8, 8]">
              <a-col :span="24" v-for="node in currentResource?.tree_nodes" :key="node.id">
                <a-checkbox :value="node.id" class="unbind-checkbox">
                  <apartment-outlined /> {{ node.name }}
                </a-checkbox>
              </a-col>
            </a-row>
          </a-checkbox-group>
        </a-form-item>
      </a-form>
    </a-modal>

    <!-- 同步历史对话框 -->
    <a-modal
      v-model:open="syncHistoryModalVisible"
      title="云资源同步历史"
      :width="1000"
      :footer="null"
      class="modern-modal"
    >
      <a-table
        :columns="syncHistoryColumns"
        :data-source="syncHistoryList"
        :loading="syncHistoryLoading"
        :pagination="syncHistoryPagination"
        @change="handleSyncHistoryTableChange"
        row-key="id"
        size="middle"
      >
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'sync_status'">
            <a-badge 
              :status="record.sync_status === 'success' ? 'success' : 'error'" 
              :text="record.sync_status === 'success' ? '成功' : '失败'" 
            />
          </template>
          <template v-else-if="column.key === 'stats'">
            <a-space>
              <a-tag color="green"><plus-outlined /> 新增: {{ record.new_count }}</a-tag>
              <a-tag color="blue"><sync-outlined /> 更新: {{ record.update_count }}</a-tag>
              <a-tag color="red" v-if="record.failed_count > 0"><close-circle-outlined /> 失败: {{ record.failed_count }}</a-tag>
            </a-space>
          </template>
          <template v-else-if="column.key === 'sync_mode'">
            <a-tag :color="record.sync_mode === 'full' ? 'purple' : 'cyan'">
              {{ record.sync_mode === 'full' ? '全量' : '增量' }}
            </a-tag>
          </template>
          <template v-else-if="column.key === 'duration'">
            <clock-circle-outlined /> {{ record.duration }}秒
          </template>
          <template v-else-if="column.key === 'start_time'">
            {{ formatDateTime(record.start_time) }}
          </template>
        </template>
      </a-table>
    </a-modal>

    <!-- 变更日志对话框 -->
    <a-modal
      v-model:open="changeLogModalVisible"
      title="资源变更日志"
      :width="1100"
      :footer="null"
      class="modern-modal"
    >
      <a-table
        :columns="changeLogColumns"
        :data-source="changeLogList"
        :loading="changeLogLoading"
        :pagination="changeLogPagination"
        @change="handleChangeLogTableChange"
        row-key="id"
        size="middle"
      >
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'change_type'">
            <a-tag :color="getChangeTypeColor(record.change_type)">
              {{ getChangeTypeText(record.change_type) }}
            </a-tag>
          </template>
          <template v-else-if="column.key === 'change_info'">
            <div v-if="record.field_name" class="change-detail">
              <div class="change-field">
                <tag-outlined /> <strong>字段：</strong>{{ record.field_name }}
              </div>
              <div v-if="record.old_value" class="change-old">
                <arrow-left-outlined /> <strong>旧值：</strong>{{ record.old_value }}
              </div>
              <div v-if="record.new_value" class="change-new">
                <arrow-right-outlined /> <strong>新值：</strong>{{ record.new_value }}
              </div>
            </div>
          </template>
          <template v-else-if="column.key === 'operator'">
            <a-avatar size="small" :style="{ backgroundColor: getAvatarColor(record.operator_name) }">
              {{ getInitials(record.operator_name) }}
            </a-avatar>
            <span style="margin-left: 8px">{{ record.operator_name }}</span>
          </template>
          <template v-else-if="column.key === 'change_time'">
            {{ formatDateTime(record.change_time) }}
          </template>
        </template>
      </a-table>
    </a-modal>

    <!-- 资源详情抽屉 -->
    <a-drawer
      v-model:open="detailVisible"
      title="云资源详情"
      width="600"
      :destroy-on-close="true"
      class="detail-drawer"
    >
      <a-skeleton :loading="detailLoading" active>
        <template v-if="currentDetail">
          <div class="detail-content">
            <div class="detail-header">
              <h2>{{ currentDetail.name }}</h2>
              <div class="detail-badges">
                <a-badge
                  :status="getStatusBadgeType(currentDetail.status)"
                  :text="getStatusText(currentDetail.status)"
                />
                <a-tag :color="getResourceTypeColor(currentDetail.resource_type)">
                  {{ getResourceTypeText(currentDetail.resource_type) }}
                </a-tag>
                <a-tag v-if="currentDetail.environment" :color="getEnvironmentColor(currentDetail.environment)">
                  {{ getEnvironmentText(currentDetail.environment) }}
                </a-tag>
              </div>
            </div>

            <!-- 基本信息 -->
            <a-descriptions bordered :column="2" size="small" class="detail-descriptions" title="基本信息">
              <a-descriptions-item label="资源ID" :span="1">
                {{ currentDetail.id }}
              </a-descriptions-item>
              <a-descriptions-item label="实例ID" :span="1">
                <a-typography-text v-if="currentDetail.instance_id" :copyable="{ text: currentDetail.instance_id }">
                  {{ currentDetail.instance_id }}
                </a-typography-text>
                <span v-else>-</span>
              </a-descriptions-item>
              <a-descriptions-item label="云账户" :span="2" v-if="currentDetail.cloud_account">
                <cloud-outlined /> {{ currentDetail.cloud_account.name }}
              </a-descriptions-item>
              <a-descriptions-item label="区域" :span="1">
                <environment-outlined /> {{ currentDetail.region || '-' }}
              </a-descriptions-item>
              <a-descriptions-item label="可用区" :span="1">
                {{ currentDetail.zone_id || '-' }}
              </a-descriptions-item>
              <a-descriptions-item label="VPC" :span="2">
                {{ currentDetail.vpc_id || '-' }}
              </a-descriptions-item>
            </a-descriptions>

            <!-- 配置信息 -->
            <a-descriptions bordered :column="2" size="small" class="detail-descriptions" title="配置信息" style="margin-top: 16px;">
              <a-descriptions-item label="实例规格" :span="2">
                {{ currentDetail.instance_type || '-' }}
              </a-descriptions-item>
              <a-descriptions-item label="CPU" :span="1">
                {{ currentDetail.cpu ? currentDetail.cpu + ' 核' : '-' }}
              </a-descriptions-item>
              <a-descriptions-item label="内存" :span="1">
                <hdd-outlined /> {{ currentDetail.memory ? currentDetail.memory + ' GB' : '-' }}
              </a-descriptions-item>
              <a-descriptions-item label="磁盘" :span="2">
                <database-outlined /> {{ currentDetail.disk ? currentDetail.disk + ' GB' : '-' }}
              </a-descriptions-item>
            </a-descriptions>

            <!-- 网络信息 -->
            <a-descriptions bordered :column="2" size="small" class="detail-descriptions" title="网络信息" style="margin-top: 16px;">
              <a-descriptions-item label="公网IP" :span="2">
                <a-typography-text v-if="currentDetail.public_ip" :copyable="{ text: currentDetail.public_ip }">
                  <global-outlined /> {{ currentDetail.public_ip }}
                </a-typography-text>
                <span v-else>-</span>
              </a-descriptions-item>
              <a-descriptions-item label="私网IP" :span="2">
                <a-typography-text v-if="currentDetail.private_ip" :copyable="{ text: currentDetail.private_ip }">
                  <lock-outlined /> {{ currentDetail.private_ip }}
                </a-typography-text>
                <span v-else>-</span>
              </a-descriptions-item>
            </a-descriptions>

            <!-- 系统信息 -->
            <a-descriptions bordered :column="2" size="small" class="detail-descriptions" title="系统信息" style="margin-top: 16px;">
              <a-descriptions-item label="操作系统" :span="2">
                {{ currentDetail.os_name || currentDetail.os_type || '-' }}
              </a-descriptions-item>
              <a-descriptions-item label="镜像名称" :span="2">
                {{ currentDetail.image_name || '-' }}
              </a-descriptions-item>
              <a-descriptions-item label="镜像ID" :span="2">
                {{ currentDetail.image_id || '-' }}
              </a-descriptions-item>
            </a-descriptions>

            <!-- 费用信息 -->
            <a-descriptions bordered :column="2" size="small" class="detail-descriptions" title="费用信息" style="margin-top: 16px;">
              <a-descriptions-item label="计费方式" :span="1">
                {{ currentDetail.charge_type === ChargeType.PRE_PAID ? '包年包月' : '按量付费' }}
              </a-descriptions-item>
              <a-descriptions-item label="月度费用" :span="1">
                <span v-if="currentDetail.monthly_cost" class="cost-display">
                  ¥{{ formatCost(currentDetail.monthly_cost) }} {{ currentDetail.currency }}
                </span>
                <span v-else>-</span>
              </a-descriptions-item>
              <a-descriptions-item label="到期时间" :span="2" v-if="currentDetail.expire_time">
                <clock-circle-outlined /> {{ formatDateTime(currentDetail.expire_time) }}
              </a-descriptions-item>
            </a-descriptions>

            <!-- 其他信息 -->
            <a-descriptions bordered :column="1" size="small" class="detail-descriptions" title="其他信息" style="margin-top: 16px;">
              <a-descriptions-item label="描述信息">
                {{ currentDetail.description || '-' }}
              </a-descriptions-item>
              <a-descriptions-item label="创建人">
                {{ currentDetail.create_user_name }}
              </a-descriptions-item>
              <a-descriptions-item label="创建时间">
                {{ formatDateTime(currentDetail.created_at) }}
              </a-descriptions-item>
              <a-descriptions-item label="更新时间">
                {{ formatDateTime(currentDetail.updated_at) }}
              </a-descriptions-item>
            </a-descriptions>

            <!-- 资源标签 -->
            <div class="detail-section">
              <div class="section-title">
                <tags-outlined /> 资源标签
              </div>
              <div class="section-content">
                <template v-if="currentDetail.tags && currentDetail.tags.length > 0">
                  <a-tag 
                    v-for="(tag, index) in currentDetail.tags" 
                    :key="`${tag.key}-${tag.value}-${index}`"
                    color="blue"
                    class="detail-tag"
                  >
                    <strong>{{ tag.key }}</strong>: {{ tag.value }}
                  </a-tag>
                </template>
                <a-empty v-else :image="Empty.PRESENTED_IMAGE_SIMPLE" description="暂无标签" />
              </div>
            </div>

            <!-- 绑定的服务树节点 -->
            <div class="detail-section">
              <div class="section-title">
                <apartment-outlined /> 服务树节点
              </div>
              <div class="section-content">
                <template v-if="currentDetail.tree_nodes && currentDetail.tree_nodes.length > 0">
                  <a-tag 
                    v-for="node in currentDetail.tree_nodes" 
                    :key="node.id" 
                    color="blue"
                    class="detail-tag"
                  >
                    <apartment-outlined /> {{ node.name }}
                  </a-tag>
                </template>
                <a-empty v-else :image="Empty.PRESENTED_IMAGE_SIMPLE" description="暂未绑定节点" />
              </div>
            </div>
            
            <!-- 操作按钮 -->
            <div class="drawer-actions">
              <a-button-group>
                <a-button 
                  type="primary" 
                  @click="handleConnectTerminal(currentDetail)"
                  :disabled="currentDetail.resource_type !== CloudResourceType.ECS"
                >
                  <code-outlined /> 连接终端
                </a-button>
                <a-button @click="handleEdit(currentDetail)">
                  <edit-outlined /> 编辑
                </a-button>
                <a-button @click="showBindModal(currentDetail)">
                  <apartment-outlined /> 绑定节点
                </a-button>
              </a-button-group>
              <a-button danger @click="handleDelete(currentDetail)">
                <delete-outlined /> 删除
              </a-button>
            </div>
          </div>
        </template>
      </a-skeleton>
    </a-drawer>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted, computed } from 'vue';
import { useRouter } from 'vue-router';
import { message, Empty, Modal } from 'ant-design-vue';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  DownOutlined,
  CloudOutlined,
  SearchOutlined,
  SyncOutlined,
  ReloadOutlined,
  HistoryOutlined,
  FileTextOutlined,
  CloudServerOutlined,
  CheckCircleOutlined,
  DesktopOutlined,
  ApartmentOutlined,
  CodeOutlined,
  DatabaseOutlined,
  ClusterOutlined,
  CloudUploadOutlined,
  GlobalOutlined,
  EyeOutlined,
  LockOutlined,
  EnvironmentOutlined,
  TagsOutlined,
  TagOutlined,
  ExperimentOutlined,
  RocketOutlined,
  FireOutlined,
  InfoCircleOutlined,
  SafetyOutlined,
  UserOutlined,
  KeyOutlined,
  CloudSyncOutlined,
  ArrowLeftOutlined,
  ArrowRightOutlined,
  HddOutlined,
  ClockCircleOutlined,
  CloseCircleOutlined,
  StopOutlined,
  LoadingOutlined,
  PauseCircleOutlined,
  EllipsisOutlined,
  DisconnectOutlined,
  ExportOutlined,
  ClearOutlined,
  FileExcelOutlined,
} from '@ant-design/icons-vue';

import * as XLSX from 'xlsx';

// API 导入
import {
  getTreeCloudResourceListApi,
  getTreeCloudResourceDetailApi,
  updateTreeCloudResourceApi,
  deleteTreeCloudResourceApi,
  bindTreeCloudResourceApi,
  unBindTreeCloudResourceApi,
  syncTreeCloudResourceApi,
  getSyncHistoryApi,
  getChangeLogApi,
  updateCloudResourceStatusApi,
  CloudResourceType,
  CloudResourceStatus,
  ChargeType,
  AuthMode,
  SyncMode,
  type TreeCloudResource,
  type GetTreeCloudResourceListReq,
  type UpdateTreeCloudResourceReq,
  type SyncTreeCloudResourceReq,
  type KeyValue,
  type CloudResourceSyncHistory,
  type CloudResourceChangeLog,
} from '#/api/core/tree/tree_cloud';

import {
  getCloudAccountListApi,
  type CloudAccount,
} from '#/api/core/tree/tree_account';

import { getTreeList } from '#/api/core/tree/tree_node';
import type { TreeNode } from '#/api/core/tree/tree_local';

// ========== 状态定义 ==========
const router = useRouter();

// 加载状态
const loading = ref(false);
const detailLoading = ref(false);
const submitLoading = ref(false);
const syncLoading = ref(false);
const bindLoading = ref(false);
const unbindLoading = ref(false);
const syncHistoryLoading = ref(false);
const changeLogLoading = ref(false);

// 对话框显示状态
const editModalVisible = ref(false);
const syncModalVisible = ref(false);
const bindModalVisible = ref(false);
const unbindModalVisible = ref(false);
const detailVisible = ref(false);
const syncHistoryModalVisible = ref(false);
const changeLogModalVisible = ref(false);

// 数据列表
const resources = ref<TreeCloudResource[]>([]);
const cloudAccounts = ref<CloudAccount[]>([]);
const treeData = ref<TreeNode[]>([]);
const syncHistoryList = ref<CloudResourceSyncHistory[]>([]);
const changeLogList = ref<CloudResourceChangeLog[]>([]);

// 当前操作的资源
const currentResource = ref<TreeCloudResource | null>(null);
const currentDetail = ref<TreeCloudResource | null>(null);

// 表单数据
const editForm = reactive<UpdateTreeCloudResourceReq>({
  id: 0,
  environment: undefined,
  description: undefined,
  tags: [],
  port: undefined,
  username: undefined,
  password: undefined,
  key: undefined,
  auth_mode: undefined,
});

const syncForm = reactive<SyncTreeCloudResourceReq>({
  cloud_account_id: 0,
  resource_types: [],
  regions: [],
  instance_ids: [],
  sync_mode: SyncMode.FULL,
  auto_bind: false,
  bind_node_id: undefined,
});

// 标签输入
const newTagKey = ref('');
const newTagValue = ref('');

// 绑定/解绑节点选择
const selectedTreeNodeIds = ref<number[]>([]);
const selectedUnbindNodeIds = ref<number[]>([]);

// 过滤表单
const filterForm = reactive<GetTreeCloudResourceListReq>({
  page: 1,
  page_size: 10,
  search: undefined,
  cloud_account_id: undefined,
  resource_type: undefined,
  status: undefined,
  environment: undefined,
});

// 分页配置
const pagination = reactive({
  current: 1,
  pageSize: 10,
  total: 0,
});

const syncHistoryPagination = reactive({
  current: 1,
  pageSize: 10,
  total: 0,
  showSizeChanger: true,
  showQuickJumper: true,
  showTotal: (total: number) => `共 ${total} 条记录`,
  pageSizeOptions: ['10', '20', '50', '100'],
});

const changeLogPagination = reactive({
  current: 1,
  pageSize: 10,
  total: 0,
  showSizeChanger: true,
  showQuickJumper: true,
  showTotal: (total: number) => `共 ${total} 条记录`,
  pageSizeOptions: ['10', '20', '50', '100'],
});

// ========== 计算属性 ==========
// 统计数据
const stats = computed(() => {
  const total = pagination.total;
  const running = resources.value.filter(r => r.status === CloudResourceStatus.RUNNING).length;
  const ecs = resources.value.filter(r => r.resource_type === CloudResourceType.ECS).length;
  const bound = resources.value.filter(r => r.tree_nodes && r.tree_nodes.length > 0).length;
  return { total, running, ecs, bound };
});

// 分页配置
const paginationConfig = computed(() => ({
  current: pagination.current,
  pageSize: pagination.pageSize,
  total: pagination.total,
  showSizeChanger: true,
  showQuickJumper: true,
  showTotal: (total: number) => `共 ${total} 条记录`,
  pageSizeOptions: ['10', '20', '50', '100'],
}));

// 表格列定义
const columns = [
  { title: '资源名称', dataIndex: 'name', key: 'name', width: 200, fixed: 'left' as const },
  { title: '类型', dataIndex: 'resource_type', key: 'resource_type', width: 130 },
  { title: '云账户', dataIndex: 'cloud_account', key: 'cloud_account', width: 150 },
  { title: '实例信息', key: 'instance', width: 200 },
  { title: '配置', key: 'config', width: 150 },
  { title: 'IP地址', key: 'ip', width: 160 },
  { title: '状态', dataIndex: 'status', key: 'status', width: 110 },
  { title: '服务树', key: 'tree_nodes', width: 180 },
  { title: '月费用', key: 'cost', width: 120 },
  { title: '操作', key: 'action', width: 200, fixed: 'right' as const, align: 'center' as const },
];

// 同步历史列
const syncHistoryColumns = [
  { title: 'ID', dataIndex: 'id', key: 'id', width: 80 },
  { title: '同步状态', key: 'sync_status', width: 100 },
  { title: '同步模式', key: 'sync_mode', width: 100 },
  { title: '统计信息', key: 'stats', width: 350 },
  { title: '耗时', key: 'duration', width: 100 },
  { title: '开始时间', key: 'start_time', width: 180 },
];

// 变更日志列
const changeLogColumns = [
  { title: '资源ID', dataIndex: 'resource_id', key: 'resource_id', width: 100 },
  { title: '实例ID', dataIndex: 'instance_id', key: 'instance_id', width: 150 },
  { title: '变更类型', key: 'change_type', width: 120 },
  { title: '变更信息', key: 'change_info', width: 350 },
  { title: '操作人', key: 'operator', width: 150 },
  { title: '变更时间', key: 'change_time', width: 180 },
];

// ========== 辅助方法 ==========
const getResourceTypeColor = (type: CloudResourceType): string => {
  const colors: Record<CloudResourceType, string> = {
    [CloudResourceType.ECS]: '#1890ff',
    [CloudResourceType.RDS]: '#52c41a',
    [CloudResourceType.SLB]: '#fa8c16',
    [CloudResourceType.OSS]: '#722ed1',
    [CloudResourceType.VPC]: '#13c2c2',
    [CloudResourceType.OTHER]: '#8c8c8c',
  };
  return colors[type] || '#d9d9d9';
};

const getResourceTypeText = (type: CloudResourceType): string => {
  const texts: Record<CloudResourceType, string> = {
    [CloudResourceType.ECS]: '云服务器',
    [CloudResourceType.RDS]: '云数据库',
    [CloudResourceType.SLB]: '负载均衡',
    [CloudResourceType.OSS]: '对象存储',
    [CloudResourceType.VPC]: '虚拟私有云',
    [CloudResourceType.OTHER]: '其他',
  };
  return texts[type] || '未知';
};

const getResourceTypeIcon = (type: CloudResourceType) => {
  const icons: Record<CloudResourceType, any> = {
    [CloudResourceType.ECS]: DesktopOutlined,
    [CloudResourceType.RDS]: DatabaseOutlined,
    [CloudResourceType.SLB]: ClusterOutlined,
    [CloudResourceType.OSS]: CloudUploadOutlined,
    [CloudResourceType.VPC]: GlobalOutlined,
    [CloudResourceType.OTHER]: CloudOutlined,
  };
  return icons[type] || CloudOutlined;
};

const getEnvironmentColor = (environment?: string): string => {
  const colors: Record<string, string> = {
    dev: '#1890ff',
    test: '#faad14',
    staging: '#722ed1',
    prod: '#f5222d',
  };
  return colors[environment || ''] || '#d9d9d9';
};

const getEnvironmentText = (environment?: string): string => {
  const texts: Record<string, string> = {
    dev: '开发',
    test: '测试',
    staging: '预发布',
    prod: '生产',
  };
  return texts[environment || ''] || '-';
};

const getStatusBadgeType = (status: CloudResourceStatus): 'success' | 'error' | 'processing' | 'warning' | 'default' => {
  const types: Record<CloudResourceStatus, any> = {
    [CloudResourceStatus.RUNNING]: 'success',
    [CloudResourceStatus.STOPPED]: 'error',
    [CloudResourceStatus.STARTING]: 'processing',
    [CloudResourceStatus.STOPPING]: 'warning',
    [CloudResourceStatus.DELETED]: 'default',
    [CloudResourceStatus.UNKNOWN]: 'default',
  };
  return types[status] || 'default';
};

const getStatusText = (status: CloudResourceStatus): string => {
  const texts: Record<CloudResourceStatus, string> = {
    [CloudResourceStatus.RUNNING]: '运行中',
    [CloudResourceStatus.STOPPED]: '已停止',
    [CloudResourceStatus.STARTING]: '启动中',
    [CloudResourceStatus.STOPPING]: '停止中',
    [CloudResourceStatus.DELETED]: '已删除',
    [CloudResourceStatus.UNKNOWN]: '未知',
  };
  return texts[status] || '未知';
};

const getChangeTypeColor = (type: string): string => {
  const colors: Record<string, string> = {
    create: '#52c41a',
    update: '#1890ff',
    delete: '#f5222d',
    sync: '#722ed1',
  };
  return colors[type] || '#d9d9d9';
};

const getChangeTypeText = (type: string): string => {
  const texts: Record<string, string> = {
    create: '创建',
    update: '更新',
    delete: '删除',
    sync: '同步',
  };
  return texts[type] || type;
};

const getAvatarColor = (name: string): string => {
  const colors = ['#f56a00', '#7265e6', '#ffbf00', '#00a2ae', '#1890ff', '#52c41a'];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length] || '#1890ff';
};

const getInitials = (name: string): string => {
  if (!name) return '?';
  return name.slice(0, 2).toUpperCase();
};

const formatDateTime = (dateTime?: string): string => {
  if (!dateTime) return '-';
  try {
    return new Date(dateTime).toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return dateTime;
  }
};

const formatCost = (cost: number): string => {
  return cost.toFixed(2);
};

const truncateText = (text: string, maxLength: number): string => {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength) + '...';
};

const fetchTreeData = async (): Promise<void> => {
  try {
    const response = await getTreeList();
    treeData.value = (response as any).items || [];
  } catch (error) {
    console.error('获取服务树数据失败', error);
  }
};

const fetchCloudAccounts = async (): Promise<void> => {
  try {
    let allAccounts: CloudAccount[] = [];
    let currentPage = 1;
    const pageSize = 100;
    let hasMore = true;

    while (hasMore) {
      const response = await getCloudAccountListApi({ 
        page: currentPage, 
        size: pageSize 
      });
      const items = (response as any).items || [];
      const total = (response as any).total || 0;
      
      allAccounts = [...allAccounts, ...items];
      
      if (items.length < pageSize || allAccounts.length >= total) {
        hasMore = false;
      } else {
        currentPage++;
      }
    }
    
    cloudAccounts.value = allAccounts;
  } catch (error) {
    console.error('获取云账户列表失败', error);
    cloudAccounts.value = [];
  }
};

// ========== 数据获取方法 ==========
const fetchResources = async (): Promise<void> => {
  loading.value = true;
  try {
    const params: GetTreeCloudResourceListReq = {
      page: pagination.current,
      page_size: pagination.pageSize,
      search: filterForm.search,
      cloud_account_id: filterForm.cloud_account_id,
      resource_type: filterForm.resource_type,
      status: filterForm.status,
      environment: filterForm.environment,
    };

    const response = await getTreeCloudResourceListApi(params);
    const data = (response as any);
    resources.value = (data.items || []).map((item: TreeCloudResource) => ({
      ...item,
      tree_nodes: item.tree_nodes || [],
      tags: item.tags || [],
    }));
    pagination.total = data.total || 0;
  } catch (error) {
    message.error('获取资源列表失败');
    resources.value = [];
    pagination.total = 0;
  } finally {
    loading.value = false;
  }
};

// 获取同步历史
const fetchSyncHistory = async (): Promise<void> => {
  syncHistoryLoading.value = true;
  try {
    const response = await getSyncHistoryApi({
      page: syncHistoryPagination.current,
      size: syncHistoryPagination.pageSize,
    });
    const data = (response as any);
    syncHistoryList.value = data.items || [];
    syncHistoryPagination.total = data.total || 0;
  } catch (error) {
    message.error('获取同步历史失败');
  } finally {
    syncHistoryLoading.value = false;
  }
};

// 获取变更日志
const fetchChangeLog = async (): Promise<void> => {
  changeLogLoading.value = true;
  try {
    const response = await getChangeLogApi({
      page: changeLogPagination.current,
      size: changeLogPagination.pageSize,
    });
    const data = (response as any);
    changeLogList.value = data.items || [];
    changeLogPagination.total = data.total || 0;
  } catch (error) {
    message.error('获取变更日志失败');
  } finally {
    changeLogLoading.value = false;
  }
};

// ========== 事件处理方法 ==========
const handleTableChange = (pag: any): void => {
  pagination.current = pag.current || pagination.current;
  pagination.pageSize = pag.pageSize || pagination.pageSize;
  fetchResources();
};

const handleSearch = (): void => {
  pagination.current = 1;
  fetchResources();
};

const handleRefresh = (): void => {
  fetchResources();
  message.success('刷新成功');
};

const resetFilter = (): void => {
  Object.assign(filterForm, {
    page: 1,
    page_size: pagination.pageSize, // 使用当前的分页大小
    search: undefined,
    cloud_account_id: undefined,
    resource_type: undefined,
    status: undefined,
    environment: undefined,
  });
  pagination.current = 1;
  fetchResources();
};

const showSyncModal = (): void => {
  if (cloudAccounts.value.length === 0) {
    message.warning('请先添加云账户');
    return;
  }
  Object.assign(syncForm, {
    cloud_account_id: cloudAccounts.value[0]?.id || 0,
    resource_types: [],
    regions: [],
    instance_ids: [],
    sync_mode: SyncMode.FULL,
    auto_bind: false,
    bind_node_id: undefined,
  });
  syncModalVisible.value = true;
};

const showSyncHistoryModal = async (): Promise<void> => {
  syncHistoryModalVisible.value = true;
  await fetchSyncHistory();
};

const showChangeLogModal = async (): Promise<void> => {
  changeLogModalVisible.value = true;
  await fetchChangeLog();
};

const handleEdit = (record: TreeCloudResource): void => {
  currentResource.value = record;
  Object.assign(editForm, {
    id: record.id,
    environment: record.environment,
    description: record.description,
    tags: Array.isArray(record.tags) ? [...record.tags] : [],
    port: record.port,
    username: record.username,
    password: undefined,
    key: undefined,
    auth_mode: record.auth_mode,
  });
  editModalVisible.value = true;
  if (detailVisible.value) {
    detailVisible.value = false;
  }
};

const handleViewDetail = async (record: TreeCloudResource): Promise<void> => {
  detailVisible.value = true;
  detailLoading.value = true;
  currentDetail.value = record;

  try {
    const response = await getTreeCloudResourceDetailApi(record.id);
    const data = (response as any).data || response;
    currentDetail.value = {
      ...data,
      tree_nodes: data.tree_nodes || []
    };
  } catch (error) {
    message.error('获取资源详情失败');
  } finally {
    detailLoading.value = false;
  }
};

// 标签管理
const addTag = (): void => {
  const key = newTagKey.value.trim();
  const value = newTagValue.value.trim();
  
  if (!key || !value) {
    message.warning('请输入完整的标签信息');
    return;
  }
  
  if (!Array.isArray(editForm.tags)) {
    editForm.tags = [];
  }

  if (editForm.tags.some((tag: KeyValue) => tag.key === key)) {
    message.warning('标签Key已存在');
    return;
  }
  
  editForm.tags.push({ key, value });
  newTagKey.value = '';
  newTagValue.value = '';
};

const removeTag = (index: number): void => {
  if (Array.isArray(editForm.tags) && editForm.tags.length > index) {
    editForm.tags.splice(index, 1);
  }
};

// 更新资源
const handleUpdate = async (): Promise<void> => {
  try {
    submitLoading.value = true;
    const { id, ...updateData } = editForm;
    await updateTreeCloudResourceApi(id, updateData as Omit<UpdateTreeCloudResourceReq, 'id'>);
    message.success('更新成功');
    editModalVisible.value = false;
    await fetchResources();
    
    if (detailVisible.value && currentDetail.value?.id === id) {
      const response = await getTreeCloudResourceDetailApi(id);
      currentDetail.value = (response as any).data || response;
    }
  } catch (error) {
    message.error('更新失败');
  } finally {
    submitLoading.value = false;
  }
};

// 同步资源
const handleSync = async (): Promise<void> => {
  if (!syncForm.cloud_account_id) {
    message.warning('请选择云账户');
    return;
  }

  syncLoading.value = true;
  try {
    const response = await syncTreeCloudResourceApi(syncForm);
    const result = (response as any).data || response;
    message.success(`同步成功！新增${result.new_count || 0}，更新${result.update_count || 0}`);
    syncModalVisible.value = false;
    await fetchResources();
  } catch (error) {
    message.error('同步失败');
  } finally {
    syncLoading.value = false;
  }
};

const handleSyncHistoryTableChange = (pag: any): void => {
  syncHistoryPagination.current = pag.current;
  syncHistoryPagination.pageSize = pag.pageSize;
  fetchSyncHistory();
};

const handleChangeLogTableChange = (pag: any): void => {
  changeLogPagination.current = pag.current;
  changeLogPagination.pageSize = pag.pageSize;
  fetchChangeLog();
};

// 绑定服务树
const showBindModal = (record: TreeCloudResource): void => {
  currentResource.value = record;
  selectedTreeNodeIds.value = record.tree_nodes?.map(n => n.id) || [];
  bindModalVisible.value = true;
};

const handleBind = async (): Promise<void> => {
  if (!currentResource.value || selectedTreeNodeIds.value.length === 0) {
    message.warning('请选择要绑定的服务树节点');
    return;
  }

  bindLoading.value = true;
  try {
    await bindTreeCloudResourceApi(currentResource.value.id, {
      tree_node_ids: selectedTreeNodeIds.value,
    });
    message.success('绑定成功');
    bindModalVisible.value = false;
    await fetchResources();
    
    if (detailVisible.value && currentDetail.value?.id === currentResource.value.id) {
      const response = await getTreeCloudResourceDetailApi(currentResource.value.id);
      currentDetail.value = (response as any).data || response;
    }
  } catch (error) {
    message.error('绑定失败');
  } finally {
    bindLoading.value = false;
  }
};

// 解绑服务树
const showUnbindModal = (record: TreeCloudResource): void => {
  currentResource.value = record;
  selectedUnbindNodeIds.value = [];
  unbindModalVisible.value = true;
};

const handleUnbind = async (): Promise<void> => {
  if (!currentResource.value || selectedUnbindNodeIds.value.length === 0) {
    message.warning('请选择要解绑的节点');
    return;
  }

  unbindLoading.value = true;
  try {
    await unBindTreeCloudResourceApi(currentResource.value.id, {
      tree_node_ids: selectedUnbindNodeIds.value,
    });
    message.success('解绑成功');
    unbindModalVisible.value = false;
    selectedUnbindNodeIds.value = [];
    await fetchResources();
    
    if (detailVisible.value && currentDetail.value?.id === currentResource.value.id) {
      const response = await getTreeCloudResourceDetailApi(currentResource.value.id);
      currentDetail.value = (response as any).data || response;
    }
  } catch (error) {
    message.error('解绑失败');
  } finally {
    unbindLoading.value = false;
  }
};

// 更新资源状态
const handleUpdateStatus = async (record: TreeCloudResource, newStatus: CloudResourceStatus): Promise<void> => {
  try {
    await updateCloudResourceStatusApi(record.id, { status: newStatus });
    message.success('状态更新成功');
    await fetchResources();
    
    if (detailVisible.value && currentDetail.value?.id === record.id) {
      const response = await getTreeCloudResourceDetailApi(record.id);
      currentDetail.value = (response as any).data || response;
    }
  } catch (error) {
    message.error('状态更新失败');
  }
};

// 连接终端
const handleConnectTerminal = (record: TreeCloudResource): void => {
  if (record.resource_type !== CloudResourceType.ECS) {
    message.warning('只有云服务器支持终端连接');
    return;
  }
  router.push({ 
    name: 'TerminalConnect', 
    query: { id: String(record.id), type: 'cloud' } 
  });
};

// 删除资源
const handleDelete = async (record: TreeCloudResource): Promise<void> => {
  Modal.confirm({
    title: '确认删除',
    content: `确定要删除资源 "${record.name}" 吗？此操作不可恢复。`,
    okText: '确定删除',
    okType: 'danger',
    cancelText: '取消',
    onOk: async () => {
      try {
        await deleteTreeCloudResourceApi(record.id);
        message.success('删除成功');
        
        if (detailVisible.value && currentDetail.value?.id === record.id) {
          detailVisible.value = false;
        }
        
        await fetchResources();
      } catch (error) {
        message.error('删除失败');
      }
    },
  });
};

// ========== 导出功能 ==========
const handleExportCurrent = () => {
  exportToExcel(resources.value);
};

const handleExportAll = async () => {
  const hide = message.loading('正在导出所有数据...', 0);
  try {
    const allData: TreeCloudResource[] = [];
    let currentPage = 1;
    const pageSize = 100;
    let hasMore = true;

    while (hasMore) {
      const params: GetTreeCloudResourceListReq = {
        page: currentPage,
        page_size: pageSize,
        search: filterForm.search,
        cloud_account_id: filterForm.cloud_account_id,
        resource_type: filterForm.resource_type,
        status: filterForm.status,
        environment: filterForm.environment,
      };

      const response = await getTreeCloudResourceListApi(params);
      const data = (response as any);
      const items = (data.items || []).map((item: TreeCloudResource) => ({
        ...item,
        tree_nodes: item.tree_nodes || [],
        tags: item.tags || [],
      }));
      const total = data.total || 0;

      allData.push(...items);

      if (items.length < pageSize || allData.length >= total) {
        hasMore = false;
      } else {
        currentPage++;
      }
    }

    hide();
    exportToExcel(allData);
  } catch (error) {
    hide();
    message.error('导出失败');
  }
};

const exportToExcel = (data: TreeCloudResource[]) => {
  if (!data || data.length === 0) {
    message.warning('没有可导出的数据');
    return;
  }

  // 准备导出数据
  const exportData = data.map((item) => ({
    '资源名称': item.name,
    '资源类型': getResourceTypeText(item.resource_type),
    '云账户': item.cloud_account?.name || '-',
    '实例ID': item.instance_id || '-',
    '实例类型': item.instance_type || '-',
    '状态': getStatusText(item.status),
    '环境': item.environment ? getEnvironmentText(item.environment) : '-',
    '地域': item.region || '-',
    '可用区': item.zone_id || '-',
    'CPU核数': item.cpu || 0,
    '内存(GB)': item.memory || 0,
    '磁盘(GB)': item.disk || 0,
    '公网IP': item.public_ip || '-',
    '私网IP': item.private_ip || '-',
    '操作系统': item.os_name || '-',
    '计费方式': item.charge_type === ChargeType.PRE_PAID ? '包年包月' : '按量付费',
    '月成本': `${item.monthly_cost || 0} ${item.currency || 'CNY'}`,
    '到期时间': item.expire_time ? formatDateTime(item.expire_time) : '-',
    '服务树节点': item.tree_nodes?.map(n => n.name).join(', ') || '-',
    '创建人': item.create_user_name || '-',
    '创建时间': formatDateTime(item.created_at),
    '更新时间': formatDateTime(item.updated_at),
    '描述': item.description || '-',
  }));

  // 创建工作簿和工作表
  const worksheet = XLSX.utils.json_to_sheet(exportData);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, '云资源列表');

  // 设置列宽
  const colWidths = [
    { wch: 25 }, // 资源名称
    { wch: 12 }, // 资源类型
    { wch: 20 }, // 云账户
    { wch: 20 }, // 实例ID
    { wch: 15 }, // 实例类型
    { wch: 10 }, // 状态
    { wch: 10 }, // 环境
    { wch: 15 }, // 地域
    { wch: 15 }, // 可用区
    { wch: 8 },  // CPU
    { wch: 10 }, // 内存
    { wch: 10 }, // 磁盘
    { wch: 15 }, // 公网IP
    { wch: 15 }, // 私网IP
    { wch: 20 }, // 操作系统
    { wch: 12 }, // 计费方式
    { wch: 15 }, // 月成本
    { wch: 20 }, // 到期时间
    { wch: 30 }, // 服务树节点
    { wch: 15 }, // 创建人
    { wch: 20 }, // 创建时间
    { wch: 20 }, // 更新时间
    { wch: 30 }, // 描述
  ];
  worksheet['!cols'] = colWidths;

  // 导出文件
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').substring(0, 19);
  const filename = `云资源列表_${timestamp}.xlsx`;
  XLSX.writeFile(workbook, filename);
  message.success(`导出成功：${filename}`);
};

onMounted(async () => {
  try {
    await Promise.all([
      fetchTreeData(),
      fetchCloudAccounts(),
      fetchResources(),
    ]);
  } catch (error) {
    message.error('页面加载失败');
  }
});
</script>

<style scoped lang="scss">
.cloud-resource-manager {
  padding: 12px;
  min-height: 100vh;

  .page-header {
    margin-bottom: 20px;
  }
  
  .header-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 12px;
    align-items: center;
  }

  .btn-create {
    flex-shrink: 0;
  }
  
  .btn-action {
    flex-shrink: 0;
  }

  .btn-text {
    margin-left: 4px;
  }

  .stats-row {
    margin-bottom: 20px;
  }

  .stats-card {
    border-radius: 8px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
    height: 100%;
  }

  .filter-section {
    margin-bottom: 20px;

    .filter-card {
      border-radius: 8px;
      border: 1px solid #f0f0f0;
      box-shadow: none;

      :deep(.ant-card-body) {
        padding: 16px;
      }
    }

    .filter-form {
      :deep(.ant-form-item) {
        margin-bottom: 0;
        margin-right: 16px;

        &:last-child {
          margin-right: 0;
        }
      }

      :deep(.ant-form-item-label) {
        font-weight: 500;
        color: #374151;
      }
    }
  }

  .table-section {
    margin-bottom: 24px;
    
    .table-card {
      border-radius: 8px;
      border: 1px solid #f0f0f0;
      box-shadow: none;

      :deep(.ant-card-body) {
        padding: 0;
      }
    }

    .resource-table {
      :deep(.ant-table) {
        border-radius: 8px;
        overflow: hidden;
      }

      :deep(.ant-table-thead > tr > th) {
        white-space: nowrap;
        background-color: #fafafa;
        font-weight: 600;
        color: #374151;
      }

      :deep(.ant-table-tbody > tr > td) {
        word-break: break-word;
      }

      :deep(.ant-table-tbody > tr:hover > td) {
        background-color: #fafafa;
      }

      :deep(.ant-table-cell) {
        padding: 12px 16px;
      }
    }

    // 表格单元格样式
    .name-cell {
      display: flex;
      align-items: center;
      gap: 8px;

      .resource-name {
        font-weight: 500;
        color: #1890ff;
        cursor: pointer;
        transition: all 0.2s;

        &:hover {
          color: #40a9ff;
          text-decoration: underline;
        }
      }

      .env-tag {
        margin-left: 4px;
      }
    }

    .type-tag {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 4px 12px;
      font-weight: 500;
      border-radius: 6px;

      .tag-icon {
        font-size: 14px;
      }
    }

    .account-cell {
      display: flex;
      align-items: center;
      gap: 6px;

      .account-icon {
        color: #1890ff;
      }
    }

    .instance-info,
    .config-info,
    .ip-info {
      font-size: 13px;

      .info-row,
      .config-item,
      .ip-row {
        display: flex;
        align-items: center;
        gap: 6px;
        margin-bottom: 4px;

        &:last-child {
          margin-bottom: 0;
        }
      }

      .info-label {
        color: #6b7280;
        font-weight: 500;
      }

      .info-value {
        color: #374151;
      }

      .info-icon,
      .config-icon,
      .ip-icon {
        font-size: 12px;
        color: #9ca3af;

        &.public {
          color: #1890ff;
        }

        &.private {
          color: #52c41a;
        }
      }
    }

    .ip-text {
      font-family: 'Monaco', 'Consolas', monospace;
      font-size: 12px;
    }

    .status-badge {
      cursor: pointer;
      user-select: none;

      &.clickable:hover {
        opacity: 0.8;
      }
    }

    .nodes-wrapper {
      display: flex;
      flex-wrap: wrap;
      gap: 4px;

      .node-tag {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        font-size: 12px;
      }
    }

    .cost-cell {
      display: flex;
      align-items: baseline;
      gap: 2px;

      .cost-symbol {
        font-size: 14px;
        color: #f5222d;
        font-weight: 600;
      }

      .cost-amount {
        font-size: 16px;
        font-weight: 700;
        color: #f5222d;
      }

      .cost-unit {
        font-size: 12px;
        color: #6b7280;
      }
    }

    .action-buttons {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 4px;

      :deep(.ant-btn-text) {
        color: #6b7280;
        transition: all 0.2s;

        &:hover {
          color: #1890ff;
          background: #e6f7ff;
        }
      }
    }

    .empty-text {
      color: #9ca3af;
      font-size: 13px;
    }
  }

  .modern-modal {
    :deep(.ant-modal) {
      max-width: calc(100vw - 16px);
      margin: 8px;
    }

    :deep(.ant-modal-content) {
      border-radius: 8px;
      box-shadow: 0 4px 16px rgba(0, 0, 0, 0.1);
    }

    :deep(.ant-modal-header) {
      border-bottom: 1px solid #f0f0f0;
      padding: 16px 24px;
    }

    :deep(.ant-modal-title) {
      font-size: 16px;
      font-weight: 600;
      color: #1f2937;
    }

    :deep(.ant-modal-body) {
      padding: 20px 24px;
    }

    :deep(.ant-divider-horizontal.ant-divider-with-text-left) {
      margin: 20px 0 12px 0;
      font-weight: 600;
      color: #374151;
    }

    .edit-form,
    .sync-form {
      :deep(.ant-form-item-label > label) {
        font-weight: 500;
        color: #374151;
      }
    }

    .form-tip {
      margin-top: 8px;
      font-size: 12px;
      color: #9ca3af;
    }

    .sync-mode-radio {
      display: block;
      height: auto;
      line-height: 1.5;
      padding: 12px 16px;
      margin-bottom: 12px;
      border: 2px solid #e5e7eb;
      border-radius: 8px;
      transition: all 0.3s;

      &:hover {
        border-color: #1890ff;
      }

      .radio-content {
        .radio-title {
          font-weight: 600;
          color: #374151;
          margin-bottom: 4px;
          display: flex;
          align-items: center;
          gap: 6px;
        }

        .radio-desc {
          font-size: 12px;
          color: #6b7280;
        }
      }
    }

    .tags-editor {
      .tags-list {
        margin-bottom: 16px;
        display: flex;
        flex-wrap: wrap;
        gap: 8px;

        .tag-item {
          font-size: 13px;
          padding: 4px 12px;
        }
      }

      .tag-input-group {
        display: flex;
        gap: 12px;
        flex-wrap: wrap;
      }
    }

    .current-bindings {
      .binding-title {
        font-weight: 600;
        margin-bottom: 8px;
      }

      .binding-tags {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
      }
    }

    .unbind-checkbox {
      padding: 8px 12px;
      border: 1px solid #e5e7eb;
      border-radius: 6px;
      transition: all 0.2s;

      &:hover {
        background: #f8fafc;
        border-color: #1890ff;
      }
    }

    .change-detail {
      font-size: 13px;

      .change-field,
      .change-old,
      .change-new {
        margin-bottom: 4px;
        display: flex;
        align-items: flex-start;
        gap: 6px;
      }

      .change-old {
        color: #f5222d;
      }

      .change-new {
        color: #52c41a;
      }
    }
  }

  .detail-drawer {
    :deep(.ant-drawer-header) {
      border-bottom: 1px solid #f0f0f0;
      padding: 16px 24px;
    }

    :deep(.ant-drawer-title) {
      font-size: 18px;
      font-weight: 600;
      color: #1f2937;
    }

    :deep(.ant-drawer-body) {
      padding: 20px;
    }

    .detail-content {
      margin-bottom: 20px;
    }

    .detail-header {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 20px;
      flex-wrap: wrap;
      
      h2 {
        margin: 0;
        font-size: 24px;
        color: #1f2937;
        word-break: break-all;
      }
    }

    .detail-badges {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
    }

    .detail-section {
      margin-top: 24px;
      
      .section-title {
        font-size: 16px;
        font-weight: 600;
        color: #1a1a1a;
        margin-bottom: 16px;
        padding-left: 12px;
        border-left: 4px solid #1890ff;
      }
      
      .section-content {
        .detail-tag {
          margin-right: 8px;
          margin-bottom: 8px;
          font-size: 13px;
          padding: 4px 12px;
        }
      }
    }

    .cost-display {
      font-weight: 600;
      color: #f5222d;
    }

    .drawer-actions {
      display: flex;
      justify-content: space-between;
      margin-top: 24px;
      padding-top: 16px;
      border-top: 1px solid #f0f0f0;
    }
  }

  @media (max-width: 768px) {
    padding: 8px;

    .header-actions {
      flex-direction: column;
      align-items: stretch;
      
      .btn-text {
        display: inline;
      }
    }

    .stats-card :deep(.ant-statistic-title) {
      font-size: 12px;
    }

    .stats-card :deep(.ant-statistic-content) {
      font-size: 16px;
    }

    .filter-section {
      .filter-form {
        :deep(.ant-form-item) {
          margin-right: 0;
          margin-bottom: 12px;
          width: 100%;

          .ant-input,
          .ant-select {
            width: 100% !important;
          }
        }
      }
    }

    .action-buttons {
      gap: 2px;
      
      .ant-btn {
        padding: 0 4px;
        font-size: 12px;
      }
    }

    .drawer-actions {
      flex-direction: column;
      gap: 8px;
      
      .ant-btn-group {
        display: flex;
        flex-direction: column;
        width: 100%;
      }

      .ant-btn {
        width: 100%;
      }
    }
    
    .modern-modal :deep(.ant-modal-body) {
      padding: 16px;
      max-height: calc(100vh - 160px);
      overflow-y: auto;
    }
  }

  @media (max-width: 480px) {
    padding: 4px;
    
    .stats-card {
      text-align: center;
    }
    
    .modern-modal :deep(.ant-modal) {
      margin: 4px;
      max-width: calc(100vw - 8px);
    }
  }
}
</style>
