# WTV Trust Model

中文：[WTV 信任模型](02-trust-model.zh-CN.md)

## 1. Trust Anchors

`WTV` separates discovery from trust.

- Domain names and GitHub repositories MAY be used for publication and audit.
- They MUST NOT be treated as the final trust anchor.
- The final trust anchor MUST be a locally trusted vendor root fingerprint or root certificate.

## 2. Trust Chain

The recommended verification chain is:

```text
Vendor Root -> QR Signing Certificate -> COSE_Sign1 over tx
```

## 3. auth Object

Recommended fields:

- `auth_mode`
- `vendor_id`
- `signing_key_id`
- `algorithm`
- `signature`
- `signing_cert`
- `root_fingerprint`

## 4. Verification Procedure

A verifier SHOULD perform these checks in order:

1. Decode the envelope and identify `chain_family` and `profile`.
2. Recompute the transaction payload hash from the raw transaction bytes.
3. If `auth_mode = vendor_sig`, validate the signing certificate against a locally trusted root.
4. Verify the detached COSE signature over the canonical `tx` CBOR bytes.
5. Perform chain-specific simulation using an independent RPC source.

## 5. Publication

Vendors MAY publish public trust materials through:

- GitHub
- HTTPS
- `/.well-known/` endpoints

Published materials SHOULD include:

- root public key or root certificate
- signing certificate metadata
- revocation metadata
- status metadata
- historical versions

These published materials are for transparency and distribution. They are not the primary trust anchor.
