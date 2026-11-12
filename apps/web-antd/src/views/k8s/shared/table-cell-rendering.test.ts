import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';

import { defineComponent } from 'vue';

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
import ts from 'typescript';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { compileTemplate, parse } from 'vue/compiler-sfc';

function required<T>(value: null | T | undefined): T {
  if (value === null || value === undefined) {
    throw new Error('测试前置条件缺失');
  }
  return value;
}

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
  const template = required(
    parse(readFileSync(filename, 'utf8')).descriptor.template,
  );
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
    filename,
    id: 'table-cell-regression',
    source: `<a-table :columns="testColumns" :data-source="testRecords" row-key="id" :pagination="false">${cell.loc.source}</a-table>`,
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
        components: {
          DeleteOutlined,
          EditOutlined,
          EyeOutlined,
          FileTextOutlined,
          PauseCircleOutlined,
          PlayCircleOutlined,
          PlaySquareOutlined,
        },
        plugins: [Antd],
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
      addEventListener: vi.fn(),
      addListener: vi.fn(),
      matches: false,
      removeEventListener: vi.fn(),
      removeListener: vi.fn(),
    })),
  );
});
afterEach(() => {
  wrappers.splice(0).forEach((wrapper) => wrapper.unmount());
  vi.unstubAllGlobals();
});

describe('ant Table bodyCell migration', () => {
  it('service dynamic ports retain named formatting and default/customRender fallbacks', () => {
    const wrapper = mountCells(
      'k8s/service/Service.vue',
      1,
      [
        { dataIndex: 'name', key: 'name' },
        { dataIndex: 'protocol', key: 'protocol' },
        { dataIndex: 'node_port', key: 'node_port' },
        { dataIndex: 'port', key: 'port' },
        {
          customRender: ({ text }: any) => `target:${text}`,
          dataIndex: 'target_port',
          key: 'target_port',
        },
      ],
      {
        id: 1,
        name: '',
        node_port: 0,
        port: 8080,
        protocol: '',
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

  it('cron combines record and text for last result and binds action to the same row', async () => {
    const showJobDetail = vi.fn();
    const record = {
      id: 7,
      last_run_status: 2,
      last_run_time: 'fixture-time',
      status: 1,
    };
    const wrapper = mountCells(
      'cron/management/Management.vue',
      0,
      [
        { dataIndex: 'last_run_status', key: 'last_run_status' },
        { key: 'action' },
      ],
      record,
      {
        can: () => false,
        CronJobStatus: { DISABLED: 2, ENABLED: 1 },
        getLastRunStatusColor: () => 'error',
        getLastRunStatusText: (value: number) => `result:${value}`,
        isLocalExecLocked: () => false,
        showJobDetail,
      },
    );
    expect(wrapper.find('tbody').text()).toContain('result:2');
    expect(wrapper.findAll('tbody button')).toHaveLength(3);
    await wrapper.find('tbody button').trigger('click');
    expect(showJobDetail).toHaveBeenCalledWith(record);
  });

  it.each([false, true])(
    'secret preserves explicit permission gate: detail allowed=%s',
    async (allowed) => {
      const detail = vi.fn();
      const record = { id: 1, name: 'fake-secret' };
      const wrapper = mountCells(
        'k8s/secret/Secret.vue',
        0,
        [{ key: 'actions' }],
        record,
        {
          can: () => false,
          hasPerm: (code: string) => allowed && code === 'detail',
          SECRET_DETAIL_PERMISSION_CODE: 'detail',
          SECRET_UPDATE_PERMISSION_CODE: 'update',
          showSecretDetail: detail,
        },
      );
      const buttons = wrapper.findAll('tbody button');
      expect(buttons).toHaveLength(allowed ? 1 : 0);
      if (allowed) {
        await required(buttons[0]).trigger('click');
        expect(detail).toHaveBeenCalledWith(record);
      }
      expect(wrapper.text()).not.toContain('fake-secret');
    },
  );
});
