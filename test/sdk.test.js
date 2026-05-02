import test from 'node:test';
import assert from 'node:assert/strict';

import {
  WtpSdk,
  decodeEnvelope,
  generateQrSigningIdentity,
  generateVendorRoot,
  evm,
  verifyQrSigningCertificate
} from '../src/index.js';

const TX_PRIVATE_KEY =
  '0x59c6995e998f97a5a0044966f094538b29285e6f2d7cb3d5f2b0a3a85d27bce1';
const AUTH_PRIVATE_KEY =
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
const sdk = new WtpSdk({ trustedRoots });

function buildBlobVersionedHash(fill) {
  return `0x01${String(fill).repeat(62)}`;
}

function buildTxCases() {
  const authorization = evm.signEip7702Authorization({
    chainId: 1,
    address: '0x9999999999999999999999999999999999999999',
    nonce: 7,
    privateKey: AUTH_PRIVATE_KEY
  });

  return [
    {
      name: 'legacy',
      txLike: {
        type: 'legacy',
        chainId: 1,
        nonce: 1,
        gasPrice: 20_000_000_000n,
        gasLimit: 21_000,
        to: '0x1111111111111111111111111111111111111111',
        value: 123456789n,
        data: '0x'
      }
    },
    {
      name: 'eip2930',
      txLike: {
        type: 'eip2930',
        chainId: 1,
        nonce: 2,
        gasPrice: 30_000_000_000n,
        gasLimit: 80_000,
        to: '0x2222222222222222222222222222222222222222',
        value: 42n,
        data: '0xa9059cbb',
        accessList: [
          {
            address: '0x3333333333333333333333333333333333333333',
            storageKeys: [
              '0x0000000000000000000000000000000000000000000000000000000000000001'
            ]
          }
        ]
      }
    },
    {
      name: 'eip1559',
      txLike: {
        type: 'eip1559',
        chainId: 1,
        nonce: 3,
        maxPriorityFeePerGas: 2_000_000_000n,
        maxFeePerGas: 40_000_000_000n,
        gasLimit: 120_000,
        to: '0x4444444444444444444444444444444444444444',
        value: 0n,
        data: '0xdeadbeef',
        accessList: [
          {
            address: '0x5555555555555555555555555555555555555555',
            storageKeys: []
          }
        ]
      }
    },
    {
      name: 'eip4844',
      txLike: {
        type: 'eip4844',
        chainId: 1,
        nonce: 4,
        maxPriorityFeePerGas: 3_000_000_000n,
        maxFeePerGas: 50_000_000_000n,
        gasLimit: 150_000,
        to: '0x6666666666666666666666666666666666666666',
        value: 0n,
        data: '0x1234',
        accessList: [],
        maxFeePerBlobGas: 1_000_000_000n,
        blobVersionedHashes: [buildBlobVersionedHash('a')]
      }
    },
    {
      name: 'eip7702',
      txLike: {
        type: 'eip7702',
        chainId: 1,
        nonce: 5,
        maxPriorityFeePerGas: 1_500_000_000n,
        maxFeePerGas: 55_000_000_000n,
        gasLimit: 180_000,
        to: '0x7777777777777777777777777777777777777777',
        value: 0n,
        data: '0xabcdef',
        accessList: [],
        authorizationList: [authorization]
      },
      expectedAuthority: authorization.authority
    }
  ];
}

test('vendor root and qr signing certificate should verify', () => {
  const result = verifyQrSigningCertificate(signingIdentity.certificate, {
    trustedRoots
  });

  assert.equal(result.verified, true);
  assert.equal(result.rootRecord.root_fingerprint, vendorRoot.rootRecord.root_fingerprint);
  assert.equal(result.certificate.key_id, 'qr-2026-01');
});

for (const txCase of buildTxCases()) {
  test(`unsigned sign-request envelope should round-trip for ${txCase.name}`, () => {
    const envelope = evm.createSignRequestEnvelope({
      txLike: txCase.txLike,
      from: evm.signEvmTransaction(txCase.txLike, TX_PRIVATE_KEY).from,
      vendorId: 'wallet.example',
      signingCertificate: signingIdentity.certificate,
      signingPrivateKeyPem: signingIdentity.privateKeyPem,
      walletAppId: 'omniarb.test'
    });

    const qrText = evm.encodeEnvelopeToQrText(envelope);
    const decoded = evm.decodeEnvelopeFromQrText(qrText);
    const verification = sdk.evm.verifyEnvelope(decoded, {
      requireVerified: true
    });

    assert.equal(decoded.schema, 'wtp');
    assert.equal(decoded.chain_family, 'evm');
    assert.equal(decoded.profile, 'evm-tx-v1');
    assert.equal(decoded.tx.tx_kind, 'sign_request');
    assert.equal(decoded.tx.tx_type, txCase.name);
    assert.equal(verification.ok, true);
    assert.equal(verification.auth.verified, true);
    assert.equal(verification.parsedTx.kind, 'sign_request');
    assert.equal(verification.parsedTx.txTypeName, txCase.name);

    if (txCase.name === 'eip7702') {
      assert.equal(
        verification.parsedTx.authorizationList[0].authority,
        txCase.expectedAuthority
      );
    }
  });

  test(`signed transaction envelope should round-trip for ${txCase.name}`, () => {
    const signedTx = evm.signEvmTransaction(txCase.txLike, TX_PRIVATE_KEY);
    const envelope = evm.createSignedTxEnvelope({
      signedTx: signedTx.serializedTxHex,
      vendorId: 'wallet.example',
      signingCertificate: signingIdentity.certificate,
      signingPrivateKeyPem: signingIdentity.privateKeyPem,
      walletAppId: 'omniarb.test'
    });

    const encoded = evm.encodeEnvelope(envelope);
    const decoded = decodeEnvelope(encoded);
    const verification = sdk.evm.verifyEnvelope(decoded, {
      requireVerified: true
    });

    assert.equal(decoded.schema, 'wtp');
    assert.equal(decoded.chain_family, 'evm');
    assert.equal(decoded.profile, 'evm-tx-v1');
    assert.equal(decoded.tx.tx_kind, 'signed_tx');
    assert.equal(decoded.tx.tx_type, txCase.name);
    assert.equal(verification.ok, true);
    assert.equal(verification.auth.verified, true);
    assert.equal(verification.parsedTx.kind, 'signed_tx');
    assert.equal(verification.parsedTx.txTypeName, txCase.name);
    assert.equal(verification.parsedTx.from, signedTx.from);

    if (txCase.name === 'eip7702') {
      assert.equal(
        verification.parsedTx.authorizationList[0].authority,
        txCase.expectedAuthority
      );
    }
  });
}

test('base unauthenticated envelope should still be recoverable', () => {
  const txLike = buildTxCases()[2].txLike;
  const envelope = evm.createSignRequestEnvelope({
    txLike,
    from: evm.signEvmTransaction(txLike, TX_PRIVATE_KEY).from,
    vendorId: 'unknown-wallet'
  });
  const verification = sdk.evm.verifyEnvelope(envelope);

  assert.equal(verification.ok, true);
  assert.equal(verification.auth.verified, false);
  assert.equal(verification.auth.reason, 'unauthenticated');
  assert.equal(verification.parsedTx.txTypeName, 'eip1559');
});

test('expectedChainId should validate the target EVM chain', () => {
  const txLike = buildTxCases()[2].txLike;
  const envelope = evm.createSignedTxEnvelope({
    signedTx: evm.signEvmTransaction(txLike, TX_PRIVATE_KEY).serializedTxHex,
    vendorId: 'wallet.example',
    signingCertificate: signingIdentity.certificate,
    signingPrivateKeyPem: signingIdentity.privateKeyPem
  });

  const matched = sdk.evm.verifyEnvelope(envelope, {
    requireVerified: true,
    expectedChainId: 1
  });
  const mismatched = sdk.evm.verifyEnvelope(envelope, {
    requireVerified: true,
    expectedChainId: 137
  });

  assert.equal(matched.ok, true);
  assert.equal(matched.checks.expectedChainIdValid, true);
  assert.equal(mismatched.ok, false);
  assert.equal(mismatched.checks.expectedChainIdValid, false);
});

test('qr text fragmentation should round-trip', () => {
  const txLike = buildTxCases()[3].txLike;
  const envelope = evm.createSignedTxEnvelope({
    signedTx: evm.signEvmTransaction(txLike, TX_PRIVATE_KEY).serializedTxHex,
    vendorId: 'wallet.example',
    signingCertificate: signingIdentity.certificate,
    signingPrivateKeyPem: signingIdentity.privateKeyPem
  });

  const qrText = evm.encodeEnvelopeToQrText(envelope);
  const fragments = evm.splitQrText(qrText, { maxFragmentLength: 120 });
  const rebuiltText = evm.joinQrTextFragments(fragments);
  const decoded = evm.decodeEnvelopeFromQrText(rebuiltText);

  assert.ok(fragments.length > 1);
  assert.equal(rebuiltText, qrText);
  assert.equal(evm.parseEvmTransaction(decoded.tx.signed_tx_bytes).txTypeName, 'eip4844');
});

test('tampering should break verification', () => {
  const txLike = buildTxCases()[1].txLike;
  const envelope = evm.createSignedTxEnvelope({
    signedTx: evm.signEvmTransaction(txLike, TX_PRIVATE_KEY).serializedTxHex,
    vendorId: 'wallet.example',
    signingCertificate: signingIdentity.certificate,
    signingPrivateKeyPem: signingIdentity.privateKeyPem
  });

  const tampered = decodeEnvelope(evm.encodeEnvelope(envelope));
  const parsed = evm.parseEvmTransaction(tampered.tx.signed_tx_bytes);
  const mutatedBytes = new Uint8Array(Buffer.from(parsed.serializedTxHex.slice(2), 'hex'));
  mutatedBytes[mutatedBytes.length - 1] ^= 0x01;
  tampered.tx.signed_tx_bytes = mutatedBytes;

  const verification = sdk.evm.verifyEnvelope(tampered, {
    requireVerified: true
  });

  assert.equal(verification.ok, false);
  assert.equal(verification.auth.verified, false);
});
