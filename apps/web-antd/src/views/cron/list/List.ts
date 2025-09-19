import { ref, computed, onMounted } from 'vue';
import { message, Modal } from 'ant-design-vue';
import { useRouter } from 'vue-router';
import {
  getCronJobList,
  enableCronJob,
  disableCronJob,
  deleteCronJob,
  triggerCronJob,
  getCronJobDetail,
  CronJobStatus,
  CronJobType,
  type CronJob,
  type GetCronJobListReq
} from '#/api/core/cron/cron';

export function useListManager() {
  const router = useRouter();

  // 响应式数据
  const loading = ref(false);
  const data = ref<CronJob[]>([]);
  const selectedRows = ref<CronJob[]>([]);
  const currentPage = ref(1);
  const pageSize = ref(20);
  const total = ref(0);

  // 搜索和筛选
  const searchText = ref('');
  const filterStatus = ref<CronJobStatus>();
  const filterType = ref<CronJobType>();

  // 模态框状态
  const modalVisible = ref(false);
  const detailVisible = ref(false);
  const isEdit = ref(false);
  const currentJob = ref<CronJob | null>(null);

  // 计算属性
  const filteredData = computed(() => {
    let result = data.value;
    
    if (searchText.value) {
      result = result.filter(item => 
        item.name.toLowerCase().includes(searchText.value.toLowerCase()) ||
        item.description?.toLowerCase().includes(searchText.value.toLowerCase())
      );
    }
    
    if (filterStatus.value !== undefined) {
      result = result.filter(item => item.status === filterStatus.value);
    }
    
    if (filterType.value !== undefined) {
      result = result.filter(item => item.job_type === filterType.value);
    }
    
    return result;
  });

  const stats = computed(() => {
    const total = data.value.length;
    const enabled = data.value.filter(item => item.status === CronJobStatus.ENABLED).length;
    const running = data.value.filter(item => item.status === CronJobStatus.RUNNING).length;
    const error = data.value.filter(item => item.status === CronJobStatus.ERROR).length;
    
    return { total, enabled, running, error };
  });

  const rowSelection = computed(() => ({
    selectedRowKeys: selectedRows.value.map(row => row.id),
    onChange: (_keys: number[], rows: CronJob[]) => {
      selectedRows.value = rows;
    }
  }));

  const canBatchEnable = computed(() => 
    selectedRows.value.some(row => row.status === CronJobStatus.DISABLED)
  );

  const canBatchDisable = computed(() => 
    selectedRows.value.some(row => row.status === CronJobStatus.ENABLED)
  );

  // 表格列配置
  const columns = [
    { title: '任务名称', dataIndex: 'name', key: 'name', width: 200 },
    { title: '状态', key: 'status', width: 100 },
    { title: '类型', key: 'job_type', width: 100 },
    { title: '调度表达式', key: 'schedule', width: 150 },
    { title: '下次执行', key: 'next_run_time', width: 150 },
    { title: '上次执行', key: 'last_run', width: 200 },
    { title: '执行统计', key: 'statistics', width: 150 },
    { title: '操作', key: 'actions', width: 300, fixed: 'right' }
  ];

  // 方法
  const refreshData = async () => {
    loading.value = true;
    try {
      const params: GetCronJobListReq = {
        page: currentPage.value,
        size: pageSize.value,
        status: filterStatus.value,
        job_type: filterType.value,
        search: searchText.value || undefined
      };
      const res = await getCronJobList(params);
      if (res && Array.isArray(res)) {
        data.value = res;
        total.value = res.length;
      }
    } catch (error) {
      message.error('获取任务列表失败');
      console.error('Fetch cron jobs error:', error);
    } finally {
      loading.value = false;
    }
  };

  const handleSearch = () => {
    currentPage.value = 1;
    refreshData();
  };

  const handleFilter = () => {
    currentPage.value = 1;
    refreshData();
  };

  const handleTableChange = (pagination: any) => {
    currentPage.value = pagination.current;
    pageSize.value = pagination.pageSize;
    refreshData();
  };

  // 模态框操作
  const openCreateModal = () => {
    isEdit.value = false;
    currentJob.value = null;
    modalVisible.value = true;
  };

  const editJob = async (job: CronJob) => {
    try {
      loading.value = true;
      const detail = await getCronJobDetail({ id: job.id });
      currentJob.value = detail;
      isEdit.value = true;
      modalVisible.value = true;
    } catch (error) {
      message.error('获取任务详情失败');
      console.error('Get job detail error:', error);
    } finally {
      loading.value = false;
    }
  };

  const viewDetail = async (job: CronJob) => {
    try {
      loading.value = true;
      const detail = await getCronJobDetail({ id: job.id });
      currentJob.value = detail;
      detailVisible.value = true;
    } catch (error) {
      message.error('获取任务详情失败');
      console.error('Get job detail error:', error);
    } finally {
      loading.value = false;
    }
  };

  const viewLogs = (job: CronJob) => {
    router.push(`/cron/log?job_id=${job.id}`);
  };

  const handleModalSuccess = () => {
    modalVisible.value = false;
    refreshData();
  };

  // 任务操作
  const triggerJob = async (job: CronJob) => {
    try {
      await triggerCronJob({ id: job.id });
      message.success(`任务 "${job.name}" 已触发执行`);
      refreshData();
    } catch (error) {
      message.error('触发任务失败');
      console.error('Trigger job error:', error);
    }
  };

  const enableJob = async (job: CronJob) => {
    try {
      await enableCronJob({ id: job.id });
      message.success(`任务 "${job.name}" 已启用`);
      refreshData();
    } catch (error) {
      message.error('启用任务失败');
      console.error('Enable job error:', error);
    }
  };

  const disableJob = async (job: CronJob) => {
    try {
      await disableCronJob({ id: job.id });
      message.success(`任务 "${job.name}" 已禁用`);
      refreshData();
    } catch (error) {
      message.error('禁用任务失败');
      console.error('Disable job error:', error);
    }
  };

  const deleteJob = (job: CronJob) => {
    Modal.confirm({
      title: '删除确认',
      content: `确定要删除任务 "${job.name}" 吗？此操作不可撤销。`,
      onOk: async () => {
        try {
          await deleteCronJob({ id: job.id });
          message.success('删除成功');
          refreshData();
        } catch (error) {
          message.error('删除失败');
          console.error('Delete job error:', error);
        }
      }
    });
  };

  // 批量操作
  const batchEnable = async () => {
    const jobs = selectedRows.value.filter(job => job.status === CronJobStatus.DISABLED);
    if (jobs.length === 0) {
      message.warning('没有可启用的任务');
      return;
    }
    
    try {
      await Promise.all(jobs.map(job => enableCronJob({ id: job.id })));
      message.success(`已启用 ${jobs.length} 个任务`);
      selectedRows.value = [];
      refreshData();
    } catch (error) {
      message.error('批量启用失败');
      console.error('Batch enable error:', error);
    }
  };

  const batchDisable = async () => {
    const jobs = selectedRows.value.filter(job => job.status === CronJobStatus.ENABLED);
    if (jobs.length === 0) {
      message.warning('没有可禁用的任务');
      return;
    }
    
    try {
      await Promise.all(jobs.map(job => disableCronJob({ id: job.id })));
      message.success(`已禁用 ${jobs.length} 个任务`);
      selectedRows.value = [];
      refreshData();
    } catch (error) {
      message.error('批量禁用失败');
      console.error('Batch disable error:', error);
    }
  };

  const batchDelete = () => {
    Modal.confirm({
      title: '批量删除确认',
      content: `确定要删除选中的 ${selectedRows.value.length} 个任务吗？此操作不可撤销。`,
      onOk: async () => {
        try {
          await Promise.all(selectedRows.value.map(job => deleteCronJob({ id: job.id })));
          message.success(`已删除 ${selectedRows.value.length} 个任务`);
          selectedRows.value = [];
          refreshData();
        } catch (error) {
          message.error('批量删除失败');
          console.error('Batch delete error:', error);
        }
      }
    });
  };

  // 工具函数
  const getStatusBadge = (status: CronJobStatus) => {
    const map = {
      [CronJobStatus.ENABLED]: 'success',
      [CronJobStatus.DISABLED]: 'default',
      [CronJobStatus.RUNNING]: 'processing',
      [CronJobStatus.ERROR]: 'error'
    };
    return map[status] || 'default';
  };

  const getStatusText = (status: CronJobStatus) => {
    const map = {
      [CronJobStatus.ENABLED]: '启用',
      [CronJobStatus.DISABLED]: '禁用',
      [CronJobStatus.RUNNING]: '运行中',
      [CronJobStatus.ERROR]: '异常'
    };
    return map[status] || '未知';
  };

  const getTypeColor = (type: CronJobType) => {
    const map = {
      [CronJobType.SYSTEM]: 'purple',
      [CronJobType.COMMAND]: 'blue',
      [CronJobType.HTTP]: 'green',
      [CronJobType.SCRIPT]: 'orange',
      [CronJobType.SSH]: 'cyan'
    };
    return map[type] || 'default';
  };

  const getTypeText = (type: CronJobType) => {
    const map = {
      [CronJobType.SYSTEM]: '系统任务',
      [CronJobType.COMMAND]: '命令任务',
      [CronJobType.HTTP]: 'HTTP任务',
      [CronJobType.SCRIPT]: '脚本任务',
      [CronJobType.SSH]: 'SSH任务'
    };
    return map[type] || '未知';
  };

  const getRunStatusColor = (status: number) => {
    if (status === 0) return 'success';
    if (status > 0) return 'error';
    return 'default';
  };

  const getRunStatusText = (status: number) => {
    if (status === 0) return '成功';
    if (status > 0) return '失败';
    return '未执行';
  };

  const formatTime = (timeStr: string) => {
    if (!timeStr) return '-';
    try {
      return new Date(timeStr).toLocaleString('zh-CN');
    } catch {
      return timeStr;
    }
  };

  const formatDuration = (duration: number) => {
    if (duration < 1000) return `${duration}ms`;
    if (duration < 60000) return `${(duration / 1000).toFixed(2)}s`;
    return `${(duration / 60000).toFixed(2)}min`;
  };

  const getScheduleDescription = (schedule: string) => {
    // 简单的Cron表达式说明
    if (schedule === '0 0 * * * *') return '每小时执行一次';
    if (schedule === '0 */5 * * * *') return '每5分钟执行一次';
    if (schedule === '0 0 0 * * *') return '每天0点执行一次';
    return 'Cron表达式格式：秒 分 时 日 月 周';
  };

  // 生命周期
  onMounted(() => {
    refreshData();
  });

  return {
    // 响应式数据
    loading,
    data,
    selectedRows,
    currentPage,
    pageSize,
    total,
    searchText,
    filterStatus,
    filterType,
    modalVisible,
    detailVisible,
    isEdit,
    currentJob,
    
    // 计算属性
    filteredData,
    stats,
    rowSelection,
    canBatchEnable,
    canBatchDisable,
    columns,
    
    // 方法
    refreshData,
    handleSearch,
    handleFilter,
    handleTableChange,
    openCreateModal,
    editJob,
    viewDetail,
    viewLogs,
    triggerJob,
    enableJob,
    disableJob,
    deleteJob,
    batchEnable,
    batchDisable,
    batchDelete,
    handleModalSuccess,
    
    // 工具函数
    getStatusBadge,
    getStatusText,
    getTypeColor,
    getTypeText,
    getRunStatusColor,
    getRunStatusText,
    formatTime,
    formatDuration,
    getScheduleDescription,
    
    // 常量
    CronJobStatus,
    CronJobType
  };
}
