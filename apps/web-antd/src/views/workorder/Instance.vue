<template>
  <div class="instance-management-container">
    <div class="page-header">
      <div class="header-actions">
        <a-button type="primary" @click="handleCreateInstance" class="btn-create">
          <template #icon>
            <PlusOutlined />
          </template>
          创建工单
        </a-button>
        <a-button type="default" @click="handleCreateFromTemplate">
          <template #icon>
            <FileAddOutlined />
          </template>
          从模板创建
        </a-button>
        <div class="search-filters">
          <a-input-search v-model:value="searchQuery" placeholder="搜索工单标题或编号..." class="search-input"
            @search="handleSearch" allow-clear />

          <a-button type="default" @click="handleExport">
            <template #icon>
              <ExportOutlined />
            </template>
            导出
          </a-button>
          <a-select v-model:value="statusFilter" placeholder="状态" class="status-filter" @change="handleStatusChange">
            <a-select-option :value="undefined">全部状态</a-select-option>
            <a-select-option :value="InstanceStatus.Draft">草稿</a-select-option>
            <a-select-option :value="InstanceStatus.Pending">待处理</a-select-option>
            <a-select-option :value="InstanceStatus.Processing">处理中</a-select-option>
            <a-select-option :value="InstanceStatus.Completed">已完成</a-select-option>
            <a-select-option :value="InstanceStatus.Rejected">已拒绝</a-select-option>
            <a-select-option :value="InstanceStatus.Cancelled">已取消</a-select-option>
          </a-select>
          <a-select v-model:value="priorityFilter" placeholder="优先级" class="priority-filter"
            @change="handlePriorityChange">
            <a-select-option :value="undefined">全部优先级</a-select-option>
            <a-select-option :value="Priority.Low">低</a-select-option>
            <a-select-option :value="Priority.Normal">普通</a-select-option>
            <a-select-option :value="Priority.High">高</a-select-option>
          </a-select>
          <a-select v-model:value="processFilter" placeholder="流程" class="process-filter" @change="handleProcessChange">
            <a-select-option :value="undefined">全部流程</a-select-option>
            <a-select-option v-for="process in processes" :key="process.id" :value="process.id">
              {{ process.name }}
            </a-select-option>
          </a-select>
        </div>
      </div>
    </div>

    <div class="stats-row">
      <a-row :gutter="16">
        <a-col :span="6">
          <a-card class="stats-card">
            <a-statistic title="总工单数" :value="stats.total" :value-style="{ color: '#3f8600' }">
              <template #prefix>
                <FileTextOutlined />
              </template>
            </a-statistic>
          </a-card>
        </a-col>
        <a-col :span="6">
          <a-card class="stats-card">
            <a-statistic title="待处理" :value="stats.pending" :value-style="{ color: '#faad14' }">
              <template #prefix>
                <ClockCircleOutlined />
              </template>
            </a-statistic>
          </a-card>
        </a-col>
        <a-col :span="6">
          <a-card class="stats-card">
            <a-statistic title="处理中" :value="stats.processing" :value-style="{ color: '#1890ff' }">
              <template #prefix>
                <LoadingOutlined />
              </template>
            </a-statistic>
          </a-card>
        </a-col>
        <a-col :span="6">
          <a-card class="stats-card">
            <a-statistic title="已完成" :value="stats.completed" :value-style="{ color: '#52c41a' }">
              <template #prefix>
                <CheckCircleOutlined />
              </template>
            </a-statistic>
          </a-card>
        </a-col>
      </a-row>
    </div>

    <div class="table-container">
      <a-card>
        <a-table :data-source="instanceList" :columns="columns" :pagination="paginationConfig" :loading="loading"
          row-key="id" bordered :scroll="{ x: 1400 }" @change="handleTableChange">
          <template #bodyCell="{ column, record }">
            <template v-if="column.key === 'title'">
              <div class="instance-title-cell">
                <div class="priority-badge" :class="getPriorityClass(record.priority)"></div>
                <div class="title-content">
                  <div class="title-text">{{ record.title }}</div>
                  <div class="serial-number">{{ record.serial_number }}</div>
                </div>
              </div>
            </template>

            <template v-if="column.key === 'status'">
              <a-tag :color="getStatusColor(record.status)">
                {{ getStatusText(record.status) }}
              </a-tag>
            </template>

            <template v-if="column.key === 'priority'">
              <a-tag :color="getPriorityColor(record.priority)">
                {{ getPriorityText(record.priority) }}
              </a-tag>
            </template>

            <template v-if="column.key === 'operator'">
              <div class="operator-info">
                <a-avatar size="small" :style="{ backgroundColor: getAvatarColor(record.operator_name || '') }">
                  {{ getInitials(record.operator_name) }}
                </a-avatar>
                <span class="operator-name">{{ record.operator_name }}</span>
              </div>
            </template>

            <template v-if="column.key === 'assignee'">
              <div class="assignee-info" v-if="record.assignee_id">
                <a-avatar size="small"
                  :style="{ backgroundColor: getAvatarColor(getAssigneeName(record.assignee_id)) }">
                  {{ getInitials(getAssigneeName(record.assignee_id)) }}
                </a-avatar>
                <span class="assignee-name">{{ getAssigneeName(record.assignee_id) }}</span>
              </div>
              <span v-else style="color: #ff7875;">
                未分配
                <a-tooltip title="需要先分配处理人才能执行审批、拒绝、完成等操作">
                  <InfoCircleOutlined style="margin-left: 4px; font-size: 12px;" />
                </a-tooltip>
              </span>
            </template>

            <template v-if="column.key === 'createdAt'">
              <div class="date-info">
                <span class="date">{{ formatDate(record.created_at) }}</span>
                <span class="time">{{ formatTime(record.created_at) }}</span>
              </div>
            </template>

            <template v-if="column.key === 'action'">
              <div class="action-buttons">
                <a-button type="primary" size="small" @click="handleViewInstance(record)">
                  查看
                </a-button>
                <a-button type="default" size="small" @click="handleEditInstance(record)"
                  v-if="record.status === InstanceStatus.Draft">
                  编辑
                </a-button>
                <a-dropdown>
                  <template #overlay>
                    <a-menu @click="(e: any) => handleCommand(e.key, record)">
                      <a-menu-item key="comment">
                        <MessageOutlined /> 添加评论
                      </a-menu-item>
                      <a-menu-item key="timeline">
                        <HistoryOutlined /> 查看时间线
                      </a-menu-item>
                      <a-menu-item key="flow">
                        <PlayCircleOutlined /> 查看流转
                      </a-menu-item>
                      <a-menu-divider />
                      <a-menu-item key="submit" v-if="record.status === InstanceStatus.Draft">
                        提交工单
                      </a-menu-item>
                      <a-menu-item key="assign"
                        v-if="[InstanceStatus.Pending, InstanceStatus.Processing].includes(record.status)">
                        分配处理人
                      </a-menu-item>
                      <a-menu-item key="approve"
                        v-if="[InstanceStatus.Pending, InstanceStatus.Processing].includes(record.status) && record.assignee_id">
                        审批通过
                      </a-menu-item>
                      <a-menu-item key="reject"
                        v-if="[InstanceStatus.Pending, InstanceStatus.Processing].includes(record.status) && record.assignee_id">
                        拒绝工单
                      </a-menu-item>
                      <a-menu-item key="complete"
                        v-if="[InstanceStatus.Pending, InstanceStatus.Processing].includes(record.status) && record.assignee_id">
                        完成工单
                      </a-menu-item>
                      <a-menu-item key="return"
                        v-if="[InstanceStatus.Pending, InstanceStatus.Processing].includes(record.status) && record.assignee_id">
                        退回工单
                      </a-menu-item>
                      <a-menu-divider />

                      <a-menu-item key="delete" danger v-if="canDeleteInstance(record)">
                        删除
                      </a-menu-item>
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

    <!-- 工单创建/编辑对话框 -->
    <a-modal :open="instanceDialog.visible" :title="instanceDialog.isEdit ? '编辑工单' : '创建工单'" :width="formDialogWidth"
      @ok="saveInstance" @cancel="() => { instanceDialog.visible = false }" :destroy-on-close="true"
      class="responsive-modal instance-form-modal" :confirm-loading="loading">
      <a-form ref="formRef" :model="instanceDialog.form" :rules="formRules" layout="vertical">
        <a-row :gutter="16">
          <a-col :span="12">
            <a-form-item label="工单标题" name="title">
              <a-input v-model:value="instanceDialog.form.title" placeholder="请输入工单标题" />
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item label="优先级" name="priority">
              <a-select v-model:value="instanceDialog.form.priority" placeholder="请选择优先级">
                <a-select-option :value="Priority.Low">低</a-select-option>
                <a-select-option :value="Priority.Normal">普通</a-select-option>
                <a-select-option :value="Priority.High">高</a-select-option>
              </a-select>
            </a-form-item>
          </a-col>
        </a-row>

        <a-row :gutter="16">
          <a-col :span="12">
            <a-form-item label="关联流程" name="process_id">
              <a-select v-model:value="instanceDialog.form.process_id" placeholder="请选择流程" style="width: 100%"
                show-search :filter-option="false" option-label-prop="children"
                :not-found-content="processSelectorLoading ? undefined : (processSearchKeyword ? '无搜索结果' : '无数据')"
                @search="handleProcessSearch" @dropdown-visible-change="handleProcessDropdownChange"
                @popup-scroll="handleProcessScroll" allow-clear :loading="processSelectorLoading"
                @change="handleProcessSelectChange">
                <template #notFoundContent>
                  <div v-if="processSelectorLoading" class="selector-loading">
                    <a-spin size="small" />
                    <span style="margin-left: 8px;">加载中...</span>
                  </div>
                  <div v-else class="selector-empty">
                    {{ processSearchKeyword ? '无搜索结果' : '暂无流程数据' }}
                  </div>
                </template>

                <a-select-option v-for="process in dialogProcesses" :key="process.id" :value="process.id">
                  <div class="process-option">
                    <span class="process-name">{{ process.name }}</span>
                    <span v-if="process.description" class="process-desc">{{ process.description }}</span>
                  </div>
                </a-select-option>

                <a-select-option v-if="processPagination.hasMore" :value="'__load_more_process__'" disabled
                  class="load-more-option">
                  <div class="load-more-content" @click.stop="loadMoreProcesses">
                    <a-button type="link" size="small" :loading="processSelectorLoading"
                      style="padding: 0; height: auto; font-size: 12px;">
                      <template v-if="!processSelectorLoading">
                        加载更多 ({{ processPagination.current }}/{{ processTotalPages }})
                      </template>
                      <template v-else>
                        正在加载...
                      </template>
                    </a-button>
                  </div>
                </a-select-option>
              </a-select>
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item label="指定处理人" name="assignee_id">
              <a-select v-model:value="instanceDialog.form.assignee_id" placeholder="请选择处理人" style="width: 100%"
                show-search :filter-option="false" option-label-prop="children"
                :not-found-content="userSelectorLoading ? undefined : (userSearchKeyword ? '无搜索结果' : '无数据')"
                @search="handleUserSearch" @dropdown-visible-change="handleUserDropdownChange"
                @popup-scroll="handleUserScroll" @change="handleAssigneeChange" allow-clear
                :loading="userSelectorLoading">
                <template #notFoundContent>
                  <div v-if="userSelectorLoading" class="selector-loading">
                    <a-spin size="small" />
                    <span style="margin-left: 8px;">加载中...</span>
                  </div>
                  <div v-else class="selector-empty">
                    {{ userSearchKeyword ? '无搜索结果' : '暂无用户数据' }}
                  </div>
                </template>

                <a-select-option v-for="user in dialogUsers" :key="user.id" :value="user.id">
                  <div class="user-option">
                    <a-avatar size="small" :style="{ backgroundColor: getAvatarColor(user.username) }">
                      {{ getInitials(user.username) }}
                    </a-avatar>
                    <span class="user-name">{{ user.username }}</span>
                    <span v-if="user.real_name" class="user-real-name">({{ user.real_name }})</span>
                  </div>
                </a-select-option>

                <a-select-option v-if="userPagination.hasMore" :value="'__load_more_user__'" disabled
                  class="load-more-option">
                  <div class="load-more-content" @click.stop="loadMoreUsers">
                    <a-button type="link" size="small" :loading="userSelectorLoading"
                      style="padding: 0; height: auto; font-size: 12px;">
                      <template v-if="!userSelectorLoading">
                        加载更多 ({{ userPagination.current }}/{{ userTotalPages }})
                      </template>
                      <template v-else>
                        正在加载...
                      </template>
                    </a-button>
                  </div>
                </a-select-option>
              </a-select>
            </a-form-item>
          </a-col>
        </a-row>

        <a-row :gutter="16">
          <a-col :span="12">
            <a-form-item label="截止时间" name="due_date">
              <a-date-picker v-model:value="instanceDialog.form.due_date" placeholder="请选择截止时间" style="width: 100%"
                format="YYYY-MM-DD HH:mm:ss" show-time :show-today="false"
                :disabled-date="(current: any) => current && current < new Date().setHours(0, 0, 0, 0)" />
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item label="标签" name="tags">
              <a-select v-model:value="instanceDialog.form.tags" mode="tags" placeholder="请输入标签" style="width: 100%"
                :max-tag-count="5" :max-tag-text-length="20" allow-clear />
            </a-form-item>
          </a-col>
        </a-row>

        <a-form-item label="描述" name="description">
          <a-textarea v-model:value="instanceDialog.form.description" :rows="4" placeholder="请输入工单描述" />
        </a-form-item>

        <a-form-item label="表单数据" name="form_data" v-if="instanceDialog.form.process_id">
          <div class="form-data-section">
            <div class="section-header">
              <h4>表单字段数据</h4>
              <div class="header-actions">
                <a-segmented v-model:value="formEditMode" :options="[
                  { label: '可视化编辑', value: 'visual' },
                  { label: 'JSON模式', value: 'json' }
                ]" @change="handleModeSwitch" size="small" />
                <template v-if="formEditMode === 'json'">
                  <a-button size="small" @click="formatFormDataJson" :disabled="!instanceDialog.form.form_data_json">
                    格式化
                  </a-button>
                  <a-button size="small" @click="validateFormDataJson" :disabled="!instanceDialog.form.form_data_json">
                    验证
                  </a-button>
                </template>
              </div>
            </div>

            <!-- 可视化表单编辑器 -->
            <div v-if="formEditMode === 'visual'" class="visual-form-editor">
              <a-spin :spinning="formDesignLoading" tip="加载表单设计中...">
                <div v-if="currentFormDesign?.schema?.fields?.length" class="visual-form-fields">
                  <a-row :gutter="16">
                    <template v-for="field in currentFormDesign.schema.fields" :key="field.name">
                      <a-col :span="getFieldColSpan(field.type)" class="form-field-col">
                        <!-- 文本输入框 -->
                        <a-form-item v-if="field.type === FormFieldType.Text" :label="field.label"
                          :required="field.required === 1">
                          <a-input v-model:value="visualFormData[field.name]"
                            :placeholder="field.placeholder || `请输入${field.label}`" @change="handleVisualFormChange" />
                        </a-form-item>

                        <!-- 数字输入框 -->
                        <a-form-item v-else-if="field.type === FormFieldType.Number" :label="field.label"
                          :required="field.required === 1">
                          <a-input-number v-model:value="visualFormData[field.name]"
                            :placeholder="field.placeholder || `请输入${field.label}`" style="width: 100%"
                            @change="handleVisualFormChange" />
                        </a-form-item>

                        <!-- 密码输入框 -->
                        <a-form-item v-else-if="field.type === FormFieldType.Password" :label="field.label"
                          :required="field.required === 1">
                          <a-input-password v-model:value="visualFormData[field.name]"
                            :placeholder="field.placeholder || `请输入${field.label}`" @change="handleVisualFormChange" />
                        </a-form-item>

                        <!-- 多行文本框 -->
                        <a-form-item v-else-if="field.type === FormFieldType.Textarea" :label="field.label"
                          :required="field.required === 1">
                          <a-textarea v-model:value="visualFormData[field.name]"
                            :placeholder="field.placeholder || `请输入${field.label}`" :rows="3"
                            @change="handleVisualFormChange" />
                        </a-form-item>

                        <!-- 下拉选择框 -->
                        <a-form-item v-else-if="field.type === FormFieldType.Select" :label="field.label"
                          :required="field.required === 1">
                          <a-select v-model:value="visualFormData[field.name]"
                            :placeholder="field.placeholder || `请选择${field.label}`" @change="handleVisualFormChange">
                            <a-select-option v-for="option in field.options" :key="option" :value="option">
                              {{ option }}
                            </a-select-option>
                          </a-select>
                        </a-form-item>

                        <!-- 单选框 -->
                        <a-form-item v-else-if="field.type === FormFieldType.Radio" :label="field.label"
                          :required="field.required === 1">
                          <a-radio-group v-model:value="visualFormData[field.name]" @change="handleVisualFormChange">
                            <a-radio v-for="option in field.options" :key="option" :value="option">
                              {{ option }}
                            </a-radio>
                          </a-radio-group>
                        </a-form-item>

                        <!-- 复选框 -->
                        <a-form-item v-else-if="field.type === FormFieldType.Checkbox" :label="field.label"
                          :required="field.required === 1">
                          <a-checkbox-group v-model:value="visualFormData[field.name]" @change="handleVisualFormChange">
                            <a-checkbox v-for="option in field.options" :key="option" :value="option">
                              {{ option }}
                            </a-checkbox>
                          </a-checkbox-group>
                        </a-form-item>

                        <!-- 日期选择器 -->
                        <a-form-item v-else-if="field.type === FormFieldType.Date" :label="field.label"
                          :required="field.required === 1">
                          <a-date-picker v-model:value="visualFormData[field.name]"
                            :placeholder="field.placeholder || `请选择${field.label}`" style="width: 100%"
                            @change="handleVisualFormChange" />
                        </a-form-item>

                        <!-- 开关 -->
                        <a-form-item v-else-if="field.type === FormFieldType.Switch" :label="field.label"
                          :required="field.required === 1">
                          <a-switch v-model:checked="visualFormData[field.name]" @change="handleVisualFormChange" />
                        </a-form-item>

                        <!-- 未知字段类型 -->
                        <a-form-item v-else :label="field.label" :required="field.required === 1">
                          <a-input v-model:value="visualFormData[field.name]"
                            :placeholder="field.placeholder || `请输入${field.label}`" @change="handleVisualFormChange" />
                          <div class="field-type-warning">
                            <a-alert type="warning" :message="`未知字段类型: ${field.type}`" size="small" />
                          </div>
                        </a-form-item>
                      </a-col>
                    </template>
                  </a-row>
                </div>

                <div v-else-if="!formDesignLoading" class="no-form-design">
                  <a-empty description="该流程暂无表单设计或表单字段为空" :image="false">
                    <template #extra>
                      <a-button type="primary" @click="handleModeSwitch('json')">
                        切换到JSON模式
                      </a-button>
                    </template>
                  </a-empty>
                </div>
              </a-spin>
            </div>

            <!-- JSON编辑器 -->
            <div v-else class="json-form-editor">
              <a-textarea v-model:value="instanceDialog.form.form_data_json" placeholder="请输入表单数据JSON..." :rows="8"
                class="json-editor" :class="{ 'json-error': formDataValidationError }" />

              <div v-if="formDataValidationError" class="json-error-message">
                <a-alert type="error" :message="formDataValidationError" show-icon closable
                  @close="formDataValidationError = ''" />
              </div>

              <div class="json-help">
                <a-alert type="info" message="表单数据说明"
                  description="请输入符合流程表单字段的JSON数据，例如：{&quot;name&quot;: &quot;张三&quot;, &quot;email&quot;: &quot;zhangsan@example.com&quot;}"
                  show-icon />
              </div>
            </div>
          </div>
        </a-form-item>
      </a-form>
    </a-modal>

    <!-- 详情对话框 -->
    <a-modal :open="detailDialog.visible" title="工单详情" :width="previewDialogWidth" :footer="null"
      @cancel="() => { detailDialog.visible = false }" class="detail-dialog responsive-modal">
      <div v-if="detailDialog.instance" class="instance-details">
        <div class="detail-header">
          <div class="title-section">
            <h2>{{ detailDialog.instance.title }}</h2>
            <div class="meta-info">
              <a-tag :color="getStatusColor(detailDialog.instance.status)">
                {{ getStatusText(detailDialog.instance.status) }}
              </a-tag>
              <a-tag :color="getPriorityColor(detailDialog.instance.priority)">
                {{ getPriorityText(detailDialog.instance.priority) }}
              </a-tag>
              <span class="serial-number">{{ detailDialog.instance.serial_number }}</span>
            </div>
          </div>
        </div>

        <!-- 当前步骤信息 -->
        <div class="current-step-section" v-if="detailDialog.currentStep || detailDialog.stepLoading">
          <div class="step-header">
            <div class="step-title-wrapper">
              <div class="step-indicator">
                <div class="step-pulse"></div>
                <PlayCircleOutlined class="step-icon" />
              </div>
              <h3 class="step-title">当前步骤</h3>
            </div>
            <div class="step-status-badge" v-if="detailDialog.currentStep">
              <a-tag :color="getStepStatusColor(detailDialog.currentStep.type)" class="step-status-tag">
                {{ getStepTypeText(detailDialog.currentStep.type) }}
              </a-tag>
            </div>
          </div>

          <a-spin :spinning="detailDialog.stepLoading">
            <div v-if="detailDialog.currentStep" class="step-content">
              <div class="step-main-info">
                <div class="step-name-section">
                  <div class="step-name-label">步骤名称</div>
                  <div class="step-name-value">{{ detailDialog.currentStep.name || '未命名步骤' }}</div>
                </div>

                <div class="step-details-grid">
                  <div class="step-detail-item" v-if="detailDialog.currentStep.id">
                    <div class="detail-icon">
                      <NumberOutlined />
                    </div>
                    <div class="detail-content">
                      <div class="detail-label">步骤ID</div>
                      <div class="detail-value">
                        {{ detailDialog.currentStep.id }}
                        <a-tag v-if="detailDialog.instance?.current_step_id === detailDialog.currentStep.id"
                          color="green" size="small" style="margin-left: 8px;">
                          已同步
                        </a-tag>
                        <a-tag v-else-if="detailDialog.instance?.current_step_id" color="orange" size="small"
                          style="margin-left: 8px;">
                          待同步
                        </a-tag>
                      </div>
                    </div>
                  </div>

                  <div class="step-detail-item" v-if="detailDialog.currentStep.assignee">
                    <div class="detail-icon">
                      <UserOutlined />
                    </div>
                    <div class="detail-content">
                      <div class="detail-label">处理人</div>
                      <div class="detail-value">{{ detailDialog.currentStep.assignee }}</div>
                    </div>
                  </div>

                  <div class="step-detail-item" v-if="detailDialog.currentStep.deadline">
                    <div class="detail-icon" :class="{ 'urgent': isDeadlineUrgent(detailDialog.currentStep.deadline) }">
                      <ClockCircleOutlined />
                    </div>
                    <div class="detail-content">
                      <div class="detail-label">截止时间</div>
                      <div class="detail-value"
                        :class="{ 'urgent-text': isDeadlineUrgent(detailDialog.currentStep.deadline) }">
                        {{ formatFullDateTime(detailDialog.currentStep.deadline) }}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div v-else-if="!detailDialog.stepLoading" class="no-step">
              <div class="no-step-icon">
                <InboxOutlined />
              </div>
              <div class="no-step-text">暂无当前步骤信息</div>
              <div class="no-step-subtitle">工单可能尚未开始或已完成</div>
            </div>
          </a-spin>

          <!-- 步骤导航 -->
          <div v-if="detailDialog.currentStep && (detailDialog.previousStep || detailDialog.nextStep)"
            class="step-navigation">
            <div class="navigation-header">
              <h4 class="navigation-title">
                <MoreOutlined />
                步骤导航
              </h4>
            </div>

            <div class="navigation-content">
              <div class="navigation-steps">
                <!-- 前一步骤 -->
                <div v-if="detailDialog.previousStep" class="nav-step prev-step">
                  <div class="nav-step-header">
                    <LeftOutlined class="nav-step-icon" />
                    <span class="nav-step-label">前一步骤</span>
                  </div>
                  <div class="nav-step-content">
                    <div class="nav-step-name">{{ detailDialog.previousStep.name }}</div>
                    <div class="nav-step-type">
                      <a-tag :color="getStepStatusColor(detailDialog.previousStep.type)" size="small">
                        {{ getStepTypeText(detailDialog.previousStep.type) }}
                      </a-tag>
                    </div>
                  </div>
                </div>

                <!-- 当前步骤 -->
                <div class="nav-step current-step-nav">
                  <div class="nav-step-header">
                    <PlayCircleOutlined class="nav-step-icon current" />
                    <span class="nav-step-label">当前步骤</span>
                  </div>
                  <div class="nav-step-content">
                    <div class="nav-step-name">{{ detailDialog.currentStep.name }}</div>
                    <div class="nav-step-type">
                      <a-tag :color="getStepStatusColor(detailDialog.currentStep.type)" size="small">
                        {{ getStepTypeText(detailDialog.currentStep.type) }}
                      </a-tag>
                    </div>
                  </div>
                </div>

                <!-- 下一步骤 -->
                <div v-if="detailDialog.nextStep" class="nav-step next-step">
                  <div class="nav-step-header">
                    <RightOutlined class="nav-step-icon" />
                    <span class="nav-step-label">下一步骤</span>
                  </div>
                  <div class="nav-step-content">
                    <div class="nav-step-name">{{ detailDialog.nextStep.name }}</div>
                    <div class="nav-step-type">
                      <a-tag :color="getStepStatusColor(detailDialog.nextStep.type)" size="small">
                        {{ getStepTypeText(detailDialog.nextStep.type) }}
                      </a-tag>
                    </div>
                  </div>
                </div>
              </div>

              <!-- 步骤进度指示器 -->
              <div class="step-progress" v-if="detailDialog.allSteps.length > 0">
                <div class="progress-bar">
                  <div class="progress-item" v-for="(step, index) in detailDialog.allSteps" :key="step.id" :class="{
                    'completed': isStepCompleted(step, index),
                    'current': step.id === detailDialog.currentStep?.id,
                    'pending': isStepPending(step, index)
                  }">
                    <div class="progress-dot"></div>
                    <div class="progress-label">{{ step.name }}</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <a-descriptions bordered :column="2" :labelStyle="{ width: '120px' }">
          <a-descriptions-item label="工单ID">{{ detailDialog.instance.id }}</a-descriptions-item>
          <a-descriptions-item label="工单编号">{{ detailDialog.instance.serial_number }}</a-descriptions-item>
          <a-descriptions-item label="创建人">{{ detailDialog.instance.operator_name }}</a-descriptions-item>
          <a-descriptions-item label="处理人">
            <span v-if="detailDialog.instance.assignee_id">
              {{ getAssigneeName(detailDialog.instance.assignee_id) }}
            </span>
            <span v-else style="color: #ff7875;">
              未分配
              <a-tooltip title="需要先分配处理人才能执行审批、拒绝、完成等操作">
                <InfoCircleOutlined style="margin-left: 4px;" />
              </a-tooltip>
            </span>
          </a-descriptions-item>
          <a-descriptions-item label="创建时间">
            {{ formatFullDateTime(detailDialog.instance.created_at || '') }}
          </a-descriptions-item>
          <a-descriptions-item label="更新时间">
            {{ formatFullDateTime(detailDialog.instance.updated_at || '') }}
          </a-descriptions-item>
          <a-descriptions-item label="完成时间" :span="2" v-if="detailDialog.instance.completed_at">
            {{ formatFullDateTime(detailDialog.instance.completed_at) }}
          </a-descriptions-item>
          <a-descriptions-item label="截止时间" :span="2" v-if="detailDialog.instance.due_date">
            {{ formatFullDateTime(detailDialog.instance.due_date) }}
          </a-descriptions-item>
          <a-descriptions-item label="标签" :span="2"
            v-if="detailDialog.instance.tags && detailDialog.instance.tags.length > 0">
            <a-tag v-for="tag in detailDialog.instance.tags" :key="tag" color="blue">{{ tag }}</a-tag>
          </a-descriptions-item>
          <a-descriptions-item label="关联流程" :span="2">
            {{ getProcessName(detailDialog.instance.process_id) || '无' }}
          </a-descriptions-item>
          <a-descriptions-item label="描述" :span="2">
            {{ detailDialog.instance.description || '无描述' }}
          </a-descriptions-item>
        </a-descriptions>

        <div class="form-data-preview" v-if="detailDialog.instance.form_data">
          <h3>表单数据</h3>
          <div class="form-data-content">
            <pre class="json-content">{{ JSON.stringify(detailDialog.instance.form_data, null, 2) }}</pre>
          </div>
        </div>

        <!-- 可用动作 -->
        <div class="available-actions-section"
          v-if="(detailDialog.availableActions.length > 0 || detailDialog.actionsLoading) && detailDialog.instance?.status !== InstanceStatus.Completed && detailDialog.instance?.status !== InstanceStatus.Rejected">
          <h3>可用操作</h3>
          <a-spin :spinning="detailDialog.actionsLoading">
            <div class="actions-buttons">
              <!-- 提交工单 -->
              <a-button type="primary" @click="handleActionSubmit(detailDialog.instance)"
                v-if="detailDialog.availableActions.includes('submit')">
                提交工单
              </a-button>

              <!-- 分配处理人 -->
              <a-button type="default" @click="handleActionAssign(detailDialog.instance)"
                v-if="detailDialog.availableActions.includes('assign')">
                分配处理人
              </a-button>

              <!-- 审批通过 -->
              <a-button type="primary" @click="handleActionApprove(detailDialog.instance)"
                v-if="detailDialog.availableActions.includes('approve') && detailDialog.instance.assignee_id">
                审批通过
              </a-button>

              <!-- 拒绝 -->
              <a-button danger @click="handleActionReject(detailDialog.instance)"
                v-if="detailDialog.availableActions.includes('reject') && detailDialog.instance.assignee_id">
                拒绝
              </a-button>

              <!-- 编辑 -->
              <a-button type="default" @click="handleEditInstance(detailDialog.instance)"
                v-if="detailDialog.availableActions.includes('edit')">
                编辑
              </a-button>

              <!-- 取消 -->
              <a-button danger @click="handleActionCancel(detailDialog.instance)"
                v-if="detailDialog.availableActions.includes('cancel')">
                取消工单
              </a-button>

              <!-- 完成工单 -->
              <a-button type="primary" @click="handleActionComplete(detailDialog.instance)"
                v-if="detailDialog.availableActions.includes('complete') && detailDialog.instance.assignee_id">
                完成工单
              </a-button>

              <!-- 退回工单 -->
              <a-button type="default" @click="handleActionReturn(detailDialog.instance)"
                v-if="detailDialog.availableActions.includes('return') && detailDialog.instance.assignee_id">
                退回工单
              </a-button>
            </div>
          </a-spin>
        </div>

        <div class="detail-footer">
          <div class="footer-left">
            <a-button @click="detailDialog.visible = false">关闭</a-button>
          </div>
          <div class="footer-right">
            <a-button type="default" @click="handleViewComments(detailDialog.instance)">
              <MessageOutlined /> 查看评论
            </a-button>
            <a-button type="default" @click="handleViewTimeline(detailDialog.instance)">
              <HistoryOutlined /> 查看时间线
            </a-button>
            <a-button type="default" @click="handleViewFlow(detailDialog.instance)">
              <PlayCircleOutlined /> 查看流转
            </a-button>
            <a-button type="default" @click="handleViewNotificationLogs(detailDialog.instance)">
              <MessageOutlined /> 通知记录
            </a-button>
          </div>
        </div>
      </div>
    </a-modal>

    <!-- 组件 -->
    <WorkorderComments ref="commentsRef" :instance="detailDialog.instance || undefined"
      @comment-added="loadInstances" />
    <WorkorderTimeline ref="timelineRef" />
    <WorkorderFlow ref="flowRef" />

    <!-- 通知记录对话框 -->
    <a-modal :open="notificationLogsDialog.visible" title="通知发送记录" :width="800" :footer="null"
      @cancel="handleCloseNotificationLogsDialog" class="notification-logs-dialog">
      <a-spin :spinning="notificationLogsLoading">
        <div v-if="notificationLogs.length > 0" class="notification-logs-content">
          <a-list :data-source="notificationLogs" item-layout="vertical">
            <template #renderItem="{ item }">
              <a-list-item>
                <a-list-item-meta>
                  <template #title>
                    <div class="notification-title">
                      <span class="event-type">{{ item.event_type }}</span>
                      <a-tag :color="item.status === 1 ? 'green' : 'red'" class="status-tag">
                        {{ item.status === 1 ? '发送成功' : '发送失败' }}
                      </a-tag>
                    </div>
                  </template>
                  <template #description>
                    <div class="notification-meta">
                      <div class="meta-item">
                        <span class="label">发送时间：</span>
                        <span class="value">{{ formatDateTime(item.send_at) }}</span>
                      </div>
                      <div class="meta-item" v-if="item.recipient_addr">
                        <span class="label">收件人：</span>
                        <span class="value">{{ item.recipient_addr }}</span>
                      </div>
                      <div class="meta-item" v-if="item.recipient_name">
                        <span class="label">收件人姓名：</span>
                        <span class="value">{{ item.recipient_name }}</span>
                      </div>
                    </div>
                  </template>
                </a-list-item-meta>
                <template #extra>
                  <div class="notification-actions">
                    <a-button size="small" type="text" @click="viewNotificationDetail(item)">
                      查看详情
                    </a-button>
                  </div>
                </template>
                <div v-if="item.error_message" class="error-message">
                  <a-alert :message="item.error_message" type="error" show-icon />
                </div>
              </a-list-item>
            </template>
          </a-list>

          <!-- 分页组件 -->
          <div class="notification-pagination">
            <a-pagination v-model:current="notificationLogsPagination.current"
              v-model:page-size="notificationLogsPagination.pageSize" :total="notificationLogsPagination.total"
              :show-size-changer="true" :show-quick-jumper="true" :show-total="(total: number) => `共 ${total} 条`"
              :page-size-options="['10', '20', '50']" @change="handleNotificationLogsPageChange"
              @show-size-change="handleNotificationLogsPageChange" />
          </div>
        </div>
        <div v-else class="no-notifications">
          <a-empty description="暂无通知发送记录" />
        </div>
      </a-spin>
    </a-modal>

    <!-- 分配处理人对话框 -->
    <a-modal :open="assignDialog.visible" title="分配处理人" :width="dialogWidth" @ok="saveAssign"
      @cancel="() => { assignDialog.visible = false }" :destroy-on-close="true" class="responsive-modal">
      <a-form :model="assignDialog.form" layout="vertical">
        <a-form-item label="选择处理人" name="assignee_id" :rules="[{ required: true, message: '请选择处理人' }]">
          <a-select v-model:value="assignDialog.form.assignee_id" placeholder="请选择处理人" style="width: 100%" show-search
            :filter-option="false" option-label-prop="children"
            :not-found-content="userSelectorLoading ? undefined : (userSearchKeyword ? '无搜索结果' : '无数据')"
            @search="handleUserSearch" @dropdown-visible-change="handleUserDropdownChange" allow-clear
            :loading="userSelectorLoading">
            <template #notFoundContent>
              <div v-if="userSelectorLoading" class="selector-loading">
                <a-spin size="small" />
                <span style="margin-left: 8px;">加载中...</span>
              </div>
              <div v-else class="selector-empty">
                {{ userSearchKeyword ? '无搜索结果' : '暂无用户数据' }}
              </div>
            </template>

            <a-select-option v-for="user in dialogUsers" :key="user.id" :value="user.id">
              <div class="user-option">
                <a-avatar size="small" :style="{ backgroundColor: getAvatarColor(user.username) }">
                  {{ getInitials(user.username) }}
                </a-avatar>
                <span class="user-name">{{ user.username }}</span>
                <span v-if="user.real_name" class="user-real-name">({{ user.real_name }})</span>
              </div>
            </a-select-option>
          </a-select>
        </a-form-item>
      </a-form>
    </a-modal>

    <!-- 从模板创建工单对话框 -->
    <a-modal :open="templateDialog.visible" title="从模板创建工单" :width="formDialogWidth" @ok="handleTemplateSubmit"
      @cancel="() => { templateDialog.visible = false }" :destroy-on-close="true" class="responsive-modal"
      :confirm-loading="loading">
      <a-form :model="templateDialog.form" layout="vertical">
        <a-form-item label="选择模板" name="template_id" :rules="[{ required: true, message: '请选择模板' }]">
          <a-select v-model:value="templateDialog.form.template_id" placeholder="请选择工单模板" style="width: 100%"
            show-search :filter-option="false" option-label-prop="children"
            :not-found-content="templateSelectorLoading ? undefined : (templateSearchKeyword ? '无搜索结果' : '无数据')"
            @search="handleTemplateSearch" @dropdown-visible-change="(open: boolean) => open && loadTemplates()"
            allow-clear :loading="templateSelectorLoading">
            <template #notFoundContent>
              <div v-if="templateSelectorLoading" class="selector-loading">
                <a-spin size="small" />
                <span style="margin-left: 8px;">加载中...</span>
              </div>
              <div v-else class="selector-empty">
                {{ templateSearchKeyword ? '无搜索结果' : '暂无模板数据' }}
              </div>
            </template>

            <a-select-option v-for="template in dialogTemplates" :key="template.id" :value="template.id">
              <div class="template-option">
                <span class="template-name">{{ template.name }}</span>
                <span v-if="template.description" class="template-desc">{{ template.description }}</span>
              </div>
            </a-select-option>
          </a-select>
        </a-form-item>

        <a-form-item label="工单标题" name="title" :rules="[{ required: true, message: '请输入工单标题' }]">
          <a-input v-model:value="templateDialog.form.title" placeholder="请输入工单标题" />
        </a-form-item>

        <a-row :gutter="16">
          <a-col :span="12">
            <a-form-item label="优先级" name="priority">
              <a-select v-model:value="templateDialog.form.priority" placeholder="请选择优先级">
                <a-select-option :value="Priority.Low">低</a-select-option>
                <a-select-option :value="Priority.Normal">普通</a-select-option>
                <a-select-option :value="Priority.High">高</a-select-option>
              </a-select>
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item label="截止时间" name="due_date">
              <a-date-picker v-model:value="templateDialog.form.due_date" placeholder="请选择截止时间" style="width: 100%"
                format="YYYY-MM-DD HH:mm:ss" show-time :show-today="false"
                :disabled-date="(current: any) => current && current < new Date().setHours(0, 0, 0, 0)" />
            </a-form-item>
          </a-col>
        </a-row>

        <a-form-item label="标签" name="tags">
          <a-select v-model:value="templateDialog.form.tags" mode="tags" placeholder="请输入标签" style="width: 100%"
            :max-tag-count="5" :max-tag-text-length="20" allow-clear />
        </a-form-item>

        <a-form-item label="描述" name="description">
          <a-textarea v-model:value="templateDialog.form.description" :rows="3" placeholder="请输入工单描述" />
        </a-form-item>
      </a-form>
    </a-modal>

    <!-- 审批/拒绝对话框 -->
    <a-modal :open="approvalDialog.visible" :title="getApprovalDialogTitle()" :width="dialogWidth" @ok="saveApproval"
      @cancel="() => { approvalDialog.visible = false }" :destroy-on-close="true" class="responsive-modal">
      <!-- 步骤信息提示 -->
      <div v-if="detailDialog.currentStep" class="approval-step-info">
        <a-alert :type="detailDialog.currentStep.type === 'end' ? 'warning' : 'info'" :message="getStepMessage()"
          show-icon style="margin-bottom: 16px;" />
      </div>

      <a-form :model="approvalDialog.form" layout="vertical">
        <a-form-item :label="approvalDialog.type === 'approve' ? '审批意见' : '拒绝理由'" name="comment"
          :rules="approvalDialog.type === 'reject' ? [{ required: true, message: '请输入拒绝理由' }] : []">
          <a-textarea v-model:value="approvalDialog.form.comment" :rows="4"
            :placeholder="approvalDialog.type === 'approve' ? '请输入审批意见(可选)' : '请输入拒绝理由'" />
        </a-form-item>
      </a-form>
    </a-modal>

    <!-- 操作确认对话框（取消、完成、退回） -->
    <a-modal :open="actionDialog.visible" :title="getActionDialogTitle()" :width="dialogWidth" @ok="saveActionComment"
      @cancel="() => { actionDialog.visible = false }" :destroy-on-close="true" class="responsive-modal"
      :confirm-loading="loading">
      <a-form :model="actionDialog.form" layout="vertical">
        <a-form-item :label="getActionCommentLabel()" name="comment"
          :rules="[{ required: true, message: `请输入${getActionCommentLabel()}` }]">
          <a-textarea v-model:value="actionDialog.form.comment" :rows="4"
            :placeholder="`请输入${getActionCommentLabel()}`" />
        </a-form-item>
      </a-form>
    </a-modal>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted, computed } from 'vue';
import { message, Modal } from 'ant-design-vue';
import {
  PlusOutlined,
  FileTextOutlined,
  ClockCircleOutlined,
  LoadingOutlined,
  CheckCircleOutlined,
  DownOutlined,
  MessageOutlined,
  HistoryOutlined,
  PlayCircleOutlined,
  InfoCircleOutlined,
  FileAddOutlined,
  ExportOutlined,
  UserOutlined,
  InboxOutlined,
  NumberOutlined,
  MoreOutlined,
  LeftOutlined,
  RightOutlined
} from '@ant-design/icons-vue';

import {
  type WorkorderInstanceItem,
  type CreateWorkorderInstanceReq,
  type UpdateWorkorderInstanceReq,
  type DeleteWorkorderInstanceReq,
  type ListWorkorderInstanceReq,
  type DetailWorkorderInstanceReq,
  type SubmitWorkorderInstanceReq,
  type AssignWorkorderInstanceReq,
  type ApproveWorkorderInstanceReq,
  type RejectWorkorderInstanceReq,
  type CancelWorkorderInstanceReq,
  type CompleteWorkorderInstanceReq,
  type ReturnWorkorderInstanceReq,
  InstanceStatus,
  Priority,
  listWorkorderInstance,
  detailWorkorderInstance,
  createWorkorderInstance,
  updateWorkorderInstance,
  deleteWorkorderInstance,
  submitWorkorderInstance,
  assignWorkorderInstance,
  approveWorkorderInstance,
  rejectWorkorderInstance,
  cancelWorkorderInstance,
  completeWorkorderInstance,
  returnWorkorderInstance,
  getAvailableActions,
  getCurrentStep
} from '#/api/core/workorder/workorder_instance';

// 导入新的组件
import WorkorderComments from './components/WorkorderComments.vue'
import WorkorderTimeline from './components/WorkorderTimeline.vue'
import WorkorderFlow from './components/WorkorderFlow.vue'

import {
  type GetUserListReq,
  getUserList
} from '#/api/core/system/user';

interface UserListItem {
  id: number;
  username: string;
  real_name?: string;
}

import {
  type WorkorderProcessItem,
  type ListWorkorderProcessReq,
  type DetailWorkorderProcessReq,
  type ProcessStep,
  type ProcessDefinition,
  listWorkorderProcess,
  detailWorkorderProcess
} from '#/api/core/workorder/workorder_process';

import {
  type WorkorderFormDesignItem,
  type DetailWorkorderFormDesignReq,
  type FormField,
  FormFieldType,
  detailWorkorderFormDesign
} from '#/api/core/workorder/workorder_form_design';

import {
  type WorkorderTemplateItem,
  type ListWorkorderTemplateReq,
  listWorkorderTemplate,
  detailWorkorderTemplate
} from '#/api/core/workorder/workorder_template';

// 导入通知相关API
import {
  type NotificationLog,
  type ListSendLogReq,
  getSendLogs
} from '#/api/core/workorder/workorder_notification';




// 列定义
const columns = [
  {
    title: '工单标题',
    dataIndex: 'title',
    key: 'title',
    width: 250,
    fixed: 'left'
  },
  {
    title: '状态',
    dataIndex: 'status',
    key: 'status',
    width: 100,
    align: 'center' as const,
  },
  {
    title: '优先级',
    dataIndex: 'priority',
    key: 'priority',
    width: 100,
    align: 'center' as const,
  },
  {
    title: '创建人',
    dataIndex: 'operator_name',
    key: 'operator',
    width: 150,
  },
  {
    title: '处理人',
    dataIndex: 'assignee_id',
    key: 'assignee',
    width: 150,
  },
  {
    title: '创建时间',
    dataIndex: 'created_at',
    key: 'createdAt',
    width: 180,
  },
  {
    title: '操作',
    key: 'action',
    width: 200,
    align: 'center' as const,
    fixed: 'right'
  },
];

// 状态数据
const loading = ref(false);
const searchQuery = ref('');
const statusFilter = ref<number | undefined>(undefined);
const priorityFilter = ref<number | undefined>(undefined);
const processFilter = ref<number | undefined>(undefined);
const currentPage = ref(1);
const pageSize = ref(10);
const total = ref(0);

// 组件引用
const commentsRef = ref()
const timelineRef = ref()
const flowRef = ref()



// 数据列表
const instanceList = ref<WorkorderInstanceItem[]>([]);
const processes = ref<WorkorderProcessItem[]>([]);

// 模板相关
const dialogTemplates = ref<WorkorderTemplateItem[]>([]);
const templateSelectorLoading = ref(false);
const templateSearchKeyword = ref('');

// 主用户数据 - 实现真分页
const users = ref<UserListItem[]>([]);
const usersPagination = reactive({
  current: 1,
  pageSize: 20,
  total: 0,
  hasMore: false
});
const usersLoading = ref(false);
const usersSearchKeyword = ref('');

// 通知发送记录相关
const notificationLogs = ref<NotificationLog[]>([]);
const notificationLogsLoading = ref(false);
const notificationLogsDialog = reactive({
  visible: false,
  instanceId: 0
});
const notificationLogsPagination = reactive({
  current: 1,
  pageSize: 10,
  total: 0
});

// 统计数据
const stats = reactive({
  total: 0,
  pending: 0,
  processing: 0,
  completed: 0
});

// 分页配置
const paginationConfig = computed(() => ({
  current: currentPage.value,
  pageSize: pageSize.value,
  total: total.value,
  showSizeChanger: true,
  showQuickJumper: true,
  showTotal: (total: number) => `共 ${total} 条`,
  pageSizeOptions: ['10', '20', '50', '100'],
}));

// 工单对话框
const instanceDialog = reactive({
  visible: false,
  isEdit: false,
  form: {
    id: undefined,
    title: '',
    description: '',
    priority: Priority.Normal,
    process_id: 0,
    assignee_id: undefined,
    form_data_json: '',
    status: InstanceStatus.Draft,
    form_data: {},
    tags: [] as string[],
    due_date: undefined as any
  } as CreateWorkorderInstanceReq & { id?: number; form_data_json?: string; tags?: string[]; due_date?: any }
});

// 表单验证规则
const formRules = {
  title: [
    { required: true, message: '请输入工单标题', trigger: 'blur' },
    { min: 3, max: 100, message: '长度应为3到100个字符', trigger: 'blur' }
  ],
  priority: [
    { required: true, message: '请选择优先级', trigger: 'change' }
  ],
  process_id: [
    { required: true, message: '请选择关联流程', trigger: 'change' }
  ]
};

// 从模板创建对话框
const templateDialog = reactive({
  visible: false,
  form: {
    template_id: undefined as number | undefined,
    title: '',
    description: '',
    priority: Priority.Normal,
    tags: [] as string[],
    due_date: undefined as any
  }
});

// 详情对话框
const detailDialog = reactive({
  visible: false,
  instance: null as WorkorderInstanceItem | null,
  availableActions: [] as string[],
  currentStep: null as any,
  actionsLoading: false,
  stepLoading: false,
  previousStep: null as ProcessStep | null,
  nextStep: null as ProcessStep | null,
  allSteps: [] as ProcessStep[],
  processDefinition: null as ProcessDefinition | null
});


// 分配处理人对话框
const assignDialog = reactive({
  visible: false,
  instanceId: 0,
  form: {
    assignee_id: undefined as number | undefined
  }
});

// 审批对话框
const approvalDialog = reactive({
  visible: false,
  instanceId: 0,
  type: 'approve' as 'approve' | 'reject',
  form: {
    comment: ''
  }
});

// 操作确认对话框（取消、完成、退回）
const actionDialog = reactive({
  visible: false,
  instanceId: 0,
  type: 'cancel' as 'cancel' | 'complete' | 'return',
  form: {
    comment: ''
  }
});

// JSON验证错误
const formDataValidationError = ref('');

// 表单编辑模式：visual | json
const formEditMode = ref<'visual' | 'json'>('visual');

// 当前流程的表单设计
const currentFormDesign = ref<WorkorderFormDesignItem | null>(null);
const formDesignLoading = ref(false);

// 可视化表单数据
const visualFormData = ref<Record<string, any>>({});

// 流程选择器相关 - 使用真分页
const dialogProcesses = ref<WorkorderProcessItem[]>([]);
const processSelectorLoading = ref(false);
const processSearchKeyword = ref('');
let processSearchTimeout: any = null;

const processPagination = reactive({
  current: 1,
  pageSize: 20,
  total: 0,
  hasMore: false
});

// 用户选择器相关
const dialogUsers = ref<UserListItem[]>([]);
const userSelectorLoading = ref(false);
const userSearchKeyword = ref('');
let userSearchTimeout: any = null;

const userPagination = reactive({
  current: 1,
  pageSize: 20,
  total: 0,
  hasMore: false
});

// 响应式对话框宽度
const dialogWidth = computed(() => {
  if (typeof window !== 'undefined') {
    const width = window.innerWidth;
    if (width < 768) return '95%';
    if (width < 1024) return '80%';
    return '600px';
  }
  return '600px';
});

const formDialogWidth = computed(() => {
  if (typeof window !== 'undefined') {
    const width = window.innerWidth;
    if (width < 768) return '95%';
    if (width < 1024) return '90%';
    return '900px';
  }
  return '900px';
});

const previewDialogWidth = computed(() => {
  if (typeof window !== 'undefined') {
    const width = window.innerWidth;
    if (width < 768) return '95%';
    if (width < 1024) return '90%';
    return '80%';
  }
  return '80%';
});

const processTotalPages = computed(() => {
  return Math.ceil(processPagination.total / processPagination.pageSize);
});

const userTotalPages = computed(() => {
  return Math.ceil(userPagination.total / userPagination.pageSize);
});

// 获取字段的列宽
const getFieldColSpan = (fieldType: string): number => {
  switch (fieldType) {
    case FormFieldType.Textarea:
      return 24; // 全宽
    case FormFieldType.Checkbox:
    case FormFieldType.Radio:
      return 24; // 全宽
    case FormFieldType.Date:
    case FormFieldType.Number:
    case FormFieldType.Switch:
      return 12; // 半宽
    default:
      return 12; // 默认半宽
  }
};


const getStatusColor = (status: number): string => {
  const colorMap = {
    [InstanceStatus.Draft]: 'default',
    [InstanceStatus.Pending]: 'orange',
    [InstanceStatus.Processing]: 'blue',
    [InstanceStatus.Completed]: 'green',
    [InstanceStatus.Rejected]: 'red',
    [InstanceStatus.Cancelled]: 'default'
  };
  return colorMap[status as keyof typeof colorMap] || 'default';
};

const getStatusText = (status: number): string => {
  const textMap = {
    [InstanceStatus.Draft]: '草稿',
    [InstanceStatus.Pending]: '待处理',
    [InstanceStatus.Processing]: '处理中',
    [InstanceStatus.Completed]: '已完成',
    [InstanceStatus.Rejected]: '已拒绝',
    [InstanceStatus.Cancelled]: '已取消'
  };
  return textMap[status as keyof typeof textMap] || '未知';
};

const getPriorityColor = (priority: number): string => {
  const colorMap = {
    [Priority.Low]: 'green',
    [Priority.Normal]: 'blue',
    [Priority.High]: 'red'
  };
  return colorMap[priority as keyof typeof colorMap] || 'blue';
};

const getPriorityText = (priority: number): string => {
  const textMap = {
    [Priority.Low]: '低',
    [Priority.Normal]: '普通',
    [Priority.High]: '高'
  };
  return textMap[priority as keyof typeof textMap] || '普通';
};

const getPriorityClass = (priority: number): string => {
  const classMap = {
    [Priority.Low]: 'priority-low',
    [Priority.Normal]: 'priority-normal',
    [Priority.High]: 'priority-high'
  };
  return classMap[priority as keyof typeof classMap] || 'priority-normal';
};

// 修改getAssigneeName方法 - 支持动态加载
const getAssigneeName = (assigneeId?: number): string => {
  if (!assigneeId) return '';

  // 先从已加载的用户中查找
  const user = users.value.find((u: UserListItem) => u.id === assigneeId);
  if (user) {
    return user.username;
  }

  // 如果没找到且还有更多数据，触发加载
  if (usersPagination.hasMore && !usersLoading.value) {
    loadMoreMainUsers();
  }

  return `用户${assigneeId}`;
};

const getProcessName = (processId: number): string => {
  const process = processes.value.find(p => p.id === processId);
  return process?.name || `流程${processId}`;
};

// 检查是否可以删除工单
const canDeleteInstance = (instance: WorkorderInstanceItem): boolean => {
  // 草稿、已完成、已拒绝状态的工单可以删除
  return instance.status === InstanceStatus.Draft ||
    instance.status === InstanceStatus.Completed ||
    instance.status === InstanceStatus.Rejected;
};

const formatDate = (dateStr: string | undefined) => {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' });
};

const formatTime = (dateStr: string | undefined) => {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
};

const formatFullDateTime = (dateStr: string | undefined) => {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleString('zh-CN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

const formatDateTime = (dateStr: string | undefined) => {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
};

const getInitials = (name: string | undefined) => {
  if (!name) return '';
  return name
    .split('')
    .slice(0, 2)
    .join('')
    .toUpperCase();
};

const getAvatarColor = (name: string | undefined) => {
  if (!name) return '#1890ff';

  const colors = [
    '#1890ff', '#52c41a', '#faad14', '#f5222d',
    '#722ed1', '#13c2c2', '#eb2f96', '#fa8c16'
  ];

  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }

  return colors[Math.abs(hash) % colors.length];
};


// 获取表单设计详情
const loadFormDesign = async (processId: number): Promise<void> => {
  if (!processId) {
    currentFormDesign.value = null;
    return;
  }

  try {
    formDesignLoading.value = true;

    // 先从已选择的流程中获取form_design_id
    const selectedProcess = dialogProcesses.value.find(p => p.id === processId) ||
      processes.value.find(p => p.id === processId);

    if (!selectedProcess?.form_design_id) {
      currentFormDesign.value = null;
      return;
    }

    const res = await detailWorkorderFormDesign({ id: selectedProcess.form_design_id } as DetailWorkorderFormDesignReq);
    if (res) {
      currentFormDesign.value = res;
      // 初始化可视化表单数据
      initializeVisualFormData();
    }
  } catch (error: any) {
    console.error('获取表单设计失败:', error);
    currentFormDesign.value = null;
  } finally {
    formDesignLoading.value = false;
  }
};

// 初始化可视化表单数据
const initializeVisualFormData = (): void => {
  if (!currentFormDesign.value?.schema?.fields) {
    visualFormData.value = {};
    return;
  }

  const newData: Record<string, any> = {};

  // 如果有现有的JSON数据，先解析
  if (instanceDialog.form.form_data_json) {
    try {
      const existingData = JSON.parse(instanceDialog.form.form_data_json);
      Object.assign(newData, existingData);
    } catch (error) {
      console.warn('解析现有JSON数据失败:', error);
    }
  }

  // 根据表单字段设置默认值
  currentFormDesign.value.schema.fields.forEach((field: FormField) => {
    if (!(field.name in newData)) {
      if (field.default !== undefined) {
        newData[field.name] = field.default;
      } else {
        // 根据字段类型设置默认值
        switch (field.type) {
          case FormFieldType.Text:
          case FormFieldType.Password:
          case FormFieldType.Textarea:
          case FormFieldType.Select:
          case FormFieldType.Radio:
            newData[field.name] = '';
            break;
          case FormFieldType.Number:
            newData[field.name] = undefined;
            break;
          case FormFieldType.Checkbox:
            newData[field.name] = [];
            break;
          case FormFieldType.Switch:
            newData[field.name] = false;
            break;
          case FormFieldType.Date:
            newData[field.name] = undefined;
            break;
          default:
            newData[field.name] = '';
        }
      }
    }
  });

  visualFormData.value = newData;
};

// 模式切换处理
const handleModeSwitch = (mode: 'visual' | 'json'): void => {
  if (mode === formEditMode.value) return;

  if (mode === 'json') {
    // 从可视化模式切换到JSON模式
    try {
      instanceDialog.form.form_data_json = JSON.stringify(visualFormData.value, null, 2);
      formDataValidationError.value = '';
    } catch (error) {
      console.error('转换为JSON失败:', error);
      message.error('转换为JSON格式失败');
      return;
    }
  } else {
    // 从JSON模式切换到可视化模式
    try {
      if (instanceDialog.form.form_data_json?.trim()) {
        const jsonData = JSON.parse(instanceDialog.form.form_data_json);
        visualFormData.value = { ...visualFormData.value, ...jsonData };
      }
      formDataValidationError.value = '';
    } catch (error) {
      message.error('JSON格式错误，无法切换到可视化模式');
      return;
    }
  }

  formEditMode.value = mode;
};

// 可视化表单数据变化处理
const handleVisualFormChange = (): void => {
  if (formEditMode.value === 'visual') {
    // 同步更新JSON
    try {
      instanceDialog.form.form_data_json = JSON.stringify(visualFormData.value, null, 2);
      formDataValidationError.value = '';
    } catch (error) {
      console.error('同步JSON失败:', error);
    }
  }
};

// JSON处理方法
const formatFormDataJson = (): void => {
  try {
    if (!instanceDialog.form.form_data_json?.trim()) {
      message.warning('请先输入JSON内容');
      return;
    }
    const parsed = JSON.parse(instanceDialog.form.form_data_json);
    instanceDialog.form.form_data_json = JSON.stringify(parsed, null, 2);
    formDataValidationError.value = '';
    message.success('JSON格式化成功');
  } catch (error) {
    formDataValidationError.value = `JSON格式错误: ${(error as Error).message}`;
    message.error('JSON格式化失败');
  }
};

const validateFormDataJson = (): void => {
  try {
    if (!instanceDialog.form.form_data_json?.trim()) {
      formDataValidationError.value = '';
      message.info('JSON内容为空');
      return;
    }

    JSON.parse(instanceDialog.form.form_data_json);
    formDataValidationError.value = '';
    message.success('JSON验证通过');
  } catch (error) {
    formDataValidationError.value = `验证失败: ${(error as Error).message}`;
    message.error('JSON验证失败');
  }
};

// 主用户数据加载方法 - 实现真分页
const loadUsers = async (reset: boolean = false, search?: string): Promise<void> => {
  if (usersLoading.value && !reset) {
    return;
  }

  usersLoading.value = true;

  try {
    const params: GetUserListReq = {
      page: reset ? 1 : usersPagination.current,
      size: usersPagination.pageSize,
      search: search || usersSearchKeyword.value || ''
    };

    const res = await getUserList(params);

    if (res && res.items) {
      if (reset) {
        users.value = res.items;
        usersPagination.current = 1;
      } else {
        // 追加模式，用于加载更多
        users.value = [...users.value, ...res.items];
        usersPagination.current += 1;
      }

      usersPagination.total = res.total || 0;
      usersPagination.hasMore = (usersPagination.current * usersPagination.pageSize) < usersPagination.total;
    } else {
      if (reset) {
        users.value = [];
        usersPagination.current = 1;
        usersPagination.total = 0;
        usersPagination.hasMore = false;
      }
    }
  } catch (error: any) {
    console.error('加载用户数据失败:', error);
    if (reset) {
      message.error(error.message || '加载用户数据失败');
      users.value = [];
      usersPagination.current = 1;
      usersPagination.total = 0;
      usersPagination.hasMore = false;
    }
  } finally {
    usersLoading.value = false;
  }
};

// 加载更多主用户数据
const loadMoreMainUsers = () => loadUsers(false);

// 流程选择器方法 - 使用listWorkorderProcess接口实现动态分页
const loadDialogProcesses = async (reset: boolean = false, search?: string): Promise<void> => {
  if (processSelectorLoading.value && !reset) {
    return;
  }

  processSelectorLoading.value = true;

  try {
    const params: ListWorkorderProcessReq = {
      page: reset ? 1 : processPagination.current,
      size: processPagination.pageSize,
      search: search || processSearchKeyword.value || ''
    };

    const res = await listWorkorderProcess(params);

    if (res && res.items) {
      if (reset) {
        dialogProcesses.value = res.items;
        processPagination.current = 1;
      } else {
        // 追加模式，用于加载更多
        dialogProcesses.value = [...dialogProcesses.value, ...res.items];
        processPagination.current += 1;
      }

      processPagination.total = res.total || 0;
      processPagination.hasMore = (processPagination.current * processPagination.pageSize) < processPagination.total;
    } else {
      if (reset) {
        dialogProcesses.value = [];
        processPagination.current = 1;
        processPagination.total = 0;
        processPagination.hasMore = false;
      }
    }
  } catch (error: any) {
    console.error('加载流程列表失败:', error);
    if (reset) {
      message.error(error.message || '加载流程列表失败');
      dialogProcesses.value = [];
      processPagination.current = 1;
      processPagination.total = 0;
      processPagination.hasMore = false;
    }
  } finally {
    processSelectorLoading.value = false;
  }
};

const loadProcesses = async (search?: string): Promise<void> => {
  try {
    let allProcesses: any[] = [];
    let currentPage = 1;
    const pageSize = 50;
    let hasMoreData = true;

    while (hasMoreData) {
      const params: ListWorkorderProcessReq = {
        page: currentPage,
        size: pageSize,
        search: search || ''
      };

      const res = await listWorkorderProcess(params);

      if (res && res.items && res.items.length > 0) {
        allProcesses = [...allProcesses, ...res.items];

        // 检查是否还有更多数据
        if (res.items.length < pageSize || allProcesses.length >= (res.total || 0)) {
          hasMoreData = false;
        } else {
          currentPage++;
        }
      } else {
        hasMoreData = false;
      }
    }

    processes.value = allProcesses;
  } catch (error: any) {
    console.error('加载流程数据失败:', error);
    processes.value = [];
  }
};

const handleProcessSearch = (value: string): void => {
  processSearchKeyword.value = value;
  if (processSearchTimeout) clearTimeout(processSearchTimeout);
  processSearchTimeout = setTimeout(() => {
    processPagination.current = 1;
    loadDialogProcesses(true, value);
  }, 300);
};

const handleProcessDropdownChange = (open: boolean): void => {
  if (open) {
    if (dialogProcesses.value.length === 0) {
      loadDialogProcesses(true);
    }
  }
};

const handleProcessScroll = (e: Event): void => {
  const { target } = e;
  if (!target) return;

  const element = target as HTMLElement;
  const { scrollTop, scrollHeight, clientHeight } = element;

  if (scrollTop + clientHeight >= scrollHeight - 10 &&
    processPagination.hasMore &&
    !processSelectorLoading.value) {
    loadMoreProcesses();
  }
};

const loadMoreProcesses = () => loadDialogProcesses(false);

// 处理流程选择变化
const handleProcessSelectChange = (processId: number | undefined): void => {
  if (processId) {
    // 加载对应的表单设计
    loadFormDesign(processId);
  } else {
    // 清空表单设计
    currentFormDesign.value = null;
    visualFormData.value = {};
    instanceDialog.form.form_data_json = '';
  }
};

// 用户选择器方法 - 实现真分页
const loadDialogUsers = async (reset: boolean = false, search?: string): Promise<void> => {
  if (userSelectorLoading.value && !reset) {
    return;
  }

  userSelectorLoading.value = true;

  try {
    const params: GetUserListReq = {
      page: reset ? 1 : userPagination.current,
      size: userPagination.pageSize,
      search: search || userSearchKeyword.value || ''
    };

    const res = await getUserList(params);

    if (res && res.items) {
      if (reset) {
        dialogUsers.value = res.items;
        userPagination.current = 1;
      } else {
        // 追加模式，用于加载更多
        dialogUsers.value = [...dialogUsers.value, ...res.items];
        userPagination.current += 1;
      }

      userPagination.total = res.total || 0;
      userPagination.hasMore = (userPagination.current * userPagination.pageSize) < userPagination.total;
    } else {
      if (reset) {
        dialogUsers.value = [];
        userPagination.current = 1;
        userPagination.total = 0;
        userPagination.hasMore = false;
      }
    }
  } catch (error: any) {
    console.error('加载用户列表失败:', error);
    if (reset) {
      message.error(error.message || '加载用户列表失败');
      dialogUsers.value = [];
      userPagination.current = 1;
      userPagination.total = 0;
      userPagination.hasMore = false;
    }
  } finally {
    userSelectorLoading.value = false;
  }
};

const handleUserSearch = (value: string): void => {
  userSearchKeyword.value = value;
  if (userSearchTimeout) clearTimeout(userSearchTimeout);
  userSearchTimeout = setTimeout(() => {
    userPagination.current = 1;
    loadDialogUsers(true, value);
  }, 300);
};

const handleUserDropdownChange = (open: boolean): void => {
  if (open) {
    if (dialogUsers.value.length === 0) {
      loadDialogUsers(true);
    }
  }
};

const handleUserScroll = (e: Event): void => {
  const { target } = e;
  if (!target) return;

  const element = target as HTMLElement;
  const { scrollTop, scrollHeight, clientHeight } = element;

  if (scrollTop + clientHeight >= scrollHeight - 10 &&
    userPagination.hasMore &&
    !userSelectorLoading.value) {
    loadMoreUsers();
  }
};

// 处理人选择变化
const handleAssigneeChange = (value: number | undefined): void => {
  instanceDialog.form.assignee_id = value;
};

const loadMoreUsers = () => loadDialogUsers(false);

// 表格变化处理
const handleTableChange = (pagination: any): void => {
  if (pagination.current !== currentPage.value) {
    currentPage.value = pagination.current;
  }
  if (pagination.pageSize !== pageSize.value) {
    // 确保pageSize不小于10，满足后端验证要求
    pageSize.value = Math.max(10, pagination.pageSize);
    currentPage.value = 1;
  }
  loadInstances();
};

// 数据加载
const loadInstances = async () => {
  loading.value = true;
  try {
    const params: ListWorkorderInstanceReq = {
      page: currentPage.value,
      size: Math.max(10, pageSize.value), // 确保size不小于10
      search: searchQuery.value || undefined,
      status: statusFilter.value || undefined,
      priority: priorityFilter.value || undefined,
      process_id: processFilter.value || undefined
    };

    const res = await listWorkorderInstance(params);
    if (res && res.items) {
      instanceList.value = res.items || [];
      total.value = res.total || 0;

      // 更新统计数据
      await loadStats();
    }
  } catch (error) {
    message.error('加载工单数据失败');
    console.error('Failed to load instances:', error);
  } finally {
    loading.value = false;
  }
};

// 加载真实统计数据
const loadStats = async () => {
  try {
    // 获取所有状态的统计数据，使用最小size=10来满足验证要求
    const [totalRes, pendingRes, processingRes, completedRes] = await Promise.all([
      listWorkorderInstance({ page: 1, size: 10 }),
      listWorkorderInstance({ page: 1, size: 10, status: InstanceStatus.Pending }),
      listWorkorderInstance({ page: 1, size: 10, status: InstanceStatus.Processing }),
      listWorkorderInstance({ page: 1, size: 10, status: InstanceStatus.Completed })
    ]);

    stats.total = totalRes?.total || 0;
    stats.pending = pendingRes?.total || 0;
    stats.processing = processingRes?.total || 0;
    stats.completed = completedRes?.total || 0;
  } catch (error) {
    console.error('Failed to load stats:', error);
    // 如果统计API失败，回退到基于当前页的计算
    updateStatsFromCurrentPage();
  }
};

const updateStatsFromCurrentPage = () => {
  // 这只是一个回退方案，显示当前页的数据（不准确但比没有好）
  stats.total = total.value; // 使用分页的总数
  stats.pending = instanceList.value.filter(item => item.status === InstanceStatus.Pending).length;
  stats.processing = instanceList.value.filter(item => item.status === InstanceStatus.Processing).length;
  stats.completed = instanceList.value.filter(item => item.status === InstanceStatus.Completed).length;
};

// 事件处理 - 统一的筛选处理
const handleFilterChange = () => {
  currentPage.value = 1;
  loadInstances();
};

const handleSearch = handleFilterChange;
const handleStatusChange = handleFilterChange;
const handlePriorityChange = handleFilterChange;
const handleProcessChange = handleFilterChange;

// 导出功能
const handleExport = () => {
  message.info('导出功能开发中...');
};

const handleCreateInstance = () => {
  instanceDialog.isEdit = false;
  instanceDialog.form = {
    title: '', description: '', priority: Priority.Normal,
    process_id: 0, assignee_id: undefined, form_data_json: '',
    form_data: {}, status: InstanceStatus.Draft,
    tags: [], due_date: undefined
  };

  // 重置表单编辑状态
  formDataValidationError.value = '';
  formEditMode.value = 'visual';
  currentFormDesign.value = null;
  visualFormData.value = {};
  instanceDialog.visible = true;
  resetSelectors();
};

// 从模板创建工单
const handleCreateFromTemplate = () => {
  templateDialog.form = {
    template_id: undefined,
    title: '',
    description: '',
    priority: Priority.Normal,
    tags: [],
    due_date: undefined
  };
  templateDialog.visible = true;
  loadTemplates();
};

// 加载模板列表
const loadTemplates = async (search?: string) => {
  try {
    templateSelectorLoading.value = true;
    const params: ListWorkorderTemplateReq = {
      page: 1,
      size: 50
    };

    if (search) {
      params.search = search;
    }

    const res = await listWorkorderTemplate(params);
    if (res) {
      dialogTemplates.value = res.results || [];
    }
  } catch (error: any) {
    console.error('加载模板失败:', error);
    message.error(error.message || '加载模板失败');
  } finally {
    templateSelectorLoading.value = false;
  }
};

// 模板搜索
const handleTemplateSearch = (value: string) => {
  templateSearchKeyword.value = value;
  loadTemplates(value);
};

// 确认从模板创建工单
const handleTemplateSubmit = async () => {
  if (!templateDialog.form.template_id) {
    message.error('请选择模板');
    return;
  }

  try {
    // 获取模板详情
    const templateDetail = await detailWorkorderTemplate({
      id: templateDialog.form.template_id
    });

    if (!templateDetail) {
      message.error('获取模板详情失败');
      return;
    }

    // 关闭模板对话框
    templateDialog.visible = false;

    // 填充工单表单并打开
    instanceDialog.isEdit = false;
    instanceDialog.form = {
      title: templateDialog.form.title || templateDetail.name,
      description: templateDialog.form.description || templateDetail.description,
      priority: templateDialog.form.priority,
      process_id: templateDetail.process_id,
      assignee_id: undefined,
      form_data_json: JSON.stringify(templateDetail.default_values || {}, null, 2),
      form_data: templateDetail.default_values || {},
      status: InstanceStatus.Draft,
      tags: templateDialog.form.tags || [],
      due_date: templateDialog.form.due_date
    };

    // 重置表单编辑状态
    formDataValidationError.value = '';
    formEditMode.value = 'visual';
    currentFormDesign.value = null;
    visualFormData.value = templateDetail.default_values || {};

    instanceDialog.visible = true;
    resetSelectors();

    // 加载对应的表单设计
    if (templateDetail.process_id) {
      await loadFormDesign(templateDetail.process_id);
    }

    message.success('已从模板创建工单，请完善信息后提交');
  } catch (error: any) {
    console.error('从模板创建工单失败:', error);
    message.error(error.message || '从模板创建工单失败');
  }
};

const handleEditInstance = async (row: WorkorderInstanceItem) => {
  instanceDialog.isEdit = true;
  loading.value = true;

  try {
    const res = await detailWorkorderInstance({ id: row.id } as DetailWorkorderInstanceReq);
    if (res) {
      instanceDialog.form = {
        id: res.id, title: res.title, description: res.description,
        priority: res.priority, process_id: res.process_id,
        assignee_id: res.assignee_id != null ? res.assignee_id : undefined,
        form_data_json: JSON.stringify(res.form_data || {}, null, 2),
        form_data: res.form_data, status: res.status,
        tags: res.tags || [],
        due_date: res.due_date ? new Date(res.due_date) : undefined
      };



      // 重置表单编辑相关状态
      formDataValidationError.value = '';
      formEditMode.value = 'visual';

      instanceDialog.visible = true;
      await loadSelectorsForEdit();

      // 加载表单设计并初始化可视化数据
      if (res.process_id) {
        await loadFormDesign(res.process_id);
      }
    }
  } catch (error) {
    message.error('获取工单详情失败');
    console.error('Failed to get instance details:', error);
  } finally {
    loading.value = false;
  }
};

// 获取可用动作
const loadAvailableActions = async (instanceId: number, retryCount: number = 0) => {
  detailDialog.actionsLoading = true;
  try {
    const actions = await getAvailableActions(instanceId);
    detailDialog.availableActions = actions ? actions.map((action: string) => action.toLowerCase()) : [];
  } catch (error) {
    console.error('Failed to get available actions:', error);
    // 如果是第一次失败且重试次数小于2次，则进行重试
    if (retryCount < 2) {
      setTimeout(() => {
        loadAvailableActions(instanceId, retryCount + 1);
      }, 1000);
    } else {
      detailDialog.availableActions = [];
    }
  } finally {
    if (retryCount === 0) {
      detailDialog.actionsLoading = false;
    }
  }
};

// 加载流程定义和步骤导航
const loadProcessStepsNavigation = async (instance: WorkorderInstanceItem) => {
  if (!instance.process_id || !instance.current_step_id) {
    detailDialog.previousStep = null;
    detailDialog.nextStep = null;
    detailDialog.allSteps = [];
    detailDialog.processDefinition = null;
    return;
  }

  try {
    // 获取流程定义
    const processDetail = await detailWorkorderProcess({ id: instance.process_id } as DetailWorkorderProcessReq);
    if (processDetail && processDetail.definition) {
      detailDialog.processDefinition = processDetail.definition;
      const steps = processDetail.definition.steps || [];

      // 按 sort_order 排序步骤
      const sortedSteps = [...steps].sort((a, b) => a.sort_order - b.sort_order);
      detailDialog.allSteps = sortedSteps;

      // 找到当前步骤在排序后数组中的索引
      const currentStepIndex = sortedSteps.findIndex(step => step.id === instance.current_step_id);

      if (currentStepIndex >= 0) {
        // 获取前一步骤
        if (currentStepIndex > 0) {
          detailDialog.previousStep = sortedSteps[currentStepIndex - 1];
        } else {
          detailDialog.previousStep = null;
        }

        // 获取下一步骤
        if (currentStepIndex < sortedSteps.length - 1) {
          detailDialog.nextStep = sortedSteps[currentStepIndex + 1];
        } else {
          detailDialog.nextStep = null;
        }
      } else {
        detailDialog.previousStep = null;
        detailDialog.nextStep = null;
      }
    }
  } catch (error) {
    console.error('Failed to load process definition:', error);
    detailDialog.previousStep = null;
    detailDialog.nextStep = null;
    detailDialog.allSteps = [];
    detailDialog.processDefinition = null;
  }
};

// 获取当前步骤 - 优化版本，基于 current_step_id 字段
const loadCurrentStep = async (instanceId: number, instance?: WorkorderInstanceItem, retryCount: number = 0) => {
  // 如果实例没有 current_step_id，说明工单可能未开始或已完成
  if (instance && !instance.current_step_id) {
    detailDialog.currentStep = null;
    detailDialog.stepLoading = false;
    return;
  }

  detailDialog.stepLoading = true;
  try {
    const step = await getCurrentStep(instanceId);

    // 验证返回的步骤信息与 current_step_id 是否一致
    if (instance?.current_step_id && step?.id && step.id !== instance.current_step_id) {
      console.warn('Step ID mismatch:', {
        expected: instance.current_step_id,
        received: step.id,
        instanceId
      });

      // 刷新实例数据以获取最新状态
      setTimeout(() => refreshInstanceData(instanceId), 500);
    }

    detailDialog.currentStep = step;

    // 同时加载步骤导航信息
    if (instance) {
      await loadProcessStepsNavigation(instance);
    }

    // 记录步骤加载成功的日志
    console.log('Current step loaded successfully:', {
      instanceId,
      stepId: step?.id,
      stepName: step?.name,
      stepType: step?.type
    });

  } catch (error) {
    console.error('Failed to get current step:', error);

    // 智能重试逻辑
    if (retryCount < 3) {
      const retryDelay = Math.min(1000 * Math.pow(2, retryCount), 5000); // 指数退避，最大5秒

      console.log(`Retrying to load current step in ${retryDelay}ms... (attempt ${retryCount + 1}/3)`);

      setTimeout(() => {
        loadCurrentStep(instanceId, instance, retryCount + 1);
      }, retryDelay);
    } else {
      detailDialog.currentStep = null;
      message.warning('获取当前步骤信息失败，请刷新页面重试');
    }
  } finally {
    if (retryCount === 0) {
      detailDialog.stepLoading = false;
    }
  }
};

// 刷新实例数据的辅助函数
const refreshInstanceData = async (instanceId: number) => {
  try {
    const res = await detailWorkorderInstance({ id: instanceId } as DetailWorkorderInstanceReq);
    if (res) {
      detailDialog.instance = res;
      // 重新加载当前步骤
      await loadCurrentStep(instanceId, res);
    }
  } catch (error) {
    console.error('Failed to refresh instance data:', error);
  }
};

// 步骤状态同步函数 - 在执行操作后调用
const syncStepStatus = async (instanceId: number, operationType: string) => {
  console.log(`Syncing step status after ${operationType} operation for instance ${instanceId}`);

  try {
    // 短暂延迟确保后端操作完成
    await new Promise(resolve => setTimeout(resolve, 800));

    // 刷新实例和步骤数据
    await refreshInstanceData(instanceId);

    // 同时刷新可用操作
    await loadAvailableActions(instanceId);

    // 刷新列表数据
    await loadInstances();

    console.log(`Step status synced successfully after ${operationType}`);

  } catch (error) {
    console.error(`Failed to sync step status after ${operationType}:`, error);
    message.warning('操作成功，但状态同步失败，请手动刷新页面查看最新状态');
  }
};

// 获取通知发送记录
const loadNotificationLogs = async (instanceId?: number, resetPage = false) => {
  const targetInstanceId = instanceId || notificationLogsDialog.instanceId;
  if (!targetInstanceId) return;

  if (resetPage) {
    notificationLogsPagination.current = 1;
  }

  notificationLogsLoading.value = true;
  try {
    const res = await getSendLogs({
      instance_id: targetInstanceId,
      page: notificationLogsPagination.current,
      size: notificationLogsPagination.pageSize
    } as ListSendLogReq);

    if (res?.data) {
      notificationLogs.value = res.data;
      notificationLogsPagination.total = res.total || 0;
    } else {
      notificationLogs.value = [];
      notificationLogsPagination.total = 0;
    }
  } catch (error) {
    console.error('Failed to load notification logs:', error);
    message.error('获取通知记录失败');
    notificationLogs.value = [];
    notificationLogsPagination.total = 0;
  } finally {
    notificationLogsLoading.value = false;
  }
};

const handleViewInstance = async (row: WorkorderInstanceItem) => {
  loading.value = true;

  try {
    const res = await detailWorkorderInstance({ id: row.id } as DetailWorkorderInstanceReq);
    if (res) {
      detailDialog.instance = res;
      detailDialog.visible = true;

      console.log('Instance loaded:', {
        id: res.id,
        current_step_id: res.current_step_id,
        status: res.status,
        title: res.title
      });

      // 同时获取可用动作、当前步骤和通知发送记录，传入实例数据用于验证
      await Promise.all([
        loadAvailableActions(row.id),
        loadCurrentStep(row.id, res),
        loadNotificationLogs(row.id)
      ]);
    }
  } catch (error) {
    message.error('获取工单详情失败');
    console.error('Failed to get instance details:', error);
  } finally {
    loading.value = false;
  }
};

const handleCommand = async (command: string, row: WorkorderInstanceItem) => {
  switch (command) {
    case 'comment':
      showCommentDialog(row);
      break;
    case 'timeline':
      await handleViewTimeline(row);
      break;
    case 'flow':
      await handleViewFlow(row);
      break;
    case 'submit':
      await handleActionSubmit(row);
      break;
    case 'assign':
      await handleActionAssign(row);
      break;
    case 'approve':
      await handleActionApprove(row);
      break;
    case 'reject':
      await handleActionReject(row);
      break;
    case 'complete':
      await handleActionComplete(row);
      break;
    case 'return':
      await handleActionReturn(row);
      break;
    case 'cancel':
      await handleActionCancel(row);
      break;
    case 'delete':
      confirmDelete(row);
      break;
  }
};

const showCommentDialog = (instance: WorkorderInstanceItem) => {
  commentsRef.value?.showCommentDialog(instance.id)
}

const handleViewComments = (instance: WorkorderInstanceItem) => {
  commentsRef.value?.showCommentsView(instance.id)
}

const handleViewTimeline = (instance: WorkorderInstanceItem) => {
  timelineRef.value?.showTimeline(instance.id)
}

const handleViewFlow = (instance: WorkorderInstanceItem) => {
  flowRef.value?.showFlow(instance.id)
}

const handleViewNotificationLogs = (instance: WorkorderInstanceItem) => {
  notificationLogsDialog.visible = true;
  notificationLogsDialog.instanceId = instance.id;
  loadNotificationLogs(instance.id, true);
}

// 处理通知记录分页变化
const handleNotificationLogsPageChange = () => {
  loadNotificationLogs();
}

// 关闭通知记录对话框
const handleCloseNotificationLogsDialog = () => {
  notificationLogsDialog.visible = false;
  notificationLogsDialog.instanceId = 0;
  notificationLogs.value = [];
  notificationLogsPagination.current = 1;
  notificationLogsPagination.total = 0;
}

// 查看通知详情
const viewNotificationDetail = (log: NotificationLog) => {
  // 根据API定义，status是number类型，1表示成功
  const isSuccess = log.status === 1;

  Modal.info({
    title: '通知详情',
    width: 600,
    content: `
      <div style="margin-top: 16px;">
        <div style="margin-bottom: 12px;">
          <strong>事件类型：</strong> ${log.event_type}
        </div>
        <div style="margin-bottom: 12px;">
          <strong>发送渠道：</strong> ${log.channel}
        </div>
        <div style="margin-bottom: 12px;">
          <strong>发送状态：</strong> 
          <span style="color: ${isSuccess ? '#52c41a' : '#ff4d4f'};">
            ${isSuccess ? '发送成功' : '发送失败'}
          </span>
        </div>
        <div style="margin-bottom: 12px;">
          <strong>发送时间：</strong> ${formatDateTime(log.send_at)}
        </div>
        ${log.recipient_addr ? `<div style="margin-bottom: 12px;"><strong>收件人地址：</strong> ${log.recipient_addr}</div>` : ''}
        ${log.recipient_name ? `<div style="margin-bottom: 12px;"><strong>收件人姓名：</strong> ${log.recipient_name}</div>` : ''}
        ${log.subject ? `<div style="margin-bottom: 12px;"><strong>主题：</strong> ${log.subject}</div>` : ''}
        ${log.error_message ? `<div style="margin-bottom: 12px;"><strong>错误信息：</strong> <span style="color: #ff4d4f;">${log.error_message}</span></div>` : ''}
      </div>
    `,
    onOk() { }
  });
}

// 带权限检查的动作处理
const handleActionWithPermission = async (instance: WorkorderInstanceItem, action: string, callback: (instance: WorkorderInstanceItem) => void | Promise<void>) => {
  try {
    const actions = await getAvailableActions(instance.id);
    const normalizedActions = actions ? actions.map((actionName: string) => actionName.toLowerCase()) : [];
    if (!normalizedActions.includes(action)) {
      const actionMap: Record<string, string> = {
        submit: '提交', assign: '分配', approve: '审批', reject: '拒绝', cancel: '取消', complete: '完成', return: '退回'
      };
      message.error(`您没有${actionMap[action] || action}此工单的权限`);
      return;
    }

    // 检查需要处理人的操作
    const actionsRequiringAssignee = ['approve', 'reject', 'complete', 'return'];
    if (actionsRequiringAssignee.includes(action) && !instance.assignee_id) {
      message.error('请先分配处理人后再执行此操作');
      return;
    }

    await callback(instance);
  } catch (error) {
    console.error('Failed to check action permission:', error);
  }
};

const handleActionSubmit = (instance: WorkorderInstanceItem) =>
  handleActionWithPermission(instance, 'submit', handleSubmitInstance);

const handleActionAssign = (instance: WorkorderInstanceItem) =>
  handleActionWithPermission(instance, 'assign', showAssignDialog);

const handleActionApprove = (instance: WorkorderInstanceItem) =>
  handleActionWithPermission(instance, 'approve', (inst) => showApprovalDialog(inst, 'approve'));

const handleActionReject = (instance: WorkorderInstanceItem) =>
  handleActionWithPermission(instance, 'reject', (inst) => showApprovalDialog(inst, 'reject'));

const handleActionCancel = (instance: WorkorderInstanceItem) =>
  handleActionWithPermission(instance, 'cancel', (instance) => {
    actionDialog.instanceId = instance.id;
    actionDialog.type = 'cancel';
    actionDialog.form.comment = '';
    actionDialog.visible = true;
  });

const handleActionComplete = (instance: WorkorderInstanceItem) =>
  handleActionWithPermission(instance, 'complete', (instance) => {
    actionDialog.instanceId = instance.id;
    actionDialog.type = 'complete';
    actionDialog.form.comment = '';
    actionDialog.visible = true;
  });

const handleActionReturn = (instance: WorkorderInstanceItem) =>
  handleActionWithPermission(instance, 'return', (instance) => {
    actionDialog.instanceId = instance.id;
    actionDialog.type = 'return';
    actionDialog.form.comment = '';
    actionDialog.visible = true;
  });

const handleSubmitInstance = async (instance: WorkorderInstanceItem) => {
  Modal.confirm({
    title: '提交确认',
    content: `确定要提交工单 "${instance.title}" 吗？提交后将无法撤回。`,
    okText: '提交',
    cancelText: '取消',
    async onOk() {
      try {
        loading.value = true;
        const params: SubmitWorkorderInstanceReq = {
          id: instance.id
        };

        await submitWorkorderInstance(params);
        message.success(`工单 "${instance.title}" 提交成功`);

        await syncStepStatus(instance.id, 'submit');
      } catch (error: any) {
        message.error(`提交工单失败: ${error.message || '未知错误'}`);
        console.error('Failed to submit instance:', error);
      } finally {
        loading.value = false;
      }
    }
  });
};

const showAssignDialog = (instance: WorkorderInstanceItem) => {
  assignDialog.instanceId = instance.id;
  assignDialog.form.assignee_id = undefined;
  assignDialog.visible = true;
  loadDialogUsers(true);
};



const saveAssign = async () => {
  try {
    if (!assignDialog.form.assignee_id) {
      message.error('请选择处理人');
      return;
    }

    loading.value = true;
    const params: AssignWorkorderInstanceReq = {
      id: assignDialog.instanceId,
      assignee_id: Number(assignDialog.form.assignee_id)
    };

    await assignWorkorderInstance(params);

    // 查找分配的用户名称
    const assignedUser = users.value.find(user => user.id === Number(assignDialog.form.assignee_id));
    const assigneeName = assignedUser ? (assignedUser.real_name || assignedUser.username) : '未知用户';

    message.success(`工单已分配给 ${assigneeName}`);


    assignDialog.visible = false;

    // 使用新的同步机制
    await syncStepStatus(assignDialog.instanceId, 'assign');
  } catch (error: any) {
    message.error(`分配处理人失败: ${error.message || '未知错误'}`);
    console.error('Failed to assign instance:', error);
  } finally {
    loading.value = false;
  }
};

// 获取审批对话框标题
const getApprovalDialogTitle = (): string => {
  const isApprove = approvalDialog.type === 'approve';
  const isEndStep = detailDialog.currentStep?.type === 'end';

  if (isApprove) {
    return isEndStep ? '审批通过并完成工单' : '审批通过';
  } else {
    return '拒绝工单';
  }
};

// 获取操作对话框标题
const getActionDialogTitle = (): string => {
  const titleMap = {
    cancel: '取消工单',
    complete: '完成工单',
    return: '退回工单'
  };
  return titleMap[actionDialog.type] || '操作确认';
};

// 获取操作备注标签
const getActionCommentLabel = (): string => {
  const labelMap = {
    cancel: '取消原因',
    complete: '完成说明',
    return: '退回原因'
  };
  return labelMap[actionDialog.type] || '备注';
};

// 获取步骤状态颜色
const getStepStatusColor = (stepType: string): string => {
  switch (stepType) {
    case 'start':
      return 'green';
    case 'end':
      return 'purple';
    case 'approval':
      return 'orange';
    case 'task':
      return 'blue';
    case 'condition':
      return 'cyan';
    default:
      return 'default';
  }
};

// 获取步骤类型文本
const getStepTypeText = (stepType: string): string => {
  switch (stepType) {
    case 'start':
      return '开始步骤';
    case 'end':
      return '结束步骤';
    case 'approval':
      return '审批步骤';
    case 'task':
      return '任务步骤';
    case 'condition':
      return '条件步骤';
    default:
      return stepType || '未知类型';
  }
};

// 判断步骤是否已完成
const isStepCompleted = (_step: ProcessStep, index: number): boolean => {
  if (!detailDialog.currentStep || !detailDialog.allSteps.length) {
    return false;
  }

  const currentStepIndex = detailDialog.allSteps.findIndex(s => s.id === detailDialog.currentStep?.id);
  return currentStepIndex >= 0 && index < currentStepIndex;
};

// 判断步骤是否待处理
const isStepPending = (_step: ProcessStep, index: number): boolean => {
  if (!detailDialog.currentStep || !detailDialog.allSteps.length) {
    return true;
  }

  const currentStepIndex = detailDialog.allSteps.findIndex(s => s.id === detailDialog.currentStep?.id);
  return currentStepIndex >= 0 && index > currentStepIndex;
};

// 判断截止时间是否紧急（24小时内）
const isDeadlineUrgent = (deadline: string): boolean => {
  if (!deadline) return false;
  const deadlineTime = new Date(deadline).getTime();
  const now = Date.now();
  const timeDiff = deadlineTime - now;
  return timeDiff > 0 && timeDiff <= 24 * 60 * 60 * 1000; // 24小时内
};

// 获取步骤提示信息
const getStepMessage = (): string => {
  const stepName = detailDialog.currentStep?.name || '当前步骤';
  const isEndStep = detailDialog.currentStep?.type === 'end';
  const isApprove = approvalDialog.type === 'approve';

  if (isApprove) {
    if (isEndStep) {
      return `当前步骤：${stepName}（最后一步）。审批通过后将完成整个工单流程。`;
    } else {
      return `当前步骤：${stepName}。审批通过后将流转到下一个处理步骤。`;
    }
  } else {
    return `当前步骤：${stepName}。拒绝后工单将退回到上一步或结束流程。`;
  }
};

// 保存操作备注（取消、完成、退回）
const saveActionComment = async () => {
  try {
    if (!actionDialog.form.comment.trim()) {
      message.error(`请输入${getActionCommentLabel()}`);
      return;
    }

    loading.value = true;

    switch (actionDialog.type) {
      case 'cancel':
        await cancelWorkorderInstance({
          id: actionDialog.instanceId,
          comment: actionDialog.form.comment
        } as CancelWorkorderInstanceReq);
        message.success('工单已取消');

        break;

      case 'complete':
        await completeWorkorderInstance({
          id: actionDialog.instanceId,
          comment: actionDialog.form.comment
        } as CompleteWorkorderInstanceReq);
        message.success('工单已完成');

        break;

      case 'return':
        await returnWorkorderInstance({
          id: actionDialog.instanceId,
          comment: actionDialog.form.comment
        } as ReturnWorkorderInstanceReq);
        message.success('工单已退回');
        break;
    }

    actionDialog.visible = false;
    detailDialog.visible = false;

    // 使用同步机制刷新状态
    await syncStepStatus(actionDialog.instanceId, actionDialog.type);

  } catch (error: any) {
    const actionName = getActionDialogTitle();
    message.error(`${actionName}失败: ${error.message || '未知错误'}`);
    console.error(`Failed to ${actionDialog.type} instance:`, error);
  } finally {
    loading.value = false;
  }
};

const showApprovalDialog = (instance: WorkorderInstanceItem, type: 'approve' | 'reject') => {
  approvalDialog.instanceId = instance.id;
  approvalDialog.type = type;
  approvalDialog.form.comment = '';
  approvalDialog.visible = true;
};

const saveApproval = async () => {
  try {
    if (approvalDialog.type === 'reject' && !approvalDialog.form.comment.trim()) {
      message.error('请输入拒绝理由');
      return;
    }

    loading.value = true;

    if (approvalDialog.type === 'approve') {
      // 检查当前步骤信息，判断是审批流转还是完成工单
      if (detailDialog.currentStep?.type === 'end') {
        // 如果是结束步骤，确认是否要完成工单
        Modal.confirm({
          title: '审批确认',
          content: '当前是最后一个审批步骤，审批通过后将完成工单。确定要继续吗？',
          okText: '确定审批并完成',
          cancelText: '取消',
          onOk: async () => {
            try {
              const params: ApproveWorkorderInstanceReq = {
                id: approvalDialog.instanceId,
                comment: approvalDialog.form.comment
              };
              await approveWorkorderInstance(params);
              message.success('审批通过，工单已完成');

              approvalDialog.visible = false;

              // 使用新的同步机制
              await syncStepStatus(approvalDialog.instanceId, 'approve');
            } catch (error: any) {
              message.error(`审批失败: ${error.message || '未知错误'}`);
              console.error('Failed to approve instance:', error);
            }
          }
        });
        return; // 等待用户确认，不继续执行后面的代码
      } else {
        // 普通审批步骤，正常流转
        const params: ApproveWorkorderInstanceReq = {
          id: approvalDialog.instanceId,
          comment: approvalDialog.form.comment
        };
        await approveWorkorderInstance(params);
        message.success('审批通过，工单已流转到下一步');

      }
    } else {
      const params: RejectWorkorderInstanceReq = {
        id: approvalDialog.instanceId,
        comment: approvalDialog.form.comment
      };
      await rejectWorkorderInstance(params);
      message.success('拒绝工单成功');
    }

    approvalDialog.visible = false;

    // 使用新的同步机制
    const operationType = approvalDialog.type === 'approve' ? 'approve' : 'reject';
    await syncStepStatus(approvalDialog.instanceId, operationType);
  } catch (error: any) {
    message.error(`${approvalDialog.type === 'approve' ? '审批' : '拒绝'}失败: ${error.message || '未知错误'}`);
    console.error('Failed to process approval:', error);
  } finally {
    loading.value = false;
  }
};

const confirmDelete = (instance: WorkorderInstanceItem) => {
  Modal.confirm({
    title: '警告',
    content: `确定要删除工单 "${instance.title}" 吗？这个操作不可恢复！`,
    okText: '删除',
    okType: 'danger',
    cancelText: '取消',
    async onOk() {
      try {
        loading.value = true;
        const params: DeleteWorkorderInstanceReq = {
          id: instance.id
        };

        await deleteWorkorderInstance(params);
        message.success(`工单 "${instance.title}" 已删除`);

        if (instanceList.value.length === 1 && currentPage.value > 1) {
          currentPage.value = currentPage.value - 1;
        }

        loadInstances();
      } catch (error: any) {
        message.error(`删除工单失败: ${error.message || '未知错误'}`);
        console.error('Failed to delete instance:', error);
      } finally {
        loading.value = false;
      }
    }
  });
};

const saveInstance = async () => {
  try {
    if (!instanceDialog.form.title.trim()) {
      message.error('工单标题不能为空');
      return;
    }
    
    // 验证工单标题长度和格式
    if (instanceDialog.form.title.trim().length < 3) {
      message.error('工单标题至少需要3个字符');
      return;
    }
    
    if (instanceDialog.form.title.trim().length > 200) {
      message.error('工单标题不能超过200个字符');
      return;
    }
    
    // 检查标题是否包含特殊字符或只有数字
    const titleTrimmed = instanceDialog.form.title.trim();
    if (/^[\d]+$/.test(titleTrimmed)) {
      message.warning('建议工单标题包含描述性内容，而不是只有数字');
    }

    if (!instanceDialog.form.process_id) {
      message.error('请选择关联流程');
      return;
    }

    // 解析表单数据
    let formData = {};
    try {
      if (formEditMode.value === 'visual') {
        // 可视化模式：使用 visualFormData
        formData = { ...visualFormData.value };
      } else {
        // JSON模式：解析JSON字符串
        if (instanceDialog.form.form_data_json?.trim()) {
          formData = JSON.parse(instanceDialog.form.form_data_json);
        }
      }
    } catch (error) {
      message.error('表单数据格式错误');
      return;
    }

    loading.value = true;
    console.log(instanceDialog);
    if (instanceDialog.isEdit && instanceDialog.form.id) {
      const updateData: UpdateWorkorderInstanceReq = {
        id: instanceDialog.form.id,
        title: instanceDialog.form.title,
        description: instanceDialog.form.description || '',
        priority: instanceDialog.form.priority,
        ...(instanceDialog.form.assignee_id != null ? { assignee_id: Number(instanceDialog.form.assignee_id) } : {}),
        form_data: formData,
        tags: instanceDialog.form.tags,
        due_date: instanceDialog.form.due_date ? new Date(instanceDialog.form.due_date).toISOString() : undefined
      };

      await updateWorkorderInstance(updateData);
      message.success(`工单 "${instanceDialog.form.title}" 已更新`);
    } else {
      const createData: CreateWorkorderInstanceReq = {
        title: instanceDialog.form.title,
        process_id: instanceDialog.form.process_id,
        form_data: formData,
        status: InstanceStatus.Draft,
        priority: instanceDialog.form.priority,
        ...(instanceDialog.form.assignee_id != null ? { assignee_id: Number(instanceDialog.form.assignee_id) } : {}),
        description: instanceDialog.form.description,
        tags: instanceDialog.form.tags,
        due_date: instanceDialog.form.due_date ? new Date(instanceDialog.form.due_date).toISOString() : undefined
      };

      await createWorkorderInstance(createData);
      message.success(`工单 "${instanceDialog.form.title}" 已创建`);

      currentPage.value = 1;
    }

    instanceDialog.visible = false;
    loadInstances();
  } catch (error: any) {
    const action = instanceDialog.isEdit ? '更新' : '创建';
    message.error(`${action}工单失败: ${error.message || '未知错误'}`);
    console.error(`Failed to ${instanceDialog.isEdit ? 'update' : 'create'} instance:`, error);
  } finally {
    loading.value = false;
  }
};

// 重置选择器状态
const resetSelectors = (): void => {
  // 重置流程选择器
  Object.assign(processPagination, { current: 1, total: 0, hasMore: false });
  dialogProcesses.value = [];
  processSearchKeyword.value = '';
  processSelectorLoading.value = false;
  if (processSearchTimeout) {
    clearTimeout(processSearchTimeout);
    processSearchTimeout = null;
  }

  // 重置用户选择器
  Object.assign(userPagination, { current: 1, total: 0, hasMore: false });
  dialogUsers.value = [];
  userSearchKeyword.value = '';
  userSelectorLoading.value = false;
  if (userSearchTimeout) {
    clearTimeout(userSearchTimeout);
    userSearchTimeout = null;
  }
};

// 为编辑模式加载选择器信息
const loadSelectorsForEdit = async (): Promise<void> => {
  resetSelectors();

  try {
    await Promise.all([
      loadDialogProcesses(true),
      loadDialogUsers(true)
    ]);

    // 确保当前选中的处理人在用户列表中
    await ensureCurrentAssigneeInList();
  } catch (error) {
    console.error('加载编辑模式选择器信息失败:', error);
  }
};

// 确保当前选中的处理人在用户列表中
const ensureCurrentAssigneeInList = async (): Promise<void> => {
  const currentAssigneeId = instanceDialog.form.assignee_id;

  if (currentAssigneeId == null) {
    return;
  }

  // 检查当前处理人是否已经在dialogUsers中
  const isAssigneeInList = dialogUsers.value.some((user: UserListItem) =>
    user.id === Number(currentAssigneeId)
  );



  if (!isAssigneeInList) {
    try {
      // 加载更多用户数据或搜索特定用户
      // 先尝试通过搜索当前处理人的ID来找到他
      const assigneeUser = users.value.find((user: UserListItem) =>
        user.id === Number(currentAssigneeId)
      );

      if (assigneeUser) {
        // 如果在主用户列表中找到了，添加到dialog用户列表中
        const existsInDialog = dialogUsers.value.some((user: UserListItem) =>
          user.id === assigneeUser.id
        );
        if (!existsInDialog) {
          dialogUsers.value.unshift(assigneeUser);
        }
      }
    } catch (error) {
      console.error('Failed to ensure current assignee in list:', error);
    }
  }
};

// 初始化加载
onMounted(async () => {
  loading.value = true;
  try {
    await Promise.all([
      loadInstances(),
      loadUsers(true), // 初始化加载用户数据（第一页）
      loadProcesses() // 初始化加载流程数据
    ]);
  } catch (error: any) {
    console.error('初始化数据加载失败:', error);
    message.error(`初始化数据加载失败: ${error.message || '未知错误'}, 请刷新页面重试`);
  } finally {
    loading.value = false;
  }
});
</script>

<style scoped>
.instance-management-container {
  padding: 12px;
  min-height: 100vh;
}

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
  background: linear-gradient(135deg, #1890ff 0%);
  border: none;
  flex-shrink: 0;
}

.search-filters {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  flex: 1;
  min-width: 0;
}

.search-input {
  width: 300px;
  min-width: 200px;
}

.status-filter,
.priority-filter,
.process-filter {
  width: 120px;
  min-width: 100px;
}

.stats-row {
  margin-bottom: 20px;
}

.stats-card {
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
  height: 100%;
}

.table-container {
  margin-bottom: 24px;
}

.instance-title-cell {
  display: flex;
  align-items: center;
  gap: 10px;
}

.priority-badge {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}

.priority-low {
  background-color: #52c41a;
}

.priority-normal {
  background-color: #1890ff;
}

.priority-high {
  background-color: #ff4d4f;
}

.title-content {
  flex: 1;
  min-width: 0;
}

.title-text {
  font-weight: 500;
  word-break: break-all;
  line-height: 1.4;
}

.serial-number {
  font-size: 12px;
  color: #8c8c8c;
  margin-top: 2px;
}

.text-gray {
  color: #999;
  font-style: italic;
}

.operator-info,
.assignee-info {
  display: flex;
  align-items: center;
  gap: 8px;
}

.operator-name,
.assignee-name {
  font-size: 14px;
  word-break: break-all;
}

.date-info {
  display: flex;
  flex-direction: column;
}

.date {
  font-weight: 500;
  font-size: 14px;
}

.time {
  font-size: 12px;
  color: #8c8c8c;
}

.action-buttons {
  display: flex;
  gap: 4px;
  justify-content: center;
  flex-wrap: wrap;
}

/* 选择器样式 */
.selector-loading,
.selector-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 8px 12px;
  color: #8c8c8c;
  font-size: 14px;
}

.process-option,
.user-option {
  display: flex;
  align-items: center;
  gap: 8px;
}

.process-name,
.user-name {
  font-weight: 500;
  color: #262626;
}

.process-desc {
  font-size: 12px;
  color: #8c8c8c;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 200px;
}

.user-real-name {
  font-size: 12px;
  color: #8c8c8c;
}

.load-more-option {
  text-align: center;
  border-top: 1px solid #f0f0f0;
  margin-top: 4px;
  background-color: #fafafa !important;
}

.load-more-option:hover {
  background-color: #f0f0f0 !important;
}

.load-more-content {
  padding: 8px 12px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.3s;
}

.load-more-content:hover {
  background-color: #e6f7ff;
  border-radius: 4px;
}

/* 表单数据编辑样式 */
.form-data-section {
  border: 1px solid #d9d9d9;
  border-radius: 6px;
  padding: 16px;
  background: #fafafa;
}

/* 可视化表单编辑器样式 */
.visual-form-editor {
  margin-top: 16px;
  background: white;
  border-radius: 6px;
  padding: 16px;
  border: 1px solid #e8e8e8;
}

.visual-form-fields {
  max-height: 400px;
  overflow-y: auto;
  padding-right: 8px;
}

.form-field-col {
  margin-bottom: 16px;
}

.field-type-warning {
  margin-top: 8px;
}

.no-form-design {
  padding: 40px 20px;
  text-align: center;
  background: white;
  border-radius: 6px;
  border: 1px solid #e8e8e8;
}

.json-form-editor {
  margin-top: 16px;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
  flex-wrap: wrap;
  gap: 8px;
}

.section-header h4 {
  margin: 0;
  color: #333;
  font-size: 16px;
}

.header-actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.json-editor {
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
  font-size: 13px;
  line-height: 1.5;
  border: 1px solid #d9d9d9;
  border-radius: 4px;
  background: white;
  transition: all 0.3s;
}

.json-editor:hover {
  border-color: #40a9ff;
}

.json-editor:focus {
  border-color: #1890ff;
  box-shadow: 0 0 0 2px rgba(24, 144, 255, 0.2);
}

.json-error {
  border-color: #ff4d4f !important;
}

.json-error:focus {
  box-shadow: 0 0 0 2px rgba(255, 77, 79, 0.2) !important;
}

.json-error-message {
  margin-top: 8px;
}

.json-help {
  margin-top: 12px;
}

/* 详情对话框样式 */
.detail-dialog .instance-details {
  margin-bottom: 20px;
}

.detail-header {
  margin-bottom: 24px;
}

.title-section h2 {
  margin: 0 0 12px 0;
  font-size: 24px;
  color: #1f2937;
  word-break: break-all;
}

.meta-info {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}

.serial-number {
  font-size: 14px;
  color: #666;
  background: #f5f5f5;
  padding: 2px 8px;
  border-radius: 4px;
}

.form-data-preview {
  margin-top: 24px;
  padding: 16px;
  background: #fafafa;
  border-radius: 8px;
}

.form-data-preview h3 {
  margin: 0 0 16px 0;
  color: #1f2937;
  font-size: 18px;
}

.form-data-content {
  background: white;
  border: 1px solid #e8e8e8;
  border-radius: 6px;
  padding: 16px;
}

.json-content {
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
  font-size: 13px;
  line-height: 1.5;
  color: #495057;
  margin: 0;
  white-space: pre-wrap;
  word-break: break-all;
}

.detail-footer {
  margin-top: 24px;
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  flex-wrap: wrap;
}

/* 响应式对话框 */
.responsive-modal :deep(.ant-modal) {
  max-width: calc(100vw - 16px);
  margin: 8px;
}

.instance-form-modal :deep(.ant-modal-body) {
  max-height: 70vh;
  overflow-y: auto;
}

/* 移动端适配 */
@media (max-width: 768px) {
  .instance-management-container {
    padding: 8px;
  }

  .header-actions {
    flex-direction: column;
    align-items: stretch;
  }

  .search-filters {
    width: 100%;
  }

  .search-input {
    width: 100%;
    min-width: auto;
  }

  .status-filter,
  .priority-filter,
  .process-filter {
    width: 100%;
    min-width: auto;
  }

  .btn-create {
    padding: 4px 8px;
    min-width: auto;
  }

  .stats-card :deep(.ant-statistic-title) {
    font-size: 12px;
  }

  .stats-card :deep(.ant-statistic-content) {
    font-size: 16px;
  }

  .action-buttons {
    gap: 2px;
  }

  .action-buttons .ant-btn {
    padding: 0 4px;
    font-size: 12px;
  }

  .section-header {
    flex-direction: column;
    align-items: stretch;
  }

  .header-actions {
    justify-content: center;
  }

  .json-editor {
    font-size: 12px;
  }

  .visual-form-editor {
    padding: 12px;
  }

  .visual-form-fields {
    max-height: 300px;
    padding-right: 4px;
  }

  .form-field-col {
    margin-bottom: 12px;
  }

  .section-header .ant-segmented {
    transform: scale(0.9);
    transform-origin: right center;
  }

  .detail-footer {
    justify-content: center;
  }

  .detail-footer .ant-btn {
    flex: 1;
    max-width: 120px;
  }

  .meta-info {
    flex-direction: column;
    align-items: flex-start;
    gap: 8px;
  }

  .load-more-content {
    padding: 6px 8px;
  }

  .comment-header,
  .reply-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 4px;
  }

  .status-change {
    flex-direction: column;
    align-items: flex-start;
    gap: 4px;
  }
}

/* 平板端适配 */
@media (max-width: 1024px) and (min-width: 769px) {
  .instance-management-container {
    padding: 16px;
  }

  .search-input {
    width: 250px;
  }
}

/* 超小屏幕适配 */
@media (max-width: 480px) {
  .header-actions {
    gap: 8px;
  }

  .stats-card {
    text-align: center;
  }

  .operator-info,
  .assignee-info {
    flex-direction: column;
    gap: 4px;
    align-items: center;
  }

  .operator-name,
  .assignee-name {
    font-size: 12px;
  }

  .date-info {
    text-align: center;
  }

  .date {
    font-size: 12px;
  }

  .time {
    font-size: 10px;
  }

  .instance-title-cell {
    flex-direction: column;
    align-items: flex-start;
    gap: 4px;
  }

  .priority-badge {
    align-self: flex-start;
  }

  .process-desc,
  .user-real-name {
    max-width: 120px;
  }

  .load-more-content {
    padding: 4px 6px;
    font-size: 12px;
  }
}

/* 表格滚动优化 */
.table-container :deep(.ant-table-wrapper) {
  overflow: auto;
}

.table-container :deep(.ant-table-thead > tr > th) {
  white-space: nowrap;
}

.table-container :deep(.ant-table-tbody > tr > td) {
  word-break: break-word;
}

/* 当前步骤信息样式 */
.current-step-section {
  margin-top: 20px;
  margin-bottom: 24px;
  background: #ffffff;
  border-radius: 8px;
  border: 1px solid #e8e8e8;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
  overflow: hidden;
}

.step-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px 24px 16px;
  background: #f8fafc;
  border-bottom: 1px solid #e8e8e8;
}

.step-title-wrapper {
  display: flex;
  align-items: center;
  gap: 12px;
}

.step-indicator {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  background: #1890ff;
  border-radius: 6px;
  border: none;
}

.step-pulse {
  display: none;
}

.step-icon {
  font-size: 16px;
  color: white;
}

.step-title {
  margin: 0;
  color: #262626;
  font-size: 18px;
  font-weight: 600;
}

.step-status-badge {
  display: flex;
  align-items: center;
}

.step-status-tag {
  background: #f0f0f0 !important;
  border: 1px solid #d9d9d9 !important;
  color: #595959 !important;
  font-weight: 500 !important;
  padding: 4px 10px !important;
  border-radius: 4px !important;
  font-size: 12px !important;
}

.step-content {
  background: #ffffff;
  padding: 20px 24px;
}

.step-main-info {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.step-name-section {
  padding-bottom: 16px;
  border-bottom: 1px solid #e5e7eb;
}

.step-name-label {
  font-size: 12px;
  color: #6b7280;
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-bottom: 6px;
}

.step-name-value {
  font-size: 18px;
  color: #1f2937;
  font-weight: 600;
  line-height: 1.4;
}

.step-details-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 16px;
}

.step-detail-item {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 16px;
  background: #fafafa;
  border-radius: 6px;
  border: 1px solid #e8e8e8;
  transition: background-color 0.2s ease;
}

.step-detail-item:hover {
  background: #f0f0f0;
}

.detail-icon {
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #f0f0f0;
  color: #666666;
  border-radius: 4px;
  font-size: 13px;
  flex-shrink: 0;
}

.detail-icon.urgent {
  background: #fff2f0;
  color: #ff4d4f;
}

.detail-content {
  flex: 1;
}

.detail-label {
  font-size: 12px;
  color: #6b7280;
  font-weight: 500;
  margin-bottom: 4px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.detail-value {
  font-size: 14px;
  color: #374151;
  font-weight: 500;
  line-height: 1.4;
}

.detail-value.urgent-text {
  color: #dc2626;
  font-weight: 600;
}

.no-step {
  text-align: center;
  padding: 40px 24px;
  background: #ffffff;
}

.no-step-icon {
  font-size: 48px;
  color: #bfbfbf;
  margin-bottom: 16px;
}

.no-step-text {
  font-size: 16px;
  color: #595959;
  font-weight: 500;
  margin-bottom: 8px;
}

.no-step-subtitle {
  font-size: 14px;
  color: #8c8c8c;
}

/* 步骤导航样式 */
.step-navigation {
  margin-top: 20px;
  background: #ffffff;
  border: 1px solid #e8e8e8;
  border-radius: 6px;
  overflow: hidden;
}

.navigation-header {
  padding: 16px 20px;
  background: #f8fafc;
  border-bottom: 1px solid #e8e8e8;
}

.navigation-title {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: #262626;
  display: flex;
  align-items: center;
  gap: 8px;
}

.navigation-content {
  padding: 20px;
}

.navigation-steps {
  display: flex;
  gap: 16px;
  margin-bottom: 20px;
  overflow-x: auto;
  padding-bottom: 8px;
}

.nav-step {
  flex: 1;
  min-width: 140px;
  max-width: 200px;
  padding: 16px;
  background: #fafafa;
  border: 1px solid #e8e8e8;
  border-radius: 6px;
  position: relative;
}

.nav-step.current-step-nav {
  background: #e6f7ff;
  border-color: #1890ff;
}

.nav-step.prev-step {
  background: #f6ffed;
  border-color: #52c41a;
}

.nav-step.next-step {
  background: #fff7e6;
  border-color: #fa8c16;
}

.nav-step-header {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 8px;
}

.nav-step-icon {
  font-size: 14px;
  color: #8c8c8c;
}

.nav-step-icon.current {
  color: #1890ff;
}

.nav-step-label {
  font-size: 12px;
  color: #8c8c8c;
  font-weight: 500;
}

.nav-step-content {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.nav-step-name {
  font-size: 14px;
  color: #262626;
  font-weight: 500;
  line-height: 1.4;
}

.nav-step-type {
  display: flex;
  justify-content: flex-start;
}

/* 步骤进度指示器 */
.step-progress {
  margin-top: 16px;
  padding-top: 16px;
  border-top: 1px solid #f0f0f0;
}

.progress-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  overflow-x: auto;
  padding: 8px 0;
}

.progress-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  min-width: 80px;
  position: relative;
}

.progress-dot {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: #d9d9d9;
  border: 2px solid #d9d9d9;
  margin-bottom: 6px;
}

.progress-item.completed .progress-dot {
  background: #52c41a;
  border-color: #52c41a;
}

.progress-item.current .progress-dot {
  background: #1890ff;
  border-color: #1890ff;
  box-shadow: 0 0 0 4px rgba(24, 144, 255, 0.2);
}

.progress-item.pending .progress-dot {
  background: #f5f5f5;
  border-color: #d9d9d9;
}

.progress-label {
  font-size: 11px;
  color: #8c8c8c;
  text-align: center;
  line-height: 1.2;
  max-width: 80px;
}

.progress-item.current .progress-label {
  color: #1890ff;
  font-weight: 500;
}

.progress-item.completed .progress-label {
  color: #52c41a;
}

/* 响应式设计 */
@media (max-width: 768px) {
  .navigation-steps {
    flex-direction: column;
    gap: 12px;
  }

  .nav-step {
    max-width: none;
    min-width: auto;
  }

  .progress-bar {
    justify-content: center;
  }

  .progress-item {
    min-width: 60px;
  }

  .progress-label {
    font-size: 10px;
    max-width: 60px;
  }
}

/* 可用动作样式 */
.available-actions-section {
  margin-top: 20px;
  margin-bottom: 24px;
  padding: 20px;
  background: #f8fafc;
  border: 1px solid #e8e8e8;
  border-radius: 6px;
}

.available-actions-section h3 {
  margin: 0 0 16px 0;
  color: #262626;
  font-size: 16px;
  font-weight: 600;
}

.actions-buttons {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
}

.actions-buttons .ant-btn {
  border-radius: 4px;
  font-weight: 500;
  height: 36px;
}

/* 详情页面底部样式优化 */
.detail-footer {
  margin-top: 24px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
  padding-top: 16px;
  border-top: 1px solid #e5e7eb;
}

.footer-left {
  display: flex;
  gap: 8px;
}

.footer-right {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.footer-right .ant-btn {
  border-radius: 6px;
}

/* 步骤加载状态 */
.current-step-section .ant-spin-container {
  min-height: 60px;
}

/* 动作按钮加载状态 */
.available-actions-section .ant-spin-container {
  min-height: 50px;
}

/* 审批步骤信息样式 */
.approval-step-info {
  margin-bottom: 16px;
}

.approval-step-info .ant-alert {
  border-radius: 6px;
  border: 1px solid;
  font-size: 14px;
  line-height: 1.5;
}

.approval-step-info .ant-alert-info {
  background-color: #e6f7ff;
  border-color: #91d5ff;
}

.approval-step-info .ant-alert-warning {
  background-color: #fff7e6;
  border-color: #ffc53d;
}

.approval-step-info .ant-alert-message {
  color: #262626;
  font-weight: 500;
}

/* 移动端优化 */
@media (max-width: 768px) {
  .current-step-section {
    margin-left: -8px;
    margin-right: -8px;
    border-radius: 0;
    border-left: none;
    border-right: none;
  }

  .step-header {
    padding: 16px 20px 12px;
  }

  .step-title {
    font-size: 16px;
  }

  .step-indicator {
    width: 32px;
    height: 32px;
  }

  .step-icon {
    font-size: 14px;
  }

  .step-content {
    padding: 16px 20px;
  }

  .step-details-grid {
    grid-template-columns: 1fr;
    gap: 12px;
  }

  .step-detail-item {
    padding: 12px;
  }

  .detail-icon {
    width: 24px;
    height: 24px;
    font-size: 12px;
  }

  .no-step {
    padding: 30px 20px;
  }

  .no-step-icon {
    font-size: 40px;
  }

  .available-actions-section {
    margin-left: -8px;
    margin-right: -8px;
    border-radius: 0;
    border-left: none;
    border-right: none;
  }

  .actions-buttons {
    justify-content: center;
  }

  .actions-buttons .ant-btn {
    flex: 1;
    min-width: 80px;
    max-width: 120px;
  }

  .detail-footer {
    flex-direction: column;
    gap: 16px;
  }

  .footer-right {
    width: 100%;
    justify-content: center;
  }

  .footer-right .ant-btn {
    flex: 1;
    max-width: 100px;
  }

  .approval-step-info .ant-alert {
    font-size: 13px;
    padding: 8px 12px;
  }
}

/* 通知记录对话框样式 */
.notification-logs-dialog .notification-logs-content {
  max-height: 500px;
  overflow-y: auto;
}

.notification-logs-dialog .notification-title {
  display: flex;
  align-items: center;
  gap: 8px;
}

.notification-logs-dialog .event-type {
  font-weight: 500;
  color: #1890ff;
}

.notification-logs-dialog .notification-meta {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.notification-logs-dialog .meta-item {
  display: flex;
  align-items: center;
}

.notification-logs-dialog .meta-item .label {
  color: #666;
  margin-right: 8px;
  min-width: 80px;
}

.notification-logs-dialog .meta-item .value {
  color: #333;
}

.notification-logs-dialog .notification-actions {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.notification-logs-dialog .error-message {
  margin-top: 12px;
}

.notification-logs-dialog .no-notifications {
  text-align: center;
  padding: 40px 0;
}

.notification-logs-dialog .notification-pagination {
  margin-top: 16px;
  text-align: center;
  padding: 16px 0;
  border-top: 1px solid #f0f0f0;
}
</style>
