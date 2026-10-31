<script setup lang="ts">
import { PlusOutlined } from '@ant-design/icons-vue';
import {
  CronJobType,
  type UpdateCronJobReq,
  type TreeLocalResource,
} from '#/api/core/cron/cron';
import CronKeyValueFields from './CronKeyValueFields.vue';

defineProps<{ resources: TreeLocalResource[]; loading: boolean }>();
const emit = defineEmits<{ search: [value: string]; openResources: [] }>();
const model = defineModel<UpdateCronJobReq>({ required: true });
function setField<K extends keyof UpdateCronJobReq>(
  key: K,
  value: UpdateCronJobReq[K],
) {
  model.value = { ...model.value, [key]: value };
}
function setArg(index: number, value: string) {
  setField(
    'args',
    (model.value.args ?? []).map((arg, i) => (i === index ? value : arg)),
  );
}
function removeArg(index: number) {
  setField(
    'args',
    (model.value.args ?? []).filter((_, i) => i !== index),
  );
}
</script>

<template>
  <template v-if="model.job_type === CronJobType.COMMAND">
    <a-form-item label="执行命令" name="command" has-feedback>
      <a-textarea
        :value="model.command"
        placeholder="请输入要执行的命令"
        :rows="3"
        :maxlength="1000"
        @update:value="setField('command', $event)"
      />
    </a-form-item>
    <a-form-item label="命令参数" name="args">
      <a-form-item-rest>
        <div class="k8s-key-value-inputs">
          <div
            v-for="(arg, index) in model.args ?? []"
            :key="index"
            class="k8s-key-value-row"
          >
            <a-input
              :value="arg"
              placeholder="输入参数"
              @update:value="setArg(index, $event)"
            />
            <a-button
              type="primary"
              danger
              size="small"
              @click="removeArg(index)"
            >
              删除
            </a-button>
          </div>
          <a-button
            type="dashed"
            style="width: 100%; margin-top: 8px"
            @click="setField('args', [...(model.args ?? []), ''])"
          >
            <template #icon><PlusOutlined /></template>添加参数
          </a-button>
        </div>
      </a-form-item-rest>
    </a-form-item>
    <a-form-item label="工作目录" name="work_dir">
      <a-input
        :value="model.work_dir"
        placeholder="命令执行的工作目录，留空使用默认目录"
        :maxlength="255"
        @update:value="setField('work_dir', $event)"
      />
    </a-form-item>
    <a-form-item label="环境变量" name="environment">
      <CronKeyValueFields
        :items="model.environment ?? []"
        key-placeholder="变量名"
        value-placeholder="变量值"
        add-text="添加环境变量"
        @change="setField('environment', $event)"
      />
    </a-form-item>
  </template>

  <template v-else-if="model.job_type === CronJobType.HTTP">
    <a-form-item label="请求方法" name="http_method" has-feedback>
      <a-select
        :value="model.http_method"
        placeholder="请选择HTTP方法"
        @update:value="setField('http_method', $event)"
      >
        <a-select-option
          v-for="method in ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD']"
          :key="method"
          :value="method"
        >
          {{ method }}
        </a-select-option>
      </a-select>
    </a-form-item>
    <a-form-item label="请求URL" name="http_url" has-feedback>
      <a-input
        :value="model.http_url"
        placeholder="https://example.com/api/endpoint"
        :maxlength="500"
        @update:value="setField('http_url', $event)"
      />
    </a-form-item>
    <a-form-item label="请求头" name="http_headers">
      <CronKeyValueFields
        :items="model.http_headers ?? []"
        key-placeholder="Header名称"
        value-placeholder="Header值"
        add-text="添加请求头"
        @change="setField('http_headers', $event)"
      />
    </a-form-item>
    <a-form-item label="请求体" name="http_body">
      <a-textarea
        :value="model.http_body"
        placeholder="POST/PUT请求的数据体"
        :rows="4"
        :maxlength="5000"
        show-count
        @update:value="setField('http_body', $event)"
      />
    </a-form-item>
  </template>

  <template v-else-if="model.job_type === CronJobType.SCRIPT">
    <a-form-item label="脚本类型" name="script_type" has-feedback>
      <a-select
        :value="model.script_type"
        placeholder="请选择脚本类型"
        @update:value="setField('script_type', $event)"
      >
        <a-select-option value="bash">Bash Shell</a-select-option>
        <a-select-option value="python">Python</a-select-option>
        <a-select-option value="node">Node.js</a-select-option>
        <a-select-option value="powershell">PowerShell</a-select-option>
      </a-select>
    </a-form-item>
    <a-form-item label="脚本内容" name="script_content" has-feedback>
      <a-textarea
        :value="model.script_content"
        placeholder="请输入脚本内容"
        :rows="10"
        :maxlength="10000"
        show-count
        class="k8s-config-textarea"
        @update:value="setField('script_content', $event)"
      />
    </a-form-item>
  </template>

  <template v-else-if="model.job_type === CronJobType.SSH">
    <a-form-item label="SSH资源" name="ssh_resource_id" has-feedback>
      <a-select
        :value="model.ssh_resource_id"
        placeholder="请选择SSH资源"
        :loading="loading"
        show-search
        :filter-option="false"
        @search="emit('search', $event)"
        @dropdown-visible-change="$event && emit('openResources')"
        @update:value="setField('ssh_resource_id', $event)"
      >
        <a-select-option
          v-for="resource in resources"
          :key="resource.id"
          :value="resource.id"
        >
          {{ resource.name }}（{{ resource.ip_addr }}:{{ resource.port }}）
        </a-select-option>
      </a-select>
    </a-form-item>
    <a-form-item label="远程命令" name="ssh_command" has-feedback>
      <a-textarea
        :value="model.ssh_command"
        placeholder="请输入要在远程服务器执行的命令"
        :rows="4"
        :maxlength="2000"
        show-count
        class="k8s-config-textarea"
        @update:value="setField('ssh_command', $event)"
      />
    </a-form-item>
    <a-form-item label="工作目录" name="ssh_work_dir">
      <a-input
        :value="model.ssh_work_dir"
        placeholder="远程命令执行的工作目录，留空使用默认目录"
        :maxlength="500"
        @update:value="setField('ssh_work_dir', $event)"
      />
    </a-form-item>
    <a-form-item label="环境变量" name="ssh_environment">
      <CronKeyValueFields
        :items="model.ssh_environment ?? []"
        key-placeholder="变量名"
        value-placeholder="变量值"
        add-text="添加环境变量"
        @change="setField('ssh_environment', $event)"
      />
    </a-form-item>
  </template>
</template>

<style scoped>
@import '../shared/cron-common.css';
</style>
