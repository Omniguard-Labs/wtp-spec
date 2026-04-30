# Dependencies

中文：[依赖](#依赖)

## English

`wtp-spec` is a standalone package. It does not depend on other local
OmniArb packages. Runtime dependencies are intentionally small:

- `ethers@^6.16.0`: used by the EVM profile for address normalization, RLP,
  transaction signing/recovery, and `keccak256`. This is the current maintained
  major version and removes the old `@ethersproject/*` v5 dependency tree.
- `@solana/web3.js@^1.98.4`: used by the Solana profile for public-key
  handling, message/transaction serialization, versioned transactions, and
  Solana-compatible signature handling.
- Node.js built-in `crypto`: used for Ed25519, SHA-256, and key encoding in the
  WTP trust model.

The recommended posture is:

- Keep `@solana/web3.js` for this draft because it is common, mature, and
  reduces transaction-format implementation risk.
- Track a later migration to Solana Kit / fine-grained Solana packages such as
  `@solana/transactions` and `@solana/transaction-messages` once the Solana
  SDK surface is stable enough for this project.
- Review audit output during release work, but do not force incompatible
  transitive overrides only to silence tooling.

## 依赖

English: [Dependencies](#dependencies)

`wtp-spec` 是一个独立包，不依赖其他本地 OmniArb 包。运行时依赖保持得比较小：

- `ethers@^6.16.0`：EVM profile 用它做地址规范化、RLP、交易签名/恢复和
  `keccak256`。这是当前维护中的主版本，并移除了旧的 `@ethersproject/*` v5
  依赖树。
- `@solana/web3.js@^1.98.4`：Solana profile 用它做 public key 处理、
  message/transaction 序列化、versioned transaction 和 Solana 兼容签名处理。
- Node.js 内置 `crypto`：WTP 信任模型中用于 Ed25519、SHA-256 和密钥编码。

建议策略：

- 当前 draft 阶段继续保留 `@solana/web3.js`，因为它足够通用成熟，能降低 Solana
  交易格式实现风险。
- 后续单独评估迁移到 Solana Kit / 细粒度 Solana 包，例如
  `@solana/transactions` 和 `@solana/transaction-messages`，前提是相关 SDK surface
  对本项目足够稳定。
- 发布前检查 audit 输出，但不为了消除工具提示而强行覆盖不兼容的传递依赖。
