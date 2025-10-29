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

export function useCloudResourceManager() {
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

  return {
    // Icons
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

    // Constants
    Empty,
    CloudResourceType,
    CloudResourceStatus,
    ChargeType,
    AuthMode,
    SyncMode,

    // States
    loading,
    detailLoading,
    submitLoading,
    syncLoading,
    bindLoading,
    unbindLoading,
    syncHistoryLoading,
    changeLogLoading,
    editModalVisible,
    syncModalVisible,
    bindModalVisible,
    unbindModalVisible,
    detailVisible,
    syncHistoryModalVisible,
    changeLogModalVisible,
    resources,
    cloudAccounts,
    treeData,
    syncHistoryList,
    changeLogList,
    currentResource,
    currentDetail,
    editForm,
    syncForm,
    newTagKey,
    newTagValue,
    selectedTreeNodeIds,
    selectedUnbindNodeIds,
    filterForm,
    pagination,
    syncHistoryPagination,
    changeLogPagination,

    // Computed
    stats,
    paginationConfig,
    columns,
    syncHistoryColumns,
    changeLogColumns,

    // Methods
    getResourceTypeColor,
    getResourceTypeText,
    getResourceTypeIcon,
    getEnvironmentColor,
    getEnvironmentText,
    getStatusBadgeType,
    getStatusText,
    getChangeTypeColor,
    getChangeTypeText,
    getAvatarColor,
    getInitials,
    formatDateTime,
    formatCost,
    truncateText,
    fetchTreeData,
    fetchCloudAccounts,
    fetchResources,
    fetchSyncHistory,
    fetchChangeLog,
    handleTableChange,
    handleSearch,
    handleRefresh,
    resetFilter,
    showSyncModal,
    showSyncHistoryModal,
    showChangeLogModal,
    handleEdit,
    handleViewDetail,
    addTag,
    removeTag,
    handleUpdate,
    handleSync,
    handleSyncHistoryTableChange,
    handleChangeLogTableChange,
    showBindModal,
    handleBind,
    showUnbindModal,
    handleUnbind,
    handleUpdateStatus,
    handleConnectTerminal,
    handleDelete,
    handleExportCurrent,
    handleExportAll,
    exportToExcel,
  };
}

