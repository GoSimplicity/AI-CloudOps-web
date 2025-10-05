<template>
  <div class="k8s-management-container">
    <!-- 页面头部 -->
    <div class="k8s-page-header">
      <a-row class="k8s-header-content" :gutter="[24, 16]">
        <a-col :xs="24" :sm="24" :md="16" :lg="16" :xl="18">
          <div class="k8s-title-section">
            <div class="k8s-page-title">
              <InboxOutlined class="k8s-title-icon" />
              <div>
                <h1>PersistentVolumeClaim 管理</h1>
                <p class="k8s-page-subtitle">管理和监控集群中的所有 Kubernetes PersistentVolumeClaim 持久化卷声明</p>
              </div>
            </div>
          </div>
        </a-col>
        <a-col :xs="24" :sm="24" :md="8" :lg="8" :xl="6">
          <div class="k8s-header-actions">
            <a-button type="primary" @click="openCreateModal" :disabled="!filterClusterId">
              <template #icon><PlusOutlined /></template>
              创建 PVC
            </a-button>
            <a-button @click="fetchPVCs" :loading="loading">
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
            <template #suffixIcon><CloudServerOutlined /></template>
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
            v-model:value="filterNamespace" 
            placeholder="选择命名空间" 
            class="k8s-filter-select" 
            allow-clear 
            @change="handleFilterChange"
            :disabled="!filterClusterId"
            :loading="namespacesLoading"
          >
            <template #suffixIcon><AppstoreOutlined /></template>
            <a-select-option v-for="ns in namespaces" :key="ns.name" :value="ns.name">
              {{ ns.name }}
            </a-select-option>
            <a-select-option 
              v-if="namespaces.length > 0 && namespaces.length < namespacesTotal" 
              :value="'__load_more_namespaces__'" 
              disabled
              style="text-align: center; color: #999;"
            >
              <a-button type="link" size="small" @click.stop="loadMoreNamespaces" :loading="namespacesLoading">
                加载更多...
              </a-button>
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
            <a-select-option :value="K8sPVCStatus.Pending">等待中</a-select-option>
            <a-select-option :value="K8sPVCStatus.Bound">已绑定</a-select-option>
            <a-select-option :value="K8sPVCStatus.Lost">丢失</a-select-option>
            <a-select-option :value="K8sPVCStatus.Terminating">终止中</a-select-option>
            <a-select-option :value="K8sPVCStatus.Unknown">未知</a-select-option>
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
        </div>

        <div class="k8s-search-group">
          <a-input 
            v-model:value="searchText" 
            placeholder="搜索 PVC 名称" 
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
            :disabled="!filterStatus && !filterAccessMode && !searchText && !filterClusterId && !filterNamespace"
            class="k8s-toolbar-btn"
            title="重置所有筛选条件"
          >
            <template #icon><DeleteOutlined /></template>
            重置筛选
          </a-button>
          
          <a-button 
            @click="fetchPVCs" 
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
            title="通过YAML创建PVC"
          >
            <template #icon><FileTextOutlined /></template>
            YAML 创建
          </a-button>
          
          <a-button 
            type="primary" 
            danger 
            @click="deleteBatchPVCs" 
            :disabled="!selectedRows.length" 
            v-if="selectedRows.length > 0"
            class="k8s-toolbar-btn"
            title="批量删除选中的 PVC"
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
        :data-source="filteredPVCs"
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
        class="k8s-table pvc-table"
        @change="handleTableChange"
      >
        <template #name="{ record }">
          <div style="display: flex; align-items: center; gap: 8px;">
            <InboxOutlined style="color: #1677ff; font-size: 16px;" />
            <span style="font-weight: 500; color: #262626;">{{ record.name }}</span>
          </div>
        </template>

        <template #namespace="{ text }">
          <a-tag color="blue">{{ text }}</a-tag>
        </template>

        <template #status="{ text }">
          <a-badge :status="getPVCStatusColor(text)" :text="getPVCStatusText(text)" />
        </template>

        <template #capacity="{ record }">
          <div class="pvc-capacity-info">
            <div class="pvc-capacity-item">
              <span class="pvc-capacity-label">实际:</span>
              <a-tag color="green">{{ record.capacity || '未分配' }}</a-tag>
            </div>
            <div class="pvc-capacity-item">
              <span class="pvc-capacity-label">请求:</span>
              <a-tag color="blue">{{ record.request_storage }}</a-tag>
            </div>
          </div>
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

        <template #storage_class="{ text }">
          <span v-if="text">{{ text }}</span>
          <span v-else class="k8s-no-data">默认存储类</span>
        </template>

        <template #volume_name="{ text }">
          <div v-if="text">
            <a-tag color="purple">{{ text }}</a-tag>
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

        <template #annotations="{ text }">
          <div class="k8s-annotations-display">
            <template v-if="Array.isArray(text)">
              <a-tooltip v-if="text.length > 0" :title="text.map((item: any) => `${item.key}: ${item.value}`).join('\n')">
                <a-tag class="k8s-annotation-item" color="purple">{{ text.length }} 个注解</a-tag>
              </a-tooltip>
              <span v-else class="k8s-no-data">-</span>
            </template>
            <template v-else-if="text && typeof text === 'object'">
              <a-tooltip v-if="Object.keys(text).length > 0" :title="Object.entries(text).map(([k, v]: [string, any]) => `${k}: ${v}`).join('\n')">
                <a-tag class="k8s-annotation-item" color="purple">{{ Object.keys(text).length }} 个注解</a-tag>
              </a-tooltip>
              <span v-else class="k8s-no-data">-</span>
            </template>
            <template v-else>
              <span class="k8s-no-data">-</span>
            </template>
          </div>
        </template>

        <template #uid="{ text }">
          <a-tooltip v-if="text" :title="text">
            <span class="k8s-uid-text" style="font-family: monospace; font-size: 11px; color: #666;">
              {{ text.substring(0, 8) }}...
            </span>
          </a-tooltip>
          <span v-else class="k8s-no-data">-</span>
        </template>

        <template #createdAt="{ text }">
          <div v-if="text" style="font-size: 12px; color: #666;">
            <div>{{ formatDateTime(text) }}</div>
            <div style="color: #999; font-size: 11px; margin-top: 2px;">{{ getRelativeTime(text) }}</div>
          </div>
          <span v-else class="k8s-no-data">-</span>
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
            <a-tooltip title="扩容PVC" v-if="record.status === K8sPVCStatus.Bound">
              <a-button title="扩容PVC" @click="openExpandModal(record)">
                <template #icon><ExpandOutlined /></template>
              </a-button>
            </a-tooltip>
            <a-tooltip title="查看关联Pod">
              <a-button title="查看关联Pod" @click="openPodsModal(record)">
                <template #icon><ContainerOutlined /></template>
              </a-button>
            </a-tooltip>
            <a-tooltip title="删除">
              <a-button 
                title="删除" 
                danger 
                @click="deletePVC(record)"
              >
                <template #icon><DeleteOutlined /></template>
              </a-button>
            </a-tooltip>
          </div>
        </template>

        <template #emptyText>
          <div class="k8s-empty-state">
            <InboxOutlined />
            <p>暂无 PVC 数据</p>
            <p>请先选择集群</p>
          </div>
        </template>
      </a-table>
    </div>

    <!-- 创建PVC模态框 -->
    <a-modal
      v-model:open="isCreateModalVisible"
      title="创建 PersistentVolumeClaim"
      :confirm-loading="submitLoading"
      :width="800"
      @ok="createPVC"
      @cancel="resetCreateForm"
      :maskClosable="false"
      destroyOnClose
      okText="创建"
      cancelText="取消"
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
            <a-form-item label="PVC名称" name="name" :required="true">
              <a-input 
                v-model:value="createFormModel.name" 
                placeholder="请输入 PVC 名称（例如：pvc-web-data）" 
                class="k8s-form-input"
                :maxlength="63"
              />
              <div style="color: #999; font-size: 12px; margin-top: 4px;">
                只能包含小写字母、数字和连字符，且不能以连字符开头或结尾
              </div>
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item label="命名空间" name="namespace" :required="true">
              <a-select 
                v-model:value="createFormModel.namespace" 
                placeholder="请选择命名空间" 
                class="k8s-form-input"
                :disabled="!filterClusterId"
              >
                <a-select-option v-for="ns in namespaces" :key="ns.name" :value="ns.name">
                  {{ ns.name }}
                </a-select-option>
              </a-select>
              <div style="color: #999; font-size: 12px; margin-top: 4px;">
                PVC 必须属于某个命名空间
              </div>
            </a-form-item>
          </a-col>
        </a-row>

        <a-row :gutter="16">
          <a-col :span="12">
            <a-form-item label="请求存储" :name="['spec', 'request_storage']" :required="true">
              <a-input 
                v-model:value="createFormModel.spec.request_storage" 
                placeholder="如: 10Gi, 500Mi, 1Ti" 
                class="k8s-form-input"
                :maxlength="20"
              />
              <div style="color: #999; font-size: 12px; margin-top: 4px;">
                请求的存储容量大小
              </div>
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item label="访问模式" :name="['spec', 'access_modes']" :required="true">
              <a-select 
                v-model:value="createFormModel.spec.access_modes" 
                mode="multiple" 
                placeholder="选择访问模式" 
                class="k8s-form-input"
                :maxTagCount="1"
              >
                <a-select-option value="ReadWriteOnce">ReadWriteOnce (RWO)</a-select-option>
                <a-select-option value="ReadOnlyMany">ReadOnlyMany (ROX)</a-select-option>
                <a-select-option value="ReadWriteMany">ReadWriteMany (RWX)</a-select-option>
                <a-select-option value="ReadWriteOncePod">ReadWriteOncePod (RWOP)</a-select-option>
              </a-select>
              <div style="color: #999; font-size: 12px; margin-top: 4px;">
                定义 PVC 可以请求的访问方式，可多选
              </div>
            </a-form-item>
          </a-col>
        </a-row>

        <a-row :gutter="16">
          <a-col :span="12">
            <a-form-item label="存储类">
              <a-input 
                v-model:value="createFormModel.spec.storage_class" 
                placeholder="输入存储类名称（可选）" 
                class="k8s-form-input"
                :maxlength="253"
              />
              <div style="color: #999; font-size: 12px; margin-top: 4px;">
                留空表示使用默认存储类
              </div>
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item label="卷模式">
              <a-select v-model:value="createFormModel.spec.volume_mode" placeholder="选择卷模式" class="k8s-form-input">
                <a-select-option value="Filesystem">Filesystem (文件系统)</a-select-option>
                <a-select-option value="Block">Block (块设备)</a-select-option>
              </a-select>
              <div style="color: #999; font-size: 12px; margin-top: 4px;">
                默认为 Filesystem 模式
              </div>
            </a-form-item>
          </a-col>
        </a-row>

        <a-row :gutter="16">
          <a-col :span="24">
            <a-form-item label="绑定PV（可选）">
              <a-select 
                v-model:value="createFormModel.spec.volume_name" 
                placeholder="留空将自动选择合适的 PV" 
                class="k8s-form-input"
                allow-clear
                show-search
                :loading="pvsLoading"
                :filter-option="(input: string, option: any) => {
                  if (!input || !option?.label) return true;
                  return option.label.toLowerCase().includes(input.toLowerCase());
                }"
                @popup-scroll="handlePVDropdownScroll"
                :dropdown-match-select-width="false"
                :dropdown-style="{ minWidth: '550px', maxWidth: '650px' }"
                :options="pvOptions"
              >
                <template #option="{ value, label, capacity, accessModes }">
                  <div 
                    v-if="value === '__load_more_pvs__'" 
                    style="text-align: center; color: #999; padding: 8px 0;"
                  >
                    <a-spin size="small" :spinning="pvsLoading" />
                    <span v-if="!pvsLoading" style="margin-left: 8px;">滚动加载更多...</span>
                  </div>
                  <div 
                    v-else
                    style="
                      display: flex; 
                      align-items: center; 
                      justify-content: space-between; 
                      gap: 12px; 
                      padding: 6px 4px;
                      min-height: 32px;
                    "
                  >
                    <span 
                      style="
                        flex: 1; 
                        min-width: 0; 
                        overflow: hidden; 
                        text-overflow: ellipsis; 
                        white-space: nowrap; 
                        font-weight: 500;
                        color: #262626;
                      "
                      :title="label"
                    >
                      {{ label }}
                    </span>
                    <div style="flex: 0 0 auto; display: flex; align-items: center; gap: 6px;">
                      <a-tag color="blue" size="small" style="margin: 0; font-size: 12px;">
                        {{ capacity }}
                      </a-tag>
                      <a-tag 
                        v-for="(mode, idx) in (accessModes || []).slice(0, 2)" 
                        :key="idx" 
                        color="green" 
                        size="small"
                        style="margin: 0; font-size: 11px;"
                      >
                        {{ mode === 'ReadWriteOnce' ? 'RWO' : mode === 'ReadOnlyMany' ? 'ROX' : mode === 'ReadWriteMany' ? 'RWX' : 'RWOP' }}
                      </a-tag>
                      <a-tooltip 
                        v-if="(accessModes || []).length > 2" 
                        :title="(accessModes || []).slice(2).map((m: string) => m === 'ReadWriteOnce' ? 'RWO' : m === 'ReadOnlyMany' ? 'ROX' : m === 'ReadWriteMany' ? 'RWX' : 'RWOP').join(', ')"
                      >
                        <a-tag size="small" style="margin: 0; cursor: help; font-size: 11px;">
                          +{{ (accessModes || []).length - 2 }}
                        </a-tag>
                      </a-tooltip>
                    </div>
                  </div>
                </template>
              </a-select>
              <div style="color: #999; font-size: 12px; margin-top: 4px; line-height: 1.5;">
                <span v-if="availablePVs.length > 0">
                  已加载 <strong style="color: #1890ff;">{{ availablePVs.length }}</strong> / <strong>{{ pvsTotal }}</strong> 个可用 PV
                </span>
                <span v-else-if="pvsLoading">
                  正在加载可用的 PV...
                </span>
                <span v-else>
                  当前集群暂无可用 PV，留空将自动匹配或动态创建
                </span>
              </div>
            </a-form-item>
          </a-col>
        </a-row>

        <a-form-item label="PV选择器（可选）">
          <div class="k8s-key-value-inputs">
            <div v-if="!createFormModel.spec.selector || Object.keys(createFormModel.spec.selector).length === 0" style="text-align: center; color: #999; padding: 16px;">
              暂无选择器，点击下方按钮添加
            </div>
            <div v-for="(_value, key) in createFormModel.spec.selector" :key="key" class="k8s-key-value-row">
              <a-input 
                :value="key" 
                placeholder="选择器键" 
                class="k8s-form-input"
                disabled
                :maxlength="63"
              />
              <a-input 
                v-model:value="createFormModel.spec.selector[key]" 
                placeholder="选择器值" 
                class="k8s-form-input"
                :maxlength="63"
              />
              <a-button type="text" danger @click="removeSelectorItem(key)" size="small" class="k8s-remove-btn">
                <template #icon><DeleteOutlined /></template>
              </a-button>
            </div>
            <div class="add-input-row" style="margin-top: 8px;">
              <a-input
                v-model:value="newSelectorKey"
                placeholder="选择器键"
                style="flex: 1; margin-right: 8px;"
                @press-enter="addSelectorItem"
              />
              <a-input
                v-model:value="newSelectorValue"
                placeholder="选择器值"
                style="flex: 1; margin-right: 8px;"
                @press-enter="addSelectorItem"
              />
              <a-button type="primary" @click="addSelectorItem" :disabled="!newSelectorKey.trim()">
                <template #icon><PlusOutlined /></template>
                添加
              </a-button>
            </div>
          </div>
          <div style="color: #999; font-size: 12px; margin-top: 4px;">
            通过标签选择器筛选符合条件的 PV
          </div>
        </a-form-item>

        <a-form-item label="标签配置（可选）">
          <a-form-item-rest>
            <div class="k8s-key-value-inputs">
              <div v-if="!createFormModel.labels || Object.keys(createFormModel.labels).length === 0" style="text-align: center; color: #999; padding: 16px;">
                暂无标签，点击下方按钮添加
              </div>
              <div v-for="(_value, key) in createFormModel.labels" :key="key" class="k8s-key-value-row">
                <a-input 
                  :value="key" 
                  placeholder="标签键" 
                  class="k8s-form-input"
                  disabled
                  :maxlength="63"
                />
                <a-input 
                  v-model:value="createFormModel.labels[key]" 
                  placeholder="标签值" 
                  class="k8s-form-input"
                  :maxlength="63"
                />
                <a-button type="text" danger @click="removeLabelItem(key, 'labels')" size="small" class="k8s-remove-btn">
                  <template #icon><DeleteOutlined /></template>
                </a-button>
              </div>
              <div class="add-input-row" style="margin-top: 8px;">
                <a-input
                  v-model:value="newLabelKey"
                  placeholder="标签键"
                  style="flex: 1; margin-right: 8px;"
                  @press-enter="addLabelItem('labels')"
                />
                <a-button type="primary" @click="addLabelItem('labels')" :disabled="!newLabelKey.trim()">
                  <template #icon><PlusOutlined /></template>
                  添加标签
                </a-button>
              </div>
            </div>
          </a-form-item-rest>
        </a-form-item>

        <a-form-item label="注解配置（可选）">
          <a-form-item-rest>
            <div class="k8s-key-value-inputs">
              <div v-if="!createFormModel.annotations || Object.keys(createFormModel.annotations).length === 0" style="text-align: center; color: #999; padding: 16px;">
                暂无注解，点击下方按钮添加
              </div>
              <div v-for="(_value, key) in createFormModel.annotations" :key="key" class="k8s-key-value-row">
                <a-input 
                  :value="key" 
                  placeholder="注解键" 
                  class="k8s-form-input"
                  disabled
                  :maxlength="253"
                />
                <a-input 
                  v-model:value="createFormModel.annotations[key]" 
                  placeholder="注解值" 
                  class="k8s-form-input"
                  :maxlength="500"
                />
                <a-button type="text" danger @click="removeLabelItem(key, 'annotations')" size="small" class="k8s-remove-btn">
                  <template #icon><DeleteOutlined /></template>
                </a-button>
              </div>
              <div class="add-input-row" style="margin-top: 8px;">
                <a-input
                  v-model:value="newAnnotationKey"
                  placeholder="注解键"
                  style="flex: 1; margin-right: 8px;"
                  @press-enter="addLabelItem('annotations')"
                />
                <a-button type="primary" @click="addLabelItem('annotations')" :disabled="!newAnnotationKey.trim()">
                  <template #icon><PlusOutlined /></template>
                  添加注解
                </a-button>
              </div>
            </div>
          </a-form-item-rest>
        </a-form-item>
      </a-form>
    </a-modal>

    <!-- YAML创建PVC模态框 -->
    <a-modal
      v-model:open="isCreateYamlModalVisible"
      title="通过 YAML 创建 PVC"
      :confirm-loading="submitLoading"
      :width="900"
      @ok="createPVCByYaml"
      @cancel="resetCreateYamlForm"
      :maskClosable="false"
      destroyOnClose
      okText="创建"
      cancelText="取消"
    >
      <a-form
        ref="createYamlFormRef"
        :model="createYamlFormModel"
        :rules="createYamlFormRules"
        layout="vertical"
        class="k8s-form"
      >
        <a-form-item name="yaml">
          <div class="yaml-toolbar">
            <a-button class="yaml-toolbar-btn yaml-btn-template" @click="insertYamlTemplate">
              <template #icon><FileAddOutlined /></template>
              插入模板
            </a-button>
            <a-button class="yaml-toolbar-btn yaml-btn-format" @click="formatYaml">
              <template #icon><FormatPainterOutlined /></template>
              格式化
            </a-button>
            <a-button class="yaml-toolbar-btn yaml-btn-validate" @click="validateYaml">
              <template #icon><CheckCircleOutlined /></template>
              检查格式
            </a-button>
            <a-button class="yaml-toolbar-btn yaml-btn-clear" @click="clearYaml">
              <template #icon><ClearOutlined /></template>
              清空
            </a-button>
          </div>
          <a-textarea
            v-model:value="createYamlFormModel.yaml"
            placeholder="请输入 PVC 的 YAML 配置，或点击【插入模板】使用默认模板"
            :rows="20"
            class="k8s-config-textarea"
          />
        </a-form-item>
      </a-form>
    </a-modal>

    <!-- 编辑PVC模态框 -->
    <a-modal
      v-model:open="isEditModalVisible"
      title="编辑 PersistentVolumeClaim"
      :confirm-loading="submitLoading"
      :width="800"
      @ok="updatePVC"
      @cancel="resetEditForm"
      :maskClosable="false"
      destroyOnClose
      okText="保存"
      cancelText="取消"
    >
      <a-form
        ref="formRef"
        :model="editFormModel"
        layout="vertical"
        class="k8s-form"
      >
        <a-row :gutter="16">
          <a-col :span="12">
            <a-form-item label="PVC名称">
              <a-input v-model:value="editFormModel.name" disabled class="k8s-form-input" />
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item label="命名空间">
              <a-input v-model:value="editFormModel.namespace" disabled class="k8s-form-input" />
            </a-form-item>
          </a-col>
        </a-row>

        <a-row :gutter="16">
          <a-col :span="12">
            <a-form-item label="请求存储（只读）">
              <a-input v-model:value="editFormModel.spec.request_storage" disabled class="k8s-form-input" />
              <div style="color: #999; font-size: 12px; margin-top: 4px;">
                创建后不可修改，如需扩容请使用扩容功能
              </div>
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item label="存储类（只读）">
              <a-input v-model:value="editFormModel.spec.storage_class" placeholder="默认存储类" disabled class="k8s-form-input" />
            </a-form-item>
          </a-col>
        </a-row>

        <a-row :gutter="16">
          <a-col :span="12">
            <a-form-item label="访问模式（只读）">
              <div style="display: flex; gap: 8px; flex-wrap: wrap;">
                <a-tag 
                  v-for="mode in editFormModel.spec.access_modes" 
                  :key="mode" 
                  color="green"
                >
                  {{ mode === 'ReadWriteOnce' ? 'RWO' : mode === 'ReadOnlyMany' ? 'ROX' : mode === 'ReadWriteMany' ? 'RWX' : 'RWOP' }}
                </a-tag>
                <span v-if="!editFormModel.spec.access_modes || editFormModel.spec.access_modes.length === 0">-</span>
              </div>
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item label="卷模式（只读）">
              <a-input v-model:value="editFormModel.spec.volume_mode" disabled class="k8s-form-input" />
            </a-form-item>
          </a-col>
        </a-row>

        <a-form-item label="绑定PV（只读）">
          <a-input v-model:value="editFormModel.spec.volume_name" placeholder="未绑定" disabled class="k8s-form-input" />
        </a-form-item>

        <a-form-item label="标签">
          <div class="k8s-key-value-inputs">
            <div v-if="!editFormModel.labels || Object.keys(editFormModel.labels).length === 0" style="text-align: center; color: #999; padding: 16px;">
              暂无标签，点击下方按钮添加
            </div>
            <div v-for="(_value, key) in editFormModel.labels" :key="key" class="k8s-key-value-row">
              <a-input 
                :value="key" 
                placeholder="标签键" 
                class="k8s-form-input" 
                disabled
                :maxlength="63"
              />
              <a-input 
                v-model:value="editFormModel.labels[key]" 
                placeholder="标签值" 
                class="k8s-form-input"
                :maxlength="63"
              />
              <a-button type="text" danger @click="removeEditLabelItem(key, 'labels')" size="small" class="k8s-remove-btn">
                <template #icon><DeleteOutlined /></template>
              </a-button>
            </div>
            <div class="add-input-row" style="margin-top: 8px;">
              <a-input
                v-model:value="newEditLabelKey"
                placeholder="标签键"
                style="flex: 1; margin-right: 8px;"
                @press-enter="addEditLabelItem('labels')"
              />
              <a-button type="primary" @click="addEditLabelItem('labels')" :disabled="!newEditLabelKey.trim()">
                <template #icon><PlusOutlined /></template>
                添加标签
              </a-button>
            </div>
          </div>
        </a-form-item>

        <a-form-item label="注解">
          <div class="k8s-key-value-inputs">
            <div v-if="!editFormModel.annotations || Object.keys(editFormModel.annotations).length === 0" style="text-align: center; color: #999; padding: 16px;">
              暂无注解，点击下方按钮添加
            </div>
            <div v-for="(_value, key) in editFormModel.annotations" :key="key" class="k8s-key-value-row">
              <a-input 
                :value="key" 
                placeholder="注解键" 
                class="k8s-form-input"
                disabled
                :maxlength="253"
              />
              <a-input 
                v-model:value="editFormModel.annotations[key]" 
                placeholder="注解值" 
                class="k8s-form-input"
                :maxlength="500"
              />
              <a-button type="text" danger @click="removeEditLabelItem(key, 'annotations')" size="small" class="k8s-remove-btn">
                <template #icon><DeleteOutlined /></template>
              </a-button>
            </div>
            <div class="add-input-row" style="margin-top: 8px;">
              <a-input
                v-model:value="newEditAnnotationKey"
                placeholder="注解键"
                style="flex: 1; margin-right: 8px;"
                @press-enter="addEditLabelItem('annotations')"
              />
              <a-button type="primary" @click="addEditLabelItem('annotations')" :disabled="!newEditAnnotationKey.trim()">
                <template #icon><PlusOutlined /></template>
                添加注解
              </a-button>
            </div>
          </div>
        </a-form-item>
      </a-form>
    </a-modal>

    <!-- PVC详情模态框 -->
    <a-modal
      v-model:open="isDetailModalVisible"
      :title="`PVC 详情: ${currentOperationPVC?.name}`"
      :footer="null"
      :width="900"
      class="k8s-detail-modal"
      :maskClosable="false"
      destroyOnClose
    >
      <div class="k8s-detail-content" v-if="currentPVCDetail">
        <a-card title="基本信息" size="small" class="k8s-detail-card">
          <div class="k8s-detail-item">
            <span class="k8s-detail-label">名称:</span>
            <span class="k8s-detail-value">{{ currentPVCDetail.name }}</span>
          </div>
          <div class="k8s-detail-item">
            <span class="k8s-detail-label">命名空间:</span>
            <span class="k8s-detail-value">
              <a-tag color="blue">{{ currentPVCDetail.namespace }}</a-tag>
            </span>
          </div>
          <div class="k8s-detail-item">
            <span class="k8s-detail-label">UID:</span>
            <span class="k8s-detail-value">{{ currentPVCDetail.uid }}</span>
          </div>
          <div class="k8s-detail-item">
            <span class="k8s-detail-label">状态:</span>
            <span class="k8s-detail-value">
              <a-badge :status="getPVCStatusColor(currentPVCDetail.status)" :text="getPVCStatusText(currentPVCDetail.status)" />
            </span>
          </div>
          <div class="k8s-detail-item">
            <span class="k8s-detail-label">实际容量:</span>
            <span class="k8s-detail-value">
              <a-tag color="green">{{ currentPVCDetail.capacity || '未分配' }}</a-tag>
            </span>
          </div>
          <div class="k8s-detail-item">
            <span class="k8s-detail-label">请求存储:</span>
            <span class="k8s-detail-value">
              <a-tag color="blue">{{ currentPVCDetail.request_storage }}</a-tag>
            </span>
          </div>
          <div class="k8s-detail-item">
            <span class="k8s-detail-label">访问模式:</span>
            <span class="k8s-detail-value">
              <a-tag v-for="mode in currentPVCDetail.access_modes" :key="mode" color="green">
                {{ getAccessModeText(mode) }}
              </a-tag>
            </span>
          </div>
          <div class="k8s-detail-item">
            <span class="k8s-detail-label">存储类:</span>
            <span class="k8s-detail-value">{{ currentPVCDetail.storage_class || '默认存储类' }}</span>
          </div>
          <div class="k8s-detail-item">
            <span class="k8s-detail-label">卷模式:</span>
            <span class="k8s-detail-value">{{ currentPVCDetail.volume_mode }}</span>
          </div>
          <div class="k8s-detail-item">
            <span class="k8s-detail-label">绑定PV:</span>
            <span class="k8s-detail-value">
              <a-tag v-if="currentPVCDetail.volume_name" color="purple">{{ currentPVCDetail.volume_name }}</a-tag>
              <span v-else class="k8s-no-data">未绑定</span>
            </span>
          </div>
          <div class="k8s-detail-item">
            <span class="k8s-detail-label">创建时间:</span>
            <span class="k8s-detail-value">{{ currentPVCDetail.created_at }} ({{ currentPVCDetail.age }})</span>
          </div>
        </a-card>

        <a-card title="选择器" size="small" class="k8s-detail-card" v-if="currentPVCDetail.selector && Object.keys(currentPVCDetail.selector).length > 0">
          <div class="k8s-detail-item" v-for="(value, key) in currentPVCDetail.selector" :key="key">
            <span class="k8s-detail-label">{{ key }}:</span>
            <span class="k8s-detail-value">{{ value }}</span>
          </div>
        </a-card>

        <a-card title="标签" size="small" class="k8s-detail-card">
          <div class="k8s-labels-display">
            <template v-if="currentPVCDetail.labels && Object.keys(currentPVCDetail.labels).length > 0">
              <a-tooltip v-for="(value, key) in currentPVCDetail.labels" :key="key" :title="`${key}: ${value}`">
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
            <a-tooltip v-for="(value, key) in currentPVCDetail.annotations" :key="key" :title="`${key}: ${value}`" placement="top">
              <a-tag class="k8s-annotation-item" style="margin-bottom: 8px; max-width: 200px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                {{ key }}: {{ value }}
              </a-tag>
            </a-tooltip>
            <span v-if="!currentPVCDetail.annotations || Object.keys(currentPVCDetail.annotations).length === 0" class="k8s-no-data">
              暂无注解
            </span>
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
      :title="`查看/编辑 ${currentOperationPVC?.name} YAML`"
      :confirm-loading="submitLoading"
      :width="900"
      @ok="updatePVCByYaml"
      @cancel="resetYamlForm"
      :maskClosable="false"
      destroyOnClose
      okText="保存修改"
      cancelText="取消"
    >
      <a-form
        ref="yamlFormRef"
        :model="yamlFormModel"
        :rules="yamlFormRules"
        layout="vertical"
        class="k8s-form"
      >
        <a-form-item name="yaml">
          <div class="yaml-toolbar">
            <a-button class="yaml-toolbar-btn yaml-btn-format" @click="formatEditYaml">
              <template #icon><FormatPainterOutlined /></template>
              格式化
            </a-button>
            <a-button class="yaml-toolbar-btn yaml-btn-validate" @click="validateEditYaml">
              <template #icon><CheckCircleOutlined /></template>
              检查格式
            </a-button>
          </div>
          <a-textarea
            v-model:value="yamlFormModel.yaml"
            placeholder="YAML 内容"
            :rows="20"
            class="k8s-config-textarea"
          />
        </a-form-item>
      </a-form>
    </a-modal>

    <!-- 扩容PVC模态框 -->
    <a-modal
      v-model:open="isExpandModalVisible"
      :title="`扩容 PVC: ${currentOperationPVC?.name}`"
      :confirm-loading="submitLoading"
      :width="600"
      @ok="expandPVC"
      @cancel="resetExpandForm"
      :maskClosable="false"
      destroyOnClose
      okText="确认扩容"
      cancelText="取消"
    >
      <a-form
        ref="expandFormRef"
        :model="expandFormModel"
        :rules="expandFormRules"
        layout="vertical"
        class="k8s-form"
      >
        <a-alert
          message="PVC扩容说明"
          description="扩容只能增加存储容量，不能减少。请确认存储类支持卷扩容功能。"
          type="info"
          show-icon
          :style="{ marginBottom: '16px' }"
        />
        
        <div v-if="currentOperationPVC" class="pvc-expand-info">
          <a-descriptions :column="1" bordered size="small">
            <a-descriptions-item label="当前容量">
              <a-tag color="blue">{{ currentOperationPVC.capacity || currentOperationPVC.request_storage }}</a-tag>
            </a-descriptions-item>
            <a-descriptions-item label="存储类">
              {{ currentOperationPVC.storage_class || '默认存储类' }}
            </a-descriptions-item>
          </a-descriptions>
        </div>

        <a-form-item label="新容量" name="new_capacity" style="margin-top: 16px;">
          <a-input 
            v-model:value="expandFormModel.new_capacity" 
            placeholder="输入新的存储容量，如: 20Gi" 
            class="k8s-form-input" 
          />
          <div style="color: #8c8c8c; font-size: 12px; margin-top: 4px;">
            支持的单位：Ki, Mi, Gi, Ti, Pi, K, M, G, T, P
          </div>
        </a-form-item>
      </a-form>
    </a-modal>

    <!-- 关联Pod模态框 -->
    <a-modal
      v-model:open="isPodsModalVisible"
      :title="`使用 PVC 的 Pod: ${currentOperationPVC?.name}`"
      :footer="null"
      :width="800"
      class="k8s-detail-modal"
      :maskClosable="false"
      destroyOnClose
    >
      <div v-if="podsLoading" style="text-align: center; padding: 50px;">
        <a-spin size="large" />
        <p style="margin-top: 16px; color: #8c8c8c;">加载Pod列表中...</p>
      </div>
      <div v-else-if="currentPVCPods.length > 0">
        <a-table
          :columns="podsColumns"
          :data-source="currentPVCPods"
          :pagination="false"
          size="small"
          row-key="name"
        >
          <template #bodyCell="{ column, record }">
            <template v-if="column.dataIndex === 'name'">
              <div style="display: flex; align-items: center; gap: 8px;">
                <ContainerOutlined style="color: #1677ff; font-size: 14px;" />
                <span>{{ record.name }}</span>
              </div>
            </template>
            <template v-else-if="column.dataIndex === 'status'">
              <a-badge :status="record.status === 'Running' ? 'success' : 'warning'" :text="record.status" />
            </template>
          </template>
        </a-table>
      </div>
      <div v-else style="text-align: center; padding: 50px; color: #8c8c8c;">
        <ContainerOutlined style="font-size: 48px; margin-bottom: 16px; color: #d9d9d9;" />
        <p>暂无Pod使用此PVC</p>
      </div>
    </a-modal>
  </div>
</template>

<script setup lang="ts">
import { onMounted } from 'vue';
import {
  PlusOutlined,
  ReloadOutlined,
  CloudServerOutlined,
  AppstoreOutlined,
  FilterOutlined,
  KeyOutlined,
  SearchOutlined,
  DeleteOutlined,
  FileTextOutlined,
  InboxOutlined,
  EyeOutlined,
  EditOutlined,
  ExpandOutlined,
  ContainerOutlined,
  FileAddOutlined,
  FormatPainterOutlined,
  CheckCircleOutlined,
  ClearOutlined,
} from '@ant-design/icons-vue';
import { usePVCPage } from './PVC';
import { formatDateTime, getRelativeTime } from '../shared/utils';

const {
  // state
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
  selectedRows,
  currentPage,
  pageSize,
  total,
  clustersTotal,
  namespacesTotal,
  pvsTotal,
  
  // form refs
  formRef,
  yamlFormRef,
  createYamlFormRef,
  expandFormRef,
  
  // modal state
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
  
  // current operation
  currentOperationPVC,
  currentPVCDetail,
  currentPVCPods,
  
  // form models
  createFormModel,
  editFormModel,
  yamlFormModel,
  createYamlFormModel,
  expandFormModel,
  
  // form rules
  createFormRules,
  yamlFormRules,
  createYamlFormRules,
  expandFormRules,
  
  // computed
  filteredPVCs,
  rowSelection,
  pvOptions,
  
  // helpers
  getEnvText,
  getPVCStatusText,
  getPVCStatusColor,
  getAccessModeText,
  
  // api calls
  fetchClusters,
  fetchPVCs,
  createPVC,
  createPVCByYaml,
  updatePVC,
  updatePVCByYaml,
  deletePVC,
  expandPVC,
  deleteBatchPVCs,
  
  // modal handlers
  openCreateModal,
  openCreateYamlModal,
  openEditModal,
  openDetailModal,
  openYamlModal,
  openExpandModal,
  openPodsModal,
  
  // form helpers
  resetCreateForm,
  resetEditForm,
  resetYamlForm,
  resetCreateYamlForm,
  resetExpandForm,
  
  // filter handlers
  handleClusterChange,
  handleFilterChange,
  handleClusterDropdownScroll,
  loadMoreNamespaces,
  loadMorePVs,
  
  // label/annotation helpers
  newLabelKey,
  newAnnotationKey,
  addLabelItem,
  removeLabelItem,
  newEditLabelKey,
  newEditAnnotationKey,
  addEditLabelItem,
  removeEditLabelItem,
  
  // selector helpers
  newSelectorKey,
  newSelectorValue,
  addSelectorItem,
  removeSelectorItem,
  
  // yaml operations
  insertYamlTemplate,
  formatYaml,
  validateYaml,
  clearYaml,
  formatEditYaml,
  validateEditYaml,
  
  // constants
  K8sPVCStatus,
} = usePVCPage();

const columns = [
  { title: 'PVC名称', dataIndex: 'name', key: 'name', width: 150, ellipsis: true, fixed: 'left', slots: { customRender: 'name' } },
  { title: '命名空间', dataIndex: 'namespace', key: 'namespace', width: 120, ellipsis: true, slots: { customRender: 'namespace' } },
  { title: '状态', dataIndex: 'status', key: 'status', width: 90, align: 'center', slots: { customRender: 'status' } },
  { title: '容量信息', dataIndex: 'capacity', key: 'capacity', width: 120, align: 'center', slots: { customRender: 'capacity' } },
  { title: '访问模式', dataIndex: 'access_modes', key: 'access_modes', width: 140, slots: { customRender: 'access_modes' } },
  { title: '存储类', dataIndex: 'storage_class', key: 'storage_class', width: 130, ellipsis: true, slots: { customRender: 'storage_class' } },
  { title: '绑定PV', dataIndex: 'volume_name', key: 'volume_name', width: 150, ellipsis: true, slots: { customRender: 'volume_name' } },
  { title: '标签', dataIndex: 'labels', key: 'labels', width: 150, slots: { customRender: 'labels' } },
  { title: '注解', dataIndex: 'annotations', key: 'annotations', width: 120, slots: { customRender: 'annotations' } },
  { title: 'UID', dataIndex: 'uid', key: 'uid', width: 100, ellipsis: true, slots: { customRender: 'uid' } },
  { title: '创建时间', dataIndex: 'created_at', key: 'created_at', width: 160, slots: { customRender: 'createdAt' } },
  { title: '操作', key: 'actions', width: 200, fixed: 'right', align: 'center', slots: { customRender: 'actions' } },
];

// Pod列表表格列定义
const podsColumns = [
  {
    title: 'Pod名称',
    dataIndex: 'name',
    key: 'name',
    width: 200,
  },
  {
    title: '命名空间',
    dataIndex: 'namespace',
    key: 'namespace',
    width: 120,
  },
  {
    title: '状态',
    dataIndex: 'status',
    key: 'status',
    width: 120,
  },
  {
    title: '节点',
    dataIndex: 'node_name',
    key: 'node_name',
    width: 150,
  },
  {
    title: '创建时间',
    dataIndex: 'created_at',
    key: 'created_at',
    width: 180,
  },
];

// 搜索功能
const onSearch = () => {
  currentPage.value = 1;
  fetchPVCs();
};

// 重置所有筛选条件
const resetFilters = () => {
  filterStatus.value = undefined;
  filterAccessMode.value = undefined;
  searchText.value = '';
  filterClusterId.value = undefined;
  filterNamespace.value = undefined;
  currentPage.value = 1;
  fetchPVCs();
};

// 表格变化处理
const handleTableChange = (pagination: { current?: number; pageSize?: number }) => {
  if (pagination) {
    currentPage.value = pagination.current || currentPage.value;
    if (pagination.pageSize) {
      pageSize.value = pagination.pageSize;
    }
    fetchPVCs();
  }
};

// PV 下拉框滚动处理
const handlePVDropdownScroll = (e: Event) => {
  const target = e.target as HTMLElement;
  if (target.scrollTop + target.offsetHeight === target.scrollHeight) {
    if (availablePVs.value.length < pvsTotal.value && !pvsLoading.value) {
      loadMorePVs();
    }
  }
};

// 页面初始化
onMounted(async () => {
  await fetchClusters(true);
});
</script>

<style scoped>
@import '../shared/k8s-common.css';
</style>

<style scoped src="./PVC.css"></style>
