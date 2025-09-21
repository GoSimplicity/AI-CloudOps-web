<template>
  <div class="k8s-management-container">
    <!-- 页面头部 -->
    <div class="k8s-page-header">
      <a-row class="k8s-header-content" :gutter="[24, 16]">
        <a-col :xs="24" :sm="24" :md="16" :lg="16" :xl="18">
          <div class="k8s-title-section">
            <div class="k8s-page-title">
              <ContainerOutlined class="k8s-title-icon" />
              <div>
                <h1>Pod 管理</h1>
                <p class="k8s-page-subtitle">管理和监控集群中的所有 Kubernetes Pod</p>
              </div>
            </div>
          </div>
        </a-col>
        <a-col :xs="24" :sm="24" :md="8" :lg="8" :xl="6">
          <div class="k8s-header-actions">
            <a-button type="primary" @click="openCreateModal" :disabled="!filterClusterId">
              <template #icon><PlusOutlined /></template>
              创建 Pod
            </a-button>
            <a-button @click="fetchPods" :loading="loading">
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
          
          <a-select 
            v-model:value="filterStatus" 
            placeholder="状态筛选" 
            class="k8s-filter-select" 
            allow-clear 
            @change="handleFilterChange"
          >
            <template #suffixIcon><FilterOutlined /></template>
            <a-select-option :value="K8sPodStatus.Pending">⏳ 等待中</a-select-option>
            <a-select-option :value="K8sPodStatus.Running">✅ 运行中</a-select-option>
            <a-select-option :value="K8sPodStatus.Succeeded">🎉 已完成</a-select-option>
            <a-select-option :value="K8sPodStatus.Failed">❌ 失败</a-select-option>
            <a-select-option :value="K8sPodStatus.Unknown">❓ 未知</a-select-option>
          </a-select>

          <a-select 
            v-model:value="filterPhase" 
            placeholder="阶段筛选" 
            class="k8s-filter-select" 
            allow-clear 
            @change="handleFilterChange"
          >
            <template #suffixIcon><ApiOutlined /></template>
            <a-select-option :value="K8sPodPhase.Pending">⏳ Pending</a-select-option>
            <a-select-option :value="K8sPodPhase.Running">✅ Running</a-select-option>
            <a-select-option :value="K8sPodPhase.Succeeded">🎉 Succeeded</a-select-option>
            <a-select-option :value="K8sPodPhase.Failed">❌ Failed</a-select-option>
            <a-select-option :value="K8sPodPhase.Unknown">❓ Unknown</a-select-option>
          </a-select>
          
          <!-- 标签过滤器 -->
          <div class="pod-labels-filter">
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
            placeholder="🔍 搜索 Pod 名称" 
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
            :disabled="!filterStatus && !filterPhase && !searchText && !filterClusterId && !filterNamespace && Object.keys(filterLabels).length === 0"
            class="k8s-toolbar-btn"
            title="重置所有筛选条件"
          >
            <template #icon><DeleteOutlined /></template>
            重置筛选
          </a-button>
          
          <a-button 
            @click="fetchPods" 
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
            title="通过YAML创建Pod"
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
            title="批量删除选中的 Pod"
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
        :data-source="filteredPods"
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
        class="k8s-table pod-table"
        :scroll="{ x: 1800 }"
      >
        <template #status="{ text }">
          <a-badge :status="getStatusColor(text)" :text="getStatusText(text)" />
        </template>

        <template #phase="{ text }">
          <a-tag :color="getStatusColor(text)">{{ getPhaseText(text) }}</a-tag>
        </template>

        <template #ready="{ record }">
          <div class="pod-ready">
            <span class="ready-text">{{ record.ready }}</span>
            <a-progress 
              v-if="record.ready && record.ready.includes('/')"
              :percent="calculateReadyPercent(record.ready)" 
              size="small" 
              :show-info="false"
              :status="isFullyReady(record.ready) ? 'success' : 'active'"
              style="margin-top: 4px; max-width: 80px;"
            />
          </div>
        </template>

        <template #restarts="{ text }">
          <a-tag :color="text > 0 ? 'warning' : 'success'">{{ text || 0 }}</a-tag>
        </template>

        <template #node_name="{ text }">
          <a-tag v-if="text" color="cyan">{{ text }}</a-tag>
          <span v-else class="k8s-no-data">-</span>
        </template>

        <template #pod_ip="{ text }">
          <code v-if="text" class="pod-ip">{{ text }}</code>
          <span v-else class="k8s-no-data">-</span>
        </template>

        <template #qos_class="{ text }">
          <a-tag v-if="text" :color="getQosClassColor(text)">{{ text }}</a-tag>
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
              <a-button title="查看详情" @click="showPodDetail(record)">
                <template #icon><EyeOutlined /></template>
              </a-button>
            </a-tooltip>
            <a-tooltip title="查看 YAML">
              <a-button title="查看 YAML" @click="showYamlModal(record)">
                <template #icon><FileTextOutlined /></template>
              </a-button>
            </a-tooltip>
            <a-tooltip title="查看日志">
              <a-button title="查看日志" @click="showLogsModal(record)">
                <template #icon><FileSearchOutlined /></template>
              </a-button>
            </a-tooltip>
            <a-tooltip title="执行命令">
              <a-button title="执行命令" @click="showExecModal(record)" :disabled="record.status !== 'Running'">
                <template #icon><CodeOutlined /></template>
              </a-button>
            </a-tooltip>
            <a-tooltip title="端口转发">
              <a-button title="端口转发" @click="showPortForwardModal(record)" :disabled="record.status !== 'Running'">
                <template #icon><LinkOutlined /></template>
              </a-button>
            </a-tooltip>
            <a-tooltip title="文件管理">
              <a-button title="文件管理" @click="showFileManagerModal(record)" :disabled="record.status !== 'Running'">
                <template #icon><FolderOutlined /></template>
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
                @click="deletePod(record)"
              >
                <template #icon><DeleteOutlined /></template>
              </a-button>
            </a-tooltip>
          </div>
        </template>

        <template #emptyText>
          <div class="k8s-empty-state">
            <ContainerOutlined />
            <p>暂无 Pod 数据</p>
            <p>请先选择集群</p>
          </div>
        </template>
      </a-table>
    </div>

    <!-- 创建 Pod 模态框 -->
    <a-modal
      v-model:open="isCreateModalVisible"
      title="创建 Pod"
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
            <a-form-item label="Pod 名称" name="name" :required="true">
              <a-input 
                v-model:value="createFormModel.name" 
                placeholder="请输入 Pod 名称（例如：my-pod）" 
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

        <!-- 容器配置 -->
        <a-form-item label="容器配置" :required="true">
          <div class="pod-containers-config">
            <div v-for="(container, index) in createFormModel.containers" :key="index" class="container-config-item">
              <div class="container-header">
                <span>容器 {{ index + 1 }}</span>
                <a-button 
                  type="text" 
                  danger 
                  @click="removeContainerField(index)" 
                  :disabled="createFormModel.containers.length <= 1"
                  size="small"
                >
                  <template #icon><DeleteOutlined /></template>
                </a-button>
              </div>
              
              <a-row :gutter="16">
                <a-col :span="8">
                  <a-form-item label="容器名称">
                    <a-input v-model:value="container.name" placeholder="容器名称" />
                  </a-form-item>
                </a-col>
                <a-col :span="8">
                  <a-form-item label="镜像">
                    <a-input v-model:value="container.image" placeholder="例如：nginx:latest" />
                  </a-form-item>
                </a-col>
                <a-col :span="8">
                  <a-form-item label="镜像拉取策略">
                    <a-select v-model:value="container.image_pull_policy">
                      <a-select-option value="Always">Always</a-select-option>
                      <a-select-option value="IfNotPresent">IfNotPresent</a-select-option>
                      <a-select-option value="Never">Never</a-select-option>
                    </a-select>
                  </a-form-item>
                </a-col>
              </a-row>

              <!-- 环境变量 -->
              <a-form-item label="环境变量">
                <div class="env-vars-config">
                  <div v-for="(env, envIndex) in (container.envs || [])" :key="envIndex" class="env-var-row">
                    <a-input v-model:value="env.name" placeholder="环境变量名" style="width: 45%;" />
                    <a-input v-model:value="env.value" placeholder="环境变量值" style="width: 45%;" />
                    <a-button type="text" danger @click="removeEnvField(index, envIndex)" size="small">
                      <template #icon><DeleteOutlined /></template>
                    </a-button>
                  </div>
                  <a-button type="dashed" @click="addEnvField(index)" style="width: 100%; margin-top: 8px;">
                    <template #icon><PlusOutlined /></template>
                    添加环境变量
                  </a-button>
                </div>
              </a-form-item>

              <!-- 端口配置 -->
              <a-form-item label="端口配置">
                <div class="ports-config">
                  <div v-for="(port, portIndex) in (container.ports || [])" :key="portIndex" class="port-row">
                    <a-input v-model:value="port.name" placeholder="端口名称" style="width: 30%;" />
                    <a-input-number v-model:value="port.container_port" placeholder="端口号" :min="1" :max="65535" style="width: 30%;" />
                    <a-select v-model:value="port.protocol" placeholder="协议" style="width: 30%;">
                      <a-select-option value="TCP">TCP</a-select-option>
                      <a-select-option value="UDP">UDP</a-select-option>
                    </a-select>
                    <a-button type="text" danger @click="removePortField(index, portIndex)" size="small">
                      <template #icon><DeleteOutlined /></template>
                    </a-button>
                  </div>
                  <a-button type="dashed" @click="addPortField(index)" style="width: 100%; margin-top: 8px;">
                    <template #icon><PlusOutlined /></template>
                    添加端口
                  </a-button>
                </div>
              </a-form-item>

              <!-- 资源配置 -->
              <a-form-item label="资源配置">
                <a-row :gutter="16">
                  <a-col :span="12">
                    <h5>资源请求</h5>
                    <a-row :gutter="8">
                      <a-col :span="12">
                        <a-input v-model:value="container.resources!.requests.cpu" placeholder="CPU (如 100m)" />
                      </a-col>
                      <a-col :span="12">
                        <a-input v-model:value="container.resources!.requests.memory" placeholder="内存 (如 128Mi)" />
                      </a-col>
                    </a-row>
                  </a-col>
                  <a-col :span="12">
                    <h5>资源限制</h5>
                    <a-row :gutter="8">
                      <a-col :span="12">
                        <a-input v-model:value="container.resources!.limits.cpu" placeholder="CPU (如 500m)" />
                      </a-col>
                      <a-col :span="12">
                        <a-input v-model:value="container.resources!.limits.memory" placeholder="内存 (如 512Mi)" />
                      </a-col>
                    </a-row>
                  </a-col>
                </a-row>
              </a-form-item>
            </div>
            
            <a-button type="dashed" @click="addContainerField" style="width: 100%; margin-top: 16px;">
              <template #icon><PlusOutlined /></template>
              添加容器
            </a-button>
          </div>
        </a-form-item>

        <!-- Pod 配置 -->
        <a-row :gutter="16">
          <a-col :span="8">
            <a-form-item label="重启策略">
              <a-select v-model:value="createFormModel.restart_policy">
                <a-select-option value="Always">Always</a-select-option>
                <a-select-option value="OnFailure">OnFailure</a-select-option>
                <a-select-option value="Never">Never</a-select-option>
              </a-select>
            </a-form-item>
          </a-col>
          <a-col :span="8">
            <a-form-item label="DNS 策略">
              <a-select v-model:value="createFormModel.dns_policy">
                <a-select-option value="ClusterFirst">ClusterFirst</a-select-option>
                <a-select-option value="Default">Default</a-select-option>
                <a-select-option value="None">None</a-select-option>
              </a-select>
            </a-form-item>
          </a-col>
          <a-col :span="8">
            <a-form-item label="服务账户">
              <a-input v-model:value="createFormModel.service_account" placeholder="服务账户名称" />
            </a-form-item>
          </a-col>
        </a-row>

        <a-row :gutter="16">
          <a-col :span="12">
            <a-form-item label="网络配置">
              <a-checkbox v-model:checked="createFormModel.host_network">使用主机网络</a-checkbox>
              <a-checkbox v-model:checked="createFormModel.host_pid" style="margin-left: 16px;">使用主机PID</a-checkbox>
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

    <!-- 通过 YAML 创建 Pod 模态框 -->
    <a-modal
      v-model:open="isCreateYamlModalVisible"
      title="通过 YAML 创建 Pod"
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
            placeholder="请输入 Pod YAML 内容" 
            :rows="20"
            class="yaml-textarea"
          />
        </a-form-item>
      </a-form>
    </a-modal>

    <!-- 详情模态框 -->
    <a-modal
      v-model:open="isDetailModalVisible"
      title="Pod 详情"
      :footer="null"
      @cancel="closeDetailModal"
      width="1200px"
      :maskClosable="false"
      destroyOnClose
    >
      <a-spin :spinning="detailLoading">
        <div v-if="currentPodDetail" class="k8s-detail-content">
          <a-row :gutter="[24, 16]">
            <a-col :xs="24" :lg="12">
              <a-card title="基本信息" class="k8s-detail-card" size="small">
                <div class="k8s-detail-item">
                  <span class="k8s-detail-label">Pod 名称:</span>
                  <span class="k8s-detail-value">{{ currentPodDetail.name }}</span>
                </div>
                <div class="k8s-detail-item">
                  <span class="k8s-detail-label">命名空间:</span>
                  <span class="k8s-detail-value">{{ currentPodDetail.namespace }}</span>
                </div>
                <div class="k8s-detail-item">
                  <span class="k8s-detail-label">状态:</span>
                  <a-badge :status="getStatusColor(currentPodDetail.status)" :text="getStatusText(currentPodDetail.status)" />
                </div>
                <div class="k8s-detail-item">
                  <span class="k8s-detail-label">阶段:</span>
                  <a-tag :color="getStatusColor(currentPodDetail.phase)">{{ getPhaseText(currentPodDetail.phase) }}</a-tag>
                </div>
                <div class="k8s-detail-item">
                  <span class="k8s-detail-label">集群ID:</span>
                  <span class="k8s-detail-value">{{ currentPodDetail.cluster_id }}</span>
                </div>
                <div class="k8s-detail-item">
                  <span class="k8s-detail-label">UID:</span>
                  <span class="k8s-detail-value">{{ currentPodDetail.uid || '-' }}</span>
                </div>
              </a-card>
            </a-col>
            
            <a-col :xs="24" :lg="12">
              <a-card title="运行信息" class="k8s-detail-card" size="small">
                <div class="k8s-detail-item">
                  <span class="k8s-detail-label">节点名称:</span>
                  <span class="k8s-detail-value">{{ currentPodDetail.node_name || '-' }}</span>
                </div>
                <div class="k8s-detail-item">
                  <span class="k8s-detail-label">Pod IP:</span>
                  <code class="k8s-detail-value">{{ currentPodDetail.pod_ip || '-' }}</code>
                </div>
                <div class="k8s-detail-item">
                  <span class="k8s-detail-label">宿主机IP:</span>
                  <code class="k8s-detail-value">{{ currentPodDetail.host_ip || '-' }}</code>
                </div>
                <div class="k8s-detail-item">
                  <span class="k8s-detail-label">QoS等级:</span>
                  <a-tag :color="getQosClassColor(currentPodDetail.qos_class)">{{ currentPodDetail.qos_class || '-' }}</a-tag>
                </div>
                <div class="k8s-detail-item">
                  <span class="k8s-detail-label">重启次数:</span>
                  <a-tag :color="currentPodDetail.restart_count > 0 ? 'warning' : 'success'">{{ currentPodDetail.restart_count || 0 }}</a-tag>
                </div>
                <div class="k8s-detail-item">
                  <span class="k8s-detail-label">就绪状态:</span>
                  <span class="k8s-detail-value">{{ currentPodDetail.ready || '-' }}</span>
                </div>
              </a-card>
            </a-col>
          </a-row>

          <a-row :gutter="[24, 16]" style="margin-top: 16px;">
            <a-col :xs="24" :lg="12">
              <a-card title="配置信息" class="k8s-detail-card" size="small">
                <div class="k8s-detail-item">
                  <span class="k8s-detail-label">服务账户:</span>
                  <span class="k8s-detail-value">{{ currentPodDetail.service_account || '-' }}</span>
                </div>
                <div class="k8s-detail-item">
                  <span class="k8s-detail-label">重启策略:</span>
                  <span class="k8s-detail-value">{{ currentPodDetail.restart_policy || '-' }}</span>
                </div>
                <div class="k8s-detail-item">
                  <span class="k8s-detail-label">DNS策略:</span>
                  <span class="k8s-detail-value">{{ currentPodDetail.dns_policy || '-' }}</span>
                </div>
                <div class="k8s-detail-item">
                  <span class="k8s-detail-label">资源版本:</span>
                  <span class="k8s-detail-value">{{ currentPodDetail.resource_version || '-' }}</span>
                </div>
                <div class="k8s-detail-item">
                  <span class="k8s-detail-label">生成版本号:</span>
                  <span class="k8s-detail-value">{{ currentPodDetail.generation || '-' }}</span>
                </div>
              </a-card>
            </a-col>

            <a-col :xs="24" :lg="12">
              <a-card title="时间信息" class="k8s-detail-card" size="small">
                <div class="k8s-detail-item">
                  <span class="k8s-detail-label">创建时间:</span>
                  <span class="k8s-detail-value">{{ formatTime(currentPodDetail.creation_timestamp) }}</span>
                </div>
                <div class="k8s-detail-item">
                  <span class="k8s-detail-label">启动时间:</span>
                  <span class="k8s-detail-value">{{ formatTime(currentPodDetail.start_time) || '-' }}</span>
                </div>
                <div class="k8s-detail-item">
                  <span class="k8s-detail-label">删除时间:</span>
                  <span class="k8s-detail-value">{{ formatTime(currentPodDetail.deletion_timestamp) || '-' }}</span>
                </div>
              </a-card>
            </a-col>
          </a-row>

          <a-row :gutter="[24, 16]" style="margin-top: 16px;">
            <a-col :xs="24" :lg="12">
              <a-card title="标签信息" class="k8s-detail-card" size="small">
                <div class="k8s-labels-display">
                  <a-tooltip v-for="label in (currentPodDetail.labels || [])" :key="label.key" :title="`${label.key}: ${label.value}`" placement="top">
                    <a-tag class="k8s-label-item" style="margin-bottom: 8px; max-width: 200px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                      {{ label.key }}: {{ label.value }}
                    </a-tag>
                  </a-tooltip>
                  <span v-if="!currentPodDetail.labels || currentPodDetail.labels.length === 0" class="k8s-no-data">
                    暂无标签
                  </span>
                </div>
              </a-card>
            </a-col>

            <a-col :xs="24" :lg="12">
              <a-card title="注解信息" class="k8s-detail-card" size="small">
                <div class="k8s-annotations-display">
                  <a-tooltip v-for="annotation in (currentPodDetail.annotations || [])" :key="annotation.key" :title="`${annotation.key}: ${annotation.value}`" placement="top">
                    <a-tag class="k8s-annotation-item" style="margin-bottom: 8px; max-width: 200px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                      {{ annotation.key }}: {{ annotation.value }}
                    </a-tag>
                  </a-tooltip>
                  <span v-if="!currentPodDetail.annotations || currentPodDetail.annotations.length === 0" class="k8s-no-data">
                    暂无注解
                  </span>
                </div>
              </a-card>
            </a-col>
          </a-row>

          <!-- 容器信息 -->
          <a-row :gutter="[24, 16]" style="margin-top: 16px;">
            <a-col :span="24">
              <a-card title="容器信息" class="k8s-detail-card" size="small">
                <a-table
                  :data-source="currentPodDetail.containers || []"
                  :pagination="false"
                  size="small"
                  class="k8s-table"
                >
                  <a-table-column title="容器名称" dataIndex="name" key="name" />
                  <a-table-column title="镜像" dataIndex="image" key="image" />
                  <a-table-column title="状态" dataIndex="ready" key="ready">
                    <template #default="{ text }">
                      <a-tag :color="text ? 'success' : 'error'">{{ text ? '就绪' : '未就绪' }}</a-tag>
                    </template>
                  </a-table-column>
                  <a-table-column title="重启次数" dataIndex="restart_count" key="restart_count" />
                </a-table>
              </a-card>
            </a-col>
          </a-row>
        </div>
      </a-spin>
    </a-modal>

    <!-- YAML 模态框 -->
    <a-modal
      v-model:open="isYamlModalVisible"
      :title="`查看/编辑 ${currentOperationPod?.name} YAML`"
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

    <!-- 编辑 Pod 模态框 -->
    <a-modal
      v-model:open="isEditModalVisible"
      title="编辑 Pod"
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
        ref="formRef"
        :model="editFormModel" 
        layout="vertical" 
        class="k8s-form"
      >
        <a-alert
          message="编辑提示"
          description="Pod 创建后只能编辑标签和注解信息，其他配置需要重新创建 Pod。"
          type="info"
          show-icon
          style="margin-bottom: 24px;"
        />

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

    <!-- 日志查看模态框 -->
    <a-modal
      v-model:open="isLogsModalVisible"
      :title="`${currentOperationPod?.name} 日志`"
      :footer="null"
      @cancel="closeLogsModal"
      width="1000px"
      :maskClosable="false"
      destroyOnClose
    >
      <div class="pod-logs-content">
        <div class="logs-controls">
          <a-row :gutter="16" style="margin-bottom: 16px;">
            <a-col :span="6">
              <a-select v-model:value="logsFormModel.container" placeholder="选择容器">
                <a-select-option v-for="container in podContainers" :key="container.name" :value="container.name">
                  {{ container.name }}
                </a-select-option>
              </a-select>
            </a-col>
            <a-col :span="4">
              <a-input-number v-model:value="logsFormModel.tail_lines" placeholder="行数" :min="1" :max="10000" />
            </a-col>
            <a-col :span="6">
              <a-checkbox v-model:checked="logsFormModel.timestamps">显示时间戳</a-checkbox>
              <a-checkbox v-model:checked="logsFormModel.previous" style="margin-left: 16px;">前一个容器</a-checkbox>
            </a-col>
            <a-col :span="14">
              <!-- 实时流按钮 -->
              <a-button 
                v-if="!isLogsStreaming" 
                type="primary" 
                @click="fetchPodLogs" 
                :loading="logsLoading" 
                :disabled="!logsFormModel.container"
              >
                <template #icon><PlayCircleOutlined /></template>
                开始实时流
              </a-button>
              <a-button 
                v-else 
                type="primary" 
                danger 
                @click="stopLogsStream"
              >
                <template #icon><PauseCircleOutlined /></template>
                停止实时流
              </a-button>
              
              <a-button @click="podLogs = ''" style="margin-left: 8px;">
                <template #icon><ClearOutlined /></template>
                清空
              </a-button>
            </a-col>
          </a-row>
        </div>
        
        <!-- 连接状态栏 -->
        <div class="logs-status-bar">
          <a-row justify="space-between" align="middle">
            <a-col>
              <a-space>
                <a-badge 
                  :status="isLogsStreaming ? 'processing' : 'default'" 
                  :text="isLogsStreaming ? '实时连接中' : '未连接'"
                />
                <span v-if="isLogsStreaming" class="streaming-indicator">
                  <ReloadOutlined spin /> 正在监听日志...
                </span>
              </a-space>
            </a-col>
            <a-col>
              <span class="logs-count">
                日志行数: {{ podLogs.split('\n').filter(line => line.trim()).length }}
              </span>
            </a-col>
          </a-row>
        </div>
        
        <div class="logs-display">
          <pre 
            class="logs-content" 
            :class="{ 'streaming-logs': isLogsStreaming }"
            v-show="podLogs || isLogsStreaming"
          >{{ podLogs || '正在连接...' }}</pre>
          
          <!-- 空状态提示 -->
          <div v-show="!podLogs && !isLogsStreaming" class="logs-empty-state">
            <div class="empty-icon">📄</div>
            <div class="empty-text">
              <p>暂无日志数据</p>
              <p>请选择容器并点击"开始实时流"按钮</p>
            </div>
          </div>
        </div>
      </div>
    </a-modal>

    <!-- 执行命令模态框 - 终端版本 -->
    <a-modal
      v-model:open="isExecModalVisible"
      title="Pod 终端"
      @cancel="closeExecModal"
      width="1200px"
      :maskClosable="false"
      destroyOnClose
      :footer="null"
      class="terminal-modal"
    >
      <div class="terminal-container">
        <!-- 连接配置区域 -->
        <div class="terminal-config" v-if="!isTerminalConnected">
          <a-form 
            ref="execFormRef"
            :model="execFormModel" 
            layout="inline" 
            class="k8s-form"
            :rules="execFormRules"
          >
            <a-form-item label="容器" name="container" :required="true">
              <a-select v-model:value="execFormModel.container" placeholder="选择容器" style="width: 200px;">
                <a-select-option v-for="container in podContainers" :key="container.name" :value="container.name">
                  {{ container.name }}
                </a-select-option>
              </a-select>
            </a-form-item>
            <a-form-item label="Shell" name="shell">
              <a-select v-model:value="execFormModel.shell" style="width: 150px;">
                <a-select-option value="/bin/bash">/bin/bash</a-select-option>
                <a-select-option value="/bin/sh">/bin/sh</a-select-option>
                <a-select-option value="/bin/zsh">/bin/zsh</a-select-option>
              </a-select>
            </a-form-item>
            <a-form-item>
              <a-button 
                type="primary" 
                @click="connectToTerminal" 
                :loading="terminalLoading"
                :disabled="!execFormModel.container"
              >
                <template #icon><PlayCircleOutlined /></template>
                连接终端
              </a-button>
            </a-form-item>
          </a-form>
        </div>

        <!-- 连接状态栏 -->
        <div class="terminal-status-bar" v-if="isTerminalConnected || terminalLoading">
          <a-row justify="space-between" align="middle">
            <a-col>
              <a-space>
                <a-badge 
                  :status="isTerminalConnected ? 'processing' : terminalLoading ? 'default' : 'error'" 
                  :text="isTerminalConnected ? '已连接' : terminalLoading ? '连接中...' : '未连接'"
                />
                <span v-if="isTerminalConnected" class="connection-info">
                  <CodeOutlined /> {{ execFormModel.container }} ({{ execFormModel.shell }})
                </span>
                <span v-if="terminalLoading" class="connecting-indicator">
                  <ReloadOutlined spin /> 正在建立连接...
                </span>
              </a-space>
            </a-col>
            <a-col>
              <a-space>
                <a-button 
                  v-if="isTerminalConnected" 
                  type="text" 
                  size="small" 
                  @click="disconnectTerminal"
                  danger
                >
                  <template #icon><DisconnectOutlined /></template>
                  断开连接
                </a-button>
                <a-tooltip title="终端支持完整的Shell交互，包括vi/nano编辑器、tab补全等">
                  <a-button type="text" size="small">
                    <template #icon><QuestionCircleOutlined /></template>
                  </a-button>
                </a-tooltip>
              </a-space>
            </a-col>
          </a-row>
        </div>

        <!-- 终端显示区域 -->
        <div class="terminal-display">
          <div 
            id="terminal-container" 
            class="terminal-wrapper"
            v-show="isTerminalConnected || terminalLoading"
          ></div>
          
          <!-- 未连接状态提示 -->
          <div v-show="!isTerminalConnected && !terminalLoading" class="terminal-empty-state">
            <div class="empty-icon">🖥️</div>
            <div class="empty-text">
              <p>Pod 终端未连接</p>
              <p>请选择容器和Shell类型，然后点击"连接终端"按钮</p>
            </div>
          </div>

          <!-- 连接中状态 -->
          <div v-show="terminalLoading" class="terminal-loading-state">
            <div class="loading-icon">
              <a-spin size="large" />
            </div>
            <div class="loading-text">
              <p>正在连接到 Pod 终端...</p>
              <p>容器: {{ execFormModel.container }}</p>
            </div>
          </div>
        </div>
      </div>
    </a-modal>

    <!-- 端口转发模态框 -->
    <a-modal
      v-model:open="isPortForwardModalVisible"
      title="端口转发"
      @ok="submitPortForward"
      @cancel="closePortForwardModal"
      :confirmLoading="submitLoading"
      width="600px"
      :maskClosable="false"
      destroyOnClose
      okText="设置转发"
      cancelText="取消"
    >
      <div class="port-forward-config">
        <div v-for="(port, index) in portForwardFormModel.ports" :key="index" class="port-forward-row">
          <a-input-number v-model:value="port.local_port" placeholder="本地端口" :min="1" :max="65535" style="width: 40%;" />
          <span style="margin: 0 16px;">→</span>
          <a-input-number v-model:value="port.remote_port" placeholder="容器端口" :min="1" :max="65535" style="width: 40%;" />
          <a-button type="text" danger @click="removePortForwardField(index)" :disabled="portForwardFormModel.ports.length <= 1" size="small">
            <template #icon><DeleteOutlined /></template>
          </a-button>
        </div>
        <a-button type="dashed" @click="addPortForwardField" style="width: 100%; margin-top: 16px;">
          <template #icon><PlusOutlined /></template>
          添加端口转发
        </a-button>
      </div>
    </a-modal>

    <!-- 文件管理模态框 -->
    <a-modal
      v-model:open="isFileManagerModalVisible"
      title="文件管理"
      :footer="null"
      @cancel="handleCloseFileManagerModal"
      width="900px"
      :maskClosable="false"
      destroyOnClose
    >
      <div class="file-manager-content">
        <a-alert
          message="文件管理功能"
          description="此功能需要在 Pod 运行状态下使用，支持文件上传和下载操作。"
          type="info"
          show-icon
          style="margin-bottom: 16px;"
        />
        
        <!-- 容器选择 -->
        <div class="file-manager-container-selection" style="margin-bottom: 24px;">
          <h4 style="margin-bottom: 12px;">选择容器</h4>
          <a-select 
            v-model:value="fileManagerContainer" 
            placeholder="请选择容器"
            style="width: 100%;"
            :disabled="!podContainers || podContainers.length === 0"
            @change="handleContainerChange"
          >
            <a-select-option v-for="container in podContainers" :key="container.name" :value="container.name">
              <div style="display: flex; align-items: center; justify-content: space-between;">
                <span>{{ container.name }}</span>
                <a-tag :color="container.ready ? 'success' : 'error'" size="small">
                  {{ container.ready ? '就绪' : '未就绪' }}
                </a-tag>
              </div>
            </a-select-option>
          </a-select>
        </div>

        <!-- 文件上传区域 -->
        <div class="file-upload-section" v-if="fileManagerContainer">
          <h4 style="margin-bottom: 12px;">文件上传</h4>
          
          <a-form layout="vertical" style="margin-bottom: 16px;">
            <a-form-item label="目标路径" required>
              <a-input 
                v-model:value="uploadFilePath" 
                placeholder="请输入文件上传的目标路径，如：/tmp 或 /app/data"
                :maxlength="500"
              />
              <div style="color: #999; font-size: 12px; margin-top: 4px;">
                文件将上传到容器中的此路径下，请确保路径存在且有写入权限
              </div>
            </a-form-item>
          </a-form>

          <!-- 文件上传组件 -->
          <a-upload-dragger
            :file-list="fileList"
            :before-upload="beforeUpload"
            :remove="handleRemoveFile"
            :multiple="true"
            :disabled="!uploadFilePath || !fileManagerContainer || uploadLoading"
            style="margin-bottom: 16px;"
          >
            <p class="ant-upload-drag-icon">
              <UploadOutlined style="font-size: 48px; color: #1890ff;" />
            </p>
            <p class="ant-upload-text">点击或拖拽文件到此区域上传</p>
            <p class="ant-upload-hint">
              支持单个或批量上传。请确保目标路径存在且容器有写入权限。
            </p>
          </a-upload-dragger>

          <!-- 上传按钮 -->
          <div style="text-align: center; margin-bottom: 24px;">
            <a-button 
              type="primary" 
              size="large"
              :loading="uploadLoading"
              :disabled="fileList.length === 0 || !uploadFilePath || !fileManagerContainer"
              @click="handleUploadFiles"
            >
              <template #icon><UploadOutlined /></template>
              上传文件 ({{ fileList.length }})
            </a-button>
            <a-button 
              style="margin-left: 8px;"
              @click="clearFileList"
              :disabled="fileList.length === 0 || uploadLoading"
            >
              <template #icon><ClearOutlined /></template>
              清空列表
            </a-button>
          </div>

          <!-- 上传进度 -->
          <div v-if="uploadProgress.show" class="upload-progress" style="margin-bottom: 16px;">
            <div style="margin-bottom: 8px;">
              <span>上传进度: {{ uploadProgress.current }}/{{ uploadProgress.total }}</span>
            </div>
            <a-progress 
              :percent="uploadProgress.percent" 
              :status="uploadProgress.status"
              :show-info="true"
            />
            <div v-if="uploadProgress.currentFile" style="color: #666; font-size: 12px; margin-top: 4px;">
              正在上传: {{ uploadProgress.currentFile }}
            </div>
          </div>
        </div>

        <!-- 文件下载区域 -->
        <div class="file-download-section" v-if="fileManagerContainer">
          <a-divider />
          <h4 style="margin-bottom: 12px;">文件下载</h4>
          
          <a-form layout="inline" style="margin-bottom: 16px;">
            <a-form-item label="文件路径">
              <a-input 
                v-model:value="downloadFilePath" 
                placeholder="请输入要下载的文件完整路径，如：/tmp/file.txt"
                style="width: 400px;"
                :maxlength="500"
              />
            </a-form-item>
            <a-form-item>
              <a-button 
                type="primary"
                :loading="downloadLoading"
                :disabled="!downloadFilePath || !fileManagerContainer"
                @click="handleDownloadFile"
              >
                <template #icon><DownloadOutlined /></template>
                下载文件
              </a-button>
            </a-form-item>
          </a-form>
          
          <div style="color: #999; font-size: 12px;">
            请输入容器中文件的完整路径。下载的文件将保存到您的下载文件夹中。
          </div>
        </div>

        <!-- 无容器提示 -->
        <div v-if="!fileManagerContainer" class="no-container-selected" style="text-align: center; padding: 40px; color: #999;">
          <div style="font-size: 48px; margin-bottom: 16px;">📁</div>
          <p>请先选择一个容器来进行文件管理操作</p>
        </div>
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
import { onMounted, onBeforeUnmount, ref, watch } from 'vue';
import { message } from 'ant-design-vue';
import { usePodPage } from './Pod';
import { 
  PlusOutlined, 
  ReloadOutlined, 
  FilterOutlined, 
  DeleteOutlined, 
  ContainerOutlined,
  AppstoreOutlined,
  EyeOutlined,
  TagsOutlined,
  SearchOutlined,
  FileTextOutlined,
  EditOutlined,
  FileSearchOutlined,
  CodeOutlined,
  LinkOutlined,
  FolderOutlined,
  DatabaseOutlined,
  ApiOutlined,
  ClearOutlined,
  PlayCircleOutlined,
  PauseCircleOutlined,
  DisconnectOutlined,
  QuestionCircleOutlined,
  UploadOutlined,
  DownloadOutlined,
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
  filterPhase,
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
  isLogsModalVisible,
  isExecModalVisible,
  isPortForwardModalVisible,
  isFileManagerModalVisible,
  submitLoading,
  detailLoading,
  logsLoading,
  isLogsStreaming,
  
  // 终端状态
  isTerminalConnected,
  terminalLoading,
  
  // operation targets
  currentOperationPod,
  currentPodDetail,
  podLogs,
  podContainers,
  
  // form models
  createFormModel,
  editFormModel,
  yamlFormModel,
  createYamlFormModel,
  logsFormModel,
  execFormModel,
  portForwardFormModel,
  
  // form refs
  formRef,
  yamlFormRef,
  createYamlFormRef,
  execFormRef,
  
  // form rules
  createFormRules,
  yamlFormRules,
  createYamlFormRules,
  execFormRules,
  
  // computed
  filteredPods,
  rowSelection,
  
  // helpers
  getEnvText,
  getStatusText,
  getStatusColor,
  getPhaseText,
  
  // operations
  fetchClusters,
  fetchNamespaces,
  fetchPods,
  clearPods,
  clearNamespaces,
  loadMoreClusters,
  loadMoreNamespaces,
  
  // detail operations
  showPodDetail,
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
  
  // pod operations
  deletePod,
  
  // logs operations
  showLogsModal,
  closeLogsModal,
  fetchPodLogs,
  stopLogsStream,
  
  // exec operations
  showExecModal,
  closeExecModal,
  connectToTerminal,
  disconnectTerminal,
  
  // port forward operations
  showPortForwardModal,
  closePortForwardModal,
  submitPortForward,
  
  // file operations
  showFileManagerModal,
  closeFileManagerModal,
  uploadFile,
  downloadFile,
  
  // filter operations
  addFilterLabel,
  removeFilterLabel,
  clearFilterLabels,
  
  // batch operations
  batchOperation,
  
  // pagination operations
  handlePageChange,
  
  // form field operations
  addContainerField,
  removeContainerField,
  addEnvField,
  removeEnvField,
  addPortField,
  removePortField,
  addPortForwardField,
  removePortForwardField,
  removeLabelField,
  removeAnnotationField,
  
  // constants
  K8sPodStatus,
  K8sPodPhase,
} = usePodPage();

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

const removeEditLabelField = (key: string) => {
  delete editFormModel.value.labels[key];
};

const removeEditAnnotationField = (key: string) => {
  delete editFormModel.value.annotations[key];
};

// 计算Pod就绪百分比
const calculateReadyPercent = (ready: string) => {
  if (!ready || !ready.includes('/')) return 0;
  const [readyCount, totalCount] = ready.split('/').map(Number);
  return totalCount && totalCount > 0 ? Math.round((readyCount || 0) / totalCount * 100) : 0;
};

// 检查Pod是否完全就绪
const isFullyReady = (ready: string) => {
  if (!ready || !ready.includes('/')) return false;
  const [readyCount, totalCount] = ready.split('/').map(Number);
  return readyCount === totalCount;
};

// 获取QoS等级颜色
const getQosClassColor = (qosClass: string) => {
  const map: Record<string, string> = {
    'Guaranteed': 'green',
    'Burstable': 'orange', 
    'BestEffort': 'blue',
  };
  return map[qosClass] || 'default';
};

// 格式化时间
const formatTime = (timeStr?: string) => {
  if (!timeStr) return '-';
  try {
    return new Date(timeStr).toLocaleString('zh-CN');
  } catch {
    return timeStr;
  }
};

const onSearch = () => {
  currentPage.value = 1;
  fetchPods();
};

const handleFilterChange = () => {
  currentPage.value = 1;
  fetchPods();
};

const handleClusterChange = () => {
  currentPage.value = 1;
  clearNamespaces();
  clearPods();
  
  if (filterClusterId.value) {
    const selectedCluster = clusters.value.find(c => c.id === filterClusterId.value);
    if (selectedCluster) {
      message.info(`已切换到集群: ${selectedCluster.name}`);
    }
    fetchNamespaces(true); // 重置命名空间分页
    fetchPods();
  } else {
    message.info('已清空 Pod 列表，请选择集群查看 Pod');
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
  { title: '阶段', dataIndex: 'phase', key: 'phase', width: '8%', slots: { customRender: 'phase' } },
  { title: '就绪', dataIndex: 'ready', key: 'ready', width: '8%', slots: { customRender: 'ready' } },
  { title: '重启', dataIndex: 'restart_count', key: 'restart_count', width: '6%', slots: { customRender: 'restarts' } },
  { title: '节点', dataIndex: 'node_name', key: 'node_name', width: '10%', slots: { customRender: 'node_name' } },
  { title: 'Pod IP', dataIndex: 'pod_ip', key: 'pod_ip', width: '10%', slots: { customRender: 'pod_ip' } },
  { title: 'QoS等级', dataIndex: 'qos_class', key: 'qos_class', width: '8%', slots: { customRender: 'qos_class' } },
  { title: '标签', dataIndex: 'labels', key: 'labels', width: '10%', slots: { customRender: 'labels' } },
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
  filterPhase.value = undefined;
  searchText.value = '';
  filterClusterId.value = undefined;
  filterNamespace.value = undefined;
  clearFilterLabels();
  currentPage.value = 1;
  clearPods();
  clearNamespaces();
  message.success('已重置所有筛选条件');
};

onMounted(async () => {
  await fetchClusters();
});

// 组件卸载时清理SSE连接
onBeforeUnmount(() => {
  stopLogsStream();
});

// 监听容器变化，自动停止之前的流
watch(
  () => logsFormModel.value.container,
  (newContainer, oldContainer) => {
    if (newContainer !== oldContainer && isLogsStreaming.value) {
      stopLogsStream();
      message.info('已切换容器，请重新启动实时流');
    }
  }
);

// 文件管理相关状态
const fileManagerContainer = ref<string>('');
const uploadFilePath = ref<string>('/tmp');
const downloadFilePath = ref<string>('');
const fileList = ref<any[]>([]);
const uploadLoading = ref(false);
const downloadLoading = ref(false);
const uploadProgress = ref({
  show: false,
  current: 0,
  total: 0,
  percent: 0,
  status: 'active' as 'active' | 'success' | 'exception',
  currentFile: ''
});

// 文件管理相关方法
const handleContainerChange = (containerName: string) => {
  fileManagerContainer.value = containerName;
  // 重置文件列表和路径
  fileList.value = [];
  uploadFilePath.value = '/tmp';
  downloadFilePath.value = '';
};

const beforeUpload = (file: File) => {
  // 检查文件大小 (限制为100MB)
  const isLt100M = file.size / 1024 / 1024 < 100;
  if (!isLt100M) {
    message.error('文件大小不能超过 100MB!');
    return false;
  }
  
  // 添加到文件列表
  fileList.value.push({
    uid: file.name + Date.now(),
    name: file.name,
    status: 'done',
    originFileObj: file
  });
  
  return false; // 阻止自动上传
};

const handleRemoveFile = (file: any) => {
  const index = fileList.value.findIndex(item => item.uid === file.uid);
  if (index > -1) {
    fileList.value.splice(index, 1);
  }
};

const clearFileList = () => {
  fileList.value = [];
};

const handleUploadFiles = async () => {
  if (fileList.value.length === 0 || !uploadFilePath.value || !fileManagerContainer.value) {
    message.warning('请选择文件和目标路径');
    return;
  }

  uploadLoading.value = true;
  uploadProgress.value = {
    show: true,
    current: 0,
    total: fileList.value.length,
    percent: 0,
    status: 'active',
    currentFile: ''
  };

  try {
    for (let i = 0; i < fileList.value.length; i++) {
      const fileItem = fileList.value[i];
      const file = fileItem.originFileObj;
      
      uploadProgress.value.current = i + 1;
      uploadProgress.value.currentFile = file.name;
      uploadProgress.value.percent = Math.round((i / fileList.value.length) * 100);
      
      await uploadFile(file, uploadFilePath.value, fileManagerContainer.value);
    }
    
    uploadProgress.value.percent = 100;
    uploadProgress.value.status = 'success';
    uploadProgress.value.currentFile = '';
    
    message.success(`成功上传 ${fileList.value.length} 个文件`);
    
    // 清空文件列表
    setTimeout(() => {
      fileList.value = [];
      uploadProgress.value.show = false;
    }, 2000);
    
  } catch (error) {
    uploadProgress.value.status = 'exception';
    message.error('文件上传失败');
    console.error('Upload error:', error);
  } finally {
    uploadLoading.value = false;
  }
};

const handleDownloadFile = async () => {
  if (!downloadFilePath.value || !fileManagerContainer.value) {
    message.warning('请输入文件路径和选择容器');
    return;
  }

  if (!downloadFilePath.value.trim()) {
    message.warning('请输入有效的文件路径');
    return;
  }

  downloadLoading.value = true;
  try {
    
    await downloadFile(downloadFilePath.value.trim(), fileManagerContainer.value);
  } catch (error) {
    console.error('Download error:', error);
    // 错误已经在downloadFile函数中处理，这里不需要额外的错误消息
  } finally {
    downloadLoading.value = false;
  }
};

// 重写文件管理模态框关闭方法，添加状态清理
const handleCloseFileManagerModal = () => {
  // 清理文件管理状态
  fileManagerContainer.value = '';
  uploadFilePath.value = '/tmp';
  downloadFilePath.value = '';
  fileList.value = [];
  uploadLoading.value = false;
  downloadLoading.value = false;
  uploadProgress.value = {
    show: false,
    current: 0,
    total: 0,
    percent: 0,
    status: 'active',
    currentFile: ''
  };
  
  // 调用原始的关闭方法
  closeFileManagerModal();
};

</script>

<style scoped>
@import '../shared/k8s-common.css';
</style>

<style scoped src="./Pod.css"></style>
