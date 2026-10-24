<template>
  <OpsPage title="Secret 管理" description="管理和监控集群中的所有 Kubernetes Secret 资源">
    <template #actions>
            <a-button type="primary" @click="openCreateModal" :disabled="!filterClusterId">
              <template #icon><PlusOutlined aria-hidden="true"  /></template>
              创建 Secret
            </a-button>
            <a-button @click="fetchSecrets" :loading="loading" :disabled="!filterClusterId">
              <template #icon><ReloadOutlined aria-hidden="true"  /></template>
              刷新数据
            </a-button>
    </template>

    <!-- 工具栏 -->
    <template #filters>
    <div class="ops-filter-row">
      <!-- 筛选和搜索区域 -->
      <div class="k8s-toolbar-filters">
        <div class="k8s-filter-group">
          <a-select 
            v-model:value="filterClusterId" 
            placeholder="选择集群" 
            class="k8s-cluster-selector"
            aria-label="选择集群"
            allow-clear 
            @change="handleClusterChange"
            :loading="clustersLoading"
            :disabled="clustersLoading"
            @popup-scroll="handleClusterDropdownScroll"
          >
            <template #suffixIcon><DatabaseOutlined aria-hidden="true"  /></template>
            <a-select-option v-for="cluster in clusters" :key="cluster.id" :value="cluster.id">
              <div style="display: flex; align-items: center; justify-content: space-between;">
                <span class="k8s-cluster-name" :title="cluster.name">{{ cluster.name }}</span>
                <a-tag color="blue" size="small">{{ getEnvText(cluster.env) }}</a-tag>
              </div>
            </a-select-option>
            <a-select-option 
              v-if="clusters.length > 0 && clusters.length < clustersTotal" 
              :value="'__load_more__'" 
              disabled
              style="text-align: center; color: var(--ops-muted);"
            >
              <a-spin size="small" :spinning="clustersLoading" />
              <span v-if="!clustersLoading">滚动加载更多...</span>
            </a-select-option>
          </a-select>

          <a-select 
            v-model:value="filterNamespace" 
            placeholder="选择命名空间" 
            class="k8s-filter-select k8s-namespace-selector"
            aria-label="选择命名空间"
            allow-clear 
            @change="handleFilterChange"
            :disabled="!filterClusterId"
            :loading="namespacesLoading"
          >
            <template #suffixIcon><AppstoreOutlined aria-hidden="true"  /></template>
            <a-select-option v-for="ns in namespaces" :key="ns.name" :value="ns.name">
              {{ ns.name }}
            </a-select-option>
            <a-select-option 
              v-if="namespaces.length > 0 && namespaces.length < namespacesTotal" 
              :value="'__load_more_namespaces__'" 
              disabled
              style="text-align: center; color: var(--ops-muted);"
            >
              <a-button type="link" size="small" @click.stop="loadMoreNamespaces" :loading="namespacesLoading">
                加载更多...
              </a-button>
            </a-select-option>
          </a-select>

          <a-select 
            v-model:value="filterType" 
            placeholder="Secret类型" 
            class="k8s-filter-select secret-type-selector" 
            allow-clear 
            @change="handleFilterChange"
          >
            <template #suffixIcon><SecurityScanOutlined aria-hidden="true"  /></template>
            <a-select-option v-for="type in Object.values(K8sSecretType)" :key="type" :value="type">
              {{ getSecretTypeText(type) }}
            </a-select-option>
          </a-select>

          <!-- 标签过滤器 -->
          <div class="secret-labels-filter">
            <a-button type="dashed" @click="openLabelsFilter" class="k8s-toolbar-btn">
              <template #icon><TagsOutlined aria-hidden="true"  /></template>
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
            placeholder="搜索 Secret 名称" 
            class="k8s-search-input" 
            @pressEnter="onSearch"
            @input="onSearch"
            allow-clear 
          >
            <template #suffix>
              <SearchOutlined aria-hidden="true" class="k8s-search-icon" />
            </template>
          </a-input>
        </div>
      </div>

      <!-- 操作区域 -->
      <div class="k8s-toolbar-actions">
        <div class="k8s-action-buttons">
          <a-button 
            @click="resetFilters" 
            :disabled="!searchText && !filterClusterId && !filterNamespace && !filterType && Object.keys(filterLabels).length === 0"
            class="k8s-toolbar-btn"
            title="重置所有筛选条件"
          >
            <template #icon><DeleteOutlined aria-hidden="true"  /></template>
            重置筛选
          </a-button>


          <a-button 
            @click="openCreateYamlModal" 
            :disabled="!filterClusterId"
            class="k8s-toolbar-btn"
            title="通过YAML创建Secret"
          >
            <template #icon><FileTextOutlined aria-hidden="true"  /></template>
            YAML 创建
          </a-button>

          <a-button 
            type="primary" 
            danger 
            @click="() => batchOperation('删除')" 
            :disabled="!selectedRows.length" 
            v-if="can('k8s.secret.batchDelete') && (selectedRows.length > 0)"
            class="k8s-toolbar-btn"
            title="批量删除选中的 Secret"
          >
            <template #icon><DeleteOutlined aria-hidden="true"  /></template>
            删除 ({{ selectedRows.length }})
          </a-button>
        </div>
      </div>
    </div>

    <!-- 安全提示 -->
    <div class="secret-security-warning">
      <ExclamationCircleOutlined aria-hidden="true"  />
      <div class="secret-security-warning-content">
        <div class="secret-security-warning-title">安全提示</div>
        <div class="secret-security-warning-text">
          Secret 包含敏感信息，请谨慎操作。数据将以加密形式存储，但在界面中可能以明文显示。
        </div>
      </div>
    </div>

    </template>
    <a-alert v-if="clustersError" type="error" :message="clustersError" show-icon>
      <template #action><a-button size="small" @click="fetchClusters(true)">重试集群</a-button></template>
    </a-alert>
    <a-alert v-if="namespacesError" type="error" :message="namespacesError" show-icon>
      <template #action><a-button size="small" @click="fetchNamespaces(true)">重试命名空间</a-button></template>
    </a-alert>
    <a-alert v-if="loadError" type="error" :message="loadError" show-icon>
      <template #action><a-button size="small" @click="fetchSecrets">重试查询</a-button></template>
    </a-alert>

    <!-- 数据展示区域 -->
    <div class="k8s-data-display">
      <a-table
        :columns="columns"
        :data-source="filteredSecrets"
        :row-selection="rowSelection"
        :loading="loading"
        :row-key="namespacedResourceKey"
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
        class="k8s-table secret-table"
        :scroll="{ x: 1240 }"
      >
        <template #type="{ record }">
          <a-tag 
            :class="getSecretTypeClass(record.type)"
            class="secret-type-tag"
          >
            {{ getSecretTypeText(record.type) }}
          </a-tag>
        </template>

        <template #age="{ record }">
          <span class="k8s-age-display">{{ formatK8sAge(record.age) }}</span>
        </template>

        <template #immutable="{ record }">
          <a-tag v-if="record.immutable" color="orange" class="secret-immutable-tag">是</a-tag>
          <span v-else class="k8s-no-data">否</span>
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
            <span class="k8s-uid-text" style="font-family: monospace; font-size: 11px; color: var(--ops-muted);">
              {{ text.substring(0, 8) }}...
            </span>
          </a-tooltip>
          <span v-else class="k8s-no-data">-</span>
        </template>

        <template #createdAt="{ record }">
          <div v-if="record.created_at" style="font-size: 12px; color: var(--ops-muted);">
            <div>{{ formatDateTime(record.created_at) }}</div>
            <div style="color: var(--ops-muted); font-size: 11px; margin-top: 2px;">{{ getRelativeTime(record.created_at) }}</div>
          </div>
          <span v-else class="k8s-no-data">-</span>
        </template>

        <template #actions="{ record }">
          <div class="k8s-action-column">
            <!-- SEC-25/26 第 4 条：详情入口按详情码（普通权限），明文按钮在详情内另按 reveal 码门禁 -->
            <a-tooltip v-if="hasPerm(SECRET_DETAIL_PERMISSION_CODE)" title="查看详情">
              <a-button title="查看详情" @click="showSecretDetail(record)">
                <template #icon><EyeOutlined aria-hidden="true"  /></template>
              </a-button>
            </a-tooltip>
            <a-tooltip v-if="can('k8s.secret.viewYaml')" title="查看 YAML">
              <a-button title="查看 YAML" :disabled="isYamlLoading" @click="showYamlModal(record)">
                <template #icon><FileTextOutlined aria-hidden="true"  /></template>
              </a-button>
            </a-tooltip>
            <!-- incr6 P2-1：编辑先拉详情再走 update，两个码都要有才显示 -->
            <a-tooltip v-if="hasPerm(SECRET_DETAIL_PERMISSION_CODE) && hasPerm(SECRET_UPDATE_PERMISSION_CODE)" title="编辑">
              <a-button title="编辑" @click="openEditModal(record)">
                <template #icon><EditOutlined aria-hidden="true"  /></template>
              </a-button>
            </a-tooltip>
            <a-tooltip v-if="can('k8s.secret.delete')" title="删除">
              <a-button 
                title="删除" 
                danger 
                @click="deleteSecret(record)"
              >
                <template #icon><DeleteOutlined aria-hidden="true"  /></template>
              </a-button>
            </a-tooltip>
          </div>
        </template>

        <template #emptyText>
          <div class="k8s-empty-state">
            <KeyOutlined aria-hidden="true"  />
            <p>暂无 Secret 数据</p>
            <p v-if="!filterClusterId">请先选择集群</p>
            <p v-else>请调整筛选条件或刷新数据</p>
          </div>
        </template>
      </a-table>
    </div>

    <!-- 创建 Secret 模态框 -->
    <a-modal
      v-model:open="isCreateModalVisible"
      title="创建 Secret"
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
        class="k8s-form secret-create-form"
        :rules="createFormRules"
      >
        <!-- 基础配置 -->
        <a-row :gutter="16">
          <a-col :span="12">
            <a-form-item label="Secret 名称" name="name" :required="true">
              <a-input 
                v-model:value="createFormModel.name" 
                placeholder="请输入 Secret 名称（例如：my-secret）" 
                class="k8s-form-input"
                :maxlength="253"
              />
              <div style="color: var(--ops-muted); font-size: 12px; margin-top: 4px;">
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

        <a-row :gutter="16">
          <a-col :span="24">
            <a-form-item label="Secret 类型">
              <a-select 
                v-model:value="createFormModel.type" 
                class="k8s-form-input secret-type-selector"
              >
                <a-select-option v-for="type in Object.values(K8sSecretType)" :key="type" :value="type">
                  {{ getSecretTypeText(type) }}
                </a-select-option>
              </a-select>
            </a-form-item>
          </a-col>
        </a-row>

        <!-- 字符串数据配置 -->
        <a-form-item label="字符串数据" name="string_data">
          <div class="k8s-key-value-inputs">
            <div v-if="!createFormModel.string_data || Object.keys(createFormModel.string_data).length === 0" style="text-align: center; color: var(--ops-muted); padding: 16px;">
              暂无字符串数据，点击下方按钮添加
            </div>
            <div v-for="(_, key) in createFormModel.string_data" :key="key" class="k8s-key-value-row">
              <a-input 
                :value="key" 
                :placeholder="`数据键: ${key}`" 
                disabled
                class="k8s-form-input"
              />
              <a-textarea 
                v-model:value="createFormModel.string_data[key]" 
                placeholder="字符串数据值" 
                class="k8s-form-input"
                :rows="2"
                :maxlength="10000"
              />
              <a-button type="text" danger @click="removeStringDataField(key)" class="k8s-remove-btn">
                <template #icon><DeleteOutlined aria-hidden="true"  /></template>
              </a-button>
            </div>
            <div class="add-input-row" style="margin-top: 8px; display: flex; gap: 12px; align-items: center;">
              <a-input
                v-model:value="newStringDataKey"
                placeholder="输入数据键"
                style="flex: 1;"
                @press-enter="addNewStringData"
                class="k8s-form-input"
              />
              <a-button type="primary" @click="addNewStringData" :disabled="!newStringDataKey.trim()">
                <template #icon><PlusOutlined aria-hidden="true"  /></template>
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
            <div v-if="!createFormModel.labels || Object.keys(createFormModel.labels).length === 0" style="text-align: center; color: var(--ops-muted); padding: 16px;">
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
              <a-button type="text" danger @click="removeLabelField(key)" class="k8s-remove-btn">
                <template #icon><DeleteOutlined aria-hidden="true"  /></template>
              </a-button>
            </div>
            <div class="add-input-row" style="margin-top: 8px; display: flex; gap: 12px; align-items: center;">
              <a-input
                v-model:value="newLabelKey"
                placeholder="输入标签键"
                style="flex: 1;"
                @press-enter="addNewLabel"
                class="k8s-form-input"
              />
              <a-button type="primary" @click="addNewLabel" :disabled="!newLabelKey.trim()">
                <template #icon><PlusOutlined aria-hidden="true"  /></template>
                添加
              </a-button>
            </div>
          </div>
        </a-form-item>

        <!-- 注解配置 -->
        <a-form-item label="注解配置（可选）" name="annotations">
          <div class="k8s-key-value-inputs">
            <div v-if="!createFormModel.annotations || Object.keys(createFormModel.annotations).length === 0" style="text-align: center; color: var(--ops-muted); padding: 16px;">
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
              <a-button type="text" danger @click="removeAnnotationField(key)" class="k8s-remove-btn">
                <template #icon><DeleteOutlined aria-hidden="true"  /></template>
              </a-button>
            </div>
            <div class="add-input-row" style="margin-top: 8px; display: flex; gap: 12px; align-items: center;">
              <a-input
                v-model:value="newAnnotationKey"
                placeholder="输入注解键"
                style="flex: 1;"
                @press-enter="addNewAnnotation"
                class="k8s-form-input"
              />
              <a-button type="primary" @click="addNewAnnotation" :disabled="!newAnnotationKey.trim()">
                <template #icon><PlusOutlined aria-hidden="true"  /></template>
                添加
              </a-button>
            </div>
          </div>
        </a-form-item>
      </a-form>
    </a-modal>

    <!-- 通过 YAML 创建 Secret 模态框 -->
    <a-modal
      v-model:open="isCreateYamlModalVisible"
      title="通过 YAML 创建 Secret"
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
              <template #icon><FileAddOutlined aria-hidden="true"  /></template>
              插入模板
            </a-button>
            <a-button class="yaml-toolbar-btn yaml-btn-format" @click="formatYaml">
              <template #icon><FormatPainterOutlined aria-hidden="true"  /></template>
              格式化
            </a-button>
            <a-button class="yaml-toolbar-btn yaml-btn-validate" @click="validateYaml">
              <template #icon><CheckCircleOutlined aria-hidden="true"  /></template>
              检查格式
            </a-button>
            <a-button class="yaml-toolbar-btn yaml-btn-clear" @click="clearYaml">
              <template #icon><ClearOutlined aria-hidden="true"  /></template>
              清空
            </a-button>
          </div>
          <a-textarea 
            v-model:value="createYamlFormModel.yaml" 
            placeholder="请输入 Secret YAML 内容，或点击【插入模板】使用默认模板" 
            :rows="20"
            class="k8s-config-textarea"
          />
        </a-form-item>
      </a-form>
    </a-modal>

    <!-- 编辑 Secret 模态框 -->
    <a-modal
      v-model:open="isEditModalVisible"
      title="编辑 Secret"
      @ok="submitEditForm"
      @cancel="closeEditModal"
      :confirmLoading="submitLoading"
      :okButtonProps="{ disabled: editDataLoading }"
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
        class="k8s-form secret-edit-form"
      >
        <a-alert
          message="编辑提示"
          description="Secret 创建后只能编辑数据、标签和注解信息，名称和命名空间无法修改。"
          type="info"
          show-icon
          style="margin-bottom: 24px;"
        />

        <!-- 基础信息（只读） -->
        <a-row :gutter="16">
          <a-col :span="12">
            <a-form-item label="Secret 名称">
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

        <!-- 字符串数据配置 -->
        <!-- 加密数据（SEC-25/26：原有值已脱敏，输入框留空 = 保留原值；不支持设为空值） -->
        <a-form-item label="加密数据">
          <div class="k8s-key-value-inputs secret-edit-data">
            <!-- 复审 P2/P3-2：键列表来自打开时重新拉取的详情，返回前显示加载中 -->
            <a-spin v-if="editDataLoading" style="display: block; padding: 16px;" />
            <div v-else-if="editDataRows.length === 0" style="text-align: center; color: var(--ops-muted); padding: 16px;">
              暂无加密数据，点击下方按钮添加
            </div>
            <div v-for="row in editDataRows" :key="row.id" class="secret-edit-data-row" :data-key="row.key">
              <a-form-item
                :validate-status="getEditDataRowError(row) ? 'error' : undefined"
                :help="getEditDataRowError(row) || undefined"
                style="margin-bottom: 8px;"
              >
                <div class="k8s-key-value-row">
                  <a-input
                    v-if="row.original"
                    :value="row.key"
                    disabled
                    class="k8s-form-input"
                  />
                  <a-input
                    v-else
                    v-model:value="row.key"
                    placeholder="键名"
                    class="k8s-form-input"
                  />
                  <a-input-password
                    :value="row.value"
                    :placeholder="row.original ? '已脱敏，留空保留原值' : '值'"
                    class="k8s-form-input secret-edit-data-value"
                    autocomplete="new-password"
                    @update:value="(value: string) => setEditDataValue(row, value)"
                  />
                  <a-button v-if="row.original && row.modified" type="text" size="small" class="secret-edit-data-reset" @click="resetEditDataRow(row)">
                    撤销修改
                  </a-button>
                  <a-button type="text" danger size="small" @click="removeEditDataRow(row)">
                    <template #icon><DeleteOutlined aria-hidden="true"  /></template>
                  </a-button>
                </div>
              </a-form-item>
            </div>
            <div class="add-input-row" style="margin-top: 8px;">
              <a-input
                v-model:value="newEditDataKey"
                placeholder="输入数据键"
                style="flex: 1; margin-right: 8px;"
                @press-enter="addNewEditData"
              />
              <a-button type="primary" @click="addNewEditData" :disabled="editDataLoading || !newEditDataKey.trim()">
                <template #icon><PlusOutlined aria-hidden="true"  /></template>
                添加
              </a-button>
            </div>
          </div>
        </a-form-item>

        <a-form-item label="字符串数据" name="string_data">
          <div class="k8s-key-value-inputs">
            <div v-if="!editFormModel.string_data || Object.keys(editFormModel.string_data).length === 0" style="text-align: center; color: var(--ops-muted); padding: 16px;">
              暂无字符串数据，点击下方按钮添加
            </div>
            <div v-for="(_, key) in editFormModel.string_data" :key="key" class="k8s-key-value-row">
              <a-input 
                :value="key" 
                :placeholder="`数据键: ${key}`" 
                disabled
                class="k8s-form-input"
              />
              <a-textarea 
                v-model:value="editFormModel.string_data[key]" 
                placeholder="字符串数据值" 
                class="k8s-form-input"
                :rows="2"
                :maxlength="10000"
              />
              <a-button type="text" danger @click="removeEditStringDataField(key)" size="small">
                <template #icon><DeleteOutlined aria-hidden="true"  /></template>
              </a-button>
            </div>
            <div class="add-input-row" style="margin-top: 8px;">
              <a-input
                v-model:value="newEditStringDataKey"
                placeholder="输入数据键"
                style="flex: 1; margin-right: 8px;"
                @press-enter="addNewEditStringData"
              />
              <a-button type="primary" @click="addNewEditStringData" :disabled="editDataLoading || !newEditStringDataKey.trim()">
                <template #icon><PlusOutlined aria-hidden="true"  /></template>
                添加
              </a-button>
            </div>
          </div>
        </a-form-item>

        <!-- 标签配置 -->
        <a-form-item label="标签配置" name="labels">
          <div class="k8s-key-value-inputs">
            <div v-if="!editFormModel.labels || Object.keys(editFormModel.labels).length === 0" style="text-align: center; color: var(--ops-muted); padding: 16px;">
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
              <a-button type="text" danger @click="removeEditLabelField(key)" size="small">
                <template #icon><DeleteOutlined aria-hidden="true"  /></template>
              </a-button>
            </div>
            <div class="add-input-row" style="margin-top: 8px;">
              <a-input
                v-model:value="newEditLabelKey"
                placeholder="输入标签键"
                style="flex: 1; margin-right: 8px;"
                @press-enter="addNewEditLabel"
              />
              <a-button type="primary" @click="addNewEditLabel" :disabled="editDataLoading || !newEditLabelKey.trim()">
                <template #icon><PlusOutlined aria-hidden="true"  /></template>
                添加
              </a-button>
            </div>
          </div>
        </a-form-item>

        <!-- 注解配置 -->
        <a-form-item label="注解配置" name="annotations">
          <div class="k8s-key-value-inputs">
            <div v-if="!editFormModel.annotations || Object.keys(editFormModel.annotations).length === 0" style="text-align: center; color: var(--ops-muted); padding: 16px;">
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
              <a-button type="text" danger @click="removeEditAnnotationField(key)" size="small">
                <template #icon><DeleteOutlined aria-hidden="true"  /></template>
              </a-button>
            </div>
            <div class="add-input-row" style="margin-top: 8px;">
              <a-input
                v-model:value="newEditAnnotationKey"
                placeholder="输入注解键"
                style="flex: 1; margin-right: 8px;"
                @press-enter="addNewEditAnnotation"
              />
              <a-button type="primary" @click="addNewEditAnnotation" :disabled="editDataLoading || !newEditAnnotationKey.trim()">
                <template #icon><PlusOutlined aria-hidden="true"  /></template>
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
      title="Secret 详情"
      :footer="null"
      @cancel="closeDetailModal"
      width="1200px"
      :maskClosable="false"
      destroyOnClose
    >
      <a-spin :spinning="detailLoading">
        <div v-if="currentSecretDetail" class="k8s-detail-content">
          <a-row :gutter="[24, 16]">
            <a-col :xs="24" :lg="12">
              <a-card title="基本信息" class="k8s-detail-card" size="small">
                <div class="k8s-detail-item">
                  <span class="k8s-detail-label">Secret 名称:</span>
                  <span class="k8s-detail-value">{{ currentSecretDetail.name }}</span>
                </div>
                <div class="k8s-detail-item">
                  <span class="k8s-detail-label">命名空间:</span>
                  <span class="k8s-detail-value">{{ currentSecretDetail.namespace }}</span>
                </div>
                <div class="k8s-detail-item">
                  <span class="k8s-detail-label">集群ID:</span>
                  <span class="k8s-detail-value">{{ currentSecretDetail.cluster_id }}</span>
                </div>
                <div class="k8s-detail-item">
                  <span class="k8s-detail-label">UID:</span>
                  <span class="k8s-detail-value">{{ currentSecretDetail.uid || '-' }}</span>
                </div>
                <div class="k8s-detail-item">
                  <span class="k8s-detail-label">类型:</span>
                  <span class="k8s-detail-value">
                    <a-tag :class="getSecretTypeClass(currentSecretDetail.type)" class="secret-type-tag">
                      {{ getSecretTypeText(currentSecretDetail.type) }}
                    </a-tag>
                  </span>
                </div>
                <div class="k8s-detail-item">
                  <span class="k8s-detail-label">创建时间:</span>
                  <span class="k8s-detail-value">{{ formatK8sTime(currentSecretDetail.created_at) }}</span>
                </div>
                <div class="k8s-detail-item">
                  <span class="k8s-detail-label">存在时间:</span>
                  <span class="k8s-detail-value">{{ currentSecretDetail.age || '-' }}</span>
                </div>
              </a-card>
            </a-col>

            <a-col :xs="24" :lg="12">
              <a-card title="数据统计" class="k8s-detail-card" size="small">
                <div class="k8s-detail-item" v-if="secretDetailDataKeys.length > 0">
                  <span class="k8s-detail-label">加密数据项:</span>
                  <span class="k8s-detail-value">
                    <a-tag color="cyan">{{ secretDetailDataKeys.length }} 项</a-tag>
                  </span>
                </div>
                <div class="k8s-detail-item" v-if="currentSecretDetail.string_data && Object.keys(currentSecretDetail.string_data).length > 0">
                  <span class="k8s-detail-label">字符串数据项:</span>
                  <span class="k8s-detail-value">
                    <a-tag color="green">{{ Object.keys(currentSecretDetail.string_data || {}).length }} 项</a-tag>
                  </span>
                </div>
                <div class="k8s-detail-item" v-if="currentSecretDetail.labels && currentSecretDetail.labels.length > 0">
                  <span class="k8s-detail-label">标签数量:</span>
                  <span class="k8s-detail-value">
                    <a-tag color="blue">{{ (currentSecretDetail.labels || []).length }} 个</a-tag>
                  </span>
                </div>
                <div class="k8s-detail-item" v-if="currentSecretDetail.annotations && currentSecretDetail.annotations.length > 0">
                  <span class="k8s-detail-label">注解数量:</span>
                  <span class="k8s-detail-value">
                    <a-tag color="orange">{{ (currentSecretDetail.annotations || []).length }} 个</a-tag>
                  </span>
                </div>
                <div class="k8s-detail-item" v-if="currentSecretDetail.size">
                  <span class="k8s-detail-label">数据大小:</span>
                  <span class="k8s-detail-value">
                    <span class="secret-size-display">{{ currentSecretDetail.size }}</span>
                  </span>
                </div>
                <div class="k8s-detail-item" v-if="currentSecretDetail.data_count">
                  <span class="k8s-detail-label">数据项总数:</span>
                  <span class="k8s-detail-value">
                    <a-tag color="purple">{{ currentSecretDetail.data_count }} 项</a-tag>
                  </span>
                </div>
                <div class="k8s-detail-item">
                  <span class="k8s-detail-label">不可变:</span>
                  <span class="k8s-detail-value">
                    <a-tag v-if="currentSecretDetail.immutable" color="orange" class="secret-immutable-tag">
                      是
                    </a-tag>
                    <span v-else>否</span>
                  </span>
                </div>
              </a-card>
            </a-col>
          </a-row>

          <!-- 字符串数据内容 -->
          <a-row :gutter="[24, 16]" style="margin-top: 16px;" v-if="currentSecretDetail.string_data && Object.keys(currentSecretDetail.string_data).length > 0">
            <a-col :span="24">
              <a-card title="字符串数据内容" class="k8s-detail-card" size="small">
                <a-collapse class="secret-data-collapse">
                  <a-collapse-panel v-for="[key, value] in Object.entries(currentSecretDetail.string_data || {})" :key="key" :header="key">
                    <pre style="background: var(--ops-ground); padding: 16px; border-radius: 4px; max-height: 400px; overflow-y: auto;">{{ value }}</pre>
                  </a-collapse-panel>
                </a-collapse>
              </a-card>
            </a-col>
          </a-row>

          <!-- 加密数据内容：SEC-25/26 详情只返回键名与字节数，明文按键调 reveal 获取（每次都会写审计），不在前端解码 -->
          <a-row :gutter="[24, 16]" style="margin-top: 16px;" v-if="secretDetailDataKeys.length > 0">
            <a-col :span="24">
              <a-card title="加密数据内容" class="k8s-detail-card" size="small">
                <a-alert
                  message="敏感数据已脱敏"
                  description="详情只显示键名与大小。查看或复制明文会单独请求并记录审计，关闭详情后明文即清除，请注意保密。"
                  type="warning"
                  show-icon
                  style="margin-bottom: 16px;"
                />

                <div class="secret-data-keys">
                  <div v-for="item in secretDetailDataKeys" :key="item.key" class="secret-data-key-row" :data-key="item.key">
                    <div class="secret-data-key-header">
                      <span class="secret-data-key-name">{{ item.key }}</span>
                      <span v-if="item.size !== undefined" class="secret-data-key-size">({{ item.size }} bytes)</span>
                      <a-tag color="red" size="small">敏感</a-tag>
                      <span class="secret-data-key-actions">
                        <template v-if="can('k8s.secret.viewPlain')">
                          <a-button v-if="item.key in revealedValues" size="small" class="secret-hide-plain" @click="hideRevealedKey(item.key)">
                            <template #icon><EyeInvisibleOutlined aria-hidden="true" /></template>
                            隐藏
                          </a-button>
                          <a-button v-else size="small" class="secret-view-plain" :loading="!!revealingKeys[item.key]" @click="revealSecretKey(item.key)">
                            <template #icon><EyeOutlined aria-hidden="true" /></template>
                            查看
                          </a-button>
                        </template>
                        <a-button v-if="can('k8s.secret.copyPlain')" size="small" class="secret-copy-plain" @click="copySecretKey(item.key)">
                          <template #icon><CopyOutlined aria-hidden="true"  /></template>
                          复制内容
                        </a-button>
                      </span>
                    </div>
                    <pre v-if="item.key in revealedValues" class="secret-data-plain" style="background: var(--ops-ground); padding: 16px; border-radius: 4px; max-height: 400px; overflow-y: auto; font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace; font-size: 12px; line-height: 1.4;">{{ revealedValues[item.key] }}</pre>
                  </div>
                </div>
              </a-card>
            </a-col>
          </a-row>

          <!-- 标签和注解 -->
          <a-row :gutter="[24, 16]" style="margin-top: 16px;" v-if="(currentSecretDetail.labels && currentSecretDetail.labels.length > 0) || (currentSecretDetail.annotations && currentSecretDetail.annotations.length > 0)">
            <a-col :xs="24" :lg="12" v-if="currentSecretDetail.labels && currentSecretDetail.labels.length > 0">
              <a-card title="标签信息" class="k8s-detail-card" size="small">
                <div class="k8s-labels-display">
                  <a-tooltip v-for="label in (currentSecretDetail.labels || [])" :key="label.key" :title="`${label.key}: ${label.value}`">
                    <div class="k8s-label-item" style="margin-bottom: 8px;">
                      {{ label.key }}: {{ label.value }}
                    </div>
                  </a-tooltip>
                </div>
              </a-card>
            </a-col>

            <a-col :xs="24" :lg="12" v-if="currentSecretDetail.annotations && currentSecretDetail.annotations.length > 0">
              <a-card title="注解信息" class="k8s-detail-card" size="small">
                <div class="k8s-annotations-display">
                  <a-tooltip v-for="annotation in (currentSecretDetail.annotations || [])" :key="annotation.key" :title="`${annotation.key}: ${annotation.value}`" placement="top">
                    <a-tag class="k8s-annotation-item" style="margin-bottom: 8px; max-width: 200px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                      {{ annotation.key }}: {{ annotation.value }}
                    </a-tag>
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
      :title="`查看/编辑 ${currentOperationSecret?.name} YAML`"
      @ok="submitYamlForm"
      @cancel="closeYamlModal"
      :confirmLoading="submitLoading"
      width="900px"
      :maskClosable="false"
      destroyOnClose
      okText="保存修改"
      cancelText="取消"
    >
      <a-alert
        message="Secret 数据已脱敏"
        description="data / stringData 的值显示为脱敏占位符 <redacted>。保存时仍为 <redacted>（不加引号）的键保留集群中的原值；要修改某个键，把它替换为真实内容。YAML 保存是整体覆盖：从 YAML 中删掉的键会从 Secret 中删除。带引号的 &quot;<redacted>&quot;、以及写在块标量（| 或 &gt;）里的 <redacted> 不会还原，会被拦截。"
        type="info"
        show-icon
        closable
        style="margin-bottom: 16px;"
      />

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
              <template #icon><FormatPainterOutlined aria-hidden="true"  /></template>
              格式化
            </a-button>
            <a-button class="yaml-toolbar-btn yaml-btn-validate" @click="validateEditYaml">
              <template #icon><CheckCircleOutlined aria-hidden="true"  /></template>
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
              <template #icon><PlusOutlined aria-hidden="true"  /></template>
            </a-button>
          </div>
        </div>
      </div>
    </a-modal>

  </OpsPage>
</template>

<script lang="ts" setup>
import OpsPage from '#/components/ops/OpsPage.vue';
import { namespacedResourceKey } from '../shared/utils';
import { onBeforeUnmount, onMounted, ref } from 'vue';
import { message } from 'ant-design-vue';
import { useSecretPage } from './Secret';
import { BINARY_VALUE_NOTICE } from './secret-data';
import { formatK8sTime, formatK8sAge, formatDateTime, getRelativeTime } from '../shared/utils';
import { 
  PlusOutlined, 
  ReloadOutlined, 
  DeleteOutlined, 
  KeyOutlined,
  AppstoreOutlined,
  EyeOutlined,
  TagsOutlined,
  SearchOutlined,
  FileTextOutlined,
  EditOutlined,
  DatabaseOutlined,
  SecurityScanOutlined,
  ExclamationCircleOutlined,
  CopyOutlined,
  EyeInvisibleOutlined,
  FileAddOutlined,
  FormatPainterOutlined,
  CheckCircleOutlined,
  ClearOutlined,
} from '@ant-design/icons-vue';

import {
  SECRET_DETAIL_PERMISSION_CODE,
  SECRET_UPDATE_PERMISSION_CODE,
} from '#/constants/permission-codes';
import { usePermission } from '#/utils/permission';
import { shouldNotifyPageError } from '#/utils/permission/request-notice';

const { can, hasPerm } = usePermission();

const {
  // state
  clusters,
  namespaces,
  loading,
  loadError,
  clustersError,
  namespacesError,
  clustersLoading,
  namespacesLoading,
  searchText,
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
  submitLoading,
  detailLoading,
  isYamlLoading,

  // operation targets
  currentOperationSecret,
  currentSecretDetail,

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
  filteredSecrets,
  rowSelection,

  // helpers
  getEnvText,
  getSecretTypeText,
  K8sSecretType,

  // operations
  fetchClusters,
  fetchNamespaces,
  fetchSecrets,
  clearSecrets,
  clearNamespaces,
  loadMoreClusters,
  loadMoreNamespaces,

  // detail operations
  showSecretDetail,
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

  // secret operations
  deleteSecret,

  // filter operations
  addFilterLabel,
  removeFilterLabel,
  clearFilterLabels,

  // batch operations
  batchOperation,

  // pagination operations
  handlePageChange,

  // form field operations
  removeStringDataField,
  removeEditStringDataField,
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

  // SEC-25/26 reveal / data 编辑
  revealedValues,
  revealingKeys,
  secretDetailDataKeys,
  revealSecretKey,
  hideRevealedKey,
  getPlainValueForCopy,
  clearRevealedValues,
  editDataRows,
  editDataLoading,
  setEditDataValue,
  resetEditDataRow,
  removeEditDataRow,
  addEditDataRow,
  getEditDataRowError,
} = useSecretPage();

// 页面卸载时清空 reveal 得到的明文
onBeforeUnmount(clearRevealedValues);

const newEditDataKey = ref('');
const addNewEditData = () => {
  // incr6 遗留第 18 条：详情加载中按钮已禁用，回车（@press-enter）也不能添加
  if (editDataLoading.value) return;
  if (newEditDataKey.value.trim()) {
    addEditDataRow(newEditDataKey.value);
    newEditDataKey.value = '';
  }
};

/** 复制明文：经 reveal 取值，二进制内容不复制 */
const copySecretKey = async (key: string) => {
  const value = await getPlainValueForCopy(key);
  if (value === undefined) return;
  if (value === BINARY_VALUE_NOTICE) {
    message.warning(BINARY_VALUE_NOTICE);
    return;
  }
  await copyToClipboard(value);
};

// 添加新字段的方法
const newStringDataKey = ref('');
const newLabelKey = ref('');
const newAnnotationKey = ref('');
const newEditStringDataKey = ref('');
const newEditLabelKey = ref('');
const newEditAnnotationKey = ref('');

const addNewStringData = () => {
  if (newStringDataKey.value && newStringDataKey.value.trim()) {
    createFormModel.value.string_data[newStringDataKey.value.trim()] = '';
    newStringDataKey.value = '';
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

const addNewEditStringData = () => {
  // incr6 遗留第 18 条：详情加载中按钮已禁用，回车（@press-enter）也不能添加
  if (editDataLoading.value) return;
  if (newEditStringDataKey.value && newEditStringDataKey.value.trim()) {
    editFormModel.value.string_data[newEditStringDataKey.value.trim()] = '';
    newEditStringDataKey.value = '';
  }
};

const addNewEditLabel = () => {
  // incr6 遗留第 18 条：详情加载中按钮已禁用，回车（@press-enter）也不能添加
  if (editDataLoading.value) return;
  if (newEditLabelKey.value && newEditLabelKey.value.trim()) {
    editFormModel.value.labels[newEditLabelKey.value.trim()] = '';
    newEditLabelKey.value = '';
  }
};

const addNewEditAnnotation = () => {
  // incr6 遗留第 18 条：详情加载中按钮已禁用，回车（@press-enter）也不能添加
  if (editDataLoading.value) return;
  if (newEditAnnotationKey.value && newEditAnnotationKey.value.trim()) {
    editFormModel.value.annotations[newEditAnnotationKey.value.trim()] = '';
    newEditAnnotationKey.value = '';
  }
};

// 获取Secret类型CSS类名
const getSecretTypeClass = (type: string) => {
  const typeClassMap: Record<string, string> = {
    'Opaque': 'secret-type-opaque',
    'kubernetes.io/service-account-token': 'secret-type-service-account',
    'kubernetes.io/dockercfg': 'secret-type-docker',
    'kubernetes.io/dockerconfigjson': 'secret-type-docker',
    'kubernetes.io/basic-auth': 'secret-type-auth',
    'kubernetes.io/ssh-auth': 'secret-type-auth',
    'kubernetes.io/tls': 'secret-type-tls',
    'bootstrap.kubernetes.io/token': 'secret-type-auth',
  };
  return typeClassMap[type] || 'secret-type-default';
};

// 注意：时间格式化函数已移至 shared/utils.ts，使用 formatK8sTime 和 formatK8sAge

// 复制到剪贴板
const copyToClipboard = async (text: string) => {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      message.success('内容已复制到剪贴板');
    } else {
      // 降级方案
      const textArea = document.createElement('textarea');
      textArea.value = text;
      textArea.style.position = 'fixed';
      textArea.style.opacity = '0';
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      message.success('内容已复制到剪贴板');
    }
  } catch (error) {

    if (shouldNotifyPageError(error)) message.error('复制失败，请手动复制');
  }
};

const onSearch = () => {
  currentPage.value = 1;
  fetchSecrets();
};

const handleFilterChange = () => {
  currentPage.value = 1;
  fetchSecrets();
};

const handleClusterChange = () => {
  currentPage.value = 1;
  clearNamespaces();
  clearSecrets();

  if (filterClusterId.value) {
    fetchNamespaces(true); // 重置命名空间分页
    fetchSecrets();
  } else {
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
  { title: '名称', dataIndex: 'name', key: 'name', width: 150, ellipsis: true, fixed: 'left' },
  { title: '命名空间', dataIndex: 'namespace', key: 'namespace', width: 120, ellipsis: true },
  { title: '类型', key: 'type', width: 180, ellipsis: true, slots: { customRender: 'type' } },
  { title: '数据项数', dataIndex: 'data_count', key: 'data_count', width: 90, align: 'center' },
  { title: '大小', dataIndex: 'size', key: 'size', width: 100, align: 'center' },
  { title: '不可变', key: 'immutable', width: 90, align: 'center', slots: { customRender: 'immutable' } },
  { title: '标签', dataIndex: 'labels', key: 'labels', width: 150, slots: { customRender: 'labels' } },
  { title: '注解', dataIndex: 'annotations', key: 'annotations', width: 120, slots: { customRender: 'annotations' } },
  { title: 'UID', dataIndex: 'uid', key: 'uid', width: 100, ellipsis: true, slots: { customRender: 'uid' } },
  { title: '创建时间', key: 'created_at', width: 160, slots: { customRender: 'createdAt' } },
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
  filterType.value = undefined;
  clearFilterLabels();
  currentPage.value = 1;
  clearSecrets();
  clearNamespaces();
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

/* Secret 数据显示样式 */
.secret-data-key-row {
  padding: 8px 0;
  border-bottom: 1px solid var(--ops-border, rgba(0, 0, 0, 0.06));
}

.secret-data-key-header {
  display: flex;
  align-items: center;
  gap: 8px;
}

.secret-data-key-name {
  font-weight: 500;
}

.secret-data-key-size {
  color: var(--ops-muted);
}

.secret-data-key-actions {
  display: flex;
  gap: 8px;
  margin-left: auto;
}

.secret-data-plain {
  margin-top: 8px;
}

.secret-data-collapse :deep(.ant-collapse-header) {
  background: var(--ops-ground);
  border-radius: 4px !important;
  margin-bottom: 8px;
}

.secret-data-collapse :deep(.ant-collapse-content) {
  background: var(--ops-surface);
  border: 1px solid var(--ops-border);
  border-radius: 0 0 4px 4px;
  margin-bottom: 8px;
}

.secret-data-content pre {
  max-height: 300px;
  white-space: pre-wrap;
  word-wrap: break-word;
}

/* 敏感数据警告样式 */
.secret-data-collapse :deep(.ant-tag) {
  font-size: 10px;
  height: 18px;
  line-height: 16px;
  margin-left: 8px;
}
</style>

<style scoped src="./Secret.css"></style>
