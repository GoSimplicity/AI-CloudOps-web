export const timestamp = '2026-11-03T08:00:00Z';
export const cluster = {
  api_server_addr: 'https://demo.invalid',
  created_at: timestamp,
  env: 2,
  has_kube_config: false,
  id: 9001,
  name: 'demo-local-simulated',
  restrict_namespace: ['demo', 'default'],
  status: 1,
  tags: [{ key: 'source', value: 'simulated' }],
  updated_at: timestamp,
  version: 'v1.32.0 (simulated)',
};
const base = (name) => ({
  age: '1d',
  annotations: {},
  cluster_id: 9001,
  created_at: timestamp,
  labels: { app: 'demo-web', source: 'simulated' },
  name,
  namespace: 'demo',
  resource_version: 'simulated-1',
  source: 'simulated',
  uid: `simulated-${name}`,
  updated_at: timestamp,
});
const container = {
  args: [],
  command: [],
  envs: [],
  image: 'demo.invalid/web:simulated',
  image_pull_policy: 'IfNotPresent',
  name: 'web',
  ports: [{ container_port: 8080, name: 'http', protocol: 'TCP' }],
  ready: true,
  resources: {
    limits: { cpu: '500m', memory: '256Mi' },
    requests: { cpu: '100m', memory: '128Mi' },
  },
  restart_count: 0,
  state: { running: { started_at: timestamp } },
  volume_mounts: [],
};
const workload = {
  available_replicas: 3,
  conditions: [
    {
      message: '本地合成数据',
      reason: 'Simulated',
      status: 'True',
      type: 'Available',
    },
  ],
  current_replicas: 3,
  images: [container.image],
  ready_replicas: 3,
  replicas: 3,
  selector: { matchLabels: { app: 'demo-web' } },
  status: 1,
  strategy: 'RollingUpdate',
  updated_replicas: 3,
};
export const resources = {
  clusterrole: [
    {
      ...base('demo-cluster-reader'),
      namespace: undefined,
      rules: [
        { api_groups: [''], resources: ['nodes'], verbs: ['get', 'list'] },
      ],
    },
  ],
  clusterrolebinding: [
    {
      ...base('demo-cluster-binding'),
      namespace: undefined,
      role_ref: {
        api_group: 'rbac.authorization.k8s.io',
        kind: 'ClusterRole',
        name: 'demo-cluster-reader',
      },
      subjects: [
        { kind: 'ServiceAccount', name: 'demo-reader', namespace: 'demo' },
      ],
    },
  ],
  configmap: [
    {
      ...base('demo-web-config'),
      binary_data: {},
      data: { 'app.conf': 'mode=simulated\n' },
      data_count: 1,
      immutable: false,
      size: '15B',
    },
  ],
  daemonset: [
    {
      ...base('demo-agent'),
      ...workload,
      current_number_scheduled: 2,
      desired_number_scheduled: 2,
      number_available: 2,
      number_misscheduled: 0,
      number_ready: 2,
      number_unavailable: 0,
      updated_number_scheduled: 2,
    },
  ],
  deployment: [{ ...base('demo-web'), ...workload }],
  ingress: [
    {
      ...base('demo-web'),
      class_name: 'demo',
      hosts: ['web.demo.invalid'],
      ingress_class_name: 'demo',
      load_balancer: { ingress: [] },
      rules: [
        {
          host: 'web.demo.invalid',
          http: {
            paths: [
              {
                backend: {
                  service: { name: 'demo-web', port: { number: 80 } },
                },
                path: '/',
                path_type: 'Prefix',
              },
            ],
          },
        },
      ],
      status: 1,
      tls: [],
    },
  ],
  namespace: ['demo', 'default'].map((name) => ({
    ...base(name),
    namespace: undefined,
    phase: 'Active',
    status: 'Active',
  })),
  node: [1, 2].map((index) => ({
    ...base(`demo-node-${index}`),
    architecture: 'amd64',
    conditions: [{ reason: 'Simulated', status: 'True', type: 'Ready' }],
    container_runtime: 'containerd://simulated',
    external_ip: '',
    hostname: `demo-node-${index}`,
    internal_ip: `192.0.2.${index}`,
    kernel_version: 'simulated',
    kube_proxy_version: 'v1.32.0',
    kubelet_version: 'v1.32.0',
    namespace: undefined,
    operating_system: 'linux',
    os_image: 'Demo Linux',
    roles: ['worker'],
    schedulable: 1,
    status: 1,
    taints: [],
  })),
  pod: [1, 2, 3].map((index) => ({
    ...base(`demo-web-${index}`),
    annotations: '{}',
    conditions: JSON.stringify([{ status: 'True', type: 'Ready' }]),
    containers: JSON.stringify([container]),
    dns_policy: 'ClusterFirst',
    generation: 1,
    host_ip: `192.0.2.${(index % 2) + 1}`,
    init_containers: '[]',
    labels: JSON.stringify({ app: 'demo-web' }),
    node_name: `demo-node-${(index % 2) + 1}`,
    owner_references: '[]',
    phase: 'Running',
    pod_ip: `192.0.2.${10 + index}`,
    qos_class: 'Burstable',
    ready: '1/1',
    resource_version: 'demo-1',
    restart_count: 0,
    restart_policy: 'Always',
    service_account: 'demo-reader',
    spec: JSON.stringify({ containers: [container] }),
    status: 'Running',
    volumes: '[]',
  })),
  pv: [
    {
      ...base('demo-volume'),
      access_modes: ['ReadWriteOnce'],
      capacity: '10Gi',
      capacity_storage: '10Gi',
      claim: 'demo/demo-data',
      claim_ref: { name: 'demo-data', namespace: 'demo' },
      namespace: undefined,
      node_affinity: {},
      persistent_volume_reclaim_policy: 'Retain',
      phase: 'Bound',
      reclaim_policy: 'Retain',
      status: 2,
      storage_class: 'demo-storage',
      storage_class_name: 'demo-storage',
      volume_mode: 'Filesystem',
      volume_source: { host_path: { path: '/demo/simulated' } },
    },
  ],
  pvc: [
    {
      ...base('demo-data'),
      access_modes: ['ReadWriteOnce'],
      capacity: '10Gi',
      conditions: [],
      phase: 'Bound',
      request_storage: '10Gi',
      selector: {},
      status: 2,
      storage_class: 'demo-storage',
      storage_class_name: 'demo-storage',
      volume_mode: 'Filesystem',
      volume_name: 'demo-volume',
    },
  ],
  role: [
    {
      ...base('demo-reader'),
      rules: [
        { api_groups: [''], resources: ['pods'], verbs: ['get', 'list'] },
      ],
    },
  ],
  rolebinding: [
    {
      ...base('demo-reader-binding'),
      role_ref: {
        api_group: 'rbac.authorization.k8s.io',
        kind: 'Role',
        name: 'demo-reader',
      },
      subjects: [
        { kind: 'ServiceAccount', name: 'demo-reader', namespace: 'demo' },
      ],
    },
  ],
  secret: [
    {
      ...base('demo-placeholder'),
      data: {},
      data_count: 1,
      data_keys: [{ key: 'placeholder', size: 0 }],
      immutable: false,
      redacted: true,
      size: '0B',
      string_data: {},
      string_data_keys: [],
      type: 'Opaque',
    },
  ],
  service: [
    {
      ...base('demo-web'),
      cluster_ip: '192.0.2.100',
      endpoints: [
        { ip: '192.0.2.11', port: 8080, protocol: 'TCP', ready: true },
      ],
      external_ips: [],
      load_balancer_ip: '',
      ports: [{ name: 'http', port: 80, protocol: 'TCP', target_port: 8080 }],
      selector: { app: 'demo-web' },
      status: 1,
      type: 'ClusterIP',
    },
  ],
  serviceaccount: [
    {
      ...base('demo-reader'),
      automount_service_account_token: false,
      image_pull_secrets: [],
      secrets: [],
    },
  ],
  statefulset: [
    {
      ...base('demo-cache'),
      ...workload,
      pod_management_policy: 'OrderedReady',
      service_name: 'demo-cache',
      update_strategy: 'RollingUpdate',
    },
  ],
};
export function k8sResponse(method, url, page) {
  if (method !== 'GET') return;
  const path = url.pathname;
  const template = {
    cluster_id: 9001,
    content:
      '# SIMULATED: not applied\napiVersion: v1\nkind: ConfigMap\nmetadata:\n  name: demo-web-config\n  namespace: demo\ndata:\n  mode: simulated\n',
    created_at: timestamp,
    id: 9701,
    name: 'demo-config-template',
    updated_at: timestamp,
    user_id: 1,
    username: 'demo',
  };
  const task = {
    apply_result: '本地演示：未执行',
    cluster_id: 9001,
    created_at: timestamp,
    id: 9702,
    name: 'demo-not-executed',
    status: 'cancelled',
    template_id: 9701,
    updated_at: timestamp,
    user_id: 1,
    variables: [],
  };
  if (path === '/api/k8s/yaml_template/9001/list') return page([template], url);
  if (path === '/api/k8s/yaml_template/9001/9701/yaml') return template;
  if (path === '/api/k8s/yaml_task/9001/list') return page([task], url);
  if (path === '/api/k8s/yaml_task/9001/9702/detail') return task;
  if (path === '/api/k8s/cluster/list') return page([cluster], url);
  if (path === '/api/k8s/cluster/9001/detail') return cluster;
  const namespaceDetail =
    /^\/api\/k8s\/clusters\/9001\/namespace\/([^/]+)\/detail$/.exec(path);
  if (namespaceDetail)
    return resources.namespace.find((row) => row.name === namespaceDetail[1]);
  if (path === '/api/k8s/clusters/9001/namespace/list')
    return page(resources.namespace, url);
  const nodePods = /^\/api\/k8s\/pod\/9001\/node\/(demo-node-[12])\/pods$/.exec(
    path,
  );
  if (nodePods)
    return page(
      resources.pod.filter((pod) => pod.node_name === nodePods[1]),
      url,
    );
  const match = /^\/api\/k8s\/([a-z]+)\/9001\/(.+)$/.exec(path);
  if (!match) return;
  const kind = match[1];
  const rest = match[2];
  const items = resources[kind];
  if (!items) return;
  if (rest === 'list') return page(items, url);
  const row = items.find((item) =>
    rest.startsWith(
      `${item.namespace ? `${item.namespace}/` : ''}${item.name}/`,
    ),
  );
  if (!row) return;
  const prefix = `${row.namespace ? `${row.namespace}/` : ''}${row.name}/`;
  const action = rest.slice(prefix.length);
  if (
    ![
      'containers',
      'containers/web/logs',
      'detail',
      'detail/yaml',
      'endpoints',
      'events',
      'history',
      'metrics',
      'pods',
      'taints',
      'taints/list',
    ].includes(action)
  )
    return;
  if (rest.endsWith('/detail')) return row;
  if (rest.endsWith('/detail/yaml'))
    return {
      yaml: `# SIMULATED: not connected to a cluster\napiVersion: v1\nkind: ${kind}\nmetadata:\n  name: ${row.name}\n  namespace: demo\n`,
    };
  if (rest.endsWith('/events'))
    return [
      {
        count: 1,
        first_time: timestamp,
        last_time: timestamp,
        message: '本地演示事件，未连接集群',
        reason: 'Simulated',
        source: 'simulated',
        type: 'Normal',
      },
    ];
  if (rest.endsWith('/history'))
    return [
      { date: timestamp, message: '本地演示版本（不可真实回滚）', revision: 1 },
    ];
  if (kind === 'pod' && rest === `demo/${row.name}/containers/web/logs`)
    return '[SIMULATED] demo-web healthy; no external system connected';
  if (rest.endsWith('/containers')) return [container];
  if (action === 'pods') return page(resources.pod, url);
  if (kind === 'service' && action === 'endpoints') return row.endpoints;
  if (action === 'taints/list') return [];
  if (rest.endsWith('/taints')) return [];
  if (rest.endsWith('/metrics'))
    return {
      containers: [{ cpu_usage: '120m', memory_usage: '96Mi', name: 'web' }],
      cpu_usage: '120m',
      cpu_usage_percent: 24,
      memory_usage: '96Mi',
      memory_usage_percent: 37.5,
      source: 'simulated',
    };
}
