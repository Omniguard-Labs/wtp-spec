# WTV

中文：[README 中文](#中文)

`WTV` is the only specification identifier used by this repository.

- Formal standard name: `Wallet Transaction Verification Standard`
- Chinese standard name: `钱包交易验证标准`
- Short specification identifier: `WTV`
- Current version: `WTV-v1`

Older code names are no longer kept in the repository.

## Specification Identifiers

The reference implementation uses these identifiers:

- envelope schema: `wtv`
- trust metadata schema: `wtv-trust`
- QR text prefix: `wtv1:`
- `.well-known` publishing path: `/.well-known/wtv/`
- SDK entry point: `WtvSdk`

## Principle Overview

`WTV` places the raw transaction bytes for a sign request or a signed transaction into a portable envelope. After recovering the envelope from QR text, a verifier parses the original transaction bytes again, recomputes `payload_hash`, and compares the result with the fields declared in the envelope.

Although the public name is shorter, the security goal remains cross-verification / independent verification: another independent device checks the wallet-displayed transaction content, target chain, and origin authenticity.

When a wallet vendor supplies `vendor_sig`, the verifier validates the QR signing certificate against a locally trusted vendor root, then verifies the detached `COSE_Sign1` signature over the canonical `tx` record. This answers three questions: whether the transaction bytes changed, whether the target chain matches policy, and whether the QR payload came from a trusted origin.

Profile-specific calculations:

- EVM: recover `chainId` from RLP or typed transaction bytes and compute `keccak256` over the transaction bytes as `payload_hash`.
- Solana: recover fee payer, recent blockhash, and signer set from message or serialized transaction bytes and compute `SHA-256` over the bytes as `payload_hash`; `cluster` is an envelope declaration, so security-sensitive flows should require `vendor_sig`.

Detailed rules are documented in [docs/specs/05-calculation-and-verification.md](docs/specs/05-calculation-and-verification.md) and [docs/specs/05-calculation-and-verification.zh-CN.md](docs/specs/05-calculation-and-verification.zh-CN.md).

## Goals

- Recover the original sign-request or signed-transaction bytes from QR payloads.
- Verify QR origin by using public wallet-vendor trust material.
- Decode, verify, simulate, and cross-check transactions on an independent device.
- Support multiple chain profiles; the current implementation supports `EVM` and `Solana`.

## Public Collaboration

`WTV-v1` is currently a draft standard.

- Specification changes are discussed through issues, discussions, and pull requests.
- Security companies, wallet vendors, and researchers may review wording and contribute test vectors.
- Major changes are allowed before `WTV-v1` is frozen.
- GitHub setup: [docs/github-setup.md](docs/github-setup.md)
- Participation guide: [docs/participation.md](docs/participation.md)

## Implementation Status

| Feature | EVM | Solana |
| --- | --- | --- |
| Profile | `evm-tx-v1` / `evm-safe-v1` | `solana-tx-v1` |
| Transaction types | `legacy` / `eip2930` / `eip1559` / `eip4844` / `eip7702` / SafeTx | `legacy` / `v0` |
| Transaction recovery | `unsigned_tx_bytes` / `signed_tx_bytes` | `message_bytes` / `serialized_tx_bytes` |
| Chain validation | `chain_id` is recovered from transaction bytes or SafeTx; supports `expectedChainId` | `cluster` is an envelope declaration; supports `expectedCluster` |
| Signature validation | recovers sender for signed transactions; recovers Safe EOA / `eth_sign` signatures offline | validates Ed25519 signatures for signed transactions |
| Origin authentication | `Vendor Root -> QR Signing Certificate -> COSE_Sign1` | same as EVM |

Solana `cluster` is not encoded inside transaction bytes, so `vendor_sig` is required to authenticate the declared origin of that field.

Safe `evm-safe-v1` remains under the EVM chain family, but the signed object is a SafeTx instead of a broadcast raw EVM transaction. WTV can compute SafeTxHash and recover EOA / `eth_sign` signatures offline; owner set, threshold, current nonce, EIP-1271 contract signatures, and approved hashes still require chain state or a trusted state snapshot for complete execution validity.

## Documentation

- [docs/specs/README.md](docs/specs/README.md)
  bilingual specification index
- [docs/specs/05-calculation-and-verification.md](docs/specs/05-calculation-and-verification.md)
  English calculation and verification rules
- [docs/specs/05-calculation-and-verification.zh-CN.md](docs/specs/05-calculation-and-verification.zh-CN.md)
  Chinese calculation and verification rules
- [docs/specs/06-interoperability.md](docs/specs/06-interoperability.md)
  registered identifiers, versioning, error names, and vector requirements
- [docs/specs/06-interoperability.zh-CN.md](docs/specs/06-interoperability.zh-CN.md)
  中文互通规则
- [docs/appendix/references.md](docs/appendix/references.md)
  reference standards and official documents
- [docs/dependencies.md](docs/dependencies.md)
  dependency choices, audit status, and maintenance posture
- [docs/roadmap.md](docs/roadmap.md)
  current TODO and roadmap
- [CONTRIBUTING.md](CONTRIBUTING.md)
  contribution guide
- [GOVERNANCE.md](GOVERNANCE.md)
  governance process

## Layout

- [sdk](sdk)
  language-specific SDK entry points
- [sdk/ts](sdk/ts)
  TypeScript / JavaScript SDK that reuses the current `src` reference implementation
- [sdk/go](sdk/go)
  Go SDK scaffold with constants, metadata structs, URL helpers, and validity helpers
- [src/core](src/core)
  shared encoding, signing, certificate, and trust-material utilities
- [src/profiles/evm](src/profiles/evm)
  EVM profile implementation
- [src/profiles/solana](src/profiles/solana)
  Solana profile implementation
- [vendors](vendors)
  vendor-published trust material directory
- [test/vectors/wtv-v1-smoke.json](test/vectors/wtv-v1-smoke.json)
  minimal conformance vectors
- [vendors/wallet.example/.well-known/wtv/metadata.cbor](vendors/wallet.example/.well-known/wtv/metadata.cbor)
  sample normative trust metadata
- [vendors/wallet.example/.well-known/wtv/metadata.json](vendors/wallet.example/.well-known/wtv/metadata.json)
  sample diagnostic trust metadata mirror

## Install

```bash
npm install
```

## Test

```bash
npm test
(
  cd sdk/go
  go test ./...
)
```

## Quick Example

```js
import {
  WtvSdk,
  evm,
  generateVendorRoot,
  generateQrSigningIdentity
} from './src/index.js';

const vendorRoot = generateVendorRoot({
  vendorId: 'wallet.example',
  displayName: 'Wallet Example'
});

const signingIdentity = generateQrSigningIdentity({
  vendorId: 'wallet.example',
  keyId: 'qr-2026-01',
  rootRecord: vendorRoot.rootRecord,
  rootPrivateKeyPem: vendorRoot.privateKeyPem
});

const sdk = new WtvSdk({
  trustedRoots: [vendorRoot.rootRecord]
});

const envelope = evm.createSignRequestEnvelope({
  txLike: {
    type: 'eip1559',
    chainId: 1,
    nonce: 3,
    maxPriorityFeePerGas: 2_000_000_000n,
    maxFeePerGas: 40_000_000_000n,
    gasLimit: 120_000,
    to: '0x4444444444444444444444444444444444444444',
    value: 0n,
    data: '0xdeadbeef',
    accessList: []
  },
  from: '0x1234567890abcdef1234567890abcdef12345678',
  signingCertificate: signingIdentity.certificate,
  signingPrivateKeyPem: signingIdentity.privateKeyPem
});

const verification = sdk.evm.verifyEnvelope(envelope, {
  requireVerified: true,
  expectedChainId: 1
});
```

## License

- Reference SDK: `Apache-2.0`
- Specification documents: `CC-BY-4.0`

## 中文

English: [README](#wtv)

`WTV` 是本仓库唯一的规范标识。

- 正式规范名：`Wallet Transaction Verification Standard`
- 中文名：`钱包交易验证标准`
- 规范短编号：`WTV`
- 当前版本：`WTV-v1`

为避免混淆，仓库中不再保留旧代号。

## 规范标识

当前参考实现统一使用这些标识：

- envelope schema：`wtv`
- trust metadata schema：`wtv-trust`
- QR 文本前缀：`wtv1:`
- `.well-known` 发布路径：`/.well-known/wtv/`
- SDK 入口：`WtvSdk`

## 原理概览

`WTV` 把钱包要签名或已经签名的交易字节放入一个可携带的 envelope。验证设备从 QR 文本恢复 envelope 后，会重新解析原始交易字节、重新计算 `payload_hash`，并把结果和 envelope 中声明的字段进行比对。

虽然名称简化为 Wallet Transaction Verification，核心安全目标仍然是 cross-verification / independent verification：在另一台独立设备上复核钱包展示的交易内容、目标链和来源可信度。

如果钱包厂商提供 `vendor_sig`，验证设备还会使用本地信任的厂商根密钥验证 QR 签名证书，再验证该证书对规范化 `tx` 记录的 detached `COSE_Sign1` 签名。这样可以同时回答三个问题：交易字节是否被改动、目标链是否匹配、二维码来源是否可信。

链相关计算由 profile 决定：

- EVM：从 RLP 或 typed transaction 字节恢复 `chainId`，对交易字节计算 `keccak256` 作为 `payload_hash`。
- Solana：从 message 或 serialized transaction 字节恢复 fee payer、recent blockhash 和 signer 集合，对字节计算 `SHA-256` 作为 `payload_hash`；`cluster` 是 envelope 声明，安全敏感场景应要求 `vendor_sig`。

详细计算与校验规则见 [docs/specs/05-calculation-and-verification.zh-CN.md](docs/specs/05-calculation-and-verification.zh-CN.md) 和 [docs/specs/05-calculation-and-verification.md](docs/specs/05-calculation-and-verification.md)。

## 目标

- 从二维码恢复原始待签名或已签名交易
- 用厂商公开信任材料验证二维码来源
- 在独立设备上完成解码、验签、模拟和交叉校验
- 支持多链 profile；当前实现为 `EVM` 和 `Solana`

## 公开协作

`WTV-v1` 当前为 draft standard。

- 规范变更通过 issue、discussion 和 PR 公开讨论
- 安全公司、钱包公司和研究员可参与审阅与测试向量建设
- 重大变更在 `WTV-v1` 冻结前允许调整
- GitHub 设置参考：[docs/github-setup.md](docs/github-setup.md)
- 参与方式参考：[docs/participation.md](docs/participation.md)

## 当前实现状态

| 功能 | EVM | Solana |
| --- | --- | --- |
| Profile | `evm-tx-v1` / `evm-safe-v1` | `solana-tx-v1` |
| 交易类型 | `legacy` / `eip2930` / `eip1559` / `eip4844` / `eip7702` / SafeTx | `legacy` / `v0` |
| 交易恢复 | `unsigned_tx_bytes` / `signed_tx_bytes` | `message_bytes` / `serialized_tx_bytes` |
| 链校验 | `chain_id` 从交易字节或 SafeTx 恢复；支持 `expectedChainId` | `cluster` 为 envelope 声明；支持 `expectedCluster` |
| 签名校验 | signed tx 恢复发送方；Safe EOA / `eth_sign` 签名可离线恢复 | signed tx 校验 Ed25519 签名 |
| 来源认证 | `Vendor Root -> QR Signing Certificate -> COSE_Sign1` | 同 EVM |

Solana 的 `cluster` 不在交易字节内，依赖 `vendor_sig` 才能认证声明来源。

Safe 的 `evm-safe-v1` 属于 EVM chain family，但签名对象是 SafeTx 而不是广播用 raw EVM transaction。WTV 可以离线计算 SafeTxHash 并恢复 EOA / `eth_sign` 签名；owner set、threshold、当前 nonce、EIP-1271 合约签名和 approved hash 仍需要链上状态或可信快照才能完整判定。

## 文档

- [docs/specs/README.md](docs/specs/README.md)
  中英文规范文档入口
- [docs/specs/05-calculation-and-verification.md](docs/specs/05-calculation-and-verification.md)
  English calculation and verification rules
- [docs/specs/05-calculation-and-verification.zh-CN.md](docs/specs/05-calculation-and-verification.zh-CN.md)
  中文计算与校验规则
- [docs/specs/06-interoperability.md](docs/specs/06-interoperability.md)
  registered identifiers, versioning, error names, and vector requirements
- [docs/specs/06-interoperability.zh-CN.md](docs/specs/06-interoperability.zh-CN.md)
  中文互通规则
- [docs/appendix/references.md](docs/appendix/references.md)
  参考标准与官方文档
- [docs/dependencies.md](docs/dependencies.md)
  依赖选择、安全审计状态和维护策略
- [docs/roadmap.md](docs/roadmap.md)
  当前 TODO 与路线图
- [CONTRIBUTING.md](CONTRIBUTING.md)
  贡献指南
- [GOVERNANCE.md](GOVERNANCE.md)
  治理流程

## 目录

- [sdk](sdk)
  多语言 SDK 入口
- [sdk/ts](sdk/ts)
  TypeScript / JavaScript SDK，复用当前 `src` 参考实现
- [sdk/go](sdk/go)
  Go SDK 骨架，包含常量、metadata 结构体、URL 和有效期 helper
- [src/core](src/core)
  通用编码、签名、证书与信任材料
- [src/profiles/evm](src/profiles/evm)
  EVM profile 实现
- [src/profiles/solana](src/profiles/solana)
  Solana profile 实现
- [vendors](vendors)
  厂商公开信任材料目录
- [test/vectors/wtv-v1-smoke.json](test/vectors/wtv-v1-smoke.json)
  最小一致性测试向量
- [vendors/wallet.example/.well-known/wtv/metadata.cbor](vendors/wallet.example/.well-known/wtv/metadata.cbor)
  规范 trust metadata 示例
- [vendors/wallet.example/.well-known/wtv/metadata.json](vendors/wallet.example/.well-known/wtv/metadata.json)
  diagnostic trust metadata 镜像示例

## 安装

```bash
npm install
```

## 测试

```bash
npm test
(
  cd sdk/go
  go test ./...
)
```

## 快速示例

```js
import {
  WtvSdk,
  evm,
  generateVendorRoot,
  generateQrSigningIdentity
} from './src/index.js';

const vendorRoot = generateVendorRoot({
  vendorId: 'wallet.example',
  displayName: 'Wallet Example'
});

const signingIdentity = generateQrSigningIdentity({
  vendorId: 'wallet.example',
  keyId: 'qr-2026-01',
  rootRecord: vendorRoot.rootRecord,
  rootPrivateKeyPem: vendorRoot.privateKeyPem
});

const sdk = new WtvSdk({
  trustedRoots: [vendorRoot.rootRecord]
});

const envelope = evm.createSignRequestEnvelope({
  txLike: {
    type: 'eip1559',
    chainId: 1,
    nonce: 3,
    maxPriorityFeePerGas: 2_000_000_000n,
    maxFeePerGas: 40_000_000_000n,
    gasLimit: 120_000,
    to: '0x4444444444444444444444444444444444444444',
    value: 0n,
    data: '0xdeadbeef',
    accessList: []
  },
  from: '0x1234567890abcdef1234567890abcdef12345678',
  signingCertificate: signingIdentity.certificate,
  signingPrivateKeyPem: signingIdentity.privateKeyPem
});

const verification = sdk.evm.verifyEnvelope(envelope, {
  requireVerified: true,
  expectedChainId: 1
});
```

## 许可

- 参考 SDK：`Apache-2.0`
- 规范文档：`CC-BY-4.0`
