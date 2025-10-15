<template>
  <div class="console">
    <!-- 头部操作栏 -->
    <div class="header">
      <a-space>
        <a-button @click="handleGoBack">
          <template #icon><arrow-left-outlined /></template>
          返回
        </a-button>
        <a-button 
          v-if="connectionStatus === 'connected'" 
          type="primary" 
          danger 
          @click="handleClose"
        >
          <template #icon><close-circle-outlined /></template>
          关闭连接
        </a-button>
        <a-tag v-if="connectionStatus === 'connected'" color="success">
          <check-circle-outlined /> 已连接
        </a-tag>
        <a-tag v-else-if="connectionStatus === 'connecting'" color="processing">
          <loading-outlined /> 连接中...
        </a-tag>
      </a-space>
    </div>

    <!-- 连接中状态 -->
    <div v-if="connectionStatus === 'connecting'" class="status-message">
      <a-spin size="large" />
      <p class="status-text">正在连接到云服务器终端...</p>
      <p class="status-hint">请稍候，这可能需要几秒钟</p>
    </div>

    <!-- 终端显示 -->
    <div v-else-if="connectionStatus === 'connected'" ref="terminalElement" id="terminal"></div>

    <!-- 连接失败状态 -->
    <div v-else-if="connectionStatus === 'error'" class="status-message">
      <a-result
        status="error"
        title="终端连接失败"
        :sub-title="errorMessage"
      >
        <template #extra>
          <a-space direction="vertical" :size="12" style="width: 100%">
            <a-alert
              message="可能的原因"
              type="info"
              show-icon
            >
              <template #description>
                <ul style="margin: 8px 0; padding-left: 20px">
                  <li>云服务器未配置SSH连接信息（端口、用户名、密码/密钥）</li>
                  <li>云服务器处于停止状态</li>
                  <li>网络连接问题或防火墙限制</li>
                  <li>SSH服务未启动或端口配置错误</li>
                  <li>认证信息错误（用户名/密码/密钥）</li>
                </ul>
              </template>
            </a-alert>
            <a-space>
              <a-button type="primary" @click="handleReconnect">
                <reload-outlined /> 重新连接
              </a-button>
              <a-button @click="handleGoBack">
                <arrow-left-outlined /> 返回资源列表
              </a-button>
            </a-space>
          </a-space>
        </template>
      </a-result>
    </div>

    <!-- 连接断开状态 -->
    <div v-else-if="connectionStatus === 'disconnected'" class="status-message">
      <a-result
        status="warning"
        title="连接已断开"
        sub-title="终端连接已关闭"
      >
        <template #extra>
          <a-space>
            <a-button type="primary" @click="handleReconnect">
              <reload-outlined /> 重新连接
            </a-button>
            <a-button @click="handleGoBack">
              <arrow-left-outlined /> 返回资源列表
            </a-button>
          </a-space>
        </template>
      </a-result>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { onMounted, ref, onBeforeUnmount } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { Terminal } from 'xterm';
import { message } from 'ant-design-vue';
import { useAccessStore } from '@vben/stores';
import { FitAddon } from 'xterm-addon-fit';
import {
  ArrowLeftOutlined,
  CloseCircleOutlined,
  CheckCircleOutlined,
  LoadingOutlined,
  ReloadOutlined,
} from '@ant-design/icons-vue';
import 'xterm/css/xterm.css';

// 连接状态类型
type ConnectionStatus = 'connecting' | 'connected' | 'disconnected' | 'error';

// 常量定义
const INACTIVITY_TIMEOUT = 60000; // 不活动超时时间(毫秒)
const CONNECTION_TIMEOUT = 10000; // 连接超时时间(10秒)
const TERMINAL_CONFIG = {
  cols: 120,
  rows: 30,
  convertEol: true,
  scrollback: 1000,
  disableStdin: false,
  cursorStyle: 'block',
  cursorBlink: true,
  fontFamily: 'Menlo, Monaco, Consolas, monospace',
  fontSize: 14,
  theme: {
    foreground: '#ffffff',
    background: '#000000',
    cursor: '#ffffff',
    black: '#000000',
    red: '#cd3131',
    green: '#0dbc79',
    yellow: '#e5e510',
    blue: '#2472c8',
    magenta: '#bc3fbc',
    cyan: '#11a8cd',
    white: '#e5e5e5',
    brightBlack: '#666666',
    brightRed: '#f14c4c',
    brightGreen: '#23d18b',
    brightYellow: '#f5f543',
    brightBlue: '#3b8eea',
    brightMagenta: '#d670d6',
    brightCyan: '#29b8db',
    brightWhite: '#e5e5e5'
  }
};

// 状态管理
const route = useRoute();
const router = useRouter();
const terminalElement = ref<HTMLElement | null>(null);
const terminal = ref<Terminal | null>(null);
const connectionStatus = ref<ConnectionStatus>('connecting');
const errorMessage = ref('');
const ws = ref<WebSocket | null>(null);
const currentCommand = ref('');
const inactivityTimer = ref<NodeJS.Timeout | null>(null);
const connectionTimer = ref<NodeJS.Timeout | null>(null);
const fitAddon = ref<FitAddon | null>(null);

// 清理所有定时器
const clearAllTimers = () => {
  if (inactivityTimer.value) {
    clearTimeout(inactivityTimer.value);
    inactivityTimer.value = null;
  }
  if (connectionTimer.value) {
    clearTimeout(connectionTimer.value);
    connectionTimer.value = null;
  }
};

// 重置不活动计时器
const resetInactivityTimer = () => {
  if (inactivityTimer.value) {
    clearTimeout(inactivityTimer.value);
  }
  inactivityTimer.value = setTimeout(() => {
    if (ws.value) {
      message.warning('由于长时间未操作，连接已自动关闭');
      ws.value.close(1000, '用户不活动超时');
    }
  }, INACTIVITY_TIMEOUT);
};

// 返回上一页
const handleGoBack = () => {
  // 清理所有定时器
  clearAllTimers();
  
  // 清理WebSocket资源
  if (ws.value) {
    try {
      if (ws.value.readyState === WebSocket.OPEN || ws.value.readyState === WebSocket.CONNECTING) {
        ws.value.close(1000, '用户返回上一页');
      }
    } catch (error) {
      console.error('关闭WebSocket失败:', error);
    }
    ws.value = null;
  }
  
  router.back();
};

// 手动关闭连接
const handleClose = () => {
  // 清理所有定时器
  clearAllTimers();
  
  if (ws.value) {
    try {
      if (ws.value.readyState === WebSocket.OPEN || ws.value.readyState === WebSocket.CONNECTING) {
        ws.value.close(1000, '用户手动关闭连接');
      }
    } catch (error) {
      console.error('关闭连接失败:', error);
    }
    ws.value = null;
    message.success('已关闭终端连接');
    // 关闭后返回上一页
    setTimeout(() => {
      router.back();
    }, 500);
  }
};

// 重新连接
const handleReconnect = () => {
  const id = route.query.id as string;
  if (id) {
    connectionStatus.value = 'connecting';
    errorMessage.value = '';
    
    // 清理所有定时器
    clearAllTimers();
    
    // 清理旧的WebSocket连接
    if (ws.value) {
      try {
        if (ws.value.readyState === WebSocket.OPEN || ws.value.readyState === WebSocket.CONNECTING) {
          ws.value.close();
        }
      } catch (error) {
        console.error('关闭旧连接失败:', error);
      }
      ws.value = null;
    }
    
    // 清理旧的终端实例
    if (terminal.value) {
      try {
        // 先移除监听器
        terminal.value.onData(() => {});
        
        // 清理fitAddon引用
        if (fitAddon.value) {
          fitAddon.value = null;
        }
        
        // 清理terminal
        terminal.value.dispose();
        terminal.value = null;
      } catch (error) {
        console.error('清理旧终端失败:', error);
        // 强制重置引用
        terminal.value = null;
        fitAddon.value = null;
      }
    }
    
    // 重新初始化
    initTerminal();
    connectWebSocket(id);
  }
};

// 处理终端输入
const handleTerminalInput = (data: string) => {
  if (!ws.value || ws.value.readyState !== WebSocket.OPEN || !terminal.value) return;
  
  resetInactivityTimer();
  
  switch(data) {
    case '\r': // 回车键
      ws.value.send(currentCommand.value + '\n');
      currentCommand.value = '';
      terminal.value.write('\r\n');
      break;
    case '\u007f': // 退格键
      if (currentCommand.value.length > 0) {
        currentCommand.value = currentCommand.value.slice(0, -1);
        terminal.value.write('\b \b');
      }
      break;
    default:
      currentCommand.value += data;
      terminal.value.write(data);
  }
};

// WebSocket连接函数
const connectWebSocket = (id: string) => {
  const accessStore = useAccessStore();
  const token = accessStore.accessToken;
  
  if (!token) {
    connectionStatus.value = 'error';
    errorMessage.value = '未获取到认证信息，请重新登录';
    message.error('未获取到认证信息');
    return;
  }

  const wsProtocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
  const wsUrl = `${wsProtocol}://localhost:8888/api/tree/ecs/console/${id}?token=${encodeURIComponent(token)}`;

  try {
    connectionStatus.value = 'connecting';
    ws.value = new WebSocket(wsUrl);

    // 设置连接超时
    connectionTimer.value = setTimeout(() => {
      if (connectionStatus.value === 'connecting') {
        connectionStatus.value = 'error';
        errorMessage.value = '连接超时，服务器响应时间过长';
        if (ws.value) {
          ws.value.close();
        }
        message.error('连接超时');
      }
    }, CONNECTION_TIMEOUT);

    ws.value.onopen = () => {
      clearAllTimers();
      connectionStatus.value = 'connected';
      message.success('终端连接成功');
      resetInactivityTimer();
    };

    ws.value.onmessage = (event) => {
      terminal.value?.write(event.data);
      resetInactivityTimer();
    };

    ws.value.onerror = (error) => {
      clearAllTimers();
      console.error('WebSocket错误:', error);
      connectionStatus.value = 'error';
      errorMessage.value = '终端连接出错，请检查网络连接和服务器状态';
      message.error('终端连接错误');
    };

    ws.value.onclose = (event) => {
      clearAllTimers();
      console.log('WebSocket关闭:', event.code, event.reason);
      // 如果当前是已连接状态，说明是异常断开
      if (connectionStatus.value === 'connected') {
        connectionStatus.value = 'disconnected';
        message.warning('终端连接已断开');
      } else if (connectionStatus.value === 'connecting') {
        // 连接中被关闭，说明连接失败
        connectionStatus.value = 'error';
        errorMessage.value = '无法连接到云服务器终端，请检查SSH配置和服务器状态';
      }
    };
  } catch (error) {
    clearAllTimers();
    console.error('创建WebSocket失败:', error);
    connectionStatus.value = 'error';
    errorMessage.value = '创建终端连接失败: ' + (error as Error).message;
    message.error('创建终端连接失败');
  }
};

// 初始化终端
const initTerminal = () => {
  try {
    terminal.value = new Terminal({
      ...TERMINAL_CONFIG,
      cursorStyle: 'block' as 'block' | 'underline' | 'bar'
    });
    
    fitAddon.value = new FitAddon();
    terminal.value.loadAddon(fitAddon.value);

    if (terminalElement.value) {
      terminal.value.open(terminalElement.value);
      fitAddon.value.fit();
    }

    terminal.value.onData(handleTerminalInput);
  } catch (error) {
    console.error('初始化终端失败:', error);
    connectionStatus.value = 'error';
    errorMessage.value = '初始化终端失败';
  }
};

// 处理窗口大小变化
const handleResize = () => {
  fitAddon.value?.fit();
};

// 生命周期钩子
onMounted(() => {
  const id = route.query.id as string;
  if (!id) {
    connectionStatus.value = 'error';
    errorMessage.value = '缺少必要的参数：资源ID';
    message.error('缺少必要的参数');
    return;
  }

  initTerminal();
  connectWebSocket(id);
  window.addEventListener('resize', handleResize);
});

onBeforeUnmount(() => {
  // 清理所有定时器
  clearAllTimers();

  // 清理WebSocket连接
  if (ws.value) {
    try {
      if (ws.value.readyState === WebSocket.OPEN || ws.value.readyState === WebSocket.CONNECTING) {
        ws.value.close(1000, '用户关闭终端');
      }
    } catch (error) {
      console.error('关闭WebSocket失败:', error);
    }
    ws.value = null;
  }

  // 清理终端实例 - 注意顺序很重要
  if (terminal.value) {
    try {
      // 先移除数据监听
      terminal.value.onData(() => {});
      
      // 清理FitAddon（如果已加载）
      if (fitAddon.value) {
        try {
          // FitAddon通常会在terminal.dispose时自动清理，不需要手动dispose
          fitAddon.value = null;
        } catch (error) {
          console.error('清理FitAddon失败:', error);
        }
      }
      
      // 最后清理terminal
      terminal.value.dispose();
      terminal.value = null;
    } catch (error) {
      console.error('清理终端失败:', error);
      // 即使清理失败，也要重置引用
      terminal.value = null;
      fitAddon.value = null;
    }
  }

  // 移除事件监听
  window.removeEventListener('resize', handleResize);
});
</script>

<style scoped>
.console {
  width: 100%;
  height: calc(100vh - 100px);
  padding: 20px;
  background: linear-gradient(135deg, #1e1e1e 0%, #2d2d2d 100%);
  border-radius: 8px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.3);
}

.header {
  margin-bottom: 20px;
  padding: 12px 16px;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 6px;
  backdrop-filter: blur(10px);
}

#terminal {
  width: 100%;
  height: calc(100% - 80px);
  border-radius: 6px;
  overflow: hidden;
  box-shadow: inset 0 2px 8px rgba(0, 0, 0, 0.3);
}

.status-message {
  width: 100%;
  height: calc(100% - 80px);
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  background: rgba(0, 0, 0, 0.6);
  border-radius: 8px;
  padding: 40px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
  backdrop-filter: blur(10px);
}

.status-text {
  margin-top: 24px;
  font-size: 18px;
  font-weight: 600;
  color: #ffffff;
}

.status-hint {
  margin-top: 8px;
  font-size: 14px;
  color: #d1d5db;
}

:deep(.ant-result) {
  padding: 20px;
}

:deep(.ant-result-title) {
  color: #ffffff !important;
}

:deep(.ant-result-subtitle) {
  color: #d1d5db !important;
}

:deep(.ant-result-icon) {
  .anticon {
    color: #ffffff !important;
  }
}

:deep(.ant-alert) {
  text-align: left;
  margin-bottom: 16px;
  background: rgba(255, 255, 255, 0.1) !important;
  border: 1px solid rgba(255, 255, 255, 0.2) !important;
}

:deep(.ant-alert-message) {
  color: #ffffff !important;
}

:deep(.ant-alert-description) {
  color: #d1d5db !important;
}

:deep(.ant-alert ul) {
  color: #e5e7eb !important;
}

:deep(.ant-tag) {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 12px;
  font-size: 14px;
  border-radius: 4px;
}

:deep(.ant-spin) {
  .ant-spin-dot-item {
    background-color: #ffffff !important;
  }
}

:deep(.ant-btn) {
  border-radius: 6px;
  font-weight: 500;
  transition: all 0.3s ease;
  
  &:not(.ant-btn-primary):not(.ant-btn-dangerous) {
    background: rgba(255, 255, 255, 0.1);
    border-color: rgba(255, 255, 255, 0.2);
    color: #ffffff;
    
    &:hover {
      background: rgba(255, 255, 255, 0.2);
      border-color: rgba(255, 255, 255, 0.3);
      color: #ffffff;
    }
  }
}
</style>

