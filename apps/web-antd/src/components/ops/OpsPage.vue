<script setup lang="ts">
defineProps<{ title: string; description?: string }>();
</script>

<template>
  <section class="ops-page" :aria-label="title">
    <header class="ops-page__header">
      <div class="ops-page__heading">
        <h1>{{ title }}</h1>
        <p v-if="description">{{ description }}</p>
      </div>
      <div v-if="$slots.actions" class="ops-page__actions">
        <slot name="actions" />
      </div>
    </header>
    <div v-if="$slots.summary" class="ops-page__summary">
      <slot name="summary" />
    </div>
    <div v-if="$slots.filters" class="ops-page__filters">
      <slot name="filters" />
    </div>
    <div class="ops-page__content"><slot /></div>
  </section>
</template>

<style scoped>
.ops-page {
  display: flex;
  flex-direction: column;
  gap: var(--ops-space-lg);
  min-width: 0;
  padding: var(--ops-space-lg) var(--ops-space-xl);
  color: var(--ops-ink);
}
.ops-page__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--ops-space-lg);
  min-width: 0;
}
.ops-page__heading {
  min-width: 0;
}
.ops-page__heading h1 {
  margin: 0;
  font-size: 22px;
  line-height: 1.4;
  font-weight: 600;
  letter-spacing: -0.02em;
}
.ops-page__heading p {
  margin: 6px 0 0;
  color: var(--ops-muted);
  font-size: 13px;
  line-height: 1.6;
}
.ops-page__actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: flex-end;
  gap: var(--ops-space-sm);
}
.ops-page__actions :deep(.ant-btn) {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  white-space: nowrap;
}
.ops-page__filters :deep(.search-right) {
  flex-direction: row;
}
.ops-page__filters {
  padding: var(--ops-space-lg);
  border: 1px solid var(--ops-border);
  border-radius: var(--ops-radius);
  background: var(--ops-surface);
}
.ops-page__filters :deep(.search-left),
.ops-page__filters :deep(.search-right),
.ops-page__filters :deep(.search-filters) {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--ops-space-md);
  margin: 0;
}
.ops-page__filters :deep(.search-filters) {
  width: 100%;
}
.ops-page__filters :deep(.ops-filter-row) {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  align-items: center;
  gap: var(--ops-space-md);
}
.ops-page__filters :deep(.search-left) {
  flex: 1;
  min-width: 0;
}
.ops-page__filters :deep(.search-left > *) {
  min-width: 0;
}
.ops-page__content {
  display: flex;
  flex-direction: column;
  gap: var(--ops-space-lg);
  min-width: 0;
}
.ops-page__summary :deep(.stats-card),
.ops-page__summary :deep(.stat-card) {
  border: 1px solid var(--ops-border);
  border-radius: var(--ops-radius);
  background: var(--ops-surface);
  box-shadow: none;
}
.ops-page__summary :deep(.ant-statistic-title) {
  color: var(--ops-muted);
}
.ops-page__summary :deep(.ant-statistic-content) {
  font-size: 24px;
  line-height: 1.3;
}
.ops-page__summary :deep(.stats-grid),
.ops-page__summary :deep(.stats-row) {
  margin: 0;
}
.ops-page__summary :deep(.stats-grid) {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(180px, 100%), 1fr));
  gap: var(--ops-space-lg);
}
@media (max-width: 640px) {
  .ops-page {
    padding: 16px 12px;
  }
  .ops-page__header {
    align-items: flex-start;
    flex-direction: column;
    gap: var(--ops-space-md);
  }
  .ops-page__heading h1 {
    font-size: 20px;
  }
  .ops-page__actions {
    justify-content: flex-start;
    width: 100%;
  }
  .ops-page__filters {
    padding: 12px;
  }
  .ops-page__filters :deep(.search-left),
  .ops-page__filters :deep(.search-right) {
    width: 100%;
  }
  .ops-page__filters :deep(.search-left > *),
  .ops-page__filters :deep(.search-input),
  .ops-page__filters :deep(.filter-select),
  .ops-page__filters :deep(.status-filter) {
    width: 100%;
    max-width: none;
  }
}
</style>
