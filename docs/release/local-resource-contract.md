# 本地主机前后端契约修复

日期：2026-10-23

- 标签统一为后端实际的 `{key,value}[]`，输入 `team=ops` 或无值键，按键去重并按键值显示；移除重复 Enter 处理
- 编辑同一认证方式允许留空保留凭据，请求省略空 key/password；切换方式要求新凭据。已有私钥不回显，表单明确显示保留提示
- 提交在异步校验前锁定，固定目标与数据快照，防止重复请求；取消重开和卸载使旧结果失效。已送达服务器的写操作不会因关闭表单撤销
- 与 Go caaa6ad/7f59b8a 对接：用户名、描述和标签正确持久化，显式清空生效，不覆盖状态和并发凭据轮换

验证：新增三项真实 Antd 合同回归、既有十二项 CMDB 回归及应用 typecheck 通过。真实 Chrome→Go 7f59b8a→MySQL：创建唯一假凭据资产、标签键值显示、留空私钥编辑、用户名修改、标签新增/清空、描述清空、状态保留与详情不返回 key 全通过，4.6秒。390px深色整页无横溢出；没有 SSH WebSocket、主机或云厂商调用。所有自有 nonce 资源在 finally 删除，查询确认零残留，管理员会话注销

自动化：`CLOUDOPS_TEST_ENV_FILE=/absolute/private/env pnpm exec playwright test tests/e2e/local-resource-contract.spec.ts`，仅允许 localhost/127.0.0.1，缺少隔离管理员配置时明确跳过，不把跳过视为验收
