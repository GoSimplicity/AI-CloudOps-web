<template>
  <OpsPage
    title="通知配置"
    description="管理工单触发渠道、接收范围与发送记录"
    class="notification-management-container"
  >
    <template #actions>
      <a-button
        aria-label="刷新通知配置"
        :loading="loading"
        @click="loadNotifications"
      >
        刷新
      </a-button>
      <a-button aria-label="投递事件" @click="showEvents = !showEvents">
        {{ showEvents ? '关闭投递事件' : '投递事件' }}
      </a-button>
      <a-button
        type="primary"
        aria-label="创建通知配置"
        @click="handleCreateNotification"
        class="btn-create"
      >
        <template #icon>
          <PlusOutlined />
        </template>
        <span class="btn-text">创建通知配置</span>
      </a-button>
    </template>
    <template #filters>
      <div class="search-filters">
        <a-input-search
          v-model:value="searchQuery"
          placeholder="搜索通知配置..."
          aria-label="搜索通知配置"
          class="search-input"
          @search="handleSearch"
          @change="handleSearchChange"
          allow-clear
        />
        <a-select
          v-model:value="channelFilter"
          placeholder="选择通知渠道"
          aria-label="通知渠道筛选"
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
          aria-label="配置状态筛选"
          class="status-filter"
          @change="handleStatusChange"
          allow-clear
        >
          <a-select-option :value="undefined">全部状态</a-select-option>
          <a-select-option :value="NotificationStatus.Enabled">
            启用
          </a-select-option>
          <a-select-option :value="NotificationStatus.Disabled">
            禁用
          </a-select-option>
        </a-select>
        <a-button
          @click="handleResetFilters"
          class="reset-btn"
          aria-label="重置通知筛选"
        >
          重置
        </a-button>
      </div>
    </template>
    <template #summary>
      <!-- 统计卡片 -->
      <div class="stats-grid">
        <a-card class="stats-card">
          <a-statistic
            title="总配置数"
            :value="loadError ? '未知' : stats.total"
          >
            <template #prefix>
              <BellOutlined />
            </template>
          </a-statistic>
        </a-card>

        <a-card class="stats-card">
          <a-statistic
            title="本页启用"
            :value="loadError ? '未知' : stats.enabled"
          >
            <template #prefix>
              <CheckCircleOutlined />
            </template>
          </a-statistic>
        </a-card>

        <a-card class="stats-card">
          <a-statistic
            title="本页禁用"
            :value="loadError ? '未知' : stats.disabled"
          >
            <template #prefix>
              <StopOutlined />
            </template>
          </a-statistic>
        </a-card>
      </div>
    </template>
    <a-alert
      v-if="loadError"
      type="error"
      show-icon
      :message="loadError"
      role="alert"
    >
      <template #action>
        <a-button size="small" @click="loadNotifications"> 重试 </a-button>
      </template>
    </a-alert>
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
                <BellOutlined
                  style="color: var(--ops-muted); margin-right: 8px"
                />
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
                  <component
                    :is="getChannelIcon(channel)"
                    style="margin-right: 4px"
                  />
                  {{ getNotificationChannelName(channel) }}
                </a-tag>
              </div>
            </template>

            <template v-if="column.key === 'eventTypes'">
              <div class="event-types-cell">
                <a-tooltip>
                  <template #title>
                    <div
                      v-for="eventType in record.event_types"
                      :key="eventType"
                    >
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
                    <div
                      v-for="recipientType in record.recipient_types"
                      :key="recipientType"
                    >
                      {{ getRecipientTypeName(recipientType) }}
                    </div>
                  </template>
                  <span>{{
                    getRecipientTypesDisplay(record.recipient_types)
                  }}</span>
                </a-tooltip>
              </div>
            </template>

            <template v-if="column.key === 'status'">
              <a-switch
                :checked="record.status === NotificationStatus.Enabled"
                @change="
                  (checked: boolean) => handleStatusToggle(record, checked)
                "
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
                <a-tag v-if="isLegacyAdvancedTrigger(record)" color="warning">
                  待重新验证
                </a-tag>
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
                <a-button
                  type="primary"
                  size="small"
                  @click="handleViewNotification(record)"
                >
                  查看
                </a-button>
                <a-button
                  type="default"
                  size="small"
                  @click="handleEditNotification(record)"
                >
                  编辑
                </a-button>
                <a-dropdown :trigger="['click']">
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
                      <a-menu-divider
                        v-if="can('workorder.notification.delete')"
                      />
                      <a-menu-item
                        v-if="can('workorder.notification.delete')"
                        key="delete"
                        danger
                      >
                        删除
                      </a-menu-item>
                    </a-menu>
                  </template>
                  <a-button size="small" aria-label="通知更多操作">
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
      :closable="!notificationDialog.saving"
      :mask-closable="!notificationDialog.saving"
      :cancel-button-props="{ disabled: notificationDialog.saving }"
      class="responsive-modal notification-config-modal"
    >
      <a-alert
        v-if="Object.values(optionErrors).some(Boolean)"
        type="warning"
        message="部分关联选项加载失败，重新打开相应选择器可重试"
        :description="Object.values(optionErrors).filter(Boolean).join('；')"
        show-icon
      />
      <a-form
        :disabled="notificationDialog.saving"
        ref="formRef"
        :model="notificationDialog.form"
        :rules="notificationRules"
        layout="vertical"
      >
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
                <span v-if="process.category?.name" class="form-category">{{
                  process.category.name
                }}</span>
              </div>
            </a-select-option>
            <a-select-option
              v-if="processLoading"
              :value="`loading-${Date.now()}`"
              disabled
            >
              <div style="text-align: center; padding: 8px">
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
                <span v-if="template.category?.name" class="form-category">{{
                  template.category.name
                }}</span>
              </div>
            </a-select-option>
            <a-select-option
              v-if="templateLoading"
              :value="`loading-${Date.now()}`"
              disabled
            >
              <div style="text-align: center; padding: 8px">
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
                <span v-if="category.description" class="form-category">{{
                  category.description
                }}</span>
              </div>
            </a-select-option>
            <a-select-option
              v-if="categoryLoading"
              :value="`loading-${Date.now()}`"
              disabled
            >
              <div style="text-align: center; padding: 8px">
                <a-spin size="small" /> 加载中...
              </div>
            </a-select-option>
          </a-select>
        </a-form-item>

        <a-form-item label="触发事件" name="eventTypes">
          <a-checkbox-group
            v-model:value="notificationDialog.form.eventTypes"
            style="width: 100%"
          >
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
          <div class="form-help" style="margin-top: 8px">
            <a-alert
              message="选择触发通知的工单事件类型"
              description="建议选择关键事件以避免通知过多"
              type="info"
              show-icon
              banner
            />
          </div>
        </a-form-item>

        <a-alert
          type="info"
          show-icon
          message="通知计划在事件发生后生成；更改配置不会修改已生成的计划。"
        />
        <a-alert
          v-if="
            notificationDialog.isEdit &&
            originalTriggerVersion !== 1 &&
            (notificationDialog.form.triggerType !==
              NotificationTrigger.IMMEDIATE ||
              notificationDialog.form.repeatInterval != null)
          "
          type="warning"
          show-icon
          message="历史高级规则尚未验证，不会自动执行。请重新设置触发参数，或停用后重新启用。"
        />
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
            placeholder="例如 {&quot;status&quot;:2,&quot;priority&quot;:1}"
            :rows="4"
          />
        </a-form-item>

        <a-alert
          v-if="
            notificationDialog.form.channels.some(
              (channel) => !['email', 'feishu', 'in_app'].includes(channel),
            )
          "
          type="warning"
          message="此配置含当前服务未支持的渠道，保存前请确认移除"
          show-icon
        >
          <template #action>
            <a-button
              @click="
                notificationDialog.form.channels =
                  notificationDialog.form.channels.filter((channel) =>
                    ['email', 'feishu', 'in_app'].includes(channel),
                  )
              "
            >
              移除不支持渠道
            </a-button>
          </template>
        </a-alert>
        <a-form-item label="通知渠道" name="channels">
          <a-checkbox-group
            v-model:value="notificationDialog.form.channels"
            style="width: 100%"
          >
            <a-row :gutter="[16, 16]">
              <a-col
                :span="12"
                v-for="channel in getAllNotificationChannels().filter(
                  (channel) => ['email', 'feishu', 'in_app'].includes(channel),
                )"
                :key="channel"
              >
                <a-checkbox :value="channel">
                  <span class="channel-option">
                    <component
                      :is="getChannelIcon(channel)"
                      :style="{ color: getChannelIconColor(channel) }"
                    />
                    {{ getNotificationChannelName(channel) }}
                  </span>
                </a-checkbox>
              </a-col>
            </a-row>
          </a-checkbox-group>
          <div
            class="form-help"
            style="margin-top: 8px"
            v-if="
              notificationDialog.form.channels.includes('feishu') ||
              notificationDialog.form.channels.includes('email')
            "
          >
            <a-alert message="通知渠道配置建议" type="info" show-icon banner>
              <template #description>
                <div>
                  <div
                    v-if="notificationDialog.form.channels.includes('feishu')"
                    style="margin-bottom: 4px"
                  >
                    <strong>飞书通知：</strong
                    >需要确保接收人配置了有效的用户ID，系统会根据用户ID查找对应的飞书账号进行消息推送
                  </div>
                  <div
                    v-if="notificationDialog.form.channels.includes('email')"
                  >
                    <strong>邮件通知：</strong
                    >需要确保接收人配置了有效的邮箱地址，支持通过用户ID或角色ID自动获取邮箱
                  </div>
                </div>
              </template>
            </a-alert>
          </div>
        </a-form-item>

        <a-form-item label="接收人类型" name="recipientTypes">
          <a-checkbox-group
            v-model:value="notificationDialog.form.recipientTypes"
            style="width: 100%"
          >
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
          <a-alert
            v-if="notificationDialog.form.channels.includes('in_app')"
            type="info"
            show-icon
            message="站内消息发送给系统用户；请至少选择创建人、处理人、用户、角色或部门。自定义外部地址不能接收站内消息。"
          />
        </a-form-item>

        <a-form-item
          label="自定义接收人用户ID"
          name="recipientUsers"
          v-if="notificationDialog.form.recipientTypes.includes('user')"
        >
          <a-select
            v-model:value="notificationDialog.form.recipientUsers"
            mode="tags"
            placeholder="请输入用户ID"
            style="width: 100%"
            :token-separators="[',', ';', ' ']"
          />
        </a-form-item>

        <a-form-item
          label="接收人角色ID"
          name="recipientRoles"
          v-if="notificationDialog.form.recipientTypes.includes('role')"
        >
          <a-select
            v-model:value="notificationDialog.form.recipientRoles"
            mode="tags"
            placeholder="请输入角色ID"
            style="width: 100%"
            :token-separators="[',', ';', ' ']"
          />
        </a-form-item>

        <a-form-item
          label="接收人部门ID"
          name="recipientDepts"
          v-if="notificationDialog.form.recipientTypes.includes('dept')"
        >
          <a-select
            v-model:value="notificationDialog.form.recipientDepts"
            mode="tags"
            placeholder="请输入部门ID"
            style="width: 100%"
            :token-separators="[',', ';', ' ']"
          />
        </a-form-item>

        <a-form-item
          v-if="notificationDialog.form.recipientTypes.includes('custom')"
          label="自定义接收地址"
          required
        >
          <a-alert
            v-if="recipientError"
            class="recipient-error"
            :message="recipientError"
            type="error"
            show-icon
          />
          <p class="text-gray">
            每个地址明确选择渠道。邮箱填写邮箱地址，飞书填写 ou_/on_/oc_ ID
          </p>
          <fieldset
            v-for="(address, index) in notificationDialog.form
              .recipientAddresses"
            :key="index"
            class="recipient-address-row"
          >
            <legend>接收地址 {{ index + 1 }}</legend>
            <a-select
              v-model:value="address.channel"
              :aria-label="'自定义接收渠道' + (index + 1)"
            >
              <a-select-option
                v-for="channel in notificationDialog.form.channels.filter(
                  (channel) => ['email', 'feishu'].includes(channel),
                )"
                :key="channel"
                :value="channel"
              >
                {{ getNotificationChannelName(channel) }}
              </a-select-option>
            </a-select>
            <a-input
              v-model:value="address.address"
              :aria-label="'自定义接收地址' + (index + 1)"
              placeholder="邮箱地址或飞书ID"
            />
            <a-input
              v-model:value="address.name"
              :aria-label="'自定义接收人名称' + (index + 1)"
              placeholder="接收人名称（可选）"
              :maxlength="100"
            />
            <a-button
              danger
              :aria-label="'移除接收地址' + (index + 1)"
              @click="
                notificationDialog.form.recipientAddresses.splice(index, 1)
              "
            >
              移除
            </a-button>
          </fieldset>
          <a-button
            @click="addRecipientAddress"
            :disabled="
              notificationDialog.saving ||
              notificationDialog.form.recipientAddresses.length >= 100 ||
              !notificationDialog.form.channels.some((channel) =>
                ['email', 'feishu'].includes(channel),
              )
            "
          >
            添加接收地址
          </a-button>
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
              style="margin-top: 8px"
            >
              <template #description>
                <div class="template-variables-help">
                  <div class="variable-group">
                    <strong>🎯 核心业务变量</strong>
                    <div class="variable-list">
                      <span class="variable-item">{subject} - 通知主题</span>
                      <span class="variable-item">{content} - 通知内容</span>
                      <span class="variable-item"
                        >{recipient_name} - 接收人姓名</span
                      >
                      <span class="variable-item"
                        >{recipient_addr} - 接收人地址（邮箱/手机号）</span
                      >
                    </div>
                  </div>

                  <div class="variable-group">
                    <strong>🏢 工单相关变量</strong>
                    <div class="variable-list">
                      <span class="variable-item"
                        >{workorder_id} - 工单ID (数字格式)</span
                      >
                      <span class="variable-item"
                        >{serial_number} - 工单编号 (WO-123456 格式)</span
                      >
                      <span class="variable-item">{title} - 工单标题</span>
                      <span class="variable-item"
                        >{description} - 工单描述</span
                      >
                      <span class="variable-item">{status} - 工单状态</span>
                    </div>
                  </div>

                  <div class="variable-group">
                    <strong>⚡ 优先级变量</strong>
                    <div class="variable-list">
                      <span class="variable-item"
                        >{priority_level} - 优先级等级 (1, 2, 3)</span
                      >
                      <span class="variable-item"
                        >{priority_text} - 优先级文本 (高, 中, 低)</span
                      >
                      <span class="variable-item"
                        >{priority_icon} - 优先级图标</span
                      >
                    </div>
                  </div>

                  <div class="variable-group">
                    <strong>📅 时间相关变量</strong>
                    <div class="variable-list">
                      <span class="variable-item"
                        >{notification_time} - 通知时间</span
                      >
                      <span class="variable-item"
                        >{notification_date} - 通知日期</span
                      >
                      <span class="variable-item"
                        >{notification_year} - 年份</span
                      >
                      <span class="variable-item"
                        >{notification_month} - 月份</span
                      >
                      <span class="variable-item"
                        >{notification_day} - 日期</span
                      >
                    </div>
                  </div>

                  <div class="variable-group">
                    <strong>🎭 事件类型变量</strong>
                    <div class="variable-list">
                      <span class="variable-item"
                        >{event_type} - 事件类型文本</span
                      >
                      <span class="variable-item"
                        >{event_type_text} - 事件类型文本</span
                      >
                      <span class="variable-item"
                        >{event_type_icon} - 事件类型图标</span
                      >
                    </div>
                  </div>

                  <div class="variable-group">
                    <strong>🏢 企业信息变量</strong>
                    <div class="variable-list">
                      <span class="variable-item"
                        >{company_name} - 公司名称 (AI-CloudOps)</span
                      >
                      <span class="variable-item"
                        >{platform_name} - 平台名称</span
                      >
                      <span class="variable-item">{department} - 部门名称</span>
                      <span class="variable-item"
                        >{service_hotline} - 服务热线</span
                      >
                    </div>
                  </div>

                  <div class="variable-group">
                    <strong>👥 人员相关变量</strong>
                    <div class="variable-list">
                      <span class="variable-item"
                        >{operator_name} - 操作人员姓名</span
                      >
                      <span class="variable-item"
                        >{assignee_name} - 指派人员姓名</span
                      >
                      <span class="variable-item"
                        >{created_time} - 创建时间</span
                      >
                      <span class="variable-item"
                        >{updated_time} - 更新时间</span
                      >
                    </div>
                  </div>

                  <div class="variable-group">
                    <strong>🔧 自定义变量</strong>
                    <div class="variable-list">
                      <span class="variable-item"
                        >{custom_content} - 自定义内容</span
                      >
                    </div>
                  </div>

                  <div class="variable-deprecated">
                    <strong>❌ 不再支持的变量</strong>
                    <div class="variable-list deprecated">
                      <span class="variable-item"
                        >{instanceTitle} → 请使用 {title}</span
                      >
                      <span class="variable-item"
                        >{currentTime} → 请使用 {notification_time}</span
                      >
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

        <a-form-item
          v-if="
            notificationDialog.form.triggerType === NotificationTrigger.DELAYED
          "
          label="延迟时间（分钟）"
        >
          <a-input-number
            id="notification-delay-minutes"
            v-model:value="notificationDialog.form.delayMinutes"
            :min="1"
            :max="10080"
            style="width: 100%"
          />
        </a-form-item>
        <a-form-item label="重复间隔（分钟）">
          <a-input-number
            id="notification-repeat-interval"
            v-model:value="notificationDialog.form.repeatInterval"
            :min="1"
            :max="10080"
            placeholder="不重复时留空"
            style="width: 100%"
          />
        </a-form-item>
        <a-form-item label="总发送次数（含首次）">
          <a-input-number
            id="notification-repeat-count"
            v-model:value="notificationDialog.form.repeatCount"
            :min="2"
            :max="100"
            placeholder="不重复时留空"
            style="width: 100%"
          />
        </a-form-item>

        <a-form-item label="最大重试次数" name="maxRetries">
          <a-input-number
            v-model:value="notificationDialog.form.maxRetries"
            placeholder="最大重试次数"
            :min="0"
            :max="100"
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
          <a-select
            v-model:value="notificationDialog.form.priority"
            placeholder="请选择优先级"
          >
            <a-select-option :value="NotificationPriority.High">
              高
            </a-select-option>
            <a-select-option :value="NotificationPriority.Medium">
              中
            </a-select-option>
            <a-select-option :value="NotificationPriority.Low">
              低
            </a-select-option>
          </a-select>
        </a-form-item>

        <a-form-item label="状态" name="status">
          <a-switch
            aria-label="通知启用状态"
            :checked="
              notificationDialog.form.status === NotificationStatus.Enabled
            "
            @change="
              (checked: boolean) =>
                (notificationDialog.form.status = checked
                  ? NotificationStatus.Enabled
                  : NotificationStatus.Disabled)
            "
            checked-children="启用"
            un-checked-children="禁用"
          />
        </a-form-item>

        <a-form-item
          label="是否默认配置"
          name="isDefault"
          v-if="notificationDialog.isEdit"
        >
          <a-switch
            :checked="notificationDialog.form.isDefault === IsDefault.Yes"
            @change="
              (checked: boolean) =>
                (notificationDialog.form.isDefault = checked
                  ? IsDefault.Yes
                  : IsDefault.No)
            "
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
            :checked="
              detailDialog.notification.status === NotificationStatus.Enabled
            "
            @change="
              (checked: boolean) =>
                handleStatusToggle(detailDialog.notification!, checked)
            "
          />
        </div>

        <a-descriptions bordered :column="1" :labelStyle="{ width: '120px' }">
          <a-descriptions-item label="配置ID">
            {{ detailDialog.notification.id }}
          </a-descriptions-item>
          <a-descriptions-item label="配置名称">
            {{ detailDialog.notification.name }}
          </a-descriptions-item>
          <a-descriptions-item label="配置描述">
            {{ detailDialog.notification.description || '无' }}
          </a-descriptions-item>
          <a-descriptions-item label="关联模板ID">
            {{ detailDialog.notification.template_id || '无' }}
          </a-descriptions-item>
          <a-descriptions-item label="关联流程ID">
            {{ detailDialog.notification.process_id || '无' }}
          </a-descriptions-item>
          <a-descriptions-item label="关联分类ID">
            {{ detailDialog.notification.category_id || '无' }}
          </a-descriptions-item>
          <a-descriptions-item label="触发事件">
            <div class="event-types-display">
              <a-tag
                v-for="eventType in detailDialog.notification.event_types"
                :key="eventType"
              >
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
                <component
                  :is="getChannelIcon(channel)"
                  style="margin-right: 4px"
                />
                {{ getNotificationChannelName(channel) }}
              </a-tag>
            </div>
          </a-descriptions-item>
          <a-descriptions-item label="接收人类型">
            <div class="recipient-types-display">
              <a-tag
                v-for="recipientType in detailDialog.notification
                  .recipient_types"
                :key="recipientType"
              >
                {{ getRecipientTypeName(recipientType) }}
              </a-tag>
            </div>
          </a-descriptions-item>
          <a-descriptions-item label="自定义接收人">
            <div class="recipients-display">
              <a-tag
                v-for="recipient in detailDialog.notification.recipient_users ||
                []"
                :key="recipient"
              >
                {{ recipient }}
              </a-tag>
              <span v-if="!detailDialog.notification.recipient_users?.length"
                >无</span
              >
            </div>
          </a-descriptions-item>
          <a-descriptions-item label="优先级">
            <a-tag
              :color="getPriorityColor(detailDialog.notification.priority)"
            >
              {{ getPriorityName(detailDialog.notification.priority) }}
            </a-tag>
          </a-descriptions-item>
          <a-descriptions-item label="最大重试次数">
            {{ detailDialog.notification.max_retries }}
          </a-descriptions-item>
          <a-descriptions-item label="重试间隔">
            {{ detailDialog.notification.retry_interval }}分钟
          </a-descriptions-item>
          <a-descriptions-item label="是否默认配置">
            {{
              detailDialog.notification.is_default === IsDefault.Yes
                ? '是'
                : '否'
            }}
          </a-descriptions-item>
          <a-descriptions-item label="创建时间">
            {{ formatFullDateTime(detailDialog.notification.created_at) }}
          </a-descriptions-item>
          <a-descriptions-item label="更新时间">
            {{ formatFullDateTime(detailDialog.notification.updated_at) }}
          </a-descriptions-item>
        </a-descriptions>

        <div class="message-template-preview">
          <h3>消息模板（工单发送时替换变量）</h3>
          <div class="template-content">
            {{ getPreviewMessage(detailDialog.notification) }}
          </div>
        </div>

        <div class="detail-footer">
          <a-button @click="closeDetailDialog">关闭</a-button>
          <a-button
            type="default"
            @click="handleTestSend(detailDialog.notification)"
          >
            测试发送
          </a-button>
          <a-button
            type="primary"
            @click="handleEditNotification(detailDialog.notification)"
          >
            编辑
          </a-button>
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
        <a-alert v-if="logsError" :message="logsError" type="error" show-icon>
          <template #action>
            <a-button
              v-if="activeLogsNotificationId"
              @click="loadSendLogs(activeLogsNotificationId)"
            >
              重试
            </a-button>
          </template>
        </a-alert>
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
                <component
                  :is="getChannelIcon(record.channel)"
                  style="margin-right: 4px"
                />
                {{ getNotificationChannelName(record.channel) }}
              </a-tag>
            </template>
            <template v-if="column.key === 'status'">
              <a-tag :color="getSendStatus(record.status).color">
                {{ getSendStatus(record.status).label }}
              </a-tag>
            </template>
            <template v-if="column.key === 'sendAt'">
              {{ formatFullDateTime(record.send_at) }}
            </template>
          </template>
        </a-table>
      </div>
    </a-modal>

    <a-modal
      :open="testSendDialog.visible"
      title="测试发送"
      ok-text="发送"
      cancel-text="取消"
      :confirm-loading="testSendDialog.sending"
      :closable="!testSendDialog.sending"
      :mask-closable="false"
      :ok-button-props="{
        disabled: !testSendDialog.channel || !testSendDialog.recipient.trim(),
      }"
      @ok="confirmTestSend"
      @cancel="closeTestSend"
    >
      <a-alert message="测试将实际发送到下面指定的地址" type="info" show-icon />
      <a-alert
        v-if="testSendDialog.error"
        :message="testSendDialog.error"
        type="error"
        show-icon
      />
      <a-form layout="vertical" style="margin-top: 16px">
        <a-form-item label="发送渠道" required>
          <a-select
            v-model:value="testSendDialog.channel"
            aria-label="测试发送渠道"
          >
            <a-select-option
              v-for="channel in testSendDialog.channels"
              :key="channel"
              :value="channel"
            >
              {{ getNotificationChannelName(channel) }}
            </a-select-option>
          </a-select>
        </a-form-item>
        <a-form-item label="接收地址" required>
          <a-input
            v-model:value="testSendDialog.recipient"
            placeholder="请输入接收地址"
            :disabled="testSendDialog.sending"
          />
        </a-form-item>
      </a-form>
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
      <a-alert
        message="直接发送编辑后的内容，模板变量不会自动替换"
        type="info"
        show-icon
      />
      <a-form
        :model="manualSendDialog.form"
        :rules="manualSendRules"
        layout="vertical"
      >
        <a-form-item label="通知渠道" name="channels">
          <a-checkbox-group
            v-model:value="manualSendDialog.form.channels"
            style="width: 100%"
          >
            <a-row :gutter="[16, 16]">
              <a-col
                :span="12"
                v-for="channel in getAllNotificationChannels().filter(
                  (channel) => ['email', 'feishu'].includes(channel),
                )"
                :key="channel"
              >
                <a-checkbox :value="channel">
                  <span class="channel-option">
                    <component
                      :is="getChannelIcon(channel)"
                      :style="{ color: getChannelIconColor(channel) }"
                    />
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
            placeholder="请输入邮箱或飞书接收地址"
          />
          <div class="form-help" style="margin-top: 4px">
            <small class="text-gray">
              邮箱渠道填写邮箱；飞书渠道填写有效的 open_id 或 user_id
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
    <NotificationEvents v-if="showEvents" />
  </OpsPage>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted, onBeforeUnmount, computed } from 'vue';
import OpsPage from '#/components/ops/OpsPage.vue';
import NotificationEvents from './NotificationEvents.vue';
import { useWindowSize } from '@vueuse/core';
import { message, Modal } from 'ant-design-vue';
import { debounce } from 'lodash-es';
import dayjs from 'dayjs';
import {
  buildNotificationSchedule,
  notificationScheduleFingerprint,
  type NotificationSchedulePayload,
} from './notification-schedule';
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
  PhoneOutlined,
} from '@ant-design/icons-vue';
import {
  NotificationStatus,
  getNotificationSendStatus as getSendStatus,
  NotificationChannel,
  NotificationTrigger,
  NotificationPriority,
  IsDefault,
  type Notification,
  type NotificationLog,
  type NotificationRecipientAddress,
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
  sendNotificationManually,
  getEventTypeName,
  getNotificationChannelName,
  getRecipientTypeName,
  getAllEventTypes,
  getAllNotificationChannels,
  getAllRecipientTypes,
} from '#/api/core/workorder/workorder_notification';
import {
  listWorkorderProcess,
  type WorkorderProcessItem,
} from '#/api/core/workorder/workorder_process';
import {
  listWorkorderTemplate,
  type WorkorderTemplateItem,
} from '#/api/core/workorder/workorder_template';
import {
  listWorkorderCategory,
  type WorkorderCategoryItem,
} from '#/api/core/workorder/workorder_category';
import { getUserList, type User } from '#/api/core/system/user';

import { usePermission } from '#/utils/permission';
import {
  shouldNotifyPageError,
  shouldRecordPageError,
} from '#/utils/permission/request-notice';

const { can } = usePermission();

// 表单ref
const formRef = ref<FormInstance>();

const { width: viewportWidth } = useWindowSize();

// 响应式对话框宽度
const notificationDialogWidth = computed(() => {
  if (typeof window !== 'undefined') {
    const width = viewportWidth.value;
    if (width < 768) return '95%';
    if (width < 1024) return '90%';
    return '800px';
  }
  return '800px';
});

const detailDialogWidth = computed(() => {
  if (typeof window !== 'undefined') {
    const width = viewportWidth.value;
    if (width < 768) return '95%';
    if (width < 1024) return '90%';
    return '900px';
  }
  return '900px';
});

const logsDialogWidth = computed(() => {
  if (typeof window !== 'undefined') {
    const width = viewportWidth.value;
    if (width < 768) return '95%';
    if (width < 1024) return '85%';
    return '1000px';
  }
  return '1000px';
});

// 列定义
const columns = [
  {
    title: '配置名称',
    dataIndex: 'name',
    key: 'name',
    width: 200,
    fixed: 'left',
  },
  {
    title: '触发事件',
    dataIndex: 'event_types',
    key: 'eventTypes',
    width: 150,
  },
  {
    title: '接收人类型',
    dataIndex: 'recipient_types',
    key: 'recipientTypes',
    width: 150,
  },
  { title: '通知渠道', dataIndex: 'channels', key: 'channels', width: 180 },
  {
    title: '触发类型',
    dataIndex: 'trigger_type',
    key: 'triggerType',
    width: 120,
  },
  {
    title: '优先级',
    dataIndex: 'priority',
    key: 'priority',
    width: 80,
    align: 'center' as const,
  },
  {
    title: '状态',
    dataIndex: 'status',
    key: 'status',
    width: 80,
    align: 'center' as const,
  },
  { title: '创建时间', dataIndex: 'created_at', key: 'createdAt', width: 140 },
  {
    title: '操作',
    key: 'action',
    width: 200,
    align: 'center' as const,
    fixed: 'right',
  },
];

const logsColumns = [
  { title: '渠道', dataIndex: 'channel', key: 'channel', width: 100 },
  {
    title: '接收地址',
    dataIndex: 'recipient_addr',
    key: 'recipient',
    width: 180,
  },
  { title: '状态', dataIndex: 'status', key: 'status', width: 80 },
  { title: '发送时间', dataIndex: 'send_at', key: 'sendAt', width: 180 },
  {
    title: '错误信息',
    dataIndex: 'error_message',
    key: 'error',
    ellipsis: true,
  },
];

// 状态数据
const loading = ref(false);
const loadError = ref('');
const recipientError = ref('');
const originalTriggerFingerprint = ref('');
const originalNotificationStatus = ref<number>(NotificationStatus.Disabled);
const originalTriggerVersion = ref<number | undefined>();
const isLegacyAdvancedTrigger = (record: Notification): boolean =>
  record.trigger_version !== 1 &&
  (record.trigger_type !== NotificationTrigger.IMMEDIATE ||
    record.repeat_interval != null ||
    record.repeat_count != null);
let formEpoch = 0;
const logsError = ref('');
let listRequest = 0;
let logsRequest = 0;
let detailRequest = 0;
const activeLogsNotificationId = ref<number>();
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
const optionErrors = reactive({
  process: '',
  template: '',
  category: '',
  user: '',
});

// 分页参数
const processPagination = reactive({
  current: 1,
  pageSize: 20,
  total: 0,
  hasMore: true,
});

const templatePagination = reactive({
  current: 1,
  pageSize: 20,
  total: 0,
  hasMore: true,
});

const categoryPagination = reactive({
  current: 1,
  pageSize: 20,
  total: 0,
  hasMore: true,
});

const userPagination = reactive({
  current: 1,
  pageSize: 20,
  total: 0,
  hasMore: true,
});

// 统计数据
const stats = reactive({
  total: 0,
  enabled: 0,
  disabled: 0,
});

// 分页配置
const paginationConfig = reactive({
  current: 1,
  pageSize: 10,
  total: 0,
  showSizeChanger: true,
  showQuickJumper: true,
  showTotal: (total: number) => `共 ${total} 条记录`,
  size: 'default' as const,
});

const logsPagination = reactive({
  current: 1,
  pageSize: 10,
  total: 0,
  size: 'small' as const,
});

// 对话框状态
const notificationDialogVisible = ref(false);
const showEvents = ref(false);
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
    recipientAddresses: [] as NotificationRecipientAddress[],
    messageTemplate:
      '您好 {recipient_name}！\n\n工单通知：{title}\n工单编号：{serial_number}\n优先级：{priority_text}\n状态：{status}\n\n详情请查看系统。\n\n通知时间：{notification_time}\n平台：{platform_name}',
    subjectTemplate: '',
    scheduledTime: undefined as any,
    delayMinutes: undefined as number | undefined,
    repeatCount: undefined as number | undefined,
    repeatInterval: undefined as number | undefined,
    maxRetries: 3,
    retryInterval: 5,
    status: NotificationStatus.Disabled as number,
    priority: NotificationPriority.Medium as number,
    isDefault: IsDefault.No as number,
  },
});

// 详情对话框数据
const detailDialog = reactive({
  notification: null as Notification | null,
});

// 手动发送对话框数据
const manualSendDialog = reactive({
  saving: false,
  form: {
    channels: [] as string[],
    recipient: '',
    subject: '',
    content: '',
  },
});

const addRecipientAddress = () => {
  const channel = notificationDialog.form.channels.find((channel) =>
    ['email', 'feishu'].includes(channel),
  );
  if (channel)
    notificationDialog.form.recipientAddresses.push({
      channel,
      address: '',
      name: '',
    });
};
const validRecipientIds = (values: string[]) =>
  values.length > 0 &&
  values.every(
    (value) => /^\d+$/.test(value.trim()) && /[1-9]/.test(value.trim()),
  );
const addressError = (channel: string, raw: string) => {
  const value = raw.trim();
  if (!value || /[\u0000-\u001f\u007f-\u009f]/.test(value))
    return '接收地址不能为空或包含控制字符';
  if (channel === 'email' && (value.length > 254 || !value.includes('@')))
    return '请输入有效邮箱地址';
  if (
    channel === 'feishu' &&
    (value.length > 100 || !/^o[unc]_[a-zA-Z0-9]+$/.test(value))
  )
    return '飞书地址必须为ou_/on_/oc_格式ID';
  if (!['email', 'feishu'].includes(channel)) return '请选择邮件或飞书渠道';
  return '';
};

// 表单验证规则
const notificationRules = {
  name: [{ required: true, message: '请输入配置名称', trigger: 'blur' }],
  eventTypes: [
    {
      required: true,
      type: 'array',
      min: 1,
      message: '请选择至少一个触发事件',
      trigger: 'change',
    },
  ],
  triggerType: [
    { required: true, message: '请选择触发类型', trigger: 'change' },
  ],
  channels: [
    {
      required: true,
      type: 'array',
      min: 1,
      message: '请选择至少一个通知渠道',
      trigger: 'change',
    },
  ],
  recipientTypes: [
    {
      required: true,
      type: 'array',
      min: 1,
      message: '请选择至少一种接收人类型',
      trigger: 'change',
    },
  ],
  recipientUsers: [
    {
      validator: (_rule: unknown, values: string[] = []) =>
        !notificationDialog.form.recipientTypes.includes('user') ||
        validRecipientIds(values)
          ? Promise.resolve()
          : Promise.reject(new Error('请输入正整数用户ID')),
      trigger: 'change',
    },
  ],
  recipientRoles: [
    {
      validator: (_rule: unknown, values: string[] = []) =>
        !notificationDialog.form.recipientTypes.includes('role') ||
        validRecipientIds(values)
          ? Promise.resolve()
          : Promise.reject(new Error('请输入正整数角色ID')),
      trigger: 'change',
    },
  ],
  recipientDepts: [
    {
      validator: (_rule: unknown, values: string[] = []) =>
        !notificationDialog.form.recipientTypes.includes('dept') ||
        validRecipientIds(values)
          ? Promise.resolve()
          : Promise.reject(new Error('请输入正整数部门ID')),
      trigger: 'change',
    },
  ],
  messageTemplate: [
    { required: true, message: '请输入消息模板', trigger: 'blur' },
  ],
  maxRetries: [
    {
      required: true,
      type: 'number',
      min: 0,
      max: 100,
      message: '最大重试次数必须在0-100之间',
      trigger: 'blur',
    },
  ],
  retryInterval: [
    {
      required: true,
      type: 'number',
      min: 1,
      message: '重试间隔必须大于0',
      trigger: 'blur',
    },
  ],
  priority: [{ required: true, message: '请选择优先级', trigger: 'change' }],
};

// 手动发送验证规则
const manualSendRules = {
  channels: [
    {
      required: true,
      type: 'array',
      min: 1,
      message: '请选择至少一个通知渠道',
      trigger: 'change',
    },
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
      trigger: 'blur',
    },
  ],
  subject: [{ required: true, message: '请输入通知主题', trigger: 'blur' }],
  content: [{ required: true, message: '请输入通知内容', trigger: 'blur' }],
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
    return eventTypes.map((type) => getEventTypeName(type)).join(', ');
  }
  return `${eventTypes
    .slice(0, 2)
    .map((type) => getEventTypeName(type))
    .join(', ')} 等${eventTypes.length}个`;
};

const getRecipientTypesDisplay = (recipientTypes: string[]): string => {
  if (recipientTypes.length <= 2) {
    return recipientTypes.map((type) => getRecipientTypeName(type)).join(', ');
  }
  return `${recipientTypes
    .slice(0, 2)
    .map((type) => getRecipientTypeName(type))
    .join(', ')} 等${recipientTypes.length}个`;
};

const getPriorityName = (priority: number): string => {
  const priorityMap: Record<number, string> = {
    [NotificationPriority.High]: '高',
    [NotificationPriority.Medium]: '中',
    [NotificationPriority.Low]: '低',
  };
  return priorityMap[priority] || '未知';
};

const getPriorityColor = (priority: number): string => {
  const colorMap: Record<number, string> = {
    [NotificationPriority.High]: 'red',
    [NotificationPriority.Medium]: 'orange',
    [NotificationPriority.Low]: 'green',
  };
  return colorMap[priority] || 'default';
};

const getTriggerTypeName = (type: string): string => {
  const typeMap: Record<string, string> = {
    [NotificationTrigger.IMMEDIATE]: '立即触发',
    [NotificationTrigger.DELAYED]: '延迟触发',
    [NotificationTrigger.SCHEDULED]: '定时触发',
    [NotificationTrigger.CONDITIONAL]: '条件触发',
  };
  return typeMap[type] || type;
};

const getChannelColor = (channel: string): string => {
  const colorMap: Record<string, string> = {
    [NotificationChannel.IN_APP]: 'cyan',
    [NotificationChannel.FEISHU]: 'green',
    [NotificationChannel.EMAIL]: 'blue',
    [NotificationChannel.SMS]: 'orange',
    [NotificationChannel.WEBHOOK]: 'purple',
  };
  return colorMap[channel] || 'default';
};

const getChannelIcon = (channel: string) => {
  const iconMap: Record<string, any> = {
    [NotificationChannel.IN_APP]: BellOutlined,
    [NotificationChannel.FEISHU]: MessageOutlined,
    [NotificationChannel.EMAIL]: MailOutlined,
    [NotificationChannel.SMS]: PhoneOutlined,
    [NotificationChannel.WEBHOOK]: SendOutlined,
  };
  return iconMap[channel] || MessageOutlined;
};

const getChannelIconColor = (channel: string): string => {
  const colorMap: Record<string, string> = {
    [NotificationChannel.IN_APP]: '#08979c',
    [NotificationChannel.FEISHU]: '#00b96b',
    [NotificationChannel.EMAIL]: '#1890ff',
    [NotificationChannel.SMS]: '#fa8c16',
    [NotificationChannel.WEBHOOK]: '#722ed1',
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

const getPreviewMessage = (notification: Notification): string =>
  notification.message_template || '';

// 添加缺失的函数
const getFormName = (templateId?: number): string => {
  if (!templateId) return '未知模板';
  const template = templates.value.find((t) => t.id === templateId);
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
  optionErrors.process = '';

  try {
    const res = await listWorkorderProcess({
      page: processPagination.current,
      size: processPagination.pageSize,
      search: '',
      status: 2, // 只加载已发布的流程
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
  } catch {
    optionErrors.process = '加载流程选项失败';
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
  optionErrors.template = '';

  try {
    const res = await listWorkorderTemplate({
      page: templatePagination.current,
      size: templatePagination.pageSize,
      search: '',
      status: 1, // 只加载启用的模板
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
      templatePagination.hasMore =
        newItems.length >= templatePagination.pageSize;
    }
  } catch {
    optionErrors.template = '加载模板选项失败';
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
  optionErrors.category = '';

  try {
    const res = await listWorkorderCategory({
      page: categoryPagination.current,
      size: categoryPagination.pageSize,
      search: '',
      status: 1, // 只加载启用的分类
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
      categoryPagination.hasMore =
        newItems.length >= categoryPagination.pageSize;
    }
  } catch {
    optionErrors.category = '加载分类选项失败';
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
  optionErrors.user = '';

  try {
    const res = await getUserList({
      page: userPagination.current,
      size: userPagination.pageSize,
      search: '',
      enable: 1, // 只加载启用的用户
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
  } catch {
    optionErrors.user = '加载用户选项失败';
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
  debouncedSearch.cancel();
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
  debouncedSearch.cancel();
  searchQuery.value = '';
  channelFilter.value = undefined;
  statusFilter.value = undefined;
  paginationConfig.current = 1;
  loadNotifications();
};

const handleTableChange = (
  pagination: any,
  _filters: any,
  _sorter: any,
): void => {
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
  stats.enabled = notifications.value.filter(
    (item) => item.status === NotificationStatus.Enabled,
  ).length;
  stats.disabled = notifications.value.filter(
    (item) => item.status === NotificationStatus.Disabled,
  ).length;
};

// 数据加载
const loadNotifications = async (): Promise<void> => {
  const request = ++listRequest;
  loading.value = true;
  loadError.value = '';

  try {
    const params: ListNotificationReq = {
      page: paginationConfig.current,
      page_size: paginationConfig.pageSize,
      name: searchQuery.value,
      channel: channelFilter.value,
      status: statusFilter.value,
    };

    const res = await getNotificationList(params);
    if (request !== listRequest) return;
    if (res) {
      notifications.value = (res.items || []).map((item: any) => ({
        ...item,
        statusLoading: false,
      }));
      paginationConfig.total = res.total || 0;

      // 计算统计数据
      calculateStats();
    }
  } catch (error) {
    if (request !== listRequest) return;
    notifications.value = [];
    paginationConfig.total = 0;
    calculateStats();
    if (shouldRecordPageError(error))
      loadError.value = '加载通知配置失败，请重试';
  } finally {
    if (request === listRequest) loading.value = false;
  }
};

// 处理发送记录表格分页变化
const handleLogsTableChange = (pagination: any): void => {
  logsPagination.current = pagination.current;
  if (pagination.pageSize !== logsPagination.pageSize) {
    logsPagination.pageSize = pagination.pageSize;
    logsPagination.current = 1; // 当改变页面大小时重置到第一页
  }
  if (activeLogsNotificationId.value) {
    loadSendLogs(activeLogsNotificationId.value);
  }
};

// 加载发送记录
const loadSendLogs = async (notificationId: number): Promise<void> => {
  const request = ++logsRequest;
  activeLogsNotificationId.value = notificationId;
  sendLogs.value = [];
  logsPagination.total = 0;
  logsLoading.value = true;
  logsError.value = '';

  try {
    const params: ListSendLogReq = {
      page: logsPagination.current,
      page_size: logsPagination.pageSize,
      notification_id: notificationId,
    };
    const res = await getSendLogs(params);
    if (request !== logsRequest) return;
    if (res) {
      sendLogs.value = res.items || [];
      logsPagination.total = res.total || 0;
    }
  } catch (error) {
    if (request !== logsRequest) return;
    if (shouldRecordPageError(error))
      logsError.value = '加载发送记录失败，请重试';
  } finally {
    if (request === logsRequest) logsLoading.value = false;
  }
};

// 事件处理
const handleCreateNotification = (): void => {
  ++formEpoch;
  recipientError.value = '';
  originalTriggerFingerprint.value = '';
  originalNotificationStatus.value = NotificationStatus.Disabled;
  originalTriggerVersion.value = undefined;
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
    recipientAddresses: [],
    messageTemplate:
      '您好 {recipient_name}！\n\n工单通知：{title}\n工单编号：{serial_number}\n优先级：{priority_text}\n状态：{status}\n\n详情请查看系统。\n\n通知时间：{notification_time}\n平台：{platform_name}',
    subjectTemplate: '',
    scheduledTime: undefined,
    delayMinutes: undefined,
    repeatCount: undefined,
    repeatInterval: undefined,
    maxRetries: 3,
    retryInterval: 5,
    status: NotificationStatus.Disabled,
    priority: NotificationPriority.Medium,
    isDefault: IsDefault.No,
  };

  notificationDialogVisible.value = true;
};

const handleEditNotification = (record: Notification): void => {
  ++formEpoch;
  recipientError.value = '';

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
    triggerCondition: record.trigger_condition
      ? JSON.stringify(record.trigger_condition)
      : '',
    channels: [...(record.channels || [])],
    recipientTypes: record.recipient_types || [],
    recipientUsers: record.recipient_users || [],
    recipientRoles: record.recipient_roles || [],
    recipientDepts: [...(record.recipient_depts || [])],
    recipientAddresses: (record.recipient_addresses || []).map((address) => ({
      ...address,
    })),
    messageTemplate: record.message_template,
    subjectTemplate: record.subject_template || '',
    scheduledTime: record.scheduled_time
      ? dayjs(record.scheduled_time)
      : undefined,
    delayMinutes: record.delay_minutes,
    repeatCount: record.repeat_count,
    repeatInterval: record.repeat_interval,
    maxRetries: record.max_retries,
    retryInterval: record.retry_interval,
    status: record.status as number,
    priority: record.priority as number,
    isDefault: record.is_default as number,
  };

  // 关闭详情对话框并显示编辑对话框
  detailDialogVisible.value = false;
  originalTriggerFingerprint.value = notificationScheduleFingerprint(
    notificationDialog.form,
  );
  originalNotificationStatus.value = record.status;
  originalTriggerVersion.value = record.trigger_version;
  notificationDialogVisible.value = true;
};

const handleViewNotification = async (record: Notification): Promise<void> => {
  const request = ++detailRequest;
  try {
    if (record.id) {
      const res = await getNotificationDetail(record.id);
      if (request !== detailRequest) return;
      if (res) {
        detailDialog.notification = res;
        detailDialogVisible.value = true;
      }
    }
  } catch (error) {
    if (request !== detailRequest) return;
    if (shouldNotifyPageError(error)) message.error('获取通知配置详情失败');
  }
};

const handleStatusToggle = async (
  record: Notification & { statusLoading?: boolean },
  checked: boolean,
): Promise<void> => {
  if (!record.id) {
    message.error('通知配置ID不存在');
    return;
  }

  record.statusLoading = true;
  const newStatus = checked
    ? NotificationStatus.Enabled
    : NotificationStatus.Disabled;

  try {
    await updateNotificationStatus(record.id, newStatus);
    record.status = newStatus;
    await loadNotifications();
    const statusText =
      newStatus === NotificationStatus.Enabled ? '启用' : '禁用';
    message.success(`通知配置已${statusText}`);
  } catch (error) {
    if (shouldNotifyPageError(error)) message.error('更新状态失败');
  } finally {
    record.statusLoading = false;
  }
};

const handleMenuClick = (command: string, record: Notification): void => {
  switch (command) {
    case 'test': {
      handleTestSend(record);
      break;
    }
    case 'manual': {
      handleManualSend(record);
      break;
    }
    case 'logs': {
      handleViewLogs(record);
      break;
    }
    case 'duplicate': {
      handleDuplicateNotification(record);
      break;
    }
    case 'delete': {
      handleDeleteNotification(record);
      break;
    }
  }
};

const testSendDialog = reactive({
  visible: false,
  sending: false,
  notificationId: 0,
  channels: [] as string[],
  channel: '',
  recipient: '',
  error: '',
});
const handleTestSend = (record: Notification): void => {
  if (
    !record.channels.some((channel) => ['email', 'feishu'].includes(channel))
  ) {
    message.info('站内消息通过工单事件投递，暂不支持试发');
    return;
  }
  testSendDialog.notificationId = record.id;
  testSendDialog.channels = record.channels.filter((channel) =>
    ['email', 'feishu'].includes(channel),
  );
  testSendDialog.channel = testSendDialog.channels[0] || '';
  testSendDialog.recipient = '';
  testSendDialog.error = '';
  testSendDialog.visible = true;
};
const closeTestSend = () => {
  if (testSendDialog.sending) return;
  testSendDialog.visible = false;
  testSendDialog.recipient = '';
};
const confirmTestSend = async () => {
  if (
    testSendDialog.sending ||
    !testSendDialog.channel ||
    !testSendDialog.recipient.trim()
  )
    return;
  testSendDialog.sending = true;
  testSendDialog.error = '';
  try {
    await testSendNotification({
      notification_id: testSendDialog.notificationId,
      channel: testSendDialog.channel,
      recipient: testSendDialog.recipient.trim(),
    });
    message.success('测试通知发送成功');
    testSendDialog.visible = false;
    testSendDialog.recipient = '';
  } catch (error) {
    if (shouldRecordPageError(error))
      testSendDialog.error = '测试发送失败，请核对渠道配置与接收地址';
  } finally {
    testSendDialog.sending = false;
  }
};

const handleManualSend = (record: Notification): void => {
  // 重置表单数据
  manualSendDialog.saving = false;
  manualSendDialog.form = {
    channels: (record.channels || []).filter((channel) =>
      ['email', 'feishu'].includes(channel),
    ),
    recipient: '',
    subject: record.subject_template || 'AI-CloudOps 工单通知',
    content: record.message_template || '',
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

const handleDuplicateNotification = (record: Notification): void => {
  // 服务端没有复制端点，复用已有创建流程让用户审阅后保存
  handleEditNotification(record);
  notificationDialog.isEdit = false;
  notificationDialog.form.id = undefined;
  notificationDialog.form.name = `${record.name}（副本）`;
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
        await deleteNotification(record.id!);

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
          if (
            error.message.includes('timeout') ||
            error.message.includes('超时')
          ) {
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

        // 请求层已提示（403、已弹原文的业务错误、HTTP / 网络错误）与取消类不再弹；其余错误弹上面拼出的具体原因（incr3：基线写法收口到 shouldNotifyPageError）
        if (shouldNotifyPageError(error)) message.error(errorMessage);
      }
    },
  });
};

const saveNotification = async (): Promise<void> => {
  if (notificationDialog.saving) return;
  const epoch = formEpoch;
  recipientError.value = '';
  try {
    await formRef.value?.validate();
  } catch (error) {
    return;
  }

  if (notificationDialog.saving || epoch !== formEpoch) return;
  // 增加额外的业务逻辑验证
  const formData = notificationDialog.form;

  if (
    formData.channels.some(
      (channel) => !['email', 'feishu', 'in_app'].includes(channel),
    )
  ) {
    message.error('请先明确移除当前未支持的通知渠道');
    return;
  }
  if (
    formData.channels.includes('in_app') &&
    !formData.recipientTypes.some((type) =>
      ['creator', 'assignee', 'user', 'role', 'dept'].includes(type),
    )
  ) {
    message.error('站内消息必须选择系统用户、创建人、处理人、角色或部门');
    return;
  }
  // 未修改的历史配置只更新普通字段；明确修改时整体替换触发参数
  const triggerChanged =
    !notificationDialog.isEdit ||
    notificationScheduleFingerprint(formData) !==
      originalTriggerFingerprint.value;
  let schedule: NotificationSchedulePayload | undefined;
  if (triggerChanged) {
    try {
      schedule = buildNotificationSchedule(formData);
    } catch (error) {
      message.error(
        error instanceof Error ? error.message : '通知触发配置无效',
      );
      return;
    }
  }

  if (
    formData.recipientTypes.includes('user') &&
    (!formData.recipientUsers ||
      formData.recipientUsers.length === 0 ||
      formData.recipientUsers.some((u) => !u || !u.trim()))
  ) {
    message.error('选择了用户类型接收人时，必须配置有效的用户ID');
    return;
  }

  if (
    formData.recipientTypes.includes('role') &&
    (!formData.recipientRoles ||
      formData.recipientRoles.length === 0 ||
      formData.recipientRoles.some((r) => !r || !r.trim()))
  ) {
    message.error('选择了角色类型接收人时，必须配置有效的角色ID');
    return;
  }

  if (
    formData.recipientTypes.includes('dept') &&
    (!formData.recipientDepts ||
      formData.recipientDepts.length === 0 ||
      formData.recipientDepts.some((d) => !d || !d.trim()))
  ) {
    message.error('选择了部门类型接收人时，必须配置有效的部门ID');
    return;
  }

  const recipientAddresses = formData.recipientTypes.includes('custom')
    ? formData.recipientAddresses.map((address) => ({
        channel: address.channel,
        address: address.address.trim(),
        name: (address.name || '').trim(),
      }))
    : [];
  if (formData.recipientTypes.includes('custom')) {
    if (!recipientAddresses.length || recipientAddresses.length > 100) {
      recipientError.value = '请配置1至100个自定义接收地址';
      return;
    }
    for (const address of recipientAddresses) {
      const invalid = !formData.channels.includes(address.channel)
        ? '接收地址渠道必须包含在已选择的通知渠道中'
        : addressError(address.channel, address.address);
      if (invalid || Array.from(address.name).length > 100) {
        recipientError.value = invalid || '接收人名称不能超过100字符';
        return;
      }
    }
  }

  notificationDialog.saving = true;

  try {
    // 清理空的接收人数据
    const cleanRecipientUsers =
      formData.recipientUsers
        ?.filter((u) => u && u.trim())
        .map((u) => u.trim()) || [];
    const cleanRecipientRoles =
      formData.recipientRoles
        ?.filter((r) => r && r.trim())
        .map((r) => r.trim()) || [];
    const cleanRecipientDepts =
      formData.recipientDepts
        ?.filter((d) => d && d.trim())
        .map((d) => d.trim()) || [];

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
        ...(schedule ? { ...schedule, clear_trigger: true } : {}),
        channels: formData.channels,
        recipient_types: formData.recipientTypes,
        recipient_users: cleanRecipientUsers,
        recipient_roles: cleanRecipientRoles,
        recipient_depts: cleanRecipientDepts,
        recipient_addresses: recipientAddresses,
        message_template: formData.messageTemplate,
        subject_template: formData.subjectTemplate,
        max_retries: formData.maxRetries,
        retry_interval: formData.retryInterval,
        ...(formData.status !== originalNotificationStatus.value
          ? { status: formData.status }
          : {}),
        priority: formData.priority,
        is_default: formData.isDefault,
      };

      await updateNotification(updateReq);
      if (epoch !== formEpoch) return;
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
        ...schedule!,
        channels: formData.channels,
        recipient_types: formData.recipientTypes,
        recipient_users: cleanRecipientUsers,
        recipient_roles: cleanRecipientRoles,
        recipient_depts: cleanRecipientDepts,
        recipient_addresses: recipientAddresses,
        message_template: formData.messageTemplate,
        subject_template: formData.subjectTemplate,
        max_retries: formData.maxRetries,
        retry_interval: formData.retryInterval,
        priority: formData.priority,
        status: formData.status,
        is_default: formData.isDefault,
      };

      await createNotification(createReq);
      if (epoch !== formEpoch) return;
      message.success('通知配置已创建');
    }

    notificationDialogVisible.value = false;
    loadNotifications();
  } catch (error: any) {
    if (epoch !== formEpoch) return;
    // 根据错误类型提供更具体的错误信息
    let errorMessage = notificationDialog.isEdit ? '更新失败' : '创建失败';

    if (error.message) {
      if (
        error.message.includes('datetime') ||
        error.message.includes('NOW()')
      ) {
        errorMessage += ': 服务器时间格式错误，请联系管理员';
      } else if (
        error.message.includes('duplicate') ||
        error.message.includes('重复')
      ) {
        errorMessage += ': 配置名称已存在，请使用其他名称';
      } else if (
        error.message.includes('validation') ||
        error.message.includes('验证')
      ) {
        errorMessage += ': 数据验证失败，请检查输入内容';
      } else if (
        error.message.includes('timeout') ||
        error.message.includes('超时')
      ) {
        errorMessage += ': 请求超时，请稍后重试';
      } else if (
        error.message.includes('network') ||
        error.message.includes('网络')
      ) {
        errorMessage += ': 网络连接异常，请检查网络';
      } else {
        errorMessage += `: ${error.message}`;
      }
    }

    if (shouldNotifyPageError(error)) message.error(errorMessage);
  } finally {
    if (epoch === formEpoch) notificationDialog.saving = false;
  }
};

// 对话框关闭
const closeNotificationDialog = (): void => {
  if (notificationDialog.saving) return;
  ++formEpoch;
  recipientError.value = '';
  notificationDialogVisible.value = false;
  if (formRef.value) {
    formRef.value.resetFields();
  }
};

const closeDetailDialog = (): void => {
  ++detailRequest;
  detailDialogVisible.value = false;
  detailDialog.notification = null;
};

const closeLogsDialog = (): void => {
  ++logsRequest;
  activeLogsNotificationId.value = undefined;
  logsLoading.value = false;
  logsDialogVisible.value = false;
  sendLogs.value = [];
};

const closeManualSendDialog = (): void => {
  manualSendDialogVisible.value = false;
  manualSendDialog.form = {
    channels: [],
    recipient: '',
    subject: '',
    content: '',
  };
};

const saveManualSend = async (): Promise<void> => {
  if (manualSendDialog.saving) return;
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
      content: manualSendDialog.form.content.trim(),
    };
    await sendNotificationManually(sendData);

    message.success('通知发送成功');
    manualSendDialogVisible.value = false;

    // 重置表单
    manualSendDialog.form = {
      channels: [],
      recipient: '',
      subject: '',
      content: '',
    };
  } catch (error: any) {
    let errorMessage = '发送失败';
    if (error.message) {
      if (error.message.includes('timeout') || error.message.includes('超时')) {
        errorMessage = '发送超时，请检查网络连接或稍后重试';
      } else if (
        error.message.includes('network') ||
        error.message.includes('网络')
      ) {
        errorMessage = '网络连接异常，请检查网络后重试';
      } else if (error.message.includes('403')) {
        errorMessage = '没有权限执行此操作';
      } else if (error.message.includes('500')) {
        errorMessage = '服务器内部错误，请联系管理员';
      } else if (
        error.message.includes('validation') ||
        error.message.includes('验证')
      ) {
        errorMessage = '数据验证失败，请检查输入内容';
      } else {
        errorMessage = `发送失败: ${error.message}`;
      }
    }

    // 请求层已提示（403、已弹原文的业务错误、HTTP / 网络错误）与取消类不再弹；其余错误弹上面拼出的具体原因（incr3：基线写法收口到 shouldNotifyPageError）
    if (shouldNotifyPageError(error)) message.error(errorMessage);
  } finally {
    manualSendDialog.saving = false;
  }
};

// 生命周期
onBeforeUnmount(() => {
  ++listRequest;
  ++logsRequest;
  ++detailRequest;
  ++formEpoch;
  debouncedSearch.cancel();
});
onMounted(() => {
  loadNotifications();
  loadProcesses(true);
  loadTemplates(true);
  loadCategories(true);
  loadUsers(true);
});
</script>

<style scoped>
.recipient-address-row {
  display: grid;
  grid-template-columns: 140px minmax(180px, 1fr) minmax(120px, 1fr) auto;
  gap: var(--ops-space-sm);
  padding: var(--ops-space-md);
  margin-bottom: var(--ops-space-md);
  border: 1px solid var(--ops-border);
  border-radius: var(--ops-radius);
}
.recipient-address-row legend {
  width: auto;
  padding: 0 4px;
  color: var(--ops-muted);
  font-size: 12px;
}
@media (max-width: 640px) {
  .recipient-address-row {
    grid-template-columns: minmax(0, 1fr);
  }
}
.search-input {
  width: 260px;
  min-width: 200px;
}
.channel-filter {
  width: 160px;
}
.status-filter {
  width: 120px;
}
.name-cell,
.form-option,
.form-url-cell,
.form-url-display,
.channel-option,
.user-option {
  display: flex;
  align-items: center;
  gap: var(--ops-space-sm);
  min-width: 0;
}
.form-option {
  justify-content: space-between;
}
.name-text,
.form-name,
.date {
  color: var(--ops-ink);
  font-weight: 500;
}
.name-text,
.recipients-cell {
  overflow-wrap: anywhere;
}
.channels-cell,
.channels-display,
.recipients-display {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}
.channel-tag {
  display: inline-flex;
  align-items: center;
  border-radius: var(--ops-radius);
}
.date-info {
  display: flex;
  flex-direction: column;
}
.time,
.text-gray {
  color: var(--ops-muted);
  font-size: 12px;
}
.form-category {
  padding: 2px 6px;
  border: 1px solid var(--ops-border);
  border-radius: var(--ops-radius);
  color: var(--ops-muted);
  background: var(--ops-ground);
  font-size: 12px;
}
.action-buttons {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-wrap: wrap;
  gap: 4px;
}
.action-buttons :deep(.ant-btn) {
  color: var(--ops-muted);
  background: var(--ops-surface);
  border-color: var(--ops-border);
  box-shadow: none;
}
.action-buttons :deep(.ant-btn:hover) {
  color: var(--ops-accent);
  border-color: var(--ops-accent);
}
.table-container :deep(.ant-table-wrapper) {
  min-width: 0;
  overflow: auto;
}
.table-container :deep(.ant-table-thead th) {
  white-space: nowrap;
}
.table-container :deep(.ant-table-tbody td) {
  overflow-wrap: anywhere;
}
.notification-config-modal :deep(.ant-modal-body),
.send-logs {
  max-height: 70vh;
  overflow-y: auto;
}
.send-logs {
  display: flex;
  flex-direction: column;
  gap: var(--ops-space-md);
}
.notification-details {
  margin-bottom: var(--ops-space-lg);
}
.detail-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: var(--ops-space-md);
  margin-bottom: var(--ops-space-lg);
  padding: var(--ops-space-lg);
  color: var(--ops-ink);
  background: var(--ops-ground);
  border: 1px solid var(--ops-border);
  border-radius: var(--ops-radius);
}
.detail-header h2 {
  margin: 0;
  font-size: 20px;
  overflow-wrap: anywhere;
}
.form-url-display {
  flex-wrap: wrap;
}
.form-url-display :deep(.ant-input),
.url-input {
  font-family: var(--ops-font-mono, monospace);
}
.recipients-help,
.template-help {
  margin-top: var(--ops-space-sm);
}
.message-template-preview {
  margin-top: var(--ops-space-lg);
}
.message-template-preview h3 {
  margin-bottom: var(--ops-space-sm);
  font-size: 15px;
  color: var(--ops-ink);
}
.template-content {
  padding: var(--ops-space-lg);
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  color: var(--ops-ink);
  background: var(--ops-ground);
  border: 1px solid var(--ops-border);
  border-radius: var(--ops-radius);
  line-height: 1.6;
}
.detail-footer {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: var(--ops-space-sm);
  margin-top: var(--ops-space-lg);
  padding-top: var(--ops-space-lg);
  border-top: 1px solid var(--ops-border);
}
.template-variables-help {
  max-height: 300px;
  overflow-y: auto;
  font-size: 12px;
  line-height: 1.5;
}
.variable-group {
  margin-bottom: var(--ops-space-md);
}
.variable-group strong {
  display: block;
  margin-bottom: 6px;
  color: var(--ops-ink);
  font-size: 13px;
}
.variable-list {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 4px 8px;
}
.variable-item {
  display: block;
  padding: 4px 8px;
  border: 1px solid var(--ops-border);
  border-radius: var(--ops-radius);
  color: var(--ops-muted);
  background: var(--ops-ground);
  font-family: monospace;
  font-size: 11px;
  overflow-wrap: anywhere;
}
.variable-deprecated {
  margin-top: var(--ops-space-sm);
  padding-top: var(--ops-space-sm);
  border-top: 1px solid var(--ops-border);
}
.variable-list.deprecated .variable-item {
  color: hsl(var(--destructive));
  text-decoration: line-through;
}
@media (max-width: 640px) {
  .search-input,
  .channel-filter,
  .status-filter {
    width: 100%;
    min-width: 0;
  }
  .form-url-cell,
  .form-url-display,
  .detail-header {
    align-items: stretch;
    flex-direction: column;
  }
  .variable-list {
    grid-template-columns: 1fr;
  }
  .template-variables-help {
    max-height: 200px;
  }
}
</style>
