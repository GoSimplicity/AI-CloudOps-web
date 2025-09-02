<template>
  <div class="yaml-editor-actions">
    <a-button type="primary" size="small" @click="formatYaml" :loading="loading">
      <template #icon>
        <CodeOutlined />
      </template>
      格式化
    </a-button>
    <a-button size="small" @click="validateYaml">
      <template #icon>
        <CheckCircleOutlined />
      </template>
      验证格式
    </a-button>
    <a-button size="small" @click="copyYaml">
      <template #icon>
        <CopyOutlined />
      </template>
      复制
    </a-button>
    <span class="yaml-hint">提示：支持标准YAML格式，修改后请先验证格式</span>
  </div>
  <div class="yaml-editor-wrapper">
    <div class="line-numbers">
      <div v-for="n in lineCount" :key="n" class="line-number">{{ n }}</div>
    </div>
    <a-textarea 
      :value="yaml"
      @update:value="$emit('update:yaml', $event)"
      placeholder="请输入Service的YAML配置..."
      :rows="20"
      class="yaml-editor"
      style="font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace; font-size: 13px; line-height: 1.5; padding-left: 50px;"
    />
  </div>
</template>

<script lang="ts" setup>
import { computed } from 'vue';
import { message } from 'ant-design-vue';
import { CodeOutlined, CheckCircleOutlined, CopyOutlined } from '@ant-design/icons-vue';

const props = defineProps<{
  yaml: string;
  loading?: boolean;
}>();

const emit = defineEmits<{
  'update:yaml': [yaml: string];
}>();

// 计算行数
const lineCount = computed(() => {
  return Math.max(props.yaml.split('\n').length, 25);
});

// YAML格式化函数
const formatYaml = async () => {
  try {
    // 尝试使用JS-YAML进行格式化
    const yaml = await import('js-yaml');
    const parsed = yaml.load(props.yaml);
    const formatted = yaml.dump(parsed, {
      indent: 2,
      lineWidth: 120,
      noRefs: true,
      sortKeys: false
    });
    emit('update:yaml', formatted);
    message.success('YAML格式化成功');
  } catch (error: any) {
    console.error('YAML格式化失败:', error);
    message.error('YAML格式化失败: ' + (error.message || '格式错误'));
  }
};

// YAML验证函数
const validateYaml = async () => {
  try {
    const yaml = await import('js-yaml');
    yaml.load(props.yaml);
    message.success('YAML格式验证通过');
  } catch (error: any) {
    console.error('YAML验证失败:', error);
    message.error('YAML格式验证失败: ' + (error.message || '格式错误'));
  }
};

// 复制YAML
const copyYaml = async () => {
  try {
    await navigator.clipboard.writeText(props.yaml);
    message.success('YAML已复制到剪贴板');
  } catch (err) {
    message.error('复制失败，请手动选择并复制');
  }
};
</script>

<style scoped>
.yaml-editor-actions {
  display: flex;
  gap: 8px;
  align-items: center;
  margin-bottom: 12px;
  padding: 12px;
  background: #f8f9fa;
  border-radius: 6px;
  border: 1px solid #e9ecef;
}

.yaml-hint {
  font-size: 13px;
  color: #666;
  font-style: italic;
  margin-left: auto;
}

.yaml-editor-wrapper {
  position: relative;
  border: 1px solid #d9d9d9;
  border-radius: 6px;
  overflow: hidden;
  background: #fff;
}

.yaml-editor {
  border: none !important;
  resize: none !important;
  box-shadow: none !important;
  background: #fafafa;
  border-radius: 0 !important;
}

.yaml-editor:focus {
  border: none !important;
  box-shadow: none !important;
}

/* 行号样式 */
.line-numbers {
  position: absolute;
  top: 0;
  left: 0;
  width: 45px;
  height: 100%;
  background: linear-gradient(to right, #f8f9fa 0%, #e9ecef 100%);
  border-right: 1px solid #dee2e6;
  z-index: 2;
  pointer-events: none;
  padding: 8px 4px;
  overflow: hidden;
}

.line-number {
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
  font-size: 12px;
  line-height: 20px;
  color: #6c757d;
  text-align: right;
  padding-right: 8px;
  user-select: none;
}
</style>
