import { ref, reactive, onMounted, computed } from 'vue';
import { message, Modal } from 'ant-design-vue';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  CloudOutlined,
  SearchOutlined,
  EnvironmentOutlined,
  SafetyCertificateOutlined,
  CheckCircleOutlined,
  EyeOutlined,
  UserOutlined,
  KeyOutlined,
  LockOutlined,
  TagsOutlined,
  InfoCircleOutlined,
  ClockCircleOutlined,
  CloudServerOutlined,
  GlobalOutlined,
  ClearOutlined,
  ExportOutlined,
  FileExcelOutlined,
} from '@ant-design/icons-vue';

import {
  getCloudAccountListApi,
  getCloudAccountDetailApi,
  createCloudAccountApi,
  updateCloudAccountApi,
  deleteCloudAccountApi,
  updateCloudAccountStatusApi,
  verifyCloudAccountApi,
  CloudProvider,
  CloudAccountStatus,
  type CloudAccount,
  type GetCloudAccountListReq,
  type CreateCloudAccountReq,
  type UpdateCloudAccountReq,
} from '#/api/core/tree/tree_account';
import * as XLSX from 'xlsx';

export function useCloudAccountManagement() {
  // ========== 状态定义 ==========
  const loading = ref(false);
  const detailLoading = ref(false);
  const submitLoading = ref(false);
  const verifyLoading = ref(false);
  const modalVisible = ref(false);
  const detailVisible = ref(false);
  const isEdit = ref(false);
  const switchLoading = ref<Record<number, boolean>>({});

  const formRef = ref();
  const cloudAccounts = ref<CloudAccount[]>([]);
  const currentDetail = ref<CloudAccount | null>(null);

  const pagination = reactive({
    current: 1,
    pageSize: 10,
    total: 0,
  });

  const filterForm = reactive<GetCloudAccountListReq>({
    page: 1,
    size: 10,
    search: undefined,
    provider: undefined,
    region: undefined,
    status: undefined,
  });

  const formData = ref<CreateCloudAccountReq & { id?: number }>({
    name: '',
    provider: CloudProvider.AliCloud,
    region: '',
    access_key: '',
    secret_key: '',
    account_id: '',
    account_name: '',
    account_alias: '',
    description: '',
  });

  // ========== 计算属性 ==========
  const enabledCount = computed(() => 
    cloudAccounts.value.filter(item => item.status === CloudAccountStatus.Enabled).length
  );

  const aliCloudCount = computed(() => 
    cloudAccounts.value.filter(item => item.provider === CloudProvider.AliCloud).length
  );

  const tencentCloudCount = computed(() => 
    cloudAccounts.value.filter(item => item.provider === CloudProvider.TencentCloud).length
  );

  const paginationConfig = computed(() => ({
    current: pagination.current,
    pageSize: pagination.pageSize,
    total: pagination.total,
    showSizeChanger: true,
    showQuickJumper: true,
    showTotal: (total: number) => `共 ${total} 条记录`,
    pageSizeOptions: ['10', '20', '50', '100'],
  }));

  const formRules = computed(() => ({
    name: [
      { required: true, message: '请输入云账户名称', trigger: 'blur' },
      { min: 2, max: 100, message: '名称长度在2-100个字符之间', trigger: 'blur' },
    ],
    provider: [{ required: true, message: '请选择云厂商', trigger: 'change' }],
    region: [
      { required: true, message: '请输入地域', trigger: 'blur' },
      { min: 2, max: 50, message: '地域长度在2-50个字符之间', trigger: 'blur' },
    ],
    access_key: isEdit.value 
      ? []
      : [
          { required: true, message: '请输入 Access Key', trigger: 'blur' },
          { min: 10, message: 'Access Key 长度至少10位', trigger: 'blur' },
        ],
    secret_key: isEdit.value
      ? []
      : [
          { required: true, message: '请输入 Secret Key', trigger: 'blur' },
          { min: 10, message: 'Secret Key 长度至少10位', trigger: 'blur' },
        ],
  }));

  // 表格列定义
  const columns = [
    { title: '账户名称', dataIndex: 'name', key: 'name', width: 200, fixed: 'left' as const },
    { title: '云厂商', dataIndex: 'provider', key: 'provider', width: 130 },
    { title: '地域', dataIndex: 'region', key: 'region', width: 150 },
    { title: '账户信息', key: 'account_info', width: 250 },
    { title: '状态', dataIndex: 'status', key: 'status', width: 120 },
    { title: '创建人', key: 'creator', width: 140 },
    { title: '创建时间', key: 'created_at', width: 180 },
    { title: '操作', key: 'action', fixed: 'right' as const, width: 180, align: 'center' as const },
  ];

  // ========== 辅助方法 ==========
  const getProviderColor = (provider: CloudProvider): string => {
    const colorMap: Record<CloudProvider, string> = {
      [CloudProvider.AliCloud]: '#ff6a00',
      [CloudProvider.TencentCloud]: '#006eff',
      [CloudProvider.HuaweiCloud]: '#e60012',
      [CloudProvider.AWS]: '#ff9900',
      [CloudProvider.Azure]: '#0078d4',
      [CloudProvider.GCP]: '#4285f4',
    };
    return colorMap[provider] || '#1890ff';
  };

  const getProviderText = (provider: CloudProvider): string => {
    const textMap: Record<CloudProvider, string> = {
      [CloudProvider.AliCloud]: '阿里云',
      [CloudProvider.TencentCloud]: '腾讯云',
      [CloudProvider.HuaweiCloud]: '华为云',
      [CloudProvider.AWS]: 'AWS',
      [CloudProvider.Azure]: 'Azure',
      [CloudProvider.GCP]: 'GCP',
    };
    return textMap[provider] || '未知';
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

  const truncateText = (text: string, maxLength: number): string => {
    if (text.length <= maxLength) return text;
    return text.slice(0, maxLength) + '...';
  };

  const fetchCloudAccounts = async (): Promise<void> => {
    loading.value = true;
    try {
      const params: GetCloudAccountListReq = {
        page: pagination.current,
        size: pagination.pageSize,
      };
      
      // 使用过滤条件
      if (filterForm.search) params.search = filterForm.search;
      if (filterForm.provider) params.provider = filterForm.provider;
      if (filterForm.region) params.region = filterForm.region;
      if (filterForm.status !== undefined) params.status = filterForm.status;

      const response = await getCloudAccountListApi(params);
      cloudAccounts.value = response.items || [];
      pagination.total = response.total || 0;
    } catch (error) {
      message.error('获取云账户列表失败');
      cloudAccounts.value = [];
      pagination.total = 0;
    } finally {
      loading.value = false;
    }
  };

  // ========== 事件处理 ==========
  const handleTableChange = (pag: any): void => {
    pagination.current = pag.current;
    pagination.pageSize = pag.pageSize;
    filterForm.page = pag.current;
    filterForm.size = pag.pageSize;
    fetchCloudAccounts();
  };

  const handleSearch = (): void => {
    pagination.current = 1;
    filterForm.page = 1;
    fetchCloudAccounts();
  };

  const handleSearchChange = (): void => {
    if (!filterForm.search) {
      handleSearch();
    }
  };

  const resetFilter = (): void => {
    filterForm.search = undefined;
    filterForm.provider = undefined;
    filterForm.region = undefined;
    filterForm.status = undefined;
    pagination.current = 1;
    filterForm.page = 1;
    filterForm.size = pagination.pageSize; // 保持分页大小同步
    fetchCloudAccounts();
    message.success('筛选条件已重置');
  };

  const showCreateModal = (): void => {
    isEdit.value = false;
    formData.value = {
      name: '',
      provider: CloudProvider.AliCloud,
      region: '',
      access_key: '',
      secret_key: '',
      account_id: '',
      account_name: '',
      account_alias: '',
      description: '',
    };
    modalVisible.value = true;
  };

  const handleEdit = (record: CloudAccount): void => {
    isEdit.value = true;
    formData.value = {
      id: record.id,
      name: record.name,
      provider: record.provider,
      region: record.region,
      access_key: '',
      secret_key: '',
      account_id: record.account_id || '',
      account_name: record.account_name || '',
      account_alias: record.account_alias || '',
      description: record.description || '',
    };
    modalVisible.value = true;
    detailVisible.value = false;
  };

  const handleSubmit = async (): Promise<void> => {
    try {
      await formRef.value?.validate();
      submitLoading.value = true;

      if (isEdit.value && formData.value.id) {
        const updateData: Omit<UpdateCloudAccountReq, 'id'> = {
          name: formData.value.name,
          account_id: formData.value.account_id || undefined,
          account_name: formData.value.account_name || undefined,
          account_alias: formData.value.account_alias || undefined,
          description: formData.value.description || undefined,
        };
        
        if (formData.value.access_key) updateData.access_key = formData.value.access_key;
        if (formData.value.secret_key) updateData.secret_key = formData.value.secret_key;

        await updateCloudAccountApi(formData.value.id, updateData);
        message.success('云账户更新成功');
      } else {
        await createCloudAccountApi(formData.value as CreateCloudAccountReq);
        message.success('云账户创建成功');
      }

      modalVisible.value = false;
      fetchCloudAccounts();
    } catch (error: any) {
      if (error?.errorFields) return;
      message.error(isEdit.value ? '更新云账户失败' : '创建云账户失败');
    } finally {
      submitLoading.value = false;
    }
  };

  const handleVerifyAndSubmit = async (): Promise<void> => {
    try {
      await formRef.value?.validate();
      verifyLoading.value = true;

      const hideCreating = message.loading('正在创建云账户...', 0);
      const createResponse = await createCloudAccountApi(formData.value as CreateCloudAccountReq);
      hideCreating();
      
      const accountId = createResponse?.id;
      if (!accountId) {
        message.error('创建云账户失败：未获取到账户ID');
        return;
      }

      try {
        const hideVerifying = message.loading('正在验证凭证...', 0);
        await verifyCloudAccountApi(accountId);
        hideVerifying();
        
        message.success('云账户创建并验证成功');
        modalVisible.value = false;
        fetchCloudAccounts();
      } catch (verifyError) {
        try {
          await deleteCloudAccountApi(accountId);
          message.error('凭证验证失败，账户已自动删除，请检查 Access Key 和 Secret Key');
        } catch (deleteError) {
          message.error('凭证验证失败，且删除账户失败，请手动删除该账户');
        }
        return;
      }
    } catch (error: any) {
      if (error?.errorFields) return;
      message.error('创建云账户失败');
    } finally {
      verifyLoading.value = false;
    }
  };

  const handleDelete = (record: CloudAccount): void => {
    Modal.confirm({
      title: '确认删除',
      content: `确定要删除云账户 "${record.name}" 吗？此操作不可恢复。`,
      okText: '确定删除',
      okType: 'danger',
      cancelText: '取消',
      onOk: async () => {
        try {
          await deleteCloudAccountApi(record.id);
          message.success('删除成功');
          detailVisible.value = false;
          fetchCloudAccounts();
        } catch (error) {
          message.error('删除失败');
        }
      },
    });
  };

  const handleStatusChange = async (record: CloudAccount, checked: boolean): Promise<void> => {
    const newStatus = checked ? CloudAccountStatus.Enabled : CloudAccountStatus.Disabled;
    switchLoading.value[record.id] = true;
    
    try {
      await updateCloudAccountStatusApi(record.id, newStatus);
      message.success(`账户已${checked ? '启用' : '禁用'}`);
      
      const index = cloudAccounts.value.findIndex(item => item.id === record.id);
      if (index !== -1 && cloudAccounts.value[index]) {
        cloudAccounts.value[index]!.status = newStatus;
      }
      
      if (currentDetail.value && currentDetail.value.id === record.id) {
        currentDetail.value.status = newStatus;
      }
    } catch (error) {
      message.error('状态更新失败');
    } finally {
      switchLoading.value[record.id] = false;
    }
  };

  const handleVerify = async (record: CloudAccount): Promise<void> => {
    const hide = message.loading('正在验证凭证...', 0);
    try {
      await verifyCloudAccountApi(record.id);
      hide();
      message.success('凭证验证成功');
    } catch (error) {
      hide();
      message.error('凭证验证失败，请检查 Access Key 和 Secret Key');
    }
  };

  const handleViewDetail = async (record: CloudAccount): Promise<void> => {
    detailVisible.value = true;
    detailLoading.value = true;
    
    try {
      const response = await getCloudAccountDetailApi(record.id);
      currentDetail.value = response;
    } catch (error) {
      message.error('获取详情失败');
      currentDetail.value = record;
    } finally {
      detailLoading.value = false;
    }
  };

  // ========== 导出功能 ==========
  const handleExportMenuClick = ({ key }: { key: string }) => {
    if (key === 'current') {
      exportToExcel(cloudAccounts.value);
    } else if (key === 'all') {
      exportAllToExcel();
    }
  };

  const exportToExcel = (data: CloudAccount[]) => {
    if (!data || data.length === 0) {
      message.warning('没有可导出的数据');
      return;
    }

    // 准备导出数据
    const exportData = data.map((item) => ({
      '账户名称': item.name,
      '云厂商': getProviderText(item.provider),
      '地域': item.region,
      '账户ID': item.account_id || '-',
      '账户别名': item.account_alias || '-',
      '状态': item.status === CloudAccountStatus.Enabled ? '已启用' : '已禁用',
      '创建人': item.create_user_name || '-',
      '创建时间': formatDateTime(item.created_at),
      '更新时间': formatDateTime(item.updated_at),
      '描述': item.description || '-',
    }));

    // 创建工作簿和工作表
    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, '云账户列表');

    // 设置列宽
    const colWidths = [
      { wch: 20 }, // 账户名称
      { wch: 12 }, // 云厂商
      { wch: 15 }, // 地域
      { wch: 25 }, // 账户ID
      { wch: 20 }, // 账户别名
      { wch: 10 }, // 状态
      { wch: 15 }, // 创建人
      { wch: 20 }, // 创建时间
      { wch: 20 }, // 更新时间
      { wch: 30 }, // 描述
    ];
    worksheet['!cols'] = colWidths;

    // 导出文件
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').substring(0, 19);
    const filename = `云账户列表_${timestamp}.xlsx`;
    XLSX.writeFile(workbook, filename);
    message.success(`导出成功：${filename}`);
  };

  const exportAllToExcel = async () => {
    const hide = message.loading('正在导出所有数据...', 0);
    try {
      // 获取所有数据
      const allData: CloudAccount[] = [];
      let currentPage = 1;
      const pageSize = 100;
      let hasMore = true;

      while (hasMore) {
        const params: GetCloudAccountListReq = {
          page: currentPage,
          size: pageSize,
          search: filterForm.search,
          provider: filterForm.provider,
          region: filterForm.region,
          status: filterForm.status,
        };

        const response = await getCloudAccountListApi(params);
        const items = response.items || [];
        const total = response.total || 0;

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

  // ========== 生命周期 ==========
  onMounted(() => {
    fetchCloudAccounts();
  });

  return {
    // Icons
    PlusOutlined,
    EditOutlined,
    DeleteOutlined,
    CloudOutlined,
    SearchOutlined,
    EnvironmentOutlined,
    SafetyCertificateOutlined,
    CheckCircleOutlined,
    EyeOutlined,
    UserOutlined,
    KeyOutlined,
    LockOutlined,
    TagsOutlined,
    InfoCircleOutlined,
    ClockCircleOutlined,
    CloudServerOutlined,
    GlobalOutlined,
    ClearOutlined,
    ExportOutlined,
    FileExcelOutlined,
    
    // Enums
    CloudProvider,
    CloudAccountStatus,
    
    // States
    loading,
    detailLoading,
    submitLoading,
    verifyLoading,
    modalVisible,
    detailVisible,
    isEdit,
    switchLoading,
    formRef,
    cloudAccounts,
    currentDetail,
    pagination,
    filterForm,
    formData,
    
    // Computed
    enabledCount,
    aliCloudCount,
    tencentCloudCount,
    paginationConfig,
    formRules,
    columns,
    
    // Methods
    getProviderColor,
    getProviderText,
    getAvatarColor,
    getInitials,
    formatDateTime,
    truncateText,
    fetchCloudAccounts,
    handleTableChange,
    handleSearch,
    handleSearchChange,
    resetFilter,
    showCreateModal,
    handleEdit,
    handleSubmit,
    handleVerifyAndSubmit,
    handleDelete,
    handleStatusChange,
    handleVerify,
    handleViewDetail,
    handleExportMenuClick,
    exportToExcel,
    exportAllToExcel,
  };
}

