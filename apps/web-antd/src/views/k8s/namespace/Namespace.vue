<template>
  <div class="k8s-management-container">
    <!-- 页面头部 -->
    <div class="k8s-page-header">
      <a-row class="k8s-header-content" :gutter="[24, 16]">
        <a-col :xs="24" :sm="24" :md="16" :lg="16" :xl="18">
          <div class="k8s-title-section">
            <div class="k8s-page-title">
              <AppstoreOutlined class="k8s-title-icon" />
              <div>
                <h1>命名空间管理</h1>
                <p class="k8s-page-subtitle">管理和监控集群中的所有 Kubernetes 命名空间</p>
              </div>
            </div>
          </div>
        </a-col>
        <a-col :xs="24" :sm="24" :md="8" :lg="8" :xl="6">
          <div class="k8s-header-actions">
            <a-button type="primary" @click="openCreateModal" :disabled="!filterClusterId">
              <template #icon><PlusOutlined /></template>
              创建命名空间
            </a-button>
            <a-button @click="fetchNamespaces" :loading="loading">
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
            v-model:value="filterStatus" 
            placeholder="状态筛选" 
            class="k8s-filter-select" 
            allow-clear 
            @change="handleFilterChange"
          >
            <template #suffixIcon><FilterOutlined /></template>
            <a-select-option :value="NamespaceStatus.Active">✅ 活跃</a-select-option>
            <a-select-option :value="NamespaceStatus.Terminating">⏹️ 终止中</a-select-option>
            <a-select-option :value="NamespaceStatus.Unknown">❓ 未知</a-select-option>
          </a-select>
          
          <!-- 标签过滤器 -->
          <div class="namespace-labels-filter">
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
            placeholder="🔍 搜索命名空间名称" 
            class="k8s-search-input" 
            @pressEnter="onSearch"
            @input="onSearch"
            allow-clear 
          >
            <template #suffix>
              <search-outlined class="k8s-search-icon" />
            </template>
          </a-input>
        </div>
      </div>
      
      <!-- 操作区域 -->
      <div class="k8s-toolbar-actions">
        <div class="k8s-action-buttons">
          <a-button 
            @click="() => resetFilters()" 
            :disabled="!filterStatus && !searchText && !filterClusterId && Object.keys(filterLabels).length === 0"
            class="k8s-toolbar-btn"
            title="重置所有筛选条件"
          >
            <template #icon><DeleteOutlined /></template>
            重置筛选
          </a-button>
          
          <a-button 
            @click="fetchNamespaces" 
            :loading="loading"
            class="k8s-toolbar-btn"
            title="刷新数据"
          >
            <template #icon><ReloadOutlined /></template>
            刷新
          </a-button>
          
          <a-button 
            type="primary" 
            danger 
            @click="() => batchOperation('删除')" 
            :disabled="!selectedRows.length" 
            v-if="selectedRows.length > 0"
            class="k8s-toolbar-btn"
            title="批量删除选中的命名空间"
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
        :data-source="filteredNamespaces"
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
        class="k8s-table namespace-table"
        :scroll="{ x: 1400 }"
      >
        <template #status="{ text }">
          <a-badge :status="getStatusColor(text)" :text="getStatusText(text)" />
        </template>

        <template #phase="{ text }">
          <a-badge :status="getPhaseColor(text)" :text="getPhaseText(text)" />
        </template>

        <template #labels="{ text }">
          <div class="k8s-labels-display">
            <a-tooltip v-for="label in (text || []).slice(0, 3)" :key="label.key" :title="`${label.key}: ${label.value}`">
              <a-tag class="k8s-label-item">
                {{ label.key }}: {{ label.value }}
              </a-tag>
            </a-tooltip>
            <a-tooltip v-if="(text || []).length > 3" :title="(text || []).map((item: any) => `${item.key}: ${item.value}`).join('\n')">
              <a-tag class="k8s-label-item">
                {{ (text || []).length }} 个标签
              </a-tag>
            </a-tooltip>
            <span v-if="!text || text.length === 0" class="k8s-no-data">-</span>
          </div>
        </template>

        <template #annotations="{ text }">
          <div class="k8s-annotations-display">
            <a-tag v-for="annotation in (text || []).slice(0, 2)" :key="annotation.key" class="k8s-annotation-item">
              {{ annotation.key }}: {{ annotation.value }}
            </a-tag>
            <a-tooltip v-if="(text || []).length > 2" :title="(text || []).map((item: any) => `${item.key}: ${item.value}`).join('\n')">
              <a-tag class="k8s-annotation-item">
                {{ (text || []).length }} 个注解
              </a-tag>
            </a-tooltip>
            <span v-if="!text || text.length === 0" class="k8s-no-data">-</span>
          </div>
        </template>

        <template #actions="{ record }">
          <div class="k8s-action-column">
            <a-tooltip title="查看详情">
              <a-button title="查看详情" @click="showNamespaceDetail(record)">
                <template #icon><EyeOutlined /></template>
              </a-button>
            </a-tooltip>
            <a-tooltip title="管理标签/注解">
              <a-button title="管理标签" @click="openEditLabelModal(record)">
                <template #icon><TagsOutlined /></template>
              </a-button>
            </a-tooltip>
            <a-tooltip title="删除命名空间">
              <a-button 
                title="删除" 
                class="ant-btn-dangerous" 
                @click="deleteNamespace(record)" 
                :disabled="record.name === 'default' || record.name === 'kube-system' || record.name === 'kube-public' || record.name === 'kube-node-lease'"
              >
                <template #icon><DeleteOutlined /></template>
              </a-button>
            </a-tooltip>
            <a-tooltip title="强制删除" v-if="record.status === NamespaceStatus.Terminating">
              <a-button 
                title="强制删除" 
                class="ant-btn-dangerous" 
                @click="forceDeleteNamespace(record)" 
                :disabled="record.name === 'default' || record.name === 'kube-system' || record.name === 'kube-public' || record.name === 'kube-node-lease'"
              >
                <template #icon><FireOutlined /></template>
              </a-button>
            </a-tooltip>
          </div>
        </template>

        <template #emptyText>
          <div class="k8s-empty-state">
            <AppstoreOutlined />
            <p>暂无命名空间数据</p>
            <p>请先选择集群</p>
          </div>
        </template>
      </a-table>
    </div>

    <!-- 创建命名空间模态框 -->
    <a-modal
      v-model:open="isCreateModalVisible"
      title="创建命名空间"
      @ok="submitCreateForm"
      @cancel="closeCreateModal"
      :confirmLoading="submitLoading"
      width="600px"
      :maskClosable="false"
      destroyOnClose
      okText="创建"
      cancelText="取消"
    >
      <a-form 
        ref="createFormRef"
        :model="createFormModel" 
        layout="vertical" 
        class="create-form"
        :rules="createFormRules"
      >
        <a-form-item label="命名空间名称" name="name" :required="true">
          <a-input 
            v-model:value="createFormModel.name" 
            placeholder="请输入命名空间名称（例如：my-namespace）" 
            class="form-input"
            :maxlength="63"
          />
          <div style="color: #999; font-size: 12px; margin-top: 4px;">
            只能包含小写字母、数字和连字符，且不能以连字符开头或结尾
          </div>
        </a-form-item>

        <a-form-item label="标签配置（可选）" name="labels">
          <div class="key-value-inputs">
            <div v-if="!createFormModel.labels || Object.keys(createFormModel.labels).length === 0" style="text-align: center; color: #999; padding: 16px;">
              暂无标签，点击下方按钮添加
            </div>
            <div v-for="(_, key) in createFormModel.labels" :key="key" class="key-value-row">
              <a-input 
                :value="key" 
                :placeholder="`标签键: ${key}`" 
                disabled
                class="form-input key-input"
              />
              <a-input 
                v-model:value="createFormModel.labels[key]" 
                placeholder="标签值" 
                class="form-input value-input"
                :maxlength="200"
              />
              <a-button type="text" danger @click="removeCreateLabelField(key)" size="small">
                <template #icon><DeleteOutlined /></template>
              </a-button>
            </div>
            <div class="add-input-row" style="margin-top: 8px;">
              <a-input
                v-model:value="newCreateLabelKey"
                placeholder="输入标签键"
                style="flex: 1; margin-right: 8px;"
                @press-enter="addNewCreateLabel"
              />
              <a-button type="primary" @click="addNewCreateLabel" :disabled="!newCreateLabelKey.trim()">
                <template #icon><PlusOutlined /></template>
                添加
              </a-button>
            </div>
          </div>
        </a-form-item>

        <a-form-item label="注解配置（可选）" name="annotations">
          <div class="key-value-inputs">
            <div v-if="!createFormModel.annotations || Object.keys(createFormModel.annotations).length === 0" style="text-align: center; color: #999; padding: 16px;">
              暂无注解，点击下方按钮添加
            </div>
            <div v-for="(_, key) in createFormModel.annotations" :key="key" class="key-value-row">
              <a-input 
                :value="key" 
                :placeholder="`注解键: ${key}`" 
                disabled
                class="form-input key-input"
              />
              <a-input 
                v-model:value="createFormModel.annotations[key]" 
                placeholder="注解值" 
                class="form-input value-input"
                :maxlength="500"
              />
              <a-button type="text" danger @click="removeCreateAnnotationField(key)" size="small">
                <template #icon><DeleteOutlined /></template>
              </a-button>
            </div>
            <div class="add-input-row" style="margin-top: 8px;">
              <a-input
                v-model:value="newCreateAnnotationKey"
                placeholder="输入注解键"
                style="flex: 1; margin-right: 8px;"
                @press-enter="addNewCreateAnnotation"
              />
              <a-button type="primary" @click="addNewCreateAnnotation" :disabled="!newCreateAnnotationKey.trim()">
                <template #icon><PlusOutlined /></template>
                添加
              </a-button>
            </div>
          </div>
        </a-form-item>
      </a-form>
    </a-modal>

    <!-- 标签/注解管理模态框 -->
    <a-modal
      v-model:open="isLabelModalVisible"
      :title="isLabelEdit ? '编辑命名空间标签/注解' : '添加命名空间标签/注解'"
      @ok="submitLabelForm"
      @cancel="closeLabelModal"
      :confirmLoading="submitLoading"
      width="800px"
      :maskClosable="false"
      destroyOnClose
      okText="保存"
      cancelText="取消"
    >
      <a-form 
        ref="labelFormRef"
        :model="labelFormModel" 
        layout="vertical" 
        class="label-form"
        :rules="labelFormRules"
      >
        <a-form-item label="标签配置" name="labels">
          <div class="key-value-inputs">
            <div v-if="!labelFormModel.labels || Object.keys(labelFormModel.labels).length === 0" style="text-align: center; color: #999; padding: 20px;">
              暂无标签，点击下方按钮添加
            </div>
            <div v-for="(_, key) in labelFormModel.labels" :key="key" class="key-value-row">
              <a-input 
                :value="key" 
                :placeholder="`标签键: ${key}`" 
                disabled
                class="form-input key-input"
              />
              <a-input 
                v-model:value="labelFormModel.labels[key]" 
                placeholder="标签值" 
                class="form-input value-input"
                :maxlength="200"
              />
              <a-button type="text" danger @click="removeLabelField(key)">
                <template #icon><DeleteOutlined /></template>
                删除
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

        <a-form-item label="注解配置" name="annotations">
          <div class="key-value-inputs">
            <div v-if="!labelFormModel.annotations || Object.keys(labelFormModel.annotations).length === 0" style="text-align: center; color: #999; padding: 20px;">
              暂无注解，点击下方按钮添加
            </div>
            <div v-for="(_, key) in labelFormModel.annotations" :key="key" class="key-value-row">
              <a-input 
                :value="key" 
                :placeholder="`注解键: ${key}`" 
                disabled
                class="form-input key-input"
              />
              <a-input 
                v-model:value="labelFormModel.annotations[key]" 
                placeholder="注解值" 
                class="form-input value-input"
                :maxlength="500"
              />
              <a-button type="text" danger @click="removeAnnotationField(key)">
                <template #icon><DeleteOutlined /></template>
                删除
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

    <!-- 详情模态框 -->
    <a-modal
      v-model:open="isDetailModalVisible"
      title="命名空间详情"
      :footer="null"
      @cancel="closeDetailModal"
      width="1000px"
      :maskClosable="false"
      destroyOnClose
    >
      <a-spin :spinning="detailLoading">
        <div v-if="currentNamespaceDetail" class="k8s-detail-content">
          <a-row :gutter="[24, 16]">
            <a-col :xs="24" :lg="12">
              <a-card title="基本信息" class="k8s-detail-card" size="small">
                <div class="k8s-detail-item">
                  <span class="k8s-detail-label">命名空间名称:</span>
                  <span class="k8s-detail-value">{{ currentNamespaceDetail.name }}</span>
                </div>
                <div class="k8s-detail-item">
                  <span class="k8s-detail-label">UID:</span>
                  <span class="k8s-detail-value">{{ currentNamespaceDetail.uid || '-' }}</span>
                </div>
                <div class="k8s-detail-item">
                  <span class="k8s-detail-label">状态:</span>
                  <a-badge :status="getStatusColor(currentNamespaceDetail.status)" :text="getStatusText(currentNamespaceDetail.status)" />
                </div>
                <div class="k8s-detail-item">
                  <span class="k8s-detail-label">阶段:</span>
                  <a-badge :status="getPhaseColor(currentNamespaceDetail.phase)" :text="getPhaseText(currentNamespaceDetail.phase)" />
                </div>
                <div class="k8s-detail-item">
                  <span class="k8s-detail-label">集群ID:</span>
                  <span class="k8s-detail-value">{{ currentNamespaceDetail.cluster_id }}</span>
                </div>
              </a-card>
            </a-col>
            
            <a-col :xs="24" :lg="12">
              <a-card title="标签信息" class="k8s-detail-card" size="small">
                <div class="k8s-labels-display">
                  <a-tooltip v-for="label in (currentNamespaceDetail.labels || [])" :key="label.key" :title="`${label.key}: ${label.value}`">
                    <div class="k8s-label-item" style="margin-bottom: 8px;">
                      {{ label.key }}: {{ label.value }}
                    </div>
                  </a-tooltip>
                  <span v-if="!currentNamespaceDetail.labels || currentNamespaceDetail.labels.length === 0" class="k8s-no-data">
                    暂无标签
                  </span>
                </div>
              </a-card>
            </a-col>
          </a-row>

          <a-row :gutter="[24, 16]" style="margin-top: 16px;">
            <a-col :xs="24" :lg="12">
              <a-card title="注解信息" class="k8s-detail-card" size="small">
                <div class="k8s-annotations-display">
                  <a-tooltip v-for="annotation in (currentNamespaceDetail.annotations || [])" :key="annotation.key" :title="`${annotation.key}: ${annotation.value}`" placement="top">
                    <a-tag class="k8s-annotation-item" style="margin-bottom: 8px; max-width: 200px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                      {{ annotation.key }}: {{ annotation.value }}
                    </a-tag>
                  </a-tooltip>
                  <span v-if="!currentNamespaceDetail.annotations || currentNamespaceDetail.annotations.length === 0" class="k8s-no-data">
                    暂无注解
                  </span>
                </div>
              </a-card>
            </a-col>
          </a-row>

          <a-row style="margin-top: 16px;">
            <a-col :span="24">
              <a-card title="详细信息" class="k8s-detail-card" size="small">
                <a-descriptions :column="{ xxl: 3, xl: 3, lg: 2, md: 2, sm: 1, xs: 1 }" size="small" bordered>
                  <a-descriptions-item label="命名空间">{{ currentNamespaceDetail.name }}</a-descriptions-item>
                  <a-descriptions-item label="集群">{{ currentNamespaceDetail.cluster_id }}</a-descriptions-item>
                  <a-descriptions-item label="状态">
                    <a-badge :status="getStatusColor(currentNamespaceDetail.status)" :text="getStatusText(currentNamespaceDetail.status)" />
                  </a-descriptions-item>
                  <a-descriptions-item label="阶段">
                    <a-badge :status="getPhaseColor(currentNamespaceDetail.phase)" :text="getPhaseText(currentNamespaceDetail.phase)" />
                  </a-descriptions-item>
                  <a-descriptions-item label="UID">{{ currentNamespaceDetail.uid || '-' }}</a-descriptions-item>
                </a-descriptions>
              </a-card>
            </a-col>
          </a-row>
        </div>
      </a-spin>
    </a-modal>

    <!-- 删除命名空间模态框 -->
    <a-modal
      v-model:open="isDeleteModalVisible"
      title="删除命名空间"
      @ok="submitDeleteForm"
      @cancel="closeDeleteModal"
      :confirmLoading="submitLoading"
      width="500px"
      :maskClosable="false"
      destroyOnClose
      okText="确认删除"
      cancelText="取消"
      okType="danger"
    >
      <div class="delete-form">
        <a-alert
          message="⚠️ 警告"
          :description="`您即将删除命名空间 '${currentOperationNamespace?.name}'，此操作不可逆！`"
          type="warning"
          show-icon
          style="margin-bottom: 24px;"
        />
        
        <a-form layout="vertical" class="delete-config-form">
          <a-form-item label="删除方式">
            <a-radio-group v-model:value="deleteFormModel.force">
              <a-radio :value="2" style="display: block; margin-bottom: 12px;">
                <div style="margin-left: 20px;">
                  <div style="font-weight: 500;">优雅删除（推荐）</div>
                  <div style="color: #666; font-size: 12px; margin-top: 2px;">
                    给予资源时间完成清理
                  </div>
                </div>
              </a-radio>
              <a-radio :value="1">
                <div style="margin-left: 20px;">
                  <div style="font-weight: 500; color: #ff4d4f;">强制删除</div>
                  <div style="color: #666; font-size: 12px; margin-top: 2px;">
                    立即删除，仅在优雅删除失败时使用
                  </div>
                </div>
              </a-radio>
            </a-radio-group>
          </a-form-item>

          <a-form-item label="优雅删除时间（秒）" v-if="deleteFormModel.force === 2">
            <a-input-number
              v-model:value="deleteFormModel.grace_period_seconds"
              :min="0"
              :max="3600"
              :step="10"
              style="width: 100%;"
              placeholder="30"
            />
            <div style="color: #999; font-size: 12px; margin-top: 4px;">
              默认30秒，最大3600秒
            </div>
          </a-form-item>
        </a-form>
      </div>
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
import { message } from 'ant-design-vue';
import { useNamespacePage } from './Namespace';
import { 
  PlusOutlined, 
  ReloadOutlined, 
  FilterOutlined, 
  DeleteOutlined, 
  AppstoreOutlined,
  EyeOutlined,
  TagsOutlined,
  DeploymentUnitOutlined,
  FireOutlined,
  SearchOutlined,
} from '@ant-design/icons-vue';

const {
  // state
  clusters,
  loading,
  clustersLoading,
  searchText,
  filterStatus,
  filterClusterId,
  filterLabels,
  selectedRows,
  currentPage,
  pageSize,
  
  // modal state
  isLabelModalVisible,
  isCreateModalVisible,
  isDeleteModalVisible,
  isLabelEdit,
  submitLoading,
  
  // detail modal
  isDetailModalVisible,
  detailLoading,
  currentNamespaceDetail,
  
  // operation target
  currentOperationNamespace,
  
  // form models
  labelFormModel,
  createFormModel,
  deleteFormModel,
  
  // form refs
  labelFormRef,
  createFormRef,
  
  // form rules
  labelFormRules,
  createFormRules,
  
  // computed
  filteredNamespaces,
  rowSelection,
  
  // helpers
  getEnvText,
  getStatusText,
  getStatusColor,
  getPhaseText,
  getPhaseColor,
  
  // operations
  fetchClusters,
  fetchNamespaces,
  clearNamespaces,
  showNamespaceDetail,
  closeDetailModal,
  
  // create operations
  openCreateModal,
  closeCreateModal,
  submitCreateForm,
  
  // label operations
  openEditLabelModal,
  closeLabelModal,
  submitLabelForm,
  removeLabelField,
  removeAnnotationField,
  removeCreateLabelField,
  removeCreateAnnotationField,
  
  // delete operations
  deleteNamespace,
  forceDeleteNamespace,
  closeDeleteModal,
  submitDeleteForm,
  
  // filter operations
  addFilterLabel,
  removeFilterLabel,
  clearFilterLabels,
  
  // batch operations
  batchOperation,
  
  // cluster pagination
  loadMoreClusters,
  handlePageChange,
  
  // pagination state
  total,
  clustersTotal,
  
  // constants
  NamespaceStatus,
} = useNamespacePage();

// 添加新标签/注解的方法
const newLabelKey = ref('');
const newLabelValue = ref('');
const newAnnotationKey = ref('');
const newCreateLabelKey = ref('');
const newCreateAnnotationKey = ref('');

const addNewLabel = () => {
  if (newLabelKey.value && newLabelKey.value.trim()) {
    labelFormModel.value.labels[newLabelKey.value.trim()] = newLabelValue.value || '';
    newLabelKey.value = '';
    newLabelValue.value = '';
  }
};

const addNewAnnotation = () => {
  if (newAnnotationKey.value && newAnnotationKey.value.trim()) {
    labelFormModel.value.annotations[newAnnotationKey.value.trim()] = '';
    newAnnotationKey.value = '';
  }
};

const addNewCreateLabel = () => {
  if (newCreateLabelKey.value && newCreateLabelKey.value.trim()) {
    createFormModel.value.labels[newCreateLabelKey.value.trim()] = '';
    newCreateLabelKey.value = '';
  }
};

const addNewCreateAnnotation = () => {
  if (newCreateAnnotationKey.value && newCreateAnnotationKey.value.trim()) {
    createFormModel.value.annotations[newCreateAnnotationKey.value.trim()] = '';
    newCreateAnnotationKey.value = '';
  }
};

const onSearch = () => {
  currentPage.value = 1;
  fetchNamespaces();
};

const handleFilterChange = () => {
  currentPage.value = 1;
  fetchNamespaces();
};

const handleClusterChange = () => {
  currentPage.value = 1;
  if (filterClusterId.value) {
    const selectedCluster = clusters.value.find(c => c.id === filterClusterId.value);
    if (selectedCluster) {
      message.info(`已切换到集群: ${selectedCluster.name}`);
    }
    fetchNamespaces();
  } else {
    // 清空命名空间列表和选择状态
    clearNamespaces();
    message.info('已清空命名空间列表，请选择集群查看命名空间');
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
    // 当滚动到底部附近时加载更多
    if (scrollTarget.scrollTop + scrollTarget.clientHeight >= scrollTarget.scrollHeight - 5) {
      loadMoreClusters();
    }
  }
};

const columns = [
  { title: '名称', dataIndex: 'name', key: 'name', width: '15%' },
  { title: '状态', dataIndex: 'status', key: 'status', width: '8%', slots: { customRender: 'status' } },
  { title: '阶段', dataIndex: 'phase', key: 'phase', width: '8%', slots: { customRender: 'phase' } },
  { title: 'UID', dataIndex: 'uid', key: 'uid', width: '18%', ellipsis: true },
  { title: '创建时间', dataIndex: 'created_at', key: 'created_at', width: '12%' },
  { title: '标签', dataIndex: 'labels', key: 'labels', width: '15%', slots: { customRender: 'labels' } },
  { title: '注解', dataIndex: 'annotations', key: 'annotations', width: '12%', slots: { customRender: 'annotations' } },
  { title: '操作', key: 'actions', width: '12%', fixed: 'right', slots: { customRender: 'actions' } },
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
  // 如果有待添加的标签，先添加
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
  clearFilterLabels();
  currentPage.value = 1;
  // 清空命名空间列表
  clearNamespaces();
  message.success('已重置所有筛选条件');
};

onMounted(async () => {
  // 页面加载时首先获取集群列表
  await fetchClusters();
});
</script>

<style scoped>
@import '../shared/k8s-common.css';
</style>

<style scoped src="./Namespace.css"></style>
