import { ref, computed, h } from 'vue';
import { message, Modal } from 'ant-design-vue';
import type { FormInstance, Rule } from 'ant-design-vue/es/form';
import yaml from 'js-yaml';
import {
  type K8sPVC,
  type PVCSpec,
  type GetPVCListReq,
  type GetPVCDetailsReq,
  type GetPVCYamlReq,
  type CreatePVCReq,
  type CreatePVCByYamlReq,
  type UpdatePVCReq,
  type UpdatePVCByYamlReq,
  type DeletePVCReq,
  type ExpandPVCReq,
  type GetPVCPodsReq,
  K8sPVCStatus,
  getK8sPVCList,
  getK8sPVCDetails,
  getK8sPVCYaml,
  createK8sPVC,
  createK8sPVCByYaml,
  updateK8sPVC,
  updateK8sPVCByYaml,
  deleteK8sPVC,
  expandK8sPVC,
  getK8sPVCPods,
} from '#/api/core/k8s/k8s_pvc';
import {
  type K8sCluster,
  type ListClustersReq,
  getClustersListApi,
  Env,
} from '#/api/core/k8s/k8s_cluster';
import {
  type K8sNamespace,
  type K8sNamespaceListReq,
  getNamespacesListApi,
} from '#/api/core/k8s/k8s_namespace';
import {
  type K8sPV,
  type GetPVListReq,
  K8sPVStatus,
  getK8sPVList,
} from '#/api/core/k8s/k8s_pv';

// PVC YAML 模板
const PVC_YAML_TEMPLATE = `apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: my-pvc
spec:
  storageClassName: manual
  accessModes:
    - ReadWriteOnce
  resources:
    requests:
      storage: 5Gi`;

export function usePVCPage() {
  const pvcs = ref<K8sPVC[]>([]);
  const clusters = ref<K8sCluster[]>([]);
  const namespaces = ref<K8sNamespace[]>([]);
  const availablePVs = ref<K8sPV[]>([]);
  const loading = ref(false);
  const clustersLoading = ref(false);
  const namespacesLoading = ref(false);
  const pvsLoading = ref(false);
  const searchText = ref('');
  const filterClusterId = ref<number | undefined>(undefined);
  const filterNamespace = ref<string | undefined>(undefined);
  const filterStatus = ref<K8sPVCStatus | undefined>(undefined);
  const filterAccessMode = ref<string | undefined>(undefined);
  const selectedRowKeys = ref<string[]>([]);
  const selectedRows = ref<K8sPVC[]>([]);
  const currentPage = ref(1);
  const pageSize = ref(10);
  const total = ref(0);
  const clustersTotal = ref(0);
  const clustersPage = ref(1);
  const clustersSize = ref(50);
  const namespacesTotal = ref(0);
  const namespacesPage = ref(1);
  const namespacesSize = ref(50);
  const pvsTotal = ref(0);
  const pvsPage = ref(1);
  const pvsSize = ref(50);

  const formRef = ref<FormInstance>();
  const yamlFormRef = ref<FormInstance>();
  const createYamlFormRef = ref<FormInstance>();
  const expandFormRef = ref<FormInstance>();

  const isCreateModalVisible = ref(false);
  const isCreateYamlModalVisible = ref(false);
  const isEditModalVisible = ref(false);
  const isDetailModalVisible = ref(false);
  const isYamlModalVisible = ref(false);
  const isExpandModalVisible = ref(false);
  const isPodsModalVisible = ref(false);
  const submitLoading = ref(false);
  const detailLoading = ref(false);
  const podsLoading = ref(false);

  const currentOperationPVC = ref<K8sPVC | null>(null);
  const currentPVCDetail = ref<K8sPVC | null>(null);
  const currentYamlContent = ref('');
  const currentPVCPods = ref<any[]>([]);
  const createFormModel = ref<{
    name: string;
    namespace: string;
    labels: Record<string, string>;
    annotations: Record<string, string>;
    spec: PVCSpec;
  }>({
    name: '',
    namespace: '',
    labels: {},
    annotations: {},
    spec: {
      request_storage: '',
      access_modes: ['ReadWriteOnce'],
      storage_class: '',
      volume_mode: 'Filesystem',
      volume_name: '',
      selector: {},
    },
  });

  const editFormModel = ref<{
    name: string;
    namespace: string;
    labels: Record<string, string>;
    annotations: Record<string, string>;
    spec: PVCSpec;
  }>({
    name: '',
    namespace: '',
    labels: {},
    annotations: {},
    spec: {
      request_storage: '',
      access_modes: [],
      storage_class: '',
      volume_mode: '',
      volume_name: '',
      selector: {},
    },
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

  const expandFormModel = ref<{
    new_capacity: string;
  }>({
    new_capacity: ''
  });

  const createFormRules: Record<string, any> = {
    name: [
      { required: true, message: '请输入 PVC 名称', trigger: 'blur' },
      { pattern: /^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/, message: 'PVC 名称只能包含小写字母、数字和连字符，且不能以连字符开头或结尾', trigger: 'blur' },
      { max: 253, message: 'PVC 名称长度不能超过253个字符', trigger: 'blur' }
    ],
    namespace: [
      { required: true, message: '请选择命名空间', trigger: 'change' }
    ],
    spec: {
      request_storage: [
        { required: true, message: '请输入请求存储容量', trigger: 'blur' },
        { pattern: /^[0-9]+[KMGTPE]i?$/, message: '请输入有效的存储容量，如: 1Gi, 100Mi', trigger: 'blur' }
      ],
      access_modes: [
        { required: true, message: '请选择访问模式', trigger: 'change', type: 'array' }
      ]
    }
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

  const expandFormRules: Record<string, Rule[]> = {
    new_capacity: [
      { required: true, message: '请输入新容量', trigger: 'blur' },
      { pattern: /^[0-9]+[KMGTPE]i?$/, message: '请输入有效的存储容量，如: 10Gi, 200Mi', trigger: 'blur' }
    ]
  };

  const filteredPVCs = computed(() => {
    return pvcs.value;
  });

  const rowSelection = computed(() => ({
    selectedRowKeys: selectedRowKeys.value,
    onChange: (keys: string[], rows: K8sPVC[]) => {
      selectedRowKeys.value = keys;
      selectedRows.value = rows;
    },
  }));

  const pvOptions = computed(() => {
    const options = availablePVs.value.map((pv: K8sPV) => ({
      value: pv.name,
      label: pv.name,
      capacity: pv.capacity,
      accessModes: pv.access_modes,
    }));

    if (availablePVs.value.length > 0 && availablePVs.value.length < pvsTotal.value) {
      options.push({
        value: '__load_more_pvs__',
        label: '加载更多',
        capacity: '',
        accessModes: [],
        disabled: true,
      } as any);
    }

    return options;
  });

  const validateClusterId = (record: K8sPVC): number | null => {
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

  const getPVCStatusText = (status: K8sPVCStatus): string => {
    const statusMap: Record<K8sPVCStatus, string> = {
      [K8sPVCStatus.Pending]: '等待中',
      [K8sPVCStatus.Bound]: '已绑定',
      [K8sPVCStatus.Lost]: '丢失',
      [K8sPVCStatus.Terminating]: '终止中',
      [K8sPVCStatus.Unknown]: '未知',
    };
    return statusMap[status] || '未知';
  };

  const getPVCStatusColor = (status: K8sPVCStatus): string => {
    const colorMap: Record<K8sPVCStatus, string> = {
      [K8sPVCStatus.Pending]: 'warning',
      [K8sPVCStatus.Bound]: 'success',
      [K8sPVCStatus.Lost]: 'error',
      [K8sPVCStatus.Terminating]: 'processing',
      [K8sPVCStatus.Unknown]: 'default',
    };
    return colorMap[status] || 'default';
  };

  const getAccessModeText = (mode: string): string => {
    const modeMap: Record<string, string> = {
      'ReadWriteOnce': 'RWO',
      'ReadOnlyMany': 'ROX',
      'ReadWriteMany': 'RWX',
      'ReadWriteOncePod': 'RWOP',
    };
    return modeMap[mode] || mode;
  };

  const clearPVCs = () => {
    pvcs.value = [];
    selectedRowKeys.value = [];
    selectedRows.value = [];
  };

  const clearNamespaces = () => {
    resetNamespaces();
    filterNamespace.value = undefined;
  };

  const resetClusters = () => {
    clustersPage.value = 1;
    clusters.value = [];
  };

  const resetNamespaces = () => {
    namespacesPage.value = 1;
    namespaces.value = [];
    namespacesTotal.value = 0;
  };

  const resetPVs = () => {
    pvsPage.value = 1;
    availablePVs.value = [];
    pvsTotal.value = 0;
  };

  const fetchClusters = async (reset: boolean = false) => {
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
          await fetchPVCs();
        }
      }
    } catch (error: any) {

      message.error(error?.message || '获取集群列表失败');
    } finally {
      clustersLoading.value = false;
    }
  };

  const fetchNamespaces = async (reset: boolean = false) => {
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
    } catch (error: any) {

      message.error(error?.message || '获取命名空间列表失败');
    } finally {
      namespacesLoading.value = false;
    }
  };

  const fetchAvailablePVs = async (reset: boolean = false) => {
    if (!filterClusterId.value) return;
    
    if (reset) {
      resetPVs();
    }
    
    try {
      pvsLoading.value = true;

      const params: GetPVListReq = {
        cluster_id: filterClusterId.value,
        page: pvsPage.value,
        size: pvsSize.value,
        status: String(K8sPVStatus.Available),
      };

      const res = await getK8sPVList(params);
      
      if (pvsPage.value === 1) {
        availablePVs.value = res?.items || [];
      } else {
        availablePVs.value = [...availablePVs.value, ...(res?.items || [])];
      }
      pvsTotal.value = res?.total || 0;
    } catch (error: any) {
      message.error(error?.message || '获取可用PV列表失败');
      if (pvsPage.value === 1) {
        availablePVs.value = [];
      }
    } finally {
      pvsLoading.value = false;
    }
  };

  const loadMorePVs = async () => {
    if (pvsPage.value * pvsSize.value >= pvsTotal.value) {
      return;
    }
    pvsPage.value += 1;
    await fetchAvailablePVs();
  };

  const fetchPVCs = async () => {
    if (!filterClusterId.value || filterClusterId.value === 0) {
      message.warning('请先选择有效的集群');
      pvcs.value = [];
      total.value = 0;
      return;
    }

    try {
      loading.value = true;
      const params: GetPVCListReq = {
        cluster_id: filterClusterId.value,
        namespace: filterNamespace.value || undefined,
        page: currentPage.value,
        size: pageSize.value,
        search: searchText.value || undefined,
        status: filterStatus.value ? String(filterStatus.value) : undefined,
        access_mode: filterAccessMode.value || undefined,
      };

      const res = await getK8sPVCList(params);
      
      const pvcsWithClusterId = (res?.items || []).map((pvc: K8sPVC) => ({
        ...pvc,
        cluster_id: pvc.cluster_id || filterClusterId.value || 0
      }));
      pvcs.value = pvcsWithClusterId;
      total.value = res?.total || 0;
    } catch (error: any) {

      message.error(error?.message || '获取PVC列表失败');
      pvcs.value = [];
      total.value = 0;
    } finally {
      loading.value = false;
    }
  };

  const loadMoreClusters = async () => {
    if (clustersPage.value * clustersSize.value >= clustersTotal.value) {
      return;
    }
    clustersPage.value += 1;
    await fetchClusters();
  };

  const fetchPVCDetails = async (record: K8sPVC) => {
    const clusterId = validateClusterId(record);
    if (!clusterId) return;

    try {
      detailLoading.value = true;
      const params: GetPVCDetailsReq = {
        cluster_id: clusterId,
        namespace: record.namespace,
        name: record.name,
      };

      const response = await getK8sPVCDetails(params);
      
      if (response) {
        currentPVCDetail.value = response;
      }
    } catch (error: any) {

      message.error(error?.message || '获取PVC详情失败');
    } finally {
      detailLoading.value = false;
    }
  };

  const fetchPVCYaml = async (record: K8sPVC) => {
    const clusterId = validateClusterId(record);
    if (!clusterId) return;

    try {
      const params: GetPVCYamlReq = {
        cluster_id: clusterId,
        namespace: record.namespace,
        name: record.name,
      };

      const response = await getK8sPVCYaml(params);
      
      if (response && response.yaml) {
        currentYamlContent.value = response.yaml;
      }
    } catch (error: any) {

      message.error(error?.message || '获取PVC YAML失败');
    }
  };

  const fetchPVCPods = async (record: K8sPVC) => {
    const clusterId = validateClusterId(record);
    if (!clusterId) return;

    try {
      podsLoading.value = true;
      const params: GetPVCPodsReq = {
        cluster_id: clusterId,
        namespace: record.namespace,
        name: record.name,
      };

      const res = await getK8sPVCPods(params);
      
      currentPVCPods.value = res?.items || [];
    } catch (error: any) {

      message.error(error?.message || '获取使用PVC的Pod列表失败');
      currentPVCPods.value = [];
    } finally {
      podsLoading.value = false;
    }
  };

  const createPVC = async () => {
    if (!filterClusterId.value) {
      message.error('请先选择集群');
      return;
    }

    try {
      await formRef.value?.validate();
      submitLoading.value = true;

      const params: CreatePVCReq = {
        cluster_id: filterClusterId.value,
        namespace: createFormModel.value.namespace,
        name: createFormModel.value.name,
        labels: Object.keys(createFormModel.value.labels).length > 0 ? createFormModel.value.labels : undefined,
        annotations: Object.keys(createFormModel.value.annotations).length > 0 ? createFormModel.value.annotations : undefined,
        spec: createFormModel.value.spec,
      };

      await createK8sPVC(params);
      message.success('创建PVC成功');
      isCreateModalVisible.value = false;
      resetCreateForm();
      await fetchPVCs();
    } catch (error: any) {

      message.error(error?.message || '创建PVC失败');
    } finally {
      submitLoading.value = false;
    }
  };

  const createPVCByYaml = async () => {
    if (!filterClusterId.value) {
      message.error('请先选择集群');
      return;
    }

    try {
      await createYamlFormRef.value?.validate();
      submitLoading.value = true;

      const params: CreatePVCByYamlReq = {
        cluster_id: filterClusterId.value,
        yaml: createYamlFormModel.value.yaml,
      };

      await createK8sPVCByYaml(params);
      message.success('通过YAML创建PVC成功');
      isCreateYamlModalVisible.value = false;
      resetCreateYamlForm();
      await fetchPVCs();
    } catch (error: any) {

      message.error(error?.message || '通过YAML创建PVC失败');
    } finally {
      submitLoading.value = false;
    }
  };

  const updatePVC = async () => {
    if (!currentOperationPVC.value) return;

    const clusterId = validateClusterId(currentOperationPVC.value);
    if (!clusterId) return;

    try {
      await formRef.value?.validate();
      submitLoading.value = true;

      const params: UpdatePVCReq = {
        cluster_id: clusterId,
        namespace: currentOperationPVC.value.namespace,
        name: currentOperationPVC.value.name,
        labels: Object.keys(editFormModel.value.labels).length > 0 ? editFormModel.value.labels : undefined,
        annotations: Object.keys(editFormModel.value.annotations).length > 0 ? editFormModel.value.annotations : undefined,
        spec: editFormModel.value.spec,
      };

      await updateK8sPVC(params);
      message.success('更新PVC成功');
      isEditModalVisible.value = false;
      resetEditForm();
      await fetchPVCs();
    } catch (error: any) {

      message.error(error?.message || '更新PVC失败');
    } finally {
      submitLoading.value = false;
    }
  };

  const updatePVCByYaml = async () => {
    if (!currentOperationPVC.value) return;

    const clusterId = validateClusterId(currentOperationPVC.value);
    if (!clusterId) return;

    try {
      await yamlFormRef.value?.validate();
      submitLoading.value = true;

      const params: UpdatePVCByYamlReq = {
        cluster_id: clusterId,
        namespace: currentOperationPVC.value.namespace,
        name: currentOperationPVC.value.name,
        yaml: yamlFormModel.value.yaml,
      };

      await updateK8sPVCByYaml(params);
      message.success('通过YAML更新PVC成功');
      isYamlModalVisible.value = false;
      resetYamlForm();
      await fetchPVCs();
    } catch (error: any) {

      message.error(error?.message || '通过YAML更新PVC失败');
    } finally {
      submitLoading.value = false;
    }
  };

  const deletePVC = async (record: K8sPVC) => {
    const clusterId = validateClusterId(record);
    if (!clusterId) return;

    Modal.confirm({
      title: `确认删除PVC "${record.name}"?`,
      content: '此操作不可恢复，请确认！',
      okText: '确认删除',
      cancelText: '取消',
      okType: 'danger',
      onOk: async () => {
        try {
          const params: DeletePVCReq = {
            cluster_id: clusterId,
            namespace: record.namespace,
            name: record.name,
          };

          await deleteK8sPVC(params);
          message.success(`删除PVC "${record.name}" 成功`);
          await fetchPVCs();
        } catch (error: any) {

          message.error(error?.message || '删除PVC失败');
        }
      },
    });
  };

  const expandPVC = async () => {
    if (!currentOperationPVC.value) return;

    const clusterId = validateClusterId(currentOperationPVC.value);
    if (!clusterId) return;

    try {
      await expandFormRef.value?.validate();
      submitLoading.value = true;

      const params: ExpandPVCReq = {
        cluster_id: clusterId,
        namespace: currentOperationPVC.value.namespace,
        name: currentOperationPVC.value.name,
        new_capacity: expandFormModel.value.new_capacity,
      };

      await expandK8sPVC(params);
      message.success(`扩容PVC "${currentOperationPVC.value.name}" 成功`);
      isExpandModalVisible.value = false;
      resetExpandForm();
      await fetchPVCs();
    } catch (error: any) {

      message.error(error?.message || '扩容PVC失败');
    } finally {
      submitLoading.value = false;
    }
  };

  const deleteBatchPVCs = async () => {
    if (selectedRows.value.length === 0) {
      message.warning('请先选择要删除的PVC');
      return;
    }

    Modal.confirm({
      title: `确认删除选中的 ${selectedRows.value.length} 个PVC?`,
      content: '此操作不可恢复，请确认！',
      okText: '确认删除',
      cancelText: '取消',
      okType: 'danger',
      onOk: async () => {
        try {
          const promises = selectedRows.value.map(async (record) => {
            const clusterId = validateClusterId(record);
            if (!clusterId) return Promise.resolve();

            const params: DeletePVCReq = {
              cluster_id: clusterId,
              namespace: record.namespace,
              name: record.name,
            };

            return deleteK8sPVC(params);
          });

          await Promise.all(promises);
          message.success(`成功删除 ${selectedRows.value.length} 个PVC`);
          selectedRowKeys.value = [];
          selectedRows.value = [];
          await fetchPVCs();
        } catch (error: any) {

          message.error(error?.message || '批量删除PVC失败');
        }
      },
    });
  };

  const openCreateModal = async () => {
    if (!filterClusterId.value) {
      message.warning('请先选择集群');
      return;
    }
    resetCreateForm();
    if (filterNamespace.value) {
      createFormModel.value.namespace = filterNamespace.value;
    }
    await fetchAvailablePVs(true);
    isCreateModalVisible.value = true;
  };

  const openCreateYamlModal = () => {
    if (!filterClusterId.value) {
      message.warning('请先选择集群');
      return;
    }
    resetCreateYamlForm();
    isCreateYamlModalVisible.value = true;
  };

  const openEditModal = async (record: K8sPVC) => {
    currentOperationPVC.value = record;
    resetEditForm();
    editFormModel.value = {
      name: record.name,
      namespace: record.namespace,
      labels: record.labels || {},
      annotations: record.annotations || {},
      spec: {
        request_storage: record.request_storage,
        access_modes: record.access_modes || [],
        storage_class: record.storage_class,
        volume_mode: record.volume_mode,
        volume_name: record.volume_name,
        selector: record.selector || {},
      },
    };
    isEditModalVisible.value = true;
  };

  const openDetailModal = async (record: K8sPVC) => {
    currentOperationPVC.value = record;
    isDetailModalVisible.value = true;
    await fetchPVCDetails(record);
  };

  const openYamlModal = async (record: K8sPVC) => {
    currentOperationPVC.value = record;
    resetYamlForm();
    isYamlModalVisible.value = true;
    await fetchPVCYaml(record);
    yamlFormModel.value.yaml = currentYamlContent.value;
  };

  const openExpandModal = (record: K8sPVC) => {
    currentOperationPVC.value = record;
    resetExpandForm();
    isExpandModalVisible.value = true;
  };

  const openPodsModal = async (record: K8sPVC) => {
    currentOperationPVC.value = record;
    isPodsModalVisible.value = true;
    await fetchPVCPods(record);
  };

  const resetCreateForm = () => {
    createFormModel.value = {
      name: '',
      namespace: '',
      labels: {},
      annotations: {},
      spec: {
        request_storage: '',
        access_modes: ['ReadWriteOnce'],
        storage_class: '',
        volume_mode: 'Filesystem',
        volume_name: '',
        selector: {},
      },
    };
    formRef.value?.resetFields();
  };

  const resetEditForm = () => {
    editFormModel.value = {
      name: '',
      namespace: '',
      labels: {},
      annotations: {},
      spec: {
        request_storage: '',
        access_modes: [],
        storage_class: '',
        volume_mode: '',
        volume_name: '',
        selector: {},
      },
    };
    formRef.value?.resetFields();
  };

  const resetYamlForm = () => {
    yamlFormModel.value = {
      yaml: ''
    };
    yamlFormRef.value?.resetFields();
  };

  const resetCreateYamlForm = () => {
    createYamlFormModel.value = {
      yaml: ''
    };
    createYamlFormRef.value?.resetFields();
  };

  const resetExpandForm = () => {
    expandFormModel.value = {
      new_capacity: ''
    };
    expandFormRef.value?.resetFields();
  };

  const handleClusterChange = (value: number | undefined) => {
    filterClusterId.value = value;
    filterNamespace.value = undefined;
    clearPVCs();
    clearNamespaces();
    total.value = 0;
    currentPage.value = 1;
    if (value) {
      fetchNamespaces(true);
      fetchPVCs();
    }
  };

  const handleFilterChange = () => {
    currentPage.value = 1;
    fetchPVCs();
  };

  const handleSearch = (value: string) => {
    searchText.value = value;
    currentPage.value = 1;
    fetchPVCs();
  };

  const handlePageChange = (page: number, size: number) => {
    currentPage.value = page;
    pageSize.value = size;
    fetchPVCs();
  };

  const handleClusterDropdownScroll = (e: Event) => {
    const target = e.target as HTMLElement;
    if (target.scrollTop + target.offsetHeight === target.scrollHeight) {
      if (clusters.value.length < clustersTotal.value && !clustersLoading.value) {
        clustersPage.value += 1;
        fetchClusters(false);
      }
    }
  };

  const loadMoreNamespaces = async () => {
    if (namespacesPage.value * namespacesSize.value >= namespacesTotal.value) {
      return;
    }
    namespacesPage.value += 1;
    await fetchNamespaces();
  };

  const newLabelKey = ref('');
  const newAnnotationKey = ref('');
  
  const addLabelItem = (type: 'labels' | 'annotations') => {
    const key = type === 'labels' ? newLabelKey : newAnnotationKey;
    if (key.value && key.value.trim()) {
      if (type === 'labels') {
        if (createFormModel.value.labels[key.value.trim()]) {
          message.warning('该标签键已存在');
          return;
        }
        createFormModel.value.labels[key.value.trim()] = '';
      } else {
        if (createFormModel.value.annotations[key.value.trim()]) {
          message.warning('该注解键已存在');
          return;
        }
        createFormModel.value.annotations[key.value.trim()] = '';
      }
      key.value = '';
    } else {
      message.warning(type === 'labels' ? '请输入标签键' : '请输入注解键');
    }
  };

  const removeLabelItem = (key: string, type: 'labels' | 'annotations') => {
    if (type === 'labels') {
      delete createFormModel.value.labels[key];
    } else {
      delete createFormModel.value.annotations[key];
    }
  };

  const newEditLabelKey = ref('');
  const newEditAnnotationKey = ref('');

  const addEditLabelItem = (type: 'labels' | 'annotations') => {
    const key = type === 'labels' ? newEditLabelKey : newEditAnnotationKey;
    if (key.value && key.value.trim()) {
      if (type === 'labels') {
        if (editFormModel.value.labels[key.value.trim()]) {
          message.warning('该标签键已存在');
          return;
        }
        editFormModel.value.labels[key.value.trim()] = '';
      } else {
        if (editFormModel.value.annotations[key.value.trim()]) {
          message.warning('该注解键已存在');
          return;
        }
        editFormModel.value.annotations[key.value.trim()] = '';
      }
      key.value = '';
    } else {
      message.warning(type === 'labels' ? '请输入标签键' : '请输入注解键');
    }
  };

  const removeEditLabelItem = (key: string, type: 'labels' | 'annotations') => {
    if (type === 'labels') {
      delete editFormModel.value.labels[key];
    } else {
      delete editFormModel.value.annotations[key];
    }
  };

  const newSelectorKey = ref('');
  const newSelectorValue = ref('');
  
  const addSelectorItem = () => {
    if (newSelectorKey.value && newSelectorKey.value.trim()) {
      if (createFormModel.value.spec.selector[newSelectorKey.value.trim()]) {
        message.warning('该选择器键已存在');
        return;
      }
      createFormModel.value.spec.selector[newSelectorKey.value.trim()] = newSelectorValue.value || '';
      newSelectorKey.value = '';
      newSelectorValue.value = '';
    } else {
      message.warning('请输入选择器键');
    }
  };

  const removeSelectorItem = (key: string) => {
    delete createFormModel.value.spec.selector[key];
  };

  const insertYamlTemplate = () => {
    if (createYamlFormModel.value.yaml && createYamlFormModel.value.yaml.trim()) {
      Modal.confirm({
        title: '确认操作',
        content: '当前已有内容，插入模板将覆盖现有内容，是否继续？',
        okText: '确认',
        cancelText: '取消',
        centered: true,
        onOk: () => {
          createYamlFormModel.value.yaml = PVC_YAML_TEMPLATE;
          message.success('模板已插入');
        },
      });
    } else {
      createYamlFormModel.value.yaml = PVC_YAML_TEMPLATE;
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
      const parsed = yaml.load(yamlContent);
      const formatted = yaml.dump(parsed, {
        indent: 2,
        lineWidth: -1,
        noRefs: true,
        sortKeys: false,
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
      const parsed = yaml.load(yamlContent);
      
      if (!parsed || typeof parsed !== 'object') {
        message.warning('YAML 内容无效：应为对象格式');
        return;
      }

      const pvc = parsed as any;
      const issues: string[] = [];

      if (!pvc.apiVersion) {
        issues.push('缺少 apiVersion 字段');
      }
      if (!pvc.kind) {
        issues.push('缺少 kind 字段');
      } else if (pvc.kind !== 'PersistentVolumeClaim') {
        issues.push(`kind 应为 "PersistentVolumeClaim"，当前为 "${pvc.kind}"`);
      }
      if (!pvc.metadata?.name) {
        issues.push('缺少 metadata.name 字段');
      }
      if (!pvc.spec) {
        issues.push('缺少 spec 字段');
      } else {
        if (!pvc.spec.resources?.requests?.storage) {
          issues.push('缺少 spec.resources.requests.storage 字段');
        }
        if (!pvc.spec.accessModes || pvc.spec.accessModes.length === 0) {
          issues.push('缺少 spec.accessModes 字段');
        }
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

      const pvc = parsed as any;
      const issues: string[] = [];

      if (!pvc.apiVersion) {
        issues.push('缺少 apiVersion 字段');
      }
      if (!pvc.kind) {
        issues.push('缺少 kind 字段');
      } else if (pvc.kind !== 'PersistentVolumeClaim') {
        issues.push(`kind 应为 "PersistentVolumeClaim"，当前为 "${pvc.kind}"`);
      }
      if (!pvc.metadata?.name) {
        issues.push('缺少 metadata.name 字段');
      }
      if (!pvc.spec) {
        issues.push('缺少 spec 字段');
      } else {
        if (!pvc.spec.resources?.requests?.storage) {
          issues.push('缺少 spec.resources.requests.storage 字段');
        }
        if (!pvc.spec.accessModes || pvc.spec.accessModes.length === 0) {
          issues.push('缺少 spec.accessModes 字段');
        }
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
    pvcs,
    clusters,
    namespaces,
    availablePVs,
    loading,
    clustersLoading,
    namespacesLoading,
    pvsLoading,
    searchText,
    filterClusterId,
    filterNamespace,
    filterStatus,
    filterAccessMode,
    selectedRowKeys,
    selectedRows,
    currentPage,
    pageSize,
    total,
    clustersPage,
    clustersSize,
    namespacesPage,
    namespacesSize,
    
    formRef,
    yamlFormRef,
    createYamlFormRef,
    expandFormRef,
    
    isCreateModalVisible,
    isCreateYamlModalVisible,
    isEditModalVisible,
    isDetailModalVisible,
    isYamlModalVisible,
    isExpandModalVisible,
    isPodsModalVisible,
    submitLoading,
    detailLoading,
    podsLoading,
    
    currentOperationPVC,
    currentPVCDetail,
    currentYamlContent,
    currentPVCPods,
    
    createFormModel,
    editFormModel,
    yamlFormModel,
    createYamlFormModel,
    expandFormModel,
    
    createFormRules,
    yamlFormRules,
    createYamlFormRules,
    expandFormRules,
    
    filteredPVCs,
    rowSelection,
    pvOptions,
    
    getEnvText,
    getPVCStatusText,
    getPVCStatusColor,
    getAccessModeText,
    
    fetchClusters,
    fetchNamespaces,
    fetchAvailablePVs,
    loadMorePVs,
    fetchPVCs,
    fetchPVCDetails,
    fetchPVCYaml,
    fetchPVCPods,
    clearPVCs,
    clearNamespaces,
    loadMoreClusters,
    loadMoreNamespaces,
    resetClusters,
    resetNamespaces,
    resetPVs,
    
    createPVC,
    createPVCByYaml,
    updatePVC,
    updatePVCByYaml,
    deletePVC,
    expandPVC,
    deleteBatchPVCs,
    
    openCreateModal,
    openCreateYamlModal,
    openEditModal,
    openDetailModal,
    openYamlModal,
    openExpandModal,
    openPodsModal,
    
    resetCreateForm,
    resetEditForm,
    resetYamlForm,
    resetCreateYamlForm,
    resetExpandForm,
    
    handleClusterChange,
    handleFilterChange,
    handleSearch,
    handlePageChange,
    handleClusterDropdownScroll,
    
    newLabelKey,
    newAnnotationKey,
    addLabelItem,
    removeLabelItem,
    newEditLabelKey,
    newEditAnnotationKey,
    addEditLabelItem,
    removeEditLabelItem,
    
    newSelectorKey,
    newSelectorValue,
    addSelectorItem,
    removeSelectorItem,
    
    insertYamlTemplate,
    formatYaml,
    validateYaml,
    clearYaml,
    formatEditYaml,
    validateEditYaml,
    
    K8sPVCStatus,
    
    clustersTotal,
    namespacesTotal,
    pvsTotal,
    pvsPage,
    pvsSize,
  };
}
