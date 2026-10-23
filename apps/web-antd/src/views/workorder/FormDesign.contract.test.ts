import {
  DOMWrapper,
  flushPromises,
  mount,
  type VueWrapper,
} from '@vue/test-utils';
import Antd, { message, Modal } from 'ant-design-vue';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import FormDesign from './FormDesign.vue';

const client = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }));
vi.mock('#/api/request', () => ({ requestClient: client }));
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
  client.get.mockResolvedValue({
    items: [{ id: 1, name: '本地分类' }],
    total: 1,
  });
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
  wrapper = mount(FormDesign, {
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
async function draft() {
  await start();
  await wrapper!
    .get('input[placeholder="请输入表单名称"]')
    .setValue('隔离表单');
  await button('文本框');
}

describe('表单设计真实控件合同', () => {
  it('保留字段编辑和void创建合同，重复提交只写一次，失败保留草稿', async () => {
    const pending = Promise.withResolvers<unknown>();
    client.post.mockReturnValue(pending.promise);
    await draft();
    await button('保存设计');
    await button('保存设计');
    expect(client.post).toHaveBeenCalledTimes(1);
    expect(client.post).toHaveBeenCalledWith(
      '/workorder/form-design/create',
      expect.objectContaining({
        name: '隔离表单',
        status: 1,
        is_template: 2,
        schema: {
          fields: [
            expect.objectContaining({
              name: 'text_field_1',
              type: 'text',
              required: 0,
            }),
          ],
        },
      }),
    );
    pending.reject(new Error('fixture'));
    await flushPromises();
    expect(
      (
        wrapper!.get('input[placeholder="请输入表单名称"]')
          .element as HTMLInputElement
      ).value,
    ).toBe('隔离表单');
    expect(wrapper!.text()).toContain('文本框1');
    client.post.mockResolvedValue(undefined);
    await button('保存设计');
    expect(
      [...document.querySelectorAll('.ant-message-success')]
        .map((el) => el.textContent)
        .join(' '),
    ).toContain('保存成功');
  });
  it('删除后添加同类字段仍然有唯一字段名', async () => {
    await draft();
    await button('文本框');
    const remove = wrapper!
      .findAll('button')
      .filter((button) => button.attributes('aria-label') === '删除字段');
    expect(remove.length).toBe(2);
    await remove[0]!.trigger('click');
    await button('文本框');
    await button('保存设计');
    const fields = client.post.mock.calls[0]![1].schema.fields;
    expect(
      new Set(fields.map((field: { name: string }) => field.name)).size,
    ).toBe(2);
  });
  it('清空需要确认，取消不丢草稿；预览校验不伪造工单提交', async () => {
    await draft();
    await button('清空表单');
    expect(document.querySelector('.ant-modal-confirm')).not.toBeNull();
    await button('取消');
    expect(wrapper!.text()).toContain('文本框1');
    await button('预览表单');
    await button('校验预览');
    expect(
      [...document.querySelectorAll('.ant-message-success')]
        .map((el) => el.textContent)
        .join(' '),
    ).toContain('未创建工单');
    expect(client.post).not.toHaveBeenCalled();
    await button('返回设计');
    expect(wrapper!.text()).toContain('文本框1');
  });
  it('分类搜索乱序不覆盖新结果，取消不保存', async () => {
    await start();
    await wrapper!.get('.category-trigger').trigger('click');
    await flushPromises();
    const old = Promise.withResolvers<unknown>();
    client.get.mockImplementation(
      (_path: string, { params }: { params: { search: string } }) =>
        params.search === 'old'
          ? old.promise
          : Promise.resolve({ items: [{ id: 3, name: '新分类' }], total: 1 }),
    );
    const search = new DOMWrapper(
      document.querySelector<HTMLInputElement>('.category-modal input')!,
    );
    await search.setValue('old');
    document
      .querySelector<HTMLButtonElement>('.category-search button')!
      .click();
    await flushPromises();
    await search.setValue('new');
    document
      .querySelector<HTMLButtonElement>('.category-search button')!
      .click();
    await flushPromises();
    old.resolve({ items: [{ id: 2, name: '旧分类' }], total: 1 });
    await flushPromises();
    expect(document.querySelector('.category-modal')?.textContent).toContain(
      '新分类',
    );
    expect(
      document.querySelector('.category-modal')?.textContent,
    ).not.toContain('旧分类');
    const close = document.querySelector<HTMLButtonElement>(
      '.category-modal .ant-modal-close',
    )!;
    close.click();
    await flushPromises();
    expect(client.post).not.toHaveBeenCalled();
  });
  it('九种已有字段均可添加并真实渲染预览，校验不创建工单', async () => {
    await start();
    for (const type of [
      '文本框',
      '数字',
      '密码',
      '多行文本',
      '日期',
      '下拉选项',
      '单选框',
      '复选框',
      '开关',
    ])
      await button(type);
    await button('预览表单');
    expect(wrapper!.findAll('.dynamic-form .form-field')).toHaveLength(9);
    await button('校验预览');
    expect(client.post).not.toHaveBeenCalled();
    expect(
      [...document.querySelectorAll('.ant-message-success')]
        .map((el) => el.textContent)
        .join(' '),
    ).toContain('未创建工单');
  });
});
