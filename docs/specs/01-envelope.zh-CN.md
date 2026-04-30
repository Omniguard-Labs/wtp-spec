# WTP Envelope

English: [WTP Envelope](01-envelope.md)

## 1. Envelope 模型

`WTP` payload 是一个 CBOR 文档，顶层结构如下：

```text
WtvEnvelope = {
  schema,
  version,
  chain_family,
  profile,
  tx,
  auth
}
```

## 2. 顶层字段

- `schema`
  必须为 `wtv`。
- `version`
  对本文档版本必须为 `1`。
- `chain_family`
  标识链族，例如 `evm` 或 `solana`。
- `profile`
  标识链特定交易 profile，例如 `evm-tx-v1`。
- `tx`
  链特定交易记录。
- `auth`
  来源声明和可选验证材料。

## 3. tx 要求

`tx` 对象必须包含足够信息，用于：

- 重建原始交易字节；
- 为所选 profile 标识目标链或 cluster；
- 重新计算稳定的 payload hash；
- 执行独立交易模拟；
- 展示链特定的解码交易内容。

`tx` 对象不得把钱包 UI 文本作为权威 payload。

验证器必须先校验 `chain_family` 和 `profile`，再应用 profile 特定链校验规则。

## 4. auth 要求

`auth` 对象支持两种模式：

- `none`
- `vendor_sig`

在 `none` 模式下，payload 仍可恢复，但来源不会被密码学验证。

在 `vendor_sig` 模式下，签名方必须对 `tx` 对象的 canonical CBOR 编码进行签名。

## 5. 传输 Profile

当前 SDK 传输 profile 为：

```text
wtv1: base64url( CBOR( WtvEnvelope ) )
```

选择该 profile 的原因：

- CBOR 是标准化且紧凑的编码；
- base64url 是标准化编码，易于嵌入 QR payload；
- 传输格式独立于任何特定 QR 渲染库。

动画或分片传输可以把编码后的 payload 拆成多个片段。分片传输必须保留排序 metadata。
