# WTP Calculation and Verification

中文：[WTP 计算与校验](05-calculation-and-verification.zh-CN.md)

## 1. Scope

This document summarizes the concrete calculations performed by the `WTP-v1` reference SDK. Profile documents remain authoritative for chain-specific field requirements.

It covers:

- envelope encoding and QR text recovery;
- payload hash calculation;
- origin-signature calculation;
- chain target validation;
- signed transaction validation.

## 2. Envelope Encoding

A verifier receives either an object, CBOR bytes, or QR text.

The current QR text form is:

```text
wtv1: base64url( CBOR( WtvEnvelope ) )
```

The verifier decodes base64url, decodes CBOR, normalizes the envelope fields, and validates:

- `schema = wtv`
- `version = 1`
- `chain_family`
- `profile`

`WTP-v1` canonical CBOR follows RFC 8949 Section 4.2 deterministic encoding with definite lengths and shortest-form integers. This specification uses the length-first map key ordering described by RFC 8949 Section 4.2.3: map keys are ordered first by the length of their deterministic CBOR encoding, then by bytewise lexical order. Floating-point values, tags, and indefinite-length items are not used by `WTP-v1`.

Fragmented QR text uses frames with the `wtv1/` prefix. Reassembly MUST preserve frame ordering before decoding the final `wtv1:` text.

## 3. Payload Hash Calculation

`payload_hash` binds the envelope to the exact transaction bytes carried by the selected profile.

### 3.1 EVM

For `profile = evm-tx-v1`:

For `tx_kind = sign_request`:

```text
payload_hash = keccak256(unsigned_tx_bytes)
```

For `tx_kind = signed_tx`:

```text
payload_hash = keccak256(signed_tx_bytes)
```

The verifier parses the carried bytes, recomputes the same hash, and compares it with `tx.payload_hash`.

For `profile = evm-safe-v1`:

```text
payload_hash = keccak256(CBOR(SafeTx))
safe_tx_hash = keccak256(0x1901 || domain_separator || safe_tx_struct_hash)
```

The verifier decodes `safe_tx_bytes`, recomputes both `payload_hash` and `safe_tx_hash`, and compares them with the `tx` record. Safe signatures are checked against `safe_tx_hash`.

### 3.2 Solana

For `tx_kind = sign_request`:

```text
payload_hash = SHA-256(message_bytes)
```

For `tx_kind = signed_tx`:

```text
payload_hash = SHA-256(serialized_tx_bytes)
```

The verifier parses the carried bytes, recomputes the same hash, and compares it with `tx.payload_hash`.

## 4. Origin Signature Calculation

`auth_mode = vendor_sig` authenticates the canonical `tx` record, not the rendered QR image or wallet UI text.

The signing payload is:

```text
signature_payload = canonical_CBOR(tx)
```

The signature container is a detached `COSE_Sign1` using Ed25519:

```text
signature = COSE_Sign1.detached(signature_payload, qr_signing_private_key)
```

The verifier:

1. finds the QR signing certificate in `auth.signing_cert`;
2. verifies that certificate against a locally trusted vendor root;
3. recomputes `canonical_CBOR(tx)`;
4. verifies the detached `COSE_Sign1` with the certificate public key;
5. treats origin as verified only when both certificate validation and signature validation pass.

`auth_mode = none` still allows transaction-byte recovery and payload-hash validation, but it does not prove wallet-vendor origin.

## 5. Trust Material Calculation

A vendor root record is identified by:

```text
root_fingerprint = "sha256:" || hex(SHA-256(SPKI_DER(root_public_key)))
```

A QR signing certificate contains a QR signing public key and is signed by the vendor root over the canonical certificate payload.

The validation chain is:

```text
Vendor Root -> QR Signing Certificate -> detached COSE_Sign1 over tx
```

Remote metadata from HTTPS, GitHub, or `/.well-known/wtv/` is distribution material. The trust anchor remains the verifier's locally trusted root fingerprint or root certificate.

Default validity windows in the reference SDK are intentionally short and explicit:

- vendor root record: 365 days;
- QR signing certificate: 180 days;
- trust metadata: 180 days.

During trust metadata verification, `issued_at` and `expires_at` must both be present and valid for verifier time. Active revocations invalidate matching roots or QR signing certificates before certificate checks are accepted.

## 6. Chain Target Validation

Origin verification does not replace chain validation.

### 6.1 EVM

For `evm-tx-v1`, the verifier recovers `chainId` from raw transaction bytes.

The verifier recovers `chainId` from `unsigned_tx_bytes` or `signed_tx_bytes` and checks:

```text
recovered_chain_id == tx.chain_id
```

If verifier policy supplies `expectedChainId`, the verifier also checks:

```text
recovered_chain_id == expectedChainId
```

Any mismatch invalidates the envelope.

For `evm-safe-v1`, the verifier recovers `chain_id` from `SafeTx` and applies the same `expectedChainId` policy. Safe `execTransaction(...)` calldata does not include the Safe nonce, so nonce freshness requires chain state or a trusted state snapshot.

### 6.2 Solana

Solana transaction bytes do not encode the cluster. The verifier treats `tx.cluster` as an envelope declaration and checks it only against verifier policy:

```text
tx.cluster == expectedCluster
```

When a verifier relies on the cluster declaration for a security decision, it MUST require `auth_mode = vendor_sig` or another authenticated local policy for the cluster. `auth_mode = none` can still be used for byte recovery and diagnostics, but the cluster declaration is then only an unauthenticated hint.

## 7. Signed Transaction Validation

### 7.1 EVM

For signed EVM transactions, the verifier parses the signature fields, reconstructs the signable hash according to the transaction type, and recovers the sender address. The recovered values are returned in the parsed transaction summary.

For Safe transactions, the verifier computes `safe_tx_hash` and parses the packed Safe `signatures` bytes. EOA EIP-712 signatures and Safe `eth_sign` signatures can be recovered offline. Offline Safe recovery MUST match Safe contract `ecrecover` behavior for ECDSA signatures and MUST NOT reject an otherwise valid Safe signature solely because `s` is high. EIP-1271 contract signatures, approved hashes, and P-256 signatures are parsed but require chain state, contract calls, or a trusted state snapshot for complete validation.

### 7.2 Solana

For signed Solana transactions, the verifier:

- serializes the message bytes;
- verifies the signature count against the required signer count;
- verifies each non-zero Ed25519 signature over the message bytes;
- validates packet size against the Solana packet limit used by the SDK.

## 8. Verification Result

A successful verification requires the envelope structure, profile, payload hash, chain target, and profile-specific transaction checks to pass.

When `requireVerified = true`, origin verification must also pass. When `requireVerified = false`, an unauthenticated envelope can still be `ok` if the transaction-byte and chain checks pass.
