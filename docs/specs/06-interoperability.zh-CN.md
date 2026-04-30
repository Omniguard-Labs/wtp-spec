# WTP 互通规则

English: [WTP Interoperability](06-interoperability.md)

## 1. 范围

本文把 `WTP-v1` 的扩展面保持在足够小的范围内，确保独立实现可以互通。

## 2. 已注册标识符

`WTP-v1` 定义以下初始 wire 标识符：

| 命名空间 | 值 |
| --- | --- |
| Envelope schema | `wtv` |
| Trust metadata schema | `wtv-trust` |
| QR 文本前缀 | `wtv1:` |
| QR 分片前缀 | `wtv1/` |
| Chain family | `evm`, `solana` |
| Profile | `evm-tx-v1`, `evm-safe-v1`, `solana-tx-v1` |
| Envelope auth mode | `none`, `vendor_sig` |
| Trust metadata auth mode | `none`, `root_sig` |
| Envelope 签名算法 | `Ed25519` |

`wtv` wire namespace 沿用自早期 draft 命名。它是 `WTP-v1` 的规范性
wire namespace，不改变对外标准名。

Envelope 签名算法这一行只适用于 envelope-level 和 trust metadata 的 `COSE_Sign1` 签名。交易级签名遵循各链原生方案，由对应 profile 或链标准定义。

新的 chain family、profile、auth mode 和 envelope 签名算法必须先更新规范并补充一致性测试向量，之后才能视为可互通。

## 3. 版本与扩展

`wtv1:` QR 前缀对应 envelope `schema = wtv` 和 `version = 1`。
未来 major version 可以注册不同前缀，但 `WTP-v1` 实现必须把上表标识符
视为可互通的 v1 集合。

`WTP-v1` 验证器必须拒绝不支持的 `schema`、`version`、`chain_family` 或 `profile`。

生产方不得把安全敏感语义放进未注册字段。验证器可以忽略未知字段，但不得把被忽略字段展示或处理为已验证数据。新增已验证语义时，必须更新已注册 profile，或使用新的 profile 标识符。

## 4. 稳定错误名

验证失败时，实现方应该暴露以下稳定错误名之一：

| 错误 | 含义 |
| --- | --- |
| `invalid_envelope` | Envelope 无法解码或规范化。 |
| `unsupported_version` | `schema` 或 `version` 不受支持。 |
| `unsupported_profile` | `chain_family` 或 `profile` 不受支持。 |
| `payload_hash_mismatch` | 重新计算的 payload hash 与 `tx.payload_hash` 不一致。 |
| `chain_mismatch` | 恢复出的链目标与 `tx` 或验证器策略不一致。 |
| `origin_unverified` | 请求了 `requireVerified`，但来源认证失败。 |
| `trust_expired` | Metadata、root 或签名证书不在有效期内。 |
| `trust_revoked` | Root 或签名证书已被吊销。 |
| `signature_invalid` | 交易、COSE 或证书签名无效。 |
| `runtime_state_required` | 完整判断需要链上状态或可信快照。 |

实现可以返回额外诊断字段，但这些错误名是测试和集成使用的可移植失败词汇。

## 5. 一致性测试向量

一致性测试向量是固定文件，包含：

- envelope CBOR hex 或 trust metadata CBOR hex；
- 适用时的期望 `schema`、`version`、`chain_family`、`profile` 和 `tx_kind`；
- 期望 `payload_hash`；
- 参考验证器的期望 `ok` 结果。

声称支持 `WTP-v1` 的实现应该直接加载这些向量，而不是用自己的 encoder 重新生成。
