import type { RouteRecordRaw } from 'vue-router';

import { BasicLayout } from '#/layouts';

const routes: RouteRecordRaw[] = [
  {
    component: BasicLayout,
    meta: {
      icon: 'tabler:clock-cog',
      order: 4,
      title: '定时任务管理',
    },
    name: 'Cron',
    path: '/cron',
    children: [
      {
        name: 'CronJobManagement',
        path: '/cron/management',
        component: () => import('#/views/cron/management/Management.vue'),
        meta: {
          icon: 'lucide:settings',
          order: 1,
          title: '任务管理',
        },
      },
    ],
  },
];

export default routes;
