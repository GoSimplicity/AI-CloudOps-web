import { requestClientAIOps } from '#/api/request';

export interface ForecastObservation {
  issued_at: string;
  target_at: string;
  observed_at: string;
  forecast: number;
  actual: number;
}

export interface PredictionBacktestResult {
  sample_count: number;
  horizon_seconds: number;
  mae: number;
  rmse: number;
  bias: number;
  wape: null | number;
  evidence: string;
  calibration: {
    evaluated_count: number;
    method: string;
    minimum_history: number;
    observed_coverage: null | number;
    reference_time: string;
    residual_lower: null | number;
    residual_upper: null | number;
    window: number;
  };
}

export function runPredictionBacktest(records: ForecastObservation[]) {
  return requestClientAIOps.post<PredictionBacktestResult>(
    '/predict/backtest',
    { records },
  );
}
