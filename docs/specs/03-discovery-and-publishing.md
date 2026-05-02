# WTP Discovery and Publishing

中文：[WTP 发现与发布](03-discovery-and-publishing.zh-CN.md)

## 1. Scope

This document defines how vendors publish public trust metadata for `WTP`.

It does not define the local trust anchor installation process. Trust anchors remain verifier-local.

## 2. Well-Known Publishing

Vendors SHOULD publish `WTP` trust metadata under:

- `/.well-known/wtp/metadata.cbor`
- `/.well-known/wtp/metadata.json`

The CBOR form is the normative machine-readable representation.
The JSON form is a diagnostic and audit-friendly mirror.

## 3. Metadata Model

The published trust bundle is:

```text
WtpTrustMetadata = {
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

Referenced records are:

```text
VendorRootRecord = {
  version,
  record_type,        // vendor_root
  vendor_id,
  display_name,
  algorithm,          // Ed25519
  public_key,
  root_fingerprint,
  valid_from,
  valid_to,
  status              // active | inactive | retired
}

QrSigningCertificate = {
  version,
  cert_type,          // qr_signing
  vendor_id,
  key_id,
  algorithm,          // Ed25519
  public_key,
  issuer_root_fingerprint,
  valid_from,
  valid_to,
  status,             // active | inactive | retired
  issuer_signature
}

RevocationRecord = {
  type,               // vendor_root | root | signing_key | qr_signing_cert | certificate
  root_fingerprint?,
  key_id?,
  revoked_at?,
  reason?
}

MirrorRecord = {
  role,
  url,
  media_type
}

TrustMetadataAuth = {
  auth_mode,          // none | root_sig
  root_fingerprint?,
  signing_key_id?,
  algorithm?,
  signature?
}
```

## 4. Top-Level Fields

- `schema`
  MUST be `wtp-trust`.
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
  Vendor root records (`VendorRootRecord[]`).
- `qr_signing_certs`
  Active or historical QR signing certificates (`QrSigningCertificate[]`).
- `revocations`
  Revocation records for roots, certs, or signing keys (`RevocationRecord[]`).
- `mirrors`
  Optional alternate distribution URLs (`MirrorRecord[]`).
- `auth`
  Signature metadata for the trust bundle itself (`TrustMetadataAuth`).

All `issued_at`, `expires_at`, `valid_from`, `valid_to`, and `revoked_at` values MUST be RFC 3339 date-time strings. Producers SHOULD emit UTC strings with a trailing `Z`. The diagnostic JSON form MUST wrap binary fields as `{ "encoding": "base64url", "value": "<unpadded-base64url>" }`; the CBOR form MUST encode the same fields as byte strings.

Mirrors are advisory distribution hints. A verifier MAY fetch metadata from a mirror, but it MUST verify the fetched trust bundle exactly as it would verify the primary URL or local file. A mirror URL, DNS name, HTTPS certificate, or GitHub repository MUST NOT become a trust anchor by itself.

## 5. Metadata Signature

The recommended mode is:

- `auth.auth_mode = root_sig`

In this mode:

- the metadata body MUST be canonically encoded as CBOR,
- the signer MUST produce a detached `COSE_Sign1`,
- the signer MUST be one of the locally trusted vendor roots.

The signed metadata body is `WtpTrustMetadata` without the `auth` field. This prevents circular signing while keeping `roots`, `qr_signing_certs`, `revocations`, and `mirrors` covered by the root signature.

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

Revocation records become active when `revoked_at` is missing, empty, or when verifier time is greater than or equal to `revoked_at`. `revoked_at` MUST use the RFC 3339 date-time format defined above. Producers SHOULD omit `revoked_at` for immediate revocation instead of emitting an empty string.

Supported revocation targets:

- `type = vendor_root` or `root`, matched by `root_fingerprint`;
- `type = signing_key`, `qr_signing_cert`, or `certificate`, matched by `key_id` and optionally `root_fingerprint`.

For a root revocation, `root_fingerprint` is REQUIRED. For a signing key or certificate revocation, `key_id` is REQUIRED and `root_fingerprint` SHOULD be included when the same key identifier could appear under multiple roots.
