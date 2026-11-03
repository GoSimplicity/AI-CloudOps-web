import { reactive } from 'vue';

import { DOMWrapper, flushPromises, mount } from '@vue/test-utils';
import Antd, { Form, message, Modal, Select } from 'ant-design-vue';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import MonitorScrapeJob from './MonitorScrapeJob.vue';
import MonitorScrapePool from './MonitorScrapePool.vue';

const client = vi.hoisted(() => ({
  delete: vi.fn(),
  get: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
}));
const state = vi.hoisted(() => ({
  flags: { create: true, delete: true, detail: true, update: true } as Record<
    string,
    boolean
  >,
  generation: 0,
  kind: 'Job',
  rows: [] as ReturnType<typeof record>[],
  user: { userInfo: { userId: '1' } } as {
    userInfo: { userId: string } | null;
  },
}));
vi.mock('#/api/request', () => ({ requestClient: client }));
vi.mock('@vben/stores', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@vben/stores')>()),
  useUserStore: () => state.user,
}));
vi.mock('#/store', () => ({
  useAuthStore: () => ({ getAuthGeneration: () => state.generation }),
}));
vi.mock('#/utils/permission', () => ({
  usePermission: () => ({
    can: () => state.flags.delete,
    hasPerm: (code: string) => {
      const action = ['create', 'update', 'detail'].find((value) =>
        code.includes(`/${value}`),
      );
      return action ? (state.flags[action] ?? false) : false;
    },
  }),
}));

function required<T>(value: null | T | undefined): T {
  if (value === null || value === undefined)
    throw new Error('Expected scrape configuration fixture');
  return value;
}
function record(id = 7, name = 'fixture-config') {
  return {
    enable: 1,
    has_bearer_token: true,
    id,
    ip_address: '',
    metrics_path: '/metrics',
    name,
    pool_id: 3,
    port: 9100,
    prometheus_instances: ['127.0.0.1'],
    refresh_interval: 30,
    relabel_configs_yaml_string: '[]',
    remote_timeout_seconds: 0,
    scheme: 'http',
    scrape_interval: 15,
    scrape_timeout: 5,
    service_discovery_type: 2,
    support_alert: 1,
    support_record: 2,
    tags: ['fixture'],
    user_id: 1,
  };
}
function deferred<T>() {
  let complete: ((value: T) => void) | undefined;
  let fail: ((error: Error) => void) | undefined;
  const promise = new Promise<T>((resolve, reject) => {
    complete = resolve;
    fail = reject;
  });
  return {
    promise,
    reject() {
      required(fail)(new Error('private-scrape-fixture'));
    },
    resolve(value: T) {
      required(complete)(value);
    },
  };
}

const cases = [
  {
    component: MonitorScrapeJob,
    kind: 'Job',
    noun: '采集任务',
    path: 'scrape_jobs',
  },
  {
    component: MonitorScrapePool,
    kind: 'Pool',
    noun: '采集池',
    path: 'scrape_pools',
  },
];
let wrapper: ReturnType<typeof mount> | undefined;
function row(id = 7) {
  return required(wrapper).get(`tr[data-row-key="${id}"]`);
}
async function click(text: string, selector = 'button') {
  await flushPromises();
  const target = [...document.querySelectorAll<HTMLButtonElement>(selector)]
    .reverse()
    .find((item) => item.textContent?.replace(/\s/g, '') === text);
  required(target).click();
  await flushPromises();
}
async function rowClick(text: string, id = 7) {
  const button = row(id)
    .findAll('button')
    .find((item) => item.text().replaceAll(/\s/g, '') === text);
  await required(button).trigger('click');
  await flushPromises();
}
function formModal() {
  return required(
    required(wrapper)
      .findAllComponents(Modal)
      .find(
        (item) =>
          String(item.props('title')).startsWith('编辑') ||
          String(item.props('title')).startsWith('创建'),
      ),
  );
}
function detailModal() {
  return required(
    required(wrapper)
      .findAllComponents(Modal)
      .find((item) => String(item.props('title')).endsWith('详情')),
  );
}
async function save() {
  formModal().vm.$emit('ok');
  await flushPromises();
}
async function closeForm() {
  formModal().vm.$emit('cancel');
  await flushPromises();
}
async function closeDetail() {
  detailModal().vm.$emit('cancel');
  await flushPromises();
}
async function fill(placeholder: string, value: string) {
  const input = required(
    document.querySelector<HTMLInputElement>(
      `input[placeholder="${placeholder}"]`,
    ),
  );
  await new DOMWrapper(input).setValue(value);
}
function validation(promise: Promise<Record<string, unknown>>) {
  const form = required(wrapper).findComponent(Form);
  return vi
    .spyOn(required(form.vm.$.exposed), 'validate')
    .mockImplementationOnce(() => promise);
}
function ownerChange(uid = '2') {
  state.generation++;
  state.user.userInfo = null;
  state.user.userInfo = { userId: uid };
}
async function confirmDelete() {
  await required(
    row()
      .findAll('button')
      .find((item) => item.text().includes('更多')),
  ).trigger('mouseenter');
  await new Promise((resolve) => setTimeout(resolve, 180));
  await click('删除', '.ant-dropdown-menu-item');
}
async function accept() {
  const onOk = required(vi.mocked(Modal.confirm).mock.calls.at(-1)?.[0]).onOk;
  if (typeof onOk !== 'function')
    throw new Error('Expected delete confirmation');
  await onOk(() => {});
}
beforeEach(() => {
  vi.resetAllMocks();
  state.generation = 0;
  state.kind = 'Job';
  state.user = reactive({ userInfo: { userId: '1' } });
  state.flags = reactive({
    create: true,
    delete: true,
    detail: true,
    update: true,
  });
  state.rows = [record()];
  client.get.mockImplementation(async (path: string) => {
    if (path.includes('/detail/'))
      return {
        ...required(
          state.rows.find((item) => item.id === Number(path.split('/').at(-1))),
        ),
      };
    if (
      path ===
      `/monitor/${state.kind === 'Job' ? 'scrape_jobs' : 'scrape_pools'}/list`
    )
      return {
        total: state.rows.length,
        items: state.rows.map((item) => ({ ...item })),
      };
    if (path === '/monitor/scrape_pools/list')
      return { total: 1, items: [{ id: 3, name: 'fixture-pool' }] };
    return { total: 0, items: [] };
  });
  client.post.mockResolvedValue({});
  client.put.mockResolvedValue({});
  client.delete.mockResolvedValue({});
  vi.spyOn(Modal, 'confirm').mockImplementation(() => ({
    destroy: vi.fn(),
    update: vi.fn(),
  }));
  vi.spyOn(message, 'success');
  vi.spyOn(message, 'error');
  vi.stubGlobal(
    'matchMedia',
    vi.fn(() => ({
      addListener: vi.fn(),
      matches: false,
      removeListener: vi.fn(),
    })),
  );
  const style = window.getComputedStyle;
  vi.spyOn(window, 'getComputedStyle').mockImplementation((element) =>
    style(element),
  );
});
afterEach(() => {
  wrapper?.unmount();
  wrapper = undefined;
  message.destroy();
  Modal.destroyAll();
  document.body.innerHTML = '';
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

for (const testCase of cases) {
  describe(`${testCase.noun}真实表单与操作作用域`, () => {
    async function start() {
      state.kind = testCase.kind;
      wrapper = mount(testCase.component, {
        attachTo: document.body,
        global: { plugins: [Antd], stubs: { Icon: true } },
      });
      await flushPromises();
    }

    it.each(['', '   '])(
      '真实validate拒绝空名称%j，合法的1字符名称按Go DTO通过',
      async (name) => {
        await start();
        await rowClick('编辑');
        await fill(`请输入${testCase.noun}名称`, name);
        await save();
        expect(client.put).not.toHaveBeenCalled();
        expect(document.body.textContent).toContain(
          `请输入${testCase.noun}名称`,
        );
        await fill(`请输入${testCase.noun}名称`, 'x');
        await save();
        expect(client.put).toHaveBeenCalledWith(
          `/monitor/${testCase.path}/update/7`,
          expect.objectContaining({ id: 7, name: 'x' }),
        );
      },
    );

    it('合法edit仅执行一次validate和API，提交时不借当前表单目标', async () => {
      await start();
      await rowClick('编辑');
      const pending = deferred<Record<string, unknown>>();
      const validate = validation(pending.promise);
      await save();
      await save();
      expect(validate).toHaveBeenCalledTimes(1);
      expect(client.put).not.toHaveBeenCalled();
      pending.resolve({});
      await flushPromises();
      expect(client.put).toHaveBeenCalledTimes(1);
      expect(client.put).toHaveBeenCalledWith(
        `/monitor/${testCase.path}/update/7`,
        expect.objectContaining({ id: 7 }),
      );
    });

    it.each([
      'draft',
      'owner',
      'same-user-login',
      'permission',
      'close-reopen',
      'unmount',
    ])('validate在%s变化后迟到不得写API', async (change) => {
      await start();
      await rowClick('编辑');
      const pending = deferred<Record<string, unknown>>();
      validation(pending.promise);
      await save();
      if (change === 'draft')
        await fill(`请输入${testCase.noun}名称`, 'edited-during-validation');
      if (change === 'owner') ownerChange();
      if (change === 'same-user-login') ownerChange('1');
      if (change === 'permission') state.flags.update = false;
      if (change === 'close-reopen') {
        await closeForm();
        await rowClick('编辑');
      }
      if (change === 'unmount') required(wrapper).unmount();
      pending.resolve({});
      await flushPromises();
      expect(client.put).not.toHaveBeenCalled();
      expect(client.post).not.toHaveBeenCalled();
      expect(message.success).not.toHaveBeenCalled();
    });

    it.each(['success', 'failure'])(
      'aPI迟到%s不关闭同目标新窗口或清掉新提交loading',
      async (outcome) => {
        await start();
        await rowClick('编辑');
        const latest = deferred<object>();
        const old = deferred<object>();
        client.put
          .mockReturnValueOnce(old.promise)
          .mockReturnValueOnce(latest.promise);
        await save();
        await closeForm();
        await rowClick('编辑');
        await save();
        expect(formModal().props('confirmLoading')).toBe(true);
        if (outcome === 'success') old.resolve({});
        else old.reject();
        await flushPromises();
        expect(formModal().props('open')).toBe(true);
        expect(formModal().props('confirmLoading')).toBe(true);
        expect(message.success).not.toHaveBeenCalled();
        expect(message.error).not.toHaveBeenCalled();
        latest.resolve({});
        await flushPromises();
        expect(formModal().props('open')).toBe(false);
      },
    );

    it.each(['success', 'failure'])(
      '详情旧%s不能替换新目标或关闭新窗口',
      async (outcome) => {
        state.rows = [record(), record(8, 'new-detail')];
        await start();
        const old = deferred<object>();
        const normal = required(client.get.getMockImplementation());
        client.get.mockImplementation((path: string) =>
          path.endsWith('/detail/7') ? old.promise : normal(path),
        );
        await rowClick('查看');
        await closeDetail();
        await rowClick('查看', 8);
        if (outcome === 'success') old.resolve(record(7, 'old-private-detail'));
        else old.reject();
        await flushPromises();
        expect(detailModal().props('open')).toBe(true);
        expect(document.body.textContent).toContain('new-detail');
        expect(document.body.textContent).not.toContain('old-private-detail');
        expect(message.error).not.toHaveBeenCalled();
      },
    );

    it.each(['owner', 'same-user-login', 'permission', 'reload', 'unmount'])(
      '删除确认%s变化后不外发',
      async (change) => {
        await start();
        await confirmDelete();
        if (change === 'owner') ownerChange();
        if (change === 'same-user-login') ownerChange('1');
        if (change === 'permission') state.flags.delete = false;
        if (change === 'reload') await click('重置');
        if (change === 'unmount') required(wrapper).unmount();
        await accept();
        expect(client.delete).not.toHaveBeenCalled();
      },
    );

    it('删除在途重复确认只有一次，回执按原HTTP合同处理', async () => {
      await start();
      await confirmDelete();
      const pending = deferred<object>();
      client.delete.mockReturnValueOnce(pending.promise);
      const first = accept();
      await accept();
      expect(client.delete).toHaveBeenCalledTimes(1);
      expect(client.delete).toHaveBeenCalledWith(
        `/monitor/${testCase.path}/delete/7`,
      );
      pending.resolve({});
      await first;
    });

    it.each([
      0,
      -1,
      1.5,
      Number.NaN,
      Number.POSITIVE_INFINITY,
      Number.MAX_SAFE_INTEGER + 1,
    ])('非法id %s不能详情/编辑/删除', async (id) => {
      state.rows = [{ ...record(), id }];
      await start();
      const buttons = required(wrapper).findAll('button');
      await required(
        buttons.find((item) => item.text().replaceAll(/\s/g, '') === '查看'),
      ).trigger('click');
      await required(
        buttons.find((item) => item.text().replaceAll(/\s/g, '') === '编辑'),
      ).trigger('click');
      expect(formModal().props('open')).toBe(false);
      expect(
        client.get.mock.calls.some(([path]) =>
          String(path).includes('/detail/'),
        ),
      ).toBe(false);
      expect(client.put).not.toHaveBeenCalled();
      await required(
        buttons.find((item) => item.text().includes('更多')),
      ).trigger('mouseenter');
      await new Promise((resolve) => setTimeout(resolve, 180));
      await click('删除', '.ant-dropdown-menu-item');
      expect(Modal.confirm).not.toHaveBeenCalled();
      expect(client.delete).not.toHaveBeenCalled();
    });

    it('真实create表单完成必填值后走创建接口，不携带编辑ID', async () => {
      await start();
      await click(`创建${testCase.noun}`);
      await fill(`请输入${testCase.noun}名称`, 'created-config');
      if (testCase.kind === 'Job') {
        const pool = required(
          required(wrapper)
            .findAllComponents(Select)
            .find(
              (item) => item.props('placeholder') === '请搜索并选择关联采集池',
            ),
        );
        pool.vm.$emit('update:value', 3);
        await flushPromises();
      } else await fill('请输入Prometheus实例地址', '127.0.0.1');
      await save();
      expect(client.post).toHaveBeenCalledWith(
        `/monitor/${testCase.path}/create`,
        expect.objectContaining({ name: 'created-config' }),
      );
      expect(required(client.post.mock.calls.at(-1))[1]).not.toHaveProperty(
        'id',
      );
      expect(client.put).not.toHaveBeenCalled();
    });

    it.each(['success', 'failure'])(
      '旧owner API %s不能关闭新owner表单或刷新新列表',
      async (outcome) => {
        await start();
        await rowClick('编辑');
        const pending = deferred<object>();
        client.put.mockReturnValueOnce(pending.promise);
        await save();
        ownerChange();
        state.rows = [record(7, 'new-owner-config')];
        await click('重置');
        await rowClick('编辑');
        const reads = client.get.mock.calls.length;
        if (outcome === 'success') pending.resolve({});
        else pending.reject();
        await flushPromises();
        expect(formModal().props('open')).toBe(true);
        expect(
          document.querySelector<HTMLInputElement>(
            `input[placeholder="请输入${testCase.noun}名称"]`,
          )?.value,
        ).toBe('new-owner-config');
        expect(client.get).toHaveBeenCalledTimes(reads);
        expect(message.success).not.toHaveBeenCalled();
        expect(message.error).not.toHaveBeenCalled();
      },
    );

    it('当前服务失败只显示固定提示，不回显配置或凭据错误', async () => {
      await start();
      await rowClick('编辑');
      client.put.mockRejectedValueOnce(new Error('private-scrape-fixture'));
      await save();
      expect(message.error).toHaveBeenCalledWith(`保存${testCase.noun}失败`);
      expect(document.body.textContent).not.toContain('private-scrape-fixture');
    });
  });
}

describe('采集任务认证及默认值合同', () => {
  async function editJob() {
    state.kind = 'Job';
    wrapper = mount(MonitorScrapeJob, {
      attachTo: document.body,
      global: { plugins: [Antd], stubs: { Icon: true } },
    });
    await flushPromises();
    await rowClick('编辑');
  }
  it('保留Go Port/timing/refresh的0默认合同，不把已配置Token重传', async () => {
    state.rows = [
      {
        ...record(),
        port: 0,
        refresh_interval: 0,
        scrape_interval: 0,
        scrape_timeout: 0,
      },
    ];
    await editJob();
    await save();
    expect(client.put).toHaveBeenCalledWith(
      '/monitor/scrape_jobs/update/7',
      expect.objectContaining({
        port: 0,
        refresh_interval: 0,
        scrape_interval: 0,
        scrape_timeout: 0,
      }),
    );
    expect(required(client.put.mock.calls.at(-1))[1]).not.toHaveProperty(
      'bearer_token',
    );
  });
  it.each([0, 3, -1])('未知enable %s不会静默变成启用或禁用', async (enable) => {
    state.rows = [{ ...record(), enable }];
    state.kind = 'Job';
    wrapper = mount(MonitorScrapeJob, {
      attachTo: document.body,
      global: { plugins: [Antd], stubs: { Icon: true } },
    });
    await flushPromises();
    await rowClick('编辑');
    expect(formModal().props('open')).toBe(false);
    expect(client.put).not.toHaveBeenCalled();
  });
  it('tLS CA内容与文件互斥，不触发API', async () => {
    await editJob();
    const form = required(wrapper).findComponent(Form);
    const exposed = required(form.vm.$.exposed);
    const model = form.props('model');
    expect(model).toBeDefined();
    Object.assign(required(model), {
      tls_ca_content: 'public-ca',
      tls_ca_file_path: '/fixture/public-ca.pem',
    });
    expect(exposed.validate).toBeTypeOf('function');
    await save();
    expect(client.put).not.toHaveBeenCalled();
    expect(message.error).toHaveBeenCalledWith(
      'TLS CA内容和文件路径只能配置一种',
    );
  });
});

describe('采集任务Token校验指纹', () => {
  async function editJob() {
    state.kind = 'Job';
    wrapper = mount(MonitorScrapeJob, {
      attachTo: document.body,
      global: { plugins: [Antd], stubs: { Icon: true } },
    });
    await flushPromises();
    await rowClick('编辑');
  }

  it('validate期间改变Bearer更新动作不会借旧校验清除Token', async () => {
    await editJob();
    const pending = deferred<Record<string, unknown>>();
    validation(pending.promise);
    await save();
    const radio = required(
      document.querySelector<HTMLInputElement>(
        'input[type="radio"][value="clear"]',
      ),
    );
    await new DOMWrapper(radio).setValue(true);
    pending.resolve({});
    await flushPromises();
    expect(client.put).not.toHaveBeenCalled();
    await save();
    expect(required(client.put.mock.calls.at(-1))[1]).toHaveProperty(
      'bearer_token',
      '',
    );
  });

  it('owner变化关闭表单并清除用户显式输入的Token，迟到validate不外发', async () => {
    await editJob();
    const radio = required(
      document.querySelector<HTMLInputElement>(
        'input[type="radio"][value="replace"]',
      ),
    );
    await new DOMWrapper(radio).setValue(true);
    await fill('请输入新的Bearer Token', 'fixture-user-entered-token');
    const pending = deferred<Record<string, unknown>>();
    validation(pending.promise);
    await save();
    ownerChange();
    await flushPromises();
    expect(formModal().props('open')).toBe(false);
    expect(
      [...document.querySelectorAll<HTMLInputElement>('input')].map(
        (item) => item.value,
      ),
    ).not.toContain('fixture-user-entered-token');
    pending.resolve({});
    await flushPromises();
    expect(client.put).not.toHaveBeenCalled();
    expect(client.post).not.toHaveBeenCalled();
  });
});

describe('static单目标地址的已发布合同', () => {
  const addresses = [
    '127.0.0.1',
    'prometheus.internal',
    '127.0.0.1:45678',
    'exporter.internal:9100',
    '[::1]:9100',
    '2001:db8::1',
    '[::1]',
    '[2001:db8::1]:0',
  ];
  for (const mode of ['create', 'edit'] as const) {
    async function open(address = '') {
      state.kind = 'Job';
      state.rows = [
        {
          ...record(),
          ip_address: address,
          scheme: 'https',
          service_discovery_type: 3,
        },
      ];
      wrapper = mount(MonitorScrapeJob, {
        attachTo: document.body,
        global: { plugins: [Antd], stubs: { Icon: true } },
      });
      await flushPromises();
      if (mode === 'edit') await rowClick('编辑');
      else {
        await click('创建采集任务');
        await fill('请输入采集任务名称', 'static-created');
        const selects = required(wrapper).findAllComponents(Select);
        required(
          selects.find(
            (item) => item.props('placeholder') === '请选择服务发现类型',
          ),
        ).vm.$emit('update:value', 3);
        required(
          selects.find(
            (item) => item.props('placeholder') === '请搜索并选择关联采集池',
          ),
        ).vm.$emit('update:value', 3);
        await flushPromises();
        await fill('请输入单个主机或IP地址，可带端口', address);
      }
    }
    it.each(addresses)(
      `${mode}保留合法目标%s的原文及独立port字段，不自动拼接`,
      async (address) => {
        await open(address);
        await save();
        const request = mode === 'edit' ? client.put : client.post;
        expect(request).toHaveBeenCalledTimes(1);
        const body = required(request.mock.calls.at(-1))[1];
        expect(body.ip_address).toBe(address);
        expect(body.port).toBe(9100);
        if (mode === 'edit') expect(body.scheme).toBe('https');
        expect(document.body.textContent).not.toContain(
          'private-scrape-fixture',
        );
      },
    );
    it.each([
      '',
      'http://127.0.0.1:9100',
      'host/path',
      'host?query',
      'host#fragment',
      'user:pass@host:9100',
      'host:-1',
      'host:65536',
      'host:1.5',
      'host:bad',
      'host:',
      '[::1',
      'host one',
      'host1,host2',
      String.raw`host\path`,
    ])(`${mode}坏目标格式%j不发API`, async (address) => {
      await open(address);
      await save();
      expect(client.put).not.toHaveBeenCalled();
      expect(client.post).not.toHaveBeenCalled();
    });
  }
});

describe('采集池时序与UID合同', () => {
  it('空白实例不能在过滤后变成空列表写入', async () => {
    state.kind = 'Pool';
    state.rows = [{ ...record(), prometheus_instances: ['   '] }];
    wrapper = mount(MonitorScrapePool, {
      attachTo: document.body,
      global: { plugins: [Antd], stubs: { Icon: true } },
    });
    await flushPromises();
    await rowClick('编辑');
    await save();
    expect(client.put).not.toHaveBeenCalled();
    expect(document.body.textContent).toContain('请输入Prometheus实例地址');
  });
  it.each([
    [0, 5],
    [15, 0],
    [5, 15],
  ])(
    'go已拒绝的interval=%s timeout=%s不外发',
    async (scrape_interval, scrape_timeout) => {
      state.kind = 'Pool';
      state.rows = [{ ...record(), scrape_interval, scrape_timeout }];
      wrapper = mount(MonitorScrapePool, {
        attachTo: document.body,
        global: { plugins: [Antd], stubs: { Icon: true } },
      });
      await flushPromises();
      await rowClick('编辑');
      await save();
      expect(client.put).not.toHaveBeenCalled();
    },
  );
  it('使用当前numeric UID取代硬编码1，保留remote timeout=0', async () => {
    state.kind = 'Pool';
    state.user.userInfo = { userId: '2' };
    wrapper = mount(MonitorScrapePool, {
      attachTo: document.body,
      global: { plugins: [Antd], stubs: { Icon: true } },
    });
    await flushPromises();
    await rowClick('编辑');
    await save();
    expect(client.put).toHaveBeenCalledWith(
      '/monitor/scrape_pools/update/7',
      expect.objectContaining({ remote_timeout_seconds: 0, user_id: 2 }),
    );
  });
});
