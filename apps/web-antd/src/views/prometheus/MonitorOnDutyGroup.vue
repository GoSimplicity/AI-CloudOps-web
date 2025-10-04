<template>
  <div class="on-duty-group-container">
    <!-- 页面标题 -->
    <div class="page-header">
      <div class="header-actions">
        <a-button type="primary" @click="showAddModal" class="btn-create">
          <template #icon>
            <PlusOutlined />
          </template>
          <span class="btn-text">新增值班组</span>
        </a-button>
        <div class="search-filters">
          <a-input-search 
            v-model:value="searchText" 
            placeholder="搜索值班组名称..." 
            class="search-input"
            @search="handleSearch" 
            @change="handleSearchChange" 
            allow-clear 
          />
          <a-select
            v-model:value="enableFilter"
            placeholder="状态筛选"
            style="width: 120px;"
            allow-clear
            @change="handleEnableFilterChange"
          >
            <a-select-option :value="1">启用</a-select-option>
            <a-select-option :value="2">禁用</a-select-option>
          </a-select>
          <a-button @click="handleReset" class="reset-btn">
            重置
          </a-button>
        </div>
      </div>
    </div>

    <!-- 统计卡片 -->
    <div class="stats-row">
      <a-row :gutter="[16, 16]">
        <a-col :xs="12" :sm="6" :md="6" :lg="6">
          <a-card class="stats-card">
            <a-statistic title="总值班组" :value="stats.total" :value-style="{ color: '#3f8600' }">
              <template #prefix>
                <Icon icon="carbon:user-multiple" />
              </template>
            </a-statistic>
          </a-card>
        </a-col>
        <a-col :xs="12" :sm="6" :md="6" :lg="6">
          <a-card class="stats-card">
            <a-statistic title="活跃成员" :value="stats.activeusers" :value-style="{ color: '#52c41a' }">
              <template #prefix>
                <Icon icon="carbon:user-activity" />
              </template>
            </a-statistic>
          </a-card>
        </a-col>
        <a-col :xs="12" :sm="6" :md="6" :lg="6">
          <a-card class="stats-card">
            <a-statistic title="平均周期" :value="stats.avgShiftDays" suffix="天" :value-style="{ color: '#faad14' }">
              <template #prefix>
                <Icon icon="carbon:calendar" />
              </template>
            </a-statistic>
          </a-card>
        </a-col>
        <a-col :xs="12" :sm="6" :md="6" :lg="6">
          <a-card class="stats-card">
            <a-statistic title="今日值班" :value="stats.todayOnDuty" :value-style="{ color: '#cf1322' }">
              <template #prefix>
                <Icon icon="carbon:user-certification" />
              </template>
            </a-statistic>
          </a-card>
        </a-col>
      </a-row>
    </div>

    <!-- 表格容器 -->
    <div class="table-container">
      <a-card>
        <a-table 
          :data-source="data" 
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
              <div class="group-name-cell">
                <div :class="['group-badge', record.enable === 1 ? 'status-active' : 'status-inactive']"></div>
                <span class="group-name-text">{{ record.name }}</span>
              </div>
            </template>

            <template v-if="column.key === 'users'">
              <div class="tag-container">
                <a-tag 
                  v-for="user in record.users" 
                  :key="user.id" 
                  class="tech-tag user-tag"
                >
                  {{ user.real_name || user.username }}
                </a-tag>
                <span v-if="!record.users?.length" class="empty-text">无成员</span>
              </div>
            </template>

            <template v-if="column.key === 'shift_info'">
              <div class="config-info">
                <div class="config-item">
                  <span class="config-label">周期:</span>
                  <span class="config-value">{{ record.shift_days }}天</span>
                </div>
                <div class="config-item">
                  <span class="config-label">成员:</span>
                  <span class="config-value">{{ record.users?.length || 0 }}人</span>
                </div>
              </div>
            </template>

            <template v-if="column.key === 'duty_status'">
              <div class="duty-status-container">
                <div class="today-duty" v-if="record.today_duty_user">
                  <a-avatar 
                    size="small" 
                    :style="{ backgroundColor: getAvatarColor(record.today_duty_user.real_name || record.today_duty_user.username) }"
                  >
                    {{ getInitials(record.today_duty_user.real_name || record.today_duty_user.username) }}
                  </a-avatar>
                  <span class="duty-user-name">{{ record.today_duty_user.real_name || record.today_duty_user.username }}</span>
                  <a-tag color="green" size="small">今日值班</a-tag>
                </div>
                <span v-else class="no-duty">暂无值班</span>
              </div>
            </template>

            <template v-if="column.key === 'enable'">
              <a-switch 
                :checked="record.enable === 1" 
                @change="(checked: boolean) => handleEnableChange(record, checked)"
                :loading="record.statusLoading"
              />
            </template>

            <template v-if="column.key === 'creator'">
              <div class="creator-info">
                <a-avatar 
                  size="small" 
                  :style="{ backgroundColor: getAvatarColor(record.create_user_name || '') }"
                >
                  {{ getInitials(record.create_user_name || '') }}
                </a-avatar>
                <span class="creator-name">{{ record.create_user_name || '未知' }}</span>
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
                <a-button type="primary" size="small" @click="handleViewDetail(record)">
                  查看
                </a-button>
                <a-button type="default" size="small" @click="handleViewFuturePlan(record)">
                  排班计划
                </a-button>
                <a-dropdown>
                  <template #overlay>
                    <a-menu @click="(e: any) => handleMenuClick(e.key, record)">
                      <a-menu-item key="edit">
                        <Icon icon="carbon:edit" /> 编辑
                      </a-menu-item>
                      <a-menu-item key="history">
                        <Icon icon="carbon:time" /> 值班历史
                      </a-menu-item>
                      <a-menu-item key="change">
                        <Icon icon="carbon:change-catalog" /> 调班记录
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

    <!-- 新增值班组模态框 -->
    <a-modal 
      :open="isAddModalVisible" 
      title="新增值班组" 
      :width="formDialogWidth" 
      @ok="handleAdd" 
      @cancel="closeAddModal"
      :destroy-on-close="true" 
      class="responsive-modal on-duty-group-modal"
      :confirmLoading="loading"
    >
      <a-form ref="addFormRef" :model="addForm" :rules="formRules" layout="vertical">
        <div class="form-section">
          <div class="section-title">基本信息</div>
          <a-row :gutter="16">
            <a-col :span="24">
              <a-form-item label="值班组名称" name="name">
                <a-input v-model:value="addForm.name" placeholder="请输入值班组名称" />
              </a-form-item>
            </a-col>
          </a-row>
          <a-row :gutter="16">
            <a-col :span="24">
              <a-form-item label="轮班周期（天）" name="shift_days">
                <a-input-number 
                  v-model:value="addForm.shift_days" 
                  :min="1" 
                  :max="365" 
                  class="full-width" 
                />
              </a-form-item>
            </a-col>
          </a-row>
          <a-row :gutter="16">
            <a-col :span="24">
              <a-form-item label="描述" name="description">
                <a-textarea 
                  v-model:value="addForm.description" 
                  placeholder="请输入值班组描述（可选）" 
                  :rows="3"
                />
              </a-form-item>
            </a-col>
          </a-row>
        </div>

        <div class="form-section">
          <div class="section-title">值班人员</div>
          <a-row :gutter="16">
            <a-col :span="24">
              <a-form-item label="值班成员" name="user_ids">
                <a-select 
                  mode="multiple" 
                  v-model:value="addForm.user_ids" 
                  placeholder="请搜索并选择值班成员" 
                  style="width: 100%"
                  :maxTagCount="3" 
                  :options="userOptions" 
                  :loading="usersLoading"
                  @popupScroll="handleUserSelectScroll" 
                  @search="handleUserSearch" 
                  show-search
                  :filter-option="false"
                  allow-clear
                />
              </a-form-item>
            </a-col>
          </a-row>
        </div>
      </a-form>
    </a-modal>

    <!-- 编辑值班组模态框 -->
    <a-modal 
      :open="isEditModalVisible" 
      title="编辑值班组" 
      :width="formDialogWidth" 
      @ok="handleUpdate"
      @cancel="closeEditModal" 
      :destroy-on-close="true" 
      class="responsive-modal on-duty-group-modal"
      :confirmLoading="loading"
    >
      <a-form ref="editFormRef" :model="editForm" :rules="formRules" layout="vertical">
        <div class="form-section">
          <div class="section-title">基本信息</div>
          <a-row :gutter="16">
            <a-col :span="24">
              <a-form-item label="值班组名称" name="name">
                <a-input v-model:value="editForm.name" placeholder="请输入值班组名称" />
              </a-form-item>
            </a-col>
          </a-row>
          <a-row :gutter="16">
            <a-col :span="12">
              <a-form-item label="轮班周期（天）" name="shift_days">
                <a-input-number 
                  v-model:value="editForm.shift_days" 
                  :min="1" 
                  :max="365" 
                  class="full-width" 
                />
              </a-form-item>
            </a-col>
            <a-col :span="12">
              <a-form-item label="状态" name="enable">
                <a-select 
                  v-model:value="editForm.enable" 
                  placeholder="请选择状态" 
                  style="width: 100%"
                >
                  <a-select-option :value="1">启用</a-select-option>
                  <a-select-option :value="2">禁用</a-select-option>
                </a-select>
              </a-form-item>
            </a-col>
          </a-row>
          <a-row :gutter="16">
            <a-col :span="24">
              <a-form-item label="描述" name="description">
                <a-textarea 
                  v-model:value="editForm.description" 
                  placeholder="请输入值班组描述（可选）" 
                  :rows="3"
                />
              </a-form-item>
            </a-col>
          </a-row>
        </div>

        <div class="form-section">
          <div class="section-title">值班人员</div>
          <a-row :gutter="16">
            <a-col :span="24">
              <a-form-item label="值班成员" name="user_ids">
                <a-select 
                  mode="multiple" 
                  v-model:value="editForm.user_ids" 
                  placeholder="请搜索并选择值班成员" 
                  style="width: 100%"
                  :maxTagCount="3" 
                  :options="userOptions" 
                  :loading="usersLoading"
                  @popupScroll="handleUserSelectScroll" 
                  @search="handleUserSearch" 
                  show-search
                  :filter-option="false"
                  allow-clear
                />
              </a-form-item>
            </a-col>
          </a-row>
        </div>
      </a-form>
    </a-modal>

    <!-- 详情对话框 -->
    <a-modal 
      :open="detailDialogVisible" 
      title="值班组详情" 
      :width="previewDialogWidth" 
      :footer="null"
      @cancel="closeDetailDialog" 
      class="detail-dialog"
    >
      <div v-if="detailDialog.data" class="group-details">
        <div class="detail-header">
          <h2>{{ detailDialog.data.name }}</h2>
          <div class="detail-badges">
            <a-tag :color="detailDialog.data.enable ? 'green' : 'red'">
              {{ detailDialog.data.enable ? '启用' : '禁用' }}
            </a-tag>
            <a-tag color="blue">
              {{ detailDialog.data.shift_days }}天轮班
            </a-tag>
            <a-tag color="green">
              {{ detailDialog.data.users?.length || 0 }}名成员
            </a-tag>
          </div>
        </div>

        <a-descriptions bordered :column="1" :labelStyle="{ width: '150px' }">
          <a-descriptions-item label="ID">{{ detailDialog.data.id }}</a-descriptions-item>
          <a-descriptions-item label="值班组名称">{{ detailDialog.data.name }}</a-descriptions-item>
          <a-descriptions-item label="轮班周期">{{ detailDialog.data.shift_days }}天</a-descriptions-item>
          <a-descriptions-item label="状态">
            <a-tag :color="detailDialog.data.enable ? 'green' : 'red'">
              {{ detailDialog.data.enable ? '启用' : '禁用' }}
            </a-tag>
          </a-descriptions-item>
          <a-descriptions-item label="描述">
            {{ detailDialog.data.description || '无描述' }}
          </a-descriptions-item>
          <a-descriptions-item label="成员数量">{{ detailDialog.data.users?.length || 0 }}人</a-descriptions-item>
          <a-descriptions-item label="成员列表">
            <div class="tag-container">
              <a-tag 
                v-for="user in detailDialog.data.users" 
                :key="user.id" 
                class="tech-tag user-tag"
              >
                {{ user.real_name || user.username }}
              </a-tag>
              <span v-if="!detailDialog.data.users?.length" class="empty-text">无成员</span>
            </div>
          </a-descriptions-item>
          <a-descriptions-item label="今日值班">
            <div v-if="detailDialog.data.today_duty_user" class="duty-user-info">
              <a-avatar 
                size="small" 
                :style="{ backgroundColor: getAvatarColor(detailDialog.data.today_duty_user.real_name || detailDialog.data.today_duty_user.username) }"
              >
                {{ getInitials(detailDialog.data.today_duty_user.real_name || detailDialog.data.today_duty_user.username) }}
              </a-avatar>
              <span>{{ detailDialog.data.today_duty_user.real_name || detailDialog.data.today_duty_user.username }}</span>
            </div>
            <span v-else>暂无</span>
          </a-descriptions-item>
          <a-descriptions-item label="创建人">{{ detailDialog.data.create_user_name }}</a-descriptions-item>
          <a-descriptions-item label="创建时间">
            {{ formatFullDateTime(detailDialog.data.created_at) }}
          </a-descriptions-item>
          <a-descriptions-item label="更新时间">
            {{ formatFullDateTime(detailDialog.data.updated_at) }}
          </a-descriptions-item>
        </a-descriptions>

        <div class="detail-footer">
          <a-button @click="closeDetailDialog">关闭</a-button>
          <a-button type="primary" @click="handleEditFromDetail">编辑</a-button>
          <a-button type="default" @click="handleViewFuturePlanFromDetail">查看排班计划</a-button>
          <a-button type="default" @click="handleViewHistoryFromDetail">值班历史</a-button>
        </div>
      </div>
    </a-modal>

    <!-- 未来排班计划对话框 -->
    <a-modal 
      :open="futurePlanDialogVisible" 
      title="未来排班计划" 
      :width="previewDialogWidth" 
      :footer="null"
      @cancel="closeFuturePlanDialog" 
      class="detail-dialog future-plan-dialog"
    >
      <a-spin :spinning="futurePlanDialog.loading">
        <div v-if="futurePlanDialog.data" class="future-plan-content">
          <div class="plan-header">
            <h3>{{ futurePlanDialog.groupName }} - 未来排班计划</h3>
            <div class="plan-info">
              <a-tag color="blue">计划时长: {{ futurePlanDialog.data.details?.length || 0 }}天</a-tag>
              <a-tag color="green">轮班周期: {{ futurePlanDialog.shiftDays }}天</a-tag>
            </div>
          </div>

          <div class="plan-filters">
            <a-date-picker 
              v-model:value="planDateFilter" 
              placeholder="选择日期筛选" 
              @change="handlePlanDateChange"
              style="margin-right: 12px;" 
            />
            <a-select 
              v-model:value="planUserFilter" 
              placeholder="选择用户筛选" 
              style="width: 150px; margin-right: 12px;"
              allow-clear 
              @change="handlePlanUserChange" 
              :options="planUserOptions"
              show-search 
              :filter-option="filterOption"
            />
            <a-button @click="resetPlanFilters">重置筛选</a-button>
          </div>

          <div class="plan-timeline">
            <a-timeline mode="left">
              <a-timeline-item 
                v-for="(plan, index) in filteredFuturePlans" 
                :key="index"
                :color="getPlanTimelineColor(plan.date, index)"
              >
                <template #label>
                  <div class="timeline-date">
                    <div class="date-main">{{ formatPlanDate(plan.date) }}</div>
                    <div class="date-sub">{{ formatPlanWeekday(plan.date) }}</div>
                  </div>
                </template>
                <div class="timeline-content">
                  <div class="duty-user">
                    <a-avatar 
                      size="small" 
                      :style="{ backgroundColor: getAvatarColor(plan.user?.username || '') }"
                    >
                      {{ getInitials(plan.user?.username || '') }}
                    </a-avatar>
                    <span class="user-name">{{ plan.user?.username || '未指定' }}</span>
                    <a-tag v-if="isToday(plan.date)" color="red" class="today-tag">
                      今日
                    </a-tag>
                    <a-tag v-else-if="isTomorrow(plan.date)" color="orange" class="tomorrow-tag">
                      明日
                    </a-tag>
                  </div>
                  <div class="duty-details">
                    <span class="duty-type">正常值班</span>
                    <span class="cycle-info">第{{ getCycleDay(index) }}天</span>
                  </div>
                </div>
              </a-timeline-item>
            </a-timeline>

            <!-- 分页 -->
            <div 
              class="pagination-container"
              v-if="futurePlanDialog.data?.details && futurePlanDialog.data.details.length > planPaginationConfig.pageSize"
            >
              <a-pagination 
                v-model:current="planPaginationConfig.current" 
                :pageSize="planPaginationConfig.pageSize"
                :total="planPaginationConfig.total" 
                :showSizeChanger="true" 
                :pageSizeOptions="['10', '15', '30', '50']"
                @change="handlePlanPaginationChange" 
                @showSizeChange="handlePlanPaginationChange" 
              />
            </div>
          </div>

          <div class="plan-summary">
            <a-statistic-group>
              <a-statistic 
                title="总计划天数" 
                :value="futurePlanDialog.data.details?.length || 0" 
                suffix="天" 
              />
              <a-statistic 
                title="参与人数" 
                :value="futurePlanDialog.availableUsers.length" 
                suffix="人" 
              />
              <a-statistic 
                title="轮班周期" 
                :value="futurePlanDialog.shiftDays" 
                suffix="天" 
              />
            </a-statistic-group>
          </div>

          <div class="detail-footer">
            <a-button @click="closeFuturePlanDialog">关闭</a-button>
            <a-button type="primary" @click="exportPlan">导出计划</a-button>
            <a-button type="default" @click="handleCreatePlanFromDialog">创建排班计划</a-button>
          </div>
        </div>
        <div v-else class="empty-state">
          <Icon icon="carbon:calendar" class="empty-icon" />
          <div class="empty-title">暂无排班计划</div>
          <div class="empty-description">该值班组尚未生成未来排班计划</div>
          <a-button type="primary" @click="handleCreatePlanFromDialog">
            <Icon icon="carbon:add" />
            创建排班计划
          </a-button>
        </div>
      </a-spin>
    </a-modal>

    <!-- 值班历史对话框 -->
    <a-modal 
      :open="historyDialogVisible" 
      title="值班历史" 
      :width="previewDialogWidth" 
      :footer="null"
      @cancel="closeHistoryDialog" 
      class="detail-dialog history-dialog"
    >
      <a-spin :spinning="historyDialog.loading">
        <div v-if="historyDialog.data && historyDialog.data.length > 0" class="history-content">
          <div class="history-header">
            <h3>{{ historyDialog.groupName }} - 值班历史</h3>
            <div class="history-info">
              <a-tag color="blue">历史记录: {{ historyDialog.data.length || 0 }}条</a-tag>
            </div>
          </div>

          <div class="history-filters">
            <a-range-picker 
              v-model:value="historyDateRange" 
              placeholder="选择日期范围" 
              @change="handleHistoryDateChange"
              style="margin-right: 12px;" 
            />
            <a-button @click="resetHistoryFilters">重置筛选</a-button>
          </div>

          <div class="history-table">
            <a-table 
              :data-source="historyDialog.data" 
              :columns="historyColumns" 
              :pagination="false"
              :loading="historyDialog.loading" 
              row-key="id"
              size="small"
            >
              <template #bodyCell="{ column, record }">
                <template v-if="column.key === 'id'">
                  <span class="record-id">#{{ record.id }}</span>
                </template>
                <template v-if="column.key === 'date'">
                  <div class="date-info">
                    <span class="date">{{ record.date_string }}</span>
                    <span class="weekday">{{ formatPlanWeekday(record.date_string) }}</span>
                  </div>
                </template>
                <template v-if="column.key === 'users'">
                  <div class="user-change-info">
                    <div class="user-item">
                      <span class="label">原值班:</span>
                      <span class="user-id">ID {{ record.origin_user_id }}</span>
                    </div>
                    <Icon icon="carbon:arrow-right" style="margin: 0 8px;" />
                    <div class="user-item">
                      <span class="label">实际值班:</span>
                      <span class="user-id">ID {{ record.on_duty_user_id }}</span>
                    </div>
                    <a-tag v-if="record.origin_user_id !== record.on_duty_user_id" color="orange" size="small" class="changed-tag">
                      已调班
                    </a-tag>
                  </div>
                </template>
                <template v-if="column.key === 'created_at'">
                  <div class="date-info">
                    <span class="date">{{ formatDate(record.created_at) }}</span>
                    <span class="time">{{ formatTime(record.created_at) }}</span>
                  </div>
                </template>
              </template>
              <template #emptyText>
                <div class="empty-state table-empty">
                  <Icon icon="carbon:time" class="empty-icon" />
                  <div class="empty-title">暂无值班历史</div>
                  <div class="empty-description">该值班组尚未有值班历史记录</div>
                </div>
              </template>
            </a-table>
          </div>

          <div class="detail-footer">
            <div class="footer-left">
              <a-button @click="closeHistoryDialog">关闭</a-button>
              <a-button type="primary" @click="exportHistory">导出历史</a-button>
            </div>
            <div class="footer-right">
              <a-pagination 
                v-model:current="historyPaginationConfig.current" 
                :total="historyPaginationConfig.total"
                :pageSize="historyPaginationConfig.pageSize"
                :showTotal="historyPaginationConfig.showTotal"
                @change="handleHistoryPageChange"
                size="small"
              />
            </div>
          </div>
        </div>
        <div v-else class="empty-state">
          <Icon icon="carbon:time" class="empty-icon" />
          <div class="empty-title">暂无值班历史</div>
          <div class="empty-description">该值班组尚未有值班历史记录</div>
        </div>
      </a-spin>
    </a-modal>

    <!-- 调班记录对话框 -->
    <a-modal 
      :open="changeDialogVisible" 
      title="调班记录" 
      :width="previewDialogWidth" 
      :footer="null"
      @cancel="closeChangeDialog" 
      class="detail-dialog change-dialog"
    >
      <a-spin :spinning="changeDialog.loading">
        <div class="change-content">
          <div class="change-header">
            <h3>{{ changeDialog.groupName }} - 调班记录</h3>
            <a-button type="primary" @click="showCreateChangeModal">
              <PlusOutlined /> 新增调班
            </a-button>
          </div>

          <a-table 
            :data-source="changeDialog.data" 
            :columns="changeColumns" 
            :pagination="changePaginationConfig"
            :loading="changeDialog.loading" 
            row-key="id"
            size="small"
            @change="handleChangeTableChange"
          >
            <template #bodyCell="{ column, record }">
              <template v-if="column.key === 'id'">
                <span class="record-id">#{{ record.id }}</span>
              </template>
              <template v-if="column.key === 'date'">
                <div class="date-info">
                  <span class="date">{{ record.date }}</span>
                  <span class="weekday">{{ formatPlanWeekday(record.date) }}</span>
                </div>
              </template>
              <template v-if="column.key === 'users'">
                <div class="user-change-info">
                  <div class="user-item">
                    <span class="label">原值班:</span>
                    <span class="user-id">ID {{ record.origin_user_id }}</span>
                  </div>
                  <Icon icon="carbon:arrow-right" style="margin: 0 8px;" />
                  <div class="user-item">
                    <span class="label">调班后:</span>
                    <span class="user-id">ID {{ record.on_duty_user_id }}</span>
                  </div>
                </div>
              </template>
              <template v-if="column.key === 'reason'">
                <span class="reason-text">{{ record.reason || '无' }}</span>
              </template>
              <template v-if="column.key === 'creator'">
                <div class="creator-info">
                  <a-avatar 
                    size="small" 
                    :style="{ backgroundColor: getAvatarColor(record.create_user_name || '') }"
                  >
                    {{ getInitials(record.create_user_name || '') }}
                  </a-avatar>
                  <span class="creator-name">{{ record.create_user_name || '未知' }}</span>
                </div>
              </template>
              <template v-if="column.key === 'created_at'">
                <div class="date-info">
                  <span class="date">{{ formatDate(record.created_at) }}</span>
                  <span class="time">{{ formatTime(record.created_at) }}</span>
                </div>
              </template>
            </template>
            <template #emptyText>
              <div class="empty-state table-empty">
                <Icon icon="carbon:document" class="empty-icon" />
                <div class="empty-title">暂无调班记录</div>
                <div class="empty-description">该值班组尚未有调班记录</div>
              </div>
            </template>
          </a-table>

          <div class="detail-footer">
            <a-button @click="closeChangeDialog">关闭</a-button>
            <a-button 
              v-if="changePaginationConfig.total > changeDialog.data.length" 
              type="primary" 
              @click="loadMoreChangeRecords"
              :loading="changeDialog.loading"
            >
              加载更多
            </a-button>
          </div>
        </div>
      </a-spin>
    </a-modal>

    <!-- 新增调班记录模态框 -->
    <a-modal 
      :open="isCreateChangeModalVisible" 
      title="新增调班记录" 
      :width="formDialogWidth" 
      @ok="handleCreateChange" 
      @cancel="closeCreateChangeModal"
      :destroy-on-close="true" 
      class="responsive-modal"
      :confirmLoading="loading"
    >
      <a-form ref="createChangeFormRef" :model="createChangeForm" :rules="changeFormRules" layout="vertical">
        <a-form-item label="调班日期" name="date">
          <a-date-picker 
            v-model:value="createChangeForm.date" 
            placeholder="请选择调班日期" 
            style="width: 100%"
            @change="handleChangeDateSelect"
          />
        </a-form-item>
        <a-form-item label="原值班人员" name="origin_user_id">
          <a-select 
            v-model:value="createChangeForm.origin_user_id" 
            placeholder="请选择原值班人员" 
            style="width: 100%"
            :options="changeUserOptions" 
            :loading="changeUsersLoading"
            @popupScroll="handleChangeUserSelectScroll" 
            @search="handleChangeUserSearch" 
            show-search
            :filter-option="false"
            allow-clear
          />
        </a-form-item>
        <a-form-item label="调班后人员" name="on_duty_user_id">
          <a-select 
            v-model:value="createChangeForm.on_duty_user_id" 
            placeholder="请选择调班后人员" 
            style="width: 100%"
            :options="changeUserOptions" 
            :loading="changeUsersLoading"
            @popupScroll="handleChangeUserSelectScroll" 
            @search="handleChangeUserSearch" 
            show-search
            :filter-option="false"
            allow-clear
          />
        </a-form-item>
        <a-form-item label="调班原因" name="reason">
          <a-textarea 
            v-model:value="createChangeForm.reason" 
            placeholder="请输入调班原因（可选）" 
            :rows="3"
          />
        </a-form-item>
      </a-form>
    </a-modal>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted, computed } from 'vue';
import { message, Modal } from 'ant-design-vue';
import { PlusOutlined, DownOutlined } from '@ant-design/icons-vue';
import { Icon } from '@iconify/vue';
import { useRouter } from 'vue-router';
import {
  getMonitorOnDutyGroupListApi,
  createMonitorOnDutyGroupApi,
  updateMonitorOnDutyGroupApi,
  deleteMonitorOnDutyGroupApi,
  getMonitorOnDutyGroupDetailApi,
  getMonitorOnDutyGroupFuturePlanApi,
  getMonitorOnDutyHistoryApi,
  createMonitorOnDutyGroupChangeApi,
  getMonitorOnDutyGroupChangeListApi,
  type MonitorOnDutyGroup,
  type CreateMonitorOnDutyGroupReq,
  type UpdateMonitorOnDutyGroupReq,
  type MonitorOnDutyHistory,
  type MonitorOnDutyChange,
  type CreateMonitorOnDutyGroupChangeReq,
  type GetMonitorOnDutyHistoryReq,
  type GetMonitorOnDutyGroupListReq,
  type GetMonitorOnDutyGroupChangeListReq,
} from '#/api/core/prometheus/prometheus_onduty';
import dayjs, { type Dayjs } from 'dayjs';
import { getUserList, type GetUserListReq } from '#/api/core/system/user';

const router = useRouter();

// 用户接口类型
interface User {
  id: number;
  username: string;
  real_name?: string;
}

// 响应式对话框宽度
const formDialogWidth = computed(() => {
  if (typeof window !== 'undefined') {
    const width = window.innerWidth;
    if (width < 768) return '95%';
    if (width < 1024) return '90%';
    return '700px';
  }
  return '700px';
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

// 列定义
const columns = [
  { title: 'ID', dataIndex: 'id', key: 'id', width: 80, fixed: 'left' },
  { title: '值班组名称', dataIndex: 'name', key: 'name', width: 200 },
  { title: '值班信息', dataIndex: 'shift_info', key: 'shift_info', width: 150 },
  { title: '成员列表', dataIndex: 'users', key: 'users', width: 200 },
  { title: '值班状态', dataIndex: 'duty_status', key: 'duty_status', width: 200 },
  { title: '启用状态', dataIndex: 'enable', key: 'enable', width: 100 },
  { title: '创建人', dataIndex: 'create_user_name', key: 'creator', width: 120 },
  { title: '创建时间', dataIndex: 'created_at', key: 'createdAt', width: 180 },
  { title: '操作', key: 'action', width: 240, align: 'center' as const, fixed: 'right' }
];

// 调班记录列定义
const changeColumns = [
  { title: 'ID', dataIndex: 'id', key: 'id', width: 80 },
  { title: '日期', dataIndex: 'date', key: 'date', width: 120 },
  { title: '人员变更', dataIndex: 'users', key: 'users', width: 250 },
  { title: '调班原因', dataIndex: 'reason', key: 'reason', width: 200 },
  { title: '创建人', dataIndex: 'create_user_name', key: 'creator', width: 150 },
  { title: '创建时间', dataIndex: 'created_at', key: 'created_at', width: 180 }
];

// 值班历史列定义
const historyColumns = [
  { title: 'ID', dataIndex: 'id', key: 'id', width: 80 },
  { title: '日期', dataIndex: 'date_string', key: 'date', width: 120 },
  { title: '人员信息', dataIndex: 'users', key: 'users', width: 300 },
  { title: '记录时间', dataIndex: 'created_at', key: 'created_at', width: 180 }
];

// 状态数据
const data = ref<MonitorOnDutyGroup[]>([]);
const searchText = ref('');
const enableFilter = ref<1 | 2 | undefined>(undefined);
const loading = ref(false);
const addFormRef = ref();
const editFormRef = ref();
const createChangeFormRef = ref();

// 防抖处理
let searchTimeout: any = null;

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

// 用户选择相关状态
const userOptions = ref<{ value: number, label: string }[]>([]);
const usersLoading = ref(false);
const userSearchText = ref('');

// 用户列表分页配置
const userPaginationConfig = reactive({
  current: 1,
  pageSize: 20,
  total: 0,
  hasMore: true
});

// 用户数据缓存
const userCache = ref<Map<number, string>>(new Map());

// 计划用户选择相关状态
const planUserOptions = ref<{ value: string, label: string }[]>([]);

// 排班计划分页配置
const planPaginationConfig = reactive({
  current: 1,
  pageSize: 15,
  total: 0,
  showSizeChanger: true,
  showTotal: (total: number) => `共 ${total} 条记录`,
});

// 统计数据
const stats = reactive({
  total: 0,
  activeusers: 0,
  avgShiftDays: 0,
  todayOnDuty: 0
});

// 对话框状态
const isAddModalVisible = ref(false);
const isEditModalVisible = ref(false);
const detailDialogVisible = ref(false);
const futurePlanDialogVisible = ref(false);
const historyDialogVisible = ref(false);
const changeDialogVisible = ref(false);
const isCreateChangeModalVisible = ref(false);

// 表单数据
const addForm = reactive<CreateMonitorOnDutyGroupReq>({
  name: '',
  user_ids: [],
  shift_days: 7,
  description: ''
});

const editForm = reactive<UpdateMonitorOnDutyGroupReq>({
  id: 0,
  name: '',
  shift_days: 7,
  user_ids: [],
  description: '',
  enable: 1
});

const createChangeForm = reactive<{
  on_duty_group_id: number;
  date: Dayjs | null;
  origin_user_id: number | null;
  on_duty_user_id: number | null;
  reason: string;
}>({
  on_duty_group_id: 0,
  date: null,
  origin_user_id: null,
  on_duty_user_id: null,
  reason: ''
});

// 调班记录用户选择相关状态
const changeUserOptions = ref<{ value: number, label: string }[]>([]);
const changeUsersLoading = ref(false);
const changeUserSearchText = ref('');

// 详情对话框数据
const detailDialog = reactive({
  data: null as MonitorOnDutyGroup | null
});

// 未来排班计划对话框数据
const futurePlanDialog = reactive({
  data: null as any | null,
  groupId: 0,
  groupName: '',
  shiftDays: 0,
  availableUsers: [] as string[],
  loading: false
});

// 值班历史对话框数据
const historyDialog = reactive({
  data: [] as MonitorOnDutyHistory[],
  groupId: 0,
  groupName: '',
  loading: false
});

// 值班历史分页配置
const historyPaginationConfig = reactive({
  current: 1,
  pageSize: 10,
  total: 0,
  showSizeChanger: true,
  showQuickJumper: true,
  showTotal: (total: number) => `共 ${total} 条记录`
});

// 调班记录对话框数据
const changeDialog = reactive({
  data: [] as MonitorOnDutyChange[],
  groupId: 0,
  groupName: '',
  loading: false
});

// 调班记录分页配置
const changePaginationConfig = reactive({
  current: 1,
  pageSize: 10,
  total: 0,
  showSizeChanger: true,
  showQuickJumper: true,
  showTotal: (total: number) => `共 ${total} 条记录`
});

// 排班计划筛选
const planDateFilter = ref<Dayjs | null>(null);
const planUserFilter = ref('');

// 值班历史筛选
const historyDateRange = ref<[Dayjs, Dayjs] | null>(null);

// 表单验证规则
const formRules = {
  name: [
    { required: true, message: '请输入值班组名称', trigger: 'blur' },
    { min: 2, max: 50, message: '长度应为2到50个字符', trigger: 'blur' }
  ],
  shift_days: [
    { required: true, message: '请输入轮班周期', trigger: 'blur' }
  ],
  user_ids: [
    { required: true, message: '请选择至少一个值班成员', trigger: 'change' }
  ]
};

const changeFormRules = {
  date: [
    { required: true, message: '请选择调班日期', trigger: 'change' }
  ],
  origin_user_id: [
    { required: true, message: '请选择原值班人员', trigger: 'change' }
  ],
  on_duty_user_id: [
    { required: true, message: '请选择调班后人员', trigger: 'change' }
  ]
};

// 计算属性 - 筛选后的未来排班
const filteredFuturePlans = computed(() => {
  if (!futurePlanDialog.data?.details) return [];

  let plans = [...futurePlanDialog.data.details];

  // 按日期筛选
  if (planDateFilter.value) {
    const filterDate = dayjs(planDateFilter.value).format('YYYY-MM-DD');
    plans = plans.filter((plan: any) => plan.date === filterDate);
  }

  // 按用户筛选
  if (planUserFilter.value) {
    plans = plans.filter((plan: any) => plan.user?.username === planUserFilter.value);
  }

  // 更新计划分页总数
  planPaginationConfig.total = plans.length;

  // 应用分页
  const startIndex = (planPaginationConfig.current - 1) * planPaginationConfig.pageSize;
  const endIndex = startIndex + planPaginationConfig.pageSize;
  return plans.slice(startIndex, endIndex);
});

const getAvatarColor = (name: string): string => {
  const colors = ['#1890ff', '#52c41a', '#faad14', '#f5222d', '#722ed1', '#13c2c2', '#eb2f96', '#fa8c16'];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length]!;
};

const getInitials = (name: string): string => {
  if (!name) return '';
  return name.slice(0, 2).toUpperCase();
};

const formatDate = (timestamp: string | number): string => {
  if (!timestamp) return '';
  // 如果是字符串，直接解析；如果是数字，按Unix时间戳处理
  const date = typeof timestamp === 'string' ? dayjs(timestamp) : dayjs(timestamp * 1000);
  return date.format('YYYY-MM-DD');
};

const formatTime = (timestamp: string | number): string => {
  if (!timestamp) return '';
  // 如果是字符串，直接解析；如果是数字，按Unix时间戳处理
  const date = typeof timestamp === 'string' ? dayjs(timestamp) : dayjs(timestamp * 1000);
  return date.format('HH:mm');
};

const formatFullDateTime = (timestamp: string | number): string => {
  if (!timestamp) return '';
  // 如果是字符串，直接解析；如果是数字，按Unix时间戳处理
  const date = typeof timestamp === 'string' ? dayjs(timestamp) : dayjs(timestamp * 1000);
  return date.format('YYYY-MM-DD HH:mm:ss');
};

const formatPlanDate = (date: string): string => {
  return dayjs(date).format('MM-DD');
};

const formatPlanWeekday = (date: string): string => {
  if (!date) return '';
  const weekdays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
  return weekdays[dayjs(date).day()] || '';
};

const isToday = (date: string): boolean => {
  return dayjs(date).isSame(dayjs(), 'day');
};

const isTomorrow = (date: string): boolean => {
  return dayjs(date).isSame(dayjs().add(1, 'day'), 'day');
};

const getPlanTimelineColor = (date: string, index: number): string => {
  if (isToday(date)) return 'red';
  if (isTomorrow(date)) return 'orange';
  return index % 2 === 0 ? 'blue' : 'green';
};

const getHistoryTimelineColor = (index: number): string => {
  return index % 2 === 0 ? 'blue' : 'green';
};

const getCycleDay = (index: number): number => {
  return (index % futurePlanDialog.shiftDays) + 1;
};

const filterOption = (input: string, option: any) => {
  return option.value.toLowerCase().indexOf(input.toLowerCase()) >= 0;
};

const filterUserOption = (input: string, option: any) => {
  return option.label.toLowerCase().indexOf(input.toLowerCase()) >= 0;
};

// 更新统计数据
const updateStats = (): void => {
  stats.total = paginationConfig.total;
  
  if (data.value.length > 0) {
    const currentPageActiveusers = data.value.reduce((total, item) => total + (item.users?.length || 0), 0);
    const currentPageAvgShiftDays = Math.round(data.value.reduce((sum, item) => sum + item.shift_days, 0) / data.value.length);
    const currentPageTodayOnDuty = data.value.filter(item => item.today_duty_user).length;
    
    const pageRatio = paginationConfig.total / data.value.length;
    stats.activeusers = Math.round(currentPageActiveusers * pageRatio);
    stats.avgShiftDays = currentPageAvgShiftDays;
    stats.todayOnDuty = Math.round(currentPageTodayOnDuty * pageRatio);
  } else {
    stats.activeusers = 0;
    stats.avgShiftDays = 0;
    stats.todayOnDuty = 0;
  }
};

// 数据加载
const fetchOnDutyGroups = async (): Promise<void> => {
  loading.value = true;
  try {
    const params: GetMonitorOnDutyGroupListReq = {
      page: paginationConfig.current,
      size: paginationConfig.pageSize,
      search: searchText.value.trim() || undefined,
      enable: enableFilter.value
    };

    const response = await getMonitorOnDutyGroupListApi(params);

    if (response && response.items) {
      data.value = response.items;
      paginationConfig.total = response.total || 0;
      updateStats();
    } else {
      data.value = [];
      paginationConfig.total = 0;
      updateStats();
      if (!response) {
        message.warning('获取值班组列表失败，请稍后重试');
      }
    }
  } catch (error: any) {

    message.error(error.message || '获取值班组列表失败');
    data.value = [];
    paginationConfig.total = 0;
    updateStats();
  } finally {
    loading.value = false;
  }
};

const fetchUserList = async (page = 1, search = ''): Promise<void> => {
  try {
    usersLoading.value = true;
    const req: GetUserListReq = {
      page,
      size: userPaginationConfig.pageSize,
      search: search || '',
    };
    const res = await getUserList(req);
    
    // 处理返回数据
    const items = res?.items || res?.list || res?.data || [];
    const total = res?.total || res?.count || 0;
    
    const newOptions = items.map((user: any) => {
      const userId = user.id || user.userId || user.user_id;
      const userName = user.real_name || user.username || user.realName || `用户${userId}`;
      
      // 缓存用户信息
      userCache.value.set(userId, userName);
      
      return {
        value: userId,
        label: userName,
      };
    });
    
    if (page === 1) {
      userOptions.value = newOptions;
    } else {
      const existingIds = new Set(userOptions.value.map(opt => opt.value));
      userOptions.value = [
        ...userOptions.value,
        ...newOptions.filter((opt: any) => !existingIds.has(opt.value)),
      ];
    }
    
    userPaginationConfig.total = total;
    userPaginationConfig.hasMore = page * userPaginationConfig.pageSize < total;
  } catch (error: any) {

    message.error(error.message || '获取用户列表失败');
  } finally {
    usersLoading.value = false;
  }
};

// 处理用户选择下拉框滚动
const handleUserSelectScroll = (e: any): void => {
  const { target } = e;
  if (target.scrollTop + target.offsetHeight >= target.scrollHeight - 20) {
    if (userPaginationConfig.hasMore && !usersLoading.value) {
      userPaginationConfig.current += 1;
      fetchUserList(userPaginationConfig.current, userSearchText.value);
    }
  }
};

// 处理用户搜索
const handleUserSearch = (value: string): void => {
  userSearchText.value = value;
  userPaginationConfig.current = 1;
  userPaginationConfig.hasMore = true;
  fetchUserList(1, value);
};

// 处理调班记录用户选择下拉框滚动
const handleChangeUserSelectScroll = (e: any): void => {
  const { target } = e;
  if (target.scrollTop + target.offsetHeight >= target.scrollHeight - 20) {
    if (userPaginationConfig.hasMore && !changeUsersLoading.value) {
      userPaginationConfig.current += 1;
      fetchUserList(userPaginationConfig.current, changeUserSearchText.value);
    }
  }
};

// 处理调班记录用户搜索
const handleChangeUserSearch = (value: string): void => {
  changeUserSearchText.value = value;
  userPaginationConfig.current = 1;
  userPaginationConfig.hasMore = true;
  fetchUserList(1, value);
};

// 获取值班组详情
const fetchOnDutyGroupDetail = async (id: number): Promise<void> => {
  try {
    const response = await getMonitorOnDutyGroupDetailApi(id);
    if (response) {
      detailDialog.data = response;
    } else {
      message.error('获取值班组详情失败');
    }
  } catch (error: any) {

    message.error(error.message || '获取值班组详情失败');
  }
};

// 获取未来排班计划
const fetchFuturePlan = async (id: number): Promise<void> => {
  try {
    const startTime = dayjs().format('YYYY-MM-DD');
    const endTime = dayjs().add(30, 'day').format('YYYY-MM-DD');

    futurePlanDialog.loading = true;
    const response = await getMonitorOnDutyGroupFuturePlanApi(id, {
      start_time: startTime,
      end_time: endTime
    });

    if (response) {
      futurePlanDialog.data = response;
      planPaginationConfig.total = response?.details?.length || 0;
      planPaginationConfig.current = 1;

      const uniqueUsers: string[] = [];
      if (response?.details) {
        response.details.forEach((item: any) => {
          if (item.user?.username && !uniqueUsers.includes(item.user.username)) {
            uniqueUsers.push(item.user.username);
          }
        });
      }

      futurePlanDialog.availableUsers = uniqueUsers;
      planUserOptions.value = uniqueUsers.map(user => ({
        value: user,
        label: user
      }));
    } else {
      message.error('获取未来排班计划失败');
      futurePlanDialog.data = null;
    }
  } catch (error: any) {

    message.error(error.message || '获取未来排班计划失败');
    futurePlanDialog.data = null;
  } finally {
    futurePlanDialog.loading = false;
  }
};

// 获取值班历史
const fetchOnDutyHistory = async (id: number, startDate?: string, endDate?: string, page = 1, append = false): Promise<void> => {
  try {
    historyDialog.loading = true;
    
    // 构建API请求参数
    const apiParams: {
      start_date?: string;
      end_date?: string;
      page?: number;
      size?: number;
    } = {
      page,
      size: historyPaginationConfig.pageSize
    };
    
    if (startDate) apiParams.start_date = startDate;
    if (endDate) apiParams.end_date = endDate;

    const response = await getMonitorOnDutyHistoryApi(id, apiParams);

    if (response && response.items) {
      if (append) {
        historyDialog.data = [...historyDialog.data, ...response.items];
      } else {
        historyDialog.data = response.items;
      }
      historyPaginationConfig.total = response.total || 0;
      historyPaginationConfig.current = page;
    } else {
      if (!append) {
        historyDialog.data = [];
      }
      historyPaginationConfig.total = 0;
      if (!response) {
        message.warning('获取值班历史失败，请稍后重试');
      }
    }
  } catch (error: any) {

    message.error(error.message || '获取值班历史失败');
    if (!append) {
      historyDialog.data = [];
    }
    historyPaginationConfig.total = 0;
  } finally {
    historyDialog.loading = false;
  }
};

// 获取调班记录
const fetchChangeRecords = async (page = 1, append = false): Promise<void> => {
  try {
    changeDialog.loading = true;
    const params: GetMonitorOnDutyGroupChangeListReq = {
      on_duty_group_id: changeDialog.groupId,
      page,
      size: changePaginationConfig.pageSize
    };

    const response = await getMonitorOnDutyGroupChangeListApi(changeDialog.groupId, {
      page,
      size: changePaginationConfig.pageSize
    });

    if (response && response.items) {
      if (append) {
        changeDialog.data = [...changeDialog.data, ...response.items];
      } else {
        changeDialog.data = response.items;
      }
      changePaginationConfig.total = response.total || 0;
    } else {
      if (!append) {
        changeDialog.data = [];
      }
      changePaginationConfig.total = 0;
      if (!response) {
        message.warning('获取调班记录失败，请稍后重试');
      }
    }
  } catch (error: any) {

    message.error(error.message || '获取调班记录失败');
    if (!append) {
      changeDialog.data = [];
    }
    changePaginationConfig.total = 0;
  } finally {
    changeDialog.loading = false;
  }
};

// 事件处理
const handleTableChange = (pagination: any): void => {
  paginationConfig.current = pagination.current;
  paginationConfig.pageSize = pagination.pageSize;
  fetchOnDutyGroups();
};

const handleChangeTableChange = (pagination: any): void => {
  changePaginationConfig.current = pagination.current;
  changePaginationConfig.pageSize = pagination.pageSize;
  fetchChangeRecords(pagination.current);
};

const handleSearch = (): void => {
  paginationConfig.current = 1;
  fetchOnDutyGroups();
};

const handleSearchChange = (): void => {
  if (searchTimeout) {
    clearTimeout(searchTimeout);
  }
  searchTimeout = setTimeout(() => {
    paginationConfig.current = 1;
    fetchOnDutyGroups();
  }, 500);
};

const handleEnableFilterChange = (): void => {
  paginationConfig.current = 1;
  fetchOnDutyGroups();
};

const handleReset = (): void => {
  searchText.value = '';
  enableFilter.value = undefined;
  paginationConfig.current = 1;
  fetchOnDutyGroups();
  message.success('过滤条件已重置');
};

const handleEnableChange = async (record: MonitorOnDutyGroup & { statusLoading?: boolean }, checked: boolean): Promise<void> => {
  try {
    record.statusLoading = true;

    // 如果users为空，尝试从data.value中找
    let userIds = record.users?.map(user => user.id);
    if (!userIds || userIds.length === 0) {
      const found = data.value.find(item => item.id === record.id);
      if (found && found.users && found.users.length > 0) {
        userIds = found.users.map(user => user.id);
      }
    }

    const payload: UpdateMonitorOnDutyGroupReq = {
      id: record.id,
      name: record.name,
      shift_days: record.shift_days,
      user_ids: userIds,
      enable: checked ? 1 : 2,
      description: record.description
    };

    const response = await updateMonitorOnDutyGroupApi(payload);

    if (response) {
      record.enable = checked ? 1 : 2;
      message.success(`值班组已${checked ? '启用' : '禁用'}`);
    } else {
      message.error(`${checked ? '启用' : '禁用'}值班组失败`);
    }
  } catch (error: any) {

    message.error(error.message || '更新值班组状态失败');
  } finally {
    if (record) {
      record.statusLoading = false;
    }
  }
};

// 查看详情
const handleViewDetail = async (record: MonitorOnDutyGroup): Promise<void> => {
  await fetchOnDutyGroupDetail(record.id);
  detailDialogVisible.value = true;
};

// 查看未来排班计划
const handleViewFuturePlan = async (record: MonitorOnDutyGroup): Promise<void> => {
  router.push({
    path: '/monitor_onduty_group_table',
    query: { id: record.id.toString() }
  });
};

// 查看值班历史
const handleViewHistory = async (record: MonitorOnDutyGroup): Promise<void> => {
  historyDialog.groupId = record.id;
  historyDialog.groupName = record.name;
  historyPaginationConfig.current = 1;
  await fetchOnDutyHistory(record.id, undefined, undefined, 1);
  historyDialogVisible.value = true;
};

// 从详情页面查看排班计划
const handleViewFuturePlanFromDetail = async (): Promise<void> => {
  if (detailDialog.data) {
    router.push({
      path: '/monitor_onduty_group_table',
      query: { id: detailDialog.data.id.toString() }
    });
  }
};

// 从详情页面查看历史
const handleViewHistoryFromDetail = async (): Promise<void> => {
  if (detailDialog.data) {
    historyDialog.groupId = detailDialog.data.id;
    historyDialog.groupName = detailDialog.data.name;
    historyPaginationConfig.current = 1;
    await fetchOnDutyHistory(detailDialog.data.id, undefined, undefined, 1);
    detailDialogVisible.value = false;
    historyDialogVisible.value = true;
  }
};

// 从详情页面编辑
const handleEditFromDetail = (): void => {
  if (detailDialog.data) {
    showEditModal(detailDialog.data);
    detailDialogVisible.value = false;
  }
};

// 排班计划筛选处理
const handlePlanDateChange = (): void => {
  planPaginationConfig.current = 1;
};

const handlePlanUserChange = (): void => {
  planPaginationConfig.current = 1;
};

const resetPlanFilters = (): void => {
  planDateFilter.value = null;
  planUserFilter.value = '';
  planPaginationConfig.current = 1;
  message.success('筛选条件已重置');
};

// 处理排班计划分页变化
const handlePlanPaginationChange = (current: number, pageSize: number): void => {
  planPaginationConfig.current = current;
  planPaginationConfig.pageSize = pageSize;
};

// 处理历史日期筛选
const handleHistoryDateChange = (dates: [Dayjs, Dayjs] | null): void => {
  if (dates && historyDialog.groupId) {
    const startDate = dates[0].format('YYYY-MM-DD');
    const endDate = dates[1].format('YYYY-MM-DD');
    historyPaginationConfig.current = 1;
    fetchOnDutyHistory(historyDialog.groupId, startDate, endDate, 1);
  }
};

const resetHistoryFilters = (): void => {
  historyDateRange.value = null;
  if (historyDialog.groupId) {
    historyPaginationConfig.current = 1;
    fetchOnDutyHistory(historyDialog.groupId, undefined, undefined, 1);
  }
  message.success('筛选条件已重置');
};

// 处理历史记录分页变化
const handleHistoryTableChange = (pagination: any): void => {
  historyPaginationConfig.current = pagination.current;
  historyPaginationConfig.pageSize = pagination.pageSize;
  const startDate = historyDateRange.value ? historyDateRange.value[0].format('YYYY-MM-DD') : undefined;
  const endDate = historyDateRange.value ? historyDateRange.value[1].format('YYYY-MM-DD') : undefined;
  fetchOnDutyHistory(historyDialog.groupId, startDate, endDate, pagination.current);
};

// 处理历史分页页码变化
const handleHistoryPageChange = (page: number): void => {
  historyPaginationConfig.current = page;
  const startDate = historyDateRange.value ? historyDateRange.value[0].format('YYYY-MM-DD') : undefined;
  const endDate = historyDateRange.value ? historyDateRange.value[1].format('YYYY-MM-DD') : undefined;
  fetchOnDutyHistory(historyDialog.groupId, startDate, endDate, page);
};

// 导出功能
const exportPlan = (): void => {
  if (!futurePlanDialog.data?.details) return;

  const headers = ['日期', '星期', '值班人员', '值班类型'];
  const csvContent = [
    headers.join(','),
    ...filteredFuturePlans.value.map((plan: any) => [
      plan.date,
      formatPlanWeekday(plan.date || ''),
      plan.user?.username || '未指定',
      '正常值班'
    ].join(','))
  ].join('\n');

  const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `${futurePlanDialog.groupName}_排班计划_${dayjs().format('YYYY-MM-DD')}.csv`;
  link.click();

  message.success('排班计划已导出');
};

const exportHistory = async (): Promise<void> => {
  if (!historyDialog.data.length) return;
  
  try {
    // 导出前获取所有历史记录
    historyDialog.loading = true;
    message.loading('正在准备导出数据...');
    
    // 获取所有历史记录
    const apiParams: {
      start_date?: string;
      end_date?: string;
      size?: number;
    } = {
      size: 1000 // 设置较大的size以获取尽可能多的记录
    };
    
    // 如果有日期范围筛选，添加到参数中
    if (historyDateRange.value) {
      apiParams.start_date = historyDateRange.value[0].format('YYYY-MM-DD');
      apiParams.end_date = historyDateRange.value[1].format('YYYY-MM-DD');
    }
    
    const response = await getMonitorOnDutyHistoryApi(historyDialog.groupId, apiParams);
    const exportData = response?.items || historyDialog.data;
    
    const headers = ['日期', '星期', '值班人员ID', '原值班人员ID', '创建时间'];
    const csvContent = [
      headers.join(','),
      ...exportData.map((history: MonitorOnDutyHistory) => [
        history.date_string,
        formatPlanWeekday(history.date_string),
        history.on_duty_user_id,
        history.origin_user_id,
        formatFullDateTime(history.created_at)
      ].join(','))
    ].join('\n');

    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${historyDialog.groupName}_值班历史_${dayjs().format('YYYY-MM-DD')}.csv`;
    link.click();

    message.success(`值班历史已导出 (${exportData.length}条记录)`);
  } catch (error: any) {

    message.error(error.message || '导出值班历史失败');
  } finally {
    historyDialog.loading = false;
  }
};

// 模态框控制
const showAddModal = (): void => {
  resetAddForm();
  userSearchText.value = '';
  userPaginationConfig.current = 1;
  fetchUserList(1);
  isAddModalVisible.value = true;
};

const resetAddForm = (): void => {
  if (addFormRef.value) {
    addFormRef.value.resetFields();
  }
  addForm.name = '';
  addForm.shift_days = 7;
  addForm.user_ids = [];
  addForm.description = '';
};

const closeAddModal = (): void => {
  resetAddForm();
  isAddModalVisible.value = false;
};

const showEditModal = (record: MonitorOnDutyGroup): void => {
  editForm.id = record.id;
  editForm.name = record.name;
  editForm.shift_days = record.shift_days;
  editForm.user_ids = record.users?.map(user => user.id) || [];
  editForm.description = record.description || '';
  editForm.enable = record.enable;
  
  userSearchText.value = '';
  userPaginationConfig.current = 1;
  fetchUserList(1).then(() => {
    if (record.users && record.users.length > 0) {
      record.users.forEach(user => {
        const exists = userOptions.value.some(option => option.value === user.id);
        if (!exists) {
          userOptions.value.unshift({
            value: user.id,
            label: user.username
          });
        }
      });
    }
  });
  
  isEditModalVisible.value = true;
};

const closeEditModal = (): void => {
  if (editFormRef.value) {
    editFormRef.value.resetFields();
  }
  isEditModalVisible.value = false;
};

const closeDetailDialog = (): void => {
  detailDialogVisible.value = false;
};

const closeFuturePlanDialog = (): void => {
  futurePlanDialogVisible.value = false;
  planDateFilter.value = null;
  planUserFilter.value = '';
};

const closeHistoryDialog = (): void => {
  historyDialogVisible.value = false;
  historyDateRange.value = null;
  historyDialog.data = [];
  historyPaginationConfig.current = 1;
};

const closeChangeDialog = (): void => {
  changeDialogVisible.value = false;
};

const showCreateChangeModal = (): void => {
  createChangeForm.on_duty_group_id = changeDialog.groupId;
  createChangeForm.date = null;
  createChangeForm.origin_user_id = null;
  createChangeForm.on_duty_user_id = null;
  createChangeForm.reason = '';
  
  // 加载用户列表
  changeUserSearchText.value = '';
  userPaginationConfig.current = 1;
  fetchUserList(1).then(() => {
    changeUserOptions.value = [...userOptions.value];
  });
  
  isCreateChangeModalVisible.value = true;
};

const closeCreateChangeModal = (): void => {
  if (createChangeFormRef.value) {
    createChangeFormRef.value.resetFields();
  }
  isCreateChangeModalVisible.value = false;
};

// CRUD操作
const handleAdd = async (): Promise<void> => {
  try {
    await addFormRef.value.validate();
    
    loading.value = true;
    const payload: CreateMonitorOnDutyGroupReq = {
      name: addForm.name.trim(),
      user_ids: addForm.user_ids,
      shift_days: addForm.shift_days,
      description: addForm.description?.trim()
    };

    const response = await createMonitorOnDutyGroupApi(payload);

    if (response) {
      message.success('新增值班组成功');
      paginationConfig.current = 1;
      await fetchOnDutyGroups();
      closeAddModal();
    } else {
      message.error('新增值班组失败');
    }
  } catch (error: any) {

    message.error(error.message || '新增值班组失败');
  } finally {
    loading.value = false;
  }
};

const handleUpdate = async (): Promise<void> => {
  try {
    await editFormRef.value.validate();
    
    loading.value = true;
    const payload: UpdateMonitorOnDutyGroupReq = {
      id: editForm.id,
      name: editForm.name.trim(),
      shift_days: editForm.shift_days,
      user_ids: editForm.user_ids,
      description: editForm.description?.trim(),
      enable: editForm.enable
    };

    const response = await updateMonitorOnDutyGroupApi(payload);

    if (response) {
      message.success('更新值班组成功');
      await fetchOnDutyGroups();
      closeEditModal();
    } else {
      message.error('更新值班组失败');
    }
  } catch (error: any) {

    message.error(error.message || '更新值班组失败');
  } finally {
    loading.value = false;
  }
};

const handleCreateChange = async (): Promise<void> => {
  try {
    await createChangeFormRef.value.validate();
    
    loading.value = true;
    const payload: CreateMonitorOnDutyGroupChangeReq = {
      on_duty_group_id: createChangeForm.on_duty_group_id,
      date: createChangeForm.date!.format('YYYY-MM-DD'),
      origin_user_id: createChangeForm.origin_user_id!,
      on_duty_user_id: createChangeForm.on_duty_user_id!,
      reason: createChangeForm.reason?.trim()
    };

    const response = await createMonitorOnDutyGroupChangeApi(payload);

    if (response) {
      message.success('创建调班记录成功');
      closeCreateChangeModal();
      // 刷新调班记录列表
      if (changeDialogVisible.value) {
        await fetchChangeRecords(1);
      }
    } else {
      message.error('创建调班记录失败');
    }
  } catch (error: any) {

    message.error(error.message || '创建调班记录失败');
  } finally {
    loading.value = false;
  }
};

// 加载更多调班记录
const loadMoreChangeRecords = async (): Promise<void> => {
  if (changePaginationConfig.total > changeDialog.data.length) {
    const nextPage = Math.floor(changeDialog.data.length / changePaginationConfig.pageSize) + 1;
    await fetchChangeRecords(nextPage, true);
  }
};

// 加载更多历史记录
const loadMoreHistoryRecords = async (): Promise<void> => {
  if (historyPaginationConfig.total > historyDialog.data.length) {
    const nextPage = Math.floor(historyDialog.data.length / historyPaginationConfig.pageSize) + 1;
    const startDate = historyDateRange.value ? historyDateRange.value[0].format('YYYY-MM-DD') : undefined;
    const endDate = historyDateRange.value ? historyDateRange.value[1].format('YYYY-MM-DD') : undefined;
    await fetchOnDutyHistory(historyDialog.groupId, startDate, endDate, nextPage, true);
  }
};

const handleCreatePlanFromDialog = (): void => {
  router.push({
    path: '/monitor_onduty_group_table',
    query: { id: futurePlanDialog.groupId.toString() }
  });
};

const handleMenuClick = (command: string, record: MonitorOnDutyGroup): void => {
  switch (command) {
    case 'edit':
      showEditModal(record);
      break;
    case 'history':
      handleViewHistory(record);
      break;
    case 'change':
      handleViewChange(record);
      break;
    case 'delete':
      confirmDelete(record);
      break;
  }
};

const handleViewChange = async (record: MonitorOnDutyGroup): Promise<void> => {
  changeDialog.groupId = record.id;
  changeDialog.groupName = record.name;
  changeDialog.loading = true;
  changePaginationConfig.current = 1;
  
  try {
    await fetchChangeRecords(1);
    changeDialogVisible.value = true;
  } catch (error: any) {

    message.error(error.message || '获取调班记录失败');
    changeDialog.data = [];
  } finally {
    changeDialog.loading = false;
  }
};

const confirmDelete = (record: MonitorOnDutyGroup): void => {
  Modal.confirm({
    title: '警告',
    content: `确定要删除值班组 "${record.name}" 吗？`,
    okText: '删除',
    okType: 'danger',
    cancelText: '取消',
    async onOk() {
      try {
        const response = await deleteMonitorOnDutyGroupApi(record.id);

        if (response) {
          message.success(`值班组 "${record.name}" 已删除`);
          
          if (data.value.length === 1 && paginationConfig.current > 1) {
            paginationConfig.current--;
          }
          
          fetchOnDutyGroups();
        } else {
          message.error('删除值班组失败');
        }
      } catch (error: any) {

        message.error(error.message || '删除值班组失败');
      }
    }
  });
};

// 生命周期钩子
onMounted(async () => {
  paginationConfig.current = 1;
  paginationConfig.pageSize = 10;
  
  await Promise.all([
    fetchOnDutyGroups(),
    fetchUserList(1)
  ]);
});

// 处理调班日期选择
const handleChangeDateSelect = (date: Dayjs | null): void => {
  if (date && changeDialog.groupId) {
    // 根据选择的日期，从未来排班计划中查找原值班人
    const dateStr = date.format('YYYY-MM-DD');
    
    // 如果当前有未来排班计划数据，从中查找
    if (futurePlanDialog.data?.details) {
      const planDetail = futurePlanDialog.data.details.find((item: any) => item.date === dateStr);
      if (planDetail && planDetail.user) {
        createChangeForm.origin_user_id = planDetail.user.id;
      }
    }
    
    // 如果没有找到，尝试从值班组详情中获取今日值班人作为默认值
    if (!createChangeForm.origin_user_id && detailDialog.data?.today_duty_user) {
      createChangeForm.origin_user_id = detailDialog.data.today_duty_user.id;
    }
  }
};
</script>

<style scoped>
.on-duty-group-container {
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
  width: 250px;
  min-width: 200px;
}

.reset-btn {
  flex-shrink: 0;
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

.group-name-cell {
  display: flex;
  align-items: center;
  gap: 10px;
}

.group-badge {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}

.status-active {
  background-color: #52c41a;
}

.status-inactive {
  background-color: #ff4d4f;
}

.group-name-text {
  font-weight: 500;
  word-break: break-all;
}

.tag-container {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.tech-tag {
  display: inline-flex;
  align-items: center;
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 500;
  border: none;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.1);
}

.user-tag {
  background-color: #e6f7ff;
  color: #0958d9;
  border-left: 3px solid #1890ff;
}

.empty-text {
  color: #999;
  font-style: italic;
  font-size: 12px;
}

.config-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.config-item {
  display: flex;
  align-items: center;
  gap: 4px;
}

.config-label {
  font-size: 12px;
  color: #666;
}

.config-value {
  font-size: 12px;
  font-weight: 500;
  color: #333;
}

.duty-status-container {
  display: flex;
  align-items: center;
  gap: 8px;
}

.today-duty {
  display: flex;
  align-items: center;
  gap: 8px;
}

.duty-user-name {
  font-weight: 500;
}

.no-duty {
  color: #999;
  font-style: italic;
}

.creator-info {
  display: flex;
  align-items: center;
  gap: 8px;
}

.creator-name {
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

.weekday {
  font-size: 12px;
  color: #8c8c8c;
}

.action-buttons {
  display: flex;
  gap: 4px;
  justify-content: center;
  flex-wrap: wrap;
}

.form-section {
  margin-bottom: 28px;
  padding: 0;
  position: relative;
}

.section-title {
  font-size: 16px;
  font-weight: 600;
  color: #1a1a1a;
  margin-bottom: 16px;
  padding-left: 12px;
  border-left: 4px solid #1890ff;
}

.full-width {
  width: 100%;
}

.detail-dialog .group-details {
  margin-bottom: 20px;
}

.detail-header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 20px;
  flex-wrap: wrap;
}

.detail-header h2 {
  margin: 0;
  font-size: 24px;
  color: #1f2937;
  word-break: break-all;
}

.detail-badges {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.duty-user-info {
  display: flex;
  align-items: center;
  gap: 8px;
}

.detail-footer {
  margin-top: 24px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}

.footer-left {
  display: flex;
  gap: 8px;
}

.footer-right {
  display: flex;
  align-items: center;
}

.future-plan-content,
.history-content,
.change-content {
  max-height: 70vh;
  overflow-y: auto;
}

.plan-header,
.history-header,
.change-header {
  margin-bottom: 20px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 12px;
}

.plan-header h3,
.history-header h3,
.change-header h3 {
  margin: 0;
  font-size: 20px;
  color: #1f2937;
}

.plan-info,
.history-info {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.plan-filters,
.history-filters {
  margin-bottom: 20px;
  padding: 16px;
  background: #f5f5f5;
  border-radius: 8px;
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 12px;
}

.plan-timeline,
.history-timeline {
  margin-bottom: 20px;
}

.history-table {
  margin-bottom: 20px;
}

.history-table :deep(.ant-table-thead > tr > th) {
  background-color: #f5f5f5;
  font-weight: 600;
}

.history-table :deep(.ant-table-tbody > tr:hover > td) {
  background-color: #e6f7ff;
}

.pagination-container {
  margin-top: 20px;
  display: flex;
  justify-content: center;
}

.timeline-date {
  text-align: right;
  padding-right: 12px;
}

.date-main {
  font-weight: 600;
  font-size: 14px;
  color: #1f2937;
}

.date-sub {
  font-size: 12px;
  color: #6b7280;
}

.timeline-content {
  padding: 8px 12px;
  background: #f8fafc;
  border-radius: 6px;
  border-left: 3px solid #1890ff;
}

.duty-user {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 4px;
}

.user-name {
  font-weight: 500;
  color: #1f2937;
}

.today-tag,
.tomorrow-tag,
.changed-tag {
  font-size: 10px;
  padding: 2px 6px;
}

.duty-details {
  display: flex;
  gap: 12px;
  font-size: 12px;
  color: #6b7280;
}

.duty-type {
  font-weight: 500;
}

.cycle-info,
.create-info {
  color: #9ca3af;
}

.plan-summary {
  margin-bottom: 20px;
  padding: 16px;
  background: #f8fafc;
  border-radius: 8px;
}

.user-change-info {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.user-item {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.label {
  font-size: 12px;
  color: #666;
}

.user-id {
  font-weight: 500;
  color: #1890ff;
}

.create-time {
  font-size: 12px;
  color: #8c8c8c;
}

/* 响应式设计 */
@media (max-width: 768px) {
  .on-duty-group-container {
    padding: 8px;
  }

  .header-actions {
    flex-direction: column;
    align-items: stretch;
    width: 100%;
  }

  .search-filters {
    width: 100%;
    flex-direction: row;
    justify-content: space-between;
  }

  .search-input {
    width: calc(100% - 140px);
    min-width: auto;
  }

  .btn-text {
    display: none;
  }

  .btn-create {
    padding: 4px 8px;
    min-width: auto;
    align-self: flex-end;
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

  .detail-footer {
    justify-content: center;
  }

  .detail-footer .ant-btn {
    flex: 1;
    max-width: 120px;
  }

  .plan-filters,
  .history-filters {
    flex-direction: column;
    align-items: stretch;
  }

  .timeline-date {
    text-align: left;
    padding-right: 0;
    margin-bottom: 8px;
  }

  .duty-user {
    flex-wrap: wrap;
  }

  .user-change-info {
    flex-direction: column;
    align-items: flex-start;
  }

  .plan-header,
  .history-header,
  .change-header {
    flex-direction: column;
    align-items: stretch;
  }
}

@media (max-width: 480px) {
  .header-actions {
    gap: 8px;
  }

  .stats-card {
    text-align: center;
  }

  .creator-info {
    flex-direction: column;
    gap: 4px;
    align-items: center;
  }

  .creator-name {
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

/* 对话框响应式优化 */
.responsive-modal :deep(.ant-modal) {
  max-width: calc(100vw - 16px);
  margin: 8px;
}

@media (max-width: 768px) {
  .responsive-modal :deep(.ant-modal-body) {
    padding: 16px;
    max-height: calc(100vh - 160px);
    overflow-y: auto;
  }
}

/* Timeline 响应式优化 */
:deep(.ant-timeline-item-label) {
  width: 100px !important;
}

:deep(.ant-timeline-item-content) {
  margin-left: 120px !important;
}

@media (max-width: 768px) {
  :deep(.ant-timeline-item-label) {
    width: auto !important;
    position: relative !important;
  }

  :deep(.ant-timeline-item-content) {
    margin-left: 0 !important;
  }
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px;
  background-color: #f8f9fa;
  border-radius: 8px;
}

.empty-icon {
  font-size: 48px;
  color: #ccc;
  margin-bottom: 20px;
}

.empty-title {
  font-size: 18px;
  color: #333;
  margin-bottom: 10px;
}

.empty-description {
  font-size: 14px;
  color: #666;
  text-align: center;
}

.table-empty.empty-state {
  padding: 20px;
  background-color: transparent;
}

.table-empty .empty-icon {
  font-size: 32px;
  margin-bottom: 10px;
}

.record-id {
  font-weight: 600;
  color: #1890ff;
  font-family: 'Courier New', monospace;
}

.reason-text {
  color: #666;
  font-style: italic;
}

.change-dialog .ant-table-wrapper {
  max-height: 60vh;
  overflow-y: auto;
}

.change-dialog .ant-table-thead > tr > th {
  position: sticky;
  top: 0;
  background: #fafafa;
  z-index: 1;
}

.change-dialog .detail-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 16px;
  padding-top: 16px;
  border-top: 1px solid #f0f0f0;
}

.change-dialog .ant-table-tbody > tr > td {
  vertical-align: top;
  padding: 12px 8px;
}

.change-dialog .ant-table-tbody > tr:hover > td {
  background-color: #f5f5f5;
}
</style>
