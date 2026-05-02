# WTP Envelope

English: [WTP Envelope](01-envelope.md)

## 1. Envelope 模型

`WTP` payload 是一个 CBOR 文档，顶层结构如下：

```text
WtpEnvelope = {
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
  必须为 `wtp`。
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
- 重新计算稳定的 payload hash（见 [05 计算与校验](05-calculation-and-verification.zh-CN.md#3-payload-hash-计算)）；
- 执行独立交易模拟；
- 展示链特定的解码交易内容。

`tx` 对象不得把钱包 UI 文本作为权威 payload。

验证器必须先校验 `chain_family` 和 `profile`，再应用 profile 特定链校验规则。

## 4. auth 要求

本节只定义 envelope auth。Trust metadata auth 是独立对象，有独立的模式和签名 payload（见 [02 信任模型](02-trust-model.zh-CN.md#3-auth-对象) 和 [03 发现与发布](03-discovery-and-publishing.zh-CN.md#5-metadata-签名)）。

`auth` 对象支持两种模式：

- `none`
- `vendor_sig`

在 `none` 模式下，payload 仍可恢复，但来源不会被密码学验证。

在 `vendor_sig` 模式下，签名方必须对 `tx` 对象的 canonical CBOR 编码进行签名（见 [05 计算与校验](05-calculation-and-verification.zh-CN.md#4-来源签名计算)）。

## 5. 传输 Profile

当前 SDK 传输 profile 为：

```text
wtp1: base64url( CBOR( WtpEnvelope ) )
```

选择该 profile 的原因：

- CBOR 是标准化且紧凑的编码；
- base64url 是标准化编码，易于嵌入 QR payload；
- 传输格式独立于任何特定 QR 渲染库。

动画或分片传输可以把编码后的 payload 拆成多个片段。

### 5.1 分片编码

未分片 QR 文本必须使用以下形式：

```text
wtp1:<body>
```

其中 `<body>` 是 `base64url( CBOR( WtpEnvelope ) )`。

分片 QR 文本必须只拆分 `<body>`，并且每个 frame 必须编码为：

```text
wtp1/<index>-<total>/<chunk>
```

- `<index>` 是十进制、从 1 开始的正整数。
- `<total>` 是总 frame 数，编码为十进制正整数。
- `<chunk>` 是 `<body>` 的非空连续子串。

重组方必须拒绝格式错误的 frame、非正 index、不一致的 total、重复 index、缺失 index，以及大于 `<total>` 的 index。按 `<index>` 排序后，重组方必须拼接所有 chunk，并把得到的 `wtp1:<body>` 文本按普通未分片 QR 文本解码。

分片编码只定义 frame 文本格式。QR 动画时序、图像渲染、重试行为和扫描 UX 不属于 `WTP-v1` 范围。
