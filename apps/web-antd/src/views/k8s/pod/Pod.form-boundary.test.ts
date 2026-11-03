import {
  DOMWrapper,
  flushPromises,
  mount,
  type VueWrapper,
} from '@vue/test-utils';
import Antd from 'ant-design-vue';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';

import Pod from './Pod.vue';

const client = vi.hoisted(() => ({
  delete: vi.fn(),
  get: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
}));
vi.mock('#/api/request', () => ({
  notifyStreamLoginExpired: vi.fn(),
  refreshAccessTokenForStream: vi.fn(),
  requestClient: client,
}));
vi.mock('@vben/stores', () => ({
  useAccessStore: () => ({ accessToken: 'fixture' }),
}));
vi.mock('@vben/hooks', () => ({ useAppConfig: () => ({ apiURL: '/api' }) }));
vi.mock('#/utils/permission', async (original) => ({
  ...(await original<typeof import('#/utils/permission')>()),
  usePermission: () => ({ can: () => true, hasPerm: () => true }),
}));
vi.mock('xterm', () => ({ Terminal: vi.fn() }));
vi.mock('xterm-addon-fit', () => ({ FitAddon: vi.fn() }));
vi.mock('xterm-addon-web-links', () => ({ WebLinksAddon: vi.fn() }));
vi.mock('xterm/css/xterm.css', () => ({}));

let wrapper: undefined | VueWrapper;
function required<T>(value: null | T | undefined): T {
  if (value === null || value === undefined)
    throw new Error('Required Pod form fixture is unavailable');
  return value;
}
beforeEach(() => {
  vi.clearAllMocks();
  client.get.mockResolvedValue({ total: 0, items: [] });
  vi.stubGlobal('matchMedia', () => ({
    addListener: vi.fn(),
    matches: false,
    removeListener: vi.fn(),
  }));
  const getStyle = window.getComputedStyle;
  vi.spyOn(window, 'getComputedStyle').mockImplementation((element) =>
    getStyle(element),
  );
});
afterEach(() => {
  wrapper?.unmount();
  wrapper = undefined;
  document.body.innerHTML = '';
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

it('edits resources missing from a valid container without rendering failure or creating a Pod', async () => {
  wrapper = mount(Pod, {
    attachTo: document.body,
    global: { plugins: [Antd] },
  });
  await flushPromises();
  const setup = Reflect.get(wrapper.vm.$, 'setupState');
  const model = Reflect.get(setup, 'createFormModel');
  const containers = Reflect.get(model, 'containers');
  if (!Array.isArray(containers))
    throw new TypeError('Pod containers fixture is unavailable');
  const container = required(containers[0]);
  Reflect.deleteProperty(container, 'resources');
  Reflect.set(setup, 'isCreateModalVisible', true);
  await flushPromises();
  await new DOMWrapper(
    required(
      document.querySelector<HTMLInputElement>(
        'input[placeholder="CPU (如 100m)"]',
      ),
    ),
  ).setValue('250m');
  await new DOMWrapper(
    required(
      document.querySelector<HTMLInputElement>(
        'input[placeholder="内存 (如 512Mi)"]',
      ),
    ),
  ).setValue('1Gi');
  expect(container).toHaveProperty('resources.requests.cpu', '250m');
  expect(container).toHaveProperty('resources.limits.memory', '1Gi');
  expect(container).toHaveProperty('resources.requests.memory', '');
  expect(client.post).not.toHaveBeenCalled();
});

it('rejects resource updates for a removed container and non-string input', async () => {
  wrapper = mount(Pod, {
    attachTo: document.body,
    global: { plugins: [Antd] },
  });
  await flushPromises();
  const setup = Reflect.get(wrapper.vm.$, 'setupState');
  const model = Reflect.get(setup, 'createFormModel');
  const containers = Reflect.get(model, 'containers');
  if (!Array.isArray(containers))
    throw new TypeError('Pod containers fixture is unavailable');
  const container = required(containers[0]);
  const update = Reflect.get(setup, 'updateContainerResource');
  expect(update).toBeTypeOf('function');
  update(container, 'requests', 'cpu', 123);
  expect(container).toHaveProperty('resources.requests.cpu', '');
  Reflect.set(model, 'containers', []);
  update(container, 'limits', 'memory', '2Gi');
  expect(container).toHaveProperty('resources.limits.memory', '');
  expect(client.post).not.toHaveBeenCalled();
});
