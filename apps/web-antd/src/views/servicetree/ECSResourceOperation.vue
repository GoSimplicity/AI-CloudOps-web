<template>
  <div>
    <!-- 操作工具栏 -->
    <div class="custom-toolbar">
      <div class="search-filters">
        <a-input 
          v-model:value="searchText" 
          placeholder="请输入ECS资源名称" 
          style="width: 200px" 
        />
      </div>
      <div class="action-buttons">
        <a-button type="primary" @click="handleAddResource">新增ECS资源</a-button>
      </div>
    </div>

    <!-- 资源列表 -->
    <a-table 
      :columns="columns" 
      :data-source="filteredData" 
      row-key="id" 
      :pagination="{ pageSize: 10 }"
    >
      <template #action="{ record }">
        <a-space>
          <a-tooltip title="编辑资源信息">
            <a-button type="link" @click="handleEditResource(record)">
              <template #icon><Icon icon="clarity:note-edit-line" style="font-size: 22px" /></template>
            </a-button>
          </a-tooltip>
          <a-tooltip title="删除资源">
            <a-button type="link" danger @click="handleDeleteResource(record)">
              <template #icon><Icon icon="ant-design:delete-outlined" style="font-size: 22px" /></template>
            </a-button>
          </a-tooltip>
          <a-tooltip :title="record.isBound ? '解绑服务树' : '绑定到服务树'">
            <a-button type="link" @click="record.isBound ? handleUnbindFromNode(record) : handleBindToNode(record)">
              <template #icon>
                <Icon :icon="record.isBound ? 'ant-design:disconnect-outlined' : 'ant-design:link-outlined'" style="font-size: 22px" />
              </template>
            </a-button>
          </a-tooltip>
          <a-tooltip title="终端连接">
            <a-button type="link" @click="handleTerminalConnect(record)">
              <template #icon><Icon icon="ant-design:code-outlined" style="font-size: 22px" /></template>
            </a-button>
          </a-tooltip>
        </a-space>
      </template>
    </a-table>

    <!-- 新增资源模态框 -->
    <a-modal v-model:visible="isCreateModalVisible" title="新增资源" @ok="handleCreateECS" @cancel="handleCancel">
      <a-form :model="createForm" :label-col="{ span: 6 }" :wrapper-col="{ span: 16 }" ref="createFormRef">
        <!-- 供应商选择 -->
        <a-form-item label="供应商" name="vendor" :rules="[
          { required: true, type: 'string', message: '请选择供应商' }
        ]">
          <a-select v-model:value="createForm.vendor" placeholder="请选择供应商" style="width: 100%">
            <a-select-option :value="'1'">个人</a-select-option>
            <a-select-option :value="'2'">阿里云</a-select-option>
            <a-select-option :value="'3'">华为云</a-select-option>
            <a-select-option :value="'4'">腾讯云</a-select-option>
            <a-select-option :value="'5'">AWS</a-select-option>
          </a-select>
        </a-form-item>

        <!-- 个人供应商通用字段 -->
        <template v-if="createForm.vendor === '1'">
          <a-form-item label="资源名称" name="instanceName" :rules="[{ required: true, message: '请输入资源名称' }]">
            <a-input v-model:value="createForm.instanceName" placeholder="请输入资源名称" />
          </a-form-item>

          <a-form-item label="IP地址" name="ipAddr" :rules="[{ required: true, message: '请输入IP地址' }]">
            <a-input v-model:value="createForm.ipAddr" placeholder="请输入IP地址" />
          </a-form-item>

          <a-form-item label="主机名" name="hostname">
            <a-input v-model:value="createForm.hostname" placeholder="请输入主机名" />
          </a-form-item>

          <!-- 新增mode和password字段 -->
          <a-form-item label="连接模式" name="mode">
            <a-select v-model:value="createForm.mode" placeholder="请选择连接模式">
              <a-select-option value="password">密码</a-select-option>
              <a-select-option value="key">密钥</a-select-option>
            </a-select>
          </a-form-item>

          <a-form-item label="密码" name="password">
            <a-input-password v-model:value="createForm.password" placeholder="请输入密码" />
          </a-form-item>

          <a-form-item label="操作系统" name="osName">
            <a-input v-model:value="createForm.osName" placeholder="请输入系统名称" />
          </a-form-item>

          <a-form-item label="描述" name="description">
            <a-input v-model:value="createForm.description" placeholder="请输入资源描述" />
          </a-form-item>

          <!-- 支持多标签输入 -->
          <a-form-item label="标签" name="tags">
            <a-select mode="tags" v-model:value="createForm.tags" placeholder="请输入标签" style="width: 100%">
              <a-select-option v-for="tag in createForm.tags" :key="tag" :value="tag">
                {{ tag }}
              </a-select-option>
            </a-select>
          </a-form-item>
        </template>

        <!-- 非个人供应商特有字段 -->
        <template v-else>
          <a-divider>非个人供应商详情</a-divider>

          <a-form-item label="名称" name="name" :rules="[{ required: true, message: '请输入名称' }]">
            <a-input v-model:value="createForm.name" placeholder="请输入名称" />
          </a-form-item>

          <a-form-item label="区域" name="region" :rules="[{ required: true, message: '请输入区域' }]">
            <a-input v-model:value="createForm.region" placeholder="请输入区域" />
          </a-form-item>

          <a-form-item label="描述" name="description">
            <a-input v-model:value="createForm.description" placeholder="请输入描述" />
          </a-form-item>
          
          <!-- 实例信息 -->
          <a-divider>实例信息</a-divider>
          <a-form-item label="可用区" name="instance_availability_zone" :rules="[{ required: true, message: '请输入可用区' }]">
            <a-input v-model:value="createForm.instance_availability_zone" placeholder="请输入可用区" />
          </a-form-item>

          <a-form-item label="实例类型" name="instance_type" :rules="[{ required: true, message: '请输入实例类型' }]">
            <a-input v-model:value="createForm.instance_type" placeholder="请输入实例类型" />
          </a-form-item>

          <a-form-item label="系统盘类别" name="system_disk_category" :rules="[{ required: true, message: '请输入系统盘类别' }]">
            <a-input v-model:value="createForm.system_disk_category" placeholder="请输入系统盘类别" />
          </a-form-item>

          <a-form-item label="系统盘名称" name="system_disk_name" :rules="[{ required: true, message: '请输入系统盘名称' }]">
            <a-input v-model:value="createForm.system_disk_name" placeholder="请输入系统盘名称" />
          </a-form-item>

          <a-form-item label="系统盘描述" name="system_disk_description">
            <a-input v-model:value="createForm.system_disk_description" placeholder="请输入系统盘描述" />
          </a-form-item>

          <a-form-item label="镜像ID" name="image_id" :rules="[{ required: true, message: '请输入镜像ID' }]">
            <a-input v-model:value="createForm.image_id" placeholder="请输入镜像ID" />
          </a-form-item>

          <a-form-item label="实例名称" name="instance_name" :rules="[{ required: true, message: '请输入实例名称' }]">
            <a-input v-model:value="createForm.instance_name" placeholder="请输入实例名称" />
          </a-form-item>

          <a-form-item label="公网出带宽" name="internet_max_bandwidth_out"
            :rules="[{ required: true, message: '请输入公网出带宽' }]">
            <a-input-number v-model:value="createForm.internet_max_bandwidth_out" placeholder="请输入公网出带宽"
              style="width: 100%" />
          </a-form-item>

          <!-- VPC 信息 -->
          <a-divider>VPC 信息</a-divider>
          <a-form-item label="VPC名称" name="vpc_name" :rules="[{ required: true, message: '请输入VPC名称' }]">
            <a-input v-model:value="createForm.vpc_name" placeholder="请输入VPC名称" />
          </a-form-item>

          <a-form-item label="CIDR块" name="cidr_block" :rules="[{ required: true, message: '请输入CIDR块' }]">
            <a-input v-model:value="createForm.cidr_block" placeholder="请输入CIDR块" />
          </a-form-item>

          <a-form-item label="VSwitch CIDR" name="vswitch_cidr"
            :rules="[{ required: true, message: '请输入VSwitch CIDR' }]">
            <a-input v-model:value="createForm.vswitch_cidr" placeholder="请输入VSwitch CIDR" />
          </a-form-item>

          <a-form-item label="区域ID" name="zone_id" :rules="[{ required: true, message: '请输入区域ID' }]">
            <a-input v-model:value="createForm.zone_id" placeholder="请输入区域ID" />
          </a-form-item>

          <!-- 安全组信息 -->
          <a-divider>安全组信息</a-divider>
          <a-form-item label="安全组名称" name="security_group_name" :rules="[{ required: true, message: '请输入安全组名称' }]">
            <a-input v-model:value="createForm.security_group_name" placeholder="请输入安全组名称" />
          </a-form-item>

          <a-form-item label="安全组描述" name="security_group_description">
            <a-input v-model:value="createForm.security_group_description" placeholder="请输入安全组描述" />
          </a-form-item>

          <!-- 新增mode和password字段 -->
          <a-form-item label="连接模式" name="mode">
            <a-select v-model:value="createForm.mode" placeholder="请选择连接模式">
              <a-select-option value="password">密码</a-select-option>
              <a-select-option value="key">密钥</a-select-option>
            </a-select>
          </a-form-item>

          <a-form-item label="密码" name="password">
            <a-input-password v-model:value="createForm.password" placeholder="请输入密码" />
          </a-form-item>
        </template>
      </a-form>
    </a-modal>

    <!-- 编辑资源模态框 -->
    <a-modal v-model:visible="isEditModalVisible" title="编辑资源" @ok="handleEditECS" @cancel="handleEditCancel">
      <a-form :model="editForm" :label-col="{ span: 6 }" :wrapper-col="{ span: 16 }" ref="editFormRef">
        <!-- 公共字段 -->
        <a-form-item label="供应商" name="vendor" :rules="[{ required: true, type: 'string', message: '请选择供应商' }]">
          <a-select v-model:value="editForm.vendor" placeholder="请选择供应商" style="width: 100%">
            <a-select-option :value="'1'">个人</a-select-option>
            <a-select-option :value="'2'">阿里云</a-select-option>
            <a-select-option :value="'3'">华为云</a-select-option>
            <a-select-option :value="'4'">腾讯云</a-select-option>
            <a-select-option :value="'5'">AWS</a-select-option>
          </a-select>
        </a-form-item>

        <!-- 个人供应商通用字段 -->
        <template v-if="editForm.vendor === '1'">
          <a-form-item label="资源名称" name="instanceName" :rules="[{ required: true, message: '请输入资源名称' }]">
            <a-input v-model:value="editForm.instanceName" placeholder="请输入资源名称" />
          </a-form-item>

          <a-form-item label="IP地址" name="ipAddr" :rules="[{ required: true, message: '请输入IP地址' }]">
            <a-input v-model:value="editForm.ipAddr" placeholder="请输入IP地址" />
          </a-form-item>

          <a-form-item label="主机名" name="hostname">
            <a-input v-model:value="editForm.hostname" placeholder="请输入主机名" />
          </a-form-item>

          <a-form-item label="操作系统" name="osName">
            <a-input v-model:value="editForm.osName" placeholder="请输入系统名称" />
          </a-form-item>

          <a-form-item label="描述" name="description">
            <a-input v-model:value="editForm.description" placeholder="请输入资源描述" />
          </a-form-item>

          <!-- 支持多标签输入 -->
          <a-form-item label="标签" name="tags">
            <a-select mode="tags" v-model:value="editForm.tags" placeholder="请输入标签" style="width: 100%">
              <a-select-option v-for="tag in editForm.tags" :key="tag" :value="tag">
                {{ tag }}
              </a-select-option>
            </a-select>
          </a-form-item>

          <!-- 新增mode和password字段 -->
          <a-form-item label="连接模式" name="mode">
            <a-select v-model:value="editForm.mode" placeholder="请选择连接模式">
              <a-select-option value="password">密码</a-select-option>
              <a-select-option value="key">密钥</a-select-option>
            </a-select>
          </a-form-item>

          <a-form-item label="密码" name="password">
            <a-input-password v-model:value="editForm.password" placeholder="请输入密码" />
          </a-form-item>
        </template>

        <!-- 非个人供应商特有字段 -->
        <template v-else>
          <a-divider>非个人供应商详情</a-divider>

          <a-form-item label="名称" name="name" :rules="[{ required: true, message: '请输入名称' }]">
            <a-input v-model:value="editForm.name" placeholder="请输入名称" />
          </a-form-item>

          <a-form-item label="区域" name="region" :rules="[{ required: true, message: '请输入区域' }]">
            <a-input v-model:value="editForm.region" placeholder="请输入区域" />
          </a-form-item>

          <a-form-item label="描述" name="description">
            <a-input v-model:value="editForm.description" placeholder="请输入描述" />
          </a-form-item>

          <!-- 实例信息 -->
          <a-divider>实例信息</a-divider>
          
          <a-form-item label="实例名称" name="instance_name" :rules="[{ required: true, message: '请输入实例名称' }]">
            <a-input v-model:value="editForm.instance_name" placeholder="请输入实例名称" />
          </a-form-item>

          <a-form-item label="可用区" name="instance_availability_zone" :rules="[{ required: true, message: '请输入可用区' }]">
            <a-input v-model:value="editForm.instance_availability_zone" placeholder="请输入可用区" />
          </a-form-item>

          <a-form-item label="实例类型" name="instance_type" :rules="[{ required: true, message: '请输入实例类型' }]">
            <a-input v-model:value="editForm.instance_type" placeholder="请输入实例类型" />
          </a-form-item>

          <a-form-item label="系统盘类别" name="system_disk_category" :rules="[{ required: true, message: '请输入系统盘类别' }]">
            <a-input v-model:value="editForm.system_disk_category" placeholder="请输入系统盘类别" />
          </a-form-item>

          <a-form-item label="系统盘名称" name="system_disk_name" :rules="[{ required: true, message: '请输入系统盘名称' }]">
            <a-input v-model:value="editForm.system_disk_name" placeholder="请输入系统盘名称" />
          </a-form-item>

          <a-form-item label="系统盘描述" name="system_disk_description">
            <a-input v-model:value="editForm.system_disk_description" placeholder="请输入系统盘描述" />
          </a-form-item>

          <a-form-item label="镜像ID" name="image_id" :rules="[{ required: true, message: '请输入镜像ID' }]">
            <a-input v-model:value="editForm.image_id" placeholder="请输入镜像ID" />
          </a-form-item>

          <a-form-item label="公网出带宽" name="internet_max_bandwidth_out"
            :rules="[{ required: true, message: '请输入公网出带宽' }]">
            <a-input-number v-model:value="editForm.internet_max_bandwidth_out" placeholder="请输入公网出带宽"
              style="width: 100%" />
          </a-form-item>

          <!-- VPC 信息 -->
          <a-divider>VPC 信息</a-divider>
          <a-form-item label="VPC名称" name="vpc_name" :rules="[{ required: true, message: '请输入VPC名称' }]">
            <a-input v-model:value="editForm.vpc_name" placeholder="请输入VPC名称" />
          </a-form-item>

          <a-form-item label="CIDR块" name="cidr_block" :rules="[{ required: true, message: '请输入CIDR块' }]">
            <a-input v-model:value="editForm.cidr_block" placeholder="请输入CIDR块" />
          </a-form-item>

          <a-form-item label="VSwitch CIDR" name="vswitch_cidr"
            :rules="[{ required: true, message: '请输入VSwitch CIDR' }]">
            <a-input v-model:value="editForm.vswitch_cidr" placeholder="请输入VSwitch CIDR" />
          </a-form-item>

          <a-form-item label="区域ID" name="zone_id" :rules="[{ required: true, message: '请输入区域ID' }]">
            <a-input v-model:value="editForm.zone_id" placeholder="请输入区域ID" />
          </a-form-item>

          <!-- 安全组信息 -->
          <a-divider>安全组信息</a-divider>
          <a-form-item label="安全组名称" name="security_group_name" :rules="[{ required: true, message: '请输入安全组名称' }]">
            <a-input v-model:value="editForm.security_group_name" placeholder="请输入安全组名称" />
          </a-form-item>

          <a-form-item label="安全组描述" name="security_group_description">
            <a-input v-model:value="editForm.security_group_description" placeholder="请输入安全组描述" />
          </a-form-item>

          <!-- 新增mode和password字段 -->
          <a-form-item label="连接模式" name="mode">
            <a-select v-model:value="editForm.mode" placeholder="请选择连接模式">
              <a-select-option value="password">密码</a-select-option>
              <a-select-option value="key">密钥</a-select-option>
            </a-select>
          </a-form-item>

          <a-form-item label="密码" name="password">
            <a-input-password v-model:value="editForm.password" placeholder="请输入密码" />
          </a-form-item>
        </template>
      </a-form>
    </a-modal>

    <!-- 绑定资源模态框 -->
    <a-modal v-model:visible="isBindModalVisible" title="绑定到服务树" @ok="confirmBind" @cancel="handleBindCancel">
      <a-tree :tree-data="treeNodes" :checkable="false" @select="onNodeSelect"
        :default-expanded-keys="defaultExpandedKeys" />
    </a-modal>
  </div>
</template>

<script lang="ts" setup>
import { reactive, ref, onMounted, computed } from 'vue';
import { message, Modal } from 'ant-design-vue';
import { Icon } from '@iconify/vue';
import {
  getAllECSResources,
  createECSResources,
  deleteECSResources,
  editECSResources,
  bindECSResources,
  unbindECSResources,
  getAllTreeNodes,
  createAliECSResources,
  editOtherECSResources,
  deleteOtherECSResources,
} from '#/api';
import { useRouter } from 'vue-router';
import type { ResourceEcs, TreeNode } from '#/api';

const router = useRouter();

const vendorMap: { [key: string]: string } = {
  '1': '个人',
  '2': '阿里云',
  '3': '华为云', 
  '4': '腾讯云',
  '5': 'AWS',
};

// 创建表单
const createForm = reactive({
  instanceName: '',
  description: '',
  tags: [] as string[],
  vendor: null as string | null,
  hostname: '',
  ipAddr: '',
  osName: '',
  mode: '',
  password: '',

  // 非个人供应商字段
  name: '',
  region: '',
  instance_name: '',
  instance_availability_zone: '',
  instance_type: '',
  system_disk_category: '',
  system_disk_name: '',
  system_disk_description: '',
  image_id: '',
  internet_max_bandwidth_out: null as number | null,
  vpc_name: '',
  cidr_block: '',
  vswitch_cidr: '',
  zone_id: '',
  security_group_name: '',
  security_group_description: '',
});

// 编辑表单
const editForm = reactive({
  id: 0,
  instanceName: '',
  description: '',
  tags: [] as string[],
  vendor: null as string | null,
  hostname: '',
  ipAddr: '',
  osName: '',
  mode: '',
  password: '',

  // 非个人供应商字段
  name: '',
  region: '',
  instance_name: '',
  instance_availability_zone: '',
  instance_type: '',
  system_disk_category: '',
  system_disk_name: '',
  system_disk_description: '',
  image_id: '',
  internet_max_bandwidth_out: null as number | null,
  vpc_name: '',
  cidr_block: '',
  vswitch_cidr: '',
  zone_id: '',
  security_group_name: '',
  security_group_description: '',
});

// 资源数据
const data = reactive<ResourceEcs[]>([]);

// 搜索文本
const searchText = ref('');

// 过滤后的数据
const filteredData = computed(() => {
  const searchValue = searchText.value.trim().toLowerCase();
  return data.filter(resource => 
    resource.instanceName?.toLowerCase().includes(searchValue) ||
    resource.ipAddr?.toLowerCase().includes(searchValue)
  );
});

// 模态框状态
const isBindModalVisible = ref(false);
const isCreateModalVisible = ref(false);
const isEditModalVisible = ref(false);

// 树节点数据
const treeNodes = ref<TreeNode[]>([]);

// 默认展开的节点
const defaultExpandedKeys = ref<number[]>([]);

// 选择的节点ID
const selectedNodeId = ref<number | null>(null);

// 资源待绑定
const resourceToBind = ref<ResourceEcs | null>(null);

// 表格列配置
const columns = [
  {
    title: 'ID',
    dataIndex: 'id',
    key: 'id',
    width: 80,
  },
  {
    title: '资源名称',
    dataIndex: 'instanceName',
    key: 'instanceName',
    width: 200,
  },
  {
    title: '供应商',
    dataIndex: 'vendor',
    key: 'vendor',
    width: 100,
    customRender: ({ text }: { text: string }) => vendorMap[text] || '未知',
  },
  {
    title: '状态',
    dataIndex: 'status',
    key: 'status',
    width: 100,
  },
  {
    title: 'IP地址',
    dataIndex: 'ipAddr',
    key: 'ipAddr',
    width: 140,
  },
  {
    title: '描述',
    dataIndex: 'description',
    key: 'description',
    ellipsis: true,
  },
  {
    title: '创建时间',
    dataIndex: 'CreatedAt',
    key: 'CreatedAt',
    width: 160,
  },
  {
    title: '操作',
    key: 'action',
    slots: { customRender: 'action' },
    fixed: 'right',
    width: 250,
  },
];

// 获取资源数据
const fetchResources = async () => {
  try {
    const [ecsResponse, treeResponse] = await Promise.all([
      getAllECSResources(),
      getAllTreeNodes(),
    ]);

    if (!ecsResponse) {
      data.splice(0, data.length);
      return;
    }

    if (!treeResponse) {
      ecsResponse.forEach(ecs => {
        ecs.isBound = false;
        ecs.boundNodeId = undefined;
      });
      data.splice(0, data.length, ...ecsResponse);
      return;
    }

    ecsResponse.forEach(ecs => {
      ecs.isBound = false;
      treeResponse.forEach(node => {
        if (node.bind_ecs?.some(boundEcs => boundEcs.id === ecs.id)) {
          ecs.isBound = true;
          ecs.boundNodeId = node.id;
        }
      });
    });
    data.splice(0, data.length, ...ecsResponse);
  } catch (error: any) {
    message.error(error.message || '获取ECS资源数据失败');
  }
};

// 获取树节点数据
const fetchTreeNodes = async () => {
  try {
    const response = await getAllTreeNodes();
    if (!response) {
      treeNodes.value = [];
      defaultExpandedKeys.value = [];
      return;
    }
    treeNodes.value = response;
    defaultExpandedKeys.value = response.map(node => node.id);
  } catch (error: any) {
    message.error(error.message || '获取树节点失败');
  }
};

// 处理创建资源
const handleCreateECS = async () => {
  if (createForm.vendor === '1') {
    if (!createForm.instanceName) {
      message.error('请输入资源名称');
      return;
    }

    createForm.tags = createForm.tags.filter(tag => tag.trim() !== '');

    try {
      await createECSResources({
        instanceName: createForm.instanceName,
        description: createForm.description,
        tags: createForm.tags,
        vendor: createForm.vendor,
        hostname: createForm.hostname,
        ipAddr: createForm.ipAddr,
        osName: createForm.osName,
        mode: createForm.mode,
        password: createForm.password,
      });

      message.success('新增ECS资源成功');
      fetchResources();
      isCreateModalVisible.value = false;

    } catch (error: any) {
      message.error(error.message || '创建ECS资源失败');
    }
  } else if (createForm.vendor === '2') {
    const requiredFields = [
      'name', 'region',
      'instance_availability_zone', 'instance_type', 'system_disk_category',
      'system_disk_name', 'image_id', 'instance_name', 'internet_max_bandwidth_out',
      'vpc_name', 'cidr_block', 'vswitch_cidr', 'zone_id',
      'security_group_name'
    ];

    for (const field of requiredFields) {
      if (!createForm[field as keyof typeof createForm]) {
        message.error(`请输入${field}`);
        return;
      }
    }

    if (createForm.internet_max_bandwidth_out === null) {
      message.error('请输入公网出带宽');
      return;
    }

    createForm.tags = createForm.tags.filter(tag => tag.trim() !== '');

    try {
      const payload = {
        name: createForm.name,
        region: createForm.region,
        instance: {
          instance_availability_zone: createForm.instance_availability_zone,
          instance_type: createForm.instance_type,
          system_disk_category: createForm.system_disk_category,
          system_disk_name: createForm.system_disk_name,
          system_disk_description: createForm.system_disk_description,
          image_id: createForm.image_id,
          instance_name: createForm.instance_name,
          internet_max_bandwidth_out: createForm.internet_max_bandwidth_out,
        },
        vpc: {
          vpc_name: createForm.vpc_name,
          cidr_block: createForm.cidr_block,
          vswitch_cidr: createForm.vswitch_cidr,
          zone_id: createForm.zone_id,
        },
        security: {
          security_group_name: createForm.security_group_name,
          security_group_description: createForm.security_group_description,
        },
        instanceName: createForm.instanceName,
        description: createForm.description,
        tags: createForm.tags,
        vendor: createForm.vendor,
        hostname: createForm.hostname,
        ipAddr: createForm.ipAddr,
        osName: createForm.osName,
      };

      await createAliECSResources(payload);

      message.success('新增ECS资源成功');
      fetchResources();
      isCreateModalVisible.value = false;

    } catch (error: any) {
      message.error(error.message || '创建ECS资源失败');
    }
  }
};

// 取消按钮点击事件
const handleCancel = () => {
  isCreateModalVisible.value = false;
};

// 取消编辑按钮点击事件
const handleEditCancel = () => {
  isEditModalVisible.value = false;
};

// 处理新增资源
const handleAddResource = () => {
  Object.assign(createForm, {
    instanceName: '',
    description: '',
    tags: [],
    vendor: '1',
    hostname: '',
    ipAddr: '',
    osName: '',
    mode: '',
    password: '',
    name: '',
    region: '',
    instance_availability_zone: '',
    instance_type: '',
    system_disk_category: '',
    system_disk_name: '',
    system_disk_description: '',
    image_id: '',
    instance_name: '',
    internet_max_bandwidth_out: null,
    vpc_name: '',
    cidr_block: '',
    vswitch_cidr: '',
    zone_id: '',
    security_group_name: '',
    security_group_description: '',
  });
  isCreateModalVisible.value = true;
};

// 处理编辑资源
const handleEditResource = (record: ResourceEcs) => {
  Object.assign(editForm, {
    id: record.id,
    instanceName: record.instanceName,
    description: record.description,
    tags: record.tags?.filter(tag => tag && tag.trim() !== '') || [],
    vendor: record.vendor,
    hostname: record.hostname,
    ipAddr: record.ipAddr,
    osName: record.osName,
    mode: record.mode,
    password: record.password,
  });
  isEditModalVisible.value = true;
};

// 处理编辑资源
const handleEditECS = async () => {
  if (editForm.vendor === null) {
    message.error('请选择供应商');
    return;
  }

  if (!editForm.instanceName) {
    message.error('请输入资源名称');
    return;
  }

  editForm.tags = editForm.tags.filter(tag => tag.trim() !== '');

  try {
    if (editForm.vendor === '1') {
      await editECSResources({
        id: editForm.id,
        instanceName: editForm.instanceName,
        description: editForm.description,
        tags: editForm.tags,
        vendor: editForm.vendor,
        hostname: editForm.hostname,
        ipAddr: editForm.ipAddr,
        osName: editForm.osName,
        mode: editForm.mode,
        password: editForm.password,
      });
    } else {
      await editOtherECSResources({
        id: editForm.id,
        name: editForm.name,
        description: editForm.description,
        region: editForm.region,
        instance_name: editForm.instance_name,
        instance_availability_zone: editForm.instance_availability_zone,
        instance_type: editForm.instance_type,
        system_disk_category: editForm.system_disk_category,
        system_disk_name: editForm.system_disk_name,
        system_disk_description: editForm.system_disk_description,
        image_id: editForm.image_id,
        internet_max_bandwidth_out: editForm.internet_max_bandwidth_out ?? 0,
        vpc_name: editForm.vpc_name,
        cidr_block: editForm.cidr_block,
        vswitch_cidr: editForm.vswitch_cidr,
        zone_id: editForm.zone_id,
        security_group_name: editForm.security_group_name,
        security_group_description: editForm.security_group_description,
      });
    }

    message.success('编辑ECS资源成功');
    fetchResources();
    isEditModalVisible.value = false;

  } catch (error: any) {
    message.error(error.message || '编辑ECS资源失败');
  }
};

// 处理删除资源
const handleDeleteResource = (record: ResourceEcs) => {
  Modal.confirm({
    title: '确认删除',
    content: `确定要删除资源 "${record.instanceName}" 吗？`,
    onOk: async () => {
      try {
        if (record.vendor && vendorMap[record.vendor]) {
          if (record.vendor === '1') {
            await deleteECSResources(record.id);
          } else {
            await deleteOtherECSResources(record.id);
          }
        } else {
          await deleteECSResources(record.id);
        }
        message.success(`资源 "${record.instanceName}" 已成功删除`);
        await fetchResources();
      } catch (error: any) {
        message.error(error.message || `删除资源 "${record.instanceName}" 失败`);
      }
    },
  });
};

// 选择节点事件
const onNodeSelect = (selectedKeys: any) => {
  selectedNodeId.value = selectedKeys.length > 0 ? Number(selectedKeys[0]) : null;
};

// 处理绑定资源
const handleBindToNode = (record: ResourceEcs) => {
  resourceToBind.value = record;
  isBindModalVisible.value = true;
};

// 处理解绑资源
const handleUnbindFromNode = (record: ResourceEcs) => {
  const boundNode = treeNodes.value.find(node => node.id === record.boundNodeId);
  const boundNodeName = boundNode ? boundNode.title : '未知节点';

  Modal.confirm({
    title: '确认解绑',
    content: `确定要将资源 "${record.instanceName}" 从节点 "${boundNodeName}" 解绑吗？`,
    okText: '确认',
    cancelText: '取消',
    onOk: async () => {
      try {
        await unbindECSResources({
          nodeId: record.boundNodeId!,
          resource_ids: [record.id]
        });

        message.success(`解绑资源 "${record.instanceName}" 成功`);

        const index = data.findIndex(item => item.id === record.id);
        if (index !== -1 && data[index]) {
          data[index].isBound = false;
          data[index].boundNodeId = undefined;
        }
      } catch (error: any) {
        message.error(error.message || `解绑资源 "${record.instanceName}" 失败`);
      }
    },
  });
};

// 确认绑定
const confirmBind = async () => {
  if (!resourceToBind.value || selectedNodeId.value === null) {
    message.error('请选择要绑定的服务树节点');
    return;
  }

  const resourceToBindCopy = {
    id: resourceToBind.value.id,
    instanceName: resourceToBind.value.instanceName
  };
  const nodeId = selectedNodeId.value;

  try {
    await bindECSResources({
      nodeId,
      resource_ids: [resourceToBindCopy.id],
    });

    message.success(`绑定资源 "${resourceToBindCopy.instanceName}" 成功`);

    const index = data.findIndex(item => item.id === resourceToBindCopy.id);
    if (index !== -1 && data[index]) {
      data[index].isBound = true;
      data[index].boundNodeId = nodeId;
    }

    resourceToBind.value = null;
    selectedNodeId.value = null;
    isBindModalVisible.value = false;
  } catch (error: any) {
    message.error(error.message || `绑定资源 "${resourceToBindCopy.instanceName}" 失败`);
  }
};

// 取消绑定
const handleBindCancel = () => {
  resourceToBind.value = null;
  selectedNodeId.value = null;
  isBindModalVisible.value = false;
};

// 终端连接
const handleTerminalConnect = (record: ResourceEcs) => {
  router.push({
    path: '/terminal_connect',
    query: { id: record.id.toString() }
  });
};

onMounted(() => {
  fetchResources();
  fetchTreeNodes();
});
</script>

<style scoped>
.custom-toolbar {
  padding: 8px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.search-filters {
  display: flex;
  gap: 16px;
  align-items: center;
}

.action-buttons {
  display: flex;
  gap: 8px;
  align-items: center;
}
</style>
