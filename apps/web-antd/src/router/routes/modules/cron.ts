import type { RouteRecordRaw } from 'vue-router';

import { BasicLayout } from '#/layouts';

const routes: RouteRecordRaw[] = [
  {
    component: BasicLayout,
    meta: {
      order: 4,
      title: '定时任务管理',
      icon: 'tabler:clock-cog'
    },
    name: 'Cron',
    path: '/cron',
    children: [
      {
        name: 'CronJobList',
        path: '/cron/job/list',
        component: () => import('#/views/cron/list/List.vue'),
        meta: {
          order: 1,
          icon: 'lucide:list',
          title: '定时任务列表',
        },
      },
      {
        name: 'CronJobLog',
        path: '/cron/job/log',
        component: () => import('#/views/cron/log/Log.vue'),
        meta: {
          order: 2,
          icon: 'lucide:file-text',
          title: '执行日志',
        },
      },
    ],
  },
];

export default routes;
