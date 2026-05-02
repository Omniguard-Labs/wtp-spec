# WTP Envelope

中文：[WTP Envelope](01-envelope.zh-CN.md)

## 1. Envelope Model

A `WTP` payload is a CBOR document with this top-level shape:

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

## 2. Top-Level Fields

- `schema`
  MUST be `wtp`.
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
- recompute a stable payload hash (see [05 Calculation and Verification](05-calculation-and-verification.md#3-payload-hash-calculation)),
- perform independent transaction simulation,
- present chain-specific decoded transaction content.

The `tx` object MUST NOT rely on wallet UI text as the authoritative payload.

A verifier MUST validate `chain_family` and `profile` before applying profile-specific chain validation rules.

## 4. auth Requirements

This section defines envelope auth only. Trust metadata auth is a separate object with its own modes and signing payload (see [02 Trust Model](02-trust-model.md#3-auth-objects) and [03 Discovery and Publishing](03-discovery-and-publishing.md#5-metadata-signature)).

The `auth` object supports two modes:

- `none`
- `vendor_sig`

In `none` mode, the payload remains recoverable but origin is not cryptographically verified.

In `vendor_sig` mode, the signer MUST sign the canonical CBOR encoding of the `tx` object (see [05 Calculation and Verification](05-calculation-and-verification.md#4-origin-signature-calculation)).

## 5. Transport Profile

The current SDK transport profile is:

```text
wtp1: base64url( CBOR( WtpEnvelope ) )
```

This profile is chosen because:

- CBOR is standardized and compact
- base64url is standardized and easy to embed in QR payloads
- the transport stays independent from any specific QR rendering library

Animated or chunked transport MAY split the encoded payload into fragments.

### 5.1 Fragment Encoding

Unfragmented QR text MUST use this form:

```text
wtp1:<body>
```

where `<body>` is `base64url( CBOR( WtpEnvelope ) )`.

Fragmented QR text MUST split only `<body>` and MUST encode each frame as:

```text
wtp1/<index>-<total>/<chunk>
```

- `<index>` is a base-10, 1-based positive integer.
- `<total>` is the total frame count as a base-10 positive integer.
- `<chunk>` is a non-empty contiguous substring of `<body>`.

A reassembler MUST reject malformed frames, non-positive indexes, inconsistent totals, duplicate indexes, missing indexes, and indexes greater than `<total>`. After sorting frames by `<index>`, it MUST concatenate chunks and decode the resulting `wtp1:<body>` text as the normal unfragmented QR text.

Fragment encoding defines only the frame text format. QR animation timing, image rendering, retry behavior, and scan UX are out of scope for `WTP-v1`.
