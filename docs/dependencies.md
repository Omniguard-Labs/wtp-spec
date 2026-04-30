# Dependency Review

中文：[依赖评估](#依赖评估)

## English

`wtv-spec` is a standalone package. It does not depend on other local
OmniArb packages. Runtime dependencies are intentionally small:

- `ethers@^6.16.0`: used by the EVM profile for address normalization, RLP,
  transaction signing/recovery, and `keccak256`. This is the current maintained
  major version and removes the old `@ethersproject/*` v5 dependency tree.
- `@solana/web3.js@^1.98.4`: used by the Solana profile for public-key
  handling, message/transaction serialization, versioned transactions, and
  Solana-compatible signature handling.
- Node.js built-in `crypto`: used for Ed25519, SHA-256, and key encoding in the
  WTV trust model.

As of 2026-04-30, `npm audit --omit=dev` is clean for the EVM dependency path
after the `ethers` v6 migration. The remaining moderate audit finding comes
from `uuid` through `@solana/web3.js` RPC dependencies
(`jayson` / `rpc-websockets`). The current WTV Solana code path does not
create RPC clients, but the packages are still part of the installed dependency
graph.

The recommended posture is:

- Do not force an incompatible `uuid` override under Solana dependencies just
  to silence audit output.
- Keep `@solana/web3.js` for this draft because it is common, mature, and
  reduces transaction-format implementation risk.
- Track a later migration to Solana Kit / fine-grained Solana packages such as
  `@solana/transactions` and `@solana/transaction-messages` once the Solana
  SDK surface is stable enough for this project.

## 依赖评估

English: [Dependency Review](#dependency-review)

`wtv-spec` 是一个独立包，不依赖其他本地 OmniArb 包。运行时依赖保持得比较小：

- `ethers@^6.16.0`：EVM profile 用它做地址规范化、RLP、交易签名/恢复和
  `keccak256`。这是当前维护中的主版本，并移除了旧的 `@ethersproject/*` v5
  依赖树。
- `@solana/web3.js@^1.98.4`：Solana profile 用它做 public key 处理、
  message/transaction 序列化、versioned transaction 和 Solana 兼容签名处理。
- Node.js 内置 `crypto`：WTV 信任模型中用于 Ed25519、SHA-256 和密钥编码。

截至 2026-04-30，迁移到 `ethers` v6 后，EVM 依赖路径上的审计问题已经清掉。
`npm audit --omit=dev` 剩余的中危项来自 `@solana/web3.js` 的 RPC 依赖
(`jayson` / `rpc-websockets`) 间接依赖 `uuid`。当前 WTV 的 Solana 代码路径不创建
RPC client，但这些包仍会出现在安装依赖图中。

建议策略：

- 不为了消除审计输出而强行给 Solana 依赖覆盖不兼容的 `uuid` 版本。
- 当前 draft 阶段继续保留 `@solana/web3.js`，因为它足够通用成熟，能降低 Solana
  交易格式实现风险。
- 后续单独评估迁移到 Solana Kit / 细粒度 Solana 包，例如
  `@solana/transactions` 和 `@solana/transaction-messages`，前提是相关 SDK surface
  对本项目足够稳定。
