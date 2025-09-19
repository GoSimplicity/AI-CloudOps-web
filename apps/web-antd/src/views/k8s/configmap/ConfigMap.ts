import { ref, computed } from 'vue';
import { message, Modal } from 'ant-design-vue';
import type { FormInstance, Rule } from 'ant-design-vue/es/form';
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
    binary_data: Record<string, string>; // 在表单中暂存为string，提交时转换
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
    binary_data: Record<string, string>; // 在表单中暂存为string，提交时转换
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

  // 转换函数：Record<string, string> -> KeyValueList
  const recordToKeyValueList = (record: Record<string, string> | null | undefined): KeyValueList => {
    if (!record || typeof record !== 'object') {
      return [];
    }
    return Object.entries(record).map(([key, value]: [string, string]) => ({ key, value }));
  };

  // 转换函数：KeyValueList 或对象 -> Record<string, string>
  const keyValueListToRecord = (data?: KeyValueList | Record<string, string>): Record<string, string> => {
    if (!data) return {};
    
    // 如果已经是对象格式，直接返回
    if (typeof data === 'object' && !Array.isArray(data)) {
      return data as Record<string, string>;
    }
    
    // 如果是数组格式，进行转换
    if (Array.isArray(data)) {
      return data.reduce((acc, { key, value }) => {
        acc[key] = value;
        return acc;
      }, {} as Record<string, string>);
    }
    
    return {};
  };

  // 解析JSON字段
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
      
      // 如果当前没有选择集群且有可用集群，自动选择第一个
      if (!filterClusterId.value && clusters.value.length > 0) {
        const firstCluster = clusters.value[0];
        if (firstCluster?.id) {
          filterClusterId.value = firstCluster.id;
          message.info(`已自动选择集群: ${firstCluster.name || '未知集群'}`);
          // 自动加载该集群的命名空间和ConfigMap数据
          await fetchNamespaces();
          await fetchConfigMaps();
        }
      }
    } catch (err) {
      message.error('获取集群列表失败');
      console.error(err);
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
      console.error(err);
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
      
      // 确保每个configmap对象都有正确的cluster_id和解析的JSON字段
      const configMapsWithClusterId = (res?.items || []).map((configMap: K8sConfigMap) => ({
        ...configMap,
        cluster_id: configMap.cluster_id || filterClusterId.value || 0,
        // 解析JSON字段
        data: parseJsonField(configMap.data, {}),
        binary_data: parseJsonField(configMap.binary_data, {}),
        labels: parseJsonField(configMap.labels, {}),
        annotations: parseJsonField(configMap.annotations, {}),
      }));
      
      configMaps.value = configMapsWithClusterId;
      total.value = res?.total || 0;
    } catch (err) {
      message.error('获取 ConfigMap 列表失败');
      console.error(err);
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
      
      // 转换标签和注解格式：从对象转为数组
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
      console.error(err);
      // 错误时也要处理格式转换
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
        console.warn('处理fallback数据时出现错误:', fallbackError);
        // 最终的安全fallback
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
      console.error(err);
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
      message.success('🎉 ConfigMap YAML 更新成功');
      isYamlModalVisible.value = false;
      await fetchConfigMaps();
    } catch (err: unknown) {
      if (err && typeof err === 'object' && 'errorFields' in err) {
        message.warning('请检查 YAML 格式是否正确');
        return;
      }
      message.error('❌ ConfigMap YAML 更新失败');
      console.error(err);
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

  // 转换二进制数据的辅助函数
  const convertBinaryData = (binaryDataForm: Record<string, string>): Record<string, Uint8Array> | undefined => {
    if (!binaryDataForm || Object.keys(binaryDataForm).length === 0) return undefined;
    
    const result: Record<string, Uint8Array> = {};
    for (const [key, value] of Object.entries(binaryDataForm)) {
      if (value && value.trim()) {
        try {
          // 将Base64字符串转换为Uint8Array
          const binaryString = atob(value.trim());
          const bytes = new Uint8Array(binaryString.length);
          for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
          }
          result[key] = bytes;
        } catch (error) {
          console.error(`转换二进制数据失败: ${key}`, error);
          // 跳过无效的Base64数据
        }
      }
    }
    return Object.keys(result).length > 0 ? result : undefined;
  };

  // 反向转换二进制数据（从Uint8Array转为Base64字符串用于表单显示）
  const convertBinaryDataToForm = (binaryData: Record<string, Uint8Array> | any): Record<string, string> => {
    if (!binaryData || typeof binaryData !== 'object') return {};
    
    const result: Record<string, string> = {};
    for (const [key, value] of Object.entries(binaryData)) {
      if (value) {
        try {
          if (value instanceof Uint8Array) {
            // 将Uint8Array转换为Base64字符串
            let binaryString = '';
            for (let i = 0; i < value.length; i++) {
              const byte = value[i];
              if (byte !== undefined) {
                binaryString += String.fromCharCode(byte);
              }
            }
            result[key] = btoa(binaryString);
          } else if (typeof value === 'string') {
            // 如果已经是字符串，直接使用
            result[key] = value;
          }
        } catch (error) {
          console.error(`转换二进制数据到表单失败: ${key}`, error);
          result[key] = String(value); // 降级处理
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
      
      const params: CreateConfigMapReq = {
        cluster_id: filterClusterId.value,
        namespace: createFormModel.value.namespace,
        name: createFormModel.value.name,
        data: Object.keys(createFormModel.value.data).length > 0 ? createFormModel.value.data : undefined,
        binary_data: convertBinaryData(createFormModel.value.binary_data),
        labels: Object.keys(createFormModel.value.labels).length > 0 ? createFormModel.value.labels : undefined,
        annotations: Object.keys(createFormModel.value.annotations).length > 0 ? createFormModel.value.annotations : undefined,
        immutable: createFormModel.value.immutable,
      };
      
      await createConfigMapApi(params);
      message.success('🎉 ConfigMap 创建成功');
      isCreateModalVisible.value = false;
      await fetchConfigMaps();
    } catch (err: unknown) {
      if (err && typeof err === 'object' && 'errorFields' in err) {
        message.warning('请检查表单填写是否正确');
        return;
      }
      message.error('❌ ConfigMap 创建失败');
      console.error(err);
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
      message.success('🎉 ConfigMap YAML 创建成功');
      isCreateYamlModalVisible.value = false;
      await fetchConfigMaps();
    } catch (err: unknown) {
      if (err && typeof err === 'object' && 'errorFields' in err) {
        message.warning('请检查 YAML 格式是否正确');
        return;
      }
      message.error('❌ ConfigMap YAML 创建失败');
      console.error(err);
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
      immutable: false, // ConfigMap的immutable字段通常在创建后不可修改
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
      
      const params: UpdateConfigMapReq = {
        cluster_id: currentOperationConfigMap.value.cluster_id,
        namespace: currentOperationConfigMap.value.namespace,
        name: currentOperationConfigMap.value.name,
        data: Object.keys(editFormModel.value.data).length > 0 ? editFormModel.value.data : undefined,
        binary_data: convertBinaryData(editFormModel.value.binary_data),
        labels: Object.keys(editFormModel.value.labels).length > 0 ? editFormModel.value.labels : undefined,
        annotations: Object.keys(editFormModel.value.annotations).length > 0 ? editFormModel.value.annotations : undefined,
      };
      
      await updateConfigMapApi(params);
      message.success('🎉 ConfigMap 更新成功');
      isEditModalVisible.value = false;
      await fetchConfigMaps();
    } catch (err: unknown) {
      if (err && typeof err === 'object' && 'errorFields' in err) {
        message.warning('请检查表单填写是否正确');
        return;
      }
      message.error('❌ ConfigMap 更新失败');
      console.error(err);
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
          message.success('✅ ConfigMap 删除成功');
          await fetchConfigMaps();
        } catch (err) {
          message.error('❌ ConfigMap 删除失败');
          console.error(err);
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
          
          message.success(`✅ 批量${operation}操作已完成`);
          selectedRowKeys.value = [];
          selectedRows.value = [];
          await fetchConfigMaps();
        } catch (err) {
          message.error(`❌ 批量${operation}失败`);
          console.error(err);
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

  // 表单字段操作 - 数据字段
  const addDataField = () => {
    // 数据字段通过键值对输入组件管理
  };

  const removeDataField = (key: string) => {
    delete createFormModel.value.data[key];
  };

  const removeEditDataField = (key: string) => {
    delete editFormModel.value.data[key];
  };

  // 表单字段操作 - 二进制数据字段
  const addBinaryDataField = () => {
    // 二进制数据字段通过键值对输入组件管理
  };

  const removeBinaryDataField = (key: string) => {
    delete createFormModel.value.binary_data[key];
  };

  const removeEditBinaryDataField = (key: string) => {
    delete editFormModel.value.binary_data[key];
  };

  // 表单字段操作 - 标签字段
  const addLabelField = () => {
    // 标签字段通过键值对输入组件管理
  };

  const removeLabelField = (key: string) => {
    delete createFormModel.value.labels[key];
  };

  const removeEditLabelField = (key: string) => {
    delete editFormModel.value.labels[key];
  };

  // 表单字段操作 - 注解字段
  const addAnnotationField = () => {
    // 注解字段通过键值对输入组件管理
  };

  const removeAnnotationField = (key: string) => {
    delete createFormModel.value.annotations[key];
  };

  const removeEditAnnotationField = (key: string) => {
    delete editFormModel.value.annotations[key];
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
    addDataField,
    removeDataField,
    removeEditDataField,
    addBinaryDataField,
    removeBinaryDataField,
    removeEditBinaryDataField,
    addLabelField,
    removeLabelField,
    removeEditLabelField,
    addAnnotationField,
    removeAnnotationField,
    removeEditAnnotationField,
  };
}
