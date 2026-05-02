# WTP EVM Profile

English: [WTP EVM Profile](10-evm-profile.md)

## 1. Profile 标识

- `chain_family = evm`
- `profile = evm-tx-v1`
- `profile = evm-safe-v1`
- 状态：已实现

## 2. 支持的 Payload

交易种类：

- `sign_request`
- `signed_tx`

交易类型：

- `legacy`
- `eip2930`
- `eip1559`
- `eip4844`
- `eip7702`

Safe 交易种类：

- `safe_sign_request`
- `safe_signed_tx`
- `safe_exec_transaction`

## 3. tx 记录

EVM `tx` 对象使用：

- `version`
- `chain_id`
- `tx_kind`
- `tx_type`
- `unsigned_tx_bytes` 或 `signed_tx_bytes`
- `payload_hash`
- `from`
- `issued_at`
- `expires_at`
- `wallet_app_id`
- `sim_block`

## 4. 链校验

`chain_id` 是 EVM 链标识。

验证器必须：

- 解析携带的交易字节；
- 从 canonical payload 恢复 `chainId`；
- 将其与 `tx.chain_id` 比对；
- 当验证器策略提供 `expectedChainId` 时，也与其比对。

任何不匹配都必须使 envelope 无效。

## 5. Canonical Payload 规则

### 5.1 legacy

Unsigned signable bytes 必须遵循 EIP-155：

`rlp([nonce, gasPrice, gasLimit, to, value, data, chainId, 0, 0])`

### 5.2 eip2930

Unsigned signable bytes 必须遵循 EIP-2930：

`0x01 || rlp([chainId, nonce, gasPrice, gasLimit, to, value, data, accessList])`

### 5.3 eip1559

Unsigned signable bytes 必须遵循 EIP-1559：

`0x02 || rlp([chainId, nonce, maxPriorityFeePerGas, maxFeePerGas, gasLimit, to, value, data, accessList])`

### 5.4 eip4844

Unsigned signable bytes 必须遵循 EIP-4844：

`0x03 || rlp([chainId, nonce, maxPriorityFeePerGas, maxFeePerGas, gasLimit, to, value, data, accessList, maxFeePerBlobGas, blobVersionedHashes])`

### 5.5 eip7702

Unsigned signable bytes 必须遵循 EIP-7702：

`0x04 || rlp([chainId, nonce, maxPriorityFeePerGas, maxFeePerGas, gasLimit, destination, value, data, accessList, authorizationList])`

Authorization tuple 为：

`[chain_id, address, nonce, y_parity, r, s]`

## 6. Safe Profile

`evm-safe-v1` 是 Safe Smart Account 离线签名的 EVM profile。它不是 raw EVM
transaction profile。被签名对象是 SafeTx：

`evm-safe-v1` 的顶层 `tx` 记录使用：

| 字段 | 要求 |
| --- | --- |
| `version` | 必须为 `1`。 |
| `chain_id` | 十进制字符串，必须与 `SafeTx.chain_id` 一致。 |
| `tx_kind` | `safe_sign_request`、`safe_signed_tx` 或 `safe_exec_transaction`。 |
| `tx_type` | 必须为 `safe_tx`。 |
| `safe` | Safe 地址，按 [06 互通规则](06-interoperability.zh-CN.md#3-编码约定) 中的 EVM 地址约定编码。 |
| `safe_tx_bytes` | `SafeTx` 的 canonical CBOR 编码。 |
| `safe_tx_hash` | `SafeTx` 的 Safe EIP-712 签名 digest。 |
| `payload_hash` | 对 `safe_tx_bytes` 计算的 WTP payload hash。 |
| `signatures` | `safe_signed_tx` 使用 packed Safe signatures；其他情况为 `null`。 |
| `exec_transaction_data` | `safe_exec_transaction` 使用外层 `execTransaction(...)` calldata；其他情况为 `null`。 |
| `issued_at` | Envelope 签发时间。 |
| `expires_at` | 可选 envelope 过期时间。 |
| `wallet_app_id` | 可选钱包应用标识。 |
| `sim_block` | 可选模拟 block 标识。 |

```text
SafeTx = {
  safe,
  chain_id,
  to,
  value,
  data,
  operation,
  safe_tx_gas,
  base_gas,
  gas_price,
  gas_token,
  refund_receiver,
  nonce
}
```

验证器计算：

- `domain_separator = keccak256(abi.encode(EIP712Domain(uint256 chainId,address verifyingContract), chain_id, safe))`
- `safe_tx_struct_hash = keccak256(abi.encode(SafeTx(...), to, value, keccak256(data), operation, safe_tx_gas, base_gas, gas_price, gas_token, refund_receiver, nonce))`
- `safe_tx_hash = keccak256(0x1901 || domain_separator || safe_tx_struct_hash)`
- `payload_hash = keccak256(CBOR(SafeTx))`

`safe_tx_struct_hash` 是 Safe 签名计算内部的 EIP-712 struct hash。`safe_tx_hash` 是 owner 实际签名、验证器用于 Safe 签名恢复的 Safe signing digest。`payload_hash` 是 WTP 对 envelope payload 的完整性绑定。这些 hash 覆盖的域不同，不得互相替代。

对于 `safe_exec_transaction`，外层 EVM calldata 必须是 `execTransaction(...)`。
因为 Safe `execTransaction(...)` 从合约 storage 读取 Safe nonce，nonce 不在 calldata
中。验证器需要链上状态或可信状态快照，才能检查当前 nonce 是否新鲜。

离线签名处理：

- `v = 27/28` 的 EOA EIP-712 签名可以离线恢复；
- 使用 Safe `v > 30` 约定的 `eth_sign` 签名，可以在套用 EIP-191 32-byte message prefix 后离线恢复；
- 离线恢复必须兼容 Safe 合约的 `ecrecover` 行为，不得仅因为 `s` 为 high-S 而拒绝一个其他方面有效的 Safe ECDSA 签名；
- EIP-1271 合约签名、approved hash 和 P-256 签名可以解析，但完整验证需要链上状态、合约调用或可信状态快照；
- Safe 要求 owner 签名按 owner 地址升序排列。签名存在时，验证器应该检查排序。

Owner set、threshold 和当前 nonce 都是 Safe 合约状态。如果验证策略或可信 metadata
没有提供这些状态，`evm-safe-v1` 只能证明 SafeTx hash 和可恢复签名，不能完整证明可执行性。

## 7. 验证检查

EVM 验证器应该返回：

- profile 匹配结果；
- 交易类型；
- 恢复出的 chain ID；
- 如有请求，返回 expected chain 匹配结果；
- 对 `signed_tx` 返回恢复出的发送方；
- payload hash 结果；
- 来源验证结果；
- 解码交易摘要。

对于 `evm-safe-v1`，验证器还应该返回：

- Safe 地址；
- SafeTxHash；
- 恢复出的 Safe signer；
- 需要链上状态的 unsupported signature type；
- 当验证策略提供 owner 和 threshold 时，返回 owner/threshold 检查结果；
- 如存在 `execTransaction(...)` calldata，返回 calldata 一致性检查结果。
