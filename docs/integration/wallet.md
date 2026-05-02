# Wallet Integration Guide

中文：[钱包接入指南](#钱包接入指南)

This guide summarizes the minimum work a wallet team needs to publish and verify `WTP-v1` payloads.

## Producer Checklist

1. Pick the profile:
   - EVM raw transaction: `chain_family = evm`, `profile = evm-tx-v1`.
   - EVM Safe transaction: `chain_family = evm`, `profile = evm-safe-v1`.
   - Solana transaction: `chain_family = solana`, `profile = solana-tx-v1`.
2. Put the exact sign-request or signed-transaction bytes into the profile-specific `tx` record.
3. Compute the profile payload hash exactly as defined in [05 Calculation and Verification](../specs/05-calculation-and-verification.md#3-payload-hash-calculation).
4. Add envelope auth:
   - use `auth_mode = none` only for recovery or diagnostics;
   - use `auth_mode = vendor_sig` for production QR payloads.
5. Encode the envelope as `wtp1:<base64url(CBOR(WtpEnvelope))>`.
6. If QR text is too large, split frames using `wtp1/<index>-<total>/<chunk>` from [01 Envelope](../specs/01-envelope.md#51-fragment-encoding).
7. Publish trust metadata under `/.well-known/wtp/metadata.cbor` and keep `metadata.json` as an audit mirror.

## Trust Material Checklist

Wallet vendors should maintain:

- an offline vendor root key;
- one or more QR signing certificates;
- a signed `WtpTrustMetadata` bundle with `auth.auth_mode = root_sig`;
- revocation records for retired, compromised, or replaced roots and signing keys;
- sample conformance vectors for every profile the wallet claims to support.

Remote metadata is distribution material only. Verifiers still need a local policy that trusts the vendor root fingerprint or root certificate.

## Verifier Checklist

1. Decode QR text or join fragments into a single `wtp1:` payload.
2. Decode CBOR and reject unsupported `schema`, `version`, `chain_family`, or `profile`.
3. Normalize profile fields using the encoding conventions in [06 Interoperability](../specs/06-interoperability.md#3-encoding-conventions).
4. Recompute `payload_hash` from the carried transaction bytes.
5. Validate chain target policy:
   - EVM: recover `chainId` from transaction bytes or SafeTx and compare `tx.chain_id`;
   - Solana: compare declared `cluster` with local policy.
6. If `requireVerified = true`, validate `vendor_sig` through the QR signing certificate and locally trusted vendor root.
7. Run simulation or state-dependent checks using an independent RPC or trusted state snapshot.

## Common Pitfalls

- Do not sign rendered wallet UI text. Sign `canonical_CBOR(tx)`.
- Do not treat HTTPS, GitHub, or a DNS name as a trust anchor.
- Do not substitute `safe_tx_hash` for `payload_hash`; they cover different domains.
- Do not rely on unauthenticated Solana `cluster` for security decisions.
- Do not accept fragmented QR frames with missing or duplicate indexes.

## 钱包接入指南

English: [Wallet Integration Guide](#wallet-integration-guide)

本文总结钱包团队接入 `WTP-v1` 所需的最小工作。

## 生产方检查清单

1. 选择 profile：
   - EVM raw transaction：`chain_family = evm`，`profile = evm-tx-v1`。
   - EVM Safe transaction：`chain_family = evm`，`profile = evm-safe-v1`。
   - Solana transaction：`chain_family = solana`，`profile = solana-tx-v1`。
2. 把精确的待签名字节或已签名交易字节放入 profile 特定 `tx` 记录。
3. 按 [05 计算与校验](../specs/05-calculation-and-verification.zh-CN.md#3-payload-hash-计算) 定义计算 profile payload hash。
4. 添加 envelope auth：
   - 仅在恢复或诊断场景使用 `auth_mode = none`；
   - 生产 QR payload 应使用 `auth_mode = vendor_sig`。
5. 将 envelope 编码为 `wtp1:<base64url(CBOR(WtpEnvelope))>`。
6. 如果 QR 文本过大，按 [01 Envelope](../specs/01-envelope.zh-CN.md#51-分片编码) 的 `wtp1/<index>-<total>/<chunk>` 规则分片。
7. 在 `/.well-known/wtp/metadata.cbor` 发布 trust metadata，并保留 `metadata.json` 作为审计镜像。

## 信任材料检查清单

钱包厂商应维护：

- 离线保存的 vendor root key；
- 一个或多个 QR 签名证书；
- 使用 `auth.auth_mode = root_sig` 签名的 `WtpTrustMetadata` 包；
- 对已停用、疑似泄露或被替换 root 和 signing key 的吊销记录；
- 钱包声称支持的每个 profile 的一致性测试向量。

远程 metadata 只是分发材料。验证器仍然需要本地策略信任厂商根指纹或根证书。

## 验证器检查清单

1. 解码 QR 文本，或把分片重组成单个 `wtp1:` payload。
2. 解码 CBOR，并拒绝不支持的 `schema`、`version`、`chain_family` 或 `profile`。
3. 按 [06 互通规则](../specs/06-interoperability.zh-CN.md#3-编码约定) 规范化 profile 字段。
4. 从携带的交易字节重新计算 `payload_hash`。
5. 校验链目标策略：
   - EVM：从交易字节或 SafeTx 恢复 `chainId`，并与 `tx.chain_id` 比对；
   - Solana：将声明的 `cluster` 与本地策略比对。
6. 如果 `requireVerified = true`，通过 QR 签名证书和本地信任厂商根验证 `vendor_sig`。
7. 使用独立 RPC 或可信状态快照执行模拟或状态相关检查。

## 常见坑

- 不要签名钱包 UI 渲染文本；应签名 `canonical_CBOR(tx)`。
- 不要把 HTTPS、GitHub 或 DNS 名称当作信任锚。
- 不要用 `safe_tx_hash` 替代 `payload_hash`；二者覆盖的域不同。
- 不要在安全决策中依赖未认证的 Solana `cluster`。
- 不要接受缺失 index 或重复 index 的 QR 分片。
