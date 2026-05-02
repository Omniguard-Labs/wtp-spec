# WTP Roadmap

中文：[WTP 路线图](#wtp-路线图)

## Current Status

- The public standard name is fixed as `Wallet Transaction Provenance Standard` / `钱包交易构造溯源标准`.
- The `WTP-v1` wire namespace is fixed as `wtp`, including `schema = wtp`, `wtp1:`, and `.well-known/wtp/`.
- The EVM profile covers `legacy`, `eip2930`, `eip1559`, `eip4844`, `eip7702`, and SafeTx.
- The Solana profile covers legacy and v0 transactions.
- The reference SDK supports envelope encoding and decoding, payload hash checks, origin signature checks, trust metadata encoding and verification, QR fragmentation, and minimum conformance vectors.

## Next Phase

1. Expand conformance vectors with more positive and negative EVM, Safe, and Solana cases.
2. Add normative examples for Solana Address Lookup Tables, blockhash freshness, and cluster policy.
3. Clarify trusted snapshot requirements for Safe owner sets, thresholds, nonce freshness, EIP-1271 signatures, and approved hashes.
4. Complete trust metadata rotation, revocation, cache, and refresh flows.
5. Advance the Go scaffold until it can load and verify `test/vectors/wtp-v1-smoke.json`.
6. Add a minimal browser verifier example.

## Deferred

- QR image-layer output.
- Transparency log or audit log extensions.
- X.509 profile.
- Higher-level `simulateAndVerify()` API.

## WTP 路线图

English: [WTP Roadmap](#wtp-roadmap)

## 当前状态

- 公共标准名固定为 `Wallet Transaction Provenance Standard` / `钱包交易构造溯源标准`。
- `WTP-v1` wire namespace 固定为 `wtp`，包括 `schema = wtp`、`wtp1:` 和 `.well-known/wtp/`。
- EVM profile 覆盖 `legacy`、`eip2930`、`eip1559`、`eip4844`、`eip7702` 和 SafeTx。
- Solana profile 覆盖 legacy 与 v0 transaction。
- 参考 SDK 已支持 envelope 编码/解码、payload hash 校验、来源签名校验、trust metadata 编码/验签、QR 分片和最小一致性测试向量。

## 下一阶段

1. 扩展一致性测试向量，覆盖更多 EVM / Safe / Solana 正反例。
2. 补充 Solana Address Lookup Table、blockhash freshness 和 cluster policy 的规范用例。
3. 明确 Safe owner set、threshold、nonce freshness、EIP-1271 签名和 approved hash 的可信快照要求。
4. 完善 trust metadata 轮换、吊销、缓存和刷新流程。
5. 推进 Go scaffold 到能加载并验证 `test/vectors/wtp-v1-smoke.json`。
6. 增加浏览器端最小验证器示例。

## 暂缓项

- QR 图像层输出。
- 透明日志或审计日志扩展。
- X.509 profile。
- 更高层的 `simulateAndVerify()` API。
