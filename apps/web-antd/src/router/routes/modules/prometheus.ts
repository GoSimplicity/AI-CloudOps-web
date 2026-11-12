import type { RouteRecordRaw } from 'vue-router';

import { BasicLayout } from '#/layouts';

const routes: RouteRecordRaw[] = [
  {
    component: BasicLayout,
    meta: {
      icon: 'lucide:monitor',
      order: 2,
      title: 'Prometheus管理',
    },
    name: 'Prometheus',
    path: '/prometheus',
    children: [
      {
        name: 'MonitorScrapePool',
        path: '/monitor_pool',
        component: () => import('#/views/prometheus/MonitorScrapePool.vue'),
        meta: {
          icon: 'lucide:database',
          title: '采集池',
        },
      },
      {
        name: 'MonitorScrapeJob',
        path: '/monitor_job',
        component: () => import('#/views/prometheus/MonitorScrapeJob.vue'),
        meta: {
          icon: 'lucide:list-check',
          title: '采集任务',
        },
      },
      {
        name: 'MonitorAlertPool',
        path: '/monitor_alert_pool',
        component: () => import('#/views/prometheus/MonitorAlertPool.vue'),
        meta: {
          icon: 'tabler:alert-circle-filled',
          title: 'alert告警池',
        },
      },

      {
        name: 'MonitorAlertRule',
        path: '/monitor_alert_rule',
        component: () => import('#/views/prometheus/MonitorAlertRule.vue'),
        meta: {
          icon: 'lucide:badge-alert',
          title: '告警规则',
        },
      },
      {
        name: 'MonitorAlertEvent',
        path: '/monitor_alert_event',
        component: () => import('#/views/prometheus/MonitorAlertEvent.vue'),
        meta: {
          icon: 'lucide:bell-ring',
          title: '告警事件',
        },
      },
      {
        name: 'MonitorAlertRecord',
        path: '/monitor_alert_record',
        component: () => import('#/views/prometheus/MonitorAlertRecord.vue'),
        meta: {
          icon: 'lucide:box',
          title: '预聚合',
        },
      },
      {
        name: 'MonitorConfig',
        path: '/monitor_config',
        component: () => import('#/views/prometheus/MonitorConfig.vue'),
        meta: {
          icon: 'lucide:file-text',
          title: '配置文件',
        },
      },
      {
        name: 'MonitorOnDutyGroup',
        path: '/monitor_onduty_group',
        component: () => import('#/views/prometheus/MonitorOnDutyGroup.vue'),
        meta: {
          icon: 'lucide:user-round-minus',
          title: '值班组',
        },
      },
      {
        name: 'MonitorOnDutyGroupTable',
        path: '/monitor_onduty_group_table',
        component: () =>
          import('#/views/prometheus/MonitorOnDutyGroupTable.vue'),
        meta: {
          hideInMenu: true,
          icon: 'material-symbols:table-outline',
          title: '排班表',
        },
      },
      {
        name: 'MonitorSend',
        path: '/monitor_send',
        component: () => import('#/views/prometheus/MonitorSend.vue'),
        meta: {
          icon: 'lucide:send-horizontal',
          title: '发送组',
        },
      },
    ],
  },
];

export default routes;
