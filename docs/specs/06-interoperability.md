# WTP Interoperability

中文：[WTP 互通规则](06-interoperability.zh-CN.md)

## 1. Scope

This document keeps the `WTP-v1` extension surface small enough for independent implementations to interoperate.

## 2. Wire Identifiers

`WTP-v1` defines these initial wire identifiers:

| Namespace | Values |
| --- | --- |
| Envelope schema | `wtp` |
| Trust metadata schema | `wtp-trust` |
| QR text prefix | `wtp1:` |
| QR frame prefix | `wtp1/` |
| Chain family | `evm`, `solana` |
| Profile | `evm-tx-v1`, `evm-safe-v1`, `solana-tx-v1` |
| Envelope auth mode | `none`, `vendor_sig` |
| Trust metadata auth mode | `none`, `root_sig` |
| Envelope signature algorithm | `Ed25519` |

The `wtp` wire namespace is normative for `WTP-v1`; the public standard name is
`WTP`.

The envelope signature algorithm row applies to envelope-level and trust-metadata `COSE_Sign1` signatures. Transaction-level signatures follow each chain's native scheme and are specified by the corresponding profile or chain standard.

New chain families, profiles, auth modes, and envelope signature algorithms require a specification update and conformance vectors before they are treated as interoperable.

## 3. Encoding Conventions

`WTP-v1` implementations MUST use these portable encodings:

| Value | Encoding |
| --- | --- |
| CBOR binary values | CBOR byte strings, not hex text. |
| QR body | Unpadded base64url of the CBOR envelope bytes. |
| Fragmented QR frames | `wtp1/<index>-<total>/<chunk>` as defined by [01 Envelope](01-envelope.md#51-fragment-encoding). |
| Diagnostic JSON binary values | `{ "encoding": "base64url", "value": "<unpadded-base64url>" }`. |
| Timestamps | RFC 3339 date-time strings; producers SHOULD emit UTC with trailing `Z`. |
| `root_fingerprint` | `sha256:` followed by 64 lowercase hex characters. |
| EVM addresses | `0x`-prefixed 20-byte hex; producers SHOULD emit lowercase canonical form. |
| EVM byte strings in diagnostic contexts | `0x`-prefixed lowercase hex. |
| Solana public keys | Canonical base58 string form. |

Verifiers MAY accept non-canonical but equivalent input forms during normalization, such as EIP-55 checksum EVM addresses. Values stored in canonical CBOR records and conformance vectors SHOULD use the canonical forms above.

## 4. Cross-Profile tx Field Matrix

Profile-specific `tx` records use the following field names:

| Profile | Format field | Chain target field | Carried bytes | Payload hash |
| --- | --- | --- | --- | --- |
| `evm-tx-v1` | `tx_type` (`legacy`, `eip2930`, `eip1559`, `eip4844`, `eip7702`) | `chain_id` | `unsigned_tx_bytes` or `signed_tx_bytes` | `keccak256` over carried bytes |
| `evm-safe-v1` | `tx_type = safe_tx` | `chain_id` inside `SafeTx` and top-level `tx.chain_id` | `safe_tx_bytes` | `keccak256(CBOR(SafeTx))` |
| `solana-tx-v1` | `tx_format` (`legacy`, `v0`) | `cluster` | `message_bytes` or `serialized_tx_bytes` | `SHA-256` over carried bytes |

The EVM profile uses `tx_type` because EVM transaction type is a chain-native term. The Solana profile uses `tx_format` because `legacy` and `v0` describe message or transaction serialization formats. Cross-chain tooling SHOULD treat both as profile-specific transaction format selectors.

## 5. Versioning and Extensions

The `wtp1:` QR prefix maps to envelope `schema = wtp` and `version = 1`.
Future major versions MAY register a different prefix, but `WTP-v1`
implementations MUST treat the identifiers above as the interoperable v1 set.

A `WTP-v1` verifier MUST reject unsupported `schema`, `version`, `chain_family`, or `profile` values.

Producers MUST NOT place security-sensitive semantics in unregistered fields. Verifiers MAY ignore unknown fields, but they MUST NOT display or act on ignored fields as verified data. A change that adds verified semantics requires either a registered profile update or a new profile identifier.

## 6. Stable Error Names

Implementations SHOULD expose one of these stable error names when verification fails:

| Error | Meaning |
| --- | --- |
| `invalid_envelope` | The envelope cannot be decoded or normalized. |
| `unsupported_version` | `schema` or `version` is unsupported. |
| `unsupported_profile` | `chain_family` or `profile` is unsupported. |
| `payload_hash_mismatch` | Recomputed payload hash differs from `tx.payload_hash`. |
| `chain_mismatch` | Recovered chain target differs from `tx` or verifier policy. |
| `origin_unverified` | `requireVerified` was requested but origin authentication failed. |
| `trust_expired` | Metadata, root, or signing certificate is outside its validity window. |
| `trust_revoked` | A root or signing certificate is revoked. |
| `signature_invalid` | A transaction, COSE, or certificate signature is invalid. |
| `runtime_state_required` | Chain state or a trusted snapshot is required for a complete answer. |

Implementations MAY return additional diagnostic fields, but these names are the portable failure vocabulary for tests and integrations.

## 7. Conformance Vectors

Conformance vectors are fixed files containing:

- encoded envelope CBOR hex or trust metadata CBOR hex;
- expected `schema`, `version`, `chain_family`, `profile`, and `tx_kind` when applicable;
- expected `payload_hash`;
- the expected `ok` result for the reference verifier.

An implementation claiming `WTP-v1` support SHOULD load these vectors directly instead of regenerating them from its own encoder. See [07 Worked Examples](07-worked-examples.md) for the current vector map.
