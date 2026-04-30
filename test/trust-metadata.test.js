import test from 'node:test';
import assert from 'node:assert/strict';

import {
  WtpSdk,
  WtvSdk,
  buildWellKnownWtpUrls,
  createTrustMetadata,
  decodeTrustMetadata,
  encodeTrustMetadata,
  generateQrSigningIdentity,
  generateVendorRoot,
  trustMetadataToDiagnosticJson,
  verifyQrSigningCertificate,
  verifyTrustMetadata
} from '../src/index.js';

const VERIFY_NOW = '2026-04-30T00:00:00.000Z';

const vendorRoot = generateVendorRoot({
  vendorId: 'wallet.example',
  displayName: 'Wallet Example',
  validFrom: '2026-04-01T00:00:00.000Z'
});

const signingIdentity = generateQrSigningIdentity({
  vendorId: 'wallet.example',
  keyId: 'qr-2026-01',
  rootRecord: vendorRoot.rootRecord,
  rootPrivateKeyPem: vendorRoot.privateKeyPem,
  validFrom: '2026-04-01T00:00:00.000Z'
});

const trustedRoots = [vendorRoot.rootRecord];

function buildMetadata(overrides = {}) {
  return createTrustMetadata({
    vendorId: 'wallet.example',
    displayName: 'Wallet Example',
    roots: [vendorRoot.rootRecord],
    qrSigningCerts: [signingIdentity.certificate],
    revocations: overrides.revocations || [],
    mirrors: [
      {
        role: 'primary',
        url: 'https://wallet.example/.well-known/wtv/metadata.cbor',
        media_type: 'application/cbor'
      }
    ],
    signerRootRecord: vendorRoot.rootRecord,
    signerPrivateKeyPem: vendorRoot.privateKeyPem,
    issuedAt: overrides.issuedAt || '2026-04-19T00:00:00.000Z',
    expiresAt: overrides.expiresAt || '2026-07-19T00:00:00.000Z'
  });
}

test('trust metadata should encode, decode, and verify', () => {
  const metadata = buildMetadata();
  const encoded = encodeTrustMetadata(metadata);
  const decoded = decodeTrustMetadata(encoded);
  const verification = verifyTrustMetadata(decoded, {
    trustedRoots,
    now: VERIFY_NOW,
    requireSigned: true
  });

  assert.equal(decoded.schema, 'wtv-trust');
  assert.equal(decoded.vendor_id, 'wallet.example');
  assert.equal(decoded.auth.auth_mode, 'root_sig');
  assert.equal(verification.ok, true);
  assert.equal(verification.auth.verified, true);
  assert.equal(verification.certificateChecks[0].verified, true);
});

test('WtpSdk should verify trust metadata with preloaded roots', () => {
  const metadata = buildMetadata();
  const sdk = new WtpSdk({ trustedRoots });
  const verification = sdk.verifyTrustMetadata(metadata, {
    now: VERIFY_NOW,
    requireSigned: true
  });

  assert.equal(verification.ok, true);
  assert.equal(verification.auth.verified, true);
});

test('WtvSdk should remain as a compatibility alias', () => {
  const sdk = new WtvSdk({ trustedRoots });

  assert.equal(sdk instanceof WtpSdk, true);
});

test('tampered trust metadata should fail signature verification', () => {
  const metadata = decodeTrustMetadata(encodeTrustMetadata(buildMetadata()));
  metadata.mirrors[0].url = 'https://evil.example/.well-known/wtv/metadata.cbor';

  const verification = verifyTrustMetadata(metadata, {
    trustedRoots,
    now: VERIFY_NOW,
    requireSigned: true
  });

  assert.equal(verification.ok, false);
  assert.equal(verification.auth.verified, false);
});

test('trust metadata should fail after expires_at', () => {
  const metadata = buildMetadata({
    expiresAt: '2026-04-20T00:00:00.000Z'
  });
  const verification = verifyTrustMetadata(metadata, {
    trustedRoots,
    now: VERIFY_NOW,
    requireSigned: true
  });

  assert.equal(verification.ok, false);
  assert.equal(verification.checks.metadataFresh, false);
  assert.equal(verification.auth.verified, true);
});

test('trust metadata should apply signing certificate revocations', () => {
  const metadata = buildMetadata({
    revocations: [
      {
        type: 'signing_key',
        key_id: 'qr-2026-01',
        root_fingerprint: vendorRoot.rootRecord.root_fingerprint,
        revoked_at: '2026-04-20T00:00:00.000Z',
        reason: 'rotation'
      }
    ]
  });
  const verification = verifyTrustMetadata(metadata, {
    trustedRoots,
    now: VERIFY_NOW,
    requireSigned: true
  });

  assert.equal(verification.ok, false);
  assert.equal(verification.checks.certificatesValid, false);
  assert.equal(verification.certificateChecks[0].verified, false);
  assert.equal(verification.certificateChecks[0].reason, 'certificate_revoked');
});

test('trust metadata root signature should fail when trusted root is expired', () => {
  const expiredRoot = generateVendorRoot({
    vendorId: 'expired.example',
    displayName: 'Expired Example',
    validFrom: '2026-01-01T00:00:00.000Z',
    validTo: '2026-04-01T00:00:00.000Z'
  });
  const metadata = createTrustMetadata({
    vendorId: 'expired.example',
    displayName: 'Expired Example',
    roots: [expiredRoot.rootRecord],
    qrSigningCerts: [],
    signerRootRecord: expiredRoot.rootRecord,
    signerPrivateKeyPem: expiredRoot.privateKeyPem,
    issuedAt: '2026-03-01T00:00:00.000Z',
    expiresAt: '2026-07-01T00:00:00.000Z'
  });
  const verification = verifyTrustMetadata(metadata, {
    trustedRoots: [expiredRoot.rootRecord],
    now: VERIFY_NOW,
    requireSigned: true
  });

  assert.equal(verification.ok, false);
  assert.equal(verification.auth.verified, false);
  assert.equal(verification.auth.reason, 'root_expired');
});

test('vendor root, QR signing certificate, and metadata should get finite default validity windows', () => {
  const root = generateVendorRoot({
    vendorId: 'window.example',
    displayName: 'Window Example',
    validFrom: '2026-01-01T00:00:00.000Z'
  });
  const identity = generateQrSigningIdentity({
    vendorId: 'window.example',
    keyId: 'qr-2026-01',
    rootRecord: root.rootRecord,
    rootPrivateKeyPem: root.privateKeyPem,
    validFrom: '2026-01-01T00:00:00.000Z'
  });
  const metadata = createTrustMetadata({
    vendorId: 'window.example',
    displayName: 'Window Example',
    roots: [root.rootRecord],
    qrSigningCerts: [identity.certificate],
    signerRootRecord: root.rootRecord,
    signerPrivateKeyPem: root.privateKeyPem,
    issuedAt: '2026-01-01T00:00:00.000Z'
  });

  assert.equal(root.rootRecord.valid_to, '2027-01-01T00:00:00.000Z');
  assert.equal(identity.certificate.valid_to, '2026-06-30T00:00:00.000Z');
  assert.equal(metadata.expires_at, '2026-06-30T00:00:00.000Z');

  const certValid = verifyQrSigningCertificate(identity.certificate, {
    trustedRoots: [root.rootRecord],
    now: '2026-06-29T00:00:00.000Z'
  });
  const certExpired = verifyQrSigningCertificate(identity.certificate, {
    trustedRoots: [root.rootRecord],
    now: '2026-07-01T00:00:00.000Z'
  });

  assert.equal(certValid.verified, true);
  assert.equal(certExpired.verified, false);
  assert.equal(certExpired.reason, 'certificate_expired');
});

test('trust metadata diagnostic json should encode binary fields', () => {
  const metadata = buildMetadata();
  const diagnostic = trustMetadataToDiagnosticJson(metadata);

  assert.equal(diagnostic.schema, 'wtv-trust');
  assert.equal(diagnostic.roots[0].public_key.encoding, 'base64url');
  assert.equal(diagnostic.qr_signing_certs[0].issuer_signature.encoding, 'base64url');
  assert.equal(diagnostic.auth.signature.encoding, 'base64url');
});

test('well-known helper should build standard publication urls', () => {
  const urls = buildWellKnownWtpUrls('https://wallet.example/');

  assert.equal(urls.suffix, 'wtv');
  assert.equal(urls.metadataCborUrl, 'https://wallet.example/.well-known/wtv/metadata.cbor');
  assert.equal(urls.metadataJsonUrl, 'https://wallet.example/.well-known/wtv/metadata.json');
});
