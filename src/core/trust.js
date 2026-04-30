import { cborDecode, cborEncode } from './cbor.js';
import { verifyQrSigningCertificate } from './certs.js';
import { createDetachedCoseSign1, verifyDetachedCoseSign1 } from './cose.js';
import {
  addDaysToIsoDate,
  base64UrlEncode,
  isIsoDateWithinRange,
  isoNow
} from './crypto.js';

// WTP-v1 keeps the earlier `wtv` wire namespace for draft compatibility.
export const WTV_WELL_KNOWN_SUFFIX = 'wtv';
export const WTV_METADATA_CBOR_PATH = '/.well-known/wtv/metadata.cbor';
export const WTV_METADATA_JSON_PATH = '/.well-known/wtv/metadata.json';
export const WTP_WELL_KNOWN_SUFFIX = WTV_WELL_KNOWN_SUFFIX;
export const WTP_METADATA_CBOR_PATH = WTV_METADATA_CBOR_PATH;
export const WTP_METADATA_JSON_PATH = WTV_METADATA_JSON_PATH;
export const DEFAULT_TRUST_METADATA_VALIDITY_DAYS = 180;

function normalizeText(value) {
  return String(value || '').trim();
}

function maybeStringify(value) {
  return value === undefined || value === null || value === '' ? '' : String(value);
}

function maybeBytes(value) {
  if (value === undefined || value === null) {
    return null;
  }
  if (value instanceof Uint8Array) {
    return value;
  }
  return value;
}

function normalizeMirror(mirror) {
  return {
    role: normalizeText(mirror?.role || 'primary'),
    url: normalizeText(mirror?.url),
    media_type: normalizeText(mirror?.media_type || 'application/cbor')
  };
}

function normalizeRevocation(revocation) {
  return {
    type: normalizeText(revocation?.type || 'signing_key'),
    key_id: normalizeText(revocation?.key_id),
    root_fingerprint: normalizeText(revocation?.root_fingerprint),
    revoked_at: maybeStringify(revocation?.revoked_at),
    reason: normalizeText(revocation?.reason || 'unspecified')
  };
}

function isRevocationActive(revocation, now) {
  if (!revocation.revoked_at) {
    return true;
  }
  const revokedAt = new Date(revocation.revoked_at).getTime();
  const nowTime = new Date(now || Date.now()).getTime();
  return Number.isFinite(revokedAt) && Number.isFinite(nowTime) && nowTime >= revokedAt;
}

function findRootRevocation(rootFingerprint, revocations) {
  return revocations.find((revocation) => {
    const type = revocation.type || 'signing_key';
    return (
      (type === 'vendor_root' || type === 'root') &&
      revocation.root_fingerprint &&
      revocation.root_fingerprint === rootFingerprint
    );
  });
}

function findSigningCertificateRevocation(certificate, revocations) {
  return revocations.find((revocation) => {
    const type = revocation.type || 'signing_key';
    const typeMatches =
      type === 'signing_key' || type === 'qr_signing_cert' || type === 'certificate';
    const keyMatches = revocation.key_id && revocation.key_id === certificate.key_id;
    const rootMatches =
      !revocation.root_fingerprint ||
      revocation.root_fingerprint === certificate.issuer_root_fingerprint;
    return typeMatches && keyMatches && rootMatches;
  });
}

function normalizeRootRecord(root) {
  return {
    version: Number(root?.version || 1),
    record_type: normalizeText(root?.record_type || 'vendor_root'),
    vendor_id: normalizeText(root?.vendor_id),
    display_name: normalizeText(root?.display_name),
    algorithm: normalizeText(root?.algorithm || 'Ed25519'),
    public_key: maybeBytes(root?.public_key),
    root_fingerprint: normalizeText(root?.root_fingerprint),
    valid_from: maybeStringify(root?.valid_from),
    valid_to: maybeStringify(root?.valid_to),
    status: normalizeText(root?.status || 'active')
  };
}

function normalizeSigningCertificate(certificate) {
  if (!certificate) {
    return null;
  }
  return {
    version: Number(certificate.version || 1),
    cert_type: normalizeText(certificate.cert_type || 'qr_signing'),
    vendor_id: normalizeText(certificate.vendor_id),
    key_id: normalizeText(certificate.key_id),
    algorithm: normalizeText(certificate.algorithm || 'Ed25519'),
    public_key: maybeBytes(certificate.public_key),
    issuer_root_fingerprint: normalizeText(certificate.issuer_root_fingerprint),
    valid_from: maybeStringify(certificate.valid_from),
    valid_to: maybeStringify(certificate.valid_to),
    status: normalizeText(certificate.status || 'active'),
    issuer_signature: maybeBytes(certificate.issuer_signature)
  };
}

function canonicalizeTrustBody(record) {
  return {
    schema: normalizeText(record?.schema || 'wtv-trust'),
    version: Number(record?.version || 1),
    vendor_id: normalizeText(record?.vendor_id),
    display_name: normalizeText(record?.display_name),
    issued_at: maybeStringify(record?.issued_at),
    expires_at: maybeStringify(record?.expires_at),
    roots: Array.isArray(record?.roots) ? record.roots.map(normalizeRootRecord) : [],
    qr_signing_certs: Array.isArray(record?.qr_signing_certs)
      ? record.qr_signing_certs.map(normalizeSigningCertificate).filter(Boolean)
      : [],
    revocations: Array.isArray(record?.revocations)
      ? record.revocations.map(normalizeRevocation)
      : [],
    mirrors: Array.isArray(record?.mirrors) ? record.mirrors.map(normalizeMirror) : []
  };
}

function normalizeMetadataAuth(auth) {
  return {
    auth_mode: normalizeText(auth?.auth_mode || 'none'),
    root_fingerprint: normalizeText(auth?.root_fingerprint),
    signing_key_id: normalizeText(auth?.signing_key_id),
    algorithm: normalizeText(auth?.algorithm || 'Ed25519'),
    signature: maybeBytes(auth?.signature)
  };
}

function normalizeTrustMetadata(metadata) {
  return {
    ...canonicalizeTrustBody(metadata),
    auth: normalizeMetadataAuth(metadata?.auth)
  };
}

function getCanonicalTrustBodyBytes(metadata) {
  return cborEncode(canonicalizeTrustBody(metadata));
}

function encodeDiagnosticValue(value) {
  if (value instanceof Uint8Array) {
    return {
      encoding: 'base64url',
      value: base64UrlEncode(value)
    };
  }
  if (Array.isArray(value)) {
    return value.map((item) => encodeDiagnosticValue(item));
  }
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, child]) => [key, encodeDiagnosticValue(child)])
    );
  }
  return value;
}

export function createTrustMetadata({
  vendorId,
  displayName,
  roots = [],
  qrSigningCerts = [],
  revocations = [],
  mirrors = [],
  signerRootRecord,
  signerPrivateKeyPem,
  issuedAt = isoNow(),
  expiresAt
}) {
  const normalizedIssuedAt = String(issuedAt || isoNow());
  const body = canonicalizeTrustBody({
    schema: 'wtv-trust',
    version: 1,
    vendor_id: vendorId,
    display_name: displayName,
    issued_at: normalizedIssuedAt,
    expires_at:
      expiresAt ||
      addDaysToIsoDate(normalizedIssuedAt, DEFAULT_TRUST_METADATA_VALIDITY_DAYS),
    roots,
    qr_signing_certs: qrSigningCerts,
    revocations,
    mirrors
  });

  if (!signerRootRecord || !signerPrivateKeyPem) {
    return {
      ...body,
      auth: normalizeMetadataAuth({ auth_mode: 'none' })
    };
  }

  return {
    ...body,
    auth: normalizeMetadataAuth({
      auth_mode: 'root_sig',
      root_fingerprint: signerRootRecord.root_fingerprint,
      signing_key_id: 'root',
      algorithm: signerRootRecord.algorithm || 'Ed25519',
      signature: createDetachedCoseSign1({
        payloadBytes: getCanonicalTrustBodyBytes(body),
        privateKeyPem: signerPrivateKeyPem,
        keyId: 'root'
      })
    })
  };
}

export function encodeTrustMetadata(metadata) {
  return cborEncode(normalizeTrustMetadata(metadata));
}

export function decodeTrustMetadata(bytes) {
  return normalizeTrustMetadata(cborDecode(bytes));
}

export function trustMetadataToDiagnosticJson(metadata) {
  return encodeDiagnosticValue(normalizeTrustMetadata(metadata));
}

export function buildWellKnownWtvUrls(origin) {
  const base = String(origin || '').replace(/\/+$/, '');
  return {
    suffix: WTV_WELL_KNOWN_SUFFIX,
    metadataCborUrl: `${base}${WTV_METADATA_CBOR_PATH}`,
    metadataJsonUrl: `${base}${WTV_METADATA_JSON_PATH}`
  };
}

export const buildWellKnownWtpUrls = buildWellKnownWtvUrls;

export function verifyTrustMetadata(
  metadataLike,
  { trustedRoots = [], now = isoNow(), requireSigned = false } = {}
) {
  const metadata =
    metadataLike instanceof Uint8Array
      ? decodeTrustMetadata(metadataLike)
      : normalizeTrustMetadata(metadataLike);

  const schemaValid = metadata.schema === 'wtv-trust';
  const versionValid = metadata.version === 1;
  const vendorDeclared = Boolean(metadata.vendor_id);
  const metadataFresh =
    Boolean(metadata.issued_at) &&
    Boolean(metadata.expires_at) &&
    isIsoDateWithinRange(now, metadata.issued_at, metadata.expires_at);
  const activeRevocations = metadata.revocations.filter((revocation) =>
    isRevocationActive(revocation, now)
  );
  const auth = metadata.auth;

  let authResult = {
    verified: false,
    trustLevel: 'none',
    reason: 'unsigned'
  };

  if (auth.auth_mode === 'root_sig') {
    const trustedRoot = trustedRoots.find(
      (root) => root.root_fingerprint === auth.root_fingerprint
    );

    if (!trustedRoot) {
      authResult = {
        verified: false,
        trustLevel: 'declared',
        reason: 'unknown_root'
      };
    } else if (String(trustedRoot.status || 'active').trim().toLowerCase() !== 'active') {
      authResult = {
        verified: false,
        trustLevel: 'declared',
        reason: 'root_inactive',
        rootRecord: trustedRoot
      };
    } else if (!isIsoDateWithinRange(now, trustedRoot.valid_from, trustedRoot.valid_to)) {
      authResult = {
        verified: false,
        trustLevel: 'declared',
        reason: 'root_expired',
        rootRecord: trustedRoot
      };
    } else {
      const signatureResult = verifyDetachedCoseSign1({
        coseSign1Bytes: auth.signature,
        payloadBytes: getCanonicalTrustBodyBytes(metadata),
        publicKey: trustedRoot.public_key
      });

      authResult = {
        verified: signatureResult.verified,
        trustLevel: signatureResult.verified ? 'verified' : 'declared',
        reason: signatureResult.reason,
        rootFingerprint: auth.root_fingerprint,
        rootRecord: trustedRoot
      };
    }
    const authRootRevocation = findRootRevocation(auth.root_fingerprint, activeRevocations);
    if (authRootRevocation && authResult.verified) {
      authResult = {
        ...authResult,
        verified: false,
        trustLevel: 'declared',
        reason: 'root_revoked',
        revocation: authRootRevocation
      };
    }
  }

  const certChecks = metadata.qr_signing_certs.map((certificate) => {
    const rootRevocation = findRootRevocation(
      certificate.issuer_root_fingerprint,
      activeRevocations
    );
    if (rootRevocation) {
      return {
        verified: false,
        reason: 'root_revoked',
        certificate,
        revocation: rootRevocation
      };
    }

    const certRevocation = findSigningCertificateRevocation(
      certificate,
      activeRevocations
    );
    if (certRevocation) {
      return {
        verified: false,
        reason: 'certificate_revoked',
        certificate,
        revocation: certRevocation
      };
    }

    return verifyQrSigningCertificate(certificate, {
      trustedRoots: metadata.roots.length ? metadata.roots : trustedRoots,
      now
    });
  });

  const certificatesValid = certChecks.every((check) => check.verified);
  const signedMetadataValid =
    auth.auth_mode !== 'root_sig' || authResult.verified;
  const ok =
    schemaValid &&
    versionValid &&
    vendorDeclared &&
    metadataFresh &&
    signedMetadataValid &&
    certificatesValid &&
    (!requireSigned || authResult.verified);

  return {
    ok,
    metadata,
    checks: {
      schemaValid,
      versionValid,
      vendorDeclared,
      metadataFresh,
      signedMetadataValid,
      certificatesValid
    },
    auth: authResult,
    certificateChecks: certChecks
  };
}
