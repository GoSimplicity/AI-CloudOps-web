import { flushPromises, mount, type VueWrapper } from '@vue/test-utils';
import Antd, { message, Modal } from 'ant-design-vue';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ProcessDesign from './ProcessDesign.vue';

const client = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }));
vi.mock('#/api/request', () => ({ requestClient: client }));
const definition = () => ({
  steps: [
    {
      id: 's',
      type: 'start',
      name: '开始',
      sort_order: 1,
      actions: ['submit'],
    },
    { id: 'e', type: 'end', name: '结束', sort_order: 2 },
  ],
  connections: [{ id: 's-e', from: 's', to: 'e' }],
});
let wrapper: VueWrapper | undefined;
beforeEach(() => {
  vi.resetAllMocks();
  vi.stubGlobal(
    'matchMedia',
    vi.fn(() => ({
      matches: false,
      addListener: vi.fn(),
      removeListener: vi.fn(),
    })),
  );
  const style = window.getComputedStyle;
  vi.spyOn(window, 'getComputedStyle').mockImplementation((element) =>
    style(element),
  );
  client.get.mockImplementation((path: string) =>
    Promise.resolve(
      path === '/workorder/form-design/list'
        ? { items: [{ id: 9, name: '已发布表单', status: 2 }], total: 1 }
        : { items: [], total: 0 },
    ),
  );
  client.post.mockResolvedValue(undefined);
});
afterEach(() => {
  wrapper?.unmount();
  wrapper = undefined;
  Modal.destroyAll();
  message.destroy();
  document.body.innerHTML = '';
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
async function start() {
  wrapper = mount(ProcessDesign, {
    props: { modelValue: definition() },
    attachTo: document.body,
    global: { plugins: [Antd] },
  });
  await flushPromises();
}
async function button(text: string) {
  const target = [
    ...document.querySelectorAll<HTMLButtonElement>('button'),
  ].find((el) => el.textContent?.replace(/\s/g, '') === text);
  expect(target).toBeDefined();
  target!.click();
  await flushPromises();
}
async function tab(text: string) {
  const target = wrapper!
    .findAll('.ant-tabs-tab')
    .find((el) => el.text() === text);
  expect(target).toBeDefined();
  await target!.trigger('click');
  await flushPromises();
}
async function draft() {
  await start();
  await wrapper!
    .get('input[placeholder="请输入流程名称"]')
    .setValue('隔离流程');
  const select = wrapper!.find('.basic-info-form .ant-select');
  await select.find('.ant-select-selector').trigger('mousedown');
  await flushPromises();
  document.querySelector<HTMLElement>('.ant-select-item-option')!.click();
  await flushPromises();
}
describe('流程设计真实控件合同', () => {
  it('保留published设计与void保存合同，重复提交只写一次，失败不丢图', async () => {
    const pending = Promise.withResolvers<unknown>();
    client.post.mockReturnValue(pending.promise);
    await draft();
    await button('保存流程');
    await button('保存流程');
    expect(client.post).toHaveBeenCalledTimes(1);
    expect(client.post).toHaveBeenCalledWith(
      '/workorder/process/create',
      expect.objectContaining({
        name: '隔离流程',
        form_design_id: 9,
        definition: definition(),
        status: 1,
        is_default: 2,
      }),
    );
    pending.reject(new Error('fixture'));
    await flushPromises();
    expect(
      (
        wrapper!.get('input[placeholder="请输入流程名称"]')
          .element as HTMLInputElement
      ).value,
    ).toBe('隔离流程');
    expect(wrapper!.text()).toContain('保存失败');
  });
  it('同毫秒新增步骤ID唯一，删除前序步骤不切换当前编辑对象', async () => {
    await start();
    await tab('可视化设计');
    vi.spyOn(Date, 'now').mockReturnValue(Date.now() + 60_000);
    await button('添加步骤');
    await button('添加步骤');
    const latest = wrapper!
      .emitted('update:modelValue')!
      .at(-1)![0] as ReturnType<typeof definition>;
    expect(new Set(latest.steps.map((step) => step.id)).size).toBe(4);
    const selected = wrapper!.get('.process-step.active').text();
    const remove = wrapper!.findAll('.process-step button')[0]!;
    await remove.trigger('click');
    expect(wrapper!.get('.process-step.active').text()).toBe(selected);
  });
  it('JSON修改必须显式应用，损坏结构不污染图且预览取消不保存', async () => {
    await draft();
    await tab('JSON编辑');
    await wrapper!
      .get('textarea[placeholder="请输入或粘贴流程定义JSON"]')
      .setValue('{"steps":[null],"connections":[]}');
    await button('应用到可视化');
    expect(document.querySelector('.ant-message-error')?.textContent).toContain(
      '结构',
    );
    await tab('基本信息');
    await button('保存流程');
    expect(client.post).not.toHaveBeenCalled();
    await tab('JSON编辑');
    await wrapper!.get('textarea').setValue(JSON.stringify(definition()));
    await button('应用到可视化');
    await tab('可视化设计');
    await button('预览流程');
    expect(document.querySelector('.ant-modal')?.textContent).toContain('开始');
    document.querySelector<HTMLButtonElement>('.ant-modal-close')!.click();
    await flushPromises();
    expect(client.post).not.toHaveBeenCalled();
  });
  it('加载已发布表单失败可重试，不能伪装空列表', async () => {
    const original = client.get.getMockImplementation()!;
    let fail = true;
    client.get.mockImplementation((path: string, ...rest: unknown[]) =>
      path === '/workorder/form-design/list' && fail
        ? Promise.reject(new Error('fixture'))
        : original(path, ...rest),
    );
    await start();
    expect(wrapper!.text()).toContain('读取已发布表单失败');
    fail = false;
    await button('重试表单');
    const select = wrapper!.find('.basic-info-form .ant-select');
    await select.find('.ant-select-selector').trigger('mousedown');
    await flushPromises();
    expect(
      document.querySelector('.ant-select-dropdown')?.textContent,
    ).toContain('已发布表单');
    expect(client.post).not.toHaveBeenCalled();
  });
  it('切换步骤时迟到的旧用户结果不覆盖当前步骤', async () => {
    const original = client.get.getMockImplementation()!;
    const late = Promise.withResolvers<unknown>();
    let requests = 0;
    client.get.mockImplementation((path: string, ...rest: unknown[]) =>
      path === '/user/list'
        ? ++requests === 1
          ? late.promise
          : Promise.resolve({
              items: [{ id: 88, username: '当前步骤用户' }],
              total: 1,
            })
        : original(path, ...rest),
    );
    await start();
    await tab('可视化设计');
    await wrapper!.findAll('.process-step')[0]!.trigger('click');
    await flushPromises();
    await wrapper!.findAll('.process-step')[1]!.trigger('click');
    await flushPromises();
    late.resolve({ items: [{ id: 77, username: '迟到旧用户' }], total: 1 });
    await flushPromises();
    await wrapper!.find('.ant-select').trigger('blur');
    const user = wrapper!
      .findAll('.ant-select')
      .find((select) => select.find('#process-assignees').exists())!;
    await user.find('.ant-select-selector').trigger('mousedown');
    await flushPromises();
    expect(
      document.querySelector('.ant-select-dropdown')?.textContent,
    ).toContain('当前步骤用户');
    expect(
      document.querySelector('.ant-select-dropdown')?.textContent,
    ).not.toContain('迟到旧用户');
  });
});
