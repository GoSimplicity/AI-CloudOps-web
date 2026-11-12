import type { FormInstance, Rule } from 'ant-design-vue/es/form';

import { computed, ref } from 'vue';

import { useUserStore } from '@vben/stores';

import { message, Modal } from 'ant-design-vue';
import yaml from 'js-yaml';

import {
  Env,
  getClustersListApi,
  type K8sCluster,
  type ListClustersReq,
} from '#/api/core/k8s/k8s_cluster';
import {
  checkYamlTemplate,
  createYamlTemplate,
  deleteYamlTemplate,
  getYamlTemplateDetail,
  getYamlTemplateList,
  type K8sYamlTemplate,
  updateYamlTemplate,
  type YamlTemplateCheckReq,
  type YamlTemplateCreateReq,
  type YamlTemplateDeleteReq,
  type YamlTemplateListReq,
  type YamlTemplateUpdateReq,
} from '#/api/core/k8s/k8s_yaml';
import { useAuthStore } from '#/store';
import {
  shouldNotifyPageError,
  shouldRecordPageError,
} from '#/utils/permission/request-notice';

import { formatK8sTime } from '../shared/utils';

// YAML 模板常量
const DEFAULT_YAML_TEMPLATE = `apiVersion: apps/v1
kind: Deployment
metadata:
  name: my-deployment
  namespace: default
  labels:
    app: my-app
spec:
  replicas: 1
  selector:
    matchLabels:
      app: my-app
  template:
    metadata:
      labels:
        app: my-app
    spec:
      containers:
      - name: nginx
        image: nginx:latest
        ports:
        - containerPort: 80
        resources:
          limits:
            cpu: "500m"
            memory: "512Mi"
          requests:
            cpu: "250m"
            memory: "256Mi"`;

export function useTemplatePage() {
  // state
  const templates = ref<K8sYamlTemplate[]>([]);
  const clusters = ref<K8sCluster[]>([]);
  const loading = ref(false);
  const loadError = ref('');
  const clustersError = ref('');
  let resourceRequestId = 0;
  const clustersLoading = ref(false);
  const searchText = ref('');
  const filterClusterId = ref<number | undefined>(undefined);
  const selectedRowKeys = ref<(number | string)[]>([]);
  const selectedRows = ref<K8sYamlTemplate[]>([]);
  const currentPage = ref(1);
  const pageSize = ref(10);
  const total = ref(0);
  const clustersTotal = ref(0);
  const clustersPage = ref(1);
  const clustersSize = ref(50);

  // form refs
  const formRef = ref<FormInstance>();
  const yamlFormRef = ref<FormInstance>();
  const editFormRef = ref<FormInstance>();

  // modal/form state
  const isCreateModalVisible = ref(false);
  const isEditModalVisible = ref(false);
  const isDetailModalVisible = ref(false);
  const isYamlModalVisible = ref(false);
  const submitLoading = ref(false);
  const detailLoading = ref(false);
  const checkLoading = ref(false);

  // current operation target
  const currentOperationTemplate = ref<K8sYamlTemplate | null>(null);
  const currentTemplateDetail = ref<K8sYamlTemplate | null>(null);

  // form models
  const createFormModel = ref<{
    content: string;
    name: string;
  }>({
    content: '',
    name: '',
  });

  const editFormModel = ref<{
    content: string;
    name: string;
  }>({
    content: '',
    name: '',
  });

  const yamlFormModel = ref<{
    content: string;
  }>({
    content: '',
  });

  // form validation rules
  const createFormRules: Record<string, Rule[]> = {
    content: [
      { message: '请输入YAML内容', required: true, trigger: 'blur' },
      { message: 'YAML内容不能少于10个字符', min: 10, trigger: 'blur' },
    ],
    name: [
      { message: '请输入模板名称', required: true, trigger: 'blur' },
      {
        message: '模板名称只能包含中英文、数字、下划线和连字符',
        pattern: /^[\w\u4E00-\u9FA5-]+$/,
        trigger: 'blur',
      },
      { max: 50, message: '模板名称长度不能超过50个字符', trigger: 'blur' },
    ],
  };

  const editFormRules: Record<string, Rule[]> = {
    content: [
      { message: '请输入YAML内容', required: true, trigger: 'blur' },
      { message: 'YAML内容不能少于10个字符', min: 10, trigger: 'blur' },
    ],
    name: [
      { message: '请输入模板名称', required: true, trigger: 'blur' },
      {
        message: '模板名称只能包含中英文、数字、下划线和连字符',
        pattern: /^[\w\u4E00-\u9FA5-]+$/,
        trigger: 'blur',
      },
      { max: 50, message: '模板名称长度不能超过50个字符', trigger: 'blur' },
    ],
  };

  // computed
  const filteredTemplates = computed(() => {
    return templates.value;
  });

  const rowSelection = computed(() => ({
    onChange: (keys: (number | string)[], rows: K8sYamlTemplate[]) => {
      selectedRowKeys.value = keys;
      selectedRows.value = rows;
    },
    selectedRowKeys: selectedRowKeys.value,
  }));

  // helpers
  const validateClusterId = (): null | number => {
    if (!filterClusterId.value || filterClusterId.value === 0) {
      message.error('请先选择集群');
      return null;
    }
    return filterClusterId.value;
  };

  const operationOwner = () =>
    JSON.stringify([
      useUserStore().userInfo?.userId ?? '',
      useAuthStore().getAuthGeneration(),
    ]);

  const validateTemplateId = (record: K8sYamlTemplate): number | undefined => {
    const id = record.id;
    if (typeof id !== 'number' || !Number.isSafeInteger(id) || id <= 0) {
      message.warning('模板标识缺失或无效，请刷新列表后重试');
      return undefined;
    }
    return id;
  };
  let editOwner: string | undefined;
  let editRevision = 0;
  let submitRevision = 0;
  let submitMode: 'create' | 'edit' | undefined;
  let detailRevision = 0;
  let createOwner: string | undefined;

  const getEnvText = (env?: Env | string) => {
    if (env === undefined || env === null) return '未知环境';
    const value = typeof env === 'string' ? Number.parseInt(env) : env;
    const map: Record<number, string> = {
      [Env.Dev]: '开发',
      [Env.Press]: '灰度',
      [Env.Prod]: '生产',
      [Env.Rc]: '测试',
      [Env.Stage]: '预发',
    };
    return map[value] || '未知环境';
  };

  // 获取集群名称
  const getClusterName = (clusterId?: number) => {
    if (!clusterId) return '-';
    const cluster = clusters.value.find((c) => c.id === clusterId);
    return cluster?.name || `集群 ${clusterId}`;
  };

  // 获取用户显示名称
  const getUserDisplay = (userId?: number, username?: string) => {
    if (username) return username;
    if (userId) return `用户 ${userId}`;
    return '-';
  };

  // 注意：时间格式化函数已移至 shared/utils.ts，使用 formatK8sTime

  // cluster operations
  const clearTemplates = () => {
    resourceRequestId++;
    loading.value = false;
    total.value = 0;
    loadError.value = '';
    templates.value = [];
    selectedRowKeys.value = [];
    selectedRows.value = [];
  };

  // crud operations
  const fetchTemplates = async () => {
    const clusterId = filterClusterId.value;
    if (!clusterId) {
      clearTemplates();
      return;
    }
    const requestId = ++resourceRequestId;
    try {
      loading.value = true;
      loadError.value = '';
      selectedRowKeys.value = [];
      selectedRows.value = [];
      const params: YamlTemplateListReq = {
        cluster_id: clusterId,
        page: currentPage.value,
        search: searchText.value || undefined,
        size: pageSize.value,
      };
      const res = await getYamlTemplateList(params);
      if (
        requestId !== resourceRequestId ||
        filterClusterId.value !== clusterId
      )
        return;
      templates.value = res?.items || [];
      total.value = res?.total || 0;
    } catch (error) {
      if (
        requestId !== resourceRequestId ||
        filterClusterId.value !== clusterId
      )
        return;
      clearTemplates();
      if (shouldRecordPageError(error))
        loadError.value = '获取 YAML 模板列表失败，请重试';
      if (shouldNotifyPageError(error)) message.error(loadError.value);
    } finally {
      if (requestId === resourceRequestId) loading.value = false;
    }
  };

  // 重置集群列表
  const resetClusters = () => {
    clustersPage.value = 1;
    clusters.value = [];
  };

  const fetchClusters = async (reset = false) => {
    if (reset) {
      resetClusters();
    }
    try {
      clustersLoading.value = true;
      clustersError.value = '';
      const params: ListClustersReq = {
        page: clustersPage.value,
        size: clustersSize.value,
      };
      const res = await getClustersListApi(params);
      clusters.value =
        clustersPage.value === 1
          ? res?.items || []
          : [...clusters.value, ...(res?.items || [])];
      clustersTotal.value = res?.total || 0;

      // 如果当前没有选择集群且有可用集群，自动选择第一个
      if (!filterClusterId.value && clusters.value.length > 0) {
        const firstCluster = clusters.value[0];
        if (firstCluster?.id) {
          filterClusterId.value = firstCluster.id;
          // 加载所选集群的资源目录
          await fetchTemplates();
        }
      }
    } catch (error) {
      if (clustersPage.value === 1) {
        clusters.value = [];
        clustersTotal.value = 0;
        filterClusterId.value = undefined;
        clearTemplates();
      }
      if (shouldRecordPageError(error))
        clustersError.value = '获取集群列表失败，请重试';
      if (shouldNotifyPageError(error)) message.error(clustersError.value);
    } finally {
      clustersLoading.value = false;
    }
  };

  // 查看详情
  const showTemplateDetail = async (record: K8sYamlTemplate) => {
    const clusterId = validateClusterId();
    if (!clusterId) return;
    const id = validateTemplateId(record);
    if (id === undefined) return;
    const owner = operationOwner();
    const revision = ++detailRevision;
    const current = () =>
      detailRevision === revision &&
      isDetailModalVisible.value &&
      record.id === id &&
      filterClusterId.value === clusterId &&
      operationOwner() === owner;

    try {
      detailLoading.value = true;
      isDetailModalVisible.value = true;
      currentTemplateDetail.value = null;
      const res = await getYamlTemplateDetail({
        cluster_id: clusterId,
        id,
      });
      if (!current()) return;
      currentTemplateDetail.value = res || record;
    } catch (error: any) {
      if (!current()) return;
      if (shouldNotifyPageError(error))
        message.error(`获取模板详情失败：${error.message || '未知错误'}`);
      currentTemplateDetail.value = record;
    } finally {
      if (current()) detailLoading.value = false;
    }
  };

  const closeDetailModal = () => {
    detailRevision++;
    detailLoading.value = false;
    isDetailModalVisible.value = false;
    currentTemplateDetail.value = null;
  };

  // YAML 查看
  const showYamlModal = (record: K8sYamlTemplate) => {
    currentOperationTemplate.value = record;
    yamlFormModel.value.content = record.content || '';
    isYamlModalVisible.value = true;
  };

  const closeYamlModal = () => {
    isYamlModalVisible.value = false;
    currentOperationTemplate.value = null;
    yamlFormModel.value.content = '';
  };

  // 创建模板
  const openCreateModal = () => {
    submitMode = 'create';
    submitRevision++;
    submitLoading.value = false;
    createOwner = operationOwner();
    createFormModel.value = {
      content: '',
      name: '',
    };
    isCreateModalVisible.value = true;
  };

  const closeCreateModal = () => {
    if (submitMode === 'create') {
      submitRevision++;
      submitLoading.value = false;
      submitMode = undefined;
    }
    createOwner = undefined;
    isCreateModalVisible.value = false;
  };

  const submitCreateForm = async () => {
    const form = formRef.value;
    const model = createFormModel.value;
    const owner = createOwner;
    if (!form || owner !== operationOwner()) return;

    const clusterId = validateClusterId();
    if (!clusterId) return;
    const submission = ++submitRevision;
    submitMode = 'create';
    const current = () =>
      submitRevision === submission &&
      formRef.value === form &&
      createFormModel.value === model &&
      isCreateModalVisible.value &&
      filterClusterId.value === clusterId &&
      createOwner === owner &&
      operationOwner() === owner;

    try {
      await form.validate();
      if (!current()) return;
      submitLoading.value = true;

      const params: YamlTemplateCreateReq = {
        cluster_id: clusterId,
        content: createFormModel.value.content,
        name: createFormModel.value.name,
      };

      await createYamlTemplate(params);
      if (!current()) return;
      message.success('模板创建成功');
      isCreateModalVisible.value = false;
      await fetchTemplates();
    } catch (error: any) {
      if (!current()) return;
      if (error.errorFields) return;
      if (shouldNotifyPageError(error))
        message.error(`创建模板失败：${error.message || '未知错误'}`);
    } finally {
      if (submitRevision === submission) submitLoading.value = false;
    }
  };

  // 编辑模板
  const openEditModal = (record: K8sYamlTemplate) => {
    submitMode = 'edit';
    submitRevision++;
    submitLoading.value = false;
    editOwner = operationOwner();
    editRevision++;
    currentOperationTemplate.value = record;
    editFormModel.value = {
      content: record.content,
      name: record.name,
    };
    isEditModalVisible.value = true;
  };

  const closeEditModal = () => {
    if (submitMode === 'edit') {
      submitRevision++;
      submitLoading.value = false;
      submitMode = undefined;
    }
    editOwner = undefined;
    editRevision++;
    isEditModalVisible.value = false;
    currentOperationTemplate.value = null;
  };

  const submitEditForm = async () => {
    const form = editFormRef.value;
    const record = currentOperationTemplate.value;
    const owner = editOwner;
    const revision = editRevision;
    if (!form || !record || owner !== operationOwner()) return;

    const clusterId = validateClusterId();
    if (!clusterId) return;
    const id = validateTemplateId(record);
    if (id === undefined) return;
    const submission = ++submitRevision;
    submitMode = 'edit';
    const current = () =>
      submitRevision === submission &&
      editFormRef.value === form &&
      isEditModalVisible.value &&
      currentOperationTemplate.value === record &&
      record.id === id &&
      filterClusterId.value === clusterId &&
      editOwner === owner &&
      editRevision === revision &&
      operationOwner() === owner;

    try {
      await form.validate();
      if (!current()) return;
      submitLoading.value = true;

      const params: YamlTemplateUpdateReq = {
        cluster_id: clusterId,
        content: editFormModel.value.content,
        id,
        name: editFormModel.value.name,
      };

      await updateYamlTemplate(params);
      if (!current()) return;
      message.success('模板更新成功');
      isEditModalVisible.value = false;
      await fetchTemplates();
    } catch (error: any) {
      if (!current()) return;
      if (error.errorFields) return;
      if (shouldNotifyPageError(error))
        message.error(`更新模板失败：${error.message || '未知错误'}`);
    } finally {
      if (submitRevision === submission) submitLoading.value = false;
    }
  };

  // 检查模板
  const checkTemplate = async (content: string) => {
    if (!content || content.trim().length < 10) {
      message.warning('请输入有效的 YAML 内容');
      return false;
    }

    const clusterId = validateClusterId();
    if (!clusterId) return false;

    try {
      checkLoading.value = true;
      const params: YamlTemplateCheckReq = {
        cluster_id: clusterId,
        content,
        name:
          createFormModel.value.name ||
          editFormModel.value.name ||
          'temp-check',
      };

      await checkYamlTemplate(params);
      message.success('YAML 格式检查通过');
      return true;
    } catch (error: any) {
      if (shouldNotifyPageError(error))
        message.error(`YAML 格式检查失败：${error.message || '未知错误'}`);
      return false;
    } finally {
      checkLoading.value = false;
    }
  };

  // 删除模板
  const deleteTemplate = (record: K8sYamlTemplate) => {
    const clusterId = validateClusterId();
    if (!clusterId) return;
    const id = validateTemplateId(record);
    if (id === undefined) return;
    const owner = operationOwner();
    const current = () =>
      record.id === id &&
      filterClusterId.value === clusterId &&
      operationOwner() === owner;

    Modal.confirm({
      cancelText: '取消',
      centered: true,
      content: `确定要删除模板 "${record.name}" 吗？此操作不可逆！`,
      okText: '确认删除',
      okType: 'danger',
      onOk: async () => {
        if (!current()) return;
        try {
          const params: YamlTemplateDeleteReq = {
            cluster_id: clusterId,
            id,
          };
          await deleteYamlTemplate(params);
          if (!current()) return;
          message.success('模板删除成功');
          await fetchTemplates();
        } catch (error: any) {
          if (!current()) return;
          if (shouldNotifyPageError(error))
            message.error(`删除模板失败：${error.message || '未知错误'}`);
        }
      },
      title: '删除模板',
    });
  };

  // 批量操作
  const batchOperation = (operation: string) => {
    if (selectedRows.value.length === 0) return;

    const clusterId = validateClusterId();
    if (!clusterId) return;
    const owner = operationOwner();
    const selection = selectedRows.value;
    const selectedKeys = selectedRowKeys.value;
    const keySnapshot = [...selectedKeys];
    const ids: number[] = [];
    for (const record of selection) {
      const id = validateTemplateId(record);
      if (id === undefined) return;
      ids.push(id);
    }
    const current = () =>
      filterClusterId.value === clusterId &&
      operationOwner() === owner &&
      selectedRows.value === selection &&
      selectedRowKeys.value === selectedKeys &&
      selectedKeys.length === keySnapshot.length &&
      selectedKeys.every((key, index) => key === keySnapshot[index]) &&
      selection.length === ids.length &&
      selection.every((record, index) => record.id === ids[index]);

    Modal.confirm({
      cancelText: '取消',
      centered: true,
      content: `确定要对选中的 ${selectedRows.value.length} 个模板执行${operation}操作吗？`,
      okText: '确认执行',
      okType: operation === '删除' ? 'danger' : 'primary',
      onOk: async () => {
        if (!current()) return;
        try {
          for (const id of ids) {
            if (!current()) return;
            if (operation === '删除') {
              const params: YamlTemplateDeleteReq = {
                cluster_id: clusterId,
                id,
              };
              await deleteYamlTemplate(params);
            }
          }
          if (!current()) return;
          message.success(`批量${operation}操作已完成`);
          selectedRowKeys.value = [];
          selectedRows.value = [];
          await fetchTemplates();
        } catch (error: any) {
          if (!current()) return;
          if (shouldNotifyPageError(error))
            message.error(
              `批量${operation}失败：${error.message || '未知错误'}`,
            );
        }
      },
      title: `批量${operation}`,
    });
  };

  // 加载更多集群
  const loadMoreClusters = async () => {
    if (clustersPage.value * clustersSize.value >= clustersTotal.value) {
      return;
    }
    clustersPage.value += 1;
    await fetchClusters();
  };

  // 分页变化处理
  const handlePageChange = async (page: number, size?: number) => {
    currentPage.value = page;
    if (size && size !== pageSize.value) {
      pageSize.value = size;
    }
    await fetchTemplates();
  };

  // YAML 操作方法
  // 插入默认模板（用于创建表单）
  const insertYamlTemplate = () => {
    if (createFormModel.value.content && createFormModel.value.content.trim()) {
      Modal.confirm({
        cancelText: '取消',
        centered: true,
        content: '当前已有内容，插入模板将覆盖现有内容，是否继续？',
        okText: '确认',
        onOk: () => {
          createFormModel.value.content = DEFAULT_YAML_TEMPLATE;
          message.success('模板已插入');
        },
        title: '确认操作',
      });
    } else {
      createFormModel.value.content = DEFAULT_YAML_TEMPLATE;
      message.success('模板已插入');
    }
  };

  // 格式化 YAML（用于创建表单）
  const formatYaml = () => {
    const yamlContent = createFormModel.value.content;
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
      createFormModel.value.content = formatted;
      message.success('YAML 格式化成功');
    } catch (error: any) {
      message.error(`YAML 格式化失败：${error.message || '格式不正确'}`);
    }
  };

  // 验证 YAML（用于创建表单）
  const validateYaml = () => {
    const yamlContent = createFormModel.value.content;
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

      const obj = parsed as any;

      // 基本结构检查
      if (!obj.apiVersion) {
        message.warning('YAML 缺少 apiVersion 字段');
        return;
      }

      if (!obj.kind) {
        message.warning('YAML 缺少 kind 字段');
        return;
      }

      if (!obj.metadata) {
        message.warning('YAML 缺少 metadata 字段');
        return;
      }

      if (!obj.spec && obj.kind !== 'Namespace') {
        message.warning('YAML 缺少 spec 字段');
        return;
      }

      message.success('YAML 格式检查通过');
    } catch (error: any) {
      message.error(`YAML 格式检查失败：${error.message || '未知错误'}`);
    }
  };

  // 清空 YAML（用于创建表单）
  const clearYaml = () => {
    if (createFormModel.value.content && createFormModel.value.content.trim()) {
      Modal.confirm({
        cancelText: '取消',
        centered: true,
        content: '确定要清空当前的 YAML 内容吗？此操作不可恢复。',
        okText: '确认清空',
        okType: 'danger',
        onOk: () => {
          createFormModel.value.content = '';
          message.success('YAML 内容已清空');
        },
        title: '确认清空',
      });
    } else {
      message.info('YAML 内容已为空');
    }
  };

  // 格式化 YAML（用于编辑表单）
  const formatEditYaml = () => {
    const yamlContent = editFormModel.value.content;
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
      editFormModel.value.content = formatted;
      message.success('YAML 格式化成功');
    } catch (error: any) {
      message.error(`YAML 格式化失败：${error.message || '格式不正确'}`);
    }
  };

  // 验证 YAML（用于编辑表单）
  const validateEditYaml = () => {
    const yamlContent = editFormModel.value.content;
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

      const obj = parsed as any;

      // 基本结构检查
      if (!obj.apiVersion) {
        message.warning('YAML 缺少 apiVersion 字段');
        return;
      }

      if (!obj.kind) {
        message.warning('YAML 缺少 kind 字段');
        return;
      }

      if (!obj.metadata) {
        message.warning('YAML 缺少 metadata 字段');
        return;
      }

      if (!obj.spec && obj.kind !== 'Namespace') {
        message.warning('YAML 缺少 spec 字段');
        return;
      }

      message.success('YAML 格式检查通过');
    } catch (error: any) {
      message.error(`YAML 格式检查失败：${error.message || '未知错误'}`);
    }
  };

  return {
    // batch operations
    batchOperation,
    // modal state
    checkLoading,
    // template operations
    checkTemplate,
    // operations
    clearTemplates,
    // YAML operations
    clearYaml,
    // create operations
    closeCreateModal,
    // detail operations
    closeDetailModal,
    // edit operations
    closeEditModal,
    // YAML operations
    closeYamlModal,
    // state
    clusters,
    clustersError,
    clustersLoading,
    clustersPage,
    clustersSize,
    clustersTotal,
    // form models
    createFormModel,

    // form rules
    createFormRules,
    // operation targets
    currentOperationTemplate,
    currentPage,

    currentTemplateDetail,
    deleteTemplate,
    detailLoading,
    editFormModel,
    // form refs
    editFormRef,
    editFormRules,
    fetchClusters,

    fetchTemplates,
    filterClusterId,

    // computed
    filteredTemplates,
    formatEditYaml,
    // helpers
    formatK8sTime,

    formatYaml,
    formRef,

    getClusterName,
    getEnvText,

    getUserDisplay,
    // pagination operations
    handlePageChange,
    insertYamlTemplate,
    isCreateModalVisible,
    isDetailModalVisible,

    isEditModalVisible,
    isYamlModalVisible,
    loadError,
    loading,

    loadMoreClusters,
    openCreateModal,

    openEditModal,
    pageSize,

    resetClusters,
    rowSelection,
    searchText,

    selectedRowKeys,
    selectedRows,
    showTemplateDetail,

    showYamlModal,
    submitCreateForm,

    submitEditForm,

    submitLoading,
    templates,

    total,
    validateClusterId,
    validateEditYaml,
    validateYaml,
    yamlFormModel,
    yamlFormRef,
  };
}
