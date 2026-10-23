export type BearerTokenAction = 'keep' | 'replace' | 'clear';

/** 编辑时不从读取接口重建密钥，省略字段与显式清除具有不同含义 */
export function bearerTokenPayload(options: {
  editing: boolean;
  action: BearerTokenAction;
  hasExisting: boolean;
  token: string;
  tokenFile: string;
}): { bearer_token?: string; bearer_token_file: string } {
  const token = options.token.trim();
  const tokenFile = options.tokenFile.trim();
  if (!options.editing) {
    if (token && tokenFile)
      throw new Error('Bearer Token和文件路径只能配置一种');
    return { bearer_token: token, bearer_token_file: tokenFile };
  }
  if (options.action === 'keep') {
    if (options.hasExisting && tokenFile) {
      throw new Error('切换到文件认证前，请明确选择清除已有Token');
    }
    return { bearer_token_file: tokenFile };
  }
  if (options.action === 'clear')
    return { bearer_token: '', bearer_token_file: tokenFile };
  if (!token) throw new Error('替换Token需要输入新的非空值');
  if (tokenFile) throw new Error('替换Token前请清空Bearer Token文件路径');
  return { bearer_token: token, bearer_token_file: '' };
}
