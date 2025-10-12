import type { RouteRecordRaw } from 'vue-router';

import { BasicLayout } from '#/layouts';
import { $t } from '#/locales';

const routes: RouteRecordRaw[] = [
  {
    component: BasicLayout,
    meta: {
      order: 1,
      title: $t('page.serviceTree.title'),
      icon: 'tabler:binary-tree-2',
    },
    name: 'ServiceTree',
    path: '/tree',
    children: [
      {
        name: '服务树节点管理',
        path: '/tree_node_manager',
        component: () => import('#/views/servicetree/TreeNodeManager.vue'),
        meta: {
          title: '服务树节点管理',
          icon: 'fluent-mdl2:task-manager',
        },
      },
      {
        name: '本地资源管理',
        path: '/local_resource_management',
        component: () => import('#/views/servicetree/LocalResourceManagement.vue'),
        meta: {
          title: '本地资源管理',
          icon: 'mdi:server-network',
        },
      },
      {
        name: '云账户管理',
        path: '/cloud_account_management',
        component: () => import('#/views/servicetree/CloudAccountManagement.vue'),
        meta: {
          title: '云账户管理',
          icon: 'mdi:cloud-outline',
        },
      },
      {
        name: '云资源管理',
        path: '/cloud_resource_management',
        component: () => import('#/views/servicetree/CloudResourceManager.vue'),
        meta: {
          title: '云资源管理',
          icon: 'mdi:cloud',
        },
      },
      {
        name: 'TerminalConnect',
        path: '/terminal_connect',
        component: () => import('#/views/servicetree/TerminalConnect.vue'),
        meta: {
          hideInMenu: true,
          title: '终端连接',
        },
      },
      {
        name: 'WebTerminal',
        path: '/web-terminal/:id',
        component: () => import('#/views/servicetree/WebTerminal.vue'),
        meta: {
          hideInMenu: true,
          title: 'Web终端',
        },
      },
    ],
  },
];

export default routes;
