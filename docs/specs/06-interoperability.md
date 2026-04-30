# WTV Interoperability

中文：[WTV 互通规则](06-interoperability.zh-CN.md)

## 1. Scope

This document keeps the `WTV-v1` extension surface small enough for independent implementations to interoperate.

## 2. Registered Identifiers

`WTV-v1` defines these initial identifiers:

| Namespace | Values |
| --- | --- |
| Envelope schema | `wtv` |
| Trust metadata schema | `wtv-trust` |
| QR text prefix | `wtv1:` |
| QR frame prefix | `wtv1/` |
| Chain family | `evm`, `solana` |
| Profile | `evm-tx-v1`, `evm-safe-v1`, `solana-tx-v1` |
| Envelope auth mode | `none`, `vendor_sig` |
| Trust metadata auth mode | `none`, `root_sig` |
| Envelope signature algorithm | `Ed25519` |

The envelope signature algorithm row applies to envelope-level and trust-metadata `COSE_Sign1` signatures. Transaction-level signatures follow each chain's native scheme and are specified by the corresponding profile or chain standard.

New chain families, profiles, auth modes, and envelope signature algorithms require a specification update and conformance vectors before they are treated as interoperable.

## 3. Versioning and Extensions

The `wtv1:` QR prefix maps to envelope `schema = wtv` and `version = 1`.

A `WTV-v1` verifier MUST reject unsupported `schema`, `version`, `chain_family`, or `profile` values.

Producers MUST NOT place security-sensitive semantics in unregistered fields. Verifiers MAY ignore unknown fields, but they MUST NOT display or act on ignored fields as verified data. A change that adds verified semantics requires either a registered profile update or a new profile identifier.

## 4. Stable Error Names

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

## 5. Conformance Vectors

Conformance vectors are fixed files containing:

- encoded envelope CBOR hex or trust metadata CBOR hex;
- expected `schema`, `version`, `chain_family`, `profile`, and `tx_kind` when applicable;
- expected `payload_hash`;
- the expected `ok` result for the reference verifier.

An implementation claiming `WTV-v1` support SHOULD load these vectors directly instead of regenerating them from its own encoder.
