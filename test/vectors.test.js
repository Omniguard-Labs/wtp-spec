import fs from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';

import {
  WtvSdk,
  decodeTrustMetadata,
  encodeTrustMetadata,
  evm,
  solana,
  trustMetadataToDiagnosticJson,
  verifyTrustMetadata
} from '../src/index.js';

const vectors = JSON.parse(fs.readFileSync('test/vectors/wtv-v1-smoke.json', 'utf8'));

function bytesFromHex(value) {
  return new Uint8Array(Buffer.from(value.replace(/^0x/, ''), 'hex'));
}

function hexOf(value) {
  return `0x${Buffer.from(value).toString('hex')}`;
}

test('conformance vectors should decode and verify without regeneration', () => {
  const sdk = new WtvSdk();

  for (const vector of vectors.envelopes) {
    const bytes = bytesFromHex(vector.envelope_cbor_hex);
    let decoded;
    let encoded;
    let verification;

    if (vector.profile === 'evm-safe-v1') {
      decoded = evm.decodeSafeEnvelope(bytes);
      encoded = evm.encodeSafeEnvelope(decoded);
      verification = sdk.evm.verifySafeEnvelope(decoded);
      assert.equal(decoded.tx.safe, vector.expected_safe);
    } else if (vector.chain_family === 'evm') {
      decoded = evm.decodeEnvelope(bytes);
      encoded = evm.encodeEnvelope(decoded);
      verification = sdk.evm.verifyEnvelope(decoded);
      assert.equal(verification.parsedTx.from, vector.expected_from);
    } else if (vector.chain_family === 'solana') {
      decoded = solana.decodeEnvelope(bytes);
      encoded = solana.encodeEnvelope(decoded);
      verification = sdk.solana.verifyEnvelope(decoded, {
        expectedCluster: vector.expected_cluster
      });
      assert.equal(verification.parsedTx.feePayer, vector.expected_fee_payer);
    } else {
      throw new Error(`unsupported vector chain family: ${vector.chain_family}`);
    }

    assert.equal(hexOf(encoded), vector.envelope_cbor_hex);
    assert.equal(decoded.schema, 'wtv');
    assert.equal(decoded.chain_family, vector.chain_family);
    assert.equal(decoded.profile, vector.profile);
    assert.equal(decoded.tx.tx_kind, vector.tx_kind);
    assert.equal(hexOf(decoded.tx.payload_hash), vector.payload_hash_hex);
    assert.equal(verification.ok, vector.expected_ok);
  }
});

test('well-known metadata CBOR sample should match JSON mirror and vector', () => {
  const cborBytes = new Uint8Array(
    fs.readFileSync('vendors/wallet.example/.well-known/wtv/metadata.cbor')
  );
  const jsonMirror = JSON.parse(
    fs.readFileSync('vendors/wallet.example/.well-known/wtv/metadata.json', 'utf8')
  );
  const metadata = decodeTrustMetadata(cborBytes);
  const verification = verifyTrustMetadata(metadata, {
    trustedRoots: metadata.roots,
    now: '2026-05-01T00:00:00.000Z',
    requireSigned: true
  });

  assert.equal(hexOf(cborBytes), vectors.trust_metadata.metadata_cbor_hex);
  assert.equal(hexOf(encodeTrustMetadata(metadata)), vectors.trust_metadata.metadata_cbor_hex);
  assert.deepEqual(trustMetadataToDiagnosticJson(metadata), jsonMirror);
  assert.equal(metadata.schema, vectors.trust_metadata.schema);
  assert.equal(metadata.version, vectors.trust_metadata.version);
  assert.equal(metadata.vendor_id, vectors.trust_metadata.vendor_id);
  assert.equal(metadata.auth.auth_mode, vectors.trust_metadata.auth_mode);
  assert.equal(verification.ok, vectors.trust_metadata.expected_ok);
});
