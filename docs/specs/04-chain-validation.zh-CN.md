# WTV 链校验

English: [WTV Chain Validation](04-chain-validation.md)

## 1. 范围

本文定义 `WTV-v1` 的通用链校验规则。

覆盖已实现 profile：

- EVM：`evm-tx-v1`、`evm-safe-v1`
- Solana：`solana-tx-v1`

## 2. 通用规则

验证器必须：

1. 校验 `schema`、`version`、`chain_family` 和 `profile`；
2. 使用所选 profile 解析交易字节；
3. 重新计算 `payload_hash`；
4. 将 profile 链标识与验证器提供的预期目标进行比对。

来源认证（`auth`）不能替代链校验。它只证明谁签署了 envelope。

## 3. EVM 规则

EVM 使用 `tx.chain_id`。

验证器必须：

- 从 `unsigned_tx_bytes` 或 `signed_tx_bytes` 恢复 `chainId`；
- 对 `evm-safe-v1`，从 `SafeTx` 恢复 `chain_id`；
- 将恢复值与 `tx.chain_id` 比对；
- 当提供 `expectedChainId` 且不匹配时拒绝 envelope。

当前 SDK 将该策略检查暴露为 `verifyEnvelope(..., { expectedChainId })`。

## 4. Solana 规则

Solana 使用 `tx.cluster`。

Solana 交易字节不编码 cluster。因此验证器必须把 `cluster` 视为 envelope 声明，而不是可从 message bytes 中恢复的值。

链感知验证器应该：

- 要求 `tx.cluster` 存在；
- 将其与验证器提供的预期 cluster 比对；
- 当 cluster 声明具备安全敏感性时，要求 `auth_mode = vendor_sig`。

当前 SDK 将该策略检查暴露为 `verifyEnvelope(..., { expectedCluster })`。

## 5. 完成状态

| Area | EVM | Solana |
| --- | --- | --- |
| Profile dispatch | 已实现 | 已实现 |
| Payload hash validation | 已实现 | 已实现 |
| Chain identifier check | `chain_id` 从字节或 SafeTx 恢复 | `cluster` 作为声明检查 |
| Expected target policy | `expectedChainId` | `expectedCluster` |
| Signed transaction validation | 恢复发送方；Safe EOA / `eth_sign` signer 恢复 | Ed25519 签名检查 |
