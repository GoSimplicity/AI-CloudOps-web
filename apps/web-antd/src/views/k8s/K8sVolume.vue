<template>
  <div class="k8s-volume">
    <!-- 页面标题 -->
    <div class="page-header">
      <h2>存储卷管理</h2>
      <p>管理 Kubernetes 集群中的持久化存储卷 (PV) 和存储声明 (PVC)</p>
    </div>

    <!-- 统计卡片 -->
    <div class="stats-cards">
      <a-row :gutter="16">
        <a-col :span="6">
          <a-card>
            <a-statistic
              title="PV 总数"
              :value="pvStats.total_count"
              :loading="loading"
              value-style="color: #1890ff"
            />
          </a-card>
        </a-col>
        <a-col :span="6">
          <a-card>
            <a-statistic
              title="PVC 总数"
              :value="pvcStats.total_count"
              :loading="loading"
              value-style="color: #722ed1"
            />
          </a-card>
        </a-col>
        <a-col :span="6">
          <a-card>
            <a-statistic
              title="已绑定"
              :value="pvStats.bound_count"
              :loading="loading"
              value-style="color: #52c41a"
            />
          </a-card>
        </a-col>
        <a-col :span="6">
          <a-card>
            <a-statistic
              title="总容量"
              :value="pvStats.total_capacity"
              :loading="loading"
              value-style="color: #fa8c16"
            />
          </a-card>
        </a-col>
      </a-row>
    </div>

    <!-- 工具栏 -->
    <a-card class="toolbar-card">
      <a-row :gutter="16" align="middle">
        <!-- 集群选择 -->
        <a-col :span="4">
          <a-select
            v-model:value="selectedCluster"
            placeholder="选择集群"
            :loading="clustersLoading"
            @change="onClusterChange"
            style="width: 100%"
          >
            <a-select-option
              v-for="cluster in clusters"
              :key="cluster.id"
              :value="cluster.id"
            >
              {{ cluster.name }}
            </a-select-option>
          </a-select>
        </a-col>

        <!-- 视图切换 -->
        <a-col :span="4">
          <a-radio-group v-model:value="viewMode" button-style="solid" @change="loadData">
            <a-radio-button value="pv">PV 视图</a-radio-button>
            <a-radio-button value="pvc">PVC 视图</a-radio-button>
          </a-radio-group>
        </a-col>

        <!-- 命名空间选择（仅PVC视图） -->
        <a-col :span="3" v-if="viewMode === 'pvc'">
          <a-select
            v-model:value="selectedNamespace"
            placeholder="选择命名空间"
            :loading="namespacesLoading"
            @change="loadData"
            style="width: 100%"
            :disabled="!selectedCluster"
          >
            <a-select-option value="">全部命名空间</a-select-option>
            <a-select-option
              v-for="ns in namespaces"
              :key="ns.name"
              :value="ns.name"
            >
              {{ ns.name }}
            </a-select-option>
          </a-select>
        </a-col>

        <!-- 状态筛选 -->
        <a-col :span="3">
          <a-select
            v-model:value="statusFilter"
            placeholder="状态筛选"
            @change="loadData"
            style="width: 100%"
          >
            <a-select-option value="">全部状态</a-select-option>
            <template v-if="viewMode === 'pv'">
              <a-select-option value="Available">可用</a-select-option>
              <a-select-option value="Bound">已绑定</a-select-option>
              <a-select-option value="Released">已释放</a-select-option>
              <a-select-option value="Failed">失败</a-select-option>
            </template>
            <template v-else>
              <a-select-option value="Bound">已绑定</a-select-option>
              <a-select-option value="Pending">等待中</a-select-option>
              <a-select-option value="Lost">丢失</a-select-option>
            </template>
          </a-select>
        </a-col>

        <!-- 搜索 -->
        <a-col :span="5">
          <a-input-search
            v-model:value="searchText"
            :placeholder="viewMode === 'pv' ? '搜索PV名称' : '搜索PVC名称'"
            @search="loadData"
            @change="loadData"
            allow-clear
          />
        </a-col>

        <!-- 操作按钮 -->
        <a-col :span="5" style="text-align: right">
          <a-space>
            <a-button @click="loadData" :loading="loading">
              <template #icon><ReloadOutlined /></template>
              刷新
            </a-button>
            <a-button type="primary" @click="showCreateModal = true" :disabled="!selectedCluster">
              <template #icon><PlusOutlined /></template>
              创建{{ viewMode === 'pv' ? 'PV' : 'PVC' }}
            </a-button>
            <a-dropdown>
              <a-button>
                <template #icon><MoreOutlined /></template>
                更多操作
                <DownOutlined />
              </a-button>
              <template #overlay>
                <a-menu @click="handleMoreAction">
                  <a-menu-item key="batchDelete" :disabled="!selectedRowKeys.length">
                    <DeleteOutlined />
                    批量删除
                  </a-menu-item>
                  <a-menu-item key="export">
                    <ExportOutlined />
                    导出列表
                  </a-menu-item>
                </a-menu>
              </template>
            </a-dropdown>
          </a-space>
        </a-col>
      </a-row>
    </a-card>

    <!-- 数据表格 -->
    <a-card class="table-card">
      <a-table
        :columns="currentColumns"
        :data-source="filteredData"
        :loading="loading"
        :pagination="pagination"
        :row-selection="rowSelection"
        :scroll="{ x: 1400 }"
        row-key="name"
        size="middle"
        @change="handleTableChange"
      >
        <!-- 名称列 -->
        <template #volumeName="{ record }">
          <div class="volume-name">
            <a-tag :color="viewMode === 'pv' ? 'blue' : 'purple'">
              {{ record.name }}
            </a-tag>
            <div v-if="viewMode === 'pvc'" class="namespace-info">{{ record.namespace }}</div>
          </div>
        </template>

        <!-- 状态列 -->
        <template #status="{ record }">
          <a-tag :color="getStatusColor(record.status)">
            <component :is="getStatusIcon(record.status)" />
            {{ record.status }}
          </a-tag>
        </template>

        <!-- 容量列 -->
        <template #capacity="{ record }">
          <div class="capacity-info">
            <div class="capacity-size">
              <DatabaseOutlined />
              {{ record.capacity || record.resources?.requests?.storage || '-' }}
            </div>
            <div v-if="record.usage" class="usage-info">
              使用率: {{ record.usage }}
            </div>
          </div>
        </template>

        <!-- 访问模式列 -->
        <template #accessModes="{ record }">
          <div class="access-modes">
            <a-tag 
              v-for="mode in record.access_modes" 
              :key="mode" 
              size="small"
              :color="getAccessModeColor(mode)"
            >
              {{ getAccessModeText(mode) }}
            </a-tag>
          </div>
        </template>

        <!-- 存储类列 -->
        <template #storageClass="{ record }">
          <a-tag v-if="record.storage_class" color="cyan">
            {{ record.storage_class }}
          </a-tag>
          <span v-else class="text-muted">-</span>
        </template>

        <!-- 绑定信息列（仅PV） -->
        <template #bindInfo="{ record }">
          <div v-if="record.claim" class="bind-info">
            <a-tag color="green">
              <LinkOutlined />
              {{ record.claim }}
            </a-tag>
          </div>
          <span v-else class="text-muted">未绑定</span>
        </template>

        <!-- 关联PV列（仅PVC） -->
        <template #volume="{ record }">
          <a-tag v-if="record.volume" color="blue">
            <DatabaseOutlined />
            {{ record.volume }}
          </a-tag>
          <span v-else class="text-muted">-</span>
        </template>

        <!-- 回收策略列（仅PV） -->
        <template #reclaimPolicy="{ record }">
          <a-tag :color="getReclaimPolicyColor(record.reclaim_policy)">
            {{ record.reclaim_policy }}
          </a-tag>
        </template>

        <!-- 创建时间列 -->
        <template #createdTime="{ record }">
          <div class="time-info">
            <div>{{ record.creation_timestamp }}</div>
            <div class="age-info">{{ record.age }}</div>
          </div>
        </template>

        <!-- 操作列 -->
        <template #action="{ record }">
          <a-space>
            <a-button type="link" size="small" @click="viewDetail">
              <EyeOutlined />
              详情
            </a-button>
            <a-button type="link" size="small" @click="editVolume">
              <EditOutlined />
              编辑
            </a-button>
            <a-dropdown>
              <a-button type="link" size="small">
                <MoreOutlined />
              </a-button>
              <template #overlay>
                <a-menu @click="(e: any) => handleVolumeAction(e.key, record)">
                  <a-menu-item key="yaml">
                    <FileTextOutlined />
                    查看YAML
                  </a-menu-item>
                  <a-menu-item v-if="viewMode === 'pvc'" key="usage">
                    <BarChartOutlined />
                    使用情况
                  </a-menu-item>
                  <a-menu-item v-if="viewMode === 'pvc'" key="expand">
                    <ExpandAltOutlined />
                    扩容
                  </a-menu-item>
                  <a-menu-item v-if="viewMode === 'pvc'" key="clone">
                    <CopyOutlined />
                    克隆
                  </a-menu-item>
                  <a-menu-item v-if="viewMode === 'pv' && record.status === 'Released'" key="reclaim">
                    <ReloadOutlined />
                    回收
                  </a-menu-item>
                  <a-menu-divider />
                  <a-menu-item key="delete" danger>
                    <DeleteOutlined />
                    删除
                  </a-menu-item>
                </a-menu>
              </template>
            </a-dropdown>
          </a-space>
        </template>
      </a-table>
    </a-card>

    <!-- 创建弹窗 -->
    <a-modal
      v-model:open="showCreateModal"
      :title="`创建${viewMode === 'pv' ? 'PV' : 'PVC'}`"
      width="800px"
      @ok="handleCreate"
      @cancel="resetCreateForm"
      :confirm-loading="creating"
    >
      <div class="create-form">
        <a-form
          :model="createForm"
          :label-col="{ span: 6 }"
          :wrapper-col="{ span: 18 }"
        >
          <!-- 基本信息 -->
          <a-form-item label="名称" required>
            <a-input v-model:value="createForm.name" placeholder="输入名称" />
          </a-form-item>
          
          <a-form-item v-if="viewMode === 'pvc'" label="命名空间" required>
            <a-select v-model:value="createForm.namespace" placeholder="选择命名空间">
              <a-select-option
                v-for="ns in namespaces"
                :key="ns.name"
                :value="ns.name"
              >
                {{ ns.name }}
              </a-select-option>
            </a-select>
          </a-form-item>

          <a-form-item label="容量" required>
            <a-input v-model:value="createForm.capacity" placeholder="如: 10Gi" />
          </a-form-item>

          <a-form-item label="访问模式" required>
            <a-select v-model:value="createForm.access_modes" mode="multiple" placeholder="选择访问模式">
              <a-select-option value="ReadWriteOnce">ReadWriteOnce</a-select-option>
              <a-select-option value="ReadOnlyMany">ReadOnlyMany</a-select-option>
              <a-select-option value="ReadWriteMany">ReadWriteMany</a-select-option>
            </a-select>
          </a-form-item>

          <a-form-item label="存储类">
            <a-input v-model:value="createForm.storage_class" placeholder="输入存储类名称" />
          </a-form-item>

          <!-- PV特有字段 -->
          <template v-if="viewMode === 'pv'">
            <a-form-item label="回收策略">
              <a-select v-model:value="createForm.reclaim_policy" placeholder="选择回收策略">
                <a-select-option value="Retain">Retain</a-select-option>
                <a-select-option value="Delete">Delete</a-select-option>
                <a-select-option value="Recycle">Recycle</a-select-option>
              </a-select>
            </a-form-item>

            <a-form-item label="存储源类型">
              <a-select v-model:value="createForm.source_type" placeholder="选择存储源类型">
                <a-select-option value="nfs">NFS</a-select-option>
                <a-select-option value="hostPath">HostPath</a-select-option>
                <a-select-option value="local">Local</a-select-option>
                <a-select-option value="csi">CSI</a-select-option>
              </a-select>
            </a-form-item>

            <!-- NFS配置 -->
            <template v-if="createForm.source_type === 'nfs'">
              <a-form-item label="NFS服务器">
                <a-input v-model:value="createForm.nfs_server" placeholder="NFS服务器地址" />
              </a-form-item>
              <a-form-item label="NFS路径">
                <a-input v-model:value="createForm.nfs_path" placeholder="NFS共享路径" />
              </a-form-item>
            </template>

            <!-- HostPath配置 -->
            <template v-if="createForm.source_type === 'hostPath'">
              <a-form-item label="主机路径">
                <a-input v-model:value="createForm.host_path" placeholder="主机文件系统路径" />
              </a-form-item>
            </template>
          </template>

          <!-- 标签 -->
          <a-form-item label="标签">
            <div class="labels-input">
              <a-input-group compact>
                <a-input
                  v-model:value="newLabelKey"
                  placeholder="键"
                  style="width: 40%"
                />
                <a-input
                  v-model:value="newLabelValue"
                  placeholder="值"
                  style="width: 40%"
                />
                <a-button @click="addLabel" style="width: 20%">添加</a-button>
              </a-input-group>
              <div v-if="Object.keys(createForm.labels || {}).length" class="labels-list">
                <a-tag
                  v-for="(value, key) in createForm.labels"
                  :key="key"
                  closable
                  @close="() => removeLabel(String(key))"
                >
                  {{ key }}={{ value }}
                </a-tag>
              </div>
            </div>
          </a-form-item>
        </a-form>
      </div>
    </a-modal>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted, watch } from 'vue';
import { message } from 'ant-design-vue';
import {
  ReloadOutlined,
  PlusOutlined,
  MoreOutlined,
  DownOutlined,
  DeleteOutlined,
  ExportOutlined,
  EyeOutlined,
  EditOutlined,
  FileTextOutlined,
  BarChartOutlined,
  ExpandAltOutlined,
  CopyOutlined,
  DatabaseOutlined,
  LinkOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  ExclamationCircleOutlined,
  SyncOutlined,
} from '@ant-design/icons-vue';

// API imports
import { getAllClustersApi } from '#/api/core/k8s_cluster';
import { getNamespacesByClusterIdApi } from '#/api/core/k8s_namespace';
import {
  getPVListApi,
  getPVStatisticsApi,
  createPVApi,
  deletePVApi,
  batchDeletePVApi,
  reclaimPVApi,
  type PVInfo,
  type PVStatistics,
} from '#/api/core/k8s_pv';
import {
  getPVCListApi,
  getPVCStatisticsApi,
  createPVCApi,
  deletePVCApi,
  batchDeletePVCApi,
  type PVCInfo,
  type PVCStatistics,
} from '#/api/core/k8s_pvc';

// 数据定义

const loading = ref(false);
const clustersLoading = ref(false);
const namespacesLoading = ref(false);
const creating = ref(false);

const selectedCluster = ref<number>();
const selectedNamespace = ref<string>('');
const viewMode = ref<'pv' | 'pvc'>('pv');
const statusFilter = ref<string>('');
const searchText = ref<string>('');

const clusters = ref<any[]>([]);
const namespaces = ref<any[]>([]);
const pvData = ref<PVInfo[]>([]);
const pvcData = ref<PVCInfo[]>([]);
const selectedRowKeys = ref<string[]>([]);

const showCreateModal = ref(false);
const createForm = reactive<any>({
  name: '',
  namespace: '',
  capacity: '',
  access_modes: [],
  storage_class: '',
  reclaim_policy: 'Retain',
  source_type: 'nfs',
  nfs_server: '',
  nfs_path: '',
  host_path: '',
  labels: {},
});

const newLabelKey = ref('');
const newLabelValue = ref('');

const pvStats = ref<PVStatistics>({
  total_count: 0,
  available_count: 0,
  bound_count: 0,
  released_count: 0,
  failed_count: 0,
  total_capacity: '0',
  used_capacity: '0',
});

const pvcStats = ref<PVCStatistics>({
  total_count: 0,
  bound_count: 0,
  pending_count: 0,
  lost_count: 0,
  total_capacity: '0',
  used_capacity: '0',
});

// 计算属性

const currentData = computed(() => viewMode.value === 'pv' ? pvData.value : pvcData.value);

const filteredData = computed(() => {
  let filtered = [...currentData.value];
  
  // 状态筛选
  if (statusFilter.value) {
    filtered = filtered.filter(item => item.status === statusFilter.value);
  }
  
  // 搜索筛选
  if (searchText.value) {
    const search = searchText.value.toLowerCase();
    filtered = filtered.filter(item => 
      item.name.toLowerCase().includes(search)
    );
  }
  
  return filtered;
});

const currentColumns = computed(() => {
  if (viewMode.value === 'pv') {
    return [
      {
        title: 'PV名称',
        dataIndex: 'name',
        key: 'name',
        slots: { customRender: 'volumeName' },
        width: 200,
        ellipsis: true,
      },
      {
        title: '状态',
        dataIndex: 'status',
        key: 'status',
        slots: { customRender: 'status' },
        width: 120,
      },
      {
        title: '容量',
        dataIndex: 'capacity',
        key: 'capacity',
        slots: { customRender: 'capacity' },
        width: 120,
      },
      {
        title: '访问模式',
        dataIndex: 'access_modes',
        key: 'access_modes',
        slots: { customRender: 'accessModes' },
        width: 180,
      },
      {
        title: '回收策略',
        dataIndex: 'reclaim_policy',
        key: 'reclaim_policy',
        slots: { customRender: 'reclaimPolicy' },
        width: 120,
      },
      {
        title: '存储类',
        dataIndex: 'storage_class',
        key: 'storage_class',
        slots: { customRender: 'storageClass' },
        width: 120,
      },
      {
        title: '绑定信息',
        dataIndex: 'claim',
        key: 'claim',
        slots: { customRender: 'bindInfo' },
        width: 180,
      },
      {
        title: '创建时间',
        dataIndex: 'creation_timestamp',
        key: 'creation_timestamp',
        slots: { customRender: 'createdTime' },
        width: 180,
      },
      {
        title: '操作',
        key: 'action',
        slots: { customRender: 'action' },
        width: 150,
        fixed: 'right',
      },
    ];
  } else {
    return [
      {
        title: 'PVC名称',
        dataIndex: 'name',
        key: 'name',
        slots: { customRender: 'volumeName' },
        width: 200,
        ellipsis: true,
      },
      {
        title: '状态',
        dataIndex: 'status',
        key: 'status',
        slots: { customRender: 'status' },
        width: 120,
      },
      {
        title: '容量',
        dataIndex: 'capacity',
        key: 'capacity',
        slots: { customRender: 'capacity' },
        width: 120,
      },
      {
        title: '访问模式',
        dataIndex: 'access_modes',
        key: 'access_modes',
        slots: { customRender: 'accessModes' },
        width: 180,
      },
      {
        title: '存储类',
        dataIndex: 'storage_class',
        key: 'storage_class',
        slots: { customRender: 'storageClass' },
        width: 120,
      },
      {
        title: '关联PV',
        dataIndex: 'volume',
        key: 'volume',
        slots: { customRender: 'volume' },
        width: 150,
      },
      {
        title: '创建时间',
        dataIndex: 'creation_timestamp',
        key: 'creation_timestamp',
        slots: { customRender: 'createdTime' },
        width: 180,
      },
      {
        title: '操作',
        key: 'action',
        slots: { customRender: 'action' },
        width: 150,
        fixed: 'right',
      },
    ];
  }
});

// 表格配置

const pagination = reactive({
  current: 1,
  pageSize: 20,
  showQuickJumper: true,
  showSizeChanger: true,
  showTotal: (total: number) => `共 ${total} 个${viewMode.value === 'pv' ? 'PV' : 'PVC'}`,
});

const rowSelection = {
  selectedRowKeys: selectedRowKeys,
  onChange: (keys: string[]) => {
    selectedRowKeys.value = keys;
  },
};

// 方法定义

/**
 * 获取集群列表
 */
const getClusters = async () => {
  try {
    clustersLoading.value = true;
    const response = await getAllClustersApi();
    clusters.value = response || [];
    
    // 选择第一个集群
    if (clusters.value.length > 0 && clusters.value[0]) {
      selectedCluster.value = clusters.value[0].id;
      await getNamespaces();
    }
  } catch (error) {
    console.error('获取集群列表失败:', error);
    message.error('获取集群列表失败');
  } finally {
    clustersLoading.value = false;
  }
};

/**
 * 获取命名空间列表
 */
const getNamespaces = async () => {
  if (!selectedCluster.value) return;
  
  try {
    namespacesLoading.value = true;
    const response = await getNamespacesByClusterIdApi(selectedCluster.value);
    namespaces.value = response || [];
  } catch (error) {
    console.error('获取命名空间列表失败:', error);
    message.error('获取命名空间列表失败');
  } finally {
    namespacesLoading.value = false;
  }
};

/**
 * 加载数据
 */
const loadData = async () => {
  if (!selectedCluster.value) return;
  
  try {
    loading.value = true;
    
    if (viewMode.value === 'pv') {
      const [data, stats] = await Promise.all([
        getPVListApi({
          cluster_id: selectedCluster.value!,
          status: statusFilter.value || undefined,
        }),
        getPVStatisticsApi(selectedCluster.value!),
      ]);
      pvData.value = data || [];
      pvStats.value = stats || pvStats.value;
    } else {
      const [data, stats] = await Promise.all([
        getPVCListApi({
          cluster_id: selectedCluster.value!,
          namespace: selectedNamespace.value || undefined,
          status: statusFilter.value || undefined,
        }),
        getPVCStatisticsApi(selectedCluster.value!, selectedNamespace.value || undefined),
      ]);
      pvcData.value = data || [];
      pvcStats.value = stats || pvcStats.value;
    }
  } catch (error) {
    console.error('获取数据失败:', error);
    message.error('获取数据失败');
  } finally {
    loading.value = false;
  }
};

/**
 * 集群变更处理
 */
const onClusterChange = async () => {
  selectedNamespace.value = '';
  await Promise.all([getNamespaces(), loadData()]);
};

/**
 * 表格变更处理
 */
const handleTableChange = (pag: any) => {
  pagination.current = pag.current;
  pagination.pageSize = pag.pageSize;
};

/**
 * 获取状态颜色
 */
const getStatusColor = (status: string) => {
  const colorMap: Record<string, string> = {
    // PV状态
    'Available': 'blue',
    'Bound': 'success',
    'Released': 'warning',
    'Failed': 'error',
    // PVC状态
    'Pending': 'warning',
    'Lost': 'error',
  };
  return colorMap[status] || 'default';
};

/**
 * 获取状态图标
 */
const getStatusIcon = (status: string) => {
  const iconMap: Record<string, any> = {
    'Available': CheckCircleOutlined,
    'Bound': CheckCircleOutlined,
    'Released': ExclamationCircleOutlined,
    'Failed': CloseCircleOutlined,
    'Pending': SyncOutlined,
    'Lost': CloseCircleOutlined,
  };
  return iconMap[status] || CheckCircleOutlined;
};

/**
 * 获取访问模式颜色
 */
const getAccessModeColor = (mode: string) => {
  const colorMap: Record<string, string> = {
    'ReadWriteOnce': 'blue',
    'ReadOnlyMany': 'green',
    'ReadWriteMany': 'orange',
  };
  return colorMap[mode] || 'default';
};

/**
 * 获取访问模式文本
 */
const getAccessModeText = (mode: string) => {
  const textMap: Record<string, string> = {
    'ReadWriteOnce': 'RWO',
    'ReadOnlyMany': 'ROX',
    'ReadWriteMany': 'RWX',
  };
  return textMap[mode] || mode;
};

/**
 * 获取回收策略颜色
 */
const getReclaimPolicyColor = (policy: string) => {
  const colorMap: Record<string, string> = {
    'Retain': 'blue',
    'Delete': 'red',
    'Recycle': 'orange',
  };
  return colorMap[policy] || 'default';
};

/**
 * 查看详情
 */
const viewDetail = () => {
  message.info(`查看${viewMode.value === 'pv' ? 'PV' : 'PVC'}详情功能开发中`);
};

/**
 * 编辑
 */
const editVolume = () => {
  message.info(`编辑${viewMode.value === 'pv' ? 'PV' : 'PVC'}功能开发中`);
};

/**
 * 处理卷操作
 */
const handleVolumeAction = async (action: string, record: any) => {
  switch (action) {
    case 'yaml':
      message.info('查看YAML功能开发中');
      break;
    case 'usage':
      message.info('查看使用情况功能开发中');
      break;
    case 'expand':
      message.info('扩容功能开发中');
      break;
    case 'clone':
      message.info('克隆功能开发中');
      break;
    case 'reclaim':
      try {
        await reclaimPVApi(selectedCluster.value!, record.name);
        message.success('PV回收成功');
        loadData();
      } catch (error) {
        message.error('PV回收失败');
      }
      break;
    case 'delete':
      try {
        if (viewMode.value === 'pv') {
          await deletePVApi({ cluster_id: selectedCluster.value!, name: record.name });
        } else {
          await deletePVCApi({ 
            cluster_id: selectedCluster.value!, 
            namespace: record.namespace, 
            name: record.name 
          });
        }
        message.success(`${viewMode.value === 'pv' ? 'PV' : 'PVC'}删除成功`);
        loadData();
      } catch (error) {
        message.error(`${viewMode.value === 'pv' ? 'PV' : 'PVC'}删除失败`);
      }
      break;
  }
};

/**
 * 处理更多操作
 */
const handleMoreAction = async ({ key }: { key: string }) => {
  switch (key) {
    case 'batchDelete':
      try {
        if (viewMode.value === 'pv') {
          await batchDeletePVApi(selectedCluster.value!, selectedRowKeys.value);
        } else {
          // 需要按命名空间分组批量删除PVC
          const groupedByNamespace = selectedRowKeys.value.reduce((acc, name) => {
            const item = pvcData.value.find(pvc => pvc.name === name);
            if (item && item.namespace) {
              if (!acc[item.namespace]) acc[item.namespace] = [];
              acc[item.namespace]?.push(name);
            }
            return acc;
          }, {} as Record<string, string[]>);
          
          for (const [namespace, names] of Object.entries(groupedByNamespace)) {
            if (names.length > 0) {
              await batchDeletePVCApi({
                cluster_id: selectedCluster.value!,
                namespace,
                names,
              });
            }
          }
        }
        message.success(`批量删除${viewMode.value === 'pv' ? 'PV' : 'PVC'}成功`);
        selectedRowKeys.value = [];
        loadData();
      } catch (error) {
        message.error(`批量删除${viewMode.value === 'pv' ? 'PV' : 'PVC'}失败`);
      }
      break;
    case 'export':
      message.info('导出功能开发中');
      break;
  }
};

/**
 * 添加标签
 */
const addLabel = () => {
  if (newLabelKey.value && newLabelValue.value) {
    if (!createForm.labels) createForm.labels = {};
    createForm.labels[newLabelKey.value] = newLabelValue.value;
    newLabelKey.value = '';
    newLabelValue.value = '';
  }
};

/**
 * 移除标签
 */
const removeLabel = (key: string) => {
  if (createForm.labels) {
    delete createForm.labels[key];
  }
};

/**
 * 重置创建表单
 */
const resetCreateForm = () => {
  Object.assign(createForm, {
    name: '',
    namespace: '',
    capacity: '',
    access_modes: [],
    storage_class: '',
    reclaim_policy: 'Retain',
    source_type: 'nfs',
    nfs_server: '',
    nfs_path: '',
    host_path: '',
    labels: {},
  });
  newLabelKey.value = '';
  newLabelValue.value = '';
  showCreateModal.value = false;
};

/**
 * 处理创建
 */
const handleCreate = async () => {
  try {
    creating.value = true;
    
    if (viewMode.value === 'pv') {
      const pvSource: any = {};
      if (createForm.source_type === 'nfs') {
        pvSource.nfs = {
          server: createForm.nfs_server,
          path: createForm.nfs_path,
        };
      } else if (createForm.source_type === 'hostPath') {
        pvSource.host_path = {
          path: createForm.host_path,
        };
      }
      
      await createPVApi({
        cluster_id: selectedCluster.value!,
        name: createForm.name,
        capacity: createForm.capacity,
        access_modes: createForm.access_modes,
        reclaim_policy: createForm.reclaim_policy,
        storage_class: createForm.storage_class,
        persistent_volume_source: { type: createForm.source_type, ...pvSource },
        labels: createForm.labels,
      });
    } else {
      await createPVCApi({
        cluster_id: selectedCluster.value!,
        namespace: createForm.namespace,
        name: createForm.name,
        access_modes: createForm.access_modes,
        resources: {
          requests: {
            storage: createForm.capacity,
          },
        },
        storage_class: createForm.storage_class,
        labels: createForm.labels,
      });
    }
    
    message.success(`创建${viewMode.value === 'pv' ? 'PV' : 'PVC'}成功`);
    resetCreateForm();
    loadData();
  } catch (error) {
    console.error('创建失败:', error);
    message.error(`创建${viewMode.value === 'pv' ? 'PV' : 'PVC'}失败`);
  } finally {
    creating.value = false;
  }
};

// 生命周期

onMounted(() => {
  getClusters();
});

// 监听变化
watch(selectedCluster, () => {
  if (selectedCluster.value) {
    loadData();
  }
});

watch(viewMode, () => {
  selectedRowKeys.value = [];
  statusFilter.value = '';
  searchText.value = '';
  if (selectedCluster.value) {
    loadData();
  }
});
</script>

<style scoped lang="less">
.k8s-volume {
  padding: 24px;
  background-color: #f5f5f5;
  min-height: 100vh;

  .page-header {
    margin-bottom: 24px;
    
    h2 {
      margin: 0 0 8px 0;
      color: #262626;
      font-size: 24px;
      font-weight: 600;
    }
    
    p {
      margin: 0;
      color: #8c8c8c;
      font-size: 14px;
    }
  }

  .stats-cards {
    margin-bottom: 24px;
    
    .ant-card {
      border-radius: 8px;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
    }
  }

  .toolbar-card,
  .table-card {
    border-radius: 8px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
    margin-bottom: 24px;
  }

  .table-card {
    margin-bottom: 0;
  }

  // 表格样式
  .volume-name {
    .namespace-info {
      font-size: 12px;
      color: #8c8c8c;
      margin-top: 4px;
    }
  }

  .capacity-info {
    .capacity-size {
      display: flex;
      align-items: center;
      gap: 4px;
      font-family: 'Monaco', 'Consolas', monospace;
      font-size: 13px;
    }

    .usage-info {
      font-size: 12px;
      color: #8c8c8c;
      margin-top: 4px;
    }
  }

  .access-modes {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
  }

  .bind-info {
    display: flex;
    align-items: center;
    gap: 4px;
  }

  .time-info {
    .age-info {
      font-size: 12px;
      color: #8c8c8c;
      margin-top: 4px;
    }
  }

  .text-muted {
    color: #8c8c8c;
  }

  // 创建表单样式
  .create-form {
    .labels-input {
      .labels-list {
        margin-top: 8px;
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
      }
    }
  }

  // 响应式设计
  @media (max-width: 768px) {
    padding: 16px;

    .toolbar-card .ant-row > .ant-col {
      margin-bottom: 8px;
    }
  }
}

// 暗色主题支持
[data-theme='dark'] .k8s-volume {
  background-color: #141414;

  .page-header {
    h2 {
      color: #f0f0f0;
    }
    
    p {
      color: #a6a6a6;
    }
  }

  .text-muted {
    color: #a6a6a6;
  }
}
</style>
