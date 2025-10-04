<template>
  <div class="k8s-management-container">
    <!-- 页面头部 -->
    <div class="k8s-page-header">
      <a-row class="k8s-header-content" :gutter="[24, 16]">
        <a-col :xs="24" :sm="24" :md="16" :lg="16" :xl="18">
          <div class="k8s-title-section">
            <div class="k8s-page-title">
              <DatabaseOutlined class="k8s-title-icon" />
              <div>
                <h1>PersistentVolume 管理</h1>
                <p class="k8s-page-subtitle">管理和监控集群中的所有 Kubernetes PersistentVolume 持久化存储卷</p>
              </div>
            </div>
          </div>
        </a-col>
        <a-col :xs="24" :sm="24" :md="8" :lg="8" :xl="6">
          <div class="k8s-header-actions">
            <a-button type="primary" @click="openCreateModal" :disabled="!filterClusterId">
              <template #icon><PlusOutlined /></template>
              创建 PV
            </a-button>
            <a-button @click="fetchPVs" :loading="loading">
              <template #icon><ReloadOutlined /></template>
              刷新数据
            </a-button>
          </div>
        </a-col>
      </a-row>
    </div>

    <!-- 工具栏 -->
    <div class="k8s-toolbar">
      <!-- 筛选和搜索区域 -->
      <div class="k8s-toolbar-filters">
        <div class="k8s-filter-group">
          <a-select 
            v-model:value="filterClusterId" 
            placeholder="选择集群" 
            class="k8s-cluster-selector" 
            allow-clear 
            @change="handleClusterChange"
            :loading="clustersLoading"
            :disabled="clustersLoading"
            @popup-scroll="handleClusterDropdownScroll"
          >
            <template #suffixIcon><DatabaseOutlined /></template>
            <a-select-option v-for="cluster in clusters" :key="cluster.id" :value="cluster.id">
              <div style="display: flex; align-items: center; justify-content: space-between;">
                <span>{{ cluster.name }}</span>
                <a-tag color="blue" size="small">{{ getEnvText(cluster.env) }}</a-tag>
              </div>
            </a-select-option>
            <a-select-option 
              v-if="clusters.length > 0 && clusters.length < clustersTotal" 
              :value="'__load_more__'" 
              disabled
              style="text-align: center; color: #999;"
            >
              <a-spin size="small" :spinning="clustersLoading" />
              <span v-if="!clustersLoading">滚动加载更多...</span>
            </a-select-option>
          </a-select>

          <a-select 
            v-model:value="filterStatus" 
            placeholder="状态筛选" 
            class="k8s-filter-select" 
            allow-clear 
            @change="handleFilterChange"
          >
            <template #suffixIcon><FilterOutlined /></template>
            <a-select-option :value="K8sPVStatus.Available">🟢 可用</a-select-option>
            <a-select-option :value="K8sPVStatus.Bound">🔵 已绑定</a-select-option>
            <a-select-option :value="K8sPVStatus.Released">🟡 已释放</a-select-option>
            <a-select-option :value="K8sPVStatus.Failed">🔴 失败</a-select-option>
            <a-select-option :value="K8sPVStatus.Unknown">⚪ 未知</a-select-option>
          </a-select>

          <a-select 
            v-model:value="filterAccessMode" 
            placeholder="访问模式" 
            class="k8s-filter-select" 
            allow-clear 
            @change="handleFilterChange"
          >
            <template #suffixIcon><KeyOutlined /></template>
            <a-select-option value="ReadWriteOnce">RWO</a-select-option>
            <a-select-option value="ReadOnlyMany">ROX</a-select-option>
            <a-select-option value="ReadWriteMany">RWX</a-select-option>
            <a-select-option value="ReadWriteOncePod">RWOP</a-select-option>
          </a-select>

          <a-select 
            v-model:value="filterVolumeType" 
            placeholder="存储类型" 
            class="k8s-filter-select" 
            allow-clear 
            @change="handleFilterChange"
          >
            <template #suffixIcon><CloudServerOutlined /></template>
            <a-select-option value="local">本地存储</a-select-option>
            <a-select-option value="nfs">NFS</a-select-option>
            <a-select-option value="hostPath">主机路径</a-select-option>
            <a-select-option value="awsElasticBlockStore">AWS EBS</a-select-option>
            <a-select-option value="gcePersistentDisk">GCE PD</a-select-option>
            <a-select-option value="csi">CSI</a-select-option>
          </a-select>
          
        </div>

        <div class="k8s-search-group">
          <a-input 
            v-model:value="searchText" 
            placeholder="🔍 搜索 PV 名称" 
            class="k8s-search-input" 
            @pressEnter="onSearch"
            @input="onSearch"
            allow-clear 
          >
            <template #suffix>
              <SearchOutlined class="k8s-search-icon" />
            </template>
          </a-input>
        </div>
      </div>

      <!-- 操作区域 -->
      <div class="k8s-toolbar-actions">
        <div class="k8s-action-buttons">
          <a-button 
            @click="resetFilters" 
            :disabled="!filterStatus && !filterAccessMode && !filterVolumeType && !searchText && !filterClusterId"
            class="k8s-toolbar-btn"
            title="重置所有筛选条件"
          >
            <template #icon><DeleteOutlined /></template>
            重置筛选
          </a-button>
          
          <a-button 
            @click="fetchPVs" 
            :loading="loading"
            class="k8s-toolbar-btn"
            title="刷新数据"
          >
            <template #icon><ReloadOutlined /></template>
            刷新
          </a-button>

          <a-button 
            @click="openCreateYamlModal" 
            :disabled="!filterClusterId"
            class="k8s-toolbar-btn"
            title="通过YAML创建PV"
          >
            <template #icon><FileTextOutlined /></template>
            YAML 创建
          </a-button>
          
          <a-button 
            type="primary" 
            danger 
            @click="deleteBatchPVs" 
            :disabled="!selectedRows.length" 
            v-if="selectedRows.length > 0"
            class="k8s-toolbar-btn"
            title="批量删除选中的 PV"
          >
            <template #icon><DeleteOutlined /></template>
            删除 ({{ selectedRows.length }})
          </a-button>
        </div>
      </div>
    </div>

    <!-- 数据展示区域 -->
    <div class="k8s-data-display">
      <a-table
        :columns="columns"
        :data-source="filteredPVs"
        :loading="loading"
        :pagination="{
          current: currentPage,
          pageSize: pageSize,
          total: total,
          showSizeChanger: true,
          showQuickJumper: true,
          showTotal: (total: number, range: number[]) => `显示 ${range[0]}-${range[1]} 条，共 ${total} 条数据`,
          pageSizeOptions: ['10', '20', '30', '50']
        }"
        :row-selection="rowSelection"
        :scroll="{ x: 1600 }"
        row-key="name"
        class="k8s-table pv-table"
        @change="handleTableChange"
      >
        <template #name="{ record }">
          <div style="display: flex; align-items: center; gap: 8px;">
            <DatabaseOutlined style="color: #1677ff; font-size: 16px;" />
            <span style="font-weight: 500; color: #262626;">{{ record.name }}</span>
          </div>
        </template>

        <template #status="{ text }">
          <a-badge :status="getPVStatusColor(text)" :text="getPVStatusText(text)" />
        </template>

        <template #capacity="{ text }">
          <a-tag color="blue">{{ text }}</a-tag>
        </template>

        <template #access_modes="{ text }">
          <div class="k8s-tags-display">
            <a-tag 
              v-for="mode in text" 
              :key="mode"
              color="green"
              size="small"
            >
              {{ getAccessModeText(mode) }}
            </a-tag>
            <span v-if="!text || text.length === 0" class="k8s-no-data">
              无访问模式
            </span>
          </div>
        </template>

        <template #reclaim_policy="{ text }">
          <a-tag :color="text === 'Retain' ? 'orange' : text === 'Delete' ? 'red' : 'blue'">
            {{ text || '未设置' }}
          </a-tag>
        </template>

        <template #storage_class="{ text }">
          <span v-if="text">{{ text }}</span>
          <span v-else class="k8s-no-data">默认存储类</span>
        </template>

        <template #claim_ref="{ record }">
          <div v-if="record.claim_ref && record.claim_ref.name">
            <a-tag color="cyan">
              {{ record.claim_ref.namespace }}/{{ record.claim_ref.name }}
            </a-tag>
          </div>
          <span v-else class="k8s-no-data">未绑定</span>
        </template>

        <template #labels="{ text }">
          <div class="k8s-labels-display">
            <template v-if="Array.isArray(text)">
              <!-- 数组格式 -->
              <a-tooltip v-for="label in text.slice(0, 3)" :key="label.key" :title="`${label.key}: ${label.value}`">
                <a-tag class="k8s-label-item">
                  {{ label.key }}: {{ label.value }}
                </a-tag>
              </a-tooltip>
              <a-tooltip v-if="text.length > 3" :title="text.map((item: any) => `${item.key}: ${item.value}`).join('\n')">
                <a-tag class="k8s-label-item">
                  {{ text.length }} 个标签
                </a-tag>
              </a-tooltip>
              <span v-if="text.length === 0" class="k8s-no-data">-</span>
            </template>
            <template v-else-if="text && typeof text === 'object'">
              <!-- 对象格式 -->
              <a-tooltip v-for="[key, value] in Object.entries(text).slice(0, 3)" :key="key" :title="`${key}: ${value}`">
                <a-tag class="k8s-label-item">
                  {{ key }}: {{ value }}
                </a-tag>
              </a-tooltip>
              <a-tooltip v-if="Object.keys(text).length > 3" :title="Object.entries(text).map(([k, v]: [string, any]) => `${k}: ${v}`).join('\n')">
                <a-tag class="k8s-label-item">
                  {{ Object.keys(text).length }} 个标签
                </a-tag>
              </a-tooltip>
              <span v-if="Object.keys(text).length === 0" class="k8s-no-data">-</span>
            </template>
            <template v-else>
              <span class="k8s-no-data">-</span>
            </template>
          </div>
        </template>

        <template #created_at="{ text, record }">
          <div>
            <div>{{ text }}</div>
            <small style="color: #8c8c8c;">{{ record.age }}</small>
          </div>
        </template>

        <template #actions="{ record }">
          <div class="k8s-action-column">
            <a-tooltip title="查看详情">
              <a-button title="查看详情" @click="openDetailModal(record)">
                <template #icon><EyeOutlined /></template>
              </a-button>
            </a-tooltip>
            <a-tooltip title="查看 YAML">
              <a-button title="查看 YAML" @click="openYamlModal(record)">
                <template #icon><FileTextOutlined /></template>
              </a-button>
            </a-tooltip>
            <a-tooltip title="编辑">
              <a-button title="编辑" @click="openEditModal(record)">
                <template #icon><EditOutlined /></template>
              </a-button>
            </a-tooltip>
            <a-tooltip title="回收PV" v-if="record.status === K8sPVStatus.Released">
              <a-button title="回收PV" @click="reclaimPV(record)">
                <template #icon><UndoOutlined /></template>
              </a-button>
            </a-tooltip>
            <a-tooltip title="删除">
              <a-button 
                title="删除" 
                danger 
                @click="deletePV(record)"
              >
                <template #icon><DeleteOutlined /></template>
              </a-button>
            </a-tooltip>
          </div>
        </template>

        <template #emptyText>
          <div class="k8s-empty-state">
            <DatabaseOutlined />
            <p>暂无 PV 数据</p>
            <p>请先选择集群</p>
          </div>
        </template>
      </a-table>
    </div>

    <!-- 创建PV模态框 -->
    <a-modal
      v-model:open="isCreateModalVisible"
      title="创建 PersistentVolume"
      :confirm-loading="submitLoading"
      :width="800"
      @ok="createPV"
      @cancel="resetCreateForm"
    >
      <a-form
        ref="formRef"
        :model="createFormModel"
        :rules="createFormRules"
        layout="vertical"
        class="k8s-form"
      >
        <a-row :gutter="16">
          <a-col :span="12">
            <a-form-item label="PV名称" name="name">
              <a-input v-model:value="createFormModel.name" placeholder="输入PV名称" class="k8s-form-input" />
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item label="存储容量" name="capacity">
              <a-input v-model:value="createFormModel.capacity" placeholder="如: 10Gi" class="k8s-form-input" />
            </a-form-item>
          </a-col>
        </a-row>

        <a-row :gutter="16">
          <a-col :span="12">
            <a-form-item label="访问模式" name="access_modes">
              <a-select v-model:value="createFormModel.access_modes" mode="multiple" placeholder="选择访问模式" class="k8s-form-input">
                <a-select-option value="ReadWriteOnce">ReadWriteOnce (RWO)</a-select-option>
                <a-select-option value="ReadOnlyMany">ReadOnlyMany (ROX)</a-select-option>
                <a-select-option value="ReadWriteMany">ReadWriteMany (RWX)</a-select-option>
                <a-select-option value="ReadWriteOncePod">ReadWriteOncePod (RWOP)</a-select-option>
              </a-select>
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item label="回收策略">
              <a-select v-model:value="createFormModel.reclaim_policy" placeholder="选择回收策略" class="k8s-form-input">
                <a-select-option value="Retain">Retain (保留)</a-select-option>
                <a-select-option value="Delete">Delete (删除)</a-select-option>
                <a-select-option value="Recycle">Recycle (回收)</a-select-option>
              </a-select>
            </a-form-item>
          </a-col>
        </a-row>

        <a-row :gutter="16">
          <a-col :span="12">
            <a-form-item label="存储类">
              <a-input v-model:value="createFormModel.storage_class" placeholder="输入存储类名称" class="k8s-form-input" />
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item label="卷模式">
              <a-select v-model:value="createFormModel.volume_mode" placeholder="选择卷模式" class="k8s-form-input">
                <a-select-option value="Filesystem">Filesystem (文件系统)</a-select-option>
                <a-select-option value="Block">Block (块设备)</a-select-option>
              </a-select>
            </a-form-item>
          </a-col>
        </a-row>

        <a-form-item label="卷源配置">
          <div class="k8s-key-value-inputs">
            <div v-for="(value, key) in createFormModel.volume_source" :key="key" class="k8s-key-value-row">
              <a-input :value="key" placeholder="配置键" class="k8s-form-input" @change="(e: any) => { if(key !== e.target.value && e.target.value) { createFormModel.volume_source[e.target.value] = value; delete createFormModel.volume_source[key]; } }" />
              <a-input v-model:value="createFormModel.volume_source[key]" placeholder="配置值" class="k8s-form-input" />
              <a-button type="link" danger @click="removeVolumeSourceItem(key)">
                <template #icon><DeleteOutlined /></template>
              </a-button>
            </div>
            <a-button type="dashed" @click="addVolumeSourceItem" style="width: 100%;">
              <template #icon><PlusOutlined /></template>
              添加卷源配置
            </a-button>
          </div>
        </a-form-item>

        <a-form-item label="标签">
          <div class="k8s-key-value-inputs">
            <div v-if="!createFormModel.labels || Object.keys(createFormModel.labels).length === 0" class="k8s-empty-state">
              <div class="empty-icon">🏷️</div>
              <div class="empty-text">暂无标签，点击下方按钮添加</div>
            </div>
            <div v-for="(value, key) in createFormModel.labels" :key="key" class="k8s-key-value-row">
              <a-input :value="key" placeholder="标签键" class="k8s-form-input" @change="(e: any) => { if(key !== e.target.value && e.target.value) { createFormModel.labels[e.target.value] = value; delete createFormModel.labels[key]; } }" />
              <a-input v-model:value="createFormModel.labels[key]" placeholder="标签值" class="k8s-form-input" />
              <a-button type="text" danger @click="removeLabelItem(key, 'labels')" class="k8s-remove-btn">
                <template #icon><DeleteOutlined /></template>
              </a-button>
            </div>
            <a-button type="dashed" @click="addLabelItem('labels')" block class="k8s-add-btn">
              <template #icon><PlusOutlined /></template>
              添加标签
            </a-button>
          </div>
        </a-form-item>

        <a-form-item label="注解">
          <div class="k8s-key-value-inputs">
            <div v-if="!createFormModel.annotations || Object.keys(createFormModel.annotations).length === 0" class="k8s-empty-state">
              <div class="empty-icon">📝</div>
              <div class="empty-text">暂无注解，点击下方按钮添加</div>
            </div>
            <div v-for="(value, key) in createFormModel.annotations" :key="key" class="k8s-key-value-row">
              <a-input :value="key" placeholder="注解键" class="k8s-form-input" @change="(e: any) => { if(key !== e.target.value && e.target.value) { createFormModel.annotations[e.target.value] = value; delete createFormModel.annotations[key]; } }" />
              <a-input v-model:value="createFormModel.annotations[key]" placeholder="注解值" class="k8s-form-input" />
              <a-button type="text" danger @click="removeLabelItem(key, 'annotations')" class="k8s-remove-btn">
                <template #icon><DeleteOutlined /></template>
              </a-button>
            </div>
            <a-button type="dashed" @click="addLabelItem('annotations')" block class="k8s-add-btn">
              <template #icon><PlusOutlined /></template>
              添加注解
            </a-button>
          </div>
        </a-form-item>
      </a-form>
    </a-modal>

    <!-- YAML创建PV模态框 -->
    <a-modal
      v-model:open="isCreateYamlModalVisible"
      title="通过 YAML 创建 PV"
      :confirm-loading="submitLoading"
      :width="900"
      @ok="createPVByYaml"
      @cancel="resetCreateYamlForm"
    >
      <a-form
        ref="createYamlFormRef"
        :model="createYamlFormModel"
        :rules="createYamlFormRules"
        layout="vertical"
        class="k8s-form"
      >
        <a-form-item label="YAML 配置" name="yaml">
          <a-textarea
            v-model:value="createYamlFormModel.yaml"
            placeholder="请输入 PV 的 YAML 配置..."
            :rows="20"
            class="k8s-config-textarea"
          />
        </a-form-item>
      </a-form>
    </a-modal>

    <!-- 编辑PV模态框 -->
    <a-modal
      v-model:open="isEditModalVisible"
      title="编辑 PersistentVolume"
      :confirm-loading="submitLoading"
      :width="800"
      @ok="updatePV"
      @cancel="resetEditForm"
    >
      <a-form
        ref="formRef"
        :model="editFormModel"
        layout="vertical"
        class="k8s-form"
      >
        <a-row :gutter="16">
          <a-col :span="12">
            <a-form-item label="PV名称">
              <a-input v-model:value="editFormModel.name" disabled class="k8s-form-input" />
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item label="存储容量">
              <a-input v-model:value="editFormModel.capacity" placeholder="如: 10Gi" class="k8s-form-input" />
            </a-form-item>
          </a-col>
        </a-row>

        <a-row :gutter="16">
          <a-col :span="12">
            <a-form-item label="访问模式">
              <a-select v-model:value="editFormModel.access_modes" mode="multiple" placeholder="选择访问模式" class="k8s-form-input">
                <a-select-option value="ReadWriteOnce">ReadWriteOnce (RWO)</a-select-option>
                <a-select-option value="ReadOnlyMany">ReadOnlyMany (ROX)</a-select-option>
                <a-select-option value="ReadWriteMany">ReadWriteMany (RWX)</a-select-option>
                <a-select-option value="ReadWriteOncePod">ReadWriteOncePod (RWOP)</a-select-option>
              </a-select>
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item label="回收策略">
              <a-select v-model:value="editFormModel.reclaim_policy" placeholder="选择回收策略" class="k8s-form-input">
                <a-select-option value="Retain">Retain (保留)</a-select-option>
                <a-select-option value="Delete">Delete (删除)</a-select-option>
                <a-select-option value="Recycle">Recycle (回收)</a-select-option>
              </a-select>
            </a-form-item>
          </a-col>
        </a-row>

        <a-form-item label="标签">
          <div class="k8s-key-value-inputs">
            <div v-for="(_value, key) in editFormModel.labels" :key="key" class="k8s-key-value-row">
              <a-input :value="key" placeholder="标签键" class="k8s-form-input" @blur="(e: any) => updateEditLabelKey(key, e.target.value, 'labels')" />
              <a-input v-model:value="editFormModel.labels[key]" placeholder="标签值" class="k8s-form-input" />
              <a-button type="link" danger @click="removeEditLabelItem(key, 'labels')">
                <template #icon><DeleteOutlined /></template>
              </a-button>
            </div>
            <a-button type="dashed" @click="addEditLabelItem('labels')" style="width: 100%;">
              <template #icon><PlusOutlined /></template>
              添加标签
            </a-button>
          </div>
        </a-form-item>

        <a-form-item label="注解">
          <div class="k8s-key-value-inputs">
            <div v-for="(_value, key) in editFormModel.annotations" :key="key" class="k8s-key-value-row">
              <a-input :value="key" placeholder="注解键" class="k8s-form-input" @blur="(e: any) => updateEditLabelKey(key, e.target.value, 'annotations')" />
              <a-input v-model:value="editFormModel.annotations[key]" placeholder="注解值" class="k8s-form-input" />
              <a-button type="link" danger @click="removeEditLabelItem(key, 'annotations')">
                <template #icon><DeleteOutlined /></template>
              </a-button>
            </div>
            <a-button type="dashed" @click="addEditLabelItem('annotations')" style="width: 100%;">
              <template #icon><PlusOutlined /></template>
              添加注解
            </a-button>
          </div>
        </a-form-item>
      </a-form>
    </a-modal>

    <!-- PV详情模态框 -->
    <a-modal
      v-model:open="isDetailModalVisible"
      :title="`PV 详情: ${currentOperationPV?.name}`"
      :footer="null"
      :width="900"
      class="k8s-detail-modal"
    >
      <div class="k8s-detail-content" v-if="currentPVDetail">
        <a-card title="基本信息" size="small" class="k8s-detail-card">
          <div class="k8s-detail-item">
            <span class="k8s-detail-label">名称:</span>
            <span class="k8s-detail-value">{{ currentPVDetail.name }}</span>
          </div>
          <div class="k8s-detail-item">
            <span class="k8s-detail-label">UID:</span>
            <span class="k8s-detail-value">{{ currentPVDetail.uid }}</span>
          </div>
          <div class="k8s-detail-item">
            <span class="k8s-detail-label">状态:</span>
            <span class="k8s-detail-value">
              <a-badge :status="getPVStatusColor(currentPVDetail.status)" :text="getPVStatusText(currentPVDetail.status)" />
            </span>
          </div>
          <div class="k8s-detail-item">
            <span class="k8s-detail-label">存储容量:</span>
            <span class="k8s-detail-value">
              <a-tag color="blue">{{ currentPVDetail.capacity }}</a-tag>
            </span>
          </div>
          <div class="k8s-detail-item">
            <span class="k8s-detail-label">访问模式:</span>
            <span class="k8s-detail-value">
              <a-tag v-for="mode in currentPVDetail.access_modes" :key="mode" color="green">
                {{ getAccessModeText(mode) }}
              </a-tag>
            </span>
          </div>
          <div class="k8s-detail-item">
            <span class="k8s-detail-label">回收策略:</span>
            <span class="k8s-detail-value">
              <a-tag :color="currentPVDetail.reclaim_policy === 'Retain' ? 'orange' : currentPVDetail.reclaim_policy === 'Delete' ? 'red' : 'blue'">
                {{ currentPVDetail.reclaim_policy }}
              </a-tag>
            </span>
          </div>
          <div class="k8s-detail-item">
            <span class="k8s-detail-label">存储类:</span>
            <span class="k8s-detail-value">{{ currentPVDetail.storage_class || '默认存储类' }}</span>
          </div>
          <div class="k8s-detail-item">
            <span class="k8s-detail-label">卷模式:</span>
            <span class="k8s-detail-value">{{ currentPVDetail.volume_mode }}</span>
          </div>
          <div class="k8s-detail-item">
            <span class="k8s-detail-label">创建时间:</span>
            <span class="k8s-detail-value">{{ currentPVDetail.created_at }} ({{ currentPVDetail.age }})</span>
          </div>
        </a-card>

        <a-card title="绑定信息" size="small" class="k8s-detail-card" v-if="currentPVDetail.claim_ref && Object.keys(currentPVDetail.claim_ref).length > 0">
          <div class="k8s-detail-item" v-for="(value, key) in currentPVDetail.claim_ref" :key="key">
            <span class="k8s-detail-label">{{ key }}:</span>
            <span class="k8s-detail-value">{{ value }}</span>
          </div>
        </a-card>

        <a-card title="卷源配置" size="small" class="k8s-detail-card" v-if="currentPVDetail.volume_source && Object.keys(currentPVDetail.volume_source).length > 0">
          <div class="k8s-detail-item" v-for="(value, key) in currentPVDetail.volume_source" :key="key">
            <span class="k8s-detail-label">{{ key }}:</span>
            <span class="k8s-detail-value">{{ typeof value === 'object' ? JSON.stringify(value, null, 2) : value }}</span>
          </div>
        </a-card>

        <a-card title="标签" size="small" class="k8s-detail-card">
          <div class="k8s-labels-display">
            <template v-if="currentPVDetail.labels && Object.keys(currentPVDetail.labels).length > 0">
              <a-tooltip v-for="(value, key) in currentPVDetail.labels" :key="key" :title="`${key}: ${value}`">
                <span class="k8s-label-item">
                  <span class="k8s-label-key">{{ key }}</span>
                  <span class="k8s-label-separator">:</span>
                  <span class="k8s-label-value">{{ value }}</span>
                </span>
              </a-tooltip>
            </template>
            <span v-else class="k8s-no-data">暂无标签</span>
          </div>
        </a-card>

        <a-card title="注解" size="small" class="k8s-detail-card">
          <div class="k8s-annotations-display">
            <template v-if="currentPVDetail.annotations && Object.keys(currentPVDetail.annotations).length > 0">
              <div v-for="(value, key) in currentPVDetail.annotations" :key="key" class="k8s-annotation-item">
                <span class="k8s-annotation-key">{{ key }}</span>
                <span class="k8s-annotation-separator">:</span>
                <span class="k8s-annotation-value">{{ value }}</span>
              </div>
            </template>
            <span v-else class="k8s-no-data">暂无注解</span>
          </div>
        </a-card>
      </div>
      <div v-else-if="detailLoading" style="text-align: center; padding: 50px;">
        <a-spin size="large" />
        <p style="margin-top: 16px; color: #8c8c8c;">加载详情中...</p>
      </div>
    </a-modal>

    <!-- YAML编辑模态框 -->
    <a-modal
      v-model:open="isYamlModalVisible"
      :title="`编辑 PV YAML: ${currentOperationPV?.name}`"
      :confirm-loading="submitLoading"
      :width="900"
      @ok="updatePVByYaml"
      @cancel="resetYamlForm"
    >
      <a-form
        ref="yamlFormRef"
        :model="yamlFormModel"
        :rules="yamlFormRules"
        layout="vertical"
        class="k8s-form"
      >
        <a-form-item label="YAML 配置" name="yaml">
          <a-textarea
            v-model:value="yamlFormModel.yaml"
            placeholder="加载 YAML 配置中..."
            :rows="20"
            class="k8s-config-textarea"
          />
        </a-form-item>
      </a-form>
    </a-modal>
  </div>
</template>

<script setup lang="ts">
import { onMounted } from 'vue';
import {
  PlusOutlined,
  ReloadOutlined,
  DatabaseOutlined,
  FilterOutlined,
  KeyOutlined,
  CloudServerOutlined,
  SearchOutlined,
  DeleteOutlined,
  FileTextOutlined,
  EyeOutlined,
  EditOutlined,
  UndoOutlined,
} from '@ant-design/icons-vue';
import { usePVPage } from './PV';

const {
  // state
  clusters,
  loading,
  clustersLoading,
  searchText,
  filterClusterId,
  filterStatus,
  filterAccessMode,
  filterVolumeType,
  selectedRows,
  currentPage,
  pageSize,
  total,
  clustersTotal,
  
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
  
  // current operation
  currentOperationPV,
  currentPVDetail,
  
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
  filteredPVs,
  rowSelection,
  
  // helpers
  getEnvText,
  getPVStatusText,
  getPVStatusColor,
  getAccessModeText,
  
  // api calls
  fetchClusters,
  fetchPVs,
  createPV,
  createPVByYaml,
  updatePV,
  updatePVByYaml,
  deletePV,
  reclaimPV,
  deleteBatchPVs,
  
  
  // modal handlers
  openCreateModal,
  openCreateYamlModal,
  openEditModal,
  openDetailModal,
  openYamlModal,
  
  // form helpers
  resetCreateForm,
  resetEditForm,
  resetYamlForm,
  resetCreateYamlForm,
  
  // filter handlers
  handleClusterChange,
  handleFilterChange,
  handleClusterDropdownScroll,
  
  // label/annotation helpers
  addLabelItem,
  removeLabelItem,
  addEditLabelItem,
  removeEditLabelItem,
  updateEditLabelKey,
  
  // volume source helpers
  addVolumeSourceItem,
  removeVolumeSourceItem,
  
  // constants
  K8sPVStatus,
} = usePVPage();

const columns = [
  { title: 'PV名称', dataIndex: 'name', key: 'name', width: '12%', slots: { customRender: 'name' } },
  { title: '状态', dataIndex: 'status', key: 'status', width: '8%', slots: { customRender: 'status' } },
  { title: '容量', dataIndex: 'capacity', key: 'capacity', width: '8%', slots: { customRender: 'capacity' } },
  { title: '访问模式', dataIndex: 'access_modes', key: 'access_modes', width: '12%', slots: { customRender: 'access_modes' } },
  { title: '回收策略', dataIndex: 'reclaim_policy', key: 'reclaim_policy', width: '8%', slots: { customRender: 'reclaim_policy' } },
  { title: '存储类', dataIndex: 'storage_class', key: 'storage_class', width: '10%', slots: { customRender: 'storage_class' } },
  { title: '绑定PVC', dataIndex: 'claim_ref', key: 'claim_ref', width: '12%', slots: { customRender: 'claim_ref' } },
  { title: '标签', dataIndex: 'labels', key: 'labels', width: '12%', slots: { customRender: 'labels' } },
  { title: '创建时间', dataIndex: 'created_at', key: 'created_at', width: '10%', slots: { customRender: 'created_at' } },
  { title: '操作', key: 'actions', width: '18%', fixed: 'right', slots: { customRender: 'actions' } },
];

// 搜索功能
const onSearch = () => {
  currentPage.value = 1;
  fetchPVs();
};

// 重置所有筛选条件
const resetFilters = () => {
  filterStatus.value = undefined;
  filterAccessMode.value = undefined;
  filterVolumeType.value = undefined;
  searchText.value = '';
  filterClusterId.value = undefined;
  currentPage.value = 1;
  fetchPVs();
};

// 表格变化处理
const handleTableChange = (pagination: { current?: number; pageSize?: number }) => {
  if (pagination) {
    currentPage.value = pagination.current || currentPage.value;
    if (pagination.pageSize) {
      pageSize.value = pagination.pageSize;
    }
    fetchPVs();
  }
};

// 页面初始化
onMounted(async () => {
  await fetchClusters();
});
</script>

<style scoped>
@import '../shared/k8s-common.css';
</style>

<style scoped src="./PV.css"></style>

