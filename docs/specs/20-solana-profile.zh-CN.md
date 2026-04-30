# WTP Solana Profile

English: [WTP Solana Profile](20-solana-profile.md)

## 1. Profile 标识

- `chain_family = solana`
- `profile = solana-tx-v1`
- 状态：已实现

## 2. 支持的 Payload

交易种类：

- `sign_request`
- `signed_tx`

交易格式：

- `legacy`
- `v0`

`v0` 支持 versioned messages，并可以包含 Address Lookup Table 引用。

## 3. tx 记录

Solana `tx` 对象使用：

- `version`
- `cluster`
- `tx_kind`
- `tx_format`
- `message_bytes` 或 `serialized_tx_bytes`
- `payload_hash`
- `fee_payer`
- `recent_blockhash`
- `required_signatures`
- `signer_pubkeys`
- `issued_at`
- `expires_at`
- `wallet_app_id`
- `last_valid_block_height`
- `sim_slot`

## 4. 链校验

`cluster` 是 Solana 链或 cluster 声明。

Solana 交易字节不编码 cluster。验证器不能从 `message_bytes` 或 `serialized_tx_bytes` 中恢复 `cluster`。

链感知验证器应该：

- 当验证器策略提供 `expectedCluster` 时，将其与 `tx.cluster` 比对；
- 当依赖 cluster 声明做安全决策时，要求 `auth_mode = vendor_sig`；
- 将 blockhash freshness 视为独立运行时校验。

任何 expected-cluster 不匹配都必须使 envelope 无效。

当 `auth_mode = none` 时，`cluster` 是未认证 hint。验证器仍然可以恢复和解析交易字节，但不得把 cluster 声明视为已验证。

## 5. Canonical Payload 规则

### 5.1 sign_request

- `legacy` 必须携带 `Message.serialize()` 字节。
- `v0` 必须携带 `MessageV0.serialize()` 字节。
- `payload_hash` 必须是 `message_bytes` 的 SHA-256 digest。

### 5.2 signed_tx

- `legacy` 必须携带 canonical serialized `Transaction` 字节。
- `v0` 必须携带 canonical serialized `VersionedTransaction` 字节。
- `payload_hash` 必须是 `serialized_tx_bytes` 的 SHA-256 digest。

## 6. 验证检查

Solana 验证器应该返回：

- profile 匹配结果；
- 交易格式；
- cluster 声明；
- 如有请求，返回 expected cluster 匹配结果；
- fee payer、recent blockhash 和 signer set；
- packet size 结果；
- 对 `signed_tx` 返回 Ed25519 签名结果；
- payload hash 结果；
- 来源验证结果。
