<template>
  <OpsPage title="知识库管理" description="上传 UTF-8 文档并管理知识索引" class="knowledge-container">
    <!-- 页面头部 -->
    <template #actions>
<a-button v-if="can('aiops.assistant.refreshKnowledge')" type="primary" @click="refreshKnowledge" :loading="refreshing">
            <template #icon><ReloadOutlined /></template>
            重建知识索引
          </a-button>
    </template>
    <template #summary>
<div class="stats-grid">
        <a-card class="stat-card">
          <a-statistic
            title="文档数量"
            :value="!statsKnown ? '未统计' : knowledgeStats.documents_count"
            :value-style="{ color: '#1890ff' }"
          >
            <template #prefix><FileTextOutlined /></template>
          </a-statistic>
        </a-card>
        <a-card class="stat-card">
          <a-statistic
            title="向量数量"
            :value="!statsKnown ? '未统计' : knowledgeStats.vector_count"
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
    </template>

    <a-alert v-if="loadError" :message="loadError" type="error" show-icon role="alert" />
    <p class="index-note">重建会重新索引全库并调用嵌入模型；上传和添加仅索引当前文档</p>
    <div class="knowledge-content">
      <!-- 统计卡片 -->


      <!-- 功能区域 -->
      <div class="function-area">
        <a-row :gutter="24">
          <!-- 文件上传 -->
          <a-col :xs="24" :lg="12">
            <a-card title="文档上传" class="function-card">
              <div class="upload-area">
                <a-upload-dragger
                  v-model:fileList="fileList"
                  :before-upload="beforeUpload"
                  :custom-request="handleUpload"
                  :multiple="true"
                  accept=".txt,.md"
                  class="upload-dragger"
                >
                  <p class="ant-upload-drag-icon">
                    <InboxOutlined style="font-size: 48px; color: var(--ops-accent);" />
                  </p>
                  <p class="ant-upload-text">点击或拖拽文件到此区域上传</p>
                  <p class="ant-upload-hint">
                    仅支持 UTF-8 .txt 与 .md，最大 10 MiB；上传会索引当前文档
                  </p>
                </a-upload-dragger>
              </div>
            </a-card>
          </a-col>

          <!-- 手动添加文档 -->
          <a-col :xs="24" :lg="12">
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
  </OpsPage>
</template>

<script setup lang="ts">
import OpsPage from '#/components/ops/OpsPage.vue';
import { ref, reactive, onMounted } from 'vue';
import { message, Upload, type UploadProps } from 'ant-design-vue';
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
} from '#/api/core/aiops/assistant';
import { usePermission } from '#/utils/permission';
import { isPermissionDeniedError } from '#/utils/permission/forbidden';

const { can } = usePermission();


// 响应式数据
const refreshing = ref(false);
const adding = ref(false);
const statsKnown = ref(false);
const loadError = ref('');
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
  loadError.value = '';
  try {
    refreshing.value = true;
    const response = await refreshKnowledgeBase();
    const data = response as RefreshKnowledgeResponse;

    if (data.refreshed) {
      statsKnown.value = true;
      knowledgeStats.documents_count = data.documents_count;
      knowledgeStats.vector_count = data.vector_count;
      knowledgeStats.last_update = new Date(data.timestamp).toLocaleString();

      message.success('知识库刷新成功');
      addLog('success', `知识库刷新成功：${data.message}`);
    } else {
      throw new Error(data.message || '知识库重建失败');
    }
  } catch (error: any) {
    statsKnown.value = false;
    knowledgeStats.documents_count = 0;
    knowledgeStats.vector_count = 0;
    loadError.value = error instanceof Error ? error.message : '知识库重建失败';
    knowledgeStats.last_update = '重建失败';
    if (!isPermissionDeniedError(error)) message.error(`刷新知识库失败: ${loadError.value}`);
    addLog('error', `刷新知识库失败: ${error.message}`);
  } finally {
    refreshing.value = false;
  }
};

// 文件上传前处理
const beforeUpload = (file: File) => {
  const isValidType = ['txt', 'md'].some(ext =>
    file.name.toLowerCase().endsWith(`.${ext}`)
  );
  if (!isValidType) {
    message.error('仅支持 UTF-8 的 .txt 与 .md 文件');
    return Upload.LIST_IGNORE;
  }

  const isLt10M = file.size <= 10 * 1024 * 1024;
  if (!isLt10M) {
    message.error('文件大小不能超过 10 MiB');
    return Upload.LIST_IGNORE;
  }

  return true;
};

// 处理文件上传
const handleUpload: NonNullable<UploadProps['customRequest']> = async (options) => {
  try {
    if (!(options.file instanceof File)) throw new Error('请选择有效文件');
    const data = await uploadKnowledgeFile(options.file) as UploadKnowledgeResponse;
    if (!data.uploaded) throw new Error(data.message || '文件索引失败');
    options.onSuccess?.(data);
    statsKnown.value = false;
    knowledgeStats.last_update = '统计待重建';
    message.success(`文件 ${data.filename} 已上传并索引`);
    addLog('success', `文件索引完成: ${data.filename} (${data.file_size} 字节)`);
  } catch (error) {
    const failure = error instanceof Error ? error : new Error('文件上传失败');
    options.onError?.(failure);
    if (!isPermissionDeniedError(error)) message.error(`文件上传失败: ${failure.message}`);
    addLog('error', `文件上传失败: ${failure.message}`);
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

  if (!/\.(md|txt)$/i.test(documentForm.file_name.trim())) {
    message.warning('文件名仅支持 .md 与 .txt');
    return;
  }
  try {
    adding.value = true;
    const response = await addDocumentAPI({ ...documentForm });
    const data = response as AddDocumentResponse;

    if (data.added) {
      message.success('文档添加成功');
      addLog('success', `文档添加成功: ${documentForm.title} (ID: ${data.document_id})`);

      // 清空表单
      documentForm.title = '';
      documentForm.content = '';
      documentForm.file_name = '';

      statsKnown.value = false;
      knowledgeStats.last_update = '统计待重建';
    } else {
      message.error(`文档添加失败: ${data.message}`);
      addLog('error', `文档添加失败: ${data.message}`);
    }
  } catch (error: any) {
    if (!isPermissionDeniedError(error)) message.error(`添加文档失败: ${error.message}`);
    addLog('error', `添加文档失败: ${error.message}`);
  } finally {
    adding.value = false;
  }
};

// 页面初始化
onMounted(() => {
  addLog('info', '知识库管理页面已加载');
});
</script>

<style scoped>
.index-note {
  color: var(--ops-muted);
  margin: 0;
  line-height: 1.6;
}


/* 页面头部 */








.knowledge-content {
  .stats-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 16px;
    margin-bottom: var(--ops-space-lg);

    .stat-card {
      text-align: center;
      border-radius: var(--ops-radius);
      box-shadow: none;
      margin-bottom: var(--ops-space-lg);
      transition: border-color var(--ops-duration) ease-out;

      &:hover {
        box-shadow: none;
      }
    }
  }

  .function-area {
    margin-bottom: var(--ops-space-lg);

    .function-card {
      height: 100%;
      border-radius: var(--ops-radius);
      box-shadow: none;
      margin-bottom: var(--ops-space-lg);
      transition: border-color var(--ops-duration) ease-out;

      &:hover {
        box-shadow: none;
      }
    }

    .upload-area {
      .upload-dragger {
        border-radius: var(--ops-radius);
        border: 2px dashed var(--ops-border);
        transition: border-color var(--ops-duration) ease-out;

        &:hover {
          border-color: var(--ops-accent);
        }

        .ant-upload-text {
          font-size: 16px;
          color: var(--ops-ink);
          margin-top: 8px;
          font-weight: 500;
        }

        .ant-upload-hint {
          color: var(--ops-muted);
          font-size: 14px;
          margin-top: 4px;
        }
      }
    }
  }

  .log-card {
    border-radius: var(--ops-radius);
    box-shadow: none;
    margin-bottom: var(--ops-space-lg);

    .log-container {
      max-height: 400px;
      overflow-y: auto;

      .empty-log {
        text-align: center;
        padding: 40px 0;
        color: var(--ops-muted);
      }

      .log-list {
        .log-item {
          display: flex;
          align-items: flex-start;
          padding: 12px 0;
          margin-bottom: 8px;
          border-bottom: 1px solid var(--ops-border);
          transition: border-color var(--ops-duration) ease-out;

          &:hover {
            background: var(--ops-ground);
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
              color: var(--ops-accent);
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
              color: var(--ops-ink);
              margin-bottom: 4px;
              font-weight: 500;
              line-height: 1.4;
            }

            .log-time {
              font-size: 12px;
              color: var(--ops-muted);
            }
          }
        }
      }
    }
  }
}

@media (max-width: 768px) {

  .knowledge-header {
    flex-direction: column;
    gap: 16px;
    align-items: stretch;
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
