import { ref, computed, h } from 'vue';
import { message, Modal } from 'ant-design-vue';
import type { FormInstance, Rule } from 'ant-design-vue/es/form';
import yaml from 'js-yaml';
import {
  type K8sRole,
  type PolicyRuleParam,
  type GetRoleListReq,
  type GetRoleDetailsReq,
  type GetRoleYamlReq,
  type CreateRoleReq,
  type CreateRoleByYamlReq,
  type UpdateRoleReq,
  type UpdateRoleByYamlReq,
  type DeleteRoleReq,
  getRoleListApi,
  getRoleDetailsApi,
  getRoleYamlApi,
  createRoleApi,
  createRoleByYamlApi,
  updateRoleApi,
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

// YAML 模板常量
const ROLE_YAML_TEMPLATE = `apiVersion: rbac.authorization.k8s.io/v1
kind: Role
metadata:
  name: my-role
  namespace: default
rules:
- apiGroups: [""]
  resources: ["pods"]
  verbs: ["get", "list", "watch"]
- apiGroups: ["apps"]
  resources: ["deployments"]
  verbs: ["get", "list"]`;

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
  const editFormRef = ref<FormInstance>();
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
      api_groups: [],
      resources: [],
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

  const editFormRules: Record<string, Rule[]> = {
    name: [
      { required: true, message: '请输入 Role 名称', trigger: 'blur' },
    ],
    namespace: [
      { required: true, message: '请选择命名空间', trigger: 'change' },
    ],
  };

  const createYamlFormRules: Record<string, Rule[]> = {
    yaml: [
      { required: true, message: '请输入 YAML 内容', trigger: 'blur' },
      { min: 50, message: 'YAML 内容过短，请检查是否完整', trigger: 'blur' }
    ],
  };

  const yamlFormRules: Record<string, Rule[]> = {
    yaml: [
      { required: true, message: '请输入 YAML 内容', trigger: 'blur' },
      { min: 50, message: 'YAML 内容过短，请检查是否完整', trigger: 'blur' }
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
      message.success('Role YAML 更新成功');
      closeYamlModal();
      await fetchRoles();
    } catch (error: any) {
      if (error.errorFields) return;

      message.error('更新 Role YAML 失败：' + (error.message || '未知错误'));
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
        api_groups: [],
        resources: [],
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

      // 清理并过滤 rules
      const cleanedRules = createFormModel.value.rules
        .filter(rule => 
          rule.verbs.length > 0 && 
          (rule.resources || []).some(resource => resource && resource.trim())
        )
        .map(rule => {
          // 清理 api_groups
          const rawApiGroups = (rule.api_groups || [])
            .map(group => typeof group === 'string' ? group.trim() : '')
            .filter(group => group !== null && group !== undefined);
          
          // 如果同时有空字符串和非空值，去掉空字符串（很可能是意外产生的）
          // 如果只有空字符串，保留它（代表 core API group）
          const hasNonEmpty = rawApiGroups.some(group => group !== '');
          const cleanedApiGroups = hasNonEmpty 
            ? rawApiGroups.filter(group => group !== '')
            : rawApiGroups;
          
          // 清理 resources：只保留非空字符串
          const cleanedResources = (rule.resources || [])
            .map(resource => typeof resource === 'string' ? resource.trim() : '')
            .filter(resource => resource);
          
          return {
            verbs: rule.verbs,
            api_groups: cleanedApiGroups,
            resources: cleanedResources,
            resource_names: rule.resource_names || [],
          };
        });

      const params: CreateRoleReq = {
        cluster_id: filterClusterId.value,
        namespace: createFormModel.value.namespace,
        name: createFormModel.value.name,
        rules: cleanedRules,
        labels: Object.keys(createFormModel.value.labels).length > 0 ? createFormModel.value.labels : undefined,
        annotations: Object.keys(createFormModel.value.annotations).length > 0 ? createFormModel.value.annotations : undefined,
      };

      console.log('创建 Role 请求参数:', JSON.stringify(params, null, 2));
      await createRoleApi(params);
      message.success('Role 创建成功');
      closeCreateModal();
      await fetchRoles();
    } catch (error: any) {
      if (error.errorFields) return;

      message.error('创建 Role 失败：' + (error.message || '未知错误'));
    } finally {
      submitLoading.value = false;
    }
  };

  const openEditModal = async (role: K8sRole) => {
    const clusterId = validateClusterId(role);
    if (!clusterId) return;

    currentOperationRole.value = role;
    
    // 获取详细信息
    try {
      submitLoading.value = true;
      const params = {
        cluster_id: clusterId,
        namespace: role.namespace,
        name: role.name,
      };
      
      const response = await getRoleDetailsApi(params);
      
      // 填充表单
      editFormModel.value = {
        name: response.name,
        namespace: response.namespace,
        rules: (response.rules || []).map((rule: any) => ({
          verbs: rule.verbs || [],
          api_groups: rule.apiGroups || [],
          resources: rule.resources || [],
          resource_names: rule.resourceNames || [],
        })),
        labels: response.labels || {},
        annotations: response.annotations || {},
      };
      
      isEditModalVisible.value = true;
    } catch (error: any) {
      message.error('获取 Role 详情失败：' + (error.message || '未知错误'));
    } finally {
      submitLoading.value = false;
    }
  };

  const closeEditModal = () => {
    isEditModalVisible.value = false;
    editFormModel.value = {
      name: '',
      namespace: '',
      rules: [],
      labels: {},
      annotations: {},
    };
    editFormRef.value?.resetFields();
  };

  const submitEditForm = async () => {
    if (!editFormRef.value || !currentOperationRole.value) return;

    const clusterId = validateClusterId(currentOperationRole.value);
    if (!clusterId) return;

    try {
      await editFormRef.value.validateFields();
      submitLoading.value = true;

      // 清理并过滤 rules
      const cleanedRules = editFormModel.value.rules
        .filter(rule => 
          rule.verbs.length > 0 && 
          (rule.resources || []).some(resource => resource && resource.trim())
        )
        .map(rule => {
          // 清理 api_groups
          const rawApiGroups = (rule.api_groups || [])
            .map(group => typeof group === 'string' ? group.trim() : '')
            .filter(group => group !== null && group !== undefined);
          
          const hasNonEmpty = rawApiGroups.some(group => group !== '');
          const cleanedApiGroups = hasNonEmpty 
            ? rawApiGroups.filter(group => group !== '')
            : rawApiGroups;
          
          // 清理 resources
          const cleanedResources = (rule.resources || [])
            .map(resource => typeof resource === 'string' ? resource.trim() : '')
            .filter(resource => resource);
          
          return {
            verbs: rule.verbs,
            api_groups: cleanedApiGroups,
            resources: cleanedResources,
            resource_names: rule.resource_names || [],
          };
        });

      const params: UpdateRoleReq = {
        cluster_id: clusterId,
        namespace: currentOperationRole.value.namespace,
        name: currentOperationRole.value.name,
        rules: cleanedRules,
        labels: Object.keys(editFormModel.value.labels).length > 0 ? editFormModel.value.labels : undefined,
        annotations: Object.keys(editFormModel.value.annotations).length > 0 ? editFormModel.value.annotations : undefined,
      };

      console.log('更新 Role 请求参数:', JSON.stringify(params, null, 2));
      await updateRoleApi(params);
      message.success('Role 更新成功');
      closeEditModal();
      await fetchRoles();
    } catch (error: any) {
      if (error.errorFields) return;

      message.error('更新 Role 失败：' + (error.message || '未知错误'));
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
      message.success('Role 创建成功');
      closeCreateYamlModal();
      await fetchRoles();
    } catch (error: any) {
      if (error.errorFields) return;

      message.error('通过 YAML 创建 Role 失败：' + (error.message || '未知错误'));
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
          message.success('Role 删除成功');
          await fetchRoles();
        } catch (error: any) {

          message.error('删除 Role 失败：' + (error.message || '未知错误'));
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
            message.success(`成功删除 ${selectedRows.value.length} 个 Role`);
            selectedRowKeys.value = [];
            selectedRows.value = [];
            await fetchRoles();
          } catch (error: any) {

            message.error('批量删除部分 Role 失败：' + (error.message || '未知错误'));
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

  // form field operations (支持create和edit两种模式)
  const getCurrentFormModel = () => {
    return isEditModalVisible.value ? editFormModel.value : createFormModel.value;
  };

  const addRuleField = () => {
    getCurrentFormModel().rules.push({
      verbs: [],
      api_groups: [],
      resources: [],
      resource_names: [],
    });
  };

  const removeRuleField = (index: number) => {
    const formModel = getCurrentFormModel();
    if (formModel.rules.length > 1) {
      formModel.rules.splice(index, 1);
    }
  };

  const addVerbToRule = (ruleIndex: number, verb: string) => {
    const formModel = getCurrentFormModel();
    if (verb && !formModel.rules[ruleIndex]?.verbs?.includes(verb)) {
      formModel.rules[ruleIndex]?.verbs?.push(verb);
    }
  };

  const removeVerbFromRule = (ruleIndex: number, verbIndex: number) => {
    getCurrentFormModel().rules[ruleIndex]?.verbs?.splice(verbIndex, 1);
  };

  const addApiGroupToRule = (ruleIndex: number, apiGroup: string) => {
    const formModel = getCurrentFormModel();
    if (!formModel.rules[ruleIndex]?.api_groups) {
      if (formModel.rules[ruleIndex]) {
        formModel.rules[ruleIndex].api_groups = [];
      }
    }
    if (apiGroup !== undefined && !formModel.rules[ruleIndex]?.api_groups?.includes(apiGroup)) {
      formModel.rules[ruleIndex]?.api_groups?.push(apiGroup);
    }
  };

  const removeApiGroupFromRule = (ruleIndex: number, groupIndex: number) => {
    getCurrentFormModel().rules[ruleIndex]?.api_groups?.splice(groupIndex, 1);
  };

  const addResourceToRule = (ruleIndex: number, resource: string) => {
    const formModel = getCurrentFormModel();
    if (!formModel.rules[ruleIndex]?.resources) {
      if (formModel.rules[ruleIndex]) {
        formModel.rules[ruleIndex].resources = [];
      }
    }
    if (resource && !formModel.rules[ruleIndex]?.resources?.includes(resource)) {
      formModel.rules[ruleIndex]?.resources?.push(resource);
    }
  };

  const removeResourceFromRule = (ruleIndex: number, resourceIndex: number) => {
    getCurrentFormModel().rules[ruleIndex]?.resources?.splice(resourceIndex, 1);
  };

  const removeLabelField = (key: string) => {
    const formModel = getCurrentFormModel();
    delete formModel.labels[key];
  };

  const removeAnnotationField = (key: string) => {
    const formModel = getCurrentFormModel();
    delete formModel.annotations[key];
  };

  // YAML 操作辅助函数
  const insertYamlTemplate = () => {
    if (createYamlFormModel.value.yaml && createYamlFormModel.value.yaml.trim()) {
      Modal.confirm({
        title: '确认操作',
        content: '当前已有内容，插入模板将覆盖现有内容，是否继续？',
        okText: '确认',
        cancelText: '取消',
        centered: true,
        onOk: () => {
          createYamlFormModel.value.yaml = ROLE_YAML_TEMPLATE;
          message.success('模板已插入');
        },
      });
    } else {
      createYamlFormModel.value.yaml = ROLE_YAML_TEMPLATE;
      message.success('模板已插入');
    }
  };

  const formatYaml = () => {
    const yamlContent = createYamlFormModel.value.yaml;
    if (!yamlContent || !yamlContent.trim()) {
      message.warning('YAML 内容为空，无法格式化');
      return;
    }

    try {
      // 解析 YAML
      const parsed = yaml.load(yamlContent);
      // 重新格式化为 YAML（缩进2空格）
      const formatted = yaml.dump(parsed, {
        indent: 2,
        lineWidth: -1, // 不限制行宽
        noRefs: true,  // 不使用引用
        sortKeys: false, // 保持原有顺序
      });
      createYamlFormModel.value.yaml = formatted;
      message.success('YAML 格式化成功');
    } catch (error: any) {
      message.error(`YAML 格式化失败: ${error.message || '未知错误'}`);
    }
  };

  const validateYaml = () => {
    const yamlContent = createYamlFormModel.value.yaml;
    if (!yamlContent || !yamlContent.trim()) {
      message.warning('YAML 内容为空，无法检查');
      return;
    }

    try {
      // 尝试解析 YAML
      const parsed = yaml.load(yamlContent);
      
      // 检查是否是有效的对象
      if (!parsed || typeof parsed !== 'object') {
        message.warning('YAML 内容无效：应为对象格式');
        return;
      }

      // 基本的 Role 字段检查
      const role = parsed as any;
      const issues: string[] = [];

      if (!role.apiVersion) {
        issues.push('缺少 apiVersion 字段');
      }
      if (!role.kind) {
        issues.push('缺少 kind 字段');
      } else if (role.kind !== 'Role') {
        issues.push(`kind 应为 "Role"，当前为 "${role.kind}"`);
      }
      if (!role.metadata?.name) {
        issues.push('缺少 metadata.name 字段');
      }
      if (!role.metadata?.namespace) {
        issues.push('缺少 metadata.namespace 字段');
      }
      if (!role.rules) {
        issues.push('缺少 rules 字段');
      } else if (!Array.isArray(role.rules)) {
        issues.push('rules 应为数组格式');
      }

      if (issues.length > 0) {
        Modal.warning({
          title: 'YAML 格式检查警告',
          content: () => h('div', [
            h('p', 'YAML 语法正确，但发现以下问题：'),
            h('ul', { style: 'margin: 8px 0; padding-left: 20px;' }, 
              issues.map((issue) => h('li', issue))
            ),
          ]),
          width: 500,
          centered: true,
        });
      } else {
        message.success('YAML 格式检查通过，所有必需字段完整');
      }
    } catch (error: any) {
      Modal.error({
        title: 'YAML 格式检查失败',
        content: () => h('div', [
          h('p', { style: 'color: #ff4d4f; font-weight: 600; margin-bottom: 8px;' }, '语法错误：'),
          h('pre', { 
            style: 'background: #f5f5f5; padding: 12px; border-radius: 4px; font-size: 12px; overflow: auto; max-height: 200px;' 
          }, error.message || '未知错误'),
        ]),
        width: 600,
        centered: true,
      });
    }
  };

  const clearYaml = () => {
    if (createYamlFormModel.value.yaml && createYamlFormModel.value.yaml.trim()) {
      Modal.confirm({
        title: '确认清空',
        content: '确定要清空当前的 YAML 内容吗？此操作不可恢复。',
        okText: '确认清空',
        okType: 'danger',
        cancelText: '取消',
        centered: true,
        onOk: () => {
          createYamlFormModel.value.yaml = '';
          message.success('YAML 内容已清空');
        },
      });
    } else {
      message.info('YAML 内容已为空');
    }
  };

  // 编辑 YAML 的格式化和验证函数
  const formatEditYaml = () => {
    const yamlContent = yamlFormModel.value.yaml;
    if (!yamlContent || !yamlContent.trim()) {
      message.warning('YAML 内容为空，无法格式化');
      return;
    }

    try {
      const parsed = yaml.load(yamlContent);
      const formatted = yaml.dump(parsed, {
        indent: 2,
        lineWidth: -1,
        noRefs: true,
        sortKeys: false,
      });
      yamlFormModel.value.yaml = formatted;
      message.success('YAML 格式化成功');
    } catch (error: any) {
      message.error(`YAML 格式化失败: ${error.message || '未知错误'}`);
    }
  };

  const validateEditYaml = () => {
    const yamlContent = yamlFormModel.value.yaml;
    if (!yamlContent || !yamlContent.trim()) {
      message.warning('YAML 内容为空，无法检查');
      return;
    }

    try {
      const parsed = yaml.load(yamlContent);
      
      if (!parsed || typeof parsed !== 'object') {
        message.warning('YAML 内容无效：应为对象格式');
        return;
      }

      const role = parsed as any;
      const issues: string[] = [];

      if (!role.apiVersion) {
        issues.push('缺少 apiVersion 字段');
      }
      if (!role.kind) {
        issues.push('缺少 kind 字段');
      } else if (role.kind !== 'Role') {
        issues.push(`kind 应为 "Role"，当前为 "${role.kind}"`);
      }
      if (!role.metadata?.name) {
        issues.push('缺少 metadata.name 字段');
      }
      if (!role.metadata?.namespace) {
        issues.push('缺少 metadata.namespace 字段');
      }
      if (!role.rules) {
        issues.push('缺少 rules 字段');
      } else if (!Array.isArray(role.rules)) {
        issues.push('rules 应为数组格式');
      }

      if (issues.length > 0) {
        Modal.warning({
          title: 'YAML 格式检查警告',
          content: () => h('div', [
            h('p', 'YAML 语法正确，但发现以下问题：'),
            h('ul', { style: 'margin: 8px 0; padding-left: 20px;' }, 
              issues.map((issue) => h('li', issue))
            ),
          ]),
          width: 500,
          centered: true,
        });
      } else {
        message.success('YAML 格式检查通过，所有必需字段完整');
      }
    } catch (error: any) {
      Modal.error({
        title: 'YAML 格式检查失败',
        content: () => h('div', [
          h('p', { style: 'color: #ff4d4f; font-weight: 600; margin-bottom: 8px;' }, '语法错误：'),
          h('pre', { 
            style: 'background: #f5f5f5; padding: 12px; border-radius: 4px; font-size: 12px; overflow: auto; max-height: 200px;' 
          }, error.message || '未知错误'),
        ]),
        width: 600,
        centered: true,
      });
    }
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
    editFormRef,
    yamlFormRef,
    createYamlFormRef,
    
    // form rules
    createFormRules,
    editFormRules,
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
    
    // edit operations
    openEditModal,
    closeEditModal,
    submitEditForm,
    
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
    
    // YAML utility functions
    insertYamlTemplate,
    formatYaml,
    validateYaml,
    clearYaml,
    formatEditYaml,
    validateEditYaml,
  };
}
