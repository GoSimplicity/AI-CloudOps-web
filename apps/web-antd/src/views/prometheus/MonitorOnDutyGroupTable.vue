<template>
  <div class="duty-schedule-container">
    <!-- 页面标题和操作栏 -->
    <div class="page-header">
      <div class="header-content">
        <div class="title-section">
          <div class="title-breadcrumb">
            <a-button type="text" @click="goBack" class="back-btn" size="large">
              <template #icon>
                <Icon icon="carbon:arrow-left" />
              </template>
            </a-button>
            <div class="title-info">
              <h1 class="page-title">{{ dutyGroupDetail?.name || '值班组详情' }}</h1>
              <div class="breadcrumb">
                <span class="breadcrumb-item">值班管理</span>
                <Icon icon="carbon:chevron-right" class="breadcrumb-separator" />
                <span class="breadcrumb-item current">{{ currentMonthYear }}</span>
              </div>
            </div>
          </div>
        </div>
        <div class="header-actions">
          <a-button type="default" @click="exportSchedule" class="action-btn" :loading="exportLoading">
            <template #icon>
            </template>
            导出
          </a-button>
          <a-button type="primary" @click="handleCreateChange" class="action-btn">
            申请换班
          </a-button>
        </div>
      </div>
    </div>

    <!-- 统计面板 -->
    <div class="stats-section">
      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-icon">
            <Icon icon="carbon:user-multiple" />
          </div>
          <div class="stat-content">
            <div class="stat-number">{{ stats.totalMembers }}</div>
            <div class="stat-label">值班成员</div>
          </div>
        </div>
        
        <div class="stat-card">
          <div class="stat-icon">
            <Icon icon="carbon:user-online" />
          </div>
          <div class="stat-content">
            <div class="stat-number">{{ stats.todayOnDuty }}</div>
            <div class="stat-label">今日值班</div>
          </div>
        </div>
        
        <div class="stat-card">
          <div class="stat-icon">
            <Icon icon="carbon:calendar-heat-map" />
          </div>
          <div class="stat-content">
            <div class="stat-number">{{ stats.monthlyDutyDays }}</div>
            <div class="stat-label">本月值班天数</div>
          </div>
        </div>
        
        <div class="stat-card">
          <div class="stat-icon">
            <Icon icon="carbon:change-catalog" />
          </div>
          <div class="stat-content">
            <div class="stat-number">{{ stats.changeRecords }}</div>
            <div class="stat-label">换班记录</div>
          </div>
        </div>
      </div>
    </div>

    <!-- 日历区域 -->
    <div class="calendar-section">
      <a-card class="calendar-card">
        <div class="calendar-header">
          <div class="calendar-nav">
            <a-button @click="previousMonth" size="large" class="nav-btn" :disabled="loading">
              <Icon icon="carbon:chevron-left" />
            </a-button>
            <div class="calendar-title">
              <h2>{{ currentMonthYear }}</h2>
              <span class="calendar-subtitle">值班安排</span>
            </div>
            <a-button @click="nextMonth" size="large" class="nav-btn" :disabled="loading">
              <Icon icon="carbon:chevron-right" />
            </a-button>
          </div>
          
          <div class="calendar-actions">
            <a-button size="small" @click="goToToday" :disabled="isCurrentMonthToday">
              今日
            </a-button>
            <a-button size="small" @click="refreshCalendar" :loading="loading">
              刷新
            </a-button>
          </div>
        </div>

        <a-spin :spinning="loading" size="large">
          <div class="calendar">
            <!-- 星期标题 -->
            <div class="calendar-weekdays">
              <div class="weekday-header" v-for="weekday in weekdays" :key="weekday">
                {{ weekday }}
              </div>
            </div>

            <!-- 日历内容 -->
            <div class="calendar-grid">
              <div 
                class="calendar-day" 
                v-for="day in calendarDays" 
                :key="day.date"
                @click="handleDayClick(day)" 
                :class="{
                  'has-duty': day.user,
                  'today': isToday(day.date),
                  'weekend': isWeekend(day.date),
                  'current-month': day.isCurrentMonth,
                  'clickable': day.isCurrentMonth,
                  'is-adjusted': day.isAdjusted
                }"
              >
                <div class="day-header">
                  <div class="day-number">{{ formatDayNumber(day.date) }}</div>
                  <div class="day-badges" v-if="day.isCurrentMonth">
                    <div class="today-badge" v-if="isToday(day.date)">今日</div>
                    <div class="adjusted-badge" v-if="day.isAdjusted">换班</div>
                    <div class="weekend-badge" v-if="isWeekend(day.date)">
                      {{ getWeekendType(day.date) }}
                    </div>
                  </div>
                </div>
                
                <div class="day-content">
                  <div class="duty-info" v-if="day.user">
                    <a-avatar size="small" :style="{ backgroundColor: getAvatarColor(day.user.real_name || day.user.username) }">
                      {{ getInitials(day.user.real_name || day.user.username) }}
                    </a-avatar>
                    <div class="duty-details">
                      <span class="duty-name">{{ day.user.real_name || day.user.username }}</span>
                      <div class="duty-extra" v-if="day.originUser">
                        <span class="original-user">原: {{ day.originUser }}</span>
                      </div>
                    </div>
                  </div>
                  <div class="no-duty" v-else>
                    <span class="no-duty-text">无安排</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </a-spin>
      </a-card>
    </div>

    <!-- 值班历史表格 -->
    <div class="records-section">
      <a-card>
        <template #title>
          <div class="section-title">
            <Icon icon="carbon:table" />
            <span>值班历史</span>
          </div>
        </template>

        <div class="search-section">
          <a-input-search 
            v-model:value="searchQuery" 
            placeholder="搜索值班历史..." 
            class="search-input"
            @search="handleSearch" 
            allow-clear 
          />
          <a-date-picker 
            v-model:value="dateFilter" 
            placeholder="筛选日期" 
            class="filter-select" 
            @change="handleDateChange"
            allow-clear 
          />
        </div>

        <a-table 
          :data-source="historyList" 
          :columns="historyColumns" 
          :pagination="paginationConfig"
          :loading="loading" 
          row-key="id" 
          @change="handleTableChange"
          class="records-table"
        >
          <template #bodyCell="{ column, record }">
            <template v-if="column.key === 'date'">
              <div class="date-cell">
                <div class="date-main">{{ formatDate(record.date_string) }}</div>
                <div class="date-sub">{{ getDayOfWeek(record.date_string) }}</div>
              </div>
            </template>

            <template v-if="column.key === 'users'">
              <div class="users-change">
                <div class="user-item">
                  <a-avatar size="small" :style="{ backgroundColor: getAvatarColor(getUserName(record.origin_user_id) || '') }">
                    {{ getInitials(getUserName(record.origin_user_id)) }}
                  </a-avatar>
                  <span class="user-name">{{ getUserName(record.origin_user_id) }}</span>
                </div>
                <Icon icon="carbon:arrow-right" class="arrow" />
                <div class="user-item">
                  <a-avatar size="small" :style="{ backgroundColor: getAvatarColor(getUserName(record.on_duty_user_id) || '') }">
                    {{ getInitials(getUserName(record.on_duty_user_id)) }}
                  </a-avatar>
                  <span class="user-name">{{ getUserName(record.on_duty_user_id) }}</span>
                </div>
              </div>
            </template>

            <template v-if="column.key === 'createdAt'">
              <div class="date-cell">
                <div class="date-main">{{ formatDateFromTimestamp(record.created_at) }}</div>
                <div class="date-sub">{{ formatTimeFromTimestamp(record.created_at) }}</div>
              </div>
            </template>
          </template>

          <template #emptyText>
            <div class="empty-state">
              <Icon icon="carbon:no-image" class="empty-icon" />
              <div class="empty-title">暂无值班历史</div>
              <div class="empty-description">当前时间段内没有值班历史记录</div>
            </div>
          </template>
        </a-table>
      </a-card>
    </div>

    <!-- 换班申请对话框 -->
    <a-modal 
      :open="formDialogVisible" 
      :title="formDialog.isEdit ? '编辑换班记录' : '申请换班'" 
      @ok="saveChange" 
      @cancel="closeFormDialog" 
      :confirmLoading="submitting"
    >
      <a-form :model="formDialog.form" layout="vertical">
        <a-form-item label="换班日期" required>
          <a-date-picker 
            v-model:value="formDialog.form.date" 
            placeholder="请选择换班日期" 
            style="width: 100%"
            :disabled-date="disabledDate"
          />
        </a-form-item>
        
        <a-form-item label="原值班人" required>
          <a-select 
            v-model:value="formDialog.form.origin_user_id" 
            placeholder="请选择原值班人" 
            style="width: 100%"
            show-search 
            allow-clear
            :filter-option="filterOption"
          >
            <a-select-option v-for="member in dutyGroupDetail?.users || []" :key="member.id" :value="member.id">
              {{ member.real_name || member.username }}
            </a-select-option>
          </a-select>
        </a-form-item>
        
        <a-form-item label="新值班人" required>
          <a-select 
            v-model:value="formDialog.form.on_duty_user_id" 
            placeholder="请选择新值班人" 
            style="width: 100%"
            show-search 
            allow-clear
            :filter-option="filterOption"
          >
            <a-select-option v-for="member in dutyGroupDetail?.users || []" :key="member.id" :value="member.id">
              {{ member.real_name || member.username }}
            </a-select-option>
          </a-select>
        </a-form-item>

        <a-form-item label="换班原因" required>
          <a-textarea 
            v-model:value="formDialog.form.reason" 
            placeholder="请输入换班原因" 
            :rows="3"
            :maxlength="200"
            show-count
          />
        </a-form-item>
      </a-form>
    </a-modal>

    <!-- 日期详情对话框 -->
    <a-modal 
      :open="dayDetailVisible" 
      title="值班日详情" 
      :footer="null"
      @cancel="closeDayDetail"
      width="400"
    >
      <div v-if="selectedDay" class="day-detail-container">
        <div class="day-detail-header">
          <div class="date-display">
            <div class="date-large">{{ formatDayNumber(selectedDay.date) }}</div>
            <div class="date-info">
              <div class="date-month">{{ formatMonthDay(selectedDay.date) }}</div>
              <div class="date-weekday">{{ getDayOfWeek(selectedDay.date) }}</div>
            </div>
          </div>
          <div class="day-badges">
            <a-tag v-if="isToday(selectedDay.date)" color="blue">今日</a-tag>
            <a-tag v-if="isWeekend(selectedDay.date)" color="orange">
              {{ getWeekendType(selectedDay.date) }}
            </a-tag>
            <a-tag v-if="selectedDay.isAdjusted" color="purple">已换班</a-tag>
          </div>
        </div>

        <div class="duty-detail-content">
          <div v-if="selectedDay.user" class="duty-assigned">
            <div class="duty-user-info">
              <a-avatar size="large" :style="{ backgroundColor: getAvatarColor(selectedDay.user.real_name || selectedDay.user.username) }">
                {{ getInitials(selectedDay.user.real_name || selectedDay.user.username) }}
              </a-avatar>
              <div class="user-details">
                <div class="user-name">{{ selectedDay.user.real_name || selectedDay.user.username }}</div>
                <div class="user-role">值班人员</div>
              </div>
            </div>
            
            <div v-if="selectedDay.originUser" class="change-info">
              <Icon icon="carbon:change-catalog" class="change-icon" />
              <span>原值班人：{{ selectedDay.originUser }}</span>
            </div>
            
            <div class="duty-actions-full">
              <a-button type="primary" @click="openSwapModal(selectedDay)" :disabled="isPastDate(selectedDay.date)" block>
                <Icon icon="carbon:change-catalog" />
                申请换班
              </a-button>
            </div>
          </div>
          
          <div v-else class="duty-unassigned">
            <Icon icon="carbon:user-off" class="unassigned-icon" />
            <div class="unassigned-text">该日期暂无值班安排</div>
          </div>
        </div>
      </div>
    </a-modal>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted, computed, nextTick } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { message } from 'ant-design-vue';
import dayjs, { Dayjs } from 'dayjs';
import { Icon } from '@iconify/vue';
import {
  getMonitorOnDutyGroupDetailApi,
  getMonitorOnDutyGroupFuturePlanApi,
  getMonitorOnDutyHistoryApi,
  createMonitorOnDutyGroupChangeApi,
  getMonitorOnDutyGroupChangeListApi,
  type MonitorOnDutyHistory,
  type User,
  type MonitorOnDutyGroup,
  type CreateMonitorOnDutyGroupChangeReq,
  type GetMonitorOnDutyHistoryReq,
} from '#/api/core/prometheus/prometheus_onduty';

// 定义接口 - 修复API响应结构
interface Day {
  date: string;
  user: User | null;
  originUser?: string;
  isCurrentMonth: boolean;
  isAdjusted: boolean;
}

// 根据API响应修复数据结构
interface DutyPlanDetail {
  date: string;
  user: User | null | number;
  origin_user?: string;
}

// 修复API响应结构处理
interface FuturePlanResponse {
  details?: DutyPlanDetail[];
  items?: DutyPlanDetail[];
  data?: DutyPlanDetail[];
  list?: DutyPlanDetail[];
}

const route = useRoute();
const router = useRouter();

// 列定义
const historyColumns = [
  { title: '值班日期', key: 'date', width: 120 },
  { title: '人员变更', key: 'users', width: 220 },
  { title: '记录时间', key: 'createdAt', width: 150 }
];

// 状态数据
const loading = ref(false);
const submitting = ref(false);
const exportLoading = ref(false);
const searchQuery = ref('');
const dateFilter = ref<Dayjs>();
const dutyGroupId = ref(0);
const currentDate = ref(new Date());
const selectedDay = ref<Day | null>(null);

// 用户数据缓存
const userCache = ref<Map<number, string>>(new Map());

// 数据状态
const dutyGroupDetail = ref<MonitorOnDutyGroup | null>(null);
const dutyPlanData = ref<DutyPlanDetail[]>([]);
const calendarDays = ref<Day[]>([]);
const historyList = ref<MonitorOnDutyHistory[]>([]);
const changeRecordsList = ref<any[]>([]);

// 周显示
const weekdays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];

// 分页配置
const paginationConfig = reactive({
  current: 1,
  pageSize: 10,
  total: 0,
  showSizeChanger: true,
  showQuickJumper: true,
  showTotal: (total: number) => `共 ${total} 条记录`
});

// 统计数据
const stats = reactive({
  totalMembers: 0,
  todayOnDuty: '',
  changeRecords: 0,
  monthlyDutyDays: 0
});

// 对话框状态
const formDialogVisible = ref(false);
const dayDetailVisible = ref(false);

// 表单对话框数据
const formDialog = reactive({
  isEdit: false,
  form: {
    id: undefined as number | undefined,
    date: undefined as Dayjs | undefined,
    origin_user_id: null as number | null,
    on_duty_user_id: null as number | null,
    reason: ''
  }
});

// 计算属性
const currentMonthYear = computed(() => {
  return `${currentDate.value.getFullYear()}年${currentDate.value.getMonth() + 1}月`;
});

const isCurrentMonthToday = computed(() => {
  const now = dayjs();
  const current = dayjs(currentDate.value);
  return now.isSame(current, 'month');
});

// 数据加载函数声明（提前声明避免初始化问题）
const fetchDutyGroups = async (): Promise<void> => {
  try {
    const id = dutyGroupId.value;
    if (!id) {
      message.error('无效的值班组ID');
      return;
    }
    
    console.log('开始获取值班组详情，ID:', id);
    const response = await getMonitorOnDutyGroupDetailApi(id);
    console.log('获取值班组详情响应:', response);
    
    // 改进的API响应结构处理 - 使用与值班组页面相同的逻辑
    let groupData = null;
    
    if (response) {

      if (response.id && response.name) {
        groupData = response;
      }
      // 如果response包含data字段
      else if (response.data && typeof response.data === 'object') {
        if (response.data.id && response.data.name) {
          groupData = response.data;
        }
      }
      // 如果response包含result字段
      else if (response.result && typeof response.result === 'object') {
        if (response.result.id && response.result.name) {
          groupData = response.result;
        }
      }
      // 如果response包含items字段且是数组，取第一个
      else if (response.items && Array.isArray(response.items) && response.items.length > 0) {
        groupData = response.items[0];
      }
    }
    
    if (groupData) {
      dutyGroupDetail.value = groupData;
      console.log('设置值班组详情数据:', groupData);
      
      // 初始化用户缓存
        if (groupData.users && Array.isArray(groupData.users)) {
        groupData.users.forEach((user: User) => {
          const userName = user.real_name || user.username || `用户${user.id}`;
          userCache.value.set(user.id, userName);
        });
        console.log('初始化用户缓存:', userCache.value);
      }
      
      updateStats();
      
      // 在获取到值班组详情后立即加载其他数据
      await Promise.all([
        fetchDutySchedule(),
        loadHistoryRecords(),
        loadChangeRecords(1)
      ]);
    } else {
      console.error('无法解析API响应数据:', response);
      message.error('获取值班组信息失败：数据格式异常');
    }
  } catch (error: any) {
    console.error('获取值班组信息失败:', error);
    
    // 更详细的错误信息
    let errorMessage = '获取值班组信息失败';
    if (error.response) {
      const status = error.response.status;
      const responseData = error.response.data;
      
      if (status === 404) {
        errorMessage = '值班组不存在或已被删除';
      } else if (status === 403) {
        errorMessage = '无权限访问该值班组';
      } else if (status === 500) {
        errorMessage = '服务器内部错误';
      } else {
        errorMessage = `请求失败 (${status}): ${responseData?.message || error.message}`;
      }
    } else if (error.request) {
      errorMessage = '网络连接失败，请检查网络连接';
    } else {
      errorMessage = error.message || '未知错误';
    }
    
    message.error(errorMessage);
    
    // 错误时跳转回列表页
    setTimeout(() => {
      router.push('/monitor_onduty_group');
    }, 2000);
  }
};

const fetchDutySchedule = async (): Promise<void> => {
  if (!dutyGroupId.value) {
    console.warn('未设置值班组ID，跳过获取值班计划');
    return;
  }
  
  loading.value = true;
  try {
    const id = dutyGroupId.value;
    const currentMonth = dayjs(currentDate.value);
    const startOfCalendar = currentMonth.startOf('month').startOf('week');
    const endOfCalendar = currentMonth.endOf('month').endOf('week');

    console.log('开始获取值班计划，参数:', {
      id,
      start_time: startOfCalendar.format('YYYY-MM-DD'),
      end_time: endOfCalendar.format('YYYY-MM-DD')
    });

    const response = await getMonitorOnDutyGroupFuturePlanApi(id, {
      start_time: startOfCalendar.format('YYYY-MM-DD'),
      end_time: endOfCalendar.format('YYYY-MM-DD')
    });

    console.log('获取值班计划响应:', response);

    // 改进的响应数据处理 - 兼容多种响应格式
    let planDetails: DutyPlanDetail[] = [];
    
    if (response) {
      // 直接是数组的情况
      if (Array.isArray(response)) {
        planDetails = response;
      }

      else if (response.details && Array.isArray(response.details)) {
        planDetails = response.details;
      }
      // 包含items字段的情况
      else if (response.items && Array.isArray(response.items)) {
        planDetails = response.items;
      }
      // 包含data字段的情况
      else if (response.data && Array.isArray(response.data)) {
        planDetails = response.data;
      }
      // 包含list字段的情况
      else if (response.list && Array.isArray(response.list)) {
        planDetails = response.list;
      }
      // 嵌套结构的情况
      else if (response.data && response.data.details && Array.isArray(response.data.details)) {
        planDetails = response.data.details;
      }
      else if (response.result && response.result.details && Array.isArray(response.result.details)) {
        planDetails = response.result.details;
      }
    }

    console.log('解析后的计划详情:', planDetails);
    dutyPlanData.value = planDetails;

    if (planDetails.length > 0) {
      const days: Day[] = [];
      
      // 生成完整的日历网格
      for (let date = startOfCalendar; date.isBefore(endOfCalendar) || date.isSame(endOfCalendar); date = date.add(1, 'day')) {
        const dateStr = date.format('YYYY-MM-DD');
        const detail = planDetails.find((item: DutyPlanDetail) => item.date === dateStr);
        const isCurrentMonth = date.isSame(currentMonth, 'month');

        // 处理用户信息和换班标识
        let user: User | null = null;
        let originUser: string | undefined = undefined;
        let isAdjusted = false;

        if (detail) {
          // 处理用户信息 - 兼容多种数据结构
          if (detail.user) {
            if (typeof detail.user === 'object' && detail.user.id) {
              user = detail.user;
            } else if (typeof detail.user === 'number') {
              // 如果user字段只是用户ID，从用户缓存中获取信息
              const userName = getUserName(detail.user);
              user = {
                id: detail.user,
                username: userName,
                real_name: userName
              };
            }
          }
          
          // 处理原值班人信息（如果有换班）
          if (detail.origin_user && detail.origin_user.trim()) {
            originUser = detail.origin_user;
            isAdjusted = true;
          }
        }

        days.push({
          date: dateStr,
          user: user,
          originUser: originUser,
          isCurrentMonth,
          isAdjusted: isAdjusted
        });
      }
      
      calendarDays.value = days;
      console.log('生成的日历数据:', days);
    } else {
      // 如果没有计划数据，仍然生成空的日历网格
      const days: Day[] = [];
      for (let date = startOfCalendar; date.isBefore(endOfCalendar) || date.isSame(endOfCalendar); date = date.add(1, 'day')) {
        const dateStr = date.format('YYYY-MM-DD');
        const isCurrentMonth = date.isSame(currentMonth, 'month');
        
        days.push({
          date: dateStr,
          user: null,
          originUser: undefined,
          isCurrentMonth,
          isAdjusted: false
        });
      }
      calendarDays.value = days;
      console.log('生成空的日历数据');
    }
    
    updateStats();
  } catch (error: any) {
    console.error('获取值班计划失败:', error);
    
    let errorMessage = '获取值班计划失败';
    if (error.response?.status === 404) {
      errorMessage = '未找到值班计划数据';
    } else if (error.response?.status === 403) {
      errorMessage = '无权限访问值班计划';
    } else {
      errorMessage = error.message || '获取值班计划失败';
    }
    
    message.error(errorMessage);
    calendarDays.value = [];
  } finally {
    loading.value = false;
  }
};

const loadHistoryRecords = async (): Promise<void> => {
  if (!dutyGroupId.value) {
    console.warn('未设置值班组ID，跳过加载历史记录');
    return;
  }
  
  try {
    const currentMonth = dayjs(currentDate.value);
    const startDate = currentMonth.startOf('month').format('YYYY-MM-DD');
    const endDate = currentMonth.endOf('month').format('YYYY-MM-DD');

    console.log('开始加载值班历史，参数:', {
      groupId: dutyGroupId.value,
      start_date: startDate,
      end_date: endDate,
      page: paginationConfig.current,
      size: paginationConfig.pageSize
    });

    const response = await getMonitorOnDutyHistoryApi(dutyGroupId.value, {
      start_date: startDate,
      end_date: endDate,
      page: paginationConfig.current,
      size: paginationConfig.pageSize
    });

    console.log('获取值班历史响应:', response);

    // 改进的历史数据响应处理 - 使用与值班组页面相同的逻辑
    let historyData: MonitorOnDutyHistory[] = [];
    let total = 0;
    
    if (response) {
      // 直接包含items字段
      if (response.items && Array.isArray(response.items)) {
        historyData = response.items;
        total = response.total || response.items.length;
      }
      // 直接是数组
      else if (Array.isArray(response)) {
        historyData = response;
        total = response.length;
      }
      // 包含data字段
      else if (response.data) {
        if (Array.isArray(response.data)) {
          historyData = response.data;
          total = response.total || response.data.length;
        } else if (response.data.items && Array.isArray(response.data.items)) {
          historyData = response.data.items;
          total = response.data.total || response.data.items.length;
        }
      }
      // 包含list字段
      else if (response.list && Array.isArray(response.list)) {
        historyData = response.list;
        total = response.total || response.list.length;
      }
      // 包含result字段
      else if (response.result) {
        if (Array.isArray(response.result)) {
          historyData = response.result;
          total = response.total || response.result.length;
        } else if (response.result.items && Array.isArray(response.result.items)) {
          historyData = response.result.items;
          total = response.result.total || response.result.items.length;
        }
      }
    }
    
    console.log('解析的历史数据:', historyData);
    
    historyList.value = historyData;
    paginationConfig.total = total;
    
    updateStats();
  } catch (error: any) {
    console.error('加载值班历史失败:', error);
    
    let errorMessage = '加载值班历史失败';
    if (error.response?.status === 404) {
      errorMessage = '未找到值班历史数据';
    } else if (error.response?.status === 403) {
      errorMessage = '无权限访问值班历史';
    } else {
      errorMessage = error.message || '加载值班历史失败';
    }
    
    message.error(errorMessage);
    historyList.value = [];
    paginationConfig.total = 0;
  }
};

// 调班记录分页配置
const changeRecordsPagination = reactive({
  current: 1,
  pageSize: 20,
  total: 0,
  hasMore: true
});

// 加载调班记录
const loadChangeRecords = async (page = 1, append = false): Promise<void> => {
  if (!dutyGroupId.value) {
    console.warn('未设置值班组ID，跳过加载调班记录');
    return;
  }
  
  try {
    console.log('开始加载调班记录，参数:', {
      groupId: dutyGroupId.value,
      page,
      size: changeRecordsPagination.pageSize
    });

    const response = await getMonitorOnDutyGroupChangeListApi(dutyGroupId.value, {
      page,
      size: changeRecordsPagination.pageSize
    });

    console.log('获取调班记录响应:', response);

    // 改进的调班记录响应处理
    let changeData: any[] = [];
    let total = 0;
    
    if (response) {
      // 直接包含items字段
      if (response.items && Array.isArray(response.items)) {
        changeData = response.items;
        total = response.total || response.items.length;
      }
      // 直接是数组
      else if (Array.isArray(response)) {
        changeData = response;
        total = response.length;
      }
      // 包含data字段
      else if (response.data) {
        if (Array.isArray(response.data)) {
          changeData = response.data;
          total = response.total || response.data.length;
        } else if (response.data.items && Array.isArray(response.data.items)) {
          changeData = response.data.items;
          total = response.data.total || response.data.items.length;
        }
      }
      // 包含list字段
      else if (response.list && Array.isArray(response.list)) {
        changeData = response.list;
        total = response.total || response.list.length;
      }
    }
    
    console.log('解析的调班记录数据:', changeData);
    
    if (append) {
      changeRecordsList.value = [...changeRecordsList.value, ...changeData];
    } else {
      changeRecordsList.value = changeData;
    }
    
    changeRecordsPagination.total = total;
    changeRecordsPagination.hasMore = page * changeRecordsPagination.pageSize < total;
    updateStats();
  } catch (error: any) {
    console.error('加载调班记录失败:', error);
    
    let errorMessage = '加载调班记录失败';
    if (error.response?.status === 404) {
      errorMessage = '未找到调班记录';
    } else if (error.response?.status === 403) {
      errorMessage = '无权限访问调班记录';
    } else {
      errorMessage = error.message || '加载调班记录失败';
    }
    
    message.error(errorMessage);
    if (!append) {
      changeRecordsList.value = [];
      changeRecordsPagination.total = 0;
    }
  }
};

// 初始化函数
const initializeData = async (): Promise<void> => {
  const id = parseInt(route.query.id as string) || 0;
  console.log('初始化数据，值班组ID:', id);
  
  if (id) {
    dutyGroupId.value = id;
    await fetchDutyGroups();
  } else {
    message.error('缺少值班组ID参数');
    setTimeout(() => {
      router.push('/monitor_onduty_group');
    }, 1000);
  }
};

// 日期禁用函数
const disabledDate = (current: Dayjs): boolean => {
  return current && current < dayjs().startOf('day');
};

// 筛选函数
const filterOption = (input: string, option: any) => {
  return option.label?.toLowerCase().indexOf(input.toLowerCase()) >= 0;
};


const getAvatarColor = (name: string): string => {
  const colors = ['#1890ff', '#52c41a', '#faad14', '#f5222d', '#722ed1', '#13c2c2'];
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

const getUserName = (userId: number): string => {
  // 先从缓存中查找
  if (userCache.value.has(userId)) {
    return userCache.value.get(userId)!;
  }
  
  // 从值班组详情中查找
  const user = dutyGroupDetail.value?.users?.find(u => u.id === userId);
  if (user) {
    const userName = user.real_name || user.username || `用户${userId}`;
    userCache.value.set(userId, userName);
    return userName;
  }
  
  return `用户${userId}`;
};

const formatDate = (dateStr: string): string => {
  return dayjs(dateStr).format('YYYY-MM-DD');
};

const formatDayNumber = (dateStr: string): string => {
  return dayjs(dateStr).format('D');
};

const formatMonthDay = (dateStr: string): string => {
  return dayjs(dateStr).format('M月D日');
};

const formatDateFromTimestamp = (timestamp: string): string => {
  return dayjs(timestamp).format('YYYY-MM-DD');
};

const formatTimeFromTimestamp = (timestamp: string): string => {
  return dayjs(timestamp).format('HH:mm');
};

const getDayOfWeek = (dateStr: string): string => {
  const weekdays = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];
  return weekdays[dayjs(dateStr).day()] || '';
};

const isToday = (dateStr: string): boolean => {
  return dayjs(dateStr).isSame(dayjs(), 'day');
};

const isPastDate = (dateStr: string): boolean => {
  return dayjs(dateStr).isBefore(dayjs(), 'day');
};

const isWeekend = (dateStr: string): boolean => {
  const day = dayjs(dateStr).day();
  return day === 0 || day === 6;
};

const getWeekendType = (dateStr: string): string => {
  const day = dayjs(dateStr).day();
  return day === 0 ? '周日' : '周六';
};

// 更新统计数据
const updateStats = (): void => {
  if (dutyGroupDetail.value) {
    stats.totalMembers = dutyGroupDetail.value.users?.length || 0;
  }
  
  // 今日值班 - 显示值班人姓名
  const todayStr = dayjs().format('YYYY-MM-DD');
  const todayDuty = calendarDays.value.find(day => day.date === todayStr && day.user);
  stats.todayOnDuty = todayDuty?.user ? (todayDuty.user.real_name || todayDuty.user.username) : '无安排';
  
  // 本月值班天数
  stats.monthlyDutyDays = calendarDays.value.filter(day => day.isCurrentMonth && day.user).length;
  
  // 调班记录数
  stats.changeRecords = changeRecordsList.value.length;
};

// 返回按钮
const goBack = (): void => {
  router.push('/monitor_onduty_group');
};

// 月份导航
const previousMonth = (): void => {
  const newDate = new Date(currentDate.value);
  newDate.setMonth(newDate.getMonth() - 1);
  currentDate.value = newDate;
  fetchDutySchedule();
  loadHistoryRecords();
};

const nextMonth = (): void => {
  const newDate = new Date(currentDate.value);
  newDate.setMonth(newDate.getMonth() + 1);
  currentDate.value = newDate;
  fetchDutySchedule();
  loadHistoryRecords();
};

const goToToday = (): void => {
  currentDate.value = new Date();
  fetchDutySchedule();
  loadHistoryRecords();
};

const refreshCalendar = (): void => {
  fetchDutySchedule();
  loadHistoryRecords();
};

// 导出功能
const exportSchedule = async (): Promise<void> => {
  exportLoading.value = true;
  try {
    const exportData = calendarDays.value
      .filter(day => day.isCurrentMonth)
      .map(day => ({
        日期: formatDate(day.date),
        星期: getDayOfWeek(day.date),
        值班人员: day.user ? (day.user.real_name || day.user.username) : '无安排',
        是否换班: day.isAdjusted ? '是' : '否',
        原值班人: day.originUser || '无'
      }));

    const headers = Object.keys(exportData[0] || {});
    const csvContent = [
      headers.join(','),
      ...exportData.map((row: any) => headers.map((header: any) => row[header] || '').join(','))
    ].join('\n');

    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${dutyGroupDetail.value?.name || '值班组'}_值班安排_${currentMonthYear.value}.csv`;
    link.click();

    message.success('值班安排已导出');
  } catch (error: any) {
    message.error('导出失败：' + (error.message || '未知错误'));
  } finally {
    exportLoading.value = false;
  }
};

// 事件处理
const handleTableChange = (pagination: any): void => {
  paginationConfig.current = pagination.current;
  paginationConfig.pageSize = pagination.pageSize;
  loadHistoryRecords();
};

const handleSearch = (): void => {
  paginationConfig.current = 1;
  loadHistoryRecords();
};

const handleDateChange = (): void => {
  paginationConfig.current = 1;
  loadHistoryRecords();
};

const handleCreateChange = (): void => {
  formDialog.isEdit = false;
  resetFormDialog();
  formDialogVisible.value = true;
};

const handleDayClick = (day: Day): void => {
  if (!day.isCurrentMonth) return;
  
  selectedDay.value = day;
  dayDetailVisible.value = true;
};

const openSwapModal = (day: Day): void => {
  formDialog.isEdit = false;
  formDialog.form = {
    id: undefined,
    date: dayjs(day.date),
    origin_user_id: day.user?.id || null,
    on_duty_user_id: null,
    reason: ''
  };
  formDialogVisible.value = true;
  dayDetailVisible.value = false;
};

// 表单保存
const saveChange = async (): Promise<void> => {
  try {
    if (!formDialog.form.date || 
        formDialog.form.origin_user_id === null || 
        formDialog.form.on_duty_user_id === null ||
        !formDialog.form.reason?.trim()) {
      message.error('请填写完整的表单信息');
      return;
    }

    if (formDialog.form.origin_user_id === formDialog.form.on_duty_user_id) {
      message.error('原值班人和新值班人不能相同');
      return;
    }

    submitting.value = true;

    // 创建换班记录
    const formData: CreateMonitorOnDutyGroupChangeReq = {
      on_duty_group_id: dutyGroupId.value,
      date: formDialog.form.date.format('YYYY-MM-DD'),
      origin_user_id: formDialog.form.origin_user_id as number,
      on_duty_user_id: formDialog.form.on_duty_user_id as number,
      reason: formDialog.form.reason?.trim()
    };

    const response = await createMonitorOnDutyGroupChangeApi(formData);
    if (response) {
      message.success('换班申请已提交');
      formDialogVisible.value = false;
      
      // 重新加载数据
      await Promise.all([
        loadHistoryRecords(),
        loadChangeRecords(1),
        fetchDutySchedule()
      ]);
    } else {
      message.error('创建换班记录失败');
    }
  } catch (error: any) {
    console.error('保存换班记录失败:', error);
    message.error(error.message || '保存换班记录失败');
  } finally {
    submitting.value = false;
  }
};

// 重置表单对话框
const resetFormDialog = (): void => {
  formDialog.form = {
    id: undefined,
    date: undefined,
    origin_user_id: null,
    on_duty_user_id: null,
    reason: ''
  };
};

// 对话框关闭
const closeFormDialog = (): void => {
  formDialogVisible.value = false;
};

const closeDayDetail = (): void => {
  dayDetailVisible.value = false;
  selectedDay.value = null;
};

// 生命周期钩子 - 修复初始化问题
onMounted(async () => {
  console.log('组件已挂载，开始初始化');
  // 使用 nextTick 确保所有函数都已初始化
  await nextTick();
  await initializeData();
});
</script>

<style scoped>
/* 保持原有样式不变 */
.duty-schedule-container {
  padding: 20px;
  background: #f5f7fa;
  min-height: 100vh;
}

/* 页面头部 */
.page-header {
  margin-bottom: 24px;
}

.header-content {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
  flex-wrap: wrap;
  gap: 16px;
}

.title-breadcrumb {
  display: flex;
  align-items: center;
  gap: 12px;
}

.back-btn {
  height: 40px;
  width: 40px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.page-title {
  font-size: 24px;
  font-weight: 600;
  color: #1a1a1a;
  margin: 0;
}

.breadcrumb {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  color: #666;
  margin-top: 4px;
}

.breadcrumb-item.current {
  color: #1890ff;
  font-weight: 500;
}

.header-actions {
  display: flex;
  gap: 12px;
}

.action-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 36px;
  padding: 0 16px;
  font-size: 16px;
}

/* 统计面板 */
.stats-section {
  margin-bottom: 24px;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 16px;
}

.stat-card {
  background: white;
  padding: 20px;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  display: flex;
  align-items: center;
  gap: 16px;
}

.stat-icon {
  width: 48px;
  height: 48px;
  border-radius: 8px;
  background: #1890ff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24px;
  color: white;
}

.stat-content {
  flex: 1;
}

.stat-number {
  font-size: 24px;
  font-weight: 600;
  color: #1a1a1a;
  margin-bottom: 4px;
}

.stat-label {
  font-size: 14px;
  color: #666;
}

/* 日历区域 */
.calendar-section {
  margin-bottom: 24px;
}

.calendar-card {
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.calendar-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
  flex-wrap: wrap;
  gap: 16px;
}

.calendar-nav {
  display: flex;
  align-items: center;
  gap: 16px;
}

.nav-btn {
  width: 36px;
  height: 36px;
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.calendar-title h2 {
  font-size: 20px;
  font-weight: 600;
  color: #1a1a1a;
  margin: 0;
}

.calendar-subtitle {
  font-size: 14px;
  color: #666;
  margin-top: 4px;
}

.calendar-actions {
  display: flex;
  gap: 8px;
}

/* 日历样式 */
.calendar {
  border: 1px solid #f0f0f0;
  border-radius: 8px;
  overflow: hidden;
}

.calendar-weekdays {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  background: #1890ff;
}

.weekday-header {
  padding: 12px;
  text-align: center;
  font-weight: 500;
  color: white;
  font-size: 14px;
}

.calendar-grid {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
}

.calendar-day {
  border-right: 1px solid #f0f0f0;
  border-bottom: 1px solid #f0f0f0;
  min-height: 100px;
  background: white;
  display: flex;
  flex-direction: column;
  transition: all 0.2s;
}

.calendar-day:nth-child(7n) {
  border-right: none;
}

.calendar-day.clickable {
  cursor: pointer;
}

.calendar-day.clickable:hover {
  background: #f0f9ff;
}

.calendar-day.has-duty {
  border-left: 3px solid #52c41a;
}

.calendar-day.today {
  background: #e6f7ff;
  border-left: 3px solid #1890ff;
}

.calendar-day.weekend {
  background: #fff7e6;
}

.calendar-day.is-adjusted {
  border-left: 3px solid #722ed1;
}

.calendar-day:not(.current-month) {
  background: #fafafa;
  opacity: 0.5;
}

.day-header {
  padding: 8px 12px;
  border-bottom: 1px solid #f0f0f0;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.day-number {
  font-size: 16px;
  font-weight: 500;
  color: #333;
}

.day-badges {
  display: flex;
  gap: 4px;
  flex-wrap: wrap;
}

.today-badge,
.weekend-badge,
.adjusted-badge {
  font-size: 10px;
  padding: 2px 4px;
  border-radius: 4px;
  color: white;
  font-weight: 500;
}

.today-badge {
  background: #1890ff;
}

.weekend-badge {
  background: #faad14;
}

.adjusted-badge {
  background: #722ed1;
}

.day-content {
  padding: 8px 12px;
  flex: 1;
  display: flex;
  flex-direction: column;
  justify-content: center;
}

.duty-info {
  display: flex;
  align-items: flex-start;
  gap: 8px;
}

.duty-details {
  flex: 1;
  min-width: 0;
}

.duty-name {
  font-size: 12px;
  color: #333;
  font-weight: 500;
  word-break: break-all;
}

.duty-extra {
  margin-top: 4px;
}

.original-user {
  font-size: 10px;
  color: #666;
  background: #f0f0f0;
  padding: 2px 4px;
  border-radius: 4px;
}

.no-duty {
  text-align: center;
}

.no-duty-text {
  font-size: 12px;
  color: #999;
}

/* 搜索区域 */
.search-section {
  display: flex;
  gap: 16px;
  margin-bottom: 16px;
  flex-wrap: wrap;
}

.search-input {
  width: 300px;
}

.filter-select {
  width: 180px;
}

/* 表格区域 */
.records-section .section-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 16px;
  font-weight: 500;
}

.records-table {
  background: white;
}

.date-cell {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.date-main {
  font-weight: 500;
  color: #333;
}

.date-sub {
  font-size: 12px;
  color: #999;
}

.users-change {
  display: flex;
  align-items: center;
  gap: 8px;
}

.user-item {
  display: flex;
  align-items: center;
  gap: 6px;
  flex: 1;
  min-width: 0;
}

.user-name {
  font-size: 14px;
  color: #333;
  word-break: break-all;
}

.arrow {
  color: #1890ff;
  flex-shrink: 0;
}

/* 空状态 */
.empty-state {
  text-align: center;
  padding: 40px 20px;
}

.empty-icon {
  font-size: 48px;
  color: #ccc;
  margin-bottom: 16px;
}

.empty-title {
  font-size: 16px;
  color: #333;
  margin-bottom: 8px;
  font-weight: 500;
}

.empty-description {
  font-size: 14px;
  color: #666;
  line-height: 1.5;
}

/* 日期详情对话框 */
.day-detail-container {
  padding: 16px 0;
}

.day-detail-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
  padding-bottom: 12px;
  border-bottom: 2px solid #f0f0f0;
}

.date-display {
  display: flex;
  align-items: center;
  gap: 12px;
}

.date-large {
  font-size: 36px;
  font-weight: 700;
  color: #1890ff;
  line-height: 1;
}

.date-info {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.date-month {
  font-size: 16px;
  font-weight: 600;
  color: #333;
}

.date-weekday {
  font-size: 14px;
  color: #666;
}

.day-badges {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.duty-detail-content {
  margin-bottom: 16px;
}

.duty-assigned {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.duty-user-info {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px;
  background: #f0f9ff;
  border-radius: 8px;
  border: 1px solid #bae7ff;
}

.user-details {
  flex: 1;
}

.user-details .user-name {
  font-size: 16px;
  font-weight: 600;
  color: #1890ff;
  margin-bottom: 4px;
}

.user-role {
  font-size: 14px;
  color: #666;
}

.change-info {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 16px;
  background: #f9f0ff;
  border: 1px solid #d3adf7;
  border-radius: 8px;
  color: #722ed1;
  font-size: 14px;
}

.change-icon {
  font-size: 16px;
}

.duty-actions-full {
  margin-top: 8px;
}

.duty-unassigned {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  padding: 32px 20px;
  text-align: center;
}

.unassigned-icon {
  font-size: 48px;
  color: #ccc;
}

.unassigned-text {
  font-size: 16px;
  color: #666;
}

/* 响应式设计 */
@media (max-width: 768px) {
  .duty-schedule-container {
    padding: 16px;
  }
  
  .header-content {
    flex-direction: column;
    align-items: stretch;
  }
  
  .search-section {
    flex-direction: column;
  }
  
  .search-input,
  .filter-select {
    width: 100%;
  }
  
  .stats-grid {
    grid-template-columns: repeat(2, 1fr);
  }
  
  .calendar-header {
    flex-direction: column;
    text-align: center;
  }
  
  .calendar-day {
    min-height: 80px;
  }

  .date-display {
    flex-direction: column;
    text-align: center;
    gap: 8px;
  }

  .day-detail-header {
    flex-direction: column;
    gap: 12px;
  }

  .users-change {
    flex-direction: column;
    gap: 8px;
  }

  .arrow {
    transform: rotate(90deg);
  }
}

@media (max-width: 480px) {
  .stats-grid {
    grid-template-columns: 1fr;
  }
  
  .calendar-day {
    min-height: 70px;
  }
  
  .duty-name {
    font-size: 11px;
  }
  
  .day-number {
    font-size: 14px;
  }
  
  .stat-number {
    font-size: 20px;
  }

  .date-large {
    font-size: 28px;
  }
}
</style>
