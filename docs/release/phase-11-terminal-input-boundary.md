# 第十一阶段：Pod 终端输入帧边界

日期：2026-10-23

- 新增无依赖 utf8Chunks，按 Unicode 码点及 UTF-8 字节数切分输入，每片最大 64 KiB，不拆代理对，不移除 NUL、回车或换行
- Pod 终端粘贴和 sendCommand 共用入口，每片分别编码为标准 stdin JSON 帧，配套 Go ac34bde 的 stdin/解压后消息上限
- 十四项纯函数回归覆盖 ASCII 最大值/超限、中文、emoji、NUL 最坏 JSON 转义、小预算和无效预算；实际 Pod 客户端回归通过 onData 注入长混合粘贴，验证多帧边界与完整还原
- 定向十九项测试与应用 TypeScript 通过。最长 NUL JSON 帧仍低于服务端 512 KiB 消息上限；未向真实 shell 粘贴测试控制字符
