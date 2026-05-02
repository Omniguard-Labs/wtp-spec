# omniguard.example

中文：[omniguard.example](#omniguardexample-中文)

This is a non-production OmniGuard sample `WTP` vendor publication tree.
It demonstrates the public trust material format other vendors should follow.

Published material:

- [.well-known/wtp/metadata.cbor](.well-known/wtp/metadata.cbor)
  canonical machine-readable trust metadata
- [.well-known/wtp/metadata.json](.well-known/wtp/metadata.json)
  audit-friendly diagnostic mirror

Sample identifiers:

- `vendor_id`: `omniguard.example`
- QR signing certificate `key_id`: `qr-2026-01`
- root fingerprint:
  `sha256:1a2d031160ff8e56e2478850d2341b5b1bbcaad592692fe3b380b1087bd4a9a8`

This sample root and QR signing certificate are for repository examples only.
They are not OmniGuard production trust anchors.

No private keys should be stored in this directory.

## omniguard.example 中文

English: [omniguard.example](#omniguardexample)

这是一个非生产用途的 OmniGuard `WTP` 厂商发布目录样例，用来展示其他厂商应遵循的公开信任材料格式。

已发布材料：

- [.well-known/wtp/metadata.cbor](.well-known/wtp/metadata.cbor)
  canonical 机器可读 trust metadata
- [.well-known/wtp/metadata.json](.well-known/wtp/metadata.json)
  便于审计的诊断镜像

样例标识：

- `vendor_id`：`omniguard.example`
- QR 签名证书 `key_id`：`qr-2026-01`
- root fingerprint：
  `sha256:1a2d031160ff8e56e2478850d2341b5b1bbcaad592692fe3b380b1087bd4a9a8`

这套 root 和 QR 签名证书只用于仓库示例，不是 OmniGuard 生产环境信任锚。

不要在该目录保存任何私钥。
