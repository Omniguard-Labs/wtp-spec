# WTP Solana Profile

中文：[WTP Solana Profile](20-solana-profile.zh-CN.md)

## 1. Profile Identifier

- `chain_family = solana`
- `profile = solana-tx-v1`
- Status: Implemented

## 2. Supported Payloads

Transaction kinds:

- `sign_request`
- `signed_tx`

Transaction formats:

- `legacy`
- `v0`

`v0` supports versioned messages and may include Address Lookup Table references.

## 3. tx Record

The Solana `tx` object uses:

- `version`
- `cluster`
- `tx_kind`
- `tx_format`
- `message_bytes` or `serialized_tx_bytes`
- `payload_hash`
- `fee_payer`
- `recent_blockhash`
- `required_signatures`
- `signer_pubkeys`
- `issued_at`
- `expires_at`
- `wallet_app_id`
- `last_valid_block_height`
- `sim_slot`

## 4. Chain Validation

`cluster` is the Solana chain or cluster declaration.

Solana transaction bytes do not encode the cluster. A verifier cannot recover `cluster` from `message_bytes` or `serialized_tx_bytes`.

A chain-aware verifier SHOULD:

- compare `tx.cluster` with `expectedCluster` when supplied by verifier policy;
- require `auth_mode = vendor_sig` when relying on the cluster declaration for a security decision;
- treat blockhash freshness as separate runtime validation.

Any expected-cluster mismatch MUST invalidate the envelope.

With `auth_mode = none`, `cluster` is an unauthenticated hint. A verifier MAY still recover and parse transaction bytes, but it MUST NOT treat the cluster declaration as verified.

## 5. Canonical Payload Rules

### 5.1 sign_request

- `legacy` MUST carry `Message.serialize()` bytes.
- `v0` MUST carry `MessageV0.serialize()` bytes.
- `payload_hash` MUST be the SHA-256 digest of `message_bytes`.

### 5.2 signed_tx

- `legacy` MUST carry canonical serialized `Transaction` bytes.
- `v0` MUST carry canonical serialized `VersionedTransaction` bytes.
- `payload_hash` MUST be the SHA-256 digest of `serialized_tx_bytes`.

## 6. Verification Checks

A Solana verifier SHOULD return:

- profile match result;
- transaction format;
- cluster declaration;
- expected cluster match result when requested;
- fee payer, recent blockhash, and signer set;
- packet size result;
- Ed25519 signature results for `signed_tx`;
- payload hash result;
- origin verification result.
