# WTP Envelope

中文：[WTP Envelope](01-envelope.zh-CN.md)

## 1. Envelope Model

A `WTP` payload is a CBOR document with this top-level shape:

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

## 2. Top-Level Fields

- `schema`
  MUST be `wtv`.
- `version`
  MUST be `1` for this document version.
- `chain_family`
  Identifies the chain family, for example `evm` or `solana`.
- `profile`
  Identifies the chain-specific transaction profile, for example `evm-tx-v1`.
- `tx`
  Chain-specific transaction record.
- `auth`
  Origin declaration and optional verification material.

## 3. tx Requirements

The `tx` object MUST contain enough information to:

- reconstruct the original transaction bytes,
- identify the intended chain or cluster for the selected profile,
- recompute a stable payload hash,
- perform independent transaction simulation,
- present chain-specific decoded transaction content.

The `tx` object MUST NOT rely on wallet UI text as the authoritative payload.

A verifier MUST validate `chain_family` and `profile` before applying profile-specific chain validation rules.

## 4. auth Requirements

The `auth` object supports two modes:

- `none`
- `vendor_sig`

In `none` mode, the payload remains recoverable but origin is not cryptographically verified.

In `vendor_sig` mode, the signer MUST sign the canonical CBOR encoding of the `tx` object.

## 5. Transport Profile

The current SDK transport profile is:

```text
wtv1: base64url( CBOR( WtvEnvelope ) )
```

This profile is chosen because:

- CBOR is standardized and compact
- base64url is standardized and easy to embed in QR payloads
- the transport stays independent from any specific QR rendering library

Animated or chunked transport MAY split the encoded payload into fragments. Fragment transport MUST preserve ordering metadata.
