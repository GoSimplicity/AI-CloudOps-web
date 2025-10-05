import { ref, computed, h } from 'vue';
import { message, Modal } from 'ant-design-vue';
import type { FormInstance, Rule } from 'ant-design-vue/es/form';
import yaml from 'js-yaml';
import {
  type K8sSecret,
  type GetSecretListReq,
  type GetSecretDetailsReq,
  type CreateSecretReq,
  type UpdateSecretReq,
  type DeleteSecretReq,
  type GetSecretYamlReq,
  type CreateSecretByYamlReq,
  type UpdateSecretByYamlReq,
  K8sSecretType,
  getSecretListApi,
  getSecretDetailsApi,
  getSecretYamlApi,
  createSecretApi,
  createSecretByYamlApi,
  updateSecretApi,
  updateSecretByYamlApi,
  deleteSecretApi,
} from '#/api/core/k8s/k8s_secret';
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
const SECRET_YAML_TEMPLATE = `apiVersion: v1
kind: Secret
metadata:
  name: my-secret
  labels:
    app: my-app
type: Opaque
stringData:
  username: admin
  password: mypassword
  database.properties: |
    db.host=localhost
    db.port=5432
    db.name=mydb`;

export function useSecretPage() {
  // state
  const secrets = ref<K8sSecret[]>([]);
  const clusters = ref<K8sCluster[]>([]);
  const namespaces = ref<K8sNamespace[]>([]);
  const loading = ref(false);
  const clustersLoading = ref(false);
  const namespacesLoading = ref(false);
  const searchText = ref('');
  const filterClusterId = ref<number | undefined>(undefined);
  const filterNamespace = ref<string | undefined>(undefined);
  const filterType = ref<K8sSecretType | undefined>(undefined);
  const filterLabels = ref<Record<string, string>>({});
  const selectedRowKeys = ref<string[]>([]);
  const selectedRows = ref<K8sSecret[]>([]);
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
  const currentOperationSecret = ref<K8sSecret | null>(null);
  const currentSecretDetail = ref<any | null>(null);

  // form models
  const createFormModel = ref<{
    name: string;
    namespace: string;
    type: K8sSecretType;
    data: Record<string, Uint8Array>;
    string_data: Record<string, string>;
    labels: Record<string, string>;
    annotations: Record<string, string>;
    immutable: boolean;
  }>({
    name: '',
    namespace: '',
    type: K8sSecretType.Opaque,
    data: {},
    string_data: {},
    labels: {},
    annotations: {},
    immutable: false,
  });

  const editFormModel = ref<{
    name: string;
    namespace: string;
    data: Record<string, Uint8Array>;
    string_data: Record<string, string>;
    labels: Record<string, string>;
    annotations: Record<string, string>;
  }>({
    name: '',
    namespace: '',
    data: {},
    string_data: {},
    labels: {},
    annotations: {},
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
      { required: true, message: '请输入 Secret 名称', trigger: 'blur' },
      { pattern: /^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/, message: 'Secret 名称只能包含小写字母、数字和连字符，且不能以连字符开头或结尾', trigger: 'blur' },
      { max: 253, message: 'Secret 名称长度不能超过253个字符', trigger: 'blur' }
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
  const filteredSecrets = computed(() => {
    return secrets.value;
  });

  const rowSelection = computed(() => ({
    selectedRowKeys: selectedRowKeys.value,
    onChange: (keys: string[], rows: K8sSecret[]) => {
      selectedRowKeys.value = keys;
      selectedRows.value = rows;
    },
  }));

  // helpers
  const validateClusterId = (record: K8sSecret): number | null => {
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

  // 获取Secret类型显示文本
  const getSecretTypeText = (type: K8sSecretType): string => {
    const typeMap: Record<K8sSecretType, string> = {
      [K8sSecretType.Opaque]: '通用Secret',
      [K8sSecretType.ServiceAccountToken]: 'SA令牌',
      [K8sSecretType.Dockercfg]: 'Docker配置',
      [K8sSecretType.DockerConfigJson]: 'Docker配置JSON',
      [K8sSecretType.BasicAuth]: '基础认证',
      [K8sSecretType.SSHAuth]: 'SSH认证',
      [K8sSecretType.TLS]: 'TLS证书',
      [K8sSecretType.BootstrapToken]: '引导令牌',
    };
    return typeMap[type] || type;
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
  const clearSecrets = () => {
    secrets.value = [];
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
          // 自动加载该集群的命名空间和Secret数据
          await fetchNamespaces();
          await fetchSecrets();
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
  const fetchSecrets = async () => {
    if (!filterClusterId.value || filterClusterId.value === 0) {
      message.warning('请先选择有效的集群');
      secrets.value = [];
      total.value = 0;
      return;
    }

    try {
      loading.value = true;
      const params: GetSecretListReq = {
        cluster_id: filterClusterId.value,
        page: currentPage.value,
        size: pageSize.value,
        namespace: filterNamespace.value,
        type: filterType.value,
        labels: Object.keys(filterLabels.value).length > 0 
          ? filterLabels.value 
          : undefined,
      };
      const res = await getSecretListApi(params);
      
      // 确保每个secret对象都有正确的cluster_id和解析的JSON字段
      const secretsWithClusterId = (res?.items || []).map((secret: K8sSecret) => ({
        ...secret,
        cluster_id: secret.cluster_id || filterClusterId.value || 0,
        // 解析JSON字段
        data: parseJsonField(secret.data, {}),
        string_data: parseJsonField(secret.string_data, {}),
        labels: parseJsonField(secret.labels, {}),
        annotations: parseJsonField(secret.annotations, {}),
      }));
      
      secrets.value = secretsWithClusterId;
      total.value = res?.total || 0;
    } catch (err) {
      message.error('获取 Secret 列表失败');

    } finally {
      loading.value = false;
    }
  };

  // 查看详情
  const showSecretDetail = async (record: K8sSecret) => {
    const clusterId = validateClusterId(record);
    if (!clusterId) return;
    
    try {
      detailLoading.value = true;
      isDetailModalVisible.value = true;
      const params: GetSecretDetailsReq = {
        cluster_id: clusterId,
        namespace: record.namespace,
        name: record.name
      };
      const res = await getSecretDetailsApi(params);
      
      // 转换标签和注解格式：从对象转为数组
      const processedDetail = res ? {
        ...res,
        cluster_id: clusterId,
        labels: recordToKeyValueList(parseJsonField(res.labels, {})),
        annotations: recordToKeyValueList(parseJsonField(res.annotations, {})),
        data: parseJsonField(res.data, {}),
        string_data: parseJsonField(res.string_data, {}),
      } : { 
        ...record, 
        cluster_id: clusterId,
        labels: recordToKeyValueList(parseJsonField(record.labels, {})),
        annotations: recordToKeyValueList(parseJsonField(record.annotations, {})),
        data: parseJsonField(record.data, {}),
        string_data: parseJsonField(record.string_data, {}),
      };
      
      currentSecretDetail.value = processedDetail;
    } catch (err) {
      message.error('获取 Secret 详情失败');

      // 错误时也要处理格式转换
      try {
        const fallbackDetail = { 
          ...record, 
          cluster_id: clusterId,
          labels: recordToKeyValueList(parseJsonField(record.labels, {})),
          annotations: recordToKeyValueList(parseJsonField(record.annotations, {})),
          data: parseJsonField(record.data, {}),
          string_data: parseJsonField(record.string_data, {}),
        };
        currentSecretDetail.value = fallbackDetail;
      } catch (fallbackError) {
        // 最终的安全fallback
        currentSecretDetail.value = {
          ...record,
          cluster_id: clusterId,
          labels: [],
          annotations: [],
          data: {},
          string_data: {},
        };
      }
    } finally {
      detailLoading.value = false;
    }
  };

  const closeDetailModal = () => {
    isDetailModalVisible.value = false;
    currentSecretDetail.value = null;
  };

  // Base64 解码辅助函数
  const decodeBase64ToUtf8 = (base64Str: string): string => {
    try {
      // 使用 atob 解码 base64，然后转换为 UTF-8
      const binaryStr = atob(base64Str);
      const bytes = new Uint8Array(binaryStr.length);
      for (let i = 0; i < binaryStr.length; i++) {
        bytes[i] = binaryStr.charCodeAt(i);
      }
      // 使用 TextDecoder 正确处理 UTF-8 编码
      const decoder = new TextDecoder('utf-8');
      return decoder.decode(bytes);
    } catch (error) {
      return base64Str; // 如果解码失败，返回原始字符串
    }
  };

  // 处理 Secret YAML 中的 base64 编码数据
  const processSecretYaml = (yamlContent: string): string => {
    if (!yamlContent) return yamlContent;
    
    try {
      // 使用正则表达式匹配 data 字段下的 base64 编码值
      const processedYaml = yamlContent.replace(
        /^(\s*)([\w\-\.]+):\s*([A-Za-z0-9+/]+=*)$/gm,
        (match, indent, key, value) => {
          // 检查是否在 data 字段下且值看起来像 base64
          if (value && value.length > 0 && /^[A-Za-z0-9+/]+=*$/.test(value)) {
            // 检查前面的内容中是否有 data: 字段
            const beforeMatch = yamlContent.substring(0, yamlContent.indexOf(match));
            const dataFieldPattern = /\ndata:\s*\n/;
            const stringDataFieldPattern = /\nstringData:\s*\n/;
            
            if (dataFieldPattern.test(beforeMatch) && !stringDataFieldPattern.test(beforeMatch.substring(beforeMatch.lastIndexOf('\ndata:')))) {
              const decodedValue = decodeBase64ToUtf8(value);
              // 如果解码后的内容包含换行符，使用多行 YAML 格式
              if (decodedValue.includes('\n')) {
                const indentedContent = decodedValue
                  .split('\n')
                  .map((line, index) => index === 0 ? line : `${indent}  ${line}`)
                  .join('\n');
                return `${indent}${key}: |\n${indent}  ${indentedContent}`;
              } else {
                return `${indent}${key}: "${decodedValue.replace(/"/g, '\\"')}"`;
              }
            }
          }
          return match;
        }
      );
      
      return processedYaml;
    } catch (error) {
      return yamlContent; // 如果处理失败，返回原始内容
    }
  };

  // YAML 操作
  const showYamlModal = async (record: K8sSecret) => {
    const clusterId = validateClusterId(record);
    if (!clusterId) return;
    
    try {
      submitLoading.value = true;
      currentOperationSecret.value = { ...record, cluster_id: clusterId };
      const params: GetSecretYamlReq = {
        cluster_id: clusterId,
        namespace: record.namespace,
        name: record.name
      };
      const res = await getSecretYamlApi(params);
      
      let originalYaml = '';
      
      // 尝试不同的数据获取方式
      if (res?.data) {
        originalYaml = res.data;
      } else if (res?.yaml) {
        originalYaml = res.yaml;
      } else if (typeof res === 'string') {
        originalYaml = res;
      } else {
        originalYaml = '';
      }
      
      // 处理 YAML 中的 base64 编码数据
      const processedYaml = processSecretYaml(originalYaml);
      yamlFormModel.value.yaml = processedYaml;
      
      isYamlModalVisible.value = true;
    } catch (err) {
      message.error('获取 Secret YAML 失败');
    } finally {
      submitLoading.value = false;
    }
  };

  const closeYamlModal = () => {
    isYamlModalVisible.value = false;
    currentOperationSecret.value = null;
    yamlFormModel.value.yaml = '';
  };

  // Base64 编码辅助函数
  const encodeUtf8ToBase64 = (str: string): string => {
    try {
      // 使用 TextEncoder 将字符串转换为 UTF-8 字节
      const encoder = new TextEncoder();
      const bytes = encoder.encode(str);
      
      // 将字节数组转换为二进制字符串
      let binaryStr = '';
      for (let i = 0; i < bytes.length; i++) {
        binaryStr += String.fromCharCode(bytes[i] as number);
      }
      
      // 使用 btoa 进行 base64 编码
      return btoa(binaryStr);
    } catch (error) {
      return str; // 如果编码失败，返回原始字符串
    }
  };

  // 处理提交时的 YAML，将明文数据重新编码为 base64
  const encodeSecretYamlForSubmission = (yamlContent: string): string => {
    if (!yamlContent) return yamlContent;
    
    try {
      // 处理多行字符串（| 格式）
      let processedYaml = yamlContent.replace(
        /^(\s*)([\w\-\.]+):\s*\|\s*\n((?:\s{2,}.*\n?)*)/gm,
        (match, indent, key, content) => {
          // 检查是否在 data 字段下
          const beforeMatch = yamlContent.substring(0, yamlContent.indexOf(match));
          const dataFieldPattern = /\ndata:\s*\n/;
          const stringDataFieldPattern = /\nstringData:\s*\n/;
          
          if (dataFieldPattern.test(beforeMatch) && !stringDataFieldPattern.test(beforeMatch.substring(beforeMatch.lastIndexOf('\ndata:')))) {
            // 移除缩进并合并内容
            const cleanContent = content
              .split('\n')
              .map((line: string) => line.replace(new RegExp(`^${indent}  `), ''))
              .filter((line: string) => line.length > 0)
              .join('\n');
            
            const encodedValue = encodeUtf8ToBase64(cleanContent);
            return `${indent}${key}: ${encodedValue}`;
          }
          return match;
        }
      );
      
      // 处理带引号的字符串
      processedYaml = processedYaml.replace(
        /^(\s*)([\w\-\.]+):\s*"([^"]*(?:\\.[^"]*)*)"/gm,
        (match, indent, key, value) => {
          // 检查是否在 data 字段下
          const beforeMatch = processedYaml.substring(0, processedYaml.indexOf(match));
          const dataFieldPattern = /\ndata:\s*\n/;
          const stringDataFieldPattern = /\nstringData:\s*\n/;
          
          if (dataFieldPattern.test(beforeMatch) && !stringDataFieldPattern.test(beforeMatch.substring(beforeMatch.lastIndexOf('\ndata:')))) {
            // 处理转义字符
            const unescapedValue = value.replace(/\\"/g, '"');
            const encodedValue = encodeUtf8ToBase64(unescapedValue);
            return `${indent}${key}: ${encodedValue}`;
          }
          return match;
        }
      );
      
      return processedYaml;
    } catch (error) {
      return yamlContent; // 如果处理失败，返回原始内容
    }
  };

  const submitYamlForm = async () => {
    if (!yamlFormRef.value || !currentOperationSecret.value) return;
    
    try {
      await yamlFormRef.value.validate();
      submitLoading.value = true;
      
      // 处理 YAML 中的明文数据，重新编码为 base64
      const encodedYaml = encodeSecretYamlForSubmission(yamlFormModel.value.yaml);
      
      const params: UpdateSecretByYamlReq = {
        cluster_id: currentOperationSecret.value.cluster_id,
        namespace: currentOperationSecret.value.namespace,
        name: currentOperationSecret.value.name,
        yaml: encodedYaml,
      };
      
      await updateSecretByYamlApi(params);
      message.success('Secret YAML 更新成功');
      isYamlModalVisible.value = false;
      await fetchSecrets();
    } catch (err: unknown) {
      if (err && typeof err === 'object' && 'errorFields' in err) {
        message.warning('请检查 YAML 格式是否正确');
        return;
      }
      message.error('Secret YAML 更新失败');

    } finally {
      submitLoading.value = false;
    }
  };

  // 创建 Secret
  const openCreateModal = () => {
    createFormModel.value = {
      name: '',
      namespace: '',
      type: K8sSecretType.Opaque,
      data: {},
      string_data: {},
      labels: {},
      annotations: {},
      immutable: false,
    };
    isCreateModalVisible.value = true;
  };

  const closeCreateModal = () => {
    isCreateModalVisible.value = false;
  };

  // 通过 YAML 创建 Secret
  const openCreateYamlModal = () => {
    createYamlFormModel.value.yaml = '';
    isCreateYamlModalVisible.value = true;
  };

  const closeCreateYamlModal = () => {
    isCreateYamlModalVisible.value = false;
    createYamlFormModel.value.yaml = '';
  };

  const submitCreateForm = async () => {
    if (!formRef.value || !filterClusterId.value) return;
    
    try {
      await formRef.value.validate();
      submitLoading.value = true;
      
      const params: CreateSecretReq = {
        cluster_id: filterClusterId.value,
        namespace: createFormModel.value.namespace,
        name: createFormModel.value.name,
        type: createFormModel.value.type,
        data: Object.keys(createFormModel.value.data).length > 0 ? createFormModel.value.data : undefined,
        string_data: Object.keys(createFormModel.value.string_data).length > 0 ? createFormModel.value.string_data : undefined,
        labels: Object.keys(createFormModel.value.labels).length > 0 ? createFormModel.value.labels : undefined,
        annotations: Object.keys(createFormModel.value.annotations).length > 0 ? createFormModel.value.annotations : undefined,
        immutable: createFormModel.value.immutable,
      };
      
      await createSecretApi(params);
      message.success('Secret 创建成功');
      isCreateModalVisible.value = false;
      await fetchSecrets();
    } catch (err: unknown) {
      if (err && typeof err === 'object' && 'errorFields' in err) {
        message.warning('请检查表单填写是否正确');
        return;
      }
      message.error('Secret 创建失败');

    } finally {
      submitLoading.value = false;
    }
  };

  const submitCreateYamlForm = async () => {
    if (!createYamlFormRef.value || !filterClusterId.value) return;
    
    try {
      await createYamlFormRef.value.validate();
      submitLoading.value = true;
      
      const params: CreateSecretByYamlReq = {
        cluster_id: filterClusterId.value,
        yaml: createYamlFormModel.value.yaml,
      };
      
      await createSecretByYamlApi(params);
      message.success('Secret YAML 创建成功');
      isCreateYamlModalVisible.value = false;
      await fetchSecrets();
    } catch (err: unknown) {
      if (err && typeof err === 'object' && 'errorFields' in err) {
        message.warning('请检查 YAML 格式是否正确');
        return;
      }
      message.error('Secret YAML 创建失败');

    } finally {
      submitLoading.value = false;
    }
  };

  // 编辑 Secret
  const openEditModal = (record: K8sSecret) => {
    currentOperationSecret.value = record;
    editFormModel.value = {
      name: record.name,
      namespace: record.namespace,
      data: parseJsonField(record.data, {}),
      string_data: parseJsonField(record.string_data, {}),
      labels: parseJsonField(record.labels, {}),
      annotations: parseJsonField(record.annotations, {}),
    };
    isEditModalVisible.value = true;
  };

  const closeEditModal = () => {
    isEditModalVisible.value = false;
    currentOperationSecret.value = null;
  };

  const submitEditForm = async () => {
    if (!formRef.value || !currentOperationSecret.value) return;
    
    try {
      await formRef.value.validate();
      submitLoading.value = true;
      
      const params: UpdateSecretReq = {
        cluster_id: currentOperationSecret.value.cluster_id,
        namespace: currentOperationSecret.value.namespace,
        name: currentOperationSecret.value.name,
        data: Object.keys(editFormModel.value.data).length > 0 ? editFormModel.value.data : undefined,
        string_data: Object.keys(editFormModel.value.string_data).length > 0 ? editFormModel.value.string_data : undefined,
        labels: Object.keys(editFormModel.value.labels).length > 0 ? editFormModel.value.labels : undefined,
        annotations: Object.keys(editFormModel.value.annotations).length > 0 ? editFormModel.value.annotations : undefined,
      };
      
      await updateSecretApi(params);
      message.success('Secret 更新成功');
      isEditModalVisible.value = false;
      await fetchSecrets();
    } catch (err: unknown) {
      if (err && typeof err === 'object' && 'errorFields' in err) {
        message.warning('请检查表单填写是否正确');
        return;
      }
      message.error('Secret 更新失败');

    } finally {
      submitLoading.value = false;
    }
  };

  // 删除 Secret
  const deleteSecret = (record: K8sSecret) => {
    const clusterId = validateClusterId(record);
    if (!clusterId) return;
    
    Modal.confirm({
      title: '删除 Secret',
      content: `确定要删除 Secret "${record.name}" 吗？此操作不可逆！`,
      okText: '确认删除',
      okType: 'danger',
      cancelText: '取消',
      centered: true,
      onOk: async () => {
        try {
          const params: DeleteSecretReq = {
            cluster_id: clusterId,
            namespace: record.namespace,
            name: record.name,
          };
          await deleteSecretApi(params);
          message.success('Secret 删除成功');
          await fetchSecrets();
        } catch (err) {
          message.error('Secret 删除失败');

        }
      },
    });
  };

  // 标签过滤管理
  const addFilterLabel = (key: string, value: string) => {
    if (key && key.trim()) {
      filterLabels.value[key.trim()] = value;
      currentPage.value = 1;
      fetchSecrets();
    }
  };

  const removeFilterLabel = (key: string) => {
    delete filterLabels.value[key];
    currentPage.value = 1;
    fetchSecrets();
  };

  const clearFilterLabels = () => {
    filterLabels.value = {};
    currentPage.value = 1;
    fetchSecrets();
  };

  // 批量操作
  const batchOperation = (operation: string) => {
    if (!selectedRows.value.length) return;
    
    Modal.confirm({
      title: `批量${operation}`,
      content: `确定要对选中的 ${selectedRows.value.length} 个 Secret 执行${operation}操作吗？`,
      okText: '确认执行',
      okType: operation === '删除' ? 'danger' : 'primary',
      cancelText: '取消',
      centered: true,
      onOk: async () => {
        try {
          if (operation === '删除') {
            for (const secret of selectedRows.value) {
              const clusterId = secret.cluster_id || filterClusterId.value;
              if (!clusterId) {
                message.error(`Secret "${secret.name}" 缺少有效的集群ID，跳过操作`);
                continue;
              }
              
              const params: DeleteSecretReq = {
                cluster_id: clusterId,
                namespace: secret.namespace,
                name: secret.name
              };
              await deleteSecretApi(params);
            }
          }
          
          message.success(`批量${operation}操作已完成`);
          selectedRowKeys.value = [];
          selectedRows.value = [];
          await fetchSecrets();
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
    await fetchSecrets();
  };

  // 表单字段操作 - 数据字段
  const removeDataField = (key: string) => {
    delete createFormModel.value.data[key];
  };

  const removeEditDataField = (key: string) => {
    delete editFormModel.value.data[key];
  };

  // 表单字段操作 - 字符串数据字段
  const removeStringDataField = (key: string) => {
    delete createFormModel.value.string_data[key];
  };

  const removeEditStringDataField = (key: string) => {
    delete editFormModel.value.string_data[key];
  };

  // 表单字段操作 - 标签字段
  const removeLabelField = (key: string) => {
    delete createFormModel.value.labels[key];
  };

  const removeEditLabelField = (key: string) => {
    delete editFormModel.value.labels[key];
  };

  // 表单字段操作 - 注解字段
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
          createYamlFormModel.value.yaml = SECRET_YAML_TEMPLATE;
          message.success('模板已插入');
        },
      });
    } else {
      createYamlFormModel.value.yaml = SECRET_YAML_TEMPLATE;
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

      // 基本的 Secret 字段检查
      const secret = parsed as any;
      const issues: string[] = [];

      if (!secret.apiVersion) {
        issues.push('缺少 apiVersion 字段');
      }
      if (!secret.kind) {
        issues.push('缺少 kind 字段');
      } else if (secret.kind !== 'Secret') {
        issues.push(`kind 应为 "Secret"，当前为 "${secret.kind}"`);
      }
      if (!secret.metadata?.name) {
        issues.push('缺少 metadata.name 字段');
      }
      if (!secret.type) {
        issues.push('建议设置 type 字段');
      }
      if (!secret.data && !secret.stringData) {
        issues.push('建议至少设置 data 或 stringData 字段之一');
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

      // 基本的 Secret 字段检查
      const secret = parsed as any;
      const issues: string[] = [];

      if (!secret.apiVersion) {
        issues.push('缺少 apiVersion 字段');
      }
      if (!secret.kind) {
        issues.push('缺少 kind 字段');
      } else if (secret.kind !== 'Secret') {
        issues.push(`kind 应为 "Secret"，当前为 "${secret.kind}"`);
      }
      if (!secret.metadata?.name) {
        issues.push('缺少 metadata.name 字段');
      }
      if (!secret.type) {
        issues.push('建议设置 type 字段');
      }
      if (!secret.data && !secret.stringData) {
        issues.push('建议至少设置 data 或 stringData 字段之一');
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
    secrets,
    clusters,
    namespaces,
    loading,
    clustersLoading,
    namespacesLoading,
    searchText,
    filterClusterId,
    filterNamespace,
    filterType,
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
    currentOperationSecret,
    currentSecretDetail,
    
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
    filteredSecrets,
    rowSelection,
    
    // helpers
    validateClusterId,
    getEnvText,
    getSecretTypeText,
    recordToKeyValueList,
    keyValueListToRecord,
    parseJsonField,
    K8sSecretType,
    
    // operations
    fetchClusters,
    fetchNamespaces,
    fetchSecrets,
    clearSecrets,
    clearNamespaces,
    loadMoreClusters,
    loadMoreNamespaces,
    
    // detail operations
    showSecretDetail,
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
    
    // secret operations
    deleteSecret,
    
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
    removeStringDataField,
    removeEditStringDataField,
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
