# WTV EVM Profile

中文：[WTV EVM Profile](10-evm-profile.zh-CN.md)

## 1. Profile Identifier

- `chain_family = evm`
- `profile = evm-tx-v1`
- `profile = evm-safe-v1`
- Status: Implemented

## 2. Supported Payloads

Transaction kinds:

- `sign_request`
- `signed_tx`

Transaction types:

- `legacy`
- `eip2930`
- `eip1559`
- `eip4844`
- `eip7702`

Safe transaction kinds:

- `safe_sign_request`
- `safe_signed_tx`
- `safe_exec_transaction`

## 3. tx Record

The EVM `tx` object uses:

- `version`
- `chain_id`
- `tx_kind`
- `tx_type`
- `unsigned_tx_bytes` or `signed_tx_bytes`
- `payload_hash`
- `from`
- `issued_at`
- `expires_at`
- `wallet_app_id`
- `sim_block`

## 4. Chain Validation

`chain_id` is the EVM chain identifier.

A verifier MUST:

- parse the carried transaction bytes;
- recover `chainId` from the canonical payload;
- compare it with `tx.chain_id`;
- compare it with `expectedChainId` when supplied by verifier policy.

Any mismatch MUST invalidate the envelope.

## 5. Canonical Payload Rules

### 5.1 legacy

Unsigned signable bytes MUST follow EIP-155:

`rlp([nonce, gasPrice, gasLimit, to, value, data, chainId, 0, 0])`

### 5.2 eip2930

Unsigned signable bytes MUST follow EIP-2930:

`0x01 || rlp([chainId, nonce, gasPrice, gasLimit, to, value, data, accessList])`

### 5.3 eip1559

Unsigned signable bytes MUST follow EIP-1559:

`0x02 || rlp([chainId, nonce, maxPriorityFeePerGas, maxFeePerGas, gasLimit, to, value, data, accessList])`

### 5.4 eip4844

Unsigned signable bytes MUST follow EIP-4844:

`0x03 || rlp([chainId, nonce, maxPriorityFeePerGas, maxFeePerGas, gasLimit, to, value, data, accessList, maxFeePerBlobGas, blobVersionedHashes])`

### 5.5 eip7702

Unsigned signable bytes MUST follow EIP-7702:

`0x04 || rlp([chainId, nonce, maxPriorityFeePerGas, maxFeePerGas, gasLimit, destination, value, data, accessList, authorizationList])`

Authorization tuples are:

`[chain_id, address, nonce, y_parity, r, s]`

## 6. Safe Profile

`evm-safe-v1` is an EVM profile for Safe Smart Account offline signing.
It is not a raw EVM transaction profile. The signed object is a SafeTx:

```text
SafeTx = {
  safe,
  chain_id,
  to,
  value,
  data,
  operation,
  safe_tx_gas,
  base_gas,
  gas_price,
  gas_token,
  refund_receiver,
  nonce
}
```

The verifier computes:

- `domain_separator = keccak256(abi.encode(EIP712Domain(uint256 chainId,address verifyingContract), chain_id, safe))`
- `safe_tx_struct_hash = keccak256(abi.encode(SafeTx(...), to, value, keccak256(data), operation, safe_tx_gas, base_gas, gas_price, gas_token, refund_receiver, nonce))`
- `safe_tx_hash = keccak256(0x1901 || domain_separator || safe_tx_struct_hash)`
- `payload_hash = keccak256(CBOR(SafeTx))`

For `safe_exec_transaction`, the outer EVM calldata MUST be `execTransaction(...)`.
Because Safe `execTransaction(...)` reads the Safe nonce from contract storage,
the nonce is not encoded in calldata. A verifier needs either chain state or a
trusted state snapshot to check current nonce freshness.

Offline signature handling:

- EOA EIP-712 signatures with `v = 27/28` can be recovered offline.
- `eth_sign` signatures with Safe's `v > 30` convention can be recovered offline after applying the EIP-191 32-byte message prefix.
- EIP-1271 contract signatures, approved hashes, and P-256 signatures are parsed but require chain state, contract calls, or a trusted state snapshot for complete verification.
- Safe requires owner signatures to be sorted by owner address. A verifier SHOULD check signer ordering when signatures are present.

Owner set, threshold, and current nonce are Safe contract state. If they are
not supplied by verifier policy or trusted metadata, `evm-safe-v1` can only
prove the SafeTx hash and recoverable signatures, not complete executability.

## 7. Verification Checks

An EVM verifier SHOULD return:

- profile match result;
- transaction type;
- recovered chain ID;
- expected chain match result when requested;
- recovered sender for `signed_tx`;
- payload hash result;
- origin verification result;
- decoded transaction summary.

For `evm-safe-v1`, a verifier SHOULD additionally return:

- Safe address;
- SafeTxHash;
- recovered Safe signers;
- unsupported signature types that require chain state;
- owner and threshold policy results when supplied;
- `execTransaction(...)` calldata consistency result when present.
