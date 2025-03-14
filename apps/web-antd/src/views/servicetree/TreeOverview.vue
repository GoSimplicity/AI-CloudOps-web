<template>
  <a-layout style="height: 100vh;">
    <a-layout-sider width="320" theme="light">
      <div style="padding: 24px;">
        <a-tree :field-names="{ title: 'title', key: 'key', children: 'children' }" :tree-data="treeData"
          default-expand-all show-line draggable @select="onSelect" />
        <a-button type="primary" block style="margin-top: 16px" @click="showAddModal">
          <a-icon type="plus" /> 新增节点
          <a-modal v-model:visible="isSelectVisible" title="新增节点" @ok="handleAdd" okText="新增" cancelText="取消">
            <a-form :model="addForm" :label-col="{ span: 6 }" :wrapper-col="{ span: 16 }" ref="addFormRef">
              <a-form-item label="节点名称" name="title" :rules="[{ required: true, message: '请输入节点名称' }]">
                <a-input v-model:value="addForm.title" placeholder="请输入节点名称" />
              </a-form-item>
              <a-form-item label="创建类型" name="isLeaf" :rules="[{ required: true, message: '请选择是否为叶节点' }]">
                <a-select v-model:value="addForm.isLeaf" placeholder="请选择">
                  <a-select-option :value=0>目录</a-select-option>
                  <a-select-option :value=1>叶节点</a-select-option>
                </a-select>
              </a-form-item>
              <a-form-item label="描述" name="description">
                <a-input v-model:value="addForm.description" placeholder="请输入描述" />
              </a-form-item>
              <a-form-item label="父节点" name="pId">
                <a-tree-select
                  v-if="isSelectVisible"
                  v-model:value="addForm.pId"
                  style="width: 100%"
                  :dropdown-style="{ maxHeight: '400px', overflow: 'auto' }"
                  :tree-data="directoryNodes"
                  placeholder="请选择父节点"
                  tree-default-expand-all
                  :field-names="{ label: 'title', value: 'id', children: 'children' }"
                  :tree-line="true"
                  @select="onParentSelect"
                />
              </a-form-item>
            </a-form>
          </a-modal>
        </a-button>
      </div>
    </a-layout-sider>
    <a-layout>
      <a-layout-content style="padding: 24px">
        <div v-if="selectedNode">
          <a-card title="节点详情" bordered>
            <template #extra>
              <span>
                <a-button type="primary" size="small" @click="showEditModal">
                  <a-icon type="edit" /> 编辑节点
                  <a-modal v-model:visible="isEditVisible" title="编辑节点" @ok="handleEdit" okText="保存" cancelText="取消">
                    <a-form :model="editForm" :label-col="{ span: 6 }" :wrapper-col="{ span: 16 }" ref="editFormRef">
                      <a-form-item label="节点名称" name="title" :rules="[{ required: true, message: '请输入节点名称' }]">
                        <a-input v-model:value="editForm.title" placeholder="请输入节点名称" />
                      </a-form-item>
                      <a-form-item label="描述" name="description">
                        <a-input v-model:value="editForm.desc" placeholder="请输入描述" />
                      </a-form-item>
                      <a-form-item label="运维负责人" name="ops_admins">
                        <a-select v-model:value="editForm.ops_admins" mode="multiple" placeholder="请选择运维负责人">
                          <a-select-option v-for="user in userList" :key="user.id" :value="user.id">
                            {{ user.username }}
                          </a-select-option>
                        </a-select>
                      </a-form-item>
                      <a-form-item label="研发负责人" name="rd_admins">
                        <a-select v-model:value="editForm.rd_admins" mode="multiple" placeholder="请选择研发负责人">
                          <a-select-option v-for="user in userList" :key="user.id" :value="user.id">
                            {{ user.username }}
                          </a-select-option>
                        </a-select>
                      </a-form-item>
                      <a-form-item label="研发工程师" name="rd_members">
                        <a-select v-model:value="editForm.rd_members" mode="multiple" placeholder="请选择研发工程师">
                          <a-select-option v-for="user in userList" :key="user.id" :value="user.id">
                            {{ user.username }}
                          </a-select-option>
                        </a-select>
                      </a-form-item>
                    </a-form>
                  </a-modal>
                </a-button>
              </span>
            </template>
            <a-descriptions bordered column="2">
              <a-descriptions-item label="描述">{{ selectedNode.desc }}</a-descriptions-item>
              <a-descriptions-item label="Level 等级">{{ selectedNode.level }}</a-descriptions-item>
              <a-descriptions-item label="运维负责人">
                <a-tag v-for="person in selectedNode.ops_admins" :key="person.id" color="blue">
                  {{ person.name }}
                </a-tag>
              </a-descriptions-item>
              <a-descriptions-item label="研发负责人">
                <a-tag v-for="person in selectedNode.rd_admins" :key="person.id" color="green">
                  {{ person.name }}
                </a-tag>
              </a-descriptions-item>
              <a-descriptions-item label="研发工程师">
                <a-tag v-for="engineer in selectedNode.rd_members" :key="engineer.id" color="purple">
                  {{ engineer.name }}
                </a-tag>
              </a-descriptions-item>
              <a-descriptions-item label="绑定的 ECS 数量">{{ selectedNode.ecsNum }}</a-descriptions-item>
              <a-descriptions-item label="绑定的 ELB 数量">{{ selectedNode.elbNum }}</a-descriptions-item>
              <a-descriptions-item label="绑定的 RDS 数量">{{ selectedNode.rdsNum }}</a-descriptions-item>
            </a-descriptions>

            <a-divider orientation="left">ECS 资源详情</a-divider>
            <a-table :columns="ecsColumns" :data-source="selectedNode.bind_ecs" rowKey="id" :pagination="false"
              size="small" bordered />

            <a-divider orientation="left">ELB 资源详情</a-divider>
            <a-table :columns="elbColumns" :data-source="selectedNode.bind_elb" rowKey="id" :pagination="false"
              size="small" bordered />

            <a-divider orientation="left">RDS 资源详情</a-divider>
            <a-table :columns="rdsColumns" :data-source="selectedNode.bind_rds" rowKey="id" :pagination="false"
              size="small" bordered />
          </a-card>
        </div>

        <div v-else style="display: flex; justify-content: center; align-items: center; height: 100%;">
          <a-result title="请选择一个节点查看详情" icon="info-circle" status="info" />
        </div>
      </a-layout-content>
    </a-layout>
  </a-layout>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted, computed } from 'vue';
import type { TreeNode } from '#/api/core/tree';
import { message } from 'ant-design-vue';
import { getAllTreeNodes, createTreeNode, updateTreeNode, getAllUsers } from '#/api';

const treeData = ref<TreeNode[]>([]);
const flatTreeData = ref<TreeNode[]>([]);
const selectedNode = ref<TreeNode | null>(null);
const isSelectVisible = ref(false);
const isEditVisible = ref(false);
const addFormRef = ref(); // 添加表单引用
const editFormRef = ref(); // 添加表单引用
const userList = ref<Person[]>([]); // 用户列表

const addForm = reactive({
  title: '',
  description: '',
  pId: 0,
  isLeaf: 0,
  level: 1, // 默认值，会根据父节点自动计算
});

// 计算属性：过滤出所有目录节点构建树形结构
const directoryNodes = computed(() => {
  const filterDirectoryNodes = (nodes: TreeNode[]): TreeNode[] => {
    return nodes
      .filter(node => !node.isLeaf)
      .map(node => ({
        ...node,
        children: node.children ? filterDirectoryNodes(node.children) : []
      }));
  };
  
  return [
    { id: 0, title: '顶级节点', key: '0', level: 0 },
    ...filterDirectoryNodes(treeData.value)
  ];
});

// 根据选择的父节点自动计算level
const onParentSelect = (value: number) => {
  if (value === 0) {
    addForm.level = 1;
    return;
  }
  
  const parentNode = findNodeById(treeData.value, value);
  if (parentNode) {
    addForm.level = parentNode.level + 1;
  }
};

const findNodeById = (nodes: TreeNode[], id: number): TreeNode | null => {
  for (const node of nodes) {
    if (node.id === id) return node;
    if (node.children) {
      const result = findNodeById(node.children, id);
      if (result) return result;
    }
  }
  return null;
};

interface Person {
  id: number;
  name: string;
  realName: string;
  roles: string[];
  userId: number;
  username: string;
}

const editForm = reactive({
  id: 0,
  title: '',
  desc: '',
  ops_admins: [] as number[],
  rd_admins: [] as number[],
  rd_members: [] as number[],
});

const ecsColumns = [
  { title: 'id', dataIndex: 'id', key: 'id' },
  { title: '操作系统类型', dataIndex: 'osType', key: 'osType' },
  { title: '实例类型', dataIndex: 'instanceType', key: 'instanceType' },
  { title: 'CPU 核数', dataIndex: 'cpu', key: 'cpu' },
  { title: '内存 (GiB)', dataIndex: 'memory', key: 'memory' },
  { title: '磁盘 (GiB)', dataIndex: 'disk', key: 'disk' },
  { title: '主机名', dataIndex: 'hostname', key: 'hostname' },
];

const elbColumns = [
  { title: 'id', dataIndex: 'id', key: 'id' },
  { title: '载均衡类型', dataIndex: 'loadBalancerType', key: 'loadBalancerType' },
  { title: '带宽容量 (Mb)', dataIndex: 'bandwidthCapacity', key: 'bandwidthCapacity' },
  { title: '地址类型', dataIndex: 'addressType', key: 'addressType' },
  { title: 'DNS 名称', dataIndex: 'dnsName', key: 'dnsName' },
];

const rdsColumns = [
  { title: 'id', dataIndex: 'id', key: 'id' },
  { title: '引擎类型', dataIndex: 'engine', key: 'engine' },
  { title: '网络类型', dataIndex: 'dbInstanceNetType', key: 'dbInstanceNetType' },
  { title: '实例规格', dataIndex: 'dbInstanceClass', key: 'dbInstanceClass' },
  { title: '实例类型', dataIndex: 'dbInstanceType', key: 'dbInstanceType' },
  { title: '版本', dataIndex: 'engineVersion', key: 'engineVersion' },
  { title: '状态', dataIndex: 'dbInstanceStatus', key: 'dbInstanceStatus' },
];

const fetchTreeData = () => {
  getAllTreeNodes().then(response => {
    if (!response) {
      treeData.value = [];
      flatTreeData.value = [];
      return;
    }
    treeData.value = response;
    flatTreeData.value = [];
    flattenTree(treeData.value, flatTreeData.value);
  }).catch(error => {
    message.error(error.message || '获取树数据失败');
  });
};

const flattenTree = (nodes: TreeNode[], flatList: TreeNode[]) => {
  nodes.forEach(node => {
    flatList.push(node);
    if (node.children && node.children.length > 0) {
      flattenTree(node.children, flatList);
    }
  });
};

const onSelect = (keys: string[]) => {
  if (keys.length > 0) {
    const key = keys[0];
    if (key) {
      selectedNode.value = findNodeByKey(treeData.value, key);
    }
  }
};

const findNodeByKey = (data: TreeNode[], key: string): TreeNode | null => {
  for (const node of data) {
    if (node.key === key) return node;
    if (node.children) {
      const result = findNodeByKey(node.children, key);
      if (result) return result;
    }
  }
  return null;
};

const showAddModal = () => {
  isSelectVisible.value = true;
  resetForm(addForm);
};

const handleAdd = async () => {
  try {
    await addFormRef.value.validate();
    const response = await createTreeNode({
      title: addForm.title,
      pId: addForm.pId,
      desc: addForm.description,
      isLeaf: addForm.isLeaf,
      level: addForm.level,
    });

    if (response) {
      message.success('新增节点成功');
      isSelectVisible.value = false;
      resetForm(addForm);
      fetchTreeData();
    }
  } catch (error) {
    message.error(error.message || '新增节点失败');
  }
};

const showEditModal = () => {
  if (selectedNode.value) {
    editForm.id = selectedNode.value.id;
    editForm.title = selectedNode.value.title;
    editForm.desc = selectedNode.value.desc;
    editForm.ops_admins = selectedNode.value.ops_admins?.map(admin => admin.id) || [];
    editForm.rd_admins = selectedNode.value.rd_admins?.map(admin => admin.id) || [];
    editForm.rd_members = selectedNode.value.rd_members?.map(member => member.id) || [];
    
    isEditVisible.value = true;
  }
};

const handleEdit = async () => {
  try {
    await editFormRef.value.validate();
    await updateTreeNode({
      id: editForm.id,
      title: editForm.title,
      desc: editForm.desc,
      ops_admins: editForm.ops_admins,
      rd_admins: editForm.rd_admins,
      rd_members: editForm.rd_members,
    });

    message.success('编辑节点成功');
    isEditVisible.value = false;
    fetchTreeData();
  } catch (error) {
    message.error(error.message || '编辑节点失败');
  }
};

const resetForm = (form: any) => {
  Object.keys(form).forEach(key => {
    if (key === 'pId') {
      form[key] = 0;
    } else if (key === 'level') {
      form[key] = 1;
    } else if (key === 'isLeaf') {
      form[key] = 0;
    } else {
      form[key] = '';
    }
  });
};

const fetchUsers = async () => {
  try {
    const response = await getAllUsers();
    if (response) {
      userList.value = response;
    }
  } catch (error) {
    message.error(error.message || '获取用户列表失败');
  }
};

onMounted(() => {
  fetchTreeData();
  fetchUsers();
});
</script>

<style scoped>
h2 {
  margin-bottom: 16px;
  font-size: 24px;
  color: #1890ff;
}

h3 {
  margin-top: 24px;
  margin-bottom: 16px;
  font-size: 20px;
  color: #595959;
}

.a-button .anticon {
  margin-right: 4px;
}

.a-card {
  margin-bottom: 24px;
}
</style>
