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
        name: 'CronJobManagement',
        path: '/cron/management',
        component: () => import('#/views/cron/management/Management.vue'),
        meta: {
          order: 1,
          icon: 'lucide:settings',
          title: '任务管理',
        },
      },
    ],
  },
];

export default routes;
