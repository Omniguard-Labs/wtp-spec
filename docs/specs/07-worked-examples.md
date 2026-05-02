# WTP Worked Examples

中文：[WTP 示例](07-worked-examples.zh-CN.md)

The canonical worked examples are stored in [test/vectors/wtp-v1-smoke.json](../../test/vectors/wtp-v1-smoke.json) so independent implementations can load the exact bytes used by the reference tests.

## Envelope Examples

| Profile | Vector name | Full example fields |
| --- | --- | --- |
| `evm-tx-v1` | `evm-eip1559-signed-tx` | `envelope_cbor_hex`, `qr_text`, `payload_hash_hex`, `expected_chain_id`, `expected_from` |
| `evm-safe-v1` | `evm-safe-sign-request` | `envelope_cbor_hex`, `qr_text`, `payload_hash_hex`, `expected_chain_id`, `expected_safe` |
| `solana-tx-v1` | `solana-legacy-sign-request` | `envelope_cbor_hex`, `qr_text`, `payload_hash_hex`, `expected_cluster`, `expected_fee_payer` |

The smoke vectors intentionally use stable unauthenticated envelopes for byte-for-byte conformance. Origin-signature behavior is covered by SDK tests that generate `vendor_sig` envelopes and verify `COSE_Sign1` over `canonical_CBOR(tx)`.

## Trust Metadata Example

The same vector file includes a signed trust metadata example:

| Field | Value |
| --- | --- |
| `schema` | `wtp-trust` |
| `vendor_id` | `wallet.example` |
| `auth.auth_mode` | `root_sig` |
| Full example fields | `metadata_cbor_hex`, `auth_mode`, `expected_ok`; the decoded metadata contains `auth.signature` |

The corresponding vendor publication artifacts are:

- [vendors/wallet.example/.well-known/wtp/metadata.cbor](../../vendors/wallet.example/.well-known/wtp/metadata.cbor)
- [vendors/wallet.example/.well-known/wtp/metadata.json](../../vendors/wallet.example/.well-known/wtp/metadata.json)

## Verification Command

```bash
node --test test/vectors.test.js
```

An implementation claiming `WTP-v1` support SHOULD decode the vector bytes directly and compare the expected fields instead of regenerating them from its own encoder.
