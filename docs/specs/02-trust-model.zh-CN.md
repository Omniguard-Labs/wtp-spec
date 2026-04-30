# WTV 信任模型

English: [WTV Trust Model](02-trust-model.md)

## 1. 信任锚

`WTV` 将发现机制与信任机制分离。

- 域名和 GitHub 仓库可以用于发布和审计。
- 它们不得被视为最终信任锚。
- 最终信任锚必须是本地信任的厂商根指纹或根证书。

## 2. 信任链

推荐验证链为：

```text
Vendor Root -> QR Signing Certificate -> COSE_Sign1 over tx
```

## 3. auth 对象

推荐字段：

- `auth_mode`
- `vendor_id`
- `signing_key_id`
- `algorithm`
- `signature`
- `signing_cert`
- `root_fingerprint`

## 4. 验证流程

验证器应该按以下顺序执行检查：

1. 解码 envelope，并识别 `chain_family` 和 `profile`。
2. 从原始交易字节重新计算交易 payload hash。
3. 如果 `auth_mode = vendor_sig`，用本地信任根验证签名证书。
4. 对 canonical `tx` CBOR 字节验证 detached COSE 签名。
5. 使用独立 RPC 来源执行链特定模拟。

## 5. 发布

厂商可以通过以下渠道发布公开信任材料：

- GitHub
- HTTPS
- `/.well-known/` endpoints

发布材料应该包含：

- 根公钥或根证书；
- 签名证书 metadata；
- 吊销 metadata；
- 状态 metadata；
- 历史版本。

这些公开材料用于透明度和分发，不是主要信任锚。
