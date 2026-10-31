<script setup lang="ts">
import { computed, ref, watch } from 'vue';

import {
  runPredictionBacktest,
  type ForecastObservation,
  type PredictionBacktestResult,
} from '#/api/core/aiops/prediction-backtest';
import { usePermission } from '#/utils/permission';
import { useAiRequestScope } from '../assistant/useAiRequestScope';

const { hasPerm } = usePermission();
const canRun = computed(() => hasPerm('/api/v1/predict/backtest'));
const input = ref('');
const result = ref<null | PredictionBacktestResult>(null);
const error = ref('');
const loading = ref(false);
const scope = useAiRequestScope(() => {
  lane.invalidate();
  input.value = '';
  result.value = null;
  error.value = '';
  loading.value = false;
});
const lane = scope.createLane();
watch(
  input,
  () => {
    lane.invalidate();
    result.value = null;
    error.value = '';
    loading.value = false;
  },
  { flush: 'sync' },
);
watch(
  canRun,
  (allowed) => {
    if (!allowed) {
      lane.invalidate();
      input.value = '';
      result.value = null;
      error.value = '';
      loading.value = false;
    }
  },
  { flush: 'sync' },
);

function formatNumber(value: unknown): string {
  return typeof value === 'number' && Number.isFinite(value)
    ? new Intl.NumberFormat('zh-CN', { maximumFractionDigits: 4 }).format(value)
    : '未知';
}
function formatRate(value: unknown): string {
  return typeof value === 'number' && Number.isFinite(value)
    ? `${formatNumber(value * 100)}%`
    : '未知';
}
function validResult(value: PredictionBacktestResult): boolean {
  const c = value?.calibration;
  const optionalNumber = (n: unknown) =>
    n === null || (typeof n === 'number' && Number.isFinite(n));
  return (
    Number.isSafeInteger(value?.sample_count) &&
    value.sample_count > 0 &&
    [value.horizon_seconds, value.mae, value.rmse, value.bias].every(
      (n) => typeof n === 'number' && Number.isFinite(n),
    ) &&
    value.horizon_seconds > 0 &&
    value.mae >= 0 &&
    value.rmse >= 0 &&
    optionalNumber(value.wape) &&
    (value.wape === null || value.wape >= 0) &&
    typeof value.evidence === 'string' &&
    !!c &&
    Number.isSafeInteger(c.evaluated_count) &&
    c.evaluated_count >= 0 &&
    c.evaluated_count <= value.sample_count &&
    optionalNumber(c.observed_coverage) &&
    (c.observed_coverage === null ||
      (c.observed_coverage >= 0 && c.observed_coverage <= 1)) &&
    optionalNumber(c.residual_lower) &&
    optionalNumber(c.residual_upper) &&
    (c.residual_lower === null ||
      c.residual_upper === null ||
      c.residual_lower <= c.residual_upper)
  );
}
async function run(): Promise<void> {
  if (!scope.owner.value || !canRun.value || loading.value) return;
  let records: unknown;
  try {
    records = JSON.parse(input.value);
  } catch {
    error.value = '请输入有效的 JSON 数组';
    return;
  }
  if (
    !Array.isArray(records) ||
    records.length === 0 ||
    records.length > 5000 ||
    input.value.length > 1_000_000
  ) {
    error.value = '请输入 1 至 5000 条记录，文本不超过 100 万字符';
    return;
  }
  const ticket = lane.begin();
  loading.value = true;
  error.value = '';
  result.value = null;
  try {
    const response = await runPredictionBacktest(
      records as ForecastObservation[],
    );
    if (!lane.current(ticket) || !canRun.value) return;
    if (!validResult(response)) {
      error.value = '回测结果格式异常，请重试';
      return;
    }
    result.value = response;
  } catch {
    if (lane.current(ticket) && canRun.value)
      error.value = '回测未完成，请检查记录格式和接口权限后重试';
  } finally {
    if (lane.current(ticket)) loading.value = false;
  }
}
</script>

<template>
  <a-card title="预测回测与误差校准" class="backtest-card">
    <p>
      使用同一指标、模型和预测跨度的历史预测与实际观测。记录仅用于本次计算，不会自动修改模型准确率。
    </p>
    <a-alert
      v-if="!canRun"
      type="info"
      show-icon
      message="当前账户没有回测权限"
    />
    <template v-else>
      <p>
        请输入 JSON 数组，每条包含
        issued_at、target_at、observed_at、forecast、actual。时间需带时区，预测须早于目标时间。
      </p>
      <a-textarea
        v-model:value="input"
        :rows="6"
        :maxlength="1000000"
        aria-label="回测记录 JSON"
        placeholder="粘贴已记录的预测与观测 JSON 数组"
        :disabled="loading"
      />
      <div class="backtest-actions">
        <a-button
          type="primary"
          :loading="loading"
          :disabled="!scope.owner.value || !input.trim() || loading"
          @click="run"
        >
          计算回测
        </a-button>
      </div>
      <a-alert
        v-if="error"
        :message="error"
        type="error"
        show-icon
        role="alert"
      />
      <div v-if="result" class="backtest-result" aria-live="polite">
        <h3>回测结果</h3>
        <p>
          样本 {{ result.sample_count }} 条，预测跨度
          {{ formatNumber(result.horizon_seconds) }} 秒；滚动覆盖率基于
          {{ result.calibration.evaluated_count }} 条可校准记录。
        </p>
        <dl>
          <div>
            <dt>平均绝对误差</dt>
            <dd>{{ formatNumber(result.mae) }}</dd>
          </div>
          <div>
            <dt>均方根误差</dt>
            <dd>{{ formatNumber(result.rmse) }}</dd>
          </div>
          <div>
            <dt>平均偏差</dt>
            <dd>{{ formatNumber(result.bias) }}</dd>
          </div>
          <div>
            <dt>加权绝对百分比误差</dt>
            <dd>{{ formatRate(result.wape) }}</dd>
          </div>
          <div>
            <dt>滚动区间覆盖率</dt>
            <dd>{{ formatRate(result.calibration.observed_coverage) }}</dd>
          </div>
          <div>
            <dt>经验残差区间</dt>
            <dd>
              {{ formatNumber(result.calibration.residual_lower) }} 至
              {{ formatNumber(result.calibration.residual_upper) }}
            </dd>
          </div>
        </dl>
        <p>{{ result.evidence }}。经验区间不保证未来覆盖率。</p>
      </div>
    </template>
  </a-card>
</template>

<style scoped>
.backtest-card {
  margin-top: var(--ops-space-lg);
}
.backtest-actions {
  margin: var(--ops-space-md) 0;
}
.backtest-result {
  margin-top: var(--ops-space-lg);
}
.backtest-result dl {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
  gap: var(--ops-space-md);
}
.backtest-result dl div {
  min-width: 0;
}
.backtest-result dd {
  margin: 0;
  font-variant-numeric: tabular-nums;
}
</style>
