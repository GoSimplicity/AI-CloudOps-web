import { ref, computed, h } from 'vue';
import { message, Modal } from 'ant-design-vue';
import type { FormInstance, Rule } from 'ant-design-vue/es/form';
import yaml from 'js-yaml';
import {
  type K8sConfigMap,
  type GetConfigMapListReq,
  type GetConfigMapDetailsReq,
  type CreateConfigMapReq,
  type UpdateConfigMapReq,
  type DeleteConfigMapReq,
  type GetConfigMapYamlReq,
  type CreateConfigMapByYamlReq,
  type UpdateConfigMapByYamlReq,
  getConfigMapListApi,
  getConfigMapDetailsApi,
  getConfigMapYamlApi,
  createConfigMapApi,
  createConfigMapByYamlApi,
  updateConfigMapApi,
  updateConfigMapByYamlApi,
  deleteConfigMapApi,
} from '#/api/core/k8s/k8s_configmap';
import {
  type K8sCluster,
  type ListClustersReq,
  type KeyValueList,
  getClustersListApi,
  Env,
} from '#/api/core/k8s/k8s_cluster';
import {
  type K8sNamespace,
  type K8sNamespaceListReq,
  getNamespacesListApi,
} from '#/api/core/k8s/k8s_namespace';

// YAML 模板常量
const CONFIGMAP_YAML_TEMPLATE = `apiVersion: v1
kind: ConfigMap
metadata:
  name: my-configmap
  labels:
    app: my-app
data:
  config.properties: |
    database.host=localhost
    database.port=5432
    database.name=mydb
  application.yaml: |
    server:
      port: 8080
      host: 0.0.0.0
    logging:
      level: info`;

export function useConfigMapPage() {
  // state
  const configMaps = ref<K8sConfigMap[]>([]);
  const clusters = ref<K8sCluster[]>([]);
  const namespaces = ref<K8sNamespace[]>([]);
  const loading = ref(false);
  const clustersLoading = ref(false);
  const namespacesLoading = ref(false);
  const searchText = ref('');
  const filterClusterId = ref<number | undefined>(undefined);
  const filterNamespace = ref<string | undefined>(undefined);
  const filterDataKey = ref<string | undefined>(undefined);
  const filterLabels = ref<Record<string, string>>({});
  const selectedRowKeys = ref<string[]>([]);
  const selectedRows = ref<K8sConfigMap[]>([]);
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
  const currentOperationConfigMap = ref<K8sConfigMap | null>(null);
  const currentConfigMapDetail = ref<any | null>(null);

  // form models
  const createFormModel = ref<{
    name: string;
    namespace: string;
    data: Record<string, string>;
    binary_data: Record<string, string>;
    labels: Record<string, string>;
    annotations: Record<string, string>;
    immutable: boolean;
  }>({
    name: '',
    namespace: '',
    data: {},
    binary_data: {},
    labels: {},
    annotations: {},
    immutable: false,
  });

  const editFormModel = ref<{
    name: string;
    namespace: string;
    data: Record<string, string>;
    binary_data: Record<string, string>;
    labels: Record<string, string>;
    annotations: Record<string, string>;
    immutable: boolean;
  }>({
    name: '',
    namespace: '',
    data: {},
    binary_data: {},
    labels: {},
    annotations: {},
    immutable: false,
  });

  const yamlFormModel = ref<{
    yaml: string;
  }>({
    yaml: ''
  });

  const createYamlFormModel = ref<{
    yaml: string;
  }>({
    yaml: ''
  });

  // form validation rules
  const createFormRules: Record<string, Rule[]> = {
    name: [
      { required: true, message: '请输入 ConfigMap 名称', trigger: 'blur' },
      { pattern: /^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/, message: 'ConfigMap 名称只能包含小写字母、数字和连字符，且不能以连字符开头或结尾', trigger: 'blur' },
      { max: 63, message: 'ConfigMap 名称长度不能超过63个字符', trigger: 'blur' }
    ],
    namespace: [
      { required: true, message: '请选择命名空间', trigger: 'change' }
    ]
  };

  const yamlFormRules: Record<string, Rule[]> = {
    yaml: [
      { required: true, message: '请输入 YAML 内容', trigger: 'blur' },
      { min: 50, message: 'YAML 内容过短，请检查是否完整', trigger: 'blur' }
    ]
  };

  const createYamlFormRules: Record<string, Rule[]> = {
    yaml: [
      { required: true, message: '请输入 YAML 内容', trigger: 'blur' },
      { min: 50, message: 'YAML 内容过短，请检查是否完整', trigger: 'blur' }
    ]
  };

  // computed
  const filteredConfigMaps = computed(() => {
    return configMaps.value;
  });

  const rowSelection = computed(() => ({
    selectedRowKeys: selectedRowKeys.value,
    onChange: (keys: string[], rows: K8sConfigMap[]) => {
      selectedRowKeys.value = keys;
      selectedRows.value = rows;
    },
  }));

  // helpers
  const validateClusterId = (record: K8sConfigMap): number | null => {
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

  const recordToKeyValueList = (record: Record<string, string> | null | undefined): KeyValueList => {
    if (!record || typeof record !== 'object') {
      return [];
    }
    return Object.entries(record).map(([key, value]: [string, string]) => ({ key, value }));
  };

  const keyValueListToRecord = (data?: KeyValueList | Record<string, string>): Record<string, string> => {
    if (!data) return {};
    
    if (typeof data === 'object' && !Array.isArray(data)) {
      return data as Record<string, string>;
    }
    
    if (Array.isArray(data)) {
      return data.reduce((acc, { key, value }) => {
        acc[key] = value;
        return acc;
      }, {} as Record<string, string>);
    }
    
    return {};
  };

  const parseJsonField = (field: any, fallback: any = {}) => {
    if (!field) return fallback;
    if (typeof field === 'string') {
      try {
        return JSON.parse(field);
      } catch {
        return fallback;
      }
    }
    return field;
  };

  // cluster operations
  const clearConfigMaps = () => {
    configMaps.value = [];
    selectedRowKeys.value = [];
    selectedRows.value = [];
  };

  const clearNamespaces = () => {
    resetNamespaces();
    filterNamespace.value = undefined;
  };

  const fetchClusters = async (reset = false) => {
    if (reset) {
      resetClusters();
    }
    try {
      clustersLoading.value = true;
      const params: ListClustersReq = {
        page: clustersPage.value,
        size: clustersSize.value,
      };
      const res = await getClustersListApi(params);
      if (clustersPage.value === 1) {
        clusters.value = res?.items || [];
      } else {
        clusters.value = [...clusters.value, ...(res?.items || [])];
      }
      clustersTotal.value = res?.total || 0;
      
      if (!filterClusterId.value && clusters.value.length > 0) {
        const firstCluster = clusters.value[0];
        if (firstCluster?.id) {
          filterClusterId.value = firstCluster.id;
          message.info(`已自动选择集群: ${firstCluster.name || '未知集群'}`);
          await fetchNamespaces();
          await fetchConfigMaps();
        }
      }
    } catch (err) {
      message.error('获取集群列表失败');

    } finally {
      clustersLoading.value = false;
    }
  };

  const fetchNamespaces = async (reset = false) => {
    if (!filterClusterId.value) return;
    
    if (reset) {
      resetNamespaces();
    }
    
    try {
      namespacesLoading.value = true;
      const params: K8sNamespaceListReq = {
        cluster_id: filterClusterId.value,
        page: namespacesPage.value,
        size: namespacesSize.value,
      };
      const res = await getNamespacesListApi(filterClusterId.value, params);
      if (namespacesPage.value === 1) {
        namespaces.value = res?.items || [];
      } else {
        namespaces.value = [...namespaces.value, ...(res?.items || [])];
      }
      namespacesTotal.value = res?.total || 0;
    } catch (err) {
      message.error('获取命名空间列表失败');

    } finally {
      namespacesLoading.value = false;
    }
  };

  // crud operations
  const fetchConfigMaps = async () => {
    if (!filterClusterId.value || filterClusterId.value === 0) {
      message.warning('请先选择有效的集群');
      configMaps.value = [];
      total.value = 0;
      return;
    }

    try {
      loading.value = true;
      const params: GetConfigMapListReq = {
        cluster_id: filterClusterId.value,
        page: currentPage.value,
        size: pageSize.value,
        labels: Object.keys(filterLabels.value).length > 0 
          ? filterLabels.value 
          : undefined,
      };
      const res = await getConfigMapListApi(params);
      
      const configMapsWithClusterId = (res?.items || []).map((configMap: K8sConfigMap) => ({
        ...configMap,
        cluster_id: configMap.cluster_id || filterClusterId.value || 0,
        data: parseJsonField(configMap.data, {}),
        binary_data: parseJsonField(configMap.binary_data, {}),
        labels: parseJsonField(configMap.labels, {}),
        annotations: parseJsonField(configMap.annotations, {}),
      }));
      
      configMaps.value = configMapsWithClusterId;
      total.value = res?.total || 0;
    } catch (err) {
      message.error('获取 ConfigMap 列表失败');

    } finally {
      loading.value = false;
    }
  };

  // 查看详情
  const showConfigMapDetail = async (record: K8sConfigMap) => {
    const clusterId = validateClusterId(record);
    if (!clusterId) return;
    
    try {
      detailLoading.value = true;
      isDetailModalVisible.value = true;
      const params: GetConfigMapDetailsReq = {
        cluster_id: clusterId,
        namespace: record.namespace,
        name: record.name
      };
      const res = await getConfigMapDetailsApi(params);
      
      const processedDetail = res ? {
        ...res,
        cluster_id: clusterId,
        labels: recordToKeyValueList(parseJsonField(res.labels, {})),
        annotations: recordToKeyValueList(parseJsonField(res.annotations, {})),
        data: parseJsonField(res.data, {}),
        binary_data: convertBinaryDataToForm(parseJsonField(res.binary_data, {})),
      } : { 
        ...record, 
        cluster_id: clusterId,
        labels: recordToKeyValueList(parseJsonField(record.labels, {})),
        annotations: recordToKeyValueList(parseJsonField(record.annotations, {})),
        data: parseJsonField(record.data, {}),
        binary_data: convertBinaryDataToForm(parseJsonField(record.binary_data, {})),
      };
      
      currentConfigMapDetail.value = processedDetail;
    } catch (err) {
      message.error('获取 ConfigMap 详情失败');

      try {
        const fallbackDetail = { 
          ...record, 
          cluster_id: clusterId,
          labels: recordToKeyValueList(parseJsonField(record.labels, {})),
          annotations: recordToKeyValueList(parseJsonField(record.annotations, {})),
          data: parseJsonField(record.data, {}),
          binary_data: convertBinaryDataToForm(parseJsonField(record.binary_data, {})),
        };
        currentConfigMapDetail.value = fallbackDetail;
      } catch (fallbackError) {
        currentConfigMapDetail.value = {
          ...record,
          cluster_id: clusterId,
          labels: [],
          annotations: [],
          data: {},
          binary_data: {},
        };
      }
    } finally {
      detailLoading.value = false;
    }
  };

  const closeDetailModal = () => {
    isDetailModalVisible.value = false;
    currentConfigMapDetail.value = null;
  };

  // YAML 操作
  const showYamlModal = async (record: K8sConfigMap) => {
    const clusterId = validateClusterId(record);
    if (!clusterId) return;
    
    try {
      submitLoading.value = true;
      currentOperationConfigMap.value = { ...record, cluster_id: clusterId };
      const params: GetConfigMapYamlReq = {
        cluster_id: clusterId,
        namespace: record.namespace,
        name: record.name
      };
      
      const res = await getConfigMapYamlApi(params);
      
      yamlFormModel.value.yaml = res?.yaml || '';
      isYamlModalVisible.value = true;
    } catch (err) {
      message.error('获取 ConfigMap YAML 失败');

    } finally {
      submitLoading.value = false;
    }
  };

  const closeYamlModal = () => {
    isYamlModalVisible.value = false;
    currentOperationConfigMap.value = null;
    yamlFormModel.value.yaml = '';
  };

  const submitYamlForm = async () => {
    if (!yamlFormRef.value || !currentOperationConfigMap.value) return;
    
    try {
      await yamlFormRef.value.validate();
      submitLoading.value = true;
      
      const params: UpdateConfigMapByYamlReq = {
        cluster_id: currentOperationConfigMap.value.cluster_id,
        namespace: currentOperationConfigMap.value.namespace,
        name: currentOperationConfigMap.value.name,
        yaml: yamlFormModel.value.yaml,
      };
      
      await updateConfigMapByYamlApi(params);
      message.success('ConfigMap YAML 更新成功');
      isYamlModalVisible.value = false;
      await fetchConfigMaps();
    } catch (err: unknown) {
      if (err && typeof err === 'object' && 'errorFields' in err) {
        message.warning('请检查 YAML 格式是否正确');
        return;
      }
      message.error('ConfigMap YAML 更新失败');

    } finally {
      submitLoading.value = false;
    }
  };

  // 创建 ConfigMap
  const openCreateModal = () => {
    createFormModel.value = {
      name: '',
      namespace: '',
      data: {},
      binary_data: {},
      labels: {},
      annotations: {},
      immutable: false,
    };
    isCreateModalVisible.value = true;
  };

  const closeCreateModal = () => {
    isCreateModalVisible.value = false;
  };

  // 通过 YAML 创建 ConfigMap
  const openCreateYamlModal = () => {
    createYamlFormModel.value.yaml = '';
    isCreateYamlModalVisible.value = true;
  };

  const closeCreateYamlModal = () => {
    isCreateYamlModalVisible.value = false;
    createYamlFormModel.value.yaml = '';
  };

  const convertBinaryData = (binaryDataForm: Record<string, string>): Record<string, string> | undefined => {
    if (!binaryDataForm || typeof binaryDataForm !== 'object') return undefined;
    
    const entries = Object.entries(binaryDataForm);
    if (entries.length === 0) {
      return undefined;
    }
    
    const result: Record<string, string> = {};
    const invalidKeys: string[] = [];
    
    for (const [key, value] of entries) {
      if (key && typeof key === 'string' && value !== undefined && value !== null) {
        if (typeof value === 'string') {
          const trimmedValue = value.trim();
          if (trimmedValue === '') {
            result[key] = '';
          } else {
            const cleanValue = trimmedValue.replace(/\s/g, '');
            if (/^[A-Za-z0-9+/]*={0,2}$/.test(cleanValue)) {
              if (cleanValue.length % 4 === 0) {
                result[key] = cleanValue;
              } else {
                const paddingNeeded = (4 - (cleanValue.length % 4)) % 4;
                const paddedValue = cleanValue + '='.repeat(paddingNeeded);
                result[key] = paddedValue;
              }
            } else {
              invalidKeys.push(key);
            }
          }
        }
      }
    }
    
    if (invalidKeys.length > 0) {
      message.warning(`以下二进制数据键包含无效的 base64 字符，已被跳过：${invalidKeys.join(', ')}`);
    }
    
    return Object.keys(result).length > 0 ? result : undefined;
  };

  const convertBinaryDataToForm = (binaryData: Record<string, string> | any): Record<string, string> => {
    if (!binaryData || typeof binaryData !== 'object') return {};
    
    const result: Record<string, string> = {};
    for (const [key, value] of Object.entries(binaryData)) {
      if (key && typeof key === 'string' && value !== undefined && value !== null) {
        if (typeof value === 'string') {
          result[key] = value;
        }
      }
    }
    return result;
  };

  const submitCreateForm = async () => {
    if (!formRef.value || !filterClusterId.value) return;
    
    try {
      await formRef.value.validate();
      submitLoading.value = true;
      
      const convertedBinaryData = convertBinaryData(createFormModel.value.binary_data);
      
      const params: CreateConfigMapReq = {
        cluster_id: filterClusterId.value,
        namespace: createFormModel.value.namespace,
        name: createFormModel.value.name,
        data: Object.keys(createFormModel.value.data).length > 0 ? createFormModel.value.data : undefined,
        binary_data: convertedBinaryData,
        labels: Object.keys(createFormModel.value.labels).length > 0 ? createFormModel.value.labels : undefined,
        annotations: Object.keys(createFormModel.value.annotations).length > 0 ? createFormModel.value.annotations : undefined,
        immutable: createFormModel.value.immutable,
      };
      
      await createConfigMapApi(params);
      message.success('ConfigMap 创建成功');
      isCreateModalVisible.value = false;
      await fetchConfigMaps();
    } catch (err: unknown) {
      if (err && typeof err === 'object' && 'errorFields' in err) {
        message.warning('请检查表单填写是否正确');
        return;
      }
      message.error('ConfigMap 创建失败');

    } finally {
      submitLoading.value = false;
    }
  };

  const submitCreateYamlForm = async () => {
    if (!createYamlFormRef.value || !filterClusterId.value) return;
    
    try {
      await createYamlFormRef.value.validate();
      submitLoading.value = true;
      
      const params: CreateConfigMapByYamlReq = {
        cluster_id: filterClusterId.value,
        yaml: createYamlFormModel.value.yaml,
      };
      
      await createConfigMapByYamlApi(params);
      message.success('ConfigMap YAML 创建成功');
      isCreateYamlModalVisible.value = false;
      await fetchConfigMaps();
    } catch (err: unknown) {
      if (err && typeof err === 'object' && 'errorFields' in err) {
        message.warning('请检查 YAML 格式是否正确');
        return;
      }
      message.error('ConfigMap YAML 创建失败');

    } finally {
      submitLoading.value = false;
    }
  };

  // 编辑 ConfigMap
  const openEditModal = (record: K8sConfigMap) => {
    currentOperationConfigMap.value = record;
    editFormModel.value = {
      name: record.name,
      namespace: record.namespace,
      data: parseJsonField(record.data, {}),
      binary_data: convertBinaryDataToForm(parseJsonField(record.binary_data, {})),
      labels: parseJsonField(record.labels, {}),
      annotations: parseJsonField(record.annotations, {}),
      immutable: false,
    };
    isEditModalVisible.value = true;
  };

  const closeEditModal = () => {
    isEditModalVisible.value = false;
    currentOperationConfigMap.value = null;
  };

  const submitEditForm = async () => {
    if (!formRef.value || !currentOperationConfigMap.value) return;
    
    try {
      await formRef.value.validate();
      submitLoading.value = true;
      
      const convertedBinaryData = convertBinaryData(editFormModel.value.binary_data);
      
      const params: UpdateConfigMapReq = {
        cluster_id: currentOperationConfigMap.value.cluster_id,
        namespace: currentOperationConfigMap.value.namespace,
        name: currentOperationConfigMap.value.name,
        data: Object.keys(editFormModel.value.data).length > 0 ? editFormModel.value.data : undefined,
        binary_data: convertedBinaryData,
        labels: Object.keys(editFormModel.value.labels).length > 0 ? editFormModel.value.labels : undefined,
        annotations: Object.keys(editFormModel.value.annotations).length > 0 ? editFormModel.value.annotations : undefined,
      };
      
      await updateConfigMapApi(params);
      message.success('ConfigMap 更新成功');
      isEditModalVisible.value = false;
      await fetchConfigMaps();
    } catch (err: unknown) {
      if (err && typeof err === 'object' && 'errorFields' in err) {
        message.warning('请检查表单填写是否正确');
        return;
      }
      message.error('ConfigMap 更新失败');

    } finally {
      submitLoading.value = false;
    }
  };

  // 删除 ConfigMap
  const deleteConfigMap = (record: K8sConfigMap) => {
    const clusterId = validateClusterId(record);
    if (!clusterId) return;
    
    Modal.confirm({
      title: '删除 ConfigMap',
      content: `确定要删除 ConfigMap "${record.name}" 吗？此操作不可逆！`,
      okText: '确认删除',
      okType: 'danger',
      cancelText: '取消',
      centered: true,
      onOk: async () => {
        try {
          const params: DeleteConfigMapReq = {
            cluster_id: clusterId,
            namespace: record.namespace,
            name: record.name,
          };
          await deleteConfigMapApi(params);
          message.success('ConfigMap 删除成功');
          await fetchConfigMaps();
        } catch (err) {
          message.error('ConfigMap 删除失败');

        }
      },
    });
  };

  // 标签过滤管理
  const addFilterLabel = (key: string, value: string) => {
    if (key && key.trim()) {
      filterLabels.value[key.trim()] = value;
      currentPage.value = 1;
      fetchConfigMaps();
    }
  };

  const removeFilterLabel = (key: string) => {
    delete filterLabels.value[key];
    currentPage.value = 1;
    fetchConfigMaps();
  };

  const clearFilterLabels = () => {
    filterLabels.value = {};
    currentPage.value = 1;
    fetchConfigMaps();
  };

  // 批量操作
  const batchOperation = (operation: string) => {
    if (!selectedRows.value.length) return;
    
    Modal.confirm({
      title: `批量${operation}`,
      content: `确定要对选中的 ${selectedRows.value.length} 个 ConfigMap 执行${operation}操作吗？`,
      okText: '确认执行',
      okType: operation === '删除' ? 'danger' : 'primary',
      cancelText: '取消',
      centered: true,
      onOk: async () => {
        try {
          if (operation === '删除') {
            for (const configMap of selectedRows.value) {
              const clusterId = configMap.cluster_id || filterClusterId.value;
              if (!clusterId) {
                message.error(`ConfigMap "${configMap.name}" 缺少有效的集群ID，跳过操作`);
                continue;
              }
              
              const params: DeleteConfigMapReq = {
                cluster_id: clusterId,
                namespace: configMap.namespace,
                name: configMap.name
              };
              await deleteConfigMapApi(params);
            }
          }
          
          message.success(`批量${operation}操作已完成`);
          selectedRowKeys.value = [];
          selectedRows.value = [];
          await fetchConfigMaps();
        } catch (err) {
          message.error(`批量${operation}失败`);

        }
      },
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

  const loadMoreNamespaces = async () => {
    if (namespacesPage.value * namespacesSize.value >= namespacesTotal.value) {
      return;
    }
    namespacesPage.value += 1;
    await fetchNamespaces();
  };

  // 重置集群列表
  const resetClusters = () => {
    clustersPage.value = 1;
    clusters.value = [];
  };

  const resetNamespaces = () => {
    namespacesPage.value = 1;
    namespaces.value = [];
    namespacesTotal.value = 0;
  };

  // 分页变化处理
  const handlePageChange = async (page: number, size?: number) => {
    currentPage.value = page;
    if (size && size !== pageSize.value) {
      pageSize.value = size;
    }
    await fetchConfigMaps();
  };

  const removeDataField = (key: string) => {
    delete createFormModel.value.data[key];
  };

  const removeEditDataField = (key: string) => {
    delete editFormModel.value.data[key];
  };

  const removeBinaryDataField = (key: string) => {
    delete createFormModel.value.binary_data[key];
  };

  const removeEditBinaryDataField = (key: string) => {
    delete editFormModel.value.binary_data[key];
  };

  const removeLabelField = (key: string) => {
    delete createFormModel.value.labels[key];
  };

  const removeEditLabelField = (key: string) => {
    delete editFormModel.value.labels[key];
  };

  const removeAnnotationField = (key: string) => {
    delete createFormModel.value.annotations[key];
  };

  const removeEditAnnotationField = (key: string) => {
    delete editFormModel.value.annotations[key];
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
          createYamlFormModel.value.yaml = CONFIGMAP_YAML_TEMPLATE;
          message.success('模板已插入');
        },
      });
    } else {
      createYamlFormModel.value.yaml = CONFIGMAP_YAML_TEMPLATE;
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

      // 基本的 ConfigMap 字段检查
      const configmap = parsed as any;
      const issues: string[] = [];

      if (!configmap.apiVersion) {
        issues.push('缺少 apiVersion 字段');
      }
      if (!configmap.kind) {
        issues.push('缺少 kind 字段');
      } else if (configmap.kind !== 'ConfigMap') {
        issues.push(`kind 应为 "ConfigMap"，当前为 "${configmap.kind}"`);
      }
      if (!configmap.metadata?.name) {
        issues.push('缺少 metadata.name 字段');
      }
      if (!configmap.data && !configmap.binaryData) {
        issues.push('建议至少设置 data 或 binaryData 字段之一');
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

      // 基本的 ConfigMap 字段检查
      const configmap = parsed as any;
      const issues: string[] = [];

      if (!configmap.apiVersion) {
        issues.push('缺少 apiVersion 字段');
      }
      if (!configmap.kind) {
        issues.push('缺少 kind 字段');
      } else if (configmap.kind !== 'ConfigMap') {
        issues.push(`kind 应为 "ConfigMap"，当前为 "${configmap.kind}"`);
      }
      if (!configmap.metadata?.name) {
        issues.push('缺少 metadata.name 字段');
      }
      if (!configmap.data && !configmap.binaryData) {
        issues.push('建议至少设置 data 或 binaryData 字段之一');
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
    configMaps,
    clusters,
    namespaces,
    loading,
    clustersLoading,
    namespacesLoading,
    searchText,
    filterClusterId,
    filterNamespace,
    filterDataKey,
    filterLabels,
    selectedRowKeys,
    selectedRows,
    currentPage,
    pageSize,
    total,
    clustersTotal,
    clustersPage,
    clustersSize,
    namespacesTotal,
    namespacesPage,
    namespacesSize,
    
    // form refs
    formRef,
    yamlFormRef,
    createYamlFormRef,
    
    // modal state
    isCreateModalVisible,
    isCreateYamlModalVisible,
    isEditModalVisible,
    isDetailModalVisible,
    isYamlModalVisible,
    submitLoading,
    detailLoading,
    
    // operation targets
    currentOperationConfigMap,
    currentConfigMapDetail,
    
    // form models
    createFormModel,
    editFormModel,
    yamlFormModel,
    createYamlFormModel,
    
    // form rules
    createFormRules,
    yamlFormRules,
    createYamlFormRules,
    
    // computed
    filteredConfigMaps,
    rowSelection,
    
    // helpers
    validateClusterId,
    getEnvText,
    recordToKeyValueList,
    keyValueListToRecord,
    parseJsonField,
    
    // operations
    fetchClusters,
    fetchNamespaces,
    fetchConfigMaps,
    clearConfigMaps,
    clearNamespaces,
    loadMoreClusters,
    loadMoreNamespaces,
    
    // detail operations
    showConfigMapDetail,
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
    
    // configmap operations
    deleteConfigMap,
    
    // filter operations
    addFilterLabel,
    removeFilterLabel,
    clearFilterLabels,
    
    // batch operations
    batchOperation,
    
    // pagination operations
    resetClusters,
    handlePageChange,
    
    // form field operations
    removeDataField,
    removeEditDataField,
    removeBinaryDataField,
    removeEditBinaryDataField,
    removeLabelField,
    removeEditLabelField,
    removeAnnotationField,
    removeEditAnnotationField,
    
    // yaml operations
    insertYamlTemplate,
    formatYaml,
    validateYaml,
    clearYaml,
    formatEditYaml,
    validateEditYaml,
  };
}
