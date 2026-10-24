import { flushPromises, mount, type VueWrapper } from '@vue/test-utils';
import Antd from 'ant-design-vue';
import { createPinia, setActivePinia } from 'pinia';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Component } from 'vue';

import AssistantInfo from './AssistantInfo.vue';
import AssistantKnowledge from './AssistantKnowledge.vue';

const api = vi.hoisted(() => ({
  getAssistantInfo: vi.fn(),
  getAssistantConfig: vi.fn(),
  refreshKnowledgeBase: vi.fn(),
  uploadKnowledgeFile: vi.fn(),
  addDocument: vi.fn(),
}));
vi.mock('#/api/core/aiops/assistant', () => api);
let wrapper: VueWrapper | undefined;
beforeEach(() => {
  vi.clearAllMocks();
  setActivePinia(createPinia());
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
  api.getAssistantInfo.mockResolvedValue({
    service: 'assistant',
    status: 'initialized',
    capabilities: [],
    endpoints: {},
  });
  api.getAssistantConfig.mockResolvedValue({ config: {} });
  api.refreshKnowledgeBase.mockResolvedValue({
    refreshed: true,
    documents_count: 7,
    vector_count: 14,
    timestamp: '2026-10-23T12:00:00Z',
    message: '索引完成',
  });
  api.uploadKnowledgeFile.mockResolvedValue({
    uploaded: true,
    filename: 'guide.md',
    file_size: 4,
    document_id: 'document',
    message: '已索引',
  });
  api.addDocument.mockResolvedValue({
    added: true,
    document_id: 'document',
    message: '已索引',
  });
});
afterEach(() => {
  wrapper?.unmount();
  document.body.innerHTML = '';
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
async function screen(component: Component) {
  wrapper = mount(component, {
    attachTo: document.body,
    global: { plugins: [Antd], stubs: { Icon: true } },
  });
  await flushPromises();
}
function button(text: string) {
  return wrapper!
    .findAll('button')
    .find((item) => item.text().replace(/\s/g, '').includes(text))!;
}
async function upload(file: File) {
  const input = wrapper!.get('input[type="file"]');
  Object.defineProperty(input.element, 'files', {
    configurable: true,
    value: [file],
  });
  await input.trigger('change');
  await flushPromises();
}
async function documentForm(filename = 'guide.md') {
  await wrapper!
    .get('input[placeholder="请输入文档标题"]')
    .setValue('测试文档');
  await wrapper!
    .get('input[placeholder="例如: document.txt"]')
    .setValue(filename);
  await wrapper!
    .get('textarea[placeholder="请输入文档内容"]')
    .setValue('仅当前文档索引');
}

describe('助手服务信息真实控件', () => {
  it('按后端契约展示初始化状态，不把它等同健康检查', async () => {
    await screen(AssistantInfo);
    expect(wrapper!.text()).toContain('已初始化');
  });
  it('刷新失败清空旧资料并支持重试', async () => {
    api.getAssistantInfo
      .mockResolvedValueOnce({
        service: '旧服务资料',
        status: 'initialized',
        capabilities: [],
        endpoints: {},
      })
      .mockRejectedValueOnce(new Error('离线信息失败'))
      .mockResolvedValue({
        service: '恢复服务',
        status: 'not_initialized',
        capabilities: [],
        endpoints: {},
      });
    await screen(AssistantInfo);
    await button('刷新信息').trigger('click');
    await flushPromises();
    expect(wrapper!.text()).not.toContain('旧服务资料');
    expect(wrapper!.find('[role="alert"]').text()).toContain('离线信息失败');
    await button('重试').trigger('click');
    await flushPromises();
    expect(wrapper!.text()).toContain('恢复服务');
    expect(wrapper!.text()).toContain('未初始化');
  });
  it('服务器新快照缺失字段不保留旧版本或约束', async () => {
    api.getAssistantInfo
      .mockResolvedValueOnce({
        service: 'assistant',
        version: '旧版本快照',
        constraints: { legacy: '旧约束' },
      })
      .mockResolvedValue({
        service: 'assistant',
        capabilities: [],
        endpoints: {},
      });
    await screen(AssistantInfo);
    await button('刷新信息').trigger('click');
    await flushPromises();
    expect(wrapper!.text()).not.toContain('旧版本快照');
    expect(wrapper!.text()).not.toContain('旧约束');
  });
});

describe('知识库上传与显式索引边界', () => {
  it('挂载页面不调用模型或写入接口', async () => {
    await screen(AssistantKnowledge);
    expect(api.refreshKnowledgeBase).not.toHaveBeenCalled();
    expect(api.uploadKnowledgeFile).not.toHaveBeenCalled();
    expect(api.addDocument).not.toHaveBeenCalled();
  });
  it.each(['pdf', 'doc', 'docx'])(
    '实际选择的 %s 文件在网络前被拒绝',
    async (extension) => {
      await screen(AssistantKnowledge);
      await upload(new File(['unsupported'], 'guide.' + extension));
      expect(api.uploadKnowledgeFile).not.toHaveBeenCalled();
    },
  );
  it('上传成功结束上传中状态', async () => {
    await screen(AssistantKnowledge);
    await upload(new File(['正文'], 'guide.md'));
    expect(api.uploadKnowledgeFile).toHaveBeenCalledOnce();
    expect(wrapper!.find('.ant-upload-list-item-done').exists()).toBe(true);
  });
  it('上传失败结束上传中状态并可重新选择文件', async () => {
    api.uploadKnowledgeFile.mockRejectedValueOnce(new Error('离线上传失败'));
    await screen(AssistantKnowledge);
    await upload(new File(['正文'], 'guide.md'));
    expect(wrapper!.find('.ant-upload-list-item-error').exists()).toBe(true);
    await upload(new File(['正文'], 'retry.md'));
    expect(api.uploadKnowledgeFile).toHaveBeenCalledTimes(2);
  });
  it('单文档上传成功不隐式调用全库重建', async () => {
    await screen(AssistantKnowledge);
    await upload(new File(['正文'], 'guide.md'));
    expect(api.refreshKnowledgeBase).not.toHaveBeenCalled();
  });
  it('10MiB边界文件允许进入上传请求', async () => {
    await screen(AssistantKnowledge);
    await upload(new File(['x'.repeat(10 * 1024 * 1024)], 'limit.txt'));
    expect(api.uploadKnowledgeFile).toHaveBeenCalledOnce();
  });
  it('手动文档必要入库后不隐式全库重建', async () => {
    await screen(AssistantKnowledge);
    await documentForm();
    await button('添加文档').trigger('click');
    await flushPromises();
    expect(api.addDocument).toHaveBeenCalledWith(
      expect.objectContaining({
        title: '测试文档',
        file_name: 'guide.md',
        content: '仅当前文档索引',
      }),
    );
    expect(api.refreshKnowledgeBase).not.toHaveBeenCalled();
  });
  it('手动文档不支持的后缀在请求前拒绝', async () => {
    await screen(AssistantKnowledge);
    await documentForm('guide.docx');
    await button('添加文档').trigger('click');
    await flushPromises();
    expect(api.addDocument).not.toHaveBeenCalled();
  });
});
