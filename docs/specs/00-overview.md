# WTP Overview

中文：[WTP 概览](00-overview.zh-CN.md)

Formal standard title:

**Wallet Transaction Provenance Standard**

Chinese standard title:

**钱包交易构造溯源标准**

Subtitle:

**Transaction construction provenance for wallet-generated envelopes**

Short specification identifier:

**WTP**

Version label:

**WTP-v1**

## Status

- Document status: Draft
- Specification series: `WTP-v1`
- SDK status: EVM, EVM Safe, and Solana implemented

## Scope

`WTP` defines a wallet transaction construction provenance format for:

- recovering the original wallet-generated transaction bytes from a portable payload,
- verifying wallet-vendor origin information and envelope integrity,
- enabling independent simulation, policy checks, and anti-phishing review on another device.

In this specification, provenance refers to the origin and construction context
of a wallet-generated transaction payload. It does not mean on-chain fund-flow
tracing. The normative intent is independent cross-checking by a device or
verifier that is separate from the wallet that created the payload.

`WTP` does not define:

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
