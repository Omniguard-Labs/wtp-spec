# WTV 计算与校验

English: [WTV Calculation and Verification](05-calculation-and-verification.md)

## 1. 范围

本文梳理 `WTV-v1` 参考 SDK 执行的具体计算规则。链相关字段要求仍以各 profile 文档为准。

本文覆盖：

- envelope 编码与 QR 文本恢复；
- payload hash 计算；
- 来源签名计算；
- 目标链校验；
- 已签名交易校验。

## 2. Envelope 编码

验证器可以接收对象、CBOR 字节或 QR 文本。

当前 QR 文本格式为：

```text
wtv1: base64url( CBOR( WtvEnvelope ) )
```

验证器先解码 base64url，再解码 CBOR，随后规范化 envelope 字段并校验：

- `schema = wtv`
- `version = 1`
- `chain_family`
- `profile`

`WTV-v1` canonical CBOR 遵循 RFC 8949 第 4.2 节的确定性编码，使用定长长度和最短整数形式。本规范使用 RFC 8949 第 4.2.3 节描述的 length-first map key 排序：先按 key 的确定性 CBOR 编码长度排序，再按字节词典序排序。`WTV-v1` 不使用浮点数、tag 或不定长 item。

分片 QR 文本使用 `wtv1/` 前缀。重新组装时必须保留帧顺序，然后再解码最终的 `wtv1:` 文本。

## 3. Payload Hash 计算

`payload_hash` 用来把 envelope 和所选 profile 携带的精确交易字节绑定起来。

### 3.1 EVM

对于 `profile = evm-tx-v1`：

当 `tx_kind = sign_request`：

```text
payload_hash = keccak256(unsigned_tx_bytes)
```

当 `tx_kind = signed_tx`：

```text
payload_hash = keccak256(signed_tx_bytes)
```

验证器解析携带的交易字节，重新计算同样的 hash，并与 `tx.payload_hash` 比对。

对于 `profile = evm-safe-v1`：

```text
payload_hash = keccak256(CBOR(SafeTx))
safe_tx_hash = keccak256(0x1901 || domain_separator || safe_tx_struct_hash)
```

验证器解码 `safe_tx_bytes`，重新计算 `payload_hash` 和 `safe_tx_hash`，并与 `tx`
记录比对。Safe 签名使用 `safe_tx_hash` 进行校验。

### 3.2 Solana

当 `tx_kind = sign_request`：

```text
payload_hash = SHA-256(message_bytes)
```

当 `tx_kind = signed_tx`：

```text
payload_hash = SHA-256(serialized_tx_bytes)
```

验证器解析携带的交易字节，重新计算同样的 hash，并与 `tx.payload_hash` 比对。

## 4. 来源签名计算

`auth_mode = vendor_sig` 认证的是规范化后的 `tx` 记录，不是渲染后的二维码图片，也不是钱包 UI 文本。

签名 payload 为：

```text
signature_payload = canonical_CBOR(tx)
```

签名容器是使用 Ed25519 的 detached `COSE_Sign1`：

```text
signature = COSE_Sign1.detached(signature_payload, qr_signing_private_key)
```

验证器执行：

1. 从 `auth.signing_cert` 读取 QR 签名证书；
2. 用本地信任的厂商根验证该证书；
3. 重新计算 `canonical_CBOR(tx)`；
4. 用证书公钥验证 detached `COSE_Sign1`；
5. 只有证书验证和签名验证都通过时，来源才视为已验证。

`auth_mode = none` 仍然允许恢复交易字节并校验 payload hash，但不能证明钱包厂商来源。

## 5. 信任材料计算

厂商根记录使用以下指纹识别：

```text
root_fingerprint = "sha256:" || hex(SHA-256(SPKI_DER(root_public_key)))
```

QR 签名证书包含 QR 签名公钥，并由厂商根对规范化证书 payload 签名。

验证链为：

```text
Vendor Root -> QR Signing Certificate -> detached COSE_Sign1 over tx
```

来自 HTTPS、GitHub 或 `/.well-known/wtv/` 的远程 metadata 只是分发材料。最终信任锚仍然是验证器本地信任的根指纹或根证书。

参考 SDK 的默认有效期窗口保持短且明确：

- 厂商根记录：365 天；
- QR 签名证书：180 天；
- trust metadata：180 天。

验证 trust metadata 时，`issued_at` 和 `expires_at` 必须都存在，并且验证器时间必须落在有效窗口内。生效的吊销记录会先让匹配的 root 或 QR 签名证书失效，然后证书检查结果才会被接受。

## 6. 目标链校验

来源认证不能替代链校验。

### 6.1 EVM

对于 `evm-tx-v1`，验证器从 raw transaction bytes 恢复 `chainId`。

验证器从 `unsigned_tx_bytes` 或 `signed_tx_bytes` 恢复 `chainId`，并检查：

```text
recovered_chain_id == tx.chain_id
```

如果验证器策略提供 `expectedChainId`，还需要检查：

```text
recovered_chain_id == expectedChainId
```

任何不匹配都会使 envelope 无效。

对于 `evm-safe-v1`，验证器从 `SafeTx` 恢复 `chain_id`，并应用同样的
`expectedChainId` 策略。Safe `execTransaction(...)` calldata 不包含 Safe nonce，
因此 nonce freshness 需要链上状态或可信状态快照。

### 6.2 Solana

Solana 交易字节不编码 cluster。验证器把 `tx.cluster` 视为 envelope 声明，只能与验证器策略比对：

```text
tx.cluster == expectedCluster
```

当验证器依赖 cluster 声明做安全决策时，必须要求 `auth_mode = vendor_sig`，或使用另一个经过认证的本地 cluster 策略。`auth_mode = none` 仍可用于字节恢复和诊断，但此时 cluster 声明只是未认证 hint。

## 7. 已签名交易校验

### 7.1 EVM

对已签名 EVM 交易，验证器解析签名字段，按交易类型重建 signable hash，并恢复发送方地址。恢复出的值会返回在 parsed transaction summary 中。

对于 Safe 交易，验证器计算 `safe_tx_hash` 并解析 packed Safe `signatures` 字节。
EOA EIP-712 签名和 Safe `eth_sign` 签名可以离线恢复。Safe 离线恢复必须与 Safe 合约的 `ecrecover` 行为一致，不得仅因为 `s` 为 high-S 而拒绝一个其他方面有效的 Safe 签名。EIP-1271 合约签名、approved hash 和 P-256 签名可以解析，但完整验证需要链上状态、合约调用或可信状态快照。

### 7.2 Solana

对已签名 Solana 交易，验证器会：

- 序列化 message bytes；
- 校验签名数量是否等于 required signer 数量；
- 对 message bytes 校验每一个非零 Ed25519 签名；
- 按 SDK 使用的 Solana packet limit 校验 packet size。

## 8. 验证结果

一次成功验证需要 envelope 结构、profile、payload hash、目标链和 profile 特定交易检查全部通过。

当 `requireVerified = true` 时，来源认证也必须通过。当 `requireVerified = false` 时，未认证 envelope 只要交易字节和链校验通过，也可以得到 `ok` 结果。
