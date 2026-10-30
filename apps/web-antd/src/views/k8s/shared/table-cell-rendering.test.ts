import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';

import {
  DeleteOutlined,
  EditOutlined,
  EyeOutlined,
  FileTextOutlined,
  PauseCircleOutlined,
  PlayCircleOutlined,
  PlaySquareOutlined,
} from '@ant-design/icons-vue';
import { mount } from '@vue/test-utils';
import Antd from 'ant-design-vue';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { defineComponent } from 'vue';
import { compileTemplate, parse } from 'vue/compiler-sfc';
import ts from 'typescript';

const require = createRequire(import.meta.url);
const vueRequire = createRequire(require.resolve('vue'));
const { parse: parseDOM } = vueRequire('@vue/compiler-dom');
const views = resolve(import.meta.dirname, '../..');
const wrappers: ReturnType<typeof mount>[] = [];

// Exercise the actual page slot with real Ant Table cells. Page APIs and cluster
// connections are intentionally absent; data and handlers are isolated fixtures.
function mountCells(
  page: string,
  tableIndex: number,
  columns: object[],
  record: object,
  scope: object = {},
) {
  const filename = resolve(views, page);
  const template = parse(readFileSync(filename, 'utf8')).descriptor.template!;
  const tables: any[] = [];
  const visit = (node: any) => {
    if (node.type === 1 && node.tag === 'a-table') tables.push(node);
    node.children?.forEach(visit);
  };
  visit(parseDOM(template.content));
  const cell = tables[tableIndex].children.find(
    (node: any) =>
      node.type === 1 &&
      node.props.some(
        (prop: any) =>
          prop.type === 7 &&
          prop.name === 'slot' &&
          prop.arg?.content === 'bodyCell',
      ),
  );
  expect(cell, `${page} table ${tableIndex} bodyCell`).toBeDefined();
  const compiled = compileTemplate({
    source: `<a-table :columns="testColumns" :data-source="testRecords" row-key="id" :pagination="false">${cell.loc.source}</a-table>`,
    filename,
    id: 'table-cell-regression',
  });
  expect(compiled.errors).toEqual([]);
  const js = ts.transpileModule(compiled.code, {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  }).outputText;
  const output: { render?: any } = {};
  new Function('require', 'exports', js)(require, output);
  const wrapper = mount(
    defineComponent({
      render: output.render,
      setup: () => ({ testColumns: columns, testRecords: [record], ...scope }),
    }),
    {
      global: {
        plugins: [Antd],
        components: {
          DeleteOutlined,
          EditOutlined,
          EyeOutlined,
          FileTextOutlined,
          PauseCircleOutlined,
          PlayCircleOutlined,
          PlaySquareOutlined,
        },
      },
    },
  );
  wrappers.push(wrapper);
  return wrapper;
}

beforeEach(() => {
  const computedStyle = window.getComputedStyle.bind(window);
  vi.stubGlobal('getComputedStyle', (element: Element) =>
    computedStyle(element),
  );
  vi.stubGlobal(
    'matchMedia',
    vi.fn(() => ({
      matches: false,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  );
});
afterEach(() => {
  wrappers.splice(0).forEach((wrapper) => wrapper.unmount());
  vi.unstubAllGlobals();
});

describe('Ant Table bodyCell migration', () => {
  it('Service dynamic ports retain named formatting and default/customRender fallbacks', () => {
    const wrapper = mountCells(
      'k8s/service/Service.vue',
      1,
      [
        { key: 'name', dataIndex: 'name' },
        { key: 'protocol', dataIndex: 'protocol' },
        { key: 'node_port', dataIndex: 'node_port' },
        { key: 'port', dataIndex: 'port' },
        {
          key: 'target_port',
          dataIndex: 'target_port',
          customRender: ({ text }: any) => `target:${text}`,
        },
      ],
      {
        id: 1,
        name: '',
        protocol: '',
        node_port: 0,
        port: 8080,
        target_port: 9090,
      },
    );
    expect(wrapper.findAll('tbody td').map((cell) => cell.text())).toEqual([
      '-',
      'TCP',
      '-',
      '8080',
      'target:9090',
    ]);
  });

  it('Cron combines record and text for last result and binds action to the same row', async () => {
    const showJobDetail = vi.fn();
    const record = {
      id: 7,
      last_run_time: 'fixture-time',
      last_run_status: 2,
      status: 1,
    };
    const wrapper = mountCells(
      'cron/management/Management.vue',
      0,
      [
        { key: 'last_run_status', dataIndex: 'last_run_status' },
        { key: 'action' },
      ],
      record,
      {
        getLastRunStatusColor: () => 'error',
        getLastRunStatusText: (value: number) => `result:${value}`,
        isLocalExecLocked: () => false,
        CronJobStatus: { ENABLED: 1, DISABLED: 2 },
        can: () => false,
        showJobDetail,
      },
    );
    expect(wrapper.find('tbody').text()).toContain('result:2');
    expect(wrapper.findAll('tbody button')).toHaveLength(3);
    await wrapper.find('tbody button').trigger('click');
    expect(showJobDetail).toHaveBeenCalledWith(record);
  });

  it.each([false, true])(
    'Secret preserves explicit permission gate: detail allowed=%s',
    async (allowed) => {
      const detail = vi.fn();
      const record = { id: 1, name: 'fake-secret' };
      const wrapper = mountCells(
        'k8s/secret/Secret.vue',
        0,
        [{ key: 'actions' }],
        record,
        {
          hasPerm: (code: string) => allowed && code === 'detail',
          can: () => false,
          SECRET_DETAIL_PERMISSION_CODE: 'detail',
          SECRET_UPDATE_PERMISSION_CODE: 'update',
          showSecretDetail: detail,
        },
      );
      const buttons = wrapper.findAll('tbody button');
      expect(buttons).toHaveLength(allowed ? 1 : 0);
      if (allowed) {
        await buttons[0]!.trigger('click');
        expect(detail).toHaveBeenCalledWith(record);
      }
      expect(wrapper.text()).not.toContain('fake-secret');
    },
  );
});
