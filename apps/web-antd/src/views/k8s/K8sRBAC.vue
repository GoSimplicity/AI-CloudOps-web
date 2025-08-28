<template>
  <div class="k8s-rbac-container">
    <!-- 概览卡片 -->
    <div class="overview-cards">
      <a-row :gutter="16">
        <a-col :span="6">
          <a-card>
            <a-statistic title="总角色数" :value="statistics.total_roles" :loading="loadingStats" />
          </a-card>
        </a-col>
        <a-col :span="6">
          <a-card>
            <a-statistic title="集群角色数" :value="statistics.total_cluster_roles" :loading="loadingStats" />
          </a-card>
        </a-col>
        <a-col :span="6">
          <a-card>
            <a-statistic title="角色绑定数" :value="statistics.total_role_bindings" :loading="loadingStats" />
          </a-card>
        </a-col>
        <a-col :span="6">
          <a-card>
            <a-statistic title="活跃主体数" :value="statistics.active_subjects" :loading="loadingStats" />
          </a-card>
        </a-col>
      </a-row>
    </div>

    <!-- 主内容区域 -->
    <a-card class="main-content">
      <!-- 工具栏 -->
      <div class="toolbar">
        <div class="toolbar-left">
          <a-space>
            <a-select v-model:value="selectedClusterId" placeholder="选择集群" style="width: 200px" @change="onClusterChange">
              <a-select-option v-for="cluster in clusters" :key="cluster.id" :value="cluster.id">
                {{ cluster.name_zh || cluster.name }}
              </a-select-option>
            </a-select>
            <a-tabs v-model:activeKey="activeTab" @change="onTabChange">
              <a-tab-pane key="roles" tab="角色 (Roles)" />
              <a-tab-pane key="cluster-roles" tab="集群角色 (ClusterRoles)" />
              <a-tab-pane key="role-bindings" tab="角色绑定 (RoleBindings)" />
              <a-tab-pane key="cluster-role-bindings" tab="集群角色绑定 (ClusterRoleBindings)" />
            </a-tabs>
          </a-space>
        </div>
        <div class="toolbar-right">
          <a-space>
            <a-input-search v-model:value="searchKeyword" placeholder="搜索名称..." style="width: 250px" @search="handleSearch" />
            <a-button type="primary" @click="handleRefresh" :loading="loading">
              <template #icon><ReloadOutlined /></template>
              刷新
            </a-button>
          </a-space>
        </div>
      </div>

      <!-- 表格 -->
      <a-table 
        :columns="tableColumns"
        :data-source="roles"
        :loading="loading"
        :pagination="pagination"
        @change="handleTableChange"
        row-key="name"
      >
        <template #bodyCell="{ column, record }">
          <template v-if="column.dataIndex === 'name'">
            <span style="font-weight: 600;">{{ record.name }}</span>
          </template>
          <template v-else-if="column.dataIndex === 'action'">
            <a-space>
              <a-button type="text" size="small" @click="handleViewDetails(record)">
                <EyeOutlined />
              </a-button>
              <a-button type="text" size="small" @click="handleViewYaml(record)">
                <CodeOutlined />
              </a-button>
              <a-button type="text" size="small" danger @click="handleDelete(record)">
                <DeleteOutlined />
              </a-button>
            </a-space>
          </template>
        </template>
      </a-table>
    </a-card>

    <!-- 详情抽屉 -->
    <a-drawer 
      v-model:open="detailsDrawerVisible"
      title="详情"
      width="600"
    >
      <div v-if="selectedRecord">
        <pre>{{ JSON.stringify(selectedRecord, null, 2) }}</pre>
      </div>
    </a-drawer>

    <!-- YAML编辑弹窗 -->
    <a-modal 
      v-model:open="yamlModalVisible"
      title="编辑YAML"
      width="800"
      @ok="handleYamlSubmit"
    >
      <a-textarea v-model:value="yamlContent" :rows="20" />
    </a-modal>
  </div>
</template>

<script lang="ts" setup>
import { ref, reactive, onMounted } from 'vue';
import { message } from 'ant-design-vue';
import { EyeOutlined, CodeOutlined, DeleteOutlined, ReloadOutlined } from '@ant-design/icons-vue';
import { getAllClustersApi } from '#/api';

// 状态
const loading = ref(false);
const loadingStats = ref(false);
const selectedClusterId = ref();
const activeTab = ref('roles');
const searchKeyword = ref('');
const detailsDrawerVisible = ref(false);
const yamlModalVisible = ref(false);
const yamlContent = ref('');
const selectedRecord = ref(null);

// 数据
const clusters = ref<Array<{id: number, name: string, name_zh?: string}>>([]);
const roles = ref<any[]>([]);
const statistics = reactive({
  total_roles: 0,
  total_cluster_roles: 0,
  total_role_bindings: 0,
  active_subjects: 0
});

const pagination = reactive({
  current: 1,
  pageSize: 20,
  total: 0,
  showSizeChanger: true,
  showQuickJumper: true,
});

// 表格列
const tableColumns = [
  { title: '名称', dataIndex: 'name' },
  { title: '命名空间', dataIndex: 'namespace' },
  { title: '创建时间', dataIndex: 'created_at' },
  { title: '操作', dataIndex: 'action', width: 150 }
];

// 方法
const loadClusters = async () => {
  try {
    const res = await getAllClustersApi();
    clusters.value = res || [];
    if (clusters.value.length > 0) {
      selectedClusterId.value = clusters.value[0]?.id;
      await loadCurrentTabData();
      await loadStatistics();
    }
  } catch (error: any) {
    message.error('获取集群列表失败');
  }
};

const loadStatistics = async () => {
  if (!selectedClusterId.value) return;
  loadingStats.value = true;
  try {
    // 模拟统计数据
    statistics.total_roles = Math.floor(Math.random() * 50);
    statistics.total_cluster_roles = Math.floor(Math.random() * 20);
    statistics.total_role_bindings = Math.floor(Math.random() * 100);
    statistics.active_subjects = Math.floor(Math.random() * 200);
  } finally {
    loadingStats.value = false;
  }
};

const onClusterChange = () => {
  loadCurrentTabData();
  loadStatistics();
};

const onTabChange = () => {
  loadCurrentTabData();
};

const loadCurrentTabData = async () => {
  if (!selectedClusterId.value) return;
  try {
    loading.value = true;
    // 模拟API调用
    roles.value = [
      { name: 'admin', namespace: 'default', created_at: '2023-01-01' },
      { name: 'view', namespace: 'kube-system', created_at: '2023-01-02' }
    ];
    pagination.total = 2;
  } finally {
    loading.value = false;
  }
};

const handleSearch = () => loadCurrentTabData();
const handleTableChange = (pag: any) => { 
  pagination.current = pag.current; 
  pagination.pageSize = pag.pageSize; 
  loadCurrentTabData(); 
};
const handleRefresh = () => { 
  loadCurrentTabData(); 
  loadStatistics(); 
};
const handleViewDetails = (record: any) => { 
  selectedRecord.value = record; 
  detailsDrawerVisible.value = true; 
};
const handleViewYaml = (record: any) => { 
  selectedRecord.value = record; 
  yamlContent.value = ""; 
  yamlModalVisible.value = true; 
};
const handleDelete = (_record: any) => message.info("删除功能开发中...");
const handleYamlSubmit = () => { 
  yamlModalVisible.value = false; 
  message.success("YAML更新成功"); 
};

onMounted(() => loadClusters());
</script>

<style scoped>
.k8s-rbac-container { padding: 24px; }
.overview-cards { margin-bottom: 24px; }
.toolbar { display: flex; justify-content: space-between; margin-bottom: 16px; }
</style>
