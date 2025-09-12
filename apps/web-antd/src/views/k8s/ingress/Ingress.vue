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
                <h1>Ingress 管理</h1>
                <p class="k8s-page-subtitle">管理和监控集群中的所有 Kubernetes Ingress</p>
              </div>
            </div>
          </div>
        </a-col>
        <a-col :xs="24" :sm="24" :md="8" :lg="8" :xl="6">
          <div class="k8s-header-actions">
            <a-button type="primary" @click="openCreateModal" :disabled="!filterClusterId">
              <template #icon><PlusOutlined /></template>
              创建 Ingress
            </a-button>
            <a-button @click="fetchIngresses" :loading="loading">
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
            <a-select-option :value="K8sIngressStatus.RUNNING">✅ 运行中</a-select-option>
            <a-select-option :value="K8sIngressStatus.PENDING">⏳ 等待中</a-select-option>
            <a-select-option :value="K8sIngressStatus.FAILED">❌ 失败</a-select-option>
          </a-select>
          
          <!-- 标签过滤器 -->
          <div class="ingress-labels-filter">
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
            placeholder="🔍 搜索 Ingress 名称" 
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
            @click="resetFilters" 
            :disabled="!filterStatus && !searchText && !filterClusterId && !filterNamespace && Object.keys(filterLabels).length === 0"
            class="k8s-toolbar-btn"
            title="重置所有筛选条件"
          >
            <template #icon><DeleteOutlined /></template>
            重置筛选
          </a-button>
          
          <a-button 
            @click="fetchIngresses" 
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
            title="通过YAML创建Ingress"
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
            title="批量删除选中的 Ingress"
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
        :data-source="filteredIngresses"
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
        class="k8s-table ingress-table"
        :scroll="{ x: 1800 }"
      >
        <template #status="{ text }">
          <a-badge :status="getStatusColor(text)" :text="getStatusText(text)" />
        </template>

        <template #ingress_class_name="{ text }">
          <span v-if="text" class="ingress-class">{{ text }}</span>
          <span v-else class="k8s-no-data">-</span>
        </template>

        <template #hosts="{ text }">
          <div class="ingress-hosts">
            <a-tag 
              v-for="(host, index) in (text || []).slice(0, 3)" 
              :key="index" 
              class="host-tag"
              color="blue"
              size="small"
            >
              {{ host }}
            </a-tag>
            <a-tooltip v-if="(text || []).length > 3" :title="(text || []).join('\n')">
              <a-tag class="host-tag" color="blue" size="small">
                +{{ (text || []).length - 3 }} 更多
              </a-tag>
            </a-tooltip>
            <span v-if="!text || text.length === 0" class="k8s-no-data">-</span>
          </div>
        </template>

        <template #load_balancer="{ text }">
          <div class="ingress-load-balancer">
            <div v-if="text && text.ingress && text.ingress.length > 0">
              <a-tag 
                v-for="(lb, index) in text.ingress.slice(0, 2)" 
                :key="index" 
                class="lb-tag"
                color="orange"
                size="small"
              >
                {{ lb.ip || lb.hostname || 'N/A' }}
              </a-tag>
              <a-tooltip v-if="text.ingress.length > 2" :title="text.ingress.map((lb: any) => lb.ip || lb.hostname || 'N/A').join('\n')">
                <a-tag class="lb-tag" color="orange" size="small">
                  +{{ text.ingress.length - 2 }} 更多
                </a-tag>
              </a-tooltip>
            </div>
            <span v-else class="k8s-no-data">-</span>
          </div>
        </template>

        <template #rules="{ text }">
          <div class="ingress-rules">
            <a-tag 
              v-for="(rule, index) in (text || []).slice(0, 2)" 
              :key="index" 
              class="rule-tag"
              color="green"
              size="small"
            >
              {{ rule.host || '*' }}
            </a-tag>
            <a-tooltip v-if="(text || []).length > 2" :title="(text || []).map((r: any) => r.host || '*').join('\n')">
              <a-tag class="rule-tag" color="green" size="small">
                +{{ (text || []).length - 2 }} 更多
              </a-tag>
            </a-tooltip>
            <span v-if="!text || text.length === 0" class="k8s-no-data">-</span>
          </div>
        </template>

        <template #tls="{ text }">
          <div class="ingress-tls">
            <a-tag 
              v-for="(tls, index) in (text || []).slice(0, 2)" 
              :key="index" 
              class="tls-tag"
              color="purple"
              size="small"
            >
              🔒 {{ tls.secret_name || 'TLS' }}
            </a-tag>
            <a-tooltip v-if="(text || []).length > 2" :title="(text || []).map((t: any) => t.secret_name || 'TLS').join('\n')">
              <a-tag class="tls-tag" color="purple" size="small">
                +{{ (text || []).length - 2 }} 更多
              </a-tag>
            </a-tooltip>
            <span v-if="!text || text.length === 0" class="k8s-no-data">-</span>
          </div>
        </template>

        <template #labels="{ text }">
          <div class="k8s-labels-display">
            <template v-if="Array.isArray(text)">
              <!-- 数组格式 -->
              <a-tooltip v-for="label in text.slice(0, 3)" :key="label.key" :title="`${label.key}: ${label.value}`">
                <a-tag class="k8s-label-item" size="small">
                  {{ label.key }}: {{ label.value }}
                </a-tag>
              </a-tooltip>
              <a-tooltip v-if="text && text.length > 3" :title="text.map((item: any) => `${item.key}: ${item.value}`).join('\n')">
                <a-tag class="k8s-label-item" size="small">
                  {{ text.length }} 个标签
                </a-tag>
              </a-tooltip>
              <span v-if="!text || text.length === 0" class="k8s-no-data">-</span>
            </template>
            <template v-else-if="text && typeof text === 'object'">
              <!-- 对象格式 -->
              <a-tooltip v-for="[key, value] in Object.entries(text).slice(0, 3)" :key="key" :title="`${key}: ${value}`">
                <a-tag class="k8s-label-item" size="small">
                  {{ key }}: {{ value }}
                </a-tag>
              </a-tooltip>
              <a-tooltip v-if="text && Object.keys(text).length > 3" :title="Object.entries(text).map(([k, v]: [string, any]) => `${k}: ${v}`).join('\n')">
                <a-tag class="k8s-label-item" size="small">
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

        <template #actions="{ record }">
          <div class="k8s-action-column">
            <a-tooltip title="查看详情">
              <a-button title="查看详情" @click="showIngressDetail(record)">
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
                class="ant-btn-dangerous" 
                @click="deleteIngress(record)"
              >
                <template #icon><DeleteOutlined /></template>
              </a-button>
            </a-tooltip>
          </div>
        </template>

        <template #emptyText>
          <div class="k8s-empty-state">
            <GlobalOutlined />
            <p>暂无 Ingress 数据</p>
            <p>请先选择集群</p>
          </div>
        </template>
      </a-table>
    </div>

    <!-- 创建 Ingress 模态框 -->
    <a-modal
      v-model:open="isCreateModalVisible"
      title="创建 Ingress"
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
        <a-form-item label="Ingress 名称" name="name" :required="true">
          <a-input 
            v-model:value="createFormModel.name" 
            placeholder="请输入 Ingress 名称（例如：my-ingress）" 
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

        <a-form-item label="Ingress 类名（可选）" name="ingress_class_name">
          <a-input 
            v-model:value="createFormModel.ingress_class_name" 
            placeholder="请输入 Ingress 类名（例如：nginx）" 
            class="k8s-form-input"
          />
        </a-form-item>

        <a-form-item label="Ingress 规则">
          <div class="k8s-key-value-inputs">
            <div v-for="(rule, index) in createFormModel.rules" :key="index" class="k8s-key-value-row">
              <a-input 
                v-model:value="rule.host" 
                placeholder="主机名 (例如：example.com)" 
                class="k8s-form-input"
                style="flex: 1;"
              />
              <a-input 
                v-model:value="(rule.http.paths[0] as any).path" 
                placeholder="路径 (例如：/api)" 
                class="k8s-form-input"
                style="flex: 1;"
              />
              <a-select 
                v-model:value="(rule.http.paths[0] as any).path_type" 
                placeholder="路径类型" 
                class="k8s-form-input"
                style="width: 120px;"
              >
                <a-select-option value="Exact">Exact</a-select-option>
                <a-select-option value="Prefix">Prefix</a-select-option>
                <a-select-option value="ImplementationSpecific">Implementation</a-select-option>
              </a-select>
              <a-input 
                v-model:value="(rule as any).http.paths[0].backend.service.name" 
                placeholder="服务名称" 
                class="k8s-form-input"
                style="flex: 1;"
              />
              <a-input-number 
                v-model:value="(rule as any).http.paths[0].backend.service.port.number" 
                placeholder="端口" 
                class="k8s-form-input"
                style="width: 100px;"
                :min="1"
                :max="65535"
              />
              <a-button 
                type="text" 
                danger 
                @click="removeRuleField(index)" 
                :disabled="createFormModel.rules.length <= 1"
                size="small"
              >
                <template #icon><DeleteOutlined /></template>
              </a-button>
            </div>
            <a-button type="dashed" @click="addRuleField" style="margin-top: 8px;">
              <template #icon><PlusOutlined /></template>
              添加规则
            </a-button>
          </div>
        </a-form-item>

        <a-form-item label="TLS 配置（可选）" name="tls">
          <div class="k8s-key-value-inputs">
            <div v-if="!createFormModel.tls || createFormModel.tls.length === 0" style="text-align: center; color: #999; padding: 16px;">
              暂无 TLS 配置，点击下方按钮添加
            </div>
            <div v-for="(tls, index) in createFormModel.tls" :key="index" class="k8s-key-value-row">
              <a-input 
                v-model:value="tls.secret_name" 
                placeholder="Secret 名称" 
                class="k8s-form-input"
                style="flex: 1;"
              />
              <a-select 
                v-model:value="tls.hosts" 
                mode="tags"
                placeholder="主机列表"
                class="k8s-form-input"
                style="flex: 2;"
              >
              </a-select>
              <a-button type="text" danger @click="removeTlsField(index)" size="small">
                <template #icon><DeleteOutlined /></template>
              </a-button>
            </div>
            <a-button type="dashed" @click="addTlsField" style="margin-top: 8px;">
              <template #icon><PlusOutlined /></template>
              添加 TLS
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

    <!-- 编辑 Ingress 模态框 -->
    <a-modal
      v-model:open="isEditModalVisible"
      title="编辑 Ingress"
      @ok="submitEditForm"
      @cancel="closeEditModal"
      :confirmLoading="submitLoading"
      width="900px"
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
        <a-form-item label="Ingress 名称" name="name" :required="true">
          <a-input 
            v-model:value="editFormModel.name" 
            placeholder="请输入 Ingress 名称（例如：my-ingress）" 
            class="k8s-form-input"
            :maxlength="63"
            disabled
          />
          <div style="color: #999; font-size: 12px; margin-top: 4px;">
            Ingress 名称不可修改
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

        <a-form-item label="Ingress 类名（可选）" name="ingress_class_name">
          <a-input 
            v-model:value="editFormModel.ingress_class_name" 
            placeholder="请输入 Ingress 类名（例如：nginx）" 
            class="k8s-form-input"
          />
        </a-form-item>

        <a-form-item label="Ingress 规则">
          <div class="k8s-key-value-inputs">
            <div v-for="(rule, index) in editFormModel.rules" :key="index" class="k8s-key-value-row">
              <a-input 
                v-model:value="rule.host" 
                placeholder="主机名 (例如：example.com)" 
                class="k8s-form-input"
                style="flex: 1;"
              />
              <a-input 
                v-model:value="(rule.http.paths[0] as any).path" 
                placeholder="路径 (例如：/api)" 
                class="k8s-form-input"
                style="flex: 1;"
              />
              <a-select 
                v-model:value="(rule.http.paths[0] as any).path_type" 
                placeholder="路径类型" 
                class="k8s-form-input"
                style="width: 120px;"
              >
                <a-select-option value="Exact">Exact</a-select-option>
                <a-select-option value="Prefix">Prefix</a-select-option>
                <a-select-option value="ImplementationSpecific">Implementation</a-select-option>
              </a-select>
              <a-input 
                v-model:value="(rule as any).http.paths[0].backend.service.name" 
                placeholder="服务名称" 
                class="k8s-form-input"
                style="flex: 1;"
              />
              <a-input-number 
                v-model:value="(rule as any).http.paths[0].backend.service.port.number" 
                placeholder="端口" 
                class="k8s-form-input"
                style="width: 100px;"
                :min="1"
                :max="65535"
              />
              <a-button 
                type="text" 
                danger 
                @click="removeEditRuleField(index)" 
                :disabled="editFormModel.rules.length <= 1"
                size="small"
              >
                <template #icon><DeleteOutlined /></template>
              </a-button>
            </div>
            <a-button type="dashed" @click="addEditRuleField" style="margin-top: 8px;">
              <template #icon><PlusOutlined /></template>
              添加规则
            </a-button>
          </div>
        </a-form-item>

        <a-form-item label="TLS 配置（可选）" name="tls">
          <div class="k8s-key-value-inputs">
            <div v-if="!editFormModel.tls || editFormModel.tls.length === 0" style="text-align: center; color: #999; padding: 16px;">
              暂无 TLS 配置，点击下方按钮添加
            </div>
            <div v-for="(tls, index) in editFormModel.tls" :key="index" class="k8s-key-value-row">
              <a-input 
                v-model:value="tls.secret_name" 
                placeholder="Secret 名称" 
                class="k8s-form-input"
                style="flex: 1;"
              />
              <a-select 
                v-model:value="tls.hosts" 
                mode="tags"
                placeholder="主机列表"
                class="k8s-form-input"
                style="flex: 2;"
              >
              </a-select>
              <a-button type="text" danger @click="removeEditTlsField(index)" size="small">
                <template #icon><DeleteOutlined /></template>
              </a-button>
            </div>
            <a-button type="dashed" @click="addEditTlsField" style="margin-top: 8px;">
              <template #icon><PlusOutlined /></template>
              添加 TLS
            </a-button>
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
              <a-button type="text" danger @click="removeEditLabelField(key)" size="small">
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
              <a-button type="text" danger @click="removeEditAnnotationField(key)" size="small">
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

    <!-- 通过 YAML 创建 Ingress 模态框 -->
    <a-modal
      v-model:open="isCreateYamlModalVisible"
      title="通过 YAML 创建 Ingress"
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
            placeholder="请输入 Ingress YAML 内容" 
            :rows="20"
            class="yaml-textarea"
          />
        </a-form-item>
      </a-form>
    </a-modal>

    <!-- 详情模态框 -->
    <a-modal
      v-model:open="isDetailModalVisible"
      title="Ingress 详情"
      :footer="null"
      @cancel="closeDetailModal"
      width="1000px"
      :maskClosable="false"
      destroyOnClose
    >
      <a-spin :spinning="detailLoading">
        <div v-if="currentIngressDetail" class="k8s-detail-content">
          <a-row :gutter="[24, 16]">
            <a-col :xs="24" :lg="12">
              <a-card title="基本信息" class="k8s-detail-card" size="small">
                <div class="k8s-detail-item">
                  <span class="k8s-detail-label">Ingress 名称:</span>
                  <span class="k8s-detail-value">{{ currentIngressDetail.name }}</span>
                </div>
                <div class="k8s-detail-item">
                  <span class="k8s-detail-label">命名空间:</span>
                  <span class="k8s-detail-value">{{ currentIngressDetail.namespace }}</span>
                </div>
                <div class="k8s-detail-item">
                  <span class="k8s-detail-label">状态:</span>
                  <a-badge :status="getStatusColor(currentIngressDetail.status)" :text="getStatusText(currentIngressDetail.status)" />
                </div>
                <div class="k8s-detail-item">
                  <span class="k8s-detail-label">Ingress 类名:</span>
                  <span class="k8s-detail-value">{{ currentIngressDetail.ingress_class_name || '-' }}</span>
                </div>
                <div class="k8s-detail-item">
                  <span class="k8s-detail-label">UID:</span>
                  <span class="k8s-detail-value">{{ currentIngressDetail.uid || '-' }}</span>
                </div>
                <div class="k8s-detail-item">
                  <span class="k8s-detail-label">创建时间:</span>
                  <span class="k8s-detail-value">{{ currentIngressDetail.created_at || '-' }}</span>
                </div>
                <div class="k8s-detail-item">
                  <span class="k8s-detail-label">存在时间:</span>
                  <span class="k8s-detail-value">{{ currentIngressDetail.age || '-' }}</span>
                </div>
              </a-card>
            </a-col>
            
            <a-col :xs="24" :lg="12">
              <a-card title="主机信息" class="k8s-detail-card" size="small">
                <div class="k8s-detail-item">
                  <span class="k8s-detail-label">主机列表:</span>
                  <div class="k8s-detail-value">
                    <a-tag v-for="host in currentIngressDetail.hosts" :key="host" color="blue" size="small" style="margin-right: 4px;">
                      {{ host }}
                    </a-tag>
                    <span v-if="!currentIngressDetail.hosts || currentIngressDetail.hosts.length === 0">-</span>
                  </div>
                </div>
                <div class="k8s-detail-item">
                  <span class="k8s-detail-label">负载均衡器:</span>
                  <div class="k8s-detail-value">
                    <div v-if="currentIngressDetail.load_balancer && currentIngressDetail.load_balancer.ingress && currentIngressDetail.load_balancer.ingress.length > 0">
                      <a-tag 
                        v-for="lb in currentIngressDetail.load_balancer.ingress" 
                        :key="lb.ip || lb.hostname" 
                        color="orange" 
                        size="small" 
                        style="margin-right: 4px;"
                      >
                        {{ lb.ip || lb.hostname || 'N/A' }}
                      </a-tag>
                    </div>
                    <span v-else>-</span>
                  </div>
                </div>
              </a-card>
            </a-col>
          </a-row>

          <a-row :gutter="[24, 16]" style="margin-top: 16px;">
            <a-col :xs="24">
              <a-card title="Ingress 规则" class="k8s-detail-card" size="small">
                <a-table
                  :data-source="currentIngressDetail.rules || []"
                  :columns="ruleColumns"
                  :pagination="false"
                  size="small"
                  class="k8s-table"
                >
                  <template #paths="{ text }">
                    <div v-if="text && text.paths">
                      <a-tag 
                        v-for="(path, index) in text.paths" 
                        :key="index" 
                        color="green" 
                        size="small"
                        style="margin-bottom: 4px;"
                      >
                        {{ path.path }} ({{ path.path_type }})
                      </a-tag>
                    </div>
                    <span v-else>-</span>
                  </template>
                </a-table>
              </a-card>
            </a-col>
          </a-row>

          <a-row :gutter="[24, 16]" style="margin-top: 16px;">
            <a-col :xs="24">
              <a-card title="TLS 配置" class="k8s-detail-card" size="small">
                <a-table
                  :data-source="currentIngressDetail.tls || []"
                  :columns="tlsColumns"
                  :pagination="false"
                  size="small"
                  class="k8s-table"
                >
                  <template #hosts="{ text }">
                    <div v-if="text && text.length > 0">
                      <a-tag 
                        v-for="host in text" 
                        :key="host" 
                        color="purple" 
                        size="small"
                        style="margin-right: 4px;"
                      >
                        {{ host }}
                      </a-tag>
                    </div>
                    <span v-else>-</span>
                  </template>
                </a-table>
              </a-card>
            </a-col>
          </a-row>

          <a-row :gutter="[24, 16]" style="margin-top: 16px;">
            <a-col :xs="24" :lg="12">
              <a-card title="标签信息" class="k8s-detail-card" size="small">
                <div class="k8s-labels-display">
                  <a-tooltip v-for="(value, key) in (currentIngressDetail.labels || {})" :key="key" :title="`${key}: ${value}`" placement="top">
                    <a-tag class="k8s-label-item" style="margin-bottom: 8px; max-width: 200px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                      {{ key }}: {{ value }}
                    </a-tag>
                  </a-tooltip>
                  <span v-if="!currentIngressDetail.labels || Object.keys(currentIngressDetail.labels).length === 0" class="k8s-no-data">
                    暂无标签
                  </span>
                </div>
              </a-card>
            </a-col>

            <a-col :xs="24" :lg="12">
              <a-card title="注解信息" class="k8s-detail-card" size="small">
                <div class="k8s-annotations-display">
                  <a-tooltip v-for="(value, key) in (currentIngressDetail.annotations || {})" :key="key" :title="`${key}: ${value}`">
                    <div class="k8s-annotation-item" style="margin-bottom: 8px; display: inline-block; max-width: 100%; text-overflow: ellipsis; overflow: hidden; white-space: nowrap; margin-right: 8px;">
                      {{ key }}: {{ value }}
                    </div>
                  </a-tooltip>
                  <span v-if="!currentIngressDetail.annotations || Object.keys(currentIngressDetail.annotations).length === 0" class="k8s-no-data">
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
      :title="`查看/编辑 ${currentOperationIngress?.name} YAML`"
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
            class="yaml-textarea"
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
import { useIngressPage } from './Ingress';
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
  GlobalOutlined,
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
  isYamlModalVisible,
  submitLoading,
  detailLoading,
  
  // operation targets
  currentOperationIngress,
  currentIngressDetail,
  
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
  filteredIngresses,
  rowSelection,
  
  // helpers
  getEnvText,
  getStatusText,
  getStatusColor,
  
  // operations
  fetchClusters,
  fetchNamespaces,
  fetchIngresses,
  clearIngresses,
  clearNamespaces,
  loadMoreClusters,
  loadMoreNamespaces,
  
  // detail operations
  showIngressDetail,
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
  
  // ingress operations
  deleteIngress,
  
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
  addTlsField,
  removeTlsField,
  removeLabelField,
  removeAnnotationField,
  
  // edit form field operations
  addEditRuleField,
  removeEditRuleField,
  addEditTlsField,
  removeEditTlsField,
  addNewEditLabel,
  removeEditLabelField,
  addNewEditAnnotation,
  removeEditAnnotationField,
  
  // edit form helper variables
  newEditLabelKey,
  newEditAnnotationKey,
  
  // constants
  K8sIngressStatus,
} = useIngressPage();

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

const onSearch = () => {
  currentPage.value = 1;
  fetchIngresses();
};

const handleFilterChange = () => {
  currentPage.value = 1;
  fetchIngresses();
};

const handleClusterChange = () => {
  currentPage.value = 1;
  clearNamespaces();
  clearIngresses();
  
  if (filterClusterId.value) {
    const selectedCluster = clusters.value.find(c => c.id === filterClusterId.value);
    if (selectedCluster) {
      message.info(`已切换到集群: ${selectedCluster.name}`);
    }
    fetchNamespaces(true); // 重置命名空间分页
    fetchIngresses();
  } else {
    message.info('已清空 Ingress 列表，请选择集群查看 Ingress');
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
  { title: '名称', dataIndex: 'name', key: 'name', width: '12%' },
  { title: '命名空间', dataIndex: 'namespace', key: 'namespace', width: '10%' },
  { title: '状态', dataIndex: 'status', key: 'status', width: '8%', slots: { customRender: 'status' } },
  { title: 'Ingress类', dataIndex: 'ingress_class_name', key: 'ingress_class_name', width: '10%', slots: { customRender: 'ingress_class_name' } },
  { title: '主机', dataIndex: 'hosts', key: 'hosts', width: '15%', slots: { customRender: 'hosts' } },
  { title: '负载均衡器', dataIndex: 'load_balancer', key: 'load_balancer', width: '12%', slots: { customRender: 'load_balancer' } },
  { title: '规则', dataIndex: 'rules', key: 'rules', width: '12%', slots: { customRender: 'rules' } },
  { title: 'TLS', dataIndex: 'tls', key: 'tls', width: '10%', slots: { customRender: 'tls' } },
  { title: '标签', dataIndex: 'labels', key: 'labels', width: '12%', slots: { customRender: 'labels' } },
  { title: '操作', key: 'actions', width: '15%', fixed: 'right', slots: { customRender: 'actions' } },
];

const ruleColumns = [
  { title: '主机', dataIndex: 'host', key: 'host' },
  { title: '路径', dataIndex: 'http', key: 'http', slots: { customRender: 'paths' } },
];

const tlsColumns = [
  { title: 'Secret 名称', dataIndex: 'secret_name', key: 'secret_name' },
  { title: '主机列表', dataIndex: 'hosts', key: 'hosts', slots: { customRender: 'hosts' } },
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
  clearIngresses();
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

<style scoped src="./Ingress.css"></style>
