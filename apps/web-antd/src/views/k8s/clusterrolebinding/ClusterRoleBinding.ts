import { ref, computed } from 'vue';
import { message, Modal } from 'ant-design-vue';
import type { FormInstance, Rule } from 'ant-design-vue/es/form';
import {
  type K8sClusterRoleBinding,
  type RoleRef,
  type Subject,
  type GetClusterRoleBindingListReq,
  type GetClusterRoleBindingDetailsReq,
  type GetClusterRoleBindingYamlReq,
  type CreateClusterRoleBindingReq,
  type CreateClusterRoleBindingByYamlReq,
  type UpdateClusterRoleBindingByYamlReq,
  type DeleteClusterRoleBindingReq,
  getClusterRoleBindingListApi,
  getClusterRoleBindingDetailsApi,
  getClusterRoleBindingYamlApi,
  createClusterRoleBindingApi,
  createClusterRoleBindingByYamlApi,
  updateClusterRoleBindingYamlApi,
  deleteClusterRoleBindingApi,
} from '#/api/core/k8s/k8s_clusterrolebinding';
import {
  type K8sCluster,
  type ListClustersReq,
  getClustersListApi,
  Env,
} from '#/api/core/k8s/k8s_cluster';

export function useClusterRoleBindingPage() {
  // state
  const clusterRoleBindings = ref<K8sClusterRoleBinding[]>([]);
  const clusters = ref<K8sCluster[]>([]);
  const loading = ref(false);
  const clustersLoading = ref(false);
  const searchText = ref('');
  const filterClusterId = ref<number | undefined>(undefined);
  const filterLabels = ref<Record<string, string>>({});
  const selectedRowKeys = ref<string[]>([]);
  const selectedRows = ref<K8sClusterRoleBinding[]>([]);
  const currentPage = ref(1);
  const pageSize = ref(10);
  const total = ref(0);
  const clustersTotal = ref(0);
  const clustersPage = ref(1);
  const clustersSize = ref(50);

  // form refs
  const formRef = ref<FormInstance>();
  const yamlFormRef = ref<FormInstance>();
  const createYamlFormRef = ref<FormInstance>();

  // modal/form state
  const isCreateModalVisible = ref(false);
  const isCreateYamlModalVisible = ref(false);
  const isEditModalVisible = ref(false);
  const isDetailModalVisible = ref(false);
  const isYamlModalVisible = ref(false);
  const submitLoading = ref(false);
  const detailLoading = ref(false);

  // current operation target
  const currentOperationClusterRoleBinding = ref<K8sClusterRoleBinding | null>(null);
  const currentClusterRoleBindingDetail = ref<K8sClusterRoleBinding | null>(null);
  const currentYamlContent = ref('');

  // form models
  const createFormModel = ref<{
    name: string;
    role_ref: RoleRef;
    subjects: Subject[];
    labels: Record<string, string>;
    annotations: Record<string, string>;
  }>({
    name: '',
    role_ref: {
      api_group: 'rbac.authorization.k8s.io',
      kind: 'ClusterRole',
      name: '',
    },
    subjects: [{
      kind: 'User',
      name: '',
      api_group: 'rbac.authorization.k8s.io',
    }],
    labels: {},
    annotations: {},
  });

  const editFormModel = ref<{
    name: string;
    role_ref: RoleRef;
    subjects: Subject[];
    labels: Record<string, string>;
    annotations: Record<string, string>;
  }>({
    name: '',
    role_ref: {
      api_group: 'rbac.authorization.k8s.io',
      kind: 'ClusterRole',
      name: '',
    },
    subjects: [],
    labels: {},
    annotations: {},
  });

  const createYamlFormModel = ref<{
    yaml: string;
  }>({
    yaml: '',
  });

  const yamlFormModel = ref<{
    yaml: string;
  }>({
    yaml: '',
  });

  // form rules
  const createFormRules: Record<string, Rule[]> = {
    name: [
      { required: true, message: '请输入 ClusterRoleBinding 名称', trigger: 'blur' },
      { 
        pattern: /^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/, 
        message: '名称只能包含小写字母、数字和连字符，且不能以连字符开头或结尾', 
        trigger: 'blur' 
      },
      { max: 63, message: '名称长度不能超过63个字符', trigger: 'blur' },
    ],
    'role_ref.name': [
      { required: true, message: '请输入角色名称', trigger: 'blur' },
    ],
  };

  const createYamlFormRules: Record<string, Rule[]> = {
    yaml: [
      { required: true, message: '请输入 YAML 内容', trigger: 'blur' },
    ],
  };

  const yamlFormRules: Record<string, Rule[]> = {
    yaml: [
      { required: true, message: '请输入 YAML 内容', trigger: 'blur' },
    ],
  };

  // computed - 后端已经处理了搜索和分页，前端不再做二次过滤
  const filteredClusterRoleBindings = computed(() => {
    // 如果有标签过滤，在前端进行过滤（但不改变 total，因为会导致分页不准确）
    if (Object.keys(filterLabels.value).length > 0) {
      return clusterRoleBindings.value.filter(item => {
        if (!item.labels) return false;
        return Object.entries(filterLabels.value).every(([key, value]) => {
          const itemLabels = (typeof item.labels === 'object' && item.labels !== null)
            ? item.labels 
            : {};
          return itemLabels[key] === value;
        });
      });
    }
    // 直接返回后端返回的数据，不做前端分页
    return clusterRoleBindings.value;
  });

  const rowSelection = computed(() => ({
    selectedRowKeys: selectedRowKeys.value,
    onChange: (keys: string[], rows: K8sClusterRoleBinding[]) => {
      selectedRowKeys.value = keys;
      selectedRows.value = rows;
    },
    onSelectAll: (selected: boolean, _rows: K8sClusterRoleBinding[], changeRows: K8sClusterRoleBinding[]) => {
      if (selected) {
        selectedRowKeys.value = [...selectedRowKeys.value, ...changeRows.map(row => row.name)];
        selectedRows.value = [...selectedRows.value, ...changeRows];
      } else {
        const changeKeys = changeRows.map(row => row.name);
        selectedRowKeys.value = selectedRowKeys.value.filter(key => !changeKeys.includes(key));
        selectedRows.value = selectedRows.value.filter(row => !changeKeys.includes(row.name));
      }
    },
  }));

  // helpers
  const validateClusterId = (record: K8sClusterRoleBinding): number | null => {
    const clusterId = record.cluster_id || filterClusterId.value;
    if (!clusterId || clusterId === 0) {
      message.error('无效的集群ID，请重新选择集群');
      return null;
    }
    return clusterId;
  };

  const getEnvText = (env?: Env | string) => {
    if (env === undefined || env === null) return '未知环境';
    const value = typeof env === 'string' ? parseInt(env) : env;
    const map: Record<number, string> = {
      [Env.Prod]: '生产',
      [Env.Dev]: '开发',
      [Env.Stage]: '预发',
      [Env.Rc]: '测试',
      [Env.Press]: '灰度',
    };
    return map[value] || '未知环境';
  };

  // cluster operations
  const clearClusterRoleBindings = () => {
    clusterRoleBindings.value = [];
    selectedRowKeys.value = [];
    selectedRows.value = [];
    total.value = 0;
    currentPage.value = 1;
  };

  const resetClusters = () => {
    clusters.value = [];
    clustersTotal.value = 0;
    clustersPage.value = 1;
  };

  // operations
  const fetchClusters = async (reset = false) => {
    if (reset) {
      resetClusters();
    }
    
    if (clustersLoading.value) return;

    try {
      clustersLoading.value = true;
      const params: ListClustersReq = {
        page: clustersPage.value,
        size: clustersSize.value,
      };

      const response = await getClustersListApi(params);
      const newClusters = response?.items || [];
      
      if (clustersPage.value === 1) {
        clusters.value = newClusters;
      } else {
        clusters.value = [...clusters.value, ...newClusters];
      }
      
      clustersTotal.value = response?.total || 0;
      
      // 如果当前没有选择集群且有可用集群，自动选择第一个
      if (!filterClusterId.value && clusters.value.length > 0) {
        const firstCluster = clusters.value[0];
        if (firstCluster?.id) {
          filterClusterId.value = firstCluster.id;
          message.info(`已自动选择集群: ${firstCluster.name || '未知集群'}`);
          // 自动加载该集群的ClusterRoleBinding数据
          await fetchClusterRoleBindings();
        }
      }
    } catch (error: any) {

      message.error('获取集群列表失败：' + (error.message || '未知错误'));
    } finally {
      clustersLoading.value = false;
    }
  };

  const loadMoreClusters = async () => {
    if (clustersPage.value * clustersSize.value >= clustersTotal.value || clustersLoading.value) {
      return;
    }
    clustersPage.value += 1;
    await fetchClusters();
  };

  const fetchClusterRoleBindings = async () => {
    if (!filterClusterId.value || filterClusterId.value === 0) {
      message.warning('请先选择有效的集群');
      clusterRoleBindings.value = [];
      total.value = 0;
      return;
    }

    try {
      loading.value = true;
      const params: GetClusterRoleBindingListReq = {
        cluster_id: filterClusterId.value,
        search: searchText.value || undefined,
        page: currentPage.value,
        size: pageSize.value,
      };

      const response = await getClusterRoleBindingListApi(params);
      clusterRoleBindings.value = response?.items || [];
      total.value = response?.total || 0;
    } catch (error: any) {

      message.error('获取 ClusterRoleBinding 列表失败：' + (error.message || '未知错误'));
      clusterRoleBindings.value = [];
      total.value = 0;
    } finally {
      loading.value = false;
    }
  };

  // detail operations
  const showClusterRoleBindingDetail = async (clusterRoleBinding: K8sClusterRoleBinding) => {
    const clusterId = validateClusterId(clusterRoleBinding);
    if (!clusterId) return;

    try {
      detailLoading.value = true;
      isDetailModalVisible.value = true;
      currentOperationClusterRoleBinding.value = clusterRoleBinding;

      const params: GetClusterRoleBindingDetailsReq = {
        cluster_id: clusterId,
        name: clusterRoleBinding.name,
      };

      const response = await getClusterRoleBindingDetailsApi(params);
      currentClusterRoleBindingDetail.value = response || clusterRoleBinding;
    } catch (error: any) {

      message.error('获取 ClusterRoleBinding 详情失败：' + (error.message || '未知错误'));
      currentClusterRoleBindingDetail.value = clusterRoleBinding;
    } finally {
      detailLoading.value = false;
    }
  };

  const closeDetailModal = () => {
    isDetailModalVisible.value = false;
    currentOperationClusterRoleBinding.value = null;
    currentClusterRoleBindingDetail.value = null;
  };

  // YAML operations
  const showYamlModal = async (clusterRoleBinding: K8sClusterRoleBinding) => {
    const clusterId = validateClusterId(clusterRoleBinding);
    if (!clusterId) return;

    try {
      submitLoading.value = true;
      currentOperationClusterRoleBinding.value = clusterRoleBinding;

      const params: GetClusterRoleBindingYamlReq = {
        cluster_id: clusterId,
        name: clusterRoleBinding.name,
      };

      const response = await getClusterRoleBindingYamlApi(params);
      currentYamlContent.value = response?.yaml || '';
      yamlFormModel.value.yaml = response?.yaml || '';
      isYamlModalVisible.value = true;
    } catch (error: any) {

      message.error('获取 ClusterRoleBinding YAML 失败：' + (error.message || '未知错误'));
    } finally {
      submitLoading.value = false;
    }
  };

  const closeYamlModal = () => {
    isYamlModalVisible.value = false;
    currentOperationClusterRoleBinding.value = null;
    yamlFormModel.value.yaml = '';
    currentYamlContent.value = '';
  };

  const submitYamlForm = async () => {
    if (!yamlFormRef.value || !currentOperationClusterRoleBinding.value) return;
    
    const clusterId = validateClusterId(currentOperationClusterRoleBinding.value);
    if (!clusterId) return;

    try {
      await yamlFormRef.value.validateFields();
      submitLoading.value = true;

      const params: UpdateClusterRoleBindingByYamlReq = {
        cluster_id: clusterId,
        name: currentOperationClusterRoleBinding.value.name,
        yaml_content: yamlFormModel.value.yaml,
      };

      await updateClusterRoleBindingYamlApi(params);
      message.success('🎉 ClusterRoleBinding YAML 更新成功');
      closeYamlModal();
      await fetchClusterRoleBindings();
    } catch (error: any) {
      if (error.errorFields) return;

      message.error('❌ 更新 ClusterRoleBinding YAML 失败：' + (error.message || '未知错误'));
    } finally {
      submitLoading.value = false;
    }
  };

  // create operations
  const openCreateModal = () => {
    if (!filterClusterId.value) {
      message.error('请先选择集群');
      return;
    }

    resetCreateForm();
    isCreateModalVisible.value = true;
  };

  const closeCreateModal = () => {
    isCreateModalVisible.value = false;
    resetCreateForm();
  };

  const resetCreateForm = () => {
    createFormModel.value = {
      name: '',
      role_ref: {
        api_group: 'rbac.authorization.k8s.io',
        kind: 'ClusterRole',
        name: '',
      },
      subjects: [{
        kind: 'User',
        name: '',
        api_group: 'rbac.authorization.k8s.io',
      }],
      labels: {},
      annotations: {},
    };
    formRef.value?.resetFields();
  };

  const submitCreateForm = async () => {
    if (!formRef.value || !filterClusterId.value) return;

    try {
      await formRef.value.validateFields();
      submitLoading.value = true;

      const params: CreateClusterRoleBindingReq = {
        cluster_id: filterClusterId.value,
        name: createFormModel.value.name,
        role_ref: createFormModel.value.role_ref,
        subjects: createFormModel.value.subjects.filter(subject => subject.name.trim()),
        labels: Object.keys(createFormModel.value.labels).length > 0 ? createFormModel.value.labels : undefined,
        annotations: Object.keys(createFormModel.value.annotations).length > 0 ? createFormModel.value.annotations : undefined,
      };

      await createClusterRoleBindingApi(params);
      message.success('🎉 ClusterRoleBinding 创建成功');
      closeCreateModal();
      await fetchClusterRoleBindings();
    } catch (error: any) {
      if (error.errorFields) return;

      message.error('❌ 创建 ClusterRoleBinding 失败：' + (error.message || '未知错误'));
    } finally {
      submitLoading.value = false;
    }
  };

  const openCreateYamlModal = () => {
    if (!filterClusterId.value) {
      message.error('请先选择集群');
      return;
    }

    createYamlFormModel.value.yaml = '';
    isCreateYamlModalVisible.value = true;
  };

  const closeCreateYamlModal = () => {
    isCreateYamlModalVisible.value = false;
    createYamlFormModel.value.yaml = '';
  };

  const submitCreateYamlForm = async () => {
    if (!createYamlFormRef.value || !filterClusterId.value) return;

    try {
      await createYamlFormRef.value.validateFields();
      submitLoading.value = true;

      const params: CreateClusterRoleBindingByYamlReq = {
        cluster_id: filterClusterId.value,
        yaml_content: createYamlFormModel.value.yaml,
      };

      await createClusterRoleBindingByYamlApi(params);
      message.success('🎉 ClusterRoleBinding 创建成功');
      closeCreateYamlModal();
      await fetchClusterRoleBindings();
    } catch (error: any) {
      if (error.errorFields) return;

      message.error('❌ 通过 YAML 创建 ClusterRoleBinding 失败：' + (error.message || '未知错误'));
    } finally {
      submitLoading.value = false;
    }
  };

  // clusterRoleBinding operations
  const deleteClusterRoleBinding = (clusterRoleBinding: K8sClusterRoleBinding) => {
    const clusterId = validateClusterId(clusterRoleBinding);
    if (!clusterId) return;

    Modal.confirm({
      title: '删除确认',
      content: `确定要删除 ClusterRoleBinding "${clusterRoleBinding.name}" 吗？此操作不可逆！`,
      okText: '确认删除',
      okType: 'danger',
      cancelText: '取消',
      centered: true,
      onOk: async () => {
        try {
          const params: DeleteClusterRoleBindingReq = {
            cluster_id: clusterId,
            name: clusterRoleBinding.name,
          };

          await deleteClusterRoleBindingApi(params);
          message.success('🎉 ClusterRoleBinding 删除成功');
          await fetchClusterRoleBindings();
        } catch (error: any) {

          message.error('❌ 删除 ClusterRoleBinding 失败：' + (error.message || '未知错误'));
        }
      },
    });
  };

  // filter operations
  const addFilterLabel = (key: string, value: string) => {
    filterLabels.value[key] = value;
    currentPage.value = 1;
    fetchClusterRoleBindings();
  };

  const removeFilterLabel = (key: string) => {
    delete filterLabels.value[key];
    currentPage.value = 1;
    fetchClusterRoleBindings();
  };

  const clearFilterLabels = () => {
    filterLabels.value = {};
    currentPage.value = 1;
    fetchClusterRoleBindings();
  };

  // batch operations
  const batchOperation = (operation: string) => {
    if (selectedRows.value.length === 0) {
      message.warning('请选择要操作的 ClusterRoleBinding');
      return;
    }

    const names = selectedRows.value.map(item => item.name).join('、');
    
    if (operation === '删除') {
      Modal.confirm({
        title: '批量删除确认',
        content: `确定要删除以下 ${selectedRows.value.length} 个 ClusterRoleBinding 吗？\n\n${names}\n\n此操作不可逆！`,
        okText: '确认删除',
        okType: 'danger',
        cancelText: '取消',
        centered: true,
        onOk: async () => {
          const deletePromises = selectedRows.value.map(clusterRoleBinding => {
            const clusterId = validateClusterId(clusterRoleBinding);
            if (!clusterId) return Promise.resolve();
            
            const params: DeleteClusterRoleBindingReq = {
              cluster_id: clusterId,
              name: clusterRoleBinding.name,
            };
            return deleteClusterRoleBindingApi(params);
          });

          try {
            await Promise.all(deletePromises);
            message.success(`🎉 成功删除 ${selectedRows.value.length} 个 ClusterRoleBinding`);
            selectedRowKeys.value = [];
            selectedRows.value = [];
            await fetchClusterRoleBindings();
          } catch (error: any) {

            message.error('❌ 批量删除部分 ClusterRoleBinding 失败：' + (error.message || '未知错误'));
            await fetchClusterRoleBindings();
          }
        },
      });
    }
  };

  // pagination operations
  const handlePageChange = (page: number, size?: number) => {
    currentPage.value = page;
    if (size) {
      pageSize.value = size;
    }
    fetchClusterRoleBindings();
  };

  // form field operations
  const addSubjectField = () => {
    createFormModel.value.subjects.push({
      kind: 'User',
      name: '',
      api_group: 'rbac.authorization.k8s.io',
    });
  };

  const removeSubjectField = (index: number) => {
    if (createFormModel.value.subjects.length > 1) {
      createFormModel.value.subjects.splice(index, 1);
    }
  };

  const removeLabelField = (key: string) => {
    delete createFormModel.value.labels[key];
  };

  const removeAnnotationField = (key: string) => {
    delete createFormModel.value.annotations[key];
  };

  return {
    // state
    clusterRoleBindings,
    clusters,
    loading,
    clustersLoading,
    searchText,
    filterClusterId,
    filterLabels,
    selectedRows,
    currentPage,
    pageSize,
    total,
    clustersTotal,
    
    // modal state
    isCreateModalVisible,
    isCreateYamlModalVisible,
    isEditModalVisible,
    isDetailModalVisible,
    isYamlModalVisible,
    submitLoading,
    detailLoading,
    
    // operation targets
    currentOperationClusterRoleBinding,
    currentClusterRoleBindingDetail,
    
    // form models
    createFormModel,
    editFormModel,
    createYamlFormModel,
    yamlFormModel,
    
    // form refs
    formRef,
    yamlFormRef,
    createYamlFormRef,
    
    // form rules
    createFormRules,
    createYamlFormRules,
    yamlFormRules,
    
    // computed
    filteredClusterRoleBindings,
    rowSelection,
    
    // helpers
    validateClusterId,
    getEnvText,
    
    // operations
    fetchClusters,
    fetchClusterRoleBindings,
    clearClusterRoleBindings,
    loadMoreClusters,
    
    // detail operations
    showClusterRoleBindingDetail,
    closeDetailModal,
    
    // YAML operations
    showYamlModal,
    closeYamlModal,
    submitYamlForm,
    
    // create operations
    openCreateModal,
    closeCreateModal,
    submitCreateForm,
    openCreateYamlModal,
    closeCreateYamlModal,
    submitCreateYamlForm,
    
    // clusterRoleBinding operations
    deleteClusterRoleBinding,
    
    // filter operations
    addFilterLabel,
    removeFilterLabel,
    clearFilterLabels,
    
    // batch operations
    batchOperation,
    
    // pagination operations
    handlePageChange,
    
    // form field operations
    addSubjectField,
    removeSubjectField,
    removeLabelField,
    removeAnnotationField,
  };
}
