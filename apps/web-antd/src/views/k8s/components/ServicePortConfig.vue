<template>
  <a-form-item label="端口配置">
    <div v-for="(port, index) in ports" :key="index" class="port-config-item">
      <a-row :gutter="16" align="middle">
        <a-col :span="5">
          <a-input v-model:value="port.name" placeholder="端口名称(可选)" />
        </a-col>
        <a-col :span="4">
          <a-select v-model:value="port.protocol" placeholder="协议">
            <a-select-option value="TCP">TCP</a-select-option>
            <a-select-option value="UDP">UDP</a-select-option>
            <a-select-option value="SCTP">SCTP</a-select-option>
          </a-select>
        </a-col>
        <a-col :span="4">
          <a-input-number 
            v-model:value="port.port" 
            :min="1" 
            :max="65535" 
            placeholder="端口" 
            style="width: 100%" 
          />
        </a-col>
        <a-col :span="5">
          <a-input-number 
            v-model:value="port.target_port" 
            :min="1" 
            :max="65535" 
            placeholder="目标端口"
            style="width: 100%" 
          />
        </a-col>
        <a-col :span="4" v-if="serviceType === 'NodePort'">
          <a-input-number 
            v-model:value="port.node_port" 
            :min="30000" 
            :max="32767" 
            placeholder="节点端口"
            style="width: 100%" 
          />
        </a-col>
        <a-col :span="2">
          <a-button 
            type="primary" 
            danger 
            ghost 
            size="small" 
            shape="circle" 
            @click="removePort(index)"
            :disabled="ports.length === 1"
          >
            <template #icon>
              <DeleteOutlined />
            </template>
          </a-button>
        </a-col>
      </a-row>
    </div>
    <a-button type="dashed" @click="addPort" block style="margin-top: 12px;">
      <template #icon>
        <PlusOutlined />
      </template>
      添加端口
    </a-button>
  </a-form-item>
</template>

<script lang="ts" setup>
import { DeleteOutlined, PlusOutlined } from '@ant-design/icons-vue';

interface ServicePort {
  name?: string;
  protocol: string;
  port: number;
  target_port?: number;
  node_port?: number;
}

const props = defineProps<{
  ports: ServicePort[];
  serviceType: string;
}>();

const emit = defineEmits<{
  'update:ports': [ports: ServicePort[]];
}>();

const addPort = () => {
  const newPorts = [...props.ports, {
    name: '',
    protocol: 'TCP',
    port: 80,
    target_port: 80
  }];
  emit('update:ports', newPorts);
};

const removePort = (index: number) => {
  if (props.ports.length > 1) {
    const newPorts = props.ports.filter((_, i) => i !== index);
    emit('update:ports', newPorts);
  }
};
</script>

<style scoped>
.port-config-item {
  margin-bottom: 12px;
  padding: 12px;
  border: 1px solid #f0f0f0;
  border-radius: 6px;
  background: #fafafa;
}
</style>
