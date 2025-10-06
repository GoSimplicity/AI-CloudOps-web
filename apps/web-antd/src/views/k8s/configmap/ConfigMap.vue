<template>
  <div class="k8s-management-container">
    <!-- 页面头部 -->
    <div class="k8s-page-header">
      <a-row class="k8s-header-content" :gutter="[24, 16]">
        <a-col :xs="24" :sm="24" :md="16" :lg="16" :xl="18">
          <div class="k8s-title-section">
            <div class="k8s-page-title">
              <SettingOutlined class="k8s-title-icon" />
              <div>
                <h1>ConfigMap 管理</h1>
                <p class="k8s-page-subtitle">管理和监控集群中的所有 Kubernetes ConfigMap</p>
              </div>
            </div>
          </div>
        </a-col>
        <a-col :xs="24" :sm="24" :md="8" :lg="8" :xl="6">
          <div class="k8s-header-actions">
            <a-button type="primary" @click="openCreateModal" :disabled="!filterClusterId">
              <template #icon><PlusOutlined /></template>
              创建 ConfigMap
            </a-button>
            <a-button @click="fetchConfigMaps" :loading="loading">
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
          
          <a-input 
            v-model:value="filterDataKey" 
            placeholder="数据键过滤" 
            class="k8s-filter-select" 
            allow-clear 
            @pressEnter="handleFilterChange"
            @input="handleFilterChange"
          >
            <template #suffix>
              <KeyOutlined />
            </template>
          </a-input>
          
          <!-- 标签过滤器 -->
          <div class="configmap-labels-filter">
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
            placeholder="搜索 ConfigMap 名称" 
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
            :disabled="!searchText && !filterClusterId && !filterNamespace && !filterDataKey && Object.keys(filterLabels).length === 0"
            class="k8s-toolbar-btn"
            title="重置所有筛选条件"
          >
            <template #icon><DeleteOutlined /></template>
            重置筛选
          </a-button>
          
          <a-button 
            @click="fetchConfigMaps" 
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
            title="通过YAML创建ConfigMap"
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
            title="批量删除选中的 ConfigMap"
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
        :data-source="filteredConfigMaps"
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
        class="k8s-table configmap-table"
        :scroll="{ x: 1440 }"
      >
        <template #data_count="{ record }">
          <a-tag color="cyan">{{ Object.keys(parseJsonField(record.data, {})).length }} 项</a-tag>
        </template>

        <template #age="{ record }">
          <a-tooltip :title="`原始值: ${record.age}`">
            <span style="color: #1890ff;">{{ formatAge(record.age) }}</span>
          </a-tooltip>
        </template>

        <template #labels="{ text }">
          <div class="k8s-labels-display">
            <template v-if="Array.isArray(text)">
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
              <a-button title="查看详情" @click="showConfigMapDetail(record)">
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
            <a-tooltip title="删除">
              <a-button 
                title="删除" 
                danger 
                @click="deleteConfigMap(record)"
              >
                <template #icon><DeleteOutlined /></template>
              </a-button>
            </a-tooltip>
          </div>
        </template>

        <template #emptyText>
          <div class="k8s-empty-state">
            <SettingOutlined />
            <p>暂无 ConfigMap 数据</p>
            <p>请先选择集群</p>
          </div>
        </template>
      </a-table>
    </div>

    <!-- 创建 ConfigMap 模态框 -->
    <a-modal
      v-model:open="isCreateModalVisible"
      title="创建 ConfigMap"
      @ok="submitCreateForm"
      @cancel="closeCreateModal"
      :confirmLoading="submitLoading"
      width="900px"
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
        <!-- 基础配置 -->
        <a-row :gutter="16">
          <a-col :span="12">
            <a-form-item label="ConfigMap 名称" name="name" :required="true">
              <a-input 
                v-model:value="createFormModel.name" 
                placeholder="请输入 ConfigMap 名称（例如：my-config）" 
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
            </a-form-item>
          </a-col>
        </a-row>

        <!-- 数据配置 -->
        <a-form-item label="数据配置" name="data">
          <div class="k8s-key-value-inputs">
            <div v-if="!createFormModel.data || Object.keys(createFormModel.data).length === 0" style="text-align: center; color: #999; padding: 16px;">
              暂无数据，点击下方按钮添加
            </div>
            <div v-for="(_, key) in createFormModel.data" :key="key" class="k8s-key-value-row">
              <a-input 
                :value="key" 
                :placeholder="`数据键: ${key}`" 
                disabled
                class="k8s-form-input"
              />
              <a-textarea 
                v-model:value="createFormModel.data[key]" 
                placeholder="数据值" 
                class="k8s-form-input"
                :rows="2"
                :maxlength="10000"
              />
              <a-button type="text" danger @click="removeDataField(key)" size="small" class="k8s-remove-btn">
                <template #icon><DeleteOutlined /></template>
              </a-button>
            </div>
            <div class="add-input-row" style="margin-top: 8px;">
              <a-input
                v-model:value="newDataKey"
                placeholder="输入数据键"
                style="flex: 1; margin-right: 8px;"
                @press-enter="addNewData"
              />
              <a-button type="primary" @click="addNewData" :disabled="!newDataKey.trim()">
                <template #icon><PlusOutlined /></template>
                添加
              </a-button>
            </div>
          </div>
        </a-form-item>

        <!-- 二进制数据配置 -->
        <a-form-item label="二进制数据配置（Base64编码）" name="binary_data">
          <div class="k8s-key-value-inputs">
            <div v-if="!createFormModel.binary_data || Object.keys(createFormModel.binary_data).length === 0" style="text-align: center; color: #999; padding: 16px;">
              暂无二进制数据，点击下方按钮添加
            </div>
            <div v-for="(_, key) in createFormModel.binary_data" :key="key" class="k8s-key-value-row">
              <a-input 
                :value="key" 
                :placeholder="`数据键: ${key}`" 
                disabled
                class="k8s-form-input"
              />
              <a-textarea 
                v-model:value="createFormModel.binary_data[key]" 
                placeholder="Base64编码的二进制数据值" 
                class="k8s-form-input"
                :rows="2"
                :maxlength="10000"
              />
              <a-button type="text" danger @click="removeBinaryDataField(key)" size="small" class="k8s-remove-btn">
                <template #icon><DeleteOutlined /></template>
              </a-button>
            </div>
            <div class="add-input-row" style="margin-top: 8px;">
              <a-input
                v-model:value="newBinaryDataKey"
                placeholder="输入二进制数据键"
                style="flex: 1; margin-right: 8px;"
                @press-enter="addNewBinaryData"
              />
              <a-button type="primary" @click="addNewBinaryData" :disabled="!newBinaryDataKey.trim()">
                <template #icon><PlusOutlined /></template>
                添加
              </a-button>
            </div>
          </div>
        </a-form-item>

        <!-- 配置选项 -->
        <a-row :gutter="16">
          <a-col :span="24">
            <a-form-item label="配置选项">
              <a-checkbox v-model:checked="createFormModel.immutable">不可变（创建后无法修改）</a-checkbox>
            </a-form-item>
          </a-col>
        </a-row>

        <!-- 标签配置 -->
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

        <!-- 注解配置 -->
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

    <!-- 通过 YAML 创建 ConfigMap 模态框 -->
    <a-modal
      v-model:open="isCreateYamlModalVisible"
      title="通过 YAML 创建 ConfigMap"
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
            placeholder="请输入 ConfigMap YAML 内容，或点击【插入模板】使用默认模板" 
            :rows="20"
            class="k8s-config-textarea"
          />
        </a-form-item>
      </a-form>
    </a-modal>

    <!-- 编辑 ConfigMap 模态框 -->
    <a-modal
      v-model:open="isEditModalVisible"
      title="编辑 ConfigMap"
      @ok="submitEditForm"
      @cancel="closeEditModal"
      :confirmLoading="submitLoading"
      width="900px"
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
        <a-alert
          message="编辑提示"
          description="ConfigMap 创建后只能编辑数据、标签和注解信息，名称和命名空间无法修改。"
          type="info"
          show-icon
          style="margin-bottom: 24px;"
        />

        <!-- 基础信息（只读） -->
        <a-row :gutter="16">
          <a-col :span="12">
            <a-form-item label="ConfigMap 名称">
              <a-input 
                :value="editFormModel.name" 
                disabled
                class="k8s-form-input"
              />
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item label="命名空间">
              <a-input 
                :value="editFormModel.namespace" 
                disabled
                class="k8s-form-input"
              />
            </a-form-item>
          </a-col>
        </a-row>

        <!-- 数据配置 -->
        <a-form-item label="数据配置" name="data">
          <div class="k8s-key-value-inputs">
            <div v-if="!editFormModel.data || Object.keys(editFormModel.data).length === 0" style="text-align: center; color: #999; padding: 16px;">
              暂无数据，点击下方按钮添加
            </div>
            <div v-for="(_, key) in editFormModel.data" :key="key" class="k8s-key-value-row">
              <a-input 
                :value="key" 
                :placeholder="`数据键: ${key}`" 
                disabled
                class="k8s-form-input"
              />
              <a-textarea 
                v-model:value="editFormModel.data[key]" 
                placeholder="数据值" 
                class="k8s-form-input"
                :rows="2"
                :maxlength="10000"
              />
              <a-button type="text" danger @click="removeEditDataField(key)" size="small" class="k8s-remove-btn">
                <template #icon><DeleteOutlined /></template>
              </a-button>
            </div>
            <div class="add-input-row" style="margin-top: 8px;">
              <a-input
                v-model:value="newEditDataKey"
                placeholder="输入数据键"
                style="flex: 1; margin-right: 8px;"
                @press-enter="addNewEditData"
              />
              <a-button type="primary" @click="addNewEditData" :disabled="!newEditDataKey.trim()">
                <template #icon><PlusOutlined /></template>
                添加
              </a-button>
            </div>
          </div>
        </a-form-item>

        <!-- 二进制数据配置 -->
        <a-form-item label="二进制数据配置（Base64编码）" name="binary_data">
          <div class="k8s-key-value-inputs">
            <div v-if="!editFormModel.binary_data || Object.keys(editFormModel.binary_data).length === 0" style="text-align: center; color: #999; padding: 16px;">
              暂无二进制数据，点击下方按钮添加
            </div>
            <div v-for="(_, key) in editFormModel.binary_data" :key="key" class="k8s-key-value-row">
              <a-input 
                :value="key" 
                :placeholder="`数据键: ${key}`" 
                disabled
                class="k8s-form-input"
              />
              <a-textarea 
                v-model:value="editFormModel.binary_data[key]" 
                placeholder="Base64编码的二进制数据值" 
                class="k8s-form-input"
                :rows="2"
                :maxlength="10000"
              />
              <a-button type="text" danger @click="removeEditBinaryDataField(key)" size="small" class="k8s-remove-btn">
                <template #icon><DeleteOutlined /></template>
              </a-button>
            </div>
            <div class="add-input-row" style="margin-top: 8px;">
              <a-input
                v-model:value="newEditBinaryDataKey"
                placeholder="输入二进制数据键"
                style="flex: 1; margin-right: 8px;"
                @press-enter="addNewEditBinaryData"
              />
              <a-button type="primary" @click="addNewEditBinaryData" :disabled="!newEditBinaryDataKey.trim()">
                <template #icon><PlusOutlined /></template>
                添加
              </a-button>
            </div>
          </div>
        </a-form-item>

        <!-- 标签配置 -->
        <a-form-item label="标签配置" name="labels">
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

        <!-- 注解配置 -->
        <a-form-item label="注解配置" name="annotations">
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

    <!-- 详情模态框 -->
    <a-modal
      v-model:open="isDetailModalVisible"
      title="ConfigMap 详情"
      :footer="null"
      @cancel="closeDetailModal"
      width="1200px"
      :maskClosable="false"
      destroyOnClose
    >
      <a-spin :spinning="detailLoading">
        <div v-if="currentConfigMapDetail" class="k8s-detail-content">
          <a-row :gutter="[24, 16]">
            <a-col :xs="24" :lg="12">
              <a-card title="基本信息" class="k8s-detail-card" size="small">
                <div class="k8s-detail-item">
                  <span class="k8s-detail-label">ConfigMap 名称:</span>
                  <span class="k8s-detail-value">{{ currentConfigMapDetail.name }}</span>
                </div>
                <div class="k8s-detail-item">
                  <span class="k8s-detail-label">命名空间:</span>
                  <span class="k8s-detail-value">{{ currentConfigMapDetail.namespace }}</span>
                </div>
                <div class="k8s-detail-item">
                  <span class="k8s-detail-label">集群ID:</span>
                  <span class="k8s-detail-value">{{ currentConfigMapDetail.cluster_id }}</span>
                </div>
                <div class="k8s-detail-item">
                  <span class="k8s-detail-label">UID:</span>
                  <span class="k8s-detail-value">{{ currentConfigMapDetail.uid || '-' }}</span>
                </div>
                <div class="k8s-detail-item">
                  <span class="k8s-detail-label">创建时间:</span>
                  <span class="k8s-detail-value">{{ formatK8sTime(currentConfigMapDetail.created_at) }}</span>
                </div>
                <div class="k8s-detail-item">
                  <span class="k8s-detail-label">存在时间:</span>
                  <span class="k8s-detail-value">{{ currentConfigMapDetail.age || '-' }}</span>
                </div>
              </a-card>
            </a-col>
            
            <a-col :xs="24" :lg="12">
              <a-card title="数据统计" class="k8s-detail-card" size="small">
                <div class="k8s-detail-item">
                  <span class="k8s-detail-label">数据项数量:</span>
                  <span class="k8s-detail-value">
                    <a-tag color="cyan">{{ Object.keys(currentConfigMapDetail.data || {}).length }} 项</a-tag>
                  </span>
                </div>
                <div class="k8s-detail-item">
                  <span class="k8s-detail-label">二进制数据项:</span>
                  <span class="k8s-detail-value">
                    <a-tag color="purple">{{ Object.keys(currentConfigMapDetail.binary_data || {}).length }} 项</a-tag>
                  </span>
                </div>
                <div class="k8s-detail-item">
                  <span class="k8s-detail-label">标签数量:</span>
                  <span class="k8s-detail-value">
                    <a-tag color="blue">{{ (currentConfigMapDetail.labels || []).length }} 个</a-tag>
                  </span>
                </div>
                <div class="k8s-detail-item">
                  <span class="k8s-detail-label">注解数量:</span>
                  <span class="k8s-detail-value">
                    <a-tag color="green">{{ (currentConfigMapDetail.annotations || []).length }} 个</a-tag>
                  </span>
                </div>
              </a-card>
            </a-col>
          </a-row>

          <!-- 数据内容 -->
          <a-row :gutter="[24, 16]" style="margin-top: 16px;" v-if="currentConfigMapDetail.data && Object.keys(currentConfigMapDetail.data).length > 0">
            <a-col :span="24">
              <a-card title="数据内容" class="k8s-detail-card" size="small">
                <a-collapse>
                  <a-collapse-panel v-for="[key, value] in Object.entries(currentConfigMapDetail.data || {})" :key="key" :header="key">
                    <pre style="background: #f5f5f5; padding: 16px; border-radius: 4px; max-height: 400px; overflow-y: auto;">{{ value }}</pre>
                  </a-collapse-panel>
                </a-collapse>
              </a-card>
            </a-col>
          </a-row>

          <!-- 二进制数据内容 -->
          <a-row :gutter="[24, 16]" style="margin-top: 16px;" v-if="currentConfigMapDetail.binary_data && Object.keys(currentConfigMapDetail.binary_data).length > 0">
            <a-col :span="24">
              <a-card title="二进制数据内容" class="k8s-detail-card" size="small">
                <a-collapse>
                  <a-collapse-panel v-for="[key, value] in Object.entries(currentConfigMapDetail.binary_data || {})" :key="key" :header="key">
                    <pre style="background: #f5f5f5; padding: 16px; border-radius: 4px; max-height: 400px; overflow-y: auto;">{{ value }}</pre>
                  </a-collapse-panel>
                </a-collapse>
              </a-card>
            </a-col>
          </a-row>

          <!-- 标签和注解 -->
          <a-row :gutter="[24, 16]" style="margin-top: 16px;">
            <a-col :xs="24" :lg="12">
              <a-card title="标签信息" class="k8s-detail-card" size="small">
                <div class="k8s-labels-display">
                  <a-tooltip v-for="label in (currentConfigMapDetail.labels || [])" :key="label.key" :title="`${label.key}: ${label.value}`">
                    <div class="k8s-label-item" style="margin-bottom: 8px;">
                      {{ label.key }}: {{ label.value }}
                    </div>
                  </a-tooltip>
                  <span v-if="!currentConfigMapDetail.labels || currentConfigMapDetail.labels.length === 0" class="k8s-no-data">
                    暂无标签
                  </span>
                </div>
              </a-card>
            </a-col>

            <a-col :xs="24" :lg="12">
              <a-card title="注解信息" class="k8s-detail-card" size="small">
                <div class="k8s-annotations-display">
                  <a-tooltip v-for="annotation in (currentConfigMapDetail.annotations || [])" :key="annotation.key" :title="`${annotation.key}: ${annotation.value}`" placement="top">
                    <a-tag class="k8s-annotation-item" style="margin-bottom: 8px; max-width: 200px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                      {{ annotation.key }}: {{ annotation.value }}
                    </a-tag>
                  </a-tooltip>
                  <span v-if="!currentConfigMapDetail.annotations || currentConfigMapDetail.annotations.length === 0" class="k8s-no-data">
                    暂无注解
                  </span>
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
      :title="`查看/编辑 ${currentOperationConfigMap?.name} YAML`"
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
import { useConfigMapPage } from './ConfigMap';
import { formatK8sTime, formatDateTime, getRelativeTime } from '../shared/utils';
import { 
  PlusOutlined, 
  ReloadOutlined, 
  DeleteOutlined, 
  SettingOutlined,
  AppstoreOutlined,
  EyeOutlined,
  TagsOutlined,
  SearchOutlined,
  FileTextOutlined,
  EditOutlined,
  DatabaseOutlined,
  KeyOutlined,
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
  filterClusterId,
  filterNamespace,
  filterDataKey,
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
  submitLoading,
  detailLoading,
  
  // operation targets
  currentOperationConfigMap,
  currentConfigMapDetail,
  
  // form models
  createFormModel,
  editFormModel,
  yamlFormModel,
  createYamlFormModel,
  
  // form refs
  formRef,
  yamlFormRef,
  createYamlFormRef,
  
  // form rules
  createFormRules,
  yamlFormRules,
  createYamlFormRules,
  
  // computed
  filteredConfigMaps,
  rowSelection,
  
  // helpers
  getEnvText,
  parseJsonField,
  
  // operations
  fetchClusters,
  fetchNamespaces,
  fetchConfigMaps,
  clearConfigMaps,
  clearNamespaces,
  loadMoreClusters,
  loadMoreNamespaces,
  
  // detail operations
  showConfigMapDetail,
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
  
  // configmap operations
  deleteConfigMap,
  
  // filter operations
  addFilterLabel,
  removeFilterLabel,
  clearFilterLabels,
  
  // batch operations
  batchOperation,
  
  // pagination operations
  handlePageChange,
  
  // form field operations
  removeDataField,
  removeEditDataField,
  removeBinaryDataField,
  removeEditBinaryDataField,
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
} = useConfigMapPage();

// 添加新字段的方法
const newDataKey = ref('');
const newBinaryDataKey = ref('');
const newLabelKey = ref('');
const newAnnotationKey = ref('');
const newEditDataKey = ref('');
const newEditBinaryDataKey = ref('');
const newEditLabelKey = ref('');
const newEditAnnotationKey = ref('');

const addNewData = () => {
  if (newDataKey.value && newDataKey.value.trim()) {
    createFormModel.value.data[newDataKey.value.trim()] = '';
    newDataKey.value = '';
  }
};

const addNewBinaryData = () => {
  if (newBinaryDataKey.value && newBinaryDataKey.value.trim()) {
    createFormModel.value.binary_data[newBinaryDataKey.value.trim()] = '';
    newBinaryDataKey.value = '';
  }
};

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

const addNewEditData = () => {
  if (newEditDataKey.value && newEditDataKey.value.trim()) {
    editFormModel.value.data[newEditDataKey.value.trim()] = '';
    newEditDataKey.value = '';
  }
};

const addNewEditBinaryData = () => {
  if (newEditBinaryDataKey.value && newEditBinaryDataKey.value.trim()) {
    editFormModel.value.binary_data[newEditBinaryDataKey.value.trim()] = '';
    newEditBinaryDataKey.value = '';
  }
};

const addNewEditLabel = () => {
  if (newEditLabelKey.value && newEditLabelKey.value.trim()) {
    editFormModel.value.labels[newEditLabelKey.value.trim()] = '';
    newEditLabelKey.value = '';
  }
};

const addNewEditAnnotation = () => {
  if (newEditAnnotationKey.value && newEditAnnotationKey.value.trim()) {
    editFormModel.value.annotations[newEditAnnotationKey.value.trim()] = '';
    newEditAnnotationKey.value = '';
  }
};

// 注意：时间格式化函数已移至 shared/utils.ts，使用 formatK8sTime

const onSearch = () => {
  currentPage.value = 1;
  fetchConfigMaps();
};

const handleFilterChange = () => {
  currentPage.value = 1;
  fetchConfigMaps();
};

const handleClusterChange = () => {
  currentPage.value = 1;
  clearNamespaces();
  clearConfigMaps();
  
  if (filterClusterId.value) {
    const selectedCluster = clusters.value.find(c => c.id === filterClusterId.value);
    if (selectedCluster) {
      message.info(`已切换到集群: ${selectedCluster.name}`);
    }
    fetchNamespaces(true); // 重置命名空间分页
    fetchConfigMaps();
  } else {
    message.info('已清空 ConfigMap 列表，请选择集群查看 ConfigMap');
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

const formatAge = (age?: string) => {
  if (!age) return '-';
  
  try {
    // 解析时间字符串，提取小时、分钟、秒
    const hourMatch = age.match(/(\d+)h/);
    const minuteMatch = age.match(/(\d+)m/);
    const secondMatch = age.match(/(\d+(?:\.\d+)?)s/);
    
    const hours = hourMatch && hourMatch[1] ? parseInt(hourMatch[1]) : 0;
    const minutes = minuteMatch && minuteMatch[1] ? parseInt(minuteMatch[1]) : 0;
    const seconds = secondMatch && secondMatch[1] ? parseFloat(secondMatch[1]) : 0;
    
    // 转换为天、小时、分钟
    const days = Math.floor(hours / 24);
    const remainingHours = hours % 24;
    
    // 根据时间长度选择合适的显示格式
    if (days > 0) {
      if (remainingHours > 0) {
        return `${days}天 ${remainingHours}小时`;
      }
      return `${days}天`;
    } else if (hours > 0) {
      if (minutes > 0) {
        return `${hours}小时 ${minutes}分钟`;
      }
      return `${hours}小时`;
    } else if (minutes > 0) {
      return `${minutes}分钟`;
    } else {
      return `${Math.floor(seconds)}秒`;
    }
  } catch (error) {
    return age; // 如果解析失败，返回原始值
  }
};

const columns = [
  { title: '名称', dataIndex: 'name', key: 'name', width: 150, ellipsis: true, fixed: 'left' },
  { title: '命名空间', dataIndex: 'namespace', key: 'namespace', width: 120, ellipsis: true },
  { title: '数据项', key: 'data_count', width: 90, align: 'center', slots: { customRender: 'data_count' } },
  { title: '大小', dataIndex: 'size', key: 'size', width: 100, align: 'center' },
  { title: '标签', dataIndex: 'labels', key: 'labels', width: 150, slots: { customRender: 'labels' } },
  { title: '注解', dataIndex: 'annotations', key: 'annotations', width: 120, slots: { customRender: 'annotations' } },
  { title: 'UID', dataIndex: 'uid', key: 'uid', width: 100, ellipsis: true, slots: { customRender: 'uid' } },
  { title: '创建时间', dataIndex: 'created_at', key: 'created_at', width: 160, slots: { customRender: 'createdAt' } },
  { title: '操作', key: 'actions', width: 200, fixed: 'right', align: 'center', slots: { customRender: 'actions' } },
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
  searchText.value = '';
  filterClusterId.value = undefined;
  filterNamespace.value = undefined;
  filterDataKey.value = undefined;
  clearFilterLabels();
  currentPage.value = 1;
  clearConfigMaps();
  clearNamespaces();
  message.success('已重置所有筛选条件');
};

onMounted(async () => {
  await fetchClusters();
});
</script>

<style scoped>
@import '../shared/k8s-common.css';

.k8s-config-textarea {
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
  font-size: 13px;
  line-height: 1.4;
}

.k8s-config-textarea :deep(.ant-input) {
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
  font-size: 13px;
  line-height: 1.4;
}
</style>

<style scoped src="./ConfigMap.css"></style>
