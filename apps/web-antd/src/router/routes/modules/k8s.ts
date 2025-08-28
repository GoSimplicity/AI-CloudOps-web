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
        component: () => import('#/views/k8s/K8sCluster.vue'),
        meta: {
          order: 1,
          icon: 'lucide:database',
          title: '集群管理',
        },
      },
      {
        name: 'K8sNamespace',
        path: '/k8s_namespace',
        component: () => import('#/views/k8s/K8sNamespace.vue'),
        meta: {
          order: 2,
          icon: 'lucide:folder',
          title: '命名空间管理',
        },
      },
      {
        name: 'K8sNode',
        path: '/k8s_node',
        component: () => import('#/views/k8s/K8sNode.vue'),
        meta: {
          order: 3,
          icon: 'lucide:server',
          title: '节点管理',
        },
      },
      {
        name: 'K8sPod',
        path: '/k8s_pod',
        component: () => import('#/views/k8s/K8sPod.vue'),
        meta: {
          order: 4,
          icon: 'lucide:box',
          title: 'Pod管理',
        },
      },
      {
        name: 'K8sContainer',
        path: '/k8s_container',
        component: () => import('#/views/k8s/K8sContainer.vue'),
        meta: {
          order: 5,
          icon: 'lucide:container',
          title: '容器管理',
        },
      },
      {
        name: 'K8sDeployment',
        path: '/k8s_deployment',
        component: () => import('#/views/k8s/K8sDeployment.vue'),
        meta: {
          order: 6,
          icon: 'lucide:rocket',
          title: '部署管理',
        },
      },
      {
        name: 'K8sStatefulSet',
        path: '/k8s_statefulset',
        component: () => import('#/views/k8s/K8sStatefulSet.vue'),
        meta: {
          order: 7,
          icon: 'lucide:layers',
          title: '有状态应用管理',
        },
      },
      {
        name: 'K8sDaemonSet',
        path: '/k8s_daemonset',
        component: () => import('#/views/k8s/K8sDaemonSet.vue'),
        meta: {
          order: 8,
          icon: 'lucide:shield',
          title: 'DaemonSet管理',
        },
      },
      {
        name: 'K8sService',
        path: '/k8s_service',
        component: () => import('#/views/k8s/K8sService.vue'),
        meta: {
          order: 9,
          icon: 'lucide:network',
          title: '服务管理',
        },
      },
      {
        name: 'K8sEndpoint',
        path: '/k8s_endpoint',
        component: () => import('#/views/k8s/K8sEndpoint.vue'),
        meta: {
          order: 10,
          icon: 'lucide:link',
          title: 'Endpoint管理',
        },
      },
      {
        name: 'K8sConfigMap',
        path: '/k8s_configmap',
        component: () => import('#/views/k8s/K8sConfigmap.vue'),
        meta: {
          order: 11,
          icon: 'lucide:settings',
          title: '配置管理',
        },
      },
      {
        name: 'K8sSecret',
        path: '/k8s_secret',
        component: () => import('#/views/k8s/K8sSecret.vue'),
        meta: {
          order: 12,
          icon: 'lucide:key',
          title: '密钥管理',
        },
      },
      {
        name: 'K8sVolume',
        path: '/k8s_volume',
        component: () => import('#/views/k8s/K8sVolume.vue'),
        meta: {
          order: 13,
          icon: 'lucide:hard-drive',
          title: '存储卷管理',
        },
      },
      {
        name: 'K8sServiceAccount',
        path: '/k8s_serviceaccount',
        component: () => import('#/views/k8s/K8sServiceAccount.vue'),
        meta: {
          order: 14,
          icon: 'lucide:user-check',
          title: '服务账户管理',
        },
      },
      {
        name: 'K8sRBAC',
        path: '/k8s_rbac',
        component: () => import('#/views/k8s/K8sRBAC.vue'),
        meta: {
          order: 15,
          icon: 'lucide:shield-check',
          title: 'RBAC权限管理',
        },
      },
      {
        name: 'K8sEvent',
        path: '/k8s_event',
        component: () => import('#/views/k8s/K8sEvent.vue'),
        meta: {
          order: 16,
          icon: 'lucide:activity',
          title: '事件管理',
        },
      },
      {
        name: 'K8sYamlTemplate',
        path: '/k8s_yaml_template',
        component: () => import('#/views/k8s/K8sYamlTemplate.vue'),
        meta: {
          order: 17,
          icon: 'lucide:file-text',
          title: 'YAML模板管理',
        },
      },
      {
        name: 'K8sYamlTask',
        path: '/k8s_yaml_task',
        component: () => import('#/views/k8s/K8sYamlTask.vue'),
        meta: {
          order: 18,
          icon: 'lucide:play-circle',
          title: 'YAML任务管理',
        },
      },
    ],
  },
];

export default routes;
