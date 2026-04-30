import { cborEncode } from './cbor.js';
import {
  addDaysToIsoDate,
  fingerprintPublicKey,
  generateEd25519KeyPair,
  isIsoDateWithinRange,
  isoNow,
  publicKeyPemToDer,
  verifyEd25519,
  signEd25519
} from './crypto.js';

export const DEFAULT_VENDOR_ROOT_VALIDITY_DAYS = 365;
export const DEFAULT_QR_SIGNING_CERT_VALIDITY_DAYS = 180;

function assertString(value, label) {
  if (!String(value || '').trim()) {
    throw new TypeError(`${label} is required`);
  }
  return String(value).trim();
}

function normalizeStatus(status, fallback = 'active') {
  return String(status || fallback).trim().toLowerCase();
}

function normalizeValidityWindow(validFrom, validTo, defaultValidityDays) {
  const normalizedFrom = String(validFrom || isoNow());
  return {
    validFrom: normalizedFrom,
    validTo: validTo
      ? String(validTo)
      : addDaysToIsoDate(normalizedFrom, defaultValidityDays)
  };
}

function buildQrSigningCertPayload({
  vendorId,
  keyId,
  publicKey,
  issuerRootFingerprint,
  algorithm = 'Ed25519',
  validFrom = isoNow(),
  validTo,
  status = 'active'
}) {
  const validity = normalizeValidityWindow(
    validFrom,
    validTo,
    DEFAULT_QR_SIGNING_CERT_VALIDITY_DAYS
  );
  return {
    version: 1,
    cert_type: 'qr_signing',
    vendor_id: assertString(vendorId, 'vendorId'),
    key_id: assertString(keyId, 'keyId'),
    algorithm: assertString(algorithm, 'algorithm'),
    public_key: publicKey,
    issuer_root_fingerprint: assertString(issuerRootFingerprint, 'issuerRootFingerprint'),
    valid_from: validity.validFrom,
    valid_to: validity.validTo,
    status: normalizeStatus(status)
  };
}

function buildQrSigningCertPayloadBytes(certificate) {
  return cborEncode({
    version: certificate.version,
    cert_type: certificate.cert_type,
    vendor_id: certificate.vendor_id,
    key_id: certificate.key_id,
    algorithm: certificate.algorithm,
    public_key: certificate.public_key,
    issuer_root_fingerprint: certificate.issuer_root_fingerprint,
    valid_from: certificate.valid_from,
    valid_to: certificate.valid_to,
    status: certificate.status
  });
}

export function buildVendorRootRecord({
  vendorId,
  displayName,
  publicKey,
  algorithm = 'Ed25519',
  validFrom = isoNow(),
  validTo,
  status = 'active'
}) {
  const publicKeyBytes = publicKey instanceof Uint8Array ? publicKey : publicKeyPemToDer(publicKey);
  const validity = normalizeValidityWindow(
    validFrom,
    validTo,
    DEFAULT_VENDOR_ROOT_VALIDITY_DAYS
  );
  return {
    version: 1,
    record_type: 'vendor_root',
    vendor_id: assertString(vendorId, 'vendorId'),
    display_name: assertString(displayName, 'displayName'),
    algorithm: assertString(algorithm, 'algorithm'),
    public_key: publicKeyBytes,
    root_fingerprint: fingerprintPublicKey(publicKeyBytes),
    valid_from: validity.validFrom,
    valid_to: validity.validTo,
    status: normalizeStatus(status)
  };
}

export function generateVendorRoot({
  vendorId,
  displayName,
  validFrom,
  validTo,
  status,
  algorithm
}) {
  const keyPair = generateEd25519KeyPair();
  return {
    ...keyPair,
    rootRecord: buildVendorRootRecord({
      vendorId,
      displayName,
      publicKey: keyPair.publicKeyDer,
      validFrom,
      validTo,
      status,
      algorithm
    })
  };
}

export function issueQrSigningCertificate({
  vendorId,
  keyId,
  publicKey,
  rootRecord,
  rootPrivateKeyPem,
  validFrom = isoNow(),
  validTo,
  status,
  algorithm
}) {
  if (!rootRecord?.root_fingerprint) {
    throw new TypeError('rootRecord is required');
  }
  const publicKeyBytes = publicKey instanceof Uint8Array ? publicKey : publicKeyPemToDer(publicKey);
  const payload = buildQrSigningCertPayload({
    vendorId,
    keyId,
    publicKey: publicKeyBytes,
    issuerRootFingerprint: rootRecord.root_fingerprint,
    algorithm,
    validFrom,
    validTo,
    status
  });
  return {
    ...payload,
    issuer_signature: signEd25519(buildQrSigningCertPayloadBytes(payload), rootPrivateKeyPem)
  };
}

export function generateQrSigningIdentity({
  vendorId,
  keyId,
  rootRecord,
  rootPrivateKeyPem,
  validFrom,
  validTo,
  status,
  algorithm
}) {
  const keyPair = generateEd25519KeyPair();
  return {
    ...keyPair,
    certificate: issueQrSigningCertificate({
      vendorId,
      keyId,
      publicKey: keyPair.publicKeyDer,
      rootRecord,
      rootPrivateKeyPem,
      validFrom,
      validTo,
      status,
      algorithm
    })
  };
}

export function verifyQrSigningCertificate(
  certificate,
  { trustedRoots = [], now = isoNow() } = {}
) {
  if (!certificate || typeof certificate !== 'object') {
    return { verified: false, reason: 'missing_certificate' };
  }

  const rootRecord = trustedRoots.find(
    (candidate) => candidate.root_fingerprint === certificate.issuer_root_fingerprint
  );
  if (!rootRecord) {
    return { verified: false, reason: 'unknown_root' };
  }
  if (normalizeStatus(rootRecord.status) !== 'active') {
    return { verified: false, reason: 'root_inactive', rootRecord };
  }
  if (!isIsoDateWithinRange(now, rootRecord.valid_from, rootRecord.valid_to)) {
    return { verified: false, reason: 'root_expired', rootRecord };
  }
  if (normalizeStatus(certificate.status) !== 'active') {
    return { verified: false, reason: 'certificate_inactive', rootRecord };
  }
  if (!isIsoDateWithinRange(now, certificate.valid_from, certificate.valid_to)) {
    return { verified: false, reason: 'certificate_expired', rootRecord };
  }
  if (certificate.vendor_id !== rootRecord.vendor_id) {
    return { verified: false, reason: 'vendor_mismatch', rootRecord };
  }

  const verified = verifyEd25519(
    buildQrSigningCertPayloadBytes(certificate),
    certificate.issuer_signature,
    rootRecord.public_key
  );
  if (!verified) {
    return { verified: false, reason: 'certificate_signature_invalid', rootRecord };
  }

  return {
    verified: true,
    certificate,
    rootRecord,
    reason: 'ok'
  };
}
