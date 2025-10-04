import { ref, computed } from 'vue';
import { message, Modal } from 'ant-design-vue';
import type { FormInstance, Rule } from 'ant-design-vue/es/form';
import {
  type K8sRole,
  type PolicyRule,
  type PolicyRuleParam,
  type GetRoleListReq,
  type GetRoleDetailsReq,
  type GetRoleYamlReq,
  type CreateRoleReq,
  type CreateRoleByYamlReq,
  type UpdateRoleByYamlReq,
  type DeleteRoleReq,
  getRoleListApi,
  getRoleDetailsApi,
  getRoleYamlApi,
  createRoleApi,
  createRoleByYamlApi,
  updateRoleYamlApi,
  deleteRoleApi,
} from '#/api/core/k8s/k8s_role';
import {
  type K8sCluster,
  type ListClustersReq,
  getClustersListApi,
  Env,
} from '#/api/core/k8s/k8s_cluster';
import {
  type K8sNamespace,
  getNamespacesListApi,
} from '#/api/core/k8s/k8s_namespace';

export function useRolePage() {
  // state
  const roles = ref<K8sRole[]>([]);
  const clusters = ref<K8sCluster[]>([]);
  const namespaces = ref<K8sNamespace[]>([]);
  const loading = ref(false);
  const clustersLoading = ref(false);
  const namespacesLoading = ref(false);
  const searchText = ref('');
  const filterClusterId = ref<number | undefined>(undefined);
  const filterNamespace = ref<string | undefined>(undefined);
  const filterLabels = ref<Record<string, string>>({});
  const selectedRowKeys = ref<string[]>([]);
  const selectedRows = ref<K8sRole[]>([]);
  const currentPage = ref(1);
  const pageSize = ref(10);
  const total = ref(0);
  const clustersTotal = ref(0);
  const clustersPage = ref(1);
  const clustersSize = ref(50);
  const namespacesTotal = ref(0);
  const namespacesPage = ref(1);
  const namespacesSize = ref(50);

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
  const currentOperationRole = ref<K8sRole | null>(null);
  const currentRoleDetail = ref<K8sRole | null>(null);
  const currentYamlContent = ref('');

  // form models
  const createFormModel = ref<{
    name: string;
    namespace: string;
    rules: PolicyRuleParam[];
    labels: Record<string, string>;
    annotations: Record<string, string>;
  }>({
    name: '',
    namespace: '',
    rules: [{
      verbs: [],
      api_groups: [''],
      resources: [''],
      resource_names: [],
    }],
    labels: {},
    annotations: {},
  });

  const editFormModel = ref<{
    name: string;
    namespace: string;
    rules: PolicyRuleParam[];
    labels: Record<string, string>;
    annotations: Record<string, string>;
  }>({
    name: '',
    namespace: '',
    rules: [],
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
      { required: true, message: '请输入 Role 名称', trigger: 'blur' },
      { 
        pattern: /^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/, 
        message: '名称只能包含小写字母、数字和连字符，且不能以连字符开头或结尾', 
        trigger: 'blur' 
      },
      { max: 63, message: '名称长度不能超过63个字符', trigger: 'blur' },
    ],
    namespace: [
      { required: true, message: '请选择命名空间', trigger: 'change' },
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

  // computed - 后端已经处理了搜索、命名空间过滤和分页，前端不再做二次过滤
  const filteredRoles = computed(() => {
    // 如果有标签过滤，在前端进行过滤（但不改变 total，因为会导致分页不准确）
    if (Object.keys(filterLabels.value).length > 0) {
      return roles.value.filter(item => {
        if (!item.labels) return false;
        return Object.entries(filterLabels.value).every(([key, value]) => {
          const itemLabels = typeof item.labels === 'object' 
            ? item.labels 
            : {};
          return itemLabels[key] === value;
        });
      });
    }
    // 直接返回后端返回的数据，不做前端分页
    return roles.value;
  });

  const rowSelection = computed(() => ({
    selectedRowKeys: selectedRowKeys.value,
    onChange: (keys: string[], rows: K8sRole[]) => {
      selectedRowKeys.value = keys;
      selectedRows.value = rows;
    },
    onSelectAll: (selected: boolean, _rows: K8sRole[], changeRows: K8sRole[]) => {
      if (selected) {
        selectedRowKeys.value = [...selectedRowKeys.value, ...changeRows.map(row => `${row.namespace}/${row.name}`)];
        selectedRows.value = [...selectedRows.value, ...changeRows];
      } else {
        const changeKeys = changeRows.map(row => `${row.namespace}/${row.name}`);
        selectedRowKeys.value = selectedRowKeys.value.filter(key => !changeKeys.includes(key));
        selectedRows.value = selectedRows.value.filter(row => !changeKeys.includes(`${row.namespace}/${row.name}`));
      }
    },
  }));

  // helpers
  const validateClusterId = (record: K8sRole): number | null => {
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
  const clearRoles = () => {
    roles.value = [];
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

  const resetNamespaces = () => {
    namespaces.value = [];
    namespacesTotal.value = 0;
    namespacesPage.value = 1;
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
          // 自动加载该集群的命名空间和Role数据
          await fetchNamespaces();
          await fetchRoles();
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

  const fetchNamespaces = async (reset = false) => {
    if (!filterClusterId.value) {
      namespaces.value = [];
      namespacesTotal.value = 0;
      return;
    }

    if (reset) {
      namespacesPage.value = 1;
      namespaces.value = [];
    }

    if (namespacesLoading.value) return;

    try {
      namespacesLoading.value = true;
      const response = await getNamespacesListApi(filterClusterId.value, {
        cluster_id: filterClusterId.value,
        page: namespacesPage.value,
        size: namespacesSize.value,
      });
      const newNamespaces = response?.items || [];
      
      if (reset) {
        namespaces.value = newNamespaces;
      } else {
        namespaces.value = [...namespaces.value, ...newNamespaces];
      }
      
      namespacesTotal.value = response?.total || 0;
    } catch (error: any) {

      message.error('获取命名空间列表失败：' + (error.message || '未知错误'));
    } finally {
      namespacesLoading.value = false;
    }
  };

  const loadMoreNamespaces = async () => {
    if (namespacesPage.value * namespacesSize.value >= namespacesTotal.value || namespacesLoading.value) {
      return;
    }
    namespacesPage.value += 1;
    await fetchNamespaces();
  };

  const clearNamespaces = () => {
    resetNamespaces();
    filterNamespace.value = undefined;
  };

  const fetchRoles = async () => {
    if (!filterClusterId.value || filterClusterId.value === 0) {
      message.warning('请先选择有效的集群');
      roles.value = [];
      total.value = 0;
      return;
    }

    try {
      loading.value = true;
      const params: GetRoleListReq = {
        cluster_id: filterClusterId.value,
        namespace: filterNamespace.value,
        search: searchText.value || undefined,
        page: currentPage.value,
        size: pageSize.value,
      };

      const response = await getRoleListApi(params);
      roles.value = response?.items || [];
      total.value = response?.total || 0;
    } catch (error: any) {

      message.error('获取 Role 列表失败：' + (error.message || '未知错误'));
      roles.value = [];
      total.value = 0;
    } finally {
      loading.value = false;
    }
  };

  // detail operations
  const showRoleDetail = async (role: K8sRole) => {
    const clusterId = validateClusterId(role);
    if (!clusterId) return;

    try {
      detailLoading.value = true;
      isDetailModalVisible.value = true;
      currentOperationRole.value = role;

      const params: GetRoleDetailsReq = {
        cluster_id: clusterId,
        namespace: role.namespace,
        name: role.name,
      };

      const response = await getRoleDetailsApi(params);
      currentRoleDetail.value = response || role;
    } catch (error: any) {

      message.error('获取 Role 详情失败：' + (error.message || '未知错误'));
      currentRoleDetail.value = role;
    } finally {
      detailLoading.value = false;
    }
  };

  const closeDetailModal = () => {
    isDetailModalVisible.value = false;
    currentOperationRole.value = null;
    currentRoleDetail.value = null;
  };

  // YAML operations
  const showYamlModal = async (role: K8sRole) => {
    const clusterId = validateClusterId(role);
    if (!clusterId) return;

    try {
      submitLoading.value = true;
      currentOperationRole.value = role;

      const params: GetRoleYamlReq = {
        cluster_id: clusterId,
        namespace: role.namespace,
        name: role.name,
      };

      const response = await getRoleYamlApi(params);
      currentYamlContent.value = response?.yaml || '';
      yamlFormModel.value.yaml = response?.yaml || '';
      isYamlModalVisible.value = true;
    } catch (error: any) {

      message.error('获取 Role YAML 失败：' + (error.message || '未知错误'));
    } finally {
      submitLoading.value = false;
    }
  };

  const closeYamlModal = () => {
    isYamlModalVisible.value = false;
    currentOperationRole.value = null;
    yamlFormModel.value.yaml = '';
    currentYamlContent.value = '';
  };

  const submitYamlForm = async () => {
    if (!yamlFormRef.value || !currentOperationRole.value) return;
    
    const clusterId = validateClusterId(currentOperationRole.value);
    if (!clusterId) return;

    try {
      await yamlFormRef.value.validateFields();
      submitLoading.value = true;

      const params: UpdateRoleByYamlReq = {
        cluster_id: clusterId,
        namespace: currentOperationRole.value.namespace,
        name: currentOperationRole.value.name,
        yaml_content: yamlFormModel.value.yaml,
      };

      await updateRoleYamlApi(params);
      message.success('🎉 Role YAML 更新成功');
      closeYamlModal();
      await fetchRoles();
    } catch (error: any) {
      if (error.errorFields) return;

      message.error('❌ 更新 Role YAML 失败：' + (error.message || '未知错误'));
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
      namespace: filterNamespace.value || '',
      rules: [{
        verbs: [],
        api_groups: [''],
        resources: [''],
        resource_names: [],
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

      const params: CreateRoleReq = {
        cluster_id: filterClusterId.value,
        namespace: createFormModel.value.namespace,
        name: createFormModel.value.name,
        rules: createFormModel.value.rules.filter(rule => 
          rule.verbs.length > 0 && 
          (rule.api_groups || []).some(group => group.trim()) && 
          (rule.resources || []).some(resource => resource.trim())
        ),
        labels: Object.keys(createFormModel.value.labels).length > 0 ? createFormModel.value.labels : undefined,
        annotations: Object.keys(createFormModel.value.annotations).length > 0 ? createFormModel.value.annotations : undefined,
      };

      await createRoleApi(params);
      message.success('🎉 Role 创建成功');
      closeCreateModal();
      await fetchRoles();
    } catch (error: any) {
      if (error.errorFields) return;

      message.error('❌ 创建 Role 失败：' + (error.message || '未知错误'));
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

      const params: CreateRoleByYamlReq = {
        cluster_id: filterClusterId.value,
        yaml_content: createYamlFormModel.value.yaml,
      };

      await createRoleByYamlApi(params);
      message.success('🎉 Role 创建成功');
      closeCreateYamlModal();
      await fetchRoles();
    } catch (error: any) {
      if (error.errorFields) return;

      message.error('❌ 通过 YAML 创建 Role 失败：' + (error.message || '未知错误'));
    } finally {
      submitLoading.value = false;
    }
  };

  // role operations
  const deleteRole = (role: K8sRole) => {
    const clusterId = validateClusterId(role);
    if (!clusterId) return;

    Modal.confirm({
      title: '删除确认',
      content: `确定要删除 Role "${role.namespace}/${role.name}" 吗？此操作不可逆！`,
      okText: '确认删除',
      okType: 'danger',
      cancelText: '取消',
      centered: true,
      onOk: async () => {
        try {
          const params: DeleteRoleReq = {
            cluster_id: clusterId,
            namespace: role.namespace,
            name: role.name,
          };

          await deleteRoleApi(params);
          message.success('🎉 Role 删除成功');
          await fetchRoles();
        } catch (error: any) {

          message.error('❌ 删除 Role 失败：' + (error.message || '未知错误'));
        }
      },
    });
  };

  // filter operations
  const addFilterLabel = (key: string, value: string) => {
    filterLabels.value[key] = value;
    currentPage.value = 1;
    fetchRoles();
  };

  const removeFilterLabel = (key: string) => {
    delete filterLabels.value[key];
    currentPage.value = 1;
    fetchRoles();
  };

  const clearFilterLabels = () => {
    filterLabels.value = {};
    currentPage.value = 1;
    fetchRoles();
  };

  // batch operations
  const batchOperation = (operation: string) => {
    if (selectedRows.value.length === 0) {
      message.warning('请选择要操作的 Role');
      return;
    }

    const names = selectedRows.value.map(item => `${item.namespace}/${item.name}`).join('、');
    
    if (operation === '删除') {
      Modal.confirm({
        title: '批量删除确认',
        content: `确定要删除以下 ${selectedRows.value.length} 个 Role 吗？\n\n${names}\n\n此操作不可逆！`,
        okText: '确认删除',
        okType: 'danger',
        cancelText: '取消',
        centered: true,
        onOk: async () => {
          const deletePromises = selectedRows.value.map(role => {
            const clusterId = validateClusterId(role);
            if (!clusterId) return Promise.resolve();
            
            const params: DeleteRoleReq = {
              cluster_id: clusterId,
              namespace: role.namespace,
              name: role.name,
            };
            return deleteRoleApi(params);
          });

          try {
            await Promise.all(deletePromises);
            message.success(`🎉 成功删除 ${selectedRows.value.length} 个 Role`);
            selectedRowKeys.value = [];
            selectedRows.value = [];
            await fetchRoles();
          } catch (error: any) {

            message.error('❌ 批量删除部分 Role 失败：' + (error.message || '未知错误'));
            await fetchRoles();
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
    fetchRoles();
  };

  // form field operations
  const addRuleField = () => {
    createFormModel.value.rules.push({
      verbs: [],
      api_groups: [''],
      resources: [''],
      resource_names: [],
    });
  };

  const removeRuleField = (index: number) => {
    if (createFormModel.value.rules.length > 1) {
      createFormModel.value.rules.splice(index, 1);
    }
  };

  const addVerbToRule = (ruleIndex: number, verb: string) => {
    if (verb && !createFormModel.value.rules[ruleIndex]?.verbs?.includes(verb)) {
      createFormModel.value.rules[ruleIndex]?.verbs?.push(verb);
    }
  };

  const removeVerbFromRule = (ruleIndex: number, verbIndex: number) => {
    createFormModel.value.rules[ruleIndex]?.verbs?.splice(verbIndex, 1);
  };

  const addApiGroupToRule = (ruleIndex: number, apiGroup: string) => {
    if (!createFormModel.value.rules[ruleIndex]?.api_groups) {
      if (createFormModel.value.rules[ruleIndex]) {
        createFormModel.value.rules[ruleIndex].api_groups = [];
      }
    }
    if (apiGroup !== undefined && !createFormModel.value.rules[ruleIndex]?.api_groups?.includes(apiGroup)) {
      createFormModel.value.rules[ruleIndex]?.api_groups?.push(apiGroup);
    }
  };

  const removeApiGroupFromRule = (ruleIndex: number, groupIndex: number) => {
    createFormModel.value.rules[ruleIndex]?.api_groups?.splice(groupIndex, 1);
  };

  const addResourceToRule = (ruleIndex: number, resource: string) => {
    if (!createFormModel.value.rules[ruleIndex]?.resources) {
      if (createFormModel.value.rules[ruleIndex]) {
        createFormModel.value.rules[ruleIndex].resources = [];
      }
    }
    if (resource && !createFormModel.value.rules[ruleIndex]?.resources?.includes(resource)) {
      createFormModel.value.rules[ruleIndex]?.resources?.push(resource);
    }
  };

  const removeResourceFromRule = (ruleIndex: number, resourceIndex: number) => {
    createFormModel.value.rules[ruleIndex]?.resources?.splice(resourceIndex, 1);
  };

  const removeLabelField = (key: string) => {
    delete createFormModel.value.labels[key];
  };

  const removeAnnotationField = (key: string) => {
    delete createFormModel.value.annotations[key];
  };

  return {
    // state
    roles,
    clusters,
    namespaces,
    loading,
    clustersLoading,
    namespacesLoading,
    searchText,
    filterClusterId,
    filterNamespace,
    filterLabels,
    selectedRows,
    currentPage,
    pageSize,
    total,
    clustersTotal,
    namespacesTotal,
    
    // modal state
    isCreateModalVisible,
    isCreateYamlModalVisible,
    isEditModalVisible,
    isDetailModalVisible,
    isYamlModalVisible,
    submitLoading,
    detailLoading,
    
    // operation targets
    currentOperationRole,
    currentRoleDetail,
    
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
    filteredRoles,
    rowSelection,
    
    // helpers
    validateClusterId,
    getEnvText,
    
    // operations
    fetchClusters,
    fetchNamespaces,
    fetchRoles,
    clearRoles,
    clearNamespaces,
    loadMoreClusters,
    loadMoreNamespaces,
    
    // detail operations
    showRoleDetail,
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
    
    // role operations
    deleteRole,
    
    // filter operations
    addFilterLabel,
    removeFilterLabel,
    clearFilterLabels,
    
    // batch operations
    batchOperation,
    
    // pagination operations
    handlePageChange,
    
    // form field operations
    addRuleField,
    removeRuleField,
    addVerbToRule,
    removeVerbFromRule,
    addApiGroupToRule,
    removeApiGroupFromRule,
    addResourceToRule,
    removeResourceFromRule,
    removeLabelField,
    removeAnnotationField,
  };
}
