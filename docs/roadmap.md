# WTV Roadmap

## 已完成

- 规范主标题固定为 `Wallet Transaction Verification Standard`
- 中文名固定为 `钱包交易验证标准`
- 规范短编号固定为 `WTV`
- 参考实现标识统一为 `wtv`
- EVM profile 已支持 `legacy` / `eip2930` / `eip1559` / `eip4844` / `eip7702`
- EVM Safe profile 已支持 SafeTxHash、EOA / `eth_sign` 离线签名恢复和 `execTransaction(...)` calldata 解析
- Solana profile 已支持 `legacy` / `v0`
- 已支持 `sign_request` 与 `signed_tx` 两类恢复验证
- 已支持 `Vendor Root -> QR Signing Certificate -> COSE_Sign1` 认证链
- 已支持 trust metadata 编码、验签与 `.well-known` 发布地址生成
- 已支持 Solana message 恢复、signed tx 恢复和签名校验
- 已支持 EVM `expectedChainId` 与 Solana `expectedCluster` 目标链校验

## 当前优先级

1. 增补跨语言测试向量
2. 固化厂商 trust metadata JSON/CBOR 示例
3. 增加吊销与轮换测试
4. 补充 Solana Address Lookup Table 用例
5. 增加浏览器端最小验证示例
6. 增加 Safe owner set、threshold、nonce 可信快照用例

## 规范层 TODO

1. 把 transport profile 明确分成单帧和分片两种模式
2. 定义 QR 分片排序、去重、缺片处理的规范语言
3. 明确 `auth_mode = none` 与 `auth_mode = vendor_sig` 的合规要求
4. 细化 `sim_block`、EVM block context、Solana freshness context 的字段定义
5. 给出版本协商与向后兼容规则

## Trust TODO

1. 增加 `revocations` 的最小必填字段和验证顺序
2. 增加 signing cert 轮换流程和根密钥轮换流程
3. 定义 metadata 过期、缓存和刷新策略
4. 评估是否补充 X.509 profile
5. 评估是否补充透明日志或审计日志扩展

## SDK TODO

1. 增加 QR 图像层适配，支持 PNG/SVG 输出
2. 增加浏览器端最小验证器示例
3. 增加 `simulateAndVerify()` 高层 API
4. 增加更细的错误码和诊断对象
5. 增加 Solana Address Lookup Table 构造辅助函数
6. 增加 Safe 状态快照输入和 EIP-1271 验证适配

## 测试 TODO

1. 增加损坏分片、乱序分片、重复分片用例
2. 增加 trust metadata 过期和吊销用例
3. 增加多 root、多 cert、多 vendor 用例
4. 增加跨设备恢复一致性测试向量
5. 增加 Solana ALT 和多签交易用例
6. 增加 Safe EIP-1271、approved hash 和阈值状态测试向量

## 发布前 TODO

1. 清理并固定仓库名、包名和文档目录结构
2. 补充 `v1` 规范变更日志
3. 补充实现者指南和安全注意事项
4. 准备公开测试向量仓库
5. 准备参考厂商 `.well-known/wtv/` 样例站点
