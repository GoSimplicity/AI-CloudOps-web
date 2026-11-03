import { timestamp } from './k8s.mjs';

const source = 'simulated';
const description = '本地演示合成资源；无凭据，不连接云平台';
const regions = [1, 2, 3, 4, 5, 6].map((provider) => ({
  cloud_account_id: 9100 + provider,
  create_user_id: 1,
  create_user_name: 'demo',
  created_at: timestamp,
  description,
  id: 9200 + provider,
  is_default: true,
  region: 'demo-region',
  region_name: '演示地域（合成）',
  source,
  status: 2,
  updated_at: timestamp,
}));
const accounts = regions.map((region, index) => ({
  account_id: `simulated-account-${index + 1}`,
  account_name: '演示账号',
  created_at: timestamp,
  credential_type: 'long_term',
  description,
  has_existing_credential: false,
  id: region.cloud_account_id,
  name: [
    '演示阿里云',
    '演示腾讯云',
    '演示AWS',
    '演示华为云',
    '演示Azure',
    '演示GCP',
  ][index],
  provider: index + 1,
  regions: [region],
  source,
  status: 2,
  updated_at: timestamp,
}));
const resource = {
  auth_mode: 2,
  cloud_account: accounts[0],
  cloud_account_id: 9101,
  cloud_account_region: regions[0],
  cloud_account_region_id: 9201,
  cpu: 2,
  create_user_id: 1,
  create_user_name: 'demo',
  created_at: timestamp,
  currency: 'CNY',
  description,
  disk: 40,
  environment: 'demo',
  has_existing_credential: false,
  id: 9301,
  instance_id: 'simulated-ecs-1',
  instance_type: 'demo.2c4g',
  memory: 4,
  monthly_cost: 0,
  name: 'demo-simulated-web',
  os_name: 'Demo Linux',
  os_type: 'linux',
  port: 22,
  private_ip: '192.0.2.22',
  public_ip: '192.0.2.21',
  region: 'demo-region',
  resource_type: 1,
  source,
  status: 1,
  tags: [{ key: 'source', value: source }],
  tree_nodes: [],
  updated_at: timestamp,
  username: 'demo',
};
const managed = ['rds', 'clb', 'cache'].map((kind, index) => {
  const item = {
    address_type: 'intranet',
    engine: 'MySQL',
    engine_version: 'demo',
    instance_class: 'demo',
    instance_id: `simulated-${kind}-1`,
    instance_type: 'Redis',
    name: `demo-${kind}`,
    region: 'demo-region',
    status: 'simulated',
    vpc_id: 'simulated-vpc',
    zone: 'demo-zone',
  };
  return {
    cloud_account_id: 9101,
    cloud_account_region_id: 9201,
    has_existing_credential: false,
    id: 9401 + index,
    kind,
    [kind]: item,
    last_sync_time: timestamp,
    local_description: description,
    provider_id: item.instance_id,
    source,
  };
});
const operations = managed.map((item) => ({
  cloud_account_id: 9101,
  cloud_account_region_id: 9201,
  created_at: timestamp,
  kind: item.kind,
  operation_id: `simulated-${item.kind}-operation`,
  owner_id: 1,
  resource_ids: [item.provider_id],
  result: {
    count: 0,
    error_category: 'simulated',
    new_count: 0,
    operation_id: `simulated-${item.kind}-operation`,
    retry_safe: false,
    status: 'cancelled',
    update_count: 0,
  },
  review_reason: description,
  source,
  state: 'reviewed',
  updated_at: timestamp,
}));
function scoped(items, url) {
  return items.filter((item) =>
    [
      'cloud_account_id',
      'cloud_account_region_id',
      'kind',
      'provider',
      'status',
    ].every(
      (field) =>
        !url.searchParams.has(field) ||
        String(item[field]) === url.searchParams.get(field),
    ),
  );
}
export function cloudResponse(method, url, page) {
  const path = url.pathname;
  if (method !== 'GET') return;
  if (path === '/api/tree/cloud/account/list')
    return page(scoped(accounts, url), url);
  if (path === '/api/tree/cloud/account/region/list')
    return page(scoped(regions, url), url);
  const account = /^\/api\/tree\/cloud\/account\/(\d+)\/detail$/.exec(path);
  if (account) return accounts.find((item) => item.id === Number(account[1]));
  const region = /^\/api\/tree\/cloud\/account\/region\/(\d+)\/detail$/.exec(
    path,
  );
  if (region) return regions.find((item) => item.id === Number(region[1]));
  if (path === '/api/tree/cloud/list')
    return page(scoped([resource], url), url);
  if (path === '/api/tree/cloud/9301/detail') return resource;
  if (path === '/api/tree/cloud/9301/node') return [];
  if (path === '/api/tree/cloud/managed/list')
    return page(scoped(managed, url), url);
  const detail = /^\/api\/tree\/cloud\/managed\/detail\/(\d+)$/.exec(path);
  if (detail)
    return scoped(managed, url).find((item) => item.id === Number(detail[1]));
  if (path === '/api/tree/cloud/managed/history')
    return page(
      scoped(managed, url).map((item) => ({
        cloud_account_id: item.cloud_account_id,
        cloud_account_region_id: item.cloud_account_region_id,
        count: 0,
        error_category: 'simulated',
        finished_at: timestamp,
        id: item.id,
        kind: item.kind,
        new_count: 0,
        operation_id: `simulated-${item.kind}-operation`,
        operator_id: 1,
        resolution_reason: description,
        resource_ids: [item.provider_id],
        retry_safe: false,
        source,
        started_at: timestamp,
        status: 'cancelled',
        update_count: 0,
      })),
      url,
    );
  if (path === '/api/tree/cloud/managed/operations')
    return { ...page(scoped(operations, url), url), scope_blocked: false };
  const operation =
    /^\/api\/tree\/cloud\/managed\/operations\/(simulated-(?:rds|clb|cache)-operation)$/.exec(
      path,
    );
  if (operation)
    return operations.find((item) => item.operation_id === operation[1]);
  if (path === '/api/tree/cloud/sync/history')
    return page(
      [
        {
          cloud_account_id: 9101,
          created_at: timestamp,
          delete_count: 0,
          duration: 0,
          end_time: timestamp,
          error_message: description,
          failed_count: 0,
          failed_instances: '',
          id: 9501,
          new_count: 0,
          region: 'demo-region',
          region_id: 9201,
          retry_safe: false,
          source,
          start_time: timestamp,
          sync_mode: 'full',
          sync_status: 'cancelled',
          total_count: 0,
          update_count: 0,
          updated_at: timestamp,
        },
      ],
      url,
    );
  if (path === '/api/tree/cloud/changelog')
    return page(
      [
        {
          change_source: source,
          change_time: timestamp,
          change_type: 'simulated',
          created_at: timestamp,
          field_name: 'description',
          id: 9601,
          instance_id: resource.instance_id,
          new_value: description,
          old_value: '',
          operator_id: 1,
          operator_name: 'demo',
          resource_id: 9301,
          source,
          updated_at: timestamp,
        },
      ],
      url,
    );
}
