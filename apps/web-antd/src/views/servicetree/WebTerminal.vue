<template>
  <div class="web-terminal-container">
    <div ref="terminalRef" class="terminal-instance"></div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';
import { useRoute } from 'vue-router';
import { message } from 'ant-design-vue';
import { Terminal } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import 'xterm/css/xterm.css';

import { useAccessStore } from '@vben/stores';

const terminalRef = ref<HTMLDivElement | null>(null);
const route = useRoute();
const userAccess = useAccessStore();

let term: Terminal | null = null;
let fitAddon: FitAddon | null = null;
let socket: WebSocket | null = null;

const resizeHandler = () => {
  if (fitAddon) {
    fitAddon.fit();
  }
};

onMounted(async () => {
  const resourceId = Number(route.params.id);
  if (isNaN(resourceId)) {
    message.error('无效的资源ID');
    return;
  }

  if (!terminalRef.value) {
    message.error('无法挂载终端');
    return;
  }

  term = new Terminal({
    cursorBlink: true,
    fontSize: 14,
    fontFamily: 'Menlo, Monaco, "Courier New", monospace',
    theme: {
      background: '#1e1e1e',
      foreground: '#d4d4d4',
    },
  });

  fitAddon = new FitAddon();
  term.loadAddon(fitAddon);
  term.open(terminalRef.value);
  fitAddon.fit();

  window.addEventListener('resize', resizeHandler);

  try {
    const token = userAccess.accessToken;
    if (!token) {
      message.error('无法获取用户凭证，请重新登录');
      term?.write('\r\n\x1b[31mAuthentication token not found.\x1b[0m');
      return;
    }

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';

    const host = 'localhost:8889';
    const wsUrl = `${protocol}//${host}/api/tree/local/terminal/${resourceId}?token=${token}`;
    
    socket = new WebSocket(wsUrl);

    socket.onopen = () => {

      term?.focus();
    };

    socket.onmessage = (event) => {
      term?.write(typeof event.data === 'string' ? event.data : new Uint8Array(event.data));
    };

    // 客户端终端逻辑，用于处理历史记录、编辑和控制字符
    const history: string[] = [];
    let historyIndex = 0;
    const lineBuffer: string[] = [];

    term.onData((data: string) => {
      if (!socket || socket.readyState !== WebSocket.OPEN || !term) {
        return;
      }

      switch (data) {
        case '\x1b[A': // Up Arrow
          if (historyIndex > 0) {
            historyIndex--;
            const cmd = history[historyIndex] || '';
            term.write('\b \b'.repeat(lineBuffer.length) + cmd);
            lineBuffer.splice(0, lineBuffer.length, ...cmd.split(''));
          }
          return;
        case '\x1b[B': // Down Arrow
          if (historyIndex < history.length) {
            historyIndex++;
            const cmd = history[historyIndex] || '';
            term.write('\b \b'.repeat(lineBuffer.length) + cmd);
            lineBuffer.splice(0, lineBuffer.length, ...cmd.split(''));
          }
          return;
      }

      for (const char of data) {
        switch (char) {
          case '\r': // Enter
            const command = lineBuffer.join('');
            term.write('\r\n');
            if (command) {
              history.push(command);
              socket.send(command + '\r');
            } else {
              socket.send('\r');
            }
            lineBuffer.length = 0;
            historyIndex = history.length;
            break;
          case '\x7F': // Backspace
            if (lineBuffer.length > 0) {
              lineBuffer.pop();
              term.write('\b \b');
            }
            break;
          case '\x03': // Ctrl+C
            term.write('^C\r\n');
            socket.send('\x03');
            lineBuffer.length = 0;
            historyIndex = history.length;
            break;
          case '\t': // Tab
            socket.send('\t'); // 将Tab键传递给服务器进行补全
            break;
          default:
            // 缓冲并回显可打印字符
            if (char >= ' ') {
              lineBuffer.push(char);
              term.write(char);
            }
        }
      }
    });

    socket.onclose = (_event) => {
      // Connection closed
      term?.write('\r\n\x1b[31mConnection closed.\x1b[0m');
    };

    socket.onerror = (_error) => {
      // WebSocket error
      message.error('WebSocket 连接错误');
      term?.write('\r\n\x1b[31mWebSocket connection error.\x1b[0m');
    };
  } catch (error) {

    message.error('连接终端失败');
    term?.write('\r\n\x1b[31mFailed to establish terminal connection.\x1b[0m');
  }
});

onUnmounted(() => {
  window.removeEventListener('resize', resizeHandler);
  if (socket) {
    socket.close();
  }
  if (term) {
    term.dispose();
  }
});
</script>

<style scoped lang="scss">
.web-terminal-container {
  display: flex;
  flex-direction: column;
  height: 100%;
  width: 100%;
  padding: 16px;
  background-color: #1e1e1e;
}

.terminal-instance {
  flex-grow: 1;
  width: 100%;
  height: 100%;
}
</style>
