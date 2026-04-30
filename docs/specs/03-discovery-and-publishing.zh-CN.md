# WTV 发现与发布

English: [WTV Discovery and Publishing](03-discovery-and-publishing.md)

## 1. 范围

本文定义厂商如何发布 `WTV` 公开信任 metadata。

本文不定义本地信任锚安装流程。信任锚始终保留在验证器本地。

## 2. Well-Known 发布

厂商应该在以下路径发布 `WTV` trust metadata：

- `/.well-known/wtv/metadata.cbor`
- `/.well-known/wtv/metadata.json`

CBOR 形式是规范的机器可读表示。JSON 形式是便于诊断和审计的镜像。

## 3. Metadata 模型

发布的信任包为：

```text
WtvTrustMetadata = {
  schema,
  version,
  vendor_id,
  display_name,
  issued_at,
  expires_at,
  roots,
  qr_signing_certs,
  revocations,
  mirrors,
  auth
}
```

## 4. 顶层字段

- `schema`
  必须为 `wtv-trust`。
- `version`
  必须为 `1`。
- `vendor_id`
  厂商标识字符串。
- `display_name`
  人类可读的厂商名称。
- `issued_at`
  Metadata 签发时间。
- `expires_at`
  Metadata 过期时间。
- `roots`
  厂商根记录。
- `qr_signing_certs`
  当前有效或历史 QR 签名证书。
- `revocations`
  根、证书或签名密钥的吊销记录。
- `mirrors`
  可选的备用分发 URL。
- `auth`
  信任包本身的签名 metadata。

## 5. Metadata 签名

推荐模式为：

- `auth.auth_mode = root_sig`

在该模式下：

- metadata body 必须按 canonical CBOR 编码；
- 签名方必须生成 detached `COSE_Sign1`；
- 签名方必须是本地信任的厂商根之一。

## 6. 验证器行为

验证器应该：

1. 从本地文件、HTTPS endpoint 或 GitHub mirror 加载信任包；
2. 用本地信任根验证信任包签名；
3. 验证其中包含的 QR 签名证书；
4. 使用已验证的包作为 QR 来源检查的公开信任材料。

## 7. 安全说明

- HTTPS 和 GitHub 是分发渠道，不是信任锚。
- 验证器默认不得信任未签名的远程 metadata。
- 验证器应该通过 `expires_at` 执行 freshness 检查。
- 验证器应该把本地信任根与远程拉取的 metadata 分开保存。

## 8. 有效期与吊销策略

当调用方没有显式提供过期时间时，参考 SDK 使用以下默认有效期窗口：

- 厂商根记录：从 `valid_from` 起 365 天；
- QR 签名证书：从 `valid_from` 起 180 天；
- trust metadata：从 `issued_at` 起 180 天。

当 `issued_at` 或 `expires_at` 缺失、格式错误、尚未生效或已经过期时，验证器必须拒绝 trust metadata。

当 `revoked_at` 为空，或验证器时间大于等于 `revoked_at` 时，吊销记录生效。

支持的吊销目标：

- `type = vendor_root` 或 `root`，通过 `root_fingerprint` 匹配；
- `type = signing_key`、`qr_signing_cert` 或 `certificate`，通过 `key_id` 匹配，并可选通过 `root_fingerprint` 限定。
