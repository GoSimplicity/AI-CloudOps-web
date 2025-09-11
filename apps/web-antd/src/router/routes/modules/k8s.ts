import type { RouteRecordRaw } from 'vue-router';

import { BasicLayout } from '#/layouts';

const routes: RouteRecordRaw[] = [
  {
    component: BasicLayout,
    meta: {
      order: 3,
      title: 'k8s运维管理',
      icon: 'tabler:cloud-network'
    },
    name: 'K8s',
    path: '/k8s',
    children: [
      {
        name: 'K8sCluster',
        path: '/k8s_cluster',
        component: () => import('#/views/k8s/cluster/Cluster.vue'),
        meta: {
          order: 1,
          icon: 'lucide:database',
          title: '集群管理',
        },
      },
      {
        name: 'K8sNamespace',
        path: '/k8s_namespace',
        component: () => import('#/views/k8s/namespace/Namespace.vue'),
        meta: {
          order: 2,
          icon: 'lucide:folder',
          title: '命名空间管理',
        },
      },
      {
        name: 'K8sNode',
        path: '/k8s_node',
        component: () => import('#/views/k8s/node/Node.vue'),
        meta: {
          order: 3,
          icon: 'lucide:server',
          title: '节点管理',
        },
      },
      {
        name: 'K8sDeployment',
        path: '/k8s_deployment',
        component: () => import('#/views/k8s/deployment/Deployment.vue'),
        meta: {
          order: 6,
          icon: 'lucide:rocket',
          title: '部署管理',
        },
      },
      {
        name: 'K8sStatefulSet',
        path: '/k8s_statefulset',
        component: () => import('#/views/k8s/statefulset/StatefulSet.vue'),
        meta: {
          order: 7,
          icon: 'lucide:layers',
          title: '有状态应用管理',
        },
      },
      {
        name: 'K8sDaemonSet',
        path: '/k8s_daemonset',
        component: () => import('#/views/k8s/daemonset/DaemonSet.vue'),
        meta: {
          order: 8,
          icon: 'lucide:shield',
          title: 'DaemonSet管理',
        },
      },
      {
        name: 'K8sService',
        path: '/k8s_service',
        component: () => import('#/views/k8s/service/Service.vue'),
        meta: {
          order: 9,
          icon: 'lucide:network',
          title: '服务管理',
        },
      },
    ],
  },
];

export default routes;
