<template>
  <div class="k8s-management-container">
    <!-- 页面头部 -->
    <div class="k8s-page-header">
      <a-row class="k8s-header-content" :gutter="[24, 16]">
        <a-col :xs="24" :sm="24" :md="16" :lg="16" :xl="18">
          <div class="k8s-title-section">
            <div class="k8s-page-title">
              <SafetyCertificateOutlined class="k8s-title-icon" />
              <div>
                <h1>Role 管理</h1>
                <p class="k8s-page-subtitle">管理和监控集群中的所有 Kubernetes Role</p>
              </div>
            </div>
          </div>
        </a-col>
        <a-col :xs="24" :sm="24" :md="8" :lg="8" :xl="6">
          <div class="k8s-header-actions">
            <a-button type="primary" @click="openCreateModal" :disabled="!filterClusterId">
              <template #icon><PlusOutlined /></template>
              创建 Role
            </a-button>
            <a-button @click="fetchRoles" :loading="loading">
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
                <a-tag color="blue" size="small">{{ cluster.env ? getEnvText(cluster.env) : '未知' }}</a-tag>
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
          
          <!-- 标签过滤器 -->
          <div class="role-labels-filter">
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
            placeholder="🔍 搜索 Role 名称" 
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
            :disabled="!searchText && !filterClusterId && !filterNamespace && Object.keys(filterLabels).length === 0"
            class="k8s-toolbar-btn"
            title="重置所有筛选条件"
          >
            <template #icon><DeleteOutlined /></template>
            重置筛选
          </a-button>
          
          <a-button 
            @click="fetchRoles" 
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
            title="通过YAML创建Role"
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
            title="批量删除选中的 Role"
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
        :data-source="filteredRoles"
        :row-selection="rowSelection"
        :loading="loading"
        :row-key="(record: K8sRole) => `${record.namespace}/${record.name}`"
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
        class="k8s-table role-table"
        :scroll="{ x: 1600 }"
      >
        <template #rules="{ record }">
          <div class="role-rules">
            <template v-if="getRulesFromRecord(record) && getRulesFromRecord(record).length > 0">
              <div v-for="(rule, index) in getRulesFromRecord(record).slice(0, 2)" :key="index" class="rule-item">
                <div class="rule-verbs">
                  <a-tag v-for="verb in (rule.verbs || []).slice(0, 3)" :key="verb" color="blue" size="small">
                    {{ verb }}
                  </a-tag>
                  <a-tag v-if="(rule.verbs || []).length > 3" size="small">
                    +{{ (rule.verbs || []).length - 3 }}
                  </a-tag>
                </div>
                <div class="rule-resources">
                  <span class="rule-label">资源:</span>
                  <a-tag v-for="resource in (rule.resources || []).slice(0, 2)" :key="resource" color="green" size="small">
                    {{ resource }}
                  </a-tag>
                  <a-tag v-if="(rule.resources || []).length > 2" size="small">
                    +{{ (rule.resources || []).length - 2 }}
                  </a-tag>
                </div>
              </div>
              <div v-if="getRulesFromRecord(record).length > 2" class="rule-more">
                <a-tag size="small">+{{ getRulesFromRecord(record).length - 2 }} 更多规则</a-tag>
              </div>
            </template>
            <span v-else class="k8s-no-data">无策略规则</span>
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
              <a-button title="查看详情" @click="showRoleDetail(record)">
                <template #icon><EyeOutlined /></template>
              </a-button>
            </a-tooltip>
            <a-tooltip title="查看 YAML">
              <a-button title="查看 YAML" @click="showYamlModal(record)">
                <template #icon><FileTextOutlined /></template>
              </a-button>
            </a-tooltip>
            <a-tooltip title="删除">
              <a-button 
                title="删除" 
                danger 
                @click="deleteRole(record)"
              >
                <template #icon><DeleteOutlined /></template>
              </a-button>
            </a-tooltip>
          </div>
        </template>

        <template #emptyText>
          <div class="k8s-empty-state">
            <SafetyCertificateOutlined />
            <p>暂无 Role 数据</p>
            <p>请先选择集群</p>
          </div>
        </template>
      </a-table>
    </div>

    <!-- 创建 Role 模态框 -->
    <a-modal
      v-model:open="isCreateModalVisible"
      title="创建 Role"
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
        <a-form-item label="Role 名称" name="name" :required="true">
          <a-input 
            v-model:value="createFormModel.name" 
            placeholder="请输入 Role 名称（例如：pod-reader）" 
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

        <a-form-item label="策略规则" :required="true">
          <div class="role-rules-inputs">
            <div v-for="(rule, ruleIndex) in createFormModel.rules" :key="ruleIndex" class="rule-input-group">
              <div class="rule-header">
                <span class="rule-title">规则 {{ ruleIndex + 1 }}</span>
                <a-button 
                  type="text" 
                  danger 
                  @click="removeRuleField(ruleIndex)" 
                  :disabled="createFormModel.rules.length <= 1"
                  size="small"
                >
                  <template #icon><DeleteOutlined /></template>
                  删除规则
                </a-button>
              </div>

              <!-- 动词 -->
              <div class="rule-field">
                <label class="rule-field-label">动词 (Verbs) *</label>
                <div class="rule-tags-input">
                  <div class="tags-display">
                    <a-tag 
                      v-for="(verb, verbIndex) in rule.verbs" 
                      :key="verbIndex"
                      closable
                      @close="removeVerbFromRule(ruleIndex, verbIndex)"
                      color="blue"
                    >
                      {{ verb }}
                    </a-tag>
                  </div>
                  <div class="add-tag-row">
                    <a-select
                      :value="newVerbs[ruleIndex]"
                      @change="(value: string) => newVerbs[ruleIndex] = value"
                      placeholder="选择动词"
                      style="flex: 1; margin-right: 8px;"
                    >
                      <a-select-option value="get">get</a-select-option>
                      <a-select-option value="list">list</a-select-option>
                      <a-select-option value="watch">watch</a-select-option>
                      <a-select-option value="create">create</a-select-option>
                      <a-select-option value="update">update</a-select-option>
                      <a-select-option value="patch">patch</a-select-option>
                      <a-select-option value="delete">delete</a-select-option>
                      <a-select-option value="deletecollection">deletecollection</a-select-option>
                      <a-select-option value="*">* (全部)</a-select-option>
                    </a-select>
                    <a-button 
                      type="primary" 
                      @click="() => { addVerbToRule(ruleIndex, newVerbs[ruleIndex] || ''); newVerbs[ruleIndex] = ''; }"
                      :disabled="!newVerbs[ruleIndex]"
                      size="small"
                    >
                      <template #icon><PlusOutlined /></template>
                    </a-button>
                  </div>
                </div>
              </div>

              <!-- API 组 -->
              <div class="rule-field">
                <label class="rule-field-label">API 组 (API Groups)</label>
                <div class="rule-tags-input">
                  <div class="tags-display">
                    <a-tag 
                      v-for="(apiGroup, groupIndex) in rule.api_groups" 
                      :key="groupIndex"
                      closable
                      @close="removeApiGroupFromRule(ruleIndex, groupIndex)"
                      color="green"
                    >
                      {{ apiGroup || '""(core)' }}
                    </a-tag>
                  </div>
                  <div class="add-tag-row">
                    <a-input
                      :value="newApiGroups[ruleIndex]"
                      @input="(e: any) => newApiGroups[ruleIndex] = e.target.value"
                      placeholder="输入API组，空白表示core组"
                      style="flex: 1; margin-right: 8px;"
                      @press-enter="() => { addApiGroupToRule(ruleIndex, newApiGroups[ruleIndex] || ''); newApiGroups[ruleIndex] = ''; }"
                    />
                    <a-button 
                      type="primary" 
                      @click="() => { addApiGroupToRule(ruleIndex, newApiGroups[ruleIndex] || ''); newApiGroups[ruleIndex] = ''; }"
                      size="small"
                    >
                      <template #icon><PlusOutlined /></template>
                    </a-button>
                  </div>
                </div>
              </div>

              <!-- 资源 -->
              <div class="rule-field">
                <label class="rule-field-label">资源 (Resources) *</label>
                <div class="rule-tags-input">
                  <div class="tags-display">
                    <a-tag 
                      v-for="(resource, resourceIndex) in rule.resources" 
                      :key="resourceIndex"
                      closable
                      @close="removeResourceFromRule(ruleIndex, resourceIndex)"
                      color="orange"
                    >
                      {{ resource }}
                    </a-tag>
                  </div>
                  <div class="add-tag-row">
                    <a-input
                      :value="newResources[ruleIndex]"
                      @input="(e: any) => newResources[ruleIndex] = e.target.value"
                      placeholder="输入资源类型，如: pods, services"
                      style="flex: 1; margin-right: 8px;"
                      @press-enter="() => { addResourceToRule(ruleIndex, newResources[ruleIndex] || ''); newResources[ruleIndex] = ''; }"
                    />
                    <a-button 
                      type="primary" 
                      @click="() => { addResourceToRule(ruleIndex, newResources[ruleIndex] || ''); newResources[ruleIndex] = ''; }"
                      :disabled="!newResources[ruleIndex]?.trim()"
                      size="small"
                    >
                      <template #icon><PlusOutlined /></template>
                    </a-button>
                  </div>
                </div>
              </div>
            </div>

            <a-button type="dashed" @click="addRuleField" style="margin-top: 16px; width: 100%;">
              <template #icon><PlusOutlined /></template>
              添加策略规则
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
              <a-button type="text" danger @click="removeLabelField(key)" size="small">
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
              <a-button type="text" danger @click="removeAnnotationField(key)" size="small">
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

    <!-- 通过 YAML 创建 Role 模态框 -->
    <a-modal
      v-model:open="isCreateYamlModalVisible"
      title="通过 YAML 创建 Role"
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
            placeholder="请输入 Role YAML 内容" 
            :rows="20"
            class="k8s-config-textarea"
          />
        </a-form-item>
      </a-form>
    </a-modal>

    <!-- 详情模态框 -->
    <a-modal
      v-model:open="isDetailModalVisible"
      title="Role 详情"
      :footer="null"
      @cancel="closeDetailModal"
      width="1000px"
      :maskClosable="false"
      destroyOnClose
    >
      <a-spin :spinning="detailLoading">
        <div v-if="currentRoleDetail" class="k8s-detail-content">
          <a-row :gutter="[24, 16]">
            <a-col :xs="24" :lg="12">
              <a-card title="基本信息" class="k8s-detail-card" size="small">
                <div class="k8s-detail-item">
                  <span class="k8s-detail-label">Role 名称:</span>
                  <span class="k8s-detail-value">{{ currentRoleDetail.name }}</span>
                </div>
                <div class="k8s-detail-item">
                  <span class="k8s-detail-label">命名空间:</span>
                  <span class="k8s-detail-value">{{ currentRoleDetail.namespace }}</span>
                </div>
                <div class="k8s-detail-item">
                  <span class="k8s-detail-label">集群ID:</span>
                  <span class="k8s-detail-value">{{ currentRoleDetail.cluster_id }}</span>
                </div>
                <div class="k8s-detail-item">
                  <span class="k8s-detail-label">UID:</span>
                  <span class="k8s-detail-value">{{ currentRoleDetail.uid || '-' }}</span>
                </div>
                <div class="k8s-detail-item">
                  <span class="k8s-detail-label">创建时间:</span>
                  <span class="k8s-detail-value">{{ currentRoleDetail.creation_timestamp || '-' }}</span>
                </div>
                <div class="k8s-detail-item">
                  <span class="k8s-detail-label">存在时间:</span>
                  <span class="k8s-detail-value">{{ formatAge(currentRoleDetail.age, currentRoleDetail.creation_timestamp) }}</span>
                </div>
              </a-card>
            </a-col>
            
            <a-col :xs="24" :lg="12">
              <a-card title="策略规则统计" class="k8s-detail-card" size="small">
                <div class="k8s-detail-item">
                  <span class="k8s-detail-label">规则数量:</span>
                  <span class="k8s-detail-value">{{ getRulesFromRecord(currentRoleDetail).length }}</span>
                </div>
                <div class="k8s-detail-item">
                  <span class="k8s-detail-label">总动词数:</span>
                  <span class="k8s-detail-value">{{ getTotalVerbs(getRulesFromRecord(currentRoleDetail)) }}</span>
                </div>
                <div class="k8s-detail-item">
                  <span class="k8s-detail-label">总资源数:</span>
                  <span class="k8s-detail-value">{{ getTotalResources(getRulesFromRecord(currentRoleDetail)) }}</span>
                </div>
              </a-card>
            </a-col>
          </a-row>

          <a-row :gutter="[24, 16]" style="margin-top: 16px;">
            <a-col :xs="24">
              <a-card title="策略规则详情" class="k8s-detail-card" size="small">
                <div class="role-rules-detail">
                  <template v-if="getRulesFromRecord(currentRoleDetail).length > 0">
                    <div v-for="(rule, index) in getRulesFromRecord(currentRoleDetail)" :key="index" class="rule-detail-item">
                      <div class="rule-detail-header">
                        <span class="rule-detail-title">规则 {{ index + 1 }}</span>
                      </div>
                      <div class="rule-detail-content">
                        <div class="rule-detail-row">
                          <span class="rule-detail-label">动词:</span>
                          <div class="rule-detail-tags">
                            <a-tag v-for="verb in (rule.verbs || [])" :key="verb" color="blue" size="small">
                              {{ verb }}
                            </a-tag>
                            <span v-if="!(rule.verbs || []).length" class="k8s-no-data">-</span>
                          </div>
                        </div>
                        <div class="rule-detail-row">
                          <span class="rule-detail-label">API 组:</span>
                          <div class="rule-detail-tags">
                            <a-tag v-for="apiGroup in (rule.apiGroups || [])" :key="apiGroup" color="green" size="small">
                              {{ apiGroup || '"" (core)' }}
                            </a-tag>
                            <span v-if="!(rule.apiGroups || []).length" class="k8s-no-data">-</span>
                          </div>
                        </div>
                        <div class="rule-detail-row">
                          <span class="rule-detail-label">资源:</span>
                          <div class="rule-detail-tags">
                            <a-tag v-for="resource in (rule.resources || [])" :key="resource" color="orange" size="small">
                              {{ resource }}
                            </a-tag>
                            <span v-if="!(rule.resources || []).length" class="k8s-no-data">-</span>
                          </div>
                        </div>
                        <div v-if="(rule.resourceNames || []).length > 0" class="rule-detail-row">
                          <span class="rule-detail-label">资源名称:</span>
                          <div class="rule-detail-tags">
                            <a-tag v-for="resourceName in (rule.resourceNames || [])" :key="resourceName" color="purple" size="small">
                              {{ resourceName }}
                            </a-tag>
                          </div>
                        </div>
                      </div>
                    </div>
                  </template>
                  <span v-else class="k8s-no-data">
                    暂无策略规则
                  </span>
                </div>
              </a-card>
            </a-col>
          </a-row>

          <a-row :gutter="[24, 16]" style="margin-top: 16px;">
            <a-col :xs="24" :lg="12">
              <a-card title="标签信息" class="k8s-detail-card" size="small">
                <div class="k8s-labels-display">
                  <a-tooltip v-for="[key, value] in Object.entries(currentRoleDetail.labels || {})" :key="key" :title="`${key}: ${value}`" placement="top">
                    <a-tag class="k8s-label-item" style="margin-bottom: 8px; max-width: 200px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                      {{ key }}: {{ value }}
                    </a-tag>
                  </a-tooltip>
                  <span v-if="!currentRoleDetail.labels || Object.keys(currentRoleDetail.labels).length === 0" class="k8s-no-data">
                    暂无标签
                  </span>
                </div>
              </a-card>
            </a-col>

            <a-col :xs="24" :lg="12">
              <a-card title="注解信息" class="k8s-detail-card" size="small">
                <div class="k8s-annotations-display">
                  <a-tooltip v-for="[key, value] in Object.entries(currentRoleDetail.annotations || {})" :key="key" :title="`${key}: ${value}`" placement="top">
                    <a-tag class="k8s-annotation-item" style="margin-bottom: 8px; max-width: 200px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                      {{ key }}: {{ value }}
                    </a-tag>
                  </a-tooltip>
                  <span v-if="!currentRoleDetail.annotations || Object.keys(currentRoleDetail.annotations).length === 0" class="k8s-no-data">
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
      :title="`查看/编辑 ${currentOperationRole?.name} YAML`"
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
import { onMounted, ref, watch } from 'vue';
import { message } from 'ant-design-vue';
import { useRolePage } from './Role';
import type { K8sRole } from '#/api/core/k8s/k8s_role';
import { 
  PlusOutlined, 
  ReloadOutlined, 
  DeleteOutlined, 
  SafetyCertificateOutlined,
  AppstoreOutlined,
  EyeOutlined,
  TagsOutlined,
  DeploymentUnitOutlined,
  SearchOutlined,
  FileTextOutlined,
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
  isDetailModalVisible,
  isYamlModalVisible,
  submitLoading,
  detailLoading,
  
  // operation targets
  currentOperationRole,
  currentRoleDetail,
  
  // form models
  createFormModel,
  createYamlFormModel,
  yamlFormModel,
  
  // form refs
  formRef,
  yamlFormRef,
  createYamlFormRef,
  
  // form rules
  createFormRules,
  createYamlFormRules,
  yamlFormRules,
  
  // computed
  filteredRoles,
  rowSelection,
  
  // helpers
  getEnvText,
  
  // operations
  fetchClusters,
  fetchNamespaces,
  fetchRoles,
  clearRoles,
  clearNamespaces,
  loadMoreClusters,
  loadMoreNamespaces,
  
  // detail operations
  showRoleDetail,
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
  
  // role operations
  deleteRole,
  
  // filter operations
  addFilterLabel,
  removeFilterLabel,
  clearFilterLabels,
  
  // batch operations
  batchOperation,
  
  // pagination operations
  handlePageChange,
  
  // form field operations
  addRuleField,
  removeRuleField,
  addVerbToRule,
  removeVerbFromRule,
  addApiGroupToRule,
  removeApiGroupFromRule,
  addResourceToRule,
  removeResourceFromRule,
  removeLabelField,
  removeAnnotationField,
} = useRolePage();

// 添加新标签/注解的方法
const newLabelKey = ref('');
const newAnnotationKey = ref('');

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

// 规则输入字段状态
const newVerbs = ref<string[]>([]);
const newApiGroups = ref<string[]>([]);
const newResources = ref<string[]>([]);

// 初始化规则输入字段
watch(
  () => createFormModel.value.rules.length,
  (newLength) => {
    while (newVerbs.value.length < newLength) {
      newVerbs.value.push('');
      newApiGroups.value.push('');
      newResources.value.push('');
    }
  },
  { immediate: true }
);

const onSearch = () => {
  currentPage.value = 1;
  fetchRoles();
};

const handleFilterChange = () => {
  currentPage.value = 1;
  fetchRoles();
};

const handleClusterChange = () => {
  currentPage.value = 1;
  clearNamespaces();
  clearRoles();
  
  if (filterClusterId.value) {
    const selectedCluster = clusters.value.find(c => c.id === filterClusterId.value);
    if (selectedCluster) {
      message.info(`已切换到集群: ${selectedCluster.name}`);
    }
    fetchNamespaces(true);
    fetchRoles();
  } else {
    message.info('已清空 Role 列表，请选择集群查看 Role');
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

// 从record中获取rules信息，如果rules为null则尝试从annotations中解析
const getRulesFromRecord = (record: any): any[] => {
  if (!record) return [];
  
  // 如果rules字段存在且不为null，直接返回
  if (record.rules && Array.isArray(record.rules)) {
    return record.rules;
  }
  
  // 尝试从annotations中解析rules
  if (record.annotations && record.annotations['kubectl.kubernetes.io/last-applied-configuration']) {
    try {
      const config = JSON.parse(record.annotations['kubectl.kubernetes.io/last-applied-configuration']);
      if (config.rules && Array.isArray(config.rules)) {
        return config.rules;
      }
    } catch (error) {
      console.warn('Failed to parse role rules from annotations:', error);
    }
  }
  
  return [];
};

// 格式化age显示
const formatAge = (age: string, creationTimestamp?: string): string => {
  if (age && age.trim() !== '') {
    return age;
  }
  
  if (!creationTimestamp) {
    return '-';
  }
  
  try {
    const createTime = new Date(creationTimestamp);
    const now = new Date();
    const diff = now.getTime() - createTime.getTime();
    
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    
    if (days > 0) {
      return `${days}天`;
    } else if (hours > 0) {
      return `${hours}小时`;
    } else if (minutes > 0) {
      return `${minutes}分钟`;
    } else {
      return '刚刚';
    }
  } catch (error) {
    console.warn('Failed to calculate age:', error);
    return '-';
  }
};

// 计算统计信息
const getTotalVerbs = (rules: any[]) => {
  return rules.reduce((total, rule) => total + (rule.verbs || []).length, 0);
};

const getTotalResources = (rules: any[]) => {
  return rules.reduce((total, rule) => total + (rule.resources || []).length, 0);
};

const columns = [
  { title: '名称', dataIndex: 'name', key: 'name', width: '15%' },
  { title: '命名空间', dataIndex: 'namespace', key: 'namespace', width: '12%' },
  { title: '策略规则', key: 'rules', width: '30%', slots: { customRender: 'rules' } },
  { title: '标签', dataIndex: 'labels', key: 'labels', width: '15%', slots: { customRender: 'labels' } },
  { title: '创建时间', dataIndex: 'creation_timestamp', key: 'creation_timestamp', width: '12%' },
  { title: '存在时间', dataIndex: 'age', key: 'age', width: '8%', customRender: ({ text, record }: any) => formatAge(text, record.creation_timestamp) },
  { title: '操作', key: 'actions', width: '8%', fixed: 'right', slots: { customRender: 'actions' } },
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
  clearFilterLabels();
  currentPage.value = 1;
  clearRoles();
  clearNamespaces();
  message.success('已重置所有筛选条件');
};

onMounted(async () => {
  await fetchClusters();
});
</script>

<style scoped>
@import '../shared/k8s-common.css';
</style>

<style scoped src="./Role.css"></style>
