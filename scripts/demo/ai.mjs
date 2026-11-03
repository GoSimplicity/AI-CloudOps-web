import { randomUUID } from 'node:crypto';

const source = 'simulated';
const note = '本地演示合成数据；未连接模型、集群、Prometheus 或通知服务。';
export function aiResponse() {
  const sessions = new Map();
  const documents = [
    {
      content: '本地演示环境不执行真实操作。',
      file_name: 'demo.md',
      title: '演示运维手册',
    },
  ];
  return (method, url, body = {}) => {
    const route = url.pathname.replace(/^\/api\/v1/, '');
    if (!url.pathname.startsWith('/api/v1/')) return;
    const timestamp = new Date().toISOString();
    const service = route.split('/')[1];
    if (!['assistant', 'autofix', 'predict', 'rca'].includes(service)) return;
    if (method === 'GET' && route === `/${service}/health`)
      return {
        dependencies: {},
        kubernetes_connected: false,
        last_check_time: timestamp,
        message: note,
        prometheus_connected: false,
        redis_connected: false,
        service,
        source,
        status: 'simulated',
        version: 'demo',
      };
    if (method === 'GET' && route === `/${service}/ready`)
      return {
        healthy: false,
        initialized: false,
        message: note,
        ready: false,
        service,
        source,
        status: 'simulated',
        timestamp,
      };
    if (method === 'GET' && route === `/${service}/info`)
      return {
        capabilities: ['本地合成数据预览'],
        components: {},
        constraints: { external_io: false, real_execution: false },
        description: note,
        endpoints: {},
        service,
        source,
        status: 'simulated',
        version: 'demo',
        workflow_nodes: [],
      };
    if (method === 'GET' && route === `/${service}/config`)
      return {
        config: { external_io: false, mode: 'simulated' },
        service,
        source,
        timestamp,
        version: 'demo',
      };
    if (service === 'assistant') {
      if (method === 'POST' && route === '/assistant/session') {
        const session_id = randomUUID();
        sessions.set(session_id, {
          conversation_history: [],
          created_time: timestamp,
          last_activity: timestamp,
          message_count: 0,
          mode: body.mode ?? 1,
          revision: 0,
          session_id,
          source,
          status: 'active',
        });
        return { session_id, source };
      }
      if (method === 'GET' && route.startsWith('/assistant/session/'))
        return sessions.get(route.slice('/assistant/session/'.length));
      if (
        method === 'POST' &&
        route === '/assistant/query' &&
        typeof body.question === 'string' &&
        body.question.trim()
      ) {
        const id = body.session_id || randomUUID();
        const session = sessions.get(id) ?? {
          conversation_history: [],
          created_time: timestamp,
          mode: body.mode ?? 1,
          revision: 0,
          session_id: id,
          source,
        };
        const answer = `${note}\n\n演示排查建议：\n1. 检查工作负载事件及资源使用曲线。\n2. 对照近期配置变更。\n3. 人工确认后再执行操作。\n\n此回答由固定本地模板生成。`;
        session.conversation_history.push({
          a: answer,
          mode: body.mode ?? 1,
          q: body.question,
        });
        Object.assign(session, {
          last_activity: timestamp,
          last_turn_id: body.turn_id ?? null,
          message_count: session.conversation_history.length * 2,
          revision: session.revision + 1,
          status: 'active',
        });
        sessions.set(id, session);
        return {
          answer,
          follow_up_questions: ['如何查看演示 Pod 日志？'],
          session_id: id,
          source,
          source_documents: documents.map((document) => ({
            metadata: { source, title: document.title },
            page_content: document.content,
          })),
          turn_id: body.turn_id,
        };
      }
      if (
        method === 'POST' &&
        route === '/assistant/add-document' &&
        typeof body.content === 'string'
      ) {
        documents.push({
          content: body.content,
          file_name: body.file_name,
          title: body.title,
        });
        return {
          added: true,
          document_id: randomUUID(),
          message: note,
          source,
          timestamp,
        };
      }
      if (method === 'POST' && route === '/assistant/refresh')
        return {
          documents_count: documents.length,
          message: note,
          refreshed: true,
          source,
          timestamp,
          vector_count: 0,
        };
      if (method === 'POST' && route === '/assistant/clear-cache')
        return {
          cache_keys_cleared: 0,
          cleared: true,
          message: note,
          source,
          timestamp,
        };
    }
    if (service === 'predict') {
      if (method === 'GET' && route === '/predict/models')
        return {
          models: [
            {
              accuracy_metrics: {},
              feature_importance: {},
              model_name: 'local-demo-series',
              model_type: 'simulated',
              model_version: 'simulated',
              supported_prediction_types: ['qps', 'cpu', 'memory', 'disk'],
            },
          ],
          source,
        };
      const kind = route.slice('/predict/'.length);
      if (
        method === 'POST' &&
        ['cpu', 'disk', 'memory', 'qps'].includes(kind)
      ) {
        const key = {
          cpu: 'current_cpu_percent',
          disk: 'current_disk_percent',
          memory: 'current_memory_percent',
          qps: 'current_qps',
        }[kind];
        const current =
          typeof body[key] === 'number' && Number.isFinite(body[key])
            ? body[key]
            : 40;
        const hours = Math.min(
          168,
          Math.max(1, Number(body.prediction_hours) || 24),
        );
        const points = Array.from(
          { length: Math.min(48, hours) },
          (_, index) => ({
            predicted_value: Math.max(
              0,
              current * (1 + 0.05 * Math.sin(index / 3)),
            ),
            timestamp: new Date(
              Date.now() + (index + 1) * 3_600_000,
            ).toISOString(),
          }),
        );
        return {
          ai_enhanced: false,
          ai_insights: [note],
          analysis_failures: [],
          anomaly_predictions: [],
          current_value: current,
          fallback_mode: true,
          fallback_reason: note,
          granularity: body.granularity ?? 'hour',
          historical_data: [],
          method: 'simulated',
          model_accuracy: null,
          model_version: 'simulated',
          pattern_analysis: { source },
          predicted_data: points,
          prediction_hours: hours,
          prediction_summary: { summary: note },
          prediction_type: kind,
          resource_utilization: [],
          scaling_recommendations: [
            {
              action: 'maintain',
              confidence: null,
              reason: note,
              trigger_time: timestamp,
            },
          ],
          source,
          trend_insights: [note],
        };
      }
      if (
        method === 'POST' &&
        route === '/predict/backtest' &&
        Array.isArray(body.records)
      ) {
        const records = body.records.filter(
          (record) =>
            Number.isFinite(record.forecast) && Number.isFinite(record.actual),
        );
        const n = records.length;
        const errors = records.map((record) => record.forecast - record.actual);
        return {
          bias: n ? errors.reduce((sum, value) => sum + value, 0) / n : 0,
          calibration: {
            evaluated_count: 0,
            method: 'simulated',
            minimum_history: 20,
            observed_coverage: null,
            reference_time: timestamp,
            residual_lower: null,
            residual_upper: null,
            window: n,
          },
          evidence: note,
          horizon_seconds: n
            ? (Date.parse(records[0].target_at) -
                Date.parse(records[0].issued_at)) /
              1000
            : 0,
          mae: n
            ? errors.reduce((sum, value) => sum + Math.abs(value), 0) / n
            : 0,
          rmse: n
            ? Math.sqrt(
                errors.reduce((sum, value) => sum + value * value, 0) / n,
              )
            : 0,
          sample_count: n,
          source,
          wape: null,
        };
      }
    }
    if (service === 'rca') {
      const namespace =
        typeof body.namespace === 'string' ? body.namespace : 'demo';
      const requestedEnd = Date.parse(body.end_time);
      const endTime = Number.isFinite(requestedEnd) ? requestedEnd : Date.now();
      const requestedStart = Date.parse(body.start_time);
      const startTime =
        Number.isFinite(requestedStart) && requestedStart < endTime
          ? requestedStart
          : endTime - 3_600_000;
      const sampleTime = new Date(endTime).toISOString();
      const metricNames = ['demo_cpu_usage', 'demo_memory_usage'];
      let requestedMetrics = [];
      if (Array.isArray(body.metrics)) requestedMetrics = body.metrics;
      else if (typeof body.metrics === 'string') {
        requestedMetrics = body.metrics
          .split(',')
          .map((name) => name.trim())
          .filter(Boolean);
      }
      const selectedMetrics =
        requestedMetrics.length > 0
          ? metricNames.filter((name) => requestedMetrics.includes(name))
          : metricNames;
      const metrics = selectedMetrics.map((name) => ({
        anomaly_score: 0,
        labels: { namespace, source },
        name,
        source,
        trend: 'increasing',
        values: Array.from({ length: 12 }, (_, index) => ({
          timestamp: new Date(
            startTime + ((endTime - startTime) * (index + 1)) / 12,
          ).toISOString(),
          value: 24 + metricNames.indexOf(name) * 10 + index * 2,
        })),
      }));
      const collection = {
        coverage: null,
        coverage_basis: 'not_measured_synthetic_fixture',
        message: note,
        sources: Object.fromEntries(
          ['events', 'logs', 'metrics'].map((name) => [
            name,
            { count: 0, failed: 0, source, status: 'failed', succeeded: 0 },
          ]),
        ),
        status: 'failed',
      };
      const analysisMetadata = {
        external_io: false,
        method: 'fixed-local-fixture',
        model_connected: false,
        note,
        real_analysis_performed: false,
        source,
      };
      const events = [
        {
          count: 1,
          involved_object: { kind: 'Pod', name: 'demo-web-1', namespace },
          message: note,
          reason: 'Simulated',
          severity: 'low',
          source,
          timestamp: sampleTime,
          type: 'Normal',
        },
      ];
      const logs = [
        {
          container_name: 'web',
          level: 'INFO',
          message: note,
          pod_name: 'demo-web-1',
          source,
          timestamp: sampleTime,
        },
      ];
      if (method === 'GET' && route === '/rca/metrics')
        return {
          message: note,
          source,
          timestamp,
          total: metricNames.length,
          items: metricNames,
        };
      if (
        method === 'POST' &&
        ['/rca/data/events', '/rca/data/logs', '/rca/data/metrics'].includes(
          route,
        )
      ) {
        let items = logs;
        if (route.endsWith('/metrics')) items = metrics;
        else if (route.endsWith('/events')) items = events;
        if (route.endsWith('/events') && body.severity) {
          items = items.filter((event) => event.severity === body.severity);
        }
        if (route.endsWith('/logs')) {
          items = items.filter(
            (log) =>
              (!body.pod_name || body.pod_name === log.pod_name) &&
              (body.error_only !== true || log.level === 'ERROR'),
          );
          if (Number.isSafeInteger(body.max_lines) && body.max_lines > 0) {
            items = items.slice(0, body.max_lines);
          }
        }
        return {
          end_time: body.end_time,
          namespace,
          query_params: {
            error_only: body.error_only,
            max_lines: body.max_lines,
            metrics: body.metrics,
            pod_name: body.pod_name,
            severity: body.severity,
            source,
          },
          source,
          start_time: body.start_time,
          timestamp,
          total: items.length,
          items,
        };
      }
      if (method === 'POST' && route === '/rca/analyze')
        return {
          analysis_id: randomUUID(),
          analysis_metadata: analysisMetadata,
          anomalies: {},
          collection,
          confidence_score: 0,
          correlations: [],
          namespace,
          recommendations: [note],
          root_causes: [
            {
              affected_components: ['demo-web'],
              cause_type: 'simulated',
              confidence: 0,
              description: note,
              evidence: { source },
              recommendations: ['仅展示演示，不执行修复'],
            },
          ],
          source,
          status: 'degraded',
          time_window_hours: body.time_window_hours ?? 1,
          timestamp,
        };
      if (method === 'POST' && route === '/rca/quick-diagnosis')
        return {
          analysis_duration: 0,
          analysis_metadata: analysisMetadata,
          collection,
          critical_issues: [],
          diagnosis: note,
          issues: [],
          namespace,
          recommendations: [note],
          source,
          status: 'degraded',
          summary: note,
          timestamp,
          warnings: [],
        };
      if (method === 'POST' && route === '/rca/event-patterns')
        return {
          anomalous_events: [],
          namespace,
          patterns: [],
          source,
          summary: note,
          time_range_hours: body.hours ?? 1,
          timestamp,
          total_events: 1,
          trending_events: [],
        };
      if (method === 'POST' && route === '/rca/error-summary')
        return {
          error_categories: {},
          error_timeline: [],
          errors: [],
          namespace,
          source,
          summary: note,
          time_range_hours: body.hours ?? 1,
          timestamp,
          top_errors: [],
          total_errors: 0,
        };
      if (method === 'GET' && route === '/rca/cache/stats')
        return {
          available: false,
          healthy: false,
          hit_rate: 0,
          message: note,
          source,
          timestamp,
          total_keys: 0,
        };
      if (
        (method === 'DELETE' && route === '/rca/cache/clear') ||
        (method === 'POST' &&
          ['/rca/cache/clear/namespace', '/rca/cache/clear/operation'].includes(
            route,
          ))
      )
        return {
          cleared_count: 0,
          message: note,
          source,
          success: true,
          timestamp,
        };
    }
    if (service === 'autofix') {
      if (
        method === 'GET' &&
        [
          '/autofix/workflow/operations/00000000-0000-4000-8000-000000000001',
          '/autofix/workflow/plans/00000000-0000-4000-8000-000000000002',
        ].includes(route)
      )
        return {
          approval_state: 'voided',
          claimed_action_ids: [],
          created_at: timestamp,
          execution_summary: {
            audit_result_recorded: false,
            executed_actions: [],
            status: 'simulated',
          },
          operation_id: '00000000-0000-4000-8000-000000000001',
          plan_id: '00000000-0000-4000-8000-000000000002',
          reason: note,
          retry_safe: false,
          source,
          state: 'invalidated',
          updated_at: timestamp,
        };

      if (method === 'GET' && route === '/autofix/workflow/history')
        return {
          source,
          items: [
            {
              approval_state: 'voided',
              claimed_action_ids: [],
              created_at: timestamp,
              execution_summary: {
                audit_result_recorded: false,
                executed_actions: [],
                status: 'simulated',
              },
              operation_id: '00000000-0000-4000-8000-000000000001',
              plan_id: '00000000-0000-4000-8000-000000000002',
              reason: note,
              retry_safe: false,
              source,
              state: 'invalidated',
              updated_at: timestamp,
            },
          ],
        };
      if (method === 'POST' && route === '/autofix/workflow')
        return {
          agents_used: [],
          blocked_actions: [],
          candidate_actions: [],
          diagnosis: { source, summary: note },
          executed_actions: [],
          execution: { external_io: false, source },
          messages: [{ content: note, level: 'info', timestamp }],
          next_action: '本地演示禁止真实执行',
          operation_id: body.operation_id ?? randomUUID(),
          plan: {
            allowed_actions: [],
            blocked_actions: [],
            candidate_actions: [],
            plan_id: randomUUID(),
            summary: { message: note },
          },
          review: { source },
          source,
          status: 'blocked',
          timestamp,
          workflow_nodes: [],
        };
    }
  };
}
