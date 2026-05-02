# WTP Go SDK

中文：[WTP Go SDK](#wtp-go-sdk-中文)

This package is the Go SDK scaffold for `WTP-v1`. The package name is `wtp`
to match the `WTP-v1` wire namespace.

Current scope:

- shared schema constants;
- EVM and Safe profile constants;
- trust metadata, vendor root, QR signing certificate, and revocation structs for the diagnostic JSON form;
- `.well-known/wtp/` URL helper;
- default validity-window helper aligned with the reference SDK.

Not yet implemented:

- CBOR canonical encoding;
- detached COSE_Sign1 signing and verification;
- EVM, Safe, and Solana transaction profile parsing.

## WTP Go SDK 中文

English: [WTP Go SDK](#wtp-go-sdk)

该包是 `WTP-v1` 的 Go SDK 骨架。包名使用 `wtp`，与 `WTP-v1` wire
namespace 保持一致。

当前范围：

- 共享 schema 常量；
- EVM 和 Safe profile 常量；
- diagnostic JSON 形式的 trust metadata、厂商根、QR 签名证书和吊销结构体；
- `.well-known/wtp/` URL helper；
- 与参考 SDK 对齐的默认有效期 helper。

尚未实现：

- CBOR canonical encoding；
- detached COSE_Sign1 签名与验签；
- EVM、Safe 和 Solana 交易 profile 解析。
