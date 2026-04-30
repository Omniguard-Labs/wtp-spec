import { Buffer } from 'node:buffer';
import test from 'node:test';
import assert from 'node:assert/strict';

import { Keypair, SystemProgram } from '@solana/web3.js';

import {
  WtvSdk,
  generateQrSigningIdentity,
  generateVendorRoot,
  solana
} from '../src/index.js';

function keypairFromSeedByte(seedByte) {
  return Keypair.fromSeed(
    Uint8Array.from({ length: 32 }, (_, index) => (seedByte + index) & 0xff)
  );
}

const payer = keypairFromSeedByte(1);
const recipient = keypairFromSeedByte(101).publicKey;
const alternateRecipient = keypairFromSeedByte(201).publicKey;

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

function buildSolanaCases() {
  return [
    {
      name: 'legacy',
      cluster: 'devnet',
      recentBlockhash: keypairFromSeedByte(51).publicKey.toBase58(),
      txLike: {
        format: 'legacy',
        feePayer: payer.publicKey,
        recentBlockhash: keypairFromSeedByte(51).publicKey.toBase58(),
        instructions: [
          SystemProgram.transfer({
            fromPubkey: payer.publicKey,
            toPubkey: recipient,
            lamports: 1_500n
          })
        ]
      }
    },
    {
      name: 'v0',
      cluster: 'mainnet-beta',
      recentBlockhash: keypairFromSeedByte(61).publicKey.toBase58(),
      txLike: {
        format: 'v0',
        feePayer: payer.publicKey,
        recentBlockhash: keypairFromSeedByte(61).publicKey.toBase58(),
        instructions: [
          SystemProgram.transfer({
            fromPubkey: payer.publicKey,
            toPubkey: recipient,
            lamports: 2_500n
          }),
          SystemProgram.transfer({
            fromPubkey: payer.publicKey,
            toPubkey: alternateRecipient,
            lamports: 900n
          })
        ]
      }
    }
  ];
}

for (const txCase of buildSolanaCases()) {
  test(`solana unsigned sign-request envelope should round-trip for ${txCase.name}`, () => {
    const envelope = solana.createSignRequestEnvelope({
      txLike: txCase.txLike,
      cluster: txCase.cluster,
      vendorId: 'wallet.example',
      signingCertificate: signingIdentity.certificate,
      signingPrivateKeyPem: signingIdentity.privateKeyPem,
      walletAppId: 'omniarb.test',
      lastValidBlockHeight: 123456,
      simSlot: 987654
    });

    const qrText = solana.encodeEnvelopeToQrText(envelope);
    const decoded = solana.decodeEnvelopeFromQrText(qrText);
    const verification = sdk.solana.verifyEnvelope(decoded, {
      requireVerified: true
    });

    assert.equal(decoded.schema, 'wtv');
    assert.equal(decoded.chain_family, 'solana');
    assert.equal(decoded.profile, 'solana-tx-v1');
    assert.equal(decoded.tx.tx_kind, 'sign_request');
    assert.equal(decoded.tx.tx_format, txCase.name);
    assert.equal(decoded.tx.cluster, txCase.cluster);
    assert.equal(decoded.tx.fee_payer, payer.publicKey.toBase58());
    assert.equal(decoded.tx.recent_blockhash, txCase.recentBlockhash);
    assert.equal(decoded.tx.required_signatures, 1);
    assert.deepEqual(decoded.tx.signer_pubkeys, [payer.publicKey.toBase58()]);
    assert.equal(verification.ok, true);
    assert.equal(verification.auth.verified, true);
    assert.equal(verification.parsedTx.kind, 'sign_request');
    assert.equal(verification.parsedTx.txFormat, txCase.name);
    assert.equal(verification.parsedTx.instructionCount, txCase.txLike.instructions.length);
  });

  test(`solana signed transaction envelope should round-trip for ${txCase.name}`, () => {
    const signedTx = solana.signSolanaTransaction({
      txLike: txCase.txLike,
      signers: [payer]
    });
    const envelope = solana.createSignedTxEnvelope({
      signedTx: signedTx.serializedTxBytes,
      cluster: txCase.cluster,
      vendorId: 'wallet.example',
      signingCertificate: signingIdentity.certificate,
      signingPrivateKeyPem: signingIdentity.privateKeyPem,
      walletAppId: 'omniarb.test',
      lastValidBlockHeight: 123456
    });

    const decoded = solana.decodeEnvelope(solana.encodeEnvelope(envelope));
    const verification = sdk.solana.verifyEnvelope(decoded, {
      requireVerified: true
    });

    assert.equal(decoded.schema, 'wtv');
    assert.equal(decoded.chain_family, 'solana');
    assert.equal(decoded.profile, 'solana-tx-v1');
    assert.equal(decoded.tx.tx_kind, 'signed_tx');
    assert.equal(decoded.tx.tx_format, txCase.name);
    assert.equal(decoded.tx.cluster, txCase.cluster);
    assert.equal(verification.ok, true);
    assert.equal(verification.auth.verified, true);
    assert.equal(verification.parsedTx.kind, 'signed_tx');
    assert.equal(verification.parsedTx.txFormat, txCase.name);
    assert.equal(verification.parsedTx.signaturesValid, true);
    assert.equal(verification.parsedTx.signatureCountValid, true);
    assert.equal(verification.parsedTx.signatures.length, 1);
    assert.equal(verification.parsedTx.signatures[0].signer, payer.publicKey.toBase58());
  });
}

test('solana base unauthenticated envelope should still be recoverable', () => {
  const txCase = buildSolanaCases()[0];
  const envelope = solana.createSignRequestEnvelope({
    txLike: txCase.txLike,
    cluster: txCase.cluster,
    vendorId: 'unknown-wallet'
  });
  const verification = sdk.solana.verifyEnvelope(envelope);

  assert.equal(verification.ok, true);
  assert.equal(verification.auth.verified, false);
  assert.equal(verification.auth.reason, 'unauthenticated');
  assert.equal(verification.parsedTx.txFormat, 'legacy');
});

test('solana expectedCluster should validate the target cluster', () => {
  const txCase = buildSolanaCases()[0];
  const envelope = solana.signTransactionToEnvelope({
    txLike: txCase.txLike,
    signers: [payer],
    cluster: txCase.cluster,
    vendorId: 'wallet.example',
    signingCertificate: signingIdentity.certificate,
    signingPrivateKeyPem: signingIdentity.privateKeyPem
  });

  const matched = sdk.solana.verifyEnvelope(envelope, {
    requireVerified: true,
    expectedCluster: 'devnet'
  });
  const mismatched = sdk.solana.verifyEnvelope(envelope, {
    requireVerified: true,
    expectedCluster: 'mainnet-beta'
  });

  assert.equal(matched.ok, true);
  assert.equal(matched.checks.expectedClusterValid, true);
  assert.equal(mismatched.ok, false);
  assert.equal(mismatched.checks.expectedClusterValid, false);
});

test('solana qr text fragmentation should round-trip', () => {
  const txCase = buildSolanaCases()[1];
  const envelope = solana.signTransactionToEnvelope({
    txLike: txCase.txLike,
    signers: [payer],
    cluster: txCase.cluster,
    vendorId: 'wallet.example',
    signingCertificate: signingIdentity.certificate,
    signingPrivateKeyPem: signingIdentity.privateKeyPem
  });

  const qrText = solana.encodeEnvelopeToQrText(envelope);
  const fragments = solana.splitQrText(qrText, { maxFragmentLength: 120 });
  const rebuiltText = solana.joinQrTextFragments(fragments);
  const decoded = solana.decodeEnvelopeFromQrText(rebuiltText);

  assert.ok(fragments.length > 1);
  assert.equal(rebuiltText, qrText);
  assert.equal(
    solana.parseSolanaTransaction(decoded.tx.serialized_tx_bytes).txFormat,
    'v0'
  );
});

test('solana tampering should break verification', () => {
  const txCase = buildSolanaCases()[1];
  const envelope = solana.signTransactionToEnvelope({
    txLike: txCase.txLike,
    signers: [payer],
    cluster: txCase.cluster,
    vendorId: 'wallet.example',
    signingCertificate: signingIdentity.certificate,
    signingPrivateKeyPem: signingIdentity.privateKeyPem
  });

  const tampered = solana.decodeEnvelope(solana.encodeEnvelope(envelope));
  const mutatedBytes = new Uint8Array(Buffer.from(tampered.tx.serialized_tx_bytes));
  mutatedBytes[5] ^= 0x01;
  tampered.tx.serialized_tx_bytes = mutatedBytes;

  const verification = sdk.solana.verifyEnvelope(tampered, {
    requireVerified: true
  });

  assert.equal(verification.ok, false);
  assert.equal(verification.auth.verified, false);
  assert.equal(verification.parsedTx.signaturesValid, false);
});
