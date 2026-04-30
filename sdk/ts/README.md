# WTP TypeScript SDK

中文：[WTP TypeScript SDK](#wtp-typescript-sdk-中文)

This SDK entry point re-exports the current JavaScript reference implementation in `../../src`.

```ts
import { WtpSdk, evm, generateVendorRoot } from './sdk/ts/index.js';
```

Current scope:

- EVM and Solana envelope creation and verification;
- Safe `evm-safe-v1` SafeTxHash calculation, EOA / `eth_sign` recovery, and `execTransaction(...)` calldata parsing;
- vendor root and QR signing certificate helpers;
- trust metadata encoding, decoding, signing, and verification;
- QR text encoding and fragmentation helpers through profile exports.

The implementation is JavaScript-first today. The adjacent `index.d.ts` provides a conservative TypeScript surface for consumers.

## WTP TypeScript SDK 中文

English: [WTP TypeScript SDK](#wtp-typescript-sdk)

该 SDK 入口重新导出 `../../src` 中的 JavaScript 参考实现。

```ts
import { WtpSdk, evm, generateVendorRoot } from './sdk/ts/index.js';
```

当前范围：

- EVM 和 Solana envelope 创建与验证；
- Safe `evm-safe-v1` SafeTxHash 计算、EOA / `eth_sign` 恢复和 `execTransaction(...)` calldata 解析；
- 厂商根和 QR 签名证书 helper；
- trust metadata 编码、解码、签名与验证；
- 通过 profile 导出的 QR 文本编码与分片 helper。

当前实现以 JavaScript 为主。旁边的 `index.d.ts` 提供保守的 TypeScript 类型表面。
