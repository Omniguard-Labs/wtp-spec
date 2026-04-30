# WTV Overview

中文：[WTV 概览](00-overview.zh-CN.md)

Formal standard title:

**Wallet Transaction Verification Standard**

Chinese standard title:

**钱包交易验证标准**

Short specification identifier:

**WTV**

Version label:

**WTV-v1**

## Status

- Document status: Draft
- Specification series: `WTV-v1`
- SDK status: EVM, EVM Safe, and Solana implemented

## Scope

`WTV` defines a wallet transaction cross-verification format for:

- recovering the original transaction bytes from a portable payload,
- verifying wallet-vendor origin information,
- enabling independent simulation and anti-phishing checks on another device.

The public name is intentionally short. The normative intent remains
cross-verification / independent verification by a device or verifier that is
separate from the wallet that created the payload.

`WTV` does not define:

- wallet UI requirements,
- transport-layer QR image rendering details,
- chain-specific simulation RPC behavior,
- policy decisions for transaction approval or rejection.

## Design Goals

- Use well-known open standards where possible.
- Separate transport, payload, and trust layers.
- Allow unauthenticated recovery and authenticated recovery in one envelope model.
- Support multiple chain families via profile documents.

## Document Set

- [01 Envelope](01-envelope.md)
- [02 Trust Model](02-trust-model.md)
- [03 Discovery and Publishing](03-discovery-and-publishing.md)
- [04 Chain Validation](04-chain-validation.md)
- [05 Calculation and Verification](05-calculation-and-verification.md)
- [06 Interoperability](06-interoperability.md)
- [10 EVM Profile](10-evm-profile.md)
- [20 Solana Profile](20-solana-profile.md)
- [References](../appendix/references.md)

## Normative Language

The key words `MUST`, `MUST NOT`, `REQUIRED`, `SHOULD`, `SHOULD NOT`, and `MAY` are to be interpreted as described in BCP 14 when shown in all capitals.
