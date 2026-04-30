# WTV Discovery and Publishing

中文：[WTV 发现与发布](03-discovery-and-publishing.zh-CN.md)

## 1. Scope

This document defines how vendors publish public trust metadata for `WTV`.

It does not define the local trust anchor installation process. Trust anchors remain verifier-local.

## 2. Well-Known Publishing

Vendors SHOULD publish `WTV` trust metadata under:

- `/.well-known/wtv/metadata.cbor`
- `/.well-known/wtv/metadata.json`

The CBOR form is the normative machine-readable representation.
The JSON form is a diagnostic and audit-friendly mirror.

## 3. Metadata Model

The published trust bundle is:

```text
WtvTrustMetadata = {
  schema,
  version,
  vendor_id,
  display_name,
  issued_at,
  expires_at,
  roots,
  qr_signing_certs,
  revocations,
  mirrors,
  auth
}
```

## 4. Top-Level Fields

- `schema`
  MUST be `wtv-trust`.
- `version`
  MUST be `1`.
- `vendor_id`
  Vendor identifier string.
- `display_name`
  Human-readable vendor name.
- `issued_at`
  Metadata issuance timestamp.
- `expires_at`
  Metadata expiry timestamp.
- `roots`
  Vendor root records.
- `qr_signing_certs`
  Active or historical QR signing certificates.
- `revocations`
  Revocation records for roots, certs, or signing keys.
- `mirrors`
  Optional alternate distribution URLs.
- `auth`
  Signature metadata for the trust bundle itself.

## 5. Metadata Signature

The recommended mode is:

- `auth.auth_mode = root_sig`

In this mode:

- the metadata body MUST be canonically encoded as CBOR,
- the signer MUST produce a detached `COSE_Sign1`,
- the signer MUST be one of the locally trusted vendor roots.

## 6. Verifier Behavior

A verifier SHOULD:

1. load a trust bundle from a local file, HTTPS endpoint, or GitHub mirror,
2. verify the trust bundle signature against a locally trusted root,
3. validate the included QR signing certificates,
4. use the verified bundle as public trust material for QR origin checks.

## 7. Security Notes

- HTTPS and GitHub are distribution channels, not trust anchors.
- A verifier MUST NOT trust unsigned remote metadata by default.
- A verifier SHOULD require freshness checks through `expires_at`.
- A verifier SHOULD keep local trusted roots separate from remotely fetched metadata.

## 8. Validity and Revocation Policy

The reference SDK uses these default validity windows when a caller does not provide an explicit expiry:

- vendor root record: 365 days from `valid_from`;
- QR signing certificate: 180 days from `valid_from`;
- trust metadata: 180 days from `issued_at`.

A verifier MUST reject trust metadata when `issued_at` or `expires_at` is missing, malformed, not yet valid, or expired.

Revocation records become active when `revoked_at` is missing, empty, or when verifier time is greater than or equal to `revoked_at`. Producers SHOULD omit `revoked_at` for immediate revocation instead of emitting an empty string.

Supported revocation targets:

- `type = vendor_root` or `root`, matched by `root_fingerprint`;
- `type = signing_key`, `qr_signing_cert`, or `certificate`, matched by `key_id` and optionally `root_fingerprint`.
