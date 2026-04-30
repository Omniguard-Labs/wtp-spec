import test from 'node:test';
import assert from 'node:assert/strict';

import {
  WtvSdk,
  evm,
  generateQrSigningIdentity,
  generateVendorRoot
} from '../src/index.js';

const OWNER_A_PRIVATE_KEY =
  '0x59c6995e998f97a5a0044966f094538b29285e6f2d7cb3d5f2b0a3a85d27bce1';
const OWNER_B_PRIVATE_KEY =
  '0x8b3a350cf5c34c9194ca3ff278b85ddbd6d3a1f80de0b31e7f912f3b8c3b6f40';

const vendorRoot = generateVendorRoot({
  vendorId: 'wallet.example',
  displayName: 'Wallet Example'
});

const signingIdentity = generateQrSigningIdentity({
  vendorId: 'wallet.example',
  keyId: 'qr-2026-01',
  rootRecord: vendorRoot.rootRecord,
  rootPrivateKeyPem: vendorRoot.privateKeyPem
});

const trustedRoots = [vendorRoot.rootRecord];
const sdk = new WtvSdk({ trustedRoots });

function buildSafeTx() {
  return {
    safe: '0x1111111111111111111111111111111111111111',
    chainId: 1,
    to: '0x2222222222222222222222222222222222222222',
    value: 123456789n,
    data: '0xa9059cbb0000000000000000000000003333333333333333333333333333333333333333000000000000000000000000000000000000000000000000000000000000002a',
    operation: 'call',
    safeTxGas: 0,
    baseGas: 0,
    gasPrice: 0,
    gasToken: '0x0000000000000000000000000000000000000000',
    refundReceiver: '0x0000000000000000000000000000000000000000',
    nonce: 7
  };
}

function approvedHashSignature(owner) {
  return `0x${'0'.repeat(24)}${owner.slice(2).toLowerCase()}${'0'.repeat(64)}01`;
}

test('Safe sign-request envelope should round-trip under evm-safe-v1', () => {
  const safeTx = buildSafeTx();
  const envelope = evm.createSafeSignRequestEnvelope({
    safeTx,
    vendorId: 'wallet.example',
    signingCertificate: signingIdentity.certificate,
    signingPrivateKeyPem: signingIdentity.privateKeyPem
  });
  const qrText = evm.encodeSafeEnvelopeToQrText(envelope);
  const decoded = evm.decodeSafeEnvelopeFromQrText(qrText);
  const verification = sdk.evm.verifyEnvelope(decoded, {
    requireVerified: true,
    expectedChainId: 1,
    expectedSafe: safeTx.safe
  });

  assert.equal(decoded.schema, 'wtv');
  assert.equal(decoded.chain_family, 'evm');
  assert.equal(decoded.profile, 'evm-safe-v1');
  assert.equal(decoded.tx.tx_kind, 'safe_sign_request');
  assert.equal(verification.ok, true);
  assert.equal(verification.auth.verified, true);
  assert.equal(verification.parsedSafeTx.safe, safeTx.safe);
  assert.equal(verification.parsedSafeTx.nonce, '7');
});

test('Safe signed tx envelope should verify EOA signatures offline', () => {
  const safeTx = buildSafeTx();
  const signed = evm.signSafeTransaction({
    safeTx,
    privateKeys: [OWNER_A_PRIVATE_KEY, OWNER_B_PRIVATE_KEY]
  });
  const envelope = evm.createSafeSignedTxEnvelope({
    safeTx,
    signatures: signed.signatures,
    vendorId: 'wallet.example',
    signingCertificate: signingIdentity.certificate,
    signingPrivateKeyPem: signingIdentity.privateKeyPem
  });
  const verification = sdk.evm.verifyEnvelope(envelope, {
    requireVerified: true,
    expectedChainId: 1,
    expectedOwners: signed.signers,
    expectedThreshold: 2
  });

  assert.equal(verification.ok, true);
  assert.equal(verification.checks.signaturesValid, true);
  assert.equal(verification.signatures.offlineVerified, true);
  assert.deepEqual(verification.signatures.recoveredSigners, signed.signers);
  assert.equal(verification.safeTxHash, signed.safeTxHash);
});

test('Safe eth_sign signatures should be recognized and recovered offline', () => {
  const safeTx = buildSafeTx();
  const signed = evm.signSafeTransaction({
    safeTx,
    privateKey: OWNER_A_PRIVATE_KEY,
    signatureType: 'eth_sign'
  });
  const envelope = evm.createSafeSignedTxEnvelope({
    safeTx,
    signatures: signed.signatures
  });
  const verification = sdk.evm.verifySafeEnvelope(envelope, {
    expectedOwners: signed.signers,
    expectedThreshold: 1
  });

  assert.equal(verification.ok, true);
  assert.equal(verification.signatures.parsed[0].signature_type, 'eth_sign');
  assert.deepEqual(verification.signatures.recoveredSigners, signed.signers);
});

test('Safe unsupported signatures should still enforce owner and threshold policy', () => {
  const safeTx = buildSafeTx();
  const owner = '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
  const nonOwner = '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';
  const envelope = evm.createSafeSignedTxEnvelope({
    safeTx,
    signatures: approvedHashSignature(owner)
  });

  const strictVerification = sdk.evm.verifySafeEnvelope(envelope, {
    expectedOwners: [owner],
    expectedThreshold: 1
  });
  const allowedVerification = sdk.evm.verifySafeEnvelope(envelope, {
    expectedOwners: [owner],
    expectedThreshold: 1,
    allowUnsupportedSafeSignatures: true
  });
  const wrongOwnerVerification = sdk.evm.verifySafeEnvelope(envelope, {
    expectedOwners: [nonOwner],
    expectedThreshold: 1,
    allowUnsupportedSafeSignatures: true
  });

  assert.equal(strictVerification.ok, false);
  assert.equal(strictVerification.signatures.parsed[0].signature_type, 'approved_hash');
  assert.equal(strictVerification.signatures.unsupportedCount, 1);
  assert.equal(allowedVerification.ok, true);
  assert.equal(allowedVerification.signatures.thresholdValid, true);
  assert.equal(wrongOwnerVerification.ok, false);
  assert.equal(wrongOwnerVerification.signatures.ownersValid, false);
});

test('Safe execTransaction calldata should parse when nonce is supplied', () => {
  const safeTx = buildSafeTx();
  const signed = evm.signSafeTransaction({
    safeTx,
    privateKeys: [OWNER_A_PRIVATE_KEY, OWNER_B_PRIVATE_KEY]
  });
  const execTransactionData = evm.buildSafeExecTransactionCalldata({
    safeTx,
    signatures: signed.signatures
  });
  const envelope = evm.createSafeExecTransactionEnvelope({
    safe: safeTx.safe,
    chainId: safeTx.chainId,
    nonce: safeTx.nonce,
    execTransactionData,
    vendorId: 'wallet.example',
    signingCertificate: signingIdentity.certificate,
    signingPrivateKeyPem: signingIdentity.privateKeyPem
  });
  const verification = sdk.evm.verifyEnvelope(envelope, {
    requireVerified: true,
    expectedChainId: 1,
    expectedOwners: signed.signers,
    expectedThreshold: 2
  });

  assert.equal(envelope.tx.tx_kind, 'safe_exec_transaction');
  assert.equal(verification.ok, true);
  assert.equal(verification.checks.execTransactionValid, true);
  assert.equal(verification.signatures.offlineVerified, true);
});

test('Safe signature tampering should break verification', () => {
  const safeTx = buildSafeTx();
  const signed = evm.signSafeTransaction({
    safeTx,
    privateKey: OWNER_A_PRIVATE_KEY
  });
  const envelope = evm.createSafeSignedTxEnvelope({
    safeTx,
    signatures: signed.signatures
  });
  const tampered = evm.decodeSafeEnvelope(evm.encodeSafeEnvelope(envelope));
  const signatureBytes = new Uint8Array(tampered.tx.signatures);
  signatureBytes[signatureBytes.length - 1] = 29;
  tampered.tx.signatures = signatureBytes;

  const verification = sdk.evm.verifySafeEnvelope(tampered, {
    expectedOwners: signed.signers,
    expectedThreshold: 1
  });

  assert.equal(verification.ok, false);
  assert.equal(verification.checks.signaturesValid, false);
});
