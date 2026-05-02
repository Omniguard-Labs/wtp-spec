# WTP Vendor Directory

中文：[WTP 厂商目录](#wtp-厂商目录)

This directory contains vendor-published trust material examples. Each vendor should use one directory named by `vendor_id`.

Published examples:

- [wallet.example](wallet.example)
  minimal wallet vendor sample
- [omniguard.example](omniguard.example)
  OmniGuard sample root and QR signing certificate

Recommended layout:

```text
vendors/<vendor_id>/
  README.md
  .well-known/wtp/
    metadata.json
    metadata.cbor
```

Rules:

- `metadata.cbor` is the normative machine-readable artifact.
- `metadata.json` is a diagnostic mirror using base64url wrappers for binary fields.
- Public files may include roots, QR signing certificates, revocations, mirrors, and metadata signatures.
- Private root keys and QR signing keys MUST NOT be committed here.

## Maintaining Vendor Material

Use one stable `vendor_id` and keep public trust material under
`vendors/<vendor_id>/.well-known/wtp/`.

Required metadata fields:

- Top level: `schema`, `version`, `vendor_id`, `display_name`, `issued_at`,
  `expires_at`, `roots`, `qr_signing_certs`, `revocations`, `mirrors`, `auth`.
- `roots[]`: `record_type = vendor_root`, `vendor_id`, `display_name`,
  `algorithm`, `public_key`, `root_fingerprint`, `valid_from`, `valid_to`,
  `status`.
- `qr_signing_certs[]`: `cert_type = qr_signing`, `vendor_id`, `key_id`,
  `algorithm`, `public_key`, `issuer_root_fingerprint`, `valid_from`,
  `valid_to`, `status`, `issuer_signature`.
- `auth`: `auth_mode = root_sig`, `root_fingerprint`, `signing_key_id`,
  `algorithm`, `signature`.

Maintenance rules:

- Keep root private keys offline; publish only root records and fingerprints.
- Use QR signing keys for envelope signatures; rotate them by adding a new
  certificate before revoking the old `key_id`.
- Update `metadata.cbor` and `metadata.json` together in the same change.
- Keep expired or revoked public records when they are needed for audit history.
- Use `revocations[]` for compromised or retired roots and signing keys.
- Treat `metadata.cbor` as canonical. `metadata.json` is for review and should
  match the CBOR decode exactly.

## 中文

English: [WTP Vendor Directory](#wtp-vendor-directory)

本目录用于放置厂商公开信任材料样例。每个厂商使用一个以 `vendor_id` 命名的目录。

已发布样例：

- [wallet.example](wallet.example)
  最小钱包厂商样例
- [omniguard.example](omniguard.example)
  OmniGuard root 与 QR 签名证书样例

推荐结构：

```text
vendors/<vendor_id>/
  README.md
  .well-known/wtp/
    metadata.json
    metadata.cbor
```

规则：

- `metadata.cbor` 是规范的机器可读产物。
- `metadata.json` 是诊断镜像，二进制字段使用 base64url wrapper。
- 公开文件可以包含 root、QR 签名证书、吊销记录、mirror 和 metadata 签名。
- root 私钥和 QR signing 私钥不得提交到这里。

## 厂商材料维护

使用一个稳定的 `vendor_id`，并把公开信任材料放在
`vendors/<vendor_id>/.well-known/wtp/` 下。

必备 metadata 字段：

- 顶层：`schema`、`version`、`vendor_id`、`display_name`、`issued_at`、
  `expires_at`、`roots`、`qr_signing_certs`、`revocations`、`mirrors`、`auth`。
- `roots[]`：`record_type = vendor_root`、`vendor_id`、`display_name`、
  `algorithm`、`public_key`、`root_fingerprint`、`valid_from`、`valid_to`、
  `status`。
- `qr_signing_certs[]`：`cert_type = qr_signing`、`vendor_id`、`key_id`、
  `algorithm`、`public_key`、`issuer_root_fingerprint`、`valid_from`、
  `valid_to`、`status`、`issuer_signature`。
- `auth`：`auth_mode = root_sig`、`root_fingerprint`、`signing_key_id`、
  `algorithm`、`signature`。

维护规则：

- root 私钥离线保存；仓库只发布 root record 和 fingerprint。
- envelope 签名使用 QR signing key；轮换时先添加新证书，再吊销旧
  `key_id`。
- `metadata.cbor` 和 `metadata.json` 必须在同一次变更中一起更新。
- 为了审计历史，必要时保留已过期或已吊销的公开记录。
- root 或 signing key 被替换、停用或疑似泄露时，使用 `revocations[]`
  记录吊销。
- 以 `metadata.cbor` 为 canonical；`metadata.json` 仅用于审阅，内容应与
  CBOR 解码结果完全一致。
