import { flushPromises, mount, type VueWrapper } from '@vue/test-utils';
import Antd from 'ant-design-vue';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { CronJobType, type UpdateCronJobReq } from '#/api/core/cron/cron';
import CronEditFields from './CronEditFields.vue';

let wrapper: VueWrapper;
beforeEach(() => {
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
  wrapper?.unmount();
  document.body.innerHTML = '';
  vi.unstubAllGlobals();
});

function start(model: UpdateCronJobReq) {
  wrapper = mount(CronEditFields, {
    props: {
      modelValue: model,
      'onUpdate:modelValue': (value: UpdateCronJobReq) =>
        wrapper.setProps({ modelValue: value }),
      resources: [],
      loading: false,
    },
    global: { plugins: [Antd] },
  });
  return wrapper;
}

function updatedModel(view: VueWrapper): UpdateCronJobReq {
  const events = view.emitted('update:modelValue');
  return events?.at(-1)?.[0] as UpdateCronJobReq;
}

const base = { id: 1, name: 'job', schedule: '@every 1h' };

describe('已有任务的执行配置', () => {
  it('hTTP可编辑地址、方法、请求体及请求头，敏感值默认遮挡且不修改原对象', async () => {
    const original: UpdateCronJobReq = {
      ...base,
      job_type: CronJobType.HTTP,
      http_method: 'POST',
      http_url: 'https://old.invalid',
      http_body: 'original',
      http_headers: [{ key: 'Authorization', value: 'fixture-secret' }],
    };
    const view = start(original);
    await view
      .get('input[placeholder="https://example.com/api/endpoint"]')
      .setValue('https://new.invalid');
    const secret = view.get('input[placeholder="Header值"]');
    expect(secret.attributes('type')).toBe('password');
    await secret.setValue('replacement-secret');
    await view
      .get('textarea[placeholder="POST/PUT请求的数据体"]')
      .setValue('updated');
    const updated = updatedModel(view);
    expect(updated).toMatchObject({
      http_method: 'POST',
      http_url: 'https://new.invalid',
      http_body: 'updated',
      http_headers: [{ key: 'Authorization', value: 'replacement-secret' }],
    });
    expect(original.http_headers?.[0]?.value).toBe('fixture-secret');
    const add = view
      .findAll('button')
      .find((button) => button.text().includes('添加请求头'));
    await add!.trigger('click');
    await view
      .findAll('input[placeholder="Header名称"]')[1]!
      .setValue('X-Request');
    await view
      .findAll('input[placeholder="Header值"]')[1]!
      .setValue('new-value');
    expect(updatedModel(view).http_headers).toEqual([
      { key: 'Authorization', value: 'replacement-secret' },
      { key: 'X-Request', value: 'new-value' },
    ]);
    await view.findAll('.k8s-key-value-row button')[0]!.trigger('click');
    expect(updatedModel(view).http_headers).toEqual([
      { key: 'X-Request', value: 'new-value' },
    ]);
  });

  it('sSH可编辑命令、目录及环境变量，未改的资源ID保持不变', async () => {
    const view = start({
      ...base,
      job_type: CronJobType.SSH,
      ssh_resource_id: 23,
      ssh_command: 'old',
      ssh_work_dir: '/old',
      ssh_environment: [{ key: 'TOKEN', value: 'fixture' }],
    });
    await view
      .get('textarea[placeholder="请输入要在远程服务器执行的命令"]')
      .setValue('new-command');
    await view
      .get('input[placeholder="远程命令执行的工作目录，留空使用默认目录"]')
      .setValue('/new');
    expect(view.get('input[placeholder="变量值"]').attributes('type')).toBe(
      'password',
    );
    expect(updatedModel(view)).toMatchObject({
      ssh_resource_id: 23,
      ssh_command: 'new-command',
      ssh_work_dir: '/new',
      ssh_environment: [{ key: 'TOKEN', value: 'fixture' }],
    });
    await view.setProps({
      resources: [{ id: 24, name: '测试主机', ip_addr: '127.0.0.1', port: 22 }],
    });
    await view.get('.ant-select-selector').trigger('mousedown');
    await flushPromises();
    const option = [
      ...document.querySelectorAll<HTMLElement>('.ant-select-item-option'),
    ].find((item) => item.textContent?.includes('测试主机'));
    expect(option).toBeTruthy();
    option!.click();
    await flushPromises();
    expect(updatedModel(view).ssh_resource_id).toBe(24);
  });

  it('命令可修改参数和环境变量，脚本可修改类型及内容', async () => {
    const command = start({
      ...base,
      job_type: CronJobType.COMMAND,
      command: 'old',
      args: ['first'],
      environment: [],
    });
    await command
      .get('textarea[placeholder="请输入要执行的命令"]')
      .setValue('new');
    await command.get('input[placeholder="输入参数"]').setValue('second');
    expect(updatedModel(command)).toMatchObject({
      command: 'new',
      args: ['second'],
    });
    command.unmount();
    const script = start({
      ...base,
      job_type: CronJobType.SCRIPT,
      script_type: 'python',
      script_content: 'old',
    });
    await script
      .get('textarea[placeholder="请输入脚本内容"]')
      .setValue('print(1)');
    expect(updatedModel(script)).toMatchObject({
      script_type: 'python',
      script_content: 'print(1)',
    });
    await script.get('.ant-select-selector').trigger('mousedown');
    await flushPromises();
    const node = [
      ...document.querySelectorAll<HTMLElement>('.ant-select-item-option'),
    ].find((item) => item.textContent?.includes('Node.js'));
    expect(node).toBeTruthy();
    node!.click();
    await flushPromises();
    expect(updatedModel(script).script_type).toBe('node');
  });
});
