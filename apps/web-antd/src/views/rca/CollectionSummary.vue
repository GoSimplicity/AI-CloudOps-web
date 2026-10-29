<template>
  <section class="collection-summary" aria-label="分析状态和数据采集情况">
    <a-alert :type="statusInfo.type" :message="statusInfo.label" :description="statusInfo.description" show-icon />
    <div class="coverage">采集覆盖率：<strong>{{ coverageText(collection) }}</strong><span v-if="collection?.coverage_basis === 'completed_collection_units'">（按已完成采集单元计算）</span></div>
    <ul class="sources">
      <li v-for="source in sources" :key="source.key">
        <span>{{ source.label }}</span>
        <strong>{{ sourceText(collection?.sources?.[source.key]?.status) }}</strong>
        <span v-if="validCount(collection?.sources?.[source.key]?.count)">{{ collection?.sources?.[source.key]?.count }} 条</span>
      </li>
    </ul>
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { RCACollection } from '#/api/core/aiops/rca';
import { analysisStatus, coverageText, sourceText } from './collection';

const props = defineProps<{ status?: string; collection?: RCACollection }>();
const statusInfo = computed(() => analysisStatus(props.status));
const sources = [
  { key: 'metrics', label: '指标' },
  { key: 'events', label: '事件' },
  { key: 'logs', label: '日志' },
] as const;
function validCount(count?: number) {
  return typeof count === 'number' && Number.isSafeInteger(count) && count >= 0;
}
</script>

<style scoped>
.collection-summary { display: grid; gap: 12px; margin-bottom: 16px; }
.coverage { color: var(--text-color-secondary, #666); }
.coverage strong { color: var(--text-color, #222); }
.coverage span { font-size: 12px; }
.sources { display: grid; gap: 8px; margin: 0; padding: 0; list-style: none; }
.sources li { display: flex; flex-wrap: wrap; gap: 8px; align-items: baseline; }
.sources li > span:first-child { min-width: 3em; }
.sources li > span:last-child { color: var(--text-color-secondary, #666); }
</style>
