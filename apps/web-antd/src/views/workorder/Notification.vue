<template>
  <div class="notification-management-container">
    <div class="page-header">
      <div class="header-actions">
        <a-button type="primary" @click="handleCreateNotification" class="btn-create">
          <template #icon>
            <PlusOutlined />
          </template>
          <span class="btn-text">创建通知配置</span>
        </a-button>
        <div class="search-filters">
          <a-input-search 
            v-model:value="searchQuery" 
            placeholder="搜索通知配置..." 
            class="search-input"
            @search="handleSearch"
            @change="handleSearchChange"
            allow-clear 
          />
          <a-select 
            v-model:value="channelFilter" 
            placeholder="选择通知渠道" 
            class="channel-filter"
            @change="handleChannelChange"
            allow-clear
          >
            <a-select-option :value="undefined">全部渠道</a-select-option>
            <a-select-option 
              v-for="channel in getAvailableChannels()" 
              :key="channel"
              :value="channel"
            >
              {{ getNotificationChannelName(channel) }}
            </a-select-option>
          </a-select>
          <a-select 
            v-model:value="statusFilter" 
            placeholder="状态" 
            class="status-filter"
            @change="handleStatusChange"
            allow-clear
          >
            <a-select-option :value="undefined">全部状态</a-select-option>
            <a-select-option :value="NotificationStatus.Enabled">启用</a-select-option>
            <a-select-option :value="NotificationStatus.Disabled">禁用</a-select-option>
          </a-select>
          <a-button @click="handleResetFilters" class="reset-btn">
            重置
          </a-button>
        </div>
      </div>
    </div>

    <!-- 统计卡片 -->
    <div class="stats-grid">
      <a-card class="stats-card">
        <a-statistic 
          title="总配置数" 
          :value="stats.total" 
          :value-style="{ color: '#1890ff' }"
        >
          <template #prefix>
            <BellOutlined />
          </template>
        </a-statistic>
      </a-card>
      
      <a-card class="stats-card">
        <a-statistic 
          title="启用中" 
          :value="stats.enabled" 
          :value-style="{ color: '#52c41a' }"
        >
          <template #prefix>
            <CheckCircleOutlined />
          </template>
        </a-statistic>
      </a-card>
      
      <a-card class="stats-card">
        <a-statistic 
          title="禁用" 
          :value="stats.disabled" 
          :value-style="{ color: '#ff4d4f' }"
        >
          <template #prefix>
            <StopOutlined />
          </template>
        </a-statistic>
      </a-card>
      
      <a-card class="stats-card">
        <a-statistic 
          title="今日发送" 
          :value="stats.todaySent" 
          :value-style="{ color: '#fa8c16' }"
        >
          <template #prefix>
            <SendOutlined />
          </template>
        </a-statistic>
      </a-card>
    </div>

    <div class="table-container">
      <a-card>
        <a-table 
          :data-source="notifications" 
          :columns="columns" 
          :pagination="paginationConfig" 
          :loading="loading" 
          row-key="id"
          bordered
          :scroll="{ x: 1400 }"
          @change="handleTableChange"
        >
          <template #bodyCell="{ column, record }">
            <template v-if="column.key === 'name'">
              <div class="name-cell">
                <BellOutlined style="color: #1890ff; margin-right: 8px;" />
                <span class="name-text">{{ record.name }}</span>
              </div>
            </template>

            <template v-if="column.key === 'channels'">
              <div class="channels-cell">
                <a-tag 
                  v-for="channel in record.channels" 
                  :key="channel"
                  :color="getChannelColor(channel)"
                  class="channel-tag"
                >
                  <component :is="getChannelIcon(channel)" style="margin-right: 4px;" />
                  {{ getNotificationChannelName(channel) }}
                </a-tag>
              </div>
            </template>

            <template v-if="column.key === 'eventTypes'">
              <div class="event-types-cell">
                <a-tooltip>
                  <template #title>
                    <div v-for="eventType in record.event_types" :key="eventType">
                      {{ getEventTypeName(eventType) }}
                    </div>
                  </template>
                  <span>{{ getEventTypesDisplay(record.event_types) }}</span>
                </a-tooltip>
              </div>
            </template>

            <template v-if="column.key === 'recipientTypes'">
              <div class="recipient-types-cell">
                <a-tooltip>
                  <template #title>
                    <div v-for="recipientType in record.recipient_types" :key="recipientType">
                      {{ getRecipientTypeName(recipientType) }}
                    </div>
                  </template>
                  <span>{{ getRecipientTypesDisplay(record.recipient_types) }}</span>
                </a-tooltip>
              </div>
            </template>

            <template v-if="column.key === 'status'">
              <a-switch 
                :checked="record.status === NotificationStatus.Enabled"
                @change="(checked: boolean) => handleStatusToggle(record, checked)"
                :loading="record.statusLoading"
              />
            </template>

            <template v-if="column.key === 'priority'">
              <div class="priority-cell">
                <a-tag :color="getPriorityColor(record.priority)">
                  {{ getPriorityName(record.priority) }}
                </a-tag>
              </div>
            </template>

            <template v-if="column.key === 'triggerType'">
              <div class="trigger-type-cell">
                <span>{{ getTriggerTypeName(record.trigger_type) }}</span>
              </div>
            </template>

            <template v-if="column.key === 'createdAt'">
              <div class="date-info">
                <span class="date">{{ formatDate(record.created_at) }}</span>
                <span class="time">{{ formatTime(record.created_at) }}</span>
              </div>
            </template>

            <template v-if="column.key === 'action'">
              <div class="action-buttons">
                <a-button type="primary" size="small" @click="handleViewNotification(record)">
                  查看
                </a-button>
                <a-button type="default" size="small" @click="handleEditNotification(record)">
                  编辑
                </a-button>
                <a-dropdown>
                  <template #overlay>
                    <a-menu @click="(e: any) => handleMenuClick(e.key, record)">
                      <a-menu-item key="test">
                        <SendOutlined /> 测试发送
                      </a-menu-item>
                      <a-menu-item key="manual">
                        <MailOutlined /> 手动发送
                      </a-menu-item>
                      <a-menu-item key="logs">
                        <FileTextOutlined /> 发送记录
                      </a-menu-item>
                      <a-menu-divider />
                      <a-menu-item key="duplicate">
                        <CopyOutlined /> 复制配置
                      </a-menu-item>
                      <a-menu-divider />
                      <a-menu-item key="delete" danger>删除</a-menu-item>
                    </a-menu>
                  </template>
                  <a-button size="small">
                    更多
                    <DownOutlined />
                  </a-button>
                </a-dropdown>
              </div>
            </template>
          </template>
        </a-table>
      </a-card>
    </div>

    <!-- 通知配置创建/编辑对话框 -->
    <a-modal 
      :open="notificationDialogVisible" 
      :title="notificationDialog.isEdit ? '编辑通知配置' : '创建通知配置'" 
      :width="notificationDialogWidth"
      @ok="saveNotification" 
      @cancel="closeNotificationDialog"
      :destroy-on-close="true"
      :confirm-loading="notificationDialog.saving"
      class="responsive-modal notification-config-modal"
    >
      <a-form ref="formRef" :model="notificationDialog.form" :rules="notificationRules" layout="vertical">
        <a-form-item label="配置名称" name="name">
          <a-input 
            v-model:value="notificationDialog.form.name" 
            placeholder="请输入通知配置名称"
          />
        </a-form-item>

        <a-form-item label="配置描述" name="description">
          <a-textarea 
            v-model:value="notificationDialog.form.description" 
            placeholder="请输入通知配置描述"
            :rows="3"
          />
        </a-form-item>

        <a-form-item label="关联流程" name="processId">
          <a-select 
            v-model:value="notificationDialog.form.processId" 
            placeholder="请选择关联流程（可选）"
            allow-clear
            show-search
            option-filter-prop="label"
            :loading="processLoading"
            :dropdown-match-select-width="false"
            @popup-scroll="(e: Event) => handleProcessScroll(e)"
            @focus="() => loadProcesses(true)"
          >
            <a-select-option 
              v-for="process in processes" 
              :key="process.id"
              :value="process.id"
              :label="process.name"
            >
              <div class="form-option">
                <span class="form-name">{{ process.name }}</span>
                <span v-if="process.category?.name" class="form-category">{{ process.category.name }}</span>
              </div>
            </a-select-option>
            <a-select-option 
              v-if="processLoading" 
              :value="`loading-${Date.now()}`" 
              disabled
            >
              <div style="text-align: center; padding: 8px;">
                <a-spin size="small" /> 加载中...
              </div>
            </a-select-option>
          </a-select>
        </a-form-item>

        <a-form-item label="关联模板" name="templateId">
          <a-select 
            v-model:value="notificationDialog.form.templateId" 
            placeholder="请选择关联模板（可选）"
            allow-clear
            show-search
            option-filter-prop="label"
            :loading="templateLoading"
            :dropdown-match-select-width="false"
            @popup-scroll="(e: Event) => handleTemplateScroll(e)"
            @focus="() => loadTemplates(true)"
          >
            <a-select-option 
              v-for="template in templates" 
              :key="template.id"
              :value="template.id"
              :label="template.name"
            >
              <div class="form-option">
                <span class="form-name">{{ template.name }}</span>
                <span v-if="template.category?.name" class="form-category">{{ template.category.name }}</span>
              </div>
            </a-select-option>
            <a-select-option 
              v-if="templateLoading" 
              :value="`loading-${Date.now()}`" 
              disabled
            >
              <div style="text-align: center; padding: 8px;">
                <a-spin size="small" /> 加载中...
              </div>
            </a-select-option>
          </a-select>
        </a-form-item>

        <a-form-item label="关联分类" name="categoryId">
          <a-select 
            v-model:value="notificationDialog.form.categoryId" 
            placeholder="请选择关联分类（可选）"
            allow-clear
            show-search
            option-filter-prop="label"
            :loading="categoryLoading"
            :dropdown-match-select-width="false"
            @popup-scroll="(e: Event) => handleCategoryScroll(e)"
            @focus="() => loadCategories(true)"
          >
            <a-select-option 
              v-for="category in categories" 
              :key="category.id"
              :value="category.id"
              :label="category.name"
            >
              <div class="form-option">
                <span class="form-name">{{ category.name }}</span>
                <span v-if="category.description" class="form-category">{{ category.description }}</span>
              </div>
            </a-select-option>
            <a-select-option 
              v-if="categoryLoading" 
              :value="`loading-${Date.now()}`" 
              disabled
            >
              <div style="text-align: center; padding: 8px;">
                <a-spin size="small" /> 加载中...
              </div>
            </a-select-option>
          </a-select>
        </a-form-item>

        <a-form-item label="触发事件" name="eventTypes">
          <a-checkbox-group v-model:value="notificationDialog.form.eventTypes" style="width: 100%;">
            <a-row :gutter="[16, 8]">
              <a-col 
                :span="12" 
                v-for="eventType in getAllEventTypes()" 
                :key="eventType"
              >
                <a-checkbox :value="eventType">
                  <span class="event-type-option">
                    {{ getEventTypeName(eventType) }}
                  </span>
                </a-checkbox>
              </a-col>
            </a-row>
          </a-checkbox-group>
          <div class="form-help" style="margin-top: 8px;">
            <a-alert
              message="选择触发通知的工单事件类型"
              description="建议选择关键事件以避免通知过多"
              type="info"
              show-icon
              banner
            />
          </div>
        </a-form-item>

        <a-form-item label="触发类型" name="triggerType">
          <a-radio-group v-model:value="notificationDialog.form.triggerType">
            <a-radio :value="NotificationTrigger.IMMEDIATE">立即触发</a-radio>
            <a-radio :value="NotificationTrigger.DELAYED">延迟触发</a-radio>
            <a-radio :value="NotificationTrigger.SCHEDULED">定时触发</a-radio>
            <a-radio :value="NotificationTrigger.CONDITIONAL">条件触发</a-radio>
          </a-radio-group>
        </a-form-item>

        <a-form-item 
          label="触发条件" 
          name="triggerCondition" 
          v-if="notificationDialog.form.triggerType === 'conditional'"
        >
          <a-textarea
            v-model:value="notificationDialog.form.triggerCondition"
            placeholder="请输入触发条件（JSON格式）"
            :rows="4"
          />
        </a-form-item>

        <a-form-item label="通知渠道" name="channels">
          <a-checkbox-group v-model:value="notificationDialog.form.channels" style="width: 100%;">
            <a-row :gutter="[16, 16]">
              <a-col 
                :span="12" 
                v-for="channel in getAllNotificationChannels()" 
                :key="channel"
              >
                <a-checkbox :value="channel">
                  <span class="channel-option">
                    <component :is="getChannelIcon(channel)" :style="{ color: getChannelIconColor(channel) }" />
                    {{ getNotificationChannelName(channel) }}
                  </span>
                </a-checkbox>
              </a-col>
            </a-row>
          </a-checkbox-group>
          <div class="form-help" style="margin-top: 8px;" v-if="notificationDialog.form.channels.includes('feishu') || notificationDialog.form.channels.includes('email')">
            <a-alert
              message="通知渠道配置建议"
              type="info"
              show-icon
              banner
            >
              <template #description>
                <div>
                  <div v-if="notificationDialog.form.channels.includes('feishu')" style="margin-bottom: 4px;">
                    <strong>飞书通知：</strong>需要确保接收人配置了有效的用户ID，系统会根据用户ID查找对应的飞书账号进行消息推送
                  </div>
                  <div v-if="notificationDialog.form.channels.includes('email')">
                    <strong>邮件通知：</strong>需要确保接收人配置了有效的邮箱地址，支持通过用户ID、角色ID或部门ID自动获取邮箱
                  </div>
                </div>
              </template>
            </a-alert>
          </div>
        </a-form-item>

        <a-form-item label="接收人类型" name="recipientTypes">
          <a-checkbox-group v-model:value="notificationDialog.form.recipientTypes" style="width: 100%;">
            <a-row :gutter="[16, 8]">
              <a-col 
                :span="12" 
                v-for="recipientType in getAllRecipientTypes()" 
                :key="recipientType"
              >
                <a-checkbox :value="recipientType">
                  <span class="recipient-type-option">
                    {{ getRecipientTypeName(recipientType) }}
                  </span>
                </a-checkbox>
              </a-col>
            </a-row>
          </a-checkbox-group>
        </a-form-item>

        <a-form-item label="自定义接收人用户ID" name="recipientUsers" v-if="notificationDialog.form.recipientTypes.includes('user')">
          <a-select 
            v-model:value="notificationDialog.form.recipientUsers" 
            mode="tags"
            placeholder="请输入用户ID"
            style="width: 100%"
            :token-separators="[',', ';', ' ']"
          />
        </a-form-item>

        <a-form-item label="接收人角色ID" name="recipientRoles" v-if="notificationDialog.form.recipientTypes.includes('role')">
          <a-select 
            v-model:value="notificationDialog.form.recipientRoles" 
            mode="tags"
            placeholder="请输入角色ID"
            style="width: 100%"
            :token-separators="[',', ';', ' ']"
          />
        </a-form-item>

        <a-form-item label="接收人部门ID" name="recipientDepts" v-if="notificationDialog.form.recipientTypes.includes('dept')">
          <a-select 
            v-model:value="notificationDialog.form.recipientDepts" 
            mode="tags"
            placeholder="请输入部门ID"
            style="width: 100%"
            :token-separators="[',', ';', ' ']"
          />
        </a-form-item>

        <a-form-item label="消息模板" name="messageTemplate">
          <a-textarea
            v-model:value="notificationDialog.form.messageTemplate"
            :rows="8"
            placeholder="请输入通知消息模板"
            show-count
            :maxlength="2000"
          />
          <div class="template-help">
            <a-alert
              message="📋 AI-CloudOps 通知系统支持的模板变量"
              type="info"
              show-icon
              banner
              style="margin-top: 8px;"
            >
              <template #description>
                <div class="template-variables-help">
                  <div class="variable-group">
                    <strong>🎯 核心业务变量</strong>
                    <div class="variable-list">
                      <span class="variable-item">{subject} - 通知主题</span>
                      <span class="variable-item">{content} - 通知内容</span>
                      <span class="variable-item">{recipient_name} - 接收人姓名</span>
                      <span class="variable-item">{recipient_addr} - 接收人地址（邮箱/手机号）</span>
                    </div>
                  </div>
                  
                  <div class="variable-group">
                    <strong>🏢 工单相关变量</strong>
                    <div class="variable-list">
                      <span class="variable-item">{workorder_id} - 工单ID (数字格式)</span>
                      <span class="variable-item">{serial_number} - 工单编号 (WO-123456 格式)</span>
                      <span class="variable-item">{title} - 工单标题</span>
                      <span class="variable-item">{description} - 工单描述</span>
                      <span class="variable-item">{status} - 工单状态</span>
                    </div>
                  </div>
                  
                  <div class="variable-group">
                    <strong>⚡ 优先级变量</strong>
                    <div class="variable-list">
                      <span class="variable-item">{priority_level} - 优先级等级 (1, 2, 3)</span>
                      <span class="variable-item">{priority_text} - 优先级文本 (高, 中, 低)</span>
                      <span class="variable-item">{priority_icon} - 优先级图标</span>
                    </div>
                  </div>
                  
                  <div class="variable-group">
                    <strong>📅 时间相关变量</strong>
                    <div class="variable-list">
                      <span class="variable-item">{notification_time} - 通知时间</span>
                      <span class="variable-item">{notification_date} - 通知日期</span>
                      <span class="variable-item">{notification_year} - 年份</span>
                      <span class="variable-item">{notification_month} - 月份</span>
                      <span class="variable-item">{notification_day} - 日期</span>
                    </div>
                  </div>
                  
                  <div class="variable-group">
                    <strong>🎭 事件类型变量</strong>
                    <div class="variable-list">
                      <span class="variable-item">{event_type} - 事件类型文本</span>
                      <span class="variable-item">{event_type_text} - 事件类型文本</span>
                      <span class="variable-item">{event_type_icon} - 事件类型图标</span>
                    </div>
                  </div>
                  
                  <div class="variable-group">
                    <strong>🏢 企业信息变量</strong>
                    <div class="variable-list">
                      <span class="variable-item">{company_name} - 公司名称 (AI-CloudOps)</span>
                      <span class="variable-item">{platform_name} - 平台名称</span>
                      <span class="variable-item">{department} - 部门名称</span>
                      <span class="variable-item">{service_hotline} - 服务热线</span>
                    </div>
                  </div>
                  
                  <div class="variable-group">
                    <strong>👥 人员相关变量</strong>
                    <div class="variable-list">
                      <span class="variable-item">{operator_name} - 操作人员姓名</span>
                      <span class="variable-item">{assignee_name} - 指派人员姓名</span>
                      <span class="variable-item">{created_time} - 创建时间</span>
                      <span class="variable-item">{updated_time} - 更新时间</span>
                    </div>
                  </div>
                  
                  <div class="variable-group">
                    <strong>🔧 自定义变量</strong>
                    <div class="variable-list">
                      <span class="variable-item">{custom_content} - 自定义内容</span>
                    </div>
                  </div>
                  
                  <div class="variable-deprecated">
                    <strong>❌ 不再支持的变量</strong>
                    <div class="variable-list deprecated">
                      <span class="variable-item">{instanceTitle} → 请使用 {title}</span>
                      <span class="variable-item">{currentTime} → 请使用 {notification_time}</span>
                    </div>
                  </div>
                </div>
              </template>
            </a-alert>
          </div>
        </a-form-item>

        <a-form-item label="主题模板" name="subjectTemplate">
          <a-input
            v-model:value="notificationDialog.form.subjectTemplate"
            placeholder="请输入主题模板（可选）"
          />
        </a-form-item>

        <a-form-item 
          label="定时发送时间" 
          name="scheduledTime" 
          v-if="notificationDialog.form.triggerType === 'scheduled'"
        >
          <a-date-picker
            v-model:value="notificationDialog.form.scheduledTime"
            show-time
            placeholder="请选择发送时间"
            style="width: 100%"
            :disabled-date="disabledDate"
          />
        </a-form-item>

        <a-form-item label="重复间隔（分钟）" name="repeatInterval">
          <a-input-number
            v-model:value="notificationDialog.form.repeatInterval"
            placeholder="重复间隔（分钟）"
            :min="0"
            style="width: 100%"
          />
        </a-form-item>

        <a-form-item label="最大重试次数" name="maxRetries">
          <a-input-number
            v-model:value="notificationDialog.form.maxRetries"
            placeholder="最大重试次数"
            :min="0"
            :max="10"
            style="width: 100%"
          />
        </a-form-item>

        <a-form-item label="重试间隔（分钟）" name="retryInterval">
          <a-input-number
            v-model:value="notificationDialog.form.retryInterval"
            placeholder="重试间隔（分钟）"
            :min="1"
            style="width: 100%"
          />
        </a-form-item>

        <a-form-item label="优先级" name="priority">
          <a-select v-model:value="notificationDialog.form.priority" placeholder="请选择优先级">
            <a-select-option :value="NotificationPriority.High">高</a-select-option>
            <a-select-option :value="NotificationPriority.Medium">中</a-select-option>
            <a-select-option :value="NotificationPriority.Low">低</a-select-option>
          </a-select>
        </a-form-item>

        <a-form-item label="状态" name="status" v-if="notificationDialog.isEdit">
          <a-switch 
            :checked="notificationDialog.form.status === NotificationStatus.Enabled"
            @change="(checked: boolean) => notificationDialog.form.status = checked ? NotificationStatus.Enabled : NotificationStatus.Disabled"
            checked-children="启用" 
            un-checked-children="禁用" 
          />
        </a-form-item>

        <a-form-item label="是否默认配置" name="isDefault" v-if="notificationDialog.isEdit">
          <a-switch 
            :checked="notificationDialog.form.isDefault === IsDefault.Yes"
            @change="(checked: boolean) => notificationDialog.form.isDefault = checked ? IsDefault.Yes : IsDefault.No"
            checked-children="是" 
            un-checked-children="否" 
          />
        </a-form-item>
      </a-form>
    </a-modal>

    <!-- 通知详情对话框 -->
    <a-modal 
      :open="detailDialogVisible" 
      title="通知配置详情" 
      :width="detailDialogWidth"
      :footer="null" 
      @cancel="closeDetailDialog"
      class="detail-dialog"
    >
      <div v-if="detailDialog.notification" class="notification-details">
        <div class="detail-header">
          <h2>{{ detailDialog.notification.name }} - 通知配置</h2>
          <a-switch 
            :checked="detailDialog.notification.status === NotificationStatus.Enabled"
            @change="(checked: boolean) => handleStatusToggle(detailDialog.notification!, checked)"
          />
        </div>

        <a-descriptions bordered :column="1" :labelStyle="{ width: '120px' }">
          <a-descriptions-item label="配置ID">{{ detailDialog.notification.id }}</a-descriptions-item>
          <a-descriptions-item label="配置名称">{{ detailDialog.notification.name }}</a-descriptions-item>
          <a-descriptions-item label="配置描述">{{ detailDialog.notification.description || '无' }}</a-descriptions-item>
          <a-descriptions-item label="关联模板ID">{{ detailDialog.notification.template_id || '无' }}</a-descriptions-item>
          <a-descriptions-item label="关联流程ID">{{ detailDialog.notification.process_id || '无' }}</a-descriptions-item>
          <a-descriptions-item label="关联分类ID">{{ detailDialog.notification.category_id || '无' }}</a-descriptions-item>
          <a-descriptions-item label="触发事件">
            <div class="event-types-display">
              <a-tag v-for="eventType in detailDialog.notification.event_types" :key="eventType">
                {{ getEventTypeName(eventType) }}
              </a-tag>
            </div>
          </a-descriptions-item>
          <a-descriptions-item label="触发类型">
            {{ getTriggerTypeName(detailDialog.notification.trigger_type) }}
          </a-descriptions-item>
          <a-descriptions-item label="通知渠道">
            <div class="channels-display">
              <a-tag 
                v-for="channel in detailDialog.notification.channels" 
                :key="channel"
                :color="getChannelColor(channel)"
              >
                <component :is="getChannelIcon(channel)" style="margin-right: 4px;" />
                {{ getNotificationChannelName(channel) }}
              </a-tag>
            </div>
          </a-descriptions-item>
          <a-descriptions-item label="接收人类型">
            <div class="recipient-types-display">
              <a-tag v-for="recipientType in detailDialog.notification.recipient_types" :key="recipientType">
                {{ getRecipientTypeName(recipientType) }}
              </a-tag>
            </div>
          </a-descriptions-item>
          <a-descriptions-item label="自定义接收人">
            <div class="recipients-display">
              <a-tag v-for="recipient in (detailDialog.notification.recipient_users || [])" :key="recipient">
                {{ recipient }}
              </a-tag>
              <span v-if="!detailDialog.notification.recipient_users?.length">无</span>
            </div>
          </a-descriptions-item>
          <a-descriptions-item label="优先级">
            <a-tag :color="getPriorityColor(detailDialog.notification.priority)">
              {{ getPriorityName(detailDialog.notification.priority) }}
            </a-tag>
          </a-descriptions-item>
          <a-descriptions-item label="最大重试次数">{{ detailDialog.notification.max_retries }}</a-descriptions-item>
          <a-descriptions-item label="重试间隔">{{ detailDialog.notification.retry_interval }}分钟</a-descriptions-item>
          <a-descriptions-item label="是否默认配置">
            {{ detailDialog.notification.is_default === IsDefault.Yes ? '是' : '否' }}
          </a-descriptions-item>
          <a-descriptions-item label="创建时间">{{ formatFullDateTime(detailDialog.notification.created_at) }}</a-descriptions-item>
          <a-descriptions-item label="更新时间">{{ formatFullDateTime(detailDialog.notification.updated_at) }}</a-descriptions-item>
        </a-descriptions>

        <div class="message-template-preview">
          <h3>消息模板预览</h3>
          <div class="template-content">
            {{ getPreviewMessage(detailDialog.notification) }}
          </div>
        </div>

        <div class="detail-footer">
          <a-button @click="closeDetailDialog">关闭</a-button>
          <a-button type="default" @click="handleTestSend(detailDialog.notification)">测试发送</a-button>
          <a-button type="primary" @click="handleEditNotification(detailDialog.notification)">编辑</a-button>
        </div>
      </div>
    </a-modal>

    <!-- 发送记录对话框 -->
    <a-modal 
      :open="logsDialogVisible" 
      title="发送记录" 
      :width="logsDialogWidth"
      :footer="null" 
      @cancel="closeLogsDialog"
      class="logs-dialog"
    >
      <div class="send-logs">
        <a-table 
          :data-source="sendLogs" 
          :columns="logsColumns" 
          :pagination="logsPagination" 
          :loading="logsLoading" 
          row-key="id"
          size="small"
          @change="handleLogsTableChange"
        >
          <template #bodyCell="{ column, record }">
            <template v-if="column.key === 'channel'">
              <a-tag :color="getChannelColor(record.channel)">
                <component :is="getChannelIcon(record.channel)" style="margin-right: 4px;" />
                {{ getNotificationChannelName(record.channel) }}
              </a-tag>
            </template>
            <template v-if="column.key === 'status'">
              <a-tag :color="record.status === 'success' ? 'green' : 'red'">
                {{ record.status === 'success' ? '成功' : '失败' }}
              </a-tag>
            </template>
            <template v-if="column.key === 'createdAt'">
              {{ formatFullDateTime(record.createdAt) }}
            </template>
          </template>
        </a-table>
      </div>
    </a-modal>

    <!-- 手动发送对话框 -->
    <a-modal 
      :open="manualSendDialogVisible" 
      title="手动发送通知" 
      :width="600"
      @ok="saveManualSend" 
      @cancel="closeManualSendDialog"
      :destroy-on-close="true"
      :confirm-loading="manualSendDialog.saving"
      class="responsive-modal manual-send-modal"
    >
      <a-form :model="manualSendDialog.form" :rules="manualSendRules" layout="vertical">
        <a-form-item label="通知渠道" name="channels">
          <a-checkbox-group v-model:value="manualSendDialog.form.channels" style="width: 100%;">
            <a-row :gutter="[16, 16]">
              <a-col 
                :span="12" 
                v-for="channel in getAllNotificationChannels()" 
                :key="channel"
              >
                <a-checkbox :value="channel">
                  <span class="channel-option">
                    <component :is="getChannelIcon(channel)" :style="{ color: getChannelIconColor(channel) }" />
                    {{ getNotificationChannelName(channel) }}
                  </span>
                </a-checkbox>
              </a-col>
            </a-row>
          </a-checkbox-group>
        </a-form-item>

        <a-form-item label="接收人" name="recipient">
          <a-input
            v-model:value="manualSendDialog.form.recipient"
            placeholder="请输入接收人地址（邮箱、手机号、用户ID等）"
          />
          <div class="form-help" style="margin-top: 4px;">
            <small class="text-gray">
              支持邮箱、手机号、飞书用户ID、钉钉用户ID等格式
            </small>
          </div>
        </a-form-item>

        <a-form-item label="通知主题" name="subject">
          <a-input
            v-model:value="manualSendDialog.form.subject"
            placeholder="请输入通知主题"
          />
        </a-form-item>

        <a-form-item label="通知内容" name="content">
          <a-textarea
            v-model:value="manualSendDialog.form.content"
            :rows="6"
            placeholder="请输入通知内容"
            show-count
            :maxlength="1000"
          />
        </a-form-item>
      </a-form>
    </a-modal>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted, computed } from 'vue';
import { message, Modal } from 'ant-design-vue';
import { debounce } from 'lodash-es';
import dayjs from 'dayjs';
import type { FormInstance } from 'ant-design-vue';
import {
  PlusOutlined,
  BellOutlined,
  CheckCircleOutlined,
  StopOutlined,
  SendOutlined,
  DownOutlined,
  CopyOutlined,
  FileTextOutlined,
  MessageOutlined,
  MailOutlined,
  PhoneOutlined
} from '@ant-design/icons-vue';
import {
  NotificationStatus,
  NotificationChannel,
  NotificationTrigger,
  NotificationPriority,
  IsDefault,
  type Notification,
  type NotificationLog,
  type CreateNotificationReq,
  type UpdateNotificationReq,
  type ListNotificationReq,
  type ListSendLogReq,
  type ManualSendNotificationReq,
  getNotificationList,
  getNotificationDetail,
  createNotification,
  updateNotification,
  deleteNotification,
  updateNotificationStatus,
  getSendLogs,
  testSendNotification,
  duplicateNotification,
  sendNotificationManually,
  getEventTypeName,
  getNotificationChannelName,
  getRecipientTypeName,
  getAllEventTypes,
  getAllNotificationChannels,
  getAllRecipientTypes
} from '#/api/core/workorder/workorder_notification';
import { listWorkorderProcess, type WorkorderProcessItem } from '#/api/core/workorder/workorder_process';
import { listWorkorderTemplate, type WorkorderTemplateItem } from '#/api/core/workorder/workorder_template';
import { listWorkorderCategory, type WorkorderCategoryItem } from '#/api/core/workorder/workorder_category';
import { getUserList, type User } from '#/api/core/system/user';

// 表单ref
const formRef = ref<FormInstance>();

// 响应式对话框宽度
const notificationDialogWidth = computed(() => {
  if (typeof window !== 'undefined') {
    const width = window.innerWidth;
    if (width < 768) return '95%';
    if (width < 1024) return '90%';
    return '800px';
  }
  return '800px';
});

const detailDialogWidth = computed(() => {
  if (typeof window !== 'undefined') {
    const width = window.innerWidth;
    if (width < 768) return '95%';
    if (width < 1024) return '90%';
    return '900px';
  }
  return '900px';
});

const logsDialogWidth = computed(() => {
  if (typeof window !== 'undefined') {
    const width = window.innerWidth;
    if (width < 768) return '95%';
    if (width < 1024) return '85%';
    return '1000px';
  }
  return '1000px';
});

// 列定义
const columns = [
  { title: '配置名称', dataIndex: 'name', key: 'name', width: 200, fixed: 'left' },
  { title: '触发事件', dataIndex: 'event_types', key: 'eventTypes', width: 150 },
  { title: '接收人类型', dataIndex: 'recipient_types', key: 'recipientTypes', width: 150 },
  { title: '通知渠道', dataIndex: 'channels', key: 'channels', width: 180 },
  { title: '触发类型', dataIndex: 'trigger_type', key: 'triggerType', width: 120 },
  { title: '优先级', dataIndex: 'priority', key: 'priority', width: 80, align: 'center' as const },
  { title: '状态', dataIndex: 'status', key: 'status', width: 80, align: 'center' as const },
  { title: '创建时间', dataIndex: 'created_at', key: 'createdAt', width: 140 },
  { title: '操作', key: 'action', width: 200, align: 'center' as const, fixed: 'right' }
];

const logsColumns = [
  { title: '渠道', dataIndex: 'channel', key: 'channel', width: 100 },
  { title: '接收人', dataIndex: 'recipient', key: 'recipient', width: 150 },
  { title: '状态', dataIndex: 'status', key: 'status', width: 80 },
  { title: '发送时间', dataIndex: 'createdAt', key: 'createdAt', width: 180 },
  { title: '错误信息', dataIndex: 'error', key: 'error', ellipsis: true }
];

// 状态数据
const loading = ref(false);
const logsLoading = ref(false);
const searchQuery = ref('');
const channelFilter = ref<string | undefined>(undefined);
const statusFilter = ref<number | undefined>(undefined);
const notifications = ref<(Notification & { statusLoading?: boolean })[]>([]);
const sendLogs = ref<NotificationLog[]>([]);

// 联动数据
const processes = ref<WorkorderProcessItem[]>([]);
const templates = ref<WorkorderTemplateItem[]>([]);
const categories = ref<WorkorderCategoryItem[]>([]);
const users = ref<User[]>([]);

// 分页加载状态
const processLoading = ref(false);
const templateLoading = ref(false);
const categoryLoading = ref(false);
const userLoading = ref(false);

// 分页参数
const processPagination = reactive({
  current: 1,
  pageSize: 20,
  total: 0,
  hasMore: true
});

const templatePagination = reactive({
  current: 1,
  pageSize: 20,
  total: 0,
  hasMore: true
});

const categoryPagination = reactive({
  current: 1,
  pageSize: 20,
  total: 0,
  hasMore: true
});

const userPagination = reactive({
  current: 1,
  pageSize: 20,
  total: 0,
  hasMore: true
});

// 统计数据
const stats = reactive({
  total: 0,
  enabled: 0,
  disabled: 0,
  todaySent: 0
});

// 分页配置
const paginationConfig = reactive({
  current: 1,
  pageSize: 10,
  total: 0,
  showSizeChanger: true,
  showQuickJumper: true,
  showTotal: (total: number) => `共 ${total} 条记录`,
  size: 'default' as const
});

const logsPagination = reactive({
  current: 1,
  pageSize: 10,
  total: 0,
  size: 'small' as const
});



// 对话框状态
const notificationDialogVisible = ref(false);
const detailDialogVisible = ref(false);
const logsDialogVisible = ref(false);
const manualSendDialogVisible = ref(false);

// 通知配置对话框数据
const notificationDialog = reactive({
  isEdit: false,
  saving: false,
  form: {
    id: undefined as number | undefined,
    name: '',
    description: '',
    processId: undefined as number | undefined,
    templateId: undefined as number | undefined,
    categoryId: undefined as number | undefined,
    eventTypes: [] as string[],
    triggerType: NotificationTrigger.IMMEDIATE as string,
    triggerCondition: '',
    channels: [] as string[],
    recipientTypes: [] as string[],
    recipientUsers: [] as string[],
    recipientRoles: [] as string[],
    recipientDepts: [] as string[],
    messageTemplate: '您好 {recipient_name}！\n\n工单通知：{title}\n工单编号：{serial_number}\n优先级：{priority_text}\n状态：{status}\n\n详情请查看系统。\n\n通知时间：{notification_time}\n平台：{platform_name}',
    subjectTemplate: '',
    scheduledTime: undefined as any,
    repeatInterval: undefined as number | undefined,
    maxRetries: 3,
    retryInterval: 5,
    status: NotificationStatus.Enabled as number,
    priority: NotificationPriority.Medium as number,
    isDefault: IsDefault.No as number
  }
});

// 详情对话框数据
const detailDialog = reactive({
  notification: null as Notification | null
});

// 手动发送对话框数据
const manualSendDialog = reactive({
  saving: false,
  form: {
    channels: [] as string[],
    recipient: '',
    subject: '',
    content: ''
  }
});

// 表单验证规则
const notificationRules = {
  name: [
    { required: true, message: '请输入配置名称', trigger: 'blur' }
  ],
  eventTypes: [
    { required: true, type: 'array', min: 1, message: '请选择至少一个触发事件', trigger: 'change' }
  ],
  triggerType: [
    { required: true, message: '请选择触发类型', trigger: 'change' }
  ],
  channels: [
    { required: true, type: 'array', min: 1, message: '请选择至少一个通知渠道', trigger: 'change' }
  ],
  recipientTypes: [
    { required: true, type: 'array', min: 1, message: '请选择至少一种接收人类型', trigger: 'change' }
  ],
  recipientUsers: [
    {
      validator: (_rule: any, value: string[], callback: Function) => {
        if (notificationDialog.form.recipientTypes.includes('user') && (!value || value.length === 0 || value.some(v => !v || !v.trim()))) {
          callback(new Error('选择了用户类型接收人时，请至少输入一个有效的用户ID'));
        }
        callback();
      },
      trigger: 'change'
    }
  ],
  recipientRoles: [
    {
      validator: (_rule: any, value: string[], callback: Function) => {
        if (notificationDialog.form.recipientTypes.includes('role') && (!value || value.length === 0 || value.some(v => !v || !v.trim()))) {
          callback(new Error('选择了角色类型接收人时，请至少输入一个有效的角色ID'));
        }
        callback();
      },
      trigger: 'change'
    }
  ],
  recipientDepts: [
    {
      validator: (_rule: any, value: string[], callback: Function) => {
        if (notificationDialog.form.recipientTypes.includes('dept') && (!value || value.length === 0 || value.some(v => !v || !v.trim()))) {
          callback(new Error('选择了部门类型接收人时，请至少输入一个有效的部门ID'));
        }
        callback();
      },
      trigger: 'change'
    }
  ],
  messageTemplate: [
    { required: true, message: '请输入消息模板', trigger: 'blur' }
  ],
  maxRetries: [
    { required: true, type: 'number', min: 0, max: 10, message: '最大重试次数必须在0-10之间', trigger: 'blur' }
  ],
  retryInterval: [
    { required: true, type: 'number', min: 1, message: '重试间隔必须大于0', trigger: 'blur' }
  ],
  priority: [
    { required: true, message: '请选择优先级', trigger: 'change' }
  ]
};

// 手动发送验证规则
const manualSendRules = {
  channels: [
    { required: true, type: 'array', min: 1, message: '请选择至少一个通知渠道', trigger: 'change' }
  ],
  recipient: [
    { required: true, message: '请输入接收人地址', trigger: 'blur' },
    {
      validator: (_rule: any, value: string, callback: Function) => {
        if (!value || !value.trim()) {
          callback(new Error('接收人地址不能为空'));
          return;
        }
        
        // 检查是否包含邮件渠道，如果有则验证邮箱格式
        if (manualSendDialog.form.channels.includes('email')) {
          const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
          if (!emailRegex.test(value.trim())) {
            callback(new Error('选择了邮件渠道时，请输入有效的邮箱地址'));
            return;
          }
        }
        
        // 检查是否包含短信渠道，如果有则验证手机号格式
        if (manualSendDialog.form.channels.includes('sms')) {
          const phoneRegex = /^1[3-9]\d{9}$/;
          if (!phoneRegex.test(value.trim())) {
            callback(new Error('选择了短信渠道时，请输入有效的手机号码'));
            return;
          }
        }
        
        callback();
      },
      trigger: 'blur'
    }
  ],
  subject: [
    { required: true, message: '请输入通知主题', trigger: 'blur' }
  ],
  content: [
    { required: true, message: '请输入通知内容', trigger: 'blur' }
  ]
};

// 防抖搜索
const debouncedSearch = debounce(() => {
  paginationConfig.current = 1;
  loadNotifications();
}, 500);

// 禁用过去日期
const disabledDate = (current: any) => {
  return current && current < dayjs().startOf('day');
};

// 工具函数
const getEventTypesDisplay = (eventTypes: string[]): string => {
  if (eventTypes.length <= 2) {
    return eventTypes.map(type => getEventTypeName(type)).join(', ');
  }
  return `${eventTypes.slice(0, 2).map(type => getEventTypeName(type)).join(', ')} 等${eventTypes.length}个`;
};

const getRecipientTypesDisplay = (recipientTypes: string[]): string => {
  if (recipientTypes.length <= 2) {
    return recipientTypes.map(type => getRecipientTypeName(type)).join(', ');
  }
  return `${recipientTypes.slice(0, 2).map(type => getRecipientTypeName(type)).join(', ')} 等${recipientTypes.length}个`;
};

const getPriorityName = (priority: number): string => {
  const priorityMap: Record<number, string> = {
    [NotificationPriority.High]: '高',
    [NotificationPriority.Medium]: '中',
    [NotificationPriority.Low]: '低'
  };
  return priorityMap[priority] || '未知';
};

const getPriorityColor = (priority: number): string => {
  const colorMap: Record<number, string> = {
    [NotificationPriority.High]: 'red',
    [NotificationPriority.Medium]: 'orange',
    [NotificationPriority.Low]: 'green'
  };
  return colorMap[priority] || 'default';
};

const getTriggerTypeName = (type: string): string => {
  const typeMap: Record<string, string> = {
    [NotificationTrigger.IMMEDIATE]: '立即触发',
    [NotificationTrigger.DELAYED]: '延迟触发',
    [NotificationTrigger.SCHEDULED]: '定时触发',
    [NotificationTrigger.CONDITIONAL]: '条件触发'
  };
  return typeMap[type] || type;
};


const getChannelColor = (channel: string): string => {
  const colorMap: Record<string, string> = {
    [NotificationChannel.FEISHU]: 'green',
    [NotificationChannel.EMAIL]: 'blue',
    [NotificationChannel.SMS]: 'orange',
    [NotificationChannel.WEBHOOK]: 'purple'
  };
  return colorMap[channel] || 'default';
};

const getChannelIcon = (channel: string) => {
  const iconMap: Record<string, any> = {
    [NotificationChannel.FEISHU]: MessageOutlined,
    [NotificationChannel.EMAIL]: MailOutlined,
    [NotificationChannel.SMS]: PhoneOutlined,
    [NotificationChannel.WEBHOOK]: SendOutlined
  };
  return iconMap[channel] || MessageOutlined;
};

const getChannelIconColor = (channel: string): string => {
  const colorMap: Record<string, string> = {
    [NotificationChannel.FEISHU]: '#00b96b',
    [NotificationChannel.EMAIL]: '#1890ff',
    [NotificationChannel.SMS]: '#fa8c16',
    [NotificationChannel.WEBHOOK]: '#722ed1'
  };
  return colorMap[channel] || '#666';
};

const formatDate = (dateStr?: string): string => {
  if (!dateStr) return '';
  return dayjs(dateStr).format('YYYY-MM-DD');
};

const formatTime = (dateStr?: string): string => {
  if (!dateStr) return '';
  return dayjs(dateStr).format('HH:mm');
};

const formatFullDateTime = (dateStr?: string): string => {
  if (!dateStr) return '';
  return dayjs(dateStr).format('YYYY-MM-DD HH:mm:ss');
};

const getPreviewMessage = (notification: Notification): string => {
  return (notification.message_template || '')
    .replace('{title}', '示例工单标题')
    .replace('{serial_number}', 'WO-202401001')
    .replace('{workorder_id}', '123456')
    .replace('{recipient_name}', '张三')
    .replace('{recipient_addr}', 'zhangsan@example.com')
    .replace('{priority_text}', '高')
    .replace('{priority_level}', '1')
    .replace('{status}', '待处理')
    .replace('{description}', '这是一个示例工单描述')
    .replace('{operator_name}', '系统管理员')
    .replace('{assignee_name}', '李四')
    .replace('{event_type}', '工单创建')
    .replace('{event_type_text}', '工单创建')
    .replace('{notification_time}', dayjs().format('YYYY-MM-DD HH:mm:ss'))
    .replace('{notification_date}', dayjs().format('YYYY-MM-DD'))
    .replace('{notification_year}', dayjs().format('YYYY'))
    .replace('{notification_month}', dayjs().format('MM'))
    .replace('{notification_day}', dayjs().format('DD'))
    .replace('{company_name}', 'AI-CloudOps')
    .replace('{platform_name}', '智能运维管理平台')
    .replace('{department}', '技术运维部')
    .replace('{service_hotline}', '400-000-0000')
    .replace('{custom_content}', '自定义内容示例')
    .replace('{created_time}', dayjs().subtract(1, 'hour').format('YYYY-MM-DD HH:mm:ss'))
    .replace('{updated_time}', dayjs().format('YYYY-MM-DD HH:mm:ss'));
};

// 添加缺失的函数
const getFormName = (templateId?: number): string => {
  if (!templateId) return '未知模板';
  const template = templates.value.find(t => t.id === templateId);
  return template ? template.name : `模板 ${templateId}`;
};



// 实现 getAvailableChannels 函数
const getAvailableChannels = (): string[] => {
  return getAllNotificationChannels();
};

// 联动数据加载函数
const loadProcesses = async (reset = false): Promise<void> => {
  if (processLoading.value || (!processPagination.hasMore && !reset)) return;
  
  if (reset) {
    processPagination.current = 1;
    processPagination.hasMore = true;
    processes.value = [];
  }
  
  processLoading.value = true;
  
  try {
    const res = await listWorkorderProcess({
      page: processPagination.current,
      size: processPagination.pageSize,
      search: '',
      status: 2 // 只加载已发布的流程
    });
    
    if (res) {
      const newItems = res.items || [];
      if (reset) {
        processes.value = newItems;
      } else {
        processes.value.push(...newItems);
      }
      
      processPagination.total = res.total || 0;
      processPagination.current++;
      processPagination.hasMore = newItems.length >= processPagination.pageSize;
    }
  } catch (error) {
    console.error('Failed to load processes:', error);
  } finally {
    processLoading.value = false;
  }
};

const loadTemplates = async (reset = false): Promise<void> => {
  if (templateLoading.value || (!templatePagination.hasMore && !reset)) return;
  
  if (reset) {
    templatePagination.current = 1;
    templatePagination.hasMore = true;
    templates.value = [];
  }
  
  templateLoading.value = true;
  
  try {
    const res = await listWorkorderTemplate({
      page: templatePagination.current,
      size: templatePagination.pageSize,
      search: '',
      status: 1 // 只加载启用的模板
    });
    
    if (res) {
      const newItems = res.items || [];
      if (reset) {
        templates.value = newItems;
      } else {
        templates.value.push(...newItems);
      }
      
      templatePagination.total = res.total || 0;
      templatePagination.current++;
      templatePagination.hasMore = newItems.length >= templatePagination.pageSize;
    }
  } catch (error) {
    console.error('Failed to load templates:', error);
  } finally {
    templateLoading.value = false;
  }
};

const loadCategories = async (reset = false): Promise<void> => {
  if (categoryLoading.value || (!categoryPagination.hasMore && !reset)) return;
  
  if (reset) {
    categoryPagination.current = 1;
    categoryPagination.hasMore = true;
    categories.value = [];
  }
  
  categoryLoading.value = true;
  
  try {
    const res = await listWorkorderCategory({
      page: categoryPagination.current,
      size: categoryPagination.pageSize,
      search: '',
      status: 1 // 只加载启用的分类
    });
    
    if (res) {
      const newItems = res.items || [];
      if (reset) {
        categories.value = newItems;
      } else {
        categories.value.push(...newItems);
      }
      
      categoryPagination.total = res.total || 0;
      categoryPagination.current++;
      categoryPagination.hasMore = newItems.length >= categoryPagination.pageSize;
    }
  } catch (error) {
    console.error('Failed to load categories:', error);
  } finally {
    categoryLoading.value = false;
  }
};

const loadUsers = async (reset = false): Promise<void> => {
  if (userLoading.value || (!userPagination.hasMore && !reset)) return;
  
  if (reset) {
    userPagination.current = 1;
    userPagination.hasMore = true;
    users.value = [];
  }
  
  userLoading.value = true;
  
  try {
    const res = await getUserList({
      page: userPagination.current,
      size: userPagination.pageSize,
      search: '',
      enable: 1 // 只加载启用的用户
    });
    
    if (res) {
      const newItems = res.items || [];
      if (reset) {
        users.value = newItems;
      } else {
        users.value.push(...newItems);
      }
      
      userPagination.total = res.total || 0;
      userPagination.current++;
      userPagination.hasMore = newItems.length >= userPagination.pageSize;
    }
  } catch (error) {
    console.error('Failed to load users:', error);
  } finally {
    userLoading.value = false;
  }
};

// 滚动分页处理函数
const handleProcessScroll = (e: Event): void => {
  const { target } = e;
  if (target) {
    const element = target as HTMLElement;
    const { scrollTop, scrollHeight, clientHeight } = element;
    if (scrollTop + clientHeight >= scrollHeight - 5) {
      loadProcesses();
    }
  }
};

const handleTemplateScroll = (e: Event): void => {
  const { target } = e;
  if (target) {
    const element = target as HTMLElement;
    const { scrollTop, scrollHeight, clientHeight } = element;
    if (scrollTop + clientHeight >= scrollHeight - 5) {
      loadTemplates();
    }
  }
};

const handleCategoryScroll = (e: Event): void => {
  const { target } = e;
  if (target) {
    const element = target as HTMLElement;
    const { scrollTop, scrollHeight, clientHeight } = element;
    if (scrollTop + clientHeight >= scrollHeight - 5) {
      loadCategories();
    }
  }
};





// 搜索和过滤
const handleSearch = (): void => {
  paginationConfig.current = 1;
  loadNotifications();
};

const handleSearchChange = (): void => {
  debouncedSearch();
};

const handleChannelChange = (): void => {
  paginationConfig.current = 1;
  loadNotifications();
};

const handleStatusChange = (): void => {
  paginationConfig.current = 1;
  loadNotifications();
};

const handleResetFilters = (): void => {
  searchQuery.value = '';
  channelFilter.value = undefined;
  statusFilter.value = undefined;
  paginationConfig.current = 1;
  loadNotifications();
  message.success('过滤条件已重置');
};

const handleTableChange = (pagination: any, _filters: any, _sorter: any): void => {
  paginationConfig.current = pagination.current;
  if (pagination.pageSize !== paginationConfig.pageSize) {
    paginationConfig.pageSize = pagination.pageSize;
    paginationConfig.current = 1; // 当改变页面大小时重置到第一页
  }
  loadNotifications();
};

// 计算统计数据
const calculateStats = (): void => {
  stats.total = paginationConfig.total;
  stats.enabled = notifications.value.filter(item => item.status === NotificationStatus.Enabled).length;
  stats.disabled = notifications.value.filter(item => item.status === NotificationStatus.Disabled).length;
  // 由于没有API接口，今日发送数据设为静态值
  stats.todaySent = 0;
};

// 数据加载
const loadNotifications = async (): Promise<void> => {
  loading.value = true;
  
  try {
    const params: ListNotificationReq = {
      page: paginationConfig.current,
      size: paginationConfig.pageSize,
      name: searchQuery.value,
      channel: channelFilter.value,
      status: statusFilter.value
    };
    
    const res = await getNotificationList(params);
    if (res) {
      notifications.value = (res.items || []).map((item: any) => ({
        ...item,
        statusLoading: false
      }));
      paginationConfig.total = res.total || 0;
      
      // 计算统计数据
      calculateStats();
    }
  } catch (error) {
    message.error('加载通知配置失败');
    console.error('Failed to load notifications:', error);
  } finally {
    loading.value = false;
  }
};

// 处理发送记录表格分页变化
const handleLogsTableChange = (pagination: any): void => {
  logsPagination.current = pagination.current;
  if (pagination.pageSize !== logsPagination.pageSize) {
    logsPagination.pageSize = pagination.pageSize;
    logsPagination.current = 1; // 当改变页面大小时重置到第一页
  }
  if (detailDialog.notification?.id) {
    loadSendLogs(detailDialog.notification.id);
  }
};

// 加载发送记录
const loadSendLogs = async (notificationId: number): Promise<void> => {
  logsLoading.value = true;
  
  try {
    const params: ListSendLogReq = {
      page: logsPagination.current,
      size: logsPagination.pageSize,
      notificationId: notificationId
    };
    const res = await getSendLogs(params);
    if (res) {
      sendLogs.value = res.items || [];
      logsPagination.total = res.total || 0;
    }
  } catch (error) {
    message.error('加载发送记录失败');
    console.error('Failed to load send logs:', error);
  } finally {
    logsLoading.value = false;
  }
};

// 事件处理
const handleCreateNotification = (): void => {
  notificationDialog.isEdit = false;
  notificationDialog.saving = false;
  notificationDialog.form = {
    id: undefined,
    name: '',
    description: '',
    processId: undefined,
    templateId: undefined,
    categoryId: undefined,
    eventTypes: ['instance_created', 'instance_submitted'],
    triggerType: NotificationTrigger.IMMEDIATE as string,
    triggerCondition: '',
    channels: [],
    recipientTypes: ['creator'],
    recipientUsers: [],
    recipientRoles: [],
    recipientDepts: [],
    messageTemplate: '您好 {recipient_name}！\n\n工单通知：{title}\n工单编号：{serial_number}\n优先级：{priority_text}\n状态：{status}\n\n详情请查看系统。\n\n通知时间：{notification_time}\n平台：{platform_name}',
    subjectTemplate: '',
    scheduledTime: undefined,
    repeatInterval: undefined,
    maxRetries: 3,
    retryInterval: 5,
    status: NotificationStatus.Enabled,
    priority: NotificationPriority.Medium,
    isDefault: IsDefault.No
  };
  
  notificationDialogVisible.value = true;
};

const handleEditNotification = (record: Notification): void => {
  notificationDialog.isEdit = true;
  notificationDialog.saving = false;
  notificationDialog.form = { 
    id: record.id,
    name: record.name,
    description: record.description || '',
    processId: record.process_id,
    templateId: record.template_id,
    categoryId: record.category_id,
    eventTypes: record.event_types || [],
    triggerType: record.trigger_type,
    triggerCondition: record.trigger_condition ? JSON.stringify(record.trigger_condition) : '',
    channels: record.channels || [],
    recipientTypes: record.recipient_types || [],
    recipientUsers: record.recipient_users || [],
    recipientRoles: record.recipient_roles || [],
    recipientDepts: record.recipient_depts || [],
    messageTemplate: record.message_template,
    subjectTemplate: record.subject_template || '',
    scheduledTime: record.scheduled_time ? dayjs(record.scheduled_time) : undefined,
    repeatInterval: record.repeat_interval,
    maxRetries: record.max_retries,
    retryInterval: record.retry_interval,
    status: record.status as number,
    priority: record.priority as number,
    isDefault: record.is_default as number
  };
  
  // 关闭详情对话框并显示编辑对话框
  detailDialogVisible.value = false;
  notificationDialogVisible.value = true;
};

const handleViewNotification = async (record: Notification): Promise<void> => {
  try {
    if (record.id) {
      const res = await getNotificationDetail(record.id);
      if (res) {
        detailDialog.notification = res;
        detailDialogVisible.value = true;
      }
    }
  } catch (error) {
    message.error('获取通知配置详情失败');
    console.error('Failed to get notification detail:', error);
  }
};

const handleStatusToggle = async (record: Notification & { statusLoading?: boolean }, checked: boolean): Promise<void> => {
  if (!record.id) {
    message.error('通知配置ID不存在');
    return;
  }

  record.statusLoading = true;
  const newStatus = checked ? NotificationStatus.Enabled : NotificationStatus.Disabled;
  
  try {
    await updateNotificationStatus(record.id, newStatus);
    record.status = newStatus;
    const statusText = newStatus === NotificationStatus.Enabled ? '启用' : '禁用';
    message.success(`通知配置已${statusText}`);
  } catch (error) {
    message.error('更新状态失败');
    console.error('Failed to update status:', error);
  } finally {
    record.statusLoading = false;
  }
};

const handleMenuClick = (command: string, record: Notification): void => {
  switch (command) {
    case 'test':
      handleTestSend(record);
      break;
    case 'manual':
      handleManualSend(record);
      break;
    case 'logs':
      handleViewLogs(record);
      break;
    case 'duplicate':
      handleDuplicateNotification(record);
      break;
    case 'delete':
      handleDeleteNotification(record);
      break;
  }
};

const handleTestSend = (record: Notification): void => {
  if (!record.id) {
    message.error('通知配置ID不存在');
    return;
  }
  
  Modal.confirm({
    title: '测试发送',
    content: `确定要向配置的接收人发送测试通知吗？`,
    okText: '发送',
    cancelText: '取消',
    onOk: async () => {
      let loadingMessage: any = null;
      try {
        loadingMessage = message.loading('正在发送测试通知...', 0);
        
        // 添加超时处理
        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(() => reject(new Error('请求超时')), 30000); // 30秒超时
        });
        
        const sendPromise = testSendNotification({ notification_id: record.id! });
        
        await Promise.race([sendPromise, timeoutPromise]);
        
        // 确保关闭loading
        if (loadingMessage) {
          loadingMessage();
          loadingMessage = null;
        }
        
        message.success('测试通知发送成功');
      } catch (error: any) {
        // 确保关闭loading
        if (loadingMessage) {
          loadingMessage();
          loadingMessage = null;
        }
        
        let errorMessage = '测试通知发送失败';
        if (error.message) {
          if (error.message.includes('timeout') || error.message.includes('超时')) {
            errorMessage = '测试发送超时，请检查网络连接或稍后重试';
          } else if (error.message.includes('network') || error.message.includes('网络')) {
            errorMessage = '网络连接异常，请检查网络后重试';
          } else if (error.message.includes('404')) {
            errorMessage = '通知配置不存在或已被删除';
          } else if (error.message.includes('403')) {
            errorMessage = '没有权限执行此操作';
          } else if (error.message.includes('500')) {
            errorMessage = '服务器内部错误，请联系管理员';
          } else {
            errorMessage = `发送失败: ${error.message}`;
          }
        }
        
        message.error(errorMessage);
        console.error('Failed to send test notification:', error);
      }
    }
  });
};

const handleManualSend = (record: Notification): void => {
  // 重置表单数据
  manualSendDialog.saving = false;
  manualSendDialog.form = {
    channels: record.channels || [],
    recipient: '',
    subject: `AI-CloudOps 工单通知 - {title}`,
    content: getPreviewMessage(record)
  };
  
  // 显示对话框
  manualSendDialogVisible.value = true;
};

const handleViewLogs = (record: Notification): void => {
  if (record.id) {
    // 重置分页到第一页并加载数据
    logsPagination.current = 1;
    logsPagination.pageSize = 10;
    loadSendLogs(record.id);
    logsDialogVisible.value = true;
  } else {
    message.error('通知配置ID不存在');
  }
};

const handleDuplicateNotification = async (record: Notification): Promise<void> => {
  if (!record.id) {
    message.error('通知配置ID不存在');
    return;
  }
  
  const loadingMessage = message.loading('正在复制通知配置...', 0);
  
  try {
    // 添加超时处理
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('请求超时')), 30000); // 30秒超时
    });
    
    const duplicatePromise = duplicateNotification(record.id!);
    
    const res = await Promise.race([duplicatePromise, timeoutPromise]);
    
    loadingMessage();
    
    if (res && res.id) {
      message.success('复制通知配置成功');
      loadNotifications();
    } else {
      message.error('复制失败：服务器返回异常数据');
    }
  } catch (error: any) {
    loadingMessage();
    
    let errorMessage = '复制配置失败';
    if (error.message) {
      if (error.message.includes('timeout') || error.message.includes('超时')) {
        errorMessage = '复制超时，请稍后重试';
      } else if (error.message.includes('404')) {
        errorMessage = '通知配置不存在或已被删除';
      } else if (error.message.includes('403')) {
        errorMessage = '没有权限执行此操作';
      } else if (error.message.includes('500')) {
        errorMessage = '服务器内部错误，请联系管理员';
      } else {
        errorMessage = `复制失败: ${error.message}`;
      }
    }
    
    message.error(errorMessage);
    console.error('Failed to duplicate notification:', error);
  }
};

const handleDeleteNotification = (record: Notification): void => {
  if (!record.id) {
    message.error('通知配置ID不存在');
    return;
  }
  
  Modal.confirm({
    title: '删除确认',
    content: `确定要删除表单"${getFormName(record.template_id)}"的通知配置吗？`,
    okText: '删除',
    okType: 'danger',
    cancelText: '取消',
    onOk: async () => {
      let loadingMessage: any = null;
      try {
        loadingMessage = message.loading('正在删除通知配置...', 0);
        
        // 添加超时处理
        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(() => reject(new Error('请求超时')), 30000); // 30秒超时
        });
        
        const deletePromise = deleteNotification(record.id!);
        
        await Promise.race([deletePromise, timeoutPromise]);
        
        if (loadingMessage) {
          loadingMessage();
          loadingMessage = null;
        }
        
        message.success('通知配置已删除');
        loadNotifications();
      } catch (error: any) {
        if (loadingMessage) {
          loadingMessage();
          loadingMessage = null;
        }
        
        let errorMessage = '删除失败';
        if (error.message) {
          if (error.message.includes('timeout') || error.message.includes('超时')) {
            errorMessage = '删除超时，请稍后重试';
          } else if (error.message.includes('404')) {
            errorMessage = '通知配置不存在或已被删除';
          } else if (error.message.includes('403')) {
            errorMessage = '没有权限执行此操作';
          } else if (error.message.includes('409')) {
            errorMessage = '配置正在使用中，无法删除';
          } else if (error.message.includes('500')) {
            errorMessage = '服务器内部错误，请联系管理员';
          } else {
            errorMessage = `删除失败: ${error.message}`;
          }
        }
        
        message.error(errorMessage);
        console.error('Failed to delete notification:', error);
      }
    }
  });
};

const saveNotification = async (): Promise<void> => {
  try {
    await formRef.value?.validate();
  } catch (error) {
    return;
  }

  // 增加额外的业务逻辑验证
  const formData = notificationDialog.form;
  
  // 验证接收人配置完整性
  if (formData.recipientTypes.includes('user') && (!formData.recipientUsers || formData.recipientUsers.length === 0 || formData.recipientUsers.some(u => !u || !u.trim()))) {
    message.error('选择了用户类型接收人时，必须配置有效的用户ID');
    return;
  }
  
  if (formData.recipientTypes.includes('role') && (!formData.recipientRoles || formData.recipientRoles.length === 0 || formData.recipientRoles.some(r => !r || !r.trim()))) {
    message.error('选择了角色类型接收人时，必须配置有效的角色ID');
    return;
  }
  
  if (formData.recipientTypes.includes('dept') && (!formData.recipientDepts || formData.recipientDepts.length === 0 || formData.recipientDepts.some(d => !d || !d.trim()))) {
    message.error('选择了部门类型接收人时，必须配置有效的部门ID');
    return;
  }
  
  // 验证渠道与接收人类型的兼容性
  const hasFeishuChannel = formData.channels.includes('feishu');
  const hasUserRecipient = formData.recipientTypes.includes('user');
  
  if (hasFeishuChannel && !hasUserRecipient && formData.recipientTypes.length === 1 && formData.recipientTypes.includes('creator')) {
    message.warning('使用飞书通知时，建议同时配置用户ID接收人，以确保通知能正常发送');
  }

  notificationDialog.saving = true;
  
  try {
    const scheduledTime = formData.scheduledTime ? 
      dayjs(formData.scheduledTime).format('YYYY-MM-DD HH:mm:ss') : 
      undefined;

    // 处理触发条件
    let triggerCondition: Record<string, any> | undefined;
    if (formData.triggerCondition) {
      try {
        triggerCondition = JSON.parse(formData.triggerCondition);
      } catch {
        message.error('触发条件格式不正确，请输入有效的JSON');
        return;
      }
    }
    
    // 清理空的接收人数据
    const cleanRecipientUsers = formData.recipientUsers?.filter(u => u && u.trim()) || [];
    const cleanRecipientRoles = formData.recipientRoles?.filter(r => r && r.trim()) || [];
    const cleanRecipientDepts = formData.recipientDepts?.filter(d => d && d.trim()) || [];

    if (notificationDialog.isEdit) {
      // 更新通知配置
      if (!formData.id) {
        message.error('通知配置ID不存在');
        return;
      }
      
      const updateReq: UpdateNotificationReq = {
        id: formData.id,
        name: formData.name,
        description: formData.description,
        process_id: formData.processId,
        template_id: formData.templateId,
        category_id: formData.categoryId,
        event_types: formData.eventTypes,
        trigger_type: formData.triggerType,
        trigger_condition: triggerCondition,
        channels: formData.channels,
        recipient_types: formData.recipientTypes,
        recipient_users: cleanRecipientUsers,
        recipient_roles: cleanRecipientRoles,
        recipient_depts: cleanRecipientDepts,
        message_template: formData.messageTemplate,
        subject_template: formData.subjectTemplate,
        scheduled_time: scheduledTime,
        repeat_interval: formData.repeatInterval,
        max_retries: formData.maxRetries,
        retry_interval: formData.retryInterval,
        status: formData.status,
        priority: formData.priority,
        is_default: formData.isDefault
      };
      
      await updateNotification(updateReq);
      message.success('通知配置已更新');
    } else {
      // 创建通知配置
      const createReq: CreateNotificationReq = {
        name: formData.name,
        description: formData.description,
        process_id: formData.processId,
        template_id: formData.templateId,
        category_id: formData.categoryId,
        event_types: formData.eventTypes,
        trigger_type: formData.triggerType,
        trigger_condition: triggerCondition,
        channels: formData.channels,
        recipient_types: formData.recipientTypes,
        recipient_users: cleanRecipientUsers,
        recipient_roles: cleanRecipientRoles,
        recipient_depts: cleanRecipientDepts,
        message_template: formData.messageTemplate,
        subject_template: formData.subjectTemplate,
        scheduled_time: scheduledTime,
        repeat_interval: formData.repeatInterval,
        max_retries: formData.maxRetries,
        retry_interval: formData.retryInterval,
        priority: formData.priority,
        is_default: formData.isDefault
      };
      
      await createNotification(createReq);
      message.success('通知配置已创建');
    }
    
    notificationDialogVisible.value = false;
    loadNotifications();
  } catch (error: any) {
    // 根据错误类型提供更具体的错误信息
    let errorMessage = notificationDialog.isEdit ? '更新失败' : '创建失败';
    
    if (error.message) {
      if (error.message.includes('datetime') || error.message.includes('NOW()')) {
        errorMessage += ': 服务器时间格式错误，请联系管理员';
      } else if (error.message.includes('duplicate') || error.message.includes('重复')) {
        errorMessage += ': 配置名称已存在，请使用其他名称';
      } else if (error.message.includes('validation') || error.message.includes('验证')) {
        errorMessage += ': 数据验证失败，请检查输入内容';
      } else if (error.message.includes('timeout') || error.message.includes('超时')) {
        errorMessage += ': 请求超时，请稍后重试';
      } else if (error.message.includes('network') || error.message.includes('网络')) {
        errorMessage += ': 网络连接异常，请检查网络';
      } else {
        errorMessage += `: ${error.message}`;
      }
    }
    
    message.error(errorMessage);
    console.error('Failed to save notification:', error);
  } finally {
    notificationDialog.saving = false;
  }
};



// 对话框关闭
const closeNotificationDialog = (): void => {
  notificationDialogVisible.value = false;
  if (formRef.value) {
    formRef.value.resetFields();
  }
};

const closeDetailDialog = (): void => {
  detailDialogVisible.value = false;
  detailDialog.notification = null;
};

const closeLogsDialog = (): void => {
  logsDialogVisible.value = false;
  sendLogs.value = [];
};

const closeManualSendDialog = (): void => {
  manualSendDialogVisible.value = false;
  manualSendDialog.form = {
    channels: [],
    recipient: '',
    subject: '',
    content: ''
  };
};

const saveManualSend = async (): Promise<void> => {
  if (manualSendDialog.form.channels.length === 0) {
    message.error('请选择至少一个通知渠道');
    return;
  }
  
  if (!manualSendDialog.form.recipient.trim()) {
    message.error('请输入接收人地址');
    return;
  }
  
  if (!manualSendDialog.form.subject.trim()) {
    message.error('请输入通知主题');
    return;
  }
  
  if (!manualSendDialog.form.content.trim()) {
    message.error('请输入通知内容');
    return;
  }

  manualSendDialog.saving = true;
  
  try {
    const sendData: ManualSendNotificationReq = {
      channels: manualSendDialog.form.channels,
      recipient: manualSendDialog.form.recipient.trim(),
      subject: manualSendDialog.form.subject.trim(),
      content: manualSendDialog.form.content.trim()
    };
    
    // 添加超时处理
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('请求超时')), 30000); // 30秒超时
    });
    
    const sendPromise = sendNotificationManually(sendData);
    
    await Promise.race([sendPromise, timeoutPromise]);
    
    message.success('通知发送成功');
    manualSendDialogVisible.value = false;
    
    // 重置表单
    manualSendDialog.form = {
      channels: [],
      recipient: '',
      subject: '',
      content: ''
    };

  } catch (error: any) {
    let errorMessage = '发送失败';
    if (error.message) {
      if (error.message.includes('timeout') || error.message.includes('超时')) {
        errorMessage = '发送超时，请检查网络连接或稍后重试';
      } else if (error.message.includes('network') || error.message.includes('网络')) {
        errorMessage = '网络连接异常，请检查网络后重试';
      } else if (error.message.includes('403')) {
        errorMessage = '没有权限执行此操作';
      } else if (error.message.includes('500')) {
        errorMessage = '服务器内部错误，请联系管理员';
      } else if (error.message.includes('validation') || error.message.includes('验证')) {
        errorMessage = '数据验证失败，请检查输入内容';
      } else {
        errorMessage = `发送失败: ${error.message}`;
      }
    }
    
    message.error(errorMessage);
    console.error('Failed to send manual notification:', error);
  } finally {
    manualSendDialog.saving = false;
  }
};

// 生命周期
onMounted(() => {
  loadNotifications();
  loadProcesses(true);
  loadTemplates(true);
  loadCategories(true);
  loadUsers(true);
});
</script>

<style scoped>
.notification-management-container {
  padding: 12px;
  min-height: 100vh;
  background: #f5f5f5;
}

.page-header {
  margin-bottom: 20px;
}

.stats-grid {
  margin-bottom: 20px;
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 16px;
}

.stats-card {
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
  height: 100%;
}

.header-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  align-items: center;
}

.btn-create {
  background: linear-gradient(135deg, #1890ff 0%);
  border: none;
  flex-shrink: 0;
  box-shadow: 0 2px 4px rgba(24, 144, 255, 0.3);
}

.btn-create:hover {
  background: linear-gradient(135deg, #40a9ff 0%);
  box-shadow: 0 4px 8px rgba(24, 144, 255, 0.4);
}

.search-filters {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  flex: 1;
  min-width: 0;
}

.search-input {
  width: 250px;
  min-width: 200px;
}

.channel-filter,
.status-filter {
  width: 120px;
  min-width: 100px;
}

.reset-btn {
  flex-shrink: 0;
}



.table-container {
  margin-bottom: 24px;
}

.table-container :deep(.ant-card) {
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
}

.form-name-cell {
  display: flex;
  align-items: center;
}

.form-name-text {
  font-weight: 500;
  word-break: break-all;
}

.channels-cell {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.channel-tag {
  margin: 2px 0;
  border-radius: 4px;
  display: flex;
  align-items: center;
}

.recipients-cell {
  word-break: break-all;
}

.form-url-cell {
  display: flex;
  align-items: center;
  gap: 8px;
}

.url-input {
  font-family: 'Courier New', monospace;
  font-size: 12px;
}

.sent-count-cell {
  text-align: center;
}

.date-info {
  display: flex;
  flex-direction: column;
}

.date {
  font-weight: 500;
  font-size: 14px;
  color: #262626;
}

.time {
  font-size: 12px;
  color: #8c8c8c;
}

.text-gray {
  color: #999;
  font-style: italic;
}

.action-buttons {
  display: flex;
  gap: 4px;
  justify-content: center;
  flex-wrap: wrap;
}

/* 对话框样式 */
.form-option {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.form-name {
  font-weight: 500;
  color: #262626;
}

.form-category {
  font-size: 12px;
  color: #999;
  background: #f0f0f0;
  padding: 2px 6px;
  border-radius: 3px;
}

.channel-option {
  display: flex;
  align-items: center;
  gap: 6px;
}

.user-option {
  display: flex;
  align-items: center;
}

.recipients-help,
.template-help {
  margin-top: 8px;
}

.notification-config-modal :deep(.ant-modal-body) {
  max-height: 70vh;
  overflow-y: auto;
}

/* 详情对话框样式 */
.notification-details {
  margin-bottom: 20px;
}

.detail-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
  flex-wrap: wrap;
  gap: 12px;
  padding: 16px;
  background: linear-gradient(135deg, #f6f9fc 0%, #ffffff 100%);
  border-radius: 8px;
  border: 1px solid #e8f4f8;
}

.detail-header h2 {
  margin: 0;
  font-size: 20px;
  color: #1f2937;
  word-break: break-all;
  font-weight: 600;
}

.form-url-display {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
}

.form-url-display .ant-input {
  font-family: 'Courier New', monospace;
  font-size: 12px;
}

.channels-display,
.recipients-display {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.message-template-preview {
  margin-top: 24px;
  border-top: 1px solid #f0f0f0;
  padding-top: 20px;
}

.message-template-preview h3 {
  margin-bottom: 12px;
  color: #1f2937;
  font-weight: 600;
}

.template-content {
  background: linear-gradient(135deg, #f8f9fa 0%, #ffffff 100%);
  border: 1px solid #e8e8e8;
  border-radius: 8px;
  padding: 16px;
  white-space: pre-line;
  font-family: system-ui, -apple-system, sans-serif;
  line-height: 1.6;
  color: #333;
  box-shadow: inset 0 1px 3px rgba(0, 0, 0, 0.05);
}

.detail-footer {
  margin-top: 24px;
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  flex-wrap: wrap;
  border-top: 1px solid #f0f0f0;
  padding-top: 16px;
}

/* 发送记录对话框样式 */
.send-logs {
  max-height: 500px;
  overflow-y: auto;
}

.logs-dialog :deep(.ant-table-tbody > tr:hover > td) {
  background: #f5f5f5;
}

/* 移动端适配 */
@media (max-width: 768px) {
  .notification-management-container {
    padding: 8px;
  }
  
  .header-actions {
    flex-direction: column;
    align-items: stretch;
  }
  
  .search-filters {
    width: 100%;
  }
  
  .search-input,
  .channel-filter,
  .status-filter {
    width: 100%;
    min-width: auto;
  }
  
  .btn-text {
    display: none;
  }
  
  .btn-create {
    padding: 8px 12px;
    min-width: auto;
    justify-content: center;
  }
  
  .stats-grid {
    grid-template-columns: 1fr;
    gap: 12px;
  }
  
  .stats-card :deep(.ant-statistic-title) {
    font-size: 12px;
  }
  
  .stats-card :deep(.ant-statistic-content) {
    font-size: 16px;
  }
  
  .action-buttons {
    gap: 2px;
    flex-direction: column;
  }
  
  .action-buttons .ant-btn {
    padding: 4px 8px;
    font-size: 12px;
    min-width: 60px;
  }
  
  .form-url-cell {
    flex-direction: column;
    align-items: stretch;
    gap: 4px;
  }
  
  .channels-cell {
    flex-direction: column;
    align-items: flex-start;
  }
  
  .detail-header {
    flex-direction: column;
    align-items: stretch;
    text-align: center;
  }
  
  .form-url-display {
    flex-direction: column;
    gap: 8px;
  }
  
  .detail-footer {
    justify-content: center;
  }
  
  .detail-footer .ant-btn {
    flex: 1;
    max-width: 120px;
  }
}

/* 平板端适配 */
@media (max-width: 1024px) and (min-width: 769px) {
  .notification-management-container {
    padding: 16px;
  }
  
  .search-input {
    width: 200px;
  }
  
  .stats-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

/* 大屏幕优化 */
@media (min-width: 1200px) {
  .stats-grid {
    grid-template-columns: repeat(4, 1fr);
  }
}

@media (max-width: 480px) {
  .stats-card {
    text-align: center;
  }
  
  .channels-display,
  .recipients-display {
    flex-direction: column;
    align-items: flex-start;
  }
  
  .template-content {
    font-size: 12px;
    padding: 12px;
  }
  
  .action-buttons .ant-btn {
    width: 100%;
  }
}

/* 响应式表格优化 */
.table-container :deep(.ant-table-wrapper) {
  overflow: auto;
  border-radius: 8px;
}

.table-container :deep(.ant-table-thead > tr > th) {
  white-space: nowrap;
  background: #fafafa;
  font-weight: 600;
}

.table-container :deep(.ant-table-tbody > tr > td) {
  word-break: break-word;
}

.table-container :deep(.ant-table-tbody > tr:hover > td) {
  background: #f8f9fa;
}

/* 对话框响应式优化 */
.responsive-modal :deep(.ant-modal) {
  max-width: calc(100vw - 16px);
  margin: 8px;
}

.responsive-modal :deep(.ant-modal-content) {
  border-radius: 8px;
  overflow: hidden;
}

@media (max-width: 768px) {
  .responsive-modal :deep(.ant-modal-body) {
    padding: 12px;
    max-height: calc(100vh - 120px);
    overflow-y: auto;
  }
  
  .responsive-modal :deep(.ant-modal-header) {
    padding: 12px 16px;
  }
  
  .responsive-modal :deep(.ant-modal-footer) {
    padding: 8px 16px;
  }
}

/* 加载状态优化 */
.table-container :deep(.ant-spin-nested-loading) {
  min-height: 200px;
}

/* 表单项样式优化 */
.notification-config-modal :deep(.ant-form-item-label) {
  font-weight: 600;
}

.notification-config-modal :deep(.ant-checkbox-wrapper) {
  margin-bottom: 8px;
}

/* 模板变量帮助信息样式 */
.template-variables-help {
  max-height: 300px;
  overflow-y: auto;
  font-size: 12px;
  line-height: 1.5;
}

.variable-group {
  margin-bottom: 12px;
}

.variable-group strong {
  display: block;
  margin-bottom: 6px;
  color: #1f2937;
  font-size: 13px;
}

.variable-list {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 4px 8px;
  margin-left: 12px;
}

.variable-item {
  display: block;
  padding: 2px 8px;
  background: #f8f9fa;
  border-radius: 4px;
  font-family: 'Monaco', 'Consolas', 'Courier New', monospace;
  font-size: 11px;
  color: #495057;
  border-left: 3px solid #e9ecef;
  transition: all 0.2s ease;
}

.variable-item:hover {
  background: #e9ecef;
  border-left-color: #1890ff;
  color: #1890ff;
}

.variable-deprecated {
  margin-top: 8px;
  padding-top: 8px;
  border-top: 1px solid #f0f0f0;
}

.variable-list.deprecated .variable-item {
  background: #fff2f0;
  border-left-color: #ff4d4f;
  color: #ff4d4f;
  text-decoration: line-through;
}

.variable-list.deprecated .variable-item:hover {
  background: #ffebe6;
}

/* 响应式优化 */
@media (max-width: 768px) {
  .variable-list {
    grid-template-columns: 1fr;
    gap: 2px 4px;
  }
  
  .template-variables-help {
    max-height: 200px;
    font-size: 11px;
  }
  
  .variable-item {
    font-size: 10px;
    padding: 1px 6px;
  }
}

/* 统计卡片动画 */
@keyframes fadeInUp {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}



/* 表格加载优化 */
.table-container :deep(.ant-table-placeholder) {
  padding: 40px 20px;
}

.table-container :deep(.ant-empty-description) {
  color: #999;
}
</style>
