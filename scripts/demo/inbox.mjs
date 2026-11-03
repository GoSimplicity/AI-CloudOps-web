import { timestamp } from './k8s.mjs';

// No real event, notification delivery or work order is represented by these IDs.
export function createInboxResponse() {
  const messages = [
    [
      '演示：新工单提醒',
      '本地合成的待处理消息。未关联真实工单，也未向邮件或飞书投递。',
      null,
    ],
    [
      '演示：审批待处理',
      '展示未读审批提醒。此条消息不会创建审批、投递任务或通知租约。',
      null,
    ],
    [
      '演示：处理进度更新',
      '展示已读消息样式。内容与状态仅存于演示服务内存。',
      timestamp,
    ],
    [
      '演示：本地环境就绪',
      '演示数据重启后重置；不会连接云平台、集群、模型或通知服务。',
      timestamp,
    ],
  ].map(([subject, content, read_at], index) => ({
    content,
    created_at: timestamp,
    event_id: 0,
    event_type: 'simulated',
    id: 9801 + index,
    instance_id: 0,
    notification_id: 0,
    read_at,
    source: 'simulated',
    subject,
  }));
  return (method, url, page) => {
    const path = url.pathname;
    if (method === 'GET' && path === '/api/workorder/notification/inbox') {
      const unreadOnly = url.searchParams.get('unread') === 'true';
      return page(
        messages.filter((message) => !unreadOnly || message.read_at === null),
        url,
      );
    }
    if (method === 'GET' && path === '/api/workorder/notification/inbox/unread')
      return {
        source: 'simulated',
        unread: messages.filter((message) => message.read_at === null).length,
      };
    if (
      method === 'POST' &&
      path === '/api/workorder/notification/inbox/read-all'
    ) {
      const now = new Date().toISOString();
      for (const message of messages)
        if (message.read_at === null) message.read_at = now;
      return { scope: 'memory-only', source: 'simulated' };
    }
    const match =
      /^\/api\/workorder\/notification\/inbox\/(980[1-4])\/read$/.exec(path);
    if (method === 'POST' && match) {
      const message = messages.find((item) => item.id === Number(match[1]));
      if (!message) return;
      message.read_at ??= new Date().toISOString();
      return { scope: 'memory-only', source: 'simulated' };
    }
  };
}
