<template>
  <div class="cloud-resource-management">
    <!-- 顶部操作栏 -->
    <div class="page-header">
      <div class="header-left">
        <h1 class="page-title">云资源管理</h1>
        <a-space>
          <a-button type="primary" @click="showSyncModal">
            <template #icon><sync-outlined /></template>
            同步资源
          </a-button>
          <a-button @click="handleRefresh">
            <template #icon><reload-outlined /></template>
            刷新
          </a-button>
          <a-dropdown>
            <a-button>
              更多操作 <down-outlined />
            </a-button>
            <template #overlay>
              <a-menu>
                <a-menu-item @click="showSyncHistoryModal">
                  <history-outlined /> 同步历史
                </a-menu-item>
                <a-menu-item @click="showChangeLogModal">
                  <file-text-outlined /> 变更日志
                </a-menu-item>
              </a-menu>
            </template>
          </a-dropdown>
        </a-space>
      </div>
    </div>

    <!-- 搜索过滤区 -->
    <div class="filter-section">
      <a-card>
        <a-form layout="inline" class="filter-form">
          <a-form-item label="搜索">
            <a-input
              v-model:value="filterForm.search"
              placeholder="资源名称/实例ID/IP"
              allow-clear
              style="width: 220px"
              @pressEnter="handleSearch"
            >
              <template #prefix><search-outlined /></template>
            </a-input>
          </a-form-item>
          <a-form-item label="云账户">
            <a-select
              v-model:value="filterForm.cloud_account_id"
              placeholder="全部"
              allow-clear
              style="width: 160px"
              @change="handleSearch"
            >
              <a-select-option v-for="account in cloudAccounts" :key="account.id" :value="account.id">
                {{ account.name }}
              </a-select-option>
            </a-select>
          </a-form-item>
          <a-form-item label="资源类型">
            <a-select
              v-model:value="filterForm.resource_type"
              placeholder="全部"
              allow-clear
              style="width: 130px"
              @change="handleSearch"
            >
              <a-select-option :value="CloudResourceType.ECS">云服务器</a-select-option>
              <a-select-option :value="CloudResourceType.RDS">云数据库</a-select-option>
              <a-select-option :value="CloudResourceType.SLB">负载均衡</a-select-option>
              <a-select-option :value="CloudResourceType.OSS">对象存储</a-select-option>
              <a-select-option :value="CloudResourceType.VPC">虚拟私有云</a-select-option>
              <a-select-option :value="CloudResourceType.OTHER">其他</a-select-option>
            </a-select>
          </a-form-item>
          <a-form-item label="状态">
            <a-select
              v-model:value="filterForm.status"
              placeholder="全部"
              allow-clear
              style="width: 120px"
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
              placeholder="全部"
              allow-clear
              style="width: 110px"
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
              <a-button type="primary" @click="handleSearch">查询</a-button>
              <a-button @click="resetFilter">重置</a-button>
            </a-space>
          </a-form-item>
        </a-form>
      </a-card>
    </div>

    <!-- 统计卡片 -->
    <div class="stats-section">
      <a-row :gutter="16">
        <a-col :xs="24" :sm="12" :md="6">
          <a-card :bordered="false" class="stat-card">
            <a-statistic 
              title="总资源数" 
              :value="stats.total"
              :value-style="{ color: '#3f8600' }"
            >
              <template #prefix><cloud-server-outlined /></template>
            </a-statistic>
          </a-card>
        </a-col>
        <a-col :xs="24" :sm="12" :md="6">
          <a-card :bordered="false" class="stat-card">
            <a-statistic 
              title="运行中" 
              :value="stats.running"
              :value-style="{ color: '#52c41a' }"
            >
              <template #prefix><check-circle-outlined /></template>
            </a-statistic>
          </a-card>
        </a-col>
        <a-col :xs="24" :sm="12" :md="6">
          <a-card :bordered="false" class="stat-card">
            <a-statistic 
              title="云服务器" 
              :value="stats.ecs"
              :value-style="{ color: '#1890ff' }"
            >
              <template #prefix><desktop-outlined /></template>
            </a-statistic>
          </a-card>
        </a-col>
        <a-col :xs="24" :sm="12" :md="6">
          <a-card :bordered="false" class="stat-card">
            <a-statistic 
              title="已绑定节点" 
              :value="stats.bound"
              :value-style="{ color: '#722ed1' }"
            >
              <template #prefix><apartment-outlined /></template>
            </a-statistic>
          </a-card>
        </a-col>
      </a-row>
    </div>

    <!-- 资源列表 -->
    <div class="table-section">
      <a-card :bordered="false">
        <a-table
          :columns="columns"
          :data-source="resources"
          :loading="loading"
          :pagination="pagination"
          @change="handleTableChange"
          row-key="id"
          :scroll="{ x: 1600 }"
        >
          <!-- 资源名称 -->
          <template #bodyCell="{ column, record }">
            <template v-if="column.key === 'name'">
              <div class="name-cell">
                <a-badge :status="getStatusBadgeType(record.status)" />
                <a class="name-link" @click="handleViewDetail(record)">{{ record.name }}</a>
              </div>
            </template>

            <!-- 资源类型 -->
            <template v-else-if="column.key === 'resource_type'">
              <a-tag :color="getResourceTypeColor(record.resource_type)">
                <component :is="getResourceTypeIcon(record.resource_type)" />
                {{ getResourceTypeText(record.resource_type) }}
              </a-tag>
            </template>

            <!-- 云账户 -->
            <template v-else-if="column.key === 'cloud_account'">
              <span v-if="record.cloud_account">{{ record.cloud_account.name }}</span>
              <span v-else class="text-gray">-</span>
            </template>

            <!-- 实例信息 -->
            <template v-else-if="column.key === 'instance'">
              <div class="instance-cell">
                <div v-if="record.instance_id" class="info-line">
                  <span class="label">ID:</span>
                  <span class="value">{{ record.instance_id }}</span>
                </div>
                <div v-if="record.instance_type" class="info-line">
                  <span class="label">规格:</span>
                  <span class="value">{{ record.instance_type }}</span>
                </div>
              </div>
            </template>

            <!-- 配置信息 -->
            <template v-else-if="column.key === 'config'">
              <div class="config-cell">
                <span v-if="record.cpu">{{ record.cpu }}核</span>
                <span v-if="record.memory"> / {{ record.memory }}GB</span>
                <span v-if="record.disk"> / {{ record.disk }}GB</span>
                <span v-if="!record.cpu && !record.memory && !record.disk" class="text-gray">-</span>
              </div>
            </template>

            <!-- IP信息 -->
            <template v-else-if="column.key === 'ip'">
              <div class="ip-cell">
                <div v-if="record.public_ip" class="info-line">
                  <global-outlined class="ip-icon" />
                  <span>{{ record.public_ip }}</span>
                </div>
                <div v-if="record.private_ip" class="info-line">
                  <lock-outlined class="ip-icon" />
                  <span>{{ record.private_ip }}</span>
                </div>
                <span v-if="!record.public_ip && !record.private_ip" class="text-gray">-</span>
              </div>
            </template>

            <!-- 状态 -->
            <template v-else-if="column.key === 'status'">
              <a-badge :status="getStatusBadgeType(record.status)" :text="getStatusText(record.status)" />
            </template>

            <!-- 环境 -->
            <template v-else-if="column.key === 'environment'">
              <a-tag :color="getEnvironmentColor(record.environment)">
                {{ getEnvironmentText(record.environment) }}
              </a-tag>
            </template>

            <!-- 服务树节点 -->
            <template v-else-if="column.key === 'tree_nodes'">
              <div v-if="record.tree_nodes && record.tree_nodes.length > 0" class="nodes-cell">
                <a-tag v-for="node in record.tree_nodes.slice(0, 2)" :key="node.id" color="blue">
                  {{ node.name }}
                </a-tag>
                <a-tag v-if="record.tree_nodes.length > 2">+{{ record.tree_nodes.length - 2 }}</a-tag>
              </div>
              <span v-else class="text-gray">未绑定</span>
            </template>

            <!-- 费用 -->
            <template v-else-if="column.key === 'cost'">
              <div v-if="record.monthly_cost" class="cost-cell">
                <span class="cost-amount">¥{{ record.monthly_cost }}</span>
                <span class="cost-unit">/月</span>
              </div>
              <span v-else class="text-gray">-</span>
            </template>

            <!-- 操作 -->
            <template v-else-if="column.key === 'action'">
              <a-space :size="8">
                <a-tooltip title="查看详情">
                  <a-button type="link" size="small" @click="handleViewDetail(record)">
                    <eye-outlined />
                  </a-button>
                </a-tooltip>
                <a-tooltip title="编辑">
                  <a-button type="link" size="small" @click="handleEdit(record)">
                    <edit-outlined />
                  </a-button>
                </a-tooltip>
                <a-tooltip title="绑定服务树">
                  <a-button type="link" size="small" @click="showBindModal(record)">
                    <apartment-outlined />
                  </a-button>
                </a-tooltip>
                <a-tooltip v-if="record.resource_type === CloudResourceType.ECS" title="连接终端">
                  <a-button type="link" size="small" @click="handleConnectTerminal(record)">
                    <code-outlined />
                  </a-button>
                </a-tooltip>
                <a-popconfirm
                  title="确定删除此资源吗？"
                  ok-text="确定"
                  cancel-text="取消"
                  @confirm="handleDelete(record)"
                >
                  <a-tooltip title="删除">
                    <a-button type="link" size="small" danger>
                      <delete-outlined />
                    </a-button>
                  </a-tooltip>
                </a-popconfirm>
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
      :width="700"
      @ok="handleUpdate"
      @cancel="editModalVisible = false"
      :confirm-loading="submitLoading"
    >
      <a-form ref="editFormRef" :model="editForm" layout="vertical">
        <a-divider orientation="left">基本信息</a-divider>
        <a-row :gutter="16">
          <a-col :span="24">
            <a-form-item label="环境" name="environment">
              <a-select v-model:value="editForm.environment" placeholder="选择环境">
                <a-select-option value="dev">开发环境</a-select-option>
                <a-select-option value="test">测试环境</a-select-option>
                <a-select-option value="staging">预发布环境</a-select-option>
                <a-select-option value="prod">生产环境</a-select-option>
              </a-select>
            </a-form-item>
          </a-col>
          <a-col :span="24">
            <a-form-item label="描述信息" name="description">
              <a-textarea 
                v-model:value="editForm.description" 
                placeholder="请输入资源描述" 
                :rows="3"
              />
            </a-form-item>
          </a-col>
        </a-row>

        <a-divider orientation="left">SSH配置（仅云服务器）</a-divider>
        <a-row :gutter="16" v-if="currentResource && currentResource.resource_type === CloudResourceType.ECS">
          <a-col :span="12">
            <a-form-item label="SSH端口" name="port">
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
            <a-form-item label="用户名" name="username">
              <a-input v-model:value="editForm.username" placeholder="root" />
            </a-form-item>
          </a-col>
          <a-col :span="24">
            <a-form-item label="认证方式" name="auth_mode">
              <a-radio-group v-model:value="editForm.auth_mode">
                <a-radio :value="AuthMode.PASSWORD">密码认证</a-radio>
                <a-radio :value="AuthMode.KEY">密钥认证</a-radio>
              </a-radio-group>
            </a-form-item>
          </a-col>
          <a-col :span="24" v-if="editForm.auth_mode === AuthMode.PASSWORD">
            <a-form-item label="登录密码" name="password">
              <a-input-password 
                v-model:value="editForm.password" 
                placeholder="请输入密码（留空则不修改）"
              />
            </a-form-item>
          </a-col>
          <a-col :span="24" v-if="editForm.auth_mode === AuthMode.KEY">
            <a-form-item label="私钥内容" name="key">
              <a-textarea 
                v-model:value="editForm.key" 
                placeholder="请粘贴SSH私钥内容（留空则不修改）"
                :rows="6"
                style="font-family: monospace;"
              />
            </a-form-item>
          </a-col>
        </a-row>
        <a-alert v-else message="非云服务器类型不支持SSH配置" type="info" show-icon />

        <a-divider orientation="left">资源标签</a-divider>
        <div class="tags-section">
          <div v-if="editForm.tags && editForm.tags.length > 0" class="tags-list">
            <a-tag
              v-for="(tag, index) in editForm.tags"
              :key="index"
              closable
              @close="removeTag(index)"
              color="blue"
            >
              {{ tag.key }}: {{ tag.value }}
            </a-tag>
          </div>
          <a-space style="margin-top: 12px;">
            <a-input
              v-model:value="newTagKey"
              placeholder="标签Key"
              style="width: 150px"
            />
            <a-input
              v-model:value="newTagValue"
              placeholder="标签Value"
              style="width: 150px"
              @pressEnter="addTag"
            />
            <a-button @click="addTag">
              <plus-outlined /> 添加标签
            </a-button>
          </a-space>
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
      :width="600"
    >
      <a-alert 
        message="同步说明" 
        description="从云厂商同步最新的资源信息到本地，支持全量同步和增量同步两种模式。"
        type="info" 
        show-icon 
        style="margin-bottom: 16px;"
      />
      <a-form layout="vertical">
        <a-form-item label="云账户" required>
          <a-select
            v-model:value="syncForm.cloud_account_id"
            placeholder="选择要同步的云账户"
          >
            <a-select-option v-for="account in cloudAccounts" :key="account.id" :value="account.id">
              {{ account.name }}
            </a-select-option>
          </a-select>
        </a-form-item>
        <a-form-item label="资源类型">
          <a-checkbox-group v-model:value="syncForm.resource_types">
            <a-row>
              <a-col :span="12"><a-checkbox :value="CloudResourceType.ECS">云服务器</a-checkbox></a-col>
              <a-col :span="12"><a-checkbox :value="CloudResourceType.RDS">云数据库</a-checkbox></a-col>
              <a-col :span="12"><a-checkbox :value="CloudResourceType.SLB">负载均衡</a-checkbox></a-col>
              <a-col :span="12"><a-checkbox :value="CloudResourceType.OSS">对象存储</a-checkbox></a-col>
              <a-col :span="12"><a-checkbox :value="CloudResourceType.VPC">虚拟私有云</a-checkbox></a-col>
            </a-row>
          </a-checkbox-group>
          <div style="margin-top: 8px; color: #999; font-size: 12px;">不选择则同步所有类型</div>
        </a-form-item>
        <a-form-item label="同步模式">
          <a-radio-group v-model:value="syncForm.sync_mode">
            <a-radio :value="SyncMode.FULL">
              <div>
                <div>全量同步</div>
                <div style="font-size: 12px; color: #999;">同步所有资源，更新已有资源</div>
              </div>
            </a-radio>
            <a-radio :value="SyncMode.INCREMENTAL" style="margin-top: 12px;">
              <div>
                <div>增量同步</div>
                <div style="font-size: 12px; color: #999;">只同步新增和变更的资源</div>
              </div>
            </a-radio>
          </a-radio-group>
        </a-form-item>
        <a-form-item label="自动绑定服务树">
          <a-switch v-model:checked="syncForm.auto_bind" />
          <span style="margin-left: 8px; color: #999;">自动将资源绑定到指定节点</span>
        </a-form-item>
        <a-form-item v-if="syncForm.auto_bind" label="绑定节点">
          <a-tree-select
            v-model:value="syncForm.bind_node_id"
            :tree-data="treeData"
            placeholder="选择服务树节点"
            :field-names="{ children: 'children', label: 'name', value: 'id' }"
          />
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
      :width="500"
    >
      <a-form layout="vertical">
        <a-form-item label="选择服务树节点">
          <a-tree-select
            v-model:value="selectedTreeNodeIds"
            :tree-data="treeData"
            placeholder="请选择要绑定的节点"
            allow-clear
            multiple
            tree-checkable
            :show-checked-strategy="'SHOW_PARENT'"
            :field-names="{ children: 'children', label: 'name', value: 'id' }"
          />
        </a-form-item>
        <a-alert v-if="currentResource?.tree_nodes && currentResource.tree_nodes.length > 0" type="info" show-icon>
          <template #message>
            <div>当前已绑定节点：</div>
            <div style="margin-top: 8px;">
              <a-tag v-for="node in currentResource.tree_nodes" :key="node.id" color="blue">
                {{ node.name }}
              </a-tag>
            </div>
          </template>
        </a-alert>
      </a-form>
    </a-modal>

    <!-- 同步历史对话框 -->
    <a-modal
      v-model:open="syncHistoryModalVisible"
      title="同步历史"
      :width="900"
      :footer="null"
    >
      <a-table
        :columns="syncHistoryColumns"
        :data-source="syncHistoryList"
        :loading="syncHistoryLoading"
        :pagination="syncHistoryPagination"
        @change="handleSyncHistoryTableChange"
        row-key="id"
        size="small"
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
              <a-tag color="green">新增: {{ record.new_count }}</a-tag>
              <a-tag color="blue">更新: {{ record.update_count }}</a-tag>
              <a-tag color="red" v-if="record.failed_count > 0">失败: {{ record.failed_count }}</a-tag>
            </a-space>
          </template>
          <template v-else-if="column.key === 'duration'">
            {{ record.duration }}s
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
      :width="1000"
      :footer="null"
    >
      <a-table
        :columns="changeLogColumns"
        :data-source="changeLogList"
        :loading="changeLogLoading"
        :pagination="changeLogPagination"
        @change="handleChangeLogTableChange"
        row-key="id"
        size="small"
      >
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'change_type'">
            <a-tag :color="getChangeTypeColor(record.change_type)">
              {{ getChangeTypeText(record.change_type) }}
            </a-tag>
          </template>
          <template v-else-if="column.key === 'change_info'">
            <div v-if="record.field_name">
              <div><strong>字段：</strong>{{ record.field_name }}</div>
              <div v-if="record.old_value"><strong>旧值：</strong>{{ record.old_value }}</div>
              <div v-if="record.new_value"><strong>新值：</strong>{{ record.new_value }}</div>
            </div>
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
      width="700"
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
                <a-tag :color="getResourceTypeColor(currentDetail.resource_type)" class="tech-tag">
                  <component :is="getResourceTypeIcon(currentDetail.resource_type)" />
                  {{ getResourceTypeText(currentDetail.resource_type) }}
                </a-tag>
              </div>
            </div>

            <a-descriptions bordered :column="1" size="small">
              <a-descriptions-item label="资源ID">
                {{ currentDetail.id }}
              </a-descriptions-item>
              <a-descriptions-item label="云账户" v-if="currentDetail.cloud_account">
                <a-tag color="purple" class="tech-tag">
                  {{ currentDetail.cloud_account.name }}
                </a-tag>
              </a-descriptions-item>
              <a-descriptions-item label="环境">
                <a-tag :color="getEnvironmentColor(currentDetail.environment)" class="tech-tag">
                  {{ getEnvironmentText(currentDetail.environment) }}
                </a-tag>
              </a-descriptions-item>
              <a-descriptions-item label="实例ID">
                {{ currentDetail.instance_id || '-' }}
              </a-descriptions-item>
              <a-descriptions-item label="实例类型">
                {{ currentDetail.instance_type || '-' }}
              </a-descriptions-item>
              <a-descriptions-item label="区域">
                {{ currentDetail.zone_id || '-' }}
              </a-descriptions-item>
              <a-descriptions-item label="VPC">
                {{ currentDetail.vpc_id || '-' }}
              </a-descriptions-item>
              <a-descriptions-item label="配置信息">
                <div class="config-info">
                  <span v-if="currentDetail.cpu">CPU: {{ currentDetail.cpu }} 核</span>
                  <span v-if="currentDetail.memory">内存: {{ currentDetail.memory }} GB</span>
                  <span v-if="currentDetail.disk">磁盘: {{ currentDetail.disk }} GB</span>
                </div>
              </a-descriptions-item>
              <a-descriptions-item label="公网IP">
                {{ currentDetail.public_ip || '-' }}
              </a-descriptions-item>
              <a-descriptions-item label="私网IP">
                {{ currentDetail.private_ip || '-' }}
              </a-descriptions-item>
              <a-descriptions-item label="操作系统">
                {{ currentDetail.os_name || currentDetail.os_type || '-' }}
              </a-descriptions-item>
              <a-descriptions-item label="镜像">
                {{ currentDetail.image_name || currentDetail.image_id || '-' }}
              </a-descriptions-item>
              <a-descriptions-item label="计费方式">
                {{ currentDetail.charge_type === ChargeType.PRE_PAID ? '包年包月' : '按量付费' }}
              </a-descriptions-item>
              <a-descriptions-item label="月度费用" v-if="currentDetail.monthly_cost">
                <span class="cost-value">{{ currentDetail.monthly_cost }}</span>
                <span class="cost-currency">{{ currentDetail.currency || 'CNY' }}</span>
              </a-descriptions-item>
              <a-descriptions-item label="到期时间" v-if="currentDetail.expire_time">
                {{ formatDateTime(currentDetail.expire_time) }}
              </a-descriptions-item>
              <a-descriptions-item label="描述">
                {{ currentDetail.description || '-' }}
              </a-descriptions-item>
              <a-descriptions-item label="创建时间">
                {{ formatDateTime(currentDetail.created_at) }}
              </a-descriptions-item>
              <a-descriptions-item label="更新时间">
                {{ formatDateTime(currentDetail.updated_at) }}
              </a-descriptions-item>
            </a-descriptions>

            <div class="detail-section">
              <div class="section-title">资源标签</div>
              <div class="tag-list">
                <template v-if="currentDetail.tags && currentDetail.tags.length > 0">
                  <a-tag 
                    v-for="(tag, index) in currentDetail.tags" 
                    :key="index" 
                    class="tech-tag tag-item"
                  >
                    {{ tag.key }}: {{ tag.value }}
                  </a-tag>
                </template>
                <a-empty v-else :image="Empty.PRESENTED_IMAGE_SIMPLE" description="暂无标签" />
              </div>
            </div>

            <div class="detail-section">
              <div class="section-title">绑定的服务树节点</div>
              <div class="tree-node-list">
                <template v-if="currentDetail.tree_nodes && currentDetail.tree_nodes.length > 0">
                  <a-tag 
                    v-for="node in currentDetail.tree_nodes" 
                    :key="node.id" 
                    class="tech-tag node-tag"
                  >
                    {{ node.name }}
                  </a-tag>
                </template>
                <a-empty v-else :image="Empty.PRESENTED_IMAGE_SIMPLE" description="暂无绑定节点" />
              </div>
            </div>
            
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
import { message, Empty } from 'ant-design-vue';
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
} from '@ant-design/icons-vue';

// API 导入
import {
  getTreeCloudResourceListApi,
  getTreeCloudResourceDetailApi,
  updateTreeCloudResourceApi,
  deleteTreeCloudResourceApi,
  bindTreeCloudResourceApi,
  syncTreeCloudResourceApi,
  getSyncHistoryApi,
  getChangeLogApi,
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
const syncHistoryLoading = ref(false);
const changeLogLoading = ref(false);

// 对话框显示状态
const editModalVisible = ref(false);
const syncModalVisible = ref(false);
const bindModalVisible = ref(false);
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
const editFormRef = ref();
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

// 绑定节点选择
const selectedTreeNodeIds = ref<number[]>([]);

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
  showSizeChanger: true,
  showQuickJumper: true,
  showTotal: (total: number) => `共 ${total} 条`,
});

const syncHistoryPagination = reactive({
  current: 1,
  pageSize: 10,
  total: 0,
});

const changeLogPagination = reactive({
  current: 1,
  pageSize: 10,
  total: 0,
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

// 表格列定义
const columns = [
  { title: '资源名称', dataIndex: 'name', key: 'name', width: 180, fixed: 'left' },
  { title: '类型', dataIndex: 'resource_type', key: 'resource_type', width: 120 },
  { title: '云账户', dataIndex: 'cloud_account', key: 'cloud_account', width: 140 },
  { title: '实例信息', key: 'instance', width: 180 },
  { title: '配置', key: 'config', width: 150 },
  { title: 'IP地址', key: 'ip', width: 160 },
  { title: '状态', dataIndex: 'status', key: 'status', width: 100 },
  { title: '环境', dataIndex: 'environment', key: 'environment', width: 90 },
  { title: '服务树', key: 'tree_nodes', width: 160 },
  { title: '月费用', key: 'cost', width: 100 },
  { title: '操作', key: 'action', width: 220, fixed: 'right', align: 'center' },
];

// 同步历史列
const syncHistoryColumns = [
  { title: 'ID', dataIndex: 'id', key: 'id', width: 80 },
  { title: '同步状态', key: 'sync_status', width: 100 },
  { title: '统计', key: 'stats', width: 300 },
  { title: '耗时', key: 'duration', width: 100 },
  { title: '开始时间', key: 'start_time', width: 180 },
];

// 变更日志列
const changeLogColumns = [
  { title: '资源ID', dataIndex: 'resource_id', key: 'resource_id', width: 100 },
  { title: '实例ID', dataIndex: 'instance_id', key: 'instance_id', width: 150 },
  { title: '变更类型', key: 'change_type', width: 120 },
  { title: '变更信息', key: 'change_info', width: 300 },
  { title: '操作人', dataIndex: 'operator_name', key: 'operator_name', width: 120 },
  { title: '变更时间', key: 'change_time', width: 180 },
];

// ========== 辅助方法 ==========
const getResourceTypeColor = (type: CloudResourceType): string => {
  const colors: Record<CloudResourceType, string> = {
    [CloudResourceType.ECS]: 'blue',
    [CloudResourceType.RDS]: 'green',
    [CloudResourceType.SLB]: 'orange',
    [CloudResourceType.OSS]: 'purple',
    [CloudResourceType.VPC]: 'cyan',
    [CloudResourceType.OTHER]: 'default',
  };
  return colors[type] || 'default';
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
    dev: 'blue',
    test: 'orange',
    staging: 'purple',
    prod: 'red',
  };
  return colors[environment || ''] || 'default';
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
    create: 'green',
    update: 'blue',
    delete: 'red',
    sync: 'purple',
  };
  return colors[type] || 'default';
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

const formatDateTime = (dateTime?: string): string => {
  if (!dateTime) return '-';
  try {
    return new Date(dateTime).toLocaleString('zh-CN');
  } catch {
    return dateTime;
  }
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
    // 使用分页逐步加载所有云账户
    let allAccounts: CloudAccount[] = [];
    let currentPage = 1;
    const pageSize = 50; // 使用合理的分页大小
    let hasMore = true;

    while (hasMore) {
      const response = await getCloudAccountListApi({ 
        page: currentPage, 
        size: pageSize 
      });
      const items = (response as any).items || [];
      const total = (response as any).total || 0;
      
      allAccounts = [...allAccounts, ...items];
      
      // 判断是否还有更多数据
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
    page_size: 10,
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
    // 详情数据使用 data
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
    await updateTreeCloudResourceApi(id, updateData as UpdateTreeCloudResourceReq);
    message.success('更新成功');
    editModalVisible.value = false;
    await fetchResources();
    
    // 如果详情抽屉打开，刷新详情
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
    message.success(`同步成功！新增${result.new_count}，更新${result.update_count}`);
    syncModalVisible.value = false;
    await fetchResources();
  } catch (error) {
    message.error('同步失败');
  } finally {
    syncLoading.value = false;
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

const handleSyncHistoryTableChange = (pag: any): void => {
  syncHistoryPagination.current = pag.current;
  syncHistoryPagination.pageSize = pag.pageSize;
  fetchSyncHistory();
};

// 获取变更日志
const fetchChangeLog = async (): Promise<void> => {
  changeLogLoading.value = true;
  try {
    const response = await getChangeLogApi({
      page: changeLogPagination.current,
      page_size: changeLogPagination.pageSize,
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
      id: currentResource.value.id,
      tree_node_ids: selectedTreeNodeIds.value,
    });
    message.success('绑定成功');
    bindModalVisible.value = false;
    await fetchResources();
    
    // 刷新详情
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

// 连接终端
const handleConnectTerminal = (record: TreeCloudResource): void => {
  if (record.resource_type !== CloudResourceType.ECS) {
    message.warning('只有云服务器支持终端连接');
    return;
  }
  router.push({ name: 'TerminalConnect', params: { id: String(record.id), type: 'cloud' } });
};

// 删除资源
const handleDelete = async (record: TreeCloudResource): Promise<void> => {
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
};

// ========== 生命周期 ==========
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

<style scoped>
/* 页面容器 */
.cloud-resource-management {
  padding: 20px;
  background: #f0f2f5;
  min-height: 100vh;
}

/* 顶部标题栏 */
.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 16px;
}

.page-title {
  font-size: 20px;
  font-weight: 600;
  margin: 0;
  color: #1f2937;
}

/* 筛选区域 */
.filter-section {
  margin-bottom: 16px;
}

.filter-form :deep(.ant-form-item) {
  margin-bottom: 0;
}

/* 统计区域 */
.stats-section {
  margin-bottom: 16px;
}

.stat-card {
  text-align: center;
  cursor: default;
}

.stat-card :deep(.ant-statistic-content) {
  font-size: 24px;
  font-weight: 600;
}

/* 表格区域 */
.table-section {
  margin-bottom: 16px;
}

.name-cell {
  display: flex;
  align-items: center;
  gap: 8px;
}

.name-link {
  color: #1890ff;
  cursor: pointer;
}

.name-link:hover {
  text-decoration: underline;
}

.text-gray {
  color: #999;
}

.instance-cell,
.config-cell,
.ip-cell,
.nodes-cell {
  font-size: 12px;
}

.info-line {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-bottom: 2px;
}

.label {
  color: #999;
  font-size: 12px;
}

.value {
  color: #333;
}

.ip-icon {
  font-size: 12px;
  color: #999;
}

.cost-cell {
  display: flex;
  align-items: baseline;
  gap: 2px;
}

.cost-amount {
  font-size: 14px;
  font-weight: 600;
  color: #f5222d;
}

.cost-unit {
  font-size: 12px;
  color: #999;
}

/* 标签管理 */
.tags-section {
  margin-top: 12px;
}

.tags-list {
  margin-bottom: 12px;
}

/* 详情抽屉 */
.detail-content {
  padding: 16px 0;
}

.detail-header {
  margin-bottom: 20px;
}

.detail-header h2 {
  margin: 0 0 12px 0;
  font-size: 20px;
  color: #1f2937;
}

.detail-badges {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.detail-section {
  margin-top: 24px;
}

.section-title {
  font-size: 14px;
  font-weight: 600;
  color: #1f2937;
  margin-bottom: 12px;
  padding-left: 8px;
  border-left: 3px solid #1890ff;
}

.tag-list,
.tree-node-list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.drawer-actions {
  display: flex;
  justify-content: space-between;
  margin-top: 24px;
  padding-top: 16px;
  border-top: 1px solid #f0f0f0;
}
</style>


