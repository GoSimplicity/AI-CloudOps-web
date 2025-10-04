<template>
  <div class="k8s-management-container">
    <!-- 页面头部 -->
    <div class="k8s-page-header">
      <a-row class="k8s-header-content" :gutter="[24, 16]">
        <a-col :xs="24" :sm="24" :md="16" :lg="16" :xl="18">
          <div class="k8s-title-section">
            <div class="k8s-page-title">
              <ClockCircleOutlined class="k8s-title-icon" />
              <div>
                <h1>定时任务管理</h1>
                <p class="k8s-page-subtitle">管理和监控系统中的所有定时任务</p>
              </div>
            </div>
          </div>
        </a-col>
        <a-col :xs="24" :sm="24" :md="8" :lg="8" :xl="6">
          <div class="k8s-header-actions">
            <!-- 操作按钮 -->
            <a-button type="primary" @click="openCreateModal">
              <template #icon><PlusOutlined /></template>
              创建任务
            </a-button>
            <a-button @click="fetchCronJobs" :loading="loading">
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
            v-model:value="filterStatus" 
            placeholder="状态筛选" 
            class="k8s-filter-select" 
            allow-clear 
            @change="handleFilterChange"
          >
            <template #suffixIcon><FilterOutlined /></template>
            <a-select-option :value="CronJobStatus.ENABLED">🟢 已启用</a-select-option>
            <a-select-option :value="CronJobStatus.DISABLED">🔴 已禁用</a-select-option>
            <a-select-option :value="CronJobStatus.RUNNING">🔄 运行中</a-select-option>
            <a-select-option :value="CronJobStatus.ERROR">❌ 异常</a-select-option>
          </a-select>

          <a-select 
            v-model:value="filterJobType" 
            placeholder="任务类型" 
            class="k8s-filter-select" 
            allow-clear 
            @change="handleFilterChange"
          >
            <template #suffixIcon><FilterOutlined /></template>
            <a-select-option :value="CronJobType.SYSTEM">⚙️ 系统任务</a-select-option>
            <a-select-option :value="CronJobType.COMMAND">💻 命令行</a-select-option>
            <a-select-option :value="CronJobType.HTTP">🌐 HTTP请求</a-select-option>
            <a-select-option :value="CronJobType.SCRIPT">📝 脚本任务</a-select-option>
            <a-select-option :value="CronJobType.SSH">🔗 SSH远程</a-select-option>
          </a-select>
        </div>

        <div class="k8s-search-group">
          <a-input
            v-model:value="searchText"
            placeholder="搜索任务名称或描述..."
            class="k8s-search-input"
            @keyup.enter="onSearch"
            allow-clear
          >
            <template #prefix><SearchOutlined /></template>
          </a-input>
        </div>
      </div>

      <!-- 操作按钮 -->
      <div class="k8s-toolbar-actions">
        <a-button 
          @click="resetFilters" 
          :disabled="!filterStatus && !filterJobType && !searchText"
          class="k8s-toolbar-btn"
          title="重置所有筛选条件"
        >
          <template #icon><DeleteOutlined /></template>
          重置筛选
        </a-button>
        
        <a-button 
          type="primary" 
          danger 
          @click="batchOperation('删除')" 
          :disabled="!selectedRows.length" 
          v-if="selectedRows.length > 0"
          class="k8s-toolbar-btn"
          title="批量删除选中的任务"
        >
          <template #icon><DeleteOutlined /></template>
          删除 ({{ selectedRows.length }})
        </a-button>
        
        <a-button 
          @click="batchOperation('启用')" 
          :disabled="!selectedRows.length" 
          v-if="selectedRows.length > 0"
          class="k8s-toolbar-btn"
          title="批量启用选中的任务"
        >
          <template #icon><PlayCircleOutlined /></template>
          启用 ({{ selectedRows.length }})
        </a-button>
        
        <a-button 
          @click="batchOperation('禁用')" 
          :disabled="!selectedRows.length" 
          v-if="selectedRows.length > 0"
          class="k8s-toolbar-btn"
          title="批量禁用选中的任务"
        >
          <template #icon><PauseCircleOutlined /></template>
          禁用 ({{ selectedRows.length }})
        </a-button>
      </div>
    </div>

    <!-- 内容区域 -->
    <div class="k8s-data-display">
      <!-- 任务表格 -->
      <a-table
        :columns="columns"
        :data-source="filteredCronJobs"
        :row-selection="rowSelection"
        :loading="loading"
        row-key="id"
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
        class="k8s-table"
        :scroll="{ x: 1500 }"
      >
        <template #status="{ text }">
          <a-badge :status="getStatusColor(text)" :text="getStatusText(text)" />
        </template>

        <template #job_type="{ text }">
          <a-tag :color="getJobTypeColor(text)">{{ getJobTypeText(text) }}</a-tag>
        </template>

        <template #next_run_time="{ text }">
          <span v-if="text">{{ formatDateTime(text) }}</span>
          <span v-else class="k8s-no-data">暂无</span>
        </template>

        <template #last_run_time="{ text }">
          <span v-if="text">{{ formatDateTime(text) }}</span>
          <span v-else class="k8s-no-data">暂无</span>
        </template>

        <template #last_run_status="{ text, record }">
          <a-badge 
            :status="getLastRunStatusColor(text)" 
            :text="getLastRunStatusText(text)"
            v-if="record.last_run_time"
          />
          <span v-else class="k8s-no-data">暂无</span>
        </template>

        <template #action="{ record }">
          <div class="k8s-action-column">
            <a-tooltip title="查看详情">
              <a-button type="text" size="small" @click="showJobDetail(record)">
                <template #icon><EyeOutlined /></template>
              </a-button>
            </a-tooltip>

            <a-tooltip title="编辑任务">
              <a-button type="text" size="small" @click="openEditModal(record)">
                <template #icon><EditOutlined /></template>
              </a-button>
            </a-tooltip>

            <a-tooltip :title="record.status === CronJobStatus.ENABLED ? '禁用任务' : '启用任务'">
              <a-button 
                type="text" 
                size="small" 
                @click="record.status === CronJobStatus.ENABLED ? disableJob(record) : enableJob(record)"
              >
                <template #icon>
                  <PauseCircleOutlined v-if="record.status === CronJobStatus.ENABLED" />
                  <PlayCircleOutlined v-else />
                </template>
              </a-button>
            </a-tooltip>

            <a-tooltip title="立即执行">
              <a-button 
                type="text" 
                size="small" 
                @click="triggerJob(record)"
                :disabled="record.status === CronJobStatus.DISABLED"
              >
                <template #icon><PlaySquareOutlined /></template>
              </a-button>
            </a-tooltip>

            <a-tooltip title="删除任务">
              <a-button 
                type="text" 
                size="small" 
                danger 
                @click="deleteJob(record)"
                :disabled="record.is_built_in === 1"
              >
                <template #icon><DeleteOutlined /></template>
              </a-button>
            </a-tooltip>
          </div>
        </template>
      </a-table>
    </div>

    <!-- 错误提示 -->
    <a-alert
      v-if="error"
      :message="error"
      type="error"
      show-icon
      closable
      @close="error = null"
      class="k8s-error-alert"
    >
      <template #action>
        <a-button size="small" type="primary" @click="fetchCronJobs()">
          重新加载
        </a-button>
      </template>
    </a-alert>

    <!-- 创建任务模态框 -->
    <a-modal
      v-model:open="isCreateModalVisible"
      title="创建定时任务"
      :width="800"
      :confirm-loading="submitLoading"
      @ok="submitCreateForm"
      @cancel="closeCreateModal"
      ok-text="创建任务"
      cancel-text="取消"
      destroy-on-close
    >
      <a-form
        ref="formRef"
        :model="createFormModel"
        :rules="createFormRules"
        :label-col="{ span: 6 }"
        :wrapper-col="{ span: 18 }"
        class="k8s-form"
      >
        <a-form-item label="任务名称" name="name" has-feedback>
          <a-input v-model:value="createFormModel.name" placeholder="请输入任务名称" maxlength="100" />
        </a-form-item>

        <a-form-item label="任务描述" name="description">
          <a-textarea 
            v-model:value="createFormModel.description" 
            placeholder="请输入任务描述" 
            :rows="3" 
            maxlength="500"
            show-count 
          />
        </a-form-item>

        <a-form-item label="任务类型" name="job_type" has-feedback>
          <a-select v-model:value="createFormModel.job_type" placeholder="请选择任务类型" @change="handleJobTypeChange">
            <a-select-option :value="CronJobType.COMMAND">命令行</a-select-option>
            <a-select-option :value="CronJobType.HTTP">HTTP请求</a-select-option>
            <a-select-option :value="CronJobType.SCRIPT">脚本任务</a-select-option>
            <a-select-option :value="CronJobType.SSH">SSH远程</a-select-option>
          </a-select>
        </a-form-item>

        <a-form-item label="调度表达式" name="schedule" has-feedback>
          <a-input 
            v-model:value="createFormModel.schedule" 
            placeholder="例：0 0 * * * (每天午夜执行)"
            maxlength="100"
          >
            <template #addonAfter>
              <a-button type="link" @click="validateScheduleExpression" size="small">
                验证
              </a-button>
            </template>
          </a-input>
          <div class="cron-schedule-tip">
            <small>格式：秒 分 时 日 月 周，例如：0 0 * * * 表示每天午夜执行</small>
          </div>
        </a-form-item>

        <!-- 命令行任务配置 -->
        <template v-if="createFormModel.job_type === CronJobType.COMMAND">
          <a-form-item label="执行命令" name="command" has-feedback>
            <a-textarea 
              v-model:value="createFormModel.command" 
              placeholder="请输入要执行的命令" 
              :rows="3"
              maxlength="1000"
            />
          </a-form-item>

          <a-form-item label="命令参数" name="args">
            <div class="k8s-key-value-inputs">
              <div 
                v-for="(_, index) in createFormModel.args || []" 
                :key="index"
                class="k8s-key-value-row"
              >
                <a-input 
                  v-model:value="createFormModel.args![index]" 
                  placeholder="输入参数" 
                  class="k8s-form-input"
                  style="flex: 1; margin-right: 8px;"
                />
                <a-button 
                  @click="removeArg(index)" 
                  type="primary" 
                  danger
                  size="small"
                >
                  删除
                </a-button>
              </div>
              <a-button 
                @click="addArg" 
                type="dashed" 
                style="width: 100%; margin-top: 8px;"
              >
                <template #icon><PlusOutlined /></template>
                添加参数
              </a-button>
            </div>
          </a-form-item>

          <a-form-item label="工作目录" name="work_dir">
            <a-input 
              v-model:value="createFormModel.work_dir" 
              placeholder="命令执行的工作目录，留空使用默认目录" 
              maxlength="255"
            />
          </a-form-item>

          <a-form-item label="环境变量" name="environment">
            <div class="k8s-key-value-inputs">
              <div 
                v-for="(env, index) in createFormModel.environment || []" 
                :key="index"
                class="k8s-key-value-row"
              >
                <a-input 
                  v-model:value="env.key" 
                  placeholder="变量名" 
                  class="k8s-form-input"
                />
                <a-input 
                  v-model:value="env.value" 
                  placeholder="变量值" 
                  class="k8s-form-input"
                />
                <a-button 
                  @click="removeEnvironment(index)" 
                  type="primary" 
                  danger
                  size="small"
                >
                  删除
                </a-button>
              </div>
              <a-button 
                @click="addEnvironment" 
                type="dashed" 
                style="width: 100%; margin-top: 8px;"
              >
                <template #icon><PlusOutlined /></template>
                添加环境变量
              </a-button>
            </div>
          </a-form-item>
        </template>

        <!-- HTTP 请求任务配置 -->
        <template v-if="createFormModel.job_type === CronJobType.HTTP">
          <a-form-item label="请求方法" name="http_method" has-feedback>
            <a-select v-model:value="createFormModel.http_method" placeholder="请选择HTTP方法">
              <a-select-option value="GET">GET</a-select-option>
              <a-select-option value="POST">POST</a-select-option>
              <a-select-option value="PUT">PUT</a-select-option>
              <a-select-option value="DELETE">DELETE</a-select-option>
              <a-select-option value="PATCH">PATCH</a-select-option>
              <a-select-option value="HEAD">HEAD</a-select-option>
            </a-select>
          </a-form-item>

          <a-form-item label="请求URL" name="http_url" has-feedback>
            <a-input 
              v-model:value="createFormModel.http_url" 
              placeholder="https://example.com/api/endpoint" 
              maxlength="500"
            />
          </a-form-item>

          <a-form-item label="请求头" name="http_headers">
            <div class="k8s-key-value-inputs">
              <div 
                v-for="(header, index) in createFormModel.http_headers || []" 
                :key="index"
                class="k8s-key-value-row"
              >
                <a-input 
                  v-model:value="header.key" 
                  placeholder="Header名称" 
                  class="k8s-form-input"
                />
                <a-input 
                  v-model:value="header.value" 
                  placeholder="Header值" 
                  class="k8s-form-input"
                />
                <a-button 
                  @click="removeHttpHeader(index)" 
                  type="primary" 
                  danger
                  size="small"
                >
                  删除
                </a-button>
              </div>
              <a-button 
                @click="addHttpHeader" 
                type="dashed" 
                style="width: 100%; margin-top: 8px;"
              >
                <template #icon><PlusOutlined /></template>
                添加请求头
              </a-button>
            </div>
          </a-form-item>

          <a-form-item label="请求体" name="http_body">
            <a-textarea 
              v-model:value="createFormModel.http_body" 
              placeholder="POST/PUT请求的数据体，支持JSON格式" 
              :rows="4"
              maxlength="5000"
              show-count
            />
          </a-form-item>
        </template>

        <!-- 脚本任务配置 -->
        <!-- 脚本任务配置 -->
        <template v-if="createFormModel.job_type === CronJobType.SCRIPT">
          <a-form-item label="脚本类型" name="script_type" has-feedback>
            <a-select v-model:value="createFormModel.script_type" placeholder="请选择脚本类型">
              <a-select-option value="bash">Bash Shell</a-select-option>
              <a-select-option value="python">Python</a-select-option>
              <a-select-option value="node">Node.js</a-select-option>
              <a-select-option value="powershell">PowerShell</a-select-option>
            </a-select>
          </a-form-item>

          <a-form-item label="脚本内容" name="script_content" has-feedback>
            <a-textarea 
              v-model:value="createFormModel.script_content" 
              placeholder="请输入脚本内容" 
              :rows="10"
              maxlength="10000"
              show-count
              class="k8s-config-textarea"
            />
          </a-form-item>
        </template>

        <!-- SSH 远程任务配置 -->
        <template v-if="createFormModel.job_type === CronJobType.SSH">
          <a-form-item label="SSH资源" name="ssh_resource_id" has-feedback>
            <a-select 
              v-model:value="createFormModel.ssh_resource_id" 
              placeholder="请选择SSH资源"
              :loading="sshResourcesLoading"
              @dropdown-visible-change="(open: boolean) => open && fetchSshResources()"
              show-search
              :filter-option="false"
              @search="searchSshResources"
            >
              <a-select-option v-for="resource in filteredSshResources" :key="resource.id" :value="resource.id">
                <div style="display: flex; justify-content: space-between; align-items: center;">
                  <span>{{ resource.name }}</span>
                  <a-tag size="small" :color="resource.status === 1 ? 'green' : 'red'">
                    {{ resource.ip_addr }}:{{ resource.port }}
                  </a-tag>
                </div>
              </a-select-option>
            </a-select>
          </a-form-item>

          <a-form-item label="远程命令" name="ssh_command" has-feedback>
            <a-textarea 
              v-model:value="createFormModel.ssh_command" 
              placeholder="请输入要在远程服务器执行的命令" 
              :rows="4"
              maxlength="2000"
              show-count
              class="k8s-config-textarea"
            />
          </a-form-item>

          <a-form-item label="工作目录" name="ssh_work_dir">
            <a-input 
              v-model:value="createFormModel.ssh_work_dir" 
              placeholder="远程命令执行的工作目录，留空使用默认目录" 
              maxlength="500"
            />
          </a-form-item>

          <a-form-item label="环境变量" name="ssh_environment">
            <div class="k8s-key-value-inputs">
              <div 
                v-for="(env, index) in createFormModel.ssh_environment || []" 
                :key="index"
                class="k8s-key-value-row"
              >
                <a-input 
                  v-model:value="env.key" 
                  placeholder="变量名" 
                  class="k8s-form-input"
                />
                <a-input 
                  v-model:value="env.value" 
                  placeholder="变量值" 
                  class="k8s-form-input"
                />
                <a-button 
                  @click="removeSshEnvironment(index)" 
                  type="primary" 
                  danger
                  size="small"
                >
                  删除
                </a-button>
              </div>
              <a-button 
                @click="addSshEnvironment" 
                type="dashed" 
                style="width: 100%; margin-top: 8px;"
              >
                <template #icon><PlusOutlined /></template>
                添加环境变量
              </a-button>
            </div>
          </a-form-item>
        </template>

        <a-form-item label="超时时间" name="timeout">
          <a-input-number 
            v-model:value="createFormModel.timeout" 
            placeholder="秒"
            :min="1"
            :max="3600"
            style="width: 100%"
            addon-after="秒"
          />
          <div class="cron-timeout-tip">
            <small>任务执行超时时间，1-3600秒，默认300秒</small>
          </div>
        </a-form-item>

        <a-form-item label="失败重试" name="max_retry">
          <a-input-number 
            v-model:value="createFormModel.max_retry" 
            placeholder="次数"
            :min="0"
            :max="10"
            style="width: 100%"
            addon-after="次"
          />
        </a-form-item>
      </a-form>
    </a-modal>

    <!-- 编辑任务模态框 -->
    <a-modal
      v-model:open="isEditModalVisible"
      title="编辑定时任务"
      :width="800"
      :confirm-loading="submitLoading"
      @ok="submitEditForm"
      @cancel="closeEditModal"
      ok-text="保存修改"
      cancel-text="取消"
      destroy-on-close
    >
      <a-form
        ref="formRef"
        :model="editFormModel"
        :rules="editFormRules"
        :label-col="{ span: 6 }"
        :wrapper-col="{ span: 18 }"
        class="k8s-form"
      >
        <a-form-item label="任务名称" name="name" has-feedback>
          <a-input v-model:value="editFormModel.name" placeholder="请输入任务名称" maxlength="100" />
        </a-form-item>

        <a-form-item label="任务描述" name="description">
          <a-textarea 
            v-model:value="editFormModel.description" 
            placeholder="请输入任务描述" 
            :rows="3" 
            maxlength="500"
            show-count 
          />
        </a-form-item>

        <a-form-item label="调度表达式" name="schedule" has-feedback>
          <a-input 
            v-model:value="editFormModel.schedule" 
            placeholder="例：0 0 * * * (每天午夜执行)"
            maxlength="100"
          >
            <template #addonAfter>
              <a-button type="link" @click="validateScheduleExpression" size="small">
                验证
              </a-button>
            </template>
          </a-input>
        </a-form-item>

        <a-form-item label="超时时间" name="timeout">
          <a-input-number 
            v-model:value="editFormModel.timeout" 
            placeholder="秒"
            :min="1"
            :max="3600"
            style="width: 100%"
            addon-after="秒"
          />
        </a-form-item>

        <a-form-item label="失败重试" name="max_retry">
          <a-input-number 
            v-model:value="editFormModel.max_retry" 
            placeholder="次数"
            :min="0"
            :max="10"
            style="width: 100%"
            addon-after="次"
          />
        </a-form-item>
      </a-form>
    </a-modal>

    <!-- 任务详情模态框 -->
    <a-modal
      v-model:open="isDetailModalVisible"
      title="任务详情"
      :width="900"
      :footer="null"
      @cancel="closeDetailModal"
    >
      <a-spin :spinning="detailLoading">
        <div v-if="currentJobDetail" class="k8s-detail-content">
          <a-descriptions :column="2" bordered>
            <a-descriptions-item label="任务名称">{{ currentJobDetail.name }}</a-descriptions-item>
            <a-descriptions-item label="任务状态">
              <a-badge :status="getStatusColor(currentJobDetail.status)" :text="getStatusText(currentJobDetail.status)" />
            </a-descriptions-item>
            <a-descriptions-item label="任务类型">
              <a-tag :color="getJobTypeColor(currentJobDetail.job_type)">{{ getJobTypeText(currentJobDetail.job_type) }}</a-tag>
            </a-descriptions-item>
            <a-descriptions-item label="调度表达式">{{ currentJobDetail.schedule }}</a-descriptions-item>
            <a-descriptions-item label="创建时间">{{ formatDateTime(currentJobDetail.created_at) }}</a-descriptions-item>
            <a-descriptions-item label="更新时间">{{ formatDateTime(currentJobDetail.updated_at) }}</a-descriptions-item>
            <a-descriptions-item label="下次执行">{{ currentJobDetail.next_run_time ? formatDateTime(currentJobDetail.next_run_time) : '暂无' }}</a-descriptions-item>
            <a-descriptions-item label="上次执行">{{ currentJobDetail.last_run_time ? formatDateTime(currentJobDetail.last_run_time) : '暂无' }}</a-descriptions-item>
            <a-descriptions-item label="上次状态">
              <a-badge 
                :status="getLastRunStatusColor(currentJobDetail.last_run_status)" 
                :text="getLastRunStatusText(currentJobDetail.last_run_status)"
                v-if="currentJobDetail.last_run_time"
              />
              <span v-else class="k8s-no-data">暂无</span>
            </a-descriptions-item>
            <a-descriptions-item label="执行次数">{{ currentJobDetail.run_count || 0 }}次</a-descriptions-item>
            <a-descriptions-item label="成功次数">{{ currentJobDetail.success_count || 0 }}次</a-descriptions-item>
            <a-descriptions-item label="失败次数">{{ currentJobDetail.failure_count || 0 }}次</a-descriptions-item>
            <a-descriptions-item label="超时时间">{{ currentJobDetail.timeout }}秒</a-descriptions-item>
            <a-descriptions-item label="重试次数">{{ currentJobDetail.max_retry }}次</a-descriptions-item>
            <a-descriptions-item label="创建者">{{ currentJobDetail.created_by_name || '系统' }}</a-descriptions-item>
            <a-descriptions-item label="任务描述" :span="2">{{ currentJobDetail.description || '无描述' }}</a-descriptions-item>
            <a-descriptions-item label="执行耗时" v-if="currentJobDetail.last_run_duration > 0">
              {{ formatDuration(currentJobDetail.last_run_duration) }}
            </a-descriptions-item>
            <a-descriptions-item label="执行输出" :span="2" v-if="currentJobDetail.last_run_output">
              <div class="k8s-config-textarea" style="max-height: 200px; overflow-y: auto;">
                <pre>{{ currentJobDetail.last_run_output }}</pre>
              </div>
            </a-descriptions-item>
            <a-descriptions-item label="错误信息" :span="2" v-if="currentJobDetail.last_run_error">
              <div class="k8s-config-textarea" style="max-height: 200px; overflow-y: auto; color: #ff4d4f;">
                <pre>{{ currentJobDetail.last_run_error }}</pre>
              </div>
            </a-descriptions-item>
          </a-descriptions>
        </div>
      </a-spin>
    </a-modal>
  </div>
</template>

<script setup lang="ts">
import { 
  ClockCircleOutlined, 
  PlusOutlined, 
  ReloadOutlined, 
  FilterOutlined, 
  SearchOutlined, 
  DeleteOutlined, 
  EyeOutlined, 
  EditOutlined, 
  PlayCircleOutlined, 
  PauseCircleOutlined, 
  PlaySquareOutlined
} from '@ant-design/icons-vue';
import { onMounted, watch } from 'vue';
import { message } from 'ant-design-vue';
import { useCronJobPage } from './Management';
import { useAccessStore } from '@vben/stores';

// 使用组合式函数
const {
  // 响应式状态
  loading,
  submitLoading,
  detailLoading,
  error,
  sshResourcesLoading,
  searchText,
  filterStatus,
  filterJobType,
  currentPage,
  pageSize,
  total,
  selectedRows,
  isCreateModalVisible,
  isEditModalVisible,
  isDetailModalVisible,
  currentJobDetail,
  createFormModel,
  editFormModel,
  
  // 表单引用
  formRef,
  
  // 计算属性
  filteredCronJobs,
  rowSelection,
  
  // 表单验证规则
  createFormRules,
  editFormRules,
  
  // 工具函数
  getStatusText,
  getStatusColor,
  getJobTypeText,
  getJobTypeColor,
  getLastRunStatusText,
  getLastRunStatusColor,
  formatDateTime,
  formatDuration,
  
  // HTTP头部管理
  addHttpHeader,
  removeHttpHeader,
  
  // SSH环境变量管理
  addSshEnvironment,
  removeSshEnvironment,
  
  // SSH资源搜索
  searchSshResources,
  filteredSshResources,
  
  // 命令参数管理
  addArg,
  removeArg,
  
  // 环境变量管理
  addEnvironment,
  removeEnvironment,
  
  // 数据操作
  fetchCronJobs,
  fetchSshResources,
  
  // 任务详情操作
  showJobDetail,
  closeDetailModal,
  
  // 创建操作
  openCreateModal,
  closeCreateModal,
  submitCreateForm,
  
  // 编辑操作
  openEditModal,
  closeEditModal,
  submitEditForm,
  
  // 任务操作
  deleteJob,
  enableJob,
  disableJob,
  triggerJob,
  
  // 批量操作
  batchOperation,
  
  
  // 表单操作
  validateScheduleExpression,
  handleJobTypeChange,
  
  // 常量
  CronJobStatus,
  CronJobType,
} = useCronJobPage();

// 获取访问控制store
const accessStore = useAccessStore();

// 定义表格列
const columns = [
  {
    title: '任务名称',
    dataIndex: 'name',
    key: 'name',
    width: 200,
    ellipsis: true,
    sorter: true,
  },
  {
    title: '状态',
    dataIndex: 'status',
    key: 'status',
    width: 100,
    slots: { customRender: 'status' },
  },
  {
    title: '类型',
    dataIndex: 'job_type',
    key: 'job_type',
    width: 120,
    slots: { customRender: 'job_type' },
  },
  {
    title: '调度表达式',
    dataIndex: 'schedule',
    key: 'schedule',
    width: 150,
    ellipsis: true,
  },
  {
    title: '描述',
    dataIndex: 'description',
    key: 'description',
    ellipsis: true,
  },
  {
    title: '下次执行',
    dataIndex: 'next_run_time',
    key: 'next_run_time',
    width: 160,
    slots: { customRender: 'next_run_time' },
  },
  {
    title: '上次执行',
    dataIndex: 'last_run_time',
    key: 'last_run_time',
    width: 160,
    slots: { customRender: 'last_run_time' },
  },
  {
    title: '最后状态',
    dataIndex: 'last_run_status',
    key: 'last_run_status',
    width: 100,
    slots: { customRender: 'last_run_status' },
  },
  {
    title: '创建者',
    dataIndex: 'created_by_name',
    key: 'created_by_name',
    width: 100,
    ellipsis: true,
  },
  {
    title: '操作',
    key: 'action',
    width: 250,
    fixed: 'right',
    slots: { customRender: 'action' },
  },
];

// 搜索处理函数
const onSearch = () => {
  currentPage.value = 1;
  fetchCronJobs();
};

// 筛选变化处理函数
const handleFilterChange = () => {
  currentPage.value = 1;
  fetchCronJobs();
};

// 重置筛选
const resetFilters = () => {
  if (filterStatus) filterStatus.value = undefined;
  if (filterJobType) filterJobType.value = undefined;
  if (searchText) searchText.value = '';
  if (currentPage) currentPage.value = 1;
  message.success('已重置所有筛选条件');
  fetchCronJobs();
};

// 表格变化处理函数
const handleTableChange = (pagination: any) => {
  currentPage.value = pagination.current;
  pageSize.value = pagination.pageSize;
  fetchCronJobs();
};

// 初始化数据加载
onMounted(async () => {
  if (!accessStore.accessToken) {

    return;
  }
  
  await fetchCronJobs();
});

// 监听认证状态变化，如果用户登录了就重新加载数据
watch(() => accessStore.accessToken, (newToken, oldToken) => {
  if (newToken && !oldToken) {
    // 用户刚刚登录，重新加载数据
    fetchCronJobs();
  }
});
</script>

<style scoped>
@import '../shared/cron-common.css';
</style>
