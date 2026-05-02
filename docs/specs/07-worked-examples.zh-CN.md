# WTP 示例

English: [WTP Worked Examples](07-worked-examples.md)

规范示例保存在 [test/vectors/wtp-v1-smoke.json](../../test/vectors/wtp-v1-smoke.json)，这样独立实现可以直接加载参考测试使用的精确字节。

## Envelope 示例

| Profile | Vector name | 完整示例字段 |
| --- | --- | --- |
| `evm-tx-v1` | `evm-eip1559-signed-tx` | `envelope_cbor_hex`、`qr_text`、`payload_hash_hex`、`expected_chain_id`、`expected_from` |
| `evm-safe-v1` | `evm-safe-sign-request` | `envelope_cbor_hex`、`qr_text`、`payload_hash_hex`、`expected_chain_id`、`expected_safe` |
| `solana-tx-v1` | `solana-legacy-sign-request` | `envelope_cbor_hex`、`qr_text`、`payload_hash_hex`、`expected_cluster`、`expected_fee_payer` |

Smoke vectors 有意使用稳定的未认证 envelope，便于做 byte-for-byte 一致性测试。来源签名行为由 SDK 测试覆盖，测试会生成 `vendor_sig` envelope，并验证 `canonical_CBOR(tx)` 上的 `COSE_Sign1`。

## Trust Metadata 示例

同一个 vector 文件包含签名 trust metadata 示例：

| 字段 | 值 |
| --- | --- |
| `schema` | `wtp-trust` |
| `vendor_id` | `wallet.example` |
| `auth.auth_mode` | `root_sig` |
| 完整示例字段 | `metadata_cbor_hex`、`auth_mode`、`expected_ok`；解码后的 metadata 包含 `auth.signature` |

对应的厂商发布产物为：

- [vendors/wallet.example/.well-known/wtp/metadata.cbor](../../vendors/wallet.example/.well-known/wtp/metadata.cbor)
- [vendors/wallet.example/.well-known/wtp/metadata.json](../../vendors/wallet.example/.well-known/wtp/metadata.json)

## 验证命令

```bash
node --test test/vectors.test.js
```

声称支持 `WTP-v1` 的实现应该直接解码 vector 字节并比对期望字段，而不是用自己的 encoder 重新生成。
