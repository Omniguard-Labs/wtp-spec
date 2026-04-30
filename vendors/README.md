# WTV Vendor Directory

中文：[WTV 厂商目录](#wtv-厂商目录)

This directory contains vendor-published trust material examples. Each vendor should use one directory named by `vendor_id`.

Recommended layout:

```text
vendors/<vendor_id>/
  README.md
  .well-known/wtv/
    metadata.json
    metadata.cbor
```

Rules:

- `metadata.cbor` is the normative machine-readable artifact.
- `metadata.json` is a diagnostic mirror using base64url wrappers for binary fields.
- Public files may include roots, QR signing certificates, revocations, mirrors, and metadata signatures.
- Private root keys and QR signing keys MUST NOT be committed here.

## 中文

English: [WTV Vendor Directory](#wtv-vendor-directory)

本目录用于放置厂商公开信任材料样例。每个厂商使用一个以 `vendor_id` 命名的目录。

推荐结构：

```text
vendors/<vendor_id>/
  README.md
  .well-known/wtv/
    metadata.json
    metadata.cbor
```

规则：

- `metadata.cbor` 是规范的机器可读产物。
- `metadata.json` 是诊断镜像，二进制字段使用 base64url wrapper。
- 公开文件可以包含 root、QR 签名证书、吊销记录、mirror 和 metadata 签名。
- root 私钥和 QR signing 私钥不得提交到这里。
