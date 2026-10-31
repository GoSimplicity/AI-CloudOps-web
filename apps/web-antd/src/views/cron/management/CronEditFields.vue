<script setup lang="ts">
import { PlusOutlined } from '@ant-design/icons-vue';
import {
  CronJobType,
  type TreeLocalResource,
  type UpdateCronJobReq,
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
    <a-form-item has-feedback label="执行命令" name="command">
      <a-textarea
        :maxlength="1000"
        :rows="3"
        :value="model.command"
        placeholder="请输入要执行的命令"
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
              danger
              size="small"
              type="primary"
              @click="removeArg(index)"
            >
              删除
            </a-button>
          </div>
          <a-button
            style="width: 100%; margin-top: 8px"
            type="dashed"
            @click="setField('args', [...(model.args ?? []), ''])"
          >
            <template #icon><PlusOutlined /></template>添加参数
          </a-button>
        </div>
      </a-form-item-rest>
    </a-form-item>
    <a-form-item label="工作目录" name="work_dir">
      <a-input
        :maxlength="255"
        :value="model.work_dir"
        placeholder="命令执行的工作目录，留空使用默认目录"
        @update:value="setField('work_dir', $event)"
      />
    </a-form-item>
    <a-form-item label="环境变量" name="environment">
      <CronKeyValueFields
        :items="model.environment ?? []"
        add-text="添加环境变量"
        key-placeholder="变量名"
        value-placeholder="变量值"
        @change="setField('environment', $event)"
      />
    </a-form-item>
  </template>

  <template v-else-if="model.job_type === CronJobType.HTTP">
    <a-form-item has-feedback label="请求方法" name="http_method">
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
    <a-form-item has-feedback label="请求URL" name="http_url">
      <a-input
        :maxlength="500"
        :value="model.http_url"
        placeholder="https://example.com/api/endpoint"
        @update:value="setField('http_url', $event)"
      />
    </a-form-item>
    <a-form-item label="请求头" name="http_headers">
      <CronKeyValueFields
        :items="model.http_headers ?? []"
        add-text="添加请求头"
        key-placeholder="Header名称"
        value-placeholder="Header值"
        @change="setField('http_headers', $event)"
      />
    </a-form-item>
    <a-form-item label="请求体" name="http_body">
      <a-textarea
        :maxlength="5000"
        :rows="4"
        :value="model.http_body"
        placeholder="POST/PUT请求的数据体"
        show-count
        @update:value="setField('http_body', $event)"
      />
    </a-form-item>
  </template>

  <template v-else-if="model.job_type === CronJobType.SCRIPT">
    <a-form-item has-feedback label="脚本类型" name="script_type">
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
    <a-form-item has-feedback label="脚本内容" name="script_content">
      <a-textarea
        :maxlength="10000"
        :rows="10"
        :value="model.script_content"
        class="k8s-config-textarea"
        placeholder="请输入脚本内容"
        show-count
        @update:value="setField('script_content', $event)"
      />
    </a-form-item>
  </template>

  <template v-else-if="model.job_type === CronJobType.SSH">
    <a-form-item has-feedback label="SSH资源" name="ssh_resource_id">
      <a-select
        :filter-option="false"
        :loading="loading"
        :value="model.ssh_resource_id"
        placeholder="请选择SSH资源"
        show-search
        @dropdown-visible-change="$event && emit('openResources')"
        @search="emit('search', $event)"
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
    <a-form-item has-feedback label="远程命令" name="ssh_command">
      <a-textarea
        :maxlength="2000"
        :rows="4"
        :value="model.ssh_command"
        class="k8s-config-textarea"
        placeholder="请输入要在远程服务器执行的命令"
        show-count
        @update:value="setField('ssh_command', $event)"
      />
    </a-form-item>
    <a-form-item label="工作目录" name="ssh_work_dir">
      <a-input
        :maxlength="500"
        :value="model.ssh_work_dir"
        placeholder="远程命令执行的工作目录，留空使用默认目录"
        @update:value="setField('ssh_work_dir', $event)"
      />
    </a-form-item>
    <a-form-item label="环境变量" name="ssh_environment">
      <CronKeyValueFields
        :items="model.ssh_environment ?? []"
        add-text="添加环境变量"
        key-placeholder="变量名"
        value-placeholder="变量值"
        @change="setField('ssh_environment', $event)"
      />
    </a-form-item>
  </template>
</template>

<style scoped>
@import '../shared/cron-common.css';
</style>
