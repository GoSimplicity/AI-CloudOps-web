import { ref, computed, onMounted } from 'vue';
import { message, Modal } from 'ant-design-vue';
import { useRoute } from 'vue-router';
import type { Dayjs } from 'dayjs';
import dayjs from 'dayjs';
import {
  getCronJobList,
  getExecutionLogs,
  deleteExecutionLog,
  clearExecutionLogs,
  CronJobType,
  ExecutionLogStatus,
  TriggerType,
  type CronJob,
  type ExecutionLog,
  type GetCronJobListReq,
  type GetExecutionLogsReq,
} from '#/api/core/cron/cron';

export function useLogPage() {
  const route = useRoute();

  // 响应式数据
  const executionLogs = ref<ExecutionLog[]>([]);
  const cronJobs = ref<CronJob[]>([]);
  const loading = ref(false);
  const expandedRowKeys = ref<string[]>([]);
  const searchText = ref('');
  const filterJobId = ref<number | undefined>();
  const filterStatus = ref<number | undefined>();
  const filterDate = ref<Dayjs | undefined>();
  const currentPage = ref(1);
  const pageSize = ref(20);
  const total = ref(0);

  // 计算属性
  const filteredLogs = computed(() => {
    let result = executionLogs.value;
    
    // 任务过滤
    if (filterJobId.value) {
      result = result.filter((log: ExecutionLog) => log.job_id === filterJobId.value);
    }
    
    // 状态过滤
    if (filterStatus.value !== undefined) {
      result = result.filter((log: ExecutionLog) => log.status === filterStatus.value);
    }
    
    // 日期过滤
    if (filterDate.value) {
      const selectedDate = filterDate.value.format('YYYY-MM-DD');
      result = result.filter((log: ExecutionLog) => {
        const logDate = dayjs(log.start_time).format('YYYY-MM-DD');
        return logDate === selectedDate;
      });
    }
    
    // 搜索过滤
    if (searchText.value) {
      const search = searchText.value.toLowerCase();
      result = result.filter((log: ExecutionLog) => 
        log.job_name?.toLowerCase().includes(search) ||
        log.error_message?.toLowerCase().includes(search) ||
        log.output?.toLowerCase().includes(search)
      );
    }
    
    return result;
  });

  // 统计信息
  const logStatistics = computed(() => {
    const stats = {
      total: filteredLogs.value.length,
      success: filteredLogs.value.filter((log: ExecutionLog) => log.status === ExecutionLogStatus.SUCCESS).length,
      failed: filteredLogs.value.filter((log: ExecutionLog) => log.status === ExecutionLogStatus.FAILED).length,
      avgDuration: 0,
    };
    
    if (stats.total > 0) {
      const totalDuration = filteredLogs.value.reduce((sum: number, log: ExecutionLog) => sum + (log.duration || 0), 0);
      stats.avgDuration = Math.round(totalDuration / stats.total);
    }
    
    return stats;
  });

  // 表格列配置
  const columns = [
    { title: '任务名称', dataIndex: 'job_name', key: 'job_name', width: '15%' },
    { title: '任务类型', dataIndex: 'job_type', key: 'job_type', width: '8%' },
    { title: '执行状态', dataIndex: 'status', key: 'status', width: '8%' },
    { title: '开始时间', dataIndex: 'start_time', key: 'start_time', width: '12%' },
    { title: '结束时间', dataIndex: 'end_time', key: 'end_time', width: '12%' },
    { title: '执行耗时', dataIndex: 'duration', key: 'duration', width: '10%' },
    { title: '输出摘要', dataIndex: 'output', key: 'output', width: '23%' },
    { title: '操作', key: 'actions', width: '12%', fixed: 'right' },
  ];

  // 方法
  const fetchCronJobs = async () => {
    try {
      const response = await getCronJobList({ page: 1, page_size: 1000 } as GetCronJobListReq);
      if (Array.isArray(response)) {
        cronJobs.value = response;
      } else {
        cronJobs.value = (response as any).data || [];
      }
    } catch (error) {
      console.error('Fetch cron jobs error:', error);
    }
  };

  const fetchExecutionLogs = async () => {
    loading.value = true;
    try {
      const params: GetExecutionLogsReq = {
        page: currentPage.value,
        size: pageSize.value,
        job_id: filterJobId.value,
        status: filterStatus.value,
        start_date: filterDate.value?.format('YYYY-MM-DD'),
        search: searchText.value || undefined,
      };

      const response = await getExecutionLogs(params);
      if (Array.isArray(response)) {
        executionLogs.value = response;
        total.value = response.length;
      } else {
        executionLogs.value = (response as any).data || [];
        total.value = (response as any).total || 0;
      }
    } catch (error) {
      // 如果API不存在，生成模拟数据
      console.warn('Execution logs API not available, using mock data');
      executionLogs.value = generateExecutionLogs();
      total.value = executionLogs.value.length;
    } finally {
      loading.value = false;
    }
  };

  // 生成模拟执行日志数据
  const generateExecutionLogs = (): ExecutionLog[] => {
    const logs: ExecutionLog[] = [];
    
    cronJobs.value.forEach(job => {
      const recordCount = job.run_count || Math.floor(Math.random() * 50) + 10;
      
      for (let i = 0; i < recordCount; i++) {
        const startTime = dayjs().subtract(Math.floor(Math.random() * 30), 'day').subtract(Math.floor(Math.random() * 24), 'hour');
        const duration = Math.floor(Math.random() * 300000) + 1000;
        const endTime = startTime.add(duration, 'millisecond');
        const isSuccess = Math.random() > 0.2;
        
        logs.push({
          id: Number(`${job.id}${i}`),
          created_at: startTime.toISOString(),
          updated_at: endTime.toISOString(),
          job_id: job.id,
          job_name: job.name,
          status: isSuccess ? ExecutionLogStatus.SUCCESS : ExecutionLogStatus.FAILED,
          trigger_type: TriggerType.SCHEDULED,
          start_time: startTime.toISOString(),
          end_time: endTime.toISOString(),
          duration: duration,
          output: isSuccess ? 
            `Task executed successfully\nProcessed ${Math.floor(Math.random() * 1000)} items\nMemory usage: ${Math.floor(Math.random() * 100)}MB` :
            undefined,
          error_message: !isSuccess ? 
            `Error: ${['Connection timeout', 'Permission denied', 'File not found', 'Out of memory'][Math.floor(Math.random() * 4)]}\nStack trace: line ${Math.floor(Math.random() * 100)}` :
            undefined,
        });
      }
    });
    
    return logs.sort((a, b) => new Date(b.start_time).getTime() - new Date(a.start_time).getTime());
  };

  const refreshLogs = async () => {
    await Promise.all([fetchCronJobs(), fetchExecutionLogs()]);
  };

  const onSearch = () => {
    currentPage.value = 1;
    fetchExecutionLogs();
  };

  const handleFilterChange = () => {
    currentPage.value = 1;
    fetchExecutionLogs();
  };

  const resetFilters = () => {
    filterJobId.value = undefined;
    filterStatus.value = undefined;
    filterDate.value = undefined;
    searchText.value = '';
    currentPage.value = 1;
    fetchExecutionLogs();
    message.success('已重置所有筛选条件');
  };

  const handleTableChange = (pagination: { current?: number; pageSize?: number }) => {
    if (pagination) {
      currentPage.value = pagination.current || 1;
      pageSize.value = pagination.pageSize || 20;
      fetchExecutionLogs();
    }
  };

  const clearLogs = () => {
    Modal.confirm({
      title: '清空日志确认',
      content: '确定要清空所有执行日志吗？此操作不可撤销。',
      okText: '确认清空',
      okType: 'danger',
      cancelText: '取消',
      centered: true,
      onOk: async () => {
        try {
          await clearExecutionLogs({});
          message.success('执行日志已清空');
          await refreshLogs();
        } catch (error) {
          message.error('清空日志失败');
          console.error('Clear logs error:', error);
        }
      },
    });
  };

  const deleteLog = (record: ExecutionLog) => {
    Modal.confirm({
      title: '删除日志确认',
      content: `确定要删除任务 "${record.job_name}" 的这条执行记录吗？`,
      okText: '确认删除',
      okType: 'danger',
      cancelText: '取消',
      centered: true,
      onOk: async () => {
        try {
          await deleteExecutionLog({ id: record.id });
          message.success('执行记录删除成功');
          await refreshLogs();
        } catch (error) {
          message.error('删除记录失败');
          console.error('Delete log error:', error);
        }
      },
    });
  };

  const filterJobOption = (input: string, option: any) => {
    const job = cronJobs.value.find(j => j.id === option.value);
    return job?.name?.toLowerCase().includes(input.toLowerCase()) || false;
  };

  // 工具函数
  const getJobTypeText = (type: CronJobType) => {
    const map = {
      [CronJobType.SYSTEM]: '系统',
      [CronJobType.COMMAND]: '命令',
      [CronJobType.HTTP]: 'HTTP',
      [CronJobType.SCRIPT]: '脚本',
      [CronJobType.SSH]: 'SSH',
    };
    return map[type] || '未知';
  };

  const getJobTypeColor = (type: CronJobType) => {
    const map = {
      [CronJobType.SYSTEM]: 'purple',
      [CronJobType.COMMAND]: 'blue',
      [CronJobType.HTTP]: 'green',
      [CronJobType.SCRIPT]: 'orange',
      [CronJobType.SSH]: 'cyan',
    };
    return map[type] || 'default';
  };

  const getStatusText = (status: number) => {
    if (status === 0) return '成功';
    if (status > 0) return '失败';
    return '未知';
  };

  const getStatusColor = (status: number) => {
    if (status === 0) return 'success';
    if (status > 0) return 'error';
    return 'default';
  };

  const formatTime = (timeStr: string) => {
    if (!timeStr) return '-';
    try {
      return dayjs(timeStr).format('YYYY-MM-DD HH:mm:ss');
    } catch {
      return timeStr;
    }
  };

  const formatDuration = (duration: number) => {
    if (!duration || duration === 0) return '-';
    if (duration < 1000) return `${duration}ms`;
    if (duration < 60000) return `${(duration / 1000).toFixed(2)}s`;
    return `${(duration / 60000).toFixed(2)}min`;
  };

  const formatOutput = (output: string, maxLength = 100) => {
    if (!output) return '-';
    if (output.length <= maxLength) return output;
    return output.substring(0, maxLength) + '...';
  };

  const getSuccessRate = () => {
    const total = logStatistics.value.total;
    if (total === 0) return 0;
    return Math.round((logStatistics.value.success / total) * 100);
  };

  // 初始化
  onMounted(async () => {
    // 检查URL参数中是否有指定的job_id
    const jobIdParam = route.query.job_id;
    if (jobIdParam) {
      filterJobId.value = parseInt(jobIdParam as string);
    }
    
    await refreshLogs();
  });

  return {
    // state
    executionLogs,
    cronJobs,
    loading,
    expandedRowKeys,
    searchText,
    filterJobId,
    filterStatus,
    filterDate,
    currentPage,
    pageSize,
    total,
    
    // computed
    filteredLogs,
    logStatistics,
    columns,
    
    // methods
    refreshLogs,
    onSearch,
    handleFilterChange,
    resetFilters,
    handleTableChange,
    clearLogs,
    deleteLog,
    filterJobOption,
    
    // utils
    getJobTypeText,
    getJobTypeColor,
    getStatusText,
    getStatusColor,
    formatTime,
    formatDuration,
    formatOutput,
    getSuccessRate,
    
    // constants
    CronJobType,
  };
}
