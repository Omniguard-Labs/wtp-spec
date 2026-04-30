# WTP 概览

English: [WTP Overview](00-overview.md)

正式规范名：

**Wallet Transaction Provenance Standard**

中文名：

**钱包交易构造溯源标准**

副标题：

**Transaction construction provenance for wallet-generated envelopes**

规范短编号：

**WTP**

版本标识：

**WTP-v1**

## 状态

- 文档状态：Draft
- 规范系列：`WTP-v1`
- SDK 状态：EVM、EVM Safe、Solana 已实现

## 范围

`WTP` 定义钱包交易构造溯源格式，用于：

- 从可携带 payload 中恢复钱包生成的原始交易字节；
- 验证钱包厂商来源信息和 envelope 完整性；
- 在另一台设备上进行独立模拟、策略检查和反钓鱼复核。

本规范中的 provenance 指钱包生成交易 payload 的来源和构造上下文，不是链上
资金流向溯源。规范目标是 independent cross-checking：由独立于 payload
生成钱包的设备或验证器进行复核。

`WTP` 不定义：

- 钱包 UI 要求；
- 传输层二维码渲染细节；
- 链特定模拟 RPC 行为；
- 交易批准或拒绝策略。

## 设计目标

- 尽量使用成熟开放标准。
- 分离传输层、payload 层和信任层。
- 在同一个 envelope 模型中同时支持未认证恢复和认证恢复。
- 通过 profile 文档支持多个链族。

## 文档集合

- [01 Envelope](01-envelope.zh-CN.md)
- [02 信任模型](02-trust-model.zh-CN.md)
- [03 发现与发布](03-discovery-and-publishing.zh-CN.md)
- [04 链校验](04-chain-validation.zh-CN.md)
- [05 计算与校验](05-calculation-and-verification.zh-CN.md)
- [06 互通规则](06-interoperability.zh-CN.md)
- [10 EVM Profile](10-evm-profile.zh-CN.md)
- [20 Solana Profile](20-solana-profile.zh-CN.md)
- [References](../appendix/references.md)

## 规范用语

当 `MUST`、`MUST NOT`、`REQUIRED`、`SHOULD`、`SHOULD NOT` 和 `MAY` 以全大写形式出现时，应按 BCP 14 解释。
