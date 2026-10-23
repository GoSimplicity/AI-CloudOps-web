import type { FormInstance } from 'ant-design-vue';

import { mount, type VueWrapper } from '@vue/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { usePodPage } from '#/views/k8s/pod/Pod';
import TerminalConnect from '#/views/servicetree/TerminalConnect.vue';
import WebTerminal from '#/views/servicetree/WebTerminal.vue';

const { connections, access } = vi.hoisted(() => ({
  connections: vi.fn(),
  access: { accessToken: 'test.jwt.signature' },
}));
vi.mock('@vben/stores', () => ({ useAccessStore: () => access }));
vi.mock('@vben/hooks', () => ({ useAppConfig: () => ({ apiURL: '/api' }) }));
vi.mock('vue-router', () => ({
  useRoute: () => ({ params: { id: '42' }, query: { id: '42' } }),
  useRouter: () => ({ back: vi.fn(), push: vi.fn() }),
}));
vi.mock('#/api/request', () => ({
  requestClient: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
}));
vi.mock('xterm', () => ({
  Terminal: class {
    write = vi.fn();
    writeln = vi.fn();
    open = vi.fn();
    focus = vi.fn();
    loadAddon = vi.fn();
    onData = vi.fn();
    dispose = vi.fn();
  },
}));
vi.mock('xterm-addon-fit', () => ({
  FitAddon: class {
    fit = vi.fn();
  },
}));
vi.mock('xterm-addon-web-links', () => ({ WebLinksAddon: class {} }));

class TestSocket {
  static OPEN = 1;
  static CONNECTING = 0;
  static CLOSED = 3;
  readyState = TestSocket.CONNECTING;
  send = vi.fn();
  close = vi.fn();
  constructor(url: string, protocols: string[]) {
    connections(url, protocols);
  }
}
let wrapper: VueWrapper | undefined;
beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
  access.accessToken = 'test.jwt.signature';
  vi.stubGlobal('WebSocket', TestSocket);
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      disconnect() {}
      unobserve() {}
    },
  );
});
afterEach(() => {
  wrapper?.unmount();
  wrapper = undefined;
  document.body.innerHTML = '';
  vi.clearAllTimers();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

function expectHandshake(path: string) {
  expect(connections).toHaveBeenCalledTimes(1);
  const [url, protocols] = connections.mock.calls[0]!;
  expect(new URL(url).pathname).toBe(path);
  expect(new URL(url).search).toBe('');
  expect(url.includes(access.accessToken)).toBe(false);
  expect(protocols).toEqual([
    'cloudops-v1',
    `cloudops-auth.${access.accessToken}`,
  ]);
}

describe('三个终端客户端的握手契约', () => {
  it('本地主机终端仅通过子协议发送凭证', () => {
    wrapper = mount(WebTerminal);
    expectHandshake('/api/tree/local/terminal/42');
  });

  it('云主机终端仅通过子协议发送凭证', () => {
    wrapper = mount(TerminalConnect, {
      global: { config: { warnHandler: () => {} } },
    });
    expectHandshake('/api/tree/cloud/42/terminal');
  });

  it('Pod 终端通过实际连接入口遵守同一握手契约', async () => {
    const page = usePodPage();
    document.body.innerHTML = '<div id="terminal-container"></div>';
    page.currentOperationPod.value = {
      cluster_id: 1,
      name: 'web-pod',
      namespace: 'example',
      uid: 'uid',
      labels: '{}',
      annotations: '{}',
      status: 'Running',
      phase: 'Running',
      node_name: 'node',
      pod_ip: '',
      host_ip: '',
      qos_class: 'Burstable',
      restart_count: 0,
      ready: '1/1',
      service_account: 'default',
      restart_policy: 'Always',
      dns_policy: 'ClusterFirst',
      conditions: '[]',
      containers: '[]',
      init_containers: '[]',
      volumes: '[]',
      created_at: '',
      owner_references: '[]',
      resource_version: '1',
      generation: 1,
      spec: '{}',
    };
    page.execFormRef.value = {
      validate: vi.fn().mockResolvedValue(undefined),
    } as unknown as FormInstance;
    page.execFormModel.value.container = 'main';
    page.execFormModel.value.shell = '/bin/sh';
    await page.connectToTerminal();
    expectHandshake('/api/k8s/pod/1/example/web-pod/containers/main/exec');
    page.disconnectTerminal();
  });

  it('没有登录凭证时不创建连接', () => {
    access.accessToken = '';
    wrapper = mount(WebTerminal);
    expect(connections).not.toHaveBeenCalled();
  });
});
