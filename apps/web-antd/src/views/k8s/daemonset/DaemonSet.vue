<template>
  <div class="k8s-management-container">
    <!-- 页面头部 -->
    <div class="k8s-page-header">
      <a-row class="k8s-header-content" :gutter="[24, 16]">
        <a-col :xs="24" :sm="24" :md="16" :lg="16" :xl="18">
          <div class="k8s-title-section">
            <div class="k8s-page-title">
              <HddOutlined class="k8s-title-icon" />
              <div>
                <h1>DaemonSet 管理</h1>
                <p class="k8s-page-subtitle">管理和监控集群中的所有 Kubernetes DaemonSet</p>
              </div>
            </div>
          </div>
        </a-col>
        <a-col :xs="24" :sm="24" :md="8" :lg="8" :xl="6">
          <div class="k8s-header-actions">
            <a-button type="primary" @click="openCreateModal" :disabled="!filterClusterId">
              <template #icon><PlusOutlined /></template>
              创建 DaemonSet
            </a-button>
            <a-button @click="fetchDaemonSets" :loading="loading">
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
            <a-select-option :value="K8sDaemonSetStatus.Running">✅ 运行中</a-select-option>
            <a-select-option :value="K8sDaemonSetStatus.Error">❌ 异常</a-select-option>
            <a-select-option :value="K8sDaemonSetStatus.Updating">🔄 更新中</a-select-option>
          </a-select>
          
          <!-- 标签过滤器 -->
          <div class="daemonset-labels-filter">
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
            placeholder="🔍 搜索 DaemonSet 名称" 
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
            :disabled="!filterStatus && !searchText && !filterClusterId && !filterNamespace && Object.keys(filterLabels).length === 0"
            class="k8s-toolbar-btn"
            title="重置所有筛选条件"
          >
            <template #icon><DeleteOutlined /></template>
            重置筛选
          </a-button>
          
          <a-button 
            @click="fetchDaemonSets" 
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
            title="通过YAML创建DaemonSet"
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
            title="批量删除选中的 DaemonSet"
          >
            <template #icon><DeleteOutlined /></template>
            删除 ({{ selectedRows.length }})
          </a-button>

          <a-button 
            @click="() => batchOperation('重启')" 
            :disabled="!selectedRows.length" 
            v-if="selectedRows.length > 0"
            class="k8s-toolbar-btn"
            title="批量重启选中的 DaemonSet"
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
        :data-source="filteredDaemonSets"
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
        class="k8s-table daemonset-table"
        :scroll="{ x: 1600 }"
      >
        <template #status="{ text }">
          <a-badge :status="getStatusColor(text)" :text="getStatusText(text)" />
        </template>

        <template #pods="{ record }">
          <div class="daemonset-pods">
            <span class="pods-text">
              {{ record.number_ready }}/{{ record.desired_number_scheduled }}
            </span>
            <a-progress 
              :percent="record.desired_number_scheduled > 0 ? Math.round((record.number_ready / record.desired_number_scheduled) * 100) : 0" 
              size="small" 
              :show-info="false"
              :status="record.number_ready === record.desired_number_scheduled ? 'success' : 'active'"
              style="margin-top: 4px; max-width: 100px;"
            />
          </div>
        </template>

        <template #images="{ text }">
          <div class="daemonset-images">
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

        <template #update_strategy="{ text }">
          <a-tag color="cyan" v-if="text">{{ text }}</a-tag>
          <span v-else class="k8s-no-data">-</span>
        </template>

        <template #node_info="{ record }">
          <div class="daemonset-node-info">
            <div class="node-info-item">
              <span class="node-info-label">可用:</span>
              <span class="node-info-value">{{ record.number_available || 0 }}</span>
            </div>
            <div class="node-info-item">
              <span class="node-info-label">不可用:</span>
              <span class="node-info-value">{{ record.number_unavailable || 0 }}</span>
            </div>
            <div class="node-info-item">
              <span class="node-info-label">错误调度:</span>
              <span class="node-info-value">{{ record.number_misscheduled || 0 }}</span>
            </div>
          </div>
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
              <a-button title="查看详情" @click="showDaemonSetDetail(record)">
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
            <a-tooltip title="重启">
              <a-button title="重启" @click="restartDaemonSet(record)">
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
                @click="deleteDaemonSet(record)"
              >
                <template #icon><DeleteOutlined /></template>
              </a-button>
            </a-tooltip>
          </div>
        </template>

        <template #emptyText>
          <div class="k8s-empty-state">
            <HddOutlined />
            <p>暂无 DaemonSet 数据</p>
            <p>请先选择集群</p>
          </div>
        </template>
      </a-table>
    </div>

    <!-- 创建 DaemonSet 模态框 -->
    <a-modal
      v-model:open="isCreateModalVisible"
      title="创建 DaemonSet"
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
        <a-form-item label="DaemonSet 名称" name="name" :required="true">
          <a-input 
            v-model:value="createFormModel.name" 
            placeholder="请输入 DaemonSet 名称（例如：my-daemonset）" 
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

    <!-- 通过 YAML 创建 DaemonSet 模态框 -->
    <a-modal
      v-model:open="isCreateYamlModalVisible"
      title="通过 YAML 创建 DaemonSet"
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
            placeholder="请输入 DaemonSet YAML 内容" 
            :rows="20"
            class="k8s-config-textarea"
          />
        </a-form-item>
      </a-form>
    </a-modal>

    <!-- 详情模态框 -->
    <a-modal
      v-model:open="isDetailModalVisible"
      title="DaemonSet 详情"
      :footer="null"
      @cancel="closeDetailModal"
      width="1000px"
      :maskClosable="false"
      destroyOnClose
    >
      <a-spin :spinning="detailLoading">
        <div v-if="currentDaemonSetDetail" class="k8s-detail-content">
          <a-row :gutter="[24, 16]">
            <a-col :xs="24" :lg="12">
              <a-card title="基本信息" class="k8s-detail-card" size="small">
                <div class="k8s-detail-item">
                  <span class="k8s-detail-label">DaemonSet 名称:</span>
                  <span class="k8s-detail-value">{{ currentDaemonSetDetail.name }}</span>
                </div>
                <div class="k8s-detail-item">
                  <span class="k8s-detail-label">命名空间:</span>
                  <span class="k8s-detail-value">{{ currentDaemonSetDetail.namespace }}</span>
                </div>
                <div class="k8s-detail-item">
                  <span class="k8s-detail-label">状态:</span>
                  <a-badge :status="getStatusColor(currentDaemonSetDetail.status)" :text="getStatusText(currentDaemonSetDetail.status)" />
                </div>
                <div class="k8s-detail-item">
                  <span class="k8s-detail-label">集群ID:</span>
                  <span class="k8s-detail-value">{{ currentDaemonSetDetail.cluster_id }}</span>
                </div>
                <div class="k8s-detail-item">
                  <span class="k8s-detail-label">UID:</span>
                  <span class="k8s-detail-value">{{ currentDaemonSetDetail.uid || '-' }}</span>
                </div>
              </a-card>
            </a-col>
            
            <a-col :xs="24" :lg="12">
              <a-card title="Pod 调度信息" class="k8s-detail-card" size="small">
                <div class="k8s-detail-item">
                  <span class="k8s-detail-label">期望调度数:</span>
                  <span class="k8s-detail-value">{{ currentDaemonSetDetail.desired_number_scheduled }}</span>
                </div>
                <div class="k8s-detail-item">
                  <span class="k8s-detail-label">当前调度数:</span>
                  <span class="k8s-detail-value">{{ currentDaemonSetDetail.current_number_scheduled }}</span>
                </div>
                <div class="k8s-detail-item">
                  <span class="k8s-detail-label">就绪 Pod 数:</span>
                  <span class="k8s-detail-value">{{ currentDaemonSetDetail.number_ready }}</span>
                </div>
                <div class="k8s-detail-item">
                  <span class="k8s-detail-label">可用 Pod 数:</span>
                  <span class="k8s-detail-value">{{ currentDaemonSetDetail.number_available }}</span>
                </div>
                <div class="k8s-detail-item">
                  <span class="k8s-detail-label">不可用 Pod 数:</span>
                  <span class="k8s-detail-value">{{ currentDaemonSetDetail.number_unavailable }}</span>
                </div>
              </a-card>
            </a-col>
          </a-row>

          <a-row :gutter="[24, 16]" style="margin-top: 16px;">
            <a-col :xs="24" :lg="12">
              <a-card title="更新策略" class="k8s-detail-card" size="small">
                <div class="k8s-detail-item">
                  <span class="k8s-detail-label">策略类型:</span>
                  <span class="k8s-detail-value">{{ currentDaemonSetDetail.update_strategy || '-' }}</span>
                </div>
                <div class="k8s-detail-item">
                  <span class="k8s-detail-label">历史版本限制:</span>
                  <span class="k8s-detail-value">{{ currentDaemonSetDetail.revision_history_limit || '-' }}</span>
                </div>
                <div class="k8s-detail-item">
                  <span class="k8s-detail-label">更新策略:</span>
                  <span class="k8s-detail-value">{{ currentDaemonSetDetail.update_strategy || 'RollingUpdate' }}</span>
                </div>
              </a-card>
            </a-col>

            <a-col :xs="24" :lg="12">
              <a-card title="容器镜像" class="k8s-detail-card" size="small">
                <div class="daemonset-images">
                  <a-tooltip v-for="(image, index) in (currentDaemonSetDetail.images || [])" :key="index" :title="image">
                    <a-tag class="image-tag" style="margin-bottom: 8px; max-width: 200px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; display: inline-block;">
                      {{ image }}
                    </a-tag>
                  </a-tooltip>
                  <span v-if="!currentDaemonSetDetail.images || currentDaemonSetDetail.images.length === 0" class="k8s-no-data">
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
                  <template v-if="Array.isArray(currentDaemonSetDetail.labels)">
                    <!-- 数组格式 -->
                    <a-tooltip v-for="label in currentDaemonSetDetail.labels" :key="label.key" :title="`${label.key}: ${label.value}`">
                      <div class="k8s-label-item" style="margin-bottom: 8px; display: inline-block; max-width: 100%; text-overflow: ellipsis; overflow: hidden; white-space: nowrap; margin-right: 8px;">
                        {{ label.key }}: {{ label.value }}
                      </div>
                    </a-tooltip>
                    <span v-if="currentDaemonSetDetail.labels.length === 0" class="k8s-no-data">
                      暂无标签
                    </span>
                  </template>
                  <template v-else-if="currentDaemonSetDetail.labels && typeof currentDaemonSetDetail.labels === 'object'">
                    <!-- 对象格式 -->
                    <a-tooltip v-for="[key, value] in Object.entries(currentDaemonSetDetail.labels)" :key="key" :title="`${key}: ${value}`">
                      <div class="k8s-label-item" style="margin-bottom: 8px; display: inline-block; max-width: 100%; text-overflow: ellipsis; overflow: hidden; white-space: nowrap; margin-right: 8px;">
                        {{ key }}: {{ value }}
                      </div>
                    </a-tooltip>
                    <span v-if="Object.keys(currentDaemonSetDetail.labels).length === 0" class="k8s-no-data">
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
                  <template v-if="Array.isArray(currentDaemonSetDetail.annotations)">
                    <!-- 数组格式 -->
                    <a-tooltip v-for="annotation in currentDaemonSetDetail.annotations" :key="annotation.key" :title="`${annotation.key}: ${annotation.value}`">
                      <div class="k8s-annotation-item" style="margin-bottom: 8px; display: inline-block; max-width: 100%; text-overflow: ellipsis; overflow: hidden; white-space: nowrap; margin-right: 8px;">
                        {{ annotation.key }}: {{ annotation.value }}
                      </div>
                    </a-tooltip>
                    <span v-if="currentDaemonSetDetail.annotations.length === 0" class="k8s-no-data">
                      暂无注解
                    </span>
                  </template>
                  <template v-else-if="currentDaemonSetDetail.annotations && typeof currentDaemonSetDetail.annotations === 'object'">
                    <!-- 对象格式 -->
                    <a-tooltip v-for="[key, value] in Object.entries(currentDaemonSetDetail.annotations)" :key="key" :title="`${key}: ${value}`">
                      <div class="k8s-annotation-item" style="margin-bottom: 8px; display: inline-block; max-width: 100%; text-overflow: ellipsis; overflow: hidden; white-space: nowrap; margin-right: 8px;">
                        {{ key }}: {{ value }}
                      </div>
                    </a-tooltip>
                    <span v-if="Object.keys(currentDaemonSetDetail.annotations).length === 0" class="k8s-no-data">
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

    <!-- 编辑模态框 -->
    <a-modal
      v-model:open="isEditModalVisible"
      title="编辑 DaemonSet"
      @ok="submitEditForm"
      @cancel="closeEditModal"
      :confirmLoading="submitLoading"
      width="800px"
      :maskClosable="false"
      destroyOnClose
      okText="确认更新"
      cancelText="取消"
      okType="primary"
    >
      <a-form 
        ref="editFormRef"
        :model="editFormModel" 
        layout="vertical" 
        class="k8s-form"
      >
        <a-row :gutter="16">
          <a-col :span="12">
            <a-form-item label="名称" name="name">
              <a-input 
                v-model:value="editFormModel.name" 
                class="k8s-form-input"
                disabled
              />
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item label="命名空间" name="namespace">
              <a-input 
                v-model:value="editFormModel.namespace" 
                class="k8s-form-input"
                disabled
              />
            </a-form-item>
          </a-col>
        </a-row>

        <a-form-item label="镜像" name="image">
          <a-input 
            v-model:value="editFormModel.image" 
            class="k8s-form-input"
            placeholder="请输入容器镜像"
          />
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
              <a-button type="text" danger @click="() = class="k8s-remove-btn"> removeEditLabelField(label.key)" size="small">
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
              <a-button type="text" danger @click="() = class="k8s-remove-btn"> removeEditAnnotationField(annotation.key)" size="small">
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

    <!-- 回滚模态框 -->
    <a-modal
      v-model:open="isRollbackModalVisible"
      title="回滚 DaemonSet"
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
          :description="`即将回滚 DaemonSet '${currentOperationDaemonSet?.name}' 到指定版本`"
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
      :title="`查看/编辑 ${currentOperationDaemonSet?.name} YAML`"
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
      :title="`${currentOperationDaemonSet?.name} Pod 列表`"
      :footer="null"
      @cancel="closePodModal"
      width="1000px"
      :maskClosable="false"
      destroyOnClose
    >
      <a-table
        :data-source="daemonSetPods"
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
        <a-table-column title="节点名称" dataIndex="node_name" key="node_name" />
      </a-table>
    </a-modal>

    <!-- 版本历史模态框 -->
    <a-modal
      v-model:open="isHistoryModalVisible"
      :title="`${currentOperationDaemonSet?.name} 版本历史`"
      :footer="null"
      @cancel="closeHistoryModal"
      width="800px"
      :maskClosable="false"
      destroyOnClose
    >
      <a-table
        :data-source="daemonSetHistory"
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
import { useDaemonSetPage } from './DaemonSet';
import { rollbackDaemonSetApi } from '#/api/core/k8s/k8s_daemonset';
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
  RedoOutlined,
  RollbackOutlined,
  ContainerOutlined,
  HistoryOutlined,
  HddOutlined,
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
  isRollbackModalVisible,
  isYamlModalVisible,
  isPodModalVisible,
  isHistoryModalVisible,
  submitLoading,
  detailLoading,
  
  // operation targets
  currentOperationDaemonSet,
  currentDaemonSetDetail,
  daemonSetPods,
  daemonSetHistory,
  
  // form models
  createFormModel,
  editFormModel,
  createYamlFormModel,
  rollbackFormModel,
  yamlFormModel,
  
  // form refs
  formRef,
  editFormRef,
  rollbackFormRef,
  yamlFormRef,
  createYamlFormRef,
  
  // form rules
  createFormRules,
  rollbackFormRules,
  yamlFormRules,
  createYamlFormRules,
  
  // computed
  filteredDaemonSets,
  rowSelection,
  
  // helpers
  getEnvText,
  getStatusText,
  getStatusColor,
  
  // operations
  fetchClusters,
  fetchNamespaces,
  fetchDaemonSets,
  clearDaemonSets,
  clearNamespaces,
  loadMoreClusters,
  loadMoreNamespaces,
  
  // detail operations
  showDaemonSetDetail,
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
  
  // daemonSet operations
  deleteDaemonSet,
  restartDaemonSet,
  
  // edit operations
  openEditModal,
  closeEditModal,
  submitEditForm,
  
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
  removeLabelField,
  removeAnnotationField,
  removeEditLabelField,
  removeEditAnnotationField,
  
  // constants
  K8sDaemonSetStatus,
} = useDaemonSetPage();

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

// 编辑模态框专用的方法
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
  fetchDaemonSets();
};

const handleFilterChange = () => {
  currentPage.value = 1;
  fetchDaemonSets();
};

const handleClusterChange = () => {
  currentPage.value = 1;
  clearNamespaces();
  clearDaemonSets();
  
  if (filterClusterId.value) {
    const selectedCluster = clusters.value.find(c => c.id === filterClusterId.value);
    if (selectedCluster) {
      message.info(`已切换到集群: ${selectedCluster.name}`);
    }
    fetchNamespaces(true); // 重置命名空间分页
    fetchDaemonSets();
  } else {
    message.info('已清空 DaemonSet 列表，请选择集群查看 DaemonSet');
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
  { title: 'Pod 数量', key: 'pods', width: '12%', slots: { customRender: 'pods' } },
  { title: '更新策略', dataIndex: 'update_strategy', key: 'update_strategy', width: '10%', slots: { customRender: 'update_strategy' } },
  { title: '节点信息', key: 'node_info', width: '15%', slots: { customRender: 'node_info' } },
  { title: '镜像', dataIndex: 'images', key: 'images', width: '15%', slots: { customRender: 'images' } },
  { title: '标签', dataIndex: 'labels', key: 'labels', width: '12%', slots: { customRender: 'labels' } },
  { title: '操作', key: 'actions', width: '18%', fixed: 'right', slots: { customRender: 'actions' } },
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
  clearFilterLabels();
  currentPage.value = 1;
  clearDaemonSets();
  clearNamespaces();
  message.success('已重置所有筛选条件');
};

// 快速回滚到指定版本
const rollbackToVersion = (revision: number) => {
  if (!currentOperationDaemonSet.value) return;
  
  Modal.confirm({
    title: '回滚确认',
    content: `确定要将 DaemonSet "${currentOperationDaemonSet.value.name}" 回滚到版本 ${revision} 吗？`,
    okText: '确认回滚',
    okType: 'primary',
    cancelText: '取消',
    centered: true,
      onOk: async () => {
        try {
          const clusterId = currentOperationDaemonSet.value!.cluster_id || filterClusterId.value;
          if (!clusterId || clusterId === 0) {
            message.error('无效的集群ID，请重新选择集群');
            return;
          }
          
          await rollbackDaemonSetApi(
            clusterId,
            currentOperationDaemonSet.value!.namespace,
            currentOperationDaemonSet.value!.name,
            {
              cluster_id: clusterId,
              namespace: currentOperationDaemonSet.value!.namespace,
              name: currentOperationDaemonSet.value!.name,
              revision
            }
          );
          message.success(`🎉 DaemonSet 回滚到版本 ${revision} 成功`);
          closeHistoryModal();
          await fetchDaemonSets();
        } catch (err) {
          message.error(`❌ DaemonSet 回滚到版本 ${revision} 失败`);
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

<style scoped src="./DaemonSet.css"></style>
