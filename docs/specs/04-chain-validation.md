# WTV Chain Validation

中文：[WTV 链校验](04-chain-validation.zh-CN.md)

## 1. Scope

This document defines the common chain validation rules for `WTV-v1`.

It covers the implemented profiles:

- EVM: `evm-tx-v1`, `evm-safe-v1`
- Solana: `solana-tx-v1`

## 2. Common Rules

A verifier MUST:

1. validate `schema`, `version`, `chain_family`, and `profile`;
2. parse the transaction bytes using the selected profile;
3. recompute `payload_hash`;
4. compare the profile chain identifier with any verifier-supplied expected target.

Origin verification (`auth`) does not replace chain validation. It only proves who signed the envelope.

## 3. EVM Rules

EVM uses `tx.chain_id`.

A verifier MUST:

- recover `chainId` from `unsigned_tx_bytes` or `signed_tx_bytes`;
- for `evm-safe-v1`, recover `chain_id` from `SafeTx`;
- compare the recovered value with `tx.chain_id`;
- reject the envelope when `expectedChainId` is supplied and does not match.

The current SDK exposes this policy check as `verifyEnvelope(..., { expectedChainId })`.

## 4. Solana Rules

Solana uses `tx.cluster`.

Solana transaction bytes do not encode the cluster. Therefore a verifier MUST treat `cluster` as an envelope declaration, not as a value recoverable from message bytes.

A chain-aware verifier SHOULD:

- require `tx.cluster` to be present;
- compare it with the verifier-supplied expected cluster;
- require `auth_mode = vendor_sig` when relying on the cluster declaration for a security decision.

Without authenticated origin or an authenticated local policy, `cluster` is only a hint.

The current SDK exposes this policy check as `verifyEnvelope(..., { expectedCluster })`.

## 5. Completion Status

| Area | EVM | Solana |
| --- | --- | --- |
| Profile dispatch | Implemented | Implemented |
| Payload hash validation | Implemented | Implemented |
| Chain identifier check | `chain_id` recovered from bytes or SafeTx | `cluster` checked as declaration |
| Expected target policy | `expectedChainId` | `expectedCluster` |
| Signed transaction validation | Sender recovery; Safe signer recovery for EOA / `eth_sign` | Ed25519 signature checks |
