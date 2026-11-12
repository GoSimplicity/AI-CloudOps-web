import type { RouteRecordRaw } from 'vue-router';

import { BasicLayout } from '#/layouts';

const routes: RouteRecordRaw[] = [
  {
    component: BasicLayout,
    meta: {
      icon: 'tabler:cloud-network',
      order: 3,
      title: 'Kubernetes 运维',
    },
    name: 'K8s',
    path: '/k8s',
    children: [
      {
        name: 'K8sCluster',
        path: '/k8s_cluster',
        component: () => import('#/views/k8s/cluster/Cluster.vue'),
        meta: {
          icon: 'lucide:database',
          order: 1,
          title: '集群管理',
        },
      },
      {
        name: 'K8sNamespace',
        path: '/k8s_namespace',
        component: () => import('#/views/k8s/namespace/Namespace.vue'),
        meta: {
          icon: 'lucide:folder',
          order: 2,
          title: '命名空间管理',
        },
      },
      {
        name: 'K8sNode',
        path: '/k8s_node',
        component: () => import('#/views/k8s/node/Node.vue'),
        meta: {
          icon: 'lucide:server',
          order: 3,
          title: '节点管理',
        },
      },
      {
        name: 'K8sDeployment',
        path: '/k8s_deployment',
        component: () => import('#/views/k8s/deployment/Deployment.vue'),
        meta: {
          icon: 'lucide:rocket',
          order: 6,
          title: 'Deployment 管理',
        },
      },
      {
        name: 'K8sStatefulSet',
        path: '/k8s_statefulset',
        component: () => import('#/views/k8s/statefulset/StatefulSet.vue'),
        meta: {
          icon: 'lucide:layers',
          order: 7,
          title: 'StatefulSet 管理',
        },
      },
      {
        name: 'K8sDaemonSet',
        path: '/k8s_daemonset',
        component: () => import('#/views/k8s/daemonset/DaemonSet.vue'),
        meta: {
          icon: 'lucide:shield',
          order: 8,
          title: 'DaemonSet 管理',
        },
      },
      {
        name: 'K8sService',
        path: '/k8s_service',
        component: () => import('#/views/k8s/service/Service.vue'),
        meta: {
          icon: 'lucide:network',
          order: 9,
          title: 'Service 管理',
        },
      },
      {
        name: 'K8sIngress',
        path: '/k8s_ingress',
        component: () => import('#/views/k8s/ingress/Ingress.vue'),
        meta: {
          icon: 'lucide:shield-check',
          order: 10,
          title: 'Ingress 管理',
        },
      },
      {
        name: 'K8sPod',
        path: '/k8s_pod',
        component: () => import('#/views/k8s/pod/Pod.vue'),
        meta: {
          icon: 'lucide:separator-vertical',
          order: 11,
          title: 'Pod 管理',
        },
      },
      {
        name: 'K8sConfigMap',
        path: '/k8s_configmap',
        component: () => import('#/views/k8s/configmap/ConfigMap.vue'),
        meta: {
          icon: 'lucide:settings',
          order: 12,
          title: 'ConfigMap 管理',
        },
      },
      {
        name: 'K8sSecret',
        path: '/k8s_secret',
        component: () => import('#/views/k8s/secret/Secret.vue'),
        meta: {
          icon: 'lucide:key',
          order: 13,
          title: 'Secret 管理',
        },
      },
      {
        name: 'K8sPV',
        path: '/k8s_pv',
        component: () => import('#/views/k8s/pv/PV.vue'),
        meta: {
          icon: 'lucide:hard-drive',
          order: 14,
          title: 'PV 管理',
        },
      },
      {
        name: 'K8sPVC',
        path: '/k8s_pvc',
        component: () => import('#/views/k8s/pvc/PVC.vue'),
        meta: {
          icon: 'lucide:database',
          order: 15,
          title: 'PVC 管理',
        },
      },
      {
        name: 'K8sRole',
        path: '/k8s_role',
        component: () => import('#/views/k8s/role/Role.vue'),
        meta: {
          icon: 'lucide:shield',
          order: 16,
          title: 'Role 管理',
        },
      },
      {
        name: 'K8sRoleBinding',
        path: '/k8s_rolebinding',
        component: () => import('#/views/k8s/rolebinding/RoleBinding.vue'),
        meta: {
          icon: 'lucide:key',
          order: 17,
          title: 'RoleBinding 管理',
        },
      },
      {
        name: 'K8sClusterRoleBinding',
        path: '/k8s_clusterrolebinding',
        component: () =>
          import('#/views/k8s/clusterrolebinding/ClusterRoleBinding.vue'),
        meta: {
          icon: 'lucide:settings',
          order: 19,
          title: 'ClusterRoleBinding 管理',
        },
      },
      {
        name: 'K8sYamlTemplate',
        path: '/k8s_yaml_template',
        component: () => import('#/views/k8s/template/Template.vue'),
        meta: {
          icon: 'lucide:file-text',
          order: 20,
          title: 'YAML 模板管理',
        },
      },
      {
        name: 'K8sYamlTask',
        path: '/k8s_yaml_task',
        component: () => import('#/views/k8s/task/Task.vue'),
        meta: {
          icon: 'lucide:file',
          order: 21,
          title: 'YAML 任务管理',
        },
      },
    ],
  },
];

export default routes;
