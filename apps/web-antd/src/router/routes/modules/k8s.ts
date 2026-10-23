import type { RouteRecordRaw } from 'vue-router';

import { BasicLayout } from '#/layouts';

const routes: RouteRecordRaw[] = [
  {
    component: BasicLayout,
    meta: {
      order: 3,
      title: 'Kubernetes 运维',
      icon: 'tabler:cloud-network',
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
          title: 'Deployment 管理',
        },
      },
      {
        name: 'K8sStatefulSet',
        path: '/k8s_statefulset',
        component: () => import('#/views/k8s/statefulset/StatefulSet.vue'),
        meta: {
          order: 7,
          icon: 'lucide:layers',
          title: 'StatefulSet 管理',
        },
      },
      {
        name: 'K8sDaemonSet',
        path: '/k8s_daemonset',
        component: () => import('#/views/k8s/daemonset/DaemonSet.vue'),
        meta: {
          order: 8,
          icon: 'lucide:shield',
          title: 'DaemonSet 管理',
        },
      },
      {
        name: 'K8sService',
        path: '/k8s_service',
        component: () => import('#/views/k8s/service/Service.vue'),
        meta: {
          order: 9,
          icon: 'lucide:network',
          title: 'Service 管理',
        },
      },
      {
        name: 'K8sIngress',
        path: '/k8s_ingress',
        component: () => import('#/views/k8s/ingress/Ingress.vue'),
        meta: {
          order: 10,
          icon: 'lucide:shield-check',
          title: 'Ingress 管理',
        },
      },
      {
        name: 'K8sPod',
        path: '/k8s_pod',
        component: () => import('#/views/k8s/pod/Pod.vue'),
        meta: {
          order: 11,
          icon: 'lucide:separator-vertical',
          title: 'Pod 管理',
        },
      },
      {
        name: 'K8sConfigMap',
        path: '/k8s_configmap',
        component: () => import('#/views/k8s/configmap/ConfigMap.vue'),
        meta: {
          order: 12,
          icon: 'lucide:settings',
          title: 'ConfigMap 管理',
        },
      },
      {
        name: 'K8sSecret',
        path: '/k8s_secret',
        component: () => import('#/views/k8s/secret/Secret.vue'),
        meta: {
          order: 13,
          icon: 'lucide:key',
          title: 'Secret 管理',
        },
      },
      {
        name: 'K8sPV',
        path: '/k8s_pv',
        component: () => import('#/views/k8s/pv/PV.vue'),
        meta: {
          order: 14,
          icon: 'lucide:hard-drive',
          title: 'PV 管理',
        },
      },
      {
        name: 'K8sPVC',
        path: '/k8s_pvc',
        component: () => import('#/views/k8s/pvc/PVC.vue'),
        meta: {
          order: 15,
          icon: 'lucide:database',
          title: 'PVC 管理',
        },
      },
      {
        name: 'K8sRole',
        path: '/k8s_role',
        component: () => import('#/views/k8s/role/Role.vue'),
        meta: {
          order: 16,
          icon: 'lucide:shield',
          title: 'Role 管理',
        },
      },
      {
        name: 'K8sRoleBinding',
        path: '/k8s_rolebinding',
        component: () => import('#/views/k8s/rolebinding/RoleBinding.vue'),
        meta: {
          order: 17,
          icon: 'lucide:key',
          title: 'RoleBinding 管理',
        },
      },
      {
        name: 'K8sClusterRoleBinding',
        path: '/k8s_clusterrolebinding',
        component: () =>
          import('#/views/k8s/clusterrolebinding/ClusterRoleBinding.vue'),
        meta: {
          order: 19,
          icon: 'lucide:settings',
          title: 'ClusterRoleBinding 管理',
        },
      },
      {
        name: 'K8sYamlTemplate',
        path: '/k8s_yaml_template',
        component: () => import('#/views/k8s/template/Template.vue'),
        meta: {
          order: 20,
          icon: 'lucide:file-text',
          title: 'YAML 模板管理',
        },
      },
      {
        name: 'K8sYamlTask',
        path: '/k8s_yaml_task',
        component: () => import('#/views/k8s/task/Task.vue'),
        meta: {
          order: 21,
          icon: 'lucide:file',
          title: 'YAML 任务管理',
        },
      },
    ],
  },
];

export default routes;
