<template>
  <div class="knowledge-container">
    <!-- 页面头部 -->
    <div class="page-header">
      <div class="header-content">
        <div class="header-left">
          <div class="header-icon">
            <FileTextOutlined />
          </div>
          <div class="header-text">
            <h1 class="page-title">知识库管理</h1>
            <p class="page-subtitle">管理智能助手的知识库和文档资源</p>
          </div>
        </div>
        <div class="header-actions">
          <a-button type="primary" @click="refreshKnowledge" :loading="refreshing">
            <template #icon><ReloadOutlined /></template>
            刷新知识库
          </a-button>
        </div>
      </div>
    </div>

    <div class="knowledge-content">
      <!-- 统计卡片 -->
      <div class="stats-grid">
        <a-card class="stat-card">
          <a-statistic
            title="文档数量"
            :value="knowledgeStats.documents_count"
            :value-style="{ color: '#1890ff' }"
          >
            <template #prefix><FileTextOutlined /></template>
          </a-statistic>
        </a-card>
        <a-card class="stat-card">
          <a-statistic
            title="向量数量"
            :value="knowledgeStats.vector_count"
            :value-style="{ color: '#52c41a' }"
          >
            <template #prefix><NodeIndexOutlined /></template>
          </a-statistic>
        </a-card>
        <a-card class="stat-card">
          <a-statistic
            title="最后更新"
            :value="knowledgeStats.last_update"
            :value-style="{ color: '#fa8c16' }"
          >
            <template #prefix><ClockCircleOutlined /></template>
          </a-statistic>
        </a-card>
      </div>

      <!-- 功能区域 -->
      <div class="function-area">
        <a-row :gutter="24">
          <!-- 文件上传 -->
          <a-col :span="12">
            <a-card title="文档上传" class="function-card">
              <div class="upload-area">
                <a-upload-dragger
                  v-model:fileList="fileList"
                  :before-upload="beforeUpload"
                  :custom-request="handleUpload"
                  :multiple="true"
                  accept=".txt,.md,.pdf,.doc,.docx"
                  class="upload-dragger"
                >
                  <p class="ant-upload-drag-icon">
                    <InboxOutlined style="font-size: 48px; color: #1890ff;" />
                  </p>
                  <p class="ant-upload-text">点击或拖拽文件到此区域上传</p>
                  <p class="ant-upload-hint">
                    支持 .txt, .md, .pdf, .doc, .docx 格式文件
                  </p>
                </a-upload-dragger>
              </div>
            </a-card>
          </a-col>

          <!-- 手动添加文档 -->
          <a-col :span="12">
            <a-card title="手动添加文档" class="function-card">
              <a-form layout="vertical" :model="documentForm">
                <a-form-item label="文档标题" name="title">
                  <a-input 
                    v-model:value="documentForm.title" 
                    placeholder="请输入文档标题"
                  />
                </a-form-item>
                <a-form-item label="文件名" name="file_name">
                  <a-input 
                    v-model:value="documentForm.file_name" 
                    placeholder="例如: document.txt"
                  />
                </a-form-item>
                <a-form-item label="文档内容" name="content">
                  <a-textarea 
                    v-model:value="documentForm.content" 
                    placeholder="请输入文档内容"
                    :rows="6"
                  />
                </a-form-item>
                <a-form-item>
                  <a-button 
                    type="primary" 
                    @click="addDocument" 
                    :loading="adding"
                    block
                  >
                    添加文档
                  </a-button>
                </a-form-item>
              </a-form>
            </a-card>
          </a-col>
        </a-row>
      </div>

      <!-- 操作日志 -->
      <a-card title="操作日志" class="log-card">
        <div class="log-container">
          <div v-if="operationLogs.length === 0" class="empty-log">
            <a-empty description="暂无操作记录" />
          </div>
          <div v-else class="log-list">
            <div 
              v-for="(log, index) in operationLogs" 
              :key="index" 
              class="log-item"
              :class="{ 'success': log.type === 'success', 'error': log.type === 'error' }"
            >
              <div class="log-icon">
                <CheckCircleOutlined v-if="log.type === 'success'" />
                <CloseCircleOutlined v-else-if="log.type === 'error'" />
                <InfoCircleOutlined v-else />
              </div>
              <div class="log-content">
                <div class="log-message">{{ log.message }}</div>
                <div class="log-time">{{ log.timestamp }}</div>
              </div>
            </div>
          </div>
        </div>
      </a-card>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue';
import { message } from 'ant-design-vue';
import {
  ReloadOutlined,
  FileTextOutlined,
  NodeIndexOutlined,
  ClockCircleOutlined,
  InboxOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  InfoCircleOutlined
} from '@ant-design/icons-vue';
import { 
  refreshKnowledgeBase, 
  uploadKnowledgeFile, 
  addDocument as addDocumentAPI,
  type AddDocumentRequest,
  type RefreshKnowledgeResponse,
  type UploadKnowledgeResponse,
  type AddDocumentResponse
} from '#/api/core/assistant';

// 响应式数据
const refreshing = ref(false);
const adding = ref(false);
const fileList = ref<any[]>([]);

// 知识库统计
const knowledgeStats = reactive({
  documents_count: 0,
  vector_count: 0,
  last_update: '暂无数据'
});

// 文档表单
const documentForm = reactive<AddDocumentRequest>({
  title: '',
  content: '',
  file_name: ''
});

// 操作日志
interface OperationLog {
  type: 'success' | 'error' | 'info';
  message: string;
  timestamp: string;
}

const operationLogs = ref<OperationLog[]>([]);

// 添加日志
const addLog = (type: OperationLog['type'], message: string) => {
  operationLogs.value.unshift({
    type,
    message,
    timestamp: new Date().toLocaleString()
  });
  // 保持最多显示 50 条日志
  if (operationLogs.value.length > 50) {
    operationLogs.value = operationLogs.value.slice(0, 50);
  }
};

// 刷新知识库
const refreshKnowledge = async () => {
  try {
    refreshing.value = true;
    const response = await refreshKnowledgeBase();
    const data = response as RefreshKnowledgeResponse;
    
    if (data.refreshed) {
      knowledgeStats.documents_count = data.documents_count;
      knowledgeStats.vector_count = data.vector_count;
      knowledgeStats.last_update = new Date(data.timestamp).toLocaleString();
      
      message.success('知识库刷新成功');
      addLog('success', `知识库刷新成功：${data.message}`);
    } else {
      message.error('知识库刷新失败');
      addLog('error', '知识库刷新失败');
    }
  } catch (error: any) {
    message.error(`刷新知识库失败: ${error.message}`);
    addLog('error', `刷新知识库失败: ${error.message}`);
  } finally {
    refreshing.value = false;
  }
};

// 文件上传前处理
const beforeUpload = (file: File) => {
  const isValidType = ['txt', 'md', 'pdf', 'doc', 'docx'].some(ext => 
    file.name.toLowerCase().endsWith(`.${ext}`)
  );
  if (!isValidType) {
    message.error('只能上传 txt, md, pdf, doc, docx 格式的文件');
    return false;
  }
  
  const isLt10M = file.size / 1024 / 1024 < 10;
  if (!isLt10M) {
    message.error('文件大小不能超过 10MB');
    return false;
  }
  
  return true;
};

// 处理文件上传
const handleUpload = async (options: any) => {
  const { file } = options;
  
  try {
    const response = await uploadKnowledgeFile(file);
    const data = response as UploadKnowledgeResponse;
    
    if (data.uploaded) {
      message.success(`文件 ${data.filename} 上传成功`);
      addLog('success', `文件上传成功: ${data.filename} (${data.file_size} 字节)`);
      
      // 上传成功后刷新知识库统计
      await refreshKnowledge();
    } else {
      message.error(`文件上传失败: ${data.message}`);
      addLog('error', `文件上传失败: ${data.message}`);
    }
  } catch (error: any) {
    message.error(`文件上传失败: ${error.message}`);
    addLog('error', `文件上传失败: ${error.message}`);
  }
};

// 添加文档
const addDocument = async () => {
  if (!documentForm.title.trim()) {
    message.warning('请输入文档标题');
    return;
  }
  if (!documentForm.file_name.trim()) {
    message.warning('请输入文件名');
    return;
  }
  if (!documentForm.content.trim()) {
    message.warning('请输入文档内容');
    return;
  }
  
  try {
    adding.value = true;
    const response = await addDocumentAPI(documentForm);
    const data = response as AddDocumentResponse;
    
    if (data.added) {
      message.success('文档添加成功');
      addLog('success', `文档添加成功: ${documentForm.title} (ID: ${data.document_id})`);
      
      // 清空表单
      documentForm.title = '';
      documentForm.content = '';
      documentForm.file_name = '';
      
      // 刷新知识库统计
      await refreshKnowledge();
    } else {
      message.error(`文档添加失败: ${data.message}`);
      addLog('error', `文档添加失败: ${data.message}`);
    }
  } catch (error: any) {
    message.error(`添加文档失败: ${error.message}`);
    addLog('error', `添加文档失败: ${error.message}`);
  } finally {
    adding.value = false;
  }
};

// 页面初始化
onMounted(() => {
  refreshKnowledge();
  addLog('info', '知识库管理页面已加载');
});
</script>

<style scoped>
.knowledge-container {
  padding: 24px;
  background-color: var(--ant-background-color-light, #fafafa);
  min-height: 100vh;
}

/* 页面头部 */
.knowledge-container .page-header {
  background: #fff;
  border-radius: 12px;
  padding: 24px;
  margin-bottom: 24px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
  border: 1px solid #f0f0f0;
}

.knowledge-container .header-content {
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 100%;
}

.knowledge-container .header-left {
  display: flex;
  align-items: center;
  gap: 16px;
}

.knowledge-container .header-icon {
  font-size: 32px;
  color: #1890ff;
}

.knowledge-container .header-text {
  display: flex;
  flex-direction: column;
}

.knowledge-container .page-title {
  font-size: 18px;
  font-weight: 600;
  margin: 0;
  color: #262626;
  line-height: 1.2;
}

.knowledge-container .page-subtitle {
  color: #8c8c8c;
  margin: 0;
  font-size: 14px;
  margin-top: 4px;
}

.knowledge-container .header-actions {
  display: flex;
  gap: 12px;
  align-items: center;
}

.knowledge-content {
  .stats-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 16px;
    margin-bottom: 24px;

    .stat-card {
      text-align: center;
      border-radius: 8px;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
      margin-bottom: 24px;
      transition: all 0.3s ease;

      &:hover {
        transform: translateY(-2px);
        box-shadow: 0 4px 16px rgba(0, 0, 0, 0.15);
      }
    }
  }

  .function-area {
    margin-bottom: 24px;

    .function-card {
      height: 100%;
      border-radius: 8px;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
      margin-bottom: 24px;
      transition: all 0.3s ease;

      &:hover {
        transform: translateY(-2px);
        box-shadow: 0 4px 16px rgba(0, 0, 0, 0.15);
      }
    }

    .upload-area {
      .upload-dragger {
        border-radius: 8px;
        border: 2px dashed var(--ant-border-color);
        transition: all 0.3s ease;

        &:hover {
          border-color: #1890ff;
        }

        .ant-upload-text {
          font-size: 16px;
          color: var(--ant-text-color);
          margin-top: 8px;
          font-weight: 500;
        }

        .ant-upload-hint {
          color: var(--ant-text-color-secondary);
          font-size: 14px;
          margin-top: 4px;
        }
      }
    }
  }

  .log-card {
    border-radius: 8px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
    margin-bottom: 24px;

    .log-container {
      max-height: 400px;
      overflow-y: auto;

      .empty-log {
        text-align: center;
        padding: 40px 0;
        color: var(--ant-text-color-secondary);
      }

      .log-list {
        .log-item {
          display: flex;
          align-items: flex-start;
          padding: 12px 0;
          margin-bottom: 8px;
          border-bottom: 1px solid var(--ant-border-color-split);
          transition: all 0.3s;

          &:hover {
            background: var(--ant-background-color-light);
          }

          &.success {
            .log-icon {
              color: #52c41a;
            }
          }

          &.error {
            .log-icon {
              color: #ff4d4f;
            }
          }

          &:not(.success):not(.error) {
            .log-icon {
              color: #1890ff;
            }
          }

          .log-icon {
            font-size: 16px;
            margin-right: 12px;
            margin-top: 2px;
          }

          .log-content {
            flex: 1;

            .log-message {
              font-size: 14px;
              color: var(--ant-text-color);
              margin-bottom: 4px;
              font-weight: 500;
              line-height: 1.4;
            }

            .log-time {
              font-size: 12px;
              color: var(--ant-text-color-secondary);
            }
          }
        }
      }
    }
  }
}

@media (max-width: 768px) {
  .knowledge-container {
    padding: 16px;
  }
  
  .knowledge-header {
    flex-direction: column;
    gap: 16px;
    align-items: stretch;
  }
  
  .header-actions {
    justify-content: center;
  }

  .stats-grid {
    grid-template-columns: 1fr;
    gap: 12px;
  }

  .upload-area {
    .upload-dragger {
      padding: 24px 16px;

      .ant-upload-text {
        font-size: 14px;
      }

      .ant-upload-hint {
        font-size: 12px;
      }
    }
  }

  .log-container {
    max-height: 300px;

    .log-list {
      .log-item {
        padding: 8px 0;

        .log-icon {
          font-size: 14px;
          margin-right: 10px;
        }

        .log-content {
          .log-message {
            font-size: 13px;
          }

          .log-time {
            font-size: 11px;
          }
        }
      }
    }
  }
}
</style>
