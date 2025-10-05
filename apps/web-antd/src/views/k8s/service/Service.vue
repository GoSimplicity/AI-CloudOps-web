<template>
  <div class="k8s-management-container">
    <!-- 页面头部 -->
    <div class="k8s-page-header">
      <a-row class="k8s-header-content" :gutter="[24, 16]">
        <a-col :xs="24" :sm="24" :md="16" :lg="16" :xl="18">
          <div class="k8s-title-section">
            <div class="k8s-page-title">
              <GlobalOutlined class="k8s-title-icon" />
              <div>
                <h1>Service 管理</h1>
                <p class="k8s-page-subtitle">管理和监控集群中的所有 Kubernetes Service</p>
              </div>
            </div>
          </div>
        </a-col>
        <a-col :xs="24" :sm="24" :md="8" :lg="8" :xl="6">
          <div class="k8s-header-actions">
            <a-button type="primary" @click="openCreateModal" :disabled="!filterClusterId">
              <template #icon><PlusOutlined /></template>
              创建 Service
            </a-button>
            <a-button @click="fetchServices" :loading="loading">
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
            <template #suffixIcon><DeploymentUnitOutlined /></template>
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
            v-model:value="filterType" 
            placeholder="Service类型" 
            class="k8s-filter-select" 
            allow-clear 
            @change="handleFilterChange"
          >
            <template #suffixIcon><NodeIndexOutlined /></template>
            <a-select-option value="ClusterIP">ClusterIP</a-select-option>
            <a-select-option value="NodePort">NodePort</a-select-option>
            <a-select-option value="LoadBalancer">LoadBalancer</a-select-option>
            <a-select-option value="ExternalName">ExternalName</a-select-option>
          </a-select>

          <a-select 
            v-model:value="filterStatus" 
            placeholder="状态筛选" 
            class="k8s-filter-select" 
            allow-clear 
            @change="handleFilterChange"
          >
            <template #suffixIcon><FilterOutlined /></template>
            <a-select-option :value="K8sSvcStatus.Running">运行中</a-select-option>
            <a-select-option :value="K8sSvcStatus.Stopped">已停止</a-select-option>
            <a-select-option :value="K8sSvcStatus.Error">异常</a-select-option>
          </a-select>
          
          <!-- 标签过滤器 -->
          <div class="k8s-labels-filter">
            <a-button type="dashed" @click="openLabelsFilter" class="k8s-toolbar-btn">
              <template #icon><TagsOutlined /></template>
              标签过滤 
              <a-tag v-if="Object.keys(filterLabels).length > 0" color="blue" size="small" style="margin-left: 8px;">
                {{ Object.keys(filterLabels).length }}
              </a-tag>
            </a-button>
            <div v-if="Object.keys(filterLabels).length > 0" class="active-filters" style="margin-top: 8px;">
              <a-tag 
                v-for="(value, key) in filterLabels" 
                :key="key"
                closable
                @close="removeFilterLabel(key)"
                color="blue"
                size="small"
                style="margin-right: 4px; margin-bottom: 4px;"
              >
                {{ key }}: {{ value }}
              </a-tag>
            </div>
          </div>
        </div>
        
        <div class="k8s-search-group">
          <a-input 
            v-model:value="searchText" 
            placeholder="搜索 Service 名称" 
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
            :disabled="!filterStatus && !searchText && !filterClusterId && !filterNamespace && !filterType && Object.keys(filterLabels).length === 0"
            class="k8s-toolbar-btn"
            title="重置所有筛选条件"
          >
            <template #icon><DeleteOutlined /></template>
            重置筛选
          </a-button>
          
          <a-button 
            @click="fetchServices" 
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
            title="通过YAML创建Service"
          >
            <template #icon><FileTextOutlined /></template>
            YAML 创建
          </a-button>
          
          <a-button 
            type="primary" 
            danger 
            @click="() => batchOperation('删除')" 
            :disabled="!selectedRows.length" 
            v-if="selectedRows.length > 0"
            class="k8s-toolbar-btn"
            title="批量删除选中的 Service"
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
        :data-source="filteredServices"
        :row-selection="rowSelection"
        :loading="loading"
        row-key="name"
        :pagination="{
          current: currentPage,
          pageSize: pageSize,
          total: total,
          showSizeChanger: true,
          showQuickJumper: true,
          showTotal: (total: number, range: number[]) => `显示 ${range[0]}-${range[1]} 条，共 ${total} 条数据`,
          pageSizeOptions: ['10', '20', '30', '50']
        }"
        @change="handleTableChange"
        class="k8s-table service-table"
        :scroll="{ x: 1240 }"
      >
        <template #status="{ text }">
          <a-badge :status="getStatusColor(text)" :text="getStatusText(text)" />
        </template>

        <template #type="{ text }">
          <a-tag :color="getServiceTypeColor(text)">{{ getServiceTypeText(text) }}</a-tag>
        </template>

        <template #ports="{ text }">
          <div class="service-ports">
            <a-tag 
              v-for="(port, index) in (text || []).slice(0, 3)" 
              :key="index" 
              class="port-tag"
              size="small"
            >
              {{ port.port }}{{ port.target_port && port.target_port !== port.port ? `:${port.target_port}` : '' }}/{{ port.protocol }}
              {{ port.node_port ? `(${port.node_port})` : '' }}
            </a-tag>
            <a-tooltip v-if="(text || []).length > 3" :title="(text || []).map((p: any) => `${p.port}:${p.target_port}/${p.protocol}`).join(', ')">
              <a-tag class="port-tag" size="small">
                +{{ (text || []).length - 3 }} 更多
              </a-tag>
            </a-tooltip>
            <span v-if="!text || text.length === 0" class="k8s-no-data">-</span>
          </div>
        </template>

        <template #cluster_ip="{ text }">
          <span v-if="text && text !== 'None'" class="service-ip">{{ text }}</span>
          <span v-else class="k8s-no-data">-</span>
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
              <a-tooltip v-if="text && text.length > 3" :title="text.map((item: any) => `${item.key}: ${item.value}`).join('\n')">
                <a-tag class="k8s-label-item">
                  {{ text.length }} 个标签
                </a-tag>
              </a-tooltip>
              <span v-if="!text || text.length === 0" class="k8s-no-data">-</span>
            </template>
            <template v-else-if="text && typeof text === 'object'">
              <!-- 对象格式 -->
              <a-tooltip v-for="[key, value] in Object.entries(text).slice(0, 3)" :key="key" :title="`${key}: ${value}`">
                <a-tag class="k8s-label-item">
                  {{ key }}: {{ value }}
                </a-tag>
              </a-tooltip>
              <a-tooltip v-if="text && Object.keys(text).length > 3" :title="Object.entries(text).map(([k, v]: [string, any]) => `${k}: ${v}`).join('\n')">
                <a-tag class="k8s-label-item">
                  {{ Object.keys(text).length }} 个标签
                </a-tag>
              </a-tooltip>
              <span v-if="!text || Object.keys(text).length === 0" class="k8s-no-data">-</span>
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
                <a-tag class="k8s-annotation-item" color="purple">
                  {{ text.length }} 个注解
                </a-tag>
              </a-tooltip>
              <span v-else class="k8s-no-data">-</span>
            </template>
            <template v-else-if="text && typeof text === 'object'">
              <a-tooltip v-if="Object.keys(text).length > 0" :title="Object.entries(text).map(([k, v]: [string, any]) => `${k}: ${v}`).join('\n')">
                <a-tag class="k8s-annotation-item" color="purple">
                  {{ Object.keys(text).length }} 个注解
                </a-tag>
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
              <a-button title="查看详情" @click="showServiceDetail(record)">
                <template #icon><EyeOutlined /></template>
              </a-button>
            </a-tooltip>
            <a-tooltip title="编辑">
              <a-button title="编辑" @click="openEditModal(record)">
                <template #icon><EditOutlined /></template>
              </a-button>
            </a-tooltip>
            <a-tooltip title="查看 YAML">
              <a-button title="查看 YAML" @click="showYamlModal(record)">
                <template #icon><FileTextOutlined /></template>
              </a-button>
            </a-tooltip>
            <a-tooltip title="查看端点">
              <a-button title="查看端点" @click="showEndpointsModal(record)">
                <template #icon><NodeIndexOutlined /></template>
              </a-button>
            </a-tooltip>
            <a-tooltip title="删除">
              <a-button 
                title="删除" 
                danger 
                @click="deleteService(record)"
              >
                <template #icon><DeleteOutlined /></template>
              </a-button>
            </a-tooltip>
          </div>
        </template>

        <template #emptyText>
          <div class="k8s-empty-state">
            <GlobalOutlined />
            <p>暂无 Service 数据</p>
            <p>请先选择集群</p>
          </div>
        </template>
      </a-table>
    </div>

    <!-- 创建 Service 模态框 -->
    <a-modal
      v-model:open="isCreateModalVisible"
      title="创建 Service"
      @ok="submitCreateForm"
      @cancel="closeCreateModal"
      :confirmLoading="submitLoading"
      width="800px"
      :maskClosable="false"
      destroyOnClose
      okText="创建"
      cancelText="取消"
    >
      <a-form 
        ref="formRef"
        :model="createFormModel" 
        layout="vertical" 
        class="k8s-form"
        :rules="createFormRules"
      >
        <a-form-item label="Service 名称" name="name" :required="true">
          <a-input 
            v-model:value="createFormModel.name" 
            placeholder="请输入 Service 名称（例如：my-service）" 
            class="k8s-form-input"
            :maxlength="63"
          />
          <div style="color: #999; font-size: 12px; margin-top: 4px;">
            只能包含小写字母、数字和连字符，且不能以连字符开头或结尾
          </div>
        </a-form-item>

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
        </a-form-item>

        <a-form-item label="Service 类型" name="type" :required="true">
          <a-select 
            v-model:value="createFormModel.type" 
            placeholder="请选择 Service 类型" 
            class="k8s-form-input"
          >
            <a-select-option value="ClusterIP">ClusterIP</a-select-option>
            <a-select-option value="NodePort">NodePort</a-select-option>
            <a-select-option value="LoadBalancer">LoadBalancer</a-select-option>
            <a-select-option value="ExternalName">ExternalName</a-select-option>
          </a-select>
        </a-form-item>

        <a-form-item label="端口配置">
          <div class="k8s-key-value-inputs">
            <div v-for="(port, index) in createFormModel.ports" :key="index" class="k8s-key-value-row">
              <a-input 
                v-model:value="port.name" 
                placeholder="端口名称" 
                class="k8s-form-input"
                style="flex: 1;"
              />
              <a-select 
                v-model:value="port.protocol" 
                placeholder="协议" 
                class="k8s-form-input"
                style="width: 100px;"
              >
                <a-select-option value="TCP">TCP</a-select-option>
                <a-select-option value="UDP">UDP</a-select-option>
              </a-select>
              <a-input-number 
                v-model:value="port.port" 
                placeholder="端口" 
                class="k8s-form-input"
                :min="1" 
                :max="65535"
                style="width: 100px;"
              />
              <a-input-number 
                v-model:value="port.target_port" 
                placeholder="目标端口" 
                class="k8s-form-input"
                :min="1" 
                :max="65535"
                style="width: 100px;"
              />
              <a-button type="text" danger 
                @click="removePortField(index)" 
                :disabled="createFormModel.ports.length <= 1"
                size="small"
               class="k8s-remove-btn">
                <template #icon><DeleteOutlined /></template>
              </a-button>
            </div>
            <a-button type="dashed" @click="addPortField" style="margin-top: 8px;">
              <template #icon><PlusOutlined /></template>
              添加端口
            </a-button>
          </div>
        </a-form-item>

        <a-form-item label="Pod 选择器（可选）" name="selector">
          <div class="k8s-key-value-inputs">
            <div v-if="!createFormModel.selector || Object.keys(createFormModel.selector).length === 0" style="text-align: center; color: #999; padding: 16px;">
              暂无选择器，点击下方按钮添加
            </div>
            <div v-for="(_, key) in createFormModel.selector" :key="key" class="k8s-key-value-row">
              <a-input 
                :value="key" 
                :placeholder="`选择器键: ${key}`" 
                disabled
                class="k8s-form-input"
              />
              <a-input 
                v-model:value="createFormModel.selector[key]" 
                placeholder="选择器值" 
                class="k8s-form-input"
                :maxlength="200"
              />
              <a-button type="text" danger @click="removeSelectorField(key)" size="small" class="k8s-remove-btn">
                <template #icon><DeleteOutlined /></template>
              </a-button>
            </div>
            <div class="add-input-row" style="margin-top: 8px;">
              <a-input
                v-model:value="newSelectorKey"
                placeholder="输入选择器键"
                style="flex: 1; margin-right: 8px;"
                @press-enter="addNewSelector"
              />
              <a-button type="primary" @click="addNewSelector" :disabled="!newSelectorKey.trim()">
                <template #icon><PlusOutlined /></template>
                添加
              </a-button>
            </div>
          </div>
        </a-form-item>

        <a-form-item label="标签配置（可选）" name="labels">
          <div class="k8s-key-value-inputs">
            <div v-if="!createFormModel.labels || Object.keys(createFormModel.labels).length === 0" style="text-align: center; color: #999; padding: 16px;">
              暂无标签，点击下方按钮添加
            </div>
            <div v-for="(_, key) in createFormModel.labels" :key="key" class="k8s-key-value-row">
              <a-input 
                :value="key" 
                :placeholder="`标签键: ${key}`" 
                disabled
                class="k8s-form-input"
              />
              <a-input 
                v-model:value="createFormModel.labels[key]" 
                placeholder="标签值" 
                class="k8s-form-input"
                :maxlength="200"
              />
              <a-button type="text" danger @click="removeLabelField(key)" size="small" class="k8s-remove-btn">
                <template #icon><DeleteOutlined /></template>
              </a-button>
            </div>
            <div class="add-input-row" style="margin-top: 8px;">
              <a-input
                v-model:value="newLabelKey"
                placeholder="输入标签键"
                style="flex: 1; margin-right: 8px;"
                @press-enter="addNewLabel"
              />
              <a-button type="primary" @click="addNewLabel" :disabled="!newLabelKey.trim()">
                <template #icon><PlusOutlined /></template>
                添加
              </a-button>
            </div>
          </div>
        </a-form-item>

        <a-form-item label="注解配置（可选）" name="annotations">
          <div class="k8s-key-value-inputs">
            <div v-if="!createFormModel.annotations || Object.keys(createFormModel.annotations).length === 0" style="text-align: center; color: #999; padding: 16px;">
              暂无注解，点击下方按钮添加
            </div>
            <div v-for="(_, key) in createFormModel.annotations" :key="key" class="k8s-key-value-row">
              <a-input 
                :value="key" 
                :placeholder="`注解键: ${key}`" 
                disabled
                class="k8s-form-input"
              />
              <a-input 
                v-model:value="createFormModel.annotations[key]" 
                placeholder="注解值" 
                class="k8s-form-input"
                :maxlength="500"
              />
              <a-button type="text" danger @click="removeAnnotationField(key)" size="small" class="k8s-remove-btn">
                <template #icon><DeleteOutlined /></template>
              </a-button>
            </div>
            <div class="add-input-row" style="margin-top: 8px;">
              <a-input
                v-model:value="newAnnotationKey"
                placeholder="输入注解键"
                style="flex: 1; margin-right: 8px;"
                @press-enter="addNewAnnotation"
              />
              <a-button type="primary" @click="addNewAnnotation" :disabled="!newAnnotationKey.trim()">
                <template #icon><PlusOutlined /></template>
                添加
              </a-button>
            </div>
          </div>
        </a-form-item>
      </a-form>
    </a-modal>

    <!-- 编辑 Service 模态框 -->
    <a-modal
      v-model:open="isEditModalVisible"
      title="编辑 Service"
      @ok="submitEditForm"
      @cancel="closeEditModal"
      :confirmLoading="submitLoading"
      width="800px"
      :maskClosable="false"
      destroyOnClose
      okText="更新"
      cancelText="取消"
    >
      <a-form 
        ref="editFormRef"
        :model="editFormModel" 
        layout="vertical" 
        class="k8s-form"
        :rules="editFormRules"
      >
        <a-form-item label="Service 名称" name="name" :required="true">
          <a-input 
            v-model:value="editFormModel.name" 
            placeholder="请输入 Service 名称（例如：my-service）" 
            class="k8s-form-input"
            :maxlength="63"
            disabled
          />
          <div style="color: #999; font-size: 12px; margin-top: 4px;">
            Service 名称不可修改
          </div>
        </a-form-item>

        <a-form-item label="命名空间" name="namespace" :required="true">
          <a-input 
            v-model:value="editFormModel.namespace" 
            placeholder="命名空间" 
            class="k8s-form-input"
            disabled
          />
          <div style="color: #999; font-size: 12px; margin-top: 4px;">
            命名空间不可修改
          </div>
        </a-form-item>

        <a-form-item label="Service 类型" name="type" :required="true">
          <a-select 
            v-model:value="editFormModel.type" 
            placeholder="请选择 Service 类型" 
            class="k8s-form-input"
          >
            <a-select-option value="ClusterIP">ClusterIP</a-select-option>
            <a-select-option value="NodePort">NodePort</a-select-option>
            <a-select-option value="LoadBalancer">LoadBalancer</a-select-option>
            <a-select-option value="ExternalName">ExternalName</a-select-option>
          </a-select>
        </a-form-item>

        <a-form-item label="端口配置">
          <div class="k8s-key-value-inputs">
            <div v-for="(port, index) in editFormModel.ports" :key="index" class="k8s-key-value-row">
              <a-input 
                v-model:value="port.name" 
                placeholder="端口名称" 
                class="k8s-form-input"
                style="flex: 1;"
              />
              <a-select 
                v-model:value="port.protocol" 
                placeholder="协议" 
                class="k8s-form-input"
                style="width: 100px;"
              >
                <a-select-option value="TCP">TCP</a-select-option>
                <a-select-option value="UDP">UDP</a-select-option>
              </a-select>
              <a-input-number 
                v-model:value="port.port" 
                placeholder="端口" 
                class="k8s-form-input"
                :min="1" 
                :max="65535"
                style="width: 100px;"
              />
              <a-input-number 
                v-model:value="port.target_port" 
                placeholder="目标端口" 
                class="k8s-form-input"
                :min="1" 
                :max="65535"
                style="width: 100px;"
              />
              <a-button type="text" danger 
                @click="removeEditPortField(index)" 
                :disabled="editFormModel.ports.length <= 1"
                size="small"
               class="k8s-remove-btn">
                <template #icon><DeleteOutlined /></template>
              </a-button>
            </div>
            <a-button type="dashed" @click="addEditPortField" style="margin-top: 8px;">
              <template #icon><PlusOutlined /></template>
              添加端口
            </a-button>
          </div>
        </a-form-item>

        <a-form-item label="Pod 选择器（可选）" name="selector">
          <div class="k8s-key-value-inputs">
            <div v-if="!editFormModel.selector || Object.keys(editFormModel.selector).length === 0" style="text-align: center; color: #999; padding: 16px;">
              暂无选择器，点击下方按钮添加
            </div>
            <div v-for="(_, key) in editFormModel.selector" :key="key" class="k8s-key-value-row">
              <a-input 
                :value="key" 
                :placeholder="`选择器键: ${key}`" 
                disabled
                class="k8s-form-input"
              />
              <a-input 
                v-model:value="editFormModel.selector[key]" 
                placeholder="选择器值" 
                class="k8s-form-input"
                :maxlength="200"
              />
              <a-button type="text" danger @click="removeEditSelectorField(key)" size="small" class="k8s-remove-btn">
                <template #icon><DeleteOutlined /></template>
              </a-button>
            </div>
            <div class="add-input-row" style="margin-top: 8px;">
              <a-input
                v-model:value="newEditSelectorKey"
                placeholder="输入选择器键"
                style="flex: 1; margin-right: 8px;"
                @press-enter="addNewEditSelector"
              />
              <a-button type="primary" @click="addNewEditSelector" :disabled="!newEditSelectorKey.trim()">
                <template #icon><PlusOutlined /></template>
                添加
              </a-button>
            </div>
          </div>
        </a-form-item>

        <a-form-item label="标签配置（可选）" name="labels">
          <div class="k8s-key-value-inputs">
            <div v-if="!editFormModel.labels || Object.keys(editFormModel.labels).length === 0" style="text-align: center; color: #999; padding: 16px;">
              暂无标签，点击下方按钮添加
            </div>
            <div v-for="(_, key) in editFormModel.labels" :key="key" class="k8s-key-value-row">
              <a-input 
                :value="key" 
                :placeholder="`标签键: ${key}`" 
                disabled
                class="k8s-form-input"
              />
              <a-input 
                v-model:value="editFormModel.labels[key]" 
                placeholder="标签值" 
                class="k8s-form-input"
                :maxlength="200"
              />
              <a-button type="text" danger @click="removeEditLabelField(key)" size="small" class="k8s-remove-btn">
                <template #icon><DeleteOutlined /></template>
              </a-button>
            </div>
            <div class="add-input-row" style="margin-top: 8px;">
              <a-input
                v-model:value="newEditLabelKey"
                placeholder="输入标签键"
                style="flex: 1; margin-right: 8px;"
                @press-enter="addNewEditLabel"
              />
              <a-button type="primary" @click="addNewEditLabel" :disabled="!newEditLabelKey.trim()">
                <template #icon><PlusOutlined /></template>
                添加
              </a-button>
            </div>
          </div>
        </a-form-item>

        <a-form-item label="注解配置（可选）" name="annotations">
          <div class="k8s-key-value-inputs">
            <div v-if="!editFormModel.annotations || Object.keys(editFormModel.annotations).length === 0" style="text-align: center; color: #999; padding: 16px;">
              暂无注解，点击下方按钮添加
            </div>
            <div v-for="(_, key) in editFormModel.annotations" :key="key" class="k8s-key-value-row">
              <a-input 
                :value="key" 
                :placeholder="`注解键: ${key}`" 
                disabled
                class="k8s-form-input"
              />
              <a-input 
                v-model:value="editFormModel.annotations[key]" 
                placeholder="注解值" 
                class="k8s-form-input"
                :maxlength="500"
              />
              <a-button type="text" danger @click="removeEditAnnotationField(key)" size="small" class="k8s-remove-btn">
                <template #icon><DeleteOutlined /></template>
              </a-button>
            </div>
            <div class="add-input-row" style="margin-top: 8px;">
              <a-input
                v-model:value="newEditAnnotationKey"
                placeholder="输入注解键"
                style="flex: 1; margin-right: 8px;"
                @press-enter="addNewEditAnnotation"
              />
              <a-button type="primary" @click="addNewEditAnnotation" :disabled="!newEditAnnotationKey.trim()">
                <template #icon><PlusOutlined /></template>
                添加
              </a-button>
            </div>
          </div>
        </a-form-item>
      </a-form>
    </a-modal>

    <!-- 通过 YAML 创建 Service 模态框 -->
    <a-modal
      v-model:open="isCreateYamlModalVisible"
      title="通过 YAML 创建 Service"
      @ok="submitCreateYamlForm"
      @cancel="closeCreateYamlModal"
      :confirmLoading="submitLoading"
      width="900px"
      :maskClosable="false"
      destroyOnClose
      okText="创建"
      cancelText="取消"
    >
      <a-form 
        ref="createYamlFormRef"
        :model="createYamlFormModel" 
        layout="vertical" 
        class="k8s-form"
        :rules="createYamlFormRules"
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
            placeholder="请输入 Service YAML 内容，或点击【插入模板】使用默认模板" 
            :rows="20"
            class="k8s-config-textarea"
          />
        </a-form-item>
      </a-form>
    </a-modal>

    <!-- 详情模态框 -->
    <a-modal
      v-model:open="isDetailModalVisible"
      title="Service 详情"
      :footer="null"
      @cancel="closeDetailModal"
      width="1000px"
      :maskClosable="false"
      destroyOnClose
    >
      <a-spin :spinning="detailLoading">
        <div v-if="currentServiceDetail" class="k8s-detail-content">
          <a-row :gutter="[24, 16]">
            <a-col :xs="24" :lg="12">
              <a-card title="基本信息" class="k8s-detail-card" size="small">
                <div class="k8s-detail-item">
                  <span class="k8s-detail-label">Service 名称:</span>
                  <span class="k8s-detail-value">{{ currentServiceDetail.name }}</span>
                </div>
                <div class="k8s-detail-item">
                  <span class="k8s-detail-label">命名空间:</span>
                  <span class="k8s-detail-value">{{ currentServiceDetail.namespace }}</span>
                </div>
                <div class="k8s-detail-item">
                  <span class="k8s-detail-label">状态:</span>
                  <a-badge :status="getStatusColor(currentServiceDetail.status)" :text="getStatusText(currentServiceDetail.status)" />
                </div>
                <div class="k8s-detail-item">
                  <span class="k8s-detail-label">类型:</span>
                  <a-tag :color="getServiceTypeColor(currentServiceDetail.type)">{{ getServiceTypeText(currentServiceDetail.type) }}</a-tag>
                </div>
                <div class="k8s-detail-item" v-if="currentServiceDetail.cluster_ip && currentServiceDetail.cluster_ip !== 'None'">
                  <span class="k8s-detail-label">集群IP:</span>
                  <span class="k8s-detail-value">{{ currentServiceDetail.cluster_ip }}</span>
                </div>
                <div class="k8s-detail-item" v-if="currentServiceDetail.uid">
                  <span class="k8s-detail-label">UID:</span>
                  <span class="k8s-detail-value">{{ currentServiceDetail.uid }}</span>
                </div>
              </a-card>
            </a-col>
            
            <a-col :xs="24" :lg="12">
              <a-card title="时间信息" class="k8s-detail-card" size="small">
                <div class="k8s-detail-item" v-if="currentServiceDetail.created_at">
                  <span class="k8s-detail-label">创建时间:</span>
                  <span class="k8s-detail-value">{{ formatK8sTime(currentServiceDetail.created_at) }}</span>
                </div>
                <div class="k8s-detail-item" v-if="currentServiceDetail.age">
                  <span class="k8s-detail-label">存在时间:</span>
                  <span class="k8s-detail-value">{{ currentServiceDetail.age }}</span>
                </div>
                <!-- 只有当有外部IP时才显示 -->
                <div class="k8s-detail-item" v-if="currentServiceDetail.external_ips && currentServiceDetail.external_ips.length > 0">
                  <span class="k8s-detail-label">外部IP:</span>
                  <div class="k8s-detail-value">
                    <a-tag v-for="ip in currentServiceDetail.external_ips" :key="ip" color="orange" size="small" style="margin-right: 4px; margin-bottom: 4px;">
                      {{ ip }}
                    </a-tag>
                  </div>
                </div>
                <!-- 只有当有负载均衡IP时才显示 -->
                <div class="k8s-detail-item" v-if="currentServiceDetail.load_balancer_ip && currentServiceDetail.load_balancer_ip.trim()">
                  <span class="k8s-detail-label">负载均衡IP:</span>
                  <span class="k8s-detail-value">{{ currentServiceDetail.load_balancer_ip }}</span>
                </div>
              </a-card>
            </a-col>
          </a-row>

          <!-- 只有当有端口配置时才显示 -->
          <a-row :gutter="[24, 16]" style="margin-top: 16px;" v-if="currentServiceDetail.ports && currentServiceDetail.ports.length > 0">
            <a-col :xs="24">
              <a-card title="端口配置" class="k8s-detail-card" size="small">
                <a-table
                  :data-source="currentServiceDetail.ports"
                  :columns="getVisiblePortColumns(currentServiceDetail.ports)"
                  :pagination="false"
                  size="small"
                  class="k8s-table"
                >
                  <template #name="{ text }">
                    <span v-if="text">{{ text }}</span>
                    <span v-else class="k8s-no-data">-</span>
                  </template>
                  <template #protocol="{ text }">
                    <a-tag color="blue" size="small">{{ text || 'TCP' }}</a-tag>
                  </template>
                  <template #node_port="{ text }">
                    <span v-if="text">{{ text }}</span>
                    <span v-else class="k8s-no-data">-</span>
                  </template>
                </a-table>
              </a-card>
            </a-col>
          </a-row>

          <a-row :gutter="[24, 16]" style="margin-top: 16px;">
            <!-- 只有当有选择器时才显示 -->
            <a-col :xs="24" :lg="12" v-if="currentServiceDetail.selector && Object.keys(currentServiceDetail.selector).length > 0">
              <a-card title="Pod 选择器" class="k8s-detail-card" size="small">
                <div class="k8s-labels-display">
                  <a-tag v-for="[key, value] in Object.entries(currentServiceDetail.selector)" :key="key" class="k8s-label-item" style="margin-bottom: 8px;">
                    {{ key }}: {{ value }}
                  </a-tag>
                </div>
              </a-card>
            </a-col>

            <!-- 只有当有标签时才显示 -->
            <a-col :xs="24" :lg="12" v-if="currentServiceDetail.labels && Object.keys(currentServiceDetail.labels).length > 0">
              <a-card title="标签信息" class="k8s-detail-card" size="small">
                <div class="k8s-labels-display">
                  <a-tooltip v-for="(value, key) in currentServiceDetail.labels" :key="key" :title="`${key}: ${value}`" placement="top">
                    <a-tag class="k8s-label-item" style="margin-bottom: 8px; max-width: 200px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                      {{ key }}: {{ value }}
                    </a-tag>
                  </a-tooltip>
                </div>
              </a-card>
            </a-col>
          </a-row>

          <!-- 只有当有注解时才显示 -->
          <a-row :gutter="[24, 16]" style="margin-top: 16px;" v-if="currentServiceDetail.annotations && Object.keys(currentServiceDetail.annotations).length > 0">
            <a-col :xs="24">
              <a-card title="注解信息" class="k8s-detail-card" size="small">
                <div class="k8s-annotations-display">
                  <a-tooltip v-for="(value, key) in currentServiceDetail.annotations" :key="key" :title="`${key}: ${value}`">
                    <div class="k8s-annotation-item" style="margin-bottom: 8px; display: inline-block; max-width: 100%; text-overflow: ellipsis; overflow: hidden; white-space: nowrap; margin-right: 8px;">
                      {{ key }}: {{ value }}
                    </div>
                  </a-tooltip>
                </div>
              </a-card>
            </a-col>
          </a-row>
        </div>
      </a-spin>
    </a-modal>

    <!-- YAML 模态框 -->
    <a-modal
      v-model:open="isYamlModalVisible"
      :title="`查看/编辑 ${currentOperationService?.name} YAML`"
      @ok="submitYamlForm"
      @cancel="closeYamlModal"
      :confirmLoading="submitLoading"
      width="900px"
      :maskClosable="false"
      destroyOnClose
      okText="保存修改"
      cancelText="取消"
    >
      <a-form 
        ref="yamlFormRef"
        :model="yamlFormModel" 
        layout="vertical" 
        class="k8s-form"
        :rules="yamlFormRules"
      >
        <a-form-item name="yaml">
          <a-textarea 
            v-model:value="yamlFormModel.yaml" 
            placeholder="YAML 内容" 
            :rows="20"
            class="k8s-config-textarea"
          />
        </a-form-item>
      </a-form>
    </a-modal>

    <!-- 端点列表模态框 -->
    <a-modal
      v-model:open="isEndpointsModalVisible"
      :title="`${currentOperationService?.name} 端点列表`"
      :footer="null"
      @cancel="closeEndpointsModal"
      width="800px"
      :maskClosable="false"
      destroyOnClose
    >
      <div v-if="serviceEndpoints && serviceEndpoints.length > 0">
        <a-table
          :data-source="serviceEndpoints"
          :pagination="false"
          :loading="submitLoading"
          size="small"
          class="k8s-table"
          :columns="endpointColumns"
        >
          <template #ready="{ text }">
            <a-badge :status="text ? 'success' : 'error'" :text="text ? '就绪' : '未就绪'" />
          </template>
        </a-table>
      </div>
      <a-empty v-else description="暂无端点数据" :image="undefined">
        <template #image>
          <NodeIndexOutlined style="font-size: 48px; color: #d9d9d9;" />
        </template>
      </a-empty>
    </a-modal>

    <!-- 标签过滤模态框 -->
    <a-modal
      v-model:open="isLabelsFilterModalVisible"
      title="标签过滤设置"
      @ok="applyLabelsFilter"
      @cancel="closeLabelsFilterModal"
      width="550px"
      :maskClosable="false"
      destroyOnClose
      okText="应用过滤"
      cancelText="取消"
    >
      <div class="labels-filter-form">
        <div class="current-filters" v-if="Object.keys(filterLabels).length > 0">
          <h4>当前过滤条件：</h4>
          <div class="filter-tags">
            <a-tag 
              v-for="(value, key) in filterLabels" 
              :key="key"
              closable
              @close="removeFilterLabel(key)"
              color="blue"
              style="margin-right: 8px; margin-bottom: 8px;"
            >
              {{ key }}: {{ value }}
            </a-tag>
          </div>
          <a-button type="link" danger @click="clearFilterLabels" style="padding: 0; margin-bottom: 16px;">
            清除所有过滤条件
          </a-button>
        </div>

        <div class="add-filter-section">
          <h4>添加过滤条件</h4>
          <div class="filter-input-row" style="gap: 8px;">
            <a-input
              v-model:value="newFilterKey"
              placeholder="标签键"
              style="flex: 1;"
            />
            <a-input
              v-model:value="newFilterValue"
              placeholder="标签值"
              style="flex: 1;"
            />
            <a-button type="primary" @click="addNewFilterLabel" :disabled="!newFilterKey.trim()" size="small">
              <template #icon><PlusOutlined /></template>
            </a-button>
          </div>
        </div>
      </div>
    </a-modal>

  </div>
</template>

<script lang="ts" setup>
import { onMounted, ref } from 'vue';
import { message, Modal } from 'ant-design-vue';
import { useServicePage } from './Service';
import { formatK8sTime, formatDateTime, getRelativeTime } from '../shared/utils';
import yaml from 'js-yaml';
import { 
  PlusOutlined, 
  ReloadOutlined, 
  FilterOutlined, 
  DeleteOutlined, 
  DeploymentUnitOutlined,
  AppstoreOutlined,
  EyeOutlined,
  TagsOutlined,
  SearchOutlined,
  FileTextOutlined,
  EditOutlined,
  NodeIndexOutlined,
  GlobalOutlined,
  FileAddOutlined,
  FormatPainterOutlined,
  CheckCircleOutlined,
  ClearOutlined,
} from '@ant-design/icons-vue';

const {
  // state
  clusters,
  namespaces,
  loading,
  clustersLoading,
  namespacesLoading,
  searchText,
  filterStatus,
  filterClusterId,
  filterNamespace,
  filterType,
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
  isEndpointsModalVisible,
  submitLoading,
  detailLoading,
  
  // operation targets
  currentOperationService,
  currentServiceDetail,
  serviceEndpoints,
  
  // form models
  createFormModel,
  editFormModel,
  yamlFormModel,
  createYamlFormModel,
  
  // form refs
  formRef,
  editFormRef,
  yamlFormRef,
  createYamlFormRef,
  
  // form rules
  createFormRules,
  editFormRules,
  yamlFormRules,
  createYamlFormRules,
  
  // computed
  filteredServices,
  rowSelection,
  
  // helpers
  getEnvText,
  getStatusText,
  getStatusColor,
  getServiceTypeText,
  getServiceTypeColor,
  
  // operations
  fetchClusters,
  fetchNamespaces,
  fetchServices,
  clearServices,
  clearNamespaces,
  loadMoreClusters,
  loadMoreNamespaces,
  
  // detail operations
  showServiceDetail,
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
  
  // service operations
  deleteService,
  
  // endpoints operations
  showEndpointsModal,
  closeEndpointsModal,
  
  // filter operations
  addFilterLabel,
  removeFilterLabel,
  clearFilterLabels,
  
  // batch operations
  batchOperation,
  
  // pagination operations
  handlePageChange,
  onSearch,
  handleFilterChange,
  handleClusterChange,
  handleClusterDropdownScroll,
  
  // form field operations
  addPortField,
  removePortField,
  removeLabelField,
  removeAnnotationField,
  removeSelectorField,
  
  // edit form field operations
  addEditPortField,
  removeEditPortField,
  addNewEditLabel,
  removeEditLabelField,
  addNewEditSelector,
  removeEditSelectorField,
  addNewEditAnnotation,
  removeEditAnnotationField,
  
  // edit form helper variables
  newEditLabelKey,
  newEditSelectorKey,
  newEditAnnotationKey,
  
  // constants
  K8sSvcStatus,
} = useServicePage();

// 添加新标签/注解/选择器的方法
const newLabelKey = ref('');
const newAnnotationKey = ref('');
const newSelectorKey = ref('');

const addNewLabel = () => {
  if (newLabelKey.value && newLabelKey.value.trim()) {
    createFormModel.value.labels[newLabelKey.value.trim()] = '';
    newLabelKey.value = '';
  }
};

const addNewAnnotation = () => {
  if (newAnnotationKey.value && newAnnotationKey.value.trim()) {
    createFormModel.value.annotations[newAnnotationKey.value.trim()] = '';
    newAnnotationKey.value = '';
  }
};

const addNewSelector = () => {
  if (newSelectorKey.value && newSelectorKey.value.trim()) {
    createFormModel.value.selector[newSelectorKey.value.trim()] = '';
    newSelectorKey.value = '';
  }
};

// 表格分页变化处理
const handleTableChange = (pagination: { current?: number; pageSize?: number }) => {
  if (pagination) {
    handlePageChange(pagination.current || currentPage.value, pagination.pageSize);
  }
};

const columns = [
  { title: '名称', dataIndex: 'name', key: 'name', width: 150, ellipsis: true, fixed: 'left' },
  { title: '命名空间', dataIndex: 'namespace', key: 'namespace', width: 120, ellipsis: true },
  { title: '状态', dataIndex: 'status', key: 'status', width: 90, align: 'center', slots: { customRender: 'status' } },
  { title: '类型', dataIndex: 'type', key: 'type', width: 110, align: 'center', slots: { customRender: 'type' } },
  { title: '集群IP', dataIndex: 'cluster_ip', key: 'cluster_ip', width: 130, slots: { customRender: 'cluster_ip' } },
  { title: '端口', dataIndex: 'ports', key: 'ports', width: 200, slots: { customRender: 'ports' } },
  { title: '标签', dataIndex: 'labels', key: 'labels', width: 150, slots: { customRender: 'labels' } },
  { title: '注解', dataIndex: 'annotations', key: 'annotations', width: 120, slots: { customRender: 'annotations' } },
  { title: 'UID', dataIndex: 'uid', key: 'uid', width: 100, ellipsis: true, slots: { customRender: 'uid' } },
  { title: '创建时间', dataIndex: 'created_at', key: 'created_at', width: 160, slots: { customRender: 'createdAt' } },
  { title: '操作', key: 'actions', width: 230, fixed: 'right', align: 'center', slots: { customRender: 'actions' } },
];

const portColumns = [
  { title: '名称', dataIndex: 'name', key: 'name', slots: { customRender: 'name' } },
  { title: '协议', dataIndex: 'protocol', key: 'protocol', slots: { customRender: 'protocol' } },
  { title: '端口', dataIndex: 'port', key: 'port' },
  { title: '目标端口', dataIndex: 'target_port', key: 'target_port' },
  { title: '节点端口', dataIndex: 'node_port', key: 'node_port', slots: { customRender: 'node_port' } },
];

// 动态获取可见的端口列（只显示有数据的列）
const getVisiblePortColumns = (ports: any[]) => {
  if (!ports || ports.length === 0) return portColumns;
  
  // 检查是否有任何端口配置了 node_port
  const hasNodePort = ports.some(port => port.node_port && port.node_port > 0);
  
  // 如果没有 node_port，则过滤掉该列
  if (!hasNodePort) {
    return portColumns.filter(col => col.key !== 'node_port');
  }
  
  return portColumns;
};

const endpointColumns = [
  { title: 'IP地址', dataIndex: 'ip', key: 'ip' },
  { title: '端口', dataIndex: 'port', key: 'port' },
  { title: '协议', dataIndex: 'protocol', key: 'protocol' },
  { title: '状态', dataIndex: 'ready', key: 'ready', slots: { customRender: 'ready' } },
];

// 标签过滤器状态
const isLabelsFilterModalVisible = ref(false);
const newFilterKey = ref('');
const newFilterValue = ref('');

// 标签过滤器操作
const openLabelsFilter = () => {
  isLabelsFilterModalVisible.value = true;
};

const closeLabelsFilterModal = () => {
  isLabelsFilterModalVisible.value = false;
  newFilterKey.value = '';
  newFilterValue.value = '';
};

const addNewFilterLabel = () => {
  if (newFilterKey.value.trim() && newFilterValue.value.trim()) {
    addFilterLabel(newFilterKey.value.trim(), newFilterValue.value.trim());
    newFilterKey.value = '';
    newFilterValue.value = '';
  }
};

const applyLabelsFilter = () => {
  if (newFilterKey.value.trim() && newFilterValue.value.trim()) {
    addNewFilterLabel();
  }
  closeLabelsFilterModal();
};

// 重置所有筛选条件
const resetFilters = () => {
  filterStatus.value = undefined;
  filterType.value = undefined;
  searchText.value = '';
  filterClusterId.value = undefined;
  filterNamespace.value = undefined;
  clearFilterLabels();
  currentPage.value = 1;
  clearServices();
  clearNamespaces();
  message.success('已重置所有筛选条件');
};

// YAML 工具栏函数
const SERVICE_YAML_TEMPLATE = `apiVersion: v1
kind: Service
metadata:
  name: my-service
  namespace: default
spec:
  selector:
    app: my-app
  ports:
    - protocol: TCP
      port: 80
      targetPort: 8080
  type: ClusterIP`;

const insertYamlTemplate = () => {
  if (createYamlFormModel.value.yaml && createYamlFormModel.value.yaml.trim()) {
    Modal.confirm({
      title: '确认操作',
      content: '当前已有内容，插入模板将覆盖现有内容，是否继续？',
      okText: '确认',
      cancelText: '取消',
      centered: true,
      onOk: () => {
        createYamlFormModel.value.yaml = SERVICE_YAML_TEMPLATE;
        message.success('模板已插入');
      },
    });
  } else {
    createYamlFormModel.value.yaml = SERVICE_YAML_TEMPLATE;
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

    const service = parsed as any;
    const issues: string[] = [];

    if (!service.apiVersion) {
      issues.push('缺少 apiVersion 字段');
    }
    if (!service.kind) {
      issues.push('缺少 kind 字段');
    } else if (service.kind !== 'Service') {
      issues.push(`kind 应为 "Service"，当前为 "${service.kind}"`);
    }
    if (!service.metadata?.name) {
      issues.push('缺少 metadata.name 字段');
    }
    if (!service.spec) {
      issues.push('缺少 spec 字段');
    }

    if (issues.length > 0) {
      Modal.warning({
        title: 'YAML 格式检查警告',
        content: '发现以下问题：\n' + issues.join('\n'),
        width: 500,
        centered: true,
      });
    } else {
      message.success('YAML 格式检查通过');
    }
  } catch (error: any) {
    Modal.error({
      title: 'YAML 格式检查失败',
      content: `语法错误：${error.message || '未知错误'}`,
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

onMounted(async () => {
  await fetchClusters();
});
</script>

<style scoped>
@import '../shared/k8s-common.css';
</style>

<style scoped src="./Service.css"></style>
