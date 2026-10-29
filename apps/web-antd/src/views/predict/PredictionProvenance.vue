<template>
  <section class="prediction-provenance" aria-label="预测来源和降级状态">
    <div>预测方式：<strong>{{ methodLabel }}</strong></div>
    <div>模型版本：{{ result.model_version || '未知' }}</div>
    <div v-if="result.fallback_mode || result.method === 'rule_based'" class="notice">
      模型降级：{{ result.fallback_reason || '原因未知' }}
    </div>
    <div v-if="result.ai_enhanced === true">AI 分析：已完成</div>
    <div v-else-if="result.ai_fallback_reason || aiRequested" class="notice">
      AI 分析未完成：{{ result.ai_fallback_reason || '原因未知' }}
    </div>
    <div v-else>AI 分析：未启用</div>
    <div v-for="(failure, index) in result.analysis_failures || []" :key="index" class="notice">{{ failure }}</div>
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { PredictionResponse } from '#/api/core/aiops/predict';
const props = defineProps<{ result: PredictionResponse; aiRequested: boolean }>();
const methodLabel = computed(() => {
  if (props.result.method === 'rule_based') return '规则降级';
  if (props.result.method?.startsWith('model:')) return '模型预测';
  return '未知';
});
</script>

<style scoped>
.prediction-provenance { display: grid; gap: 4px; margin: 12px 0; color: var(--text-color-secondary, #666); font-size: 12px; }
.prediction-provenance strong { color: var(--text-color, #222); }
.notice { color: var(--ops-warning, #ad6800); }
</style>
