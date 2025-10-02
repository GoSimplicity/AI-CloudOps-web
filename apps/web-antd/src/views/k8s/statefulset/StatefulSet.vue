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
                <h1>StatefulSet 管理</h1>
                <p class="k8s-page-subtitle">管理和监控集群中的所有 Kubernetes StatefulSet</p>
              </div>
            </div>
          </div>
        </a-col>
        <a-col :xs="24" :sm="24" :md="8" :lg="8" :xl="6">
          <div class="k8s-header-actions">
            <a-button type="primary" @click="openCreateModal" :disabled="!filterClusterId">
              <template #icon><PlusOutlined /></template>
              创建 StatefulSet
            </a-button>
            <a-button @click="fetchStatefulSets" :loading="loading">
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
            v-model:value="filterStatus" 
            placeholder="状态筛选" 
            class="k8s-filter-select" 
            allow-clear 
            @change="handleFilterChange"
          >
            <template #suffixIcon><FilterOutlined /></template>
            <a-select-option :value="K8sStatefulSetStatus.Running">✅ 运行中</a-select-option>
            <a-select-option :value="K8sStatefulSetStatus.Stopped">⏹️ 已停止</a-select-option>
            <a-select-option :value="K8sStatefulSetStatus.Updating">🔄 更新中</a-select-option>
            <a-select-option :value="K8sStatefulSetStatus.Error">❌ 异常</a-select-option>
          </a-select>

          <a-input 
            v-model:value="filterServiceName" 
            placeholder="服务名称" 
            class="k8s-filter-select" 
            allow-clear 
            @change="handleFilterChange"
            style="width: 160px;"
          >
            <template #prefix><ApiOutlined /></template>
          </a-input>
          
          <!-- 标签过滤器 -->
          <div class="statefulset-labels-filter">
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
            placeholder="🔍 搜索 StatefulSet 名称" 
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
            :disabled="!filterStatus && !searchText && !filterClusterId && !filterNamespace && !filterServiceName && Object.keys(filterLabels).length === 0"
            class="k8s-toolbar-btn"
            title="重置所有筛选条件"
          >
            <template #icon><DeleteOutlined /></template>
            重置筛选
          </a-button>
          
          <a-button 
            @click="fetchStatefulSets" 
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
            title="通过YAML创建StatefulSet"
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
            title="批量删除选中的 StatefulSet"
          >
            <template #icon><DeleteOutlined /></template>
            删除 ({{ selectedRows.length }})
          </a-button>

          <a-button 
            @click="() => batchOperation('重启')" 
            :disabled="!selectedRows.length" 
            v-if="selectedRows.length > 0"
            class="k8s-toolbar-btn"
            title="批量重启选中的 StatefulSet"
          >
            <template #icon><RedoOutlined /></template>
            重启 ({{ selectedRows.length }})
          </a-button>
        </div>
      </div>
    </div>

    <!-- 数据展示区域 -->
    <div class="k8s-data-display">
      <a-table
        :columns="columns"
        :data-source="filteredStatefulSets"
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
        class="k8s-table statefulset-table"
        :scroll="{ x: 1600 }"
      >
        <template #status="{ text }">
          <a-badge :status="getStatusColor(text)" :text="getStatusText(text)" />
        </template>

        <template #replicas="{ record }">
          <div class="statefulset-replicas">
            <span class="replicas-text">
              {{ record.ready_replicas }}/{{ record.replicas }}
            </span>
            <a-progress 
              :percent="record.replicas > 0 ? Math.round((record.ready_replicas / record.replicas) * 100) : 0" 
              size="small" 
              :show-info="false"
              :status="record.ready_replicas === record.replicas ? 'success' : 'active'"
              style="margin-top: 4px; max-width: 100px;"
            />
          </div>
        </template>

        <template #images="{ text }">
          <div class="statefulset-images">
            <a-tooltip v-for="(image, index) in (Array.isArray(text) ? text : []).slice(0, 2)" :key="index" :title="image">
              <a-tag class="image-tag">
                {{ image.split('/').pop()?.split(':')[0] || image }}
              </a-tag>
            </a-tooltip>
            <a-tooltip v-if="(Array.isArray(text) ? text : []).length > 2" :title="(Array.isArray(text) ? text : []).join('\n')">
              <a-tag class="image-tag">
                +{{ (Array.isArray(text) ? text : []).length - 2 }} 更多
              </a-tag>
            </a-tooltip>
            <span v-if="!text || !Array.isArray(text) || text.length === 0" class="k8s-no-data">-</span>
          </div>
        </template>

        <template #service_name="{ text }">
          <a-tag color="purple" v-if="text">{{ text }}</a-tag>
          <span v-else class="k8s-no-data">-</span>
        </template>

        <template #pod_management_policy="{ text }">
          <a-tag color="geekblue" v-if="text">{{ text }}</a-tag>
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

        <template #actions="{ record }">
          <div class="k8s-action-column">
            <a-tooltip title="查看详情">
              <a-button title="查看详情" @click="showStatefulSetDetail(record)">
                <template #icon><EyeOutlined /></template>
              </a-button>
            </a-tooltip>
            <a-tooltip title="查看 YAML">
              <a-button title="查看 YAML" @click="showYamlModal(record)">
                <template #icon><FileTextOutlined /></template>
              </a-button>
            </a-tooltip>
            <a-tooltip title="编辑">
              <a-button title="编辑" @click="openEditModal(record)">
                <template #icon><EditOutlined /></template>
              </a-button>
            </a-tooltip>
            <a-tooltip title="伸缩">
              <a-button title="伸缩" @click="openScaleModal(record)">
                <template #icon><ExpandOutlined /></template>
              </a-button>
            </a-tooltip>
            <a-tooltip title="重启">
              <a-button title="重启" @click="restartStatefulSet(record)">
                <template #icon><RedoOutlined /></template>
              </a-button>
            </a-tooltip>
            <a-tooltip title="回滚">
              <a-button title="回滚" @click="openRollbackModal(record)">
                <template #icon><RollbackOutlined /></template>
              </a-button>
            </a-tooltip>
            <a-tooltip title="查看 Pod">
              <a-button title="查看 Pod" @click="showPodModal(record)">
                <template #icon><ContainerOutlined /></template>
              </a-button>
            </a-tooltip>
            <a-tooltip title="版本历史">
              <a-button title="版本历史" @click="showHistoryModal(record)">
                <template #icon><HistoryOutlined /></template>
              </a-button>
            </a-tooltip>
            <a-tooltip title="删除">
              <a-button 
                title="删除" 
                danger 
                @click="deleteStatefulSet(record)"
              >
                <template #icon><DeleteOutlined /></template>
              </a-button>
            </a-tooltip>
          </div>
        </template>

        <template #emptyText>
          <div class="k8s-empty-state">
            <DatabaseOutlined />
            <p>暂无 StatefulSet 数据</p>
            <p>请先选择集群</p>
          </div>
        </template>
      </a-table>
    </div>

    <!-- 创建 StatefulSet 模态框 -->
    <a-modal
      v-model:open="isCreateModalVisible"
      title="创建 StatefulSet"
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
        <a-form-item label="StatefulSet 名称" name="name" :required="true">
          <a-input 
            v-model:value="createFormModel.name" 
            placeholder="请输入 StatefulSet 名称（例如：my-statefulset）" 
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
            <a-select-option 
              v-if="namespaces.length > 0 && namespaces.length < namespacesTotal" 
              :value="'__load_more_namespaces_create__'" 
              disabled
              style="text-align: center; color: #999;"
            >
              <a-button type="link" size="small" @click.stop="loadMoreNamespaces" :loading="namespacesLoading">
                加载更多...
              </a-button>
            </a-select-option>
          </a-select>
        </a-form-item>

        <a-form-item label="副本数量" name="replicas" :required="true">
          <a-input-number 
            v-model:value="createFormModel.replicas" 
            :min="0" 
            :max="100" 
            class="k8s-form-input"
            placeholder="副本数量"
          />
        </a-form-item>

        <a-form-item label="服务名称" name="service_name" :required="true">
          <a-input 
            v-model:value="createFormModel.service_name" 
            placeholder="请输入关联的服务名称（例如：my-service）" 
            class="k8s-form-input"
            :maxlength="63"
          />
          <div style="color: #999; font-size: 12px; margin-top: 4px;">
            StatefulSet 需要一个 Headless Service 来管理 Pod 的网络身份
          </div>
        </a-form-item>

        <a-form-item label="容器镜像">
          <div class="k8s-key-value-inputs">
            <div v-for="(_, index) in createFormModel.images" :key="index" class="k8s-key-value-row">
              <a-input 
                v-model:value="createFormModel.images[index]" 
                placeholder="容器镜像（例如：nginx:latest）" 
                class="k8s-form-input"
              />
              <a-button type="text" danger 
                @click="removeImageField(index)" 
                :disabled="createFormModel.images.length <= 1"
                size="small"
               class="k8s-remove-btn">
                <template #icon><DeleteOutlined /></template>
              </a-button>
            </div>
            <a-button type="dashed" @click="addImageField" style="margin-top: 8px;">
              <template #icon><PlusOutlined /></template>
              添加镜像
            </a-button>
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

    <!-- 通过 YAML 创建 StatefulSet 模态框 -->
    <a-modal
      v-model:open="isCreateYamlModalVisible"
      title="通过 YAML 创建 StatefulSet"
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
          <a-textarea 
            v-model:value="createYamlFormModel.yaml" 
            placeholder="请输入 StatefulSet YAML 内容" 
            :rows="20"
            class="k8s-config-textarea"
          />
        </a-form-item>
      </a-form>
    </a-modal>

    <!-- 编辑 StatefulSet 模态框 -->
    <a-modal
      v-model:open="isEditModalVisible"
      title="编辑 StatefulSet"
      @ok="submitEditForm"
      @cancel="closeEditModal"
      :confirmLoading="submitLoading"
      width="800px"
      :maskClosable="false"
      destroyOnClose
      okText="保存"
      cancelText="取消"
    >
      <a-form 
        ref="editFormRef"
        :model="editFormModel" 
        layout="vertical" 
        class="k8s-form"
        :rules="editFormRules"
      >
        <a-form-item label="StatefulSet 名称" name="name" :required="true">
          <a-input 
            v-model:value="editFormModel.name" 
            placeholder="请输入 StatefulSet 名称" 
            class="k8s-form-input"
            :maxlength="63"
            disabled
          />
        </a-form-item>

        <a-form-item label="命名空间" name="namespace" :required="true">
          <a-input 
            v-model:value="editFormModel.namespace" 
            placeholder="命名空间" 
            class="k8s-form-input"
            disabled
          />
        </a-form-item>

        <a-form-item label="副本数量" name="replicas" :required="true">
          <a-input-number 
            v-model:value="editFormModel.replicas" 
            :min="0" 
            :max="100" 
            class="k8s-form-input"
            placeholder="副本数量"
          />
        </a-form-item>

        <a-form-item label="容器镜像">
          <div class="k8s-key-value-inputs">
            <div v-for="(_, index) in editFormModel.images" :key="index" class="k8s-key-value-row">
              <a-input 
                v-model:value="editFormModel.images[index]" 
                placeholder="容器镜像（例如：nginx:latest）" 
                class="k8s-form-input"
              />
              <a-button type="text" danger 
                @click="removeEditImageField(index)" 
                :disabled="editFormModel.images.length <= 1"
                size="small"
               class="k8s-remove-btn">
                <template #icon><DeleteOutlined /></template>
              </a-button>
            </div>
            <a-button type="dashed" @click="addEditImageField" style="margin-top: 8px;">
              <template #icon><PlusOutlined /></template>
              添加镜像
            </a-button>
          </div>
        </a-form-item>

        <a-form-item label="标签配置（可选）" name="labels">
          <div class="k8s-key-value-inputs">
            <div v-if="!editFormModel.labels || editFormModel.labels.length === 0" style="text-align: center; color: #999; padding: 16px;">
              暂无标签，点击下方按钮添加
            </div>
            <div v-for="(label, index) in editFormModel.labels" :key="index" class="k8s-key-value-row">
              <a-input 
                v-model:value="label.key" 
                placeholder="标签键" 
                class="k8s-form-input"
                :maxlength="200"
              />
              <a-input 
                v-model:value="label.value" 
                placeholder="标签值" 
                class="k8s-form-input"
                :maxlength="200"
              />
              <a-button type="text" danger @click="() => removeEditLabelField(label.key)" size="small" class="k8s-remove-btn">
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
            <div v-if="!editFormModel.annotations || editFormModel.annotations.length === 0" style="text-align: center; color: #999; padding: 16px;">
              暂无注解，点击下方按钮添加
            </div>
            <div v-for="(annotation, index) in editFormModel.annotations" :key="index" class="k8s-key-value-row">
              <a-input 
                v-model:value="annotation.key" 
                placeholder="注解键" 
                class="k8s-form-input"
                :maxlength="500"
              />
              <a-input 
                v-model:value="annotation.value" 
                placeholder="注解值" 
                class="k8s-form-input"
                :maxlength="500"
              />
              <a-button type="text" danger @click="() => removeEditAnnotationField(annotation.key)" size="small" class="k8s-remove-btn">
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

    <!-- 详情模态框 -->
    <a-modal
      v-model:open="isDetailModalVisible"
      title="StatefulSet 详情"
      :footer="null"
      @cancel="closeDetailModal"
      width="1000px"
      :maskClosable="false"
      destroyOnClose
    >
      <a-spin :spinning="detailLoading">
        <div v-if="currentStatefulSetDetail" class="k8s-detail-content">
          <a-row :gutter="[24, 16]">
            <a-col :xs="24" :lg="12">
              <a-card title="基本信息" class="k8s-detail-card" size="small">
                <div class="k8s-detail-item">
                  <span class="k8s-detail-label">StatefulSet 名称:</span>
                  <span class="k8s-detail-value">{{ currentStatefulSetDetail.name }}</span>
                </div>
                <div class="k8s-detail-item">
                  <span class="k8s-detail-label">命名空间:</span>
                  <span class="k8s-detail-value">{{ currentStatefulSetDetail.namespace }}</span>
                </div>
                <div class="k8s-detail-item">
                  <span class="k8s-detail-label">状态:</span>
                  <a-badge :status="getStatusColor(currentStatefulSetDetail.status)" :text="getStatusText(currentStatefulSetDetail.status)" />
                </div>
                <div class="k8s-detail-item">
                  <span class="k8s-detail-label">集群ID:</span>
                  <span class="k8s-detail-value">{{ currentStatefulSetDetail.cluster_id }}</span>
                </div>
                <div class="k8s-detail-item">
                  <span class="k8s-detail-label">UID:</span>
                  <span class="k8s-detail-value">{{ currentStatefulSetDetail.uid || '-' }}</span>
                </div>
              </a-card>
            </a-col>
            
            <a-col :xs="24" :lg="12">
              <a-card title="副本信息" class="k8s-detail-card" size="small">
                <div class="k8s-detail-item">
                  <span class="k8s-detail-label">期望副本数:</span>
                  <span class="k8s-detail-value">{{ currentStatefulSetDetail.replicas }}</span>
                </div>
                <div class="k8s-detail-item">
                  <span class="k8s-detail-label">就绪副本数:</span>
                  <span class="k8s-detail-value">{{ currentStatefulSetDetail.ready_replicas }}</span>
                </div>
                <div class="k8s-detail-item">
                  <span class="k8s-detail-label">当前副本数:</span>
                  <span class="k8s-detail-value">{{ currentStatefulSetDetail.current_replicas }}</span>
                </div>
                <div class="k8s-detail-item">
                  <span class="k8s-detail-label">更新副本数:</span>
                  <span class="k8s-detail-value">{{ currentStatefulSetDetail.updated_replicas }}</span>
                </div>
              </a-card>
            </a-col>
          </a-row>

          <a-row :gutter="[24, 16]" style="margin-top: 16px;">
            <a-col :xs="24" :lg="12">
              <a-card title="服务信息" class="k8s-detail-card" size="small">
                <div class="k8s-detail-item">
                  <span class="k8s-detail-label">服务名称:</span>
                  <span class="k8s-detail-value">{{ currentStatefulSetDetail.service_name || '-' }}</span>
                </div>
                <div class="k8s-detail-item">
                  <span class="k8s-detail-label">Pod 管理策略:</span>
                  <span class="k8s-detail-value">{{ currentStatefulSetDetail.pod_management_policy || '-' }}</span>
                </div>
                <div class="k8s-detail-item">
                  <span class="k8s-detail-label">更新策略:</span>
                  <span class="k8s-detail-value">{{ currentStatefulSetDetail.update_strategy || '-' }}</span>
                </div>
                <div class="k8s-detail-item">
                  <span class="k8s-detail-label">历史版本限制:</span>
                  <span class="k8s-detail-value">{{ currentStatefulSetDetail.revision_history_limit || '-' }}</span>
                </div>
              </a-card>
            </a-col>

            <a-col :xs="24" :lg="12">
              <a-card title="容器镜像" class="k8s-detail-card" size="small">
                <div class="statefulset-images">
                  <a-tooltip v-for="(image, index) in (currentStatefulSetDetail.images || [])" :key="index" :title="image">
                    <a-tag class="image-tag" style="margin-bottom: 8px; max-width: 200px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; display: inline-block;">
                      {{ image }}
                    </a-tag>
                  </a-tooltip>
                  <span v-if="!currentStatefulSetDetail.images || currentStatefulSetDetail.images.length === 0" class="k8s-no-data">
                    暂无镜像信息
                  </span>
                </div>
              </a-card>
            </a-col>
          </a-row>

          <a-row :gutter="[24, 16]" style="margin-top: 16px;">
            <a-col :xs="24" :lg="12">
              <a-card title="标签信息" class="k8s-detail-card" size="small">
                <div class="k8s-labels-display">
                  <template v-if="Array.isArray(currentStatefulSetDetail.labels)">
                    <!-- 数组格式 -->
                    <a-tooltip v-for="label in currentStatefulSetDetail.labels" :key="label.key" :title="`${label.key}: ${label.value}`">
                      <div class="k8s-label-item" style="margin-bottom: 8px; display: inline-block; max-width: 100%; text-overflow: ellipsis; overflow: hidden; white-space: nowrap; margin-right: 8px;">
                        {{ label.key }}: {{ label.value }}
                      </div>
                    </a-tooltip>
                    <span v-if="currentStatefulSetDetail.labels.length === 0" class="k8s-no-data">
                      暂无标签
                    </span>
                  </template>
                  <template v-else-if="currentStatefulSetDetail.labels && typeof currentStatefulSetDetail.labels === 'object'">
                    <!-- 对象格式 -->
                    <a-tooltip v-for="[key, value] in Object.entries(currentStatefulSetDetail.labels)" :key="key" :title="`${key}: ${value}`">
                      <div class="k8s-label-item" style="margin-bottom: 8px; display: inline-block; max-width: 100%; text-overflow: ellipsis; overflow: hidden; white-space: nowrap; margin-right: 8px;">
                        {{ key }}: {{ value }}
                      </div>
                    </a-tooltip>
                    <span v-if="Object.keys(currentStatefulSetDetail.labels).length === 0" class="k8s-no-data">
                      暂无标签
                    </span>
                  </template>
                  <template v-else>
                    <span class="k8s-no-data">
                      暂无标签
                    </span>
                  </template>
                </div>
              </a-card>
            </a-col>

            <a-col :xs="24" :lg="12">
              <a-card title="注解信息" class="k8s-detail-card" size="small">
                <div class="k8s-annotations-display">
                  <template v-if="Array.isArray(currentStatefulSetDetail.annotations)">
                    <!-- 数组格式 -->
                    <a-tooltip v-for="annotation in currentStatefulSetDetail.annotations" :key="annotation.key" :title="`${annotation.key}: ${annotation.value}`">
                      <div class="k8s-annotation-item" style="margin-bottom: 8px; display: inline-block; max-width: 100%; text-overflow: ellipsis; overflow: hidden; white-space: nowrap; margin-right: 8px;">
                        {{ annotation.key }}: {{ annotation.value }}
                      </div>
                    </a-tooltip>
                    <span v-if="currentStatefulSetDetail.annotations.length === 0" class="k8s-no-data">
                      暂无注解
                    </span>
                  </template>
                  <template v-else-if="currentStatefulSetDetail.annotations && typeof currentStatefulSetDetail.annotations === 'object'">
                    <!-- 对象格式 -->
                    <a-tooltip v-for="[key, value] in Object.entries(currentStatefulSetDetail.annotations)" :key="key" :title="`${key}: ${value}`">
                      <div class="k8s-annotation-item" style="margin-bottom: 8px; display: inline-block; max-width: 100%; text-overflow: ellipsis; overflow: hidden; white-space: nowrap; margin-right: 8px;">
                        {{ key }}: {{ value }}
                      </div>
                    </a-tooltip>
                    <span v-if="Object.keys(currentStatefulSetDetail.annotations).length === 0" class="k8s-no-data">
                      暂无注解
                    </span>
                  </template>
                  <template v-else>
                    <span class="k8s-no-data">
                      暂无注解
                    </span>
                  </template>
                </div>
              </a-card>
            </a-col>
          </a-row>
        </div>
      </a-spin>
    </a-modal>

    <!-- 伸缩模态框 -->
    <a-modal
      v-model:open="isScaleModalVisible"
      title="伸缩 StatefulSet"
      @ok="submitScaleForm"
      @cancel="closeScaleModal"
      :confirmLoading="submitLoading"
      width="500px"
      :maskClosable="false"
      destroyOnClose
      okText="确认伸缩"
      cancelText="取消"
    >
      <a-form 
        ref="scaleFormRef"
        :model="scaleFormModel" 
        layout="vertical" 
        class="k8s-form"
        :rules="scaleFormRules"
      >
        <a-alert
          message="伸缩操作"
          :description="`即将对 StatefulSet '${currentOperationStatefulSet?.name}' 进行伸缩操作`"
          type="info"
          show-icon
          style="margin-bottom: 24px;"
        />
        
        <a-form-item label="副本数量" name="replicas" :required="true">
          <a-input-number 
            v-model:value="scaleFormModel.replicas" 
            :min="0" 
            :max="100" 
            class="k8s-form-input"
            placeholder="请输入副本数量"
          />
          <div style="color: #999; font-size: 12px; margin-top: 4px;">
            当前副本数：{{ currentOperationStatefulSet?.replicas }}
          </div>
        </a-form-item>
      </a-form>
    </a-modal>

    <!-- 回滚模态框 -->
    <a-modal
      v-model:open="isRollbackModalVisible"
      title="回滚 StatefulSet"
      @ok="submitRollbackForm"
      @cancel="closeRollbackModal"
      :confirmLoading="submitLoading"
      width="500px"
      :maskClosable="false"
      destroyOnClose
      okText="确认回滚"
      cancelText="取消"
      okType="warning"
    >
      <a-form 
        ref="rollbackFormRef"
        :model="rollbackFormModel" 
        layout="vertical" 
        class="k8s-form"
        :rules="rollbackFormRules"
      >
        <a-alert
          message="⚠️ 警告"
          :description="`即将回滚 StatefulSet '${currentOperationStatefulSet?.name}' 到指定版本`"
          type="warning"
          show-icon
          style="margin-bottom: 24px;"
        />
        
        <a-form-item label="回滚版本" name="revision" :required="true">
          <a-input-number 
            v-model:value="rollbackFormModel.revision" 
            :min="1" 
            class="k8s-form-input"
            placeholder="请输入要回滚到的版本号"
          />
          <div style="color: #999; font-size: 12px; margin-top: 4px;">
            请输入要回滚到的版本号（>=1）
          </div>
        </a-form-item>
      </a-form>
    </a-modal>

    <!-- YAML 模态框 -->
    <a-modal
      v-model:open="isYamlModalVisible"
      :title="`查看/编辑 ${currentOperationStatefulSet?.name} YAML`"
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

    <!-- Pod 列表模态框 -->
    <a-modal
      v-model:open="isPodModalVisible"
      :title="`${currentOperationStatefulSet?.name} Pod 列表`"
      :footer="null"
      @cancel="closePodModal"
      width="1000px"
      :maskClosable="false"
      destroyOnClose
    >
      <a-table
        :data-source="statefulSetPods"
        :pagination="false"
        :loading="submitLoading"
        size="small"
        class="k8s-table"
      >
        <a-table-column title="Pod 名称" dataIndex="name" key="name" />
        <a-table-column title="状态" dataIndex="status" key="status">
          <template #default="{ text }">
            <a-badge :status="text === 'Running' ? 'success' : 'error'" :text="text" />
          </template>
        </a-table-column>
        <a-table-column title="重启次数" dataIndex="restart_count" key="restart_count" />
        <a-table-column title="创建时间" dataIndex="created_at" key="created_at" />
      </a-table>
    </a-modal>

    <!-- 版本历史模态框 -->
    <a-modal
      v-model:open="isHistoryModalVisible"
      :title="`${currentOperationStatefulSet?.name} 版本历史`"
      :footer="null"
      @cancel="closeHistoryModal"
      width="800px"
      :maskClosable="false"
      destroyOnClose
    >
      <a-table
        :data-source="statefulSetHistory"
        :pagination="false"
        :loading="submitLoading"
        size="small"
        class="k8s-table"
      >
        <a-table-column title="版本" dataIndex="revision" key="revision" />
        <a-table-column title="日期" dataIndex="date" key="date" />
        <a-table-column title="变更说明" dataIndex="message" key="message" />
        <a-table-column title="操作" key="actions" width="100">
          <template #default="{ record }">
            <a-button 
              type="link" 
              size="small" 
              @click="rollbackToVersion(record.revision)"
              :disabled="record.revision === 1"
            >
              回滚到此版本
            </a-button>
          </template>
        </a-table-column>
      </a-table>
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
import { useStatefulSetPage } from './StatefulSet';
import { rollbackStatefulSetApi } from '#/api/core/k8s/k8s_statefulset';
import { 
  PlusOutlined, 
  ReloadOutlined, 
  FilterOutlined, 
  DeleteOutlined, 
  DeploymentUnitOutlined,
  AppstoreOutlined,
  EyeOutlined,
  EditOutlined,
  TagsOutlined,
  SearchOutlined,
  FileTextOutlined,
  ExpandOutlined,
  RedoOutlined,
  RollbackOutlined,
  ContainerOutlined,
  HistoryOutlined,
  DatabaseOutlined,
  ApiOutlined,
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
  filterServiceName,
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
  isScaleModalVisible,
  isRollbackModalVisible,
  isYamlModalVisible,
  isPodModalVisible,
  isHistoryModalVisible,
  submitLoading,
  detailLoading,
  
  // operation targets
  currentOperationStatefulSet,
  currentStatefulSetDetail,
  statefulSetPods,
  statefulSetHistory,
  
  // form models
  createFormModel,
  createYamlFormModel,
  editFormModel,
  scaleFormModel,
  rollbackFormModel,
  yamlFormModel,
  
  // form refs
  formRef,
  editFormRef,
  scaleFormRef,
  rollbackFormRef,
  yamlFormRef,
  createYamlFormRef,
  
  // form rules
  createFormRules,
  editFormRules,
  scaleFormRules,
  rollbackFormRules,
  yamlFormRules,
  createYamlFormRules,
  
  // computed
  filteredStatefulSets,
  rowSelection,
  
  // helpers
  getEnvText,
  getStatusText,
  getStatusColor,
  
  // operations
  fetchClusters,
  fetchNamespaces,
  fetchStatefulSets,
  clearStatefulSets,
  clearNamespaces,
  loadMoreClusters,
  loadMoreNamespaces,
  
  // detail operations
  showStatefulSetDetail,
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
  
  // statefulSet operations
  deleteStatefulSet,
  restartStatefulSet,
  
  // scale operations
  openScaleModal,
  closeScaleModal,
  submitScaleForm,
  
  // rollback operations
  openRollbackModal,
  closeRollbackModal,
  submitRollbackForm,
  
  // pod operations
  showPodModal,
  closePodModal,
  
  // history operations
  showHistoryModal,
  closeHistoryModal,
  
  // filter operations
  addFilterLabel,
  removeFilterLabel,
  clearFilterLabels,
  
  // batch operations
  batchOperation,
  
  // pagination operations
  handlePageChange,
  
  // form field operations
  addImageField,
  removeImageField,
  addEditImageField,
  removeEditImageField,
  removeLabelField,
  removeAnnotationField,
  removeEditLabelField,
  removeEditAnnotationField,
  
  // constants
  K8sStatefulSetStatus,
} = useStatefulSetPage();

// 添加新标签/注解的方法
const newLabelKey = ref('');
const newAnnotationKey = ref('');
const newEditLabelKey = ref('');
const newEditAnnotationKey = ref('');

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

const addNewEditLabel = () => {
  if (newEditLabelKey.value && newEditLabelKey.value.trim()) {
    editFormModel.value.labels.push({ key: newEditLabelKey.value.trim(), value: '' });
    newEditLabelKey.value = '';
  }
};

const addNewEditAnnotation = () => {
  if (newEditAnnotationKey.value && newEditAnnotationKey.value.trim()) {
    editFormModel.value.annotations.push({ key: newEditAnnotationKey.value.trim(), value: '' });
    newEditAnnotationKey.value = '';
  }
};

const onSearch = () => {
  currentPage.value = 1;
  fetchStatefulSets();
};

const handleFilterChange = () => {
  currentPage.value = 1;
  fetchStatefulSets();
};

const handleClusterChange = () => {
  currentPage.value = 1;
  clearNamespaces();
  clearStatefulSets();
  
  if (filterClusterId.value) {
    const selectedCluster = clusters.value.find(c => c.id === filterClusterId.value);
    if (selectedCluster) {
      message.info(`已切换到集群: ${selectedCluster.name}`);
    }
    fetchNamespaces(true); // 重置命名空间分页
    fetchStatefulSets();
  } else {
    message.info('已清空 StatefulSet 列表，请选择集群查看 StatefulSet');
  }
};

const handleTableChange = (pagination: { current?: number; pageSize?: number }) => {
  if (pagination) {
    handlePageChange(pagination.current || currentPage.value, pagination.pageSize);
  }
};

// 处理集群下拉选择的滚动事件
const handleClusterDropdownScroll = (e: Event) => {
  const { target } = e;
  if (target && 'scrollTop' in target && 'scrollHeight' in target && 'clientHeight' in target) {
    const scrollTarget = target as HTMLElement;
    if (scrollTarget.scrollTop + scrollTarget.clientHeight >= scrollTarget.scrollHeight - 5) {
      loadMoreClusters();
    }
  }
};

const columns = [
  { title: '名称', dataIndex: 'name', key: 'name', width: '15%' },
  { title: '命名空间', dataIndex: 'namespace', key: 'namespace', width: '12%' },
  { title: '状态', dataIndex: 'status', key: 'status', width: '8%', slots: { customRender: 'status' } },
  { title: '副本数', key: 'replicas', width: '10%', slots: { customRender: 'replicas' } },
  { title: '服务名称', dataIndex: 'service_name', key: 'service_name', width: '12%', slots: { customRender: 'service_name' } },
  { title: 'Pod管理策略', dataIndex: 'pod_management_policy', key: 'pod_management_policy', width: '12%', slots: { customRender: 'pod_management_policy' } },
  { title: '镜像', dataIndex: 'images', key: 'images', width: '15%', slots: { customRender: 'images' } },
  { title: '标签', dataIndex: 'labels', key: 'labels', width: '12%', slots: { customRender: 'labels' } },
  { title: '操作', key: 'actions', width: '20%', fixed: 'right', slots: { customRender: 'actions' } },
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
  searchText.value = '';
  filterClusterId.value = undefined;
  filterNamespace.value = undefined;
  filterServiceName.value = undefined;
  clearFilterLabels();
  currentPage.value = 1;
  clearStatefulSets();
  clearNamespaces();
  message.success('已重置所有筛选条件');
};

// 快速回滚到指定版本
const rollbackToVersion = (revision: number) => {
  if (!currentOperationStatefulSet.value) return;
  
  Modal.confirm({
    title: '回滚确认',
    content: `确定要将 StatefulSet "${currentOperationStatefulSet.value.name}" 回滚到版本 ${revision} 吗？`,
    okText: '确认回滚',
    okType: 'primary',
    cancelText: '取消',
    centered: true,
      onOk: async () => {
        try {
          const clusterId = currentOperationStatefulSet.value!.cluster_id || filterClusterId.value;
          if (!clusterId || clusterId === 0) {
            message.error('无效的集群ID，请重新选择集群');
            return;
          }
          
          await rollbackStatefulSetApi(
            clusterId,
            currentOperationStatefulSet.value!.namespace,
            currentOperationStatefulSet.value!.name,
            {
              cluster_id: clusterId,
              namespace: currentOperationStatefulSet.value!.namespace,
              name: currentOperationStatefulSet.value!.name,
              revision
            }
          );
          message.success(`🎉 StatefulSet 回滚到版本 ${revision} 成功`);
          closeHistoryModal();
          await fetchStatefulSets();
        } catch (err) {
          message.error(`❌ StatefulSet 回滚到版本 ${revision} 失败`);
          console.error(err);
        }
      },
  });
};

onMounted(async () => {
  await fetchClusters();
});
</script>

<style scoped>
@import '../shared/k8s-common.css';
</style>

<style scoped src="./StatefulSet.css"></style>
